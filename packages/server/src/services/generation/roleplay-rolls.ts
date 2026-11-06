import {
  isRoleplayCommandAllowed,
  isRoleplayCommandEnabled,
  parseDicePool,
  type LLMToolDefinition,
  type RoleplayCommandActivity,
  type RPGStatsConfig,
} from "@marinara-engine/shared";
import { normalizeCharacterLookupName } from "../game/name-normalization.js";
import { attributeModifier, mapSheetAttributesToRPG } from "../game/skill-check.service.js";
import type { LLMToolCall } from "../llm/base-provider.js";
import { formatToolExecutionResultForModel, type ToolExecutionResult } from "../tools/tool-executor.js";
import { parseRoleplayCommands } from "./roleplay-commands.js";

/** Resolve a participant's assigned attribute without guessing another character or stat. */
export function prepareRoleplayRoll(
  args: Record<string, unknown>,
  characters: readonly { id: string; name: string; rpgStats?: RPGStatsConfig }[],
  fallbackCharacterId: string | null,
): Record<string, unknown> {
  if (args.character !== undefined && typeof args.character !== "string")
    throw new Error("The roll character must be a participant name.");
  const requested = typeof args.character === "string" ? args.character.trim() : "";
  const matches = requested
    ? characters.filter(
        (character) =>
          character.id === requested ||
          normalizeCharacterLookupName(character.name) === normalizeCharacterLookupName(requested),
      )
    : characters.filter((character) => character.id === fallbackCharacterId);
  if (requested && matches.length !== 1) throw new Error(`The roll must name one chat participant: ${requested}`);
  const character = matches[0];
  const attribute = typeof args.attribute === "string" ? args.attribute.trim() : "";
  const parsed = typeof args.notation === "string" ? parseDicePool(args.notation) : null;
  if (!parsed || !character) return args;
  const stats = character.rpgStats;
  let bonus = 0;
  if (stats?.enabled && attribute) {
    const exact = stats.attributes.find((item) => item.name.trim().toLowerCase() === attribute.toLowerCase());
    // This mapper omits unrecognized names; an unknown attribute must not pick a default stat.
    const canonical = Object.keys(mapSheetAttributesToRPG([{ name: attribute, value: 0 }]))[0];
    const score =
      exact?.value ??
      (canonical
        ? mapSheetAttributesToRPG(stats.attributes)[canonical as keyof ReturnType<typeof mapSheetAttributesToRPG>]
        : undefined);
    if (typeof score === "number" && Number.isFinite(score)) bonus = attributeModifier(score);
  }
  const modifier = parsed.modifier + bonus;
  const notation = bonus ? `${parsed.dice}${modifier > 0 ? "+" : ""}${modifier || ""}` : parsed.notation;
  if (!parseDicePool(notation)) throw new Error("The attribute-adjusted roll exceeds the supported numeric range.");
  return {
    ...args,
    character: character.name,
    notation,
    reason: [character.name, attribute, typeof args.reason === "string" ? args.reason : ""].filter(Boolean).join(" · "),
  };
}

/**
 * While the Rolls command is on, it decides who may roll. Otherwise a roll_dice the
 * chat's Function Calling settings attached is offered and run the same way (#6945).
 */
export function isRoleplayRollEnabled(input: {
  chatMode: string;
  impersonate: boolean | undefined;
  chatMeta: Record<string, unknown>;
  callerId: string | null;
  resolvedToolNames: ReadonlySet<string>;
}): boolean {
  return (
    input.chatMode === "roleplay" &&
    !input.impersonate &&
    (isRoleplayCommandEnabled(input.chatMeta, "roll")
      ? isRoleplayCommandAllowed(input.chatMeta, "roll", input.callerId)
      : input.resolvedToolNames.has("roll_dice"))
  );
}

/** Lets a roleplay roll_dice name the participant who rolls and the attribute it uses. */
export function withRoleplayRollSchema(
  toolDefs: LLMToolDefinition[] | undefined,
  participants: readonly { name: string }[],
): LLMToolDefinition[] | undefined {
  return toolDefs?.map((tool) =>
    tool.function.name !== "roll_dice"
      ? tool
      : {
          ...tool,
          function: {
            ...tool.function,
            parameters: {
              ...tool.function.parameters,
              properties: {
                ...(tool.function.parameters.properties as Record<string, unknown>),
                character: {
                  type: "string",
                  enum: participants.map((character) => character.name),
                  description: "The chat participant whose action is being rolled.",
                },
                attribute: {
                  type: "string",
                  description:
                    "Optional assigned RPG attribute, such as Strength or STR. The engine adds its modifier; do not include that bonus in notation.",
                },
              },
              required: [...((tool.function.parameters.required as string[]) ?? []), "character"],
            },
          },
        },
  );
}

/**
 * A `[roll:]` the model wrote as text, as the roll_dice call it stands for. The reply keeps
 * the raw command up to `end`; the model is sent only the prose before `start`.
 */
export function textualRollToolCall(
  content: string,
  newId: () => string,
): { start: number; end: number; promptContent: string; call: LLMToolCall } | null {
  const requestedRoll = parseRoleplayCommands(content).roll;
  if (!requestedRoll) return null;
  return {
    start: requestedRoll.start,
    end: requestedRoll.end,
    promptContent: content.slice(0, requestedRoll.start),
    call: {
      id: newId(),
      type: "function" as const,
      function: {
        name: "roll_dice",
        arguments: JSON.stringify({
          notation: requestedRoll.command.notation,
          reason: requestedRoll.command.reason,
          character: requestedRoll.command.character,
          attribute: requestedRoll.command.attribute,
          modifier: requestedRoll.command.modifier,
          dc: requestedRoll.command.dc,
        }),
      },
    },
  };
}

/** The roll activity entry for a roleplay roll_dice result; `raw` defaults to the native call. */
export function rollActivityFromToolResult(
  call: LLMToolCall,
  tr: ToolExecutionResult,
  raw: string | undefined,
): RoleplayCommandActivity {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    /* The tool result reports invalid input. */
  }
  return {
    command: {
      type: "roll",
      notation: String(args?.notation ?? ""),
      reason: String(args?.reason ?? ""),
      ...(typeof args?.character === "string" ? { character: args.character } : {}),
      ...(typeof args?.attribute === "string" ? { attribute: args.attribute } : {}),
      ...(typeof args?.modifier === "number" ? { modifier: args.modifier } : {}),
      ...(typeof args?.dc === "number" ? { dc: args.dc } : {}),
    },
    raw: raw ?? `roll_dice(${call.function.arguments})`,
    ...(!tr.success ? { error: tr.result } : {}),
    ...(tr.success ? { result: tr.result } : {}),
  };
}

/** A textual roll's result, sent back as a user message (the assistant turn has no tool_calls). */
export function rollResultFollowUp(tr: ToolExecutionResult, isLastRound: boolean): string {
  return `The engine resolved your roll request:\n${formatToolExecutionResultForModel(tr)}\nContinue the same reply from the interruption. Use this result; do not repeat the preceding narration or reroll this action.${isLastRound ? " No further rolls are available this turn." : ""}`;
}

/** The final follow-up may not roll: the content before its first `[roll:]`, or null without one. */
export function cutPendingRoll(content: string): string | null {
  const pendingRoll = parseRoleplayCommands(content).roll;
  return pendingRoll ? content.slice(0, pendingRoll.start) : null;
}
