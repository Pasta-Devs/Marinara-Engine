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
    container.querySelectorAll<HTMLPreElement>("pre.mari-md-codeblock").forEach((block) => {
      // A re-render runs this again, so a block keeps the button it has. A new button in its place
      // would lose a focus, tap or key press that is still under way.
      let button = block.querySelector<HTMLButtonElement>(":scope > .docs-copy-button");
      if (!button) {
        const created = document.createElement("button");
        created.type = "button";
        created.setAttribute("aria-live", "polite");
        created.className =
          "docs-copy-button absolute bottom-1.5 right-1.5 min-h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-sans text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]";
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
        block.appendChild(created);
        button = created;
      }
      label(button);
    });
  }, [container, rendered, i18n, t]);
}
