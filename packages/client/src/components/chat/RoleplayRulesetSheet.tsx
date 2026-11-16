// ──────────────────────────────────────────────
// Roleplay played by a ruleset: the member's sheet on screen
//
// Game Mode's own character sheet for the member Chat Settings or the tracker panel opened. It pulls in
// Game Mode's sheet, inventory and editor, so the chat's overlays load this file only while a sheet is
// open, and the Chat Settings side of the ruleset stays in RoleplayRuleset.tsx.
// ──────────────────────────────────────────────
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  normalizeCharacterLookupName,
  readRulesetSheetEnvelope,
  type RulesetLiveState,
  type RulesetSheetEnvelope,
} from "@marinara-engine/shared";
import { GameCharacterSheet, type GameCharacterSheetRuleset } from "../game/GameCharacterSheet";
import { findCard, readCards } from "./RoleplayRuleset";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { useGameRuleset } from "../../hooks/use-game-ruleset";
import { useGameStatePatcher } from "../../hooks/use-game-state-patcher";
import { useGameStateStore } from "../../stores/game-state.store";
import { useRoleplaySheetStore } from "../../stores/roleplay-sheet.store";

/** Game Mode's character sheet for the Roleplay member Chat Settings or the tracker panel opened. */
export function RoleplayRulesetSheet({ chatId, metadata }: { chatId: string; metadata: Record<string, unknown> }) {
  const { t: localizeUi } = useUiTranslation();
  const open = useRoleplaySheetStore((state) => state.open);
  const close = useRoleplaySheetStore((state) => state.close);
  const resolved = useGameRuleset(metadata);
  const updateChatMetadata = useUpdateChatMetadata();
  const { patchField } = useGameStatePatcher(chatId, "roleplay-ruleset-sheet");
  const gameState = useGameStateStore((state) => state.current);

  // Until the installed rulesets have loaded there is nothing to show; the sheet opens once they have.
  if (!open || open.chatId !== chatId || metadata.gameRuleset == null || resolved.status === "loading") return null;
  const card = findCard(metadata, open.name);
  if (!card) return null;
  const name = open.name;
  const key = normalizeCharacterLookupName(name);

  const saveEnvelope = async (next: RulesetSheetEnvelope) => {
    const current = readCards(metadata);
    const at = current.findIndex(
      (entry) => typeof entry.name === "string" && normalizeCharacterLookupName(entry.name) === key,
    );
    if (at < 0) {
      const message = localizeUi("game.ruleset.sheet.noCard", { name });
      toast.error(message);
      throw new Error(message);
    }
    await updateChatMetadata.mutateAsync({
      id: chatId,
      gameCharacterCards: current.map((entry, index) => (index === at ? { ...entry, rulesetSheet: next } : entry)),
    });
    toast.success(localizeUi("game.ruleset.sheet.saved", { name }));
  };

  const changeLive = (next: RulesetLiveState) => {
    // Read at click time: this turn's own sheet commands may have landed since the sheet rendered.
    const now = useGameStateStore.getState().current;
    if (now?.chatId !== chatId) {
      toast.error(localizeUi("game.ruleset.sheet.stateNotReady"));
      return;
    }
    const { [key]: _previous, ...others } = now.rulesetLive ?? {};
    patchField("rulesetLive", Object.keys(next).length > 0 ? { ...others, [key]: next } : others);
  };

  let ruleset: GameCharacterSheetRuleset | undefined;
  if (resolved.status === "unavailable") ruleset = { status: "unavailable" };
  else if (resolved.status === "ok") {
    const envelope = readRulesetSheetEnvelope(resolved.definition, card.rulesetSheet);
    ruleset =
      !envelope && card.rulesetSheet != null
        ? { status: "unreadable" }
        : {
            status: "ok",
            definition: resolved.definition,
            layers: resolved.layers,
            layerOptions: resolved.layerOptions,
            envelope: envelope ?? undefined,
            live: (gameState?.chatId === chatId ? gameState : null)?.rulesetLive?.[key],
            onLiveChange: changeLive,
            onEnvelopeSave: saveEnvelope,
            startEditing: open.build,
          };
  }

  // In a portal on the modal layer, as the app's dialogs are: Chat Settings and its popped-out
  // sections are floating windows, and the sheet is opened from them, so it has to stand above them.
  return createPortal(
    <div className="relative z-[10000]">
      <GameCharacterSheet
        key={`${chatId}:${key}`}
        card={{ title: name }}
        onClose={close}
        ruleset={ruleset}
        rulesetPinned
      />
    </div>,
    document.body,
  );
}
