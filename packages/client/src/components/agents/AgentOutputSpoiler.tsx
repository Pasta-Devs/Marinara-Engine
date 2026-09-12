import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function AgentOutputSpoiler({ hidden, children }: { hidden?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  if (!hidden) return <>{children}</>;
  return (
    <details className="rounded-lg border border-[var(--border)] p-2 text-xs">
      <summary className="cursor-pointer text-[var(--muted-foreground)]">{t("agents.output.reveal")}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
