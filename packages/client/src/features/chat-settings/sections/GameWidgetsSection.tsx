import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { LayoutDashboard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Chat, HudWidget } from "@marinara-engine/shared";
import { useUpdateGameWidgets } from "../../../hooks/use-game";
import {
  GameWidgetFileControls,
  GameWidgetSetupEditor,
  normalizeGameHudWidgets,
} from "../../../components/game/GameWidgetSetupEditor";
import { AgentSettingsActionButton } from "../../../components/chat/AgentSettingsControls";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface GameWidgetsSectionProps {
  order: number;
  chat: Chat;
  metadata: Record<string, unknown>;
}

export function GameWidgetsSection({ order, chat, metadata }: GameWidgetsSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateGameWidgets = useUpdateGameWidgets();
  const gameWidgetSource = useMemo<HudWidget[]>(() => {
    const persistedWidgets = normalizeGameHudWidgets(metadata.gameWidgetState);
    if (persistedWidgets.length > 0 || Array.isArray(metadata.gameWidgetState)) return persistedWidgets;

    const blueprint =
      metadata.gameBlueprint && typeof metadata.gameBlueprint === "object" && !Array.isArray(metadata.gameBlueprint)
        ? (metadata.gameBlueprint as { hudWidgets?: unknown })
        : null;
    return normalizeGameHudWidgets(blueprint?.hudWidgets);
  }, [metadata.gameBlueprint, metadata.gameWidgetState]);
  const gameWidgetSourceSignature = useMemo(() => JSON.stringify(gameWidgetSource), [gameWidgetSource]);
  const [gameWidgetDrafts, setGameWidgetDrafts] = useState<HudWidget[]>(() => gameWidgetSource);
  const gameWidgetDraftSignature = useMemo(() => JSON.stringify(gameWidgetDrafts), [gameWidgetDrafts]);
  const gameWidgetsChanged = gameWidgetDraftSignature !== gameWidgetSourceSignature;

  useEffect(() => {
    setGameWidgetDrafts(gameWidgetSource);
  }, [chat.id, gameWidgetSource]);

  const saveGameWidgets = useCallback(async () => {
    const widgets = normalizeGameHudWidgets(gameWidgetDrafts);
    try {
      await updateGameWidgets.mutateAsync({ chatId: chat.id, widgets });
      toast.success(localizeUi("ui.chat.chatsettingsdrawer.gameWidgetsUpdated"));
    } catch {
      toast.error(localizeUi("ui.chat.chatsettingsdrawer.failedToUpdateGameWidgets"));
    }
  }, [chat.id, gameWidgetDrafts, updateGameWidgets, localizeUi]);

  return (
    <ChatSettingsSection
      id="game-widgets"
      style={{ order }}
      label={localizeUi("ui.chat.chatsettingsdrawer.widgets")}
      icon={<LayoutDashboard size="0.875rem" />}
      count={gameWidgetDrafts.length}
      help={localizeUi("ui.chat.chatsettingsdrawer.configureTheVisibleGameModeHudWidgetsTheGm")}
    >
      <div className="space-y-3">
        <GameWidgetSetupEditor
          widgets={gameWidgetDrafts}
          onChange={(widgets) => setGameWidgetDrafts(normalizeGameHudWidgets(widgets, { mode: "draft" }))}
          disabled={updateGameWidgets.isPending}
          containerQueries
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AgentSettingsActionButton
            type="button"
            onClick={() => setGameWidgetDrafts(gameWidgetSource)}
            disabled={!gameWidgetsChanged || updateGameWidgets.isPending}
          >
            {localizeUi("ui.characters.charactercliptrimmodal.reset")}
          </AgentSettingsActionButton>
          <AgentSettingsActionButton
            type="button"
            variant="primary"
            onClick={() => void saveGameWidgets()}
            disabled={!gameWidgetsChanged || updateGameWidgets.isPending}
          >
            {updateGameWidgets.isPending && <Loader2 size="0.75rem" className="animate-spin" />}
            <span>
              {updateGameWidgets.isPending
                ? localizeUi("ui.noodle.stageprofileform.saving")
                : localizeUi("ui.chat.chatsettingsdrawer.saveWidgets")}
            </span>
          </AgentSettingsActionButton>
        </div>
        <GameWidgetFileControls
          widgets={gameWidgetDrafts}
          onImport={(widgets) => setGameWidgetDrafts(normalizeGameHudWidgets(widgets))}
          disabled={updateGameWidgets.isPending}
          exportFilename={`${chat.name || "game"}-widgets`}
          importSuccessMessage={(count) =>
            `Imported ${count === 1 ? "1 widget" : `${count} widgets`}. Save Widgets to apply them.`
          }
        />
      </div>
    </ChatSettingsSection>
  );
}
