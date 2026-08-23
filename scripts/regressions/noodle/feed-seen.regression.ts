// Slice 8f-5: the "new since your last visit" divider and entry-point counter. The timestamp
// is per viewer persona, not per user — NoodleR follows and locked-post access are already
// persona-scoped, so an account-wide value would let visiting as one persona silently clear
// another persona's counter.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  countActivityAfter,
  countNoodlePostsSince,
  countNoodlerPostsSince,
} from "../../../packages/shared/src/utils/noodle-unseen.js";
import type { NoodleInteraction, NoodlePost, NoodlerViewerScope } from "../../../packages/shared/src/types/noodle.js";
import type { DB } from "../../../packages/server/src/db/connection.js";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { createNoodleStorage } from "../../../packages/server/src/services/storage/noodle.storage.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-noodle-feed-seen-"));
process.env.FILE_STORAGE_DIR = storageDir;
const fileDb = await createFileNativeDB();

try {
  const noodle = createNoodleStorage(fileDb as unknown as DB);

  // ── The timestamp survives a storage round-trip, and is scoped to one persona ──
  const viewerA = await noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "feed-seen-persona-a",
    displayName: "Viewer A",
  });
  const viewerB = await noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: "feed-seen-persona-b",
    displayName: "Viewer B",
  });
  assert.equal(viewerA.settings.social.noodlerFeedSeenAt, undefined, "a fresh persona has never been shown the feed");

  const seenAt = "2026-08-04T10:00:00.000Z";
  const patched = await noodle.patchAccountSettings(viewerA.id, {
    subtree: "social",
    patch: { noodlerFeedSeenAt: seenAt },
  });
  assert.equal(patched?.settings.social.noodlerFeedSeenAt, seenAt, "the timestamp must persist");
  const reloadedA = await noodle.getAccountById(viewerA.id);
  assert.equal(reloadedA?.settings.social.noodlerFeedSeenAt, seenAt, "and survive a reload");
  const reloadedB = await noodle.getAccountById(viewerB.id);
  assert.equal(
    reloadedB?.settings.social.noodlerFeedSeenAt,
    undefined,
    "one persona's visit must not clear another's counter",
  );

  // Both surfaces record a visit on mount, so two patches can be in flight at once and arrive
  // out of order. An older timestamp must not win, or a cleared counter comes back.
  const rewound = await noodle.patchAccountSettings(viewerA.id, {
    subtree: "social",
    patch: { noodlerFeedSeenAt: "2026-08-04T09:00:00.000Z" },
  });
  assert.equal(rewound?.settings.social.noodlerFeedSeenAt, seenAt, "a stale visit must not rewind the timestamp");

  // ── Counting rules ──
  const post = (id: string, createdAt: string) => ({ id, createdAt }) as NoodlerViewerScope["creators"][number]["posts"][number];
  const scope = {
    viewer: reloadedA!,
    creators: [
      {
        profile: { id: "creator-1", noodleAccountId: null },
        subscribed: false,
        followed: true,
        posts: [post("new-1", "2026-08-04T12:00:00.000Z"), post("old-1", "2026-08-04T09:00:00.000Z")],
      },
      {
        // Unfollowed, and still counted: NoodleR's counter is about the whole visible feed,
        // not the Following tab, which is a view preference rather than what is new.
        profile: { id: "creator-2", noodleAccountId: null },
        subscribed: false,
        followed: false,
        posts: [post("new-2", "2026-08-04T12:00:00.000Z")],
      },
      {
        // The viewer's own stage profile: their own posts are never "new" to them.
        profile: { id: "creator-own", noodleAccountId: viewerA.id },
        subscribed: false,
        followed: false,
        posts: [post("own-new", "2026-08-04T13:00:00.000Z")],
      },
    ],
  } as unknown as NoodlerViewerScope;

  assert.equal(countNoodlerPostsSince(scope, seenAt), 2, "every other creator's newer posts count, followed or not");
  assert.equal(
    countNoodlerPostsSince(scope, undefined),
    0,
    "a persona that has never been shown the feed must not be handed the whole backlog",
  );
  assert.equal(countNoodlerPostsSince(undefined, seenAt), 0, "no scope means nothing to count");
  assert.equal(countNoodlerPostsSince(scope, "not-a-date"), 0, "an unparseable timestamp must not count everything");
  assert.equal(
    countNoodlerPostsSince(scope, "2026-08-04T12:00:00.000Z"),
    0,
    "a post exactly at the seen timestamp was already shown",
  );

  // ── Noodle's own timeline uses a separate field ──
  // One shared value would let opening either surface clear the other's counter.
  await noodle.patchAccountSettings(viewerA.id, {
    subtree: "social",
    patch: { noodleFeedSeenAt: "2026-08-04T11:00:00.000Z" },
  });
  const bothStored = await noodle.getAccountById(viewerA.id);
  assert.equal(bothStored?.settings.social.noodleFeedSeenAt, "2026-08-04T11:00:00.000Z");
  assert.equal(
    bothStored?.settings.social.noodlerFeedSeenAt,
    seenAt,
    "recording a Noodle visit must not disturb the NoodleR timestamp",
  );

  // Public Noodle sorts by latest activity, not creation time, so the counter measures the
  // same value the sort does — a post bumped by a new reply is unseen again.
  const activity = [Date.parse("2026-08-04T12:00:00.000Z"), Date.parse("2026-08-04T09:00:00.000Z")];
  assert.equal(countActivityAfter(activity, "2026-08-04T11:00:00.000Z"), 1);
  assert.equal(countActivityAfter(activity, undefined), 0, "a first visit must not count the backlog");
  assert.equal(countActivityAfter(activity, "not-a-date"), 0);
  assert.equal(countActivityAfter([], "2026-08-04T11:00:00.000Z"), 0);

  // ── Public Noodle counting, including the reply bump ──
  const noodlePost = (id: string, authorAccountId: string, createdAt: string) =>
    ({ id, authorAccountId, createdAt }) as NoodlePost;
  const reply = (id: string, postId: string, actorAccountId: string, createdAt: string, parentInteractionId?: string) =>
    ({ id, postId, actorAccountId, createdAt, type: "reply", parentInteractionId: parentInteractionId ?? null }) as
      NoodleInteraction;

  const me = viewerA.id;
  const noodlePosts = [
    noodlePost("stale", "someone-else", "2026-08-04T08:00:00.000Z"),
    noodlePost("mine", me, "2026-08-04T13:00:00.000Z"),
    noodlePost("fresh", "someone-else", "2026-08-04T12:00:00.000Z"),
  ];
  const since = "2026-08-04T11:00:00.000Z";
  assert.equal(countNoodlePostsSince(noodlePosts, [], me, since), 1, "own posts are never new to their author");

  // An old post bumped by someone replying to my comment is unseen again — the timeline sorts
  // it back to the top, so the counter has to agree or the divider lands in the wrong place.
  const bumped = [
    reply("my-comment", "stale", me, "2026-08-04T08:30:00.000Z"),
    reply("their-reply", "stale", "someone-else", "2026-08-04T12:30:00.000Z", "my-comment"),
  ];
  assert.equal(countNoodlePostsSince(noodlePosts, bumped, me, since), 2, "a reply to my comment bumps its post");

  // A reply to somebody else's comment is not my business and must not bump anything.
  const unrelated = [
    reply("their-comment", "stale", "someone-else", "2026-08-04T08:30:00.000Z"),
    reply("other-reply", "stale", "third-party", "2026-08-04T12:30:00.000Z", "their-comment"),
  ];
  assert.equal(countNoodlePostsSince(noodlePosts, unrelated, me, since), 1, "unrelated replies must not bump");
  assert.equal(countNoodlePostsSince(noodlePosts, bumped, me, undefined), 0, "a first visit counts nothing");
  // With no persona there is nothing to own and no comment to bump: every newer post counts,
  // and the bumped one stays old because the bump was relative to a comment that is not mine.
  assert.equal(countNoodlePostsSince(noodlePosts, bumped, null, since), 2, "no persona means nothing is 'mine'");

  console.log("noodle-feed-seen: OK");
} finally {
  try {
    await fileDb._fileStore.close();
  } finally {
    rmSync(storageDir, { recursive: true, force: true });
  }
}
