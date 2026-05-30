import boundaries from "eslint-plugin-boundaries";
import importX from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    ignores: [
      "dist/**",
      "packages/*/dist/**",
      "node_modules/**",
      "src-tauri/**",
      "docs/**",
      "public/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      boundaries,
      "import-x": importX,
      "react-hooks": reactHooks,
    },
    settings: {
      "import-x/resolver-next": [
        {
          name: "eslint-import-resolver-typescript",
          options: {
            project: "tsconfig.json",
          },
        },
      ],
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        { type: "features", pattern: "src/features/*/**" },
        { type: "engine", pattern: "src/engine/**" },
        { type: "shared", pattern: "src/shared/**" },
      ],
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/components/*", "@/features/*/hooks/*", "@/features/*/stores/*"],
              message: "Import feature code through an explicit public API instead of private internals.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "../features/*", "../../features/*", "../../../features/*"],
              message: "Shared code is a lower layer and must not import feature implementations.",
            },
            {
              group: ["@/app/*", "../app/*", "../../app/*", "../../../app/*"],
              message: "Shared code must not import app composition code.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/engine/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "Engine code must stay UI-framework independent." },
            { name: "react-dom", message: "Engine code must stay UI-framework independent." },
            { name: "zustand", message: "Engine code must not depend on UI stores." },
            { name: "@tauri-apps/api", message: "Engine code must use capability ports, not Tauri directly." },
          ],
          patterns: [
            {
              group: ["@tauri-apps/api/*", "@/shared/api/*", "../../shared/api/*", "../../../shared/api/*"],
              message: "Engine code must use capability ports, not concrete shared API adapters.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/engine/modes/chat/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/engine/modes/roleplay/*", "@/engine/modes/game/*", "../roleplay/*", "../game/*"],
              message: "Chat mode must not import roleplay or game internals.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/engine/modes/roleplay/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/engine/modes/chat/*", "@/engine/modes/game/*", "../chat/*", "../game/*"],
              message: "Roleplay mode must not import chat or game internals.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/engine/modes/game/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/engine/modes/chat/*", "@/engine/modes/roleplay/*", "../chat/*", "../roleplay/*"],
              message: "Game mode must not import chat or roleplay internals.",
            },
          ],
        },
      ],
    },
  }
);
