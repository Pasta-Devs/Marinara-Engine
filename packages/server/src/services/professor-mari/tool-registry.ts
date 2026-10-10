// ──────────────────────────────────────────────
// Professor Mari workspace tool registry
// Single source of truth for the workspace tools: static properties
// (kind, verification, metadata) and the full app_data action table.
// Behavioral classification of a command (isReadOnlyWorkspaceCommand /
// isMutatingWorkspaceCommand) stays in workspace-agent.service.ts, but it
// delegates to this registry instead of inline arrays and regexes.
// ──────────────────────────────────────────────
import type { MariWorkspaceToolName } from "@marinara-engine/shared";
import type { LLMToolDefinition } from "../llm/base-provider.js";

/** Behavioral kind for a workspace tool at the tool level. */
export type WorkspaceToolKind =
  | "read" // docs_search, docs_read, read, grep, find, ls
  | "mutate" // edit, write, copy, move, remove
  | "shell" // bash (mutation is per-command, not per-tool)
  | "data" // app_data (action-level kind drives behavior)
  | "meta"; // dependency, package_service

/** Action-level kind for app_data actions. */
export type AppDataActionKind = "data-read" | "data-write";

export interface ToolDef {
  /** Unique tool identifier, matches the `name` in the JSON command envelope. */
  name: MariWorkspaceToolName;
  /** One-line summary for the compact tool inventory. */
  summary: string;
  /** Full description sent to the model (identical to current inline descriptions). */
  description: string;
  /** Behavioral kind. Drives classification and verification. */
  kind: WorkspaceToolKind;
  /** JSON schema for the tool's parameters. */
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** True if the tool's result confirms its own effect. */
  selfVerifying: boolean;
  /** The tool or action that verifies this tool's effect. Null if selfVerifying. */
  verifyWith: string | null;
  /** True if calling the tool multiple times with the same args produces the same result. */
  idempotent: boolean;
  /** Prerequisites that must be true before calling. Empty array = none. */
  prerequisites: string[];
  /** Usage notes, common mistakes, edge cases. */
  notes: string[];
}

export interface AppDataActionDef {
  /** Action name (e.g., "character.create"). */
  action: string;
  /** Whether this action reads or writes. */
  kind: AppDataActionKind;
  /** All data-write actions are self-verifying. data-read actions are not. */
  selfVerifying: boolean;
  /** The read action that confirms this write. Required for data-write. */
  verifyWith: string | null;
  /** True if calling this action multiple times with the same args is safe. */
  idempotent: boolean;
  /** Prerequisites (e.g., "valid characterId"). */
  prerequisites: string[];
  /** Validation rules for write actions (e.g., allowed enum values). */
  validation: string[];
  /** One-line description of what the action does. */
  description: string;
}

export type WorkspaceToolDefinition = {
  name: MariWorkspaceToolName;
  description: string;
  parameters: Record<string, unknown>;
};

// ── app_data action table (78 actions) ───────────────────────────

export const APP_DATA_ACTIONS: Record<string, AppDataActionDef> = {
  // ── decision (2) ─────────────────────────────────────────────
  "decision.get": {
    action: "decision.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description:
      "Read the per-category decision-authoring state (authoring / setupReminder / cachePlacement) with its active flag.",
  },
  "decision.record": {
    action: "decision.record",
    kind: "data-write",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [
      "category: authoring|setupReminder|cachePlacement",
      "answer: pending|allow|decline|suppress",
      "source: user|memory|skill",
      "scope: turn|chat (setupReminder always chat); suppress only for setupReminder",
    ],
    description:
      "Record a decision-authoring interaction (the user's answer to an authoring/setupReminder/cachePlacement question). Bookkeeping: non-mutating, no read-back — preserved from v2.5.0.",
  },

  // ── chat (4) ──────────────────────────────────────────────────
  "chat.list": {
    action: "chat.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List all chats.",
  },
  "chat.get": {
    action: "chat.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid chatId"],
    validation: [],
    description: "Read one chat by ID.",
  },
  "chat.messages": {
    action: "chat.messages",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid chatId"],
    validation: [],
    description: "Read messages from a chat. Supports offset, limit, last, afterPost, tail.",
  },
  "chat.search": {
    action: "chat.search",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "Search chats by text.",
  },

  // ── character (7) ─────────────────────────────────────────────
  "character.list": {
    action: "character.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List all characters.",
  },
  "character.get": {
    action: "character.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid characterId"],
    validation: [],
    description: "Read one character by ID. Oversized fields elided; re-read with field=path.",
  },
  "character.search": {
    action: "character.search",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "Search characters by name/text.",
  },
  "character.create": {
    action: "character.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "character.get",
    idempotent: false,
    prerequisites: [],
    validation: ["name is required", "characterVersion optional"],
    description: "Create a new character card.",
  },
  "character.update": {
    action: "character.update",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "character.get",
    idempotent: false,
    prerequisites: ["valid characterId"],
    validation: ["patch fields only; omitted fields unchanged"],
    description: "Patch a character card. Use patch for partial updates.",
  },
  "character.folder.list": {
    action: "character.folder.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List character folders.",
  },
  "character.moveToFolder": {
    action: "character.moveToFolder",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "character.get",
    idempotent: true,
    prerequisites: ["valid characterId", "valid folderId or null"],
    validation: ["folderId: existing folder ID or null for root"],
    description: "Move a character into or out of a folder.",
  },

  // ── persona (5) ───────────────────────────────────────────────
  "persona.list": {
    action: "persona.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List all personas.",
  },
  "persona.get": {
    action: "persona.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid personaId"],
    validation: [],
    description: "Read one persona by ID.",
  },
  "persona.search": {
    action: "persona.search",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "Search personas by name/text.",
  },
  "persona.create": {
    action: "persona.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "persona.get",
    idempotent: false,
    prerequisites: [],
    validation: ["name is required"],
    description: "Create a new persona.",
  },
  "persona.update": {
    action: "persona.update",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "persona.get",
    idempotent: false,
    prerequisites: ["valid personaId"],
    validation: ["patch fields only; omitted fields unchanged"],
    description: "Patch a persona. Use patch for partial updates.",
  },

  // ── lorebook (14) ─────────────────────────────────────────────
  "lorebook.list": {
    action: "lorebook.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List all lorebooks.",
  },
  "lorebook.get": {
    action: "lorebook.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid lorebookId"],
    validation: [],
    description: "Read one lorebook by ID.",
  },
  "lorebook.entries": {
    action: "lorebook.entries",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid lorebookId"],
    validation: [],
    description: "List entry summaries for a lorebook. Full bodies require lorebook.getEntry.",
  },
  "lorebook.getEntry": {
    action: "lorebook.getEntry",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid lorebookId", "valid entryId"],
    validation: [],
    description: "Read one complete lorebook entry by ID.",
  },
  "lorebook.search": {
    action: "lorebook.search",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "Search lorebooks by name/text.",
  },
  "lorebook.create": {
    action: "lorebook.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "lorebook.get",
    idempotent: false,
    prerequisites: [],
    validation: ["name is required", "entries: array of {name, content, keys, ...}"],
    description: "Create a new lorebook, optionally with entries.",
  },
  "lorebook.update": {
    action: "lorebook.update",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "lorebook.get",
    idempotent: false,
    prerequisites: ["valid lorebookId"],
    validation: ["patch fields only"],
    description: "Patch a lorebook (name, description, tuning, tags, links).",
  },
  "lorebook.addEntry": {
    action: "lorebook.addEntry",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "lorebook.getEntry",
    idempotent: false,
    prerequisites: ["valid lorebookId"],
    validation: ["entry requires name, content, keys"],
    description: "Add a new entry to a lorebook.",
  },
  "lorebook.updateEntry": {
    action: "lorebook.updateEntry",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "lorebook.getEntry",
    idempotent: false,
    prerequisites: ["valid lorebookId", "valid entryId"],
    validation: ["patch entry fields only"],
    description: "Patch an existing lorebook entry.",
  },
  "lorebook.deleteEntry": {
    action: "lorebook.deleteEntry",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "lorebook.entries",
    idempotent: true,
    prerequisites: ["valid lorebookId", "valid entryId"],
    validation: [],
    description: "Delete an entry from a lorebook.",
  },
  "lorebook.folder.list": {
    action: "lorebook.folder.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid lorebookId"],
    validation: [],
    description: "List entry folders inside a lorebook.",
  },
  "lorebook.folder.create": {
    action: "lorebook.folder.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "lorebook.folder.list",
    idempotent: false,
    prerequisites: ["valid lorebookId"],
    validation: ["folderName is required"],
    description: "Create an entry folder inside a lorebook.",
  },
  "lorebook.libraryFolder.list": {
    action: "lorebook.libraryFolder.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List Lorebooks-panel library folders.",
  },
  "lorebook.libraryFolder.create": {
    action: "lorebook.libraryFolder.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "lorebook.libraryFolder.list",
    idempotent: false,
    prerequisites: [],
    validation: ["folderName is required"],
    description: "Create a Lorebooks-panel library folder.",
  },

  // ── theme (6) ─────────────────────────────────────────────────
  "theme.list": {
    action: "theme.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List all themes.",
  },
  "theme.active": {
    action: "theme.active",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "Read the currently active theme ID.",
  },
  "theme.get": {
    action: "theme.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid themeId"],
    validation: [],
    description: "Read one theme by ID.",
  },
  "theme.create": {
    action: "theme.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "theme.get",
    idempotent: false,
    prerequisites: [],
    validation: ["name is required"],
    description: "Create a new custom theme.",
  },
  "theme.update": {
    action: "theme.update",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "theme.get",
    idempotent: false,
    prerequisites: ["valid themeId"],
    validation: ["patch theme fields only"],
    description: "Patch a theme (name, description, colors, etc.).",
  },
  "theme.setActive": {
    action: "theme.setActive",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "theme.active",
    idempotent: true,
    prerequisites: ["valid themeId"],
    validation: [],
    description: "Set a theme as the active theme.",
  },

  // ── personal_extension (5) ────────────────────────────────────
  "personal_extension.list": {
    action: "personal_extension.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List all Personal Extension drafts.",
  },
  "personal_extension.get": {
    action: "personal_extension.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid extensionId"],
    validation: [],
    description: "Read one Personal Extension draft by ID.",
  },
  "personal_extension.search": {
    action: "personal_extension.search",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "Search Personal Extension drafts.",
  },
  "personal_extension.create": {
    action: "personal_extension.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "personal_extension.get",
    idempotent: false,
    prerequisites: [],
    validation: ["name is required", "css/js/serverJs: code strings", "runtime: client|server"],
    description: "Create a new Personal Extension draft. Code is disabled and approval cleared.",
  },
  "personal_extension.update": {
    action: "personal_extension.update",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "personal_extension.get",
    idempotent: false,
    prerequisites: ["valid extensionId"],
    validation: ["patch fields only", "changed code clears approval"],
    description: "Patch a Personal Extension draft. Changed code is disabled and approval cleared.",
  },

  // ── agent (5) ─────────────────────────────────────────────────
  "agent.list": {
    action: "agent.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List all agent configs.",
  },
  "agent.get": {
    action: "agent.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid agentId"],
    validation: [],
    description: "Read one agent config by ID.",
  },
  "agent.search": {
    action: "agent.search",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "Search agent configs.",
  },
  "agent.create": {
    action: "agent.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "agent.get",
    idempotent: false,
    prerequisites: [],
    validation: ["phase must be pre_generation|parallel|post_processing"],
    description: "Create a new agent config.",
  },
  "agent.update": {
    action: "agent.update",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "agent.get",
    idempotent: false,
    prerequisites: ["valid agentId"],
    validation: ["phase must be pre_generation|parallel|post_processing"],
    description: "Patch an agent config.",
  },

  // ── preset (20) ───────────────────────────────────────────────
  "preset.list": {
    action: "preset.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List all presets.",
  },
  "preset.get": {
    action: "preset.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid presetId"],
    validation: [],
    description: "Read one preset by ID (includes groups, sections, choiceBlocks).",
  },
  "preset.search": {
    action: "preset.search",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "Search presets by name/text.",
  },
  "preset.create": {
    action: "preset.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.get",
    idempotent: false,
    prerequisites: [],
    validation: ["name is required", "groups/sections/choiceBlocks: arrays"],
    description: "Create a new preset with groups, sections, and choice blocks.",
  },
  "preset.update": {
    action: "preset.update",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.get",
    idempotent: false,
    prerequisites: ["valid presetId"],
    validation: ["patch fields only"],
    description: "Patch a preset (name, description, or full groups/sections/choiceBlocks).",
  },
  "preset.sections": {
    action: "preset.sections",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid presetId"],
    validation: [],
    description: "List sections in a preset.",
  },
  "preset.getSection": {
    action: "preset.getSection",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid presetId", "valid sectionId"],
    validation: [],
    description: "Read one preset section by ID.",
  },
  "preset.groups": {
    action: "preset.groups",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid presetId"],
    validation: [],
    description: "List groups in a preset.",
  },
  "preset.getGroup": {
    action: "preset.getGroup",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid presetId", "valid groupId"],
    validation: [],
    description: "Read one preset group by ID.",
  },
  "preset.choiceBlocks": {
    action: "preset.choiceBlocks",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid presetId"],
    validation: [],
    description: "List choice blocks in a preset.",
  },
  "preset.getChoiceBlock": {
    action: "preset.getChoiceBlock",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid presetId", "valid blockId"],
    validation: [],
    description: "Read one preset choice block by ID.",
  },
  "preset.addSection": {
    action: "preset.addSection",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.sections",
    idempotent: false,
    prerequisites: ["valid presetId"],
    validation: ["section requires name, content"],
    description: "Add a new section to a preset.",
  },
  "preset.updateSection": {
    action: "preset.updateSection",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.getSection",
    idempotent: false,
    prerequisites: ["valid presetId", "valid sectionId"],
    validation: ["patch section fields only"],
    description: "Patch a preset section.",
  },
  "preset.deleteSection": {
    action: "preset.deleteSection",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.sections",
    idempotent: true,
    prerequisites: ["valid presetId", "valid sectionId"],
    validation: [],
    description: "Delete a section from a preset.",
  },
  "preset.addGroup": {
    action: "preset.addGroup",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.groups",
    idempotent: false,
    prerequisites: ["valid presetId"],
    validation: ["group requires name"],
    description: "Add a new group to a preset.",
  },
  "preset.updateGroup": {
    action: "preset.updateGroup",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.getGroup",
    idempotent: false,
    prerequisites: ["valid presetId", "valid groupId"],
    validation: ["patch group fields only"],
    description: "Patch a preset group.",
  },
  "preset.deleteGroup": {
    action: "preset.deleteGroup",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.groups",
    idempotent: true,
    prerequisites: ["valid presetId", "valid groupId"],
    validation: [],
    description: "Delete a group from a preset.",
  },
  "preset.addChoiceBlock": {
    action: "preset.addChoiceBlock",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.choiceBlocks",
    idempotent: false,
    prerequisites: ["valid presetId"],
    validation: ["block requires name, options"],
    description: "Add a new choice block to a preset.",
  },
  "preset.updateChoiceBlock": {
    action: "preset.updateChoiceBlock",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.getChoiceBlock",
    idempotent: false,
    prerequisites: ["valid presetId", "valid blockId"],
    validation: ["patch block fields only"],
    description: "Patch a preset choice block.",
  },
  "preset.deleteChoiceBlock": {
    action: "preset.deleteChoiceBlock",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "preset.choiceBlocks",
    idempotent: true,
    prerequisites: ["valid presetId", "valid blockId"],
    validation: [],
    description: "Delete a choice block from a preset.",
  },

  // ── home_widget (5) ───────────────────────────────────────────
  "home_widget.list": {
    action: "home_widget.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List all safe data-only Home widgets.",
  },
  "home_widget.get": {
    action: "home_widget.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: ["valid widgetId"],
    validation: [],
    description: "Read one Home widget by ID.",
  },
  "home_widget.create": {
    action: "home_widget.create",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "home_widget.get",
    idempotent: false,
    prerequisites: [],
    validation: ["title is required", "accent: cyan|orange|pink|violet", "icon: sparkles|note|heart|star|book|compass"],
    description: "Create a new safe data-only Home widget.",
  },
  "home_widget.update": {
    action: "home_widget.update",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "home_widget.get",
    idempotent: false,
    prerequisites: ["valid widgetId"],
    validation: ["patch widget fields only"],
    description: "Patch a Home widget.",
  },
  "home_widget.delete": {
    action: "home_widget.delete",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "home_widget.list",
    idempotent: true,
    prerequisites: ["valid widgetId"],
    validation: [],
    description: "Delete a Home widget.",
  },

  // ── instruction (5) ───────────────────────────────────────────
  "instruction.list": {
    action: "instruction.list",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "List stored instructions (memories).",
  },
  "instruction.get": {
    action: "instruction.get",
    kind: "data-read",
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    validation: [],
    description: "Read a stored instruction.",
  },
  "instruction.remember": {
    action: "instruction.remember",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "instruction.get",
    idempotent: false,
    prerequisites: [],
    validation: ["content is required"],
    description: "Store a new instruction/memory.",
  },
  "instruction.update": {
    action: "instruction.update",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "instruction.get",
    idempotent: false,
    prerequisites: ["valid instruction identity"],
    validation: [],
    description: "Update a stored instruction.",
  },
  "instruction.forget": {
    action: "instruction.forget",
    kind: "data-write",
    selfVerifying: true,
    verifyWith: "instruction.list",
    idempotent: true,
    prerequisites: ["valid instruction identity"],
    validation: [],
    description: "Delete a stored instruction/memory.",
  },
};

export const PROFESSOR_MARI_APP_DATA_ACTIONS: readonly string[] = Object.freeze(Object.keys(APP_DATA_ACTIONS));

// ── tool definitions (16 tools; descriptions verbatim) ──────────

export const TOOLS: ToolDef[] = [
  {
    name: "docs_search",
    summary: "Search Marinara's local documentation.",
    description:
      "Search Marinara's canonical local README and English documentation. Use this first for user-facing feature, configuration, installation, and troubleshooting questions. Results include the source path, heading, line, and a bounded excerpt.",
    kind: "read",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 2, maxLength: 200 },
        limit: { type: "integer", minimum: 1, maximum: 8 },
      },
      required: ["query"],
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    notes: [],
  },
  {
    name: "docs_read",
    summary: "Read a canonical documentation file or heading.",
    description:
      "Read a canonical local documentation file or one exact heading with bounded output. Paths must be README.md or English Markdown files under docs/. Cite the returned path and heading in the answer.",
    kind: "read",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        heading: { type: "string" },
        maxChars: { type: "integer", minimum: 1000, maximum: 16000 },
      },
      required: ["path"],
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    notes: [],
  },
  {
    name: "read",
    summary: "Read a workspace file.",
    description: "Read a text file from the workspace with optional 1-indexed line offset and line limit.",
    kind: "read",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        offset: { type: "integer", minimum: 1 },
        limit: { type: "integer", minimum: 1 },
      },
      required: ["path"],
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    notes: [],
  },
  {
    name: "grep",
    summary: "Search workspace files for a pattern.",
    description: "Search workspace text files for a regex or literal pattern.",
    kind: "read",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string" },
        glob: { type: "string" },
        ignoreCase: { type: "boolean" },
        literal: { type: "boolean" },
        context: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1 },
      },
      required: ["pattern"],
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    notes: [],
  },
  {
    name: "find",
    summary: "Find workspace files by glob pattern.",
    description: "Find workspace files by glob-style pattern.",
    kind: "read",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string" },
        limit: { type: "integer", minimum: 1 },
      },
      required: ["pattern"],
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    notes: [],
  },
  {
    name: "ls",
    summary: "List a workspace directory.",
    description: "List a workspace directory.",
    kind: "read",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        limit: { type: "integer", minimum: 1 },
      },
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    notes: [],
  },
  {
    name: "edit",
    summary: "Edit a file with exact oldText/newText replacements.",
    description: "Edit a single text file using exact, unique oldText/newText replacements.",
    kind: "mutate",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        reason: { type: "string" },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: { oldText: { type: "string" }, newText: { type: "string" } },
            required: ["oldText", "newText"],
          },
        },
      },
      required: ["path", "edits"],
    },
    selfVerifying: false,
    verifyWith: "read",
    idempotent: false,
    prerequisites: [],
    notes: [],
  },
  {
    name: "write",
    summary: "Create or overwrite a workspace file.",
    description: "Create or overwrite a workspace text file. Parent directories are created automatically.",
    kind: "mutate",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" }, reason: { type: "string" } },
      required: ["path", "content"],
    },
    selfVerifying: false,
    verifyWith: "read",
    idempotent: true,
    prerequisites: [],
    notes: [],
  },
  {
    name: "copy",
    summary: "Copy one workspace file.",
    description: "Copy one ordinary workspace file without overwriting an existing destination.",
    kind: "mutate",
    parameters: {
      type: "object",
      properties: { source: { type: "string" }, destination: { type: "string" } },
      required: ["source", "destination"],
    },
    selfVerifying: false,
    verifyWith: "read",
    idempotent: false,
    prerequisites: [],
    notes: [],
  },
  {
    name: "move",
    summary: "Move one workspace file.",
    description: "Move one ordinary workspace file without overwriting an existing destination.",
    kind: "mutate",
    parameters: {
      type: "object",
      properties: { source: { type: "string" }, destination: { type: "string" } },
      required: ["source", "destination"],
    },
    selfVerifying: false,
    verifyWith: "ls",
    idempotent: false,
    prerequisites: [],
    notes: [],
  },
  {
    name: "remove",
    summary: "Delete a file or empty directory.",
    description: "Delete one ordinary workspace file or one empty directory.",
    kind: "mutate",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    selfVerifying: false,
    verifyWith: "ls",
    idempotent: true,
    prerequisites: [],
    notes: [],
  },
  {
    name: "bash",
    summary: "Run a shell command in an OS sandbox.",
    description:
      "Run a simple shell command in an OS sandbox with network access denied and filesystem writes confined to the workspace. Prefer structured tools.",
    kind: "shell",
    parameters: {
      type: "object",
      properties: { command: { type: "string" }, timeout: { type: "integer", minimum: 1, maximum: 300 } },
      required: ["command"],
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: false,
    prerequisites: [],
    notes: ["Mutation is per-command, detected at runtime (bashLooksMutating), not per-tool."],
  },
  {
    name: "dependency",
    summary: "Request an npm dependency for user approval.",
    description:
      "Request an exact public npm dependency for Marinara. Nothing is installed until the user approves the resolved version and integrity.",
    kind: "meta",
    parameters: {
      type: "object",
      properties: {
        packageName: { type: "string" },
        version: { type: "string", description: "Exact semver, or latest to resolve an exact version." },
        target: { type: "string", enum: ["root", "client", "server", "shared"] },
        dev: { type: "boolean" },
        reason: { type: "string" },
      },
      required: ["packageName", "target"],
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    notes: ["Install happens only after user approval, outside the command loop."],
  },
  {
    name: "app_data",
    summary: "Read or change live app data via structured actions.",
    description:
      'Read or change live app data through structured actions, without shell commands. Use this for chats, characters, character folders, personas, lorebooks, lorebook entries, entry folders inside a lorebook, Lorebooks-panel library folders, themes, Personal Extension drafts, agents, prompt presets, and safe data-only Home widgets. lorebook.entries returns entry summaries; call lorebook.getEntry with entryId to read one complete entry body. Single-item reads (e.g. character.get) are size-bounded: oversized fields come back elided with a note naming each one — re-read any elided field in full by passing field="<path>" (e.g. field="data.alternate_greetings[0]"), optionally with offset to page through a long value. Skills are not app_data actions: the skill index is already in your context (<skill_library>) and the `skill` tool loads one skill by id.',
    kind: "data",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: PROFESSOR_MARI_APP_DATA_ACTIONS,
        },
        id: { type: "string" },
        chatId: { type: "string" },
        characterId: { type: "string" },
        folderId: { type: "string" },
        folderName: { type: "string" },
        parentFolderId: { type: "string" },
        personaId: { type: "string" },
        lorebookId: { type: "string" },
        entryId: { type: "string" },
        agentId: { type: "string" },
        presetId: { type: "string" },
        widgetId: { type: "string" },
        extensionId: { type: "string" },
        query: { type: "string" },
        limit: { type: "integer", minimum: 1 },
        last: { type: "integer", minimum: 1, maximum: 200 },
        afterPost: { type: "integer", minimum: 0 },
        tail: { type: "boolean" },
        field: {
          type: "string",
          description:
            'Dotted/indexed path of a single field to read in full from a get result, e.g. "data.alternate_greetings[0]". Use the paths named in an elision note.',
        },
        offset: {
          type: "integer",
          minimum: 0,
          description: "Start item offset for chat.messages, or character offset when paging through a field= read.",
        },
        name: { type: "string" },
        version: { type: "string" },
        description: { type: "string" },
        runtime: { type: "string", enum: ["client", "server"] },
        capabilities: {
          type: "array",
          items: { type: "string", enum: ["read_active_characters", "read_active_persona"] },
          description:
            "Optional Browser Extension data permissions. Request only what the extension needs. Server Extensions cannot request these capabilities.",
        },
        css: { type: "string" },
        js: { type: "string" },
        serverJs: { type: "string" },
        activate: { type: "boolean" },
        apply: {
          type: "boolean",
          description:
            "Set true for a requested change so it is saved or staged for review. False is an invisible preview: it saves nothing and creates no review card. Updates and deletes preview unless explicitly true.",
        },
        reason: { type: "string" },
        data: {
          type: "object",
          description:
            "Entity fields. For character/persona cards: description is a brief identity overview, personality is behavioral traits and mannerisms, backstory is the character's substantive history, and appearance is physical features/clothing. Keep those fields distinct. character.create accepts name, description, personality, scenario, firstMes/firstMessage, mesExample, creatorNotes, backstory, appearance, aboutMe, systemPrompt, postHistoryInstructions, tags, alternateGreetings, creator, and characterVersion. persona.create accepts aboutMe too. lorebook.create accepts name, description, category, tags, book tuning (scanDepth, tokenBudget, entryLimit, recursive, maxRecursionDepth), and an entries array whose items contain name, content, description, keys, secondaryKeys, tag, constant, selective, selectiveLogic, matchWholeWords, caseSensitive, useRegex, position, depth, order, role, group, decisionStatement (plain statement), decisionMode (off/require/trigger), sticky, and cooldown. agent.create/update accepts promptTemplate and a settings object with activationQuestion (plain statement, max 500 chars; empty clears), activationThreshold (0.05–0.95), activationScanDepth, activationMaxSkip (1–100), runInterval (positive integer), activationKeywords; all these activation fields belong inside settings. decision.record accepts data.category (authoring/setupReminder/cachePlacement), answer (pending/allow/decline/suppress), source (user/memory/skill), sourceId (for Memory/Skill), quote (exact source body text), scope (turn/chat; default turn, setupReminder always chat). suppress is only for setupReminder. See the lorebook authoring guidance for what each entry field does. home_widget.create accepts title, description, accent (cyan, orange, pink, or violet), and icon (sparkles, note, heart, star, book, or compass).",
        },
        patch: {
          type: "object",
          description:
            "Partial update fields only. Omitted fields remain unchanged. For character/persona cards, never put requested backstory or appearance content into description: description is the brief identity overview, personality is behavioral traits and mannerisms, backstory is history, and appearance is physical features/clothing.",
        },
      },
      required: ["action"],
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: false,
    prerequisites: [],
    notes: [
      "Action-level kind drives behavior: see APP_DATA_ACTIONS (data-read vs data-write).",
      "Preview convention: apply=false previews and saves nothing.",
    ],
  },
  {
    name: "package_service",
    summary: "List or run installed package actions.",
    description:
      "List or run actions that installed Agent packages offer to Professor Mari. Call with no arguments to list every package's actions and their inputs, or with only package to list one package's actions. Add action and input to run one: the package validates input and may spend AI budget or change its data. Only run an action when the user asked for that change.",
    kind: "meta",
    parameters: {
      type: "object",
      properties: {
        package: { type: "string", description: "Package id from the list." },
        action: { type: "string", description: "Action name from the list. Omit to list." },
        input: { type: "object", description: "The action's inputs as named in the list." },
        reason: { type: "string" },
      },
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: false,
    prerequisites: [],
    notes: ["No action = list (read); action present = run (a change the Engine cannot preview/undo)."],
  },
  {
    name: "skill",
    summary: "Fetch the full content of a built-in or user-defined skill by ID.",
    description:
      "Retrieve the full instructions for a named skill from the skill library. Use the ID shown in the skill index. Returns the skill's title, description, and complete instructions as text.",
    kind: "meta",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Skill ID from the skill index (e.g. 'create-character')." },
      },
      required: ["id"],
    },
    selfVerifying: false,
    verifyWith: null,
    idempotent: true,
    prerequisites: [],
    notes: [
      "Returns the current (possibly user-edited) content. Built-in skills that have not been customized return the shipped default.",
    ],
  },
];

// ── derived exports (structurally identical to the former inline arrays) ──

export const WORKSPACE_TOOL_NAMES: MariWorkspaceToolName[] = TOOLS.map((tool) => tool.name);

export const WORKSPACE_TOOL_DEFINITIONS: WorkspaceToolDefinition[] = TOOLS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
}));

export const WORKSPACE_TEXTUAL_TOOL_DEFINITIONS: LLMToolDefinition[] = TOOLS.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

// ── lookups ─────────────────────────────────────────────────────

const toolByName = new Map<string, ToolDef>(TOOLS.map((tool) => [tool.name, tool]));

/** O(1) lookup by tool name. */
export function getTool(name: string): ToolDef | undefined {
  return toolByName.get(name);
}

/** O(1) lookup by app_data action name. */
export function getAppDataAction(action: string): AppDataActionDef | undefined {
  return APP_DATA_ACTIONS[action];
}

/** Check if an app_data action is a data-write (mutating). */
export function isAppDataWrite(action: unknown): boolean {
  if (typeof action !== "string") return false;
  return APP_DATA_ACTIONS[action]?.kind === "data-write";
}

/** Check if an app_data action is a data-read. */
export function isAppDataRead(action: unknown): boolean {
  if (typeof action !== "string") return false;
  return APP_DATA_ACTIONS[action]?.kind === "data-read";
}
