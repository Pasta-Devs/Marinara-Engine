export const COMFYUI_MAX_REFERENCE_IMAGES = 4;

export type ComfyReferencePlaceholderBase = "reference_image" | "reference_image_name";

export function numberedComfyReferencePlaceholder(baseName: ComfyReferencePlaceholderBase, index: number): string {
  return `%${baseName}_${String(index + 1).padStart(2, "0")}%`;
}

/** Return only missing reference slots that the workflow actually declares. */
export function findMissingComfyReferenceSlots(
  workflowText: string,
  baseName: ComfyReferencePlaceholderBase,
  referenceCount: number,
): number[] {
  const slots: number[] = [];
  for (let index = Math.max(0, referenceCount); index < COMFYUI_MAX_REFERENCE_IMAGES; index++) {
    if (workflowText.includes(numberedComfyReferencePlaceholder(baseName, index))) slots.push(index);
  }
  return slots;
}
