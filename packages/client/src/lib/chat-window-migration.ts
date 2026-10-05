import { getLegacyChatWindowLayout as getLegacyLayout, type Chat } from "@marinara-engine/shared";
import type { WindowLayoutSnapshot } from "./floating-window-layout";

/** Keep an older chat's toolbar tools visible until its user chooses to put them in Chat Settings. */
export function getLegacyChatWindowLayout(
  mode: Chat["mode"],
  metadata: Record<string, unknown>,
): WindowLayoutSnapshot | null {
  return getLegacyLayout(mode, metadata);
}
