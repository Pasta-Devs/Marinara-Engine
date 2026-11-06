import { useEffect, useRef, type ReactNode } from "react";
import { FloatPortal } from "../../components/ui/FloatPortal";
import { useWindowFloat, WINDOW_FLOAT_Z } from "../../components/ui/useWindowFloat";
import { Search, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";

interface PickerDropdownProps {
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  placeholder: string;
  children: ReactNode;
  footer?: ReactNode;
  searchable?: boolean;
}

export function PickerDropdown({
  search,
  onSearchChange,
  onClose,
  placeholder,
  children,
  footer,
  searchable = true,
}: PickerDropdownProps) {
  const { t: localizeUi } = useUiTranslation();
  const ref = useRef<HTMLDivElement>(null);
  // In a popped-out window the list floats over the chat (from where it would sit) instead of
  // growing the window and making people scroll it.
  const anchorRef = useRef<HTMLDivElement>(null);
  const float = useWindowFloat(anchorRef, true);

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [onClose]);

  return (
    <>
      <div ref={anchorRef} aria-hidden="true" />
      <FloatPortal float={float}>
        <div
          ref={ref}
          onPointerDown={(event) => event.stopPropagation()}
          className="mt-2 rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden"
          style={
            float
              ? {
                  position: "fixed",
                  // Opens upward when the window sits low on the screen.
                  ...(window.innerHeight - float.top < 280
                    ? { bottom: window.innerHeight - float.top + 4, marginTop: 0 }
                    : { top: float.top }),
                  left: float.left,
                  width: Math.max(float.width, 240),
                  zIndex: WINDOW_FLOAT_Z,
                  boxShadow: "0 12px 30px -12px rgb(0 0 0 / 0.7)",
                }
              : undefined
          }
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            {searchable && (
              <>
                <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
                <input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={placeholder}
                  autoFocus
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
                />
              </>
            )}
            <button
              type="button"
              aria-label={localizeUi("ui.chatSettings.pickerdropdown.closePicker")}
              onClick={onClose}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X size="0.75rem" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">{children}</div>
          {footer}
        </div>
      </FloatPortal>
    </>
  );
}
