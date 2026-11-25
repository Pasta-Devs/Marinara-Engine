// codeql.yml's init step: the CodeQL bundle stays pinned (#9793), the config keeps the default query suite so
// overlay analysis stays on, and paths-ignore never drops code that ships.
// regression-layout: source-path names shipped files only to check that paths-ignore spares them; it reads codeql.yml
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const workflow = readFileSync(repoFile(".github/workflows/codeql.yml"), "utf8").replace(/\r\n/gu, "\n");
const init = workflow.split("      - name: Initialize CodeQL\n")[1]?.split("\n      - name: ")[0] ?? "";

/** The lines of the init step's `config: |` block, without their YAML indentation. */
function configLines() {
  const lines = init.split("config: |\n")[1]?.split("\n") ?? [];
  const block: string[] = [];
  for (const line of lines) {
    if (line.trim() && !line.startsWith("            ")) break;
    if (line.trim()) block.push(line.slice(12));
  }
  return block;
}

/** Whether a CodeQL paths-ignore entry covers a repository path: a folder covers what is inside it. */
function ignores(pattern: string, path: string) {
  const escape = (text: string) => text.replace(/[.+?^${}()|[\]\\]/gu, "\\$&");
  const glob: Record<string, string> = { "**/": "(?:.*/)?", "**": ".*", "*": "[^/]*" };
  const source = pattern
    .replace(/\/+$/u, "")
    .split(/(\*\*\/|\*\*|\*)/u)
    .map((part) => glob[part] ?? escape(part))
    .join("");
  return new RegExp(`^${source}(?:/|$)`, "u").test(path);
}

/** A `  - ` list item as CodeQL reads it: without a trailing comment or surrounding quotes. */
function pathEntry(line: string) {
  const value = line
    .slice(4)
    .replace(/\s+#.*$/u, "")
    .trim();
  const entry = /^(["'])(.*)\1$/u.exec(value)?.[2] ?? value;
  // Anything but a plain path or glob (escapes, flow syntax, anchors) fails rather than being misread.
  assert.match(entry, /^[\w@./*-]+$/u, `paths-ignore entry ${value} must be a plain path this check can read`);
  return entry;
}

const config = configLines();
const listed = config.slice(config.indexOf("paths-ignore:") + 1);
const listEnd = listed.findIndex((line) => !line.startsWith("  - "));
const pathsIgnoreLines = listed.slice(0, listEnd === -1 ? undefined : listEnd);

// The app's three packages, the service worker the browser loads, and scripts the launchers, the Windows installer
// and the Docker image run on users' machines.
const SHIPPED = [
  "packages/server/src/index.ts",
  "packages/client/src/main.tsx",
  "packages/shared/src/index.ts",
  "packages/client/public/notification-events.js",
  "scripts/run-server.mjs",
  "scripts/pnpm-runner.mjs",
  "scripts/protect-launcher-data.mjs",
  "scripts/ensure-native-deps.mjs",
  "scripts/read-launcher-env.mjs",
  "scripts/docker-entrypoint.mjs",
];

const cases: RegressionCase[] = [
  {
    name: "the CodeQL bundle is pinned to one release, so GitHub moving its default CLI cannot change the scan",
    run: () => {
      const tools = /^ {10}tools: (\S+)$/mu.exec(init)?.[1];
      assert.match(
        tools ?? "",
        /^https:\/\/github\.com\/github\/codeql-action\/releases\/download\/codeql-bundle-v\d+\.\d+\.\d+\/codeql-bundle-linux64\.tar\.zst$/u,
      );
    },
  },
  {
    name: "the config only ignores paths, so the default query suite and overlay analysis stay on",
    run: () => {
      const keys = config
        .filter((line) => !line.startsWith(" ") && !line.startsWith("#"))
        .map((line) => line.split(":")[0]);
      assert.deepEqual(keys, ["paths-ignore"]);
    },
  },
  {
    name: "paths-ignore skips the test suites and nothing that ships",
    run: () => {
      const pathsIgnore = pathsIgnoreLines.map(pathEntry);
      assert.ok(pathsIgnore.length > 0, "the config lists paths to ignore");
      for (const path of ["scripts/regressions/chat/example.regression.ts", "e2e/core-flows.e2e.ts"]) {
        assert.ok(
          pathsIgnore.some((pattern) => ignores(pattern, path)),
          `${path} is test code and stays out of the scan`,
        );
      }
      for (const path of SHIPPED) {
        assert.ok(existsSync(repoFile(path)), `${path} exists, so this list still names shipped code`);
        const pattern = pathsIgnore.find((entry) => ignores(entry, path));
        assert.equal(pattern, undefined, `paths-ignore entry "${pattern}" would drop shipped ${path}`);
      }
    },
  },
];

await runNamedCases(cases);
