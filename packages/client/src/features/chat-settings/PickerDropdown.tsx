import { useEffect, useRef, type ReactNode } from "react";
import { Search, X } from "lucide-react";

interface PickerDropdownProps {
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  placeholder: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function PickerDropdown({
  search,
  onSearchChange,
  onClose,
  placeholder,
  children,
  footer,
}: PickerDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="mt-2 rounded-lg ring-1 ring-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
        />
        <button
          type="button"
          aria-label="Close picker"
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
