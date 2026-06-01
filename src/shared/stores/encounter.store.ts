// ──────────────────────────────────────────────
// Zustand Store: Combat Encounter
// ──────────────────────────────────────────────
import { create } from "zustand";
import type {
  CombatInitState,
  CombatPartyMember,
  CombatEnemy,
  CombatPlayerActions,
  CombatEnemyAction,
  CombatPartyAction,
  EncounterLogEntry,
  EncounterSettings,
  CombatStyleNotes,
} from "../../engine/contracts/types/combat-encounter";

interface EncounterState {
  // ── State ──
  active: boolean;
  initialized: boolean;
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;

  // ── Combat data ──
  party: CombatPartyMember[];
  enemies: CombatEnemy[];
  environment: string;
  styleNotes: CombatStyleNotes | null;
  playerActions: CombatPlayerActions | null;
  encounterLog: EncounterLogEntry[];

  // ── Pending log entries for sequential animation ──
  pendingLogs: Array<{ message: string; type: string }>;

  // ── Settings ──
  settings: EncounterSettings;

  // ── Config modal ──
  showConfigModal: boolean;

  // ── Selected spellbook ──
  spellbookId: string | null;

  // ── Combat result ──
  combatResult: "victory" | "defeat" | "fled" | "interrupted" | null;
  summaryStatus: "idle" | "generating" | "done" | "error";

  // ── Actions ──
  openConfigModal: () => void;
  closeConfigModal: () => void;
  updateSettings: (settings: Partial<EncounterSettings>) => void;
  setSpellbookId: (id: string | null) => void;

  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;

  initCombat: (state: CombatInitState) => void;
  updateCombat: (data: {
    party: CombatPartyMember[];
    enemies: CombatEnemy[];
    playerActions: CombatPlayerActions;
    enemyActions: CombatEnemyAction[];
    partyActions: CombatPartyAction[];
    narrative: string;
  }) => void;
  addLogEntry: (action: string, result: string) => void;
  setPendingLogs: (logs: Array<{ message: string; type: string }>) => void;
  clearPendingLogs: () => void;

  endCombat: (result: "victory" | "defeat" | "fled" | "interrupted") => void;
  setSummaryStatus: (status: "idle" | "generating" | "done" | "error") => void;

  reset: () => void;
}

const defaultSettings: EncounterSettings = {
  combatNarrative: {
    tense: "present",
    person: "third",
    narration: "omniscient",
    pov: "narrator",
  },
  summaryNarrative: {
    tense: "past",
    person: "third",
    narration: "omniscient",
    pov: "narrator",
  },
  historyDepth: 8,
};

export const useEncounterStore = create<EncounterState>((set) => ({
  active: false,
  initialized: false,
  isLoading: false,
  isProcessing: false,
  error: null,

  party: [],
  enemies: [],
  environment: "",
  styleNotes: null,
  playerActions: null,
  encounterLog: [],
  pendingLogs: [],

  settings: defaultSettings,
  showConfigModal: false,
  spellbookId: null,

  combatResult: null,
  summaryStatus: "idle",

  openConfigModal: () => set({ showConfigModal: true, spellbookId: null }),
  closeConfigModal: () => set({ showConfigModal: false }),
  updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
  setSpellbookId: (id) => set({ spellbookId: id }),

  setLoading: (loading) => set({ isLoading: loading }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setError: (error) => set({ error }),

  initCombat: (state) =>
    set({
      active: true,
      initialized: true,
      isLoading: false,
      error: null,
      party: state.party,
      enemies: state.enemies,
      environment: state.environment,
      styleNotes: state.styleNotes,
      playerActions: {
        attacks: state.party.find((m) => m.isPlayer)?.attacks ?? [],
        items: state.party.find((m) => m.isPlayer)?.items ?? [],
      },
      encounterLog: [],
      pendingLogs: [],
      combatResult: null,
      summaryStatus: "idle",
    }),

  updateCombat: (data) =>
    set((s) => {
      // Sanitize playerActions — AI may return attacks/items as non-arrays
      let pa: CombatPlayerActions | null = data.playerActions ?? s.playerActions;
      if (pa && typeof pa === "object") {
        pa = {
          attacks: Array.isArray(pa.attacks) ? pa.attacks : (s.playerActions?.attacks ?? []),
          items: Array.isArray(pa.items) ? pa.items : (s.playerActions?.items ?? []),
        };
      } else {
        pa = s.playerActions;
      }
      return {
        party: Array.isArray(data.party) && data.party.length > 0 ? data.party : s.party,
        enemies: Array.isArray(data.enemies) && data.enemies.length > 0 ? data.enemies : s.enemies,
        playerActions: pa,
        isProcessing: false,
      };
    }),

  addLogEntry: (action, result) =>
    set((s) => ({
      encounterLog: [...s.encounterLog, { timestamp: Date.now(), action, result }],
    })),

  setPendingLogs: (logs) => set({ pendingLogs: logs }),
  clearPendingLogs: () => set({ pendingLogs: [] }),

  endCombat: (result) => set({ combatResult: result }),
  setSummaryStatus: (status) => set({ summaryStatus: status }),

  reset: () =>
    set({
      active: false,
      initialized: false,
      isLoading: false,
      isProcessing: false,
      error: null,
      party: [],
      enemies: [],
      environment: "",
      styleNotes: null,
      playerActions: null,
      encounterLog: [],
      pendingLogs: [],
      showConfigModal: false,
      spellbookId: null,
      combatResult: null,
      summaryStatus: "idle",
    }),
}));
