import js from "@eslint/js";

import baseConfig from "./eslint.config.js";

export default [
  ...baseConfig,
  {
    name: "marinara/staged-js-recommended-report",
    files: ["src/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    rules: {
      ...js.configs.recommended.rules,
    },
  },
];
