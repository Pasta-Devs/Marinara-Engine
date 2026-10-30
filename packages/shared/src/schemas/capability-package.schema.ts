import { z } from "zod";
import { experienceSetupDefaultsSchema } from "../features/world/game-intro.js";
import { agentResultTypeSchema } from "./agent.schema.js";
import { isRulesetCatalogAssetPath, RULESET_ASSET_PATH } from "./ruleset.schema.js";

/** Caps mirrored by the Marinara-Agents catalog build. Kept here so a hostile or
 *  broken notes document cannot push an unbounded string into a modal. */
export const MAX_RELEASE_NOTE_CHARACTERS = 1000;
export const MAX_RELEASE_NOTE_VERSIONS = 20;

export const capabilityPackageKindSchema = z.enum([
  "agent",
  "maps",
  "conversation-calls",
  "turn-game",
  "ruleset",
  // A data-only Experience (Capability API 1.373): Game Mode's own view plays it; it carries no code.
  "experience",
]);
export const capabilityPermissionSchema = z.enum([
  "achievements",
  "agent-runtime",
  "chat-read",
  "chat-write",
  "conversation-actions",
  "mari-actions",
  "network",
  "prompt-context",
  "routes",
  "scenes",
  "storage",
  "tools",
  "ui",
]);

/** What a data-only Experience (Capability API 1.373) may hold: pictures, music and data, nothing that runs.
 *  The same list as the Experience file's (features/world/experience-file.ts). */
const DATA_ONLY_EXPERIENCE_FILE = /\.(?:png|jpe?g|gif|webp|ogg|mp3|wav|json)$/iu;

/** The largest audio file a package may ship as an asset (Capability API 1.345). */
export const CAPABILITY_AUDIO_ASSET_MAX_BYTES = 16 * 1024 * 1024;
const AUDIO_ASSET = /\.(?:ogg|mp3|wav)$/iu;
const musicId = z.string().regex(/^[a-z0-9_-]{1,40}$/, "A track id is 1 to 40 lowercase letters, digits, _ or -");

/** An Experience's own music (Capability API 1.345). */
export const experienceMusicSchema = z
  .object({
    tracks: z
      .array(
        z
          .object({
            id: musicId,
            path: z.string().min(1).max(240).regex(AUDIO_ASSET, "A track is an .ogg, .mp3 or .wav file"),
            title: z.string().min(1).max(80).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(64),
    /** Played wherever no place has a track of its own. */
    default: musicId.optional(),
    /** Played while a fight is on. */
    combat: musicId.optional(),
    /** A place's track (a place id of the pack's worlds), for it and every place inside it. */
    places: z
      .array(z.object({ place: z.string().min(1).max(120), track: musicId }).strict())
      .max(128)
      .optional(),
  })
  .strict();
export type ExperienceMusic = z.infer<typeof experienceMusicSchema>;

const capabilityPackageManifestBaseSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    name: z.string().min(1).max(120),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    description: z.string().max(2000).default(""),
    /** Optional translated display copy. Unknown/partial locales fall back to the canonical fields above. */
    localizations: z
      .record(
        z.string().min(2).max(35),
        z
          .object({
            name: z.string().min(1).max(120).optional(),
            description: z.string().max(2000).optional(),
            homeBrowserTab: z
              .object({
                label: z.string().min(1).max(40).optional(),
                ariaLabel: z.string().min(1).max(100).optional(),
              })
              .strict()
              .optional(),
            homeWidgets: z
              .record(
                z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
                z
                  .object({ label: z.string().min(1).max(80).optional(), description: z.string().max(200).optional() })
                  .strict(),
              )
              .optional(),
          })
          .strict(),
      )
      .optional(),
    engine: z.object({ min: z.string().min(1), maxExclusive: z.string().min(1) }).strict(),
    kind: z.array(capabilityPackageKindSchema).min(1),
    entrypoints: z
      .object({
        server: z.string().optional(),
        client: z.string().optional(),
        agents: z.string().optional(),
        knowledge: z.string().optional(),
      })
      .strict(),
    contributions: z
      .object({
        slots: z
          .array(
            z.enum([
              "conversation-surface",
              "conversation-toolbar",
              "chat-settings",
              "spatial-workspace",
              "chat-runtime",
              "game-world-map",
              // Adds a top-level destination to Home's browser shell.
              "home-browser-tab",
              // Agent-owned cards inside the Home widget grid.
              "home-widget",
              // Mounts the package's own game UI over the narration.
              "game-surface",
              // Compact package-owned tracker controls in Roleplay chat chrome.
              "roleplay-tracker",
              // Package-owned content inside the detached or docked Tracker Panel.
              "tracker-panel",
            ]),
          )
          .optional(),
        /** Options for the `game-surface` slot. */
        gameSurface: z
          .object({
            /** Mount before the first GM turn and wait for setStartupReady on the surface props. */
            prepareBeforeStart: z.boolean().optional(),
            /** Engine-owned setup: one optional seed and package-owned constant defaults. */
            setup: z
              .object({
                seed: z
                  .object({
                    key: z
                      .string()
                      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
                      .max(120)
                      .refine((key) => !["__proto__", "constructor", "prototype"].includes(key)),
                    label: z.string().min(1).max(100).optional(),
                  })
                  .strict()
                  .optional(),
                config: z
                  .record(z.string().max(120), z.unknown())
                  .refine((value) => JSON.stringify(value).length <= 8_000)
                  .optional(),
                requires: z.object({ enableCustomWidgets: z.boolean().optional() }).strict().optional(),
                /** GM setup values the wizard fills in when the Experience is picked (Capability API 1.372). */
                defaults: experienceSetupDefaultsSchema.optional(),
              })
              .strict()
              .optional(),
            /** A map pack (worldgen W9e): the Experience's own setting kit, ready-made worlds built with it
             *  and its own tile pack, as the kit, world and tile pack share files among its assets. A new
             *  game with the Experience on is locked to its kit, and to one of its worlds when it ships
             *  any; its overworld and towns are drawn with its tiles. Requires Capability API 1.72. */
            mapPack: z
              .object({
                kit: z
                  .string()
                  .min(1)
                  .max(240)
                  .regex(/\.worldkit\.json$/u, "A map pack's kit is a .worldkit.json file"),
                worlds: z
                  .array(
                    z
                      .string()
                      .min(1)
                      .max(240)
                      .regex(/\.world\.json$/u, "A map pack's world is a .world.json file"),
                  )
                  .max(32)
                  .optional(),
                tiles: z
                  .string()
                  .min(1)
                  .max(240)
                  .regex(/\.tilepack\.json$/u, "A map pack's tiles are a .tilepack.json file")
                  .optional(),
                /** Creature packs for this Experience's fights (Capability API 1.344): their art comes
                 *  before the creature pack chosen in the library, in this order. */
                creatures: z
                  .array(
                    z
                      .string()
                      .min(1)
                      .max(240)
                      .regex(/\.creaturepack\.json$/u, "A map pack's creatures are a .creaturepack.json file"),
                  )
                  .min(1)
                  .max(8)
                  .optional(),
                /** Image packs of the Experience's own for its maps made by hand (Capability API 1.357): tile
                 *  packs laid out as the library's dungeon sets (floor, wall, liquid and eight props), each
                 *  named by its id from a hand map's `pack`, before the library's. */
                dungeons: z
                  .array(
                    z
                      .string()
                      .min(1)
                      .max(240)
                      .regex(/\.tilepack\.json$/u, "A map pack's dungeon looks are a .tilepack.json file"),
                  )
                  .min(1)
                  .max(16)
                  .optional(),
                /** The Experience's own music (Capability API 1.345): its tracks, the one for each place
                 *  (a place's own, else the nearest place it is inside that has one), the one played
                 *  anywhere else, and the one for fights. A story may cue a track over them. */
                music: experienceMusicSchema.optional(),
                /** The Experience's people (Capability API 1.346): a `.people.json` file dressing the named
                 *  people of its worlds with portraits, expressions, a walking look and lore. */
                people: z
                  .string()
                  .min(1)
                  .max(240)
                  .regex(/\.people\.json$/u, "A map pack's people are a .people.json file")
                  .optional(),
                /** What the Experience adds to rulesets while it is on (Capability API 1.355): for each
                 *  ruleset (by id), a `.overlay.json` file of bestiary creatures, conditions, creature tags
                 *  and catalog entries merged into a game's ruleset of that id. */
                rulesets: z
                  .array(
                    z
                      .object({
                        ruleset: z
                          .string()
                          .max(140)
                          .regex(
                            /^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/u,
                            "A ruleset is named by its id",
                          ),
                        overlay: z
                          .string()
                          .min(1)
                          .max(240)
                          .regex(/\.overlay\.json$/u, "A ruleset overlay is a .overlay.json file"),
                      })
                      .strict(),
                  )
                  .min(1)
                  .max(8)
                  .optional(),
              })
              .strict()
              .optional(),
            /** Class the host puts on the game area while this surface is mounted, so the package can
             *  restyle the shared chrome that renders outside its element. Declared rather than pushed at
             *  runtime, so the theme applies on first paint. */
            surfaceClass: z
              .string()
              .regex(/^[a-z][a-z0-9-]*$/)
              .max(60)
              .optional(),
          })
          .strict()
          .optional(),
        /** Browser metadata is declarative so Home can paint the tab before the client bundle loads. */
        homeBrowserTab: z
          .object({
            label: z.string().min(1).max(40),
            ariaLabel: z.string().min(1).max(100).optional(),
            /** One or two package-owned images rendered together as the compact browser-tab mark. */
            iconPaths: z
              .array(
                z
                  .string()
                  .min(1)
                  .max(240)
                  .regex(/\.(?:gif|jpe?g|png|webp)$/iu),
              )
              .min(1)
              .max(2)
              .optional(),
          })
          .strict()
          .optional(),
        homeWidgets: z
          .array(
            z
              .object({
                id: z
                  .string()
                  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                  .max(64),
                label: z.string().min(1).max(80),
                description: z.string().max(200),
                size: z.enum(["compact", "large"]),
                icon: z
                  .enum([
                    "activity",
                    "bell",
                    "calendar",
                    "chart",
                    "circle",
                    "clock",
                    "file",
                    "flame",
                    "heart",
                    "image",
                    "list",
                    "message",
                    "sparkles",
                    "star",
                    "zap",
                  ])
                  .optional(),
                iconPath: z
                  .string()
                  .min(1)
                  .max(240)
                  .regex(/\.(?:gif|jpe?g|png|webp)$/iu)
                  .optional(),
                accent: z.enum(["cyan", "green", "amber", "orange", "rose", "violet"]).optional(),
                surface: z.enum(["soft", "solid", "quiet"]).optional(),
                header: z.enum(["standard", "compact", "banner"]).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(3)
          .optional(),
        /** General package-owned static assets (art, sprite atlases, tilemap JSON) served over
         *  `/api/capability-packages/:id/assets/*` through the same verification chain as
         *  browser-tab icons: path containment, `files[]` membership, a passive content-type
         *  allowlist, and hash re-verification on every read. Requires Capability API 1.10. */
        assets: z
          .object({
            paths: z
              .array(
                z
                  .string()
                  .min(1)
                  .max(240)
                  // Passive content only — images, audio (Capability API 1.345) plus JSON metadata.
                  // Never SVG, HTML, or scripts: those are active documents on a same-origin route.
                  .regex(/\.(?:gif|jpe?g|png|webp|json|ogg|mp3|wav)$/iu),
              )
              .min(1)
              // Bounded so a manifest cannot enumerate an arbitrarily large tree.
              .max(256),
          })
          .strict()
          .optional(),
        conversationGame: z
          .object({
            command: z.string().regex(/^\/[a-z0-9-]+$/),
            aliases: z.array(z.string().min(1).max(40)).default([]),
            playerLabel: z.string().min(1).max(80),
          })
          .strict()
          .optional(),
        agentDetail: z
          .object({
            agentIds: z
              .array(
                z
                  .string()
                  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                  .max(80),
              )
              .min(1)
              .max(32),
            /**
             * Capability API 1.390. `"engine"`: the Engine draws the page header (Back, store banner
             * and logo, name, author and version, Active, Manage package). The package's
             * `view="detail"` gets `engineHeader: true` and a `headerSlot` element to portal its own
             * header buttons into. Leave it out to draw the whole page, header included, as before.
             */
            header: z.literal("engine").optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    files: z
      .array(
        z
          .object({
            path: z.string().min(1).max(240),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            bytes: z
              .number()
              .int()
              .nonnegative()
              .max(100 * 1024 * 1024),
          })
          .strict(),
      )
      .min(1),
    permissions: z.array(capabilityPermissionSchema),
    restartRequired: z.boolean().default(false),
  })
  .strict();

// 1.10: contributions.assets — general package-owned static asset delivery.
// 1.11: Experience combat seam — combatActive/combatStyle/requestCombat on the
//        game-surface capabilityProps.
// 1.12: spatial transition commit/reject/refresh capability events are also
//        addressed to the game-owning Experience package (soft seam: delivered
//        regardless of declared capabilityApi; declare 1.12 only to REQUIRE it).
// 1.13: setExperienceChrome accepts requestsCollapsedNarration — a transient request
//        to fold the Game narration box down to its handle for a cutscene beat. It
//        never writes the player's stored preference and the engine's safety rules
//        still force the box open when it holds something to act on.
// 1.14: roleplay-tracker and tracker-panel UI contribution slots, package-aware
//        prompt placement, and package-agent post-processing lifecycle hooks.
// 1.15: packages can resolve their current embedding connection without reactivation.
// 1.16: package-declared Game Master verbs — a hash-pinned `gm-verbs.json` asset the engine renders
//        into the GM prompt, parses back out of the turn, and either writes into the package's own
//        chat-metadata key or delivers live as a `gm_verb` event (soft seam: read from the asset
//        regardless of declared capabilityApi; declare 1.16 only to REQUIRE it. Needs `chat-write`).
// 1.17: opted-in Experience surfaces prepare before startup and supply first-turn world context.
// 1.18: Experience seed/default declarations in the Engine setup wizard.
// 1.19: package-contributed tools — a package holding `tools` registers a named tool through
//        `api.registerTool`, and the engine offers it to the model alongside the built-ins on every
//        turn, validates the call against the package's own JSON Schema, and hands the arguments to
//        the package's handler. Not a soft seam: the API only exists on an engine this new, so a
//        package that needs it must declare 1.19. Needs `tools`.
// 1.20: Game Mode rulesets — a hash-pinned `ruleset.json` asset the engine validates as data and
//        offers as a game's rules (resolution kind, character sheet, rests, GM guidance). Not a
//        soft seam: a ruleset package is useless on an engine that cannot read it, so declaring
//        the asset requires 1.20 and an older engine refuses the install cleanly. No permission.
// 1.21: ruleset catalogs — a ruleset may ship collections of ready-made entries the sheet editor
//        offers in a picker, inline in `ruleset.json` or as hash-pinned `catalogs/<id>.json`
//        assets beside it. Not a soft seam either, for the same reason as 1.20: an engine that
//        cannot read `catalogs` refuses the whole ruleset file, so a package that ships them
//        declares 1.21 and an older engine refuses the install cleanly. No permission.
// 1.22: the ruleset combat bridge — a ruleset may carry an optional `battle` block naming the live
//        pools a fight reads as hit points, energy and slots, and the sheet lists whose
//        catalog-marked rows become the Engine's own combat skills. Not a soft seam, for the same
//        reason as 1.20 and 1.21: an engine that cannot read `battle` refuses the whole ruleset
//        file, so a package that ships one declares 1.22. No permission.
// 1.23: scaled catalog values — a catalog entry row may carry a `scaled` map naming number columns
//        the ruleset keeps up to date from the sheet (a maximum that follows a level or an ability),
//        each a value reference with an optional step table. Not a soft seam, for the same reason as
//        1.20, 1.21 and 1.22: an engine that cannot read `scaled` refuses the whole ruleset file, or
//        the catalog file that holds it, so a package that ships one declares 1.23. No permission.
// 1.24: the `dice-pool` resolution kind — a ruleset may resolve a check by throwing the sheet's own
//        number of dice and counting the ones that reach a target, with optional doubling,
//        exploding, cancelling, botches, exceptional successes and situational dice. Not a soft
//        seam, for the same reason as 1.20 through 1.23: an engine that knows only `dice-sum`
//        refuses the whole ruleset file, so a package whose ruleset declares the kind declares
//        1.24. No permission.
// 1.25: ruleset layers. A ruleset may declare variants of itself (Low magic, Hard winter) that a
//        player turns on when a game is created, each appending Game Master guidance, narrowing an
//        enum field, swapping the difficulty ladder or hiding catalog entries. The same release
//        gives the base `gm` block a `worldGuidance` slot, read once by world generation. Not a
//        soft seam, for the same reason as 1.20 through 1.24: an engine that cannot read `layers`
//        or `gm.worldGuidance` refuses the whole ruleset file, so a package that ships either one
//        declares 1.25. No permission.
// 1.26: ruleset combat. A ruleset may carry an optional `combat` block saying how a fight is
//        RESOLVED by its own numbers (what is rolled against what, the action economy, conditions,
//        concentration, dying and the threat scale), and a catalog entry's `mechanics` may say how
//        many targets it takes, that it always lands, what conditions it applies, what temporary
//        points it grants, how it grows with the sheet and which budget it spends. Not a soft seam,
//        for the same reason as 1.20 through 1.25: an Engine that cannot read `combat` or the new
//        `mechanics` keys refuses the whole ruleset file, or the catalog file that holds them, so a
//        package that ships either declares 1.26. No permission.
// 1.27: ruleset bestiaries. A ruleset catalog may declare `"holds": "creatures"` and carry creature
//        stat blocks instead of sheet rows: health that may be dice, a defense, saves, resistances,
//        condition immunities, a threat tier, traits the Game Master is shown and actions with
//        sequences, limited uses, recharge rolls and signature points. Not a soft seam, for the
//        same reason as 1.20 through 1.26: an Engine that cannot read `holds` or `creature` refuses
//        the whole ruleset file, or the catalog file that holds them, so a package that ships
//        either declares 1.27. No permission.
// 1.28: a ruleset fight on a board. A ruleset's `combat` block may say what one cell of a grid is
//        worth in its own distance (`distance`), what shooting past the ordinary distance or beside
//        a foe does (`ranged`), what standing behind something adds to the defense (`cover`) and
//        which budget a strike at somebody walking away is paid out of (`opportunity`); an attack
//        list may give its rows a `reach` and a `range`; and a creature action's `range` may be an
//        ordinary distance with a longer one beyond it. Not a soft seam, for the same reason as
//        1.20 through 1.27: an Engine that cannot read these keys refuses the whole ruleset file,
//        or the catalog file that holds them, so a package that ships any of them declares 1.28.
//        No permission.
// 1.29: what one turn of a ruleset fight can do. A blow may carry a second damage clause
//        (`plus`), an attack list may say how many strikes one spend of its budget buys
//        (`strikes`), a catalog entry may be free of the economy, hand budgets back or let its
//        holder buy a standard action with another budget (`free`, `gives`, `standard`), a new
//        entry kind `rider` and a creature's own `riders` add damage to a qualifying hit, and a
//        condition may narrow the saves it is about, count only while its source is in sight or
//        end when its source goes down. Not a soft seam, for the same reason as 1.20 through
//        1.28: an Engine that cannot read these keys refuses the whole ruleset file, or the
//        catalog file that holds them, so a package that ships any of them declares 1.29.
//        No permission.
// 1.30: wound tracks. A ruleset's `live.tracks` entry may declare `levels` (a column of boxes, each
//        with a label and a penalty) and `kinds` (what a mark on it may be), which turns the track
//        from a bounded integer into a wound track that is marked rather than counted; and
//        `resolution.penaltyFrom` names the track whose penalty rides on every roll, taking dice
//        off a pool or adding a flat modifier to a sum. Not a soft seam, for the same reason as
//        1.20 through 1.29: an Engine that cannot read these keys refuses the whole ruleset file,
//        so a package that ships any of them declares 1.30. No permission.
// 1.31: live host LLM, image and video integrations for downloadable packages.
// 1.32: a weapon that is one strike a turn whatever its wielder's count. An attack source may
//        declare `strikesCappedBy`, a boolean column of its own list that holds ITS row to a single
//        strike however many `strikes` the list buys. SRD 5.1's Loading is the sentence it exists
//        for. Not a soft seam, for the same reason as 1.20 through 1.31: an Engine that cannot read
//        the key refuses the whole ruleset file, so a package that ships it declares 1.32. No
//        permission.
// 1.33: a catalog entry that says WHICH moment it waits for. `mechanics.reaction` may be an object
//        rather than `true`: `on` names the moment the Engine notices ("aimed" before something
//        lands on its holder, "harmed" after something has hurt them), `at` says whom what is taken
//        is pointed at, and `cancels` stops what the window was holding from happening at all. An
//        entry that still says only `true` is on no menu, exactly as before, so a package that
//        ships one needs nothing newer. Not a soft seam, for the same reason as 1.20 through 1.32:
//        an Engine that cannot read the object refuses the whole catalog asset, so a package that
//        ships one declares 1.33. No permission.
// 1.34: a bestiary creature described in the ruleset's own terms. A creature may carry a `sheet`:
//        a character sheet, as partial as it likes, keyed by the ids the ruleset declares. An
//        opponent built from one is built the way a party member is, so its health (a pool or a
//        track), defense, saves, speed, initiative and the abilities on its lists come from the
//        ruleset's own declarations, and it may pay for them out of its own pools. The fixed
//        `health`, `defense` and `initiativeModifier` a creature needed before are then not given,
//        and a creature with a sheet may have no block actions of its own. Not a soft seam, for the
//        same reason as 1.20 through 1.33: an Engine that cannot read the key refuses the whole
//        strict catalog file, so a package that ships one declares 1.34. No permission.
// 1.36: package achievements. `api.registerAchievements` adds badges to the Home panel and
//        `api.runtime.achievements` reads and unlocks them. Requires the `achievements` permission.
// 1.37: a check's rules moved for one roll, and a sheet the Game Master reads more of.
//        `resolution.explode` and `resolution.double` may carry a `min` (and then may leave `from`
//        out) so a check can move the face they fire on, a catalog entry's `mechanics.check` may do
//        the same with `explode` and `double`, `resolution.pool.abilityPlusAbility` lets an ability
//        check add a second ability, and `resolution.botch.rule` reads a botch as low faces on half
//        the dice or more. On the sheet, a plain `live.tracks` entry may take its `max` from a value
//        the sheet works out and may carry `hideWhen` and `alwaysShow`, and a `gm.sheetSummary.lists`
//        entry may show `columns` and be named by an enum column. Not a soft seam, for the same
//        reason as 1.20 through 1.34: an Engine that cannot read these keys refuses the whole
//        ruleset file, or the catalog file that holds them, so a package that ships any of them
//        declares 1.37. No permission.
// 1.38: what a check may buy and what rides along on it. `resolution.reroll` lists standing re-throws
//        a check may name with `reroll=`, a `resolution.spend` entry may buy a `reroll` and read its
//        `perCheck` limit off the sheet (a value reference, or `"pool"` for the check's own dice), a
//        ruleset may declare up to four spends, and `resolution.adjust` adds numbers off the sheet to
//        every check they apply to. Not a soft seam, for the same reason as 1.20 through 1.37: an
//        Engine that cannot read these keys refuses the whole ruleset file, so a package that ships
//        any of them declares 1.38. No permission.
// 1.39: what a sheet can read. A value reference may read a live track (`liveTrack`, with `read`)
//        or pool (`livePool`), or add up a list's column (`listSum`); a skill or save may carry a
//        `cap`; and `hideWhen` may compare with `notEquals` or `in` as well as `equals`. Not a soft
//        seam, for the same reason as 1.20 through 1.38: an Engine that cannot read these keys
//        refuses the whole ruleset file, so a package that ships any of them declares 1.39. No
//        permission.
// 1.40: wound tracks that are more than a fixed list. A track may be numbered `boxes` (as many as
//        its own `max`, with a penalty table over boxes filled or remaining), `fill` by box
//        (`indexed`), `onFull: "refuse"`, and take `extra` levels from a list; a rest's restore
//        step may name the `kind` it heals. Not a soft seam, for the same reason as 1.20 through
//        1.39: an Engine that cannot read these keys refuses the whole ruleset file, so a package
//        that ships any of them declares 1.40. No permission.
// 1.41: abilities, skills and saves may sit in a `section`, and a skill, save or section may say
//        what a check does `untrained` (roll as usual, one step harder, not at all, or `by` a
//        number). Not a soft seam, for the same reason as 1.20 through 1.40: an Engine that cannot
//        read these keys refuses the whole ruleset file, so a package that ships any of them
//        declares 1.41. No permission.
// 1.42: a sheet's live section may declare `states` (one value out of a closed set that changes in
//        play, set by `op="state"`), a derived value may be an `enumTable` keyed on an enum field or a
//        live state, and a rest's restore step may put a `state` back. Not a soft seam, for the same
//        reason as 1.20 through 1.41: an Engine that cannot read these keys refuses the whole ruleset
//        file, so a package that ships any of them declares 1.42. No permission.
// 1.43: a ruleset's combat block may declare `checks` (numbers off the sheet a contest reads) and
//        `contests` (both sides throw the attack dice and add a check; winning applies or ends
//        conditions and pushes on a board), and a creature may give its own `checks`. Not a soft
//        seam, for the same reason as 1.20 through 1.42: an Engine that cannot read these keys
//        refuses the whole ruleset or catalog file, so a package that ships any of them declares
//        1.43. No permission.
// 1.44: a catalog entry's reaction may wait for `on: "used"` (somebody on the other side is about to
//        use something, anywhere it reaches, and it may be called off) and may name `against` (only
//        entries of these catalogs open its moment). Not a soft seam, for the same reason as 1.20
//        through 1.43: an Engine that cannot read these refuses the whole catalog, so a package that
//        ships any of them declares 1.44. No permission.
// 1.45: a combat condition may change numbers (`modifiers` to defense, attacks, saves, checks and
//        speed) and make checks easier or harder, `combat.levels` makes a live track's levels count
//        as conditions, and an applied condition may count down as turns begin (`duration.at`) or end
//        after one use (`endsAfter`). Not a soft seam, for the same reason as 1.20 through 1.44: an
//        Engine that cannot read these refuses the whole ruleset or catalog file, so a package that
//        ships any of them declares 1.45. No permission.
// 1.46: a reaction may wait for `on: "hit"` (an attack roll has just hit its holder, before the
//        damage; what is taken counts for that attack), and a creature's action may carry the same
//        `reaction` object and `self: true` for one that lands on the creature itself. Not a soft
//        seam, for the same reason as 1.20 through 1.45: an Engine that cannot read these refuses the
//        whole catalog, so a package that ships any of them declares 1.46. No permission.
// 1.47: a second combat kind, `dice-pool`: a fight thrown in the ruleset's own pools and counted in
//        successes, with a `pool` block (damage target and soak by kind), a creature's own `soak`,
//        and an attack row's `toHit.skill`. Beside it, for either kind, `initiative.each` throws
//        initiative again every round and `combat.spendLimits` caps what one combatant spends of a
//        pool per turn or round. Not a soft seam, for the same reason as 1.20 through 1.46: an Engine
//        that cannot read these refuses the whole ruleset or catalog file, so a package that ships
//        any of them declares 1.47. No permission.
// 1.48: initiative in a `dice-pool` fight may be thrown as a pool (`initiative.pool`, whose
//        successes and `plus` are the number), and may be a number attacks move
//        (`initiative.resource`: styles of attack that take it or spend it, a crash line, and the
//        order following it every round). Not a soft seam, for the same reason as 1.20 through 1.47:
//        an Engine that cannot read these refuses the whole ruleset file, so a package that ships any
//        of them declares 1.48. No permission.
// 1.49: a ruleset may describe items: an `items` block (categories, rarities, tags, stats, slots,
//        binding, carry, currencies, `native` and `freeform`) and a third catalog kind,
//        `holds: "items"`, whose entries carry an `item`. Not a soft seam, for the same reason as 1.20
//        through 1.48: an Engine that cannot read these refuses the whole ruleset or catalog file, so
//        a package that ships any of them declares 1.49. No permission.
// 1.50: Professor Mari actions. A package holding the `mari-actions` permission may register
//        `api.registerService("mari-actions:<package-id>", { list, run })`, and Professor Mari's
//        `package_service` tool can list and run those actions. Requires the `mari-actions` permission.
// 1.51: items the Game Master invents. A ruleset's `items` block may carry `rarityCaps` (the largest
//        value of each number stat an invented item of a rarity may give) and `propose` (false forbids
//        invention). Not a soft seam, for the same reason as 1.20 through 1.49: an Engine that cannot
//        read these refuses the whole ruleset file, so a package that ships either declares 1.51. No
//        permission.
// 1.52: a value may read the items someone holds (`itemStat`: a stat over their worn, carried or
//        all items, by sum, highest, lowest or count, optionally only one slot, category or tag).
//        Not a soft seam, for the same reason as 1.20 through 1.51: an Engine that cannot read it
//        refuses the whole ruleset or catalog file, so a package that ships one declares 1.52. No
//        permission.
// 1.53: conditions and items change checks outside a fight. An item may say what it does while
//        `worn` and while only `carried` (advantage or disadvantage, modifiers to checks and saves,
//        saves it fails), a condition or a level may narrow its check effects to some `skills`, a
//        modifier may name its own `skills` or `saves` and roll twice (`mode`), and a rarity cap may
//        hold a worn or carried `bonus`. Not a soft seam, for the same reason as 1.20 through 1.52: an
//        Engine that cannot read these refuses the whole ruleset or catalog file, so a package that
//        ships any of them declares 1.53. No permission.
// 1.54: an item may ask something of whoever wears it (`requires`: a value off their sheet, the least
//        it may be, and what applies while they fall short), a worn or carried effect may set or raise
//        an ability (`abilities`), and a condition level may read a derived value (`derived`) instead
//        of a live track. Not a soft seam, for the same reason as 1.20 through 1.53: an Engine that
//        cannot read these refuses the whole ruleset or catalog file, so a package that ships any of
//        them declares 1.54. No permission.
// 1.55: an item may be a weapon (`attack`: what it adds to hit, deals, reaches and carries, each value
//        written down or read off the item's own stat), offered in a ruleset fight while it is worn,
//        and a creature's resistance or immunity may name the item tags a blow gets through it with
//        (`{ type, except }`). Not a soft seam, for the same reason as 1.20 through 1.54: an Engine
//        that cannot read these refuses the whole ruleset or catalog file, so a package that ships
//        any of them declares 1.55. No permission.
// 1.56: what an item does while worn or carried may change a fight (modifiers to defense, attacks and
//        speed, the fight's condition effects, and the kinds of harm and conditions it keeps off:
//        `resist`, `vulnerable`, `immune`, `conditionImmunities`), `combat.pool.hardness` reads a
//        fighter's hardness, and a creature may have `hardness`. Not a soft seam, for the same reason
//        as 1.20 through 1.55: an Engine that cannot read these refuses the whole ruleset or catalog
//        file, so a package that ships any of them declares 1.56. No permission.
// 1.57: a weapon's attack may shoot something (`ammo`: a carried item's tag, how many an attack, the
//        share picked up after a won fight) and keep a loaded count (`clip`: how many it holds and
//        the budget a reload spends), and a ruleset fight writes what it shot and loaded to the
//        inventory. Not a soft seam, for the same reason as 1.20 through 1.56: an Engine that cannot
//        read these refuses the whole ruleset or catalog file, so a package that ships any of them
//        declares 1.57. No permission.
// 1.58: a weapon's attack may have other `modes` of making it, be an `offHand` weapon (with the
//        combat block's `offHand` budget), deal at least a `floor` on a hit, and put conditions on a
//        target `onHit`. Not a soft seam, for the same reason as 1.20 through 1.57: an Engine that
//        cannot read these refuses the whole ruleset or catalog file, so a package that ships any of
//        them declares 1.58. No permission.
// 1.59: an item may be `use`d in a fight (a heal, an attack, a buff or a debuff, on a budget or
//        free, that is used up or spends the item's `charges`), and a ruleset fight writes what it
//        used up and the charges left to the inventory. Not a soft seam, for the same reason as 1.20
//        through 1.58: an Engine that cannot read these refuses the whole ruleset or catalog file, so
//        a package that ships any of them declares 1.59. No permission.
// 1.60: an item's `use` may `restore` a pool, and an item is used outside a fight too (the Use
//        button and the Game Master's `[inventory: action="use"]`). Not a soft seam, for the same
//        reason as 1.20 through 1.59: an Engine that cannot read `restore` refuses the whole ruleset
//        or catalog file, so a package that ships it declares 1.60. No permission.
// 1.61: an item's `charges` may `recharge` on the ruleset's rests (all of them, or an amount) and may
//        break when a use spends the last one (`breaksOn`), and a rest writes the charges it brings
//        back to the inventory. Not a soft seam, for the same reason as 1.20 through 1.60: an Engine
//        that cannot read these refuses the whole ruleset or catalog file, so a package that ships
//        either declares 1.61. No permission.
// 1.62: an item's `use` may have a `gate`, a check its user passes before it works unless a value
//        on their sheet is high enough; a failed check uses the item up for nothing. Not a soft seam,
//        for the same reason as 1.20 through 1.61: an Engine that cannot read `gate` refuses the whole
//        ruleset or catalog file, so a package that ships it declares 1.62. No permission.
// 1.63: the items block may declare `lootTables`, and a bestiary creature may name the `loot` table a
//        won fight rolls for it; a ruleset with loot tables drops its own items instead of Game Mode's
//        native loot. Not a soft seam, for the same reason as 1.20 through 1.62: an Engine that cannot
//        read these refuses the whole ruleset or catalog file, so a package that ships either declares
//        1.63. No permission.
// 1.64: a layer may take coins out of the ruleset's currencies (`currencies.removeUnits` and
//        `removeFamilies`), and a loot line may drop coins (`coins`); coins are held as inventory stacks
//        (`coin:<unit>`) that the Game Master pays and earns with. Not a soft seam, for the same reason as
//        1.20 through 1.63: an Engine that cannot read these refuses the whole ruleset file, so a package
//        that ships either declares 1.64. No permission.
// 1.65: the items block may declare a `market` (price levels, place sizes, what each place sells, and
//        kinds of seller), and an item may name the smallest place that sells it (`sold`) or be a
//        `service`, bought and never carried; the Game Master buys with `[inventory: action="buy"]` and
//        says where the party is with `[place:]`. Not a soft seam, for the same reason as 1.20 through
//        1.64: an Engine that cannot read these refuses the whole ruleset or catalog file, so a package
//        that ships any of them declares 1.65. No permission.
// 1.66: `api.registerSceneOrigin` lets a package thread (a direct-message thread, for example) be the
//        origin of a roleplay scene, the way a Conversation is: the package supplies the planning
//        context, holds the lock while the scene runs and receives the recap when it ends. The browser
//        view gets `startScene`, `openChat`, `focusSceneOriginId` and `onFocusSceneOriginHandled`. Requires
//        the `scenes` permission.
// 1.67: the browser view gets `openCharacter(characterId, { tab })`, which opens the character editor,
//        on that tab when given. Soft seam: a package checks that the function exists, so it does not
//        need to declare 1.67. No permission.
// 1.68: `embeddings.embed(texts, signal, inputType)` takes `"query"` or `"document"` (the default), so a
//        model with query and document prefixes embeds a search query as a query. Soft seam: an older
//        Engine ignores the third argument, so a package does not need to declare 1.68. No permission.
// 1.69: a market day: a place size may carry a daily `purse`, the market a `buyBack` share, a seller a
//        `stock` loot table rolled each day, and a `sold` rule or an item's `sold` a `limited` count kept
//        on hand (a rule or an item's `sold` may now name a limit without a place); the Game Master
//        sells with `[inventory: action="sell"]` and starts a new day with `[place: day="new"]`. Not a
//        soft seam, for the same reason as 1.20 through 1.65: an Engine that cannot read these refuses
//        the whole ruleset or catalog file, so a package that ships any of them declares 1.69. No
//        permission.
// 1.70: a catalog entry's rider may name `weapons` by item tag, so it fires on a held weapon as it
//        does on an attack row (Sneak Attack with a rapier held from the bag). A new key on the strict
//        rider, so a package whose entries carry one declares 1.70.
// 1.71: `listMessages` records carry `agentContent` in Roleplay outside hosted rooms: the message as Engine
//        agents read it, with its whispers. Soft seam: a package reads `agentContent ?? content`, so it does not
//        need to declare 1.71. Requires `chat-read`, like `listMessages`.
// 1.72: an Experience may ship a map pack (`contributions.gameSurface.mapPack`, worldgen W9e): its
//        setting kit, ready-made worlds and tile pack as kit, world and tile pack share files among
//        its declared assets. A new game with the Experience on is locked to them.
// 1.73: the Engine hosts the 2D and 3D avatar agents (`2d-avatars`, `3d-avatars`, types/avatars.ts): it
//        owns their storage, import, lazy renderers, setup on the Agent editor page, stream director,
//        classifier and generation routes, and merges the 2D agent's `avatarGenerationTemplates`. No new
//        manifest field; an avatar package declares 1.73 so an Engine without these surfaces refuses it.
// 1.74: a ruleset's `combat.cover` may grade cover (`threeQuarters`), help saves (`saves`) and count
//        creatures in the way (`creatures`), and a save (an entry's, a creature action's or an item use's)
//        may ignore cover (`ignoresCover`); cover is read from the attacker's position by corner lines
//        (combat C6a-2). Not a soft seam, for the same reason as 1.20 through 1.72: an Engine that cannot
//        read these refuses the whole ruleset or catalog file, so a package that ships any of them
//        declares 1.74. No permission.
// 1.75: a ruleset's `combat.elevation` says what a board's height does in its fights: how high a level
//        is, what higher ground gives an attack and a shot, and what a fall does (combat C6b). Boards
//        may have height whatever a ruleset says. Not a soft seam, for the same reason as 1.20 through
//        1.74: an Engine that cannot read it refuses the whole ruleset file, so a package that ships it
//        declares 1.75. No permission.
// 1.76: a ruleset's conditions may change the action economy (combat C6d, as Haste and Slow do):
//        `budgets`, `grants`, `exclusive`, `attacksPerTurn` and `onEnd`, and a budget may have a count of
//        0 for one only a condition fills. Not a soft seam, for the same reason as 1.20 through 1.75: an
//        Engine that cannot read these refuses the whole ruleset file, so a package that ships any of
//        them declares 1.76. No permission.
// 1.77: a ruleset's `sheet.migrations` say how a sheet stored on an older layout reads on this one
//        (C6e-0): fields, abilities, skills and saves renamed, one field routed by another's text, and
//        a live pool or track routed to the one the migrated sheet shows. A rest's poolGroup restore
//        may also be `shared` (C6e): its fraction worked out on the whole group. Not a soft seam, for
//        the same reason as 1.20 through 1.76: an Engine that cannot read it refuses the whole ruleset
//        file, so a package that ships it declares 1.77. No permission.
// 1.78: a ruleset's `items.startingGear` (P1-6): gear a character may take into their bag at the start,
//        never on its own, with choices and lists to pick from. Not a soft seam, for the same reason as
//        1.20 through 1.77: an Engine that cannot read it refuses the whole ruleset file, so a package
//        that ships it declares 1.78. No permission.
// 1.79: seller honesty (P1-7): a catalog item may be `risky` (what an honest seller warns of) or a fake
//        that `passesFor` another item, and a market seller may be `honest: false`. A fake bought from
//        a dishonest seller is a stack that shows as what it passes for and keeps what it truly is.
//        Not a soft seam, for the same reason as 1.20 through 1.78: an Engine that cannot read these
//        refuses the whole ruleset or catalog file, so a package that ships any of them declares 1.79.
//        No permission.
// 1.80: an Experience's map pack may ship an image tile pack (tile pack v2, Pixelforge image tiles): PNG
//        sheets on a grid of cells, sprites of several cells. Not a soft seam: an Engine that cannot read
//        an image pack refuses the whole map pack, so a package whose map pack tiles are an image pack
//        declares 1.80. No permission.
// 1.81: a ruleset's `combat.attackRoll.criticalFrom`: the lowest natural face of the attack die that
//        is a critical, read off the attacker's sheet (5e's Champion). Not a soft seam, for the same
//        reason as 1.20 through 1.79: an Engine that cannot read it refuses the whole ruleset file, so
//        a package that ships it declares 1.81. No permission.
// 1.82: a derived value may `multiply` (a 5e hit point maximum's Constitution modifier times the
//        level). Not a soft seam, for the same reason. No permission.
// 1.83: a catalog entry's mechanics may `amountAdd` a value read off the user's sheet to its amount
//        (5e's Second Wind, 1d10 plus the fighter's level). Not a soft seam, for the same reason: an
//        Engine that cannot read it refuses the catalog. No permission.
// 1.84: a sheet may have up to 120 derived values (60 before). Not a soft seam: an Engine that cannot
//        read it refuses the whole ruleset file, so a package with more than 60 declares 1.84.
//        No permission.
// 1.85: a sheet list's number column may be filled by a `roll` (count, and sides as a number, another
//        column of the row, or a value off the sheet); the sheet editor rolls it with the Engine's own
//        dice. Not a soft seam: an Engine that cannot read it refuses the whole ruleset file, so a
//        package that ships it declares 1.85. No permission.
// 1.86: a sheet may declare a guided `builder` (steps that pick catalog entries, fill fields, set the
//        ability scores by point buy, an array, rolls or by hand, choose trained skills and saves, and
//        take starting gear), and a catalog entry may say what a pick through it `grants` (score
//        increases, training, field values). Not a soft seam: an Engine that cannot read either refuses
//        the ruleset file or the catalog, so a package that ships them declares 1.86. No permission.
// 1.87: a builder's abilities step may start on a `default` method, and a catalog step may offer only
//        entries up to a value read off the sheet (`upTo`, features up to the character's level). Not a
//        soft seam: an Engine that cannot read either refuses the ruleset file, so a package that ships
//        them declares 1.87. No permission.
// 1.88: a sheet may have up to 240 derived values (120 before). Not a soft seam: an Engine that cannot
//        read it refuses the whole ruleset file, so a package with more than 120 declares 1.88.
//        No permission.
// 1.89: a currency unit may name one of itself (`one: "penny"` beside `label: "pennies"`), said for an
//        amount of exactly one. Not a soft seam: an Engine that cannot read it refuses the ruleset
//        file, so a package that ships it declares 1.89. No permission.
// 1.90: a builder's catalog step may read how many entries it asks for and takes off the sheet
//        (`countFrom`, spells known at the character's level). Not a soft seam: an Engine that cannot
//        read it refuses the ruleset file, so a package that ships it declares 1.90. No permission.
// 1.91: a catalog entry may grant entries of another catalog to choose (`grants.entries.choose`, a
//        language of your choice), chosen at a builder `choices` step. Not a soft seam: an Engine that
//        cannot read either refuses the ruleset file or the catalog, so a package that ships them
//        declares 1.91. No permission.
// 1.92: a catalog entry may scale several rows of one list when each carries its own name in the
//        list's name column (two uses of one racial trait). Not a soft seam: an Engine that cannot read
//        it refuses the catalog, so a package that ships it declares 1.92. No permission.
// 1.93: a builder grant's score choice may name one score more than once (`abilities.choose[].repeat`,
//        an ability score improvement's +2 to one or +1 to two). Not a soft seam: an Engine that cannot
//        read it refuses the catalog, so a package that ships it declares 1.93. No permission.
// 1.94: a catalog entry may name an `exclusive` group: a builder step keeps one pick of a group, so a
//        feat can take an ability score improvement's place. Not a soft seam: an Engine that cannot
//        read it refuses the catalog, so a package that ships it declares 1.94. No permission.
// 1.95: an item's to-hit (a weapon's attack, an item's use) may add a number read off its holder's sheet
//        (`toHit.sheetBonus`, 5e's Archery: +2 to attacks with ranged weapons). Not a soft seam: an
//        Engine that cannot read it refuses the catalog, so a package that ships it declares 1.95. No
//        permission.
// 1.96: a builder grant's score choice may cap the scores it raises (`abilities.choose[].upTo`, an
//        ability score improvement's "not above 20"). Not a soft seam: an Engine that cannot read it
//        refuses the catalog, so a package that ships it declares 1.96. No permission.
// 1.97: a weapon's damage may add a number read off its holder's sheet, only while held in one hand
//        when it says `oneHanded` (`attack.damage.sheetBonus`), and `combat.offHand.fullWhen` keeps a
//        fighter's off hand on the full ability when their sheet says so. Not a soft seam: an Engine
//        that cannot read either refuses the ruleset or the catalog, so a package that ships them
//        declares 1.97. No permission.
// 1.98: a weapon's damage may reroll its low dice once, off its holder's sheet, while wielded
//        two-handed (`attack.damage.rerollUpTo`, 5e's Great Weapon Fighting). Not a soft seam: an Engine
//        that cannot read it refuses the catalog, so a package that ships it declares 1.98. No
//        permission.
// 1.99: a catalog entry may say when a builder step offers it (`offeredWhen`, a value off the sheet
//        above 0: a second class whose prerequisites are met). Not a soft seam: an Engine that cannot
//        read it refuses the catalog, so a package that ships it declares 1.99. No permission.
// 1.100: a catalog entry of an `exclusive` group is judged by its `offeredWhen` on the sheet without the
//        step's picks of that group, which picking it drops (a feat in place of an ability score
//        improvement is not offered on the score that improvement gave). Behaviour only, no new key: a
//        package that relies on it declares 1.100. No permission.
// 1.101: harm may name what it carries past a resistance's or an immunity's `except`, as a weapon
//        item's tags do: `qualities` on a catalog entry's mechanics (a spell) and on a creature
//        action's damage (a deva's mace), so "resistance to slashing from nonmagical attacks" is
//        `{ type, except: ["magical"] }` and a magical blow goes through it. Not a soft seam: an Engine
//        that cannot read it refuses the catalog, so a package that ships it declares 1.101. No
//        permission.
// 1.102: a creature action's damage may name `alternatives`, amounts it deals instead while something
//        holds (`twoHanded` unless the creature carries a `shield`, a new key on the creature too, or
//        `selfHealthAtMost` a share of its health), the first that holds winning: 5e's versatile
//        longsword on a stat block and a swarm at half its hit points. Not a soft seam: an Engine
//        that cannot read them refuses the catalog, so a package that ships them declares 1.102. No
//        permission.
// 1.103: combatants have a size. `combat.sizes` lists them smallest first (with a value off the sheet
//        and a default), a creature names its own `size`, and a contest's `maxSizeAbove` is not
//        taken against a target that many sizes larger or more (5e's grapple and shove, `1`). A
//        condition an action applies may name its `escapeDc`, which breaking free of it is rolled
//        against in place of the holder's side of the contest. Not a soft seam: an Engine that
//        cannot read them refuses the ruleset, so a package that ships them declares 1.103. No
//        permission.
// 1.104: a builder skill or save choice never offers what the picks already train to its tier or higher:
//        what an entry trains outright, or what an earlier choice holds. A stored choice of one counts for
//        nothing. Behaviour only, no new key. No permission.
// 1.105: a skill or save choice a catalog entry grants may build on training already held (`held`, a
//        tier: 5e's Expertise, two skills you are proficient in), offering only what the picks or a
//        lower choice train to it. Not a soft seam: a package that ships it declares 1.105. No permission.
// 1.106: an entry a builder choice offers (`grants.entries.choose`) is held to its `offeredWhen` on the
//        sheet, as a step's options are. Behaviour only, no new key: a package that relies on it
//        declares 1.106. No permission.
// 1.107: a builder fields step may show fields only while the sheet allows (`shownWhen`), and hold
//        number fields to a combined maximum (`total`). Not a soft seam: an Engine that cannot read
//        it refuses the file, so a package that ships it declares 1.107. No permission.
// 1.108: a builder catalog step stamps columns onto its added rows (`stamp`), and a combat ability
//        source reads spellcasting references by a row's column (`byColumn`). Not a soft seam: an
//        older Engine refuses either key, so a package that ships it declares 1.108. No permission.
// 1.109: a builder starting-gear step may hold its gear to what the sheet fits (`strict`) in legal-only
//        mode. Free edit still offers every gear. Not a soft seam: an older Engine refuses the key,
//        so a package that ships it declares 1.109. No permission.
// 1.110: a builder catalog step may ask for or take up to 40 entries, and `methods.manual` may bound
//        typed base scores with `{ min, max }`. Not a soft seam: an older Engine refuses the ruleset,
//        so a package with more than 20 picks or bounded manual scores declares 1.110. No permission.
// 1.111: a sheet may have up to 400 derived values. Not a soft seam: an older Engine refuses more
//        than 240, so a package that ships more declares 1.111. No permission.
// 1.112: a guided builder may have up to 24 steps. Not a soft seam: an older Engine refuses more
//        than 16, so a package that ships more declares 1.112. No permission.
// 1.113: combatants move other ways than walking. A creature's `speeds` (fly, swim, climb, burrow)
//        and `hover`, and a sheet's `combat.economy.movementModes`, read as the fight begins. On a
//        board a flier crosses water and steps of any height, a swimmer crosses water, a climber
//        takes steps of any height, and a burrower moves as a walk; every cell moved comes off every
//        way at once. Not a soft seam: an Engine that cannot read the keys refuses the ruleset, so a
//        package that ships them declares 1.113. No permission.
// 1.114: a flier goes up and down. On a board whose ruleset gives `combat.elevation.levelHeight`,
//        a combatant with a fly speed may fly up or down a level where it stands for a level's
//        worth of its flight; reach, high ground and opportunity strikes count the height between
//        two combatants, and a flier knocked down, prone or out of speed falls unless it hovers. No
//        new key, so a soft seam: an Engine before it keeps fliers on the ground. A package that
//        relies on it declares 1.114. No permission.
// 1.115: a level says what 5e's exhaustion does at its worst. A modifier may halve the health
//        maximum (`{ "to": "health-max", "times": 0.5 }`), and a level that `defeats` takes its holder
//        out of the fight as it begins. A combatant without a sheet carries live tracks too (`tracks`
//        on a proposed creature or a bestiary combatant), and a creature's `conditionImmunities` may
//        name a track some level reads, whose levels it then never suffers. Not a soft seam: an Engine
//        that cannot read the target, the key or the immunity refuses the ruleset, so a package that
//        ships them declares 1.115. No permission.
// 1.116: an answer that cancels may stop only what was paid no higher than itself. A reaction's
//        `upTo: "paid"` compares the level of what it answers with its own, each the level of the
//        pool paid from (a pool's new `level`, read off its holder's sheet, or its place in its
//        group, the first being 1; nothing paid is 0), and `above: { check, dc }` is the check that
//        stops something higher, against `dc` plus its level: 5e's Counterspell. Not a soft seam: an
//        Engine that cannot read the keys refuses the ruleset, so a package that ships them declares
//        1.116. No permission.
// 1.117: answers to a named entry. A reaction's `against` may name `entries` (`<catalog>/<entry>`)
//        beside catalogs, `also` takes it at up to three more moments with their own `against`, and a
//        condition's `noDamageFrom` keeps those entries' harm off its holder: 5e's Shield, taken when
//        an attack hits and when Magic Missile is aimed at its caster, under which Magic Missile does
//        nothing. Not a soft seam: an Engine that cannot read the keys refuses the ruleset, so a
//        package that ships them declares 1.117. No permission.
// 1.118: a reaction's moment may say `blow: "melee" | "ranged"` (only on "hit": a blow is melee
//        while its target stands in its reach, and a weapon with no range always is) and
//        `seesSource: true` (only while its holder sees whoever caused it: a line of sight on the
//        board, never somebody who has hidden). 5e's Parry is both. Not a soft seam: an Engine that
//        cannot read the keys refuses the ruleset, so a package that ships them declares 1.118. No
//        permission.
// 1.119: a condition's duration may say `of: "source"`: its rounds count the turns of whoever put
//        it on, from their next one, and its holder's again once they have left the fight. 5e's
//        Guiding Bolt ("before the end of your next turn"). Not a soft seam: an Engine that cannot
//        read the key refuses the ruleset, so a package that ships it declares 1.119. No permission.
// 1.120: a combat condition's `delays: { catalogs, budget, chance: { sides, atLeast } }` holds what
//        its holder uses out of those catalogs with that budget over to their next turn when the die
//        shows `atLeast` or more; it is completed there with the same budget, or lost. 5e's Slow.
//        Not a soft seam: an Engine that cannot read the key refuses the ruleset, so a package that
//        ships it declares 1.120. No permission.
// 1.121: a creature action's `heal: { dice, flat }` gives hit points back to its targets, capped at
//        their maximum; `targets: "ally" | "any"` says whose side it may reach. 5e's Healing Touch.
//        Not a soft seam: an Engine that cannot read the keys refuses the ruleset, so a package that
//        ships them declares 1.121. No permission.
// 1.122: an attack entry's `summons` leaves a weapon that strikes on its holder's later turns for
//        its own budget, keeping the cast's payment level. It ends after its rounds, on defeat,
//        or with the concentration that holds it. A package that ships it declares 1.122. No permission.
// 1.123: a creature's `spellcasting` casts catalog spells without slots, at will or with limited
//        uses. Coven spells need nearby members and share their uses. No permission.
// 1.124: a reaction on `falls` answers a fall before it lands. A condition's `fallsSafely` keeps its
//        holder from taking falling damage or being left prone. 5e's Feather Fall. No permission.
// 1.125: a condition can end on damage or harm from its source's side, repeat its ending save when
//        damaged, or let a nearby ally spend a budget to shake its holder out. No permission.
// 1.126: a rider can need an adjacent ally without disadvantage on the final attack roll, as 5e's
//        Sneak Attack does when the roll has no advantage. No permission.
// 1.127: conditions can take away senses an effect needs, as Deafened keeps Command from affecting
//        its holder. The ruleset names the senses; targets without them are skipped. No permission.
// 1.128: a line area's `width` says how wide it is in the same unit as its size, on a catalog entry
//        or a creature action. Without it the line stays one cell wide. No permission.
// 1.129: an applies' `saveEnds.at: "damaged"` rolls only when its holder takes damage above zero,
//        once per blow, at the stored DC. 5e's Dominate Person. No permission.
// 1.130: a builder step's stamp can read the first offering parent pick's id, label or filter through
//        `fromWithin`, so a spell names the class that offered it. Later edits remain the player's. No permission.
// 1.131: reactions answer for nearby allies, at a turn's start, on a successful holder save, or for
//        several fallers of one event. An answer may land on the target, last this action, and name a
//        stat-block action in against.actions. No permission.
// 1.132: conditions, levels and sheet lists keep typed harm and conditions off; item hides name
//        exception tags, as creatures do. A package that ships these declares 1.132. No permission.
// 1.133: condition, level and item modifiers change damage dealt or taken on attack hits, narrowed
//        by attack kind, blow or ability, with typed additions and source-bound damage taken. No permission.
// 1.134: save modifiers can count only against conditions, damage types or magic, together with
//        the saves they name: Dwarven Resilience, Fey Ancestry and Gnome Cunning. No permission.
// 1.135: outcome bands on a check. `resolution.outcomes` names labelled bands a check lands in,
//        read from its margin or its total, best first, each a success or not and critical or not;
//        `naturals: "shift"` moves a single die's highest face one band better and its lowest one
//        worse. The record carries `outcome="..."`. Not a soft seam: an Engine that cannot read the
//        key refuses the ruleset, so a package that ships it declares 1.135. No permission.
// 1.136: custom faces, open-ended rolls and unmodified faces on a summed check. `resolution.dice.faces`
//        gives each face its worth (Fate's -1, 0, +1); `resolution.openEnded` rolls a single die again
//        and adds on `high` or more, and again and takes away on `low` or less, chained on high;
//        `resolution.unmodified` names faces the record marks as `unmodified="N"`. Not a soft seam: an
//        Engine that cannot read the keys refuses the ruleset, so a package that ships them declares 1.136.
//        No permission.
// 1.137: a dice pool reads its per-die target off the sheet (`resolution.target.from`), counts
//        dice under or over it by stance (`resolution.stances`), and counts and flags a die on the target
//        exactly (`resolution.exact`), for Lasers & Feelings. An Engine that cannot read the keys refuses
//        the ruleset, so a package that ships them declares 1.137. No permission.
// 1.138: a third resolution kind, `dice-highest`: throw as many dice as the sheet says and read the
//        highest (or add the `keep` highest), with a zero-dice rule, a critical on several top faces and
//        dark dice the Game Master adds (`dark=`), for Blades in the Dark and Trophy Dark. An Engine that
//        cannot read the kind refuses the ruleset, so a package that ships it declares 1.138. No permission.
// 1.139: a fourth resolution kind, `roll-against`: roll the dice at most (or at least) the sheet's
//        number, with ladder steps that divide or move it, critical rules on faces or on how far a roll
//        missed, bonus and penalty tens dice on a d100, and outcome bands read as a fraction of the target,
//        for Call of Cthulhu, GURPS and old-school percentages. An Engine that cannot read the kind refuses
//        the ruleset, so a package that ships it declares 1.139. No permission.
// 1.140: `resolution.overrides`: skills, saves and abilities that roll with other keys of the
//        resolution (`set`, `null` takes one away), always or only where the roller's sheet meets `when`.
//        An old-school game's d100 thief skills and X-in-6 doors, exwod's 1s that do not cancel. An Engine
//        that cannot read the key refuses the ruleset, so a package that ships it declares 1.140. No permission.
// 1.141: a fifth resolution kind, `symbol-pool`: character and opposing narrative dice, upgrades,
//        cancelling symbols and independent triumph/despair markers. An Engine that cannot read
//        the kind refuses it, so a package that ships it declares 1.141. No permission.
// 1.142: `sheet.advancement`: fields, abilities and tiers the Game Master may change with `advance`.
//        An older Engine refuses the sheet key, so a package that ships it declares 1.142. No permission.
// 1.143: `clocks`: party/scene progress clocks created, ticked and cleared by the Game Master.
//        An older Engine refuses the top-level key, so a package that ships it declares 1.143. No permission.
// 1.144: `party`: a shared sheet with live pools and permanent field advancement. No permission.
// 1.145: `gmReference`: the ruleset's full GM rules reference in the cached system prompt.
//        An older Engine refuses the key, so a package that ships it declares 1.145. No permission.
// 1.146: `combat.damage.minimum` and `item.attack.damage.minimum`: minimum damage dice after soak. No permission.
// 1.147: `combat.daze`: one hit above the target's value skips their next turn. No permission.
// 1.148: `combat.damageKinds.remap`: target values and weapon tags remap wound kinds before soak. No permission.
// 1.149: `dice-highest.dark.outcome`: light-only outcomes with dark dice still rolled and flagged.
// 1.150: symbol-pool `setback=` and opt-in `allowOwnUpgrade` / `upgradeOwn=` character upgrades.
// 1.151: guided builder counted choices, quotas, exclusions, replacement training and conditional steps.
// 1.152: guided builder rating stages, priority groups, explicit tier maps and free rating grants.
// 1.153: guided builder shared formula budgets, original-price purchases and capped trait credits.
// 1.154: guided builder named rows the player adds, edits and removes on a sheet list.
// 1.155: guided builder offer eligibility, sheet-read and discrete bounds, replacement pools and creation rules.
// 1.156: worked-out ability scores, and rows or entries the Game Master applies to one roll with apply=.
// 1.157: starting coins rolled when taken or read off the holder's sheet.
// 1.158: builder initialize steps that write starting values once, and pools or tracks that start at a sheet value.
// 1.159: builder picks and rows paid out of a shared pool, and rows copied from a catalog.
// 1.160: creation profiles with their own steps and budgets, and steps that read the sheet before a step.
// 1.161: list rows that are checks of their own, such as Science (Physics), one or more stances each.
// 1.162: scores rolled in order with their own dice, and creation rolls kept with their dice.
// 1.163: the party's shared sheet set up through its own builder and lists, saved on a revision, with
// fields read off the party's characters.
// 1.164: spend offers raised and lowered from one start, levels owned under a better value, and
// closed creation trades out of one rating into another.
// 1.165: a sheet list may have up to 24 columns. Not a soft seam: an older Engine refuses the
//        ruleset, so a package with a list of more than 12 columns declares 1.165. No permission.
// 1.166: a catalog entry's mechanics may be usable in a fight only while a value off its holder's
//        sheet, live state and items stands within bounds (`usableWhen`): 5e's Protection needs a
//        shield. Not a soft seam: an older Engine refuses the key. No permission.
// 1.167: a condition a catalog entry or item use applies may go on only while a value off its
//        applier's sheet stands within bounds (`applies[].when`), read as it applies: 5e's Rage
//        damage by barbarian level. Not a soft seam: an older Engine refuses the key. No permission.
// 1.168: creature types and tags (`combat.creatureTypes`, a creature's `type` and `tags`, a
//        character's type off a field or a default), and target tests that read them: a damage
//        clause's or an applied condition's `targetIs`, and `mechanics.targetTypes` (is/not) for who
//        may be picked or caught. 5e's slayer weapons, holy water, Animal Friendship. No permission.
// 1.169: a weapon item's attack deals extra damage clauses (`attack.plus`: typed, with their own
//        save, a target test, or only on a critical hit), and what its hit puts on may be resisted
//        by a save (`onHit[].save`) or last until one (`onHit[].saveEnds`): 5e's dragon slayer,
//        javelin of lightning, sword of sharpness and sword of wounding. No permission.
// 1.170: an item may carry a switch (`toggle`: a label and the budget a fight turns it with), kept
//        on its stack between fights, and a weapon's extra damage clause may be dealt only while the
//        switch is on (`attack.plus[].when: "toggled"`): 5e's flame tongue. No permission.
// 1.171: a live pool may pay for the costs of other groups at its own level (`pays`), and a
//        catalog entry may take more targets for each step of a higher cost (`targetsPerCostStep`):
//        5e's pact slots paying for spell-slot spells, and Hold Person. A use whose own pool is empty
//        is offered paid from a higher one. No permission.
// 1.172: an area may stay (`mechanics.zone`): for rounds of its caster's turns or its
//        concentration, held where it was aimed or around its caster, doing the entry's effect
//        again to whoever moves into it or starts or ends a turn in it, once a turn. Drawn on the
//        board and listed beside it. 5e's Cloudkill, Spirit Guardians and Moonbeam. No permission.
// 1.173: a zone held at a point may be moved by its caster for a budget (`zone.move`) or drift away
//        from them as their turns start (`zone.drift`), catching whoever it reaches; and its ground
//        may be hard going (`zone.terrain.difficult`) or hurt for every distance moved inside
//        (`zone.terrain.perDistance`). 5e's Moonbeam, Cloudkill and Spike Growth. No permission.
// 1.174: an applied condition's `escapeDc` may be `"save"`, the save difficulty of whatever applied
//        it (Web, Black Tentacles); a zone may make whoever it catches while concentrating save or
//        lose it (`zone.breaksConcentration`, Sleet Storm) and end once it has dealt `zone.damageCap`
//        in all (Guardian of Faith); and an item's use may concentrate and leave a zone, as a spell
//        scroll's spell does. No permission.
// 1.175: a zone its caster moves may ram (`zone.move.ram`): it stops on the first creature it
//        reaches, catches them, and moves no more that turn (Flaming Sphere); and its ground may cost
//        several plain steps (`zone.terrain.costTimes`, Plant Growth) or halve speed on top of any
//        hard going (`zone.terrain.halvesSpeed`, Spirit Guardians). A breaking-free contest may be
//        offered only against a hold with an escape DC (`from.escapable`), a hold may name the
//        checks that break it (`applies[].escapeChecks`), and a zone may hurt whoever starts a turn
//        in it already held by it, with no save (`zone.whileHeld`): Web, Black Tentacles, and no
//        escape from petrification. No permission.
// 1.176: a catalog entry or item use may cure: end named conditions on its target (`ends`, up to
//        `count` of them, Lesser Restoration), steady a dying target (`stabilizes`, Spare the
//        Dying), or bring back one that died no more than `revives.withinRounds` rounds ago at
//        `revives.health` (Revivify). No permission.
// 1.177: an area may be a `box`, a square of its size a side set down against the cell aimed at and
//        reaching away from its maker (5e's cubes: Web, Grease, Entangle, Black Tentacles), and a
//        lasting one may be a `wall`, its size long and `width` thick, run through the aimed cell
//        (or toward the choice's `toward`), or laid as a ring of its `ring` diameter when the choice
//        says `ring`; it needs no trigger. A wall's zone may block
//        movement, sight or both (`zone.blocks`: Wall of Stone, Wall of Force, Wall of Fire's
//        opaque face), shoving whoever stands where it goes up, and may catch on one side
//        (`zone.side`, the choice's `side` near or far: Wall of Fire). No permission.
// 1.178: seeing. `combat.senses` names senses (darkvision, blindsight, truesight; `blind` ones work
//        without eyes) whose range a character reads off its sheet and a creature carries in its
//        `senses`. A zone may obscure (`zone.obscures`, pierced by the senses it names, in range:
//        Fog Cloud, Darkness), a condition may hide its holder the same way (`unseen`: invisible),
//        and `combat.sight` may make not seeing count in attacks (`unseenAttacks`) and name the
//        sense that is eyes (`eyes`). `mechanics.seen` takes only targets its maker can see. A burst
//        or box may be set down several times at once (`area.copies`, the choice's `also`), each
//        touching another (Fire Storm). No permission.
// 1.179: `combat.components` names what using something may need (verbal, somatic), and an entry or
//        creature action lists its `components`. A zone may put conditions on and keep damage types
//        off whoever stands in it (`zone.inside`: Silence deafens and keeps thunder out), stop what
//        needs a component from inside it (`zone.forbids`, as a condition's `forbids` does: no
//        verbal spells), and ward whoever is inside from entries off its `catalogs` at `maxLevel`
//        or lower used from outside (`zone.wards`: Globe of Invulnerability). A condition that takes
//        budgets away, put on during its holder's own turn, takes them from that turn (Stinking
//        Cloud). No permission.
// 1.180: an applied condition may end once its holder attacks or casts from named catalogs
//        (`endsWhenHolder`: Invisibility), an item's use may say it casts from one (`use.casts`: a
//        scroll), a condition or a worn or carried item may give senses with a range (`senses`:
//        Darkvision, True Seeing, goggles of night), and a condition may give away its holder
//        whatever hides them (`cancelsUnseen`: Faerie Fire). No permission.
// 1.181: a zone's `wards` may compare a spell's base level (`by: "base"`) and keep out more for each
//        step its own cast was paid up (`maxLevelPerCostStep`: Globe of Invulnerability). A save may
//        say what else it is against (`save.against`: poison) and who succeeds outright
//        (`save.succeeds`: immune to poison, or a creature that does not breathe: Stinking Cloud).
//        A creature's spellcasting may say the components its spells need (`components`, `[]` for
//        none), and an item's use may be `utility`, leaving only an area (a scroll of Fog Cloud). No
//        permission.
// 1.182: a sense a condition or an item gives may add to the holder's own (`{ add }`), an action may
// `push` whoever it lands on away from its maker, a line or cone may move with its caster and be
// turned (`zone.turn`), and a zone's hard going may count only toward its caster (`towardCaster`).
// 1.183: a zone may go off later (`detonates`, growing each turn and set off when touched) and burn
// away when damage of a type it names reaches it (`burns`).
// 1.184: a creature's action may `push` (on a failed save when it has one), and an item's use may
// give its line a `width`.
// 1.185: a save may roll twice by what its target is (`save.modes`), damage may be at its most against
// a kind (`maxAgainst`), `targetTypes` may bound ability scores and condition immunities, and
// condition modifiers roll attacks twice (`attacks`, `attacks-taken` with `from`, `atSource`) or
// narrow saves to what a kind of creature does (`against.from`).
// 1.186: a creature's actions may recharge together (`recharge.group`), and a blow may `charge`:
// more damage, a save, a push and conditions after a straight run at its target this turn.
// 1.187: an item's attack may add to hit by what it hits (`against`) and `slay`, and its `plus`
// clauses may skip some targets (`not`), count only in reach or thrown (`blow`) and drain (`tempHp`);
// its `onHit` conditions may need a target that is something and land once a turn.
// 1.188: a sheet, a rest and a fight may name up to 160 conditions, an attacks modifier may take
// `ability`, and a checks modifier may take `abilities`.
// 1.189: a condition may harm its holder each turn (`harms`), stack (`stacks`) and keep to one holder
// per source (`onePerSource`); an item attack's `against` may name a `marked` target, a `mode`, and
// ignore cover and long range, and its `plus` clauses may be `marked`; a creature action may name
// the `ability` its attack is made with.
// 1.190: an item attack's mode may carry its own `range`, `plus` clauses, a `line` that everybody
// between the wielder and the target saves against, and `charges` it spends of the item.
// 1.191: a combat condition effect "cannot-heal" keeps every heal off its holder; a combat condition's
//        `conditionImmunitiesFrom` keeps conditions off only when a creature that is `from` puts them
//        on; `targetTypes.abilityAtLeast` floors a target's ability scores; and a saves modifier's
//        `against.actions` narrows it to named actions, AND whatever else it names.
// 1.192: an item attack's `ignoresResistance` (a vorpal sword), a slay's `saved` conditions on a made
//        save (a mace of disruption), and `othersWhileMarked` (an oathbow's other weapons). Off a
//        board, an area names either side unless it spares its own (no key: a behavior change).
// 1.193: a contest's `difficulty` (rolled against a fixed number, no defender), `targets`,
//        `targetHolds`, `targetDying` and `onWin.stabilizes` (5e's Medicine checks), and an item
//        attack's and a condition's `harms.healedOnlyByRest` (a sword of wounding: hit points they
//        take come back only by rest).
// 1.194: a size's `cells` in `combat.sizes.order`: a creature of that size fills that many cells a
//        side on a board, for placement, movement, reach, areas, cover and sight.
// 1.195: a combat condition's `size.steps`: its holder is that many sizes bigger or smaller while it
//        holds (5e's Enlarge/Reduce), filling its new size on a board where there is room.
// 1.196: catalog mechanics' `healthPool` (shared out least health first: Sleep, Color Spray),
//        `healthAtMost` (Power Word Stun) and `kills` (Power Word Kill).
// 1.197: a damage modifier's `diceTimes` (a blow's own dice that many times over: an enlarged
//        duergar), and a creature's `self` action taken on its turn landing on itself.
// 1.198: a catalog zone's `damageType`, dealt at its triggers in place of the entry's own (5e's
//        Wall of Thorns: piercing as it appears, slashing to whoever moves into it).
// 1.199: catalog mechanics' `healthPoolSkips` (whom a health pool passes over: holders of its
//        `conditions`, as Sleep the unconscious, and with `unseeing` those who can't see its maker).
// 1.200: a wall zone's `sections` (struck at like creatures with their own defense and health, and
//        broken apart, a broken one leaving what its `broken` says: 5e's Wall of Ice), and a
//        choice's `wall` cell, which an attack option's `walls` offers.
// 1.201: catalog mechanics' `tracks` (live tracks moved by levels on whoever it lands on: 5e's
//        Greater Restoration takes exhaustion off, Sickening Radiance adds it) and `unseals` (the
//        health only a rest gives back, given back), and a wall section's `broken.perCostStep`.
// 1.202: an applied condition's `endsWith` (it ends whenever another condition put on with it by
//        the same use ends: 5e's Hypnotic Pattern's incapacitation goes with its charm).
// 1.203: a creature action's `reducesMax` (a failed save lowers the health maximum by the damage
//        taken until a rest, or with `lasting` until something unseals it; at 0 the target dies:
//        Life Drain, a clay golem's Slam), and a live pool's `lasting`.
// 1.204: catalog mechanics' `cureOneOf` (one of its `ends` conditions, `tracks` or `unseals`, picked
//        as a mode of the option, else the first the target needs: 5e's Greater Restoration).
// 1.205: list sums that count rows, or read only the rows whose cell equals a value.
// 1.206: row prices scaled, offset, or overridden by a derived value the row's cell names.
// 1.207: spend offers whose price the source has not supplied yet.
// 1.208: up to 240 sheet fields (160 before it).
// 1.209: a creation roll may be written to an ability score; an improvement check adds as an increase.
// 1.210: a number list column may be worked out from other columns of its row (`sum`).
// 1.211: a score choice may give partial increases past a mark (`partialFrom`); two make one.
// 1.212: a list's row checks may sit in a resolution stance.
// 1.213: a row applied by name may name an ability in its skill cell (`contextual.abilities`).
// 1.214: a contextual check effect may switch off cancelling faces (`cancel: false`).
// 1.215: a catalog pick may open items without carrying them (`grants.itemAccess`).
// 1.216: allocation groups count list rows' dots, and a row price override may set a per-dot rate.
// 1.217: a contextual check effect may take the best skill rating (`best: true`), also on dice-highest.
// 1.218: contextual costs may mark a live track, and a list's contextual rows may cost.
// 1.219: sheet advancement may list up to 64 fields (was 24).
// 1.220: a catalog may borrow another installed ruleset's catalog (`from`), read against this one,
//        with its own entries beside it adding or replacing; a borrowed creature's art matches as the
//        lender's. A D&D 5e ruleset may fight the SRD bestiary of the Engine's 5e. No permission.
// 1.221-1.234: reserved.
// 1.235: `reducesMax` with no save of its own (every blow that lands), `onFailedSave` (the entry's
//        own failed save), `damageType` and `heals` (its maker regains what it lowered), on catalog
//        mechanics too; catalog `leavesAtLeast` (5e's Harm); `targetHolds` on a creature action or
//        catalog mechanics (a vampire's Bite: grappled by it, incapacitated or restrained).
// 1.236: a combat condition's `actions` (catalog entries its holder may use while it holds) and
//        catalog mechanics' `endsCondition` (used, it ends that condition on its user, with its
//        concentration); `ends.from` (only what a creature of those types or tags put on); and
//        `dismisses` (out of the fight for good, or while a condition holds, back when it ends:
//        5e's Dispel Evil and Good, Banishment).
// 1.237: surprise. A fight's `surprised` combatants take no move and no action on their first turn and
//        no reaction until it ends; a combat condition's `cannotBeSurprised` (5e's Foresight); catalog
//        mechanics' `ignoresSurpriseWith` (taking that entry first shakes it off: Feral Instinct).
// 1.238: catalog mechanics' `extraFirstTurn` (a second turn in a fight's first round at the holder's
//        initiative plus its number, unless surprised if it says so: 5e's Thief's Reflexes).
// 1.239: a combat condition's `grants.melee` (its granted strike only with a weapon in reach) and
//        `onEnd.tracks` (tracks moved as it ends): 5e's Frenzy, and its exhaustion; catalog mechanics'
//        `usesOf` (spends another row's uses by name: Frenzied Rage spends a Rage).
// 1.240: initiative thrown twice: `combat.initiative.checkAbility` (initiative is a check with that
//        ability, so what rolls such checks twice rolls it twice: Foresight, Cat's Grace) and catalog
//        mechanics' `initiativeMode` (Feral Instinct).
// 1.241: a "hit" reaction's `by: "self"` (its holder's own attack hitting, aimed at whoever it hit)
//        and `weapon` (a weapon's blow only); catalog mechanics' `addsToBlow` (its amount joins that
//        blow, doubled by its critical: Divine Smite) and `perCostStepsMax` (to 5d8 at most).
// 1.242: catalog mechanics' `attackRows` (held, it changes the attack rows it names: the better of
//        their ability and its own, a die in place of theirs where better, qualities: 5e's Martial
//        Arts and Ki-Empowered Strikes), `grantsStrike` (held, a strike bought with another budget)
//        and `afterAttack` (only once the attack action was taken this turn: Flurry of Blows); a
//        condition grant's `names` and `afterAttack`.
// 1.243: an opportunity attack's hit is held for answers as any other hit is (smite or stun it), the
//        walk's window asked on once it lands; a walker held still on the way goes no further.
// 1.244: `combat.attacks[].always` (rows every sheet has: 5e's unarmed strike); an `attackRows` rule's
//        `items` (held weapons by tags, or by name with `names`, which a rule may now leave out) and
//        `wielding.only` (kept only while every weapon held is one of these); `grantsStrike`'s `when`
//        and `wielding`.
// 1.245: catalog mechanics' `usesSpent` (several uses at once: Quivering Palm's 3 ki) and
//        `dropsOnFailedSave` (a failed save drops to 0 health); a "hit" reaction's `names` (only a hit by
//        those attacks); a condition's `onEnd.harm` (damage as it ends from whoever put it on, `unless`
//        its holder is that: Hurl Through Hell).
// 1.246: `afterAttack`'s `items` (the attack action taken with a held weapon matched by tags, as an
//        `attackRows` rule's `items` matches it: a dagger +1 is a monk weapon).
// 1.247: catalog mechanics' `beforeAttack` (only before the holder's first attack of their turn:
//        Reckless Attack); `attacks` and `blow` narrow a change to attacks too; a damage change's
//        `criticalDice` (more of the blow's own dice on a critical only: Brutal Critical).
// 1.248: a hit moment's `budget` (only a strike paid for from it) and a reaction's `oneOf` (one of
//        its holder's answers sharing the name per hit): Open Hand Technique on Flurry of Blows.
// 1.249: a change's `rescue` (held back until the holder's own attack, save or check falls short:
//        Bardic Inspiration, Guidance, Resistance) and catalog mechanics' `rescue` (spent on a
//        failed roll to roll a save again or succeed: Indomitable, Diamond Soul, Stroke of Luck).
// 1.250: catalog mechanics' `lowersRoll` (dice off somebody else's attack roll that hit: Cutting
//        Words) and a condition's or level's `evasion` (nothing on a made half save: Evasion).
// 1.251: catalog mechanics' `usesChosen` (a heal its user spends as many uses of as they choose,
//        the option's `amount` and the choice's `amount`: Lay on Hands).
// 1.252: catalog mechanics' `restore` (gives back to a pool, more for each step of a higher cost,
//        `overMax` past its maximum until a rest) and a live pool's stored `above`: Font of Magic.
// 1.253: catalog mechanics' `alters` and `usesSpentByLevel` (an entry chosen with another one, which
//        changes how it is used: Metamagic), the option's `alters` and `alterNeeded`, the choice's
//        `alters`, and the `altered` event.
// 1.254: Empowered rerolls the lowest of all a blow's damage dice (its clauses' and a critical's
//        too); the alter offer's `spares` and the choice's `spares` (who Careful Spell spares).
// 1.255: catalog mechanics' `halfOnMiss` (a miss deals half: Acid Arrow), an applied condition's
//        `harmsPerCostStep` (its harm grows with the cost it was put on at), and the alter offer's
//        `heightens` with the choice's `heightens` (who Heightened Spell picks).
// 1.256: catalog mechanics' `rescue` by `twenty` (Stroke of Luck on a check) and by `die` with
//        `dice` or `die` (a holder's own die: Peerless Skill, Dark One's Own Luck), `notSelf`, and a
//        combat condition's `oneAtATime`; the condition event's `already`.
// 1.257: `lowersRoll.also` (Cutting Words off ability checks and damage rolls), a rescue's `saves`
//        and `budget` (a ring of evasion), `halfOnMiss` on an item's use, and the lowered event's
//        `roll`.
// 1.258: a combat condition's `kinds`, which a cure's `ends` and an immunity may name, and
//        `saveEnds.successes` and `saveEnds.failures` (Contagion); the condition event's `worsened`.
// 1.259: `rescue` on an item's use (a ring of evasion), spending the item's own charges.
// 1.260: a combat condition's `onRest` lowering a maximum on a rest (Mummy Rot), after a save if it
//        has one (an otyugh's disease, cured on a success), and counted saves
//        rolled out when a fight ends.
// 1.261: a combat condition's `onDamaged`, `expires.becomes` and `curedOnlyBy`; `onRest.restoredWhenCured`;
//        the `cannot-heal-nonmagical` effect and a restore op's `magical`; `ends` on a stat block's
//        action.
// 1.262: `qualities` on a stat block's action (a magical Healing Touch).
// 1.263: a combat condition's `auras` (Aura of Protection, Holy Nimbus), and `keepsOn` on a catalog
//        entry's mechanics and on a stat block: conditions held for the whole fight.
// 1.264: a combat condition's `behavior` (`only`, `onlyWhenStuck`, `moves`, `table`): Turn Undead,
//        Command, Confusion; `saveEnds.at: "action"` (Irresistible Dance); the `compelled` event
//        and refusal.
// 1.265: an aura's `needs`, `harms` and `save` (Countercharm, a balor's Fire Aura, a pit fiend's Fear
//        Aura); a save modifier's `against.casts` (Holy Nimbus).
// 1.266: a condition that drops what its holder holds, keeps them out of a ring, frees a turn begun
//        stuck, a save rolled only out of sight, and a condition that destroys by threat tier.
// 1.267: senses any one of which serves, targets kept near each other, an area that grows with its
//        cost, more uses on an item, and things a stat block holds.
// 1.268: auras reaching only some kinds of creature or whoever holds their holder, an aura save
//        worse when failed by enough or one whose holder's eyes can be averted, and a save rolled
//        leaning while its source is in sight.
// 1.269: up to 320 conditions (160 before), an aura save whose aura stays off once what it put on
//        ends (`immuneWhenEnds`), an item use's `sheetDifficulty`, and `chargeStep` (more charges
//        spent for more).
// 1.270: a catalog entry whose creature type is chosen as it is used (`kindChoice`), an aura reaching
//        only that kind or whoever sees its holder, and a save that ends a condition only from far
//        enough away.
// 1.271: an item whose first use is named, an item use adding a value off its holder's sheet, more charges
//        that push farther, and a last charge's die that gives charges back.
// 1.272: an item that becomes another when its last charge is spent.
// 1.273: a weapon whose charges are spent on its hits.
// 1.274: a condition put on with a value off its applier, temporary points a condition gives each turn, an
//        aura save against its applier's difficulty, a save on harm from a condition's source, a walk kept
//        within reach, and a kind chosen as an item is used.
// 1.275: a condition that holds while its source is near as well as in sight, and one condition that holds
//        others off.
// 1.276: spells, items and creatures that teleport.
// 1.277: a spell, an item or a creature action that puts on more than four conditions.
// 1.278: a save its user's side may fail, a condition that keeps its holder off a whole side, and one that
//        ends on an attack, on harm from a catalog or on a friend harmed in sight.
// 1.279: a teleport that leaves the fight, takes along only those its user sees, or leaves smoke behind.
// 1.280: a creature's teleport that strikes before or after it.
// 1.281: a blow whose maker regains the damage it dealt.
// 1.282: a burst centred on its user.
// 1.283: a legendary move.
// 1.284: a legendary cast.
// 1.285: a legendary move after its action or on one speed.
// 1.286: a lightly obscuring fog, and a fog or wind that blows it away.
// 1.287: hiding for real, searching, and a creature that detects.
// 1.288: readying for real.
// 1.289: a fog a wind disperses only after a while.
// 1.290: a passive Perception that reads advantage, and a change to checks made to find somebody.
// 1.291: a creature's own modes on checks, a printed passive Perception, and standard actions with their own
//        budget.
// 1.292: somebody's own ways of hiding or of finding the hidden.
// 1.293: creatures whose attacks are rolled twice where they stand.
// 1.294: fights kept dark, and things that shed light.
// 1.295: a carried light's name and its price to put out and light again.
// 1.296: creatures that light or put out their own light, and items that shed light while switched off.
// 1.297: zones that shed light or end magical darkness, and light that shows the invisible.
// 1.298: creatures whose light goes out under a condition, and light that is sunlight.
// 1.299: darkness that puts out spell light, magical light, and a dispelling reach.
// 1.300: what a higher cost adds only every so many steps.
// 1.301: zones carried with somebody, and copies set down apart.
// 1.302: entries that change another entry each time it is used.
// 1.303: uses only in some light, and conditions that moving or acting ends.
// 1.304: uses once a creature until a rest.
// 1.305: targets that grow with the sheet, and the same target more than once.
// 1.306: weapons put in hand, and amends that add damage of a type or strikes.
// 1.307: creature actions held by concentration, conditions ended by using a named action, and uses that put
//        conditions on their own user.
// 1.308: an item use whose targets grow with the sheet, or that takes the same target more than once.
// 1.309: hiding that needs camouflage or a wall, attacks unhindered by not seeing, surprise from a hidden
//        start, and a weapon bound out of the fight.
// 1.310: an entry made again while its user concentrates on it, and a condition that ends at a distance from
//        whoever put it on.
// 1.311: an item use that puts conditions on its reader, creature actions that slay the dying, and conditions
//        a rule ends when their holder moves or acts.
// 1.312: a weapon mode whose hit claps around the one it hit.
// 1.313: a creature sent away that still takes turns, a condition ended by a check, standard actions taken
//        with a use, a casting's choices made again, an ability add capped, and an item bound only with
//        others worn.
// 1.314: a condition that shuts its holder away from everybody else, and an entry aimed only at creatures up
//        to a size.
// 1.315: a creature's lair actions, taken on its lair's count.
// 1.316: props: what stands on a board that may be broken, and attacks pointed at them.
// 1.317: Legendary Resistance, and an item use's `targetsUpTo`.
// 1.318: board events and growth, and an entry or an item use that clears growth.
// 1.319: a light that sheds shade, something that alerts (chimes), and a creature held still by light.
// 1.320: an aura that grows, lingers or harms on its targets' turns, a hold with a most, tearing free and
//        hanging on.
// 1.321: a save against a board's light rule, and how far it moves a track at most.
// 1.322: an item use taken as a reaction.
// 1.323: Held Ground, and a blow that reaps.
// 1.324: a creature action that leaves an area standing or changes the ground, and an area that lasts until
//        the next lair action.
// 1.325: a creature action that calls creatures into the fight.
// 1.326: a creature action that draws whoever it lands on toward it.
// 1.327: lair timing: a creature action only at whoever has acted this round, a broken concentration that
//        picks the next lair action, and a condition lasting until the next lair action.
// 1.328: a condition that moves the difficulty of the saves its holder calls for.
// 1.329: a board event that carries what obscures and whoever stands on the ground toward an edge.
// 1.330: Held Ground let go in the middle of a fight, and marks coming due.
// 1.331: a condition held only near a prop, an area around props, and an aura that feeds on the felled.
// 1.332: a prop lit again, a use only beside a prop, and a change to the ground that leaves whoever stands
//        there in it.
// 1.333: fight-board art: the board pack a fight is drawn with, and a lasting area drawn with its own art.
// 1.334: an item use that gives its user more of the turn.
// 1.335: a rest that spends dice to heal (5e's Hit Dice).
// 1.336: a broken concentration that picks one of a list of lair actions.
// 1.337: a rest that spends dice from several pools.
// 1.338: icons on a catalog entry or a condition, and portraits, from packs of their own kind.
// 1.339: the Game Master's intro message, part of the GM setup and a story's `intro`: defined is the game's
//        first message exactly, guided only shapes it; an Experience may lock its own.
// 1.340: a ruleset of up to 512 KB and catalog files of up to 2 MB (256 KB and 1 MB before).
// 1.341: the client host namespace (__MARINARA_HOST__), api.runtime services, commands, admission, haptics, Spotify, local speech, chat-gallery and chat-write members, and shared server libraries.
// 1.342: a story's number flag may be a `clock` (title, 2-12 segments, a "when full" line, hidden until
//        shown): the player sees it fill in the HUD and the World tab, and the Game Master is told once
//        when it fills. A map pack world whose story has one needs 1.342.
// 1.343: story actions `give` (a ruleset item by `catalog/entry` id, or one by name), `fight` (one of the
//        script's `fights`: its creatures, counted, on a painted board), `move` (the party to a place) and
//        `ending` (one of the script's `endings`: a title, a scene and the epilogue; nothing trips after).
//        A map pack world whose story uses them needs 1.343.
// 1.344: an Experience's map pack may ship creature packs (`mapPack.creatures`, .creaturepack.json files
//        declared as assets): its fights draw their creatures from them first, then from the library's.
// 1.345: a package's assets may be audio (`.ogg`, `.mp3`, `.wav`, 16 MB each at most), and an Experience's
//        map pack may ship `music`: its tracks, by place, anywhere else and in fights. A story's `music`
//        action cues one of them over the place's, or hands back to the place's.
// 1.346: an Experience's map pack may ship its people (`mapPack.people`, a .people.json file declared as
//        an asset): named people of its worlds with a portrait (the journal, the narration), expressions,
//        a walking look from its tiles, how they speak, and lore that is active in its games.
// 1.347: an Experience's people may be companions (`companion`: a role and, per ruleset, a build for each
//        level they are made for): the story recruits and dismisses them (`recruit` / `dismiss` actions),
//        the Game Master may take only them in, and they join with their sheet and keep up with the party.
// 1.348: a story may keep what people know (`knowledge`: a person or keys, the text, flag conditions): an
//        entry is told to the Game Master on a turn it holds and its person is in the scene (named, or
//        travelling with the party) or one of its keys is said. Up to 600 entries, 12 a turn.
// 1.349: story triggers `rest` (a rest the Game Master's sheet tags took), `travel` (the party sets out
//        from one place for another) and `idle` (some replies with nothing happening), with a `priority`:
//        one of them goes a turn, the highest. A condition may ask whether a person travels with the party
//        (`{ "party": "<person id>", "is": "in" | "out" }`). A script may have 256 events (128 before).
// 1.350: `POST /api/game/experience/check` checks a whole map pack before it is exported, as an installed
//        one is read: send `{ mapPack, files: { <path>: <parsed JSON> }, assets: [{ path, bytes }] }`, get
//        `{ ok, minor, issues: [{ path, message }] }` (`minor`: the Capability API minor the pack needs).
// 1.351: a story may hold places at a season whatever the date (`seasons`: a place, and every place inside
//        it, or the whole world; the `season` action changes or lets one go during play). The overworld,
//        towns and the weather follow it. A world's battlefield may be painted with seasons (`seasons`
//        rows, a letter or `.` per tile, named by `seasonKeys`), what a fight's tiles start in.
// 1.352: a creature pack (creaturePackVersion 2) may give a creature flying art (`fly`: a block laid out as
//        a walking one, one per look or one for all), played 0, 1, 2, 1 while it is shown flying: it flies
//        and has no walk, it hovers, it is up in the air, or it flew this turn. Ruleset fights' views say so
//        as `flying` on the fighter.
// 1.353: a story may have 256 flags (64 before).
// 1.354: a ruleset fighter may be in the air (`airborne`): a flier with no walk, or that hovers, starts
//        so; a step only its flight takes, flying up, or the free `move:take-off` move puts it there, and
//        `move:land` or anything that grounds it brings it down. A fighter in the air is shown in its
//        flying art.
// 1.355: an Experience's map pack may ship ruleset overlays (`mapPack.rulesets`: a ruleset id and a
//        .overlay.json file each): bestiary creatures, combat conditions, sheet conditions, creature tags
//        and entries for the ruleset's catalogs, merged into a game's ruleset of that id while the
//        Experience is on. An overlay that does not fit the ruleset is left out whole.
// 1.356: a story's fight may have variants by party size (`variants`: a party size or `{ min, max }` and
//        the creatures, board and note for a party that size); a party is the player's character and the
//        companions travelling with it. The GM is told the variant and the fight's tell names it.
// 1.357: an Experience's map pack may ship image packs for its maps made by hand (`mapPack.dungeons`:
//        .tilepack.json files laid out as a dungeon set, `dn_floor`, `dn_wall`, `dn_liquid`, `dn_prop0`-
//        `dn_prop7`), named by id from a hand map's `pack` before the library's; and a hand map may carry
//        its own `words` for the Game Master (floor, wall, liquid and each prop slot).
// 1.358: a story script reaches further: `any` condition groups (one of them holds), a `fight` event that
//        names the script's fight it waits on, a `leave` event, a number flag's `min` and `max` (every set
//        and add kept within), and an `if` on each cutscene page and each action (done only when it holds
//        as the event reaches it; recorded as `acts` on the trip's tag).
// 1.359: an Experience's ruleset overlay may give items a story cost (`storyUses`: the item by
//        `catalog/entry`, the story's number flag, what a use adds to it, and `atLeast`): a fight refuses
//        the use while the flag is below it, and the next story turn records what it spent.
// 1.360: a story fight's variant may be for parties above six, or open-ended (`party: { "min": 7 }`); a
//        story condition may test the party's size (`{ "partySize": { "is": ">=", "value": 5 } }`); and a
//        people file's companion may never fight (`noncombatant`): not counted in the party's size, and
//        not put in its fights.
// 1.361: a story's `season` action may hold `over` everything inside it (the script's own seasons and
//        every other hold), and what people know is ranked: the people the scene names first, then what
//        its words bring in, then companions only travelling along, shared out person by person.
// 1.362: a story may keep `exposures`: what being in a place does to the party over time (every `hours`
//        hours there while its `if` holds, tracks moved and conditions put on for each of the party, by
//        the Engine's own sheet commands on the game's clock). Noonfield's light outside a fight.
// 1.363: a story fight's (or variant's) creature entry may `adjust` it for that fight: its Legendary
//        Resistance and its health (`maxHp`), in place of its stat block's.
// 1.364: a story's exposure may ask a `save` ({ save, difficulty, against? }, as a light rule's 1.321) that
//        each of the party rolls off their own sheet, only failures taking its tracks and conditions; a
//        track it moves may stop at `upTo`. A sheet command's `op="track"` takes `upto=` the same way.
// 1.365: a story's exposure may be `sparedByShade`: a shade carried lit by any of the party (an item whose
//        light has `shade`, switched on where it has a switch) keeps it off, as its `if` not holding does.
// 1.366: a story may hold death (`heldGround`: a place or the whole world, a label, the condition the felled
//        take, the marks their tracks take, flag conditions): recorded as the party comes and goes, and a
//        ruleset fight started there is fought on that Held Ground (1.323).
// 1.367: an Experience's ruleset overlay may add sheet tracks (`tracks`, as the ruleset's `sheet.live.tracks`):
//        shown on the sheet, moved by sheet commands, and kept for Held Ground's and light rules' marks.
// 1.368: a story action `sheet` puts a sheet condition on each of the party or takes it off, or moves a
//        track of each one's sheet (`upTo` stops it), as the Engine's own sheet command.
// 1.369: Held Ground may let go (`heldGround[].release`: the felled die or go down, and marks of a track
//        come due as dying saves with a bonus, a number or a number flag): in a ruleset fight still on it,
//        in the very step that lets it go (an item's story spend, a prop broken), and out of a fight each
//        of the party rolls what they owe off their own sheet.
// 1.370: a story's `give` may name a ruleset entry by its bare id (the first catalog that offers it), and
//        may list alternatives, the first the game offers given.
// 1.371: a story fight's creature `adjust` may change whom its actions call (`calls`), and change any of
//        it from a party level up (`levels`), the level read off the Experience's companion sheets' fields.
// 1.372: an Experience's GM setup values (`contributions.gameSurface.setup.defaults`), filled into the Game
//        wizard when it is picked, with its own intro (locked or not) beside a story's.
// 1.373: a data-only Experience (`kind: ["experience"]`): no entrypoints, permissions or code, only
//        pictures, music and data; Game Mode's own view plays it. Shared as one `.experience.json` file
//        (features/world/experience-file.ts) the user reviews before it is imported.
// 1.374: a ruleset in the agents catalog is a ruleset package file (`<id>.ruleset.json`), never a package zip;
//        its manifest declares 1.374 or newer.
// 1.375: how the fight screen shows a ruleset: a budget's `short` letters and `tone`, and `combat.display`
//        (the defense column's `short` and `hide`, and which pools show under a turn).
// 1.376: Home package browser fullscreen controls.
// 1.377: explicit Motion 14 host slot (motion/react); the existing framer-motion slot stays on Motion 13.
// 1.378: a ruleset's own words on the sheet, menu and cards: a combat modifier's `label`, a pool's `unit`
//        and `units`, a list's `display` (tab, rows split by a number column, a tick column), a text
//        field's `hideWhen` by a derived value, a condition's `pickable: false`, a track's `showWhenSet`,
//        an item toggle's `onLabel` and `offLabel`, an item use's `title`, a derived value's `signed`,
//        and creature traits to 1200.
// 1.379: which combat styles a ruleset's games may play (`combat.styles`): the New Game wizard and the
//        game's settings offer only those, and a game saved on another plays the first one listed.
// 1.380: package-bound per-chat agent reference lorebook trigger resolution.
// 1.381: independent browser audio players, shared manifest fetch and default music selection.
// 1.382: fights for a symbol-pool ruleset (`combat.kind: "symbol-pool"`): attacks, saves, checks,
//        contests and initiative thrown in the ruleset's own symbol dice, a defense read as the
//        difficulty dice, `combat.symbols` for the harm each net success adds, flat soak and the
//        spends leftover symbols buy (harm, a critical, a condition, a track, boost or setback dice
//        on the next roll), picked by the Engine and the AI for whichever side spends that symbol.
//        A creature action's `upgrades` names its upgraded to-hit dice.
// 1.383: fight health on a plain track that fills up to its maximum (`combat.health` or
//        `battle.health` naming a track with neither levels nor boxes): Genesys's Wounds, read as the
//        room left above its value, damage adding points and a heal taking them off.
// 1.384: animate a saved Global Gallery image through a saved video connection, without exposing its credentials.
// 1.385: package clients save images through the Engine gallery's existing platform-aware helpers.
// 1.386: the Home browser view's openConnection(connectionId), and /api/generate/raw's debugMode prompt logging.
// 1.387: `persistence.listChatSummaries(chatId)`: a chat's day, week, rolling and Game session summaries. Requires
//        `chat-read`, like `listMessages`.
// 1.388: `api.registerService(key, service, { hostOnly: true })` keeps a service out of `runtime.services.get`, so only
//        the Engine reads it.
// 1.389: `persistence.setMessagesHiddenFromAI(chatId, messageIds, hidden)` hides or shows a chat's messages from the
//        AI and resolves the ids it changed. Requires `chat-write`; skips messages the user set by hand.
// 1.390: `contributions.agentDetail.header: "engine"`: the Engine draws an agent page's header and
//        passes the package's detail view `engineHeader: true` and a `headerSlot` for its buttons.
export const supportedCapabilityApi = Object.freeze({ major: 1, minor: 390 } as const);

const capabilityApiVersionSchema = z
  .object({
    major: z.number().int().positive(),
    minor: z.number().int().nonnegative(),
  })
  .strict();

const capabilityPackageBuiltAgainstSchema = z
  .object({
    engineVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    engineCommit: z.string().regex(/^[a-f0-9]{40}$/),
  })
  .strict();

export const capabilityPackageManifestV1Schema = capabilityPackageManifestBaseSchema
  .extend({
    schemaVersion: z.literal(1),
  })
  .strict();

export const capabilityPackageManifestV2Schema = capabilityPackageManifestBaseSchema
  .extend({
    schemaVersion: z.literal(2),
    capabilityApi: capabilityApiVersionSchema,
    builtAgainst: capabilityPackageBuiltAgainstSchema,
  })
  .strict();

export const capabilityPackageManifestSchema = z
  .discriminatedUnion("schemaVersion", [capabilityPackageManifestV1Schema, capabilityPackageManifestV2Schema])
  .superRefine((manifest, ctx) => {
    const mapPack = manifest.contributions?.gameSurface?.mapPack;
    if (mapPack) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major !== 1 || api.minor < 72) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "mapPack"],
          message: "A map pack requires schemaVersion 2 and capabilityApi 1.72 or newer",
        });
      }
      // The lock lives in the Engine's own setup, so an Experience with a map pack sets up through it
      // (and the setup's own rule asks for the game-surface slot).
      if (!manifest.contributions?.gameSurface?.setup) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "mapPack"],
          message: "A map pack needs the Engine's own setup (contributions.gameSurface.setup)",
        });
      }
      // Its files are package assets like any other: declared, hash-pinned and served the same way.
      const declared = new Set(manifest.contributions?.assets?.paths ?? []);
      const files: Array<[string, Array<string | number>]> = [
        [mapPack.kit, ["kit"]],
        ...(mapPack.worlds ?? []).map((path, index): [string, Array<string | number>] => [path, ["worlds", index]]),
        ...(mapPack.tiles ? [[mapPack.tiles, ["tiles"]] as [string, Array<string | number>]] : []),
        ...(mapPack.creatures ?? []).map((path, index): [string, Array<string | number>] => [
          path,
          ["creatures", index],
        ]),
        ...(mapPack.people ? [[mapPack.people, ["people"]] as [string, Array<string | number>]] : []),
        ...(mapPack.dungeons ?? []).map((path, index): [string, Array<string | number>] => [path, ["dungeons", index]]),
        ...(mapPack.rulesets ?? []).map((each, index): [string, Array<string | number>] => [
          each.overlay,
          ["rulesets", index, "overlay"],
        ]),
      ];
      if (mapPack.music) {
        const tracks = new Set(mapPack.music.tracks.map((track) => track.id));
        files.push(
          ...mapPack.music.tracks.map((track, index): [string, Array<string | number>] => [
            track.path,
            ["music", "tracks", index, "path"],
          ]),
        );
        const named: Array<[string | undefined, Array<string | number>]> = [
          [mapPack.music.default, ["music", "default"]],
          [mapPack.music.combat, ["music", "combat"]],
          ...(mapPack.music.places ?? []).map((each, index): [string, Array<string | number>] => [
            each.track,
            ["music", "places", index, "track"],
          ]),
        ];
        for (const [track, at] of named) {
          if (track !== undefined && !tracks.has(track)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["contributions", "gameSurface", "mapPack", ...at],
              message: `No track "${track}" in the map pack's music`,
            });
          }
        }
        if (tracks.size !== mapPack.music.tracks.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["contributions", "gameSurface", "mapPack", "music", "tracks"],
            message: "Two tracks share an id",
          });
        }
      }
      if (mapPack.music && (!api || api.major !== 1 || api.minor < 345)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "mapPack", "music"],
          message: "A map pack's music requires capabilityApi 1.345 or newer",
        });
      }
      if (mapPack.dungeons && (!api || api.major !== 1 || api.minor < 357)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "mapPack", "dungeons"],
          message: "A map pack's dungeon looks require capabilityApi 1.357 or newer",
        });
      }
      if (mapPack.rulesets && (!api || api.major !== 1 || api.minor < 355)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "mapPack", "rulesets"],
          message: "A map pack's ruleset overlays require capabilityApi 1.355 or newer",
        });
      }
      if (new Set((mapPack.rulesets ?? []).map((each) => each.ruleset)).size !== (mapPack.rulesets ?? []).length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "mapPack", "rulesets"],
          message: "Two overlays are for the same ruleset",
        });
      }
      if (mapPack.people && (!api || api.major !== 1 || api.minor < 346)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "mapPack", "people"],
          message: "A map pack's people require capabilityApi 1.346 or newer",
        });
      }
      if (mapPack.creatures && api && api.major === 1 && api.minor < 344) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "mapPack", "creatures"],
          message: "A map pack's creature packs require capabilityApi 1.344 or newer",
        });
      }
      for (const [path, at] of files) {
        if (!declared.has(path)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["contributions", "gameSurface", "mapPack", ...at],
            message: `${path} must also be declared in contributions.assets.paths`,
          });
        }
      }
    }
    // Audio assets (1.345): only an Engine this new serves them, each kept to a size a page can stream.
    const audio = (manifest.contributions?.assets?.paths ?? []).filter((path) => AUDIO_ASSET.test(path));
    if (audio.length) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major !== 1 || api.minor < 345) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "assets", "paths"],
          message: "Audio assets require schemaVersion 2 and capabilityApi 1.345 or newer",
        });
      }
      for (const path of audio) {
        const file = manifest.files.find((each) => each.path === path);
        if (file && file.bytes > CAPABILITY_AUDIO_ASSET_MAX_BYTES) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["contributions", "assets", "paths"],
            message: `${path} is larger than an audio asset can be (16 MB)`,
          });
        }
      }
    }
    const setup = manifest.contributions?.gameSurface?.setup;
    if (setup) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major !== 1 || api.minor < 18 || !manifest.contributions?.slots?.includes("game-surface")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "setup"],
          message: "Experience setup requires the game-surface slot, schemaVersion 2 and capabilityApi 1.18 or newer",
        });
      }
      if (setup.seed && Object.hasOwn(setup.config ?? {}, setup.seed.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "setup", "config"],
          message: "Experience config cannot override the declared seed key",
        });
      }
      if (setup.defaults && (!api || api.major !== 1 || api.minor < 372)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "setup", "defaults"],
          message: "Experience setup defaults require capabilityApi 1.372 or newer",
        });
      }
    }
    // `registerTool` only exists on an Engine this new, so the declared API version is what stops a
    // package shipping tools and then failing to activate on an older install. Enforced here rather
    // than left to the documentation, which cannot refuse anything.
    if (manifest.permissions.includes("tools")) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major < 1 || (api.major === 1 && api.minor < 19)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["permissions"],
          message: 'The "tools" permission requires schemaVersion 2 and capabilityApi 1.19 or newer',
        });
      }
    }
    // Same reason as `tools`: `registerAchievements` only exists on an Engine this new.
    if (manifest.permissions.includes("achievements")) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major < 1 || (api.major === 1 && api.minor < 36)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["permissions"],
          message: 'The "achievements" permission requires schemaVersion 2 and capabilityApi 1.36 or newer',
        });
      }
    }
    // Same reason as `tools`: the `mari-actions:` service is only read by an Engine this new.
    if (manifest.permissions.includes("mari-actions")) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major < 1 || (api.major === 1 && api.minor < 50)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["permissions"],
          message: 'The "mari-actions" permission requires schemaVersion 2 and capabilityApi 1.50 or newer',
        });
      }
    }
    // Same reason as `tools`: `registerSceneOrigin` only exists on an Engine this new.
    if (manifest.permissions.includes("scenes")) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major < 1 || (api.major === 1 && api.minor < 66)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["permissions"],
          message: 'The "scenes" permission requires schemaVersion 2 and capabilityApi 1.66 or newer',
        });
      }
    }
    if (manifest.contributions?.gameSurface?.prepareBeforeStart) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major < 1 || (api.major === 1 && api.minor < 17)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "prepareBeforeStart"],
          message: "prepareBeforeStart requires schemaVersion 2 and capabilityApi 1.17 or newer",
        });
      }
      if (!manifest.contributions.slots?.includes("game-surface")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "gameSurface", "prepareBeforeStart"],
          message: 'prepareBeforeStart requires the "game-surface" slot',
        });
      }
    }
    // A data-only Experience (1.373): Game Mode's own view plays it, so it has nothing to run and may hold
    // nothing that could. Everything else about it is an Experience package's as before.
    if (manifest.kind.includes("experience")) {
      const issue = (path: Array<string | number>, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major !== 1 || api.minor < 373) {
        issue(["kind"], "A data-only Experience requires schemaVersion 2 and capabilityApi 1.373 or newer");
      }
      if (manifest.kind.length !== 1) issue(["kind"], "A data-only Experience is an Experience and nothing else");
      for (const [key, value] of Object.entries(manifest.entrypoints)) {
        if (value !== undefined) issue(["entrypoints", key], "A data-only Experience carries no code");
      }
      if (manifest.permissions.length) issue(["permissions"], "A data-only Experience asks for no permissions");
      if (manifest.restartRequired) issue(["restartRequired"], "A data-only Experience never needs a restart");
      const slots = manifest.contributions?.slots ?? [];
      if (slots.length !== 1 || slots[0] !== "game-surface") {
        issue(["contributions", "slots"], 'A data-only Experience fills the "game-surface" slot and nothing else');
      }
      if (manifest.contributions?.gameSurface?.prepareBeforeStart) {
        issue(["contributions", "gameSurface", "prepareBeforeStart"], "A data-only Experience has nothing to prepare");
      }
      manifest.files.forEach((file, index) => {
        if (!DATA_ONLY_EXPERIENCE_FILE.test(file.path)) {
          issue(["files", index, "path"], `${file.path} is not a picture, music or data file`);
        }
        // An Experience file writes each path as a key without escapes, so a path that would need one
        // (a quote, a backslash, a control character or a lone surrogate) cannot travel in it.
        if (JSON.stringify(file.path) !== `"${file.path}"`) {
          issue(["files", index, "path"], `${JSON.stringify(file.path)} has a character a file name cannot carry`);
        }
      });
    }
    // A game-surface package draws the whole mode from its client bundle: without a client entrypoint the
    // module loader skips it, so it would be offered in the setup wizard and then render nothing. Caught
    // here so it fails at install with a clear reason rather than as an empty screen later. A data-only
    // Experience (1.373) is the one game surface Game Mode draws itself.
    if (
      manifest.contributions?.slots?.includes("game-surface") &&
      !manifest.kind.includes("experience") &&
      !manifest.entrypoints.client?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entrypoints", "client"],
        message: 'A package declaring the "game-surface" slot must provide a client entrypoint to render it',
      });
    }
    if (manifest.contributions?.slots?.includes("home-browser-tab")) {
      if (!manifest.entrypoints.client?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entrypoints", "client"],
          message: 'A package declaring the "home-browser-tab" slot must provide a client entrypoint',
        });
      }
      if (!manifest.contributions.homeBrowserTab) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "homeBrowserTab"],
          message: 'A package declaring the "home-browser-tab" slot must describe its browser tab',
        });
      }
    }
    const homeWidgets = manifest.contributions?.homeWidgets;
    if (manifest.contributions?.slots?.includes("home-widget") || homeWidgets) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major !== 1 || api.minor < 35) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "homeWidgets"],
          message: "Home widgets require capability API 1.35",
        });
      }
      if (
        !manifest.kind.includes("agent") ||
        !manifest.permissions.includes("ui") ||
        !manifest.entrypoints.client?.trim()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "homeWidgets"],
          message: "Agent Home widgets require an agent package with UI permission and a client entrypoint",
        });
      }
      if (!manifest.contributions?.slots?.includes("home-widget") || !homeWidgets?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "homeWidgets"],
          message: "The home-widget slot and widget definitions must be declared together",
        });
      }
      const ids = homeWidgets?.map((widget) => widget.id) ?? [];
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "homeWidgets"],
          message: "Home widget IDs must be unique within the agent",
        });
      }
    }
    // Icon paths feed the same serve-path allowlist as general assets, so they
    // must be hash-pinned in files[] whether or not the home-browser-tab slot is
    // declared — an unpinned (or traversal-shaped) icon path would otherwise
    // reach the resolver unvalidated (review finding on #5091).
    for (const [index, iconPath] of (manifest.contributions?.homeBrowserTab?.iconPaths ?? []).entries()) {
      if (!manifest.files.some((file) => file.path === iconPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "homeBrowserTab", "iconPaths", index],
          message: "A Home browser tab icon must be declared in the package file manifest",
        });
      }
    }
    for (const [index, widget] of (manifest.contributions?.homeWidgets ?? []).entries()) {
      if (widget.iconPath && !manifest.files.some((file) => file.path === widget.iconPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "homeWidgets", index, "iconPath"],
          message: "A Home widget icon must be declared in the package file manifest",
        });
      }
    }
    // Every declared asset must be hash-pinned in files[] — the serve path refuses
    // undeclared files, so an unlisted path would install fine and then 404 at
    // runtime. Caught here so it fails at install with a clear reason instead.
    for (const [index, assetPath] of (manifest.contributions?.assets?.paths ?? []).entries()) {
      if (!manifest.files.some((file) => file.path === assetPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "assets", "paths", index],
          message: "A declared package asset must be listed in the package file manifest",
        });
      }
    }
    // contributions.assets is a Capability API 1.10 feature. Gated here so a
    // package author gets the versioned message at build/install time instead of
    // a cryptic unrecognized-key error when an older Engine rejects the manifest.
    if (manifest.contributions?.assets) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      const declares110 = api !== null && (api.major > 1 || (api.major === 1 && api.minor >= 10));
      if (!declares110) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "assets"],
          message: "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer",
        });
      }
    }
    // A ruleset is the whole point of the package that ships one, so it is a hard 1.20 requirement
    // rather than a soft seam: an older Engine refuses the install instead of installing a package
    // that then does nothing.
    if (manifest.contributions?.assets?.paths.includes(RULESET_ASSET_PATH)) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major < 1 || (api.major === 1 && api.minor < 20)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "assets", "paths"],
          message: `${RULESET_ASSET_PATH} requires schemaVersion 2 and capabilityApi 1.20 or newer`,
        });
      }
    }
    // A catalog asset is part of a ruleset, so it follows the same hard requirement one minor
    // later, and only ever ships beside the file that declares it: on its own it is a JSON document
    // nothing would ever read.
    if ((manifest.contributions?.assets?.paths ?? []).some(isRulesetCatalogAssetPath)) {
      const api = manifest.schemaVersion === 2 ? manifest.capabilityApi : null;
      if (!api || api.major < 1 || (api.major === 1 && api.minor < 21)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "assets", "paths"],
          message: "catalogs/<id>.json requires schemaVersion 2 and capabilityApi 1.21 or newer",
        });
      }
      if (!manifest.contributions?.assets?.paths.includes(RULESET_ASSET_PATH)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contributions", "assets", "paths"],
          message: `A catalog asset must ship beside the ${RULESET_ASSET_PATH} that declares it`,
        });
      }
    }
  });

export const capabilityCatalogPackageSchema = z
  .object({
    manifest: capabilityPackageManifestSchema,
    category: z.enum(["writer", "tracker", "misc"]).default("misc"),
    artifact: z
      .object({
        url: z.string().url(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        bytes: z
          .number()
          .int()
          .positive()
          .max(100 * 1024 * 1024),
      })
      .strict(),
    iconUrl: z.string().url().optional(),
    documentationUrl: z.string().url().optional(),
  })
  .strict();

export const capabilityCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    packages: z.array(capabilityCatalogPackageSchema),
    provenance: z
      .object({
        kind: z.enum(["official", "custom"]),
        url: z.string().url(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Envelope-only catalog shape, derived from the real schema so the two cannot
 *  drift: entries stay unparsed so one package from a NEWER Engine (declaring a
 *  manifest key this Engine's strict schemas do not know yet) cannot fail the
 *  whole document, and `.strip()` (not strict, not passthrough) so newer
 *  TOP-LEVEL fields neither reject the envelope nor leak into the result. */
const capabilityCatalogEnvelopeSchema = capabilityCatalogSchema.extend({ packages: z.array(z.unknown()) }).strip();

export type CapabilityCatalogParseResult = {
  catalog: z.infer<typeof capabilityCatalogSchema>;
  /** Entries this Engine could not understand (newer manifest features). They
   *  are dropped from the catalog rather than failing it — the polite
   *  "requires capability API x.y" path only exists for entries that parse.
   *  Identified best-effort by manifest id so operators can name what vanished. */
  droppedEntries: number;
  droppedIds: string[];
};

function bestEffortCatalogEntryId(entry: unknown): string {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const manifest = (entry as Record<string, unknown>).manifest;
    if (manifest && typeof manifest === "object" && !Array.isArray(manifest)) {
      const id = (manifest as Record<string, unknown>).id;
      if (typeof id === "string" && id) return id;
    }
  }
  return "(unidentifiable entry)";
}

/** Parse a downloaded catalog, tolerating individual entries this Engine is too
 *  old to understand. All-or-nothing parsing would brick the ENTIRE Agents
 *  browser (and every install/update path) the moment the official catalog
 *  publishes one package using a newer manifest field (#5091 review finding). */
export function parseCapabilityCatalogWithCompat(input: unknown): CapabilityCatalogParseResult {
  const envelope = capabilityCatalogEnvelopeSchema.parse(input);
  const packages: z.infer<typeof capabilityCatalogPackageSchema>[] = [];
  const droppedIds: string[] = [];
  for (const entry of envelope.packages) {
    const parsed = capabilityCatalogPackageSchema.safeParse(entry);
    if (parsed.success) packages.push(parsed.data);
    else droppedIds.push(bestEffortCatalogEntryId(entry));
  }
  return { catalog: { ...envelope, packages }, droppedEntries: droppedIds.length, droppedIds };
}

export const capabilityPackageReadinessSchema = z.enum(["pending", "registered", "ready", "error"]);

export const installedCapabilityPackageSchema = z.object({
  id: z.string(),
  version: z.string(),
  manifest: capabilityPackageManifestSchema,
  installedAt: z.string().datetime(),
  status: z.enum(["active", "restart-required", "error"]),
  error: z.string().nullable(),
  readiness: capabilityPackageReadinessSchema.default("pending"),
  readinessError: z.string().nullable().default(null),
  legacy: z.boolean().default(false),
  previousVersion: z.string().optional(),
  previousManifest: capabilityPackageManifestSchema.optional(),
});

export const installedCapabilityRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    packages: z.array(installedCapabilityPackageSchema),
  })
  .strict();

const packagedAgentPromptTemplateSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    promptTemplate: z.string(),
    description: z.string().optional(),
  })
  .strict();

export const packagedAgentDefinitionSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    name: z.string().min(1).max(120),
    description: z.string().max(2000),
    author: z.string().max(120).optional(),
    phase: z.enum(["pre_generation", "parallel", "post_processing"]),
    enabledByDefault: z.boolean(),
    defaultInjectAsSection: z.boolean().optional(),
    category: z.enum(["writer", "tracker", "misc"]),
    libraryHidden: z.boolean().optional(),
    runtimeDisabled: z.boolean().optional(),
    /** @deprecated Legacy package compatibility; author resultType in defaultSettings instead. */
    resultType: agentResultTypeSchema.optional(),
    // Installed packages on disk may still list the retired "visual_novel" mode.
    // Normalize it to "roleplay" (its behavioural successor) rather than failing the
    // whole manifest parse, which crashed server bootstrap. Dropping it instead would
    // turn a visual_novel-only allowlist into an empty one, which means "every mode".
    modeAllowlist: z
      .preprocess(
        (value) =>
          Array.isArray(value)
            ? [...new Set(value.map((mode) => (mode === "visual_novel" ? "roleplay" : mode)))]
            : value,
        z.array(z.enum(["conversation", "roleplay", "game"])),
      )
      .optional(),
    defaultTools: z.array(z.string()).optional(),
    defaultSettings: z.record(z.string(), z.unknown()).optional(),
    promptTemplates: z.array(packagedAgentPromptTemplateSchema).optional(),
    runInterval: z.number().int().positive().optional(),
    defaultPromptTemplate: z.string(),
    execution: z.enum(["pipeline", "feature", "host"]).optional(),
  })
  .strict();

export const packagedAgentDefinitionsSchema = z.array(packagedAgentDefinitionSchema);

export type CapabilityPackageManifest = z.infer<typeof capabilityPackageManifestSchema>;
export type CapabilityCatalogPackage = z.infer<typeof capabilityCatalogPackageSchema>;
export type CapabilityCatalog = z.infer<typeof capabilityCatalogSchema>;

/** A catalog entry after the Engine has stamped where it came from.
 *
 *  `preview` marks an entry the Engine itself read from the staging preview
 *  overlay. It is deliberately NOT part of the downloaded-entry schema above:
 *  that schema is the contract for bytes we fetched, and accepting `preview`
 *  there would let any published or custom catalog claim preview provenance for
 *  its own entries. The Engine assigns it from the source URL and nowhere else,
 *  so a value arriving on the wire is rejected by the strict entry schema and
 *  can never reach a consumer. */
export type StampedCapabilityCatalogPackage = CapabilityCatalogPackage & {
  preview?: true;
  store?: CapabilityStoreListing;
};

/** Agent Organizer sections, in display order. */
export const CAPABILITY_STORE_SECTIONS = [
  "apps",
  "games",
  "writing",
  "memory",
  "trackers",
  "adventure",
  "media",
  "alive",
] as const;
export type CapabilityStoreSection = (typeof CAPABILITY_STORE_SECTIONS)[number];

/**
 * One package's entry in the `store.json` sidecar beside a catalog.json. Paths are
 * relative to the sidecar URL. Unknown keys are dropped (not rejected), so the Agents
 * repo can add fields without breaking Engines that predate them. Untrusted remote data.
 */
export const capabilityStoreEntrySchema = z.object({
  section: z.enum(CAPABILITY_STORE_SECTIONS),
  tagline: z.string().trim().min(1).max(120),
  featured: z.number().int().positive().max(1000).optional(),
  iconPath: z.string().min(1).max(512).optional(),
  bannerPath: z.string().min(1).max(512).optional(),
  bannerSmallPath: z.string().min(1).max(512).optional(),
  previews: z.array(z.string().min(1).max(512)).max(4).optional(),
});

/** A starter kit: a named set of packages the Organizer installs together. */
export const capabilityStoreKitSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160).default(""),
  packages: z.array(z.string().min(1).max(80)).min(1).max(20),
});
export type CapabilityStoreKit = z.infer<typeof capabilityStoreKitSchema>;

/** Store data as the Engine serves it: image paths resolved to absolute URLs. */
export interface CapabilityStoreListing {
  section: CapabilityStoreSection;
  tagline: string;
  featured?: number;
  iconUrl?: string;
  bannerUrl?: string;
  bannerSmallUrl?: string;
  previewUrls?: string[];
}
export type StampedCapabilityCatalog = Omit<CapabilityCatalog, "packages"> & {
  packages: StampedCapabilityCatalogPackage[];
  /** Starter kits from the published store sidecar; packages not in the catalog are dropped. */
  kits?: CapabilityStoreKit[];
};
export type InstalledCapabilityPackage = z.infer<typeof installedCapabilityPackageSchema>;
export type PackagedAgentDefinition = z.infer<typeof packagedAgentDefinitionSchema>;

export interface CapabilityPackageUpdate {
  id: string;
  name: string;
  installedVersion: string;
  version: string;
  artifactSha256: string;
  restartRequired: boolean;
  /** Notes published for every version after `installedVersion` up to `version`, newest first,
   *  when the catalog ships a notes sidecar. */
  releaseNotes?: CapabilityPackageVersionNote[];
  /** Whether the publisher marked any of those versions as a change the user will notice. */
  releaseHighlight?: boolean;
}

/** Release notes live in a sidecar document next to catalog.json, never inside a
 *  catalog entry or a package manifest.
 *
 *  `capabilityCatalogPackageSchema` is strict and `parseCapabilityCatalogWithCompat`
 *  DROPS entries carrying keys it does not know. A new key on a catalog entry would
 *  therefore empty the Agents browser on every already-shipped Engine that predates
 *  it, not just hide the notes. A sibling document those Engines never fetch has no
 *  such blast radius: an Engine without this feature simply never asks for it, and an
 *  Engine with it treats a missing document as "no notes". */
const capabilityPackageVersionNoteSchema = z
  .object({
    // Stricter than the manifest's version field, and deliberately so. Ordering
    // here runs through compareCapabilityPackageVersions, which turns each
    // component and each numeric prerelease identifier into a Number. That makes
    // two preconditions load-bearing, and neither is checked there:
    //   * every numeric part must stay inside the safe integer range, or two
    //     different versions compare equal and newest-first quietly stops holding;
    //   * numeric prerelease identifiers must be canonical, or "01" and "1"
    //     compare as different versions while meaning the same one.
    // Leading zeros matter for the same reason: 01.2.3 and 1.2.3 compare equal
    // numerically but differ as strings, so the duplicate check and the range
    // filter in attachCapabilityReleaseNotes would disagree with the ordering —
    // two notes listed for what the comparator treats as one version.
    // Nine digits is far beyond any real version, and this is canonical SemVer
    // otherwise.
    version: z
      .string()
      .max(64)
      .regex(
        /^(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})(?:-(?:0|[1-9]\d{0,8}|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d{0,8}|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/,
      ),
    // Round-tripped, not just shape-matched: a plain regex accepts 2026-02-30,
    // which would reach the UI as a date that does not exist.
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value), {
        message: "must be a real calendar date",
      }),
    /** Plain text. Rendered verbatim and never as markdown or HTML: the catalog URL
     *  is operator-configurable, so this is untrusted remote content. */
    notes: z.string().min(1).max(MAX_RELEASE_NOTE_CHARACTERS),
    /** Published by the catalog build, never recomputed here. */
    highlight: z.boolean().default(false),
  })
  .strict();

export const capabilityReleaseNotesSchema = z
  .object({
    schemaVersion: z.literal(1),
    packages: z.record(
      z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(80),
      z
        .object({
          versions: z
            .array(capabilityPackageVersionNoteSchema)
            .max(MAX_RELEASE_NOTE_VERSIONS)
            // A repeated version would list the same release twice in the update
            // prompt and the history sheet, and collide on their per-version list key.
            .refine((versions) => new Set(versions.map((note) => note.version)).size === versions.length, {
              message: "must not list the same version twice",
            }),
        })
        .strict(),
    ),
  })
  .strict();

export type CapabilityPackageVersionNote = z.infer<typeof capabilityPackageVersionNoteSchema>;
export type CapabilityReleaseNotes = z.infer<typeof capabilityReleaseNotesSchema>;

export interface CustomAgentRepository {
  id: string;
  url: string;
  owner: string;
  name: string;
  lastDigest: string | null;
  lastSyncedAt: string | null;
  agentCount: number;
  /** Game Mode rulesets the repository published under `rulesets/` at the last sync. */
  rulesetCount: number;
}

export type CustomAgentRepositoryChangeStatus = "new" | "updated" | "unchanged" | "removed";

export interface CustomAgentRepositoryChange {
  agentId: string;
  name: string;
  status: CustomAgentRepositoryChangeStatus;
  changedFields: string[];
  definition?: PackagedAgentDefinition;
}

/** `new-version`: another version of this ruleset is already installed and this one joins it.
 *  `conflict`: that exact version is installed with different contents, so it is left alone and the
 *  author has to raise the version number. `invalid`: the file is not a usable ruleset. Both of the
 *  last two are skipped without stopping the rest of the repository. */
export type CustomAgentRepositoryRulesetStatus = "new" | "new-version" | "unchanged" | "conflict" | "invalid";

export interface CustomAgentRepositoryRulesetChange {
  /** The file name inside `rulesets/`, which is what identifies the row even when nothing else parsed. */
  file: string;
  /** The namespaced id the ruleset would be installed under, or null when the file could not be read. */
  rulesetId: string | null;
  name: string;
  version: number | null;
  status: CustomAgentRepositoryRulesetStatus;
  /** The author's summary of what the ruleset covers, empty when the file could not be read. */
  coverage: string;
  /** Why an unusable file cannot be installed, first few lines only. */
  issues: string[];
}

export interface CustomAgentRepositoryPreview {
  repository: Pick<CustomAgentRepository, "id" | "url" | "owner" | "name">;
  digest: string;
  changes: CustomAgentRepositoryChange[];
  rulesets: CustomAgentRepositoryRulesetChange[];
}

/** What adding or syncing a repository just did with its rulesets. Stored versions are never
 *  rewritten, so `skipped` covers both unusable files and versions already installed differently. */
export interface CustomAgentRepositoryRulesetResult {
  added: number;
  unchanged: number;
  skipped: number;
}

export interface CustomAgentRepositoryApplyResult extends CustomAgentRepository {
  rulesets: CustomAgentRepositoryRulesetResult;
}

export interface CustomAgentRepositoryState {
  enabled: boolean;
  repositories: CustomAgentRepository[];
}

export function getCapabilityApiCompatibilityIssue(manifest: CapabilityPackageManifest): string | null {
  if (manifest.schemaVersion === 1) return null;
  const required = manifest.capabilityApi;
  const supported = supportedCapabilityApi;
  if (required.major !== supported.major || required.minor > supported.minor) {
    return `Package requires capability API ${required.major}.${required.minor}; this Engine supports ${supported.major}.${supported.minor}`;
  }
  return null;
}

function parseCapabilityPackageVersion(value: string) {
  const prereleaseSeparator = value.indexOf("-");
  const core = prereleaseSeparator >= 0 ? value.slice(0, prereleaseSeparator) : value;
  const prerelease = prereleaseSeparator >= 0 ? value.slice(prereleaseSeparator + 1).split(".") : [];
  return { core: core.split(".").map((part) => Number.parseInt(part, 10)), prerelease };
}

export function compareCapabilityPackageVersions(left: string, right: string): number {
  const a = parseCapabilityPackageVersion(left);
  const b = parseCapabilityPackageVersion(right);
  for (let index = 0; index < Math.max(a.core.length, b.core.length); index += 1) {
    const difference = (a.core[index] ?? 0) - (b.core[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    if (a.prerelease.length === b.prerelease.length) return 0;
    return a.prerelease.length === 0 ? 1 : -1;
  }
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    const leftPart = a.prerelease[index];
    const rightPart = b.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) return leftPart === undefined ? -1 : 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/u.test(leftPart);
    const rightNumeric = /^\d+$/u.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) > Number(rightPart) ? 1 : -1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

export function isInstalledCapabilityReady(installed: InstalledCapabilityPackage): boolean {
  if (installed.status !== "active") return false;
  return !installed.manifest.entrypoints.server || installed.readiness === "ready";
}
