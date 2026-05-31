import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;
const vendorChunkGroups: Record<string, string[]> = {
  "vendor-react": ["react", "react-dom"],
  "vendor-runtime": ["@tanstack/react-query", "zustand", "zod", "clsx", "tailwind-merge"],
  "vendor-ui": ["framer-motion", "motion", "@dnd-kit", "dompurify", "sonner"],
  "vendor-tauri": [
    "@tauri-apps/api",
    "@tauri-apps/plugin-dialog",
    "@tauri-apps/plugin-notification",
    "@tauri-apps/plugin-opener",
  ],
};

function manualVendorChunk(id: string) {
  const normalizedId = id.replace(/\\/g, "/");
  if (!normalizedId.includes("/node_modules/")) return undefined;

  for (const [chunkName, packages] of Object.entries(vendorChunkGroups)) {
    if (packages.some((packageName) => normalizedId.includes(`/node_modules/${packageName}/`))) {
      return chunkName;
    }
  }

  return undefined;
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // The largest remaining JS chunk is lazy Game mode route code; keep
    // startup/vendor leakage visible while allowing that intentional split.
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: manualVendorChunk,
      },
    },
  },
}));
