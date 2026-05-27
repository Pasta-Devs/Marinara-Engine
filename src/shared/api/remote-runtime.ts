import type { LlmChunk, LlmRequest } from "../../engine/capabilities/llm";
import { useUIStore } from "../stores/ui.store";
import { ApiError, parseRetryAfterMs } from "./api-errors";

const REMOTE_COMMANDS = new Set([
  "load_url_binary",
  "profile_export",
  "profile_import",
  "backup_create",
  "backup_list",
  "backup_delete",
  "backup_download",
  "prompt_export",
  "prompts_export_bulk",
  "character_export",
  "character_export_png",
  "character_embedded_lorebook_import",
  "characters_export_bulk",
  "persona_export",
  "personas_export_bulk",
  "lorebook_export",
  "lorebooks_export_bulk",
  "lorebook_vectorize",
  "backgrounds_list",
  "backgrounds_tags",
  "background_upload",
  "background_delete",
  "background_tags_update",
  "background_rename",
  "fonts_list",
  "fonts_google_download",
  "bot_browser_get",
  "bot_browser_post",
  "game_assets_list",
  "game_assets_manifest",
  "game_assets_tree",
  "game_assets_rescan",
  "game_assets_create_folder",
  "game_assets_delete_folder",
  "game_assets_delete_file",
  "game_assets_file_path",
  "game_assets_read_text",
  "game_assets_write_text",
  "game_assets_rename",
  "game_assets_move",
  "game_assets_copy",
  "game_assets_move_bulk",
  "game_assets_copy_bulk",
  "game_assets_delete_bulk",
  "game_assets_file_info",
  "game_assets_folder_description",
  "game_assets_upload",
  "background_file_path",
  "lorebook_image_file_path",
  "gif_search",
  "tts_config",
  "tts_update_config",
  "tts_voices",
  "tts_speak",
  "translate_text_command",
  "spotify_status",
  "spotify_authorize",
  "spotify_exchange",
  "spotify_disconnect",
  "spotify_player",
  "spotify_devices",
  "spotify_access_token",
  "spotify_playlists",
  "spotify_playlist_tracks",
  "spotify_search_tracks",
  "spotify_play_track",
  "spotify_dj_mari_playlist",
  "spotify_player_play",
  "spotify_player_pause",
  "spotify_player_next",
  "spotify_player_previous",
  "spotify_player_transfer",
  "spotify_player_volume",
  "spotify_player_shuffle",
  "spotify_player_repeat",
  "knowledge_sources_list",
  "knowledge_source_upload",
  "knowledge_source_delete",
  "knowledge_source_text",
  "import_marinara",
  "import_marinara_file",
  "import_st_character",
  "import_st_character_batch",
  "import_st_character_inspect",
  "import_st_chat",
  "import_st_chat_into_group",
  "import_st_preset",
  "import_st_lorebook",
  "import_list_directory",
  "import_st_bulk_scan",
  "import_st_bulk_run",
  "custom_tool_execute",
  "custom_tool_capabilities",
  "agent_patch_by_type",
  "agent_toggle_by_type",
  "agent_cadence_status",
  "storage_list",
  "storage_get",
  "storage_create",
  "storage_update",
  "storage_delete",
  "storage_duplicate",
  "chat_message_add_swipe",
  "chat_message_set_active_swipe",
  "chat_message_delete_swipe",
  "chat_autonomous_unread_mark",
  "chat_autonomous_unread_clear",
  "tracker_snapshot_latest",
  "tracker_snapshot_get",
  "tracker_snapshot_save",
  "chat_memories_list",
  "chat_memory_delete",
  "chat_memories_clear",
  "chat_memories_refresh",
  "chat_memories_export",
  "chat_memories_import",
  "chat_notes_list",
  "chat_note_delete",
  "chat_notes_clear",
  "chat_group_delete",
  "chat_messages_bulk_delete",
  "chat_branch",
  "chat_message_swipes",
  "chat_connect",
  "chat_disconnect",
  "admin_expunge_command",
  "admin_clear_all_command",
  "agent_memory_get",
  "agent_memory_patch",
  "agent_memory_clear",
  "agent_runs_clear_for_chat",
  "agent_echo_messages_clear",
  "sprite_capabilities_command",
  "sprite_cleanup_status_command",
  "sprite_generate_sheet",
  "sprite_generate_sheet_preview",
  "sprite_cleanup",
  "sprite_list",
  "sprite_upload",
  "sprite_upload_bulk",
  "sprite_delete",
  "sprite_cleanup_saved",
  "sprite_cleanup_restore",
  "avatar_generation_preview_command",
  "avatar_generation_command",
  "image_generate",
  "character_gallery_upload",
  "chat_gallery_upload",
  "connection_test",
  "connection_test_message",
  "connection_test_image",
  "connection_models",
  "connection_save_default_parameters",
  "persona_activate",
  "character_avatar_upload",
  "character_restore_version",
  "persona_avatar_upload",
  "npc_avatar_upload",
  "lorebook_image_upload",
  "llm_complete",
  "llm_stream_cancel",
  "llm_list_models",
  "professor_mari_prompt",
  "update_check",
  "update_apply",
]);

type RuntimeTarget = {
  baseUrl: string;
  authorization?: string;
};

function encodeBasicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${decodeURIComponent(username)}:${decodeURIComponent(password)}`)}`;
}

function normalizeRemoteRuntimeUrl(raw: string): RuntimeTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const url = new URL(trimmed);
  let authorization: string | undefined;
  if (url.username || url.password) {
    authorization = encodeBasicAuth(url.username, url.password);
    url.username = "";
    url.password = "";
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return { baseUrl: url.toString().replace(/\/+$/, ""), authorization };
}

export function remoteRuntimeTarget(): RuntimeTarget | null {
  const raw = useUIStore.getState().remoteRuntimeUrl;
  try {
    return normalizeRemoteRuntimeUrl(raw);
  } catch {
    throw new ApiError("Invalid Remote Runtime URL. Check Settings and enter a valid runtime URL.", 400, {
      code: "invalid_remote_runtime_url",
    });
  }
}

export function isRemoteCommand(command: string): boolean {
  return REMOTE_COMMANDS.has(command);
}

function remoteHeaders(target: RuntimeTarget, extra?: HeadersInit): HeadersInit {
  return {
    ...(target.authorization ? { Authorization: target.authorization } : {}),
    ...extra,
    "X-Marinara-CSRF": "1",
  };
}

async function readRemoteError(response: Response): Promise<ApiError> {
  const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
  try {
    const body = await response.json();
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message = typeof record.message === "string" ? record.message : `Remote runtime returned ${response.status}`;
    return new ApiError(message, response.status, retryAfterMs === null ? record : { ...record, retryAfterMs });
  } catch {
    return new ApiError(
      `Remote runtime returned ${response.status}`,
      response.status,
      retryAfterMs === null ? undefined : { retryAfterMs },
    );
  }
}

export async function invokeRemote<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const target = remoteRuntimeTarget();
  if (!target) throw new ApiError("Remote runtime URL is not configured", 400);
  const response = await fetch(`${target.baseUrl}/api/invoke`, {
    method: "POST",
    headers: remoteHeaders(target, { "content-type": "application/json" }),
    body: JSON.stringify({ command, args: args ?? null }),
  });
  if (!response.ok) throw await readRemoteError(response);
  return (await response.json()) as T;
}

function parseSseData(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const data = part
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (data) events.push(data);
  }
  return { events, rest };
}

export async function* streamRemoteLlm(
  streamId: string,
  request: LlmRequest,
  signal?: AbortSignal,
): AsyncGenerator<LlmChunk> {
  const target = remoteRuntimeTarget();
  if (!target) throw new ApiError("Remote runtime URL is not configured", 400);
  const response = await fetch(`${target.baseUrl}/api/llm/stream`, {
    method: "POST",
    headers: remoteHeaders(target, { "content-type": "application/json", accept: "text/event-stream" }),
    body: JSON.stringify({ streamId, request }),
    signal,
  });
  if (!response.ok) throw await readRemoteError(response);
  if (!response.body) throw new ApiError("Remote runtime did not return a stream", 500);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseData(buffer);
      buffer = parsed.rest;
      for (const data of parsed.events) {
        const event = JSON.parse(data) as LlmChunk;
        if (event.type === "error") throw new Error(String(event.text ?? event.data ?? "LLM stream failed"));
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function cancelRemoteLlmStream(streamId: string): Promise<void> {
  const target = remoteRuntimeTarget();
  if (!target) return;
  await fetch(`${target.baseUrl}/api/llm/stream/${encodeURIComponent(streamId)}/cancel`, {
    method: "POST",
    headers: remoteHeaders(target),
  }).catch(() => undefined);
}
