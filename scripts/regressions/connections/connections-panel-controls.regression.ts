// Connections panel controls: the device page offers Load and Unload for the built-in model, and the first-run
// provider buttons share the panel width. Also the connection editor's save order and provider checks, and the
// test-image route's request. Reads component and route source until a test can check these.
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

// #4114-#4119: the connection editor saves its defaults before the connection, keeps LoRA choices and the Z.AI model current, checks SwarmUI workflows before saving, and saves NovelAI image defaults from their latest value.
{
  const connectionEditorSource = readFileSync(
    new URL("../../../packages/client/src/components/connections/ConnectionEditor.tsx", import.meta.url),
    "utf8",
  );
  const saveDefaultsIndex = connectionEditorSource.indexOf("await saveConnectionDefaults.mutateAsync");
  const saveConnectionIndex = connectionEditorSource.indexOf("await updateConnection.mutateAsync", saveDefaultsIndex);
  assert.ok(
    saveDefaultsIndex >= 0 && saveConnectionIndex > saveDefaultsIndex,
    "Connection defaults must finish saving before the connection snapshot is persisted",
  );
  assert.match(
    connectionEditorSource,
    /remoteLoras = useMemo\(\(\) => modelList\.data\?\.loras \?\? \[\], \[modelList\.data\]\)/u,
    "Remote LoRA choices must come from the current model list, so a provider change cannot leave stale ones",
  );
  assert.match(
    connectionEditorSource,
    /src\.id === "zai"[\s\S]{0,180}!ZAI_IMAGE_MODELS\.some[\s\S]{0,180}setLocalModel\("glm-image"\)/u,
    "Switching to Z.AI must replace a model that Z.AI does not support",
  );
  assert.match(
    connectionEditorSource,
    /const swarmUiWorkflowError =\s*\(selectedImageService === "swarmui" \|\| selectedVideoProvider === "swarmui"\)[\s\S]{0,180}%reference_image_name/u,
    "SwarmUI workflow validation must reject backend-local reference-image filenames before save",
  );
  assert.match(connectionEditorSource, /if \(swarmUiWorkflowError\) \{[\s\S]{0,180}throw new Error/u);
  assert.match(
    connectionEditorSource,
    /type="button"[\s\S]{0,180}novelAiStylePlateInputRef\.current\?\.click\(\)[\s\S]{0,1000}type="file"/u,
    "NovelAI style-plate selection must use an explicit non-submitting button instead of label navigation",
  );
  assert.match(
    connectionEditorSource,
    /localImageDefaultsRef\.current = sanitized;[\s\S]{0,100}setLocalImageDefaults\(sanitized\)/u,
    "NovelAI defaults must update a synchronous save snapshot before React paints the next render",
  );
  assert.match(
    connectionEditorSource,
    /selectedImageDefaultsService && localImageDefaultsRef\.current[\s\S]{0,140}sanitizeImageGenerationProfile\(localImageDefaultsRef\.current/u,
    "Connection save must persist the latest image defaults snapshot",
  );
}

// #4237-#4240: a connection's image test asks for a 1024 by 1024 picture and passes on debug mode, and SwarmUI control requests have a time limit.
{
  const connectionsRouteSource = readFileSync(
    new URL("../../../packages/server/src/routes/connections.routes.ts", import.meta.url),
    "utf8",
  );
  const testImageHandler = connectionsRouteSource.match(
    /app\.post<\{ Params: \{ id: string \} \}>\("\/:id\/test-image"[\s\S]*?\/\/ ── Test video generation/u,
  )?.[0];
  assert.ok(testImageHandler, "The connection test-image handler must remain available");
  assert.match(testImageHandler, /width: 1024,\s*height: 1024,/u);
  assert.match(testImageHandler, /debugMode: readDebugMode\(req\.body\)/u);
  assert.match(
    connectionsRouteSource,
    /signal: AbortSignal\.timeout\(SWARMUI_CONTROL_REQUEST_TIMEOUT_MS\)/u,
    "SwarmUI control requests must have a bounded timeout",
  );
}
