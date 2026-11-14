import { bot } from '../bot.js';
import { getBaristaChatIds } from '../lib/chatIds.js';
import type { Order } from '../db/orders.js';
import { formatMoney, paymentLabel } from '../lib/format.js';

function clientInfo(order: Order): string {
  const parts: string[] = [];
  if (order.clientName) parts.push(`👤 ${order.clientName}`);
  if (order.clientUsername) parts.push(`@${order.clientUsername}`);
  if (order.clientPhone) parts.push(`📱 ${order.clientPhone}`);
  if (!parts.length) parts.push('👤 Клиент');
  return parts.join(' · ');
}

function buildBaristaMessage(order: Order): string {
  const lines = order.items.map((item) => `• ${item.qty}× ${item.name} — ${formatMoney(item.price * item.qty)}`);
  const body = [
    `🔔 <b>Новый заказ №${order.number}</b>`,
    '',
    lines.length ? lines.join('\n') : '—',
    `💰 Итого: ${formatMoney(order.total)}`,
    `💳 Оплата: ${paymentLabel(order.payment)}`,
    `⏱ Готов к выдаче: ${order.etaMinutes} мин`,
    '',
    clientInfo(order),
  ].join('\n');

  return body;
}

export async function notifyBaristasNewOrder(order: Order): Promise<void> {
  const text = buildBaristaMessage(order);
  const chatIds = getBaristaChatIds();
  for (const chatId of chatIds) {
    try {
      await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error(`Failed to notify barista ${chatId}`, err);
    }
  }
}

export async function notifyClientOrderReady(order: Order): Promise<void> {
  if (!order.clientTelegramId) return;
  try {
    await bot.api.sendMessage(
      order.clientTelegramId,
      `✅ <b>Заказ №${order.number} готов!</b>\nВаш заказ передан баристу. Ждите, он вас заждётся. 🙌`,
      { parse_mode: 'HTML' },
    );
  } catch (err) {
    console.error(`Failed to notify client for order ${order.number}`, err);
  }
}

export async function notifyBaristasOrderCancelled(order: Order): Promise<void> {
  const items = order.items.map((item) => `• ${item.qty}× ${item.name}`).join('\n');
  const text = `❌ <b>Заказ №${order.number} отменён клиентом</b>\n${items || '—'}\nСумма была: ${formatMoney(order.total)}`;
  const chatIds = getBaristaChatIds();
  for (const chatId of chatIds) {
    try {
      await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error(`Failed to notify barista ${chatId} about cancelled order ${order.number}`, err);
    }
  }
}

export async function notifyClientOrderCancelled(order: Order): Promise<void> {
  if (!order.clientTelegramId) return;
  try {
    await bot.api.sendMessage(
      order.clientTelegramId,
      `✅ <b>Заказ №${order.number} отменён.</b>\nОплата не взимается / деньги вернутся на кассе при необходимости.`,
      { parse_mode: 'HTML' },
    );
  } catch (err) {
    console.error(`Failed to confirm cancellation to client for order ${order.number}`, err);
  }
}

export async function notifyBaristasOrderReady(order: Order): Promise<void> {
  const text = `☕ <b>Заказ №${order.number} готов к выдаче</b>\nКлиент: ${clientInfo(order)}\nСумма: ${formatMoney(order.total)}`;
  const chatIds = getBaristaChatIds();
  for (const chatId of chatIds) {
    try {
      await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error(`Failed to notify barista about ready order ${order.number}`, err);
    }
  }
}
