import { replaceBuiltInAgentDefinitions, type BuiltInAgentManifest } from "@marinara-engine/shared";
import { capabilityPackageManager } from "./package-manager.service.js";

export async function initializeCapabilityAgentRegistry(): Promise<void> {
  await refreshCapabilityAgentRegistry();
}

export async function refreshCapabilityAgentRegistry(): Promise<readonly BuiltInAgentManifest[]> {
  const definitions = await capabilityPackageManager.agentDefinitions();
  replaceBuiltInAgentDefinitions(definitions);
  return definitions;
}
