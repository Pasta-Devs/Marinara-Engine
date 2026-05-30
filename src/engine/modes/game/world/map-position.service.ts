import type { GameMap, MapEdge, MapNode } from "../../../contracts/types/game";

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
  mapName: string | null;
}

function normalizeLocationValue(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(?:the|a|an)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function getGameMapId(map: GameMap | null | undefined, fallbackIndex = 0): string | null {
  if (!map) return null;
  const explicit = map.id?.trim();
  if (explicit) return explicit;
  return slugifyGameMapId(map.name || "") || `map-${fallbackIndex + 1}`;
}

function ensureGameMapId(map: GameMap, existingMaps: readonly GameMap[] = []): GameMap {
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

function upsertGameMap(maps: readonly GameMap[], map: GameMap): GameMap[] {
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

function getGameMapsFromMeta(meta: Record<string, unknown>): GameMap[] {
  const rawMaps = Array.isArray(meta.gameMaps) ? meta.gameMaps : [];
  const maps = rawMaps.filter(isGameMap).reduce<GameMap[]>((acc, map) => upsertGameMap(acc, map), []);
  const activeMap = isGameMap(meta.gameMap) ? meta.gameMap : null;
  return activeMap ? upsertGameMap(maps, activeMap) : maps;
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
      mapName: (values.get("map") ?? values.get("map_name") ?? values.get("area") ?? "").trim() || null,
    });
  }

  return commands;
}

function applyMapUpdateCommand(map: GameMap | null, command: MapUpdateCommand): GameMap | null {
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

function emptyNodeMap(name: string, existingMaps: readonly GameMap[]): GameMap {
  return ensureGameMapId(
    {
      type: "node",
      name,
      description: "",
      nodes: [],
      edges: [],
      partyPosition: "",
    } as GameMap,
    existingMaps,
  );
}

function findMapMatch(maps: readonly GameMap[], mapName: string | null | undefined): GameMap | null {
  const name = mapName?.trim();
  if (!name) return null;
  return findBestMatch(name, maps, (map) => [getGameMapId(map) ?? "", map.name ?? ""])?.entry ?? null;
}

export function applyMapUpdateCommandsToMeta(
  meta: Record<string, unknown>,
  commands: readonly MapUpdateCommand[],
): Record<string, unknown> {
  if (commands.length === 0) return meta;

  let maps = getGameMapsFromMeta(meta);
  const activeId =
    typeof meta.activeGameMapId === "string"
      ? meta.activeGameMapId
      : getGameMapId(isGameMap(meta.gameMap) ? meta.gameMap : null);
  let activeMap =
    (activeId ? maps.find((map, index) => getGameMapId(map, index) === activeId) : null) ??
    (isGameMap(meta.gameMap) ? meta.gameMap : null) ??
    maps[0] ??
    null;
  let changed = false;

  for (const command of commands) {
    const matchingMap = findMapMatch(maps, command.mapName);
    let targetMap = matchingMap ?? activeMap;
    if (command.mapName && !matchingMap) {
      targetMap = emptyNodeMap(command.mapName, maps);
      maps = upsertGameMap(maps, targetMap);
      changed = true;
    }
    if (!targetMap) continue;

    const updated = applyMapUpdateCommand(targetMap, command);
    if (!updated) continue;
    maps = upsertGameMap(maps, updated);
    activeMap = updated;
    changed = true;
  }

  if (!changed || !activeMap) return meta;
  return {
    ...meta,
    gameMap: activeMap,
    gameMaps: maps,
    activeGameMapId: getGameMapId(activeMap),
  };
}
