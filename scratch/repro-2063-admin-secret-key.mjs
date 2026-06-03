import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const currentKey = "marinara-admin-secret";
const legacyKey = "marinara_admin_secret";

function makeStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    dump() {
      return Object.fromEntries(values.entries());
    },
  };
}

function makeThrowingStorage(entries = {}, throws = {}) {
  const storage = makeStorage(entries);
  return {
    ...storage,
    setItem(key, value) {
      if (throws.setItem) throw new Error("setItem blocked");
      storage.setItem(key, value);
    },
    removeItem(key) {
      if (throws.removeItem) throw new Error("removeItem blocked");
      storage.removeItem(key);
    },
  };
}

const helperExports = {};
const helperContext = { exports: helperExports };

function installStorage(entries) {
  const localStorage = makeStorage(entries);
  helperContext.window = { localStorage };
  return localStorage;
}

function installThrowingStorage(entries, throws) {
  const localStorage = makeThrowingStorage(entries, throws);
  helperContext.window = { localStorage };
  return localStorage;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const remoteSource = readFileSync("src/shared/api/remote-runtime.ts", "utf8");
const settingsSource = readFileSync("src/features/shell/settings/components/SettingsPanel.tsx", "utf8");

assert(remoteSource.includes(legacyKey), "remote-runtime should know the legacy Admin Access key");
assert(
  remoteSource.includes("readAdminSecretStorage()"),
  "remote-runtime privileged headers should read through the migration helper",
);
assert(settingsSource.includes("readAdminSecretStorage"), "Settings should initialize Admin Access from the helper");
assert(settingsSource.includes("writeAdminSecretStorage"), "Settings should save Admin Access through the helper");

const helperStart = remoteSource.indexOf("const ADMIN_SECRET_STORAGE_KEY");
const helperEnd = remoteSource.indexOf("function adminSecretHeader");
assert(helperStart >= 0 && helperEnd > helperStart, "storage helper source should be extractable");

const helperSource = `${remoteSource.slice(helperStart, helperEnd)}
exports.readAdminSecretStorage = readAdminSecretStorage;
exports.writeAdminSecretStorage = writeAdminSecretStorage;
`;
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(helperJs, helperContext);
const { readAdminSecretStorage, writeAdminSecretStorage } = helperExports;
assert(typeof readAdminSecretStorage === "function", "readAdminSecretStorage should execute");
assert(typeof writeAdminSecretStorage === "function", "writeAdminSecretStorage should execute");

let storage = installStorage({ [legacyKey]: "  legacy-secret  " });
assert(readAdminSecretStorage() === "legacy-secret", "legacy-only secret should be read and trimmed");
assert(storage.getItem(currentKey) === "legacy-secret", "legacy secret should migrate to the current key");
assert(storage.getItem(legacyKey) === null, "legacy key should be removed after migration");

storage = installStorage({ [currentKey]: " current-secret ", [legacyKey]: "legacy-secret" });
assert(readAdminSecretStorage() === "current-secret", "current key should take precedence when both keys exist");
assert(storage.getItem(currentKey) === " current-secret ", "read should not rewrite an existing current key");
assert(storage.getItem(legacyKey) === null, "read should clean stale legacy data when current exists");

storage = installThrowingStorage({ [currentKey]: "current-secret", [legacyKey]: "legacy-secret" }, { removeItem: true });
assert(readAdminSecretStorage() === "current-secret", "current read should survive failed legacy cleanup");

storage = installThrowingStorage({ [legacyKey]: "legacy-secret" }, { setItem: true });
assert(readAdminSecretStorage() === "legacy-secret", "legacy read should survive failed migration write");

storage = installStorage({ [legacyKey]: "legacy-secret" });
writeAdminSecretStorage(" saved-secret ");
assert(storage.getItem(currentKey) === "saved-secret", "save should trim and write the current key");
assert(storage.getItem(legacyKey) === null, "save should remove the legacy key");

storage = installStorage({ [currentKey]: "current-secret", [legacyKey]: "legacy-secret" });
writeAdminSecretStorage("   ");
assert(storage.getItem(currentKey) === null, "blank save should clear the current key");
assert(storage.getItem(legacyKey) === null, "blank save should clear the legacy key too");

delete helperContext.window;
assert(readAdminSecretStorage() === "", "server-side/no-window reads should be empty");

console.log("Admin Access legacy-key migration proof passed.");
