// PMX/VMD use the same stage clock and director as VRM. One lazy WebGL2 context serves every MMD avatar.
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Loader,
  LoadingManager,
  PerspectiveCamera,
  Scene,
  Texture,
  Vector3,
  type AnimationClip,
} from "three";
import { WebGPURenderer } from "three/webgpu";
import { TGALoader } from "three/addons/loaders/TGALoader.js";
import { MMDLoader } from "@takahirox/three-mmd/loaders/MMDLoader.js";
import { MMDAnimationHelper } from "@takahirox/three-mmd/animation/MMDAnimationHelper.js";
import type { MMDMesh } from "@takahirox/three-mmd";
import { Parser } from "mmd-parser";
import {
  AVATAR_EXPRESSION_SLOTS,
  DEFAULT_AVATAR_FEATURE_FLAGS,
  avatarModelFilePath,
  type AvatarExpressionMap,
  type AvatarFeatureFlags,
  type AvatarFilePath,
  type AvatarFrameInput,
  type AvatarOwnerRef,
  type MmdAvatarData,
} from "@marinara-engine/shared";
import { api } from "../../../../lib/api-client";
import {
  AVATAR_RENDER_BUDGET,
  type AvatarFraming,
  type AvatarRenderer,
  type AvatarRendererMountOptions,
} from "../../contract";
import {
  canvasPixels,
  createBlinkTimer,
  createExpressionWeights,
  frameCamera,
  stepBlink,
  stepExpressionWeights,
  type BodyHeights,
} from "../vrm/vrm-motion";

interface SharedRenderer {
  renderer: WebGPURenderer;
  ready: Promise<void>;
  advanceFrame(): void;
  width: number;
  height: number;
  users: number;
}
let shared: SharedRenderer | null = null;

/** ponytail: Three 0.186 starts a private RAF even without a callback. Keep this pinned, guarded adapter
 * until Three exposes a public on-demand clock; the stage remains the only owner of animation ticks. */
export function bindMmdStageClock(renderer: unknown): () => void {
  if (renderer === null || typeof renderer !== "object")
    throw new Error("This Three.js version cannot use the avatar stage clock.");
  const clock = renderer as { _animation?: { stop?: () => void }; _nodes?: { nodeFrame?: { update?: () => void } } };
  const animation = clock._animation;
  const frame = clock._nodes?.nodeFrame;
  if (typeof animation?.stop !== "function" || typeof frame?.update !== "function")
    throw new Error("This Three.js version cannot use the avatar stage clock.");
  animation.stop();
  return () => frame.update!();
}

function acquireRenderer(): SharedRenderer {
  if (!shared) {
    // The library's NodeMaterials require the modern renderer; its WebGL2 backend also works without WebGPU.
    const renderer = new WebGPURenderer({
      canvas: document.createElement("canvas"),
      alpha: true,
      antialias: true,
      forceWebGL: true,
    });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0, 0);
    const gl: SharedRenderer = {
      renderer,
      ready: Promise.resolve(),
      advanceFrame: () => undefined,
      width: 0,
      height: 0,
      users: 0,
    };
    gl.ready = renderer.init().then(() => {
      gl.advanceFrame = bindMmdStageClock(renderer);
    });
    shared = gl;
  }
  shared.users += 1;
  return shared;
}

function releaseRenderer(gl: SharedRenderer): void {
  gl.users -= 1;
  if (gl.users > 0) return;
  void gl.ready
    .then(
      async () => {
        // A new mount can reuse a context whose initialization was still pending at the last unmount.
        if (gl.users > 0) return;
        if (shared === gl) shared = null;
        const context = gl.renderer.getContext() as WebGL2RenderingContext;
        const disposal = gl.renderer.dispose();
        context?.getExtension("WEBGL_lose_context")?.loseContext();
        await disposal;
      },
      () => {
        if (gl.users > 0) return;
        if (shared === gl) shared = null;
        return gl.renderer.dispose();
      },
    )
    .catch(() => undefined);
}

function aborted(): DOMException {
  return new DOMException("The avatar stopped loading.", "AbortError");
}

async function storedBytes(owner: AvatarOwnerRef, path: AvatarFilePath, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await api.raw(avatarModelFilePath(owner, path), { signal });
  if (!response.ok) throw new Error(`The avatar file could not be loaded (${response.status}).`);
  const bytes = await response.arrayBuffer();
  if (signal.aborted) throw aborted();
  return bytes;
}

/** TGA cannot be decoded by <img>. Parse its already authenticated bytes, never fetch a blob through connect-src. */
class StoredTgaLoader extends Loader<Texture> {
  constructor(
    manager: LoadingManager,
    private readonly images: ReadonlyMap<string, ArrayBuffer>,
  ) {
    super(manager);
  }
  override load(
    url: string,
    onLoad?: (texture: Texture) => void,
    _onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): Texture {
    const texture = new Texture();
    this.manager.itemStart(url);
    queueMicrotask(() => {
      try {
        const bytes = this.images.get(url);
        if (!bytes) throw new Error("The MMD texture is missing.");
        const image = new TGALoader().parse(bytes);
        if (!image.data || !image.width || !image.height) throw new Error("The MMD texture is damaged.");
        // MMD's toon-ramp rotation uses drawImage, so keep the decoded pixels in a drawable canvas.
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser cannot decode the MMD texture.");
        const pixels = new Uint8ClampedArray(image.data.byteLength);
        pixels.set(new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength));
        context.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
        texture.image = canvas;
        texture.needsUpdate = true;
        onLoad?.(texture);
      } catch (error) {
        onError?.(error);
        this.manager.itemError(url);
      } finally {
        this.manager.itemEnd(url);
      }
    });
    return texture;
  }
}

/** Only importer-checked, owner-owned texture files can load. The only data URLs are the library's built-in toon ramps. */
export async function loadStoredMmd(
  owner: AvatarOwnerRef,
  data: MmdAvatarData,
  signal: AbortSignal,
): Promise<{ mesh: MMDMesh; loader: MMDLoader }> {
  const model = await storedBytes(owner, data.file, signal);
  const urls = new Map<string, string>();
  const tgas = new Map<string, ArrayBuffer>();
  const ownedUrls: string[] = [];
  let mesh: MMDMesh | null = null;
  try {
    const byPath = new Map<AvatarFilePath, { bytes: ArrayBuffer; url: string }>();
    for (const [reference, path] of Object.entries(data.texturePaths)) {
      let image = byPath.get(path);
      if (!image) {
        const response = await api.raw(avatarModelFilePath(owner, path), { signal });
        if (!response.ok) throw new Error(`The MMD texture could not be loaded (${response.status}).`);
        const blob = await response.blob();
        if (signal.aborted) throw aborted();
        const url = URL.createObjectURL(blob);
        ownedUrls.push(url);
        image = { bytes: await blob.arrayBuffer(), url };
        byPath.set(path, image);
      }
      urls.set(reference, image.url);
      if (/\.tga$/iu.test(reference)) tgas.set(reference, image.bytes);
    }
    if (signal.aborted) throw aborted();
    const manager = new LoadingManager();
    let requested = false;
    manager.onStart = () => {
      requested = true;
    };
    let cancel: (() => void) | undefined;
    const ready = new Promise<void>((resolve, reject) => {
      manager.onLoad = resolve;
      manager.onError = () => reject(new Error("An MMD texture could not be decoded."));
      cancel = () => reject(aborted());
      signal.addEventListener("abort", cancel, { once: true });
    });
    // A builder error can precede a later image error; retain its rejection without an unhandled promise.
    void ready.catch(() => undefined);
    manager.setURLModifier((url) => {
      const stored = urls.get(url);
      if (stored) return stored;
      if (/^data:image\/png;base64,/u.test(url)) return url;
      throw new Error("The MMD model requested an unbundled texture.");
    });
    manager.addHandler(/\.tga$/iu, new StoredTgaLoader(manager, tgas));
    const loader = new MMDLoader(manager);
    try {
      mesh = loader.meshBuilder.build(new Parser().parsePmx(model, true), "");
      if (requested) await ready;
    } finally {
      if (cancel) signal.removeEventListener("abort", cancel);
    }
    if (signal.aborted) throw aborted();
    return { mesh, loader };
  } catch (error) {
    if (mesh) disposeMesh(mesh);
    throw error;
  } finally {
    for (const url of ownedUrls) URL.revokeObjectURL(url);
  }
}

function disposeMesh(mesh: MMDMesh): void {
  mesh.geometry.dispose();
  mesh.skeleton.dispose();
  const textures = new Set<Texture>();
  for (const material of mesh.material) {
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}

/** Bound face tracks belong to the director; other authored VMD morphs remain part of the motion. */
export function withoutDirectedMorphs(
  clip: AnimationClip,
  mesh: Pick<MMDMesh, "morphTargetDictionary">,
  bindings: AvatarExpressionMap,
): AnimationClip {
  const held = new Set(
    Object.values(bindings).flatMap((binding) => {
      const index = binding?.target ? mesh.morphTargetDictionary?.[binding.target] : undefined;
      return index === undefined ? [] : [`.morphTargetInfluences[${index}]`];
    }),
  );
  const result = clip.clone();
  result.tracks = result.tracks.filter((track) => !held.has(track.name));
  return result;
}

class MmdAvatarRenderer implements AvatarRenderer {
  readonly kind = "mmd" as const;
  private gl: SharedRenderer | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private mesh: MMDMesh | null = null;
  private helper: MMDAnimationHelper | null = null;
  private readonly scene = new Scene();
  private readonly root = new Group();
  private readonly camera = new PerspectiveCamera(25, 1, 0.01, 50);
  private readonly loading = new AbortController();
  private features: AvatarFeatureFlags = { ...DEFAULT_AVATAR_FEATURE_FLAGS };
  private bindings: AvatarExpressionMap = {};
  private readonly weights = createExpressionWeights();
  private readonly blink = createBlinkTimer();
  private body: BodyHeights | null = null;
  private framing: AvatarFraming = "portrait";
  private width = 0;
  private height = 0;
  private aspect = 1;
  private time = 0;
  private reducedMotion = false;
  private paused = false;
  private disposed = false;
  private hasMotion = false;

  async mount(options: AvatarRendererMountOptions): Promise<void> {
    try {
      const data = options.config.kinds.mmd;
      if (!data) throw new Error("This avatar has no MMD model set up.");
      if (this.disposed || options.signal.aborted) throw aborted();
      this.context = options.canvas.getContext("2d");
      if (!this.context) throw new Error("This browser cannot draw the avatar.");
      options.signal.addEventListener("abort", () => this.loading.abort(), { once: true });
      const signal = this.loading.signal;
      this.features = { ...options.config.features };
      this.reducedMotion = options.reducedMotion;
      this.gl = acquireRenderer();
      await this.gl.ready;
      if (this.disposed || signal.aborted) throw aborted();
      const loaded = await loadStoredMmd(options.owner, data, signal);
      if (this.disposed || signal.aborted) {
        disposeMesh(loaded.mesh);
        throw aborted();
      }
      this.mesh = loaded.mesh;
      const mesh = loaded.mesh;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      const bounds = new Box3().setFromObject(mesh);
      const size = bounds.getSize(new Vector3());
      if (!Number.isFinite(size.y) || size.y <= 0) throw new Error("The MMD model has no visible body.");
      const scale = 1.7 / size.y;
      mesh.scale.setScalar(scale);
      mesh.position.set(
        (-(bounds.max.x + bounds.min.x) * scale) / 2,
        -bounds.min.y * scale,
        (-(bounds.max.z + bounds.min.z) * scale) / 2,
      );
      this.root.updateMatrixWorld(true);
      const boneHeight = (names: string[], fallback: number) => {
        const bone = mesh.skeleton.bones.find((candidate) => names.includes(candidate.name.toLowerCase()));
        return bone?.getWorldPosition(new Vector3()).y ?? fallback;
      };
      this.body = {
        headY: boneHeight(["頭", "head"], 1.5),
        hipsY: boneHeight(["下半身", "センター", "hips"], 0.9),
        footY: 0,
        topY: 1.7,
        bottomY: 0,
      };
      const light = new DirectionalLight(0xffffff, Math.PI);
      light.position.set(1, 2, 3);
      this.scene.add(this.root, light, new AmbientLight(0xffffff, 1));
      for (const slot of AVATAR_EXPRESSION_SLOTS) {
        const binding = data.expressionMap[slot];
        if (binding?.target && mesh.morphTargetDictionary?.[binding.target] !== undefined)
          this.bindings[slot] = binding;
      }
      let animation: AnimationClip | undefined;
      if (data.idleAnimation && this.features.idleMotion && !this.reducedMotion) {
        try {
          const motion = new Parser().parseVmd(await storedBytes(options.owner, data.idleAnimation, signal), true);
          animation = withoutDirectedMorphs(loaded.loader.animationBuilder.build(motion, mesh), mesh, this.bindings);
          this.hasMotion = animation.tracks.length > 0;
        } catch (error) {
          if (signal.aborted) throw aborted();
          console.warn("[avatars] The MMD motion could not be loaded; using the built-in idle motion.", error);
        }
      }
      if (this.disposed || signal.aborted) throw aborted();
      // ponytail: physics and camera/light VMD tracks are intentionally outside avatar playback; no Ammo download.
      this.helper = new MMDAnimationHelper({ sync: false, pmxAnimation: true });
      this.helper.add(mesh, { physics: false, ...(animation ? { animation } : {}) });
      this.updateCamera();
      await this.gl.renderer.compileAsync(this.scene, this.camera);
      if (this.disposed || signal.aborted) throw aborted();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  update(frame: AvatarFrameInput, dtMs: number): void {
    if (this.paused || this.disposed || !this.mesh || !this.width || !this.height) return;
    const dt = Math.min(0.1, Math.max(0, Number.isFinite(dtMs) ? dtMs / 1000 : 0));
    const animate = this.features.idleMotion && !this.reducedMotion;
    this.time += animate ? dt : 0;
    stepExpressionWeights(this.weights, this.bindings, frame, this.features, dt);
    for (const [name, value] of this.weights) {
      const index = this.mesh.morphTargetDictionary?.[name];
      if (index !== undefined && this.mesh.morphTargetInfluences) this.mesh.morphTargetInfluences[index] = value;
    }
    const blink = this.bindings.blink?.target;
    const index = blink ? this.mesh.morphTargetDictionary?.[blink] : undefined;
    if (blink && index !== undefined && this.mesh.morphTargetInfluences) {
      const closure = frame.blink ?? stepBlink(this.blink, dt, { enabled: this.features.blink });
      this.mesh.morphTargetInfluences[index] = Math.max(this.weights.get(blink) ?? 0, closure);
    }
    this.helper?.update(animate ? dt : 0);
    if (!this.hasMotion) {
      this.root.rotation.z = animate ? Math.sin(this.time * 1.1) * 0.012 : 0;
      this.root.rotation.y = animate ? Math.sin(this.time * 0.7) * 0.025 : 0;
    }
    this.draw();
  }
  resize(width: number, height: number, ratio: number): void {
    if (this.disposed) return;
    const pixels = canvasPixels(width, height, ratio, AVATAR_RENDER_BUDGET.maxDevicePixelRatio.desktop);
    this.width = pixels.width;
    this.height = pixels.height;
    this.aspect = width > 0 && height > 0 ? width / height : 1;
    this.updateCamera();
    this.draw();
  }
  setPaused(paused: boolean): void {
    this.paused = paused;
  }
  setFraming(framing: AvatarFraming): void {
    if (this.disposed) return;
    this.framing = framing;
    this.updateCamera();
    this.draw();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loading.abort();
    if (this.mesh) {
      this.helper?.remove(this.mesh);
      disposeMesh(this.mesh);
    }
    this.mesh = null;
    this.helper = null;
    this.scene.clear();
    if (this.gl) releaseRenderer(this.gl);
    this.gl = null;
    this.context = null;
  }
  private updateCamera(): void {
    if (!this.body) return;
    const frame = frameCamera(this.body, this.aspect, 25, this.framing);
    this.camera.aspect = this.aspect;
    this.camera.position.set(0, frame.targetY, frame.distance);
    this.camera.lookAt(0, frame.targetY, 0);
    this.camera.updateProjectionMatrix();
  }
  private draw(): void {
    if (!this.gl || !this.mesh || !this.context || !this.width || !this.height || this.disposed) return;
    const { renderer } = this.gl;
    if ((renderer.getContext() as WebGL2RenderingContext).isContextLost()) return;
    const { width, height } = this;
    if (width > this.gl.width || height > this.gl.height) {
      this.gl.width = Math.max(width, this.gl.width);
      this.gl.height = Math.max(height, this.gl.height);
      renderer.setSize(this.gl.width, this.gl.height, false);
    }
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.setScissorTest(true);
    this.gl.advanceFrame();
    renderer.render(this.scene, this.camera);
    const { canvas } = this.context;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    this.context.clearRect(0, 0, width, height);
    // The modern backend's viewport starts at the top, even when the shared surface is taller than this avatar.
    this.context.drawImage(renderer.domElement, 0, 0, width, height, 0, 0, width, height);
  }
}

export function createAvatarRenderer(): AvatarRenderer {
  return new MmdAvatarRenderer();
}
