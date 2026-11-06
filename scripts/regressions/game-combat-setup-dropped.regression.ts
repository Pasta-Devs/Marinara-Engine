/**
 * A fight setup the browser dropped (the page reloaded mid-setup) is not remembered as that turn's
 * failure: the server may finish it, and opening the chat again must not show "Combat generation failed."
 */
import assert from "node:assert/strict";
import { isDroppedRequest } from "../../packages/client/src/lib/combat-setup-failures.js";

assert.ok(isDroppedRequest(new TypeError("Failed to fetch")), "Chrome's dropped fetch");
assert.ok(isDroppedRequest(new TypeError("NetworkError when attempting to fetch resource.")), "Firefox's");
assert.ok(isDroppedRequest(new TypeError("Load failed")), "Safari's");
assert.ok(isDroppedRequest(new DOMException("The user aborted a request.", "AbortError")), "an abort");
assert.ok(!isDroppedRequest(new Error("The model's answer was cut off.")), "a server refusal");
assert.ok(!isDroppedRequest(new Error("Combat generator returned an empty party or enemy list.")), "a bad answer");
assert.ok(!isDroppedRequest(new TypeError("Cannot read properties of undefined (reading 'enemies')")), "a client bug");
console.info("Dropped combat setups: a dropped request is told apart from a real failure.");
