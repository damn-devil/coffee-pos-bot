import { bot } from '../bot.js';
import { createOrder, getLatestOrderByClient } from '../db/orders.js';
import { notifyBaristasNewOrder } from '../services/notifications.js';
import { sendOrderWidget, answerWidgetQuery, editWidgetChatData } from '../services/widget.js';

interface WebAppOrderPayload {
  items?: Array<{ productId: string; qty: number }>;
  payment?: string;
  cash?: number;
  etaMinutes?: number;
}

interface WidgetQuery {
  id: string;
  from?: { id: number; first_name?: string; username?: string; phone_number?: string };
  chat?: { id: number; type?: string };
  message_id?: number;
  data?: string;
  widget_id?: string;
}

interface UpdateWithWidgetQuery {
  web_app_data?: { chat_id?: number; data?: string };
  widget_query?: WidgetQuery;
}

export function registerOrderHandlers(): void {
  bot.use(async (ctx, next) => {
    const update = ctx.update as UpdateWithWidgetQuery;
    const widgetQuery = update.widget_query;

    if (widgetQuery) {
      const data = widgetQuery.data || '';
      const chatId = widgetQuery.chat?.id;

      if (data.startsWith('order:')) {
        const order = chatId ? await getLatestOrderByClient(String(chatId)) : null;
        const chatData = order
          ? { text: `Заказ №${order.number} принят`, orderId: order.number }
          : { text: 'Заказ не найден' };

        await answerWidgetQuery(widgetQuery.id, JSON.stringify({ ok: true, action: data }));
        if (widgetQuery.message_id && chatId) {
          await editWidgetChatData(chatId, widgetQuery.message_id, chatData);
        }
      } else {
        await answerWidgetQuery(widgetQuery.id, JSON.stringify({ ok: true, action: data }));
      }
      return;
    }

    const payload = update.web_app_data?.data;
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

    const chatId = ctx.chat?.id;
    if (chatId) {
      await sendOrderWidget(chatId, { text: `Заказ №${order.number} принят`, orderId: order.number }, `Заказ №${order.number}`);
    }
  });
}
