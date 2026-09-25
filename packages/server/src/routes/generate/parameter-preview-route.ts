import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  DEFAULT_GENERATION_PARAMS,
  GENERATION_PARAMETER_SEND_KEYS,
  CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY,
  parseManagedGenerationParameterDefinitions,
} from "@marinara-engine/shared";
import { createConnectionsStorage } from "../../services/storage/connections.storage.js";
import { createChatsStorage } from "../../services/storage/chats.storage.js";
import { createPromptsStorage } from "../../services/storage/prompts.storage.js";
import { createAppSettingsStorage } from "../../services/storage/app-settings.storage.js";
import { parsePresetParameters } from "../../services/prompt/assembler.js";
import { resolveGenerationProviderRuntime } from "../../services/generation/provider-generation-runtime.js";
import {
  resolveModelAccessPolicy,
  mergeModelContextLimit,
  resolveStoredModelContextLimit,
} from "../../services/generation/model-access-policy.js";
import { sentOutputBudget } from "../../services/generation/empty-response-reason.js";
import { buildGenerationPromptPresetCandidates } from "./prompt-preset-selection.js";
import { resolveBaseUrl, parseExtra, parseStoredGenerationParameters } from "./generate-route-utils.js";

const previewSchema = z.object({ connectionId: z.string().min(1), chatId: z.string().min(1).optional() });

/** Read saved settings using the same layer resolver as generation, without assembling a prompt or calling a model. */
export async function registerParameterPreviewRoute(app: FastifyInstance) {
  app.post("/parameters", async (request, reply) => {
    const input = previewSchema.parse(request.body);
    const connection = await createConnectionsStorage(app.db).getById(input.connectionId);
    if (!connection) return reply.status(404).send({ error: "Connection not found" });
    const chat = input.chatId ? await createChatsStorage(app.db).getById(input.chatId) : null;
    if (input.chatId && !chat) return reply.status(404).send({ error: "Chat not found" });
    const metadata = parseExtra(chat?.metadata);
    const chatMode = chat?.mode ?? "roleplay";
    const presets = createPromptsStorage(app.db);
    let preset: Awaited<ReturnType<typeof presets.getById>> = null;
    for (const candidate of buildGenerationPromptPresetCandidates({
      chatMode,
      chatPromptPresetId: chat?.promptPresetId,
      connectionPromptPresetId: connection.promptPresetId,
    })) {
      preset = await presets.getById(candidate.id);
      if (preset) break;
    }
    const presetParams = preset ? parsePresetParameters(preset.parameters) : { ...DEFAULT_GENERATION_PARAMS };
    const storedPresetParams = parseStoredGenerationParameters(preset?.parameters);
    const policy = resolveModelAccessPolicy(connection);
    const definitions = parseManagedGenerationParameterDefinitions(
      await createAppSettingsStorage(app.db).get(CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY),
    );
    const runtime = resolveGenerationProviderRuntime({
      connectionId: connection.id,
      connection: { ...connection, apiKey: "" },
      baseUrl: resolveBaseUrl(connection),
      chatMode,
      isSceneChat: metadata?.sceneStatus === "active",
      chatParameters: metadata?.chatParameters,
      managedParameterDefinitions: definitions,
      modelAccessPolicy: policy,
      initialSources: Object.fromEntries(Object.keys(storedPresetParams ?? {}).map((key) => [key, "preset"])),
      initial: {
        ...presetParams,
        enabledParameters: presetParams.enabledParameters,
        effectiveMaxContext: mergeModelContextLimit(
          policy,
          policy.effectiveMaxContext,
          preset ? resolveStoredModelContextLimit(policy, presetParams) : undefined,
        ),
      },
    });
    const cappedOutput = sentOutputBudget(runtime.maxTokens, connection.maxTokensOverride);
    const values: Record<string, unknown> = {
      ...presetParams,
      ...runtime.connectionParams,
      ...runtime.chatParams,
      ...Object.fromEntries(
        [
          ...GENERATION_PARAMETER_SEND_KEYS,
          "serviceTier",
          "assistantPrefill",
          "assistantReasoningPrefill",
          "customThinkingTags",
          "customParameters",
        ]
          .filter((key) => key in runtime)
          .map((key) => [key, runtime[key as keyof typeof runtime]]),
      ),
      maxTokens: cappedOutput,
      reasoningEffort: runtime.providerReasoningEffort,
    };
    const sources = runtime.parameterSources;
    for (const key of ["strictRoleFormatting", "singleUserMessage"]) {
      sources[key] =
        runtime.chatParams?.[key as "strictRoleFormatting"] !== undefined
          ? "chat"
          : runtime.connectionParams?.[key as "strictRoleFormatting"] !== undefined
            ? "connection"
            : storedPresetParams?.[key as "strictRoleFormatting"] !== undefined
              ? "preset"
              : "defaults";
    }
    if (cappedOutput !== runtime.maxTokens) sources.maxTokens = "outputCap";
    const keys = [
      ...GENERATION_PARAMETER_SEND_KEYS,
      "serviceTier",
      "strictRoleFormatting",
      "singleUserMessage",
      "assistantPrefill",
      "assistantReasoningPrefill",
      "customThinkingTags",
      "customParameters",
    ];
    return {
      chatName: chat?.name ?? null,
      inheritedParameters: {
        ...presetParams,
        ...runtime.connectionParams,
        enabledParameters: {
          ...Object.fromEntries(GENERATION_PARAMETER_SEND_KEYS.map((key) => [key, true])),
          ...presetParams.enabledParameters,
          ...runtime.connectionParams?.enabledParameters,
        },
      },
      parameters: Object.fromEntries(
        keys.map((key) => {
          const sendKey = key as (typeof GENERATION_PARAMETER_SEND_KEYS)[number];
          const disabled = runtime.enabledParameters?.[sendKey] === false;
          const suppressed = policy.suppressModelParameters && GENERATION_PARAMETER_SEND_KEYS.includes(sendKey);
          return [
            key,
            {
              value: values[key] ?? null,
              source: suppressed
                ? "provider"
                : disabled
                  ? (sources[`send:${key}`] ?? (storedPresetParams?.enabledParameters ? "preset" : "defaults"))
                  : (sources[key] ?? "defaults"),
              enabled: !disabled && !suppressed && (values[key] !== undefined || key === "reasoningEffort"),
            },
          ];
        }),
      ),
    };
  });
}
