import assert from "node:assert/strict";
import { isAgentManifestAvailableInChatMode } from "../../packages/shared/src/constants/chat-mode-agent-policy.js";
import type { BuiltInAgentMeta } from "../../packages/shared/src/types/agent.js";
import { normalizeHapticAction, normalizeHapticPattern } from "../../packages/shared/src/types/haptic.js";
import { parseCharacterCommands } from "../../packages/server/src/services/conversation/character-commands.js";
import {
  buildHapticPatternSteps,
  describeHapticDeviceType,
  getChatHapticSettings,
  normalizeHapticAgentCommand,
} from "../../packages/server/src/services/generation/haptic-runtime.js";

const hapticAgent: BuiltInAgentMeta = {
  id: "haptic",
  name: "Haptic Feedback",
  description: "Regression fixture",
  author: "Pasta Devs",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  modeAllowlist: ["conversation", "roleplay", "game"],
  execution: "pipeline",
};

for (const mode of ["conversation", "roleplay", "game"] as const) {
  assert.equal(isAgentManifestAvailableInChatMode(mode, hapticAgent), true, `Haptic should run in ${mode}`);
}

assert.equal(normalizeHapticAction("pump"), "position");
assert.equal(normalizeHapticAction("thrusting"), "position");
assert.equal(normalizeHapticAction("squeeze"), "constrict");
assert.equal(normalizeHapticAction("temperature"), "temperature");
assert.equal(normalizeHapticAction("spray"), "spray");
assert.equal(normalizeHapticAction("lighting"), "led");
assert.equal(normalizeHapticPattern("pulsing"), "pulse");

for (const sensitivity of ["subtle", "standard", "intense"] as const) {
  const normalized = normalizeHapticAgentCommand(
    { action: "vibrate", intensity: 1, duration: 4, pattern: "ramp" },
    getChatHapticSettings({ hapticSensitivity: sensitivity }),
  );
  assert.equal(normalized?.intensity, 1, `${sensitivity} must not cap full-strength output`);
  assert.equal(normalized?.pattern, "ramp");
}

const pumping = normalizeHapticAgentCommand({ action: "pump", intensity: 1, duration: 3, pattern: "pulse" });
assert.deepEqual(pumping, {
  deviceIndex: "all",
  action: "position",
  intensity: 1,
  duration: 3,
  pattern: "pulse",
});

const pumpingSteps = buildHapticPatternSteps("position", "pulse", 1, 4);
assert.deepEqual(
  pumpingSteps.map((step) => step.intensity),
  [1, 0, 1, 0],
  "position pulse should alternate full travel and return positions",
);
assert.ok(pumpingSteps.every((step, index) => index === 0 || step.delayMs > pumpingSteps[index - 1]!.delayMs));

assert.equal(
  describeHapticDeviceType(["vibrate", "position", "inflate"]),
  "multi-function device (vibrating, linear stroker, thruster, or pump, inflatable or air-pump)",
);

const inlineResult = parseCharacterCommands('[haptic: action="pump", intensity=1, duration=4, pattern="wave"]');
assert.equal(inlineResult.cleanContent, "");
assert.deepEqual(inlineResult.commands, [
  { type: "haptic", action: "position", intensity: 1, duration: 4, pattern: "wave" },
]);

const invalidActionResult = parseCharacterCommands('[haptic: action="teleport", intensity=1, duration=4]');
assert.equal(invalidActionResult.cleanContent, "");
assert.deepEqual(invalidActionResult.commands, []);

console.log("Haptic full-range, capability, action, mode, and pattern regressions passed.");
