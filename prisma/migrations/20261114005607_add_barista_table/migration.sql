-- CreateTable
CREATE TABLE "Barista" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'barista',
    "createdAt" BIGINT NOT NULL
);
