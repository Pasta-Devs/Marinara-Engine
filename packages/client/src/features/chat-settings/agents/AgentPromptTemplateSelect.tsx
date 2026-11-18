import { useTranslation } from "react-i18next";
import { DEFAULT_AGENT_PROMPT_TEMPLATE_ID, type AgentPromptTemplateOption } from "@marinara-engine/shared";
import { AgentDefaultStatus } from "../../../components/chat/AgentSettingsControls";
import { Select } from "../../../components/ui/Select";

interface AgentPromptTemplateSelectProps {
  options: AgentPromptTemplateOption[];
  selectedId: string;
  overridden?: boolean;
  onChange: (promptTemplateId: string) => void;
}

export function AgentPromptTemplateSelect({
  options,
  selectedId,
  overridden = false,
  onChange,
}: AgentPromptTemplateSelectProps) {
  const { t: localizeUi } = useTranslation();
  if (options.length <= 1) {
    return overridden ? <AgentDefaultStatus overridden onReset={() => onChange("")} /> : null;
  }
  const activeOption = options.find((option) => option.id === selectedId) ?? options[0];

  return (
    <div className="mt-2 rounded-lg bg-[var(--background)]/25 px-2 py-2 ring-1 ring-[var(--border)]/70">
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.5625rem] font-semibold uppercase text-[var(--muted-foreground)]">
          {localizeUi("ui.agents.customagentrepositoriesmodal.prompt")}
        </span>
        <Select
          label={localizeUi("ui.agents.customagentrepositoriesmodal.prompt")}
          value={activeOption?.id ?? DEFAULT_AGENT_PROMPT_TEMPLATE_ID}
          options={options.map((option) => ({ value: option.id, label: option.name }))}
          onChange={onChange}
          className="w-full rounded-md bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      {activeOption?.description ? (
        <p className="mt-1.5 text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
          {activeOption.description}
        </p>
      ) : null}
      <AgentDefaultStatus overridden={overridden} onReset={() => onChange("")} />
    </div>
  );
}
