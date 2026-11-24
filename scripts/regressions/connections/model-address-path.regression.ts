import assert from "node:assert/strict";

// A Model's own address may be only a path ("/proxy/zai"), read against its Connection's server, so a proxy with
// one path per model family needs no full address per Model and the paths survive a tunnel's new name. Neither
// form may reach another server, since the Model sends the Connection's key.
const { resolveModelAddress, isModelAddressPath, modelAddressPathOf } =
  await import("../../../packages/shared/src/utils/model-address.js");

const base = "https://img-ala.trycloudflare.com/proxy/google-ai";
assert.equal(resolveModelAddress("/proxy/zai", base), "https://img-ala.trycloudflare.com/proxy/zai");
assert.equal(resolveModelAddress("proxy/zai", base), "https://img-ala.trycloudflare.com/proxy/zai");
assert.equal(
  resolveModelAddress(" /proxy/moonshot-ai/v1 ", base),
  "https://img-ala.trycloudflare.com/proxy/moonshot-ai/v1",
);
assert.equal(
  resolveModelAddress("https://img-ala.trycloudflare.com/proxy/xai", base),
  "https://img-ala.trycloudflare.com/proxy/xai",
);
assert.equal(resolveModelAddress("", base), null);
assert.equal(resolveModelAddress("/proxy/zai", ""), null);

// Nothing may point the key at another host.
for (const sneaky of [
  "//evil.example/proxy",
  "///evil.example",
  "\\\\evil.example/x",
  "/\\evil.example",
  "user@evil.example/x",
  "@evil.example",
  "https://evil.example/proxy/zai",
  "javascript:alert(1)",
  "evil.example:443/x",
  "/proxy zai",
  "/proxy/zai?x=@evil.example",
  "/proxy#x",
]) {
  const resolved = resolveModelAddress(sneaky, base);
  assert.ok(resolved === null || new URL(resolved).origin === new URL(base).origin, sneaky);
}
assert.equal(resolveModelAddress("//evil.example/proxy", base), null);
assert.equal(resolveModelAddress("user@evil.example/x", base), null);

assert.equal(isModelAddressPath("/proxy/zai"), true);
assert.equal(isModelAddressPath("https://x.example/proxy"), false);
assert.equal(modelAddressPathOf("https://old.trycloudflare.com/proxy/zai/"), "/proxy/zai");
assert.equal(modelAddressPathOf("https://old.trycloudflare.com/"), null);

console.log("model-address-path regression passed");
