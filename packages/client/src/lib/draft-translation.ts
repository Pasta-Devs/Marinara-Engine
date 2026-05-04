import { toast } from "sonner";

export async function translateDraftText(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const { translateText } = await import("./translate-text");
    const translated = await translateText(trimmed);
    const next = translated.trim();
    if (!next) {
      toast.error("Translation returned an empty message.");
      return null;
    }
    return next;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to translate draft");
    return null;
  }
}
