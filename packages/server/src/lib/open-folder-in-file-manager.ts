import { spawn } from "child_process";
import { platform } from "os";

/** Open a folder using the host platform's native file manager. */
export function openFolderInFileManager(path: string): Promise<void> {
  const os = platform();
  const cmd = os === "darwin" ? "open" : os === "win32" ? "explorer" : "xdg-open";

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [path], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
