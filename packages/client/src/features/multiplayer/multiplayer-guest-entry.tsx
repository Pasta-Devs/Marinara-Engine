import { createRoot } from "react-dom/client";
import { MultiplayerGuestView } from "./MultiplayerGuestView";
import {
  isGuestBootstrap,
  readGuestParentMessage,
  type MultiplayerGuestPresentation,
} from "./multiplayer-guest-channel";
import type { MultiplayerAction } from "@marinara-engine/shared";
import "./multiplayer-guest.css";

const rootElement = document.getElementById("multiplayer-root");
// The current Android wrapper injects a native object into every frame. It is
// unsupported until it provides a separately verified bridge-free guest view.
if (rootElement && window.parent !== window && !("MarinaraAndroidNative" in window)) {
  const root = createRoot(rootElement);
  let bound = false;
  let closed = false;
  let port: MessagePort | null = null;
  let presentation: MultiplayerGuestPresentation | null = null;
  let identity: { roomId: string; selfId: string; revision: number } | null = null;
  const pending = new Map<string, { settle: (accepted: boolean) => void; timeout: ReturnType<typeof setTimeout> }>();

  function stop() {
    if (closed) return;
    closed = true;
    port?.postMessage(JSON.stringify({ type: "fault" }));
    port?.close();
    for (const action of pending.values()) {
      clearTimeout(action.timeout);
      action.settle(false);
    }
    pending.clear();
    if (presentation) {
      presentation = { ...presentation, state: { ...presentation.state, phase: "ended", error: "invalid-message" } };
      render();
    }
  }

  function onAction(action: MultiplayerAction): Promise<boolean> {
    if (!port || closed || pending.size >= 4) return Promise.resolve(false);
    const id = crypto.randomUUID();
    return new Promise((settle) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        settle(false);
      }, 30_000);
      pending.set(id, { settle, timeout });
      port!.postMessage(JSON.stringify({ type: "action", id, action }));
    });
  }

  function render() {
    if (!presentation) return;
    document.documentElement.dataset.theme = presentation.theme.mode;
    document.documentElement.style.setProperty("--primary", presentation.theme.accent);
    root.render(<MultiplayerGuestView state={presentation.state} labels={presentation.labels} onAction={onAction} />);
  }

  function bootstrap(event: MessageEvent<unknown>) {
    if (bound || event.source !== window.parent || !isGuestBootstrap(event.data) || event.ports.length !== 1) return;
    bound = true;
    window.removeEventListener("message", bootstrap);
    port = event.ports[0]!;
    port.onmessageerror = stop;
    port.onmessage = (incoming: MessageEvent<unknown>) => {
      if (closed) return;
      try {
        const message = readGuestParentMessage(incoming.data);
        if (message.type === "state") {
          const next = message.state.snapshot;
          if (
            identity &&
            next &&
            (identity.roomId !== next.roomId || identity.selfId !== next.selfId || next.revision < identity.revision)
          ) {
            return stop();
          }
          if (next) identity = { roomId: next.roomId, selfId: next.selfId, revision: next.revision };
          presentation = message;
          render();
        } else {
          const action = pending.get(message.id);
          if (!action) return;
          pending.delete(message.id);
          clearTimeout(action.timeout);
          action.settle(message.accepted);
        }
      } catch {
        stop();
      }
    };
    port.postMessage(JSON.stringify({ type: "ready", token: event.data.token }));
  }

  window.addEventListener("message", bootstrap);
  window.addEventListener("pagehide", stop, { once: true });
}
