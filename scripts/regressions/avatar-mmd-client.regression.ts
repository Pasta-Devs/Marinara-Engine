// The shipped loader/mixer compose imported bone/morph motion with the existing chat director.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { checkedPmx } from "../../packages/server/src/services/avatars/formats/mmd.js";
import {
  bindMmdStageClock,
  createAvatarRenderer,
  withoutDirectedMorphs,
} from "../../packages/client/src/features/avatars/renderers/mmd/mmd-renderer.js";
import { AVATAR_NEUTRAL_FRAME } from "../../packages/shared/src/index.js";
import { avatarAgentKinds } from "../../packages/client/src/features/avatars/setup/avatar-setup-logic.js";
import { pickAvatarKind } from "../../packages/client/src/features/avatars/stage/avatar-stage-logic.js";
import { ExpressionBindings } from "../../packages/client/src/features/avatars/setup/ModelSetupControls.js";
import { mmdPmx, mmdVmd } from "./fixtures/avatar-mmd-fixtures.js";

const require = createRequire(new URL("../../packages/client/package.json", import.meta.url));
let stopped = 0;
const clock = {
  frames: 0,
  update() {
    this.frames += 1;
  },
};
const advance = bindMmdStageClock({
  _animation: {
    stop() {
      stopped += 1;
    },
  },
  _nodes: { nodeFrame: clock },
});
assert.equal(stopped, 1);
assert.equal(clock.frames, 0, "stopping the library loop must not invent a stage tick");
advance();
advance();
assert.equal(clock.frames, 2, "only explicit stage draws advance the library's frame clock");
assert.throws(() => bindMmdStageClock({}), /cannot use the avatar stage clock/u, "a changed private API fails closed");
const { createElement } = await import(require.resolve("react"));
const { renderToStaticMarkup } = await import(require.resolve("react-dom/server"));
const { AnimationClip, AnimationMixer, LoadingManager, Loader, NumberKeyframeTrack, Texture } = await import(
  require.resolve("three")
);
const { MMDLoader } = await import(require.resolve("@takahirox/three-mmd/loaders/MMDLoader.js"));
const { Parser } = await import(require.resolve("mmd-parser"));
// No image decoding is claimed here; browser coverage verifies actual texture pixels under server CSP.
class NoImageLoader extends Loader {
  load() {
    return new Texture();
  }
}
const manager = new LoadingManager();
manager.addHandler(/./u, new NoImageLoader(manager));
const loader = new MMDLoader(manager);
const canonical = checkedPmx(mmdPmx()).bytes;
const model = new Parser().parsePmx(
  canonical.buffer.slice(canonical.byteOffset, canonical.byteOffset + canonical.byteLength),
  true,
);
const mesh = loader.meshBuilder.build(model, "");
assert.equal(mesh.geometry.getAttribute("position").count, 3, "the actual PMX builder reads geometry");
assert.equal(mesh.morphTargetDictionary?.["笑い"], 0, "Japanese morph names survive import and runtime decoding");
assert.equal(mesh.geometry.morphAttributes.position?.length, 1);
const vmd = mmdVmd();
const motion = new Parser().parseVmd(vmd.buffer.slice(vmd.byteOffset, vmd.byteOffset + vmd.byteLength), true);
const animation = loader.animationBuilder.build(motion, mesh);
const mixer = new AnimationMixer(mesh);
mixer.clipAction(animation).play();
mixer.update(0.5);
assert.ok(
  mesh.skeleton.getBoneByName("center")!.position.x > 0.05,
  "the actual VMD clip moves the imported model's bone",
);
const globals = globalThis as { React?: unknown };
const previousReact = globals.React;
globals.React = require("react"); // The regression runner uses classic JSX, as other SSR guards do.
let markup: string;
try {
  markup = renderToStaticMarkup(
    createElement(ExpressionBindings, {
      data: {
        expressionNames: Array.from({ length: 256 }, (_, index) => `face-${index}`),
        expressionMap: { happy: { target: "笑い", source: "user", confidence: 1 } },
      },
      saving: false,
      onChange: () => undefined,
    }),
  );
} finally {
  if (previousReact === undefined) delete globals.React;
  else globals.React = previousReact;
}
assert.match(
  markup,
  /<option value="笑い" selected="">笑い<\/option>/u,
  "a configured valid face stays selectable outside the bounded offered catalogue",
);

const original = new AnimationClip("mixed", 1, [
  ...[0, 1].map((index) => new NumberKeyframeTrack(`.morphTargetInfluences[${index}]`, [0, 1], [0, 1])),
  ...animation.tracks,
]);
const filtered = withoutDirectedMorphs(
  original,
  { morphTargetDictionary: { 笑い: 0, costume: 1 } },
  { happy: { target: "笑い", source: "user", confidence: 1 } },
);
assert.equal(original.tracks.length, 4, "the saved motion is never mutated");
assert.equal(filtered.tracks.length, 3);
assert.ok(
  !filtered.tracks.some((track) => track.name === ".morphTargetInfluences[0]"),
  "the chat director owns its bound face",
);
assert.ok(
  filtered.tracks.some((track) => track.name === ".morphTargetInfluences[1]"),
  "unbound authored morphs still animate",
);
assert.ok(
  filtered.tracks.some((track) => track.name.includes(".bones[center]")),
  "bone motion stays intact",
);
assert.deepEqual(avatarAgentKinds("3d-avatars"), ["vrm", "mmd"]);
assert.equal(pickAvatarKind({ activeKind: "mmd", kinds: ["vrm", "mmd"] }, ["3d-avatars"]), "mmd");
assert.equal(
  pickAvatarKind({ activeKind: "mmd", kinds: ["mmd"] }, ["2d-avatars"]),
  null,
  "the 3D agent must be enabled",
);

// Exercise the actual update method and imported mesh; only the GPU draw is absent in this pure control.
const renderer = createAvatarRenderer();
const blinkBinding = { target: "笑い", source: "user" as const, confidence: 1 };
const features = { blink: true, lipSync: true, idleMotion: false };
Reflect.set(renderer, "mesh", mesh);
Reflect.set(renderer, "bindings", { blink: blinkBinding });
Reflect.set(renderer, "features", features);
renderer.resize(180, 320, 1);
for (const closure of [0, 1, 0]) {
  renderer.update({ ...AVATAR_NEUTRAL_FRAME, blink: closure }, 100);
  assert.equal(mesh.morphTargetInfluences![0], closure, "a supplied full blink reopens instead of latching shut");
}
const timer = Reflect.get(renderer, "blink") as { wait: number; phase: number };
timer.wait = 0;
timer.phase = -1;
for (const dt of [0, 60, 100, 100]) renderer.update(AVATAR_NEUTRAL_FRAME, dt);
assert.equal(mesh.morphTargetInfluences![0], 0, "the automatic blink also returns to open");
timer.phase = 0.07;
renderer.update(AVATAR_NEUTRAL_FRAME, 0);
assert.equal(mesh.morphTargetInfluences![0], 1);
features.blink = false;
renderer.update(AVATAR_NEUTRAL_FRAME, 100);
assert.equal(mesh.morphTargetInfluences![0], 0, "turning blinking off reopens a closed morph");
Reflect.set(renderer, "bindings", { blink: blinkBinding, happy: blinkBinding });
const happy = { ...AVATAR_NEUTRAL_FRAME, emotion: "happy" as const, emotionWeight: 0.4 };
for (let frame = 0; frame < 20; frame += 1) renderer.update({ ...happy, blink: 0 }, 100);
assert.equal(mesh.morphTargetInfluences![0], 0.4);
renderer.update({ ...happy, blink: 1 }, 100);
assert.equal(mesh.morphTargetInfluences![0], 1);
renderer.update({ ...happy, blink: 0 }, 100);
assert.equal(mesh.morphTargetInfluences![0], 0.4, "a shared emotion binding keeps its eased weight after reopening");
Reflect.set(renderer, "mesh", null);
renderer.dispose();
mixer.stopAllAction();
mesh.geometry.dispose();
mesh.skeleton.dispose();
mesh.material.forEach((material) => material.dispose());
