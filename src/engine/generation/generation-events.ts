export type GenerationEvent =
  | { type: "phase"; data: string }
  | { type: "thinking"; data: string }
  | { type: "token"; data: string }
  | { type: "tool_call"; data: { id?: string; name: string; arguments: string } }
  | { type: "tool_result"; data: { toolCallId?: string; name: string; result: string; success: boolean } }
  | { type: "typing"; data: { characters: string[] } }
  | { type: "delayed"; data: { characters: string[]; status: string; delayMs: number } }
  | { type: "offline"; data: { characters: string[] } }
  | { type: "group_turn"; data: { characterId: string; characterName: string; index: number } }
  | { type: "user_message"; data: unknown }
  | { type: "assistant_message"; data: unknown }
  | { type: "agent_injection_review"; data: unknown }
  | { type: "agent_result"; data: unknown }
  | { type: "cross_post"; data: unknown }
  | { type: "assistant_action"; data: unknown }
  | { type: "ooc_posted"; data: unknown }
  | { type: "selfie"; data: unknown }
  | { type: "selfie_error"; data: unknown }
  | { type: "command_error"; data: unknown }
  | { type: "illustration"; data: unknown }
  | { type: "illustration_error"; data: unknown }
  | { type: "scene_created"; data: unknown }
  | { type: "done"; data?: unknown };
