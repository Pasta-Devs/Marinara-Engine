import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { useDialogStore } from "../../packages/client/src/stores/dialog.store.js";
import { resolveActiveDialog } from "../../packages/client/src/lib/app-dialogs.js";
import { api } from "../../packages/client/src/lib/api-client.js";
import { groupModelsByAccount } from "../../packages/client/src/lib/connection-groups.js";

// The dialog helper does not render icons. Vite supplies this asset glob in the browser.
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/components/connections/ProviderIcon.tsx")) {
      return { format: "module", source: "export function ProviderIcon() { return null; }", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { confirmAccountDelete, deleteAccountModels, loadAccountDeletionRows } =
  await import("../../packages/client/src/components/connections/ConnectionRow.js");
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
const originalDelete = api.delete;
const deleted: string[] = [];
const owned = [
  { id: "anchor", name: "Setup row", model: "", provider: "openai", accountId: "target" },
  {
    id: "borrowed",
    name: "Borrowed row",
    model: "decision",
    accountId: "target",
    credentialsFromConnectionId: "other",
  },
  { id: "other", name: "Other row", model: "chat", accountId: "other-account" },
];
api.get = (async (path: string) =>
  path === "/connections" ? owned : { chats: [], agents: [], models: [], settings: [] }) as typeof api.get;
api.delete = (async (path: string) => {
  deleted.push(path);
}) as typeof api.delete;
try {
  const visible = groupModelsByAccount(owned, [
    { id: "target", name: "Target" } as never,
    { id: "other-account", name: "Other" } as never,
  ]);
  assert.deepEqual(visible.groups[0]?.rows, [], "the anchor is hidden and the borrower follows its lender");
  const deletionRows = await loadAccountDeletionRows("target");
  assert.deepEqual(
    deletionRows.map((row) => row.id),
    ["anchor", "borrowed"],
  );
  const ownedConfirm = confirmAccountDelete("Target", deletionRows, i18n.t);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.match(useDialogStore.getState().dialog?.message ?? "", /Saved rows to delete: Setup row, Borrowed row/);
  resolveActiveDialog(false);
  assert.equal(await ownedConfirm, false);
  assert.deepEqual(deleted, [], "cancel leaves all saved rows intact");

  const approved = confirmAccountDelete("Target", deletionRows, i18n.t);
  await new Promise<void>((resolve) => setImmediate(resolve));
  resolveActiveDialog(true);
  assert.equal(await approved, true);
  await deleteAccountModels(deletionRows);
  assert.deepEqual(deleted, ["/connections/anchor", "/connections/borrowed"]);

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
          ? "Delete Custom? Its 1 model goes too.\nSaved rows to delete: Model 0"
          : "Delete Custom? Its 3 models go too.\nSaved rows to delete: Model 0, Model 1, Model 2",
    );
    resolveActiveDialog(false);
    assert.equal(await pending, false, "Cancel stops deletion");
  }
} finally {
  api.get = originalGet;
  api.delete = originalDelete;
}
console.log("connection account delete confirm regression passed");
