import type { UserStatus } from "../stores/ui.store";

export type AutonomousPresenceStatus = "active" | "idle" | "dnd";

export function toAutonomousPresenceStatus(status: UserStatus): AutonomousPresenceStatus {
  return status === "idle" || status === "dnd" ? status : "active";
}
