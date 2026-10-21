import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { inventoryButton } from "./game-inventory-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * A stack of 300 changed without 300 clicks (#6759): split into a chosen size, a typed amount, a
 * merge by dropping one stack on the other, and emptying a stack only after the player says yes.
 * The saved inventory starts in the shape every game saved before stacks had ids, so the first
 * change is also the one that gives it ids.
 */
async function seedGame(request: APIRequestContext) {
  const created = await request.post("/api/chats", {
    data: { name: "Inventory stacks", mode: "game", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  const meta = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: {
      gameId: "inventory-stacks-fixture",
      gameSessionStatus: "active",
      gameIntroPresented: true,
      gameInventory: [{ name: "Apple", quantity: 300 }],
    },
  });
  expect(meta.ok()).toBeTruthy();
  const saved = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "assistant", content: "An orchard stretches down the hill." },
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

test("an inventory stack changes by any amount, splits into a chosen size and merges back", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90000);
  const chatId = await seedGame(request);
  const savedInventory = async () => {
    const row = await (await request.get(`/api/chats/${chatId}`)).json();
    const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
    return metadata.gameInventory as Array<{ id?: string; name: string; quantity: number }>;
  };
  try {
    await openGameChat(page, chatId);
    await inventoryButton(page).click({ timeout: 30000 });
    const slot = (label: string) => page.getByRole("button", { name: label, exact: true });

    // Split 100 off the 300: two stacks, and nothing gained or lost.
    await slot("Apple x300").click();
    await page.getByRole("button", { name: "Split Apple", exact: true }).click();
    await page.getByLabel("How many go into the new stack? (1 to 299)").fill("100");
    await page.screenshot({ path: testInfo.outputPath("inventory-split.png") });
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await expect(slot("Apple x200")).toBeVisible();
    await expect(slot("Apple x100")).toBeVisible();
    await expect.poll(async () => (await savedInventory()).map((stack) => stack.quantity)).toEqual([200, 100]);
    const [first, second] = await savedInventory();
    expect(first!.id && second!.id && first!.id !== second!.id, "two stacks, told apart by id").toBeTruthy();

    // A typed amount: "+50" adds fifty to the stack that is selected, and only to it.
    await slot("Apple x100").click();
    const amount = page.getByLabel("Apple amount", { exact: true });
    await amount.fill("+50");
    await amount.press("Enter");
    await expect(slot("Apple x150")).toBeVisible();
    await expect(slot("Apple x200")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("inventory-stacks.png") });

    // Dropping one stack on the other of the same item makes them one again.
    // These slots are content below the protected header; let the ordinary success toast dismiss.
    await page.mouse.move(0, 0);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    const from = await slot("Apple x150").boundingBox();
    const to = await slot("Apple x200").boundingBox();
    expect(from && to).toBeTruthy();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x + from!.width / 2 + 10, from!.y + from!.height / 2, { steps: 4 });
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(slot("Apple x350")).toBeVisible();
    await expect.poll(async () => (await savedInventory()).map((stack) => stack.quantity)).toEqual([350]);

    // Emptying a stack asks first: declined, the stack stays; accepted, it is gone.
    await slot("Apple x350").click();
    page.once("dialog", (dialog) => void dialog.dismiss());
    await amount.fill("0");
    await amount.press("Enter");
    await expect(slot("Apple x350")).toBeVisible();
    // Asked once: the field losing focus while it saves never asks, or empties, a second time.
    let asked = 0;
    const accept = (dialog: { accept: () => Promise<void> }) => {
      asked += 1;
      void dialog.accept();
    };
    page.on("dialog", accept);
    await amount.fill("0");
    await amount.press("Enter");
    await expect(page.getByText("Inventory empty")).toBeVisible();
    await expect.poll(async () => (await savedInventory()).length).toBe(0);
    page.off("dialog", accept);
    expect(asked).toBe(1);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});
