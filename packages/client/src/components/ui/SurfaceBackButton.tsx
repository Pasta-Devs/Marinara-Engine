// ──────────────────────────────────────────────
// Back button for full-page surfaces: pops the surface history stack and names where it lands.
// ──────────────────────────────────────────────
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "../../stores/chat.store";
import { selectBackDestination, useUIStore, type BackDestination } from "../../stores/ui.store";

function backLabelKey(destination: BackDestination, hasActiveChat: boolean): string {
  if (!destination) return hasActiveChat ? "navigation.back.toChat" : "navigation.back.toHome";
  if ("home" in destination) return "navigation.back.toHome";
  if ("panel" in destination) {
    switch (destination.panel) {
      case "characters":
        return "navigation.back.toCharactersPanel";
      case "lorebooks":
        return "navigation.back.toLorebooksPanel";
      case "presets":
        return "navigation.back.toPresetsPanel";
      case "connections":
        return "navigation.back.toConnectionsPanel";
      case "agents":
        return "navigation.back.toAgentsPanel";
      case "personas":
        return "navigation.back.toPersonasPanel";
      case "settings":
        return "navigation.back.toSettingsPanel";
      case "bot-browser":
        return "navigation.back.toCardBrowserPanel";
      case "extensions":
        return "navigation.back.toExtensionsPanel";
      case "chat":
        return "navigation.back.toChatPanel";
    }
  }
  switch (destination.surface) {
    case "regexDetailId":
      return "navigation.back.toRegexScript";
    case "personaDetailId":
      return "navigation.back.toPersona";
    case "toolDetailId":
      return "navigation.back.toTool";
    case "agentDetailId":
      return "navigation.back.toAgent";
    case "connectionDetailId":
      return "navigation.back.toConnection";
    case "presetDetailId":
      return "navigation.back.toPreset";
    case "characterDetailId":
      return "navigation.back.toCharacter";
    case "characterLibraryOpen":
      return destination.cardLibraryKind === "personas"
        ? "navigation.back.toPersonaLibrary"
        : "navigation.back.toCharacterLibrary";
    case "agentCatalogOpen":
      return "navigation.back.toAgentCatalog";
    case "lorebookDetailId":
      return "navigation.back.toLorebook";
    case "spatialMapDetailChatId":
      return "navigation.back.toMap";
    case "botBrowserOpen":
      return "navigation.back.toCardBrowser";
    case "gameAssetsBrowserOpen":
      return "navigation.back.toGameAssets";
    case "noodleOpen":
      return "navigation.back.toNoodle";
  }
}

interface Props {
  /** Defaults to closing the top surface; editors pass their save-and-leave handler. */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  iconSize?: string;
  /** Overrides the destination label for a back that stays inside the surface. */
  label?: string;
}

export function SurfaceBackButton({
  onClick,
  disabled,
  className = "mari-editor-action inline-flex",
  iconSize = "1.125rem",
  label,
}: Props) {
  const { t } = useTranslation();
  const destination = useUIStore(useShallow(selectBackDestination));
  const hasActiveChat = useChatStore((s) => !!s.activeChatId);
  const text = label ?? t(backLabelKey(destination, hasActiveChat));
  return (
    <button
      type="button"
      onClick={onClick ?? (() => useUIStore.getState().closeTopMainSurface())}
      disabled={disabled}
      className={className}
      title={text}
      aria-label={text}
    >
      <ArrowLeft size={iconSize} />
    </button>
  );
}
