// Ship branch: Mari's theme writes follow the same rules as the Theme Library. A new theme gets the
// required (empty) package column, a starter theme (a read-only gallery download) can't be edited,
// and the starter- id prefix stays reserved for the gallery. Picking a starter is still allowed.
import assert from "node:assert/strict";
import { withHandbook } from "./_handbook.js";
import { customThemes } from "../../../packages/server/src/db/schema/themes.js";

type Result = { ok?: boolean; readBack?: { status?: string }; validation?: { errors?: Array<{ message?: string }> } };

await withHandbook("builtin-themes", async ({ mari, db }) => {
  const created = (await mari.executeAction({
    action: "theme.create",
    id: "harbor-glass",
    data: { name: "Harbor Glass", css: ":root { --primary: #3fae7a; }" },
    apply: true,
  })) as Result;
  assert.equal(created.ok, true, "a plain theme.create is accepted");
  assert.equal(created.readBack?.status, "verified");

  const reserved = (await mari.executeAction({
    action: "theme.create",
    id: "starter-mine",
    data: { name: "Mine", css: ":root { --primary: red; }" },
    apply: true,
  })) as Result;
  assert.equal(reserved.ok, false, "starter- ids are reserved for gallery downloads");

  const t = "2026-01-01T00:00:00.000Z";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture row straight into the file store
  await (db as any).insert(customThemes).values({
    id: "starter-petal-os",
    name: "Petal OS",
    css: ":root { --primary: pink; }",
    installedAt: t,
    createdAt: t,
    updatedAt: t,
    isActive: "false",
    meta: "{}",
  });
  const edit = (await mari.executeAction({
    action: "theme.update",
    id: "starter-petal-os",
    patch: { css: ":root {}" },
    apply: true,
  })) as Result;
  assert.equal(edit.ok, false, "a starter theme is read-only");
  assert.match(String(edit.validation?.errors?.[0]?.message), /Clone \+ Edit/);

  const pick = (await mari.executeAction({ action: "theme.setActive", id: "starter-petal-os", apply: true })) as Result;
  assert.equal(pick.ok, true, "a starter can still be switched on");
});

console.log("Mari theme starters regression passed.");
