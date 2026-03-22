// ──────────────────────────────────────────────
// Route Registration
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { chatsRoutes } from "./chats.routes.js";
import { charactersRoutes } from "./characters.routes.js";
import { lorebooksRoutes } from "./lorebooks.routes.js";
import { promptsRoutes } from "./prompts.routes.js";
import { connectionsRoutes } from "./connections.routes.js";
import { agentsRoutes } from "./agents.routes.js";
import { customToolsRoutes } from "./custom-tools.routes.js";
import { generateRoutes } from "./generate.routes.js";
import { importRoutes } from "./import.routes.js";
import { backgroundsRoutes } from "./backgrounds.routes.js";
import { avatarsRoutes } from "./avatars.routes.js";
import { characterMakerRoutes } from "./character-maker.routes.js";
import { lorebookMakerRoutes } from "./lorebook-maker.routes.js";
import { promptReviewerRoutes } from "./prompt-reviewer.routes.js";
import { spritesRoutes } from "./sprites.routes.js";
import { adminRoutes } from "./admin.routes.js";
import { regexScriptsRoutes } from "./regex-scripts.routes.js";
import { encounterRoutes } from "./encounter.routes.js";
import { sceneRoutes } from "./scene.routes.js";
import { fontsRoutes } from "./fonts.routes.js";
import { galleryRoutes } from "./gallery.routes.js";
import { spotifyAuthRoutes } from "./spotify-auth.routes.js";
import { knowledgeSourcesRoutes } from "./knowledge-sources.routes.js";
import { gifsRoutes } from "./gifs.routes.js";
import { conversationRoutes } from "./conversation.routes.js";
import { backupRoutes } from "./backup.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(chatsRoutes, { prefix: "/api/chats" });
  await app.register(charactersRoutes, { prefix: "/api/characters" });
  await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
  await app.register(promptsRoutes, { prefix: "/api/prompts" });
  await app.register(connectionsRoutes, { prefix: "/api/connections" });
  await app.register(agentsRoutes, { prefix: "/api/agents" });
  await app.register(customToolsRoutes, { prefix: "/api/custom-tools" });
  await app.register(generateRoutes, { prefix: "/api/generate" });
  await app.register(importRoutes, { prefix: "/api/import" });
  await app.register(backgroundsRoutes, { prefix: "/api/backgrounds" });
  await app.register(avatarsRoutes, { prefix: "/api/avatars" });
  await app.register(spritesRoutes, { prefix: "/api/sprites" });
  await app.register(characterMakerRoutes, { prefix: "/api/character-maker" });
  await app.register(lorebookMakerRoutes, { prefix: "/api/lorebook-maker" });
  await app.register(promptReviewerRoutes, { prefix: "/api/prompt-reviewer" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(regexScriptsRoutes, { prefix: "/api/regex-scripts" });
  await app.register(encounterRoutes, { prefix: "/api/encounter" });
  await app.register(sceneRoutes, { prefix: "/api/scene" });
  await app.register(fontsRoutes, { prefix: "/api/fonts" });
  await app.register(galleryRoutes, { prefix: "/api/gallery" });
  await app.register(spotifyAuthRoutes, { prefix: "/api/spotify" });
  await app.register(knowledgeSourcesRoutes, { prefix: "/api/knowledge-sources" });
  await app.register(gifsRoutes, { prefix: "/api/gifs" });
  await app.register(conversationRoutes, { prefix: "/api/conversation" });
  await app.register(backupRoutes, { prefix: "/api/backup" });
}
