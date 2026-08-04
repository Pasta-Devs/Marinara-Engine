// ──────────────────────────────────────────────
// Floating avatar notification bubbles
// ──────────────────────────────────────────────
// When a character messages in another conversation, their avatar appears
// as a floating circle on the right edge of the main content area.
// Click → navigate to that conversation. X → dismiss.
// On mobile, multiple notifications collapse into a single tappable group.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Phone, PhoneIncoming, PhoneOff, X, MessageCircle } from "lucide-react";
import { useChatStore } from "../../stores/chat.store";
import { useGameModeStore } from "../../stores/game-mode.store";
import { useUIStore } from "../../stores/ui.store";
import { api } from "../../lib/api-client";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation as useUiTranslation } from "react-i18next";

type ChatNotification = {
  chatId: string;
  characterName: string;
  avatarUrl: string | null;
  avatarCrop?: AvatarCrop | null;
  count: number;
  kind?: "message" | "call";
  callId?: string | null;
  reason?: string | null;
};

export function ChatNotificationBubbles() {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const chatNotifications = useChatStore((s) => s.chatNotifications);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const autoDismissNotification = useChatStore((s) => s.autoDismissNotification);
  const dismissNotification = useChatStore((s) => s.dismissNotification);
  const setShouldOpenSettings = useChatStore((s) => s.setShouldOpenSettings);
  const setShouldOpenWizard = useChatStore((s) => s.setShouldOpenWizard);
  const setShouldOpenWizardInShortcutMode = useChatStore((s) => s.setShouldOpenWizardInShortcutMode);
  const setPendingNewChatMode = useChatStore((s) => s.setPendingNewChatMode);
  const setSetupActive = useGameModeStore((s) => s.setSetupActive);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [pendingCallAction, setPendingCallAction] = useState<string | null>(null);

  /** Navigate to a chat — close any editor/detail view first so ChatArea is visible. */
  const navigateToChat = (chatId: string) => {
    closeAllDetails();
    setPendingNewChatMode(null);
    setShouldOpenSettings(false);
    setShouldOpenWizard(false);
    setShouldOpenWizardInShortcutMode(false);
    setSetupActive(false);
    setActiveChatId(chatId);
  };

  const refreshCallState = (chatId: string) => {
    queryClient.invalidateQueries({ queryKey: ["conversation-calls", "status", chatId] });
    queryClient.invalidateQueries({ queryKey: ["chats", "messages", chatId] });
    queryClient.invalidateQueries({ queryKey: ["chats", "list"] });
  };

  const acceptCall = async (notif: ChatNotification) => {
    if (!notif.callId) return;
    setPendingCallAction(`accept:${notif.callId}`);
    try {
      await api.post(`/conversation-calls/${notif.callId}/accept`, {});
      autoDismissNotification(notif.chatId);
      refreshCallState(notif.chatId);
      navigateToChat(notif.chatId);
      setMobileExpanded(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message :localizeUi("ui.chat.chatnotificationbubbles.couldNotAnswerTheCall"));
    } finally {
      setPendingCallAction(null);
    }
  };

  const declineCall = async (notif: ChatNotification) => {
    if (!notif.callId) return;
    setPendingCallAction(`decline:${notif.callId}`);
    try {
      await api.post(`/conversation-calls/${notif.callId}/decline`, {});
      autoDismissNotification(notif.chatId);
      refreshCallState(notif.chatId);
      setMobileExpanded(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message :localizeUi("ui.chat.chatnotificationbubbles.couldNotDeclineTheCall"));
    } finally {
      setPendingCallAction(null);
    }
  };

  const notifications = Array.from(chatNotifications.values());

  if (notifications.length === 0) return null;

  const totalCount = notifications.reduce((sum, n) => sum + n.count, 0);

  return (
    <div className="pointer-events-none absolute right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end gap-3">
      {/* ── Desktop: always show all bubbles ── */}
      <div className="hidden md:flex md:flex-col md:gap-3">
        <AnimatePresence mode="popLayout">
          {notifications.map((notif) => (
            <NotificationBubble
              key={notif.chatId}
              notif={notif}
              onNavigate={() => navigateToChat(notif.chatId)}
              onDismiss={() => dismissNotification(notif.chatId)}
              onAcceptCall={() => void acceptCall(notif)}
              onDeclineCall={() => void declineCall(notif)}
              pendingCallAction={pendingCallAction}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ── Mobile: collapsed or expanded ── */}
      <div className="flex flex-col items-end gap-2 md:hidden">
        <AnimatePresence mode="popLayout">
          {notifications.length === 1 || mobileExpanded ? (
            /* Show all individual bubbles */
            notifications.map((notif) => (
              <NotificationBubble
                key={notif.chatId}
                notif={notif}
                onNavigate={() => {
                  navigateToChat(notif.chatId);
                  setMobileExpanded(false);
                }}
                onDismiss={() => {
                  dismissNotification(notif.chatId);
                  if (notifications.length <= 2) setMobileExpanded(false);
                }}
                onAcceptCall={() => void acceptCall(notif)}
                onDeclineCall={() => void declineCall(notif)}
                pendingCallAction={pendingCallAction}
              />
            ))
          ) : (
            /* Collapsed: stacked avatar preview → tap to expand */
            <motion.button
              key="collapsed-group"
              initial={{ x: 60, opacity: 0, scale: 0.8 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 60, opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="pointer-events-auto relative h-12 w-12"
              onClick={() => setMobileExpanded(true)}
              title={localizeUi("ui.chat.chatnotificationbubbles.value1Conversations", { value1: notifications.length })}
            >
              {/* Stacked circles (max 3 visible) */}
              {notifications.slice(0, 3).map((notif, i) => (
                <div
                  key={notif.chatId}
                  className={cn(
                    "absolute flex h-10 w-10 items-center justify-center overflow-hidden rounded-full",
                    "bg-[var(--accent)]/20 ring-2 ring-[var(--background)]",
                  )}
                  style={{
                    top: i * 5,
                    right: i * 5,
                    zIndex: 3 - i,
                  }}
                >
                  {notif.avatarUrl ? (
                    <img
                      src={notif.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      style={getAvatarCropStyle(notif.avatarCrop)}
                    />
                  ) : (
                    <MessageCircle className="h-4 w-4 text-[var(--accent)]" />
                  )}
                </div>
              ))}
              {/* Combined badge */}
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1",
                  "bg-red-500 text-[10px] font-bold text-white shadow",
                )}
              >
                {totalCount > 99 ? "99+" : totalCount}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Single notification bubble ──

function NotificationBubble({
  notif,
  onNavigate,
  onDismiss,
  onAcceptCall,
  onDeclineCall,
  pendingCallAction,
}: {
  notif: ChatNotification;
  onNavigate: () => void;
  onDismiss: () => void;
  onAcceptCall: () => void;
  onDeclineCall: () => void;
  pendingCallAction: string | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const isCall = notif.kind === "call" && !!notif.callId;
  const accepting = isCall && pendingCallAction === `accept:${notif.callId}`;
  const declining = isCall && pendingCallAction === `decline:${notif.callId}`;
  const disabled = accepting || declining;

  return (
    <motion.div
      key={notif.chatId}
      initial={{ x: 60, opacity: 0, scale: 0.8 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 60, opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="pointer-events-auto group relative"
    >
      {/* Dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isCall) onDeclineCall();
          else onDismiss();
        }}
        className={cn(
          "absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full",
          "bg-[var(--background)] text-[var(--foreground)]/60 shadow-md ring-1 ring-[var(--foreground)]/10",
          "transition-opacity hover:text-[var(--foreground)]",
          "opacity-0 group-hover:opacity-100 max-md:opacity-100",
        )}
      >
        <X className="h-3 w-3" />
      </button>

      {/* Avatar bubble */}
      <button
        onClick={onNavigate}
        className={cn(
          "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full",
          isCall
            ? "bg-emerald-500/15 shadow-lg ring-2 ring-emerald-400/60"
            : "bg-[var(--accent)]/20 shadow-lg ring-2 ring-[var(--accent)]/40",
          "transition-transform hover:scale-110 active:scale-95",
        )}
        title={isCall ?localizeUi("ui.chat.notificationbubble.value1IsCalling", { value1: notif.characterName }) :localizeUi("ui.chat.notificationbubble.value1SentAMessage", { value1: notif.characterName })}
      >
        {notif.avatarUrl ? (
          <img
            src={notif.avatarUrl}
            alt={notif.characterName}
            className="h-full w-full object-cover"
            loading="lazy"
            style={getAvatarCropStyle(notif.avatarCrop)}
          />
        ) : (
          <MessageCircle className={cn("h-5 w-5", isCall ? "text-emerald-400" : "text-[var(--accent)]")} />
        )}
        {isCall && (
          <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-[var(--background)]">
            <PhoneIncoming size="0.6875rem" />
          </span>
        )}
      </button>

      {isCall ? (
        <div className="absolute right-14 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-[var(--popover)] px-1.5 py-1 shadow-lg ring-1 ring-[var(--border)]">
          <button
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onDeclineCall();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--destructive)] text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
            title={localizeUi("ui.chat.notificationbubble.declineCall")}
          >
            {declining ? <Loader2 size="0.8125rem" className="animate-spin" /> : <PhoneOff size="0.8125rem" />}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onAcceptCall();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
            title={localizeUi("ui.chat.notificationbubble.answerCall")}
          >
            {accepting ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Phone size="0.8125rem" />}
          </button>
        </div>
      ) : (
        <span
          className={cn(
            "absolute -bottom-0.5 -left-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1",
            "bg-red-500 text-[10px] font-bold text-white shadow",
          )}
        >
          {notif.count > 99 ? "99+" : notif.count}
        </span>
      )}
    </motion.div>
  );
}
