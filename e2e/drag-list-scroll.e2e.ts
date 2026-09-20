import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
type Finger = { identifier: number; clientX: number; clientY: number };

async function touch(target: Locator, type: string, touches: Finger[], changedTouches = touches) {
  await target.evaluate(
    (element, eventData) => {
      const event = new Event(eventData.type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: eventData.touches },
        changedTouches: { value: eventData.changedTouches },
      });
      element.dispatchEvent(event);
    },
    { type, touches, changedTouches },
  );
}

for (const kind of ["chat", "character", "persona"] as const) {
  test(`${kind} lists scroll during a drag and persist the folder drop`, async ({ page, request }, testInfo) => {
    const mobile = testInfo.project.name.includes("mobile");
    const endpoint = kind === "chat" ? "/api/chats" : `/api/characters${kind === "persona" ? "/personas" : ""}`;
    const folders =
      kind === "chat" ? "/api/chat-folders" : `/api/characters/${kind === "persona" ? "persona-" : ""}groups`;
    const cleanup: string[] = [];
    const suffix = `${kind}-${Date.now()}`;
    const create = async (url: string, data: unknown) => {
      const response = await request.post(url, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      const result = (await response.json()) as { id: string };
      cleanup.push(`${url}/${result.id}${url === "/api/chats" ? "?force=true" : ""}`);
      return result;
    };
    try {
      const chat = await create("/api/chats", { name: `Active ${suffix}`, mode: "conversation" });
      const folder = await create(folders, { name: `Destination ${suffix}`, mode: "conversation" });
      const entries = [];
      for (let index = 0; index < 26; index++) {
        const name = `${suffix} ${String(index).padStart(2, "0")}`;
        const entry = await create(
          endpoint,
          kind === "character" ? { data: { name } } : { name, mode: "conversation" },
        );
        entries.push({ ...entry, name });
      }
      const item = entries[12]!;
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        sidebarOpen: kind === "chat",
        rightPanelOpen: false,
        theme: mobile ? "dark" : "light",
      });
      await page.addInitScript(
        ({ version, id }) => {
          localStorage.setItem("marinara:whats-new:seen-version", version);
          localStorage.setItem("marinara-active-chat-id", id);
        },
        { version, id: chat.id },
      );
      await page.goto("/");
      if (kind !== "chat") await page.locator(`[data-tour="panel-${kind}s"]`).click();
      const panel = page.locator(
        kind === "chat"
          ? '[data-component="ChatSidebar"]'
          : `[data-component="RightPanel${mobile ? "Mobile" : "Desktop"}"]`,
      );
      const source = panel
        .locator(kind === "chat" ? `[data-chat-id="${item.id}"]` : `[data-touch-drag-card="${kind}"]`)
        .filter({ hasText: item.name });
      await expect(source).toBeVisible();
      const scroller = await source.evaluateHandle((element) => {
        let parent = element.parentElement;
        while (
          parent &&
          !(/auto|scroll/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight)
        )
          parent = parent.parentElement;
        if (!parent) throw new Error("Expected a long, scrollable list");
        parent.scrollTop +=
          element.getBoundingClientRect().top - parent.getBoundingClientRect().top - parent.clientHeight / 2;
        return parent;
      });
      const scrollTop = () => scroller.evaluate((element) => element.scrollTop);
      let startScroll = await scrollTop();
      const handle = source.getByTitle(kind === "chat" ? "Drag chat" : `Drag ${kind}`, { exact: true });
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();
      let primary: Finger = { identifier: 11, clientX: box!.x + box!.width / 2, clientY: box!.y + box!.height / 2 };
      const preview = page.locator(
        `body > [${kind === "chat" ? "data-chat-id" : "data-touch-drag-card"}][aria-hidden="true"]`,
      );
      if (mobile) {
        // Canceling a scrolling finger must keep the held item; canceling its owner must restore the row.
        const originalDraggable = await source.getAttribute("draggable");
        const canceledFinger = { ...primary, identifier: 22, clientX: primary.clientX + 100 };
        await touch(handle, "touchstart", [primary]);
        await expect(preview).toBeVisible();
        await touch(panel, "touchstart", [canceledFinger, primary], [canceledFinger]);
        await touch(panel, "touchcancel", [primary], [canceledFinger]);
        await expect(preview).toBeVisible();
        await touch(panel, "touchcancel", [], [primary]);
        await expect(preview).toHaveCount(0);
        await expect.poll(() => source.getAttribute("draggable")).toBe(originalDraggable);
        await touch(handle, "touchstart", [primary]);
        await expect(preview).toBeVisible();
        const originalTransform = await preview.evaluate((element) => (element as HTMLElement).style.transform);
        let secondary: Finger = { identifier: 22, clientX: primary.clientX + 100, clientY: primary.clientY + 100 };
        await touch(panel, "touchstart", [secondary, primary], [secondary]);
        secondary = { ...secondary, clientY: secondary.clientY - 180 };
        await touch(panel, "touchmove", [secondary, primary], [secondary]);
        await expect.poll(scrollTop).toBeGreaterThan(startScroll + 100);
        expect(await preview.evaluate((element) => (element as HTMLElement).style.transform)).toBe(originalTransform);
        // Lifting the scrolling finger over the chat dock must not assign or drop the held resource.
        const dock = page.locator("[data-chat-resource-mobile-dock]");
        if (kind !== "chat") {
          const dockBox = await dock.boundingBox();
          expect(dockBox).not.toBeNull();
          secondary = { ...secondary, clientX: dockBox!.x + 20, clientY: dockBox!.y + 20 };
        }
        await touch(panel, "touchend", [primary], [secondary]);
        await expect(preview).toBeVisible();
        await expect(panel).toBeVisible();
        // A stationary holding finger near the edge resumes auto-scroll after the scrolling finger leaves.
        const scrollDown = await scroller.evaluate(
          (element) => element.scrollTop + element.clientHeight < element.scrollHeight - 60,
        );
        const edgeFinger = {
          ...primary,
          clientY: await scroller.evaluate(
            (element, down) =>
              down
                ? Math.min(innerHeight, element.getBoundingClientRect().bottom) - 8
                : Math.max(0, element.getBoundingClientRect().top) + 8,
            scrollDown,
          ),
        };
        await touch(panel, "touchstart", [primary, secondary], [secondary]);
        await touch(panel, "touchmove", [edgeFinger, secondary], [edgeFinger]);
        const pausedScroll = await scrollTop();
        await page.waitForTimeout(100);
        expect(await scrollTop()).toBe(pausedScroll);
        await touch(panel, kind === "character" ? "touchcancel" : "touchend", [edgeFinger], [secondary]);
        if (scrollDown) await expect.poll(scrollTop).toBeGreaterThan(pausedScroll + 20);
        else await expect.poll(scrollTop).toBeLessThan(pausedScroll - 20);
        await touch(panel, "touchstart", [primary, secondary], [secondary]);
        secondary = { ...secondary, clientY: secondary.clientY + 5000 };
        await touch(panel, "touchmove", [primary, secondary], [secondary]);
        await expect.poll(scrollTop).toBe(0);
        await touch(panel, "touchend", [primary], [secondary]);
      } else {
        // Escape removes the preview and cancels without moving the row or opening its editor.
        const originalDraggable = await source.getAttribute("draggable");
        await page.mouse.move(primary.clientX, primary.clientY);
        await page.mouse.down();
        await page.mouse.move(primary.clientX + 50, primary.clientY, { steps: 8 });
        await expect(preview).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(preview).toHaveCount(0);
        await page.mouse.up();
        await expect(source).toHaveAttribute("draggable", originalDraggable!);
        // Canceling removes the root drop zone, so scroll anchoring may move this row.
        const restart = await handle.boundingBox();
        expect(restart).not.toBeNull();
        primary = { ...primary, clientX: restart!.x + restart!.width / 2, clientY: restart!.y + restart!.height / 2 };
        startScroll = await scrollTop();
        await page.mouse.move(primary.clientX, primary.clientY);
        await page.mouse.down();
        await page.mouse.move(primary.clientX + 50, primary.clientY, { steps: 8 });
        await expect(preview).toBeVisible();
        await expect(preview).toContainText(item.name);
        await page.mouse.wheel(0, 250);
        await expect.poll(scrollTop).toBeGreaterThan(startScroll + 100);
        await page.mouse.wheel(0, -5000);
        await expect.poll(scrollTop).toBe(0);
      }
      const destination = panel.locator(`[data-${kind}-folder-id="${folder.id}"]`);
      const target = await destination.boundingBox();
      expect(target).not.toBeNull();
      const finalFinger = { ...primary, clientX: target!.x + target!.width / 2, clientY: target!.y + 18 };
      if (mobile) {
        await touch(panel, "touchmove", [finalFinger]);
        await page.screenshot({ path: testInfo.outputPath(`${kind}-drag-scroll.png`) });
        await touch(panel, "touchend", [], [finalFinger]);
        await expect(preview).toHaveCount(0);
      } else {
        await page.mouse.move(finalFinger.clientX, finalFinger.clientY, { steps: 8 });
        await page.screenshot({ path: testInfo.outputPath(`${kind}-drag-scroll.png`) });
        await page.mouse.up();
        await expect(preview).toHaveCount(0);
      }
      await expect
        .poll(async () => {
          if (kind === "chat")
            return (await (await request.get(`${endpoint}/${item.id}`)).json()).folderId === folder.id;
          const groups = await (await request.get(`${folders}/list`)).json();
          const members = groups.find((group: { id: string }) => group.id === folder.id)[`${kind}Ids`];
          return (typeof members === "string" ? JSON.parse(members) : members).includes(item.id);
        })
        .toBe(true);
    } finally {
      await page.mouse.up();
      for (const url of cleanup.reverse()) await request.delete(url);
    }
  });
}
