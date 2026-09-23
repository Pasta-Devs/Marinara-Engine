import { expect, test } from "@playwright/test";

test("clicking a worker notification focuses Marinara or opens it when no window remains", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const source = await (await fetch("/notification-events.js")).text();
    let click: (event: unknown) => void;
    const actions: string[] = [];
    let windows = [
      {
        url: location.origin + "/",
        focus: async () => {
          actions.push("focus");
        },
      },
    ];
    const worker = {
      location: { origin: location.origin },
      addEventListener: (_type: string, handler: typeof click) => {
        click = handler;
      },
      clients: {
        matchAll: async () => windows,
        openWindow: async (path: string) => {
          actions.push("open:" + path);
        },
      },
    };
    new Function("self", source)(worker);
    const activate = async () => {
      let pending: Promise<unknown> | undefined;
      click!({
        notification: { close: () => actions.push("close") },
        waitUntil: (promise: Promise<unknown>) => {
          pending = promise;
        },
      });
      await pending;
    };
    await activate();
    windows = [];
    await activate();
    return actions;
  });
  expect(result).toEqual(["close", "focus", "close", "open:/"]);
});

test("browser alerts use the active worker, alert again for each reply and fall back safely", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { showLocalMessageNotification } = await import("/src/lib/local-notifications.ts" as string);
    let focused = false;
    let permission = "granted";
    let throwConstructor = true;
    let throwWorker = false;
    let workerActive = true;
    let focusDuringLookup = false;
    let focusDuringFailure = false;
    const deliveries: Array<{ channel: string; title: string; options: { tag?: string; renotify?: boolean } }> = [];
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => focused });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: class {
        static get permission() {
          return permission;
        }
        constructor(title: string, options: { tag?: string; renotify?: boolean }) {
          if (throwConstructor) throw new TypeError("Use ServiceWorkerRegistration.showNotification instead");
          deliveries.push({ channel: "desktop", title, options });
        }
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        // No .ready promise: no worker must fall back without waiting indefinitely.
        getRegistration: async () => {
          if (focusDuringLookup) focused = true;
          return workerActive
            ? {
                active: {},
                showNotification: async (title: string, options: { tag?: string; renotify?: boolean }) => {
                  if (throwWorker) {
                    if (focusDuringFailure) focused = true;
                    throw new Error("Worker delivery unavailable");
                  }
                  deliveries.push({ channel: "worker", title, options });
                },
              }
            : undefined;
        },
      },
    });
    const notify = (enabled = true) => showLocalMessageNotification({ enabled, characterName: "Alice", tag: "chat-1" });
    const outcomes = [await notify(), await notify()];
    focused = true;
    outcomes.push(await notify());
    focused = false;
    outcomes.push(await notify(false));
    permission = "denied";
    outcomes.push(await notify());
    permission = "granted";
    workerActive = false;
    throwConstructor = false;
    outcomes.push(await notify());
    workerActive = true;
    throwWorker = true;
    outcomes.push(await notify());
    throwConstructor = true;
    outcomes.push(await notify());
    throwConstructor = false;
    throwWorker = false;
    focusDuringLookup = true;
    outcomes.push(await notify());
    focused = false;
    workerActive = false;
    outcomes.push(await notify());
    focused = false;
    workerActive = true;
    focusDuringLookup = false;
    throwWorker = true;
    focusDuringFailure = true;
    outcomes.push(await notify());
    return { outcomes, deliveries };
  });
  expect(result.outcomes).toEqual([true, true, false, false, false, true, true, false, false, false, false]);
  expect(result.deliveries.map((delivery) => delivery.channel)).toEqual(["worker", "worker", "desktop", "desktop"]);
  for (const delivery of result.deliveries) {
    expect(delivery.title).toBe("New message from Alice");
    expect(delivery.options).toMatchObject({ tag: "chat-1", renotify: true });
  }
});
