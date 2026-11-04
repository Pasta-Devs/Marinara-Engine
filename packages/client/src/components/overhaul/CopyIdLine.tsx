import { Copy } from "lucide-react";

/** A one-line "ID · abc123 [copy]" under a field, replacing the full-width ID box in the overhaul. */
export function CopyIdLine({
  label,
  id,
  copyLabel,
  onCopy,
}: {
  label: string;
  id: string;
  copyLabel: string;
  onCopy: () => void;
}) {
  return (
    <div className="ov-idline">
      <span className="ov-idline__label">{label}</span>
      <code className="ov-idline__value">{id}</code>
      <button type="button" className="ov-idline__copy" onClick={onCopy} title={copyLabel} aria-label={copyLabel}>
        <Copy size="0.75rem" />
      </button>
    </div>
  );
}
