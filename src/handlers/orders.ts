import { bot } from '../bot.js';
import { listActiveOrders } from '../db/orders.js';
import { getBaristaChatIds } from '../lib/chatIds.js';
import { formatMoney, paymentLabel } from '../lib/format.js';

export function registerBaristaOrdersHandlers(): void {
  bot.command('orders', async (ctx) => {
    const chatId = ctx.chat?.id;
    const isBarista = chatId !== undefined && getBaristaChatIds().includes(chatId);
    if (!isBarista) {
      await ctx.reply('❌ Команда доступна только баристам.', { parse_mode: 'HTML' });
      return;
    }

    const orders = await listActiveOrders();

    if (orders.length === 0) {
      await ctx.reply('📦 Активных заказов нет.', { parse_mode: 'HTML' });
      return;
    }

    const lines = orders.map((order) => {
      const items = order.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
      const readyIn = order.status === 'ready' ? 'готов' : `${Math.max(0, Math.ceil((order.readyAt - Date.now()) / 60_000))} мин`;
      return `• №${order.number} — ${items}\n  Итого: ${formatMoney(order.total)} · ${paymentLabel(order.payment)} · готов через ${readyIn} мин`;
    });

    await ctx.reply(['📦 <b>Активные заказы:</b>', ...lines].join('\n'), { parse_mode: 'HTML' });
  });
}
