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
  CombatPartyMember,
  CombatEnemy,
} from "@marinara-engine/shared";

/** Ensure each party member has all required numeric/string fields so components don't crash. */
function sanitizeParty(arr: unknown[], fallback: CombatPartyMember[]): CombatPartyMember[] {
  return arr.map((raw, i) => {
    if (!raw || typeof raw !== "object") return fallback[i] ?? fallback[0];
    const m = raw as Record<string, unknown>;
    return {
      name: typeof m.name === "string" && m.name ? m.name : (fallback[i]?.name ?? "Unknown"),
      hp: typeof m.hp === "number" ? m.hp : (fallback[i]?.hp ?? 0),
      maxHp: typeof m.maxHp === "number" && m.maxHp > 0 ? m.maxHp : (fallback[i]?.maxHp ?? 1),
      attacks: Array.isArray(m.attacks) ? m.attacks : (fallback[i]?.attacks ?? []),
      items: Array.isArray(m.items) ? m.items : (fallback[i]?.items ?? []),
      statuses: Array.isArray(m.statuses) ? m.statuses : (fallback[i]?.statuses ?? []),
      isPlayer: typeof m.isPlayer === "boolean" ? m.isPlayer : (fallback[i]?.isPlayer ?? false),
    } satisfies CombatPartyMember;
  });
}

/** Ensure each enemy has all required numeric/string fields so components don't crash. */
function sanitizeEnemies(arr: unknown[], fallback: CombatEnemy[]): CombatEnemy[] {
  return arr.map((raw, i) => {
    if (!raw || typeof raw !== "object") return fallback[i] ?? fallback[0];
    const m = raw as Record<string, unknown>;
    return {
      name: typeof m.name === "string" && m.name ? m.name : (fallback[i]?.name ?? "Enemy"),
      hp: typeof m.hp === "number" ? m.hp : (fallback[i]?.hp ?? 0),
      maxHp: typeof m.maxHp === "number" && m.maxHp > 0 ? m.maxHp : (fallback[i]?.maxHp ?? 1),
      attacks: Array.isArray(m.attacks) ? m.attacks : (fallback[i]?.attacks ?? []),
      statuses: Array.isArray(m.statuses) ? m.statuses : (fallback[i]?.statuses ?? []),
      description: typeof m.description === "string" ? m.description : (fallback[i]?.description ?? ""),
      sprite: typeof m.sprite === "string" ? m.sprite : (fallback[i]?.sprite ?? ""),
    } satisfies CombatEnemy;
  });
}

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
