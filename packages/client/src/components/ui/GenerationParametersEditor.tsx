import { useEffect, useRef, useState } from "react";
import type { GenerationParameters } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "./HelpTooltip";

export type EditableGenerationParameters = Pick<
  GenerationParameters,
  | "temperature"
  | "maxTokens"
  | "topP"
  | "topK"
  | "frequencyPenalty"
  | "presencePenalty"
  | "reasoningEffort"
  | "verbosity"
  | "assistantPrefill"
  | "customParameters"
>;

type EditableGenerationParameterOverrides = Partial<EditableGenerationParameters>;

const REASONING_LEVELS = [null, "low", "medium", "high", "maximum"] as const;
const VERBOSITY_LEVELS = [null, "low", "medium", "high"] as const;

export const CHAT_PARAMETER_DEFAULTS: EditableGenerationParameters = {
  temperature: 1,
  maxTokens: 4096,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "maximum",
  verbosity: "high",
  assistantPrefill: "",
  customParameters: {},
};

export const ROLEPLAY_PARAMETER_DEFAULTS: EditableGenerationParameters = {
  temperature: 1,
  maxTokens: 8192,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "maximum",
  verbosity: "high",
  assistantPrefill: "",
  customParameters: {},
};

export function parseEditableGenerationParameters(raw: unknown): EditableGenerationParameterOverrides | null {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;

  const source = parsed as Record<string, unknown>;
  const next: EditableGenerationParameterOverrides = {};

  if (typeof source.temperature === "number") next.temperature = source.temperature;
  if (typeof source.maxTokens === "number") next.maxTokens = source.maxTokens;
  if (typeof source.topP === "number") next.topP = source.topP;
  if (typeof source.topK === "number") next.topK = source.topK;
  if (typeof source.frequencyPenalty === "number") next.frequencyPenalty = source.frequencyPenalty;
  if (typeof source.presencePenalty === "number") next.presencePenalty = source.presencePenalty;
  if (
    source.reasoningEffort === null ||
    source.reasoningEffort === "low" ||
    source.reasoningEffort === "medium" ||
    source.reasoningEffort === "high" ||
    source.reasoningEffort === "maximum"
  ) {
    next.reasoningEffort = source.reasoningEffort;
  }
  if (
    source.verbosity === null ||
    source.verbosity === "low" ||
    source.verbosity === "medium" ||
    source.verbosity === "high"
  ) {
    next.verbosity = source.verbosity;
  }
  if (typeof source.assistantPrefill === "string") {
    next.assistantPrefill = source.assistantPrefill;
  }
  if (
    source.customParameters &&
    typeof source.customParameters === "object" &&
    !Array.isArray(source.customParameters) &&
    Object.keys(source.customParameters).length > 0
  ) {
    next.customParameters = source.customParameters as Record<string, unknown>;
  }

  return Object.keys(next).length > 0 ? next : null;
}

export function getEditableGenerationParameters(
  defaults: EditableGenerationParameters,
  overrides: unknown,
): EditableGenerationParameters {
  return { ...defaults, ...(parseEditableGenerationParameters(overrides) ?? {}) };
}

export function GenerationParametersFields({
  value,
  onChange,
}: {
  value: EditableGenerationParameters;
  onChange: (next: EditableGenerationParameters) => void;
}) {
  const set = <K extends keyof EditableGenerationParameters>(key: K, nextValue: EditableGenerationParameters[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <ParamInput
          label="Temperature"
          help="Controls randomness. Lower values make output more focused and deterministic; higher values make it more creative and varied."
          value={value.temperature}
          onChange={(nextValue) => set("temperature", nextValue)}
          min={0}
          max={2}
          step={0.05}
        />
        <ParamInput
          label="Max Output Tokens"
          help="The maximum number of tokens the model can generate in a single response. Higher values allow longer replies."
          value={value.maxTokens}
          onChange={(nextValue) => set("maxTokens", nextValue)}
          min={1}
          max={32768}
          step={256}
        />
        <ParamInput
          label="Top P"
          help="Nucleus sampling: only considers tokens whose cumulative probability reaches this threshold. Lower values make output more focused."
          value={value.topP}
          onChange={(nextValue) => set("topP", nextValue)}
          min={0}
          max={1}
          step={0.05}
        />
        <ParamInput
          label="Top K"
          help="Limits the model to only consider the top K most likely tokens at each step. 0 disables this limit."
          value={value.topK}
          onChange={(nextValue) => set("topK", nextValue)}
          min={0}
          max={500}
          step={1}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ParamInput
          label="Frequency"
          help="Penalizes tokens based on how often they've already appeared. Positive values reduce repetition; negative values encourage it."
          value={value.frequencyPenalty}
          onChange={(nextValue) => set("frequencyPenalty", nextValue)}
          min={-2}
          max={2}
          step={0.05}
        />
        <ParamInput
          label="Presence"
          help="Penalizes tokens that have appeared at all, regardless of frequency. Positive values encourage the model to talk about new topics."
          value={value.presencePenalty}
          onChange={(nextValue) => set("presencePenalty", nextValue)}
          min={-2}
          max={2}
          step={0.05}
        />
      </div>
      <div className="space-y-2">
        <div>
          <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            Assistant Prefill
            <HelpTooltip
              text="Optional assistant-role text appended after the final user message. Use this only for models that support assistant prefill/continuation or need a specific opening tag."
              size="0.625rem"
            />
          </span>
          <textarea
            value={value.assistantPrefill}
            onChange={(e) => set("assistantPrefill", e.target.value)}
            rows={3}
            className="mt-1 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:ring-[var(--ring)]"
            placeholder="e.g. <thinking>\n"
          />
        </div>
        <CustomParametersInput
          value={value.customParameters}
          onChange={(nextValue) => set("customParameters", nextValue)}
        />
        <div>
          <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            Reasoning Effort
            <HelpTooltip
              text="How much the model should 'think' before responding. Higher effort produces more thoughtful, nuanced output but uses more tokens and is slower."
              size="0.625rem"
            />
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {REASONING_LEVELS.map((level) => (
              <button
                key={level ?? "none"}
                onClick={() => set("reasoningEffort", level)}
                className={cn(
                  "rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
                  value.reasoningEffort === level
                    ? "bg-purple-400/15 text-purple-400 ring-1 ring-purple-400/30"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                )}
              >
                {level ? level.charAt(0).toUpperCase() + level.slice(1) : "None"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            Verbosity
            <HelpTooltip
              text="Controls how long and detailed responses should be. Low keeps things concise; high encourages elaborate, descriptive output."
              size="0.625rem"
            />
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {VERBOSITY_LEVELS.map((level) => (
              <button
                key={level ?? "none"}
                onClick={() => set("verbosity", level)}
                className={cn(
                  "rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
                  value.verbosity === level
                    ? "bg-blue-400/15 text-blue-400 ring-1 ring-blue-400/30"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                )}
              >
                {level ? level.charAt(0).toUpperCase() + level.slice(1) : "None"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomParametersInput({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const serialized = stringifyCustomParameters(value);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(serialized);
      setError(null);
    }
  }, [focused, serialized]);

  const commit = () => {
    const parsed = parseCustomParametersDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onChange(parsed.value);
    setDraft(stringifyCustomParameters(parsed.value));
  };

  return (
    <div>
      <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
        Custom Parameters
        <HelpTooltip
          text="Optional raw JSON object merged into the provider request body. This can break requests if the provider does not support a key."
          size="0.625rem"
        />
      </span>
      <textarea
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        rows={3}
        spellCheck={false}
        className="mt-1 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:ring-[var(--ring)]"
        placeholder={focused ? "" : '{ "thinking": true }'}
      />
      {error ? (
        <p className="mt-1 text-[0.5625rem] text-amber-500">{error}</p>
      ) : (
        <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/70">
          Must be a JSON object. Use lowercase true, false, and null.
        </p>
      )}
    </div>
  );
}

function stringifyCustomParameters(value: Record<string, unknown> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) return "";
  return JSON.stringify(value, null, 2);
}

function parseCustomParametersDraft(
  draft: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = draft.trim();
  if (!trimmed) return { ok: true, value: {} };

  const attempts = [trimmed];
  const normalized = trimmed
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null");
  if (normalized !== trimmed) attempts.push(normalized);

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ok: true, value: parsed as Record<string, unknown> };
      }
      return { ok: false, error: "Custom parameters must be a JSON object, not an array or scalar." };
    } catch {
      // Try the next normalized variant.
    }
  }

  return { ok: false, error: "Invalid JSON. Check quotes, commas, and boolean casing." };
}

function ParamInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  help,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  help?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const prevValue = useRef(value);

  if (value !== prevValue.current) {
    prevValue.current = value;
    setDraft(String(value));
  }

  const commit = () => {
    const nextValue = parseFloat(draft);
    if (!Number.isNaN(nextValue) && nextValue >= min && nextValue <= max) {
      onChange(nextValue);
      setDraft(String(nextValue));
      return;
    }
    setDraft(String(value));
  };

  return (
    <div>
      <label className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
        {label}
        {help && <HelpTooltip text={help} size="0.625rem" />}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        min={min}
        max={max}
        step={step}
        className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
      />
    </div>
  );
}
