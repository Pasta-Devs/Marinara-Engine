import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const python = ["python3", "python"].find(
  (command) =>
    spawnSync(command, ["-c", "import sys; sys.exit(sys.version_info < (3, 9))"], { timeout: 5_000 }).status === 0,
);
assert.ok(python, "Dottore check regressions require Python 3.9 or newer");
const reviewer = fileURLToPath(new URL("../../.github/dottore-review/dottore_review.py", import.meta.url));
const proof = String.raw`
from __future__ import annotations
import contextlib, io, json, pathlib, sys, types, unittest
from types import SimpleNamespace as NS
from unittest.mock import patch

reviewer = types.ModuleType("dottore_check_regression")
reviewer.__file__ = sys.argv[1]
sys.modules[reviewer.__name__] = reviewer
exec(compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec"), reviewer.__dict__)

def check(identifier, conclusion="success", app=15368, name="Catalog job", status="completed"):
    return {"id": identifier, "name": name, "status": status, "conclusion": conclusion,
            "app": {"id": app, "slug": "github-actions" if app == 15368 else "other-app"}}

def commit_status(identifier, state="success", creator="github-actions[bot]"):
    return {"id": identifier, "context": "Catalog job", "state": state,
            "creator": {"login": creator, "type": "Bot"}}

class CheckResults(unittest.TestCase):
    def missing(self, runs, statuses=(), required=True, bound=True, paginated=False, app_error=None):
        rules = [{"type": "required_status_checks", "parameters": {"required_status_checks": [
            {"context": "Catalog job", "integration_id": 15368 if bound else None}
        ]}}] if required else []
        def gh(args, **kwargs):
            url = args[1]
            if url.startswith("apps/"):
                app_id = {"apps/github-actions": 15368, "apps/other-app": 999}.get(url)
                if app_error: return NS(stdout="", stderr=app_error, returncode=1)
                return NS(stdout=str(app_id) if app_id else "", stderr="" if app_id else "HTTP 404", returncode=0 if app_id else 1)
            if "/rules/branches/" in url:
                result = rules
            elif "/check-runs?" in url:
                # Match gh's actual output shape, including arrays emitted for each page.
                if paginated:
                    self.assertIn("--paginate", args)
                    self.assertIn("--jq", args)
                    return NS(stdout=json.dumps(runs[:100]) + "\n" + json.dumps(runs[100:]))
                result = runs if "--jq" in args else {"check_runs": runs}
            elif "/statuses?" in url:
                if paginated:
                    self.assertIn("--paginate", args)
                    compact = "--jq" in args
                    return NS(stdout=json.dumps(statuses[:100], indent=None if compact else 2) + "\n" + json.dumps(statuses[100:], indent=None if compact else 2))
                result = statuses
            elif url.endswith("/status"):
                result = {"statuses": statuses}
            else:
                self.fail("Unexpected API request: " + str(args))
            return NS(stdout=json.dumps(result))
        with patch.dict(reviewer.os.environ, {"GITHUB_REPOSITORY": "Pasta-Devs/Marinara-Engine"}), patch.object(reviewer, "run_gh", gh):
            return reviewer.checks_not_passed("staging", "head")

    def test_new_success_is_not_overwritten_by_older_cancellation(self):
        newest = check(119891448787)
        older = check(119890653888, "cancelled")
        for runs in ([newest, older], [older, newest]):
            self.assertEqual(self.missing(runs), [])

    def test_required_context_on_a_later_page_is_not_missing(self):
        runs = [check(i, name="Other job " + str(i)) for i in range(100)] + [check(200)]
        self.assertEqual(self.missing(runs, paginated=True), [])

    def test_commit_status_pages_use_complete_json_documents(self):
        statuses = [{**commit_status(i), "context": "Other " + str(i)} for i in range(100)] + [commit_status(200)]
        self.assertEqual(self.missing([], statuses, paginated=True), [])

    def test_failed_app_lookup_reports_an_evidence_error(self):
        for error in ("HTTP 403: Forbidden", "HTTP 404: Not Found", "HTTP 503: Service Unavailable"):
            with self.assertRaisesRegex(RuntimeError, "Could not verify GitHub App"):
                self.missing([], [commit_status(20)], app_error=error)

    def test_approval_reports_unverifiable_evidence_without_approving(self):
        head = "a" * 40
        failures = (RuntimeError("Could not verify GitHub App: HTTP 403"), ValueError("Malformed response " + "x" * 1000), reviewer.subprocess.TimeoutExpired(["gh", "api"], 120))
        for trigger, failure in ((trigger, failure) for trigger in ("auto", "asked") for failure in failures):
            comments, output = [], io.StringIO()
            def gh(args, **kwargs):
                if args[:2] == ["pr", "view"]:
                    return NS(stdout=json.dumps({"state": "OPEN", "isDraft": False, "headRefOid": head, "baseRefName": "staging"}))
                if args[0] == "api" and "/reviews?" in args[1]:
                    return NS(stdout="[]")
                if args[:2] == ["pr", "comment"]:
                    comments.append(args[args.index("--body") + 1])
                    return NS(returncode=0)
                self.fail("Unexpected API request, including any approval: " + str(args))
            walkthrough = f"<!-- dottore:last-reviewed-sha={head} -->\n{reviewer.DISCHARGE_MARKER}"
            with patch.dict(reviewer.os.environ, {"GITHUB_REPOSITORY": "Pasta-Devs/Marinara-Engine", "PR_NUM": "42"}), patch.object(reviewer, "run_gh", gh), patch.object(reviewer, "latest_walkthrough_comment", return_value={"body": walkthrough}), patch.object(reviewer, "open_dottore_threads", return_value=[]), patch.object(reviewer, "checks_not_passed", side_effect=failure), contextlib.redirect_stdout(output):
                reviewer.approve(NS(trigger=trigger))
            self.assertIn("required check evidence could not be verified", output.getvalue())
            self.assertIn(type(failure).__name__, output.getvalue())
            self.assertLess(len(output.getvalue()), 700, "API errors must not produce an unbounded PR comment")
            self.assertNotIn("these checks have not passed", output.getvalue())
            self.assertEqual(len(comments), 1 if trigger == "asked" else 0)
            if comments:
                self.assertIn("required check evidence could not be verified", comments[0])

    def test_new_pending_failure_or_cancellation_still_blocks(self):
        for newest in (check(20, None, status="in_progress"), check(20, "failure"), check(20, "cancelled")):
            self.assertEqual(self.missing([check(10), newest]), ["Catalog job"])

    def test_missing_and_wrong_app_cannot_satisfy_required_check(self):
        self.assertEqual(self.missing([]), ["Catalog job"])
        self.assertEqual(self.missing([check(20, app=999)]), ["Catalog job"])
        self.assertEqual(self.missing([check(20, app=999), check(10)]), [])
        self.assertEqual(self.missing([check(20, "failure", app=999), check(10)]), [])

    def test_latest_commit_status_wins_and_keeps_source_identity(self):
        self.assertEqual(self.missing([check(10)], [commit_status(20), commit_status(10, "pending")]), [])
        self.assertEqual(self.missing([check(10)], [commit_status(20, "pending"), commit_status(10)]), ["Catalog job"])
        self.assertEqual(self.missing([check(10)], [commit_status(20, creator="other-app[bot]")]), [])
        self.assertEqual(self.missing([], [commit_status(20, creator="other-app[bot]")]), ["Catalog job"])
        self.assertEqual(self.missing([], [commit_status(20)]), [])
        self.assertEqual(self.missing([], [commit_status(30, "failure", "other-app[bot]"), commit_status(20)]), [])
        with self.assertRaisesRegex(RuntimeError, "Could not verify GitHub App unknown"):
            self.missing([], [commit_status(20, creator="unknown[bot]")])

    def test_status_cannot_erase_a_failed_check_or_vice_versa(self):
        self.assertEqual(self.missing([check(20, "failure")], [commit_status(30)]), ["Catalog job"])
        self.assertEqual(self.missing([check(20)], [commit_status(30, "failure")]), ["Catalog job"])

    def test_unbound_contexts_and_no_required_rules_keep_failing_latest_results(self):
        self.assertEqual(self.missing([], [commit_status(20)], bound=False), [])
        self.assertEqual(self.missing([], [commit_status(30), commit_status(20, "failure", "other-app[bot]")], bound=False), [])
        self.assertEqual(self.missing([], [commit_status(30, "failure"), commit_status(20, creator="other-app[bot]")], bound=False), ["Catalog job"])

        self.assertEqual(self.missing([check(20), check(10, "cancelled")], required=False), [])
        self.assertEqual(self.missing([check(20, "failure"), check(10)], required=False), ["Catalog job"])

unittest.main(argv=["dottore-check-results"], verbosity=2)
`;
const result = spawnSync(python, ["-c", proof, reviewer], {
  encoding: "utf8",
  timeout: 10_000,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});
assert.equal(result.status, 0, `${result.error?.message ?? ""}\n${result.stdout}${result.stderr}`);
console.info("Dottore check result regressions passed.");
