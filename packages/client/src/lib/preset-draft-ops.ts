// ──────────────────────────────────────────────
// Preset editor drafts (new layout)
//
// Nothing in the full preset editor saves until Save / Ctrl+S: adding, editing,
// deleting and reordering prompt sections, groups and variables are kept as a
// list of operations. The editor shows the saved preset with those operations
// applied, and Save sends them to the server in order. New items get a
// temporary id until Save gives them a real one.
// ──────────────────────────────────────────────
import { api } from "./api-client";

type Row = Record<string, unknown> & { id: string };
type Patch = Record<string, unknown>;

export type PresetDraftOp =
  | { kind: "createSection"; tempId: string; data: Patch }
  | { kind: "updateSection"; id: string; patch: Patch }
  | { kind: "deleteSection"; id: string }
  | { kind: "reorderSections"; ids: string[] }
  | { kind: "createGroup"; tempId: string; data: Patch }
  | { kind: "updateGroup"; id: string; patch: Patch }
  | { kind: "deleteGroup"; id: string }
  | { kind: "createVariable"; tempId: string; data: Patch }
  | { kind: "updateVariable"; id: string; patch: Patch }
  | { kind: "deleteVariable"; id: string }
  | { kind: "reorderVariables"; ids: string[] };

export interface PresetFullLike {
  preset: unknown;
  sections: unknown[];
  groups: unknown[];
  choiceBlocks: unknown[];
}

const TEMP_PREFIX = "draft_";
let tempCounter = 0;
export const newDraftId = () => `${TEMP_PREFIX}${Date.now().toString(36)}_${(tempCounter += 1)}`;
export const isDraftId = (id: unknown) => typeof id === "string" && id.startsWith(TEMP_PREFIX);

function readIds(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** A new section as the server would store it, so the editor reads it like any other. */
function sectionRow(id: string, presetId: string, data: Patch): Row {
  return {
    id,
    presetId,
    identifier: data.identifier ?? id,
    name: data.name ?? "",
    content: data.content ?? "",
    role: data.role ?? "system",
    enabled: String(data.enabled ?? true),
    isMarker: String(data.isMarker ?? false),
    groupId: data.groupId ?? null,
    markerConfig: data.markerConfig ? JSON.stringify(data.markerConfig) : null,
    injectionPosition: data.injectionPosition ?? "ordered",
    injectionDepth: data.injectionDepth ?? 0,
    injectionOrder: data.injectionOrder ?? 100,
    forbidOverrides: String(data.forbidOverrides ?? false),
    skipWrap: String(data.skipWrap ?? false),
  };
}

/** The saved preset with the unsaved operations applied, in the same shape. */
export function applyPresetDraftOps<T extends PresetFullLike>(data: T, ops: PresetDraftOp[]): T {
  if (ops.length === 0) return data;
  const preset = { ...(data.preset as Patch) };
  const presetId = String(preset.id ?? "");
  let sections = (data.sections as Row[]).map((row) => ({ ...row }));
  let groups = (data.groups as Row[]).map((row) => ({ ...row }));
  let variables = (data.choiceBlocks as Row[]).map((row) => ({ ...row }));
  let sectionOrder = readIds(preset.sectionOrder);
  let groupOrder = readIds(preset.groupOrder);
  const patchRow = (rows: Row[], id: string, patch: Patch) =>
    rows.map((row) => (row.id === id ? { ...row, ...patch } : row));

  for (const op of ops) {
    switch (op.kind) {
      case "createSection":
        sections.push(sectionRow(op.tempId, presetId, op.data));
        sectionOrder = [...sectionOrder, op.tempId];
        break;
      case "updateSection":
        sections = patchRow(sections, op.id, op.patch);
        break;
      case "deleteSection":
        sections = sections.filter((row) => row.id !== op.id);
        sectionOrder = sectionOrder.filter((id) => id !== op.id);
        break;
      case "reorderSections":
        sectionOrder = op.ids;
        sections = sections.map((row) => {
          const index = op.ids.indexOf(row.id);
          return index < 0 ? row : { ...row, injectionOrder: index * 100 };
        });
        break;
      case "createGroup":
        groups.push({
          id: op.tempId,
          presetId,
          name: op.data.name ?? "",
          parentGroupId: op.data.parentGroupId ?? null,
          order: op.data.order ?? 100,
          enabled: String(op.data.enabled ?? true),
        });
        groupOrder = [...groupOrder, op.tempId];
        break;
      case "updateGroup":
        groups = patchRow(groups, op.id, op.patch);
        break;
      case "deleteGroup":
        groups = groups
          .filter((row) => row.id !== op.id)
          .map((row) => (row.parentGroupId === op.id ? { ...row, parentGroupId: null } : row));
        sections = sections.map((row) => (row.groupId === op.id ? { ...row, groupId: null } : row));
        groupOrder = groupOrder.filter((id) => id !== op.id);
        break;
      case "createVariable":
        variables.push({ ...op.data, id: op.tempId, presetId });
        break;
      case "updateVariable":
        variables = patchRow(variables, op.id, op.patch);
        break;
      case "deleteVariable":
        variables = variables.filter((row) => row.id !== op.id);
        break;
      case "reorderVariables": {
        const rank = new Map(op.ids.map((id, index) => [id, index]));
        variables = [...variables].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
        break;
      }
    }
  }
  preset.sectionOrder = JSON.stringify(sectionOrder);
  preset.groupOrder = JSON.stringify(groupOrder);
  return { ...data, preset, sections, groups, choiceBlocks: variables };
}

/** Adds an op, folding a field edit into the previous edit of the same item. */
export function pushPresetDraftOp(ops: PresetDraftOp[], op: PresetDraftOp): PresetDraftOp[] {
  const last = ops[ops.length - 1];
  if (
    last &&
    (op.kind === "updateSection" || op.kind === "updateGroup" || op.kind === "updateVariable") &&
    last.kind === op.kind &&
    last.id === op.id
  ) {
    return [...ops.slice(0, -1), { ...last, patch: { ...last.patch, ...op.patch } }];
  }
  return [...ops, op];
}

function remapOp(op: PresetDraftOp, map: Map<string, string>): PresetDraftOp {
  const id = (value: string) => map.get(value) ?? value;
  const fields = (patch: Patch) => {
    const next = { ...patch };
    for (const key of ["groupId", "parentGroupId"]) {
      if (typeof next[key] === "string") next[key] = id(next[key] as string);
    }
    return next;
  };
  switch (op.kind) {
    case "createSection":
    case "createGroup":
    case "createVariable":
      return { ...op, data: fields(op.data) };
    case "updateSection":
    case "updateGroup":
    case "updateVariable":
      return { ...op, id: id(op.id), patch: fields(op.patch) };
    case "deleteSection":
    case "deleteGroup":
    case "deleteVariable":
      return { ...op, id: id(op.id) };
    case "reorderSections":
    case "reorderVariables":
      return { ...op, ids: op.ids.map(id) };
  }
}

/**
 * Sends the operations in order. Returns how many were sent and the temporary → real ids, so ops
 * added while saving (or left after a failure) can be pointed at the real items.
 */
export async function flushPresetDraftOps(
  presetId: string,
  ops: PresetDraftOp[],
  ids: Map<string, string> = new Map(),
): Promise<{ sent: number; ids: Map<string, string>; error?: unknown }> {
  const base = `/prompts/${presetId}`;
  let sent = 0;
  try {
    for (const raw of ops) {
      const op = remapOp(raw, ids);
      switch (op.kind) {
        case "createSection": {
          const created = await api.post<{ id: string }>(`${base}/sections`, op.data);
          ids.set(op.tempId, created.id);
          break;
        }
        case "updateSection":
          await api.patch(`${base}/sections/${op.id}`, op.patch);
          break;
        case "deleteSection":
          await api.delete(`${base}/sections/${op.id}`);
          break;
        case "reorderSections":
          await api.put(`${base}/sections/reorder`, { sectionIds: op.ids });
          break;
        case "createGroup": {
          const created = await api.post<{ id: string }>(`${base}/groups`, op.data);
          ids.set(op.tempId, created.id);
          break;
        }
        case "updateGroup":
          await api.patch(`${base}/groups/${op.id}`, op.patch);
          break;
        case "deleteGroup":
          await api.delete(`${base}/groups/${op.id}`);
          break;
        case "createVariable": {
          const created = await api.post<{ id: string }>(`${base}/variables`, op.data);
          ids.set(op.tempId, created.id);
          break;
        }
        case "updateVariable":
          await api.patch(`${base}/variables/${op.id}`, op.patch);
          break;
        case "deleteVariable":
          await api.delete(`${base}/variables/${op.id}`);
          break;
        case "reorderVariables":
          await api.put(`${base}/variables/reorder`, { variableIds: op.ids });
          break;
      }
      sent += 1;
    }
    return { sent, ids };
  } catch (error) {
    return { sent, ids, error };
  }
}

/** Points the ops that were not sent yet at the real ids Save created. */
export function remapPresetDraftOps(ops: PresetDraftOp[], ids: Map<string, string>): PresetDraftOp[] {
  return ids.size === 0 ? ops : ops.map((op) => remapOp(op, ids));
}
