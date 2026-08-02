// ──────────────────────────────────────────────
// Regression: Documentation language packs (DATA_DIR/doc-packs overlays)
//
// Pins the invariants the Documentation Language feature depends on:
//  - the overlay resolver serves an installed pack's file when present, falls
//    back to English per-file, and contains each candidate against ITS OWN
//    root (pack dir vs docs/) while refusing path traversal in both,
//  - pack manifests are validated with archive-grade path safety (zip-slip
//    equivalents, Windows drive/ADS colons, case-folded duplicates, size caps),
//  - installed-pack consistency and hash verification detect truncation,
//  - build-manifest.mjs output is deterministic and passes manifest validation,
//  - doc content is never rendered through dangerouslySetInnerHTML (downloaded
//    packs are less-trusted than in-repo English).
// ──────────────────────────────────────────────
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// DATA_DIR must point at the fixture BEFORE runtime-config snapshots the env,
// so every module under test is imported dynamically after this line.
const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-docs-pack-regression-"));
process.env.DATA_DIR = fixtureRoot;

const { normalizeDocsLanguage, DEFAULT_DOCS_LANGUAGE, DOCS_LANGUAGE_LABELS } = await import(
  "../../packages/shared/src/constants/docs-languages.ts"
);
const { resolvePhysical, supportedDocLanguages } = await import("../../packages/server/src/routes/docs.routes.ts");
const {
  checkDocsPackConsistency,
  docsPackManifestsMatch,
  docsPackRoot,
  validateDocsPackManifest,
  validateDocsPackPath,
  verifyDocsPackHashes,
} = await import("../../packages/server/src/services/docs/docs-pack.service.ts");

const repoRoot = join(fileURLToPath(import.meta.url), "..", "..", "..");

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

try {
  // ── Shared normalizer contract ──
  assert.equal(normalizeDocsLanguage("es"), "es");
  assert.equal(normalizeDocsLanguage(" ES "), "es");
  assert.equal(normalizeDocsLanguage("pt-BR"), "pt-br");
  assert.equal(normalizeDocsLanguage("../es"), null);
  assert.equal(normalizeDocsLanguage("es/.."), null);
  assert.equal(normalizeDocsLanguage(""), null);
  assert.equal(normalizeDocsLanguage(42), null);
  assert.equal(DEFAULT_DOCS_LANGUAGE, "en");

  // ── Supported language list is static and English-first ──
  const supported = supportedDocLanguages();
  assert.equal(supported[0], "en");
  assert.ok(supported.includes("es"), "the shared label map must offer Spanish");
  assert.ok(supported.includes("de"), "the shared label map must offer German");
  assert.ok(supported.includes("fr"), "the shared label map must offer French");
  assert.ok(supported.includes("pt-br"), "the shared label map must offer Brazilian Portuguese");
  assert.ok(supported.includes("pl"), "the shared label map must offer Polish");
  assert.ok(supported.includes("ru"), "the shared label map must offer Russian");
  assert.ok(supported.includes("ja"), "the shared label map must offer Japanese");
  assert.ok(supported.includes("ko"), "the shared label map must offer Korean");
  assert.ok(supported.includes("zh-hans"), "the shared label map must offer Simplified Chinese");
  assert.ok(supported.includes("hi"), "the shared label map must offer Hindi");
  assert.deepEqual([...supported].sort(), Object.keys(DOCS_LANGUAGE_LABELS).sort());

  // ── Build a valid installed fixture pack under DATA_DIR/doc-packs/es ──
  const packDir = docsPackRoot("es");
  const faqContent = "# Preguntas frecuentes\n\nContenido de prueba.\n";
  const welcomeContent = "# Bienvenida\n\nHola.\n";
  mkdirSync(join(packDir, "home"), { recursive: true });
  writeFileSync(join(packDir, "FAQ.md"), faqContent);
  writeFileSync(join(packDir, "home", "welcome.md"), welcomeContent);
  const fixtureManifest = {
    language: "es",
    files: [
      { path: "FAQ.md", sha256: sha256(faqContent), bytes: Buffer.byteLength(faqContent) },
      { path: "home/welcome.md", sha256: sha256(welcomeContent), bytes: Buffer.byteLength(welcomeContent) },
    ],
  };
  writeFileSync(join(packDir, "manifest.json"), JSON.stringify(fixtureManifest, null, 2));

  // ── Overlay resolution: pack hit, English fallback, per-root containment ──
  const translated = resolvePhysical("es", ["FAQ.md"]);
  assert.equal(translated.language, "es", "FAQ.md must resolve to the installed pack");
  assert.ok(translated.file.split(sep).join("/").endsWith("doc-packs/es/FAQ.md"));
  assert.equal(relative(packDir, translated.root), "", "overlay containment root must be the pack dir");

  const fallback = resolvePhysical("es", ["development", "frontend.md"]);
  assert.equal(fallback.language, "en", "docs missing from the pack must fall back to English per-file");
  assert.ok(fallback.file.split(sep).join("/").endsWith("docs/development/frontend.md"));

  const english = resolvePhysical("en", ["FAQ.md"]);
  assert.equal(english.language, "en");
  assert.ok(english.file.split(sep).join("/").endsWith("docs/FAQ.md"));

  // Traversal attempts must throw for both the pack root and the docs root.
  assert.throws(() => resolvePhysical("es", ["..", "other-pack", "FAQ.md"]));
  assert.throws(() => resolvePhysical("en", ["..", "package.json"]));
  assert.throws(() => resolvePhysical("es", ["..", "..", "storage", "tables", "app_settings.json"]));

  // A supported-but-uninstalled language serves English without throwing.
  const uninstalled = resolvePhysical("pt-br" in DOCS_LANGUAGE_LABELS ? "pt-br" : "es", ["FAQ.md"]);
  assert.ok(uninstalled.language === "en" || uninstalled.language === "es");

  // ── Manifest validation: archive-grade path safety ──
  const goodFile = { path: "FAQ.md", sha256: sha256("x"), bytes: 1 };
  assert.equal(validateDocsPackManifest({ language: "es", files: [goodFile] }, "es").files.length, 1);
  const badPaths = [
    "../escape.md",
    "/absolute.md",
    "a\\b.md",
    "c:evil.md",
    "dir/../up.md",
    "./dot.md",
    "no-extension",
    "script.txt",
    "a/b/c/d/e/f/g.md",
    "nul\0byte.md",
  ];
  for (const path of badPaths) {
    assert.throws(() => validateDocsPackPath(path), `path must be rejected: ${JSON.stringify(path)}`);
  }
  // Case-folded duplicates would overwrite each other on Windows/macOS.
  assert.throws(() =>
    validateDocsPackManifest(
      { language: "es", files: [goodFile, { path: "faq.md", sha256: sha256("y"), bytes: 1 }] },
      "es",
    ),
  );
  assert.throws(() => validateDocsPackManifest({ language: "fr", files: [goodFile] }, "es"));
  assert.throws(() =>
    validateDocsPackManifest({ language: "es", files: [{ path: "FAQ.md", sha256: "nothex", bytes: 1 }] }, "es"),
  );
  assert.throws(() =>
    validateDocsPackManifest(
      { language: "es", files: [{ path: "FAQ.md", sha256: sha256("x"), bytes: 100 * 1024 * 1024 }] },
      "es",
    ),
  );

  // ── Manifest comparison drives the after-update refresh decision ──
  const manifestA = { language: "es", files: [{ path: "FAQ.md", sha256: sha256("a"), bytes: 1 }] };
  assert.equal(docsPackManifestsMatch(manifestA, { ...manifestA }), true);
  assert.equal(
    docsPackManifestsMatch(manifestA, { language: "es", files: [{ path: "FAQ.md", sha256: sha256("b"), bytes: 1 }] }),
    false,
    "a changed hash must trigger a refresh",
  );
  assert.equal(
    docsPackManifestsMatch(manifestA, { language: "es", files: [...manifestA.files, { path: "new.md", sha256: sha256("c"), bytes: 1 }] }),
    false,
    "an added file must trigger a refresh",
  );

  // ── Consistency + hash verification detect truncation ──
  assert.deepEqual(await checkDocsPackConsistency("es"), { installed: true, complete: true });
  assert.equal(await verifyDocsPackHashes("es"), true);
  writeFileSync(join(packDir, "FAQ.md"), "# Truncated\n");
  assert.equal((await checkDocsPackConsistency("es")).complete, false, "size drift must be caught cheaply");
  assert.equal(await verifyDocsPackHashes("es"), false, "hash drift must be caught by full verification");
  writeFileSync(join(packDir, "FAQ.md"), faqContent);

  // ── build-manifest.mjs is deterministic and its output validates ──
  const buildFixture = join(fixtureRoot, "build-fixture", "es");
  mkdirSync(join(buildFixture, "home"), { recursive: true });
  writeFileSync(join(buildFixture, "FAQ.md"), faqContent);
  writeFileSync(join(buildFixture, "home", "welcome.md"), welcomeContent);
  const builder = join(repoRoot, "scripts", "docs-i18n", "build-manifest.mjs");
  execFileSync(process.execPath, [builder, buildFixture, "--source-commit", "deadbeef"], { stdio: "pipe" });
  const first = readFileSync(join(buildFixture, "manifest.json"), "utf8");
  execFileSync(process.execPath, [builder, buildFixture, "--source-commit", "deadbeef"], { stdio: "pipe" });
  const second = readFileSync(join(buildFixture, "manifest.json"), "utf8");
  assert.equal(first, second, "build-manifest.mjs must be deterministic");
  const built = validateDocsPackManifest(JSON.parse(first), "es");
  assert.equal(built.files.length, 2);
  assert.deepEqual(
    built.files.map((file) => file.path),
    ["FAQ.md", "home/welcome.md"],
    "manifest file list must be sorted",
  );

  // ── Downloaded markdown must never reach dangerouslySetInnerHTML ──
  const viewerSource = readFileSync(
    join(repoRoot, "packages", "client", "src", "components", "modals", "DocsViewerModal.tsx"),
    "utf8",
  );
  assert.ok(
    !viewerSource.includes("dangerouslySetInnerHTML"),
    "DocsViewerModal must keep using the React-node markdown renderer — downloaded packs are less-trusted than in-repo docs",
  );

  console.log(`docs-language regression passed: languages ${supported.join(", ")}; fixture pack at ${packDir}`);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
