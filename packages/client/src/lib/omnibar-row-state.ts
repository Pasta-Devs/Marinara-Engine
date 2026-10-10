// Selection stability: the omnibar keeps the same selected result while the
// user types. It only moves when the current selection leaves the list (or the
// list empties). Callers must NOT reset the selection on every keystroke — let
// this reconcile decide, so slight score shifts never snap the choice to the top.
export function reconcileActiveResultId(current: string | null, resultIds: readonly string[]): string | null {
  if (!resultIds.length) return null;
  if (current && resultIds.includes(current)) return current;
  return resultIds[0]!;
}

export type OmnibarRowResource = "character" | "persona" | "preset" | "connection";

export type OmnibarRowState = {
  inActiveChat: boolean;
  globallyActive: boolean;
  canAddToChat: boolean;
  globalAction: "activate-persona" | "set-default-preset" | null;
};

export function resolveOmnibarRowState(input: {
  resource: OmnibarRowResource;
  id: string;
  activeChat?: {
    characterIds?: readonly string[];
    personaId?: string | null;
    promptPresetId?: string | null;
    connectionId?: string | null;
  } | null;
  globallyActive?: boolean;
}): OmnibarRowState {
  const chat = input.activeChat;
  const inActiveChat =
    input.resource === "character"
      ? (chat?.characterIds ?? []).includes(input.id)
      : input.resource === "persona"
        ? chat?.personaId === input.id
        : input.resource === "preset"
          ? chat?.promptPresetId === input.id
          : chat?.connectionId === input.id;
  const globallyActive = input.globallyActive === true;
  const globalAction =
    input.resource === "persona" && !globallyActive
      ? "activate-persona"
      : input.resource === "preset" && !globallyActive
        ? "set-default-preset"
        : null;

  return { inActiveChat, globallyActive, canAddToChat: !inActiveChat, globalAction };
}
