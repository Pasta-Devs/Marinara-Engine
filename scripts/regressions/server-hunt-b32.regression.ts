import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.LOG_LEVEL = "silent";

// 1. Extension storage patches must be serialized across storage wrapper
//    instances (the sandbox runtime builds one per message, the routes their own).
{
  const { createPersonalExtensionSettingsStorage } = await import(
    "../../packages/server/src/services/extensions/personal-extension-settings.service.ts"
  );
  const backing = new Map<string, string>();
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));
  const fakeAppSettings = {
    async get(key: string) {
      await tick();
      return backing.get(key) ?? null;
    },
    async set(key: string, value: string) {
      await tick();
      backing.set(key, value);
    },
    async remove(key: string) {
      await tick();
      backing.delete(key);
    },
  };
  // Two independent wrappers over the same store, as runtime and routes do.
  const a = createPersonalExtensionSettingsStorage(fakeAppSettings as never);
  const b = createPersonalExtensionSettingsStorage(fakeAppSettings as never);
  await Promise.all([a.patch("ext-1", { a: 1 }), b.patch("ext-1", { b: 2 }), a.patch("ext-1", { c: 3 })]);
  assert.deepEqual(await a.get("ext-1"), { a: 1, b: 2, c: 3 }, "concurrent patches must not lose keys");

  // A failed patch must not block later writes.
  const failing = createPersonalExtensionSettingsStorage({
    ...fakeAppSettings,
    async set() {
      throw new Error("boom");
    },
  } as never);
  await assert.rejects(failing.patch("ext-2", { x: 1 }));
  await b.patch("ext-2", { y: 2 });
  assert.deepEqual(await b.get("ext-2"), { y: 2 });
}

// 2. Sandbox startup: `startup` must be marked handled before the first await
//    after it is created, and the start message must be sent inside the try so
//    a failed send tears the sandbox down.
{
  const runtime = readFileSync(
    new URL("../../packages/server/src/services/extensions/personal-server-extension-runtime.ts", import.meta.url),
    "utf8",
  );
  const created = runtime.indexOf("const startup = new Promise<void>");
  assert.ok(created > 0, "startup promise not found");
  const handled = runtime.indexOf("startup.catch(() => undefined);", created);
  const tryIndex = runtime.indexOf("try {", handled);
  const sendStart = runtime.indexOf('type: "start"', created);
  const race = runtime.indexOf("await Promise.race([startup, timeout]);", created);
  assert.ok(handled > created, "startup must get a rejection handler");
  const firstAwaitAfterStartup = runtime.indexOf("await ", runtime.indexOf("});\n", runtime.indexOf("child.once(\"close\", handleClose);", created)));
  assert.ok(handled < firstAwaitAfterStartup, "startup handler must be attached before the first await");
  assert.ok(tryIndex < sendStart && sendStart < race, "start message must be sent inside the try block");
}

console.log("server-hunt-b32 regression passed");
