// ──────────────────────────────────────────────
// How a fight's opponents and party were built, said in words (2026-10-26, Alyssa: the fight's
// English-only lines are translated). Each line the Engine writes into a fight's adjustments is one
// of these templates, filled in. The server keeps writing the English, which the Game Master reads;
// a screen reads a line back into its template and values and shows the template's translation
// (`game.combat.ruleset.note.<key>`), the values as they were. A line that matches none is shown as
// written.
//
// A template here and the sentence its code writes are the same words: change one, change the other
// (game-ruleset-fight-notes.regression.ts holds each to en.json's copy).
// ──────────────────────────────────────────────

export const RULESET_FIGHT_NOTES = {
  // ── The party ──
  standsIn: "{{name}} fights as {{standIn}}, the character the player plays.",
  noSheet: "{{name}} has no ruleset sheet and stays out of the fight.",
  deadOut: "{{name}} is dead and stays out of the fight.",
  deadLead: "{{name}} is dead, so the player plays {{standIn}} until {{name}} lives again.",
  leadAway: "{{name}} is not in this fight, so the player plays {{standIn}}.",
  partyJoined: "{{name}} was left out of the fight's party and joins it.",
  partyLeft: "{{name}} has left the party and stays out of the fight.",
  partySitsOut: "{{name}} does not fight and stays out of the fight.",
  noRoom: "No room to set the party down clear of the opponents, so the fight begins where it stands.",
  // ── The encounter budget ──
  budgetDown:
    "{{name}} was brought down from {{from}} to {{to}}: the fight was worth more than this party's {{step}} budget.",
  budgetOver:
    "This fight is worth {{worth}}, more than this party's {{step}} budget of {{budget}}, with nothing left to bring down.",
  budgetWithin: "This fight is worth {{worth}}, within this party's {{step}} budget of {{budget}}.",
  budgetUntiered: "{{name}} was given no tier, so it was built at {{tier}}, what this party's {{step}} budget allows.",
  beginsHurt: "{{name}} begins hurt, at {{value}} of {{max}} health, as the story left it.",
  standIns:
    "{{creature}} is far beyond this party (worth {{worth}}, against its {{step}} budget of {{budget}}), so lesser ones of its kind come instead: {{foes}}. {{name}} stays out of this fight, for the story to keep.",
  // ── An opponent ──
  byName: 'No bestiary holds "{{creature}}", so {{name}} was looked up by name.',
  noBestiary: 'No bestiary of this ruleset holds "{{creature}}".',
  givenSheet: "{{name}} was given a sheet for {{entries}}.",
  givenSheetAt: "{{name}} was given a sheet for {{entries}}, at {{tier}}.",
  points: "{{name}} may spend {{points}} points between turns on {{actions}}.",
  pointsUnpriced:
    "{{name}} was given {{points}} points but nothing priced out of them, so it has no legendary actions.",
  unpricedBorrowed:
    "{{name}} had nothing priced out of its points, so it has the legendary actions of the {{creature}}.",
  unpricedOwn: "{{name}} had nothing priced out of its points, so it buys its own actions with them.",
  pointsCapped:
    "{{name}} may have at most {{points}} legendary points at {{tier}}, what this ruleset's creatures of that tier have, so it was given {{points}}, not {{asked}}.",
  pointsNone: "{{name}} has no legendary actions at {{tier}}: no creature of this ruleset that low has any.",
  notBuyable: 'this ruleset has nothing called "{{action}}" to buy with its points.',
  unreadable: "The proposed stat block for {{name}} could not be read, so its tier was used.",
  tierUnknown: 'The tier "{{tier}}" is not on this ruleset\'s scale, so {{used}} was used.',
  builtFrom: "{{name}} was built from the numbers of {{tier}}.",
  metBefore: "{{name}} is the same one the party met before.",
  writtenWeapons:
    "{{name}} was written with {{weapons}}, which the {{creature}} of the bestiary has none of, so it was built at {{tier}} instead.",
  statedType: "{{name}} was said to be {{type}}, so it fights as one, on the numbers of the {{creature}}.",
  // ── Said of one opponent, after its name ──
  noEntry: 'this ruleset has no entry called "{{entry}}", so it was not given.',
  ownSpell: '"{{action}}" is this ruleset\'s own, so it may be cast once this fight.',
  noReaction: 'this ruleset has no reaction called "{{action}}".',
  noItem: 'the ruleset has no item called "{{item}}", so it was not given.',
  sheetSays: "its sheet says its {{keys}}, so the numbers written beside it were not used.",
  writtenArea:
    '"{{action}}" was written as a breath or an area, so it lands in an area against a save and comes back on a recharge.',
  // ── An invented stat block held to its tier ──
  spellListDropped: "Spellcasting carried a spell list the threat scale cannot bound, so it was dropped.",
  healingDropped: '"{{action}}" carried healing or targets the threat scale cannot bound, so they were dropped.',
  noScale: "This ruleset declares no threat scale, so the opponent was used as it was proposed.",
  tierUnknownInstead: 'The tier "{{tier}}" is not on this ruleset\'s scale, so {{used}} was used instead.',
  damageTypesDropped: "{{count}} damage type this ruleset does not have was dropped from {{key}}.",
  immunityDropped: "A condition this ruleset does not have was dropped from the immunities.",
  auraDropped: "Conditions kept on through the fight were dropped: the threat scale cannot bound an aura.",
  heldDropped: "A held thing with no item tag this ruleset has was dropped.",
  senseDropped: "A sense this ruleset does not have was dropped.",
  trackDropped: "A track this ruleset does not have was dropped.",
  saveDropped: "A save this ruleset does not have was dropped.",
  contestDropped: 'The contest check "{{check}}" is not one this ruleset has, so it was dropped.',
  capped: "Its {{stat}} is now {{to}} instead of {{from}}.",
  soakDropped: "An opponent made up for one fight soaks nothing, so its soak was dropped.",
  hardnessDropped: "An opponent made up for one fight has no hardness, so its hardness was dropped.",
  untyped: 'The damage type "{{type}}" is not one this ruleset has, so "{{action}}" deals untyped damage.',
  abilityDropped: "An ability this ruleset does not have was dropped.",
  healthPulled: "Health {{from}} was pulled into the {{low}} to {{high}} of {{tier}}, and is now {{to}}.",
  defenseLowered: "Defense {{from}} was lowered to {{to}}.",
  actionsKept: "Only the first {{kept}} of {{count}} actions were kept.",
  budgetOnlyCondition: '"{{action}}" spent a budget only a condition fills, so it spends {{budget}}.',
  budgetUnknown: '"{{action}}" spent a budget this ruleset does not have, so it spends {{budget}}.',
  toHitLowered: '"{{action}}" now hits at {{to}} instead of {{from}}.',
  clausesDropped: '"{{action}}" carried more than {{count}} damage clauses, so the rest were dropped.',
  clauseUntyped:
    'The damage type "{{type}}" is not one this ruleset has, so a clause of "{{action}}" deals untyped damage.',
  clauseSaveUnknown: 'A clause of "{{action}}" asked for a save this ruleset does not have, so it simply lands.',
  clauseSaveLowered: 'The save against a clause of "{{action}}" was lowered to {{to}}.',
  saveUnknown: '"{{action}}" asked for a save this ruleset does not have, so it simply lands.',
  saveLowered: 'The save against "{{action}}" was lowered to {{to}}.',
  conditionUnknown: '"{{action}}" applied a condition this ruleset does not have, so it was dropped.',
  conditionNoSave: '"{{action}}" applied {{condition}} until a save nothing could roll, so it was dropped.',
  conditionClock: "The save that ends {{condition}} was dropped, so it runs on its own clock.",
  namesNothing: '"{{action}}" named nothing this block still has, so it was dropped.',
  partLost: '"{{action}}" lost a part that is not on this block.',
  sequenceStrike: "A creature of this tier does not strike that often, so the sequence lost a strike.",
  damageScaled:
    "The damage was scaled down until the best round averages {{average}}, inside the {{low}} to {{high}} of {{tier}}.",
  damageScaledBlock:
    "The damage was scaled down as far as this block goes, and the best round still averages {{average}} against the {{high}} of {{tier}}.",
  damageScaledFar:
    "The damage was scaled down as far as it goes, and the best round still averages {{average}} against the {{high}} of {{tier}}.",
  paymentScaled: "What a bigger payment buys was scaled down to fit the tier.",
  // ── An invented sheet held to its tier ──
  valueSet: "{{field}} {{from}} was set to {{to}}.",
  tierNotOffered: '"{{choice}}" is not offered for {{field}}, so it was left at the ruleset\'s default.',
  bonusSet: "The bonus on {{field}} was set to {{to}}.",
  fieldDefault: "{{field}} could not hold {{value}}, so it was left at the ruleset's default.",
  setAsOne: "{{names}} set as {{entry}} sets it.",
  setAsMany: "{{names}} set as {{entry}} sets them.",
  rowsKept: "Only the first {{count}} rows of {{list}} were kept.",
  notOnSheetOne: "{{names}} is not on this ruleset's sheet, so dropped.",
  notOnSheetMany: "{{names}} are not on this ruleset's sheet, so dropped.",
  noCatalogOne: "{{names}} is in no catalog of this ruleset, so it does nothing in a fight.",
  noCatalogMany: "{{names}} are in no catalog of this ruleset, so they do nothing in a fight.",
  notOpenOne: "{{names}} is not open to a sheet with {{reason}} in this ruleset, so dropped.",
  notOpenMany: "{{names}} are not open to a sheet with {{reason}} in this ruleset, so dropped.",
  poolsMade: "Made a {{field}} {{value}}, so its spells have the pools they are paid out of.",
  poolsSet: "{{field}} was set to {{value}}, so its spells have the pools they are paid out of.",
  unpayableOne: "{{names}} is beyond what this sheet can pay for, so dropped.",
  unpayableMany: "{{names}} are beyond what this sheet can pay for, so dropped.",
  casterKeeps: "{{names}} went: an invented caster keeps {{count}} of what it pays for out of its pools.",
  casterSpellDamage: "{{names}} went: more damage on its own than {{tier}} deals in a round ({{high}} at most).",
  legendaryDropped:
    "{{names}} went from what its points buy: with its own turn, it would deal more in a round than the {{high}} of {{tier}}.",
  legendaryScaled:
    "{{names}}, bought with its points, was scaled down so its turn and its points together stay inside the {{high}} of {{tier}}.",
  scoreSet: "{{ability}} was set to {{to}}, as no scores were written.",
  healthAsWritten:
    "Health {{from}} is outside the {{low}} to {{high}} of {{tier}}, and it is not read off one field of the sheet, so it was left as written.",
  healthGiven: "Health {{from}} was set to the Game Master's {{to}} through its {{field}}.",
  healthGivenReset:
    "Health {{from}} was set to the Game Master's {{to}} through its {{field}} with its {{reset}} set back to the ruleset's default.",
  healthInto:
    "Health {{from}} was pulled into the {{low}} to {{high}} of {{tier}} through its {{field}}, and is now {{to}}.",
  healthIntoReset:
    "Health {{from}} was pulled into the {{low}} to {{high}} of {{tier}} through its {{field}} with its {{reset}} set back to the ruleset's default, and is now {{to}}.",
  healthToward:
    "Health {{from}} was moved toward the {{low}} to {{high}} of {{tier}} as far as its {{field}} goes, and is now {{to}}.",
  // ── What stands before a fight (a spell cast ahead of it) ──
  standsNoEntry: '{{name}} has no entry called "{{entry}}", so nothing stands for it.',
  standsNoMode: '{{name}}\'s {{action}} has no "{{mode}}", so it is not done.',
  standsNotStored: '{{name}}\'s {{action}} cannot be stored in "{{into}}", so nothing is stored.',
  standsUnpaidStored: "{{name}} has nothing left to pay for {{action}} with, so it is not stored.",
  standsCannotName: '{{name}}\'s {{action}} cannot name "{{kind}}", so it is not done.',
  standsNoWay: "{{name}}'s {{action}} is done one of several ways ({{ways}}) and none was named, so it is not done.",
  standsNobody: "{{name}}'s {{action}} names nobody it can be done on, so it is not done.",
  standsUnpaid: "{{name}} has nothing left to pay for {{action}} with, so it is not done.",
  standsEverybody: '{{name}}\'s {{action}} cannot be set on "{{kind}}", so it works on everybody.',
  standsOwnEffect: '{{name}}\'s {{action}} cannot hold "{{stores}}", so it stands with its own effect.',
  standsOwnShape: "{{name}}'s {{action}} changes their own shape, which only their sheet keeps, so it is not done.",
  standsCannotHold: '{{name}}\'s {{action}} cannot hold "{{stores}}", so nothing stands for it.',
  standsUnpaidStand: "{{name}} has nothing left to pay for {{action}} with, so it does not stand.",
  standsNotAgainst: '{{name}}\'s {{action}} cannot be set against "{{against}}", so it is not.',
  standsNoType: "{{name}}'s {{action}} was given no damage type, so it deals {{type}}.",
  standsKeepsIn: '{{name}}\'s {{action}} does not keep "{{kept}}" out, so it cannot leave it out.',
  standsInsideNothing: '{{name}}\'s {{action}} does nothing inside it, so "{{tag}}" changes nothing.',
} as const;

export type RulesetFightNoteKey = keyof typeof RULESET_FIGHT_NOTES;

/** A line read back into its template: the template's key and the values it was filled with. A line
 *  said of one opponent ("Goblin: ...") carries whom it is said of in `of`. */
export interface RulesetFightNote {
  key: RulesetFightNoteKey;
  params: Record<string, string>;
  of?: string;
}

/** A template filled in: the line the server writes. */
export function rulesetFightNote(key: RulesetFightNoteKey, params: Record<string, string | number> = {}): string {
  return RULESET_FIGHT_NOTES[key].replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    params[name] === undefined ? whole : String(params[name]),
  );
}

let matchers: Array<{ key: RulesetFightNoteKey; pattern: RegExp; names: string[] }> | null = null;

function noteMatchers() {
  if (matchers) return matchers;
  matchers = (Object.keys(RULESET_FIGHT_NOTES) as RulesetFightNoteKey[]).map((key) => {
    const names: string[] = [];
    const source = RULESET_FIGHT_NOTES[key]
      .split(/(\{\{\w+\}\})/)
      .map((part) => {
        const named = /^\{\{(\w+)\}\}$/.exec(part);
        if (!named) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // A value named twice is the same value both times.
        const at = names.indexOf(named[1]!);
        if (at >= 0) return `\\${at + 1}`;
        names.push(named[1]!);
        // As much as it can take: "Hit points 28 was set to 30" is the field "Hit points" from 28.
        return "(.+)";
      })
      .join("");
    return { key, pattern: new RegExp(`^${source}$`, "s"), names };
  });
  // The one with the most words of its own first: "given a sheet for X, at Y" before "given a sheet
  // for X", which would read the tier as part of the entries.
  const fixed = (key: RulesetFightNoteKey) => RULESET_FIGHT_NOTES[key].replace(/\{\{\w+\}\}/g, "").length;
  matchers.sort((left, right) => fixed(right.key) - fixed(left.key));
  return matchers;
}

function readWhole(line: string): RulesetFightNote | null {
  for (const { key, pattern, names } of noteMatchers()) {
    const found = pattern.exec(line);
    if (found) return { key, params: Object.fromEntries(names.map((name, index) => [name, found[index + 1]!])) };
  }
  return null;
}

/** A fight's adjustment line read back into its template, or null for one that is none of them. */
export function readRulesetFightNote(line: string): RulesetFightNote | null {
  const whole = readWhole(line);
  if (whole) return whole;
  // Said of one opponent: its name, then the line.
  const at = line.indexOf(": ");
  if (at <= 0) return null;
  const said = readWhole(line.slice(at + 2));
  return said ? { ...said, of: line.slice(0, at) } : null;
}
