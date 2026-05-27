import { useEffect } from "react";
import { toast } from "sonner";
import { useUIStore } from "../../stores/ui.store";

const CHIBI_PROFESSOR_MARI_IMAGE = "/sprites/mari/chibi-professor-mari.png";
const CHIBI_PROFESSOR_MARI_SEEN_KEY = "marinara:chibi-professor-mari-toast-seen";
const CHIBI_PROFESSOR_MARI_ROLL_CHANCE = 0.001;
const CHIBI_PROFESSOR_MARI_ROLL_COOLDOWN_MS = 3_000;
const CHIBI_PROFESSOR_MARI_TOAST_DURATION_MS = 18_000;

function hasSeenChibiProfessorMari() {
  try {
    return window.sessionStorage.getItem(CHIBI_PROFESSOR_MARI_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberChibiProfessorMari() {
  try {
    window.sessionStorage.setItem(CHIBI_PROFESSOR_MARI_SEEN_KEY, "true");
  } catch {
    // Ignore storage failures; the toast is still allowed to appear.
  }
}

function showChibiProfessorMariToast() {
  rememberChibiProfessorMari();
  toast.custom(
    () => (
      <div className="flex max-w-[360px] gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--foreground)] shadow-lg">
        <img
          src={CHIBI_PROFESSOR_MARI_IMAGE}
          alt="Chibi Professor Mari"
          className="h-24 w-20 shrink-0 object-contain"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
        <div className="space-y-2 text-sm leading-relaxed">
          <p>
            If you see this image while scrolling through Marinara Engine, you've been visited by the rare Chibi
            Professor Mari!
          </p>
          <p>Good luck and fortune will come to you very soon. Make sure to say "thank you, Professor!"</p>
          <p>Remember, you are loved and appreciated. Cheers!</p>
        </div>
      </div>
    ),
    { duration: CHIBI_PROFESSOR_MARI_TOAST_DURATION_MS },
  );
}

export function ChibiProfessorMariEasterEgg() {
  const enabled = useUIStore((state) => state.chibiProfessorMariEnabled);

  useEffect(() => {
    if (!enabled) return;

    let seen = hasSeenChibiProfessorMari();
    let lastRollAt = 0;

    const handleScroll = () => {
      if (seen || document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastRollAt < CHIBI_PROFESSOR_MARI_ROLL_COOLDOWN_MS) return;
      lastRollAt = now;

      if (Math.random() > CHIBI_PROFESSOR_MARI_ROLL_CHANCE) return;

      seen = true;
      showChibiProfessorMariToast();
    };

    const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };
    document.addEventListener("scroll", handleScroll, scrollOptions);

    return () => {
      document.removeEventListener("scroll", handleScroll, scrollOptions);
    };
  }, [enabled]);

  return null;
}
