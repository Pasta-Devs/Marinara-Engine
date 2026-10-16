import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { completeMacro } from "../../lib/macro-completion";
import { insertTextAtCaret } from "../../lib/textarea-editing";
import { InlineGhostText } from "./InlineGhostText";

export interface MacroCompletion {
  /** Field text up to the caret; drawn transparent so the suffix lands at the caret. */
  before: string;
  suffix: string;
  /** Where the textarea sits inside its positioned wrapper. */
  box: CSSProperties;
  /** The textarea's own font and padding, so the ghost wraps exactly like the field. */
  text: CSSProperties;
  scrollLeft: number;
  scrollTop: number;
}

// Prompt fields get their font and padding from many callers' classes, so the
// ghost copies the computed values instead of repeating the class names.
const MIRRORED_PROPERTIES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "textIndent",
  "tabSize",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
] as const;

function measure(textarea: HTMLTextAreaElement): Pick<MacroCompletion, "box" | "text"> {
  const computed = getComputedStyle(textarea);
  const text: Record<string, string> = {};
  for (const property of MIRRORED_PROPERTIES) text[property] = computed[property];
  // A vertical scrollbar narrows the textarea's text column; widen the padding to wrap at the same place.
  const borders = parseFloat(computed.borderLeftWidth) + parseFloat(computed.borderRightWidth);
  const scrollbar = textarea.offsetWidth - textarea.clientWidth - borders;
  if (scrollbar > 0) text.paddingRight = `${parseFloat(computed.paddingRight) + scrollbar}px`;
  return {
    box: {
      top: textarea.offsetTop,
      left: textarea.offsetLeft,
      width: textarea.offsetWidth,
      height: textarea.offsetHeight,
    },
    text,
  };
}

// The scripted insert bypasses the browser's own maxLength check, so never offer what would overflow it.
function fitsMaxLength(textarea: HTMLTextAreaElement, suffix: string) {
  return textarea.maxLength < 0 || textarea.value.length + suffix.length <= textarea.maxLength;
}

/**
 * Macro ghost-text for a textarea: typing `{{ch` greys in `ar}}` and Tab accepts it,
 * like the omnibar and the Professor Mari composer; tapping the ghost accepts it too,
 * for phone keyboards without Tab. Attach `textareaRef`, call
 * `refresh` on focus, select and scroll, `clear` on blur, and `accept` first in keydown.
 */
export function useMacroCompletion(enabled: boolean, value: string) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [completion, setCompletion] = useState<MacroCompletion | null>(null);

  const refresh = useCallback(() => {
    const textarea = textareaRef.current;
    if (
      !enabled ||
      !textarea ||
      textarea.ownerDocument.activeElement !== textarea ||
      textarea.selectionStart !== textarea.selectionEnd
    ) {
      setCompletion(null);
      return;
    }
    const caret = textarea.selectionStart;
    const suffix = completeMacro(textarea.value, caret);
    if (!suffix || !fitsMaxLength(textarea, suffix)) {
      setCompletion(null);
      return;
    }
    setCompletion({
      before: textarea.value.slice(0, caret),
      suffix,
      ...measure(textarea),
      scrollLeft: textarea.scrollLeft,
      scrollTop: textarea.scrollTop,
    });
  }, [enabled]);

  // The field is controlled, so check again once the new value is in the DOM.
  useLayoutEffect(refresh, [refresh, value]);

  // A resize (drag handle, phone rotation) changes the wrapping, so re-measure while a ghost shows.
  const showing = completion !== null;
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!showing || !textarea || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => refresh());
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [refresh, showing]);

  const clear = useCallback(() => setCompletion(null), []);

  /** Inserts the suggestion. Returns false when there is none or it no longer fits the field's maxLength. */
  const insert = useCallback(() => {
    const textarea = textareaRef.current;
    if (!completion || !textarea || !fitsMaxLength(textarea, completion.suffix)) return false;
    insertTextAtCaret(textarea, completion.suffix);
    return true;
  }, [completion]);

  /** Accepts the ghost on a plain Tab. Returns true when it handled the key. */
  const accept = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (
        !completion ||
        event.defaultPrevented ||
        event.key !== "Tab" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.nativeEvent.isComposing
      ) {
        return false;
      }
      // Over maxLength: let Tab fall through to indenting instead of claiming an insert.
      if (!insert()) return false;
      event.preventDefault();
      return true;
    },
    [completion, insert],
  );

  return { textareaRef, completion, refresh, clear, accept, insert };
}

/** Draws the macro ghost over its textarea. Render it right after the textarea, inside a positioned wrapper. */
export function MacroCompletionGhost({
  completion,
  onAccept,
}: {
  completion: MacroCompletion | null;
  /** Tapping the ghost accepts it; pass the hook's `insert`. */
  onAccept: () => void;
}) {
  if (!completion) return null;
  return (
    <div
      data-component="MacroCompletionGhost"
      className="pointer-events-none absolute overflow-hidden"
      style={completion.box}
    >
      <InlineGhostText
        value={completion.before}
        suffix={completion.suffix}
        multiline
        scrollLeft={completion.scrollLeft}
        scrollTop={completion.scrollTop}
        // Grow with the text and let the outer box clip, so a scrolled field still shows the caret line.
        className="bottom-auto box-border min-h-full overflow-visible border-solid border-transparent"
        style={completion.text}
        onAccept={onAccept}
      />
    </div>
  );
}
