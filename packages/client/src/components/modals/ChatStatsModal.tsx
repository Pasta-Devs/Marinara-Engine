import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ChatStats } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { useChatStats } from "../../hooks/use-chat-insights";
import { openChatAtMessage } from "../../lib/chat-insights";
import { formatPlayDuration } from "../../lib/chat-insights-display";
import { Spinner } from "../ui/Spinner";

const DAY_CHART_LIMIT = 60;

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-3 py-2.5">
      <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold tabular-nums text-[var(--foreground)]">{value}</div>
      {hint ? <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">{hint}</div> : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
      {children}
    </h3>
  );
}

function formatDay(value: string | null, options: Intl.DateTimeFormatOptions): string {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, options);
}

function ChatStatsBody({ stats, onJump }: { stats: ChatStats; onJump: (messageNumber: number) => void }) {
  const { t } = useTranslation();
  const number = (value: number) => value.toLocaleString();
  const maxSpeakerWords = Math.max(1, ...stats.speakers.map((speaker) => speaker.words));
  const recentDays = stats.messagesPerDay.slice(-DAY_CHART_LIMIT);
  const maxDay = Math.max(1, ...recentDays.map((day) => day.count));
  const busiest = useMemo(
    () =>
      stats.messagesPerDay.reduce<ChatStats["messagesPerDay"][number] | null>(
        (best, day) => (!best || day.count > best.count ? day : best),
        null,
      ),
    [stats.messagesPerDay],
  );
  const range =
    stats.firstMessageAt && stats.lastMessageAt
      ? t("chatInsights.stats.range", {
          from: formatDay(stats.firstMessageAt, { year: "numeric", month: "short", day: "numeric" }),
          to: formatDay(stats.lastMessageAt, { year: "numeric", month: "short", day: "numeric" }),
        })
      : "";

  if (stats.totalMessages === 0) {
    return <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">{t("chatInsights.stats.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {range ? <p className="-mt-1 text-xs text-[var(--muted-foreground)]">{range}</p> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label={t("chatInsights.stats.messages")} value={number(stats.totalMessages)} />
        <StatTile label={t("chatInsights.stats.words")} value={number(stats.totalWords)} />
        <StatTile
          label={t("chatInsights.stats.playTime")}
          value={formatPlayDuration(stats.playTime.totalMs)}
          hint={t("chatInsights.stats.sittings", {
            count: stats.playTime.sittings,
            value: stats.playTime.sittings.toLocaleString(),
          })}
        />
        <StatTile
          label={t("chatInsights.stats.activeDays")}
          value={number(stats.activeDays)}
          hint={
            busiest
              ? t("chatInsights.stats.busiest", { date: formatDay(busiest.date, { month: "short", day: "numeric" }) })
              : undefined
          }
        />
        <StatTile
          label={t("chatInsights.stats.averageReply")}
          value={t("chatInsights.stats.wordsValue", {
            count: stats.averageReplyWords,
            value: stats.averageReplyWords.toLocaleString(),
          })}
        />
        <StatTile
          label={t("chatInsights.stats.averageUser")}
          value={t("chatInsights.stats.wordsValue", {
            count: stats.averageUserWords,
            value: stats.averageUserWords.toLocaleString(),
          })}
        />
        <StatTile
          label={t("chatInsights.stats.longestSitting")}
          value={formatPlayDuration(stats.playTime.longestSittingMs)}
        />
        <StatTile
          label={t("chatInsights.stats.tokens")}
          value={stats.tokens.messagesWithUsage > 0 ? number(stats.tokens.total) : "-"}
          hint={
            stats.tokens.messagesWithUsage > 0
              ? t("chatInsights.stats.tokenSplit", {
                  prompt: number(stats.tokens.prompt),
                  completion: number(stats.tokens.completion),
                })
              : t("chatInsights.stats.noTokens")
          }
        />
      </div>

      <section>
        <SectionTitle>{t("chatInsights.stats.bySpeaker")}</SectionTitle>
        <ul className="flex flex-col gap-2">
          {stats.speakers.map((speaker) => (
            <li key={speaker.key} className="min-w-0">
              <div className="flex min-w-0 items-baseline gap-2 text-xs">
                <span className="truncate font-medium text-[var(--foreground)]">{speaker.name}</span>
                <span className="ml-auto shrink-0 tabular-nums text-[var(--muted-foreground)]">
                  {t("chatInsights.stats.speakerLine", {
                    words: number(speaker.words),
                    messages: number(speaker.messages),
                    average: number(speaker.averageWords),
                  })}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--foreground)]/8">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.max(2, (speaker.words / maxSpeakerWords) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>
          {stats.messagesPerDay.length > DAY_CHART_LIMIT
            ? t("chatInsights.stats.perDayRecent", { count: DAY_CHART_LIMIT })
            : t("chatInsights.stats.perDay")}
        </SectionTitle>
        <div
          className="flex h-20 items-end gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-2"
          role="img"
          aria-label={t("chatInsights.stats.perDayLabel", { count: stats.activeDays })}
        >
          {recentDays.map((day) => (
            <div
              key={day.date}
              className="min-w-[2px] flex-1 rounded-t-sm bg-[var(--primary)]/70 hover:bg-[var(--primary)]"
              style={{ height: `${Math.max(6, (day.count / maxDay) * 100)}%` }}
              title={t("chatInsights.stats.dayTooltip", {
                date: formatDay(day.date, { year: "numeric", month: "short", day: "numeric" }),
                count: day.count,
              })}
            />
          ))}
        </div>
      </section>

      {stats.longestMessage ? (
        <section>
          <SectionTitle>{t("chatInsights.stats.longestMessage")}</SectionTitle>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-3">
            <div className="flex min-w-0 items-baseline gap-2 text-xs">
              <span className="truncate font-medium text-[var(--foreground)]">{stats.longestMessage.speaker}</span>
              <span className="shrink-0 text-[var(--muted-foreground)]">
                {t("chatInsights.stats.wordsValue", {
                  count: stats.longestMessage.words,
                  value: stats.longestMessage.words.toLocaleString(),
                })}
              </span>
              <button
                type="button"
                onClick={() => onJump(stats.longestMessage!.messageNumber)}
                className="ml-auto shrink-0 text-xs font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
              >
                {t("chatInsights.stats.jump")}
              </button>
            </div>
            <p className="mt-1.5 line-clamp-3 break-words text-sm leading-5 text-[var(--foreground)]">
              {stats.longestMessage.preview}
            </p>
          </div>
        </section>
      ) : null}

      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("chatInsights.playTimeNote")}</p>
    </div>
  );
}

export function ChatStatsModal({ open, onClose, chatId }: { open: boolean; onClose: () => void; chatId: string }) {
  const { t } = useTranslation();
  const stats = useChatStats(chatId, open);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        stats.data?.chatName
          ? t("chatInsights.stats.titleFor", { name: stats.data.chatName })
          : t("chatInsights.stats.title")
      }
      width="max-w-2xl"
      mobileFullscreen
    >
      {stats.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted-foreground)]">
          <Spinner size="sm" />
          {t("chatInsights.loading")}
        </div>
      ) : stats.isError || !stats.data ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-[var(--muted-foreground)]">
          <p>{t("chatInsights.stats.failed")}</p>
          <button
            type="button"
            onClick={() => void stats.refetch()}
            className="mari-chrome-control mari-chrome-control--small px-3"
          >
            {t("chatInsights.tryAgain")}
          </button>
        </div>
      ) : (
        <ChatStatsBody
          stats={stats.data}
          onJump={(messageNumber) => {
            onClose();
            openChatAtMessage(chatId, messageNumber);
          }}
        />
      )}
    </Modal>
  );
}
