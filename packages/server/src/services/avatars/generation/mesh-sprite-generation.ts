// Drawn mesh faces use the same image edits, alignment and region-only composite as PNGTuber pictures.
// All pictures stay in memory until the user keeps the finished mesh. A sheet-only provider draws a new
// matched base as well, since pictures made without seeing this sprite cannot safely be mixed with it.
import { normalizeSpriteExpressionKey, type AvatarImageRef, type AvatarMeshRigRequest } from "@marinara-engine/shared";
import type { DB } from "../../../db/connection.js";
import { drawTalkingHeadSet, talkingHeadSetPrompt } from "../../../routes/sprites.routes.js";
import { resolveReviewedImagePromptSubmission } from "../../image/image-prompt-review.js";
import { getSharp } from "../../image/sharp-runtime.js";
import { readAvatarConfig, readAvatarFile } from "../storage.js";
import {
  AvatarGenerationError,
  alignAvatarPicturePng,
  avatarImageRequestSize,
  avatarVariantPicture,
  drawAvatarImageEdit,
  readAvatarAgentSettings,
  readAvatarOwnerInfo,
  readAvatarSourceSprite,
  resolveAvatarImageConnection,
  type AvatarSourceSprite,
} from "./generation-context.js";
import { MESH_SOURCE_MAX_SIDE, type MeshDrawnPictureKey } from "./mesh-layer-builder.js";
import { avatarVariantPrompt, type AvatarPromptOverride, type AvatarPromptReviewItem } from "./pngtuber-variants.js";

export interface MeshRigGenerateRequest extends AvatarMeshRigRequest {
  promptOverrides?: AvatarPromptOverride[];
}

const PICTURES = [
  { key: "mouth_a", description: 'both eyes unchanged, mouth open wide saying "ah"' },
  { key: "mouth_i", description: 'both eyes unchanged, mouth spread horizontally saying "ee", teeth slightly apart' },
  { key: "mouth_o", description: 'both eyes unchanged, lips rounded into a small open "oh"' },
  { key: "mouth_a_half", description: 'both eyes unchanged, mouth half open saying a gentle "ah"' },
  { key: "eyes_closed", description: "both eyes fully closed with relaxed eyelids, mouth unchanged" },
  { key: "eyes_half", description: "both eyes half closed, pupils partly visible, mouth unchanged" },
  { key: "eyes_smile", description: "both eyes closed in upward smiling arcs, mouth unchanged" },
] as const satisfies readonly { key: MeshDrawnPictureKey; description: string }[];
const SHEET_PICTURES = [
  { key: "face", description: "the selected expression with both eyes fully open and lips closed" },
  ...PICTURES,
] as const;

export interface MeshDrawnPictures {
  source: AvatarSourceSprite;
  pictures: Record<MeshDrawnPictureKey, Buffer>;
  newFace: boolean;
}

const promptId = (label: string, key: string) => `mesh:${label}:${key}`;
const variant = (key: MeshDrawnPictureKey) => (key.startsWith("mouth") ? "mouth-open" : "eyes-closed");

/** Only reuse pictures whose stored base is exactly the selected sprite, including its alpha. A renamed,
 *  replaced, imported or newly generated face must never lend unrelated eyes or mouths to this sprite. */
export async function savedMeshDrawnPictures(
  request: AvatarMeshRigRequest,
  source: AvatarSourceSprite,
): Promise<Partial<Record<MeshDrawnPictureKey, Buffer>>> {
  const config = await readAvatarConfig(request.owner);
  const set = config?.kinds.pngtuber?.layers[normalizeSpriteExpressionKey(source.label)];
  if (!set) return {};
  const read = async (ref: AvatarImageRef | undefined): Promise<Buffer | null> => {
    if (!ref) return null;
    if (ref.source === "file") return readAvatarFile(request.owner, ref.path);
    try {
      return (await readAvatarSourceSprite(request.owner.ownerId, ref.label)).png;
    } catch (error) {
      if (error instanceof AvatarGenerationError && error.statusCode === 404) return null;
      throw error;
    }
  };
  const base = await read(set.base);
  if (!base) return {};
  if (!base.equals(source.png)) {
    const sharp = await getSharp();
    const raw = async (png: Buffer) => sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const [stored, selected] = await Promise.all([raw(base), raw(source.png)]);
    if (
      stored.info.width !== source.width ||
      stored.info.height !== source.height ||
      !stored.data.equals(selected.data)
    ) {
      return {};
    }
  }
  const pictures: Partial<Record<MeshDrawnPictureKey, Buffer>> = {};
  for (const [key, ref] of [
    ["mouth_a", set.mouthOpen],
    ["eyes_closed", set.eyesClosed],
  ] as const) {
    const png = await read(ref);
    if (!png) continue;
    // Old manually imported pictures may be a different size or include unrelated changes. Treat an
    // unusable saved picture as missing and generate it, without rewriting the saved PNGTuber setup.
    try {
      pictures[key] = await avatarVariantPicture(
        source.png,
        await alignAvatarPicturePng(source.png, png),
        variant(key),
      );
    } catch {
      // The generation path below supplies any missing picture.
    }
  }
  return pictures;
}

async function planMeshPictures(db: DB, request: AvatarMeshRigRequest, source?: AvatarSourceSprite) {
  const original = source ?? (await readAvatarSourceSprite(request.owner.ownerId, request.sourceLabel));
  const [owner, agent, image, saved] = await Promise.all([
    readAvatarOwnerInfo(db, request.owner),
    readAvatarAgentSettings(db),
    resolveAvatarImageConnection(db, request.imageConnectionId),
    savedMeshDrawnPictures(request, original),
  ]);
  // Match the mesh builder's 2048px ceiling before holding seven generated pictures in memory. Reuse is
  // checked against the original sprite first; its matching saved pictures get the identical resize.
  const sharp = await getSharp();
  const scale = Math.min(1, MESH_SOURCE_MAX_SIDE / Math.max(original.width, original.height));
  const width = Math.max(1, Math.round(original.width * scale));
  const height = Math.max(1, Math.round(original.height * scale));
  const resize = (png: Buffer) => sharp(png).resize(width, height, { fit: "fill" }).png().toBuffer();
  const sprite = scale < 1 ? { ...original, width, height, png: await resize(original.png) } : original;
  if (scale < 1) {
    for (const key of Object.keys(saved) as MeshDrawnPictureKey[]) saved[key] = await resize(saved[key]!);
  }
  const prompts: AvatarPromptReviewItem[] = [];
  if (!image.canEdit) {
    if (!owner.appearance) {
      throw new AvatarGenerationError(
        400,
        "Add an appearance or description so this image connection can draw a matching set of faces.",
      );
    }
    const prompt = await talkingHeadSetPrompt(db, image, {
      face: source?.label ?? request.sourceLabel,
      appearance: owner.appearance,
      pictures: SHEET_PICTURES,
    });
    prompts.push({
      id: promptId(sprite.label, "set"),
      kind: "sprite",
      title: `${sprite.label}: matched mouth and eye pictures`,
      ...prompt,
    });
  } else {
    for (const picture of PICTURES) {
      if (saved[picture.key]) continue;
      const prompt = avatarVariantPrompt({ ...owner, template: agent.template }, sprite.label, variant(picture.key));
      prompts.push({
        id: promptId(sprite.label, picture.key),
        kind: "sprite",
        title: `${sprite.label}: ${picture.key.replaceAll("_", " ")}`,
        ...prompt,
        prompt: `${prompt.prompt}\n\nMESH PICTURE CONTRACT [${picture.key}]: change only this face part: ${picture.description}. Keep every other pixel, the pose and framing unchanged. This exact shape is required even if an earlier instruction asks for another mouth or eyelid shape.`,
        ...avatarImageRequestSize(sprite.width, sprite.height, image.conn.model || ""),
      });
    }
  }
  return { source: sprite, image, saved, prompts };
}

/** No connection is a supported mesh fallback, so it has no image prompts to review. */
export async function previewMeshSpritePrompts(
  db: DB,
  request: AvatarMeshRigRequest,
): Promise<AvatarPromptReviewItem[]> {
  try {
    return (await planMeshPictures(db, request)).prompts;
  } catch (error) {
    if (error instanceof AvatarGenerationError && error.statusCode === 400) return [];
    throw error;
  }
}

export async function generateMeshDrawnPictures(
  db: DB,
  request: MeshRigGenerateRequest,
  source: AvatarSourceSprite,
  signal: AbortSignal,
  debug: boolean,
): Promise<MeshDrawnPictures> {
  const plan = await planMeshPictures(db, request, source);
  const overrides = new Map((request.promptOverrides ?? []).map((entry) => [entry.id, entry]));
  const reviewed = (item: AvatarPromptReviewItem) => ({
    ...item,
    ...resolveReviewedImagePromptSubmission({
      generatedPrompt: item.prompt,
      generatedNegativePrompt: item.negativePrompt,
      promptOverride: overrides.get(item.id)?.prompt,
      negativePromptOverride: overrides.get(item.id)?.negativePrompt,
    }),
  });
  source = plan.source;
  const pictures = { ...plan.saved };
  if (!plan.image.canEdit) {
    const set = await drawTalkingHeadSet(plan.image, {
      prompt: reviewed(plan.prompts[0]!),
      cells: SHEET_PICTURES.map((picture) => picture.key),
      cols: 4,
      signal,
      debug,
      logLabel: `mesh ${source.label}`,
    });
    const sharp = await getSharp();
    const { width = 0, height = 0 } = await sharp(set.face).metadata();
    const face = { ...source, png: set.face, width, height, transparent: !(await sharp(set.face).stats()).isOpaque };
    for (const picture of PICTURES) {
      signal.throwIfAborted();
      pictures[picture.key] = await avatarVariantPicture(
        face.png,
        await alignAvatarPicturePng(face.png, set[picture.key]),
        variant(picture.key),
      );
    }
    return { source: face, pictures: pictures as Record<MeshDrawnPictureKey, Buffer>, newFace: true };
  }
  for (const picture of PICTURES) {
    signal.throwIfAborted();
    if (pictures[picture.key]) continue;
    const prompt = reviewed(plan.prompts.find((item) => item.id === promptId(source.label, picture.key))!);
    const aligned = await drawAvatarImageEdit({
      image: plan.image,
      ...prompt,
      source,
      signal,
      debug,
      logLabel: `mesh ${source.label} ${picture.key}`,
    });
    pictures[picture.key] = await avatarVariantPicture(source.png, aligned, variant(picture.key));
  }
  return { source, pictures: pictures as Record<MeshDrawnPictureKey, Buffer>, newFace: false };
}
