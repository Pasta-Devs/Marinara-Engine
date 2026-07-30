// Joke "age verification" gate shown on the NoodleR enable/verification surface.
// Purely presentational: every path (finishing the gag steps OR skipping) calls the
// same enable action passed in from NoodlerHome. No real input is collected — the ID
// and credit-card fields fill themselves — so there is zero PII and nothing to validate.
import { BadgeCheck, Check, CreditCard, Loader2, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

interface Props {
  personaName: string;
  avatarUrl: string | null;
  onComplete: () => void;
  onSkip: () => void;
  isPending: boolean;
}

// Skip the theatrics for reduced-motion / coarse-pointer users: land each step in its
// finished state immediately so nobody is trapped waiting on an animation to advance.
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

export function NoodlerAgeGate({ personaName, avatarUrl, onComplete, onSkip, isPending }: Props) {
  const { t } = useUiTranslation();
  const tt = (key: string, fallback: string) => t(`ui.noodle.agegate.${key}`, fallback);
  const reducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const displayName = personaName.trim() || tt("anonymousAdult", "A. Nonymous");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8 sm:py-12">
      <GateStyles />
      <ProgressDots step={step} total={3} />
      <p className="text-center text-xs leading-5 text-[var(--muted-foreground)]">
        {tt("privacyNote", "This is only a joke. No ID, card, or personal information is collected.")}
      </p>

      {step === 0 && (
        <IdStep
          tt={tt}
          displayName={displayName}
          avatarUrl={avatarUrl}
          reducedMotion={reducedMotion}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <CardStep
          tt={tt}
          displayName={displayName}
          reducedMotion={reducedMotion}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <OathStep
          tt={tt}
          reducedMotion={reducedMotion}
          isPending={isPending}
          onBack={() => setStep(1)}
          onComplete={onComplete}
        />
      )}

      <button
        type="button"
        onClick={onSkip}
        disabled={isPending}
        className="mx-auto text-xs font-semibold text-[var(--muted-foreground)] underline-offset-4 hover:underline disabled:opacity-50"
      >
        {tt("skipTheGate", "Skip the joke and continue")}
      </button>
    </div>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === step ? "w-6 bg-[var(--noodle-accent)]" : "w-1.5 bg-[var(--noodle-accent)]/30",
          )}
        />
      ))}
    </div>
  );
}

function StepButtons({
  tt,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  tt: (k: string, f: string) => string;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="h-11 flex-1 rounded-md border border-[var(--noodle-divider)] px-4 text-sm font-bold hover:bg-[var(--accent)]"
        >
          {tt("back", "Back")}
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="h-11 flex-[2] rounded-md bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function IdStep({
  tt,
  displayName,
  avatarUrl,
  reducedMotion,
  onNext,
}: {
  tt: (k: string, f: string) => string;
  displayName: string;
  avatarUrl: string | null;
  reducedMotion: boolean;
  onNext: () => void;
}) {
  const [scanned, setScanned] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => setScanned(true), 2200);
    return () => clearTimeout(timer);
  }, [reducedMotion]);
  // Math.random can't run during render (react-hooks/purity), so seed the gag ID number once on mount.
  const [idNumber, setIdNumber] = useState("000000000");
  useEffect(() => setIdNumber(Math.floor(100_000_000 + Math.random() * 899_999_999).toString()), []);

  const rows: Array<[string, string]> = [
    [tt("idDob", "DOB"), "01 / 01 / 1901"],
    [tt("idSex", "SEX"), tt("idSexValue", "yes")],
    [tt("idEyes", "EYES"), tt("idEyesValue", "bedroom")],
    [tt("idHeight", "HEIGHT"), tt("idHeightValue", "6'2\" (lying)")],
    [tt("idExpires", "EXPIRES"), tt("idExpiresValue", "never")],
    [tt("idClass", "CLASS"), tt("idClassValue", "A+ Adult")],
  ];

  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        title={tt("idTitle", "Verifying government ID")}
        sub={tt("idSub", "Please hold still for the scanner.")}
      />
      <div className="relative overflow-hidden rounded-xl border border-[var(--noodle-accent)]/40 bg-gradient-to-br from-[var(--noodle-accent)]/10 to-transparent p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="h-20 w-16 flex-none overflow-hidden rounded-md border border-[var(--noodle-accent)]/40 bg-[var(--noodle-accent)]/10">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">🕶️</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--noodle-accent)]">
              {tt("idHeader", "Marinara Republic · Adult ID")}
            </p>
            <p className="truncate text-base font-black">{displayName}</p>
            <p className="text-[0.65rem] text-[var(--muted-foreground)]">
              {tt("idNo", "ID NO.")} {idNumber}
            </p>
            <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[0.65rem]">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-1">
                  <dt className="text-[var(--muted-foreground)]">{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        {!scanned && !reducedMotion && <span className="agegate-scanline" aria-hidden="true" />}
        {scanned && (
          <span className="absolute right-3 top-3 flex rotate-[-12deg] items-center gap-1 rounded-md border-2 border-emerald-500 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-emerald-500">
            <BadgeCheck size={12} /> {tt("verified", "Verified")}
          </span>
        )}
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--muted-foreground)]">
        <ScanLine size={13} />
        {scanned ? tt("idDone", "Identity confirmed. Definitely an adult.") : tt("idScanning", "Scanning biometrics…")}
      </p>
      <StepButtons tt={tt} onNext={onNext} nextDisabled={!scanned} nextLabel={tt("continue", "Continue")} />
    </div>
  );
}

const CARD_NUMBER = "5309 1312 4200 6969";

function CardStep({
  tt,
  displayName,
  reducedMotion,
  onBack,
  onNext,
}: {
  tt: (k: string, f: string) => string;
  displayName: string;
  reducedMotion: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const [typed, setTyped] = useState(reducedMotion ? CARD_NUMBER.length : 0);
  const [charged, setCharged] = useState(reducedMotion);
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

  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        title={tt("cardTitle", "Confirm you're an adult with a credit card")}
        sub={tt("cardSub", "We fill it in for you. Don't worry about it.")}
      />
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
      <StepButtons
        tt={tt}
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!charged}
        nextLabel={tt("continue", "Continue")}
      />
    </div>
  );
}

function OathStep({
  tt,
  reducedMotion,
  isPending,
  onBack,
  onComplete,
}: {
  tt: (k: string, f: string) => string;
  reducedMotion: boolean;
  isPending: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [checked, setChecked] = useState(false);
  // Coarse pointers start dodged so the synthesized mouse events a tap fires cannot flee.
  const [dodged, setDodged] = useState(
    () => reducedMotion || (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches),
  ); // once true, the box stays catchable
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [confetti, setConfetti] = useState(false);

  // Desktop-only gag: the box scoots away from the pointer the first time. On touch we skip
  // the dodge entirely (dodged starts true) so the first tap always lands.
  const flee = () => {
    if (dodged) return;
    setOffset({ x: Math.random() > 0.5 ? 90 : -90, y: -12 });
    setDodged(true);
  };

  const enter = () => {
    setConfetti(true);
    if (reducedMotion) {
      onComplete();
      return;
    }
    setTimeout(onComplete, 900);
  };

  return (
    <div className="relative flex flex-col gap-6">
      {confetti && <Confetti />}
      <StepHeading title={tt("oathTitle", "Take the adult oath")} sub={tt("oathSub", "One last tiny box.")} />
      <div className="flex min-h-16 items-center justify-center">
        <label
          onMouseEnter={flee}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--noodle-divider)] bg-[var(--background)] px-4 py-3 text-sm font-semibold transition-transform duration-200"
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              setDodged(true);
              setChecked(e.target.checked);
            }}
            className="h-4 w-4 accent-[var(--noodle-accent)]"
          />
          {tt("oathCheckbox", "I solemnly swear I am 18+ (and up to no good)")}
        </label>
      </div>
      <button
        type="button"
        onClick={enter}
        disabled={!checked || isPending}
        className="h-12 rounded-md bg-[var(--noodle-accent)] text-base font-black uppercase tracking-wide text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? <Loader2 size={18} className="mx-auto animate-spin" /> : tt("enter", "Enter NoodleR")}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mx-auto -mt-3 text-xs font-semibold text-[var(--muted-foreground)] hover:underline"
      >
        {tt("back", "Back")}
      </button>
    </div>
  );
}

function StepHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="text-center">
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{sub}</p>
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

// Component-scoped keyframes: no existing scan-line or confetti animation in globals.css,
// and a confetti dependency would blow the bundle budget for a joke screen.
function GateStyles() {
  return (
    <style>{`
      .agegate-scanline {
        position: absolute; left: 0; right: 0; top: 0; height: 3px;
        background: linear-gradient(90deg, transparent, var(--noodle-accent), transparent);
        box-shadow: 0 0 10px var(--noodle-accent);
        animation: agegate-scan 2.2s ease-in-out forwards;
      }
      @keyframes agegate-scan { from { top: 0; } to { top: 100%; } }
      .agegate-confetti {
        position: absolute; top: -10px; width: 8px; height: 8px; border-radius: 1px;
        animation: agegate-fall 1s ease-in forwards;
      }
      @keyframes agegate-fall {
        to { transform: translateY(360px) rotate(540deg); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .agegate-scanline, .agegate-confetti { animation: none; }
      }
    `}</style>
  );
}
