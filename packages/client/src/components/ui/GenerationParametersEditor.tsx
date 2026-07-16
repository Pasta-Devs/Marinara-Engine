import { useEffect, useState } from "react";
import {
  GENERATION_PARAMETER_SEND_KEYS,
  normalizeThinkingTagPairs,
  type GenerationParameterSendKey,
  type GenerationParameterSendMap,
  type GenerationParameters,
  type ThinkingTagPair,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { DraftTextarea } from "./DraftTextarea";
import { HelpTooltip } from "./HelpTooltip";
import { parseCustomParametersDraft } from "../../lib/generation-custom-parameters";

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
  | "serviceTier"
  | "assistantPrefill"
  | "customThinkingTags"
  | "customParameters"
  | "enabledParameters"
>;

type EditableGenerationParameterOverrides = Partial<EditableGenerationParameters>;

const REASONING_LEVELS = [null, "low", "medium", "high", "xhigh", "maximum"] as const;
const VERBOSITY_LEVELS = [null, "low", "medium", "high"] as const;
const OPENROUTER_SERVICE_TIERS = [null, "flex", "priority"] as const;
const THINKING_TAG_CONTENT_PLACEHOLDER = "{{thinking}}";
const PARAM_CHOICE_ACTIVE_CLASS = "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30";
const PARAM_CHOICE_IDLE_CLASS =
  "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]";
const PARAM_TEXTAREA_CLASS =
  "mt-1 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:ring-[var(--ring)]";

const LEGACY_PARAMETER_SEND_DEFAULTS: GenerationParameterSendMap = Object.fromEntries(
  GENERATION_PARAMETER_SEND_KEYS.map((key) => [key, true]),
) as GenerationParameterSendMap;

export const STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS: GenerationParameterSendMap = {
  temperature: false,
  maxTokens: true,
  topP: false,
  topK: false,
  frequencyPenalty: false,
  presencePenalty: false,
  reasoningEffort: true,
  verbosity: false,
};

export const CHAT_PARAMETER_DEFAULTS: EditableGenerationParameters = {
  temperature: 1,
  maxTokens: 4096,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "maximum",
  verbosity: "high",
  serviceTier: null,
  assistantPrefill: "",
  customThinkingTags: [],
  customParameters: {},
  enabledParameters: LEGACY_PARAMETER_SEND_DEFAULTS,
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
  serviceTier: null,
  assistantPrefill: "",
  customThinkingTags: [],
  customParameters: {},
  enabledParameters: LEGACY_PARAMETER_SEND_DEFAULTS,
};

export const CONNECTION_PARAMETER_DEFAULTS: EditableGenerationParameters = {
  ...ROLEPLAY_PARAMETER_DEFAULTS,
  enabledParameters: STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS,
};

function normalizeEnabledParameters(source: unknown): GenerationParameterSendMap | undefined {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  const record = source as Record<string, unknown>;
  const result: GenerationParameterSendMap = {};
  for (const key of GENERATION_PARAMETER_SEND_KEYS) {
    if (typeof record[key] === "boolean") result[key] = record[key] as boolean;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function mergeEnabledParameters(
  defaults: GenerationParameterSendMap | undefined,
  overrides: GenerationParameterSendMap | undefined,
): GenerationParameterSendMap | undefined {
  if (!defaults && !overrides) return undefined;
  return { ...(defaults ?? {}), ...(overrides ?? {}) };
}

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
    source.reasoningEffort === "xhigh" ||
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
  if (source.serviceTier === null || source.serviceTier === "flex" || source.serviceTier === "priority") {
    next.serviceTier = source.serviceTier;
  }
  if (typeof source.assistantPrefill === "string") {
    next.assistantPrefill = source.assistantPrefill;
  }
  if (Array.isArray(source.customThinkingTags)) {
    next.customThinkingTags = normalizeThinkingTagPairs(source.customThinkingTags);
  }
  if (
    source.customParameters &&
    typeof source.customParameters === "object" &&
    !Array.isArray(source.customParameters) &&
    Object.keys(source.customParameters).length > 0
  ) {
    next.customParameters = source.customParameters as Record<string, unknown>;
  }
  const enabledParameters = normalizeEnabledParameters(source.enabledParameters);
  if (enabledParameters) next.enabledParameters = enabledParameters;

  return Object.keys(next).length > 0 ? next : null;
}

export function getEditableGenerationParameters(
  defaults: EditableGenerationParameters,
  overrides: unknown,
): EditableGenerationParameters {
  const parsed = parseEditableGenerationParameters(overrides) ?? {};
  return {
    ...defaults,
    ...parsed,
    enabledParameters: mergeEnabledParameters(defaults.enabledParameters, parsed.enabledParameters),
  };
}

export function GenerationParametersFields({
  value,
  onChange,
  showOpenRouterServiceTier = false,
  enabledParametersFallback = LEGACY_PARAMETER_SEND_DEFAULTS,
}: {
  value: EditableGenerationParameters;
  onChange: (next: EditableGenerationParameters) => void;
  showOpenRouterServiceTier?: boolean;
  enabledParametersFallback?: GenerationParameterSendMap;
}) {
  const set = <K extends keyof EditableGenerationParameters>(key: K, nextValue: EditableGenerationParameters[K]) => {
    onChange({ ...value, [key]: nextValue });
  };
  const setSend = (key: GenerationParameterSendKey, enabled: boolean) => {
    onChange({
      ...value,
      enabledParameters: { ...enabledParametersFallback, ...(value.enabledParameters ?? {}), [key]: enabled },
    });
  };
  const isSendEnabled = (key: GenerationParameterSendKey) =>
    (value.enabledParameters ?? enabledParametersFallback)[key] !== false;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <ParamInput
          label="Temperature"
          help="Controls randomness. Lower values make output more focused and deterministic; higher values make it more creative and varied."
          value={value.temperature}
          onChange={(nextValue) => set("temperature", nextValue)}
          sendEnabled={isSendEnabled("temperature")}
          onSendChange={(enabled) => setSend("temperature", enabled)}
          min={0}
          max={2}
          step={0.05}
        />
        <ParamInput
          label="Max Output Tokens"
          help="The maximum number of tokens the model can generate in a single response. Higher values allow longer replies."
          value={value.maxTokens}
          onChange={(nextValue) => set("maxTokens", nextValue)}
          sendEnabled={isSendEnabled("maxTokens")}
          onSendChange={(enabled) => setSend("maxTokens", enabled)}
          min={1}
          step={256}
        />
        <ParamInput
          label="Top P"
          help="Nucleus sampling: only considers tokens whose cumulative probability reaches this threshold. Lower values make output more focused."
          value={value.topP}
          onChange={(nextValue) => set("topP", nextValue)}
          sendEnabled={isSendEnabled("topP")}
          onSendChange={(enabled) => setSend("topP", enabled)}
          min={0}
          max={1}
          step={0.05}
        />
        <ParamInput
          label="Top K"
          help="Limits the model to only consider the top K most likely tokens at each step. 0 disables this limit."
          value={value.topK}
          onChange={(nextValue) => set("topK", nextValue)}
          sendEnabled={isSendEnabled("topK")}
          onSendChange={(enabled) => setSend("topK", enabled)}
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
          sendEnabled={isSendEnabled("frequencyPenalty")}
          onSendChange={(enabled) => setSend("frequencyPenalty", enabled)}
          min={-2}
          max={2}
          step={0.05}
        />
        <ParamInput
          label="Presence"
          help="Penalizes tokens that have appeared at all, regardless of frequency. Positive values encourage the model to talk about new topics."
          value={value.presencePenalty}
          onChange={(nextValue) => set("presencePenalty", nextValue)}
          sendEnabled={isSendEnabled("presencePenalty")}
          onSendChange={(enabled) => setSend("presencePenalty", enabled)}
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
          <DraftTextarea
            value={value.assistantPrefill ?? ""}
            onCommit={(nextValue) => set("assistantPrefill", nextValue)}
            rows={3}
            className={PARAM_TEXTAREA_CLASS}
            placeholder="<thinking>"
          />
        </div>
        <ThinkingTagsInput
          value={value.customThinkingTags}
          onChange={(nextValue) => set("customThinkingTags", nextValue)}
        />
        <CustomParametersInput
          value={value.customParameters}
          onChange={(nextValue) => set("customParameters", nextValue)}
        />
        {showOpenRouterServiceTier && (
          <div>
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              OpenRouter Service Tier
              <HelpTooltip
                text="Optional OpenRouter routing tier. Default sends no service_tier; Flex can be cheaper and slower, Priority can be faster and more expensive."
                size="0.625rem"
              />
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {OPENROUTER_SERVICE_TIERS.map((tier) => (
                <button
                  key={tier ?? "default"}
                  type="button"
                  onClick={() => set("serviceTier", tier)}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
                    value.serviceTier === tier ? PARAM_CHOICE_ACTIVE_CLASS : PARAM_CHOICE_IDLE_CLASS,
                  )}
                >
                  {tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Default"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <ParameterHeader
            label="Reasoning Effort"
            help="How much reasoning work the provider should spend before responding. Unsupported tiers are lowered to the strongest compatible tier automatically."
            sendEnabled={isSendEnabled("reasoningEffort")}
            onSendChange={(enabled) => setSend("reasoningEffort", enabled)}
          />
          <div className="mt-1 flex flex-wrap gap-1.5">
            {REASONING_LEVELS.map((level) => (
              <button
                key={level ?? "none"}
                onClick={() => set("reasoningEffort", level)}
                className={cn(
                  "rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
                  value.reasoningEffort === level ? PARAM_CHOICE_ACTIVE_CLASS : PARAM_CHOICE_IDLE_CLASS,
                )}
              >
                {level ? level.charAt(0).toUpperCase() + level.slice(1) : "None"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <ParameterHeader
            label="Verbosity"
            help="Controls how long and detailed responses should be. Low keeps things concise; high encourages elaborate, descriptive output."
            sendEnabled={isSendEnabled("verbosity")}
            onSendChange={(enabled) => setSend("verbosity", enabled)}
          />
          <div className="mt-1 flex flex-wrap gap-1.5">
            {VERBOSITY_LEVELS.map((level) => (
              <button
                key={level ?? "none"}
                onClick={() => set("verbosity", level)}
                className={cn(
                  "rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
                  value.verbosity === level ? PARAM_CHOICE_ACTIVE_CLASS : PARAM_CHOICE_IDLE_CLASS,
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

function ThinkingTagsInput({
  value,
  onChange,
}: {
  value: ThinkingTagPair[];
  onChange: (next: ThinkingTagPair[]) => void;
}) {
  const serialized = stringifyThinkingTags(value);
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
    const parsed = parseThinkingTagsDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onChange(parsed.value);
    setDraft(stringifyThinkingTags(parsed.value));
  };

  return (
    <div>
      <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
        Thinking Tags
        <HelpTooltip
          text="{{thinking}} marks the hidden reasoning slot and will be replaced by any content between the specified tags. Built-in think, thinking, thought, pipe, channel, and bracket pairs are already recognized."
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
        rows={2}
        spellCheck={false}
        className={PARAM_TEXTAREA_CLASS}
        placeholder={focused ? "" : `<thinking>${THINKING_TAG_CONTENT_PLACEHOLDER}</thinking>`}
      />
      {error ? (
        <p className="mt-1 text-[0.5625rem] text-amber-500">{error}</p>
      ) : (
        <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/70">
          One wrapper per line. {THINKING_TAG_CONTENT_PLACEHOLDER} will be replaced by any content between the specified
          tags.
        </p>
      )}
    </div>
  );
}

function stringifyThinkingTags(value: ThinkingTagPair[] | null | undefined): string {
  const normalized = normalizeThinkingTagPairs(value);
  return normalized.map((pair) => `${pair.open}${THINKING_TAG_CONTENT_PLACEHOLDER}${pair.close}`).join("\n");
}

function parseThinkingTagsDraft(draft: string): { ok: true; value: ThinkingTagPair[] } | { ok: false; error: string } {
  const lines = draft
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: true, value: [] };

  const pairs: ThinkingTagPair[] = [];
  for (const line of lines) {
    const separatorIndex = line.indexOf(THINKING_TAG_CONTENT_PLACEHOLDER);
    if (separatorIndex < 0) {
      return { ok: false, error: `Use ${THINKING_TAG_CONTENT_PLACEHOLDER} between opening and closing tags.` };
    }
    if (line.indexOf(THINKING_TAG_CONTENT_PLACEHOLDER, separatorIndex + THINKING_TAG_CONTENT_PLACEHOLDER.length) >= 0) {
      return { ok: false, error: `Use ${THINKING_TAG_CONTENT_PLACEHOLDER} only once per line.` };
    }
    const open = line.slice(0, separatorIndex).trim();
    const close = line.slice(separatorIndex + THINKING_TAG_CONTENT_PLACEHOLDER.length).trim();
    if (!open || !close) {
      return {
        ok: false,
        error: `Both opening and closing tags are required around ${THINKING_TAG_CONTENT_PLACEHOLDER}.`,
      };
    }
    pairs.push({ open, close });
  }

  return { ok: true, value: normalizeThinkingTagPairs(pairs) };
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
    if (!focused && error === null) {
      setDraft(serialized);
    }
  }, [error, focused, serialized]);

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
        aria-invalid={error ? true : undefined}
        className={PARAM_TEXTAREA_CLASS}
        placeholder={focused ? "" : '{ "reasoning_effort": "high" }'}
      />
      {error ? (
        <p className="mt-1 text-[0.5625rem] text-amber-500">{error}</p>
      ) : (
        <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/70">
          Accepts strings, numbers, booleans, null, arrays, and nested objects. Bare string values are saved as strings.
        </p>
      )}
    </div>
  );
}

function stringifyCustomParameters(value: Record<string, unknown> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) return "";
  return JSON.stringify(value, null, 2);
}

function ParamInput({
  label,
  value,
  onChange,
  sendEnabled,
  onSendChange,
  min,
  max,
  step,
  help,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  sendEnabled: boolean;
  onSendChange: (enabled: boolean) => void;
  min: number;
  max?: number;
  step: number;
  help?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(String(value));
    setError(null);
  }, [value]);

  const commit = () => {
    const nextValue = parseFloat(draft);
    if (!Number.isNaN(nextValue) && nextValue >= min && (max === undefined || nextValue <= max)) {
      onChange(nextValue);
      setDraft(String(nextValue));
      setError(null);
      return;
    }
    setError(
      max === undefined
        ? `Enter a value of ${min.toLocaleString()} or higher.`
        : `Enter a value from ${min.toLocaleString()} to ${max.toLocaleString()}.`,
    );
    setDraft(String(value));
  };

  return (
    <div>
      <ParameterHeader label={label} help={help} sendEnabled={sendEnabled} onSendChange={onSendChange} />
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        min={min}
        {...(max === undefined ? {} : { max })}
        step={step}
        className="mt-0.5 w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
      />
      {error && <p className="mt-1 text-[0.5625rem] text-amber-500">{error}</p>}
    </div>
  );
}

function ParameterHeader({
  label,
  help,
  sendEnabled,
  onSendChange,
}: {
  label: string;
  help?: string;
  sendEnabled: boolean;
  onSendChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="inline-flex min-w-0 items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
        <span className="truncate">{label}</span>
        {help && <HelpTooltip text={help} size="0.625rem" />}
      </span>
      <SettingsSwitch
        ariaLabel={`Send ${label} parameter`}
        checked={sendEnabled}
        onChange={onSendChange}
        labelPosition="start"
        className="!gap-0 !rounded-md !p-0 hover:!bg-transparent"
        title={sendEnabled ? "This parameter is sent to the model" : "This parameter is not sent to the model"}
      />
    </div>
  );
}
