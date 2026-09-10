import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Ban,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Download,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  MessageSquare,
  Square,
  Trash2,
  TriangleAlert,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import {
  useClearEngineTaskHistory,
  useEngineTasks,
  useStopEngineTask,
  type EngineTask,
  type FinishedTask,
  type MissionStage,
  type MissionStageState,
  type TaskKind,
  type TaskOutcome,
  type TaskStepSnapshot,
  type TaskStepState,
} from "../../hooks/use-tasks";
import { useToastHistory } from "../../hooks/use-toast-history";
import { mergeRecentActivity, type RecentActivity } from "../../lib/activity-history";
import { formatBytes } from "../../lib/format-bytes";
import type { ToastHistoryKind } from "../../lib/toast-history";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import {
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_SUBTITLE,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";

const KIND_ICON: Record<TaskKind, LucideIcon> = {
  generation: MessageSquare,
  agents: Bot,
  media: ImageIcon,
  transfer: Download,
  maintenance: Wrench,
};

const OUTCOME_ICON: Record<TaskOutcome, LucideIcon> = { completed: Check, failed: XCircle, aborted: Ban };
const OUTCOME_CLASS: Record<TaskOutcome, string> = {
  completed: "text-[var(--primary)]",
  failed: "text-[var(--destructive)]",
  aborted: "text-[var(--muted-foreground)]",
};
const TOAST_ICON: Record<ToastHistoryKind, LucideIcon> = {
  default: Bell,
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: XCircle,
  loading: LoaderCircle,
};

const TASK_LABEL_KEY: Record<string, string> = {
  "Generating reply": "tasks.activity.generatingReply",
  "Generating autonomous reply": "tasks.activity.generatingAutonomousReply",
  "Running agents": "tasks.activity.runningAgents",
  "Running pre-generation agents": "tasks.activity.runningPreGenerationAgents",
  "Running post-generation agents": "tasks.activity.runningPostGenerationAgents",
  "Preparing lorebook context": "tasks.activity.preparingLorebookContext",
  "Retrieving memory": "tasks.activity.retrievingMemory",
  "Assembling prompt": "tasks.activity.assemblingPrompt",
  "Generating image": "tasks.activity.generatingImage",
  "Generating video": "tasks.activity.generatingVideo",
  "Generating music": "tasks.activity.generatingMusic",
  "Generating sound effect": "tasks.activity.generatingSoundEffect",
  "Media generation": "tasks.activity.generatingMedia",
  "Importing from SillyTavern": "tasks.activity.importingSillyTavern",
  "Importing profile": "tasks.activity.importingProfile",
  "Updating Marinara Engine": "tasks.activity.updatingEngine",
  "Generating daily schedule": "tasks.activity.generatingDailySchedule",
  "Generating weekly schedule": "tasks.activity.generatingWeeklySchedule",
  "Summarizing schedule": "tasks.activity.summarizingSchedule",
  "Summarizing conversation": "tasks.activity.summarizingConversation",
  "Backfilling lorebook": "tasks.activity.backfillingLorebook",
  "Professor Mari is working": "tasks.activity.professorMariWorking",
  "Creating automatic backup": "tasks.activity.creatingAutomaticBackup",
  "Creating backup": "tasks.activity.creatingBackup",
  "Preparing backup download": "tasks.activity.preparingBackupDownload",
  "Installing package": "tasks.activity.installingPackage",
  "Agent work": "tasks.activity.agentWork",
};

const TASK_PHASE_KEY: Record<string, string> = {
  generating: "tasks.phase.generating",
  preparing: "tasks.phase.preparing",
  agents: "tasks.phase.agents",
  pre_generation: "tasks.phase.preGeneration",
  parallel: "tasks.phase.parallel",
  post_processing: "tasks.phase.postGeneration",
  queued: "tasks.phase.queued",
  running: "tasks.phase.running",
  downloading: "tasks.phase.downloading",
  importing: "tasks.phase.importing",
  applying: "tasks.phase.applying",
  generating_schedule: "tasks.phase.generatingSchedule",
  summarizing_schedule: "tasks.phase.summarizingSchedule",
  generating_audio: "tasks.phase.generatingAudio",
  backing_up: "tasks.phase.backingUp",
  installing: "tasks.phase.installing",
  workspace: "tasks.phase.workspace",
  lorebooks: "tasks.phase.lorebooks",
  embedding: "tasks.phase.embedding",
  assembling: "tasks.phase.assembling",
};

const STAGES: MissionStage[] = ["before", "reply", "after"];
const CHILD_PRIORITY: Record<TaskStepState, number> = {
  running: 0,
  queued: 1,
  failed: 2,
  aborted: 3,
  completed: 4,
  skipped: 5,
};
const RECENT_DECORATIVE_OPACITY = ["opacity-100", "opacity-90", "opacity-80", "opacity-70", "opacity-60"];
const EMPTY_TASKS: EngineTask[] = [];
const EMPTY_TASK_HISTORY: FinishedTask[] = [];

function localTaskLabel(label: string, t: (key: string, options?: Record<string, unknown>) => string) {
  const key = TASK_LABEL_KEY[label];
  return key ? t(key) : label;
}

function formatDuration(ms: number, t: (key: string, options?: Record<string, unknown>) => string) {
  const seconds = Math.max(0, Math.round(ms / 1_000));
  if (seconds < 60) return t("tasks.durationSeconds", { count: seconds });
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds
    ? t("tasks.durationMinutesSeconds", { minutes, seconds: remainingSeconds })
    : t("tasks.durationMinutes", { count: minutes });
}

function progressText(
  progress: EngineTask["progress"] | TaskStepSnapshot["progress"],
  kind: TaskKind,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (!progress) return null;
  if (progress.total) {
    const current = progress.unit === "bytes" ? formatBytes(progress.current) : progress.current;
    const total = progress.unit === "bytes" ? formatBytes(progress.total) : progress.total;
    return t("tasks.progressOf", { current, total });
  }
  if (progress.unit === "bytes") return formatBytes(progress.current);
  return t(kind === "agents" ? "tasks.charactersReceived" : "tasks.itemsProcessed", { count: progress.current });
}

function openTaskChat(chatId: string) {
  useUIStore.getState().closeAllDetails();
  useChatStore.getState().setActiveChatId(chatId);
}

function StateGlyph({ state }: { state: TaskStepState | MissionStageState }) {
  if (state === "running") return <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" size={12} />;
  if (state === "completed") return <Check aria-hidden="true" size={12} />;
  if (state === "failed") return <XCircle aria-hidden="true" size={12} />;
  if (state === "aborted" || state === "skipped") return <Ban aria-hidden="true" size={11} />;
  if (state === "queued") return <Clock3 aria-hidden="true" size={11} />;
  return <Circle aria-hidden="true" size={9} />;
}

function StagePath({ stages }: { stages: NonNullable<EngineTask["stages"]> }) {
  const { t } = useTranslation();
  return (
    <ol
      aria-label={t("tasks.stageProgress")}
      className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-[color-mix(in_srgb,var(--secondary)_60%,transparent)] p-1"
    >
      {STAGES.map((stage) => {
        const state = stages[stage] ?? "pending";
        return (
          <li
            key={stage}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[0.625rem] font-semibold",
              state === "running" && "bg-[var(--card)] text-[var(--primary)] shadow-sm",
              state === "completed" && "text-[var(--foreground)]",
              (state === "failed" || state === "aborted") && "text-[var(--destructive)]",
              (state === "pending" || state === "skipped") && "text-[var(--muted-foreground)] opacity-65",
            )}
          >
            <StateGlyph state={state} />
            <span className="truncate">{t(`tasks.stage.${stage}`)}</span>
            <span className="sr-only">{t(`tasks.stepState.${state}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ChildStep({ step, kind }: { step: TaskStepSnapshot; kind: TaskKind }) {
  const { t } = useTranslation();
  const label = localTaskLabel(step.label, t);
  const progress = progressText(step.progress, kind, t);
  const meta = [step.detail && TASK_PHASE_KEY[step.detail] ? t(TASK_PHASE_KEY[step.detail]!) : step.detail, progress]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="relative flex min-h-9 items-center gap-2 py-1 pl-5 pr-1 before:absolute before:left-0 before:top-1/2 before:h-px before:w-3 before:bg-[var(--border)]">
      <span
        className={cn(
          "absolute left-[-0.3125rem] flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[var(--card)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]",
          step.state === "running" && "text-[var(--primary)] ring-[var(--primary)]",
          step.state === "failed" && "text-[var(--destructive)] ring-[var(--destructive)]",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words text-[0.75rem] font-medium text-[var(--foreground)]">{label}</span>
        {meta && (
          <span className="line-clamp-2 break-words text-[0.6875rem] text-[var(--muted-foreground)]">{meta}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
        <StateGlyph state={step.state} />
        {t(`tasks.stepState.${step.state}`)}
      </span>
    </li>
  );
}

function MissionRow({ task, now, onNavigate }: { task: EngineTask; now: number; onNavigate: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const stopTask = useStopEngineTask();
  const [expanded, setExpanded] = useState(false);
  const Icon = KIND_ICON[task.kind] ?? Activity;
  const title = localTaskLabel(task.label, t);
  const phase = task.phase ? t(TASK_PHASE_KEY[task.phase] ?? task.phase) : null;
  const progress = progressText(task.progress, task.kind, t);
  const meta = [task.detail, phase, progress].filter(Boolean).join(" · ");
  const children = useMemo(
    () => [...task.children].sort((a, b) => CHILD_PRIORITY[a.state] - CHILD_PRIORITY[b.state]),
    [task.children],
  );
  const visibleChildren = expanded ? children : children.slice(0, 3);
  const stopping = task.state === "stopping" || (stopTask.isPending && stopTask.variables === task.id);
  const total = task.progress?.total;
  const percent = total && total > 0 ? Math.min(100, Math.round(((task.progress?.current ?? 0) / total) * 100)) : null;

  return (
    <article className="rounded-xl bg-[color-mix(in_srgb,var(--secondary)_48%,transparent)] p-3 ring-1 ring-inset ring-[color-mix(in_srgb,var(--border)_72%,transparent)]">
      <div className="flex items-start gap-2.5">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--primary)] shadow-sm ring-1 ring-inset ring-[var(--border)]">
          <Icon aria-hidden="true" size={16} />
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--card)]",
              stopping ? "bg-[var(--muted-foreground)]" : "bg-[var(--primary)] motion-safe:animate-pulse",
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            {task.chatId ? (
              <button
                type="button"
                onClick={() => {
                  openTaskChat(task.chatId!);
                  onNavigate();
                }}
                className="line-clamp-2 min-w-0 flex-1 break-words rounded text-left text-sm font-semibold text-[var(--foreground)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                {title}
              </button>
            ) : (
              <h4 className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-semibold text-[var(--foreground)]">
                {title}
              </h4>
            )}
            <span className="shrink-0 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              {t(`tasks.kind.${task.kind}`)}
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 gap-2 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
            <span className="line-clamp-2 min-w-0 flex-1 break-words">
              {stopping ? t("tasks.stoppingSafely") : meta}
            </span>
            <span className="shrink-0 tabular-nums">{formatDuration(now - task.startedAt, t)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => stopTask.mutate(task.id)}
          disabled={stopping}
          aria-label={t("tasks.stopTask", { task: title })}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[0.6875rem] font-semibold text-[var(--muted-foreground)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-wait disabled:opacity-60"
        >
          {stopping ? (
            <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" size={13} />
          ) : (
            <Square aria-hidden="true" size={11} />
          )}
          <span className="max-sm:sr-only">{stopping ? t("tasks.stopping") : t("tasks.stop")}</span>
        </button>
      </div>

      {task.stages && <StagePath stages={task.stages} />}

      {task.progress && (
        <div className="mt-3">
          <div
            role="progressbar"
            {...(percent !== null ? { "aria-valuenow": percent } : {})}
            aria-valuemin={0}
            {...(percent !== null ? { "aria-valuemax": 100 } : {})}
            aria-valuetext={progress ?? undefined}
            aria-label={title}
            className="h-1 overflow-hidden rounded-full bg-[var(--secondary)]"
          >
            <span
              className={cn(
                "block h-full rounded-full bg-[var(--primary)] transition-[width] duration-200 motion-reduce:transition-none",
                percent === null && "w-1/3 motion-safe:animate-pulse",
              )}
              {...(percent !== null ? { style: { width: `${percent}%` } } : {})}
            />
          </div>
          <p className="mt-1 text-right text-[0.625rem] tabular-nums text-[var(--muted-foreground)]">
            {percent !== null ? localizeUi("ui.layout.missionrow.value1", { value1: percent }) : progress}
          </p>
        </div>
      )}

      {children.length > 0 && (
        <div className="ml-4 mt-2 border-l border-[var(--border)]">
          <ol>
            {visibleChildren.map((step) => (
              <ChildStep key={step.id} step={step} kind={task.kind} />
            ))}
          </ol>
          {children.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="ml-3 flex min-h-9 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-semibold text-[var(--primary)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {expanded ? t("tasks.showLess") : t("tasks.showMore", { count: children.length - 3 })}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "transition-transform duration-200 motion-reduce:transition-none",
                  expanded && "rotate-180",
                )}
                size={13}
              />
            </button>
          )}
        </div>
      )}

      <p className="mt-2 text-[0.625rem] text-[var(--muted-foreground)]">
        {task.stopMode === "immediate" ? t("tasks.stopHintImmediate") : t("tasks.stopHintSafe")}
      </p>
    </article>
  );
}

function RecentRow({
  activity,
  index,
  now,
  onNavigate,
}: {
  activity: RecentActivity;
  index: number;
  now: number;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const opacity = RECENT_DECORATIVE_OPACITY[index] ?? "opacity-60";
  if (activity.source === "toast") {
    const { toast } = activity;
    const Icon = TOAST_ICON[toast.kind] ?? Bell;
    return (
      <li className="flex min-h-11 items-center gap-2.5 px-1 py-1.5">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)]",
            toast.kind === "error" && "text-[var(--destructive)]",
            opacity,
          )}
        >
          <Icon aria-hidden="true" className={cn(toast.kind === "loading" && "motion-safe:animate-spin")} size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-[var(--foreground)]">{toast.title}</span>
          <span className="block truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {[toast.description, t(`tasks.notification.${toast.kind}`)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={cn("shrink-0 text-[0.625rem] tabular-nums text-[var(--muted-foreground)]", opacity)}>
          {t("tasks.ago", { duration: formatDuration(now - activity.occurredAt, t) })}
        </span>
      </li>
    );
  }
  const { task } = activity;
  const Icon = OUTCOME_ICON[task.outcome];
  const content = (
    <>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)]",
          OUTCOME_CLASS[task.outcome],
          opacity,
        )}
      >
        <Icon aria-hidden="true" size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-[var(--foreground)]">
          {localTaskLabel(task.label, t)}
        </span>
        <span className="block truncate text-[0.6875rem] text-[var(--muted-foreground)]">
          {[task.detail, t(`tasks.outcome.${task.outcome}`), formatDuration(task.endedAt - task.startedAt, t)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className={cn("shrink-0 text-[0.625rem] tabular-nums text-[var(--muted-foreground)]", opacity)}>
        {t("tasks.ago", { duration: formatDuration(now - activity.occurredAt, t) })}
      </span>
    </>
  );
  return task.chatId ? (
    <li>
      <button
        type="button"
        onClick={() => {
          openTaskChat(task.chatId!);
          onNavigate();
        }}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {content}
      </button>
    </li>
  ) : (
    <li className="flex min-h-11 items-center gap-2.5 px-1 py-1.5">{content}</li>
  );
}

export function EngineTasksMenu() {
  const { t } = useTranslation();
  const { data } = useEngineTasks();
  const clearServerHistory = useClearEngineTaskHistory();
  const { history: toastHistory, clear: clearToastHistory } = useToastHistory();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const focusPanelOnOpenRef = useRef(false);
  const titleId = useId();
  const panelId = useId();
  const tasks = data?.tasks ?? EMPTY_TASKS;
  const taskHistory = data?.history ?? EMPTY_TASK_HISTORY;
  const recent = useMemo(() => mergeRecentActivity(taskHistory, toastHistory), [taskHistory, toastHistory]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !triggerRef.current?.contains(target) && !panelRef.current?.contains(target))
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open && focusPanelOnOpenRef.current) {
      focusPanelOnOpenRef.current = false;
      panelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const clearRecent = () => {
    clearToastHistory();
    clearServerHistory.mutate();
  };
  const panel = open ? (
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(
        NEUTRAL_PANEL_SHELL,
        "fixed inset-x-2 top-[calc(env(safe-area-inset-top)+3rem)] z-[2147482000] flex max-h-[min(40rem,calc(100svh-4rem))] flex-col overflow-hidden p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:left-auto sm:right-2 sm:w-[26rem]",
      )}
    >
      <header className={cn(NEUTRAL_PANEL_HEADER, "py-3.5")}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)] text-[var(--primary)] ring-1 ring-inset ring-[var(--border)]">
            <Activity aria-hidden="true" size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <h2 id={titleId} className={NEUTRAL_PANEL_TITLE}>
              {t("tasks.missionControl")}
            </h2>
            <p className={NEUTRAL_PANEL_SUBTITLE}>
              {tasks.length ? t("tasks.missionsInMotion", { count: tasks.length }) : t("tasks.idle")}
            </p>
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 w-2.5 rounded-full ring-2 ring-[var(--card)]",
              tasks.length
                ? "bg-[var(--primary)] motion-safe:animate-pulse"
                : "bg-[var(--muted-foreground)] opacity-40",
            )}
          />
        </div>
      </header>
      <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-h-0 flex-1 overflow-y-auto px-3 py-3 overscroll-contain")}>
        {tasks.length > 0 && (
          <section aria-labelledby={`${titleId}-active`}>
            <h3
              id={`${titleId}-active`}
              className="px-1 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]"
            >
              {t("tasks.activeMissions")}
            </h3>
            <div className="space-y-2">
              {tasks.map((task) => (
                <MissionRow key={task.id} task={task} now={now} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          </section>
        )}
        {recent.length > 0 && (
          <section
            aria-labelledby={`${titleId}-recent`}
            className={cn(tasks.length > 0 && "mt-4 border-t border-[var(--border)] pt-3")}
          >
            <div className="flex items-center justify-between px-1 pb-1">
              <h3
                id={`${titleId}-recent`}
                className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]"
              >
                {t("tasks.justHappened")}
              </h3>
              <button
                type="button"
                onClick={clearRecent}
                disabled={clearServerHistory.isPending}
                className="flex min-h-9 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-semibold text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" size={12} />
                {t("tasks.clear")}
              </button>
            </div>
            <ol>
              {recent.map((activity, index) => (
                <RecentRow
                  key={
                    activity.source === "task"
                      ? `task:${activity.task.id}:${activity.occurredAt}`
                      : `toast:${activity.toast.id}`
                  }
                  activity={activity}
                  index={index}
                  now={now}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ol>
          </section>
        )}
        {tasks.length === 0 && recent.length === 0 && (
          <div className="flex min-h-32 flex-col items-center justify-center px-8 py-6 text-center">
            <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
              <Activity aria-hidden="true" size={17} />
            </span>
            <p className="text-sm font-semibold text-[var(--foreground)]">{t("tasks.emptyTitle")}</p>
            <p className="mt-1 max-w-56 text-xs leading-5 text-[var(--muted-foreground)]">
              {t("tasks.emptyDescription")}
            </p>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const next = !open;
          focusPanelOnOpenRef.current = next;
          setOpen(next);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        aria-label={tasks.length ? t("tasks.openMenu", { count: tasks.length }) : t("tasks.menuLabel")}
        title={t("tasks.missionControl")}
        className={cn(
          "mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-[background-color,color,transform] duration-150 active:scale-95 max-sm:h-7 max-sm:w-7",
          open
            ? "bg-[var(--accent)] text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        )}
      >
        <Activity aria-hidden="true" size={15} />
        {tasks.length > 0 && (
          <span
            role="status"
            aria-live="polite"
            className="absolute -right-0.5 -top-0.5 min-w-3.5 rounded-full bg-[var(--primary)] px-1 text-center text-[0.5625rem] font-bold leading-3.5 text-[var(--primary-foreground)]"
          >
            {Math.min(tasks.length, 99)}
          </span>
        )}
      </button>
      {typeof document === "undefined" ? null : createPortal(panel, document.body)}
    </>
  );
}
