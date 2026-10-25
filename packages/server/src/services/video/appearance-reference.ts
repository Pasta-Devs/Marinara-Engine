/**
 * Whether the video connection's Video Prompting Instructions say anything about appearance. Only then do they own
 * how people are described: the writer builds the appearance details in. Otherwise the details are pasted after the
 * finished prompt, as before.
 */
export function videoInstructionsUseAppearance(instructions: unknown): boolean {
  return typeof instructions === "string" && /appearance/iu.test(instructions);
}

/**
 * "Attach Card Appearance" for videos, when the instructions use appearance: the people's appearance details go to the model that writes the video prompt,
 * which builds them into the prompt in the format the Video Prompting Instructions ask for, instead of the details
 * being pasted after the finished prompt.
 */
export function formatVideoAppearanceDetails(appearanceLines: string | null | undefined): string {
  const lines = appearanceLines?.trim();
  if (!lines) return "";
  return [
    "<character_appearance>",
    lines,
    "</character_appearance>",
    "Build each person who appears in the clip from their appearance details above (face, hair, build, clothing and other defining features), written into the prompt in its own format. Do not paste them as a separate block, and do not invent features they don't have.",
  ].join("\n");
}
