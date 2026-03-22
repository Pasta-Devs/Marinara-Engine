// ──────────────────────────────────────────────
// Schema: API Connections
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const apiConnections = sqliteTable("api_connections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider", {
    enum: ["openai", "anthropic", "google", "mistral", "cohere", "openrouter", "custom", "image_generation"],
  }).notNull(),
  baseUrl: text("base_url").notNull().default(""),
  /** Encrypted API key */
  apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
  model: text("model").notNull().default(""),
  maxContext: integer("max_context").notNull().default(128000),
  isDefault: text("is_default").notNull().default("false"),
  /** Whether this connection is part of the random-selection pool */
  useForRandom: text("use_for_random").notNull().default("false"),
  /** Whether to enable Anthropic prompt caching */
  enableCaching: text("enable_caching").notNull().default("false"),
  /** Model to use for embedding generation (e.g. text-embedding-3-small) */
  embeddingModel: text("embedding_model"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
