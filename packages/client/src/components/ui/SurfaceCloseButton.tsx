// ──────────────────────────────────────────────
// Close (✕) for full-page surfaces: leaves every open surface at once, straight to the chat or Home.
// Shown only when Back would not already land there, so a single open surface keeps just the Back button.
// ──────────────────────────────────────────────
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { requestCloseAllSurfaces } from "../../lib/back-layers";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat.store";
import { selectBackDestination, useUIStore } from "../../stores/ui.store";

/** True while Back leads to another surface (a stack entry or the regex editor's return), not to the base. */
export function selectShowsSurfaceClose(state: Parameters<typeof selectBackDestination>[0]): boolean {
  const destination = selectBackDestination(state);
  return !!destination && "surface" in destination;
}

interface Props {
  disabled?: boolean;
  /** Placement of the button (and its divider) inside the header, such as `md:order-last`. */
  className?: string;
  /** The button itself; defaults to the editors' action style. */
  buttonClassName?: string;
  iconSize?: string;
  /** Classes of a thin divider drawn before the button, to set it apart from Save-like actions. Omit for none. */
  dividerClassName?: string;
}

export function SurfaceCloseButton({
  disabled,
  className,
  buttonClassName = "mari-editor-action inline-flex",
  iconSize = "1.125rem",
  dividerClassName,
}: Props) {
  const { t } = useTranslation();
  const show = useUIStore(selectShowsSurfaceClose);
  const hasActiveChat = useChatStore((s) => !!s.activeChatId);
  if (!show) return null;
  const text = t(hasActiveChat ? "navigation.close.toChat" : "navigation.close.toHome");
  return (
    <span className={cn("mari-surface-close inline-flex shrink-0 items-center gap-2", className)}>
      {dividerClassName !== undefined && (
        <span
          aria-hidden="true"
          className={cn("mari-surface-close-divider h-5 w-px bg-[var(--marinara-editor-divider)]", dividerClassName)}
        />
      )}
      <button
        type="button"
        onClick={() => void requestCloseAllSurfaces()}
        disabled={disabled}
        className={buttonClassName}
        title={text}
        aria-label={text}
      >
        <X size={iconSize} />
      </button>
    </span>
  );
}
