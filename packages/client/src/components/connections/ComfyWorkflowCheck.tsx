// The Workflow check under a pasted ComfyUI workflow: which reference slots it has, and the picture loaders that
// still open a saved file, so a workflow can be checked before a generation is spent on it.
import { AlertCircle, Check } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  checkComfyWorkflow,
  comfyReferenceSlotPlaceholders,
  COMFY_WORKFLOW_REFERENCE_SLOTS,
} from "@marinara-engine/shared";

export function ComfyWorkflowCheck({
  workflow,
  blanksFilled,
  imagePlaceholdersOnly = false,
}: {
  workflow: string;
  /** Whether "Upload a placeholder" is on, so slots without a picture get the blank one. */
  blanksFilled: boolean;
  /** SwarmUI takes pictures only through %reference_image% placeholders, never uploaded filenames. */
  imagePlaceholdersOnly?: boolean;
}) {
  const { t } = useTranslation();
  const check = useMemo(() => checkComfyWorkflow(workflow), [workflow]);
  if (!check.parsed) return null;

  const freeSlot = Array.from({ length: COMFY_WORKFLOW_REFERENCE_SLOTS }, (_, index) => index + 1).find(
    (slot) => !check.referenceSlots.includes(slot),
  );
  const suggestion = freeSlot
    ? imagePlaceholdersOnly
      ? comfyReferenceSlotPlaceholders(freeSlot).image
      : comfyReferenceSlotPlaceholders(freeSlot).name
    : null;
  const slotNames = check.referenceSlots.map((slot) => String(slot).padStart(2, "0")).join(", ");

  return (
    <div
      data-comfy-workflow-check
      className="mt-2 flex flex-col gap-1 rounded-lg border border-[var(--border)] px-2.5 py-2"
    >
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {t("connections.editor.workflowCheck.title")}
      </span>
      {check.uiFormat && <Line warn>{t("connections.editor.workflowCheck.uiFormat")}</Line>}
      {check.referenceSlots.length > 0 ? (
        <Line>
          {t("connections.editor.workflowCheck.referenceSlots", {
            count: check.referenceSlots.length,
            slots: slotNames,
          })}
        </Line>
      ) : (
        <Line>{t("connections.editor.workflowCheck.noReferenceSlots")}</Line>
      )}
      {check.literalLoaders.map((loader) => (
        <Line key={`${loader.nodeId}:${loader.file}`} warn>
          {suggestion
            ? t("connections.editor.workflowCheck.literalLoaderFix", {
                node: loader.title ? `${loader.nodeId} (${loader.title})` : loader.nodeId,
                file: loader.file,
                placeholder: suggestion,
              })
            : t("connections.editor.workflowCheck.literalLoader", {
                node: loader.title ? `${loader.nodeId} (${loader.title})` : loader.nodeId,
                file: loader.file,
              })}
        </Line>
      ))}
      {check.referenceSlots.length > 1 && (
        <Line warn={!blanksFilled}>
          {blanksFilled
            ? t("connections.editor.workflowCheck.blanksFilled")
            : t("connections.editor.workflowCheck.blanksEmpty")}
        </Line>
      )}
    </div>
  );
}

function Line({ warn = false, children }: { warn?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={
        warn
          ? "flex items-start gap-1 text-[0.625rem] leading-snug text-amber-400"
          : "flex items-start gap-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]"
      }
    >
      {warn ? (
        <AlertCircle size="0.625rem" className="mt-px shrink-0" />
      ) : (
        <Check size="0.625rem" className="mt-px shrink-0 text-emerald-400" />
      )}
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
