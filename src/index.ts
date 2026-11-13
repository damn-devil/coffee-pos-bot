import { loadEnv } from './config.js';
import { bot } from './bot.js';
import { registerStartHandlers } from './handlers/start.js';
import { registerOrderHandlers } from './handlers/order.js';
import { registerBaristaOrdersHandlers } from './handlers/orders.js';
import { createApp } from './webapp/server.js';

async function main() {
  const env = loadEnv();
  registerStartHandlers();
  registerOrderHandlers();
  registerBaristaOrdersHandlers();

  const app = createApp();

  if (env.WEBHOOK_URL) {
    const url = new URL(env.WEBHOOK_URL);
    await bot.init();
    await bot.api.setWebhook(env.WEBHOOK_URL, { secret_token: env.WEBHOOK_SECRET });
    app.listen(env.PORT, () => {
      console.log(`🚀 Coffee POS bot webhook is listening on port ${env.PORT}`);
    });
  } else {
    void bot.start();
    app.listen(env.PORT, () => {
      console.log(`🚀 Coffee POS bot is listening on port ${env.PORT}`);
    });
  }
}

main().catch((err) => {
  console.error('❌ Failed to start bot:', err);
  process.exit(1);
});
