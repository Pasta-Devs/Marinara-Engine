// ──────────────────────────────────────────────
// Connection Account Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { apiProviderSchema } from "./connection.schema.js";

// One account may hold BOTH chat and image/media Models sharing one key (concept decision 20),
// so `provider` is the credential vendor/service and nothing here assumes a single Model type.
const accountFields = {
  baseUrl: z.string().url().or(z.literal("")).default(""),
  apiKey: z.string().default(""),
  managementToken: z.string().default(""),
  showUsageWidget: z.boolean().default(false),
  showUsageFiveHour: z.boolean().default(true),
  showUsageWeekly: z.boolean().default(true),
  treatAsLocalEndpoint: z.boolean().default(false),
  enabled: z.boolean().default(true),
  maxRequestsPerMinute: z.number().int().min(1).max(600).nullable().default(null),
  maxParallelJobs: z.number().int().min(1).max(16).nullable().default(null),
};

export const createConnectionAccountSchema = z.object({
  name: z.string().min(1).max(200),
  provider: apiProviderSchema,
  ...accountFields,
});

/** `provider` is immutable after create, so it is not part of the update shape. */
export const updateConnectionAccountSchema = z.object({ name: z.string().min(1).max(200), ...accountFields }).partial();

export type CreateConnectionAccountInput = z.infer<typeof createConnectionAccountSchema>;
export type UpdateConnectionAccountInput = z.infer<typeof updateConnectionAccountSchema>;

export type ConnectionAccountState = "ok" | "off" | "needs_key";

/** Account as the list endpoint returns it: secrets masked. */
export interface ConnectionAccountListItem {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyLast4: string;
  hasManagementToken: boolean;
  showUsageWidget: boolean;
  showUsageFiveHour: boolean;
  showUsageWeekly: boolean;
  treatAsLocalEndpoint: boolean;
  enabled: boolean;
  maxRequestsPerMinute: number | null;
  maxParallelJobs: number | null;
  profileImportReviewRequired: boolean;
  modelCount: number;
  state: ConnectionAccountState;
  createdAt: string;
  updatedAt: string;
}
