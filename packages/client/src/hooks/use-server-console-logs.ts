// ──────────────────────────────────────────────
// Server console feed
//
// Reads the server's recent log lines (GET /api/admin/logs) while `active`: the whole buffer first, then only
// what is new every couple of seconds. It waits while the tab is hidden and stops for good on a 403, which
// polling again cannot fix. The lines stay in this component's state; closing the console drops them.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../lib/api-client";
import { toConsoleLine, type ConsoleRow, type ServerLogReply } from "../lib/server-console";

const POLL_INTERVAL_MS = 2_000;
const MAX_ROWS = 1_500;

export function useServerConsoleLogs(active: boolean) {
  const [rows, setRows] = useState<ConsoleRow[]>([]);
  const [logLevel, setLogLevel] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);

  /** Empties the view only; the server's buffer and this feed's place in it stay. */
  const clear = useCallback(() => setRows([]), []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let inFlight = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    // The newest line seen (0: none yet), the server restarts seen, and how many gap markers were made.
    let cursor = 0;
    let epoch = 0;
    let gaps = 0;
    let firstRead = true;

    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void poll(), delay);
    };
    const addGap = (): ConsoleRow => ({ kind: "gap", key: `gap-${gaps++}` });

    const poll = async () => {
      if (cancelled || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      controller = new AbortController();
      try {
        const query = cursor > 0 ? `?afterId=${cursor}` : "";
        const reply = await api.get<ServerLogReply>(`/admin/logs${query}`, { signal: controller.signal });
        if (cancelled) return;
        setError(null);
        setLoaded(true);
        setLogLevel(reply.logLevel);
        if (reply.latestId < cursor) {
          // The server restarted and numbers its lines from 1 again: read the new buffer from the top.
          epoch++;
          cursor = 0;
          setRows((previous) => [...previous, addGap()].slice(-MAX_ROWS));
          inFlight = false;
          schedule(0);
          return;
        }
        const added: ConsoleRow[] = reply.entries.map((entry) => toConsoleLine(entry, epoch));
        if (reply.truncated && !firstRead) added.unshift(addGap());
        firstRead = false;
        if (reply.latestId > 0) cursor = reply.latestId;
        if (added.length > 0) setRows((previous) => [...previous, ...added].slice(-MAX_ROWS));
        inFlight = false;
        schedule(POLL_INTERVAL_MS);
      } catch (caught) {
        inFlight = false;
        if (cancelled) return;
        setError(caught);
        // No access: asking again every two seconds only fills the server's rate limit.
        if (caught instanceof ApiError && caught.status === 403) return;
        schedule(POLL_INTERVAL_MS);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !inFlight) schedule(0);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active]);

  return { rows, logLevel, error, loaded, clear };
}
