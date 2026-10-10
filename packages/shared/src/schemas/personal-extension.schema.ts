// ──────────────────────────────────────────────
// Personal Extension Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { PERSONAL_EXTENSION_CAPABILITIES, PERSONAL_EXTENSION_UI_LIMITS } from "../types/personal-extension.js";
import { cssByteLimit, cssByteMessage } from "./css-size.js";

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code < 0xdc00) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

const extensionRuntimeSchema = z.enum(["client", "server"]);
const extensionCapabilitySchema = z.enum(PERSONAL_EXTENSION_CAPABILITIES);
const extensionVersionSchema = z
  .union([z.string().trim().min(1).max(64), z.number().finite().nonnegative().transform(String)])
  .nullable();

const personalExtensionContributionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(PERSONAL_EXTENSION_UI_LIMITS.idLength)
  .regex(/^[A-Za-z0-9._-]+$/);

export const personalExtensionCommandContributionSchema = z
  .object({
    id: personalExtensionContributionIdSchema,
    kind: z.literal("command"),
    label: z.string().trim().min(1).max(PERSONAL_EXTENSION_UI_LIMITS.labelLength),
    description: z.string().trim().max(PERSONAL_EXTENSION_UI_LIMITS.descriptionLength).optional(),
    icon: z
      .string()
      .max(PERSONAL_EXTENSION_UI_LIMITS.iconLength)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    targetContributionId: personalExtensionContributionIdSchema,
  })
  .strict()
  .refine((value) => value.targetContributionId !== value.id, {
    path: ["targetContributionId"],
    message: "Command contribution cannot target itself",
  });

export type PersonalExtensionCommandContribution = z.infer<typeof personalExtensionCommandContributionSchema>;

const personalExtensionPayloadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  version: extensionVersionSchema.optional(),
  description: z.string().max(2000).default(""),
  runtime: extensionRuntimeSchema.optional().default("client"),
  capabilities: z.array(extensionCapabilitySchema).max(PERSONAL_EXTENSION_CAPABILITIES.length).default([]),
  css: z.string().nullable().optional().refine(cssByteLimit, { message: cssByteMessage }),
  js: z.string().nullable().optional(),
  serverJs: z.string().nullable().optional(),
});

function validateRuntimePayload(
  value: {
    runtime?: "client" | "server";
    capabilities?: readonly (typeof PERSONAL_EXTENSION_CAPABILITIES)[number][];
    css?: string | null;
    js?: string | null;
    serverJs?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (value.runtime === "server" && !value.serverJs?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["serverJs"],
      message: "Server personal extensions require server JavaScript",
    });
  }
  if (value.runtime === "server" && value.capabilities?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capabilities"],
      message: "Server personal extensions cannot request browser context capabilities",
    });
  }
  if (value.runtime === "client" && !value.css?.trim() && !value.js?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["js"],
      message: "Browser personal extensions require CSS or JavaScript",
    });
  }
}

export const createPersonalExtensionSchema = personalExtensionPayloadSchema.superRefine(validateRuntimePayload);

export const updatePersonalExtensionSchema = personalExtensionPayloadSchema
  .partial()
  .extend({
    enabled: z.literal(false).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Must update at least one field",
  })
  .superRefine((value, ctx) => {
    if (value.runtime !== undefined) validateRuntimePayload(value, ctx);
  });

export const approvePersonalExtensionSchema = z.object({
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  acknowledgeSandboxedCode: z.literal(true),
  acknowledgeFullPageAccess: z.literal(true).optional(),
});

export const externalExtensionsPolicyUpdateSchema = z.object({
  enabled: z.boolean(),
});

export const rollbackPersonalExtensionSchema = z.object({
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

const MAX_EXTENSION_STORAGE_BYTES = 1_000_000;
export const personalExtensionStoragePatchSchema = z.record(z.string(), z.unknown()).refine(
  (value) => {
    try {
      return utf8ByteLength(JSON.stringify(value)) <= MAX_EXTENSION_STORAGE_BYTES;
    } catch {
      return false;
    }
  },
  { message: `Extension storage must be at most ${MAX_EXTENSION_STORAGE_BYTES} bytes` },
);

export type CreatePersonalExtensionInput = z.input<typeof createPersonalExtensionSchema>;
export type UpdatePersonalExtensionInput = z.infer<typeof updatePersonalExtensionSchema>;
export type PersonalExtensionStoragePatchInput = z.infer<typeof personalExtensionStoragePatchSchema>;
