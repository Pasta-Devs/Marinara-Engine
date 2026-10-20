import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useConnections } from "../../hooks/use-connections";
import { useCreateChat } from "../../hooks/use-chats";
import { useChatPresets, useApplyChatPreset } from "../../hooks/use-chat-presets";
import { useChatStore } from "../../stores/chat.store";
import { isMobileShellViewport, useUIStore } from "../../stores/ui.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { appendLocalSidecarConnectionOption } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ChatModeIcon } from "./ChatModeIcon";
import { CreateConnectionModal } from "../modals/CreateConnectionModal";
import { ConnectionSelect } from "../connections/ConnectionSelect";

type Mode = "conversation" | "roleplay" | "game";

const MODE_ICON: Record<Mode, React.ReactNode> = {
  conversation: <ChatModeIcon mode="conversation" size="0.875rem" />,
  roleplay: <ChatModeIcon mode="roleplay" size="0.875rem" />,
  game: <ChatModeIcon mode="game" size="0.875rem" />,
};

interface NewChatConnectionGateProps {
  mode: Mode;
  onClose: () => void;
}

export function NewChatConnectionGate({ mode, onClose }: NewChatConnectionGateProps) {
  const { t: localizeUi } = useUiTranslation();
  const modeLabel = localizeUi(`connections.add.mode.${mode}`);
  const { data: connections, isLoading } = useConnections();
  const createChat = useCreateChat();
  const { data: chatPresetsData } = useChatPresets();
  const applyChatPreset = useApplyChatPreset();
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

  const createWith = async (connectionId: string) => {
    const presets = chatPresetsData ?? [];
    const presetMode = mode === "conversation" || mode === "roleplay" ? mode : null;
    const starred = presetMode
      ? (presets.find((p) => p.mode === presetMode && p.isActive && !p.isDefault) ?? null)
      : null;
    await createChat.mutateAsync(
      {
        name: `New ${mode[0]!.toUpperCase()}${mode.slice(1)}`, // chat names are stored English
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
          } else if (isMobileShellViewport()) {
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

  const handleCreate = () => {
    if (connectionId) void createWith(connectionId).catch(() => {});
  };

  // With no connection yet, the Add window opens at once and ends with "Start chatting". It stays the
  // gate's view until it closes, also after the first Connection exists.
  const [addFlow, setAddFlow] = useState(false);
  const showEmptyState = !isLoading && connectionRows.length === 0;
  useEffect(() => {
    if (showEmptyState) setAddFlow(true);
  }, [showEmptyState]);

  if (addFlow) {
    return <CreateConnectionModal open onClose={onClose} newChatMode={mode} onStartChat={createWith} />;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[3px]" onClick={onClose} />
      <div
        data-new-chat-connection-gate={mode}
        className="mari-chrome-token-scope mari-chrome-text-accent-scope fixed inset-0 z-50 flex items-center justify-center p-3 max-md:pt-[max(0.75rem,env(safe-area-inset-top))] max-md:pb-[max(0.75rem,var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] sm:p-4"
      >
        <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl sm:max-h-[min(90dvh,38rem)]">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">
                {localizeUi("ui.chat.newchatconnectiongate.setUp")} {modeLabel}
              </h3>
              <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.newchatconnectiongate.chooseAConnectionBeforeWeCreateTheChat")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            >
              <X size="0.875rem" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
            {!showEmptyState && (
              <div className="space-y-1.5">
                <label className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.conversationquicksetup.connection")}
                </label>
                <ConnectionSelect
                  value={connectionId || null}
                  onChange={(id) => setConnectionId(id ?? "")}
                  defaultLabel={localizeUi("ui.chat.customemojiselectionsettings.selectAConnection")}
                />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            >
              {localizeUi("chat.delete.dialog.cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={showEmptyState || !connectionId || createChat.isPending}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium shadow-sm transition-all active:scale-95",
                showEmptyState || !connectionId || createChat.isPending
                  ? "cursor-not-allowed bg-[var(--secondary)] text-[var(--muted-foreground)] opacity-60"
                  : "mari-chrome-accent-surface border",
              )}
            >
              {createChat.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : MODE_ICON[mode]}
              {localizeUi("ui.chat.newchatconnectiongate.createChat")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
