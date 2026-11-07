// ──────────────────────────────────────────────
// Skip links (theming panel, batch 6)
//
// The first things Tab reaches: jump past the top bar and sidebars to the page, or straight to the
// message box when a chat is open. Hidden until focused (styles/accessibility.css).
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";

function focusTarget(selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return false;
  target.focus({ preventScroll: false });
  return document.activeElement === target;
}

export function SkipLinks() {
  const { t } = useTranslation();
  return (
    <div className="mari-skip-links">
      <a
        href="#mari-main"
        className="mari-skip-link"
        onClick={(event) => {
          event.preventDefault();
          focusTarget("#mari-main");
        }}
      >
        {t("theming.a11y.skipToContent", "Skip to content")}
      </a>
      <a
        href="#mari-main"
        className="mari-skip-link"
        onClick={(event) => {
          event.preventDefault();
          if (!focusTarget('[data-mari-part="composer"] textarea')) focusTarget("#mari-main");
        }}
      >
        {t("theming.a11y.skipToComposer", "Skip to message box")}
      </a>
    </div>
  );
}
