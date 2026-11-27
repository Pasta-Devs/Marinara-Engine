import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "../lib/utils";

/** Enhance committed markdown without changing the shared chat/HTML renderer. */
export function useCodeBlockCopy(container: HTMLElement | null, rendered: ReactNode) {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    if (!container || !rendered) return;
    // A button's click outlives the run that made it, and `t` stays in the language it was made in, so labels
    // use i18n.t (the language now). A language switch still gives a new `t`, which reruns this to relabel.
    const label = (button: HTMLButtonElement) => {
      const state = button.dataset.copyState;
      const text = i18n.t(
        state === "copied" ? "markdown.copied" : state === "failed" ? "markdown.copyFailed" : "markdown.copy",
      );
      const name = state ? text : i18n.t("markdown.copyCode");
      // Only a change is written: the same words again would make the live region read them out again.
      if (button.textContent !== text) button.textContent = text;
      if (button.getAttribute("aria-label") !== name) button.setAttribute("aria-label", name);
    };
    // The strip that carries Copy reaches through the block's bottom and right padding to the corner
    // (globals.css), and themes set their own padding, so the strip reads the block's padding as it is.
    const fitDock = (block: Element) => {
      const dock = block.querySelector<HTMLElement>(":scope > .docs-copy-dock");
      if (!dock) return;
      const style = getComputedStyle(block);
      // Only a change is written, so a steady block causes no style mutations.
      if (dock.style.getPropertyValue("--code-copy-pad") !== style.paddingBottom)
        dock.style.setProperty("--code-copy-pad", style.paddingBottom);
      if (dock.style.getPropertyValue("--code-copy-pad-right") !== style.paddingRight)
        dock.style.setProperty("--code-copy-pad-right", style.paddingRight);
    };
    // A theme switch changes the padding without a re-render; it also changes the block's size, so this hears it.
    const resized = new ResizeObserver((entries) => entries.forEach((entry) => fitDock(entry.target)));
    container.querySelectorAll<HTMLPreElement>("pre.mari-md-codeblock").forEach((block) => {
      // A re-render runs this again, so a block keeps the button it has. A new button in its place
      // would lose a focus, tap or key press that is still under way.
      let button = block.querySelector<HTMLButtonElement>(":scope > .docs-copy-dock > .docs-copy-button");
      if (!button) {
        // The button rides in a zero-height strip at the end of the block that sticks to the bottom of the
        // block's visible area (globals.css), so Copy stays in the corner while a tall block scrolls.
        const dock = document.createElement("div");
        dock.className = "docs-copy-dock";
        const created = document.createElement("button");
        created.type = "button";
        created.setAttribute("aria-live", "polite");
        created.className =
          "docs-copy-button min-h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-sans text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]";
        let resetTimer: ReturnType<typeof setTimeout> | undefined;
        created.addEventListener("click", async () => {
          const copied = await copyToClipboard(block.querySelector("code")?.textContent ?? "");
          created.dataset.copyState = copied ? "copied" : "failed";
          label(created);
          clearTimeout(resetTimer);
          resetTimer = setTimeout(() => {
            delete created.dataset.copyState;
            label(created);
          }, 1500);
        });
        dock.appendChild(created);
        block.appendChild(dock);
        button = created;
      }
      label(button);
      fitDock(block);
      resized.observe(block);
    });
    return () => resized.disconnect();
  }, [container, rendered, i18n, t]);
}
