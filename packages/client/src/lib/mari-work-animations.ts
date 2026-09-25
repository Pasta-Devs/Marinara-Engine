export type MariWorkAnimation = {
  id: string;
  src: string;
  /** The pack this sprite ships in. See MARI_ANIMATION_PACKS. */
  pack: MariAnimationPackId;
};

/**
 * Sprites are grouped into packs so a future drop is a new pack id plus its entries here, and the
 * omnibar's pack browser lists it without any further wiring. `core` is not disableable — every
 * selection pool falls back to it, so turning the last pack off could otherwise leave the work card
 * with no sprite at all.
 */
export type MariAnimationPackId = "core" | "expeditions";

const animation = (id: string, filename: string, pack: MariAnimationPackId = "core"): MariWorkAnimation => ({
  id,
  src: `/sprites/mari/generated/${filename}`,
  pack,
});

const ANIMATIONS = {
  assistant: animation("assistant", "professor-mari-assistant-sheet.png"),
  detective: animation("detective", "professor-mari-work-detective.png"),
  tea: animation("tea", "professor-mari-work-idea-tea.png"),
  books: animation("books", "professor-mari-work-book-tower.png"),
  train: animation("train", "professor-mari-work-train.png", "expeditions"),
  yarn: animation("yarn", "professor-mari-work-yarn.png"),
  deepDive: animation("deep-dive", "professor-mari-work-deep-dive.png", "expeditions"),
  airplane: animation("paper-airplane", "professor-mari-work-paper-airplane.png", "expeditions"),
  pixelBug: animation("pixel-bug", "professor-mari-inline-pixel-bug-sheet.png"),
  telescope: animation("telescope", "professor-mari-work-telescope.png", "expeditions"),
  boat: animation("boat", "professor-mari-work-boat.png", "expeditions"),
  puzzle: animation("puzzle", "professor-mari-work-puzzle.png"),
  spelunking: animation("spelunking", "professor-mari-work-spelunking.png", "expeditions"),
  origami: animation("origami", "professor-mari-work-origami.png"),
  constellation: animation("constellation", "professor-mari-work-constellation.png", "expeditions"),
  clockwork: animation("clockwork", "professor-mari-work-clockwork.png"),
  typewriter: animation("typewriter", "professor-mari-work-typewriter.png"),
  rocket: animation("rocket", "professor-mari-work-rocket.png", "expeditions"),
  images: animation("images", "professor-mari-work-images.png"),
  thinkingNotes: animation("thinking-notes", "professor-mari-work-thinking-notes.png"),
};

const GENERAL_POOL = [
  ANIMATIONS.assistant,
  ANIMATIONS.tea,
  ANIMATIONS.yarn,
  ANIMATIONS.airplane,
  ANIMATIONS.boat,
  ANIMATIONS.origami,
  ANIMATIONS.clockwork,
  ANIMATIONS.rocket,
  ANIMATIONS.thinkingNotes,
];
const RESEARCH_POOL = [
  ANIMATIONS.detective,
  ANIMATIONS.books,
  ANIMATIONS.deepDive,
  ANIMATIONS.telescope,
  ANIMATIONS.spelunking,
  ANIMATIONS.constellation,
  ANIMATIONS.thinkingNotes,
];
const PLANNING_POOL = [
  ANIMATIONS.yarn,
  ANIMATIONS.tea,
  ANIMATIONS.airplane,
  ANIMATIONS.telescope,
  ANIMATIONS.puzzle,
  ANIMATIONS.origami,
  ANIMATIONS.constellation,
];
const FILE_POOL = [
  ANIMATIONS.assistant,
  ANIMATIONS.detective,
  ANIMATIONS.yarn,
  ANIMATIONS.airplane,
  ANIMATIONS.origami,
  ANIMATIONS.typewriter,
];
const DEBUG_POOL = [
  ANIMATIONS.pixelBug,
  ANIMATIONS.detective,
  ANIMATIONS.deepDive,
  ANIMATIONS.puzzle,
  ANIMATIONS.spelunking,
  ANIMATIONS.clockwork,
];
const LONG_RUNNING_POOL = [
  ANIMATIONS.train,
  ANIMATIONS.tea,
  ANIMATIONS.books,
  ANIMATIONS.boat,
  ANIMATIONS.clockwork,
  ANIMATIONS.rocket,
];

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/** Pack metadata for the omnibar's pack browser. Counts are derived, never restated. */
export interface MariAnimationPack {
  id: MariAnimationPackId;
  /** English name; the caller localizes through the matching `mari.animationPacks.<id>` key. */
  label: string;
  description: string;
  /** True when the pack cannot be turned off, because the fallback sprite lives in it. */
  locked: boolean;
  animations: readonly MariWorkAnimation[];
}

const ALL_ANIMATIONS = Object.values(ANIMATIONS);

export const MARI_ANIMATION_PACKS: readonly MariAnimationPack[] = [
  {
    id: "core",
    label: "Core",
    description: "Mari's everyday desk work — reading, writing, tinkering, thinking.",
    locked: true,
    animations: ALL_ANIMATIONS.filter((entry) => entry.pack === "core"),
  },
  {
    id: "expeditions",
    label: "Expeditions",
    description: "Trips, dives and launches, for the long-running jobs.",
    locked: false,
    animations: ALL_ANIMATIONS.filter((entry) => entry.pack === "expeditions"),
  },
];

export function selectMariWorkAnimation({
  seed,
  activity,
  toolNames,
  disabledPacks,
}: {
  seed: string;
  activity: string;
  toolNames: string[];
  /** Pack ids the user turned off in the omnibar's settings menu. `core` is ignored. */
  disabledPacks?: readonly string[];
}): MariWorkAnimation {
  const signal = `${activity} ${toolNames.join(" ")}`.toLowerCase();
  let pool = GENERAL_POOL;
  if (/image|picture|portrait|sprite|thumbnail|gallery|illustrat|crop|visual/.test(signal)) {
    pool = [ANIMATIONS.images];
  } else if (/error|fail|debug|repair|fix|diagnos|test/.test(signal)) {
    pool = DEBUG_POOL;
  } else if (/search|research|read|fetch|browse|wiki|inspect|find|grep/.test(signal)) {
    pool = RESEARCH_POOL;
  } else if (/plan|reason|think|map|decid|compar|analy/.test(signal)) {
    pool = PLANNING_POOL;
  } else if (/write|edit|patch|create|update|remove|file/.test(signal)) {
    pool = FILE_POOL;
  } else if (/install|build|compile|command|shell|bash|terminal|wait/.test(signal)) {
    pool = LONG_RUNNING_POOL;
  }
  // A pool emptied by disabled packs falls back to core, never to nothing.
  const allowed = disabledPacks?.length
    ? pool.filter((entry) => entry.pack === "core" || !disabledPacks.includes(entry.pack))
    : pool;
  const usable = allowed.length > 0 ? allowed : ALL_ANIMATIONS.filter((entry) => entry.pack === "core");
  return usable[stableHash(seed) % usable.length] ?? ANIMATIONS.assistant;
}
