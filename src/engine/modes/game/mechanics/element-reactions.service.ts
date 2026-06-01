// ──────────────────────────────────────────────
// Service: Elemental Reaction System
//
// Implements element-based combat chains inspired
// by Genshin Impact and Honkai: Star Rail.
// Three built-in presets: "default", "genshin",
// "hsr". Each defines elements, auras, and
// reaction rules.
// ──────────────────────────────────────────────

import type { StatusEffect } from "./status-effect.js";

// ── Core types ──

interface ElementDefinition {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface ReactionRule {
  /** Element already applied (aura) */
  trigger: string;
  /** Incoming element */
  appliedWith: string;
  /** Resulting reaction name */
  reaction: string;
  /** Damage multiplier applied to the triggering hit */
  damageMultiplier: number;
  /** Status effects inflicted on the target */
  effects: StatusEffect[];
  /** Short description for narration */
  description: string;
}

export interface ElementPreset {
  name: string;
  elements: ElementDefinition[];
  reactions: ReactionRule[];
}

/** Element aura currently on a combatant */
export interface ElementAura {
  element: string;
  /** Gauge units remaining (consumed on reaction) */
  gauge: number;
  /** Who applied the aura */
  sourceId: string;
}

export interface ReactionResult {
  reaction: string;
  description: string;
  damageMultiplier: number;
  appliedEffects: StatusEffect[];
  consumedAura: boolean;
}

// ── Default preset (classic RPG elements) ──

const DEFAULT_ELEMENTS: ElementDefinition[] = [
  { id: "fire", name: "Fire", emoji: "🔥", color: "#ff4500" },
  { id: "ice", name: "Ice", emoji: "❄️", color: "#00bfff" },
  { id: "lightning", name: "Lightning", emoji: "⚡", color: "#ffd700" },
  { id: "poison", name: "Poison", emoji: "☠️", color: "#9400d3" },
  { id: "holy", name: "Holy", emoji: "✨", color: "#fffacd" },
  { id: "shadow", name: "Shadow", emoji: "🌑", color: "#4a0080" },
];

const DEFAULT_REACTIONS: ReactionRule[] = [
  {
    trigger: "fire",
    appliedWith: "ice",
    reaction: "Melt",
    damageMultiplier: 1.5,
    effects: [{ name: "Chilled", modifier: -2, stat: "speed", turnsLeft: 2 }],
    description: "Fire and ice clash — a massive melt eruption deals extra damage",
  },
  {
    trigger: "ice",
    appliedWith: "fire",
    reaction: "Shatter",
    damageMultiplier: 1.3,
    effects: [{ name: "Shattered", modifier: -3, stat: "defense", turnsLeft: 1 }],
    description: "Frozen target shatters under the heat, cracking their armor",
  },
  {
    trigger: "fire",
    appliedWith: "lightning",
    reaction: "Overload",
    damageMultiplier: 1.8,
    effects: [{ name: "Stunned", modifier: -5, stat: "speed", turnsLeft: 1 }],
    description: "Electrical charge ignites the flames — a thunderous overload explosion",
  },
  {
    trigger: "ice",
    appliedWith: "lightning",
    reaction: "Superconduct",
    damageMultiplier: 1.4,
    effects: [{ name: "Conductivity", modifier: -4, stat: "defense", turnsLeft: 2 }],
    description: "Superconducting blast strips away physical resistance",
  },
  {
    trigger: "poison",
    appliedWith: "fire",
    reaction: "Toxic Blaze",
    damageMultiplier: 1.6,
    effects: [{ name: "Burning Toxin", modifier: -5, stat: "hp", turnsLeft: 3 }],
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
    effects: [{ name: "Blinded", modifier: -3, stat: "attack", turnsLeft: 2 }],
    description: "Blinding eclipse — darkness engulfs the light, disorienting the target",
  },
  {
    trigger: "lightning",
    appliedWith: "poison",
    reaction: "Electrotoxin",
    damageMultiplier: 1.5,
    effects: [
      { name: "Paralytic Venom", modifier: -4, stat: "speed", turnsLeft: 2 },
      { name: "Corroding", modifier: -3, stat: "hp", turnsLeft: 2 },
    ],
    description: "Electric current accelerates the spread of toxins through the body",
  },
];

// ── Genshin Impact preset ──

const GENSHIN_ELEMENTS: ElementDefinition[] = [
  { id: "pyro", name: "Pyro", emoji: "🔥", color: "#ff4500" },
  { id: "hydro", name: "Hydro", emoji: "💧", color: "#4169e1" },
  { id: "electro", name: "Electro", emoji: "⚡", color: "#9b59b6" },
  { id: "cryo", name: "Cryo", emoji: "❄️", color: "#00bfff" },
  { id: "anemo", name: "Anemo", emoji: "🌪️", color: "#77dd77" },
  { id: "geo", name: "Geo", emoji: "🪨", color: "#daa520" },
  { id: "dendro", name: "Dendro", emoji: "🌿", color: "#228b22" },
];

const GENSHIN_REACTIONS: ReactionRule[] = [
  {
    trigger: "pyro",
    appliedWith: "hydro",
    reaction: "Vaporize",
    damageMultiplier: 2.0,
    effects: [],
    description: "A massive steam explosion as fire meets water — doubled damage",
  },
  {
    trigger: "hydro",
    appliedWith: "pyro",
    reaction: "Vaporize (Reverse)",
    damageMultiplier: 1.5,
    effects: [],
    description: "Steam erupts as water evaporates — 1.5x damage",
  },
  {
    trigger: "pyro",
    appliedWith: "cryo",
    reaction: "Melt",
    damageMultiplier: 2.0,
    effects: [],
    description: "Ice melts explosively under intense heat — doubled damage",
  },
  {
    trigger: "cryo",
    appliedWith: "pyro",
    reaction: "Melt (Reverse)",
    damageMultiplier: 1.5,
    effects: [],
    description: "Frozen target thaws violently — 1.5x damage",
  },
  {
    trigger: "hydro",
    appliedWith: "cryo",
    reaction: "Frozen",
    damageMultiplier: 1.0,
    effects: [{ name: "Frozen", modifier: -99, stat: "speed", turnsLeft: 1 }],
    description: "Target is encased in ice, unable to act",
  },
  {
    trigger: "pyro",
    appliedWith: "electro",
    reaction: "Overloaded",
    damageMultiplier: 1.5,
    effects: [{ name: "Overloaded", modifier: -3, stat: "defense", turnsLeft: 1 }],
    description: "Explosive overload sends the target flying",
  },
  {
    trigger: "hydro",
    appliedWith: "electro",
    reaction: "Electro-Charged",
    damageMultiplier: 1.2,
    effects: [{ name: "Electro-Charged", modifier: -3, stat: "hp", turnsLeft: 2 }],
    description: "Electricity arcs through water, shocking the target repeatedly",
  },
  {
    trigger: "cryo",
    appliedWith: "electro",
    reaction: "Superconduct",
    damageMultiplier: 1.3,
    effects: [{ name: "Superconduct", modifier: -5, stat: "defense", turnsLeft: 2 }],
    description: "Superconducting blast shreds physical resistance",
  },
  {
    trigger: "dendro",
    appliedWith: "pyro",
    reaction: "Burning",
    damageMultiplier: 1.0,
    effects: [{ name: "Burning", modifier: -4, stat: "hp", turnsLeft: 3 }],
    description: "Vegetation ignites — the target burns over time",
  },
  {
    trigger: "dendro",
    appliedWith: "hydro",
    reaction: "Bloom",
    damageMultiplier: 1.5,
    effects: [{ name: "Bloom Seed", modifier: -2, stat: "hp", turnsLeft: 1 }],
    description: "A Dendro Core forms and detonates",
  },
  {
    trigger: "dendro",
    appliedWith: "electro",
    reaction: "Quicken",
    damageMultiplier: 1.4,
    effects: [{ name: "Quickened", modifier: 3, stat: "attack", turnsLeft: 2 }],
    description: "Dendro and Electro catalyze — empowering follow-up attacks",
  },
  {
    trigger: "pyro",
    appliedWith: "anemo",
    reaction: "Swirl (Pyro)",
    damageMultiplier: 1.3,
    effects: [],
    description: "Wind spreads flames outward in a fiery vortex",
  },
  {
    trigger: "hydro",
    appliedWith: "anemo",
    reaction: "Swirl (Hydro)",
    damageMultiplier: 1.3,
    effects: [],
    description: "Water swirls outward in a hydro tornado",
  },
  {
    trigger: "cryo",
    appliedWith: "anemo",
    reaction: "Swirl (Cryo)",
    damageMultiplier: 1.3,
    effects: [],
    description: "Frozen wind spreads cryo to all nearby",
  },
  {
    trigger: "electro",
    appliedWith: "anemo",
    reaction: "Swirl (Electro)",
    damageMultiplier: 1.3,
    effects: [],
    description: "Lightning sparks scatter in the wind",
  },
  {
    trigger: "pyro",
    appliedWith: "geo",
    reaction: "Crystallize (Pyro)",
    damageMultiplier: 1.0,
    effects: [{ name: "Pyro Shield", modifier: 3, stat: "defense", turnsLeft: 2 }],
    description: "A crystallized pyro shield forms, absorbing damage",
  },
  {
    trigger: "cryo",
    appliedWith: "geo",
    reaction: "Crystallize (Cryo)",
    damageMultiplier: 1.0,
    effects: [{ name: "Cryo Shield", modifier: 3, stat: "defense", turnsLeft: 2 }],
    description: "A crystallized cryo shield forms, absorbing damage",
  },
  // Reverse reaction pairs
  {
    trigger: "electro",
    appliedWith: "pyro",
    reaction: "Overloaded",
    damageMultiplier: 1.5,
    effects: [{ name: "Overloaded", modifier: -3, stat: "defense", turnsLeft: 1 }],
    description: "Explosive overload sends the target flying",
  },
  {
    trigger: "electro",
    appliedWith: "hydro",
    reaction: "Electro-Charged",
    damageMultiplier: 1.2,
    effects: [{ name: "Electro-Charged", modifier: -3, stat: "hp", turnsLeft: 2 }],
    description: "Electricity arcs through water, shocking the target repeatedly",
  },
  {
    trigger: "electro",
    appliedWith: "cryo",
    reaction: "Superconduct",
    damageMultiplier: 1.3,
    effects: [{ name: "Superconduct", modifier: -5, stat: "defense", turnsLeft: 2 }],
    description: "Superconducting blast shreds physical resistance",
  },
  {
    trigger: "cryo",
    appliedWith: "hydro",
    reaction: "Frozen",
    damageMultiplier: 1.0,
    effects: [{ name: "Frozen", modifier: -99, stat: "speed", turnsLeft: 1 }],
    description: "Target is encased in ice, unable to act",
  },
  {
    trigger: "hydro",
    appliedWith: "geo",
    reaction: "Crystallize (Hydro)",
    damageMultiplier: 1.0,
    effects: [{ name: "Hydro Shield", modifier: 3, stat: "defense", turnsLeft: 2 }],
    description: "A crystallized hydro shield forms, absorbing damage",
  },
  {
    trigger: "electro",
    appliedWith: "geo",
    reaction: "Crystallize (Electro)",
    damageMultiplier: 1.0,
    effects: [{ name: "Electro Shield", modifier: 3, stat: "defense", turnsLeft: 2 }],
    description: "A crystallized electro shield forms, absorbing damage",
  },
];

// ── HSR preset (Honkai: Star Rail) ──

const HSR_ELEMENTS: ElementDefinition[] = [
  { id: "physical", name: "Physical", emoji: "⚔️", color: "#c0c0c0" },
  { id: "fire", name: "Fire", emoji: "🔥", color: "#ff4500" },
  { id: "ice", name: "Ice", emoji: "❄️", color: "#00bfff" },
  { id: "lightning", name: "Lightning", emoji: "⚡", color: "#9b59b6" },
  { id: "wind", name: "Wind", emoji: "🌪️", color: "#77dd77" },
  { id: "quantum", name: "Quantum", emoji: "🔮", color: "#6a0dad" },
  { id: "imaginary", name: "Imaginary", emoji: "✦", color: "#ffd700" },
];

const HSR_REACTIONS: ReactionRule[] = [
  {
    trigger: "fire",
    appliedWith: "fire",
    reaction: "Burn",
    damageMultiplier: 1.0,
    effects: [{ name: "Burn", modifier: -4, stat: "hp", turnsLeft: 3 }],
    description: "Sustained fire damage burns the target over time",
  },
  {
    trigger: "ice",
    appliedWith: "ice",
    reaction: "Freeze",
    damageMultiplier: 1.0,
    effects: [{ name: "Frozen", modifier: -99, stat: "speed", turnsLeft: 1 }],
    description: "Target is encased in ice, unable to act",
  },
  {
    trigger: "lightning",
    appliedWith: "lightning",
    reaction: "Shock",
    damageMultiplier: 1.0,
    effects: [{ name: "Shocked", modifier: -3, stat: "hp", turnsLeft: 2 }],
    description: "Electrical shock damages the target each turn",
  },
  {
    trigger: "wind",
    appliedWith: "wind",
    reaction: "Wind Shear",
    damageMultiplier: 1.0,
    effects: [{ name: "Wind Shear", modifier: -3, stat: "hp", turnsLeft: 3 }],
    description: "Razor wind continues to slice the target",
  },
  {
    trigger: "physical",
    appliedWith: "physical",
    reaction: "Bleed",
    damageMultiplier: 1.0,
    effects: [{ name: "Bleed", modifier: -3, stat: "hp", turnsLeft: 3 }],
    description: "Sustained physical trauma causes bleeding",
  },
  {
    trigger: "quantum",
    appliedWith: "quantum",
    reaction: "Entanglement",
    damageMultiplier: 1.2,
    effects: [{ name: "Entangled", modifier: -4, stat: "speed", turnsLeft: 1 }],
    description: "Quantum entanglement traps the target in a probability collapse",
  },
  {
    trigger: "imaginary",
    appliedWith: "imaginary",
    reaction: "Imprisonment",
    damageMultiplier: 1.0,
    effects: [{ name: "Imprisoned", modifier: -5, stat: "speed", turnsLeft: 1 }],
    description: "Imaginary prison delays the target's next action",
  },
  // Cross-element reaction examples for HSR
  {
    trigger: "fire",
    appliedWith: "ice",
    reaction: "Thermal Shock",
    damageMultiplier: 1.5,
    effects: [{ name: "Brittle", modifier: -3, stat: "defense", turnsLeft: 2 }],
    description: "Rapid temperature change shatters the target's resistance",
  },
  {
    trigger: "ice",
    appliedWith: "fire",
    reaction: "Flash Thaw",
    damageMultiplier: 1.5,
    effects: [{ name: "Weakened", modifier: -2, stat: "attack", turnsLeft: 2 }],
    description: "Melting ice releases a burst of energy, weakening the target",
  },
  {
    trigger: "lightning",
    appliedWith: "quantum",
    reaction: "Quantum Discharge",
    damageMultiplier: 1.8,
    effects: [{ name: "Disrupted", modifier: -4, stat: "defense", turnsLeft: 1 }],
    description: "Quantum-charged lightning ruptures the target's defenses",
  },
  {
    trigger: "wind",
    appliedWith: "imaginary",
    reaction: "Void Storm",
    damageMultiplier: 1.6,
    effects: [{ name: "Void Touched", modifier: -3, stat: "attack", turnsLeft: 2 }],
    description: "Imaginary particles scatter in the wind, eroding the target's power",
  },
];

// ── Preset registry ──

const PRESETS: Record<string, ElementPreset> = {
  default: { name: "Classic RPG", elements: DEFAULT_ELEMENTS, reactions: DEFAULT_REACTIONS },
  genshin: { name: "Genshin Impact", elements: GENSHIN_ELEMENTS, reactions: GENSHIN_REACTIONS },
  hsr: { name: "Honkai: Star Rail", elements: HSR_ELEMENTS, reactions: HSR_REACTIONS },
};

/** Get a preset by name. Defaults to "default". */
export function getElementPreset(name?: string | null): ElementPreset {
  return PRESETS[name ?? "default"] ?? PRESETS["default"]!;
}

/** List available preset names. */
export function listElementPresets(): string[] {
  return Object.keys(PRESETS);
}

// ── Reaction resolution ──

/**
 * Apply an element to a target that may already have an aura.
 * Returns the reaction (if any) and updated aura.
 */
export function resolveElementApplication(
  existingAura: ElementAura | null,
  incomingElement: string,
  sourceId: string,
  preset?: string,
): { reaction: ReactionResult | null; newAura: ElementAura | null } {
  const { reactions } = getElementPreset(preset);

  // No existing aura → apply as new aura
  if (!existingAura) {
    return {
      reaction: null,
      newAura: { element: incomingElement, gauge: 1, sourceId },
    };
  }

  // Same source re-applying same element → refresh gauge
  if (existingAura.element === incomingElement && existingAura.sourceId === sourceId) {
    return {
      reaction: null,
      newAura: { ...existingAura, gauge: Math.min(2, existingAura.gauge + 0.5) },
    };
  }

  // Look for a reaction
  const rule = reactions.find((r) => r.trigger === existingAura.element && r.appliedWith === incomingElement);

  if (rule) {
    // Reaction found — consume aura
    const newGauge = existingAura.gauge - 1;
    return {
      reaction: {
        reaction: rule.reaction,
        description: rule.description,
        damageMultiplier: rule.damageMultiplier,
        appliedEffects: rule.effects.map((e) => ({ ...e })),
        consumedAura: newGauge <= 0,
      },
      newAura: newGauge > 0 ? { ...existingAura, gauge: newGauge } : null,
    };
  }

  // No reaction — overwrite aura with new element
  return {
    reaction: null,
    newAura: { element: incomingElement, gauge: 1, sourceId },
  };
}

/**
 * Compute bonus damage from an elemental reaction.
 * Takes the base finalDamage and applies the reaction multiplier.
 */
export function applyReactionDamage(baseDamage: number, reaction: ReactionResult): number {
  return Math.floor(baseDamage * reaction.damageMultiplier);
}
