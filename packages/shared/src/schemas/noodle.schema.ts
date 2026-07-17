// ──────────────────────────────────────────────
// Noodle Zod Schemas
// ──────────────────────────────────────────────
import { z } from "zod";

export const noodleAccountKindSchema = z.enum(["persona", "character", "random_user"]);
export const noodleInteractionTypeSchema = z.enum(["like", "repost", "reply", "vote"]);
export const noodleParticipantSelectionModeSchema = z.enum(["all", "random_range", "exact"]);
export const noodleCarryoverModeSchema = z.enum(["off", "conversation", "roleplay", "game", "all"]);
export const noodleCarryoverTargetSchema = z.enum(["conversation", "roleplay", "game"]);
export const noodleThemeSchema = z.enum(["system", "light", "dark"]);

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
  enableLorebookContext: false,
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
  enableLorebookContext: z.boolean().default(DEFAULT_NOODLE_SETTINGS.enableLorebookContext),
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
});

export const noodleSettingsUpdateSchema = noodleSettingsSchema.partial();

const noodleAvatarCropSchema = z.union([
  z
    .object({
      srcX: z.number().finite(),
      srcY: z.number().finite(),
      srcWidth: z.number().finite().positive(),
      srcHeight: z.number().finite().positive(),
    })
    .strict(),
  z
    .object({
      zoom: z.number().finite().positive(),
      offsetX: z.number().finite(),
      offsetY: z.number().finite(),
      fullImage: z.boolean().optional(),
    })
    .strict(),
]);

export const noodleAccountProfileSettingsSchema = z
  .object({
    avatarCrop: noodleAvatarCropSchema.nullable().optional(),
    bannerUrl: z.string().max(2000).optional(),
    location: z.string().max(120).optional(),
    profileGenerated: z.boolean().optional(),
    profileManuallyEdited: z.boolean().optional(),
  })
  .strict();

export const noodleAccountSocialSettingsSchema = z
  .object({
    followingAccountIds: z.array(z.string().min(1)).optional(),
    followingAccountTimestamps: z.record(z.string(), z.string().datetime()).optional(),
    notificationsReadAt: z.string().datetime().optional(),
  })
  .strict();

export const noodleAccountSchedulerSettingsSchema = z.object({}).strict();
export const noodleAccountPrivacySettingsSchema = z.object({}).strict();

export const noodleAccountSocialPatchSchema = noodleAccountSocialSettingsSchema.pick({ notificationsReadAt: true });

export const noodleAccountSettingsPatchSchema = z.discriminatedUnion("subtree", [
  z.object({ subtree: z.literal("social"), patch: noodleAccountSocialPatchSchema }).strict(),
  z.object({ subtree: z.literal("scheduler"), patch: noodleAccountSchedulerSettingsSchema }).strict(),
  z.object({ subtree: z.literal("privacy"), patch: noodleAccountPrivacySettingsSchema }).strict(),
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

export const noodleCreatePostSchema = z.object({
  authorKind: noodleAccountKindSchema,
  authorEntityId: z.string().min(1),
  content: z.string().min(1).max(4000),
  imageUrl: z.string().max(2000).nullable().optional(),
  imagePrompt: z.string().max(2000).nullable().optional(),
  parentPostId: z.string().min(1).nullable().optional(),
  quotePostId: z.string().min(1).nullable().optional(),
  poll: noodlePollInputSchema.nullable().optional(),
});

export const noodlePostUpdateSchema = z.object({
  content: z.string().trim().min(1).max(4000).optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  imagePrompt: z.string().max(2000).nullable().optional(),
});

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

export const noodleRefreshSchema = z.object({
  personaId: z.string().min(1).optional(),
  connectionId: z.string().min(1).optional(),
  debugMode: z.boolean().optional(),
  reviewImagePromptsBeforeSend: z.boolean().optional(),
});

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
export type NoodleInviteInput = z.infer<typeof noodleInviteSchema>;
export type NoodleBulkInviteInput = z.infer<typeof noodleBulkInviteSchema>;
export type NoodlePollInput = z.infer<typeof noodlePollInputSchema>;
export type NoodlePollData = z.infer<typeof noodlePollSchema>;
export type NoodleCreatePostInput = z.infer<typeof noodleCreatePostSchema>;
export type NoodlePostUpdateInput = z.infer<typeof noodlePostUpdateSchema>;
export type NoodleCreateInteractionInput = z.infer<typeof noodleCreateInteractionSchema>;
export type NoodleRemoveInteractionInput = z.infer<typeof noodleRemoveInteractionSchema>;
export type NoodleInteractionOwnerInput = z.infer<typeof noodleInteractionOwnerSchema>;
export type NoodleInteractionUpdateInput = z.infer<typeof noodleInteractionUpdateSchema>;
export type NoodleRefreshInput = z.infer<typeof noodleRefreshSchema>;
export type NoodleRescheduleRefreshInput = z.infer<typeof noodleRescheduleRefreshSchema>;
export type NoodleGeneratedRefresh = z.infer<typeof noodleGeneratedRefreshSchema>;
export type NoodleGeneratedProfiles = z.infer<typeof noodleGeneratedProfilesSchema>;
export type NoodleGeneratedProfile = z.infer<typeof noodleGeneratedProfileSchema>;
