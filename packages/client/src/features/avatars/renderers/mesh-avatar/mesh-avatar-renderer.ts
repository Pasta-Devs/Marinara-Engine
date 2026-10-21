// ──────────────────────────────────────────────
// Avatar renderer: mesh-avatar `.mavatar` (lane: 2D)
// ──────────────────────────────────────────────
// Thin adapter over npm "mesh-avatar" 0.1.1 (MIT, pure JS WebGL2, pinned exactly): created with
// `manual: true` and driven with advance() from update(), so the stage's loop sets the frame rate.
// Emotions map to setEmotion() (or a live expression), visemes to holdMouth(), loudness to setVoiceLevel().
//
// Every mesh avatar draws through one shared, detached WebGL2 canvas (AVATAR_RENDER_BUDGET allows one
// context per kind) and is copied onto its own canvas right after drawing, in the same task, so the
// context needs no preserveDrawingBuffer. Without WebGL2, when the file cannot be played, or when the
// context is lost, the avatar falls back to the PNGTuber renderer with the owner's sprites.
import { loadMeshAvatar, openAvatar, unpackAvatar, type AvatarPackage, type MeshAvatar } from "mesh-avatar";
import {
  avatarModelFilePath,
  type AvatarEmotion,
  type AvatarFrameInput,
  type AvatarOwnerRef,
} from "@marinara-engine/shared";
import { api } from "../../../../lib/api-client";
import type { AvatarRenderer, AvatarRendererMountOptions } from "../../contract";
import {
  easeMeshAvatarEyes,
  meshAvatarCopyRect,
  meshAvatarFace,
  meshAvatarMouth,
  meshAvatarOverrides,
} from "./mesh-avatar-face";

/** The first getContext call fixes these; mesh-avatar's own later call gets the same context back. */
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: true,
  preserveDrawingBuffer: false,
};

interface Pixels {
  width: number;
  height: number;
}

interface SharedContext {
  canvas: HTMLCanvasElement;
  context: WebGL2RenderingContext;
  /** Each mounted avatar's canvas size in device pixels, keyed by what to call when the context is lost. */
  users: Map<() => void, Pixels>;
}

let sharedContext: SharedContext | null = null;

/** The largest width and height in use. Every avatar draws at this size and is scaled onto its own canvas, so
 *  drawing avatars of different sizes in turn never reallocates the shared canvas. */
function sharedSize(shared: SharedContext): Pixels {
  let width = 1;
  let height = 1;
  for (const pixels of shared.users.values()) {
    width = Math.max(width, pixels.width);
    height = Math.max(height, pixels.height);
  }
  return { width, height };
}

function acquireSharedContext(onLost: () => void, pixels: Pixels): SharedContext | null {
  if (!sharedContext) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", CONTEXT_ATTRIBUTES);
    if (!context) return null;
    const shared: SharedContext = { canvas, context, users: new Map() };
    // ponytail: mesh-avatar 0.1.1 sizes its canvas on every draw from clientWidth/clientHeight times
    // min(devicePixelRatio, 2). A detached canvas has no layout, so these getters give it the shared size in
    // device pixels, which already holds the budget's DPR cap. Upgrade path: an explicit size option in
    // mesh-avatar (the version is pinned exactly, so this cannot drift unnoticed).
    const libraryRatio = () => Math.min(window.devicePixelRatio || 1, 2);
    Object.defineProperty(canvas, "clientWidth", { get: () => sharedSize(shared).width / libraryRatio() });
    Object.defineProperty(canvas, "clientHeight", { get: () => sharedSize(shared).height / libraryRatio() });
    canvas.addEventListener("webglcontextlost", () => {
      if (sharedContext === shared) sharedContext = null;
      const users = [...shared.users.keys()];
      shared.users.clear();
      for (const notify of users) notify();
    });
    sharedContext = shared;
  }
  sharedContext.users.set(onLost, pixels);
  return sharedContext;
}

function releaseSharedContext(shared: SharedContext, onLost: () => void) {
  shared.users.delete(onLost);
  if (shared.users.size > 0 || sharedContext !== shared) return;
  sharedContext = null;
  // Free the GPU memory now rather than when the garbage collector finds the canvas.
  shared.context.getExtension("WEBGL_lose_context")?.loseContext();
}

// ── Opened files ──
// mesh-avatar keeps every picture and JSON file it loads in module-level maps keyed by URL and never clears
// them, and opening an archive makes new blob: URLs each time. So each owner's file is opened once and every
// mount reuses its URLs, which keeps those maps from growing with each chat switch or setup edit.

interface OpenedPackage {
  pkg: AvatarPackage;
  /** The package's JSON files, by the blob: URL it gave them. */
  json: Map<string, Uint8Array>;
}

const openedPackages = new Map<string, { file: string; opened: Promise<OpenedPackage> }>();
/** JSON files of every open package, by blob: URL, for fetchWithPackageJson. */
const packageJson = new Map<string, Uint8Array>();

function releasePackage({ pkg, json }: OpenedPackage) {
  for (const url of json.keys()) packageJson.delete(url);
  pkg.release();
}

/** The owner's opened file. A replaced file's package is released; avatars made from it keep their pictures. */
function openOwnerPackage(owner: AvatarOwnerRef, file: string): Promise<OpenedPackage> {
  const key = `${owner.ownerType}/${owner.ownerId}`;
  const current = openedPackages.get(key);
  if (current?.file === file) return current.opened;
  if (current) void current.opened.then(releasePackage, () => undefined);
  const opened = (async () => {
    const response = await api.raw(avatarModelFilePath(owner, file));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const pkg = await openAvatar(bytes);
    const files = unpackAvatar(bytes);
    const json = new Map<string, Uint8Array>();
    for (const [name, url] of Object.entries(pkg.assets)) {
      if (!name.endsWith(".json")) continue;
      // A copy, so the small JSON file never keeps the whole downloaded archive alive.
      const content = files[`built/${name}`]?.slice();
      if (!content) continue;
      json.set(url, content);
      packageJson.set(url, content);
    }
    return { pkg, json };
  })();
  const entry = { file, opened };
  openedPackages.set(key, entry);
  // A failed download is tried again by the next mount.
  opened.catch(() => {
    if (openedPackages.get(key) === entry) openedPackages.delete(key);
  });
  return opened;
}

// ponytail: mesh-avatar 0.1.1 reads a package's layers.json and sprites.json with fetch(blob: URL), and the
// Engine's Content-Security-Policy (connect-src in packages/server/src/middleware/security-headers.ts) does not
// allow blob: URLs. While an avatar loads, fetch answers exactly those URLs from memory and passes every other
// request through untouched; pictures load as images, which img-src allows. Upgrade path: a mesh-avatar
// release that reads package JSON without fetch, then delete this.
let loadsInFlight = 0;
let pageFetch = window.fetch;
const fetchWithPackageJson: typeof window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const json = packageJson.get(url);
  if (json) return Promise.resolve(new Response(json.slice(), { headers: { "Content-Type": "application/json" } }));
  return pageFetch.call(window, input, init);
};

async function whileLoading<T>(load: () => Promise<T>): Promise<T> {
  if (loadsInFlight++ === 0 && window.fetch !== fetchWithPackageJson) {
    pageFetch = window.fetch;
    window.fetch = fetchWithPackageJson;
  }
  try {
    return await load();
  } finally {
    if (--loadsInFlight === 0 && window.fetch === fetchWithPackageJson) window.fetch = pageFetch;
  }
}

export function createAvatarRenderer(): AvatarRenderer {
  let options: AvatarRendererMountOptions | null = null;
  let shared: SharedContext | null = null;
  let avatar: MeshAvatar | null = null;
  let rig: AvatarPackage["rig"] | null = null;
  let copy: CanvasRenderingContext2D | null = null;
  let fallback: AvatarRenderer | null = null;
  let fallingBack = false;
  let disposed = false;
  let paused = false;
  let lastSize: [number, number, number] | null = null;
  const pixels: Pixels = { width: 1, height: 1 };

  let face = { emotion: "" as AvatarEmotion | "", expression: "" };
  let mouthMode = "";
  let heldVowel = "";
  let speaking = false;
  let overridesKey = "";
  let eyeOpen = 1;

  const onLost = () => void showSprites("the WebGL context was lost");

  function teardown() {
    avatar?.destroy();
    avatar = null;
    if (shared) releaseSharedContext(shared, onLost);
    shared = null;
  }

  /** Shows the owner's PNGTuber setup (or sprites) on the same canvas instead. */
  async function showSprites(reason: string, error?: unknown) {
    if (fallingBack || disposed || !options) return;
    fallingBack = true;
    teardown();
    console.warn(`[avatars] Showing sprites instead of the mesh avatar: ${reason}`, error ?? "");
    const mounted = options;
    const { createAvatarRenderer: createSpriteRenderer } = await import("../pngtuber/pngtuber-renderer");
    if (disposed) return;
    const next = createSpriteRenderer();
    await next.mount(mounted);
    if (disposed) {
      next.dispose();
      return;
    }
    if (lastSize) next.resize(...lastSize);
    next.setPaused(paused);
    fallback = next;
  }

  function applyFrame(
    target: MeshAvatar,
    frame: AvatarFrameInput,
    mounted: AvatarRendererMountOptions,
    seconds: number,
  ) {
    const config = mounted.config;
    const expressionMap = config.kinds["mesh-avatar"]?.expressionMap ?? {};
    const still = mounted.reducedMotion || !config.features.idleMotion;

    const nextFace = meshAvatarFace(expressionMap, frame);
    const faceChanged = nextFace.emotion !== face.emotion || nextFace.expression !== face.expression;

    const mouth = meshAvatarMouth(expressionMap, frame, config.features.lipSync);
    const nextSpeaking = mouth.mode !== "off" && (frame.state === "talking" || frame.mouthOpen > 0.05);
    if (mouth.mode !== mouthMode) {
      if (mouthMode === "hold" || mouth.mode === "off") target.stopLipSync();
      mouthMode = mouth.mode;
      heldVowel = "";
    }
    if (mouth.mode === "hold") {
      if (mouth.vowel !== heldVowel) target.holdMouth(mouth.vowel as Parameters<MeshAvatar["holdMouth"]>[0]);
      heldVowel = mouth.vowel;
      // The level still drives the talking nod.
      target.setVoiceLevel(frame.mouthOpen);
    } else {
      target.setVoiceLevel(mouth.mode === "voice" ? mouth.level : 0);
    }
    const stoppedSpeaking = speaking && !nextSpeaking;
    if (nextSpeaking !== speaking) {
      target.setSpeaking(nextSpeaking);
      speaking = nextSpeaking;
    }
    // The runtime drops the emotion a second after speech ends (one emotion per spoken line); the director's
    // face should stay, so it is set again when speaking stops, after setSpeaking(false).
    if (faceChanged || stoppedSpeaking) {
      target.setEmotion(nextFace.emotion, { playMotion: faceChanged && !still });
      target.setExpression(nextFace.expression as Parameters<MeshAvatar["setExpression"]>[0]);
    }
    face = nextFace;

    eyeOpen = easeMeshAvatarEyes(eyeOpen, nextFace.emotion, seconds);
    const overrides = meshAvatarOverrides(frame, {
      still,
      blink: config.features.blink,
      eyeOpen,
      mouthOpen: mouth.mode === "hold" ? frame.mouthOpen : undefined,
    });
    const key = JSON.stringify(overrides);
    if (key !== overridesKey) {
      target.setParameters(overrides, 1);
      overridesKey = key;
    }
  }

  /** Steps the avatar by `seconds` (0 only draws), then copies the drawing onto this avatar's canvas. */
  function draw(seconds: number) {
    if (!avatar || !shared || !copy || !options || !rig) return;
    // One simulation step of `seconds`, drawn once (advance takes round(seconds * fps) steps).
    avatar.advance(seconds, seconds > 0 ? 1 / seconds : 60);
    const canvas = options.canvas;
    const drawn = meshAvatarCopyRect(rig, shared.canvas, canvas);
    copy.clearRect(0, 0, canvas.width, canvas.height);
    copy.drawImage(shared.canvas, drawn.x, drawn.y, drawn.width, drawn.height);
  }

  return {
    kind: "mesh-avatar",

    async mount(mountOptions) {
      options = mountOptions;
      const data = mountOptions.config.kinds["mesh-avatar"];
      if (!data) return showSprites("this owner has no mesh avatar");
      copy = mountOptions.canvas.getContext("2d");
      const context = acquireSharedContext(onLost, pixels);
      shared = context;
      if (!context || !copy) return showSprites("WebGL2 is not available");
      try {
        const { pkg } = await openOwnerPackage(mountOptions.owner, data.file);
        if (disposed || mountOptions.signal.aborted || !shared) return;
        const created = await whileLoading(() => loadMeshAvatar(context.canvas, pkg, { manual: true }));
        if (disposed || mountOptions.signal.aborted || !shared) {
          created.destroy();
          return;
        }
        const still = mountOptions.reducedMotion || !mountOptions.config.features.idleMotion;
        created.setAutoIdle(!still);
        created.setAutoMotion(!still);
        created.setSwayGain(still ? 0 : 1);
        created.setTalkGain(mountOptions.reducedMotion ? 0 : 1);
        rig = pkg.rig;
        avatar = created;
      } catch (error) {
        if (disposed || mountOptions.signal.aborted) return;
        await showSprites("the mesh avatar could not be loaded", error);
      }
    },

    update(frame, dtMs) {
      if (fallback) return fallback.update(frame, dtMs);
      if (disposed || paused || !avatar || !options) return;
      const seconds = Math.max(0, Math.min(0.05, dtMs / 1000));
      applyFrame(avatar, frame, options, seconds);
      draw(seconds);
    },

    resize(width, height, devicePixelRatio) {
      lastSize = [width, height, devicePixelRatio];
      if (fallback) return fallback.resize(width, height, devicePixelRatio);
      pixels.width = Math.max(1, Math.round(width * devicePixelRatio));
      pixels.height = Math.max(1, Math.round(height * devicePixelRatio));
      const canvas = options?.canvas;
      if (!canvas || (canvas.width === pixels.width && canvas.height === pixels.height)) return;
      canvas.width = pixels.width;
      canvas.height = pixels.height;
      // Resizing clears the canvas, and the stage's next frame may be a while off (or paused): draw it now.
      draw(0);
    },

    setPaused(value) {
      paused = value;
      fallback?.setPaused(value);
    },

    dispose() {
      disposed = true;
      teardown();
      fallback?.dispose();
      fallback = null;
      options = null;
      copy = null;
    },
  };
}
