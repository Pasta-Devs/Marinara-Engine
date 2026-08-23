import { useEffect, useState } from "react";
import {
  GENERATION_PARAMETER_SEND_KEYS,
  normalizeThinkingTagPairs,
  type GenerationParameterSendKey,
  type GenerationParameterSendMap,
  type GenerationParameters,
  type ManagedGenerationParameterDefinition,
  type ThinkingTagPair,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { DraftTextarea } from "./DraftTextarea";
import { HelpTooltip } from "./HelpTooltip";
import { parseGenerationParameterDraft } from "../../lib/generation-parameter-draft";
import { parseCustomParametersDraft } from "../../lib/generation-custom-parameters";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useCustomGenerationParameters } from "../../hooks/use-custom-generation-parameters";

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
  | "assistantReasoningPrefill"
  | "customThinkingTags"
  | "customParameters"
  | "managedCustomParameters"
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
  "mt-1 w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed [text-indent:0] ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/60 placeholder:[text-indent:0] focus:outline-none focus:ring-[var(--ring)]";

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
  assistantReasoningPrefill: "",
  customThinkingTags: [],
  customParameters: {},
  managedCustomParameters: {},
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
  assistantReasoningPrefill: "",
  customThinkingTags: [],
  customParameters: {},
  managedCustomParameters: {},
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
  if (typeof source.assistantReasoningPrefill === "string") {
    next.assistantReasoningPrefill = source.assistantReasoningPrefill;
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
  if (
    source.managedCustomParameters &&
    typeof source.managedCustomParameters === "object" &&
    !Array.isArray(source.managedCustomParameters)
  ) {
    const managedValues = Object.fromEntries(
      Object.entries(source.managedCustomParameters as Record<string, unknown>).flatMap(([id, candidate]) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
        const record = candidate as Record<string, unknown>;
        if (typeof record.enabled !== "boolean" || typeof record.value !== "number" || !Number.isFinite(record.value)) {
          return [];
        }
        return [[id, { enabled: record.enabled, value: record.value }]];
      }),
    );
    if (Object.keys(managedValues).length > 0) next.managedCustomParameters = managedValues;
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
  const { t: localizeUi } = useUiTranslation();
  const { data: managedDefinitions = [] } = useCustomGenerationParameters();
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
  const setManagedParameter = (
    definition: ManagedGenerationParameterDefinition,
    patch: Partial<{ enabled: boolean; value: number }>,
  ) => {
    const current = value.managedCustomParameters[definition.id] ?? {
      enabled: false,
      value: definition.min,
    };
    set("managedCustomParameters", {
      ...value.managedCustomParameters,
      [definition.id]: { ...current, ...patch },
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <ParamInput
          label={localizeUi("ui.ui.generationparametersfields.temperature")}
          help={localizeUi("ui.ui.generationparametersfields.controlsRandomnessLowerValuesMakeOutputMoreFocusedAnd")}
          value={value.temperature}
          onChange={(nextValue) => set("temperature", nextValue)}
          sendEnabled={isSendEnabled("temperature")}
          onSendChange={(enabled) => setSend("temperature", enabled)}
          min={0}
          max={2}
          step={0.05}
        />
        <ParamInput
          label={localizeUi("ui.agents.agenteditor.maxOutputTokens")}
          help={localizeUi("ui.ui.generationparametersfields.theMaximumNumberOfTokensTheModelCanGenerate")}
          value={value.maxTokens}
          onChange={(nextValue) => set("maxTokens", nextValue)}
          sendEnabled={isSendEnabled("maxTokens")}
          onSendChange={(enabled) => setSend("maxTokens", enabled)}
          min={1}
          step={256}
        />
        <ParamInput
          label={localizeUi("ui.ui.generationparametersfields.topP")}
          help={localizeUi(
            "ui.ui.generationparametersfields.nucleusSamplingOnlyConsidersTokensWhoseCumulativeProbabilityReaches",
          )}
          value={value.topP}
          onChange={(nextValue) => set("topP", nextValue)}
          sendEnabled={isSendEnabled("topP")}
          onSendChange={(enabled) => setSend("topP", enabled)}
          min={0}
          max={1}
          step={0.05}
        />
        <ParamInput
          label={localizeUi("ui.ui.generationparametersfields.topK")}
          help={localizeUi("ui.ui.generationparametersfields.limitsTheModelToOnlyConsiderTheTopK")}
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
          label={localizeUi("ui.ui.generationparametersfields.frequency")}
          help={localizeUi("ui.ui.generationparametersfields.penalizesTokensBasedOnHowOftenTheyVeAlready")}
          value={value.frequencyPenalty}
          onChange={(nextValue) => set("frequencyPenalty", nextValue)}
          sendEnabled={isSendEnabled("frequencyPenalty")}
          onSendChange={(enabled) => setSend("frequencyPenalty", enabled)}
          min={-2}
          max={2}
          step={0.05}
        />
        <ParamInput
          label={localizeUi("ui.ui.generationparametersfields.presence")}
          help={localizeUi("ui.ui.generationparametersfields.penalizesTokensThatHaveAppearedAtAllRegardlessOf")}
          value={value.presencePenalty}
          onChange={(nextValue) => set("presencePenalty", nextValue)}
          sendEnabled={isSendEnabled("presencePenalty")}
          onSendChange={(enabled) => setSend("presencePenalty", enabled)}
          min={-2}
          max={2}
          step={0.05}
        />
      </div>
      {managedDefinitions.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {managedDefinitions.map((definition) => {
            const stored = value.managedCustomParameters[definition.id];
            return (
              <ParamInput
                key={definition.id}
                label={definition.name}
                help={definition.tooltip}
                value={stored?.value ?? definition.min}
                onChange={(nextValue) => setManagedParameter(definition, { value: nextValue })}
                sendEnabled={stored?.enabled === true}
                onSendChange={(enabled) => setManagedParameter(definition, { enabled })}
                min={definition.min}
                max={definition.max}
                step={Math.max(0.001, Math.min(1, (definition.max - definition.min) / 100))}
              />
            );
          })}
        </div>
      )}
      <div className="space-y-2">
        <div>
          <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.ui.generationparametersfields.assistantPrefill")}
            <HelpTooltip
              text={localizeUi("ui.ui.generationparametersfields.optionalAssistantRoleTextAppendedAfterTheFinalUser")}
              size="0.625rem"
            />
          </span>
          <DraftTextarea
            value={value.assistantPrefill ?? ""}
            onCommit={(nextValue) => set("assistantPrefill", nextValue)}
            rows={3}
            className={PARAM_TEXTAREA_CLASS}
            placeholder={localizeUi("ui.ui.generationparametersfields.thinking", {
              value1: "<",
              value2: ">",
            }).trimStart()}
          />
        </div>
        <div>
          <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.ui.generationparametersfields.assistantReasoningPrefill")}
            <HelpTooltip
              text={localizeUi("ui.ui.generationparametersfields.optionalReasoningContentOnTheFinalAssistantMessage")}
              size="0.625rem"
            />
          </span>
          <DraftTextarea
            value={value.assistantReasoningPrefill ?? ""}
            onCommit={(nextValue) => set("assistantReasoningPrefill", nextValue)}
            rows={3}
            className={PARAM_TEXTAREA_CLASS}
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
              {localizeUi("ui.ui.generationparametersfields.openrouterServiceTier")}
              <HelpTooltip
                text={localizeUi(
                  "ui.ui.generationparametersfields.optionalOpenrouterRoutingTierDefaultSendsNoServiceTier",
                )}
                size="0.625rem"
              />
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {OPENROUTER_SERVICE_TIERS.map((tier) => (
                <button
                  key={tier ?? "default"}
                  type="button"
                  onClick={() => set("serviceTier", tier)}
                  aria-pressed={value.serviceTier === tier}
                  className={cn(
                    "rounded-md px-2 py-1 text-[0.625rem] font-medium transition-all",
                    value.serviceTier === tier ? PARAM_CHOICE_ACTIVE_CLASS : PARAM_CHOICE_IDLE_CLASS,
                  )}
                >
                  {tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : localizeUi("ui.noodle.noodlehome.default")}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <ParameterHeader
            label={localizeUi("ui.ui.generationparametersfields.reasoningEffort")}
            help={localizeUi("ui.ui.generationparametersfields.howMuchReasoningWorkTheProviderShouldSpendBefore")}
            sendEnabled={isSendEnabled("reasoningEffort")}
            onSendChange={(enabled) => setSend("reasoningEffort", enabled)}
          />
          <div className="mt-1 flex flex-wrap gap-1.5">
            {REASONING_LEVELS.map((level) => (
              <button
                key={level ?? "none"}
                type="button"
                onClick={() => set("reasoningEffort", level)}
                aria-pressed={value.reasoningEffort === level}
                className={cn(
                  "rounded-md px-2 py-1 text-[0.625rem] font-medium transition-all",
                  value.reasoningEffort === level ? PARAM_CHOICE_ACTIVE_CLASS : PARAM_CHOICE_IDLE_CLASS,
                )}
              >
                {level
                  ? level.charAt(0).toUpperCase() + level.slice(1)
                  : localizeUi("ui.ui.generationparametersfields.reasoningOff")}
              </button>
            ))}
          </div>
        </div>
        <div>
          <ParameterHeader
            label={localizeUi("ui.ui.generationparametersfields.verbosity")}
            help={localizeUi("ui.ui.generationparametersfields.controlsHowLongAndDetailedResponsesShouldBeLow")}
            sendEnabled={isSendEnabled("verbosity")}
            onSendChange={(enabled) => setSend("verbosity", enabled)}
          />
          <div className="mt-1 flex flex-wrap gap-1.5">
            {VERBOSITY_LEVELS.map((level) => (
              <button
                key={level ?? "none"}
                type="button"
                onClick={() => set("verbosity", level)}
                aria-pressed={value.verbosity === level}
                className={cn(
                  "rounded-md px-2 py-1 text-[0.625rem] font-medium transition-all",
                  value.verbosity === level ? PARAM_CHOICE_ACTIVE_CLASS : PARAM_CHOICE_IDLE_CLASS,
                )}
              >
                {level
                  ? level.charAt(0).toUpperCase() + level.slice(1)
                  : localizeUi("ui.game.gamesurfacecomponent.none")}
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
  const { t: localizeUi } = useUiTranslation();
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
        {localizeUi("ui.ui.thinkingtagsinput.thinkingTags")}
        <HelpTooltip
          text={localizeUi("ui.ui.thinkingtagsinput.thinkingMarksTheHiddenReasoningSlotAndWillBe")}
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
        placeholder={
          focused
            ? ""
            : localizeUi("ui.ui.thinkingtagsinput.thinkingValue1Thinking", { value1: THINKING_TAG_CONTENT_PLACEHOLDER })
        }
      />
      {error ? (
        <p className="mt-1 text-[0.5625rem] text-amber-500">{error}</p>
      ) : (
        <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/70">
          {localizeUi("ui.ui.thinkingtagsinput.oneWrapperPerLine")} {THINKING_TAG_CONTENT_PLACEHOLDER}{" "}
          {localizeUi("ui.ui.thinkingtagsinput.willBeReplacedByAnyContentBetweenTheSpecified")}
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
  const { t: localizeUi } = useUiTranslation();
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
        {localizeUi("ui.ui.customparametersinput.customParameters")}
        <HelpTooltip
          text={localizeUi("ui.ui.customparametersinput.optionalRawJsonObjectMergedIntoTheProviderRequest")}
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
        placeholder={focused ? "" : localizeUi("ui.ui.customparametersinput.reasoningEffortHigh")}
      />
      {error ? (
        <p className="mt-1 text-[0.5625rem] text-amber-500">{error}</p>
      ) : (
        <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/70">
          {localizeUi("ui.ui.customparametersinput.acceptsStringsNumbersBooleansNullArraysAndNestedObjects")}
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
    const nextValue = parseGenerationParameterDraft(draft);
    if (nextValue !== null && nextValue >= min && (max === undefined || nextValue <= max)) {
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
        aria-label={label}
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
  const { t: localizeUi } = useUiTranslation();
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
        title={
          sendEnabled
            ? localizeUi("ui.ui.parameterheader.thisParameterIsSentToTheModel")
            : localizeUi("ui.ui.parameterheader.thisParameterIsNotSentToTheModel")
        }
      />
    </div>
  );
}
