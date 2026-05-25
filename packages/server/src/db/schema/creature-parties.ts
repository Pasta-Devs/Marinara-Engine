// ──────────────────────────────────────────────
// Schema: Creature Battler Parties
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const creatureParties = sqliteTable("creature_parties", {
  id: text("id").primaryKey(),
  characterId: text("character_id").notNull(),
  chatId: text("chat_id").notNull(),
  /** JSON array of CreatureInstance */
  party: text("party").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
