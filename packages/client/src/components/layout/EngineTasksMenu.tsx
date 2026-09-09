import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Bot, Download, Image as ImageIcon, MessageSquare, Square } from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { useAbortEngineTask, useEngineTasks, type EngineTask, type TaskKind } from "../../hooks/use-tasks";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";

const KIND_ICON: Record<TaskKind, typeof Bot> = {
  generation: MessageSquare,
  agents: Bot,
  media: ImageIcon,
  transfer: Download,
};

const KIND_ORDER: TaskKind[] = ["generation", "agents", "media", "transfer"];

function formatElapsed(startedAt: number, now: number) {
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function TaskRow({ task, now, onNavigate }: { task: EngineTask; now: number; onNavigate: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const abortTask = useAbortEngineTask();
  const Icon = KIND_ICON[task.kind] ?? Activity;
  const percent =
    task.progress?.total && task.progress.total > 0
      ? Math.min(100, Math.round((task.progress.current / task.progress.total) * 100))
      : null;

  // A chat-scoped task doubles as a shortcut to the chat it belongs to; other kinds stay inert.
  const Body = task.chatId ? "button" : "span";

  const openChat = () => {
    if (!task.chatId) return;
    useUIStore.getState().closeAllDetails();
    useChatStore.getState().setActiveChatId(task.chatId);
    onNavigate();
  };

  return (
    <div className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--foreground)]">
        <Icon aria-hidden="true" size={15} />
      </span>
      <Body
        {...(task.chatId
          ? {
              type: "button" as const,
              role: "menuitem",
              onClick: openChat,
              title: t("tasks.openChat"),
              className:
                "min-w-0 flex-1 rounded-lg text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
            }
          : { className: "min-w-0 flex-1" })}
      >
        <span className="block truncate text-xs font-semibold text-[var(--foreground)]">{task.label}</span>
        <span className="block truncate text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
          {percent === null
            ? formatElapsed(task.startedAt, now)
            : localizeUi("ui.layout.taskrow.value1Value2", {
                value1: percent,
                value2: formatElapsed(task.startedAt, now),
              })}
        </span>
        {percent !== null && (
          <span
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={task.label}
            className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-[var(--secondary)]"
          >
            <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${percent}%` }} />
          </span>
        )}
      </Body>
      {task.cancellable && (
        <button
          type="button"
          onClick={() => abortTask.mutate(task.id)}
          disabled={abortTask.isPending}
          aria-label={t("tasks.stop")}
          title={t("tasks.stop")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50"
        >
          <Square aria-hidden="true" size={13} />
        </button>
      )}
    </div>
  );
}

export function EngineTasksMenu() {
  const { t } = useTranslation();
  const { data } = useEngineTasks();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const tasks = data?.tasks ?? [];
  const taskCount = tasks.length;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
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

  // Only tick the elapsed clock while the panel is actually visible.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (taskCount === 0) setOpen(false);
  }, [taskCount]);

  if (taskCount === 0) return null;

  const sections = KIND_ORDER.map((kind) => ({ kind, items: tasks.filter((task) => task.kind === kind) })).filter(
    (section) => section.items.length > 0,
  );

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t("tasks.menuLabel")}
      className="mari-chrome-token-scope fixed right-2 top-[calc(env(safe-area-inset-top)+3rem)] z-[2147482000] max-h-[70vh] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 text-[var(--popover-foreground)] shadow-2xl"
    >
      <div className="flex items-center gap-2 px-2.5 pb-2 pt-1">
        <Activity aria-hidden="true" className="text-[var(--primary)]" size={15} />
        <h2 className="text-xs font-semibold">{t("tasks.title")}</h2>
        <span className="ml-auto rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
          {taskCount}
        </span>
      </div>

      {sections.map((section, index) => (
        <section
          key={section.kind}
          aria-label={t(`tasks.kind.${section.kind}`)}
          className={cn(index > 0 && "mt-2 border-t border-[var(--border)] pt-2")}
        >
          <p className="px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {t(`tasks.kind.${section.kind}`)}
          </p>
          {section.items.map((task) => (
            <TaskRow key={task.id} task={task} now={now} onNavigate={() => setOpen(false)} />
          ))}
        </section>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onPointerEnter={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("tasks.openMenu", { count: taskCount })}
        title={t("tasks.title")}
        className={cn(
          "mari-topbar-action relative flex h-8 w-8 items-center justify-center rounded-lg p-0 transition-all active:scale-95 max-sm:h-7 max-sm:w-7",
          open
            ? "bg-[var(--accent)] text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        )}
      >
        <Activity aria-hidden="true" size={15} />
        <span
          role="status"
          aria-live="polite"
          className="absolute -right-0.5 -top-0.5 min-w-3.5 rounded-full bg-[var(--primary)] px-1 text-center text-[0.5625rem] font-bold leading-3.5 text-[var(--primary-foreground)]"
        >
          {Math.min(taskCount, 99)}
        </span>
      </button>
      {typeof document === "undefined" ? null : createPortal(menu, document.body)}
    </>
  );
}
