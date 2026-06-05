export type CoreModulePermission =
  | "ui:messages"
  | "ui:settings"
  | "ui:styles"
  | "ui:overlay"
  | "storage:browser"
  | "storage:plugin-memory";

type CoreModuleSource = "core";

export interface CoreModuleManifest {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  source: CoreModuleSource;
  main: string;
  permissions: CoreModulePermission[];
  defaultEnabled: boolean;
  runtime?: string;
  configurable?: boolean;
}

export interface CoreModuleStyleContribution {
  moduleId: string;
  css: string;
}

export interface CoreModuleSettings {
  enabled: Record<string, boolean>;
}

export interface CoreModuleView extends CoreModuleManifest {
  enabled: boolean;
  status: "enabled" | "disabled";
  styles: number;
  surfaces: number;
}
