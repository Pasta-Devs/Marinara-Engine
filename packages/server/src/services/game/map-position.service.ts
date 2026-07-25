import type { GameMap, MapEdge, MapNode } from "@marinara-engine/shared";

const MIN_NODE_COORD = 8;
const MAX_NODE_COORD = 92;
const NODE_POSITION_OFFSETS = [
  { x: 18, y: 0 },
  { x: 14, y: 14 },
  { x: 0, y: 18 },
  { x: -14, y: 14 },
  { x: -18, y: 0 },
  { x: -14, y: -14 },
  { x: 0, y: -18 },
  { x: 14, y: -14 },
  { x: 24, y: 8 },
  { x: 8, y: 24 },
  { x: -8, y: 24 },
  { x: -24, y: 8 },
  { x: -24, y: -8 },
  { x: -8, y: -24 },
  { x: 8, y: -24 },
  { x: 24, y: -8 },
];
const CENTER_NODE_POSITIONS = [
  { x: 50, y: 50 },
  { x: 64, y: 50 },
  { x: 36, y: 50 },
  { x: 50, y: 64 },
  { x: 50, y: 36 },
  { x: 64, y: 64 },
  { x: 36, y: 36 },
  { x: 36, y: 64 },
  { x: 64, y: 36 },
];

export interface MapUpdateCommand {
  newLocation: string;
  connectedTo: string | null;
  nodeEmoji: string | null;
}

function normalizeLocationValue(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['\u2019]/gu, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(?:the|a|an)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function areGameMapLocationsEquivalent(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const leftKey = left ? normalizeLocationValue(left) : "";
  const rightKey = right ? normalizeLocationValue(right) : "";
  return leftKey !== "" && leftKey === rightKey;
}

function scoreAliasMatch(location: string, alias: string): number {
  const locationKey = normalizeLocationValue(location);
  const aliasKey = normalizeLocationValue(alias);
  if (!locationKey || !aliasKey) return 0;
  if (locationKey === aliasKey) return 100;

  const shortest = Math.min(locationKey.length, aliasKey.length);
  if (shortest >= 4 && (locationKey.includes(aliasKey) || aliasKey.includes(locationKey))) {
    return 80;
  }

  const locationTokens = locationKey.split(" ").filter((token) => token.length >= 3);
  const aliasTokens = aliasKey.split(" ").filter((token) => token.length >= 3);
  if (locationTokens.length === 0 || aliasTokens.length === 0) return 0;

  const sharedTokens = aliasTokens.filter((token) => locationTokens.includes(token));
  const requiredOverlap = Math.min(2, locationTokens.length, aliasTokens.length);
  if (sharedTokens.length >= requiredOverlap) {
    return 50 + sharedTokens.length;
  }

  return 0;
}

function findBestMatch<T>(
  location: string,
  entries: readonly T[],
  aliasesFor: (entry: T) => string[],
): { entry: T; score: number } | null {
  let best: { entry: T; score: number } | null = null;

  for (const entry of entries) {
    const score = aliasesFor(entry).reduce((highest, alias) => Math.max(highest, scoreAliasMatch(location, alias)), 0);
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  return best && best.score > 0 ? best : null;
}

function parseTagAttributes(body: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of body.matchAll(/(\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s\]]+)/g)) {
    const key = match[1]?.trim().toLowerCase();
    const rawValue = match[2]?.trim();
    if (!key || !rawValue) continue;
    values.set(key, rawValue.replace(/^['"]|['"]$/g, ""));
  }
  return values;
}

function clampNodeCoordinate(value: number): number {
  return Math.max(MIN_NODE_COORD, Math.min(MAX_NODE_COORD, Math.round(value)));
}

function chooseNodePosition(nodes: readonly MapNode[], anchor: MapNode | null): { x: number; y: number } {
  const candidates = (
    anchor
      ? NODE_POSITION_OFFSETS.map((offset) => ({
          x: clampNodeCoordinate(anchor.x + offset.x),
          y: clampNodeCoordinate(anchor.y + offset.y),
        }))
      : CENTER_NODE_POSITIONS
  ).concat(CENTER_NODE_POSITIONS);

  let best = candidates[0] ?? { x: 50, y: 50 };
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score =
      nodes.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...nodes.map((node) => (node.x - candidate.x) ** 2 + (node.y - candidate.y) ** 2));
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function buildNodeId(label: string, nodes: readonly MapNode[]): string {
  const base = normalizeLocationValue(label).replace(/\s+/g, "_") || "location";
  let candidate = base;
  let suffix = 2;
  while (nodes.some((node) => node.id === candidate)) {
    candidate = `${base}_${suffix++}`;
  }
  return candidate;
}

function slugifyGameMapId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isGameMap(value: unknown): value is GameMap {
  if (!value || typeof value !== "object") return false;
  const map = value as Partial<GameMap>;
  return map.type === "grid" || map.type === "node";
}

export function getGameMapId(map: GameMap | null | undefined, fallbackIndex = 0): string | null {
  if (!map) return null;
  const explicit = map.id?.trim();
  if (explicit) return explicit;
  return slugifyGameMapId(map.name || "") || `map-${fallbackIndex + 1}`;
}

export function ensureGameMapId(map: GameMap, existingMaps: readonly GameMap[] = []): GameMap {
  const explicit = map.id?.trim();
  if (explicit) return explicit === map.id ? map : { ...map, id: explicit };

  const usedIds = new Set(existingMaps.map((entry, index) => getGameMapId(entry, index)).filter(Boolean) as string[]);
  const base = slugifyGameMapId(map.name || "") || "map";
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix++}`;
  }
  return { ...map, id };
}

export function upsertGameMap(maps: readonly GameMap[], map: GameMap): GameMap[] {
  const explicitId = map.id?.trim();
  const normalizedName = normalizeLocationValue(map.name || "");
  const existingIndex = maps.findIndex((entry, index) => {
    if (explicitId) return getGameMapId(entry, index) === explicitId;
    return normalizedName !== "" && normalizeLocationValue(entry.name || "") === normalizedName;
  });

  const mapWithId =
    existingIndex >= 0 && !explicitId
      ? { ...map, id: getGameMapId(maps[existingIndex], existingIndex) ?? undefined }
      : ensureGameMapId(map, maps);

  if (existingIndex < 0) return [...maps, mapWithId];
  const next = [...maps];
  next[existingIndex] = mapWithId;
  return next;
}

export function getGameMapsFromMeta(meta: Record<string, unknown>): GameMap[] {
  const rawMaps = Array.isArray(meta.gameMaps) ? meta.gameMaps : [];
  const maps = rawMaps.filter(isGameMap).reduce<GameMap[]>((acc, map) => upsertGameMap(acc, map), []);
  const activeMap = isGameMap(meta.gameMap) ? meta.gameMap : null;
  return activeMap ? upsertGameMap(maps, activeMap) : maps;
}

function orderGameMapsForLocationLookup(meta: Record<string, unknown>, maps: readonly GameMap[]): GameMap[] {
  const activeId =
    typeof meta.activeGameMapId === "string"
      ? meta.activeGameMapId
      : getGameMapId(isGameMap(meta.gameMap) ? meta.gameMap : null);
  const activeIndex = activeId ? maps.findIndex((map, index) => getGameMapId(map, index) === activeId) : -1;
  return activeIndex >= 0 ? [maps[activeIndex]!, ...maps.filter((_, index) => index !== activeIndex)] : [...maps];
}

export function doGameMapLocationsResolveToSamePosition(
  meta: Record<string, unknown>,
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const leftLocation = left?.trim();
  const rightLocation = right?.trim();
  if (!leftLocation || !rightLocation) return false;

  const maps = getGameMapsFromMeta(meta);
  const orderedMaps = orderGameMapsForLocationLookup(meta, maps);
  const resolve = (location: string): { map: GameMap; position: string } | null => {
    for (const map of orderedMaps) {
      if (map.type === "node") {
        const node = findBestMatch(location, map.nodes ?? [], (entry) => [entry.id, entry.label])?.entry;
        if (node) return { map, position: `node:${node.id}` };
        continue;
      }

      const cell = findBestMatch(location, map.cells ?? [], (entry) => [
        entry.label,
        `${entry.x},${entry.y}`,
        `${entry.x}:${entry.y}`,
      ])?.entry;
      if (cell) return { map, position: `cell:${cell.x},${cell.y}` };
    }
    return null;
  };

  const leftPosition = resolve(leftLocation);
  const rightPosition = resolve(rightLocation);
  return Boolean(
    leftPosition &&
    rightPosition &&
    leftPosition.map === rightPosition.map &&
    leftPosition.position === rightPosition.position,
  );
}

export function withActiveGameMapMeta(meta: Record<string, unknown>, map: GameMap): Record<string, unknown> {
  const maps = upsertGameMap(getGameMapsFromMeta(meta), map);
  const mapId = getGameMapId(map);
  const activeMap = maps.find((entry, index) => getGameMapId(entry, index) === mapId) ?? map;

  return {
    ...meta,
    gameMap: activeMap,
    gameMaps: maps,
    activeGameMapId: getGameMapId(activeMap),
  };
}

function edgeExists(edges: readonly MapEdge[], from: string, to: string): boolean {
  return edges.some((edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from));
}

function findNodeMatch(location: string | null | undefined, nodes: readonly MapNode[]): MapNode | null {
  const locationName = location?.trim();
  if (!locationName || nodes.length === 0) return null;
  return findBestMatch(locationName, nodes, (node) => [node.id, node.label])?.entry ?? null;
}

export function gameMapContainsLocation(map: GameMap | null | undefined, location: string | null | undefined): boolean {
  const locationName = location?.trim();
  if (!map || !locationName) return false;

  if (map.type === "node") {
    return Boolean(findBestMatch(locationName, map.nodes ?? [], (node) => [node.id, node.label]));
  }

  return Boolean(
    findBestMatch(locationName, map.cells ?? [], (cell) => [cell.label, `${cell.x},${cell.y}`, `${cell.x}:${cell.y}`]),
  );
}

export function parseMapUpdateCommands(content: string): MapUpdateCommand[] {
  const commands: MapUpdateCommand[] = [];
  const regex = /\[map_update:\s*([^\]]+)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const values = parseTagAttributes(match[1] ?? "");
    const newLocation = (values.get("new_location") ?? values.get("location") ?? "").trim();
    if (!newLocation) continue;
    commands.push({
      newLocation,
      connectedTo: (values.get("connected_to") ?? values.get("connected") ?? "").trim() || null,
      nodeEmoji: (values.get("node_emoji") ?? values.get("emoji") ?? "").trim() || null,
    });
  }

  return commands;
}

export function applyMapUpdateCommand(map: GameMap | null, command: MapUpdateCommand): GameMap | null {
  const locationName = command.newLocation.trim();
  if (!map || map.type !== "node" || !locationName) return null;

  const originalNodes = map.nodes ?? [];
  const originalEdges = map.edges ?? [];
  const currentNode =
    typeof map.partyPosition === "string"
      ? (originalNodes.find((node) => node.id === map.partyPosition) ?? null)
      : null;
  const anchorNode = findNodeMatch(command.connectedTo, originalNodes) ?? currentNode;
  const targetNode = findNodeMatch(locationName, originalNodes);

  let nodes = originalNodes;
  let edges = originalEdges;
  let targetId = targetNode?.id ?? "";
  let changed = false;

  if (targetNode) {
    if (!targetNode.discovered) {
      nodes = originalNodes.map((node) => (node.id === targetNode.id ? { ...node, discovered: true } : node));
      changed = true;
    }
    targetId = targetNode.id;
  } else {
    const position = chooseNodePosition(originalNodes, anchorNode);
    const newNode: MapNode = {
      id: buildNodeId(locationName, originalNodes),
      label: locationName,
      emoji: command.nodeEmoji ?? "📍",
      x: position.x,
      y: position.y,
      discovered: true,
    };
    nodes = [...originalNodes, newNode];
    targetId = newNode.id;
    changed = true;
  }

  if (anchorNode && anchorNode.id !== targetId && !edgeExists(edges, anchorNode.id, targetId)) {
    edges = [...edges, { from: anchorNode.id, to: targetId }];
    changed = true;
  }

  if (map.partyPosition !== targetId) {
    changed = true;
  }

  if (!changed) return map;

  return {
    ...map,
    nodes,
    edges,
    partyPosition: targetId,
  };
}

export function syncGameMapPartyPosition(map: GameMap | null, location: string | null | undefined): GameMap | null {
  const locationName = location?.trim();
  if (!map || !locationName) return map;

  if (map.type === "node") {
    const nodes = map.nodes ?? [];
    const bestMatch = findBestMatch(locationName, nodes, (node) => [node.id, node.label]);
    if (!bestMatch) return map;

    const node = bestMatch.entry;
    const currentNodeId = typeof map.partyPosition === "string" ? map.partyPosition : null;
    if (currentNodeId === node.id && node.discovered) return map;

    return {
      ...map,
      partyPosition: node.id,
      nodes: nodes.map((entry) => (entry.id === node.id ? { ...entry, discovered: true } : entry)),
    };
  }

  const cells = map.cells ?? [];
  const bestMatch = findBestMatch(locationName, cells, (cell) => [
    cell.label,
    `${cell.x},${cell.y}`,
    `${cell.x}:${cell.y}`,
  ]);
  if (!bestMatch) return map;

  const cell = bestMatch.entry;
  const currentCell = typeof map.partyPosition === "object" ? map.partyPosition : null;
  if (currentCell?.x === cell.x && currentCell?.y === cell.y && cell.discovered) return map;

  return {
    ...map,
    partyPosition: { x: cell.x, y: cell.y },
    cells: cells.map((entry) => (entry.x === cell.x && entry.y === cell.y ? { ...entry, discovered: true } : entry)),
  };
}

export function syncGameMapMetaPartyPosition(
  meta: Record<string, unknown>,
  location: string | null | undefined,
): Record<string, unknown> {
  const maps = getGameMapsFromMeta(meta);
  if (maps.length === 0) return meta;

  const orderedMaps = orderGameMapsForLocationLookup(meta, maps);

  for (const map of orderedMaps) {
    if (!gameMapContainsLocation(map, location)) continue;
    const syncedMap = syncGameMapPartyPosition(map, location) ?? map;
    return withActiveGameMapMeta({ ...meta, gameMaps: maps }, syncedMap);
  }

  const activeMap = orderedMaps[0]!;
  return {
    ...meta,
    gameMap: activeMap,
    gameMaps: maps,
    activeGameMapId: getGameMapId(activeMap),
  };
}
