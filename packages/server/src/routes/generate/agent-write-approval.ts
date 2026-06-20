import type { AgentWriteApprovalEnvelope, AgentWriteApprovalProposal } from "@marinara-engine/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readNestedEntry(update: Record<string, unknown>): Record<string, unknown> {
  return isRecord(update.entry) ? update.entry : {};
}

function readUpdateName(update: Record<string, unknown>): string {
  const nested = readNestedEntry(update);
  const raw =
    typeof update.entryName === "string"
      ? update.entryName
      : typeof update.name === "string"
        ? update.name
        : typeof nested.name === "string"
          ? nested.name
          : "";
  return raw.trim();
}

function readUpdateContent(update: Record<string, unknown>): string {
  const nested = readNestedEntry(update);
  if (typeof update.content === "string" && update.content.trim()) return update.content.trim();
  if (typeof nested.content === "string" && nested.content.trim()) return nested.content.trim();
  if (Array.isArray(update.newFacts)) {
    const facts = update.newFacts.filter((fact): fact is string => typeof fact === "string" && fact.trim().length > 0);
    if (facts.length > 0) return facts.map((fact) => `- ${fact.trim()}`).join("\n");
  }
  return "";
}

function readUpdateKeys(update: Record<string, unknown>): string[] {
  const nested = readNestedEntry(update);
  const rawKeys = Array.isArray(update.keys) ? update.keys : Array.isArray(nested.keys) ? nested.keys : [];
  const keys: string[] = [];
  for (const key of rawKeys) {
    if (typeof key !== "string") continue;
    const trimmed = key.trim();
    if (trimmed) keys.push(trimmed);
  }
  return Array.from(new Set(keys));
}

function readUpdateTag(update: Record<string, unknown>): string {
  const nested = readNestedEntry(update);
  const raw = typeof update.tag === "string" ? update.tag : typeof nested.tag === "string" ? nested.tag : "";
  return raw.trim();
}

export function agentWriteApprovalRequired(chatMeta: Record<string, unknown>): boolean {
  return chatMeta.agentWriteApprovalRequired === true;
}

export function isAgentWriteApprovalEnvelope(value: unknown): value is AgentWriteApprovalEnvelope {
  return isRecord(value) && value.requiresApproval === true && isRecord(value.approval);
}

export function formatLorebookWriteApprovalText(updates: Array<Record<string, unknown>>): string {
  return updates
    .map((update, index) => {
      const name = readUpdateName(update) || `Entry ${index + 1}`;
      const keys = readUpdateKeys(update);
      const tag = readUpdateTag(update);
      const content = readUpdateContent(update);
      return [
        `### ${name}`,
        `Keys: ${keys.join(", ")}`,
        `Tag: ${tag}`,
        "",
        content || "Add the lorebook text here.",
      ].join("\n");
    })
    .join("\n\n");
}

export function parseLorebookWriteApprovalText(text: string): Array<Record<string, unknown>> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const headingPattern = /^###\s+(.+)$/gm;
  const headings = [...trimmed.matchAll(headingPattern)];
  if (headings.length === 0) {
    return [{ action: "update", name: "Approved Agent Lore", content: trimmed, keys: [], tag: "" }];
  }

  const updates: Array<Record<string, unknown>> = [];
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index]!;
    const next = headings[index + 1];
    const name = (heading[1] ?? "").trim();
    const blockStart = (heading.index ?? 0) + heading[0].length;
    const blockEnd = next?.index ?? trimmed.length;
    const block = trimmed.slice(blockStart, blockEnd).replace(/^\r?\n/, "");
    const lines = block.split(/\r?\n/);
    const keys: string[] = [];
    let tag = "";
    let contentStart = 0;
    let sawMetadata = false;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]!;
      const keyMatch = line.match(/^Keys:\s*(.*)$/i);
      const tagMatch = line.match(/^Tag:\s*(.*)$/i);
      if (keyMatch) {
        sawMetadata = true;
        keys.push(
          ...keyMatch[1]!
            .split(",")
            .map((key) => key.trim())
            .filter(Boolean),
        );
        contentStart = lineIndex + 1;
        continue;
      }
      if (tagMatch) {
        sawMetadata = true;
        tag = tagMatch[1]!.trim();
        contentStart = lineIndex + 1;
        continue;
      }
      if (!line.trim()) {
        contentStart = lineIndex + 1;
        if (sawMetadata) break;
        continue;
      }
      break;
    }

    const content = lines.slice(contentStart).join("\n").trim();
    if (!name || !content) continue;
    updates.push({
      action: "update",
      name,
      content,
      keys: Array.from(new Set(keys)),
      tag,
    });
  }

  return updates;
}

export function buildLorebookWriteApprovalProposal(args: {
  chatId: string;
  agentType: string;
  agentName: string;
  updates: Array<Record<string, unknown>>;
  preferredTargetLorebookId: string | null;
  writableLorebookIds: string[] | null;
}): AgentWriteApprovalProposal {
  return {
    kind: "lorebook_update",
    chatId: args.chatId,
    agentType: args.agentType,
    agentName: args.agentName,
    title: `${args.agentName} Lorebook Proposal`,
    text: formatLorebookWriteApprovalText(args.updates),
    payload: {
      preferredTargetLorebookId: args.preferredTargetLorebookId,
      writableLorebookIds: args.writableLorebookIds,
      updates: args.updates,
    },
    canRegenerate: !!args.agentType,
    createdAt: new Date().toISOString(),
  };
}

export function buildSummaryWriteApprovalProposal(args: {
  chatId: string;
  agentType: string | null;
  agentName: string;
  text: string;
  payload?: Record<string, unknown>;
  canRegenerate?: boolean;
}): AgentWriteApprovalProposal {
  return {
    kind: "summary_update",
    chatId: args.chatId,
    agentType: args.agentType,
    agentName: args.agentName,
    title: `${args.agentName} Summary Proposal`,
    text: args.text,
    ...(args.payload ? { payload: args.payload } : {}),
    canRegenerate: args.canRegenerate ?? false,
    createdAt: new Date().toISOString(),
  };
}
