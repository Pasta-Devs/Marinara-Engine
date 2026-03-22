// ──────────────────────────────────────────────
// Routes: Giphy GIF proxy (keeps API key server-side)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";

const GIPHY_BASE = "https://api.giphy.com/v1/gifs";
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || "BmPN9Hl0X7nVIRStmvSh6dgAdmvyFgvf";

export async function gifsRoutes(app: FastifyInstance) {
  // GET /api/gifs/search?q=hello&limit=20&pos=
  app.get<{
    Querystring: { q?: string; limit?: string; pos?: string };
  }>("/search", async (req, reply) => {
    if (!GIPHY_API_KEY) {
      return reply.status(503).send({ error: "GIF search unavailable — no GIPHY_API_KEY configured" });
    }
    const key = GIPHY_API_KEY;

    const q = (req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.pos) || 0;

    // Use trending endpoint when no query
    const endpoint = q ? "search" : "trending";
    const params = new URLSearchParams({
      api_key: key,
      limit: String(limit),
      offset: String(offset),
      rating: "r",
      ...(q && { q }),
    });

    const url = `${GIPHY_BASE}/${endpoint}?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.text();
      req.log.error({ status: res.status, body }, "Giphy API error");
      return reply.status(502).send({ error: "Giphy API request failed" });
    }

    const data = (await res.json()) as {
      data?: any[];
      pagination?: { offset?: number; count?: number; total_count?: number };
    };
    const items = data.data ?? [];
    const pagination = data.pagination;
    const nextOffset = (pagination?.offset ?? 0) + (pagination?.count ?? 0);
    const hasMore = nextOffset < (pagination?.total_count ?? 0);

    // Map to a simplified format for the client
    const results = items.map((g: any) => ({
      id: g.id,
      title: g.title ?? "",
      preview: g.images?.fixed_height_small?.url ?? g.images?.fixed_height?.url ?? "",
      url: g.images?.original?.url ?? g.images?.fixed_height?.url ?? "",
      width: Number(g.images?.fixed_height?.width) || 200,
      height: Number(g.images?.fixed_height?.height) || 200,
    }));

    return { results, next: hasMore ? String(nextOffset) : "" };
  });
}
