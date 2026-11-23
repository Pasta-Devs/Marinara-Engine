import { useId, useState } from "react";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";
import type { SceneIllustrationCharacterPrompt } from "@marinara-engine/shared";
import { cn, copyToClipboard } from "../../lib/utils";
import { NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ImagePromptPanelProps {
  prompt?: string | null;
  negativePrompt?: string;
  characterPrompts?: SceneIllustrationCharacterPrompt[];
  meta?: string | null;
  className?: string;
}

function SavedPrompt({ label, value }: { label: string; value?: string | null }) {
  const { t } = useUiTranslation();
  if (!value?.trim()) return null;
  const copyLabel = t("ui.chat.imagepromptpanel.copyField", { field: label });

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-[var(--foreground)]">{label}</div>
        <button
          type="button"
          aria-label={copyLabel}
          title={copyLabel}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void copyToClipboard(value).then((ok) => {
              if (ok) toast.success(t("ui.chat.chatgallery.promptCopied"));
              else toast.error(t("ui.chat.chatgallery.couldNotCopyPrompt"));
            });
          }}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
        >
          <Copy size="1rem" aria-hidden />
        </button>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{value}</p>
    </div>
  );
}

export function ImagePromptPanel({
  prompt,
  negativePrompt,
  characterPrompts = [],
  meta,
  className,
}: ImagePromptPanelProps) {
  const { t } = useUiTranslation();
  const [collapsed, setCollapsed] = useState(true);
  const headingId = useId();
  const hasPrompts = !!(prompt?.trim() || negativePrompt?.trim() || characterPrompts.length);
  if (!hasPrompts && !meta?.trim()) return null;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--sidebar)] text-left text-[var(--foreground)] shadow-2xl",
        NEUTRAL_SURFACE_VARIABLES,
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 sm:px-4",
          !collapsed && "border-b border-[var(--border)]",
        )}
      >
        <h2 id={headingId} className="min-w-0 truncate text-base font-semibold">
          {t(hasPrompts ? "ui.agents.customagentrepositoriesmodal.prompt" : "ui.chat.imagepromptpanel.details")}
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-expanded={!collapsed}
          aria-label={t(
            collapsed ? "ui.chat.imageregeneratepanel.expandPanel" : "ui.chat.imageregeneratepanel.collapsePanel",
          )}
          title={t(
            collapsed ? "ui.chat.imageregeneratepanel.expandPanel" : "ui.chat.imageregeneratepanel.collapsePanel",
          )}
          className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
        >
          {collapsed ? <ChevronUp size="1.125rem" aria-hidden /> : <ChevronDown size="1.125rem" aria-hidden />}
        </button>
      </div>
      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {hasPrompts && (
            <div className="space-y-3">
              <SavedPrompt label={t("ui.chat.imagepromptpanel.positivePrompt")} value={prompt} />
              <SavedPrompt label={t("ui.agents.agenteditor.negativePrompt")} value={negativePrompt} />
              {characterPrompts.length > 0 && (
                <div className="space-y-2 border-t border-[var(--border)] pt-3">
                  <h3 className="text-sm font-semibold">{t("ui.chat.imageregeneratepanel.characterPrompts")}</h3>
                  {characterPrompts.map((character, index) => (
                    <div key={`${character.name}-${index}`} className="space-y-2">
                      <SavedPrompt
                        label={t("ui.chat.imagepromptpanel.characterPrompt", { name: character.name })}
                        value={character.prompt}
                      />
                      <SavedPrompt
                        label={t("ui.chat.imagepromptpanel.characterNegativePrompt", { name: character.name })}
                        value={character.negativePrompt}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {meta?.trim() && (
            <p
              className={cn(
                "break-words text-xs text-[var(--muted-foreground)]",
                hasPrompts && "mt-3 border-t border-[var(--border)] pt-3",
              )}
            >
              {meta}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
