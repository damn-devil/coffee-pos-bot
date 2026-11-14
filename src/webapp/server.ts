import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { bot } from '../bot.js';
import { getMenu } from '../services/menu.js';
import { listActiveOrders, markOrderReady, getLatestActiveOrderByClient, createOrder } from '../db/orders.js';
import { notifyClientOrderReady, notifyBaristasOrderReady, notifyBaristasNewOrder } from '../services/notifications.js';
import { z } from 'zod';
import { getBaristaChatIds } from '../lib/chatIds.js';
import { verifyTelegramRequest } from '../lib/telegramInitData.js';
import { loadEnv } from '../config.js';

const env = loadEnv();

function requireBarista(req: Request, res: Response): { ok: true } | { ok: false } {
  const verified = verifyTelegramRequest(req);
  if (!verified) {
    res.status(401).json({ error: 'Unauthorized: telegram initData required' });
    return { ok: false };
  }
  if (!getBaristaChatIds().includes(verified.user.id)) {
    res.status(403).json({ error: 'Forbidden: barista only' });
    return { ok: false };
  }
  return { ok: true };
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

  app.get('/orders', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), 'public/orders.html'));
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
    const auth = requireBarista(req, res);
    if (!auth.ok) return;
    const orders = await listActiveOrders();
    res.json(orders);
  });

  app.post('/api/orders/:id/ready', async (req: Request, res: Response) => {
    const auth = requireBarista(req, res);
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
