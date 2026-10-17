// ──────────────────────────────────────────────
// Capability connection picker: capabilityProps.ui.pickConnection(), UI only.
// The Engine renders the dialog; packages never import Engine components.
// ──────────────────────────────────────────────
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CapabilityClientUi, ConnectionPickerKind, ConnectionPickerResult } from "@marinara-engine/shared";

type PickerModule = typeof import("../components/connections/ConnectionPicker");

const KINDS: readonly ConnectionPickerKind[] = ["chat", "image", "video", "audio", "decision", "all"];
const MAX_ID = 200;
const MAX_TITLE = 240;
const MAX_LABEL = 500;
const CANCELLED: ConnectionPickerResult = { status: "cancelled" };

interface PickerRequest {
  id: number;
  value: string | null;
  kind: ConnectionPickerKind;
  title?: string;
  defaultLabel?: string;
  includeDefault: boolean;
  includeLocalSidecar: boolean;
  Picker: PickerModule["ConnectionPicker"] | null;
}

function text(input: unknown, max: number): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim().slice(0, max) : undefined;
}

/** Throws TypeError for an unusable options object or kind; coerces everything else. */
function normalize(options: unknown): Omit<PickerRequest, "id" | "Picker"> {
  if (options != null && (typeof options !== "object" || Array.isArray(options))) {
    throw new TypeError("pickConnection options must be an object");
  }
  const o = (options ?? {}) as Record<string, unknown>;
  const kind = o.kind ?? "chat";
  if (!KINDS.includes(kind as ConnectionPickerKind)) throw new TypeError(`Unknown connection kind: ${String(kind)}`);
  if (o.value != null && (typeof o.value !== "string" || o.value.length > MAX_ID)) {
    throw new TypeError("pickConnection value must be a saved Model id or null");
  }
  return {
    value: typeof o.value === "string" && o.value ? o.value : null,
    kind: kind as ConnectionPickerKind,
    title: text(o.title, MAX_TITLE),
    defaultLabel: text(o.defaultLabel, MAX_LABEL),
    includeDefault: typeof o.includeDefault === "boolean" ? o.includeDefault : true,
    includeLocalSidecar: kind === "chat" && o.includeLocalSidecar === true,
  };
}

/**
 * `scopeKey` identifies the capability host instance (package, version, attempt, state).
 * Any change, or unmount, resolves the open request as cancelled and invalidates the
 * previous `ui` object, so retained package callbacks can never open a dialog.
 */
export function useCapabilityConnectionPicker(scopeKey: string): { ui: CapabilityClientUi; dialog: ReactNode } {
  const [request, setRequest] = useState<PickerRequest | null>(null);
  const pending = useRef<{ id: number; resolve: (result: ConnectionPickerResult) => void } | null>(null);
  const seq = useRef(0);
  // Not state: StrictMode runs setup → cleanup → setup on the same memoized scope.
  const scope = useMemo(
    () => ({ key: scopeKey, active: false, opener: { current: null as HTMLElement | null } }),
    [scopeKey],
  );

  const settle = useCallback((id: number | null, result: ConnectionPickerResult) => {
    const current = pending.current;
    if (!current || (id !== null && current.id !== id)) return;
    pending.current = null;
    setRequest(null);
    current.resolve(result);
  }, []);

  // Layout effect so the scope is live before the package element connects.
  useLayoutEffect(() => {
    scope.active = true;
    return () => {
      scope.active = false;
      settle(null, CANCELLED);
    };
  }, [scope, settle]);

  const ui = useMemo<CapabilityClientUi>(
    () => ({
      pickConnection(options) {
        // A stale scope must not touch the newer scope's pending request.
        if (!scope.active) return Promise.resolve(CANCELLED);
        let normalized;
        try {
          normalized = normalize(options);
        } catch (error) {
          return Promise.reject(error);
        }
        const active = document.activeElement;
        if (!(active instanceof Element && active.closest(".connection-picker-dialog"))) {
          if (!pending.current) scope.opener.current = null;
          if (active instanceof HTMLElement && active !== document.body) scope.opener.current = active;
        }
        settle(null, CANCELLED); // a new request supersedes the previous one
        const id = ++seq.current;
        return new Promise<ConnectionPickerResult>((resolve) => {
          pending.current = { id, resolve };
          setRequest({ id, ...normalized, Picker: null });
          import("../components/connections/ConnectionPicker").then(
            ({ ConnectionPicker }) => setRequest((r) => (r && r.id === id ? { ...r, Picker: ConnectionPicker } : r)),
            () => settle(id, CANCELLED),
          );
        });
      },
    }),
    [scope, settle],
  );

  const Picker = request?.Picker;
  const dialog =
    request && Picker ? (
      <Picker
        key={request.id}
        open
        value={request.value}
        kind={request.kind}
        title={request.title}
        defaultLabel={request.defaultLabel}
        includeDefault={request.includeDefault}
        includeLocalSidecar={request.includeLocalSidecar}
        restoreFocusRef={scope.opener}
        onClose={() => settle(request.id, CANCELLED)}
        onChange={(value) =>
          settle(request.id, { status: "selected", value: typeof value === "string" && value ? value : null })
        }
      />
    ) : null;

  return { ui, dialog };
}
