import { AlertTriangle, Plug } from "lucide-react";
import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ContextBudgetIndicator } from "../../../components/chat/ContextBudgetIndicator";
import type { ProfessorMariContextBudget } from "../../../lib/professor-mari-context-budget";

export interface ChatConnectionOption {
  id: string;
  name: string;
  model?: string;
}

interface ConnectionSectionProps {
  connectionId: string | null;
  connections: ChatConnectionOption[];
  contextBudget?: ProfessorMariContextBudget | null;
  isGame: boolean;
  onConnectionChange: (connectionId: string | null) => void;
}

export function ConnectionSection({
  connectionId,
  connections,
  contextBudget,
  isGame,
  onConnectionChange,
}: ConnectionSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const selectedLocalSidecar = connectionId === LOCAL_SIDECAR_CONNECTION_ID;

  return (
    <ChatSettingsSection
      id="connection"
      label={localizeUi("ui.chatSettings.connectionsection.connection")}
      icon={<Plug size="0.875rem" />}
      help={
        isGame
          ? localizeUi("ui.chatSettings.connectionsection.chooseTheModelUsedForGameGenerationInThis")
          : localizeUi("ui.chatSettings.connectionsection.whichAiProviderAndModelToUseForThis")
      }
    >
      {isGame ? (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[0.6875rem] font-medium text-foreground/50">
              {localizeUi("ui.game.gamesurfacecomponent.gmPartyModel")}
            </label>
            <select
              value={connectionId ?? ""}
              onChange={(e) => onConnectionChange(e.target.value || null)}
              className="w-full rounded-lg bg-foreground/5 px-3 py-2 text-xs outline-none ring-1 ring-foreground/10 transition-shadow focus:ring-foreground/20"
            >
              <option value="">{localizeUi("ui.game.gamesurfacecomponent.none")}</option>
              <option value="random">{localizeUi("ui.chatSettings.connectionsection.random")}</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name}
                  {connection.model
                    ? localizeUi("ui.chatSettings.connectionsection.value1", { value1: connection.model })
                    : ""}
                </option>
              ))}
            </select>
          </div>
          {contextBudget && <ContextBudgetIndicator budget={contextBudget} />}
        </div>
      ) : (
        <>
          <select
            value={connectionId ?? ""}
            onChange={(e) => onConnectionChange(e.target.value || null)}
            className="w-full rounded-lg bg-foreground/5 px-3 py-2 text-xs outline-none ring-1 ring-foreground/10 transition-shadow focus:ring-foreground/20"
          >
            <option value="">{localizeUi("ui.game.gamesurfacecomponent.none")}</option>
            <option value="random">{localizeUi("ui.chatSettings.connectionsection.random")}</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
          {connectionId === "random" && (
            <p className="mt-1.5 text-[0.625rem] text-foreground/50">
              {localizeUi("ui.chatSettings.connectionsection.eachGenerationWillRandomlyPickFromConnectionsMarkedFor")}
            </p>
          )}
          {selectedLocalSidecar && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
              <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0 text-[var(--warning)]" />
              <span>
                {localizeUi("ui.chatSettings.connectionsection.localModelIsTinyAndIntendedForTrackersHelpers")}
              </span>
            </div>
          )}
        </>
      )}
    </ChatSettingsSection>
  );
}
