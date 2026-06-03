import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "../../../../../shared/stores/chat.store";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type PendingSetupOverlayOpen = {
  key: string;
  cancel: () => void;
};

function scheduleSetupOverlayOpen(run: () => void): () => void {
  if (typeof window === "undefined") {
    run();
    return () => {};
  }

  let canceled = false;
  let idleHandle: number | null = null;
  const idleWindow = window as IdleWindow;
  const frameHandle = window.requestAnimationFrame(() => {
    if (canceled) return;
    if (typeof idleWindow.requestIdleCallback === "function") {
      idleHandle = idleWindow.requestIdleCallback(
        () => {
          if (!canceled) run();
        },
        { timeout: 350 },
      );
      return;
    }
    idleHandle = window.setTimeout(() => {
      if (!canceled) run();
    }, 48);
  });

  return () => {
    canceled = true;
    window.cancelAnimationFrame(frameHandle);
    if (idleHandle != null) {
      if (typeof idleWindow.cancelIdleCallback === "function") idleWindow.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
    }
  };
}

export function useChatOverlays(activeChatId: string) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [spriteArrangeMode, setSpriteArrangeMode] = useState(false);
  const pendingSetupOverlayOpenRef = useRef<PendingSetupOverlayOpen | null>(null);

  const newChatSetupIntent = useChatStore((state) => state.newChatSetupIntent);
  const shouldOpenSettings = useChatStore((state) => state.shouldOpenSettings);
  const shouldOpenWizard = useChatStore((state) => state.shouldOpenWizard);

  const queueSetupOverlayOpen = useCallback((key: string, run: () => void, onCancel?: () => void): boolean => {
    if (pendingSetupOverlayOpenRef.current?.key === key) return false;
    pendingSetupOverlayOpenRef.current?.cancel();

    let settled = false;
    const cancelScheduledOpen = scheduleSetupOverlayOpen(() => {
      settled = true;
      pendingSetupOverlayOpenRef.current = null;
      run();
    });
    pendingSetupOverlayOpenRef.current = {
      key,
      cancel: () => {
        if (settled) return;
        settled = true;
        cancelScheduledOpen();
        if (pendingSetupOverlayOpenRef.current?.key === key) pendingSetupOverlayOpenRef.current = null;
        onCancel?.();
      },
    };
    return true;
  }, []);

  useEffect(() => {
    setSpriteArrangeMode(false);
  }, [activeChatId]);

  useEffect(
    () => () => {
      pendingSetupOverlayOpenRef.current?.cancel();
      pendingSetupOverlayOpenRef.current = null;
    },
    [activeChatId],
  );

  useEffect(() => {
    if (!activeChatId) return;

    const intent = useChatStore.getState().consumeNewChatSetupIntent(activeChatId);
    if (intent) {
      queueSetupOverlayOpen(`intent:${intent.chatId}`, () => {
        if (intent.openWizard) {
          if (intent.shortcutMode) useChatStore.getState().setShouldOpenWizardInShortcutMode(true);
          setWizardOpen(true);
        } else if (intent.openSettings) {
          setSettingsOpen(true);
        }
      });
      return;
    }

    if (shouldOpenSettings && !newChatSetupIntent) {
      const clearLegacyFlags = () => {
        useChatStore.getState().setShouldOpenWizard(false);
        useChatStore.getState().setShouldOpenSettings(false);
      };
      queueSetupOverlayOpen(
        `legacy:${activeChatId}:${shouldOpenWizard ? "wizard" : "settings"}`,
        () => {
          if (shouldOpenWizard) setWizardOpen(true);
          else setSettingsOpen(true);
          clearLegacyFlags();
        },
        clearLegacyFlags,
      );
    }
  }, [newChatSetupIntent, queueSetupOverlayOpen, shouldOpenSettings, shouldOpenWizard, activeChatId]);

  return {
    settingsOpen,
    filesOpen,
    galleryOpen,
    wizardOpen,
    spriteArrangeMode,
    setSettingsOpen,
    setFilesOpen,
    setGalleryOpen,
    setWizardOpen,
    setSpriteArrangeMode,
    openSettings: () => setSettingsOpen(true),
    openFiles: () => setFilesOpen(true),
    openGallery: () => setGalleryOpen(true),
    closeSettings: () => setSettingsOpen(false),
    closeFiles: () => setFilesOpen(false),
    closeGallery: () => setGalleryOpen(false),
    finishWizard: () => {
      setWizardOpen(false);
      setSettingsOpen(true);
    },
    toggleSpriteArrange: () => setSpriteArrangeMode((current) => !current),
  };
}
