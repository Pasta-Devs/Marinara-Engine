// ──────────────────────────────────────────────
// Game: Combat Math Service
//
// Deterministic combat calculations — initiative,
// damage, defense, status effects. The LLM only
// narrates the results; it never does the math.
// ──────────────────────────────────────────────

import { rollDice } from "./dice.service.js";
import type { CombatItemEffect, CombatMechanic, CombatSkill } from "@marinara-engine/shared";
import type { ElementAura, ReactionResult } from "./element-reactions.service.js";
import { resolveElementApplication, applyReactionDamage } from "./element-reactions.service.js";

// ── Types ──

export interface CombatantStats {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  mp?: number;
  maxMp?: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  /** Optional status effects currently active */
  statusEffects?: StatusEffect[];
  /** Optional combat skills available to this combatant */
  skills?: CombatSkill[];
  /** Element the combatant attacks with (if any) */
  element?: string;
  /** Current elemental aura on this combatant */
  elementAura?: ElementAura | null;
}

export interface StatusEffect {
  name: string;
  /** Positive = buff, negative = debuff */
  modifier: number;
  /** Stat it modifies */
  stat: "attack" | "defense" | "speed" | "hp";
  /** Turns remaining */
  turnsLeft: number;
}

function toStatusEffect(status: CombatItemEffect["status"] | undefined, fallbackName: string): StatusEffect {
  return {
    name: status?.name?.trim() || fallbackName,
    modifier: typeof status?.modifier === "number" ? status.modifier : -2,
    stat: status?.stat ?? "defense",
    turnsLeft: Math.max(1, Number(status?.duration) || 2),
  };
}

function applyNamedStatus(target: CombatantStats, effect: StatusEffect) {
  if (!target.statusEffects) target.statusEffects = [];
  const existing = target.statusEffects.find((candidate) => candidate.name.toLowerCase() === effect.name.toLowerCase());
  if (existing) {
    existing.turnsLeft = Math.max(existing.turnsLeft, effect.turnsLeft);
    existing.modifier = effect.modifier;
    existing.stat = effect.stat;
  } else {
    target.statusEffects.push(effect);
  }
}

export interface InitiativeEntry {
  id: string;
  name: string;
  roll: number;
  speed: number;
  total: number;
}

export interface AttackResult {
  attackerId: string;
  defenderId: string;
  attackRoll: number;
  defenseRoll: number;
  rawDamage: number;
  mitigated: number;
  finalDamage: number;
  isCritical: boolean;
  isMiss: boolean;
  remainingHp: number;
  isKo: boolean;
  /** True when the action restored HP instead of damaging the target */
  isHeal?: boolean;
  /** Skill used, if any */
  skillName?: string;
  /** Elemental reaction triggered (if any) */
  reaction?: ReactionResult | null;
  /** Element used in the attack (if any) */
  element?: string;
}

export interface CombatRoundResult {
  round: number;
  initiative: InitiativeEntry[];
  actions: AttackResult[];
  statusTicks: Array<{ id: string; effect: string; expired: boolean }>;
  /** Elemental reactions that occurred this round */
  reactions: Array<{ attackerId: string; defenderId: string; reaction: string; description: string }>;
}

function resolveSkillAction(
  attacker: CombatantStats,
  target: CombatantStats,
  skill: CombatSkill,
  difficulty: string = "normal",
  elementPreset?: string,
): AttackResult {
  const currentMp = attacker.mp ?? 0;
  if (skill.mpCost > currentMp) {
    const fallback = resolveAttack(attacker, target, difficulty, elementPreset);
    return { ...fallback, skillName: skill.name };
  }

  attacker.mp = Math.max(0, currentMp - skill.mpCost);

  if (skill.type === "heal") {
    const healAmount = Math.max(1, Math.floor((attacker.attack + attacker.level * 2) * Math.max(skill.power, 0.5)));
    const remainingHp = Math.min(target.maxHp, target.hp + healAmount);

    return {
      attackerId: attacker.id,
      defenderId: target.id,
      attackRoll: 0,
      defenseRoll: 0,
      rawDamage: healAmount,
      mitigated: 0,
      finalDamage: healAmount,
      isCritical: false,
      isMiss: false,
      remainingHp,
      isKo: remainingHp <= 0,
      isHeal: true,
      skillName: skill.name,
      element: attacker.element,
      reaction: null,
    };
  }

  const skilledAttacker: CombatantStats = {
    ...attacker,
    attack: Math.max(1, Math.floor(attacker.attack * Math.max(skill.power, 1))),
    element: skill.element || attacker.element,
  };
  const result = resolveAttack(skilledAttacker, target, difficulty, elementPreset);
  if (!result.isMiss && skill.statusEffect) {
    applyNamedStatus(target, {
      name: skill.statusEffect,
      modifier: -2,
      stat: "defense",
      turnsLeft: Math.max(1, Number(skill.cooldown) || 2),
    });
  }
  return { ...result, skillName: skill.name };
}

function resolveItemAction(
  attacker: CombatantStats,
  target: CombatantStats,
  itemId?: string,
  itemEffect?: CombatItemEffect,
  elementPreset?: string,
): AttackResult {
  const itemName = itemId?.trim() || "Item";
  const effectType = itemEffect?.type;
  if (itemEffect && effectType && effectType !== "heal") {
    const power = Math.max(0.05, Math.min(2.5, Number(itemEffect.power) || 0.25));
    const element = itemEffect.element || attacker.element;

    if (effectType === "damage" || effectType === "status" || effectType === "debuff") {
      const finalDamage =
        effectType === "damage" ? Math.max(1, Math.floor(Math.max(attacker.attack, target.maxHp) * power)) : 0;
      const remainingHp = Math.max(0, target.hp - finalDamage);

      if (itemEffect.status || effectType === "status" || effectType === "debuff") {
        applyNamedStatus(target, toStatusEffect(itemEffect.status, itemEffect.status?.name || itemName));
      }

      let reaction: ReactionResult | null = null;
      if (element && finalDamage > 0) {
        const { reaction: r, newAura } = resolveElementApplication(
          target.elementAura ?? null,
          element,
          attacker.id,
          elementPreset,
        );
        target.elementAura = newAura;
        if (r) reaction = r;
      }

      return {
        attackerId: attacker.id,
        defenderId: target.id,
        attackRoll: 0,
        defenseRoll: 0,
        rawDamage: finalDamage,
        mitigated: 0,
        finalDamage: reaction ? applyReactionDamage(finalDamage, reaction) : finalDamage,
        isCritical: false,
        isMiss: false,
        remainingHp: reaction ? Math.max(0, target.hp - applyReactionDamage(finalDamage, reaction)) : remainingHp,
        isKo: (reaction ? Math.max(0, target.hp - applyReactionDamage(finalDamage, reaction)) : remainingHp) <= 0,
        skillName: itemName,
        element,
        reaction,
      };
    }

    if (effectType === "buff") {
      applyNamedStatus(target, {
        ...toStatusEffect(itemEffect.status, itemName),
        modifier: Math.abs(itemEffect.status?.modifier ?? 2),
        stat: itemEffect.status?.stat ?? "defense",
      });
      return {
        attackerId: attacker.id,
        defenderId: target.id,
        attackRoll: 0,
        defenseRoll: 0,
        rawDamage: 0,
        mitigated: 0,
        finalDamage: 0,
        isCritical: false,
        isMiss: false,
        remainingHp: target.hp,
        isKo: target.hp <= 0,
        isHeal: true,
        skillName: itemName,
        element,
        reaction: null,
      };
    }
  }

  const lowerName = itemName.toLowerCase();
  const potency = /mega|greater|large|strong|elixir|max/.test(lowerName)
    ? 0.5
    : /minor|small|snack|ration/.test(lowerName)
      ? 0.2
      : 0.3;
  const desiredHeal = Math.max(1, Math.floor(target.maxHp * potency));
  const remainingHp = Math.min(target.maxHp, target.hp + desiredHeal);
  const actualHeal = Math.max(0, remainingHp - target.hp);

  return {
    attackerId: attacker.id,
    defenderId: target.id,
    attackRoll: 0,
    defenseRoll: 0,
    rawDamage: actualHeal,
    mitigated: 0,
    finalDamage: actualHeal,
    isCritical: false,
    isMiss: false,
    remainingHp,
    isKo: remainingHp <= 0,
    isHeal: true,
    skillName: itemName,
    element: attacker.element,
    reaction: null,
  };
}

function chooseAutoSkill(
  attacker: CombatantStats,
  allies: CombatantStats[],
  enemies: CombatantStats[],
  round: number,
): { skill: CombatSkill; target: CombatantStats } | null {
  const usableSkills = (attacker.skills ?? []).filter((skill) => {
    if ((attacker.mp ?? 0) < skill.mpCost) return false;
    const cooldown = Math.max(0, Math.floor(Number(skill.cooldown) || 0));
    return cooldown <= 1 || round % cooldown === 0;
  });
  if (usableSkills.length === 0) return null;

  const injuredAlly = allies
    .filter((ally) => ally.hp > 0 && ally.hp < ally.maxHp)
    .sort((a, b) => a.hp / Math.max(1, a.maxHp) - b.hp / Math.max(1, b.maxHp))[0];
  const healSkill = injuredAlly ? usableSkills.find((skill) => skill.type === "heal") : undefined;
  if (healSkill && injuredAlly && injuredAlly.hp / Math.max(1, injuredAlly.maxHp) <= 0.75) {
    return { skill: healSkill, target: injuredAlly };
  }

  const offensiveSkills = usableSkills.filter((skill) => skill.type !== "heal");
  if (offensiveSkills.length === 0 || enemies.length === 0 || Math.random() >= 0.45) {
    return null;
  }

  const skill = offensiveSkills[Math.floor(Math.random() * offensiveSkills.length)]!;
  const target = enemies[Math.floor(Math.random() * enemies.length)]!;
  return { skill, target };
}

// ── Functions ──

/** Roll initiative for all combatants. Returns sorted order (highest first). */
export function rollInitiative(combatants: CombatantStats[]): InitiativeEntry[] {
  const entries: InitiativeEntry[] = combatants.map((c) => {
    const speedMod = Math.floor(c.speed / 5);
    const roll = rollDice("1d20").total;
    return {
      id: c.id,
      name: c.name,
      roll,
      speed: c.speed,
      total: roll + speedMod,
    };
  });

  return entries.sort((a, b) => b.total - a.total);
}

/** Calculate a single attack from attacker against defender. */
export function resolveAttack(
  attacker: CombatantStats,
  defender: CombatantStats,
  difficulty: string = "normal",
  elementPreset?: string,
): AttackResult {
  // Attack roll: 1d20 + attack stat modifier
  const attackMod = Math.floor(attacker.attack / 3);
  const attackRoll = rollDice("1d20").total + attackMod;

  // Defense check: 1d20 + defense stat modifier
  const defenseMod = Math.floor(defender.defense / 3);
  const defenseRoll = rollDice("1d20").total + defenseMod;

  // Miss check
  const isMiss = attackRoll < defenseRoll;

  // Critical hit check (natural 20 or attack roll exceeds defense by 10+)
  const isCritical = !isMiss && (attackRoll - defenseMod >= 20 || attackRoll - defenseRoll >= 10);

  // Damage calculation
  let rawDamage = 0;
  if (!isMiss) {
    // Base damage: attack stat scaled by level
    const baseDamage = Math.max(1, Math.floor(attacker.attack * (1 + attacker.level * 0.1)));
    // Dice component: scales with level
    const damageDice = rollDice(`${Math.max(1, Math.floor(attacker.level / 2))}d6`).total;
    rawDamage = baseDamage + damageDice;

    if (isCritical) rawDamage = Math.floor(rawDamage * 1.5);
  }

  // Mitigation from defense
  const mitigation = Math.floor(defender.defense * 0.4);
  const mitigated = Math.min(rawDamage, mitigation);
  let finalDamage = Math.max(0, rawDamage - mitigated);

  // Difficulty scaling
  const difficultyMult: Record<string, number> = {
    casual: 0.6,
    normal: 1.0,
    hard: 1.3,
    brutal: 1.6,
  };
  finalDamage = Math.floor(finalDamage * (difficultyMult[difficulty] ?? 1.0));

  // Apply status effect modifiers
  if (attacker.statusEffects) {
    for (const effect of attacker.statusEffects) {
      if (effect.stat === "attack") finalDamage = Math.max(0, finalDamage + effect.modifier);
    }
  }
  if (defender.statusEffects) {
    for (const effect of defender.statusEffects) {
      if (effect.stat === "defense") finalDamage = Math.max(0, finalDamage - effect.modifier);
    }
  }

  // Elemental reaction chain
  let reaction: ReactionResult | null = null;
  if (attacker.element && !isMiss) {
    const { reaction: r, newAura } = resolveElementApplication(
      defender.elementAura ?? null,
      attacker.element,
      attacker.id,
      elementPreset,
    );
    defender.elementAura = newAura;
    if (r) {
      reaction = r;
      finalDamage = applyReactionDamage(finalDamage, r);
      // Apply reaction status effects to defender (dedup: refresh turnsLeft if already present)
      if (r.appliedEffects.length > 0) {
        if (!defender.statusEffects) defender.statusEffects = [];
        for (const eff of r.appliedEffects) {
          const existing = defender.statusEffects.find((e) => e.name === eff.name);
          if (existing) {
            existing.turnsLeft = Math.max(existing.turnsLeft, eff.turnsLeft);
          } else {
            defender.statusEffects.push({ ...eff });
          }
        }
      }
    }
  }

  const remainingHp = Math.max(0, defender.hp - finalDamage);

  return {
    attackerId: attacker.id,
    defenderId: defender.id,
    attackRoll,
    defenseRoll,
    rawDamage,
    mitigated,
    finalDamage,
    isCritical,
    isMiss,
    remainingHp,
    isKo: remainingHp <= 0,
    reaction,
    element: attacker.element,
  };
}

/** Tick status effects: decrement turns, remove expired. Returns tick results. */
export function tickStatusEffects(combatant: CombatantStats): {
  updated: CombatantStats;
  ticks: Array<{ effect: string; expired: boolean }>;
} {
  if (!combatant.statusEffects?.length) {
    return { updated: combatant, ticks: [] };
  }

  const ticks: Array<{ effect: string; expired: boolean }> = [];
  const remaining: StatusEffect[] = [];

  for (const effect of combatant.statusEffects) {
    // Apply HP effects (poison, regen)
    if (effect.stat === "hp") {
      combatant.hp = Math.min(combatant.maxHp, Math.max(0, combatant.hp + effect.modifier));
    }

    const next = { ...effect, turnsLeft: effect.turnsLeft - 1 };
    const expired = next.turnsLeft <= 0;
    ticks.push({ effect: effect.name, expired });
    if (!expired) remaining.push(next);
  }

  return {
    updated: { ...combatant, statusEffects: remaining },
    ticks,
  };
}

/** Player-chosen action for their turn. */
export interface PlayerAction {
  type: "attack" | "skill" | "defend" | "item" | "flee";
  targetId?: string;
  skillId?: string;
  itemId?: string;
  itemEffect?: CombatItemEffect;
}

function normalizeCombatName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function resolveMechanicActions(
  combatants: (CombatantStats & { side?: "player" | "enemy" })[],
  round: number,
  mechanics: CombatMechanic[] | undefined,
  elementPreset: string | undefined,
  defendingIds: Set<string>,
): { actions: AttackResult[]; reactions: CombatRoundResult["reactions"] } {
  if (!mechanics?.length) return { actions: [], reactions: [] };

  const actions: AttackResult[] = [];
  const reactions: CombatRoundResult["reactions"] = [];
  for (const mechanic of mechanics) {
    const ownerName = normalizeCombatName(mechanic.ownerName);
    const owner =
      combatants.find((combatant) => combatant.hp > 0 && normalizeCombatName(combatant.name) === ownerName) ??
      combatants.find((combatant) => combatant.hp > 0 && combatant.side === "enemy") ??
      combatants.find((combatant) => combatant.hp > 0);
    if (!owner) continue;

    const interval = Math.max(0, Math.floor(Number(mechanic.interval) || 0));
    const hpThreshold = Math.max(0, Math.min(100, Number(mechanic.hpThreshold) || 0));
    const ownerHpPercent = owner.maxHp > 0 ? (owner.hp / owner.maxHp) * 100 : 100;
    const shouldTrigger =
      (mechanic.trigger === "round_interval" && interval > 0 && round % interval === 0) ||
      (mechanic.trigger === "hp_threshold" && hpThreshold > 0 && ownerHpPercent <= hpThreshold);
    if (!shouldTrigger) continue;

    const ownerSide = owner.side;
    const targetPool =
      mechanic.effectType === "buff_self"
        ? [owner]
        : combatants.filter((combatant) => combatant.hp > 0 && combatant.side !== ownerSide);
    const selectedTargets = mechanic.effectType === "damage_one" ? targetPool.slice(0, 1) : targetPool;
    const power = Math.max(0.05, Math.min(3, Number(mechanic.power) || 0.35));

    for (const target of selectedTargets) {
      if (mechanic.status || mechanic.effectType?.startsWith("status") || mechanic.effectType?.startsWith("debuff")) {
        applyNamedStatus(target, toStatusEffect(mechanic.status, mechanic.status?.name || mechanic.name));
      }

      let damage = mechanic.effectType?.startsWith("damage")
        ? Math.max(1, Math.floor(Math.max(owner.attack, target.maxHp) * power))
        : 0;
      if (defendingIds.has(target.id)) damage = Math.floor(damage * 0.45);

      let reaction: ReactionResult | null = null;
      if (mechanic.element && damage > 0) {
        const { reaction: r, newAura } = resolveElementApplication(
          target.elementAura ?? null,
          mechanic.element,
          owner.id,
          elementPreset,
        );
        target.elementAura = newAura;
        if (r) {
          reaction = r;
          damage = applyReactionDamage(damage, r);
        }
      }

      const remainingHp = Math.max(0, target.hp - damage);
      const action: AttackResult = {
        attackerId: owner.id,
        defenderId: target.id,
        attackRoll: 0,
        defenseRoll: 0,
        rawDamage: damage,
        mitigated: 0,
        finalDamage: damage,
        isCritical: damage > Math.max(1, target.maxHp * 0.25),
        isMiss: false,
        remainingHp,
        isKo: remainingHp <= 0,
        skillName: mechanic.name,
        element: mechanic.element || owner.element,
        reaction,
      };
      actions.push(action);
      if (reaction) {
        reactions.push({
          attackerId: owner.id,
          defenderId: target.id,
          reaction: reaction.reaction,
          description: reaction.description,
        });
      }
      target.hp = remainingHp;
    }
  }

  return { actions, reactions };
}

/** Run a full combat round. Modifies combatants in place and returns round result. */
export function resolveCombatRound(
  combatants: (CombatantStats & { side?: "player" | "enemy" })[],
  round: number,
  difficulty: string = "normal",
  elementPreset?: string,
  playerAction?: PlayerAction,
  mechanics?: CombatMechanic[],
): CombatRoundResult {
  const alive = combatants.filter((c) => c.hp > 0);
  const initiative = rollInitiative(alive);
  const actions: AttackResult[] = [];
  const statusTicks: Array<{ id: string; effect: string; expired: boolean }> = [];
  const reactions: CombatRoundResult["reactions"] = [];

  // Track defending combatants for defense bonus
  const defendingIds = new Set<string>();
  const controlledPlayerId = combatants.find((c) => c.hp > 0 && (c as { side?: string }).side === "player")?.id ?? null;

  // Each combatant acts in initiative order
  for (const entry of initiative) {
    const attacker = combatants.find((c) => c.id === entry.id);
    if (!attacker || attacker.hp <= 0) continue;

    const isPlayerSide = (attacker as { side?: string }).side === "player";

    if (isPlayerSide) {
      const allies = combatants.filter((c) => c.hp > 0 && (c as { side?: string }).side === "player");
      const opposingSide = combatants.filter((c) => c.hp > 0 && (c as { side?: string }).side !== "player");
      if (opposingSide.length === 0) break;

      const pushResult = (target: CombatantStats, result: AttackResult) => {
        actions.push(result);
        if (result.reaction) {
          reactions.push({
            attackerId: attacker.id,
            defenderId: target.id,
            reaction: result.reaction.reaction,
            description: result.reaction.description,
          });
        }
        target.hp = result.remainingHp;
      };

      if (playerAction && attacker.id === controlledPlayerId) {
        if (playerAction.type === "defend") {
          defendingIds.add(attacker.id);
          continue;
        }

        if (playerAction.type === "attack") {
          let target = opposingSide.find((c) => c.id === playerAction.targetId);
          if (!target) target = opposingSide[Math.floor(Math.random() * opposingSide.length)]!;
          pushResult(target, resolveAttack(attacker, target, difficulty, elementPreset));
          continue;
        }

        if (playerAction.type === "skill") {
          const skill = attacker.skills?.find((candidate) => candidate.id === playerAction.skillId);
          const targetPool = skill?.type === "heal" ? allies : opposingSide;
          let target = playerAction.targetId ? targetPool.find((c) => c.id === playerAction.targetId) : undefined;
          if (!target) target = targetPool[Math.floor(Math.random() * targetPool.length)]!;
          const result = skill
            ? resolveSkillAction(attacker, target, skill, difficulty, elementPreset)
            : resolveAttack(attacker, target, difficulty, elementPreset);
          pushResult(target, result);
          continue;
        }

        if (playerAction.type === "item") {
          const itemTargetPool =
            playerAction.itemEffect?.target === "enemy"
              ? opposingSide
              : playerAction.itemEffect?.target === "any"
                ? [...allies, ...opposingSide]
                : allies;
          let target = playerAction.targetId ? itemTargetPool.find((c) => c.id === playerAction.targetId) : undefined;
          if (!target) target = playerAction.itemEffect?.target === "enemy" ? (opposingSide[0] ?? attacker) : attacker;
          const result = resolveItemAction(
            attacker,
            target,
            playerAction.itemId,
            playerAction.itemEffect,
            elementPreset,
          );
          pushResult(target, result);
          continue;
        }

        continue;
      }

      const autoSkill = chooseAutoSkill(attacker, allies, opposingSide, round);
      if (autoSkill) {
        pushResult(
          autoSkill.target,
          resolveSkillAction(attacker, autoSkill.target, autoSkill.skill, difficulty, elementPreset),
        );
        continue;
      }

      const target = opposingSide[Math.floor(Math.random() * opposingSide.length)]!;
      pushResult(target, resolveAttack(attacker, target, difficulty, elementPreset));
      continue;
    }

    // Enemy AI: attack a random player-side combatant
    const opposingSide = combatants.filter((c) => {
      const side = (c as { side?: string }).side;
      return c.hp > 0 && side !== (attacker as { side?: string }).side;
    });
    if (opposingSide.length === 0) break;

    const fallbackTarget = opposingSide[Math.floor(Math.random() * opposingSide.length)]!;
    const enemyAutoSkill = chooseAutoSkill(attacker, [attacker], opposingSide, round);
    const target = enemyAutoSkill?.target ?? fallbackTarget;

    // Apply defend bonus: if target is defending, temporarily boost defense
    const originalDefense = target.defense;
    if (defendingIds.has(target.id)) {
      target.defense = Math.floor(target.defense * 1.5);
    }

    const result = enemyAutoSkill
      ? resolveSkillAction(attacker, enemyAutoSkill.target, enemyAutoSkill.skill, difficulty, elementPreset)
      : resolveAttack(attacker, target, difficulty, elementPreset);
    actions.push(result);

    // Restore original defense after calculation
    target.defense = originalDefense;

    // Collect reactions for narration
    if (result.reaction) {
      reactions.push({
        attackerId: attacker.id,
        defenderId: target.id,
        reaction: result.reaction.reaction,
        description: result.reaction.description,
      });
    }

    // Apply damage
    target.hp = result.remainingHp;
  }

  const mechanicResult = resolveMechanicActions(combatants, round, mechanics, elementPreset, defendingIds);
  actions.push(...mechanicResult.actions);
  reactions.push(...mechanicResult.reactions);

  // Tick status effects at end of round
  for (const c of combatants) {
    if (c.hp <= 0) continue;
    const { updated, ticks } = tickStatusEffects(c);
    Object.assign(c, updated);
    for (const t of ticks) {
      statusTicks.push({ id: c.id, ...t });
    }
  }

  return { round, initiative, actions, statusTicks, reactions };
}
