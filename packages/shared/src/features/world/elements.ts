// ──────────────────────────────────────────────
// A setting's elements (worldgen W6c): what an elemental attack can be, how two of them react when one
// lands on the other's aura, which beats which in a tactical fight, and how rain treats each.
// One set for every reader (the classic and tactical fights, the weather, the screen and the model's
// words), from the game's setting kit, or the classic six when it names none.
// ──────────────────────────────────────────────
import { z } from "zod";
import { gameWorldKitFromMetadata, type WorldKit } from "../../schemas/world-kit.schema.js";

/** A status a reaction leaves on its target, as the classic fight keeps them. */
export interface WorldElementEffect {
  name: string;
  modifier: number;
  stat: "attack" | "defense" | "speed" | "hp";
  turnsLeft: number;
}

export interface WorldElement {
  id: string;
  label: string;
  emoji: string;
  color: string;
  /** How exposed rain and storms treat it: hot is damped (fire), charged is fed (lightning). */
  weather?: "hot" | "charged";
}

export interface WorldElementReaction {
  /** The element already on the target (its aura), and the one landing on it. */
  trigger: string;
  appliedWith: string;
  reaction: string;
  damageMultiplier: number;
  effects: WorldElementEffect[];
  description: string;
}

export interface WorldElementSet {
  elements: WorldElement[];
  reactions: WorldElementReaction[];
  /** Which elements each one is strong against in a tactical fight (and so weak to the reverse). */
  beats: Record<string, string[]>;
}

/** A set as a saved fight carries it: checked when a save or a client's round-tripped state comes back,
 *  so a malformed one is refused rather than read. */
export const worldElementSetSchema = z
  .object({
    elements: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            label: z.string().min(1).max(80),
            emoji: z.string().max(16),
            color: z.string().max(16),
            weather: z.enum(["hot", "charged"]).optional(),
          })
          .strict(),
      )
      .max(12),
    reactions: z
      .array(
        z
          .object({
            trigger: z.string().min(1).max(80),
            appliedWith: z.string().min(1).max(80),
            reaction: z.string().min(1).max(80),
            damageMultiplier: z.number().finite().min(0).max(10),
            effects: z
              .array(
                z
                  .object({
                    name: z.string().max(80),
                    modifier: z.number().finite(),
                    stat: z.enum(["attack", "defense", "speed", "hp"]),
                    turnsLeft: z.number().int().min(0).max(100),
                  })
                  .strict(),
              )
              .max(8),
            description: z.string().max(400),
          })
          .strict(),
      )
      .max(64),
    beats: z.record(z.string(), z.array(z.string().max(80)).max(12)),
  })
  .strict();

/** Frozen all the way down, so no reader can change the defaults every game shares. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const each of Object.values(value)) deepFreeze(each);
    Object.freeze(value);
  }
  return value;
}

/** The classic six, the eight reactions and the tactical wheel every game had before kits named their own. */
export const WORLD_DEFAULT_ELEMENTS: WorldElementSet = deepFreeze({
  elements: [
    { id: "fire", label: "Fire", emoji: "🔥", color: "#ff4500", weather: "hot" as const },
    { id: "ice", label: "Ice", emoji: "❄️", color: "#00bfff" },
    { id: "lightning", label: "Lightning", emoji: "⚡", color: "#ffd700", weather: "charged" as const },
    { id: "poison", label: "Poison", emoji: "☠️", color: "#9400d3" },
    { id: "holy", label: "Holy", emoji: "✨", color: "#fffacd" },
    { id: "shadow", label: "Shadow", emoji: "🌑", color: "#4a0080" },
  ],
  reactions: [
    {
      trigger: "fire",
      appliedWith: "ice",
      reaction: "Melt",
      damageMultiplier: 1.5,
      effects: [{ name: "Chilled", modifier: -2, stat: "speed" as const, turnsLeft: 2 }],
      description: "Fire and ice clash — a massive melt eruption deals extra damage",
    },
    {
      trigger: "ice",
      appliedWith: "fire",
      reaction: "Shatter",
      damageMultiplier: 1.3,
      effects: [{ name: "Shattered", modifier: -3, stat: "defense" as const, turnsLeft: 1 }],
      description: "Frozen target shatters under the heat, cracking their armor",
    },
    {
      trigger: "fire",
      appliedWith: "lightning",
      reaction: "Overload",
      damageMultiplier: 1.8,
      effects: [{ name: "Stunned", modifier: -5, stat: "speed" as const, turnsLeft: 1 }],
      description: "Electrical charge ignites the flames — a thunderous overload explosion",
    },
    {
      trigger: "ice",
      appliedWith: "lightning",
      reaction: "Superconduct",
      damageMultiplier: 1.4,
      effects: [{ name: "Conductivity", modifier: -4, stat: "defense" as const, turnsLeft: 2 }],
      description: "Superconducting blast strips away physical resistance",
    },
    {
      trigger: "poison",
      appliedWith: "fire",
      reaction: "Toxic Blaze",
      damageMultiplier: 1.6,
      effects: [{ name: "Burning Toxin", modifier: -5, stat: "hp" as const, turnsLeft: 3 }],
      description: "Poisonous fumes ignite into a noxious inferno",
    },
    {
      trigger: "holy",
      appliedWith: "shadow",
      reaction: "Purification",
      damageMultiplier: 2.0,
      effects: [],
      description: "Light and darkness annihilate each other in a cataclysmic burst",
    },
    {
      trigger: "shadow",
      appliedWith: "holy",
      reaction: "Eclipse",
      damageMultiplier: 2.0,
      effects: [{ name: "Blinded", modifier: -3, stat: "attack" as const, turnsLeft: 2 }],
      description: "Blinding eclipse — darkness engulfs the light, disorienting the target",
    },
    {
      trigger: "lightning",
      appliedWith: "poison",
      reaction: "Electrotoxin",
      damageMultiplier: 1.5,
      effects: [
        { name: "Paralytic Venom", modifier: -4, stat: "speed" as const, turnsLeft: 2 },
        { name: "Corroding", modifier: -3, stat: "hp" as const, turnsLeft: 2 },
      ],
      description: "Electric current accelerates the spread of toxins through the body",
    },
  ],
  beats: { fire: ["ice"], ice: ["lightning"], lightning: ["fire"], holy: ["shadow"], shadow: ["holy"], poison: [] },
} as WorldElementSet);

/** Colours for a kit's elements that name none, in order. */
const PALETTE = ["#e4572e", "#29a3d9", "#f2c14e", "#7bc950", "#a463f2", "#f28cb1", "#8d99ae", "#3cbbb1"];

/** An element's label as its id: lowercase letters, digits and hyphens. */
function elementId(label: string, taken: Set<string>): string {
  const base =
    label
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `element-${taken.size + 1}`;
  let id = base;
  for (let count = 2; taken.has(id); count++) id = `${base}-${count}`;
  taken.add(id);
  return id;
}

/** The elements a game fights with: its kit's (none at all for a kit with an empty list), or the classic six. */
export function worldElementSet(kit: WorldKit | null | undefined): WorldElementSet {
  if (!kit?.elements) return WORLD_DEFAULT_ELEMENTS;
  const taken = new Set<string>();
  const elements: WorldElement[] = kit.elements.map((element, index) => ({
    id: elementId(element.label, taken),
    label: element.label,
    emoji: element.emoji ?? "✦",
    color: element.color ?? PALETTE[index % PALETTE.length]!,
    ...(element.weather ? { weather: element.weather } : {}),
  }));
  const idOf = (label: string) =>
    elements.find((element) => element.label.trim().toLowerCase() === label.trim().toLowerCase())?.id;
  const beats: Record<string, string[]> = {};
  kit.elements.forEach((element, index) => {
    beats[elements[index]!.id] = (element.beats ?? []).flatMap((label) => idOf(label) ?? []);
  });
  const reactions: WorldElementReaction[] = (kit.reactions ?? []).flatMap((reaction) => {
    const trigger = idOf(reaction.on);
    const appliedWith = idOf(reaction.with);
    if (!trigger || !appliedWith) return [];
    return [
      {
        trigger,
        appliedWith,
        reaction: reaction.label,
        damageMultiplier: reaction.times,
        effects: [],
        description: reaction.note ?? reaction.label,
      },
    ];
  });
  return { elements, reactions, beats };
}

/** Words the classic six go by in other games' tellings, read as the classic element. */
const CLASSIC_ALIASES: Record<string, string> = {
  pyro: "fire",
  flame: "fire",
  cryo: "ice",
  frost: "ice",
  electro: "lightning",
  thunder: "lightning",
  toxic: "poison",
  venom: "poison",
  light: "holy",
  radiant: "holy",
  dark: "shadow",
  darkness: "shadow",
};

/**
 * The element a word names in this set: its id or its label in any case, or (for the classic six) a
 * word other tellings use for one, such as "pyro". Undefined for a word the set has no element for.
 */
export function worldElementId(set: WorldElementSet, word: string | null | undefined): string | undefined {
  const key = word?.trim().toLowerCase();
  if (!key) return undefined;
  const found = set.elements.find((element) => element.id === key || element.label.toLowerCase() === key);
  if (found) return found.id;
  const alias = CLASSIC_ALIASES[key];
  return alias && set.elements.some((element) => element.id === alias) ? alias : undefined;
}

/** A game's own element set from its stored setting kit, or undefined for the classic six (a game with no
 *  kit, or a kit that names no elements), so a fight's state only carries a set when it has its own. */
export function gameWorldElementSet(metadata: Record<string, unknown> | null | undefined): WorldElementSet | undefined {
  const kit = gameWorldKitFromMetadata(metadata);
  return kit?.elements ? worldElementSet(kit) : undefined;
}
