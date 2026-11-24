import type { EffectiveGenerationParameters } from "../../hooks/use-effective-generation-parameters";
import { useEffect, useRef, useState } from "react";
import {
  GENERATION_PARAMETER_SEND_KEYS,
  isClaudeOpus55Model,
  customRequestHeadersSchema,
  normalizeThinkingTagPairs,
  reasoningEffortChoices,
  relevantGenerationParameters,
  modelIgnoredGenerationParameters,
  verbosityChoices,
  type GenerationParameterChoice,
  type GenerationParameterKey,
  type GenerationParameterSendKey,
  type GenerationParameterSendMap,
  type GenerationParameters,
  type ModelParameterCapabilities,
  type ManagedGenerationParameterDefinition,
  type ThinkingTagPair,
} from "@marinara-engine/shared";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { MacroTextarea, type MacroTextareaProps } from "./MacroTextarea";
import { HelpTooltip } from "./HelpTooltip";
import { Select } from "./Select";
import { OvSeg } from "../overhaul/LoreEntryParts";
import { parseGenerationParameterDraft } from "../../lib/generation-parameter-draft";
import { parseCustomParametersDraft } from "../../lib/generation-custom-parameters";
import { generationLevelLabel } from "../../lib/generation-level-label";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useCustomGenerationParameters } from "../../hooks/use-custom-generation-parameters";

export type EditableGenerationParameters = Pick<
  GenerationParameters,
  | "temperature"
  | "maxTokens"
  | "topP"
  | "topK"
  | "minP"
  | "frequencyPenalty"
  | "presencePenalty"
  | "reasoningEffort"
  | "verbosity"
  | "serviceTier"
  | "strictRoleFormatting"
  | "singleUserMessage"
  | "assistantPrefill"
  | "assistantReasoningPrefill"
  | "customThinkingTags"
  | "customParameters"
  | "customHeaders"
  | "managedCustomParameters"
  | "enabledParameters"
>;

type EditableGenerationParameterOverrides = Partial<EditableGenerationParameters>;

const SERVICE_TIERS = [null, "flex", "priority"] as const;
const THINKING_TAG_CONTENT_PLACEHOLDER = "{{thinking}}";
/** Stands for "not set" (null) in a dropdown or segmented control, whose values are strings. */
const UNSET_CHOICE = "__unset__";
const PARAM_TEXTAREA_CLASS =
  "mari-chrome-field mt-1 w-full !rounded-md px-3 py-2 pr-8 text-xs leading-relaxed [text-indent:0] placeholder:[text-indent:0]";

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
  minP: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "maximum",
  verbosity: "high",
  serviceTier: null,
  strictRoleFormatting: true,
  singleUserMessage: false,
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
  minP: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "maximum",
  verbosity: "high",
  serviceTier: null,
  strictRoleFormatting: true,
  singleUserMessage: false,
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
  if (typeof source.minP === "number") next.minP = source.minP;
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
  if (typeof source.strictRoleFormatting === "boolean") next.strictRoleFormatting = source.strictRoleFormatting;
  if (typeof source.singleUserMessage === "boolean") next.singleUserMessage = source.singleUserMessage;
  if (source.customHeaders !== undefined) {
    const headers = customRequestHeadersSchema.safeParse(source.customHeaders);
    if (headers.success) next.customHeaders = headers.data;
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

/**
 * Only the settings these fields edit, picked from a full parameter set. A preset's stored parameters hold more
 * (Squash system messages, stop sequences, an imported Min P…), and the fields must never write defaults over them.
 */
export function pickEditableGenerationParameters(source: GenerationParameters): EditableGenerationParameters {
  const picked: Record<string, unknown> = {};
  for (const key of [...Object.keys(CHAT_PARAMETER_DEFAULTS), "customHeaders"]) {
    const value = (source as unknown as Record<string, unknown>)[key];
    if (value !== undefined) picked[key] = value;
  }
  return picked as EditableGenerationParameters;
}

export function getEditableGenerationParameters(
  defaults: EditableGenerationParameters,
  overrides: unknown,
  provider?: string | null,
): EditableGenerationParameters {
  const parsed = parseEditableGenerationParameters(overrides) ?? {};
  return {
    ...defaults,
    // Codex keeps its own thinking level until one is picked, so its parameters start at Default.
    ...(provider === "openai_chatgpt" ? { reasoningEffort: null } : {}),
    ...parsed,
    enabledParameters: mergeEnabledParameters(defaults.enabledParameters, parsed.enabledParameters),
  };
}

/** Settings the "not sent to this model" line can name, with their field labels, in the order the fields appear. */
const UNUSED_PARAMETER_LABELS: Array<[GenerationParameterKey, string]> = [
  ["temperature", "ui.ui.generationparametersfields.temperature"],
  ["maxTokens", "ui.agents.agenteditor.maxOutputTokens"],
  ["topP", "ui.ui.generationparametersfields.topP"],
  ["topK", "ui.ui.generationparametersfields.topK"],
  ["minP", "ui.ui.generationparametersfields.minP"],
  ["frequencyPenalty", "ui.ui.generationparametersfields.frequency"],
  ["presencePenalty", "ui.ui.generationparametersfields.presence"],
  ["assistantPrefill", "ui.ui.generationparametersfields.assistantPrefill"],
  ["assistantReasoningPrefill", "ui.ui.generationparametersfields.assistantReasoningPrefill"],
  ["reasoningEffort", "ui.ui.generationparametersfields.reasoningEffort"],
  ["verbosity", "ui.ui.generationparametersfields.verbosity"],
];

export function GenerationParametersFields({
  value,
  onChange,
  showServiceTier = false,
  showOpenRouterServiceTier = showServiceTier,
  showCustomHeaders = false,
  showTokenLimits = true,
  effectiveParameters,
  provider,
  model,
  baseUrl,
  modelCapabilities,
  enabledParametersFallback = LEGACY_PARAMETER_SEND_DEFAULTS,
  modelNote,
}: {
  value: EditableGenerationParameters;
  onChange: (next: EditableGenerationParameters) => void;
  showServiceTier?: boolean;
  showCustomHeaders?: boolean;
  showTokenLimits?: boolean;
  effectiveParameters?: EffectiveGenerationParameters;
  /** Used only when no provider is given. */
  showOpenRouterServiceTier?: boolean;
  provider?: string | null;
  model?: string | null;
  baseUrl?: string | null;
  modelCapabilities?: ModelParameterCapabilities | null;
  enabledParametersFallback?: GenerationParameterSendMap;
  /** One short line on which model these settings are for (Chat settings: "Uses your Main model, …"). */
  modelNote?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const effectiveHint = (key: string, displayValue?: string) => {
    const entry = effectiveParameters?.[key];
    if (!entry) return undefined;
    const value =
      displayValue ??
      (!entry.enabled
        ? localizeUi("generationParameters.effective.notSent")
        : entry.value === null
          ? localizeUi("generationParameters.effective.providerDefault")
          : typeof entry.value === "object"
            ? JSON.stringify(entry.value)
            : String(entry.value));
    return localizeUi("generationParameters.effective.value", {
      value,
      source: localizeUi(`generationParameters.source.${entry.source}`),
    });
  };
  const levelLabel = (level: string) => generationLevelLabel(level, localizeUi);
  // Levels read "Low", "High"; the saved and sent values stay as they are.
  const effectiveLevelHint = (key: "reasoningEffort" | "verbosity") => {
    const entry = effectiveParameters?.[key];
    return effectiveHint(key, entry?.enabled && typeof entry.value === "string" ? levelLabel(entry.value) : undefined);
  };
  const choiceTitle = (choice: GenerationParameterChoice<unknown>) =>
    choice.providerDefault
      ? localizeUi("generationParameters.providerDefaultLevel", { level: levelLabel(choice.providerDefault) })
      : choice.description;
  const effectiveLine = (key: string, displayValue?: string) =>
    effectiveParameters?.[key] ? (
      <p className="mt-1 break-words text-[0.625rem] text-[var(--muted-foreground)]" data-effective-parameter={key}>
        {effectiveHint(key, displayValue)}
      </p>
    ) : null;
  const { data: managedDefinitions = [] } = useCustomGenerationParameters();
  const context = {
    provider,
    model,
    baseUrl,
    capabilities: modelCapabilities ?? null,
    reasoningEffort: value.reasoningEffort,
  };
  const sent = provider === undefined ? null : relevantGenerationParameters(context);
  // A custom endpoint sends some settings the model behind it ignores (Gemini 3 sampling): those count as unsupported.
  const ignored = sent ? modelIgnoredGenerationParameters(context) : null;
  const relevant = sent && ignored ? new Set([...sent].filter((key) => !ignored.has(key))) : sent;
  // Settings this model never receives stay hidden, but the line below names them and can show them anyway.
  const [showUnused, setShowUnused] = useState(false);
  const unused = relevant
    ? UNUSED_PARAMETER_LABELS.filter(([key]) => !relevant.has(key) && (showTokenLimits || key !== "maxTokens"))
    : [];
  const isUnused = (key: GenerationParameterKey) => unused.some(([unusedKey]) => unusedKey === key);
  const show = (key: GenerationParameterKey) =>
    (showTokenLimits || key !== "maxTokens") &&
    (relevant
      ? relevant.has(key) || (showUnused && isUnused(key))
      : key !== "serviceTier" || showOpenRouterServiceTier);
  // A shown-anyway setting says it is not sent, in place of its effective value.
  const unusedNote = (key: GenerationParameterKey) =>
    showUnused && isUnused(key)
      ? localizeUi(
          ignored?.has(key) ? "generationParameters.unused.ignoredNote" : "generationParameters.unused.fieldNote",
        )
      : undefined;
  const effortChoices = reasoningEffortChoices({ ...context, selected: value.reasoningEffort }).filter(
    (choice) => choice.value !== null || !isClaudeOpus55Model(model ?? ""),
  );
  const verbosityOptions = verbosityChoices(context);
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
  const showSamplingGrid = show("temperature") || show("maxTokens") || show("topP") || show("topK") || show("minP");
  const showPenaltyGrid = show("frequencyPenalty") || show("presencePenalty");
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
      {(unused.length > 0 || modelNote) && (
        // Which model these are for, and a way to show the settings it ignores.
        <div className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]" data-unused-parameters="">
          {modelNote && <p>{modelNote}</p>}
          {unused.length > 0 && (
            <button
              type="button"
              className="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
              aria-expanded={showUnused}
              onClick={() => setShowUnused((current) => !current)}
            >
              {localizeUi(showUnused ? "generationParameters.unused.hide" : "generationParameters.unused.show")}
            </button>
          )}
        </div>
      )}
      {showSamplingGrid && (
        <div className="grid grid-cols-2 gap-2">
          {show("temperature") && (
            <ParamInput
              label={localizeUi("ui.ui.generationparametersfields.temperature")}
              help={localizeUi(
                "ui.ui.generationparametersfields.controlsRandomnessLowerValuesMakeOutputMoreFocusedAnd",
              )}
              value={value.temperature}
              onChange={(nextValue) => set("temperature", nextValue)}
              effective={unusedNote("temperature") ?? effectiveHint("temperature")}
              sendEnabled={isSendEnabled("temperature")}
              onSendChange={(enabled) => setSend("temperature", enabled)}
              min={0}
              max={2}
              step={0.05}
            />
          )}
          {show("maxTokens") && (
            <ParamInput
              label={localizeUi("ui.agents.agenteditor.maxOutputTokens")}
              help={localizeUi("ui.ui.generationparametersfields.theMaximumNumberOfTokensTheModelCanGenerate")}
              value={value.maxTokens}
              onChange={(nextValue) => set("maxTokens", nextValue)}
              effective={unusedNote("maxTokens") ?? effectiveHint("maxTokens")}
              sendEnabled={isSendEnabled("maxTokens")}
              onSendChange={(enabled) => setSend("maxTokens", enabled)}
              min={1}
              step={256}
            />
          )}
          {show("topP") && (
            <ParamInput
              label={localizeUi("ui.ui.generationparametersfields.topP")}
              help={localizeUi(
                "ui.ui.generationparametersfields.nucleusSamplingOnlyConsidersTokensWhoseCumulativeProbabilityReaches",
              )}
              value={value.topP}
              onChange={(nextValue) => set("topP", nextValue)}
              effective={unusedNote("topP") ?? effectiveHint("topP")}
              sendEnabled={isSendEnabled("topP")}
              onSendChange={(enabled) => setSend("topP", enabled)}
              min={0}
              max={1}
              step={0.05}
            />
          )}
          {show("topK") && (
            <ParamInput
              label={localizeUi("ui.ui.generationparametersfields.topK")}
              help={localizeUi("ui.ui.generationparametersfields.limitsTheModelToOnlyConsiderTheTopK")}
              value={value.topK}
              onChange={(nextValue) => set("topK", nextValue)}
              effective={unusedNote("topK") ?? effectiveHint("topK")}
              sendEnabled={isSendEnabled("topK")}
              onSendChange={(enabled) => setSend("topK", enabled)}
              min={0}
              max={500}
              step={1}
            />
          )}
          {/* 0 sends nothing. */}
          {show("minP") && (
            <ParamInput
              label={localizeUi("ui.ui.generationparametersfields.minP")}
              help={localizeUi("ui.ui.generationparametersfields.minPHelp")}
              value={value.minP ?? 0}
              onChange={(nextValue) => set("minP", nextValue)}
              effective={unusedNote("minP") ?? effectiveHint("minP")}
              min={0}
              max={1}
              step={0.01}
            />
          )}
        </div>
      )}
      {showPenaltyGrid && (
        <div className="grid grid-cols-2 gap-2">
          {show("frequencyPenalty") && (
            <ParamInput
              label={localizeUi("ui.ui.generationparametersfields.frequency")}
              help={localizeUi("ui.ui.generationparametersfields.penalizesTokensBasedOnHowOftenTheyVeAlready")}
              value={value.frequencyPenalty}
              onChange={(nextValue) => set("frequencyPenalty", nextValue)}
              effective={unusedNote("frequencyPenalty") ?? effectiveHint("frequencyPenalty")}
              sendEnabled={isSendEnabled("frequencyPenalty")}
              onSendChange={(enabled) => setSend("frequencyPenalty", enabled)}
              min={-2}
              max={2}
              step={0.05}
            />
          )}
          {show("presencePenalty") && (
            <ParamInput
              label={localizeUi("ui.ui.generationparametersfields.presence")}
              help={localizeUi("ui.ui.generationparametersfields.penalizesTokensThatHaveAppearedAtAllRegardlessOf")}
              value={value.presencePenalty}
              onChange={(nextValue) => set("presencePenalty", nextValue)}
              effective={unusedNote("presencePenalty") ?? effectiveHint("presencePenalty")}
              sendEnabled={isSendEnabled("presencePenalty")}
              onSendChange={(enabled) => setSend("presencePenalty", enabled)}
              min={-2}
              max={2}
              step={0.05}
            />
          )}
        </div>
      )}
      {show("customParameters") && managedDefinitions.length > 0 && (
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
        <div className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1">
            {localizeUi("settings.generation.postProcessing.label")}
            <HelpTooltip text={localizeUi("settings.generation.postProcessing.help")} size="0.625rem" />
          </span>
          <Select
            label={localizeUi("settings.generation.postProcessing.label")}
            className="mari-chrome-field mt-1 w-full rounded-md px-3 py-2 text-xs"
            value={value.singleUserMessage ? "single" : value.strictRoleFormatting ? "apply" : "none"}
            onChange={(next) =>
              onChange({
                ...value,
                strictRoleFormatting: next === "apply",
                singleUserMessage: next === "single",
              })
            }
            options={[
              { value: "apply", label: localizeUi("settings.generation.postProcessing.apply") },
              { value: "none", label: localizeUi("settings.generation.postProcessing.none") },
              { value: "single", label: localizeUi("settings.generation.postProcessing.single") },
            ]}
          />
          {effectiveLine(
            effectiveParameters?.singleUserMessage?.value ? "singleUserMessage" : "strictRoleFormatting",
            localizeUi(
              effectiveParameters?.singleUserMessage?.value
                ? "settings.generation.postProcessing.single"
                : effectiveParameters?.strictRoleFormatting?.value
                  ? "settings.generation.postProcessing.apply"
                  : "settings.generation.postProcessing.none",
            ),
          )}
        </div>
        {show("assistantPrefill") && (
          <div>
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.ui.generationparametersfields.assistantPrefill")}
              <HelpTooltip
                text={localizeUi("ui.ui.generationparametersfields.optionalAssistantRoleTextAppendedAfterTheFinalUser")}
                size="0.625rem"
              />
            </span>
            <DraftMacroTextarea
              value={value.assistantPrefill ?? ""}
              onCommit={(nextValue) => set("assistantPrefill", nextValue)}
              rows={3}
              title={localizeUi("ui.ui.generationparametersfields.assistantPrefill")}
              className={PARAM_TEXTAREA_CLASS}
              placeholder={localizeUi("ui.ui.generationparametersfields.thinking", {
                value1: "<",
                value2: ">",
              }).trimStart()}
            />
            {effectiveLine("assistantPrefill")}
          </div>
        )}
        {show("assistantReasoningPrefill") && (
          <div>
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.ui.generationparametersfields.assistantReasoningPrefill")}
              <HelpTooltip
                text={localizeUi("ui.ui.generationparametersfields.optionalReasoningContentOnTheFinalAssistantMessage")}
                size="0.625rem"
              />
            </span>
            <DraftMacroTextarea
              value={value.assistantReasoningPrefill ?? ""}
              onCommit={(nextValue) => set("assistantReasoningPrefill", nextValue)}
              rows={3}
              title={localizeUi("ui.ui.generationparametersfields.assistantReasoningPrefill")}
              className={PARAM_TEXTAREA_CLASS}
              placeholder={localizeUi("generationParameters.assistantReasoningPrefill.placeholder")}
            />
            {effectiveLine("assistantReasoningPrefill")}
          </div>
        )}
        {show("customThinkingTags") && (
          <ThinkingTagsInput
            value={value.customThinkingTags}
            onChange={(nextValue) => set("customThinkingTags", nextValue)}
          />
        )}
        {show("customThinkingTags") && effectiveLine("customThinkingTags")}
        {show("customParameters") && (
          <CustomParametersInput
            value={value.customParameters}
            onChange={(nextValue) => set("customParameters", nextValue)}
          />
        )}
        {show("customParameters") && effectiveLine("customParameters")}
        {showCustomHeaders && (
          <CustomParametersInput
            headers
            value={value.customHeaders ?? {}}
            onChange={(nextValue) => set("customHeaders", nextValue as Record<string, string>)}
          />
        )}
        {show("serviceTier") && (
          <div>
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("settings.generation.serviceTier.label")}
              <HelpTooltip text={localizeUi("settings.generation.serviceTier.help")} size="0.625rem" />
            </span>
            <div className="mt-1">
              <OvSeg
                label={localizeUi("settings.generation.serviceTier.label")}
                value={value.serviceTier ?? UNSET_CHOICE}
                onChange={(next) =>
                  set("serviceTier", next === UNSET_CHOICE ? null : (next as GenerationParameters["serviceTier"]))
                }
                options={SERVICE_TIERS.map((tier) => ({
                  value: tier ?? UNSET_CHOICE,
                  label: tier
                    ? tier.charAt(0).toUpperCase() + tier.slice(1)
                    : localizeUi("ui.noodle.noodlehome.default"),
                }))}
              />
            </div>
            {effectiveLine("serviceTier")}
          </div>
        )}
        {show("reasoningEffort") && (
          <div>
            <ParameterHeader
              label={localizeUi("ui.ui.generationparametersfields.reasoningEffort")}
              help={localizeUi(
                provider === "openai_chatgpt"
                  ? "generationParameters.reasoningEffort.codexHelp"
                  : "ui.ui.generationparametersfields.howMuchReasoningWorkTheProviderShouldSpendBefore",
              )}
              effective={effectiveLevelHint("reasoningEffort")}
              sendEnabled={isSendEnabled("reasoningEffort")}
              onSendChange={(enabled) => setSend("reasoningEffort", enabled)}
            />
            <Select
              label={localizeUi("ui.ui.generationparametersfields.reasoningEffort")}
              className="mari-chrome-field mt-1 w-full rounded-md px-3 py-2 text-xs"
              value={value.reasoningEffort ?? UNSET_CHOICE}
              onChange={(next) =>
                set("reasoningEffort", next === UNSET_CHOICE ? null : (next as GenerationParameters["reasoningEffort"]))
              }
              options={effortChoices.map((choice) => ({
                value: choice.value ?? UNSET_CHOICE,
                label:
                  choice.label !== null
                    ? levelLabel(choice.label)
                    : choice.kind === "default"
                      ? localizeUi("ui.noodle.noodlehome.default")
                      : localizeUi("ui.ui.generationparametersfields.reasoningOff"),
                description: choiceTitle(choice) || undefined,
              }))}
            />
          </div>
        )}
        {show("verbosity") && (
          <div>
            <ParameterHeader
              label={localizeUi("ui.ui.generationparametersfields.verbosity")}
              help={localizeUi("ui.ui.generationparametersfields.controlsHowLongAndDetailedResponsesShouldBeLow")}
              effective={effectiveLevelHint("verbosity")}
              sendEnabled={isSendEnabled("verbosity")}
              onSendChange={(enabled) => setSend("verbosity", enabled)}
            />
            <Select
              label={localizeUi("ui.ui.generationparametersfields.verbosity")}
              className="mari-chrome-field mt-1 w-full rounded-md px-3 py-2 text-xs"
              value={value.verbosity ?? UNSET_CHOICE}
              onChange={(next) =>
                set("verbosity", next === UNSET_CHOICE ? null : (next as GenerationParameters["verbosity"]))
              }
              options={verbosityOptions.map((choice) => ({
                value: choice.value ?? UNSET_CHOICE,
                label:
                  choice.label !== null ? levelLabel(choice.label) : localizeUi("ui.game.gamesurfacecomponent.none"),
                description: choiceTitle(choice) || undefined,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DraftMacroTextarea({
  value,
  onCommit,
  onFocus,
  onBlur,
  onExpandedClose,
  ...props
}: Omit<MacroTextareaProps, "value" | "onChange"> & {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const draftRef = useRef(draft);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  draftRef.current = draft;
  valueRef.current = value;
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [focused, value]);

  const commit = () => {
    if (draftRef.current !== valueRef.current) onCommitRef.current(draftRef.current);
  };

  useEffect(
    () => () => {
      if (draftRef.current !== valueRef.current) onCommitRef.current(draftRef.current);
    },
    [],
  );

  return (
    <MacroTextarea
      {...props}
      value={draft}
      onChange={setDraft}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        commit();
        setFocused(false);
        onBlur?.();
      }}
      onExpandedClose={() => {
        commit();
        onExpandedClose?.();
      }}
    />
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
      <MacroTextarea
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(nextValue) => {
          setDraft(nextValue);
          setError(null);
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onExpandedClose={commit}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        rows={2}
        spellCheck={false}
        title={localizeUi("ui.ui.thinkingtagsinput.thinkingTags")}
        ariaLabel={localizeUi("ui.ui.thinkingtagsinput.thinkingTags")}
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

export function CustomParametersInput({
  value,
  onChange,
  headers = false,
  help,
  placeholder,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  headers?: boolean;
  help?: string;
  placeholder?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const serialized = stringifyCustomParameters(value);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const label = localizeUi(
    headers ? "settings.connection.customHeaders.label" : "ui.ui.customparametersinput.customParameters",
  );

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
    if (headers && !customRequestHeadersSchema.safeParse(parsed.value).success) {
      setError(localizeUi("settings.connection.customHeaders.invalid"));
      return;
    }
    setError(null);
    onChange(parsed.value);
    setDraft(stringifyCustomParameters(parsed.value));
  };

  return (
    <div>
      <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
        {label}
        <HelpTooltip
          text={
            help ??
            localizeUi(
              headers
                ? "settings.connection.customHeaders.help"
                : "ui.ui.customparametersinput.optionalRawJsonObjectMergedIntoTheProviderRequest",
            )
          }
          size="0.625rem"
        />
      </span>
      <MacroTextarea
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(nextValue) => {
          setDraft(nextValue);
          setError(null);
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onExpandedClose={commit}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        rows={5}
        spellCheck={false}
        ariaInvalid={Boolean(error)}
        title={label}
        ariaLabel={label}
        className={PARAM_TEXTAREA_CLASS}
        placeholder={
          focused
            ? ""
            : (placeholder ??
              localizeUi(
                headers
                  ? "settings.connection.customHeaders.example"
                  : "ui.ui.customparametersinput.reasoningEffortHigh",
              ))
        }
      />
      {error ? (
        <p className="mt-1 text-[0.5625rem] text-amber-500">{error}</p>
      ) : (
        <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/70">
          {help ??
            localizeUi(
              headers
                ? "settings.connection.customHeaders.help"
                : "ui.ui.customparametersinput.acceptsStringsNumbersBooleansNullArraysAndNestedObjects",
            )}
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
  effective,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  /** Left out for a setting with no send switch (Min P: 0 sends nothing). */
  sendEnabled?: boolean;
  onSendChange?: (enabled: boolean) => void;
  min: number;
  max?: number;
  step: number;
  help?: string;
  effective?: string;
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
      <ParameterHeader
        label={label}
        help={help}
        effective={effective}
        sendEnabled={sendEnabled}
        onSendChange={onSendChange}
      />
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
        className="mari-chrome-field mari-chrome-field--compact mt-0.5 w-full !rounded-md px-2.5 py-1.5 text-xs"
      />
      {error && <p className="mt-1 text-[0.5625rem] text-amber-500">{error}</p>}
    </div>
  );
}

function ParameterHeader({
  label,
  help,
  effective,
  sendEnabled,
  onSendChange,
}: {
  label: string;
  help?: string;
  effective?: string;
  sendEnabled?: boolean;
  onSendChange?: (enabled: boolean) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      {/* min-h-5: the send switch's height, so a field without one (Min P) lines up with its neighbours. */}
      <div className="flex min-h-5 min-w-0 items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          <span className="truncate">{label}</span>
          {help && <HelpTooltip text={help} size="0.625rem" />}
        </span>
        {onSendChange ? (
          <SettingsSwitch
            ariaLabel={`Send ${label} parameter`}
            checked={sendEnabled !== false}
            onChange={onSendChange}
            labelPosition="start"
            className="!gap-0 !rounded-md !p-0 hover:!bg-transparent"
            title={
              sendEnabled
                ? localizeUi("ui.ui.parameterheader.thisParameterIsSentToTheModel")
                : localizeUi("ui.ui.parameterheader.thisParameterIsNotSentToTheModel")
            }
          />
        ) : null}
      </div>
      {effective && (
        // One line like the label: wrapping would push this column's input below its neighbour's.
        <p
          className="mt-1 truncate text-[0.625rem] text-[var(--muted-foreground)]"
          title={effective}
          data-effective-parameter={label}
        >
          {effective}
        </p>
      )}
    </>
  );
}
