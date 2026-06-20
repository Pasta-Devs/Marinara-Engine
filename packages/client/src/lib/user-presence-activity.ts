import { api } from "./api-client";
import { useUIStore, type UserStatus } from "../stores/ui.store";
import { toAutonomousPresenceStatus } from "./user-status";

export function restoreAvailableAfterUserMessage(): UserStatus {
  const { userStatus, userStatusManual, setUserStatus } = useUIStore.getState();

  if (userStatusManual === "active" && userStatus === "idle") {
    setUserStatus("active");
    return "active";
  }

  return userStatus;
}

export async function recordUserMessageActivity(
  chatId: string,
  options: { preserveGenerationInProgress?: boolean } = {},
): Promise<void> {
  const userStatus = restoreAvailableAfterUserMessage();

  await Promise.allSettled([
    api.post("/conversation/activity/user", {
      chatId,
      preserveGenerationInProgress: options.preserveGenerationInProgress === true,
    }),
    api.post("/conversation/activity/presence", { chatId, userStatus: toAutonomousPresenceStatus(userStatus) }),
  ]);
}
