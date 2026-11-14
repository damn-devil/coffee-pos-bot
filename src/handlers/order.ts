import { bot } from '../bot.js';
import { getLatestOrderByClient } from '../db/orders.js';
import { answerWidgetQuery, editWidgetChatData } from '../services/widget.js';

interface WidgetQuery {
  id: string;
  from?: { id: number; first_name?: string; username?: string; phone_number?: string };
  chat?: { id: number; type?: string };
  message_id?: number;
  data?: string;
  widget_id?: string;
}

interface UpdateWithWidgetQuery {
  widget_query?: WidgetQuery;
}

export function registerOrderHandlers(): void {
  bot.use(async (ctx, next) => {
    const update = ctx.update as UpdateWithWidgetQuery;
    const widgetQuery = update.widget_query;

    if (!widgetQuery) {
      await next();
      return;
    }

    const data = widgetQuery.data || '';
    const chatId = widgetQuery.chat?.id;

    if (data.startsWith('order:')) {
      const order = chatId ? await getLatestOrderByClient(String(chatId)) : null;
      const chatData = order
        ? { text: `Заказ №${order.number} принят`, orderId: order.number }
        : { text: 'Заказ не найден' };

      try {
        await answerWidgetQuery(widgetQuery.id, JSON.stringify({ ok: true, action: data }));
      } catch (err) {
        console.error('answerWidgetQuery failed:', err instanceof Error ? err.message : err);
      }
      if (widgetQuery.message_id && chatId) {
        try {
          await editWidgetChatData(chatId, widgetQuery.message_id, chatData);
        } catch (err) {
          console.error('editMessageWidgetData failed:', err instanceof Error ? err.message : err);
        }
      }
    } else {
      try {
        await answerWidgetQuery(widgetQuery.id, JSON.stringify({ ok: true, action: data }));
      } catch (err) {
        console.error('answerWidgetQuery failed:', err instanceof Error ? err.message : err);
      }
    }
  });
}
