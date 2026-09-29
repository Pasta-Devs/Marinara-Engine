import { isWithinDiceLimits, parseDiceNotation, rollParsedDice } from "@marinara-engine/shared";
import { MultiplayerError } from "./room-store.js";

/** Reuse Engine dice, with an explicit room command allowlist. No browser command dispatch or role overrides. */
export function roomPlayerCommand(input: string): {
  text: string | null;
  response: "automatic" | "manual" | "request";
} {
  if (!input.trimStart().startsWith("/")) return { text: input, response: "automatic" };
  const [, command, args = ""] = /^\s*\/(\S+)\s*([\s\S]*)$/u.exec(input) ?? [];
  if (command === "send" && args.trim()) return { text: args.trim(), response: "manual" };
  if (command === "trigger" && !args.trim()) return { text: null, response: "request" };
  if (command === "roll" || command === "r" || command === "dice") {
    const notation = args.trim() || "1d20";
    const dice = parseDiceNotation(notation);
    if (!dice || !isWithinDiceLimits(dice)) throw new MultiplayerError("invalid-message");
    const result = rollParsedDice(dice);
    return { text: `🎲 ${notation} → ${result.total} [${result.rolls.join(", ")}]`, response: "manual" };
  }
  throw new MultiplayerError("restricted-command");
}
