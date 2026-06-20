// ──────────────────────────────────────────────
// Schema: Custom Function Tools
// ──────────────────────────────────────────────
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const customTools = sqliteTable("custom_tools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** JSON Schema defining the tool parameters (ToolParameterSchema) */
  parametersSchema: text("parameters_schema").notNull().default("{}"),
  /** How the tool result is produced: "webhook" | "static" | "script" */
  executionType: text("execution_type").notNull().default("static"),
  /** Webhook URL for execution_type=webhook */
  webhookUrl: text("webhook_url"),
  /** Static result string for execution_type=static (returned as-is) */
  staticResult: text("static_result"),
  /** JS expression for execution_type=script — evaluated server-side in a sandbox */
  scriptBody: text("script_body"),
  /** Whether webhook/script execution receives hidden Marinara runtime context */
  includeHiddenContext: text("include_hidden_context").notNull().default("false"),
  enabled: text("enabled").notNull().default("true"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
