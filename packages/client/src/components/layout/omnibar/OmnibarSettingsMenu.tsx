// The omnibar's own settings, in the omnibar, and since Q2 the home of every omnibar and
// Professor Mari setting. The app's Settings panel keeps one row that opens this view, and
// `settings-registry.ts` lists these controls under the `omnibar` section so search, the Settings
// panel's own search and Mari's links all land here, at the control (`omnibar-setting-<id>`).
//
// A view inside the omnibar card, like Mari's: it covers the list with its own back arrow, and
// Escape or the arrow returns to where you were. It is not a separate `Modal`, so the omnibar's
// dialog, focus and Escape handling stay in one place. Open/closed lives in `ui.store`
// (`omnibarSettings`) so the Settings panel and navigation targets can open it too.

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, Lock, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_MARI_PERMISSIONS_MODE,
  LOCAL_SIDECAR_CONNECTION_ID,
  MARI_PERMISSIONS_MODE_LABELS,
  MARI_PERMISSIONS_MODES,
  type MariPermissionsMode,
} from "@marinara-engine/shared";

import { useInDialogFocusScope } from "../../../hooks/use-in-dialog-focus-scope";
import { useSidecarStore } from "../../../stores/sidecar.store";
import { useUIStore } from "../../../stores/ui.store";
import { api } from "../../../lib/api-client";
import { enqueueMariPermissionsModeWrite } from "../../../lib/mari-permissions-write-chain";
import {
  isMariPackUnlocked,
  MARI_APPEARANCE_PACKS,
  mariImgLoading,
  playHoursFromMs,
  resolveMariAppearancePack,
} from "../../../lib/mari-work-animations";
import { useActivityOverview } from "../../../hooks/use-chat-insights";
import { MARI_QUICK_CONNECTION, OMNIBAR_ASIDE_DELAY_CHOICES_MS } from "../../../lib/omnibar-aside-text";
import { useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { cn } from "../../../lib/utils";

/** The anchor a search row, the Settings panel or one of Mari's links scrolls to. */
function anchorId(controlId: string) {
  return `omnibar-setting-${controlId}`;
}

/** One titled group of rows; `bare` skips the hairline group for content that brings its own cards. */
function Section({
  title,
  description,
  bare = false,
  children,
}: {
  title: string;
  description?: string;
  bare?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="omnibar-settings-section">
      <h3 id={headingId} className="omnibar-settings-menu__heading">
        {title}
      </h3>
      {description ? <p className="omnibar-settings-section__description">{description}</p> : null}
      {bare ? children : <div className="mari-edit omnibar-settings-group">{children}</div>}
    </section>
  );
}

function SettingText({ label, description }: { label: string; description: string }) {
  return (
    <span className="min-w-0">
      <span className="omnibar-settings-menu__label">{label}</span>
      <span className="omnibar-settings-menu__description">{description}</span>
    </span>
  );
}

function SettingRow({
  controlId,
  label,
  description,
  checked,
  onChange,
}: {
  controlId: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label id={anchorId(controlId)} className="omnibar-settings-menu__row">
      <SettingText label={label} description={description} />
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

// #5725: Professor Mari's server-authoritative Permissions Mode, moved here from the Settings
// panel (Q2). Fetched on mount and written through the dedicated validated PUT; a change applies
// to Mari's next run (an in-flight turn is never aborted by a mode switch).
function PermissionsModeRow() {
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const selectId = useId();
  const [mode, setMode] = useState<MariPermissionsMode | null>(null);
  // Sequence local writes so a stale GET (or a stale failure rollback) can never clobber a newer
  // selection. Mari's composer writes the same server setting, but this view mounts fresh on every
  // open, so the one read on mount is current.
  const writeSeqRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const seqAtStart = writeSeqRef.current;
    api
      .get<{ mode: MariPermissionsMode }>("/professor-mari/workspace/permissions-mode")
      .then((response) => {
        if (!cancelled && writeSeqRef.current === seqAtStart) setMode(response.mode);
      })
      .catch(() => {
        if (!cancelled) setMode((current) => current ?? DEFAULT_MARI_PERMISSIONS_MODE);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const currentMode = mode ?? DEFAULT_MARI_PERMISSIONS_MODE;
  const change = async (next: MariPermissionsMode) => {
    const previous = currentMode;
    const writeSeq = ++writeSeqRef.current;
    setMode(next);
    try {
      // The shared chain serializes this against the Mari panel's per-chat writes AND against
      // runs, so a default change here can never race a prompt on an un-overridden chat.
      await enqueueMariPermissionsModeWrite(() =>
        api.put("/professor-mari/workspace/permissions-mode", { mode: next }),
      );
    } catch {
      if (writeSeqRef.current !== writeSeq) return;
      setMode(previous);
      toast.error(t("ui.chat.homeprofessormarichat.couldNotChangeThePermissionsMode"));
    }
  };
  return (
    <div
      id={anchorId("mari-permissions-mode")}
      className="omnibar-settings-menu__row omnibar-settings-menu__row--stacked"
    >
      <label htmlFor={selectId} className="min-w-0">
        <span className="omnibar-settings-menu__label">{t("ui.chat.homeprofessormarichat.permissionsMode")}</span>
        <span className="omnibar-settings-menu__description">
          {localize(MARI_PERMISSIONS_MODE_LABELS[currentMode].description)}
        </span>
      </label>
      <select
        id={selectId}
        className="mari-chrome-field omnibar-settings-sheet__select"
        value={currentMode}
        onChange={(event) => void change(event.target.value as MariPermissionsMode)}
      >
        {MARI_PERMISSIONS_MODES.map((value) => (
          <option key={value} value={value}>
            {localize(MARI_PERMISSIONS_MODE_LABELS[value].label)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Appearance packs are exclusive: portraits and stories always switch together. A grid of cards,
 * one native radio each: Tab reaches the cards, arrow keys move and select like any radio group,
 * Space or Enter selects, and screen readers hear "radio, checked, 1 of 4". Each preview is that
 * pack's profile pose, tier 3: never at app load, and only once the grid comes within 200 px of
 * the visible part of this view. The browser's own `loading="lazy"` margin is far larger than this
 * view, so it alone would fetch every preview the moment the view opens.
 *
 * R12: a pack with a play-time rule stays locked (a disabled radio, a lock instead of its preview, so
 * none of its art loads) until Activity's play time reaches the rule. The checked card is the pack
 * that renders, so a stored locked pick shows Basic checked while the pick itself is kept.
 */
function AppearancePacks() {
  const { t } = useTranslation();
  const baseId = useId();
  const storedId = useUIStore((state) => state.mariAppearancePackId);
  const unlockedIds = useUIStore((state) => state.mariUnlockedPackIds);
  const selectPack = useUIStore((state) => state.setMariAppearancePack);
  const anyLocked = MARI_APPEARANCE_PACKS.some((pack) => !isMariPackUnlocked(pack, unlockedIds));
  const playHours = playHoursFromMs(useActivityOverview(anyLocked).data?.playTime.totalMs);
  const selected = resolveMariAppearancePack(storedId, unlockedIds, playHours).id;
  const gridRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || near) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setNear(true),
      {
        root: grid.closest(".omnibar-settings-sheet__card"),
        rootMargin: "200px 0px",
      },
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, [near]);
  return (
    <div
      ref={gridRef}
      id={anchorId("mari-appearance-pack")}
      className="omnibar-settings-packs"
      role="radiogroup"
      aria-label={t("mari.appearancePacks.heading")}
    >
      {MARI_APPEARANCE_PACKS.map((pack) => {
        const nameId = `${baseId}-${pack.id}-name`;
        const descriptionId = `${baseId}-${pack.id}-description`;
        const locked = !isMariPackUnlocked(pack, unlockedIds, playHours);
        const requirement = pack.unlock
          ? t("mari.appearancePacks.lockedRequirement", { total: pack.unlock.playHours })
          : "";
        return (
          <label
            key={pack.id}
            className="omnibar-settings-pack"
            data-pack={pack.id}
            data-locked={locked || undefined}
            title={locked ? requirement : undefined}
          >
            <input
              type="radio"
              name="mari-appearance-pack"
              className="sr-only"
              disabled={locked}
              checked={selected === pack.id}
              onChange={() => selectPack(pack.id)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                // A native radio selects on Space and arrows; Enter selects here too.
                if (event.key !== "Enter") return;
                event.preventDefault();
                selectPack(pack.id);
              }}
              aria-labelledby={nameId}
              aria-describedby={descriptionId}
            />
            <span className="omnibar-settings-pack__stage" aria-hidden="true">
              {locked ? (
                <Lock size={28} className="omnibar-settings-pack__lock" />
              ) : (
                <img
                  className="omnibar-settings-pack__sprite"
                  src={near ? pack.poses.profile : undefined}
                  {...mariImgLoading(3)}
                  width={128}
                  height={128}
                  alt=""
                />
              )}
            </span>
            <span id={nameId} className="omnibar-settings-pack__name">
              {t(`mari.appearancePacks.${pack.id}.label`, pack.label)}
            </span>
            <span id={descriptionId} className="omnibar-settings-pack__description">
              {!locked
                ? t(`mari.appearancePacks.${pack.id}.description`, pack.description)
                : playHours === null
                  ? requirement
                  : t("mari.appearancePacks.lockedProgress", {
                      hours: playHours,
                      total: pack.unlock!.playHours,
                    })}
            </span>
            {locked && playHours !== null ? (
              <span className="omnibar-settings-pack__progress" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (playHours / pack.unlock!.playHours) * 100)}%` }} />
              </span>
            ) : null}
            <span className="omnibar-settings-pack__check" aria-hidden="true">
              <Check size={12} strokeWidth={3} />
              {t("mari.appearancePacks.inUse", "In use")}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function OmnibarSettingsButton({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={open}
      aria-label={t("omnibar.settings.label", "Search and Professor Mari settings")}
      title={t("omnibar.settings.label", "Search and Professor Mari settings")}
      className={cn("omnibar-settings-menu__trigger", open && "omnibar-settings-menu__trigger--open")}
    >
      <Settings2 size={14} />
    </button>
  );
}

export function OmnibarSettingsSheet({
  onClose,
  focusControlId,
  connections,
  marisConnectionName,
  onClearSearchHistory,
  onSetUpLocalModel,
}: {
  onClose: () => void;
  /** Scrolls to and focuses this setting on open (a search row, the Settings panel, Mari's link). */
  focusControlId: string | null;
  /** Language connections that can answer a quick question. */
  connections: readonly { id: string; name: string }[];
  /** The connection Mari uses, which "Same as Mari" follows. Absent when she has none. */
  marisConnectionName?: string | null;
  /** O2: forgets the local frecency history (which results you run most, per surface). */
  onClearSearchHistory: () => void;
  /** Opens the local model setup. Absent where no local model can run. */
  onSetUpLocalModel?: () => void;
}) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const connectionSelectId = useId();

  const mariEnabled = useUIStore((state) => state.commandCenterMariEnabled);
  const setMariEnabled = useUIStore((state) => state.setCommandCenterMariEnabled);
  const suggestionsEnabled = useUIStore((state) => state.omnibarSuggestionsEnabled);
  const setSuggestionsEnabled = useUIStore((state) => state.setOmnibarSuggestionsEnabled);
  const asideEnabled = useUIStore((state) => state.omnibarAsideEnabled);
  const setAsideEnabled = useUIStore((state) => state.setOmnibarAsideEnabled);
  const asideConnectionId = useUIStore((state) => state.omnibarAsideConnectionId);
  const setAsideConnectionId = useUIStore((state) => state.setOmnibarAsideConnectionId);
  const asideDelayMs = useUIStore((state) => state.omnibarAsideDelayMs);
  const setAsideDelayMs = useUIStore((state) => state.setOmnibarAsideDelayMs);
  const editViewMode = useUIStore((state) => state.mariEditViewMode);
  const setEditViewMode = useUIStore((state) => state.setMariEditViewMode);
  const mariSuggestionsEnabled = useUIStore((state) => state.professorMariSuggestionsEnabled);
  const setMariSuggestionsEnabled = useUIStore((state) => state.setProfessorMariSuggestionsEnabled);
  const enterToSendMari = useUIStore((state) => state.enterToSendProfessorMari);
  const setEnterToSendMari = useUIStore((state) => state.setEnterToSendProfessorMari);
  const miniMariEnabled = useUIStore((state) => state.chibiProfessorMariEnabled);
  const setMiniMariEnabled = useUIStore((state) => state.setChibiProfessorMariEnabled);
  const localModelDownloaded = useSidecarStore((state) => state.modelDownloaded);

  const usesLocalModel = asideConnectionId === LOCAL_SIDECAR_CONNECTION_ID;
  const followsMari = asideConnectionId === MARI_QUICK_CONNECTION && Boolean(marisConnectionName);
  const knownConnection =
    usesLocalModel || followsMari || connections.some((connection) => connection.id === asideConnectionId);

  // Focus moves in on open and back to whatever opened the sheet on close; Escape and Tab stay here.
  const onKeyDown = useInDialogFocusScope(cardRef, onClose);

  // A jump to one setting lands on it: scrolled into view, its control focused. Runs after the
  // focus scope's own effect (declared above), so it wins over the default first-control focus.
  useEffect(() => {
    if (!focusControlId) return;
    const target = cardRef.current?.querySelector<HTMLElement>(`#${anchorId(focusControlId)}`);
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target
      .querySelector<HTMLElement>("input:checked, input:not([type='radio']), select, button:not([disabled])")
      ?.focus({ preventScroll: true });
  }, [focusControlId]);

  return (
    <div className="omnibar-settings-sheet" data-component="GlobalOmnibar.Settings" onKeyDown={onKeyDown}>
      <div
        ref={cardRef}
        role="region"
        aria-labelledby="omnibar-settings-title"
        className="omnibar-settings-sheet__card"
      >
        <header className="omnibar-settings-sheet__header">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("omnibar.settings.back", "Back")}
            className="omnibar-settings-menu__trigger"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 id="omnibar-settings-title">{t("omnibar.settings.label", "Search and Professor Mari settings")}</h2>
        </header>

        <Section title={t("omnibar.settings.search.heading", "Search")}>
          <SettingRow
            controlId="omnibar-suggestions"
            label={t("omnibar.settings.suggestions.label", "Offer to improve a field")}
            description={t(
              "omnibar.settings.suggestions.description",
              "While you edit a field, Search offers to have Professor Mari improve it.",
            )}
            checked={suggestionsEnabled}
            onChange={setSuggestionsEnabled}
          />
          <div id={anchorId("omnibar-search-history")} className="omnibar-settings-menu__row">
            <SettingText
              label={t("omnibar.settings.history.clear.label", "Search history")}
              description={t(
                "omnibar.settings.history.clear.description",
                "Search lists the results you pick most first. Kept on this device only.",
              )}
            />
            <button
              type="button"
              className="mari-chrome-control mari-chrome-control--compact"
              aria-label={t("omnibar.settings.history.clear.action", "Clear search history")}
              onClick={onClearSearchHistory}
            >
              {t("omnibar.settings.history.clear.button", "Clear")}
            </button>
          </div>
        </Section>

        <Section title={t("omnibar.settings.quickAnswers.heading", "Quick answers")}>
          <SettingRow
            controlId="quick-answers"
            label={t("omnibar.settings.aside.label", "Quick answers in Search")}
            description={t(
              "omnibar.settings.aside.description",
              "When you type a question, Professor Mari answers in up to three sentences from the docs. She sees only what you typed and changes nothing.",
            )}
            checked={asideEnabled}
            onChange={setAsideEnabled}
          />
          <div
            id={anchorId("quick-answer-model")}
            className="omnibar-settings-menu__row omnibar-settings-menu__row--stacked"
          >
            <label htmlFor={connectionSelectId} className="min-w-0">
              <span className="omnibar-settings-menu__label">
                {t("omnibar.settings.aside.connection.label", "Answer with")}
              </span>
              <span className="omnibar-settings-menu__description">
                {t(
                  "omnibar.settings.aside.connection.description",
                  "Gets only your search text, never your chats, memories or the field you edit.",
                )}
              </span>
            </label>
            <select
              id={connectionSelectId}
              className="mari-chrome-field omnibar-settings-sheet__select"
              value={asideConnectionId}
              disabled={!asideEnabled}
              onChange={(event) => setAsideConnectionId(event.target.value)}
            >
              {marisConnectionName ? (
                <option value={MARI_QUICK_CONNECTION}>
                  {t("omnibar.settings.aside.connection.mari", "Same as Prof. Mari ({{name}})", {
                    name: marisConnectionName,
                  })}
                </option>
              ) : null}
              <option value={LOCAL_SIDECAR_CONNECTION_ID}>
                {localModelDownloaded
                  ? t("omnibar.settings.aside.connection.local", "Local model (free)")
                  : t("omnibar.settings.aside.connection.localMissing", "Local model (not set up)")}
              </option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name}
                </option>
              ))}
              {knownConnection ? null : (
                <option value={asideConnectionId} disabled>
                  {t("omnibar.settings.aside.connection.missing", "Deleted connection")}
                </option>
              )}
            </select>
            {asideEnabled && usesLocalModel && !localModelDownloaded ? (
              <p className="omnibar-settings-sheet__note">
                {t(
                  "omnibar.settings.aside.localMissingNote",
                  "No local model is downloaded, so quick answers are off. Download one or choose a connection.",
                )}
                {onSetUpLocalModel ? (
                  <button
                    type="button"
                    onClick={onSetUpLocalModel}
                    className="font-semibold underline underline-offset-2"
                  >
                    {t("omnibar.aside.setUpLocalModel", "Set up a local model")}
                  </button>
                ) : null}
              </p>
            ) : null}
            {asideEnabled && !usesLocalModel ? (
              <p className="omnibar-settings-sheet__note">
                {t(
                  "omnibar.settings.aside.remoteNote",
                  "Each quick answer is one request to this connection and may cost money.",
                )}
              </p>
            ) : null}
          </div>
          <div id={anchorId("quick-answer-delay")} className="omnibar-settings-menu__row">
            <SettingText
              label={t("omnibar.settings.aside.delay.label", "Wait after typing")}
              description={t(
                "omnibar.settings.aside.delay.description",
                "How long Search waits before Professor Mari writes a quick answer.",
              )}
            />
            <span className="omnibar-settings-menu__segmented">
              {OMNIBAR_ASIDE_DELAY_CHOICES_MS.map((delayMs) => (
                <button
                  key={delayMs}
                  type="button"
                  aria-pressed={asideDelayMs === delayMs}
                  disabled={!asideEnabled}
                  onClick={() => setAsideDelayMs(delayMs)}
                >
                  {t("omnibar.settings.aside.delay.seconds", "{{seconds}} s", { seconds: delayMs / 1_000 })}
                </button>
              ))}
            </span>
          </div>
        </Section>

        <Section title={t("omnibar.settings.mari.heading", "Professor Mari")}>
          <SettingRow
            controlId="ask-mari"
            label={t("omnibar.settings.mari.label", "Ask Professor Mari from Search")}
            description={t(
              "omnibar.settings.mari.description",
              "Open her from the Search field, the pull-down or Ctrl/Command+J.",
            )}
            checked={mariEnabled}
            onChange={setMariEnabled}
          />
          <PermissionsModeRow />
          <SettingRow
            controlId="professor-mari-suggestions"
            label={t("settings.controls.professorMariSuggestions.label")}
            description={t("settings.controls.professorMariSuggestions.help")}
            checked={mariSuggestionsEnabled}
            onChange={setMariSuggestionsEnabled}
          />
          <div id={anchorId("mari-edit-view")} className="omnibar-settings-menu__row">
            <SettingText
              label={t("omnibar.settings.editView.label", "Change cards open in")}
              description={t("omnibar.settings.editView.description", "Easy shows a summary. Raw shows every field.")}
            />
            <span className="omnibar-settings-menu__segmented">
              {(["easy", "raw"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={editViewMode === mode}
                  onClick={() => setEditViewMode(mode)}
                >
                  {mode === "easy"
                    ? t("ui.chat.databaseworkspaceapprovalcard.easyView")
                    : t("ui.chat.databaseworkspaceapprovalcard.rawView")}
                </button>
              ))}
            </span>
          </div>
          <SettingRow
            controlId="mari-send-on-enter"
            label={t("omnibar.settings.sendOnEnter.label", "Enter sends to Professor Mari")}
            description={t(
              "omnibar.settings.sendOnEnter.description",
              "When off, Enter adds a new line and Ctrl/Command+Enter sends.",
            )}
            checked={enterToSendMari}
            onChange={setEnterToSendMari}
          />
        </Section>

        <Section title={t("omnibar.settings.around.heading", "Around the app")}>
          <SettingRow
            controlId="mini-mari"
            label={t("settings.controls.miniMari.label")}
            description={t("settings.controls.miniMari.help")}
            checked={miniMariEnabled}
            onChange={setMiniMariEnabled}
          />
        </Section>

        <Section
          bare
          title={t("omnibar.settings.appearance.heading", "Appearance")}
          description={t(
            "omnibar.settings.appearance.description",
            "How Professor Mari looks in her chat, Search, Home and the top bar.",
          )}
        >
          <AppearancePacks />
        </Section>
      </div>
    </div>
  );
}
