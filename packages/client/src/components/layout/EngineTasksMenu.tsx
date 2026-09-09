import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Ban,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  MessageSquare,
  Square,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useAbortEngineTask,
  useEngineTasks,
  type EngineTask,
  type FinishedTask,
  type TaskKind,
  type TaskOutcome,
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
};

const OUTCOME_ICON: Record<TaskOutcome, LucideIcon> = {
  completed: Check,
  failed: XCircle,
  aborted: Ban,
};

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

const TOAST_CLASS: Record<ToastHistoryKind, string> = {
  default: "text-[var(--muted-foreground)]",
  success: "text-[var(--primary)]",
  info: "text-[var(--primary)]",
  warning: "text-[var(--primary)]",
  error: "text-[var(--destructive)]",
  loading: "text-[var(--primary)]",
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
  "Updating Marinara Engine": "tasks.activity.updatingEngine",
  "Generating daily schedule": "tasks.activity.generatingDailySchedule",
  "Generating weekly schedule": "tasks.activity.generatingWeeklySchedule",
  "Summarizing schedule": "tasks.activity.summarizingSchedule",
  "Backfilling lorebook": "tasks.activity.backfillingLorebook",
  "Professor Mari is working": "tasks.activity.professorMariWorking",
  "Creating automatic backup": "tasks.activity.creatingAutomaticBackup",
  "Preparing backup download": "tasks.activity.preparingBackupDownload",
  "Installing package": "tasks.activity.installingPackage",
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

const RECENT_DECORATIVE_OPACITY = ["opacity-100", "opacity-90", "opacity-80", "opacity-70", "opacity-60"];
const EMPTY_TASKS: EngineTask[] = [];
const EMPTY_TASK_HISTORY: FinishedTask[] = [];

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function openTaskChat(chatId: string) {
  useUIStore.getState().closeAllDetails();
  useChatStore.getState().setActiveChatId(chatId);
}

function TaskRow({ task, now, onNavigate }: { task: EngineTask; now: number; onNavigate: () => void }) {
  const { t } = useTranslation();
  const abortTask = useAbortEngineTask();
  const Icon = KIND_ICON[task.kind] ?? Activity;
  const titleKey = TASK_LABEL_KEY[task.label];
  const title = titleKey ? t(titleKey) : task.label;
  const phaseKey = task.phase ? TASK_PHASE_KEY[task.phase] : undefined;
  const phase = phaseKey ? t(phaseKey) : task.phase;
  const total = task.progress?.total;
  const percent = total && total > 0 ? Math.min(100, Math.round(((task.progress?.current ?? 0) / total) * 100)) : null;
  const progressText = task.progress
    ? total
      ? task.progress.unit === "bytes"
        ? t("tasks.progressOf", { current: formatBytes(task.progress.current), total: formatBytes(total) })
        : t("tasks.progressOf", { current: task.progress.current, total })
      : task.progress.unit === "bytes"
        ? formatBytes(task.progress.current)
        : task.kind === "agents"
          ? t("tasks.charactersReceived", { count: task.progress.current })
          : t("tasks.itemsProcessed", { count: task.progress.current })
    : null;
  const subtitle = [task.detail, phase, progressText].filter(Boolean).join(" · ");
  const stopping = abortTask.isPending && abortTask.variables === task.id;

  const summary = (
    <>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--foreground)]">{title}</span>
        <span className="shrink-0 text-[0.625rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          {t(`tasks.kind.${task.kind}`)}
        </span>
      </span>
      <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
        {subtitle && <span className="min-w-0 flex-1 truncate">{subtitle}</span>}
        <span className={cn("shrink-0 tabular-nums", !subtitle && "ml-auto")}>
          {formatDuration(now - task.startedAt)}
        </span>
      </span>
      {percent !== null && (
        <span
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={progressText ?? undefined}
          aria-label={title}
          className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-[var(--secondary)]"
        >
          <span
            className="block h-full rounded-full bg-[var(--primary)] transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </span>
      )}
    </>
  );

  return (
    <div className="group flex min-h-14 w-full items-center gap-2.5 rounded-lg bg-[color-mix(in_srgb,var(--secondary)_56%,transparent)] px-2.5 py-2 text-left ring-1 ring-inset ring-[color-mix(in_srgb,var(--border)_65%,transparent)]">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--card)] text-[var(--primary)] shadow-sm ring-1 ring-inset ring-[var(--border)]">
        <Icon aria-hidden="true" size={15} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--primary)] ring-2 ring-[var(--card)] motion-safe:animate-pulse" />
      </span>
      {task.chatId ? (
        <button
          type="button"
          onClick={() => {
            openTaskChat(task.chatId as string);
            onNavigate();
          }}
          title={t("tasks.openChat")}
          className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {summary}
        </button>
      ) : (
        <span className="min-w-0 flex-1">{summary}</span>
      )}
      {task.cancellable && (
        <button
          type="button"
          onClick={() => abortTask.mutate(task.id)}
          disabled={stopping}
          aria-label={t("tasks.stopTask", { task: title })}
          title={t("tasks.stop")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-wait disabled:opacity-50"
        >
          <Square aria-hidden="true" size={12} />
        </button>
      )}
    </div>
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
  const decorativeOpacity = RECENT_DECORATIVE_OPACITY[index] ?? RECENT_DECORATIVE_OPACITY.at(-1);

  if (activity.source === "toast") {
    const { toast } = activity;
    const Icon = TOAST_ICON[toast.kind] ?? Bell;
    return (
      <li className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-1.5">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)]",
            TOAST_CLASS[toast.kind],
            decorativeOpacity,
          )}
        >
          <Icon aria-hidden="true" className={cn(toast.kind === "loading" && "motion-safe:animate-spin")} size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-[var(--foreground)]">{toast.title}</span>
          <span className="block truncate text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
            {[toast.description, t(`tasks.notification.${toast.kind}`)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={cn("shrink-0 text-[0.625rem] tabular-nums text-[var(--muted-foreground)]", decorativeOpacity)}>
          {t("tasks.ago", { duration: formatDuration(now - activity.occurredAt) })}
        </span>
      </li>
    );
  }

  const { task } = activity;
  const Icon = OUTCOME_ICON[task.outcome] ?? Check;
  const titleKey = TASK_LABEL_KEY[task.label];
  const title = titleKey ? t(titleKey) : task.label;
  const row = (
    <>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)]",
          OUTCOME_CLASS[task.outcome],
          decorativeOpacity,
        )}
      >
        <Icon aria-hidden="true" size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-[var(--foreground)]">{title}</span>
        <span className="block truncate text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
          {[task.detail, t(`tasks.outcome.${task.outcome}`), formatDuration(task.endedAt - task.startedAt)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className={cn("shrink-0 text-[0.625rem] tabular-nums text-[var(--muted-foreground)]", decorativeOpacity)}>
        {t("tasks.ago", { duration: formatDuration(now - activity.occurredAt) })}
      </span>
    </>
  );

  return task.chatId ? (
    <li>
      <button
        type="button"
        onClick={() => {
          openTaskChat(task.chatId as string);
          onNavigate();
        }}
        title={t("tasks.openChat")}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      >
        {row}
      </button>
    </li>
  ) : (
    <li className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-1.5">{row}</li>
  );
}

export function EngineTasksMenu() {
  const { t } = useTranslation();
  const { data } = useEngineTasks();
  const toastHistory = useToastHistory();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const focusPanelOnOpenRef = useRef(false);
  const titleId = useId();
  const panelId = useId();

  const tasks = data?.tasks ?? EMPTY_TASKS;
  const taskHistory = data?.history ?? EMPTY_TASK_HISTORY;
  const taskCount = tasks.length;
  const recent = useMemo(() => mergeRecentActivity(taskHistory, toastHistory), [taskHistory, toastHistory]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
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
    if (!open || !focusPanelOnOpenRef.current) return;
    focusPanelOnOpenRef.current = false;
    panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const closePanel = () => setOpen(false);
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
        "fixed right-2 top-[calc(env(safe-area-inset-top)+3rem)] z-[2147482000] flex max-h-[min(32rem,calc(100svh-4rem))] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      )}
    >
      <header className={NEUTRAL_PANEL_HEADER}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--primary)] ring-1 ring-inset ring-[var(--border)]">
            <Activity aria-hidden="true" size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <h2 id={titleId} className={NEUTRAL_PANEL_TITLE}>
              {t("tasks.missionControl")}
            </h2>
            <p className={NEUTRAL_PANEL_SUBTITLE}>
              {taskCount > 0 ? t("tasks.runningCount", { count: taskCount }) : t("tasks.idle")}
            </p>
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 w-2.5 rounded-full ring-2 ring-[var(--card)]",
              taskCount > 0
                ? "bg-[var(--primary)] motion-safe:animate-pulse"
                : "bg-[var(--muted-foreground)] opacity-45",
            )}
          />
        </div>
      </header>

      <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "min-h-0 flex-1 overflow-y-auto px-2 py-2.5 overscroll-contain")}>
        {tasks.length > 0 && (
          <section aria-labelledby={`${titleId}-active`}>
            <h3
              id={`${titleId}-active`}
              className="px-1 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              {t("tasks.active")}
            </h3>
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} now={now} onNavigate={closePanel} />
              ))}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section
            aria-labelledby={`${titleId}-recent`}
            className={cn(tasks.length > 0 && "mt-3 border-t border-[var(--border)] pt-2.5")}
          >
            <h3
              id={`${titleId}-recent`}
              className="px-1 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              {t("tasks.recent")}
            </h3>
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
                  onNavigate={closePanel}
                />
              ))}
            </ol>
          </section>
        )}

        {tasks.length === 0 && recent.length === 0 && (
          <div className="flex min-h-28 flex-col items-center justify-center px-6 py-5 text-center">
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
              <Activity aria-hidden="true" size={16} />
            </span>
            <p className="text-xs font-semibold text-[var(--foreground)]">{t("tasks.emptyTitle")}</p>
            <p className="mt-1 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
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
        onClick={(event) => {
          const nextOpen = !open;
          focusPanelOnOpenRef.current = nextOpen && event.detail === 0;
          setOpen(nextOpen);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          focusPanelOnOpenRef.current = false;
          setOpen(true);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        aria-label={taskCount > 0 ? t("tasks.openMenu", { count: taskCount }) : t("tasks.menuLabel")}
        title={t("tasks.missionControl")}
        className={cn(
          "mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-all active:scale-95 max-sm:h-7 max-sm:w-7",
          open
            ? "bg-[var(--accent)] text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        )}
      >
        <Activity aria-hidden="true" size={15} />
        {taskCount > 0 && (
          <span
            role="status"
            aria-live="polite"
            className="absolute -right-0.5 -top-0.5 min-w-3.5 rounded-full bg-[var(--primary)] px-1 text-center text-[0.5625rem] font-bold leading-3.5 text-[var(--primary-foreground)]"
          >
            {Math.min(taskCount, 99)}
          </span>
        )}
      </button>
      {typeof document === "undefined" ? null : createPortal(panel, document.body)}
    </>
  );
}
