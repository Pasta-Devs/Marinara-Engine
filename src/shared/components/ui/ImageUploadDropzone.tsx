import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { IMAGE_MIME_MAP } from "../../../engine/contracts/constants/game-assets";
import { MAX_IMAGE_UPLOAD_BYTES } from "../../api/file-payload";
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
  maxFiles?: number;
  maxFileSizeBytes?: number;
}

const UPLOAD_IMAGE_ENTRIES = Object.entries(IMAGE_MIME_MAP).filter(([extension]) => extension !== ".svg");
const UPLOAD_IMAGE_EXTENSIONS = UPLOAD_IMAGE_ENTRIES.map(([extension]) => extension);
const UPLOAD_IMAGE_MIME_TYPES = Array.from(new Set(UPLOAD_IMAGE_ENTRIES.map(([, mime]) => mime)));
const UPLOAD_IMAGE_MIME_TYPE_SET = new Set(UPLOAD_IMAGE_MIME_TYPES);
const IMAGE_EXTENSION_PATTERN = new RegExp(
  `(${UPLOAD_IMAGE_EXTENSIONS.map((extension) => extension.replace(".", "\\.")).join("|")})$`,
  "i",
);
const DEFAULT_IMAGE_ACCEPT = [...UPLOAD_IMAGE_MIME_TYPES, ...UPLOAD_IMAGE_EXTENSIONS].join(",");
const DEFAULT_MAX_IMAGE_FILES = 50;
const DEFAULT_MAX_IMAGE_BYTES = MAX_IMAGE_UPLOAD_BYTES;

function isFileDrag(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).some((type) => type.toLowerCase() === "files");
}

function getSupportedImageFiles(files: FileList | null) {
  return Array.from(files ?? []).filter((file) => {
    const mimeType = file.type.trim().toLowerCase();
    return (mimeType !== "" && UPLOAD_IMAGE_MIME_TYPE_SET.has(mimeType)) || IMAGE_EXTENSION_PATTERN.test(file.name);
  });
}

function formatBytes(bytes: number) {
  const mib = bytes / (1024 * 1024);
  return `${Number.isInteger(mib) ? mib.toString() : mib.toFixed(1)} MB`;
}

export function ImageUploadDropzone({
  label,
  onFilesSelected,
  icon,
  pending = false,
  pendingLabel = "Uploading...",
  dragLabel = "Drop images to upload",
  className,
  accept = DEFAULT_IMAGE_ACCEPT,
  multiple = true,
  disabled = false,
  ariaLabel,
  maxFiles = DEFAULT_MAX_IMAGE_FILES,
  maxFileSizeBytes = DEFAULT_MAX_IMAGE_BYTES,
}: ImageUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDisabled = disabled || pending;

  const resetDragState = () => {
    dragDepthRef.current = 0;
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDisabled) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  }, [isDisabled]);

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

    const selectedFiles = multiple ? imageFiles : imageFiles.slice(0, 1);
    if (!multiple && imageFiles.length > 1) {
      toast.warning("Only one image can be uploaded here.");
    }

    if (selectedFiles.length > maxFiles) {
      toast.error(`Upload up to ${maxFiles} image${maxFiles === 1 ? "" : "s"} at a time.`);
      return;
    }

    const oversized = selectedFiles.find((file) => file.size > maxFileSizeBytes);
    if (oversized) {
      toast.error(`Images must be ${formatBytes(maxFileSizeBytes)} or smaller.`);
      return;
    }

    onFilesSelected(selectedFiles);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) {
      event.currentTarget.value = "";
      return;
    }
    submitFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  };

  const handleDragEnter = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isFileDrag(event) || isDisabled) {
      resetDragState();
      return;
    }
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = !isFileDrag(event) || isDisabled ? "none" : "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isFileDrag(event) || isDisabled) {
      resetDragState();
      return;
    }
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resetDragState();
    if (!isFileDrag(event)) {
      if (!isDisabled) {
        toast.error("Drop image files from your device.");
      }
      return;
    }
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
        tabIndex={isDisabled ? -1 : undefined}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] px-4 py-6 text-xs text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)] hover:text-[var(--primary)]",
          className,
          isDragging &&
            "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] ring-2 ring-[var(--primary)]/20",
          isDisabled &&
            "cursor-not-allowed opacity-50 hover:border-[var(--border)] hover:bg-transparent hover:text-[var(--muted-foreground)]",
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
        disabled={isDisabled}
        onChange={handleInputChange}
        className="hidden"
      />
    </>
  );
}
