// Pins the client host namespace agent packages use, globalThis.__MARINARA_HOST__ (Pasta-Devs/Marinara-Engine#7858):
// its members, the store fields packages read, the library majors packages are built against, the Engine-owned
// browser storage, and the package-author docs that describe them. e2e/marinara-host-namespace.e2e.ts proves the live
// namespace in a browser. Compiled by tsc -p scripts/regressions/tsconfig.client-lanes.json, so the type checks below
// fail `pnpm check` as well.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MARINARA_HOST_ENGINE_INDEXED_DB,
  MARINARA_HOST_ENGINE_STORAGE_KEYS,
  MARINARA_HOST_MODULE_MAJORS,
  MARINARA_HOST_MODULE_IMPORTS,
  MARINARA_HOST_MODULE_SPECIFIERS,
  MARINARA_HOST_STORE_FIELDS,
  MARINARA_HOST_STORE_NAMES,
  MARINARA_HOST_VERSION,
  type MarinaraHostModuleSpecifier,
  type MarinaraHostStoreFields,
  type MarinaraHostV1,
} from "../../packages/client/src/lib/marinara-host-contract.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

// ── The documented lists ──
const MEMBERS = [
  "version",
  "capabilityApi",
  "stores",
  "services",
  "modules",
  "queryClient",
  "components",
  "data",
  "api",
] as const;
const STORE_NAMES = ["ui", "chat", "agent", "sidecar", "dialog", "gallery", "encounter", "gameState", "backfill"];
const MODULE_SPECIFIERS = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "@tanstack/react-query",
  "zustand",
  "zustand/middleware",
  "sonner",
  "zod",
  "i18next",
  "react-i18next",
  "framer-motion",
  "motion/react",
  "tailwind-merge",
  "clsx",
];
const ENGINE_STORAGE_KEYS = [
  "marinara-engine-ui",
  "marinara-engine-ui:host",
  "marinara-active-chat-id",
  "marinara-input-drafts",
  "marinara-pending-spatial-transitions",
  "marinara-pinned-gallery-images",
  "marinara_sidecar_prompted",
];

assert.equal(MARINARA_HOST_VERSION, 1, "`version` changes only when the namespace's shape breaks");
assert.deepEqual([...MARINARA_HOST_STORE_NAMES], STORE_NAMES);
assert.deepEqual([...MARINARA_HOST_MODULE_SPECIFIERS], MODULE_SPECIFIERS);
assert.deepEqual(Object.keys(MARINARA_HOST_STORE_FIELDS), STORE_NAMES, "every store lists the fields packages read");
assert.deepEqual([...MARINARA_HOST_ENGINE_STORAGE_KEYS], ENGINE_STORAGE_KEYS);
assert.equal(MARINARA_HOST_ENGINE_INDEXED_DB, "marinara-tts-audio-cache");

// ── The type the Engine exports matches the lists (compile-time) ──
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const typesMatch: [
  Equal<keyof MarinaraHostV1, (typeof MEMBERS)[number]>,
  Equal<keyof MarinaraHostV1["stores"], (typeof MARINARA_HOST_STORE_NAMES)[number]>,
  Equal<keyof MarinaraHostV1["modules"], MarinaraHostModuleSpecifier>,
  Equal<keyof MarinaraHostV1["services"], "tts" | "dialogs" | "audio" | "imageDownloads">,
  Equal<keyof MarinaraHostV1["components"], "Modal">,
  Equal<keyof MarinaraHostV1["data"], "emojiCatalog">,
  Equal<keyof MarinaraHostStoreFields, (typeof MARINARA_HOST_STORE_NAMES)[number]>,
] = [true, true, true, true, true, true, true];
assert.ok(typesMatch.every(Boolean));
const imageDownloadTypesMatch: Equal<
  keyof MarinaraHostV1["services"]["imageDownloads"],
  "downloadUrlToDevice" | "prepareImageSave" | "savePreparedImageToDevice" | "shouldUseIosImageShare"
> = true;
assert.ok(imageDownloadTypesMatch);
// Each Pick<> in MarinaraHostStoreFields fails this compile when a store drops a field packages read.
const pinnedFields: { [K in keyof MarinaraHostStoreFields]: Array<keyof MarinaraHostStoreFields[K]> } = {
  ui: [...MARINARA_HOST_STORE_FIELDS.ui],
  chat: [...MARINARA_HOST_STORE_FIELDS.chat],
  agent: [...MARINARA_HOST_STORE_FIELDS.agent],
  sidecar: [...MARINARA_HOST_STORE_FIELDS.sidecar],
  dialog: [...MARINARA_HOST_STORE_FIELDS.dialog],
  gallery: [...MARINARA_HOST_STORE_FIELDS.gallery],
  encounter: [...MARINARA_HOST_STORE_FIELDS.encounter],
  gameState: [...MARINARA_HOST_STORE_FIELDS.gameState],
  backfill: [...MARINARA_HOST_STORE_FIELDS.backfill],
};
for (const [store, fields] of Object.entries(pinnedFields)) {
  assert.equal(new Set(fields).size, fields.length, `${store} lists each field once`);
}

// ── A host library major change needs a capability API major ──
const MAJOR_CHANGE =
  "A host module major change requires a capability API major bump (docs/development/optional-agent-packages.md#host-client-namespace)";
const clientPackage = JSON.parse(readSource("packages/client/package.json")) as {
  dependencies: Record<string, string>;
};
const packageOf = (specifier: string) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!;
assert.deepEqual(
  [...new Set(MODULE_SPECIFIERS.map(packageOf))].sort(),
  Object.keys(MARINARA_HOST_MODULE_MAJORS).sort(),
  "every host module's package has a pinned major",
);
assert.equal(
  MARINARA_HOST_MODULE_MAJORS["framer-motion"],
  13,
  "installed API-1 packages keep the complete Motion 13 contract",
);
assert.equal(MARINARA_HOST_MODULE_MAJORS.motion, 14, "the opt-in slot has its own major");
assert.equal(MARINARA_HOST_MODULE_IMPORTS["framer-motion"], "framer-motion-v13");
assert.equal(MARINARA_HOST_MODULE_IMPORTS["motion/react"], "framer-motion");
assert.equal(MARINARA_HOST_MODULE_MAJORS.zod, 3, "installed API-1 packages retain their Zod 3 contract");
assert.equal(MARINARA_HOST_MODULE_IMPORTS.zod, "zod-v3");
assert.match(clientPackage.dependencies.zod!, /^\^4\./u, "the Engine's primary validator stays native Zod 4");
assert.deepEqual(Object.keys(MARINARA_HOST_MODULE_IMPORTS), MODULE_SPECIFIERS);
for (const [name, major] of Object.entries(MARINARA_HOST_MODULE_MAJORS)) {
  const specifier = MODULE_SPECIFIERS.find((entry) => packageOf(entry) === name)! as MarinaraHostModuleSpecifier;
  const dependency = packageOf(MARINARA_HOST_MODULE_IMPORTS[specifier]);
  const range = clientPackage.dependencies[dependency];
  assert.ok(range, `${name} is a direct dependency of packages/client, so the Engine's build resolves it`);
  assert.equal(Number(/\d+/u.exec(range.split("@").at(-1)!)?.[0]), major, `${name} ${range}: ${MAJOR_CHANGE}`);
  const installed = JSON.parse(readSource(`packages/client/node_modules/${dependency}/package.json`)) as {
    version: string;
  };
  assert.equal(Number(installed.version.split(".")[0]), major, `${name}@${installed.version}: ${MAJOR_CHANGE}`);
}

// ── The contract module stays a pure module (types and constant lists only) ──
const contractSource = readSource("packages/client/src/lib/marinara-host-contract.ts");
const contractImports = [...contractSource.matchAll(/^import\s.*$/gmu)].map((match) => match[0]);
assert.ok(contractImports.length > 0);
assert.deepEqual(
  contractImports.filter((line) => !line.startsWith("import type ")),
  [],
  "marinara-host-contract.ts imports types only, so package tooling can read it without the Engine's runtime",
);

// ── The namespace is complete before any package client is evaluated, with the app's one QueryClient ──
const loaderSource = readSource("packages/client/src/hooks/use-capability-packages.ts");
assert.match(
  loaderSource,
  /import\("\.\.\/lib\/marinara-host"\)\s*\.then\(\(\{ ensureMarinaraHost \}\) => ensureMarinaraHost\(\)\)\s*\.then\(\(\) => import\(\/\* @vite-ignore \*\/ source\)\)/u,
  "the package loader awaits the host namespace before it imports a package client",
);
const mainSource = readSource("packages/client/src/main.tsx");
assert.match(mainSource, /import \{ queryClient \} from "\.\/lib\/query-client";/u);
assert.match(mainSource, /<QueryClientProvider client=\{queryClient\}>/u);
// Installed classic-JSX bundles (games 1.0.0-1.0.2, Calls 1.0.0-1.0.1) still read these globals.
assert.match(mainSource, /Object\.assign\(globalThis, \{ React, ReactDOM \}\);/u);
const hostSource = readSource("packages/client/src/lib/marinara-host.ts");
assert.match(hostSource, /import \{ queryClient \} from "\.\/query-client";/u);
assert.match(hostSource, /import \* as framerMotion from "framer-motion-v13";/u);
assert.match(hostSource, /import \* as motion14 from "framer-motion";/u);
assert.match(hostSource, /import \* as zod from "zod-v3";/u);
assert.match(hostSource, /"framer-motion": framerMotion/u);
assert.match(hostSource, /"motion\/react": motion14/u);
assert.match(hostSource, /writable: false,\s*configurable: false,/u);
const queryClientConstructions = readSource("packages/client/src/lib/query-client.ts").match(/new QueryClient\(/gu);
assert.equal(queryClientConstructions?.length, 1, "lib/query-client.ts makes the QueryClient the app renders with");
assert.doesNotMatch(mainSource, /new QueryClient\(/u, "main.tsx renders with lib/query-client.ts's QueryClient");

// ── The package-author docs describe exactly this contract ──
const docs = readSource("docs/development/optional-agent-packages.md");
const sectionStart = docs.indexOf("\n### Host client namespace\n");
assert.ok(sectionStart >= 0, "the docs keep the #host-client-namespace section the D4 message links to");
const sectionEnd = docs.indexOf("\n### ", sectionStart + 1);
const section = docs.slice(sectionStart, sectionEnd < 0 ? undefined : sectionEnd);
assert.doesNotMatch(docs, /__MARINARA_HOST_UI_STORE__/u, "the namespace has no alias");
const documented = (name: string) => section.includes(`\`${name}\``);
const undocumented = [
  ...MEMBERS,
  ...STORE_NAMES,
  ...MODULE_SPECIFIERS,
  ...ENGINE_STORAGE_KEYS,
  MARINARA_HOST_ENGINE_INDEXED_DB,
  ...Object.values(MARINARA_HOST_STORE_FIELDS).flat(),
].filter((name) => !documented(name));
assert.deepEqual(undocumented, [], "every member, store, field, module and Engine key is in the docs");
for (const [name, major] of Object.entries(MARINARA_HOST_MODULE_MAJORS)) {
  assert.ok(section.includes(`\`${name}\` ${major}`), `the docs give ${name}'s major as ${major}`);
}
assert.match(section, /capability API \*\*major\*\*/u, "the docs say a host module major needs a capability API major");

console.log("marinara-host-namespace regression passed");
