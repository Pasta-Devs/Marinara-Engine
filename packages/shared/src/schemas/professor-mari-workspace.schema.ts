import { z } from "zod";
import { MARI_PERMISSIONS_MODES } from "../constants/mari-permissions-mode.js";
import { MARI_RUNTIMES } from "../constants/mari-runtime.js";

// Hard limits on every write path (no silent truncation); the storage files re-export them.
export const MAX_INSTRUCTION_CONTENT_LENGTH = 20_000;
export const MAX_INSTRUCTION_NAME_LENGTH = 120;
export const MAX_INSTRUCTION_DESCRIPTION_LENGTH = 300;
export const MAX_CONTEXT_ITEM_CONTENT_LENGTH = 200_000;
export const MAX_CONTEXT_LABEL_LENGTH = 200;

// #5073: attached workspace context (chat-history slices). content is the already-serialized JSON;
// the client builds it from the chat-history picker and estimates the token cost.
export const mariWorkspaceContextCreateSchema = z.object({
  chatId: z.string().min(1),
  kind: z.literal("chat_history").optional(),
  label: z.string().min(1).max(MAX_CONTEXT_LABEL_LENGTH),
  sourceChatId: z.string().optional().nullable(),
  content: z.string().min(1).max(MAX_CONTEXT_ITEM_CONTENT_LENGTH),
  tokenEstimate: z.number().int().nonnegative().optional(),
});

// #4851: memories are edited directly by the user in the Memories panel (the user is
// the reviewer of their own memory), so these routes deliberately do NOT call
// workspaceService.reset(); a reset aborts Mari's in-flight turn, and the memory
// injection is re-read live per turn, so no agent rebuild is needed.
export const mariWorkspaceInstructionCreateSchema = z.object({
  name: z.string().min(1).max(MAX_INSTRUCTION_NAME_LENGTH),
  description: z.string().max(MAX_INSTRUCTION_DESCRIPTION_LENGTH).optional().default(""),
  content: z.string().min(1).max(MAX_INSTRUCTION_CONTENT_LENGTH),
  persistent: z.boolean().optional().default(false),
  enabled: z.boolean().optional().default(false),
});

export const mariWorkspaceInstructionUpdateSchema = z.object({
  name: z.string().min(1).max(MAX_INSTRUCTION_NAME_LENGTH).optional(),
  description: z.string().max(MAX_INSTRUCTION_DESCRIPTION_LENGTH).optional(),
  content: z.string().min(1).max(MAX_INSTRUCTION_CONTENT_LENGTH).optional(),
  persistent: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const professorMariPromptSchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
  connectionId: z.string().optional().nullable(),
  debugMode: z.boolean().optional().default(false),
  existingUserMessageId: z.string().min(1).optional(),
  // Send on a held queued message: the server takes it from the queue and uses ITS text, attachments, references
  // and context instead of the ones above.
  pendingMessageId: z.string().min(1).max(100).optional(),
  queuedSinceSendIds: z.array(z.string().min(1).max(100)).max(100).optional(),
  seasonalPackId: z.string().max(40).optional(),
  context: z
    .object({
      source: z.enum([
        "home",
        "floating-assistant",
        "command-center",
        "faq",
        "character-chat",
        "character-editor",
        "persona-editor",
        "lorebook-editor",
        "preset-editor",
        "connection-editor",
        "agent-editor",
        "settings",
        "game-setup",
        "chat-error",
      ]),
      capability: z.enum(["explain", "recommend", "create", "edit", "repair", "navigate"]),
      query: z.string().max(500).optional(),
      resource: z
        .object({
          kind: z.enum([
            "character",
            "persona",
            "lorebook",
            "preset",
            "connection",
            "agent",
            "setting",
            "chat",
            "game",
          ]),
          id: z.string().min(1).max(200),
          label: z.string().max(200).optional(),
        })
        .optional(),
      relatedResources: z
        .array(
          z.object({
            kind: z.enum(["character", "persona", "lorebook", "preset", "connection", "agent"]),
            id: z.string().min(1).max(200),
            label: z.string().max(200).optional(),
          }),
        )
        .max(4)
        .optional(),
      field: z.string().min(1).max(200).optional(),
      fieldId: z.string().min(1).max(200).optional(),
      fieldDraft: z.object({ value: z.string().max(20_000), selection: z.string().max(4_000).optional() }).optional(),
      declinedFields: z
        .array(z.object({ entityId: z.string().min(1).max(200), fieldId: z.string().min(1).max(300) }))
        .max(50)
        .optional(),
      error: z.object({ message: z.string().min(1).max(2_000), code: z.string().max(200).optional() }).optional(),
      action: z.string().max(500).optional(),
      commandCenterResultId: z.string().min(1).max(256).optional(),
      activeChat: z
        .object({
          id: z.string().min(1).max(256),
          label: z.string().max(200).optional(),
          mode: z.string().max(32).optional(),
        })
        .optional(),
      settingsLocation: z
        .object({ tab: z.string().max(64).optional(), controlId: z.string().max(128).optional() })
        .optional(),
      asideAnswer: z
        .object({
          query: z.string().max(500),
          answer: z.string().max(4_000),
          tier: z.enum(["local", "remote"]),
          sources: z
            .array(z.object({ path: z.string().max(300), heading: z.string().max(300) }))
            .max(3)
            .optional(),
        })
        .optional(),
    })
    .optional(),
  attachments: z
    .array(
      z.object({
        type: z.string().min(1),
        data: z.string().min(1),
        name: z.string().optional(),
        filename: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  // `@` links from the composer: resolved once, beside this message (the ids are re-read server-side).
  references: z
    .array(
      z.object({
        kind: z.enum([
          "character",
          "persona",
          "lorebook",
          "lorebookEntry",
          "preset",
          "skill",
          "memory",
          "chat",
          "doc",
          "agent",
        ]),
        id: z.string().min(1).max(200),
        // A long record name or doc heading is cut, not a reason to refuse the whole message.
        label: z
          .string()
          .min(1)
          .transform((label) => label.slice(0, 200)),
        parentId: z.string().max(200).optional(),
      }),
    )
    .max(8)
    .optional()
    .default([]),
});

// A message queued while she works: the prompt's own shapes for what it carries.
export const mariWorkspacePendingCreateSchema = professorMariPromptSchema
  .pick({
    chatId: true,
    message: true,
    attachments: true,
    references: true,
    context: true,
  })
  .extend({ steer: z.boolean().optional() });

export const mariWorkspaceAbortSchema = z.object({
  // Stop from the composer names its chat: that chat's queue comes back to the user instead of staying held.
  chatId: z.string().min(1).optional(),
});

export const mariWorkspaceResetSchema = z.object({
  clearHistory: z.boolean().optional(),
  // F12: Dismiss only needs the last-error flag cleared; a stale client error (poll lag, another
  // tab) must not abort a run that is genuinely in flight.
  keepRun: z.boolean().optional(),
});

export const mariWorkspaceCliSchema = z.object({
  argv: z.array(z.string()).default([]),
  command: z.string().optional(),
  cwd: z.string().optional(),
  sessionId: z.string().optional(),
});

export const mariWorkspaceSkillCreateSchema = z.object({
  name: z.string().max(64).optional().nullable(),
  description: z.string().max(1024).optional().nullable(),
  fileName: z.string().max(240).optional().nullable(),
  content: z.string().min(1).max(200_000),
  enabled: z.boolean().optional(),
});

export const mariWorkspaceSkillUpdateSchema = z.object({
  name: z.string().max(64).optional().nullable(),
  description: z.string().max(1024).optional().nullable(),
  content: z.string().max(200_000).optional().nullable(),
  enabled: z.boolean().optional(),
});

export const mariWorkspaceApproveSchema = z.object({
  enable: z.boolean().optional(),
});

// #4931: per-row reject. Each row is the diffPreview index plus a {table,id,action} consistency
// tuple the server re-checks against plan.changes[index] before reverting.
export const mariWorkspaceRejectRowRowSchema = z.object({
  index: z.number().int().nonnegative(),
  table: z.string().min(1),
  id: z.string().min(1),
  action: z.enum(["insert", "update", "replace", "delete"]),
});

export const mariWorkspaceRejectRowsSchema = z.object({
  rows: z.array(mariWorkspaceRejectRowRowSchema).min(1),
});

// #4931: synthetic Peek-Prompt render of one reviewed character/preset row (same identity tuple).
export const mariWorkspaceRenderPromptSchema = mariWorkspaceRejectRowRowSchema;

// #5725 Permissions Mode. A dedicated validated route owns the setting (the
// docs-language pattern) - it is deliberately NOT in app-settings ALLOWED_KEYS,
// so nothing can write junk the per-run reader would have to distrust.
export const mariWorkspacePermissionsModeSchema = z.object({
  // mode null + chatId clears that chat's override back to the default.
  mode: z.enum(MARI_PERMISSIONS_MODES).nullable(),
  chatId: z.string().min(1).optional(),
});

// Professor Mari's runtime ("classic" or "pi"): the same validated-route pattern, global only.
export const mariWorkspaceRuntimeSchema = z.object({ runtime: z.enum(MARI_RUNTIMES) });
export const mariWorkspaceSkillGateSchema = z.object({ enabled: z.boolean() });
