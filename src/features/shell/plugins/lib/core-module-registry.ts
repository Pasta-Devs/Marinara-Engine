import type {
  CoreModuleManifest,
  CoreModuleSettings,
  CoreModuleStyleContribution,
  CoreModuleView,
} from "../../../../engine/contracts/types/core-module";

export const ME_NOTES_MODULE_ID = "me-notes";

const CORE_MODULES: readonly CoreModuleManifest[] = [
  {
    id: ME_NOTES_MODULE_ID,
    name: "ME Notes",
    slug: "me-notes",
    description:
      "Adds a compact movable chat notepad with global, character, chat, and branch-wide note tabs.",
    version: "1.0.0",
    source: "core",
    main: "core-modules/me-notes",
    permissions: ["ui:messages", "ui:settings", "ui:overlay", "storage:plugin-memory"],
    defaultEnabled: false,
    runtime: "Floating chat notepad",
  },
] as const;

const CORE_MODULE_STYLES: Record<string, string> = {};
const CORE_MODULE_SURFACES: Record<string, number> = {
  [ME_NOTES_MODULE_ID]: 1,
};

function isModuleEnabled(module: CoreModuleManifest, settings: CoreModuleSettings): boolean {
  return settings.enabled[module.id] ?? module.defaultEnabled;
}

export function isCoreModuleEnabled(moduleId: string, settings: CoreModuleSettings): boolean {
  const module = CORE_MODULES.find((item) => item.id === moduleId);
  return module ? isModuleEnabled(module, settings) : false;
}

export function coreModuleViews(settings: CoreModuleSettings): CoreModuleView[] {
  return CORE_MODULES.map((module) => {
    const enabled = isModuleEnabled(module, settings);
    return {
      ...module,
      enabled,
      status: enabled ? "enabled" : "disabled",
      styles: CORE_MODULE_STYLES[module.id] ? 1 : 0,
      surfaces: CORE_MODULE_SURFACES[module.id] ?? 0,
    };
  });
}

export function enabledCoreModuleStyles(settings: CoreModuleSettings): CoreModuleStyleContribution[] {
  return CORE_MODULES.flatMap((module) => {
    const css = CORE_MODULE_STYLES[module.id];
    if (!css || !isModuleEnabled(module, settings)) return [];
    return [{ moduleId: module.id, css }];
  });
}
