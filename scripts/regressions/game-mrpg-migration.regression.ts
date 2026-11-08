/**
 * The owner's calls on moving Legacy players to MRPG classes (2026-11-06):
 * 1. An upgraded card's class names its MRPG class; its Legacy class and abilities move to a note, and a
 *    session's end can't rename the class.
 * 2. A check outside battle in an MRPG game reads the MRPG stats.
 * 3. A late joiner comes in at the level the Game Master gives, with growths and stats it set off the norm.
 * 4. The upgrade offers the nearest MRPG piece for each Legacy weapon and armour.
 * 5. Multiplayer: a guest who played to level 3 and left comes back as that level-3 character after the
 *    host went on alone; one who sits down in a game under way is onboarded by the GM with [mrpg_join].
 */
import assert from "node:assert/strict";
import {
  applyMarinaraLegacyUpgrade,
  marinaraLegacyGearOffers,
  MARINARA_LEGACY_NOTE,
} from "../../packages/server/src/services/game/marinara-legacy-upgrade.service.js";
import { applyGeneratedGameCharacterCards } from "../../packages/server/src/routes/game.routes.js";
import { mrpgCheckModifier, mrpgStatForSkill } from "../../packages/server/src/services/game/skill-check.service.js";
import { marinaraFightStart } from "../../packages/server/src/services/game/marinara-fight-start.service.js";
import { roomAwayCharacters, roomMrpgRoster } from "../../packages/server/src/services/multiplayer/fight-players.js";
import type { Combatant } from "../../packages/shared/src/types/game.js";
import { resolveSkillCheckWithContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";
import {
  createMarinaraCardProgression,
  createMarinaraJoinerProgression,
  marinaraClass,
  marinaraLegacyGearFor,
  marinaraTemperamentForSister,
  multiplayerPersonaSchema,
  parseGmTags,
  readMarinaraCardProgression,
  readMarinaraStatAmounts,
  type GameInventoryStack,
} from "../../packages/shared/src/index.js";

const legacy = () => ({
  gameSetupConfig: { genre: "fantasy" },
  gameCharacterCards: [
    {
      name: "Kara",
      class: "Knight",
      abilities: ["Shield Bash", "Rally"],
      strengths: ["Brave"],
      temperament: "protective",
      temperamentInitial: "protective",
    },
    {
      name: "Ossian",
      class: "Wizard",
      abilities: ["Fireball"],
      temperament: "methodical",
      temperamentInitial: "methodical",
    },
  ],
});
const stacks: GameInventoryStack[] = [
  { id: "s1", name: "Grandfather's Chain Mail", quantity: 1 },
  { id: "s2", name: "Oak Staff", quantity: 1, holder: "Ossian" },
  { id: "s3", name: "Healing Potion", quantity: 3, holder: "Ossian" },
  { id: "s4", name: "Rusty Dagger", quantity: 1, holder: "Ossian" },
];

// 4. Gear offers: weapons and armour only, at the upgrade's tier, the player's bag being the player card's.
const offers = marinaraLegacyGearOffers(legacy(), stacks, "Kara");
assert.deepEqual(
  offers.map((offer) => [offer.stackId, offer.holder, offer.id]),
  [
    ["s1", "Kara", "mail-t2"],
    ["s2", "Ossian", "staff-t2"],
    ["s4", "Ossian", "knife-t2"],
  ],
);
assert.equal(marinaraLegacyGearFor("Hide Armor", 1, { setting: "fantasy" } as never)?.id, "leathers-t1");
assert.equal(marinaraLegacyGearFor("Rope", 1, { setting: "fantasy" } as never), undefined);

const done = applyMarinaraLegacyUpgrade(legacy(), {
  gameId: "g-mig",
  members: [
    { name: "Kara", primary: "guard" },
    { name: "Ossian", primary: "channeler" },
  ],
  read: new Map(),
  classic: new Map(),
  at: "2026-11-06T15:00:00Z",
  gear: { stacks, playerCard: "Kara", accepted: ["s1", "s2"] },
});
assert.ok("patch" in done);
const cards = done.patch.gameCharacterCards as Array<Record<string, any>>;
const kara = cards.find((card) => card.name === "Kara")!;
const ossian = cards.find((card) => card.name === "Ossian")!;

// 1. Class text: the MRPG class, the Legacy class and abilities in a note, the rest kept.
assert.equal(kara.class, marinaraClass(readMarinaraCardProgression(kara.marinara)!.activeClass)!.label);
assert.deepEqual(kara.abilities, []);
assert.deepEqual(kara.strengths, ["Brave"]);
assert.equal(kara.extra[MARINARA_LEGACY_NOTE], "Legacy class: Knight. Legacy abilities: Shield Bash; Rally.");
const concluded = applyGeneratedGameCharacterCards(cards, [
  { name: "Kara", class: "Paladin", abilities: ["Smite"] },
]).cards;
assert.equal(concluded.find((card) => card.name === "Kara")!.class, kara.class);

// 4. The accepted gear became MRPG pieces keeping their Legacy names, and is worn where the class can.
const after = (done as { stacks?: GameInventoryStack[] }).stacks!;
assert.equal(after.find((stack) => stack.id === "s1")!.nickname, "Grandfather's Chain Mail");
assert.equal(after.find((stack) => stack.id === "s1")!.name, "Hammered Mail Hauberk");
assert.equal(after.find((stack) => stack.id === "s4")!.name, "Rusty Dagger", "a declined offer is left alone");
assert.equal(readMarinaraCardProgression(kara.marinara)!.equipment?.armor, "mail-t2");
assert.equal(readMarinaraCardProgression(ossian.marinara)!.equipment?.weapon, "staff-t2");

// 2. Checks: the stat a skill leans on, and what it adds.
assert.equal(mrpgStatForSkill("Stealth"), "speed");
assert.equal(mrpgStatForSkill("Persuasion check"), "luck");
assert.equal(mrpgStatForSkill("Lockpicking"), "skill");
assert.deepEqual([1, 5, 8, 13, 20, 28, 40].map(mrpgCheckModifier), [-1, 0, 1, 2, 3, 5, 5]);
assert.equal(mrpgStatForSkill("Religion"), "resistance", "faith reads Resistance (owner 2026-11-06)");
const stats = { hp: 30, strength: 4, magic: 2, skill: 8, speed: 26, defense: 6, resistance: 3, luck: 9 };
const rolled = resolveSkillCheckWithContext(
  { skills: null, attributes: { dex: 20 }, sheetAttributes: { dex: 20 }, mrpgStats: stats },
  { skill: "Stealth", dc: 12 },
  () => 10,
);
assert.equal(rolled.modifier, 4, "Speed 26 counts, not the Legacy Dexterity");

// 3. Joiners: the level given, growths moving their hidden aptitudes, stats on top of the body.
const card = { name: "Donnel" };
const plain = createMarinaraCardProgression({ gameId: "g-mig", card, temperament: "cautious" });
const joined = createMarinaraJoinerProgression({
  gameId: "g-mig",
  card,
  temperament: "cautious",
  terms: { level: 3, growths: { strength: 40, speed: 99 }, stats: { luck: 5 } },
});
assert.equal(joined.level, 3);
assert.equal(joined.aptitudes.strength, plain.aptitudes.strength + 40);
assert.equal(joined.aptitudes.speed, plain.aptitudes.speed + 50, "growths are capped at +50");
const reread = readMarinaraCardProgression(joined)!;
assert.deepEqual(reread.statBonus, { luck: 5 });
const bare = readMarinaraCardProgression({ ...joined, statBonus: undefined })!;
assert.equal(reread.stats.luck, bare.stats.luck + 5, "the stat bonus survives the body being recomputed");
assert.equal(createMarinaraJoinerProgression({ gameId: "g-mig", card, temperament: "cautious" }).level, 1);
assert.deepEqual(readMarinaraStatAmounts("Strength+30, spd 20; luck-5, charm+9"), {
  strength: 30,
  speed: 20,
  luck: -5,
});

// 3. The tag: level, growths and stats ride on a party_change add.
const tags = parseGmTags('[party_change: character="Donnel" change="add" level="2" growths="strength+40"]');
assert.deepEqual(tags.partyChanges[0], { characterName: "Donnel", change: "add", level: 2, growths: "strength+40" });
const bareTag = parseGmTags("[party_change: character=Donnel change=add level=4]");
assert.equal(bareTag.partyChanges[0]!.characterName, "Donnel");
assert.equal(bareTag.partyChanges[0]!.level, 4);

// 5. A recurring guest. Host Ayla and guest Bren played to level 3 together; the room ended and Ayla
// fights on alone. Bren's card keeps level 3, sits the host's fights out, and is theirs again on return.
{
  const level3 = (name: string) => {
    const base = createMarinaraCardProgression({ gameId: "g-room", card: { name }, temperament: "reckless" });
    return { ...base, level: 3, xp: 0 };
  };
  const room = (status: "live" | "ended", guestSeated: boolean) => ({
    gameSetupConfig: { marinaraClasses: true },
    multiplayer: {
      version: 1,
      role: "host",
      status,
      participants: [
        { id: "host-1", isHost: true, persona: { name: "Ayla" } },
        ...(guestSeated ? [{ id: "guest-1", isHost: false, persona: { name: "Bren" } }] : []),
      ],
    },
    gameCharacterCards: [
      { name: "Ayla", multiplayerParticipantId: "host-1", marinara: level3("Ayla") },
      { name: "Bren", multiplayerParticipantId: "guest-1", marinara: level3("Bren") },
      { name: "Mira", marinara: level3("Mira") },
    ],
  });
  assert.deepEqual([...roomAwayCharacters(room("live", true))], [], "everyone seated is here");
  assert.deepEqual([...roomAwayCharacters(room("ended", true))], ["bren"], "an ended room leaves the guest away");
  assert.deepEqual([...roomAwayCharacters(room("live", false))], ["bren"], "a guest who left is away");
  assert.deepEqual([...roomAwayCharacters({ gameCharacterCards: [] })], [], "a solo game has nobody away");
  const unit = (id: string, name: string, side: "player" | "enemy"): Combatant =>
    ({
      id,
      name,
      side,
      hp: 20,
      maxHp: 20,
      mp: 0,
      maxMp: 0,
      attack: 5,
      defense: 5,
      speed: 5,
      level: 1,
      skills: [],
    }) as Combatant;
  const solo = room("ended", true);
  const start = marinaraFightStart({
    gameId: "g-room",
    cards: solo.gameCharacterCards,
    party: [unit("p1", "Ayla", "player"), unit("p2", "Bren", "player"), unit("p3", "Mira", "player")],
    enemies: [unit("e1", "Wolf", "enemy")],
    difficulty: "normal",
    storyFight: true,
    away: roomAwayCharacters(solo),
  });
  assert.deepEqual(
    start.party.map((one) => one.name),
    ["Ayla", "Mira"],
    "the away guest's character sits the host's fights out, so earns no experience",
  );
  const roster = roomMrpgRoster(solo);
  assert.deepEqual(roster.away, ["Bren"]);
  assert.deepEqual(roster.newcomers, [], "a returning guest is never onboarded again");
  // Back at the table, Bren is seated and keeps level 3.
  const back = room("live", true);
  assert.deepEqual(roomMrpgRoster(back).away, []);
  assert.equal(readMarinaraCardProgression(back.gameCharacterCards[1]!.marinara)!.level, 3);

  // A new guest with no MRPG class in a game under way is listed for the GM; in a new game nobody is.
  const fresh = room("live", true);
  fresh.gameCharacterCards[1] = { name: "Bren", multiplayerParticipantId: "guest-1" } as never;
  assert.deepEqual(roomMrpgRoster(fresh).newcomers, ["Bren"]);
  assert.equal(roomMrpgRoster(fresh).partyLevel, 3);
  const brandNew = room("live", true);
  brandNew.gameCharacterCards = [{ name: "Bren", multiplayerParticipantId: "guest-1" } as never];
  assert.equal(roomMrpgRoster(brandNew).underWay, false, "a new game starts everyone at level 1");
}

// 6. A guest builds their own character (picks and concept travel with their persona); the GM picks
// their sister tree, and their level only once the game is under way.
{
  const persona = multiplayerPersonaSchema.parse({
    name: "Bren",
    description: "A wandering archer.",
    classic: { tree: "marksman", strong: ["skill", "speed"], weak: "magic" },
    concept: "Owes the party's captain a debt.",
  });
  assert.equal(persona.classic?.tree, "marksman");
  assert.ok(!multiplayerPersonaSchema.safeParse({ name: "X", description: "", classic: { tree: "wizard" } }).success);
  assert.equal(marinaraTemperamentForSister("hexer"), "cruel");
  assert.equal(marinaraTemperamentForSister("marksman", "cautious"), "cautious", "a fitting temperament is kept");
  assert.equal(marinaraTemperamentForSister("honorable"), "honourable");
  assert.equal(marinaraTemperamentForSister("wizard"), undefined);
  const roster = roomMrpgRoster({
    gameSetupConfig: { marinaraClasses: true },
    multiplayer: {
      version: 1,
      role: "host",
      status: "live",
      participants: [
        { id: "host-1", isHost: true, persona: { name: "Ayla" } },
        { id: "guest-1", isHost: false, persona },
      ],
    },
    gameCharacterCards: [
      { name: "Ayla", multiplayerParticipantId: "host-1" },
      { name: "Bren", multiplayerParticipantId: "guest-1" },
    ],
  });
  assert.deepEqual(roster.newcomers, ["Bren"], "a new game's guest is onboarded too, for their sister tree");
  assert.equal(roster.underWay, false);
}

const joinTags = parseGmTags(
  'Welcome! [mrpg_join: character="Bren" sister="hexer" level="6" growths="speed+30" stats="luck+4"]',
);
assert.deepEqual(joinTags.mrpgJoins, [
  { characterName: "Bren", level: 6, growths: "speed+30", stats: "luck+4", sister: "hexer" },
]);
assert.ok(!joinTags.cleanContent.includes("mrpg_join"), "the tag is stripped from the narration");

console.log("game-mrpg-migration: ok");

// The tag's stat amounts parse with spaces anywhere, and a long run of tabs is read at once (CodeQL, PR 8964).
{
  const { readMarinaraStatAmounts: read } = await import("../../packages/shared/src/index.js");
  assert.deepEqual(read("strength + 30, speed 20 %, Lck: -5; def=4"), {
    strength: 30,
    speed: 20,
    luck: -5,
    defense: 4,
  });
  assert.deepEqual(read("str + 30, strength+ 12"), { strength: 12 });
  assert.equal(read("strength 2 5, spe ed 10"), undefined, "spaces inside a word or a number leave it unread");
  const started = Date.now();
  assert.equal(read("a" + "\t".repeat(50_000) + "!"), undefined);
  assert.equal(read("a0" + "\t".repeat(50_000) + "!"), undefined);
  assert.equal(read("str:" + "\t".repeat(50_000) + "+" + "\t".repeat(50_000) + "!"), undefined);
  assert.ok(Date.now() - started < 500, "no backtracking on a long run of tabs");
}

// A foe's kind drops its fight's letter or number, and a long run of tabs is read at once (CodeQL, PR 8964).
{
  const { marinaraFoeKindKey: kind } = await import("../../packages/shared/src/index.js");
  assert.equal(kind({ name: "Bandit B" }), "name:bandit");
  assert.equal(kind({ name: " Cult Guard 12 " }), "name:cult guard");
  assert.equal(kind({ name: "Wolf AB" }), "name:wolf ab");
  assert.equal(kind({ name: "Bandit" }), "name:bandit");
  assert.equal(kind({ name: "B" }), "name:b");
  assert.equal(kind({ name: "Ghoul", familyId: "ghoul" }), "family:ghoul");
  const started = Date.now();
  kind({ name: "a" + "\t".repeat(100_000) + "x" });
  assert.ok(Date.now() - started < 500, "no backtracking on a long run of tabs");
}
