// ──────────────────────────────────────────────
// "Show me" for a feature finder entry (lib/feature-finder.ts): runs the entry's first step
// (start a roleplay on Use a Profile, open a Library page or a setting, a chat tool) or opens
// its guide. Used by the "Coming from SillyTavern" guide's Show me links.
// ──────────────────────────────────────────────
import { useCallback } from "react";
import { featureShowStep, findFeature, type FeatureStep } from "../lib/feature-finder";
import { requestChatPeekPrompt, requestChatSettingsSectionOpen } from "../lib/chat-floating-ui-events";
import { executeStateNavigation } from "../lib/state-navigation";
import { useChatStore } from "../stores/chat.store";
import { useUIStore } from "../stores/ui.store";
import { useStartNewChatMode } from "./use-start-new-chat-mode";

/** Runs one feature step. False when it can't run here (a chat tool with no chat open). */
export function useRunFeatureStep() {
  const startNewChatMode = useStartNewChatMode();
  return useCallback(
    (step: FeatureStep): boolean => {
      const chatId = useChatStore.getState().activeChatId;
      switch (step.kind) {
        case "docs":
          useUIStore.getState().openModal("docs-viewer", { initialDoc: step.path });
          return true;
        case "start-chat":
          if (step.profile) useChatStore.getState().setShouldOpenWizardInShortcutMode(true);
          void startNewChatMode(step.mode).catch(() => undefined);
          return true;
        case "target":
          return executeStateNavigation(step.target);
        case "chat-tool":
          if (!chatId) return false;
          if (step.tool === "peek-prompt") requestChatPeekPrompt(chatId);
          else requestChatSettingsSectionOpen(chatId, step.tool);
          return true;
      }
    },
    [startNewChatMode],
  );
}

export function useFeatureShow() {
  const runStep = useRunFeatureStep();
  return useCallback(
    (featureId: string): boolean => {
      const feature = findFeature(featureId);
      if (!feature) return false;
      const chatId = useChatStore.getState().activeChatId;
      return runStep(featureShowStep(feature, !!chatId));
    },
    [runStep],
  );
}
