import { useState } from "react";
import { Maximize2 } from "lucide-react";

import type { CharacterData } from "../../../../engine/contracts/types/character";
import { ExpandedTextarea } from "../../../../shared/components/ui/ExpandedTextarea";
import { HelpTooltip } from "../../../../shared/components/ui/HelpTooltip";
import { CharacterEditorSectionHeader as SectionHeader } from "./CharacterEditorSectionHeader";

export function CharacterAdvancedTab({
  formData,
  updateField,
  updateExtension,
}: {
  formData: CharacterData;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
  updateExtension: (key: string, value: unknown) => void;
}) {
  const depthPrompt = formData.extensions.depth_prompt ?? { prompt: "", depth: 4, role: "system" as const };
  const [expandedField, setExpandedField] = useState<"system_prompt" | "post_history" | "depth_prompt" | null>(null);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Advanced"
        subtitle="System prompt, post-history instructions, and depth prompt injection."
      />

      <label className="block space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            System Prompt{" "}
            <HelpTooltip text="Overrides or appends to the main system prompt when this character is active. Use this for character-specific instructions the AI must follow." />
          </span>
          <button
            type="button"
            onClick={() => setExpandedField("system_prompt")}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Expand editor"
          >
            <Maximize2 size="0.875rem" />
          </button>
        </div>
        <textarea
          value={formData.system_prompt}
          onChange={(e) => updateField("system_prompt", e.target.value)}
          rows={6}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder="Override or append to the system prompt for this character…"
        />
      </label>

      <label className="block space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Post-History Instructions{" "}
            <HelpTooltip text="Text inserted after the chat history, right before the AI generates. Great for reminders like 'stay in character' or 'respond in 2 paragraphs'." />
          </span>
          <button
            type="button"
            onClick={() => setExpandedField("post_history")}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Expand editor"
          >
            <Maximize2 size="0.875rem" />
          </button>
        </div>
        <textarea
          value={formData.post_history_instructions}
          onChange={(e) => updateField("post_history_instructions", e.target.value)}
          rows={4}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder="Text inserted after the chat history but before generation…"
        />
      </label>

      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            Depth Prompt{" "}
            <HelpTooltip text="Injects text at a specific position in the chat history. Depth 0 = at the end, depth 4 = 4 messages back. Useful for persistent reminders." />
          </span>
          <button
            type="button"
            onClick={() => setExpandedField("depth_prompt")}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Expand editor"
          >
            <Maximize2 size="0.875rem" />
          </button>
        </div>
        <textarea
          value={depthPrompt.prompt}
          onChange={(e) => updateExtension("depth_prompt", { ...depthPrompt, prompt: e.target.value })}
          rows={4}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none focus:border-[var(--primary)]/40"
          placeholder="Prompt injected at a specific depth in the chat history…"
        />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">Depth</span>
            <input
              type="number"
              min={0}
              max={100}
              value={depthPrompt.depth}
              onChange={(e) =>
                updateExtension("depth_prompt", { ...depthPrompt, depth: parseInt(e.target.value) || 0 })
              }
              className="w-16 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-center text-xs outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">Role</span>
            <select
              value={depthPrompt.role}
              onChange={(e) => updateExtension("depth_prompt", { ...depthPrompt, role: e.target.value })}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs outline-none"
            >
              <option value="system">System</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
            </select>
          </label>
        </div>
      </div>

      <ExpandedTextarea
        open={expandedField === "system_prompt"}
        onClose={() => setExpandedField(null)}
        title="System Prompt"
        value={formData.system_prompt}
        onChange={(value) => updateField("system_prompt", value)}
        placeholder="Override or append to the system prompt for this character…"
      />
      <ExpandedTextarea
        open={expandedField === "post_history"}
        onClose={() => setExpandedField(null)}
        title="Post-History Instructions"
        value={formData.post_history_instructions}
        onChange={(value) => updateField("post_history_instructions", value)}
        placeholder="Text inserted after the chat history but before generation…"
      />
      <ExpandedTextarea
        open={expandedField === "depth_prompt"}
        onClose={() => setExpandedField(null)}
        title="Depth Prompt"
        value={depthPrompt.prompt}
        onChange={(value) => updateExtension("depth_prompt", { ...depthPrompt, prompt: value })}
        placeholder="Prompt injected at a specific depth in the chat history…"
      />
    </div>
  );
}
