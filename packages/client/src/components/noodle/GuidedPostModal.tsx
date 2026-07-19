import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import type { NoodlerStageProfile } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";

function disclosureLabel(mode: NoodlerStageProfile["disclosureMode"]) {
  if (mode === "open") return "Publicly connected";
  if (mode === "hinted") return "Inspired alter ego";
  if (mode === "secret") return "Separate persona";
  return "Identity setup needed";
}

interface GuidedPostModalProps {
  profile: NoodlerStageProfile;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onGenerate: (direction: string) => void;
}

export function GuidedPostModal({ profile, isPending, error, onClose, onGenerate }: GuidedPostModalProps) {
  const [direction, setDirection] = useState("");

  return (
    <Modal
      open
      onClose={() => {
        if (!isPending) onClose();
      }}
      title={`Guide @${profile.handle}`}
      width="max-w-lg"
      mobileFullscreen
      closeDisabled={isPending}
      panelStyle={{ "--noodle-blue": "#7EA7FF" } as React.CSSProperties}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 border-b border-[var(--marinara-chat-chrome-panel-divider)] pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-blue)]/15 text-sm font-black text-[var(--noodle-blue)]">
            {Array.from(profile.displayName)[0]?.toUpperCase() || "N"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--foreground)]">{profile.displayName}</p>
            <p className="text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
              {disclosureLabel(profile.disclosureMode)}
            </p>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-[var(--foreground)]">Post direction</span>
          <textarea
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            maxLength={2000}
            autoFocus
            placeholder="Set the moment, mood, or idea for this post."
            className="mari-chrome-field min-h-36 w-full resize-y rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-sm leading-6 text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--noodle-blue)]"
          />
          <div className="flex items-start justify-between gap-4 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
            <p className="max-w-[34rem] leading-5">
              Generated text follows this identity relationship. Image prompts may be saved for later image support; no
              image preview is available here.
            </p>
            <span className="shrink-0 tabular-nums">{direction.length}/2000</span>
          </div>
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="min-h-11 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onGenerate(direction)}
            disabled={isPending || direction.trim().length === 0}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--noodle-blue)] px-5 text-sm font-bold text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isPending ? "Generating..." : "Generate post"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
