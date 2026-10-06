import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Plug } from "lucide-react";
import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ContextBudgetIndicator } from "../../../components/chat/ContextBudgetIndicator";
import { NanoGptUsageWidget } from "../../../components/connections/NanoGptUsageWidget";
import { ConnectionModelPicker } from "../../../components/connections/ConnectionModelPicker";
import { resolveNanoGptUsageConnection } from "../../../lib/connection-filters";
import { cn } from "../../../lib/utils";
import type { ProfessorMariContextBudget } from "../../../lib/professor-mari-context-budget";

/**
 * A connection row as the chat settings surfaces receive it. Extends the loose
 * record shape other sections require, while naming the fields this section
 * reads so the NanoGPT usage meter cannot silently lose them to a cast.
 */
export interface ChatConnectionOption extends Record<string, unknown> {
  id: string;
  name: string;
  model?: string;
  /** Used to decide whether a NanoGPT usage meter applies to this connection. */
  provider?: string;
  /** NanoGPT: whether the connection opted in to the subscription usage display. */
  showUsageWidget?: boolean | string;
  /** Model IDs pinned in the model picker (JSON array). */
  pinnedModels?: unknown;
}

/** The chat connection's model, changed with the same picker as the input-box Connections menu. */
function ConnectionModelField({ connection }: { connection: ChatConnectionOption }) {
  const { t } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // On a phone the field can sit near the bottom of the sheet; bring the opened list into view.
  useEffect(() => {
    if (open) pickerRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);
  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };
  return (
    <div
      data-chat-settings-model-field
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open || event.nativeEvent.isComposing || event.keyCode === 229) return;
        event.stopPropagation();
        close();
      }}
    >
      <span className="mb-1 block text-[0.6875rem] font-medium text-foreground/50">
        {t("chat.settings.connectionModel.label")}
      </span>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-label={t("chat.settings.connectionModel.buttonLabel", {
          model: connection.model || t("chat.settings.connectionModel.none"),
        })}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg sm:min-h-9 bg-foreground/5 px-3 py-2 text-left text-xs outline-none ring-1 ring-foreground/10 transition-shadow focus-visible:ring-foreground/25"
      >
        <span className={cn("min-w-0 flex-1 truncate", !connection.model && "text-foreground/45")}>
          {connection.model || t("chat.settings.connectionModel.none")}
        </span>
        <ChevronDown size="0.875rem" className={cn("shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          ref={pickerRef}
          className="mt-2 flex h-[min(24rem,60dvh)] flex-col overflow-hidden rounded-lg ring-1 ring-foreground/10"
        >
          <ConnectionModelPicker connection={connection} autoFocusSearch onPicked={close} />
        </div>
      )}
    </div>
  );
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
  // The usage meter follows the active connection: only a NanoGPT connection that
  // opted in from its editor shows it, and a random pick has no single quota.
  const usageConnection = resolveNanoGptUsageConnection(connections, connectionId);
  // Random has no single connection and the Local Model has no model list, so neither gets a model field.
  const modelConnection =
    connectionId && connectionId !== "random" && !selectedLocalSidecar
      ? connections.find((connection) => connection.id === connectionId)
      : undefined;

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
          {modelConnection && <ConnectionModelField key={modelConnection.id} connection={modelConnection} />}
          {contextBudget && <ContextBudgetIndicator budget={contextBudget} />}
          {usageConnection && <NanoGptUsageWidget connectionId={usageConnection.id} variant="panel" />}
        </div>
      ) : (
        // space-y-2 matches the game branch above and the other settings
        // sections; a bare fragment leaves the meter flush against the select.
        <div className="space-y-2">
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
          {modelConnection && <ConnectionModelField key={modelConnection.id} connection={modelConnection} />}
          {connectionId === "random" && (
            <p className="text-[0.625rem] text-foreground/50">
              {localizeUi("ui.chatSettings.connectionsection.eachGenerationWillRandomlyPickFromConnectionsMarkedFor")}
            </p>
          )}
          {selectedLocalSidecar && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
              <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0 text-[var(--warning)]" />
              <span>
                {localizeUi("ui.chatSettings.connectionsection.localModelIsTinyAndIntendedForTrackersHelpers")}
              </span>
            </div>
          )}
          {usageConnection && <NanoGptUsageWidget connectionId={usageConnection.id} variant="panel" />}
        </div>
      )}
    </ChatSettingsSection>
  );
}
