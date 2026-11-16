// Starting a game session: which connection the GM uses, and the campaign plan and NPCs carried into the next session.
import assert from "node:assert/strict";
import { resolveInitialGameGmConnectionId } from "../../../packages/server/src/services/game/initial-game-setup.js";
import {
  normalizeNextSessionCampaignPlan,
  normalizeNextSessionNpcs,
} from "../../../packages/server/src/services/game/next-session-plan.js";

assert.equal(resolveInitialGameGmConnectionId(undefined, "chat-connection"), "chat-connection");
assert.equal(resolveInitialGameGmConnectionId("explicit-connection", "chat-connection"), "explicit-connection");
assert.equal(resolveInitialGameGmConnectionId(undefined, null), null);
const refreshedCampaignPlan = normalizeNextSessionCampaignPlan(
  {
    openingSituation: "The party must enter the floating archive before dawn.",
    pressureClocks: [{ name: "Archive collapse", steps: 6, current: 0, failure: "The archive falls into the sea." }],
    factions: [{ name: "Glass Navigators", goal: "Claim the archive", method: "Race the party through hidden routes" }],
    questSeeds: ["Find the cartographer who knows the archive's moving entrance."],
    encounterPrinciples: ["Vertical exploration under time pressure."],
  },
  {
    openingSituation: "The completed siege still waits to begin.",
    questSeeds: ["Repeat the completed siege."],
  },
);
assert.equal(refreshedCampaignPlan.openingSituation, "The party must enter the floating archive before dawn.");
assert.deepEqual(refreshedCampaignPlan.questSeeds, ["Find the cartographer who knows the archive's moving entrance."]);
assert.equal(refreshedCampaignPlan.pressureClocks?.[0]?.current, 0);
const knownGameNpcs = [
  {
    id: "known-guide",
    name: "Sera",
    emoji: "🧭",
    description: "The party's established guide.",
    gender: null,
    pronouns: null,
    location: "Harbor",
    reputation: 2,
    notes: [],
    avatarUrl: null,
  },
];
const refreshedGameNpcs = normalizeNextSessionNpcs(
  [
    { name: "Sera", emoji: "🧭", description: "Duplicate known NPC." },
    {
      name: "Orin Vale",
      emoji: "🗺️",
      description: "A cartographer who remembers tomorrow's coastlines.",
      roleOrAgenda: "Trade the route for help rescuing his crew.",
      location: "Tide Observatory",
    },
  ],
  knownGameNpcs,
);
assert.equal(refreshedGameNpcs.length, 2);
assert.equal(refreshedGameNpcs[1]?.name, "Orin Vale");
assert.deepEqual(refreshedGameNpcs[1]?.notes, ["Next-session role: Trade the route for help rescuing his crew."]);
