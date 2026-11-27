// ──────────────────────────────────────────────
// Prompt viewer page (its own tab)
//
// kolache's AIO Prompt Viewer and Editor, built in: pick a preset, lorebooks,
// characters and a persona, see them assemble in the order the engine sends
// them, and edit any piece in place. The console itself is plain DOM code
// (prompt-viewer-console.ts); this page gives it a place in the layout, the
// app's dialogs, the open chat, and refreshes the app's editors after a save.
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { queryClient } from "../../../lib/query-client";
import { showChoiceDialog } from "../../../lib/app-dialogs";
import { useChatStore } from "../../../stores/chat.store";
import {
  configurePromptViewer,
  mountPromptViewer,
  requestPromptViewerClose,
  unmountPromptViewer,
} from "./prompt-viewer-console";
import { setPromptViewerCloseGuard } from "./close-guard";
import "./prompt-viewer.css";

/** Which of the app's cached lists a write to `path` (under /api) changes. */
function queryRootsFor(path: string): string[] {
  if (path.startsWith("/prompts")) return ["presets"];
  if (path.startsWith("/lorebooks")) return ["lorebooks"];
  if (path.startsWith("/characters")) return ["characters", "personas"];
  return [];
}

let configured = false;
function configureOnce() {
  if (configured) return;
  configured = true;
  configurePromptViewer({
    activeChatId: () => useChatStore.getState().activeChatId,
    invalidate: (path: string) => {
      for (const root of queryRootsFor(path)) void queryClient.invalidateQueries({ queryKey: [root] });
    },
    choice: (options: Parameters<typeof showChoiceDialog>[0]) => showChoiceDialog(options),
  });
  // Closing the tab with unsaved edits asks first (Save / Revert / Stay).
  setPromptViewerCloseGuard(requestPromptViewerClose);
}

export function PromptViewerPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    configureOnce();
    mountPromptViewer(host);
    // The title bar's height places the Inspect / Summaries / Settings views under it.
    const bar = host.querySelector<HTMLElement>(".kaio-titlebar");
    const observer = bar
      ? new ResizeObserver(() => host.style.setProperty("--kaio-titlebar-h", `${bar.offsetHeight}px`))
      : null;
    if (bar) observer?.observe(bar);
    return () => {
      observer?.disconnect();
      unmountPromptViewer();
    };
  }, []);
  return <div ref={hostRef} className="ov-prompt-viewer" data-component="PromptViewer" />;
}
