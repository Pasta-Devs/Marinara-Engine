import { DEFAULT_ROLEPLAY_BACKGROUND_URL } from "../stores/ui.store";

/** True for the stock chat background, so themes can swap it out with [data-default-background]. */
export function isDefaultChatBackground(url: string | null | undefined) {
  if (!url) return false;
  return url.split("?")[0]!.endsWith(DEFAULT_ROLEPLAY_BACKGROUND_URL);
}
