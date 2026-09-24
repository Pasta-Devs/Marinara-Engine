import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { collectDecisionQuestions } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createMariInstructionsStorage } from "../storage/mari-instructions.storage.js";
import { readDecisionAuthoringStatus } from "../decision/decision-status.js";
import { getProfessorMariWorkspaceSkillsService } from "./workspace-skills.service.js";

export const MARI_DECISION_STATE_KEY = "mariDecisionAuthoring";
const categorySchema = z.enum(["authoring", "setupReminder", "cachePlacement"]);
const recordSchema = z.object({
  category: categorySchema,
  answer: z.enum(["pending", "allow", "decline", "suppress"]),
  source: z.enum(["user", "memory", "skill"]).default("user"),
  sourceId: z.string().max(200).optional(),
  quote: z.string().trim().min(1).max(2000).optional(),
  scope: z.enum(["turn", "chat"]).default("turn"),
});
type RecordInput = z.infer<typeof recordSchema>;
type DecisionRecord = RecordInput & { userMessageId: string };
type DecisionState = Partial<Record<z.infer<typeof categorySchema>, DecisionRecord>>;
type AuthoringContext = { db: DB; chatId: string; userMessageId: string };
const contextStorage = new AsyncLocalStorage<AuthoringContext>();

/** Keep each command's chat identity across awaits and superseded workspace runs. */
export function withMariDecisionContext<T>(context: AuthoringContext, run: () => Promise<T>): Promise<T> {
  return contextStorage.run(context, run);
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return object(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stateFromMetadata(metadata: unknown): DecisionState {
  const state: DecisionState = {};
  const raw = object(object(metadata)[MARI_DECISION_STATE_KEY]);
  for (const category of categorySchema.options) {
    const entry = object(raw[category]);
    const result = recordSchema.safeParse(entry);
    if (result.success && result.data.category === category && typeof entry.userMessageId === "string") {
      state[category] = { ...result.data, userMessageId: entry.userMessageId };
    }
  }
  return state;
}

async function sourceText(context: AuthoringContext, record: RecordInput & { userMessageId: string }) {
  if (record.source === "memory") {
    const memory = record.sourceId ? await createMariInstructionsStorage(context.db).get(record.sourceId) : null;
    return memory?.enabled ? memory.content : null;
  }
  if (record.source === "skill") {
    const { skills } = await getProfessorMariWorkspaceSkillsService().list();
    return skills.find((skill) => skill.id === record.sourceId && skill.enabled)?.content ?? null;
  }
  const message = await createChatsStorage(context.db).getMessage(record.userMessageId);
  return message?.role === "user" && message.chatId === context.chatId ? message.content : null;
}

async function isActiveRecord(context: AuthoringContext, record: DecisionRecord): Promise<boolean> {
  if (record.answer === "pending") return true;
  if (record.source === "user" && record.scope === "turn" && record.userMessageId !== context.userMessageId)
    return false;
  const text = await sourceText(context, record);
  return Boolean(record.quote && text?.includes(record.quote));
}

async function readState(context: AuthoringContext) {
  const chat = await createChatsStorage(context.db).getById(context.chatId);
  if (!chat) throw new Error("The active Mari chat no longer exists.");
  return stateFromMetadata(chat.metadata);
}

export async function mariDecisionContext(context: AuthoringContext) {
  const state = await readState(context);
  const interactions: Record<string, unknown> = {};
  for (const [category, record] of Object.entries(state)) {
    interactions[category] = { ...record, active: await isActiveRecord(context, record) };
  }
  return {
    model: await readDecisionAuthoringStatus(context.db),
    currentUserMessageId: context.userMessageId,
    interactions,
  };
}

/**
 * The model reports its interpretation, grounded in an actual user message or enabled preference.
 * Evidence checks establish provenance, not the meaning of consent. Do not add English verb,
 * scope-phrase or minimum-length heuristics here: valid replies include "Ja" and "好".
 * Pending questions still require a later user turn, regardless of the model's interpretation.
 */
export async function recordMariDecisionInteraction(context: AuthoringContext, input: unknown) {
  const parsed = recordSchema.parse(input);
  if (parsed.answer === "suppress" && parsed.category !== "setupReminder") {
    throw new Error("Only setupReminder supports suppress; it does not authorize Decision authoring.");
  }
  const record: DecisionRecord = {
    ...parsed,
    scope: parsed.category === "setupReminder" ? "chat" : parsed.scope,
    userMessageId: context.userMessageId,
  };
  if (record.answer !== "pending") {
    const text = await sourceText(context, record);
    if (!record.quote || !text?.includes(record.quote)) {
      throw new Error(
        "Quote the user's actual instruction or an enabled Memory/Skill body, with its sourceId. A title or disabled preference is insufficient.",
      );
    }
  } else if (record.source !== "user") {
    throw new Error("Pending questions belong to this chat, not to a Memory or Skill.");
  }
  const chats = createChatsStorage(context.db);
  let saved: DecisionState = {};
  const result = await chats.patchMetadata(
    context.chatId,
    async (metadata) => {
      const state = stateFromMetadata(metadata);
      const previous = state[record.category];
      if (record.answer === "pending" && previous && (await isActiveRecord(context, previous))) {
        // Keep the original question/answer, including across truncated history and retries.
        saved = state;
        return {};
      }
      if (
        record.source === "user" &&
        record.answer !== "pending" &&
        previous?.answer === "pending" &&
        previous.userMessageId === context.userMessageId
      ) {
        throw new Error(
          "Wait for a new user reply to the pending Decision question; this run cannot answer its own question.",
        );
      }
      saved = { ...state, [record.category]: record };
      return { [MARI_DECISION_STATE_KEY]: saved };
    },
    { touchUpdatedAt: false },
  );
  if (!result) throw new Error("The active Mari chat no longer exists.");
  return saved;
}

export async function executeMariDecisionAction(action: string, data: unknown) {
  const context = contextStorage.getStore();
  if (!context) throw new Error("Decision interactions require an active Mari chat.");
  if (action === "decision.get") return mariDecisionContext(context);
  if (action === "decision.record") return recordMariDecisionInteraction(context, data);
  throw new Error("Unsupported Decision interaction action.");
}

const AUTHORING_TABLES = new Set([
  "characters",
  "personas",
  "lorebook_entries",
  "agent_configs",
  "prompt_presets",
  "prompt_sections",
  "choice_blocks",
]);

/** Count parsed dependencies by field path so copying a condition introduces a new use. */
function decisionUses(value: unknown, path = "", uses = new Map<string, number>(), depth = 0): Map<string, number> {
  if (depth > 16) return uses;
  if (typeof value === "string") {
    if (/^[\s]*[\[{]/.test(value)) {
      try {
        return decisionUses(JSON.parse(value), path, uses, depth + 1);
      } catch {
        /* ordinary prompt text */
      }
    }
    for (const question of collectDecisionQuestions(value)) {
      const key = `${path}:${JSON.stringify({ kind: question.kind, question: question.question, options: question.options })}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  } else if (Array.isArray(value)) {
    for (const entry of value) decisionUses(entry, path, uses, depth + 1);
  } else if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.activationQuestion === "string" && row.activationQuestion.trim()) {
      const key = `${path}:activation:${row.activationQuestion}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
    // Include a drafted statement even while mode is off: it is still authored Decision content.
    if (typeof row.decisionStatement === "string" && row.decisionStatement.trim()) {
      const key = `${path}:lorebook:${row.decisionStatement}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
    for (const [key, entry] of Object.entries(row)) decisionUses(entry, `${path}.${key}`, uses, depth + 1);
  }
  return uses;
}

export function introducesMariDecisionContent(before: unknown, after: unknown): boolean {
  const old = decisionUses(before);
  return [...decisionUses(after)].some(([key, count]) => count > (old.get(key) ?? 0));
}

export interface MariAuthoringChange {
  table: string;
  beforeRaw?: Record<string, unknown> | null;
  afterRaw?: Record<string, unknown> | null;
}

function historyPlacement(change: MariAuthoringChange) {
  const { beforeRaw: before, afterRaw: after, table } = change;
  if (!after) return false;
  if (table === "prompt_sections" && after.injectionPosition === "depth") {
    return ["content", "injectionPosition", "injectionDepth"].some((key) => after[key] !== before?.[key]);
  }
  if (table === "lorebook_entries" && Number(after.position) === 2) {
    return ["content", "position", "depth"].some((key) => after[key] !== before?.[key]);
  }
  if (table === "characters") {
    const depth = (row: unknown) => object(object(object(row).data).extensions).depth_prompt;
    const current = depth(after);
    return Boolean(object(current).prompt) && JSON.stringify(current) !== JSON.stringify(depth(before));
  }
  return false;
}

/** Shared normalized write boundary: structured actions, raw CLI and whole-entity child inserts. */
export async function guardMariDecisionWrites(changes: MariAuthoringChange[]): Promise<void> {
  const context = contextStorage.getStore();
  if (!context) return; // Direct user/CLI editing outside Mari retains its existing behavior.
  const relevant = changes.filter((change) => AUTHORING_TABLES.has(change.table) && change.afterRaw);
  const decisions = relevant.some((change) => introducesMariDecisionContent(change.beforeRaw, change.afterRaw));
  const history = relevant.some(historyPlacement);
  if (!decisions && !history) return;
  const state = await readState(context);
  const allowed = async (category: keyof DecisionState, answers = ["allow"]) => {
    const record = state[category];
    return Boolean(record && answers.includes(record.answer) && (await isActiveRecord(context, record)));
  };
  if (decisions) {
    if (!(await allowed("authoring")))
      throw new Error(
        "Before adding Decision content, read applicable enabled preferences or obtain the user's permission; record the actual source with decision.record (authoring). Ordinary edits must preserve existing Decisions without adding new ones.",
      );
    const status = await readDecisionAuthoringStatus(context.db);
    const authoring = state.authoring;
    if (
      status.state !== "selected" &&
      (authoring?.source !== "user" || authoring.userMessageId !== context.userMessageId)
    ) {
      throw new Error(
        "Without a usable selected Decision model, adding Decision content requires the user's explicit request in this turn. A standing authoring preference or suppressed reminders alone does not authorize it.",
      );
    }
    if (status.state !== "selected" && !(await allowed("setupReminder", ["allow", "suppress"]))) {
      throw new Error(
        `Decision status is ${status.state}. Explain the relevant fallback/unknown availability and ask once in this chat, then wait for the user's answer. Record it with decision.record (setupReminder). Honor an enabled do-not-remind preference; never call unknown status missing setup.`,
      );
    }
  }
  if (history && !(await allowed("cachePlacement"))) {
    throw new Error(
      "New or changed history/depth insertion needs the user's current instruction or enabled placement preference. Explain the potential cache impact and record that source with decision.record (cachePlacement), or use ordinary placement.",
    );
  }
}

/** Decision authoring policy for the built-in Mari workspace assistant. */
export const MARI_DECISION_AUTHORING_PROMPT = `
Decision authoring (presets, agents, lorebooks/entries, characters and prompt fields):
- Check the live Decision status and relevant enabled Memories/Skills before adding Decision dependencies. A Skill explaining syntax is not the user's permission to use it. Read relevant Memory bodies; page the index when necessary. Disabled Memories do not apply.
- Without a selected model, ordinary authoring introduces no Decision content. Preserve existing Decisions during unrelated edits. For an explicit Decision request, explain the relevant fallback and ask whether to proceed once per chat; an unanswered question or a refusal is not approval.
- If the user asks you to stop reminding them to set up a Decision model, honor that in this chat and save/update a concise Memory through the existing review flow. Explain that Keep & Enable makes it apply in future chats. Suppressing reminders does not authorize unsolicited Decision content or model setup.
- With a selected model and no applicable preference, ask whether to use Decisions and whether to remember their answer. An explicit request already authorizes that task. Save either preference only with permission, using instruction.remember/update; do not auto-enable Memories. Keep general Decision permission separate from early-prompt/history placement permission.
- Keep usage lean unless the user prefers otherwise. Prefer ordinary keywords or deterministic conditions when sufficient. Use at least one suitable timing control: sticky/cooldown/every in prompt conditions, entry Sticky/Cooldown for lorebook activation, or agent Trigger Cadence (settings.runInterval). Sticky/cooldown reduce repeated checks after a positive; every reads as false between checks and can miss fleeting events.
- Keep the beginning of the assembled prompt stable; place changing conditional text late. Avoid new early changing content or history/depth insertion unless current instructions or an enabled preference permit it. This also applies to non-Decision context injection. There is no universally safe 500–1,000-token cutoff: reuse depends on the matching rendered prefix, provider/model and cache boundaries. Moving depth insertions can disrupt reuse even when their text is unchanged; running a Decision alone does not change the main prompt.
- Use decision.get to refresh model status and this chat's interaction record. selected means configured, not health-tested; unavailable is a known limitation, unknown is a failed lookup, and none means no selection. Never set up, start, test or change a model merely to check status.
- Persist interactions with app_data decision.record. data.category is authoring, setupReminder, or cachePlacement; answer is pending, allow, decline, or (setupReminder only) suppress. Before asking, record pending, then ask in say and stop for the answer. Existing pending means await the answer without repeating the setup warning; allow/decline/suppress must never be inferred from silence. If a retry has no visible question yet, finish asking it. Record the user's answer only on their subsequent turn.
- For a direct user instruction, record source:user and quote the relevant exact text from the current message. Use scope:turn for a specific task and scope:chat only for an actual chat-wide preference. To follow a standing preference, record source:memory or skill, sourceId and an exact quote from its enabled body; source validity is rechecked on use. Mere syntax guidance is not consent. setupReminder always lasts for this chat; a suppress record removes reminders, not authoring permission. When setup is absent, record the current explicit request as authoring permission separately from the user's answer to the setup warning; a standing preference alone does not invite Decision content without a model. A decline stays a decline until the user changes it.
- Use docs_read with docs/connections/decision-models.md, docs/prompts/conditional-prompts.md, docs/agents/custom-agents.md and docs/lorebooks/entries.md before authoring unfamiliar syntax. Test representative positive/negative scenes and inspect Peek Prompt; a connection Test uses a fixed sample, not the authored statement.
- Prompt examples: {{#if decision:"A fight is happening in the latest message" sticky:3 cooldown:5}}Optional combat guidance{{else}}Ordinary guidance{{/if}}. A choice uses {{#if decision_choice:"The kind of scene in the latest message" sticky:3 == "combat"}}...{{else if decision_choice:"The kind of scene in the latest message" sticky:3 == "dialogue"}}...{{else}}...{{/if}}. Prompt expressions expose boolean/choice answers, not raw percentages; ordinary preset choice variables are different. Scores and thresholds are model-dependent, not universally calibrated confidence. Use the live calibration or omit an agent threshold to use the backend default; do not assume a universal threshold.
- An agent's settings.activationQuestion is a plain statement (up to 500 characters), not a timing expression. settings.activationScanDepth controls recent context; settings.activationThreshold is 0.05–0.95, settings.activationMaxSkip is an optional 1–100 escape hatch, and settings.runInterval is a positive cadence. Put activation fields inside settings; updates merge other settings. Empty/null activation fields clear them. Keywords/cadence run before the question; with no answer the question fails open.
- Lorebook decisionStatement is plain text; decisionMode is off, require, or trigger. Require filters ordinary activation; Trigger adds a route alongside ordinary matches. Without an answer, Require admits no new entry (existing Sticky can continue), while Trigger retains ordinary routes. Use the entry's sticky/cooldown fields, not prompt timing inside the statement. Keep essential information available without a Decision.
- Prompt Decisions read the last five saved messages, not the whole preset, card or lorebook. Agent questions use their scan depth; post-processing prompt statements see the new reply, pre-generation/parallel statements do not. Write observable facts and enough context to disambiguate them. Hosted requests can send recent chat to a provider and incur charges; local choices may need a completion per option. Statements-per-turn is not one global budget for all phases, agent activation and Smart order. Keep options and duplicate statements few.
`;
