// ──────────────────────────────────────────────
// Home "Things to try": the next three tasks in the Field notes widget, and the full list by trail
// (See all). Show me opens the spot; a task ticks itself when Marinara sees it done, or by hand.
// ──────────────────────────────────────────────
import { useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  CloudSun,
  Dices,
  Drama,
  Folder,
  GitBranch,
  Images,
  Lock,
  MessageCircle,
  Paintbrush,
  Palette,
  PanelsTopLeft,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Users,
  X,
  type LucideProps,
} from "lucide-react";
import { DISCOVERY_TRAILS, type DiscoveryTrailId } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import {
  THINGS_TO_TRY_BY_ID,
  THINGS_TO_TRY_TASKS,
  THINGS_TO_TRY_TRAIL_NAMES,
  isTaskUnlocked,
  thingsToTryTaskKey,
  thingsToTryTrailKey,
  type ThingsToTryTask,
} from "../../lib/things-to-try";
import { skipThing, tickThing, unskipThing, untickThing } from "../../lib/things-to-try-progress";
import { useRunFeatureStep } from "../../hooks/use-feature-show";
import { useThingsToTry } from "../../hooks/use-things-to-try";
import { useUIStore } from "../../stores/ui.store";

export const THINGS_TO_TRY_TRAIL_ICONS: Record<DiscoveryTrailId, ComponentType<LucideProps>> = {
  core: Sparkles,
  characters: Users,
  gallery: Images,
  conversation: MessageCircle,
  roleplay: Drama,
  lore: BookOpen,
  story: GitBranch,
  game: Dices,
  prompts: SlidersHorizontal,
  look: Palette,
  extras: AudioLines,
  workspace: PanelsTopLeft,
  library: Folder,
  weather: CloudSun,
  themes: Paintbrush,
};

function useTaskText() {
  const { t } = useTranslation();
  return {
    t,
    title: (task: ThingsToTryTask) => t(thingsToTryTaskKey(task.id), task.title),
    trail: (trail: DiscoveryTrailId) => t(thingsToTryTrailKey(trail), THINGS_TO_TRY_TRAIL_NAMES[trail]),
  };
}

/** Show me: the task's own step, or its guide when it has none or the step can't run here. */
function useShowTask(beforeRun?: () => void) {
  const runStep = useRunFeatureStep();
  return (task: ThingsToTryTask) => {
    beforeRun?.();
    if (task.show && runStep(task.show)) return;
    useUIStore.getState().openModal("docs-viewer", { initialDoc: task.guide });
  };
}

const iconButton =
  "mari-things-to-try__icon-button grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent,var(--marinara-app-accent-solid))] pointer-coarse:h-9 pointer-coarse:w-9";

/** The widget body: three rows, each one Show me, with Done and Skip beside it. */
export function ThingsToTryWidget({ fallback }: { fallback: ReactNode }) {
  const { t, title, trail } = useTaskText();
  const things = useThingsToTry();
  const showTask = useShowTask();

  if (!things.ready) {
    return (
      <div className="grid h-full grid-rows-3 gap-1" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <span key={index} className="rounded-xl bg-[color-mix(in_srgb,var(--home-module-accent)_5%,transparent)]" />
        ))}
      </div>
    );
  }
  // Everything done or skipped: the widget goes back to the guide links.
  if (!things.next.length) return <>{fallback}</>;

  return (
    <div
      className="mari-home-widget-shortcut-list mari-things-to-try grid h-full grid-rows-3 gap-1"
      data-component="HomeThingsToTry.Widget"
    >
      {things.next.map((task) => {
        const Icon = THINGS_TO_TRY_TRAIL_ICONS[task.trail];
        return (
          <div key={task.id} className="flex min-h-0 items-center gap-1" data-things-to-try-task={task.id}>
            <button
              type="button"
              onClick={() => showTask(task)}
              title={t("thingsToTry.showMeHint", "Show me where")}
              className="mari-home-widget-shortcut flex h-full min-h-0 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--home-module-accent)_10%,var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent)]"
            >
              <span className="mari-things-to-try__trail-icon grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--home-module-accent)_14%,transparent)] text-[var(--home-module-accent-text,var(--home-module-accent))]">
                <Icon size="0.95rem" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="mari-home-widget-shortcut__title line-clamp-1 text-xs font-bold">{title(task)}</span>
                <span className="mari-home-widget-shortcut__description line-clamp-1 text-[0.65rem] text-[var(--muted-foreground)]">
                  {trail(task.trail)}
                </span>
              </span>
            </button>
            <button
              type="button"
              className={iconButton}
              onClick={() => tickThing(task.id)}
              aria-label={t("thingsToTry.markDoneNamed", "Mark done: {{task}}", { task: title(task) })}
              title={t("thingsToTry.markDone", "Mark done")}
            >
              <Check size="0.9rem" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={iconButton}
              onClick={() => skipThing(task.id)}
              aria-label={t("thingsToTry.skipNamed", "Skip: {{task}}", { task: title(task) })}
              title={t("thingsToTry.skip", "Skip, don't show again")}
            >
              <X size="0.9rem" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** The header button: See all, with how many are done. */
export function ThingsToTrySeeAll({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const things = useThingsToTry();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative z-[2] shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-[var(--home-module-accent-text,var(--home-module-accent))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-module-accent)]"
    >
      {things.ready
        ? t("thingsToTry.seeAllCount", "See all ({{done}}/{{total}})", { done: things.doneCount, total: things.total })
        : t("thingsToTry.seeAll", "See all")}
    </button>
  );
}

function TaskRow({
  task,
  done,
  skipped,
  ticked,
  locked,
  onShow,
}: {
  task: ThingsToTryTask;
  done: boolean;
  skipped: boolean;
  ticked: boolean;
  locked: boolean;
  onShow: (task: ThingsToTryTask) => void;
}) {
  const { t, title } = useTaskText();
  const after = task.after
    .map((group) =>
      group
        .map((id) => (THINGS_TO_TRY_BY_ID.get(id) ? title(THINGS_TO_TRY_BY_ID.get(id)!) : id))
        .join(t("thingsToTry.or", " or ")),
    )
    .join("; ");
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-xl px-2 py-1.5",
        (done || skipped) && "text-[var(--muted-foreground)]",
      )}
      data-things-to-try-task={task.id}
      data-state={done ? "done" : skipped ? "skipped" : locked ? "locked" : "open"}
    >
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
          done
            ? "border-transparent bg-[var(--marinara-app-accent-solid,var(--primary))] text-[var(--primary-foreground)]"
            : "border-[var(--border)]",
        )}
        aria-hidden="true"
      >
        {done ? <Check size="0.7rem" strokeWidth={3} /> : locked ? <Lock size="0.6rem" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", done && "line-through decoration-1", skipped && "italic")}>
          {title(task)}
        </span>
        {locked && !done ? (
          <span className="block text-[0.7rem] text-[var(--muted-foreground)]">
            {t("thingsToTry.after", "After: {{tasks}}", { tasks: after })}
          </span>
        ) : skipped ? (
          <span className="block text-[0.7rem]">{t("thingsToTry.skipped", "Skipped")}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {!done ? (
          <button
            type="button"
            onClick={() => onShow(task)}
            className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--marinara-app-accent-text,var(--primary))] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] pointer-coarse:min-h-9"
          >
            {t("thingsToTry.showMe", "Show me")}
          </button>
        ) : null}
        {done ? (
          ticked ? (
            <button
              type="button"
              className={iconButton}
              onClick={() => untickThing(task.id)}
              aria-label={t("thingsToTry.undoNamed", "Undo done: {{task}}", { task: title(task) })}
              title={t("thingsToTry.undo", "Undo")}
            >
              <Undo2 size="0.9rem" aria-hidden="true" />
            </button>
          ) : null
        ) : (
          <>
            <button
              type="button"
              className={iconButton}
              onClick={() => tickThing(task.id)}
              aria-label={t("thingsToTry.markDoneNamed", "Mark done: {{task}}", { task: title(task) })}
              title={t("thingsToTry.markDone", "Mark done")}
            >
              <Check size="0.9rem" aria-hidden="true" />
            </button>
            {skipped ? (
              <button
                type="button"
                className={iconButton}
                onClick={() => unskipThing(task.id)}
                aria-label={t("thingsToTry.unskipNamed", "Show again: {{task}}", { task: title(task) })}
                title={t("thingsToTry.unskip", "Show again")}
              >
                <Undo2 size="0.9rem" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className={iconButton}
                onClick={() => skipThing(task.id)}
                aria-label={t("thingsToTry.skipNamed", "Skip: {{task}}", { task: title(task) })}
                title={t("thingsToTry.skip", "Skip, don't show again")}
              >
                <X size="0.9rem" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </span>
    </li>
  );
}

/** See all: every trail with its tasks, Engine trails first, then the ones only this layout has. */
export function ThingsToTryList({ onClose, links }: { onClose: () => void; links: ReactNode }) {
  const { t, trail } = useTaskText();
  const things = useThingsToTry();
  const showTask = useShowTask(onClose);
  // Trails start folded, except the ones the widget is suggesting from, so the list opens quickly.
  const [openTrails, setOpenTrails] = useState<Set<DiscoveryTrailId>>(
    () => new Set(things.next.map((task) => task.trail)),
  );
  const toggleTrail = (trail: DiscoveryTrailId) =>
    setOpenTrails((current) => {
      const next = new Set(current);
      if (next.has(trail)) next.delete(trail);
      else next.add(trail);
      return next;
    });
  const parts = [
    { id: "engine", label: t("thingsToTry.partEngine", "Marinara Engine") },
    { id: "kolacheee", label: t("thingsToTry.partLayout", "Only in this layout") },
  ] as const;

  return (
    <div className="space-y-4" data-component="HomeThingsToTry.List">
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
        {t(
          "thingsToTry.intro",
          "Small things to try, one feature each. Most tick themselves when Marinara sees them done; tick the rest yourself. Finish a trail for an Explorer achievement.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">{links}</div>
      {parts.map((part) => (
        <section key={part.id} className="space-y-3" aria-label={part.label}>
          <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
            {part.label}
          </h3>
          {DISCOVERY_TRAILS.filter((entry) => entry.part === part.id).map((entry) => {
            const tasks = THINGS_TO_TRY_TASKS.filter((task) => task.trail === entry.id);
            const doneHere = tasks.filter((task) => things.done.has(task.id)).length;
            const Icon = THINGS_TO_TRY_TRAIL_ICONS[entry.id];
            const expanded = openTrails.has(entry.id);
            return (
              <section
                key={entry.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5"
                data-things-to-try-trail={entry.id}
              >
                <h4>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleTrail(entry.id)}
                    className="flex min-h-9 w-full items-center gap-2 rounded-xl px-2 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)]"
                  >
                    <Icon
                      size="1rem"
                      aria-hidden="true"
                      className="shrink-0 text-[var(--marinara-app-accent-text,var(--primary))]"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{trail(entry.id)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                      {things.finished.includes(entry.id)
                        ? t("thingsToTry.trailDone", "Done")
                        : t("thingsToTry.trailCount", "{{done}} of {{total}}", { done: doneHere, total: tasks.length })}
                    </span>
                    <ChevronDown
                      size="0.9rem"
                      aria-hidden="true"
                      className={cn(
                        "shrink-0 text-[var(--muted-foreground)] transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                </h4>
                {expanded ? (
                  <ul className="grid gap-0.5 pt-1">
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        done={things.done.has(task.id)}
                        skipped={things.skipped.has(task.id)}
                        ticked={things.ticked.has(task.id)}
                        locked={!isTaskUnlocked(task, things.done)}
                        onShow={showTask}
                      />
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </section>
      ))}
    </div>
  );
}
