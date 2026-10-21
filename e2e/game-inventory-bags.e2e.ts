import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { inventoryButton } from "./game-inventory-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * A bag per party member (#6772): the shared view shows who carries each stack, a tab shows one bag,
 * Give hands part of a stack over, and dropping a stack on somebody's tab gives them all of it. Every
 * change is saved by the server and read back from the chat.
 */
async function seedGame(request: APIRequestContext) {
  const created = await request.post("/api/chats", {
    data: { name: "Inventory bags", mode: "game", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  const meta = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: {
      gameId: "inventory-bags-fixture",
      gameSessionStatus: "active",
      gameIntroPresented: true,
      // Bram carries the arrows; the rope is the player's own, as every stack saved before bags is.
      gameInventory: [
        { id: "st-rope", name: "Rope", quantity: 3 },
        { id: "st-arrows", name: "Arrow", quantity: 20, holder: "Bram" },
      ],
    },
  });
  expect(meta.ok()).toBeTruthy();
  const saved = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "assistant", content: "The road forks at a milestone." },
  });
  expect(saved.ok()).toBeTruthy();
  return chat.id;
}

async function openGameChat(page: Page, chatId: string) {
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
}

test("each party member carries their own bag, and stacks are given between them", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90000);
  const chatId = await seedGame(request);
  const savedInventory = async () => {
    const row = await (await request.get(`/api/chats/${chatId}`)).json();
    const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
    return (
      metadata.gameInventory as Array<{ name: string; nickname?: string; quantity: number; holder?: string }>
    ).map(
      (stack) =>
        `${stack.name}${stack.nickname ? ` "${stack.nickname}"` : ""} ${stack.quantity} ${stack.holder ?? "player"}`,
    );
  };
  try {
    await openGameChat(page, chatId);
    await inventoryButton(page).click({ timeout: 30000 });
    const slot = (label: string) => page.getByRole("button", { name: label, exact: true });
    const tab = (name: string) => page.getByRole("button", { name: `${name}'s things`, exact: true });

    // The shared view says who carries each stack.
    await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(slot("Rope x3, carried by Player")).toBeVisible();
    await expect(slot("Arrow x20, carried by Bram")).toBeVisible();

    // One bag at a time.
    await tab("Bram").click();
    await expect(slot("Arrow x20")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Rope/ })).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();

    // Give two of the three ropes to Bram.
    await slot("Rope x3, carried by Player").click();
    await page.getByRole("button", { name: "Give Rope to someone", exact: true }).click();
    await page.getByLabel("Give to").selectOption({ label: "Bram" });
    await page.getByLabel("How many to give (1 to 3)").fill("2");
    await page.screenshot({ path: testInfo.outputPath("inventory-give.png") });
    await page.getByRole("button", { name: "Give", exact: true }).click();
    await expect(slot("Rope x2, carried by Bram")).toBeVisible();
    await expect(slot("Rope, carried by Player")).toBeVisible();
    await expect.poll(savedInventory).toEqual(["Rope 1 player", "Arrow 20 Bram", "Rope 2 Bram"]);

    // Dropping Bram's arrows on the player's tab gives the player all of them.
    const from = await slot("Arrow x20, carried by Bram").boundingBox();
    const to = await tab("Player").boundingBox();
    expect(from && to).toBeTruthy();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x + from!.width / 2 + 10, from!.y + from!.height / 2, { steps: 4 });
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(slot("Arrow x20, carried by Player")).toBeVisible();
    await expect.poll(savedInventory).toEqual(["Rope 1 player", "Arrow 20 player", "Rope 2 Bram"]);

    // Adding by name from a member's tab puts the new item in that member's bag.
    // The bag tabs are content below the protected header. Leaving a toast unpauses its normal dismissal.
    await page.mouse.move(0, 0);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    await tab("Bram").click();
    const newItem = page.getByLabel("Name of the item to add", { exact: true });
    await newItem.fill("Lantern");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(slot("Lantern")).toBeVisible();
    await expect.poll(savedInventory).toEqual(["Rope 1 player", "Arrow 20 player", "Rope 2 Bram", "Lantern 1 Bram"]);

    // A rename is a nickname: the stack is still rope, so adding rope tops it up.
    await slot("Rope x2").click();
    await page.getByLabel("Nickname for Rope", { exact: true }).fill("Climbing rope");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(slot("Climbing rope x2")).toBeVisible();
    await newItem.fill("rope");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(slot("Climbing rope x3")).toBeVisible();
    await expect
      .poll(savedInventory)
      .toEqual(["Rope 1 player", "Arrow 20 player", 'Rope "Climbing rope" 3 Bram', "Lantern 1 Bram"]);
    // Typing the item's own name back clears the nickname (the stack is still selected).
    await page.getByLabel("Nickname for Rope", { exact: true }).fill("rope");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(slot("Rope x3")).toBeVisible();
    await expect.poll(savedInventory).toEqual(["Rope 1 player", "Arrow 20 player", "Rope 3 Bram", "Lantern 1 Bram"]);
    await page.screenshot({ path: testInfo.outputPath("inventory-bags.png") });
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});
