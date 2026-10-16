export const COMFYUI_MAX_REFERENCE_IMAGES = 4;

export type ComfyReferencePlaceholderBase = "reference_image" | "reference_image_name";

export function numberedComfyReferencePlaceholder(baseName: ComfyReferencePlaceholderBase, index: number): string {
  return `%${baseName}_${String(index + 1).padStart(2, "0")}%`;
}

/**
 * Whether a workflow has a slot for the one picture an edit sends; one without draws from the prompt alone.
 * That picture fills only the first slot, so a workflow with only a later numbered slot never gets it.
 */
export function comfyWorkflowTakesReference(
  workflowText: string,
  baseNames: readonly ComfyReferencePlaceholderBase[] = ["reference_image", "reference_image_name"],
): boolean {
  return baseNames.some(
    (baseName) =>
      workflowText.includes(`%${baseName}%`) || workflowText.includes(numberedComfyReferencePlaceholder(baseName, 0)),
  );
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
