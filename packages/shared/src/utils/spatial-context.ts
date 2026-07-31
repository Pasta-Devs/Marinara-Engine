import type {
  PendingSpatialTransition,
  SpatialArchiveValidationResult,
  SpatialContextDefinition,
  SpatialDefinitionIssue,
  SpatialDefinitionValidationResult,
  SpatialDestination,
  SpatialDestinationRelation,
  SpatialLocation,
  SpatialTransitionValidationResult,
} from "../types/spatial-context.js";

export const SPATIAL_CONTEXT_LIMITS = {
  maxLocations: 500,
  maxDepth: 20,
  maxLinksPerLocation: 50,
  maxNameLength: 200,
  maxDescriptionLength: 4_000,
  maxAwarenessSummaryLength: 1_000,
  maxModelMemoryLength: 8_000,
  maxIdLength: 128,
  maxLinkLabelLength: 200,
  maxCommandIdLength: 200,
  maxPromptDestinations: 50,
  maxLorebookEntryIdsPerLocation: 50,
} as const;

export function buildSpatialLocationIndex(
  definition: Pick<SpatialContextDefinition, "locations">,
): Map<string, SpatialLocation> {
  const byId = new Map<string, SpatialLocation>();
  for (const location of definition.locations) {
    if (!byId.has(location.id)) byId.set(location.id, location);
  }
  return byId;
}

export function getSpatialDescendantIds(
  definition: Pick<SpatialContextDefinition, "locations">,
  locationId: string,
): Set<string> {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    for (const location of definition.locations) {
      if (location.parentId !== parentId || descendants.has(location.id)) continue;
      descendants.add(location.id);
      visit(location.id);
    }
  };
  visit(locationId);
  return descendants;
}

export function wouldCreateSpatialCycle(
  definition: Pick<SpatialContextDefinition, "locations">,
  locationId: string,
  parentId: string,
): boolean {
  if (parentId === locationId) return true;
  return getSpatialDescendantIds(definition, locationId).has(parentId);
}

export function resolveSpatialLocationDepth(
  definition: Pick<SpatialContextDefinition, "locations">,
  location: SpatialLocation,
): number {
  const byId = buildSpatialLocationIndex(definition);
  const seen = new Set<string>();
  let depth = 1;
  let current = location;
  while (current.parentId) {
    if (seen.has(current.parentId)) return SPATIAL_CONTEXT_LIMITS.maxDepth + 1;
    seen.add(current.parentId);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

export function spatialRadialPlacement(
  index: number,
  count: number,
  radius = count <= 6 ? 34 : 40,
): SpatialLocation["placement"] {
  if (count === 1) return { x: 50, y: 50 };
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return {
    x: Math.round(50 + Math.cos(angle) * radius),
    y: Math.round(50 + Math.sin(angle) * radius),
  };
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function compareSpatialLocations(left: SpatialLocation, right: SpatialLocation): number {
  return left.sortOrder - right.sortOrder || compareText(left.name, right.name) || compareText(left.id, right.id);
}

function compareDestinations(left: SpatialDestination, right: SpatialDestination): number {
  return (
    left.sortOrder - right.sortOrder ||
    compareText(left.name, right.name) ||
    compareText(left.id, right.id) ||
    compareText(left.relation, right.relation)
  );
}

function issue(
  code: SpatialDefinitionIssue["code"],
  message: string,
  path: Array<string | number>,
  locationId?: string,
): SpatialDefinitionIssue {
  return {
    code,
    message,
    path,
    ...(locationId ? { locationId } : {}),
  };
}

export function validateSpatialContextDefinition(
  definition: SpatialContextDefinition,
): SpatialDefinitionValidationResult {
  const issues: SpatialDefinitionIssue[] = [];
  const firstIndexById = new Map<string, number>();
  const byId = new Map<string, SpatialLocation>();

  if (definition.locations.length > SPATIAL_CONTEXT_LIMITS.maxLocations) {
    issues.push(
      issue(
        "too_many_locations",
        `A spatial map can contain at most ${SPATIAL_CONTEXT_LIMITS.maxLocations} locations.`,
        ["locations"],
      ),
    );
  }

  definition.locations.forEach((location, index) => {
    const firstIndex = firstIndexById.get(location.id);
    if (firstIndex !== undefined) {
      issues.push(
        issue(
          "duplicate_location_id",
          `Location ID "${location.id}" is already used by another location.`,
          ["locations", index, "id"],
          location.id,
        ),
      );
      return;
    }
    firstIndexById.set(location.id, index);
    byId.set(location.id, location);
  });

  if (definition.startingLocationId !== null) {
    const startingLocation = byId.get(definition.startingLocationId);
    if (!startingLocation) {
      issues.push(
        issue(
          "starting_location_missing",
          "The starting location does not exist.",
          ["startingLocationId"],
          definition.startingLocationId,
        ),
      );
    } else if (startingLocation.status !== "active") {
      issues.push(
        issue(
          "starting_location_archived",
          "The starting location must be active.",
          ["startingLocationId"],
          startingLocation.id,
        ),
      );
    }
  }

  definition.locations.forEach((location, index) => {
    if (location.parentId !== null) {
      if (location.parentId === location.id) {
        issues.push(
          issue("self_parent", "A location cannot be its own parent.", ["locations", index, "parentId"], location.id),
        );
      } else if (!byId.has(location.parentId)) {
        issues.push(
          issue(
            "parent_missing",
            "The selected parent location does not exist.",
            ["locations", index, "parentId"],
            location.id,
          ),
        );
      }
    }

    if (location.links.length > SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation) {
      issues.push(
        issue(
          "too_many_links",
          `A location can contain at most ${SPATIAL_CONTEXT_LIMITS.maxLinksPerLocation} links.`,
          ["locations", index, "links"],
          location.id,
        ),
      );
    }
    const seenLorebookEntryIds = new Set<string>();
    location.lorebookEntryIds.forEach((entryId, entryIndex) => {
      if (seenLorebookEntryIds.has(entryId)) {
        issues.push(
          issue(
            "duplicate_lorebook_entry_id",
            "A lorebook entry can be attached to a location only once.",
            ["locations", index, "lorebookEntryIds", entryIndex],
            location.id,
          ),
        );
      }
      seenLorebookEntryIds.add(entryId);
    });


    const seenLinkTargets = new Set<string>();
    location.links.forEach((link, linkIndex) => {
      if (link.targetId === location.id) {
        issues.push(
          issue(
            "self_link",
            "A location cannot link to itself.",
            ["locations", index, "links", linkIndex, "targetId"],
            location.id,
          ),
        );
      } else if (!byId.has(link.targetId)) {
        issues.push(
          issue(
            "link_target_missing",
            "The linked location does not exist.",
            ["locations", index, "links", linkIndex, "targetId"],
            location.id,
          ),
        );
      }

      if (seenLinkTargets.has(link.targetId)) {
        issues.push(
          issue(
            "duplicate_link_target",
            "A location can link to a destination only once.",
            ["locations", index, "links", linkIndex, "targetId"],
            location.id,
          ),
        );
      }
      seenLinkTargets.add(link.targetId);
    });
  });

  definition.locations.forEach((location, index) => {
    const seen = new Set<string>();
    let current: SpatialLocation | undefined = location;
    let depth = 0;
    let cycleFound = false;

    while (current) {
      if (seen.has(current.id)) {
        cycleFound = true;
        break;
      }
      seen.add(current.id);
      depth += 1;
      if (current.parentId === null) break;
      current = byId.get(current.parentId);
    }

    if (cycleFound) {
      issues.push(
        issue("parent_cycle", "Location parents must not form a cycle.", ["locations", index, "parentId"], location.id),
      );
    } else if (depth > SPATIAL_CONTEXT_LIMITS.maxDepth) {
      issues.push(
        issue(
          "maximum_depth_exceeded",
          `Location nesting cannot exceed ${SPATIAL_CONTEXT_LIMITS.maxDepth} levels.`,
          ["locations", index, "parentId"],
          location.id,
        ),
      );
    }
  });

  const childrenByParent = new Map<string, Array<{ location: SpatialLocation; index: number }>>();
  definition.locations.forEach((location, index) => {
    if (location.parentId === null) return;
    const children = childrenByParent.get(location.parentId);
    const entry = { location, index };
    if (children) children.push(entry);
    else childrenByParent.set(location.parentId, [entry]);
  });

  for (const [parentId, children] of childrenByParent) {
    const parent = byId.get(parentId);
    if (!parent || parent.childPresentation !== "layers") continue;

    const usedOrders = new Map<number, string>();
    for (const { location, index } of children) {
      if (location.layerOrder === undefined) {
        issues.push(
          issue(
            "layer_order_missing",
            "Every child of a layer location needs a layer order.",
            ["locations", index, "layerOrder"],
            location.id,
          ),
        );
        continue;
      }
      const existingLocationId = usedOrders.get(location.layerOrder);
      if (existingLocationId !== undefined) {
        issues.push(
          issue(
            "duplicate_layer_order",
            `Layer order ${location.layerOrder} is already used by location "${existingLocationId}".`,
            ["locations", index, "layerOrder"],
            location.id,
          ),
        );
      } else {
        usedOrders.set(location.layerOrder, location.id);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export function resolveSpatialBreadcrumb(
  definition: Pick<SpatialContextDefinition, "locations">,
  locationId: string | null,
): SpatialLocation[] {
  if (locationId === null) return [];
  const byId = buildSpatialLocationIndex(definition);
  const breadcrumb: SpatialLocation[] = [];
  const seen = new Set<string>();
  let current = byId.get(locationId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    breadcrumb.push(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }

  return breadcrumb.reverse();
}

function destinationFromLocation(
  location: SpatialLocation,
  relation: SpatialDestinationRelation,
  label?: string,
): SpatialDestination {
  return {
    id: location.id,
    name: location.name,
    kind: location.kind,
    relation,
    ...(label ? { label } : {}),
    sortOrder: location.sortOrder,
  };
}

export function resolveSpatialDestinations(
  definition: Pick<SpatialContextDefinition, "enabled" | "locations">,
  currentLocationId: string | null,
): SpatialDestination[] {
  if (!definition.enabled || currentLocationId === null) return [];
  const byId = buildSpatialLocationIndex(definition);
  const current = byId.get(currentLocationId);
  if (!current) return [];

  const destinations = new Map<string, SpatialDestination>();
  const add = (location: SpatialLocation | undefined, relation: SpatialDestinationRelation, label?: string) => {
    if (!location || location.status !== "active" || destinations.has(location.id)) return;
    destinations.set(location.id, destinationFromLocation(location, relation, label));
  };

  if (current.parentId !== null) add(byId.get(current.parentId), "leave");

  for (const location of definition.locations) {
    if (location.parentId === current.id) add(location, "enter");
  }

  for (const link of current.links) {
    if (link.state === "available") add(byId.get(link.targetId), "link", link.label);
  }

  for (const source of definition.locations) {
    if (source.status !== "active") continue;
    for (const link of source.links) {
      if (link.bidirectional && link.state === "available" && link.targetId === current.id) {
        add(source, "link", link.label);
      }
    }
  }

  return Array.from(destinations.values()).sort(compareDestinations);
}

function validReplacement(
  byId: ReadonlyMap<string, SpatialLocation>,
  locationId: string,
  replacementLocationId: string | null | undefined,
): boolean {
  if (!replacementLocationId || replacementLocationId === locationId) return false;
  return byId.get(replacementLocationId)?.status === "active";
}

export function validateSpatialArchive(
  definition: SpatialContextDefinition,
  locationId: string,
  options: {
    currentLocationId: string | null;
    replacementLocationId?: string | null;
  },
): SpatialArchiveValidationResult {
  const byId = buildSpatialLocationIndex(definition);
  if (!byId.has(locationId)) {
    return { ok: false, code: "spatial_location_missing", message: "The location does not exist." };
  }

  if (
    definition.startingLocationId === locationId &&
    !validReplacement(byId, locationId, options.replacementLocationId)
  ) {
    return {
      ok: false,
      code: "spatial_archive_starting_replacement_required",
      message: "Choose an active replacement before archiving the starting location.",
    };
  }

  if (options.currentLocationId === locationId && !validReplacement(byId, locationId, options.replacementLocationId)) {
    return {
      ok: false,
      code: "spatial_archive_current_replacement_required",
      message: "Choose an active replacement before archiving the current location.",
    };
  }

  if (definition.locations.some((location) => location.parentId === locationId && location.status === "active")) {
    return {
      ok: false,
      code: "spatial_archive_active_children",
      message: "Archive or move active child locations first.",
    };
  }

  return { ok: true };
}

export function validateSpatialTransition(
  definition: SpatialContextDefinition,
  currentLocationId: string | null,
  request: PendingSpatialTransition,
): SpatialTransitionValidationResult {
  if (!validateSpatialContextDefinition(definition).valid) {
    return {
      ok: false,
      code: "spatial_definition_invalid",
      message: "The world map must be repaired before moving.",
    };
  }
  if (!definition.enabled) {
    return {
      ok: false,
      code: "spatial_context_disabled",
      message: "World maps are disabled for this chat.",
    };
  }
  if (request.expectedDefinitionRevision !== definition.revision) {
    return {
      ok: false,
      code: "spatial_transition_stale_definition",
      message: "The world map changed. Review the available destinations.",
    };
  }
  if (request.expectedCurrentLocationId !== currentLocationId) {
    return {
      ok: false,
      code: "spatial_transition_stale_location",
      message: "The current location changed. Review the available destinations.",
    };
  }

  const byId = buildSpatialLocationIndex(definition);
  if (currentLocationId === null || !byId.has(currentLocationId)) {
    return {
      ok: false,
      code: "spatial_current_location_missing",
      message: "The current location does not exist.",
    };
  }
  if (!byId.has(request.destinationId)) {
    return {
      ok: false,
      code: "spatial_destination_missing",
      message: "The selected destination is no longer available.",
    };
  }

  const destination = resolveSpatialDestinations(definition, currentLocationId).find(
    (candidate) => candidate.id === request.destinationId,
  );
  if (!destination) {
    return {
      ok: false,
      code: "spatial_destination_unreachable",
      message: "The selected destination is not reachable from the current location.",
    };
  }

  return { ok: true, destination };
}
