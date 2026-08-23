import type { BuiltInAgentManifest, InstalledCapabilityPackage } from "@marinara-engine/shared";

export function resolveFeatureAgentPackage(
  agent: BuiltInAgentManifest,
  installedPackages: readonly InstalledCapabilityPackage[],
): InstalledCapabilityPackage | null {
  return (
    installedPackages.find((item) => item.id === agent.packageId) ??
    installedPackages.find((item) => item.manifest.contributions?.agentDetail?.agentIds.includes(agent.id) === true) ??
    null
  );
}
