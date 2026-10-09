import {
  Loader2,
  Lightbulb,
  Sparkles,
  Compass,
  Clock3,
  SlidersHorizontal,
  LayoutGrid,
  ArrowRight,
  Search,
} from "lucide-react";
import type { MouseEvent, ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { type RankedOmnibarResult, resultMetadata } from "./omnibar-result-view";
import { ResultTypeIcon } from "../../command-center/ResultTypeIcon";
import { CommandCenterToggle } from "../../command-center/CommandCenterToggle";
import { CommandCenterSegmentedChoice } from "../../command-center/CommandCenterSegmentedChoice";
import { CommandCenterResultRow } from "../../command-center/CommandCenterResultRow";
import { CommandCenterActionValue } from "../../command-center/CommandCenterActionValue";
import type { CommandCenterVisual } from "../../command-center/command-center-visuals";
import { cn } from "../../../lib/utils";
import type { OmnibarResult } from "../../../lib/omnibar-search";
import { type OmnibarRowVisualContext, resolveOmnibarRowVisual } from "../../../lib/omnibar-row-visual";
import { readChoiceOptionId } from "../../../lib/omnibar-choice-rows";
import type { CommandCenterPresentation, CommandCenterResultGroupId } from "../../../lib/command-center";
import { formatShortcutKey } from "../../../lib/keyboard-shortcuts";

type OmnibarResultListProps = {
  listRef: RefObject<HTMLDivElement | null>;
  query: string;
  loading: boolean;
  failed: boolean;
  results: RankedOmnibarResult[];
  presentation: CommandCenterPresentation<RankedOmnibarResult>;
  groupLabels: Record<CommandCenterResultGroupId, string>;
  rowVisualContext: OmnibarRowVisualContext;
  activeResult: RankedOmnibarResult | undefined;
  activeResultId: string | null;
  expandedPreviewId: string | null;
  asideShown: boolean;
  mariEnabled: boolean;
  resultVisual: (result: RankedOmnibarResult) => CommandCenterVisual;
  selectResult: (result: RankedOmnibarResult) => void;
  handleResultMouseMove: (result: RankedOmnibarResult, event: MouseEvent<HTMLLIElement>) => void;
  renderResultPreview: () => ReactNode;
  renderAsideAnswer: () => ReactNode;
  resultEnterHint: (result: RankedOmnibarResult) => string;
  runScopedChoiceChange: (result: RankedOmnibarResult, value: string | boolean) => void;
  resultControlPending: (result: RankedOmnibarResult) => boolean;
  flipToggleControl: (result: RankedOmnibarResult, nextValue: boolean) => void;
};

/** The search result list: grouped rows, each with its preview, inline control and Enter hint. */
export function OmnibarResultList({
  listRef,
  query,
  loading,
  failed,
  results,
  presentation,
  groupLabels,
  rowVisualContext,
  activeResult,
  activeResultId,
  expandedPreviewId,
  asideShown,
  mariEnabled,
  resultVisual,
  selectResult,
  handleResultMouseMove,
  renderResultPreview,
  renderAsideAnswer,
  resultEnterHint,
  runScopedChoiceChange,
  resultControlPending,
  flipToggleControl,
}: OmnibarResultListProps) {
  const { t } = useTranslation();
  const nowActionLabel = (now: NonNullable<OmnibarResult["now"]>) =>
    ({
      review: t("commandCenter.now.review", "Review"),
      fix: t("commandCenter.now.fix", "Fix"),
      check: t("commandCenter.now.check", "Check"),
      working: t("commandCenter.open", "Open"),
      finished: t("commandCenter.now.see", "See"),
      setup: t("commandCenter.now.setup", "Set up"),
    })[now];
  return (
    <div className="flex min-h-0 flex-1">
      <div
        ref={listRef}
        id="global-omnibar-results"
        aria-label={t("omnibar.results", "Search results")}
        data-component="GlobalOmnibar.Results"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(0.5rem,var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] pt-2"
      >
        {query.trim() && loading && results.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center text-sm text-[var(--muted-foreground)]">
            <Loader2 className="mr-2 animate-spin" size={16} />
            {t("omnibar.loading", "Loading results")}
          </div>
        ) : null}
        {failed ? (
          <div role="status" className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {t("omnibar.error", "Some results could not be loaded")}
          </div>
        ) : null}
        {presentation.groups.map((group) => {
          const GroupIcon =
            group.id === "try"
              ? Lightbulb
              : group.id === "professor-suggested"
                ? Sparkles
                : group.id === "current-work" || group.id === "context"
                  ? Compass
                  : group.id === "continue"
                    ? Sparkles
                    : group.id === "recent" || group.id === "frecent"
                      ? Clock3
                      : group.id === "quick-controls"
                        ? SlidersHorizontal
                        : LayoutGrid;
          // A group that mixes kinds names each row's type on line 1.
          const mixedGroup = new Set(group.results.map((item) => item.category)).size > 1;
          return (
            <section
              key={group.id}
              aria-labelledby={group.id === "now" ? undefined : `omnibar-group-${group.id}`}
              aria-label={group.id === "now" ? t("commandCenter.groups.now", "Needs you now") : undefined}
            >
              {/* Slice 78: the Now row speaks for itself; a heading over one row is noise. */}
              <div className={cn("flex items-center gap-1.5 px-3 pb-1 pt-3", group.id === "now" && "hidden")}>
                <GroupIcon size={12} className="text-[var(--primary)]" aria-hidden="true" />
                <h3
                  id={`omnibar-group-${group.id}`}
                  className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]"
                >
                  {groupLabels[group.id]}
                </h3>
                <span className="text-[0.625rem] text-[var(--muted-foreground)]/70">{group.results.length}</span>
              </div>
              <ul
                className={cn(
                  "space-y-0.5 px-1",
                  // Slice 78: Continue is a strip of three cards on wider screens, plain rows on a phone.
                  group.id === "continue" && "sm:grid sm:grid-cols-3 sm:gap-2 sm:space-y-0",
                  group.id === "now" && "pt-2",
                )}
              >
                {group.results.map((result, rowIndex) => {
                  const visual = resultVisual(result);
                  const preview = result.preview?.();
                  const row = resolveOmnibarRowVisual(result, rowVisualContext, preview);
                  const selected = result.id === activeResult?.id;
                  const setupStatus =
                    result.command.availability?.status === "requires-capability"
                      ? t("commandCenter.setup", "Set up")
                      : result.command.availability?.status === "requires-admin"
                        ? t("commandCenter.adminRequired", "Administrator access required")
                        : undefined;
                  return (
                    <CommandCenterResultRow
                      key={result.id}
                      className={cn(
                        "motion-safe:animate-omnibar-row-in",
                        // A hit line under its chat row: indented, one line tall on desktop.
                        result.parentId && "ml-7 min-h-11 sm:h-9",
                        result.now && `omnibar-now-row omnibar-now-row--${result.now}`,
                        group.id === "continue" &&
                          "sm:h-auto sm:min-h-16 sm:border sm:border-[var(--border)] sm:py-1.5",
                      )}
                      style={{ animationDelay: `${Math.min(rowIndex, 8) * 22}ms` }}
                      dataResultId={result.id}
                      id={`omnibar-${result.id}`}
                      title={result.title}
                      titleHighlight={row.titleMatch}
                      metadata={resultMetadata(result, preview)}
                      // The highlight only lines up with `description` itself: a
                      // contextLabel or preview subtitle shown in its place is
                      // different text, so it gets no highlight rather than a wrong one.
                      metadataHighlight={!result.contextLabel && !preview?.subtitle ? row.descriptionMatch : null}
                      excerpt={result.excerpt}
                      excerptHighlight={result.excerptMatch}
                      tertiaryMetadata={
                        <>
                          {result.meta ? <span className="shrink-0">{result.meta}</span> : null}
                          {preview?.lorebookCount ? (
                            // Q6: a chat's attached lorebooks, as the lorebook icon and a count.
                            <span
                              className="inline-flex shrink-0 items-center gap-0.5"
                              title={t("commandCenter.chat.lorebookCount", {
                                count: preview.lorebookCount,
                              })}
                            >
                              <ResultTypeIcon type="lorebook" glyph className="size-3" />
                              {preview.lorebookCount}
                            </span>
                          ) : null}
                          {
                            // A toggle/action control already shows the on/active state, so
                            // the status label ("Enabled"/"Active") next to it is redundant —
                            // keep only the informative metadata line in that case.
                            result.control?.type === "toggle"
                              ? preview?.metadataLine
                              : (preview?.status?.label ?? preview?.badges?.[0] ?? preview?.metadataLine)
                          }
                        </>
                      }
                      icon={row.icon}
                      type={row.type}
                      faces={row.faces}
                      faceCount={row.faceCount}
                      selected={selected}
                      onSelect={() => selectResult(result)}
                      onMouseMove={(event) => handleResultMouseMove(result, event)}
                      expanded={
                        result.id === expandedPreviewId
                          ? renderResultPreview()
                          : asideShown &&
                              selected &&
                              result.id === "ask-professor-mari" &&
                              result.group === "professor-suggested"
                            ? renderAsideAnswer()
                            : undefined
                      }
                      mediaSrc={row.src}
                      mediaKind={row.kind}
                      avatarCropStyle={row.avatarCropStyle}
                      groupClassName={visual.groupClassName}
                      inline={Boolean(result.parentId)}
                      typeLabel={
                        // Line 1 names the type only where the list mixes types, and always for a chat's mode.
                        result.category === "chat" || mixedGroup ? preview?.categoryLabel : undefined
                      }
                      meta={result.meta}
                      accent={row.accent}
                      setupStatus={setupStatus}
                      enterHint={
                        result.control || group.id === "continue" || result.now ? undefined : resultEnterHint(result)
                      }
                      control={
                        result.now && !result.control ? (
                          // One quiet pill that says what the row does, also on a phone.
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => selectResult(result)}
                            className="omnibar-now-action"
                          >
                            {nowActionLabel(result.now)}
                          </button>
                        ) : result.control?.type === "choice" ? (
                          <CommandCenterSegmentedChoice
                            label={result.control.label}
                            value={String(result.control.value)}
                            // F5: ArrowDown/ArrowUp moves `activeResultId` onto an expanded
                            // option row below this one (ids encode the parent + value); show
                            // that pick on the inline segments too, since the expanded rows
                            // themselves render nowhere a keyboard user can see them.
                            pendingValue={
                              activeResultId && readChoiceOptionId(activeResultId)?.parentId === result.id
                                ? readChoiceOptionId(activeResultId)?.value
                                : undefined
                            }
                            options={(result.control.options ?? []).map((option) => ({ ...option }))}
                            onValueChange={(value) => runScopedChoiceChange(result, value)}
                            variant="compact"
                          />
                        ) : result.category === "preset" && result.control?.type === "toggle" ? (
                          // Only the preset's own row: an "Add preset to this chat" row
                          // showed a button that did nothing and hid its Enter hint.
                          <CommandCenterActionValue
                            label={t("commandCenter.actions.setDefaultPreset", "Set default preset")}
                            icon={ArrowRight}
                            value={
                              result.control?.value === true ? t("commandCenter.values.active", "Active") : undefined
                            }
                            onClick={() => {
                              if (result.control?.type === "toggle") result.control.onChange(true);
                            }}
                            disabled={result.control?.value === true || resultControlPending(result)}
                            loading={resultControlPending(result)}
                            variant="compact"
                            tone="primary"
                            className="justify-end"
                          />
                        ) : result.control?.type === "toggle" ? (
                          <CommandCenterToggle
                            label={result.control.label}
                            checked={Boolean(result.control.value)}
                            stateLabel={
                              result.control.value
                                ? t("commandCenter.values.enabled", "Enabled")
                                : t("commandCenter.values.disabled", "Disabled")
                            }
                            onCheckedChange={(value) => flipToggleControl(result, value)}
                            disabled={resultControlPending(result)}
                            loading={resultControlPending(result)}
                            variant="compact"
                            className="justify-end"
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
              </ul>
            </section>
          );
        })}
        {!query.trim() ? (
          // Slice 78: what to type and what Enter does, under every empty list.
          <p className="flex items-start gap-2 px-3.5 pb-2 pt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
            <Search size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              {window.matchMedia("(min-width: 640px)").matches
                ? mariEnabled
                  ? t(
                      "commandCenter.empty.hintDesktop",
                      "Type a name, a setting or a question. Enter opens the top row; {{mod}}+Enter asks Professor Mari.",
                      { mod: formatShortcutKey("Mod") },
                    )
                  : t("commandCenter.empty.hintDesktopNoMari", "Type a name or a setting. Enter opens the top row.")
                : mariEnabled
                  ? t(
                      "commandCenter.empty.hintPhone",
                      "Type a name, a setting or a question. Tap a row to open it; a question goes to Professor Mari.",
                    )
                  : t("commandCenter.empty.hintPhoneNoMari", "Type a name or a setting, then tap a row.")}
            </span>
          </p>
        ) : null}
        {!loading && query.trim() && results.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center px-4 text-center">
            <Search size={20} className="mb-2 text-[var(--muted-foreground)]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t("commandCenter.noResults", "No matching results")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
