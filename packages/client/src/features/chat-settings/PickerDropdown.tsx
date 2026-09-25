import { useEffect, useRef, type ReactNode } from "react";
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

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      onPointerDown={(event) => event.stopPropagation()}
      className="mt-2 rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden"
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
  );
}
