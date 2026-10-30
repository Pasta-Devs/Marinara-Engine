import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import path from "path";
import { delegateDirectAndroidBuild } from "./scripts/build-heap.mjs";

const ENABLE_SOURCE_MAPS = process.env.VITE_ENABLE_SOURCEMAP === "true";
const PWA_DISABLED = Boolean(process.env.SKIP_PWA);
const DEV_SERVER_PORT = Number.parseInt(process.env.VITE_PORT ?? "5173", 10);
const DEV_SERVER_HOST = process.env.VITE_HOST?.trim() || undefined;
const DEV_SERVER_OPEN = process.env.VITE_OPEN_BROWSER !== "false" && process.env.AUTO_OPEN_BROWSER !== "false";
const DEV_PROXY_DEFAULT_PORT = 7860;

/**
 * Resolves the API the dev proxy forwards to.
 *
 * `PORT` reaches Vite only when it is exported in the ambient environment, so a
 * plain `pnpm --filter @marinara-engine/client dev` — or a launcher that starts
 * the client without inheriting it — silently proxied to the 7860 default. That
 * pointed the client at whatever unrelated instance owned that port, and the
 * build-skew banner then fired forever, because the other instance reports a
 * different commit. This mirrors the server instead: an exported `PORT` wins
 * (dotenv never overrides it), otherwise the root `.env` decides, and the value
 * is parsed the way `getPort()` parses it. Read with `node:util` rather than a
 * repo script, because the container images do not copy `scripts/`.
 */
function resolveDevProxyPort() {
  let port = process.env.PORT;
  if (port === undefined) {
    try {
      port = parseEnv(readFileSync(path.resolve(import.meta.dirname, "../../.env"), "utf8")).PORT;
    } catch {
      // No readable root .env: the server falls back to its default as well.
    }
  }
  const parsed = Number.parseInt(port ?? "", 10);
  return Number.isFinite(parsed) ? parsed : DEV_PROXY_DEFAULT_PORT;
}

const DEV_PROXY_PORT = resolveDevProxyPort();
const BUILD_COMMIT_LENGTH = 12;

function normalizeBuildCommit(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, BUILD_COMMIT_LENGTH) : null;
}

function resolveBuildCommit() {
  const environmentCommit =
    normalizeBuildCommit(process.env.MARINARA_GIT_COMMIT) ??
    normalizeBuildCommit(process.env.GITHUB_SHA) ??
    normalizeBuildCommit(process.env.BUILD_COMMIT);
  if (environmentCommit) return environmentCommit;

  try {
    return normalizeBuildCommit(
      execFileSync("git", ["rev-parse", `--short=${BUILD_COMMIT_LENGTH}`, "HEAD"], {
        cwd: path.resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return null;
  }
}

const BUILD_COMMIT = resolveBuildCommit();

function manualChunks(id: string) {
  // Narrative dice add another result card shape; keep the shared dice UI out of GameSurface's budget.
  if (id.endsWith("/components/dice/AnimatedSkillCheckResult.tsx")) return "skill-check-result";
  if (id.endsWith("/components/game/game-narration-format.ts")) return "game-narration-format";
  if (id.endsWith("/components/game/GameNarrationVisuals.tsx")) return "game-narration-visuals";
  if (id.endsWith("/lib/game-tag-parser.ts")) return "game-tag-parser";
  // The inventory screen grows with every kind of item a ruleset can describe, so it is its own chunk
  // rather than weight on GameSurface's budget.
  if (id.endsWith("/components/game/GameInventory.tsx") || id.endsWith("/components/game/RulesetItemPicker.tsx"))
    return "game-inventory";
  // So does the character sheet, with every stat and resource a ruleset can show.
  if (id.endsWith("/components/game/GameCharacterSheet.tsx")) return "game-character-sheet";
  // So is the book the inventory reads a ruleset's items through, and the items the Game Master
  // invents, rather than weight on the game tag parser's chunk, which takes the rest of the shared code.
  if (/\/shared\/(?:dist|src)\/features\/rulesets\/(?:item-book|invented-items)\.(?:js|ts)$/u.test(id))
    return "ruleset-items";
  // The Experience file reader is its own chunk too, rather than weight on the game world's chunk.
  if (/\/shared\/(?:dist|src)\/features\/world\/experience-file\.(?:js|ts)$/u.test(id)) return "experience-file";
  // So is the world a game is set in (its kit, places, people, history and story), which grows with
  // every part of worldgen, rather than weight on the game tag parser's chunk.
  if (/\/shared\/(?:dist|src)\/features\/world\//u.test(id)) return "game-world";
  // So is the sheet a ruleset builds (its fields, derived values and the math behind them), which grows
  // with every part of a sheet a ruleset can describe.
  if (/\/shared\/(?:dist|src)\/features\/rulesets\/(?:sheet-builder|sheet-math)\.(?:js|ts)$/u.test(id))
    return "ruleset-sheet-rules";
  // The ruleset sheet grows with every part of a sheet a ruleset can describe, and the art the game draws
  // from board, icon and portrait packs is shared by several screens: each is its own chunk rather than
  // weight on GameSurface's budget.
  if (id.endsWith("/components/game/GameRulesetSheet.tsx")) return "game-ruleset-sheet";
  if (/\/lib\/(?:board-art|board-art-cells|art-pack)\.ts$/u.test(id) || id.endsWith("/components/game/ArtIcon.tsx"))
    return "game-art";
  // Rolldown otherwise coalesces the shared package's unassigned exports into
  // one chunk. Keep its top-level modules within the same per-chunk budget.
  const sharedModule = id.match(/\/shared\/(?:dist|src)\/([^/]+)\//u);
  if (sharedModule) return `shared-${sharedModule[1]}`;
  if (!id.includes("/node_modules/")) return undefined;
  // Ignore checkout names, but keep pnpm peer suffixes so React and its consumers stay together.
  // Removing those suffixes splits eager React imports across chunks and creates startup cycles.
  id = id.slice(id.search(/\/(?:\.pnpm|node_modules)\//u));

  // Avatar renderer libraries load only with an avatar renderer's lazy chunk (features/avatars), never in
  // vendor-misc, which the entry imports. Source entries keep classic and NodeMaterial renderers on one
  // core identity while allowing the modern renderer to split below the unchanged per-chunk budget.
  if (/\/node_modules\/three\/src\/nodes\//u.test(id)) return "vendor-three-nodes";
  if (/\/node_modules\/three\/src\/materials\/nodes\//u.test(id)) return "vendor-three-node-materials";
  if (/\/node_modules\/three\/src\/renderers\/webgpu\//u.test(id)) return "vendor-three-webgpu";
  if (/\/node_modules\/three\/src\/renderers\/webgl-fallback\//u.test(id)) return "vendor-three-webgl2";
  if (/\/node_modules\/three\/src\/renderers\/common\//u.test(id)) return "vendor-three-renderer";
  if (/\/node_modules\/three\/src\/(?:renderers|extras\/PMREMGenerator)/u.test(id)) return "vendor-three-webgl";
  if (/\/node_modules\/three\/src\//u.test(id)) return "vendor-three-core";
  if (/\/node_modules\/three\/build\/three\.core\./u.test(id)) return "vendor-three-core";
  if (/\/node_modules\/three\//u.test(id)) return "vendor-three";
  if (/\/node_modules\/@pixiv\//u.test(id)) return "vendor-three-vrm";
  if (/\/node_modules\/(?:@takahirox\/three-mmd|mmd-parser)\//u.test(id)) return "vendor-three-mmd";
  if (/\/node_modules\/(?:mesh-avatar|fflate)\//u.test(id)) return "vendor-mesh-avatar";

  // Keep dynamically selected Lucide glyphs in small alphabetical chunks
  // instead of pulling the complete icon catalog into one eager vendor file.
  const lucideIcon = id.match(/lucide-react\/dist\/esm\/icons\/([^/]+)\.m?js$/u);
  if (lucideIcon) return `vendor-icons-${lucideIcon[1]?.[0] ?? "misc"}`;
  if (id.includes("lucide-react")) return "vendor-icons";
  // Installed API-1 packages keep Motion 13, loaded only with the lazy host namespace.
  // Match before peer-dependency paths containing "react" merge both majors into an eager vendor chunk.
  if (
    /\/\.pnpm\/(?:framer-motion|motion-dom|motion-utils)@13[^/]*\/node_modules\//u.test(id) ||
    /\/node_modules\/framer-motion-v13\//u.test(id)
  )
    return "vendor-motion-legacy";
  if (/\/node_modules\/(?:framer-motion|motion-dom|motion-utils)\//u.test(id)) return "vendor-motion";
  // Installed API-1 packages retain Zod 3 only in the lazy host namespace.
  if (/\/\.pnpm\/zod@3[^/]*\/node_modules\//u.test(id) || /\/node_modules\/zod-v3\//u.test(id))
    return "vendor-validation-legacy";
  if (/\/node_modules\/zod\//u.test(id)) return "vendor-validation";
  if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
  if (id.includes("@tanstack")) return "vendor-tanstack";
  if (id.includes("zustand")) return "vendor-state";
  if (id.includes("dompurify") || id.includes("sonner")) return "vendor-ui";

  return "vendor-misc";
}

function bundleBudget(): Plugin {
  return {
    name: "bundle-budget",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle)
        .filter((item) => item.type === "chunk")
        .map((chunk) => ({
          fileName: chunk.fileName,
          sizeKb: Buffer.byteLength(chunk.code, "utf8") / 1024,
          isEntry: chunk.isEntry,
        }))
        .sort((a, b) => b.sizeKb - a.sizeKb);

      // Compatibility code must not become a startup cost through a shared vendor chunk.
      const pending = Object.values(bundle)
        .filter((item) => item.type === "chunk" && item.isEntry)
        .map((item) => item.fileName);
      const visited = new Set<string>();
      while (pending.length) {
        const name = pending.pop()!;
        if (visited.has(name)) continue;
        visited.add(name);
        const item = bundle[name];
        if (item?.type !== "chunk") continue;
        if (item.name === "vendor-motion-legacy")
          this.error("Legacy Motion 13 must load only with the dynamic package host");
        if (item.name === "vendor-validation-legacy")
          this.error("Legacy Zod 3 must load only with the dynamic package host");
        pending.push(...item.imports);
      }

      const lines = chunks.slice(0, 10).map((chunk) => {
        const label = chunk.isEntry ? "entry" : "chunk";
        return `  - ${chunk.fileName} (${label}, ${chunk.sizeKb.toFixed(2)} kB)`;
      });
      if (lines.length > 0) {
        console.log(["[bundle] Largest JS chunks:", ...lines].join("\n"));
      }

      const oversizedEntries = chunks.filter((chunk) => chunk.isEntry && chunk.sizeKb > 1000);
      if (oversizedEntries.length > 0) {
        this.error(
          `Main eager bundle exceeded 1000 kB: ${oversizedEntries
            .map((chunk) => `${chunk.fileName} (${chunk.sizeKb.toFixed(2)} kB)`)
            .join(", ")}`,
        );
      }

      // Keep lazy feature chunks below the 500 KiB bundle limit. Game narration's
      // reusable HTML formatter has its own boundary so GameSurface does not absorb it.
      const oversizedChunks = chunks.filter((chunk) => chunk.sizeKb > 500);
      if (oversizedChunks.length > 0) {
        this.error(
          `Chunk size warning budget exceeded: ${oversizedChunks
            .map((chunk) => `${chunk.fileName} (${chunk.sizeKb.toFixed(2)} kB)`)
            .join(", ")}`,
        );
      }
    },
  };
}

/** Hands a direct Android `vite build` that lacks heap to scripts/build.mjs (see build-heap.mjs). */
function androidBuildHeap(): Plugin {
  return { name: "android-build-heap", apply: "build", config: () => delegateDirectAndroidBuild() };
}

/** Stub for virtual:pwa-register when the real PWA plugin is skipped (e.g. Termux). */
function pwaStub(): Plugin {
  const id = "virtual:pwa-register";
  const resolved = "\0" + id;
  return {
    name: "pwa-stub",
    resolveId(source) {
      if (source === id) return resolved;
    },
    load(loadedId) {
      if (loadedId === resolved) return "export function registerSW() { return () => {}; }";
    },
  };
}

export default defineConfig({
  define: {
    __MARINARA_BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
  },
  plugins: [
    androidBuildHeap(),
    react(),
    tailwindcss(),
    bundleBudget(),
    !PWA_DISABLED
      ? VitePWA({
          injectRegister: false,
          registerType: "prompt",
          devOptions: { enabled: false },
          manifest: false, // We use the static manifest.json in public/
          workbox: {
            importScripts: ["notification-events.js"],
            // Intentionally exclude html so index.html is not precached and does not interfere with the PWA stale-version/update flow.
            globPatterns: ["**/*.{js,css,json,png,svg,ico,woff2}"],
            navigateFallback: null,
            // Keep the offline shell lean. Large decorative sprites and splash art are fetched on demand, and
            // avatar renderers and their libraries load only where an avatar agent is used (features/avatars).
            globIgnores: [
              "**/sprites/**",
              "logo.png",
              "logo-splash.gif",
              "**/{pngtuber,mesh-avatar,vrm}-renderer-*.js",
              "**/vendor-three*.js",
              "**/vendor-mesh-avatar*.js",
            ],
            navigateFallbackAllowlist: [],
            runtimeCaching: [
              {
                urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
                handler: "NetworkOnly",
              },
              // M16: a Mari pack downloads once, on first use, and works offline after that. Sprite URLs
              // carry MARI_SPRITE_VERSION (mari-work-animations.ts), so replaced art is a new cache key.
              {
                urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/sprites/mari/"),
                handler: "CacheFirst",
                options: {
                  cacheName: "mari-sprites",
                  // Every pack's sheets plus the old versions left after a sprite version bump.
                  expiration: { maxEntries: 200, maxAgeSeconds: 2_592_000 },
                },
              },
            ],
          },
        })
      : pwaStub(),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
      ...[
        ["three", "Three.js"],
        ["three/webgpu", "Three.WebGPU.js"],
        ["three/tsl", "Three.TSL.js"],
      ].map(([name, file]) => ({
        find: new RegExp(`^${name}$`, "u"),
        replacement: path.resolve(import.meta.dirname, `./node_modules/three/src/${file}`),
      })),
    ],
  },
  server: {
    host: DEV_SERVER_HOST,
    port: Number.isFinite(DEV_SERVER_PORT) ? DEV_SERVER_PORT : 5173,
    open: DEV_SERVER_OPEN,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${DEV_PROXY_PORT}`,
        changeOrigin: false,
        // LAN visitors choose their own Host, so mark them as proxied; local dev stays unmarked.
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const peer = req.socket.remoteAddress ?? "";
            if (!/^(127\.|::1$|::ffff:127\.)/.test(peer)) proxyReq.setHeader("x-forwarded-for", peer);
          });
        },
      },
    },
  },
  build: {
    outDir: "dist",
    manifest: true,
    target: "es2020",
    cssTarget: "safari14",
    // Vite reports decimal kB; 512 kB matches the bundle plugin's enforced 500 KiB ceiling.
    chunkSizeWarningLimit: 512,
    sourcemap: ENABLE_SOURCE_MAPS,
    rolldownOptions: {
      preserveEntrySignatures: false,
      treeshake: {
        // Strip debug console.log in production; keep warn/error and argument side effects.
        manualPureFunctions: process.env.NODE_ENV === "production" ? ["console.log"] : [],
      },
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          // Group only the selected modules, keeping each feature's dependencies
          // in their existing vendor/lazy boundaries instead of pulling them in.
          includeDependenciesRecursively: false,
          groups: [{ name: manualChunks, debugName: "Marinara chunk boundaries" }],
        },
      },
    },
  },
});
