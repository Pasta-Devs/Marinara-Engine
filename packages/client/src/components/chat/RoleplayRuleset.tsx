// ──────────────────────────────────────────────
// Roleplay played by a ruleset: the picker in Chat Settings and the members' sheets
//
// A Roleplay chat can pin one of the installed Game Mode rulesets. The server copies each member's
// library sheet onto the chat's own cards (`gameCharacterCards`), and from then on the narrator asks
// for checks and keeps the sheets the way a game's Game Master does. This file is the chat's side of
// it: choosing the ruleset, the members and their sheets. Game Mode's character sheet that shows one
// (a sheet nobody has built yet opens in the ruleset's sheet builder) is in RoleplayRulesetSheet.tsx,
// so Chat Settings and the tracker panel, which import this file, do not load Game Mode's screen.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dices, Hammer, ScrollText, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  readRulesetSheetEnvelope,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import { useInstalledRulesets } from "../../hooks/use-capability-packages";
import { chatKeys, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useGameRuleset } from "../../hooks/use-game-ruleset";
import { api } from "../../lib/api-client";
import { parseChatMetadata } from "../../lib/chat-display";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useRoleplaySheetStore } from "../../stores/roleplay-sheet.store";

interface StoredCard {
  name?: unknown;
  rulesetSheet?: unknown;
}

export function readCards(metadata: Record<string, unknown>): StoredCard[] {
  return Array.isArray(metadata.gameCharacterCards) ? (metadata.gameCharacterCards as StoredCard[]) : [];
}

export function findCard(metadata: Record<string, unknown>, name: string): StoredCard | undefined {
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
  const queryClient = useQueryClient();
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
    // Read the chat as it is now, not as it was when the dialog opened: sheets added while it was
    // open (Add missing sheets, a sheet given back) must survive this write.
    const cached = queryClient.getQueryData<{ metadata?: unknown }>(chatKeys.detail(chatId));
    const current = cached?.metadata != null ? parseChatMetadata(cached.metadata) : metadata;
    const declinedNow = declinedNames(current);
    const key = normalizeCharacterLookupName(name);
    await updateChatMetadata.mutateAsync({
      id: chatId,
      gameCharacterCards: readCards(current).filter(
        (card) => typeof card.name !== "string" || normalizeCharacterLookupName(card.name) !== key,
      ),
      roleplaySheetsDeclined: declinedNow.some((entry) => normalizeCharacterLookupName(entry) === key)
        ? declinedNow
        : [...declinedNow, name],
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
