import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityOverview } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/utils";
import { useActivityOverview } from "../../hooks/use-chat-insights";
import { openChatAtMessage } from "../../lib/chat-insights";
import {
  buildHeatmapGrid,
  formatPlayDuration,
  heatmapRange,
  localDayKey,
  type HeatmapCell,
} from "../../lib/chat-insights-display";
import { SectionTitle, StatTile } from "./ChatStatsModal";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";

const LEVEL_CLASSES: Record<HeatmapCell["level"], string> = {
  0: "bg-[var(--foreground)]/8",
  1: "bg-[var(--primary)]/30",
  2: "bg-[var(--primary)]/50",
  3: "bg-[var(--primary)]/75",
  4: "bg-[var(--primary)]",
};

function ActivityHeatmap({ overview }: { overview: ActivityOverview }) {
  const { t } = useTranslation();
  const todayKey = localDayKey(new Date());
  const years = useMemo(() => {
    const found = new Set(Object.keys(overview.days).map((key) => Number(key.slice(0, 4))));
    found.add(Number(todayKey.slice(0, 4)));
    return [...found].filter((year) => Number.isFinite(year)).sort((left, right) => right - left);
  }, [overview.days, todayKey]);
  const [selection, setSelection] = useState<"recent" | number>("recent");
  const range = heatmapRange(selection, todayKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const grid = useMemo(
    () => buildHeatmapGrid(overview.days, range.start, range.end),
    [overview.days, range.start, range.end],
  );
  const columns = `repeat(${Math.max(1, grid.weeks.length)}, minmax(0, 1fr))`;
  // On narrow screens the grid scrolls; start at the newest weeks.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [range.start, range.end]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" }), []);
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }),
    [],
  );

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <SectionTitle>
          {t("chatInsights.activity.heatmap", { count: grid.total, value: grid.total.toLocaleString() })}
        </SectionTitle>
        <Select
          value={String(selection)}
          onChange={(next) => setSelection(next === "recent" ? "recent" : Number(next))}
          label={t("chatInsights.activity.range")}
          className="mb-2 ml-auto h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          options={[
            { value: "recent", label: t("chatInsights.activity.lastYear") },
            ...years.map((year) => ({ value: String(year), label: String(year) })),
          ]}
        />
      </div>
      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-3"
      >
        <div className="flex min-w-[34rem] flex-col gap-1">
          <div
            className="grid h-3.5 text-[0.625rem] leading-none text-[var(--muted-foreground)]"
            style={{ gridTemplateColumns: columns, columnGap: "0.1875rem" }}
          >
            {grid.months
              .filter((month, index, months) => (months[index + 1]?.week ?? Infinity) - month.week >= 3)
              .map((month) => (
                <span
                  key={`${month.year}-${month.month}`}
                  className="whitespace-nowrap"
                  style={{ gridColumn: `${month.week + 1} / span 3`, gridRow: 1 }}
                >
                  {monthFormatter.format(new Date(Date.UTC(month.year, month.month, 1)))}
                </span>
              ))}
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: columns,
              gridTemplateRows: "repeat(7, auto)",
              gridAutoFlow: "column",
              gap: "0.1875rem",
            }}
            role="img"
            aria-label={t("chatInsights.activity.heatmapLabel", { count: grid.activeDays })}
          >
            {grid.weeks.flat().map((cell) => (
              <div
                key={cell.date}
                className={cn(
                  "aspect-square w-full rounded-[0.125rem]",
                  cell.outside ? "bg-transparent" : LEVEL_CLASSES[cell.level],
                )}
                title={
                  cell.outside
                    ? undefined
                    : t("chatInsights.activity.cellTooltip", {
                        count: cell.count,
                        date: dayFormatter.format(new Date(`${cell.date}T00:00:00Z`)),
                      })
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
        {t("chatInsights.activity.less")}
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} className={cn("h-[0.6875rem] w-[0.6875rem] rounded-[0.125rem]", LEVEL_CLASSES[level])} />
        ))}
        {t("chatInsights.activity.more")}
      </div>
    </section>
  );
}

function ActivityBody({ overview, onOpenChat }: { overview: ActivityOverview; onOpenChat: (chatId: string) => void }) {
  const { t } = useTranslation();
  const number = (value: number) => value.toLocaleString();

  if (overview.totalMessages === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">{t("chatInsights.activity.empty")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label={t("chatInsights.stats.messages")}
          value={number(overview.totalMessages)}
          hint={t("chatInsights.activity.wordsHint", {
            count: overview.totalWords,
            value: overview.totalWords.toLocaleString(),
          })}
        />
        <StatTile
          label={t("chatInsights.stats.playTime")}
          value={formatPlayDuration(overview.playTime.totalMs)}
          hint={t("chatInsights.stats.sittings", {
            count: overview.playTime.sittings,
            value: overview.playTime.sittings.toLocaleString(),
          })}
        />
        <StatTile
          label={t("chatInsights.stats.activeDays")}
          value={number(overview.activeDays)}
          hint={t("chatInsights.activity.chatsHint", {
            count: overview.activeChats,
            value: overview.activeChats.toLocaleString(),
          })}
        />
        <StatTile
          label={t("chatInsights.activity.streak")}
          value={t("chatInsights.activity.days", { count: overview.currentStreakDays })}
          hint={t("chatInsights.activity.longestStreak", { count: overview.longestStreakDays })}
        />
      </div>

      <ActivityHeatmap overview={overview} />

      {overview.topChats.length > 0 ? (
        <section>
          <SectionTitle>{t("chatInsights.activity.topChats")}</SectionTitle>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]">
            {overview.topChats.map((chat) => (
              <li key={chat.chatId}>
                <button
                  type="button"
                  onClick={() => onOpenChat(chat.chatId)}
                  className="flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--foreground)]">{chat.chatName}</span>
                    <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
                      {t(`chatInsights.mode.${chat.chatMode}`)}
                      {" · "}
                      {t("chatInsights.activity.messagesCount", {
                        count: chat.messages,
                        value: chat.messages.toLocaleString(),
                      })}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {formatPlayDuration(chat.playTimeMs)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("chatInsights.playTimeNote")}</p>
    </div>
  );
}

export function ActivityOverviewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const activity = useActivityOverview(open);

  return (
    <Modal open={open} onClose={onClose} title={t("chatInsights.activity.title")} width="max-w-2xl" mobileFullscreen>
      {activity.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted-foreground)]">
          <Spinner size="sm" />
          {t("chatInsights.activity.loading")}
        </div>
      ) : activity.isError || !activity.data ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-[var(--muted-foreground)]">
          <p>{t("chatInsights.activity.failed")}</p>
          <button
            type="button"
            onClick={() => void activity.refetch()}
            className="mari-chrome-control mari-chrome-control--small px-3"
          >
            {t("chatInsights.tryAgain")}
          </button>
        </div>
      ) : (
        <ActivityBody
          overview={activity.data}
          onOpenChat={(chatId) => {
            onClose();
            openChatAtMessage(chatId);
          }}
        />
      )}
    </Modal>
  );
}
