import {
  normalizeStatIcon,
  normalizeTextForMatch,
  type SupportedStatIcon,
  type TrackerStatIconAssignment,
} from "@marinara-engine/shared";

function assignmentKey(name: unknown, occurrence: unknown) {
  return `${normalizeTextForMatch(name)}\u0000${occurrence}`;
}

export function normalizeStatIconAssignments(value: unknown): TrackerStatIconAssignment[] {
  if (!Array.isArray(value)) return [];
  const assignments = new Map<string, TrackerStatIconAssignment>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    if (typeof record.name !== "string") continue;
    if (typeof record.occurrence !== "number") continue;
    const occurrence = record.occurrence;
    if (!Number.isInteger(occurrence) || occurrence < 0) continue;
    const icon = record.icon === null ? null : normalizeStatIcon(record.icon);
    if (record.icon !== null && !icon) continue;
    const assignment = { name: record.name.trim(), occurrence, icon };
    assignments.set(assignmentKey(assignment.name, occurrence), assignment);
  }

  return Array.from(assignments.values());
}

export function resolveStatIconAssignment(
  assignments: readonly TrackerStatIconAssignment[],
  name: string,
  occurrence: number,
): SupportedStatIcon | null | undefined {
  return assignments.find(
    (assignment) =>
      normalizeTextForMatch(assignment.name) === normalizeTextForMatch(name) &&
      assignment.occurrence === occurrence,
  )?.icon;
}

export function setStatIconAssignment(
  assignments: readonly TrackerStatIconAssignment[],
  name: string,
  occurrence: number,
  icon: SupportedStatIcon | null | undefined,
): TrackerStatIconAssignment[] {
  const key = assignmentKey(name, occurrence);
  const next = assignments.filter((assignment) => assignmentKey(assignment.name, assignment.occurrence) !== key);
  if (icon !== undefined) next.push({ name: name.trim(), occurrence, icon });
  return next;
}

export function getStatNameOccurrence(
  stats: readonly { name: string }[],
  index: number,
) {
  const normalizedName = normalizeTextForMatch(stats[index]?.name);
  return stats
    .slice(0, Math.max(0, index))
    .filter((stat) => normalizeTextForMatch(stat.name) === normalizedName).length;
}

export function remapStatIconAssignments(
  assignments: readonly TrackerStatIconAssignment[],
  previousStats: readonly { name: string }[],
  nextStats: readonly { name: string }[],
  previousIndexForNext: (nextIndex: number) => number | undefined,
): TrackerStatIconAssignment[] {
  const nextAssignments: TrackerStatIconAssignment[] = [];
  nextStats.forEach((stat, nextIndex) => {
    const previousIndex = previousIndexForNext(nextIndex);
    if (previousIndex === undefined || !previousStats[previousIndex]) return;
    const icon = resolveStatIconAssignment(
      assignments,
      previousStats[previousIndex]!.name,
      getStatNameOccurrence(previousStats, previousIndex),
    );
    if (icon === undefined) return;
    nextAssignments.push({
      name: stat.name.trim(),
      occurrence: getStatNameOccurrence(nextStats, nextIndex),
      icon,
    });
  });
  return nextAssignments;
}
