export function downloadTextFile(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  downloadBlobFile(blob, filename);
}

export function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
