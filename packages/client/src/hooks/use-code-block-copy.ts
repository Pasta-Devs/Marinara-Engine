import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "../lib/utils";

/** Enhance committed markdown without changing the shared chat/HTML renderer. */
export function useCodeBlockCopy(container: HTMLElement | null, rendered: ReactNode) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!container || !rendered) return;
    const cleanups: (() => void)[] = [];
    container.querySelectorAll<HTMLPreElement>("pre.mari-md-codeblock").forEach((block) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t("markdown.copy");
      button.setAttribute("aria-label", t("markdown.copyCode"));
      button.setAttribute("aria-live", "polite");
      button.className =
        "docs-copy-button absolute bottom-1.5 right-1.5 min-h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-sans text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]";
      let active = true;
      let resetTimer: ReturnType<typeof setTimeout> | undefined;
      const onClick = async () => {
        const copied = await copyToClipboard(block.querySelector("code")?.textContent ?? "");
        if (!active) return;
        button.textContent = t(copied ? "markdown.copied" : "markdown.copyFailed");
        button.setAttribute("aria-label", button.textContent);
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          button.textContent = t("markdown.copy");
          button.setAttribute("aria-label", t("markdown.copyCode"));
        }, 1500);
      };
      button.addEventListener("click", onClick);
      block.appendChild(button);
      cleanups.push(() => {
        active = false;
        clearTimeout(resetTimer);
        button.removeEventListener("click", onClick);
        button.remove();
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [container, rendered, t]);
}
