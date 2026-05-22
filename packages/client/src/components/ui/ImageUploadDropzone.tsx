import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

interface ImageUploadDropzoneProps {
  label: string;
  onFilesSelected: (files: File[]) => void;
  icon?: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  dragLabel?: string;
  className?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|png|webp)$/i;

function isFileDrag(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function getSupportedImageFiles(files: FileList | null) {
  return Array.from(files ?? []).filter(
    (file) => file.type.startsWith("image/") || IMAGE_EXTENSION_PATTERN.test(file.name),
  );
}

export function ImageUploadDropzone({
  label,
  onFilesSelected,
  icon,
  pending = false,
  pendingLabel = "Uploading...",
  dragLabel = "Drop images to upload",
  className,
  accept = "image/*",
  multiple = true,
  disabled = false,
  ariaLabel,
}: ImageUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDisabled = disabled || pending;

  const submitFiles = (files: FileList | null) => {
    const imageFiles = getSupportedImageFiles(files);
    if (imageFiles.length === 0) {
      if (files && files.length > 0) {
        toast.error("Drop image files to upload.");
      }
      return;
    }
    if (files && imageFiles.length < files.length) {
      toast.warning("Only image files can be uploaded here.");
    }
    onFilesSelected(imageFiles);
  };

  const resetDragState = () => {
    dragDepthRef.current = 0;
    setIsDragging(false);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    submitFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  };

  const handleDragEnter = (event: DragEvent<HTMLButtonElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (isDisabled) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = isDisabled ? "none" : "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (isDisabled) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    resetDragState();
    if (isDisabled) return;
    submitFiles(event.dataTransfer.files);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!isDisabled) inputRef.current?.click();
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-disabled={isDisabled}
        aria-label={ariaLabel ?? label}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] px-4 py-6 text-xs text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)] hover:text-[var(--primary)]",
          isDragging &&
            "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] ring-2 ring-[var(--primary)]/20",
          isDisabled &&
            "cursor-not-allowed opacity-50 hover:border-[var(--border)] hover:text-[var(--muted-foreground)]",
          className,
        )}
      >
        {icon}
        {isDragging ? dragLabel : pending ? pendingLabel : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
      />
    </>
  );
}
