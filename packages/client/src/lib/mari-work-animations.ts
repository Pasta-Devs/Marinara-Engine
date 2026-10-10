export const MARI_STORY_STATES = [
  "thinking",
  "research",
  "planning",
  "editing",
  "debugging",
  "images",
  "waiting",
  "approval",
  "success",
  "retry",
  "cancelled",
  "idle",
] as const;

export type MariStoryState = (typeof MARI_STORY_STATES)[number];
export type MariWorkAnimation = { id: MariStoryState; src: string };

/** Pixel poses for onboarding, FAQ, the Home profile tab and the chibi (M16). */
export const MARI_POSES = [
  "wave",
  "greet",
  "point-up",
  "point-middle",
  "point-down",
  "explaining",
  "thinking",
  "profile",
  "chibi",
] as const;

export type MariPose = (typeof MARI_POSES)[number];

export interface MariAppearancePack {
  id: string;
  label: string;
  description: string;
  /** Workspace, omnibar and top-bar Maris resolve the same pack. */
  portraits: {
    idle: string;
    blink: string;
    shrug: string;
    drag: string;
    /** Slice 85 hover: the pointer rests on her (mouse only). Same frame as idle. */
    hover: string;
    /** 45b: six 96 px heads for the pull circle: neutral, down, down-left, down-right, peering, delighted. */
    pullHeads: string;
  };
  stories: Record<MariStoryState, MariWorkAnimation>;
  /** Every pack ships all nine; the Record type makes a missing pose a compile error, not a broken image. */
  poses: Record<MariPose, string>;
  /** R12: locked until the Activity overview's play time reaches this many hours. */
  unlock?: { playHours: number };
}

/**
 * Sprites keep their file names when art is replaced, and the service worker serves them CacheFirst
 * (`mari-sprites` in vite.config.ts). Bump this whenever any Mari art changes.
 */
export const MARI_SPRITE_VERSION = "39c2";

/** Every Mari URL is loaded by URL from its own pack folder, never imported into the bundle. */
const sprite = (path: string) => `/sprites/mari/${path}?v=${MARI_SPRITE_VERSION}`;
const packStories = (packId: string) =>
  Object.fromEntries(MARI_STORY_STATES.map((id) => [id, { id, src: sprite(`${packId}/${id}.webp`) }])) as Record<
    MariStoryState,
    MariWorkAnimation
  >;
const packPoses = (packId: string) =>
  Object.fromEntries(MARI_POSES.map((pose) => [pose, sprite(`${packId}/pose-${pose}.webp`)])) as Record<
    MariPose,
    string
  >;

export const MARI_APPEARANCE_PACKS: readonly MariAppearancePack[] = [
  {
    id: "basic",
    label: "Basic",
    description: "The classic pixel Professor Mari.",
    portraits: {
      idle: sprite("basic/portrait-idle.webp"),
      blink: sprite("basic/portrait-blink.webp"),
      shrug: sprite("basic/portrait-shrug.webp"),
      drag: sprite("basic/portrait-drag.webp"),
      hover: sprite("basic/portrait-hover.webp"),
      pullHeads: sprite("basic/pull-heads.webp"),
    },
    stories: packStories("basic"),
    poses: packPoses("basic"),
  },
  {
    id: "dottore",
    label: "Prof. Mari loves Dottore",
    description: "A cyan heart pin and a Dottore plush.",
    portraits: {
      idle: sprite("dottore/portrait-idle.webp"),
      blink: sprite("dottore/portrait-blink.webp"),
      shrug: sprite("dottore/portrait-shrug.webp"),
      drag: sprite("dottore/portrait-drag.webp"),
      hover: sprite("dottore/portrait-hover.webp"),
      pullHeads: sprite("dottore/pull-heads.webp"),
    },
    stories: packStories("dottore"),
    poses: packPoses("dottore"),
  },
  {
    id: "golden",
    label: "Golden Prof. Mari",
    description: "A gold outfit and a confident grin.",
    portraits: {
      idle: sprite("golden/portrait-idle.webp"),
      blink: sprite("golden/portrait-blink.webp"),
      shrug: sprite("golden/portrait-shrug.webp"),
      drag: sprite("golden/portrait-drag.webp"),
      hover: sprite("golden/portrait-hover.webp"),
      pullHeads: sprite("golden/pull-heads.webp"),
    },
    stories: packStories("golden"),
    poses: packPoses("golden"),
    unlock: { playHours: 100 },
  },
  {
    id: "safari",
    label: "Safari Prof. Mari",
    description: "Safari gear for jungle trips.",
    portraits: {
      idle: sprite("safari/portrait-idle.webp"),
      blink: sprite("safari/portrait-blink.webp"),
      shrug: sprite("safari/portrait-shrug.webp"),
      drag: sprite("safari/portrait-drag.webp"),
      hover: sprite("safari/portrait-hover.webp"),
      pullHeads: sprite("safari/pull-heads.webp"),
    },
    stories: packStories("safari"),
    poses: packPoses("safari"),
  },
];

/**
 * Loading tier per asset, for the selected pack only (M16). 1: on screen at first paint (the Home
 * profile tab and the Home Mari widget's greet pose): started from `main.tsx` with the page at high
 * priority, then `fetchpriority="high"` on the `<img>`. 2: likely next (omnibar, Mari pane, the Home
 * Mari header): prefetched once the app has loaded and is idle. (The top-bar presence line is CSS
 * only, no image.) The portraits stay tier 2 because some packs' portraits weigh ~330 KB. 3: behind
 * another step (onboarding, FAQ, the
 * chibi toast, the other stories, the pack chooser): lazy, only when that surface renders. The memory
 * wheel is CSS-only and loads with its surface.
 */
export const MARI_ASSET_TIER: {
  portraits: Record<keyof MariAppearancePack["portraits"], 1 | 2 | 3>;
  stories: Record<MariStoryState, 1 | 2 | 3>;
  poses: Record<MariPose, 1 | 2 | 3>;
} = {
  portraits: { idle: 2, blink: 2, shrug: 2, pullHeads: 2, drag: 2, hover: 2 },
  stories: {
    ...(Object.fromEntries(MARI_STORY_STATES.map((id) => [id, 3])) as Record<MariStoryState, 3>),
    // The live line starts on thinking and rests on idle, so both are warm before she is shown. A failed run
    // puts her in retry beside the error card, and a finished run shows success, so both are warm too.
    idle: 2,
    thinking: 2,
    retry: 2,
    success: 2,
  },
  poses: {
    profile: 1,
    chibi: 3,
    wave: 3,
    greet: 1,
    "point-up": 3,
    "point-middle": 3,
    "point-down": 3,
    explaining: 3,
    thinking: 3,
  },
};

/** `<img>` loading attributes for a tier. */
export function mariImgLoading(tier: 1 | 2 | 3) {
  if (tier === 1) return { fetchPriority: "high", decoding: "async" } as const;
  if (tier === 2) return { decoding: "async" } as const;
  return { loading: "lazy", decoding: "async" } as const;
}

/** The pack's URLs of one tier: tier 1 for the startup preload, tier 2 for the idle prefetch. */
export function mariAssetUrls(pack: MariAppearancePack, tier: 1 | 2): string[] {
  const urls = new Set<string>();
  for (const [slot, slotTier] of Object.entries(MARI_ASSET_TIER.portraits))
    if (slotTier === tier) urls.add(pack.portraits[slot as keyof MariAppearancePack["portraits"]]);
  for (const [id, slotTier] of Object.entries(MARI_ASSET_TIER.stories))
    if (slotTier === tier) urls.add(pack.stories[id as MariStoryState].src);
  for (const [pose, slotTier] of Object.entries(MARI_ASSET_TIER.poses))
    if (slotTier === tier) urls.add(pack.poses[pose as MariPose]);
  return [...urls];
}

export function getMariAppearancePack(id: unknown): MariAppearancePack {
  return MARI_APPEARANCE_PACKS.find((pack) => pack.id === id) ?? MARI_APPEARANCE_PACKS[0]!;
}

/** Whole hours of play time (`ActivityOverview.playTime.totalMs`), or null while unknown. */
export function playHoursFromMs(totalMs: number | null | undefined): number | null {
  return typeof totalMs === "number" && Number.isFinite(totalMs) ? Math.floor(totalMs / 3_600_000) : null;
}

/**
 * R12: a pack is usable once it has no rule, was unlocked before (kept even if play time later
 * drops, e.g. after deleting chats), or play time has reached its rule.
 */
export function isMariPackUnlocked(
  pack: MariAppearancePack,
  unlockedIds: readonly string[],
  playHours: number | null = null,
): boolean {
  if (!pack.unlock || unlockedIds.includes(pack.id)) return true;
  return playHours !== null && playHours >= pack.unlock.playHours;
}

/**
 * The pack that renders: the stored choice, or Basic while that choice is locked. The stored id is
 * never rewritten, so a locked pick returns by itself once it unlocks. Locked packs never load.
 */
export function resolveMariAppearancePack(
  storedId: unknown,
  unlockedIds: readonly string[],
  playHours: number | null = null,
): MariAppearancePack {
  const pack = getMariAppearancePack(storedId);
  return isMariPackUnlocked(pack, unlockedIds, playHours) ? pack : MARI_APPEARANCE_PACKS[0]!;
}

/** A completed reply alone is not evidence that a workspace change succeeded. */
export function resolveMariRestStory({
  working,
  failed,
  cancelled,
  needsApproval,
  hasAppliedChanges,
}: {
  working: boolean;
  failed: boolean;
  cancelled: boolean;
  needsApproval: boolean;
  hasAppliedChanges: boolean;
}): MariStoryState | null {
  if (working) return null;
  if (failed) return "retry";
  if (cancelled) return "cancelled";
  if (needsApproval) return "approval";
  return hasAppliedChanges ? "success" : null;
}

export function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/**
 * 1-based index into a phrase group. Each step moves on to the next phrase, so the live line never
 * repeats the one before it, and each run starts on a different phrase.
 */
export function pickMariPhraseIndex(count: number, runSeed: string, step: number): number {
  return ((stableHash(runSeed) + step) % count) + 1;
}

/** Prefer a real lifecycle state; tool activity only chooses working stories. */
export function selectMariWorkAnimation({
  activity,
  toolNames,
  packId,
  state,
}: {
  activity: string;
  toolNames: string[];
  packId?: string;
  state?: MariStoryState;
}): MariWorkAnimation {
  const stories = getMariAppearancePack(packId).stories;
  if (state) return stories[state];
  const signal = `${activity} ${toolNames.join(" ")}`.toLowerCase();
  if (/image|picture|portrait|sprite|thumbnail|gallery|illustrat|crop|visual/.test(signal)) return stories.images;
  if (/error|fail|debug|repair|fix|diagnos|test/.test(signal)) return stories.debugging;
  if (/search|research|read|fetch|browse|wiki|inspect|find|grep/.test(signal)) return stories.research;
  if (/plan|reason|map|decid|compar|analy/.test(signal)) return stories.planning;
  if (/write|edit|patch|create|update|remove|file/.test(signal)) return stories.editing;
  if (/install|build|compile|command|shell|bash|terminal|wait/.test(signal)) return stories.waiting;
  return stories.thinking;
}
