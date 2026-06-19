import { useState } from "react";
import { ChevronDown, ChevronRight, Drama, RotateCcw } from "lucide-react";
import { DEFAULT_IMPERSONATE_PROMPT } from "@marinara-engine/shared";
import { useUIStore } from "../../../stores/ui.store";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface ImpersonateSectionProps {
  presets: Array<{ id: string; name: string }>;
  connections: Array<{ id: string; name: string }>;
}

export function ImpersonateSection({ presets, connections }: ImpersonateSectionProps) {
  const promptTemplate = useUIStore((state) => state.impersonatePromptTemplate);
  const setPromptTemplate = useUIStore((state) => state.setImpersonatePromptTemplate);
  const cyoaChoices = useUIStore((state) => state.impersonateCyoaChoices);
  const setCyoaChoices = useUIStore((state) => state.setImpersonateCyoaChoices);
  const presetId = useUIStore((state) => state.impersonatePresetId);
  const setPresetId = useUIStore((state) => state.setImpersonatePresetId);
  const connectionId = useUIStore((state) => state.impersonateConnectionId);
  const setConnectionId = useUIStore((state) => state.setImpersonateConnectionId);
  const blockAgents = useUIStore((state) => state.impersonateBlockAgents);
  const setBlockAgents = useUIStore((state) => state.setImpersonateBlockAgents);
  const hasPromptTemplate = promptTemplate.trim().length > 0;
  const promptStatus = hasPromptTemplate ? "Custom" : "Chat/default";
  const [defaultOpen, setDefaultOpen] = useState(false);

  return (
    <ChatSettingsSection
      label="Impersonate"
      icon={<Drama size="0.875rem" />}
      help="Global settings applied to every /impersonate generation across all chats."
    >
      <div className="space-y-2.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-xs font-semibold">Prompt Template</span>
              <HelpTooltip text="Optional global instruction sent to the model when you /impersonate. Leave empty to use the chat-specific prompt, or the built-in default if that chat has none. Macros like {{user}}, {{persona_description}} and {{impersonate_direction}} are replaced before sending." />
            </div>
            <span className="shrink-0 rounded-full bg-[var(--secondary)]/55 px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {promptStatus}
            </span>
          </div>
          <textarea
            value={promptTemplate}
            onChange={(event) => setPromptTemplate(event.target.value)}
            placeholder="Empty = use chat/built-in default"
            rows={4}
            className="min-h-20 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-1.5 font-mono text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setDefaultOpen((open) => !open)}
              className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]/70 hover:text-[var(--foreground)]"
            >
              {defaultOpen ? <ChevronDown size="0.6875rem" /> : <ChevronRight size="0.6875rem" />}
              Built-in default
            </button>
            {hasPromptTemplate && (
              <button
                onClick={() => setPromptTemplate("")}
                className="flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Reset to default"
              >
                <RotateCcw size="0.625rem" />
                Reset
              </button>
            )}
          </div>
          {defaultOpen && (
            <pre className="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--secondary)]/40 px-3 py-2 font-mono text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {DEFAULT_IMPERSONATE_PROMPT}
            </pre>
          )}
        </div>

        <div className="space-y-1.5 rounded-lg bg-[var(--secondary)]/20 p-2 ring-1 ring-[var(--border)]">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.6875rem] font-semibold">Preset</span>
                <HelpTooltip text="Use a specific prompt preset for roleplay impersonate generations only. Conversation mode does not use prompt presets. Falls back to the chat's preset when set to 'Use chat default'." />
              </div>
              <select
                value={presetId ?? ""}
                onChange={(event) => setPresetId(event.target.value || null)}
                className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
              >
                <option value="">Use chat default</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.6875rem] font-semibold">Connection</span>
                <HelpTooltip text="Use a specific connection (model/provider) for impersonate generations only. Useful for routing impersonate to a cheaper or faster model." />
              </div>
              <select
                value={connectionId ?? ""}
                onChange={(event) => setConnectionId(event.target.value || null)}
                className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
              >
                <option value="">Use chat default</option>
                <option value="random">Random</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-1 border-t border-[var(--border)]/60 pt-1.5">
            <SettingsSwitch
              label="Skip agents"
              help="When enabled, the agent pipeline (trackers, lorebook routers, etc.) is suppressed during impersonate so generations stay fast and don't trigger world-state mutations."
              description="Suppress trackers, routers, and other agent work."
              checked={blockAgents}
              onChange={setBlockAgents}
              labelPosition="start"
              className="justify-between rounded-md px-2 py-1.5 text-left"
              labelClassName="text-xs font-semibold"
            />

            <SettingsSwitch
              label="Use CYOA as direction"
              help="When enabled, clicking a CYOA option uses it as the direction for an impersonate generation instead of sending the option as a normal user message."
              description="Treat choices as impersonate guidance."
              checked={cyoaChoices}
              onChange={setCyoaChoices}
              labelPosition="start"
              className="justify-between rounded-md px-2 py-1.5 text-left"
              labelClassName="text-xs font-semibold"
            />
          </div>

          <p className="border-t border-[var(--border)]/60 px-2 pt-1.5 text-[0.65rem] leading-snug text-[var(--muted-foreground)]">
            Enable Quick Send in Settings &gt; Advanced &gt; Quick replies.
          </p>
        </div>
      </div>
    </ChatSettingsSection>
  );
}
