/*
  Warnings:

  - You are about to alter the column `createdAt` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `readyAt` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `updatedAt` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "number" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "items" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "payment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "etaMinutes" INTEGER NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "readyAt" BIGINT NOT NULL,
    "clientTelegramId" TEXT,
    "clientName" TEXT,
    "clientUsername" TEXT,
    "clientPhone" TEXT
);
INSERT INTO "new_Order" ("clientName", "clientPhone", "clientTelegramId", "clientUsername", "createdAt", "etaMinutes", "items", "number", "payment", "readyAt", "status", "total", "updatedAt") SELECT "clientName", "clientPhone", "clientTelegramId", "clientUsername", "createdAt", "etaMinutes", "items", "number", "payment", "readyAt", "status", "total", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
