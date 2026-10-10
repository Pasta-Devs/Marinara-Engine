import { useCallback, useEffect, useRef, useState } from "react";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  type ProfessorMariQuickErrorKind,
  type ProfessorMariQuickPromptRequest,
  type ProfessorMariQuickSource,
} from "@marinara-engine/shared";

import { api } from "../lib/api-client";
import { omnibarAsideAnswerCache } from "../lib/omnibar-aside-text";
import { useSidecarStore } from "../stores/sidecar.store";
import { useUIStore } from "../stores/ui.store";

/** Below this the query is too short to mean anything. Matches message search. */
const MIN_QUERY_LENGTH = 3;

/**
 * "waiting": idle delay is still counting down, nothing visible yet.
 * "thinking": the call is actually in flight - this is what shows the sprite.
 * "unavailable": the query dead-ended, but no model can answer, so nothing is called.
 */
export type OmnibarAsideStatus = "idle" | "unavailable" | "waiting" | "thinking" | "streaming" | "complete" | "error";

export interface OmnibarAsideState {
  status: OmnibarAsideStatus;
  /** The answer so far. Streams. */
  answer: string;
  /** Present only when status is "error". Plain, and never a toast (R24). */
  error: string | null;
  /** The query this answer belongs to, so a stale answer is never shown. */
  query: string;
  /** What answered: the local sidecar, or a connection name. */
  tier: "local" | "remote";
  /** Present only when status is "error": what kind of failure, so the copy can say what to do. */
  errorKind?: ProfessorMariQuickErrorKind | null;
  /** The docs pages the answer was grounded on. Sent before the words. */
  sources?: readonly ProfessorMariQuickSource[];
}

/** A failed answer, carrying the server's kind (or "empty" when the stream ended with no words). */
class QuickAnswerFailure extends Error {
  constructor(
    readonly kind: ProfessorMariQuickErrorKind,
    message: string,
  ) {
    super(message);
  }
}

const IDLE: OmnibarAsideState = { status: "idle", answer: "", error: null, query: "", tier: "local" };

/**
 * The cheap answer beside the omnibar list.
 *
 * It fires only when the deterministic list has already given up (R10) and the
 * input has been idle for the delay (R23), and it sends a payload built for an
 * unasked call - no memories, no field contents (R22). The list is never blocked
 * on it and never degraded by its failure (R2, R24).
 */
export function useOmnibarAside(params: {
  /** The connection that answers, already resolved (never the "same as Mari" sentinel). */
  connectionId: string;
  /** The typed query, after any scope prefix is stripped. */
  query: string;
  /** True when nothing deterministic matched well enough to answer. */
  deadEnd: boolean;
  /** Where the user is, for the narrow context payload. */
  source: NonNullable<ProfessorMariQuickPromptRequest["context"]>["source"];
  /** Human label of the focused resource, if there is one. Never its id. */
  resourceLabel?: string | null;
}): OmnibarAsideState & {
  retry: () => void;
  /** Asks the same question again, past the cache. */
  answerAgain: () => void;
} {
  const enabled = useUIStore((state) => state.omnibarAsideEnabled);
  const delayMs = useUIStore((state) => state.omnibarAsideDelayMs);
  const [state, setState] = useState<OmnibarAsideState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  // The docs the current answer is grounded on; kept while the words stream in.
  const sourcesRef = useRef<readonly ProfessorMariQuickSource[] | undefined>(undefined);

  const { connectionId, query, deadEnd, source, resourceLabel } = params;
  const trimmed = query.trim();
  const localModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const tier: OmnibarAsideState["tier"] = connectionId === LOCAL_SIDECAR_CONNECTION_ID ? "local" : "remote";
  // Without a downloaded local model every unasked call would only fail, so the
  // aside offers the setup instead of calling (R24: never a failure per query).
  const available = tier === "remote" || localModelDownloaded;
  const ready = enabled && deadEnd && trimmed.length >= MIN_QUERY_LENGTH;

  const runQuery = useCallback(
    (options: { bypassCache?: boolean } = {}) => {
      abortRef.current?.abort();
      const cached = options.bypassCache ? undefined : omnibarAsideAnswerCache.get(connectionId, trimmed);
      if (cached) {
        setState({
          status: "complete",
          answer: cached.answer,
          error: null,
          query: trimmed,
          tier: cached.tier,
          sources: cached.sources,
        });
        abortRef.current = null;
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      sourcesRef.current = undefined;
      setState({ status: "thinking", answer: "", error: null, query: trimmed, tier });
      const body: ProfessorMariQuickPromptRequest = {
        message: trimmed,
        connectionId,
        unasked: true,
        resourceLabel: resourceLabel ?? undefined,
        context: { source, query: trimmed },
      };
      void (async () => {
        let answer = "";
        try {
          for await (const event of api.streamEvents("/professor-mari/quick/prompt", body, controller.signal)) {
            if (event.type === "status") {
              // A status frame only ever precedes tokens; once streaming or
              // settled, it has nothing left to announce.
              setState((current) =>
                current.status === "waiting" || current.status === "thinking"
                  ? { ...current, status: "thinking" }
                  : current,
              );
            } else if (event.type === "sources" && Array.isArray(event.data)) {
              sourcesRef.current = event.data as ProfessorMariQuickSource[];
              setState((current) => ({ ...current, sources: sourcesRef.current }));
            } else if (event.type === "token" && typeof event.data === "string") {
              answer += event.data;
              setState({ status: "streaming", answer, error: null, query: trimmed, tier, sources: sourcesRef.current });
            } else if (event.type === "complete") {
              if (answer)
                omnibarAsideAnswerCache.set(connectionId, trimmed, { answer, tier, sources: sourcesRef.current });
              setState({ status: "complete", answer, error: null, query: trimmed, tier, sources: sourcesRef.current });
            } else if (event.type === "error") {
              const failure = event.data as { kind?: ProfessorMariQuickErrorKind; message?: string } | string;
              throw typeof failure === "string"
                ? new QuickAnswerFailure("provider", failure)
                : new QuickAnswerFailure(
                    failure.kind ?? "provider",
                    failure.message ?? "Professor Mari could not answer.",
                  );
            }
          }
          // A cleanly closed stream is still a completed response even if an
          // intermediary omitted the optional terminal event.
          if (!controller.signal.aborted) {
            // No words at all is a failed answer, not a finished one: never leave it "thinking" or cache it.
            if (!answer) throw new QuickAnswerFailure("empty", "Professor Mari could not answer.");
            omnibarAsideAnswerCache.set(connectionId, trimmed, { answer, tier, sources: sourcesRef.current });
            setState((current) =>
              current.query === trimmed && current.status === "streaming"
                ? { status: "complete", answer, error: null, query: trimmed, tier, sources: sourcesRef.current }
                : current,
            );
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          setState({
            status: "error",
            answer: "",
            error: error instanceof Error ? error.message : String(error),
            errorKind: error instanceof QuickAnswerFailure ? error.kind : "network",
            query: trimmed,
            tier,
          });
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
        }
      })();
    },
    [connectionId, resourceLabel, source, tier, trimmed],
  );

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (!ready) {
      setState(IDLE);
      return;
    }
    if (!available) {
      setState({ ...IDLE, status: "unavailable", query: trimmed, tier });
      return;
    }
    setState({ status: "waiting", answer: "", error: null, query: trimmed, tier });

    const timer = window.setTimeout(() => runQuery(), delayMs);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [available, delayMs, ready, runQuery, tier, trimmed]);

  return {
    ...state,
    retry: () => runQuery(),
    answerAgain: () => runQuery({ bypassCache: true }),
  };
}
