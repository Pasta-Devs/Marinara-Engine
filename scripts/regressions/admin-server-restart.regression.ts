import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adminRoutes = readFileSync(new URL("../../packages/server/src/routes/admin.routes.ts", import.meta.url), "utf8");
const settingsPanel = readFileSync(
  new URL("../../packages/client/src/components/panels/SettingsPanel.tsx", import.meta.url),
  "utf8",
);

assert.match(adminRoutes, /requirePrivilegedAccess\(req, reply, \{ feature: "Server restart" \}\)/u);
assert.match(adminRoutes, /req\.body\?\.confirm !== true/u);
assert.match(adminRoutes, /await app\.close\(\)/u);
assert.match(adminRoutes, /spawn\(process\.execPath, \[\.\.\.process\.execArgv, \.\.\.process\.argv\.slice\(1\)\]/u);
assert.match(settingsPanel, /api\.post<\{ status: "restarting" \}>\("\/admin\/restart", \{ confirm: true \}\)/u);
assert.match(settingsPanel, /controlId="restart-server"/u);

process.stdout.write("Admin server restart regression passed.\n");
