import { useEffect, useRef, useState } from "react";
import { Check, LifeBuoy, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { MarinaraWordmark } from "../ui/MarinaraWordmark";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_QUIET } from "../ui/neutral-surface-styles";
import { probeServerHealth } from "../../hooks/use-server-restart";
import { nextRestartStep, type RestartStep } from "../../lib/server-restart";
import { reloadBrowser } from "../../lib/browser-runtime";
import { cn } from "../../lib/utils";

const SLOW_AFTER_MS = 60_000;
const TROUBLESHOOTING_URL = "https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/TROUBLESHOOTING.md";
const STEPS: RestartStep[] = ["stopping", "starting", "back"];
const TITLE_KEYS = {
  restarting: "settings.serverRestart.sheet.title.restarting",
  slow: "settings.serverRestart.sheet.title.slow",
  back: "settings.serverRestart.sheet.title.back",
} as const;
const STEP_KEYS = {
  stopping: "settings.serverRestart.sheet.step.stopping",
  starting: "settings.serverRestart.sheet.step.starting",
  back: "settings.serverRestart.sheet.step.back",
} as const;

function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Blocks the app while the server restarts, then reloads the page on the new process. */
export function ServerRestartModal({ open, beforeBootId }: { open: boolean; beforeBootId?: string }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<RestartStep>("stopping");
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(now);
  const stepStartedAt = useRef<Record<RestartStep, number | null>>({ stopping: now, starting: null, back: null });

  useEffect(() => {
    if (step === "back") {
      const reload = window.setTimeout(() => reloadBrowser("server-restart"), 800);
      return () => window.clearTimeout(reload);
    }
    // Opened at the click: probe only once the restart request answered.
    if (beforeBootId === undefined) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        const next = nextRestartStep(step, await probeServerHealth());
        if (cancelled) return;
        if (next !== step) {
          stepStartedAt.current[next] ??= Date.now();
          // A fast restart can go straight from stopping to back.
          if (next === "back") stepStartedAt.current.starting ??= Date.now();
          setStep(next);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [beforeBootId, step]);

  // The clock runs from the click, also while the restart request is still pending.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const slow = step !== "back" && now - startedAt.current > SLOW_AFTER_MS;
  const phase = step === "back" ? "back" : slow ? "slow" : "restarting";
  const activeIndex = STEPS.indexOf(step);

  const stepMeta = (index: number) => {
    const from = stepStartedAt.current[STEPS[index]!];
    if (from === null || index === STEPS.length - 1) return null;
    const until = index < activeIndex ? stepStartedAt.current[STEPS[index + 1]!] : now;
    return formatElapsed((until ?? now) - from);
  };

  return (
    <Modal
      open={open}
      onClose={() => {}}
      title={t(TITLE_KEYS[phase])}
      width="max-w-md"
      closeDisabled
      pullToClose={false}
      hideHeader
      instantBackdrop
      footer={
        slow ? (
          <>
            <button
              type="button"
              className={cn(SHEET_BUTTON_PRIMARY, "inline-flex items-center justify-center gap-1.5")}
              onClick={() => reloadBrowser("server-restart")}
            >
              <RotateCw size="0.95rem" aria-hidden="true" />
              {t("settings.serverRestart.sheet.reload")}
            </button>
            <a
              href={TROUBLESHOOTING_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(SHEET_BUTTON_QUIET, "inline-flex items-center justify-center gap-1.5")}
            >
              <LifeBuoy size="0.95rem" aria-hidden="true" />
              {t("settings.serverRestart.sheet.troubleshooting")}
            </a>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 pb-1">
        <div className="flex flex-col items-center pt-1 text-center">
          <img src="/logo.png" alt="" aria-hidden="true" className="mb-1 h-[2.35rem] w-auto object-contain" />
          <MarinaraWordmark className="text-[1.35rem] leading-none" />
          <span className="mt-1 block text-[0.5625rem] font-semibold tracking-[0.14em] text-[var(--muted-foreground)]">
            {t("home.browser.version", { version: APP_VERSION })}
          </span>
        </div>
        <p role="status" className="sr-only">
          {t(TITLE_KEYS[phase])}
        </p>
        {phase === "slow" && (
          <p className="text-center text-xs leading-relaxed text-[var(--muted-foreground)]">
            {t("settings.serverRestart.sheet.description.slow")}
          </p>
        )}
        <ol className="flex flex-col gap-0.5 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] p-1.5">
          {STEPS.map((item, index) => {
            const done = index < activeIndex || step === "back";
            const current = index === activeIndex && step !== "back";
            const meta = stepMeta(index);
            return (
              <li
                key={item}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm",
                  current && "bg-[var(--accent)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                    done && "bg-[var(--primary)] text-[var(--primary-foreground)]",
                    current && "border-2 border-[var(--primary)]",
                    !done && !current && "border-2 border-[var(--border)]",
                  )}
                >
                  {done ? (
                    <Check size="0.75rem" strokeWidth={3} />
                  ) : current ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)] motion-reduce:animate-none" />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "flex-1 truncate",
                    current
                      ? "font-semibold text-[var(--foreground)]"
                      : done
                        ? "text-[var(--foreground)]"
                        : "text-[var(--muted-foreground)]",
                  )}
                >
                  {t(item === "starting" && slow ? "settings.serverRestart.sheet.step.startingSlow" : STEP_KEYS[item])}
                </span>
                {meta && <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{meta}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </Modal>
  );
}
