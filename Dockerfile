FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate && (pnpm install --frozen-lockfile 2>/dev/null || pnpm install)

COPY public ./public
COPY src ./src
COPY tsconfig.json ./

RUN npx prisma generate && npx tsc -p tsconfig.json

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
