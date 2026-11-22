/**
 * Split view: a save in one window refreshes only the queries of what it wrote in the other (QC panel 3, speed H4).
 * Opening split view used to refetch every query in the main window, because the second side's boot saves made it
 * invalidate everything.
 */
import assert from "node:assert/strict";
import {
  EVERYTHING,
  familyOfPath,
  queryRootsFor,
} from "../../../packages/client/src/components/overhaul/split-sync.js";

assert.equal(familyOfPath("/chats/abc"), "chats");
assert.equal(familyOfPath("/chats/abc/messages?x=1"), "chats");
assert.equal(familyOfPath("chats"), "chats");
assert.equal(familyOfPath("/characters/personas"), "characters");
assert.equal(familyOfPath("/regex-scripts/1"), "regex-scripts");
// The look and layout settings: no query reads them, so the other side refreshes nothing.
assert.equal(familyOfPath("/app-settings/ui"), "ui-settings");
assert.deepEqual([...(queryRootsFor(["ui-settings"]) ?? ["missing"])], []);
// Other app settings and anything unknown refresh everything, as before.
assert.equal(familyOfPath("/app-settings/features"), EVERYTHING);
assert.equal(familyOfPath("/something-new/1"), EVERYTHING);
assert.equal(queryRootsFor(["chats", EVERYTHING]), null);

const roots = queryRootsFor(["chats", "lorebooks"]);
assert.ok(roots);
for (const root of ["chats", "home-feed", "gallery", "lorebooks"]) assert.ok(roots.has(root), root);
assert.ok(!roots.has("characters"), "a chat save leaves the character queries alone");

console.log("split-sync regression passed");
