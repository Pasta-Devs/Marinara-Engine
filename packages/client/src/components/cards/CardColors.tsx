import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Loader2, Palette, User } from "lucide-react";
import { extractColorsFromImage } from "../../lib/avatar-color-extraction";
import { withCssPaintAlpha } from "../../lib/css-colors";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import { ColorPicker } from "../ui/ColorPicker";

export type CardColorKey = "nameColor" | "dialogueColor" | "boxColor";

export interface CardColorsProps {
  variant: "character" | "persona";
  header: ReactNode;
  aliases?: ReactNode;
  name: string;
  avatarUrl: string | null;
  avatarStyle?: CSSProperties;
  nameColor: string;
  dialogueColor: string;
  boxColor: string;
  onColorChange: (key: CardColorKey, value: string) => void;
}

const VARIANTS = {
  character: {
    nameFallback: "ui.characters.cardlibrarydetailcard.character",
    nameFallbackColor: "rgb(192, 132, 252)",
    boxFallback: "rgba(255,255,255,0.08)",
    layout: "flex gap-3",
    avatar:
      "mari-chrome-accent-tile mari-accent-animated relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-[var(--marinara-chat-chrome-button-border-active)]",
    details: "min-w-0 flex-1 space-y-1",
    box: "rounded-2xl rounded-tl-sm px-4 py-3 text-[0.8125rem] leading-[1.8] backdrop-blur-md ring-1 ring-white/8",
    body: "text-white/90",
    extracting: "ui.characters.colorstab.extracting",
    extract: "ui.characters.colorstab.extractColorsFromAvatar",
    upload: "ui.characters.colorstab.uploadAnAvatarFirst",
    avatarAlt: "ui.characters.colorstab.value1AvatarPreview",
    avatarFallback: "ui.characters.cardlibrarydetailcard.character",
    previewAction: "ui.characters.colorstab.theyJumpDownLandingBehindYouAndStraightenUp",
    previewDialogue: "ui.characters.colorstab.ldquoHelloThereRdquo",
    nameLabel: "ui.characters.colorstab.nameDisplayColor",
    nameHelp: "editor.colors.characterNameHelp",
    dialogueLabel: "ui.characters.colorstab.dialogueHighlightColor",
    dialogueHelp: "editor.colors.dialogueHelp",
    dialogueHelpSuffix: "ui.characters.colorstab.notUsedInConversation",
    boxLabel: "ui.characters.colorstab.messageBoxColor",
    boxHelp: "ui.colors.messageBoxHelp",
  },
  persona: {
    nameFallback: "editor.colors.you",
    nameFallbackColor: "rgb(212, 212, 212)",
    boxFallback: "rgba(255, 255, 255, 0.12)",
    layout: "flex gap-3 flex-row-reverse",
    avatar:
      "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-neutral-500 to-neutral-600 ring-2 ring-white/15",
    details: "flex min-w-0 flex-1 flex-col items-end space-y-1",
    box: "rounded-2xl rounded-tr-sm px-4 py-3 text-[0.8125rem] leading-[1.8] backdrop-blur-md ring-1 ring-white/10",
    body: "text-neutral-100",
    extracting: "ui.personas.personacolorstab.extracting",
    extract: "ui.personas.personacolorstab.extractColorsFromAvatar",
    upload: "ui.personas.personacolorstab.uploadAnAvatarFirst",
    avatarAlt: "ui.personas.personacolorstab.value1AvatarPreview",
    avatarFallback: "ui.characters.cardlibrarydetailcard.persona",
    previewAction: "ui.personas.personacolorstab.iTurnAroundAndRaiseMyHand",
    previewDialogue: "ui.personas.personacolorstab.ldquoGeneralKenobiRdquo",
    nameLabel: "ui.personas.personacolorstab.nameDisplayColor",
    nameHelp: "editor.colors.personaNameHelp",
    dialogueLabel: "ui.personas.personacolorstab.dialogueHighlightColor",
    dialogueHelp: "editor.colors.dialogueHelp",
    dialogueHelpSuffix: null,
    boxLabel: "ui.personas.personacolorstab.messageBoxColor",
    boxHelp: "ui.colors.messageBoxHelp",
  },
} as const;

function nameStyle(color: string, fallback: string): CSSProperties {
  if (!color) return { color: fallback };
  if (!color.includes("gradient(")) return { color };
  return {
    backgroundImage: color,
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    color: "transparent",
    display: "inline-block",
  };
}

export function CardColors({
  variant,
  header,
  aliases,
  name,
  avatarUrl,
  avatarStyle,
  nameColor,
  dialogueColor,
  boxColor,
  onColorChange,
}: CardColorsProps) {
  const { t: localizeUi } = useUiTranslation();
  const chatFontOpacity = useUIStore((state) => state.chatFontOpacity);
  const [extracting, setExtracting] = useState(false);
  const v = VARIANTS[variant];

  const handleExtract = async () => {
    if (!avatarUrl) return;
    setExtracting(true);
    try {
      const [nextName, nextDialogue, nextBox] = await extractColorsFromImage(avatarUrl);
      onColorChange("nameColor", nextName);
      onColorChange("dialogueColor", nextDialogue);
      onColorChange("boxColor", nextBox);
    } catch {
      // silently ignore — user can just pick colors manually
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      {header}

      <button
        type="button"
        disabled={!avatarUrl || extracting}
        onClick={handleExtract}
        className="mari-editor-action mari-editor-action--accent mari-editor-action--primary flex w-full rounded-xl px-4 py-2.5 text-xs"
      >
        {extracting ? <Loader2 size="0.875rem" className="animate-spin" /> : <Palette size="0.875rem" />}
        {extracting ? localizeUi(v.extracting) : avatarUrl ? localizeUi(v.extract) : localizeUi(v.upload)}
      </button>

      <div className="space-y-3 overflow-hidden rounded-xl border border-[var(--border)] bg-black/30 p-4">
        <p className="text-[0.625rem] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
          {localizeUi("settings.notifications.customSound.actions.preview")}
        </p>
        <div className={v.layout}>
          <div className={v.avatar}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={localizeUi(v.avatarAlt, {
                  value1: name || localizeUi(v.avatarFallback),
                })}
                className="h-full w-full object-cover"
                style={avatarStyle}
              />
            ) : (
              <User size="1rem" className="text-white" />
            )}
          </div>
          <div className={v.details}>
            <span className="text-[0.75rem] font-bold tracking-tight" style={nameStyle(nameColor, v.nameFallbackColor)}>
              {name || localizeUi(v.nameFallback)}
            </span>
            <div
              className={v.box}
              data-roleplay-color-preview
              style={
                boxColor
                  ? { backgroundColor: withCssPaintAlpha(boxColor, String(chatFontOpacity / 100)) }
                  : { backgroundColor: v.boxFallback }
              }
            >
              <span className={v.body}>{localizeUi(v.previewAction)} </span>
              <strong style={dialogueColor ? { color: dialogueColor } : { color: "rgb(255, 255, 255)" }}>
                {localizeUi(v.previewDialogue)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <ColorPicker
        value={nameColor}
        onChange={(value) => onColorChange("nameColor", value)}
        gradient
        label={localizeUi(v.nameLabel)}
        helpText={localizeUi(v.nameHelp)}
      />

      <ColorPicker
        value={dialogueColor}
        onChange={(value) => onColorChange("dialogueColor", value)}
        label={localizeUi(v.dialogueLabel)}
        helpText={
          v.dialogueHelpSuffix
            ? `${localizeUi(v.dialogueHelp)} ${localizeUi(v.dialogueHelpSuffix)}`
            : localizeUi(v.dialogueHelp)
        }
      />

      <ColorPicker
        value={boxColor}
        onChange={(value) => onColorChange("boxColor", value)}
        label={localizeUi(v.boxLabel)}
        helpText={localizeUi(v.boxHelp)}
      />

      {aliases}
    </div>
  );
}
