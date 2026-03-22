// ──────────────────────────────────────────────
// Modal: Import Lorebook (JSON)
// ──────────────────────────────────────────────
import { useState, useRef } from "react";
import { Modal } from "../ui/Modal";
import { Download, FileJson, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportLorebookModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const qc = useQueryClient();

  const handleFile = async (file: File) => {
    setStatus("loading");

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Pass the filename (without extension) as a fallback name
      const fallbackName = file.name.replace(/\.json$/i, "");
      json.__filename = fallbackName;

      const res = await fetch("/api/import/st-lorebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage(`Imported lorebook successfully!`);
        qc.invalidateQueries({ queryKey: ["lorebooks"] });
      } else {
        setStatus("error");
        setMessage(data.error ?? "Import failed");
      }
    } catch {
      setStatus("error");
      setMessage("Failed to parse file — must be valid JSON");
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
      title="Import Lorebook"
    >
      <div className="flex flex-col gap-4">
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
          <Download size="2rem" className={dragOver ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"} />
          <p className="text-sm font-medium">Drop lorebook JSON here or click to browse</p>
          <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
            <FileJson size="0.75rem" /> .json
          </span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        {status === "loading" && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-3 text-xs">
            <Loader2 size="0.875rem" className="animate-spin text-[var(--primary)]" /> Importing...
          </div>
        )}
        {status === "success" && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <CheckCircle size="0.875rem" /> {message}
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]">
            <XCircle size="0.875rem" /> {message}
          </div>
        )}

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
