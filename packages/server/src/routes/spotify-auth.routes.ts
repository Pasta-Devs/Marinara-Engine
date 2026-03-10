// ──────────────────────────────────────────────
// Routes: Spotify OAuth (PKCE)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { createAgentsStorage } from "../services/storage/agents.storage.js";

// In-flight PKCE verifiers keyed by state param (short-lived, cleaned up on callback)
const pendingAuth = new Map<
  string,
  { codeVerifier: string; agentId: string; redirectUri: string; createdAt: number }
>();

const PORT = parseInt(process.env.PORT ?? "7860", 10);

function getRedirectUri(): string {
  return `http://127.0.0.1:${PORT}/api/spotify/callback`;
}

const SPOTIFY_SCOPES = [
  "user-modify-playback-state",
  "user-read-playback-state",
  "playlist-read-private",
  "user-library-read",
].join(" ");

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.randomBytes(length);
  return Array.from(values, (x) => possible[x % possible.length]).join("");
}

async function sha256Base64url(plain: string): Promise<string> {
  const hash = crypto.createHash("sha256").update(plain).digest();
  return hash.toString("base64url");
}

export async function spotifyAuthRoutes(app: FastifyInstance) {
  const storage = createAgentsStorage(app.db);

  // Clean up stale pending auth entries (older than 10 minutes)
  function cleanupPending() {
    const now = Date.now();
    for (const [key, entry] of pendingAuth) {
      if (now - entry.createdAt > 10 * 60_000) pendingAuth.delete(key);
    }
  }

  /**
   * GET /api/spotify/authorize?clientId=xxx&agentId=yyy
   * → Returns the Spotify authorization URL for the client to redirect to.
   */
  app.get<{ Querystring: { clientId: string; agentId: string } }>("/authorize", async (req, reply) => {
    const { clientId, agentId } = req.query;
    if (!clientId || !agentId) {
      return reply.status(400).send({ error: "clientId and agentId are required" });
    }

    cleanupPending();

    const codeVerifier = generateRandomString(64);
    const codeChallenge = await sha256Base64url(codeVerifier);
    const state = generateRandomString(32);

    const redirectUri = getRedirectUri();
    pendingAuth.set(state, { codeVerifier, agentId, redirectUri, createdAt: Date.now() });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: SPOTIFY_SCOPES,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
      state,
    });

    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    return { authUrl };
  });

  /**
   * GET /api/spotify/callback?code=xxx&state=yyy
   * Spotify redirects here after user authorizes. Exchanges code for tokens
   * and stores them in the agent settings.
   */
  app.get<{ Querystring: { code?: string; error?: string; state?: string } }>("/callback", async (req, reply) => {
    const { code, error, state } = req.query;

    if (error || !code || !state) {
      return reply.type("text/html").send(
        `<html><body style="font-family:system-ui;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2 style="color:#f44">Spotify Authorization Failed</h2>
            <p>${htmlEscape(error ?? "Missing authorization code")}</p>
            <p style="color:#888">You can close this window.</p>
          </div>
        </body></html>`,
      );
    }

    const pending = pendingAuth.get(state);
    if (!pending) {
      return reply.type("text/html").send(
        `<html><body style="font-family:system-ui;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2 style="color:#f44">Invalid State</h2>
            <p>Authorization session expired or was already used.</p>
            <p style="color:#888">Please try connecting again.</p>
          </div>
        </body></html>`,
      );
    }

    pendingAuth.delete(state);

    const { codeVerifier, agentId, redirectUri } = pending;

    // Retrieve the agent to get the clientId from settings
    const agent = await storage.getById(agentId);
    if (!agent) {
      return reply.type("text/html").send(
        `<html><body style="font-family:system-ui;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center"><h2 style="color:#f44">Agent not found</h2></div>
        </body></html>`,
      );
    }

    const settings =
      agent.settings && typeof agent.settings === "string" ? JSON.parse(agent.settings) : (agent.settings ?? {});
    const clientId = settings.spotifyClientId as string;
    if (!clientId) {
      return reply.type("text/html").send(
        `<html><body style="font-family:system-ui;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center"><h2 style="color:#f44">No Client ID configured</h2></div>
        </body></html>`,
      );
    }

    // Exchange code for tokens
    try {
      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        return reply.type("text/html").send(
          `<html><body style="font-family:system-ui;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
            <div style="text-align:center">
              <h2 style="color:#f44">Token Exchange Failed</h2>
              <p style="color:#888">${htmlEscape(String(tokenRes.status))}: ${htmlEscape(body.slice(0, 200))}</p>
              <p style="color:#888">You can close this window and try again.</p>
            </div>
          </body></html>`,
        );
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
        scope: string;
      };

      // Save tokens into agent settings
      await storage.update(agentId, {
        settings: {
          ...settings,
          spotifyAccessToken: tokens.access_token,
          spotifyRefreshToken: tokens.refresh_token,
          spotifyExpiresAt: Date.now() + tokens.expires_in * 1000,
          spotifyClientId: clientId,
        },
      });

      return reply.type("text/html").send(
        `<html><body style="font-family:system-ui;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2 style="color:#1DB954">✓ Spotify Connected!</h2>
            <p style="color:#888">You can close this window and return to the app.</p>
            <script>window.close()</script>
          </div>
        </body></html>`,
      );
    } catch (err) {
      return reply.type("text/html").send(
        `<html><body style="font-family:system-ui;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2 style="color:#f44">Connection Error</h2>
            <p style="color:#888">${htmlEscape(err instanceof Error ? err.message : "Unknown error")}</p>
          </div>
        </body></html>`,
      );
    }
  });

  /**
   * POST /api/spotify/refresh
   * Body: { agentId }
   * Refreshes the Spotify access token using the stored refresh token.
   */
  app.post<{ Body: { agentId: string } }>("/refresh", async (req, reply) => {
    const { agentId } = req.body ?? {};
    if (!agentId) return reply.status(400).send({ error: "agentId is required" });

    const agent = await storage.getById(agentId);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });

    const settings =
      agent.settings && typeof agent.settings === "string" ? JSON.parse(agent.settings) : (agent.settings ?? {});

    const refreshToken = settings.spotifyRefreshToken as string;
    const clientId = settings.spotifyClientId as string;
    if (!refreshToken || !clientId) {
      return reply.status(400).send({ error: "No Spotify refresh token or client ID configured" });
    }

    try {
      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: clientId,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        return reply.status(tokenRes.status).send({ error: `Spotify refresh failed: ${body.slice(0, 200)}` });
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      await storage.update(agentId, {
        settings: {
          ...settings,
          spotifyAccessToken: tokens.access_token,
          // Spotify may rotate refresh tokens
          spotifyRefreshToken: tokens.refresh_token ?? refreshToken,
          spotifyExpiresAt: Date.now() + tokens.expires_in * 1000,
        },
      });

      return { success: true };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : "Refresh failed" });
    }
  });

  /**
   * GET /api/spotify/status?agentId=xxx
   * Returns whether Spotify is connected (has valid tokens).
   */
  app.get<{ Querystring: { agentId: string } }>("/status", async (req, reply) => {
    const { agentId } = req.query;
    if (!agentId) return reply.status(400).send({ error: "agentId is required" });

    const agent = await storage.getById(agentId);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });

    const settings =
      agent.settings && typeof agent.settings === "string" ? JSON.parse(agent.settings) : (agent.settings ?? {});

    const hasToken = !!settings.spotifyAccessToken;
    const hasRefresh = !!settings.spotifyRefreshToken;
    const expiresAt = (settings.spotifyExpiresAt as number) ?? 0;
    const isExpired = expiresAt > 0 && Date.now() > expiresAt;

    return {
      connected: hasToken && hasRefresh,
      expired: isExpired,
      clientId: (settings.spotifyClientId as string) ?? null,
      redirectUri: getRedirectUri(),
    };
  });

  /**
   * POST /api/spotify/disconnect
   * Body: { agentId }
   * Removes Spotify tokens from agent settings.
   */
  app.post<{ Body: { agentId: string } }>("/disconnect", async (req, reply) => {
    const { agentId } = req.body ?? {};
    if (!agentId) return reply.status(400).send({ error: "agentId is required" });

    const agent = await storage.getById(agentId);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });

    const settings =
      agent.settings && typeof agent.settings === "string" ? JSON.parse(agent.settings) : (agent.settings ?? {});

    const { spotifyAccessToken, spotifyRefreshToken, spotifyExpiresAt, ...rest } = settings;
    await storage.update(agentId, { settings: rest });

    return { success: true };
  });
}
