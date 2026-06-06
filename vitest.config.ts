import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.{spec,test}.{ts,tsx}", "tests/unit/**/*.{spec,test}.{ts,tsx}"],
  },
});
