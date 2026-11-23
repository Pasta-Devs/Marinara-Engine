/**
 * "Next image in this chat": which image model, fallback, prompt writer, style and reference pictures the next
 * Illustrator picture (Roleplay) or selfie (Conversation) uses, and which setting each one comes from.
 *
 * It reads the same chains the generators read, through the same helpers where they exist, so the summary in Chat
 * settings names what will really happen:
 * - Illustrator image model: chat › Illustrator setup › Images default (resolveIllustratorImageConnectionId).
 * - Illustrator prompt writer: chat Prompt Model › Illustrator's own model › the chat's model
 *   (agent-resolution's Illustrator rule: the Agents default is not used for it).
 * - Selfie image model: chat › Images default (resolveSelfieImageConnectionId).
 * - Selfie prompt writer: chat Prompt Model › the chat's model (resolveIllustratorPromptRuntime).
 * - Style: Game setup › chat › image model's own style › Style Profiles default (resolveIllustratorStyleProfile).
 */
import {
  findComfyReferenceSlots,
  findImageStyleProfile,
  resolveSelfieImageConnectionId,
  resolveReferencePictureTarget,
  routeReferencePictures,
  type ImageStyleProfileSettings,
  type ReferencePictureTarget,
} from "@marinara-engine/shared";
import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { resolveIllustratorImageConnectionId } from "../generation/illustrator-background-generation.js";
import { avatarImageService } from "../avatars/generation/generation-context.js";
import { imageConnectionTakesReferencePicture } from "./image-generation.js";
import { resolveConnectionImageDefaults, resolveImageGenerationService } from "./image-generation-defaults.js";

export type ImagePlanSource =
  | "chat"
  | "illustratorSetup"
  | "imagesDefault"
  | "illustratorModel"
  | "chatModel"
  | "main"
  | "gameSetup"
  | "modelStyle"
  | "styleDefault"
  | "none";

export type ImagePlanModel = {
  id: string;
  name: string;
  model: string;
  source: ImagePlanSource;
};

export type ChatImagePlan = {
  kind: "illustrator" | "selfie";
  imageModel: ImagePlanModel | null;
  /** A pick at this level could not be used (deleted, off, under review), so the next level answered. */
  imageModelSkipped: ImagePlanSource | null;
  fallback: Omit<ImagePlanModel, "source"> | null;
  promptWriter: ImagePlanModel | null;
  promptWriterSkipped: ImagePlanSource | null;
  style: { id: string | null; name: string; source: ImagePlanSource };
  /** The style this chat gets without a style of its own: what "Use default" in the style picker returns to. */
  inheritedStyle: { id: string | null; name: string; source: ImagePlanSource };
  references: {
    on: boolean;
    source: "chat" | "illustratorSetup";
    /** Who gets the pictures: the image model, the prompt writer or both. */
    toImageModel: boolean;
    toWriter: boolean;
    target: ReferencePictureTarget | null;
    /** ComfyUI-style workflows only: the reference slots (1 to 4) the workflow declares. */
    workflowSlots: number[] | null;
    /** ComfyUI fills slots without a picture with the blank placeholder. */
    blanksFilled: boolean;
  };
};

/** The parts of a saved Model the plan reads. Keys are never read or returned. */
export type ImagePlanConnection = {
  id: string;
  name?: string | null;
  model?: string | null;
  provider?: string | null;
  baseUrl?: string | null;
  imageService?: string | null;
  imageGenerationSource?: string | null;
  comfyuiWorkflow?: string | null;
  defaultParameters?: unknown;
};

export type ImagePlanConnections = {
  /** A Model that can answer (not deleted, under review or switched off), as getWithKey decides. */
  getUsable(id: string): Promise<ImagePlanConnection | null>;
  getDefaultForImageGeneration(): Promise<ImagePlanConnection | null>;
  getFallbackForImageGeneration(): Promise<ImagePlanConnection | null>;
  getDefault(): Promise<ImagePlanConnection | null>;
};

export type ImagePlanIllustrator = {
  connectionId: string | null;
  settings: Record<string, unknown>;
} | null;

function readId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function describe(connection: ImagePlanConnection, source: ImagePlanSource): ImagePlanModel {
  return {
    id: connection.id,
    name: String(connection.name ?? "").trim() || String(connection.model ?? "").trim() || connection.id,
    model: String(connection.model ?? "").trim(),
    source,
  };
}

/**
 * The first pick that is set decides. A set pick that cannot answer (deleted, off, under review) is reported as
 * skipped and nothing answers in its place: the generators stop there too (the Illustrator is skipped, a selfie
 * fails), except the Illustrator's image model, whose caller then asks the Images default.
 */
async function firstSet(
  connections: ImagePlanConnections,
  picks: Array<{ id: string | null; source: ImagePlanSource }>,
): Promise<{ found: ImagePlanModel | null; skipped: ImagePlanSource | null; connection: ImagePlanConnection | null }> {
  const pick = picks.find((candidate) => candidate.id);
  if (!pick?.id) return { found: null, skipped: null, connection: null };
  const connection = await connections.getUsable(pick.id);
  return connection
    ? { found: describe(connection, pick.source), skipped: null, connection }
    : { found: null, skipped: pick.source, connection: null };
}

function isWorkflowService(connection: ImagePlanConnection | null): boolean {
  if (!connection) return false;
  const service = resolveImageGenerationService(connection as Parameters<typeof resolveImageGenerationService>[0]);
  return service === "comfyui" || service === "runpod_comfyui" || service === "swarmui";
}

export async function resolveChatImagePlan(args: {
  chatMode: string;
  chatMetadata: Record<string, unknown>;
  chatConnectionId: string | null;
  illustrator: ImagePlanIllustrator;
  connections: ImagePlanConnections;
  styleProfiles: ImageStyleProfileSettings;
}): Promise<ChatImagePlan> {
  const { chatMetadata: meta, connections } = args;
  const selfie = args.chatMode === "conversation";
  const agentSettings = args.illustrator?.settings ?? {};

  // Image model.
  let image: Awaited<ReturnType<typeof firstSet>>;
  const imagesDefaultId = async () => (await connections.getDefaultForImageGeneration())?.id ?? null;
  if (selfie) {
    // An empty selfie model follows the Images default, as the selfie command does.
    const chosen = readId(meta.imageGenConnectionId);
    image = await firstSet(connections, [
      { id: chosen, source: "chat" },
      { id: chosen ? null : resolveSelfieImageConnectionId(meta, await imagesDefaultId()), source: "imagesDefault" },
    ]);
  } else {
    const chatLevelPick = readId(
      args.chatMode === "game" ? meta.gameImageConnectionId : meta.illustratorImageConnectionId,
    );
    const resolvedId = resolveIllustratorImageConnectionId(args.chatMode, meta, agentSettings.imageConnectionId);
    image = await firstSet(connections, [{ id: resolvedId, source: chatLevelPick ? "chat" : "illustratorSetup" }]);
    if (!image.found) {
      // The Illustrator's chosen model could not answer, or there is none: the Images default draws.
      const viaDefault = await firstSet(connections, [{ id: await imagesDefaultId(), source: "imagesDefault" }]);
      image = { ...viaDefault, skipped: image.skipped };
    }
  }

  // "If it fails": the Images fallback, unless it is the model already drawing.
  const fallbackRow = await connections.getFallbackForImageGeneration();
  const fallback =
    fallbackRow && fallbackRow.id !== image.found?.id
      ? (({ source: _source, ...rest }) => rest)(describe(fallbackRow, "imagesDefault"))
      : null;

  // Prompt writer.
  const chatModelId = readId(args.chatConnectionId);
  const mainId = chatModelId ? null : ((await connections.getDefault())?.id ?? null);
  const writer = await firstSet(connections, [
    { id: readId(meta.illustratorPromptConnectionId), source: "chat" },
    ...(selfie ? [] : [{ id: readId(args.illustrator?.connectionId), source: "illustratorModel" as const }]),
    { id: chatModelId, source: "chatModel" },
    { id: mainId, source: "main" },
  ]);
  if (writer.found?.id === LOCAL_SIDECAR_CONNECTION_ID && !writer.found.name) writer.found.name = "Built-in model";

  // Style.
  const setup = meta.gameSetupConfig && typeof meta.gameSetupConfig === "object" ? meta.gameSetupConfig : {};
  const imageDefaults = image.connection
    ? resolveConnectionImageDefaults(image.connection as Parameters<typeof resolveConnectionImageDefaults>[0])
    : null;
  const stylePicks: Array<{ id: string | null; source: ImagePlanSource }> = [
    { id: readId((setup as Record<string, unknown>).imageStyleProfileId), source: "gameSetup" },
    { id: readId(meta.imageStyleProfileId), source: "chat" },
    { id: readId(imageDefaults?.styleProfileId), source: "modelStyle" },
    { id: readId(args.styleProfiles.defaultProfileId), source: "styleDefault" },
  ];
  const describeStyle = (picks: typeof stylePicks) => {
    const pick = picks.find((candidate) => candidate.id) ?? { id: null, source: "none" as const };
    return { id: pick.id, name: findImageStyleProfile(args.styleProfiles, pick.id).name, source: pick.source };
  };
  const style = describeStyle(stylePicks);
  const inheritedStyle = describeStyle(stylePicks.filter((pick) => pick.source !== "chat"));

  // Reference pictures.
  const chatReferences = selfie ? meta.selfieUseAvatarReferences : meta.illustratorUseAvatarReferences;
  const referencesOn = selfie
    ? chatReferences === true
    : typeof chatReferences === "boolean"
      ? chatReferences
      : agentSettings.useAvatarReferences === true;
  const takesReferences = image.connection
    ? imageConnectionTakesReferencePicture({
        ...avatarImageService(image.connection as Parameters<typeof avatarImageService>[0]),
      })
    : false;
  const target = selfie ? null : resolveReferencePictureTarget(meta.illustratorReferencePictureTarget, agentSettings);
  const route = selfie ? { toImageModel: true, toWriter: false } : routeReferencePictures(target!, takesReferences);
  const workflowSlots =
    isWorkflowService(image.connection) && image.connection?.comfyuiWorkflow
      ? findComfyReferenceSlots(image.connection.comfyuiWorkflow)
      : null;

  return {
    kind: selfie ? "selfie" : "illustrator",
    imageModel: image.found,
    imageModelSkipped: image.skipped,
    fallback,
    promptWriter: writer.found,
    promptWriterSkipped: writer.skipped,
    style,
    inheritedStyle,
    references: {
      on: referencesOn,
      source: selfie || typeof chatReferences === "boolean" ? "chat" : "illustratorSetup",
      toImageModel: referencesOn && route.toImageModel,
      toWriter: referencesOn && route.toWriter,
      target,
      workflowSlots,
      blanksFilled: imageDefaults?.comfyui?.uploadPlaceholderOnMissingReference === true,
    },
  };
}
