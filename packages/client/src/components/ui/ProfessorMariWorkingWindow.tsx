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
        "pointer-events-auto relative overflow-hidden rounded-xl border border-[var(--primary)]/25 bg-[var(--card)]/95 text-[var(--foreground)] shadow-xl shadow-black/25 ring-1 ring-[var(--border)]/60",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {!imageFailed && (
          <img
            src={DOTTOR_SUPPORT_GIF}
            alt=""
            className="mt-0.5 h-14 w-14 shrink-0 object-contain [image-rendering:pixelated]"
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="min-w-0 flex-1 pr-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]/85">Working</p>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-[var(--foreground)]">
            Professor Mari is working. Dottore is doing jumping jacks for moral support...
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
            aria-label="Hide Dottore support popup"
            title="Hide"
          >
            <X size="0.78rem" />
          </button>
        )}
      </div>
    </aside>
  );
}
