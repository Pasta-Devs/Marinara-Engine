// A personal extension's request counter: totals, the last minute's requests, and the sustained high-rate flag.
import assert from "node:assert/strict";
import {
  getPersonalExtensionTraffic,
  recordPersonalExtensionRequest,
} from "../../../packages/client/src/lib/personal-extension-traffic.js";

const trafficExtensionId = "open-issues-extension-traffic";
const trafficNow = 180_000;
for (const requestedAt of [59_000, 119_000, 179_000]) {
  for (let request = 0; request < 61; request += 1) {
    recordPersonalExtensionRequest(trafficExtensionId, 2, requestedAt + request);
  }
}
assert.deepEqual(getPersonalExtensionTraffic(trafficExtensionId, trafficNow), {
  requests: 183,
  bytes: 366,
  requestsLastMinute: 61,
  sustainedHighRate: true,
});
