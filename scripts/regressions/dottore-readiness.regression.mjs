import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const python = ["python3", "python"].find(
  (command) => spawnSync(command, ["-c", "import sys; sys.exit(sys.version_info < (3, 9))"]).status === 0,
);
assert.ok(python, "Dottore readiness regressions require Python 3.9 or newer");
const reviewer = fileURLToPath(new URL("../../.github/dottore-review/dottore_review.py", import.meta.url));
const proof = String.raw`
from __future__ import annotations
import contextlib, io, json, os, pathlib, sys, tempfile, threading, types, unittest
from types import SimpleNamespace as NS
from unittest.mock import patch

m = types.ModuleType("dottore_readiness_regression")
m.__file__ = sys.argv[1]
sys.modules[m.__name__] = m
exec(compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec"), m.__dict__)
HEAD = "a" * 40
READY = {"state": "OPEN", "isDraft": False, "headRefOid": HEAD, "baseRefName": "staging"}

class Readiness(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="dottore-readiness-")
        self.addCleanup(self.temp.cleanup)
        self.tree = pathlib.Path(self.temp.name)
        self.old_cwd = pathlib.Path.cwd()
        os.chdir(self.tree)
        self.addCleanup(os.chdir, self.old_cwd)
        self.env = patch.dict(os.environ, {"PR_NUM": "42", "GITHUB_REPOSITORY": "Pasta-Devs/Marinara-Engine", "GITHUB_OUTPUT": str(self.tree / "output")})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.state, self.calls, self.writes = dict(READY), [], []
        self.boundary = patch.object(m, "run", self.fake_run)
        self.boundary.start()
        self.addCleanup(self.boundary.stop)

    def fake_run(self, args, **kwargs):
        self.calls.append(args)
        if args[:3] == ["gh", "pr", "view"]:
            return NS(stdout=json.dumps(self.state), stderr="", returncode=0)
        if args[:2] == ["gh", "api"] and "/reviews?" in " ".join(args):
            return NS(stdout="[]", stderr="", returncode=0)
        if args[0] == "gh" and m.gh_mutates(args[1:]):
            self.writes.append(args)
            return NS(stdout="{}", stderr="", returncode=0)
        self.fail("Unexpected boundary: " + str(args))

    def ctx(self):
        settings = {"slot": "small", "api": "anthropic", "model": "fixture", "effort": ""}
        return NS(models={"scout": settings}, lock=threading.Lock(), cost_limit=0, spent_usd=0,
                  failures={}, stats=m.build_stats(""), readiness=m.ReviewReadiness("42"))

    def test_only_explicit_open_ready_metadata_is_admitted(self):
        for data in ({"state": "OPEN", "isDraft": True}, {"state": "CLOSED", "isDraft": False},
                     {"state": "MERGED", "isDraft": False}, {"state": "OPEN"}, {}, {"state": "OPEN", "isDraft": "false"}):
            self.state = data
            with self.subTest(data=data), self.assertRaises(m.ReviewWithheld): m.require_ready("42")
        self.state = dict(READY)
        self.assertEqual(m.require_ready("42"), READY)
        with patch.object(m, "run", side_effect=TimeoutError("metadata unavailable")), self.assertRaises(m.ReviewWithheld):
            m.require_ready("42")

    def test_draft_produce_does_not_start_models_or_replace_checkpoint(self):
        self.state["isDraft"] = True
        pathlib.Path("review.md").write_text("old published checkpoint")
        with patch.object(m, "missing_model_setup", side_effect=AssertionError("model setup must not run")), contextlib.redirect_stderr(io.StringIO()):
            m.produce_review(NS(mode="full"))
        withheld = json.loads(pathlib.Path("review.json").read_text())
        self.assertEqual(withheld["review_state"], "withheld")
        self.assertNotIn("head_sha", withheld)
        self.assertEqual(pathlib.Path("review.md").read_text(), "old published checkpoint")
        self.assertIn("ready=false", pathlib.Path(os.environ["GITHUB_OUTPUT"]).read_text())
        self.assertEqual(self.writes, [])

    def test_ready_model_starts_independently_of_pending_or_failed_ci(self):
        for ci in ("pending", "failure"):
            with self.subTest(ci=ci), patch.object(m, "checks_not_passed", side_effect=AssertionError("CI is not admission")), \
                    patch.object(m, "claude_reply", return_value=(NS(stop_reason="end_turn"), {})) as provider, contextlib.redirect_stdout(io.StringIO()):
                m.chat(self.ctx(), "scout", [], [], None)
            self.assertEqual(provider.call_count, 1)
        self.assertTrue(all(call[:3] == ["gh", "pr", "view"] for call in self.calls))

    def test_ready_retry_is_stopped_when_draft_before_next_attempt(self):
        class OpenError(Exception): pass
        class StatusError(OpenError):
            status_code = 429
        class AnthropicError(Exception): pass
        modules = {"openai": NS(APIStatusError=StatusError, APIError=OpenError),
                   "anthropic": NS(APIStatusError=type("AnthropicStatus", (AnthropicError,), {}), APIError=AnthropicError)}
        for failure in (m.StreamStalled("timeout"), StatusError("429"), AnthropicError("request timeout")):
            self.state = dict(READY)
            attempts = []
            def reply(*args):
                attempts.append(True)
                self.state["isDraft"] = True
                raise failure
            with self.subTest(error=type(failure).__name__), patch.dict(sys.modules, modules), patch.object(m, "claude_reply", reply) as unused, \
                    patch.object(m.time, "sleep"), contextlib.redirect_stdout(io.StringIO()), self.assertRaises(m.ReviewWithheld):
                m.chat(self.ctx(), "scout", [], [], None)
            # Exactly one provider attempt: a hidden SDK retry cannot bypass this live check.
            self.assertEqual(attempts, [True])

    def test_withheld_is_never_classified_or_retried_as_provider_failure(self):
        with patch.object(m, "claude_reply", side_effect=m.ReviewWithheld("draft")) as provider, \
                patch.object(m, "transient_error", side_effect=AssertionError("withheld must not retry")), self.assertRaises(m.ReviewWithheld):
            m.chat(self.ctx(), "scout", [], [], None)
        self.assertEqual(provider.call_count, 1)

    def test_sdk_clients_have_no_hidden_retries(self):
        retries = []
        def client(**settings):
            retries.append(settings["max_retries"])
            return NS()
        with patch.dict(sys.modules, {"openai": NS(OpenAI=client), "anthropic": NS(Anthropic=client)}), \
                patch.dict(os.environ, {"DOTTORE_SMALL_API_KEY": "fixture-value"}):
            for api in ("openai", "responses", "anthropic"):
                m.review_clients({"scout": {"slot": "small", "api": api, "base_url": ""}})
        self.assertEqual(retries, [0, 0, 0])

    def test_every_sdk_closes_a_stream_when_existing_watchdog_observes_draft(self):
        clock = [0]
        owner = self
        class Stream:
            closed = False
            def __enter__(self): return self
            def __exit__(self, *args): self.closed = True
            def __iter__(self):
                clock[0] = 0
                yield NS(type="ping", delta=None, usage=None, choices=[])
                clock[0] = 16
                owner.state["isDraft"] = True
                yield NS(type="ping", delta=None, usage=None, choices=[])
        modules = {"openai": NS(Timeout=lambda *a, **k: None, APIConnectionError=ConnectionError),
                   "anthropic": NS(Timeout=lambda *a, **k: None),
                   "httpx2": NS(TimeoutException=TimeoutError, TransportError=OSError)}
        for reply in (m.openai_reply, m.responses_reply, m.claude_reply):
            self.state = dict(READY)
            stream = Stream()
            ctx = self.ctx()
            ctx.clients = {"small": NS(chat=NS(completions=NS(create=lambda **k: stream)), responses=NS(create=lambda **k: stream), messages=NS(stream=lambda **k: stream))}
            settings = {"slot": "small", "model": "fixture", "effort": "", "max_tokens": 64000}
            with self.subTest(reply=reply.__name__), patch.dict(sys.modules, modules), patch.object(m.time, "monotonic", lambda: clock[0]), self.assertRaises(m.ReviewWithheld):
                reply(ctx, settings, [], [], "auto", 600, 0, {}, "")
            self.assertTrue(stream.closed)
            self.state = dict(READY)
            with self.assertRaises(m.ReviewWithheld): ctx.readiness(fresh=True)

    def test_write_boundary_rechecks_each_actual_mutation(self):
        self.state["isDraft"] = True
        writes = [["pr", "comment", "42", "--body", "fixture"], ["api", "-X", "POST", "repos/example/reviews"],
                  ["api", "--method", "PATCH", "repos/example/comments/1"], ["api", "graphql", "-f", "query=mutation { resolveReviewThread }"]]
        for args in writes:
            with self.subTest(args=args), self.assertRaises(m.ReviewWithheld): m.run_gh(args)
        self.assertEqual(self.writes, [])
        self.assertFalse(m.gh_mutates(["api", "graphql", "-f", "query=query { viewer { login } }"]))
        self.assertFalse(m.gh_mutates(["api", "repos/example/pulls", "--method", "GET", "-f", "state=open"]))

    def test_rendered_review_is_not_posted_after_conversion_to_draft(self):
        pathlib.Path("review.md").write_text("existing checkpoint")
        pathlib.Path("review.json").write_text("{}")
        pathlib.Path("inline.json").write_text("[]")
        def existing(*args):
            self.state["isDraft"] = True
            return None
        with patch.object(m, "latest_walkthrough_comment", existing), self.assertRaises(m.ReviewWithheld):
            m.post_review(NS(review_md="review.md", review_json="review.json", inline_json="inline.json"))
        self.assertEqual(self.writes, [])
        self.assertEqual(pathlib.Path("review.md").read_text(), "existing checkpoint")

    def test_thread_resolution_and_final_approval_recheck_live_readiness(self):
        item = {"thread_id": "thread", "comment_id": "1", "path": "fixture", "line": 1}
        def threads(*args, **kwargs):
            self.state["isDraft"] = True
            return [item]
        with patch.object(m, "open_dottore_threads", threads), self.assertRaises(m.ReviewWithheld):
            m.resolve_repaired_threads("42", [item], HEAD)
        self.state = dict(READY)
        def checks(*args):
            self.state["isDraft"] = True
            return []
        body = f"<!-- dottore:last-reviewed-sha={HEAD} -->\n{m.DISCHARGE_MARKER}"
        with patch.object(m, "open_dottore_threads", return_value=[]), patch.object(m, "latest_walkthrough_comment", return_value={"body": body}), \
                patch.object(m, "checks_not_passed", checks), self.assertRaises(m.ReviewWithheld):
            m.approve(NS(trigger="auto"))
        self.assertEqual(self.writes, [])

    def test_repair_readiness_has_only_the_required_read_permission(self):
        workflow = (pathlib.Path(m.__file__).parents[1] / "workflows/dottore-review.yml").read_text()
        repair = workflow.split("\n  fix:\n", 1)[1].split("\n  push:\n", 1)[0]
        header = repair.split("    steps:", 1)[0]
        self.assertIn("      pull-requests: read", header)
        self.assertNotIn("pull-requests: write", header)
        self.assertIn("/tmp/dottore-autofix/dottore_review.py ready", repair)

    def test_withheld_review_stays_unpublishable_even_after_ready_again(self):
        pathlib.Path("review.json").write_text(json.dumps({"review_state": "withheld"}))
        with self.assertRaises(m.ReviewWithheld): m.render_review(NS(review_json="review.json"))
        with self.assertRaises(m.ReviewWithheld): m.post_review(NS(review_json="review.json"))
        self.state["isDraft"] = True
        with self.assertRaises(m.ReviewWithheld): m.autofix_prompt(NS(trigger="asked", out=str(self.tree / "repair")))
        self.assertFalse((self.tree / "repair/meta.json").exists())
        self.assertEqual(self.writes, [])

unittest.main(argv=["dottore-readiness"], verbosity=2)
`;
const result = spawnSync(python, ["-c", proof, reviewer], {
  encoding: "utf8",
  timeout: 15_000,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});
assert.equal(result.status, 0, `${result.error?.message ?? ""}\n${result.stdout}${result.stderr}`);
console.info("Dottore readiness regressions passed.");

// Execute the actual status-publication Bash, including its real readiness command.
// No GitHub request escapes the fixture; model work is represented only by its step outputs.
if (process.platform !== "win32") {
  const workflow = readFileSync(new URL("../../.github/workflows/dottore-review.yml", import.meta.url), "utf8");
  const steps = workflow
    .split(/^      - name: /mu)
    .slice(1)
    .filter((step) => step.includes('context="Dottore Review"'))
    .map((step) => {
      const lines = step.split("        run: |\n")[1].split("\n");
      const end = lines.findIndex((line) => line.trim() && !line.startsWith("          "));
      return {
        name: step.split("\n")[0],
        condition: step.match(/^        if: (.+)$/mu)?.[1],
        script: lines
          .slice(0, end < 0 ? undefined : end)
          .map((line) => line.slice(10))
          .join("\n"),
      };
    });
  assert.ok(steps.some((step) => step.name === "Complete Dottore status"));
  const directory = mkdtempSync(join(tmpdir(), "dottore-status-readiness-"));
  try {
    // The real CLI uses evaluated union annotations; mirror Actions' Python 3.10+ runtime.
    const cliPython = ["python3", "python"]
      .map((command) =>
        spawnSync(command, ["-c", "import sys; print(sys.executable); sys.exit(sys.version_info < (3, 10))"], {
          encoding: "utf8",
          timeout: 5_000,
        }),
      )
      .find((result) => result.status === 0)
      ?.stdout.trim();
    assert.ok(cliPython, "The workflow CLI proof requires Python 3.10 or newer, as used in Actions");
    for (const command of ["python", "python3"]) {
      writeFileSync(join(directory, command), `#!/bin/sh\nexec '${cliPython.replaceAll("'", "'\\''")}' "$@"\n`, {
        mode: 0o755,
      });
    }
    const calls = join(directory, "calls.jsonl");
    writeFileSync(
      join(directory, "gh"),
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "pr" && args[1] === "view") {
  if (process.env.STATUS_READINESS === "error") process.exit(1);
  process.stdout.write(JSON.stringify({state: process.env.STATUS_READINESS === "ready" || process.env.STATUS_READINESS === "draft" ? "OPEN" : process.env.STATUS_READINESS.toUpperCase(), isDraft: process.env.STATUS_READINESS === "draft"}));
} else if (args[0] === "api" && args.includes("POST") && args.some(arg => arg.includes("/statuses/"))) {
  fs.appendFileSync(process.env.STATUS_CALLS, JSON.stringify(args) + "\\n");
} else { throw new Error("Unexpected GitHub boundary: " + JSON.stringify(args)); }
`,
      { mode: 0o755 },
    );
    writeFileSync(join(directory, "review.json"), JSON.stringify({ findings: [], nitpicks: [], pre_merge_checks: [] }));
    const failures = [];
    const scenarios = [
      { name: "Ready review completes", expected: ["success"] },
      { name: "Draft during examination", examination: "false", readiness: "draft", expected: [] },
      { name: "Publication withheld", post: "false", readiness: "draft", expected: [] },
      { name: "Readiness API fails at publication", readiness: "error", expected: [] },
      { name: "PR closes before publication", readiness: "closed", expected: [] },
      { name: "PR merges before publication", readiness: "merged", expected: [] },
      { name: "Draft admission", admission: "false", readiness: "draft", expected: [] },
      { name: "Ready examination fails", job: "failure", expected: ["failure"] },
      { name: "Autofix does not publish a review status", mode: "autofix", expected: [] },
    ];
    for (const scenario of scenarios) {
      writeFileSync(calls, "");
      for (const step of steps) {
        const condition = step.condition
          .replaceAll("always()", "true")
          .replaceAll("steps.admission.outputs.ready", JSON.stringify(scenario.admission ?? "true"))
          .replaceAll("steps.examination.outputs.ready", JSON.stringify(scenario.examination ?? "true"))
          .replaceAll("steps.post.outputs.ready", JSON.stringify(scenario.post ?? "true"))
          .replaceAll("inputs.review_mode", JSON.stringify(scenario.mode ?? "auto"));
        if (!vm.runInNewContext(condition)) continue;
        const ready = step.name === "Mark Dottore status in progress" ? "ready" : (scenario.readiness ?? "ready");
        const script = step.script.replaceAll("/tmp/dottore-review-tool/dottore_review.py", reviewer);
        const execution = spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
          cwd: directory,
          encoding: "utf8",
          timeout: 10_000,
          env: {
            ...process.env,
            PATH: `${directory}:${process.env.PATH}`,
            PYTHONDONTWRITEBYTECODE: "1",
            GITHUB_REPOSITORY: "Pasta-Devs/Marinara-Engine",
            GITHUB_SERVER_URL: "https://github.com",
            GITHUB_RUN_ID: "fixture",
            PR_NUM: "42",
            PR_HEAD_SHA: "a".repeat(40),
            JOB_STATUS: scenario.job ?? "success",
            STATUS_CALLS: calls,
            STATUS_READINESS: ready,
          },
        });
        assert.equal(execution.status, 0, `${scenario.name}: ${execution.error?.message ?? ""}\n${execution.stderr}`);
      }
      const statuses = readFileSync(calls, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) =>
          JSON.parse(line)
            .find((arg) => arg.startsWith("state="))
            .slice(6),
        );
      console.info(`${scenario.name}: ${JSON.stringify(statuses)}`);
      if (JSON.stringify(statuses) !== JSON.stringify(scenario.expected)) failures.push(scenario.name);
    }
    assert.deepEqual(
      failures,
      [],
      "Withheld runs publish no pending or false terminal status; Ready outcomes stay terminal",
    );
    console.info(`Dottore status lifecycle regressions passed (${scenarios.length} scenarios).`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
