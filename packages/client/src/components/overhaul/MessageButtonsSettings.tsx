// ──────────────────────────────────────────────
// Settings > Chatting > Message buttons (UI overhaul)
//
// Pick which buttons sit on each message; the rest wait in the ⋯ menu. Buttons that
// ask the AI (and can cost money) go on the bar under the message, everything else
// on the bar at its top. A sample message above the choices shows the result live.
// ──────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftRight,
  Bookmark,
  Brain,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  EyeOff,
  FastForward,
  GitBranch,
  Languages,
  MessageSquareReply,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  SmilePlus,
  Trash2,
  Volume2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { Checkbox } from "../ui/Checkbox";
import { ToggleSetting } from "../panels/settings/SettingControls";
import {
  DEFAULT_MESSAGE_BUTTONS,
  MESSAGE_BUTTONS,
  messageButtonsFor,
  useMessageButtons,
  type MessageButtonId,
  type MessageButtonMode,
} from "./message-buttons";

// Sample data, not interface text.
const SAMPLE = { name: "Aria", initial: "A", time: "9:41 PM", swipe: "2 / 3", thoughtSeconds: 12 };

const ICONS: Record<MessageButtonId, ReactNode> = {
  react: <SmilePlus size={14} aria-hidden="true" />,
  reply: <MessageSquareReply size={14} aria-hidden="true" />,
  edit: <Pencil size={14} aria-hidden="true" />,
  copy: <Copy size={14} aria-hidden="true" />,
  branch: <GitBranch size={14} aria-hidden="true" />,
  marks: <Bookmark size={14} aria-hidden="true" />,
  thinking: <Brain size={14} aria-hidden="true" />,
  hide: <EyeOff size={14} aria-hidden="true" />,
  delete: <Trash2 size={14} aria-hidden="true" />,
  speak: <Volume2 size={14} aria-hidden="true" />,
  translate: <Languages size={14} aria-hidden="true" />,
  continue: <FastForward size={14} aria-hidden="true" />,
  regenerate: <RefreshCw size={14} aria-hidden="true" />,
  swipes: <ArrowLeftRight size={14} aria-hidden="true" />,
};

/** One bar of the sample message: the picked buttons in the order the real bar shows them. */
function SampleBar({
  mode,
  bar,
  shown,
}: {
  mode: MessageButtonMode;
  bar: "top" | "bottom";
  shown: readonly MessageButtonId[];
}) {
  const { t } = useTranslation();
  // Thinking shows as the "Thought for Ns" toggle beside the name, not on the bar.
  const ids = messageButtonsFor(mode)
    .filter((button) => button.bar === bar && shown.includes(button.id))
    .filter((button) => button.id !== "thinking")
    .map((button) => button.id);
  if (bar === "bottom" && ids.length === 0) return null;
  return (
    <span className={cn("ov-mbp__bar", `ov-mbp__bar--${bar}`)} data-bar={bar}>
      {ids.map((id) =>
        id === "swipes" ? (
          <span key={id} className="ov-mbp__swipes" title={t("ui.overhaul.messagebuttons.button.swipes")}>
            <ChevronLeft size={14} aria-hidden="true" />
            {SAMPLE.swipe}
            <ChevronRight size={14} aria-hidden="true" />
          </span>
        ) : id === "react" ? (
          <span key={id} className="ov-mbp__react" title={t("ui.overhaul.messagebuttons.button.react")}>
            <span aria-hidden="true">🔥</span>
            <span aria-hidden="true">😂</span>
            <span aria-hidden="true">❤️</span>
            {ICONS.react}
          </span>
        ) : (
          <span
            key={id}
            className={cn("ov-mbp__btn", id === "regenerate" && "is-accent")}
            title={t(`ui.overhaul.messagebuttons.button.${id}`)}
          >
            {ICONS[id]}
          </span>
        ),
      )}
      {bar === "top" ? (
        <span className="ov-mbp__btn" title={t("ui.overhaul.messagebuttons.moreMenu")}>
          <MoreHorizontal size={15} aria-hidden="true" />
        </span>
      ) : null}
    </span>
  );
}

/** The "Thought for Ns ›" toggle by the name, as messages show it when Thinking is picked. */
function SampleThought({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <span className="ov-thought-btn" title={t("ui.overhaul.messagebuttons.button.thinking")}>
      <Clock size={11} aria-hidden="true" />
      <span>{t("chat.message.thoughts.ovDuration", { count: SAMPLE.thoughtSeconds })}</span>
      <ChevronRight size={11} aria-hidden="true" className="ov-thought-btn__chev" />
    </span>
  );
}

/** A sample reply as Roleplay or Conversation shows it, with both bars always visible. */
function SampleMessage({ mode, shown }: { mode: MessageButtonMode; shown: readonly MessageButtonId[] }) {
  const { t } = useTranslation();
  const inMenu = messageButtonsFor(mode).filter((button) => !shown.includes(button.id));
  return (
    <div className="ov-mbp" data-mode={mode} aria-label={t("ui.overhaul.messagebuttons.preview")} role="img">
      {mode === "roleplay" ? (
        <div className="ov-mbp__rp">
          <span className="ov-mbp__avatar" aria-hidden="true">
            {SAMPLE.initial}
          </span>
          <div className="ov-mbp__rp-col">
            <div className="ov-mbp__bubble">
              <div className="ov-mbp__head">
                <strong>{SAMPLE.name}</strong>
                <span className="ov-mbp__time">{SAMPLE.time}</span>
                <SampleThought show={shown.includes("thinking")} />
                <span className="ov-mbp__grow" />
                <SampleBar mode={mode} bar="top" shown={shown} />
              </div>
              <p className="ov-mbp__text">{t("ui.overhaul.messagebuttons.sampleRoleplay")}</p>
            </div>
            <div className="ov-mbp__under">
              <SampleBar mode={mode} bar="bottom" shown={shown} />
            </div>
          </div>
        </div>
      ) : (
        <div className="ov-mbp__cv">
          <div className="ov-mbp__cv-top">
            <SampleBar mode={mode} bar="top" shown={shown} />
          </div>
          <span className="ov-mbp__avatar" aria-hidden="true">
            {SAMPLE.initial}
          </span>
          <div className="ov-mbp__cv-col">
            <div>
              <strong>{SAMPLE.name}</strong> <span className="ov-mbp__time">{SAMPLE.time}</span>{" "}
              <SampleThought show={shown.includes("thinking")} />
            </div>
            <p className="ov-mbp__text">{t("ui.overhaul.messagebuttons.sampleConversation")}</p>
          </div>
          <div className="ov-mbp__cv-bottom">
            <SampleBar mode={mode} bar="bottom" shown={shown} />
          </div>
        </div>
      )}
      <p className="ov-mbp__menu">
        <MoreHorizontal size={13} aria-hidden="true" />
        {inMenu.length
          ? t("ui.overhaul.messagebuttons.onlyInMenu", {
              list: inMenu.map((button) => t(button.labelKey)).join(", "),
            })
          : t("ui.overhaul.messagebuttons.allOnMessage")}
      </p>
    </div>
  );
}

export function MessageButtonsSettings() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<MessageButtonMode>("roleplay");
  const shown = useMessageButtons(mode);
  const setButtons = useOverhaulStore((state) => state.setMessageButtons);
  const always = useOverhaulStore((state) => state.messageButtonsAlways);
  const setAlways = useOverhaulStore((state) => state.setMessageButtonsAlways);
  const buttons = messageButtonsFor(mode);
  const toggle = (id: MessageButtonId, on: boolean) => {
    const next = new Set(shown);
    if (on) next.add(id);
    else next.delete(id);
    // Keep the catalogue's order, so the bars always read the same way.
    setButtons(
      mode,
      MESSAGE_BUTTONS.filter((button) => next.has(button.id)).map((button) => button.id),
    );
  };
  const isDefault =
    shown.length === DEFAULT_MESSAGE_BUTTONS[mode].length &&
    DEFAULT_MESSAGE_BUTTONS[mode].every((id) => shown.includes(id));
  const group = (bar: "top" | "bottom") => (
    <fieldset className="ov-mbs__group" data-bar={bar}>
      <legend>
        {t(bar === "top" ? "ui.overhaul.messagebuttons.topBar" : "ui.overhaul.messagebuttons.bottomBar")}
        <span>
          {t(bar === "top" ? "ui.overhaul.messagebuttons.topBarNote" : "ui.overhaul.messagebuttons.bottomBarNote")}
        </span>
      </legend>
      {buttons
        .filter((button) => button.bar === bar)
        .map((button) => (
          <label key={button.id} className="ov-mbs__row">
            <Checkbox
              checked={shown.includes(button.id)}
              onChange={(event) => toggle(button.id, event.target.checked)}
            />
            <span className="ov-mbs__icon">{ICONS[button.id]}</span>
            <span>{t(button.labelKey)}</span>
          </label>
        ))}
    </fieldset>
  );
  return (
    <div className="ov-mbs" data-component="MessageButtonsSettings">
      {/* Both chat modes, with a mouse: phones and tablets keep the hold menu. */}
      <ToggleSetting
        anchorId="settings-control-always-show-message-buttons"
        label={t("ui.overhaul.messagebuttons.alwaysShow")}
        checked={always}
        onChange={setAlways}
        help={t("ui.overhaul.messagebuttons.alwaysShowHelp")}
      />
      <div className="ov-mbs__tools">
        <div className="ov-seg" role="group" aria-label={t("ui.overhaul.messagebuttons.chatMode")}>
          {(["roleplay", "conversation"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={cn(mode === item && "is-on")}
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
            >
              {t(
                item === "roleplay" ? "ui.overhaul.messagebuttons.roleplay" : "ui.overhaul.messagebuttons.conversation",
              )}
            </button>
          ))}
        </div>
        <span className="ov-mbs__spacer" />
        <button
          type="button"
          className="ov-btn"
          onClick={() =>
            setButtons(
              mode,
              buttons.map((button) => button.id),
            )
          }
          disabled={shown.length === buttons.length}
        >
          {t("ui.overhaul.messagebuttons.showAll")}
        </button>
        <button type="button" className="ov-btn" onClick={() => setButtons(mode, [])} disabled={shown.length === 0}>
          {t("ui.overhaul.messagebuttons.menuOnly")}
        </button>
        <button type="button" className="ov-btn" onClick={() => setButtons(mode, null)} disabled={isDefault}>
          {t("ui.overhaul.messagebuttons.defaults")}
        </button>
      </div>
      <SampleMessage mode={mode} shown={shown} />
      <div className="ov-mbs__groups scroll-mt-3" id="settings-control-message-buttons-pick">
        {group("top")}
        {group("bottom")}
      </div>
    </div>
  );
}
