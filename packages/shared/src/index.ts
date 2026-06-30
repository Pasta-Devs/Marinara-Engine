// ──────────────────────────────────────────────
// @marinara-engine/shared — Public API
// ──────────────────────────────────────────────

// Types
export * from "./types/tts.js";
export * from "./types/chat.js";
export * from "./types/character.js";
export * from "./types/lorebook.js";
export * from "./types/prompt.js";
export * from "./types/connection.js";
export * from "./types/agent.js";
export * from "./types/game-state.js";
export * from "./types/combat-encounter.js";
export * from "./types/scene.js";
export * from "./types/vn.js";
export * from "./types/persona.js";
export * from "./types/regex.js";
export * from "./types/export.js";
export * from "./types/haptic.js";
export * from "./types/theme.js";
export * from "./types/extension.js";
export * from "./types/chat-preset.js";
export * from "./types/game.js";
export * from "./types/sidecar.js";
export * from "./types/image-generation-defaults.js";
export * from "./types/image-style-profile.js";
export * from "./types/professor-mari-workspace.js";
export * from "./types/achievement.js";

// Schemas
export * from "./schemas/chat.schema.js";
export * from "./schemas/chat-preset.schema.js";
export * from "./schemas/character.schema.js";
export * from "./schemas/lorebook.schema.js";
export * from "./schemas/prompt.schema.js";
export * from "./schemas/connection.schema.js";
export * from "./schemas/agent.schema.js";
export * from "./schemas/custom-tool.schema.js";
export * from "./schemas/regex.schema.js";
export * from "./schemas/custom-emoji.schema.js";
export * from "./schemas/custom-sticker.schema.js";
export * from "./schemas/theme.schema.js";
export * from "./schemas/extension.schema.js";
export * from "./schemas/app-settings.schema.js";

// Constants
export * from "./constants/providers.js";
export * from "./constants/defaults.js";
export * from "./constants/chat-modes.js";
export * from "./constants/chat-mode-capabilities.js";
export * from "./constants/model-lists.js"; // also exports IMAGE_GENERATION_SOURCES
export * from "./constants/agent-prompts.js";
export * from "./constants/agent-activation.js";
export * from "./constants/impersonate.js";
export * from "./constants/image-generation-defaults.js";
export * from "./constants/image-style-profiles.js";
export * from "./constants/security.js";
export * from "./constants/game-assets.js";
export * from "./constants/conversation-prompt.js";
export * from "./constants/game-prompt.js";
export * from "./constants/achievements.js";

// Feature registries
export * from "./features/agents/agent-manifest.types.js";
export * from "./features/agents/agent-registry.js";
export * from "./features/function-calls/tool-definitions.js";
export * from "./features/folder-packages/manifest-package.js";

// Turn-game framework (UNO and future turn-based games)
export * from "./features/turn-games/engine.types.js";
export * from "./features/turn-games/registry.js";
export * from "./features/turn-games/uno/types.js";
export * from "./features/turn-games/uno/tools.js";
export { unoEngine, cardLabel } from "./features/turn-games/uno/engine.js";

// Utils
export * from "./utils/macro-engine.js";
export * from "./utils/xml-wrapper.js";
export * from "./utils/music-score.js";
export * from "./utils/agent-cost.js";
export * from "./utils/regex-replacement.js";
export * from "./utils/skill-check-format.js";
export * from "./utils/generation-guide.js";
export * from "./utils/lorebook-keyword-matching.js";
export * from "./utils/regex-safety.js";
export * from "./utils/game-state-text.js";
export * from "./utils/custom-tracker-fields.js";
export * from "./utils/tracker-field-locks.js";
export * from "./utils/chat-summary-entries.js";
export * from "./utils/quest-state.js";
export * from "./utils/quote-format.js";
export * from "./utils/image-prompt-compiler.js";
export * from "./utils/thinking-tags.js";
export * from "./utils/rpg-stats.js";
export * from "./utils/lorebook-folder-tree.js";
export * from "./utils/text-matching.js";
export * from "./utils/sprite-labels.js";
export * from "./utils/conversation-presence.js";
