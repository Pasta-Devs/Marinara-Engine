import { CheckCircle2, Package, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../../shared/lib/utils";
import { useCoreModules, useSetCoreModuleEnabled } from "../hooks/use-core-modules";

const PERMISSION_LABELS: Record<string, string> = {
  "ui:messages": "Message UI",
  "ui:settings": "Settings",
  "ui:styles": "Styles",
  "ui:overlay": "Overlay UI",
  "storage:browser": "Browser storage",
  "storage:plugin-memory": "Plugin memory",
};

function permissionLabel(permission: string) {
  return PERMISSION_LABELS[permission] ?? permission;
}

function CoreModulesSettings() {
  const { data: modules = [], error, isError, isLoading, refetch, isFetching } = useCoreModules();
  const setEnabled = useSetCoreModuleEnabled();
  const controlsDisabled = setEnabled.isPending || isError;

  const handleToggle = async (moduleId: string, enabled: boolean, name: string) => {
    try {
      await setEnabled.mutateAsync({ moduleId, enabled });
      toast.success(`${name} ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to update ${name}.`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <Package size="0.75rem" />
            Bundled opt-in modules shipped with Marinara.
          </div>
          <p className="mt-1 text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
            Downloadable plugin installs are intentionally separate from this trusted core list.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size="0.8125rem" className={cn(isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {isError && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-snug text-[var(--foreground)]">
            Core modules are registered, but Marinara could not read module settings from app storage.{" "}
            {error instanceof Error ? error.message : "Open this in the Tauri app shell and try again."}
          </div>
        )}

        {modules.map((module) => (
          <article
            key={module.id}
            className={cn(
              "rounded-lg border bg-[var(--card)]/55 p-3 shadow-sm transition-colors",
              module.enabled ? "border-[var(--primary)]/35" : "border-[var(--border)]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  <Package size="1rem" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">{module.name}</h3>
                    <span className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                      Core
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[0.6875rem] text-[var(--muted-foreground)]">{module.slug}</div>
                </div>
              </div>

              <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={module.enabled}
                  disabled={controlsDisabled}
                  onChange={(event) => void handleToggle(module.id, event.target.checked, module.name)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex h-6 w-11 items-center rounded-full p-0.5 ring-1 transition-colors peer-disabled:opacity-60",
                    module.enabled
                      ? "bg-[var(--primary)]/25 ring-[var(--primary)]/55"
                      : "bg-[var(--secondary)] ring-[var(--border)]",
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full transition-transform",
                      module.enabled
                        ? "translate-x-5 bg-[var(--primary)]"
                        : "translate-x-0 bg-[var(--muted-foreground)]",
                    )}
                  />
                </span>
                {module.enabled ? "Enabled" : "Disabled"}
              </label>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]/90">{module.description}</p>

            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <div className="font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Source</div>
                <div className="mt-0.5 text-[var(--foreground)]">Core module</div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Version</div>
                <div className="mt-0.5 text-[var(--foreground)]">{module.version}</div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Status</div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[var(--foreground)]">
                  <CheckCircle2 size="0.75rem" />
                  {module.enabled ? "Loaded" : "Available"}
                </div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Main</div>
                <div className="mt-0.5 truncate font-mono text-[0.6875rem] text-[var(--foreground)]">{module.main}</div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Styles</div>
                <div className="mt-0.5 text-[var(--foreground)]">
                  {module.styles === 1 ? "1 contribution" : module.styles ? `${module.styles} contributions` : "None"}
                </div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Runtime</div>
                <div className="mt-0.5 text-[var(--foreground)]">
                  {module.runtime ?? (module.surfaces === 1 ? "1 surface" : module.surfaces ? `${module.surfaces} surfaces` : "None")}
                </div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Trust</div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[var(--foreground)]">
                  <ShieldCheck size="0.75rem" />
                  Bundled
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="font-semibold uppercase tracking-wide text-[var(--muted-foreground)] text-xs">
                Permissions
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {module.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full bg-[var(--secondary)] px-2 py-1 font-mono text-[0.6875rem] text-[var(--foreground)] ring-1 ring-[var(--border)]"
                  >
                    {permissionLabel(permission)}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}

        {!isLoading && modules.length === 0 && (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 p-3 text-center text-xs text-[var(--muted-foreground)]">
            No core modules are registered in this build.
          </p>
        )}
      </div>
    </div>
  );
}

export default CoreModulesSettings;
