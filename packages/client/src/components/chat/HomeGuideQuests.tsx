// ──────────────────────────────────────────────
// Home: AI basics and Deep dives, the two guide quest sets beside Things to try (lib/guide-quests.ts).
// See all shows them as their own tabs. Each quest opens its guide at the passage with a guide card
// (components/docs/GuideCard.tsx). Deep dive groups are listed most relevant first.
// ──────────────────────────────────────────────
import { useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  Dices,
  Drama,
  GraduationCap,
  Layers,
  MessageCircle,
  MessagesSquare,
  Music,
  Paintbrush,
  SlidersHorizontal,
  Undo2,
  Users,
  Workflow,
  X,
  type LucideProps,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  AI_BASICS_QUESTS,
  DEEP_DIVE_GROUPS,
  DEEP_DIVES,
  deepDiveGroupKey,
  guideQuestKey,
  type DeepDiveGroupId,
  type GuideQuest,
} from "../../lib/guide-quests";
import { markGuideQuestDone, skipGuideQuest, undoGuideQuest, unskipGuideQuest } from "../../lib/guide-quests-progress";
import { useGuideQuests } from "../../hooks/use-guide-quests";
import { startGuideQuest } from "../../stores/guide-card.store";

export const DEEP_DIVE_GROUP_ICONS: Record<DeepDiveGroupId, ComponentType<LucideProps>> = {
  deepConversation: MessageCircle,
  deepRoleplay: Drama,
  deepGame: Dices,
  deepAnyMode: SlidersHorizontal,
  deepCards: Users,
  deepLore: BookOpen,
  deepPrompts: Braces,
  deepMessages: MessagesSquare,
  deepAgents: Workflow,
  deepMedia: Music,
  deepThemes: Paintbrush,
};

export const AI_BASICS_ICON = GraduationCap;
export const DEEP_DIVES_ICON = Layers;

export function useGuideQuestText() {
  const { t } = useTranslation();
  return {
    t,
    title: (quest: GuideQuest) => t(guideQuestKey(quest.id, "title"), quest.title),
    group: (group: DeepDiveGroupId) =>
      t(deepDiveGroupKey(group), DEEP_DIVE_GROUPS.find((entry) => entry.id === group)?.name ?? group),
  };
}

const iconButton =
  "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] pointer-coarse:h-9 pointer-coarse:w-9";

function QuestRow({
  quest,
  done,
  skipped,
  onOpen,
}: {
  quest: GuideQuest;
  done: boolean;
  skipped: boolean;
  onOpen: (quest: GuideQuest) => void;
}) {
  const { t, title } = useGuideQuestText();
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-xl px-2 py-1.5",
        (done || skipped) && "text-[var(--muted-foreground)]",
      )}
      data-guide-quest={quest.id}
      data-state={done ? "done" : skipped ? "skipped" : "open"}
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
        {done ? <Check size="0.7rem" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", done && "line-through decoration-1", skipped && "italic")}>
          {title(quest)}
        </span>
        {skipped ? <span className="block text-[0.7rem]">{t("thingsToTry.skipped", "Skipped")}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onOpen(quest)}
          className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--marinara-app-accent-text,var(--primary))] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)] pointer-coarse:min-h-9"
        >
          {done ? t("guideQuests.readAgain", "Read again") : t("guideQuests.open", "Open")}
        </button>
        {done ? (
          <button
            type="button"
            className={iconButton}
            onClick={() => undoGuideQuest(quest.id)}
            aria-label={t("thingsToTry.undoNamed", "Undo done: {{task}}", { task: title(quest) })}
            title={t("thingsToTry.undo", "Undo")}
          >
            <Undo2 size="0.9rem" aria-hidden="true" />
          </button>
        ) : (
          <>
            <button
              type="button"
              className={iconButton}
              onClick={() => markGuideQuestDone(quest.id)}
              aria-label={t("thingsToTry.markDoneNamed", "Mark done: {{task}}", { task: title(quest) })}
              title={t("thingsToTry.markDone", "Mark done")}
            >
              <Check size="0.9rem" aria-hidden="true" />
            </button>
            {quest.set === "deep" ? (
              skipped ? (
                <button
                  type="button"
                  className={iconButton}
                  onClick={() => unskipGuideQuest(quest.id)}
                  aria-label={t("thingsToTry.unskipNamed", "Show again: {{task}}", { task: title(quest) })}
                  title={t("thingsToTry.unskip", "Show again")}
                >
                  <Undo2 size="0.9rem" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className={iconButton}
                  onClick={() => skipGuideQuest(quest.id)}
                  aria-label={t("thingsToTry.skipNamed", "Skip: {{task}}", { task: title(quest) })}
                  title={t("thingsToTry.skip", "Skip, don't show again")}
                >
                  <X size="0.9rem" aria-hidden="true" />
                </button>
              )
            ) : null}
          </>
        )}
      </span>
    </li>
  );
}

/** See all, AI basics tab: the twelve quests in order, with Start (or Continue). */
export function AiBasicsList({ onClose }: { onClose: () => void }) {
  const { t } = useGuideQuestText();
  const quests = useGuideQuests();
  const next = AI_BASICS_QUESTS.find((quest) => !quests.done.has(quest.id));
  const doneCount = AI_BASICS_QUESTS.filter((quest) => quests.done.has(quest.id)).length;
  const open = (quest: GuideQuest) => {
    onClose();
    startGuideQuest(quest.id);
  };
  return (
    <div className="space-y-3" data-component="HomeGuideQuests.AiBasics">
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
        {t(
          "guideQuests.basicsIntro",
          "New to AI? Twelve short stops through the guides: what a model is, the kinds Marinara uses, tokens and context, and setting one up (optional). Each opens the guide at the passage that matters, with a plain-words note. It ends with Professor Mari.",
        )}
      </p>
      <div className="flex items-center gap-2">
        {next ? (
          <button
            type="button"
            onClick={() => open(next)}
            className="flex min-h-9 items-center gap-2 rounded-lg bg-[var(--marinara-app-accent-solid,var(--primary))] px-3 text-xs font-bold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <GraduationCap size="0.95rem" aria-hidden="true" />
            {doneCount ? t("guideQuests.continue", "Continue the tour") : t("guideQuests.start", "Start the tour")}
          </button>
        ) : null}
        <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
          {next
            ? t("thingsToTry.trailCount", "{{done}} of {{total}}", { done: doneCount, total: AI_BASICS_QUESTS.length })
            : t("thingsToTry.trailDone", "Done")}
        </span>
      </div>
      <ul className="grid gap-0.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5">
        {AI_BASICS_QUESTS.map((quest) => (
          <QuestRow
            key={quest.id}
            quest={quest}
            done={quests.done.has(quest.id)}
            skipped={quests.skipped.has(quest.id)}
            onOpen={open}
          />
        ))}
      </ul>
    </div>
  );
}

/** See all, Deep dives tab: every group, most relevant first; the top two start unfolded. */
export function DeepDiveList({ onClose }: { onClose: () => void }) {
  const { t, group: groupName } = useGuideQuestText();
  const quests = useGuideQuests();
  const [openGroups, setOpenGroups] = useState<Set<DeepDiveGroupId>>(() => new Set(quests.groups.slice(0, 2)));
  const toggle = (id: DeepDiveGroupId) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const open = (quest: GuideQuest) => {
    onClose();
    startGuideQuest(quest.id);
  };
  return (
    <div className="space-y-3" data-component="HomeGuideQuests.DeepDives">
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
        {t(
          "guideQuests.deepIntro",
          "For when you know the basics: settings where the choice isn't obvious, and features almost nobody finds. Nothing here is needed for anything else. They join Things to try on Home once you finish its Core trail, favouring what you use most.",
        )}
      </p>
      {quests.groups.map((id) => {
        const list = DEEP_DIVES.filter((quest) => quest.group === id);
        const doneHere = list.filter((quest) => quests.done.has(quest.id)).length;
        const Icon = DEEP_DIVE_GROUP_ICONS[id];
        const expanded = openGroups.has(id);
        return (
          <section
            key={id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5"
            data-deep-dive-group={id}
          >
            <h4>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggle(id)}
                className="flex min-h-9 w-full items-center gap-2 rounded-xl px-2 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-app-accent-solid)]"
              >
                <Icon
                  size="1rem"
                  aria-hidden="true"
                  className="shrink-0 text-[var(--marinara-app-accent-text,var(--primary))]"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{groupName(id)}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                  {quests.finished.includes(id)
                    ? t("thingsToTry.trailDone", "Done")
                    : t("thingsToTry.trailCount", "{{done}} of {{total}}", { done: doneHere, total: list.length })}
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
                {list.map((quest) => (
                  <QuestRow
                    key={quest.id}
                    quest={quest}
                    done={quests.done.has(quest.id)}
                    skipped={quests.skipped.has(quest.id)}
                    onOpen={open}
                  />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
