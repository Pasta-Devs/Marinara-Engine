// ──────────────────────────────────────────────
// Avatar generation: PNGTuber blink and talk variants (lane: generation)
// ──────────────────────────────────────────────
// One click from a sprite: edit it into "eyes closed" and "mouth open" variants with the existing
// image generation (services/image, the same provider routing and fallback connection as sprite
// generation), using the 2D agent's `avatar-pngtuber-eyes-closed` / `avatar-pngtuber-mouth-open`
// templates, sent as written with the sprite as the only reference. The model's picture is lined up with the
// sprite and only its eyes or mouth are kept (avatarVariantPicture): every other pixel stays the sprite's own.
// An image connection that can't edit pictures draws a new face with its blink and talk pictures instead, in
// one sheet so they match (drawTalkingHeadSet); keeping that set replaces the face. Generating returns drafts
// and stores nothing, so the avatar stays as it was until the user keeps a picture; saving stores the kept
// pictures as PNGTuber layers through services/avatars/storage.ts, merged into the stored setup inside its
// per-owner queue. The final prompt is logged with logDebugOverride (debugMode / DEBUG_AGENTS) before it
// reaches the provider.
import { createHash } from "node:crypto";
import {
  AVATAR_EXTRA_FEELINGS,
  AVATAR_PNGTUBER_VARIANTS,
  AVATAR_PROMPT_TEMPLATE_IDS,
  PNGTUBER_DEFAULT_MOTION,
  SPRITE_EXPRESSION_LABELS,
  avatarKindDataSchema,
  createAvatarConfig,
  detectSpriteEmotionBindings,
  detectSpriteFeelingBindings,
  isAvatarFilePath,
  normalizeSpriteExpressionKey,
  type AvatarExpressionBinding,
  type AvatarExpressionMap,
  type AvatarFeelingMap,
  type AvatarFilePath,
  type AvatarGenerationResponse,
  type AvatarOwnerRef,
  type AvatarPngtuberVariant,
  type AvatarPngtuberVariantsRequest,
  type PngtuberAvatarData,
  type PngtuberLayerSet,
} from "@marinara-engine/shared";
import type { DB } from "../../../db/connection.js";
import { drawTalkingHeadSet, talkingHeadSetPrompt } from "../../../routes/sprites.routes.js";
import { isAllowedImageBuffer } from "../../../utils/security.js";
import { resolveReviewedImagePromptSubmission } from "../../image/image-prompt-review.js";
import { getSharp } from "../../image/sharp-runtime.js";
import { readAvatarConfig, readAvatarFile, updateAvatarConfig, writeAvatarFiles } from "../storage.js";
import {
  AvatarGenerationError,
  alignAvatarPicturePng,
  avatarGenerationDebug,
  avatarImageRequestSize,
  avatarVariantPicture,
  drawAvatarImageEdit,
  listAvatarSourceSprites,
  plainErrorText,
  readAvatarAgentSettings,
  readAvatarOwnerInfo,
  readAvatarSourceSprite,
  renderAvatarPromptTemplate,
  resolveAvatarImageConnection,
  withAvatarGenerationJob,
  type AvatarAgentSettings,
  type AvatarImageConnection,
  type AvatarOwnerInfo,
  type AvatarSourceSprite,
} from "./generation-context.js";

export interface AvatarGenerationOptions {
  signal?: AbortSignal;
}

/** A reviewed prompt from the image prompt review dialog, by `variantPromptId`. */
export interface AvatarPromptOverride {
  id: string;
  prompt: string;
  negativePrompt?: string;
}

export interface PngtuberVariantsGenerateRequest extends AvatarPngtuberVariantsRequest {
  promptOverrides?: AvatarPromptOverride[];
}

/** A generated picture that is not stored yet. */
export interface PngtuberVariantDraft {
  /** The sprite it was made from. */
  label: string;
  variant: AvatarPngtuberVariant;
  /** PNG data URL, the sprite's exact size (the new face's, with `face`). */
  image: string;
  width: number;
  height: number;
  /** The sprite file's hash when the picture was made (AvatarSourceSprite.hash). */
  sourceHash: string;
  /** With an image connection that can't edit pictures: the new face (PNG data URL) this picture was drawn
   *  with, in one set with the other variant. Keeping the set makes it the face of the expression. */
  face?: string;
}

export interface PngtuberVariantsDraftResponse {
  drafts: PngtuberVariantDraft[];
  failed: Array<{ label: string; variant: AvatarPngtuberVariant; error: string }>;
}

export interface PngtuberVariantsSaveRequest {
  owner: AvatarOwnerRef;
  /** `face` is the draft's new face, for pictures from a set (PngtuberVariantDraft.face). */
  images: Array<{ label: string; variant: AvatarPngtuberVariant; image: string; sourceHash: string; face?: string }>;
}

export interface AvatarPromptReviewItem {
  id: string;
  kind: "sprite";
  title: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
}

const VARIANT_TEMPLATE_IDS = {
  "eyes-closed": AVATAR_PROMPT_TEMPLATE_IDS.pngtuberEyesClosed,
  "mouth-open": AVATAR_PROMPT_TEMPLATE_IDS.pngtuberMouthOpen,
} as const;

const VARIANT_LAYER_KEYS = { "eyes-closed": "eyesClosed", "mouth-open": "mouthOpen" } as const;

const FULL_BODY_LABEL = /^full[_\s-]+/iu;
const LAYER_KEY = /^[\p{L}\p{N}_]{1,64}$/u;
const MAX_LAYER_SETS = 64;
const MOUTH_OPEN_SUFFIXES = ["mouth_open", "open_mouth", "talking", "talk", "speaking", "speak"];
const EYES_CLOSED_SUFFIXES = ["eyes_closed", "closed_eyes", "eyes_shut", "blinking", "blink"];

/** The sprites a PNGTuber avatar uses: portraits when there are any, otherwise full-body ones, so its faces
 *  never mix the two framings (and `full_happy` never lands in the portrait `happy` slot). */
export function pngtuberSpriteFamily(labels: readonly string[]): string[] {
  const portraits = labels.filter((label) => !FULL_BODY_LABEL.test(label.trim()));
  return portraits.length ? portraits : [...labels];
}

/** The setup the 2D renderer shows for an owner who has sprites but no saved PNGTuber setup: one layer set
 *  per face, with `_talk` / `_blink` sprites as its mouth-open and eyes-closed pictures. Saving generated
 *  pictures starts from it, so no face the avatar showed is lost.
 *  ponytail: a copy of buildPngtuberLayersFromSprites in the 2D lane's
 *  packages/client/src/features/avatars/renderers/pngtuber/pngtuber-layers.ts; the two must change together.
 *  Upgrade: move one copy into @marinara-engine/shared with a contract PR. */
export function spriteBuiltPngtuber(labels: readonly string[]): PngtuberAvatarData | undefined {
  const layers = new Map<string, PngtuberLayerSet>();
  const variants: Array<{ base: string; key: string; mouthOpen: boolean; eyesClosed: boolean }> = [];
  for (const label of pngtuberSpriteFamily(labels)) {
    const key = normalizeSpriteExpressionKey(label);
    if (!LAYER_KEY.test(key)) continue;
    let base = key;
    let mouthOpen = false;
    let eyesClosed = false;
    for (let changed = true; changed;) {
      changed = false;
      for (const [suffixes, isMouth] of [
        [MOUTH_OPEN_SUFFIXES, true],
        [EYES_CLOSED_SUFFIXES, false],
      ] as const) {
        const suffix = suffixes.find((entry) => base.length > entry.length + 1 && base.endsWith(`_${entry}`));
        if (!suffix) continue;
        base = base.slice(0, -(suffix.length + 1));
        if (isMouth) mouthOpen = true;
        else eyesClosed = true;
        changed = true;
      }
    }
    if (mouthOpen || eyesClosed) variants.push({ base, key, mouthOpen, eyesClosed });
    else if (!layers.has(key)) layers.set(key, { base: { source: "sprite", label: key } });
  }
  for (const variant of variants) {
    const set = layers.get(variant.base);
    if (!set) continue;
    const slot =
      variant.mouthOpen && variant.eyesClosed ? "eyesClosedMouthOpen" : variant.mouthOpen ? "mouthOpen" : "eyesClosed";
    set[slot] ??= { source: "sprite", label: variant.key };
  }
  const known: readonly string[] = [...SPRITE_EXPRESSION_LABELS, ...AVATAR_EXTRA_FEELINGS];
  const rank = (key: string) => (known.includes(key) ? known.indexOf(key) : known.length);
  const keys = [...layers.keys()]
    .sort((left, right) => rank(left) - rank(right) || left.localeCompare(right))
    .slice(0, MAX_LAYER_SETS);
  if (!keys.length) return undefined;
  return {
    layers: Object.fromEntries(keys.map((key) => [key, layers.get(key)!])),
    expressionMap: detectSpriteEmotionBindings(keys),
    feelingMap: detectSpriteFeelingBindings(keys),
    motion: { ...PNGTUBER_DEFAULT_MOTION },
    source: "sprites",
  };
}

/** The review id of one variant prompt, shared by the preview and the generate request. */
export function variantPromptId(label: string, variant: AvatarPngtuberVariant): string {
  return `avatar:pngtuber:${label}:${variant}`;
}

/** The review id of a face's set prompt (an image connection that can't edit pictures). */
export function setPromptId(label: string): string {
  return `avatar:pngtuber:${label}:set`;
}

/** The layer key of a sprite label (the contract keys PNGTuber layer sets by normalized label). */
export function pngtuberLayerKey(label: string): string {
  const key = normalizeSpriteExpressionKey(label).slice(0, 64);
  if (!key) throw new AvatarGenerationError(400, `"${label}" can't be used as an expression name.`);
  return key;
}

/** Stored file names for a layer set: ASCII, with a short hash when the label had other characters. */
export function pngtuberVariantFilePath(key: string, part: "base" | AvatarPngtuberVariant): AvatarFilePath {
  const ascii = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48);
  const stem =
    ascii && ascii === key.replace(/_/gu, "-")
      ? ascii
      : `${ascii || "expression"}-${createHash("sha256").update(key).digest("hex").slice(0, 8)}`;
  const path = `pngtuber/${stem}-${part}.png`;
  if (!isAvatarFilePath(path)) throw new AvatarGenerationError(400, `"${key}" can't be used as an expression name.`);
  return path;
}

export interface KeptPngtuberSet {
  key: string;
  variants: AvatarPngtuberVariant[];
  /** The set's other pictures were drawn for this same base, so they stay. */
  keepOthers: boolean;
}

/** Fresh bindings for the layer keys, with the current bindings laid over them that still name a face (or
 *  none on purpose). */
function keepCurrentBindings<M extends Partial<Record<string, AvatarExpressionBinding>>>(
  detected: M,
  current: M | undefined,
  layers: Record<string, PngtuberLayerSet>,
): M {
  const map: Partial<Record<string, AvatarExpressionBinding>> = detected;
  for (const [slot, binding] of Object.entries(current ?? {})) {
    if (binding && binding.source !== "missing" && (binding.target === null || Object.hasOwn(layers, binding.target))) {
      map[slot] = binding;
    }
  }
  return detected;
}

/** Puts kept pictures into the owner's PNGTuber setup (pass spriteBuiltPngtuber when none is saved). A
 *  layer set that was built from another picture (another sprite, or a PNGTuber Plus import) is replaced,
 *  so a blink never swaps to a picture drawn for a different base. Bindings the user or an import chose
 *  stay, for the six emotions and the extra feelings. A setup built from sprites becomes a generated one, so
 *  refreshing it from the sprites can't drop the new pictures. */
export function mergePngtuberVariants(
  current: PngtuberAvatarData | undefined,
  kept: readonly KeptPngtuberSet[],
): PngtuberAvatarData {
  const layers: Record<string, PngtuberLayerSet> = { ...(current?.layers ?? {}) };
  for (const { key, variants, keepOthers } of kept) {
    const base = { source: "file" as const, path: pngtuberVariantFilePath(key, "base") };
    const set: PngtuberLayerSet = keepOthers && layers[key] ? { ...layers[key], base } : { base };
    for (const variant of variants) {
      set[VARIANT_LAYER_KEYS[variant]] = { source: "file", path: pngtuberVariantFilePath(key, variant) };
    }
    // A combined blink-and-talk picture was drawn for the old pictures; it would not match the new ones.
    delete set.eyesClosedMouthOpen;
    layers[key] = set;
  }
  const keys = Object.keys(layers);
  return {
    layers,
    expressionMap: keepCurrentBindings<AvatarExpressionMap>(
      detectSpriteEmotionBindings(keys),
      current?.expressionMap,
      layers,
    ),
    feelingMap: keepCurrentBindings<AvatarFeelingMap>(detectSpriteFeelingBindings(keys), current?.feelingMap, layers),
    motion: current?.motion ?? { ...PNGTUBER_DEFAULT_MOTION },
    source: current?.source === "pngtuber-plus" ? "pngtuber-plus" : "generated",
  };
}

export interface AvatarVariantPromptContext extends AvatarOwnerInfo {
  template: AvatarAgentSettings["template"];
}

/** The provider prompt for one variant of one sprite: the reviewed prompt when the user edited it, else
 *  the agent's template rendered with the owner's card text. It is sent as written, never through the
 *  sprite prompt compiler or style profiles: those cut an edit instruction down to tags, dropping "open
 *  the mouth" and "keep the framing" and adding "full body", so the model redrew the whole character. */
export function avatarVariantPrompt(
  context: AvatarVariantPromptContext,
  label: string,
  variant: AvatarPngtuberVariant,
  override?: AvatarPromptOverride,
): { prompt: string; negativePrompt: string } {
  const id = VARIANT_TEMPLATE_IDS[variant];
  const rendered = renderAvatarPromptTemplate(context.template(id), id, {
    characterName: context.name || "the character",
    appearance: context.appearance,
    expression: label.replace(/[_-]+/gu, " "),
  });
  return resolveReviewedImagePromptSubmission({
    generatedPrompt: rendered,
    generatedNegativePrompt: "",
    promptOverride: override?.prompt,
    negativePromptOverride: override?.negativePrompt,
  });
}

/** Raster sprites a PNGTuber avatar can use (pngtuberSpriteFamily over every sprite of the owner). */
function familySourceSprites(ownerId: string): string[] {
  const family = new Set(pngtuberSpriteFamily(listAvatarSourceSprites(ownerId, { all: true })));
  return listAvatarSourceSprites(ownerId).filter((label) => family.has(label));
}

/** The sprites to draw: the requested ones, which must be in the avatar's family, else the ones the saved
 *  setup uses, else all of them. Refused before any picture is paid for. */
async function requestedLabels(request: AvatarPngtuberVariantsRequest): Promise<string[]> {
  const sprites = familySourceSprites(request.owner.ownerId);
  if (request.labels?.length) {
    const outside = request.labels.find((label) => !sprites.includes(label));
    if (outside !== undefined) {
      throw new AvatarGenerationError(
        400,
        FULL_BODY_LABEL.test(outside)
          ? `"${outside}" is a full-body sprite; the PNGTuber avatar uses the portrait sprites.`
          : `The sprite "${outside}" was not found.`,
      );
    }
    return [...new Set(request.labels)];
  }
  const config = await readAvatarConfig(request.owner).catch(() => null);
  const keys = Object.keys(config?.kinds.pngtuber?.layers ?? {});
  return keys.length ? sprites.filter((label) => keys.includes(normalizeSpriteExpressionKey(label))) : sprites;
}

/** The exact prompts the variants would send, for the image prompt review dialog. */
export async function previewPngtuberVariantPrompts(
  db: DB,
  request: AvatarPngtuberVariantsRequest,
): Promise<AvatarPromptReviewItem[]> {
  const labels = await requestedLabels(request);
  const [owner, agent, image] = await Promise.all([
    readAvatarOwnerInfo(db, request.owner),
    readAvatarAgentSettings(db),
    resolveAvatarImageConnection(db, request.connectionId),
  ]);
  const items: AvatarPromptReviewItem[] = [];
  for (const label of labels) {
    if (!image.canEdit) {
      items.push({
        id: setPromptId(label),
        kind: "sprite",
        title: `${label.replace(/_/gu, " ")}: new face, eyes closed and mouth open`,
        ...(await pngtuberSetPrompt(db, image, owner, label)),
      });
      continue;
    }
    const source = await readAvatarSourceSprite(request.owner.ownerId, label);
    const size = avatarImageRequestSize(source.width, source.height, image.conn.model || "");
    for (const variant of request.variants) {
      const prompt = avatarVariantPrompt({ template: agent.template, ...owner }, label, variant);
      items.push({
        id: variantPromptId(label, variant),
        kind: "sprite",
        title: `${label.replace(/_/gu, " ")}: ${variant.replace("-", " ")}`,
        ...prompt,
        ...size,
      });
    }
  }
  return items;
}

/** The prompt of a face's set, or the one reviewed for it. The set is drawn from the appearance text, since
 *  the connection can't be shown the sprite. */
async function pngtuberSetPrompt(
  db: DB,
  image: AvatarImageConnection,
  owner: AvatarOwnerInfo,
  label: string,
  override?: AvatarPromptOverride,
) {
  if (!owner.appearance) {
    throw new AvatarGenerationError(
      400,
      "This image connection can't edit pictures, so it draws a new face from the appearance. Add an appearance or description to the character or persona first.",
    );
  }
  const built = await talkingHeadSetPrompt(db, image, { face: label, appearance: owner.appearance });
  return {
    ...built,
    ...resolveReviewedImagePromptSubmission({
      generatedPrompt: built.prompt,
      generatedNegativePrompt: built.negativePrompt,
      promptOverride: override?.prompt,
      negativePromptOverride: override?.negativePrompt,
    }),
  };
}

const pngDataUrl = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;

/** A new face with its eyes-closed and mouth-open pictures, drawn in one sheet. Each variant cell is lined up
 *  with the face cell and gives only its eyes or mouth, so the three match. Both variants come back, whichever
 *  was asked for: the face is new, so a picture drawn for the old face would not match it. */
async function drawPngtuberSet(
  image: AvatarImageConnection,
  prompt: Awaited<ReturnType<typeof pngtuberSetPrompt>>,
  label: string,
  source: AvatarSourceSprite,
  signal: AbortSignal,
  debug: boolean,
): Promise<PngtuberVariantDraft[]> {
  const set = await drawTalkingHeadSet(image, { prompt, signal, debug, logLabel: `pngtuber ${label} set` });
  const { width = 0, height = 0 } = await (await getSharp())(set.face).metadata();
  const drafts: PngtuberVariantDraft[] = [];
  for (const variant of AVATAR_PNGTUBER_VARIANTS) {
    const picture = await avatarVariantPicture(set.face, await alignAvatarPicturePng(set.face, set[variant]), variant);
    drafts.push({
      label,
      variant,
      image: pngDataUrl(picture),
      width,
      height,
      sourceHash: source.hash,
      face: pngDataUrl(set.face),
    });
  }
  return drafts;
}

/** Draws the requested variants one after another and returns them without storing anything. One
 *  failed picture does not stop the others. */
export async function generatePngtuberVariants(
  db: DB,
  request: PngtuberVariantsGenerateRequest,
  options: AvatarGenerationOptions = {},
): Promise<PngtuberVariantsDraftResponse> {
  const job = async (signal: AbortSignal) => {
    const labels = await requestedLabels(request);
    if (!labels.length) throw new AvatarGenerationError(400, "Add a sprite first, then make variants from it.");
    const [owner, agent, image] = await Promise.all([
      readAvatarOwnerInfo(db, request.owner),
      readAvatarAgentSettings(db),
      resolveAvatarImageConnection(db, request.connectionId),
    ]);
    const overrides = new Map((request.promptOverrides ?? []).map((entry) => [entry.id, entry]));
    const debug = avatarGenerationDebug(request.debugMode);
    const response: PngtuberVariantsDraftResponse = { drafts: [], failed: [] };
    for (const label of labels) {
      pngtuberLayerKey(label); // refuse a label that can't be stored before paying for a picture
      const source = await readAvatarSourceSprite(request.owner.ownerId, label);
      if (!image.canEdit) {
        if (signal.aborted) throw signal.reason ?? new Error("Cancelled");
        try {
          const prompt = await pngtuberSetPrompt(db, image, owner, label, overrides.get(setPromptId(label)));
          response.drafts.push(...(await drawPngtuberSet(image, prompt, label, source, signal, debug)));
        } catch (error) {
          if (signal.aborted || error instanceof AvatarGenerationError) throw error;
          const message = plainErrorText(error, "The pictures could not be made.");
          for (const variant of request.variants) response.failed.push({ label, variant, error: message });
        }
        continue;
      }
      for (const variant of request.variants) {
        if (signal.aborted) throw signal.reason ?? new Error("Cancelled");
        try {
          const prompt = avatarVariantPrompt(
            { template: agent.template, ...owner },
            label,
            variant,
            overrides.get(variantPromptId(label, variant)),
          );
          const aligned = await drawAvatarImageEdit({
            image,
            ...prompt,
            source,
            signal,
            debug,
            logLabel: `pngtuber ${label} ${variant}`,
          });
          const png = await avatarVariantPicture(source.png, aligned, variant);
          response.drafts.push({
            label,
            variant,
            image: pngDataUrl(png),
            width: source.width,
            height: source.height,
            sourceHash: source.hash,
          });
        } catch (error) {
          if (signal.aborted || error instanceof AvatarGenerationError) throw error;
          response.failed.push({ label, variant, error: plainErrorText(error, "The picture could not be made.") });
        }
      }
    }
    if (!response.drafts.length && response.failed.length) {
      throw new AvatarGenerationError(502, response.failed[0]!.error);
    }
    return response;
  };
  return withAvatarGenerationJob(request.owner, "pngtuber", job, options.signal);
}

function decodeDataUrl(value: string): Buffer {
  const comma = value.startsWith("data:") ? value.indexOf(",") : -1;
  return Buffer.from(comma >= 0 ? value.slice(comma + 1) : value, "base64");
}

/** A kept picture from the browser: must be a picture of exactly `size` (the sprite's, or the new face's for a
 *  set; a face itself has any size). Re-encoded so only pixels are stored. */
async function keptPicturePng(
  image: string,
  source: AvatarSourceSprite,
  size: { width: number; height: number } | null = source,
): Promise<Buffer> {
  const bytes = decodeDataUrl(image);
  if (!isAllowedImageBuffer(bytes)) throw new AvatarGenerationError(400, "A kept picture isn't a picture.");
  const sharp = await getSharp();
  const { data, info } = await sharp(bytes, { animated: false })
    .ensureAlpha()
    .png()
    .toBuffer({ resolveWithObject: true })
    .catch((error: unknown) => {
      throw new AvatarGenerationError(400, "A kept picture couldn't be read.", { cause: error });
    });
  if (size && (info.width !== size.width || info.height !== size.height)) {
    throw new AvatarGenerationError(400, `A kept picture for "${source.label}" isn't the size of its face.`);
  }
  return data;
}

/** Stores the kept pictures as PNGTuber layers and returns the saved setup. The sprite each picture was
 *  made from is copied next to it as it is, or, for a set from an image connection that can't edit pictures,
 *  the set's new face (the sprite file itself is never changed). Each kept picture is stored as drawn (it
 *  already has its face's alpha), so the base and its variants always line up; a sprite replaced since its
 *  pictures were made is refused. The files are written first and the setup is merged inside the owner's
 *  queue, so a change saved meanwhile (another tab, an import) is kept, not overwritten.
 *  ponytail: pictures of a replaced imported set stay on disk until the next PNGTuber import or removal
 *  tidies the folder; storage has no queued "tidy" call for generation to use. */
export async function savePngtuberVariants(request: PngtuberVariantsSaveRequest): Promise<AvatarGenerationResponse> {
  const files = new Map<AvatarFilePath, Uint8Array>();
  const sets = new Map<
    string,
    KeptPngtuberSet & {
      label: string;
      source: AvatarSourceSprite;
      sameBase: boolean;
      /** The new face as kept (a set's), else undefined. */
      face?: string;
      /** The picture stored as the base: the sprite, or the set's new face, and its size. */
      basePng: Buffer;
      size: { width: number; height: number };
    }
  >();
  const family = familySourceSprites(request.owner.ownerId);
  for (const entry of request.images) {
    const key = pngtuberLayerKey(entry.label);
    let set = sets.get(key);
    if (set && set.label !== entry.label) {
      throw new AvatarGenerationError(400, `Keep pictures from one sprite per expression ("${key}").`);
    }
    if (!set) {
      if (!family.includes(entry.label)) {
        throw new AvatarGenerationError(400, `"${entry.label}" isn't one of the PNGTuber avatar's sprites.`);
      }
      const source = await readAvatarSourceSprite(request.owner.ownerId, entry.label);
      const basePng = entry.face ? await keptPicturePng(entry.face, source, null) : source.png;
      const { width = 0, height = 0 } = entry.face ? await (await getSharp())(basePng).metadata() : source;
      set = {
        key,
        label: entry.label,
        source,
        variants: [],
        keepOthers: false,
        sameBase: false,
        face: entry.face,
        basePng,
        size: { width, height },
      };
      sets.set(key, set);
    } else if (set.face !== entry.face) {
      throw new AvatarGenerationError(400, `Keep a new face together with its own blink and talk pictures ("${key}").`);
    }
    if (entry.sourceHash !== set.source.hash) {
      throw new AvatarGenerationError(
        409,
        `The sprite "${entry.label}" changed after its pictures were made. Make them again.`,
      );
    }
    // Drawing already gave the picture its face's alpha and pixels outside the eyes or mouth.
    files.set(pngtuberVariantFilePath(key, entry.variant), await keptPicturePng(entry.image, set.source, set.size));
    if (!set.variants.includes(entry.variant)) set.variants.push(entry.variant);
  }
  for (const set of sets.values()) {
    const basePath = pngtuberVariantFilePath(set.key, "base");
    // Read before anything is written: earlier pictures stay only when they were drawn for this picture.
    set.sameBase = !!(await readAvatarFile(request.owner, basePath))?.equals(set.basePng);
    files.set(basePath, set.basePng);
  }
  const allSprites = listAvatarSourceSprites(request.owner.ownerId, { all: true });
  await writeAvatarFiles(
    request.owner,
    [...files].map(([path, bytes]) => ({ path, bytes })),
  );
  const config = await updateAvatarConfig(request.owner, (current) => {
    // An owner without a saved setup shows the one built from the sprites; start from it.
    const built = spriteBuiltPngtuber(allSprites);
    const saved = current?.kinds.pngtuber ?? built;
    // Each face being saved starts from its sprite-built set under its saved one, so a `_blink` or `_talk`
    // sprite added since (or a face added since) stays next to the new picture; a saved picture wins over a
    // sprite. Sprite pictures never reach another base: keepOthers below drops them with the old set.
    const start = saved && {
      ...saved,
      layers: {
        ...saved.layers,
        ...Object.fromEntries(
          [...sets.keys()].flatMap((key) =>
            built?.layers[key] ? [[key, { ...built.layers[key], ...saved.layers[key] }]] : [],
          ),
        ),
      },
    };
    const kept = [...sets.values()].map((set) => {
      const existing = start?.layers[set.key]?.base;
      // A new face matches none of the pictures the old one had.
      const keepOthers =
        !set.face &&
        (existing?.source === "sprite"
          ? existing.label === set.key
          : existing?.path === pngtuberVariantFilePath(set.key, "base") && set.sameBase);
      return { ...set, keepOthers };
    });
    const data = mergePngtuberVariants(start, kept);
    const checked = avatarKindDataSchema.safeParse({ pngtuber: data });
    if (!checked.success) {
      throw new AvatarGenerationError(400, checked.error.issues[0]?.message ?? "The PNGTuber setup isn't valid.");
    }
    const now = new Date().toISOString();
    const base = current ?? createAvatarConfig(request.owner, now);
    return {
      ...base,
      activeKind: base.activeKind ?? "pngtuber",
      kinds: { ...base.kinds, pngtuber: data },
      updatedAt: now,
    };
  });
  return { kind: "pngtuber", config, files: [...files.keys()], warnings: [] };
}
