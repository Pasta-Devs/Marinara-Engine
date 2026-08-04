const activeNoodleOperations = new Set<string>();

export function claimNoodleOperation(key: string): (() => void) | null {
  if (activeNoodleOperations.has(key)) return null;
  activeNoodleOperations.add(key);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeNoodleOperations.delete(key);
  };
}

export function isNoodleOperationActive(key: string): boolean {
  return activeNoodleOperations.has(key);
}

export function resetNoodleOperationsForTests() {
  activeNoodleOperations.clear();
}
