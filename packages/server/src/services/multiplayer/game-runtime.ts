import {
  applyGameWidgetUpdate,
  applyTrackerFieldLocksToGameStatePatch,
  normalizeCharacterLookupName,
  parseGmTags,
  resolveMessageWeatherAction,
  type GameActiveState,
  type GameNpc,
  type GameSetupConfig,
  type HudWidget,
  type MultiplayerStoredRoom,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import type { CreateGameRequest, SetupGameRequest } from "../../routes/game.routes.js";
import type { GenerationRunner } from "../../routes/generate.routes.js";
import { createGenerationEventSink, type GenerationOutput } from "../../routes/generate/sse.js";
import { parseGameStateRow } from "../../routes/generate/generate-route-utils.js";
import { createChatsStorage, withChatMetadataPatchQueue } from "../storage/chats.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createGameStateStorage } from "../storage/game-state.storage.js";
import { processReputationActions } from "../game/reputation.service.js";
import { generateWeather, inferBiome, shouldWeatherChange } from "../game/weather.service.js";
import { validateTransition } from "../game/state-machine.service.js";
import { record } from "./room-projection.js";
import { ensureRoomHumanGameCards } from "./game-persona.js";
import { resolveRoomGenerationPolicy, runWithRoomGeneration, type GenerationRoomContext } from "./generation-policy.js";

const arrayRecords = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.map(record) : []);

interface GameOperations {
  create(input: CreateGameRequest, output: GenerationOutput): Promise<unknown>;
  setup(input: SetupGameRequest, output: GenerationOutput, signal?: AbortSignal): Promise<unknown>;
  start(input: { chatId: string }): Promise<{ status: string; alreadyStarted: boolean }>;
}
export interface RoomGameStartInput {
  chatId: string;
  config: GameSetupConfig;
  preferences?: string;
  gmConnectionId?: string | null;
  gameName?: string;
}
export type RoomGameRuntime = ReturnType<typeof createRoomGameRuntime>;

// The host coordinator owns the persisted claim and awaits this entire operation.
// An internal output is never a request to the Engine's administrative HTTP routes.
export function createRoomGameRuntime(db: DB, operations: GameOperations) {
  const chats = createChatsStorage(db);
  async function read(chatId: string, claim: GenerationRoomContext, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const chat = await chats.getById(chatId);
    if (!chat || chat.mode !== "game") throw new Error("The shared Game no longer exists.");
    const metadata = record(chat.metadata);
    const policy = resolveRoomGenerationPolicy(chatId, metadata, JSON.parse(chat.characterIds), claim);
    if (!policy) throw new Error("The shared Game is not active.");
    if (metadata.gameExperienceId || record(metadata.gameSetupConfig).gameExperienceId) {
      throw new Error("Package Game Experiences are unavailable in shared rooms.");
    }
    return { chat, metadata, policy };
  }
  async function execute(operation: (output: GenerationOutput) => Promise<unknown>) {
    let failure: Error | undefined;
    const output = createGenerationEventSink({
      onEvent(event) {
        if (event.type === "error") failure = new Error("The shared Game generation failed.");
      },
      onFinish(result) {
        if (result.statusCode >= 400) {
          failure = new Error(
            typeof record(result.body).error === "string"
              ? (record(result.body).error as string)
              : "The shared Game operation failed.",
          );
        }
      },
    });
    const result = await operation(output);
    if (failure) throw failure;
    return result;
  }

  async function finishGameTurn(chatId: string, claim: GenerationRoomContext, signal?: AbortSignal) {
    const { policy } = await read(chatId, claim, signal);
    return runWithRoomGeneration(policy, () =>
      withChatMetadataPatchQueue(chatId, () =>
        db.transaction(async (tx) => {
          const store = createChatsStorage(tx);
          const chat = await store.getById(chatId);
          if (!chat) throw new Error("The shared Game no longer exists.");
          const metadata = record(chat.metadata);
          resolveRoomGenerationPolicy(chatId, metadata, JSON.parse(chat.characterIds), claim);
          signal?.throwIfAborted();
          const messages = await store.listMessages(chatId);
          const message = [...messages].reverse().find((item) => item.role === "assistant" && item.content.trim());
          if (!message) return { applied: false };
          const appliedIds = Array.isArray(metadata.multiplayerGameAppliedMessages)
            ? metadata.multiplayerGameAppliedMessages.filter((id): id is string => typeof id === "string")
            : [];
          if (appliedIds.includes(message.id)) return { applied: false };
          const tags = parseGmTags(message.content);
          const previousState = (metadata.gameActiveState as GameActiveState) || "exploration";
          const nextState =
            tags.stateChange && ["exploration", "dialogue", "combat", "travel_rest"].includes(tags.stateChange)
              ? validateTransition(previousState, tags.stateChange as GameActiveState)
              : previousState;
          const npcs = Array.isArray(metadata.gameNpcs) ? (metadata.gameNpcs as GameNpc[]) : [];
          const reputation = processReputationActions(
            npcs,
            tags.reputationActions.map((action) => ({ npcId: action.npcName, action: action.action })),
          );
          let widgets = Array.isArray(metadata.gameWidgetState) ? (metadata.gameWidgetState as HudWidget[]) : [];
          for (const update of tags.widgetUpdates) widgets = applyGameWidgetUpdate(widgets, update);

          // Only already approved AI cards can be recruited. A generated name never imports a library card.
          let partyIds = Array.isArray(metadata.gamePartyCharacterIds)
            ? metadata.gamePartyCharacterIds.filter(
                (id): id is string => typeof id === "string" && policy.characterIds.includes(id),
              )
            : [];
          const cards = createCharactersStorage(tx);
          const approvedCards = await Promise.all(policy.characterIds.map((id) => cards.getById(id)));
          for (const change of tags.partyChanges) {
            const wantedName = normalizeCharacterLookupName(change.characterName);
            const matches = approvedCards.filter(
              (card) =>
                card &&
                normalizeCharacterLookupName(String(record(card.data).name ?? "")) === wantedName &&
                card.id !== metadata.gameGmCharacterId,
            );
            if (matches.length !== 1) continue;
            const id = matches[0]!.id;
            partyIds =
              change.change === "add" ? [...new Set([...partyIds, id])] : partyIds.filter((partyId) => partyId !== id);
          }
          const patch: Record<string, unknown> = {
            gameActiveState: nextState,
            gameNpcs: reputation.npcs,
            gameWidgetState: widgets,
            gamePartyCharacterIds: partyIds,
            multiplayerGameAppliedMessages: [...appliedIds, message.id].slice(-64),
            multiplayerGameTurn: {
              messageId: message.id,
              choices: tags.choices,
              qte: tags.qte,
              skillChecks: tags.skillChecks,
              combatEncounter: tags.combatEncounter,
            },
          };
          const states = createGameStateStorage(tx);
          const latest = await states.getLatest(chatId);
          const weatherAction = resolveMessageWeatherAction(previousState, message.content);
          if (weatherAction && shouldWeatherChange(weatherAction)) {
            const weather = generateWeather(inferBiome(latest?.location ?? ""), "summer");
            patch.gameWeather = weather;
            if (latest) {
              const lockedPatch = applyTrackerFieldLocksToGameStatePatch(
                { weather: weather.type, temperature: `${weather.temperature}°C` },
                parseGameStateRow(latest as Record<string, unknown>),
              );
              await states.updateLatest(chatId, lockedPatch);
            }
          }
          signal?.throwIfAborted();
          await store.patchMetadata(chatId, patch, { metadataQueueHeld: true });
          return { applied: true, messageId: message.id };
        }),
      ),
    );
  }

  async function runGameStart(
    input: RoomGameStartInput,
    claim: GenerationRoomContext,
    runner: GenerationRunner,
    signal?: AbortSignal,
  ) {
    const initial = await read(input.chatId, claim, signal);
    const roomCharacters = arrayRecords(record(initial.metadata.multiplayer).characters);
    const names = [
      ...initial.policy.participants.map((participant) => participant.persona.name),
      ...roomCharacters.map((character) => String(character.name ?? "")),
    ].map(normalizeCharacterLookupName);
    if (new Set(names).size !== names.length)
      throw new Error("Every shared Game character and human persona needs a distinct name.");
    if (input.config.gameExperienceId) throw new Error("Package Game Experiences are unavailable in shared rooms.");
    if (
      input.config.partyCharacterIds.some((id) => !initial.policy.characterIds.includes(id)) ||
      (input.config.gmCharacterId && !initial.policy.characterIds.includes(input.config.gmCharacterId))
    ) {
      throw new Error("The Game can only use host-approved room characters.");
    }
    await runWithRoomGeneration(initial.policy, async () => {
      const status = initial.metadata.gameSessionStatus;
      if (status !== "setup" && status !== "ready" && status !== "active") {
        const config: GameSetupConfig = {
          ...input.config,
          // Rooms use Engine-owned narration and trackers. These options execute downloadable packages.
          gameWorldMapMode: "standard",
          enableSpotifyDj: false,
          enableLorebookKeeper: false,
          enableSpriteGeneration: false,
          gameStoryboardsEnabled: false,
          gameStoryboardAutoIllustrationsEnabled: false,
          gameStoryboardAutoGenerationEnabled: false,
          personaId: initial.chat.personaId ?? undefined,
        };
        await execute((output) =>
          operations.create(
            {
              chatId: input.chatId,
              name: input.gameName || initial.chat.name,
              setupConfig: {
                ...config,
                customHudWidgets: config.customHudWidgets?.map((widget) => ({
                  ...widget,
                  config: { ...widget.config },
                })),
              },
              preferences: input.preferences ?? "",
              connectionId: input.gmConnectionId ?? undefined,
            },
            output,
          ),
        );
      }
      const current = await read(input.chatId, claim, signal);
      if (current.metadata.gameSessionStatus === "setup") {
        await runWithRoomGeneration(current.policy, () =>
          execute((output) =>
            operations.setup(
              {
                chatId: input.chatId,
                preferences: input.preferences ?? "",
                connectionId: input.gmConnectionId ?? undefined,
                streaming: false,
              },
              output,
              signal,
            ),
          ),
        );
      }
      const prepared = await read(input.chatId, claim, signal);
      await withChatMetadataPatchQueue(input.chatId, () =>
        db.transaction((tx) =>
          ensureRoomHumanGameCards(
            tx,
            input.chatId,
            record(prepared.metadata.multiplayer) as unknown as MultiplayerStoredRoom,
            true, // Setup may replace cards reserved for a player admitted while its provider call was in flight.
          ),
        ),
      );
      const started = await operations.start({ chatId: input.chatId });
      if (
        started.alreadyStarted &&
        (await chats.listMessages(input.chatId)).some(
          (message) => message.role === "assistant" && message.content.trim(),
        )
      )
        return;
      await read(input.chatId, claim, signal);
      await execute((output) =>
        runner(
          {
            chatId: input.chatId,
            connectionId: input.gmConnectionId ?? null,
            generationGuide:
              "Begin the game now with the first visible GM VN narration/dialogue segment. This is an invisible startup trigger, not a player action. Do not mention a start command.",
            generationGuideSource: "game_start",
          },
          output,
          claim,
        ),
      );
    });
    await finishGameTurn(input.chatId, claim, signal);
  }
  return { runGameStart, finishGameTurn };
}
