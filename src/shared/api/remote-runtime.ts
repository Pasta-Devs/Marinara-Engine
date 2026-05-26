import type { LlmChunk, LlmRequest } from "../../engine/capabilities/llm";
import { useUIStore } from "../stores/ui.store";
import { ApiError } from "./api-errors";

const REMOTE_COMMANDS = new Set([
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
  "connection_test",
  "connection_test_message",
  "connection_test_image",
  "connection_models",
  "connection_save_default_parameters",
  "background_upload",
  "character_gallery_upload",
  "chat_gallery_upload",
  "image_generate",
  "avatar_generation_command",
  "sprite_generate_sheet",
  "sprite_generate_sheet_preview",
  "profile_export",
  "profile_import",
  "profile_import_file",
  "import_marinara",
  "import_marinara_file",
  "import_st_character",
  "import_st_character_batch",
  "import_st_character_inspect",
  "import_st_chat",
  "import_st_chat_into_group",
  "import_st_preset",
  "import_st_lorebook",
  "import_st_bulk_scan",
  "import_st_bulk_run",
  "llm_complete",
  "llm_list_models",
  "llm_stream_cancel",
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
  try {
    return normalizeRemoteRuntimeUrl(useUIStore.getState().remoteRuntimeUrl);
  } catch {
    return null;
  }
}

export function isRemoteCommand(command: string): boolean {
  return REMOTE_COMMANDS.has(command);
}

function remoteHeaders(target: RuntimeTarget, extra?: HeadersInit): HeadersInit {
  return {
    ...(target.authorization ? { Authorization: target.authorization } : {}),
    ...extra,
  };
}

async function readRemoteError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message = typeof record.message === "string" ? record.message : `Remote runtime returned ${response.status}`;
    return new ApiError(message, response.status, record);
  } catch {
    return new ApiError(`Remote runtime returned ${response.status}`, response.status);
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
