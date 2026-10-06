import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate as nextTurn } from "node:timers/promises";

// Exports must reach the user on iPhone (#7115): share the file right away, or offer a Save file
// toast whose tap is a fresh gesture. Desktop and Android keep their existing save paths.
const { api } = await import("../../packages/client/src/lib/api-client.js");
const { downloadJsonFile } = await import("../../packages/client/src/lib/download-json.js");
const { i18n, translate } = await import("../../packages/client/src/localization/i18n.js");
// The client's own Sonner instance, which holds the toasts the helper shows.
const { toast } = await import("../../packages/client/node_modules/sonner/dist/index.mjs");

const english = JSON.parse(
  readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
);
i18n.addResourceBundle("en", "translation", english);

type ShareOutcome = "success" | "NotAllowedError" | "AbortError";
type Scenario = {
  device: "iphone" | "desktop" | "android";
  share?: ShareOutcome[];
  /** The desktop save dialog: saves, is cancelled, cannot open, or fails writing the chosen file. */
  picker?: "saves" | "cancel" | "blocked" | "write-fails" | "write-cancel";
  bridgeFails?: boolean;
};

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36";

let shares: File[] = [];
let anchors: Array<{ download: string; target: string }> = [];
let pickerNames: string[] = [];
let bridgeFiles: string[][] = [];
let revokeDelays: number[] = [];

function install({ device, share, picker, bridgeFails }: Scenario) {
  shares = [];
  anchors = [];
  pickerNames = [];
  bridgeFiles = [];
  revokeDelays = [];
  toast.dismiss();
  const outcomes = [...(share ?? [])];
  const navigatorStub: Record<string, unknown> = {
    userAgent: device === "iphone" ? IPHONE : device === "android" ? ANDROID : DESKTOP,
    platform: device === "iphone" ? "iPhone" : device === "android" ? "Linux armv8l" : "MacIntel",
    maxTouchPoints: device === "desktop" ? 0 : 5,
  };
  if (share) {
    navigatorStub.canShare = (data: ShareData) => data.files?.length === 1;
    navigatorStub.share = async (data: ShareData) => {
      shares.push(data.files![0]!);
      const outcome = outcomes.shift() ?? "success";
      if (outcome !== "success") throw new DOMException("Share probe", outcome);
    };
  }
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigatorStub });
  const windowStub: Record<string, unknown> = {
    isSecureContext: Boolean(share || picker),
    localStorage: { getItem: () => null },
    btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
    setTimeout: (callback: () => void, delay: number) => {
      revokeDelays.push(delay);
      return 0;
    },
  };
  if (picker) {
    windowStub.showSaveFilePicker = async (options: { suggestedName: string }) => {
      pickerNames.push(options.suggestedName);
      if (picker === "cancel") throw new DOMException("Picker probe", "AbortError");
      if (picker === "blocked") throw new DOMException("Picker probe", "SecurityError");
      return {
        createWritable: async () => ({
          write: async () => {
            if (picker === "write-fails") throw new DOMException("Disk is full", "QuotaExceededError");
            if (picker === "write-cancel") throw new DOMException("Picker probe", "AbortError");
          },
          close: async () => undefined,
        }),
      };
    };
  }
  if (device === "android") {
    windowStub.MarinaraAndroid = {
      saveFile: (...args: string[]) => {
        if (bridgeFails) throw new Error("Bridge probe failed");
        bridgeFiles.push(args);
      },
    };
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: windowStub });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: { appendChild: () => undefined },
      createElement: () => {
        const anchor = { href: "", download: "", target: "", rel: "", click: () => undefined, remove: () => undefined };
        anchor.click = () => anchors.push({ download: anchor.download, target: anchor.target });
        return anchor;
      },
    },
  });
  URL.createObjectURL = () => "blob:export";
  URL.revokeObjectURL = () => {
    revokeDelays.push(0);
  };
  globalThis.fetch = (async () =>
    new Response('{"name":"Marinara"}', {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="Marinara.marinara.json"',
      },
    })) as typeof fetch;
}

type SaveToast = {
  title?: unknown;
  description?: unknown;
  action?: { label: unknown; onClick: (event: unknown) => void };
};

async function saveToast(): Promise<SaveToast | undefined> {
  // The toast copy loads its translations lazily before it appears.
  for (let turn = 0; turn < 20; turn += 1) await nextTurn();
  return (toast.getToasts() as SaveToast[]).find((entry) => entry.title === translate("ui.app.fileSave.ready"));
}

function exportCharacter() {
  return api.download("/characters/marinara/export?format=native");
}

const exportErrors = () =>
  (toast.getToasts() as SaveToast[]).filter((entry) => entry.title === "Couldn't export the file.");

async function tapSaveFile(entry: SaveToast | undefined) {
  assert.ok(entry?.action, "a Save file toast is offered");
  assert.equal(entry.description, "Marinara.marinara.json");
  assert.equal(entry.action.label, "Save file");
  entry.action.onClick({});
  for (let turn = 0; turn < 20; turn += 1) await nextTurn();
}

assert.equal(translate("ui.app.fileSave.ready"), "Your file is ready.");

// iPhone with the share sheet: the export file is shared straight away.
install({ device: "iphone", share: ["success"] });
assert.equal(await exportCharacter(), "saved");
assert.deepEqual(
  shares.map((file) => [file.name, file.type]),
  [["Marinara.marinara.json", "application/json"]],
);
assert.equal(await saveToast(), undefined);
assert.deepEqual(anchors, []);

// Exports built in the tap (JSON and ZIP helpers) share the same way.
install({ device: "iphone", share: ["success"] });
assert.equal(await downloadJsonFile({ name: "Marinara" }, "schedule.json"), "saved");
assert.deepEqual(
  shares.map((file) => file.name),
  ["schedule.json"],
);

// The fetch used up the tap: iOS refuses the share, so a Save file toast offers a fresh one.
install({ device: "iphone", share: ["NotAllowedError", "success"] });
assert.equal(await exportCharacter(), "prompted", "only offering Save file is not a finished save");
await tapSaveFile(await saveToast());
assert.deepEqual(
  shares.map((file) => file.name),
  ["Marinara.marinara.json", "Marinara.marinara.json"],
);
assert.deepEqual(anchors, []);

// Share failing again from the toast never fails silently or opens an app-trapping preview.
install({ device: "iphone", share: ["NotAllowedError", "NotAllowedError"] });
await exportCharacter();
await tapSaveFile(await saveToast());
assert.ok(
  (toast.getToasts() as SaveToast[]).some((entry) => entry.title === "Couldn't save the file."),
  "a failed save shows an error",
);
assert.deepEqual(anchors, []);

// No share sheet (plain http on the LAN): the toast's tap runs the browser download.
install({ device: "iphone" });
assert.equal(await exportCharacter(), "prompted");
assert.deepEqual(anchors, [], "iOS does not start a download outside a tap");
await tapSaveFile(await saveToast());
assert.deepEqual(anchors, [{ download: "Marinara.marinara.json", target: "_blank" }]);
assert.deepEqual(revokeDelays, [60_000], "the download URL outlives the tap");

// Cancelling the share sheet stays silent.
install({ device: "iphone", share: ["AbortError"] });
assert.equal(await exportCharacter(), "cancelled");
assert.equal(shares.length, 1);
assert.equal(await saveToast(), undefined);
assert.deepEqual(anchors, []);

// Desktop: the save dialog when the browser has one, otherwise a download kept alive for 60 s.
install({ device: "desktop", picker: "saves" });
assert.equal(await exportCharacter(), "saved");
assert.deepEqual(pickerNames, ["Marinara.marinara.json"]);
assert.deepEqual(anchors, []);
install({ device: "desktop" });
assert.equal(await exportCharacter(), "saved", "a started download counts as saved");
assert.deepEqual(
  anchors.map((anchor) => anchor.download),
  ["Marinara.marinara.json"],
);
assert.deepEqual(revokeDelays, [60_000]);
install({ device: "desktop" });
assert.equal(await downloadJsonFile({ name: "Marinara" }, "schedule.json"), "saved");
assert.deepEqual(
  anchors.map((anchor) => anchor.download),
  ["schedule.json"],
);
assert.deepEqual(revokeDelays, [60_000], "JSON exports no longer revoke the URL before the download starts");
assert.equal(await saveToast(), undefined);

// Android shell: the native bridge saves the export.
install({ device: "android" });
assert.equal(await exportCharacter(), "saved");
assert.deepEqual(bridgeFiles, [
  [Buffer.from('{"name":"Marinara"}').toString("base64"), "application/json", "Marinara.marinara.json"],
]);
assert.deepEqual(anchors, []);

// Save dialog: cancelling stays silent; a dialog that cannot open falls back to one download; once a file
// was chosen, a write failure is reported once and never starts a second download.
install({ device: "desktop", picker: "cancel" });
assert.equal(await exportCharacter(), "cancelled");
assert.deepEqual(anchors, []);
install({ device: "desktop", picker: "blocked" });
assert.equal(await exportCharacter(), "saved");
assert.deepEqual(
  anchors.map((anchor) => anchor.download),
  ["Marinara.marinara.json"],
);
for (let turn = 0; turn < 20; turn += 1) await nextTurn();
assert.equal(exportErrors().length, 0);
install({ device: "desktop", picker: "write-fails" });
assert.equal(await exportCharacter(), "failed");
assert.deepEqual(anchors, [], "a failed write does not start a second download");
assert.equal(exportErrors().length, 1);
assert.equal(exportErrors()[0]!.description, "Disk is full");
install({ device: "desktop", picker: "write-cancel" });
assert.equal(await exportCharacter(), "cancelled");
assert.deepEqual(anchors, []);
assert.equal(exportErrors().length, 0);

// A save that fails after the download shows exactly one error and reports "failed", so no success follows.
install({ device: "android", bridgeFails: true });
assert.equal(await exportCharacter(), "failed");
assert.equal(exportErrors().length, 1);

// Any failed export (server error, 502 or a dropped connection) shows one plain error and still rejects.
for (const failure of [
  async () => new Response(JSON.stringify({ error: "Character not found" }), { status: 404 }),
  async () => new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" }),
  async () => {
    throw new TypeError("Failed to fetch");
  },
  // The connection drops while the file is still streaming.
  async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"type":"marinara_character"'));
          controller.error(new TypeError("network connection was lost"));
        },
      }),
      { headers: { "Content-Disposition": 'attachment; filename="Marinara.marinara.json"' } },
    ),
]) {
  install({ device: "desktop" });
  globalThis.fetch = failure as typeof fetch;
  await assert.rejects(exportCharacter());
  const errors = exportErrors();
  assert.equal(errors.length, 1, "a failed export shows an error");
  assert.ok(String(errors[0]!.description).length > 0, "the error says what went wrong");
  assert.deepEqual(anchors, []);
}
// A cancelled request is not an error.
install({ device: "desktop" });
globalThis.fetch = (async () => {
  throw new DOMException("Cancelled", "AbortError");
}) as typeof fetch;
await assert.rejects(exportCharacter());
assert.equal(
  (toast.getToasts() as SaveToast[]).some((entry) => entry.title === "Couldn't export the file."),
  false,
);

console.log("Export file save regression passed.");
