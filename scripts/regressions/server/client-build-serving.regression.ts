// The server serves the client only when its build is there, and the API alone when it is missing. Reads server
// source because the client build path is fixed relative to the module.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serverAppSource = readFileSync(new URL("../../../packages/server/src/app.ts", import.meta.url), "utf8");
assert.match(serverAppSource, /const clientIndex = resolve\(clientDist, "index\.html"\)/u);
assert.match(serverAppSource, /if \(existsSync\(clientIndex\)\)/u);
