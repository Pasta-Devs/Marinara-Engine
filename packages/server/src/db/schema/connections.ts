// ──────────────────────────────────────────────
// Schema: API Connections
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const apiConnections = sqliteTable("api_connections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider", {
    enum: [
      "openai",
      "openai_chatgpt",
      "anthropic",
      "claude_subscription",
      "grok_subscription",
      "google",
      "google_vertex",
      "mistral",
      "cohere",
      "openrouter",
      "nanogpt",
      "xai",
      "custom",
      "image_generation",
      "video_generation",
    ],
  }).notNull(),
  baseUrl: text("base_url").notNull().default(""),
  /** Encrypted API key */
  apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
  model: text("model").notNull().default(""),
  imagePath: text("image_path"),
  maxContext: integer("max_context").notNull().default(128000),
  isDefault: text("is_default").notNull().default("false"),
  /** Whether this connection is part of the random-selection pool */
  useForRandom: text("use_for_random").notNull().default("false"),
  /** Whether to enable Anthropic prompt caching */
  enableCaching: text("enable_caching").notNull().default("false"),
  /** Anthropic: use 1-hour prompt-cache TTL instead of the default 5-minute TTL. */
  anthropicExtendedCacheTtl: text("anthropic_extended_cache_ttl").notNull().default("false"),
  /** Anthropic prompt caching breakpoint depth from the newest message */
  cachingAtDepth: integer("caching_at_depth").notNull().default(5),
  /** Whether this connection is the default for all agents (only one allowed) */
  defaultForAgents: text("default_for_agents").notNull().default("false"),
  /** Model to use for embedding generation (e.g. text-embedding-3-small) */
  embeddingModel: text("embedding_model"),
  /** Optional: separate base URL for the embedding backend (e.g. a second llama.cpp instance) */
  embeddingBaseUrl: text("embedding_base_url"),
  /** Optional: use a different connection for embeddings */
  embeddingConnectionId: text("embedding_connection_id"),
  /** OpenRouter: preferred provider for model routing (e.g. "Anthropic", "Google") */
  openrouterProvider: text("openrouter_provider"),
  /** Explicit image backend selection for image-generation connections */
  imageGenerationSource: text("image_generation_source"),
  /** ComfyUI: custom workflow JSON with placeholders (%prompt%, %width%, etc.) */
  comfyuiWorkflow: text("comfyui_workflow"),
  /** Image generation: explicitly selected service ID (e.g. "comfyui", "automatic1111"). Overrides URL inference. */
  imageService: text("image_service"),
  /** For endpoint-based image services (e.g. RunPod Serverless ComfyUI): the endpoint ID. */
  imageEndpointId: text("image_endpoint_id"),
  /** Explicit video backend selection for video-generation connections. */
  videoGenerationSource: text("video_generation_source"),
  /** Video generation: explicitly selected service ID. */
  videoService: text("video_service"),
  /** Default generation parameters (stored as JSON) for new chats using this connection */
  defaultParameters: text("default_parameters"),
  /** Optional prompt preset override for roleplay/visual-novel chats using this connection */
  promptPresetId: text("prompt_preset_id"),
  /** Optional hard cap on max_tokens for the API response (for providers like DeepSeek that have lower limits). */
  maxTokensOverride: integer("max_tokens_override"),
  /** Maximum number of agent LLM jobs Marinara may run at once for this connection. */
  maxParallelJobs: integer("max_parallel_jobs").notNull().default(1),
  /** Treat as a local/custom endpoint for Professor Mari JSON tool fallback behavior. */
  treatAsLocalEndpoint: text("treat_as_local_endpoint").notNull().default("false"),
  /**
   * Claude (Subscription) only. When "true", Marinara passes `settings.fastMode = true`
   * to the Claude Agent SDK, asking the SDK to use its faster, cheaper routing tier
   * (response speed up, but lower-quality model behind the scenes). When "false"
   * (default), Marinara explicitly forces fast mode off for every request so the
   * exact model chosen on the connection is what runs.
   */
  claudeFastMode: text("claude_fast_mode").notNull().default("false"),
  /** Folder this connection belongs to (null = root/unfiled). */
  folderId: text("folder_id"),
  /** Manual sort order within a folder (lower = higher). 0 = use default sort. */
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
