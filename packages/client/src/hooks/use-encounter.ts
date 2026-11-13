// ──────────────────────────────────────────────
// Hook: Combat Encounter API calls
// ──────────────────────────────────────────────
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useEncounterStore } from "../stores/encounter.store";
import { useChatStore } from "../stores/chat.store";
import { chatKeys } from "./use-chats";
import type {
  EncounterInitResponse,
  EncounterActionResponse,
  EncounterSummaryResponse,
  EncounterSettings,
} from "@marinara-engine/shared";
import { sanitizeEnemies, sanitizeParty } from "../lib/encounter-combatants";

/** #9117: the summary in flight, so closing the window can cancel it before it writes to the chat. */
let summaryAbort: AbortController | null = null;

export function useEncounter() {
  const qc = useQueryClient();
  const store = useEncounterStore();
  const activeChatId = useChatStore((s) => s.activeChatId);

  /** Start combat: show config modal → init → render. */
  const startEncounter = useCallback(() => {
    store.openConfigModal();
  }, [store]);

  /** Called after the config modal — actually fire the init request. */
  const initEncounter = useCallback(
    async (settings: EncounterSettings) => {
      if (!activeChatId) return;
      store.closeConfigModal();
      store.setLoading(true);
      store.setError(null);

      // Mark active so the modal renders in loading state
      useEncounterStore.setState({ active: true });

      const spellbookId = useEncounterStore.getState().spellbookId;

      try {
        const res = await api.post<EncounterInitResponse>("/encounter/init", {
          chatId: activeChatId,
          connectionId: null,
          settings,
          spellbookId,
        });
        store.initCombat(res.combatState);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to initialize encounter";
        store.setError(msg);
        store.setLoading(false);
      }
    },
    [activeChatId, store],
  );

  /** Generate and inject combat summary into the chat. */
  const generateSummary = useCallback(
    async (result: "victory" | "defeat" | "fled" | "interrupted") => {
      if (!activeChatId) return;
      const { encounterLog, settings } = useEncounterStore.getState();

      store.setSummaryStatus("generating");
      const controller = new AbortController();
      summaryAbort = controller;

      try {
        await api.post<EncounterSummaryResponse>(
          "/encounter/summary",
          {
            chatId: activeChatId,
            connectionId: null,
            encounterLog,
            result,
            settings,
          },
          { signal: controller.signal },
        );

        store.setSummaryStatus("done");

        // Invalidate chat messages so the new summary shows up
        await qc.invalidateQueries({
          queryKey: chatKeys.messages(activeChatId),
        });
      } catch {
        // #9117: closing the window cancels the summary; the gone encounter is not an error to show.
        store.setSummaryStatus(useEncounterStore.getState().active ? "error" : "idle");
      } finally {
        if (summaryAbort === controller) summaryAbort = null;
      }
    },
    [activeChatId, store, qc],
  );

  /** Send a combat action. */
  const sendAction = useCallback(
    async (actionText: string) => {
      if (!activeChatId) return;
      if (useEncounterStore.getState().isProcessing) return;
      const { party, enemies, environment, playerActions, encounterLog, settings } = useEncounterStore.getState();
      const spellbookId = useEncounterStore.getState().spellbookId;

      store.setProcessing(true);
      store.setError(null);

      try {
        const res = await api.post<EncounterActionResponse>("/encounter/action", {
          chatId: activeChatId,
          connectionId: null,
          action: actionText,
          combatStats: { party, enemies, environment },
          playerActions,
          encounterLog,
          settings,
          spellbookId,
        });

        if (res.invalid) {
          store.setError("AI returned an invalid response. Try again.");
          store.setProcessing(false);
          return;
        }

        const r = res.result;

        // Validate critical fields — AI may return malformed data
        if (!r || typeof r !== "object") {
          store.setError("AI returned an invalid response. Try again.");
          store.setProcessing(false);
          return;
        }

        // Build sequential log entries
        const logs: Array<{ message: string; type: string }> = [];
        if (Array.isArray(r.enemyActions)) {
          for (const ea of r.enemyActions) {
            if (ea?.enemyName && ea?.action)
              logs.push({ message: `${ea.enemyName}: ${ea.action}`, type: "enemy-action" });
          }
        }
        if (Array.isArray(r.partyActions)) {
          for (const pa of r.partyActions) {
            if (pa?.memberName && pa?.action)
              logs.push({ message: `${pa.memberName}: ${pa.action}`, type: "party-action" });
          }
        }
        if (r.narrative && typeof r.narrative === "string") {
          for (const line of r.narrative.split("\n").filter((l: string) => l.trim())) {
            logs.push({ message: line, type: "narrative" });
          }
        }
        store.setPendingLogs(logs);

        // Build full action log for summary
        let fullAction = actionText;
        if (r.enemyActions?.length) {
          for (const ea of r.enemyActions) fullAction += `\n${ea.enemyName}: ${ea.action}`;
        }
        if (r.partyActions?.length) {
          for (const pa of r.partyActions) fullAction += `\n${pa.memberName}: ${pa.action}`;
        }
        store.addLogEntry(fullAction, r.narrative || "Action resolved");

        // Update stats — defensively sanitize AI data, falling back to current state
        const currentState = useEncounterStore.getState();
        const newParty = Array.isArray(r.combatStats?.party)
          ? sanitizeParty(r.combatStats.party, currentState.party)
          : currentState.party;
        const newEnemies = Array.isArray(r.combatStats?.enemies)
          ? sanitizeEnemies(r.combatStats.enemies, currentState.enemies)
          : currentState.enemies;

        store.updateCombat({
          party: newParty,
          enemies: newEnemies,
          playerActions: r.playerActions ?? currentState.playerActions,
          enemyActions: r.enemyActions || [],
          partyActions: r.partyActions || [],
          narrative: r.narrative || "",
        });

        // Check for combat end
        if (r.combatEnd && r.result) {
          store.endCombat(r.result);
          await generateSummary(r.result);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to process action";
        store.setError(msg);
        store.setProcessing(false);
      }
    },
    [activeChatId, store, generateSummary],
  );

  /** Manually conclude encounter early. */
  const concludeEncounter = useCallback(async () => {
    store.endCombat("interrupted");
    await generateSummary("interrupted");
  }, [store, generateSummary]);

  /**
   * #9117: close the window. Closing while the summary is being written cancels that write, so a fight closed at
   * "Generating combat summary..." leaves nothing behind.
   */
  const closeEncounter = useCallback(() => {
    summaryAbort?.abort();
    summaryAbort = null;
    store.reset();
  }, [store]);

  return {
    startEncounter,
    initEncounter,
    sendAction,
    concludeEncounter,
    closeEncounter,
    generateSummary,
  };
}
