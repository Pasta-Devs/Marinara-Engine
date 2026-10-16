import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Plug } from "lucide-react";
import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { ContextBudgetIndicator } from "../../../components/chat/ContextBudgetIndicator";
import { SubscriptionUsageWidget } from "../../../components/connections/SubscriptionUsageWidget";
import {
  ConnectionSwitcherBody,
  EffectiveModelIcon,
  useChatModelPick,
  useEffectiveChatModel,
} from "../../../components/connections/ConnectionSwitcherBody";
import { isConnectionFlagTrue, resolveUsageConnection } from "../../../lib/connection-filters";
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
  /** The Connection the Model belongs to; a starred catalog model is saved under it. */
  accountId?: string | null;
}

interface ConnectionSectionProps {
  chatId: string;
  connectionId: string | null;
  connections: ChatConnectionOption[];
  contextBudget?: ProfessorMariContextBudget | null;
  isGame: boolean;
  onConnectionChange: (connectionId: string | null) => void;
}

export function ConnectionSection({
  chatId,
  connectionId,
  connections,
  contextBudget,
  isGame,
  onConnectionChange,
}: ConnectionSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const chooserRef = useRef<HTMLDivElement>(null);
  const selectedLocalSidecar = connectionId === LOCAL_SIDECAR_CONNECTION_ID;
  const isRandom = connectionId === "random";
  // The usage meter follows the active connection: only a NanoGPT connection that
  // opted in from its editor shows it, and a random pick has no single quota.
  const usageConnection = resolveUsageConnection(connections, connectionId);
  // The same chooser and pick as the chat's composer chip (decisions 26/27), aimed at this chat.
  const chatPick = useChatModelPick(chatId);
  const effective = useEffectiveChatModel(chatId);
  const mainConnection = connections.find((connection) => isConnectionFlagTrue(connection.isDefault));
  // The game generates with remote models only, as in the composer.
  const offersLocalModel = !isGame && connections.some((connection) => connection.id === LOCAL_SIDECAR_CONNECTION_ID);
  // On a phone the field can sit near the bottom of the sheet; bring the opened chooser into view.
  useEffect(() => {
    if (open) chooserRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);
  const close = () => {
    setOpen(false);
    fieldRef.current?.focus();
  };
  const followMain = () =>
    void chatPick.useDefault().catch((error) =>
      toast.error(
        localizeUi("connections.switcher.pickFailed", {
          error: error instanceof Error ? error.message : String(error ?? ""),
        }),
      ),
    );

  const name =
    !effective || effective.kind === "none" ? localizeUi("chat.settings.connectionModel.none") : effective.title;
  const detail =
    effective?.kind === "model"
      ? localizeUi(
          effective.followsMain
            ? "chat.settings.connectionModel.followsMain"
            : "chat.settings.connectionModel.chosenForChat",
          { connection: effective.connectionName },
        )
      : effective?.kind === "local"
        ? localizeUi("connections.switcher.localModelHint")
        : effective?.kind === "random"
          ? localizeUi("chat.settings.connectionModel.shuffleDetail")
          : localizeUi("connections.switcher.noMain");
  const unavailable = effective?.unavailable ? localizeUi(`connections.accounts.state.${effective.unavailable}`) : null;

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
      <div className="space-y-2">
        <div
          data-chat-settings-model-field
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !open || event.nativeEvent.isComposing || event.keyCode === 229) return;
            event.stopPropagation();
            close();
          }}
        >
          <span className="mb-1 block text-[0.6875rem] font-medium text-foreground/50">
            {isGame
              ? localizeUi("ui.game.gamesurfacecomponent.gmPartyModel")
              : localizeUi("chat.settings.connectionModel.label")}
          </span>
          {/* One field for the effective model; it opens the chooser the chat's composer chip opens. */}
          <button
            ref={fieldRef}
            type="button"
            aria-expanded={open}
            aria-label={localizeUi("chat.settings.connectionModel.buttonLabel", { model: name })}
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg bg-foreground/5 px-2.5 py-2 text-left outline-none ring-1 ring-foreground/10 transition-shadow focus-visible:ring-foreground/25"
          >
            <EffectiveModelIcon effective={effective} size="md" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn("truncate text-xs font-semibold", effective?.kind === "none" && "text-foreground/45")}
              >
                {name}
              </span>
              <span className="truncate text-[0.625rem] text-foreground/50">{detail}</span>
            </span>
            {unavailable && (
              <span className="mari-chrome-muted-badge shrink-0 rounded px-1 py-px text-[0.5625rem] leading-4">
                {unavailable}
              </span>
            )}
            <ChevronDown size="0.875rem" className={cn("shrink-0 transition-transform", open && "rotate-180")} />
          </button>
          {effective?.kind === "model" && (
            <p className="mt-1 text-[0.625rem] leading-relaxed text-foreground/50">
              {effective.followsMain
                ? localizeUi("chat.settings.connectionModel.helpFollows")
                : localizeUi("chat.settings.connectionModel.helpChosen", {
                    model: mainConnection?.name || mainConnection?.model || localizeUi("connections.switcher.noMain"),
                  })}
              {!effective.followsMain && (
                <button
                  type="button"
                  onClick={followMain}
                  className="ml-1 inline-flex min-h-11 items-center font-medium text-foreground/75 underline-offset-2 hover:underline sm:min-h-0"
                >
                  {localizeUi("chat.settings.connectionModel.followAgain")}
                </button>
              )}
            </p>
          )}
          {open && (
            <div
              ref={chooserRef}
              className="mt-2 flex h-[min(28rem,65dvh)] flex-col overflow-hidden rounded-lg bg-[var(--card)] ring-1 ring-foreground/10 [--mari-chat-existing-bg:var(--card)]"
            >
              <ConnectionSwitcherBody
                layout="steps"
                current={chatPick.current}
                recent={chatPick.recent}
                onApply={chatPick.apply}
                onDone={close}
                autoFocusSearch
                showLocalModel={offersLocalModel}
                shuffle={{ active: isRandom, onToggle: () => onConnectionChange(isRandom ? null : "random") }}
                followDefault={{ active: chatPick.followsMain, onSelect: chatPick.useDefault }}
              />
            </div>
          )}
        </div>
        {isRandom && (
          <p className="text-[0.625rem] text-foreground/50">
            {localizeUi("ui.chatSettings.connectionsection.eachGenerationWillRandomlyPickFromConnectionsMarkedFor")}
          </p>
        )}
        {selectedLocalSidecar && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
            <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0 text-[var(--warning)]" />
            <span>{localizeUi("ui.chatSettings.connectionsection.localModelIsTinyAndIntendedForTrackersHelpers")}</span>
          </div>
        )}
        {contextBudget && <ContextBudgetIndicator budget={contextBudget} />}
        {usageConnection && <SubscriptionUsageWidget connectionId={usageConnection.id} variant="panel" />}
      </div>
    </ChatSettingsSection>
  );
}
