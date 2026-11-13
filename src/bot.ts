import { Bot } from 'grammy';
import { loadEnv } from './config.js';

const config = loadEnv();

export const bot = new Bot(config.BOT_TOKEN);

bot.catch((err) => {
  console.error('❌ Bot error:', err);
});
