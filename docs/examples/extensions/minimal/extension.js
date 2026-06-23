(() => {
  window.dispatchEvent(
    new CustomEvent("marinara-extension-ready", {
      detail: { name: "Example Accent Glow" },
    }),
  );
})();
