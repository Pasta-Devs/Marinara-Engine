import { stripMacroComments } from "@marinara-engine/shared";

export function cardPromptText(value: unknown): string {
  return typeof value === "string" ? stripMacroComments(value).trim() : "";
}

/**
 * #9427: with Impersonate's Public Faces switch on, an impersonated turn sees a character only as
 * its name and Public Face, in place of everything else its card sends. Returns "" when the switch
 * is off or the card has no Public Face, so the full card stays.
 */
export function impersonatePublicFaceText(
  data: { extensions?: { publicFace?: unknown } | null } | null | undefined,
  impersonatePublicFaces: boolean | undefined,
): string {
  return impersonatePublicFaces === true ? cardPromptText(data?.extensions?.publicFace) : "";
}
