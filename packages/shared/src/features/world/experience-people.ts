// ──────────────────────────────────────────────
// An Experience's people (Capability API 1.346): the named people of its worlds, dressed for play. Each is
// a person the world already has (generated and named, or added by hand), given a portrait and expressions
// for the narration and the journal, a walking look from the map pack's tiles, how they speak and what is
// known of them as lore. A `.people.json` file of its map pack, read strictly, as its kit and worlds are.
// ──────────────────────────────────────────────
import { z } from "zod";
import { promptSafeText, rulesetSheetBuildSchema, type RulesetSheetBuild } from "../../schemas/ruleset.schema.js";
import type { GameWorld } from "./game-world.js";
import { STORY_EXPRESSIONS, storyPerson } from "./story.js";

export const EXPERIENCE_PEOPLE_VERSION = 1;
export const EXPERIENCE_PEOPLE_MAX = Object.freeze({ people: 64, lore: 64, personLore: 8, keys: 8 });

/** An image of the package's own, declared among its assets. */
const image = z
  .string()
  .min(1)
  .max(240)
  .regex(/\.(?:png|webp|jpe?g|gif)$/iu, "A picture is a .png, .webp, .jpg or .gif file");

const loreEntry = z
  .object({
    /** The words that bring it into the Game Master's context, as a lorebook entry's keys. */
    keys: z.array(z.string().trim().min(1).max(60)).min(1).max(EXPERIENCE_PEOPLE_MAX.keys),
    content: promptSafeText(2000),
    /** A title for it in the lorebook. */
    name: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

/** A ruleset's id, as a game names the ruleset it plays (a package's own may be `package/ruleset`). */
const rulesetRef = z
  .string()
  .max(140)
  .regex(/^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/u, "A ruleset is named by its id");
const sheetFieldId = z.string().min(1).max(80);

/** A companion's sheets for one ruleset (Capability API 1.347): one build per level it is made for. */
const companionSheetSchema = z
  .object({
    /** The ruleset's sheet version the builds were written for, so a newer layout migrates them. */
    v: z.number().int().min(1).default(1),
    /** The sheet fields that hold a character's level in this ruleset, added up (a multiclass sheet
     *  keeps one per class). The party's level is read from its members' sheets the same way. */
    level: z.array(sheetFieldId).min(1).max(8),
    /** The companion at each level it is made for, lowest first. It joins, and keeps, the build for the
     *  highest level the party has reached (the lowest while the party is below them all). */
    builds: z
      .array(z.object({ at: z.number().int().min(1).max(30), build: rulesetSheetBuildSchema }).strict())
      .min(1)
      .max(30),
  })
  .strict();

const companionSchema = z
  .object({
    /** What they bring to a party, for the Game Master (healing, a light in the dark, a scout). */
    role: promptSafeText(200).optional(),
    /** Their sheets, by the id of each ruleset they can join a game of. */
    sheets: z
      .record(rulesetRef, companionSheetSchema)
      .refine((sheets) => Object.keys(sheets).length >= 1 && Object.keys(sheets).length <= 8, {
        message: "A companion has a sheet for 1 to 8 rulesets",
      }),
  })
  .strict();

export const experiencePersonSchema = z
  .object({
    /** The person of the world, by id (`<place id>-<n>`, or `-e<n>` for one added by hand). */
    person: z.string().regex(/^[a-z0-9]{1,16}-e?\d{1,4}$/u, "A person is a person id of the world"),
    portrait: image.optional(),
    /** A picture per expression, for the lines they speak. */
    expressions: z.record(z.enum(STORY_EXPRESSIONS), image).optional(),
    /** The walking look they wear on town and place maps: a character of the map pack's own tiles. */
    sprite: z.string().min(1).max(80).optional(),
    /** Who they are, for the journal and the Game Master. */
    description: promptSafeText(1000).optional(),
    /** How they speak, for the Game Master. */
    voice: promptSafeText(400).optional(),
    /** More of what is known about them, each brought in by its own keys. */
    lore: z.array(loreEntry).max(EXPERIENCE_PEOPLE_MAX.personLore).optional(),
    /** One the party can take in (Capability API 1.347): the story recruits and dismisses them, and while
     *  they travel with the party they play by their sheet for the game's ruleset. */
    companion: companionSchema.optional(),
  })
  .strict();

export const experiencePeopleSchema = z
  .object({
    peopleVersion: z.literal(EXPERIENCE_PEOPLE_VERSION),
    people: z.array(experiencePersonSchema).max(EXPERIENCE_PEOPLE_MAX.people).default([]),
    /** The Experience's own lore, beyond its people. */
    lore: z.array(loreEntry).max(EXPERIENCE_PEOPLE_MAX.lore).default([]),
  })
  .strict();
export type ExperiencePeople = z.infer<typeof experiencePeopleSchema>;
export type ExperiencePerson = ExperiencePeople["people"][number];

/** A people file, read: its shape and one entry per person; or why not. */
export function readExperiencePeople(
  text: string,
): { ok: true; people: ExperiencePeople } | { ok: false; issues: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, issues: ["The people file is not JSON."] };
  }
  const parsed = experiencePeopleSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".") || "people"}: ${issue.message}`),
    };
  }
  const seen = new Set<string>();
  for (const person of parsed.data.people) {
    if (seen.has(person.person)) return { ok: false, issues: [`${person.person} is dressed twice.`] };
    seen.add(person.person);
    for (const [ruleset, sheet] of Object.entries(person.companion?.sheets ?? {})) {
      const levels = sheet.builds.map((build) => build.at);
      if (levels.some((at, index) => index > 0 && at <= levels[index - 1]!)) {
        return { ok: false, issues: [`${person.person}'s ${ruleset} builds are not each for a higher level.`] };
      }
      const off = sheet.builds.find((each) => experienceSheetLevel(each.build, sheet.level) !== each.at);
      if (off) {
        return {
          ok: false,
          issues: [
            `${person.person}'s ${ruleset} build for level ${off.at} does not say level ${off.at} in its level fields.`,
          ],
        };
      }
    }
  }
  return { ok: true, people: parsed.data };
}

/** Every picture a people file names, for the package to have declared. */
export function experiencePeopleImages(people: ExperiencePeople): string[] {
  return [
    ...new Set(
      people.people.flatMap((person) => [
        ...(person.portrait ? [person.portrait] : []),
        ...Object.values(person.expressions ?? {}),
      ]),
    ),
  ];
}

/** The people of a file this world has, named; the others belong to the pack's other worlds. */
export function experiencePeopleIn(game: GameWorld, people: ExperiencePeople) {
  return people.people.flatMap((entry) => {
    const person = storyPerson(game, entry.person);
    return person?.named ? [{ entry, name: person.name }] : [];
  });
}

/** One lorebook entry per person this world has (their description, voice and own lore, brought in by
 *  their name) and one per entry of the Experience's own lore. */
export function experiencePeopleLore(
  game: GameWorld,
  people: ExperiencePeople,
): Array<{ name: string; keys: string[]; content: string }> {
  return [
    ...experiencePeopleIn(game, people).flatMap(({ entry, name }) => {
      const about = [
        entry.description ? `${name}: ${entry.description}` : "",
        entry.voice ? `How ${name} speaks: ${entry.voice}` : "",
      ].filter(Boolean);
      return [
        ...(about.length ? [{ name, keys: [name], content: about.join("\n") }] : []),
        ...(entry.lore ?? []).map((lore, index) => ({
          name: lore.name ?? `${name} (${index + 1})`,
          keys: lore.keys,
          content: lore.content,
        })),
      ];
    }),
    ...people.lore.map((lore, index) => ({
      name: lore.name ?? `Lore ${index + 1}`,
      keys: lore.keys,
      content: lore.content,
    })),
  ];
}

/** Whether a file has companions, for the Capability API it needs (1.347; 1.346 without). */
export function experiencePeopleMinor(people: ExperiencePeople): number {
  return people.people.some((person) => person.companion) ? 347 : 346;
}

/** A sheet's level, as a companion's ruleset counts it: its level fields added up (0 when it has none). */
export function experienceSheetLevel(build: { fields?: Record<string, unknown> } | null | undefined, level: string[]) {
  return level.reduce((sum, field) => {
    const value = Number(build?.fields?.[field]);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
}

export type ExperienceCompanionSheet = z.infer<typeof companionSheetSchema>;

/** The build a companion plays at for a party this high (the party's highest level): the one for the
 *  highest level it has reached, else the lowest. */
export function experienceCompanionBuild(
  sheet: ExperienceCompanionSheet,
  partyLevel: number,
): { at: number; build: RulesetSheetBuild } {
  return sheet.builds.filter((build) => build.at <= partyLevel).at(-1) ?? sheet.builds[0]!;
}

/** The companion a name is, among a file's people this world has (a person's name, case aside). */
export function experienceCompanionNamed(game: GameWorld, people: ExperiencePeople, name: string) {
  const wanted = name.trim().toLowerCase();
  return experiencePeopleIn(game, people).find(
    (each) => each.entry.companion && each.name.trim().toLowerCase() === wanted,
  );
}

/** A met person as the game tracks them, dressed by their Experience's people (1.346): their portrait for
 *  the journal and the narration, and who they are before what the world drew of them. */
export function experienceDressedNpc<T extends { description: string; avatarUrl?: string | null; worldId?: string }>(
  npc: T,
  people: (ExperiencePeople & { urls: Record<string, string> }) | null | undefined,
): T {
  const entry = npc.worldId ? people?.people.find((each) => each.person === npc.worldId) : undefined;
  if (!entry) return npc;
  const portrait = entry.portrait ? people!.urls[entry.portrait] : undefined;
  return {
    ...npc,
    ...(portrait && !npc.avatarUrl ? { avatarUrl: portrait } : {}),
    ...(entry.description ? { description: `${entry.description}\n\n${npc.description}` } : {}),
  };
}

/** What the Game Master is told of an Experience's companions (1.347): who they are, where, what they
 *  bring, who travels with the party now, and that only they may join it. Empty when it has none. */
export function experienceCompanionsPromptText(game: GameWorld, people: ExperiencePeople, party: string[]): string {
  const companions = experiencePeopleIn(game, people).filter(({ entry }) => entry.companion);
  if (!companions.length) return "";
  const inParty = new Set(party.map((name) => name.trim().toLowerCase()));
  const lines = companions.map(({ entry, name }) => {
    const placeId = /^(.+)-e?\d+$/.exec(entry.person)?.[1];
    const place = game.world.places.find((each) => each.id === placeId)?.name;
    const role = entry.companion!.role ? `: ${entry.companion!.role}` : "";
    const where = inParty.has(name.trim().toLowerCase())
      ? " (travelling with the party)"
      : place
        ? ` (at ${place})`
        : "";
    return `- ${name}${where}${role}`;
  });
  return [
    'Companions this Experience offers. Only they may join the party: take one in with [party_change: character="Name" change="add"] once they agree to come, and let one go with change="remove".',
    ...lines,
  ].join("\n");
}
