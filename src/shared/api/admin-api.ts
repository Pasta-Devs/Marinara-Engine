import { invokeTauri } from "./tauri-client";

export const adminApi = {
  expunge: (scopes: readonly string[]) => invokeTauri<{ success: boolean }>("admin_expunge_command", { scopes }),
  clearAll: () => invokeTauri<{ success: boolean }>("admin_clear_all_command", { confirm: true }),
};
