// Professor Mari's Permissions Mode (#5725): a user-selectable policy for
// when Mari may stage or apply workspace changes, modeled on the mode picker
// in Anthropic's Claude app. Server-authoritative: the value lives in
// app_settings under MARI_PERMISSIONS_MODE_SETTINGS_KEY, is written only by
// the validated PUT /api/professor-mari/workspace/permissions-mode route, and
// is read fresh on every Mari run (never latched into a service field).
export const MARI_PERMISSIONS_MODE_SETTINGS_KEY = "mari-permissions-mode";

export const MARI_PERMISSIONS_MODES = ["auto", "manual", "accept-edits", "plan", "bypass"] as const;

export type MariPermissionsMode = (typeof MARI_PERMISSIONS_MODES)[number];

export const DEFAULT_MARI_PERMISSIONS_MODE: MariPermissionsMode = "auto";

export function isMariPermissionsMode(value: unknown): value is MariPermissionsMode {
  return typeof value === "string" && (MARI_PERMISSIONS_MODES as readonly string[]).includes(value);
}

/** Labels and one-line descriptions for pickers; keep in sync with docs. */
export const MARI_PERMISSIONS_MODE_LABELS: Record<MariPermissionsMode, { label: string; description: string }> = {
  auto: {
    label: "Auto",
    description: "Mari decides from your words and saved memories when to describe, stage, or ask first.",
  },
  manual: {
    label: "Manual",
    description: "Always ask before making changes: Mari describes first and stages only after you say go.",
  },
  "accept-edits": {
    label: "Accept edits",
    description: "Record edits apply without the Keep/Restore card. Deletions and sensitive changes still get review.",
  },
  plan: {
    label: "Plan",
    description: "Mari never changes anything: she lays out the exact changes she would make, in chat.",
  },
  bypass: {
    label: "Bypass permissions",
    description:
      "Mari applies changes without asking or showing review cards. Deletions and sensitive changes keep their review.",
  },
};
