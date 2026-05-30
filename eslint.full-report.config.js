import js from "@eslint/js";
import tseslint from "typescript-eslint";

import baseConfig from "./eslint.config.js";

const sourceFiles = ["src/**/*.{js,jsx,mjs,cjs,ts,tsx}"];
const tsSourceFiles = ["src/**/*.{ts,tsx}"];
const stagedTypeScriptRecommendedConfigs = tseslint.configs.recommended.slice(1).map((config) => ({
  ...config,
  name: `marinara/staged-${config.name}`,
  files: tsSourceFiles,
}));

export default [
  ...baseConfig,
  {
    name: "marinara/staged-js-recommended-report",
    files: sourceFiles,
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  ...stagedTypeScriptRecommendedConfigs,
  {
    name: "marinara/staged-react-hooks-report",
    files: tsSourceFiles,
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    name: "marinara/staged-typescript-pragmatic-relaxations",
    files: tsSourceFiles,
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "no-empty-pattern": "off",
      "no-undef": "off",
    },
  },
];
