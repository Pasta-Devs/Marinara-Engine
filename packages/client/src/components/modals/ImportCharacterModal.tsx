// ──────────────────────────────────────────────
// Modal: Import Character (JSON / PNG)
// ──────────────────────────────────────────────
import { useState, useRef } from "react";
import { Modal } from "../ui/Modal";
import { Download, FileJson, Image, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { characterKeys } from "../../hooks/use-characters";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { parsePngCharacterCard } from "../../lib/png-parser";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportCharacterModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const qc = useQueryClient();

  const handleFile = async (file: File) => {
    setStatus("loading");
    setMessage("");

    try {
      const isPng = file.name.toLowerCase().endsWith(".png") || file.type === "image/png";

      let json: Record<string, unknown>;
      let avatarDataUrl: string | null = null;

      if (isPng) {
        // Extract character JSON and image from PNG tEXt chunk
        const result = await parsePngCharacterCard(file);
        json = result.json;
        avatarDataUrl = result.imageDataUrl;
      } else {
        // Plain JSON file
        const text = await file.text();
        json = JSON.parse(text);
      }

      const res = await fetch("/api/import/st-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...json, _avatarDataUrl: avatarDataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage(`Imported "${data.name ?? file.name}" successfully!`);
        qc.invalidateQueries({ queryKey: characterKeys.list() });
        if (data.lorebook) {
          qc.invalidateQueries({ queryKey: lorebookKeys.all });
        }
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
      title="Import Character"
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
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Supports JSON and PNG (with embedded data)</p>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <FileJson size="0.75rem" /> .json
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <Image size="0.75rem" /> .png
            </span>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,.png"
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
