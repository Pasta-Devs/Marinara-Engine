import { basename, isAbsolute } from "path";
import { closeSync, fstatSync, openSync, readSync, realpathSync, statSync } from "fs";

export function validateLocalGgufPath(filePath: string): string {
  if (!isAbsolute(filePath) || !isSupportedLlamaCppModelFilename(filePath)) {
    throw new Error("Enter the absolute path to a main model GGUF on the server device.");
  }
  const selected = realpathSync(filePath);
  if (!isSupportedLlamaCppModelFilename(selected)) {
    throw new Error("Enter the absolute path to a main model GGUF on the server device.");
  }
  if (!statSync(selected).isFile()) throw new Error("The selected GGUF must be a regular file.");
  const fd = openSync(selected, "r");
  try {
    const header = Buffer.alloc(8);
    if (
      !fstatSync(fd).isFile() ||
      readSync(fd, header, 0, header.length, 0) !== header.length ||
      header.toString("ascii", 0, 4) !== "GGUF" ||
      ![2, 3].includes(header.readUInt32LE(4))
    ) {
      throw new Error("The selected file does not have a supported GGUF header.");
    }
  } finally {
    closeSync(fd);
  }
  return selected;
}

export function isLikelyMmprojModelPath(modelPath: string): boolean {
  const filename = basename(modelPath).toLowerCase();
  return (
    filename.includes("mmproj") || /(?:^|[-_.])mm-?proj(?:[-_.]|$)/i.test(filename) || filename.includes("projector")
  );
}

export function isSupportedLlamaCppModelFilename(modelPath: string): boolean {
  return modelPath.toLowerCase().endsWith(".gguf") && !isLikelyMmprojModelPath(modelPath);
}

export function assertSupportedLlamaCppModelPath(modelPath: string): void {
  if (isLikelyMmprojModelPath(modelPath)) {
    throw new Error(
      "The selected GGUF is a multimodal projector (mmproj), not a chat model. Select the main model GGUF instead.",
    );
  }
}
