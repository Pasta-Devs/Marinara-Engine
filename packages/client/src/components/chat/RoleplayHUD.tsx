// ──────────────────────────────────────────────
// Chat: Roleplay HUD — immersive world-state widgets
// Each tracker category gets its own mini widget with
// a compact preview and expandable editable popover.
// Supports top (horizontal) and left/right (vertical) layout.
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  MapPin,
  Thermometer,
  Users,
  Package,
  Scroll,
  Target,
  CheckCircle2,
  Circle,
  CalendarDays,
  Pencil,
  Trash2,
  Sparkles,
  X,
  Plus,
  MessageCircle,
  Swords,
  RefreshCw,
  CloudSun,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { useGameStateStore } from "../../stores/game-state.store";
import { useAgentStore } from "../../stores/agent.store";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useUIStore } from "../../stores/ui.store";
import type {
  GameState,
  PresentCharacter,
  CharacterStat,
  InventoryItem,
  QuestProgress,
  CustomTrackerField,
} from "@marinara-engine/shared";
import type { HudPosition } from "../../stores/ui.store";

interface RoleplayHUDProps {
  chatId: string;
  characterCount: number;
  layout?: HudPosition;
  onRetriggerTrackers?: () => void;
  /** When true, tracker agents are manual — show a trigger button in the widget strip */
  manualTrackers?: boolean;
  /** When provided, overrides the globally-computed set so that only per-chat agents show widgets. */
  enabledAgentTypes?: Set<string>;
}

export function RoleplayHUD({
  chatId,
  characterCount: _characterCount,
  layout = "top",
  onRetriggerTrackers,
  manualTrackers,
  mobileCompact,
  enabledAgentTypes: enabledAgentTypesProp,
}: RoleplayHUDProps & { mobileCompact?: boolean }) {
  const [agentsOpen, setAgentsOpen] = useState(false);
  const gameState = useGameStateStore((s) => s.current);
  const setGameState = useGameStateStore((s) => s.setGameState);
  const setFlushPatch = useGameStateStore((s) => s.setFlushPatch);

  const { data: agentConfigs } = useAgentConfigs();
  const globalEnabledAgentTypes = useMemo(() => {
    const set = new Set<string>();
    if (agentConfigs) {
      for (const a of agentConfigs as Array<{ type: string; enabled: string }>) {
        if (a.enabled === "true") set.add(a.type);
      }
    }
    return set;
  }, [agentConfigs]);
  const enabledAgentTypes = enabledAgentTypesProp ?? globalEnabledAgentTypes;

  const thoughtBubbles = useAgentStore((s) => s.thoughtBubbles);
  const isAgentProcessing = useAgentStore((s) => s.isProcessing);
  const dismissThoughtBubble = useAgentStore((s) => s.dismissThoughtBubble);
  const clearThoughtBubbles = useAgentStore((s) => s.clearThoughtBubbles);

  useEffect(() => {
    if (!chatId) return;
    // If the store already holds state for this chat, skip the redundant fetch.
    // This happens when ChatArea remounts after visiting an editor panel.
    const existing = useGameStateStore.getState().current;
    if (existing?.chatId === chatId) return;

    let cancelled = false;
    api
      .get<GameState | null>(`/chats/${chatId}/game-state`)
      .then((gs) => {
        if (!cancelled) setGameState(gs ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chatId, setGameState]);

  // Debounced API patch — batches rapid field changes into a single call
  const patchQueueRef = useRef<Record<string, unknown>>({});
  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const patchField = useCallback(
    (field: string, value: unknown) => {
      // Optimistic local update
      const prev = gameStateRef.current;
      if (prev) {
        setGameState({ ...prev, [field]: value });
      } else {
        setGameState({
          id: "",
          chatId,
          messageId: "",
          swipeIndex: 0,
          date: null,
          time: null,
          location: null,
          weather: null,
          temperature: null,
          presentCharacters: [],
          recentEvents: [],
          playerStats: null,
          personaStats: null,
          createdAt: "",
          [field]: value,
        } as GameState);
      }
      // Queue the field for a batched API call
      patchQueueRef.current[field] = value;
      if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
      patchTimerRef.current = setTimeout(() => {
        const payload = { ...patchQueueRef.current, manual: true };
        patchQueueRef.current = {};
        api.patch(`/chats/${chatId}/game-state`, payload).catch(() => {});
      }, 500);
    },
    [chatId, setGameState],
  );

  // Expose a flush function so generation can await pending patches before firing
  const flushPatch = useCallback(async () => {
    if (patchTimerRef.current) {
      clearTimeout(patchTimerRef.current);
      patchTimerRef.current = null;
    }
    const queued = patchQueueRef.current;
    if (Object.keys(queued).length === 0) return;
    const payload = { ...queued, manual: true };
    patchQueueRef.current = {};
    await api.patch(`/chats/${chatId}/game-state`, payload).catch(() => {});
  }, [chatId]);

  useEffect(() => {
    setFlushPatch(flushPatch);
    return () => setFlushPatch(null);
  }, [flushPatch, setFlushPatch]);

  const patchPlayerStats = useCallback(
    (field: string, value: unknown) => {
      const current = gameStateRef.current?.playerStats ?? {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [],
        activeQuests: [],
        status: "",
      };
      const next = { ...current, [field]: value };
      patchField("playerStats", next);
    },
    [patchField],
  );

  const clearGameState = useCallback(() => {
    const cleared = {
      date: null,
      time: null,
      location: null,
      weather: null,
      temperature: null,
      presentCharacters: [],
      recentEvents: [],
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [],
        activeQuests: [],
        status: "",
      },
      personaStats: [],
    };
    const prev = gameStateRef.current;
    if (prev) {
      setGameState({ ...prev, ...cleared } as GameState);
    } else {
      setGameState({
        id: "",
        chatId,
        messageId: "",
        swipeIndex: 0,
        createdAt: "",
        ...cleared,
      } as GameState);
    }
    api.patch(`/chats/${chatId}/game-state`, cleared).catch(() => {});
  }, [chatId, setGameState]);

  const date = gameState?.date ?? null;
  const time = gameState?.time ?? null;
  const location = gameState?.location ?? null;
  const weather = gameState?.weather ?? null;
  const temperature = gameState?.temperature ?? null;
  const presentCharacters = gameState?.presentCharacters ?? [];
  const personaStatBars = gameState?.personaStats ?? [];
  const playerStats = gameState?.playerStats ?? null;
  const inventory = playerStats?.inventory ?? [];
  const activeQuests = playerStats?.activeQuests ?? [];
  const customTrackerFields = playerStats?.customTrackerFields ?? [];

  const isVertical = layout === "left" || layout === "right";
  // If mobileCompact, widgets are even narrower and action buttons are not cut off

  return (
    <div
      className={cn(
        "rpg-hud",
        isVertical ? "flex flex-col items-center gap-1.5" : "flex items-center gap-1.5",
        mobileCompact && "flex-1 min-w-0",
      )}
    >
      {/* Actions (Agents + Clear) */}
      <ActionsGroup
        isVertical={isVertical}
        agentsOpen={agentsOpen}
        setAgentsOpen={setAgentsOpen}
        isAgentProcessing={isAgentProcessing}
        thoughtBubbles={thoughtBubbles}
        clearThoughtBubbles={clearThoughtBubbles}
        dismissThoughtBubble={dismissThoughtBubble}
        enabledAgentTypes={enabledAgentTypes}
        clearGameState={clearGameState}
        onRetriggerTrackers={onRetriggerTrackers}
      />

      {/* ── Mobile: combined widgets, centered ── */}
      <div className={cn("flex items-center gap-0.5 md:hidden", mobileCompact && "flex-1 justify-center")}>
        {enabledAgentTypes.has("world-state") && (
          <CombinedWorldWidget
            location={location ?? ""}
            date={date ?? ""}
            time={time ?? ""}
            weather={weather ?? ""}
            temperature={temperature ?? ""}
            onSaveLocation={(v) => patchField("location", v)}
            onSaveDate={(v) => patchField("date", v)}
            onSaveTime={(v) => patchField("time", v)}
            onSaveWeather={(v) => patchField("weather", v)}
            onSaveTemperature={(v) => patchField("temperature", v)}
            layout={layout}
          />
        )}

        {(enabledAgentTypes.has("persona-stats") ||
          enabledAgentTypes.has("character-tracker") ||
          enabledAgentTypes.has("quest") ||
          enabledAgentTypes.has("custom-tracker")) && (
          <CombinedPlayerWidget
            layout={layout}
            showPersona={enabledAgentTypes.has("persona-stats")}
            showCharacters={enabledAgentTypes.has("character-tracker")}
            showQuests={enabledAgentTypes.has("quest")}
            showCustomTracker={enabledAgentTypes.has("custom-tracker")}
            personaStats={personaStatBars}
            onUpdatePersonaStats={(bars) => patchField("personaStats", bars)}
            characters={presentCharacters}
            onUpdateCharacters={(chars) => {
              if (gameState) {
                setGameState({ ...gameState, presentCharacters: chars });
              }
              api.patch(`/chats/${chatId}/game-state`, { presentCharacters: chars }).catch(() => {});
            }}
            inventory={inventory}
            onUpdateInventory={(items) => patchPlayerStats("inventory", items)}
            quests={activeQuests}
            onUpdateQuests={(q) => patchPlayerStats("activeQuests", q)}
            customTrackerFields={customTrackerFields}
            onUpdateCustomTracker={(fields) => patchPlayerStats("customTrackerFields", fields)}
          />
        )}

        {/* Manual tracker trigger button (mobile) */}
        {manualTrackers && onRetriggerTrackers && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onRetriggerTrackers();
            }}
            disabled={isAgentProcessing}
            className={cn(
              MOBILE_HUD_BTN,
              "border-white/15 justify-center text-[0.5625rem] font-medium",
              isAgentProcessing ? "text-purple-300" : "text-white/60",
            )}
          >
            <RefreshCw size="0.875rem" className={cn("shrink-0 h-4 w-4", isAgentProcessing && "animate-spin")} />
          </button>
        )}
      </div>

      {/* ── Desktop: separate individual widgets ── */}
      <div className="hidden md:flex items-center gap-1.5">
        {enabledAgentTypes.has("world-state") && (
          <CombinedWorldWidget
            location={location ?? ""}
            date={date ?? ""}
            time={time ?? ""}
            weather={weather ?? ""}
            temperature={temperature ?? ""}
            onSaveLocation={(v) => patchField("location", v)}
            onSaveDate={(v) => patchField("date", v)}
            onSaveTime={(v) => patchField("time", v)}
            onSaveWeather={(v) => patchField("weather", v)}
            onSaveTemperature={(v) => patchField("temperature", v)}
            layout={layout}
          />
        )}

        {enabledAgentTypes.has("persona-stats") && (
          <PersonaStatsWidget
            bars={personaStatBars}
            onUpdate={(bars) => patchField("personaStats", bars)}
            layout={layout}
          />
        )}

        {enabledAgentTypes.has("character-tracker") && (
          <CharactersWidget
            characters={presentCharacters}
            onUpdate={(chars) => {
              if (gameState) {
                setGameState({ ...gameState, presentCharacters: chars });
              }
              api.patch(`/chats/${chatId}/game-state`, { presentCharacters: chars }).catch(() => {});
            }}
            layout={layout}
          />
        )}

        {enabledAgentTypes.has("persona-stats") && (
          <InventoryWidget
            items={inventory}
            onUpdate={(items) => patchPlayerStats("inventory", items)}
            layout={layout}
          />
        )}

        {enabledAgentTypes.has("quest") && (
          <QuestsWidget quests={activeQuests} onUpdate={(q) => patchPlayerStats("activeQuests", q)} layout={layout} />
        )}

        {enabledAgentTypes.has("custom-tracker") && (
          <CustomTrackerWidget
            fields={customTrackerFields}
            onUpdate={(fields) => patchPlayerStats("customTrackerFields", fields)}
            layout={layout}
          />
        )}

        {/* Manual tracker trigger button (desktop) */}
        {manualTrackers && onRetriggerTrackers && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onRetriggerTrackers();
            }}
            disabled={isAgentProcessing}
            className={cn(WIDGET, isAgentProcessing ? "text-purple-300" : "text-white/60")}
            title={isAgentProcessing ? "Trackers running…" : "Run Trackers"}
          >
            <RefreshCw size="0.875rem" className={cn(isAgentProcessing && "animate-spin")} />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Actions Group (Agents dropdown, Echo Chamber toggle, Clear)
// ═══════════════════════════════════════════════

/** Common mobile HUD button sizing – used by all four strip buttons */
const MOBILE_HUD_BTN =
  "flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 backdrop-blur-md px-2 py-1.5 transition-all hover:bg-black/60 cursor-pointer select-none";

interface ActionsGroupProps {
  isVertical: boolean;
  agentsOpen: boolean;
  setAgentsOpen: (v: boolean) => void;
  isAgentProcessing: boolean;
  thoughtBubbles: Array<{ agentId: string; agentName: string; content: string; timestamp: number }>;
  clearThoughtBubbles: () => void;
  dismissThoughtBubble: (i: number) => void;
  enabledAgentTypes: Set<string>;
  clearGameState: () => void;
  onRetriggerTrackers?: () => void;
}

function ActionsGroup({
  isVertical: _isVertical,
  agentsOpen,
  setAgentsOpen,
  isAgentProcessing,
  thoughtBubbles,
  clearThoughtBubbles,
  dismissThoughtBubble,
  enabledAgentTypes,
  clearGameState,
  onRetriggerTrackers,
}: ActionsGroupProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const echoChamberOpen = useUIStore((s) => s.echoChamberOpen);
  const toggleEchoChamber = useUIStore((s) => s.toggleEchoChamber);
  const echoMessages = useAgentStore((s) => s.echoMessages);
  const showEcho = enabledAgentTypes.has("echo-chamber");

  // Position with fixed layout to avoid overflow clipping
  useLayoutEffect(() => {
    if (!agentsOpen || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const maxH = 320;
    const top = rect.bottom + 4 + maxH > window.innerHeight ? rect.top - maxH - 4 : rect.bottom + 4;
    const left = Math.min(rect.left, window.innerWidth - 288 - 8);
    setPos({ top, left });
  }, [agentsOpen]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!agentsOpen) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || dropdownRef.current?.contains(e.target as Node)) return;
      setAgentsOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAgentsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [agentsOpen, setAgentsOpen]);

  // Badge count — total thought bubbles + echo messages
  const badgeCount = thoughtBubbles.length + echoMessages.length;

  // ── Shared dropdown portal (used by both desktop & mobile) ──
  const dropdownContent =
    agentsOpen &&
    pos &&
    createPortal(
      <div
        ref={dropdownRef}
        className="fixed w-72 max-w-[calc(100vw-1rem)] max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-xl z-[9999] animate-message-in"
        style={{ top: pos.top, left: pos.left }}
      >
        {/* Agent activity */}
        {isAgentProcessing && (
          <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
            <Sparkles size="0.75rem" className="text-purple-400 animate-pulse" />
            <span className="text-[0.625rem] text-purple-300/80">Agents thinking…</span>
          </div>
        )}
        {thoughtBubbles.length === 0 && !isAgentProcessing && (
          <div className="px-3 py-4 text-center text-[0.625rem] text-white/30">No agent activity yet</div>
        )}
        {thoughtBubbles.length > 0 && (
          <>
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
              <span className="text-[0.625rem] text-white/40">
                {thoughtBubbles.length} result{thoughtBubbles.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={clearThoughtBubbles}
                className="text-[0.625rem] text-white/30 hover:text-white/60 transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {thoughtBubbles.map((bubble, i) => (
                <div
                  key={`${bubble.agentId}-${bubble.timestamp}`}
                  className="relative rounded-lg bg-white/5 p-2 text-[0.625rem]"
                >
                  <button
                    onClick={() => dismissThoughtBubble(i)}
                    className="absolute right-1.5 top-1.5 text-white/20 hover:text-white/60 transition-colors"
                  >
                    <X size="0.625rem" />
                  </button>
                  <div className="pr-4">
                    <span className="font-semibold text-purple-300">{bubble.agentName}</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-white/50 leading-relaxed">{bubble.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Action rows (echo toggle, clear, re-run) ── */}
        <div className="border-t border-white/5 divide-y divide-white/5">
          {showEcho && (
            <button
              onClick={toggleEchoChamber}
              className="flex w-full items-center gap-2 px-3 py-2 text-[0.625rem] transition-colors hover:bg-white/5"
            >
              <MessageCircle size="0.75rem" className={echoChamberOpen ? "text-purple-400" : "text-purple-400/60"} />
              <span className={echoChamberOpen ? "text-purple-300 font-medium" : "text-white/60"}>
                Echo Chamber {echoChamberOpen ? "On" : "Off"}
              </span>
              {echoMessages.length > 0 && (
                <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-purple-500/80 px-1 text-[0.5rem] font-bold text-white">
                  {echoMessages.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => {
              clearGameState();
              setAgentsOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[0.625rem] text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 size="0.75rem" className="text-purple-400/60" />
            <span>Clear Trackers</span>
          </button>
          {onRetriggerTrackers && (
            <button
              onClick={() => {
                onRetriggerTrackers();
                setAgentsOpen(false);
              }}
              disabled={isAgentProcessing}
              className="flex w-full items-center gap-2 px-3 py-2 text-[0.625rem] font-medium text-purple-300 transition-colors hover:bg-purple-500/10 disabled:opacity-50"
            >
              <RefreshCw size="0.6875rem" className={isAgentProcessing ? "animate-spin" : ""} />
              {isAgentProcessing ? "Running\u2026" : "Re-run Trackers"}
            </button>
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setAgentsOpen(!agentsOpen)}
        className={cn(
          "flex items-center gap-1.5 md:gap-1 rounded-lg border border-white/10 bg-black/40 backdrop-blur-md px-2 py-1.5 md:px-2 md:py-2 md:h-10 transition-all hover:bg-black/60 cursor-pointer select-none",
          agentsOpen && "bg-black/60 border-white/20",
        )}
        title="Agents & Actions"
      >
        <Sparkles
          size="0.875rem"
          strokeWidth={2.5}
          className={cn("text-purple-400/70 shrink-0", isAgentProcessing && "animate-pulse")}
        />
        {showEcho && (
          <MessageCircle
            size="0.8125rem"
            strokeWidth={2.5}
            className={cn(echoChamberOpen ? "text-purple-400" : "text-purple-400/50", "shrink-0")}
          />
        )}
        <Trash2 size="0.8125rem" strokeWidth={2.5} className="text-purple-400/50 shrink-0" />
        {badgeCount > 0 && (
          <span className="hidden md:flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-purple-500/80 px-1 text-[0.5rem] font-bold text-white">
            {badgeCount}
          </span>
        )}
      </button>
      {dropdownContent}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Echo Chamber Toggle Button (desktop only — mobile folded into ActionsGroup)
// ═══════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EchoChamberToggle() {
  const echoChamberOpen = useUIStore((s) => s.echoChamberOpen);
  const toggleEchoChamber = useUIStore((s) => s.toggleEchoChamber);
  const echoMessages = useAgentStore((s) => s.echoMessages);

  return (
    <button
      onClick={toggleEchoChamber}
      className={cn(
        "flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[0.625rem] text-white/60 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white",
        echoChamberOpen && "bg-purple-500/20 text-purple-300 border-purple-500/30",
      )}
      title="Toggle Echo Chamber panel"
    >
      <MessageCircle size="0.625rem" className="text-purple-400/70" />
      <span>Echo</span>
      {echoMessages.length > 0 && (
        <span className="flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-purple-500/80 px-1 text-[0.5rem] font-bold text-white">
          {echoMessages.length}
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════
// Combined Player Widget — merges Persona, Chars,
// Inventory, and Quests into a single expandable panel
// ═══════════════════════════════════════════════

function CombinedPlayerWidget({
  layout = "top",
  showPersona,
  showCharacters,
  showQuests,
  showCustomTracker,
  personaStats,
  onUpdatePersonaStats,
  characters,
  onUpdateCharacters,
  inventory,
  onUpdateInventory,
  quests,
  onUpdateQuests,
  customTrackerFields,
  onUpdateCustomTracker,
}: {
  layout?: HudPosition;
  showPersona: boolean;
  showCharacters: boolean;
  showQuests: boolean;
  showCustomTracker: boolean;
  personaStats: CharacterStat[];
  onUpdatePersonaStats: (bars: CharacterStat[]) => void;
  characters: PresentCharacter[];
  onUpdateCharacters: (chars: PresentCharacter[]) => void;
  inventory: InventoryItem[];
  onUpdateInventory: (items: InventoryItem[]) => void;
  quests: QuestProgress[];
  onUpdateQuests: (quests: QuestProgress[]) => void;
  customTrackerFields: CustomTrackerField[];
  onUpdateCustomTracker: (fields: CustomTrackerField[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // --- Persona Stats helpers ---
  const updateBar = (idx: number, field: "value" | "max" | "name", val: number | string) => {
    const next = [...personaStats];
    next[idx] = { ...next[idx]!, [field]: val };
    onUpdatePersonaStats(next);
  };

  // --- Characters helpers ---
  const addCharacter = () => {
    onUpdateCharacters([
      ...characters,
      {
        characterId: `manual-${Date.now()}`,
        name: "New Character",
        emoji: "👤",
        mood: "",
        appearance: null,
        outfit: null,
        customFields: {},
        stats: [],
        thoughts: null,
      },
    ]);
  };
  const removeCharacter = (idx: number) => onUpdateCharacters(characters.filter((_, i) => i !== idx));
  const updateCharacter = (idx: number, updated: PresentCharacter) => {
    const next = [...characters];
    next[idx] = updated;
    onUpdateCharacters(next);
  };

  // --- Inventory helpers ---
  const addItem = () => {
    onUpdateInventory([...inventory, { name: "New Item", description: "", quantity: 1, location: "on_person" }]);
  };
  const removeItem = (idx: number) => onUpdateInventory(inventory.filter((_, i) => i !== idx));
  const updateItem = (idx: number, updated: InventoryItem) => {
    const next = [...inventory];
    next[idx] = updated;
    onUpdateInventory(next);
  };

  // --- Quests helpers ---
  const addQuest = () => {
    onUpdateQuests([
      ...quests,
      {
        questEntryId: `manual-${Date.now()}`,
        name: "New Quest",
        currentStage: 0,
        objectives: [{ text: "Objective 1", completed: false }],
        completed: false,
      },
    ]);
  };
  const removeQuest = (idx: number) => onUpdateQuests(quests.filter((_, i) => i !== idx));
  const updateQuest = (idx: number, updated: QuestProgress) => {
    const next = [...quests];
    next[idx] = updated;
    onUpdateQuests(next);
  };

  // --- Custom Tracker helpers ---
  const addCustomField = () => {
    onUpdateCustomTracker([...customTrackerFields, { name: "New Field", value: "" }]);
  };
  const removeCustomField = (idx: number) => onUpdateCustomTracker(customTrackerFields.filter((_, i) => i !== idx));
  const updateCustomField = (idx: number, updated: CustomTrackerField) => {
    const next = [...customTrackerFields];
    next[idx] = updated;
    onUpdateCustomTracker(next);
  };

  // Count total tracked items for badge
  const _totalItems =
    characters.length +
    inventory.length +
    quests.length +
    customTrackerFields.length +
    (personaStats.length > 0 ? 1 : 0);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(WIDGET, "text-orange-300")}
        title="Player & Tracker"
      >
        <div className="flex h-7 max-md:h-auto items-center justify-center shrink-0">
          <Swords size="0.875rem" className="text-orange-400/70 max-md:h-4 max-md:w-4" />
        </div>
        <span className="max-w-full truncate text-[0.5625rem] font-semibold leading-tight shrink-0 max-md:hidden">
          Tracker
        </span>
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-80 max-h-[min(75vh,32rem)]"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[0.625rem] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Swords size="0.625rem" /> Trackers
          </span>
          <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 transition-colors">
            <X size="0.75rem" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[min(calc(75vh-2rem),30rem)] divide-y divide-white/5">
          {/* ── Persona Stats section ── */}
          {showPersona && (
            <div className="p-2">
              <div className="px-1 pb-1">
                <span className="text-[0.625rem] font-semibold text-violet-300/70 uppercase tracking-wider">
                  Persona Stats
                </span>
              </div>
              <div className="space-y-2">
                {personaStats.length === 0 && (
                  <div className="text-[0.625rem] text-white/30 text-center py-1">No stats tracked</div>
                )}
                {personaStats.map((bar, idx) => (
                  <StatBarEditable
                    key={bar.name}
                    stat={bar}
                    onUpdateName={(n) => updateBar(idx, "name", n)}
                    onUpdateValue={(v) => updateBar(idx, "value", v)}
                    onUpdateMax={(v) => updateBar(idx, "max", v)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Characters section ── */}
          {showCharacters && (
            <div className="p-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[0.625rem] font-semibold text-purple-300/70 uppercase tracking-wider flex items-center gap-1">
                  <Users size="0.5625rem" /> Characters ({characters.length})
                </span>
                <button
                  onClick={addCharacter}
                  className="flex items-center gap-0.5 text-[0.625rem] text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <Plus size="0.625rem" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {characters.length === 0 && (
                  <div className="text-[0.625rem] text-white/30 text-center py-1">No characters in scene</div>
                )}
                {characters.map((char, idx) => (
                  <div key={char.characterId ?? idx} className="rounded-lg bg-white/5 p-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <InlineEdit
                        value={char.emoji || "👤"}
                        onSave={(v) => updateCharacter(idx, { ...char, emoji: v })}
                        className="w-8 text-center !text-sm"
                      />
                      <InlineEdit
                        value={char.name}
                        onSave={(v) => updateCharacter(idx, { ...char, name: v })}
                        className="flex-1 !font-medium"
                        placeholder="Name"
                      />
                      <button
                        onClick={() => removeCharacter(idx)}
                        className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                        title="Remove character"
                      >
                        <X size="0.625rem" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pl-1">
                      <LabeledEdit
                        label="Mood"
                        value={char.mood}
                        onSave={(v) => updateCharacter(idx, { ...char, mood: v })}
                      />
                      <LabeledEdit
                        label="Look"
                        value={char.appearance ?? ""}
                        onSave={(v) => updateCharacter(idx, { ...char, appearance: v || null })}
                      />
                      <LabeledEdit
                        label="Outfit"
                        value={char.outfit ?? ""}
                        onSave={(v) => updateCharacter(idx, { ...char, outfit: v || null })}
                      />
                      <LabeledEdit
                        label="Thinks"
                        value={char.thoughts ?? ""}
                        onSave={(v) => updateCharacter(idx, { ...char, thoughts: v || null })}
                      />
                    </div>
                    {char.stats?.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-white/5">
                        {char.stats.map((stat, si) => (
                          <StatBarEditable
                            key={stat.name}
                            stat={stat}
                            onUpdateValue={(v) => {
                              const next = [...(char.stats ?? [])];
                              next[si] = { ...next[si]!, value: v };
                              updateCharacter(idx, { ...char, stats: next });
                            }}
                            onUpdateMax={(v) => {
                              const next = [...(char.stats ?? [])];
                              next[si] = { ...next[si]!, max: v };
                              updateCharacter(idx, { ...char, stats: next });
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Inventory section ── */}
          {showPersona && (
            <div className="p-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[0.625rem] font-semibold text-amber-300/70 uppercase tracking-wider flex items-center gap-1">
                  <Package size="0.5625rem" /> Inventory ({inventory.length})
                </span>
                <button
                  onClick={addItem}
                  className="flex items-center gap-0.5 text-[0.625rem] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Plus size="0.625rem" /> Add
                </button>
              </div>
              <div className="space-y-1">
                {inventory.length === 0 && (
                  <div className="text-[0.625rem] text-white/30 text-center py-1">Inventory empty</div>
                )}
                {inventory.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
                    <Package size="0.625rem" className="shrink-0 text-amber-400/60" />
                    <InlineEdit
                      value={item.name}
                      onSave={(v) => updateItem(idx, { ...item, name: v })}
                      className="flex-1"
                      placeholder="Item name"
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { ...item, quantity: Math.max(0, Number(e.target.value)) })}
                      className="w-8 bg-transparent text-center text-[0.5625rem] text-white/40 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      title="Quantity"
                    />
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                      title="Remove item"
                    >
                      <X size="0.5625rem" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Quests section ── */}
          {showQuests && (
            <div className="p-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[0.625rem] font-semibold text-emerald-300/70 uppercase tracking-wider flex items-center gap-1">
                  <Scroll size="0.5625rem" /> Quests ({quests.length})
                </span>
                <button
                  onClick={addQuest}
                  className="flex items-center gap-0.5 text-[0.625rem] text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Plus size="0.625rem" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {quests.length === 0 && (
                  <div className="text-[0.625rem] text-white/30 text-center py-1">No active quests</div>
                )}
                {quests.map((quest, idx) => (
                  <QuestCardEditable
                    key={quest.questEntryId || idx}
                    quest={quest}
                    onUpdate={(q) => updateQuest(idx, q)}
                    onRemove={() => removeQuest(idx)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Custom Tracker section ── */}
          {showCustomTracker && (
            <div className="p-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[0.625rem] font-semibold text-cyan-300/70 uppercase tracking-wider flex items-center gap-1">
                  <SlidersHorizontal size="0.5625rem" /> Custom ({customTrackerFields.length})
                </span>
                <button
                  onClick={addCustomField}
                  className="flex items-center gap-0.5 text-[0.625rem] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Plus size="0.625rem" /> Add
                </button>
              </div>
              <div className="space-y-1">
                {customTrackerFields.length === 0 && (
                  <div className="text-[0.625rem] text-white/30 text-center py-1">No fields tracked</div>
                )}
                {customTrackerFields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
                    <SlidersHorizontal size="0.625rem" className="shrink-0 text-cyan-400/60" />
                    <InlineEdit
                      value={field.name}
                      onSave={(v) => updateCustomField(idx, { ...field, name: v })}
                      className="flex-1 min-w-0"
                      placeholder="Field name"
                    />
                    <span className="text-white/20 text-[0.5rem]">=</span>
                    <InlineEdit
                      value={field.value}
                      onSave={(v) => updateCustomField(idx, { ...field, value: v })}
                      className="flex-1 min-w-0"
                      placeholder="Value"
                    />
                    <button
                      onClick={() => removeCustomField(idx)}
                      className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                      title="Remove field"
                    >
                      <X size="0.5625rem" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </WidgetPopover>
    </div>
  );
}

/** Shared popover wrapper used by tracker widgets — renders via portal to escape overflow clipping */
function WidgetPopover({
  open,
  onClose,
  anchorRef,
  placement = "bottom",
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: "bottom" | "right" | "left";
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const computePosition = useCallback(() => {
    if (!anchorRef.current) return null;
    const rect = anchorRef.current.getBoundingClientRect();
    const popoverWidth = ref.current?.offsetWidth ?? 288;
    const popoverHeight = ref.current?.offsetHeight ?? 200;
    let top: number;
    let left: number;

    if (placement === "right") {
      left = rect.right + 4;
      top = rect.top;
      if (top + popoverHeight > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - popoverHeight - 8);
      }
    } else if (placement === "left") {
      left = rect.left - popoverWidth - 4;
      top = rect.top;
      if (left < 8) left = 8;
      if (top + popoverHeight > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - popoverHeight - 8);
      }
    } else {
      // Bottom placement — center horizontally on screen for mobile
      top = rect.bottom + 4;
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        left = Math.round((window.innerWidth - popoverWidth) / 2);
      } else {
        left = rect.left;
        if (left + popoverWidth > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - popoverWidth - 8);
        }
      }
    }
    return { top, left };
  }, [anchorRef, placement]);

  // Position the popover relative to the anchor element
  useLayoutEffect(() => {
    if (!open) return;
    setPos(computePosition());
  }, [open, computePosition]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => setPos(computePosition());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && !anchorRef.current?.contains(target)) {
        // Delay close so that the input's blur event fires first, committing any edits
        requestAnimationFrame(() => onClose());
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      style={pos ? { position: "fixed", top: pos.top, left: pos.left } : { position: "fixed", top: -9999, left: -9999 }}
      className={cn(
        "z-[9999] max-w-[calc(100vw-1rem)] animate-message-in rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-xl",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Editable inline text field */
function InlineEdit({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef(0);
  const isTouchRef = useRef(false);
  const [showTip, setShowTip] = useState(false);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    const t = draft.trim();
    if (t !== value) onSave(t);
    setEditing(false);
  };

  const handleTouchStart = useCallback(() => {
    isTouchRef.current = true;
  }, []);

  const handleClick = useCallback(() => {
    if (!isTouchRef.current) {
      setDraft(value);
      setEditing(true);
      return;
    }
    isTouchRef.current = false;
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      setShowTip(false);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      setDraft(value);
      setEditing(true);
    } else {
      setShowTip(true);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      tipTimerRef.current = setTimeout(() => setShowTip(false), 2500);
    }
    lastTapRef.current = now;
  }, [value]);

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={commit}
        className={cn(
          "bg-white/5 rounded px-1.5 py-0.5 text-[0.625rem] text-white/80 outline-none border border-white/10 focus:border-purple-400/40",
          className,
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      title={value || undefined}
      className={cn(
        "group relative flex items-center gap-1 text-left hover:bg-white/5 rounded px-0.5 transition-colors min-w-0",
        className,
      )}
    >
      <span className="text-[0.625rem] text-white/60 overflow-x-auto whitespace-nowrap scrollbar-hide min-w-0">
        {value || <span className="italic text-white/25">{placeholder ?? "—"}</span>}
      </span>
      <Pencil size="0.4375rem" className="opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />
      {showTip && value && (
        <span className="absolute bottom-full left-0 mb-1 max-w-[12rem] break-words rounded bg-black/90 border border-white/10 px-1.5 py-1 text-[0.5625rem] text-white/80 z-[9999] pointer-events-none animate-message-in whitespace-normal">
          {value}
        </span>
      )}
    </button>
  );
}

// ── Present Characters Widget ────────────────

function CharactersWidget({
  characters,
  onUpdate,
  layout = "top",
}: {
  characters: PresentCharacter[];
  onUpdate: (chars: PresentCharacter[]) => void;
  layout?: HudPosition;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const addCharacter = () => {
    onUpdate([
      ...characters,
      {
        characterId: `manual-${Date.now()}`,
        name: "New Character",
        emoji: "👤",
        mood: "",
        appearance: null,
        outfit: null,
        customFields: {},
        stats: [],
        thoughts: null,
      },
    ]);
  };

  const removeCharacter = (idx: number) => {
    onUpdate(characters.filter((_, i) => i !== idx));
  };

  const updateCharacter = (idx: number, updated: PresentCharacter) => {
    const next = [...characters];
    next[idx] = updated;
    onUpdate(next);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(WIDGET, "text-purple-300")}
        title="Present Characters"
      >
        {characters.length > 0 ? (
          <div className="flex items-center -space-x-0.5">
            {characters.slice(0, 3).map((c, i) => (
              <span key={i} className="text-xs max-md:text-[0.5625rem] leading-none">
                {c.emoji || "👤"}
              </span>
            ))}
            {characters.length > 3 && (
              <span className="text-[0.4375rem] text-white/40 ml-0.5">+{characters.length - 3}</span>
            )}
          </div>
        ) : (
          <Users size="0.875rem" className="text-purple-400/50 max-md:h-3.5 max-md:w-3.5" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-72 max-h-80 overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[0.625rem] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Users size="0.625rem" /> Present Characters
          </span>
          <button
            onClick={addCharacter}
            className="flex items-center gap-0.5 text-[0.625rem] text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Plus size="0.625rem" /> Add
          </button>
        </div>
        <div className="p-2 space-y-2">
          {characters.length === 0 && (
            <div className="text-[0.625rem] text-white/30 text-center py-2">No characters in scene</div>
          )}
          {characters.map((char, idx) => (
            <div key={char.characterId ?? idx} className="rounded-lg bg-white/5 p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <InlineEdit
                  value={char.emoji || "👤"}
                  onSave={(v) => updateCharacter(idx, { ...char, emoji: v })}
                  className="w-8 text-center !text-sm"
                />
                <InlineEdit
                  value={char.name}
                  onSave={(v) => updateCharacter(idx, { ...char, name: v })}
                  className="flex-1 !font-medium"
                  placeholder="Name"
                />
                <button
                  onClick={() => removeCharacter(idx)}
                  className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                  title="Remove character"
                >
                  <X size="0.625rem" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pl-1">
                <LabeledEdit
                  label="Mood"
                  value={char.mood}
                  onSave={(v) => updateCharacter(idx, { ...char, mood: v })}
                />
                <LabeledEdit
                  label="Look"
                  value={char.appearance ?? ""}
                  onSave={(v) => updateCharacter(idx, { ...char, appearance: v || null })}
                />
                <LabeledEdit
                  label="Outfit"
                  value={char.outfit ?? ""}
                  onSave={(v) => updateCharacter(idx, { ...char, outfit: v || null })}
                />
                <LabeledEdit
                  label="Thinks"
                  value={char.thoughts ?? ""}
                  onSave={(v) => updateCharacter(idx, { ...char, thoughts: v || null })}
                />
              </div>
              {char.stats?.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-white/5">
                  {char.stats.map((stat, si) => (
                    <StatBarEditable
                      key={stat.name}
                      stat={stat}
                      onUpdateValue={(v) => {
                        const next = [...(char.stats ?? [])];
                        next[si] = { ...next[si]!, value: v };
                        updateCharacter(idx, { ...char, stats: next });
                      }}
                      onUpdateMax={(v) => {
                        const next = [...(char.stats ?? [])];
                        next[si] = { ...next[si]!, max: v };
                        updateCharacter(idx, { ...char, stats: next });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </WidgetPopover>
    </div>
  );
}

// ── Stat Bar (shared helper) ─────────────────

function StatBarEditable({
  stat,
  onUpdateName,
  onUpdateValue,
  onUpdateMax,
}: {
  stat: CharacterStat;
  onUpdateName?: (name: string) => void;
  onUpdateValue: (v: number) => void;
  onUpdateMax: (v: number) => void;
}) {
  const pct = stat.max > 0 ? Math.min(100, Math.max(0, (stat.value / stat.max) * 100)) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        {onUpdateName ? (
          <InlineEdit
            value={stat.name}
            onSave={onUpdateName}
            className="!text-[0.625rem] !font-medium !text-white/70"
            placeholder="Stat name"
          />
        ) : (
          <span className="text-[0.625rem] font-medium text-white/70">{stat.name}</span>
        )}
        <div className="flex items-center gap-0.5 shrink-0 text-[0.5625rem] text-white/40">
          <input
            type="number"
            value={stat.value}
            onChange={(e) => onUpdateValue(Number(e.target.value))}
            className="w-12 bg-transparent text-right outline-none text-white/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span>/</span>
          <input
            type="number"
            value={stat.max}
            onChange={(e) => onUpdateMax(Number(e.target.value))}
            className="w-12 bg-transparent outline-none text-white/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: stat.color || "#8b5cf6" }}
        />
      </div>
    </div>
  );
}

// ── Persona Stats Widget ─────────────────────

function PersonaStatsWidget({
  bars,
  onUpdate,
  layout = "top",
}: {
  bars: CharacterStat[];
  onUpdate: (bars: CharacterStat[]) => void;
  layout?: HudPosition;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updateBar = (idx: number, field: "value" | "max" | "name", val: number | string) => {
    const next = [...bars];
    next[idx] = { ...next[idx]!, [field]: val };
    onUpdate(next);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(WIDGET, "text-violet-300")}
        title="Persona Stats"
      >
        {bars.length > 0 ? (
          <div className="flex w-6 max-md:w-8 flex-col justify-center gap-0.5 max-md:gap-px shrink-0">
            {bars.map((bar) => {
              const pct = bar.max > 0 ? Math.min(100, (bar.value / bar.max) * 100) : 0;
              return (
                <div key={bar.name} className="h-1 max-md:h-px w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: bar.color || "#8b5cf6" }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <BarChart3 size="0.875rem" className="text-violet-400/40 max-md:h-3.5 max-md:w-3.5" />
        )}
        <span className="max-w-full truncate text-[0.5625rem] max-md:text-[0.4375rem] font-semibold leading-tight shrink-0 md:hidden">
          Persona
        </span>
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-60 max-h-80 overflow-y-auto"
      >
        <div className="border-b border-white/5 px-3 py-1.5">
          <span className="text-[0.625rem] font-semibold text-white/50 uppercase tracking-wider">Persona Stats</span>
        </div>
        <div className="p-2 space-y-2">
          {bars.map((bar, idx) => (
            <StatBarEditable
              key={bar.name}
              stat={bar}
              onUpdateName={(n) => updateBar(idx, "name", n)}
              onUpdateValue={(v) => updateBar(idx, "value", v)}
              onUpdateMax={(v) => updateBar(idx, "max", v)}
            />
          ))}
        </div>
      </WidgetPopover>
    </div>
  );
}

// ── Custom Tracker Widget ────────────────────

function CustomTrackerWidget({
  fields,
  onUpdate,
  layout = "top",
}: {
  fields: CustomTrackerField[];
  onUpdate: (fields: CustomTrackerField[]) => void;
  layout?: HudPosition;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  // Cycle through fields every 3 seconds
  useEffect(() => {
    if (fields.length <= 1) return;
    const timer = setInterval(() => {
      setCycleIdx((prev) => (prev + 1) % fields.length);
      setAnimKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, [fields.length]);

  useEffect(() => {
    if (cycleIdx >= fields.length) setCycleIdx(0);
  }, [fields.length, cycleIdx]);

  const addField = () => {
    onUpdate([...fields, { name: "New Field", value: "" }]);
  };

  const removeField = (idx: number) => {
    onUpdate(fields.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, updated: CustomTrackerField) => {
    const next = [...fields];
    next[idx] = updated;
    onUpdate(next);
  };

  const currentField = fields[cycleIdx];
  const previewLabel = currentField
    ? currentField.value
      ? `${currentField.name}: ${currentField.value}`
      : currentField.name
    : "";
  const longestWord = previewLabel.split(/\s+/).reduce((max, w) => Math.max(max, w.length), 0);
  const previewFontSize = Math.max(3.5, Math.min(6, 60 / Math.max(longestWord, 1)));

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(WIDGET, "text-cyan-300")}
        title="Custom Tracker"
      >
        {fields.length > 0 && currentField ? (
          <span
            key={animKey}
            className="w-full px-0.5 text-center font-semibold leading-[1.2] animate-[inventory-cycle_0.4s_ease-out]"
            style={{ fontSize: `${previewFontSize}px` }}
          >
            {previewLabel}
          </span>
        ) : (
          <SlidersHorizontal size="0.875rem" className="text-cyan-400/60 max-md:h-3 max-md:w-3" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-72 max-h-80 overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[0.625rem] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <SlidersHorizontal size="0.625rem" /> Custom Tracker ({fields.length})
          </span>
          <button
            onClick={addField}
            className="flex items-center gap-0.5 text-[0.625rem] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Plus size="0.625rem" /> Add
          </button>
        </div>
        <div className="p-2 space-y-1">
          {fields.length === 0 && (
            <div className="text-[0.625rem] text-white/30 text-center py-2">No fields tracked — add one above</div>
          )}
          {fields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
              <SlidersHorizontal size="0.625rem" className="shrink-0 text-cyan-400/60" />
              <InlineEdit
                value={field.name}
                onSave={(v) => updateField(idx, { ...field, name: v })}
                className="flex-1 min-w-0"
                placeholder="Field name"
              />
              <span className="text-white/20 text-[0.5rem]">=</span>
              <InlineEdit
                value={field.value}
                onSave={(v) => updateField(idx, { ...field, value: v })}
                className="flex-1 min-w-0"
                placeholder="Value"
              />
              <button
                onClick={() => removeField(idx)}
                className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                title="Remove field"
              >
                <X size="0.5625rem" />
              </button>
            </div>
          ))}
        </div>
      </WidgetPopover>
    </div>
  );
}

// ── Inventory Widget ─────────────────────────

function InventoryWidget({
  items,
  onUpdate,
  layout = "top",
}: {
  items: InventoryItem[];
  onUpdate: (items: InventoryItem[]) => void;
  layout?: HudPosition;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  // Cycle through items every 3 seconds
  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCycleIdx((prev) => (prev + 1) % items.length);
      setAnimKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, [items.length]);

  // Reset index if items shrink
  useEffect(() => {
    if (cycleIdx >= items.length) setCycleIdx(0);
  }, [items.length, cycleIdx]);

  const addItem = () => {
    onUpdate([...items, { name: "New Item", description: "", quantity: 1, location: "on_person" }]);
  };

  const removeItem = (idx: number) => {
    onUpdate(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, updated: InventoryItem) => {
    const next = [...items];
    next[idx] = updated;
    onUpdate(next);
  };

  const currentItem = items[cycleIdx];

  // Auto-shrink font so the longest word fits on one line within ~36px usable width
  const itemLabel = currentItem
    ? currentItem.quantity > 1
      ? `${currentItem.name} ×${currentItem.quantity}`
      : currentItem.name
    : "";
  const longestWord = itemLabel.split(/\s+/).reduce((max, w) => Math.max(max, w.length), 0);
  // ~0.6em per char at a given font size; widget inner ≈ 36px → fontSize ≤ 60/longestWord
  const itemFontSize = Math.max(3.5, Math.min(6, 60 / Math.max(longestWord, 1)));

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={() => setOpen(!open)} className={cn(WIDGET, "text-amber-300")} title="Inventory">
        {items.length > 0 && currentItem ? (
          <span
            key={animKey}
            className="w-full px-0.5 text-center font-semibold leading-[1.2] animate-[inventory-cycle_0.4s_ease-out]"
            style={{ fontSize: `${itemFontSize}px` }}
          >
            {itemLabel}
          </span>
        ) : (
          <Package size="0.875rem" className="text-amber-400/60 max-md:h-3 max-md:w-3" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-64 max-h-80 overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[0.625rem] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Package size="0.625rem" /> Inventory ({items.length})
          </span>
          <button
            onClick={addItem}
            className="flex items-center gap-0.5 text-[0.625rem] text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Plus size="0.625rem" /> Add
          </button>
        </div>
        <div className="p-2 space-y-1">
          {items.length === 0 && <div className="text-[0.625rem] text-white/30 text-center py-2">Inventory empty</div>}
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
              <Package size="0.625rem" className="shrink-0 text-amber-400/60" />
              <InlineEdit
                value={item.name}
                onSave={(v) => updateItem(idx, { ...item, name: v })}
                className="flex-1 min-w-0"
                placeholder="Item name"
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(idx, { ...item, quantity: Math.max(0, Number(e.target.value)) })}
                className="w-8 bg-transparent text-center text-[0.5625rem] text-white/40 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Quantity"
              />
              <button
                onClick={() => removeItem(idx)}
                className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                title="Remove item"
              >
                <X size="0.5625rem" />
              </button>
            </div>
          ))}
        </div>
      </WidgetPopover>
    </div>
  );
}

// ── Quests Widget ────────────────────────────

function QuestsWidget({
  quests,
  onUpdate,
  layout = "top",
}: {
  quests: QuestProgress[];
  onUpdate: (quests: QuestProgress[]) => void;
  layout?: HudPosition;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Find the first incomplete objective from the first incomplete quest
  const mainQuest = quests.find((q) => !q.completed);
  const currentObjective = mainQuest?.objectives.find((o) => !o.completed);

  const addQuest = () => {
    onUpdate([
      ...quests,
      {
        questEntryId: `manual-${Date.now()}`,
        name: "New Quest",
        currentStage: 0,
        objectives: [{ text: "Objective 1", completed: false }],
        completed: false,
      },
    ]);
  };

  const removeQuest = (idx: number) => {
    onUpdate(quests.filter((_, i) => i !== idx));
  };

  const updateQuest = (idx: number, updated: QuestProgress) => {
    const next = [...quests];
    next[idx] = updated;
    onUpdate(next);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(WIDGET, "text-emerald-300")}
        title="Active Quests"
      >
        {currentObjective ? (
          <span className="widget-scroll-text w-full px-0.5 text-center text-[0.375rem] font-semibold leading-[1.15] max-md:text-[0.5rem]">
            <span className="inline-flex animate-[widget-scroll_8s_linear_infinite] whitespace-nowrap">
              <span className="px-3">{currentObjective.text}</span>
              <span className="px-3" aria-hidden>
                {currentObjective.text}
              </span>
            </span>
          </span>
        ) : (
          <Scroll size="0.875rem" className="text-emerald-400/60 max-md:h-3 max-md:w-3" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-72 max-h-96 overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[0.625rem] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Scroll size="0.625rem" /> Quests ({quests.length})
          </span>
          <button
            onClick={addQuest}
            className="flex items-center gap-0.5 text-[0.625rem] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Plus size="0.625rem" /> Add
          </button>
        </div>
        <div className="p-2 space-y-2">
          {quests.length === 0 && (
            <div className="text-[0.625rem] text-white/30 text-center py-2">No active quests</div>
          )}
          {quests.map((quest, idx) => (
            <QuestCardEditable
              key={quest.questEntryId || idx}
              quest={quest}
              onUpdate={(q) => updateQuest(idx, q)}
              onRemove={() => removeQuest(idx)}
            />
          ))}
        </div>
      </WidgetPopover>
    </div>
  );
}

function QuestCardEditable({
  quest,
  onUpdate,
  onRemove,
}: {
  quest: QuestProgress;
  onUpdate: (q: QuestProgress) => void;
  onRemove: () => void;
}) {
  const addObjective = () => {
    onUpdate({
      ...quest,
      objectives: [...quest.objectives, { text: "New objective", completed: false }],
    });
  };

  const toggleObjective = (oIdx: number) => {
    const next = [...quest.objectives];
    next[oIdx] = { ...next[oIdx]!, completed: !next[oIdx]!.completed };
    onUpdate({ ...quest, objectives: next });
  };

  const removeObjective = (oIdx: number) => {
    onUpdate({ ...quest, objectives: quest.objectives.filter((_, i) => i !== oIdx) });
  };

  const updateObjectiveText = (oIdx: number, text: string) => {
    const next = [...quest.objectives];
    next[oIdx] = { ...next[oIdx]!, text };
    onUpdate({ ...quest, objectives: next });
  };

  const completed = quest.objectives.filter((o) => o.completed).length;
  const total = quest.objectives.length;

  return (
    <div className="rounded-lg bg-white/5 p-2">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onUpdate({ ...quest, completed: !quest.completed })}
          title={quest.completed ? "Mark incomplete" : "Mark complete"}
        >
          {quest.completed ? (
            <CheckCircle2 size="0.6875rem" className="text-emerald-400 shrink-0" />
          ) : (
            <Target size="0.6875rem" className="text-amber-400 shrink-0" />
          )}
        </button>
        <InlineEdit
          value={quest.name}
          onSave={(v) => onUpdate({ ...quest, name: v })}
          className={cn("flex-1 !font-medium", quest.completed && "line-through opacity-50")}
          placeholder="Quest name"
        />
        {total > 0 && (
          <span className="text-[0.5625rem] text-white/30">
            {completed}/{total}
          </span>
        )}
        <button
          onClick={onRemove}
          className="text-white/20 hover:text-red-400 transition-colors shrink-0"
          title="Remove quest"
        >
          <X size="0.5625rem" />
        </button>
      </div>
      {!quest.completed && (
        <div className="mt-1 space-y-0.5 pl-4">
          {quest.objectives.map((obj, oIdx) => (
            <div key={oIdx} className="group flex items-center gap-1 text-[0.5625rem]">
              <button onClick={() => toggleObjective(oIdx)}>
                {obj.completed ? (
                  <CheckCircle2 size="0.5rem" className="text-emerald-400/60 shrink-0" />
                ) : (
                  <Circle size="0.5rem" className="text-white/20 shrink-0" />
                )}
              </button>
              <InlineEdit
                value={obj.text}
                onSave={(v) => updateObjectiveText(oIdx, v)}
                className={cn("flex-1", obj.completed && "line-through opacity-50")}
                placeholder="Objective"
              />
              <button
                onClick={() => removeObjective(oIdx)}
                className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all shrink-0"
              >
                <X size="0.4375rem" />
              </button>
            </div>
          ))}
          <button
            onClick={addObjective}
            className="flex items-center gap-0.5 text-[0.5rem] text-white/20 hover:text-white/50 transition-colors mt-0.5"
          >
            <Plus size="0.4375rem" /> objective
          </button>
        </div>
      )}
    </div>
  );
}

// ── Labeled inline edit (for character detail fields) ──

function LabeledEdit({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[0.5625rem] text-white/30 w-10 shrink-0">{label}</span>
      <InlineEdit value={value} onSave={onSave} className="flex-1 min-w-0" placeholder="—" />
    </div>
  );
}

// ═══════════════════════════════════════════════
// Uniform World-State Widgets
// ═══════════════════════════════════════════════

const WIDGET =
  "group flex w-10 h-10 max-md:w-auto max-md:h-auto max-md:px-2 max-md:py-1.5 flex-col items-center justify-center gap-0.5 max-md:gap-0 rounded-xl max-md:rounded-lg border border-white/15 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 cursor-pointer select-none overflow-hidden";
const WIDGET_EDIT =
  "flex w-10 h-10 max-md:w-auto max-md:h-auto max-md:px-2 max-md:py-1.5 flex-col items-center justify-center gap-0.5 max-md:gap-0 rounded-xl max-md:rounded-lg border border-white/15 bg-black/60 backdrop-blur-md overflow-hidden";

/** Hook: mobile single-tap = tooltip, double-tap = edit; desktop click = edit */
function useWidgetTap(onEdit: () => void) {
  const [showTip, setShowTip] = useState(false);
  const lastTapRef = useRef(0);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchRef = useRef(false);

  const handleTouchStart = useCallback(() => {
    isTouchRef.current = true;
  }, []);

  const handleClick = useCallback(() => {
    if (!isTouchRef.current) {
      onEdit();
      return;
    }
    isTouchRef.current = false;
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      setShowTip(false);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      onEdit();
    } else {
      setShowTip(true);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      tipTimerRef.current = setTimeout(() => setShowTip(false), 2000);
    }
    lastTapRef.current = now;
  }, [onEdit]);

  return { showTip, handleClick, handleTouchStart };
}

/** Truncated label with optional tooltip */
function WidgetLabel({
  value,
  fallback,
  showTip,
  className,
}: {
  value: string;
  fallback: string;
  showTip?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative w-full max-md:px-0.5", className)}>
      <span
        className={cn(
          "block mx-auto max-w-[4.5rem] max-md:max-w-full truncate text-center text-[0.5625rem] max-md:text-[0.4375rem] font-semibold leading-tight",
          !value && "italic opacity-40",
        )}
      >
        {value || fallback}
      </span>
      {showTip && value && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-black/90 border border-white/10 px-1.5 py-0.5 text-[0.5625rem] text-white/80 z-[9999] pointer-events-none animate-message-in">
          {value}
        </span>
      )}
    </span>
  );
}

function WidgetInput({
  value,
  onSave,
  onCancel,
  accent,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  accent: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const commit = () => {
    const t = draft.trim();
    if (t && t !== value) onSave(t);
    onCancel();
  };
  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel();
      }}
      onBlur={commit}
      className={cn(
        "w-[4.5rem] max-md:w-full max-md:px-0.5 bg-transparent text-center text-[0.5625rem] max-md:text-[0.625rem] font-medium outline-none placeholder:text-white/20",
        accent,
      )}
    />
  );
}

// ═══════════════════════════════════════════════
// Combined World-State Widget (icon strip + popover, desktop & mobile)
// ═══════════════════════════════════════════════

function CombinedWorldWidget({
  location,
  date,
  time,
  weather,
  temperature,
  onSaveLocation,
  onSaveDate,
  onSaveTime,
  onSaveWeather,
  onSaveTemperature,
  layout,
}: {
  location: string;
  date: string;
  time: string;
  weather: string;
  temperature: string;
  onSaveLocation: (v: string) => void;
  onSaveDate: (v: string) => void;
  onSaveTime: (v: string) => void;
  onSaveWeather: (v: string) => void;
  onSaveTemperature: (v: string) => void;
  layout: "top" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const weatherEmoji = weather ? getWeatherEmoji(weather) : "🌤️";
  const pinColor = getLocationPinColor(location);
  const tempNumeric = temperature ? parseTemperature(temperature) : null;
  const temp = tempNumeric ?? (temperature ? getTemperatureKeywordHint(temperature) : null);
  const tempColor =
    temp !== null
      ? temp < 0
        ? "text-blue-400"
        : temp < 15
          ? "text-sky-400"
          : temp < 30
            ? "text-amber-400"
            : "text-red-400"
      : "text-rose-400/50";

  // Dynamic calendar: show day number
  const dateParts = date ? parseDateLabel(date) : { day: null, month: null };

  // Dynamic clock: compute hand angles
  const hour = time ? extractHourFromTime(time) : -1;
  const minute = time ? parseMinutes(time) : 0;
  const hourAngle = hour >= 0 ? (hour % 12) * 30 + minute * 0.5 : 0;
  const minuteAngle = minute * 6;

  // Thermometer fill fraction (clamp -20..50°C → 0..1)
  const tempFill = temp !== null ? Math.max(0, Math.min(1, (temp + 20) / 70)) : 0.3;
  const tempFillColor =
    temp !== null ? (temp < 0 ? "#60a5fa" : temp < 15 ? "#38bdf8" : temp < 30 ? "#fbbf24" : "#f87171") : "#fb7185";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 md:gap-1 rounded-lg border border-white/10 bg-black/40 backdrop-blur-md px-2 py-1.5 md:px-2 md:py-2 md:h-10 transition-all hover:bg-black/60 cursor-pointer select-none",
          open && "bg-black/60 border-white/20",
        )}
        title="World State"
      >
        {/* Location pin */}
        <MapPin size="0.9375rem" className={cn(pinColor, "drop-shadow-sm shrink-0")} />

        {/* Mini calendar with day number */}
        <svg viewBox="0 0 20 20" fill="none" className="shrink-0 h-4 w-4">
          <rect
            x="2"
            y="4"
            width="16"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-violet-400/70"
          />
          <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.2" className="text-violet-400/50" />
          <line
            x1="6"
            y1="2"
            x2="6"
            y2="5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-violet-400/70"
          />
          <line
            x1="14"
            y1="2"
            x2="14"
            y2="5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-violet-400/70"
          />
          {dateParts.day && (
            <text
              x="10"
              y="15.5"
              textAnchor="middle"
              fill="currentColor"
              fontSize="7"
              fontWeight="700"
              className="text-violet-300"
            >
              {dateParts.day}
            </text>
          )}
        </svg>

        {/* Mini clock with dynamic hands */}
        <svg viewBox="0 0 20 20" fill="none" className="shrink-0 h-4 w-4">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" className="text-amber-400/70" />
          {hour >= 0 ? (
            <>
              <line
                x1="10"
                y1="10"
                x2={10 + 4.2 * Math.sin((hourAngle * Math.PI) / 180)}
                y2={10 - 4.2 * Math.cos((hourAngle * Math.PI) / 180)}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="text-amber-300"
              />
              <line
                x1="10"
                y1="10"
                x2={10 + 5.8 * Math.sin((minuteAngle * Math.PI) / 180)}
                y2={10 - 5.8 * Math.cos((minuteAngle * Math.PI) / 180)}
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                className="text-amber-400/80"
              />
            </>
          ) : (
            <>
              <line
                x1="10"
                y1="10"
                x2="10"
                y2="5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="text-amber-300"
              />
              <line
                x1="10"
                y1="10"
                x2="14"
                y2="10"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                className="text-amber-400/80"
              />
            </>
          )}
          <circle cx="10" cy="10" r="1" fill="currentColor" className="text-amber-300" />
        </svg>

        {/* Weather emoji */}
        <span className="text-sm leading-none shrink-0">{weatherEmoji}</span>

        {/* Mini thermometer with fill — vivid color & fill level changes dynamically */}
        <svg viewBox="0 0 10 20" fill="none" className="shrink-0 h-4 w-[0.625rem]">
          <rect
            x="3"
            y="1"
            width="4"
            height="13"
            rx="2"
            stroke={tempFillColor}
            strokeWidth="1.2"
            fill="none"
            opacity={temp !== null ? 1 : 0.3}
          />
          <rect
            x="3.8"
            y={1 + 12 * (1 - tempFill)}
            width="2.4"
            height={12 * tempFill + 1}
            rx="1"
            fill={tempFillColor}
            opacity={temp !== null ? 0.9 : 0.2}
          />
          <circle cx="5" cy="17" r="2.5" fill={tempFillColor} opacity={temp !== null ? 1 : 0.25} />
        </svg>
        {tempNumeric !== null && (
          <span className={cn("text-[0.5rem] md:text-[0.5625rem] font-bold leading-none shrink-0", tempColor)}>
            {tempNumeric}°
          </span>
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"}
        className="w-64"
      >
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[0.625rem] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <CloudSun size="0.625rem" /> World State
          </span>
          <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 transition-colors">
            <X size="0.75rem" />
          </button>
        </div>
        <div className="divide-y divide-white/5">
          <WorldFieldRow
            icon={<MapPin size="0.8125rem" className={pinColor} />}
            label="Location"
            value={location}
            onSave={onSaveLocation}
            accent="text-emerald-300"
          />
          <WorldFieldRow
            icon={<CalendarDays size="0.8125rem" className="text-violet-400" />}
            label="Date"
            value={date}
            onSave={onSaveDate}
            accent="text-violet-300"
          />
          <WorldFieldRow
            icon={<Clock size="0.8125rem" className="text-amber-400" />}
            label="Time"
            value={time}
            onSave={onSaveTime}
            accent="text-amber-300"
          />
          <WorldFieldRow
            icon={<span className="text-sm leading-none">{weatherEmoji}</span>}
            label="Weather"
            value={weather}
            onSave={onSaveWeather}
            accent="text-sky-300"
          />
          <WorldFieldRow
            icon={<Thermometer size="0.8125rem" className={tempColor} />}
            label="Temperature"
            value={temperature}
            onSave={onSaveTemperature}
            accent="text-rose-300"
          />
        </div>
      </WidgetPopover>
    </div>
  );
}

/** Single editable row inside the CombinedWorldWidget popover */
function WorldFieldRow({
  icon,
  label,
  value,
  onSave,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onSave: (v: string) => void;
  accent: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.focus();
    }
  }, [editing, value]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== value) onSave(t);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 group/row hover:bg-white/5 transition-colors">
      <div className="shrink-0 w-5 flex items-center justify-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.5625rem] font-semibold uppercase tracking-wider text-white/30 mb-0.5">{label}</div>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={commit}
            className={cn(
              "w-full bg-transparent text-[0.6875rem] font-medium outline-none placeholder:text-white/20",
              accent,
            )}
            placeholder={label}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              "w-full text-left text-[0.6875rem] font-medium truncate",
              value ? "text-white/70" : "text-white/25 italic",
            )}
          >
            {value || `Set ${label.toLowerCase()}…`}
          </button>
        )}
      </div>
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-white/15 opacity-0 group-hover/row:opacity-100 transition-opacity"
          title={`Edit ${label.toLowerCase()}`}
        >
          <Pencil size="0.625rem" />
        </button>
      )}
    </div>
  );
}

// ── Location Widget ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LocationWidget({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const { showTip, handleClick, handleTouchStart } = useWidgetTap(() => setEditing(true));

  if (editing) {
    return (
      <div className={cn(WIDGET_EDIT, "text-emerald-300")}>
        <MapPin size="0.875rem" className="text-emerald-400/60 mb-0.5 max-md:h-3 max-md:w-3 max-md:mb-0" />
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-emerald-300" />
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      className={cn(WIDGET, "text-emerald-300", showTip && "z-50", className)}
      title={value || "Click to edit location"}
    >
      <div className="relative flex h-7 max-md:h-4 items-center justify-center shrink-0">
        <div className="absolute inset-0 rounded-md overflow-hidden opacity-40">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-950/60" />
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 28">
            <line
              x1="0"
              y1="9"
              x2="56"
              y2="9"
              stroke="currentColor"
              strokeWidth="0.3"
              className="text-emerald-400/30"
            />
            <line
              x1="0"
              y1="19"
              x2="56"
              y2="19"
              stroke="currentColor"
              strokeWidth="0.3"
              className="text-emerald-400/30"
            />
            <line
              x1="14"
              y1="0"
              x2="14"
              y2="28"
              stroke="currentColor"
              strokeWidth="0.3"
              className="text-emerald-400/30"
            />
            <line
              x1="28"
              y1="0"
              x2="28"
              y2="28"
              stroke="currentColor"
              strokeWidth="0.3"
              className="text-emerald-400/30"
            />
            <line
              x1="42"
              y1="0"
              x2="42"
              y2="28"
              stroke="currentColor"
              strokeWidth="0.3"
              className="text-emerald-400/30"
            />
            <circle cx="20" cy="14" r="5" fill="currentColor" className="text-emerald-600/20" />
            <circle cx="38" cy="10" r="4" fill="currentColor" className="text-emerald-600/15" />
            <path
              d="M8 20 Q14 12 22 18 Q30 24 40 16"
              stroke="currentColor"
              strokeWidth="0.5"
              fill="none"
              className="text-emerald-400/25"
            />
          </svg>
        </div>
        <MapPin
          size="0.875rem"
          className="relative text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)] max-md:h-3 max-md:w-3"
        />
      </div>
      <WidgetLabel value={value} fallback="Location" showTip={showTip} />
    </button>
  );
}

// ── Calendar Widget ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CalendarWidget({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const { showTip, handleClick, handleTouchStart } = useWidgetTap(() => setEditing(true));
  const { day, month } = value ? parseDateLabel(value) : { day: null, month: null };

  if (editing) {
    return (
      <div className={cn(WIDGET_EDIT, "text-violet-300")}>
        <CalendarDays size="0.875rem" className="text-violet-400/60 mb-0.5 max-md:h-3 max-md:w-3 max-md:mb-0" />
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-violet-300" />
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      className={cn(WIDGET, "text-violet-300", showTip && "z-50", className)}
      title={value || "Click to edit date"}
    >
      <div className="flex h-7 max-md:h-4 flex-col rounded-sm border border-violet-400/30 overflow-hidden bg-violet-950/30 shrink-0">
        <div className="flex h-2.5 max-md:h-1.5 items-center justify-center bg-violet-500/25">
          <span className="text-[5px] max-md:text-[3px] font-bold uppercase tracking-wider text-violet-300/80">
            {month || "———"}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-[0.75rem] max-md:text-[0.5rem] font-bold leading-none text-violet-200/80">
            {day || "?"}
          </span>
        </div>
      </div>
      <WidgetLabel value={value} fallback="Date" showTip={showTip} />
    </button>
  );
}

// ── Clock Widget ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ClockWidget({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const { showTip, handleClick, handleTouchStart } = useWidgetTap(() => setEditing(true));
  const hour = value ? extractHourFromTime(value) : -1;
  const hourAngle = hour >= 0 ? ((hour % 12) / 12) * 360 - 90 : -90;
  const minuteAngle = hour >= 0 ? (parseMinutes(value) / 60) * 360 - 90 : 90;

  if (editing) {
    return (
      <div className={cn(WIDGET_EDIT, "text-amber-300")}>
        <Clock size="0.875rem" className="text-amber-400/60 mb-0.5 max-md:h-3 max-md:w-3 max-md:mb-0" />
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-amber-300" />
      </div>
    );
  }

  const period = value ? getTimePeriod(value) : null;

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      className={cn(WIDGET, "text-amber-300", showTip && "z-50", className)}
      title={value || "Click to edit time"}
    >
      <div className="relative flex h-7 max-md:h-4 items-center justify-center shrink-0">
        <svg viewBox="0 0 32 32" className="h-full w-full">
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            className="text-amber-400/30"
          />
          <circle cx="16" cy="16" r="12.5" fill="currentColor" className="text-amber-950/30" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const x1 = 16 + Math.cos(a) * 10.5;
            const y1 = 16 + Math.sin(a) * 10.5;
            const x2 = 16 + Math.cos(a) * 12;
            const y2 = 16 + Math.sin(a) * 12;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth={i % 3 === 0 ? "1" : "0.5"}
                className="text-amber-400/50"
              />
            );
          })}
          <line
            x1="16"
            y1="16"
            x2={16 + Math.cos((hourAngle * Math.PI) / 180) * 6.5}
            y2={16 + Math.sin((hourAngle * Math.PI) / 180) * 6.5}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            className="text-amber-300/80"
          />
          <line
            x1="16"
            y1="16"
            x2={16 + Math.cos((minuteAngle * Math.PI) / 180) * 9}
            y2={16 + Math.sin((minuteAngle * Math.PI) / 180) * 9}
            stroke="currentColor"
            strokeWidth="0.7"
            strokeLinecap="round"
            className="text-amber-200/60"
          />
          <circle cx="16" cy="16" r="1" fill="currentColor" className="text-amber-400/70" />
        </svg>
      </div>
      <WidgetLabel value={value || period || ""} fallback="Time" showTip={showTip} />
    </button>
  );
}

// ── Weather Widget ───────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WeatherWidget({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const { showTip, handleClick, handleTouchStart } = useWidgetTap(() => setEditing(true));
  const emoji = value ? getWeatherEmoji(value) : "🌤️";

  if (editing) {
    return (
      <div className={cn(WIDGET_EDIT, "text-sky-300")}>
        <span className="text-base max-md:text-xs mb-0.5">{emoji}</span>
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-sky-300" />
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      className={cn(WIDGET, "text-sky-300", showTip && "z-50", className)}
      title={value || "Click to edit weather"}
    >
      <div className="flex h-7 max-md:h-4 items-center justify-center shrink-0">
        <span className="text-xl max-md:text-xs leading-none drop-shadow-[0_0_6px_rgba(56,189,248,0.3)]">{emoji}</span>
      </div>
      <WidgetLabel value={value} fallback="Weather" showTip={showTip} />
    </button>
  );
}

// ── Temperature Widget ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TemperatureWidget({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const { showTip, handleClick, handleTouchStart } = useWidgetTap(() => setEditing(true));
  const tempNumeric = value ? parseTemperature(value) : null;
  const temp = tempNumeric ?? (value ? getTemperatureKeywordHint(value) : null);
  const fillPct = temp !== null ? Math.max(5, Math.min(100, ((temp + 20) / 65) * 100)) : 40;
  const fillColor =
    temp !== null
      ? temp < 0
        ? "text-blue-400"
        : temp < 15
          ? "text-sky-400"
          : temp < 30
            ? "text-amber-400"
            : "text-red-400"
      : "text-rose-400/50";

  if (editing) {
    return (
      <div className={cn(WIDGET_EDIT, "text-rose-300")}>
        <Thermometer size="0.875rem" className="text-rose-400/60 mb-0.5 max-md:h-3 max-md:w-3 max-md:mb-0" />
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-rose-300" />
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      className={cn(WIDGET, "text-rose-300", showTip && "z-50", className)}
      title={value || "Click to edit temperature"}
    >
      <div className="relative flex h-7 max-md:h-4 items-center justify-center shrink-0">
        <svg viewBox="0 0 16 32" className="h-full" style={{ width: "auto" }}>
          <rect
            x="5.5"
            y="3"
            width="5"
            height="20"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.7"
            className={temp !== null ? fillColor : "text-rose-400/20"}
          />
          <rect
            x="6.5"
            y={3 + 18 * (1 - fillPct / 100)}
            width="3"
            height={Math.max(1, 18 * (fillPct / 100))}
            rx="1.5"
            fill="currentColor"
            className={fillColor}
            opacity={temp !== null ? 1 : 0.2}
          />
          <circle
            cx="8"
            cy="26"
            r="3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.7"
            className={temp !== null ? fillColor : "text-rose-400/20"}
          />
          <circle cx="8" cy="26" r="2.5" fill="currentColor" className={fillColor} opacity={temp !== null ? 1 : 0.25} />
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line
              key={i}
              x1="10.5"
              y1={3 + 18 * (1 - t)}
              x2="12"
              y2={3 + 18 * (1 - t)}
              stroke="currentColor"
              strokeWidth="0.4"
              className="text-rose-400/25"
            />
          ))}
        </svg>
      </div>
      <WidgetLabel value={tempNumeric !== null ? `${tempNumeric}°` : value} fallback="Temp" showTip={showTip} />
    </button>
  );
}

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

function parseDateLabel(date: string): { day: string | null; month: string | null } {
  const numMatch = date.match(/(\d+)/);
  const day = numMatch ? numMatch[1] : null;
  const words = date
    .replace(/\d+(st|nd|rd|th)?/gi, "")
    .split(/[\s,/.-]+/)
    .filter((w) => w.length > 2);
  const month = words[0]?.slice(0, 3) ?? null;
  return { day, month };
}

function extractHourFromTime(time: string): number {
  const t = time.toLowerCase();
  const m24 = t.match(/\b(\d{1,2})[:.h](\d{2})\b/);
  if (m24) {
    let h = parseInt(m24[1]!, 10);
    if (t.includes("pm") && h < 12) h += 12;
    if (t.includes("am") && h === 12) h = 0;
    if (h >= 0 && h < 24) return h;
  }
  const mAP = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (mAP) {
    let h = parseInt(mAP[1]!, 10);
    if (mAP[2] === "pm" && h < 12) h += 12;
    if (mAP[2] === "am" && h === 12) h = 0;
    if (h >= 0 && h < 24) return h;
  }
  if (t.includes("midnight")) return 0;
  if (t.includes("dawn") || t.includes("sunrise")) return 6;
  if (t.includes("morning")) return 9;
  if (t.includes("noon") || t.includes("midday")) return 12;
  if (t.includes("afternoon")) return 15;
  if (t.includes("dusk") || t.includes("sunset") || t.includes("evening")) return 18;
  if (t.includes("night")) return 22;
  return -1;
}

function parseMinutes(time: string): number {
  const m = time.match(/\b\d{1,2}[:.h](\d{2})\b/);
  return m ? parseInt(m[1]!, 10) : 0;
}

function getTimePeriod(time: string): string | null {
  const t = time.toLowerCase();
  if (t.includes("night") || t.includes("midnight")) return "Night";
  if (t.includes("dawn") || t.includes("sunrise")) return "Dawn";
  if (t.includes("morning")) return "Morning";
  if (t.includes("noon") || t.includes("midday")) return "Midday";
  if (t.includes("afternoon")) return "Afternoon";
  if (t.includes("dusk") || t.includes("sunset")) return "Dusk";
  if (t.includes("evening")) return "Evening";
  return null;
}

function getWeatherEmoji(weather: string): string {
  const w = weather.toLowerCase();
  if (w.includes("thunder") || w.includes("lightning")) return "⛈️";
  if (w.includes("blizzard")) return "🌨️";
  if (w.includes("heavy rain") || w.includes("downpour") || w.includes("storm")) return "🌧️";
  if (w.includes("rain") || w.includes("drizzle") || w.includes("shower")) return "🌦️";
  if (w.includes("hail")) return "🧊";
  if (w.includes("snow") || w.includes("sleet") || w.includes("frost")) return "❄️";
  if (w.includes("fog") || w.includes("mist") || w.includes("haze")) return "🌫️";
  if (w.includes("sand") || w.includes("dust")) return "🏜️";
  if (w.includes("ash") || w.includes("volcanic") || w.includes("smoke")) return "🌋";
  if (w.includes("ember") || w.includes("fire") || w.includes("inferno")) return "🔥";
  if (w.includes("wind") || w.includes("breez") || w.includes("gust")) return "💨";
  if (w.includes("cherry") || w.includes("blossom") || w.includes("petal")) return "🌸";
  if (w.includes("aurora") || w.includes("northern light")) return "🌌";
  if (w.includes("cloud") || w.includes("overcast") || w.includes("grey") || w.includes("gray")) return "☁️";
  if (w.includes("clear") || w.includes("sunny") || w.includes("bright")) return "☀️";
  if (w.includes("hot") || w.includes("swelter")) return "🥵";
  if (w.includes("cold") || w.includes("freez")) return "🥶";
  return "🌤️";
}

function parseTemperature(temp: string): number | null {
  const m = temp.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const num = parseFloat(m[0]!);
  if (/°?\s*f/i.test(temp)) return Math.round((num - 32) * (5 / 9));
  return Math.round(num);
}

/** Map descriptive temperature words to a numeric-equivalent hint (°C). */
function getTemperatureKeywordHint(text: string): number | null {
  const t = text.toLowerCase();
  if (/\b(freez|frigid|arctic|glacial|sub-?zero|blizzard)/.test(t)) return -10;
  if (/\b(cold|chill|frost|wintry|icy|bitter|nipp)/.test(t)) return 2;
  if (/\b(cool|brisk|crisp|refresh)/.test(t)) return 12;
  if (/\b(mild|pleasant|comfort|temperate|fair)/.test(t)) return 20;
  if (/\b(warm|balmy|toasty|muggy|humid|stuffy|sultry)/.test(t)) return 28;
  if (/\b(hot|swelter|blaz|scorch|burn|heat|boil|sear|bak)/.test(t)) return 38;
  return null;
}

/** Categorise location text into a colour for the map-pin icon. */
function getLocationPinColor(location: string): string {
  const l = location.toLowerCase();
  // Water
  if (
    /\b(sea|ocean|lake|river|pond|creek|bay|shore|beach|harbor|harbour|port|coast|marsh|swamp|waterfall|spring|well|dock|canal|dam|reef|lagoon|estuary|fjord|cove)\b/.test(
      l,
    )
  )
    return "text-blue-400";
  // Mountains / rocky terrain
  if (
    /\b(mountain|hill|cliff|peak|ridge|canyon|gorge|cave|cavern|mine|quarry|summit|bluff|crag|volcano|crater|mesa|plateau|ravine|boulder)\b/.test(
      l,
    )
  )
    return "text-amber-700";
  // Urban / city
  if (
    /\b(city|town|village|castle|palace|fortress|market|shop|inn|tavern|bar|pub|guild|district|quarter|bazaar|temple|church|cathedral|shrine|tower|gate|square|plaza|street|alley|arena|throne|court|capitol|capital|metro|subway)\b/.test(
      l,
    )
  )
    return "text-purple-400";
  // Interior / indoors
  if (
    /\b(room|hall|chamber|dungeon|cellar|basement|attic|library|study|bedroom|kitchen|office|lab|laboratory|vault|corridor|passage|cabin|hut|tent|interior|house|home|building|apartment|manor|lodge|dormitor|warehouse|prison|cell|jail)\b/.test(
      l,
    )
  )
    return "text-amber-300";
  // Nature / forest / fields (broadest — checked last)
  if (
    /\b(forest|wood|grove|jungle|garden|park|field|meadow|glade|clearing|plain|prairie|steppe|savanna|farm|ranch|orchard|vineyard|glen|vale|valley|thicket|copse|heath|moor|desert|tundra|waste|wild|trail|path|road)\b/.test(
      l,
    )
  )
    return "text-emerald-400";
  // Default — the base emerald
  return "text-emerald-400";
}
