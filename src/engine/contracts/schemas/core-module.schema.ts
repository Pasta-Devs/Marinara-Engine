import { z } from "zod";

const coreModuleIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9.-]*$/);

export const coreModuleSettingsSchema = z
  .object({
    enabled: z.record(coreModuleIdSchema, z.boolean()).default({}),
  })
  .default({ enabled: {} });
