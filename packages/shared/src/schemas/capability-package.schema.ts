import { z } from "zod";
import { agentResultTypeSchema } from "./agent.schema.js";
import { isRulesetCatalogAssetPath, RULESET_ASSET_PATH } from "./ruleset.schema.js";

/** Caps mirrored by the Marinara-Agents catalog build. Kept here so a hostile or
 *  broken notes document cannot push an unbounded string into a modal. */
export const MAX_RELEASE_NOTE_CHARACTERS = 1000;
export const MAX_RELEASE_NOTE_VERSIONS = 20;

export const capabilityPackageKindSchema = z.enum(["agent", "maps", "conversation-calls", "turn-game", "ruleset"]);
export const capabilityPermissionSchema = z.enum([
  "achievements",
  "agent-runtime",
  "chat-read",
  "chat-write",
  "conversation-actions",
  "network",
  "prompt-context",
  "routes",
  "storage",
  "tools",
  "ui",
]);

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
                  // Passive content only — images plus JSON metadata. Never SVG, HTML, or
                  // scripts: those are active documents on a same-origin route.
                  .regex(/\.(?:gif|jpe?g|png|webp|json)$/iu),
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
export const supportedCapabilityApi = Object.freeze({ major: 1, minor: 37 } as const);

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
    // A game-surface package draws the whole mode from its client bundle: without a client entrypoint the
    // module loader skips it, so it would be offered in the setup wizard and then render nothing. Caught
    // here so it fails at install with a clear reason rather than as an empty screen later.
    if (manifest.contributions?.slots?.includes("game-surface") && !manifest.entrypoints.client?.trim()) {
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
export type StampedCapabilityCatalogPackage = CapabilityCatalogPackage & { preview?: true };
export type StampedCapabilityCatalog = Omit<CapabilityCatalog, "packages"> & {
  packages: StampedCapabilityCatalogPackage[];
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
  /** Release notes published for `version`, when the catalog ships a notes sidecar. */
  releaseNotes?: string;
  /** Whether the publisher marked `version` as a change the user will notice. */
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
    // numerically but differ as strings, so the duplicate check and the lookup in
    // attachCapabilityReleaseNotes would disagree with the ordering — two notes
    // for one version, or a note that never attaches because the catalog spells
    // the version differently.
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
            // A repeated version would make the two readers disagree: the update
            // prompt takes the first match, the history sheet shows every one.
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
