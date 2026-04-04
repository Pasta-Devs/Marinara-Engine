// ──────────────────────────────────────────────
// Routes: Browser — JannyAI provider
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";

const JANNY_SEARCH_URL = "https://search.jannyai.com/multi-search";
const JANNY_IMAGE_BASE = "https://image.jannyai.com/bot-avatars/";
const JANNY_SITE_BASE = "https://jannyai.com";
const JANNY_FALLBACK_TOKEN = "88a6463b66e04fb07ba87ee3db06af337f492ce511d93df6e2d2968cb2ff2b30";

let cachedToken: string = "";

async function getSearchToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  try {
    const pageResp = await fetch(`${JANNY_SITE_BASE}/characters/search`);
    const html = await pageResp.text();
    const configMatch = html.match(/client-config\.[a-zA-Z0-9_-]+\.js/);
    if (configMatch) {
      const cfgResp = await fetch(`${JANNY_SITE_BASE}/_astro/${configMatch[0]}`);
      if (cfgResp.ok) {
        const cfgJs = await cfgResp.text();
        const tokenMatch = cfgJs.match(/"([a-f0-9]{64})"/);
        if (tokenMatch?.[1]) {
          cachedToken = tokenMatch[1];
          return cachedToken;
        }
      }
    }
  } catch {
    // fall through to fallback
  }
  cachedToken = JANNY_FALLBACK_TOKEN;
  return cachedToken;
}

export async function botBrowserJannyRoutes(app: FastifyInstance) {
  // ── Search characters on JannyAI via MeiliSearch ──
  app.get<{
    Querystring: {
      q?: string;
      page?: string;
      limit?: string;
      sort?: string;
      nsfw?: string;
      showLowQuality?: string;
      min_tokens?: string;
      max_tokens?: string;
      tagIds?: string;
    };
  }>("/janny/search", async (req) => {
    const {
      q = "",
      page = "1",
      limit = "80",
      sort = "newest",
      nsfw = "true",
      showLowQuality = "false",
      min_tokens = "29",
      max_tokens = "100000",
      tagIds,
    } = req.query;

    const filters: string[] = [];
    filters.push(`totalToken >= ${parseInt(min_tokens) || 29}`);
    filters.push(`totalToken <= ${parseInt(max_tokens) || 100000}`);
    if (nsfw !== "true") filters.push("isNsfw = false");
    if (showLowQuality !== "true") filters.push("isLowQuality = false");

    if (tagIds) {
      const ids = tagIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        const tagClauses = ids.map((id) => `tagIds = ${id}`);
        filters.push(tagClauses.join(" AND "));
      }
    }

    const sortMap: Record<string, string[]> = {
      newest: ["createdAtStamp:desc"],
      oldest: ["createdAtStamp:asc"],
      tokens_desc: ["totalToken:desc"],
      tokens_asc: ["totalToken:asc"],
      relevant: [],
    };
    const sortArr: string[] = sortMap[sort] || sortMap.newest || [];

    const body: Record<string, unknown> = {
      queries: [
        {
          indexUid: "janny-characters",
          q,
          facets: ["isLowQuality", "isNsfw", "tagIds", "totalToken"],
          attributesToCrop: ["description:300"],
          cropMarker: "...",
          filter: filters,
          attributesToHighlight: ["name", "description"],
          highlightPreTag: "__ais-highlight__",
          highlightPostTag: "__/ais-highlight__",
          hitsPerPage: parseInt(limit) || 80,
          page: parseInt(page) || 1,
          ...(sortArr.length > 0 ? { sort: sortArr } : {}),
        },
      ],
    };

    const token = await getSearchToken();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(JANNY_SEARCH_URL, {
        method: "POST",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Origin: JANNY_SITE_BASE,
          Referer: `${JANNY_SITE_BASE}/`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`JannyAI search error ${res.status}`);
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  });

  // ── Proxy JannyAI avatar images ──
  // ── Fetch full character details by scraping JannyAI page ──
  app.get<{ Params: { id: string } }>("/janny/character/:id", async (req, reply) => {
    const charId = req.params.id;
    if (!charId) throw new Error("Missing character ID");

    const slug = (req.query as Record<string, string>)?.slug || "character";
    const pageUrl = `${JANNY_SITE_BASE}/characters/${charId}_${slug}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      let html = "";

      // Strategy 1: Direct fetch
      try {
        const directRes = await fetch(pageUrl, {
          headers: {
            "Accept": "text/html,application/xhtml+xml,*/*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Referer": "https://jannyai.com/",
          },
          signal: controller.signal,
          redirect: "follow",
        });
        if (directRes.ok) {
          html = await directRes.text();
          if (html.includes("Just a moment") || html.includes("cf-challenge") || !html.includes("astro-island")) {
            html = "";
          }
        }
      } catch { /* fall through */ }

      // Strategy 2: corsproxy.io
      if (!html) {
        try {
          const proxyRes = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(pageUrl)}`, {
            headers: {
              "Accept": "text/html,application/xhtml+xml,*/*",
              "Origin": "https://jannyai.com",
            },
            signal: controller.signal,
          });
          if (proxyRes.ok) {
            html = await proxyRes.text();
            if (html.includes("Just a moment") || html.includes("cf-challenge") || !html.includes("astro-island")) {
              html = "";
            }
          }
        } catch { /* fall through */ }
      }

      if (!html) {
        return reply.status(404).send({ error: "Could not fetch character page (Cloudflare blocked)" });
      }

      // Parse Astro island props containing character data
      let astroMatch = html.match(
        /astro-island[^>]*component-export="CharacterButtons"[^>]*props="([^"]+)"/
      );
      if (!astroMatch) {
        astroMatch = html.match(/astro-island[^>]*props="([^"]*character[^"]*)"/);
      }
      if (!astroMatch) {
        return reply.status(404).send({ error: "Could not parse character data from page" });
      }

      const propsDecoded = astroMatch[1]!
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'");

      const propsJson = JSON.parse(propsDecoded);

      function decodeAstroValue(value: unknown): unknown {
        if (!Array.isArray(value)) return value;
        const [type, data] = value;
        if (type === 0) {
          if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
            const decoded: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
              decoded[key] = decodeAstroValue(val);
            }
            return decoded;
          }
          return data;
        } else if (type === 1) {
          return (data as unknown[]).map((item: unknown) => decodeAstroValue(item));
        }
        return data;
      }

      const character = decodeAstroValue(propsJson.character) as Record<string, unknown> | null;

      if (!character) {
        return reply.status(404).send({ error: "No character data found in page" });
      }

      const creatorMatch = html.match(/Creator:\s*(?:<\/[^>]+>\s*)?<a[^>]*>@?([^<]+)<\/a>/);
      if (creatorMatch) {
        character.creatorUsername = creatorMatch[1]!.trim();
      }

      return {
        character,
        success: true,
      };
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return reply.status(504).send({ error: "Request timed out" });
      }
      return reply.status(500).send({ error: (err as Error).message });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.get<{ Params: { "*": string } }>("/janny/avatar/*", async (req, reply) => {
    const avatarPath = (req.params as Record<string, string>)["*"];
    if (!avatarPath) throw new Error("Missing avatar path");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${JANNY_IMAGE_BASE}${avatarPath}`, {
        signal: controller.signal,
      });
      if (!res.ok) return reply.status(404).send({ error: "Avatar not found" });
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") || "image/jpeg";
      return reply.header("Content-Type", ct).header("Cache-Control", "public, max-age=86400").send(buf);
    } finally {
      clearTimeout(timeout);
    }
  });
}
