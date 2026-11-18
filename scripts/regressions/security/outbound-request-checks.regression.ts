// Checks on the server's outbound requests: which response content types are accepted, with and without a missing
// type allowed, and a download URL outside its allowed hostnames is refused.
import assert from "node:assert/strict";
import { isAllowedResponseContentType, validateOutboundUrl } from "../../../packages/server/src/utils/security.js";

assert.equal(isAllowedResponseContentType(null, ["application/json"]), false);
assert.equal(isAllowedResponseContentType(null, ["application/json"], true), true);
assert.equal(isAllowedResponseContentType("application/json; charset=utf-8", ["application/json"], true), true);
assert.equal(isAllowedResponseContentType("text/html; charset=utf-8", ["application/json"], true), false);
await assert.rejects(
  validateOutboundUrl("https://example.com/archive.zip", {
    allowedHostnames: ["github.com", "codeload.github.com"],
  }),
  /hostname 'example\.com' is not allowed/u,
);
