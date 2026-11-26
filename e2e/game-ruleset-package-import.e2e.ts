import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

/**
 * A ruleset package file (RM, `<name>.ruleset.json`), imported from the Agents panel: the review shows its
 * catalogs and their entries, the import keeps it, and a package holding anything else is refused with the
 * reason.
 */

const appVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const example = JSON.parse(
  readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"),
) as Record<string, any>;
const ruleset = structuredClone(example);
ruleset.id = "ember-roads-package";
ruleset.name = "Ember Roads (package)";
const first = (ruleset.catalogs as Array<Record<string, any>>)[0]!;
const catalog = { schemaVersion: 1, catalog: first.id, entries: first.entries as unknown[] };
delete first.entries;
first.asset = `catalogs/${first.id}.json`;
const files = [
  { name: "ruleset.json", data: Buffer.from(JSON.stringify(ruleset)) },
  { name: first.asset as string, data: Buffer.from(JSON.stringify(catalog)) },
];
const packageOf = (contents: typeof files, extra: Record<string, string> = {}) =>
  Buffer.from(
    JSON.stringify({
      format: "marinara-ruleset",
      version: 1,
      manifest: {
        schemaVersion: 2,
        id: "ember-roads-package",
        name: "Ember Roads (package)",
        version: "1.0.0",
        description: "",
        engine: { min: "2.4.0", maxExclusive: "3.0.0" },
        kind: ["ruleset"],
        entrypoints: {},
        contributions: { assets: { paths: contents.map((file) => file.name) } },
        files: contents.map((file) => ({
          path: file.name,
          sha256: createHash("sha256").update(file.data).digest("hex"),
          bytes: file.data.length,
        })),
        permissions: [],
        restartRequired: false,
        capabilityApi: { major: 1, minor: 79 },
        builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      },
      files: { ...Object.fromEntries(contents.map((file) => [file.name, file.data.toString("base64")])), ...extra },
    }),
  );

test("a ruleset package file is reviewed with its catalogs and imported; one holding more is refused", async ({
  page,
  request,
}, testInfo) => {
  const before = ((await (await request.get("/api/agents/import-policy")).json()) as { enabled: boolean }).enabled;
  const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
  expect(policy.ok()).toBeTruthy();
  try {
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), appVersion);
    await page.goto("/");
    await clickTopbarPanel(page, "agents");
    const agents = page.getByRole("region", { name: "Agents" });
    const rulesetInput = agents.locator('input[type="file"][accept=".ruleset.json,.json"]');
    // Until the panel has read the import policy, a file is refused as if imports were off. People reach this input
    // through the Import button, which stays disabled until then, so wait for the button too.
    const importButton = agents.getByRole("button", { name: "Import agents", exact: true });
    await expect(importButton).toBeVisible();
    await expect(importButton).not.toHaveAttribute("aria-disabled", "true");

    // Anything but a ruleset's files refuses the package, with the reason.
    await rulesetInput.setInputFiles({
      name: "ember-roads-package.ruleset.json",
      mimeType: "application/json",
      buffer: packageOf(files, { "payload.js": Buffer.from("alert(1)").toString("base64") }),
    });
    await expect(page.getByText(/"payload\.js" is not a file a ruleset package has/)).toBeVisible();

    // The package as a ruleset editor makes it: reviewed with its catalog and entries, then imported.
    await rulesetInput.setInputFiles({
      name: "ember-roads-package.ruleset.json",
      mimeType: "application/json",
      buffer: packageOf(files),
    });
    const review = page.getByRole("dialog", { name: "Import a Game Mode ruleset" });
    await expect(review).toBeVisible();
    await expect(review).toContainText(`${first.label} (${catalog.entries.length} entries)`);
    await review.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText("Imported Ember Roads (package), version 1.")).toBeVisible();
    const listed = (await (await request.get("/api/capability-packages/rulesets")).json()) as Array<{
      definition: { id: string };
    }>;
    expect(listed.some((entry) => entry.definition.id === "local/ember-roads-package")).toBe(true);
  } finally {
    await request.delete("/api/game-rulesets?rulesetId=local/ember-roads-package&force=true").catch(() => undefined);
    await request.patch("/api/agents/import-policy", { data: { enabled: before } }).catch(() => undefined);
  }
});
