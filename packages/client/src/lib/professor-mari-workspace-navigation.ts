export type ProfessorMariWorkspaceDestination = "chat" | "chats" | "memories" | "skills" | "context" | "approvals";

export type ProfessorMariWorkspaceBackAction = "detail" | "destination" | "workspace";

export function resolveProfessorMariWorkspaceBackAction(
  destination: ProfessorMariWorkspaceDestination,
  hasDetail: boolean,
): ProfessorMariWorkspaceBackAction {
  if (destination === "chat") return "workspace";
  return hasDetail ? "detail" : "destination";
}
