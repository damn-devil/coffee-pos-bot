import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { bot } from '../bot.js';
import { getMenu } from '../services/menu.js';
import { listActiveOrders, markOrderReady } from '../db/orders.js';
import { notifyClientOrderReady, notifyBaristasOrderReady } from '../services/notifications.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.post('/webhook', async (req: Request, res: Response) => {
    try {
      const update = req.body as Parameters<typeof bot.handleUpdate>[0];
      await bot.handleUpdate(update);
      res.sendStatus(200);
    } catch (err) {
      console.error('❌ Webhook handling error:', err);
      res.sendStatus(500);
    }
  });

  app.get('/api/menu', async (_req: Request, res: Response) => {
    const menu = await getMenu();
    res.json(menu);
  });

  app.get('/api/orders', async (req: Request, res: Response) => {
    const orders = await listActiveOrders();
    res.json(orders);
  });

  app.post('/api/orders/:id/ready', async (req: Request, res: Response) => {
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
