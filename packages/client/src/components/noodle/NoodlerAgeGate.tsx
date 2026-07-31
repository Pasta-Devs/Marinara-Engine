// NoodleR enable/verification surface: a plain explainer, then the joke "age verification".
// The explainer runs first because this modal is the opt-in — the user has to be able to learn
// what NoodleR is, and back out, before `enableNoodler` is written.
// The card itself is purely presentational: no real input is collected — it fills itself — so
// there is zero PII and nothing to validate.
import { Check, CreditCard, Loader2, Lock, Sparkles, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";

interface Props {
  personaName: string;
  onComplete: () => void;
  onSkip: () => void;
  /** Leaves without opting in. The explainer is the only screen that offers this. */
  onDismiss: () => void;
  isPending: boolean;
}

// Skip the theatrics for reduced-motion users: land the card in its finished state immediately
// so nobody is trapped waiting on an animation to unlock the button.
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const CARD_NUMBER = "5309 1312 4200 6969";

export function NoodlerAgeGate({ personaName, onComplete, onSkip, onDismiss, isPending }: Props) {
  const { t } = useUiTranslation();
  const tt = (key: string, fallback: string) => t(`ui.noodle.agegate.${key}`, fallback);
  const reducedMotion = usePrefersReducedMotion();
  const displayName = personaName.trim() || tt("anonymousAdult", "A. Nonymous");
  const [explained, setExplained] = useState(false);

  const [typed, setTyped] = useState(reducedMotion ? CARD_NUMBER.length : 0);
  const [charged, setCharged] = useState(reducedMotion);
  const [chargeAmount, setChargeAmount] = useState("9.99");
  const [confetti, setConfetti] = useState(false);
  const chargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Both animations wait for the explainer to be dismissed: the charge gag is the payoff, and
  // running it behind a screen the user is still reading spends it on nobody.
  useEffect(() => {
    if (reducedMotion || !explained) return;
    const interval = setInterval(() => {
      setTyped((n) => {
        if (n >= CARD_NUMBER.length) {
          clearInterval(interval);
          chargeTimer.current = setTimeout(() => setCharged(true), 900);
          return n;
        }
        return n + 1;
      });
    }, 90);
    return () => {
      clearInterval(interval);
      if (chargeTimer.current) clearTimeout(chargeTimer.current);
    };
  }, [explained, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || charged || !explained) return;
    const interval = setInterval(() => {
      setChargeAmount((Math.floor(Math.random() * 99_999) + 1).toString().padStart(3, "0").replace(/(..)$/, ".$1"));
    }, 110);
    return () => clearInterval(interval);
  }, [charged, explained, reducedMotion]);

  const shownNumber = CARD_NUMBER.slice(0, typed).padEnd(CARD_NUMBER.length, "•");

  const enter = () => {
    setConfetti(true);
    if (reducedMotion) {
      onComplete();
      return;
    }
    setTimeout(onComplete, 900);
  };

  if (!explained) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="text-center">
          <h2 className="text-lg font-black">{t("ui.noodle.noodlerwizard.intro.what.title")}</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerwizard.intro.what.help")}
          </p>
        </div>

        <ul className="space-y-2.5">
          {[
            { icon: <Users size={15} />, key: "noodle" },
            { icon: <Lock size={15} />, key: "noodler" },
            { icon: <Sparkles size={15} />, key: "you" },
          ].map((row) => (
            <li
              key={row.key}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm leading-6"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]">
                {row.icon}
              </span>
              <span>{t(`ui.noodle.noodlerwizard.intro.what.${row.key}`)}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setExplained(true)}
          className="h-12 rounded-md bg-[var(--noodle-accent)] text-base font-black uppercase tracking-wide text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90"
        >
          {tt("explainerContinue", "Got it, continue")}
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="mx-auto text-xs font-semibold text-[var(--muted-foreground)] underline-offset-4 hover:underline"
        >
          {tt("notNow", "Not now — take me back")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-5">
      <GateStyles />
      {confetti && <Confetti />}
      <div className="text-center">
        <h2 className="text-lg font-black">{tt("cardTitle", "Confirm you're an adult with a credit card")}</h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {tt("cardSub", "We fill it in for you. Don't worry about it.")}
        </p>
      </div>

      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 text-zinc-100 shadow-lg">
        <div className="flex items-center justify-between">
          <CreditCard size={26} className="text-[var(--noodle-accent)]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            {tt("cardBrand", "Pastapay")}
          </span>
        </div>
        <p className="mt-6 font-mono text-lg tracking-[0.15em]">{shownNumber}</p>
        <div className="mt-4 flex items-end justify-between text-xs">
          <div>
            <p className="text-[0.55rem] uppercase text-zinc-400">{tt("cardHolder", "Card Holder")}</p>
            <p className="font-semibold uppercase">{displayName}</p>
          </div>
          <div>
            <p className="text-[0.55rem] uppercase text-zinc-400">{tt("cardExp", "Expires")}</p>
            <p className="font-semibold">12 / 34</p>
          </div>
          <div>
            <p className="text-[0.55rem] uppercase text-zinc-400">{tt("cardCvv", "CVV")}</p>
            <p className="font-semibold">🍆</p>
          </div>
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-[var(--muted-foreground)]">
        {charged ? (
          <>
            <Check size={13} className="text-emerald-500" />
            {tt("cardFree", "Charged $0.00 — it's free, we can't afford servers.")}
          </>
        ) : (
          <>
            <Loader2 size={13} className="animate-spin" />
            {t("ui.noodle.agegate.cardCharging", {
              amount: chargeAmount,
              defaultValue: "Charging ${{amount}}...",
            })}
          </>
        )}
      </p>

      <button
        type="button"
        onClick={enter}
        disabled={!charged || isPending}
        className="h-12 rounded-md bg-[var(--noodle-accent)] text-base font-black uppercase tracking-wide text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? <Loader2 size={18} className="mx-auto animate-spin" /> : tt("enter", "Enter NoodleR")}
      </button>

      <button
        type="button"
        onClick={onSkip}
        disabled={isPending}
        className="mx-auto text-xs font-semibold text-[var(--muted-foreground)] underline-offset-4 hover:underline disabled:opacity-50"
      >
        {tt("skipTheGate", "Skip the joke and enter NoodleR")}
      </button>
    </div>
  );
}

function Confetti() {
  // Randomized positions computed in an effect (Math.random is impure — can't run during render).
  const [pieces, setPieces] = useState<Array<{ left: string; delay: string; hue: number }>>([]);
  useEffect(() => {
    setPieces(
      Array.from({ length: 24 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.3}s`,
        hue: (i * 37) % 360,
      })),
    );
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="agegate-confetti"
          style={{ left: p.left, animationDelay: p.delay, background: `hsl(${p.hue} 90% 60%)` }}
        />
      ))}
    </div>
  );
}

// Component-scoped keyframes: no existing confetti animation in globals.css, and a confetti
// dependency would blow the bundle budget for a joke screen.
function GateStyles() {
  return (
    <style>{`
      .agegate-confetti {
        position: absolute; top: -10px; width: 8px; height: 8px; border-radius: 1px;
        animation: agegate-fall 1s ease-in forwards;
      }
      @keyframes agegate-fall {
        to { transform: translateY(360px) rotate(540deg); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .agegate-confetti { animation: none; }
      }
    `}</style>
  );
}
