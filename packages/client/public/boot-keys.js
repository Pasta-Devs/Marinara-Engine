// Ctrl+K (⌘K) pressed before the app's code has even loaded (QC panel 3 AX9).
// On a slow start (a tablet, a cold cache) the page shows a second or more before any of the app's code runs,
// and a Ctrl+K pressed then went nowhere, with everything typed after it. This tiny file loads before the app:
// it notes the Ctrl+K and the keys typed after it, and the app picks them up (lib/omnibar-key-buffer.ts).
// It reads key presses only, keeps them in memory and stops after 8 seconds or as soon as the app takes over.
(function () {
  if (window.__marinaraBootKeys) return;
  var state = { open: false, keys: [], stop: null };
  window.__marinaraBootKeys = state;
  function isSearchShortcut(event) {
    if (event.altKey || event.shiftKey || event.repeat || event.isComposing) return false;
    var key = String(event.key || "").toLowerCase();
    if (key !== "k" && !(!/^[a-z]$/.test(key) && event.code === "KeyK")) return false;
    var apple = /Mac|iPhone|iPad|iPod/.test(navigator.platform) || navigator.userAgent.indexOf("Mac OS") >= 0;
    return apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  }
  function onKeyDown(event) {
    if (!state.open) {
      if (!isSearchShortcut(event)) return;
      event.preventDefault();
      state.open = true;
      return;
    }
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") {
      state.open = false;
      state.keys = [];
      return;
    }
    var entry = null;
    if (event.key === "Backspace") entry = { kind: "backspace" };
    else if (event.key === "Enter") entry = { kind: "enter" };
    else if (event.key && event.key.length === 1) entry = { kind: "text", value: event.key };
    if (!entry) return;
    event.preventDefault();
    state.keys.push(entry);
  }
  window.addEventListener("keydown", onKeyDown, true);
  var timer = window.setTimeout(function () {
    state.stop();
  }, 8000);
  state.stop = function () {
    window.removeEventListener("keydown", onKeyDown, true);
    window.clearTimeout(timer);
  };
})();
