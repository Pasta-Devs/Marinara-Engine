import { isLoopbackIp } from "../../middleware/ip-allowlist.js";
import { normalizeLoopbackUrl } from "../../utils/security.js";

export function buildFalImageUrl(baseUrl: string, model?: string): string {
  const endpoint = model?.trim() || "fal-ai/flux/schnell";
  const segments = endpoint.split("/");
  if (segments.length < 2 || segments.some((part) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part))) {
    throw new Error("fal.ai requires a model endpoint ID, such as fal-ai/flux/schnell");
  }
  const url = new URL(normalizeLoopbackUrl(baseUrl));
  const loopback = isLoopbackIp(url.hostname.replace(/^\[|\]$/g, ""));
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("fal.ai requires HTTPS except for loopback proxies");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${endpoint}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
