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
import { lazy, Suspense, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dices, Hammer, PencilRuler, Plus, ScrollText, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  readRulesetSheetEnvelope,
  rulesetBuilderDraftFrom,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import { useAgentImportPolicy } from "../../hooks/use-agents";
import { useInstalledRulesets, useRulesetSource } from "../../hooks/use-capability-packages";
import { chatKeys, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useGameRuleset } from "../../hooks/use-game-ruleset";
import { api } from "../../lib/api-client";
import { parseChatMetadata } from "../../lib/chat-display";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useRoleplaySheetStore } from "../../stores/roleplay-sheet.store";
import { Select } from "../ui/Select";

// The builder's form loads when it opens, so Chat Settings and the tracker panel do not carry it.
const RulesetBuilderModal = lazy(() =>
  import("../rulesets/RulesetBuilderModal").then((module) => ({ default: module.RulesetBuilderModal })),
);

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

const builderButton =
  "flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50";
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
  const [builder, setBuilder] = useState<"new" | "edit" | null>(null);
  // The builder saves the way an import does, so it needs imports on.
  const imports = useAgentImportPolicy();
  const canBuild = imports.data?.enabled === true;
  // Matched as the resolver matches a pin, by id and package, so a package and a stored ruleset that
  // share an id are never confused.
  const pinnedPackageId =
    metadata.gameRuleset && typeof metadata.gameRuleset === "object"
      ? ((metadata.gameRuleset as { packageId?: unknown }).packageId as string | null | undefined)
      : undefined;
  const pinnedEntry = pinnedId
    ? installed.data?.find((entry) => entry.definition.id === pinnedId && entry.packageId === (pinnedPackageId ?? null))
    : undefined;
  // The builder opens a ruleset only when it can write it back unchanged; any other is its author's file.
  // Only the player's own (`local/`) rulesets open: saving a packaged or repository one would make a
  // local copy under another id, a second sheet on every character.
  // It opens the newest version, so only a chat that plays it may edit; another chat moves up first.
  const playing = "ref" in resolved ? resolved.ref : null;
  const playsNewest = !playing || playing.version === pinnedEntry?.definition.version;
  // The stored file, not the listed definition: the list drops comments, which the form cannot keep.
  const editable = !!pinnedEntry && !pinnedEntry.packageId && pinnedEntry.source?.kind === "local" && playsNewest;
  const source = useRulesetSource(pinnedId, pinnedEntry?.definition.version, editable);
  const pinnedDraft = useMemo(() => {
    if (!editable || !source.data) return null;
    try {
      return rulesetBuilderDraftFrom(JSON.parse(source.data.ruleset));
    } catch {
      return null;
    }
  }, [editable, source.data]);

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
      <Select
        value={pinnedId ?? ""}
        disabled={busy || installed.isLoading}
        options={[
          { value: "", label: localizeUi("chat.settings.ruleset.none") },
          ...(installed.data ?? []).map((entry) => ({ value: entry.definition.id, label: entry.definition.name })),
        ]}
        onChange={(value) => void pin(value || null)}
        label={localizeUi("chat.settings.ruleset.label")}
        className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-[var(--ring)]"
      />
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
      <div className="flex flex-wrap gap-1.5">
        {/* A new ruleset's id is picked against the installed list, so it waits for that list. */}
        <button
          type="button"
          disabled={busy || !installed.data || !canBuild}
          onClick={() => setBuilder("new")}
          className={builderButton}
        >
          <Plus size="0.75rem" />
          {localizeUi("chat.settings.ruleset.newRuleset")}
        </button>
        {pinnedDraft && (
          <button
            type="button"
            disabled={busy || !canBuild}
            onClick={() => setBuilder("edit")}
            className={builderButton}
          >
            <PencilRuler size="0.75rem" />
            {localizeUi("chat.settings.ruleset.editRuleset")}
          </button>
        )}
      </div>
      {imports.data && !canBuild && (
        <p className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
          {localizeUi("chat.settings.ruleset.builderNeedsImports")}
        </p>
      )}
      {builder && (
        <Suspense fallback={null}>
          <RulesetBuilderModal
            open
            onClose={() => setBuilder(null)}
            initial={builder === "edit" ? pinnedDraft : null}
            installedVersion={builder === "edit" ? pinnedEntry?.definition.version : undefined}
            installed={installed.data ?? []}
            // Pinning again moves the chat onto the saved version and gives new members their sheets. A new
            // ruleset is turned on only in a chat with none: switching would start this chat's sheets over.
            onSaved={(rulesetId) => {
              if (builder === "edit" || !pinnedId) void pin(rulesetId);
              else toast.info(localizeUi("chat.settings.ruleset.newNotPinned"));
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
