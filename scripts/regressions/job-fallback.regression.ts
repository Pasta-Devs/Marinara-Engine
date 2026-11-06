import assert from "node:assert/strict";
import type { GenerationFallbackNotice } from "@marinara-engine/shared";
import {
  BaseLLMProvider,
  LLMHttpError,
  type ChatMessage,
  type ChatOptions,
  type LLMUsage,
} from "../../packages/server/src/services/llm/base-provider.js";
import {
  withConnectionFallbackProvider,
  type FallbackConnection,
} from "../../packages/server/src/services/llm/connection-fallback-provider.js";
import { readJobFallback } from "../../packages/server/src/services/generation/job-fallback.js";
import { DEFAULT_FEATURE_MODEL_CONNECTIONS } from "../../packages/server/src/services/storage/feature-model-connections.js";

// "If it fails": a job whose own Model call fails answers with its fallback Model, and Main's keeps working.
class FailingProvider extends BaseLLMProvider {
  constructor() {
    super("", "");
  }
  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    throw new LLMHttpError("down", { status: 500 });
  }
}

const backup: FallbackConnection = {
  id: "backup",
  name: "Backup",
  provider: "custom",
  baseUrl: "http://127.0.0.1:9/v1",
  apiKey: "test",
  model: "backup-model",
};

// readJobFallback: only a set, different, usable chat Model counts.
const rows = new Map([
  ["backup", { id: "backup", provider: "custom" }],
  ["gone", { id: "gone", provider: "custom" }],
]);
const connections = {
  getWithKey: async (id: string) => (rows.get(id) ?? null) as never,
  unavailableReason: async (id: string) => (id === "gone" ? ({ reason: "off" } as never) : null),
};
const set = (id: string | null) => ({ ...DEFAULT_FEATURE_MODEL_CONNECTIONS, mariFallbackConnectionId: id });
assert.equal(await readJobFallback(connections, set(null), "mariFallbackConnectionId", "p"), null, "unset");
assert.equal(
  await readJobFallback(connections, set("backup"), "mariFallbackConnectionId", "backup"),
  null,
  "is the primary",
);
assert.equal(await readJobFallback(connections, set("gone"), "mariFallbackConnectionId", "p"), null, "unavailable");
assert.equal((await readJobFallback(connections, set("backup"), "mariFallbackConnectionId", "p"))?.id, "backup");

// A non-Main job (category "feature") and Main both reach their fallback and name it in the notice.
for (const category of ["feature", "main"] as const) {
  const notices: GenerationFallbackNotice[] = [];
  const controller = new AbortController();
  const provider = withConnectionFallbackProvider({
    primary: new FailingProvider(),
    primaryConnectionId: "primary",
    primaryConnectionName: "Primary",
    fallbackConnection: backup,
    fallbackBaseUrl: backup.baseUrl!,
    category,
    onFallback: async (notice) => {
      notices.push(notice);
      controller.abort();
    },
  });
  await assert.rejects(async () => {
    for await (const _chunk of provider.chat([{ role: "user", content: "Hi" }], {
      model: "m",
      signal: controller.signal,
    })) {
      /* the fallback's own request is never sent: the notice below is what this proves */
    }
  });
  assert.equal(notices.length, 1, `${category}: the fallback was reported`);
  assert.equal(notices[0]!.category, category);
  assert.equal(notices[0]!.connectionId, "backup");
}
