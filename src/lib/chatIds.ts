import { loadEnv } from '../config.js';

const env = loadEnv();

export function getBaristaChatIds(): number[] {
  return env.BARISTA_CHAT_IDS;
}
