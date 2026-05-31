import type { DragEvent } from "react";
import { Download, FileJson, Image } from "lucide-react";

type CharacterImportDropZoneProps = {
  dragOver: boolean;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
};

export function CharacterImportDropZone({
  dragOver,
  onDrop,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onClick,
}: CharacterImportDropZoneProps) {
  return (
    <div
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
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
        <p className="text-sm font-medium">Drop one or more files here or click to browse</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Supports JSON, PNG character cards, CharX, and Marinara exports
        </p>
      </div>
      <div className="flex gap-2">
        <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
          <FileJson size="0.75rem" /> .json
        </span>
        <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
          <Image size="0.75rem" /> .png
        </span>
        <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
          <FileJson size="0.75rem" /> .charx
        </span>
        <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
          <FileJson size="0.75rem" /> .marinara
        </span>
      </div>
    </div>
  );
}
