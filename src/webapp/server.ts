import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { bot } from '../bot.js';
import { getMenu, invalidateMenuCache } from '../services/menu.js';
import { prisma } from '../db/prisma.js';
import { listActiveOrders, markOrderReady, getLatestActiveOrderByClient, createOrder, listClientOrders, cancelOrder } from '../db/orders.js';
import { notifyClientOrderReady, notifyBaristasOrderReady, notifyBaristasNewOrder, notifyBaristasOrderCancelled, notifyClientOrderCancelled } from '../services/notifications.js';
import { z } from 'zod';
import { isBarista, isAdmin, listBaristas, addBarista, removeBarista } from '../lib/baristas.js';
import { verifyTelegramRequest } from '../lib/telegramInitData.js';
import { loadEnv } from '../config.js';

const env = loadEnv();

async function requireBarista(req: Request, res: Response): Promise<{ ok: true } | { ok: false }> {
  const verified = verifyTelegramRequest(req);
  if (!verified) {
    res.status(401).json({ error: 'Unauthorized: telegram initData required' });
    return { ok: false };
  }
  if (!(await isBarista(verified.user.id))) {
    res.status(403).json({ error: 'Forbidden: barista only' });
    return { ok: false };
  }
  return { ok: true };
}

async function requireAdmin(req: Request, res: Response): Promise<{ ok: true } | { ok: false }> {
  const verified = verifyTelegramRequest(req);
  if (!verified) {
    res.status(401).json({ error: 'Unauthorized: telegram initData required' });
    return { ok: false };
  }
  if (!(await isAdmin(verified.user.id))) {
    res.status(403).json({ error: 'Forbidden: admin only' });
    return { ok: false };
  }
  return { ok: true };
}

function jsonSafe(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data, (_key, value) => (typeof value === 'bigint' ? Number(value) : value)));
}

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.post('/webhook', async (req: Request, res: Response) => {
    try {
      if (env.WEBHOOK_SECRET) {
        const token = req.headers['x-telegram-bot-api-secret-token'];
        if (token !== env.WEBHOOK_SECRET) {
          res.sendStatus(401);
          return;
        }
      }
      const update = req.body as Parameters<typeof bot.handleUpdate>[0];
      await bot.handleUpdate(update);
      res.sendStatus(200);
    } catch (err) {
      console.error('❌ Webhook handling error:', err);
      res.sendStatus(500);
    }
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'coffee-pos-bot', time: Date.now() });
  });

  app.get('/api/menu', async (_req: Request, res: Response) => {
    const menu = await getMenu();
    res.json(menu);
  });

  app.get('/menu', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), 'public/menu.html'));
  });

  app.get('/menu-editor', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), 'public/menu-editor.html'));
  });

  // ===== Barista menu editor API (barista only) =====
  const productSchema = z.object({
    name: z.string().min(1).max(80),
    price: z.number().min(0).max(100_000),
    desc: z.string().max(300).optional().default(''),
    emoji: z.string().max(8).optional().default('☕'),
    image: z.string().max(2_000_000).nullable().optional(),
    categoryId: z.string().min(1).max(64),
    volume: z.string().max(40).optional().default(''),
    active: z.boolean().optional(),
  });
  const productPatchSchema = productSchema.partial();
  const categorySchema = z.object({
    name: z.string().min(1).max(60),
    emoji: z.string().max(8).optional().default('📦'),
  });

  app.get('/api/barista/menu', async (req: Request, res: Response) => {
    const auth = await requireBarista(req, res);
    if (!auth.ok) return;
    const categories = await prisma.menuCategory.findMany({ orderBy: { sort: 'asc' } });
    const products = await prisma.menuProduct.findMany({ orderBy: { sort: 'asc' } });
    res.json(jsonSafe({
      categories,
      products: products.map((p) => ({ ...p, image: p.image ?? undefined })),
    }));
  });

  app.post('/api/barista/menu/products', async (req: Request, res: Response) => {
    const auth = await requireBarista(req, res);
    if (!auth.ok) return;
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid product' });
      return;
    }
    const data = parsed.data;
    const category = await prisma.menuCategory.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      res.status(400).json({ error: 'Category not found' });
      return;
    }
    const count = await prisma.menuProduct.count();
    const now = Date.now();
    const product = await prisma.menuProduct.create({
      data: {
        id: `p${now.toString(36)}${Math.floor(Math.random() * 1e4)}`,
        categoryId: data.categoryId,
        name: data.name,
        price: data.price,
        desc: data.desc ?? '',
        emoji: data.emoji ?? '☕',
        image: data.image ?? null,
        volume: data.volume ?? '',
        active: data.active ?? true,
        sort: count,
        createdAt: now,
        updatedAt: now,
      },
    });
    invalidateMenuCache();
    res.json(jsonSafe(product));
  });

  app.put('/api/barista/menu/products/:id', async (req: Request, res: Response) => {
    const auth = await requireBarista(req, res);
    if (!auth.ok) return;
    const parsed = productPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid product payload' });
      return;
    }
    const data = parsed.data;
    if (data.categoryId) {
      const category = await prisma.menuCategory.findUnique({ where: { id: data.categoryId } });
      if (!category) {
        res.status(400).json({ error: 'Category not found' });
        return;
      }
    }
    const existing = await prisma.menuProduct.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const updated = await prisma.menuProduct.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.desc !== undefined ? { desc: data.desc } : {}),
        ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
        ...(data.image !== undefined ? { image: data.image } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.volume !== undefined ? { volume: data.volume } : {}),
        updatedAt: Date.now(),
      },
    });
    invalidateMenuCache();
    res.json(jsonSafe(updated));
  });

  app.delete('/api/barista/menu/products/:id', async (req: Request, res: Response) => {
    const auth = await requireBarista(req, res);
    if (!auth.ok) return;
    const existing = await prisma.menuProduct.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    await prisma.menuProduct.delete({ where: { id: req.params.id } });
    invalidateMenuCache();
    res.json({ ok: true });
  });

  app.post('/api/barista/menu/categories', async (req: Request, res: Response) => {
    const auth = await requireBarista(req, res);
    if (!auth.ok) return;
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }
    const count = await prisma.menuCategory.count();
    const now = Date.now();
    const category = await prisma.menuCategory.create({
      data: { id: `c${now.toString(36)}${Math.floor(Math.random() * 1e4)}`, name: parsed.data.name, emoji: parsed.data.emoji ?? '📦', sort: count, createdAt: now, updatedAt: now },
    });
    invalidateMenuCache();
    res.json(jsonSafe(category));
  });

  app.put('/api/barista/menu/categories/:id', async (req: Request, res: Response) => {
    const auth = await requireBarista(req, res);
    if (!auth.ok) return;
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }
    const existing = await prisma.menuCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const updated = await prisma.menuCategory.update({
      where: { id: req.params.id },
      data: { name: parsed.data.name, emoji: parsed.data.emoji ?? existing.emoji, updatedAt: Date.now() },
    });
    invalidateMenuCache();
    res.json(jsonSafe(updated));
  });

  app.delete('/api/barista/menu/categories/:id', async (req: Request, res: Response) => {
    const auth = await requireBarista(req, res);
    if (!auth.ok) return;
    const productsInCategory = await prisma.menuProduct.count({ where: { categoryId: req.params.id } });
    if (productsInCategory > 0) {
      res.status(409).json({ error: `В категории ${productsInCategory} товар(а) — сначала переместите или удалите их` });
      return;
    }
    const existing = await prisma.menuCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    await prisma.menuCategory.delete({ where: { id: req.params.id } });
    invalidateMenuCache();
    res.json({ ok: true });
  });

  app.get('/orders', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), 'public/orders.html'));
  });

  // ===== Admin: barista management (admin only) =====
  app.get('/api/admin/baristas', async (req: Request, res: Response) => {
    const auth = await requireAdmin(req, res);
    if (!auth.ok) return;
    res.json(jsonSafe(await listBaristas()));
  });

  const addBaristaSchema = z.object({
    id: z.union([z.number().int().positive(), z.string().regex(/^\d{1,20}$/)]).transform((v) => Number(v)),
    name: z.string().max(120).optional().default(''),
  });

  app.post('/api/admin/baristas', async (req: Request, res: Response) => {
    const auth = await requireAdmin(req, res);
    if (!auth.ok) return;
    const parsed = addBaristaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Некорректный Telegram ID' });
      return;
    }
    const result = await addBarista(parsed.data.id, parsed.data.name);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.delete('/api/admin/baristas/:id', async (req: Request, res: Response) => {
    const auth = await requireAdmin(req, res);
    if (!auth.ok) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Некорректный id' });
      return;
    }
    const result = await removeBarista(id);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  const clientOrderSchema = z.object({
    items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(50) })).min(1).max(30),
    payment: z.enum(['card', 'cash']).default('card'),
    cash: z.number().min(0).max(1_000_000).default(0),
    etaMinutes: z.number().int().min(1).max(60).default(10),
  });

  app.post('/api/client/orders', async (req: Request, res: Response) => {
    const verified = verifyTelegramRequest(req);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized: telegram initData required' });
      return;
    }
    const parsed = clientOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid order payload' });
      return;
    }
    const data = parsed.data;
    const user = verified.user as { id: number; first_name?: string; username?: string };
    const order = await createOrder({
      items: data.items,
      payment: data.payment,
      cash: data.cash,
      etaMinutes: data.etaMinutes,
      clientTelegramId: String(user.id),
      clientName: user.first_name ?? null,
      clientUsername: user.username ?? null,
      clientPhone: null,
    }).catch((err: Error) => {
      console.error('createOrder failed:', err.message);
      return null;
    });
    if (!order) {
      res.status(400).json({ error: 'No valid items in order' });
      return;
    }

    try {
      await notifyBaristasNewOrder(order);
    } catch (err) {
      console.error('Failed to notify baristas:', err instanceof Error ? err.message : err);
    }

    try {
      await bot.api.sendMessage(
        user.id,
        [
          `✅ <b>Заказ №${order.number} принят!</b>`,
          `Ориентировочно готов через ${order.etaMinutes} мин.`,
        ].join('\n'),
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      console.error('Failed to confirm order to client:', err instanceof Error ? err.message : err);
    }

    res.json({
      number: order.number,
      items: order.items.map((item) => ({ name: item.name, qty: item.qty, price: item.price })),
      total: order.total,
      payment: order.payment,
      status: order.status,
      etaMinutes: order.etaMinutes,
      readyAt: order.readyAt,
      createdAt: order.createdAt,
    });
  });

  app.get('/api/client/orders', async (req: Request, res: Response) => {
    const verified = verifyTelegramRequest(req);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized: telegram initData required' });
      return;
    }
    const orders = await listClientOrders(String(verified.user.id), 30);
    res.json(orders.map((order) => ({
      number: order.number,
      items: order.items.map((item) => ({ name: item.name, qty: item.qty, price: item.price })),
      total: order.total,
      payment: order.payment,
      status: order.status,
      etaMinutes: order.etaMinutes,
      readyAt: order.readyAt,
      createdAt: order.createdAt,
    })));
  });

  app.post('/api/client/orders/:number/cancel', async (req: Request, res: Response) => {
    const verified = verifyTelegramRequest(req);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized: telegram initData required' });
      return;
    }
    const number = Number(req.params.number);
    if (!Number.isInteger(number) || number <= 0) {
      res.status(400).json({ error: 'Invalid order number' });
      return;
    }
    const { result, order } = await cancelOrder(number, String(verified.user.id));
    if (result === 'cancelled' && order) {
      try {
        await notifyBaristasOrderCancelled(order);
      } catch (err) {
        console.error('Failed to notify baristas about cancelled order:', err instanceof Error ? err.message : err);
      }
      try {
        await notifyClientOrderCancelled(order);
      } catch (err) {
        console.error('Failed to confirm cancellation to client:', err instanceof Error ? err.message : err);
      }
      res.json({ ok: true, number: order.number, status: order.status });
      return;
    }
    if (result === 'too_late') {
      res.status(409).json({ error: 'Слишком поздно отменять — до готовности меньше 5 минут' });
      return;
    }
    if (result === 'already_ready') {
      res.status(409).json({ error: 'Заказ уже готов или отменён — отменить нельзя' });
      return;
    }
    res.status(404).json({ error: 'Заказ не найден' });
  });

  app.get('/api/client/current-order', async (req: Request, res: Response) => {
    const verified = verifyTelegramRequest(req);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized: telegram initData required' });
      return;
    }
    const order = await getLatestActiveOrderByClient(String(verified.user.id));
    if (!order) {
      res.status(404).json({ error: 'No active order' });
      return;
    }
    res.json({
      number: order.number,
      items: order.items.map((item) => ({ name: item.name, qty: item.qty, price: item.price })),
      total: order.total,
      payment: order.payment,
      status: order.status,
      etaMinutes: order.etaMinutes,
      readyAt: order.readyAt,
      createdAt: order.createdAt,
    });
  });

  app.get('/api/orders', async (req: Request, res: Response) => {
    const auth = await requireBarista(req, res);
    if (!auth.ok) return;
    const orders = await listActiveOrders();
    res.json(orders);
  });

  app.post('/api/orders/:id/ready', async (req: Request, res: Response) => {
    const auth = await requireBarista(req, res);
    if (!auth.ok) return;
    const id = Number(req.params.id);
    const order = await markOrderReady(id);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    await notifyClientOrderReady(order);
    await notifyBaristasOrderReady(order);
    res.json(order);
  });

  app.use(express.static(path.resolve(process.cwd(), 'public')));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('❌ HTTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
