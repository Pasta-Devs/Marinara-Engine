use super::llm::{llm_connection_from_value, resolve_llm_connection_for_request};
use super::shared;
use crate::state::AppState;
use autoagents::async_trait;
use autoagents::core::agent::memory::SlidingWindowMemory;
use autoagents::core::agent::prebuilt::executor::ReActAgent;
use autoagents::core::agent::task::Task;
use autoagents::core::agent::{AgentBuilder, DirectAgent};
use autoagents::core::tool::{ToolCallError, ToolRuntime};
use autoagents::llm::chat::{
    ChatMessage, ChatProvider, ChatResponse, ChatRole, MessageType, StructuredOutputFormat, Tool,
};
use autoagents::llm::completion::{CompletionProvider, CompletionRequest, CompletionResponse};
use autoagents::llm::embedding::EmbeddingProvider;
use autoagents::llm::error::LLMError;
use autoagents::llm::models::{ModelListRequest, ModelListResponse, ModelsProvider};
use autoagents::llm::{FunctionCall, LLMProvider, ToolCall};
use autoagents::prelude::{agent, tool, AgentHooks, ToolInput, ToolInputT, ToolT};
use marinara_core::{now_iso, AppError, AppResult};
use marinara_security::{assert_inside_dir, assert_relative_safe_path};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

const CREATIVE_LIBRARY_ENTITIES: &[(&str, &str)] = &[
    ("characters", "characters"),
    ("characterGroups", "character-groups"),
    ("personas", "personas"),
    ("personaGroups", "persona-groups"),
    ("lorebooks", "lorebooks"),
    ("lorebookEntries", "lorebook-entries"),
    ("promptPresets", "prompts"),
    ("promptSections", "prompt-sections"),
    ("promptGroups", "prompt-groups"),
    ("promptVariables", "prompt-variables"),
];

const CODE_SEARCH_SKIP_DIRS: &[&str] = &[
    ".codex",
    ".git",
    ".next",
    ".pnpm-store",
    ".turbo",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
];
const CODE_SEARCH_SKIP_PATH_PREFIXES: &[&str] = &["packages/server/data", "src-tauri/gen"];
const CODE_SEARCH_ALLOWED_EXTENSIONS: &[&str] = &[
    "css", "html", "js", "jsx", "json", "md", "rs", "toml", "ts", "tsx", "yml", "yaml",
];
const CODE_SEARCH_MAX_FILE_BYTES: u64 = 512 * 1024;
const CODE_READ_MAX_FILE_BYTES: u64 = 96 * 1024;
const CODE_EDIT_MAX_FILE_BYTES: u64 = 512 * 1024;
const CODE_EDIT_MAX_TEXT_BYTES: usize = 256 * 1024;
const MARI_ATTACHMENT_MAX_COUNT: usize = 24;
const MARI_ATTACHMENT_MAX_CHARS: usize = 24 * 1024;
const MARI_ATTACHMENT_MAX_NAME_CHARS: usize = 160;
const MARI_ATTACHMENT_MAX_TYPE_CHARS: usize = 120;
const MARI_ATTACHMENT_TOTAL_MAX_CHARS: usize = 48 * 1024;
const MARI_TEXT_ATTACHMENT_EXTENSIONS: &[&str] = &[
    "csv", "json", "jsonl", "log", "md", "markdown", "txt", "xml", "yaml", "yml",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MariPromptRequest {
    user_message: String,
    #[serde(default)]
    messages: Vec<MariPromptMessage>,
    #[serde(default)]
    compacted_summary: Option<String>,
    #[serde(default)]
    connection_id: Option<String>,
    #[serde(default)]
    persona: Option<MariPersonaContext>,
    #[serde(default)]
    attachments: Vec<MariAttachment>,
}

#[derive(Debug, Deserialize)]
struct MariPromptMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MariPersonaContext {
    name: Option<String>,
    comment: Option<String>,
    description: Option<String>,
    personality: Option<String>,
    scenario: Option<String>,
    backstory: Option<String>,
    appearance: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MariAttachment {
    name: String,
    #[serde(default)]
    r#type: String,
    #[serde(default)]
    size: u64,
    content: String,
}

#[derive(Clone, Debug)]
struct MarinaraLlmProvider {
    connection: marinara_llm::LlmConnection,
}

#[derive(Debug)]
struct MarinaraChatResponse {
    content: String,
    tool_calls: Vec<ToolCall>,
}

impl fmt::Display for MarinaraChatResponse {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.content)
    }
}

impl ChatResponse for MarinaraChatResponse {
    fn text(&self) -> Option<String> {
        Some(self.content.clone())
    }

    fn tool_calls(&self) -> Option<Vec<ToolCall>> {
        Some(self.tool_calls.clone())
    }
}

#[async_trait]
impl ChatProvider for MarinaraLlmProvider {
    async fn chat_with_tools(
        &self,
        messages: &[ChatMessage],
        tools: Option<&[Tool]>,
        _json_schema: Option<StructuredOutputFormat>,
    ) -> Result<Box<dyn ChatResponse>, LLMError> {
        let request = marinara_llm::LlmRequest {
            connection: self.connection.clone(),
            messages: messages
                .iter()
                .map(autoagents_message_to_marinara)
                .collect(),
            parameters: mari_request_parameters(
                &self.connection,
                messages,
                tools.unwrap_or_default(),
            ),
            tools: tools
                .unwrap_or_default()
                .iter()
                .map(|tool| serde_json::to_value(&tool.function).unwrap_or_else(|_| json!({})))
                .collect(),
        };
        let response = marinara_llm::complete_rich(request)
            .await
            .map_err(|error| LLMError::ProviderError(error.to_string()))?;
        Ok(Box::new(MarinaraChatResponse {
            content: response.content,
            tool_calls: response
                .tool_calls
                .into_iter()
                .filter_map(marinara_tool_call_to_autoagents)
                .collect(),
        }))
    }
}

fn mari_request_parameters(
    connection: &marinara_llm::LlmConnection,
    messages: &[ChatMessage],
    tools: &[Tool],
) -> Value {
    let mut parameters = json!({
                "temperature": 0.4,
                "maxTokens": 2048,
    });
    let has_tool_result = messages
        .iter()
        .any(|message| matches!(message.message_type, MessageType::ToolResult(_)));
    let latest_user = messages
        .iter()
        .rev()
        .find(|message| matches!(message.role, ChatRole::User))
        .map(|message| message.content.as_str())
        .unwrap_or_default();
    if !tools.is_empty() && !has_tool_result && looks_like_codebase_question(latest_user) {
        parameters["toolChoice"] = mari_forced_tool_choice(connection, "search_marinara_code");
    } else if !tools.is_empty() && !has_tool_result && looks_like_library_question(latest_user) {
        parameters["toolChoice"] = mari_forced_tool_choice(connection, "read_marinara_library");
    }
    parameters
}

fn mari_forced_tool_choice(connection: &marinara_llm::LlmConnection, tool_name: &str) -> Value {
    if connection.provider == "custom" {
        return json!("required");
    }
    json!({
        "type": "function",
        "function": { "name": tool_name }
    })
}

#[async_trait]
impl CompletionProvider for MarinaraLlmProvider {
    async fn complete(
        &self,
        request: &CompletionRequest,
        _json_schema: Option<StructuredOutputFormat>,
    ) -> Result<CompletionResponse, LLMError> {
        let response = self
            .chat(
                &[ChatMessage {
                    role: ChatRole::User,
                    message_type: MessageType::Text,
                    content: request.prompt.clone(),
                }],
                None,
            )
            .await?;
        Ok(CompletionResponse {
            text: response.text().unwrap_or_default(),
        })
    }
}

#[async_trait]
impl EmbeddingProvider for MarinaraLlmProvider {
    async fn embed(&self, _input: Vec<String>) -> Result<Vec<Vec<f32>>, LLMError> {
        Err(LLMError::ProviderError(
            "Professor Mari does not expose embeddings in v1".to_string(),
        ))
    }
}

#[async_trait]
impl ModelsProvider for MarinaraLlmProvider {
    async fn list_models(
        &self,
        _request: Option<&ModelListRequest>,
    ) -> Result<Box<dyn ModelListResponse>, LLMError> {
        Err(LLMError::ProviderError(
            "Professor Mari model listing is owned by Marinara connections".to_string(),
        ))
    }
}

impl LLMProvider for MarinaraLlmProvider {}

#[derive(Serialize, Deserialize, ToolInput, Debug)]
struct ReadMarinaraLibraryArgs {}

#[tool(
    name = "read_marinara_library",
    description = "Read Professor Mari's typed, read-only creative library snapshot: characters, personas, lorebooks with entries, prompt presets, prompt sections, prompt groups, prompt variables, and character/persona groups. This tool never returns chats, messages, memories, integrations, API keys, or connection secrets.",
    input = ReadMarinaraLibraryArgs,
)]
struct ReadMarinaraLibraryTool {
    state: AppState,
}

#[async_trait]
impl ToolRuntime for ReadMarinaraLibraryTool {
    async fn execute(&self, _args: Value) -> Result<Value, ToolCallError> {
        creative_library_snapshot(&self.state).map_err(|error| {
            ToolCallError::RuntimeError(Box::new(AppError::new(
                "mari_library_read_failed",
                error.to_string(),
            )))
        })
    }
}

#[derive(Serialize, Deserialize, ToolInput, Debug)]
struct SearchMarinaraCodeArgs {
    #[input(description = "Literal text to search for.")]
    query: String,
    #[input(description = "Optional repository-relative file or directory to search.")]
    #[serde(default)]
    path: Option<String>,
    #[input(description = "Optional maximum number of matches to return.")]
    #[serde(default)]
    max_results: Option<usize>,
}

#[tool(
    name = "search_marinara_code",
    description = "Search Marinara Engine source files for a literal text query. Use this before answering questions about how the app works. Search concise symbols, file names, or path fragments from the user's question rather than the whole sentence. For example, search AppShell for a question about where AppShell is defined. The optional path must be relative to the repository, for example src/engine, src/features/shell/mari, src-tauri, or AGENTS.md.",
    input = SearchMarinaraCodeArgs,
)]
struct SearchMarinaraCodeTool {}

#[async_trait]
impl ToolRuntime for SearchMarinaraCodeTool {
    async fn execute(&self, args: Value) -> Result<Value, ToolCallError> {
        let args: SearchMarinaraCodeArgs = serde_json::from_value(args)
            .map_err(|error| mari_tool_error("mari_code_search_invalid_args", error))?;
        search_marinara_code(args)
            .map_err(|error| mari_tool_error("mari_code_search_failed", error))
    }
}

#[derive(Serialize, Deserialize, ToolInput, Debug)]
struct ReadMarinaraCodeFileArgs {
    #[input(description = "Repository-relative path to the UTF-8 source or guidance file.")]
    path: String,
}

#[tool(
    name = "read_marinara_code_file",
    description = "Read one UTF-8 Marinara Engine source or guidance file by repository-relative path. Use this after search_marinara_code when exact source context is needed.",
    input = ReadMarinaraCodeFileArgs,
)]
struct ReadMarinaraCodeFileTool {}

#[async_trait]
impl ToolRuntime for ReadMarinaraCodeFileTool {
    async fn execute(&self, args: Value) -> Result<Value, ToolCallError> {
        let args: ReadMarinaraCodeFileArgs = serde_json::from_value(args)
            .map_err(|error| mari_tool_error("mari_code_read_invalid_args", error))?;
        read_marinara_code_file(&args.path)
            .map_err(|error| mari_tool_error("mari_code_read_failed", error))
    }
}

#[derive(Serialize, Deserialize, ToolInput, Debug)]
struct EditMarinaraCodeFileArgs {
    #[input(description = "Repository-relative path to the existing source or guidance file.")]
    path: String,
    #[input(description = "Exact text to replace. It must occur exactly once.")]
    old_text: String,
    #[input(description = "Replacement text.")]
    new_text: String,
}

#[tool(
    name = "edit_marinara_code_file",
    description = "Edit one existing Marinara Engine source or guidance file by replacing an exact old_text with new_text. The path must be repository-relative, old_text must occur exactly once, and destructive broad rewrites are rejected.",
    input = EditMarinaraCodeFileArgs,
)]
struct EditMarinaraCodeFileTool {}

#[async_trait]
impl ToolRuntime for EditMarinaraCodeFileTool {
    async fn execute(&self, args: Value) -> Result<Value, ToolCallError> {
        if !mari_write_tools_enabled() {
            return Err(mari_write_requires_approval_error());
        }
        let args: EditMarinaraCodeFileArgs = serde_json::from_value(args)
            .map_err(|error| mari_tool_error("mari_code_edit_invalid_args", error))?;
        edit_marinara_code_file(&args.path, &args.old_text, &args.new_text)
            .map_err(|error| mari_tool_error("mari_code_edit_failed", error))
    }
}

#[derive(Serialize, Deserialize, ToolInput, Debug)]
struct CreateMarinaraExtensionArgs {
    #[input(description = "Extension display name.")]
    name: String,
    #[input(description = "Short user-facing extension description.")]
    #[serde(default)]
    description: String,
    #[input(description = "Optional CSS payload to inject while the extension is enabled.")]
    #[serde(default)]
    css: Option<String>,
    #[input(description = "Optional JavaScript payload to run while the extension is enabled.")]
    #[serde(default)]
    js: Option<String>,
}

#[tool(
    name = "create_marinara_extension",
    description = "Create a user-installed Marinara extension record with optional CSS and JavaScript. Prefer this for user-facing tweaks before editing application source code.",
    input = CreateMarinaraExtensionArgs,
)]
struct CreateMarinaraExtensionTool {
    state: AppState,
}

#[async_trait]
impl ToolRuntime for CreateMarinaraExtensionTool {
    async fn execute(&self, args: Value) -> Result<Value, ToolCallError> {
        if !mari_write_tools_enabled() {
            return Err(mari_write_requires_approval_error());
        }
        let args: CreateMarinaraExtensionArgs = serde_json::from_value(args)
            .map_err(|error| mari_tool_error("mari_extension_invalid_args", error))?;
        create_marinara_extension(&self.state, args)
            .map_err(|error| mari_tool_error("mari_extension_create_failed", error))
    }
}

#[derive(Serialize, Deserialize, ToolInput, Debug)]
struct CreateMarinaraCustomAgentArgs {
    #[input(description = "Custom agent display name.")]
    name: String,
    #[input(
        description = "Optional custom agent type id. Leave empty to derive one from the name."
    )]
    #[serde(default)]
    agent_type: Option<String>,
    #[input(description = "Short description of what the custom agent does.")]
    #[serde(default)]
    description: String,
    #[input(description = "Pipeline phase: pre_generation, parallel, or post_processing.")]
    #[serde(default = "default_agent_phase")]
    phase: String,
    #[input(description = "System prompt template for the custom agent.")]
    prompt_template: String,
    #[input(description = "Optional result type such as context_injection or text_rewrite.")]
    #[serde(default)]
    result_type: Option<String>,
    #[input(description = "Optional connection id for this agent.")]
    #[serde(default)]
    connection_id: Option<String>,
    #[input(description = "Optional JSON object string for additional agent settings.")]
    #[serde(default)]
    settings_json: Option<String>,
}

#[tool(
    name = "create_marinara_custom_agent",
    description = "Create a custom Marinara agent configuration record. Use this when the user asks Professor Mari to make an agent for conversation, roleplay, game, writing, tracking, or post-processing behavior.",
    input = CreateMarinaraCustomAgentArgs,
)]
struct CreateMarinaraCustomAgentTool {
    state: AppState,
}

#[async_trait]
impl ToolRuntime for CreateMarinaraCustomAgentTool {
    async fn execute(&self, args: Value) -> Result<Value, ToolCallError> {
        if !mari_write_tools_enabled() {
            return Err(mari_write_requires_approval_error());
        }
        let args: CreateMarinaraCustomAgentArgs = serde_json::from_value(args)
            .map_err(|error| mari_tool_error("mari_agent_invalid_args", error))?;
        create_marinara_custom_agent(&self.state, args)
            .map_err(|error| mari_tool_error("mari_agent_create_failed", error))
    }
}

#[agent(
    name = "professor_mari",
    description = "You are Professor Mari, Marinara's standalone assistant. You can inspect the app's codebase, read files, apply exact source edits, create extension records, create custom agent records, and inspect the creative library through tools. Use tools for factual answers about Marinara internals.",
    tools = [
        ReadMarinaraLibraryTool { state: self.state.clone() },
        SearchMarinaraCodeTool {},
        ReadMarinaraCodeFileTool {},
        EditMarinaraCodeFileTool {},
        CreateMarinaraExtensionTool { state: self.state.clone() },
        CreateMarinaraCustomAgentTool { state: self.state.clone() },
    ],
)]
#[derive(Clone, AgentHooks)]
struct ProfessorMariAgent {
    state: AppState,
}

pub(crate) async fn professor_mari_prompt(state: &AppState, body: Value) -> AppResult<Value> {
    let input: MariPromptRequest = serde_json::from_value(body.clone())
        .map_err(|error| AppError::invalid_input(error.to_string()))?;
    let Some(connection_id) = input
        .connection_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty())
    else {
        return Err(AppError::invalid_input(
            "No connection set for this chat! Click the \"chains\" icon in the input box to select one.",
        ));
    };
    let connection_value = resolve_llm_connection_for_request(
        state,
        &json!({
            "connectionId": connection_id,
        }),
    )?;
    let connection = llm_connection_from_value(&connection_value)?;
    ensure_connection_supports_native_tools(&connection)?;
    let system_prompt = build_system_prompt(input.persona.as_ref());
    let repo_guidance = if looks_like_codebase_question(&input.user_message) {
        repo_guidance_for_prompt().ok()
    } else {
        None
    };
    let task_prompt = build_task_prompt(&input, repo_guidance.as_deref());
    let provider: Arc<dyn LLMProvider> = Arc::new(MarinaraLlmProvider { connection });
    let memory = Box::new(SlidingWindowMemory::new(12));
    let agent = ReActAgent::with_max_turns(
        ProfessorMariAgent {
            state: state.clone(),
        },
        4,
    );
    let agent_handle = AgentBuilder::<_, DirectAgent>::new(agent)
        .llm(provider)
        .memory(memory)
        .build()
        .await
        .map_err(|error| AppError::new("mari_agent_create_failed", error.to_string()))?;
    let task = Task::new(task_prompt).with_system_prompt(system_prompt);
    let response = agent_handle.agent.run(task).await.map_err(|error| {
        AppError::new(
            "mari_agent_failed",
            tool_call_error_message(&error.to_string()),
        )
    })?;

    let content = response.to_string();
    if content.trim().is_empty() {
        return Err(AppError::new(
            "mari_empty_response",
            "Professor Mari returned an empty response. Try again or select a different tool-capable connection.",
        ));
    }

    Ok(json!({
        "content": content,
        "createdAt": chrono::Utc::now().to_rfc3339(),
        "action": read_only_mari_action_contract(),
    }))
}

fn read_only_mari_action_contract() -> Value {
    json!({
        "type": "none",
        "capability": "workspace_agent",
        "reason": "Professor Mari can inspect Marinara Engine's codebase and creative library. Write tools require an explicit approval flow and are disabled for autonomous tool runs.",
    })
}

fn autoagents_message_to_marinara(message: &ChatMessage) -> marinara_llm::LlmMessage {
    let first_tool_result = match &message.message_type {
        MessageType::ToolResult(calls) => calls.first(),
        _ => None,
    };
    let role = match message.role {
        ChatRole::System => "system",
        ChatRole::Assistant => "assistant",
        ChatRole::Tool => "tool",
        ChatRole::User => "user",
    }
    .to_string();
    let tool_calls = match &message.message_type {
        MessageType::ToolUse(calls) => Some(json!(calls)),
        _ => None,
    };
    marinara_llm::LlmMessage {
        role,
        content: first_tool_result
            .map(|call| call.function.arguments.clone())
            .unwrap_or_else(|| message.content.clone()),
        name: None,
        images: Vec::new(),
        tool_call_id: first_tool_result.map(|call| call.id.clone()),
        tool_calls,
        provider_metadata: None,
    }
}

fn marinara_tool_call_to_autoagents(value: Value) -> Option<ToolCall> {
    let function = value.get("function").unwrap_or(&value);
    let name = function
        .get("name")
        .or_else(|| value.get("name"))?
        .as_str()?
        .to_string();
    let arguments = function
        .get("arguments")
        .or_else(|| value.get("arguments"))
        .and_then(Value::as_str)
        .unwrap_or("{}")
        .to_string();
    Some(ToolCall {
        id: value
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| !id.is_empty())
            .unwrap_or("mari_tool_call")
            .to_string(),
        call_type: value
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("function")
            .to_string(),
        function: FunctionCall { name, arguments },
    })
}

fn build_system_prompt(persona: Option<&MariPersonaContext>) -> String {
    let mut parts = vec![
        "You are Professor Mari, a standalone assistant inside Marinara Engine.".to_string(),
        "Personality: helpful, candid, playful, direct, technically sharp, and a little proudly adorable. Explain clearly, nudge users toward practical next steps, and keep your confidence warm rather than formal.".to_string(),
        "You can chat with the user, inspect Marinara Engine source code with search_marinara_code and read_marinara_code_file, and apply narrow exact-match code edits with edit_marinara_code_file.".to_string(),
        "For questions about Marinara internals, architecture, UI behavior, agent behavior, storage, imports, providers, or bugs, search the codebase before answering. Prefer AGENTS.md and the relevant owner files over memory. Never cite package-era paths unless search/read tools confirm they exist in the current repository.".to_string(),
        "You can create user extensions with create_marinara_extension and custom agent configurations with create_marinara_custom_agent. Prefer those record-creation tools when the user asks for an extension or agent.".to_string(),
        "You can inspect the creative library through read_marinara_library when the user asks about their characters, personas, lorebooks, prompt presets, or groups.".to_string(),
        "You cannot run shell commands, inspect private chats/messages/memories, access secrets, edit files outside the repository, or perform broad/destructive rewrites. If an edit needs runtime verification, say what should be checked.".to_string(),
    ];
    if let Some(persona) = persona {
        let persona_text = [
            ("Name", persona.name.as_deref()),
            ("Comment", persona.comment.as_deref()),
            ("Description", persona.description.as_deref()),
            ("Personality", persona.personality.as_deref()),
            ("Scenario", persona.scenario.as_deref()),
            ("Backstory", persona.backstory.as_deref()),
            ("Appearance", persona.appearance.as_deref()),
        ]
        .into_iter()
        .filter_map(|(label, value)| {
            let value = value?.trim();
            (!value.is_empty()).then(|| format!("{label}: {value}"))
        })
        .collect::<Vec<_>>()
        .join("\n");
        if !persona_text.is_empty() {
            parts.push(format!("The user's selected persona is:\n{persona_text}"));
        }
    }
    parts.join("\n\n")
}

fn repo_guidance_for_prompt() -> AppResult<String> {
    let root = marinara_repo_root()?;
    let guidance = fs::read_to_string(root.join("AGENTS.md")).map_err(|error| {
        AppError::new(
            "mari_repo_guidance_unavailable",
            format!("Could not read AGENTS.md: {error}"),
        )
    })?;
    let current_map = guidance
        .split("### Current Map")
        .nth(1)
        .map(|section| format!("### Current Map{}", section))
        .unwrap_or(guidance);
    let excerpt = truncate_to_chars(&current_map, 5_000).0;
    Ok(excerpt)
}

fn build_task_prompt(input: &MariPromptRequest, repo_guidance: Option<&str>) -> String {
    let mut sections = Vec::new();
    if let Some(summary) = input
        .compacted_summary
        .as_deref()
        .map(str::trim)
        .filter(|summary| !summary.is_empty())
    {
        sections.push(format!("Compacted conversation so far:\n{summary}"));
    }
    let history = input
        .messages
        .iter()
        .filter_map(|message| {
            let content = message.content.trim();
            (!content.is_empty()).then(|| format!("{}: {content}", message.role))
        })
        .collect::<Vec<_>>()
        .join("\n");
    if !history.is_empty() {
        sections.push(format!("Conversation history:\n{history}"));
    }
    if !input.attachments.is_empty() {
        let mut remaining_attachment_chars = MARI_ATTACHMENT_TOTAL_MAX_CHARS;
        let mut attachment_blocks = input
            .attachments
            .iter()
            .take(MARI_ATTACHMENT_MAX_COUNT)
            .filter_map(|attachment| {
                attachment_context_block(attachment, &mut remaining_attachment_chars)
            })
            .collect::<Vec<_>>();
        let omitted_count = input
            .attachments
            .len()
            .saturating_sub(MARI_ATTACHMENT_MAX_COUNT);
        if omitted_count > 0 {
            let omitted_note = format!(
                "[{omitted_count} additional attachment(s) omitted to keep Professor Mari within the attachment context budget.]"
            );
            if let Some(note) =
                take_attachment_budget(&omitted_note, &mut remaining_attachment_chars)
            {
                attachment_blocks.push(note);
            }
        }
        if !attachment_blocks.is_empty() {
            let attachments = attachment_blocks.join("\n\n---\n\n");
            sections.push(format!(
                "Attached files for the latest user turn:\n{attachments}"
            ));
        }
    }
    if let Some(repo_guidance) = repo_guidance
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        sections.push(format!(
            "Current repository guidance from AGENTS.md. Use this as the current source map, then verify exact answers with search_marinara_code/read_marinara_code_file before citing files:\n{repo_guidance}"
        ));
    }
    sections.push(format!(
        "Latest user message:\n{}",
        input.user_message.trim()
    ));
    sections.join("\n\n")
}

fn attachment_context_block(
    attachment: &MariAttachment,
    remaining_chars: &mut usize,
) -> Option<String> {
    let name = attachment.name.trim();
    let name = if name.is_empty() { "attachment" } else { name };
    let (name, name_truncated) = truncate_to_chars(name, MARI_ATTACHMENT_MAX_NAME_CHARS);
    let mime_type = attachment.r#type.trim();
    let mime_type = if mime_type.is_empty() {
        "application/octet-stream"
    } else {
        mime_type
    };
    let (mime_type, mime_type_truncated) =
        truncate_to_chars(mime_type, MARI_ATTACHMENT_MAX_TYPE_CHARS);
    let content = attachment.content.trim();
    let metadata_notes = [
        name_truncated.then_some("file name was truncated"),
        mime_type_truncated.then_some("MIME type was truncated"),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    let content_block = match attachment_omission_reason(attachment, content) {
        Some(reason) => format!("[Attachment omitted: {reason}]"),
        None if content.is_empty() => {
            "[Attachment omitted: no readable text content was provided.]".to_string()
        }
        None if *remaining_chars == 0 => {
            "[Attachment omitted: attachment context budget was already exhausted.]".to_string()
        }
        None => {
            let per_file_limit = MARI_ATTACHMENT_MAX_CHARS.min(*remaining_chars);
            let (snippet, truncated_for_limit) = truncate_to_chars(content, per_file_limit);
            let truncated_by_client =
                attachment.size > 0 && attachment.size as usize > attachment.content.len();
            if truncated_for_limit || truncated_by_client {
                format!(
                    "{snippet}\n\n[Attachment truncated before prompting to keep Professor Mari within the context budget.]"
                )
            } else {
                snippet
            }
        }
    };
    let mut block = format!(
        "File: {name}\nType: {mime_type}\nSize: {}\nContent:\n{content_block}",
        attachment.size
    );
    if !metadata_notes.is_empty() {
        block.push_str("\n\n[Attachment metadata truncated: ");
        block.push_str(&metadata_notes.join(", "));
        block.push_str(".]");
    }
    take_attachment_budget(&block, remaining_chars)
}

fn take_attachment_budget(value: &str, remaining_chars: &mut usize) -> Option<String> {
    if *remaining_chars == 0 {
        return None;
    }
    let (snippet, _) = truncate_to_chars(value, *remaining_chars);
    *remaining_chars = remaining_chars.saturating_sub(snippet.chars().count());
    Some(snippet)
}

fn attachment_omission_reason(attachment: &MariAttachment, content: &str) -> Option<String> {
    let mime_type = attachment.r#type.trim().to_ascii_lowercase();
    if mime_type.starts_with("image/") {
        return Some(
            "image attachments are not sent as raw base64 to Professor Mari; describe the image or attach text instead"
                .to_string(),
        );
    }
    if !is_readable_mari_attachment(attachment) {
        return Some(format!("{mime_type} is not a readable text attachment"));
    }
    if looks_like_encoded_blob(content) {
        return Some("content looks like encoded binary/base64 data".to_string());
    }
    None
}

fn is_readable_mari_attachment(attachment: &MariAttachment) -> bool {
    let mime_type = attachment.r#type.trim().to_ascii_lowercase();
    if mime_type.starts_with("text/") {
        return true;
    }
    if matches!(
        mime_type.as_str(),
        "application/json"
            | "application/ld+json"
            | "application/xml"
            | "application/x-yaml"
            | "application/yaml"
    ) {
        return true;
    }
    path_extension(&attachment.name)
        .map(|extension| MARI_TEXT_ATTACHMENT_EXTENSIONS.contains(&extension.as_str()))
        .unwrap_or(false)
}

fn path_extension(path: &str) -> Option<String> {
    Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn truncate_to_chars(value: &str, max_chars: usize) -> (String, bool) {
    let mut chars = value.chars();
    let truncated = chars.by_ref().take(max_chars).collect::<String>();
    let was_truncated = chars.next().is_some();
    (truncated, was_truncated)
}

fn looks_like_library_question(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    [
        "character",
        "characters",
        "persona",
        "personas",
        "lorebook",
        "lorebooks",
        "prompt",
        "preset",
        "presets",
        "library",
        "what do i have",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

fn looks_like_codebase_question(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    [
        "agent",
        "agents",
        "architecture",
        "bug",
        "code",
        "codebase",
        "component",
        "custom agent",
        "edit",
        "engine",
        "extension",
        "feature",
        "file",
        "how does",
        "implement",
        "marinara",
        "repo",
        "rust",
        "source",
        "src/",
        "tauri",
        "ui",
        "where",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

fn ensure_connection_supports_native_tools(
    connection: &marinara_llm::LlmConnection,
) -> AppResult<()> {
    match connection.provider.as_str() {
        "openai" | "openai_chatgpt" | "openrouter" | "custom" | "xai" | "mistral" | "cohere" | "nanogpt" => Ok(()),
        provider => Err(AppError::invalid_input(format!(
            "Professor Mari requires a connection with native tool-call support. The selected provider '{provider}' is not enabled for native tools in Marinara's Rust LLM transport yet. Use an OpenAI-compatible, OpenRouter, OpenAI, xAI, Mistral, Cohere, NanoGPT, or custom OpenAI-compatible connection with a tool-capable chat model."
        ))),
    }
}

fn tool_call_error_message(message: &str) -> String {
    if message.contains("Provider response did not contain assistant text or tool calls") {
        return "The selected model/provider did not return a native tool call or assistant message. Professor Mari's read-library path requires native tool calling; choose a tool-capable chat model on the selected connection.".to_string();
    }
    message.to_string()
}

fn creative_library_snapshot(state: &AppState) -> AppResult<Value> {
    let mut snapshot = serde_json::Map::new();
    for (key, entity) in CREATIVE_LIBRARY_ENTITIES {
        let rows = state.storage.list(entity)?;
        snapshot.insert((*key).to_string(), Value::Array(rows));
    }
    Ok(Value::Object(snapshot))
}

fn mari_tool_error(code: &str, error: impl ToString) -> ToolCallError {
    ToolCallError::RuntimeError(Box::new(AppError::new(code, error.to_string())))
}

fn mari_write_tools_enabled() -> bool {
    false
}

fn mari_write_requires_approval_error() -> ToolCallError {
    mari_tool_error(
        "mari_write_requires_approval",
        "Professor Mari write tools require explicit user approval and are disabled for autonomous tool runs.",
    )
}

fn default_agent_phase() -> String {
    "parallel".to_string()
}

fn marinara_repo_root() -> AppResult<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let Some(root) = manifest_dir.parent() else {
        return Err(AppError::new(
            "mari_repo_root_unavailable",
            "Could not resolve Marinara Engine repository root",
        ));
    };
    let root = root.canonicalize().map_err(AppError::from)?;
    if root.join("AGENTS.md").is_file() && root.join("package.json").is_file() {
        Ok(root)
    } else {
        Err(AppError::new(
            "mari_repo_root_unavailable",
            "Professor Mari could not find AGENTS.md and package.json at the repository root",
        ))
    }
}

fn resolve_repo_file(path: &str) -> AppResult<(PathBuf, PathBuf, String)> {
    let root = marinara_repo_root()?;
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::invalid_input(
            "Repository-relative path is required",
        ));
    }
    let relative = assert_relative_safe_path(trimmed)?;
    if relative.as_os_str().is_empty() || is_skipped_relative_path(&relative) {
        return Err(AppError::invalid_input(
            "That path is not available to Professor Mari",
        ));
    }
    let resolved = assert_inside_dir(&root, &relative)?;
    let display_path = relative.to_string_lossy().replace('\\', "/");
    Ok((root, resolved, display_path))
}

fn search_marinara_code(args: SearchMarinaraCodeArgs) -> AppResult<Value> {
    let query = args.query.trim();
    if query.is_empty() {
        return Err(AppError::invalid_input("Search query is required"));
    }
    let max_results = args.max_results.unwrap_or(32).clamp(1, 80);
    let (root, start, display_root) = match args
        .path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
    {
        Some(path) => resolve_repo_file(path)?,
        None => {
            let root = marinara_repo_root()?;
            (root.clone(), root, ".".to_string())
        }
    };
    if !start.exists() {
        return Err(AppError::not_found(format!("{display_root} was not found")));
    }

    let mut results = Vec::new();
    let mut searched_files = 0usize;
    let query_lower = query.to_ascii_lowercase();
    if start.is_file() {
        search_code_file(
            &root,
            &start,
            &query_lower,
            max_results,
            &mut searched_files,
            &mut results,
        )?;
    } else {
        search_code_dir(
            &root,
            &start,
            &query_lower,
            max_results,
            &mut searched_files,
            &mut results,
        )?;
    }

    Ok(json!({
        "query": query,
        "path": display_root,
        "searchedFiles": searched_files,
        "truncated": results.len() >= max_results,
        "results": results,
    }))
}

fn read_marinara_code_file(path: &str) -> AppResult<Value> {
    let (_root, target, display_path) = resolve_repo_file(path)?;
    if !target.is_file() {
        return Err(AppError::not_found(format!("{display_path} was not found")));
    }
    if !is_code_text_path(Path::new(&display_path)) {
        return Err(AppError::invalid_input(format!(
            "{display_path} is not a readable source or guidance file"
        )));
    }
    let metadata = fs::metadata(&target)?;
    if metadata.len() > CODE_READ_MAX_FILE_BYTES {
        return Err(AppError::invalid_input(format!(
            "{display_path} is too large to read directly; search it first and request a narrower file"
        )));
    }
    let content = fs::read_to_string(&target).map_err(|error| {
        AppError::new(
            "mari_code_read_failed",
            format!("{display_path} is not valid UTF-8: {error}"),
        )
    })?;
    if !is_context_safe_source_text(&content) {
        return Err(AppError::invalid_input(format!(
            "{display_path} appears to contain generated, encoded, or binary-like content; search narrower source files instead"
        )));
    }
    Ok(json!({
        "path": display_path,
        "bytes": content.len(),
        "content": content,
    }))
}

fn edit_marinara_code_file(path: &str, old_text: &str, new_text: &str) -> AppResult<Value> {
    let (_root, target, display_path) = resolve_repo_file(path)?;
    if !target.is_file() {
        return Err(AppError::not_found(format!("{display_path} was not found")));
    }
    if !is_code_text_path(Path::new(&display_path)) {
        return Err(AppError::invalid_input(format!(
            "{display_path} is not an editable source or guidance file"
        )));
    }
    if old_text.is_empty() {
        return Err(AppError::invalid_input("old_text must not be empty"));
    }
    if old_text.len() > CODE_EDIT_MAX_TEXT_BYTES || new_text.len() > CODE_EDIT_MAX_TEXT_BYTES {
        return Err(AppError::invalid_input("Edit text is too large"));
    }
    let metadata = fs::metadata(&target)?;
    if metadata.len() > CODE_EDIT_MAX_FILE_BYTES {
        return Err(AppError::invalid_input(format!(
            "{display_path} is too large for an exact edit"
        )));
    }
    let content = fs::read_to_string(&target).map_err(|error| {
        AppError::new(
            "mari_code_edit_failed",
            format!("{display_path} is not valid UTF-8: {error}"),
        )
    })?;
    let matches = content.matches(old_text).count();
    if matches != 1 {
        return Err(AppError::invalid_input(format!(
            "old_text must occur exactly once in {display_path}; found {matches}"
        )));
    }
    let updated = content.replacen(old_text, new_text, 1);
    fs::write(&target, updated.as_bytes())?;
    Ok(json!({
        "path": display_path,
        "replacements": 1,
        "bytes": updated.len(),
    }))
}

fn create_marinara_extension(
    state: &AppState,
    args: CreateMarinaraExtensionArgs,
) -> AppResult<Value> {
    let name = args.name.trim();
    if name.is_empty() {
        return Err(AppError::invalid_input("Extension name is required"));
    }
    let css = args.css.filter(|value| !value.trim().is_empty());
    let js = args.js.filter(|value| !value.trim().is_empty());
    if css.as_ref().map(|value| value.len()).unwrap_or(0) > CODE_EDIT_MAX_TEXT_BYTES {
        return Err(AppError::invalid_input("Extension CSS is too large"));
    }
    if js.as_ref().map(|value| value.len()).unwrap_or(0) > 1024 * 1024 {
        return Err(AppError::invalid_input("Extension JavaScript is too large"));
    }
    state.storage.create(
        "extensions",
        json!({
            "name": name,
            "description": args.description,
            "css": css,
            "js": js,
            "enabled": false,
            "installedAt": now_iso(),
        }),
    )
}

fn create_marinara_custom_agent(
    state: &AppState,
    args: CreateMarinaraCustomAgentArgs,
) -> AppResult<Value> {
    let name = args.name.trim();
    let prompt_template = args.prompt_template.trim();
    if name.is_empty() {
        return Err(AppError::invalid_input("Agent name is required"));
    }
    if prompt_template.is_empty() {
        return Err(AppError::invalid_input("Agent prompt_template is required"));
    }
    if !matches!(
        args.phase.as_str(),
        "pre_generation" | "parallel" | "post_processing"
    ) {
        return Err(AppError::invalid_input(
            "Agent phase must be pre_generation, parallel, or post_processing",
        ));
    }

    let agent_type = unique_agent_type(
        state,
        args.agent_type
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| slugify_agent_type(name)),
    )?;
    let mut settings = match args
        .settings_json
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(raw) => serde_json::from_str::<Value>(raw)
            .map_err(|error| {
                AppError::invalid_input(format!("settings_json must be valid JSON: {error}"))
            })?
            .as_object()
            .cloned()
            .ok_or_else(|| AppError::invalid_input("settings_json must be a JSON object"))?,
        None => serde_json::Map::new(),
    };
    if let Some(result_type) = args
        .result_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        settings.insert(
            "resultType".to_string(),
            Value::String(result_type.to_string()),
        );
    } else {
        settings
            .entry("resultType".to_string())
            .or_insert(Value::String("context_injection".to_string()));
    }

    let body = shared::with_entity_defaults(
        "agents",
        json!({
            "type": agent_type,
            "name": name,
            "description": args.description,
            "phase": args.phase,
            "enabled": false,
            "connectionId": args.connection_id.filter(|value| !value.trim().is_empty()),
            "promptTemplate": prompt_template,
            "settings": Value::Object(settings),
        }),
    )?;
    state.storage.create("agents", body)
}

fn unique_agent_type(state: &AppState, preferred: String) -> AppResult<String> {
    let base = sanitize_agent_type(&preferred);
    let existing = state
        .storage
        .list("agents")?
        .into_iter()
        .filter_map(|row| {
            row.get("type")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .collect::<std::collections::HashSet<_>>();
    if !existing.contains(&base) {
        return Ok(base);
    }
    for index in 2..1000 {
        let candidate = format!("{base}-{index}");
        if !existing.contains(&candidate) {
            return Ok(candidate);
        }
    }
    Err(AppError::invalid_input(
        "Could not create a unique agent type",
    ))
}

fn slugify_agent_type(value: &str) -> String {
    sanitize_agent_type(&format!("custom-{value}"))
}

fn sanitize_agent_type(value: &str) -> String {
    let mut output = String::new();
    let mut previous_dash = false;
    for ch in value.chars().flat_map(char::to_lowercase) {
        if ch.is_ascii_alphanumeric() {
            output.push(ch);
            previous_dash = false;
        } else if !previous_dash {
            output.push('-');
            previous_dash = true;
        }
        if output.len() >= 80 {
            break;
        }
    }
    let trimmed = output.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "custom-professor-mari-agent".to_string()
    } else if trimmed.starts_with("custom-") {
        trimmed
    } else {
        format!("custom-{trimmed}")
    }
}

fn search_code_dir(
    root: &Path,
    dir: &Path,
    query_lower: &str,
    max_results: usize,
    searched_files: &mut usize,
    results: &mut Vec<Value>,
) -> AppResult<()> {
    if results.len() >= max_results {
        return Ok(());
    }
    let mut entries = fs::read_dir(dir)?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.path());
    for entry in entries {
        if results.len() >= max_results {
            break;
        }
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(value) => value,
            Err(_) => continue,
        };
        if file_type.is_symlink() {
            continue;
        }
        let relative = path.strip_prefix(root).unwrap_or(&path);
        if is_skipped_relative_path(relative) {
            continue;
        }
        if file_type.is_dir() {
            search_code_dir(
                root,
                &path,
                query_lower,
                max_results,
                searched_files,
                results,
            )?;
        } else if file_type.is_file() {
            search_code_file(
                root,
                &path,
                query_lower,
                max_results,
                searched_files,
                results,
            )?;
        }
    }
    Ok(())
}

fn search_code_file(
    root: &Path,
    path: &Path,
    query_lower: &str,
    max_results: usize,
    searched_files: &mut usize,
    results: &mut Vec<Value>,
) -> AppResult<()> {
    if results.len() >= max_results || !is_code_text_path(path) {
        return Ok(());
    }
    let metadata = match fs::metadata(path) {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };
    if metadata.len() > CODE_SEARCH_MAX_FILE_BYTES {
        return Ok(());
    }
    let Ok(content) = fs::read_to_string(path) else {
        return Ok(());
    };
    if !is_context_safe_source_text(&content) {
        return Ok(());
    }
    *searched_files += 1;
    let display_path = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    for (index, line) in content.lines().enumerate() {
        if !line.to_ascii_lowercase().contains(query_lower) {
            continue;
        }
        results.push(json!({
            "path": display_path,
            "line": index + 1,
            "preview": truncate_preview(line.trim()),
        }));
        if results.len() >= max_results {
            break;
        }
    }
    Ok(())
}

fn is_code_text_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| {
            let extension = extension.to_ascii_lowercase();
            CODE_SEARCH_ALLOWED_EXTENSIONS.contains(&extension.as_str())
        })
        .unwrap_or_else(|| {
            path.file_name()
                .and_then(|value| value.to_str())
                .map(|name| matches!(name, "AGENTS.md" | "README" | "LICENSE"))
                .unwrap_or(false)
        })
}

fn is_skipped_relative_path(path: &Path) -> bool {
    let normalized = path.to_string_lossy().replace('\\', "/");
    if CODE_SEARCH_SKIP_PATH_PREFIXES
        .iter()
        .any(|prefix| normalized == *prefix || normalized.starts_with(&format!("{prefix}/")))
    {
        return true;
    }
    path.components().any(|component| {
        let value = component.as_os_str().to_string_lossy();
        CODE_SEARCH_SKIP_DIRS.contains(&value.as_ref())
    })
}

fn truncate_preview(value: &str) -> String {
    const MAX_CHARS: usize = 240;
    let mut chars = value.chars();
    let preview = chars.by_ref().take(MAX_CHARS).collect::<String>();
    if chars.next().is_some() {
        format!("{preview}...")
    } else {
        preview
    }
}

fn is_context_safe_source_text(content: &str) -> bool {
    let compact_content = content
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<String>();
    !content.as_bytes().contains(&0)
        && !looks_like_encoded_blob(&compact_content)
        && !content.lines().map(str::trim).any(looks_like_encoded_blob)
}

fn looks_like_encoded_blob(value: &str) -> bool {
    const MIN_BLOB_CHARS: usize = 2048;
    if value.len() < MIN_BLOB_CHARS {
        return false;
    }
    let lower = value
        .chars()
        .take(64)
        .collect::<String>()
        .to_ascii_lowercase();
    if lower.starts_with("data:") || lower.contains(";base64,") {
        return true;
    }
    let mut encoded_chars = 0usize;
    let mut whitespace_chars = 0usize;
    let mut total_chars = 0usize;
    for ch in value.chars() {
        total_chars += 1;
        if ch.is_whitespace() {
            whitespace_chars += 1;
            continue;
        }
        if ch.is_ascii_alphanumeric() || matches!(ch, '+' | '/' | '=' | '-' | '_') {
            encoded_chars += 1;
        }
    }
    let non_whitespace_chars = total_chars.saturating_sub(whitespace_chars);
    non_whitespace_chars >= MIN_BLOB_CHARS
        && whitespace_chars * 100 / total_chars <= 5
        && encoded_chars * 100 / non_whitespace_chars >= 96
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_connection(provider: &str) -> marinara_llm::LlmConnection {
        marinara_llm::LlmConnection {
            provider: provider.to_string(),
            model: "test-model".to_string(),
            api_key: String::new(),
            base_url: String::new(),
            openrouter_provider: None,
            enable_caching: false,
            caching_at_depth: None,
            max_tokens_override: None,
            claude_fast_mode: false,
        }
    }

    fn text_message(content: &str) -> ChatMessage {
        ChatMessage {
            role: ChatRole::User,
            message_type: MessageType::Text,
            content: content.to_string(),
        }
    }

    fn test_tool(name: &str) -> Tool {
        Tool {
            tool_type: "function".to_string(),
            function: autoagents::llm::chat::FunctionTool {
                name: name.to_string(),
                description: "Test tool".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {},
                    "required": []
                }),
            },
        }
    }

    #[test]
    fn professor_mari_custom_connections_use_string_tool_choice() {
        let connection = test_connection("custom");
        let messages = [text_message("What does src/app/shell/AppShell.tsx do?")];
        let tools = [test_tool("search_marinara_code")];

        let parameters = mari_request_parameters(&connection, &messages, &tools);

        assert_eq!(parameters["toolChoice"], json!("required"));
    }

    #[test]
    fn professor_mari_known_openai_connections_keep_exact_tool_choice() {
        let connection = test_connection("openai");
        let messages = [text_message("What does src/app/shell/AppShell.tsx do?")];
        let tools = [test_tool("search_marinara_code")];

        let parameters = mari_request_parameters(&connection, &messages, &tools);

        assert_eq!(
            parameters["toolChoice"],
            json!({
                "type": "function",
                "function": { "name": "search_marinara_code" }
            })
        );
    }

    #[test]
    fn professor_mari_custom_library_questions_use_string_tool_choice() {
        let connection = test_connection("custom");
        let messages = [text_message("What personas are in my library?")];
        let tools = [test_tool("read_marinara_library")];

        let parameters = mari_request_parameters(&connection, &messages, &tools);

        assert_eq!(parameters["toolChoice"], json!("required"));
    }

    fn prompt_with_attachment(attachment: MariAttachment) -> String {
        prompt_with_attachments(vec![attachment])
    }

    fn prompt_with_attachments(attachments: Vec<MariAttachment>) -> String {
        build_task_prompt(
            &MariPromptRequest {
                user_message: "Please inspect this attachment.".to_string(),
                messages: Vec::new(),
                compacted_summary: None,
                connection_id: Some("connection".to_string()),
                persona: None,
                attachments,
            },
            None,
        )
    }

    #[test]
    fn professor_mari_prompt_omits_raw_image_attachment_data_urls() {
        let raw_data_url = format!("data:image/png;base64,{}", "A".repeat(4096));
        let prompt = prompt_with_attachment(MariAttachment {
            name: "screenshot.png".to_string(),
            r#type: "image/png".to_string(),
            size: 4096,
            content: raw_data_url.clone(),
        });

        assert!(!prompt.contains(&raw_data_url));
        assert!(prompt.contains("screenshot.png"));
        assert!(prompt.contains("omitted"));
    }

    #[test]
    fn professor_mari_prompt_truncates_large_text_attachments() {
        let marker = "tail-that-should-not-enter-context";
        let content = format!("{}{}", "safe text\n".repeat(20_000), marker);
        let prompt = prompt_with_attachment(MariAttachment {
            name: "debug.log".to_string(),
            r#type: "text/plain".to_string(),
            size: content.len() as u64,
            content,
        });

        assert!(prompt.contains("debug.log"));
        assert!(prompt.contains("Attachment truncated"));
        assert!(!prompt.contains(marker));
    }

    #[test]
    fn professor_mari_prompt_bounds_attachment_metadata() {
        let marker = "metadata-tail-that-should-not-enter-context";
        let attachments = (0..(MARI_ATTACHMENT_MAX_COUNT + 8))
            .map(|index| MariAttachment {
                name: format!("{}-{marker}-{index}.txt", "name".repeat(100)),
                r#type: format!("text/plain;{}", "charset=utf-8;".repeat(40)),
                size: 0,
                content: String::new(),
            })
            .collect::<Vec<_>>();

        let prompt = prompt_with_attachments(attachments);

        assert!(!prompt.contains(marker));
        assert!(prompt.matches("File:").count() <= MARI_ATTACHMENT_MAX_COUNT);
        assert!(prompt.contains("additional attachment(s) omitted"));
    }

    #[test]
    fn professor_mari_code_tools_reject_encoded_source_payloads() {
        assert!(is_context_safe_source_text(
            "export function usefulSource() {\n  return 'readable code';\n}\n"
        ));
        assert!(!is_context_safe_source_text(&format!(
            "{{\"image\":\"data:image/png;base64,{}\"}}",
            "A".repeat(4096)
        )));
    }

    #[test]
    fn professor_mari_code_tools_reject_wrapped_encoded_source_payloads() {
        let payload = "A"
            .repeat(4096)
            .as_bytes()
            .chunks(76)
            .map(|chunk| std::str::from_utf8(chunk).expect("ASCII test payload"))
            .collect::<Vec<_>>()
            .join("\n");
        let source = format!("export const embeddedImage = `\n{payload}\n`;");

        assert!(!is_context_safe_source_text(&source));
    }
}
