/**
 * World people (worldgen W2): who lives in a world's places, drawn by the seed.
 *
 *   - Every starter kit has people words whose roles name only its own place tags; a kit without them
 *     draws from setting-neutral defaults.
 *   - A brief's name lists keep each name once and none that models overuse; its groups keep only the
 *     kit's kinds, its own places as seats and its own groups as allies and rivals.
 *   - A place's people are the same on every read, more in bigger places, each with a stable id, a
 *     name unique in the place in their own culture's order, a role suited to the place, a group when
 *     one is seated there, and a sheet that tells them apart. A world with no names for a culture calls
 *     its people by their role.
 *   - A reply that names one in full brings them in as a tracked NPC with the world's id; the Game
 *     Master is shown only people it has not met, and tells two tracked people with one name apart by
 *     their sheet and id, which a reputation tag can name.
 */
import assert from "node:assert/strict";

import {
  WORLD_OVERUSED_NAMES,
  WORLD_PEOPLE_DEFAULTS,
  WORLD_STARTER_KITS,
  checkWorldBrief,
  compileGameWorld,
  isOverusedName,
  parseWorldKit,
  readReputationTags,
  stripReputationTags,
  worldCast,
  worldPeopleNamed,
  worldPersonNpc,
  worldPersonSheet,
  worldWhereYouAreText,
  type GameNpc,
  type GameWorld,
  type WorldKit,
} from "../../packages/shared/src/index.js";

const kits = WORLD_STARTER_KITS.map((input) => {
  const parsed = parseWorldKit(input);
  assert.ok(parsed.ok, input.id);
  return parsed.kit;
});
const fantasy = kits.find((kit) => kit.id === "high_fantasy")!;

// ── The kits' people words ──
for (const kit of kits) {
  assert.ok(kit.people && kit.people.roles.length >= 10, `${kit.id} has its own people words`);
  const tags = new Set(kit.placeTags.map((tag) => tag.id));
  for (const role of kit.people!.roles) {
    for (const tag of role.tags ?? []) assert.ok(tags.has(tag), `${kit.id}: ${role.label} names ${tag}`);
  }
}

// ── The brief's names and groups ──
const brief = {
  briefVersion: 1,
  premise: "The king is dying.",
  places: [
    { name: "Aldmark", layer: "realm" },
    { name: "The Fenlands", layer: "province", parent: "Aldmark" },
    {
      name: "Thornmere",
      layer: "settlement",
      parent: "The Fenlands",
      size: "city",
      tags: ["port", "market"],
      start: true,
    },
    { name: "Southreach", layer: "province", parent: "Aldmark" },
  ],
  groups: [
    {
      name: "The River Guild",
      kind: "guild",
      seat: "Thornmere",
      note: "Wants the tolls.",
      rivals: ["House Vane", "The Nobody"],
    },
    { name: "House Vane", kind: "noble_house", seat: "Thornmere", allies: ["House Vane"] },
    { name: "The Comet Cult", kind: "starship_crew" },
    { name: "The Lost Order", kind: "temple", seat: "Atlantis" },
  ],
  peopleNames: [
    {
      culture: "heartland",
      given: ["Ama", "Tobin", "Hesk", "Mira", "Elara", "Oswin", "Bryn", "Cato", "Ama", "Tamsin", "Wren", "Edda"],
      family: ["Arnwald", "Fennick", "Holt", "Marrow", "Voss", "Drey", "Callow"],
    },
    {
      culture: fantasy.cultures[1]!.id,
      given: ["Sefu", "Ilka", "Teodor", "Nnamdi"],
      family: ["Okafor", "Brandt"],
      order: "family-given",
    },
    { culture: "heartland", given: ["Twice"] },
    { culture: "martians", given: ["Zork"] },
  ],
  placeNames: [{ culture: "heartland", names: ["Ashby", "Lyra", "Calder", "Wending"] }],
};
const checked = checkWorldBrief(fantasy, brief);
assert.ok(checked.ok);
{
  const notes = checked.repairs.join("\n");
  for (const pattern of [
    /peopleNames \(heartland\): names models overuse were left out \(Elara\)/,
    /peopleNames \(heartland\): names models overuse were left out \(Voss\)/,
    /placeNames \(heartland\): names models overuse were left out \(Lyra\)/,
    /peopleNames: "heartland" is not one of the kit's cultures, or is listed twice/,
    /peopleNames: "martians" is not one of the kit's cultures/,
    /The Comet Cult: left out, "starship_crew" is not one of the kit's kinds of group/,
    /The Lost Order: "Atlantis" is not one of the brief's places, its seat was left out/,
    /The River Guild: an ally or rival that is not one of the brief's groups was left out/,
    /House Vane: an ally or rival that is not one of the brief's groups was left out/,
  ]) {
    assert.match(notes, pattern);
  }
  const heartland = checked.brief.peopleNames.find((group) => group.culture === "heartland")!;
  assert.deepEqual(heartland.given, [
    "Ama",
    "Tobin",
    "Hesk",
    "Mira",
    "Oswin",
    "Bryn",
    "Cato",
    "Tamsin",
    "Wren",
    "Edda",
  ]);
  assert.equal(heartland.order, "given-family");
  assert.deepEqual(checked.brief.groups.find((group) => group.name === "The River Guild")!.rivals, ["House Vane"]);
  assert.deepEqual(checked.brief.groups.find((group) => group.name === "House Vane")!.allies, [], "never its own ally");
  assert.equal(checked.brief.groups.find((group) => group.name === "The Lost Order")!.seat, undefined);
  // Overused: whole stock names, and one-word favourites inside any name; never a real culture's name.
  assert.ok(isOverusedName("Elara Moon") && isOverusedName("marcus chen") && !isOverusedName("Marcus Ortiz"));
  assert.ok(!isOverusedName("Chen Wei") && WORLD_OVERUSED_NAMES.length > 10);
  const tooMany = checkWorldBrief(fantasy, {
    ...brief,
    peopleNames: Array.from({ length: 11 }, (_, n) => ({
      culture: fantasy.cultures[n % 2]!.id,
      given: Array.from({ length: 150 }, (_, m) => `N${n}x${m}`),
    })),
  });
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) assert.ok(tooMany.issues.some((issue) => /At most 1500 people's names in all/.test(issue)));
}

const inputs = { kit: fantasy, seed: 7, grounding: "expand" as const, brief: checked.brief };
const game: GameWorld = { ...inputs, world: compileGameWorld(inputs) };
const placeNamed = (name: string) => game.world.places.find((place) => place.name === name)!;
const thornmere = placeNamed("Thornmere");

// ── A place's people ──
{
  const cast = worldCast(game, thornmere.id);
  assert.deepEqual(worldCast(game, thornmere.id), cast, "the same people on every read");
  assert.equal(cast.length, 3 + 3 * thornmere.rank!, "more people in bigger places");
  assert.deepEqual(
    cast.map((person) => person.id),
    cast.map((_, index) => `${thornmere.id}-${index + 1}`),
  );
  assert.equal(new Set(cast.map((person) => person.name.toLowerCase())).size, cast.length, "names unique in the place");
  const heartland = checked.brief.peopleNames.find((group) => group.culture === "heartland")!;
  const far = checked.brief.peopleNames.find((group) => group.culture !== "heartland")!;
  for (const person of cast) {
    assert.ok(person.named);
    assert.ok(!isOverusedName(person.name), person.name);
    const [first, second] = person.name.split(" ");
    if (person.culture === "heartland") {
      assert.ok(heartland.given.includes(first!) && heartland.family.includes(second!), person.name);
    } else {
      assert.ok(far.family.includes(first!) && far.given.includes(second!), `family first: ${person.name}`);
    }
    assert.ok(fantasy.people!.roles.some((role) => role.label === person.role));
    assert.ok(fantasy.people!.marks.includes(person.mark) && fantasy.people!.hair.includes(person.hair));
    assert.ok(WORLD_PEOPLE_DEFAULTS.temperaments.includes(person.temperament));
    if (person.group) assert.ok(["The River Guild", "House Vane"].includes(person.group));
  }
  // Somebody belongs to a group seated here, and a sheet tells a person apart.
  assert.ok(cast.some((person) => person.group));
  const sheet = worldPersonSheet(fantasy, cast[0]!);
  assert.ok(sheet.startsWith(`${cast[0]!.role};`) && sheet.includes(cast[0]!.mark), sheet);

  // Roles follow what a place is known for: across the world, a port's people sail and fish.
  let portish = 0;
  let towerish = 0;
  for (const place of game.world.places.filter((each) => each.tags.includes("port"))) {
    for (const person of worldCast(game, place.id)) {
      if (["sailor", "fisher"].includes(person.role)) portish++;
      if (["scholar", "apprentice mage"].includes(person.role)) towerish++;
    }
  }
  assert.ok(portish > towerish * 2, `${portish} sailors and fishers to ${towerish} mages`);

  // Some come from elsewhere, of another culture, from an outer place of theirs when there is one.
  const everyone = game.world.places.flatMap((place) => worldCast(game, place.id));
  assert.ok(
    everyone.some((person) => person.culture !== game.world.places.find((each) => each.id === person.placeId)!.culture),
  );
  // A province has no people of its own; an unknown place has none.
  assert.deepEqual(worldCast(game, placeNamed("The Fenlands").id), []);
  assert.deepEqual(worldCast(game, "nowhere"), []);
}

// ── Names stay unique in a place even when a culture has only a few ──
{
  const few = {
    ...inputs,
    brief: {
      ...checked.brief,
      peopleNames: fantasy.cultures.map((culture) => ({
        culture: culture.id,
        given: ["Ama", "Tobin"],
        family: ["Holt"],
        order: "given-family" as const,
      })),
    },
  };
  const cast = worldCast({ ...few, world: compileGameWorld(few) }, thornmere.id);
  assert.equal(new Set(cast.map((person) => person.name.toLowerCase())).size, cast.length, "never the same name twice");
  assert.ok(cast.filter((person) => person.named).length <= 2, "two names make at most two named people");
}

// ── A world with no names calls its people by their role ──
{
  const nameless = { ...inputs, brief: { ...checked.brief, peopleNames: [] } };
  const world = { ...nameless, world: compileGameWorld(nameless) };
  const cast = worldCast(world, thornmere.id);
  assert.ok(cast.every((person) => !person.named));
  assert.equal(new Set(cast.map((person) => person.name)).size, cast.length);
  assert.ok(cast.every((person) => person.name === person.role || person.name.startsWith(`${person.role} `)));
  assert.deepEqual(
    worldPeopleNamed(world, [thornmere.id], cast.map((person) => person.name).join(" ")),
    [],
    "a role is not a name",
  );
}

// ── A kit without people words draws from the defaults ──
{
  const plainKit = parseWorldKit({ ...structuredClone(WORLD_STARTER_KITS[0]!), people: undefined });
  assert.ok(plainKit.ok);
  const plain = { ...inputs, kit: plainKit.kit as WorldKit };
  const cast = worldCast({ ...plain, world: compileGameWorld(plain) }, thornmere.id);
  assert.ok(cast.every((person) => WORLD_PEOPLE_DEFAULTS.roles.some((role) => role.label === person.role)));
}

// ── Bringing people in, and what the Game Master is told ──
{
  const cast = worldCast(game, thornmere.id);
  const [first, second] = cast;
  const reply = `${first!.name.toUpperCase()} waves from the quay. ${second!.name.split(" ")[0]} does not.`;
  assert.deepEqual(
    worldPeopleNamed(game, [thornmere.id, thornmere.id], reply).map((person) => person.id),
    [first!.id],
    "a full name brings one in, once; a first name alone does not",
  );
  assert.deepEqual(
    worldPeopleNamed(game, [thornmere.id], `${first!.name}son`),
    [],
    "a name inside a longer word is not a name",
  );
  assert.deepEqual(
    worldPeopleNamed(game, [thornmere.id], `Mc${first!.name} waves.`),
    [],
    "nor a name at the end of a longer word",
  );
  // Two places each with someone of one name: the reply means the person where the scene is.
  const namesAt = new Map<string, string>();
  let twins: [string, string, string] | undefined;
  for (const place of game.world.places) {
    for (const person of worldCast(game, place.id).filter((each) => each.named)) {
      const other = namesAt.get(person.name);
      if (other && other !== place.id && !twins) twins = [person.name, other, place.id];
      namesAt.set(person.name, place.id);
    }
  }
  assert.ok(twins, "a small name list makes namesakes");
  const [twinName, here, there] = twins!;
  assert.deepEqual(
    worldPeopleNamed(game, [here, there], `${twinName} nods.`).map((person) => person.placeId),
    [here],
  );
  assert.deepEqual(
    worldPeopleNamed(game, [there, here], `${twinName} nods.`).map((person) => person.placeId),
    [there],
  );
  // A name in a script without spaces runs straight into the next word, and is still found.
  const wuxiaKit = kits.find((kit) => kit.id === "wuxia_xianxia")!;
  const wuxiaBrief = checkWorldBrief(wuxiaKit, {
    briefVersion: 1,
    premise: "江湖动荡。",
    peopleNames: wuxiaKit.cultures.map((culture) => ({
      culture: culture.id,
      given: ["景浩", "云飞", "子墨"],
      family: ["林", "沈"],
      order: "family-given",
    })),
  });
  assert.ok(wuxiaBrief.ok);
  const wuxiaInputs = { kit: wuxiaKit, seed: 3, grounding: "expand" as const, brief: wuxiaBrief.brief };
  const wuxiaGame = { ...wuxiaInputs, world: compileGameWorld(wuxiaInputs) };
  const town = wuxiaGame.world.places.find((place) => place.rank !== undefined)!;
  const jianghu = worldCast(wuxiaGame, town.id)[0]!;
  assert.match(jianghu.name, /^[林沈](景浩|云飞|子墨)$/u);
  assert.deepEqual(
    worldPeopleNamed(wuxiaGame, [town.id], `${jianghu.name}说道：走吧。`).map((person) => person.id),
    [jianghu.id],
  );
  const npc: GameNpc = worldPersonNpc(game, first!);
  assert.deepEqual(npc, {
    id: `world-${first!.id}`,
    name: first!.name,
    emoji: "👤",
    description: worldPersonSheet(fantasy, first!),
    descriptionSource: "world",
    location: "Thornmere",
    reputation: 0,
    notes: [],
    worldId: first!.id,
    role: first!.role,
  });

  const where = worldWhereYouAreText(game, { place: thornmere, met: new Set([first!.id]) });
  assert.ok(
    where.includes("- People here the party has not met. When someone new comes into the scene, make it one of them"),
  );
  assert.ok(!where.includes(`  - ${first!.name}:`), "someone met is not offered again");
  assert.ok(where.includes(`  - ${second!.name}: ${worldPersonSheet(fantasy, second!)}`));
  assert.equal(where.match(/^ {2}- /gm)!.length, 5, "five at a time");
  const allMet = worldWhereYouAreText(game, { place: thornmere, met: new Set(cast.map((person) => person.id)) });
  assert.ok(!allMet.includes("People here"));
  assert.ok(!worldWhereYouAreText(game, { place: placeNamed("The Fenlands") }).includes("People here"));
}

// ── Reputation tags may name a person by id ──
{
  const text =
    'A [reputation: npc="Oswin Holt" action="helped"] B [reputation: action="insulted" id="p5-1" npc="Oswin Holt"] [reputation: npc="Nobody"] C';
  assert.deepEqual(readReputationTags(text), [
    { npcName: "Oswin Holt", action: "helped" },
    { npcName: "Oswin Holt", action: "insulted", id: "p5-1" },
  ]);
  assert.equal(stripReputationTags(text), "A  B   C");
  // A long action is still read and stripped, as it always was.
  const long = `[reputation: npc="Oswin Holt" action="${"helped them across the flooded ford ".repeat(20)}"]`;
  assert.equal(readReputationTags(long)[0]!.npcName, "Oswin Holt");
  assert.equal(stripReputationTags(`a ${long} b`), "a  b");
  const { processReputationActions } = await import("../../packages/server/src/services/game/reputation.service.js");
  const npcs: GameNpc[] = [
    {
      id: "a",
      name: "Oswin Holt",
      emoji: "",
      description: "",
      location: "",
      reputation: 0,
      notes: [],
      worldId: "p5-1",
    },
    {
      id: "b",
      name: "Oswin Holt",
      emoji: "",
      description: "",
      location: "",
      reputation: 0,
      notes: [],
      worldId: "p9-2",
    },
  ];
  const { npcs: after } = processReputationActions(npcs, [{ npcId: "p9-2", action: "helped" }]);
  assert.equal(after.find((npc) => npc.id === "a")!.reputation, 0);
  assert.ok(after.find((npc) => npc.id === "b")!.reputation > 0, "the world id finds the right Oswin Holt");

  // Tracked people who share a name are told apart by their sheet and id.
  const { buildGmSceneState } = await import("../../packages/server/src/services/game/gm-prompts.js");
  const prompt = buildGmSceneState({
    map: null,
    npcs: [
      { ...npcs[0]!, role: "steward", description: "steward; old, a limp" },
      { ...npcs[1]!, role: "fisher", description: "fisher; young, freckles" },
      { id: "c", name: "Bryn", emoji: "", description: "x", location: "", reputation: 3, notes: [], role: "baker" },
    ],
  } as unknown as Parameters<typeof buildGmSceneState>[0]);
  assert.ok(
    prompt.includes("- Oswin Holt (steward; steward; old, a limp; id p5-1) @ unknown"),
    prompt.slice(prompt.indexOf("<tracked_npcs>"), prompt.indexOf("</tracked_npcs>")),
  );
  assert.ok(prompt.includes("- Bryn (baker) @ unknown"), "one name alone needs only the role");
}

// ── The overview tells the Game Master the groups ──
{
  const { worldOverviewPromptText } = await import("../../packages/shared/src/index.js");
  const overview = worldOverviewPromptText(game);
  // Each group line also names its head now (worldgen W3).
  assert.match(
    overview,
    /- The River Guild \(guild, at Thornmere, led by [^)]+\): Wants the tolls\. Rivals: House Vane\./,
  );
  assert.match(overview, /- House Vane \(noble house, at Thornmere, led by [^)]+\)\./);
}

// ── The model is asked for the groups and the people's names ──
{
  const { buildWorldBriefPrompt } = await import("../../packages/server/src/services/game/world-brief-writer.js");
  const prompt = buildWorldBriefPrompt({ kit: fantasy, genre: "Fantasy", setting: "x", tone: "y" });
  assert.ok(prompt.system.includes('"groups": the 3 to 12 groups the present day turns on'));
  assert.ok(prompt.system.includes('"peopleNames": for each culture id'));
  assert.ok(prompt.system.includes("1500 people's names in all"));
  assert.ok(
    prompt.user.includes("Kinds of group (id: word): household: household; shop: shop; guild: guild"),
    prompt.user,
  );
}

console.log(
  "World people: drawn the same every time, named in their own culture's words, brought in by name, and told apart.",
);
