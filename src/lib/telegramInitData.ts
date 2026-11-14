import crypto from 'node:crypto';
import { loadEnv } from '../config.js';
import type { Request } from 'express';

const env = loadEnv();

export interface TelegramInitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface VerifiedTelegramInitData {
  user: TelegramInitDataUser;
  authDate: number;
}

function getInitDataFromRequest(req: Request): string | undefined {
  const header = req.headers['x-telegram-init-data'];
  if (typeof header === 'string' && header.length > 0) return header;
  const q = req.query.initData;
  if (typeof q === 'string' && q.length > 0) return q;
  return undefined;
}

export function verifyTelegramInitData(initData: string | undefined): VerifiedTelegramInitData | null {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  const entries = [...params.entries()].filter(([key]) => key !== 'hash');
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(computedHash, 'utf8');
  const b = Buffer.from(hash, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  const userJson = params.get('user');
  if (!userJson) return null;
  try {
    const user = JSON.parse(userJson) as TelegramInitDataUser & { id?: unknown };
    if (!user || typeof user.id !== 'number' || !Number.isFinite(user.id)) return null;
    const authDate = Number(params.get('auth_date')) || 0;
    return {
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, username: user.username },
      authDate,
    };
  } catch {
    return null;
  }
}

export function verifyTelegramRequest(req: Request): VerifiedTelegramInitData | null {
  return verifyTelegramInitData(getInitDataFromRequest(req));
}
