import { useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  GraduationCap,
  Heart,
  Library,
  List,
  Lock,
  MessageCircle,
  MessagesSquare,
  Theater,
  Trophy,
  UserRound,
  Gamepad2,
  type LucideIcon,
} from "lucide-react";
import type { AchievementDefinition, AchievementProgress } from "@marinara-engine/shared";
import { useAchievements } from "../../hooks/use-achievements";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { useTranslation } from "react-i18next";

const ICONS: Record<AchievementDefinition["icon"], LucideIcon> = {
  graduation: GraduationCap,
  discord: MessageCircle,
  heart: Heart,
  credits: List,
  mari: Bot,
  conversation: MessagesSquare,
  roleplay: Theater,
  game: Gamepad2,
  character: UserRound,
  lorebook: BookOpen,
  persona: Library,
};

const CATEGORY_LABELS: Record<AchievementDefinition["category"], string> = {
  collection: "Collection",
  community: "Community",
  creation: "Creation",
  milestone: "Milestone",
};

function rankClasses(achievement: AchievementDefinition, locked: boolean) {
  if (locked) return "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]";
  if (achievement.rank === "bronze") return "border-amber-700/50 bg-amber-900/35 text-amber-200";
  if (achievement.rank === "silver") return "border-slate-300/45 bg-slate-300/18 text-slate-100";
  if (achievement.rank === "gold") return "border-yellow-400/55 bg-yellow-500/20 text-yellow-100";
  return "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-panel-title)]";
}

function AchievementBadge({ achievement, locked }: { achievement: AchievementDefinition; locked: boolean }) {
  const Icon = locked ? Lock : (ICONS[achievement.icon] ?? Trophy);

  return (
    <div
      className={cn(
        "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_14%,transparent)] sm:h-16 sm:w-16 sm:rounded-xl",
        rankClasses(achievement, locked),
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-25 [background:radial-gradient(circle_at_30%_20%,currentColor,transparent_34%)]" />
      <Icon className="relative z-10 h-5 w-5 sm:h-[1.65rem] sm:w-[1.65rem]" />
      {!locked && achievement.rankLabel && (
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/35 px-1 text-[0.55rem] font-bold text-white">
          {achievement.rankLabel}
        </span>
      )}
    </div>
  );
}

function progressPercent(progress: AchievementProgress) {
  if (!progress.target || progress.target <= 0) return 0;
  return Math.min(100, Math.round((progress.progress / progress.target) * 100));
}

function achievementTitle(achievement: AchievementDefinition) {
  return achievement.rankLabel ? `${achievement.title} ${achievement.rankLabel}` : achievement.title;
}

function unlockTimestamp(progress: AchievementProgress) {
  if (!progress.unlockedAt) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(progress.unlockedAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function CompactAchievementHighlight({
  kind,
  label,
  achievement,
  progress,
  fallback,
}: {
  kind: "latest" | "closest";
  label: string;
  achievement: AchievementDefinition | null;
  progress: AchievementProgress | null;
  fallback: string;
}) {
  const Icon = achievement ? (ICONS[achievement.icon] ?? Trophy) : Trophy;
  const target = progress?.target ?? null;

  return (
    <span data-achievement-highlight={kind} className="flex min-w-0 items-center gap-2 py-0.5">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
          kind === "latest"
            ? "border-[color-mix(in_srgb,oklch(0.76_0.19_52)_44%,var(--border))] bg-[color-mix(in_srgb,oklch(0.76_0.19_52)_16%,var(--card))] text-[oklch(0.76_0.19_52)]"
            : "border-[color-mix(in_srgb,oklch(0.79_0.16_205)_44%,var(--border))] bg-[color-mix(in_srgb,oklch(0.79_0.16_205)_14%,var(--card))] text-[oklch(0.79_0.16_205)]",
        )}
        aria-hidden="true"
      >
        <Icon size="0.72rem" strokeWidth={2.35} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.52rem] font-extrabold uppercase leading-none tracking-[0.11em] text-[var(--muted-foreground)]">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[0.65rem] font-bold leading-tight text-[var(--foreground)]">
          {achievement ? achievementTitle(achievement) : fallback}
        </span>
      </span>
      {target !== null && target > 0 ? (
        <span className="shrink-0 text-[0.58rem] font-bold tabular-nums text-[var(--muted-foreground)]">
          {Math.min(progress?.progress ?? 0, target)} / {target}
        </span>
      ) : null}
    </span>
  );
}

function AchievementCard({
  achievement,
  progress,
}: {
  achievement: AchievementDefinition;
  progress: AchievementProgress | null;
}) {
  const { t } = useTranslation();
  const locked = !progress?.unlocked;
  const title = locked ? "?????" : achievementTitle(achievement);
  const description = locked ? t("home.achievements.lockedDescription") : achievement.description;
  const target = progress?.target ?? null;

  return (
    <article
      className={cn(
        "flex min-w-0 gap-2.5 rounded-xl border p-2.5 transition-colors sm:gap-3 sm:p-3",
        locked ? "border-[var(--border)]/70 bg-[var(--secondary)]/22" : "border-[var(--border)] bg-[var(--card)]/65",
      )}
    >
      <AchievementBadge achievement={achievement} locked={locked} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="truncate text-xs font-semibold text-[var(--foreground)] sm:text-sm">{title}</h4>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">
              {t(`home.achievements.category.${achievement.category}`, {
                defaultValue: CATEGORY_LABELS[achievement.category],
              })}
            </p>
          </div>
          {progress?.unlockedAt && (
            <span className="mari-chrome-text-muted shrink-0 rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-2 py-0.5 text-[0.6rem]">
              {t("home.achievements.unlocked")}
            </span>
          )}
        </div>
        <p className="mari-chrome-text-muted mt-1.5 text-xs leading-relaxed sm:mt-2">{description}</p>
        {target !== null && (
          <div className="mt-3 space-y-1">
            <div className="mari-chrome-text-muted flex items-center justify-between text-[0.65rem]">
              <span>{t("home.achievements.progress")}</span>
              <span>
                {Math.min(progress?.progress ?? 0, target)} / {target}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]">
              <div
                className="mari-chrome-accent-progress mari-accent-animated h-full rounded-full transition-[width]"
                style={{
                  width: `${progressPercent(progress ?? { id: achievement.id, unlocked: false, unlockedAt: null, progress: 0, target })}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function HomeAchievements({
  attached = false,
  compact = false,
  className,
  open: controlledOpen,
  onOpenChange,
  showLauncher = true,
  showModal = true,
}: {
  attached?: boolean;
  compact?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showLauncher?: boolean;
  showModal?: boolean;
}) {
  const { t } = useTranslation();
  const achievementsEnabled = useUIStore((s) => s.achievementsEnabled);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const achievements = useAchievements(achievementsEnabled);

  const progressById = useMemo(
    () => new Map((achievements.data?.progress ?? []).map((item) => [item.id, item])),
    [achievements.data?.progress],
  );
  const latestUnlocked = useMemo(() => {
    const candidates = (achievements.data?.definitions ?? []).flatMap((definition) => {
      const progress = progressById.get(definition.id);
      return progress?.unlocked ? [{ achievement: definition, progress }] : [];
    });
    candidates.sort((left, right) => unlockTimestamp(right.progress) - unlockTimestamp(left.progress));
    return candidates[0] ?? null;
  }, [achievements.data?.definitions, progressById]);
  const closestLocked = useMemo(() => {
    const candidates = (achievements.data?.definitions ?? []).flatMap((definition) => {
      const progress = progressById.get(definition.id);
      if (!progress || progress.unlocked || !progress.target || progress.target <= 0) return [];
      return [
        {
          achievement: definition,
          progress,
          ratio: Math.max(0, progress.progress) / progress.target,
          remaining: Math.max(0, progress.target - progress.progress),
        },
      ];
    });
    candidates.sort(
      (left, right) =>
        right.ratio - left.ratio ||
        left.remaining - right.remaining ||
        (left.progress.target ?? 0) - (right.progress.target ?? 0),
    );
    return candidates[0] ?? null;
  }, [achievements.data?.definitions, progressById]);

  if (!achievementsEnabled) return null;

  const unlockedCount = achievements.data?.unlockedCount ?? 0;
  const totalCount = achievements.data?.totalCount ?? achievements.data?.definitions.length ?? 0;
  const summary = achievements.isLoading
    ? t("home.achievements.checking")
    : t("home.achievements.summary", { unlocked: unlockedCount, total: totalCount });

  return (
    <>
      {showLauncher ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "mari-chrome-control group flex justify-start gap-2 text-left",
            compact
              ? "w-full max-w-full !items-start !justify-start px-0 py-0 shadow-none"
              : "w-full max-w-5xl items-center px-3 py-2.5 shadow-lg shadow-black/10 sm:gap-3 sm:px-4 sm:py-3",
            attached ? "-mt-px !rounded-b-xl !rounded-t-none !border-t-0" : "!rounded-xl",
            className,
          )}
          aria-label={t("home.achievements.open")}
        >
          <span className={cn("flex min-w-0 items-center", compact ? "w-full items-start pr-[42%]" : "gap-2.5 sm:gap-3")}>
            {!compact ? (
              <span
                className="mari-chrome-accent-surface mari-accent-animated flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm sm:h-10 sm:w-10"
                aria-hidden="true"
              >
                <Trophy size="1.15rem" strokeWidth={2.25} />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              {!compact ? (
                <span className="block text-sm font-semibold text-[var(--foreground)]">
                  {t("home.achievements.title")}
                </span>
              ) : null}
              {compact ? (
                <span className="block w-full">
                  <span className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2 text-left transition-colors group-hover:bg-[color-mix(in_srgb,oklch(0.76_0.19_52)_10%,var(--accent))]">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,oklch(0.76_0.19_52)_42%,var(--border))] bg-[color-mix(in_srgb,oklch(0.76_0.19_52)_16%,var(--card))] text-[oklch(0.76_0.19_52)]"
                      aria-hidden="true"
                    >
                      <Trophy size="1rem" strokeWidth={2.3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        data-achievement-open-label
                        className="block truncate text-xs font-bold text-[var(--foreground)]"
                      >
                        {t("home.achievements.title")}
                      </span>
                      <span
                        data-achievement-open-description
                        className="block truncate text-[0.62rem] text-[var(--muted-foreground)]"
                      >
                        {t("home.achievements.description")}
                      </span>
                      <span className="mari-chrome-text-muted block truncate text-[0.56rem]">{summary}</span>
                    </span>
                  </span>
                  <span className="mt-0.5 block border-t border-[var(--border)]/55 pt-1">
                    <CompactAchievementHighlight
                      kind="latest"
                      label={t("home.achievements.lastObtained")}
                      achievement={latestUnlocked?.achievement ?? null}
                      progress={latestUnlocked?.progress ?? null}
                      fallback={t("home.achievements.noneObtained")}
                    />
                    <CompactAchievementHighlight
                      kind="closest"
                      label={t("home.achievements.closestNext")}
                      achievement={closestLocked?.achievement ?? null}
                      progress={closestLocked?.progress ?? null}
                      fallback={t("home.achievements.allObtained")}
                    />
                  </span>
                </span>
              ) : (
                <span className="mari-chrome-text-muted block truncate text-xs">{summary}</span>
              )}
            </span>
          </span>
        </button>
      ) : null}

      {showModal ? (
        <Modal open={open} onClose={() => setOpen(false)} title={t("home.achievements.title")} width="max-w-5xl">
          <div className="space-y-3 sm:space-y-4">
            <div className="mari-chrome-text-muted rounded-xl border border-[var(--border)] bg-[var(--secondary)]/25 px-3 py-2 text-xs">
              {t("home.achievements.profileSummary", { unlocked: unlockedCount, total: totalCount })}
            </div>
            {achievements.isError ? (
              <p className="rounded-xl border border-[var(--destructive)]/35 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
                {t("home.achievements.loadError")}
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(achievements.data?.definitions ?? []).map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    progress={progressById.get(achievement.id) ?? null}
                  />
                ))}
              </div>
            )}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
