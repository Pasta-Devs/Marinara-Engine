import { PackageCheck } from "lucide-react";

export function CoreModulePlaceholder() {
  return (
    <div
      data-core-module="core-module-placeholder"
      className="fixed bottom-[4.5rem] right-4 z-[9997] inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] shadow-xl"
    >
      <PackageCheck size="0.875rem" className="text-[var(--primary)]" />
      <span>Module active</span>
    </div>
  );
}
