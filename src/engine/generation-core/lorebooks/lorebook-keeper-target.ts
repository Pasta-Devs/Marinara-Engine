import {
  resolveActiveLorebookScopeReasons,
  type ActiveLorebookScopeContext,
  type ActiveLorebookScopeLorebook,
  type ActiveLorebookScopeReason,
} from "./active-lorebook-scope";

type LorebookKeeperTargetSource = "configured" | "proposed" | "active";

export interface LorebookKeeperTarget {
  id: string;
  name: string;
  source: LorebookKeeperTargetSource;
}

export interface LorebookKeeperTargetContext extends ActiveLorebookScopeContext {
  proposedLorebookId?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}

function stringArray(value: unknown): string[] {
  return parseArray(value)
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function targetFromLorebook(
  lorebook: ActiveLorebookScopeLorebook | undefined,
  source: LorebookKeeperTargetSource,
): LorebookKeeperTarget | null {
  const id = readString(lorebook?.id);
  if (!id) return null;
  return {
    id,
    name: readString(lorebook?.name, "Lorebook"),
    source,
  };
}

function targetableAutoReasons(reasons: readonly ActiveLorebookScopeReason[]): boolean {
  return reasons.some((reason) => reason.reason !== "global");
}

function activeTargetFromIds(
  ids: readonly string[],
  lorebookById: Map<string, ActiveLorebookScopeLorebook>,
  context: ActiveLorebookScopeContext,
  source: LorebookKeeperTargetSource,
): LorebookKeeperTarget | null {
  for (const id of ids) {
    const lorebook = lorebookById.get(id);
    if (!lorebook) continue;
    if (!targetableAutoReasons(resolveActiveLorebookScopeReasons(lorebook, context))) continue;
    const target = targetFromLorebook(lorebook, source);
    if (target) return target;
  }
  return null;
}

export function resolveLorebookKeeperTarget(
  lorebooks: readonly ActiveLorebookScopeLorebook[],
  context: LorebookKeeperTargetContext,
): LorebookKeeperTarget | null {
  const lorebookById = new Map(
    lorebooks
      .map((lorebook) => [readString(lorebook.id), lorebook] as const)
      .filter(([id]) => id.length > 0),
  );
  const chat = context.chat ?? {};
  const metadata = parseRecord(chat.metadata);
  const configuredLorebookId = readString(metadata.lorebookKeeperTargetLorebookId);
  const configuredTarget = targetFromLorebook(lorebookById.get(configuredLorebookId), "configured");
  if (configuredTarget) return configuredTarget;

  const proposedTarget = activeTargetFromIds(
    [readString(context.proposedLorebookId)],
    lorebookById,
    context,
    "proposed",
  );
  if (proposedTarget) return proposedTarget;

  const selectedTarget = activeTargetFromIds(
    stringArray(metadata.activeLorebookIds ?? chat.activeLorebookIds),
    lorebookById,
    context,
    "active",
  );
  if (selectedTarget) return selectedTarget;

  return activeTargetFromIds(
    lorebooks.map((lorebook) => readString(lorebook.id)),
    lorebookById,
    context,
    "active",
  );
}
