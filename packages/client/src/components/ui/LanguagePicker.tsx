import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBackDismiss } from "../../hooks/use-back-dismiss";
import { cn } from "../../lib/utils";

interface LanguageOption {
  code: string;
  label: string;
  englishLabel?: string;
}

interface LanguagePickerProps {
  id?: string;
  label: string;
  value: string;
  options: readonly LanguageOption[];
  onChange: (code: string) => void;
  disabled?: boolean;
}

let englishNames: Intl.DisplayNames | undefined;

function englishName(option: LanguageOption) {
  if (option.englishLabel) return option.englishLabel;
  try {
    englishNames ??= new Intl.DisplayNames(["en"], { type: "language" });
    return englishNames.of(option.code) ?? option.label;
  } catch {
    // Older WebViews without DisplayNames still show and search the native label and locale code.
    return option.label;
  }
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
}

/** Shared by interface and documentation language controls; pack installation stays with the caller. */
export function LanguagePicker({ id, label, value, options, onChange, disabled }: LanguagePickerProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const panelId = `${triggerId}-panel`;
  const listId = `${triggerId}-list`;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number }>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const query = normalizeSearch(search);
  const filtered = options.filter((option) =>
    normalizeSearch(`${option.code} ${option.label} ${englishName(option)}`).includes(query),
  );
  const activeOption = filtered[Math.min(activeIndex, filtered.length - 1)];
  const selected = options.find((option) => option.code === value);
  const isOpen = open && !disabled;

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  useBackDismiss(isOpen, () => close());

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const padding = 8;
      const gap = 6;
      const width = Math.min(Math.max(300, rect.width), viewportWidth - padding * 2);
      const below = viewportTop + viewportHeight - rect.bottom - padding - gap;
      const above = rect.top - viewportTop - padding - gap;
      const contentHeight = Array.from(panelRef.current?.children ?? []).reduce(
        (height, child) => height + Math.max(child.scrollHeight, child.getBoundingClientRect().height),
        2,
      );
      const desiredHeight = Math.min(420, contentHeight);
      const openBelow = below >= Math.min(desiredHeight, above);
      const maxHeight = Math.max(0, Math.min(desiredHeight, openBelow ? below : above, viewportHeight - padding * 2));
      const preferredTop = openBelow ? rect.bottom + gap : rect.top - maxHeight - gap;
      setPosition({
        top: Math.max(
          viewportTop + padding,
          Math.min(preferredTop, viewportTop + viewportHeight - maxHeight - padding),
        ),
        left: Math.max(
          viewportLeft + padding,
          Math.min(rect.right - width, viewportLeft + viewportWidth - width - padding),
        ),
        width,
        maxHeight,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [isOpen, search, options]);

  useEffect(() => {
    if (!isOpen) return;
    const focusFrame = requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    const dismissOutside = (event: Event) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeOption) {
      document.getElementById(`${listId}-${activeOption.code}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, activeOption, listId]);

  const select = (code: string) => {
    close();
    if (code !== value) onChange(code);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      // Resume the normal tab order from the trigger rather than the body portal.
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        filtered.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeOption) select(activeOption.code);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-label={t("languagePicker.triggerLabel", { label, language: selected?.label ?? value })}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        data-value={value}
        disabled={disabled}
        onClick={() => {
          if (isOpen) return close();
          setSearch("");
          setActiveIndex(
            Math.max(
              0,
              options.findIndex((option) => option.code === value),
            ),
          );
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setSearch("");
            setActiveIndex(
              Math.max(
                0,
                options.findIndex((option) => option.code === value),
              ),
            );
            setOpen(true);
          }
        }}
        className={cn(
          "flex min-h-11 w-full min-w-0 touch-manipulation items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-start text-xs text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-[var(--primary)]",
        )}
      >
        <Globe size="1rem" aria-hidden="true" className="shrink-0 text-[var(--muted-foreground)]" />
        <span lang={selected?.code} dir="auto" className="min-w-0 flex-1 truncate">
          {selected?.label ?? value}
        </span>
        <ChevronDown size="0.875rem" aria-hidden="true" className="shrink-0 text-[var(--muted-foreground)]" />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={label}
            data-language-picker-portal="true"
            onKeyDown={handleKeyDown}
            className="mari-chrome-token-scope fixed z-[10001] flex flex-col overflow-x-hidden overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] shadow-xl"
            style={position ?? { visibility: "hidden" }}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] p-2.5">
              <Search size="1rem" aria-hidden="true" className="shrink-0 text-[var(--muted-foreground)]" />
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-label={t("languagePicker.search")}
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeOption ? `${listId}-${activeOption.code}` : undefined}
                name="language-search"
                autoComplete="off"
                spellCheck={false}
                placeholder={t("languagePicker.searchPlaceholder")}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActiveIndex(0);
                }}
                className="min-h-11 w-full min-w-0 rounded-md bg-[var(--secondary)] px-2.5 py-2 text-base focus-visible:outline-2 focus-visible:outline-[var(--ring)] md:text-sm"
              />
            </div>
            <div
              id={listId}
              role="listbox"
              aria-label={label}
              className={cn("overflow-y-auto overscroll-contain", filtered.length > 0 ? "min-h-16 p-1.5" : "min-h-0")}
            >
              {filtered.map((option) => {
                const english = englishName(option);
                return (
                  <button
                    key={option.code}
                    id={`${listId}-${option.code}`}
                    type="button"
                    role="option"
                    aria-selected={option.code === value}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(option.code)}
                    className={cn(
                      "flex min-h-12 w-full touch-manipulation items-center gap-2 rounded-md px-2.5 py-2 text-start hover:bg-[var(--secondary)]",
                      option.code === value && "bg-[var(--primary)]/10",
                      option.code === activeOption?.code && "ring-1 ring-inset ring-[var(--ring)]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span lang={option.code} dir="auto" className="block truncate text-sm">
                        {option.label}
                      </span>
                      {english !== option.label && (
                        <span lang="en" className="block truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                          {english}
                        </span>
                      )}
                    </span>
                    {option.code === value && (
                      <Check size="1rem" aria-hidden="true" className="shrink-0 text-[var(--primary)]" />
                    )}
                  </button>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <p
                role="status"
                className="min-h-16 overflow-y-auto px-3 py-5 text-center text-xs text-[var(--muted-foreground)]"
              >
                {t("languagePicker.noMatches")}
              </p>
            )}
            <p className="shrink-0 border-t border-[var(--border)] px-3 py-2.5 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("languagePicker.nativeNames")}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
