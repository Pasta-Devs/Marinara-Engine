import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { CircleDashed, X } from "lucide-react";
import { SUPPORTED_STAT_ICONS, type SupportedStatIcon } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { StatIcon } from "./stat-icons";

interface StatIconPickerProps {
  /** Persisted ownership: omitted inherits, null hides, an icon overrides. */
  value?: SupportedStatIcon | null;
  /** Icon to render in the trigger after profile fallback resolution. */
  displayIcon?: SupportedStatIcon | null;
  onSelect: (name: SupportedStatIcon | null | undefined) => void;
  allowInherit?: boolean;
  statName?: string;
  triggerClassName?: string;
  iconClassName?: string;
  iconSize?: string | number;
}

function displayIconName(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StatIconPicker({
  value,
  displayIcon,
  onSelect,
  allowInherit,
  statName,
  triggerClassName,
  iconClassName,
  iconSize = "1rem",
}: StatIconPickerProps) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number }>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIcon = value;
  const triggerIcon = displayIcon === undefined ? selectedIcon : displayIcon;
  const isInheriting = value === undefined && allowInherit;
  const isNoIcon = value === null || (!allowInherit && !selectedIcon);

  const query = search.trim().toLocaleLowerCase();
  const filteredIcons = query
    ? SUPPORTED_STAT_ICONS.filter((icon) => icon.includes(query) || displayIconName(icon).toLowerCase().includes(query))
    : SUPPORTED_STAT_ICONS;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const ownerWindow = trigger.ownerDocument.defaultView ?? window;
    const rect = trigger.getBoundingClientRect();
    const viewport = ownerWindow.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? ownerWindow.innerWidth;
    const viewportHeight = viewport?.height ?? ownerWindow.innerHeight;
    const padding = 8;
    const gap = 6;
    const width = Math.min(320, viewportWidth - padding * 2);
    const preferredHeight = 352;
    const below = viewportTop + viewportHeight - (rect.bottom + viewportTop) - padding;
    const above = rect.top - padding;
    const openBelow = below >= Math.min(preferredHeight, above);
    const maxHeight = Math.max(0, Math.min(preferredHeight, openBelow ? below - gap : above - gap));
    const top = openBelow
      ? rect.bottom + viewportTop + gap
      : Math.max(viewportTop + padding, rect.top + viewportTop - maxHeight - gap);
    const left = Math.max(
      viewportLeft + padding,
      Math.min(rect.right + viewportLeft - width, viewportLeft + viewportWidth - width - padding),
    );
    setPosition({ top, left, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const ownerDocument = triggerRef.current?.ownerDocument ?? document;
    const ownerWindow = ownerDocument.defaultView ?? window;
    updatePosition();
    const scheduleUpdate = () => ownerWindow.requestAnimationFrame(updatePosition);
    ownerWindow.addEventListener("resize", scheduleUpdate);
    ownerDocument.addEventListener("scroll", scheduleUpdate, true);
    ownerWindow.visualViewport?.addEventListener("resize", scheduleUpdate);
    ownerWindow.visualViewport?.addEventListener("scroll", scheduleUpdate);
    return () => {
      ownerWindow.removeEventListener("resize", scheduleUpdate);
      ownerDocument.removeEventListener("scroll", scheduleUpdate, true);
      ownerWindow.visualViewport?.removeEventListener("resize", scheduleUpdate);
      ownerWindow.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const ownerDocument = triggerRef.current?.ownerDocument ?? document;
    const ownerWindow = ownerDocument.defaultView ?? window;
    setSearch("");
    setActiveOptionIndex(selectedIcon && !isInheriting ? SUPPORTED_STAT_ICONS.indexOf(selectedIcon) + 1 : 0);
    const frame = ownerWindow.requestAnimationFrame(() => searchRef.current?.focus());
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    ownerDocument.addEventListener("mousedown", handlePointerDown);
    ownerDocument.addEventListener("keydown", handleKeyDown);
    return () => {
      ownerWindow.cancelAnimationFrame(frame);
      ownerDocument.removeEventListener("mousedown", handlePointerDown);
      ownerDocument.removeEventListener("keydown", handleKeyDown);
    };
  }, [isInheriting, open, selectedIcon]);

  const select = (icon: SupportedStatIcon | null | undefined) => {
    onSelect(icon);
    setOpen(false);
    const ownerWindow = triggerRef.current?.ownerDocument.defaultView ?? window;
    ownerWindow.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const focusOption = (index: number) => {
    const optionCount = filteredIcons.length + 1;
    const nextIndex = ((index % optionCount) + optionCount) % optionCount;
    setActiveOptionIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  };

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const columns = 7;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = index + 1;
    if (event.key === "ArrowLeft") nextIndex = index - 1;
    if (event.key === "ArrowDown") nextIndex = index + columns;
    if (event.key === "ArrowUp") nextIndex = index - columns;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = filteredIcons.length;
    if (nextIndex === null) return;
    event.preventDefault();
    focusOption(nextIndex);
  };

  const triggerLabel = statName
    ? localizeUi("ui.ui.staticonpicker.chooseIconForValue1", { value1: statName })
    : localizeUi("ui.ui.staticonpicker.chooseStatIcon");

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={triggerLabel}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-[var(--input)] transition-colors",
          "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50 hover:text-[var(--foreground)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
          open && "border-[var(--primary)]/60 text-[var(--primary)]",
          triggerClassName,
        )}
      >
        {triggerIcon ? (
          <StatIcon icon={triggerIcon} size={iconSize} className={iconClassName} />
        ) : (
          <CircleDashed size={iconSize} className={iconClassName} />
        )}
      </button>

      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={localizeUi("ui.ui.staticonpicker.statIconPicker")}
              onBlurCapture={() => {
                const ownerDocument = triggerRef.current?.ownerDocument ?? document;
                const ownerWindow = ownerDocument.defaultView ?? window;
                ownerWindow.requestAnimationFrame(() => {
                  if (!panelRef.current?.contains(ownerDocument.activeElement)) setOpen(false);
                });
              }}
              className="fixed z-[9999] flex w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl"
              style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
            >
              <div className="border-b border-[var(--border)] p-2">
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setActiveOptionIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      focusOption(0);
                    }
                  }}
                  placeholder={localizeUi("ui.ui.staticonpicker.searchIcons")}
                  aria-label={localizeUi("ui.ui.staticonpicker.searchIcons")}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 py-1.5 text-xs outline-none placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--primary)]/40"
                />
                {allowInherit ? (
                  <button
                    type="button"
                    onClick={() => select(undefined)}
                    aria-pressed={isInheriting}
                    className={cn(
                      "mt-2 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                      isInheriting && "bg-[var(--primary)]/15 text-[var(--primary)]",
                    )}
                  >
                    {localizeUi("ui.ui.staticonpicker.inheritProfileIcon")}
                  </button>
                ) : null}
              </div>

              <div
                role="listbox"
                aria-label={localizeUi("ui.ui.staticonpicker.availableIcons")}
                className="grid grid-cols-7 gap-1 overflow-y-auto p-2"
              >
                <button
                  ref={(element) => {
                    optionRefs.current[0] = element;
                  }}
                  type="button"
                  role="option"
                  onClick={() => select(null)}
                  onKeyDown={(event) => handleOptionKeyDown(event, 0)}
                  aria-label={localizeUi("ui.ui.staticonpicker.none")}
                  aria-selected={isNoIcon}
                  tabIndex={activeOptionIndex === 0 ? 0 : -1}
                  title={localizeUi("ui.ui.staticonpicker.none")}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors",
                    "hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                    isNoIcon && "bg-[var(--primary)]/15 text-[var(--primary)]",
                  )}
                >
                  <X size="1rem" />
                </button>
                {filteredIcons.map((icon, index) => {
                  const label = displayIconName(icon);
                  return (
                    <button
                      key={icon}
                      ref={(element) => {
                        optionRefs.current[index + 1] = element;
                      }}
                      type="button"
                      role="option"
                      onClick={() => select(icon)}
                      onKeyDown={(event) => handleOptionKeyDown(event, index + 1)}
                      aria-label={localizeUi("ui.ui.staticonpicker.selectValue1", { value1: label })}
                      aria-selected={!isInheriting && selectedIcon === icon}
                      tabIndex={activeOptionIndex === index + 1 ? 0 : -1}
                      title={label}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors",
                        "hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                        !isInheriting && selectedIcon === icon && "bg-[var(--primary)]/15 text-[var(--primary)]",
                      )}
                    >
                      <StatIcon icon={icon} size="1rem" />
                    </button>
                  );
                })}
                {filteredIcons.length === 0 ? (
                  <p className="col-span-7 py-6 text-center text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.ui.staticonpicker.noIconsFound")}
                  </p>
                ) : null}
              </div>
            </div>,
            triggerRef.current?.ownerDocument.body ?? document.body,
          )
        : null}
    </>
  );
}
