// The search dialog's chrome around the result list: Mari's head door, the scope and filter strips,
// the bare empty state and the footer.
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { MariHold } from "../../chat/mari/MariHold";
import { OmnibarSettingsButton } from "./OmnibarSettingsMenu";
import {
  OMNIBAR_SCOPE_CHIP_FILTERS,
  FILTER_CATEGORY,
  type OmnibarPane,
  type RankedOmnibarResult,
  isRichResult,
} from "./omnibar-result-view";
import type { OmnibarResult } from "../../../lib/omnibar-search";
import { omnibarScopePrefix } from "../../../lib/omnibar-scope";
import { isApplePlatform, type CommandCenterCategoryFilter } from "../../../lib/command-center";
import { formatShortcutKey } from "../../../lib/keyboard-shortcuts";

// UX-16: chips are drawn at 34px; on touch the hit area grows into the strip's padding to 44px.
const CHIP_TOUCH_HIT =
  "relative [@media(pointer:coarse)]:after:absolute [@media(pointer:coarse)]:after:inset-x-0 [@media(pointer:coarse)]:after:-inset-y-[0.3125rem] [@media(pointer:coarse)]:after:content-['']";

/** Slice 79b: Mari's head in the search header is the door to her. */
export function OmnibarMariDoor({
  onClick,
  working,
  portrait,
  hover,
  held,
}: {
  onClick: () => void;
  working: boolean;
  portrait: string;
  hover: string;
  held: string;
}) {
  const { t } = useTranslation();
  // Slice 85: press and hold her head to lift her; a tap still opens Mari.
  return (
    <MariHold heldSrc={held}>
      <button
        type="button"
        onClick={onClick}
        // Slice 79b: her head is the door to her (the footer pill is gone), so it says so.
        aria-label={t("commandCenter.askMariDoor", "Ask Prof. Mari")}
        aria-keyshortcuts={isApplePlatform() ? "Meta+J" : "Control+J"}
        title={t("commandCenter.askMariDoorTooltip", "Ask Prof. Mari ({{shortcut}})", {
          shortcut: isApplePlatform() ? "⌘J" : "Ctrl+J",
        })}
        data-component="GlobalOmnibar.ProfessorMariButton"
        data-mari-glow={working ? "true" : "false"}
        className="group relative -mb-px flex h-14 w-[4.25rem] shrink-0 self-end items-end justify-end rounded-t-lg pb-2 pl-8 transition-colors [--mari-glow-size:3.4rem] [--mari-glow-top:0.05rem] hover:bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)] active:bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] max-[30rem]:w-11 max-[30rem]:pl-0"
      >
        {/* P1: only the tall portrait is cropped, so her working glow on the button fades out freely. */}
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <img
            src={portrait}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-0 h-[6.5rem] w-auto max-w-none -translate-x-1/2 object-contain object-top transition-transform duration-200 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1 group-active:translate-y-0 motion-reduce:transition-none max-[30rem]:h-20"
          />
          {/* Slice 85 hover: the same box, so the swap moves nothing. Mouse only; touch has no hover. */}
          <img
            src={hover}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-0 h-[6.5rem] w-auto max-w-none -translate-x-1/2 object-contain object-top opacity-0 transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:opacity-100 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 group-active:translate-y-0 motion-reduce:transition-none max-[30rem]:h-20"
          />
        </span>
      </button>
    </MariHold>
  );
}

/** The empty field's category chips: each writes its scope prefix into the field. */
export function OmnibarScopeChips({
  filterLabels,
  setQuery,
  setFilter,
  inputRef,
}: {
  filterLabels: Record<CommandCenterCategoryFilter, string>;
  setQuery: (query: string) => void;
  setFilter: (filter: CommandCenterCategoryFilter) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="toolbar"
      aria-label={t("commandCenter.scopeChips.label", "Search a category")}
      data-component="GlobalOmnibar.ScopeChips"
      className="omnibar-horizontal-strip scrollbar-hide flex min-h-11 items-center gap-1 overflow-x-auto border-b border-[var(--border)] py-1.5 pl-3 pr-6 overscroll-x-contain sm:min-h-10"
    >
      {OMNIBAR_SCOPE_CHIP_FILTERS.map((chip) => (
        <button
          key={chip}
          type="button"
          data-omnibar-scope-chip={chip}
          onClick={() => {
            const scope = FILTER_CATEGORY[chip];
            if (!scope) return;
            // Write the prefix rather than setting hidden state, so the
            // syntax is visible in the field the moment it is used.
            setQuery(omnibarScopePrefix(scope));
            setFilter("all");
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className={`${CHIP_TOUCH_HIT} min-h-8 shrink-0 rounded-md px-2.5 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
        >
          {filterLabels[chip]}
        </button>
      ))}
    </div>
  );
}

/** The result categories under a typed query. */
export function OmnibarFilterStrip({
  reduceMotion,
  availableFilters,
  filter,
  filterLabels,
  setCategoryFilter,
}: {
  reduceMotion: boolean | null;
  availableFilters: CommandCenterCategoryFilter[];
  filter: CommandCenterCategoryFilter;
  filterLabels: Record<CommandCenterCategoryFilter, string>;
  setCategoryFilter: (filter: CommandCenterCategoryFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
      role="toolbar"
      aria-label={t("commandCenter.filters.label", "Result categories")}
      data-component="GlobalOmnibar.Filters"
      className="omnibar-horizontal-strip scrollbar-hide flex min-h-11 items-center gap-1 overflow-x-auto border-b border-[var(--border)] py-1.5 pl-3 pr-6 overscroll-x-contain sm:min-h-10"
    >
      {availableFilters.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={filter === item}
          onClick={() => setCategoryFilter(item)}
          className={`${CHIP_TOUCH_HIT} min-h-8 shrink-0 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${filter === item ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"}`}
        >
          {filterLabels[item]}
        </button>
      ))}
    </motion.div>
  );
}

/** The bare dialog before anything is typed or offered. */
export function OmnibarEmpty() {
  const { t } = useTranslation();
  return (
    <div
      data-component="GlobalOmnibar.Empty"
      className="flex min-h-40 flex-1 flex-col items-center justify-center px-6 py-8 text-center sm:min-h-32"
    >
      <Search size={20} aria-hidden="true" className="mb-2 text-[var(--primary)]" />
      <p className="text-sm font-semibold text-[var(--foreground)]">
        {t("commandCenter.empty.title", "Search across Marinara")}
      </p>
      <p className="mt-1 max-w-[32rem] text-xs leading-relaxed text-[var(--muted-foreground)]">
        {t(
          "commandCenter.empty.description",
          "Type the name of a chat, character, setting or message. Pick a category above to browse.",
        )}
      </p>
    </div>
  );
}

/** Keyboard hints and the settings button under the search list. */
export function OmnibarFooter({
  inlineSuffix,
  mariEnabled,
  pane,
  activeResult,
  mariSends,
  asideSettled,
  expandedPreviewId,
  idle,
  settingsOpen,
  openSettings,
}: {
  inlineSuffix: string;
  mariEnabled: boolean;
  pane: OmnibarPane;
  activeResult: RankedOmnibarResult | undefined;
  mariSends: (result: OmnibarResult | null) => boolean;
  /** A finished quick answer is on the Ask row: ⌘↵ continues it into her window. */
  asideSettled: boolean;
  expandedPreviewId: string | null;
  idle: boolean;
  settingsOpen: boolean;
  openSettings: () => void;
}) {
  const { t } = useTranslation();
  return (
    <footer className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-3 text-[0.6875rem] text-[var(--muted-foreground)]">
      {/* The conditional hints group to the left so the two permanent
                hints keep their positions as rows gain and lose shortcuts. */}
      <span className="hidden items-center gap-4 sm:flex">
        <span>{t("commandCenter.keyboard.move", "Arrow keys move")}</span>
        {inlineSuffix ? (
          <span>{t("commandCenter.keyboard.complete", "⇥ Complete")}</span>
        ) : mariEnabled && pane === "results" && activeResult ? (
          // Says whether ⌘↵ sends: "Ask" sends what you typed, "Continue" opens her or carries the quick answer.
          <span>
            {mariSends(activeResult) && !(asideSettled && activeResult.id === "ask-professor-mari")
              ? t("commandCenter.keyboard.askMari", "{{mod}}+Enter Ask Prof. Mari", { mod: formatShortcutKey("Mod") })
              : t("commandCenter.keyboard.continueMari", "{{mod}}+Enter Continue with Prof. Mari", {
                  mod: formatShortcutKey("Mod"),
                })}
          </span>
        ) : null}
        {pane === "results" && activeResult && isRichResult(activeResult) ? (
          <span>
            {expandedPreviewId === activeResult.id
              ? t("commandCenter.keyboard.closePreview", "← Close preview")
              : t("commandCenter.keyboard.preview", "→ Preview")}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        {mariEnabled ? (
          <span className="hidden sm:inline">
            {t("commandCenter.keyboard.askMariShortcut", "{{mod}}+J Open Prof. Mari", {
              mod: formatShortcutKey("Mod"),
            })}
          </span>
        ) : null}
        {!idle ? <span className="hidden sm:inline">{t("commandCenter.keyboard.escape", "Esc close")}</span> : null}
        <OmnibarSettingsButton open={settingsOpen} onOpen={() => openSettings()} />
      </span>
    </footer>
  );
}
