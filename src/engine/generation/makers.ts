import type { LlmGateway, LlmMessage } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { parseGameJsonish } from "../shared/parsing-jsonish";

type LorebookMakerEntry = {
  name?: string;
  content?: string;
  keys?: string[];
  secondary_keys?: string[];
  secondaryKeys?: string[];
  tag?: string;
  constant?: boolean;
  order?: number;
  enabled?: boolean;
};

type LorebookMakerData = {
  lorebook_name?: string;
  lorebook_description?: string;
  category?: string;
  entries?: LorebookMakerEntry[];
};

export type MakerEvent =
  | { type: "token"; data: string }
  | {
      type: "batch_start";
      data: {
        batch: number;
        totalBatches: number;
        batchSize: number;
        entriesSoFar: number;
        totalEntries: number;
      };
    }
  | {
      type: "batch_done";
      data: {
        batch: number;
        totalBatches: number;
        batchEntryCount: number;
        totalEntriesSoFar: number;
      };
    }
  | { type: "batch_warning"; data: { batch: number; message: string } }
  | { type: "saved"; data: { count: number; lorebookId: string } }
  | { type: "error"; data: string }
  | { type: "done"; data: string };

export type MakerCapabilities = {
  llm: LlmGateway;
  storage?: StorageGateway;
};

export type CharacterOrPersonaMakerInput = {
  prompt: string;
  connectionId: string;
  streaming?: boolean;
  referenceTags?: string[];
  nameHint?: string;
  preserveNameSpelling?: boolean;
  declensionHint?: string;
};

export type LorebookMakerInput = CharacterOrPersonaMakerInput & {
  entryCount?: number;
  lorebookId?: string;
};

const CHARACTER_SYSTEM_PROMPT = `You are a creative character designer for roleplay and fiction. Given a short description or concept, generate a complete character card in JSON format.

Return ONLY valid JSON with these fields:
{
  "name": "Character's full name",
  "description": "Rich, detailed character description (2-4 paragraphs). Include personality, motivations, mannerisms, speech patterns.",
  "personality": "Concise personality summary - key traits, temperament, quirks (1-2 sentences).",
  "scenario": "A default scenario/setting the character lives in or where interactions take place.",
  "first_mes": "The character's opening message/greeting when meeting someone new. Write in-character, 1-3 paragraphs. Use *asterisks* for actions.",
  "mes_example": "2-3 example dialogue exchanges. Format: <START>\\n{{user}}: message\\n{{char}}: reply",
  "creator_notes": "Brief note about the character concept and intended use.",
  "system_prompt": "A system prompt that guides the AI to roleplay this character accurately.",
  "post_history_instructions": "",
  "tags": ["tag1", "tag2", "tag3"],
  "backstory": "The character's history, origin, and key life events (2-3 paragraphs).",
  "appearance": "Detailed physical description - height, build, hair, eyes, clothing, distinguishing features."
}

Be creative, detailed, and consistent. Make the character feel alive and three-dimensional.`;

const PERSONA_SYSTEM_PROMPT = `You are a creative persona designer for roleplay and fiction. Given a short description or concept, generate a complete user persona in JSON format. A persona represents the user's in-world identity - the character they play as.

Return ONLY valid JSON with these fields:
{
  "name": "The persona's name",
  "description": "A rich description of who this persona is - their identity, role, motivations, and how others perceive them (1-3 paragraphs).",
  "personality": "Concise personality summary - key traits, temperament, mannerisms, quirks (1-2 sentences).",
  "scenario": "The default scenario or setting this persona inhabits.",
  "backstory": "The persona's history, origin story, and formative events (2-3 paragraphs).",
  "appearance": "Detailed physical description - height, build, hair, eyes, clothing, distinguishing features."
}

Be creative, detailed, and consistent. Make the persona feel like a real person the user would enjoy embodying.`;

const LOREBOOK_SYSTEM_PROMPT = `You are a world-building assistant for roleplay and fiction. Given a topic or concept, generate a set of lorebook entries that flesh out the world. Each entry should activate when relevant keywords appear in conversation.

Return ONLY valid JSON - an object with these fields:
{
  "lorebook_name": "Short descriptive name for this lorebook",
  "lorebook_description": "One paragraph overview of what this lorebook covers",
  "category": "world" | "character" | "npc" | "uncategorized",
  "entries": [
    {
      "name": "Entry title",
      "content": "The lore content that gets injected into context. Be detailed, 1-3 paragraphs. Write in a neutral, encyclopedic style suitable for an AI to reference.",
      "keys": ["keyword1", "keyword2"],
      "secondary_keys": [],
      "tag": "optional tag like 'location', 'item', 'faction', 'history', 'magic'",
      "constant": false,
      "order": 100
    }
  ]
}

Guidelines:
- Each entry should have 2-5 relevant keywords that would naturally appear in RP conversation
- Content should be written as world-info - facts, descriptions, rules - not dialogue
- Make entries self-contained but interconnected
- Vary the tags across entries
- Set "constant": true only for the most fundamental world rules
- Use increasing order values (100, 200, 300...) so entries inject in logical order`;

const LOREBOOK_BATCH_SIZE = 15;

function buildCharacterMakerPrompt(input: CharacterOrPersonaMakerInput): string {
  const lines = [`Create a character based on: ${input.prompt}`];
  const referenceTags = (input.referenceTags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const nameHint = input.nameHint?.trim();
  const declensionHint = input.declensionHint?.trim();

  if (referenceTags.length > 0) {
    lines.push("", `Reference tags to use as creative constraints: ${referenceTags.join(", ")}`);
    lines.push("Reflect these tags in the generated character and output tags when they fit the concept.");
  }

  if (nameHint) {
    lines.push("", `Preferred character name spelling: ${nameHint}`);
    lines.push("Preserve that spelling exactly, including doubled letters, accents, capitalization, and spacing.");
  } else if (input.preserveNameSpelling) {
    lines.push("", "If the concept includes a character name, preserve its spelling exactly.");
  }

  if (declensionHint) {
    lines.push("", `Name declension / grammar note: ${declensionHint}`);
    lines.push(
      "Keep the base name stable in the JSON name field and only use declined forms where grammatically needed in prose.",
    );
  }

  return lines.join("\n");
}

export async function* generateCharacterMaker(
  capabilities: MakerCapabilities,
  input: CharacterOrPersonaMakerInput,
  signal?: AbortSignal,
): AsyncGenerator<MakerEvent> {
  yield* generateJsonMaker(
    capabilities,
    input,
    {
      systemPrompt: CHARACTER_SYSTEM_PROMPT,
      userPrompt: buildCharacterMakerPrompt(input),
      maxTokens: 8192,
    },
    signal,
  );
}

export async function* generatePersonaMaker(
  capabilities: MakerCapabilities,
  input: CharacterOrPersonaMakerInput,
  signal?: AbortSignal,
): AsyncGenerator<MakerEvent> {
  yield* generateJsonMaker(
    capabilities,
    input,
    {
      systemPrompt: PERSONA_SYSTEM_PROMPT,
      userPrompt: `Create a persona based on: ${input.prompt}`,
      maxTokens: 4096,
    },
    signal,
  );
}

export async function* generateLorebookMaker(
  capabilities: MakerCapabilities,
  input: LorebookMakerInput,
  signal?: AbortSignal,
): AsyncGenerator<MakerEvent> {
  assertReady(input.prompt, input.connectionId, signal);

  const totalEntries = clampInteger(input.entryCount ?? 10, 1, 200);
  const batchSizes: number[] = [];
  for (let remaining = totalEntries; remaining > 0; remaining -= LOREBOOK_BATCH_SIZE) {
    batchSizes.push(Math.min(remaining, LOREBOOK_BATCH_SIZE));
  }

  const allEntries: LorebookMakerEntry[] = [];
  let lorebookName = "";
  let lorebookDescription = "";
  let category = "";

  for (let index = 0; index < batchSizes.length; index += 1) {
    const batchSize = batchSizes[index]!;
    if (batchSizes.length > 1) {
      yield {
        type: "batch_start",
        data: {
          batch: index + 1,
          totalBatches: batchSizes.length,
          batchSize,
          entriesSoFar: allEntries.length,
          totalEntries,
        },
      };
    }

    const userPrompt =
      index === 0
        ? `Generate exactly ${batchSize} lorebook entries based on: ${input.prompt}`
        : buildContinuationLorebookPrompt(input.prompt, batchSize, allEntries);

    const messages = [
      { role: "system", content: LOREBOOK_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ] satisfies LlmMessage[];
    const result = yield* runLorebookMakerBatchWithParseRetry(capabilities.llm, input, messages, index + 1, signal);

    if (index === 0) {
      lorebookName = stringOrEmpty(result.parsed.lorebook_name);
      lorebookDescription = stringOrEmpty(result.parsed.lorebook_description);
      category = stringOrEmpty(result.parsed.category);
    }

    const entries = result.entries;
    allEntries.push(...entries);

    if (batchSizes.length > 1) {
      yield {
        type: "batch_done",
        data: {
          batch: index + 1,
          totalBatches: batchSizes.length,
          batchEntryCount: entries.length,
          totalEntriesSoFar: allEntries.length,
        },
      };
    }
  }

  if (input.lorebookId) {
    if (!capabilities.storage) {
      throw new Error("Lorebook auto-save requires a storage capability.");
    }
    await capabilities.storage.createLorebookEntries(
      input.lorebookId,
      allEntries.map((entry) => ({ ...entry, lorebookId: input.lorebookId })),
    );
    yield { type: "saved", data: { count: allEntries.length, lorebookId: input.lorebookId } };
  }

  const payload: LorebookMakerData = {
    lorebook_name: lorebookName || "AI Generated Lorebook",
    lorebook_description: lorebookDescription,
    category: category || "world",
    entries: allEntries,
  };
  yield { type: "done", data: JSON.stringify(payload) };
}

async function* runLorebookMakerBatchWithParseRetry(
  llm: LlmGateway,
  input: CharacterOrPersonaMakerInput,
  messages: LlmMessage[],
  batch: number,
  signal?: AbortSignal,
): AsyncGenerator<MakerEvent, { parsed: LorebookMakerData; entries: LorebookMakerEntry[] }> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const isFinalAttempt = attempt === 2;
    let raw = "";
    let tokenEvents: MakerEvent[] = [];
    if (isFinalAttempt) {
      raw = yield* runMakerRequest(llm, input, messages, 16384, signal);
    } else {
      const collected = await collectMakerRequest(llm, input, messages, 16384, signal);
      raw = collected.raw;
      tokenEvents = collected.tokenEvents;
    }
    const parsed = parseObject<LorebookMakerData>(raw);
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : []).map(normalizeLorebookEntry);
    if (entries.length > 0 || attempt === 2) {
      if (entries.length === 0) {
        yield {
          type: "batch_warning",
          data: { batch, message: `Batch ${batch} did not produce valid entries.` },
        };
      } else {
        for (const event of tokenEvents) {
          yield event;
        }
      }
      return { parsed, entries };
    }

    yield {
      type: "batch_warning",
      data: { batch, message: `Batch ${batch} did not produce valid entries. Retrying once.` },
    };
  }

  return { parsed: {}, entries: [] };
}

async function collectMakerRequest(
  llm: LlmGateway,
  input: CharacterOrPersonaMakerInput,
  messages: LlmMessage[],
  maxTokens: number,
  signal?: AbortSignal,
): Promise<{ raw: string; tokenEvents: MakerEvent[] }> {
  const tokenEvents: MakerEvent[] = [];
  const request = runMakerRequest(llm, input, messages, maxTokens, signal);
  for (;;) {
    const next = await request.next();
    if (next.done) return { raw: next.value, tokenEvents };
    tokenEvents.push(next.value);
  }
}

async function* generateJsonMaker(
  capabilities: MakerCapabilities,
  input: CharacterOrPersonaMakerInput,
  options: { systemPrompt: string; userPrompt: string; maxTokens: number },
  signal?: AbortSignal,
): AsyncGenerator<MakerEvent> {
  assertReady(input.prompt, input.connectionId, signal);
  const raw = yield* runMakerRequest(
    capabilities.llm,
    input,
    [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt },
    ],
    options.maxTokens,
    signal,
  );

  const payload = parseObject(raw);
  yield {
    type: "done",
    data: Object.keys(payload).length > 0 ? JSON.stringify(payload) : raw,
  };
}

async function* runMakerRequest(
  llm: LlmGateway,
  input: CharacterOrPersonaMakerInput,
  messages: LlmMessage[],
  maxTokens: number,
  signal?: AbortSignal,
): AsyncGenerator<MakerEvent, string> {
  if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  const request = {
    connectionId: input.connectionId,
    messages,
    parameters: { temperature: 1, maxTokens },
  };
  if (!input.streaming) {
    const raw = await llm.complete(request, signal);
    yield { type: "token", data: raw };
    return raw;
  }

  let raw = "";
  for await (const chunk of llm.stream(request, signal)) {
    if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    if (chunk.type === "token") {
      const token = llmChunkText(chunk);
      if (token) {
        raw += token;
        yield { type: "token", data: token };
      }
    } else if (chunk.type === "error") {
      throw new Error(llmStreamErrorMessage(chunk));
    }
  }
  return raw;
}

function llmChunkText(chunk: { text?: unknown; data?: unknown; error?: unknown; message?: unknown }): string {
  if (typeof chunk.text === "string") return chunk.text;
  if (typeof chunk.data === "string") return chunk.data;
  const data = chunk.data && typeof chunk.data === "object" && !Array.isArray(chunk.data) ? chunk.data : {};
  return (
    stringOrEmpty(chunk.message).trim() ||
    stringOrEmpty(chunk.error).trim() ||
    stringOrEmpty((data as { message?: unknown }).message).trim() ||
    stringOrEmpty((data as { error?: unknown }).error).trim()
  );
}

function llmStreamErrorMessage(chunk: { text?: unknown; data?: unknown; error?: unknown; message?: unknown }): string {
  return llmChunkText(chunk).trim() || "Generation failed";
}

function buildContinuationLorebookPrompt(
  prompt: string,
  batchSize: number,
  existingEntries: LorebookMakerEntry[],
): string {
  const existingNames = existingEntries
    .map((entry) => entry.name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .join(", ");
  return [
    `Generate exactly ${batchSize} NEW lorebook entries based on: ${prompt}`,
    "",
    `You've already generated these entries: ${existingNames}`,
    "Create DIFFERENT entries that complement the above. Do NOT repeat any existing entries.",
    `Continue the order values from ${existingEntries.length * 100 + 100}.`,
  ].join("\n");
}

function parseObject<T extends Record<string, unknown>>(raw: string): T {
  const parsed = parseGameJsonish(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : ({} as T);
}

function normalizeLorebookEntry(entry: LorebookMakerEntry): LorebookMakerEntry {
  return {
    name: stringOrEmpty(entry.name) || "Untitled",
    content: stringOrEmpty(entry.content),
    keys: stringArray(entry.keys),
    secondaryKeys: [...stringArray(entry.secondary_keys), ...stringArray(entry.secondaryKeys)],
    tag: stringOrEmpty(entry.tag),
    constant: entry.constant === true,
    order: Number.isFinite(entry.order) ? Number(entry.order) : 100,
    enabled: true,
  };
}

function assertReady(prompt: string, connectionId: string, signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  if (!prompt.trim()) throw new Error("Prompt is required.");
  if (!connectionId.trim()) throw new Error("Connection is required.");
}

function clampInteger(value: number, min: number, max: number): number {
  const rounded = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.max(min, Math.min(max, rounded));
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
