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
} from "@marinara-engine/shared";

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

  // ── Combat result ──
  combatResult: "victory" | "defeat" | "fled" | "interrupted" | null;
  summaryStatus: "idle" | "generating" | "done" | "error";

  // ── Actions ──
  openConfigModal: () => void;
  closeConfigModal: () => void;
  updateSettings: (settings: Partial<EncounterSettings>) => void;

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

  combatResult: null,
  summaryStatus: "idle",

  openConfigModal: () => set({ showConfigModal: true }),
  closeConfigModal: () => set({ showConfigModal: false }),
  updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),

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
    set((_s) => ({
      party: data.party,
      enemies: data.enemies,
      playerActions: data.playerActions,
      isProcessing: false,
    })),

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
      combatResult: null,
      summaryStatus: "idle",
    }),
}));
