import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  resolveSpatialRoute,
  spatialContextDefinitionSchema,
  spatialContextSnapshotSchema,
  pendingSpatialTransitionSchema,
  validateSpatialArchive,
  validateSpatialContextDefinition,
  validateSpatialTransition,
} from "../../packages/shared/src/index.js";
import {
  buildOwnerSpatialProjection,
  formatOwnerSpatialBreadcrumb,
  formatOwnerSpatialPrompt,
  injectOwnerSpatialPrompt,
  isHierarchicalMapsEnabledForChat,
  omitAuthoritativeGameLocation,
  projectGameSnapshotLocation,
  resolveOwnerSpatialProjection,
} from "../../packages/server/src/services/spatial-context/projection.js";
import {
  GameMapBindingError,
  updateGameMapBinding,
} from "../../packages/server/src/services/spatial-context/game-map-binding.js";
import {
  createAssistantSpatialDirectiveStreamFilter,
  extractAssistantSpatialDirective,
  materializeAssistantSpatialState,
  resolveEffectiveSpatialState,
} from "../../packages/server/src/services/spatial-context/state-resolution.js";
import { ensureTimestampAfter } from "../../packages/server/src/services/import/import-timestamps.js";
import { resolveVisibleGameStateAnchor } from "../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  resolveAlreadyAppliedSpatialTurn,
  resolveSpatialGenerationOrigin,
  shouldSaveHiddenGenerationAnchor,
  shouldSuppressAssistantSpatialMutation,
  validateSpatialGenerationRequest,
} from "../../packages/server/src/routes/generate/spatial-transition-request.js";
import { buildCyoaChoiceSubmissionPayload } from "../../packages/client/src/components/chat/cyoa-choice-submission.js";
import {
  shouldKeepPendingSpatialTransition,
  spatialOwnerTurnRecoveryPath,
} from "../../packages/client/src/hooks/spatial-owner-turn-recovery.js";
import { mergeSpatialLocationReferenceImages } from "../../packages/server/src/services/image/spatial-location-reference.js";
import {
  buildInitialGameMapPatch,
  resolveGameStartWorldMapPatch,
  resolveInitialMapLocationName,
} from "../../packages/server/src/services/game/world-map-mode.js";

assert.equal(ensureTimestampAfter("2026-07-16T07:47:03.766Z", "2026-07-16T07:47:03.765Z"), "2026-07-16T07:47:03.766Z");
assert.equal(ensureTimestampAfter("2026-07-16T07:47:03.765Z", "2026-07-16T07:47:03.765Z"), "2026-07-16T07:47:03.766Z");
assert.equal(ensureTimestampAfter("2026-07-16T07:47:03.700Z", "2026-07-16T07:47:03.765Z"), "2026-07-16T07:47:03.766Z");
const impersonatedMove = {
  destinationId: "harbor",
  expectedDefinitionRevision: 4,
  expectedCurrentLocationId: "world",
  commandId: "impersonated-owner-move",
};
assert.equal(
  validateSpatialGenerationRequest({
    mode: "roleplay",
    origin: "owner",
    pendingSpatialTransition: impersonatedMove,
    impersonate: true,
  }),
  null,
  "Roleplay impersonation is a generated owner turn and may commit its queued move",
);
assert.equal(
  validateSpatialGenerationRequest({
    mode: "roleplay",
    origin: "guided",
    pendingSpatialTransition: null,
    impersonate: false,
  }),
  null,
  "Guided assistant generation does not submit the queued owner move",
);
assert.equal(
  shouldSaveHiddenGenerationAnchor({
    impersonate: true,
    hasActionableOutput: false,
    spatialDirectiveDetected: true,
  }),
  true,
  "A suppressed impersonated spatial directive still saves a hidden anchor",
);
assert.equal(
  shouldSaveHiddenGenerationAnchor({
    impersonate: false,
    hasActionableOutput: false,
    spatialDirectiveDetected: true,
  }),
  true,
  "A suppressed queued-owner spatial directive still saves a hidden anchor",
);
assert.equal(
  shouldSaveHiddenGenerationAnchor({
    impersonate: true,
    hasActionableOutput: true,
    spatialDirectiveDetected: false,
  }),
  false,
  "Impersonated non-spatial command-only output keeps the existing empty-response behavior",
);
assert.deepEqual(
  validateSpatialGenerationRequest({
    mode: "game",
    origin: "owner",
    pendingSpatialTransition: impersonatedMove,
    impersonate: true,
  }),
  {
    statusCode: 400,
    error: "Impersonated hierarchical location changes are only available in Roleplay mode.",
    code: "spatial_mode_unsupported",
  },
);
assert.deepEqual(
  validateSpatialGenerationRequest({
    mode: "roleplay",
    origin: "owner",
    pendingSpatialTransition: impersonatedMove,
    regenerateMessageId: "assistant-message",
  }),
  {
    statusCode: 400,
    error: "A hierarchical location change must be submitted as a new owner turn.",
    code: "spatial_transition_requires_new_turn",
  },
);
for (const origin of ["guided", "autonomous", "turn_game"] as const) {
  assert.deepEqual(
    validateSpatialGenerationRequest({
      mode: "roleplay",
      origin,
      pendingSpatialTransition: impersonatedMove,
    }),
    {
      statusCode: 400,
      error: "A hierarchical location change must be submitted as a new owner turn.",
      code: "spatial_transition_requires_new_turn",
    },
  );
}
assert.equal(resolveSpatialGenerationOrigin({}), "owner");
assert.equal(resolveSpatialGenerationOrigin({ generationGuide: "Continue as the shopkeeper." }), "guided");
assert.equal(resolveSpatialGenerationOrigin({ generationGuideSource: "narrator" }), "guided");
assert.equal(resolveSpatialGenerationOrigin({ turnGameBots: true }), "turn_game");
assert.equal(resolveSpatialGenerationOrigin({ autonomous: true }), "autonomous");
assert.equal(shouldSuppressAssistantSpatialMutation({}), false);
assert.equal(shouldSuppressAssistantSpatialMutation({ impersonate: true }), true);
assert.equal(
  shouldSuppressAssistantSpatialMutation({ pendingSpatialTransition: impersonatedMove }),
  true,
  "Queued owner travel suppresses competing assistant spatial mutations",
);
const standardChoiceSubmission = buildCyoaChoiceSubmissionPayload({
  chatId: "chat-choice",
  text: "Take the bridge",
  pendingSpatialTransition: impersonatedMove,
});
const impersonatedChoiceSubmission = buildCyoaChoiceSubmissionPayload({
  chatId: "chat-choice",
  text: "Take the bridge",
  pendingSpatialTransition: impersonatedMove,
  impersonation: { presetId: "preset-1", promptTemplate: "  Stay in character.  " },
});
assert.equal(standardChoiceSubmission.pendingSpatialTransition, impersonatedMove);
assert.equal(impersonatedChoiceSubmission.pendingSpatialTransition, impersonatedMove);
assert.equal(impersonatedChoiceSubmission.impersonate, true);
assert.equal(impersonatedChoiceSubmission.impersonatePromptTemplate, "Stay in character.");
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

const stagedSetupMap = {
  type: "node" as const,
  name: "Starting Coast",
  description: "The setup-generated recovery map.",
  nodes: [{ id: "region_1", emoji: "⚓", label: "Gloam Harbor", x: 50, y: 50, discovered: true }],
  edges: [],
  partyPosition: "region_1",
};
const hierarchicalSetupConfig = {
  genre: "Fantasy",
  setting: "A fogbound coast",
  tone: "Heroic",
  difficulty: "Normal",
  playerGoals: "Explore",
  gmMode: "standalone" as const,
  rating: "sfw" as const,
  partyCharacterIds: [],
  enableAgents: true,
  gameWorldMapMode: "hierarchical" as const,
};
const stagedMapPatch = buildInitialGameMapPatch({}, hierarchicalSetupConfig, stagedSetupMap);
assert.equal(stagedMapPatch.gameMap, null);
assert.deepEqual(stagedMapPatch.gameMaps, []);
assert.equal(stagedMapPatch.activeGameMapId, null);
assert.equal((stagedMapPatch.gameInitialMapFallback as { name: string }).name, "Starting Coast");
assert.equal(resolveInitialMapLocationName(stagedSetupMap, "region_1"), "Gloam Harbor");
const standardMapPatch = buildInitialGameMapPatch(
  {},
  { ...hierarchicalSetupConfig, gameWorldMapMode: "standard" },
  stagedSetupMap,
);
assert.equal((standardMapPatch.gameMap as { name: string }).name, "Starting Coast");
assert.equal((standardMapPatch.gameMaps as unknown[]).length, 1);
assert.equal(standardMapPatch.gameInitialMapFallback, null);

const validGameHierarchy = definition(
  [location("world", "Known World", { kind: "region", childPresentation: "map" })],
  { ownerMode: "game", startingLocationId: "world" },
);
const hierarchicalStart = resolveGameStartWorldMapPatch({
  gameSetupConfig: hierarchicalSetupConfig,
  gameInitialMapFallback: stagedMapPatch.gameInitialMapFallback,
  gameMap: null,
  gameMaps: [],
  activeGameMapId: null,
  enableAgents: true,
  activeAgentIds: ["hierarchical-maps"],
  spatialContext: validGameHierarchy,
});
assert.equal(hierarchicalStart.resolution, "hierarchical");
assert.equal(hierarchicalStart.patch.gameInitialMapFallback, null);
assert.deepEqual(hierarchicalStart.patch.gameMaps, []);

const fallbackStart = resolveGameStartWorldMapPatch({
  gameSetupConfig: hierarchicalSetupConfig,
  gameInitialMapFallback: stagedMapPatch.gameInitialMapFallback,
  enableAgents: true,
  activeAgentIds: ["hierarchical-maps"],
});
assert.equal(fallbackStart.resolution, "standard_fallback");
assert.equal((fallbackStart.patch.gameMap as { name: string }).name, "Starting Coast");
assert.equal((fallbackStart.patch.gameSetupConfig as { gameWorldMapMode: string }).gameWorldMapMode, "standard");

const maplessStart = resolveGameStartWorldMapPatch({
  gameSetupConfig: hierarchicalSetupConfig,
  enableAgents: true,
  activeAgentIds: ["hierarchical-maps"],
});
assert.equal(maplessStart.resolution, "standard_mapless");
assert.equal(maplessStart.patch.gameMap, null);
assert.equal((maplessStart.patch.gameSetupConfig as { gameWorldMapMode: string }).gameWorldMapMode, "standard");

const standardStart = resolveGameStartWorldMapPatch({
  gameSetupConfig: { ...hierarchicalSetupConfig, gameWorldMapMode: "standard" },
  gameMap: stagedSetupMap,
});
assert.deepEqual(standardStart, { patch: {}, resolution: "unchanged" });

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
assert.equal(
  pendingSpatialTransitionSchema.safeParse({
    destinationId: "market",
    travelMode: "step_by_step",
    expectedDefinitionRevision: 4,
    expectedCurrentLocationId: "tower_library",
    commandId: "route-schema-1",
  }).success,
  true,
  "Travel mode is accepted as an optional pending-transition field",
);
assert.deepEqual(
  resolveAlreadyAppliedSpatialTurn({
    code: "spatial_transition_already_applied",
    details: {
      messageId: snapshotInput.messageId,
      snapshot: snapshotInput,
      travel: {
        mode: "step_by_step",
        fromLocationId: "tower_library",
        targetLocationId: "market",
        routeLocationIds: ["tower", "capital", "market"],
        remainingLocationIds: ["capital", "market"],
        complete: false,
      },
    },
  }),
  {
    messageId: "message-1",
    swipeIndex: 0,
    currentLocationId: null,
    definitionRevision: 0,
    travel: {
      mode: "step_by_step",
      fromLocationId: "tower_library",
      targetLocationId: "market",
      routeLocationIds: ["tower", "capital", "market"],
      remainingLocationIds: ["capital", "market"],
      complete: false,
    },
  },
  "Already-applied generated owner turns recover the original persisted message and snapshot",
);
assert.equal(
  resolveAlreadyAppliedSpatialTurn({ code: "spatial_transition_stale_location" }),
  null,
  "Rejected spatial transitions must not enter the idempotent success path",
);
const recoveryPath = spatialOwnerTurnRecoveryPath("chat/recovery", {
  ...impersonatedMove,
  travelMode: "step_by_step",
});
const recoveryUrl = new URL(recoveryPath, "http://localhost");
assert.equal(recoveryUrl.pathname, "/chats/chat%2Frecovery/spatial-context/turn/impersonated-owner-move");
assert.equal(recoveryUrl.searchParams.get("destinationId"), "harbor");
assert.equal(recoveryUrl.searchParams.get("travelMode"), "step_by_step");
assert.equal(recoveryUrl.searchParams.get("expectedDefinitionRevision"), "4");
assert.equal(recoveryUrl.searchParams.get("expectedCurrentLocationId"), "world");
assert.equal(
  shouldKeepPendingSpatialTransition({
    mode: "step_by_step",
    fromLocationId: "world",
    targetLocationId: "harbor",
    routeLocationIds: ["road", "harbor"],
    remainingLocationIds: ["harbor"],
    complete: false,
  }),
  true,
);
assert.equal(
  shouldKeepPendingSpatialTransition({
    mode: "step_by_step",
    fromLocationId: "road",
    targetLocationId: "harbor",
    routeLocationIds: ["harbor"],
    remainingLocationIds: [],
    complete: true,
  }),
  false,
  "Completed stepwise recovery clears the pending transition",
);
assert.deepEqual(
  extractAssistantSpatialDirective('The lift opens onto Level 1.\n[spatial_move: destination_id="tower_level_1"]'),
  {
    cleanContent: "The lift opens onto Level 1.",
    directive: { type: "move", destinationId: "tower_level_1" },
    matched: true,
  },
);
assert.deepEqual(
  extractAssistantSpatialDirective(
    'A hidden observatory waits beyond the door.\n[spatial_discover: name="Hidden Observatory" relation="enter" description="A concealed observatory above the tower."]',
  ),
  {
    cleanContent: "A hidden observatory waits beyond the door.",
    directive: {
      type: "discover",
      name: "Hidden Observatory",
      relation: "enter",
      description: "A concealed observatory above the tower.",
    },
    matched: true,
  },
);
assert.deepEqual(
  extractAssistantSpatialDirective(
    '[spatial_discover: name="A one-way bridge" relation="link" direction="outgoing" description="A bridge leading onward."]',
  ).directive,
  {
    type: "discover",
    name: "A one-way bridge",
    relation: "link",
    direction: "outgoing",
    description: "A bridge leading onward.",
  },
  "Direct-link discovery carries explicit direction relative to the current location",
);
assert.equal(
  extractAssistantSpatialDirective(
    '[spatial_discover: name="An unspecified link" relation="link" description="Direction is required."]',
  ).directive,
  null,
  "Direct-link discovery without direction is rejected",
);
const ordinaryImpersonatedContent = "\n[Stage direction]\n\n\nContinue through the door.\n";
assert.deepEqual(
  extractAssistantSpatialDirective(ordinaryImpersonatedContent),
  {
    cleanContent: ordinaryImpersonatedContent,
    directive: null,
    matched: false,
  },
  "Ordinary bracketed impersonated prose must retain all surrounding whitespace",
);
assert.deepEqual(
  extractAssistantSpatialDirective(
    'The rewrite keeps this sentence.\n[spatial_move: destination_id="rewrite-must-not-apply"]',
  ),
  {
    cleanContent: "The rewrite keeps this sentence.",
    directive: { type: "move", destinationId: "rewrite-must-not-apply" },
    matched: true,
  },
  "Text-rewrite output must expose clean content while its directive is discarded by the route",
);
const streamedSpatialDirective = createAssistantSpatialDirectiveStreamFilter();
assert.equal(streamedSpatialDirective.push("We arrive at the infirmary.\n[spa"), "We arrive at the infirmary.\n");
assert.equal(streamedSpatialDirective.push('tial_move: destination_id="moonwell"'), "");
assert.equal(streamedSpatialDirective.push("]"), "");
assert.equal(streamedSpatialDirective.flush(), "");
const streamedOrdinaryBracket = createAssistantSpatialDirectiveStreamFilter();
assert.equal(streamedOrdinaryBracket.push("[Stage direction] Continue."), "[Stage direction] Continue.");
assert.equal(streamedOrdinaryBracket.flush(), "");
const streamedDirectiveSplitAfterPrefix = createAssistantSpatialDirectiveStreamFilter();
assert.equal(streamedDirectiveSplitAfterPrefix.push("[spatial_move:\n"), "");
assert.equal(streamedDirectiveSplitAfterPrefix.push(' destination_id="moonwell"'), "");
assert.equal(streamedDirectiveSplitAfterPrefix.push("]Arrival text."), "Arrival text.");
assert.equal(streamedDirectiveSplitAfterPrefix.flush(), "");

const generateRouteSource = readFileSync(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
const inlineThinkingStart = generateRouteSource.indexOf(
  "const inlineThinking = extractLeadingThinkingBlocks(fullResponse, customThinkingTags);",
);
const inlineThinkingEnd = generateRouteSource.indexOf("// ── LOG_LEVEL=debug", inlineThinkingStart);
const spatialSanitizationStart = generateRouteSource.indexOf(
  "const parsedSpatial = extractAssistantSpatialDirective(fullResponse);",
  inlineThinkingEnd,
);
const consolidatedReplacementStart = generateRouteSource.indexOf("if (contentReplaced) {", spatialSanitizationStart);
assert.ok(
  inlineThinkingStart >= 0 && inlineThinkingEnd > inlineThinkingStart,
  "Inline-thinking route block is present",
);
assert.doesNotMatch(
  generateRouteSource.slice(inlineThinkingStart, inlineThinkingEnd),
  /type:\s*"content_replace"/u,
  "Inline-thinking cleanup must not emit content before spatial sanitization",
);
assert.ok(
  spatialSanitizationStart > inlineThinkingEnd && consolidatedReplacementStart > spatialSanitizationStart,
  "The consolidated content replacement must run after spatial sanitization",
);
const textRewriteStart = generateRouteSource.indexOf("// ── Text rewrite/editing agents:");
const textRewriteEnd = generateRouteSource.indexOf("if (holdForTextRewrite && !textRewriteApplied", textRewriteStart);
assert.ok(textRewriteStart >= 0 && textRewriteEnd > textRewriteStart, "Text-rewrite route block is present");
const textRewriteSource = generateRouteSource.slice(textRewriteStart, textRewriteEnd);
assert.match(
  textRewriteSource,
  /const parsedRewriteSpatial = extractAssistantSpatialDirective\(editedText\);/u,
  "Text-rewrite output must run through spatial sanitization",
);
assert.match(
  textRewriteSource,
  /updateMessageContent\(messageId, sanitizedEditedText\)/u,
  "Text-rewrite persistence must use sanitized content",
);
assert.match(
  textRewriteSource,
  /type: "text_rewrite",[\s\S]*?editedText: sanitizedEditedText/u,
  "Text-rewrite events must emit sanitized content",
);
const gameSurfaceSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const gameChoiceHandlerStart = gameSurfaceSource.indexOf("const handleChoiceSelect");
const gameChoiceHandlerEnd = gameSurfaceSource.indexOf("const handleDismissChoices");
assert.ok(
  gameChoiceHandlerStart >= 0 && gameChoiceHandlerEnd > gameChoiceHandlerStart,
  "Game choice handler markers were not found in GameSurface.tsx; update the markers or the assertion",
);
const gameChoiceHandler = gameSurfaceSource.slice(gameChoiceHandlerStart, gameChoiceHandlerEnd);
assert.match(
  gameChoiceHandler,
  /pendingSpatialTransitions\.get\(activeChatId\)[\s\S]*?sendMessage\([\s\S]*?pendingSpatialTransition\.transition/u,
  "Game CYOA choices must submit the ready pending spatial transition",
);

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
const visualReferenceDefinition = definition([
  location("visual_reference", "Visual Reference", {
    referenceImageId: "gallery-image-1",
    useReferenceImage: true,
    mapBackgroundImageId: "gallery-image-2",
    mapBackgroundPosition: { x: 25, y: 75 },
  }),
]);
assert.equal(spatialContextDefinitionSchema.safeParse(visualReferenceDefinition).success, true);
assert.equal(
  spatialContextDefinitionSchema.safeParse({
    ...visualReferenceDefinition,
    locations: [{ ...visualReferenceDefinition.locations[0], referenceImageId: "x".repeat(201) }],
  }).success,
  false,
);
assert.equal(
  spatialContextDefinitionSchema.safeParse({
    ...visualReferenceDefinition,
    locations: [{ ...visualReferenceDefinition.locations[0], mapBackgroundImageId: "x".repeat(201) }],
  }).success,
  false,
);
assert.equal(
  spatialContextDefinitionSchema.safeParse({
    ...visualReferenceDefinition,
    locations: [{ ...visualReferenceDefinition.locations[0], mapBackgroundPosition: { x: -1, y: 50 } }],
  }).success,
  false,
);
assert.deepEqual(mergeSpatialLocationReferenceImages("location", ["character-a", "character-b"], 2), [
  "location",
  "character-a",
]);
assert.deepEqual(mergeSpatialLocationReferenceImages(null, ["character-a", "character-b"], 1), ["character-a"]);
assert.deepEqual(mergeSpatialLocationReferenceImages("location", ["character-a"], 0), []);

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
  resolveSpatialRoute(validDefinition, "tower_library", "market"),
  ["tower", "capital", "market"],
  "Routed movement follows the deterministic shortest path over active outgoing edges",
);
assert.equal(
  resolveSpatialRoute(validDefinition, "tower_library", "missing"),
  null,
  "Routed movement rejects missing targets without inventing an edge",
);
const directedRouteDefinition = definition(
  [
    location("route_a", "Route A", {
      links: [
        { targetId: "route_b", bidirectional: false, state: "available" },
        { targetId: "route_hidden", bidirectional: false, state: "hidden" },
        { targetId: "route_blocked", bidirectional: false, state: "blocked" },
        { targetId: "route_archived", bidirectional: false, state: "available" },
      ],
    }),
    location("route_b", "Route B"),
    location("route_hidden", "Hidden Route"),
    location("route_blocked", "Blocked Route"),
    location("route_archived", "Archived Route", { status: "archived" }),
    location("route_isolated", "Isolated Route"),
  ],
  { startingLocationId: "route_a" },
);
assert.deepEqual(resolveSpatialRoute(directedRouteDefinition, "route_a", "route_b"), ["route_b"]);
assert.equal(
  resolveSpatialRoute(directedRouteDefinition, "route_b", "route_a"),
  null,
  "A one-way direct link must reject travel in the reverse direction",
);
for (const unreachableId of ["route_hidden", "route_blocked", "route_archived", "route_isolated"]) {
  assert.equal(
    resolveSpatialRoute(directedRouteDefinition, "route_a", unreachableId),
    null,
    `${unreachableId} must not be routable`,
  );
}
const archivedParentRouteDefinition = definition(
  [
    location("archived_parent", "Archived Parent", { status: "archived" }),
    location("active_child_a", "Active Child A", { parentId: "archived_parent" }),
    location("active_child_b", "Active Child B", { parentId: "archived_parent" }),
  ],
  { startingLocationId: "active_child_a" },
);
assert.equal(
  resolveSpatialRoute(archivedParentRouteDefinition, "active_child_a", "active_child_b"),
  null,
  "Active children cannot route through an archived parent",
);
const adjacentStepTransition = validateSpatialTransition(directedRouteDefinition, "route_a", {
  destinationId: "route_b",
  travelMode: "step_by_step",
  expectedDefinitionRevision: directedRouteDefinition.revision,
  expectedCurrentLocationId: "route_a",
  commandId: "route-adjacent-step",
});
assert.equal(adjacentStepTransition.ok, true);
if (adjacentStepTransition.ok) {
  assert.deepEqual(adjacentStepTransition.travel, {
    mode: "step_by_step",
    fromLocationId: "route_a",
    targetLocationId: "route_b",
    routeLocationIds: ["route_b"],
    remainingLocationIds: [],
    complete: true,
  });
}
const stepwiseTransition = validateSpatialTransition(validDefinition, "tower_library", {
  destinationId: "market",
  travelMode: "step_by_step",
  expectedDefinitionRevision: 4,
  expectedCurrentLocationId: "tower_library",
  commandId: "route-step-1",
});
assert.deepEqual(
  stepwiseTransition,
  {
    ok: true,
    destination: libraryDestinations.find((entry) => entry.id === "tower")!,
    travel: {
      mode: "step_by_step",
      fromLocationId: "tower_library",
      targetLocationId: "market",
      routeLocationIds: ["tower", "capital", "market"],
      remainingLocationIds: ["capital", "market"],
      complete: false,
    },
  },
  "Stepwise travel commits only the first edge and returns the authoritative remainder",
);
const travelNowTransition = validateSpatialTransition(validDefinition, "tower_library", {
  destinationId: "market",
  travelMode: "travel_now",
  expectedDefinitionRevision: 4,
  expectedCurrentLocationId: "tower_library",
  commandId: "route-now-1",
});
assert.equal(travelNowTransition.ok, true);
if (travelNowTransition.ok) {
  assert.equal(travelNowTransition.destination.id, "market");
  assert.deepEqual(travelNowTransition.travel, {
    mode: "travel_now",
    fromLocationId: "tower_library",
    targetLocationId: "market",
    routeLocationIds: ["tower", "capital", "market"],
    remainingLocationIds: [],
    complete: true,
  });
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
    message: "The world map changed. Review the available destinations.",
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
    error.message === "World Maps is not active.",
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
  referenceImageId: null,
  useReferenceImage: false,
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
let delegatedResolutionCount = 0;
const removeProjectionService = registerCapabilityService("hierarchical-maps:projection", {
  buildOwnerSpatialProjection: () => delegatedProjection,
  resolveOwnerSpatialProjection: async () => {
    delegatedResolutionCount += 1;
    return delegatedProjection;
  },
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
assert.equal(isHierarchicalMapsEnabledForChat(null), false);
assert.equal(isHierarchicalMapsEnabledForChat("not-json"), false);
assert.equal(isHierarchicalMapsEnabledForChat({ enableAgents: false, activeAgentIds: ["hierarchical-maps"] }), false);
assert.equal(isHierarchicalMapsEnabledForChat({ enableAgents: true, activeAgentIds: ["hierarchical-maps"] }), true);
assert.equal(
  await resolveOwnerSpatialProjection(
    "chat-roleplay",
    {},
    { enableAgents: false, activeAgentIds: ["hierarchical-maps"] },
  ),
  null,
);
assert.equal(delegatedResolutionCount, 0, "The master Agents toggle must prevent package spatial resolution");
assert.equal(
  await resolveOwnerSpatialProjection(
    "chat-roleplay",
    {},
    { enableAgents: true, activeAgentIds: ["hierarchical-maps"] },
  ),
  delegatedProjection,
);
assert.equal(delegatedResolutionCount, 1);
assert.equal(formatOwnerSpatialBreadcrumb(delegatedProjection), "Delegated > Breadcrumb");
assert.equal(formatOwnerSpatialPrompt(delegatedProjection), "<delegated-spatial-context />");
assert.equal(injectOwnerSpatialPrompt(fallbackMessages, delegatedProjection), delegatedMessages);
assert.deepEqual(projectGameSnapshotLocation(fallbackSnapshot, delegatedProjection), {
  location: "Delegated > Breadcrumb",
  weather: "Rain",
});
assert.deepEqual(omitAuthoritativeGameLocation(fallbackPatch, delegatedProjection), { time: "Noon" });

let delegatedStateResolutionCount = 0;
let delegatedMaterializationCount = 0;
const delegatedState = {
  definition: null,
  snapshot: null,
  currentLocationId: "tower_library",
  definitionRevision: 4,
  visibleAnchor: null,
  virtual: true,
};
const removeStateResolutionService = registerCapabilityService("hierarchical-maps:state-resolution", {
  resolveEffectiveSpatialState: async () => {
    delegatedStateResolutionCount += 1;
    return delegatedState;
  },
  materializeAssistantSpatialState: async () => {
    delegatedMaterializationCount += 1;
    return null;
  },
});
const disabledMapsMetadata = { enableAgents: false, activeAgentIds: ["hierarchical-maps"] };
const enabledMapsMetadata = { enableAgents: true, activeAgentIds: ["hierarchical-maps"] };
assert.equal((await resolveEffectiveSpatialState("chat-roleplay", {}, disabledMapsMetadata)).currentLocationId, null);
assert.equal(
  await materializeAssistantSpatialState(
    {
      chatId: "chat-roleplay",
      messageId: "assistant-disabled",
      swipeIndex: 0,
      regenerate: false,
      continuation: false,
    },
    disabledMapsMetadata,
  ),
  null,
);
assert.equal(delegatedStateResolutionCount, 0);
assert.equal(delegatedMaterializationCount, 0);
assert.equal(
  (await resolveEffectiveSpatialState("chat-roleplay", {}, enabledMapsMetadata)).currentLocationId,
  "tower_library",
);
await materializeAssistantSpatialState(
  {
    chatId: "chat-roleplay",
    messageId: "assistant-enabled",
    swipeIndex: 0,
    regenerate: false,
    continuation: false,
  },
  enabledMapsMetadata,
);
assert.equal(delegatedStateResolutionCount, 1);
assert.equal(delegatedMaterializationCount, 1);
removeStateResolutionService();
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
