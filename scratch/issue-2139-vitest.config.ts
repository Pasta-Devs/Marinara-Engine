import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["scratch/issue-2139-map-position-repro.ts"],
  },
});
