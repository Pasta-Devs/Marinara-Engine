// Joke "age verification" gate shown on the NoodleR enable/verification surface.
// Purely presentational: both paths (entering OR skipping) call the same enable action passed
// in from NoodlerHome. No real input is collected — the card fills itself — so there is zero
// PII and nothing to validate.
import { Check, CreditCard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";

interface Props {
  personaName: string;
  onComplete: () => void;
  onSkip: () => void;
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

export function NoodlerAgeGate({ personaName, onComplete, onSkip, isPending }: Props) {
  const { t } = useUiTranslation();
  const tt = (key: string, fallback: string) => t(`ui.noodle.agegate.${key}`, fallback);
  const reducedMotion = usePrefersReducedMotion();
  const displayName = personaName.trim() || tt("anonymousAdult", "A. Nonymous");

  const [typed, setTyped] = useState(reducedMotion ? CARD_NUMBER.length : 0);
  const [charged, setCharged] = useState(reducedMotion);
  const [confetti, setConfetti] = useState(false);
  const chargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
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
  }, [reducedMotion]);

  const shownNumber = CARD_NUMBER.slice(0, typed).padEnd(CARD_NUMBER.length, "•");

  const enter = () => {
    setConfetti(true);
    if (reducedMotion) {
      onComplete();
      return;
    }
    setTimeout(onComplete, 900);
  };

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
            {tt("cardCharging", "Charging $0.00…")}
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
        {tt("skipTheGate", "Skip the joke and continue")}
      </button>
      <p className="text-center text-xs leading-5 text-[var(--muted-foreground)]">
        {tt("privacyNote", "This is only a joke. No ID, card, or personal information is collected.")}
      </p>
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
