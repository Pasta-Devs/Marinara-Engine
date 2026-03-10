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
  ChevronDown,
  ChevronUp,
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
} from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { useGameStateStore } from "../../stores/game-state.store";
import { useAgentStore } from "../../stores/agent.store";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useUIStore } from "../../stores/ui.store";
import type { GameState, PresentCharacter, CharacterStat, InventoryItem, QuestProgress } from "@marinara-engine/shared";
import type { HudPosition } from "../../stores/ui.store";

interface RoleplayHUDProps {
  chatId: string;
  characterCount: number;
  layout?: HudPosition;
}

export function RoleplayHUD({ chatId, characterCount, layout = "top" }: RoleplayHUDProps) {
  const [agentsOpen, setAgentsOpen] = useState(false);
  const gameState = useGameStateStore((s) => s.current);
  const setGameState = useGameStateStore((s) => s.setGameState);

  const { data: agentConfigs } = useAgentConfigs();
  const enabledAgentTypes = useMemo(() => {
    const set = new Set<string>();
    if (agentConfigs) {
      for (const a of agentConfigs as Array<{ type: string; enabled: string }>) {
        if (a.enabled === "true") set.add(a.type);
      }
    }
    return set;
  }, [agentConfigs]);

  const thoughtBubbles = useAgentStore((s) => s.thoughtBubbles);
  const isAgentProcessing = useAgentStore((s) => s.isProcessing);
  const dismissThoughtBubble = useAgentStore((s) => s.dismissThoughtBubble);
  const clearThoughtBubbles = useAgentStore((s) => s.clearThoughtBubbles);

  useEffect(() => {
    if (!chatId) return;
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

  const patchField = useCallback(
    (field: string, value: unknown) => {
      // Optimistic local update
      if (gameState) {
        setGameState({ ...gameState, [field]: value });
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
        const payload = { ...patchQueueRef.current };
        patchQueueRef.current = {};
        api.patch(`/chats/${chatId}/game-state`, payload).catch(() => {});
      }, 500);
    },
    [chatId, gameState, setGameState],
  );

  const patchPlayerStats = useCallback(
    (field: string, value: unknown) => {
      const current = gameState?.playerStats ?? {
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
    [gameState, patchField],
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
    if (gameState) {
      setGameState({ ...gameState, ...cleared } as GameState);
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
  }, [chatId, gameState, setGameState]);

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

  const isVertical = layout === "left" || layout === "right";

  return (
    <div className={cn("rpg-hud", isVertical ? "flex flex-col items-center gap-1.5" : "flex items-center gap-1.5")}>
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
      />

      {/* World State */}
      {enabledAgentTypes.has("world-state") && (
        <>
          <LocationWidget value={location ?? ""} onSave={(v) => patchField("location", v)} />
          <CalendarWidget value={date ?? ""} onSave={(v) => patchField("date", v)} />
          <ClockWidget value={time ?? ""} onSave={(v) => patchField("time", v)} />
          <WeatherWidget value={weather ?? ""} onSave={(v) => patchField("weather", v)} />
          <TemperatureWidget value={temperature ?? ""} onSave={(v) => patchField("temperature", v)} />
        </>
      )}

      {/* Mobile: combined Tracker widget */}
      {(enabledAgentTypes.has("persona-stats") || enabledAgentTypes.has("character-tracker") || enabledAgentTypes.has("quest")) && (
        <div className="md:hidden">
          <CombinedPlayerWidget
            layout={layout}
            showPersona={enabledAgentTypes.has("persona-stats")}
            showCharacters={enabledAgentTypes.has("character-tracker")}
            showQuests={enabledAgentTypes.has("quest")}
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
          />
        </div>
      )}

      {/* Desktop: separate widgets */}
      {enabledAgentTypes.has("persona-stats") && (
        <div className="hidden md:block">
          <PersonaStatsWidget bars={personaStatBars} onUpdate={(bars) => patchField("personaStats", bars)} layout={layout} />
        </div>
      )}
      {enabledAgentTypes.has("character-tracker") && (
        <div className="hidden md:block">
          <CharactersWidget
            characters={presentCharacters}
            layout={layout}
            onUpdate={(chars) => {
              if (gameState) {
                setGameState({ ...gameState, presentCharacters: chars });
              }
              api.patch(`/chats/${chatId}/game-state`, { presentCharacters: chars }).catch(() => {});
            }}
          />
        </div>
      )}
      {enabledAgentTypes.has("persona-stats") && (
        <div className="hidden md:block">
          <InventoryWidget items={inventory} onUpdate={(items) => patchPlayerStats("inventory", items)} layout={layout} />
        </div>
      )}
      {enabledAgentTypes.has("quest") && (
        <div className="hidden md:block">
          <QuestsWidget quests={activeQuests} onUpdate={(q) => patchPlayerStats("activeQuests", q)} layout={layout} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Actions Group (Agents dropdown, Echo Chamber toggle, Clear)
// ═══════════════════════════════════════════════

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
}

function ActionsGroup({
  isVertical,
  agentsOpen,
  setAgentsOpen,
  isAgentProcessing,
  thoughtBubbles,
  clearThoughtBubbles,
  dismissThoughtBubble,
  enabledAgentTypes,
  clearGameState,
}: ActionsGroupProps) {
  return (
    <div className={cn("flex gap-1.5", isVertical ? "flex-col items-center" : "items-center max-md:flex-col")}>
      {/* Agents */}
      <div className="relative">
        <button
          onClick={() => setAgentsOpen(!agentsOpen)}
          className={cn(
            "flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-white/60 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white max-md:px-1.5 max-md:py-0.5 max-md:text-[9px]",
            agentsOpen && "bg-white/10 text-white",
          )}
          title="Agent activity"
        >
          <Sparkles
            size={10}
            className={cn("text-purple-400/70 max-md:h-2.5 max-md:w-2.5", isAgentProcessing && "animate-pulse")}
          />
          <span>Agents</span>
          {thoughtBubbles.length > 0 && (
            <span className="flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-purple-500/80 px-1 text-[8px] font-bold text-white">
              {thoughtBubbles.length}
            </span>
          )}
          {agentsOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>

        {agentsOpen && (
          <div className="absolute right-0 top-full mt-1 w-72 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-xl z-50 animate-message-in">
            {isAgentProcessing && (
              <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
                <Sparkles size={12} className="text-purple-400 animate-pulse" />
                <span className="text-[10px] text-purple-300/80">Agents thinking…</span>
              </div>
            )}
            {thoughtBubbles.length === 0 && !isAgentProcessing && (
              <div className="px-3 py-4 text-center text-[10px] text-white/30">No agent activity yet</div>
            )}
            {thoughtBubbles.length > 0 && (
              <>
                <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
                  <span className="text-[10px] text-white/40">
                    {thoughtBubbles.length} result{thoughtBubbles.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={clearThoughtBubbles}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-col gap-1 p-2">
                  {thoughtBubbles.map((bubble, i) => (
                    <div
                      key={`${bubble.agentId}-${bubble.timestamp}`}
                      className="relative rounded-lg bg-white/5 p-2 text-[10px]"
                    >
                      <button
                        onClick={() => dismissThoughtBubble(i)}
                        className="absolute right-1.5 top-1.5 text-white/20 hover:text-white/60 transition-colors"
                      >
                        <X size={10} />
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
          </div>
        )}
      </div>

      {enabledAgentTypes.has("echo-chamber") && <EchoChamberToggle />}

      <button
        onClick={clearGameState}
        className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-white/60 backdrop-blur-md transition-all hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 max-md:px-1.5 max-md:py-0.5 max-md:text-[9px]"
        title="Clear trackers"
      >
        <Trash2 size={12} className="max-md:h-2.5 max-md:w-2.5" />
        <span>Clear</span>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Echo Chamber Toggle Button
// ═══════════════════════════════════════════════

function EchoChamberToggle() {
  const echoChamberOpen = useUIStore((s) => s.echoChamberOpen);
  const toggleEchoChamber = useUIStore((s) => s.toggleEchoChamber);
  const echoMessages = useAgentStore((s) => s.echoMessages);

  return (
    <button
      onClick={toggleEchoChamber}
      className={cn(
        "flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-white/60 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white",
        echoChamberOpen && "bg-purple-500/20 text-purple-300 border-purple-500/30",
      )}
      title="Toggle Echo Chamber panel"
    >
      <MessageCircle size={10} className="text-purple-400/70" />
      <span>Echo</span>
      {echoMessages.length > 0 && (
        <span className="flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-purple-500/80 px-1 text-[8px] font-bold text-white">
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
  personaStats,
  onUpdatePersonaStats,
  characters,
  onUpdateCharacters,
  inventory,
  onUpdateInventory,
  quests,
  onUpdateQuests,
}: {
  layout?: HudPosition;
  showPersona: boolean;
  showCharacters: boolean;
  showQuests: boolean;
  personaStats: CharacterStat[];
  onUpdatePersonaStats: (bars: CharacterStat[]) => void;
  characters: PresentCharacter[];
  onUpdateCharacters: (chars: PresentCharacter[]) => void;
  inventory: InventoryItem[];
  onUpdateInventory: (items: InventoryItem[]) => void;
  quests: QuestProgress[];
  onUpdateQuests: (quests: QuestProgress[]) => void;
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

  // Count total tracked items for badge
  const totalItems = characters.length + inventory.length + quests.length + (personaStats.length > 0 ? 1 : 0);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(WIDGET, "border-purple-500/20 text-purple-300")}
        title="Player & Tracker"
      >
        <div className="flex h-7 max-md:h-4 items-center justify-center shrink-0">
          <Swords size={14} className="text-purple-400/60 max-md:h-3 max-md:w-3" />
        </div>
        <span className="max-w-full truncate text-[9px] max-md:text-[7px] font-semibold leading-tight shrink-0">
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
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Swords size={10} /> Player Tracker
          </span>
          <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={12} />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[min(calc(75vh-2rem),30rem)] divide-y divide-white/5">
          {/* ── Persona Stats section ── */}
          {showPersona && (
            <div className="p-2">
              <div className="px-1 pb-1">
                <span className="text-[10px] font-semibold text-violet-300/70 uppercase tracking-wider">Persona Stats</span>
              </div>
              <div className="space-y-2">
                {personaStats.length === 0 && (
                  <div className="text-[10px] text-white/30 text-center py-1">No stats tracked</div>
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
                <span className="text-[10px] font-semibold text-purple-300/70 uppercase tracking-wider flex items-center gap-1">
                  <Users size={9} /> Characters ({characters.length})
                </span>
                <button
                  onClick={addCharacter}
                  className="flex items-center gap-0.5 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <Plus size={10} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {characters.length === 0 && (
                  <div className="text-[10px] text-white/30 text-center py-1">No characters in scene</div>
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
                        <X size={10} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pl-1">
                      <LabeledEdit label="Mood" value={char.mood} onSave={(v) => updateCharacter(idx, { ...char, mood: v })} />
                      <LabeledEdit label="Look" value={char.appearance ?? ""} onSave={(v) => updateCharacter(idx, { ...char, appearance: v || null })} />
                      <LabeledEdit label="Outfit" value={char.outfit ?? ""} onSave={(v) => updateCharacter(idx, { ...char, outfit: v || null })} />
                      <LabeledEdit label="Thinks" value={char.thoughts ?? ""} onSave={(v) => updateCharacter(idx, { ...char, thoughts: v || null })} />
                    </div>
                    {char.stats.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-white/5">
                        {char.stats.map((stat, si) => (
                          <StatBarEditable
                            key={stat.name}
                            stat={stat}
                            onUpdateValue={(v) => {
                              const next = [...char.stats];
                              next[si] = { ...next[si]!, value: v };
                              updateCharacter(idx, { ...char, stats: next });
                            }}
                            onUpdateMax={(v) => {
                              const next = [...char.stats];
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
                <span className="text-[10px] font-semibold text-amber-300/70 uppercase tracking-wider flex items-center gap-1">
                  <Package size={9} /> Inventory ({inventory.length})
                </span>
                <button
                  onClick={addItem}
                  className="flex items-center gap-0.5 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Plus size={10} /> Add
                </button>
              </div>
              <div className="space-y-1">
                {inventory.length === 0 && (
                  <div className="text-[10px] text-white/30 text-center py-1">Inventory empty</div>
                )}
                {inventory.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
                    <Package size={10} className="shrink-0 text-amber-400/60" />
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
                      className="w-8 bg-transparent text-center text-[9px] text-white/40 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      title="Quantity"
                    />
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                      title="Remove item"
                    >
                      <X size={9} />
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
                <span className="text-[10px] font-semibold text-emerald-300/70 uppercase tracking-wider flex items-center gap-1">
                  <Scroll size={9} /> Quests ({quests.length})
                </span>
                <button
                  onClick={addQuest}
                  className="flex items-center gap-0.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Plus size={10} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {quests.length === 0 && (
                  <div className="text-[10px] text-white/30 text-center py-1">No active quests</div>
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
        </div>
      </WidgetPopover>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Tracker Mini Widgets — each has a compact preview
// and an expandable popover for full editable view
// ═══════════════════════════════════════════════

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
      left = rect.left;
      top = rect.bottom + 4;
      if (left + popoverWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - popoverWidth - 8);
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
      if (ref.current && !ref.current.contains(target) && !anchorRef.current?.contains(target)) onClose();
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
        "z-[9999] animate-message-in rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-xl",
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

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    const t = draft.trim();
    if (t !== value) onSave(t);
    setEditing(false);
  };

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
          "bg-white/5 rounded px-1.5 py-0.5 text-[10px] text-white/80 outline-none border border-white/10 focus:border-purple-400/40",
          className,
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        "group flex items-center gap-1 text-left hover:bg-white/5 rounded px-0.5 transition-colors",
        className,
      )}
    >
      <span className="text-[10px] text-white/60 truncate">
        {value || <span className="italic text-white/25">{placeholder ?? "—"}</span>}
      </span>
      <Pencil size={7} className="opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />
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
        className={cn(WIDGET, "border-purple-500/20 text-purple-300")}
        title="Present Characters"
      >
        <div className="flex h-7 max-md:h-4 items-center justify-center shrink-0">
          {characters.length > 0 ? (
            <div className="flex items-center -space-x-0.5">
              {characters.slice(0, 5).map((c, i) => (
                <span key={i} className="text-sm max-md:text-[9px] leading-none">
                  {c.emoji || "👤"}
                </span>
              ))}
              {characters.length > 5 && (
                <span className="text-[8px] text-white/40 ml-0.5">+{characters.length - 5}</span>
              )}
            </div>
          ) : (
            <Users size={14} className="text-purple-400/50 max-md:h-3 max-md:w-3" />
          )}
        </div>
        <span className="max-w-full truncate text-[9px] max-md:text-[7px] font-semibold leading-tight shrink-0">
          {characters.length > 0 ? `${characters.length} char${characters.length !== 1 ? "s" : ""}` : "Chars"}
        </span>
      </button>

      <WidgetPopover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef} placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"} className="w-72 max-h-80 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Users size={10} /> Present Characters
          </span>
          <button
            onClick={addCharacter}
            className="flex items-center gap-0.5 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        <div className="p-2 space-y-2">
          {characters.length === 0 && (
            <div className="text-[10px] text-white/30 text-center py-2">No characters in scene</div>
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
                  <X size={10} />
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
              {char.stats.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-white/5">
                  {char.stats.map((stat, si) => (
                    <StatBarEditable
                      key={stat.name}
                      stat={stat}
                      onUpdateValue={(v) => {
                        const next = [...char.stats];
                        next[si] = { ...next[si]!, value: v };
                        updateCharacter(idx, { ...char, stats: next });
                      }}
                      onUpdateMax={(v) => {
                        const next = [...char.stats];
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
            className="!text-[10px] !font-medium !text-white/70"
            placeholder="Stat name"
          />
        ) : (
          <span className="text-[10px] font-medium text-white/70">{stat.name}</span>
        )}
        <div className="flex items-center gap-0.5 text-[9px] text-white/40">
          <input
            type="number"
            value={stat.value}
            onChange={(e) => onUpdateValue(Number(e.target.value))}
            className="w-8 bg-transparent text-right outline-none text-white/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span>/</span>
          <input
            type="number"
            value={stat.max}
            onChange={(e) => onUpdateMax(Number(e.target.value))}
            className="w-8 bg-transparent outline-none text-white/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

function PersonaStatsWidget({ bars, onUpdate, layout = "top" }: { bars: CharacterStat[]; onUpdate: (bars: CharacterStat[]) => void; layout?: HudPosition }) {
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
        className={cn(WIDGET, "border-violet-500/20 text-violet-300")}
        title="Persona Stats"
      >
        <div className="flex h-7 max-md:h-4 w-14 max-md:w-8 flex-col justify-center gap-0.5 max-md:gap-px shrink-0 px-1 max-md:px-0.5">
          {bars.slice(0, 3).map((bar) => {
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
          {bars.length > 3 && <div className="text-[7px] text-white/30 text-center">+{bars.length - 3}</div>}
        </div>
        <span className="max-w-full truncate text-[9px] max-md:text-[7px] font-semibold leading-tight shrink-0">
          Persona
        </span>
      </button>

      <WidgetPopover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef} placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"} className="w-60 max-h-80 overflow-y-auto">
        <div className="border-b border-white/5 px-3 py-1.5">
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Persona Stats</span>
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

// ── Inventory Widget ─────────────────────────

function InventoryWidget({ items, onUpdate, layout = "top" }: { items: InventoryItem[]; onUpdate: (items: InventoryItem[]) => void; layout?: HudPosition }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(WIDGET, "border-amber-500/20 text-amber-300")}
        title="Inventory"
      >
        <div className="flex h-7 max-md:h-4 items-center justify-center shrink-0">
          <Package size={14} className="text-amber-400/60 max-md:h-3 max-md:w-3" />
          {items.length > 0 && (
            <span className="ml-0.5 text-sm max-md:text-[8px] font-bold text-amber-300/80">{items.length}</span>
          )}
        </div>
        <span className="max-w-full truncate text-[9px] max-md:text-[7px] font-semibold leading-tight shrink-0">
          {items.length > 0 ? `${items.length} item${items.length !== 1 ? "s" : ""}` : "Inventory"}
        </span>
      </button>

      <WidgetPopover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef} placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"} className="w-64 max-h-80 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Package size={10} /> Inventory ({items.length})
          </span>
          <button
            onClick={addItem}
            className="flex items-center gap-0.5 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        <div className="p-2 space-y-1">
          {items.length === 0 && <div className="text-[10px] text-white/30 text-center py-2">Inventory empty</div>}
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
              <Package size={10} className="shrink-0 text-amber-400/60" />
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
                className="w-8 bg-transparent text-center text-[9px] text-white/40 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Quantity"
              />
              <button
                onClick={() => removeItem(idx)}
                className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                title="Remove item"
              >
                <X size={9} />
              </button>
            </div>
          ))}
        </div>
      </WidgetPopover>
    </div>
  );
}

// ── Quests Widget ────────────────────────────

function QuestsWidget({ quests, onUpdate, layout = "top" }: { quests: QuestProgress[]; onUpdate: (quests: QuestProgress[]) => void; layout?: HudPosition }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  const mainQuest = quests.find((q) => !q.completed);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(WIDGET, "border-emerald-500/20 text-emerald-300")}
        title="Active Quests"
      >
        <div className="flex h-7 max-md:h-4 items-center justify-center shrink-0">
          <Scroll size={14} className="text-emerald-400/60 max-md:h-3 max-md:w-3" />
        </div>
        <span className="max-w-[4.5rem] max-md:max-w-[2rem] truncate text-[9px] max-md:text-[7px] font-semibold leading-tight shrink-0">
          {mainQuest ? mainQuest.name : `${quests.length} quest${quests.length !== 1 ? "s" : ""}`}
        </span>
      </button>

      <WidgetPopover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef} placement={layout === "left" ? "right" : layout === "right" ? "left" : "bottom"} className="w-72 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Scroll size={10} /> Quests ({quests.length})
          </span>
          <button
            onClick={addQuest}
            className="flex items-center gap-0.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        <div className="p-2 space-y-2">
          {quests.length === 0 && <div className="text-[10px] text-white/30 text-center py-2">No active quests</div>}
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
            <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
          ) : (
            <Target size={11} className="text-amber-400 shrink-0" />
          )}
        </button>
        <InlineEdit
          value={quest.name}
          onSave={(v) => onUpdate({ ...quest, name: v })}
          className={cn("flex-1 !font-medium", quest.completed && "line-through opacity-50")}
          placeholder="Quest name"
        />
        {total > 0 && (
          <span className="text-[9px] text-white/30">
            {completed}/{total}
          </span>
        )}
        <button
          onClick={onRemove}
          className="text-white/20 hover:text-red-400 transition-colors shrink-0"
          title="Remove quest"
        >
          <X size={9} />
        </button>
      </div>
      {!quest.completed && (
        <div className="mt-1 space-y-0.5 pl-4">
          {quest.objectives.map((obj, oIdx) => (
            <div key={oIdx} className="group flex items-center gap-1 text-[9px]">
              <button onClick={() => toggleObjective(oIdx)}>
                {obj.completed ? (
                  <CheckCircle2 size={8} className="text-emerald-400/60 shrink-0" />
                ) : (
                  <Circle size={8} className="text-white/20 shrink-0" />
                )}
              </button>
              <span className={cn("flex-1 truncate", obj.completed ? "text-white/30 line-through" : "text-white/50")}>
                {obj.text}
              </span>
              <button
                onClick={() => removeObjective(oIdx)}
                className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all shrink-0"
              >
                <X size={7} />
              </button>
            </div>
          ))}
          <button
            onClick={addObjective}
            className="flex items-center gap-0.5 text-[8px] text-white/20 hover:text-white/50 transition-colors mt-0.5"
          >
            <Plus size={7} /> objective
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
      <span className="text-[9px] text-white/30 w-10 shrink-0">{label}</span>
      <InlineEdit value={value} onSave={onSave} className="flex-1 min-w-0" placeholder="—" />
    </div>
  );
}

// ═══════════════════════════════════════════════
// Uniform World-State Widgets
// ═══════════════════════════════════════════════

const WIDGET =
  "group flex w-20 h-[3.75rem] max-md:w-11 max-md:h-8 flex-col items-center justify-center gap-0.5 max-md:gap-0 rounded-xl max-md:rounded-lg border bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 cursor-pointer select-none overflow-hidden";
const WIDGET_EDIT =
  "flex w-20 h-[3.75rem] max-md:w-11 max-md:h-8 flex-col items-center justify-center gap-0.5 max-md:gap-0 rounded-xl max-md:rounded-lg border bg-black/60 backdrop-blur-md overflow-hidden";

/** Truncated label that shows full text on hover (desktop) or tap (mobile) */
function WidgetLabel({ value, fallback, className }: { value: string; fallback: string; className?: string }) {
  const [showTip, setShowTip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => setShowTip(true), 400);
  };
  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (showTip) setTimeout(() => setShowTip(false), 1500);
  };

  return (
    <span
      className={cn("relative w-full max-md:px-0.5", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <span
        className={cn(
          "block max-w-[4.5rem] max-md:max-w-full truncate text-center text-[9px] max-md:text-[7px] font-semibold leading-tight",
          !value && "italic opacity-40",
        )}
      >
        {value || fallback}
      </span>
      {showTip && value && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-black/90 border border-white/10 px-1.5 py-0.5 text-[9px] text-white/80 z-[9999] pointer-events-none animate-message-in">
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
        "w-[4.5rem] max-md:w-[2rem] bg-transparent text-center text-[9px] max-md:text-[7px] font-medium outline-none placeholder:text-white/20",
        accent,
      )}
    />
  );
}

// ── Location Widget ──────────────────────────

function LocationWidget({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className={cn(WIDGET_EDIT, "border-emerald-500/25 text-emerald-300")}>
        <MapPin size={14} className="text-emerald-400/60 mb-0.5 max-md:h-3 max-md:w-3 max-md:mb-0" />
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-emerald-300" />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(WIDGET, "border-emerald-500/20 text-emerald-300")}
      title={value || "Click to edit location"}
    >
      <div className="relative flex h-7 max-md:h-4 w-14 max-md:w-8 items-center justify-center shrink-0">
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
          size={14}
          className="relative text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)] max-md:h-3 max-md:w-3"
        />
      </div>
      <WidgetLabel value={value} fallback="Location" />
    </button>
  );
}

// ── Calendar Widget ──────────────────────────

function CalendarWidget({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const { day, month } = value ? parseDateLabel(value) : { day: null, month: null };

  if (editing) {
    return (
      <div className={cn(WIDGET_EDIT, "border-violet-500/25 text-violet-300")}>
        <CalendarDays size={14} className="text-violet-400/60 mb-0.5 max-md:h-3 max-md:w-3 max-md:mb-0" />
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-violet-300" />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(WIDGET, "border-violet-500/20 text-violet-300")}
      title={value || "Click to edit date"}
    >
      <div className="flex h-7 max-md:h-4 w-8 max-md:w-5 flex-col rounded-sm border border-violet-400/30 overflow-hidden bg-violet-950/30 shrink-0">
        <div className="flex h-2.5 max-md:h-1.5 items-center justify-center bg-violet-500/25">
          <span className="text-[5px] max-md:text-[3px] font-bold uppercase tracking-wider text-violet-300/80">
            {month || "———"}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-[12px] max-md:text-[8px] font-bold leading-none text-violet-200/80">{day || "?"}</span>
        </div>
      </div>
      <WidgetLabel value={value} fallback="Date" />
    </button>
  );
}

// ── Clock Widget ─────────────────────────────

function ClockWidget({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const hour = value ? extractHourFromTime(value) : -1;
  const hourAngle = hour >= 0 ? ((hour % 12) / 12) * 360 - 90 : -90;
  const minuteAngle = hour >= 0 ? (parseMinutes(value) / 60) * 360 - 90 : 90;

  if (editing) {
    return (
      <div className={cn(WIDGET_EDIT, "border-amber-500/25 text-amber-300")}>
        <Clock size={14} className="text-amber-400/60 mb-0.5 max-md:h-3 max-md:w-3 max-md:mb-0" />
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-amber-300" />
      </div>
    );
  }

  const period = value ? getTimePeriod(value) : null;

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(WIDGET, "border-amber-500/20 text-amber-300")}
      title={value || "Click to edit time"}
    >
      <div className="relative flex h-7 max-md:h-4 w-7 max-md:w-4 items-center justify-center shrink-0">
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
      <WidgetLabel value={value || period || ""} fallback="Time" />
    </button>
  );
}

// ── Weather Widget ───────────────────────────

function WeatherWidget({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const emoji = value ? getWeatherEmoji(value) : "🌤️";

  if (editing) {
    return (
      <div className={cn(WIDGET_EDIT, "border-sky-500/25 text-sky-300")}>
        <span className="text-base max-md:text-xs mb-0.5">{emoji}</span>
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-sky-300" />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(WIDGET, "border-sky-500/20 text-sky-300")}
      title={value || "Click to edit weather"}
    >
      <div className="flex h-7 max-md:h-4 items-center justify-center shrink-0">
        <span className="text-xl max-md:text-xs leading-none drop-shadow-[0_0_6px_rgba(56,189,248,0.3)]">{emoji}</span>
      </div>
      <WidgetLabel value={value} fallback="Weather" />
    </button>
  );
}

// ── Temperature Widget ───────────────────────

function TemperatureWidget({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const temp = value ? parseTemperature(value) : null;
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
      <div className={cn(WIDGET_EDIT, "border-rose-500/25 text-rose-300")}>
        <Thermometer size={14} className="text-rose-400/60 mb-0.5 max-md:h-3 max-md:w-3 max-md:mb-0" />
        <WidgetInput value={value} onSave={onSave} onCancel={() => setEditing(false)} accent="text-rose-300" />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(WIDGET, "border-rose-500/20 text-rose-300")}
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
            className="text-rose-400/30"
          />
          <rect
            x="6.5"
            y={3 + 18 * (1 - fillPct / 100)}
            width="3"
            height={Math.max(1, 18 * (fillPct / 100))}
            rx="1.5"
            fill="currentColor"
            className={fillColor}
          />
          <circle
            cx="8"
            cy="26"
            r="3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.7"
            className="text-rose-400/30"
          />
          <circle cx="8" cy="26" r="2.5" fill="currentColor" className={fillColor} />
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
      <WidgetLabel value={value} fallback="Temp" />
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
