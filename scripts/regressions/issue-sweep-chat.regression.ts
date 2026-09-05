import assert from "node:assert/strict";
import { normalizeAvatarCrop } from "../../packages/shared/src/utils/avatar-crop.js";
import { resolveChatUserIdentity } from "../../packages/server/src/services/chat-user-identity.js";

async function resolveCharacterCrop(avatarCrop: unknown) {
  const storage = {
    getById: async () => ({
      id: "character-a",
      data: JSON.stringify({ name: "Character", extensions: { avatarCrop } }),
    }),
  } as unknown as Parameters<typeof resolveChatUserIdentity>[0];
  const identity = await resolveChatUserIdentity(storage, { personaCharacterId: "character-a", mode: "roleplay" });
  return identity?.avatarCrop;
}

for (const crop of [
  { zoom: 1.5, offsetX: 0, offsetY: 10 },
  { srcX: 0.2, srcY: 0.1, srcWidth: 0.5, srcHeight: 0.5 },
]) {
  const encoded = JSON.stringify(crop);
  assert.deepEqual(normalizeAvatarCrop(crop), crop);
  assert.deepEqual(normalizeAvatarCrop(encoded), crop);
  assert.deepEqual(
    normalizeAvatarCrop(JSON.stringify(encoded)),
    crop,
    "already-written double-encoded snapshots recover their exact crop",
  );
  assert.equal(normalizeAvatarCrop(JSON.stringify(JSON.stringify(encoded))), null, "decoding is bounded");
  const storage = {
    listPersonas: async () => [{ id: "persona-a", name: "Persona", avatarCrop: encoded }],
  } as unknown as Parameters<typeof resolveChatUserIdentity>[0];
  const identity = await resolveChatUserIdentity(storage, { personaId: "persona-a", mode: "roleplay" });
  assert.deepEqual(identity?.avatarCrop, crop, "new snapshots receive the decoded database crop");
  assert.deepEqual(JSON.parse(JSON.stringify(identity?.avatarCrop)), crop, "one snapshot encoding suffices");
  for (const storedCrop of [crop, encoded, JSON.stringify(encoded)]) {
    const characterCrop = await resolveCharacterCrop(storedCrop);
    assert.deepEqual(characterCrop, crop, "character identities normalize object and encoded crops");
    assert.deepEqual(JSON.parse(JSON.stringify(characterCrop)), crop, "character snapshots need only one encoding");
  }
}
for (const value of [
  null,
  "",
  "not json",
  JSON.stringify("not json"),
  JSON.stringify(JSON.stringify({ srcX: -1, srcY: 0, srcWidth: 1, srcHeight: 1 })),
]) {
  assert.equal(normalizeAvatarCrop(value), null, "malformed and out-of-bounds crops still fall back safely");
  assert.equal(await resolveCharacterCrop(value), null, "character identities discard invalid crops");
}
console.log("issue-sweep persona and character crop regression passed");
