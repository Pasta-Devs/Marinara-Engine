/* global process */
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// One classic bundle works inside an opaque-origin frame without relaxing CORS
// or granting the frame network access to load module chunks.
export async function buildMultiplayerGuest(outDir = resolve(packageRoot, "dist/multiplayer")) {
  await build({
    configFile: false,
    root: packageRoot,
    plugins: [react(), tailwindcss()],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      outDir,
      emptyOutDir: true,
      target: "es2020",
      cssTarget: "safari14",
      sourcemap: false,
      lib: {
        entry: resolve(packageRoot, "src/features/multiplayer/multiplayer-guest-entry.tsx"),
        name: "MarinaraMultiplayerGuest",
        formats: ["iife"],
        fileName: () => "guest.js",
        cssFileName: "guest",
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildMultiplayerGuest(process.argv[2]);
}
