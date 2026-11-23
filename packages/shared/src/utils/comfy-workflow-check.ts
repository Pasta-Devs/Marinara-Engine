/**
 * Reads a pasted ComfyUI workflow without running it: which Marinara placeholders it has, which numbered
 * reference slots it declares, and which picture loaders still name a saved file instead of a placeholder.
 * The ComfyUI model editor shows this as the Workflow check, and the image prompt review uses the same
 * reading to say where each reference picture goes.
 */

/** ComfyUI takes at most this many reference pictures (`%reference_image_01%` to `_04%`). */
export const COMFY_WORKFLOW_REFERENCE_SLOTS = 4;

export type ComfyWorkflowLiteralLoader = {
  /** The node id in an API-format save, or the node's number in a UI save. */
  nodeId: string;
  /** The node's title when the save has one. */
  title: string | null;
  /** The saved filename the loader opens every time. */
  file: string;
};

export type ComfyWorkflowCheck = {
  /** False when the text is not JSON; `error` then says why. */
  parsed: boolean;
  error: string | null;
  /** A save from the ComfyUI editor ("nodes" array) instead of Save (API format); /prompt cannot run it. */
  uiFormat: boolean;
  hasPrompt: boolean;
  hasNegativePrompt: boolean;
  hasSize: boolean;
  hasSeed: boolean;
  /** Reference slots (1 to 4) the workflow declares, as a picture or as an uploaded filename. */
  referenceSlots: number[];
  /** Picture loaders that open a saved file instead of a placeholder. */
  literalLoaders: ComfyWorkflowLiteralLoader[];
};

const PLACEHOLDER = /%[a-z0-9_]+%/i;

function pad(slot: number): string {
  return String(slot).padStart(2, "0");
}

/** The placeholder a reference slot (1-based) is filled through, as a picture and as an uploaded filename. */
export function comfyReferenceSlotPlaceholders(slot: number): { image: string; name: string } {
  return { image: `%reference_image_${pad(slot)}%`, name: `%reference_image_name_${pad(slot)}%` };
}

/** Which slots (1-based) a workflow declares; the bare `%reference_image%` and `%reference_image_name%` are slot 1. */
export function findComfyReferenceSlots(workflowText: string): number[] {
  const slots: number[] = [];
  for (let slot = 1; slot <= COMFY_WORKFLOW_REFERENCE_SLOTS; slot++) {
    const { image, name } = comfyReferenceSlotPlaceholders(slot);
    const bare =
      slot === 1 && (workflowText.includes("%reference_image%") || workflowText.includes("%reference_image_name%"));
    if (bare || workflowText.includes(image) || workflowText.includes(name)) slots.push(slot);
  }
  return slots;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFileLoader(classType: unknown): boolean {
  // LoadImage, LoadImageMask and similar file pickers; base64 loaders carry the picture itself.
  return typeof classType === "string" && /^LoadImage(Mask)?$/i.test(classType.trim());
}

function literalFile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const file = value.trim();
  if (!file || PLACEHOLDER.test(file)) return null;
  return file;
}

function titleOf(node: Record<string, unknown>): string | null {
  const meta = isRecord(node._meta) ? node._meta : null;
  const title =
    (meta && typeof meta.title === "string" ? meta.title : null) ??
    (typeof node.title === "string" ? node.title : null);
  return title?.trim() || null;
}

export function checkComfyWorkflow(workflowText: string | null | undefined): ComfyWorkflowCheck {
  const text = (workflowText ?? "").trim();
  const result: ComfyWorkflowCheck = {
    parsed: false,
    error: null,
    uiFormat: false,
    hasPrompt: text.includes("%prompt%"),
    hasNegativePrompt: text.includes("%negative_prompt%"),
    hasSize: text.includes("%width%") && text.includes("%height%"),
    hasSeed: text.includes("%seed%"),
    referenceSlots: findComfyReferenceSlots(text),
    literalLoaders: [],
  };
  if (!text) return result;
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Not valid JSON";
    return result;
  }
  result.parsed = true;
  if (!isRecord(root)) return result;

  if (Array.isArray(root.nodes)) {
    result.uiFormat = true;
    for (const node of root.nodes) {
      if (!isRecord(node) || !isFileLoader(node.type)) continue;
      const file = Array.isArray(node.widgets_values) ? literalFile(node.widgets_values[0]) : null;
      if (file) result.literalLoaders.push({ nodeId: String(node.id ?? "?"), title: titleOf(node), file });
    }
    return result;
  }

  for (const [nodeId, node] of Object.entries(root)) {
    if (!isRecord(node) || !isFileLoader(node.class_type)) continue;
    const inputs = isRecord(node.inputs) ? node.inputs : null;
    const file = literalFile(inputs?.image);
    if (file) result.literalLoaders.push({ nodeId, title: titleOf(node), file });
  }
  return result;
}
