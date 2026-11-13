-- CreateTable
CREATE TABLE "Order" (
    "number" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "items" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "payment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "etaMinutes" INTEGER NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "updatedAt" INTEGER NOT NULL,
    "readyAt" INTEGER NOT NULL,
    "clientTelegramId" TEXT,
    "clientName" TEXT,
    "clientUsername" TEXT,
    "clientPhone" TEXT
);
