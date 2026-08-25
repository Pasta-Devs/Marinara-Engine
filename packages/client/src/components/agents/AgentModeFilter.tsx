import type { ChatMode } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

export type AgentModeFilterValue = "all" | ChatMode;

const MODE_FILTERS = [
  ["all", "ui.agents.agentcatalogview.allModes"],
  ["conversation", "ui.agents.agentcatalogview.conversationMode"],
  ["roleplay", "ui.agents.agentcatalogview.roleplayMode"],
  ["game", "ui.agents.agentcatalogview.gameMode"],
] as const;

export function AgentModeFilter({
  value,
  onChange,
  className,
}: {
  value: AgentModeFilterValue;
  onChange: (value: AgentModeFilterValue) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn("grid grid-cols-4 gap-1", className)}
      role="group"
      aria-label={t("ui.agents.agentcatalogview.filterByChatMode")}
    >
      {MODE_FILTERS.map(([mode, labelKey]) => (
        <button
          key={mode}
          type="button"
          className={cn(
            "mari-chrome-control h-8 min-h-8 w-full min-w-0 px-1 text-[0.625rem]",
            value === mode && "mari-chrome-control--selected",
          )}
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
        >
          <span className="truncate">{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
