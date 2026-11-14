import { prisma } from './prisma.js';
import { getMenu, type Menu, type Product } from '../services/menu.js';

export interface OrderItem {
  productId: string;
  qty: number;
  price: number;
  name: string;
}

export interface Order {
  number: number;
  items: OrderItem[];
  total: number;
  payment: string;
  status: string;
  etaMinutes: number;
  createdAt: number;
  updatedAt: number;
  readyAt: number;
  clientTelegramId: string | null;
  clientName: string | null;
  clientUsername: string | null;
  clientPhone: string | null;
}

interface OrderRow {
  number: number;
  items: string;
  total: number;
  payment: string;
  status: string;
  etaMinutes: number;
  createdAt: bigint | number;
  updatedAt: bigint | number;
  readyAt: bigint | number;
  clientTelegramId: string | null;
  clientName: string | null;
  clientUsername: string | null;
  clientPhone: string | null;
}

function parseItems(raw: string): OrderItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (i): i is OrderItem =>
          !!i && typeof i === 'object' && typeof i.productId === 'string' && typeof i.qty === 'number',
      );
    }
  } catch {
    // ignore malformed json
  }
  return [];
}

function toOrder(row: OrderRow): Order {
  return {
    ...row,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    readyAt: Number(row.readyAt),
    items: parseItems(row.items),
  };
}

export interface CreateOrderData {
  items: Array<{ productId: string; qty: number }>;
  payment: string;
  cash: number;
  etaMinutes: number;
  clientTelegramId: string | null;
  clientName: string | null;
  clientUsername: string | null;
  clientPhone: string | null;
}

export async function createOrder(data: CreateOrderData): Promise<Order> {
  const menu: Menu = await getMenu();
  const items: OrderItem[] = [];
  let total = 0;

  for (const rawItem of data.items) {
    const product: Product | undefined = menu.products.find((p) => p.id === rawItem.productId);
    const qty = Math.max(1, Math.floor(Number(rawItem.qty) || 1));
    if (!product) continue;
    items.push({ productId: product.id, qty, price: product.price, name: product.name });
    total += product.price * qty;
  }

  const etaMinutes = Math.max(1, Math.floor(Number(data.etaMinutes) || 10));
  const now = Date.now();

  const order = await prisma.order.create({
    data: {
      items: JSON.stringify(items),
      total,
      payment: data.payment,
      status: 'new',
      etaMinutes,
      createdAt: now,
      updatedAt: now,
      readyAt: now + etaMinutes * 60_000,
      clientTelegramId: data.clientTelegramId,
      clientName: data.clientName,
      clientUsername: data.clientUsername,
      clientPhone: data.clientPhone,
    },
  });

  const row: OrderRow = {
    number: order.number,
    items: order.items,
    total: order.total,
    payment: order.payment,
    status: order.status,
    etaMinutes: order.etaMinutes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    readyAt: order.readyAt,
    clientTelegramId: order.clientTelegramId,
    clientName: order.clientName,
    clientUsername: order.clientUsername,
    clientPhone: order.clientPhone,
  };

  return toOrder(row);
}

export async function listActiveOrders(): Promise<Order[]> {
  const rows = await prisma.order.findMany({
    where: { status: { in: ['new', 'preparing'] } },
    orderBy: { readyAt: 'asc' },
  });
  return rows.map(toOrder);
}

export async function getLatestOrderByClient(clientTelegramId: string): Promise<Order | null> {
  const order = await prisma.order.findFirst({
    where: { clientTelegramId },
    orderBy: { number: 'desc' },
  });
  if (!order) return null;
  const row: OrderRow = {
    number: order.number,
    items: order.items,
    total: order.total,
    payment: order.payment,
    status: order.status,
    etaMinutes: order.etaMinutes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    readyAt: order.readyAt,
    clientTelegramId: order.clientTelegramId,
    clientName: order.clientName,
    clientUsername: order.clientUsername,
    clientPhone: order.clientPhone,
  };
  return toOrder(row);
}

export async function getLatestActiveOrderByClient(clientTelegramId: string, windowMs = 3 * 60 * 60_000): Promise<Order | null> {
  const cutoff = Date.now() - windowMs;
  const order = await prisma.order.findFirst({
    where: { clientTelegramId, createdAt: { gte: BigInt(cutoff) } },
    orderBy: { number: 'desc' },
  });
  if (!order) return null;
  const row: OrderRow = {
    number: order.number,
    items: order.items,
    total: order.total,
    payment: order.payment,
    status: order.status,
    etaMinutes: order.etaMinutes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    readyAt: order.readyAt,
    clientTelegramId: order.clientTelegramId,
    clientName: order.clientName,
    clientUsername: order.clientUsername,
    clientPhone: order.clientPhone,
  };
  return toOrder(row);
}

export async function markOrderReady(id: number): Promise<Order | null> {
  const order = await prisma.order.findUnique({ where: { number: id } });
  if (!order) return null;
  if (order.status === 'ready') return toOrder(order);

  const updated = await prisma.order.update({
    where: { number: id },
    data: { status: 'ready', updatedAt: Date.now() },
  });
  const row: OrderRow = {
    number: updated.number,
    items: updated.items,
    total: updated.total,
    payment: updated.payment,
    status: updated.status,
    etaMinutes: updated.etaMinutes,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    readyAt: updated.readyAt,
    clientTelegramId: updated.clientTelegramId,
    clientName: updated.clientName,
    clientUsername: updated.clientUsername,
    clientPhone: updated.clientPhone,
  };
  return toOrder(row);
}
