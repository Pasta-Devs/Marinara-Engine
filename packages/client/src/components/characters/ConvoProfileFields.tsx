// ──────────────────────────────────────────────
// Conversation-mode profile fields — display name, "about me" (+ AI write),
// and behavior directive. Shared by the character and persona editors.
// These fields only affect Conversation mode; they are never read in RP/VN/Game.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { ConvoBehaviorConfig, ConvoBehaviorInsertionStrategy } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useGenerateAboutMe } from "../../hooks/use-characters";
import { filterLanguageGenerationConnections } from "../../lib/connection-filters";
import { MacroTextarea } from "../ui/MacroTextarea";
import { HelpTooltip } from "../ui/HelpTooltip";

const STRATEGY_OPTIONS: Array<{ value: ConvoBehaviorInsertionStrategy; label: string }> = [
  { value: "constant_after", label: "Constant — after the card" },
  { value: "constant_before", label: "Constant — before the card" },
  { value: "post_history_after", label: "Append to post-history" },
  { value: "post_history_before", label: "Prepend to post-history" },
  { value: "post_history_replace", label: "Replace post-history" },
  { value: "macro", label: "Only where {{convo_behavior}} is placed" },
];

interface ConvoProfileFieldsProps {
  kind: "character" | "persona";
  /** Base name, used as the display-name placeholder. */
  baseName: string;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  aboutMe: string;
  onAboutMeChange: (value: string) => void;
  behavior: ConvoBehaviorConfig | null | undefined;
  onBehaviorChange: (value: ConvoBehaviorConfig) => void;
  /** Card fields the AI-write uses as source material. */
  aiSource: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    backstory: string;
    appearance: string;
  };
}

export function ConvoProfileFields({
  kind,
  baseName,
  displayName,
  onDisplayNameChange,
  aboutMe,
  onAboutMeChange,
  behavior,
  onBehaviorChange,
  aiSource,
}: ConvoProfileFieldsProps) {
  const { data: connectionsList } = useConnections();
  const generateAboutMe = useGenerateAboutMe();
  const [connectionId, setConnectionId] = useState("");

  const connectionOptions = useMemo(
    () => filterLanguageGenerationConnections((connectionsList ?? []) as Array<{ id: string; name: string; model?: string | null }>),
    [connectionsList],
  );
  const effectiveConnectionId =
    connectionId && connectionOptions.some((c) => c.id === connectionId)
      ? connectionId
      : (connectionOptions[0]?.id ?? "");

  const behaviorInstruction = behavior?.instruction ?? "";
  const behaviorStrategy: ConvoBehaviorInsertionStrategy = behavior?.insertionStrategy ?? "constant_after";

  const handleAiWrite = async () => {
    if (!effectiveConnectionId || generateAboutMe.isPending) return;
    try {
      const result = await generateAboutMe.mutateAsync({ connectionId: effectiveConnectionId, kind, ...aiSource });
      // The prompt may intentionally return an empty bio. Don't silently wipe an
      // existing about-me — only apply an empty result if the field was already empty.
      if (!result.aboutMe.trim() && aboutMe.trim()) {
        toast.message("The model left the about me blank — keeping your current text.");
        return;
      }
      onAboutMeChange(result.aboutMe);
      toast.success("About me drafted — review and edit to taste");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate about me");
    }
  };

  return (
    <div className="space-y-4">
      <div className="mari-editor-panel space-y-2 p-3">
        <span className="inline-flex items-center gap-1 text-xs font-semibold">
          Convo Display Name
          <HelpTooltip text="Shown as this person's name in Conversation mode. Leave blank to use their card name. Only affects Convo mode." />
        </span>
        <input
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder={baseName || "Display name"}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
        />
      </div>

      <div className="mari-editor-panel space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            About Me
            <HelpTooltip text="A short self-authored profile / bio, shown in Conversation mode. Some people write a lot; some leave it blank or drop a single emoji — that's fine. Only affects Convo mode." />
          </span>
        </div>
        <MacroTextarea
          value={aboutMe}
          onChange={onAboutMeChange}
          placeholder="A line or two, an emoji, a joke, or nothing at all — whatever fits them…"
          rows={5}
          title="About Me"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={effectiveConnectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-xs outline-none focus:border-[var(--primary)]/40"
          >
            {connectionOptions.length === 0 && <option value="">No connections available</option>}
            {connectionOptions.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name}
                {conn.model ? ` — ${conn.model}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAiWrite}
            disabled={!effectiveConnectionId || generateAboutMe.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            title="Draft an in-character about me from the card"
          >
            {generateAboutMe.isPending ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Wand2 size="0.8125rem" />}
            {generateAboutMe.isPending ? "Writing…" : "AI Write"}
          </button>
        </div>
      </div>

      <div className="mari-editor-panel space-y-3 p-3">
        <span className="inline-flex items-center gap-1 text-xs font-semibold">
          Convo Behavior
          <HelpTooltip
            wide
            text="A Conversation-mode-only instruction for how this person behaves in chat, plus where it goes in the prompt. Never sent in Roleplay, Visual Novel, or Game mode."
          />
        </span>
        <MacroTextarea
          value={behaviorInstruction}
          onChange={(value) => onBehaviorChange({ instruction: value, insertionStrategy: behaviorStrategy })}
          placeholder="e.g. Keep replies short and lowercase; texts like a real person, not a narrator…"
          rows={4}
          title="Convo Behavior"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
        />
        <label className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--muted-foreground)]">Insertion</span>
          <select
            value={behaviorStrategy}
            onChange={(e) =>
              onBehaviorChange({
                instruction: behaviorInstruction,
                insertionStrategy: e.target.value as ConvoBehaviorInsertionStrategy,
              })
            }
            className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs outline-none"
          >
            {STRATEGY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
