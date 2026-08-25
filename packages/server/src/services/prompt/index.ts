// ──────────────────────────────────────────────
// Prompt Service — Public exports
// ──────────────────────────────────────────────
export {
  assemblePrompt,
  appendFallbackChatSummaryToSystemPrompt,
  resolveChoiceVariableValue,
  type AssemblerInput,
  type AssemblerOutput,
  type ChoiceOptionValue,
} from "./assembler.js";
export { wrapContent, wrapGroup } from "./format-engine.js";
export { expandMarker, type MarkerContext, type ExpandedMarker } from "./marker-expander.js";
export {
  buildPromptMacroContext,
  cloneMacroContextForPreview,
  resolveMacrosForPreview,
  normalizeChatMacroVariables,
  collectCharacterAdvancedPromptEntries,
  collectCharacterDepthPromptEntries,
  collectCharacterPostHistoryEntries,
  resolvePromptMessageMacros,
  scopePromptMacroContextToCharacter,
  resolveCharacterAdvancedPromptIds,
  resolvePromptIdleDuration,
  resolvePromptLastGenerationType,
  resolveMacrosWithVariableSnapshot,
  setLorebookEntryCounts,
  resolveCharacterMacroData,
  type CharacterMacroData,
  type MacroResolutionTransaction,
  type PromptMacroActivityMessage,
  type PromptMacroMessage,
  type PromptDepthEntry,
} from "./macro-context.js";
export { mergeAdjacentMessages, squashLeadingSystemMessages } from "./merger.js";
