// ──────────────────────────────────────────────
// Server console window: the server's recent log lines, read-only, inside the app
//
// Opened from Settings → Advanced → Open Console on every platform, so installs without a terminal at
// hand (NAS, VPS, Docker, a phone) can still see what the server logs. A window on a computer, a sheet
// on a phone. It reads the server's in-memory buffer only while it is open (use-server-console-logs).
// ──────────────────────────────────────────────
import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Copy, Download, Eraser, ExternalLink, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FloatingWindow, PHONE_FULL_SHEET_CLASS, PHONE_SHEET_CLASS } from "../ui/FloatingWindow";
import { NEUTRAL_PANEL_SCROLL_AREA, NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { ToggleSetting } from "../panels/settings/SettingControls";
import { readCssPixels } from "../chat/chat-settings-window";
import { useServerConsoleLogs } from "../../hooks/use-server-console-logs";
import { useMatchMedia } from "../../hooks/use-match-media";
import { getPrivilegedActionErrorMessage } from "../../lib/api-client";
import {
  ANDROID_BRIDGE_READY_EVENT,
  canOpenAndroidTermuxConsole,
  openAndroidTermuxConsole,
} from "../../lib/android-bridge";
import { saveExportFile } from "../../lib/file-download";
import type { WindowBounds, WindowLayout } from "../../lib/floating-window-layout";
import {
  LEVEL_FILTERS,
  parseLogLevel,
  type ConsoleLine,
  type ConsoleRow,
  type LevelFilter,
} from "../../lib/server-console";
import { copyToClipboard, cn } from "../../lib/utils";
import {
  PHONE_LAYOUT_QUERY,
  SERVER_CONSOLE_WINDOW_ID,
  useFloatingWindowStore,
} from "../../stores/floating-window.store";
import { useUIStore } from "../../stores/ui.store";
import { SearchInput } from "../ui/SearchInput";

const DEFAULT_WIDTH_REM = 46;
const DEFAULT_HEIGHT_REM = 30;
/** Within this many pixels of the bottom counts as "at the bottom": new lines keep scrolling into view. */
const STICK_TO_BOTTOM_PX = 24;

/** Centred, and pinned so it stays up while the user works in the app; its close button still closes it. */
function getServerConsoleDefaultLayout(bounds: WindowBounds): WindowLayout {
  const remPx = readCssPixels(document.documentElement, "font-size") || 16;
  const availableWidth = bounds.right - bounds.left;
  const availableHeight = bounds.bottom - bounds.top;
  const width = Math.max(320, Math.min(DEFAULT_WIDTH_REM * remPx, availableWidth));
  const height = Math.max(240, Math.min(DEFAULT_HEIGHT_REM * remPx, availableHeight));
  return {
    x: bounds.left + Math.max(0, (availableWidth - width) / 2),
    y: bounds.top + Math.max(0, (availableHeight - height) / 2),
    width,
    height,
    pinned: true,
    locked: false,
  };
}

/** trace and debug muted, info plain, warn the warning colour, error and fatal the destructive colour. */
function getLevelClass(level: number): string {
  if (level <= 20) return "text-[var(--muted-foreground)]";
  if (level <= 30) return "text-[var(--foreground)]";
  if (level <= 40) return "text-[var(--warning)]";
  return "text-[var(--destructive)]";
}

const ConsoleLineView = memo(function ConsoleLineView({ line }: { line: ConsoleLine }) {
  const valueClass = line.level <= 20 ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]/80";
  return (
    <div className="whitespace-pre-wrap break-words py-0.5">
      <div className={getLevelClass(line.level)}>
        <span className="text-[var(--muted-foreground)]">[{line.timeText}]</span>{" "}
        <span className="font-semibold">{line.label.padEnd(5)}</span>{" "}
        {line.tag && <span className="font-semibold">{line.tag}</span>}
        {line.message}
        {line.payload !== null && <span className="text-[var(--foreground)]">{line.payload}</span>}
      </div>
      {line.fields.map((field, index) => (
        <div key={`${field.key}-${index}`} className={cn("pl-6", valueClass)}>
          <span className="text-[var(--primary)]/80">{field.key}:</span>
          {field.multiline ? <div className="pl-4">{field.value}</div> : <> {field.value}</>}
        </div>
      ))}
    </div>
  );
});

function formatFilenameStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

const TOOLBAR_BUTTON_CLASS = "mari-chrome-control mari-chrome-control--small text-[0.6875rem] max-md:min-h-11!";

export function ServerConsoleWindow() {
  const { t } = useTranslation();
  const phoneLayout = useMatchMedia(PHONE_LAYOUT_QUERY);
  const debugMode = useUIStore((s) => s.debugMode);
  const setDebugMode = useUIStore((s) => s.setDebugMode);
  const { rows, logLevel, error, loaded, clear } = useServerConsoleLogs(true);
  const [enabledLevels, setEnabledLevels] = useState<ReadonlySet<LevelFilter>>(() => new Set(LEVEL_FILTERS));
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search).trim().toLowerCase();
  const [canOpenTermux, setCanOpenTermux] = useState(canOpenAndroidTermuxConsole);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const refreshBridge = () => setCanOpenTermux(canOpenAndroidTermuxConsole());
    window.addEventListener(ANDROID_BRIDGE_READY_EVENT, refreshBridge);
    refreshBridge();
    return () => window.removeEventListener(ANDROID_BRIDGE_READY_EVENT, refreshBridge);
  }, []);

  // A gap marker stays only when a visible line follows it, so a filter that hides every line shows the empty notice.
  const visibleRows = useMemo(() => {
    const kept: ConsoleRow[] = [];
    let lineAfter = false;
    for (let index = rows.length - 1; index >= 0; index--) {
      const row = rows[index]!;
      if (row.kind === "gap") {
        if (lineAfter) kept.push(row);
        lineAfter = false;
      } else if (enabledLevels.has(row.filter) && (deferredSearch === "" || row.searchText.includes(deferredSearch))) {
        kept.push(row);
        lineAfter = true;
      }
    }
    return kept.reverse();
  }, [rows, enabledLevels, deferredSearch]);

  // New lines scroll into view while the reader is at the bottom; scrolling up pauses that until Jump to latest.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && stickRef.current) element.scrollTop = element.scrollHeight;
  }, [visibleRows]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= STICK_TO_BOTTOM_PX;
    stickRef.current = nearBottom;
    setAtBottom(nearBottom);
  };

  const jumpToLatest = () => {
    const element = scrollRef.current;
    stickRef.current = true;
    setAtBottom(true);
    if (element) element.scrollTop = element.scrollHeight;
  };

  const toggleLevel = (level: LevelFilter) =>
    setEnabledLevels((previous) => {
      const next = new Set(previous);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });

  const getVisibleText = () =>
    visibleRows.map((row) => (row.kind === "gap" ? `-- ${t("serverConsole.gap")} --` : row.text)).join("\n");

  const handleCopy = async () => {
    if (await copyToClipboard(getVisibleText())) toast.success(t("serverConsole.copied"));
    else toast.error(t("serverConsole.copyFailed"));
  };

  const handleDownload = () => {
    void saveExportFile(
      new Blob([`${getVisibleText()}\n`], { type: "text/plain" }),
      `marinara-server-console-${formatFilenameStamp(new Date())}.txt`,
    );
  };

  const handleOpenTermux = () => {
    if (openAndroidTermuxConsole()) toast.info(t("ui.panels.advancedsettings.openingTermuxConsole"));
  };

  const serverLevel = parseLogLevel(logLevel);
  const showDebugHint = serverLevel !== null && serverLevel > 20;
  const hasRows = rows.length > 0;
  const emptyText = !loaded
    ? t("serverConsole.loading")
    : hasRows
      ? t("serverConsole.emptyFiltered")
      : t("serverConsole.empty");

  return (
    <FloatingWindow
      id={SERVER_CONSOLE_WINDOW_ID}
      title={t("serverConsole.title")}
      titleIcon={<Terminal size="0.8125rem" className="mari-chrome-accent-icon shrink-0" />}
      closeLabel={t("serverConsole.close")}
      presentation={phoneLayout ? "sheet" : "window"}
      layer="top"
      sheetClassName={cn(PHONE_SHEET_CLASS, PHONE_FULL_SHEET_CLASS, "z-[calc(var(--mari-layer-omnibar)_+_1)]")}
      getDefaultLayout={getServerConsoleDefaultLayout}
      minWidth={320}
      minHeight={240}
      className={cn("marinara-chat-popover mari-server-console", NEUTRAL_SURFACE_VARIABLES)}
      headerClassName="marinara-chat-popover__header"
      titleClassName="marinara-chat-popover__title text-xs font-semibold leading-tight"
      rootAttributes={{ "data-server-console": true }}
      onRequestClose={(reason) => {
        // Its own close button always closes it; Escape and outside presses leave a pinned window be.
        useFloatingWindowStore.getState().dismissWindow(SERVER_CONSOLE_WINDOW_ID, {
          force: reason === "close-button",
        });
      }}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--border)] px-2 py-2">
        <div role="group" aria-label={t("serverConsole.filters")} className="flex flex-wrap items-center gap-1">
          {LEVEL_FILTERS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={enabledLevels.has(level)}
              onClick={() => toggleLevel(level)}
              className={cn(TOOLBAR_BUTTON_CLASS, "mari-chrome-control--chip max-md:px-3")}
            >
              {t(`serverConsole.level.${level}`)}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          label={t("serverConsole.search")}
          placeholder={t("serverConsole.search")}
          className="mari-chrome-field--compact min-w-0 flex-1 basis-32"
        />
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void handleCopy()} className={TOOLBAR_BUTTON_CLASS}>
            <Copy size="0.75rem" className="shrink-0" />
            <span>{t("serverConsole.copy")}</span>
          </button>
          <button type="button" onClick={handleDownload} className={TOOLBAR_BUTTON_CLASS}>
            <Download size="0.75rem" className="shrink-0" />
            <span>{t("serverConsole.download")}</span>
          </button>
          <button type="button" onClick={clear} className={TOOLBAR_BUTTON_CLASS}>
            <Eraser size="0.75rem" className="shrink-0" />
            <span>{t("serverConsole.clear")}</span>
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            NEUTRAL_PANEL_SCROLL_AREA,
            "h-full overflow-auto overscroll-contain px-3 py-2 font-mono text-[0.6875rem] leading-snug",
          )}
        >
          {error != null && (
            <p role="alert" className="mb-2 whitespace-pre-wrap break-words text-xs text-[var(--destructive)]">
              {getPrivilegedActionErrorMessage(error, t("serverConsole.readError"))}
            </p>
          )}
          {visibleRows.length === 0
            ? error == null && <p className="py-6 text-center text-xs text-[var(--muted-foreground)]">{emptyText}</p>
            : visibleRows.map((row) =>
                row.kind === "gap" ? (
                  <div
                    key={row.key}
                    className="my-1 border-y border-dashed border-[var(--border)] py-0.5 text-center text-[0.625rem] italic text-[var(--muted-foreground)]"
                  >
                    {t("serverConsole.gap")}
                  </div>
                ) : (
                  <ConsoleLineView key={row.key} line={row} />
                ),
              )}
        </div>
        {!atBottom && (
          <button
            type="button"
            onClick={jumpToLatest}
            className={cn(TOOLBAR_BUTTON_CLASS, "absolute bottom-3 right-4 shadow-lg")}
          >
            <ArrowDown size="0.75rem" className="shrink-0" />
            <span>{t("serverConsole.jumpToLatest")}</span>
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1 border-t border-[var(--border)] px-2 py-1.5">
        <ToggleSetting label={t("serverConsole.debugMode")} checked={debugMode} onChange={setDebugMode} />
        {showDebugHint && (
          <p className="px-1.5 text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
            {t("serverConsole.debugHint")}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1.5">
          <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {logLevel ? t("serverConsole.logLevel", { level: logLevel }) : ""}
          </span>
          {canOpenTermux && (
            <button type="button" onClick={handleOpenTermux} className={TOOLBAR_BUTTON_CLASS}>
              <ExternalLink size="0.75rem" className="shrink-0" />
              <span>{t("serverConsole.openTermux")}</span>
            </button>
          )}
        </div>
      </div>
    </FloatingWindow>
  );
}
