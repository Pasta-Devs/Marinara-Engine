// The Roleplay surface: idle sprites stay below the transcript and choice controls, every Narrator render path gets
// the live roster, and both background crossfade slots cover without stretching. Reads component source until a test
// can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const roleplaySurfaceSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ChatRoleplaySurface.tsx", import.meta.url),
  "utf8",
);
const spriteOverlaySource = readFileSync(
  new URL("../../../packages/client/src/components/chat/SpriteOverlay.tsx", import.meta.url),
  "utf8",
);
assert.equal(
  roleplaySurfaceSource.match(/mergedGroupCharacterIds=\{activeChatCharacterIds\}/gu)?.length,
  6,
  "Classic and VN historical, regenerating, and streaming Narrator messages must all receive the live active roster; saved replies keep their own (#8762)",
);
assert.match(
  spriteOverlaySource,
  /const stageZIndexClass = editing \? "z-\[35\]" : "z-\[5\]"/u,
  "non-editing sprites must remain below the Roleplay transcript and its CYOA controls",
);
assert.equal(
  roleplaySurfaceSource.match(/object-cover object-center/gu)?.length,
  2,
  "both crossfade slots should cover their surface without stretching the background",
);
