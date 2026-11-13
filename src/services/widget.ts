import { bot } from '../bot.js';

export const ORDER_WIDGET_HTML = [
  '<h3>☕ Coffee POS</h3>',
  '<p id="m">Оформление заказа…</p>',
  '<button id="b">Оформить заказ</button>',
  '<style>',
  'button { display:block;width:100%;padding:12px 14px;border:0;border-radius:12px;',
  'background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color);',
  'font:700 14px/1 system-ui,sans-serif; }',
  '</style>',
  '<script>',
  'var W = TelegramWidget;',
  'var state = null;',
  'try { state = JSON.parse(W.chatData); } catch (e) { state = null; }',
  'function draw() { var s = state || {}; document.getElementById("m").textContent = s.text || "Оформление заказа…"; }',
  'W.onEvent("chatDataChanged", draw);',
  'draw();',
  'document.getElementById("b").addEventListener("click", function () { W.request("order:refresh"); });',
  '</script>',
].join('');

type RawApiWithNewMethods = Record<string, (args: Record<string, unknown>) => Promise<unknown>>;

function rawApi(): RawApiWithNewMethods {
  return (bot.api.raw as unknown) as RawApiWithNewMethods;
}

export async function sendOrderWidget(
  chatId: number,
  chatData: Record<string, unknown>,
  caption: string,
): Promise<void> {
  await rawApi().sendWidget({
    chat_id: chatId,
    html: ORDER_WIDGET_HTML,
    caption,
    allow_queries: true,
    chat_data: JSON.stringify(chatData),
  });
}

export async function answerWidgetQuery(widgetQueryId: string, data: string): Promise<void> {
  await rawApi().answerWidgetQuery({ widget_query_id: widgetQueryId, data });
}

export async function editWidgetChatData(
  chatId: number,
  messageId: number,
  chatData: Record<string, unknown>,
): Promise<void> {
  await rawApi().editMessageWidgetData({
    chat_id: chatId,
    message_id: messageId,
    chat_data: JSON.stringify(chatData),
  });
}
