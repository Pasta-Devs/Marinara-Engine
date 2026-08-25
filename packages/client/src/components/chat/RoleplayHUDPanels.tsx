import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Backpack,
  BarChart3,
  CheckCircle2,
  Circle,
  Clock,
  CloudSun,
  ImagePlus,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Scroll,
  Sparkles,
  SlidersHorizontal,
  Swords,
  Target,
  Thermometer,
  Trash2,
  Unlock,
  Users,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { useAgentConfigs, useUpdateAgent, type AgentConfigRow } from "../../hooks/use-agents";
import { NEUTRAL_PANEL_HEADER, NEUTRAL_PANEL_TITLE } from "../ui/neutral-surface-styles";
import { coerceStatNumber, getStatPercent } from "../../features/tracker-panel/lib/tracker-stat-layout";
import type {
  CharacterStat,
  CustomTrackerField,
  InventoryTrackerRow,
  PresentCharacter,
  QuestProgress,
  WorldCustomField,
} from "@marinara-engine/shared";
import {
  characterStatTrackerLockKey,
  characterCustomFieldTrackerLockKey,
  characterTrackerLockKey,
  characterTrackerLockPrefix,
  customTrackerFieldLockPrefix,
  customTrackerLockKey,
  isTrackerFieldHidden,
  isTrackerFieldLocked,
  personaStatTrackerLockPrefix,
  personaStatTrackerLockKey,
  personaStatusTrackerLockKey,
  questObjectiveTrackerLockKey,
  questObjectiveTrackerLockPrefix,
  questTrackerLockKey,
  removeTrackerCharacterLocks,
  removeTrackerFieldLockPrefix,
  removeTrackerQuestLocks,
  renameTrackerFieldLockPrefix,
  worldCustomFieldTrackerLockKey,
  worldTrackerLockKey,
} from "@marinara-engine/shared";
import { useTrackerLockContext } from "../../features/tracker-panel/components/TrackerLockContext";
import { WorldCustomFieldIcon } from "../../features/tracker-panel/lib/world-custom-field-icons";
import { trackerEditableText } from "../../features/tracker-panel/lib/tracker-display";
import { useTranslation as useUiTranslation } from "react-i18next";
import { InventoryTrackerPanel as InventoryTrackerGridPanel } from "../../features/tracker-panel/components/sections/InventoryTrackerPanel";
import { CapabilityElement } from "../capabilities/CapabilityElement";

export function RoleplayInventoryTrackerPanel({
  currencies,
  equipped,
  inventory,
  onUpdateCurrencies,
  onUpdateEquipped,
  onUpdateInventory,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  currencies: InventoryTrackerRow[];
  equipped: InventoryTrackerRow[];
  inventory: InventoryTrackerRow[];
  onUpdateCurrencies: (rows: InventoryTrackerRow[]) => void;
  onUpdateEquipped: (rows: InventoryTrackerRow[]) => void;
  onUpdateInventory: (rows: InventoryTrackerRow[]) => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const action = (
    <span className="flex items-center gap-0.5">
      <TrackerSectionRefresh
        agentType="inventory-tracker"
        onRerunSingleTracker={onRerunSingleTracker}
        busy={isTrackerRetryBusy}
        title={localizeUi("ui.chat.inventoryTracker.reRun")}
      />
      <HudLockModeToggle />
    </span>
  );
  return (
    <div className="p-2">
      <InventoryTrackerGridPanel
        currencies={currencies}
        equipped={equipped}
        inventory={inventory}
        onUpdateCurrencies={onUpdateCurrencies}
        onUpdateEquipped={onUpdateEquipped}
        onUpdateInventory={onUpdateInventory}
        deleteMode
        addMode
        plain
        header={
          <div className="flex items-center justify-between px-1 pb-1">
            <span className={TRACKER_SECTION_TITLE}>
              <Backpack size="0.5625rem" className="text-[var(--marinara-chat-chrome-accent)]" />
              {localizeUi("ui.chat.inventoryTracker.title")}
            </span>
            {action}
          </div>
        }
      />
    </div>
  );
}

interface CombinedPlayerPanelProps {
  showPersona: boolean;
  showCharacters: boolean;
  showQuests: boolean;
  showInventory: boolean;
  memoryNagPackageIds: string[];
  chatId: string;
  showCustomTracker: boolean;
  personaStats: CharacterStat[];
  onUpdatePersonaStats: (bars: CharacterStat[]) => void;
  personaStatus?: string;
  onUpdatePersonaStatus?: (status: string) => void;
  characters: PresentCharacter[];
  onUpdateCharacters: (chars: PresentCharacter[]) => void;
  quests: QuestProgress[];
  onUpdateQuests: (quests: QuestProgress[]) => void;
  inventoryCurrencies: InventoryTrackerRow[];
  inventoryEquipped: InventoryTrackerRow[];
  inventory: InventoryTrackerRow[];
  onUpdateInventoryCurrencies: (rows: InventoryTrackerRow[]) => void;
  onUpdateInventoryEquipped: (rows: InventoryTrackerRow[]) => void;
  onUpdateInventory: (rows: InventoryTrackerRow[]) => void;
  customTrackerFields: CustomTrackerField[];
  onUpdateCustomTracker: (fields: CustomTrackerField[]) => void;
  onClose: () => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}

function TrackerSectionRefresh({
  agentType,
  onRerunSingleTracker,
  busy,
  title,
}: {
  agentType: string;
  onRerunSingleTracker?: (agentType: string) => void;
  busy?: boolean;
  /** Tooltip when hovering the refresh control */
  title?: string;
}) {
  if (!onRerunSingleTracker) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onRerunSingleTracker(agentType);
      }}
      disabled={busy}
      title={title ?? `Re-run ${agentType} only`}
      className="rounded p-0.5 text-[var(--muted-foreground)]/50 transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
    >
      <RefreshCw size="0.625rem" className={busy ? "animate-spin" : ""} />
    </button>
  );
}

const EMPTY_STATE = "text-[0.625rem] text-[var(--muted-foreground)]/60 text-center py-1";
const TRACKER_SECTION_TITLE =
  "text-[0.625rem] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-1";
const TRACKER_SECTION_ACTION =
  "flex items-center gap-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]";
const HUD_LOCKED_FIELD_CLASS =
  "bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]";
const HUD_LOCKED_FIELD_INSET_CLASS =
  "bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]";

function HudFieldLockButton({
  locked,
  onToggle,
  label,
  persistentLocked = true,
  className,
}: {
  locked?: boolean;
  onToggle?: () => void;
  label: string;
  persistentLocked?: boolean;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { lockMode } = useTrackerLockContext();
  if (!lockMode) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={
        locked
          ? localizeUi("ui.chat.hudfieldlockbutton.unlockField")
          : localizeUi("ui.chat.hudfieldlockbutton.lockField")
      }
      aria-label={localizeUi("ui.chat.scheduletimeline.value1Value2", {
        value1: locked
          ? localizeUi("ui.noodle.lockednoodlerpostcard.unlock")
          : localizeUi("ui.chat.hudfieldlockbutton.lock"),
        value2: label,
      })}
      aria-pressed={locked}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded text-[var(--muted-foreground)]/55 opacity-70 ring-1 ring-transparent transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[var(--border)] active:scale-90 max-md:opacity-100",
        locked && "text-[var(--foreground)]/80 ring-[var(--foreground)]/20",
        locked && persistentLocked && "opacity-100",
        className,
      )}
    >
      {locked ? <Lock size="0.5625rem" /> : <Unlock size="0.5625rem" />}
    </button>
  );
}

function HudLockModeToggle() {
  const { t: localizeUi } = useUiTranslation();
  const { lockMode, onSetLockMode } = useTrackerLockContext();
  if (!onSetLockMode) return null;

  return (
    <button
      type="button"
      onClick={() => onSetLockMode(!lockMode)}
      title={
        lockMode
          ? localizeUi("ui.chat.hudlockmodetoggle.exitLockMode")
          : localizeUi("ui.chat.hudlockmodetoggle.enterLockMode")
      }
      aria-label={
        lockMode
          ? localizeUi("ui.chat.hudlockmodetoggle.exitHudLockMode")
          : localizeUi("ui.chat.hudlockmodetoggle.enterHudLockMode")
      }
      aria-pressed={!!lockMode}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded p-0.5 transition-all active:scale-90",
        lockMode
          ? "bg-[var(--foreground)]/12 text-[var(--foreground)] ring-1 ring-[var(--foreground)]/24"
          : "text-[var(--muted-foreground)]/50 ring-1 ring-transparent hover:bg-[var(--accent)] hover:text-[var(--foreground)] hover:ring-[var(--border)]",
      )}
    >
      {lockMode ? <Lock size="0.625rem" /> : <Unlock size="0.625rem" />}
    </button>
  );
}

function useHudFieldLockResolver() {
  const { fieldLocks, onToggleFieldLock } = useTrackerLockContext();
  return useCallback(
    (key: string) => ({
      locked: isTrackerFieldLocked(fieldLocks, key),
      onToggle: () => onToggleFieldLock?.(key),
    }),
    [fieldLocks, onToggleFieldLock],
  );
}

function useHudFieldHiddenResolver() {
  const { hiddenTrackerFields } = useTrackerLockContext();
  return useCallback((key: string) => isTrackerFieldHidden(hiddenTrackerFields, key), [hiddenTrackerFields]);
}

export function CombinedPlayerPanel({
  showPersona,
  showCharacters,
  showQuests,
  showInventory,
  memoryNagPackageIds,
  chatId,
  showCustomTracker,
  personaStats,
  onUpdatePersonaStats,
  personaStatus = "",
  onUpdatePersonaStatus,
  characters,
  onUpdateCharacters,
  quests,
  onUpdateQuests,
  inventoryCurrencies,
  inventoryEquipped,
  inventory,
  onUpdateInventoryCurrencies,
  onUpdateInventoryEquipped,
  onUpdateInventory,
  customTrackerFields,
  onUpdateCustomTracker,
  onClose,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: CombinedPlayerPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const { lockMode, onSetLockMode, onUpdateFieldLocks, onUpdateHiddenFields } = useTrackerLockContext();
  const updateBar = (idx: number, field: "value" | "max" | "name", val: number | string) => {
    const previous = personaStats[idx];
    const next = [...personaStats];
    next[idx] = { ...next[idx]!, [field]: val };
    if (field === "name" && previous && previous.name !== next[idx]!.name) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          personaStatTrackerLockPrefix(previous, idx),
          personaStatTrackerLockPrefix(next[idx]!, idx),
        ),
      );
    }
    onUpdatePersonaStats(next);
  };

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
  const removeCharacter = (idx: number) => {
    const removed = characters[idx];
    if (removed) {
      onUpdateFieldLocks?.((locks) => removeTrackerCharacterLocks(locks, removed, idx));
      onUpdateHiddenFields?.((hiddenFields) => removeTrackerCharacterLocks(hiddenFields, removed, idx));
    }
    onUpdateCharacters(characters.filter((_, i) => i !== idx));
  };
  const updateCharacter = (idx: number, updated: PresentCharacter) => {
    const previous = characters[idx];
    if (previous && previous.name !== updated.name) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          characterTrackerLockPrefix(previous, idx),
          characterTrackerLockPrefix(updated, idx),
        ),
      );
      onUpdateHiddenFields?.((hiddenFields) =>
        renameTrackerFieldLockPrefix(
          hiddenFields,
          characterTrackerLockPrefix(previous, idx),
          characterTrackerLockPrefix(updated, idx),
        ),
      );
    }
    const next = [...characters];
    next[idx] = updated;
    onUpdateCharacters(next);
  };

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
  const removeQuest = (idx: number) => {
    const removed = quests[idx];
    if (removed) onUpdateFieldLocks?.((locks) => removeTrackerQuestLocks(locks, removed, idx));
    onUpdateQuests(quests.filter((_, i) => i !== idx));
  };
  const updateQuest = (idx: number, updated: QuestProgress) => {
    const next = [...quests];
    next[idx] = updated;
    onUpdateQuests(next);
  };

  const addCustomField = () => {
    onUpdateCustomTracker([...customTrackerFields, { name: "New Field", value: "" }]);
  };
  const removeCustomField = (idx: number) => {
    onUpdateFieldLocks?.((locks) =>
      removeTrackerFieldLockPrefix(locks, customTrackerFieldLockPrefix(customTrackerFields[idx]!, idx)),
    );
    onUpdateCustomTracker(customTrackerFields.filter((_, i) => i !== idx));
  };
  const updateCustomField = (idx: number, updated: CustomTrackerField) => {
    const previous = customTrackerFields[idx];
    if (previous && previous.name !== updated.name) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          customTrackerFieldLockPrefix(previous, idx),
          customTrackerFieldLockPrefix(updated, idx),
        ),
      );
    }
    const next = [...customTrackerFields];
    next[idx] = updated;
    onUpdateCustomTracker(next);
  };
  const lockFor = useHudFieldLockResolver();
  const hiddenFor = useHudFieldHiddenResolver();
  const personaStatusLock = lockFor(personaStatusTrackerLockKey());

  return (
    <>
      <div className={cn(NEUTRAL_PANEL_HEADER, "flex items-center justify-between")}>
        <span className={NEUTRAL_PANEL_TITLE}>
          <Swords size="0.625rem" className="text-[var(--marinara-chat-chrome-accent)]" />{" "}
          {localizeUi("ui.chat.combinedplayerpanel.trackers")}
        </span>
        <span className="flex items-center gap-1">
          <HudLockModeToggle />
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)]/50 transition-colors hover:text-[var(--foreground)]"
          >
            <X size="0.75rem" />
          </button>
        </span>
      </div>
      <div className="overflow-y-auto max-h-[min(calc(75vh-2rem),30rem)] divide-y divide-[var(--border)]">
        {showPersona && (
          <div className="p-2">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="flex items-center gap-1 text-[0.625rem] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                <BarChart3 size="0.5625rem" className="text-[var(--marinara-chat-chrome-accent)]" />
                {localizeUi("ui.chat.personastatswidget.personaStats")}
              </span>
              <TrackerSectionRefresh
                agentType="persona-stats"
                onRerunSingleTracker={onRerunSingleTracker}
                busy={isTrackerRetryBusy}
                title={localizeUi("ui.chat.combinedplayerpanel.reRunPersonaTrackerStatsInventory")}
              />
            </div>
            <PersonaStatusField
              value={personaStatus}
              onSave={onUpdatePersonaStatus}
              locked={personaStatusLock.locked}
              onToggleLock={personaStatusLock.onToggle}
            />
            <div className="space-y-2">
              {personaStats.length === 0 && (
                <div className={EMPTY_STATE}>{localizeUi("ui.chat.combinedplayerpanel.noStatsTracked")}</div>
              )}
              {personaStats.map((bar, idx) => {
                const nameLock = lockFor(personaStatTrackerLockKey(bar, "name", idx));
                const valueLock = lockFor(personaStatTrackerLockKey(bar, "value", idx));
                const maxLock = lockFor(personaStatTrackerLockKey(bar, "max", idx));
                return (
                  <StatBarEditable
                    key={bar.name}
                    stat={bar}
                    onUpdateName={(name) => updateBar(idx, "name", name)}
                    onUpdateValue={(value) => updateBar(idx, "value", value)}
                    onUpdateMax={(value) => updateBar(idx, "max", value)}
                    nameLocked={nameLock.locked}
                    valueLocked={valueLock.locked}
                    maxLocked={maxLock.locked}
                    onToggleNameLock={nameLock.onToggle}
                    onToggleValueLock={valueLock.onToggle}
                    onToggleMaxLock={maxLock.onToggle}
                  />
                );
              })}
            </div>
          </div>
        )}

        {showCharacters && (
          <div className="p-2">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className={TRACKER_SECTION_TITLE}>
                <Users size="0.5625rem" className="text-[var(--marinara-chat-chrome-accent)]" />
                {localizeUi("navigation.topbar.characters")}
              </span>
              <span className="flex items-center gap-1">
                <TrackerSectionRefresh
                  agentType="character-tracker"
                  onRerunSingleTracker={onRerunSingleTracker}
                  busy={isTrackerRetryBusy}
                  title={localizeUi("ui.chat.combinedplayerpanel.reRunCharacterTrackerOnly")}
                />
                <button
                  onClick={addCharacter}
                  className="flex items-center gap-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  <Plus size="0.625rem" /> {localizeUi("ui.characters.metadatatab.add")}
                </button>
              </span>
            </div>
            <div className="space-y-2">
              {characters.length === 0 && (
                <div className={EMPTY_STATE}>{localizeUi("ui.chat.combinedplayerpanel.noCharactersInScene")}</div>
              )}
              {characters.map((char, idx) => {
                const emojiLock = lockFor(characterTrackerLockKey(char, idx, "emoji"));
                const nameLock = lockFor(characterTrackerLockKey(char, idx, "name"));
                const moodLock = lockFor(characterTrackerLockKey(char, idx, "mood"));
                const appearanceLock = lockFor(characterTrackerLockKey(char, idx, "appearance"));
                const outfitLock = lockFor(characterTrackerLockKey(char, idx, "outfit"));
                const thoughtsLock = lockFor(characterTrackerLockKey(char, idx, "thoughts"));
                const showMood = !hiddenFor(characterTrackerLockKey(char, idx, "mood"));
                const showAppearance = !hiddenFor(characterTrackerLockKey(char, idx, "appearance"));
                const showOutfit = !hiddenFor(characterTrackerLockKey(char, idx, "outfit"));
                const showThoughts = !hiddenFor(characterTrackerLockKey(char, idx, "thoughts"));
                const hasVisibleDefaultFields = showMood || showAppearance || showOutfit || showThoughts;
                return (
                  <div key={char.characterId ?? idx} className="rounded-lg bg-[var(--muted)]/20 p-2 space-y-1">
                    <div className="group/field flex items-center gap-1.5">
                      <InlineEdit
                        value={char.emoji || "👤"}
                        onSave={(value) => updateCharacter(idx, { ...char, emoji: value })}
                        className="w-8 text-center !text-sm"
                        locked={emojiLock.locked}
                      />
                      <HudFieldLockButton
                        {...emojiLock}
                        label={localizeUi("ui.chat.combinedplayerpanel.value1Emoji", {
                          value1: char.name || localizeUi("ui.noodle.noodlehome.character"),
                        })}
                      />
                      <InlineEdit
                        value={char.name}
                        onSave={(value) => updateCharacter(idx, { ...char, name: value })}
                        className="flex-1 !font-medium"
                        placeholder={localizeUi("ui.characters.metadatatab.name")}
                        locked={nameLock.locked}
                      />
                      <HudFieldLockButton
                        {...nameLock}
                        label={localizeUi("ui.chat.combinedplayerpanel.value1Name", {
                          value1: char.name || localizeUi("ui.noodle.noodlehome.character"),
                        })}
                      />
                      <button
                        onClick={() => removeCharacter(idx)}
                        className="text-[var(--muted-foreground)]/40 hover:text-red-500 transition-colors shrink-0"
                        title={localizeUi("ui.chat.combinedplayerpanel.removeCharacter")}
                      >
                        <X size="0.625rem" />
                      </button>
                    </div>
                    {(hasVisibleDefaultFields || Object.keys(char.customFields ?? {}).length > 0) && (
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pl-1">
                        {showMood && (
                          <LabeledEdit
                            label={localizeUi("ui.chat.combinedplayerpanel.mood")}
                            value={char.mood}
                            onSave={(value) => updateCharacter(idx, { ...char, mood: value })}
                            locked={moodLock.locked}
                            onToggleLock={moodLock.onToggle}
                          />
                        )}
                        {showAppearance && (
                          <LabeledEdit
                            label={localizeUi("ui.chat.combinedplayerpanel.look")}
                            value={char.appearance ?? ""}
                            onSave={(value) => updateCharacter(idx, { ...char, appearance: value || null })}
                            locked={appearanceLock.locked}
                            onToggleLock={appearanceLock.onToggle}
                          />
                        )}
                        {showOutfit && (
                          <LabeledEdit
                            label={localizeUi("ui.chat.combinedplayerpanel.outfit")}
                            value={char.outfit ?? ""}
                            onSave={(value) => updateCharacter(idx, { ...char, outfit: value || null })}
                            locked={outfitLock.locked}
                            onToggleLock={outfitLock.onToggle}
                          />
                        )}
                        {showThoughts && (
                          <LabeledEdit
                            label={localizeUi("ui.chat.combinedplayerpanel.thinks")}
                            value={char.thoughts ?? ""}
                            onSave={(value) => updateCharacter(idx, { ...char, thoughts: value || null })}
                            locked={thoughtsLock.locked}
                            onToggleLock={thoughtsLock.onToggle}
                          />
                        )}
                        {Object.entries(char.customFields ?? {}).map(([name, value]) => {
                          const valueLock = lockFor(characterCustomFieldTrackerLockKey(char, idx, name, "value"));
                          return (
                            <LabeledEdit
                              key={name}
                              label={name}
                              value={trackerEditableText(value)}
                              onSave={(nextValue) =>
                                updateCharacter(idx, {
                                  ...char,
                                  customFields: { ...(char.customFields ?? {}), [name]: nextValue },
                                })
                              }
                              locked={valueLock.locked}
                              onToggleLock={valueLock.onToggle}
                            />
                          );
                        })}
                      </div>
                    )}
                    {Array.isArray(char.stats) && char.stats.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-[var(--border)]">
                        {char.stats.map((stat, statIndex) => {
                          const valueLock = lockFor(characterStatTrackerLockKey(char, idx, stat, "value", statIndex));
                          const maxLock = lockFor(characterStatTrackerLockKey(char, idx, stat, "max", statIndex));
                          return (
                            <StatBarEditable
                              key={stat.name}
                              stat={stat}
                              onUpdateValue={(value) => {
                                const next = Array.isArray(char.stats) ? [...char.stats] : [];
                                next[statIndex] = { ...next[statIndex]!, value };
                                updateCharacter(idx, { ...char, stats: next });
                              }}
                              onUpdateMax={(value) => {
                                const next = Array.isArray(char.stats) ? [...char.stats] : [];
                                next[statIndex] = { ...next[statIndex]!, max: value };
                                updateCharacter(idx, { ...char, stats: next });
                              }}
                              valueLocked={valueLock.locked}
                              maxLocked={maxLock.locked}
                              onToggleValueLock={valueLock.onToggle}
                              onToggleMaxLock={maxLock.onToggle}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showQuests && (
          <div className="p-2">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className={TRACKER_SECTION_TITLE}>
                <Scroll size="0.5625rem" className="text-[var(--marinara-chat-chrome-accent)]" />{" "}
                {localizeUi("ui.chat.questspanel.quests")}
              </span>
              <span className="flex items-center gap-1">
                <TrackerSectionRefresh
                  agentType="quest"
                  onRerunSingleTracker={onRerunSingleTracker}
                  busy={isTrackerRetryBusy}
                  title={localizeUi("ui.chat.combinedplayerpanel.reRunQuestTrackerOnly")}
                />
                <button onClick={addQuest} className={TRACKER_SECTION_ACTION}>
                  <Plus size="0.625rem" /> {localizeUi("ui.characters.metadatatab.add")}
                </button>
              </span>
            </div>
            <div className="space-y-2">
              {quests.length === 0 && (
                <div className={EMPTY_STATE}>{localizeUi("ui.chat.combinedplayerpanel.noActiveQuests")}</div>
              )}
              {quests.map((quest, idx) => (
                <QuestCardEditable
                  key={quest.questEntryId || idx}
                  quest={quest}
                  questIndex={idx}
                  onUpdate={(updatedQuest) => updateQuest(idx, updatedQuest)}
                  onRemove={() => removeQuest(idx)}
                />
              ))}
            </div>
          </div>
        )}

        {showInventory && (
          <RoleplayInventoryTrackerPanel
            currencies={inventoryCurrencies}
            equipped={inventoryEquipped}
            inventory={inventory}
            onUpdateCurrencies={onUpdateInventoryCurrencies}
            onUpdateEquipped={onUpdateInventoryEquipped}
            onUpdateInventory={onUpdateInventory}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        )}

        {memoryNagPackageIds.map((packageId) => (
          <CapabilityElement
            key={`${packageId}-mobile-combined-tracker`}
            packageId={packageId}
            view="tracker"
            capabilityProps={{
              chatId,
              chatMode: "roleplay",
              mobileCompact: true,
              onRerunTracker: onRerunSingleTracker ? () => onRerunSingleTracker(packageId) : undefined,
              trackerRetryBusy: isTrackerRetryBusy,
              lockMode,
              onToggleLockMode: onSetLockMode ? () => onSetLockMode(!lockMode) : undefined,
            }}
            className="block"
          />
        ))}

        {showCustomTracker && (
          <div className="p-2">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className={TRACKER_SECTION_TITLE}>
                <SlidersHorizontal size="0.5625rem" className="text-[var(--marinara-chat-chrome-accent)]" />{" "}
                {localizeUi("ui.trackerPanel.customtrackerpanel.customStats")}
              </span>
              <span className="flex items-center gap-1">
                <TrackerSectionRefresh
                  agentType="custom-tracker"
                  onRerunSingleTracker={onRerunSingleTracker}
                  busy={isTrackerRetryBusy}
                  title={localizeUi("ui.chat.combinedplayerpanel.reRunCustomTrackerOnly")}
                />
                <button onClick={addCustomField} className={TRACKER_SECTION_ACTION}>
                  <Plus size="0.625rem" /> {localizeUi("ui.characters.metadatatab.add")}
                </button>
              </span>
            </div>
            <div className="space-y-1">
              {customTrackerFields.length === 0 && (
                <div className={EMPTY_STATE}>{localizeUi("ui.chat.combinedplayerpanel.noFieldsTracked")}</div>
              )}
              {customTrackerFields.map((field, idx) => {
                const nameLock = lockFor(customTrackerLockKey(field, "name", idx));
                const valueLock = lockFor(customTrackerLockKey(field, "value", idx));
                const toggleValueLock = () => {
                  if (field.locked) updateCustomField(idx, { ...field, locked: false });
                  if (valueLock.locked || !field.locked) valueLock.onToggle();
                };
                return (
                  <div
                    key={idx}
                    className="group/field flex items-center gap-1.5 rounded-lg bg-[var(--muted)]/20 px-2 py-1.5"
                  >
                    <SlidersHorizontal size="0.625rem" className="shrink-0 text-[var(--muted-foreground)]/65" />
                    <InlineEdit
                      value={field.name}
                      onSave={(value) => updateCustomField(idx, { ...field, name: value })}
                      className="flex-1 min-w-0"
                      placeholder={localizeUi("ui.chat.combinedplayerpanel.fieldName")}
                      locked={nameLock.locked}
                    />
                    <HudFieldLockButton
                      {...nameLock}
                      label={localizeUi("ui.chat.combinedplayerpanel.value1Name", {
                        value1: field.name || localizeUi("ui.chat.combinedplayerpanel.field"),
                      })}
                    />
                    <span className="text-[var(--muted-foreground)]/40 text-[0.5rem]">=</span>
                    <InlineEdit
                      value={field.value}
                      onSave={(value) => updateCustomField(idx, { ...field, value })}
                      className="flex-1 min-w-0"
                      placeholder={localizeUi("ui.chat.combinedplayerpanel.value")}
                      locked={valueLock.locked || field.locked}
                    />
                    <HudFieldLockButton
                      locked={valueLock.locked || field.locked}
                      onToggle={toggleValueLock}
                      label={localizeUi("ui.chat.combinedplayerpanel.value1Value", {
                        value1: field.name || localizeUi("ui.chat.combinedplayerpanel.field"),
                      })}
                    />
                    <button
                      onClick={() => removeCustomField(idx)}
                      className="text-[var(--muted-foreground)]/40 hover:text-red-500 transition-colors shrink-0"
                      title={localizeUi("ui.chat.combinedplayerpanel.removeField")}
                    >
                      <X size="0.5625rem" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface PersonaStatsPanelProps {
  bars: CharacterStat[];
  onUpdate: (bars: CharacterStat[]) => void;
  status?: string;
  onUpdateStatus?: (status: string) => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}

export function PersonaStatsPanel({
  bars,
  onUpdate,
  status = "",
  onUpdateStatus,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: PersonaStatsPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const { onUpdateFieldLocks } = useTrackerLockContext();
  const updateBar = (idx: number, field: "value" | "max" | "name", val: number | string) => {
    const previous = bars[idx];
    const next = [...bars];
    next[idx] = { ...next[idx]!, [field]: val };
    if (field === "name" && previous && previous.name !== next[idx]!.name) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          personaStatTrackerLockPrefix(previous, idx),
          personaStatTrackerLockPrefix(next[idx]!, idx),
        ),
      );
    }
    onUpdate(next);
  };
  const removeBar = (idx: number) => {
    onUpdateFieldLocks?.((locks) => removeTrackerFieldLockPrefix(locks, personaStatTrackerLockPrefix(bars[idx]!, idx)));
    onUpdate(bars.filter((_, index) => index !== idx));
  };
  const lockFor = useHudFieldLockResolver();
  const statusLock = lockFor(personaStatusTrackerLockKey());

  return (
    <>
      <div className={cn(NEUTRAL_PANEL_HEADER, "flex items-center justify-between")}>
        <span className={NEUTRAL_PANEL_TITLE}>
          <BarChart3 size="0.625rem" className="text-[var(--marinara-chat-chrome-accent)]" />
          {localizeUi("ui.chat.personastatswidget.personaStats")}
        </span>
        <span className="flex items-center gap-1">
          <TrackerSectionRefresh
            agentType="persona-stats"
            onRerunSingleTracker={onRerunSingleTracker}
            busy={isTrackerRetryBusy}
            title={localizeUi("ui.chat.combinedplayerpanel.reRunPersonaTrackerStatsInventory")}
          />
          <HudLockModeToggle />
        </span>
      </div>
      <div className="border-b border-[var(--border)] p-2">
        <PersonaStatusField
          value={status}
          onSave={onUpdateStatus}
          locked={statusLock.locked}
          onToggleLock={statusLock.onToggle}
        />
      </div>
      <div className="p-2 space-y-2">
        {bars.map((bar, idx) => {
          const nameLock = lockFor(personaStatTrackerLockKey(bar, "name", idx));
          const valueLock = lockFor(personaStatTrackerLockKey(bar, "value", idx));
          const maxLock = lockFor(personaStatTrackerLockKey(bar, "max", idx));
          return (
            <StatBarEditable
              key={bar.name}
              stat={bar}
              onUpdateName={(name) => updateBar(idx, "name", name)}
              onUpdateValue={(value) => updateBar(idx, "value", value)}
              onUpdateMax={(value) => updateBar(idx, "max", value)}
              onRemove={() => removeBar(idx)}
              nameLocked={nameLock.locked}
              valueLocked={valueLock.locked}
              maxLocked={maxLock.locked}
              onToggleNameLock={nameLock.onToggle}
              onToggleValueLock={valueLock.onToggle}
              onToggleMaxLock={maxLock.onToggle}
            />
          );
        })}
      </div>
    </>
  );
}

interface CharactersPanelProps {
  characters: PresentCharacter[];
  onUpdate: (chars: PresentCharacter[]) => void;
  chatId?: string;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}

export function CharactersPanel({
  characters,
  onUpdate,
  chatId,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: CharactersPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const { onUpdateFieldLocks, onUpdateHiddenFields } = useTrackerLockContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadIdx, setUploadIdx] = useState<number | null>(null);

  // ── Auto-generate toggle ──
  const { data: agentConfigs } = useAgentConfigs();
  const updateAgent = useUpdateAgent();
  const trackerConfig = useMemo(() => {
    if (!agentConfigs) return null;
    return (agentConfigs as AgentConfigRow[]).find((a) => a.type === "character-tracker") ?? null;
  }, [agentConfigs]);
  const trackerSettings = useMemo(() => {
    if (!trackerConfig?.settings) return {} as Record<string, unknown>;
    try {
      return typeof trackerConfig.settings === "string" ? JSON.parse(trackerConfig.settings) : trackerConfig.settings;
    } catch {
      return {} as Record<string, unknown>;
    }
  }, [trackerConfig]);
  const autoGenEnabled = !!(trackerSettings as Record<string, unknown>).autoGenerateAvatars;
  const toggleAutoGenerate = useCallback(() => {
    if (!trackerConfig) return;
    const newVal = !autoGenEnabled;
    const { autoGenerateAvatars: _, ...rest } = trackerSettings as Record<string, unknown>;
    const newSettings = newVal ? { ...rest, autoGenerateAvatars: true } : rest;
    updateAgent.mutate({ id: trackerConfig.id, settings: newSettings });
  }, [trackerConfig, autoGenEnabled, trackerSettings, updateAgent]);

  const handleAvatarUpload = useCallback(
    async (idx: number, file: File) => {
      const char = characters[idx];
      if (!char || !chatId) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          const res = await api.post<{ avatarPath: string }>(`/avatars/npc/${chatId}`, {
            name: char.name,
            avatar: dataUrl,
          });
          const next = [...characters];
          next[idx] = { ...char, avatarPath: res.avatarPath };
          onUpdate(next);
        } catch {
          // silently fail
        }
      };
      reader.readAsDataURL(file);
    },
    [characters, chatId, onUpdate],
  );

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
    const removed = characters[idx];
    if (removed) {
      onUpdateFieldLocks?.((locks) => removeTrackerCharacterLocks(locks, removed, idx));
      onUpdateHiddenFields?.((hiddenFields) => removeTrackerCharacterLocks(hiddenFields, removed, idx));
    }
    onUpdate(characters.filter((_, i) => i !== idx));
  };

  const updateCharacter = (idx: number, updated: PresentCharacter) => {
    const previous = characters[idx];
    if (previous && previous.name !== updated.name) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          characterTrackerLockPrefix(previous, idx),
          characterTrackerLockPrefix(updated, idx),
        ),
      );
      onUpdateHiddenFields?.((hiddenFields) =>
        renameTrackerFieldLockPrefix(
          hiddenFields,
          characterTrackerLockPrefix(previous, idx),
          characterTrackerLockPrefix(updated, idx),
        ),
      );
    }
    const next = [...characters];
    next[idx] = updated;
    onUpdate(next);
  };
  const lockFor = useHudFieldLockResolver();
  const hiddenFor = useHudFieldHiddenResolver();

  return (
    <>
      <div className={cn(NEUTRAL_PANEL_HEADER, "flex items-center justify-between")}>
        <span className={NEUTRAL_PANEL_TITLE}>
          <Users size="0.625rem" className="text-sky-400/80" />{" "}
          {localizeUi("ui.chat.characterswidget.presentCharacters")}
        </span>
        <div className="flex items-center gap-2">
          <TrackerSectionRefresh
            agentType="character-tracker"
            onRerunSingleTracker={onRerunSingleTracker}
            busy={isTrackerRetryBusy}
            title={localizeUi("ui.chat.combinedplayerpanel.reRunCharacterTrackerOnly")}
          />
          <HudLockModeToggle />
          {trackerConfig && (
            <button
              onClick={toggleAutoGenerate}
              className={cn(
                "flex items-center gap-1 text-[0.5625rem] transition-colors",
                autoGenEnabled
                  ? "text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)]",
              )}
              title={
                autoGenEnabled
                  ? localizeUi("ui.chat.characterspanel.autoGenerateAvatarsOn")
                  : localizeUi("ui.chat.characterspanel.autoGenerateAvatarsOff")
              }
            >
              <Sparkles size="0.5625rem" />
              <span className="hidden sm:inline">{localizeUi("ui.chat.characterspanel.auto")}</span>
            </button>
          )}
          <button
            onClick={addCharacter}
            className="flex items-center gap-0.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            <Plus size="0.625rem" /> {localizeUi("ui.characters.metadatatab.add")}
          </button>
        </div>
      </div>
      <div className="p-2 space-y-2">
        {characters.length === 0 && (
          <div className={cn(EMPTY_STATE, "py-2")}>{localizeUi("ui.chat.combinedplayerpanel.noCharactersInScene")}</div>
        )}
        {characters.map((char, idx) => {
          const emojiLock = lockFor(characterTrackerLockKey(char, idx, "emoji"));
          const nameLock = lockFor(characterTrackerLockKey(char, idx, "name"));
          const moodLock = lockFor(characterTrackerLockKey(char, idx, "mood"));
          const appearanceLock = lockFor(characterTrackerLockKey(char, idx, "appearance"));
          const outfitLock = lockFor(characterTrackerLockKey(char, idx, "outfit"));
          const thoughtsLock = lockFor(characterTrackerLockKey(char, idx, "thoughts"));
          const showMood = !hiddenFor(characterTrackerLockKey(char, idx, "mood"));
          const showAppearance = !hiddenFor(characterTrackerLockKey(char, idx, "appearance"));
          const showOutfit = !hiddenFor(characterTrackerLockKey(char, idx, "outfit"));
          const showThoughts = !hiddenFor(characterTrackerLockKey(char, idx, "thoughts"));
          const hasVisibleDefaultFields = showMood || showAppearance || showOutfit || showThoughts;
          return (
            <div key={char.characterId ?? idx} className="rounded-lg bg-[var(--muted)]/20 p-2 space-y-1">
              <div className="group/field flex items-center gap-1.5">
                {/* Avatar circle or emoji fallback */}
                {char.avatarPath ? (
                  <button
                    onClick={() => {
                      setUploadIdx(idx);
                      fileInputRef.current?.click();
                    }}
                    className="shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--border)] transition-all hover:ring-[var(--foreground)]/30"
                    title={localizeUi("ui.panels.personaspanel.changeAvatar")}
                  >
                    <img src={char.avatarPath} alt={char.name} className="w-8 h-8 object-cover" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setUploadIdx(idx);
                      fileInputRef.current?.click();
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted)]/30 text-[var(--muted-foreground)]/50 ring-1 ring-[var(--border)] transition-all hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
                    title={localizeUi("editor.avatar.upload")}
                  >
                    <ImagePlus size="0.75rem" />
                  </button>
                )}
                <InlineEdit
                  value={char.emoji || "👤"}
                  onSave={(value) => updateCharacter(idx, { ...char, emoji: value || "👤" })}
                  className="h-8 w-8 shrink-0 justify-center text-center !text-sm"
                  placeholder="👤"
                  locked={emojiLock.locked}
                />
                <HudFieldLockButton
                  {...emojiLock}
                  label={localizeUi("ui.chat.combinedplayerpanel.value1Emoji", {
                    value1: char.name || localizeUi("ui.noodle.noodlehome.character"),
                  })}
                />
                <InlineEdit
                  value={char.name}
                  onSave={(value) => updateCharacter(idx, { ...char, name: value })}
                  className="flex-1 !font-medium"
                  placeholder={localizeUi("ui.characters.metadatatab.name")}
                  locked={nameLock.locked}
                />
                <HudFieldLockButton
                  {...nameLock}
                  label={localizeUi("ui.chat.combinedplayerpanel.value1Name", {
                    value1: char.name || localizeUi("ui.noodle.noodlehome.character"),
                  })}
                />
                <button
                  onClick={() => removeCharacter(idx)}
                  className="text-[var(--muted-foreground)]/40 hover:text-red-500 transition-colors shrink-0"
                  title={localizeUi("ui.chat.combinedplayerpanel.removeCharacter")}
                >
                  <X size="0.625rem" />
                </button>
              </div>
              {(hasVisibleDefaultFields || Object.keys(char.customFields ?? {}).length > 0) && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pl-1">
                  {showMood && (
                    <LabeledEdit
                      label={localizeUi("ui.chat.combinedplayerpanel.mood")}
                      value={char.mood}
                      onSave={(value) => updateCharacter(idx, { ...char, mood: value })}
                      locked={moodLock.locked}
                      onToggleLock={moodLock.onToggle}
                    />
                  )}
                  {showAppearance && (
                    <LabeledEdit
                      label={localizeUi("ui.chat.combinedplayerpanel.look")}
                      value={char.appearance ?? ""}
                      onSave={(value) => updateCharacter(idx, { ...char, appearance: value || null })}
                      locked={appearanceLock.locked}
                      onToggleLock={appearanceLock.onToggle}
                    />
                  )}
                  {showOutfit && (
                    <LabeledEdit
                      label={localizeUi("ui.chat.combinedplayerpanel.outfit")}
                      value={char.outfit ?? ""}
                      onSave={(value) => updateCharacter(idx, { ...char, outfit: value || null })}
                      locked={outfitLock.locked}
                      onToggleLock={outfitLock.onToggle}
                    />
                  )}
                  {showThoughts && (
                    <LabeledEdit
                      label={localizeUi("ui.chat.combinedplayerpanel.thinks")}
                      value={char.thoughts ?? ""}
                      onSave={(value) => updateCharacter(idx, { ...char, thoughts: value || null })}
                      locked={thoughtsLock.locked}
                      onToggleLock={thoughtsLock.onToggle}
                    />
                  )}
                  {Object.entries(char.customFields ?? {}).map(([name, value]) => {
                    const valueLock = lockFor(characterCustomFieldTrackerLockKey(char, idx, name, "value"));
                    return (
                      <LabeledEdit
                        key={name}
                        label={name}
                        value={trackerEditableText(value)}
                        onSave={(nextValue) =>
                          updateCharacter(idx, {
                            ...char,
                            customFields: { ...(char.customFields ?? {}), [name]: nextValue },
                          })
                        }
                        locked={valueLock.locked}
                        onToggleLock={valueLock.onToggle}
                      />
                    );
                  })}
                </div>
              )}
              {Array.isArray(char.stats) && char.stats.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-[var(--border)]">
                  {char.stats.map((stat, statIndex) => {
                    const valueLock = lockFor(characterStatTrackerLockKey(char, idx, stat, "value", statIndex));
                    const maxLock = lockFor(characterStatTrackerLockKey(char, idx, stat, "max", statIndex));
                    return (
                      <StatBarEditable
                        key={stat.name}
                        stat={stat}
                        onUpdateValue={(value) => {
                          const next = Array.isArray(char.stats) ? [...char.stats] : [];
                          next[statIndex] = { ...next[statIndex]!, value };
                          updateCharacter(idx, { ...char, stats: next });
                        }}
                        onUpdateMax={(value) => {
                          const next = Array.isArray(char.stats) ? [...char.stats] : [];
                          next[statIndex] = { ...next[statIndex]!, max: value };
                          updateCharacter(idx, { ...char, stats: next });
                        }}
                        valueLocked={valueLock.locked}
                        maxLocked={maxLock.locked}
                        onToggleValueLock={valueLock.onToggle}
                        onToggleMaxLock={maxLock.onToggle}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadIdx !== null) handleAvatarUpload(uploadIdx, file);
          e.target.value = "";
        }}
      />
    </>
  );
}

interface QuestsPanelProps {
  quests: QuestProgress[];
  onUpdate: (quests: QuestProgress[]) => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}

export function QuestsPanel({ quests, onUpdate, onRerunSingleTracker, isTrackerRetryBusy }: QuestsPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const { onUpdateFieldLocks } = useTrackerLockContext();
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
    const removed = quests[idx];
    if (removed) onUpdateFieldLocks?.((locks) => removeTrackerQuestLocks(locks, removed, idx));
    onUpdate(quests.filter((_, i) => i !== idx));
  };

  const updateQuest = (idx: number, updated: QuestProgress) => {
    const next = [...quests];
    next[idx] = updated;
    onUpdate(next);
  };

  return (
    <>
      <div className={cn(NEUTRAL_PANEL_HEADER, "flex items-center justify-between")}>
        <span className={NEUTRAL_PANEL_TITLE}>
          <Scroll size="0.625rem" className="text-[var(--marinara-chat-chrome-accent)]" />{" "}
          {localizeUi("ui.chat.questspanel.quests")}
        </span>
        <span className="flex items-center gap-1">
          <TrackerSectionRefresh
            agentType="quest"
            onRerunSingleTracker={onRerunSingleTracker}
            busy={isTrackerRetryBusy}
            title={localizeUi("ui.chat.combinedplayerpanel.reRunQuestTrackerOnly")}
          />
          <HudLockModeToggle />
          <button onClick={addQuest} className={TRACKER_SECTION_ACTION}>
            <Plus size="0.625rem" /> {localizeUi("ui.characters.metadatatab.add")}
          </button>
        </span>
      </div>
      <div className="p-2 space-y-2">
        {quests.length === 0 && (
          <div className={cn(EMPTY_STATE, "py-2")}>{localizeUi("ui.chat.combinedplayerpanel.noActiveQuests")}</div>
        )}
        {quests.map((quest, idx) => (
          <QuestCardEditable
            key={quest.questEntryId || idx}
            quest={quest}
            questIndex={idx}
            onUpdate={(updatedQuest) => updateQuest(idx, updatedQuest)}
            onRemove={() => removeQuest(idx)}
          />
        ))}
      </div>
    </>
  );
}

interface CustomTrackerPanelProps {
  fields: CustomTrackerField[];
  onUpdate: (fields: CustomTrackerField[]) => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}

export function CustomTrackerPanel({
  fields,
  onUpdate,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: CustomTrackerPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const { onUpdateFieldLocks } = useTrackerLockContext();
  const addField = () => {
    onUpdate([...fields, { name: "New Field", value: "" }]);
  };

  const removeField = (idx: number) => {
    onUpdateFieldLocks?.((locks) =>
      removeTrackerFieldLockPrefix(locks, customTrackerFieldLockPrefix(fields[idx]!, idx)),
    );
    onUpdate(fields.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, updated: CustomTrackerField) => {
    const previous = fields[idx];
    if (previous && previous.name !== updated.name) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          customTrackerFieldLockPrefix(previous, idx),
          customTrackerFieldLockPrefix(updated, idx),
        ),
      );
    }
    const next = [...fields];
    next[idx] = updated;
    onUpdate(next);
  };
  const lockFor = useHudFieldLockResolver();

  return (
    <>
      <div className={cn(NEUTRAL_PANEL_HEADER, "flex items-center justify-between")}>
        <span className={NEUTRAL_PANEL_TITLE}>
          <SlidersHorizontal size="0.625rem" className="text-[var(--marinara-chat-chrome-accent)]" />{" "}
          {localizeUi("ui.chat.customtrackerwidget.customTracker")}
        </span>
        <span className="flex items-center gap-1">
          <TrackerSectionRefresh
            agentType="custom-tracker"
            onRerunSingleTracker={onRerunSingleTracker}
            busy={isTrackerRetryBusy}
            title={localizeUi("ui.chat.combinedplayerpanel.reRunCustomTrackerOnly")}
          />
          <HudLockModeToggle />
          <button onClick={addField} className={TRACKER_SECTION_ACTION}>
            <Plus size="0.625rem" /> {localizeUi("ui.characters.metadatatab.add")}
          </button>
        </span>
      </div>
      <div className="p-2 space-y-1">
        {fields.length === 0 && (
          <div className={cn(EMPTY_STATE, "py-2")}>
            {localizeUi("ui.chat.customtrackerpanel.noFieldsTrackedAddOneAbove")}
          </div>
        )}
        {fields.map((field, idx) => {
          const nameLock = lockFor(customTrackerLockKey(field, "name", idx));
          const valueLock = lockFor(customTrackerLockKey(field, "value", idx));
          const toggleValueLock = () => {
            if (field.locked) updateField(idx, { ...field, locked: false });
            if (valueLock.locked || !field.locked) valueLock.onToggle();
          };
          return (
            <div
              key={idx}
              className="group/field flex items-center gap-1.5 rounded-lg bg-[var(--muted)]/20 px-2 py-1.5"
            >
              <SlidersHorizontal size="0.625rem" className="shrink-0 text-[var(--muted-foreground)]/65" />
              <InlineEdit
                value={field.name}
                onSave={(value) => updateField(idx, { ...field, name: value })}
                className="flex-1 min-w-0"
                placeholder={localizeUi("ui.chat.combinedplayerpanel.fieldName")}
                locked={nameLock.locked}
              />
              <HudFieldLockButton
                {...nameLock}
                label={localizeUi("ui.chat.combinedplayerpanel.value1Name", {
                  value1: field.name || localizeUi("ui.chat.combinedplayerpanel.field"),
                })}
              />
              <span className="text-[var(--muted-foreground)]/40 text-[0.5rem]">=</span>
              <InlineEdit
                value={field.value}
                onSave={(value) => updateField(idx, { ...field, value })}
                className="flex-1 min-w-0"
                placeholder={localizeUi("ui.chat.combinedplayerpanel.value")}
                locked={valueLock.locked || field.locked}
              />
              <HudFieldLockButton
                locked={valueLock.locked || field.locked}
                onToggle={toggleValueLock}
                label={localizeUi("ui.chat.combinedplayerpanel.value1Value", {
                  value1: field.name || localizeUi("ui.chat.combinedplayerpanel.field"),
                })}
              />
              <button
                onClick={() => removeField(idx)}
                className="text-[var(--muted-foreground)]/40 hover:text-red-500 transition-colors shrink-0"
                title={localizeUi("ui.chat.combinedplayerpanel.removeField")}
              >
                <X size="0.5625rem" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

interface CombinedWorldPanelProps {
  location: string;
  date: string;
  time: string;
  weather: string;
  temperature: string;
  worldCustomFields: WorldCustomField[];
  onSaveLocation: (v: string) => void;
  onSaveDate: (v: string) => void;
  onSaveTime: (v: string) => void;
  onSaveWeather: (v: string) => void;
  onSaveTemperature: (v: string) => void;
  onUpdateWorldCustomFields: (fields: WorldCustomField[]) => void;
  weatherEmoji: string;
  pinColor: string;
  dateColor: string;
  timeColor: string;
  weatherColor: string;
  tempColor: string;
  onClose: () => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}

export function CombinedWorldPanel({
  location,
  date,
  time,
  weather,
  temperature,
  worldCustomFields,
  onSaveLocation,
  onSaveDate,
  onSaveTime,
  onSaveWeather,
  onSaveTemperature,
  onUpdateWorldCustomFields,
  weatherEmoji,
  pinColor,
  dateColor,
  timeColor,
  weatherColor,
  tempColor,
  onClose,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: CombinedWorldPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const lockFor = useHudFieldLockResolver();
  const locationLock = lockFor(worldTrackerLockKey("location"));
  const dateLock = lockFor(worldTrackerLockKey("date"));
  const timeLock = lockFor(worldTrackerLockKey("time"));
  const weatherLock = lockFor(worldTrackerLockKey("weather"));
  const temperatureLock = lockFor(worldTrackerLockKey("temperature"));

  return (
    <>
      <div className={cn(NEUTRAL_PANEL_HEADER, "flex items-center justify-between")}>
        <span className={NEUTRAL_PANEL_TITLE}>
          <CloudSun size="0.625rem" className="text-sky-400/80" />{" "}
          {localizeUi("ui.panels.appearancesettings.worldState")}
        </span>
        <span className="flex items-center gap-1">
          <TrackerSectionRefresh
            agentType="world-state"
            onRerunSingleTracker={onRerunSingleTracker}
            busy={isTrackerRetryBusy}
            title={localizeUi("ui.chat.combinedworldpanel.reRunWorldStateTrackerOnly")}
          />
          <HudLockModeToggle />
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)]/50 hover:text-[var(--foreground)] transition-colors"
          >
            <X size="0.75rem" />
          </button>
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        <WorldFieldRow
          icon={<MapPin size="0.8125rem" className={pinColor} />}
          label={localizeUi("ui.noodle.noodleprofilesurface.location")}
          value={location}
          onSave={onSaveLocation}
          accent="text-[var(--foreground)]/80"
          locked={locationLock.locked}
          onToggleLock={locationLock.onToggle}
        />
        <WorldFieldRow
          icon={<CalendarDays size="0.8125rem" className={dateColor} />}
          label={localizeUi("ui.agents.tooleditor.date")}
          value={date}
          onSave={onSaveDate}
          accent="text-[var(--foreground)]"
          locked={dateLock.locked}
          onToggleLock={dateLock.onToggle}
        />
        <WorldFieldRow
          icon={<Clock size="0.8125rem" className={timeColor} />}
          label={localizeUi("ui.chat.combinedworldpanel.time")}
          value={time}
          onSave={onSaveTime}
          accent="text-[var(--foreground)]/80"
          locked={timeLock.locked}
          onToggleLock={timeLock.onToggle}
        />
        <WorldFieldRow
          icon={
            <span
              className={cn("text-sm leading-none drop-shadow-sm [text-shadow:0_0_8px_currentColor]", weatherColor)}
            >
              {weatherEmoji}
            </span>
          }
          label={localizeUi("ui.chat.combinedworldpanel.weather")}
          value={weather}
          onSave={onSaveWeather}
          accent="text-[var(--foreground)]/80"
          locked={weatherLock.locked}
          onToggleLock={weatherLock.onToggle}
        />
        <WorldFieldRow
          icon={<Thermometer size="0.8125rem" style={{ color: tempColor }} />}
          label={localizeUi("ui.chat.combinedworldpanel.temperature")}
          value={temperature}
          onSave={onSaveTemperature}
          accent="text-[var(--foreground)]"
          locked={temperatureLock.locked}
          onToggleLock={temperatureLock.onToggle}
        />
        {worldCustomFields.map((field, index) => {
          const name = field.name?.trim() || "Field";
          const valueLock = lockFor(worldCustomFieldTrackerLockKey(field, "value", index));
          return (
            <WorldFieldRow
              key={`${name}-${index}`}
              icon={<WorldCustomFieldIcon icon={field.icon} />}
              label={name}
              value={field.value ?? ""}
              onSave={(value) => {
                const next = [...worldCustomFields];
                next[index] = { ...field, value };
                onUpdateWorldCustomFields(next);
              }}
              accent="text-[var(--foreground)]/80"
              locked={valueLock.locked}
              onToggleLock={valueLock.onToggle}
            />
          );
        })}
      </div>
    </>
  );
}

type InlinePreviewPosition = {
  top: number;
  left: number;
  maxWidth: number;
  maxHeight: number;
};

function InlinePreviewPortal({
  open,
  value,
  anchorRef,
}: {
  open: boolean;
  value: string;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const previewRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<InlinePreviewPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!open || !value) {
      setPosition(null);
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") return;

    const rect = anchor.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setPosition((current) => (current === null ? current : null));
      return;
    }

    const margin = 8;
    const gap = 4;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = Math.min(224, Math.max(120, viewportWidth - margin * 2));
    const measuredWidth = Math.min(maxWidth, Math.max(1, previewRef.current?.offsetWidth ?? 192));
    const naturalHeight = Math.max(40, previewRef.current?.scrollHeight ?? previewRef.current?.offsetHeight ?? 72);
    const availableAbove = Math.max(0, rect.top - margin - gap);
    const availableBelow = Math.max(0, viewportHeight - rect.bottom - margin - gap);
    const placeBelow = naturalHeight > availableAbove && availableBelow > availableAbove;
    const laneHeight = placeBelow ? availableBelow : availableAbove;
    const maxHeight = Math.max(40, Math.min(naturalHeight, laneHeight || viewportHeight - margin * 2));
    const visibleHeight = Math.min(naturalHeight, maxHeight);
    const rawLeft = rect.left + rect.width / 2 - measuredWidth / 2;
    const left = Math.round(Math.max(margin, Math.min(viewportWidth - measuredWidth - margin, rawLeft)));
    const top = Math.round(placeBelow ? rect.bottom + gap : Math.max(margin, rect.top - visibleHeight - gap));

    setPosition((current) =>
      current?.top === top && current.left === left && current.maxWidth === maxWidth && current.maxHeight === maxHeight
        ? current
        : { top, left, maxWidth, maxHeight },
    );
  }, [anchorRef, open, value]);

  useLayoutEffect(() => {
    if (!open || !value) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition, value]);

  useEffect(() => {
    if (!open || !value || typeof window === "undefined") return;

    const update = () => updatePosition();
    const anchor = anchorRef.current;
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);

    if (anchor) resizeObserver?.observe(anchor);
    if (previewRef.current) resizeObserver?.observe(previewRef.current);
    window.addEventListener("resize", update);
    const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("scroll", update, scrollOptions);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, scrollOptions);
    };
  }, [anchorRef, open, updatePosition, value]);

  if (!open || !value || typeof document === "undefined") return null;

  return createPortal(
    <span
      ref={previewRef}
      data-roleplay-inline-preview
      className="pointer-events-none fixed z-[10000] animate-message-in whitespace-normal break-words rounded border border-[var(--border)] bg-[var(--popover)] px-1.5 py-1 text-[0.5625rem] text-[var(--foreground)]/80 shadow-xl"
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        maxWidth: position?.maxWidth ?? 224,
        maxHeight: position?.maxHeight,
        overflow: position ? "hidden" : undefined,
      }}
    >
      {value}
    </span>,
    document.body,
  );
}

function InlineEdit({
  value,
  onSave,
  placeholder,
  className,
  scrollOnHover = false,
  showEditHint = true,
  locked = false,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  scrollOnHover?: boolean;
  showEditHint?: boolean;
  locked?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scrollFieldRef = useRef<HTMLSpanElement>(null);
  const scrollMeasureRef = useRef<HTMLSpanElement>(null);
  const lastTapRef = useRef(0);
  const isTouchRef = useRef(false);
  const [showTip, setShowTip] = useState(false);
  const [scrollActive, setScrollActive] = useState(false);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canScroll = scrollOnHover && !!value;
  const shouldScroll = canScroll && (scrollActive || showTip);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  useEffect(() => {
    return () => {
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setScrollActive(false);
    setShowTip(false);
  }, [value, scrollOnHover]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  const measureScrollOverflow = () => {
    if (!canScroll) return false;
    const field = scrollFieldRef.current;
    const measure = scrollMeasureRef.current;
    if (!field || !measure) return false;

    const nextScrollActive = measure.scrollWidth > field.clientWidth + 1;
    setScrollActive((previous) => (previous === nextScrollActive ? previous : nextScrollActive));
    return nextScrollActive;
  };

  const resetScrollOverflow = () => {
    setScrollActive((previous) => (previous ? false : previous));
  };

  const handleTouchStart = () => {
    isTouchRef.current = true;
    measureScrollOverflow();
  };

  const handleClick = () => {
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
    } else if (measureScrollOverflow()) {
      setShowTip(true);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      tipTimerRef.current = setTimeout(() => setShowTip(false), 2500);
    }
    lastTapRef.current = now;
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
          "rounded border border-[var(--border)] bg-[var(--muted)]/20 px-1.5 py-0.5 text-[0.625rem] text-[var(--foreground)] outline-none focus:border-[var(--foreground)]/30",
          locked && HUD_LOCKED_FIELD_CLASS,
          className,
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onMouseEnter={measureScrollOverflow}
      onFocus={measureScrollOverflow}
      onMouseLeave={resetScrollOverflow}
      onBlur={resetScrollOverflow}
      title={value || undefined}
      aria-label={value || placeholder}
      className={cn(
        "group relative flex min-w-0 items-center overflow-hidden rounded px-0.5 text-left transition-colors hover:bg-[var(--muted)]/20",
        locked && HUD_LOCKED_FIELD_CLASS,
        className,
      )}
    >
      <span
        ref={scrollFieldRef}
        className={cn(
          "min-w-0 flex-1 overflow-hidden whitespace-nowrap scrollbar-hide text-[0.625rem] text-[var(--foreground)]/70",
          shouldScroll && "roleplay-hud-scroll-field",
        )}
      >
        {canScroll && (
          <span
            ref={scrollMeasureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute left-0 top-0 block w-max max-w-none whitespace-nowrap"
          >
            {value}
          </span>
        )}
        {canScroll && shouldScroll ? (
          <span className={cn("roleplay-hud-scroll-track", showTip && "roleplay-hud-scroll-track--active")}>
            <span className="pr-6">{value}</span>
            <span className="pr-6" aria-hidden>
              {value}
            </span>
          </span>
        ) : (
          value || <span className="italic text-[var(--muted-foreground)]/50">{placeholder ?? "—"}</span>
        )}
      </span>
      {showEditHint && (
        <Pencil
          size="0.4375rem"
          className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-40"
        />
      )}
      <InlinePreviewPortal open={showTip} value={value} anchorRef={buttonRef} />
    </button>
  );
}

function PersonaStatusField({
  value,
  onSave,
  locked,
  onToggleLock,
}: {
  value: string;
  onSave?: (v: string) => void;
  locked?: boolean;
  onToggleLock?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="mb-2 rounded-lg border border-[var(--border)]/60 bg-[var(--muted)]/10 px-2 py-1.5">
      <div className="group/field mb-0.5 flex items-center gap-1.5">
        <Sparkles size="0.5625rem" className="text-[var(--muted-foreground)]/60" />
        <span className="text-[0.5625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]/70">
          {localizeUi("ui.chat.personastatusfield.currentStatus")}
        </span>
        <HudFieldLockButton
          locked={locked}
          onToggle={onToggleLock}
          label={localizeUi("ui.chat.personastatusfield.personaStatus")}
        />
      </div>
      <InlineEdit
        value={value}
        onSave={onSave ?? (() => {})}
        className="w-full !text-[0.6875rem] !text-[var(--foreground)]/85"
        placeholder={localizeUi("ui.chat.personastatusfield.statusNotTracked")}
        scrollOnHover
        locked={locked}
      />
    </div>
  );
}

function StatBarEditable({
  stat,
  onUpdateName,
  onUpdateValue,
  onUpdateMax,
  onRemove,
  nameLocked,
  valueLocked,
  maxLocked,
  onToggleNameLock,
  onToggleValueLock,
  onToggleMaxLock,
}: {
  stat: CharacterStat;
  onUpdateName?: (name: string) => void;
  onUpdateValue: (v: number) => void;
  onUpdateMax: (v: number) => void;
  onRemove?: () => void;
  nameLocked?: boolean;
  valueLocked?: boolean;
  maxLocked?: boolean;
  onToggleNameLock?: () => void;
  onToggleValueLock?: () => void;
  onToggleMaxLock?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { lockMode } = useTrackerLockContext();
  const pct = getStatPercent(stat);
  const value = coerceStatNumber(stat.value);
  const max = coerceStatNumber(stat.max);
  const removeButton = onRemove ? (
    <button
      type="button"
      onClick={onRemove}
      title={localizeUi("ui.chat.statbareditable.removeStat")}
      aria-label={localizeUi("ui.chat.professormariattachmentpreviews.removeValue1", {
        value1: stat.name || localizeUi("ui.chat.statbareditable.stat"),
      })}
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded bg-[var(--popover)]/90 text-[var(--muted-foreground)]/45 shadow-sm ring-1 ring-[var(--border)]/70 transition-all hover:text-[var(--destructive)] hover:opacity-100 focus-visible:opacity-100",
        lockMode
          ? "shrink-0 opacity-70"
          : "absolute -right-1 -top-1 opacity-0 group-hover/stat:opacity-80 max-md:opacity-80",
      )}
    >
      <Trash2 size="0.5625rem" />
    </button>
  ) : null;

  return (
    <div className="group/stat relative">
      <div className="flex items-center justify-between mb-0.5">
        {onUpdateName ? (
          <span className="group/field flex min-w-0 items-center gap-1">
            <InlineEdit
              value={stat.name}
              onSave={onUpdateName}
              className="!text-[0.625rem] !font-medium !text-[var(--foreground)]/80"
              placeholder={localizeUi("ui.personas.personastatstab.statName")}
              locked={nameLocked}
            />
            <HudFieldLockButton
              locked={nameLocked}
              onToggle={onToggleNameLock}
              label={localizeUi("ui.chat.combinedplayerpanel.value1Name", {
                value1: stat.name || localizeUi("ui.chat.statbareditable.stat"),
              })}
            />
          </span>
        ) : (
          <span className="text-[0.625rem] font-medium text-[var(--foreground)]/80">{stat.name}</span>
        )}
        <div className="group/field flex items-center gap-0.5 shrink-0 text-[0.5625rem] text-[var(--muted-foreground)]/60">
          <input
            type="number"
            value={value}
            onChange={(e) => onUpdateValue(Number(e.target.value))}
            className={cn(
              "w-12 rounded bg-transparent text-right outline-none text-[var(--foreground)]/80 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              valueLocked && HUD_LOCKED_FIELD_CLASS,
            )}
          />
          <HudFieldLockButton
            locked={valueLocked}
            onToggle={onToggleValueLock}
            label={localizeUi("ui.chat.combinedplayerpanel.value1Value", {
              value1: stat.name || localizeUi("ui.chat.statbareditable.stat"),
            })}
          />
          <span>/</span>
          <input
            type="number"
            value={max}
            onChange={(e) => onUpdateMax(Number(e.target.value))}
            className={cn(
              "w-12 rounded bg-transparent outline-none text-[var(--foreground)]/80 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              maxLocked && HUD_LOCKED_FIELD_CLASS,
            )}
          />
          <HudFieldLockButton
            locked={maxLocked}
            onToggle={onToggleMaxLock}
            label={localizeUi("ui.chat.statbareditable.value1Max", {
              value1: stat.name || localizeUi("ui.chat.statbareditable.stat"),
            })}
          />
          {lockMode && removeButton}
        </div>
      </div>
      {!lockMode && removeButton}
      <div className="h-1.5 rounded-full bg-[var(--muted)]/30 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: stat.color || "#8b5cf6" }}
        />
      </div>
    </div>
  );
}

function QuestCardEditable({
  quest,
  questIndex,
  onUpdate,
  onRemove,
}: {
  quest: QuestProgress;
  questIndex: number;
  onUpdate: (q: QuestProgress) => void;
  onRemove: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { onUpdateFieldLocks } = useTrackerLockContext();
  const addObjective = () => {
    onUpdate({
      ...quest,
      objectives: [...quest.objectives, { text: "New objective", completed: false }],
    });
  };

  const toggleObjective = (idx: number) => {
    const next = [...quest.objectives];
    next[idx] = { ...next[idx]!, completed: !next[idx]!.completed };
    onUpdate({ ...quest, objectives: next });
  };

  const removeObjective = (idx: number) => {
    onUpdateFieldLocks?.((locks) =>
      removeTrackerFieldLockPrefix(
        locks,
        questObjectiveTrackerLockPrefix(quest, questIndex, quest.objectives[idx]!, idx),
      ),
    );
    onUpdate({ ...quest, objectives: quest.objectives.filter((_, objectiveIndex) => objectiveIndex !== idx) });
  };

  const updateObjectiveText = (idx: number, text: string) => {
    const previous = quest.objectives[idx];
    const next = [...quest.objectives];
    next[idx] = { ...next[idx]!, text };
    if (previous && previous.text !== text) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          questObjectiveTrackerLockPrefix(quest, questIndex, previous, idx),
          questObjectiveTrackerLockPrefix(quest, questIndex, next[idx]!, idx),
        ),
      );
    }
    onUpdate({ ...quest, objectives: next });
  };

  const completed = quest.objectives.filter((objective) => objective.completed).length;
  const total = quest.objectives.length;
  const lockFor = useHudFieldLockResolver();
  const questCompletedLock = lockFor(questTrackerLockKey(quest, questIndex, "completed"));
  const questNameLock = lockFor(questTrackerLockKey(quest, questIndex, "name"));

  return (
    <div className="rounded-lg bg-[var(--muted)]/20 p-2">
      <div className="group/field flex items-center gap-1.5">
        <button
          onClick={() => onUpdate({ ...quest, completed: !quest.completed })}
          title={
            quest.completed
              ? localizeUi("ui.chat.questcardeditable.markIncomplete")
              : localizeUi("ui.chat.questcardeditable.markComplete")
          }
          className={cn("rounded-sm", questCompletedLock.locked && HUD_LOCKED_FIELD_CLASS)}
        >
          {quest.completed ? (
            <CheckCircle2 size="0.6875rem" className="text-emerald-400 shrink-0" />
          ) : (
            <Target size="0.6875rem" className="text-amber-400 shrink-0" />
          )}
        </button>
        <HudFieldLockButton
          {...questCompletedLock}
          label={localizeUi("ui.chat.questcardeditable.value1Completion", {
            value1: quest.name || localizeUi("ui.chat.questcardeditable.quest"),
          })}
        />
        <InlineEdit
          value={quest.name}
          onSave={(value) => onUpdate({ ...quest, name: value })}
          className={cn("flex-1 !font-medium", quest.completed && "line-through opacity-50")}
          placeholder={localizeUi("ui.chat.questcardeditable.questName")}
          locked={questNameLock.locked}
        />
        <HudFieldLockButton
          {...questNameLock}
          label={localizeUi("ui.chat.combinedplayerpanel.value1Name", {
            value1: quest.name || localizeUi("ui.chat.questcardeditable.quest"),
          })}
        />
        {total > 0 && (
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]/60">
            {completed}/{total}
          </span>
        )}
        <button
          onClick={onRemove}
          className="text-[var(--muted-foreground)]/40 hover:text-red-500 transition-colors shrink-0"
          title={localizeUi("ui.chat.questcardeditable.removeQuest")}
        >
          <X size="0.5625rem" />
        </button>
      </div>
      {!quest.completed && (
        <div className="mt-1 space-y-0.5 pl-4">
          {quest.objectives.map((objective, idx) => {
            const completedLock = lockFor(questObjectiveTrackerLockKey(quest, questIndex, objective, "completed", idx));
            const textLock = lockFor(questObjectiveTrackerLockKey(quest, questIndex, objective, "text", idx));
            return (
              <div key={idx} className="group group/field flex items-center gap-1 text-[0.5625rem]">
                <button
                  onClick={() => toggleObjective(idx)}
                  className={cn("rounded-sm", completedLock.locked && HUD_LOCKED_FIELD_CLASS)}
                >
                  {objective.completed ? (
                    <CheckCircle2 size="0.5rem" className="text-emerald-400/60 shrink-0" />
                  ) : (
                    <Circle size="0.5rem" className="text-[var(--muted-foreground)]/40 shrink-0" />
                  )}
                </button>
                <HudFieldLockButton
                  {...completedLock}
                  label={localizeUi("ui.chat.questcardeditable.objectiveCompletion")}
                />
                <InlineEdit
                  value={objective.text}
                  onSave={(value) => updateObjectiveText(idx, value)}
                  className={cn("flex-1", objective.completed && "line-through opacity-50")}
                  placeholder={localizeUi("ui.chat.questcardeditable.objective")}
                  locked={textLock.locked}
                />
                <HudFieldLockButton {...textLock} label={localizeUi("ui.chat.questcardeditable.objectiveText")} />
                <button
                  onClick={() => removeObjective(idx)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)]/40 hover:text-red-500 transition-all shrink-0"
                >
                  <X size="0.4375rem" />
                </button>
              </div>
            );
          })}
          <button
            onClick={addObjective}
            className="flex items-center gap-0.5 text-[0.5rem] text-[var(--muted-foreground)]/40 hover:text-[var(--muted-foreground)] transition-colors mt-0.5"
          >
            <Plus size="0.4375rem" /> {localizeUi("ui.chat.questcardeditable.objective_d2dc873")}
          </button>
        </div>
      )}
    </div>
  );
}

function LabeledEdit({
  label,
  value,
  onSave,
  locked,
  onToggleLock,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  locked?: boolean;
  onToggleLock?: () => void;
}) {
  const { lockMode } = useTrackerLockContext();

  return (
    <div className="group/field relative grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-1">
      <span
        className={cn(
          "relative flex w-10 min-w-0 shrink-0 items-center text-[0.5625rem] text-[var(--muted-foreground)]/60",
          lockMode && "pr-3",
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        <HudFieldLockButton
          locked={locked}
          onToggle={onToggleLock}
          label={label}
          className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 bg-[var(--popover)]/85 shadow-sm"
        />
      </span>
      <InlineEdit value={value} onSave={onSave} className="min-w-0" placeholder="—" scrollOnHover locked={locked} />
    </div>
  );
}

function WorldFieldRow({
  icon,
  label,
  value,
  onSave,
  accent,
  locked,
  onToggleLock,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onSave: (v: string) => void;
  accent: string;
  locked?: boolean;
  onToggleLock?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
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
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "group/row group/field flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-[var(--muted)]/20",
        locked && "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]",
      )}
    >
      <div className="shrink-0 w-5 flex items-center justify-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.5625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]/60 mb-0.5">
          {label}
        </div>
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
              "w-full rounded bg-transparent px-1 py-0.5 text-[0.6875rem] font-medium outline-none placeholder:text-[var(--muted-foreground)]/40",
              locked && HUD_LOCKED_FIELD_CLASS,
              accent,
            )}
            placeholder={label}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              "w-full truncate rounded px-1 py-0.5 text-left text-[0.6875rem] font-medium",
              value ? "text-[var(--foreground)]/80" : "text-[var(--muted-foreground)]/50 italic",
              locked && HUD_LOCKED_FIELD_INSET_CLASS,
            )}
          >
            {value || `Set ${label.toLowerCase()}…`}
          </button>
        )}
      </div>
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-[var(--muted-foreground)]/30 opacity-0 group-hover/row:opacity-100 transition-opacity"
          title={localizeUi("ui.chat.worldfieldrow.editValue1", { value1: label.toLowerCase() })}
        >
          <Pencil size="0.625rem" />
        </button>
      )}
      <HudFieldLockButton locked={locked} onToggle={onToggleLock} label={label.toLowerCase()} />
    </div>
  );
}
