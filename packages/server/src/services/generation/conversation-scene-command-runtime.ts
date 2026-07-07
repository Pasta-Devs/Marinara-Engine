import type { FastifyInstance } from "fastify";

import { logger } from "../../lib/logger.js";
import type { CharacterCommand, SceneCommand } from "../conversation/character-commands.js";

type ChatsStore = {
  getById(id: string): Promise<{ id?: string; characterIds?: unknown } | null>;
};

type CharactersStore = {
  getById(id: string): Promise<{ data: unknown } | null>;
};

export async function handleConversationSceneCommand(args: {
  command: CharacterCommand;
  characterId: string | null;
  chatId: string;
  app: FastifyInstance;
  chars: CharactersStore;
  chats: ChatsStore;
  sendSceneCreated: (data: Record<string, unknown>) => void;
}): Promise<boolean> {
  if (args.command.type !== "scene") return false;
  const command = args.command as SceneCommand;

  try {
    const originChat = await args.chats.getById(args.chatId);
    if (!originChat) throw new Error("Origin chat not found");

    const initiatorRow = args.characterId ? await args.chars.getById(args.characterId) : null;
    const initiatorData = parseRecord(initiatorRow?.data);
    const initiatorName =
      typeof initiatorData?.name === "string" && initiatorData.name.trim() ? initiatorData.name : "Character";

    const planRes = await args.app.inject({
      method: "POST",
      url: "/api/scene/plan",
      payload: {
        chatId: args.chatId,
        prompt: command.scenario,
        connectionId: null,
      },
    });
    const planBody = JSON.parse(planRes.body);
    if (!planBody.plan) throw new Error("Scene plan failed");

    if (command.background) {
      planBody.plan.background = command.background;
    }

    const createRes = await args.app.inject({
      method: "POST",
      url: "/api/scene/create",
      payload: {
        originChatId: args.chatId,
        initiatorCharId: args.characterId,
        plan: planBody.plan,
        connectionId: null,
      },
    });
    const createBody = JSON.parse(createRes.body);

    if (createBody.chatId) {
      args.sendSceneCreated({
        sceneChatId: createBody.chatId,
        sceneChatName: createBody.chatName,
        description: createBody.description,
        background: createBody.background ?? null,
        initiatorCharId: args.characterId,
        initiatorCharName: initiatorName,
      });
      logger.info(
        '[commands] Scene created: "%s" (%s) from chat %s',
        createBody.chatName,
        createBody.chatId,
        args.chatId,
      );
    } else {
      logger.warn("[commands] Scene create returned no chatId for chat %s: %j", args.chatId, createBody);
    }
  } catch (err) {
    logger.error(err, "[commands] Scene creation failed");
  }

  return true;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
