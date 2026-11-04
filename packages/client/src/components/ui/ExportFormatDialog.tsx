import { FileJson, ImageDown, Layers, X } from "lucide-react";
import { Modal } from "./Modal";
import { cn } from "../../lib/utils";
import { SHEET_BUTTON_QUIET } from "./neutral-surface-styles";
import { useTranslation as useUiTranslation } from "react-i18next";

export type ExportFormatChoice = "native" | "compatible" | "compatible-png";

/** Additional formats a caller can offer next to the standard ones. */
export interface ExportFormatExtraOption {
  id: string;
  label: string;
  icon: typeof Layers;
  description: string;
}

interface ExportFormatDialogProps {
  open: boolean;
  title: string;
  description?: string;
  nativeDescription?: string;
  compatibleDescription?: string;
  pngDescription?: string;
  showPngOption?: boolean;
  extraOptions?: ExportFormatExtraOption[];
  onClose: () => void;
  onSelect: (format: ExportFormatChoice) => void;
  onSelectExtra?: (id: string) => void;
}

export function ExportFormatDialog({
  open,
  title,
  description = "Choose how Marinara should package this export.",
  nativeDescription = "Keeps Marinara-specific fields, folders, metadata, and import fidelity.",
  compatibleDescription = "Uses folderless, platform-friendly JSON where possible for tools like SillyTavern and Chub.",
  pngDescription = "Chara Card V2 PNG with the avatar baked in — works in SillyTavern, Chub, and Risu.",
  showPngOption = false,
  extraOptions = [],
  onClose,
  onSelect,
  onSelectExtra,
}: ExportFormatDialogProps) {
  const { t: localizeUi } = useUiTranslation();
  const options: Array<{
    id: ExportFormatChoice | string;
    label: string;
    icon: typeof Layers;
    description: string;
  }> = [
    { id: "native", label: "Marinara Native", icon: Layers, description: nativeDescription },
    { id: "compatible", label: "Compatible JSON", icon: FileJson, description: compatibleDescription },
    ...(showPngOption
      ? [{ id: "compatible-png" as const, label: "Compatible PNG Card", icon: ImageDown, description: pngDescription }]
      : []),
    ...extraOptions,
  ];
  const extraIds = new Set(extraOptions.map((option) => option.id));
  const gridColumns = options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-lg"
      footer={
        <button type="button" onClick={onClose} className={SHEET_BUTTON_QUIET}>
          <X size="0.75rem" />
          {localizeUi("chat.delete.dialog.cancel")}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{description}</p>
        <div className={cn("grid gap-2", gridColumns)}>
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  extraIds.has(option.id) ? onSelectExtra?.(option.id) : onSelect(option.id as ExportFormatChoice)
                }
                className={cn(
                  "group flex min-h-[8.5rem] flex-col items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/55 p-4 text-left transition-all",
                  "hover:border-[var(--primary)]/45 hover:bg-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/35",
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)] text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors group-hover:text-[var(--primary)]">
                  <Icon size="1.05rem" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--foreground)]">{option.label}</span>
                  <span className="mt-1 block text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
