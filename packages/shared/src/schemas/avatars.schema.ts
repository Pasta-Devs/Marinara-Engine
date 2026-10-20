// ──────────────────────────────────────────────
// Avatar agents: Zod schemas for avatar.json and the API bodies
// ──────────────────────────────────────────────
// `avatar.json` is read back from disk and arrives in PUT bodies, so both go through these strict
// schemas. File paths are checked with isAvatarFilePath here, which keeps every stored reference
// inside the owner's own avatar folder.
import { z } from "zod";
import {
  AVATAR_CLASSIFIER_TIERS,
  AVATAR_CLASSIFY_LIMITS,
  AVATAR_CONFIG_VERSION,
  AVATAR_EXPRESSION_BINDING_SOURCES,
  AVATAR_EXPRESSION_SLOTS,
  AVATAR_EXTRA_FEELINGS,
  AVATAR_KINDS,
  AVATAR_OWNER_ID_PATTERN,
  AVATAR_OWNER_TYPES,
  AVATAR_PNGTUBER_VARIANTS,
  isAvatarFilePath,
  type AvatarClassifyRequest,
  type AvatarConfig,
  type AvatarConfigUpdate,
  type AvatarExpressionMap,
  type AvatarExtraFeeling,
  type AvatarFeelingMap,
  type AvatarMeshRigRequest,
  type AvatarPngtuberVariantsRequest,
} from "../types/avatars.js";

/** Most layer sets one PNGTuber setup may hold; well above the 17 suggested sprite labels. */
const MAX_PNGTUBER_LAYER_SETS = 64;
const SPRITE_LABEL_KEY_PATTERN = /^[\p{L}\p{N}_]{1,64}$/u;

export const avatarOwnerRefSchema = z
  .object({
    ownerType: z.enum(AVATAR_OWNER_TYPES),
    ownerId: z.string().regex(AVATAR_OWNER_ID_PATTERN),
  })
  .strict();

export const avatarFilePathSchema = z
  .string()
  .refine(isAvatarFilePath, "A stored avatar file is <kind>/<name> inside the owner's folder.");

const unitIntervalSchema = z.number().finite().min(0).max(1);

export const avatarExpressionBindingSchema = z
  .object({
    target: z.string().min(1).max(128).nullable(),
    source: z.enum(AVATAR_EXPRESSION_BINDING_SOURCES),
    confidence: unitIntervalSchema,
  })
  .strict();

export const avatarExpressionMapSchema = z
  .object(
    Object.fromEntries(
      AVATAR_EXPRESSION_SLOTS.map((slot) => [slot, avatarExpressionBindingSchema.optional()]),
    ) as Record<(typeof AVATAR_EXPRESSION_SLOTS)[number], z.ZodOptional<typeof avatarExpressionBindingSchema>>,
  )
  .strict() satisfies z.ZodType<AvatarExpressionMap>;

export const avatarFeelingMapSchema = z
  .object(
    Object.fromEntries(
      AVATAR_EXTRA_FEELINGS.map((feeling) => [feeling, avatarExpressionBindingSchema.optional()]),
    ) as Record<AvatarExtraFeeling, z.ZodOptional<typeof avatarExpressionBindingSchema>>,
  )
  .strict() satisfies z.ZodType<AvatarFeelingMap>;

const avatarImageRefSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("sprite"), label: z.string().regex(SPRITE_LABEL_KEY_PATTERN) }).strict(),
  z.object({ source: z.literal("file"), path: avatarFilePathSchema }).strict(),
]);

const pngtuberLayerSetSchema = z
  .object({
    base: avatarImageRefSchema,
    mouthOpen: avatarImageRefSchema.optional(),
    eyesClosed: avatarImageRefSchema.optional(),
    eyesClosedMouthOpen: avatarImageRefSchema.optional(),
  })
  .strict();

const pngtuberAvatarDataSchema = z
  .object({
    layers: z
      .record(z.string().regex(SPRITE_LABEL_KEY_PATTERN), pngtuberLayerSetSchema)
      .refine((layers) => Object.keys(layers).length <= MAX_PNGTUBER_LAYER_SETS, {
        message: `A PNGTuber setup holds at most ${MAX_PNGTUBER_LAYER_SETS} layer sets.`,
      }),
    expressionMap: avatarExpressionMapSchema,
    // Optional and additive, so no AVATAR_CONFIG_VERSION or STORAGE_VERSION bump: avatar.json lives outside the
    // file-backed store, and no release has read it yet.
    feelingMap: avatarFeelingMapSchema.optional(),
    motion: z
      .object({
        bounceOnTalk: z.boolean(),
        bounceHeight: z.number().finite().min(0).max(0.25),
        blinkIntervalSeconds: z.number().finite().min(1).max(20),
      })
      .strict(),
    source: z.enum(["sprites", "pngtuber-plus", "generated"]),
  })
  .strict();

const meshAvatarDataSchema = z
  .object({
    file: avatarFilePathSchema.refine(
      (path) => path.startsWith("mesh-avatar/"),
      "A mesh avatar file lives in mesh-avatar/.",
    ),
    expressionMap: avatarExpressionMapSchema,
    source: z.enum(["import", "generated"]),
  })
  .strict();

/** Most expression names stored for one VRM; VRoid models have about 20. */
const MAX_VRM_EXPRESSION_NAMES = 256;
const vrmMetaTextSchema = z.string().min(1).max(256).nullable();
const vrmMetaTermSchema = z.string().min(1).max(64).nullable();
const vrmMetaUrlSchema = z
  .string()
  .max(2048)
  .regex(/^https?:\/\/[^\s]+$/iu, "A link in the model's terms is an http(s) address.")
  .nullable();

const vrmModelMetaSchema = z
  .object({
    title: vrmMetaTextSchema,
    authors: z.array(z.string().min(1).max(256)).max(16),
    version: vrmMetaTextSchema,
    avatarPermission: vrmMetaTermSchema,
    commercialUsage: vrmMetaTermSchema,
    modification: vrmMetaTermSchema,
    licenseName: vrmMetaTermSchema,
    licenseUrl: vrmMetaUrlSchema,
    termsUrl: vrmMetaUrlSchema.optional(),
    creditNotation: vrmMetaTermSchema.optional(),
    allowRedistribution: z.boolean().nullable().optional(),
    allowSexualUse: z.boolean().nullable().optional(),
    allowViolentUse: z.boolean().nullable().optional(),
    allowPoliticalOrReligiousUse: z.boolean().nullable().optional(),
    allowAntisocialOrHateUse: z.boolean().nullable().optional(),
  })
  .strict();

const vrmAvatarDataSchema = z
  .object({
    file: avatarFilePathSchema.refine((path) => path.startsWith("vrm/"), "A VRM file lives in vrm/."),
    specVersion: z.enum(["0.x", "1.0"]),
    expressionMap: avatarExpressionMapSchema,
    idleAnimation: avatarFilePathSchema
      .refine((path) => path.startsWith("vrm/"), "A VRM animation lives in vrm/.")
      .nullable()
      .optional(),
    meta: vrmModelMetaSchema.nullable().optional(),
    expressionNames: z.array(z.string().min(1).max(128)).max(MAX_VRM_EXPRESSION_NAMES).optional(),
  })
  .strict();

export const avatarKindDataSchema = z
  .object({
    pngtuber: pngtuberAvatarDataSchema.optional(),
    "mesh-avatar": meshAvatarDataSchema.optional(),
    vrm: vrmAvatarDataSchema.optional(),
  })
  .strict();

export const avatarFeatureFlagsSchema = z
  .object({
    lipSync: z.boolean(),
    blink: z.boolean(),
    idleMotion: z.boolean(),
  })
  .strict();

/** `avatar.json`, version 1. */
export const avatarConfigSchema = z
  .object({
    version: z.literal(AVATAR_CONFIG_VERSION),
    owner: avatarOwnerRefSchema,
    enabled: z.boolean(),
    activeKind: z.enum(AVATAR_KINDS).nullable(),
    features: avatarFeatureFlagsSchema,
    kinds: avatarKindDataSchema,
    updatedAt: z.string().datetime(),
  })
  .strict()
  .refine((config) => config.activeKind === null || config.kinds[config.activeKind] !== undefined, {
    message: "The active kind must be set up.",
    path: ["activeKind"],
  }) satisfies z.ZodType<AvatarConfig>;

export const avatarConfigUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    activeKind: z.enum(AVATAR_KINDS).nullable().optional(),
    features: avatarFeatureFlagsSchema.partial().optional(),
    kinds: avatarKindDataSchema.optional(),
  })
  .strict() satisfies z.ZodType<AvatarConfigUpdate>;

export const avatarClassifyRequestSchema = z
  .object({
    texts: z.array(z.string().max(AVATAR_CLASSIFY_LIMITS.maxTextLength)).min(1).max(AVATAR_CLASSIFY_LIMITS.maxTexts),
    language: z.string().max(35).nullable().optional(),
    tier: z.enum(AVATAR_CLASSIFIER_TIERS).optional(),
    debugMode: z.boolean().optional(),
  })
  .strict() satisfies z.ZodType<AvatarClassifyRequest>;

export const avatarPngtuberVariantsRequestSchema = z
  .object({
    owner: avatarOwnerRefSchema,
    labels: z.array(z.string().min(1).max(64)).max(MAX_PNGTUBER_LAYER_SETS).optional(),
    variants: z.array(z.enum(AVATAR_PNGTUBER_VARIANTS)).min(1),
    connectionId: z.string().min(1).max(128).nullable().optional(),
    debugMode: z.boolean().optional(),
  })
  .strict() satisfies z.ZodType<AvatarPngtuberVariantsRequest>;

export const avatarMeshRigRequestSchema = z
  .object({
    owner: avatarOwnerRefSchema,
    sourceLabel: z.string().min(1).max(64),
    connectionId: z.string().min(1).max(128).nullable().optional(),
    debugMode: z.boolean().optional(),
  })
  .strict() satisfies z.ZodType<AvatarMeshRigRequest>;
