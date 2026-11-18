// Which shared-package build the dev launcher runs: the one that keeps the existing build output when
// DEV_PRESERVE_SHARED_DIST is set. Also the dev scripts: dev:server builds shared first, and the server's watcher
// ignores shared's build output so a rebuild doesn't restart it in a loop.
import assert from "node:assert/strict";
import { resolveDevSharedBuildScript } from "../../dev-shared-build.mjs";
import { readFileSync } from "node:fs";

assert.equal(resolveDevSharedBuildScript({ DEV_PRESERVE_SHARED_DIST: "true" }), "build:preserve");
assert.equal(resolveDevSharedBuildScript({}), "build");

const serverPackageJson = JSON.parse(
  readFileSync(new URL("../../../packages/server/package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };
const rootPackageJson = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as {
  scripts?: Record<string, string>;
};
assert.match(serverPackageJson.scripts?.dev ?? "", /--ignore \.\.\/shared\/dist/u);
assert.match(
  rootPackageJson.scripts?.["dev:server"] ?? "",
  /^node \.\/scripts\/pnpm-runner\.mjs build:shared && node \.\/scripts\/pnpm-runner\.mjs --filter @marinara-engine\/server dev$/u,
  "The server-only development command must establish shared build output first",
);
