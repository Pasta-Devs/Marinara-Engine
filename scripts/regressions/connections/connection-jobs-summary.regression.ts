// The Jobs card and page sort every job but Main by what it runs: a Model of its own, Main's or Agents' Model, or
// nothing. A job with a problem stays a full row; the card's sentence names only the jobs that run their own Model.
import assert from "node:assert/strict";
import { summarizeJobs, type SummaryTile } from "../../../packages/client/src/lib/connection-jobs-summary.js";
import { runNamedCases } from "../fixtures/named-cases.js";

const FOLLOWS_MAIN = "Follows Main";
const FOLLOWS_AGENTS = "Follows Agents";
const MODEL = { id: "row" };
const OFF = { text: "Account is off", short: "Off" };
const QUIET = { text: "Built-in model is not downloaded", quiet: true };

const keys = (tiles: readonly SummaryTile[]) => tiles.map((tile) => tile.key);

await runNamedCases([
  {
    name: "usual set-up: Main and Images chosen, the followers on Main or Agents",
    run: () => {
      const tiles: SummaryTile[] = [
        { key: "main", source: MODEL, warning: null },
        { key: "agents", follows: FOLLOWS_MAIN, source: MODEL, warning: null },
        { key: "impersonate", follows: FOLLOWS_MAIN, source: MODEL, warning: null },
        { key: "mari", follows: FOLLOWS_AGENTS, source: MODEL, warning: null },
        // Unset Quick answers runs the built-in model: not Main.
        { key: "quick", source: MODEL, warning: QUIET },
        { key: "images", source: MODEL, warning: null },
        { key: "video", muted: true, find: { count: 3 }, warning: null },
        { key: "voice", muted: true, warning: null },
        { key: "stt", muted: true, warning: null },
        { key: "decision", muted: true, find: { count: 0 }, warning: null },
        { key: "embeddings", muted: true, setup: { item: "local-model" }, warning: null },
        { key: "vision", muted: true, warning: null },
      ];
      const summary = summarizeJobs(tiles, FOLLOWS_AGENTS);
      assert.equal(summary.main?.key, "main", "Main is its own line");
      assert.deepEqual(keys(summary.own), ["quick", "images"]);
      assert.deepEqual(keys(summary.followsMain), ["agents", "impersonate"]);
      assert.deepEqual(keys(summary.followsAgents), ["mari"]);
      assert.deepEqual(keys(summary.off), ["video", "voice", "stt", "decision", "embeddings", "vision"]);
      // A quiet warning is an optional step, not a problem.
      assert.deepEqual(keys(summary.problems), []);
      assert.deepEqual(
        keys(summary.exceptions),
        ["quick", "images"],
        "the sentence names the jobs with their own Model",
      );
      // Every job but Main shows exactly once.
      const placed = [...summary.own, ...summary.followsMain, ...summary.followsAgents, ...summary.off];
      assert.deepEqual(keys(placed).sort(), keys(tiles.slice(1)).sort());
    },
  },
  {
    name: "nothing of their own: the sentence names no job",
    run: () => {
      const summary = summarizeJobs(
        [
          { key: "agents", follows: FOLLOWS_MAIN, source: MODEL, warning: null },
          { key: "images", muted: true, find: { count: 0 }, warning: null },
        ],
        FOLLOWS_AGENTS,
      );
      assert.equal(summary.main, undefined);
      assert.deepEqual(keys(summary.exceptions), []);
    },
  },
  {
    name: "Agents with a Model of its own: the jobs that follow it are named too",
    run: () => {
      const summary = summarizeJobs(
        [
          { key: "main", source: MODEL, warning: null },
          { key: "agents", source: MODEL, warning: null },
          { key: "impersonate", follows: FOLLOWS_MAIN, source: MODEL, warning: null },
          { key: "mari", follows: FOLLOWS_AGENTS, source: MODEL, warning: null },
        ],
        FOLLOWS_AGENTS,
      );
      assert.deepEqual(keys(summary.followsAgents), ["mari"]);
      assert.deepEqual(keys(summary.exceptions), ["agents", "mari"]);
    },
  },
  {
    name: "Main's account is off: its followers are problem rows the sentence does not name",
    run: () => {
      const summary = summarizeJobs(
        [
          { key: "main", source: MODEL, warning: OFF },
          { key: "agents", follows: FOLLOWS_MAIN, source: MODEL, warning: OFF },
          { key: "mari", follows: FOLLOWS_AGENTS, source: MODEL, warning: OFF },
          { key: "images", source: MODEL, warning: OFF },
        ],
        FOLLOWS_AGENTS,
      );
      assert.deepEqual(keys(summary.own), ["agents", "mari", "images"]);
      assert.deepEqual(keys(summary.followsMain), []);
      assert.deepEqual(keys(summary.problems), ["agents", "mari", "images"]);
      assert.deepEqual(keys(summary.exceptions), ["images"]);
    },
  },
  {
    name: "no Model to inherit: a follower still follows by the job table",
    run: () => {
      const summary = summarizeJobs(
        [
          { key: "main", muted: true, find: { count: 0 }, warning: { text: "No main model" } },
          { key: "agents", muted: true, warning: null },
          { key: "impersonate", muted: true, warning: null },
          { key: "mari", muted: true, warning: null },
          { key: "vision", muted: true, warning: null },
        ],
        FOLLOWS_AGENTS,
      );
      assert.deepEqual(keys(summary.followsMain), ["agents", "impersonate"]);
      assert.deepEqual(keys(summary.followsAgents), ["mari"]);
      assert.deepEqual(keys(summary.off), ["vision"]);
      assert.deepEqual(keys(summary.problems), [], "Main's own warning is not a problem line");
    },
  },
  {
    name: "empty jobs are off; a set-up job keeps its row for its warning",
    run: () => {
      const summary = summarizeJobs(
        [
          { key: "voice", muted: true, find: { count: 1 }, warning: { text: "The voice account is missing" } },
          { key: "decision", setup: { item: "local-model" }, source: MODEL, warning: { text: "Not downloaded" } },
          { key: "embeddings", warning: { text: "The chosen model no longer exists" } },
        ],
        FOLLOWS_AGENTS,
      );
      assert.deepEqual(keys(summary.off), ["voice"]);
      assert.deepEqual(keys(summary.own), ["decision", "embeddings"]);
      assert.deepEqual(keys(summary.problems), ["decision", "embeddings"]);
      // The decision job runs nothing yet, so the sentence does not name it; the missing model was its own choice.
      assert.deepEqual(keys(summary.exceptions), ["embeddings"]);
      assert.deepEqual(
        keys(summarizeJobs([{ key: "voice", muted: true, source: MODEL, warning: null }], FOLLOWS_AGENTS).own),
        ["voice"],
      );
    },
  },
]);
