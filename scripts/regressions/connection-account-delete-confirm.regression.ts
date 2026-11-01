import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { useDialogStore } from "../../packages/client/src/stores/dialog.store.js";
import { resolveActiveDialog } from "../../packages/client/src/lib/app-dialogs.js";
import { api } from "../../packages/client/src/lib/api-client.js";

// The dialog helper does not render icons. Vite supplies this asset glob in the browser.
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/components/connections/ProviderIcon.tsx")) {
      return { format: "module", source: "export function ProviderIcon() { return null; }", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { confirmAccountDelete } = await import("../../packages/client/src/components/connections/ConnectionRow.js");
hooks.deregister();

const require = createRequire(new URL("../../packages/client/package.json", import.meta.url));
const i18n = require("i18next").createInstance();
await i18n.init({
  lng: "en",
  keySeparator: false,
  resources: {
    en: {
      translation: JSON.parse(
        readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
      ),
    },
  },
});
const originalGet = api.get;
api.get = (async () => ({ chats: [], agents: [], models: [], settings: [] })) as typeof api.get;
try {
  for (const count of [0, 1, 3]) {
    const pending = confirmAccountDelete(
      "Custom",
      Array.from({ length: count }, (_, index) => ({ id: `model-${index}`, name: `Model ${index}` })),
      i18n.t,
    );
    // Model usage lookups complete before the dialog opens.
    await new Promise<void>((resolve) => setImmediate(resolve));
    const dialog = useDialogStore.getState().dialog;
    assert.ok(dialog);
    assert.equal(dialog.kind, "confirm");
    assert.equal(dialog.tone, "destructive");
    assert.equal(
      dialog.message,
      count === 0
        ? "Delete Custom?"
        : count === 1
          ? "Delete Custom? Its 1 model goes too."
          : "Delete Custom? Its 3 models go too.",
    );
    resolveActiveDialog(false);
    assert.equal(await pending, false, "Cancel stops deletion");
  }
} finally {
  api.get = originalGet;
}
console.log("connection account delete confirm regression passed");
