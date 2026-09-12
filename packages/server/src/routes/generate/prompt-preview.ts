import type { FastifyInstance, FastifyRequest } from "fastify";

type PromptPreviewBody = {
  prompt?: { messages: Array<{ role: string; content: string }>; advancedMemory?: unknown };
  parameters?: Record<string, unknown>;
  error?: string;
};

/** Reuse the read-only generation assembly for preview entry points, including its audience and budget checks. */
export async function forwardPromptPreview(
  app: FastifyInstance,
  request: FastifyRequest,
  payload: Record<string, unknown>,
): Promise<{ statusCode: number; body: PromptPreviewBody }> {
  const headers: Record<string, string | string[] | undefined> = {
    ...request.headers,
    "content-type": "application/json",
  };
  delete headers["content-length"];
  delete headers["transfer-encoding"];
  delete headers["x-forwarded-for"];
  delete headers.forwarded;
  delete headers["x-real-ip"];
  const response = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    // The outer route already authorized this read. A synthetic remote socket cannot reproduce Tailscale's local interface.
    remoteAddress: "127.0.0.1",
    headers,
    payload: {
      ...payload,
      returnPrompt: true,
      streaming: false,
      wrapLastMessage: true,
      injectLorebook: true,
      injectTrackers: true,
      injectChatSummary: true,
    },
  });
  try {
    return {
      statusCode: response.statusCode,
      body: response.json<PromptPreviewBody>(),
    };
  } catch {
    return {
      statusCode: response.statusCode >= 400 ? response.statusCode : 502,
      body: { error: "Prompt preview could not be prepared." },
    };
  }
}
