import { bot } from '../bot.js';
import { loadEnv } from '../config.js';
import { getBaristaChatIds } from '../lib/chatIds.js';

const env = loadEnv();

export function registerStartHandlers(): void {
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat?.id;
    const isBarista = chatId !== undefined && getBaristaChatIds().includes(chatId);

    if (isBarista) {
      await ctx.reply(
        '📋 Панель бариста.\n\nНажмите кнопку ниже, чтобы открыть список активных заказов с таймерами.',
        {
          reply_markup: {
            inline_keyboard: [[{ text: '📦 Мои заказы', web_app: { url: env.MINI_APP_ORDERS_URL } }]],
          },
        },
      );
      return;
    }

    const text = [
      '☕ <b>Coffee POS — касса</b>',
      '',
      'Нажмите кнопку ниже, чтобы открыть меню и сделать заказ.',
      'После оформления бариста получит уведомление с готовностью заказа.',
    ].join('\n');

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🍽️ Открыть меню', web_app: { url: env.MINI_APP_MENU_URL } }]],
      },
    });
  });
}
