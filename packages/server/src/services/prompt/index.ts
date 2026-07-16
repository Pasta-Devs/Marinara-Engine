// ──────────────────────────────────────────────
// Prompt Service — Public exports
// ──────────────────────────────────────────────
export { assemblePrompt, type AssemblerInput, type AssemblerOutput } from "./assembler.js";
export { wrapContent, wrapGroup } from "./format-engine.js";
export { expandMarker, type MarkerContext, type ExpandedMarker } from "./marker-expander.js";
export {
  buildPromptMacroContext,
  collectCharacterAdvancedPromptEntries,
  collectCharacterDepthPromptEntries,
  collectCharacterPostHistoryEntries,
  resolvePromptMessageMacros,
  scopePromptMacroContextToCharacter,
  resolveCharacterAdvancedPromptIds,
  resolvePromptIdleDuration,
  resolvePromptLastGenerationType,
  resolveMacrosWithVariableSnapshot,
  resolveCharacterMacroData,
  type CharacterMacroData,
  type MacroResolutionTransaction,
  type PromptMacroActivityMessage,
  type PromptMacroMessage,
  type PromptDepthEntry,
} from "./macro-context.js";
export { mergeAdjacentMessages, squashLeadingSystemMessages } from "./merger.js";
