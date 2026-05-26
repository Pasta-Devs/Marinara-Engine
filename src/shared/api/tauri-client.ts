import { invoke } from "@tauri-apps/api/core";
import { ApiError } from "./api-errors";
import { invokeRemote, isRemoteCommand, remoteRuntimeTarget } from "./remote-runtime";

function normalize(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : "";
    const status =
      code === "not_found" ? 404 : code === "invalid_input" ? 400 : code === "connection_in_use" ? 409 : 500;
    const message = typeof record.message === "string" ? record.message : "Tauri command failed";
    return new ApiError(message, status, record);
  }
  return new ApiError(String(error ?? "Tauri command failed"), 500, error);
}

function hasEmbeddedTauriIpc(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

export async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const runtimeTarget = remoteRuntimeTarget();
  const remoteCommand = isRemoteCommand(command);
  if (runtimeTarget && remoteCommand) {
    return invokeRemote<T>(command, args);
  }
  if (!hasEmbeddedTauriIpc()) {
    throw new ApiError(
      remoteCommand ? "Remote Runtime URL is not configured" : "This action requires the Tauri app shell",
      400,
    );
  }
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw normalize(error);
  }
}
