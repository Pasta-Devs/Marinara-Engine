/**
 * What the image prompt review shows beside the prompt: which model draws (and its fallback and style), and where
 * each reference picture goes. For ComfyUI-style workflows that means which numbered placeholder each picture fills,
 * which declared slots get the blank placeholder or stay empty, which pictures do not fit, and which picture loaders
 * still open a saved file. The slot rules follow generateComfyUI: pictures fill slots 1 to 4 in order, duplicates
 * dropped; a declared slot past the last picture gets the blank only when "Upload placeholder" is on.
 */
import {
  checkComfyWorkflow,
  comfyReferenceSlotPlaceholders,
  COMFY_WORKFLOW_REFERENCE_SLOTS,
  type ComfyWorkflowLiteralLoader,
} from "@marinara-engine/shared";
import { getSharp } from "../../utils/sharp.js";
import { resolveImageGenerationService } from "./image-generation-defaults.js";

export type ReviewReferenceFrom = "character-sheet" | "avatar" | "sprite" | "location";

export type ReviewReferencePicture = {
  name: string;
  from: ReviewReferenceFrom;
  /** A small preview (data URL), or null when it could not be made. */
  thumbnail: string | null;
};

export type ReviewReferenceSlot = {
  slot: number;
  placeholder: string;
  /** "picture": a reference fills it; "blank": the 1x1 placeholder; "empty": nothing is put in. */
  fill: "picture" | "blank" | "empty";
  picture: ReviewReferencePicture | null;
};

export type ImagePromptReviewReferences = {
  /** True for ComfyUI, RunPod ComfyUI and SwarmUI workflows, where pictures go through placeholders. */
  workflow: boolean;
  /** Pictures in the order they are sent. */
  pictures: ReviewReferencePicture[];
  /** Workflow only: the declared slots and what fills each. */
  slots: ReviewReferenceSlot[];
  /** Workflow only: pictures that reach no declared slot (past the fourth, or a slot the workflow lacks). */
  unused: ReviewReferencePicture[];
  literalLoaders: ComfyWorkflowLiteralLoader[];
};

export type ImagePromptReviewDrawnBy = {
  model: string;
  fallback: string | null;
  style: string | null;
};

type ReviewConnection = {
  name?: string | null;
  model?: string | null;
  baseUrl?: string | null;
  imageService?: string | null;
  imageGenerationSource?: string | null;
  comfyuiWorkflow?: string | null;
};

function modelName(connection: { name?: unknown; model?: unknown } | null | undefined): string | null {
  if (!connection) return null;
  const name = typeof connection.name === "string" ? connection.name.trim() : "";
  const model = typeof connection.model === "string" ? connection.model.trim() : "";
  return name || model || null;
}

export function describeDrawnBy(args: {
  connection: ReviewConnection;
  fallback?: { connectionName?: string | null; model?: string | null } | null;
  styleName?: string | null;
}): ImagePromptReviewDrawnBy {
  return {
    model: modelName(args.connection) ?? "",
    fallback: args.fallback ? args.fallback.connectionName?.trim() || args.fallback.model?.trim() || null : null,
    style: args.styleName?.trim() || null,
  };
}

async function thumbnailOf(reference: string): Promise<string | null> {
  try {
    const base64 = reference.includes(",") && reference.startsWith("data:") ? reference.split(",", 2)[1]! : reference;
    const sharp = await getSharp();
    if (!sharp) return null;
    const out = await sharp(Buffer.from(base64, "base64"))
      .rotate()
      .resize({ width: 96, height: 96, fit: "cover" })
      .webp({ quality: 70 })
      .toBuffer();
    return `data:image/webp;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function describeReviewReferences(args: {
  connection: ReviewConnection;
  /** The pictures in the order the request sends them. */
  images: string[];
  /** Who or what each picture shows, in the same order. */
  labels: Array<{ name: string; from: ReviewReferenceFrom }>;
  blanksFilled: boolean;
}): Promise<ImagePromptReviewReferences | null> {
  const service = resolveImageGenerationService(args.connection as Parameters<typeof resolveImageGenerationService>[0]);
  const workflowText = args.connection.comfyuiWorkflow?.trim() ?? "";
  const workflow = (service === "comfyui" || service === "runpod_comfyui" || service === "swarmui") && !!workflowText;
  if (args.images.length === 0 && !workflow) return null;

  // The generator drops repeated pictures before filling slots.
  const pictures: ReviewReferencePicture[] = [];
  const seen = new Set<string>();
  for (const [index, image] of args.images.entries()) {
    if (!image || seen.has(image)) continue;
    seen.add(image);
    const label = args.labels[index] ?? { name: "", from: "avatar" as const };
    pictures.push({ name: label.name, from: label.from, thumbnail: await thumbnailOf(image) });
  }
  if (!workflow) return { workflow: false, pictures, slots: [], unused: [], literalLoaders: [] };

  const check = checkComfyWorkflow(workflowText);
  const sent = pictures.slice(0, COMFY_WORKFLOW_REFERENCE_SLOTS);
  const slots: ReviewReferenceSlot[] = check.referenceSlots.map((slot) => {
    const picture = sent[slot - 1] ?? null;
    const { image, name } = comfyReferenceSlotPlaceholders(slot);
    const placeholder = workflowText.includes(name) ? name : image;
    return {
      slot,
      placeholder:
        slot === 1 && !workflowText.includes(image) && !workflowText.includes(name) ? "%reference_image%" : placeholder,
      fill: picture ? "picture" : args.blanksFilled ? "blank" : "empty",
      picture,
    };
  });
  const unused = pictures.filter(
    (_, index) => index >= COMFY_WORKFLOW_REFERENCE_SLOTS || !check.referenceSlots.includes(index + 1),
  );
  return { workflow: true, pictures, slots, unused, literalLoaders: check.literalLoaders };
}
