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

      try {
        const res = await api.post<EncounterInitResponse>("/encounter/init", {
          chatId: activeChatId,
          connectionId: null,
          settings,
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

      try {
        const _res = await api.post<EncounterSummaryResponse>("/encounter/summary", {
          chatId: activeChatId,
          connectionId: null,
          encounterLog,
          result,
          settings,
        });

        store.setSummaryStatus("done");

        // Invalidate chat messages so the new summary shows up
        await qc.invalidateQueries({
          queryKey: chatKeys.messages(activeChatId),
        });
      } catch {
        store.setSummaryStatus("error");
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
        });

        const r = res.result;

        // Build sequential log entries
        const logs: Array<{ message: string; type: string }> = [];
        if (r.enemyActions) {
          for (const ea of r.enemyActions) {
            logs.push({ message: `${ea.enemyName}: ${ea.action}`, type: "enemy-action" });
          }
        }
        if (r.partyActions) {
          for (const pa of r.partyActions) {
            logs.push({ message: `${pa.memberName}: ${pa.action}`, type: "party-action" });
          }
        }
        if (r.narrative) {
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

        // Update stats
        store.updateCombat({
          party: r.combatStats.party,
          enemies: r.combatStats.enemies,
          playerActions: r.playerActions,
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

  /** Close encounter without summary. */
  const closeEncounter = useCallback(() => {
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
