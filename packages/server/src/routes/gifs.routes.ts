// ──────────────────────────────────────────────
// Routes: Giphy GIF proxy (keeps API key server-side)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getGifApiKey } from "../config/runtime-config.js";

const GIPHY_BASE = "https://api.giphy.com/v1/gifs";
const GIPHY_REQUEST_TIMEOUT_MS = 12_000;

const giphyImageAssetSchema = z.preprocess(
  (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {}),
  z.object({
    url: z.string().url().regex(/^https?:\/\//i).optional(),
    width: z.unknown().optional(),
    height: z.unknown().optional(),
  }),
);

const giphyItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    images: z.object({
      fixed_height_small: giphyImageAssetSchema.optional(),
      fixed_height: giphyImageAssetSchema.optional(),
      original: giphyImageAssetSchema.optional(),
    }),
  })
  .transform(({ id, title, images }, ctx) => {
    const preview = images.fixed_height_small?.url ?? images.fixed_height?.url;
    const url = images.original?.url ?? images.fixed_height?.url;
    if (!preview || !url) {
      ctx.addIssue({ code: "custom", message: "Giphy item has no usable image URL" });
      return z.NEVER;
    }

    const width = Number(images.fixed_height?.width);
    const height = Number(images.fixed_height?.height);
    return {
      id,
      title,
      preview,
      url,
      width: Number.isFinite(width) ? width || 200 : 200,
      height: Number.isFinite(height) ? height || 200 : 200,
    };
  });

const giphyResponseSchema = z.object({
  data: z.array(z.unknown()).transform((items) =>
    items.flatMap((item) => {
      const result = giphyItemSchema.safeParse(item);
      return result.success ? [result.data] : [];
    }),
  ),
  pagination: z.object({
    offset: z.number().finite(),
    count: z.number().finite(),
    total_count: z.number().finite(),
  }),
});

export async function gifsRoutes(app: FastifyInstance) {
  // GET /api/gifs/search?q=hello&limit=20&pos=
  app.get<{
    Querystring: { q?: string; limit?: string; pos?: string };
  }>("/search", async (req, reply) => {
    const apiKey = getGifApiKey();
    if (!apiKey) {
      return reply.status(503).send({ code: "missing_giphy_api_key", error: "GIF search needs a GIPHY_API_KEY." });
    }

    const q = (req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.pos) || 0;

    // Use trending endpoint when no query
    const endpoint = q ? "search" : "trending";
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(limit),
      offset: String(offset),
      rating: "r",
      ...(q && { q }),
    });

    const url = `${GIPHY_BASE}/${endpoint}?${params}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(GIPHY_REQUEST_TIMEOUT_MS) });

      if (!res.ok) {
        req.log.error({ status: res.status }, "Giphy API error");
        return reply.status(502).send({ error: "Giphy API request failed" });
      }

      const { data: results, pagination } = giphyResponseSchema.parse(await res.json());
      const { offset, count, total_count: totalCount } = pagination;

      const nextOffset = offset + count;
      const hasMore = nextOffset < totalCount;

      return { results, next: hasMore ? String(nextOffset) : "" };
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      req.log.error(error, timedOut ? "Giphy API request timed out" : "Giphy API request failed");
      return reply.status(timedOut ? 504 : 502).send({
        error: timedOut ? "Giphy API request timed out" : "Giphy API request failed",
      });
    }
  });
}
