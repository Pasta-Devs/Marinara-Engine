import assert from "node:assert/strict";
import type { GameNpc } from "@marinara-engine/shared";
import { sanitizeGameNpcAvatarUrls } from "../../packages/server/src/services/game/npc-avatar-utils.js";
import { withFreshNpcAvatarRevision } from "../../packages/client/src/lib/game-npc-avatar.js";

const path = "/api/avatars/npc/chat/portrait.png?v=123#portrait";
for (const origin of ["http://127.0.0.1:7800", "http://localhost:7800", "http://[::1]:7800"]) {
  const original = [{ id: "npc", name: "Guide", avatarUrl: `${origin}${path}` }] as GameNpc[];
  const fixed = sanitizeGameNpcAvatarUrls(original);
  assert.equal(fixed[0]?.avatarUrl, path);
  assert.equal(original[0]?.avatarUrl, `${origin}${path}`, "Normalization must not mutate the stored input");
  const remote = new URL(withFreshNpcAvatarRevision(fixed[0]!.avatarUrl!), "http://192.168.31.43:7800");
  assert.equal(remote.hostname, "192.168.31.43");
  assert.equal(remote.searchParams.get("v"), "123");
  assert.ok(remote.searchParams.has("mariAvatarRevision"));
}
for (const avatarUrl of [path, "https://images.example/portrait.png", "http://localhost:8080/unrelated/image.png"]) {
  const npcs = [{ id: "npc", name: "Guide", avatarUrl }] as GameNpc[];
  assert.equal(sanitizeGameNpcAvatarUrls(npcs), npcs, "Non-local-avatar URLs and clean state retain their identity");
}
console.log("Game NPC legacy loopback URLs stay usable over LAN after portrait refresh.");
