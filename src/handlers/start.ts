import { bot } from '../bot.js';
import { loadEnv } from '../config.js';
import { getBaristaChatIds } from '../lib/chatIds.js';
import { sendOrderWidget } from '../services/widget.js';

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

  bot.command('widget', async (ctx) => {
    const chatId = ctx.chat?.id;
    const chatType = ctx.chat?.type;
    console.error(`/widget called: chat_id=${chatId} type=${chatType} from_id=${ctx.from?.id}`);
    if (!chatId) return;
    try {
      await sendOrderWidget(
        chatId,
        { text: '🧪 Тестовый виджет Coffee POS. Нажмите кнопку — бот ответит обновлением состояния.', orderId: null },
        'Coffee POS — тест виджета',
      );
      console.error('/widget: sendWidget OK');
    } catch (err) {
      const anyErr = err as { description?: string; payload?: unknown; method?: string } | null;
      console.error('/widget error message:', err instanceof Error ? err.message : String(err));
      console.error('/widget error description:', anyErr?.description);
      console.error('/widget error payload:', JSON.stringify(anyErr?.payload));
      await ctx.reply(`❌ Не удалось отправить виджет: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}
