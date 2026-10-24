import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const python = ["python3", "python"].find(
  (command) =>
    spawnSync(command, ["-c", "import sys; sys.exit(sys.version_info < (3, 9))"], { timeout: 5_000 }).status === 0,
);
assert.ok(python, "Dottore thread disposition regressions require Python 3.9 or newer");
const reviewer = fileURLToPath(new URL("../../.github/dottore-review/dottore_review.py", import.meta.url));
const proof = String.raw`
from __future__ import annotations
import json, os, pathlib, sys, tempfile, types, unittest
from types import SimpleNamespace as NS
from unittest.mock import patch

reviewer = types.ModuleType("dottore_disposition_regression")
reviewer.__file__ = sys.argv[1]
sys.modules[reviewer.__name__] = reviewer
exec(compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec"), reviewer.__dict__)

BOT = {"__typename": "Bot", "login": "github-actions"}
PERSON = {"__typename": "User", "login": "maintainer"}
OTHER_BOT = {"__typename": "Bot", "login": "coderabbitai"}
CONTRACT = {"invariant": ["The swipe index stays on the selected swipe."]}

def thread(finding, resolved=False, replies=(), path="src/a.ts"):
    first = {"databaseId": 1, "body": f"### 🔎 MEDIUM: Finding {finding}\n<!-- dottore:finding={finding} -->", "author": BOT}
    return {"id": f"T_{finding}", "isResolved": resolved, "path": path, "line": 3, "originalLine": 3, "diffSide": "RIGHT",
            "comments": {"nodes": [first, *({"databaseId": 2, "body": body, "author": author} for author, body in replies)]}}

OPEN, ANSWERED, RESOLVED, BOT_ONLY = "a" * 16, "b" * 16, "c" * 16, "d" * 16
NODES = [
    thread(OPEN),
    thread(ANSWERED, replies=[(PERSON, "By design: the linked issue keeps legacy swipes read-only.")]),
    thread(RESOLVED, resolved=True, replies=[(PERSON, "Fixed.")]),
    thread(BOT_ONLY, replies=[(OTHER_BOT, "Automated summary.")]),
    {"id": "T_human", "isResolved": False, "path": "src/a.ts", "line": 1, "comments": {"nodes": [{"body": "question", "author": PERSON}]}},
]

def entry(finding):
    return {"id": finding, "status": "prior", "severity": "medium", "path": "src/a.ts", "line": 3, "side": "RIGHT",
            "title": f"Finding {finding}", "fix_hint": "", "repair_contract": CONTRACT}

def fake_gh(args, **kwargs):
    return NS(stdout=json.dumps({"data": {"repository": {"pullRequest": {"reviewThreads": {"nodes": NODES}}}}}), stderr="", returncode=0)

class ThreadDispositions(unittest.TestCase):
    def setUp(self):
        patcher = patch.multiple(reviewer, run_gh=fake_gh)
        patcher.start()
        self.addCleanup(patcher.stop)
        os.environ["GITHUB_REPOSITORY"] = "owner/repo"
        self.threads = reviewer.dottore_threads("1")

    def test_one_query_lists_every_dottore_thread_with_its_state(self):
        by_id = {item["id"]: item for item in self.threads}
        self.assertEqual(sorted(by_id), sorted([OPEN, ANSWERED, RESOLVED, BOT_ONLY]))
        self.assertTrue(by_id[RESOLVED]["resolved"])
        self.assertEqual(by_id[ANSWERED]["reply"], "By design: the linked issue keeps legacy swipes read-only.")
        # Another bot's reply holds the thread open but is no maintainer's disposition.
        self.assertTrue(by_id[BOT_ONLY]["answered"])
        self.assertEqual(by_id[BOT_ONLY]["reply"], "")

    def test_resolved_dropped_answered_disposed_open_untouched(self):
        kept = reviewer.dispose_contracts([entry(OPEN), entry(ANSWERED), entry(RESOLVED), entry(BOT_ONLY)], self.threads)
        by_id = {item["id"]: item for item in kept}
        self.assertNotIn(RESOLVED, by_id)
        self.assertEqual(by_id[ANSWERED]["status"], "disposed")
        self.assertIn("By design", by_id[ANSWERED]["reply"])
        self.assertEqual(by_id[OPEN], entry(OPEN))
        self.assertEqual(by_id[BOT_ONLY], entry(BOT_ONLY))

    def test_a_reposted_finding_keeps_its_open_thread(self):
        threads = reviewer.dottore_threads("1") + [{**self.threads[0], "id": RESOLVED, "resolved": False, "reply": ""}]
        self.assertIn(RESOLVED, {item["id"] for item in reviewer.dispose_contracts([entry(RESOLVED)], threads)})

    def test_disposed_state_round_trips_through_the_walkthrough_header(self):
        kept = reviewer.dispose_contracts([entry(OPEN), entry(ANSWERED)], self.threads)
        decoded = reviewer.decode_contract_state_from_body(reviewer.encode_contract_state(kept))
        by_id = {item["id"]: item for item in decoded}
        self.assertEqual(by_id[ANSWERED]["status"], "disposed")
        self.assertIn("By design", by_id[ANSWERED]["reply"])
        self.assertNotIn("reply", by_id[OPEN])

    def test_finder_sees_disposed_contracts_apart_with_the_reply(self):
        text = reviewer.format_contract_entries_for_prompt(reviewer.dispose_contracts([entry(ANSWERED), entry(OPEN)], self.threads))
        heading = text.index("# Disposed by a maintainer")
        self.assertLess(text.index(f"Finding {OPEN}"), heading)
        self.assertGreater(text.index(f"Finding {ANSWERED}"), heading)
        self.assertIn("- Maintainer reply: By design", text)
        self.assertNotIn("Disposed by a maintainer", reviewer.format_contract_entries_for_prompt([entry(OPEN)]))

    def test_repair_check_and_approval_keep_their_thread_sets(self):
        checked = reviewer.threads_to_check(self.threads, {"src/a.ts"}, [entry(OPEN)])
        self.assertEqual([item["id"] for item in checked], [OPEN])
        self.assertEqual(checked[0]["contract"], CONTRACT)
        self.assertNotIn("reply", checked[0])
        # Approval still counts every unresolved thread, answered ones included.
        unresolved = reviewer.open_dottore_threads(None, answered=True, threads=self.threads)
        self.assertEqual(sorted(item["id"] for item in unresolved), sorted([OPEN, ANSWERED, BOT_ONLY]))

class ReviewContext(unittest.TestCase):
    def test_linked_issues_come_from_closing_keywords(self):
        calls = []
        def gh(args, **kwargs):
            calls.append(args[:3])
            if args[0] == "pr":
                return NS(stdout="Title\n\nFixes #12, closes #13 and resolves #14. See #15.", stderr="", returncode=0)
            return NS(stdout=f"Issue {args[2]}\n\nAcceptance criteria.", stderr="", returncode=0)
        with patch.object(reviewer, "run_gh", gh):
            text = reviewer.pr_description("7")
        self.assertEqual([call[2] for call in calls if call[0] == "issue"], ["12", "13"])
        self.assertIn("Linked issue #12: Issue 12", text)
        self.assertNotIn("#14:", text)

    def test_unmatched_confirmation_is_counted_not_published(self):
        finding = reviewer.Finding("medium", "src/a.ts", 3, "Title", "Body", "Fix")
        with patch.object(reviewer, "evidence_grounded", lambda ctx, evidence: False):
            outcome, _, note, _ = reviewer.judge(NS(), finding, {"verdict": "confirmed", "evidence": [{"path": "src/a.ts", "line": 3}]})
        self.assertEqual(outcome, "unmatched")
        self.assertIn("did not match", note)

    def test_moved_head_is_noted_once_and_dropped_when_carried(self):
        head, moved = "1" * 40, "2" * 40
        posted = []
        def gh(args, input_text=None, **kwargs):
            if args[:2] == ["pr", "view"]:
                return NS(stdout=moved, stderr="", returncode=0)
            posted.append(input_text)
            return NS(stdout="", stderr="", returncode=0)
        with tempfile.TemporaryDirectory() as folder:
            review_md = pathlib.Path(folder, "review.md")
            inline = pathlib.Path(folder, "inline.json")
            inline.write_text("[]", "utf-8")
            body = f"<!-- dottore:walkthrough -->\n<!-- dottore:last-reviewed-sha={head} -->\nVerdict"
            review_md.write_text(body, "utf-8")
            args = NS(review_md=str(review_md), inline_json=str(inline), review_json=str(review_md))
            with patch.multiple(reviewer, run_gh=gh, latest_walkthrough_comment=lambda pr: None,
                                patch_command_status_complete=lambda *a, **k: None, load_review_for_status=lambda path: {},
                                filter_duplicate_inline_comments=lambda pr, comments: comments), \
                 patch.dict(os.environ, {"PR_NUM": "7", "GITHUB_REPOSITORY": "owner/repo"}):
                reviewer.post_review(args)
        self.assertEqual(posted[0].count("the PR head has since moved"), 1)
        self.assertIn(f"moved to {chr(96)}{moved[:8]}{chr(96)}", posted[0])
        carried = reviewer.carry_walkthrough(posted[0], moved)
        self.assertNotIn("has since moved", carried)
        self.assertIn("No new diff since", carried)

unittest.main(argv=["dottore-thread-dispositions"], verbosity=2)
`;
const result = spawnSync(python, ["-c", proof, reviewer], {
  encoding: "utf8",
  timeout: 10_000,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});
assert.equal(result.status, 0, `${result.error?.message ?? ""}\n${result.stdout}${result.stderr}`);
console.info("Dottore thread disposition regressions passed.");
