// Browser notifications on a page that isn't a secure context (plain HTTP to another device) report "insecure",
// so Settings can say why, instead of looking unsupported or asking for a permission the browser will refuse.
import assert from "node:assert/strict";

const windowStub: { isSecureContext: boolean; Notification?: { permission: string } } = {
  isSecureContext: false,
  Notification: { permission: "default" },
};
Object.defineProperty(globalThis, "window", { configurable: true, value: windowStub });
const { getLocalNotificationPermission } = await import("../../../packages/client/src/lib/local-notifications.js");

assert.equal(await getLocalNotificationPermission(), "insecure");
windowStub.isSecureContext = true;
assert.equal(await getLocalNotificationPermission(), "default", "a secure page reads the browser's own permission");
