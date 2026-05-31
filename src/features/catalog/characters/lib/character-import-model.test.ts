import { describe, expect, it } from "vitest";

import { buildCharacterImportUpdatePlan, CharacterImportPartialSuccessError } from "./character-import-model";

describe("character import model", () => {
  it("builds the update patch and pre-import version snapshot", () => {
    const plan = buildCharacterImportUpdatePlan(
      {
        id: "target-1",
        data: { name: "Target", character_version: "v1" },
        comment: "Target title",
        avatarPath: "avatars/target.png",
      },
      {
        id: "imported-1",
        data: { name: "Imported", description: "New card" },
        comment: "Imported title",
        avatarPath: "avatars/imported.png",
      },
      "Imported",
    );

    expect(plan.snapshot).toEqual({
      characterId: "target-1",
      data: { name: "Target", character_version: "v1" },
      comment: "Target title",
      avatarPath: "avatars/target.png",
      version: "v1",
      source: "import",
      reason: "Before in-place import from Imported",
    });
    expect(plan.patch).toEqual({
      id: "target-1",
      data: { name: "Imported", description: "New card" },
      comment: "Imported title",
      avatarPath: "avatars/imported.png",
      versionSource: "import",
      versionReason: "Imported updated card from Imported",
    });
    expect(plan.importedId).toBe("imported-1");
    expect(plan.updatedName).toBe("Target");
  });

  it("omits blank imported avatar paths and falls back to current target version", () => {
    const plan = buildCharacterImportUpdatePlan(
      { id: "target-1", data: { name: "Target" }, comment: "" },
      { data: { name: "Imported", description: "" }, avatarPath: " " },
      "card.json",
    );

    expect(plan.patch).not.toHaveProperty("avatarPath");
    expect(plan.snapshot.version).toBe("current");
    expect(plan.updatedName).toBe("Target");
  });

  it("rejects invalid update targets or imported rows without card data", () => {
    expect(() => buildCharacterImportUpdatePlan(null, { data: { name: "Imported" } }, "card.json")).toThrow(
      "Target character not found.",
    );
    expect(() => buildCharacterImportUpdatePlan({ id: "target-1" }, { comment: "Missing data" }, "card.json")).toThrow(
      "Imported character record did not include card data.",
    );
    expect(() =>
      buildCharacterImportUpdatePlan({ id: "target-1" }, { data: { name: "Imported" } }, "card.json"),
    ).toThrow('Imported character "card.json" is missing required card field: description.');
  });

  it("labels duplicate cleanup failures as partial import success", () => {
    const error = new CharacterImportPartialSuccessError({
      cause: new Error("delete failed"),
      importedId: "imported-1",
      importedName: "Imported",
      targetId: "target-1",
      updatedName: "Target",
    });

    expect(error.importedId).toBe("imported-1");
    expect(error.targetId).toBe("target-1");
    expect(error.message).toBe(
      'Updated "Target" from "Imported", but the imported duplicate "imported-1" could not be removed. Delete the duplicate manually. delete failed',
    );
  });
});
