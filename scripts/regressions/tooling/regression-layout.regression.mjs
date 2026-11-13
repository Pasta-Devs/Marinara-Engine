// scripts/check-regression-layout.mjs: new regressions go in an area folder and test behaviour, not source text.
// regression-layout: source-path its cases quote source paths as sample text; it reads no app source itself.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { checkRegressionLayout, readRegressionFiles, readsAppSource } from "../../check-regression-layout.mjs";

const R = "scripts/regressions/";
const none = { topLevel: [], readsSource: [] };
const file = (path, text = 'import assert from "node:assert/strict";\n') => ({ path: R + path, text });
const readsSource = `const text = readFileSync(new URL("../../packages/client/src/components/Thing.tsx", import.meta.url), "utf8");\n`;

test("the repository's own regressions pass", () => {
  const exceptions = JSON.parse(readFileSync(new URL("../layout-exceptions.json", import.meta.url), "utf8"));
  assert.deepEqual(checkRegressionLayout(readRegressionFiles(), exceptions), []);
});

test("a new file directly in scripts/regressions/ is refused, a listed one is not", () => {
  const [problem] = checkRegressionLayout([file("new-thing.regression.ts")], none);
  assert.match(problem, /new-thing\.regression\.ts: new regressions go in an area folder/u);
  assert.match(problem, /game-ruleset\/ {2}the ruleset format/u, "the message lists the areas");
  assert.deepEqual(
    checkRegressionLayout([file("old.regression.ts")], { ...none, topLevel: [`${R}old.regression.ts`] }),
    [],
  );
});

test("area folders, nested or not, are accepted; other folders are not", () => {
  assert.deepEqual(
    checkRegressionLayout(
      [
        file("chat/branches.regression.ts"),
        file("game-ruleset/combat/cover.regression.ts"),
        file("tooling/x.regression.mjs"),
      ],
      none,
    ),
    [],
  );
  for (const path of [
    "combat-cover/cover.regression.ts",
    "fixtures/helper.regression.ts",
    "Chat/branches.regression.ts",
    "unknown/nested/deeper.regression.ts",
  ]) {
    const problems = checkRegressionLayout([file(path)], none);
    assert.equal(problems.length, 1, path);
    assert.match(problems[0], /is not an area folder/u, path);
  }
});

test("reading app source as text is refused in a new file", () => {
  const [problem] = checkRegressionLayout([file("ui/thing.regression.ts", readsSource)], none);
  assert.match(problem, /reads the app's source code as text/u);
  for (const text of [
    `const s = readFileSync(join(repositoryRoot, "packages/server/src/routes/updates.routes.ts"), "utf8");`,
    `const s = readSource("packages/client/src/App.css");\nfunction readSource(p) { return readFileSync(p, "utf8"); }`,
    `const paths = [\n  "../../packages/shared/src/index.ts",\n];\nfor (const p of paths) readFileSync(p);`,
    'const read = (p) => readFileSync(new URL(`../../packages/client/src/${p}`, import.meta.url), "utf8");',
    `const root = join(repositoryRoot, "packages/client/src");\nconst s = readFileSync(join(root, "App.tsx"), "utf8");`,
    `const s = readFileSync(join(repositoryRoot, "packages", "server", "src", "index.ts"), "utf8");`,
  ]) {
    assert.equal(readsAppSource(text), true, text);
  }
});

test("imports, running code, data files and a stated reason are not source-text checks", () => {
  const readsLog = `\nconst log = readFileSync(logPath, "utf8");`;
  for (const text of [
    `import { thing } from "../../packages/shared/src/index.js";${readsLog}`,
    `import {\n  thing,\n} from "../../packages/server/src/services/x.service.ts";${readsLog}`,
    `const { x } = await import("../../packages/shared/src/schemas/connection.schema.ts");${readsLog}`,
    `const helperUrl = pathToFileURL(join(root, "packages/server/src/lib/shutdown-deadline.ts")).href;${readsLog}`,
    `const child = spawn(process.execPath, [tsx, join(root, "packages/server/src/index.ts")]);${readsLog}`,
    `const en = readFileSync(new URL("../../packages/client/src/locales/en.json", import.meta.url), "utf8");`,
    `const skill = readFileSync(join(root, "packages/server/src/assets/mari-skills/wiki.md"), "utf8");`,
    `const skills = readdirSync(join(root, "packages/server/src/assets/mari-skills/"));${readsLog}`,
    `// A built-in skill is a Markdown file under \`packages/server/src/assets/mari-skills/\`${readsLog}`,
    ` * the drawer in "packages/client/src/components/chat/ChatSettingsDrawer.tsx" moved${readsLog}`,
    `const helper = "../../packages/server/src/lib/shutdown-deadline.ts"; // never read: no readFile in this file`,
    `// regression-layout: source-path the packaged build must keep this banner\n${readsSource}`,
  ]) {
    assert.equal(readsAppSource(text), false, text);
  }
  assert.equal(readsAppSource(`// regression-layout: source-path\n${readsSource}`), true, "a reason is required");
});

test("the exceptions list never gains a file", () => {
  const moved = checkRegressionLayout([file("chat/moved.regression.ts")], {
    ...none,
    topLevel: [`${R}moved.regression.ts`],
  });
  assert.equal(moved.length, 1);
  assert.match(
    moved[0],
    /"scripts\/regressions\/moved\.regression\.ts" is no longer in scripts\/regressions\/; remove it/u,
  );

  const fixed = checkRegressionLayout([file("chat/fixed.regression.ts")], {
    ...none,
    readsSource: [`${R}chat/fixed.regression.ts`],
  });
  assert.equal(fixed.length, 1);
  assert.match(fixed[0], /no longer reads app source; remove it from "readsSource"/u);

  const gone = checkRegressionLayout([], { ...none, readsSource: [`${R}chat/gone.regression.ts`] });
  assert.equal(gone.length, 1);
  assert.match(gone[0], /no longer exists\. If it moved, change this "readsSource" entry to its new path/u);

  // A listed source reader that moves into an area folder: both errors name the fix, and updating the entry's path
  // (not adding one) settles it.
  const before = { topLevel: [`${R}reader.regression.ts`], readsSource: [`${R}reader.regression.ts`] };
  const movedReader = checkRegressionLayout([file("ui/reader.regression.ts", readsSource)], before);
  assert.equal(movedReader.length, 3);
  assert.match(movedReader[0], /If this file was moved from a path listed in "readsSource".*update that entry's path/u);
  const after = { topLevel: [], readsSource: [`${R}ui/reader.regression.ts`] };
  assert.deepEqual(checkRegressionLayout([file("ui/reader.regression.ts", readsSource)], after), []);
});
