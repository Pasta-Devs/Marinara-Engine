import { normalizeIllustratorVideoMode, normalizeVideoPromptInstructions } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { loadIllustratorContextSize } from "../generation/conversation-video-runtime.js";
import {
  resolveIllustratorCharacterReferences,
  type IllustratorChatCharacterReference,
  type IllustratorPersonaReference,
} from "../image/illustrator-references.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { formatVideoAppearanceDetails, videoInstructionsUseAppearance } from "./appearance-reference.js";
import { resolveChatVideoSetup } from "./chat-video-generation.js";
import { resolveSceneVideoConnectionId } from "./chat-video-messages.js";
import { formatRecentVideoContext } from "./prompt-context.js";
import { writeRoleplayClipDirection } from "./roleplay-clip-writer.js";

type ReferenceArgs = Parameters<typeof resolveIllustratorCharacterReferences>[0];

/** What the Illustrator agent is told about clips (memory `_generatedVideos`), or null when it makes no clips. */
export type IllustratorVideoOffer = { instructions: string; clipsOnly: boolean; describeAppearance: boolean };

/**
 * Whether a Roleplay Illustrator makes clips now (Illustrator makes, with a working video connection), and what it
 * is told about them. The fresh-reply and re-run paths both ask here, so the agent is offered exactly what the
 * handler will make: without a working video connection, Clips only makes pictures.
 */
export async function resolveIllustratorVideoOffer(
  chatMode: string | null | undefined,
  chatMeta: Record<string, unknown>,
  connections: {
    getDefaultForVideoGeneration(): Promise<{ id: string } | null>;
    getWithKey(id: string): Promise<{ provider?: string | null; videoPromptInstructions?: string | null } | null>;
  },
): Promise<IllustratorVideoOffer | null> {
  const mode = normalizeIllustratorVideoMode(chatMeta.illustratorVideoMode);
  if (chatMode !== "roleplay" || mode === "pictures") return null;
  const videoConnectionId = await resolveSceneVideoConnectionId(chatMeta, connections);
  const videoConnection = videoConnectionId ? await connections.getWithKey(videoConnectionId) : null;
  if (videoConnection?.provider !== "video_generation") return null;
  return {
    instructions: normalizeVideoPromptInstructions(videoConnection.videoPromptInstructions) ?? "",
    clipsOnly: mode === "clips_only",
    // Attach Card Appearance for videos, with instructions that speak to appearance: the agent builds everyone's
    // appearance into its videoPrompt (otherwise the lines are added after it).
    describeAppearance:
      chatMeta.illustratorVideoIncludeCharacterAppearance === true &&
      videoInstructionsUseAppearance(videoConnection.videoPromptInstructions),
  };
}

/**
 * The pieces a Roleplay Illustrator clip needs, shared by a fresh reply and a re-run: who a clip shows, and its
 * video prompt written to the video connection's Video Prompting Instructions.
 */
export function createRoleplayClipTools(args: {
  db: DB;
  chat: Parameters<typeof writeRoleplayClipDirection>[1]["chat"];
  chatMeta: Record<string, unknown>;
  chatId: string;
  /** The chat's characters' names, for the writer. */
  characterNames: string[];
  /** Who the Illustrator can show: the chat's characters (and a character used as the user) and the persona. */
  cast: () => { chatCharacters: IllustratorChatCharacterReference[]; persona: IllustratorPersonaReference | null };
  charactersStore: ReferenceArgs["charactersStore"];
  characterGallery?: ReferenceArgs["characterGallery"];
  personaGallery?: ReferenceArgs["personaGallery"];
  debugMode?: boolean;
  signal?: AbortSignal;
}) {
  // The cast of a clip with no picture of its own: every character or persona it names, with their appearance lines
  // and, for the Avatar first frame, the avatar of the first one named.
  const resolveClipCast = async (names: readonly string[], promptText: string, withAvatar: boolean) => {
    const resolve = (requestedNames: string[], text: string, opts: { avatars: boolean; fallback: boolean }) =>
      resolveIllustratorCharacterReferences({
        charactersStore: args.charactersStore,
        characterGallery: args.characterGallery,
        personaGallery: args.personaGallery,
        ...args.cast(),
        requestedNames,
        promptText: text,
        fallbackToChatCharacters: opts.fallback,
        includeReferenceImages: opts.avatars,
        includePersonaWhenMentionedInPrompt: false,
        maxReferences: opts.fallback ? 12 : 1,
      });
    const first = names[0]?.trim() ?? "";
    const cast = await resolve([...names], promptText, { avatars: withAvatar && !first, fallback: true });
    // The avatar of the first person named, matched on its own so a short name ("Lena") finds its card ("Dr. Lena
    // Kowalski"); when that person has no picture, no one else's face stands in.
    const avatarCast = withAvatar && first ? await resolve([first], first, { avatars: true, fallback: false }) : cast;
    const base64 = avatarCast.referenceImages[0];
    return {
      // The persona too when the clip names them, so it shows in their gallery.
      characterIds: cast.personaId ? [...cast.characterIds, cast.personaId] : cast.characterIds,
      appearanceBlock: cast.appearanceBlock,
      avatar: base64 ? { base64, name: avatarCast.referenceNames[0] ?? "" } : null,
    };
  };
  // Attach Card Appearance for videos, with instructions that speak to appearance: everyone in the scene (characters
  // and persona) with their appearance details, for the clip's writer to build in.
  const clipAppearanceDetails = async (instructions: unknown) => {
    if (args.chatMeta.illustratorVideoIncludeCharacterAppearance !== true) return "";
    if (!videoInstructionsUseAppearance(instructions)) return "";
    const cast = args.cast();
    const names = [
      ...cast.chatCharacters.map((character) => character.name),
      ...(cast.persona ? [cast.persona.name] : []),
    ];
    const resolution = await resolveIllustratorCharacterReferences({
      charactersStore: args.charactersStore,
      characterGallery: args.characterGallery,
      personaGallery: args.personaGallery,
      ...cast,
      requestedNames: names,
      promptText: names.join("\n"),
      fallbackToChatCharacters: true,
      includeReferenceImages: false,
      maxReferences: 12,
    });
    return formatVideoAppearanceDetails(resolution.appearanceBlock);
  };
  let clipSetup: Awaited<ReturnType<typeof resolveChatVideoSetup>> | undefined;
  // A Roleplay clip's video prompt, written to the video connection's Video Prompting Instructions from the recent
  // messages up to its reply: the Clip Director for a clip with no picture of its own, the Gallery animation director
  // to continue a picture. `request` is what the clip should show (a scene, a motion).
  const writeClipPrompt = async (opts: {
    messageId: string;
    request: string;
    withoutPicture: boolean;
    referenceImagePrompt?: string;
  }) => {
    clipSetup ??= await resolveChatVideoSetup(args.db, args.chatMeta);
    return writeRoleplayClipDirection(args.db, {
      chat: args.chat,
      meta: args.chatMeta,
      setup: clipSetup,
      sourceExchange: [
        opts.request ? `Requested clip: ${opts.request}` : "",
        formatRecentVideoContext(await createChatsStorage(args.db).listMessages(args.chatId), {
          count: await loadIllustratorContextSize(args.db),
          endMessageId: opts.messageId,
        }),
      ]
        .filter(Boolean)
        .join("\n\n"),
      referenceImagePrompt: opts.referenceImagePrompt,
      characterNames: args.characterNames,
      appearanceDetails: await clipAppearanceDetails(clipSetup.videoConn.videoPromptInstructions),
      withoutPicture: opts.withoutPicture,
      debugMode: args.debugMode,
      signal: args.signal,
    });
  };
  return { resolveClipCast, writeClipPrompt };
}
