// ──────────────────────────────────────────────
// Modal: Import Persona (JSON / Marinara export)
// ──────────────────────────────────────────────
import { useState, useRef } from "react";
import { Modal } from "../ui/Modal";
import { Download, FileJson, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { characterKeys } from "../../hooks/use-characters";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportPersonaModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const qc = useQueryClient();

  const handleFile = async (file: File) => {
    setStatus("loading");
    setMessage("");

    try {
      const text = await file.text();
      const json = JSON.parse(text) as Record<string, unknown>;

      // Marinara envelope format — route to the native importer
      const isMarinaraEnvelope =
        json.version === 1 && typeof json.type === "string" && (json.type as string).startsWith("marinara_");

      if (isMarinaraEnvelope) {
        const res = await fetch("/api/import/marinara", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        });
        const data = await res.json();
        if (data.success) {
          setStatus("success");
          setMessage(`Imported "${data.name ?? file.name}" successfully!`);
          qc.invalidateQueries({ queryKey: characterKeys.personas });
        } else {
          setStatus("error");
          setMessage(data.error ?? "Import failed");
        }
        return;
      }

      // Plain persona JSON — create directly via the personas API
      const name = typeof json.name === "string" ? json.name : "Imported Persona";
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: json.description ?? "",
          personality: json.personality ?? "",
          scenario: json.scenario ?? "",
          backstory: json.backstory ?? "",
          appearance: json.appearance ?? "",
          comment: json.comment ?? "",
        }),
      });
      const data = await res.json();
      if (data.id) {
        setStatus("success");
        setMessage(`Imported "${name}" successfully!`);
        qc.invalidateQueries({ queryKey: characterKeys.personas });
      } else {
        setStatus("error");
        setMessage(data.error ?? "Import failed");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setStatus("idle");
    setMessage("");
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import Persona"
    >
      <div className="flex flex-col gap-4">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all ${
            dragOver
              ? "border-[var(--primary)] bg-[var(--primary)]/10"
              : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50"
          }`}
        >
          <Download
            size="2rem"
            className={`transition-colors ${dragOver ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
          />
          <div className="text-center">
            <p className="text-sm font-medium">Drop a file here or click to browse</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Supports JSON and Marinara persona exports</p>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <FileJson size="0.75rem" /> .json
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <FileJson size="0.75rem" /> .marinara
            </span>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,.marinara"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {/* Status */}
        {status === "loading" && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-3 text-xs">
            <Loader2 size="0.875rem" className="animate-spin text-[var(--primary)]" />
            Importing...
          </div>
        )}
        {status === "success" && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <CheckCircle size="0.875rem" />
            {message}
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]">
            <XCircle size="0.875rem" />
            {message}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-[var(--border)] pt-3">
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
