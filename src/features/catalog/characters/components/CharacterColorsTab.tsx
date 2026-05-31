import { useState } from "react";
import { Loader2, Palette, User } from "lucide-react";
import type { CharacterData } from "../../../../engine/contracts/types/character";
import { ColorPicker } from "../../../../shared/components/ui/ColorPicker";
import { TrackerCardColorControls } from "../../../../shared/components/ui/TrackerCardColorControls";
import { extractColorsFromImage } from "../../../../shared/lib/avatar-color-extraction";
import { parseTrackerCardColorConfig } from "../../../../shared/lib/tracker-card-colors";
import { cn } from "../../../../shared/lib/utils";
import { CharacterEditorSectionHeader } from "./CharacterEditorSectionHeader";

export function CharacterColorsTab({
  formData,
  updateExtension,
  avatarUrl,
}: {
  formData: CharacterData;
  updateExtension: (key: string, value: unknown) => void;
  avatarUrl: string | null;
}) {
  const nameColor = (formData.extensions.nameColor as string) ?? "";
  const dialogueColor = (formData.extensions.dialogueColor as string) ?? "";
  const boxColor = (formData.extensions.boxColor as string) ?? "";
  const trackerCardColors = parseTrackerCardColorConfig(formData.extensions.trackerCardColors);
  const [extracting, setExtracting] = useState(false);

  const handleExtract = async () => {
    if (!avatarUrl) return;
    setExtracting(true);
    try {
      const [nc, dc, bc] = await extractColorsFromImage(avatarUrl);
      updateExtension("nameColor", nc);
      updateExtension("dialogueColor", dc);
      updateExtension("boxColor", bc);
    } catch {
      // User can still pick colors manually if extraction fails.
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      <CharacterEditorSectionHeader
        title="Character Colors"
        subtitle="Customize how this character appears in chats. Colors are applied to the name, dialogue, and message bubble."
      />

      <button
        type="button"
        disabled={!avatarUrl || extracting}
        onClick={handleExtract}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all",
          avatarUrl
            ? "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 active:scale-[0.98]"
            : "cursor-not-allowed bg-white/5 text-[var(--muted-foreground)]/50",
        )}
      >
        {extracting ? <Loader2 size="0.875rem" className="animate-spin" /> : <Palette size="0.875rem" />}
        {extracting ? "Extracting..." : avatarUrl ? "Extract Colors from Avatar" : "Upload an avatar first"}
      </button>

      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-black/30 p-4">
        <p className="text-[0.625rem] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">Preview</p>
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-600 ring-2 ring-purple-400/20">
            <User size="1rem" className="text-white" />
          </div>
          <div className="flex-1 space-y-1">
            <span
              className="text-[0.75rem] font-bold tracking-tight"
              style={
                nameColor
                  ? nameColor.includes("gradient(")
                    ? {
                        backgroundImage: nameColor,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "100% 100%",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        color: "transparent",
                        display: "inline-block",
                      }
                    : { color: nameColor }
                  : { color: "rgb(192, 132, 252)" }
              }
            >
              {formData.name || "Character"}
            </span>
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 text-[0.8125rem] leading-[1.8] backdrop-blur-md ring-1 ring-white/8"
              style={boxColor ? { backgroundColor: boxColor } : { backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <span className="text-white/90">*She looks at you with a warm smile.* </span>
              <strong style={dialogueColor ? { color: dialogueColor } : { color: "rgb(255, 255, 255)" }}>
                &ldquo;Hello there! How are you?&rdquo;
              </strong>
            </div>
          </div>
        </div>
      </div>

      <ColorPicker
        value={nameColor}
        onChange={(value) => updateExtension("nameColor", value)}
        gradient
        label="Name Display Color"
        helpText="The color (or gradient) used for the character's name in chat messages and sidebar tabs. Supports gradients!"
      />

      <ColorPicker
        value={dialogueColor}
        onChange={(value) => updateExtension("dialogueColor", value)}
        label="Dialogue Highlight Color"
        helpText={
          'Text inside dialogue quotation marks ("", “”, «», 「」, 『』) will be automatically colored with this, and can also be bolded from Settings.'
        }
      />

      <ColorPicker
        value={boxColor}
        onChange={(value) => updateExtension("boxColor", value)}
        label="Message Box Color"
        helpText="Background color for this character's chat message bubbles. Use a semi-transparent color for best results (e.g. rgba)."
      />

      <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
        <h4 className="mb-1.5 text-xs font-semibold">How colors work</h4>
        <ul className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          <li>
            &bull; <strong className="text-[var(--foreground)]">Name color</strong> — Applied to the character&apos;s
            display name in chat. Gradients use CSS linear-gradient.
          </li>
          <li>
            &bull; <strong className="text-[var(--foreground)]">Dialogue color</strong> — All text inside dialogue
            quotation marks is automatically colored with this value, and can optionally be bolded from Settings.
          </li>
          <li>
            &bull; <strong className="text-[var(--foreground)]">Box color</strong> — Sets the background color of the
            character&apos;s message bubble in roleplay mode.
          </li>
          <li>&bull; Leave any field empty to use the default theme colors.</li>
        </ul>
      </div>

      <TrackerCardColorControls
        value={trackerCardColors}
        onChange={(value) => updateExtension("trackerCardColors", value)}
        chatColors={{ nameColor, dialogueColor, boxColor }}
        entityLabel="Character"
      />
    </div>
  );
}
