import { clickTopbarPanel } from "./topbar-navigation.js";
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
      const entries: { id: string; name: string }[] = [];
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
      if (kind !== "chat") await clickTopbarPanel(page, `${kind}s`);
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
      await expect(source.locator("[data-folder-drag-handle]")).toHaveCount(0);
      const handle = source;

      const box = await handle.boundingBox();
      expect(box).not.toBeNull();
      let primary: Finger = { identifier: 11, clientX: box!.x + box!.width * 0.45, clientY: box!.y + box!.height / 2 };
      const preview = page.locator(
        `body > [${kind === "chat" ? "data-chat-id" : "data-touch-drag-card"}][aria-hidden="true"]`,
      );
      if (testInfo.project.name === "mobile-chromium") {
        // Real browser input proves that scroll gestures are not stolen before pickup.
        const cdp = await page.context().newCDPSession(page);
        const point = { id: 0, x: primary.clientX, y: primary.clientY };
        const beforeSwipe = await scrollTop();
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
        for (let step = 1; step <= 5; step++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...point, y: point.y - step * 20 }],
          });
          await page.waitForTimeout(20);
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await expect.poll(scrollTop).toBeGreaterThan(beforeSwipe + 30);
        await expect(preview).toHaveCount(0);
        await scroller.evaluate((element, value) => {
          element.scrollTop = value;
        }, beforeSwipe);
        const holdBox = await source.boundingBox();
        expect(holdBox).not.toBeNull();
        const heldPoint = { id: 0, x: holdBox!.x + holdBox!.width * 0.45, y: holdBox!.y + holdBox!.height / 2 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [heldPoint] });
        await expect(preview).toBeVisible();
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ ...heldPoint, x: heldPoint.x + 25 }],
        });
        await expect(preview).toBeVisible();
        const realStackRow = panel
          .locator(kind === "chat" ? `[data-chat-id="${entries[13]!.id}"]` : `[data-touch-drag-card="${kind}"]`)
          .filter({ hasText: entries[13]!.name });
        const realStackBox = await realStackRow.boundingBox();
        expect(realStackBox).not.toBeNull();
        const secondPoint = {
          id: 1,
          x: realStackBox!.x + realStackBox!.width * 0.45,
          y: realStackBox!.y + realStackBox!.height / 2,
        };
        const movedHeldPoint = { ...heldPoint, x: heldPoint.x + 25 };
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [movedHeldPoint, secondPoint] });
        // CDP cannot release one finger independently; finish the native second-finger
        // start with a DOM release while retaining the native holding finger.
        await touch(
          realStackRow,
          "touchend",
          [
            {
              identifier: movedHeldPoint.id,
              clientX: movedHeldPoint.x,
              clientY: movedHeldPoint.y,
            },
          ],
          [
            {
              identifier: secondPoint.id,
              clientX: secondPoint.x,
              clientY: secondPoint.y,
            },
          ],
        );
        await expect(preview.locator("[data-drag-stack-count]")).toHaveText("2");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
        await expect(preview).toHaveCount(0);
        await cdp.detach();
        const restart = await source.boundingBox();
        expect(restart).not.toBeNull();
        primary = {
          ...primary,
          clientX: restart!.x + restart!.width * 0.45,
          clientY: restart!.y + restart!.height / 2,
        };
      }
      if (mobile) {
        // A swipe before the hold expires must stay a scroll gesture, with no pickup.
        const pendingDraggable = await source.getAttribute("draggable");
        await touch(source, "touchstart", [primary]);
        await touch(source, "touchmove", [{ ...primary, clientY: primary.clientY - 60 }]);
        await touch(source, "touchend", [], [{ ...primary, clientY: primary.clientY - 60 }]);
        await page.waitForTimeout(500);
        await expect(preview).toHaveCount(0);
        await expect.poll(() => source.getAttribute("draggable")).toBe(pendingDraggable);
        // Canceling a scrolling finger must keep the held item; canceling its owner must restore the row.
        const originalDraggable = await source.getAttribute("draggable");
        const canceledFinger = { ...primary, identifier: 22, clientX: primary.clientX + 100 };
        await touch(handle, "touchstart", [primary]);
        await expect(preview).toBeVisible();
        await touch(panel, "touchstart", [canceledFinger, primary], [canceledFinger]);
        await touch(panel, "touchcancel", [primary], [canceledFinger]);
        await expect(preview).toBeVisible();
        const cancelStackRow = panel
          .locator(kind === "chat" ? `[data-chat-id="${entries[13]!.id}"]` : `[data-touch-drag-card="${kind}"]`)
          .filter({ hasText: entries[13]!.name });
        const cancelStackBox = await cancelStackRow.boundingBox();
        expect(cancelStackBox).not.toBeNull();
        const tapFinger = {
          identifier: 33,
          clientX: cancelStackBox!.x + cancelStackBox!.width * 0.45,
          clientY: cancelStackBox!.y + cancelStackBox!.height / 2,
        };
        await touch(cancelStackRow, "touchstart", [primary, tapFinger], [tapFinger]);
        await touch(cancelStackRow, "touchend", [primary], [tapFinger]);
        await expect(preview.locator("[data-drag-stack-count]")).toHaveText("2");
        await touch(panel, "touchcancel", [], [primary]);
        await expect(preview).toHaveCount(0);
        await expect(panel.locator("[data-drag-stacked]")).toHaveCount(0);
        await expect.poll(() => source.getAttribute("draggable")).toBe(originalDraggable);
        // Canceling removes the root drop zone; anchoring can move the row on mobile too.
        const restart = await handle.boundingBox();
        expect(restart).not.toBeNull();
        primary = {
          ...primary,
          clientX: restart!.x + restart!.width * 0.45,
          clientY: restart!.y + restart!.height / 2,
        };
        await touch(handle, "touchstart", [primary]);
        await expect(preview).toBeVisible();
        startScroll = await scrollTop();
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
        // Pause from empty chrome: a stationary second finger on a row is now a gather tap.
        secondary = { ...secondary, clientX: 0, clientY: 0 };
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
        // Escape removes the preview and cancels without moving the row or opening its editor,
        // and without also closing the list's panel.
        const originalDraggable = await source.getAttribute("draggable");
        await page.mouse.move(primary.clientX, primary.clientY);
        await page.mouse.down();
        await page.mouse.move(primary.clientX + 50, primary.clientY, { steps: 8 });
        await expect(preview).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(preview).toHaveCount(0);
        // A closed panel stays mounted but hidden (aria-hidden and inert), so check that nothing hid it.
        await expect(panel.locator("xpath=ancestor-or-self::*[@aria-hidden='true']")).toHaveCount(0);
        await page.mouse.up();
        await expect(source).toHaveAttribute("draggable", originalDraggable!);
        // Wait for the row to settle after removing the root drop zone before sampling coordinates.
        await handle.hover();
        const restart = await handle.boundingBox();
        expect(restart).not.toBeNull();
        primary = {
          ...primary,
          clientX: restart!.x + restart!.width * 0.45,
          clientY: restart!.y + restart!.height / 2,
        };
        startScroll = await scrollTop();
        await page.mouse.move(primary.clientX, primary.clientY);
        await page.mouse.down();
        await page.mouse.move(primary.clientX + 50, primary.clientY, { steps: 8 });
        await expect(preview).toBeVisible();
        await expect(preview).toContainText(item.name);
        startScroll = await scrollTop();
        await page.mouse.wheel(0, 250);
        await expect.poll(scrollTop).toBeGreaterThan(startScroll + 100);
        await page.mouse.wheel(0, -5000);
        await expect.poll(scrollTop).toBe(0);
      }
      if (mobile) {
        const stackRow = panel
          .locator(kind === "chat" ? `[data-chat-id="${entries[0]!.id}"]` : `[data-touch-drag-card="${kind}"]`)
          .filter({ hasText: entries[0]!.name });
        await stackRow.scrollIntoViewIfNeeded();
        const stackBox = await stackRow.boundingBox();
        expect(stackBox).not.toBeNull();
        const secondary = {
          identifier: 22,
          clientX: stackBox!.x + stackBox!.width * 0.45,
          clientY: stackBox!.y + stackBox!.height / 2,
        };
        for (let tap = 0; tap < 2; tap++) {
          await touch(stackRow, "touchstart", [primary, secondary], [secondary]);
          await touch(stackRow, "touchend", [primary], [secondary]);
        }
        // A repeated tap cannot add the same item twice; neither tap opens its editor.
        await expect(preview.locator("[data-drag-stack-count]")).toHaveText("2");
        await expect(stackRow).toHaveAttribute("data-drag-stacked", "true");
        await expect(page.locator(".mari-editor-shell")).toHaveCount(0);
        await scroller.evaluate((element) => {
          element.scrollTop = 0;
        });
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
      if (mobile) {
        await expect(panel.locator("[data-drag-stacked]")).toHaveCount(0);
        await expect
          .poll(async () => {
            if (kind === "chat")
              return (await (await request.get(`${endpoint}/${entries[0]!.id}`)).json()).folderId === folder.id;
            const groups = await (await request.get(`${folders}/list`)).json();
            const members = groups.find((group: { id: string }) => group.id === folder.id)[`${kind}Ids`];
            return (typeof members === "string" ? JSON.parse(members) : members).includes(entries[0]!.id);
          })
          .toBe(true);
      }
      await page.screenshot({ path: testInfo.outputPath(`${kind}-handleless-list.png`) });
      if (!mobile) {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.screenshot({ path: testInfo.outputPath(`${kind}-handleless-tablet.png`) });
      }
    } finally {
      await page.mouse.up();
      for (const url of cleanup.reverse()) await request.delete(url);
    }
  });
}

test("reordering accepts a drop in the opened insertion gap", async ({ page, request }, testInfo) => {
  const ids: string[] = [];
  const mobile = testInfo.project.name.includes("mobile");
  try {
    for (const name of ["A", "B", "C"]) {
      const response = await request.post("/api/characters", { data: { data: { name: `Gap ${name} ${Date.now()}` } } });
      expect(response.ok()).toBeTruthy();
      ids.push((await response.json()).id);
    }
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(
      page,
      {
        hasCompletedOnboarding: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        sidebarOpen: false,
        rightPanelOpen: false,
        libraryManualOrders: { character: { active: true, ids } },
      },
      "if-missing",
    );
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    await clickTopbarPanel(page, "characters");
    const panel = page.locator(`[data-component="RightPanel${mobile ? "Mobile" : "Desktop"}"]`);
    const source = panel.locator(`[data-drag-id="${ids[2]}"]`);
    const target = panel.locator(`[data-drag-id="${ids[1]}"]`);
    const box = await source.boundingBox();
    expect(box).not.toBeNull();
    const finger: Finger = { identifier: 61, clientX: box!.x + box!.width / 2, clientY: box!.y + box!.height / 2 };
    if (mobile) {
      await touch(source, "touchstart", [finger]);
      await expect(page.locator('body > [data-drag-kind="character"][aria-hidden="true"]')).toBeVisible();
    } else {
      await page.mouse.move(finger.clientX, finger.clientY);
      await page.mouse.down();
      await page.mouse.move(finger.clientX + 15, finger.clientY);
    }
    const destination = await target.boundingBox();
    finger.clientX = destination!.x + destination!.width / 2;
    finger.clientY = destination!.y + 2;
    if (mobile) await touch(source, "touchmove", [finger]);
    else await page.mouse.move(finger.clientX, finger.clientY);
    await expect(target).toHaveAttribute("data-drag-insert", "before");
    await page.waitForTimeout(200);
    const opened = await target.boundingBox();
    finger.clientY = opened!.y - 12;
    if (mobile) await touch(source, "touchmove", [finger]);
    else await page.mouse.move(finger.clientX, finger.clientY);
    await expect(target).toHaveAttribute("data-drag-insert", "before");
    await expect(target).toHaveCSS("margin-block-start", "24px");
    await page.screenshot({ path: testInfo.outputPath("expanded-insertion-gap.png") });
    if (mobile) await touch(source, "touchend", [], [finger]);
    else await page.mouse.up();
    await expect
      .poll(async () =>
        panel
          .locator('[data-drag-kind="character"]')
          .evaluateAll(
            (rows, ids) => rows.map((row) => (row as HTMLElement).dataset.dragId).filter((id) => ids.includes(id!)),
            ids,
          ),
      )
      .toEqual([ids[0], ids[2], ids[1]]);
    if (!mobile) {
      await page.setViewportSize({ width: 768, height: 900 });
      await page.screenshot({ path: testInfo.outputPath("reordered-tablet.png") });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await page.reload();
    if (mobile) {
      await expect(page.locator("[data-topbar-more]")).toBeVisible();
      if (!(await panel.isVisible())) await clickTopbarPanel(page, "characters");
    }
    await expect(panel).toBeVisible();
    await expect
      .poll(async () =>
        page
          .locator('[data-drag-kind="character"]:visible')
          .evaluateAll(
            (rows, ids) => rows.map((row) => (row as HTMLElement).dataset.dragId).filter((id) => ids.includes(id!)),
            ids,
          ),
      )
      .toEqual([ids[0], ids[2], ids[1]]);
  } finally {
    for (const id of ids) await request.delete(`/api/characters/${id}`);
  }
});

test("connection folder row dragging saves the server order and sort mode", async ({ page, request }, testInfo) => {
  const ids: string[] = [];
  try {
    for (const label of ["A", "B", "C"]) {
      const response = await request.post("/api/connection-folders", {
        data: { name: `Folder ${label} ${Date.now()}` },
      });
      expect(response.ok()).toBeTruthy();
      ids.push((await response.json()).id);
    }
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    await page.goto("/");
    await clickTopbarPanel(page, "connections");
    const mobile = testInfo.project.name.includes("mobile");
    const panel = page.locator(`[data-component="RightPanel${mobile ? "Mobile" : "Desktop"}"]`);
    const source = panel.locator(`[data-drag-id="${ids[2]}"]`);
    const target = panel.locator(`[data-drag-id="${ids[1]}"]`);
    const box = (await source.boundingBox())!;
    const finger: Finger = { identifier: 81, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    if (mobile) {
      await touch(source, "touchstart", [finger]);
      await expect(page.locator('body > [data-drag-kind="connection-folder"][aria-hidden="true"]')).toBeVisible();
    } else {
      await page.mouse.move(finger.clientX, finger.clientY);
      await page.mouse.down();
      await page.mouse.move(finger.clientX + 15, finger.clientY);
    }
    const destination = (await target.boundingBox())!;
    finger.clientX = destination.x + destination.width / 2;
    finger.clientY = destination.y + 2;
    if (mobile) await touch(source, "touchmove", [finger]);
    else await page.mouse.move(finger.clientX, finger.clientY);
    await expect(target).toHaveAttribute("data-drag-insert", "before");
    if (mobile) await touch(source, "touchend", [], [finger]);
    else await page.mouse.up();
    await expect(panel.getByRole("combobox").last()).toHaveValue("custom");
    await expect
      .poll(async () => {
        const folders = await (await request.get("/api/connection-folders")).json();
        return folders
          .filter((folder: { id: string }) => ids.includes(folder.id))
          .sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder)
          .map((folder: { id: string }) => folder.id);
      })
      .toEqual([ids[0], ids[2], ids[1]]);
  } finally {
    await page.mouse.up();
    for (const id of ids) await request.delete(`/api/connection-folders/${id}`);
  }
});
