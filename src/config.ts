import { z } from 'zod';

const chatIdsSchema = z
  .string()
  .default('0')
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number(part))
      .filter((n) => Number.isFinite(n)),
  );

export const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BARISTA_CHAT_IDS: chatIdsSchema,
  BARISTA_ADMIN_IDS: chatIdsSchema.optional().default('1615826277'),
  MINI_APP_MENU_URL: z.string().default('https://coffee-pos-bot.example.com/menu'),
  MINI_APP_ORDERS_URL: z.string().default('https://coffee-pos-bot.example.com/orders'),
  WEBHOOK_URL: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  BARISTA_API_KEY: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  MENU_URL: z
    .string()
    .default('https://raw.githubusercontent.com/damn-devil/coffee-pos/main/menu.json'),
  MENU_SYNC_URL: z
    .string()
    .default('https://ntfy.sh/coffee_pos_menu_9f4c1e7a2b/json?poll=1&since=all'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    console.error('❌ Invalid environment variables:', JSON.stringify(flattened.fieldErrors, null, 2));
    process.exit(1);
  }
  return parsed.data;
}
