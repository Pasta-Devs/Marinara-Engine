// ──────────────────────────────────────────────
// Chat Settings button: the way into Chat Settings, placed in the chat
//
// A bubble like the chat's other window buttons, shown while a chat is open. It
// starts at the top right of the chat and can be dragged anywhere; its place
// saves with the chat (a phone keeps its own). A click opens Chat Settings, or
// closes it, and focus comes back here when the window closes. It never hides
// while the chat is open, and shows a dot while the chat's agents run. A
// Roleplay chat shows a one-time tip beside it until dismissed.
// ──────────────────────────────────────────────
import { useId, useState } from "react";
import { Settings2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatMode } from "@marinara-engine/shared";
import { WindowBubble } from "../ui/WindowBubble";
import { usePhoneBubbleBounds, useWindowBubbleBounds } from "../ui/FloatingWindow";
import { AgentsRunningDot } from "../agents/AgentsRunningDot";
import { announceChatToolbarAction } from "./ChatToolbarControls";
import { preloadChatSettingsDrawer } from "./ChatCommonOverlays";
import { useMatchMedia } from "../../hooks/use-match-media";
import {
  PHONE_BUBBLE_SIZE_PX,
  WINDOW_BUBBLE_SIZE_PX,
  clampWindowBubble,
  getTopRightBubblePoint,
} from "../../lib/floating-window-layout";
import {
  CHAT_SETTINGS_BUTTON_ID,
  CHAT_SETTINGS_WINDOW_ID,
  FLOATING_WINDOW_Z_BASE,
  PHONE_BUBBLE_Z_INDEX,
  PHONE_LAYOUT_QUERY,
  useFloatingWindowStore,
} from "../../stores/floating-window.store";
import { useAgentStore } from "../../stores/agent.store";
import { useUIStore } from "../../stores/ui.store";

const TIP_WIDTH_PX = 240;

export function ChatSettingsBubble({ chatId, mode }: { chatId: string; mode: ChatMode }) {
  const { t } = useTranslation();
  const phone = useMatchMedia(PHONE_LAYOUT_QUERY);
  const phoneBounds = usePhoneBubbleBounds(phone);
  const windowBounds = useWindowBubbleBounds(!phone);
  const bounds = phone ? phoneBounds : windowBounds;
  const [size, setSize] = useState(phone ? PHONE_BUBBLE_SIZE_PX : WINDOW_BUBBLE_SIZE_PX);
  const saved = useFloatingWindowStore((state) =>
    phone ? state.phoneBubbles[CHAT_SETTINGS_BUTTON_ID] : state.bubbles[CHAT_SETTINGS_BUTTON_ID],
  );
  const open = useFloatingWindowStore((state) => state.open[CHAT_SETTINGS_WINDOW_ID] === true);
  const locked = useFloatingWindowStore((state) => state.layouts[CHAT_SETTINGS_WINDOW_ID]?.locked === true);
  const agentsRunning = useAgentStore((state) => state.processingChatIds.includes(chatId));
  const tipDismissed = useUIStore((state) => state.chatSettingsMoveTipDismissed);
  const dismissTip = useUIStore((state) => state.dismissChatSettingsMoveTip);
  const agentsRunningId = useId();
  const label = t("chat.toolbar.settings");
  // Saved places take precedence over the top-right default.
  const point = clampWindowBubble(saved ?? getTopRightBubblePoint(bounds, size), bounds, size);
  const showTip = !phone && mode === "roleplay" && !tipDismissed;
  const tipLeft = Math.max(8, Math.min(point.x + size / 2 - 24, window.innerWidth - TIP_WIDTH_PX - 8));

  const toggle = (button: HTMLButtonElement) => {
    announceChatToolbarAction("settings");
    void preloadChatSettingsDrawer();
    const windows = useFloatingWindowStore.getState();
    if (windows.open[CHAT_SETTINGS_WINDOW_ID]) windows.dismissWindow(CHAT_SETTINGS_WINDOW_ID, { force: true });
    else windows.openWindow(CHAT_SETTINGS_WINDOW_ID, button);
  };

  return (
    <>
      <WindowBubble
        id={CHAT_SETTINGS_BUTTON_ID}
        point={saved ?? { ...getTopRightBubblePoint(bounds, size), automatic: true }}
        bounds={bounds}
        size={size}
        onSizeChange={setSize}
        icon={<Settings2 size={phone ? 16 : 14} />}
        label={label}
        ariaLabel={label}
        tooltip={label}
        expanded={open}
        locked={locked}
        zIndex={phone ? PHONE_BUBBLE_Z_INDEX : FLOATING_WINDOW_Z_BASE}
        attributes={{
          "data-presentation": phone ? "sheet" : undefined,
          "data-chat-help": "settings",
          "data-chat-toolbar-panel-action": "settings",
          "data-window-opener": CHAT_SETTINGS_WINDOW_ID,
          "data-chat-settings-button": true,
          "data-open": open ? "true" : undefined,
        }}
        describedBy={agentsRunning ? agentsRunningId : undefined}
        onMove={(next) => {
          const windows = useFloatingWindowStore.getState();
          if (phone) windows.savePhoneBubble(CHAT_SETTINGS_BUTTON_ID, next);
          else windows.saveBubble(CHAT_SETTINGS_BUTTON_ID, next);
        }}
        onOpen={toggle}
      >
        {agentsRunning && <AgentsRunningDot id={agentsRunningId} className="right-0.5 top-0.5" />}
      </WindowBubble>
      {showTip && (
        // A one-time tip under the button; presses go through it except on its close button.
        <span
          role="note"
          data-chat-settings-move-tip
          className="pointer-events-none fixed flex items-start gap-2 rounded-lg bg-[var(--popover)] py-2 pl-3 pr-1.5 text-left text-[0.6875rem] leading-relaxed text-[var(--popover-foreground)] shadow-xl ring-1 ring-[var(--border)]"
          style={{
            left: tipLeft,
            top: point.y + size + 10,
            width: TIP_WIDTH_PX,
            // Under any open window: the tip is about the button, never over a window's title bar.
            zIndex: FLOATING_WINDOW_Z_BASE - 1,
          }}
        >
          <span
            aria-hidden="true"
            className="absolute -top-1 h-2 w-2 rotate-45 bg-[var(--popover)] ring-1 ring-[var(--border)] [clip-path:polygon(0_0,100%_0,0_100%)]"
            style={{ left: Math.max(8, point.x + size / 2 - 4 - tipLeft) }}
          />
          <span className="min-w-0 flex-1">{t("chat.settings.moveTip")}</span>
          <button
            type="button"
            aria-label={t("chat.settings.moveTipDismiss")}
            title={t("chat.settings.moveTipDismiss")}
            onClick={dismissTip}
            className="mari-window__control pointer-events-auto !h-6 !w-6 shrink-0"
          >
            <X size="0.75rem" />
          </button>
        </span>
      )}
    </>
  );
}
