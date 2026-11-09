// ──────────────────────────────────────────────
// Roleplay played by a ruleset: the picker in Chat Settings and the sheets window
//
// A Roleplay chat can pin one of the installed Game Mode rulesets. The server copies each member's
// library sheet onto the chat's own cards (`gameCharacterCards`), and from then on the narrator asks
// for checks and keeps the sheets the way a game's Game Master does. This file is the chat's side of
// it: choosing the ruleset, and a window with every member's sheet, the same sheet Game Mode shows.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dices, PencilRuler, Plus, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  normalizeCharacterLookupName,
  readRulesetSheetEnvelope,
  rulesetBuilderDraftFrom,
  type RulesetLiveState,
  type RulesetSheetEnvelope,
} from "@marinara-engine/shared";
import { FloatingWindow, PHONE_FULL_SHEET_CLASS, PHONE_SHEET_CLASS } from "../ui/FloatingWindow";
import { NEUTRAL_PANEL_SCROLL_AREA, NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { GameRulesetSheet } from "../game/GameRulesetSheet";
import { RulesetBuilderModal } from "../rulesets/RulesetBuilderModal";
import { useInstalledRulesets } from "../../hooks/use-capability-packages";
import { chatKeys, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useGameRuleset } from "../../hooks/use-game-ruleset";
import { useGameStatePatcher } from "../../hooks/use-game-state-patcher";
import { useMatchMedia } from "../../hooks/use-match-media";
import { api } from "../../lib/api-client";
import type { WindowBounds, WindowLayout } from "../../lib/floating-window-layout";
import { cn } from "../../lib/utils";
import { useFloatingWindowStore } from "../../stores/floating-window.store";
import { useGameStateStore } from "../../stores/game-state.store";
import { readChatWindowArea, readCssPixels } from "./chat-settings-window";

export const ROLEPLAY_RULESET_WINDOW_ID = "roleplay-ruleset-sheets";

const DEFAULT_WIDTH_REM = 40;
const DEFAULT_HEIGHT_REM = 38;

interface StoredCard {
  name?: unknown;
  rulesetSheet?: unknown;
}

function readCards(metadata: Record<string, unknown>): StoredCard[] {
  return Array.isArray(metadata.gameCharacterCards) ? (metadata.gameCharacterCards as StoredCard[]) : [];
}

function cardNames(metadata: Record<string, unknown>): string[] {
  return readCards(metadata).flatMap((card) =>
    typeof card.name === "string" && card.name.trim() ? [card.name.trim()] : [],
  );
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

/** The body of Chat Settings' Ruleset section for a Roleplay chat. */
export function RoleplayRulesetSettings({ chatId, metadata }: { chatId: string; metadata: Record<string, unknown> }) {
  const { t: localizeUi } = useUiTranslation();
  const installed = useInstalledRulesets();
  const resolved = useGameRuleset(metadata);
  const { pin, busy } = usePinRoleplayRuleset(chatId);
  const sheetsOpen = useFloatingWindowStore((state) => state.open[ROLEPLAY_RULESET_WINDOW_ID] === true);
  const pinnedId =
    metadata.gameRuleset && typeof metadata.gameRuleset === "object"
      ? ((metadata.gameRuleset as { id?: unknown }).id as string | undefined)
      : undefined;
  const members = cardNames(metadata);
  const [builder, setBuilder] = useState<"new" | "edit" | null>(null);
  const pinnedEntry = pinnedId ? installed.data?.find((entry) => entry.definition.id === pinnedId) : undefined;
  // Only a ruleset the builder wrote opens in it; any other is its author's file.
  const pinnedDraft = useMemo(
    () => (pinnedEntry ? rulesetBuilderDraftFrom(pinnedEntry.definition) : null),
    [pinnedEntry],
  );
  const buttonClass =
    "flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50";

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
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {members.length > 0
              ? localizeUi("chat.settings.ruleset.members", { names: members.join(", ") })
              : localizeUi("chat.settings.ruleset.noMembers")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={sheetsOpen}
              onClick={(event) =>
                useFloatingWindowStore.getState().toggleWindow(ROLEPLAY_RULESET_WINDOW_ID, event.currentTarget)
              }
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]",
                sheetsOpen ? "bg-[var(--accent)]" : "bg-[var(--secondary)]",
              )}
            >
              <ScrollText size="0.75rem" />
              {localizeUi("chat.settings.ruleset.openSheets")}
            </button>
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
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy} onClick={() => setBuilder("new")} className={buttonClass}>
          <Plus size="0.75rem" />
          {localizeUi("chat.settings.ruleset.newRuleset")}
        </button>
        {pinnedDraft && (
          <button type="button" disabled={busy} onClick={() => setBuilder("edit")} className={buttonClass}>
            <PencilRuler size="0.75rem" />
            {localizeUi("chat.settings.ruleset.editRuleset")}
          </button>
        )}
      </div>
      {builder && (
        <RulesetBuilderModal
          open
          onClose={() => setBuilder(null)}
          initial={builder === "edit" ? pinnedDraft : null}
          installedVersion={builder === "edit" ? pinnedEntry?.definition.version : undefined}
          // Pinning again moves the chat onto the saved version and gives new members their sheets.
          onSaved={(rulesetId) => void pin(rulesetId)}
        />
      )}
    </div>
  );
}

function getSheetsDefaultLayout(bounds: WindowBounds): WindowLayout {
  const remPx = readCssPixels(document.documentElement, "font-size") || 16;
  const area = readChatWindowArea(bounds);
  const width = Math.max(320, Math.min(DEFAULT_WIDTH_REM * remPx, area.right - area.left));
  const height = Math.max(280, Math.min(DEFAULT_HEIGHT_REM * remPx, area.bottom - area.top));
  return {
    x: area.left + Math.max(0, (area.right - area.left - width) / 2),
    y: area.top + Math.max(0, (area.bottom - area.top - height) / 2),
    width,
    height,
    pinned: false,
    locked: false,
  };
}

/** Every member's sheet for a Roleplay chat that plays by a ruleset, in a window of its own. */
export function RoleplayRulesetWindow({ chatId, metadata }: { chatId: string; metadata: Record<string, unknown> }) {
  const { t: localizeUi } = useUiTranslation();
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  const open = useFloatingWindowStore((state) => state.open[ROLEPLAY_RULESET_WINDOW_ID] === true);
  if (!open || metadata.gameRuleset == null) return null;

  return (
    <FloatingWindow
      id={ROLEPLAY_RULESET_WINDOW_ID}
      title={localizeUi("chat.settings.ruleset.sheetsTitle")}
      titleIcon={<ScrollText size="0.8125rem" className="mari-chrome-accent-icon shrink-0" />}
      closeLabel={localizeUi("window.controls.close")}
      presentation={phoneLayout ? "sheet" : "window"}
      sheetClassName={cn(PHONE_SHEET_CLASS, PHONE_FULL_SHEET_CLASS)}
      getDefaultLayout={getSheetsDefaultLayout}
      minWidth={300}
      minHeight={260}
      className={cn("marinara-chat-popover", NEUTRAL_SURFACE_VARIABLES)}
      headerClassName="marinara-chat-popover__header"
      titleClassName="marinara-chat-popover__title text-xs font-semibold leading-tight"
      rootAttributes={{ "data-roleplay-ruleset-sheets": chatId }}
      onRequestClose={(reason) => {
        useFloatingWindowStore.getState().dismissWindow(ROLEPLAY_RULESET_WINDOW_ID, {
          force: reason === "close-button",
        });
      }}
    >
      <RoleplayRulesetSheets chatId={chatId} metadata={metadata} />
    </FloatingWindow>
  );
}

function RoleplayRulesetSheets({ chatId, metadata }: { chatId: string; metadata: Record<string, unknown> }) {
  const { t: localizeUi } = useUiTranslation();
  const resolved = useGameRuleset(metadata);
  const updateChatMetadata = useUpdateChatMetadata();
  const { patchField } = useGameStatePatcher(chatId, "roleplay-ruleset-sheets");
  const gameState = useGameStateStore((state) => state.current);
  const names = useMemo(() => cardNames(metadata), [metadata]);
  const [selected, setSelected] = useState<string | null>(null);
  const cardName = selected && names.includes(selected) ? selected : (names[0] ?? null);

  if (resolved.status === "loading") {
    return (
      <div className="mari-chrome-text-muted px-4 py-8 text-center text-xs">
        {localizeUi("chat.settings.ruleset.loading")}
      </div>
    );
  }
  if (resolved.status !== "ok") {
    return (
      <div className="px-4 py-8 text-center text-xs text-[var(--destructive)]">
        {localizeUi("chat.settings.ruleset.unavailable")}
      </div>
    );
  }
  if (!cardName) {
    return (
      <div className="mari-chrome-text-muted px-4 py-8 text-center text-xs">
        {localizeUi("chat.settings.ruleset.noMembers")}
      </div>
    );
  }

  const cards = readCards(metadata);
  const index = cards.findIndex(
    (card) =>
      typeof card.name === "string" &&
      normalizeCharacterLookupName(card.name) === normalizeCharacterLookupName(cardName),
  );
  const envelope = index >= 0 ? readRulesetSheetEnvelope(resolved.definition, cards[index]?.rulesetSheet) : null;
  const unreadable = index >= 0 && !envelope && cards[index]?.rulesetSheet != null;
  const key = normalizeCharacterLookupName(cardName);
  const ownState = gameState?.chatId === chatId ? gameState : null;
  const live = ownState?.rulesetLive?.[key];

  const saveEnvelope = async (next: RulesetSheetEnvelope) => {
    const current = readCards(metadata);
    const at = current.findIndex(
      (card) => typeof card.name === "string" && normalizeCharacterLookupName(card.name) === key,
    );
    if (at < 0) {
      const message = localizeUi("game.ruleset.sheet.noCard", { name: cardName });
      toast.error(message);
      throw new Error(message);
    }
    await updateChatMetadata.mutateAsync({
      id: chatId,
      gameCharacterCards: current.map((card, cardIndex) => (cardIndex === at ? { ...card, rulesetSheet: next } : card)),
    });
    toast.success(localizeUi("game.ruleset.sheet.saved", { name: cardName }));
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

  return (
    <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain")}>
      {names.length > 1 && (
        <div role="tablist" className="flex shrink-0 flex-wrap gap-1 border-b border-[var(--border)] px-3 py-2">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={name === cardName}
              onClick={() => setSelected(name)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ring-1 transition-colors",
                name === cardName
                  ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-[var(--primary)]/60"
                  : "text-[var(--muted-foreground)] ring-[var(--border)] hover:text-[var(--foreground)]",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="p-3">
        {unreadable ? (
          <p className="text-xs text-[var(--destructive)]">{localizeUi("chat.settings.ruleset.unreadable")}</p>
        ) : (
          <GameRulesetSheet
            key={`${chatId}:${key}`}
            definition={resolved.definition}
            layers={resolved.layers}
            layerOptions={resolved.layerOptions}
            cardName={cardName}
            envelope={envelope ?? undefined}
            live={live}
            onLiveChange={changeLive}
            onEnvelopeSave={saveEnvelope}
          />
        )}
      </div>
    </div>
  );
}
