import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  PenLine,
  Sparkles,
  X,
} from "lucide-react";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { type BudgetSkippedLorebookEntry, useActiveLorebookEntries } from "../../hooks/use-lorebooks";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_CLOSE_ICON_SIZE,
  NEUTRAL_PANEL_SUBTITLE,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import { useTranslation as useUiTranslation } from "react-i18next";
import { MacroTextarea } from "../ui/MacroTextarea";

type LorebookEntryStatus = "normal" | "constant" | "selective";

const LOREBOOK_ENTRY_STATUS_STYLE: Record<
  LorebookEntryStatus,
  { labelKey: string; dot: string; row: string; badge: string }
> = {
  normal: {
    labelKey: "chat.activeContext.status.normal",
    dot: "bg-emerald-400",
    row: "border border-emerald-400/20 bg-emerald-400/10 hover:bg-emerald-400/15",
    badge: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/20",
  },
  constant: {
    labelKey: "chat.activeContext.status.constant",
    dot: "bg-yellow-300",
    row: "border border-yellow-300/25 bg-yellow-300/10 hover:bg-yellow-300/15",
    badge: "bg-yellow-300/15 text-yellow-200 ring-1 ring-yellow-300/20",
  },
  selective: {
    labelKey: "chat.activeContext.status.selective",
    dot: "bg-red-400",
    row: "border border-red-400/25 bg-red-400/10 hover:bg-red-400/15",
    badge: "bg-red-400/15 text-red-200 ring-1 ring-red-400/20",
  },
};

function getLorebookEntryStatus(entry: { constant?: boolean; selective?: boolean }): LorebookEntryStatus {
  if (entry.constant) return "constant";
  if (entry.selective) return "selective";
  return "normal";
}

function parseSemanticScore(matchedKeys: string[]): number | null {
  const semanticKey = matchedKeys.find((key) => key.startsWith("[semantic:"));
  if (!semanticKey) return null;
  const parsed = Number(semanticKey.match(/^\[semantic:([0-9.]+)\]$/)?.[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSemanticScore(score: number | null | undefined) {
  return typeof score === "number" && Number.isFinite(score) ? score.toFixed(3) : null;
}

function formatActivationSource(
  source: "current_location" | "keyword" | "semantic" | "constant" | "sticky" | "recursive",
  t: TFunction,
) {
  return t(`chat.activeContext.source.${source}`);
}

function ActiveLorebookEntryRow({
  entry,
}: {
  entry: {
    name: string;
    keys: string[];
    content: string;
    constant: boolean;
    selective: boolean;
    order: number;
    lorebookId: string;
    lorebookName: string;
    activationSources: Array<"current_location" | "keyword" | "semantic" | "constant" | "sticky" | "recursive">;
    matchedKeys?: string[];
    matchType?: "keyword" | "semantic" | "constant" | "sticky";
    semanticScore?: number;
  };
}) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setExpanded] = useState(false);
  const status = getLorebookEntryStatus(entry);
  const statusStyle = LOREBOOK_ENTRY_STATUS_STYLE[status];
  const matchedKeys = entry.matchedKeys ?? [];
  const semanticScore = entry.semanticScore ?? parseSemanticScore(matchedKeys);
  const semanticScoreLabel = formatSemanticScore(semanticScore);
  const isSemanticMatch = entry.matchType === "semantic" || semanticScore !== null;
  const visibleMatchedKeys = matchedKeys.filter((key) => !key.startsWith("[semantic:"));
  const isCurrentLocation = entry.activationSources.includes("current_location");

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg p-2 text-xs transition-colors",
        isSemanticMatch ? "border border-cyan-300/25 bg-cyan-400/10 hover:bg-cyan-400/15" : statusStyle.row,
      )}
      onClick={() => setExpanded((prev) => !prev)}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isSemanticMatch ? "bg-cyan-300" : statusStyle.dot)} />
        <span className="truncate font-medium text-[var(--foreground)]/80">{entry.name}</span>
        <span className={cn("shrink-0 rounded px-1 py-0.5 text-[0.5rem] font-semibold", statusStyle.badge)}>
          {localizeUi(statusStyle.labelKey)}
        </span>
        {isSemanticMatch && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[0.5rem] font-semibold text-cyan-100 ring-1 ring-cyan-300/25">
            <Sparkles size="0.55rem" />
            {semanticScoreLabel
              ? localizeUi("chat.activeContext.vectorScore", { score: semanticScoreLabel })
              : localizeUi("ui.chat.activelorebookentryrow.vector")}
          </span>
        )}
        {isCurrentLocation && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-sky-400/15 px-1 py-0.5 text-[0.5rem] font-semibold text-sky-200 ring-1 ring-sky-400/25">
            <MapPin size="0.55rem" /> {localizeUi("ui.noodle.noodleprofilesurface.location")}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">#{entry.order}</span>
        <button
          type="button"
          className="min-h-8 shrink-0 rounded px-1.5 text-[0.625rem] text-[var(--muted-foreground)] hover:bg-white/10 hover:text-[var(--foreground)]"
          onClick={(event) => {
            event.stopPropagation();
            useUIStore.getState().openLorebookDetail(entry.lorebookId);
          }}
          aria-label={localizeUi("chat.activeContext.openEntry", {
            entry: entry.name,
            lorebook: entry.lorebookName,
          })}
        >
          {localizeUi("ui.chat.activelorebookentryrow.open")}
        </button>
      </div>
      <p className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
        {entry.lorebookName} ·{" "}
        {entry.activationSources.map((source) => formatActivationSource(source, localizeUi)).join(", ")}
      </p>
      {entry.keys.length > 0 && (
        <p className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.characters.lorebooktab.keys")} {entry.keys.slice(0, 5).join(", ")}
          {entry.keys.length > 5 && ` +${entry.keys.length - 5}`}
        </p>
      )}
      {visibleMatchedKeys.length > 0 && (
        <p className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.activelorebookentryrow.matched")} {visibleMatchedKeys.slice(0, 5).join(", ")}
          {visibleMatchedKeys.length > 5 && ` +${visibleMatchedKeys.length - 5}`}
        </p>
      )}
      {isSemanticMatch && (
        <p className="mt-0.5 truncate text-[0.625rem] text-cyan-100/75">
          {semanticScoreLabel
            ? localizeUi("chat.activeContext.semanticMatchScore", { score: semanticScoreLabel })
            : localizeUi("ui.chat.activelorebookentryrow.semanticVectorMatch")}
        </p>
      )}
      {expanded && (
        <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-[var(--border)] pt-1.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          {entry.content || localizeUi("chat.activeContext.emptyEntry")}
        </p>
      )}
    </div>
  );
}

function formatBudgetName(blockedBy: BudgetSkippedLorebookEntry["blockedBy"], t: TFunction) {
  if (blockedBy === "lorebook") return t("chat.activeContext.budget.lorebook");
  if (blockedBy === "chat") return t("chat.activeContext.budget.chat");
  if (blockedBy === "location") return t("chat.activeContext.budget.location");
  return t("chat.activeContext.budget.both");
}

function formatBudgetCap(entry: BudgetSkippedLorebookEntry, t: TFunction) {
  if (entry.blockedBy === "lorebook") {
    return `${entry.lorebookUsedTokens.toLocaleString()} / ${entry.lorebookBudget.toLocaleString()}`;
  }
  if (entry.blockedBy === "chat") {
    return `${entry.chatUsedTokens.toLocaleString()} / ${entry.chatBudget.toLocaleString()}`;
  }
  if (entry.blockedBy === "location") {
    return t("chat.activeContext.budget.locationUsage", {
      count: entry.chatUsedTokens.toLocaleString(),
    });
  }
  return t("chat.activeContext.budget.combinedUsage", {
    lorebookUsed: entry.lorebookUsedTokens.toLocaleString(),
    lorebookBudget: entry.lorebookBudget.toLocaleString(),
    chatUsed: entry.chatUsedTokens.toLocaleString(),
    chatBudget: entry.chatBudget.toLocaleString(),
  });
}

function BudgetSkippedEntryRow({ entry }: { entry: BudgetSkippedLorebookEntry }) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setExpanded] = useState(false);
  const semanticScore = entry.semanticScore ?? parseSemanticScore(entry.matchedKeys);
  const semanticScoreLabel = formatSemanticScore(semanticScore);
  const isSemanticMatch = entry.matchType === "semantic" || semanticScore !== null;

  return (
    <button
      type="button"
      className="w-full rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-left text-xs transition-colors hover:bg-amber-500/15"
      onClick={() => setExpanded((prev) => !prev)}
    >
      <div className="flex items-center gap-1.5">
        {expanded ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
        <span className="min-w-0 flex-1 truncate font-medium text-amber-200">{entry.name}</span>
        {isSemanticMatch && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[0.5rem] font-semibold text-cyan-100 ring-1 ring-cyan-300/25">
            <Sparkles size="0.55rem" />
            {semanticScoreLabel
              ? localizeUi("chat.activeContext.vectorScore", { score: semanticScoreLabel })
              : localizeUi("ui.chat.activelorebookentryrow.vector")}
          </span>
        )}
        <span className="shrink-0 text-[0.625rem] text-amber-200/70">~{entry.estimatedTokens.toLocaleString()}</span>
      </div>
      <p className="mt-0.5 truncate pl-5 text-[0.625rem] text-amber-100/70">
        {entry.lorebookName} {localizeUi("ui.chat.budgetskippedentryrow.blockedBy")}{" "}
        {formatBudgetName(entry.blockedBy, localizeUi)}
      </p>
      <p className="mt-0.5 truncate pl-5 text-[0.625rem] text-amber-100/60">
        {localizeUi("ui.chat.budgetskippedentryrow.sources")}{" "}
        {entry.activationSources.map((source) => formatActivationSource(source, localizeUi)).join(", ")}
      </p>
      {expanded && (
        <div className="mt-1.5 space-y-1 border-t border-amber-500/20 pt-1.5 pl-5 text-[0.625rem] leading-relaxed text-amber-50/75">
          <p>
            {localizeUi("ui.chat.activelorebookentryrow.matched")}{" "}
            {entry.matchedKeys.length > 0
              ? entry.matchedKeys.slice(0, 5).join(", ")
              : localizeUi("ui.chat.budgetskippedentryrow.noKeyRecorded")}
          </p>
          {isSemanticMatch && (
            <p>
              {localizeUi("ui.chat.budgetskippedentryrow.semanticVectorScore")}{" "}
              {semanticScoreLabel ?? localizeUi("chat.activeContext.matched")}
            </p>
          )}
          <p>
            {localizeUi("ui.chat.budgetskippedentryrow.entryEstimate")}
            {entry.estimatedTokens.toLocaleString()} {localizeUi("ui.agents.agenteditor.tokens")}
          </p>
          <p>
            {localizeUi("ui.chat.budgetskippedentryrow.budgetUsedBeforeEntry")} {formatBudgetCap(entry, localizeUi)}
          </p>
        </div>
      )}
    </button>
  );
}

function BudgetSkippedEntriesNotice({ entries }: { entries: BudgetSkippedLorebookEntry[] }) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;

  return (
    <div className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-50/85">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <AlertTriangle size="0.875rem" className="mt-0.5 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-amber-100">
            {localizeUi("chat.activeContext.skippedEntries", { count: entries.length })}
          </span>
          <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-amber-50/65">
            {localizeUi("ui.chat.budgetskippedentriesnotice.expandForBudgetDetailsKnowledgeRetrievalOrKnowledgeRouter")}
          </span>
        </span>
        {expanded ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {entries.map((entry) => (
            <BudgetSkippedEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ActiveLorebookEntriesContent({ chatId }: { chatId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const { data, isLoading } = useActiveLorebookEntries(chatId, true);
  const entries = data?.entries ?? [];
  const skippedEntries = data?.budgetSkippedEntries ?? [];
  const currentLocationEntries = entries.filter((entry) => entry.activationSources.includes("current_location"));
  const otherEntries = entries.filter((entry) => !entry.activationSources.includes("current_location"));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]">
        <Loader2 size="0.75rem" className="animate-spin" />
        {localizeUi("ui.chat.activelorebookentriescontent.scanningEntries")}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <>
        <BudgetSkippedEntriesNotice entries={skippedEntries} />
        <p className="py-3 text-center text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.activelorebookentriescontent.noActiveEntriesForThisChat")}
        </p>
      </>
    );
  }

  return (
    <>
      <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
        {localizeUi("chat.activeContext.activeEntries", {
          count: entries.length,
          tokens: (data?.totalTokens ?? 0).toLocaleString(),
        })}
      </p>
      <BudgetSkippedEntriesNotice entries={skippedEntries} />
      {currentLocationEntries.length > 0 && (
        <section aria-label={localizeUi("ui.chat.activelorebookentriescontent.currentLocationLore")}>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-sky-200">
            <MapPin size="0.6875rem" /> {localizeUi("ui.chat.activelorebookentriescontent.currentLocation")}
          </h4>
          <div className="space-y-1.5">
            {currentLocationEntries.map((entry) => (
              <ActiveLorebookEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
      {otherEntries.length > 0 && (
        <section
          className={cn(currentLocationEntries.length > 0 && "mt-3")}
          aria-label={localizeUi("ui.chat.activelorebookentriescontent.otherActiveLore")}
        >
          {currentLocationEntries.length > 0 && (
            <h4 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.activelorebookentriescontent.otherActiveLore")}
            </h4>
          )}
          <div className="space-y-1.5">
            {otherEntries.map((entry) => (
              <ActiveLorebookEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function ActiveLorebookEntriesPanel({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      <h3 className={cn(NEUTRAL_PANEL_TITLE, "mb-2")}>
        <BookOpen size="0.75rem" />
        {localizeUi("ui.chat.activelorebookentriespanel.activeContext")}
        <button
          type="button"
          onClick={onClose}
          aria-label={localizeUi("ui.chat.activelorebookentriespanel.closeActiveContext")}
          className={cn(NEUTRAL_PANEL_CLOSE_BUTTON, "ml-auto -my-1")}
        >
          <X size={NEUTRAL_PANEL_CLOSE_ICON_SIZE} />
        </button>
      </h3>
      <ActiveLorebookEntriesContent chatId={chatId} />
    </>
  );
}

export function AuthorNotesPanel({
  chatId,
  chatMeta,
  onClose,
}: {
  chatId: string;
  chatMeta: Record<string, any>;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [notes, setNotes] = useState((chatMeta.authorNotes as string) ?? "");
  const [depthStr, setDepthStr] = useState(String((chatMeta.authorNotesDepth as number) ?? 4));
  const updateMeta = useUpdateChatMetadata();

  const initialBaseline = {
    notes: (chatMeta.authorNotes as string) ?? "",
    depth: (chatMeta.authorNotesDepth as number) ?? 4,
  };
  const latestByChatRef = useRef(new Map<string, { notes: string; depthStr: string }>([[chatId, { notes, depthStr }]]));
  latestByChatRef.current.set(chatId, { notes, depthStr });
  const baselineByChatRef = useRef(new Map<string, { notes: string; depth: number }>([[chatId, initialBaseline]]));
  const mutateRef = useRef(updateMeta.mutate);
  mutateRef.current = updateMeta.mutate;

  useEffect(() => {
    const nextBaseline = {
      notes: (chatMeta.authorNotes as string) ?? "",
      depth: (chatMeta.authorNotesDepth as number) ?? 4,
    };
    setNotes(nextBaseline.notes);
    setDepthStr(String(nextBaseline.depth));
    baselineByChatRef.current.set(chatId, nextBaseline);
    latestByChatRef.current.set(chatId, { notes: nextBaseline.notes, depthStr: String(nextBaseline.depth) });
  }, [chatId, chatMeta.authorNotes, chatMeta.authorNotesDepth]);

  // Outside-click closes the popover via mousedown, which unmounts the
  // textarea before its onBlur (the only save trigger) can fire. Flush
  // the pending edit from the unmount cleanup so typed content survives.
  useEffect(() => {
    const capturedChatId = chatId;
    const latestByChat = latestByChatRef.current;
    const baselineByChat = baselineByChatRef.current;
    const snapshot = latestByChat.get(capturedChatId) ?? { notes: "", depthStr: "4" };
    const baselineSnapshot = baselineByChat.get(capturedChatId) ?? { notes: "", depth: 4 };
    return () => {
      const { notes: n, depthStr: d } = latestByChat.get(capturedChatId) ?? snapshot;
      const nextDepth = Math.max(0, parseInt(d, 10) || 0);
      const base = baselineByChat.get(capturedChatId) ?? baselineSnapshot;
      if (n !== base.notes || nextDepth !== base.depth) {
        mutateRef.current({ id: capturedChatId, authorNotes: n, authorNotesDepth: nextDepth });
      }
      latestByChat.delete(capturedChatId);
      baselineByChat.delete(capturedChatId);
    };
  }, [chatId]);

  const depth = parseInt(depthStr, 10) || 0;
  const handleSave = () => {
    updateMeta.mutate({ id: chatId, authorNotes: notes, authorNotesDepth: depth });
  };

  return (
    <>
      <h3 className={cn(NEUTRAL_PANEL_TITLE, "mb-2")}>
        <PenLine size="0.75rem" />
        {localizeUi("ui.chat.authornotespanel.authorSNotes")}
        <button
          type="button"
          onClick={onClose}
          aria-label={localizeUi("ui.chat.authornotespanel.closeAuthorSNotes")}
          className={cn(NEUTRAL_PANEL_CLOSE_BUTTON, "ml-auto -my-1")}
        >
          <X size={NEUTRAL_PANEL_CLOSE_ICON_SIZE} />
        </button>
      </h3>
      <p className={cn(NEUTRAL_PANEL_SUBTITLE, "mb-2")}>
        {localizeUi("ui.chat.authornotespanel.textHereIsInjectedIntoThePromptAtThe")}
      </p>
      <MacroTextarea
        value={notes}
        onChange={setNotes}
        onBlur={handleSave}
        onExpandedClose={handleSave}
        title={localizeUi("ui.chat.authornotespanel.authorSNotes")}
        placeholder={localizeUi("ui.chat.authornotespanel.eGKeepTheToneDarkAndSuspensefulThe")}
        rows={4}
        ariaLabel={localizeUi("ui.chat.authornotespanel.authorSNotes")}
        wrapperClassName="mari-author-notes-field"
        className="resize-none px-2.5 py-2 text-xs leading-relaxed"
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.authornotespanel.injectionDepth")}
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={depthStr}
          onChange={(e) => setDepthStr(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => {
            const nextDepth = Math.max(0, parseInt(depthStr, 10) || 0);
            setDepthStr(String(nextDepth));
            updateMeta.mutate({ id: chatId, authorNotes: notes, authorNotesDepth: nextDepth });
          }}
          className="w-14 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-center text-[0.625rem] text-[var(--foreground)] outline-none transition-colors [appearance:textfield] focus:ring-2 focus:ring-[var(--ring)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/60">
        {localizeUi("ui.chat.authornotespanel.depth0AfterTheLatestMessage4FourMessages")}
      </p>
    </>
  );
}
