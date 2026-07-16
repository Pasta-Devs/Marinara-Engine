import { useEffect } from "react";
import { X } from "lucide-react";
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
    (toastId) => (
      <div className="relative flex max-w-[360px] gap-3 pr-8 text-[var(--foreground)]">
        <button
          type="button"
          onClick={() => toast.dismiss(toastId)}
          className="absolute right-0 top-0 rounded-full p-1 text-foreground/45 transition-colors hover:bg-foreground/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60"
          aria-label="Dismiss Mini Mari surprise visit toast"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <img
          src={CHIBI_PROFESSOR_MARI_IMAGE}
          alt="Chibi Professor Mari"
          className="h-24 w-20 shrink-0 self-center object-contain drop-shadow-[0_4px_10px_rgb(0_0_0/0.25)]"
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
  const enabled = useUIStore((s) => s.chibiProfessorMariEnabled);

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
