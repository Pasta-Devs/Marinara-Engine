/**
 * #9126: a chat that stores no Model follows Main, silently, unless the reference sweep cleared its own Model: then
 * the reply says that Model was deleted, and names it. A stored Model that no longer exists is likewise reported, so a
 * notice always names the Model it is about.
 */
import assert from "node:assert/strict";

const { resolveChatConnectionOrFallback } =
  await import("../../packages/server/src/services/generation/connection-resolution.js");

const MAIN = { id: "main-1", name: "Main", model: "m-1" };
const GONE = { id: "gone-1", name: "Gone", model: "g-1", accountId: "account-1" };

/** A connections storage where `gone` no longer exists and `main` is the default. */
const storage = (options: { withMain?: boolean } = {}) => {
  const rows = new Map<string, typeof MAIN>([["main-1", MAIN]]);
  if (options.withMain === false) rows.delete("main-1");
  return {
    getWithKey: async (id: string) => rows.get(id) ?? null,
    getDefault: async () => rows.get("main-1") ?? null,
    getFallbackForMain: async () => null,
    unavailableReason: async (id: string) => (id === "gone-1" ? { reason: "deleted" as const, row: GONE } : null),
  };
};

const resolve = (
  connections: ReturnType<typeof storage>,
  connectionId: string | null,
  followsMain: boolean,
  deletedModel: string | null = null,
) => {
  const notices: unknown[] = [];
  const run = resolveChatConnectionOrFallback(
    connections as never,
    connectionId,
    (notice) => {
      notices.push(notice);
    },
    null,
    followsMain,
    deletedModel,
  );
  return run.then((connection) => ({ connection, notices }));
};

// A chat that stores no Model, without the flag (made before it, or the flag was never written): Main answers,
// silently, exactly as a follows-Main chat does.
for (const followsMain of [true, false]) {
  const { connection, notices } = await resolve(storage(), null, followsMain);
  assert.equal(connection?.id, MAIN.id, `no stored Model resolves to Main (followsMain=${followsMain})`);
  assert.deepEqual(notices, [], `no stored Model is never reported as deleted (followsMain=${followsMain})`);
}

// A chat the sweep cleared (no Model, and the deleted Model's name recorded): Main answers, and the notice says so.
{
  const { connection, notices } = await resolve(storage(), null, false, "Gone");
  assert.equal(connection?.id, MAIN.id, "a swept chat still answers through Main");
  assert.equal(notices.length, 1, "a swept chat is told its Model was deleted");
  const notice = notices[0] as Record<string, unknown>;
  assert.equal(notice.reason, "deleted");
  assert.equal(notice.unavailableName, "Gone", "the notice names the Model the chat lost");
  assert.equal("unavailableConnectionId" in notice, false, "there is no Model row left to point at");
}

// A stored Model that no longer exists is still reported, and the notice names what was deleted.
{
  const { connection, notices } = await resolve(storage(), GONE.id, false);
  assert.equal(connection?.id, MAIN.id, "a deleted Model falls back to Main");
  assert.equal(notices.length, 1, "a deleted Model is reported");
  const notice = notices[0] as Record<string, unknown>;
  assert.equal(notice.reason, "deleted");
  assert.equal(notice.unavailableConnectionId, GONE.id, "the notice names the Model that was deleted");
  assert.equal(notice.unavailableName, GONE.name);
}

// A chat that follows Main while Main itself no longer exists: it never had a Model of its own, so nothing is
// reported as deleted either.
{
  const { connection, notices } = await resolve(storage({ withMain: false }), null, true);
  assert.equal(connection, null, "no Main and no stored Model: nothing answers");
  assert.deepEqual(notices, [], "no Main is not a deleted chat Model");
}

console.log("No stored Model follows Main, and only a stored Model that is gone is reported deleted (#9126).");
