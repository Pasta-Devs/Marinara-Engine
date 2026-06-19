import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

const DOTTOR_SUPPORT_GIF = "/sprites/dottore/dottore_jumping.gif";

interface ProfessorMariWorkingWindowProps {
  visible: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function ProfessorMariWorkingWindow({ visible, onDismiss, className }: ProfessorMariWorkingWindowProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (visible) {
      setImageFailed(false);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <aside
      className={cn(
        "pointer-events-auto relative inline-flex max-w-full items-center gap-2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]/85 px-2.5 py-2 text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]/50",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {!imageFailed && (
        <img
          src={DOTTOR_SUPPORT_GIF}
          alt=""
          className="h-10 w-10 shrink-0 object-contain [image-rendering:pixelated]"
          onError={() => setImageFailed(true)}
        />
      )}
      <p className={cn("min-w-0 text-xs font-medium leading-relaxed text-[var(--foreground)]", onDismiss && "pr-6")}>
        Prof Mari is working...
      </p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
          aria-label="Hide Professor Mari working indicator"
          title="Hide"
        >
          <X size="0.78rem" />
        </button>
      )}
    </aside>
  );
}
