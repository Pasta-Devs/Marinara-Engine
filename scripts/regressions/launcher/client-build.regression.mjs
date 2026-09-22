import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkClientBuild } from "../../check-client-build.mjs";

const root = mkdtempSync(join(tmpdir(), "marinara-client-build-"));
const write = (file, content) => writeFileSync(join(root, file), content);
try {
  mkdirSync(join(root, "assets"));
  mkdirSync(join(root, ".vite"));
  assert.throws(() => checkClientBuild(root));
  write("index.html", '<script type="module" src="/assets/index-a.js"></script>');
  assert.throws(() => checkClientBuild(root), /manifest/);
  const manifest = {
    "index.html": {
      file: "assets/index-a.js",
      isEntry: true,
      imports: ["icons"],
      dynamicImports: ["lazy"],
      css: ["assets/style-a.css"],
    },
    icons: { file: "assets/icons-a.js" },
    lazy: { file: "assets/lazy-a.js", assets: ["assets/font-a.woff2"] },
  };
  const saveManifest = (value = manifest) => write(".vite/manifest.json", JSON.stringify(value));
  saveManifest();
  for (const file of [
    "assets/index-a.js",
    "assets/icons-a.js",
    "assets/lazy-a.js",
    "assets/style-a.css",
    "assets/font-a.woff2",
  ]) {
    write(file, "fixture");
  }
  assert.doesNotThrow(() => checkClientBuild(root));
  for (const file of ["assets/icons-a.js", "assets/lazy-a.js", "assets/style-a.css", "assets/font-a.woff2"]) {
    rmSync(join(root, file));
    assert.throws(() => checkClientBuild(root), /ENOENT/);
    write(file, "");
    assert.throws(() => checkClientBuild(root), /empty/);
    write(file, "fixture");
  }
  write("index.html", '<script src="/assets/old-entry.js"></script>');
  assert.throws(() => checkClientBuild(root), /disagree/);
  write("index.html", '<script src="/assets/index-a.js"></script>');
  saveManifest({ ...manifest, lazy: { file: "../outside.js" } });
  assert.throws(() => checkClientBuild(root), /escapes/);
  saveManifest({ ...manifest, lazy: { file: "assets/lazy-a.js", imports: ["missing"] } });
  assert.throws(() => checkClientBuild(root), /Missing client chunk/);
  saveManifest();
  assert.doesNotThrow(() => checkClientBuild(root));
  console.info("Client build completeness regression passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
