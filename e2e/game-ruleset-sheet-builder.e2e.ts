import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * The guided builder (Capability API 1.86): a ruleset's `sheet.builder` shows as a Guided view beside
 * All fields in a game's Edit sheet. Picks apply what they grant and unpicking takes it back, the
 * scores are rolled with the Engine's dice or bought, each step counts what it still waits on, and
 * the sheet saved is the build every other part of the Engine reads.
 */
function ruleset(id: string): string {
  const doc = JSON.parse(
    readFileSync(new URL("../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
  );
  doc.id = id;
  // A feature whose score choice repeats (1.93): +2 to one score or +1 to two.
  const feats = doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats");
  feats.entries.find((entry: { id: string }) => entry.id === "sly-strike").grants = {
    abilities: { choose: [{ count: 2, amount: 1, repeat: true, upTo: 9 }] },
  };
  // Two features a step keeps one of (1.94): picking one drops the other.
  const sly = feats.entries.find((entry: { id: string }) => entry.id === "sly-strike");
  sly.exclusive = "knack";
  feats.entries.push({
    id: "steady-aim",
    label: "Steady Aim",
    filters: { level: 1 },
    exclusive: "knack",
    rows: [{ list: sly.rows[0].list, values: { name: "Steady Aim", text: "Take a breath before the shot." } }],
  });
  doc.catalogs.push(
    {
      id: "races",
      label: "Races",
      feeds: ["features"],
      filters: [{ id: "parent", label: "Race", type: "text" }],
      entries: [
        {
          id: "dwarf",
          label: "Dwarf",
          summary: "Stout and hardy, at home underground.",
          rows: [{ list: "features", values: { name: "Darkvision", text: "See in the dark." } }],
          grants: {
            abilities: { add: { con: 2 } },
            entries: { choose: [{ catalog: "tongues", count: 1, filters: { type: "standard" } }] },
          },
        },
        {
          id: "hill-dwarf",
          label: "Hill Dwarf",
          filters: { parent: "dwarf" },
          grants: { abilities: { add: { wis: 1 } } },
        },
        {
          id: "half-elf",
          label: "Half-Elf",
          grants: { abilities: { add: { cha: 2 }, choose: [{ count: 2, amount: 1, except: ["cha"] }] } },
        },
      ],
    },
    {
      id: "tongues",
      label: "Languages",
      feeds: ["features"],
      filters: [{ id: "type", label: "Type", type: "text" }],
      entries: [
        {
          id: "elvish",
          label: "Elvish",
          filters: { type: "standard" },
          rows: [{ list: "features", values: { name: "Elvish" } }],
        },
        {
          id: "giant",
          label: "Giant",
          filters: { type: "standard" },
          rows: [{ list: "features", values: { name: "Giant" } }],
        },
        {
          id: "abyssal",
          label: "Abyssal",
          filters: { type: "exotic" },
          rows: [{ list: "features", values: { name: "Abyssal" } }],
        },
      ],
    },
    {
      id: "classes",
      label: "Classes",
      entries: [
        {
          id: "fighter",
          label: "Fighter",
          grants: {
            trained: {
              saves: ["str_save", "con_save"],
              choose: [{ what: "skills", count: 2, from: ["acrobatics", "athletics", "perception", "survival"] }],
            },
            sets: { hit_die: "d10" },
          },
        },
      ],
    },
  );
  doc.sheet.builder = {
    tier: "proficient",
    steps: [
      { id: "race", label: "Race", kind: "catalog", catalog: "races", field: "race" },
      {
        id: "subrace",
        label: "Subrace",
        kind: "catalog",
        catalog: "races",
        min: 0,
        within: { step: "race", filter: "parent" },
      },
      { id: "class", label: "Class", kind: "catalog", catalog: "classes", field: "class" },
      { id: "level", label: "Level", kind: "fields", fields: ["level", "xp", "subclass"], optional: ["subclass"] },
      {
        id: "scores",
        label: "Ability Scores",
        kind: "abilities",
        methods: {
          pointBuy: {
            budget: 27,
            costs: [
              [8, 0],
              [9, 1],
              [10, 2],
              [11, 3],
              [12, 4],
              [13, 5],
              [14, 7],
              [15, 9],
            ],
          },
          standardArray: [15, 14, 13, 12, 10, 8],
          roll: { count: 4, sides: 6, keep: 3 },
          manual: true,
        },
        default: "pointBuy",
      },
      {
        id: "features",
        label: "Features",
        kind: "catalog",
        catalog: "feats",
        min: 0,
        max: 3,
        upTo: { filter: "level", value: { field: "level" } },
        countFrom: { field: "level" },
      },
      { id: "skills", label: "Proficiencies", kind: "trained" },
      { id: "languages", label: "Languages", kind: "choices", catalog: "tongues" },
    ],
  };
  return JSON.stringify(doc);
}

async function seedGame(request: APIRequestContext, rulesetId: string, characterId: string): Promise<string> {
  const created = await request.post("/api/chats", {
    data: { name: "Guided builder", mode: "game", characterIds: [characterId] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  const sheet = { v: 1, build: {} };
  const meta = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: {
      gameId: `ruleset-builder-${rulesetId}`,
      gameSessionStatus: "active",
      gameIntroPresented: true,
      gameRuleset: { id: rulesetId, version: 1, packageId: null, options: {} },
      gamePartyCharacterIds: [characterId],
      gameCharacterCards: [
        { name: "Ada", rulesetSheet: sheet },
        { name: "Bram", rulesetSheet: sheet },
      ],
      gameInventory: [],
    },
  });
  expect(meta.ok(), await meta.text()).toBeTruthy();
  const saved = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "assistant", content: "The road begins at the inn." },
  });
  expect(saved.ok()).toBeTruthy();
  return chat.id;
}

async function openSheetEditor(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    gameInstantTextReveal: true,
  });
  await page.addInitScript(
    ({ id, appVersion }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    },
    { id: chatId, appVersion: version },
  );
  await page.goto("/");
  const portrait = page.getByTitle("Bram - Click to open character sheet", { exact: true }).filter({ visible: true });
  // Both layouts open party portraits from the shared Character Profiles button.
  const members = page
    .locator('.mari-window-bubble[data-window="control:character-profiles"]')
    .filter({ visible: true });
  await expect(portrait.or(members).first()).toBeVisible({ timeout: 30000 });
  if (await members.isVisible()) await members.click();
  await portrait.first().click();
  await page.getByRole("button", { name: "Edit ruleset sheet", exact: true }).last().click();
}

test("the guided builder applies picks, rolls and buys scores, and saves the sheet", async ({ page, request }) => {
  test.setTimeout(180000);
  const policyBefore = await request.get("/api/agents/import-policy");
  expect(policyBefore.ok(), await policyBefore.text()).toBeTruthy();
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  let chatId: string | undefined;
  let rulesetId: string | undefined;
  let characterId: string | undefined;
  try {
    const policy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(policy.ok(), await policy.text()).toBeTruthy();
    const imported = await request.post("/api/game-rulesets/import", {
      data: { definition: ruleset(`dnd-builder-e2e-${test.info().project.name}`) },
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    rulesetId = (await imported.json()).rulesetId as string;
    const character = await request.post("/api/characters", { data: { data: { name: "Bram" } } });
    expect(character.ok(), await character.text()).toBeTruthy();
    characterId = ((await character.json()) as { id: string }).id;
    chatId = await seedGame(request, rulesetId, characterId);
    await openSheetEditor(page, chatId);

    // Guided is where the editor opens, the steps across the top, each with what it waits on.
    await expect(page.getByRole("tab", { name: "Guided", exact: true })).toHaveAttribute("aria-selected", "true");
    const steps = page.getByRole("navigation", { name: "Character builder steps" });
    await expect(steps.getByRole("button", { name: "Race 1 choice left", exact: true })).toHaveAttribute(
      "aria-current",
      "step",
    );
    // A step that offers nothing yet is not walked through: no subrace before a race.
    await expect(steps.getByRole("button", { name: /^Subrace/ })).toHaveCount(0);
    const summary = page.getByRole("complementary", { name: "Character" });

    // A new character opens on point buy, and features up to its level.
    await steps.getByRole("button", { name: /^Ability Scores/ }).click();
    await expect(page.getByRole("radio", { name: "Point buy" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("27 of 27 points left")).toBeVisible();
    await steps.getByRole("button", { name: /^Features/ }).click();
    await expect(page.getByRole("button", { name: "Select Sly Strike" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Second Effort" })).toHaveCount(0);
    // As many features as the level says (countFrom).
    await expect(page.getByText("Select one (0 selected)")).toBeVisible();
    await expect(steps.getByRole("button", { name: "Features 1 choice left", exact: true })).toBeVisible();
    // A score choice that repeats: one score twice, a minus takes one back. Then the feature goes again.
    await page.getByRole("button", { name: "Select Sly Strike" }).click();
    await steps.getByRole("button", { name: /^Ability Scores/ }).click();
    const twice = page.getByRole("group", { name: /Sly Strike: choose 2 scores/ });
    await twice.getByRole("button", { name: "Strength", exact: true }).click();
    // The choice stops at 9 (1.96): Strength 8 + 1 takes no more, though the choice has one left.
    await expect(twice.getByRole("button", { name: "Strength", exact: true })).toBeDisabled();
    await twice.getByRole("button", { name: "Dexterity", exact: true }).click();
    await expect(twice.getByRole("button", { name: "Constitution", exact: true })).toBeDisabled();
    await expect(steps.getByRole("button", { name: "Ability Scores 1 choice left", exact: true })).toBeVisible();
    await twice.getByRole("button", { name: "Take back one from Strength", exact: true }).click();
    await expect(twice.getByRole("button", { name: "Strength", exact: true })).toBeEnabled();
    await steps.getByRole("button", { name: /^Features/ }).click();
    // Steady Aim shares Sly Strike's group: picking it replaces Sly Strike, full step or not.
    await page.getByRole("button", { name: "Select Steady Aim", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove Steady Aim", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Sly Strike", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Remove Steady Aim", exact: true }).click();
    await expect(page.getByText("Select one (0 selected)")).toBeVisible();
    await steps.getByRole("button", { name: /^Race/ }).click();

    // A race: its info, its increase, its field.
    await page.getByRole("button", { name: "Show what Dwarf is" }).click();
    await expect(page.getByText("Stout and hardy, at home underground.")).toBeVisible();
    await page.getByRole("button", { name: "Select Dwarf" }).click();
    await expect(steps.getByRole("button", { name: "Race Nothing left to choose", exact: true })).toBeVisible();
    await expect(summary.getByText("Dwarf", { exact: true })).toBeVisible();
    // The dwarf's language of choice: a standard one, at the Languages step.
    await expect(steps.getByRole("button", { name: "Languages 1 choice left", exact: true })).toBeVisible();
    await steps.getByRole("button", { name: /^Languages/ }).click();
    const tongues = page.getByRole("group", { name: /Dwarf: choose 1/ });
    await expect(tongues.getByRole("button", { name: "Abyssal", exact: true })).toHaveCount(0);
    await tongues.getByRole("button", { name: "Elvish", exact: true }).click();
    await expect(tongues.getByRole("button", { name: "Giant", exact: true })).toBeDisabled();
    // Done here, though it says the earlier steps still open come first.
    await expect(steps.getByRole("button", { name: /^Languages Nothing left/ })).toBeVisible();
    await steps.getByRole("button", { name: /^Race/ }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Select Hill Dwarf" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Select Fighter" }).click();
    await expect(summary.getByText("Fighter", { exact: true })).toBeVisible();
    await expect(steps.getByRole("button", { name: "Proficiencies 2 choices left", exact: true })).toBeVisible();
    // A fields step waits on nothing optional, and the summary shows the sheet's own summary numbers.
    await expect(steps.getByRole("button", { name: "Level Nothing left to choose", exact: true })).toBeVisible();
    await expect(summary.getByText("Proficiency bonus", { exact: true })).toBeVisible();
    await expect(summary.getByText("Armor Class", { exact: true })).toBeVisible();
    await expect(summary.getByText("Spell save DC", { exact: true })).toHaveCount(0);

    // Scores: rolled with the Engine's dice and handed out, then bought instead.
    await page.getByRole("button", { name: /^Ability Scores/ }).click();
    await page.getByRole("radio", { name: "Dice roll" }).click();
    let rolls = 0;
    page.on("response", (response) => {
      if (response.url().includes("/api/game/dice/roll")) rolls += 1;
    });
    await page.getByRole("button", { name: "Roll scores (4d6, keep 3)" }).click();
    await expect(page.getByRole("button", { name: "Roll again (4d6, keep 3)" })).toBeVisible();
    await expect.poll(() => rolls).toBe(6);
    const rolled = (await page.getByText(/^Rolled: /).textContent())!.replace("Rolled: ", "").split(", ").map(Number);
    expect(rolled).toHaveLength(6);
    for (const value of rolled) expect(value >= 3 && value <= 18).toBe(true);
    await page.getByRole("combobox", { name: "Base score for Constitution" }).selectOption("0");
    await expect(summary.getByText(String(rolled[0]! + 2), { exact: true }).first()).toBeVisible();
    await expect(steps.getByRole("button", { name: "Ability Scores 5 choices left", exact: true })).toBeVisible();

    await page.getByRole("radio", { name: "Point buy" }).click();
    await expect(page.getByText("27 of 27 points left")).toBeVisible();
    for (let i = 0; i < 7; i++) await page.getByRole("button", { name: "Raise Strength" }).click();
    await expect(page.getByText("18 of 27 points left")).toBeVisible();
    await expect(page.getByRole("button", { name: "Raise Strength" })).toBeDisabled();

    // A different race takes back the dwarf's increases, its row and the subrace, and offers a choice.
    await page.getByRole("button", { name: /^Race/ }).click();
    await page.getByRole("button", { name: "Select Half-Elf" }).click();
    await expect(steps.getByRole("button", { name: "Ability Scores 3 choices left", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Ability Scores/ }).click();
    const choice = page.getByRole("group", { name: /Half-Elf: choose 2 scores, \+1 each/ });
    await choice.getByRole("button", { name: "Dexterity", exact: true }).click();
    await choice.getByRole("button", { name: "Wisdom", exact: true }).click();
    await expect(choice.getByRole("button", { name: "Intelligence", exact: true })).toBeDisabled();
    await expect(choice.getByRole("button", { name: "Charisma", exact: true })).toHaveCount(0);

    // The class's skills, at the Proficiencies step.
    await page.getByRole("button", { name: /^Proficiencies/ }).click();
    const skills = page.getByRole("group", { name: /Fighter: choose 2 skills/ });
    await skills.getByRole("button", { name: "Athletics", exact: true }).click();
    await skills.getByRole("button", { name: "Perception", exact: true }).click();
    await expect(steps.getByRole("button", { name: /^Proficiencies Nothing left/ })).toBeVisible();

    // All fields shows the same sheet.
    await page.getByRole("tab", { name: "All fields", exact: true }).click();
    await expect(page.locator('input[aria-label="Strength"]')).toHaveValue("15");
    await expect(page.locator('input[aria-label="Charisma"]')).toHaveValue("10");

    // A level raised in All fields offers a feature; lowered there, it takes the feature back at once.
    const level = page.locator('input[aria-label="Level"]');
    await level.fill("2");
    await level.press("Tab");
    await page.getByRole("tab", { name: "Guided", exact: true }).click();
    await steps.getByRole("button", { name: /^Features/ }).click();
    await expect(page.getByText("Select up to 2 (0 selected)")).toBeVisible();
    await page.getByRole("button", { name: "Select Second Effort" }).click();
    await page.getByRole("tab", { name: "All fields", exact: true }).click();
    const featureName = page.locator('input[aria-label="Features and traits 1: Name"]');
    await expect(featureName).toHaveValue("Second Effort");
    await level.fill("1");
    await level.press("Tab");
    await expect(featureName).toHaveCount(0);

    await page.getByRole("button", { name: "Save sheet", exact: true }).click();
    await expect
      .poll(async () => {
        const row = await (await request.get(`/api/chats/${chatId}`)).json();
        const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
        const bram = (meta.gameCharacterCards as Array<{ name: string; rulesetSheet?: any }>).find(
          (card) => card.name === "Bram",
        );
        const build = bram?.rulesetSheet?.build;
        return build
          ? {
              abilities: build.abilities,
              race: build.fields.race,
              class: build.fields.class,
              hitDie: build.fields.hit_die,
              saves: build.saves,
              skills: build.skills,
              rows: (build.lists.features ?? []).filter((row: { _catalog?: string }) => row._catalog).length,
              method: bram.rulesetSheet.builder?.method,
            }
          : null;
      })
      .toEqual({
        abilities: { str: 15, dex: 9, con: 8, int: 8, wis: 9, cha: 10 },
        race: "Half-Elf",
        class: "Fighter",
        hitDie: "d10",
        saves: { str_save: "proficient", con_save: "proficient" },
        skills: { athletics: "proficient", perception: "proficient" },
        rows: 0,
        method: "pointBuy",
      });
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    if (rulesetId) await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(rulesetId)}&force=true`);
    if (characterId) await request.delete(`/api/characters/${characterId}`);
    const restored = await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});

test("counted builder choices explain exclusions, replacements and conditional badges without blocking Next", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const policyBefore = await request.get("/api/agents/import-policy");
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  let chatId: string | undefined;
  let rulesetId: string | undefined;
  let characterId: string | undefined;
  try {
    await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    const doc = JSON.parse(ruleset(`builder-choices-e2e-${test.info().project.name}`));
    doc.catalogs.push({
      id: "backgrounds",
      label: "Backgrounds",
      entries: [
        {
          id: "scholar",
          label: "Scholar",
          grants: {
            abilities: {
              choose: [
                { id: "restricted", count: 1, amount: 2, from: ["str", "dex"] },
                {
                  id: "free",
                  count: 1,
                  amount: 2,
                  from: ["str", "dex", "con"],
                  excludeChoices: ["background/restricted"],
                },
              ],
            },
            trained: {
              skills: ["athletics"],
              choose: [{ id: "skill", what: "skills", count: 1, from: ["athletics"], onDuplicate: "replace" }],
            },
          },
        },
      ],
    });
    doc.catalogs.push({
      id: "talents",
      label: "Talents",
      feeds: ["features"],
      filters: [{ id: "tier", label: "Tier", type: "number" }],
      entries: [1, 1, 2].map((tier, index) => ({
        id: `talent-${index}`,
        label: `Talent ${index}`,
        filters: { tier },
        rows: [{ list: "features", values: { name: `Talent ${index}` } }],
      })),
    });
    // The sample's unused entries still offer languages, so keep their required host step.
    doc.sheet.builder = {
      tier: "proficient",
      steps: [
        { id: "fields", label: "Details", kind: "fields", fields: ["xp"] },
        { id: "background", label: "Background", kind: "catalog", catalog: "backgrounds" },
        { id: "training", label: "Training", kind: "trained" },
        {
          id: "talents",
          label: "Talents",
          kind: "catalog",
          catalog: "talents",
          min: 3,
          max: 3,
          quotaBelow: { filter: "tier" },
          quotas: [{ filter: "tier", value: 2, min: 1, max: 1 }],
        },
        { id: "languages", label: "Languages", kind: "choices", catalog: "tongues" },
        {
          id: "conditional",
          label: "Subrace",
          kind: "catalog",
          catalog: "backgrounds",
          when: { field: "xp" },
          requiredWhen: { field: "xp" },
        },
      ],
    };
    const imported = await request.post("/api/game-rulesets/import", { data: { definition: JSON.stringify(doc) } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    rulesetId = (await imported.json()).rulesetId;
    const character = await request.post("/api/characters", { data: { data: { name: "Bram" } } });
    characterId = (await character.json()).id;
    chatId = await seedGame(request, rulesetId!, characterId!);
    await openSheetEditor(page, chatId);
    const steps = page.getByRole("navigation", { name: "Character builder steps" });
    await expect(steps.getByRole("button", { name: /^Subrace/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(steps.getByRole("button", { name: "Background 1 choice left", exact: true })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(steps.getByRole("button", { name: /^Training/ })).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Select Scholar", exact: true }).click();
    const boosts = page.getByRole("group", { name: /Scholar: choose 1 score,/ });
    await boosts.nth(0).getByRole("button", { name: "Strength", exact: true }).click();
    await expect(boosts.nth(1).getByRole("button", { name: /Strength Excluded by an earlier choice/ })).toBeDisabled();
    await boosts.nth(1).getByRole("button", { name: "Dexterity", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("group", { name: /^Scholar: choose 1 skill\b/ })
      .getByRole("button", { name: "Athletics", exact: true })
      .click();
    const replacement = page.getByRole("group", { name: /^Replacement: Scholar/ });
    await expect(replacement).toBeVisible();
    await replacement.getByRole("button", { name: "Perception", exact: true }).click();
    await expect(steps.getByRole("button", { name: "Training Nothing left to choose", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Tier 2: choose 1.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Talent 2", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Select Talent 0", exact: true }).click();
    await page.getByRole("button", { name: "Select Talent 1", exact: true }).click();
    await page.getByRole("button", { name: "Select Talent 2", exact: true }).click();
    await page.getByRole("button", { name: "Remove Talent 0", exact: true }).click();
    await expect(page.getByText(/Some saved answers no longer apply/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Talent 2", exact: true })).toBeEnabled();
    // Nothing here blocks moving on. Talents is the last step asked (Languages offers nothing, and the
    // Subrace waits on experience), so the way on is Back or a step above.
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeEnabled();
    await expect(steps.getByRole("button", { name: /^Details/ })).toBeEnabled();
    await steps.getByRole("button", { name: /^Details/ }).click();
    await page.getByRole("textbox", { name: "Experience points", exact: true }).fill("1");
    await page.getByRole("textbox", { name: "Experience points", exact: true }).press("Tab");
    await expect(steps.getByRole("button", { name: "Subrace 1 choice left", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "All fields", exact: true }).click();
    await page.getByRole("textbox", { name: "Experience points", exact: true }).fill("0");
    await page.getByRole("textbox", { name: "Experience points", exact: true }).press("Tab");
    await page.getByRole("tab", { name: "Guided", exact: true }).click();
    await expect(steps.getByRole("button", { name: /^Subrace/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Save sheet", exact: true }).click();
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    if (rulesetId) await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(rulesetId)}&force=true`);
    if (characterId) await request.delete(`/api/characters/${characterId}`);
    await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
  }
});

test("rating stages retain priority purchases, free ranks and manual overrides", async ({ page, request }) => {
  test.setTimeout(180000);
  const policyBefore = await request.get("/api/agents/import-policy");
  const importsWereEnabled = (await policyBefore.json()).enabled === true;
  let chatId: string | undefined;
  let rulesetId: string | undefined;
  let characterId: string | undefined;
  try {
    await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    const doc = JSON.parse(
      readFileSync(new URL("../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
    );
    doc.id = `allocation-e2e-${test.info().project.name}`;
    for (const ability of doc.sheet.abilities) Object.assign(ability, { min: 0, default: 1 });
    doc.sheet.abilities.find((ability: { id: string }) => ability.id === "cha").label = "Appearance";
    doc.catalogs.push({
      id: "heritages",
      label: "Heritages",
      entries: [
        { id: "first", label: "First heritage", grants: { ratings: [{ target: { skill: "athletics" }, add: 1 }] } },
        { id: "second", label: "Second heritage", grants: { ratings: [{ target: { skill: "athletics" }, add: 1 }] } },
      ],
    });
    doc.sheet.builder = {
      ratingTiers: [{ target: { skill: "athletics" }, tiers: ["none", "proficient", "expertise"] }],
      steps: [
        { id: "heritage", label: "Heritage", kind: "catalog", catalog: "heritages", min: 0, max: 2 },
        {
          id: "dots",
          label: "Dots",
          kind: "allocate",
          priorities: [7, 5, 3],
          annotations: true,
          groups: [
            {
              id: "physical",
              label: "Physical",
              targets: ["str", "dex", "con"].map((ability) => ({ ability })),
              base: 1,
              min: 1,
              max: 5,
            },
            { id: "social", label: "Social", targets: [{ ability: "int" }], base: 1, min: 1, max: 5 },
            { id: "mental", label: "Mental", targets: [{ ability: "wis" }], base: 1, min: 1, max: 5 },
          ],
        },
        {
          id: "ranks",
          label: "Ranks",
          kind: "allocate",
          groups: [
            {
              id: "training",
              label: "Training",
              targets: [{ skill: "athletics" }],
              base: 0,
              min: 0,
              max: 2,
              budget: { const: 1 },
            },
          ],
        },
        {
          id: "appearance",
          label: "Appearance",
          kind: "allocate",
          groups: [
            {
              id: "fixed",
              label: "Fixed",
              targets: [{ ability: "cha" }],
              base: 0,
              min: 0,
              max: 0,
              budget: { const: 0 },
            },
          ],
        },
        { id: "details", label: "Details", kind: "fields", fields: ["xp"] },
      ],
    };
    const imported = await request.post("/api/game-rulesets/import", { data: { definition: JSON.stringify(doc) } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    rulesetId = (await imported.json()).rulesetId;
    const character = await request.post("/api/characters", { data: { data: { name: "Bram" } } });
    characterId = (await character.json()).id;
    chatId = await seedGame(request, rulesetId!, characterId!);
    await openSheetEditor(page, chatId);
    await page.getByRole("button", { name: "Select First heritage", exact: true }).click();
    // A step that takes none or more asks for one first; a second is asked for.
    await page.getByRole("button", { name: "Add another (Heritage)", exact: true }).click();
    await page.getByRole("button", { name: "Select Second heritage", exact: true }).click();
    const steps = page.getByRole("navigation", { name: "Character builder steps" });
    await steps.getByRole("button", { name: /^Ranks/ }).click();
    await expect(page.getByText("Base/prior 0 · Free 2 · Bought 0 · Total 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Raise Athletics", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    await steps.getByRole("button", { name: /^Dots/ }).click();
    await expect(page.getByRole("button", { name: "Raise Strength", exact: true })).toBeDisabled();
    await page.getByLabel("Allotment for Physical", { exact: true }).selectOption("0");
    await page.getByLabel("Allotment for Social", { exact: true }).selectOption("1");
    await page.getByLabel("Allotment for Mental", { exact: true }).selectOption("2");
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Raise Strength", exact: true }).click();
    await expect(page.getByRole("button", { name: "Raise Strength", exact: true })).toBeDisabled();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Raise Dexterity", exact: true }).click();
    await expect(page.getByRole("button", { name: "Raise Constitution", exact: true })).toBeDisabled();
    await page.getByLabel("Notes for Strength (optional)", { exact: true }).fill("Heritage specialty");
    await page.getByLabel("Allotment for Physical", { exact: true }).selectOption("2");
    await expect(page.getByLabel("Allotment for Mental", { exact: true })).toHaveValue("0");
    await expect(
      page.getByText("4 saved dots are inactive. Reduce or clear them to fit this stage.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    await page.getByLabel("Allotment for Physical", { exact: true }).selectOption("0");
    await expect(page.getByText("Base/prior 1 · Free 0 · Bought 4 · Total 5", { exact: true })).toBeVisible();
    await steps.getByRole("button", { name: /^Appearance/ }).click();
    await expect(page.getByRole("button", { name: "Raise Appearance", exact: true })).toBeDisabled();
    await page.getByRole("tab", { name: "All fields", exact: true }).click();
    await page.getByRole("textbox", { name: "Appearance", exact: true }).fill("4");
    await page.getByRole("textbox", { name: "Appearance", exact: true }).press("Tab");
    await page.getByRole("tab", { name: "Guided", exact: true }).click();
    await steps.getByRole("button", { name: /^Appearance/ }).click();
    await expect(
      page.getByText("Sheet override: 4. Edit it in All fields; guided purchases are kept.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Save sheet", exact: true }).click();
    // Wait for the builder to close, or .last() can land on the character card's Edit sheet button.
    await expect(steps).toBeHidden();
    await page.getByRole("button", { name: "Edit ruleset sheet", exact: true }).last().click();
    await steps.getByRole("button", { name: /^Dots/ }).click();
    await expect(page.getByLabel("Notes for Strength (optional)", { exact: true })).toHaveValue("Heritage specialty");
    await expect(page.getByText("Base/prior 1 · Free 0 · Bought 4 · Total 5", { exact: true })).toBeVisible();
    await steps.getByRole("button", { name: /^Ranks/ }).click();
    await expect(page.getByText("Base/prior 0 · Free 2 · Bought 0 · Total 2", { exact: true })).toBeVisible();
    await steps.getByRole("button", { name: /^Heritage/ }).click();
    await page.getByRole("button", { name: "Remove First heritage", exact: true }).click();
    await steps.getByRole("button", { name: /^Ranks/ }).click();
    await expect(page.getByRole("button", { name: "Raise Athletics", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Raise Athletics", exact: true }).click();
    await expect(page.getByText("Base/prior 0 · Free 1 · Bought 1 · Total 2", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save sheet", exact: true }).click();
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    if (rulesetId) await request.delete(`/api/game-rulesets?rulesetId=${encodeURIComponent(rulesetId)}&force=true`);
    if (characterId) await request.delete(`/api/characters/${characterId}`);
    await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
  }
});

test("priced builder purchases preserve free dots and preview career repricing", async ({ page, request }) => {
  test.setTimeout(180000);
  const importsWereEnabled = (await (await request.get("/api/agents/import-policy")).json()).enabled === true;
  let chatId: string | undefined;
  let rulesetId: string | undefined;
  let characterId: string | undefined;
  try {
    await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    const doc = JSON.parse(
      readFileSync(new URL("../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8"),
    );
    doc.id = "spend-e2e-" + test.info().project.name;
    doc.sheet.fields.push(
      { id: "background_value", label: "Background dots", type: "number", min: 0, max: 20, default: 0 },
      { id: "career_cost", label: "Career cost", type: "number", min: 0, max: 1, default: 0 },
      { id: "flaw_value", label: "Flaw dots", type: "number", min: 0, max: 10, default: 0 },
    );
    doc.catalogs.push({
      id: "heritages",
      label: "Heritages",
      entries: [
        {
          id: "free",
          label: "Free background",
          grants: { ratings: [{ target: { field: "background_value" }, add: 2 }] },
        },
      ],
    });
    doc.sheet.builder = {
      pools: [
        {
          id: "points",
          label: "Creation points",
          budget: { const: 10 },
          creditLimit: 2,
          caps: [{ filter: "flaw", maxCredit: 2 }],
        },
      ],
      steps: [
        { id: "heritage", label: "Heritage", kind: "catalog", catalog: "heritages" },
        { id: "career", label: "Career", kind: "fields", fields: ["career_cost"] },
        {
          id: "purchases",
          label: "Purchases",
          kind: "spend",
          pool: "points",
          offers: [
            {
              id: "background",
              label: "Background",
              target: { field: "background_value" },
              min: 0,
              max: 10,
              cost: { flat: 1 },
              overrides: [{ when: { field: "career_cost" }, cost: { flat: 2 } }],
            },
          ],
        },
        {
          id: "flaws",
          label: "Flaws",
          kind: "spend",
          pool: "points",
          offers: [
            {
              id: "flaw",
              label: "Flaw",
              target: { field: "flaw_value" },
              min: 0,
              max: 10,
              cost: { flat: -1 },
              credit: true,
              tags: ["flaw"],
            },
          ],
        },
        { id: "details", label: "Details", kind: "fields", fields: ["xp"] },
      ],
    };
    const imported = await request.post("/api/game-rulesets/import", { data: { definition: JSON.stringify(doc) } });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    rulesetId = (await imported.json()).rulesetId;
    characterId = (await (await request.post("/api/characters", { data: { data: { name: "Bram" } } })).json()).id;
    chatId = await seedGame(request, rulesetId!, characterId!);
    await openSheetEditor(page, chatId);
    await page.getByRole("button", { name: "Select Free background", exact: true }).click();
    const steps = page.getByRole("navigation", { name: "Character builder steps" });
    await steps.getByRole("button", { name: /^Purchases/ }).click();
    const buy = page.getByRole("button", { name: "Buy a rating for Background", exact: true });
    for (let i = 0; i < 5; i++) await buy.click();
    await expect(
      page.getByText("Starting/free 2 · Bought 5 · Requested total 7 · Paid 5", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Creation points: available 10 · Spent 5 · Credit 0 · Remaining 5", { exact: true }),
    ).toBeVisible();
    await steps.getByRole("button", { name: /^Career/ }).click();
    const career = page.getByRole("textbox", { name: "Career cost", exact: true });
    await career.fill("1");
    await career.press("Tab");
    await steps.getByRole("button", { name: /^Purchases/ }).click();
    await expect(page.getByText("Price after repair: 10 points for this pool.", { exact: true })).toBeVisible();
    await expect(buy).toBeDisabled();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Reprice saved purchases", exact: true }).click();
    await expect(
      page.getByText("Starting/free 2 · Bought 5 · Requested total 7 · Paid 10", { exact: true }),
    ).toBeVisible();
    await expect(buy).toBeDisabled();
    await page.getByRole("button", { name: "Refund last purchase for Background", exact: true }).click();
    await expect(
      page.getByText("Starting/free 2 · Bought 4 · Requested total 6 · Paid 8", { exact: true }),
    ).toBeVisible();
    await steps.getByRole("button", { name: /^Flaws/ }).click();
    await page.getByRole("button", { name: "Buy a rating for Flaw", exact: true }).click();
    await page.getByRole("button", { name: "Buy a rating for Flaw", exact: true }).click();
    await expect(page.getByRole("button", { name: "Buy a rating for Flaw", exact: true })).toBeDisabled();
    await expect(page.getByText("Total credit limit: 2.", { exact: true })).toBeVisible();
    await expect(page.getByText("flaw credit limit: 2.", { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("spend-pool.png") });
    await expect(
      page.getByText("Creation points: available 10 · Spent 6 · Credit 2 · Remaining 4", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save sheet", exact: true }).click();
    // Wait for the builder to close, or .last() can land on the character card's Edit sheet button.
    await expect(steps).toBeHidden();
    await page.getByRole("button", { name: "Edit ruleset sheet", exact: true }).last().click();
    await steps.getByRole("button", { name: /^Purchases/ }).click();
    await expect(
      page.getByText("Starting/free 2 · Bought 4 · Requested total 6 · Paid 8", { exact: true }),
    ).toBeVisible();
    await page.getByText("Purchase history", { exact: true }).click();
    await expect(page.getByText("2 → 3: 2 points", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "All fields", exact: true }).click();
    const dots = page.getByRole("textbox", { name: "Background dots", exact: true });
    await dots.fill("12");
    await dots.press("Tab");
    await page.getByRole("tab", { name: "Guided", exact: true }).click();
    await steps.getByRole("button", { name: /^Purchases/ }).click();
    await expect(
      page.getByText("Sheet override: 12. Edit it in All fields; guided purchases are kept.", { exact: true }),
    ).toBeVisible();
    await expect(buy).toBeDisabled();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  } finally {
    if (chatId) await request.delete("/api/chats/" + chatId);
    if (rulesetId)
      await request.delete("/api/game-rulesets?rulesetId=" + encodeURIComponent(rulesetId) + "&force=true");
    if (characterId) await request.delete("/api/characters/" + characterId);
    await request.patch("/api/agents/import-policy", { data: { enabled: importsWereEnabled } });
  }
});
