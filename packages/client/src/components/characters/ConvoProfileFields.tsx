// ──────────────────────────────────────────────
// Conversation-mode profile fields — display name, "about me",
// and behavior directive. Shared by the character and persona editors.
// These fields only affect Conversation mode; they are never read in RP/VN/Game.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Smile } from "lucide-react";
import { type ConvoBehaviorConfig, type ConvoBehaviorInsertionStrategy } from "@marinara-engine/shared";
import { MacroTextarea } from "../ui/MacroTextarea";
import { EmojiPicker } from "../ui/EmojiPicker";
import { HelpTooltip } from "../ui/HelpTooltip";
import { useTranslation as useUiTranslation } from "react-i18next";

const STRATEGY_OPTIONS: Array<{ value: ConvoBehaviorInsertionStrategy; label: string }> = [
  { value: "constant_after", label: "Constant — after the card" },
  { value: "constant_before", label: "Constant — before the card" },
  { value: "post_history_after", label: "Append to post-history" },
  { value: "post_history_before", label: "Prepend to post-history" },
  { value: "post_history_replace", label: "Replace post-history" },
  { value: "macro", label: "Only where {{convo_behavior}} is placed" },
];

interface ConvoProfileFieldsProps {
  kind: "character" | "persona";
  /** Stable edited entity key, used to reset transient UI state on switches. */
  entityKey?: string;
  /** Base name, used as the display-name placeholder. */
  baseName: string;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  /** When true, the display name is declared on the card in the convo prompt. */
  displayNameInCard?: boolean;
  onDisplayNameInCardChange?: (value: boolean) => void;
  aboutMe: string;
  onAboutMeChange: (value: string) => void;
  behavior: ConvoBehaviorConfig | null | undefined;
  onBehaviorChange: (value: ConvoBehaviorConfig) => void;
  imageInstructions?: string;
  onImageInstructionsChange?: (value: string) => void;
  applyImageInstructionsToNoodle?: boolean;
  onApplyImageInstructionsToNoodleChange?: (value: boolean) => void;
}

export function ConvoProfileFields({
  kind,
  entityKey,
  baseName,
  displayName,
  onDisplayNameChange,
  displayNameInCard,
  onDisplayNameInCardChange,
  aboutMe,
  onAboutMeChange,
  behavior,
  onBehaviorChange,
  imageInstructions,
  onImageInstructionsChange,
  applyImageInstructionsToNoodle,
  onApplyImageInstructionsToNoodleChange,
}: ConvoProfileFieldsProps) {
  const { t: localizeUi } = useUiTranslation();
  const aboutMeRef = useRef<HTMLTextAreaElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  /** Stable Playwright prefix derived from the owning editor kind. */
  const testIdPrefix = `${kind}-editor`;

  // Snapshot the about-me right before the first manual edit so the user can
  // undo changes they do not like. Cleared once reverted.
  const [revertTo, setRevertTo] = useState<string | null>(null);
  useEffect(() => {
    setRevertTo(null);
    setEmojiOpen(false);
  }, [entityKey, kind]);

  const captureRevert = () => setRevertTo((prev) => (prev === null ? aboutMe : prev));
  const changeAboutMe = (value: string) => {
    captureRevert();
    onAboutMeChange(value);
  };

  // Insert an emoji at the caret (or replace the selection), like the chat picker.
  const insertEmoji = (token: string) => {
    const el = aboutMeRef.current;
    if (!el) {
      changeAboutMe(aboutMe + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    changeAboutMe(next);
    const caret = start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      try {
        el.selectionStart = el.selectionEnd = caret;
      } catch {
        /* ignore */
      }
    });
  };

  const behaviorInstruction = behavior?.instruction ?? "";
  const behaviorStrategy: ConvoBehaviorInsertionStrategy = behavior?.insertionStrategy ?? "constant_after";

  return (
    <div className="space-y-4" data-component="ConvoProfileFields">
      <div className="mari-editor-panel space-y-2 p-3">
        <span className="inline-flex items-center gap-1 text-xs font-semibold">
          {localizeUi("ui.characters.convoprofilefields.convoDisplayName")}
          <HelpTooltip text={localizeUi("ui.characters.convoprofilefields.shownAsThisPersonSNameInConversationMode")} />
        </span>
        <input
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder={baseName || "Display name"}
          data-testid={`${testIdPrefix}-convo-display-name-input`}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
        />
        {kind === "character" && onDisplayNameInCardChange && (
          <label className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={!!displayNameInCard}
              onChange={(e) => onDisplayNameInCardChange(e.target.checked)}
              data-testid={`${testIdPrefix}-convo-display-name-in-card-checkbox`}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--primary)]"
            />
            <span className="inline-flex items-center gap-1">
              {localizeUi("ui.characters.convoprofilefields.declareThisNameOnTheCardInThePrompt")}
              <HelpTooltip
                text={localizeUi("ui.characters.convoprofilefields.prependsALineLikeConversationDisplayNameXTo")}
              />
            </span>
          </label>
        )}
      </div>

      <div className="mari-editor-panel space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            {localizeUi("ui.characters.convoprofilefields.aboutMe")}
            <HelpTooltip
              text={localizeUi("ui.characters.convoprofilefields.aShortSelfAuthoredProfileBioShownInConversation")}
            />
          </span>
        </div>
        <MacroTextarea
          value={aboutMe}
          onChange={changeAboutMe}
          textareaRef={aboutMeRef}
          placeholder={localizeUi("ui.characters.convoprofilefields.aLineOrTwoAnEmojiAJokeOr")}
          rows={5}
          title={localizeUi("ui.characters.convoprofilefields.aboutMe")}
          testId={`${testIdPrefix}-convo-about-me-textarea`}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          toolbarExtra={
            <button
              ref={emojiBtnRef}
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              aria-label={localizeUi("ui.characters.convoprofilefields.insertEmoji")}
              title={localizeUi("ui.characters.convoprofilefields.insertEmoji")}
              data-testid={`${testIdPrefix}-convo-about-me-emoji-button`}
              className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <Smile className="h-3 w-3" />
            </button>
          }
        />
        <EmojiPicker
          open={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onSelect={insertEmoji}
          anchorRef={emojiBtnRef}
        />
        {revertTo !== null && revertTo !== aboutMe && (
          <button
            type="button"
            onClick={() => {
              onAboutMeChange(revertTo);
              setRevertTo(null);
            }}
            title={localizeUi("ui.characters.convoprofilefields.undoTheChangesToThisAboutMe")}
            data-testid={`${testIdPrefix}-convo-about-me-revert-button`}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <RotateCcw size="0.8125rem" />
            {localizeUi("ui.characters.convoprofilefields.revert")}
          </button>
        )}
      </div>

      {kind === "character" && (
        <div className="mari-editor-panel space-y-3 p-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            {localizeUi("ui.characters.convoprofilefields.convoBehavior")}
            <HelpTooltip
              wide
              text={localizeUi("ui.characters.convoprofilefields.aConversationModeOnlyInstructionForHowThisPerson")}
            />
          </span>
          <MacroTextarea
            value={behaviorInstruction}
            onChange={(value) => onBehaviorChange({ instruction: value, insertionStrategy: behaviorStrategy })}
            placeholder={localizeUi("ui.characters.convoprofilefields.eGKeepRepliesShortAndLowercaseTextsLike")}
            rows={4}
            title={localizeUi("ui.characters.convoprofilefields.convoBehavior")}
            testId={`${testIdPrefix}-convo-behavior-textarea`}
            className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          />
          <label className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">
              {localizeUi("ui.characters.convoprofilefields.insertion")}
            </span>
            <select
              value={behaviorStrategy}
              onChange={(e) =>
                onBehaviorChange({
                  instruction: behaviorInstruction,
                  insertionStrategy: e.target.value as ConvoBehaviorInsertionStrategy,
                })
              }
              data-testid={`${testIdPrefix}-convo-behavior-insertion-select`}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs outline-none"
            >
              {STRATEGY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {kind === "character" && onImageInstructionsChange && onApplyImageInstructionsToNoodleChange && (
        <div className="mari-editor-panel space-y-3 p-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            {localizeUi("ui.characters.convoprofilefields.imageGenerationInstructions")}
            <HelpTooltip wide text={localizeUi("ui.characters.convoprofilefields.imageGenerationInstructionsHelp")} />
          </span>
          <textarea
            value={imageInstructions ?? ""}
            onChange={(event) => onImageInstructionsChange(event.target.value)}
            placeholder={localizeUi("ui.characters.convoprofilefields.imageGenerationInstructionsPlaceholder")}
            rows={5}
            data-testid={`${testIdPrefix}-convo-image-instructions-textarea`}
            className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          />
          <label className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={!!applyImageInstructionsToNoodle}
              onChange={(event) => onApplyImageInstructionsToNoodleChange(event.target.checked)}
              data-testid={`${testIdPrefix}-convo-image-instructions-noodle-checkbox`}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--primary)]"
            />
            <span>{localizeUi("ui.characters.convoprofilefields.applyImageInstructionsToNoodle")}</span>
          </label>
        </div>
      )}
    </div>
  );
}
