import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAgentStore, type AgentProgressEntry } from "../../stores/agent.store";

export function AgentTaskStatus({
  chatId,
  renderOutput,
}: {
  chatId: string;
  renderOutput?: (agentType: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const progress = useAgentStore((state) => state.taskProgress);
  const [now, setNow] = useState(Date.now);
  const groups = useMemo(() => {
    const entries = new Map<string, { agent: AgentProgressEntry["agents"][number]; calls: AgentProgressEntry[] }>();
    for (const call of progress) {
      if (call.chatId !== chatId) continue;
      for (const agent of call.agents) {
        const key = `${call.runId}:${agent.id}`;
        const group = entries.get(key) ?? { agent, calls: [] };
        group.calls.push(call);
        entries.set(key, group);
      }
    }
    return [...entries.entries()];
  }, [chatId, progress]);
  const running = groups.some(([, group]) =>
    group.calls.some((call) => !call.stopped && (call.stage === "waiting" || call.stage === "streaming")),
  );
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  if (!groups.length) return null;

  const seconds = (value: number) => `${(Math.max(0, value) / 1000).toFixed(1)}s`;
  return (
    <section
      aria-label={t("agents.progress.title")}
      className="space-y-2 border-b border-[var(--border)] px-3 py-2 text-[0.625rem]"
    >
      <h3 className="font-semibold">{t("agents.progress.title")}</h3>
      {[...new Set(groups.map(([, { agent }]) => agent.type))].map((agentType) => (
        <div key={agentType} data-agent-activity={agentType} className="space-y-2">
          {/* Keep concurrent run reports separate, with their agent's outputs shown only once. */}
          {groups
            .filter(([, { agent }]) => agent.type === agentType)
            .map(([key, { agent, calls }]) => {
              const latest = calls[calls.length - 1]!;
              const startedAt = Math.min(...calls.map((call) => call.startedAt));
              const end = Math.max(
                ...calls.map(
                  (call) =>
                    call.startedAt +
                    call.elapsedMs +
                    (!call.stopped && (call.stage === "waiting" || call.stage === "streaming")
                      ? Math.max(0, now - call.receivedAt)
                      : 0),
                ),
              );
              const firstChunks = calls
                .filter((call) => call.ttftMs !== undefined)
                .map((call) => call.startedAt + call.ttftMs!);
              const phase = agent.phase === "pre_generation" ? "pre" : agent.phase === "parallel" ? "parallel" : "post";
              const activeCalls = calls.filter(
                (call) => !call.stopped && (call.stage === "waiting" || call.stage === "streaming"),
              );
              const state = activeCalls.length
                ? activeCalls.some((call) => call.stage === "streaming")
                  ? "streaming"
                  : "waiting"
                : latest.stopped
                  ? "stopped"
                  : latest.stage;
              const tokens = (field: "promptTokens" | "completionTokens") =>
                calls.every((call) => call[field] !== undefined)
                  ? calls.reduce((total, call) => total + call[field]!, 0).toLocaleString()
                  : t("agents.progress.unreported");
              return (
                <div key={key} className="space-y-1 border-t border-[var(--border)] pt-2">
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-1">
                    <span className="font-medium break-words">{agent.name}</span>
                    <span>{t(`agents.progress.phase.${phase}`)}</span>
                  </div>
                  <p className="text-[var(--muted-foreground)]">{t(`agents.progress.state.${state}`)}</p>
                  <p>
                    {t("agents.progress.received", {
                      chunks: calls.reduce((sum, call) => sum + call.receivedChunks, 0),
                      characters: calls.reduce((sum, call) => sum + call.receivedCharacters, 0),
                    })}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--muted-foreground)]">
                    <div>
                      <dt>{t("agents.progress.input")}</dt>
                      <dd>{tokens("promptTokens")}</dd>
                    </div>
                    <div>
                      <dt>{t("agents.progress.output")}</dt>
                      <dd>{tokens("completionTokens")}</dd>
                    </div>
                    <div title={t("agents.progress.ttftHelp")}>
                      <dt>{t("agents.progress.ttft")}</dt>
                      <dd>
                        {firstChunks.length
                          ? seconds(Math.min(...firstChunks) - startedAt)
                          : t("agents.progress.unreported")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("agents.progress.elapsed")}</dt>
                      <dd>{seconds(end - startedAt)}</dd>
                    </div>
                  </dl>
                  {calls.some((call) => call.agents.length > 1) && (
                    <p className="text-[var(--muted-foreground)]">{t("agents.progress.sharedBatch")}</p>
                  )}
                </div>
              );
            })}
          {renderOutput?.(agentType)}
        </div>
      ))}
      <p className="text-[var(--muted-foreground)]">{t("agents.progress.tokenNote")}</p>
    </section>
  );
}
