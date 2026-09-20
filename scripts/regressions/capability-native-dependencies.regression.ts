import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { linkCapabilityNativeDependencies } from "../../packages/server/src/services/capability-packages/capability-native-dependencies.service.js";

const root = await mkdtemp(join(tmpdir(), "marinara-native-dependencies-"));
const snapshots = join(root, "snapshots");
const packageRequire = createRequire(join(snapshots, "package-1", "server.mjs"));
const nativeName = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
const binaryName = process.platform === "win32" ? "claude.exe" : "claude";
const makeSdk = async (version: string) => {
  const scope = join(root, `.pnpm/sdk-${version}/node_modules/@anthropic-ai`);
  const sdk = join(scope, "claude-agent-sdk");
  const native = join(scope, nativeName.split("/")[1]!);
  await mkdir(sdk, { recursive: true });
  await mkdir(native, { recursive: true });
  await writeFile(join(sdk, "sdk.mjs"), "export {};\n");
  await writeFile(
    join(sdk, "package.json"),
    JSON.stringify({
      optionalDependencies: {
        [nativeName]: version,
        "@anthropic-ai/claude-agent-sdk-uninstalled-platform": version,
      },
    }),
  );
  await writeFile(join(native, "package.json"), JSON.stringify({ name: nativeName, version }));
  await writeFile(join(native, binaryName), version);
  return { sdk: join(sdk, "sdk.mjs"), native };
};
try {
  const first = await makeSdk("1");
  // Reproduce a bundled SDK: its require starts at server.mjs, outside its pnpm peer tree.
  assert.throws(() => packageRequire.resolve(`${nativeName}/${binaryName}`), { code: "MODULE_NOT_FOUND" });
  await linkCapabilityNativeDependencies(snapshots, first.sdk);
  assert.equal(
    await realpath(dirname(packageRequire.resolve(`${nativeName}/${binaryName}`))),
    await realpath(first.native),
  );
  await linkCapabilityNativeDependencies(snapshots, first.sdk);
  const second = await makeSdk("2");
  await linkCapabilityNativeDependencies(snapshots, second.sdk);
  const link = join(snapshots, "node_modules", nativeName);
  assert.equal(await realpath(link), await realpath(second.native), "an SDK update replaces the stale managed link");
  assert.equal(await readFile(join(link, binaryName), "utf8"), "2");

  // The real installed SDK's helper is visible even when a package's node_modules links to the server.
  const actualSnapshots = join(root, "installed");
  const packageRoot = join(actualSnapshots, "package-1");
  await mkdir(packageRoot, { recursive: true });
  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const sdkEntry = requireServer.resolve("@anthropic-ai/claude-agent-sdk");
  const sdkRequire = createRequire(sdkEntry);
  const manifest = JSON.parse(await readFile(join(dirname(sdkEntry), "package.json"), "utf8"));
  await symlink(
    new URL("../../packages/server/node_modules", import.meta.url),
    join(packageRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await linkCapabilityNativeDependencies(actualSnapshots, sdkEntry);
  const bundledRequire = createRequire(join(packageRoot, "server.mjs"));
  let installed = 0;
  for (const name of Object.keys(manifest.optionalDependencies)) {
    let expected: string;
    try {
      expected = sdkRequire.resolve(`${name}/package.json`);
    } catch {
      continue;
    }
    installed++;
    assert.equal(await realpath(bundledRequire.resolve(`${name}/package.json`)), await realpath(expected));
  }
  assert.ok(installed > 0, "the host must have its platform's optional SDK helper installed");
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("Capability native dependency regression passed.");
