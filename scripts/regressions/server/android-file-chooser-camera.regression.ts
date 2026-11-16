import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// #6953: in the Android app, a page that asks for images also gets a Camera choice, and the
// photo taken goes back to the page. The WebView can't run in CI, so this checks the source.
const source = readFileSync(
  new URL("../../../android/app/src/main/java/com/marinara/engine/MainActivity.java", import.meta.url),
  "utf8",
);

assert.match(
  source,
  /startActivityForResult\(withCameraChoice\(params\), FILE_CHOOSER_REQUEST\)/u,
  "the file chooser must offer the camera",
);
assert.match(source, /new Intent\(MediaStore\.ACTION_IMAGE_CAPTURE\)/u, "the camera choice must take a photo");
assert.match(source, /camera\.putExtra\(MediaStore\.EXTRA_OUTPUT, photo\)/u, "the photo must go to the prepared file");
assert.match(
  source,
  /result = new Uri\[\] \{ cameraPhoto \};/u,
  "a photo taken with the camera must go back to the page",
);
assert.match(source, /discardPendingCameraPhoto\(\);/u, "an unused photo file must be removed");
assert.match(
  source,
  /outState\.putString\(PENDING_CAMERA_PHOTO_STATE/u,
  "the photo file must survive the app being closed while the camera is open",
);

console.log("Android file chooser camera regression passed.");
