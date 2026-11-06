// ──────────────────────────────────────────────
// Roleplay [html] command: one in-world artifact, made by a call of its own
// ──────────────────────────────────────────────
import {
  DEFAULT_AGENT_MAX_TOKENS,
  getRoleplayCommandActivity,
  getRoleplayCommandContentOffset,
  parseAgentSettingsRecord,
  type RoleplayCommandActivity,
} from "@marinara-engine/shared";
import { getChatGenerationTimeoutMs, isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { conversationPromptHistoryContent } from "../../routes/generate/conversation-prompt-formatting.js";
import { isMessageHiddenFromAIForCharacter } from "../../routes/generate/generate-route-utils.js";
import { normalizeAgentContextSize } from "../agents/agent-executor.js";
import { normalizeAgentMaxParallelJobs } from "../agents/agent-pipeline.js";
import { withLlmRequestTimeout, type ChatMessage } from "../llm/base-provider.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "./generation-parameters.js";
import { resolveModelAccessPolicy } from "./model-access-policy.js";
import { parseExtra } from "./prompt-attachments.js";
import { clampGenerationMaxOutputTokens } from "./output-token-limits.js";
import { resolveBaseUrl } from "./connection-base-url.js";

/** One reply can ask for this many artifacts; the rest get a visible error instead of a paid call. */
export const HTML_ARTIFACT_LIMIT_PER_REPLY = 3;
export const HTML_ARTIFACT_LIMIT_ERROR = "roleplay.commands.html.limit";
const HTML_ARTIFACT_MEMORY_MAX_CHARS = 1_000;
const HTML_ARTIFACT_MAX_CHARS = 100_000;
const HTML_ARTIFACT_MAX_TOKENS = Math.max(DEFAULT_AGENT_MAX_TOKENS, 8_192);
const HTML_ARTIFACT_CHARACTER_MAX_CHARS = 4_000;

const HTML_ARTIFACT_SYSTEM_PROMPT = `You make one in-world visual artifact for a roleplay scene: a spellbook page, a sign, a letter with a sketch, a terminal readout. The artifact is shown inside the reply, at the place marked [ARTIFACT GOES HERE].

Answer with exactly these two blocks and nothing else:
<artifact>
The artifact as HTML with inline CSS, a <style> block or inline SVG.
</artifact>
<memory>
Plain text the narrator will remember in later turns: every piece of readable text in the artifact, word for word, then one short line on how it looks. Start straight with that text, with no label. Keep it under ${HTML_ARTIFACT_MEMORY_MAX_CHARS} characters.
</memory>

Rules for the artifact:
- Make what the request asks for, and match the scene's setting, tone and language.
- It belongs to the story: no captions about the artifact, no out-of-character text.
- Do not repeat or rewrite the reply's narration.
- No <script>, no event handlers, no external images, fonts or links.
- Draw pictures with inline SVG. Give each <svg> a viewBox and use only these elements: g, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, defs, linearGradient, radialGradient, stop, clipPath. Anything else is removed, including use, image, filter, mask, pattern, foreignObject and animation.
- Set gradients and clip paths with attributes, such as fill="url(#paper)". They do not work from CSS.
- It is shown at most about 450px wide, and narrower on phones, so it must fit the available width: no fixed widths wider than 100%, no fixed or sticky positioning. Keep it compact: about 340px tall at most, unless the request needs a long page.
- Set its own background and text colours, so it reads on both light and dark themes.`;

export interface HtmlArtifact {
  html: string;
  memory: string;
}

/**
 * Read the model's two blocks. A missing </artifact> means the output was cut off, so nothing partial is shown; a
 * missing <memory> leaves the narrator with its own request, which is still true of what it asked for.
 */
export function parseHtmlArtifactOutput(raw: string, request: string): HtmlArtifact | null {
  const open = /<artifact\b[^>]*>/iu.exec(raw);
  if (!open) return null;
  const start = open.index + open[0].length;
  const close = [...raw.matchAll(/<\/artifact>/giu)].at(-1)?.index ?? -1;
  if (close < start) return null;
  const html = raw
    .slice(start, close)
    .trim()
    .replace(/^```[a-z]*\s*\n/iu, "")
    .replace(/\n?```$/u, "")
    .trim();
  if (!html || html.length > HTML_ARTIFACT_MAX_CHARS) return null;
  const memory = /<memory\b[^>]*>([\s\S]*?)(?:<\/memory>|$)/iu.exec(`${raw.slice(0, open.index)}\n${raw.slice(close)}`);
  // The narrator's prompt adds its own "Artifact:" label.
  const text = memory?.[1]?.trim().replace(/^artifact\s*:\s*/iu, "");
  return { html, memory: (text || request).slice(0, HTML_ARTIFACT_MEMORY_MAX_CHARS) };
}

export function buildHtmlArtifactMessages(args: {
  reply: string;
  offset: number;
  request: string;
  scene?: string;
  referenceContext?: string;
}): ChatMessage[] {
  const placed = `${args.reply.slice(0, args.offset)}\n[ARTIFACT GOES HERE]\n${args.reply.slice(args.offset)}`;
  return [
    { role: "system", content: HTML_ARTIFACT_SYSTEM_PROMPT, contextKind: "prompt" },
    {
      role: "user",
      content: [
        args.referenceContext?.trim() ?? "",
        args.scene?.trim() ?? "",
        `<reply>\n${placed}\n</reply>`,
        `<request>\n${args.request}\n</request>`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      contextKind: "prompt",
    },
  ];
}

/** Immersive HTML's own connection, else the default agent connection, else the chat's. */
async function resolveHtmlArtifactConnections(db: DB, chatConnectionId: string | null) {
  const connections = createConnectionsStorage(db);
  const agent = await createAgentsStorage(db).getByType("html");
  const primary =
    (agent?.connectionId ? await connections.getWithKey(agent.connectionId) : null) ??
    (await connections.getDefaultForAgents()) ??
    (chatConnectionId ? await connections.getWithKey(chatConnectionId) : null);
  return { primary, fallback: await connections.getFallbackForAgents() };
}

type HtmlArtifactDebugLog = (message: string, ...args: unknown[]) => void;

/**
 * How many artifacts one connection makes at once: its Max Parallel Agent Jobs, as for agent batches. A failed lookup
 * means one at a time, so the reply's other commands still run and the artifact's own run reports the failure.
 */
export async function resolveHtmlArtifactMaxParallelJobs(db: DB, chatConnectionId: string | null): Promise<number> {
  try {
    const { primary } = await resolveHtmlArtifactConnections(db, chatConnectionId);
    return normalizeAgentMaxParallelJobs(primary?.maxParallelJobs);
  } catch (error) {
    logger.warn(error, "[roleplay/commands] Could not read the artifact connection's parallel job limit");
    return 1;
  }
}

/**
 * Who is speaking and what led here, read from the saved chat so the narrator's command and /html see the same thing.
 * The messages go through the narrator's own history formatting, so whispers stay private and earlier artifacts appear
 * as their memory, not their markup.
 */
async function buildHtmlArtifactScene(db: DB, messageId: string): Promise<string> {
  const chats = createChatsStorage(db);
  const message = await chats.getMessage(messageId);
  if (!message) return "";
  const rows = await chats.listMessages(message.chatId);
  const index = rows.findIndex((row) => row.id === messageId);
  const start = rows
    .slice(0, Math.max(index, 0))
    .map((row, rowIndex) => (parseExtra(row.extra).isConversationStart ? rowIndex : 0))
    .reduce((latest, rowIndex) => Math.max(latest, rowIndex), 0);
  const agent = await createAgentsStorage(db).getByType("html");
  const recent = rows
    .slice(start, Math.max(index, 0))
    .filter((row) => !isMessageHiddenFromAIForCharacter(row, message.characterId))
    .slice(-normalizeAgentContextSize(parseAgentSettingsRecord(agent?.settings).contextSize));

  const characters = createCharactersStorage(db);
  const cards = new Map<string, { name: string; description: string }>();
  for (const id of new Set([message.characterId, ...recent.map((row) => row.characterId)])) {
    if (!id) continue;
    const row = await characters.getById(id, message.chatId);
    if (!row) continue;
    const data = parseExtra(row.data);
    const extensions = parseExtra(data.extensions);
    cards.set(id, {
      name: typeof data.name === "string" && data.name ? data.name : "Character",
      description: [data.description, extensions.appearance]
        .filter((text): text is string => typeof text === "string" && !!text.trim())
        .join("\n")
        .slice(0, HTML_ARTIFACT_CHARACTER_MAX_CHARS),
    });
  }

  const speaker = message.characterId ? cards.get(message.characterId) : undefined;
  const history = recent
    .map((row) => {
      const content = conversationPromptHistoryContent(row, "roleplay").trim();
      if (!content) return "";
      const name =
        row.role === "user" ? "Player" : ((row.characterId && cards.get(row.characterId)?.name) ?? "Narrator");
      return `${name}: ${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
  return [
    speaker ? `<speaker>\nName: ${speaker.name}\n${speaker.description}\n</speaker>` : "",
    history ? `<recent_messages>\n${history}\n</recent_messages>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function writeHtmlArtifact(
  db: DB,
  chatConnectionId: string | null,
  messages: ChatMessage[],
  debugLog: HtmlArtifactDebugLog,
  signal?: AbortSignal,
): Promise<string> {
  const { primary: connection, fallback } = await resolveHtmlArtifactConnections(db, chatConnectionId);
  if (!connection) throw new Error("No connection can make this artifact. Set a default agent connection.");
  const baseUrl = resolveBaseUrl(connection);
  if (!baseUrl) throw new Error("The artifact's connection has no base URL.");
  const provider = withConnectionFallbackProvider({
    primary: createLLMProvider(
      connection.provider,
      baseUrl,
      connection.apiKey,
      connection.maxContext,
      connection.openrouterProvider,
      connection.maxTokensOverride,
      connection.claudeFastMode === "true",
      connection.treatAsLocalEndpoint === "true",
      connection.defaultParameters,
    ),
    primaryConnectionId: connection.id,
    fallbackConnection: fallback,
    fallbackBaseUrl: fallback ? resolveBaseUrl(fallback) : "",
    category: "agents",
  });
  const policy = resolveModelAccessPolicy({
    provider: connection.provider,
    model: connection.model,
    maxContext: connection.maxContext,
  });
  const defaults = resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model);
  debugLog(
    "[html-artifact] request (%s):\n%s",
    connection.model,
    messages.map((message) => `[${message.role}] ${message.content}`).join("\n\n"),
  );
  const result = await withLlmRequestTimeout(getChatGenerationTimeoutMs(), () =>
    provider.chatComplete(messages, {
      model: connection.model,
      ...(policy.suppressModelParameters
        ? {}
        : {
            ...defaults,
            maxTokens: clampGenerationMaxOutputTokens({
              provider: connection.provider,
              model: connection.model,
              maxTokens: resolveStoredMaxTokens(connection.defaultParameters, HTML_ARTIFACT_MAX_TOKENS),
              maxTokensOverride: connection.maxTokensOverride,
            }),
            maxContext: policy.effectiveMaxContext,
          }),
      suppressModelParameters: policy.suppressModelParameters,
      stream: false,
      signal,
    }),
  );
  debugLog("[html-artifact] response (%d chars):\n%s", result.content?.length ?? 0, result.content ?? "");
  return result.content ?? "";
}

/**
 * Make the artifact for one saved [html] activity and save it on that activity. A failure is saved there too, so the
 * marker says why. Returns the error, or null. The activity array is rewritten whole, so the storage call serializes
 * this write with anything else changing the message's extra.
 */
export async function runHtmlArtifactCommand(args: {
  db: DB;
  messageId: string;
  swipeIndex: number;
  activityIndex: number;
  request: string;
  chatConnectionId: string | null;
  referenceContext?: string;
  debugLog?: HtmlArtifactDebugLog;
  signal?: AbortSignal;
}): Promise<string | null> {
  const chats = createChatsStorage(args.db);
  const isThisRequest = (item: RoleplayCommandActivity | undefined) =>
    item?.command.type === "html" && item.command.prompt === args.request;
  const isThisCommand = (item: RoleplayCommandActivity | undefined) => isThisRequest(item) && !item?.deleted;
  const readSwipe = async () => (await chats.getSwipes(args.messageId)).find((row) => row.index === args.swipeIndex);
  const activityOf = (swipe: Awaited<ReturnType<typeof readSwipe>>) =>
    getRoleplayCommandActivity(parseExtra(swipe?.extra));
  const save = (patch: Partial<RoleplayCommandActivity>) =>
    chats.patchRoleplayCommandActivity(args.messageId, args.swipeIndex, (activity) =>
      isThisCommand(activity[args.activityIndex])
        ? activity.map((item, index) => (index === args.activityIndex ? { ...item, ...patch } : item))
        : null,
    );
  try {
    const swipe = await readSwipe();
    const item = activityOf(swipe)[args.activityIndex];
    if (!swipe || !item || !isThisCommand(item)) return null;
    const raw = await writeHtmlArtifact(
      args.db,
      args.chatConnectionId,
      buildHtmlArtifactMessages({
        reply: swipe.content,
        offset: getRoleplayCommandContentOffset(swipe.content, item),
        request: args.request,
        scene: await buildHtmlArtifactScene(args.db, args.messageId),
        referenceContext: args.referenceContext,
      }),
      args.debugLog ?? ((message, ...rest) => logDebugOverride(isDebugAgentsEnabled(), message, ...rest)),
      args.signal,
    );
    const artifact = parseHtmlArtifactOutput(raw, args.request);
    if (!artifact) throw new Error("The model did not finish the artifact. A higher max tokens setting may help.");
    if (!(await save({ artifact, error: undefined }))) {
      const current = activityOf(await readSwipe())[args.activityIndex];
      // A player deleting this marker meant to drop the result. Anything else lost it, so the caller has to hear.
      if (isThisRequest(current) && current?.deleted) return null;
      throw new Error("The message's commands changed while the artifact was being made, so it was not saved.");
    }
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The artifact could not be made.";
    if (!args.signal?.aborted) logger.warn(error, "[roleplay/commands] HTML artifact failed");
    await save({ error: message }).catch(() => undefined);
    return message;
  }
}
