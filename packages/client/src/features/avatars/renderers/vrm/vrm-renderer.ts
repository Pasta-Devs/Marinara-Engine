// ──────────────────────────────────────────────
// Avatar renderer: VRM 0.x / 1.0 (lane: 3D)
// ──────────────────────────────────────────────
// three + @pixiv/three-vrm (+ @pixiv/three-vrm-animation for `.vrma` idle motion), all MIT and pinned
// exactly. One WebGLRenderer for every VRM avatar on screen; the frame's emotion and viseme drive the
// model's bound expressions (VrmAvatarData.expressionMap).
//
// Each avatar keeps its own scene and camera and draws into the stage's canvas through a 2D context: the
// shared renderer draws the avatar into the corner of its own offscreen canvas, and the avatar copies that
// corner out in the same task, so every VRM on screen shares one WebGL context. The stage drives update();
// nothing here runs a loop or a timer.
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  DirectionalLight,
  LoadingManager,
  Object3D,
  PerspectiveCamera,
  Scene,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader, type GLTF, type GLTFParser } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMMetaLoaderPlugin, VRMUtils, type VRM, type VRMCore } from "@pixiv/three-vrm";
import { VRMAnimationLoaderPlugin, createVRMAnimationClip, type VRMAnimation } from "@pixiv/three-vrm-animation";
import {
  AVATAR_EXPRESSION_SLOTS,
  AVATAR_VISEMES,
  DEFAULT_AVATAR_FEATURE_FLAGS,
  avatarModelFilePath,
  type AvatarExpressionMap,
  type AvatarFeatureFlags,
  type AvatarFilePath,
  type AvatarFrameInput,
  type AvatarOwnerRef,
} from "@marinara-engine/shared";
import { api } from "../../../../lib/api-client";
import {
  AVATAR_RENDER_BUDGET,
  type AvatarFraming,
  type AvatarRenderer,
  type AvatarRendererMountOptions,
} from "../../contract";
import {
  POSE_BONES,
  canvasPixels,
  computeBodyPose,
  createBlinkTimer,
  createExpressionWeights,
  createIdleMotionState,
  frameCamera,
  softenMouthOverrides,
  stepBlink,
  stepExpressionWeights,
  vrm0Mirror,
  type BodyHeights,
  type BodyPose,
} from "./vrm-motion";

/** The licence URL VRM 1.0 requires; three-vrm refuses any other unless told to accept it. */
const VRM1_LICENSE_URL = "https://vrm.dev/licenses/1.0/";
const FIELD_OF_VIEW = 25;
const GAZE_EASE_SECONDS = 0.2;

// ── The one WebGL context every VRM avatar shares ──

interface SharedRenderer {
  renderer: WebGLRenderer;
  width: number;
  height: number;
  users: number;
}

let shared: SharedRenderer | null = null;

function acquireSharedRenderer(): SharedRenderer {
  if (!shared) {
    // three handles webglcontextlost/restored itself: it prevents the default, skips draws while the
    // context is lost, and uploads every geometry, texture and shader again once it is restored.
    const renderer = new WebGLRenderer({
      canvas: document.createElement("canvas"),
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.setScissorTest(true);
    shared = { renderer, width: 0, height: 0, users: 0 };
  }
  shared.users += 1;
  return shared;
}

function releaseSharedRenderer(): void {
  if (!shared) return;
  shared.users -= 1;
  if (shared.users > 0) return;
  shared.renderer.dispose();
  // Give the context back now instead of waiting for garbage collection; browsers cap live contexts.
  shared.renderer.forceContextLoss();
  shared = null;
}

function abortError(): DOMException {
  return new DOMException("The avatar stopped loading.", "AbortError");
}

/** Loads a stored GLB through the API. Only the file's own embedded data may load: a model that points to
 *  outside addresses fails instead of making requests (the importer refuses such files too). */
async function loadStoredGltf(
  owner: AvatarOwnerRef,
  path: AvatarFilePath,
  signal: AbortSignal,
  plugin: (parser: GLTFParser) => VRMLoaderPlugin | VRMAnimationLoaderPlugin,
): Promise<GLTF> {
  const response = await api.raw(avatarModelFilePath(owner, path), { signal });
  if (!response.ok) throw new Error(`The avatar file could not be loaded (${response.status}).`);
  const bytes = await response.arrayBuffer();
  if (signal.aborted) throw abortError();
  const manager = new LoadingManager();
  manager.setURLModifier((url) => (/^(?:blob|data):/iu.test(url) ? url : "data:,"));
  const loader = new GLTFLoader(manager);
  loader.register((parser) => {
    // The model's pictures load as images, which the Engine's img-src allows from blob: and data: URLs.
    // GLTFLoader's default ImageBitmapLoader reads them with fetch, which connect-src refuses for those URLs,
    // so every texture failed quietly and the model drew plain white.
    parser.textureLoader = new TextureLoader(manager);
    return plugin(parser);
  });
  return loader.parseAsync(bytes, "");
}

function vrmPlugin(parser: GLTFParser): VRMLoaderPlugin {
  const licenseUrl = (parser.json as { extensions?: { VRMC_vrm?: { meta?: { licenseUrl?: unknown } } } }).extensions
    ?.VRMC_vrm?.meta?.licenseUrl;
  // An off or missing licence URL is a spec slip, not a reason to show nothing; setup shows the author's terms.
  // three-vrm compares the file's value as it is (a Set lookup), so it is accepted whatever its type.
  const acceptLicenseUrls = [VRM1_LICENSE_URL, licenseUrl as string];
  return new VRMLoaderPlugin(parser, { metaPlugin: new VRMMetaLoaderPlugin(parser, { acceptLicenseUrls }) });
}

/** Loads a stored VRM model exactly as the stage does; the regression checks that what the importer accepts
 *  loads here too. */
export function loadStoredVrm(owner: AvatarOwnerRef, path: AvatarFilePath, signal: AbortSignal): Promise<GLTF> {
  return loadStoredGltf(owner, path, signal, vrmPlugin);
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;
}

function ease(current: number, target: number, dtSeconds: number, seconds: number): number {
  return current + (target - current) * (1 - Math.exp(-dtSeconds / seconds));
}

const REST_FRAME: AvatarFrameInput = {
  emotion: "neutral",
  emotionWeight: 0,
  viseme: null,
  mouthOpen: 0,
  state: "idle",
};

class VrmAvatarRenderer implements AvatarRenderer {
  readonly kind = "vrm" as const;
  private gl: SharedRenderer | null = null;
  private context2d: CanvasRenderingContext2D | null = null;
  private vrm: VRM | null = null;
  private mixer: AnimationMixer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.05, 50);
  private readonly lookTarget = new Object3D();
  private readonly gaze = new Vector3();
  private readonly loading = new AbortController();
  private features: AvatarFeatureFlags = { ...DEFAULT_AVATAR_FEATURE_FLAGS };
  private reducedMotion = false;
  private paused = false;
  private disposed = false;
  private pixelWidth = 0;
  private pixelHeight = 0;
  private aspect = 1;
  private body: BodyHeights | null = null;
  private framing: AvatarFraming = "portrait";
  private distance = 1;
  private time = 0;
  private mirror: 1 | -1 = 1;
  private bindings: AvatarExpressionMap = {};
  private mouthHolders: ReadonlySet<string> = new Set();
  /** No mouth shape is bound (a generated body), so the body and head carry the life and the talking. */
  private bodyOnly = false;
  private readonly weights = createExpressionWeights();
  private readonly blink = createBlinkTimer();
  private readonly idle = createIdleMotionState();

  async mount(options: AvatarRendererMountOptions): Promise<void> {
    try {
      await this.load(options);
    } catch (error) {
      // A renderer that failed to mount holds nothing: the stage may drop it without calling dispose().
      this.dispose();
      throw error;
    }
  }

  private async load(options: AvatarRendererMountOptions): Promise<void> {
    if (this.disposed) throw abortError();
    const data = options.config.kinds.vrm;
    if (!data) throw new Error("This avatar has no VRM model set up.");
    const context2d = options.canvas.getContext("2d");
    if (!context2d) throw new Error("This browser cannot draw the avatar.");
    if (options.signal.aborted) throw abortError();
    options.signal.addEventListener("abort", () => this.loading.abort(), { once: true });
    const signal = this.loading.signal;
    this.context2d = context2d;
    this.features = { ...options.config.features };
    this.reducedMotion = options.reducedMotion;
    this.gl = acquireSharedRenderer();

    const light = new DirectionalLight(0xffffff, Math.PI);
    light.position.set(1, 1, 1).normalize();
    this.scene.add(light, new AmbientLight(0xffffff, 0.4), this.lookTarget);

    const gltf = await loadStoredVrm(options.owner, data.file, signal);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (this.disposed || signal.aborted || !vrm) {
      VRMUtils.deepDispose(gltf.scene);
      throw this.disposed || signal.aborted ? abortError() : new Error("This file has no VRM model in it.");
    }
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    // Skinned meshes keep their bind-pose bounds, so culling would hide parts of a posed model.
    vrm.scene.traverse((object) => {
      object.frustumCulled = false;
    });
    this.vrm = vrm;
    this.mirror = vrm0Mirror(vrm.meta?.metaVersion);
    this.scene.add(vrm.scene);
    if (vrm.lookAt) {
      vrm.lookAt.target = this.lookTarget;
      vrm.lookAt.autoUpdate = true;
    }
    for (const slot of AVATAR_EXPRESSION_SLOTS) {
      const binding = data.expressionMap[slot];
      if (binding?.target && vrm.expressionManager?.getExpression(binding.target)) this.bindings[slot] = binding;
    }
    this.mouthHolders = softenMouthOverrides(this.bindings, (name) => vrm.expressionManager?.getExpression(name));
    this.bodyOnly = !AVATAR_VISEMES.some((slot) => this.bindings[slot]);

    // Measure the body at rest with the arms down, then frame it.
    this.applyPose(computeBodyPose(this.idle, 0, REST_FRAME, false, 0));
    vrm.update(0);
    vrm.scene.updateMatrixWorld(true);
    this.body = measureBody(vrm);
    this.updateCamera();

    if (data.idleAnimation && this.features.idleMotion && !this.reducedMotion) {
      await this.loadIdleAnimation(options.owner, data.idleAnimation, signal);
    }
    if (this.disposed || signal.aborted) throw abortError();
    // three-vrm records where hair and clothes rest while loading, before the model is turned (VRM 0.x) and
    // its arms are lowered; start them from the first frame's pose so they do not whip when the avatar appears.
    if (this.mixer) {
      this.mixer.update(0);
      vrm.update(0);
      vrm.scene.updateMatrixWorld(true);
    }
    vrm.springBoneManager?.reset();
    // Compile shaders before the first frame so the avatar does not stall the chat when it appears.
    await this.gl?.renderer.compileAsync(this.scene, this.camera).catch(() => undefined);
    if (this.disposed || signal.aborted) throw abortError();
  }

  update(frame: AvatarFrameInput, dtMs: number): void {
    const vrm = this.vrm;
    if (this.paused || this.disposed || !vrm || !this.pixelWidth || !this.pixelHeight) return;
    const dt = clamp(dtMs / 1000, 0, 0.1);
    this.time += dt;
    const animate = this.features.idleMotion && !this.reducedMotion;

    if (this.mixer && animate) this.mixer.update(dt);
    else this.applyPose(computeBodyPose(this.idle, this.time, frame, animate, dt, this.bodyOnly));

    stepExpressionWeights(this.weights, this.bindings, frame, this.features, dt, this.mouthHolders);
    const expressions = vrm.expressionManager;
    if (expressions) {
      for (const [name, weight] of this.weights) expressions.setValue(name, weight);
      const blinkName = this.bindings.blink?.target;
      if (blinkName) {
        const closure = frame.blink ?? stepBlink(this.blink, dt, { enabled: this.features.blink });
        expressions.setValue(blinkName, Math.max(this.weights.get(blinkName) ?? 0, clamp(closure, 0, 1)));
      }
    }

    // Eyes follow the frame's gaze, glance up and aside while thinking, and otherwise meet the viewer.
    const thinking = frame.state === "thinking" && animate;
    const goalX = frame.lookAt ? clamp(frame.lookAt.x, -1, 1) : thinking ? 0.35 : 0;
    const goalY = frame.lookAt ? clamp(frame.lookAt.y, -1, 1) : thinking ? 0.4 : 0;
    this.gaze.set(ease(this.gaze.x, goalX, dt, GAZE_EASE_SECONDS), ease(this.gaze.y, goalY, dt, GAZE_EASE_SECONDS), 0);
    const span = this.distance * 0.5;
    this.lookTarget.position.set(
      this.camera.position.x + this.gaze.x * span,
      this.camera.position.y + this.gaze.y * span,
      this.camera.position.z,
    );

    vrm.update(dt);
    this.draw();
  }

  resize(width: number, height: number, devicePixelRatio: number): void {
    if (this.disposed) return;
    const pixels = canvasPixels(width, height, devicePixelRatio, AVATAR_RENDER_BUDGET.maxDevicePixelRatio.desktop);
    this.pixelWidth = pixels.width;
    this.pixelHeight = pixels.height;
    this.aspect = width > 0 && height > 0 ? width / height : 1;
    this.updateCamera();
    this.redraw();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setFraming(framing: AvatarFraming): void {
    if (this.disposed || framing === this.framing) return;
    this.framing = framing;
    this.updateCamera();
    this.redraw();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loading.abort();
    if (this.vrm) {
      this.mixer?.stopAllAction();
      this.mixer?.uncacheRoot(this.vrm.scene);
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.scene.clear();
    this.vrm = null;
    this.mixer = null;
    if (this.gl) releaseSharedRenderer();
    this.gl = null;
    this.context2d = null;
  }

  private async loadIdleAnimation(owner: AvatarOwnerRef, path: AvatarFilePath, signal: AbortSignal): Promise<void> {
    try {
      const gltf = await loadStoredGltf(owner, path, signal, (parser) => new VRMAnimationLoaderPlugin(parser));
      const animation = (gltf.userData.vrmAnimations as VRMAnimation[] | undefined)?.[0];
      VRMUtils.deepDispose(gltf.scene);
      const vrm = this.vrm;
      if (!animation || !vrm || this.disposed) return;
      // Body motion only: the director owns the face and the gaze, so leave out expression and look-at tracks.
      const bodyOnly = { humanoid: vrm.humanoid, meta: vrm.meta, scene: vrm.scene } as unknown as VRMCore;
      this.mixer = new AnimationMixer(vrm.scene);
      this.mixer.clipAction(createVRMAnimationClip(animation, bodyOnly)).play();
    } catch (error) {
      if (signal.aborted) throw abortError();
      console.warn("[avatars] The VRM idle animation could not be loaded; using the built-in idle motion.", error);
    }
  }

  private applyPose(pose: BodyPose): void {
    const humanoid = this.vrm?.humanoid;
    if (!humanoid) return;
    for (const bone of POSE_BONES) {
      const [x, y, z] = pose[bone];
      humanoid.getNormalizedBoneNode(bone)?.rotation.set(x * this.mirror, y, z * this.mirror);
    }
  }

  private updateCamera(): void {
    if (!this.body) return;
    const framing = frameCamera(this.body, this.aspect, FIELD_OF_VIEW, this.framing);
    this.distance = framing.distance;
    this.camera.aspect = this.aspect;
    this.camera.near = Math.max(0.01, framing.distance * 0.05);
    this.camera.far = framing.distance + 20;
    this.camera.position.set(0, framing.targetY, framing.distance);
    this.camera.lookAt(0, framing.targetY, 0);
    this.camera.updateProjectionMatrix();
  }

  /** Draws the current pose at the new size or framing right away, as the 2D renderers do: the stage's next
   *  frame may be a while off (or paused), and until then the canvas would show a stretched picture. */
  private redraw(): void {
    if (this.vrm && this.pixelWidth && this.pixelHeight) this.draw();
  }

  private draw(): void {
    const gl = this.gl;
    const context2d = this.context2d;
    if (!gl || !context2d) return;
    const renderer = gl.renderer;
    // While the context is lost the canvas keeps the last frame; three redraws once it is restored.
    if (renderer.getContext().isContextLost()) return;
    const width = this.pixelWidth;
    const height = this.pixelHeight;
    if (width > gl.width || height > gl.height) {
      gl.width = Math.max(gl.width, width);
      gl.height = Math.max(gl.height, height);
      renderer.setSize(gl.width, gl.height, false);
    }
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.render(this.scene, this.camera);
    // WebGL's origin is the bottom-left corner, so the avatar sits at the bottom of the shared canvas.
    const canvas = context2d.canvas;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    context2d.clearRect(0, 0, width, height);
    context2d.drawImage(renderer.domElement, 0, gl.height - height, width, height, 0, 0, width, height);
  }
}

const boneWorld = new Vector3();

/** Bone heights and the top and bottom of the posed model (skinned meshes measure where their bones put them). */
function measureBody(vrm: VRM): BodyHeights {
  const height = (bone: "head" | "hips" | "leftFoot" | "rightFoot") =>
    vrm.humanoid.getRawBoneNode(bone)?.getWorldPosition(boneWorld).y ?? 0;
  const bounds = new Box3().setFromObject(vrm.scene);
  const topY = bounds.max.y;
  const bottomY = bounds.min.y;
  return {
    headY: height("head"),
    hipsY: height("hips"),
    footY: Math.min(height("leftFoot"), height("rightFoot")),
    ...(Number.isFinite(topY) ? { topY } : {}),
    ...(Number.isFinite(bottomY) ? { bottomY } : {}),
  };
}

export function createAvatarRenderer(): AvatarRenderer {
  return new VrmAvatarRenderer();
}
