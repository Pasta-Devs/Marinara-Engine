import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
test.use({ reducedMotion: "reduce" });

for (const theme of ["light", "dark"] as const) {
  test(`World forecast controls sit beside date and time without covering values (${theme})`, async ({
    page,
    request,
  }, info) => {
    const response = await request.post("/api/chats", {
      data: { name: "World controls fixture", mode: "roleplay", characterIds: [] },
    });
    expect(response.ok()).toBeTruthy();
    const chat = await response.json();
    try {
      expect(
        (
          await request.patch(`/api/chats/${chat.id}/metadata`, {
            data: { enableAgents: true, activeAgentIds: ["world-state"] },
          })
        ).ok(),
      ).toBeTruthy();
      expect(
        (
          await request.patch(`/api/chats/${chat.id}/game-state`, {
            data: {
              manual: true,
              location: "A quiet riverside camp",
              time: "Later evening",
              date: "Unknown",
              temperature: "Warm",
              weather: "Dry",
            },
          })
        ).ok(),
      ).toBeTruthy();
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        sidebarOpen: false,
        rightPanelOpen: false,
        trackerPanelEnabled: true,
        trackerPanelOpen: true,
        trackerPanelOpenByChatId: { [chat.id]: true },
        theme,
        appAccentPulseMode: false,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      await page.goto("/");
      const temperature = page.getByRole("button", { name: /^Temperature: Warm/ });
      const weather = page.getByRole("button", { name: /^Weather: Dry/ });
      await expect(temperature).toBeVisible();
      await expect(weather).toBeVisible();
      await page.screenshot({ path: info.outputPath(`world-controls-${theme}.png`) });
      const expectControlBeforeValue = async (field: Locator) => {
        const boxes = await field.evaluate((element) => {
          const control = element.querySelector(":scope > span[aria-hidden='true']")!.getBoundingClientRect();
          const value = element.firstElementChild!.getBoundingClientRect();
          const button = element.getBoundingClientRect();
          return {
            controlLeft: control.left,
            controlRight: control.right,
            valueLeft: value.left,
            buttonLeft: button.left,
            buttonWidth: button.width,
          };
        });
        expect(boxes.controlLeft - boxes.buttonLeft).toBeLessThan(boxes.buttonWidth / 4);
        expect(boxes.controlRight).toBeLessThanOrEqual(boxes.valueLeft);
      };
      await expectControlBeforeValue(temperature);
      await expectControlBeforeValue(weather);
      const timeIcon = await page
        .getByRole("button", { name: /^Time: Later evening/ })
        .locator(":scope > span[aria-hidden='true']")
        .boundingBox();
      const temperatureIcon = await temperature.locator(":scope > span[aria-hidden='true']").boundingBox();
      expect(temperatureIcon!.x).toBeGreaterThan(timeIcon!.x + timeIcon!.width);
      expect(temperatureIcon!.x - timeIcon!.x - timeIcon!.width).toBeLessThan(24);
      await weather.click();
      const input = page.getByRole("textbox", { name: "Weather", exact: true });
      const longWeather = "Dry, with occasional gusts sweeping across the riverside camp";
      await input.fill(longWeather);
      await input.press("Enter");
      const state = async () => (await request.get(`/api/chats/${chat.id}/game-state`)).json();
      await expect.poll(async () => (await state()).weather).toBe(longWeather);
      await expectControlBeforeValue(page.getByRole("button", { name: /^Weather: Dry, with occasional/ }));
      await page.getByRole("button", { name: "Open tracker settings", exact: true }).click();
      await page.getByRole("button", { name: "Enter tracker lock mode", exact: true }).click();
      await expect(page.getByRole("button", { name: "Exit tracker lock mode", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const lockTemperature = page.getByRole("button", { name: "Lock temperature", exact: true });
      await expectControlBeforeValue(lockTemperature);
      await lockTemperature.click();
      const unlockTemperature = page.getByRole("button", { name: "Unlock temperature", exact: true });
      await expect(unlockTemperature).toHaveAttribute("aria-pressed", "true");
      await expectControlBeforeValue(unlockTemperature);
      await expect
        .poll(async () =>
          Object.entries((await state()).fieldLocks ?? {}).some(
            ([key, locked]) => key.endsWith("temperature") && locked === true,
          ),
        )
        .toBe(true);
    } finally {
      await page.close();
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}
