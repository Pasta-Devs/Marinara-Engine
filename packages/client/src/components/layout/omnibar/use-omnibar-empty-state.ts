// Slice 78's empty omnibar: the one Now row, the Try examples, Continue, and the recent and frecent rows.
import type { Chat } from "@marinara-engine/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { readNamedRow } from "./omnibar-result-view";
import { IDLE_RECENT_CHATS, isNavigationOmnibarResult } from "./omnibar-dialog-rules";
import type { useUIStore } from "../../../stores/ui.store";
import type { useChatStore } from "../../../stores/chat.store";
import type { OmnibarResult, createOmnibarContext } from "../../../lib/omnibar-search";
import type { parseOmnibarScope } from "../../../lib/omnibar-scope";
import { type OmnibarFrecencyEntry, topFrecentResultIds } from "../../../lib/omnibar-frecency";
import {
  readOmnibarTryState,
  visibleOmnibarTryKinds,
  countOmnibarTryOpen,
  type OmnibarTryKind,
  markOmnibarTryUsed,
  buildOmnibarTryResults,
  pickOmnibarNowResult,
  lastEditedRecordId,
} from "../../../lib/omnibar-empty-state";
import { mariFixRowId } from "../../../lib/mari-arrival";
import { countBlockingReviews } from "../../../lib/professor-mari-presentation";
import { getChatCharacterIds } from "../../../lib/chat-macros";
import type { useProfessorMariWorkspaceStatus } from "../../../hooks/use-professor-mari-workspace-status";
import type { useLorebooks } from "../../../hooks/use-lorebooks";
import type { useChats, useProfessorMariChats } from "../../../hooks/use-chats";
import type { useCharacters, usePersonas } from "../../../hooks/use-characters";

type OmnibarEmptyStateInput = {
  activeChat: ReturnType<typeof useChatStore.getState>["activeChat"];
  activeChatId: string | null;
  allLocalResults: OmnibarResult[];
  characterNameById: ReadonlyMap<string, string>;
  characters: ReturnType<typeof useCharacters>["data"];
  chats: ReturnType<typeof useChats>["data"];
  contextResults: OmnibarResult[];
  continueResult: OmnibarResult | null;
  deferredQuery: string;
  frecencyEntries: readonly OmnibarFrecencyEntry[];
  lastAppError: ReturnType<typeof useUIStore.getState>["lastAppError"];
  lorebooks: ReturnType<typeof useLorebooks>["data"];
  mariChats: ReturnType<typeof useProfessorMariChats>["data"];
  mariEnabled: boolean;
  mariFinished: boolean;
  mariHasModel: boolean;
  mariWorkspaceStatus: ReturnType<typeof useProfessorMariWorkspaceStatus>["data"];
  omnibarContext: ReturnType<typeof createOmnibarContext>;
  omnibarSuggestionsEnabled: boolean;
  personas: ReturnType<typeof usePersonas>["data"];
  queryScope: ReturnType<typeof parseOmnibarScope>["scope"];
  searchableEntityResults: OmnibarResult[];
  theme: ReturnType<typeof useUIStore.getState>["theme"];
};

export function useOmnibarEmptyState({
  activeChat,
  activeChatId,
  allLocalResults,
  characterNameById,
  characters,
  chats,
  contextResults,
  continueResult,
  deferredQuery,
  frecencyEntries,
  lastAppError,
  lorebooks,
  mariChats,
  mariEnabled,
  mariFinished,
  mariHasModel,
  mariWorkspaceStatus,
  omnibarContext,
  omnibarSuggestionsEnabled,
  personas,
  queryScope,
  searchableEntityResults,
  theme,
}: OmnibarEmptyStateInput) {
  const { t } = useTranslation();
  // The empty omnibar also offers the chats you were in last, other than the open
  // one: switching chats is the most common trip here, and the "Recent" group
  // otherwise only knows what was chosen through the omnibar before.
  const recentChatResults = useMemo<OmnibarResult[]>(() => {
    const rowById = new Map(searchableEntityResults.map((row) => [row.id, row] as const));
    const lastActive = (chat: Chat) => chat.lastMessageAt ?? chat.updatedAt;
    return (
      [...(chats ?? [])]
        .filter((chat) => chat.id !== activeChatId)
        .sort((a, b) => lastActive(b).localeCompare(lastActive(a)))
        .flatMap((chat) => {
          const row = rowById.get(`chat:${chat.id}`);
          return row ? [{ ...row, group: "recent" as const, contextLabel: row.recentLine ?? row.contextLabel }] : [];
        })
        // One more than shown: the newest leads the Continue strip and is dropped here as a duplicate.
        .slice(0, IDLE_RECENT_CHATS + 1)
    );
  }, [activeChatId, chats, searchableEntityResults]);
  // O2: on an empty query, the top 3-5 rows this surface's user actually runs
  // most, ahead of the plain "last used anywhere" recents group below.
  const frecentIdleResults = useMemo<OmnibarResult[]>(() => {
    if (deferredQuery.trim()) return [];
    const ids = topFrecentResultIds(frecencyEntries, omnibarContext.surface);
    if (!ids.length) return [];
    const rowById = new Map(allLocalResults.map((row) => [row.id, row] as const));
    return ids.flatMap((id) => {
      // Already the thing you're on — showing "open it" again would be noise.
      if (id === `chat:${activeChatId}` || id === omnibarContext.openResource?.resultId) return [];
      const row = rowById.get(id);
      // Slice 78: chats already lead Continue and Recent, so this group keeps the buried things.
      return row && isNavigationOmnibarResult(row) && row.category !== "chat"
        ? [{ ...row, group: "frecent" as const }]
        : [];
    });
  }, [
    activeChatId,
    allLocalResults,
    deferredQuery,
    frecencyEntries,
    omnibarContext.openResource,
    omnibarContext.surface,
  ]);
  // Slice 78: Try examples until each kind was used once. Read once per open, so a row never
  // vanishes under the pointer; the open itself counts toward the stop rule.
  const [tryState, setTryState] = useState(() => readOmnibarTryState());
  const tryKinds = useMemo(
    () => visibleOmnibarTryKinds(tryState, { enabled: omnibarSuggestionsEnabled, mariEnabled }),
    [mariEnabled, omnibarSuggestionsEnabled, tryState],
  );
  const tryShownOnOpenRef = useRef(tryKinds.length > 0);
  useEffect(() => {
    if (tryShownOnOpenRef.current) countOmnibarTryOpen();
  }, []);
  const markTry = (kind: OmnibarTryKind) => {
    if (tryState.used[kind] === undefined) setTryState(markOmnibarTryUsed(kind));
  };
  const tryResults = useMemo<OmnibarResult[]>(() => {
    if (deferredQuery.trim() || queryScope || !tryKinds.length) return [];
    const chatCharacterId = activeChat?.id === activeChatId && activeChat ? getChatCharacterIds(activeChat)[0] : null;
    const chatCharacterName = chatCharacterId ? characterNameById.get(chatCharacterId) : undefined;
    return buildOmnibarTryResults(
      tryKinds,
      {
        // Real names from this install, so the example finds something; a fresh one searches the docs.
        search: readNamedRow(lorebooks?.[0])?.name ?? characterNameById.values().next().value ?? "openrouter",
        command:
          theme === "light"
            ? t("commandCenter.try.commandDark", "dark mode")
            : t("commandCenter.try.commandLight", "light mode"),
        mari: !mariHasModel
          ? t("commandCenter.try.mariSetup", "How do I connect a model?")
          : chatCharacterName
            ? t("commandCenter.try.mariChat", "Why is {{name}} acting out of character?", { name: chatCharacterName })
            : t("commandCenter.try.mariHome", "Why are my replies so short?"),
      },
      t,
    );
  }, [
    activeChat,
    activeChatId,
    characterNameById,
    deferredQuery,
    lorebooks,
    mariHasModel,
    queryScope,
    t,
    theme,
    tryKinds,
  ]);
  // Slice 78: the one row that needs you now, from rows the omnibar already builds.
  const setupRow = useMemo<OmnibarResult | null>(
    () =>
      mariHasModel
        ? null
        : {
            id: "now:setup-connection",
            title: t("commandCenter.now.setupTitle", "No model connected yet"),
            description: t("commandCenter.now.setupDescription", "Replies need a model connection. Add one to start."),
            category: "navigation",
            target: { kind: "panel", panel: "connections" },
            score: 0,
            kind: "navigation",
            icon: "connection",
          },
    [mariHasModel, t],
  );
  // UX-05: the no-model Try text ("How do I connect a model?") searches the docs, and the top doc is not the
  // connection guide. Keep the Set up row first while that text is in the field.
  const setupTryRow =
    !mariHasModel &&
    deferredQuery.trim().toLowerCase() === t("commandCenter.try.mariSetup", "How do I connect a model?").toLowerCase()
      ? setupRow
      : null;
  const nowResult = useMemo<OmnibarResult | null>(() => {
    if (deferredQuery.trim() || queryScope) return null;
    const lastFixRowId = mariFixRowId(lastAppError);
    return pickOmnibarNowResult({
      mariRow: continueResult,
      pendingApprovals: mariEnabled ? countBlockingReviews(mariWorkspaceStatus?.pendingApprovals ?? []) : 0,
      mariActive: mariWorkspaceStatus?.active === true,
      mariFinished,
      fixRow: (lastFixRowId && contextResults.find((row) => row.id === lastFixRowId)) || null,
      checkupRow: contextResults.find((row) => row.id.startsWith("chat-tool:reply-checkup:")) ?? null,
      setupRow,
    });
  }, [
    contextResults,
    continueResult,
    deferredQuery,
    lastAppError,
    mariEnabled,
    mariFinished,
    mariWorkspaceStatus,
    queryScope,
    setupRow,
  ]);
  // Slice 78: where you left off - the last chat, Mari's last conversation, the record edited last.
  const continueResults = useMemo<OmnibarResult[]>(() => {
    if (deferredQuery.trim() || queryScope) return [];
    const rows: OmnibarResult[] = [];
    if (recentChatResults[0]) rows.push({ ...recentChatResults[0], group: "continue" });
    const lastActive = (chat: Chat) => chat.lastMessageAt ?? chat.updatedAt;
    const lastMari = mariEnabled
      ? [...(mariChats ?? [])].sort((a, b) => lastActive(b).localeCompare(lastActive(a)))[0]
      : undefined;
    if (lastMari) {
      rows.push({
        id: `mari-chat:${lastMari.id}`,
        action: { kind: "open-mari-chat", chatId: lastMari.id },
        title: lastMari.name || t("omnibar.categories.professor", "Professor Mari"),
        description: t("commandCenter.mariChat", "Professor Mari conversation"),
        category: "chat",
        group: "continue",
        score: 0,
        kind: "action",
        icon: "professor",
      });
    }
    const editedId = lastEditedRecordId([
      ["character", characters],
      ["persona", personas],
      // Not presets: the built-in one is rewritten on startup and would always read as "edited".
      ["lorebook", lorebooks],
    ]);
    const edited = editedId ? allLocalResults.find((row) => row.id === editedId) : undefined;
    // Without its inline switch: on a card, Enter opens the record, it never flips it.
    if (edited) rows.push({ ...edited, group: "continue", control: undefined });
    return rows;
  }, [
    allLocalResults,
    characters,
    deferredQuery,
    lorebooks,
    mariChats,
    mariEnabled,
    personas,
    queryScope,
    recentChatResults,
    t,
  ]);
  return { recentChatResults, frecentIdleResults, tryResults, nowResult, setupTryRow, continueResults, markTry };
}
