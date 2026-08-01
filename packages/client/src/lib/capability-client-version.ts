export function capabilityClientNeedsRefresh(
  loadedVersion: string | undefined,
  installedVersion: string,
  customElementRegistered: boolean,
): boolean {
  return Boolean(loadedVersion && loadedVersion !== installedVersion && customElementRegistered);
}

export interface CapabilityClientImport {
  version: string;
  attempt: number;
}

const activeCapabilityClientImports = new Map<string, CapabilityClientImport>();

export function getCapabilityClientImport(packageId: string): CapabilityClientImport | undefined {
  return activeCapabilityClientImports.get(packageId);
}

export function beginCapabilityClientImport(packageId: string, next: CapabilityClientImport): boolean {
  if (activeCapabilityClientImports.has(packageId)) return false;
  activeCapabilityClientImports.set(packageId, next);
  return true;
}

export function finishCapabilityClientImport(packageId: string, completed: CapabilityClientImport): boolean {
  const active = activeCapabilityClientImports.get(packageId);
  if (active?.version !== completed.version || active.attempt !== completed.attempt) return false;
  activeCapabilityClientImports.delete(packageId);
  return true;
}
