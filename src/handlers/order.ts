import { bot } from '../bot.js';
import { createOrder } from '../db/orders.js';
import { notifyBaristasNewOrder } from '../services/notifications.js';

interface WebAppOrderPayload {
  items?: Array<{ productId: string; qty: number }>;
  payment?: string;
  cash?: number;
  etaMinutes?: number;
}

export function registerOrderHandlers(): void {
  bot.use(async (ctx, next) => {
    const webAppData = (ctx.update as { web_app_data?: { chat_id?: number; data?: string } }).web_app_data;
    const payload = webAppData?.data;
    if (!payload) {
      await next();
      return;
    }

    let parsed: WebAppOrderPayload;
    try {
      parsed = JSON.parse(payload);
    } catch {
      await ctx.reply('❌ Не удалось прочитать заказ. Попробуйте ещё раз.', { parse_mode: 'HTML' });
      return;
    }

    const items = parsed.items ?? [];
    if (items.length === 0) {
      await ctx.reply('❌ Корзина пуста. Добавьте позиции в меню.', { parse_mode: 'HTML' });
      return;
    }

    const from = ctx.from;
    const fromUser = from as { phone_number?: string } | undefined | null;
    const order = await createOrder({
      items,
      payment: parsed.payment === 'cash' ? 'cash' : 'card',
      cash: Number(parsed.cash) || 0,
      etaMinutes: Number(parsed.etaMinutes) || 10,
      clientTelegramId: ctx.chat?.id ? String(ctx.chat.id) : null,
      clientName: from?.first_name ?? null,
      clientUsername: from?.username ?? null,
      clientPhone: fromUser?.phone_number ?? null,
    });

    await notifyBaristasNewOrder(order);

    await ctx.reply(
      [
        `✅ <b>Заказ №${order.number} принят!</b>`,
        `Ориентировочно готов через ${order.etaMinutes} мин.`,
        `Бариста оповещён о вашем заказе. 🙌`,
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });
}
