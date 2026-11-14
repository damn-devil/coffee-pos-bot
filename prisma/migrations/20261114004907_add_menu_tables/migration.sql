-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📦',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "MenuProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "desc" TEXT NOT NULL DEFAULT '',
    "emoji" TEXT NOT NULL DEFAULT '☕',
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL
);
