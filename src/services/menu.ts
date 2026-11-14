import { prisma } from '../db/prisma.js';
import fs from 'node:fs';
import path from 'node:path';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  desc: string;
  emoji: string;
  image?: string;
  active?: boolean;
  volume?: string;
}

export interface Menu {
  categories: Array<{ id: string; name: string; emoji: string }>;
  products: Product[];
}

const DEFAULT_MENU: Menu = {
  categories: [
    { id: 'coffee', name: 'Кофе', emoji: '☕' },
    { id: 'dessert', name: 'Десерты', emoji: '🍰' },
    { id: 'tea', name: 'Чай', emoji: '🍵' },
  ],
  products: [
    { id: 'p1', name: 'Эспрессо', category: 'coffee', price: 150, desc: 'Крепкий кофе 30 мл', emoji: '☕' },
    { id: 'p2', name: 'Американо', category: 'coffee', price: 180, desc: 'Эспрессо с водой 180 мл', emoji: '☕' },
    { id: 'p3', name: 'Капучино', category: 'coffee', price: 220, desc: 'Кофе с молочной пеной', emoji: '☕' },
    { id: 'p4', name: 'Латте', category: 'coffee', price: 240, desc: 'Кофе с молоком 250 мл', emoji: '☕' },
    { id: 'p5', name: 'Раф', category: 'coffee', price: 260, desc: 'Кофе со сливками 180 мл', emoji: '☕' },
    { id: 'p6', name: 'Флэт уайт', category: 'coffee', price: 250, desc: 'Двойной эспрессо с молоком', emoji: '☕' },
    { id: 'p7', name: 'Чизкейк', category: 'dessert', price: 320, desc: 'С ягодным соусом', emoji: '🍰' },
    { id: 'p8', name: 'Тирамису', category: 'dessert', price: 290, desc: 'Классический десерт', emoji: '🍰' },
    { id: 'p9', name: 'Брауни', category: 'dessert', price: 240, desc: 'Шоколадный, с орехами', emoji: '🍪' },
    { id: 'p10', name: 'Круассан', category: 'dessert', price: 190, desc: 'С миндалём', emoji: '🥐' },
    { id: 'p11', name: 'Чёрный чай', category: 'tea', price: 120, desc: '350 мл', emoji: '🍵' },
    { id: 'p12', name: 'Зелёный чай', category: 'tea', price: 130, desc: '350 мл', emoji: '🍵' },
  ],
};

function extractVolume(desc: string): string {
  const m = desc.match(/\d+(?:[.,]\d+)?\s*(?:мл|л|г|кг|шт)/i);
  return m ? m[0].trim() : '';
}

let cache: Menu | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 60_000;

export function invalidateMenuCache(): void {
  cache = null;
  cacheAt = 0;
}

export async function seedMenuIfEmpty(): Promise<void> {
  const count = await prisma.menuProduct.count();
  if (count > 0) return;

  const seedPath = path.resolve(process.cwd(), 'prisma/menu-seed.json');
  if (!fs.existsSync(seedPath)) {
    console.warn('⚠️ menu-seed.json not found, skipping menu seed');
    return;
  }
  const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as {
    categories?: Array<{ id: string; name: string; emoji?: string }>;
    products?: Array<{
      id: string;
      name: string;
      category: string;
      price: number;
      desc?: string;
      emoji?: string;
      image?: string;
      volume?: string;
    }>;
  };
  const now = Date.now();
  const ops: Array<ReturnType<typeof prisma.menuCategory.create> | ReturnType<typeof prisma.menuProduct.create>> = [];
  (raw.categories ?? []).forEach((c, idx) => {
    ops.push(prisma.menuCategory.create({
      data: { id: c.id, name: c.name, emoji: c.emoji ?? '📦', sort: idx, createdAt: now, updatedAt: now },
    }));
  });
  (raw.products ?? []).forEach((p, idx) => {
    ops.push(prisma.menuProduct.create({
      data: {
        id: p.id,
        categoryId: p.category,
        name: p.name,
        price: Number(p.price) || 0,
        desc: p.desc ?? '',
        emoji: p.emoji ?? '☕',
        image: p.image ?? null,
        active: true,
        sort: idx,
        volume: p.volume ?? extractVolume(p.desc ?? ''),
        createdAt: now,
        updatedAt: now,
      },
    }));
  });
  await prisma.$transaction(ops);
  console.log(`🌱 Menu seeded: ${(raw.categories ?? []).length} categories, ${(raw.products ?? []).length} products`);
  invalidateMenuCache();
}

export async function getMenu(): Promise<Menu> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) {
    return cache;
  }

  const categories = await prisma.menuCategory.findMany({ orderBy: { sort: 'asc' } });
  const products = await prisma.menuProduct.findMany({
    where: { active: true },
    orderBy: { sort: 'asc' },
  });

  if (!products.length) {
    cache = DEFAULT_MENU;
    cacheAt = now;
    return cache;
  }

  const menu: Menu = {
    categories: categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.categoryId,
      price: p.price,
      desc: p.desc,
      emoji: p.emoji,
      image: p.image ?? undefined,
      active: p.active,
      volume: p.volume ?? undefined,
    })),
  };
  cache = menu;
  cacheAt = now;
  return menu;
}
