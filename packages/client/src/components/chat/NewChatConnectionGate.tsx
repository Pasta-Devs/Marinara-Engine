import { useEffect, useMemo, useState } from "react";
import { Loader2, Plug, X } from "lucide-react";
import { useConnections } from "../../hooks/use-connections";
import { useCreateChat } from "../../hooks/use-chats";
import { useChatPresets, useApplyChatPreset } from "../../hooks/use-chat-presets";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { appendLocalSidecarConnectionOption } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ChatModeIcon } from "./ChatModeIcon";

type Mode = "conversation" | "roleplay" | "game";

const MODE_META: Record<Mode, { label: string; icon: React.ReactNode }> = {
  conversation: { label: "Conversation", icon: <ChatModeIcon mode="conversation" size="0.875rem" /> },
  roleplay: { label: "Roleplay", icon: <ChatModeIcon mode="roleplay" size="0.875rem" /> },
  game: { label: "Game", icon: <ChatModeIcon mode="game" size="0.875rem" /> },
};

interface NewChatConnectionGateProps {
  mode: Mode;
  onClose: () => void;
}

export function NewChatConnectionGate({ mode, onClose }: NewChatConnectionGateProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: connections, isLoading } = useConnections();
  const createChat = useCreateChat();
  const { data: chatPresetsData } = useChatPresets();
  const applyChatPreset = useApplyChatPreset();
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const pendingNewChatOrigin = useChatStore((s) => s.pendingNewChatOrigin);
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);
  const [connectionId, setConnectionId] = useState<string>("");

  const connectionRows = useMemo(
    () =>
      appendLocalSidecarConnectionOption(
        (connections ?? []) as Array<{ id: string; name: string; provider?: string; isDefault?: boolean | string }>,
        mode !== "game" && sidecarModelDownloaded,
        sidecarModelDisplayName,
      ),
    [connections, mode, sidecarModelDisplayName, sidecarModelDownloaded],
  );

  useEffect(() => {
    if (connectionRows.length === 0) {
      setConnectionId("");
      return;
    }
    const isDefault = (row: { isDefault?: boolean | string }) => row.isDefault === true || row.isDefault === "true";
    const preferred = connectionRows.find(isDefault) ?? connectionRows[0]!;
    setConnectionId((current) => current || preferred.id);
  }, [connectionRows]);

  const handleCreate = () => {
    if (!connectionId) return;
    const label = MODE_META[mode].label;
    const presets = chatPresetsData ?? [];
    const presetMode = mode === "conversation" || mode === "roleplay" ? mode : null;
    const starred = presetMode
      ? (presets.find((p) => p.mode === presetMode && p.isActive && !p.isDefault) ?? null)
      : null;
    createChat.mutate(
      {
        name: `New ${label}`,
        mode,
        characterIds: [],
        connectionId,
        promptPresetId: starred?.settings.promptPresetId ?? undefined,
      },
      {
        onSuccess: (chat) => {
          const store = useChatStore.getState();
          store.setPendingNewChatMode(null);
          if (pendingNewChatOrigin === "home") {
            setSidebarOpen(true);
          } else if (typeof window !== "undefined" && window.innerWidth < 768) {
            setSidebarOpen(false);
          }
          store.setActiveChatId(chat.id);
          store.setShouldOpenSettings(true);
          store.setShouldOpenWizard(true);
          if (starred) {
            void applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id, connectionId }).catch(() => {
              /* non-fatal — chat still opens with system defaults */
            });
          }
        },
      },
    );
  };

  const showEmptyState = !isLoading && connectionRows.length === 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[3px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 max-md:pt-[max(0.75rem,env(safe-area-inset-top))] max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
        <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl sm:max-h-[min(90dvh,38rem)]">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">{localizeUi("ui.chat.newchatconnectiongate.setUp")} {MODE_META[mode].label}</h3>
              <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{localizeUi("ui.chat.newchatconnectiongate.chooseAConnectionBeforeWeCreateTheChat")}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            >
              <X size="0.875rem" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
            {showEmptyState ? (
              <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/8 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                  <Plug size="0.875rem" className="text-[var(--primary)]" />{localizeUi("ui.chat.newchatconnectiongate.noConnectionsFound")}</div>
                <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("ui.chat.newchatconnectiongate.createAConnectionFirstThenComeBackHereAnd")}</p>
                <button
                  onClick={() => openRightPanel("connections")}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/20"
                >
                  <Plug size="0.75rem" />{localizeUi("ui.chat.newchatconnectiongate.openConnections")}</button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{localizeUi("ui.chat.conversationquicksetup.connection")}</label>
                <select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  disabled={createChat.isPending}
                  className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-xs outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
                >
                  <option value="">{localizeUi("ui.chat.customemojiselectionsettings.selectAConnection")}</option>
                  {connectionRows.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            >{localizeUi("chat.delete.dialog.cancel")}</button>
            <button
              onClick={handleCreate}
              disabled={showEmptyState || !connectionId || createChat.isPending}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium shadow-sm transition-all active:scale-95",
                showEmptyState || !connectionId || createChat.isPending
                  ? "cursor-not-allowed bg-[var(--secondary)] text-[var(--muted-foreground)] opacity-60"
                  : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
              )}
            >
              {createChat.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : MODE_META[mode].icon}{localizeUi("ui.chat.newchatconnectiongate.createChat")}</button>
          </div>
        </div>
      </div>
    </>
  );
}
