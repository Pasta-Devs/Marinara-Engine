import { useState } from "react";
import { Loader2, Palette, User } from "lucide-react";
import { toast } from "sonner";
import { extractColorsFromImage } from "../../../../../shared/lib/avatar-color-extraction";
import { ColorPicker } from "../../../../../shared/components/ui/ColorPicker";
import { cn } from "../../../../../shared/lib/utils";
import type { PersonaFormData } from "../../lib/persona-editor-model";
import { PersonaEditorSectionHeader } from "./PersonaEditorSectionHeader";

export function PersonaColorsTab({
  formData,
  updateField,
  avatarUrl,
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
  avatarUrl: string | null;
}) {
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!avatarUrl) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const [nameColor, dialogueColor, boxColor] = await extractColorsFromImage(avatarUrl);
      updateField("nameColor", nameColor);
      updateField("dialogueColor", dialogueColor);
      updateField("boxColor", boxColor);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Avatar color extraction failed.";
      setExtractError(message);
      toast.error(message);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PersonaEditorSectionHeader
        title="Persona Colors"
        subtitle="Customize how your persona appears in chats. Colors are applied to your name, dialogue, and message bubble."
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
      {extractError && (
        <p className="-mt-3 text-xs text-[var(--destructive)]" aria-live="polite">
          {extractError}
        </p>
      )}

      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-black/30 p-4">
        <p className="text-[0.625rem] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">Preview</p>
        <div className="flex flex-row-reverse gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-500 to-neutral-600 ring-2 ring-white/15">
            <User size="1rem" className="text-white" />
          </div>
          <div className="flex flex-1 flex-col items-end space-y-1">
            <span
              className="text-[0.75rem] font-bold tracking-tight"
              style={
                formData.nameColor
                  ? formData.nameColor.includes("gradient(")
                    ? {
                        backgroundImage: formData.nameColor,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "100% 100%",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        color: "transparent",
                        display: "inline-block",
                      }
                    : { color: formData.nameColor }
                  : { color: "rgb(212, 212, 212)" }
              }
            >
              {formData.name || "You"}
            </span>
            <div
              className="rounded-2xl rounded-tr-sm px-4 py-3 text-[0.8125rem] leading-[1.8] backdrop-blur-md ring-1 ring-white/10"
              style={
                formData.boxColor
                  ? { backgroundColor: formData.boxColor }
                  : { backgroundColor: "rgba(255, 255, 255, 0.12)" }
              }
            >
              <span className="text-neutral-100">*You step forward confidently.* </span>
              <strong
                style={formData.dialogueColor ? { color: formData.dialogueColor } : { color: "rgb(255, 255, 255)" }}
              >
                &ldquo;I&apos;m ready for this.&rdquo;
              </strong>
            </div>
          </div>
        </div>
      </div>

      <ColorPicker
        value={formData.nameColor}
        onChange={(value) => updateField("nameColor", value)}
        gradient
        label="Name Display Color"
        helpText="The color (or gradient) used for your persona's name in chat messages and persona selectors. Supports gradients!"
      />

      <ColorPicker
        value={formData.dialogueColor}
        onChange={(value) => updateField("dialogueColor", value)}
        label="Dialogue Highlight Color"
        helpText={
          'Text inside dialogue quotation marks ("", “”, «», 「」, 『』) will be automatically colored with this, and can also be bolded from Settings.'
        }
      />

      <ColorPicker
        value={formData.boxColor}
        onChange={(value) => updateField("boxColor", value)}
        label="Message Box Color"
        helpText="Background color for your persona's chat message bubbles. Use a semi-transparent color for best results (e.g. rgba)."
      />

      <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
        <h4 className="mb-1.5 text-xs font-semibold">How colors work</h4>
        <ul className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          <li>
            &bull; <strong className="text-[var(--foreground)]">Name color</strong> — Applied to your persona&apos;s
            display name in chat. Gradients use CSS linear-gradient.
          </li>
          <li>
            &bull; <strong className="text-[var(--foreground)]">Dialogue color</strong> — All text inside dialogue
            quotation marks is automatically colored with this value, and can optionally be bolded from Settings.
          </li>
          <li>
            &bull; <strong className="text-[var(--foreground)]">Box color</strong> — Sets the background color of your
            persona&apos;s message bubble.
          </li>
          <li>&bull; Leave any field empty to use the default theme colors.</li>
        </ul>
      </div>
    </div>
  );
}
