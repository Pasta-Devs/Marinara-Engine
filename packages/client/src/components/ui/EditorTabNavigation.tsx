import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";

export type EditorTabItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

export function EditorTabNavigation<T extends string>({
  tabs,
  activeId,
  onChange,
  getBadge,
  className,
}: {
  tabs: readonly EditorTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  getBadge?: (id: T) => string | number | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const navigationLabel = t("editor.navigation.sections");
  const compactMenuId = useId();
  const compactMenuRef = useRef<HTMLDivElement>(null);
  const compactMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [compactMenuOpen, setCompactMenuOpen] = useState(false);
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  useEffect(() => {
    if (!compactMenuOpen) return;
    const focusFrame = window.requestAnimationFrame(() => {
      compactMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    });
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!compactMenuRef.current?.contains(event.target as Node)) setCompactMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCompactMenuOpen(false);
        compactMenuButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [compactMenuOpen]);

  return (
    <div className={cn("mari-editor-navigation min-w-0", className)}>
      <nav aria-label={navigationLabel} className="flex min-w-0 items-center gap-1 @max-7xl:gap-0.5 @max-5xl:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeId === tab.id;
          const badge = getBadge?.(tab.id);
          return (
            <button
              type="button"
              aria-label={localize(tab.label)}
              aria-current={active ? "page" : undefined}
              data-active={active ? "true" : undefined}
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="mari-editor-action mari-editor-tab flex min-w-0 shrink items-center justify-center whitespace-nowrap px-2.5 text-center @max-7xl:gap-1 @max-7xl:px-2 @max-7xl:text-[0.6875rem]"
            >
              <Icon size="1rem" className="shrink-0 @max-7xl:hidden" />
              <span className="min-w-0 truncate">{localize(tab.label)}</span>
              {badge != null && <span className="mari-editor-tab-badge ml-0.5">{badge}</span>}
            </button>
          );
        })}
      </nav>

      <div ref={compactMenuRef} className="relative hidden @max-5xl:block">
        <button
          ref={compactMenuButtonRef}
          type="button"
          aria-label={navigationLabel}
          aria-haspopup="menu"
          aria-expanded={compactMenuOpen}
          aria-controls={compactMenuId}
          onClick={() => setCompactMenuOpen((open) => !open)}
          className="mari-editor-navigation-select flex h-8 w-full items-center gap-1 rounded-[0.625rem] border px-2 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2"
        >
          <span className="min-w-0 flex-1 truncate text-left">{activeTab ? localize(activeTab.label) : ""}</span>
          <ChevronDown
            aria-hidden="true"
            size="0.875rem"
            className={`shrink-0 text-[var(--marinara-editor-muted)] transition-transform ${compactMenuOpen ? "rotate-180" : ""}`}
          />
        </button>
        {compactMenuOpen && (
          <div
            id={compactMenuId}
            role="menu"
            aria-label={navigationLabel}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              const items = Array.from(
                compactMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
              );
              const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
              const direction = event.key === "ArrowDown" ? 1 : -1;
              items[(currentIndex + direction + items.length) % items.length]?.focus();
            }}
            className="mari-editor-navigation-menu absolute left-0 top-full z-50 mt-1 w-max min-w-full max-w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border p-1 shadow-xl"
          >
            {tabs.map((tab) => {
              const active = activeId === tab.id;
              const badge = getBadge?.(tab.id);
              return (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-label={localize(tab.label)}
                  aria-checked={active}
                  key={tab.id}
                  onClick={() => {
                    onChange(tab.id);
                    setCompactMenuOpen(false);
                    compactMenuButtonRef.current?.focus();
                  }}
                  className="mari-editor-navigation-menu-item flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium"
                >
                  <span className="min-w-0 flex-1 truncate">{localize(tab.label)}</span>
                  {badge != null && <span className="mari-editor-tab-badge">{badge}</span>}
                  <Check size="0.75rem" className={active ? "opacity-100" : "opacity-0"} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
