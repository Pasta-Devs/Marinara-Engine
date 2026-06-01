import type { Panel } from "../../../shared/stores/ui.store";

export const DISCOVERY_CATEGORIES = [
  "Getting started",
  "Chat modes",
  "Library",
  "Agents",
  "Media",
  "Settings",
  "Advanced",
  "Help",
] as const;

export const DISCOVERY_COVERAGE = ["core", "advanced", "experimental", "needs-polish"] as const;

export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];
export type DiscoveryCoverage = (typeof DISCOVERY_COVERAGE)[number];
export type DiscoveryPanelTarget = Exclude<Panel, "chat">;

export type DiscoveryAction =
  | {
      type: "open-panel";
      panel: DiscoveryPanelTarget;
      label?: string;
    }
  | {
      type: "open-settings";
      tab: string;
      label?: string;
    }
  | {
      type: "replay-onboarding";
      label?: string;
    }
  | {
      type: "open-professor-mari";
      label?: string;
    }
  | {
      type: "go-home";
      label?: string;
    };

export interface DiscoveryEntry {
  id: string;
  title: string;
  category: DiscoveryCategory;
  summary: string;
  keywords: string[];
  audience: string;
  where: string;
  actions: DiscoveryAction[];
  coverage: DiscoveryCoverage;
}
