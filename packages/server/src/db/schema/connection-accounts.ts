// ──────────────────────────────────────────────
// Schema: Connection Accounts (shared credentials for several Models)
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";

export const connectionAccounts = fileTable("connection_accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Credential vendor/service. Immutable after create. */
  provider: text("provider").notNull(),
  baseUrl: text("base_url").notNull().default(""),
  apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
  /** NanoGPT: the usage-only management token. LinkAPI: the dashboard access token for the account balance. */
  managementTokenEncrypted: text("management_token_encrypted").notNull().default(""),
  /** LinkAPI: the dashboard user id sent as `New-Api-User` with that token. Null on older rows. */
  balanceUserId: text("balance_user_id"),
  showUsageWidget: text("show_usage_widget").notNull().default("false"),
  showUsageFiveHour: text("show_usage_five_hour").notNull().default("true"),
  showUsageWeekly: text("show_usage_weekly").notNull().default("true"),
  treatAsLocalEndpoint: text("treat_as_local_endpoint").notNull().default("false"),
  enabled: text("enabled").notNull().default("true"),
  /** Shared cap on outbound requests per minute across linked Models (null = none). */
  maxRequestsPerMinute: integer("max_requests_per_minute"),
  /** Shared cap on parallel jobs across linked Models (null = none). */
  maxParallelJobs: integer("max_parallel_jobs"),
  /** Picture: null = service logo, "brand:<key>", "letters:<XY>"; an upload sets `imagePath` instead. */
  icon: text("icon"),
  imagePath: text("image_path"),
  /**
   * The model lists last fetched for this Connection, one per row provider, as JSON
   * `{ [provider]: { fetchedAt, models } }`. A re-fetchable cache shared by every linked Model of that provider.
   */
  modelCatalogs: text("model_catalogs"),
  /**
   * Usage keys for "via X" upstreams behind this proxy, as JSON `{ [upstream]: { accountId?, tokenEncrypted? } }`:
   * a linked Connection of that upstream, or a usage-only key (encrypted like the API key). Null on older rows.
   */
  usageKeys: text("usage_keys"),
  /** Imported accounts stay unavailable until the user reviews and saves them locally. */
  profileImportReviewRequired: text("profile_import_review_required").notNull().default("false"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
