import { prisma } from '../db/prisma.js';
import { loadEnv } from '../config.js';

const env = loadEnv();

export type BaristaRole = 'admin' | 'barista';

export interface BaristaInfo {
  id: number;
  role: BaristaRole;
  name: string;
  createdAt: number;
}

let cache: Map<number, BaristaRole> | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 10_000;

async function loadBaristas(): Promise<Map<number, BaristaRole>> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
  const rows = await prisma.barista.findMany();
  const map = new Map<number, BaristaRole>();
  for (const row of rows) map.set(Number(row.id), row.role === 'admin' ? 'admin' : 'barista');
  cache = map;
  cacheAt = now;
  return map;
}

export function invalidateBaristaCache(): void {
  cache = null;
  cacheAt = 0;
}

export async function seedBaristasIfEmpty(): Promise<void> {
  const count = await prisma.barista.count();
  if (count > 0) return;
  const now = Date.now();
  const baristaIds = (env.BARISTA_CHAT_IDS ?? []).filter((n) => Number.isFinite(n) && n > 0);
  const adminIds = (env.BARISTA_ADMIN_IDS ?? []).filter((n) => Number.isFinite(n) && n > 0);

  const ops = [];
  for (const id of baristaIds) {
    ops.push(
      prisma.barista.create({
        data: { id: BigInt(id), name: '', role: adminIds.includes(id) ? 'admin' : 'barista', createdAt: now },
      }),
    );
  }
  for (const id of adminIds) {
    if (!baristaIds.includes(id)) {
      ops.push(
        prisma.barista.create({ data: { id: BigInt(id), name: '', role: 'admin', createdAt: now } }),
      );
    }
  }
  if (ops.length) await prisma.$transaction(ops);
  invalidateBaristaCache();
  console.log(`🌱 Baristas seeded: ${ops.length} (${adminIds.length} admin)`);
}

export async function getBaristaRole(id: number | string): Promise<BaristaRole | null> {
  const num = Number(id);
  if (!Number.isFinite(num)) return null;
  const map = await loadBaristas();
  return map.get(num) ?? null;
}

export async function isBarista(id: number | string): Promise<boolean> {
  return (await getBaristaRole(id)) !== null;
}

export async function isAdmin(id: number | string): Promise<boolean> {
  return (await getBaristaRole(id)) === 'admin';
}

export async function listBaristas(): Promise<BaristaInfo[]> {
  const rows = await prisma.barista.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map((row) => ({
    id: Number(row.id),
    role: row.role === 'admin' ? 'admin' : 'barista',
    name: row.name,
    createdAt: Number(row.createdAt),
  }));
}

export async function getBaristaChatIds(): Promise<number[]> {
  const map = await loadBaristas();
  return [...map.keys()];
}

export async function addBarista(idInput: unknown, name = ''): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = Number(typeof idInput === 'string' ? idInput.trim() : idInput);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'Некорректный Telegram ID' };
  }
  const bigId = BigInt(id);
  const existing = await prisma.barista.findUnique({ where: { id: bigId } });
  if (existing) {
    return { ok: false, error: existing.role === 'admin' ? 'Этот пользователь — админ' : 'Уже в списке барист' };
  }
  await prisma.barista.create({
    data: { id: bigId, name: String(name || '').trim().slice(0, 120), role: 'barista', createdAt: Date.now() },
  });
  invalidateBaristaCache();
  return { ok: true };
}

export async function removeBarista(idInput: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = Number(typeof idInput === 'string' ? idInput.trim() : idInput);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Некорректный Telegram ID' };
  }
  const bigId = BigInt(id);
  const existing = await prisma.barista.findUnique({ where: { id: bigId } });
  if (!existing) {
    return { ok: false, error: 'Нет в списке барист' };
  }
  if (existing.role === 'admin') {
    return { ok: false, error: 'Администратора удалить нельзя' };
  }
  await prisma.barista.delete({ where: { id: bigId } });
  invalidateBaristaCache();
  return { ok: true };
}
