import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function HomeClockCalendar() {
  const { i18n, t } = useTranslation();
  const timeZone = useUIStore((state) => state.conversationTimeZone);
  const [now, setNow] = useState(() => new Date());
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  const formatters = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZone,
      }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }),
      month: new Intl.DateTimeFormat(locale, { month: "short", timeZone }),
      day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone }),
      date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone }),
    }),
    [locale, timeZone],
  );

  useEffect(() => {
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      setNow(new Date());
      if (!document.hidden) timer = window.setInterval(() => setNow(new Date()), 1_000);
    };
    const handleVisibilityChange = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const timeParts = formatters.time.formatToParts(now);
  const hour = part(timeParts, "hour");
  const minute = part(timeParts, "minute");
  const second = part(timeParts, "second");
  const dayPeriod = part(timeParts, "dayPeriod");
  const spokenTime = formatters.time.format(now);
  const spokenDate = formatters.date.format(now);

  return (
    <section
      data-component="HomeClockCalendar"
      data-time-zone={timeZone}
      aria-label={t("home.clock.accessibleLabel", { date: spokenDate, time: spokenTime, timeZone })}
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,oklch(0.79_0.16_205)_42%,var(--border))] bg-[color-mix(in_srgb,oklch(0.79_0.16_205)_8%,var(--card))] p-4 shadow-[0_18px_44px_-34px_oklch(0.79_0.16_205/0.9)]"
    >
      <span
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full border border-[color-mix(in_srgb,oklch(0.73_0.21_345)_20%,transparent)]"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -right-2 top-8 h-20 w-20 rounded-full border border-[color-mix(in_srgb,oklch(0.76_0.19_52)_22%,transparent)]"
        aria-hidden="true"
      />

      <header className="relative z-[1] flex items-center gap-2.5 pr-7">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_srgb,oklch(0.79_0.16_205)_44%,var(--border))] bg-[color-mix(in_srgb,oklch(0.79_0.16_205)_15%,var(--card))] text-[oklch(0.79_0.16_205)]"
          data-clock-accent-reference
        >
          <Clock3 size="1rem" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span
            className="block text-[0.62rem] font-black uppercase tracking-[0.18em] text-[oklch(0.79_0.16_205)]"
            data-clock-eyebrow
          >
            {t("home.clock.eyebrow")}
          </span>
          <span className="block truncate text-sm font-bold text-[var(--foreground)]">{t("home.clock.title")}</span>
        </span>
      </header>

      <div className="relative z-[1] mt-2 flex min-h-0 flex-1 items-center justify-between gap-3">
        <div className="min-w-0">
          <time dateTime={now.toISOString()} className="flex items-baseline tabular-nums" data-clock-time>
            <span className="text-[clamp(2rem,3.3vw,3.3rem)] font-black leading-none tracking-[-0.07em] text-[var(--foreground)]">
              {hour}:{minute}
            </span>
            <span
              className="ml-1 text-[0.68rem] font-bold text-[oklch(0.79_0.16_205)]"
              data-clock-seconds
            >
              :{second}
            </span>
            {dayPeriod ? (
              <span className="ml-1 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                {dayPeriod}
              </span>
            ) : null}
          </time>
          <p className="mt-1 truncate text-xs font-semibold capitalize text-[var(--muted-foreground)]">
            {formatters.weekday.format(now)}
          </p>
        </div>

        <time
          dateTime={now.toISOString()}
          aria-label={spokenDate}
          className="flex w-[4.4rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,oklch(0.79_0.16_205)_46%,var(--border))] bg-[var(--card)] text-center shadow-[0_12px_26px_-20px_oklch(0.79_0.16_205/0.9)]"
          data-calendar-date
        >
          <span
            className="bg-[color-mix(in_srgb,oklch(0.79_0.16_205)_20%,var(--card))] px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.16em] text-[oklch(0.79_0.16_205)]"
            data-calendar-accent
          >
            {formatters.month.format(now)}
          </span>
          <span className="py-1.5 text-[1.65rem] font-black leading-none tabular-nums text-[var(--foreground)]">
            {formatters.day.format(now)}
          </span>
        </time>
      </div>

      <footer className="relative z-[1] mt-2 flex min-w-0 items-center gap-1.5 border-t border-[var(--border)]/55 pt-2 text-[0.58rem] font-semibold text-[var(--muted-foreground)]">
        <MapPin size="0.72rem" className="shrink-0 text-[oklch(0.79_0.16_205)]" aria-hidden="true" />
        <span className="truncate" title={timeZone}>
          {timeZone}
        </span>
        <CalendarDays
          size="0.72rem"
          className="ml-auto shrink-0 text-[oklch(0.79_0.16_205)]"
          data-calendar-icon
          aria-hidden="true"
        />
      </footer>
    </section>
  );
}
