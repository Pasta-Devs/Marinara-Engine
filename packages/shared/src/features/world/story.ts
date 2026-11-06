// ──────────────────────────────────────────────
// A world's story script (worldgen W10): the flags, standing directions, events and cutscenes a creator
// writes for a world, played by the Engine. No code: data the Engine checks against the world it names
// and walks, as it does a kit. What the story did is folded from the replies, as the world's ledger is,
// so a swipe or regeneration takes back what its reply tripped.
// ──────────────────────────────────────────────
import { z } from "zod";
import { promptSafeText } from "../../schemas/ruleset.schema.js";
import { gameIntroSchema } from "./game-intro.js";
import type { GameWorld } from "./game-world.js";
import { WORLD_DEED_KINDS, readWorldLedger, type WorldDeed, type WorldLedgerEntry } from "./ledger.js";
import { worldPlaceNamed } from "./edits.js";
import { worldCast, type WorldPerson } from "./people.js";
import { worldPlaceMap, worldPlaceMapReach } from "./place-maps.js";
import { worldTown, worldTownReach } from "./town.js";
import { WORLD_SEASONS, worldSeason, type WorldSeason } from "./overworld.js";

export const STORY_VERSION = 1;
export const STORY_MAX = Object.freeze({
  /** 64 before Capability API 1.353, which room for companions' approval, quests and secrets raised. */
  flags: 256,
  directions: 64,
  /** 128 before Capability API 1.349, which room for companions' scenes raised. */
  events: 256,
  cutscenes: 64,
  actions: 32,
  conditions: 8,
  /** What people know, each brought in as it holds (Capability API 1.348), and how many a turn. */
  knowledge: 600,
  knowledgeKeys: 8,
  knowledgeATurn: 12,
  /** Of those, kept for the companions only travelling along, however crowded the scene. */
  knowledgeTravelling: 2,
  pages: 40,
  beats: 20,
  /** The characters of the beats the Game Master is told with its own events, in every turn's prompt. */
  gmBeatChars: 16_000,
  /** The most segments a clock has (Capability API 1.342). */
  clockSegments: 12,
  /** Set-piece fights and endings a script names (Capability API 1.343). */
  fights: 32,
  fightCreatures: 12,
  endings: 16,
});
/** The expressions a cutscene's speaker can wear: the Game Master's own list. */
export const STORY_EXPRESSIONS = Object.freeze([
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "scared",
  "disgusted",
  "thinking",
  "laughing",
  "crying",
  "blushing",
  "smirk",
  "embarrassed",
  "determined",
  "confused",
  "sleepy",
] as const);
/** A cutscene page spoken by the game's player. */
export const STORY_PLAYER = "player";
/** What a fight can end in, as the combat recap says it. */
export const STORY_FIGHT_OUTCOMES = Object.freeze(["victory", "defeat", "flee"] as const);

const id = z.string().regex(/^[a-z0-9_-]{1,40}$/, "An id is 1 to 40 lowercase letters, digits, _ or -");
/** A name written into a tag (a group, a background): one line, no brackets or quotes. */
const tagWord = (max: number) =>
  promptSafeText(max).refine((value) => !value.includes('"'), "Text cannot contain double quotes");
const value = z.union([z.boolean(), z.number().finite()]);
const flagCondition = z.object({ flag: id, is: z.enum(["=", "!=", ">", ">=", "<", "<="]), value }).strict();
/** Whether a person of the world travels with the party (Capability API 1.349), by person id. */
const partyCondition = z.object({ party: z.string().min(1).max(40), is: z.enum(["in", "out"]) }).strict();
/** The largest party a story names by its size (Capability API 1.360); a variant's open range holds any
 *  larger. */
export const STORY_PARTY_LIMIT = 32;
/** How many the party is, its companions who never fight left out (Capability API 1.360). */
const partySizeCondition = z
  .object({
    partySize: z
      .object({
        is: z.enum(["=", "!=", ">", ">=", "<", "<="]),
        value: z.number().int().min(1).max(STORY_PARTY_LIMIT),
      })
      .strict(),
  })
  .strict();
const singleCondition = z.union([flagCondition, partyCondition, partySizeCondition]);
/** Holds when any one of its conditions does (Capability API 1.358): an either-or in one list. */
const anyCondition = z.object({ any: z.array(singleCondition).min(2).max(STORY_MAX.conditions) }).strict();
const conditions = z
  .array(z.union([flagCondition, partyCondition, partySizeCondition, anyCondition]))
  .max(STORY_MAX.conditions)
  .optional();
/** What sets a companion's scene off (Capability API 1.349): one of them happens at most once a turn,
 *  the one with the highest `priority`, so scenes never pile up. */
export const STORY_QUIET_TRIGGERS = Object.freeze(["rest", "travel", "idle"] as const);

const trigger = z.discriminatedUnion("on", [
  z.object({ on: z.literal("start") }).strict(),
  z.object({ on: z.literal("arrive"), place: z.string().min(1).max(120) }).strict(),
  z.object({ on: z.literal("meet"), person: z.string().min(1).max(140) }).strict(),
  z.object({ on: z.literal("day"), day: z.number().int().min(0).max(1_000_000) }).strict(),
  z.object({ on: z.literal("turn"), turn: z.number().int().min(1).max(1_000_000) }).strict(),
  /** A fight ends in `outcome`: any fight, or (Capability API 1.358) the script's fight `fight`. */
  z.object({ on: z.literal("fight"), outcome: z.enum(STORY_FIGHT_OUTCOMES), fight: id.optional() }).strict(),
  /** The party leaves a place, and every place inside it (Capability API 1.358). */
  z.object({ on: z.literal("leave"), place: z.string().min(1).max(120) }).strict(),
  /** A fight broke this prop (Capability API 1.316), by its label: an oil jar, the mill's sluice gate. */
  z.object({ on: z.literal("broke"), prop: z.string().trim().min(1).max(40) }).strict(),
  z
    .object({
      on: z.literal("deed"),
      deed: z.enum(Object.keys(WORLD_DEED_KINDS) as [WorldDeed, ...WorldDeed[]]).optional(),
      place: z.string().min(1).max(120).optional(),
    })
    .strict(),
  z.object({ on: z.literal("flags") }).strict(),
  z.object({ on: z.literal("gm") }).strict(),
  /** The party rests (Capability API 1.349): a rest the Game Master's sheet tags took last reply, of the
   *  ruleset's rest `rest` (its id or label, as `short` or `long`) or any. */
  z.object({ on: z.literal("rest"), rest: z.string().min(1).max(40).optional() }).strict(),
  /** The party sets out from one place for another this turn (1.349), from `from` or to `to` when given. */
  z
    .object({
      on: z.literal("travel"),
      from: z.string().min(1).max(120).optional(),
      to: z.string().min(1).max(120).optional(),
    })
    .strict(),
  /** Nothing has happened for `turns` replies (1.349): no story event, no walk and no fight. */
  z.object({ on: z.literal("idle"), turns: z.number().int().min(1).max(50) }).strict(),
  /** The party walks onto a cell (map editor item 4): of a settlement's town, or of a place's hand-made map
   *  (`place` says which: a settlement never has one). From the map's top-left, 0-based. */
  z
    .object({
      on: z.literal("step"),
      place: z.string().min(1).max(120),
      x: z.number().int().min(0).max(255),
      y: z.number().int().min(0).max(255),
    })
    .strict(),
]);

const worldDeed = z
  .object({
    deed: z.enum(Object.keys(WORLD_DEED_KINDS) as [WorldDeed, ...WorldDeed[]]),
    place: z.string().min(1).max(120).optional(),
    group: tagWord(80).optional(),
    with: tagWord(80).optional(),
    who: tagWord(80).optional(),
  })
  .strict();

/** An item the story gives (Capability API 1.343): one of the ruleset's by its id (`catalog/entry`), or
 *  any other by its name, made as the Game Master's own would be. */
const storyGive = z
  .object({
    /** From 1.370 also a bare entry id (`fennicks-hymnal`), given from whichever catalog of the game's
     *  ruleset has it, or a list of alternatives, the first the ruleset offers given: one script for
     *  two rulesets. */
    item: z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).min(1).max(8)]),
    count: z.number().int().min(1).max(99).optional(),
    /** Whose bag: a party member by name; the player's when left out. */
    who: tagWord(80).optional(),
    /** For an item by name: what it is, as the Game Master's proposal says it. */
    summary: tagWord(200).optional(),
  })
  .strict();

/** An action, with its own conditions (Capability API 1.358): done only when they hold as the event
 *  reaches it, so one event can branch. */
const act = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, if: conditions }).strict();

const action = z.union([
  act({ set: id, value }),
  act({ add: id, amount: z.number().finite() }),
  act({ tell: promptSafeText(600) }),
  act({ cutscene: id }),
  act({ show: id }),
  act({ world: worldDeed }),
  act({ give: storyGive }),
  /** Starts one of the script's fights (Capability API 1.343). */
  act({ fight: id }),
  /** Puts the party at a place of the world, by id (Capability API 1.343). */
  act({ move: z.string().min(1).max(120) }),
  /** Ends the game with one of the script's endings (Capability API 1.343). */
  act({ ending: id }),
  /** Cues one of its Experience's tracks over the place's music, or (null) hands back to the place's
   *  (Capability API 1.345). */
  act({ music: id.nullable() }),
  /** Takes one of its Experience's companions into the party, or lets one go, by their person id
   *  (Capability API 1.347). */
  act({ recruit: z.string().min(1).max(40) }),
  act({ dismiss: z.string().min(1).max(40) }),
  /** Holds a place (and every place inside it), or the whole world without one, at a season whatever the
   *  day; `null` lets it go back to the script's own (Capability API 1.351). */
  act({
    season: z
      .object({
        place: z.string().min(1).max(120).optional(),
        to: z.enum(WORLD_SEASONS).nullable(),
        /** Over every season inside it, the script's own and every other hold (Capability API 1.361): an
         *  ending's turned year. `to: null` with `over` lets it go and gives them back. */
        over: z.literal(true).optional(),
      })
      .strict(),
  }),
  /** Puts a condition on each of the party, or takes it off, or moves a track of each one's sheet
   *  (Capability API 1.368): Rime Edge's cold that no rest heals. The Engine's own sheet command,
   *  applied with the reply it is delivered with. */
  act({
    sheet: z.union([
      z.object({ condition: z.string().trim().min(1).max(40), state: z.enum(["on", "off"]) }).strict(),
      z
        .object({
          track: z.string().trim().min(1).max(40),
          by: z.number().int().min(-10).max(10),
          upTo: z.number().int().min(-1000).max(1000).optional(),
        })
        .strict(),
    ]),
  }),
]);

/** A story's sheet action as the party's own sheet command (1.368). */
function storySheetTag(
  sheet: { condition: string; state: "on" | "off" } | { track: string; by: number; upTo?: number },
) {
  const clean = (text: string) => text.replace(/["[\]]/g, "");
  return "condition" in sheet
    ? `[sheet: who="party" op="condition" condition="${clean(sheet.condition)}" state="${sheet.state}"]`
    : `[sheet: who="party" op="track" track="${clean(sheet.track)}" by="${sheet.by}"${sheet.upTo !== undefined ? ` upto="${sheet.upTo}"` : ""}]`;
}

/** The largest party a story fight's variants were written for in 1.356; larger, or an open range
 *  (`{ "min": 7 }`), needs 1.360. */
export const STORY_PARTY_MAX = 6;

/** What a story fight changes of one of its creatures (1.363), and whom its actions call (1.371). */
const fightAdjustShape = {
  legendaryResistance: z.number().int().min(0).max(10).optional(),
  maxHp: z.number().int().min(1).max(100_000).optional(),
  /** A creature action that calls (1.325) calls another creature in this fight (1.371): by the action's id
   *  or name, the creature by bestiary id. */
  calls: z
    .array(z.object({ action: z.string().min(1).max(80), creature: z.string().min(1).max(200) }).strict())
    .min(1)
    .max(8)
    .optional(),
};
function fightAdjustChanges(each: { legendaryResistance?: number; maxHp?: number; calls?: unknown[] }): boolean {
  return each.legendaryResistance !== undefined || each.maxHp !== undefined || !!each.calls?.length;
}

const fightCreatures = z
  .array(
    z
      .object({
        /** A bestiary creature: its id (`catalog/entry`) or its name in the game's ruleset. */
        creature: z.string().min(1).max(200),
        count: z.number().int().min(1).max(20).default(1),
        /** What this one is called in the fight, when not the creature's own name. */
        name: tagWord(60).optional(),
        /** The creature as this fight has it (Capability API 1.363): its Legendary Resistance and its
         *  health, in place of its stat block's, without a creature of its own. */
        adjust: z
          .object({
            ...fightAdjustShape,
            /** The same again from a party level up (1.371), each over the last: the highest level any of
             *  the party has reached, as the Experience's companion sheets count it. */
            levels: z
              .array(
                z
                  .object({ from: z.number().int().min(1).max(30), ...fightAdjustShape })
                  .strict()
                  .refine(fightAdjustChanges, { message: "A level's adjust changes something" }),
              )
              .max(8)
              .refine((levels) => levels.every((each, index) => index === 0 || each.from > levels[index - 1]!.from), {
                message: "An adjust's levels are each from a higher level",
              })
              .optional(),
          })
          .strict()
          .refine((each) => fightAdjustChanges(each) || !!each.levels?.length, {
            message: "An adjust changes its Legendary Resistance, its health or whom its actions call",
          })
          .optional(),
      })
      .strict(),
  )
  .min(1)
  .max(STORY_MAX.fightCreatures);
const fightBoard = z.string().regex(/^b\d{1,4}$/, "A battlefield is b and a number");

const page = z
  .object({
    /** A person of the world by id, or `player` (the game's player, named at play); none for narration.
     *  A world's story is played with any party, so its party members are not speakers. */
    speaker: z.string().min(1).max(140).optional(),
    expression: z.enum(STORY_EXPRESSIONS).optional(),
    text: promptSafeText(600),
    /** Shown only when these hold as the scene is shown (Capability API 1.358): a group scene's lines for
     *  the companions travelling with the party. */
    if: conditions,
  })
  .strict();

export const storyScriptSchema = z
  .object({
    storyVersion: z.literal(STORY_VERSION),
    flags: z
      .array(
        z
          .object({
            id,
            kind: z.enum(["bool", "number"]),
            initial: value,
            /** The Game Master may set it with a story tag. */
            gm: z.literal(true).optional(),
            note: promptSafeText(200).optional(),
            /** A number flag's bounds (Capability API 1.358): every set and add, the Game Master's too, is
             *  kept within them. */
            min: z.number().finite().optional(),
            max: z.number().finite().optional(),
            /** A quest objective in the journal: open until the flag is true (or at its goal). */
            quest: z
              .object({
                title: promptSafeText(80),
                text: promptSafeText(300),
                goal: z.number().int().min(1).max(1_000_000).optional(),
                /** Kept out of the journal until an event shows it. */
                hidden: z.literal(true).optional(),
              })
              .strict()
              .optional(),
            /** A clock the player sees (Capability API 1.342): a number flag drawn as a circle of segments,
             *  one filled per point, full at `segments`. The Game Master is told when it fills. */
            clock: z
              .object({
                title: promptSafeText(80),
                segments: z.number().int().min(2).max(STORY_MAX.clockSegments),
                /** What happens when it fills, as the player reads it. */
                full: promptSafeText(200),
                /** Kept out of sight until an event shows it. */
                hidden: z.literal(true).optional(),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(STORY_MAX.flags)
      .default([]),
    directions: z
      .array(z.object({ id, text: promptSafeText(600), if: conditions }).strict())
      .max(STORY_MAX.directions)
      .default([]),
    /** Places held at a season whatever the day (Capability API 1.351): a place and every place inside it,
     *  the nearest holding one deciding; one without a place holds the whole world. */
    seasons: z
      .array(z.object({ place: z.string().min(1).max(120).optional(), season: z.enum(WORLD_SEASONS) }).strict())
      .max(64)
      .default([]),
    /** What people know and say, as it holds (Capability API 1.348): about themselves, others and the
     *  setting, changing as the story moves. Each is told to the Game Master on a turn its conditions hold
     *  and its person is in the scene (named, or travelling with the party), or, without a person, one of
     *  its keys is. */
    /** What being in a place does to the party over time (Capability API 1.362): every `hours` hours it
     *  spends there (and inside it) while `if` holds, its tracks move and its conditions go on, for each
     *  of the party. Noonfield's light outside a fight. */
    /** Where death is held (Capability API 1.366), the showcase's valley: while the party is in `place` (or
     *  inside it; the whole world without one) and `if` holds, a fight there is fought on Held Ground
     *  (1.323): whoever reaches no health is felled instead, `condition` goes on them, and each one with a
     *  sheet moves its `marks` tracks (a mark of Owing). The first that holds is the one. */
    heldGround: z
      .array(
        z
          .object({
            id,
            place: z.string().min(1).max(120).optional(),
            label: promptSafeText(80).optional(),
            condition: z.string().trim().min(1).max(40).optional(),
            marks: z
              .array(
                z.object({ track: z.string().trim().min(1).max(40), by: z.number().int().min(-10).max(10) }).strict(),
              )
              .min(1)
              .max(4)
              .optional(),
            if: conditions,
            /** For the Game Master, while it holds. */
            tell: promptSafeText(300).optional(),
            /** What letting it go does to a fight still running (Capability API 1.369): the felled die
             *  (`"die"`, as when left out) or go down dying (`"down"`), and with `owing` each felled
             *  character's marks on `track` each cost a dying save, with `bonus` (a number, or a story
             *  number flag's value: Debts Settled) added. */
            release: z
              .object({
                felled: z.enum(["die", "down"]).optional(),
                owing: z
                  .object({
                    track: z.string().trim().min(1).max(40).optional(),
                    bonus: z.union([z.number().int().min(-20).max(20), z.object({ flag: id }).strict()]).optional(),
                  })
                  .strict()
                  .optional(),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(8)
      .default([]),
    exposures: z
      .array(
        z
          .object({
            id,
            place: z.string().min(1).max(120),
            label: promptSafeText(80).optional(),
            hours: z.number().int().min(1).max(48),
            tracks: z
              .array(
                z
                  .object({
                    track: z.string().trim().min(1).max(40),
                    by: z.number().int().min(-10).max(10),
                    /** Where the move stops (1.364): never past it, and never moving one already beyond it. */
                    upTo: z.number().int().min(-1000).max(1000).optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(4)
              .optional(),
            applies: z.array(z.string().trim().min(1).max(40)).min(1).max(4).optional(),
            /** A save each of the party makes each time it bites (1.364), rolled by the Engine off their own
             *  sheets: only those who fail it take its tracks and conditions. `against` is what the save is
             *  made against, so an item's modifier narrowed to it (a straw hat against `noon_light`) counts.
             *  The same shape as a fight board's light rule `save` (1.321). */
            save: z
              .object({
                save: z.string().trim().min(1).max(40),
                difficulty: z.number().int().min(0).max(1000),
                against: z
                  .object({
                    conditions: z.array(z.string().trim().min(1).max(40)).min(1).max(8).optional(),
                    damage: z.array(z.string().trim().min(1).max(40)).min(1).max(8).optional(),
                  })
                  .strict()
                  .optional(),
              })
              .strict()
              .optional(),
            /** A shade carried lit by any of the party (a Lantern of Dusk, an item whose light `shade`s)
             *  keeps it off, as `if` not holding does (1.365). */
            sparedByShade: z.literal(true).optional(),
            if: conditions,
            /** For the Game Master, each time it bites. */
            tell: promptSafeText(300).optional(),
          })
          .strict()
          .refine((each) => !!each.tracks || !!each.applies, {
            message: "An exposure moves a track or puts a condition on",
          }),
      )
      .max(16)
      .default([]),
    knowledge: z
      .array(
        z
          .object({
            id,
            /** Whose it is: a person of the world, by id. */
            person: z.string().min(1).max(40).optional(),
            /** Words that bring it in (with a person, as well as their being there). */
            keys: z.array(z.string().trim().min(1).max(60)).min(1).max(STORY_MAX.knowledgeKeys).optional(),
            text: promptSafeText(800),
            if: conditions,
          })
          .strict(),
      )
      .max(STORY_MAX.knowledge)
      .default([]),
    events: z
      .array(
        z
          .object({
            id,
            when: trigger,
            if: conditions,
            repeat: z.literal(true).optional(),
            /** The Game Master may trip it with a story tag. */
            gm: z.literal(true).optional(),
            note: promptSafeText(200).optional(),
            /** Among rest, travel and idle events that could happen on one turn, the highest goes (1.349). */
            priority: z.number().int().min(-100).max(100).optional(),
            do: z.array(action).min(1).max(STORY_MAX.actions),
          })
          .strict(),
      )
      .max(STORY_MAX.events)
      .default([]),
    cutscenes: z
      .array(
        z.discriminatedUnion("kind", [
          z
            .object({
              id,
              kind: z.literal("pages"),
              /** A background as a Game Master's [bg:] names one: installed, or generated. */
              background: z
                .string()
                .max(120)
                .regex(/^backgrounds:[a-z0-9:_-]+$/i, "A background is a backgrounds: tag")
                .optional(),
              pages: z.array(page).min(1).max(STORY_MAX.pages),
            })
            .strict(),
          z
            .object({
              id,
              kind: z.literal("beats"),
              beats: z.array(promptSafeText(600)).min(1).max(STORY_MAX.beats),
            })
            .strict(),
        ]),
      )
      .max(STORY_MAX.cutscenes)
      .default([]),
    /** The Game Master's intro message (Capability API 1.339): exactly the game's first message
     *  (`"defined"`) or guidance for the one the Game Master writes (`"guided"`); `locked` keeps a player
     *  from changing it at setup. */
    intro: gameIntroSchema.optional(),
    /** Set-piece fights (Capability API 1.343): who is fought, and where when a board is painted for it. */
    fights: z
      .array(
        z
          .object({
            id,
            name: promptSafeText(80),
            creatures: fightCreatures,
            /** A board painted by hand in the world (`b<n>`), fought on instead of the one where it starts. */
            battlefield: fightBoard.optional(),
            /** For the Game Master: how it comes about. */
            note: promptSafeText(300).optional(),
            /** The fight for parties of other sizes (Capability API 1.356): the first whose `party` holds the
             *  party's size (its player characters and the companions travelling with it) is fought, with
             *  its own creatures (and board and note, when it gives them); else the fight as above. */
            variants: z
              .array(
                z
                  .object({
                    party: z.union([
                      z.number().int().min(1).max(STORY_PARTY_LIMIT),
                      z
                        .object({
                          min: z.number().int().min(1).max(STORY_PARTY_LIMIT),
                          /** Left out, any party from `min` up (1.360). */
                          max: z.number().int().min(1).max(STORY_PARTY_LIMIT).optional(),
                        })
                        .strict()
                        .refine(
                          (range) => range.max === undefined || range.min <= range.max,
                          "A party's min is not above its max",
                        ),
                    ]),
                    creatures: fightCreatures,
                    battlefield: fightBoard.optional(),
                    note: promptSafeText(300).optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(STORY_PARTY_LIMIT)
              .optional(),
          })
          .strict(),
      )
      .max(STORY_MAX.fights)
      .default([]),
    /** The endings the game can have (Capability API 1.343): a title, a scene and the epilogue. */
    endings: z
      .array(
        z
          .object({
            id,
            title: promptSafeText(80),
            cutscene: id.optional(),
            epilogue: promptSafeText(2000),
          })
          .strict(),
      )
      .max(STORY_MAX.endings)
      .default([]),
  })
  .strict();
export type StoryScript = z.infer<typeof storyScriptSchema>;
export type StoryScriptInput = z.input<typeof storyScriptSchema>;
export type StoryEvent = StoryScript["events"][number];
export type StoryFlag = StoryScript["flags"][number];
export type StoryAction = StoryEvent["do"][number];
export type StoryCondition = NonNullable<StoryEvent["if"]>[number];
export type StoryCutscene = StoryScript["cutscenes"][number];
export type StoryFight = StoryScript["fights"][number] & {
  /** The party size it was chosen for, when a variant of it was (1.356). */
  forParty?: number;
};
export type StoryEnding = StoryScript["endings"][number];
/** A `catalog/entry` item or creature id, as a ruleset's catalogs name their entries. */
const STORY_REF = /^[a-z][a-z0-9_]{0,39}\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function storyIsRef(value: string): boolean {
  return STORY_REF.test(value);
}

const STORY_BARE_ENTRY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A bare catalog entry id (1.370), given from whichever catalog of the game's ruleset has it. */
export function storyIsBareEntry(value: string): boolean {
  return STORY_BARE_ENTRY.test(value);
}

/** The items a give names, its alternatives in order (1.370). */
export function storyGiveItems(give: { item: string | readonly string[] }): readonly string[] {
  return typeof give.item === "string" ? [give.item] : give.item;
}

/** Whether a give names the ruleset's own items, by id or bare entry id, so the game's book is read. */
export function storyGivesById(story: StoryScript): boolean {
  return story.events.some((event) =>
    event.do.some(
      (action) =>
        "give" in action && storyGiveItems(action.give).some((item) => storyIsRef(item) || storyIsBareEntry(item)),
    ),
  );
}

/** A person of the world by their id (`<place id>-<n>`, or `-e<n>` for one added by hand). */
export function storyPerson(game: GameWorld, personId: string): WorldPerson | undefined {
  const match = /^(.+)-e?\d+$/.exec(personId);
  return match ? worldCast(game, match[1]!).find((person) => person.id === personId) : undefined;
}

/** A list's conditions one by one, an `any` group's each in it (1.358). */
export function storyConditionsFlat(list: StoryEvent["if"]): Array<Exclude<StoryCondition, { any: unknown }>> {
  return (list ?? []).flatMap((condition) => ("any" in condition ? condition.any : [condition]));
}

/** Every list of conditions a script has: its events', their actions', its directions', what people
 *  know's and its scenes' pages'. */
function storyConditionLists(story: StoryScript): Array<StoryEvent["if"]> {
  return [
    ...story.exposures.map((exposure) => exposure.if),
    ...story.heldGround.map((held) => held.if),
    ...story.events.flatMap((event) => [event.if, ...event.do.map((action) => action.if)]),
    ...story.directions.map((direction) => direction.if),
    ...story.knowledge.map((known) => known.if),
    ...story.cutscenes.flatMap((cutscene) => (cutscene.kind === "pages" ? cutscene.pages.map((page) => page.if) : [])),
  ];
}

/** A number kept within its flag's bounds (1.358). */
function storyBounded(flag: Pick<StoryFlag, "min" | "max"> | undefined, value: number): number {
  return Math.min(flag?.max ?? Infinity, Math.max(flag?.min ?? -Infinity, value));
}

const NEEDS_GROUP: readonly WorldDeed[] = [
  "help",
  "hinder",
  "befriend",
  "set_against",
  "ally",
  "betray",
  "take",
  "destroy",
  "crown",
];
const NEEDS_PLACE: readonly WorldDeed[] = ["improve", "damage", "take", "fall"];

/**
 * A story script, checked against the world it is for: every flag, cutscene, place, person and group
 * it names is there, its values fit their flags, and only what it declares the Game Master's is.
 * Strict, as a kit is: a script that does not fit is refused whole, with the reasons.
 */
/** The beats a `gm` event's scenes have, each scene once: told to the Game Master with the event, to
 *  narrate as it marks it. */
function gmEventBeats(event: StoryEvent, cutscenes: ReadonlyMap<string, StoryScript["cutscenes"][number]>) {
  const ids = new Set(event.do.flatMap((action) => ("cutscene" in action ? [action.cutscene] : [])));
  return [...ids].flatMap((id) => {
    const scene = cutscenes.get(id);
    return scene?.kind === "beats" ? scene.beats : [];
  });
}

export function checkStoryScript(
  game: GameWorld,
  input: unknown,
): { ok: true; story: StoryScript } | { ok: false; issues: string[] } {
  const parsed = storyScriptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, 20).map((issue) => `${issue.path.join(".") || "story"}: ${issue.message}`),
    };
  }
  const story = parsed.data;
  const issues: string[] = [];
  const unique = (list: Array<{ id: string }>, what: string) => {
    const seen = new Set<string>();
    for (const item of list) {
      if (seen.has(item.id)) issues.push(`Two ${what} are called "${item.id}".`);
      seen.add(item.id);
    }
  };
  unique(story.flags, "flags");
  unique(story.directions, "directions");
  unique(story.knowledge, "knowledge entries");
  unique(story.events, "events");
  unique(story.cutscenes, "cutscenes");
  unique(story.fights, "fights");
  unique(story.endings, "endings");
  const fightIds = new Set(story.fights.map((fight) => fight.id));
  const endingIds = new Set(story.endings.map((ending) => ending.id));
  const boards = new Set((game.edits?.battlefields ?? []).map((board) => board.id));

  const flags = new Map(story.flags.map((flag) => [flag.id, flag]));
  const cutscenes = new Set(story.cutscenes.map((cutscene) => cutscene.id));
  const places = new Set(game.world.places.map((place) => place.id));
  const groups = new Set(game.brief.groups.map((group) => group.name.toLowerCase()));
  const fits = (flag: StoryFlag, given: boolean | number) =>
    flag.kind === "bool" ? typeof given === "boolean" : typeof given === "number";
  const flagOf = (flagId: string, where: string) => {
    const flag = flags.get(flagId);
    if (!flag) issues.push(`${where}: no flag "${flagId}".`);
    return flag;
  };
  const checkConditions = (list: StoryEvent["if"], where: string) => {
    for (const condition of storyConditionsFlat(list)) {
      if ("party" in condition) {
        personOk(condition.party, where);
        continue;
      }
      if ("partySize" in condition) continue;
      const flag = flagOf(condition.flag, where);
      if (!flag) continue;
      if (!fits(flag, condition.value)) issues.push(`${where}: "${flag.id}" is a ${flag.kind} flag.`);
      if (flag.kind === "bool" && condition.is !== "=" && condition.is !== "!=") {
        issues.push(`${where}: a yes-or-no flag is only = or !=.`);
      }
    }
  };
  const placeOk = (placeId: string, where: string) => {
    if (!places.has(placeId)) issues.push(`${where}: no place "${placeId}" in this world.`);
  };
  const personOk = (personId: string, where: string) => {
    const person = storyPerson(game, personId);
    if (!person) issues.push(`${where}: no person "${personId}" in this world.`);
    else if (!person.named) issues.push(`${where}: "${personId}" has no name the story can know them by.`);
  };
  const groupOk = (name: string | undefined, where: string) => {
    if (name !== undefined && !groups.has(name.toLowerCase())) issues.push(`${where}: no group "${name}".`);
  };

  for (const flag of story.flags) {
    const where = `Flag "${flag.id}"`;
    if (!fits(flag, flag.initial)) issues.push(`${where}: its first value is not a ${flag.kind}.`);
    if (flag.quest?.goal !== undefined && flag.kind !== "number") issues.push(`${where}: only a number has a goal.`);
    if (flag.clock && flag.kind !== "number") issues.push(`${where}: only a number flag is a clock.`);
    if (flag.min !== undefined || flag.max !== undefined) {
      if (flag.kind !== "number") issues.push(`${where}: only a number flag has a min or a max.`);
      else if (flag.min !== undefined && flag.max !== undefined && flag.min > flag.max)
        issues.push(`${where}: its min is above its max.`);
      else if (typeof flag.initial === "number" && storyBounded(flag, flag.initial) !== flag.initial)
        issues.push(`${where}: its first value is outside its min and max.`);
    }
  }
  for (const direction of story.directions) checkConditions(direction.if, `Direction "${direction.id}"`);
  const heldSeasons = new Set<string>();
  for (const held of story.seasons) {
    if (held.place) placeOk(held.place, `Season of "${held.place}"`);
    if (heldSeasons.has(held.place ?? "*")) issues.push(`Two seasons hold "${held.place ?? "the world"}".`);
    heldSeasons.add(held.place ?? "*");
  }
  const heldIds = new Set<string>();
  for (const held of story.heldGround) {
    const where = `Held ground "${held.id}"`;
    if (heldIds.has(held.id)) issues.push(`${where}: its id is used twice.`);
    heldIds.add(held.id);
    if (held.place !== undefined) placeOk(held.place, where);
    const bonus = held.release?.owing?.bonus;
    if (bonus && typeof bonus === "object" && story.flags.find((flag) => flag.id === bonus.flag)?.kind !== "number")
      issues.push(`${where}: its release's bonus names "${bonus.flag}", which is no number flag of the script.`);
    checkConditions(held.if, where);
  }
  const exposureIds = new Set<string>();
  for (const exposure of story.exposures) {
    const where = `Exposure "${exposure.id}"`;
    if (exposureIds.has(exposure.id)) issues.push(`${where}: its id is used twice.`);
    exposureIds.add(exposure.id);
    placeOk(exposure.place, where);
    checkConditions(exposure.if, where);
  }
  for (const known of story.knowledge) {
    const where = `Knowledge "${known.id}"`;
    checkConditions(known.if, where);
    if (known.person) personOk(known.person, where);
    else if (!known.keys) issues.push(`${where}: it needs a person or keys to come in by.`);
  }
  for (const event of story.events) {
    const where = `Event "${event.id}"`;
    checkConditions(event.if, where);
    const when = event.when;
    if (when.on === "gm" && !event.gm) issues.push(`${where}: only the Game Master trips it, so it must be its.`);
    if (when.on === "arrive" || when.on === "leave") placeOk(when.place, where);
    if (when.on === "fight" && when.fight && !fightIds.has(when.fight))
      issues.push(`${where}: no fight "${when.fight}".`);
    if (when.on === "travel") {
      if (when.from) placeOk(when.from, where);
      if (when.to) placeOk(when.to, where);
    }
    if (when.on === "meet") personOk(when.person, where);
    if (when.on === "deed" && when.place) placeOk(when.place, where);
    // Only what stands on one of the world's battlefields can be broken (1.316).
    if (when.on === "broke") {
      const label = when.prop.trim().toLowerCase();
      const painted = (game.edits?.battlefields ?? []).some((map) =>
        (map.props ?? []).some((prop) => prop.label.trim().toLowerCase() === label),
      );
      if (!painted) issues.push(`${where}: no battlefield of this world has a prop called "${when.prop}".`);
    }
    if (when.on === "step") {
      const issue = storyStepIssue(game, when);
      if (issue) issues.push(`${where}: ${issue}`);
    }
    event.do.forEach((action, index) => checkConditions(action.if, `${where}, action ${index + 1}`));
    for (const action of event.do) {
      if ("set" in action) {
        const flag = flagOf(action.set, where);
        if (flag && !fits(flag, action.value)) issues.push(`${where}: "${flag.id}" is a ${flag.kind} flag.`);
      } else if ("add" in action) {
        const flag = flagOf(action.add, where);
        if (flag && flag.kind !== "number") issues.push(`${where}: only a number flag is added to.`);
      } else if ("show" in action) {
        const flag = flagOf(action.show, where);
        if (flag && !flag.quest && !flag.clock)
          issues.push(`${where}: "${flag.id}" is not a quest objective or a clock to show.`);
      } else if ("cutscene" in action) {
        if (!cutscenes.has(action.cutscene)) issues.push(`${where}: no cutscene "${action.cutscene}".`);
        const scene = story.cutscenes.find((each) => each.id === action.cutscene);
        const person = when.on === "meet" && event.repeat ? storyPerson(game, when.person) : undefined;
        if (scene && person?.named) {
          const name = person.name.toLowerCase();
          const texts = scene.kind === "pages" ? scene.pages.map((page) => page.text) : scene.beats;
          const speaks = scene.kind === "pages" && scene.pages.some((page) => page.speaker === person.id);
          if (speaks || texts.some((text) => text.toLowerCase().includes(name))) {
            issues.push(`${where}: its own scene names ${person.name}, so it would meet them again every turn.`);
          }
        }
      } else if ("fight" in action) {
        if (!fightIds.has(action.fight)) issues.push(`${where}: no fight "${action.fight}".`);
        if (event.repeat && when.on === "fight") issues.push(`${where}: it starts a fight when one ends, every time.`);
      } else if ("ending" in action) {
        if (!endingIds.has(action.ending)) issues.push(`${where}: no ending "${action.ending}".`);
      } else if ("season" in action) {
        if (action.season.place) placeOk(action.season.place, where);
      } else if ("recruit" in action) {
        personOk(action.recruit, where);
      } else if ("dismiss" in action) {
        personOk(action.dismiss, where);
      } else if ("move" in action) {
        placeOk(action.move, where);
        if (event.repeat && when.on === "arrive") issues.push(`${where}: it moves the party, every time it arrives.`);
      } else if ("give" in action) {
        if (storyGiveItems(action.give).some((item) => !item.trim())) issues.push(`${where}: give needs an item.`);
      } else if ("world" in action) {
        const deed = action.world;
        if (NEEDS_GROUP.includes(deed.deed) && !deed.group) issues.push(`${where}: ${deed.deed} needs a group.`);
        if (NEEDS_PLACE.includes(deed.deed) && !deed.place) issues.push(`${where}: ${deed.deed} needs a place.`);
        if ((deed.deed === "befriend" || deed.deed === "set_against") && !deed.with) {
          issues.push(`${where}: ${deed.deed} needs the group it is with.`);
        }
        if (deed.deed === "crown" && !deed.who) issues.push(`${where}: crown needs who is crowned.`);
        if (deed.place) placeOk(deed.place, where);
        if (
          when.on === "deed" &&
          event.repeat &&
          (!when.deed || when.deed === deed.deed) &&
          (!when.place || when.place === deed.place)
        ) {
          issues.push(`${where}: it does the deed it waits for, so it would happen again every turn.`);
        }
        groupOk(deed.group, where);
        groupOk(deed.with, where);
        // As the world's ledger answers it: a kind of change the kit has off is always refused.
        if (!game.kit.change.kinds[WORLD_DEED_KINDS[deed.deed]].on) {
          issues.push(
            `${where}: this kit has "${WORLD_DEED_KINDS[deed.deed]}" changes off, so ${deed.deed} never happens.`,
          );
        }
        if (deed.with && deed.group && deed.with.toLowerCase() === deed.group.toLowerCase()) {
          issues.push(`${where}: ${deed.deed} needs two different groups.`);
        }
      }
    }
  }
  for (const fight of story.fights) {
    for (const board of [fight.battlefield, ...(fight.variants ?? []).map((variant) => variant.battlefield)]) {
      if (board && !boards.has(board))
        issues.push(`Fight "${fight.id}": no battlefield "${board}" painted in this world.`);
    }
    // Each size of party has one variant at most.
    const sizes = new Set<number>();
    for (const variant of fight.variants ?? []) {
      const [min, max] = storyPartyRange(variant.party);
      for (let size = min; size <= Math.min(max, STORY_PARTY_LIMIT + 1); size++) {
        if (sizes.has(size)) issues.push(`Fight "${fight.id}": two variants are for a party of ${size}.`);
        sizes.add(size);
      }
    }
  }
  for (const ending of story.endings) {
    if (ending.cutscene && !cutscenes.has(ending.cutscene)) {
      issues.push(`Ending "${ending.id}": no cutscene "${ending.cutscene}".`);
    }
  }
  for (const cutscene of story.cutscenes) {
    if (cutscene.kind !== "pages") continue;
    cutscene.pages.forEach((page, index) => {
      if (page.speaker && page.speaker !== STORY_PLAYER) personOk(page.speaker, `Cutscene "${cutscene.id}"`);
      checkConditions(page.if, `Cutscene "${cutscene.id}", page ${index + 1}`);
    });
  }
  // The Game Master is told its own events' beats on every turn, so they are kept to a prompt's share.
  const scenes = new Map(story.cutscenes.map((cutscene) => [cutscene.id, cutscene]));
  const gmBeatChars = story.events
    .filter((event) => event.gm)
    .reduce((sum, event) => sum + gmEventBeats(event, scenes).reduce((chars, beat) => chars + beat.length, 0), 0);
  if (gmBeatChars > STORY_MAX.gmBeatChars) {
    issues.push(
      `The Game Master's own events have ${gmBeatChars} characters of beats, told on every turn; keep them to ${STORY_MAX.gmBeatChars}.`,
    );
  }
  const unique20 = [...new Set(issues)].slice(0, 20);
  return unique20.length ? { ok: false, issues: unique20 } : { ok: true, story };
}

/**
 * Why a step event's cell is not one the party can walk onto, or null. A town's cell (the town as play
 * lays it out, a snapshot's own town included) is walkable ground a walk from the square reaches, and not on
 * a free lot, where the story's added places can be built. A place's cell is floor of its hand-made map that
 * a walk from its entry reaches; a place with no hand-made map has no cells to name (its generated map's
 * cells change with its layout).
 */
export function storyStepIssue(game: GameWorld, step: { place: string; x: number; y: number }): string | null {
  const place = game.world.places.find((each) => each.id === step.place);
  if (!place) return `no place "${step.place}" in this world.`;
  const cell = `column ${step.x + 1}, row ${step.y + 1}`;
  if (place.rank !== undefined) {
    const town = worldTown(game, place.id);
    if (!town) return `${place.name} has no town.`;
    if (step.x >= town.width || step.y >= town.height)
      return `${cell} is outside ${place.name} (${town.width} by ${town.height}).`;
    const at = step.y * town.width + step.x;
    if (!worldTownReach(town).has(at)) return `${cell} of ${place.name} is not ground a walk from the square reaches.`;
    const under = (box: { x: number; y: number; w: number; h: number }) =>
      step.x >= box.x && step.y >= box.y && step.x < box.x + box.w && step.y < box.y + box.h;
    const freeLot = town.lots.find(
      (lot) =>
        under(lot) &&
        !town.buildings.some(
          (building) =>
            building.x < lot.x + lot.w &&
            lot.x < building.x + building.w &&
            building.y < lot.y + lot.h &&
            lot.y < building.y + building.h,
        ),
    );
    if (freeLot) return `${cell} of ${place.name} is on a free lot, where the story may build.`;
    return null;
  }
  const map = worldPlaceMap(game, place.id);
  if (!map) return `${place.name} has no map made by hand, so its cells cannot be named.`;
  if (step.x >= map.width || step.y >= map.height)
    return `${cell} is outside ${place.name}'s map (${map.width} by ${map.height}).`;
  if (!worldPlaceMapReach(map).has(step.y * map.width + step.x))
    return `${cell} of ${place.name}'s map is not floor a walk from its entry reaches.`;
  return null;
}

// ── What the story did: folded from the answered [story:] tags of the replies ──

/** One answered story tag: the event it tripped (none for a flag the Game Master set), what it set,
 *  and the objectives it showed. Recorded in the tag, so a script changed later never rewrites it. */
export interface StoryLedgerEntry {
  event?: string;
  /** Tripped by the Engine (on what it saw), not by the Game Master's own tag. */
  by?: "engine";
  set: Array<[string, boolean | number]>;
  show: string[];
  /** The script's fight it started (1.343). */
  fight?: string;
  /** The script's ending it ended the game with (1.343). */
  ending?: string;
  /** The track it cued, or null when it handed back to the place's music (1.345). */
  music?: string | null;
  /** The seasons it held places at (1.351), by place id (`*` the whole world); null lets one go. */
  seasons?: Array<[string, WorldSeason | null]>;
  /** Which of its event's actions were done (1.358), by place in the list, when some have conditions. */
  acts?: number[];
  /** The item use whose story cost it recorded (1.359), by the spend's id. */
  spend?: string;
  /** An exposure it kept (1.362): since when (game minutes) the party has been in its place, null when it
   *  left, and how many times it has bitten since. */
  exposure?: { id: string; since: number | null; bitten: number };
  /** The held ground the party came onto (1.366), by id, or null when it left it. */
  held?: string | null;
}

// A body never holds "[", so a tag opener repeated without a "]" is read in one pass.
const STORY_TAG = /\[story:([^[\]]*)\]/gi;

function attributes(body: string): Map<string, string> {
  const values = new Map<string, string>();
  // A name starts only where a word does, so a long run of letters with no "=" is read once, not from each letter.
  for (const match of body.matchAll(/\b([a-z]+)\s*=\s*"([^"]*)"/gi)) values.set(match[1]!.toLowerCase(), match[2]!);
  return values;
}

/** A recorded value: `true`/`false` or a number. */
const readValue = (text: string): boolean | number | undefined =>
  text === "true"
    ? true
    : text === "false"
      ? false
      : text.trim() !== "" && Number.isFinite(Number(text))
        ? Number(text)
        : undefined;

/** Every story tag answered ok in these replies, oldest first. */
export function readStoryLedger(replies: readonly string[]): StoryLedgerEntry[] {
  const entries: StoryLedgerEntry[] = [];
  for (const reply of replies) {
    for (const match of reply.matchAll(STORY_TAG)) {
      const values = attributes(match[1] ?? "");
      if (values.get("result") !== "ok") continue;
      const set: Array<[string, boolean | number]> = [];
      for (const pair of (values.get("set") ?? "").split(";")) {
        const [flag, raw] = pair.split("=");
        const read = raw === undefined ? undefined : readValue(raw);
        if (flag && read !== undefined) set.push([flag.trim(), read]);
      }
      const show = (values.get("show") ?? "")
        .split(";")
        .map((each) => each.trim())
        .filter(Boolean);
      const event = values.get("event")?.trim();
      const fight = values.get("fight")?.trim();
      const ending = values.get("ending")?.trim();
      const music = values.get("music");
      const seasons = (values.get("seasons") ?? "").split(";").flatMap((pair): Array<[string, WorldSeason | null]> => {
        const [place, season] = pair.split("=").map((each) => each?.trim());
        if (!place) return [];
        if (!season) return [[place, null]];
        return (WORLD_SEASONS as readonly string[]).includes(season) ? [[place, season as WorldSeason]] : [];
      });
      const acts = values.has("acts")
        ? (values.get("acts") ?? "")
            .split(";")
            .filter((each) => /^\d{1,2}$/.test(each.trim()))
            .map((each) => Number(each.trim()))
        : undefined;
      const spend = values.get("spend")?.trim();
      const exposureId = values.get("exposure")?.trim();
      const since = values.get("since")?.trim();
      const bitten = Number(values.get("bitten") ?? 0);
      const exposure =
        exposureId && (since === "" || (since !== undefined && /^\d{1,12}$/u.test(since)))
          ? {
              id: exposureId,
              since: since ? Number(since) : null,
              bitten: Number.isInteger(bitten) && bitten >= 0 ? bitten : 0,
            }
          : undefined;
      const held = values.get("held");
      entries.push({
        ...(held !== undefined ? { held: held.trim() || null } : {}),
        ...(exposure ? { exposure } : {}),
        ...(spend ? { spend } : {}),
        ...(acts ? { acts } : {}),
        ...(music !== undefined ? { music: music.trim() || null } : {}),
        ...(seasons.length ? { seasons } : {}),
        ...(event ? { event } : {}),
        ...(fight ? { fight } : {}),
        ...(ending ? { ending } : {}),
        ...(values.get("by") === "engine" ? { by: "engine" } : {}),
        set,
        show,
      });
    }
  }
  return entries;
}

export interface StoryState {
  flags: Record<string, boolean | number>;
  /** How many times each event has tripped. */
  fired: Record<string, number>;
  /** The hidden objectives shown so far. */
  shown: string[];
  /** The ending the game has had, once it has (1.343): the story trips nothing after it. */
  ended?: string;
  /** The track the story last cued, while it holds (1.345). */
  music?: string;
  /** The seasons the story holds places at now (1.351), by place id (`*` the whole world). */
  seasons?: Record<string, WorldSeason>;
  /** The exposures running now (1.362): since when the party has been in each one's place, and how many
   *  times it has bitten. */
  exposures?: Record<string, { since: number; bitten: number }>;
  /** The held ground the party is on (1.366), by id. */
  held?: string;
}

/** The story as its ledger left it: each flag's value (a recorded value the script no longer fits is
 *  skipped), the events tripped and the objectives shown. */
export function storyState(story: StoryScript, ledger: readonly StoryLedgerEntry[]): StoryState {
  const kinds = new Map(story.flags.map((flag) => [flag.id, flag.kind]));
  const declared = new Map(story.flags.map((flag) => [flag.id, flag]));
  const flags: StoryState["flags"] = Object.fromEntries(story.flags.map((flag) => [flag.id, flag.initial]));
  const fired: StoryState["fired"] = {};
  const shown = new Set<string>();
  let ended: string | undefined;
  let music: string | null = null;
  const seasons: Record<string, WorldSeason> = {};
  const exposures: NonNullable<StoryState["exposures"]> = {};
  let held: string | null = null;
  for (const entry of ledger) {
    if (entry.music !== undefined) music = entry.music;
    if (entry.held !== undefined) held = entry.held;
    if (entry.exposure) {
      if (entry.exposure.since === null) delete exposures[entry.exposure.id];
      else exposures[entry.exposure.id] = { since: entry.exposure.since, bitten: entry.exposure.bitten };
    }
    for (const [place, season] of entry.seasons ?? []) {
      if (season) seasons[place] = season;
      else delete seasons[place];
    }
    if (entry.event) fired[entry.event] = (fired[entry.event] ?? 0) + 1;
    if (entry.ending && !ended && story.endings.some((ending) => ending.id === entry.ending)) ended = entry.ending;
    for (const [flag, given] of entry.set) {
      const kind = kinds.get(flag);
      if (kind === "bool" && typeof given === "boolean") flags[flag] = given;
      // A number recorded before its flag had bounds (or under looser ones) reads within today's.
      else if (kind && kind !== "bool" && typeof given === "number")
        flags[flag] = storyBounded(declared.get(flag), given);
    }
    for (const flag of entry.show) if (kinds.has(flag)) shown.add(flag);
  }
  return {
    flags,
    fired,
    shown: [...shown],
    ...(ended ? { ended } : {}),
    ...(music ? { music } : {}),
    ...(Object.keys(seasons).length ? { seasons } : {}),
    ...(Object.keys(exposures).length ? { exposures } : {}),
    ...(held && story.heldGround.some((each) => each.id === held) ? { held } : {}),
  };
}

/** A quest objective the story shows the player (worldgen W10): open until its flag is true, or its
 *  number reaches the goal. */
export interface StoryObjective {
  flag: string;
  title: string;
  text: string;
  done: boolean;
  /** A number objective with a goal: how far along it is. */
  progress?: { at: number; goal: number };
}

/** The objectives the player can see: every quest flag, but a hidden one only once the story shows it. */
export function storyObjectives(story: StoryScript, state: StoryState): StoryObjective[] {
  return story.flags.flatMap((flag) => {
    if (!flag.quest || (flag.quest.hidden && !state.shown.includes(flag.id))) return [];
    const value = state.flags[flag.id];
    const goal = flag.kind === "number" ? (flag.quest.goal ?? 1) : undefined;
    const at = Number(value) || 0;
    return [
      {
        flag: flag.id,
        title: flag.quest.title,
        text: flag.quest.text,
        done: goal === undefined ? value === true : at >= goal,
        ...(goal !== undefined && flag.quest.goal !== undefined ? { progress: { at: Math.min(at, goal), goal } } : {}),
      },
    ];
  });
}

/** The tracks a script cues (1.345), for its Experience's music to have. */
export function storyMusicCues(story: StoryScript): string[] {
  return [
    ...new Set(
      story.events.flatMap((event) =>
        event.do.flatMap((action) => ("music" in action && action.music !== null ? [action.music] : [])),
      ),
    ),
  ];
}

/** The companions a script recruits or dismisses (1.347), by person id, for its Experience's people to have. */
export function storyCompanionsNamed(story: StoryScript): string[] {
  return [
    ...new Set(
      story.events.flatMap((event) =>
        event.do.flatMap((action) =>
          "recruit" in action ? [action.recruit] : "dismiss" in action ? [action.dismiss] : [],
        ),
      ),
    ),
  ];
}

/** The Capability API minor a script needs: 1.370 for gives of alternatives, 1.369 for held ground's release, 1.368 for sheet actions, 1.366 for held ground, 1.365 for exposures spared by a shade, 1.364 for exposure saves and stops, 1.363 for fight adjusts,
 *  1.362 for exposures, 1.361 for holds over everything inside, 1.360 for party size conditions and variants for parties above
 *  six, 1.358 for its reach, 1.356 for fight variants, 1.353 for more than 64 flags, 1.351 for held seasons, 1.349 for rest, travel and idle events, party conditions and more
 *  than 128 events, 1.348 for knowledge, 1.347 for companions, 1.345 for music cues, 1.343 for fights, endings and its give, move, fight and
 *  ending actions, 1.342 for clocks, else 0 (any Engine with stories reads it). */
export function storyCapabilityMinor(story: StoryScript): number {
  const acts = story.events.some((event) =>
    event.do.some((action) => "give" in action || "move" in action || "fight" in action || "ending" in action),
  );
  const partyConditions = [
    ...story.events.flatMap((event) => event.if ?? []),
    ...story.directions.flatMap((direction) => direction.if ?? []),
    ...story.knowledge.flatMap((known) => known.if ?? []),
  ].some((condition) => "party" in condition);
  const lists = storyConditionLists(story);
  const fightLists = story.fights.flatMap((fight) => [
    fight.creatures,
    ...(fight.variants ?? []).map((variant) => variant.creatures),
  ]);
  if (fightLists.some((list) => list.some((each) => each.adjust?.calls || each.adjust?.levels))) return 371;
  if (
    story.events.some((event) =>
      event.do.some(
        // A lone word is a name to an older Engine, as it always was, so only a list needs 1.370.
        (action) => "give" in action && typeof action.give.item !== "string",
      ),
    )
  )
    return 370;
  if (story.heldGround.some((held) => held.release)) return 369;
  if (story.events.some((event) => event.do.some((action) => "sheet" in action))) return 368;
  if (story.heldGround.length) return 366;
  if (story.exposures.some((exposure) => exposure.sparedByShade)) return 365;
  if (story.exposures.some((exposure) => exposure.save || exposure.tracks?.some((moved) => moved.upTo !== undefined)))
    return 364;
  if (fightLists.some((list) => list.some((each) => each.adjust))) return 363;
  if (story.exposures.length) return 362;
  if (story.events.some((event) => event.do.some((action) => "season" in action && action.season.over))) return 361;
  if (
    lists.some((list) => storyConditionsFlat(list).some((condition) => "partySize" in condition)) ||
    story.fights.some(
      (fight) =>
        (fight.variants?.length ?? 0) > STORY_PARTY_MAX ||
        fight.variants?.some((variant) => storyPartyRange(variant.party)[1] > STORY_PARTY_MAX),
    )
  )
    return 360;
  if (
    lists.some((list) => list?.some((condition) => "any" in condition)) ||
    story.events.some(
      (event) =>
        event.when.on === "leave" ||
        (event.when.on === "fight" && event.when.fight !== undefined) ||
        event.do.some((action) => action.if !== undefined),
    ) ||
    story.cutscenes.some((cutscene) => cutscene.kind === "pages" && cutscene.pages.some((page) => page.if)) ||
    story.flags.some((flag) => flag.min !== undefined || flag.max !== undefined)
  )
    return 358;
  if (story.fights.some((fight) => fight.variants?.length)) return 356;
  if (story.flags.length > 64) return 353;
  if (story.seasons.length || story.events.some((event) => event.do.some((action) => "season" in action))) return 351;
  if (
    partyConditions ||
    story.events.length > 128 ||
    story.events.some(
      (event) => (STORY_QUIET_TRIGGERS as readonly string[]).includes(event.when.on) || event.priority !== undefined,
    )
  )
    return 349;
  if (story.knowledge.length) return 348;
  if (storyCompanionsNamed(story).length) return 347;
  if (story.events.some((event) => event.do.some((action) => "music" in action))) return 345;
  if (acts || story.fights.length || story.endings.length) return 343;
  return story.flags.some((flag) => flag.clock) ? 342 : 0;
}

/** A clock the player sees (Capability API 1.342): its segments, how many are filled, and whether it is full. */
export interface StoryClock {
  flag: string;
  title: string;
  segments: number;
  filled: number;
  full: boolean;
  /** What happens when it fills. */
  text: string;
}

/** The clocks the player can see: every clock flag, but a hidden one only once the story shows it. */
export function storyClocks(story: StoryScript, state: StoryState): StoryClock[] {
  return story.flags.flatMap((flag) => {
    if (!flag.clock || (flag.clock.hidden && !state.shown.includes(flag.id))) return [];
    const at = Math.floor(Number(state.flags[flag.id]) || 0);
    const filled = Math.max(0, Math.min(flag.clock.segments, at));
    return [
      {
        flag: flag.id,
        title: flag.clock.title,
        segments: flag.clock.segments,
        filled,
        full: filled >= flag.clock.segments,
        text: flag.clock.full,
      },
    ];
  });
}

/** The clocks full in `after` that were not in `before`. */
function clocksFilled(story: StoryScript, before: StoryState["flags"], after: StoryState["flags"]) {
  return story.flags.filter(
    (flag) =>
      flag.clock &&
      (Number(after[flag.id]) || 0) >= flag.clock.segments &&
      !((Number(before[flag.id]) || 0) >= flag.clock.segments),
  );
}

/** Whether every condition holds for these flag values. */
export function storyConditionsHold(
  list: StoryEvent["if"],
  flags: StoryState["flags"],
  /** Who travels with the party, by person id (1.349), and how many it is (1.360); a party condition
   *  holds only when it is known. */
  party?: StoryParty,
): boolean {
  const holds = (condition: Exclude<StoryCondition, { any: unknown }>): boolean => {
    if ("party" in condition) return party !== undefined && party.has(condition.party) === (condition.is === "in");
    const { is, value: wanted } = "partySize" in condition ? condition.partySize : condition;
    const current = "partySize" in condition ? party?.partySize : flags[condition.flag];
    if (current === undefined) return false;
    switch (is) {
      case "=":
        return current === wanted;
      case "!=":
        return current !== wanted;
      case ">":
        return Number(current) > Number(wanted);
      case ">=":
        return Number(current) >= Number(wanted);
      case "<":
        return Number(current) < Number(wanted);
      case "<=":
        return Number(current) <= Number(wanted);
    }
  };
  return (list ?? []).every((condition) => ("any" in condition ? condition.any.some(holds) : holds(condition)));
}

/** Who travels with the party, by person id (1.349), and how many it is when known (1.360). */
export type StoryParty = ReadonlySet<string> & { readonly partySize?: number };

/** The people of the world who travel with the party, by person id: its members' names, matched to the
 *  world's named people (1.349); with how many the party is, when given (1.360). */
export function storyPartyOf(
  game: GameWorld,
  story: StoryScript,
  names: readonly string[] | undefined,
  partySize?: number,
): StoryParty {
  const wanted = new Set((names ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean));
  const ids: Set<string> & { partySize?: number } = new Set<string>();
  if (partySize !== undefined) ids.partySize = partySize;
  if (!wanted.size) return ids;
  const named = new Set<string>();
  for (const list of storyConditionLists(story))
    for (const condition of storyConditionsFlat(list)) if ("party" in condition) named.add(condition.party);
  for (const known of story.knowledge) if (known.person) named.add(known.person);
  for (const personId of named) {
    const person = storyPerson(game, personId);
    if (person?.named && wanted.has(person.name.trim().toLowerCase())) ids.add(personId);
  }
  return ids;
}

/** The story a game keeps (`gameStory`), checked against its world, or null: one that no longer fits
 *  its world is not played at all. */
export function gameStoryFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  game: GameWorld | null,
): StoryScript | null {
  if (!game || !metadata || metadata.gameStory == null) return null;
  const checked = checkStoryScript(game, metadata.gameStory);
  return checked.ok ? checked.story : null;
}

// ── Playing a story (worldgen W10b): one evaluation a turn, before the Game Master's reply ──

/** What a fight ended in, read off the combat recap the player's message carries. */
export function storyFightOutcome(playerMessage: string | null | undefined): StoryFightOutcome | null {
  if (!playerMessage || !/\[combat_result\]/i.test(playerMessage)) return null;
  const outcome = /^OUTCOME:\s*(VICTORY|DEFEAT|FLEE)\b/im.exec(playerMessage)?.[1]?.toLowerCase();
  return (STORY_FIGHT_OUTCOMES as readonly string[]).includes(outcome ?? "") ? (outcome as StoryFightOutcome) : null;
}
export type StoryFightOutcome = (typeof STORY_FIGHT_OUTCOMES)[number];

/** What a fight broke (1.316), read off the combat recap the player's message carries: its labels. */
export function storyFightBroken(playerMessage: string | null | undefined): string[] {
  if (!playerMessage || !/\[combat_result\]/i.test(playerMessage)) return [];
  // Only the Engine's recap says what broke: it is the message's last block, after anything the player wrote.
  const lower = playerMessage.toLowerCase();
  const start = lower.lastIndexOf("[combat_result]");
  const end = lower.indexOf("[/combat_result]", start);
  const recap = playerMessage.slice(start, end < 0 ? undefined : end);
  // Read line by line, not with one regex over the recap: a long run of blanks after "Broken:" must stay cheap.
  const found = recap.split("\n").find((one) => one.slice(0, 7).toLowerCase() === "broken:");
  const line = found?.slice(7) ?? "";
  return line
    .split(";")
    .map((label) => label.trim())
    .filter(Boolean);
}

/** The world as a story turn reads it. */
export interface StoryTurnWorld {
  game: GameWorld;
  /** The Game Master's replies before this one in the whole game (earlier sessions' tags carried in first). */
  replies: readonly string[];
  /** How many there were (a session's carry counts the replies it stands for). */
  repliesBefore: number;
  /** The latest of them with anything in it (at a session's start, the last one of the session before),
   *  whose Game Master story tags are delivered this turn. */
  latest: string | null;
  /** What the walk and the visit this turn tells add to the world's ledger (their tags go before the
   *  reply), so an arrival they bring counts this very turn. */
  told: readonly WorldLedgerEntry[];
  /** The places the story's world has added (the Game Master's new places), so the party can be in one. */
  added?: ReadonlyArray<{ id: string; name: string; parentId: string }>;
  /** The world's day as this reply finds it, the walk's days included. */
  day: number;
  /** What this turn's player message says a fight ended in. */
  fight: StoryFightOutcome | null;
  /** The game's clock, in minutes from its start (1.362), for what being in a place does over time. */
  clock?: number;
  /** Whether any of the party carries a shade lit (1.365), for an exposure `sparedByShade`. */
  shade?: boolean;
  /** What items' uses spent of story numbers in fights (1.359); those not yet recorded are, this turn. */
  spends?: readonly StorySpend[];
  /** What this turn's player message says a fight broke (1.316), by label. */
  broke?: readonly string[];
  /** The player's name, for a page the player speaks. */
  playerName?: string;
  /** The cells this turn's walk went over (a town visit's path, a map walk's path, the end cell included):
   *  a step event on one of them trips. */
  steps?: ReadonlyArray<{ place: string; x: number; y: number }>;
  /** The game's ruleset items by id, for the items the story gives by id (1.343). */
  item?: StoryItemLabel;
  /** Who travels with the party, by name (1.349): its party conditions hold by them. */
  party?: readonly string[];
  /** How many the party is (1.356): its player characters and the companions travelling with it. A
   *  story fight is started in its variant for this size. */
  partySize?: number;
  /** The player's message this turn, read with the latest reply for who and what is in the scene (1.348). */
  player?: string | null;
}

export interface StoryTurn {
  /** The events this turn trips, in order. */
  tripped: string[];
  /** The Engine's own sheet commands this turn (1.362): what the places the party has been in did to it,
   *  applied with the reply's. */
  sheet: string;
  /** Put before the reply: the trips' answered tags, the scenes shown as written, the world deeds. */
  prepend: string;
  /** The scenes shown as written, as the player sees them: told to the Game Master to follow on, and
   *  kept as written by any rewrite. */
  shown: string[];
  /** What the story asks of the Game Master this turn. */
  tells: string[];
  /** Scenes for the Game Master to narrate this turn, each a list of beats. */
  beats: string[][];
  /** The story after this turn's trips: what the Game Master is told of its flags and directions. */
  state: StoryState;
  /** The clocks that filled since the latest reply was written, by it or this turn's trips (1.342). */
  filled: Array<{ flag: string; title: string; text: string }>;
  /** Who of the world travels with the party, by person id (1.349). */
  party: string[];
  /** How many the party is, when known (1.360). */
  partySize?: number;
  /** The season where the party is, and whether the story holds it there (1.351). */
  season: { season: WorldSeason; held: boolean };
  /** What people know that holds and is in the scene this turn (1.348), for the Game Master. */
  knowledge: Array<{ who?: string; text: string }>;
  /** The held ground this turn let go of (1.369), with what letting it go does to a fight still running
   *  on it: the server hands it to the fight director's release. */
  released?: StoryHeldGroundRelease;
  /** The exposures that bit this turn with a save (1.364): the Engine rolls each one for every member of
   *  the party off their sheet, then `storyExposureSaveOutcome` says what the failures cost. */
  saves: StoryExposureSave[];
}

/** What letting held ground go does to a fight still running on it (1.369), its bonus read off the story. */
export interface StoryHeldGroundRelease {
  id: string;
  label?: string;
  felled: "die" | "down";
  owing?: { track?: string; bonus?: number };
}

/** What letting this held ground go does, its bonus read off these flags (1.369). */
function storyHeldGroundRelease(
  gone: StoryScript["heldGround"][number],
  flags: StoryState["flags"],
): StoryHeldGroundRelease {
  const bonus = gone.release?.owing?.bonus;
  const bonusNow = typeof bonus === "object" ? Number(flags[bonus.flag] ?? 0) || 0 : bonus;
  return {
    id: gone.id,
    ...(gone.label ? { label: gone.label } : {}),
    felled: gone.release?.felled ?? "die",
    ...(gone.release?.owing
      ? {
          owing: {
            ...((gone.release.owing.track ?? gone.marks?.[0]?.track)
              ? { track: gone.release.owing.track ?? gone.marks![0]!.track }
              : {}),
            ...(bonusNow !== undefined ? { bonus: bonusNow } : {}),
          },
        }
      : {}),
  };
}

/**
 * Whether what happened in a fight still running lets its held ground go there and then (1.369): the
 * story numbers its items' uses spent (1.359), the props it broke (1.316) and the `flags` events those
 * set off, as the next story turn will record them, read against the held ground's conditions. The
 * release when it no longer holds, else null. The party has not moved, so its place still holds.
 */
export function storyHeldGroundReleaseInFight(
  story: StoryScript,
  ledger: readonly StoryLedgerEntry[],
  fight: { spends?: readonly StorySpend[]; broken?: readonly string[]; party?: StoryParty },
): StoryHeldGroundRelease | null {
  const state = storyState(story, ledger);
  const held = state.held ? story.heldGround.find((each) => each.id === state.held) : undefined;
  if (!held) return null;
  const flags = { ...state.flags };
  storySpendsDue(story, ledger, fight.spends, flags);
  const fired = { ...state.fired };
  const broken = new Set((fight.broken ?? []).map((label) => label.trim().toLowerCase()));
  // A few passes, so a flags event set off by another's numbers is counted, as turns would.
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const event of story.events) {
      if (!event.repeat && (fired[event.id] ?? 0) > 0) continue;
      const when = event.when;
      const happens =
        (when.on === "broke" && broken.has(when.prop.trim().toLowerCase())) || (when.on === "flags" && !event.repeat);
      if (!happens || !storyConditionsHold(event.if, flags, fight.party)) continue;
      fired[event.id] = (fired[event.id] ?? 0) + 1;
      if (applyActions(story, event, flags, fight.party).set.length) moved = true;
    }
    if (!moved) break;
  }
  return storyConditionsHold(held.if, flags, fight.party) ? null : storyHeldGroundRelease(held, flags);
}

/** What Held Ground means, for the Game Master (1.366). */
export function storyHeldGroundText(held: StoryScript["heldGround"][number]): string {
  return `${held.label ?? "Held Ground"}: death is held here. Whoever reaches no health in a fight is felled instead (out of it, stable, never dying), and gets up again later unless reaped${held.condition ? `; the felled are ${held.condition}` : ""}${held.marks?.length ? `; each felled character takes ${held.marks.map((mark) => `${mark.by} ${mark.track}`).join(" and ")}` : ""}. The Engine keeps this in fights.`;
}

/** The held ground a fight is fought on, from what the story recorded (1.366): what the fight director
 *  takes as its `heldGround` (1.323). Null when death is not held where the party is. */
export function storyHeldGroundNow(
  story: StoryScript,
  state: Pick<StoryState, "held">,
): { label?: string; condition?: string; marks?: Array<{ track: string; by: number }> } | null {
  const held = state.held ? story.heldGround.find((each) => each.id === state.held) : undefined;
  if (!held) return null;
  return {
    ...(held.label ? { label: held.label } : {}),
    ...(held.condition ? { condition: held.condition } : {}),
    ...(held.marks ? { marks: held.marks.map((mark) => ({ ...mark })) } : {}),
  };
}

/** One exposure's bites this turn, owed a save by each of the party (1.364). */
export interface StoryExposureSave {
  exposure: string;
  /** What it is called in a tell. */
  label: string;
  /** How many times it bit since the last reply: a save for each. */
  times: number;
  hours: number;
  save: string;
  difficulty: number;
  against?: { conditions?: string[]; damage?: string[] };
  tracks: Array<{ track: string; by: number; upTo?: number }>;
  applies: string[];
  tell?: string;
}

/** What one member's saves came to: how many of `times` they failed, and the totals they rolled. */
export interface StoryExposureSaveRoll {
  who: string;
  failed: number;
  totals: number[];
}

const sheetValue = (value: string) => value.replace(/["[\]]/g, "");

/** What an exposure's saves cost the party (1.364): for each member who failed any, their tracks moved by
 *  each failure (stopped where `upTo` says) and its conditions put on; and the tell for the Game Master. */
export function storyExposureSaveOutcome(
  bite: StoryExposureSave,
  rolls: readonly StoryExposureSaveRoll[],
): { sheet: string[]; tell: string } {
  const sheet: string[] = [];
  for (const roll of rolls) {
    if (roll.failed <= 0) continue;
    const who = sheetValue(roll.who);
    for (const moved of bite.tracks)
      sheet.push(
        `[sheet: who="${who}" op="track" track="${sheetValue(moved.track)}" by="${moved.by * roll.failed}"${moved.upTo !== undefined ? ` upto="${moved.upTo}"` : ""}]`,
      );
    for (const condition of bite.applies)
      sheet.push(`[sheet: who="${who}" op="condition" condition="${sheetValue(condition)}" state="on"]`);
  }
  const each = rolls.map(
    (roll) =>
      `${roll.who} ${roll.failed === 0 ? "saved" : roll.failed === roll.totals.length ? "failed" : `failed ${roll.failed} of ${roll.totals.length}`} (${roll.totals.join(", ")})`,
  );
  const tell = `${bite.label} has told on the party: ${bite.times === 1 ? "once" : `${bite.times} times`} more since the last reply (every ${bite.hours} hour${bite.hours === 1 ? "" : "s"} there), and the Engine rolled each one's ${bite.save} save against ${bite.difficulty}${bite.times === 1 ? "" : " each time"}: ${each.length ? each.join("; ") : "nobody had a sheet to roll on"}. ${sheet.length ? "Those who failed have it marked on their sheets." : "Nobody failed."}${bite.tell ? ` ${bite.tell}` : ""}`;
  return { sheet, tell };
}

const STORY_TRIPS_A_TURN = 32;
const recordValue = (value: boolean | number) => String(value);

/** The tag a trip is recorded in: what it set and showed, so the fold never replays the script. */
function storyRecord(
  entry: {
    event?: string;
    flag?: string;
    set: Array<[string, boolean | number]>;
    show: string[];
    fight?: string;
    ending?: string;
    music?: string | null;
    seasons?: Array<[string, WorldSeason | null]>;
    acts?: number[];
    spend?: string;
    exposure?: { id: string; since: number | null; bitten: number };
    held?: string | null;
  },
  by?: "engine",
) {
  const parts = [
    ...(entry.event ? [`event="${entry.event}"`] : []),
    ...(entry.held !== undefined ? [`held="${entry.held ?? ""}"`] : []),
    ...(entry.exposure
      ? [`exposure="${entry.exposure.id}" since="${entry.exposure.since ?? ""}" bitten="${entry.exposure.bitten}"`]
      : []),
    ...(entry.spend ? [`spend="${entry.spend}"`] : []),
    ...(entry.flag ? [`flag="${entry.flag}"`] : []),
    ...(entry.fight ? [`fight="${entry.fight}"`] : []),
    ...(entry.ending ? [`ending="${entry.ending}"`] : []),
    ...(entry.music !== undefined ? [`music="${entry.music ?? ""}"`] : []),
    ...(entry.seasons?.length
      ? [`seasons="${entry.seasons.map(([place, season]) => `${place}=${season ?? ""}`).join(";")}"`]
      : []),
    ...(entry.set.length
      ? [`set="${entry.set.map(([flag, value]) => `${flag}=${recordValue(value)}`).join(";")}"`]
      : []),
    ...(entry.show.length ? [`show="${entry.show.join(";")}"`] : []),
    ...(entry.acts ? [`acts="${entry.acts.join(";")}"`] : []),
    ...(by ? [`by="${by}"`] : []),
    `result="ok"`,
  ];
  return `[story: ${parts.join(" ")}]`;
}

/** An event's flag changes and reveals against these flag values (applied to them). A sum that is no
 *  longer a number a record can hold is left as it was; a number is kept within its flag's bounds (1.358).
 *  An action with conditions is done only when they hold as the event reaches it, its earlier actions
 *  done (1.358): which were done is recorded, and `done` is the event with only them. */
function applyActions(story: StoryScript, event: StoryEvent, flags: StoryState["flags"], party?: StoryParty) {
  const declared = new Map(story.flags.map((flag) => [flag.id, flag]));
  const set: Array<[string, boolean | number]> = [];
  const show: string[] = [];
  let fight: string | undefined;
  let ending: string | undefined;
  let music: string | null | undefined;
  const seasons: Array<[string, WorldSeason | null]> = [];
  const branches = event.do.some((action) => action.if !== undefined);
  const acts: number[] = [];
  for (const [index, action] of event.do.entries()) {
    if (action.if && !storyConditionsHold(action.if, flags, party)) continue;
    acts.push(index);
    if ("music" in action) music = action.music;
    if ("season" in action)
      seasons.push([`${action.season.place ?? "*"}${action.season.over ? STORY_SEASON_OVER : ""}`, action.season.to]);
    if ("fight" in action) fight ??= action.fight;
    if ("ending" in action) ending ??= action.ending;
    if ("set" in action) {
      const flag = declared.get(action.set);
      const value = typeof action.value === "number" ? storyBounded(flag, action.value) : action.value;
      flags[action.set] = value;
      set.push([action.set, value]);
    } else if ("add" in action && declared.get(action.add)?.kind === "number") {
      const next = storyBounded(declared.get(action.add), Number(flags[action.add] ?? 0) + action.amount);
      if (!Number.isFinite(next)) continue;
      flags[action.add] = next;
      set.push([action.add, next]);
    } else if ("show" in action) {
      show.push(action.show);
    }
  }
  return {
    set,
    show,
    done: branches ? { ...event, do: acts.map((index) => event.do[index]!) } : event,
    ...(branches ? { acts } : {}),
    ...(fight ? { fight } : {}),
    ...(ending ? { ending } : {}),
    ...(music !== undefined ? { music } : {}),
    ...(seasons.length ? { seasons } : {}),
  };
}

/** The label of a ruleset item by its id, while the game's ruleset offers it (1.343). */
export type StoryItemLabel = (ref: string) => string | undefined;

/** An item the story gives, as an inventory tag for the reply's inventory to answer like the Game
 *  Master's; or why it cannot be given: an id the game's ruleset does not offer. */
function storyGiveTag(give: Extract<StoryAction, { give: unknown }>["give"], label: StoryItemLabel | undefined) {
  const items = storyGiveItems(give);
  // The first the ruleset offers (1.370): an id, or a bare entry id in whichever catalog has it; else the
  // first by name. A lone bare id the ruleset has not is a name, as it always was.
  const found = items.find((each) => (storyIsRef(each) || storyIsBareEntry(each)) && label?.(each));
  const byName =
    items.find((each) => !storyIsRef(each) && !storyIsBareEntry(each)) ?? items.find((each) => !storyIsRef(each));
  const named = found ? label!(found) : byName?.trim();
  if (!named) return { refused: items.join("|"), tag: undefined };
  const clean = (text: string) => text.replace(/["[\]]/g, "");
  const parts = [
    `action="add"`,
    `item="${clean(named)}"`,
    `count="${give.count ?? 1}"`,
    ...(give.who ? [`who="${clean(give.who)}"`] : []),
    ...(give.summary && !found ? [`summary="${clean(give.summary)}"`] : []),
    // The Experience's own gift: an item only a checked source may add is still given by it.
    `source="story"`,
  ];
  return { tag: `[inventory: ${parts.join(" ")}]`, refused: undefined };
}

/** What an event's give, move and fight actions put in the reply, as tags its own pipeline answers. */
function storyActionTags(
  game: GameWorld,
  event: StoryEvent,
  label: StoryItemLabel | undefined,
): { tags: string[]; refusedItems: string[] } {
  const tags: string[] = [];
  const refusedItems: string[] = [];
  for (const action of event.do) {
    if ("give" in action) {
      const given = storyGiveTag(action.give, label);
      if (given.tag) tags.push(given.tag);
      else if (given.refused) refusedItems.push(given.refused);
    } else if ("move" in action) {
      const place = game.world.places.find((each) => each.id === action.move);
      if (place) tags.push(`[place: name="${place.name.replace(/["[\]]/g, "")}"]`);
    } else if ("fight" in action) {
      tags.push("[state: combat]");
    } else if ("recruit" in action || "dismiss" in action) {
      // The party's own tag, answered as the Game Master's is: the Experience's companion joins with its sheet.
      const person = storyPerson(game, "recruit" in action ? action.recruit : action.dismiss);
      if (person?.named) {
        const change = "recruit" in action ? "add" : "remove";
        tags.push(`[party_change: character="${person.name.replace(/["[\]]/g, "")}" change="${change}"]`);
      }
    }
  }
  return { tags, refusedItems };
}

/** A story fight's opponents, one by one (1.343): each creature as many times as it counts, called by its
 *  own name in the fight (numbered when there are several), `creature` the bestiary's name for it (`label`
 *  reads an id; a creature by name is its own). An id the bestiary doesn't have is refused, never made
 *  up: its opponents are left out and the id is listed in `refused`, for the caller to report. */
export function storyFightRoster(
  fight: StoryFight,
  label: (creature: string) => string | undefined = () => undefined,
): { opponents: StoryFightOpponent[]; refused: string[] } {
  const refused = new Set<string>();
  const opponents = fight.creatures.flatMap((each) => {
    const creature = storyIsRef(each.creature) ? label(each.creature) : each.creature;
    if (creature === undefined) {
      refused.add(each.creature);
      return [];
    }
    const base = each.name ?? creature;
    return Array.from({ length: each.count }, (_, index) => ({
      name: each.count > 1 ? `${base} ${index + 1}` : base,
      creature,
      ...(each.adjust ? { adjust: structuredClone(each.adjust) } : {}),
    }));
  });
  return { opponents, refused: [...refused] };
}

/** One opponent of a story fight, as its roster names it (1.343), with how the fight adjusts it (1.363). */
export interface StoryFightOpponent {
  name: string;
  creature: string;
  adjust?: StoryFightAdjust;
}

/** What a story fight changes of a creature (1.363, 1.371), with what it changes from a party level up. */
export interface StoryFightAdjustAt {
  legendaryResistance?: number;
  maxHp?: number;
  calls?: Array<{ action: string; creature: string }>;
}
export interface StoryFightAdjust extends StoryFightAdjustAt {
  levels?: Array<StoryFightAdjustAt & { from: number }>;
}

/** A creature's adjust for a party this high (1.371): each level reached laid over the last, a call to
 *  the same action replaced. A party level not known reads the creature's own adjust alone. */
export function storyFightAdjustAt(
  adjust: StoryFightAdjust,
  partyLevel: number | null | undefined,
): StoryFightAdjustAt {
  const at: StoryFightAdjustAt = {
    ...(adjust.legendaryResistance !== undefined ? { legendaryResistance: adjust.legendaryResistance } : {}),
    ...(adjust.maxHp !== undefined ? { maxHp: adjust.maxHp } : {}),
    ...(adjust.calls ? { calls: adjust.calls.map((call) => ({ ...call })) } : {}),
  };
  for (const level of adjust.levels ?? []) {
    if (!partyLevel || partyLevel < level.from) break;
    if (level.legendaryResistance !== undefined) at.legendaryResistance = level.legendaryResistance;
    if (level.maxHp !== undefined) at.maxHp = level.maxHp;
    for (const call of level.calls ?? []) {
      const same = (each: { action: string }) => each.action.trim().toLowerCase() === call.action.trim().toLowerCase();
      at.calls = [...(at.calls ?? []).filter((each) => !same(each)), { ...call }];
    }
  }
  return at;
}

/** How a story fight adjusts an opponent, for the Game Master (1.363): "Legendary Resistance 1, 40 HP". */
export function storyFightAdjustText(adjust: StoryFightAdjust | undefined): string {
  if (!adjust) return "";
  const said = (at: StoryFightAdjustAt) =>
    [
      ...(at.legendaryResistance !== undefined ? [`Legendary Resistance ${at.legendaryResistance}`] : []),
      ...(at.maxHp !== undefined ? [`${at.maxHp} HP`] : []),
      ...(at.calls ?? []).map((call) => `${call.action} calls ${call.creature}`),
    ].join(", ");
  return [said(adjust), ...(adjust.levels ?? []).map((level) => `from party level ${level.from}: ${said(level)}`)]
    .filter(Boolean)
    .join("; ");
}

/** The sizes a variant is for, lowest and highest (an open range's highest is any). */
function storyPartyRange(party: number | { min: number; max?: number }): [number, number] {
  return typeof party === "number" ? [party, party] : [party.min, party.max ?? Number.POSITIVE_INFINITY];
}

/** The fight as a party this size fights it (1.356): its variant for the size, else itself. */
export function storyFightForParty(fight: StoryFight, size: number | null | undefined): StoryFight {
  if (!size || !fight.variants?.length) return fight;
  const variant = fight.variants.find((each) => {
    const [min, max] = storyPartyRange(each.party);
    return size >= min && size <= max;
  });
  if (!variant) return fight;
  return {
    ...fight,
    creatures: variant.creatures,
    ...(variant.battlefield ? { battlefield: variant.battlefield } : {}),
    ...(variant.note ? { note: variant.note } : {}),
    forParty: size,
  };
}

/** An ending as the player is shown it (1.343). */
export function storyEndingOf(
  story: StoryScript,
  id: string,
): { id: string; title: string; epilogue: string } | undefined {
  const ending = story.endings.find((each) => each.id === id);
  return ending ? { id: ending.id, title: ending.title, epilogue: ending.epilogue } : undefined;
}

/** The script's fight a reply started (1.343): the latest one its story tags recorded. */
export function storyFightIn(story: StoryScript, reply: string | null | undefined): StoryFight | null {
  if (!reply) return null;
  const id = readStoryLedger([reply])
    .flatMap((entry) => (entry.fight ? [entry.fight] : []))
    .at(-1);
  return story.fights.find((fight) => fight.id === id) ?? null;
}

/** A matcher for a person's full name, whole words only. */
function fullName(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

/** A scene shown as written, in the narration's own grammar: narration lines as they are, a person's
 *  words as their line with their expression. Names are the world's, never the script's, and keep no
 *  brackets. */
function storyPages(
  game: GameWorld,
  cutscene: Extract<StoryCutscene, { kind: "pages" }>,
  playerName: string | undefined,
  /** The flags and who travels with the party as it is shown: a page with conditions only while they
   *  hold (1.358). */
  flags: StoryState["flags"],
  party: StoryParty,
): string {
  const lines = cutscene.background ? [`[bg: ${cutscene.background}]`] : [];
  for (const page of cutscene.pages) {
    if (page.if && !storyConditionsHold(page.if, flags, party)) continue;
    const speaker =
      page.speaker === STORY_PLAYER
        ? playerName?.trim()
        : page.speaker
          ? storyPerson(game, page.speaker)?.name
          : undefined;
    const name = speaker?.replace(/[[\]":]/g, "").trim();
    if (!name) {
      lines.push(page.text);
      continue;
    }
    lines.push(`[${name}] [main] [${page.expression ?? "neutral"}]: "${page.text.replace(/"/g, "'")}"`);
  }
  return lines.join("\n\n");
}

/** A world deed an event does, as a world tag for the world's ledger to answer like the Game Master's. */
function storyWorldTag(game: GameWorld, deed: Extract<StoryAction, { world: unknown }>["world"]): string {
  const place = deed.place ? game.world.places.find((each) => each.id === deed.place)?.name : undefined;
  const parts = [
    `deed="${deed.deed}"`,
    ...(deed.group ? [`group="${deed.group}"`] : []),
    ...(deed.with ? [`with="${deed.with}"`] : []),
    ...(place ? [`place="${place.replace(/["[\]]/g, "")}"`] : []),
    ...(deed.who ? [`who="${deed.who}"`] : []),
  ];
  return `[world: ${parts.join(" ")}]`;
}

/** What an item's use spent of a story number in a fight (Capability API 1.359): kept with the game until
 *  a turn records it, by its id, so it is recorded once whatever is regenerated. */
export interface StorySpend {
  id: string;
  flag: string;
  add: number;
  /** What was used, for the Game Master. */
  label?: string;
}

/** The spends these replies have not recorded yet, each as the record it is written as, applied to the
 *  flags in order (each kept within its flag's bounds). */
export function storySpendsDue(
  story: StoryScript,
  ledger: readonly StoryLedgerEntry[],
  spends: readonly StorySpend[] | undefined,
  flags: StoryState["flags"],
): Array<{ spend: StorySpend; record: string; entry: StoryLedgerEntry }> {
  const recorded = new Set(ledger.flatMap((entry) => (entry.spend ? [entry.spend] : [])));
  const declared = new Map(story.flags.map((flag) => [flag.id, flag]));
  const due: Array<{ spend: StorySpend; record: string; entry: StoryLedgerEntry }> = [];
  for (const spend of spends ?? []) {
    const flag = declared.get(spend.flag);
    if (recorded.has(spend.id) || flag?.kind !== "number") continue;
    recorded.add(spend.id);
    const next = storyBounded(flag, Number(flags[spend.flag] ?? 0) + spend.add);
    if (!Number.isFinite(next)) continue;
    flags[spend.flag] = next;
    const entry: StoryLedgerEntry = { set: [[spend.flag, next]], show: [], spend: spend.id, by: "engine" };
    due.push({ spend, entry, record: storyRecord({ flag: spend.flag, ...entry }, "engine") });
  }
  return due;
}

/** The bodies of the `[sheet: ...]` tags in a reply, read in one pass: a regex here backtracks on unclosed tags. */
function sheetTagBodies(text: string): string[] {
  const opening = /\[sheet:/gi;
  const bodies: string[] = [];
  for (let found = opening.exec(text); found; found = opening.exec(text)) {
    const end = text.indexOf("]", opening.lastIndex);
    // No later tag can close either.
    if (end < 0) break;
    bodies.push(text.slice(opening.lastIndex, end));
    opening.lastIndex = end + 1;
  }
  return bodies;
}

/**
 * This turn of a story: what the Game Master tripped in the latest reply is delivered (its scenes and
 * what it asks), then the events the Engine sees happen trip, in the script's order, each once unless
 * it repeats, at most once a turn, 32 at most. The replies are read in order, so the story knows where
 * the party is and when it came in, when each event last happened, and what the latest reply named and
 * did. Deterministic: a regeneration of the same reply finds the same turn.
 */
export function storyTurn(story: StoryScript, world: StoryTurnWorld): StoryTurn {
  const { game } = world;
  const events = new Map(story.events.map((event) => [event.id, event]));
  const cutscenes = new Map(story.cutscenes.map((cutscene) => [cutscene.id, cutscene]));

  // Where places are: the world's (by any name they went by) and the ones the story added.
  const parents = new Map<string, string | null | undefined>(
    game.world.places.map((place) => [place.id, place.parentId]),
  );
  for (const added of world.added ?? []) parents.set(added.id, added.parentId);
  const placeOf = (name: string): string | null =>
    worldPlaceNamed(game.world.places, name)?.id ??
    world.added?.find((place) => place.name.trim().toLowerCase() === name.trim().toLowerCase())?.id ??
    null;
  const inside = (placeId: string | null, target: string) => {
    for (let at = placeId ?? undefined, hops = 0; at && hops < 64; hops++) {
      if (at === target) return true;
      at = parents.get(at) ?? undefined;
    }
    return false;
  };

  // The replies in order, then this turn's walk and visit: where the party was, and when it came into
  // each place an event waits for; when each event last happened; whether a repeating flags event's
  // conditions have been false since.
  const party = storyPartyOf(game, story, world.party, world.partySize);
  const targets = new Set(story.events.flatMap((event) => (event.when.on === "arrive" ? [event.when.place] : [])));
  const rising = story.events.filter((event) => event.repeat && event.when.on === "flags");
  let at: string | null = game.world.startId ?? null;
  const cameIn = new Map<string, number>();
  for (const target of targets) if (inside(at, target)) cameIn.set(target, -1);
  // When the party last left each place a leave event waits for (1.358).
  const exits = new Set(story.events.flatMap((event) => (event.when.on === "leave" ? [event.when.place] : [])));
  const wentOut = new Map<string, number>();
  const goTo = (next: string | null, index: number) => {
    for (const target of targets) if (inside(next, target) && !inside(at, target)) cameIn.set(target, index);
    for (const place of exits) if (inside(at, place) && !inside(next, place)) wentOut.set(place, index);
    at = next;
  };
  const lastHappened = new Map<string, number>();
  const ledger: StoryLedgerEntry[] = [];
  let flagsSoFar = storyState(story, []).flags;
  const risen = new Map(rising.map((event) => [event.id, !storyConditionsHold(event.if, flagsSoFar, party)]));
  // Where this turn's walk set out from and came to (1.349).
  let setOutFrom: string | null = null;
  // The flags as they stood before the Game Master's own tags in the latest reply, so a clock they or this
  // turn's trips fill is told once.
  let flagsBeforeLatest = flagsSoFar;
  const segments = [
    ...world.replies.map((reply) => ({ world: readWorldLedger([reply]), reply })),
    { world: world.told, reply: "" },
  ];
  segments.forEach((segment, index) => {
    if (world.latest !== null && index < world.replies.length && segment.reply === world.latest) {
      // Its Engine trips were told in the turn they happened; only the Game Master's own are news.
      const engine = readStoryLedger([segment.reply]).filter((entry) => entry.by === "engine");
      flagsBeforeLatest = storyState(story, [...ledger, ...engine]).flags;
    }
    if (index === world.replies.length) setOutFrom = at;
    for (const entry of segment.world) {
      if (entry.at === undefined) continue;
      goTo(placeOf(entry.at), index);
    }
    const entries = readStoryLedger([segment.reply]);
    if (!entries.length) return;
    ledger.push(...entries);
    for (const entry of entries) if (entry.event) lastHappened.set(entry.event, index);
    flagsSoFar = storyState(story, ledger).flags;
    for (const event of rising) {
      if (entries.some((entry) => entry.event === event.id)) risen.set(event.id, false);
      if (!storyConditionsHold(event.if, flagsSoFar, party)) risen.set(event.id, true);
    }
  });

  // What items' uses spent in fights since (1.359), recorded first, so this turn's events read it.
  const spent = storySpendsDue(story, ledger, world.spends, { ...storyState(story, ledger).flags });
  ledger.push(...spent.map((each) => each.entry));
  const state = storyState(story, ledger);
  const flags = { ...state.flags };
  const fired = { ...state.fired };
  const shownFlags = new Set(state.shown);
  const prepend: string[] = [];
  const shown: string[] = [];
  const tells: string[] = [];
  const beats: string[][] = [];
  const tripped: string[] = [];
  prepend.push(...spent.map((each) => each.record));
  for (const { spend, entry } of spent) {
    const flag = story.flags.find((each) => each.id === spend.flag);
    const name = flag?.clock?.title ?? flag?.quest?.title ?? spend.flag;
    tells.push(
      `${spend.label ? `Using ${spend.label}` : "An item's use"} ${spend.add < 0 ? "cost the party" : "gave the party"} ${Math.abs(spend.add)} of ${name}; it is ${entry.set[0]![1]} now.`,
    );
  }
  // What being where the party is has done to it since it came (1.362), on the game's clock.
  const sheet: string[] = [];
  const saves: StoryExposureSave[] = [];
  if (world.clock !== undefined && story.exposures.length) {
    const running = { ...(state.exposures ?? {}) };
    for (const exposure of story.exposures) {
      const now = running[exposure.id];
      const there =
        inside(at, exposure.place) &&
        storyConditionsHold(exposure.if, flags, party) &&
        !(exposure.sparedByShade && world.shade);
      let record: { id: string; since: number | null; bitten: number } | null = null;
      if (there && !now) record = { id: exposure.id, since: world.clock, bitten: 0 };
      else if (!there && now) record = { id: exposure.id, since: null, bitten: 0 };
      else if (there && now) {
        const due = Math.floor(Math.max(0, world.clock - now.since) / (exposure.hours * 60)) - now.bitten;
        if (due > 0) {
          record = { id: exposure.id, since: now.since, bitten: now.bitten + due };
          const place = game.world.places.find((each) => each.id === exposure.place)?.name ?? exposure.place;
          if (exposure.save) {
            // A save is rolled off each member's own sheet, which only the Engine's sheet pass has.
            saves.push({
              exposure: exposure.id,
              label: exposure.label ?? `Being in ${place}`,
              times: due,
              hours: exposure.hours,
              save: exposure.save.save,
              difficulty: exposure.save.difficulty,
              ...(exposure.save.against ? { against: exposure.save.against } : {}),
              tracks: exposure.tracks ?? [],
              applies: exposure.applies ?? [],
              ...(exposure.tell ? { tell: exposure.tell } : {}),
            });
          } else {
            for (const moved of exposure.tracks ?? [])
              sheet.push(
                `[sheet: who="party" op="track" track="${moved.track}" by="${moved.by * due}"${moved.upTo !== undefined ? ` upto="${moved.upTo}"` : ""}]`,
              );
            for (const condition of exposure.applies ?? [])
              sheet.push(`[sheet: who="party" op="condition" condition="${condition}" state="on"]`);
            tells.push(
              `${exposure.label ?? `Being in ${place}`} has told on the party: ${due === 1 ? "once" : `${due} times`} more since the last reply (every ${exposure.hours} hour${exposure.hours === 1 ? "" : "s"} there), and the Engine has marked it on each of their sheets.${exposure.tell ? ` ${exposure.tell}` : ""}`,
            );
          }
        }
      }
      if (!record) continue;
      ledger.push({ exposure: record, by: "engine", set: [], show: [] });
      prepend.push(storyRecord({ exposure: record, set: [], show: [] }, "engine"));
    }
  }
  // Whether death is held where the party is (1.366), recorded as it comes and goes.
  let released: StoryHeldGroundRelease | undefined;
  if (story.heldGround.length) {
    const holding =
      story.heldGround.find(
        (each) => (each.place === undefined || inside(at, each.place)) && storyConditionsHold(each.if, flags, party),
      ) ?? null;
    const was = storyState(story, ledger).held ?? null;
    if ((holding?.id ?? null) !== was) {
      const gone = was ? story.heldGround.find((each) => each.id === was) : undefined;
      if (gone) released = storyHeldGroundRelease(gone, flags);
      ledger.push({ held: holding?.id ?? null, by: "engine", set: [], show: [] });
      prepend.push(storyRecord({ held: holding?.id ?? null, set: [], show: [] }, "engine"));
      const before = was ? story.heldGround.find((each) => each.id === was) : undefined;
      tells.push(
        holding
          ? `${storyHeldGroundText(holding)}${holding.tell ? ` ${holding.tell}` : ""}`
          : `${before?.label ?? "Held Ground"} no longer holds here: death is death again.`,
      );
    }
  }
  // The recap of a story fight fought in its variant for the party's size names the variant (1.356).
  if (world.fight) {
    const ended = storyFightIn(story, world.latest);
    const as = ended ? storyFightForParty(ended, world.partySize) : null;
    if (as?.forParty) {
      tells.push(
        `The fight that just ended was the story's "${as.name}", as set for a party of ${as.forParty}: ${as.creatures.map((each) => `${each.count} ${each.name ?? each.creature}`).join(", ")}.`,
      );
    }
  }

  /** An event's scenes, asks and deeds: by the Engine this turn, or as the Game Master marked it last
   *  reply, whose deeds went with its tag and whose beats it was told to narrate as it marked it. */
  const fights = new Map(story.fights.map((fight) => [fight.id, fight]));
  const endings = new Map(story.endings.map((ending) => [ending.id, ending]));
  const showScene = (id: string, byEngine: boolean) => {
    const cutscene = cutscenes.get(id);
    if (cutscene?.kind === "pages") {
      const pages = storyPages(game, cutscene, world.playerName, flags, party);
      // A scene all of whose pages are held back by their conditions shows nothing.
      if (pages.replace(/^\[bg: [^\]]*\]/u, "").trim()) {
        prepend.push(pages);
        shown.push(pages);
      }
    } else if (cutscene?.kind === "beats" && byEngine) beats.push([...cutscene.beats]);
  };
  const deliver = (event: StoryEvent, byEngine: boolean) => {
    if (byEngine) {
      const { tags, refusedItems } = storyActionTags(game, event, world.item);
      prepend.push(...tags);
      for (const item of refusedItems) {
        prepend.push(`[story: event="${event.id}" give="${item}" result="refused" reason="unknown-item"]`);
      }
    }
    for (const action of event.do) {
      if ("move" in action && byEngine) {
        // Where the party is from here on this turn, so an arrival the move brings trips now.
        goTo(action.move, now);
        const place = game.world.places.find((each) => each.id === action.move);
        if (place) tells.push(`The story has taken the party to ${place.name}. Tell how they come to be there.`);
      } else if ("fight" in action && byEngine) {
        // A fight the Game Master's own trip started is in its reply already (`[state: combat]`), and
        // fought by the time its trip is delivered: it is not told as starting again.
        const set = fights.get(action.fight);
        const fight = set ? storyFightForParty(set, world.partySize) : undefined;
        if (fight) {
          tells.push(
            `The story starts the fight "${fight.name}"${fight.forParty ? ` (as set for a party of ${fight.forParty})` : ""} now${fight.note ? ` (${fight.note})` : ""}. Lead straight into it; the Engine starts it with its own opponents: ${fight.creatures.map((each) => `${each.count} ${each.name ?? each.creature}`).join(", ")}.`,
          );
        }
      } else if (("recruit" in action || "dismiss" in action) && byEngine) {
        const person = storyPerson(game, "recruit" in action ? action.recruit : action.dismiss);
        if (person?.named) {
          tells.push(
            "recruit" in action
              ? `${person.name} joins the party now. Tell how they come to travel with it.`
              : `${person.name} leaves the party now. Tell how they part ways.`,
          );
        }
      } else if ("ending" in action) {
        const ending = endings.get(action.ending);
        if (ending) {
          if (ending.cutscene) showScene(ending.cutscene, byEngine);
          tells.push(
            `The story ends here with "${ending.title}". This is the game's last reply: close it with this epilogue, in your own words: ${ending.epilogue}`,
          );
        }
      }
    }
    for (const action of event.do) {
      // On the reply this turn writes, by the Engine or a turn after the Game Master marked it (1.368).
      if ("sheet" in action) sheet.push(storySheetTag(action.sheet));
    }
    for (const action of event.do) {
      if ("tell" in action) tells.push(action.tell);
      else if ("cutscene" in action) showScene(action.cutscene, byEngine);
      else if ("world" in action && byEngine) prepend.push(storyWorldTag(game, action.world));
    }
  };

  // What the Game Master tripped last reply: its scenes and asks arrive now (its deeds went with it).
  for (const entry of world.latest ? readStoryLedger([world.latest]) : []) {
    const event = entry.event ? events.get(entry.event) : undefined;
    // Only the actions its trip did, when some have conditions (1.358).
    const acts = entry.acts;
    if (event && entry.by !== "engine")
      deliver(acts ? { ...event, do: event.do.filter((_, index) => acts.includes(index)) } : event, false);
  }

  // What the latest reply named and did, for the events that happen again each time.
  const latestDeeds = world.latest ? readWorldLedger([world.latest]) : [];
  const deedMatches = (entry: WorldLedgerEntry, deed: string | undefined, placeId: string | undefined) =>
    entry.deed !== undefined &&
    (!deed || entry.deed === deed) &&
    (!placeId || (entry.place !== undefined && placeOf(entry.place) === placeId));
  const named = (personId: string, texts: readonly string[]) => {
    const person = storyPerson(game, personId);
    if (!person?.named) return false;
    const matcher = fullName(person.name);
    return texts.some((text) => matcher.test(text));
  };

  const turnNumber = world.repliesBefore + 1;
  const now = segments.length - 1;
  // A rest the Game Master's sheet tags took last reply (1.349), of this rest or any.
  const restedLast = (rest: string | undefined) =>
    sheetTagBodies(world.latest ?? "").some((body) => {
      if (!/\bop="rest"/i.test(body) || !/\bresult="ok"/i.test(body)) return false;
      const took = /\brest="([^"]*)"/i.exec(body)?.[1]?.trim().toLowerCase();
      return !rest || took === rest.trim().toLowerCase();
    });
  // How many replies in a row, up to the latest, nothing has happened in: no story event, walk or fight.
  let quietFor = 0;
  for (let index = world.replies.length - 1; index >= 0; index--) {
    const reply = world.replies[index]!;
    if (
      readStoryLedger([reply]).length ||
      readWorldLedger([reply]).some((entry) => entry.at !== undefined) ||
      /\[state:\s*combat\]/i.test(reply)
    )
      break;
    quietFor++;
  }
  const matches = (event: StoryEvent): boolean => {
    const times = fired[event.id] ?? 0;
    const when = event.when;
    switch (when.on) {
      case "start":
        return world.repliesBefore === 0 && times === 0;
      case "turn":
        return turnNumber >= when.turn && times === 0;
      case "day":
        return world.day >= when.day && times === 0;
      case "arrive":
        // The party is there now; again only once it has come in since it last happened.
        return (
          inside(at, when.place) &&
          (times === 0 ||
            (event.repeat === true && (cameIn.get(when.place) ?? -2) > (lastHappened.get(event.id) ?? now)))
        );
      case "meet":
        return times === 0
          ? named(when.person, world.replies)
          : event.repeat === true && named(when.person, world.latest ? [world.latest] : []);
      case "deed":
        return times === 0
          ? world.replies.some((reply) =>
              readWorldLedger([reply]).some((entry) => deedMatches(entry, when.deed, when.place)),
            )
          : event.repeat === true && latestDeeds.some((entry) => deedMatches(entry, when.deed, when.place));
      case "fight":
        // With a fight named (1.358), only when the fight that ended is that one: the one the latest reply
        // started.
        return (
          world.fight === when.outcome &&
          (event.repeat || times === 0) &&
          (!when.fight || storyFightIn(story, world.latest)?.id === when.fight)
        );
      case "leave":
        // Left in the latest reply or this turn (a walk, or the story's own move), and not back in since.
        return (
          (times === 0 || event.repeat === true) &&
          !inside(at, when.place) &&
          (wentOut.get(when.place) ?? -2) >= world.replies.length - 1
        );
      case "broke":
        return (
          (world.broke ?? []).some((label) => label.trim().toLowerCase() === when.prop.trim().toLowerCase()) &&
          (event.repeat === true || times === 0)
        );
      case "flags":
        return times === 0 || (event.repeat === true && risen.get(event.id) === true);
      case "gm":
        return false;
      case "rest":
        return (times === 0 || event.repeat === true) && restedLast(when.rest);
      case "travel":
        return (
          (times === 0 || event.repeat === true) &&
          setOutFrom !== null &&
          at !== null &&
          setOutFrom !== at &&
          (!when.from || inside(setOutFrom, when.from)) &&
          (!when.to || inside(at, when.to))
        );
      case "idle":
        return (
          (times === 0 || event.repeat === true) &&
          quietFor >= when.turns &&
          world.told.every((entry) => entry.at === undefined)
        );
      case "step":
        // Walked onto this turn: once, or each turn the walk goes over it when it repeats.
        return (
          (times === 0 || event.repeat === true) &&
          (world.steps ?? []).some((step) => step.place === when.place && step.x === when.x && step.y === when.y)
        );
    }
  };

  const thisTurn = new Set<string>();
  const held: Record<string, WorldSeason> = { ...(state.seasons ?? {}) };
  // A game that has had its ending trips nothing more.
  let ended = state.ended;
  // A rest, a trip or a quiet spell sets off one scene a turn at most: the highest priority's (1.349).
  const quiet = (event: StoryEvent) => (STORY_QUIET_TRIGGERS as readonly string[]).includes(event.when.on);
  let quietTripped = false;
  const ready = (event: StoryEvent) =>
    !thisTurn.has(event.id) &&
    !(quietTripped && quiet(event)) &&
    storyConditionsHold(event.if, flags, party) &&
    matches(event);
  for (let pass = 0; !ended && pass < STORY_TRIPS_A_TURN && tripped.length < STORY_TRIPS_A_TURN; pass++) {
    let next = story.events.find(ready);
    if (next && quiet(next)) {
      next = story.events
        .filter((event) => quiet(event) && ready(event))
        .reduce((best, event) => ((event.priority ?? 0) > (best.priority ?? 0) ? event : best));
      quietTripped = true;
    }
    if (!next) break;
    thisTurn.add(next.id);
    tripped.push(next.id);
    fired[next.id] = (fired[next.id] ?? 0) + 1;
    const { done, ...record } = applyActions(story, next, flags, party);
    for (const flag of record.show) shownFlags.add(flag);
    for (const [place, season] of record.seasons ?? []) {
      if (season) held[place] = season;
      else delete held[place];
    }
    prepend.push(storyRecord({ event: next.id, ...record }, "engine"));
    deliver(done, true);
    if (record.ending) ended = record.ending;
  }

  const { exposures: exposuresNow, held: heldNow } = storyState(story, ledger);
  return {
    tripped,
    sheet: sheet.join(" "),
    saves,
    ...(released ? { released } : {}),
    prepend: prepend.length ? `${prepend.join("\n\n")}\n\n` : "",
    shown,
    tells,
    beats,
    state: {
      flags,
      fired,
      shown: [...shownFlags],
      ...(ended ? { ended } : {}),
      ...(Object.keys(held).length ? { seasons: held } : {}),
      ...(exposuresNow ? { exposures: exposuresNow } : {}),
      ...(heldNow ? { held: heldNow } : {}),
    },
    filled: clocksFilled(story, flagsBeforeLatest, flags).map((flag) => ({
      flag: flag.id,
      title: flag.clock!.title,
      text: flag.clock!.full,
    })),
    party: [...party],
    ...(party.partySize !== undefined ? { partySize: party.partySize } : {}),
    season: storySeasonAt(story, held, game, at, world.day),
    knowledge: storyKnowledgeHere(story, game, flags, party, [world.latest, world.player]),
  };
}

/** The season at a place (1.351): the one the story holds it, or the nearest place it is inside, at (its
 *  events' first, then the script's own), else the one it holds the whole world at, else the day's. */
/** What marks a place's season hold as over everything inside it (1.361), after its place id. */
const STORY_SEASON_OVER = "!";

export function storySeasonAt(
  story: StoryScript,
  held: Readonly<Record<string, WorldSeason>> | undefined,
  game: GameWorld,
  placeId: string | null | undefined,
  day: number,
): { season: WorldSeason; held: boolean } {
  const parents = new Map(game.world.places.map((place) => [place.id, place.parentId]));
  const own = new Map(story.seasons.map((each) => [each.place ?? "*", each.season]));
  // A hold over everything inside it (1.361) beats every season there, the outermost first.
  const over = held?.[`*${STORY_SEASON_OVER}`];
  if (over) return { season: over, held: true };
  let outermost: WorldSeason | undefined;
  for (let at = placeId ?? null, hops = 0; at && hops < 64; at = parents.get(at) ?? null, hops++) {
    outermost = held?.[`${at}${STORY_SEASON_OVER}`] ?? outermost;
  }
  if (outermost) return { season: outermost, held: true };
  for (let at = placeId ?? null, hops = 0; at && hops < 64; at = parents.get(at) ?? null, hops++) {
    const season = held?.[at] ?? own.get(at);
    if (season) return { season, held: true };
  }
  const world = held?.["*"] ?? own.get("*");
  return world ? { season: world, held: true } : { season: worldSeason(day), held: false };
}

/** Every place the story holds at a season now (1.351), with that season: each place whose own, or a place
 *  it is inside, or the world's, is held (and `*` when the world's is). Empty when the story holds none, so the day's season stands. */
export function storyPlaceSeasons(
  story: StoryScript,
  held: Readonly<Record<string, WorldSeason>> | undefined,
  game: GameWorld,
): Record<string, WorldSeason> {
  if (!story.seasons.length && !Object.keys(held ?? {}).length) return {};
  const seasons: Record<string, WorldSeason> = {};
  for (const place of game.world.places) {
    const at = storySeasonAt(story, held, game, place.id, 0);
    if (at.held) seasons[place.id] = at.season;
  }
  const world = storySeasonAt(story, held, game, null, 0);
  if (world.held) seasons["*"] = world.season;
  return seasons;
}

/** The season each cell of the world is held at (1.351), row by row: the one of the place it lies nearest
 *  (among the places no other is inside), null where that place is not held. Null when nothing is. */
export function worldSeasonCells(
  game: GameWorld,
  seasons: Readonly<Record<string, WorldSeason>> | undefined,
): Array<WorldSeason | null> | null {
  if (!seasons || !Object.keys(seasons).length) return null;
  const { width, height, places } = game.world;
  const parents = new Set(places.flatMap((place) => (place.parentId ? [place.parentId] : [])));
  const leaves = places.filter((place) => !parents.has(place.id));
  if (!leaves.some((place) => seasons[place.id])) return null;
  const cells: Array<WorldSeason | null> = new Array(width * height).fill(null);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let best = Infinity;
      let season: WorldSeason | null = null;
      for (const place of leaves) {
        const far = (place.at.x - x) ** 2 + (place.at.y - y) ** 2;
        if (far < best) {
          best = far;
          season = seasons[place.id] ?? null;
        }
      }
      cells[y * width + x] = season;
    }
  return cells;
}

/** What people know that holds now and is in the scene (1.348): an entry whose conditions hold, whose
 *  person is named in these texts or travels with the party, and, when it has keys, one of them is said;
 *  a turn's worth at most, ranked (1.361): the people the scene names first, then what its words bring in, then
 *  those only travelling along, each rank shared out person by person; those travelling along keep two
 *  entries however crowded the scene. */
export function storyKnowledgeHere(
  story: StoryScript,
  game: GameWorld,
  flags: StoryState["flags"],
  party: StoryParty,
  texts: ReadonlyArray<string | null | undefined>,
): Array<{ who?: string; text: string }> {
  const said = texts.filter((text): text is string => Boolean(text?.trim()));
  const here = new Map<string, string | null>();
  const personHere = (personId: string) => {
    if (!here.has(personId)) {
      const person = storyPerson(game, personId);
      const matcher = person?.named ? fullName(person.name) : null;
      here.set(
        personId,
        person?.named && (party.has(personId) || said.some((text) => matcher!.test(text))) ? person.name : null,
      );
    }
    return here.get(personId) ?? null;
  };
  // What holds, ranked (1.361): the people the scene names first, then what its words bring in, then the
  // companions who are only travelling along; within each, shared out person by person.
  const named = (personId: string) => {
    const person = storyPerson(game, personId);
    return Boolean(person?.named && said.some((text) => fullName(person.name).test(text)));
  };
  const held: Array<{ index: number; rank: number; person?: string; who?: string; text: string }> = [];
  for (const [index, known] of story.knowledge.entries()) {
    if (!storyConditionsHold(known.if, flags, party)) continue;
    const who = known.person ? personHere(known.person) : undefined;
    if (known.person && !who) continue;
    if (known.keys && !known.keys.some((key) => said.some((text) => fullName(key).test(text)))) continue;
    const rank = !known.person ? 1 : named(known.person) ? 0 : 2;
    held.push({
      index,
      rank,
      ...(known.person ? { person: known.person } : {}),
      ...(who ? { who } : {}),
      text: known.text,
    });
  }
  held.sort((a, b) => a.rank - b.rank || a.index - b.index);
  const chosen = new Set<number>();
  const queuesOf = (rank: number) => {
    const queues = new Map<string, number[]>();
    for (const entry of held) {
      if (entry.rank !== rank) continue;
      const key = entry.person ?? `#${entry.index}`;
      queues.set(key, [...(queues.get(key) ?? []), entry.index]);
    }
    return queues;
  };
  // Each person's entries in turn, so no one takes the rest's share.
  const share = (queues: Map<string, number[]>, upTo: number) => {
    while (chosen.size < upTo && [...queues.values()].some((queue) => queue.length)) {
      for (const queue of queues.values()) {
        if (chosen.size >= upTo) break;
        const next = queue.shift();
        if (next !== undefined) chosen.add(next);
      }
    }
  };
  // The companions travelling along keep a small share however crowded the scene, then rank by rank.
  const travelling = queuesOf(2);
  share(travelling, STORY_MAX.knowledgeTravelling);
  share(queuesOf(0), STORY_MAX.knowledgeATurn);
  share(queuesOf(1), STORY_MAX.knowledgeATurn);
  share(travelling, STORY_MAX.knowledgeATurn);
  return held
    .filter((entry) => chosen.has(entry.index))
    .sort((a, b) => a.index - b.index)
    .map(({ who, text }) => ({ ...(who ? { who } : {}), text }));
}

/**
 * The Game Master's own story tags in a reply, answered in place against the story as this turn left
 * it: an event the script made its own, its conditions met, not yet tripped unless it repeats; a flag
 * the script made its own, set or added to with a value of its kind. Anything else is refused with the
 * reason, as world tags are. A trip's world deeds go in right after its tag, for the world's ledger to
 * answer; its scenes and asks come at the start of the next reply.
 */
export function applyStoryTags(
  content: string,
  story: StoryScript,
  game: GameWorld,
  before: StoryState,
  /** The events this turn has already tripped: at most once a turn, as the Engine's own. */
  thisTurn: readonly string[] = [],
  /** The game's ruleset items by id, for the items a trip gives (1.343). */
  item?: StoryItemLabel,
  /** Who travels with the party, by person id (1.349). */
  party?: StoryParty,
): string {
  let ended = before.ended;
  const flags = { ...before.flags };
  const fired = { ...before.fired };
  const tripped = new Set(thisTurn);
  const events = new Map(story.events.map((event) => [event.id, event]));
  const declared = new Map(story.flags.map((flag) => [flag.id, flag]));
  return content.replace(STORY_TAG, (_whole, body: string) => {
    const values = attributes(body);
    const eventId = values.get("event")?.trim();
    const flagId = values.get("flag")?.trim();
    const refuse = (reason: string) =>
      `[story: ${eventId ? `event="${eventId.replace(/["[\]]/g, "")}"` : `flag="${(flagId ?? "").replace(/["[\]]/g, "")}"`} result="refused" reason="${reason}"]`;
    if (eventId) {
      const event = events.get(eventId);
      if (!event) return refuse("unknown-event");
      if (!event.gm) return refuse("not-yours");
      if (ended) return refuse("ended");
      if (!event.repeat && (fired[event.id] ?? 0) > 0) return refuse("done");
      if (tripped.has(event.id)) return refuse("this-turn");
      if (!storyConditionsHold(event.if, flags, party)) return refuse("conditions");
      fired[event.id] = (fired[event.id] ?? 0) + 1;
      tripped.add(event.id);
      const { done, ...record } = applyActions(story, event, flags, party);
      if (record.ending) ended = record.ending;
      const deeds = done.do.flatMap((action) => ("world" in action ? [storyWorldTag(game, action.world)] : []));
      const { tags, refusedItems } = storyActionTags(game, done, item);
      return [
        storyRecord({ event: event.id, ...record }),
        ...deeds,
        ...tags,
        ...refusedItems.map(
          (refused) => `[story: event="${event.id}" give="${refused}" result="refused" reason="unknown-item"]`,
        ),
      ].join("");
    }
    if (flagId) {
      const flag = declared.get(flagId);
      if (!flag) return refuse("unknown-flag");
      if (!flag.gm) return refuse("not-yours");
      const raw = values.get("value");
      const add = values.get("add");
      let next: boolean | number | undefined;
      if (add !== undefined) {
        const amount = Number(add);
        next =
          flag.kind === "number" && add.trim() !== "" && Number.isFinite(amount)
            ? Number(flags[flag.id] ?? 0) + amount
            : undefined;
      } else if (raw !== undefined) {
        const read =
          flag.kind === "bool" ? (raw === "true" ? true : raw === "false" ? false : undefined) : readValue(raw);
        next = typeof read === (flag.kind === "bool" ? "boolean" : "number") ? read : undefined;
      }
      if (next === undefined || (typeof next === "number" && !Number.isFinite(next))) return refuse("unreadable");
      // Kept within its bounds (1.358).
      if (typeof next === "number") next = storyBounded(flag, next);
      flags[flag.id] = next;
      return storyRecord({ flag: flag.id, set: [[flag.id, next]], show: [] });
    }
    return refuse("unreadable");
  });
}

/** Every story tag in a reply refused: a game with no story to answer them (worldgen W10), so a tag
 *  that looks answered can never count later. */
export function refuseStoryTags(content: string): string {
  return content.replace(STORY_TAG, (_whole, body: string) => {
    const values = attributes(body);
    const id = (values.get("event") ?? values.get("flag") ?? "").replace(/["[\]]/g, "");
    const key = values.has("event") ? "event" : "flag";
    return `[story: ${id ? `${key}="${id}" ` : ""}result="refused" reason="no-story"]`;
  });
}

/** The story as the Game Master is told it once, with the world: how to write its tags, and what of the
 *  script is its own, with the beats it narrates as it marks a moment (told after the moment, they would
 *  only tell it again; a beats scene an Engine event shares is so known from the start). Nothing else
 *  of the script (the Engine's events and every other scene stay unknown until they happen). Empty
 *  when the script gives the Game Master nothing. */
export function storyScriptPromptText(story: StoryScript): string {
  const events = story.events.filter((event) => event.gm);
  const flags = story.flags.filter((flag) => flag.gm);
  if (!events.length && !flags.length) return "";
  const cutscenes = new Map(story.cutscenes.map((cutscene) => [cutscene.id, cutscene]));
  return [
    "This world has a story script. When the story reaches one of these moments, mark it with a story tag; the Engine answers it in place, and refuses anything else.",
    ...(events.length
      ? [
          'Moments you may trip, with [story: event="<id>"]:',
          ...events.flatMap((event) => {
            const beats = gmEventBeats(event, cutscenes);
            return [
              `- ${event.id}${event.note ? `: ${event.note}` : ""}`,
              ...(beats.length
                ? [
                    "  When you mark it, narrate this with it, in your own words, beat by beat:",
                    ...beats.map((beat) => `  - ${beat}`),
                  ]
                : []),
            ];
          }),
        ]
      : []),
    ...(flags.length
      ? [
          'Story values you may set, with [story: flag="<id>" value="<value>"] (or add="<number>" for a number):',
          ...flags.map(
            (flag) =>
              `- ${flag.id} (${flag.kind === "bool" ? "true or false" : "a number"})${flag.note ? `: ${flag.note}` : ""}`,
          ),
        ]
      : []),
  ].join("\n");
}

/** What the story says to the Game Master this turn: its values (hidden from the player), the standing
 *  directions in force, what it asks now, the scene just shown, any scene to narrate now, and which of
 *  its own moments are not open now. */
export function storyTurnPromptText(story: StoryScript, turn: StoryTurn): string {
  const lines: string[] = [];
  const values = story.flags.map((flag) => {
    const value = turn.state.flags[flag.id];
    return `${flag.id} = ${typeof value === "boolean" ? (value ? "yes" : "no") : value}`;
  });
  if (values.length) lines.push(`Story values (the player never sees these): ${values.join(", ")}.`);
  const party: StoryParty = Object.assign(new Set(turn.party), { partySize: turn.partySize });
  const directions = story.directions.filter((direction) => storyConditionsHold(direction.if, turn.state.flags, party));
  if (directions.length)
    lines.push("Keep to these while they hold:", ...directions.map((direction) => `- ${direction.text}`));
  if (turn.shown.length) {
    lines.push(
      "Just before your reply, the player was shown this scene as written. Carry on from it; do not repeat it:",
      ...turn.shown,
    );
  }
  for (const scene of turn.beats) {
    lines.push("Narrate this scene now, in your own words, beat by beat:", ...scene.map((beat) => `- ${beat}`));
  }
  const clocks = story.flags.filter((flag) => flag.clock);
  if (clocks.length) {
    lines.push(
      `Clocks the story keeps: ${clocks
        .map(
          (flag) =>
            `${flag.clock!.title} ${Math.max(0, Math.min(flag.clock!.segments, Math.floor(Number(turn.state.flags[flag.id]) || 0)))}/${flag.clock!.segments}`,
        )
        .join(", ")}.`,
    );
  }
  for (const clock of turn.filled ?? []) {
    lines.push(`The clock "${clock.title}" has just filled. Bring this about now: ${clock.text}`);
  }
  if (turn.season.held) {
    lines.push(`It is ${turn.season.season} here, whatever the date: the story holds it so.`);
  }
  // Every turn it holds, not only the one it began (1.366): a fight can start on any of them.
  const held = turn.state.held ? story.heldGround.find((each) => each.id === turn.state.held) : undefined;
  if (held && !turn.tells.some((tell) => tell.startsWith(storyHeldGroundText(held)))) {
    lines.push(storyHeldGroundText(held));
  }
  if (turn.knowledge.length) {
    lines.push(
      "What people here know and may say, if it comes up (in their own words, never all at once):",
      ...turn.knowledge.map((known) => `- ${known.who ? `${known.who}: ` : ""}${known.text}`),
    );
  }
  if (turn.tells.length) lines.push("The story asks this of you now:", ...turn.tells.map((tell) => `- ${tell}`));
  const ended = turn.state.ended ? story.endings.find((ending) => ending.id === turn.state.ended) : undefined;
  if (ended && !turn.tripped.length) {
    lines.push(`The story has ended ("${ended.title}"). Mark no more of its moments.`);
  }
  // Its own moments it cannot mark now (done, held back by their conditions, or the Engine's this turn),
  // so it never marks, and tells the beats of, a moment the Engine would refuse. Only the marking is
  // closed: a scene the Engine asks for this turn is still told, even one such a moment shares.
  const closed = story.events.filter(
    (event) =>
      event.gm &&
      (turn.tripped.includes(event.id) ||
        (!event.repeat && (turn.state.fired[event.id] ?? 0) > 0) ||
        !storyConditionsHold(event.if, turn.state.flags, party)),
  );
  if (closed.length) {
    lines.push(`Story moments you cannot mark now: ${closed.map((event) => event.id).join(", ")}.`);
  }
  return lines.join("\n");
}
