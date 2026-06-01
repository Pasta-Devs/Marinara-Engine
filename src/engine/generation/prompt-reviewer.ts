import type { LlmGateway } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { readString as stringValue } from "../shared/value-readers";

export type PromptReviewInput = {
  presetId: string;
  connectionId: string;
  focusAreas?: string[];
};

export type PromptReviewEvent =
  | { type: "token"; data: string }
  | { type: "done"; data: string }
  | { type: "error"; data: string };

const PROMPT_REVIEWER_SYSTEM_PROMPT = `You are an expert prompt engineer reviewing prompt presets for AI roleplay applications. Analyze the prompt structure and content, then return a structured review in JSON:

{
  "overall_score": 8,
  "summary": "Brief 1-2 sentence overall assessment",
  "sections": [
    {
      "area": "clarity",
      "score": 8,
      "findings": "What you found",
      "suggestions": ["Specific improvement 1", "Specific improvement 2"]
    }
  ],
  "token_estimate": 2500,
  "warnings": ["Any critical issues"],
  "best_practices": ["Things done well"]
}

Review areas:
- clarity: Are instructions clear and unambiguous?
- consistency: Are there contradictory instructions?
- coverage: Are all important aspects covered?
- jailbreak_safety: Are there safeguards and obvious bypass risks?
- token_efficiency: Is the prompt concise and context-efficient?
- role_balance: Are system/user/assistant roles used appropriately?

Be specific and actionable. Reference exact sections when possible.`;

type JsonRecord = Record<string, unknown>;
const MALFORMED_REVIEW_JSON_MESSAGE =
  "Prompt Reviewer returned malformed JSON. Try again or use a model/provider with JSON mode support.";

function normalizePromptReviewJson(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

export async function* reviewPromptPreset(
  capabilities: { storage: StorageGateway; llm: LlmGateway },
  input: PromptReviewInput,
  signal?: AbortSignal,
): AsyncGenerator<PromptReviewEvent> {
  if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  const preset = await capabilities.storage.get<JsonRecord>("prompts", input.presetId);
  if (!preset) throw new Error("Prompt preset not found.");

  const focusAreas = input.focusAreas?.length ? input.focusAreas : ["clarity", "consistency", "coverage"];
  const assembledView = await assemblePromptReviewView(capabilities.storage, input.presetId);
  const userPrompt = [
    `Review this prompt preset. Focus areas: ${focusAreas.join(", ")}`,
    "",
    `Preset Name: ${stringValue(preset.name) || "Prompt preset"}`,
    `Wrap Format: ${stringValue(preset.wrapFormat) || "xml"}`,
    `Description: ${stringValue(preset.description) || "(none)"}`,
    "",
    `Assembled Prompt (${assembledView.length} characters):`,
    "",
    assembledView,
  ].join("\n");

  const raw = await capabilities.llm.complete(
    {
      connectionId: input.connectionId,
      messages: [
        { role: "system", content: PROMPT_REVIEWER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      // JSON mode reduces malformed output, but the client still validates the result.
      parameters: { temperature: 0.7, maxTokens: 8192, responseFormat: "json_object" },
    },
    signal,
  );
  const normalized = normalizePromptReviewJson(raw);
  if (!normalized) {
    yield { type: "error", data: MALFORMED_REVIEW_JSON_MESSAGE };
    return;
  }
  yield { type: "token", data: normalized };
  yield { type: "done", data: normalized };
}

async function assemblePromptReviewView(storage: StorageGateway, presetId: string): Promise<string> {
  const full = await storage.promptFull<JsonRecord>(presetId).catch(() => null);
  const preset = full && isRecord(full.preset) ? full.preset : {};
  const groups = Array.isArray(full?.groups) ? full.groups.filter(isRecord) : [];
  const choiceBlocks = Array.isArray(full?.choiceBlocks) ? full.choiceBlocks.filter(isRecord) : [];
  const sections = Array.isArray(full?.sections)
    ? full.sections.filter(isRecord)
    : await storage.list<JsonRecord>("prompt-sections", { filters: { presetId } });
  const explicitOrder = stringArray(preset.sectionOrder);
  const orderIndex = new Map(explicitOrder.map((id, index) => [id, index]));
  const enabledSections = sections
    .filter((section) => section.enabled !== false)
    .sort((a, b) => {
      const aIndex = orderIndex.get(stringValue(a.id));
      const bIndex = orderIndex.get(stringValue(b.id));
      if (aIndex != null || bIndex != null)
        return (aIndex ?? Number.MAX_SAFE_INTEGER) - (bIndex ?? Number.MAX_SAFE_INTEGER);
      return orderValue(a) - orderValue(b);
    });

  if (enabledSections.length === 0) {
    return "(Preset has no enabled sections.)";
  }

  const groupById = new Map(groups.map((group) => [stringValue(group.id), group]));
  const variableBlock = choiceBlocks.length
    ? [
        "[Preset Variables]",
        ...choiceBlocks.map((block) => {
          const label =
            stringValue(block.label) || stringValue(block.name) || stringValue(block.variableName) || "Variable";
          const options = Array.isArray(block.options)
            ? block.options
                .map((option) =>
                  isRecord(option) ? stringValue(option.label) || stringValue(option.value) : stringValue(option),
                )
                .filter(Boolean)
                .join(", ")
            : "";
          return `- ${label}${options ? `: ${options}` : ""}`;
        }),
      ].join("\n")
    : "";
  const sectionBlock = enabledSections
    .map((section, index) => {
      const name = stringValue(section.name) || stringValue(section.identifier) || "Untitled Section";
      const role = (stringValue(section.role) || "system").toUpperCase();
      const content = stringValue(section.content);
      const group = groupById.get(stringValue(section.groupId));
      const groupLabel = group
        ? ` | Group: ${stringValue(group.name) || stringValue(group.label) || stringValue(group.id)}`
        : "";
      return `[Message ${index + 1} | ${role} | ${name}${groupLabel}]\n${content.trim() ? content : "(empty)"}`;
    })
    .join("\n\n---\n\n");
  return variableBlock ? `${variableBlock}\n\n---\n\n${sectionBlock}` : sectionBlock;
}

function orderValue(section: JsonRecord): number {
  const value = section.sortOrder ?? section.order ?? section.injectionOrder;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try {
      return stringArray(JSON.parse(value));
    } catch {
      return value.trim() ? [value] : [];
    }
  }
  return [];
}
