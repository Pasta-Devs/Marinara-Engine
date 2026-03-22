// ──────────────────────────────────────────────
// Server Entry Point
// ──────────────────────────────────────────────
import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildApp } from "./app.js";

// Load .env from monorepo root (handles `cd packages/server && node dist/index.js`)
const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(__dirname, "../../..");
const envPath = resolve(monorepoRoot, ".env");
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Fallback: try CWD (for standalone usage)
  dotenv.config();
}

const PORT = parseInt(process.env.PORT ?? "7860", 10);
const HOST = process.env.HOST ?? "127.0.0.1";

function loadTlsOptions() {
  const cert = process.env.SSL_CERT;
  const key = process.env.SSL_KEY;
  if (!cert || !key) return null;
  try {
    // Resolve relative paths against the monorepo root (not CWD)
    const certPath = resolve(monorepoRoot, cert);
    const keyPath = resolve(monorepoRoot, key);
    return {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    };
  } catch (err) {
    throw new Error(
      `Failed to load TLS certificate/key files.\n` +
        `  SSL_CERT=${cert}\n` +
        `  SSL_KEY=${key}\n` +
        `  ${err instanceof Error ? err.message : String(err)}\n` +
        `Please ensure the paths are correct and the files are readable.`,
    );
  }
}

async function main() {
  const tls = loadTlsOptions();
  const app = await buildApp(tls ?? undefined);
  const protocol = tls ? "https" : "http";

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Marinara Engine server listening on ${protocol}://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[ERROR] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
