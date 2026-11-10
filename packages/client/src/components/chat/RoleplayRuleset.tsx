// ──────────────────────────────────────────────
// Roleplay played by a ruleset: the picker in Chat Settings and the members' sheets
//
// A Roleplay chat can pin one of the installed Game Mode rulesets. The server copies each member's
// library sheet onto the chat's own cards (`gameCharacterCards`), and from then on the narrator asks
// for checks and keeps the sheets the way a game's Game Master does. This file is the chat's side of
// it: choosing the ruleset, the members and their sheets, and Game Mode's own character sheet to show
// one, with a sheet nobody has built yet opening in the ruleset's sheet builder.
// ──────────────────────────────────────────────
import { useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Dices, Hammer, ScrollText, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  readRulesetSheetEnvelope,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetSheetEnvelope,
} from "@marinara-engine/shared";
import { GameCharacterSheet, type GameCharacterSheetRuleset } from "../game/GameCharacterSheet";
import { useInstalledRulesets } from "../../hooks/use-capability-packages";
import { chatKeys, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useGameRuleset } from "../../hooks/use-game-ruleset";
import { useGameStatePatcher } from "../../hooks/use-game-state-patcher";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useGameStateStore } from "../../stores/game-state.store";
import { useRoleplaySheetStore } from "../../stores/roleplay-sheet.store";

interface StoredCard {
  name?: unknown;
  rulesetSheet?: unknown;
}

function readCards(metadata: Record<string, unknown>): StoredCard[] {
  return Array.isArray(metadata.gameCharacterCards) ? (metadata.gameCharacterCards as StoredCard[]) : [];
}

function findCard(metadata: Record<string, unknown>, name: string): StoredCard | undefined {
  const key = normalizeCharacterLookupName(name);
  return readCards(metadata).find(
    (card) => typeof card.name === "string" && normalizeCharacterLookupName(card.name) === key,
  );
}

/** The members whose sheets the player removed; pinning never gives them one again until put back. */
function declinedNames(metadata: Record<string, unknown>): string[] {
  const value = metadata.roleplaySheetsDeclined;
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === "string" && !!name.trim()) : [];
}

/** The chat's members with a sheet, in the order the sheets were made (the persona first). */
export function roleplaySheetNames(metadata: Record<string, unknown>): string[] {
  return readCards(metadata).flatMap((card) =>
    typeof card.name === "string" && card.name.trim() ? [card.name.trim()] : [],
  );
}

/** A sheet still exactly as the ruleset starts one: the member had no sheet in their library, so it
 *  is built here, in the ruleset's own sheet builder. */
export function isBlankRoleplaySheet(definition: RulesetDefinition, stored: unknown): boolean {
  const envelope = readRulesetSheetEnvelope(definition, stored);
  return !!envelope && JSON.stringify(envelope.build) === JSON.stringify(defaultRulesetSheetBuild(definition));
}

/** Pin a ruleset (or none), then read the chat again so everything sees the new pin and cards. */
function usePinRoleplayRuleset(chatId: string) {
  const queryClient = useQueryClient();
  const { t: localizeUi } = useUiTranslation();
  const [busy, setBusy] = useState(false);
  const pin = async (rulesetId: string | null) => {
    setBusy(true);
    try {
      const pinned = await api.post<{ cards: number; added: number }>("/game-rulesets/roleplay-pin", {
        chatId,
        rulesetId,
      });
      await queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      await queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      if (rulesetId) toast.success(localizeUi("chat.settings.ruleset.pinned", { count: pinned.added }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("chat.settings.ruleset.pinFailed"));
    } finally {
      setBusy(false);
    }
  };
  return { pin, busy };
}

const smallButton =
  "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50";

/** The body of Chat Settings' Ruleset section for a Roleplay chat. */
export function RoleplayRulesetSettings({ chatId, metadata }: { chatId: string; metadata: Record<string, unknown> }) {
  const { t: localizeUi } = useUiTranslation();
  const installed = useInstalledRulesets();
  const resolved = useGameRuleset(metadata);
  const { pin, busy } = usePinRoleplayRuleset(chatId);
  const updateChatMetadata = useUpdateChatMetadata();
  const showSheet = useRoleplaySheetStore((state) => state.show);
  const pinnedId =
    metadata.gameRuleset && typeof metadata.gameRuleset === "object"
      ? ((metadata.gameRuleset as { id?: unknown }).id as string | undefined)
      : undefined;
  const members = roleplaySheetNames(metadata);
  const declined = declinedNames(metadata);

  // Taking a removal back, then pinning again, which gives that member a sheet like any newcomer.
  const giveSheet = async (name: string) => {
    const key = normalizeCharacterLookupName(name);
    await updateChatMetadata.mutateAsync({
      id: chatId,
      roleplaySheetsDeclined: declined.filter((entry) => normalizeCharacterLookupName(entry) !== key),
    });
    if (pinnedId) await pin(pinnedId);
  };

  // Removing a sheet also remembers the member, so Add missing sheets and a newer version leave them out.
  const removeSheet = async (name: string) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("chat.settings.ruleset.removeTitle", { name }),
      message: localizeUi("chat.settings.ruleset.removeMessage", { name }),
      confirmLabel: localizeUi("chat.settings.ruleset.remove"),
      tone: "destructive",
    });
    if (!confirmed) return;
    const key = normalizeCharacterLookupName(name);
    await updateChatMetadata.mutateAsync({
      id: chatId,
      gameCharacterCards: readCards(metadata).filter(
        (card) => typeof card.name !== "string" || normalizeCharacterLookupName(card.name) !== key,
      ),
      roleplaySheetsDeclined: declined.some((entry) => normalizeCharacterLookupName(entry) === key)
        ? declined
        : [...declined, name],
    });
    toast.success(localizeUi("chat.settings.ruleset.removed", { name }));
  };

  return (
    <div className="space-y-2">
      <p className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi("chat.settings.ruleset.description")}
      </p>
      <select
        value={pinnedId ?? ""}
        disabled={busy || installed.isLoading}
        onChange={(event) => void pin(event.target.value || null)}
        aria-label={localizeUi("chat.settings.ruleset.label")}
        className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-[var(--ring)]"
      >
        <option value="">{localizeUi("chat.settings.ruleset.none")}</option>
        {(installed.data ?? []).map((entry) => (
          <option key={`${entry.packageId ?? "local"}:${entry.definition.id}`} value={entry.definition.id}>
            {entry.definition.name}
          </option>
        ))}
      </select>
      {resolved.status === "unavailable" && (
        <p className="text-[0.6875rem] text-[var(--destructive)]">{localizeUi("chat.settings.ruleset.unavailable")}</p>
      )}
      {pinnedId && (
        <>
          {members.length === 0 ? (
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {localizeUi("chat.settings.ruleset.noMembers")}
            </p>
          ) : (
            <ul className="space-y-1">
              {members.map((name) => {
                const blank =
                  resolved.status === "ok" &&
                  isBlankRoleplaySheet(resolved.definition, findCard(metadata, name)?.rulesetSheet);
                return (
                  <li key={name} className="flex items-center gap-1.5 text-xs">
                    <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">
                      {name}
                      {blank && (
                        <span className="ml-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                          {localizeUi("chat.settings.ruleset.blankSheet")}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={resolved.status !== "ok"}
                      onClick={() => showSheet({ chatId, name, build: blank })}
                      className={smallButton}
                    >
                      {blank ? (
                        <Hammer size="0.6875rem" aria-hidden="true" />
                      ) : (
                        <ScrollText size="0.6875rem" aria-hidden="true" />
                      )}
                      {localizeUi(blank ? "chat.settings.ruleset.buildSheet" : "chat.settings.ruleset.openSheet")}
                    </button>
                    <button
                      type="button"
                      disabled={updateChatMetadata.isPending}
                      onClick={() => void removeSheet(name)}
                      aria-label={localizeUi("chat.settings.ruleset.removeButton", { name })}
                      title={localizeUi("chat.settings.ruleset.removeButton", { name })}
                      className={`${smallButton} text-[var(--destructive)]`}
                    >
                      <Trash2 size="0.6875rem" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {declined.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
              <span>{localizeUi("chat.settings.ruleset.declined")}</span>
              {declined.map((name) => (
                <button
                  key={name}
                  type="button"
                  disabled={busy || updateChatMetadata.isPending}
                  onClick={() => void giveSheet(name)}
                  title={localizeUi("chat.settings.ruleset.giveSheetHelp", { name })}
                  className={`${smallButton} hover:text-[var(--foreground)]`}
                >
                  <UserPlus size="0.6875rem" aria-hidden="true" />
                  {localizeUi("chat.settings.ruleset.giveSheet", { name })}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void pin(pinnedId)}
            title={localizeUi("chat.settings.ruleset.syncHelp")}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
          >
            <Dices size="0.75rem" />
            {localizeUi("chat.settings.ruleset.sync")}
          </button>
        </>
      )}
    </div>
  );
}

/** Game Mode's character sheet for the Roleplay member Chat Settings or the tracker panel opened. */
export function RoleplayRulesetSheet({ chatId, metadata }: { chatId: string; metadata: Record<string, unknown> }) {
  const { t: localizeUi } = useUiTranslation();
  const open = useRoleplaySheetStore((state) => state.open);
  const close = useRoleplaySheetStore((state) => state.close);
  const resolved = useGameRuleset(metadata);
  const updateChatMetadata = useUpdateChatMetadata();
  const { patchField } = useGameStatePatcher(chatId, "roleplay-ruleset-sheet");
  const gameState = useGameStateStore((state) => state.current);

  if (!open || open.chatId !== chatId || metadata.gameRuleset == null) return null;
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
