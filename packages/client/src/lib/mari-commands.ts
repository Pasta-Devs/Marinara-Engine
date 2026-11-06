// The commands Professor Mari's composer offers, in one list read by both doors: the `/` picker and the
// paperclip menu. The handlers live in `HomeProfessorMariChat`; this file only names, ranks and words them.
import {
  Brain,
  ClipboardCheck,
  History,
  Layers,
  Link,
  Paperclip,
  ShieldCheck,
  SquarePen,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { ActiveComposerToken } from "./composer-triggers";
import { scoreOmnibarText } from "./omnibar-search";

export type MariCommandId =
  "new" | "history" | "skills" | "memories" | "context" | "attach" | "model" | "permissions" | "approvals";

export type MariCommand = {
  id: MariCommandId;
  /** Other words that find the command (`/clear` finds New chat). */
  aliases: readonly string[];
  Icon: LucideIcon;
  labelKey: string;
  factKey: string;
};

export const MARI_COMMANDS: readonly MariCommand[] = [
  {
    id: "new",
    aliases: ["clear", "reset", "restart"],
    Icon: SquarePen,
    labelKey: "mari.composerCommands.new.label",
    factKey: "mari.composerCommands.new.fact",
  },
  {
    id: "history",
    aliases: ["chats", "past"],
    Icon: History,
    labelKey: "mari.composerCommands.history.label",
    factKey: "mari.composerCommands.history.fact",
  },
  {
    id: "skills",
    aliases: [],
    Icon: Wand2,
    labelKey: "mari.composerCommands.skills.label",
    factKey: "mari.composerCommands.skills.fact",
  },
  {
    id: "memories",
    aliases: [],
    Icon: Brain,
    labelKey: "mari.composerCommands.memories.label",
    factKey: "mari.composerCommands.memories.fact",
  },
  {
    id: "context",
    aliases: ["attached"],
    Icon: Layers,
    labelKey: "mari.composerCommands.context.label",
    factKey: "mari.composerCommands.context.fact",
  },
  {
    id: "attach",
    aliases: ["file", "upload", "photo"],
    Icon: Paperclip,
    labelKey: "mari.composerCommands.attach.label",
    factKey: "mari.composerCommands.attach.fact",
  },
  {
    id: "model",
    aliases: ["connection", "provider"],
    Icon: Link,
    labelKey: "mari.composerCommands.model.label",
    factKey: "mari.composerCommands.model.fact",
  },
  {
    id: "permissions",
    aliases: ["mode"],
    Icon: ShieldCheck,
    labelKey: "mari.composerCommands.permissions.label",
    factKey: "mari.composerCommands.permissions.fact",
  },
  {
    id: "approvals",
    aliases: ["review", "pending"],
    Icon: ClipboardCheck,
    labelKey: "mari.composerCommands.approvals.label",
    factKey: "mari.composerCommands.approvals.fact",
  },
];

const COMMAND_BY_ID = new Map(MARI_COMMANDS.map((command) => [command.id, command]));

export function getMariCommand(id: MariCommandId): MariCommand {
  return COMMAND_BY_ID.get(id)!;
}

export type RankedMariCommand = MariCommand & { score: number };

/** The available commands whose id or an alias matches the query, best match first, list order on ties. */
export function rankCommands(query: string, available: readonly MariCommandId[]): RankedMariCommand[] {
  const scored: Array<RankedMariCommand & { index: number }> = [];
  MARI_COMMANDS.forEach((command, index) => {
    if (!available.includes(command.id)) return;
    const score = query.trim() ? scoreOmnibarText(query, [command.id, ...command.aliases]) : 0;
    if (score >= 0) scored.push({ ...command, score, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map(({ index: _index, ...rest }) => rest);
}

/** The draft with the live `/query` token cut out, and the caret where it was. */
export function removeCommandToken(
  draft: string,
  token: Pick<ActiveComposerToken, "start" | "end">,
): { value: string; caret: number } {
  return { value: draft.slice(0, token.start) + draft.slice(token.end), caret: token.start };
}
