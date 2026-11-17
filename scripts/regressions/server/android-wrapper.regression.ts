// The Android app's WebView wrapper: text zoom stays at 100%, and saved images go to the gallery through MediaStore.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const androidMainActivitySource = readFileSync(
  new URL("../../../android/app/src/main/java/com/marinara/engine/MainActivity.java", import.meta.url),
  "utf8",
);
const configureWebViewStart = androidMainActivitySource.indexOf("private void configureWebView()");
const configureWebViewEnd = androidMainActivitySource.indexOf("private void tryConnect()", configureWebViewStart);
assert.ok(configureWebViewStart >= 0 && configureWebViewEnd > configureWebViewStart);
const configureWebViewSource = androidMainActivitySource.slice(configureWebViewStart, configureWebViewEnd);
assert.match(androidMainActivitySource, /MediaStore\.Images\.Media\.getContentUri/u);
assert.match(
  configureWebViewSource,
  /settings\.setTextZoom\(100\);/u,
  "The Android wrapper must not inherit oversized WebView text zoom",
);
