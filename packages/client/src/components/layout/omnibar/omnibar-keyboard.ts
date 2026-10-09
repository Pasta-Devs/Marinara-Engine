import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from "react";
import { type OmnibarPane, type RankedOmnibarResult, isRichResult } from "./omnibar-result-view";
import type { ProfessorMariNavigationTarget } from "../../../lib/professor-mari-navigation";
import type { OmnibarResult } from "../../../lib/omnibar-search";
import { readChoiceOptionId } from "../../../lib/omnibar-choice-rows";

type OmnibarKeyHandlerInput = {
  panelRef: RefObject<HTMLDivElement | null>;
  listRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  autoSelectionRef: RefObject<boolean>;
  pane: OmnibarPane;
  query: string;
  inlineSuffix: string;
  results: RankedOmnibarResult[];
  activeIndex: number;
  activeResult: RankedOmnibarResult | undefined;
  expandedPreviewId: string | null;
  expandedChoiceId: string | null;
  mariEnabled: boolean;
  asideSettled: boolean;
  setQuery: (query: string) => void;
  setPane: (pane: OmnibarPane) => void;
  setActiveResultId: (id: string | null) => void;
  setExpandedPreviewId: Dispatch<SetStateAction<string | null>>;
  setExpandedChoiceId: Dispatch<SetStateAction<string | null>>;
  setMariChatOpen: (open: boolean) => void;
  focusMariReturnRow: () => void;
  onClose: () => void;
  choose: (result: OmnibarResult) => void;
  chooseChoiceOption: (result: RankedOmnibarResult) => boolean;
  flipToggleControl: (result: RankedOmnibarResult, nextValue: boolean) => void;
  navigate: (target: ProfessorMariNavigationTarget) => boolean;
  recordUse: (id: string) => void;
  askMariAbout: (result: RankedOmnibarResult | null) => void;
  escalateAside: (question?: string) => void;
  openProfessorMari: (selectedResult?: null, options?: { submitDraft?: boolean }) => void;
  resolveCurrentResult: (result: RankedOmnibarResult | null) => RankedOmnibarResult | null;
};

/** The search field's keys (arrows, Enter, Tab, Escape) and the dialog's focus trap. */
export function createOmnibarKeyHandlers({
  panelRef,
  listRef,
  inputRef,
  autoSelectionRef,
  pane,
  query,
  inlineSuffix,
  results,
  activeIndex,
  activeResult,
  expandedPreviewId,
  expandedChoiceId,
  mariEnabled,
  asideSettled,
  setQuery,
  setPane,
  setActiveResultId,
  setExpandedPreviewId,
  setExpandedChoiceId,
  setMariChatOpen,
  focusMariReturnRow,
  onClose,
  choose,
  chooseChoiceOption,
  flipToggleControl,
  navigate,
  recordUse,
  askMariAbout,
  escalateAside,
  openProfessorMari,
  resolveCurrentResult,
}: OmnibarKeyHandlerInput) {
  const handleEscape = () => {
    if (expandedPreviewId || expandedChoiceId) {
      // One expansion, one press. Collapsing does not close the omnibar.
      setExpandedPreviewId(null);
      setExpandedChoiceId(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (pane === "mari") {
      setMariChatOpen(false);
      setPane("results");
      focusMariReturnRow();
    } else onClose();
  };
  const moveSelection = (index: number) => {
    const next = results[index];
    autoSelectionRef.current = false;
    setActiveResultId(next?.id ?? null);
    if (expandedPreviewId) setExpandedPreviewId(next && isRichResult(next) ? next.id : null);
  };
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // An IME (Chinese, Japanese, ...) confirms its candidate with Enter, and
    // arrows move its candidate list, and Escape cancels the composition; none
    // of them belong to the result list or the dialog's own Escape handling.
    if (event.nativeEvent.isComposing) {
      event.stopPropagation();
      return;
    }
    if (event.key === "Tab" && !event.shiftKey && inlineSuffix) {
      // Accept the ghost completion instead of leaving the field.
      event.preventDefault();
      setQuery(query + inlineSuffix);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleEscape();
    } else if (pane === "results" && event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(Math.min(Math.max(activeIndex, -1) + 1, results.length - 1));
    } else if (pane === "results" && event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(Math.max(activeIndex < 0 ? 0 : activeIndex - 1, 0));
    } else if (pane === "results" && !query && event.key === "Home") {
      // With text in the field, Home/End move the caret (editable combobox); only an empty field jumps the list.
      event.preventDefault();
      moveSelection(0);
    } else if (pane === "results" && !query && event.key === "End") {
      event.preventDefault();
      moveSelection(results.length - 1);
    } else if (
      mariEnabled &&
      pane === "results" &&
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      asideSettled &&
      (!activeResult || activeResult.id === "ask-professor-mari")
    ) {
      // No real row selected (the generic Ask-Mari row doesn't count), and the
      // aside is answering: ⌘↵ escalates it instead of just asking again (R25).
      event.preventDefault();
      escalateAside();
    } else if (
      mariEnabled &&
      pane === "results" &&
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      activeResult &&
      activeResult.command.availability?.status !== "requires-admin"
    ) {
      // Continue the selected result with Mari without opening the detail pane first.
      event.preventDefault();
      askMariAbout(resolveCurrentResult(activeResult));
    } else if (pane === "results" && event.key === "Enter" && !activeResult && mariEnabled && query.trim()) {
      // Nothing ranked at all, so Enter still reaches Mari by the one door.
      event.preventDefault();
      askMariAbout(null);
    } else if (
      pane === "results" &&
      event.key === "Enter" &&
      event.shiftKey &&
      activeResult &&
      activeResult.id.startsWith("settings-control:") &&
      activeResult.control?.type === "toggle" &&
      activeResult.target
    ) {
      // Enter flips a bound toggle in place (K5); Shift+Enter keeps the pre-K5
      // path of navigating to the control's spot in Settings instead.
      event.preventDefault();
      if (navigate(activeResult.target)) {
        recordUse(activeResult.id);
        onClose();
      }
    } else if (pane === "results" && event.key === "Enter" && activeResult) {
      event.preventDefault();
      if (chooseChoiceOption(activeResult)) return;
      if (activeResult.control?.type === "toggle") flipToggleControl(activeResult, activeResult.control.value !== true);
      else if (activeResult.control?.type === "choice")
        setExpandedChoiceId((current) => (current === activeResult.id ? null : activeResult.id));
      else if (mariEnabled && activeResult.id === "ask-professor-mari") {
        // An answer grown inside the promoted row goes along with the question (G3).
        if (asideSettled && activeResult.group !== "continue") escalateAside();
        else openProfessorMari(null, { submitDraft: true });
      } else choose(activeResult);
    } else if (pane === "results" && event.key === "ArrowLeft" && activeResult && expandedPreviewId) {
      event.preventDefault();
      setExpandedPreviewId(null);
    } else if (
      pane === "results" &&
      event.key === "ArrowLeft" &&
      activeResult &&
      expandedChoiceId &&
      (activeResult.id === expandedChoiceId || readChoiceOptionId(activeResult.id)?.parentId === expandedChoiceId)
    ) {
      // Collapse before the generic ArrowLeft below returns focus to the input,
      // so one press does one thing.
      event.preventDefault();
      setExpandedChoiceId(null);
      setActiveResultId(expandedChoiceId);
    } else if (
      pane === "results" &&
      event.key === "ArrowRight" &&
      activeResult &&
      activeResult.control?.type === "choice"
    ) {
      event.preventDefault();
      setExpandedChoiceId(activeResult.id);
    } else if (pane === "results" && event.key === "ArrowRight" && activeResult && isRichResult(activeResult)) {
      event.preventDefault();
      setExpandedPreviewId((current) => (current === activeResult.id ? null : activeResult.id));
    }
  };
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    // L8: the omnibar may sit over a dialog or the game setup wizard. An Escape
    // pressed inside it (also one a menu or row already handled) is its own, so
    // it must not reach their document/window listeners and close them too.
    if (event.key === "Escape" && panelRef.current?.contains(event.target as Node)) event.stopPropagation();
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      handleEscape();
      return;
    }
    const focusedRow = (event.target as HTMLElement).closest<HTMLElement>("[data-command-center-result-row]");
    const focusedRowButton = focusedRow?.querySelector<HTMLElement>(":scope > button");
    if (focusedRow && event.target === focusedRowButton && pane === "results") {
      const rowId = focusedRow.dataset.resultId;
      // Hover moves the highlight without moving DOM focus, so arrows continue
      // from what is highlighted — otherwise they jump back to the focused row.
      const rowIndex = activeIndex >= 0 ? activeIndex : results.findIndex((result) => result.id === rowId);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? results.length - 1
              : event.key === "ArrowDown"
                ? Math.min(rowIndex + 1, results.length - 1)
                : Math.max(rowIndex - 1, 0);
        const next = results[nextIndex];
        if (next) {
          // Through `moveSelection`, so this path keeps the expansion in step
          // with the selection exactly as the input-focused arrows and hover do.
          moveSelection(nextIndex);
          listRef.current?.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(next.id)}"] button`)?.focus();
        }
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (event.key === "ArrowRight") {
        const focusedResult = results[rowIndex];
        if (focusedResult?.control?.type === "choice") {
          event.preventDefault();
          setExpandedChoiceId(focusedResult.id);
          return;
        }
        if (focusedResult && isRichResult(focusedResult)) {
          event.preventDefault();
          setExpandedPreviewId((current) => (current === focusedResult.id ? null : focusedResult.id));
          return;
        }
      }
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter(
      (element) =>
        !element.hasAttribute("disabled") &&
        !element.closest('[aria-hidden="true"], [inert]') &&
        element.getClientRects().length > 0,
    );
    if (focusable.length === 0) return;
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? current <= 0
        ? focusable.length - 1
        : current - 1
      : current === focusable.length - 1
        ? 0
        : current + 1;
    event.preventDefault();
    focusable[next]?.focus();
  };
  return { onInputKeyDown, trapFocus };
}
