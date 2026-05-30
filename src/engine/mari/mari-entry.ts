export type MariMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type MariAttachment = {
  id?: string;
  name: string;
  type: string;
  size: number;
  content: string;
};

export type MariPersonaContext = {
  id?: string | null;
  name?: string | null;
  comment?: string | null;
  description?: string | null;
  personality?: string | null;
  scenario?: string | null;
  backstory?: string | null;
  appearance?: string | null;
};

export type MariEntryRequest = {
  userMessage: string;
  messages: MariMessage[];
  compactedSummary?: string | null;
  connectionId?: string | null;
  persona?: MariPersonaContext | null;
  attachments?: MariAttachment[];
};

const MARI_ACTION_ENTITIES = [
  "characters",
  "character-groups",
  "personas",
  "persona-groups",
  "lorebooks",
  "lorebook-entries",
  "prompts",
  "prompt-sections",
  "prompt-groups",
  "prompt-variables",
] as const;

export type MariActionEntity = (typeof MARI_ACTION_ENTITIES)[number];

export type MariEntryAction =
  | {
      type: "none";
      capability: "read_only" | "workspace_agent";
      reason: string;
    }
  | {
      type: "create_record";
      entity: MariActionEntity;
      draft: Record<string, unknown>;
      label?: string;
      rationale?: string;
    }
  | {
      type: "edit_record";
      entity: MariActionEntity;
      id: string;
      patch: Record<string, unknown>;
      label?: string;
      rationale?: string;
    };

const MARI_DEFAULT_ACTION_REASON =
  "Professor Mari can inspect Marinara Engine's codebase, create extension/custom-agent records, and apply exact code edits through approved workspace tools.";

const MARI_DEFAULT_ACTION: MariEntryAction = {
  type: "none",
  capability: "workspace_agent",
  reason: MARI_DEFAULT_ACTION_REASON,
};

export type MariEntryResponse = {
  content: string;
  createdAt: string;
  action: MariEntryAction;
};

export type MariGatewayResponse = Omit<MariEntryResponse, "action"> & {
  action?: unknown;
};

export type MariGateway = {
  prompt(input: MariEntryRequest): Promise<MariGatewayResponse>;
};

export async function runProfessorMariEntry(input: MariEntryRequest, gateway: MariGateway): Promise<MariEntryResponse> {
  const response = await gateway.prompt({
    ...input,
    userMessage: input.userMessage.trim(),
    messages: input.messages.slice(),
    compactedSummary: input.compactedSummary ?? null,
    attachments: input.attachments ?? [],
    connectionId: input.connectionId ?? null,
    persona: input.persona ?? null,
  });
  const content = typeof response.content === "string" ? response.content : "";
  if (!content.trim()) {
    throw new Error(
      "Professor Mari returned an empty response. Try again or select a different tool-capable connection.",
    );
  }
  return {
    ...response,
    content,
    action: normalizeMariEntryAction(response.action),
  };
}

function normalizeMariEntryAction(value: unknown): MariEntryAction {
  if (!isRecord(value)) return MARI_DEFAULT_ACTION;
  if (value.type === "none" && (value.capability === "read_only" || value.capability === "workspace_agent")) {
    return {
      type: "none",
      capability: value.capability,
      reason: typeof value.reason === "string" && value.reason.trim() ? value.reason : MARI_DEFAULT_ACTION_REASON,
    };
  }
  if (value.type === "create_record" && isMariActionEntity(value.entity) && isRecord(value.draft)) {
    return {
      type: "create_record",
      entity: value.entity,
      draft: value.draft,
      ...(typeof value.label === "string" ? { label: value.label } : {}),
      ...(typeof value.rationale === "string" ? { rationale: value.rationale } : {}),
    };
  }
  if (
    value.type === "edit_record" &&
    isMariActionEntity(value.entity) &&
    typeof value.id === "string" &&
    value.id.trim() &&
    isRecord(value.patch)
  ) {
    return {
      type: "edit_record",
      entity: value.entity,
      id: value.id,
      patch: value.patch,
      ...(typeof value.label === "string" ? { label: value.label } : {}),
      ...(typeof value.rationale === "string" ? { rationale: value.rationale } : {}),
    };
  }
  return MARI_DEFAULT_ACTION;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMariActionEntity(value: unknown): value is MariActionEntity {
  return typeof value === "string" && MARI_ACTION_ENTITIES.includes(value as MariActionEntity);
}
