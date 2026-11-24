/**
 * Some reverse proxies (oai-reverse-proxy and its forks) answer a failed request with HTTP 200 and the error
 * written as the assistant's message, so chat front ends show it. That reply is a failure, not an answer: this
 * finds it and returns the proxy's reason in one line, e.g. "No OpenAI keys available for model gpt-6.1-sol".
 */
export function proxyErrorFromReply(text: string): string | null {
  if (!text) return null;
  const marked = text.includes("<!-- oai-proxy-error -->");
  const heading = /^\s*#{1,6}\s*\*{0,2}Proxy error\b/iu.test(text);
  if (!marked && !heading) return null;
  const json = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/u.exec(text);
  if (json) {
    try {
      return JSON.parse(`"${json[1]}"`) as string;
    } catch {
      return json[1]!;
    }
  }
  const emphasis = /^\s*\*([^*\n]+)\*\s*$/mu.exec(text);
  if (emphasis) return emphasis[1]!.trim();
  const title = /Proxy error\s*\(([^)]+)\)/iu.exec(text);
  return title ? `Proxy error (${title[1]})` : "The proxy returned an error.";
}
