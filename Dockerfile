FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY prisma ./prisma
RUN DATABASE_URL="file:./dev.db" npx prisma generate

COPY public ./public
COPY src ./src
COPY tsconfig.json ./

RUN npx tsc -p tsconfig.json

EXPOSE 3000

CMD ["node", "dist/index.js"]
