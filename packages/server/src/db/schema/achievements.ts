import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const achievementUnlocks = sqliteTable("achievement_unlocks", {
  id: text("id").primaryKey(),
  unlockedAt: text("unlocked_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
