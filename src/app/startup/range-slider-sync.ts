function syncRangeSliderProgress(input: HTMLInputElement) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || 0);
  const span = max - min;
  const percent = Number.isFinite(span) && span > 0 ? ((value - min) / span) * 100 : 0;
  input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, percent))}%`);
}

// Capture the genuine native value descriptor once, at module load, before
// anything can wrap it. Re-installs (HMR, React StrictMode, concurrent remount)
// must never capture an already-wrapped setter as the "original", or a later
// disposer can leave the prototype permanently patched.
const NATIVE_VALUE_DESCRIPTOR = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
const RANGE_SYNC_PATCHED = Symbol("rangeSliderSyncPatched");

type PatchedSetter = ((value: string) => void) & { [RANGE_SYNC_PATCHED]?: true };

// Patch the shared HTMLInputElement value setter so a programmatic value
// assignment on a range input re-syncs its track fill. React updates a
// controlled slider by assigning the existing node's .value with no input/change
// event, so the listeners in installRangeSliderSync never fire. Idempotent and
// self-aware: it won't double-wrap, and its disposer only restores when our
// setter is still the active one (so a later third-party patch isn't clobbered).
function patchRangeValueSetter(): () => void {
  const nativeSetter = NATIVE_VALUE_DESCRIPTOR?.set;
  if (!NATIVE_VALUE_DESCRIPTOR || !nativeSetter) return () => {};

  const activeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as
    | PatchedSetter
    | undefined;
  if (activeSetter?.[RANGE_SYNC_PATCHED]) {
    // Already patched by a prior install that hasn't disposed yet; leave it.
    return () => {};
  }

  const patchedSetter: PatchedSetter = function (this: HTMLInputElement, next: string) {
    nativeSetter.call(this, next);
    if (this.type === "range") {
      syncRangeSliderProgress(this);
    }
  };
  patchedSetter[RANGE_SYNC_PATCHED] = true;

  Object.defineProperty(HTMLInputElement.prototype, "value", {
    ...NATIVE_VALUE_DESCRIPTOR,
    set: patchedSetter,
  });

  return () => {
    const current = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (current === patchedSetter) {
      Object.defineProperty(HTMLInputElement.prototype, "value", NATIVE_VALUE_DESCRIPTOR);
    }
  };
}

export function installRangeSliderSync() {
  const syncAll = () => {
    document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(syncRangeSliderProgress);
  };
  const syncNode = (node: Node) => {
    if (node instanceof HTMLInputElement && node.type === "range") {
      syncRangeSliderProgress(node);
      return;
    }
    if (node instanceof Element) {
      node.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(syncRangeSliderProgress);
    }
  };
  const syncEventTarget = (event: Event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === "range") {
      syncRangeSliderProgress(event.target);
    }
  };

  syncAll();
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(syncNode);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("input", syncEventTarget, true);
  document.addEventListener("change", syncEventTarget, true);
  document.addEventListener("focusin", syncEventTarget, true);
  document.addEventListener("pointerover", syncEventTarget, true);

  const disposeValueSetter = patchRangeValueSetter();

  return () => {
    observer.disconnect();
    document.removeEventListener("input", syncEventTarget, true);
    document.removeEventListener("change", syncEventTarget, true);
    document.removeEventListener("focusin", syncEventTarget, true);
    document.removeEventListener("pointerover", syncEventTarget, true);
    disposeValueSetter();
  };
}
