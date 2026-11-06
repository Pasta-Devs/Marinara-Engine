/** Strict starting gear (Capability API 1.109): the sheet limits legal-only choices, never free edit. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build as bundle } from "esbuild";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  resolveRulesetStartingGear,
  rulesetBuilderRemaining,
  rulesetBuilderStartingGearOptions,
  rulesetItemBook,
  type RulesetBuilderStep,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-strict-starting-gear-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const root = fileURLToPath(new URL("../../", import.meta.url));
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const doc = JSON.parse(readFileSync(join(root, "docs/examples/rulesets/ember-roads.json"), "utf8"));
  doc.sheet.fields.push(
    { id: "wizard_level", label: "Wizard level", type: "number", default: 0, min: 0, max: 20 },
    { id: "fighter_level", label: "Fighter level", type: "number", default: 0, min: 0, max: 20 },
  );
  doc.items.startingGear = [
    {
      id: "fighter",
      label: "Fighter kit",
      fits: { value: { field: "fighter_level" }, atLeast: 1 },
      lines: [{ name: "Sword" }],
    },
    {
      id: "wizard",
      label: "Wizard kit",
      fits: { value: { field: "wizard_level" }, atLeast: 1 },
      lines: [{ name: "Spellbook" }],
    },
    { id: "acolyte", label: "Acolyte kit", lines: [{ name: "Holy symbol" }] },
  ];
  doc.sheet.builder = {
    steps: [
      { id: "gear", label: "Gear", kind: "startingGear", strict: true },
      { id: "levels", label: "Class levels", kind: "fields", fields: ["wizard_level", "fighter_level"] },
    ],
  };
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;
  const step = definition.sheet.builder!.steps[0] as Extract<RulesetBuilderStep, { kind: "startingGear" }>;
  assert.equal(step.strict, true, "the schema preserves strict");
  for (const strict of [false, "true", 1]) {
    const bad = structuredClone(doc);
    bad.sheet.builder.steps[0].strict = strict;
    assert.equal(parseRulesetDefinition(bad).ok, false, "strict is only true or absent");
  }
  const blank = defaultRulesetSheetBuild(definition);
  const wizard = { ...blank, fields: { ...blank.fields, wizard_level: 1 } };
  const fighter = { ...blank, fields: { ...blank.fields, fighter_level: 1 } };
  const ids = (freeEdit = false, current = step, sheet = wizard) =>
    rulesetBuilderStartingGearOptions(definition, current, sheet, freeEdit).map((gear) => gear.id);
  assert.deepEqual(ids(), ["wizard", "acolyte"]);
  assert.deepEqual(ids(true), ["fighter", "wizard", "acolyte"]);
  assert.deepEqual(ids(false, { ...step, strict: undefined }), ids(true));
  assert.deepEqual(ids(true, { ...step, strict: undefined }), ids(true));
  assert.deepEqual(ids(false, step, fighter), ["fighter", "acolyte"]);
  assert.deepEqual(
    rulesetBuilderStartingGearOptions(definition, step, undefined).map((gear) => gear.id),
    ["acolyte"],
  );
  assert.deepEqual(ids(false, step, { ...wizard, fields: { ...wizard.fields, wizard_level: 0 } }), ["acolyte"]);

  const book = rulesetItemBook(definition, {});
  const selection = { gear: "fighter", choices: [], picks: {} };
  const refused = resolveRulesetStartingGear(definition, book, selection, undefined, { step, build: wizard });
  assert.deepEqual(refused, {
    ok: false,
    reason: "does-not-fit",
    detail: 'Starting gear "Fighter kit" does not fit this sheet',
  });
  assert.equal(
    resolveRulesetStartingGear(definition, book, selection, undefined, { step, build: wizard, freeEdit: true }).ok,
    true,
  );
  assert.equal(
    resolveRulesetStartingGear(definition, book, selection, undefined, {
      step: { ...step, strict: undefined },
      build: wizard,
    }).ok,
    true,
  );
  assert.equal(
    resolveRulesetStartingGear(definition, book, selection).ok,
    true,
    "old inventory requests keep their behavior",
  );
  assert.equal(
    resolveRulesetStartingGear(definition, book, { ...selection, gear: "acolyte" }, undefined, { step, build: wizard })
      .ok,
    true,
  );
  assert.equal(
    resolveRulesetStartingGear(definition, book, { ...selection, gear: "wizard" }, undefined, { step, build: wizard })
      .ok,
    true,
  );

  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    id: "ember",
    name: "Ember",
    version: "1.0.0",
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gateMessage =
    "A ruleset whose builder holds starting gear to the sheet requires schemaVersion 2 and capabilityApi 1.109 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(108) as never, doc), gateMessage);
  assert.equal(getCapabilityPackageInstallIssue(manifest(109) as never, doc), null);
  const legacy = structuredClone(doc);
  delete legacy.sheet.builder.steps[0].strict;
  assert.equal(getCapabilityPackageInstallIssue(manifest(108) as never, legacy), null);
  const editorSchema = JSON.parse(readFileSync(join(root, "docs/extending/ruleset.schema.json"), "utf8"));
  const findGearStep = (node: any): any => {
    if (!node || typeof node !== "object") return undefined;
    if (node.properties?.kind?.const === "startingGear") return node;
    return Object.values(node).map(findGearStep).find(Boolean);
  };
  const gearSchema = findGearStep(editorSchema);
  assert.equal(gearSchema.properties.strict.const, true);
  assert.ok(!gearSchema.required.includes("strict"));

  // Execute the actual components with a small hook host. The host replaces browser-only dependencies,
  // not the shared gear logic, so event handlers, clearing, empty copy and navigation all run here.
  const stubs: Record<string, string> = {
    "@marinara-engine/shared": `export * from ${JSON.stringify(join(root, "packages/shared/src/index.ts"))};
      import { resolveRulesetStartingGear as resolve } from ${JSON.stringify(join(root, "packages/shared/src/index.ts"))};
      export const resolveRulesetStartingGear = (...args) => {
        globalThis.__gearContext = args[4]; return resolve(...args);
      };`,
    react: `export const useState = (initial) => globalThis.__gearHooks.useState(initial);
      export const useMemo = (fn) => fn(); export const useCallback = (fn) => fn;
      export const useRef = (current) => ({ current }); export const useId = () => 'gear-test'; export const useEffect = () => {};
      export const createContext = (value) => ({ value }); export const useContext = (context) => context.value;`,
    "react/jsx-runtime": `export const Fragment = 'fragment'; export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;`,
    "react-i18next": `export const useTranslation = () => ({ t: (key) => key });`,
    "@tanstack/react-query": `export const useQueries = ({combine}) => combine([]);`,
    "lucide-react": `export const Check = 'check', ChevronLeft = 'left', ChevronRight = 'right', Dices = 'dice', Minus = 'minus', Plus = 'plus', Trash2 = 'trash';`,
    "../ui/Modal": `export const Modal = 'modal';`,
    "./RulesetItemPicker": `export const rulesetItemStatsLine = () => '';`,
    "../../hooks/use-capability-packages": `export const rulesetCatalogQuery = () => ({});`,
    "../../lib/api-client": `export const api = {};`,
    "../../lib/ruleset-catalog": `export const visibleCatalogEntries = (_d, _l, _c, entries) => entries;`,
    "../../lib/ruleset-resolution": `export const rulesetCheckValueText = (_d, value) => String(value);`,
    "../ui/DraftNumberInput": `export const DraftNumberInput = 'number';`,
    "./RulesetTypedInput": `export const TypedInput = 'input', inputClass = '', labelClass = ''; export const rulesetPickCount = () => undefined; export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));`,
  };
  const built = await bundle({
    stdin: {
      contents: `export { StartingGearPicker } from './packages/client/src/components/game/StartingGearPicker';
      export { RulesetSheetBuilder } from './packages/client/src/components/rulesets/RulesetSheetBuilder';`,
      resolveDir: root,
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    plugins: [
      {
        name: "gear-ui-host",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) =>
            args.path in stubs ? { path: args.path, namespace: "stub" } : undefined,
          );
          build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
            contents: stubs[args.path]!,
            resolveDir: root,
            loader: "js",
          }));
        },
      },
    ],
  });
  const uiPath = join(dataDir, "gear-ui.mjs");
  writeFileSync(uiPath, built.outputFiles[0]!.text);
  const ui = await import(pathToFileURL(uiPath).href);
  const nodes = (node: any): any[] =>
    !node || typeof node !== "object"
      ? []
      : Array.isArray(node)
        ? node.flatMap(nodes)
        : [node, ...nodes(node.props?.children)];
  const text = (tree: any) => JSON.stringify(tree);
  const host = (component: (props: any) => any, props: any) => {
    const values: any[] = [];
    let cursor = 0;
    let changed = false;
    return {
      props,
      render() {
        (globalThis as any).__gearHooks = {
          useState(initial: any) {
            const index = cursor++;
            if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
            return [
              values[index],
              (next: any) => {
                values[index] = typeof next === "function" ? next(values[index]) : next;
                changed = true;
              },
            ];
          },
        };
        for (let pass = 0; pass < 10; pass++) {
          cursor = 0;
          changed = false;
          const tree = component(this.props);
          if (!changed) return tree;
        }
        throw new Error("Component did not settle");
      },
    };
  };
  const radioLabels = (tree: any) =>
    nodes(tree).filter(
      (node) =>
        node.type === "label" &&
        nodes(node).some((child) => child.type === "input" && child.props.name === "starting-gear"),
    );
  const radio = (tree: any, label: string) =>
    nodes(radioLabels(tree).find((node) => text(node).includes(label))).find((node) => node.type === "input");
  const toggle = (tree: any) => nodes(tree).find((node) => node.type === "input" && node.props.type === "checkbox");
  const picker = host(ui.StartingGearPicker, {
    open: true,
    onClose() {},
    definition,
    book,
    bags: [{ name: "Ada" }],
    stacks: [],
    sheets: { player: wizard },
    taken: {},
    onTake: async () => true,
  });
  let tree = picker.render();
  assert.equal(radioLabels(tree).length, 2);
  assert.ok(!text(tree).includes("Fighter kit"));
  assert.ok(!text(tree).includes("game.ruleset.startingGear.other"));
  radio(tree, "Wizard kit").props.onChange();
  assert.equal(radio(picker.render(), "Wizard kit").props.checked, true);
  assert.deepEqual((globalThis as any).__gearContext, { step, build: wizard, freeEdit: false });
  picker.props.sheets = { player: fighter };
  tree = picker.render();
  assert.ok(text(tree).includes("ui.rulesets.builder.pickCleared"));
  assert.equal(
    radioLabels(tree).some((label) => nodes(label).some((node) => node.props?.checked)),
    false,
  );
  picker.props.sheets = { player: wizard };
  assert.equal(
    radio(picker.render(), "Wizard kit").props.checked,
    false,
    "changing back never restores a cleared pick",
  );
  toggle(picker.render()).props.onChange({ target: { checked: true } });
  tree = picker.render();
  assert.equal(radioLabels(tree).length, 3);
  assert.ok(text(tree).includes("game.ruleset.startingGear.other"));
  radio(tree, "Fighter kit").props.onChange();
  tree = picker.render();
  assert.equal(radio(tree, "Fighter kit").props.checked, true);
  assert.deepEqual((globalThis as any).__gearContext, { step, build: wizard, freeEdit: true });
  picker.props.sheets = { player: fighter };
  picker.render();
  picker.props.sheets = { player: wizard };
  tree = picker.render();
  assert.equal(radio(tree, "Fighter kit").props.checked, true, "free edit keeps an unfitting pick");
  assert.ok(!text(tree).includes("ui.rulesets.builder.pickCleared"));
  toggle(tree).props.onChange({ target: { checked: false } });
  assert.ok(text(picker.render()).includes("ui.rulesets.builder.pickCleared"));

  const empty = {
    ...definition,
    items: { ...definition.items!, startingGear: definition.items!.startingGear!.slice(0, 1) },
  };
  assert.deepEqual(rulesetBuilderStartingGearOptions(empty, step, wizard), []);
  assert.equal(rulesetBuilderRemaining(empty, wizard, {}, {}).gear, 0);
  picker.props.definition = empty;
  tree = picker.render();
  assert.ok(text(tree).includes("ui.rulesets.builder.noOptions"));
  assert.equal(radioLabels(tree).length, 0);
  const builder = host(ui.RulesetSheetBuilder, {
    definition: empty,
    build: wizard,
    state: {},
    evaluated: evaluateRulesetSheet(empty, wizard),
    onApply() {},
  });
  tree = builder.render();
  assert.ok(text(tree).includes("ui.rulesets.builder.noOptions"));
  const next = nodes(tree).find(
    (node) => node.type === "button" && text(node.props.children).includes("ui.rulesets.builder.next"),
  );
  assert.equal(next.props.disabled, false, "an empty gear step leaves Next open");
  toggle(tree).props.onChange({ target: { checked: true } });
  assert.ok(text(builder.render()).includes("Fighter kit"));
  next.props.onClick();
  assert.ok(nodes(builder.render()).some((node) => node.type === "h4" && node.props.children === "Class levels"));
  const old = { ...definition, sheet: { ...definition.sheet, builder: { steps: [{ ...step, strict: undefined }] } } };
  picker.props.definition = old;
  tree = picker.render();
  assert.equal(radioLabels(tree).length, 3);
  assert.equal(toggle(tree), undefined, "non-strict gear keeps the original UI");
  console.log(
    "Strict starting gear: schema, 1.109 gate, fit validation, legacy/free edit, class changes, empty state and Next passed.",
  );
} finally {
  delete (globalThis as any).__gearHooks;
  delete (globalThis as any).__gearContext;
  rmSync(dataDir, { recursive: true, force: true });
}
