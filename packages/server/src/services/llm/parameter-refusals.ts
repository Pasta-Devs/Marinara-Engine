// ──────────────────────────────────────────────
// Parameter refusals: settings a service has refused for a model
// ──────────────────────────────────────────────
// Some services block a setting whatever the model would take (a router that drops penalties, a proxy whose upstream
// refuses top_k). Most never say so up front, only by refusing a request. When a refusal names one of these settings,
// the request is sent again without it (AI Horde names one per refusal, so this repeats), and once a request goes
// through, the settings are remembered for that service and model: later requests leave them out, and Advanced
// Parameters hides them like any other unsupported setting.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { capabilityModelId, type GenerationParameterKey } from "@marinara-engine/shared";
import { getDataDir } from "../../utils/data-dir.js";
import { logger } from "../../lib/logger.js";

/** Request fields the parameter panel controls, by their Chat Completions names. */
export const REFUSABLE_PARAMETER_FIELDS: Readonly<Record<string, GenerationParameterKey>> = {
  temperature: "temperature",
  top_p: "topP",
  top_k: "topK",
  min_p: "minP",
  frequency_penalty: "frequencyPenalty",
  presence_penalty: "presencePenalty",
  verbosity: "verbosity",
  service_tier: "serviceTier",
};

/** Wording that refuses a field outright, as opposed to a value out of range. */
const REFUSAL_WORDING =
  /\b(?:not supported|unsupported|(?:does|do|is|are)\s*(?:not|n't)\s+(?:support(?:ed)?|allowed|permitted|accepted|available)|not (?:allowed|permitted|accepted|available)|unrecognized|unrecognised|unknown (?:parameter|field|argument|name|key)|extra (?:inputs?|fields?|arguments?)|unexpected (?:keyword|parameter|field|argument|key)|cannot be (?:used|set|specified|sent)|can't be (?:used|set|specified|sent)|deprecated|only the default)/iu;
/** Wording that bounds a value ("must be between 0 and 1"): the value was refused, not the setting. */
const RANGE_WORDING =
  /\b(?:between\s+-?\d|out of (?:the )?(?:\w+ )?range|ranges? (?:is|of|from)|(?:greater|less|more|lower|higher) than(?: or equal to)?\s+-?\d|at (?:least|most)\s+-?\d)|[<>]=\s*-?\d/iu;
/** Wording that refuses two samplers sent together, where dropping top_p is the documented fix (Claude 4.5). */
const TOGETHER_WORDING = /\b(?:both|together|only one of|mutually exclusive|at the same time)\b/iu;
/** How far from a field name the refusal wording may sit. */
const WINDOW = 160;

function fieldPattern(field: string): RegExp {
  const camel = field.replace(/_([a-z])/gu, (_match, letter: string) => letter.toUpperCase());
  const spaced = field.replace(/_/gu, "[ _-]");
  return new RegExp(`(?<![A-Za-z0-9_])(?:${spaced}|${camel})(?![A-Za-z0-9_])`, "giu");
}

/**
 * The fields of `body` that a refusal names: a panel field that was sent, named within reach of refusal wording and not
 * of range wording. An error about two samplers sent together drops only top_p. Returns [] when the error is about
 * something else.
 */
export function detectRefusedParameterFields(errorText: string, body: Record<string, unknown>): string[] {
  const text = errorText.replace(/\\(["'])/gu, "$1");
  const sent = Object.keys(REFUSABLE_PARAMETER_FIELDS).filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field),
  );
  const named = sent.filter((field) => {
    for (const match of text.matchAll(fieldPattern(field))) {
      const at = match.index ?? 0;
      const near = text.slice(Math.max(0, at - WINDOW), at + match[0].length + WINDOW);
      if (RANGE_WORDING.test(near)) continue;
      if (REFUSAL_WORDING.test(near) || (field === "top_p" && TOGETHER_WORDING.test(near))) return true;
    }
    return false;
  });
  // "temperature and top_p cannot both be set" names exactly those two: dropping top_p alone is the fix. Any other set
  // of fields was refused on its own.
  const pairOnly = named.length === 2 && named.includes("top_p") && named.includes("temperature");
  if (pairOnly && TOGETHER_WORDING.test(text)) return ["top_p"];
  return named;
}

type Entry = { fields: string[]; at: number };

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;
let store: Map<string, Entry> | null = null;

function storePath(): string {
  return join(getDataDir(), "parameter-refusals.json");
}

function load(): Map<string, Entry> {
  if (store) return store;
  store = new Map();
  try {
    const path = storePath();
    if (existsSync(path)) {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed ?? {})) {
        const entry = value as Partial<Entry> | null;
        if (!entry || !Array.isArray(entry.fields) || typeof entry.at !== "number") continue;
        const fields = entry.fields.filter(
          (field): field is string => typeof field === "string" && field in REFUSABLE_PARAMETER_FIELDS,
        );
        if (fields.length > 0) store.set(key, { fields, at: entry.at });
      }
    }
  } catch (error) {
    logger.warn(error, "[parameter-refusals] Could not read the saved refusals; starting empty");
  }
  return store;
}

function save(entries: Map<string, Entry>): void {
  try {
    const path = storePath();
    mkdirSync(dirname(path), { recursive: true });
    const temp = `${path}.tmp`;
    writeFileSync(temp, JSON.stringify(Object.fromEntries(entries), null, 2));
    renameSync(temp, path);
  } catch (error) {
    logger.warn(error, "[parameter-refusals] Could not save the refusals");
  }
}

/**
 * The service a refusal belongs to: the provider kind, plus the address for a custom endpoint, since two custom
 * endpoints can be entirely different services.
 */
export function parameterRefusalService(providerKind: string, baseUrl: string): string {
  return providerKind === "custom" ? `custom|${baseUrl.replace(/\/+$/u, "")}` : providerKind;
}

function entryKey(service: string, model: string): string {
  return `${service}\n${capabilityModelId(model)}`;
}

/** Request fields this service refused for this model in the last 30 days. */
export function refusedParameterFields(service: string, model: string): string[] {
  if (!model.trim()) return [];
  const entries = load();
  const key = entryKey(service, model);
  const entry = entries.get(key);
  if (!entry) return [];
  if (Date.now() - entry.at > TTL_MS) {
    entries.delete(key);
    save(entries);
    return [];
  }
  return [...entry.fields];
}

/** The panel settings this service refused for this model. */
export function refusedGenerationParameters(service: string, model: string): GenerationParameterKey[] {
  return refusedParameterFields(service, model).map((field) => REFUSABLE_PARAMETER_FIELDS[field]!);
}

export function rememberRefusedParameterFields(service: string, model: string, fields: string[]): void {
  if (!model.trim() || fields.length === 0) return;
  const entries = load();
  const key = entryKey(service, model);
  const merged = new Set([...(entries.get(key)?.fields ?? []), ...fields]);
  entries.delete(key);
  if (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.set(key, { fields: [...merged], at: Date.now() });
  save(entries);
}

/** Tests only: forget everything, in memory and on disk. */
export function resetParameterRefusalsForTesting(): void {
  store = new Map();
  save(store);
}
