import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  joinSpeakerNames,
  replyAnnouncementText,
  uniqueSpeakerNames,
} from "../../../packages/client/src/lib/reply-announcer.js";

// QC Nov 22 AX1 (owner decision): a screen reader hears who replied, never the reply.
const en = JSON.parse(
  readFileSync(new URL("../../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
) as Record<string, string>;
const t = (key: string, options: Record<string, unknown> = {}) => {
  let resolved = key;
  if (typeof options.count === "number") resolved = `${key}_${options.count === 1 ? "one" : "other"}`;
  const template = en[resolved];
  assert.ok(template, `missing string ${resolved}`);
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name]));
};

assert.deepEqual(uniqueSpeakerNames(["Wren", " wren ", null, "", "Kit"]), ["Wren", "Kit"]);
assert.equal(joinSpeakerNames(["Wren"], "en", t), "Wren");
assert.equal(joinSpeakerNames(["Wren", "Kit"], "en", t), "Wren and Kit");
assert.equal(joinSpeakerNames(["Wren", "Kit", "Ada"], "en", t), "Wren, Kit, and Ada");
assert.equal(joinSpeakerNames(["Wren", "Kit", "Ada", "Bo"], "en", t), "Wren, Kit, and 2 others");

const say = (event: Parameters<typeof replyAnnouncementText>[0]) => replyAnnouncementText(event, "en", t);
assert.equal(say({ kind: "replied", names: ["Wren Halloway"], onScreen: true }), "Wren Halloway replied");
assert.equal(say({ kind: "replied", names: ["Wren", "Kit"], onScreen: true }), "Wren and Kit replied");
assert.equal(
  say({ kind: "swipe", names: ["Wren Halloway"], index: 2, total: 2, onScreen: true }),
  "Wren Halloway replied, swipe 2 of 2",
);
assert.equal(say({ kind: "continued", names: ["Wren Halloway"], onScreen: true }), "Wren Halloway continued");
assert.equal(
  say({ kind: "replied", names: ["Wren Halloway"], chatName: "Storm at Gull Point", onScreen: false }),
  "Wren Halloway replied in Storm at Gull Point",
);
// A swipe or continue in a chat that is not on screen also names the chat.
assert.equal(
  say({ kind: "swipe", names: ["Wren"], index: 1, total: 3, chatName: "Storm", onScreen: false }),
  "Wren replied in Storm",
);
assert.equal(say({ kind: "replied", names: [], onScreen: true }), "The character replied");
assert.equal(say({ kind: "messaged", names: ["Kit Okafor"] }), "Kit Okafor sent a message");
assert.equal(say({ kind: "messaged", names: [] }), "");
assert.equal(say({ kind: "impersonated" }), "Your turn is written");
assert.equal(say({ kind: "stopped" }), "Reply stopped");
assert.equal(say({ kind: "mari", needsAnswer: false }), "Professor Mari replied");
assert.equal(say({ kind: "mari", needsAnswer: true }), "Professor Mari replied and needs your answer");

console.log("reply announcer ok");
