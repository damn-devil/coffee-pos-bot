-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "desc" TEXT NOT NULL DEFAULT '',
    "emoji" TEXT NOT NULL DEFAULT '☕',
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "volume" TEXT NOT NULL DEFAULT '',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL
);
INSERT INTO "new_MenuProduct" ("active", "categoryId", "createdAt", "desc", "emoji", "id", "image", "name", "price", "sort", "updatedAt") SELECT "active", "categoryId", "createdAt", "desc", "emoji", "id", "image", "name", "price", "sort", "updatedAt" FROM "MenuProduct";
DROP TABLE "MenuProduct";
ALTER TABLE "new_MenuProduct" RENAME TO "MenuProduct";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
