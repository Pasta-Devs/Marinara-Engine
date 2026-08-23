// ──────────────────────────────────────────────
// Game: Session History Panel (view past sessions)
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  GitBranch,
  History,
  ChevronDown,
  ChevronRight,
  ScrollText,
  Users,
  Sparkles,
  X,
  RefreshCw,
  Play,
  SlidersHorizontal,
} from "lucide-react";
import type { GameInitialSetupSnapshot, GameMap, GameNpc, PartyArc, SessionSummary } from "@marinara-engine/shared";
import { toast } from "sonner";
import { AnimatedText } from "./AnimatedText";
import { GameSetupSummary } from "./GameSetupSummary";
import { useTranslation as useUiTranslation } from "react-i18next";

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function normalizeTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function normalizeStatsSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function deriveResumePointFallback(summary: string): string {
  const paragraphs = summary
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return paragraphs[paragraphs.length - 1] ?? summary;
}

function formatListDraft(items: string[]): string {
  return items.join("\n");
}

function parseListDraft(value: string): string[] {
  return value
    .split("\n")
    .map((item) => normalizeText(item))
    .filter((item) => item.length > 0);
}

interface SessionSummaryDraft {
  summary: string;
  resumePoint: string;
  partyDynamics: string;
  partyState: string;
  keyDiscoveries: string;
  characterMoments: string;
  littleDetails: string;
  npcUpdates: string;
  statsSnapshot: string;
}

export interface CurrentSessionSecrets {
  worldOverview: string;
  storyArc: string;
  plotTwists: string[];
  partyArcs: PartyArc[];
  maps: GameMap[];
  npcs: GameNpc[];
  characterCards: Array<Record<string, unknown>>;
}

interface CurrentSessionSecretDraft {
  worldOverview: string;
  storyArc: string;
  plotTwists: string;
  partyArcs: string;
  maps: string;
  npcs: string;
  characterCards: string;
}

type LorebookKeeperRunStatus = "running" | "success" | "failed";

interface LorebookKeeperLastRun {
  sessionNumber: number;
  status: LorebookKeeperRunStatus;
  updatedAt: string;
  entryCount?: number;
  error?: string;
}

function formatJsonDraft(value: unknown): string {
  return JSON.stringify(value ?? [], null, 2);
}

function buildCurrentSecretsDraft(secrets: CurrentSessionSecrets): CurrentSessionSecretDraft {
  return {
    worldOverview: secrets.worldOverview,
    storyArc: secrets.storyArc,
    plotTwists: formatListDraft(secrets.plotTwists),
    partyArcs: formatJsonDraft(secrets.partyArcs),
    maps: formatJsonDraft(secrets.maps),
    npcs: formatJsonDraft(secrets.npcs),
    characterCards: formatJsonDraft(secrets.characterCards),
  };
}

function parseJsonArrayDraft<T>(label: string, value: string): T[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`);
  }
  return parsed as T[];
}

function SpoilerTextSection({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
      <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function SpoilerListSection({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
      <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      <ul className="flex flex-col gap-1 pl-4">
        {values.map((value, index) => (
          <li key={index} className="list-disc text-xs text-[var(--foreground)]">
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpoilerJsonSection({ label, value }: { label: string; value: unknown[] }) {
  if (!value.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
      <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

interface GameSessionHistoryProps {
  summaries: SessionSummary[];
  currentSessionNumber: number;
  currentSessionDate?: string | null;
  currentSecrets?: CurrentSessionSecrets | null;
  savingSessionNumber?: number | null;
  savingCurrentSecrets?: boolean;
  regeneratingSessionNumber?: number | null;
  lorebookKeeperEnabled?: boolean;
  lorebookKeeperLastRun?: LorebookKeeperLastRun | null;
  regeneratingLorebookSessionNumber?: number | null;
  updatingPlotArcsSessionNumber?: number | null;
  onSaveCurrentSecrets?: (secrets: CurrentSessionSecrets) => Promise<void> | void;
  onSaveSession?: (sessionNumber: number, session: SessionSummary) => Promise<void> | void;
  onRegenerateSession?: (sessionNumber: number) => Promise<void> | void;
  onRegenerateLorebook?: (sessionNumber: number) => Promise<void> | void;
  onUpdatePlotArcs?: (sessionNumber: number) => Promise<void> | void;
  onReplaySession?: (sessionNumber: number) => void;
  initialSetupGameName?: string;
  initialSetupSnapshot?: GameInitialSetupSnapshot | null;
  currentSessionActionLabel?: string;
  currentSessionActionIcon?: ReactNode;
  currentSessionActionDisabled?: boolean;
  onCurrentSessionAction?: () => void;
  onClose: () => void;
  embedded?: boolean;
}

export function GameSessionHistory({
  summaries,
  currentSessionNumber,
  currentSessionDate = null,
  currentSecrets = null,
  savingSessionNumber = null,
  savingCurrentSecrets = false,
  regeneratingSessionNumber = null,
  lorebookKeeperEnabled = false,
  lorebookKeeperLastRun = null,
  regeneratingLorebookSessionNumber = null,
  updatingPlotArcsSessionNumber = null,
  onSaveCurrentSecrets,
  onSaveSession,
  onRegenerateSession,
  onRegenerateLorebook,
  onUpdatePlotArcs,
  onReplaySession,
  initialSetupGameName = "Game",
  initialSetupSnapshot = null,
  currentSessionActionLabel,
  currentSessionActionIcon,
  currentSessionActionDisabled = false,
  onCurrentSessionAction,
  onClose,
  embedded = false,
}: GameSessionHistoryProps) {
  const { t: localizeUi } = useUiTranslation();
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [draft, setDraft] = useState<SessionSummaryDraft | null>(null);
  const [spoilersVisible, setSpoilersVisible] = useState(false);
  const [initialSetupVisible, setInitialSetupVisible] = useState(false);
  const [editingSecrets, setEditingSecrets] = useState(false);
  const [secretDraft, setSecretDraft] = useState<CurrentSessionSecretDraft | null>(() =>
    currentSecrets ? buildCurrentSecretsDraft(currentSecrets) : null,
  );

  const sorted = useMemo(() => {
    const normalized = (Array.isArray(summaries) ? summaries : []).map((session, index) => {
      const raw = (session ?? {}) as Partial<SessionSummary> & Record<string, unknown>;
      const summary = normalizeText(raw.summary, `Session ${index + 1} concluded.`);
      return {
        sessionNumber: index + 1,
        summary,
        resumePoint: normalizeText(raw.resumePoint, deriveResumePointFallback(summary)),
        partyDynamics: normalizeText(raw.partyDynamics),
        partyState: normalizeText(raw.partyState),
        keyDiscoveries: [...normalizeTextList(raw.keyDiscoveries), ...normalizeTextList(raw.revelations)],
        characterMoments: normalizeTextList(raw.characterMoments),
        littleDetails: normalizeTextList(raw.littleDetails),
        npcUpdates: normalizeTextList(raw.npcUpdates),
        statsSnapshot: normalizeStatsSnapshot(raw.statsSnapshot),
        timestamp: normalizeText(raw.timestamp, new Date().toISOString()),
        nextSessionRequest: normalizeText(raw.nextSessionRequest) || null,
      } satisfies SessionSummary;
    });

    return normalized.sort((a, b) => b.sessionNumber - a.sessionNumber);
  }, [summaries]);
  const latestCompletedSessionNumber = sorted[0]?.sessionNumber ?? 0;

  useEffect(() => {
    if (!editingSecrets) {
      setSecretDraft(currentSecrets ? buildCurrentSecretsDraft(currentSecrets) : null);
    }
  }, [currentSecrets, editingSecrets]);

  const handleStartEditing = (session: SessionSummary) => {
    setEditingSession(session.sessionNumber);
    setDraft({
      summary: session.summary,
      resumePoint: session.resumePoint,
      partyDynamics: session.partyDynamics,
      partyState: session.partyState,
      keyDiscoveries: formatListDraft(session.keyDiscoveries),
      characterMoments: formatListDraft(session.characterMoments),
      littleDetails: formatListDraft(session.littleDetails),
      npcUpdates: formatListDraft(session.npcUpdates),
      statsSnapshot: JSON.stringify(session.statsSnapshot, null, 2),
    });
  };

  const handleCancelEditing = () => {
    setEditingSession(null);
    setDraft(null);
  };

  const handleSaveSession = async (session: SessionSummary) => {
    if (!onSaveSession || !draft) return;

    let statsSnapshot: Record<string, unknown> = {};
    const statsSnapshotInput = draft.statsSnapshot.trim();
    if (statsSnapshotInput) {
      try {
        const parsed = JSON.parse(statsSnapshotInput);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Stats snapshot must be a JSON object.");
        }
        statsSnapshot = parsed as Record<string, unknown>;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.game.gamesessionhistory.statsSnapshotMustBeValidJson"),
        );
        return;
      }
    }

    try {
      await onSaveSession(session.sessionNumber, {
        sessionNumber: session.sessionNumber,
        summary: draft.summary.trim(),
        resumePoint: draft.resumePoint.trim(),
        partyDynamics: draft.partyDynamics.trim(),
        partyState: draft.partyState.trim(),
        keyDiscoveries: parseListDraft(draft.keyDiscoveries),
        characterMoments: parseListDraft(draft.characterMoments),
        littleDetails: parseListDraft(draft.littleDetails),
        npcUpdates: parseListDraft(draft.npcUpdates),
        nextSessionRequest: session.nextSessionRequest ?? null,
        statsSnapshot,
        timestamp: session.timestamp,
      });
      setEditingSession(null);
      setDraft(null);
    } catch {
      // The parent handles the error toast and keeps the draft intact.
    }
  };

  const handleStartEditingSecrets = () => {
    if (!currentSecrets) return;
    setSecretDraft(buildCurrentSecretsDraft(currentSecrets));
    setEditingSecrets(true);
  };

  const handleCancelEditingSecrets = () => {
    setSecretDraft(currentSecrets ? buildCurrentSecretsDraft(currentSecrets) : null);
    setEditingSecrets(false);
  };

  const handleSaveCurrentSecrets = async () => {
    if (!onSaveCurrentSecrets || !secretDraft) return;

    try {
      await onSaveCurrentSecrets({
        worldOverview: secretDraft.worldOverview.trim(),
        storyArc: secretDraft.storyArc.trim(),
        plotTwists: parseListDraft(secretDraft.plotTwists),
        partyArcs: parseJsonArrayDraft<PartyArc>("Party arcs", secretDraft.partyArcs),
        maps: parseJsonArrayDraft<GameMap>("Maps", secretDraft.maps),
        npcs: parseJsonArrayDraft<GameNpc>("NPCs", secretDraft.npcs),
        characterCards: parseJsonArrayDraft<Record<string, unknown>>("Character cards", secretDraft.characterCards),
      });
      setEditingSecrets(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.game.gamesessionhistory.couldNotSaveCurrentSessionSpoilers"),
      );
    }
  };

  const currentSessionDateStr = currentSessionDate
    ? new Date(currentSessionDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  return (
    <div
      className={
        embedded ? "flex min-h-0 flex-col" : "absolute inset-0 z-40 flex flex-col bg-[var(--card)]/95 backdrop-blur-sm"
      }
    >
      {!embedded && (
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[var(--muted-foreground)]" />
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {localizeUi("ui.game.gamesurfacecomponent.sessionHistory")}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              ({sorted.length} {localizeUi("ui.game.gamesessionhistory.pastSession")}
              {sorted.length !== 1 ? localizeUi("ui.noodle.stageprofileview.s") : ""})
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className={embedded ? "px-1 py-2" : "flex-1 overflow-y-auto px-4 py-3"}>
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/45">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {localizeUi("game.toolbar.session")} {currentSessionNumber} {localizeUi("ui.game.gamemappanel.current")}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">{currentSessionDateStr}</span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSpoilersVisible((visible) => !visible);
                    if (!spoilersVisible && currentSecrets) {
                      setSecretDraft(buildCurrentSecretsDraft(currentSecrets));
                    }
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title={
                    spoilersVisible
                      ? localizeUi("ui.game.gamesessionhistory.hideSpoilers")
                      : localizeUi("ui.game.gamesessionhistory.showSpoilers")
                  }
                  aria-label={
                    spoilersVisible
                      ? localizeUi("ui.game.gamesessionhistory.hideSpoilers")
                      : localizeUi("ui.game.gamesessionhistory.showSpoilers")
                  }
                >
                  {spoilersVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                {onCurrentSessionAction && currentSessionActionIcon && currentSessionActionLabel && (
                  <button
                    type="button"
                    onClick={onCurrentSessionAction}
                    disabled={currentSessionActionDisabled}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                    title={currentSessionActionLabel}
                    aria-label={currentSessionActionLabel}
                  >
                    {currentSessionActionIcon}
                  </button>
                )}
              </div>
            </div>

            {spoilersVisible && (
              <div className="border-t border-[var(--border)] px-4 py-3">
                {!currentSecrets ? (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.game.gamesessionhistory.noGmSpoilerStateHasBeenGeneratedYet")}
                  </p>
                ) : editingSecrets ? (
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        {localizeUi("ui.game.gamesessionhistory.worldOverview")}
                      </span>
                      <textarea
                        value={secretDraft?.worldOverview ?? ""}
                        onChange={(event) =>
                          setSecretDraft((prev) => (prev ? { ...prev, worldOverview: event.target.value } : prev))
                        }
                        rows={5}
                        disabled={savingCurrentSecrets}
                        className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        {localizeUi("ui.game.gamesessionhistory.storyArc")}
                      </span>
                      <textarea
                        value={secretDraft?.storyArc ?? ""}
                        onChange={(event) =>
                          setSecretDraft((prev) => (prev ? { ...prev, storyArc: event.target.value } : prev))
                        }
                        rows={5}
                        disabled={savingCurrentSecrets}
                        className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        {localizeUi("ui.game.gamesessionhistory.plotTwists")}
                      </span>
                      <textarea
                        value={secretDraft?.plotTwists ?? ""}
                        onChange={(event) =>
                          setSecretDraft((prev) => (prev ? { ...prev, plotTwists: event.target.value } : prev))
                        }
                        rows={5}
                        disabled={savingCurrentSecrets}
                        placeholder={localizeUi("ui.game.gamesessionhistory.onePlotTwistPerLine")}
                        className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        {localizeUi("ui.game.gamesessionhistory.partyArcsJson")}
                      </span>
                      <textarea
                        value={secretDraft?.partyArcs ?? ""}
                        onChange={(event) =>
                          setSecretDraft((prev) => (prev ? { ...prev, partyArcs: event.target.value } : prev))
                        }
                        rows={8}
                        disabled={savingCurrentSecrets}
                        className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        {localizeUi("ui.game.gamesessionhistory.mapsJson")}
                      </span>
                      <textarea
                        value={secretDraft?.maps ?? ""}
                        onChange={(event) =>
                          setSecretDraft((prev) => (prev ? { ...prev, maps: event.target.value } : prev))
                        }
                        rows={10}
                        disabled={savingCurrentSecrets}
                        className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        {localizeUi("ui.game.gamesessionhistory.npcsJson")}
                      </span>
                      <textarea
                        value={secretDraft?.npcs ?? ""}
                        onChange={(event) =>
                          setSecretDraft((prev) => (prev ? { ...prev, npcs: event.target.value } : prev))
                        }
                        rows={8}
                        disabled={savingCurrentSecrets}
                        className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                        {localizeUi("ui.game.gamesessionhistory.characterCardsJson")}
                      </span>
                      <textarea
                        value={secretDraft?.characterCards ?? ""}
                        onChange={(event) =>
                          setSecretDraft((prev) => (prev ? { ...prev, characterCards: event.target.value } : prev))
                        }
                        rows={8}
                        disabled={savingCurrentSecrets}
                        className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                      />
                    </label>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEditingSecrets}
                        disabled={savingCurrentSecrets}
                        className="rounded-md bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                      >
                        {localizeUi("chat.delete.dialog.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveCurrentSecrets()}
                        disabled={savingCurrentSecrets}
                        className="rounded-md bg-[var(--foreground)]/12 px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--foreground)]/18 disabled:opacity-50"
                      >
                        {savingCurrentSecrets
                          ? localizeUi("ui.noodle.stageprofileform.saving")
                          : localizeUi("ui.game.gamesessionhistory.saveSpoilers")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-end">
                      {onSaveCurrentSecrets && (
                        <button
                          type="button"
                          onClick={handleStartEditingSecrets}
                          className="rounded-md bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        >
                          {localizeUi("ui.game.gamesessionhistory.editSpoilers")}
                        </button>
                      )}
                    </div>
                    <SpoilerTextSection
                      label={localizeUi("ui.game.gamesessionhistory.worldOverview")}
                      value={currentSecrets.worldOverview}
                    />
                    <SpoilerTextSection
                      label={localizeUi("ui.game.gamesessionhistory.storyArc")}
                      value={currentSecrets.storyArc}
                    />
                    <SpoilerListSection
                      label={localizeUi("ui.game.gamesessionhistory.plotTwists")}
                      values={currentSecrets.plotTwists}
                    />
                    <SpoilerJsonSection
                      label={localizeUi("ui.game.gamesessionhistory.partyArcs")}
                      value={currentSecrets.partyArcs}
                    />
                    <SpoilerJsonSection
                      label={localizeUi("ui.game.gamesessionhistory.maps")}
                      value={currentSecrets.maps}
                    />
                    <SpoilerJsonSection
                      label={localizeUi("ui.game.gamesessionhistory.npcs")}
                      value={currentSecrets.npcs}
                    />
                    <SpoilerJsonSection
                      label={localizeUi("ui.game.gamesessionhistory.characterCards")}
                      value={currentSecrets.characterCards}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {initialSetupSnapshot && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
              <button
                type="button"
                onClick={() => setInitialSetupVisible((visible) => !visible)}
                aria-expanded={initialSetupVisible}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]"
              >
                {initialSetupVisible ? (
                  <ChevronDown size={14} className="shrink-0 text-[var(--muted-foreground)]" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-[var(--muted-foreground)]" />
                )}
                <SlidersHorizontal size={14} className="shrink-0 text-[var(--primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--foreground)]">
                    {localizeUi("ui.game.gamesessionhistory.initialGameSetup")}
                  </span>
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.game.gamesessionhistory.reviewCopyOrShareTheSettingsThatCreatedThis")}
                  </span>
                </span>
              </button>
              {initialSetupVisible && (
                <div className="border-t border-[var(--border)]">
                  <GameSetupSummary gameName={initialSetupGameName} snapshot={initialSetupSnapshot} embedded />
                </div>
              )}
            </div>
          )}

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-[var(--muted-foreground)]">
              <ScrollText size={24} className="opacity-50" />
              <span className="text-sm">{localizeUi("ui.game.gamesessionhistory.noCompletedSessionsYet")}</span>
              <span className="text-xs">
                {localizeUi("ui.game.gamesessionhistory.concludeYourCurrentSessionToSeeASummaryHere")}
              </span>
            </div>
          ) : (
            sorted.map((session) => {
              const isExpanded = expandedSession === session.sessionNumber;
              const isEditing = editingSession === session.sessionNumber;
              const isSaving = savingSessionNumber === session.sessionNumber;
              const isRegenerating = regeneratingSessionNumber === session.sessionNumber;
              const isUpdatingPlotArcs = updatingPlotArcsSessionNumber === session.sessionNumber;
              const isLatestCompletedSession = session.sessionNumber === latestCompletedSessionNumber;
              const isRegeneratingLorebook = regeneratingLorebookSessionNumber === session.sessionNumber;
              const canRegenerateLorebook =
                lorebookKeeperEnabled && isLatestCompletedSession && typeof onRegenerateLorebook === "function";
              const lorebookRun =
                lorebookKeeperLastRun?.sessionNumber === session.sessionNumber ? lorebookKeeperLastRun : null;
              const date = new Date(session.timestamp);
              const dateStr = date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div key={session.sessionNumber} className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
                  <button
                    onClick={() => setExpandedSession(isExpanded ? null : session.sessionNumber)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronRight size={14} className="text-[var(--muted-foreground)]" />
                    )}
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {localizeUi("game.toolbar.session")} {session.sessionNumber}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">{dateStr}</span>
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                      {session.keyDiscoveries.length} {localizeUi("ui.game.gamesessionhistory.discoveries")}
                    </span>
                  </button>

                  {canRegenerateLorebook && lorebookRun?.status === "failed" && (
                    <div
                      data-component="GameSessionHistory.LorebookKeeperFailure"
                      className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2"
                    >
                      <AlertTriangle size={14} className="shrink-0 text-[var(--destructive)]" />
                      <span className="mr-auto text-xs font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.game.gamesessionhistory.lorebookKeeperFailed")}
                      </span>
                      <button
                        type="button"
                        onClick={() => void onRegenerateLorebook?.(session.sessionNumber)}
                        disabled={isRegeneratingLorebook}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)]/14 px-2 py-1 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/22 disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isRegeneratingLorebook ? "animate-spin" : undefined} />
                        {isRegeneratingLorebook
                          ? localizeUi("ui.game.gamesessionhistory.retrying")
                          : localizeUi("ui.game.gamesessionhistory.retryLorebookKeeper")}
                      </button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="border-t border-[var(--border)] px-4 py-3">
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <ScrollText size={12} />
                            {localizeUi("ui.game.gamesessionhistory.summary")}
                          </div>
                          {!isEditing && (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {onReplaySession && (
                                <button
                                  type="button"
                                  onClick={() => onReplaySession(session.sessionNumber)}
                                  title={localizeUi("ui.game.gamesessionhistory.replaySessionValue1FromTheBeginning", {
                                    value1: session.sessionNumber,
                                  })}
                                  className="inline-flex items-center gap-1 rounded-md bg-[var(--primary)]/12 px-2 py-1 text-[0.6875rem] font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/25 transition-colors hover:bg-[var(--primary)]/20"
                                >
                                  <Play size={11} fill="currentColor" />
                                  {localizeUi("ui.game.gamesessionhistory.replaySession")}
                                </button>
                              )}
                              {canRegenerateLorebook && lorebookRun && lorebookRun.status !== "failed" && (
                                <span
                                  title={lorebookRun.error}
                                  className="inline-flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]"
                                >
                                  {lorebookRun.status === "success" ? (
                                    <CheckCircle2 size={11} className="text-emerald-500" />
                                  ) : (
                                    <RefreshCw size={11} className="animate-spin" />
                                  )}
                                  {lorebookRun.status === "success"
                                    ? localizeUi("ui.game.gamesessionhistory.lorebookValue1", {
                                        value1: lorebookRun.entryCount ?? 0,
                                      })
                                    : localizeUi("ui.game.gamesessionhistory.lorebookRunning")}
                                </span>
                              )}
                              {canRegenerateLorebook && lorebookRun?.status !== "failed" && (
                                <button
                                  onClick={() => void onRegenerateLorebook?.(session.sessionNumber)}
                                  disabled={isRegeneratingLorebook}
                                  title={localizeUi(
                                    "ui.game.gamesessionhistory.regenerateTheGameLorebookKeeperEntriesForThisLatest",
                                  )}
                                  className="inline-flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <BookOpen
                                    size={11}
                                    className={isRegeneratingLorebook ? "animate-pulse" : undefined}
                                  />
                                  {isRegeneratingLorebook
                                    ? localizeUi("ui.game.gamesessionhistory.regeneratingLorebook")
                                    : localizeUi("ui.game.gamesessionhistory.regenerateLorebook")}
                                </button>
                              )}
                              {onUpdatePlotArcs && (
                                <button
                                  onClick={() => void onUpdatePlotArcs(session.sessionNumber)}
                                  disabled={isUpdatingPlotArcs || isRegenerating}
                                  title={localizeUi("ui.game.gamesessionhistory.updateGamePlotArcsFromThisSession")}
                                  className="inline-flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <GitBranch size={11} className={isUpdatingPlotArcs ? "animate-pulse" : undefined} />
                                  {isUpdatingPlotArcs
                                    ? localizeUi("ui.game.gamesessionhistory.updating")
                                    : localizeUi("ui.game.gamesessionhistory.updatePlotArcs")}
                                </button>
                              )}
                              {onRegenerateSession && (
                                <button
                                  onClick={() => void onRegenerateSession(session.sessionNumber)}
                                  disabled={isRegenerating}
                                  title={localizeUi("ui.game.gamesessionhistory.regenerateThisSessionConclusion")}
                                  className="inline-flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <RefreshCw size={11} className={isRegenerating ? "animate-spin" : undefined} />
                                  {isRegenerating
                                    ? localizeUi("ui.game.gamecharactersheet.regenerating")
                                    : localizeUi("ui.agents.secretplotpanel.regenerate")}
                                </button>
                              )}
                              {onSaveSession && (
                                <button
                                  onClick={() => handleStartEditing(session)}
                                  disabled={isRegenerating}
                                  className="rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {localizeUi("ui.game.gamesessionhistory.editDetails")}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesessionhistory.summary")}
                              </span>
                              <textarea
                                value={draft?.summary ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, summary: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={8}
                                className="min-h-32 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesessionhistory.resumePoint")}
                              </span>
                              <textarea
                                value={draft?.resumePoint ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, resumePoint: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder={localizeUi("ui.game.gamesessionhistory.howTheNextSessionShouldResume")}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesessionhistory.partyDynamics")}
                              </span>
                              <textarea
                                value={draft?.partyDynamics ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, partyDynamics: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesessionhistory.partyState")}
                              </span>
                              <textarea
                                value={draft?.partyState ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, partyState: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={3}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesessionhistory.keyDiscoveries")}
                              </span>
                              <textarea
                                value={draft?.keyDiscoveries ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, keyDiscoveries: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder={localizeUi(
                                  "ui.game.gamesessionhistory.oneContinuityFactPerLineIncludingDiscoveriesTwistsAnd",
                                )}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesessionhistory.characterMoments")}
                              </span>
                              <textarea
                                value={draft?.characterMoments ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, characterMoments: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder={localizeUi("ui.game.gamesessionhistory.oneMomentPerLine")}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesessionhistory.littleDetailsToRecall")}
                              </span>
                              <textarea
                                value={draft?.littleDetails ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, littleDetails: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder={localizeUi(
                                  "ui.game.gamesessionhistory.oneSmallPreferenceHabitPromiseOrPastDetailPer",
                                )}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesessionhistory.npcUpdates")}
                              </span>
                              <textarea
                                value={draft?.npcUpdates ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, npcUpdates: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={4}
                                placeholder={localizeUi("ui.game.gamesessionhistory.oneUpdatePerLine")}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                {localizeUi("ui.game.gamesessionhistory.statsSnapshotJson")}
                              </span>
                              <textarea
                                value={draft?.statsSnapshot ?? ""}
                                onChange={(event) =>
                                  setDraft((prev) => (prev ? { ...prev, statsSnapshot: event.target.value } : prev))
                                }
                                disabled={isSaving}
                                rows={8}
                                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--foreground)]/40"
                              />
                            </label>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={handleCancelEditing}
                                disabled={isSaving}
                                className="rounded-md bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {localizeUi("chat.delete.dialog.cancel")}
                              </button>
                              <button
                                onClick={() => void handleSaveSession(session)}
                                disabled={isSaving || !(draft?.summary ?? "").trim()}
                                className="rounded-md bg-[var(--foreground)]/12 px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--foreground)]/18 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isSaving
                                  ? localizeUi("ui.noodle.stageprofileform.saving")
                                  : localizeUi("ui.game.gamesessionhistory.saveDetails")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <AnimatedText
                              html={session.summary}
                              className="text-sm leading-relaxed text-[var(--foreground)]"
                            />
                            {session.resumePoint && (
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
                                <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                                  {localizeUi("ui.game.gamesessionhistory.resumePoint")}
                                </div>
                                <AnimatedText
                                  html={session.resumePoint}
                                  className="text-xs leading-relaxed text-[var(--foreground)]"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {session.partyDynamics && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <Users size={12} />
                            {localizeUi("ui.game.gamesessionhistory.partyDynamics")}
                          </div>
                          <AnimatedText html={session.partyDynamics} className="text-sm text-[var(--foreground)]" />
                        </div>
                      )}

                      {session.keyDiscoveries.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <Sparkles size={12} />
                            {localizeUi("ui.game.gamesessionhistory.keyDiscoveries")}
                          </div>
                          <ul className="flex flex-col gap-1 pl-4">
                            {session.keyDiscoveries.map((discovery, i) => (
                              <li key={i} className="list-disc text-xs text-[var(--foreground)]">
                                <AnimatedText html={discovery} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {session.characterMoments.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <Users size={12} />
                            {localizeUi("ui.game.gamesessionhistory.characterMoments")}
                          </div>
                          <ul className="flex flex-col gap-1 pl-4">
                            {session.characterMoments.map((moment, i) => (
                              <li key={i} className="list-disc text-xs text-[var(--foreground)]">
                                <AnimatedText html={moment} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {session.littleDetails.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                            <Sparkles size={12} />
                            {localizeUi("ui.game.gamesessionhistory.littleDetailsToRecall")}
                          </div>
                          <ul className="flex flex-col gap-1 pl-4">
                            {session.littleDetails.map((detail, i) => (
                              <li key={i} className="list-disc text-xs text-[var(--foreground)]">
                                <AnimatedText html={detail} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {session.npcUpdates.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesessionhistory.npcUpdates")}
                          </div>
                          <ul className="flex flex-col gap-1 pl-4">
                            {session.npcUpdates.map((update, i) => (
                              <li key={i} className="list-disc text-xs text-[var(--foreground)]">
                                <AnimatedText html={update} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {session.nextSessionRequest && (
                        <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                          <div className="mb-1 text-xs font-medium text-amber-500">
                            {localizeUi("ui.game.gamesessionhistory.nextSessionRequest")}
                          </div>
                          <div className="text-xs leading-relaxed text-[var(--foreground)]">
                            {session.nextSessionRequest}
                          </div>
                        </div>
                      )}

                      {Object.keys(session.statsSnapshot).length > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">
                            {localizeUi("ui.game.gamesessionhistory.statsSnapshot")}
                          </div>
                          <pre className="overflow-x-auto rounded-lg bg-[var(--secondary)] p-3 font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground)] whitespace-pre-wrap break-words">
                            {JSON.stringify(session.statsSnapshot, null, 2)}
                          </pre>
                        </div>
                      )}

                      {session.partyState && (
                        <div className="mt-3 rounded bg-[var(--card)] p-2 text-xs text-[var(--muted-foreground)]">
                          <span className="font-medium">{localizeUi("ui.game.gamesessionhistory.partyStatus")}</span>{" "}
                          <AnimatedText html={session.partyState} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
