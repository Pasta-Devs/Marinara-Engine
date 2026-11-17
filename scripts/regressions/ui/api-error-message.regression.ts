// The message the client shows for a failed request: a field error from the server is shown as is, and an error with
// only a code and request ID falls back to the caller's message.
import assert from "node:assert/strict";
import { getApiErrorMessage } from "../../../packages/client/src/lib/api-client.js";

assert.equal(
  getApiErrorMessage(
    { formErrors: [], fieldErrors: { handle: ["Handle must contain at most 40 characters."] } },
    "Invalid profile",
  ),
  "Handle must contain at most 40 characters.",
);
assert.equal(getApiErrorMessage({ code: "USER_NOT_FOUND", requestId: "abc-123" }, "Request failed"), "Request failed");
