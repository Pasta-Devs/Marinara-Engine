// Connections panel controls: the device page offers Load and Unload for the built-in model, and the first-run
// provider buttons share the panel width. Reads component source until a test can check these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const connectionsPanelSource = readFileSync(
  new URL("../../../packages/client/src/components/panels/ConnectionsPanel.tsx", import.meta.url),
  "utf8",
);
const deviceDetailSource = readFileSync(
  new URL("../../../packages/client/src/components/connections/DeviceDetail.tsx", import.meta.url),
  "utf8",
);
assert.match(deviceDetailSource, /connections\.device\.unloadModel/u);
assert.match(deviceDetailSource, /connections\.device\.loadModel/u);
assert.match(
  connectionsPanelSource,
  /className="grid grid-cols-\[repeat\(auto-fill,minmax\(8\.5rem,1fr\)\)\] gap-2"/u,
  "First-run provider actions must share the panel width in an adaptive grid",
);
assert.match(
  connectionsPanelSource,
  /FIRST_RUN_SERVICES\.map\([\s\S]*?data-add-connection-service=\{service\}[\s\S]*?className="[^"]*min-w-0[^"]*"/u,
  "First-run provider buttons must shrink within their grid cells",
);
