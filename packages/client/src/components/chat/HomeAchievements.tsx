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
  const Icon = locked ? Lock : ICONS[achievement.icon] ?? Trophy;

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

function AchievementCard({
  achievement,
  progress,
}: {
  achievement: AchievementDefinition;
  progress: AchievementProgress | null;
}) {
  const locked = !progress?.unlocked;
  const title = locked ? "?????" : achievement.rankLabel ? `${achievement.title} ${achievement.rankLabel}` : achievement.title;
  const description = locked ? "Unlock this achievement to reveal its title and badge." : achievement.description;
  const target = progress?.target ?? null;

  return (
    <article
      className={cn(
        "flex min-w-0 gap-2.5 rounded-xl border p-2.5 transition-colors sm:gap-3 sm:p-3",
        locked
          ? "border-[var(--border)]/70 bg-[var(--secondary)]/22"
          : "border-[var(--border)] bg-[var(--card)]/65",
      )}
    >
      <AchievementBadge achievement={achievement} locked={locked} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="truncate text-xs font-semibold text-[var(--foreground)] sm:text-sm">{title}</h4>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--muted-foreground)]">
              {CATEGORY_LABELS[achievement.category]}
            </p>
          </div>
          {progress?.unlockedAt && (
            <span className="mari-chrome-text-muted shrink-0 rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-2 py-0.5 text-[0.6rem]">
              unlocked
            </span>
          )}
        </div>
        <p className="mari-chrome-text-muted mt-1.5 text-xs leading-relaxed sm:mt-2">{description}</p>
        {target !== null && (
          <div className="mt-3 space-y-1">
            <div className="mari-chrome-text-muted flex items-center justify-between text-[0.65rem]">
              <span>Progress</span>
              <span>
                {Math.min(progress?.progress ?? 0, target)} / {target}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]">
              <div
                className="mari-chrome-accent-progress mari-accent-animated h-full rounded-full transition-[width]"
                style={{ width: `${progressPercent(progress ?? { id: achievement.id, unlocked: false, unlockedAt: null, progress: 0, target })}%` }}
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
  className,
}: {
  attached?: boolean;
  className?: string;
}) {
  const achievementsEnabled = useUIStore((s) => s.achievementsEnabled);
  const [open, setOpen] = useState(false);
  const achievements = useAchievements(achievementsEnabled);

  const progressById = useMemo(
    () => new Map((achievements.data?.progress ?? []).map((item) => [item.id, item])),
    [achievements.data?.progress],
  );

  if (!achievementsEnabled) return null;

  const unlockedCount = achievements.data?.unlockedCount ?? 0;
  const totalCount = achievements.data?.totalCount ?? achievements.data?.definitions.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "mari-chrome-control group flex w-full max-w-3xl items-center justify-start gap-2 px-3 py-2.5 text-left shadow-lg shadow-black/10 sm:gap-3 sm:px-4 sm:py-3",
          attached ? "-mt-px !rounded-b-xl !rounded-t-none !border-t-0" : "!rounded-xl",
          className,
        )}
        aria-label="Open achievements"
      >
        <span className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span
            className="mari-chrome-accent-surface mari-accent-animated flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm sm:h-10 sm:w-10"
            aria-hidden="true"
          >
            <Trophy size="1.15rem" strokeWidth={2.25} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--foreground)]">Achievements</span>
            <span className="mari-chrome-text-muted block truncate text-xs">
              {achievements.isLoading ? "Checking the collection..." : `${unlockedCount} of ${totalCount} unlocked`}
            </span>
          </span>
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Achievements" width="max-w-5xl">
        <div className="space-y-3 sm:space-y-4">
          <div className="mari-chrome-text-muted rounded-xl border border-[var(--border)] bg-[var(--secondary)]/25 px-3 py-2 text-xs">
            {unlockedCount} of {totalCount} achievements unlocked in this profile.
          </div>
          {achievements.isError ? (
            <p className="rounded-xl border border-[var(--destructive)]/35 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
              Achievements could not be loaded right now.
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
    </>
  );
}
