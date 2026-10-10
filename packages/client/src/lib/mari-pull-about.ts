// 45b: what Mari looks down at during the pull. Loaded with a dynamic import when a pull starts, so the
// arrival builder stays out of the top bar's eager chunk.
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { agentKeys } from "../hooks/use-agents";
import { characterKeys } from "../hooks/use-characters";
import { connectionKeys } from "../hooks/use-connections";
import { lorebookKeys } from "../hooks/use-lorebooks";
import { presetKeys } from "../hooks/use-presets";
import { getCharacterDisplayIdentity } from "./character-display";
import { getChatCharacterIds } from "./chat-macros";
import { buildMariArrival, isMariReplyFailure, mariPullAbout } from "./mari-arrival";
import type { OmnibarTranslate } from "./omnibar-entity-rows";
import { readNamedRow } from "./omnibar-row-readers";
import { createOmnibarContext, resolveOmnibarScreen } from "./omnibar-search";
import { useChatStore } from "../stores/chat.store";
import { useUIStore } from "../stores/ui.store";

/** A row already in the query cache (a list or a detail), by id or agent type. Never fetches. */
function cachedRow(queryClient: QueryClient, queryKey: QueryKey, id: string) {
  for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey })) {
    for (const row of Array.isArray(data) ? data : [data]) {
      const record = row as Record<string, unknown> | null;
      if (record && typeof record === "object" && (record.id === id || record.type === id)) return record;
    }
  }
  return undefined;
}

/**
 * 45b: what Mari looks down at, read once when the pull starts: the same screen detection and arrival
 * builder as the Mari pane (M9), fed names from the cache only (R22). Null on Home with nothing open.
 */
export function readMariPullAbout(queryClient: QueryClient, t: OmnibarTranslate) {
  const ui = useUIStore.getState();
  const { activeChat, activeChatId } = useChatStore.getState();
  const screen = resolveOmnibarScreen({
    ...ui,
    settingsPanelVisible: ui.rightPanelOpen && ui.rightPanel === "settings",
    activeChatId,
  });
  const context = createOmnibarContext({
    ...screen,
    activeChat: activeChat && activeChat.id === activeChatId ? { id: activeChat.id, resultIds: [] } : undefined,
  });
  const resource = screen.openResource;
  const characterName = (id: string) => {
    // A full row (list, detail) or a chat's character summary, whichever the screen already loaded.
    const row = cachedRow(queryClient, characterKeys.all, id);
    if (!row) return undefined;
    return "data" in row
      ? getCharacterDisplayIdentity({ data: row.data, comment: row.comment as string | null })
      : readNamedRow(row)?.name;
  };
  const listKey = {
    persona: characterKeys.personas,
    lorebook: lorebookKeys.all,
    preset: presetKeys.all,
    connection: connectionKeys.all,
  } as const;
  const editorName = !resource
    ? undefined
    : resource.kind === "character"
      ? characterName(resource.id)
      : resource.kind in listKey
        ? readNamedRow(cachedRow(queryClient, listKey[resource.kind as keyof typeof listKey], resource.id))?.name
        : undefined;
  const agent = resource?.kind === "agent" ? cachedRow(queryClient, agentKeys.all, resource.id) : undefined;
  const lastAppError = ui.lastAppError;
  const arrival = buildMariArrival(context, {
    t,
    now: Date.now(),
    chat:
      context.activeChat && activeChat
        ? {
            name: activeChat.name,
            characters: getChatCharacterIds(activeChat).flatMap((id) => {
              const name = characterName(id);
              return name ? [{ id, name }] : [];
            }),
            lorebooks: [],
          }
        : null,
    replyFailed: isMariReplyFailure(lastAppError, context.activeChat?.id),
    agent:
      agent && typeof agent.name === "string" && typeof agent.type === "string"
        ? {
            type: agent.type,
            name: agent.name,
            enabled: String(agent.enabled) === "true",
            promptLength: 0,
            settingsCount: 0,
            lastError:
              lastAppError?.retry?.kind === "open-agent" && lastAppError.retry.id === agent.type
                ? lastAppError.message
                : null,
          }
        : null,
    editor: editorName ? { name: editorName } : null,
  });
  return mariPullAbout(context, arrival, t);
}
