import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = process.cwd();
const checks = [
  { workspace: ".", packageName: "esbuild" },
  { workspace: "packages/shared", packageName: "chess.js" },
  { workspace: "packages/server", packageName: "pino" },
  { workspace: "packages/client", packageName: "react" },
];

const missing = [];

for (const check of checks) {
  const requireFromWorkspace = createRequire(resolve(root, check.workspace, "package.json"));
  try {
    requireFromWorkspace.resolve(check.packageName);
  } catch {
    missing.push(`${check.packageName} from ${check.workspace}`);
  }
}

if (missing.length > 0) {
  console.error(`Incomplete Marinara dependency install. Missing: ${missing.join(", ")}`);
  process.exit(1);
}
