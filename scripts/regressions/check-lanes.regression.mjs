import assert from "node:assert/strict";
import { checkJobs, checkLanes, checkPrelude, runLanes } from "../check.mjs";

// `pnpm check` keeps every lane the serial chain ran, minus lint's shared and server tsc passes that the builds repeat.
const pnpm = { command: "pnpm", args: [] };
// Each lane's command line, with the tsc entry point's absolute path reduced to its package path.
const wiring = (lanes) =>
  lanes.map((lane) => [lane.name, lane.args.join(" ").replace(/^\S*(typescript.bin.tsc)/u, "$1")]);
const tscLane = [
  "character-activity-types",
  "typescript/bin/tsc -p scripts/regressions/tsconfig.character-activity.json",
];
assert.deepEqual(wiring(checkLanes(pnpm, false)), [
  ["client-build", "--filter @marinara-engine/client build"],
  ["server-build", "--filter @marinara-engine/server build"],
  ["client-lint", "--filter @marinara-engine/client lint"],
  ["format", "format:check"],
  ["e2e-types", "check:e2e-types"],
  ["token-estimation-types", "check:token-estimation-types"],
  tscLane,
]);
assert.equal(checkLanes(pnpm, false).at(-1).command, process.execPath);
// A low-memory build does not type-check, so shared and server lint run first, one at a time, and replace the
// character-activity lane that server lint already covers.
assert.deepEqual(checkPrelude(pnpm, false), []);
assert.deepEqual(wiring(checkPrelude(pnpm, true)), [
  ["shared-types", "--filter @marinara-engine/shared lint"],
  ["server-types", "--filter @marinara-engine/server lint"],
]);
assert.deepEqual(wiring(checkLanes(pnpm, true)), wiring(checkLanes(pnpm, false)).slice(0, -1));

assert.equal(checkJobs(undefined, 7), 7);
assert.equal(checkJobs("", 7), 7);
assert.equal(checkJobs("1", 7), 1);
assert.equal(checkJobs("12", 7), 7);
for (const value of ["0", "two", "-1", "1.5"]) assert.throws(() => checkJobs(value, 7), /MARINARA_CHECK_JOBS/u);

// A failing lane does not stop the others, every line carries its lane's name, and a cap of one runs one at a time.
const lane = (name, body) => ({ name, command: process.execPath, args: ["-e", body] });
const fixture = [
  lane("slow", "setTimeout(() => console.log('slow done'), 300)"),
  lane("broken", "console.error('broken says why'); process.exit(3)"),
  lane("quick", "console.log('quick done')"),
  { name: "missing", command: "marinara-no-such-command", args: [] },
];
for (const jobs of [4, 1]) {
  let text = "";
  const failed = await runLanes(fixture, { jobs, out: { write: (chunk) => (text += chunk) } });
  assert.deepEqual(failed.sort(), ["broken", "missing"], text);
  assert.equal(text.match(/^\[check\] missing FAILED/gmu)?.length, 1, "a lane that cannot start is reported once");
  assert.match(text, /^\[slow\] slow done$/mu);
  assert.match(text, /^\[broken\] broken says why$/mu);
  assert.match(text, /^\[check\] broken FAILED \(exit 3\)/mu);
  assert.match(text, /^\[check\] quick passed/mu);
  const order = [...text.matchAll(/^\[check\] (\w+)/gmu)].map((match) => match[1]);
  if (jobs === 1) assert.deepEqual(order, ["slow", "broken", "quick", "missing"], text);
  else assert.equal(order.at(-1), "slow", "side by side, the slow lane finishes last");
}

console.log("pnpm check lanes run side by side, report every failure and respect MARINARA_CHECK_JOBS.");
