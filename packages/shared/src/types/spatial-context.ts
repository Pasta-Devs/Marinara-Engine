// ──────────────────────────────────────────────
// Hierarchical maps and spatial context
// ──────────────────────────────────────────────

export type SpatialOwnerMode = "roleplay" | "game";

export type SpatialLocationKind = "region" | "settlement" | "place" | "building" | "floor" | "room";

export type SpatialChildPresentation = "map" | "layers" | "list";

export type SpatialLocationStatus = "active" | "archived";

export type SpatialLinkState = "available" | "hidden" | "blocked";

export interface SpatialLocationPlacement {
  x: number;
  y: number;
}

export interface SpatialLocationLink {
  targetId: string;
  label?: string;
  bidirectional: boolean;
  state: SpatialLinkState;
}

export interface SpatialLocation {
  id: string;
  parentId: string | null;
  name: string;
  kind: SpatialLocationKind;
  description: string;
  modelMemory?: string;
  awarenessSummary?: string;
  icon?: string;
  /** Chat Gallery image used as the visual identity for this location. */
  referenceImageId?: string;
  /** Whether visual generation may send the location image to the configured provider. */
  useReferenceImage?: boolean;
  /** Chat Gallery image displayed behind this location's child map. */
  mapBackgroundImageId?: string;
  /** Saved focal point used to position the child map background. */
  mapBackgroundPosition?: SpatialLocationPlacement;
  /** Stable lorebook entry IDs activated only while this exact location is current. */
  lorebookEntryIds: string[];
  childPresentation: SpatialChildPresentation;
  placement?: SpatialLocationPlacement;
  layerOrder?: number;
  links: SpatialLocationLink[];
  status: SpatialLocationStatus;
  sortOrder: number;
}

export interface SpatialContextDefinition {
  schemaVersion: 1;
  ownerMode: SpatialOwnerMode;
  enabled: boolean;
  locations: SpatialLocation[];
  startingLocationId: string | null;
  revision: number;
}

export type SpatialSnapshotSource =
  "bootstrap" | "owner_turn" | "assistant_swipe" | "definition_repair" | "branch_copy";

export interface SpatialContextSnapshot {
  id: string;
  chatId: string;
  messageId: string;
  swipeIndex: number;
  currentLocationId: string | null;
  definitionRevision: number;
  source: SpatialSnapshotSource;
  transitionCommandId: string | null;
  transitionPayloadHash: string | null;
  createdAt: string;
}

export type SpatialTravelMode = "step_by_step" | "travel_now";

export interface PendingSpatialTransition {
  destinationId: string;
  /** When omitted, preserve the legacy one-hop destination semantics. */
  travelMode?: SpatialTravelMode;
  expectedDefinitionRevision: number;
  expectedCurrentLocationId: string | null;
  commandId: string;
}

/** The authoritative route result for one accepted owner turn. */
export interface ResolvedSpatialTravel {
  mode: SpatialTravelMode;
  fromLocationId: string;
  targetLocationId: string;
  /** Ordered destination IDs after the current location, including the target. */
  routeLocationIds: string[];
  /** Destination IDs still queued after this turn's accepted destination. */
  remainingLocationIds: string[];
  complete: boolean;
}

export interface SpatialTravelPromptSummary {
  mode: SpatialTravelMode;
  fromLocationName: string;
  acceptedLocationName: string;
  targetLocationName: string;
  routeLocationNames: string[];
  remainingLocationNames: string[];
}

export type SpatialDestinationRelation = "enter" | "leave" | "link";

export interface SpatialDestination {
  id: string;
  name: string;
  kind: SpatialLocationKind;
  relation: SpatialDestinationRelation;
  label?: string;
  sortOrder: number;
}

export interface ResolvedOwnerSpatialProjection {
  kind: "owner";
  chatId: string;
  ownerMode: SpatialOwnerMode;
  definitionRevision: number;
  currentLocationId: string;
  breadcrumb: Array<{ id: string; name: string }>;
  description: string;
  modelMemory: string | null;
  referenceImageId: string | null;
  useReferenceImage: boolean;
  lorebookEntryIds: string[];
  destinations: SpatialDestination[];
  omittedDestinationCount: number;
  /** Accepted route facts for the owner turn currently being generated. */
  travel?: ResolvedSpatialTravel;
  /** Bounded public names for the accepted route; IDs remain authoritative. */
  travelSummary?: SpatialTravelPromptSummary;
  /** Active map locations exposed as name-only breadcrumb paths for narrated travel. */
  knownLocations?: Array<{ id: string; path: string }>;
}

export type SpatialDefinitionIssueCode =
  | "too_many_locations"
  | "too_many_links"
  | "duplicate_location_id"
  | "starting_location_missing"
  | "starting_location_archived"
  | "parent_missing"
  | "self_parent"
  | "parent_cycle"
  | "maximum_depth_exceeded"
  | "link_target_missing"
  | "self_link"
  | "duplicate_link_target"
  | "duplicate_lorebook_entry_id"
  | "lorebook_entry_missing"
  | "layer_order_missing"
  | "duplicate_layer_order"
  | "stored_definition_invalid";

export interface SpatialDefinitionIssue {
  code: SpatialDefinitionIssueCode;
  message: string;
  locationId?: string;
  path: Array<string | number>;
}

export interface SpatialDefinitionValidationResult {
  valid: boolean;
  issues: SpatialDefinitionIssue[];
}

export type SpatialTransitionErrorCode =
  | "spatial_definition_invalid"
  | "spatial_context_disabled"
  | "spatial_transition_stale_definition"
  | "spatial_transition_stale_location"
  | "spatial_current_location_missing"
  | "spatial_destination_missing"
  | "spatial_destination_unreachable";

export type SpatialTransitionValidationResult =
  | {
      ok: true;
      destination: SpatialDestination;
      travel?: ResolvedSpatialTravel;
    }
  | {
      ok: false;
      code: SpatialTransitionErrorCode;
      message: string;
    };

export type SpatialArchiveBlockerCode =
  | "spatial_location_missing"
  | "spatial_archive_starting_replacement_required"
  | "spatial_archive_current_replacement_required"
  | "spatial_archive_active_children";

export type SpatialArchiveValidationResult =
  | { ok: true }
  | {
      ok: false;
      code: SpatialArchiveBlockerCode;
      message: string;
    };

export interface SpatialContextResponse {
  definition: SpatialContextDefinition | null;
  currentLocationId: string | null;
  breadcrumb: Array<{ id: string; name: string }>;
  destinations: SpatialDestination[];
  warnings: SpatialDefinitionIssue[];
  hasCommittedSpatialHistory: boolean;
}

export type SpatialMapDraftSize = "small" | "medium" | "large";

export type SpatialMapDraftOperation = "create" | "replace" | "expand";

export type SpatialMapGroundingMode = "setup" | "lore_strict" | "lore_expand";

export type SpatialMapLocationProvenanceKind = "lore_backed" | "inferred" | "added_by_ai";

export interface SpatialMapLocationProvenanceSource {
  entryId: string;
  lorebookId: string;
  lorebookName: string;
  entryName: string;
  excerpt: string;
}

export interface SpatialMapLocationProvenance {
  kind: SpatialMapLocationProvenanceKind;
  sources: SpatialMapLocationProvenanceSource[];
}

export interface SpatialMapGroundingSummary {
  mode: SpatialMapGroundingMode;
  selectedLorebookCount: number;
  selectedEntryCount: number;
  consideredEntryCount: number;
  omittedEntryCount: number;
}

export interface GenerateSpatialMapDraftRequest {
  operation: SpatialMapDraftOperation;
  size: SpatialMapDraftSize;
  targetLocationId?: string;
  instructions?: string;
  groundingMode?: SpatialMapGroundingMode;
  sourceLorebookIds?: string[];
  sourceEntryIds?: string[];
  connectionId?: string;
  debugMode?: boolean;
}

export interface GenerateSpatialMapDraftResponse {
  definition: SpatialContextDefinition;
  operation: SpatialMapDraftOperation;
  size: SpatialMapDraftSize;
  source: "game_setup" | "roleplay_setup";
  generatedLocationCount: number;
  targetLocationId?: string;
  provenance?: Record<string, SpatialMapLocationProvenance>;
  grounding?: SpatialMapGroundingSummary;
}
