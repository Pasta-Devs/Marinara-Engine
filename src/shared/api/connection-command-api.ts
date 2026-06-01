import { invokeTauri } from "./tauri-client";

export const connectionCommandApi = {
  test: <T = unknown>(id: string) => invokeTauri<T>("connection_test", { id }),
  testMessage: <T = unknown>(id: string) => invokeTauri<T>("connection_test_message", { id }),
  testImage: <T = unknown>(id: string) => invokeTauri<T>("connection_test_image", { id }),
  diagnoseClaudeSubscription: <T = unknown>(id: string) =>
    invokeTauri<T>("connection_diagnose_claude_subscription", { id }),
  models: <T = unknown>(id: string) => invokeTauri<T>("connection_models", { id }),
  saveDefaultParameters: (id: string, params: Record<string, unknown> | null) =>
    invokeTauri("connection_save_default_parameters", { id, params }),
  reorderFolders: <T = unknown>(orderedIds: string[]) =>
    invokeTauri<T>("connection_folder_reorder", { orderedIds }),
  move: <T = unknown>(connectionId: string, folderId: string | null) =>
    invokeTauri<T>("connection_move", { connectionId, folderId }),
};
