import { Copy, Download, Info } from "lucide-react";
import { toast } from "sonner";
import type { GameInitialSetupSnapshot, GameSetupConfig, GenerationParameters } from "@marinara-engine/shared";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import { copyToClipboard } from "../../lib/utils";
import {
  buildGameSetupShareFile,
  buildGameSetupSummarySections,
  formatGameSetupShareText,
  type GameSetupShareLabels,
} from "../../lib/game-setup-share";

export interface GameSetupSummaryProps {
  gameName: string;
  snapshot?: GameInitialSetupSnapshot | null;
  fallbackConfig?: GameSetupConfig | null;
  fallbackEffectiveGenerationParameters?: Partial<GenerationParameters> | null;
  fallbackGmConnectionId?: string | null;
  currentCharacters?: ReadonlyArray<{ id: string; name: string }>;
  currentCharacterMap?: ReadonlyMap<string, { name: string }>;
  currentConnections?: readonly unknown[];
  currentPersonaName?: string | null;
  embedded?: boolean;
}

function formatCreatedAt(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function GameSetupSummary({
  gameName,
  snapshot,
  fallbackConfig,
  fallbackEffectiveGenerationParameters,
  fallbackGmConnectionId,
  currentCharacters,
  currentCharacterMap,
  currentConnections,
  currentPersonaName,
  embedded = false,
}: GameSetupSummaryProps) {
  const config = snapshot?.config ?? fallbackConfig ?? null;

  if (!config) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <Info size={18} className="text-[var(--marinara-chat-chrome-panel-muted)]" />
        <p className="text-sm font-semibold text-[var(--marinara-chat-chrome-panel-text)]">No setup saved</p>
        <p className="max-w-sm text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
          This campaign does not have enough creation data to build a settings summary.
        </p>
      </div>
    );
  }

  const currentCharacterNames: Record<string, string> = {};
  for (const character of currentCharacters ?? []) currentCharacterNames[character.id] = character.name;
  for (const [id, character] of currentCharacterMap ?? []) currentCharacterNames[id] = character.name;

  const currentConnectionNames: Record<string, string> = {};
  for (const connection of currentConnections ?? []) {
    if (!connection || typeof connection !== "object") continue;
    const record = connection as {
      id?: unknown;
      name?: unknown;
      model?: unknown;
      imageService?: unknown;
      videoService?: unknown;
    };
    if (typeof record.id !== "string" || typeof record.name !== "string") continue;
    const details = [record.model, record.imageService, record.videoService].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    currentConnectionNames[record.id] = [record.name.trim(), ...new Set(details.map((value) => value.trim()))].join(
      " · ",
    );
  }

  const labels: GameSetupShareLabels = {
    characterNames: { ...currentCharacterNames, ...snapshot?.labels?.characterNames },
    connectionNames: currentConnectionNames,
    lorebookNames: snapshot?.labels?.lorebookNames,
    promptPresetNames: snapshot?.labels?.promptPresetNames,
    personaName: snapshot?.labels?.personaName ?? currentPersonaName ?? null,
  };
  const source = {
    gameName,
    config,
    effectiveGenerationParameters:
      snapshot?.effectiveGenerationParameters ?? fallbackEffectiveGenerationParameters ?? config.generationParameters,
    preferences: snapshot?.preferences,
    connections: snapshot?.connections,
    fallbackGmConnectionId,
    labels,
    createdAt: snapshot?.createdAt,
  };
  const sections = buildGameSetupSummarySections(source);
  const shareText = formatGameSetupShareText(source);
  const createdAt = formatCreatedAt(snapshot?.createdAt);

  const handleCopy = async () => {
    const copied = await copyToClipboard(shareText);
    if (copied) toast.success("Initial Game Mode setup copied.");
    else toast.error("Could not copy the Game Mode setup.");
  };

  const handleDownload = () => {
    downloadJsonFile(
      buildGameSetupShareFile(source),
      `${sanitizeExportFilenamePart(gameName, "game")}.marinara-game-setup.json`,
    );
    toast.success("Reusable Game Mode setup downloaded.");
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-[var(--marinara-chat-chrome-panel-divider)] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-text)]">
            {snapshot ? "Initial game setup" : "Available setup"}
          </p>
          <p className="mt-0.5 max-w-md text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
            {snapshot
              ? createdAt
                ? `Saved ${createdAt}. Copy a readable summary or download a reusable setup file.`
                : "Saved when this campaign was created. Download it to reuse these settings in a new game."
              : "Reconstructed from the campaign's earliest saved setup."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-3 text-xs font-medium text-[var(--marinara-chat-chrome-button-text)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] sm:flex-none"
          >
            <Copy size={13} />
            Copy setup
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] sm:flex-none"
          >
            <Download size={13} />
            Download setup
          </button>
        </div>
      </div>

      {!snapshot && (
        <div className="m-3 mb-0 flex gap-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 py-2 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            This older campaign predates creation snapshots. Party, model, or parameter values may reflect later
            changes.
          </span>
        </div>
      )}

      <div
        className={
          embedded
            ? "px-3 pb-5"
            : "min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-5 [-webkit-overflow-scrolling:touch]"
        }
      >
        {sections.map((section) => (
          <section
            key={section.title}
            className="border-b border-[var(--marinara-chat-chrome-panel-divider)] py-4 last:border-b-0"
          >
            <h3 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--marinara-chat-chrome-highlight-text)]">
              {section.title}
            </h3>
            <dl className="divide-y divide-[var(--marinara-chat-chrome-panel-divider)]">
              {section.rows.map((row) => (
                <div key={row.label} className="grid gap-1 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-[0.6875rem] font-medium text-[var(--marinara-chat-chrome-panel-muted)]">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
