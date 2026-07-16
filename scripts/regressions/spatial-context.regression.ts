import assert from "node:assert/strict";
import type {
  ResolvedOwnerSpatialProjection,
  SpatialContextDefinition,
  SpatialDefinitionIssueCode,
  SpatialLocation,
} from "../../packages/shared/src/index.js";
import {
  registerCapabilityService,
  resetCapabilityServices,
} from "../../packages/server/src/services/capability-packages/capability-service-registry.service.js";
import {
  resolveSpatialBreadcrumb,
  resolveSpatialDestinations,
  spatialContextDefinitionSchema,
  spatialContextSnapshotSchema,
  validateSpatialArchive,
  validateSpatialContextDefinition,
  validateSpatialTransition,
} from "../../packages/shared/src/index.js";
import {
  buildOwnerSpatialProjection,
  formatOwnerSpatialBreadcrumb,
  formatOwnerSpatialPrompt,
  injectOwnerSpatialPrompt,
  omitAuthoritativeGameLocation,
  projectGameSnapshotLocation,
} from "../../packages/server/src/services/spatial-context/projection.js";
import {
  GameMapBindingError,
  updateGameMapBinding,
} from "../../packages/server/src/services/spatial-context/game-map-binding.js";
import { ensureTimestampAfter } from "../../packages/server/src/services/import/import-timestamps.js";
import { resolveVisibleGameStateAnchor } from "../../packages/server/src/routes/generate/generate-route-utils.js";

assert.equal(ensureTimestampAfter("2026-07-16T07:47:03.766Z", "2026-07-16T07:47:03.765Z"), "2026-07-16T07:47:03.766Z");
assert.equal(ensureTimestampAfter("2026-07-16T07:47:03.765Z", "2026-07-16T07:47:03.765Z"), "2026-07-16T07:47:03.766Z");
assert.equal(ensureTimestampAfter("2026-07-16T07:47:03.700Z", "2026-07-16T07:47:03.765Z"), "2026-07-16T07:47:03.766Z");
assert.deepEqual(
  resolveVisibleGameStateAnchor([
    { id: "assistant-anchor", role: "assistant", activeSwipeIndex: 2 },
    { id: "ordinary-system", role: "system", extra: {} },
  ]),
  { messageId: "assistant-anchor", swipeIndex: 2 },
);
assert.deepEqual(
  resolveVisibleGameStateAnchor([
    { id: "assistant-anchor", role: "assistant", activeSwipeIndex: 2 },
    {
      id: "checkpoint-anchor",
      role: "system",
      extra: JSON.stringify({ gameStateAnchor: "checkpoint_restore" }),
    },
  ]),
  { messageId: "checkpoint-anchor", swipeIndex: 0 },
);

function location(
  id: string,
  name: string,
  overrides: Partial<Omit<SpatialLocation, "id" | "name">> = {},
): SpatialLocation {
  return {
    id,
    name,
    parentId: null,
    kind: "place",
    description: `Description for ${name}.`,
    lorebookEntryIds: [],
    childPresentation: "list",
    links: [],
    status: "active",
    sortOrder: 0,
    ...overrides,
  };
}

function definition(
  locations: SpatialLocation[],
  overrides: Partial<Omit<SpatialContextDefinition, "locations">> = {},
): SpatialContextDefinition {
  return {
    schemaVersion: 1,
    ownerMode: "roleplay",
    enabled: true,
    locations,
    startingLocationId: locations[0]?.id ?? null,
    revision: 4,
    ...overrides,
  };
}

function issueCodes(value: SpatialContextDefinition): SpatialDefinitionIssueCode[] {
  return validateSpatialContextDefinition(value).issues.map((entry) => entry.code);
}

const snapshotInput = {
  id: "snapshot-1",
  chatId: "chat-1",
  messageId: "message-1",
  swipeIndex: 0,
  currentLocationId: null,
  definitionRevision: 0,
  source: "bootstrap" as const,
  transitionCommandId: null,
  transitionPayloadHash: null,
  createdAt: new Date(0).toISOString(),
};
assert.equal(spatialContextSnapshotSchema.safeParse(snapshotInput).success, true);
assert.equal(spatialContextSnapshotSchema.safeParse({ ...snapshotInput, messageId: "" }).success, false);

const validDefinition = definition(
  [
    location("world", "Known World", {
      kind: "region",
      childPresentation: "map",
    }),
    location("capital", "Capital City", {
      parentId: "world",
      kind: "settlement",
      childPresentation: "map",
      placement: { x: 52, y: 45 },
    }),
    location("market", "Market", {
      parentId: "capital",
      placement: { x: 22, y: 70 },
      sortOrder: 2,
    }),
    location("tower", "Wizard Tower", {
      parentId: "capital",
      kind: "building",
      childPresentation: "layers",
      lorebookEntryIds: ["lore_parent"],
      placement: { x: 72, y: 30 },
      sortOrder: 1,
    }),
    location("tower_ground", "Ground Floor", {
      parentId: "tower",
      kind: "floor",
      layerOrder: 0,
      sortOrder: 0,
    }),
    location("tower_library", "Library", {
      parentId: "tower",
      kind: "floor",
      layerOrder: 1,
      sortOrder: 1,
      modelMemory: "The restricted shelf conceals a key.",
      lorebookEntryIds: ["lore_library"],
      links: [
        {
          targetId: "tower",
          label: "Stairs down",
          bidirectional: false,
          state: "available",
        },
        {
          targetId: "market",
          label: "Secret passage",
          bidirectional: false,
          state: "hidden",
        },
      ],
    }),
    location("tower_observatory", "Observatory", {
      parentId: "tower",
      kind: "floor",
      layerOrder: 2,
      sortOrder: 2,
      links: [
        {
          targetId: "tower_library",
          label: "Spiral stairs",
          bidirectional: true,
          state: "available",
        },
      ],
    }),
  ],
  { startingLocationId: "tower_library" },
);

assert.deepEqual(validateSpatialContextDefinition(validDefinition), { valid: true, issues: [] });
assert.equal(spatialContextDefinitionSchema.safeParse(validDefinition).success, true);
const legacyDefinitionWithoutLoreRefs = JSON.parse(JSON.stringify(validDefinition)) as Record<string, unknown>;
for (const legacyLocation of legacyDefinitionWithoutLoreRefs.locations as Array<Record<string, unknown>>) {
  delete legacyLocation.lorebookEntryIds;
}
const parsedLegacyDefinition = spatialContextDefinitionSchema.parse(legacyDefinitionWithoutLoreRefs);
assert.ok(parsedLegacyDefinition.locations.every((entry) => entry.lorebookEntryIds.length === 0));

// AI map drafting and normalization are package-owned and tested in Pasta-Devs/Marinara-Agents.
assert.deepEqual(
  resolveSpatialBreadcrumb(validDefinition, "tower_library").map((entry) => entry.id),
  ["world", "capital", "tower", "tower_library"],
);
assert.deepEqual(resolveSpatialBreadcrumb(validDefinition, "missing"), []);

const libraryDestinations = resolveSpatialDestinations(validDefinition, "tower_library");
assert.deepEqual(
  libraryDestinations.map((entry) => ({ id: entry.id, relation: entry.relation })),
  [
    { id: "tower", relation: "leave" },
    { id: "tower_observatory", relation: "link" },
  ],
);
assert.equal(
  libraryDestinations.some((entry) => entry.id === "market"),
  false,
);

assert.deepEqual(
  resolveSpatialDestinations(validDefinition, "tower").map((entry) => ({
    id: entry.id,
    relation: entry.relation,
  })),
  [
    { id: "capital", relation: "leave" },
    { id: "tower_ground", relation: "enter" },
    { id: "tower_library", relation: "enter" },
    { id: "tower_observatory", relation: "enter" },
  ],
);

const acceptedTransition = validateSpatialTransition(validDefinition, "tower_library", {
  destinationId: "tower_observatory",
  expectedDefinitionRevision: 4,
  expectedCurrentLocationId: "tower_library",
  commandId: "move-1",
});
assert.equal(acceptedTransition.ok, true);
if (acceptedTransition.ok) {
  assert.equal(acceptedTransition.destination.relation, "link");
}

assert.deepEqual(
  validateSpatialTransition(validDefinition, "tower_library", {
    destinationId: "tower_observatory",
    expectedDefinitionRevision: 3,
    expectedCurrentLocationId: "tower_library",
    commandId: "move-2",
  }),
  {
    ok: false,
    code: "spatial_transition_stale_definition",
    message: "The hierarchical map changed. Review the available destinations.",
  },
);
assert.equal(
  validateSpatialTransition(validDefinition, "tower_library", {
    destinationId: "tower_observatory",
    expectedDefinitionRevision: 4,
    expectedCurrentLocationId: "tower_ground",
    commandId: "move-3",
  }).ok,
  false,
);
assert.deepEqual(
  validateSpatialTransition(validDefinition, "tower_library", {
    destinationId: "market",
    expectedDefinitionRevision: 4,
    expectedCurrentLocationId: "tower_library",
    commandId: "move-4",
  }),
  {
    ok: false,
    code: "spatial_destination_unreachable",
    message: "The selected destination is not reachable from the current location.",
  },
);

assert.equal(
  validateSpatialArchive(validDefinition, "tower_library", {
    currentLocationId: "tower_library",
  }).ok,
  false,
);
assert.deepEqual(
  validateSpatialArchive(validDefinition, "tower_library", {
    currentLocationId: "tower_library",
    replacementLocationId: "tower_ground",
  }),
  { ok: true },
);
assert.equal(
  validateSpatialArchive(validDefinition, "tower", {
    currentLocationId: "tower_library",
  }).ok,
  false,
);

const duplicateIds = definition([location("same", "First"), location("same", "Second")]);
assert.ok(issueCodes(duplicateIds).includes("duplicate_location_id"));
assert.equal(spatialContextDefinitionSchema.safeParse(duplicateIds).success, false);

const duplicateLoreRefs = definition([
  location("duplicate_lore", "Duplicate Lore", {
    lorebookEntryIds: ["entry_same", "entry_same"],
  }),
]);
assert.ok(issueCodes(duplicateLoreRefs).includes("duplicate_lorebook_entry_id"));
assert.equal(spatialContextDefinitionSchema.safeParse(duplicateLoreRefs).success, false);

const missingParent = definition([location("orphan", "Orphan", { parentId: "missing" })]);
assert.ok(issueCodes(missingParent).includes("parent_missing"));

const parentCycle = definition(
  [location("cycle_a", "Cycle A", { parentId: "cycle_b" }), location("cycle_b", "Cycle B", { parentId: "cycle_a" })],
  { startingLocationId: "cycle_a" },
);
assert.ok(issueCodes(parentCycle).includes("parent_cycle"));

const deepLocations = Array.from({ length: 21 }, (_, index) =>
  location(`depth_${index}`, `Depth ${index}`, {
    parentId: index === 0 ? null : `depth_${index - 1}`,
  }),
);
assert.ok(issueCodes(definition(deepLocations)).includes("maximum_depth_exceeded"));

const invalidLayers = definition(
  [
    location("layer_parent", "Layer Parent", { childPresentation: "layers" }),
    location("layer_one", "Layer One", { parentId: "layer_parent", layerOrder: 1 }),
    location("layer_two", "Layer Two", { parentId: "layer_parent", layerOrder: 1 }),
    location("layer_missing", "Layer Missing", { parentId: "layer_parent" }),
  ],
  { startingLocationId: "layer_one" },
);
assert.ok(issueCodes(invalidLayers).includes("duplicate_layer_order"));
assert.ok(issueCodes(invalidLayers).includes("layer_order_missing"));

const missingLink = definition([
  location("link_source", "Link Source", {
    links: [
      {
        targetId: "missing_target",
        bidirectional: false,
        state: "available",
      },
    ],
  }),
]);
assert.ok(issueCodes(missingLink).includes("link_target_missing"));

const manyLinkTargets = Array.from({ length: 51 }, (_, index) =>
  location(`link_target_${index}`, `Link Target ${index}`),
);
const tooManyLinks = definition([
  location("many_links", "Many Links", {
    links: manyLinkTargets.map((target) => ({
      targetId: target.id,
      bidirectional: false,
      state: "available",
    })),
  }),
  ...manyLinkTargets,
]);
assert.ok(issueCodes(tooManyLinks).includes("too_many_links"));
assert.equal(spatialContextDefinitionSchema.safeParse(tooManyLinks).success, false);

assert.equal(
  spatialContextDefinitionSchema.safeParse({
    ...validDefinition,
    ownerMode: "conversation",
  }).success,
  false,
);
assert.equal(
  spatialContextDefinitionSchema.safeParse({
    ...validDefinition,
    locations: validDefinition.locations.map((entry) =>
      entry.id === "capital" ? { ...entry, placement: { x: 101, y: 50 } } : entry,
    ),
  }).success,
  false,
);
assert.equal(
  spatialContextDefinitionSchema.safeParse({
    ...validDefinition,
    locations: Array.from({ length: 501 }, (_, index) => location(`wide_${index}`, `Wide ${index}`)),
  }).success,
  false,
);

resetCapabilityServices();

assert.throws(
  () =>
    updateGameMapBinding(
      {},
      {
        target: "map",
        mapId: "missing-map",
        spatialLocationId: "tower",
      },
    ),
  (error: unknown) =>
    error instanceof GameMapBindingError &&
    error.code === "feature_unavailable" &&
    error.message === "Hierarchical Maps is not active.",
);

const fallbackProjection: ResolvedOwnerSpatialProjection = {
  kind: "owner",
  chatId: "chat-roleplay",
  ownerMode: "roleplay",
  definitionRevision: 4,
  currentLocationId: "tower_library",
  breadcrumb: [
    { id: "world", name: "Known World" },
    { id: "tower_library", name: "Library" },
  ],
  description: "The library.",
  modelMemory: "A hidden key.",
  lorebookEntryIds: ["lore_library"],
  destinations: [],
  omittedDestinationCount: 0,
};
const fallbackMessages = [
  { role: "system" as const, content: "Base instructions" },
  { role: "user" as const, content: "Hello" },
];
const fallbackSnapshot = { location: "Model guess", weather: "Rain" };
const fallbackPatch = { location: "Model guess", time: "Noon" };
assert.equal(buildOwnerSpatialProjection("chat-roleplay", validDefinition, "tower_library"), null);
assert.equal(formatOwnerSpatialBreadcrumb(fallbackProjection), "Known World > Library");
assert.equal(formatOwnerSpatialPrompt(fallbackProjection), "");
assert.equal(injectOwnerSpatialPrompt(fallbackMessages, fallbackProjection), fallbackMessages);
assert.equal(projectGameSnapshotLocation(fallbackSnapshot, fallbackProjection), fallbackSnapshot);
assert.equal(omitAuthoritativeGameLocation(fallbackPatch, fallbackProjection), fallbackPatch);

const delegatedProjection = { ...fallbackProjection, description: "Delegated package projection." };
const delegatedMessages = [{ role: "system" as const, content: "<delegated />" }];
const removeProjectionService = registerCapabilityService("hierarchical-maps:projection", {
  buildOwnerSpatialProjection: () => delegatedProjection,
  formatOwnerSpatialBreadcrumb: () => "Delegated > Breadcrumb",
  formatOwnerSpatialPrompt: () => "<delegated-spatial-context />",
  injectOwnerSpatialPrompt: () => delegatedMessages,
  projectGameSnapshotLocation: (snapshot: object | null) =>
    snapshot ? { ...snapshot, location: "Delegated > Breadcrumb" } : null,
  omitAuthoritativeGameLocation: (patch: Record<string, unknown>) => {
    const { location: _location, ...remaining } = patch;
    return remaining;
  },
});
const removeGameMapBindingService = registerCapabilityService("hierarchical-maps:game-map-binding", {
  updateGameMapBinding: (metadata: Record<string, unknown>, input: Record<string, unknown>) => ({
    ...metadata,
    delegatedBinding: input,
  }),
});

assert.equal(buildOwnerSpatialProjection("chat-roleplay", validDefinition, "tower_library"), delegatedProjection);
assert.equal(formatOwnerSpatialBreadcrumb(delegatedProjection), "Delegated > Breadcrumb");
assert.equal(formatOwnerSpatialPrompt(delegatedProjection), "<delegated-spatial-context />");
assert.equal(injectOwnerSpatialPrompt(fallbackMessages, delegatedProjection), delegatedMessages);
assert.deepEqual(projectGameSnapshotLocation(fallbackSnapshot, delegatedProjection), {
  location: "Delegated > Breadcrumb",
  weather: "Rain",
});
assert.deepEqual(omitAuthoritativeGameLocation(fallbackPatch, delegatedProjection), { time: "Noon" });
assert.deepEqual(
  updateGameMapBinding(
    { existing: true },
    {
      target: "node",
      mapId: "tower-map",
      nodeId: "library-node",
      spatialLocationId: "tower_library",
    },
  ),
  {
    existing: true,
    delegatedBinding: {
      target: "node",
      mapId: "tower-map",
      nodeId: "library-node",
      spatialLocationId: "tower_library",
    },
  },
);

removeGameMapBindingService();
removeProjectionService();
resetCapabilityServices();

process.stdout.write("Spatial context regression passed.\n");
