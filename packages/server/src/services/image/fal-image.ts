export function buildFalImageUrl(baseUrl: string, model?: string): string {
  const endpoint = model?.trim() || "fal-ai/flux/schnell";
  const segments = endpoint.split("/");
  if (segments.length < 2 || segments.some((part) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part))) {
    throw new Error("fal.ai requires a model endpoint ID, such as fal-ai/flux/schnell");
  }
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("fal.ai requires an HTTP or HTTPS base URL");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${endpoint}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
