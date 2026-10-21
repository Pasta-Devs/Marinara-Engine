import assert from "node:assert/strict";
import {
  phoneToastTop,
  PHONE_TOAST_TOP_VARIABLE,
  watchPhoneToastTop,
} from "../../packages/client/src/lib/phone-toast-top.js";

// Execute the real placement and watcher with layout/observer stubs. Header changes must move a
// lingering toast before the next paint, without a polling delay or idle work after dismissal.
class ElementStub {
  children: ElementStub[] = [];
  parentElement: ElementStub | null = null;
  constructor(public selector?: string) {}
  matches(selector: string): boolean {
    return this.selector !== undefined && selector.split(",").includes(this.selector);
  }
  querySelector(selector: string): ElementStub | null {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const descendant = child.querySelector(selector);
      if (descendant) return descendant;
    }
    return null;
  }
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
}
let measurements = 0;
function header(
  top: number,
  bottom: number,
  left = 0,
  right = 390,
  visibility = "visible",
  selector = ".mari-window__header",
) {
  const rect = { top, bottom, left, right, width: right - left, height: bottom - top };
  return Object.assign(new ElementStub(selector), {
    rect,
    visibility,
    getBoundingClientRect() {
      measurements += 1;
      return rect;
    },
  });
}

type Header = ReturnType<typeof header>;
const topBar = header(0, 48, 0, 390, "visible", '[data-component="TopBar"]');
const windowHeader = header(100, 150);
const bubbleRow = header(56, 96);
let rows: Header[] = [windowHeader, bubbleRow];
const tacticalToolbar = header(48, 144, 0, 390, "visible", "[data-chat-window-top-obstacle]");
let topObstacles: Header[] = [];
let hasTopBar = true;
let showing = false;
const body = new ElementStub();
const toast = new ElementStub();
const styles = new Map<string, string>();
const host = {
  querySelector: () => (showing ? toast : null),
  contains: (node: unknown) => node === host || node === toast,
  style: {
    getPropertyValue: (name: string) => styles.get(name) ?? "",
    setProperty: (name: string, value: string) => styles.set(name, value),
    removeProperty: (name: string) => styles.delete(name),
  },
};
const resizeListeners = new Set<() => void>();
const mutations: MutationStub[] = [];
class MutationStub {
  target: unknown;
  options?: MutationObserverInit;
  constructor(private callback: MutationCallback) {
    mutations.push(this);
  }
  observe(target: unknown, options: MutationObserverInit) {
    this.target = target;
    this.options = options;
  }
  disconnect() {
    this.target = undefined;
  }
  notify(target: unknown, change: Partial<MutationRecord> = { type: "childList" }) {
    assert.ok(this.target, "only an active observer receives layout changes");
    this.callback(
      [{ addedNodes: [], removedNodes: [], ...change, target } as unknown as MutationRecord],
      this as unknown as MutationObserver,
    );
  }
}
const resizes: ResizeStub[] = [];
class ResizeStub {
  observed = new Set<unknown>();
  constructor(private callback: ResizeObserverCallback) {
    resizes.push(this);
  }
  observe(element: unknown) {
    this.observed.add(element);
  }
  unobserve(element: unknown) {
    this.observed.delete(element);
  }
  disconnect() {
    this.observed.clear();
  }
  notify(element?: unknown) {
    if (element !== undefined) assert.ok(this.observed.has(element), "only an observed element can notify a resize");
    this.callback([], this as unknown as ResizeObserver);
  }
}

Object.defineProperties(globalThis, {
  document: {
    configurable: true,
    value: {
      body,
      querySelector: () => (hasTopBar ? topBar : null),
      querySelectorAll: (selector: string) => [
        ...(selector.includes("TopBar") && hasTopBar ? [topBar] : []),
        ...rows.filter((row) => row.matches(selector)),
        ...(selector.includes("[data-chat-window-top-obstacle]") ? topObstacles : []),
      ],
    },
  },
  window: {
    configurable: true,
    value: {
      innerWidth: 390,
      innerHeight: 844,
      addEventListener: (name: string, listener: () => void) => {
        assert.equal(name, "resize");
        resizeListeners.add(listener);
      },
      removeEventListener: (name: string, listener: () => void) => {
        assert.equal(name, "resize");
        resizeListeners.delete(listener);
      },
    },
  },
  getComputedStyle: { configurable: true, value: (element: Header) => ({ visibility: element.visibility }) },
  Element: { configurable: true, value: ElementStub },
  MutationObserver: { configurable: true, value: MutationStub },
  ResizeObserver: { configurable: true, value: ResizeStub },
});

assert.equal(phoneToastTop(), 158, "headers stack in screen order, independent of DOM order");
rows.push(
  header(140, 400, 0, 390, "hidden"),
  header(140, 400, 0, 390, "collapse"),
  header(140, 400, -100, -10),
  header(140, 400, 400, 500),
  header(-100, -20),
  header(860, 900),
  header(140, 140),
  header(140, 400, 0, 0),
);
assert.equal(phoneToastTop(), 158, "hidden and offscreen headers cannot push a toast offscreen");
rows = [windowHeader, bubbleRow, header(300, 340)];
assert.equal(phoneToastTop(), 158, "a bubble moved away from the top does not extend the header stack");
rows = [];
topObstacles = [tacticalToolbar];
assert.equal(phoneToastTop(), 152, "a measured tactical toolbar extends the top header stack");
tacticalToolbar.rect.bottom = 184;
tacticalToolbar.rect.height = 136;
assert.equal(phoneToastTop(), 192, "wrapped toolbar rows keep top toasts below their controls");
topObstacles = [];
assert.equal(phoneToastTop(), 56, "an empty shell clears the top bar");
hasTopBar = false;
assert.equal(phoneToastTop(), 8, "missing shell elements are safe during a view transition");
hasTopBar = true;
rows = [windowHeader, bubbleRow];

const cleanup = watchPhoneToastTop(host as unknown as HTMLElement);
const hostObserver = mutations.find((observer) => observer.target === host)!;
const layoutObserver = mutations.find((observer) => observer !== hostObserver)!;
const resizeObserver = resizes[0]!;
assert.ok(hostObserver);
assert.equal(layoutObserver.target, undefined, "the app is not observed while no toast exists");
assert.equal(resizeObserver.observed.size, 0);
assert.equal(resizeListeners.size, 0);

showing = true;
hostObserver.notify(host);
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "158px", "a new toast clears current headers immediately");
assert.equal(layoutObserver.target, body);
assert.ok(layoutObserver.options?.subtree && layoutObserver.options.childList);
assert.ok(layoutObserver.options?.attributeFilter?.includes("data-chat-covered"));
assert.equal(resizeListeners.size, 1);
assert.ok(resizeObserver.observed.has(topBar));

const editor = header(56, 210);
const editorContainer = new ElementStub();
editorContainer.children.push(editor);
rows.push(editor);
layoutObserver.notify(body, { type: "childList", addedNodes: [editorContainer] as unknown as NodeList });
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "218px", "opening an editor moves a lingering toast synchronously");
assert.ok(resizeObserver.observed.has(editor), "new headers are observed for later size changes");

const message = new ElementStub();
message.children.push(new ElementStub());
const beforeUnrelatedMutations = measurements;
layoutObserver.notify(body, { type: "childList", addedNodes: [message] as unknown as NodeList });
layoutObserver.notify(body, { type: "childList", removedNodes: [message] as unknown as NodeList });
layoutObserver.notify(message, { type: "attributes", attributeName: "class" });
layoutObserver.notify(message, { type: "attributes", attributeName: "style" });
assert.equal(measurements, beforeUnrelatedMutations, "unrelated body mutations do not measure header geometry");

editor.rect.bottom = 220;
layoutObserver.notify(editor, { type: "attributes", attributeName: "style" });
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "228px", "moving an existing header updates in the same delivery");

editor.rect.bottom = 240;
editor.rect.height = 184;
resizeObserver.notify();
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "248px", "font and header size changes keep controls clear");
editor.visibility = "hidden";
layoutObserver.notify(editorContainer, { type: "attributes", attributeName: "data-chat-covered" });
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "158px", "a covered chat header stops reserving space");

editor.visibility = "visible";
layoutObserver.notify(editorContainer, { type: "attributes", attributeName: "hidden" });
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "248px", "revealing a header ancestor updates immediately");
editor.selector = undefined;
layoutObserver.notify(editor, { type: "attributes", attributeName: "class" });
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "158px", "losing a header selector releases its space immediately");
assert.equal(resizeObserver.observed.has(editor), false, "a former header releases its resize observer");

const beforeToastMutation = measurements;
layoutObserver.notify(toast, { type: "attributes", attributeName: "style" });
assert.equal(measurements, beforeToastMutation, "toast animation does not repeatedly measure the app");
rows = [];
layoutObserver.notify(body, {
  type: "childList",
  removedNodes: [windowHeader, bubbleRow, editorContainer] as unknown as NodeList,
});
assert.deepEqual([...resizeObserver.observed], [topBar], "removed headers release their observers");
topBar.rect.bottom = 60;
for (const listener of resizeListeners) listener();
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "68px", "viewport changes remeasure the shell");

const inventoryHeader = header(50.421875, 99.421875, 13.75, 379.25, "visible", "[data-phone-toast-header]");
const inventory = new ElementStub();
inventory.children.push(inventoryHeader);
inventoryHeader.parentElement = inventory;
rows.push(inventoryHeader);
layoutObserver.notify(body, { type: "childList", addedNodes: [inventory] as unknown as NodeList });
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "107px", "a late Inventory header clears a lingering toast");
assert.ok(resizeObserver.observed.has(inventoryHeader), "the custom Inventory header is observed");
assert.ok(resizeObserver.observed.has(inventory), "the centered panel is observed when its body can move the header");
inventoryHeader.rect.top = 170;
inventoryHeader.rect.bottom = 219;
resizeObserver.notify(inventory);
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "68px", "a short centered panel leaves its header below the stack");
inventoryHeader.rect.top = 50.421875;
inventoryHeader.rect.bottom = 99.421875;
const actions = new ElementStub();
inventory.children.push(actions);
const beforeBodyGrowth = measurements;
layoutObserver.notify(inventory, { type: "childList", addedNodes: [actions] as unknown as NodeList });
assert.ok(measurements > beforeBodyGrowth, "a custom panel's body growth is a relevant mutation");
assert.equal(inventoryHeader.rect.height, 49, "the header moves without changing its own size");
assert.equal(
  styles.get(PHONE_TOAST_TOP_VARIABLE),
  "107px",
  "a growing centered panel moves a settled toast in the same mutation delivery",
);
const actionLabel = new ElementStub();
actions.children.push(actionLabel);
inventoryHeader.rect.top = 56;
inventoryHeader.rect.bottom = 105;
layoutObserver.notify(actions, { type: "childList", addedNodes: [actionLabel] as unknown as NodeList });
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "113px", "nested action-bar additions update synchronously");
inventoryHeader.rect.top = 60;
inventoryHeader.rect.bottom = 109;
layoutObserver.notify(actionLabel, { type: "attributes", attributeName: "class" });
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "117px", "nested action-bar layout changes update synchronously");
const beforeUnrelatedPanelMutations = measurements;
layoutObserver.notify(body, { type: "childList", addedNodes: [message] as unknown as NodeList });
layoutObserver.notify(message, { type: "attributes", attributeName: "style" });
assert.equal(measurements, beforeUnrelatedPanelMutations, "a custom panel does not make unrelated messages relevant");
inventoryHeader.rect.top = 70;
inventoryHeader.rect.bottom = 119;
resizeObserver.notify(inventory);
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "127px", "panel-only resizes still move the unchanged-size header");
inventoryHeader.rect.top = 50.421875;
inventoryHeader.rect.bottom = 120;
inventoryHeader.rect.height = inventoryHeader.rect.bottom - inventoryHeader.rect.top;
resizeObserver.notify();
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "128px", "resizing a custom header keeps Close clear");
rows = [];
layoutObserver.notify(body, { type: "childList", removedNodes: [inventory] as unknown as NodeList });
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "68px", "closing Inventory releases its reserved space");
assert.equal(resizeObserver.observed.has(inventoryHeader), false, "closing Inventory releases its observer");
assert.equal(resizeObserver.observed.has(inventory), false, "closing Inventory releases its panel observer");

showing = false;
hostObserver.notify(host);
assert.equal(layoutObserver.target, undefined);
assert.equal(resizeObserver.observed.size, 0);
assert.equal(resizeListeners.size, 0);
assert.equal(styles.has(PHONE_TOAST_TOP_VARIABLE), false, "dismissal leaves no offset or active layout work");

showing = true;
hostObserver.notify(host);
assert.equal(styles.get(PHONE_TOAST_TOP_VARIABLE), "68px", "a later toast restarts observation");
cleanup();
assert.equal(hostObserver.target, undefined);
assert.equal(layoutObserver.target, undefined);
assert.equal(resizeObserver.observed.size, 0);
assert.equal(resizeListeners.size, 0);
assert.equal(styles.has(PHONE_TOAST_TOP_VARIABLE), false, "unmount removes the offset and every observer");
