// codeql.yml's init step: the CodeQL bundle stays pinned (#9793), the scan keeps the default query suite so
// overlay analysis stays on, and paths-ignore skips only the test suites.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

const workflow = readFileSync(new URL("../../../.github/workflows/codeql.yml", import.meta.url), "utf8").replace(
  /\r\n/gu,
  "\n",
);
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

/** A `  - ` list item as CodeQL reads it: without a trailing comment or surrounding quotes. */
function pathEntry(line: string) {
  const value = line
    .slice(4)
    .replace(/\s+#.*$/u, "")
    .trim();
  return /^(["'])(.*)\1$/u.exec(value)?.[2] ?? value;
}

const config = configLines();
const listed = config.slice(config.indexOf("paths-ignore:") + 1);
const listEnd = listed.findIndex((line) => !line.startsWith("  - "));
const pathsIgnoreLines = listed.slice(0, listEnd === -1 ? undefined : listEnd);

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
    name: "the scan only ignores paths, so the default query suite and overlay analysis stay on",
    run: () => {
      // The action merges these inputs into the config, and any queries or packs turn overlay analysis off.
      assert.doesNotMatch(init, /^ {10}(?:queries|packs|config-file):/mu);
      const keys = config
        .filter((line) => !line.startsWith(" ") && !line.startsWith("#"))
        .map((line) => line.split(":")[0]);
      assert.deepEqual(keys, ["paths-ignore"]);
    },
  },
  {
    name: "paths-ignore skips the test suites and nothing else",
    run: () => {
      // Nothing under these two folders ships. Any other entry needs its own review that it drops no shipped code.
      assert.deepEqual(pathsIgnoreLines.map(pathEntry), ["scripts/regressions", "e2e"]);
    },
  },
];

await runNamedCases(cases);
