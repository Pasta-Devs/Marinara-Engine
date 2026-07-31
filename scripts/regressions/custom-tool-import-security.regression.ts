import assert from "node:assert/strict";
import {
  importCustomToolEntries,
  normalizeCustomToolImportEntry,
  prepareCustomToolImportEntry,
  serializeCustomToolForTransfer,
} from "../../packages/client/src/lib/custom-tool-transfer.js";

const requestedWebhook = {
  name: "send_private_context",
  description: "Send private context to a remote service",
  executionType: "webhook",
  webhookUrl: "https://user:password@example.com:8443/private/collect?token=secret",
  includeHiddenContext: true,
  enabled: true,
};

const preparedWebhook = prepareCustomToolImportEntry(requestedWebhook);
assert.ok(preparedWebhook);
assert.equal(preparedWebhook.config.enabled, false, "imported webhooks must never preserve enabled state");
assert.equal(
  preparedWebhook.config.includeHiddenContext,
  false,
  "imported webhooks must never preserve hidden-context access",
);
assert.deepEqual(preparedWebhook.review, {
  name: "send_private_context",
  executionType: "webhook",
  destinationOrigin: "https://example.com:8443",
  requestedEnabled: true,
  requestedHiddenContext: true,
});
assert.doesNotMatch(
  JSON.stringify(preparedWebhook.review),
  /password|private\/collect|token=secret/,
  "the review summary must not expose URL credentials, paths, queries, or fragments",
);

const normalizedWebhook = normalizeCustomToolImportEntry(requestedWebhook);
assert.ok(normalizedWebhook);
assert.equal(normalizedWebhook.enabled, false);
assert.equal(normalizedWebhook.includeHiddenContext, false);

const invalidWebhook = prepareCustomToolImportEntry({
  ...requestedWebhook,
  name: "invalid_webhook",
  webhookUrl: "not a URL",
});
assert.ok(invalidWebhook);
assert.equal(invalidWebhook.review?.destinationOrigin, null);

const staticTool = normalizeCustomToolImportEntry({
  name: "static_lookup",
  description: "Return trusted static content",
  executionType: "static",
  staticResult: "safe",
  includeHiddenContext: true,
  enabled: true,
});
assert.ok(staticTool);
assert.equal(staticTool.enabled, true, "non-webhook imports must retain their existing enabled behavior");
assert.equal(staticTool.includeHiddenContext, true);

const created: Record<string, unknown>[] = [];
const importResult = await importCustomToolEntries(
  [
    {
      raw: requestedWebhook,
      path: "functions.json",
      basePath: "",
      resolveTextFile: () => null,
    },
    {
      raw: staticTool,
      path: "functions.json",
      basePath: "",
      resolveTextFile: () => null,
    },
  ],
  {
    mutateAsync: async (data) => {
      created.push(data);
      return data;
    },
  },
);
assert.equal(importResult.imported, 2);
assert.equal(importResult.failed.length, 0);
assert.equal(importResult.reviews.length, 1, "only imported webhooks need a privilege review");
assert.equal(created[0]?.enabled, false);
assert.equal(created[0]?.includeHiddenContext, false);

const localWebhookExport = serializeCustomToolForTransfer({
  id: "local-tool",
  name: "local_webhook",
  description: "Locally configured webhook",
  parametersSchema: "{}",
  executionType: "webhook",
  webhookUrl: "https://example.com/hook",
  staticResult: null,
  scriptBody: null,
  includeHiddenContext: "true",
  enabled: "true",
  sortOrder: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});
assert.equal(localWebhookExport.enabled, true, "local tool state must remain exportable");
assert.equal(localWebhookExport.includeHiddenContext, true, "local hidden-context choices must remain exportable");

console.info("Custom tool import security regressions passed.");
