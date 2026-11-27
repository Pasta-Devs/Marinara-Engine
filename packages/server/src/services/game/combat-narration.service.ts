// Battle narration: one short request per batch of blows (a round, or the turns between two of the
// player's choices), never one per blow. The built-in local model tells it when it is set up, at no
// cost; otherwise the game's scene model does, and with neither the screen uses its own free lines.
import {
  cleanCombatNarrationLine,
  type CombatNarrateResponse,
  type CombatNarrationBeat,
  type GameRouteCombatNarrateBody,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { debugJson, logDebugOverride } from "../../lib/logger.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import { withAlwaysOnThinkingHeadroom } from "../generation/agent-generation-parameters.js";
import { resolveGameConnection } from "./connection.service.js";
import { isInferenceAvailable, runShortJsonPrompt } from "../sidecar/sidecar-inference.service.js";

/** Room for one line, a little over the 30 words it is asked for. */
const TOKENS_PER_LINE = 70;

/** No model to tell it: the screen falls back to its own lines. */
export class NoCombatNarratorError extends Error {}

function languageName(code: string | undefined): string {
  if (!code) return "English";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? "English";
  } catch {
    return "English";
  }
}

function beatLine(beat: CombatNarrationBeat, index: number): string {
  const what = beat.move ? `uses ${beat.move}` : "attacks";
  const on = beat.target ? (beat.outcome === "heal" ? ` on ${beat.target}` : ` against ${beat.target}`) : "";
  const result =
    beat.outcome === "miss"
      ? "it MISSES, no harm done"
      : beat.outcome === "heal"
        ? "it heals"
        : beat.outcome === "critical"
          ? "a CRITICAL hit, devastating"
          : "it hits";
  const extras = [
    beat.element ? `element: ${beat.element}` : "",
    beat.reaction ? `sets off the reaction "${beat.reaction}"` : "",
    beat.effect === "strong"
      ? "the target is weak to it (super effective)"
      : beat.effect === "weak"
        ? "the target resists it (not very effective)"
        : beat.effect === "immune"
          ? "the target is unaffected"
          : "",
    beat.ko ? `${beat.target ?? "the target"} is DEFEATED by it` : "",
  ].filter(Boolean);
  return `${index + 1}. ${beat.actor} ${what}${on}: ${result}${extras.length ? `; ${extras.join("; ")}` : ""}.`;
}

export function buildCombatNarrationPrompt(
  beats: CombatNarrationBeat[],
  context: { language?: string; genre?: string; setting?: string },
) {
  const scene = [context.genre, context.setting].filter(Boolean).join(" — ").slice(0, 400);
  const system = [
    "You are the narrator of a turn-based battle. Each numbered beat below is one blow that already happened.",
    "For each beat write ONE vivid sentence (at most 30 words) showing how it looks and lands: motion, impact, the target's reaction.",
    "Rules:",
    "- Never write any number, damage amount, HP, dice roll, multiplier or percentage. The game shows those itself.",
    "- Keep every outcome exactly as given: a miss misses, a critical hit is devastating, a defeated target goes down.",
    "- Use the names exactly as written. Present tense, third person. No dialogue, no questions.",
    "- Draw on what the combatants and moves are known to look like.",
    `- Write in ${languageName(context.language)}.`,
    `Reply with JSON {"lines": [...]} holding exactly ${beats.length} strings, one per beat, in order.`,
  ].join("\n");
  const user = [scene ? `Setting: ${scene}` : "", "Beats:", ...beats.map(beatLine)].filter(Boolean).join("\n");
  return { system, user };
}

export function parseCombatNarration(raw: string, beats: CombatNarrationBeat[]): Array<string | null> {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let lines: unknown[] = [];
  try {
    const value = JSON.parse(text) as unknown;
    lines = Array.isArray(value)
      ? value
      : Array.isArray((value as { lines?: unknown })?.lines)
        ? (value as { lines: unknown[] }).lines
        : [];
  } catch {
    // A model that ignored the format: numbered lines, each put at its own beat's place.
    for (const line of text.split(/\n+/)) {
      const at = /^\s*(\d+)[.):]/.exec(line);
      const index = at ? Number(at[1]) - 1 : -1;
      if (index >= 0 && index < beats.length && lines[index] === undefined) lines[index] = line;
    }
  }
  return beats.map((beat, index) => cleanCombatNarrationLine(lines[index], beat));
}

function narrationSchema(count: number) {
  return {
    type: "object",
    properties: {
      lines: { type: "array", items: { type: "string" }, minItems: count, maxItems: count },
    },
    required: ["lines"],
    additionalProperties: false,
  };
}

export async function narrateCombatBeats(
  db: DB,
  input: GameRouteCombatNarrateBody,
  signal: AbortSignal,
): Promise<CombatNarrateResponse> {
  const chat = await createChatsStorage(db).getById(input.chatId);
  if (!chat) throw new Error("Chat not found");
  const meta = JSON.parse(chat.metadata || "{}") as Record<string, unknown>;
  const setup = (meta.gameSetupConfig ?? {}) as Record<string, unknown>;
  const { system, user } = buildCombatNarrationPrompt(input.beats, {
    language: input.language,
    genre: typeof setup.genre === "string" ? setup.genre : undefined,
    setting: typeof setup.setting === "string" ? setup.setting : undefined,
  });
  const debug = input.debugMode === true || isDebugAgentsEnabled();
  const maxTokens = 64 + TOKENS_PER_LINE * input.beats.length;

  if (await isInferenceAvailable()) {
    logDebugOverride(
      debug,
      "[debug/game/combat:narrate] sidecar beats=%d prompt:\n%s\n%s",
      input.beats.length,
      system,
      user,
    );
    const raw = await runShortJsonPrompt(system, user, {
      name: "battle_narration",
      schema: narrationSchema(input.beats.length),
      maxTokens,
      temperature: 0.9,
      signal,
    });
    logDebugOverride(debug, "[debug/game/combat:narrate] sidecar response=%s", raw);
    return { lines: parseCombatNarration(raw, input.beats), source: "sidecar" };
  }

  // Only a scene model the player chose: the Game Master's own model is never spent on this.
  const sceneConnectionId =
    (typeof meta.gameSceneConnectionId === "string" && meta.gameSceneConnectionId) ||
    (typeof setup.sceneConnectionId === "string" && setup.sceneConnectionId) ||
    null;
  const connections = createConnectionsStorage(db);
  // A scene model that is gone or blocked is no scene model: never let the resolver fall back to Main.
  if (!sceneConnectionId || (sceneConnectionId !== "random" && !(await connections.getWithKey(sceneConnectionId))))
    throw new NoCombatNarratorError("No local model or scene model is set up.");
  const { conn, baseUrl } = await resolveGameConnection(connections, sceneConnectionId, chat);
  const provider = createLLMProvider(
    conn.provider,
    baseUrl,
    conn.apiKey,
    conn.maxContext,
    conn.openrouterProvider,
    conn.maxTokensOverride,
    conn.claudeFastMode === "true",
    conn.treatAsLocalEndpoint === "true",
    conn.defaultParameters,
    conn.id,
  );
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  logDebugOverride(debug, "[debug/game/combat:narrate] model=%s prompt:\n%s", conn.model, debugJson(messages));
  const stored = resolveStoredChatOptions(conn.defaultParameters, conn.provider, conn.model);
  const response = await provider.chatComplete(messages, {
    model: conn.model,
    ...stored,
    temperature: stored.temperature ?? 0.9,
    enableThinking: !!stored.reasoningEffort && stored.reasoningEffort !== "none",
    maxTokens: withAlwaysOnThinkingHeadroom({
      provider: conn.provider,
      model: conn.model,
      maxTokens: maxTokens,
      reasoningEffort: stored.reasoningEffort,
      maxTokensOverride: conn.maxTokensOverride,
    }),
    responseFormat: { type: "json_object" },
    signal,
  });
  logDebugOverride(debug, "[debug/game/combat:narrate] response=%s", response.content);
  return { lines: parseCombatNarration(response.content ?? "", input.beats), source: "connection" };
}
