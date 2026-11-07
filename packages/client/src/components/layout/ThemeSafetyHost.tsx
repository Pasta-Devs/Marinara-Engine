// ──────────────────────────────────────────────
// Theme safety bar: "Keep this theme?", safe mode, and the guard's notice.
//
// Rendered into a shadow root on a <mari-theme-safety> element, which the protected cascade
// layer (index.html) pins to the bottom of the screen. A theme's CSS can't reach inside the
// shadow root, so the way back always stays visible and clickable, whatever the theme does.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSetActiveTheme, useThemes } from "../../hooks/use-themes";
import { useThemeSafetyStore, type ThemeGuardProblem } from "../../lib/theme-safety";
import { executeStateNavigation } from "../../lib/state-navigation";
import { requestThemeEdit } from "../../lib/theme-edit-request";
import { useUIStore } from "../../stores/ui.store";

const SHADOW_CSS = `
:host { all: initial; }
.wrap {
  display: flex; justify-content: center; padding: 0 12px calc(12px + env(safe-area-inset-bottom));
  pointer-events: none; font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.bar {
  pointer-events: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
  max-width: 640px; padding: 10px 12px 10px 14px; border-radius: 10px;
  background: #18181b; color: #f4f4f5; border: 1px solid #3f3f46;
  box-shadow: 0 8px 28px rgba(0,0,0,.45);
}
.text { flex: 1 1 260px; min-width: 0; }
.title { font-weight: 600; }
.sub { color: #a1a1aa; font-size: 12px; margin-top: 1px; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
button {
  font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; border-radius: 7px;
  padding: 6px 10px; border: 1px solid #52525b; background: #27272a; color: #f4f4f5;
}
button:hover { background: #3f3f46; }
button:focus-visible { outline: 2px solid #fafafa; outline-offset: 2px; }
button.primary { background: #f4f4f5; color: #18181b; border-color: #f4f4f5; }
button.primary:hover { background: #e4e4e7; }
button.icon { padding: 6px 8px; border-color: transparent; background: transparent; color: #a1a1aa; }
:host([data-scheme="light"]) {
  & .bar { background: #ffffff; color: #18181b; border-color: #d4d4d8; box-shadow: 0 8px 28px rgba(0,0,0,.18); }
  & .sub { color: #52525b; }
  & button { background: #f4f4f5; color: #18181b; border-color: #d4d4d8; }
  & button:hover { background: #e4e4e7; }
  & button:focus-visible { outline-color: #18181b; }
  & button.primary { background: #18181b; color: #fafafa; border-color: #18181b; }
  & button.primary:hover { background: #3f3f46; }
}
@media (prefers-reduced-motion: no-preference) {
  .bar { animation: rise .18s ease-out; }
  @keyframes rise { from { transform: translateY(8px); opacity: 0; } }
}
`;

function useShadowRoot(scheme: "dark" | "light") {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    if (root) (root.host as HTMLElement).dataset.scheme = scheme;
  }, [root, scheme]);
  useEffect(() => {
    const host = document.createElement("mari-theme-safety");
    // Outside <body>, so `body > *` rules in a theme can't reach the host either.
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = SHADOW_CSS;
    shadow.appendChild(style);
    setRoot(shadow);
    return () => host.remove();
  }, []);
  return root;
}

function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function problemText(t: ReturnType<typeof useTranslation>["t"], problem: ThemeGuardProblem) {
  const area = {
    topbar: t("theming.safety.area.topbar", "the top bar"),
    chats: t("theming.safety.area.chats", "the chats sidebar"),
    library: t("theming.safety.area.library", "the Library sidebar"),
    omnibar: t("theming.safety.area.omnibar", "Ctrl+K"),
    composer: t("theming.safety.area.composer", "the message box"),
    app: t("theming.safety.area.app", "the app"),
    chat: t("theming.safety.area.chat", "the chat"),
  }[problem.area];
  switch (problem.kind) {
    case "overlay":
      return t("theming.safety.problem.overlay", "It laid something over the whole app.");
    case "fake-text":
      return t(
        "theming.safety.problem.fakeText",
        "It added text to the chat that asks for private details: “{{text}}”.",
        {
          text: problem.text ?? "",
        },
      );
    case "hidden":
      return t("theming.safety.problem.hidden", "It hid {{area}}.", { area });
    case "moved":
      return t("theming.safety.problem.moved", "It moved {{area}} out of place.", { area });
    case "covered":
      return t("theming.safety.problem.covered", "It covered {{area}}, so it couldn't be clicked.", { area });
    case "unreadable":
      return t("theming.safety.problem.unreadable", "It made {{area}} unreadable.", { area });
    case "too-small":
      return t("theming.safety.problem.tooSmall", "It shrank {{area}} too far to use.", { area });
  }
}

export function ThemeSafetyHost() {
  const { t } = useTranslation();
  const scheme = useUIStore((s) => s.theme);
  const shadow = useShadowRoot(scheme === "light" ? "light" : "dark");
  const { data: themes = [] } = useThemes();
  const setActiveTheme = useSetActiveTheme();
  const safeMode = useThemeSafetyStore((s) => s.safeMode);
  const blockedThemeId = useThemeSafetyStore((s) => s.blockedThemeId);
  const blockedThemeName = useThemeSafetyStore((s) => s.blockedThemeName);
  const blockedProblems = useThemeSafetyStore((s) => s.blockedProblems);
  const pendingKeep = useThemeSafetyStore((s) => s.pendingKeep);
  const paused = pendingKeep?.pausedRemaining != null;
  const countdown = useCountdown(paused ? null : (pendingKeep?.deadline ?? null));
  const secondsLeft = paused ? Math.ceil((pendingKeep?.pausedRemaining ?? 0) / 1000) : countdown;
  const [blockedDismissed, setBlockedDismissed] = useState<string | null>(null);
  const activeTheme = themes.find((theme) => theme.isActive) ?? null;

  const revert = useMemo(
    () => () => {
      const pending = useThemeSafetyStore.getState().pendingKeep;
      if (!pending) return;
      useThemeSafetyStore.getState().settleKeep();
      // Picked something else meanwhile (here or on another device): nothing to go back from.
      const current = themes.find((theme) => theme.isActive)?.id ?? null;
      if (themes.length > 0 && current !== pending.themeId) return;
      setActiveTheme.mutate(pending.previousId, {
        onError: () => toast.error(t("theming.safety.revertFailed", "Couldn't switch the theme back.")),
      });
    },
    [setActiveTheme, t, themes],
  );

  // Nobody answered, or the guard caught the new theme breaking the chrome: go back to the one from before.
  useEffect(() => {
    if (!pendingKeep || paused) return;
    // After a reload, wait for the theme list so the check above knows what's active.
    if (themes.length === 0 && pendingKeep.deadline <= Date.now()) return;
    if (secondsLeft === 0 || blockedThemeId === pendingKeep.themeId) revert();
  }, [blockedThemeId, pendingKeep, paused, revert, secondsLeft, themes.length]);

  const turnOffEverywhere = () => {
    setActiveTheme.mutate(null, {
      onSuccess: () => {
        const state = useThemeSafetyStore.getState();
        state.clearBlockedTheme();
        if (state.safeMode) state.leaveSafeMode();
        toast.success(t("theming.safety.turnedOff", "Custom theme turned off. You're on the default look."));
      },
      onError: () => toast.error(t("theming.safety.turnOffFailed", "Couldn't turn the theme off. Try again.")),
    });
  };

  const editBlocked = () => {
    if (blockedThemeId) requestThemeEdit(blockedThemeId);
    executeStateNavigation({ kind: "settings", tab: "addons", sectionId: "theme-library" });
  };

  if (!shadow) return null;

  let bar: React.ReactNode = null;
  if (pendingKeep && blockedThemeId !== pendingKeep.themeId) {
    bar = (
      <div
        className="bar"
        role="alertdialog"
        aria-labelledby="mari-keep-title"
        onMouseEnter={() => useThemeSafetyStore.getState().pauseKeep(true)}
        onMouseLeave={() => useThemeSafetyStore.getState().pauseKeep(false)}
        onFocus={() => useThemeSafetyStore.getState().pauseKeep(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            useThemeSafetyStore.getState().pauseKeep(false);
        }}
      >
        <div className="text">
          <div className="title" id="mari-keep-title" aria-live="polite">
            {t("theming.safety.keepQuestion", "Keep “{{name}}”?", { name: pendingKeep.themeName })}
          </div>
          <div className="sub">
            {paused
              ? t("theming.safety.keepPaused", "Waiting while you decide ({{seconds}} s left).", {
                  seconds: secondsLeft,
                })
              : t("theming.safety.keepCountdown", "Going back in {{seconds}} s unless you keep it.", {
                  seconds: secondsLeft,
                })}{" "}
            {t("theming.safety.escHint", "Press Esc three times any time to switch themes off in this tab.")}
          </div>
        </div>
        <div className="actions">
          <button type="button" onClick={revert}>
            {t("theming.safety.goBack", "Go back")}
          </button>
          <button type="button" className="primary" onClick={() => useThemeSafetyStore.getState().settleKeep()}>
            {t("theming.safety.keep", "Keep theme")}
          </button>
        </div>
      </div>
    );
  } else if (blockedThemeId && blockedDismissed !== blockedThemeId) {
    bar = (
      <div className="bar" role="alert">
        <div className="text">
          <div className="title">
            {t("theming.safety.blockedTitle", "“{{name}}” is switched off in this tab", {
              name: blockedThemeName ?? "",
            })}
          </div>
          <div className="sub">
            {blockedProblems.map((problem) => problemText(t, problem)).join(" ")}{" "}
            {t(
              "theming.safety.blockedHint",
              "Themes can restyle the top bar and sidebars, but not hide, move or cover them.",
            )}
          </div>
        </div>
        <div className="actions">
          <button type="button" onClick={editBlocked}>
            {t("theming.safety.editTheme", "Edit theme")}
          </button>
          {activeTheme?.id === blockedThemeId ? (
            <button type="button" onClick={turnOffEverywhere}>
              {t("theming.safety.turnOffEverywhere", "Turn it off everywhere")}
            </button>
          ) : null}
          <button
            type="button"
            className="icon"
            aria-label={t("theming.safety.dismiss", "Dismiss")}
            onClick={() => setBlockedDismissed(blockedThemeId)}
          >
            ✕
          </button>
        </div>
      </div>
    );
  } else if (safeMode) {
    bar = (
      <div className="bar" role="status">
        <div className="text">
          <div className="title">{t("theming.safety.safeTitle", "Safe mode: custom theme is off in this tab")}</div>
          <div className="sub">
            {activeTheme
              ? t("theming.safety.safeSubActive", "“{{name}}” is still picked on your other devices.", {
                  name: activeTheme.name,
                })
              : t("theming.safety.safeSubNone", "No custom theme is picked, so nothing else changes.")}
          </div>
        </div>
        <div className="actions">
          {activeTheme ? (
            <button type="button" onClick={turnOffEverywhere}>
              {t("theming.safety.turnOffEverywhere", "Turn it off everywhere")}
            </button>
          ) : null}
          <button type="button" className="primary" onClick={() => useThemeSafetyStore.getState().leaveSafeMode()}>
            {t("theming.safety.leaveSafe", "Leave safe mode")}
          </button>
        </div>
      </div>
    );
  }

  return createPortal(bar ? <div className="wrap">{bar}</div> : null, shadow);
}
