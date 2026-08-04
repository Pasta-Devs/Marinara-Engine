// ──────────────────────────────────────────────
// Noodle Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";
import { avatarCropSchema } from "./avatar-crop.schema.js";

export const noodleAccountKindSchema = z.enum(["persona", "character", "random_user"]);
export const noodleInteractionTypeSchema = z.enum(["like", "repost", "reply", "vote"]);
export const noodlePostAccessSchema = z.enum(["public", "locked"]);
export const DEFAULT_NOODLE_WALLET_COINS = 999_999;
export const noodleParticipantSelectionModeSchema = z.enum(["all", "random_range", "exact"]);
export const noodleCarryoverModeSchema = z.enum(["off", "conversation", "roleplay", "game", "all"]);
export const noodleCarryoverTargetSchema = z.enum(["conversation", "roleplay", "game"]);
export const noodleThemeSchema = z.enum(["system", "light", "dark"]);
export const noodleIdentityDisclosureSchema = z.enum(["open", "hinted", "secret"]);
export const noodlerOnboardingStateSchema = z.enum(["incomplete", "zero", "completed"]);
export const NOODLER_POST_TITLE_MAX_LENGTH = 200;
export const NOODLER_POST_CONTENT_MAX_LENGTH = 4000;
export const NOODLER_REPLY_CONTENT_MAX_LENGTH = 2000;
export const DEFAULT_NOODLER_CREATOR_REPLIES_PER_24_HOURS = 10;
export const NOODLER_POSTS_PER_DAY_MAX = 24;
/** Per-request cap on bulk creator creation and targeted refresh. The wizard enforces the same
 *  ceiling so a selection larger than this is prevented rather than rejected as a whole request. */
export const NOODLER_BULK_ACCOUNT_MAX = 100;
export const AMBIENT_NOODLE_ENTITY_IDS = [
  "random_user:thread-countess",
  "random_user:packet-soup",
  "random_user:orbit-notice",
  "random_user:glass-bulletin",
  "random_user:moth-hour",
  "random_user:brine-index",
] as const;
// Exact `Title:\n` + `\n\n` + `Body:\n` framing overhead from serializeNoodlerPostGuide.
export const NOODLER_POST_GUIDE_MAX_LENGTH = NOODLER_POST_TITLE_MAX_LENGTH + NOODLER_POST_CONTENT_MAX_LENGTH + 15;

export const DEFAULT_NOODLE_SETTINGS = {
  refreshesPerDay: 2,
  participantSelectionMode: "random_range",
  participantMin: 2,
  participantMax: 5,
  maxGeneratedPostsPerRefresh: 8,
  maxRepliesPerRefresh: 12,
  maxRepostsPerRefresh: 4,
  maxLikesPerRefresh: 18,
  maxImagesPerRefresh: 3,
  enableImagePrompts: false,
  imageGenerationConnectionId: null,
  imageGenerationPrompt:
    "Create either a social-media-ready character image or an in-character meme for the post. For character images, mention build, clothing, visible appearance, pose, expression, setting, lighting, mood, and composition. For memes, mention meme format, visual gag, composition, and short readable caption/text when relevant.",
  imageGenerationUseAvatarReferences: true,
  imageGenerationIncludeDescriptions: true,
  allowGalleryImageAttachments: false,
  imageCaptioningEnabled: false,
  imageCaptioningConnectionId: null,
  imageCaptioningUseConnectionDefault: true,
  enableLorebookContext: false,
  includeCharacterSchedules: false,
  enableEnhancedTimelineWriting: false,
  allowProfessorMari: true,
  allowRandomUsers: false,
  invitedCharacterGroupIds: [],
  carryoverMode: "off",
  carryoverModes: [],
  carryoverHours: 48,
  carryoverMaxItems: 8,
  theme: "system",
  generationConnectionId: null,
  enableNoodler: false,
  noodlerGenerationGuidance:
    "All NoodleR creators and viewers are adults (18+). NSFW and explicit content are allowed when appropriate to the creator's personality and current context. Do not force it: stay true to each creator's voice rather than making every post sexual.",
  autoPostingScheduleEnabled: true,
  postsPerDay: 4,
  noodlerOnboardingComplete: false,
  noodlerOnboardingState: "incomplete",
  noodlerNightQuiet: true,
} as const;

export const noodleSettingsSchema = z.object({
  refreshesPerDay: z.number().int().min(0).max(24).default(DEFAULT_NOODLE_SETTINGS.refreshesPerDay),
  participantSelectionMode: noodleParticipantSelectionModeSchema.default(
    DEFAULT_NOODLE_SETTINGS.participantSelectionMode,
  ),
  participantMin: z.number().int().min(1).max(100).default(DEFAULT_NOODLE_SETTINGS.participantMin),
  participantMax: z.number().int().min(1).max(100).default(DEFAULT_NOODLE_SETTINGS.participantMax),
  maxGeneratedPostsPerRefresh: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(DEFAULT_NOODLE_SETTINGS.maxGeneratedPostsPerRefresh),
  maxRepliesPerRefresh: z.number().int().min(0).max(200).default(DEFAULT_NOODLE_SETTINGS.maxRepliesPerRefresh),
  maxRepostsPerRefresh: z.number().int().min(0).max(100).default(DEFAULT_NOODLE_SETTINGS.maxRepostsPerRefresh),
  maxLikesPerRefresh: z.number().int().min(0).max(500).default(DEFAULT_NOODLE_SETTINGS.maxLikesPerRefresh),
  maxImagesPerRefresh: z.number().int().min(0).max(50).default(DEFAULT_NOODLE_SETTINGS.maxImagesPerRefresh),
  enableImagePrompts: z.boolean().default(DEFAULT_NOODLE_SETTINGS.enableImagePrompts),
  imageGenerationConnectionId: z
    .string()
    .min(1)
    .nullable()
    .default(DEFAULT_NOODLE_SETTINGS.imageGenerationConnectionId),
  imageGenerationPrompt: z.string().max(4000).default(DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt),
  imageGenerationUseAvatarReferences: z.boolean().default(DEFAULT_NOODLE_SETTINGS.imageGenerationUseAvatarReferences),
  imageGenerationIncludeDescriptions: z.boolean().default(DEFAULT_NOODLE_SETTINGS.imageGenerationIncludeDescriptions),
  allowGalleryImageAttachments: z.boolean().default(DEFAULT_NOODLE_SETTINGS.allowGalleryImageAttachments),
  imageCaptioningEnabled: z.boolean().default(DEFAULT_NOODLE_SETTINGS.imageCaptioningEnabled),
  imageCaptioningConnectionId: z
    .string()
    .min(1)
    .nullable()
    .default(DEFAULT_NOODLE_SETTINGS.imageCaptioningConnectionId),
  imageCaptioningUseConnectionDefault: z.boolean().default(DEFAULT_NOODLE_SETTINGS.imageCaptioningUseConnectionDefault),
  enableLorebookContext: z.boolean().default(DEFAULT_NOODLE_SETTINGS.enableLorebookContext),
  includeCharacterSchedules: z.boolean().default(DEFAULT_NOODLE_SETTINGS.includeCharacterSchedules),
  enableEnhancedTimelineWriting: z.boolean().default(DEFAULT_NOODLE_SETTINGS.enableEnhancedTimelineWriting),
  allowProfessorMari: z.boolean().default(DEFAULT_NOODLE_SETTINGS.allowProfessorMari),
  allowRandomUsers: z.boolean().default(DEFAULT_NOODLE_SETTINGS.allowRandomUsers),
  invitedCharacterGroupIds: z
    .array(z.string().min(1))
    .default(() => [...DEFAULT_NOODLE_SETTINGS.invitedCharacterGroupIds]),
  carryoverMode: noodleCarryoverModeSchema.default(DEFAULT_NOODLE_SETTINGS.carryoverMode),
  carryoverModes: z.array(noodleCarryoverTargetSchema).default(() => [...DEFAULT_NOODLE_SETTINGS.carryoverModes]),
  carryoverHours: z.number().int().min(1).max(720).default(DEFAULT_NOODLE_SETTINGS.carryoverHours),
  carryoverMaxItems: z.number().int().min(1).max(50).default(DEFAULT_NOODLE_SETTINGS.carryoverMaxItems),
  theme: noodleThemeSchema.default(DEFAULT_NOODLE_SETTINGS.theme),
  generationConnectionId: z.string().min(1).nullable().default(DEFAULT_NOODLE_SETTINGS.generationConnectionId),
  enableNoodler: z.boolean().default(DEFAULT_NOODLE_SETTINGS.enableNoodler),
  noodlerGenerationGuidance: z.string().max(4000).default(DEFAULT_NOODLE_SETTINGS.noodlerGenerationGuidance),
  autoPostingScheduleEnabled: z.boolean().default(DEFAULT_NOODLE_SETTINGS.autoPostingScheduleEnabled),
  postsPerDay: z.number().int().min(1).max(NOODLER_POSTS_PER_DAY_MAX).default(DEFAULT_NOODLE_SETTINGS.postsPerDay),
  noodlerOnboardingComplete: z.boolean().default(DEFAULT_NOODLE_SETTINGS.noodlerOnboardingComplete),
  noodlerOnboardingState: noodlerOnboardingStateSchema.default(DEFAULT_NOODLE_SETTINGS.noodlerOnboardingState),
  noodlerNightQuiet: z.boolean().default(DEFAULT_NOODLE_SETTINGS.noodlerNightQuiet),
});

export const noodleSettingsUpdateSchema = noodleSettingsSchema.partial();

export const noodleAccountProfileSettingsSchema = z
  .object({
    avatarCrop: avatarCropSchema.nullable().optional(),
    bannerUrl: z.string().max(2000).optional(),
    location: z.string().max(120).optional(),
    profileGenerated: z.boolean().optional(),
    profileManuallyEdited: z.boolean().optional(),
    noodlerWizardExecutionId: z.string().min(1).max(128).optional(),
  })
  .strict();

export const noodleAccountSocialSettingsSchema = z
  .object({
    followingAccountIds: z.array(z.string().min(1)).optional(),
    followingAccountTimestamps: z.record(z.string(), z.string().datetime()).optional(),
    notificationsReadAt: z.string().datetime().optional(),
    noodlerFeedSeenAt: z.string().datetime().optional(),
    noodleFeedSeenAt: z.string().datetime().optional(),
  })
  .strict();

export const noodleAutoPostingSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    imagesEnabled: z.boolean().default(false),
  })
  .strict();

/** Full normalized stored shape. */
export const noodleAccountSchedulerSettingsSchema = z
  .object({
    autoPosting: noodleAutoPostingSettingsSchema.optional(),
  })
  .strict();

export const noodleAccountSchedulerPatchSchema = z
  .object({
    autoPosting: noodleAutoPostingSettingsSchema.pick({ enabled: true, imagesEnabled: true }).partial().optional(),
  })
  .strict();
export const noodleAccountAccessSettingsSchema = z
  .object({
    hiddenFromAccountIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const noodleWalletSettingsSchema = z
  .object({ coins: z.number().int().min(0).default(DEFAULT_NOODLE_WALLET_COINS) })
  .strict();

export const noodleAccountPrivacySettingsSchema = z
  .object({
    identityDisclosure: noodleIdentityDisclosureSchema.optional(),
    stagePersonality: z.string().trim().max(1000).optional(),
    access: noodleAccountAccessSettingsSchema.default({
      hiddenFromAccountIds: [],
    }),
  })
  .strict();

export const noodleAccountPrivacyPatchSchema = noodleAccountPrivacySettingsSchema
  .omit({ access: true })
  .extend({ access: noodleAccountAccessSettingsSchema.partial().optional() })
  .strict();

export const noodleAccountSocialPatchSchema = noodleAccountSocialSettingsSchema.pick({
  notificationsReadAt: true,
  noodlerFeedSeenAt: true,
  noodleFeedSeenAt: true,
});

export const noodleAccountSettingsPatchSchema = z.discriminatedUnion("subtree", [
  z.object({ subtree: z.literal("social"), patch: noodleAccountSocialPatchSchema }).strict(),
  z.object({ subtree: z.literal("scheduler"), patch: noodleAccountSchedulerPatchSchema }).strict(),
  z.object({ subtree: z.literal("privacy"), patch: noodleAccountPrivacyPatchSchema }).strict(),
]);

const noodleAccountIdentityUpdateShape = {
  handle: z
    .string()
    .trim()
    .min(1, "Enter a Noodle handle.")
    .max(40, "Handle must contain at most 40 characters.")
    .optional(),
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
};

export const noodleAccountUpdateSchema = z
  .object({ ...noodleAccountIdentityUpdateShape, invited: z.boolean().optional() })
  .strict();

export const noodleAccountProfileUpdateSchema = z
  .object({ ...noodleAccountIdentityUpdateShape, profile: noodleAccountProfileSettingsSchema })
  .strict();

export const noodleAccountFollowUpdateSchema = z.object({ followed: z.boolean() }).strict();

export const noodleAmbientProfileRerollSchema = z
  .object({
    accountIds: z
      .array(z.string().min(1).max(64))
      .min(1)
      .max(AMBIENT_NOODLE_ENTITY_IDS.length)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Duplicate account IDs are not allowed." }),
    debugMode: z.boolean().default(false),
  })
  .strict();

const noodleStageProfileShape = {
  displayName: z.string().trim().min(1, "Enter a stage name.").max(120),
  handle: z.string().trim().min(1, "Enter a stage handle.").max(40),
  bio: z.string().trim().max(500),
  stagePersonality: z.string().trim().max(1000),
  disclosureMode: noodleIdentityDisclosureSchema,
};

export const noodleStageProfileSchema = z.object(noodleStageProfileShape).strict();
export const noodlerAccountCreateSchema = z.object({ stageProfile: noodleStageProfileSchema }).strict();
export const noodleBulkNoodlerAccountCreateSchema = z
  .object({
    // Cap and dedupe so one accepted request can't fan out into unbounded or
    // duplicated sequential create work, and each public account has exactly one outcome.
    noodleAccountIds: z
      .array(z.string().min(1).max(64))
      .min(0)
      .max(NOODLER_BULK_ACCOUNT_MAX)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Duplicate account IDs are not allowed." }),
    disclosureMode: noodleIdentityDisclosureSchema,
    disclosureExceptions: z.record(z.string().min(1).max(64), noodleIdentityDisclosureSchema).default({}),
    autoPosting: noodleAutoPostingSettingsSchema.default({ enabled: true, imagesEnabled: false }),
    executionId: z.string().min(1).max(128).optional(),
  })
  .strict();
export const noodlerTargetedRefreshSchema = z
  .object({
    accountIds: z
      .array(z.string().min(1).max(64))
      .min(1)
      .max(NOODLER_BULK_ACCOUNT_MAX)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Duplicate account IDs are not allowed." }),
    executionId: z.string().min(1).max(128).optional(),
  })
  .strict();
export const noodleStageProfileUpdateSchema = z.object(noodleStageProfileShape).strict();

export const noodleStageProfileDraftRequestSchema = z
  .object({
    noodleAccountId: z.string().min(1).optional(),
    noodlerAccountId: z.string().min(1).optional(),
    disclosureMode: noodleIdentityDisclosureSchema,
    guidance: z.string().trim().max(2000).default(""),
    currentDraft: noodleStageProfileSchema.partial().optional(),
    connectionId: z.string().min(1).optional(),
  })
  .strict()
  .refine((input) => Boolean(input.noodleAccountId) !== Boolean(input.noodlerAccountId), {
    message: "Choose a source account.",
  });

export const noodleStageProfileDraftResponseSchema = noodleStageProfileSchema;

export const noodleInviteSchema = z.object({
  characterId: z.string().min(1),
});

export const noodleBulkInviteSchema = z.object({
  characterIds: z.array(z.string().min(1)).min(1).max(5000),
});

export const noodlePollInputSchema = z
  .object({
    question: z.string().trim().min(1).max(240),
    options: z.array(z.string().trim().min(1).max(120)).min(2).max(4),
  })
  .superRefine((poll, ctx) => {
    const normalized = poll.options.map((option) => option.toLocaleLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Poll options must be unique.",
      });
    }
  });

export const noodlePollSchema = z.object({
  question: z.string().trim().min(1).max(240),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        label: z.string().trim().min(1).max(120),
      }),
    )
    .min(2)
    .max(4),
});

export const noodlePostImageCropSchema = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().gt(0).max(1),
    height: z.number().finite().gt(0).max(1),
    sourceWidth: z.number().int().min(1).max(65_535),
    sourceHeight: z.number().int().min(1).max(65_535),
  })
  .strict()
  .refine((crop) => crop.x + crop.width <= 1.000_001 && crop.y + crop.height <= 1.000_001, {
    message: "Image crop must stay inside the source image.",
  });

export const noodleCreatePostSchema = z.object({
  authorKind: noodleAccountKindSchema,
  authorEntityId: z.string().min(1),
  content: z.string().min(1).max(4000),
  imageUrl: z.string().max(2000).nullable().optional(),
  imagePrompt: z.string().max(2000).nullable().optional(),
  imageCrop: noodlePostImageCropSchema.optional(),
  parentPostId: z.string().min(1).nullable().optional(),
  quotePostId: z.string().min(1).nullable().optional(),
  poll: noodlePollInputSchema.nullable().optional(),
});

const noodlerPersonaIdSchema = z.object({ personaId: z.string().min(1) }).strict();
export const noodlerViewerPersonaSchema = noodlerPersonaIdSchema;
export const noodlerSubscriptionSchema = noodlerPersonaIdSchema;
export const noodlerUnlockSchema = noodlerPersonaIdSchema;

export const noodlerCreateInteractionSchema = noodlerPersonaIdSchema
  .extend({
    type: z.enum(["like", "repost", "reply", "vote"]),
    content: z.string().max(2000).nullable().optional(),
    parentInteractionId: z.string().min(1).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === "reply" && !input.content?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["content"], message: "Replies need text." });
    }
    if (input.type === "repost" && input.parentInteractionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Reposts cannot target a reply.",
      });
    }
    if (input.type === "vote" && (!input.content?.trim() || input.content.length > 40)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Poll votes require a valid option ID.",
      });
    }
    if (input.type === "vote" && input.parentInteractionId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Poll votes cannot target a reply.",
      });
    }
    if ((input.type === "like" || input.type === "repost") && input.content?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Likes and reposts cannot include content.",
      });
    }
  });

export const noodlerRemoveInteractionSchema = noodlerPersonaIdSchema
  .extend({
    type: z.enum(["like", "repost"]),
    parentInteractionId: z.string().min(1).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === "repost" && input.parentInteractionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Reposts cannot target a reply.",
      });
    }
  });

export const noodlerCreatorReplyRequestSchema = noodlerPersonaIdSchema
  .extend({ debugMode: z.boolean().optional() })
  .strict();

export const noodlePostUpdateSchema = z.object({
  content: z.string().trim().max(4000).optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  imagePrompt: z.string().max(2000).nullable().optional(),
  imageCrop: noodlePostImageCropSchema.nullable().optional(),
  poll: noodlePollInputSchema.nullable().optional(),
});

const noodlerPostTitleValueSchema = z.string().trim().max(NOODLER_POST_TITLE_MAX_LENGTH).nullable();
const noodlerPostTitleSchema = noodlerPostTitleValueSchema.optional().transform((value) => value?.trim() || null);
const noodlerPostTitleUpdateSchema = noodlerPostTitleValueSchema
  .optional()
  .transform((value) => (value === undefined ? undefined : value?.trim() || null));

const noodlerPostCreateShape = {
  targetAccountId: z.string().min(1),
  title: noodlerPostTitleSchema,
  content: z.string().trim().max(NOODLER_POST_CONTENT_MAX_LENGTH),
  uploadedImageUrl: z.string().trim().url().max(2000).optional(),
  imageCrop: noodlePostImageCropSchema.optional(),
  poll: noodlePollInputSchema.nullable().optional(),
};

export const noodlerPostCreateWithMediaSchema = z
  .object({ ...noodlerPostCreateShape, access: noodlePostAccessSchema.default("public") })
  .strict();

export const noodlerPostCreateSchema = noodlerPostCreateWithMediaSchema.superRefine((input, ctx) => {
  if (!input.content && !input.poll && !input.uploadedImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["content"],
      message: "Posts need a body, image, or poll.",
    });
  }
});

export const noodlerPostUpdateSchema = z
  .object({
    title: noodlerPostTitleUpdateSchema,
    content: z.string().trim().max(NOODLER_POST_CONTENT_MAX_LENGTH).optional(),
    removeImage: z.literal(true).optional(),
    imageCrop: noodlePostImageCropSchema.nullable().optional(),
    poll: noodlePollInputSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.title !== undefined ||
      input.content !== undefined ||
      input.removeImage !== undefined ||
      input.imageCrop !== undefined ||
      input.poll !== undefined,
    {
      message: "Provide a title, body, image, or poll update.",
    },
  );

export const noodleCreateInteractionSchema = z
  .object({
    actorKind: noodleAccountKindSchema,
    actorEntityId: z.string().min(1),
    type: noodleInteractionTypeSchema,
    content: z.string().max(2000).nullable().optional(),
    imageUrl: z.string().max(2000).nullable().optional(),
    parentInteractionId: z.string().min(1).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === "reply" && !input.content?.trim() && !input.imageUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Replies need text or an image.",
      });
    }
    if (input.type === "repost" && input.parentInteractionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Reposts cannot target a reply.",
      });
    }
    if (input.type === "vote" && (!input.content?.trim() || input.parentInteractionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Poll votes require an option and cannot target a reply.",
      });
    }
    if (input.type !== "reply" && input.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageUrl"],
        message: "Only replies can include an image.",
      });
    }
  });

export const noodleRemoveInteractionSchema = z
  .object({
    actorKind: noodleAccountKindSchema,
    actorEntityId: z.string().min(1),
    type: z.enum(["like", "repost"]),
    parentInteractionId: z.string().min(1).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === "repost" && input.parentInteractionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Reposts cannot target a reply.",
      });
    }
  });

export const noodleInteractionOwnerSchema = z.object({
  personaId: z.string().min(1),
});

export const noodleInteractionUpdateSchema = noodleInteractionOwnerSchema
  .extend({
    content: z.string().max(2000).nullable().optional(),
    imageUrl: z.string().max(2000).nullable().optional(),
  })
  .refine((input) => input.content !== undefined || input.imageUrl !== undefined, {
    message: "Provide comment text or an image update.",
  });

const noodleGenerationConnectionShape = {
  connectionId: z.string().min(1).optional(),
  debugMode: z.boolean().optional(),
};

export const noodlePublicGenerationRequestSchema = z
  .object({
    mode: z.literal("public"),
    ...noodleGenerationConnectionShape,
    personaId: z.string().min(1).optional(),
    timeZone: z.string().min(1).max(100).optional(),
    reviewImagePromptsBeforeSend: z.boolean().optional(),
  })
  .strict();

export const noodlerPostGuideSchema = z.string().trim().min(1).max(NOODLER_POST_GUIDE_MAX_LENGTH);

export const noodlerProjectWorkSchema = z.string().trim().min(1).max(4000);

const noodlerGenerationRequestShape = {
  mode: z.literal("noodler"),
  ...noodleGenerationConnectionShape,
  targetAccountId: z.string().min(1),
  executionId: z.string().min(1).max(128).optional(),
  noodlerPostGuide: noodlerPostGuideSchema.optional(),
  noodlerProjectWork: noodlerProjectWorkSchema.optional(),
  // Manual Guide path may ask to review the image prompt before rendering; the autonomous
  // scheduler never sets this (no human in the loop).
  reviewImagePromptsBeforeSend: z.boolean().optional(),
  uploadedImageUrl: z.string().trim().url().max(2000).optional(),
  imageCrop: noodlePostImageCropSchema.optional(),
  poll: noodlePollInputSchema.nullable().optional(),
};

export const noodlerGenerationRequestSchema = z
  .object({ ...noodlerGenerationRequestShape, access: noodlePostAccessSchema.default("public") })
  .strict();

export const noodleGenerationRequestSchema = z.union([
  noodlePublicGenerationRequestSchema,
  noodlerGenerationRequestSchema,
]);

export const noodleRescheduleRefreshSchema = z.object({
  scheduledTime: z.string().datetime(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Use a 24-hour time in HH:mm format."),
});

export const noodleGeneratedPostSchema = z.object({
  tempId: z.string().min(1).optional(),
  authorHandle: z.string().min(1),
  content: z.string().min(1).max(4000),
  imagePrompt: z.string().max(2000).nullable().optional(),
  attachGalleryImage: z.boolean().optional().default(false),
  poll: noodlePollInputSchema.nullable().optional(),
});

export const noodleGeneratedNoodlerPostSchema = z
  .object({
    title: noodlerPostTitleSchema,
    content: z.string().trim().min(1).max(NOODLER_POST_CONTENT_MAX_LENGTH),
    imagePrompt: z.string().max(2000).nullable().optional(),
    poll: noodlePollInputSchema.nullable().optional(),
  })
  .strict()
  .transform(({ title, content, imagePrompt }) => ({ title, content, imagePrompt: imagePrompt ?? null }));

export const noodleGeneratedNoodlerReplySchema = z
  .object({ content: z.string().trim().min(1).max(NOODLER_REPLY_CONTENT_MAX_LENGTH) })
  .strict();

export const noodleGeneratedInteractionSchema = z
  .object({
    actorHandle: z.string().min(1),
    targetTempId: z
      .string()
      .min(1)
      .nullish()
      .transform((value) => value ?? undefined),
    targetPostId: z
      .string()
      .min(1)
      .nullish()
      .transform((value) => value ?? undefined),
    parentInteractionId: z
      .string()
      .min(1)
      .nullish()
      .transform((value) => value ?? undefined),
    type: noodleInteractionTypeSchema,
    content: z.string().max(2000).nullable().optional(),
    pollOptionIndex: z
      .number()
      .int()
      .min(0)
      .max(3)
      .nullish()
      .transform((value) => value ?? undefined),
  })
  .superRefine((interaction, ctx) => {
    if (interaction.type === "vote" && interaction.pollOptionIndex === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pollOptionIndex"],
        message: "Poll votes require a poll option index.",
      });
    }
    if (interaction.type !== "reply" && interaction.parentInteractionId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentInteractionId"],
        message: "Only replies can target an existing comment.",
      });
    }
  });

export const noodleGeneratedFollowSchema = z.object({
  actorHandle: z.string().min(1),
  targetHandle: z.string().min(1),
});

export const noodleGeneratedDigestSchema = z.object({
  accountEntityIds: z.array(z.string().min(1)).default([]),
  content: z.string().min(1).max(1200),
});

function boundedGeneratedProfileText(maxLength: number, minimumLength = 0) {
  return z
    .string()
    .transform((value) => {
      if (value.length <= maxLength) return value;
      const truncated = value.slice(0, maxLength);
      // Avoid leaving a dangling UTF-16 high surrogate when truncating emoji.
      return /[\uD800-\uDBFF]$/.test(truncated) ? truncated.slice(0, -1) : truncated;
    })
    .pipe(z.string().min(minimumLength).max(maxLength));
}

export const noodleGeneratedProfileSchema = z.object({
  entityId: z.string().min(1),
  name: boundedGeneratedProfileText(120, 1),
  handle: boundedGeneratedProfileText(40, 1),
  bio: boundedGeneratedProfileText(500).default(""),
  location: boundedGeneratedProfileText(120).default(""),
});

export const noodleGeneratedRefreshSchema = z.object({
  posts: z.array(noodleGeneratedPostSchema).default([]),
  interactions: z.array(noodleGeneratedInteractionSchema).default([]),
  follows: z.array(noodleGeneratedFollowSchema).default([]),
  digests: z.array(noodleGeneratedDigestSchema).default([]),
});

export const noodleGeneratedProfilesSchema = z.object({
  profiles: z.array(noodleGeneratedProfileSchema).default([]),
});

export type NoodleSettingsInput = z.infer<typeof noodleSettingsSchema>;
export type NoodleSettingsUpdateInput = z.infer<typeof noodleSettingsUpdateSchema>;
export type NoodleAccountUpdateInput = z.infer<typeof noodleAccountUpdateSchema>;
export type NoodleAccountProfileUpdateInput = z.infer<typeof noodleAccountProfileUpdateSchema>;
export type NoodleAccountSettingsPatchInput = z.infer<typeof noodleAccountSettingsPatchSchema>;
export type NoodleAccountFollowUpdateInput = z.infer<typeof noodleAccountFollowUpdateSchema>;
export type NoodleAmbientProfileRerollInput = z.infer<typeof noodleAmbientProfileRerollSchema>;
export type NoodleAmbientProfileRerollOutcome = {
  accountId: string;
  status: "updated" | "invalid_response" | "error";
};
export type NoodlerAccountCreateInput = z.infer<typeof noodlerAccountCreateSchema>;
export type NoodleBulkNoodlerAccountCreateInput = z.infer<typeof noodleBulkNoodlerAccountCreateSchema>;
export type NoodleStageProfileInput = z.infer<typeof noodleStageProfileSchema>;
export type NoodleStageProfileDraftRequest = z.infer<typeof noodleStageProfileDraftRequestSchema>;
export type NoodleInviteInput = z.infer<typeof noodleInviteSchema>;
export type NoodleBulkInviteInput = z.infer<typeof noodleBulkInviteSchema>;
export type NoodlePollInput = z.infer<typeof noodlePollInputSchema>;
export type NoodlePollData = z.infer<typeof noodlePollSchema>;
export type NoodleCreatePostInput = z.infer<typeof noodleCreatePostSchema>;
export type NoodlePostUpdateInput = z.infer<typeof noodlePostUpdateSchema>;
export type NoodlerPostCreateInput = z.infer<typeof noodlerPostCreateSchema>;
export type NoodlerPostUpdateInput = z.infer<typeof noodlerPostUpdateSchema>;
export type NoodleCreateInteractionInput = z.infer<typeof noodleCreateInteractionSchema>;
export type NoodleRemoveInteractionInput = z.infer<typeof noodleRemoveInteractionSchema>;
export type NoodleInteractionOwnerInput = z.infer<typeof noodleInteractionOwnerSchema>;
export type NoodleInteractionUpdateInput = z.infer<typeof noodleInteractionUpdateSchema>;
export type NoodlerCreateInteractionInput = z.infer<typeof noodlerCreateInteractionSchema>;
export type NoodlerRemoveInteractionInput = z.infer<typeof noodlerRemoveInteractionSchema>;
type InferredNoodlePublicGenerationRequest = z.infer<typeof noodlePublicGenerationRequestSchema>;
type AssertNoKeys<T extends never> = T;
export type NoodlePublicGenerationRequest = InferredNoodlePublicGenerationRequest &
  Record<
    AssertNoKeys<
      Extract<
        keyof InferredNoodlePublicGenerationRequest,
        "targetAccountId" | "noodlerPostGuide" | "noodlerProjectWork"
      >
    >,
    never
  >;
export type NoodlerPostGuide = z.infer<typeof noodlerPostGuideSchema>;
export type NoodlerProjectWork = z.infer<typeof noodlerProjectWorkSchema>;
export type NoodlerGenerationRequest = z.infer<typeof noodlerGenerationRequestSchema>;
export type NoodleGenerationRequest = z.infer<typeof noodleGenerationRequestSchema>;
export type NoodleRescheduleRefreshInput = z.infer<typeof noodleRescheduleRefreshSchema>;
export type NoodleGeneratedRefresh = z.infer<typeof noodleGeneratedRefreshSchema>;
export type NoodleGeneratedProfiles = z.infer<typeof noodleGeneratedProfilesSchema>;
export type NoodleGeneratedProfile = z.infer<typeof noodleGeneratedProfileSchema>;
