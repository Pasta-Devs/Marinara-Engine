export function isHostDeviceBrowser(): boolean {
  if (typeof window === "undefined") return true;
  if (window.location.protocol === "file:") return true;

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "" ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

export const HOST_DEVICE_FILE_MANAGER_MESSAGE =
  "System folders can only be opened from the device hosting Marinara Engine.";
