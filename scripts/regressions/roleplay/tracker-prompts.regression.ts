import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  extractCharacterCardCastMembers,
  applyTrackerFieldLocksToGameStatePatch,
  roleplayInventoryTrackerLockKey,
  characterTrackerLockKey,
  worldCustomFieldTrackerLockKey,
  characterTrackerCustomFieldDefaultsToRecord,
  normalizeCharacterTrackerCustomFieldDefaults,
  normalizeWorldCustomFields,
  type AgentContext,
  getDefaultAgentPrompt,
  normalizeInventoryTrackerRows,
  normalizeInventoryTrackerPlayerStats,
  findInvalidInventoryTrackerRow,
} from "../../../packages/shared/src/index.js";
import { buildInventoryTrackerEditPatch } from "../../../packages/client/src/features/tracker-panel/lib/inventory-tracker-edit.js";
import {
  applyTrackerCharacterCardIdentity,
  canonicalizeGamePartySpeakerLabels,
  buildLockedInventoryTrackerPatch,
  buildLockedPlayerStatsArrayPatch,
  resolveTrackerGroupUpdate,
  collectLatestTrackerCharacterHistory,
  preserveTrackerCharacterUiFields,
} from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import { executeAgent, resolveAgentResultType } from "../../../packages/server/src/services/agents/agent-executor.js";
import {
  formatBeholderRequestContext,
  loadPriorBeholderState,
  normalizeBeholderState,
  resolveBeholderStateResponse,
} from "../../../packages/server/src/services/agents/beholder-state.js";
import {
  appendTrackerLorebookBatchContextKey,
  applyTrackerLorebookContextPolicy,
} from "../../../packages/server/src/services/generation/tracker-agent-context.js";
import {
  buildCommittedTrackerContextBlock,
  MAX_WORLD_CUSTOM_FIELDS_IN_COMMITTED_CONTEXT,
} from "../../../packages/server/src/services/generation/committed-tracker-context.js";
import {
  makeUniqueCharacterCustomFieldName,
  resolveCharacterCustomFieldName,
} from "../../../packages/client/src/features/tracker-panel/lib/character-custom-field-names.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import {
  makeCapturingProvider,
  makeRegressionAgentContext,
  makeRegressionAgentConfig,
} from "../fixtures/prompt-helpers.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
  {
    name: "roleplay tracker lorebook context is opt-in and keeps author notes",
    run() {
      const context = makeRegressionAgentContext({
        authorNotes: "AUTHOR_NOTES_STAY_ATTACHED",
        activatedLorebookEntries: [{ id: "lore-entry", content: "MAIN_GENERATION_LOREBOOK_MATCH" }],
        vectorContext: {
          recalledMemories: ["RECALLED_MEMORY_STAYS_ATTACHED"],
          semanticLorebookEntries: [{ id: "semantic-lore-entry", content: "SEMANTIC_MAIN_GENERATION_LOREBOOK_MATCH" }],
        },
      });

      const disabled = applyTrackerLorebookContextPolicy({
        context,
        chatMode: "roleplay",
        isTracker: true,
        attachLorebooksToTrackers: false,
      });
      assert.deepEqual(disabled.activatedLorebookEntries, []);
      assert.deepEqual(disabled.vectorContext?.semanticLorebookEntries, []);
      assert.deepEqual(disabled.vectorContext?.recalledMemories, ["RECALLED_MEMORY_STAYS_ATTACHED"]);
      assert.equal(disabled.authorNotes, "AUTHOR_NOTES_STAY_ATTACHED");

      const legacyContext = makeRegressionAgentContext({
        vectorContext: { recalledMemories: ["LEGACY_RECALLED_MEMORY"] } as AgentContext["vectorContext"],
      });
      assert.equal(
        applyTrackerLorebookContextPolicy({
          context: legacyContext,
          chatMode: "roleplay",
          isTracker: true,
          attachLorebooksToTrackers: false,
        }),
        legacyContext,
      );

      const enabled = applyTrackerLorebookContextPolicy({
        context,
        chatMode: "roleplay",
        isTracker: true,
        attachLorebooksToTrackers: true,
      });
      assert.equal(enabled, context);
      assert.deepEqual(enabled.activatedLorebookEntries, context.activatedLorebookEntries);

      const nonTracker = applyTrackerLorebookContextPolicy({
        context,
        chatMode: "roleplay",
        isTracker: false,
        attachLorebooksToTrackers: false,
      });
      assert.equal(nonTracker, context);
      assert.equal(appendTrackerLorebookBatchContextKey(undefined, false), "tracker-lorebooks-off");
      assert.equal(
        appendTrackerLorebookBatchContextKey("message:previous", true),
        "message:previous|tracker-lorebooks-on",
      );

      const retryRouteSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
        "utf8",
      );
      assert.match(retryRouteSource, /applyTrackerLorebookContextPolicy\(/u);
      assert.match(retryRouteSource, /chatMeta\?\.attachLorebooksToTrackers === true/u);
      assert.match(retryRouteSource, /getTrackerAgentTypes\(\)/u);

      const chatSettingsSource = readFileSync(
        new URL("../../../packages/client/src/features/chat-settings/ChatSettingsDrawer.tsx", import.meta.url),
        "utf8",
      );
      const trackerControlsComment = chatSettingsSource.indexOf(
        "{/* Manual trackers run only in roleplay-style chats. */}",
      );
      const trackerControlsStart = chatSettingsSource.indexOf(
        "{metadata.enableAgents && isRoleplayMode && activeTrackerAgents.length > 0 && (",
        trackerControlsComment,
      );
      const trackerControlsEnd = chatSettingsSource.indexOf(
        "{metadata.enableAgents && isRoleplayMode && activeTrackerAgents.length > 0 && (",
        trackerControlsStart + 1,
      );
      assert.notEqual(trackerControlsComment, -1);
      assert.notEqual(trackerControlsStart, -1);
      assert.notEqual(trackerControlsEnd, -1);
      assert.match(
        chatSettingsSource.slice(trackerControlsStart, trackerControlsEnd),
        /ui\.chat\.chatsettingsdrawer\.attachLorebooksToTrackers/u,
      );
    },
  },
  {
    name: "tracker custom fields remain part of the model contract and survive omitted agent output",
    run() {
      assert.deepEqual(
        normalizeCharacterTrackerCustomFieldDefaults([
          { name: " Mental State ", value: "Calm" },
          { name: "mental   state", value: "Duplicate" },
          { name: "Goal", value: 3 },
          { name: " ", value: "Ignored" },
        ]),
        [
          { name: "Mental State", value: "Calm" },
          { name: "Goal", value: "3" },
        ],
      );
      assert.deepEqual(
        characterTrackerCustomFieldDefaultsToRecord([
          { name: "Mental State", value: "Calm" },
          { name: "Goal", value: "Find the atlas" },
        ]),
        {
          "Mental State": "Calm",
          Goal: "Find the atlas",
        },
      );

      assert.deepEqual(
        normalizeWorldCustomFields([
          { name: " Moon Phase ", value: "Waxing", icon: "Moon" },
          { name: "moon   phase", value: "Duplicate", icon: "flame" },
          { name: "Tension", value: 3, icon: "not-a-real-icon" },
        ]),
        [
          { name: "Moon Phase", value: "Waxing", icon: "moon" },
          { name: "Tension", value: "3", icon: "tag" },
        ],
      );

      const currentState = {
        id: "state-1",
        chatId: "chat-1",
        messageId: "message-1",
        swipeIndex: 0,
        date: null,
        time: null,
        location: null,
        weather: null,
        temperature: null,
        worldCustomFields: [
          { name: "Moon Phase", value: "Waxing", icon: "moon" },
          { name: "Tension", value: "Low", icon: "flame" },
        ],
        presentCharacters: [],
        recentEvents: [],
        playerStats: null,
        personaStats: null,
        fieldLocks: null,
        createdAt: "",
      };
      const mergedPatch = applyTrackerFieldLocksToGameStatePatch(
        { worldCustomFields: [{ name: "Tension", value: "High", icon: "flame" }] },
        currentState,
      );
      assert.deepEqual(mergedPatch.worldCustomFields, [
        { name: "Moon Phase", value: "Waxing", icon: "moon" },
        { name: "Tension", value: "High", icon: "flame" },
      ]);

      const inventorySnapshot = {
        playerStats: JSON.stringify({
          stats: [],
          attributes: null,
          skills: {},
          inventory: [],
          activeQuests: [],
          status: "",
          inventoryTrackerCurrencies: [{ name: "Silver coin", qty: 6 }],
          inventoryTrackerEquipped: [{ name: "Family heirloom longsword" }],
          inventoryTrackerInventory: [{ name: "Billhook" }],
        }),
      };
      const inventoryLockState = {
        ...currentState,
        playerStats: JSON.parse(inventorySnapshot.playerStats),
        fieldLocks: {
          [roleplayInventoryTrackerLockKey("currencies", { name: "Silver coin" }, "qty", 0)]: true,
        },
      };
      const inventoryTrackerPatch = buildLockedInventoryTrackerPatch({
        data: {
          currencies: [
            { name: "Silver coin", qty: 2 },
            { name: " silver  coin ", qty: 3 },
          ],
          equipped: [{ name: "Family heirloom longsword", qty: 1 }],
          inventory: [{ name: "Family heirloom longsword" }, { name: "Scavenged axe", qty: 2 }],
        },
        snapshot: inventorySnapshot,
        lockState: inventoryLockState,
      });
      assert.deepEqual(inventoryTrackerPatch.values, {
        inventoryTrackerCurrencies: [{ name: "Silver coin", qty: 6 }],
        inventoryTrackerEquipped: [{ name: "Family heirloom longsword" }],
        inventoryTrackerInventory: [{ name: "Scavenged axe", qty: 2 }],
      });

      // Explicit incremental groups keep omitted state, while arrays still replace it.
      const itemState = {
        ...inventoryLockState,
        playerStats: {
          ...inventoryLockState.playerStats,
          inventoryTrackerInventory: [{ name: "Billhook" }, { name: "Rope" }, { name: "Map" }],
        },
      };
      const itemSnapshot = { playerStats: JSON.stringify(itemState.playerStats) };
      const incrementalItems = buildLockedInventoryTrackerPatch({
        data: {
          currencies: { updates: [{ name: "Silver coin", qty: 2 }], removed: ["Silver coin"] },
          inventory: { updates: [{ name: " rope ", qty: 3 }, { name: "Key" }], removed: ["Billhook", "unknown"] },
        },
        snapshot: itemSnapshot,
        lockState: itemState,
      });
      assert.deepEqual(incrementalItems.playerStats.inventoryTrackerCurrencies, [{ name: "Silver coin", qty: 6 }]);
      assert.deepEqual(incrementalItems.playerStats.inventoryTrackerInventory, [
        { name: "Rope", qty: 3 },
        { name: "Map" },
        { name: "Key" },
      ]);
      assert.deepEqual(
        buildLockedInventoryTrackerPatch({
          data: { inventory: { updates: [{ name: "Rope", qty: 1 }] } },
          snapshot: { playerStats: incrementalItems.playerStats },
          lockState: null,
        }).playerStats.inventoryTrackerInventory?.find((row) => row.name === "Rope"),
        { name: "Rope" },
        "qty:1 explicitly reduces an existing quantity",
      );
      assert.deepEqual(
        buildLockedInventoryTrackerPatch({
          data: { inventory: { updates: [{ name: "Rope" }] } },
          snapshot: { playerStats: incrementalItems.playerStats },
          lockState: null,
        }).playerStats.inventoryTrackerInventory?.find((row) => row.name === "Rope"),
        { name: "Rope", qty: 3 },
        "omitted quantity preserves the existing total",
      );
      assert.equal(
        itemSnapshot.playerStats,
        JSON.stringify(itemState.playerStats),
        "normalization does not mutate its source",
      );
      assert.deepEqual(
        buildLockedInventoryTrackerPatch({ data: { inventory: [] }, snapshot: itemSnapshot, lockState: null })
          .playerStats.inventoryTrackerInventory,
        [],
        "legacy empty arrays still clear their group",
      );
      assert.equal(
        buildLockedInventoryTrackerPatch({
          data: { inventory: { updates: "bad", removed: ["Map"] } },
          snapshot: itemSnapshot,
          lockState: null,
        }).changed,
        false,
        "malformed operation must not partially delete state",
      );

      const customFields = [
        { name: "Health", value: "10", locked: true },
        { name: "Clue", value: "gate" },
        { name: "Mood", value: "calm" },
      ];
      const customState = {
        ...currentState,
        playerStats: { ...itemState.playerStats, customTrackerFields: customFields },
      };
      const updatedFields = resolveTrackerGroupUpdate(
        {
          updates: [
            { name: "Clue", value: "north gate" },
            { name: "Count", value: "1" },
          ],
          removed: ["Mood", "Health"],
        },
        customFields,
        customState,
        "customTrackerFields",
      )!;
      const customPatch = buildLockedPlayerStatsArrayPatch({
        field: "customTrackerFields",
        values: updatedFields,
        snapshot: { playerStats: customState.playerStats },
        lockState: customState,
      });
      assert.deepEqual(customPatch.values, [
        { name: "Health", value: "10", locked: true },
        { name: "Clue", value: "north gate" },
        { name: "Count", value: "1" },
      ]);

      const attemptedUnlock = resolveTrackerGroupUpdate(
        {
          updates: [
            { name: "Health", value: "0", locked: false },
            { name: "New", value: "kept" },
          ],
          removed: ["Health"],
        },
        customFields,
        customState,
        "customTrackerFields",
      )!;
      const lockedResult = buildLockedPlayerStatsArrayPatch({
        field: "customTrackerFields",
        values: attemptedUnlock,
        snapshot: { playerStats: customState.playerStats },
        lockState: customState,
      });
      assert.deepEqual(lockedResult.values, [...customFields, { name: "New", value: "kept" }]);
      const nextLockedState = { ...customState, playerStats: lockedResult.playerStats };
      const subsequentRemoval = resolveTrackerGroupUpdate(
        { removed: ["Health"] },
        lockedResult.values,
        nextLockedState,
        "customTrackerFields",
      );
      assert.deepEqual(subsequentRemoval, lockedResult.values, "a model update cannot unlock the saved row");

      const trackedCharacters = [
        {
          characterId: "guard-a",
          name: "Guard",
          mood: "calm",
          outfit: "coat",
          customFields: { Goal: "Watch", Secret: "kept" },
          stats: [
            { name: "HP", value: 10, max: 20 },
            { name: "MP", value: 4, max: 5 },
          ],
        },
        { characterId: "guard-b", name: "Guard", mood: "tired" },
        { characterId: "visitor", name: "Visitor", mood: "happy" },
      ];
      const characterState = { ...currentState, presentCharacters: trackedCharacters };
      assert.deepEqual(
        resolveTrackerGroupUpdate(
          { removed: ["guard-a", "Guard"] },
          trackedCharacters,
          characterState,
          "presentCharacters",
        ),
        trackedCharacters.slice(1),
        "removing an ID must not disambiguate a name in the original snapshot",
      );
      assert.deepEqual(
        resolveTrackerGroupUpdate(
          { updates: [{ characterId: "guard-a", name: "Captain" }], removed: ["Guard"] },
          trackedCharacters,
          characterState,
          "presentCharacters",
        ),
        [{ ...trackedCharacters[0], name: "Captain" }, ...trackedCharacters.slice(1)],
        "renaming an ID must not disambiguate a removal from the original snapshot",
      );
      assert.deepEqual(
        resolveTrackerGroupUpdate(
          {
            updates: [
              { characterId: "guard-a", name: "Captain" },
              { name: "Guard", mood: "angry" },
              { characterId: "arrival", name: "Arrival", mood: "calm" },
              { name: "Arrival", mood: "happy" },
            ],
          },
          trackedCharacters,
          characterState,
          "presentCharacters",
        ),
        [
          { ...trackedCharacters[0], name: "Captain" },
          ...trackedCharacters.slice(1),
          { characterId: "arrival", name: "Arrival", mood: "happy" },
        ],
        "renaming cannot disambiguate existing names, while a new row accepts repeated updates",
      );
      const updatedCharacters = resolveTrackerGroupUpdate(
        {
          updates: [
            {
              characterId: "guard-a",
              mood: "alert",
              customFields: { Goal: "Search" },
              stats: [{ name: "HP", value: 9 }],
            },
            { name: "Guard", mood: "wrong" },
            { characterId: "unknown", name: "Guard", mood: "wrong" },
          ],
          removed: ["Guard", "unknown", "visitor"],
        },
        trackedCharacters,
        characterState,
        "presentCharacters",
      )!;
      assert.equal(updatedCharacters.length, 2, "ambiguous names and unknown IDs do not remove or replace characters");
      assert.deepEqual(updatedCharacters[0], {
        ...trackedCharacters[0],
        mood: "alert",
        customFields: { Goal: "Search", Secret: "kept" },
        stats: [
          { name: "HP", value: 9, max: 20 },
          { name: "MP", value: 4, max: 5 },
        ],
      });
      preserveTrackerCharacterUiFields(updatedCharacters, trackedCharacters);
      assert.equal(updatedCharacters.length, 2, "history enrichment must not resurrect a removed character");
      assert.deepEqual(
        resolveTrackerGroupUpdate(
          { removed: ["guard-a", "guard-b", "visitor"] },
          trackedCharacters,
          characterState,
          "presentCharacters",
        ),
        [],
        "explicit removal can remove the last character",
      );
      const lockedCharacterState = {
        ...characterState,
        fieldLocks: { [characterTrackerLockKey(trackedCharacters[0]!, 0, "mood")]: true },
      };
      assert.equal(
        resolveTrackerGroupUpdate(
          { removed: ["guard-a"], updates: [{ characterId: "arrival", name: "Arrival" }] },
          trackedCharacters,
          lockedCharacterState,
          "presentCharacters",
        )?.length,
        4,
        "locked removal does not consume a new arrival",
      );

      const worldOps = { updates: [{ name: "Tension", value: "High" }], removed: ["Moon Phase", "unknown"] };
      const worldPatch = applyTrackerFieldLocksToGameStatePatch({ worldCustomFields: worldOps }, currentState);
      assert.deepEqual(worldPatch.worldCustomFields, [{ name: "Tension", value: "High", icon: "flame" }]);
      const worldStreamPatch = {
        worldCustomFields: { updates: worldPatch.worldCustomFields, removed: ["Moon Phase"] },
      };
      assert.deepEqual(
        applyTrackerFieldLocksToGameStatePatch(worldStreamPatch, currentState).worldCustomFields,
        worldPatch.worldCustomFields,
        "live client merge honors explicit removal",
      );
      assert.deepEqual(
        applyTrackerFieldLocksToGameStatePatch(worldStreamPatch, null).worldCustomFields,
        worldPatch.worldCustomFields,
        "early SSE seeds arrays before a snapshot is loaded",
      );
      const worldLockedState = {
        ...currentState,
        fieldLocks: { [worldCustomFieldTrackerLockKey(currentState.worldCustomFields[0]!, "value", 0)]: true },
      };
      assert.equal(
        (
          applyTrackerFieldLocksToGameStatePatch({ worldCustomFields: worldOps }, worldLockedState)
            .worldCustomFields as unknown as unknown[]
        ).length,
        2,
        "locked world rows survive explicit removal",
      );

      // A group the agent did not mention must survive the turn. Treating an
      // absent key as an empty array silently wipes tracked state (#2370, #2724).
      const partialInventoryPatch = buildLockedInventoryTrackerPatch({
        data: { inventory: [{ name: "Billhook" }, { name: "Rope coil" }] },
        snapshot: inventorySnapshot,
        lockState: { ...inventoryLockState, fieldLocks: {} },
      });
      assert.deepEqual(
        partialInventoryPatch.playerStats.inventoryTrackerCurrencies,
        [{ name: "Silver coin", qty: 6 }],
        "an omitted currencies group must be left unchanged, not cleared",
      );
      assert.deepEqual(
        partialInventoryPatch.playerStats.inventoryTrackerEquipped,
        [{ name: "Family heirloom longsword" }],
        "an omitted equipped group must be left unchanged, not cleared",
      );
      assert.equal(
        "inventoryTrackerCurrencies" in partialInventoryPatch.values,
        false,
        "an untouched group must stay out of the streamed patch",
      );
      assert.equal(
        buildLockedInventoryTrackerPatch({ data: {}, snapshot: inventorySnapshot, lockState: null }).changed,
        false,
        "a result carrying no inventory groups must not rewrite the snapshot",
      );

      const normalizedEquipMovePatch = buildLockedInventoryTrackerPatch({
        data: { equipped: [{ name: "Sword" }] },
        snapshot: {
          playerStats: JSON.stringify({
            inventoryTrackerCurrencies: [],
            inventoryTrackerEquipped: [],
            inventoryTrackerInventory: [{ name: " Sword " }],
          }),
        },
        lockState: null,
      });
      assert.deepEqual(
        normalizedEquipMovePatch.values.inventoryTrackerInventory,
        [],
        "equipping an item must remove a whitespace variant from omitted carried state without lock data",
      );

      // Locks re-append a row the agent dropped, so equipping a locked carried
      // item must not leave a copy behind in the carried list.
      const equipMoveSnapshot = {
        playerStats: JSON.stringify({
          stats: [],
          attributes: null,
          skills: {},
          inventory: [],
          activeQuests: [],
          status: "",
          inventoryTrackerCurrencies: [],
          inventoryTrackerEquipped: [],
          inventoryTrackerInventory: [{ name: "Sword" }],
        }),
      };
      const equipMovePatch = buildLockedInventoryTrackerPatch({
        data: { currencies: [], equipped: [{ name: "Sword" }], inventory: [] },
        snapshot: equipMoveSnapshot,
        lockState: {
          ...currentState,
          playerStats: JSON.parse(equipMoveSnapshot.playerStats),
          fieldLocks: { [roleplayInventoryTrackerLockKey("inventory", { name: "Sword" }, "qty", 0)]: true },
        },
      });
      assert.deepEqual(
        equipMovePatch.values.inventoryTrackerEquipped,
        [{ name: "Sword" }],
        "the equipped row should land",
      );
      assert.deepEqual(
        equipMovePatch.values.inventoryTrackerInventory,
        [],
        "a locked carried row must move when equipped instead of appearing in both lists",
      );

      // Quantities must stay finite: Infinity serializes to null and the row's
      // quantity can no longer be read back as a number.
      const hugeQuantityPatch = buildLockedInventoryTrackerPatch({
        data: {
          inventory: [
            { name: "Coin", qty: Number.MAX_VALUE },
            { name: "Coin", qty: Number.MAX_VALUE },
          ],
        },
        snapshot: { playerStats: JSON.stringify({}) },
        lockState: null,
      });
      const hugeQuantityRow = hugeQuantityPatch.values.inventoryTrackerInventory?.[0];
      assert.equal(hugeQuantityRow?.qty, Number.MAX_SAFE_INTEGER, "quantities must clamp to a safe integer");
      assert.equal(
        JSON.stringify(hugeQuantityPatch.values.inventoryTrackerInventory).includes('"qty":null'),
        false,
        "a persisted quantity must never serialize to null",
      );

      // The normalizer moved to @marinara-engine/shared so hand edits get the same
      // treatment as agent output. Pin the rules it must keep.
      assert.deepEqual(
        normalizeInventoryTrackerRows([
          { name: "  Silver   coin " },
          { name: "silver coin", qty: 5 },
          { name: "" },
          { name: "Rope", qty: -3 },
          "not a row",
        ]),
        [{ name: "Silver coin", qty: 6 }, { name: "Rope" }],
        "shared normalizer must trim, merge by name, drop junk, and floor quantities to 1",
      );
      assert.deepEqual(
        normalizeInventoryTrackerRows([{ name: "New item" }, { name: "New item" }], { merge: false }),
        [{ name: "New item" }, { name: "New item" }],
        "opting out of merging must keep two same-named rows distinct so add-mode can create a second row",
      );

      // findInvalidInventoryTrackerRow is what lets the Agent Suite editor refuse bad
      // input instead of silently normalizing a hand-written group down to [].
      assert.equal(findInvalidInventoryTrackerRow([{ name: "Rope" }]), null, "well-formed rows must validate");
      const detailedItem = {
        name: "Painkillers",
        qty: 3,
        description: "Small white tablets",
        location: "Backpack side pocket",
      };
      assert.deepEqual(normalizeInventoryTrackerRows([detailedItem]), [detailedItem]);
      assert.deepEqual(
        normalizeInventoryTrackerRows([
          { name: "Key", description: "Marked 17" },
          { name: "key", location: "Coat pocket", description: "Ignored duplicate" },
        ]),
        [{ name: "Key", qty: 2, description: "Marked 17", location: "Coat pocket" }],
        "deduplication keeps first details and fills missing fields",
      );
      assert.equal(findInvalidInventoryTrackerRow([detailedItem]), null);
      assert.match(String(findInvalidInventoryTrackerRow([{ name: "Key", description: 42 }])), /description/);
      assert.match(String(findInvalidInventoryTrackerRow([{ name: "Key", location: {} }])), /location/);
      const detailedState = {
        ...currentState,
        playerStats: { ...itemState.playerStats, inventoryTrackerInventory: [detailedItem] },
        fieldLocks: {
          [roleplayInventoryTrackerLockKey("inventory", detailedItem, "description")]: true,
          [roleplayInventoryTrackerLockKey("inventory", detailedItem, "location")]: true,
        },
      };
      const detailPatch = buildLockedInventoryTrackerPatch({
        data: { inventory: { updates: [{ name: "Painkillers", qty: 1, description: "Wrong", location: "Unknown" }] } },
        snapshot: { playerStats: detailedState.playerStats },
        lockState: detailedState,
      });
      const singleItem = {
        name: detailedItem.name,
        description: detailedItem.description,
        location: detailedItem.location,
      };
      assert.deepEqual(
        detailPatch.values.inventoryTrackerInventory,
        [singleItem],
        "quantity changes retain locked details",
      );
      assert.deepEqual(
        buildInventoryTrackerEditPatch(detailedState.playerStats, "inventory", [
          { ...singleItem, description: "", location: "Bedside table" },
        ]).inventoryTrackerInventory,
        [{ ...singleItem, description: "", location: "Bedside table" }],
        "manual edits can explicitly clear details and retain quantity-one metadata",
      );
      assert.match(
        String(findInvalidInventoryTrackerRow([{ foo: 1 }])),
        /row 0/u,
        "a row without a name must be reported, not silently dropped",
      );
      assert.deepEqual(
        normalizeInventoryTrackerRows([{ foo: 1 }]),
        [],
        "normalization stays lossy — which is exactly why the editor validates first",
      );

      // Exclusivity on a payload the agent never produced (a hand edit or direct API call).
      const manualExclusivity = normalizeInventoryTrackerPlayerStats({
        inventoryTrackerEquipped: [{ name: "Short axe" }],
        inventoryTrackerInventory: [{ name: "short  axe" }, { name: "Waterskin" }],
      }) as Record<string, unknown>;
      assert.deepEqual(
        manualExclusivity.inventoryTrackerInventory,
        [{ name: "Waterskin" }],
        "an equipped item must not also sit in carried inventory after a manual write",
      );

      // Absent must never read as empty — the failure mode #5117 fixed on the agent path.
      const untouchedGroups = normalizeInventoryTrackerPlayerStats({
        inventoryTrackerCurrencies: [{ name: "Silver coin", qty: 6 }],
      }) as Record<string, unknown>;
      assert.equal(
        "inventoryTrackerEquipped" in untouchedGroups,
        false,
        "normalizing one group must not materialize the groups the caller never sent",
      );

      // The normalizer repairs the three tracker arrays but hands back anything that is
      // not an object untouched, so the game-state route must reject a non-object
      // `playerStats` itself rather than persist a value that breaks the type contract.
      // `null` stays allowed because that is how a caller clears the stats.
      {
        const gameStateRouteSource = readFileSync(
          new URL("../../../packages/server/src/routes/chats.routes.ts", import.meta.url),
          "utf8",
        );
        assert.match(
          gameStateRouteSource,
          /if \(body\.playerStats !== null && !isRecord\(body\.playerStats\)\)/u,
          "the game-state route must reject a non-object, non-null playerStats payload",
        );
        assert.equal(
          normalizeInventoryTrackerPlayerStats("nope"),
          "nope",
          "the normalizer deliberately passes non-objects through, which is why the route guards the shape",
        );
      }

      // A key sent with a non-array value is a malformed write to repair, not an absent
      // key. Treating the two alike threw on `.filter` and 500'd the game-state route.
      const malformedField = normalizeInventoryTrackerPlayerStats({
        inventoryTrackerEquipped: [{ name: "Rope" }],
        inventoryTrackerInventory: {},
      }) as Record<string, unknown>;
      assert.deepEqual(
        malformedField.inventoryTrackerInventory,
        [],
        "a malformed group must be repaired to an empty list rather than crash or persist as-is",
      );
      assert.deepEqual(
        (normalizeInventoryTrackerPlayerStats({ inventoryTrackerCurrencies: "nope" }) as Record<string, unknown>)
          .inventoryTrackerCurrencies,
        [],
        "a malformed group must be repaired even when it is the only inventory key present",
      );
      assert.equal(
        normalizeInventoryTrackerPlayerStats({ status: "fine" } as Record<string, unknown>) &&
          (normalizeInventoryTrackerPlayerStats({ status: "fine" }) as Record<string, unknown>).status,
        "fine",
        "player-stats fields outside the three inventory groups must pass through untouched",
      );

      // The panel and HUD share this builder; editing one group may rewrite two, and
      // dropping the second field would silently leave the item in both lists.
      const equipMove = buildInventoryTrackerEditPatch(
        {
          stats: [],
          attributes: null,
          skills: {},
          inventory: [],
          activeQuests: [],
          status: "",
          inventoryTrackerEquipped: [],
          inventoryTrackerInventory: [{ name: "Short axe" }, { name: "Waterskin" }],
        },
        "equipped",
        [{ name: "Short axe" }],
      );
      assert.deepEqual(equipMove.inventoryTrackerEquipped, [{ name: "Short axe" }], "the edited group must be written");
      assert.deepEqual(
        equipMove.inventoryTrackerInventory,
        [{ name: "Waterskin" }],
        "equipping a carried item must also rewrite carried inventory in the same patch",
      );
      assert.equal(
        "inventoryTrackerInventory" in
          buildInventoryTrackerEditPatch(
            {
              stats: [],
              attributes: null,
              skills: {},
              inventory: [],
              activeQuests: [],
              status: "",
              inventoryTrackerInventory: [{ name: "Waterskin" }],
            },
            "currencies",
            [{ name: "Silver coin", qty: 6 }],
          ),
        false,
        "an edit that changes nothing else must not rewrite the other groups",
      );

      const nextCharacters: Array<Record<string, unknown>> = [
        {
          characterId: "mira",
          name: "Mira",
          customFields: { Goal: "Find the atlas" },
        },
      ];
      preserveTrackerCharacterUiFields(nextCharacters, [
        {
          characterId: "mira",
          name: "Mira",
          customFields: { "Mental State": "Calm", Goal: "Old goal" },
        },
      ]);
      assert.deepEqual(nextCharacters[0]?.customFields, {
        "Mental State": "Calm",
        Goal: "Find the atlas",
      });

      const recurringHistory = collectLatestTrackerCharacterHistory([
        { presentCharacters: [] },
        {
          presentCharacters: JSON.stringify([
            {
              characterId: "mira-card",
              name: "Mira",
              customFields: { Goal: "Find the atlas" },
              stats: [
                { name: "HP", value: 72, max: 100, color: "#ef4444" },
                { name: "MP", value: 31, max: 80, color: "#3b82f6" },
              ],
            },
          ]),
        },
      ]);
      const returningCharacters: Array<Record<string, unknown>> = [
        {
          characterId: "Mira",
          name: "Mira",
          stats: [{ name: "HP", value: 65, max: 100, color: "#ef4444" }],
          avatarPath: "/api/avatars/npc/chat/mira.png",
        },
      ];
      preserveTrackerCharacterUiFields(returningCharacters, recurringHistory);
      const matchedCards = applyTrackerCharacterCardIdentity(returningCharacters, [
        {
          id: "mira-card",
          name: "Mira",
          avatarPath: "/api/avatars/file/mira.png",
          avatarCrop: { zoom: 2, offsetX: 1, offsetY: 1 },
        },
      ]);
      assert.deepEqual(returningCharacters[0]?.stats, [
        { name: "HP", value: 65, max: 100, color: "#ef4444" },
        { name: "MP", value: 31, max: 80, color: "#3b82f6" },
      ]);
      assert.deepEqual(returningCharacters[0]?.customFields, { Goal: "Find the atlas" });
      assert.equal(returningCharacters[0]?.characterId, "mira-card");
      assert.equal(returningCharacters[0]?.avatarPath, "/api/avatars/file/mira.png");
      assert.equal(matchedCards.has("mira-card"), true);

      const canonicalPartyCharacters: Array<Record<string, unknown>> = [
        {
          name: 'Marisol "Mari"',
          mood: "Concerned",
          appearance: "Expanded-name appearance",
        },
        {
          name: "Mari",
          mood: "Focused",
          appearance: "Canonical-name appearance",
        },
      ];
      const canonicalPartyMatches = applyTrackerCharacterCardIdentity(canonicalPartyCharacters, [
        {
          id: "party-card",
          name: "Mari",
          avatarPath: "/api/avatars/file/party-card.png",
        },
      ]);
      assert.equal(canonicalPartyMatches.has("party-card"), true);
      assert.deepEqual(canonicalPartyCharacters, [
        {
          characterId: "party-card",
          name: "Mari",
          mood: "Focused",
          appearance: "Canonical-name appearance",
          avatarPath: "/api/avatars/file/party-card.png",
          avatarCrop: null,
        },
      ]);

      const unrelatedLongName: Array<Record<string, unknown>> = [{ name: "Mari Calder" }];
      applyTrackerCharacterCardIdentity(unrelatedLongName, [{ id: "party-card", name: "Mari" }]);
      assert.deepEqual(unrelatedLongName, [{ name: "Mari Calder" }]);

      // Multi-character cards: two distinctly named members of one card stay separate.
      const castCard = { id: "resort-card", name: "Vacation Resort", avatarPath: "/api/avatars/file/resort.png" };
      const castBatch: Array<Record<string, unknown>> = [
        { characterId: "resort-card", name: "Ana", mood: "Playful", avatarPath: "/api/avatars/file/resort.png" },
        { characterId: "resort-card", name: "Julia", mood: "Sleeping" },
      ];
      const castMatches = applyTrackerCharacterCardIdentity(castBatch, [castCard]);
      assert.equal(castMatches.has("resort-card"), false);
      assert.deepEqual(castBatch, [
        { characterId: "resort-card:cast:ana", name: "Ana", mood: "Playful", avatarPath: null, avatarCrop: null },
        { characterId: "resort-card:cast:julia", name: "Julia", mood: "Sleeping" },
      ]);

      // A lone member on a later turn keeps the cast identity when earlier state remembers the cast.
      const loneMember: Array<Record<string, unknown>> = [{ characterId: "resort-card", name: "Ana", mood: "Bored" }];
      applyTrackerCharacterCardIdentity(loneMember, [castCard], {
        previousCharacters: [{ characterId: "resort-card:cast:julia", name: "Julia" }],
      });
      assert.deepEqual(loneMember, [{ characterId: "resort-card:cast:ana", name: "Ana", mood: "Bored" }]);

      // A model echoing a cast id resolves to the same member, and duplicates merge.
      const echoedCast: Array<Record<string, unknown>> = [
        { characterId: "resort-card:cast:ana", name: "Ana", mood: "Smug" },
        { characterId: "resort-card", name: "ana", outfit: "hoodie" },
      ];
      applyTrackerCharacterCardIdentity(echoedCast, [castCard]);
      assert.deepEqual(echoedCast, [
        { characterId: "resort-card:cast:ana", name: "ana", mood: "Smug", outfit: "hoodie" },
      ]);

      // Without cast evidence a single differently named entry still canonicalizes to the card.
      const soloAlias: Array<Record<string, unknown>> = [{ characterId: "resort-card", name: "Ana" }];
      const soloMatches = applyTrackerCharacterCardIdentity(soloAlias, [castCard]);
      assert.equal(soloMatches.has("resort-card"), true);
      assert.equal(soloAlias[0]?.name, "Vacation Resort");

      // A card whose text lists its cast is multi-character from the first turn:
      // the old merged row named after the card is dropped, and bare member names link to the card.
      const declaredCastCard = {
        ...castCard,
        description:
          "[PREMISE]\nA trip.\n\n[CHARACTER: Ana]\nFull Name: Ana\nAge: 20\n\n[CHARACTER: Julia]\nFull Name: Julia\nAge: 41",
      };
      assert.deepEqual(extractCharacterCardCastMembers(declaredCastCard), ["Ana", "Julia"]);
      assert.deepEqual(
        extractCharacterCardCastMembers({ name: "Mira", description: "[CHARACTER: Mira]\nA lone knight." }),
        [],
      );
      assert.deepEqual(
        extractCharacterCardCastMembers({
          name: "Party",
          description: "Name: Rook\nRole: scout\n\nName: Vale\nRole: mage",
        }),
        ["Rook", "Vale"],
      );
      assert.deepEqual(
        extractCharacterCardCastMembers({
          name: "Party",
          description: '> **Full Name:** "Rook" (scout)\r\n- _Name_： **Vale** (mage)\r\nName: Rook',
        }),
        ["Rook", "Vale"],
      );
      // Long malformed fields used to trigger polynomial regex backtracking; the runner has a fixed timeout.
      const longWhitespace = " ".repeat(100_000);
      assert.deepEqual(
        extractCharacterCardCastMembers({
          name: "Party",
          description: [
            `Name${longWhitespace}`,
            `Name:${longWhitespace}${"x".repeat(121)}`,
            `Full${longWhitespace}namo: Decoy`,
            `Name: ${"(".repeat(119)}x`,
            `Name:${longWhitespace}Rook (scout)`,
            "Name: Vale (mage)",
          ].join("\n"),
        }),
        ["Rook", "Vale"],
      );
      const declaredBatch: Array<Record<string, unknown>> = [
        {
          characterId: "resort-card",
          name: "Vacation Resort",
          mood: "Excited",
          avatarPath: "/api/avatars/file/resort.png",
        },
        { name: "Julia", mood: "Sleeping" },
      ];
      const declaredMatches = applyTrackerCharacterCardIdentity(declaredBatch, [declaredCastCard]);
      assert.equal(declaredMatches.has("resort-card"), false);
      assert.deepEqual(declaredBatch, [{ characterId: "resort-card:cast:julia", name: "Julia", mood: "Sleeping" }]);

      // A manual row sharing a declared member's name keeps its manual identity and portrait guards.
      const manualMember = {
        characterId: "manual-ana",
        name: "Ana",
        mood: "Calm",
        avatarPath: "/api/avatars/file/manual-ana.png",
        avatarCrop: { zoom: 2, offsetX: 0, offsetY: 0 },
      };
      const manualBatch: Array<Record<string, unknown>> = [{ ...manualMember }];
      assert.equal(applyTrackerCharacterCardIdentity(manualBatch, [declaredCastCard]).size, 0);
      assert.deepEqual(manualBatch, [manualMember]);

      // Preserve a legacy title row until this result actually provides a member to replace it.
      const legacyTitle = {
        characterId: "resort-card",
        name: "Vacation Resort",
        mood: "Excited",
        outfit: "Summer clothes",
        customFields: { Goal: "Reach the resort" },
        avatarPath: "/api/avatars/file/resort.png",
        avatarCrop: null,
      };
      const legacyBatch: Array<Record<string, unknown>> = [{ ...legacyTitle }];
      const legacyMatches = applyTrackerCharacterCardIdentity(legacyBatch, [declaredCastCard], {
        previousCharacters: [{ characterId: "resort-card:cast:julia", name: "Julia" }],
      });
      assert.equal(legacyMatches.has("resort-card"), true);
      assert.deepEqual(legacyBatch, [legacyTitle]);

      // The same replacement rule applies to a cast inferred from this batch or remembered from history.
      for (const rememberedCast of [false, true]) {
        const inferredBatch: Array<Record<string, unknown>> = [
          { ...legacyTitle },
          { characterId: "resort-card", name: "Ana", mood: "Calm" },
          ...(rememberedCast ? [] : [{ characterId: "resort-card", name: "Julia", mood: "Sleeping" }]),
        ];
        const inferredMatches = applyTrackerCharacterCardIdentity(inferredBatch, [castCard], {
          previousCharacters: rememberedCast ? [{ characterId: "resort-card:cast:julia", name: "Julia" }] : [],
        });
        assert.equal(inferredMatches.has("resort-card"), false);
        assert.deepEqual(inferredBatch, [
          { characterId: "resort-card:cast:ana", name: "Ana", mood: "Calm" },
          ...(rememberedCast ? [] : [{ characterId: "resort-card:cast:julia", name: "Julia", mood: "Sleeping" }]),
        ]);
      }

      const ordinaryAliasBatch: Array<Record<string, unknown>> = [
        { ...legacyTitle },
        { characterId: "resort-card", name: "Ana" },
      ];
      assert.equal(applyTrackerCharacterCardIdentity(ordinaryAliasBatch, [castCard]).has("resort-card"), true);
      assert.equal(ordinaryAliasBatch.length, 1, "A lone alias does not establish a multi-character card");
      assert.equal(ordinaryAliasBatch[0]?.name, "Vacation Resort");

      assert.equal(
        canonicalizeGamePartySpeakerLabels(
          '[Marisol "Mari"] [main] [happy]: "Ready."\n\nMarisol "Mari" crosses the room.',
          ["Mari"],
        ),
        '[Mari] [main] [happy]: "Ready."\n\nMarisol "Mari" crosses the room.',
      );
      assert.equal(
        canonicalizeGamePartySpeakerLabels('[Mari Calder] [main] [happy]: "Ready."', ["Mari"]),
        '[Mari Calder] [main] [happy]: "Ready."',
      );

      assert.equal(resolveCharacterCustomFieldName("  ", "Goal"), "Goal");
      assert.equal(makeUniqueCharacterCustomFieldName({ "New Field": "", "new   field 2": "" }), "New Field 3");

      const promptBlock = buildCommittedTrackerContextBlock({
        chatEnableAgents: true,
        activeAgentIds: ["world-state", "character-tracker"],
        latestGameState: {
          date: "12 July",
          location: "The lab",
          worldCustomFields: [
            ...currentState.worldCustomFields,
            { name: "location", value: "Duplicate lab" },
            ...Array.from({ length: MAX_WORLD_CUSTOM_FIELDS_IN_COMMITTED_CONTEXT }, (_, index) => ({
              name: `Field ${index + 1}`,
              value: `${index + 1}`,
            })),
          ],
          presentCharacters: [
            {
              name: "Mira",
              mood: "Calm",
              customFields: { Goal: "Find the atlas", mood: "Duplicate mood" },
            },
          ],
        },
        chatMetadata: {},
        wrapFormat: "markdown",
      });
      assert.match(promptBlock ?? "", /Moon Phase: Waxing/);
      assert.match(promptBlock ?? "", /Goal: Find the atlas/);
      assert.doesNotMatch(promptBlock ?? "", /Duplicate lab/);
      assert.doesNotMatch(promptBlock ?? "", /Duplicate mood/);
      assert.match(promptBlock ?? "", /Field 62: 62/);
      assert.doesNotMatch(promptBlock ?? "", /Field 63: 63/);

      for (const wrapFormat of ["xml", "markdown", "none"] as const) {
        const inventoryPromptBlock = buildCommittedTrackerContextBlock({
          chatEnableAgents: true,
          activeAgentIds: ["inventory-tracker"],
          latestGameState: {
            playerStats: {
              ...inventoryTrackerPatch.playerStats,
              inventoryTrackerInventory: [
                { name: "Scavenged axe", qty: 2, description: "Chipped iron blade", location: "Backpack" },
                { name: "Blank note", description: "", location: "  " },
              ],
            },
          },
          chatMetadata: {},
          wrapFormat,
        });
        assert.match(inventoryPromptBlock ?? "", /Currencies:\n\s*- Silver coin x6/);
        assert.match(inventoryPromptBlock ?? "", /Equipped:\n\s*- Family heirloom longsword/);
        assert.match(
          inventoryPromptBlock ?? "",
          /Inventory:\n\s*- Scavenged axe x2 \(description: Chipped iron blade; location: Backpack\)/,
        );
        assert.doesNotMatch(inventoryPromptBlock ?? "", /Blank note \(/);
      }

      const beholderState = normalizeBeholderState({
        characters: [
          {
            name: "Mira<script>",
            species: "human",
            body: {
              left_hand: {
                holding: { item: "silver key", damage: "pristine" },
                wounds: [{ text: "shallow cut", severity: "minor", bleeding: true }],
              },
              invented_slot: { bare: true },
            },
          },
        ],
      });
      assert.ok(beholderState);
      assert.equal(beholderState.characters[0]?.name, "Mirascript");
      assert.equal("invented_slot" in (beholderState.characters[0]?.body ?? {}), false);

      const beholderPromptBlock = buildCommittedTrackerContextBlock({
        chatEnableAgents: true,
        activeAgentIds: ["beholder"],
        latestGameState: null,
        beholderState,
        chatMetadata: {},
        wrapFormat: "markdown",
      });
      assert.match(beholderPromptBlock ?? "", /## Physical State/u);
      assert.match(beholderPromptBlock ?? "", /left hand: holding: silver key/u);
      assert.match(beholderPromptBlock ?? "", /shallow cut \(minor, bleeding\)/u);
      assert.equal(resolveAgentResultType({ type: "beholder", settings: {} }), "context_injection");
    },
  },
  {
    name: "tracker singleton requests advertise incremental support without changing parsed responses",
    async run() {
      for (const type of ["world-state", "character-tracker", "custom-tracker", "inventory-tracker"]) {
        const output = { fields: { updates: [{ name: "Clue", value: "found" }], removed: [] } };
        const { calls, provider } = makeCapturingProvider(JSON.stringify(output));
        const config = makeRegressionAgentConfig({
          id: `builtin:${type}`,
          type,
          name: type,
          promptTemplate: "Return tracker JSON.",
          settings: {},
        });
        const result = await executeAgent(
          config as any,
          makeRegressionAgentContext(),
          provider as any,
          "regression-model",
        );
        assert.equal(result.success, true);
        assert.deepEqual(result.data, output);
        assert.match(calls[0]!.map((message) => message.content).join("\n"), /tracker_incremental_updates: supported/);
      }
    },
  },
  {
    name: "Beholder sends keyed state and safely resolves delta and legacy responses",
    async run() {
      let stateReads = 0;
      const priorState = await loadPriorBeholderState({
        agentsStore: {
          async getLastSuccessfulRunByType() {
            stateReads += 1;
            return { resultData: `{"characters":[{"name":"Mira","body":{}}]}` };
          },
        },
        chatId: "roleplay-chat",
        chatMode: "roleplay",
        activeAgentIds: ["beholder"],
        chatEnableAgents: true,
      });
      assert.equal(priorState?.characters[0]?.name, "Mira");
      assert.equal(stateReads, 1);
      assert.equal(
        await loadPriorBeholderState({
          agentsStore: {
            async getLastSuccessfulRunByType() {
              stateReads += 1;
              return null;
            },
          },
          chatId: "conversation-chat",
          chatMode: "conversation",
          activeAgentIds: ["beholder"],
          chatEnableAgents: true,
        }),
        null,
      );
      assert.equal(stateReads, 1);
      assert.equal(
        await loadPriorBeholderState({
          agentsStore: {
            async getLastSuccessfulRunByType() {
              stateReads += 1;
              return null;
            },
          },
          chatId: "roleplay-chat-no-prior-run",
          chatMode: "roleplay",
          activeAgentIds: ["beholder"],
          chatEnableAgents: true,
        }),
        null,
      );
      assert.equal(stateReads, 2);

      const previousState = normalizeBeholderState({
        characters: [
          {
            name: "Mari",
            species: "human",
            body: {
              chest: {
                worn: [
                  { item: "dress", color: "blue", damage: "pristine" },
                  { item: "coat", color: "black", damage: "pristine" },
                ],
              },
              face: { worn: [{ item: "veil", damage: "pristine" }] },
              left_hand: { holding: { item: "silver key", damage: "pristine" } },
              right_arm: { wounds: [{ text: "shallow cut", severity: "minor", bleeding: true }] },
            },
          },
          { name: "Dottore", body: { head: { bare: true } } },
        ],
      });
      assert.ok(previousState);
      const requestContext = formatBeholderRequestContext(previousState, "Mari");
      assert.match(requestContext, /^Persona: Mari\nCurrent state:/u);
      assert.match(requestContext, /"self": \{/u);
      assert.match(requestContext, /"Dottore": \{/u);

      const unchanged = resolveBeholderStateResponse({ changed: false }, previousState, "Mari");
      assert.equal(unchanged.valid, true);
      assert.deepEqual(unchanged.state, previousState);

      const merged = resolveBeholderStateResponse(
        {
          changed: true,
          delta: {
            self: {
              body: {
                chest: { worn: [{ item: "dress", color: "red", damage: "damaged" }] },
                face: { worn: [] },
                left_hand: { holding: {} },
                right_arm: {
                  missing: true,
                  worn: [{ item: "bracelet", damage: "pristine" }],
                  wounds: [{ text: "ignored wound", severity: "critical", bleeding: true }],
                  bare: true,
                },
              },
            },
            Dottore: { species: "human", body: { left_eye: { bare: true } } },
            Columbina: { species: "seer", body: { neck: { bare: true } } },
          },
        },
        previousState,
        "Mari",
      );
      assert.equal(merged.valid, true);
      const mergedMari = merged.state.characters.find((character) => character.name === "Mari");
      assert.deepEqual(mergedMari?.body.chest?.worn, [
        { item: "dress", color: "red", damage: "damaged" },
        { item: "coat", color: "black", damage: "pristine" },
      ]);
      assert.equal(mergedMari?.body.face?.worn, undefined);
      assert.equal(mergedMari?.body.left_hand?.holding, undefined);
      // `missing` and `bare` are manual-only: the extractor proposed both on this slot
      // and neither is applied, so what it also reported — the bracelet, and the wound
      // merged against the one already there — is what survives. Before they became
      // manual-only, `missing` took the slot and discarded all of it.
      assert.deepEqual(mergedMari?.body.right_arm, {
        worn: [{ item: "bracelet", damage: "pristine" }],
        wounds: [
          { text: "shallow cut", severity: "minor", bleeding: true },
          { text: "ignored wound", severity: "critical", bleeding: true },
        ],
      });
      assert.equal(merged.state.characters.find((character) => character.name === "Dottore")?.species, "human");
      assert.equal(
        merged.state.characters.some((character) => character.name === "Columbina"),
        true,
      );

      const invalid = resolveBeholderStateResponse(
        { changed: true, delta: { self: { body: { invented_slot: { bare: true } } } } },
        previousState,
        "Mari",
      );
      assert.equal(invalid.valid, false);
      assert.deepEqual(invalid.state, previousState);

      const legacy = resolveBeholderStateResponse(
        { characters: [{ name: "Mira", body: { left_hand: { holding: { item: "key" } } } }] },
        previousState,
        "Mari",
      );
      assert.equal(legacy.valid, true);
      assert.deepEqual(legacy.state.characters, [
        { name: "Mira", body: { left_hand: { holding: { item: "key", damage: "pristine" } } } },
      ]);

      const { calls, callOptions, provider } = makeCapturingProvider(`{"changed":false}`);
      const config = makeRegressionAgentConfig({
        id: "builtin:beholder",
        type: "beholder",
        name: "Beholder",
        promptTemplate: "Return a physical-state delta as JSON.",
        temperature: 1.7,
        settings: { resultType: "context_injection" },
      });
      const context = makeRegressionAgentContext({
        mainResponse: "Mari keeps hold of the silver key.",
        memory: { _beholderState: previousState },
      });
      const result = await executeAgent(config as any, context, provider as any, "regression-model");
      const system = calls[0]?.[0]?.content ?? "";
      const user = calls[0]?.[1]?.content ?? "";
      assert.equal(calls[0]?.[0]?.role, "system");
      assert.equal(calls[0]?.[1]?.role, "user");
      assert.equal(system, "Return a physical-state delta as JSON.");
      assert.match(user, /Persona: Mari\nCurrent state:/u);
      assert.match(user, /"self":\{/u);
      assert.equal(callOptions[0]?.temperature, 0);
      assert.equal(result.success, true);
      assert.deepEqual(result.data, previousState);

      const suppressed = makeCapturingProvider(`{"changed":false}`);
      await executeAgent(
        { ...config, suppressModelParameters: true } as any,
        context,
        suppressed.provider as any,
        "regression-model",
      );
      assert.equal(suppressed.callOptions[0]?.temperature, undefined);

      const firstRun = makeCapturingProvider(`{"changed":false}`);
      const firstRunResult = await executeAgent(
        config as any,
        makeRegressionAgentContext({ memory: {} }),
        firstRun.provider as any,
        "regression-model",
      );
      const firstRunUser = firstRun.calls[0]?.[1]?.content ?? "";
      assert.equal(firstRun.calls[0]?.[0]?.role, "system");
      assert.equal(firstRun.calls[0]?.[1]?.role, "user");
      assert.match(firstRunUser, /^Persona: Mari\nNarration:/u);
      assert.doesNotMatch(firstRunUser, /Current state:/u);
      assert.deepEqual(firstRunResult.data, { characters: [] });

      const invalidRun = makeCapturingProvider(`{"changed":true,"delta":{"self":{"body":{"fake":{}}}}}`);
      const invalidResult = await executeAgent(config as any, context, invalidRun.provider as any, "regression-model");
      assert.equal(invalidResult.success, false);
      assert.deepEqual(invalidResult.data, previousState);
    },
  },
  {
    name: "character tracker receives card RPG configuration and recurring-character history",
    async run() {
      const { calls, provider } = makeCapturingProvider(`{"presentCharacters":[]}`);
      const config = makeRegressionAgentConfig({
        id: "builtin:character-tracker",
        type: "character-tracker",
        name: "Character Tracker",
        promptTemplate: getDefaultAgentPrompt("character-tracker") || "Track characters.",
        settings: { resultType: "character_tracker_update" },
      });
      const context = makeRegressionAgentContext({
        characters: [
          {
            id: "mira-card",
            name: "Mira",
            description: "A recurring alchemist.",
            rpgStats: {
              enabled: true,
              hp: { value: 90, max: 100 },
              pools: [{ name: "HP", value: 90, max: 100, color: "#ef4444" }],
              attributes: [{ name: "INT", value: 18 }],
            },
          },
        ],
        characterTrackerHistory: [
          {
            characterId: "mira-card",
            name: "Mira",
            emoji: "⚗️",
            mood: "Focused",
            appearance: null,
            outfit: null,
            thoughts: null,
            customFields: {},
            stats: [{ name: "HP", value: 72, max: 100, color: "#ef4444" }],
          },
        ],
      });
      await executeAgent(config as any, context, provider as any, "regression-model");
      const system = calls[0]?.[0]?.content ?? "";
      assert.match(system, /Configured RPG pools: HP: 90\/100/u);
      assert.match(system, /Configured RPG attributes: INT: 18/u);
      assert.match(system, /<character_tracker_history>/u);
      assert.match(system, /this list does not mean everyone is present now/u);
      assert.match(system, /"value":72/u);
    },
  },
];

await runNamedCases(cases);
