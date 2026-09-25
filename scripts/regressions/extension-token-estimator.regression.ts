import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import {
  estimateTextTokens,
  getSerializedTextTokenEstimator,
} from "../../packages/shared/dist/utils/token-estimator.js";
import type {
  PersonalExtensionTokenApi,
  PersonalExtension,
} from "../../packages/shared/src/types/personal-extension.js";
import { browserWorkerSource } from "../../packages/server/src/routes/personal-extensions.routes.js";

const samples = [
  "",
  "hello, world hi this is test",
  "안녕하세요",
  "漢字",
  "ひらがな",
  "カタカナ",
  "😀",
  "hello 안녕 漢あ",
  " abc ",
];
const expected = samples.map(estimateTextTokens);
const typedApi: PersonalExtensionTokenApi = { estimateTextTokens };
assert.equal(typedApi.estimateTextTokens("안녕하세요"), 3);
const isolated = runInNewContext(
  getSerializedTextTokenEstimator(),
) as PersonalExtensionTokenApi["estimateTextTokens"];
assert.deepEqual(samples.map(isolated), expected, "serialized estimator must include all external dependencies");

// Execute the actual Full page access API factory without loading React or a GUI.
const injector = readFileSync(
  new URL("../../packages/client/src/components/layout/PersonalExtensionInjector.tsx", import.meta.url),
  "utf8",
);
const factory = injector.slice(
  injector.indexOf("function createFullPageExtensionApi("),
  injector.indexOf("\nasync function handleStorage("),
);
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const ts = require("typescript") as typeof import("../../packages/server/node_modules/typescript/lib/typescript.js");
const factoryJs = ts.transpileModule(factory, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const fullPageApi = runInNewContext(`${factoryJs}\ncreateFullPageExtensionApi(active)`, {
  estimateTextTokens,
  console,
  active: { extension: { id: "tokens", name: "Tokens", contentHash: "test" } },
}) as PersonalExtensionTokenApi & { version: number };
assert.equal(fullPageApi.version, 1);
assert.ok(Object.isFrozen(fullPageApi));
assert.equal(
  fullPageApi.estimateTextTokens,
  estimateTextTokens,
  "Full page access must use the shared function directly",
);
assert.deepEqual(samples.map(fullPageApi.estimateTextTokens), expected);

// Execute the real sandbox Worker source with the existing context handshake.
const messages: Array<{ type?: string; args?: unknown[] }> = [];
let dispatch: ((event: { data: unknown }) => void) | undefined;
const worker = browserWorkerSource({
  id: "tokens",
  name: "Tokens",
  contentHash: "test",
  capabilities: [],
  js: `marinara.log.info("token-counts", ${JSON.stringify(samples)}.map(text => marinara.estimateTextTokens(text)));`,
} as PersonalExtension);
runInNewContext(worker, {
  self: {
    postMessage: (message: (typeof messages)[number]) => messages.push(message),
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: () => undefined,
    addEventListener: (type: string, listener: typeof dispatch) => {
      if (type === "message") dispatch = listener;
    },
    close: () => undefined,
  },
});
assert.ok(dispatch);
dispatch({ data: { type: "context-update", context: { chatId: null, characterIds: [] } } });
await new Promise<void>((resolve) => setImmediate(resolve));
assert.ok(
  messages.some((message) => message.type === "ready"),
  "sandbox must finish initialization",
);
const counts = messages.find((message) => message.args?.[0] === "token-counts")?.args?.[1];
assert.deepEqual(
  JSON.parse(JSON.stringify(counts)),
  expected,
  "sandbox counts must match the Engine without extra capabilities",
);
