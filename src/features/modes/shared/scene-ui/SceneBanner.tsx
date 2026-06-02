// ──────────────────────────────────────────────
// SceneBanner — inline message-style indicators for active scenes
// ──────────────────────────────────────────────
import { Film, ArrowRight, ArrowLeft, Trash2, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { showConfirmDialog } from "../../../../shared/lib/app-dialogs";
import type { SceneForkMode } from "../../../../engine/contracts/types/scene";

interface SceneBannerProps {
  /** "origin" = the conversation has an active scene; "scene" = we ARE the scene chat */
  variant: "scene" | "origin";
  sceneChatId?: string;
  sceneChatName?: string;
  originChatId?: string;
  description?: string;
}

export function SceneBanner({ variant, sceneChatId, sceneChatName, originChatId, description }: SceneBannerProps) {
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);

  if (variant === "scene") {
    // We're inside the scene — narrator-style description with back button
    return (
      <div
        className="mx-auto my-3 w-full max-w-2xl rounded-xl border px-5 py-4"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--card-foreground)",
        }}
      >
        <div
          className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Film size={14} />
          Scene
        </div>
        {description && (
          <p className="mb-3 text-sm leading-relaxed italic" style={{ color: "var(--card-foreground)" }}>
            {description}
          </p>
        )}
        {originChatId && (
          <button
            onClick={() => setActiveChatId(originChatId)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: "var(--muted)",
              color: "var(--muted-foreground)",
            }}
            title="Return to conversation"
          >
            <ArrowLeft size={12} />
            Back to conversation
          </button>
        )}
      </div>
    );
  }

  // variant === "origin" — inline message-style card at the bottom of the message list
  return (
    <div
      className="mx-auto my-3 flex w-full max-w-2xl items-center gap-3 rounded-xl border px-5 py-4"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--card-foreground)",
      }}
    >
      <Film size={18} className="shrink-0" style={{ color: "var(--primary)" }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: "var(--card-foreground)" }}>
          A scene is in progress
        </p>
        {sceneChatName && (
          <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>
            {sceneChatName}
          </p>
        )}
      </div>
      {sceneChatId && (
        <button
          onClick={() => setActiveChatId(sceneChatId)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-90"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
          title="Go to the active scene"
        >
          Go to Scene
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

interface EndSceneBarProps {
  sceneChatId: string;
  originChatId?: string;
  onConclude: (id: string) => void | Promise<void>;
  onAbandon?: (id: string) => void;
  onFork?: (id: string, mode: SceneForkMode) => void;
  isForking?: boolean;
}

/** End Scene bar — placed above the input area in scene chats */
export function EndSceneBar({
  sceneChatId,
  originChatId,
  onConclude,
  onAbandon,
  onFork,
  isForking,
}: EndSceneBarProps) {
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const handleConfirmEnd = async () => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      await onConclude(sceneChatId);
    } finally {
      setIsEnding(false);
    }
  };

  const handleConvert = async () => {
    const confirmed = await showConfirmDialog({
      title: "Convert this scene into a standalone roleplay?",
      message:
        "This will create a new roleplay chat from the current scene and detach the original scene from its conversation. No scene summary or character memory will be written back to the original conversation.",
      confirmLabel: "Convert",
      cancelLabel: "Cancel",
      tone: "destructive",
    });
    if (confirmed && !isForking) onFork?.(sceneChatId, "convert");
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-1.5">
      {originChatId && (
        <button
          onClick={() => setActiveChatId(originChatId)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all hover:opacity-80"
          style={{
            background: "var(--card)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
          }}
          title="Return to conversation"
        >
          <ArrowLeft size={12} />
          Back to conversation
        </button>
      )}
      {!confirmEnd && (
        <button
          onClick={() => {
            setConfirmDiscard(false);
            setConfirmEnd(true);
          }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all hover:opacity-80"
          style={{
            background: "var(--card)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
          }}
          title="End the scene and generate a summary"
        >
          <Film size={14} />
          End Scene
        </button>
      )}
      {confirmEnd && (
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6875rem] text-[var(--foreground)]">End and save summary?</span>
          <button
            onClick={handleConfirmEnd}
            disabled={isEnding}
            className="rounded-lg px-2 py-0.5 text-[0.6875rem] font-medium transition-all hover:opacity-80"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {isEnding ? "Saving..." : "Yes"}
          </button>
          <button
            onClick={() => setConfirmEnd(false)}
            disabled={isEnding}
            className="rounded-lg px-2 py-0.5 text-[0.6875rem] font-medium transition-all hover:opacity-80"
            style={{
              background: "var(--card)",
              color: "var(--card-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            No
          </button>
        </div>
      )}
      {onAbandon && !confirmDiscard && (
        <button
          onClick={() => {
            setConfirmEnd(false);
            setConfirmDiscard(true);
          }}
          disabled={isEnding}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all hover:opacity-80"
          style={{
            color: "var(--muted-foreground)",
          }}
          title="Discard the scene without saving"
        >
          <Trash2 size={13} />
          Discard
        </button>
      )}
      {onFork && !confirmDiscard && (
        <button
          onClick={handleConvert}
          disabled={isForking}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all hover:opacity-80"
          style={{
            color: "var(--muted-foreground)",
          }}
          title="Detach this scene into a standalone roleplay"
        >
          <ArrowRightLeft size={13} />
          Convert
        </button>
      )}
      {onAbandon && confirmDiscard && (
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6875rem] text-[var(--destructive)]">Discard scene?</span>
          <button
            onClick={() => onAbandon(sceneChatId)}
            className="rounded-lg px-2 py-0.5 text-[0.6875rem] font-medium transition-all hover:opacity-80"
            style={{ background: "var(--destructive)", color: "var(--destructive-foreground)" }}
          >
            Yes
          </button>
          <button
            onClick={() => setConfirmDiscard(false)}
            className="rounded-lg px-2 py-0.5 text-[0.6875rem] font-medium transition-all hover:opacity-80"
            style={{
              background: "var(--card)",
              color: "var(--card-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
