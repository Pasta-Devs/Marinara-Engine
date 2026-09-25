// Shared request contracts for host-owned generation. Keep provider implementations on the host.
import type { GenerationParameterSendMap } from "./prompt.js";
import type { ImageGenerationQuality } from "./connection.js";
import type {
  ImageGenerationDefaultsProfile,
  ComfyUiLoraSetting,
  NovelAiDefaults,
} from "./image-generation-defaults.js";
import type { SceneIllustrationCharacterPrompt } from "./sidecar.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Internal context-fitting hint: prompt data is preserved before chat history. */
  contextKind?: "prompt" | "history" | "injection";
  /** For tool result messages */
  tool_call_id?: string;
  /** For assistant messages with tool calls */
  tool_calls?: LLMToolCall[];
  /** Base64 data URLs for multimodal image inputs */
  images?: string[];
  /** Base64 data URLs for provider-native file/document inputs */
  files?: Array<{
    type: string;
    data: string;
    filename?: string;
  }>;
  /** Base64 data URLs for provider-native audio/video inputs */
  media?: ChatMediaAttachment[];
  /** Provider-specific metadata (e.g. Gemini parts with thought signatures) */
  providerMetadata?: Record<string, unknown>;
}

export interface ChatMediaAttachment {
  kind: "audio" | "video";
  data: string;
  mimeType: string;
  filename?: string;
}

export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Total context window limit for prompt + completion tokens. */
  maxContext?: number;
  /** Managed context must fail visibly instead of silently trimming scene history or instructions. */
  preserveContext?: boolean;
  topP?: number;
  topK?: number;
  minP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  stop?: string[];
  /** Tool/function definitions for function calling */
  tools?: LLMToolDefinition[];
  /** OpenAI-compatible tool selection policy for the current provider round. */
  toolChoice?: "auto" | "required";
  /** Enable provider-native prompt caching when supported */
  enableCaching?: boolean;
  /** Anthropic and Claude Subscription: request a 1-hour prompt-cache TTL. */
  anthropicExtendedCacheTtl?: boolean;
  /** Anthropic cache breakpoint depth from the newest message. 0 = newest message. */
  cachingAtDepth?: number;
  /** Callback for streaming thinking/reasoning content */
  onThinking?: (chunk: string) => void;
  /** Prefer provider APIs that expose reasoning summaries when available */
  captureReasoning?: boolean;
  /** Callback for streaming text tokens as they arrive (used in tool path) */
  onToken?: (chunk: string) => void | Promise<void>;
  /** Enable extended thinking (reasoning models) */
  enableThinking?: boolean;
  /**
   * Reasoning effort level for models that support it.
   * `none` is an explicit request to disable thinking; `undefined` leaves the
   * provider/model default untouched.
   */
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  /** When true, previous provider-native reasoning state is not reused. */
  excludePastReasoning?: boolean;
  /** Output verbosity for GPT-5+ models */
  verbosity?: "low" | "medium" | "high";
  /** Emit provider prompt debug logs even when normal debug logging is disabled. */
  debugMode?: boolean;
  /** OpenRouter-only service tier. */
  serviceTier?: "flex" | "priority" | null;
  /** Abort signal — when triggered, the in-flight LLM request should be cancelled. */
  signal?: AbortSignal;
  /**
   * Invoked when a rate-limit-aware retry pauses before re-attempting the request (proxy 429 /
   * per-connection throttle). Callers (e.g. Professor Mari) use this to surface a "paused,
   * resuming in Ns" indicator instead of appearing to hang.
   */
  onRateLimitPause?: (info: { attempt: number; delayMs: number; reason: "rate_limit" | "throttle" }) => void;
  /** Callback to receive the full response parts (for providers that return structured metadata like Gemini thought signatures) */
  onResponseParts?: (parts: unknown[]) => void;
  /** OpenRouter: preferred provider for model routing */
  openrouterProvider?: string | null;
  /** Encrypted reasoning items from a previous Responses API turn to replay for reasoning continuity */
  encryptedReasoningItems?: unknown[];
  /** Callback to receive encrypted reasoning items from the current response (store for next turn) */
  onEncryptedReasoning?: (items: unknown[]) => void;
  /** Callback to receive Chat Completions reasoning fields that must be replayed for some providers */
  onChatCompletionsReasoning?: (metadata: Record<string, unknown>) => void;
  /** Force a specific response format (e.g. { type: "json_object" } or a JSON schema config) */
  responseFormat?: { type: string; [key: string]: unknown };
  /** Raw provider request parameters merged into the outgoing request body. */
  customParameters?: Record<string, unknown>;
  /** Per-parameter request switches. Missing map preserves legacy send behavior. */
  enabledParameters?: GenerationParameterSendMap;
  /** Do not add inferred sampler/model parameters; max output tokens and customParameters still apply. */
  suppressModelParameters?: boolean;
  /**
   * Skip sending tools to the provider API and rely entirely on textual tool-call parsing.
   * Set by the local-sidecar provider when native tool calls are disabled (no --jinja),
   * because sending a tools array to a server started without Jinja templates produces
   * garbled or ignored output. The tools array is still used for parsing the response.
   */
  forceTextualToolCalls?: boolean;
}

/** Token usage statistics returned by the model */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedPromptTokens?: number;
  cacheWritePromptTokens?: number;
  /** Hidden reasoning tokens included in completion/output tokens by reasoning models. */
  completionReasoningTokens?: number;
  /** Audio output tokens included in completion/output tokens, when reported. */
  completionAudioTokens?: number;
  /** Predicted output tokens accepted by the model, when reported. */
  acceptedPredictionTokens?: number;
  /** Predicted output tokens rejected by the model but still counted in output usage. */
  rejectedPredictionTokens?: number;
  /** Provider-reported stream finish reason when usage is returned from a streaming generator. */
  finishReason?: "stop" | "tool_calls" | "length" | string;
}

/** Result from a non-streaming chat call that may include tool calls */
export interface ChatCompletionResult {
  content: string | null;
  toolCalls: LLMToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | string;
  usage?: LLMUsage;
  /** Provider-native metadata to replay with the assistant message, e.g. DeepSeek reasoning_content */
  providerMetadata?: Record<string, unknown>;
}

export interface ContextFitResult {
  messages: ChatMessage[];
  maxContext?: number;
  maxTokens?: number;
  inputBudget?: number;
  reservedTokens?: number;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  trimmed: boolean;
}

export type GenerationFallbackCategory = "main" | "agents" | "illustrator" | "video";

export type GenerationFallbackNotice = {
  category: GenerationFallbackCategory;
  connectionId: string;
  connectionName: string;
  model: string;
};

export type GenerationFallbackNotifier = (notice: GenerationFallbackNotice) => void | Promise<void>;

export type ConnectionAttemptOutcome = "completed" | "failed";
export type ConnectionAttemptFinalizer = (outcome: ConnectionAttemptOutcome) => void | Promise<void>;
export type ConnectionAdmissionMode =
  | { kind: "foreground" }
  | {
      kind: "background";
      beforeAttempt?: () => void | ConnectionAttemptFinalizer | Promise<void | ConnectionAttemptFinalizer>;
    }
  /**
   * A call that is a step inside someone else's attempt rather than an attempt of its own. It
   * takes no slot and leaves no foreground stamp, because the work it feeds is already admitted
   * and would otherwise be refused by its own preparation.
   */
  | { kind: "none" };

export interface ImageGenRequest {
  prompt: string;
  /** OpenAI GPT Image generation quality. Ignored by unsupported services and models. */
  quality?: ImageGenerationQuality;
  negativePrompt?: string;
  width?: number;
  height?: number;
  model?: string;
  /** For endpoint-based image services (e.g. RunPod): the endpoint/instance ID. */
  imageEndpointId?: string;
  /** Optional ComfyUI workflow JSON. Placeholders like %prompt%, %width%, %height%, %seed% will be replaced. */
  comfyWorkflow?: string;
  /** Optional connection-scoped generation defaults and API request parameters. */
  imageDefaults?: ImageGenerationDefaultsProfile | null;
  /** Allow this explicit image-generation connection to call local/private URLs. */
  allowLocalUrls?: boolean;
  /** Internal exact provider origin allowed to serve a private generated-image result. */
  privateImageResultOrigin?: string;
  /** Optional base64-encoded reference image for img2img / character consistency. */
  referenceImage?: string;
  /** Optional array of base64-encoded reference images (avatars). Providers that support multiple refs use all; others use the first. */
  referenceImages?: string[];
  /** Optional structured per-character prompts. NovelAI V4/V4.5 maps these to native character captions. */
  characterPrompts?: SceneIllustrationCharacterPrompt[];
  /** Request a transparent image background when the provider/model supports it. */
  transparentBackground?: boolean;
  /** Optional caller-owned abort signal for cancelling long image requests. */
  signal?: AbortSignal;
  /** Emit the final provider request even when the global log level is above debug. */
  debugMode?: boolean;
  /** Defaults to foreground: the caller is servicing a user-visible request. */
  admissionMode?: ConnectionAdmissionMode;
  /** Called immediately before a configured fallback connection is attempted. */
  onFallback?: GenerationFallbackNotifier;
  /** Optional one-shot backup connection used only when the primary image request fails. */
  fallback?: {
    connectionId: string;
    connectionName: string;
    provider: string;
    source: string;
    baseUrl: string;
    apiKey: string;
    serviceHint: string;
    model: string;
    imageEndpointId?: string;
    comfyWorkflow?: string;
    imageDefaults?: ImageGenerationDefaultsProfile | null;
    quality?: ImageGenerationQuality;
    imageGenerationSource?: string;
    imageService?: string;
    /** Prompt compiled for this fallback connection's provider and defaults. */
    prompt?: string;
    /** `null` explicitly removes the primary connection's negative prompt. */
    negativePrompt?: string | null;
  };
}

export interface ImageGenResult {
  /** Base64-encoded image data */
  base64: string;
  /** MIME type (e.g. "image/png") */
  mimeType: string;
  /** File extension without dot */
  ext: string;
  /** The provider-specific prompt used when a fallback connection rendered the image. */
  effectivePrompt?: string;
  effectiveNegativePrompt?: string;
  /** Present when a configured fallback connection produced the image. */
  effectiveConnection?: {
    connectionId: string;
    connectionName: string;
    provider: string;
    model: string;
  };
}

export type SaveImageToDiskOptions = {
  /**
   * Store one canonical file for images referenced by more than one gallery.
   * Gallery metadata remains responsible for deciding where the image appears.
   */
  shared?: boolean;
};

export type StagedGalleryImage = {
  filePath: string;
  promote: () => void;
  compensate: () => void;
};

export interface VideoReferenceImage {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
  url?: string | null;
}

export type VideoReferencePublicUploadExpiry = "1h" | "12h" | "24h" | "72h";

export interface VideoReferencePublicUploadOptions {
  enabled?: boolean;
  expiry?: VideoReferencePublicUploadExpiry | string | null;
}

export interface LtxDirectorPromptInput {
  globalPrompt: string;
  localPrompts: string;
  segmentLengths: string;
}

export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  // Gemini Omni currently takes duration guidance through the prompt, not video_config.
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  resolution?: "480p" | "720p" | "1080p";
  referenceImage?: VideoReferenceImage | null;
  /** API-format workflow JSON for local ComfyUI video generation. */
  comfyWorkflow?: string;
  /** Optional LTX Director global/local prompt inputs for workflows using the matching placeholders. */
  ltxDirectorPrompt?: LtxDirectorPromptInput;
  /** Up to five connection-scoped LoRAs for custom ComfyUI workflow placeholders. */
  comfyLoras?: ComfyUiLoraSetting[];
  /** Model-specific Atlas Cloud inputs saved on the connection for the selected model. */
  atlasModelOptions?: Record<string, unknown>;
  /** ComfyUI workflow frame rate exposed through %fps% and used by the legacy %length% macro. */
  fps?: number;
  lastFrameImage?: VideoReferenceImage | null;
  publicReferenceUpload?: VideoReferencePublicUploadOptions | null;
  signal?: AbortSignal;
  /** UI debug mode: surface provider payload logging without LOG_LEVEL=debug. */
  debugMode?: boolean;
  /** Serialize this request with other media jobs using the same configured connection. */
  queue?: boolean;
  /** Stable configured connection ID used to scope queued media jobs. */
  connectionKey?: string;
  /** Called immediately before a configured fallback connection is attempted. */
  onFallback?: GenerationFallbackNotifier;
  /** Optional one-shot backup connection used only when the primary video request fails. */
  fallback?: {
    connectionId: string;
    connectionName: string;
    source: string;
    baseUrl: string;
    apiKey: string;
    serviceHint: string;
    model: string;
    comfyWorkflow?: string;
    comfyLoras?: ComfyUiLoraSetting[];
    atlasModelOptions?: Record<string, unknown>;
    fps?: number;
  };
}

export interface VideoGenerationResult {
  base64: string;
  mimeType: "video/mp4";
  ext: "mp4";
}

export type FallbackConnection = {
  id: string;
  name?: string | null;
  provider: string;
  baseUrl: string | null;
  apiKey: string;
  model: string;
  maxContext?: number | null;
  openrouterProvider?: string | null;
  maxTokensOverride?: number | null;
  defaultParameters?: unknown;
  maxParallelJobs?: number | null;
  enableCaching?: string | boolean | null;
  anthropicExtendedCacheTtl?: string | boolean | null;
  cachingAtDepth?: number | null;
  claudeFastMode?: string | boolean | null;
  treatAsLocalEndpoint?: string | boolean | null;
};

export type GenerationProviderOrigin = { kind: "primary" } | { kind: "fallback"; provider: string; model: string };

/** Public provider operations; credentials and implementation details remain on the host. */
export interface CapabilityIntegrationProvider {
  readonly maxContextValue: number | null;
  readonly maxTokensOverrideValue: number | null;
  chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown>;
  chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult>;
  embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]>;
}

export interface CapabilityConnectionFallbackOptions {
  primary: CapabilityIntegrationProvider;
  primaryConnectionId: string;
  fallbackConnection: FallbackConnection | null | undefined;
  fallbackBaseUrl: string;
  category: "main" | "agents";
  onFallback?: GenerationFallbackNotifier;
  onProviderUsed?: (origin: GenerationProviderOrigin) => void;
  admissionMode?: ConnectionAdmissionMode;
  primarySupportsAssistantReasoningPrefill?: boolean;
  fallbackSupportsAssistantReasoningPrefill?: boolean;
}

/** Capability API 1.31: call the live host integrations instead of bundling provider forks. */
export interface CapabilityIntegrationHost {
  llm: {
    createProvider(
      provider: string,
      baseUrl: string,
      apiKey: string,
      maxContext?: number | null,
      openrouterProvider?: string | null,
      maxTokensOverride?: number | null,
      claudeFastMode?: boolean,
      treatAsLocalEndpoint?: boolean,
      defaultParameters?: unknown,
      connectionId?: string,
    ): CapabilityIntegrationProvider;
    withFallback(options: CapabilityConnectionFallbackOptions): CapabilityIntegrationProvider;
    localSidecar(): CapabilityIntegrationProvider;
  };
  images: {
    generate(
      source: string,
      baseUrl: string,
      apiKey: string,
      serviceHint: string,
      request: Omit<ImageGenRequest, "allowLocalUrls" | "privateImageResultOrigin">,
    ): Promise<ImageGenResult>;
    save(chatId: string, base64: string, ext: string, options?: SaveImageToDiskOptions): string;
    remove(filePath: string): void;
    stage(chatId: string, base64: string, ext: string): StagedGalleryImage;
    sweepStaged(): number;
    resolveNovelAiRequestSize(request: ImageGenRequest, defaults?: NovelAiDefaults): { width: number; height: number };
  };
  videos: {
    generate(
      source: string,
      baseUrl: string,
      apiKey: string,
      serviceHint: string,
      request: VideoGenerationRequest,
    ): Promise<VideoGenerationResult>;
    save(chatId: string, base64: string): Promise<string>;
    remove(filePath: string): Promise<void>;
    resolveDuration(
      source: string,
      serviceHint: string,
      request: Pick<VideoGenerationRequest, "durationSeconds" | "referenceImage" | "resolution">,
    ): number;
    resolveReferenceUpload(
      enabled: boolean,
      defaults:
        | {
            temporaryPublicReferenceUploadEnabled?: boolean | null;
            temporaryPublicReferenceUploadExpiry?: string | null;
          }
        | null
        | undefined,
    ): VideoReferencePublicUploadOptions | null;
  };
}
