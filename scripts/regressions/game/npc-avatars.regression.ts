// NPC avatars: refreshing an avatar's revision, matching the same avatar file, and normalizing NPC names.
import assert from "node:assert/strict";
import {
  isSameNpcAvatarResource,
  normalizeNpcAvatarName,
  withFreshNpcAvatarRevision,
  withoutNpcAvatarRevision,
} from "../../../packages/client/src/lib/game-npc-avatar.js";

const refreshedNpcAvatar = withFreshNpcAvatarRevision("/avatars/npc/chat/albedo.png?size=small#portrait");
assert.match(refreshedNpcAvatar, /mariAvatarRevision=/u);
assert.equal(withoutNpcAvatarRevision(refreshedNpcAvatar), "/avatars/npc/chat/albedo.png?size=small#portrait");
assert.equal(isSameNpcAvatarResource(refreshedNpcAvatar, "/avatars/npc/chat/albedo.png?size=small#portrait"), true);
assert.equal(normalizeNpcAvatarName("Director Althea Voss Friendly"), normalizeNpcAvatarName("Director Althea Voss"));
assert.equal(normalizeNpcAvatarName("Benemy"), "benemy");
assert.equal(normalizeNpcAvatarName("Director__Althea--Voss Friendly"), normalizeNpcAvatarName("Director Althea Voss"));
