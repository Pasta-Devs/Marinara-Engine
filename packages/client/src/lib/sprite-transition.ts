export type SpriteTransition = "crossfade" | "bounce" | "shake" | "hop" | "none";
export type SpriteRenderMode = "expressions" | "full-body";

export function resolveSpriteTransition(
  renderMode: SpriteRenderMode,
  transition: SpriteTransition,
): SpriteTransition {
  return renderMode === "full-body" && transition === "none" ? "crossfade" : transition;
}
