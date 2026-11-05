import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const python = ["python3", "python"].find(
  (command) =>
    spawnSync(command, ["-c", "import sys; sys.exit(sys.version_info < (3, 9))"], { timeout: 5_000 }).status === 0,
);
assert.ok(python, "Dottore comment shape regressions require Python 3.9 or newer");
const reviewer = fileURLToPath(new URL("../../.github/dottore-review/dottore_review.py", import.meta.url));
const proof = String.raw`
from __future__ import annotations
import json, pathlib, re, sys, types, unittest
from unittest.mock import patch

reviewer = types.ModuleType("dottore_comment_shape_regression")
reviewer.__file__ = sys.argv[1]
sys.modules[reviewer.__name__] = reviewer
exec(compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec"), reviewer.__dict__)

HEAD = "f" * 40
CONTRACT = {"acceptable_fix_shapes": ["Clamp the index in selectSwipe."], "expected_proof": ["A regression that deletes the last swipe."]}

def finding(severity="medium", path="src/a.ts", line=40, title="Swipe index outlives the deleted swipe", body=None, **extra):
    return reviewer.Finding(
        severity=severity, path=path, line=line, title=title,
        body=body or "Deleting the selected swipe leaves activeSwipeIndex past the end. The next render reads undefined.",
        fix_hint="Clamp activeSwipeIndex to swipes.length - 1 in deleteSwipe.", repair_contract=CONTRACT,
        lead="Deleting the last swipe leaves the index past the end.", quip="The subject forgets its own limbs. Fascinating.",
        **extra,
    )

class CommentShape(unittest.TestCase):
    def test_a_long_finding_trims_only_its_details(self):
        long = finding(body="Cause and effect. " * 400)
        text = reviewer.render_finding_body(long)
        self.assertLessEqual(len(text), reviewer.MAX_INLINE_COMMENT_CHARS)
        self.assertNotIn("[truncated:", text)
        visible, _, rest = text.partition("<details>")
        for part in (long.lead, "**Suggested fix:** " + long.fix_hint, "> *" + long.quip + "*"):
            self.assertIn(part, visible)
        self.assertIn("…", rest)
        self.assertIn("</details>", rest)
        self.assertTrue(text.endswith(reviewer.THREAD_FOOTER))

    def test_the_heading_still_parses_for_the_repair_check(self):
        heading = re.search(r"### .*?\b(?:BLOCKING|HIGH|MEDIUM|LOW):\s*(.+)", reviewer.render_finding_body(finding()))
        self.assertEqual(heading.group(1).strip(), "Swipe index outlives the deleted swipe")

    def test_viable_with_notes_is_a_green_box_with_collapsed_notes(self):
        note = finding(severity="nit", title="Rename the helper")
        review = {"change_summary": ["Adds swipe deletion."], "summary_quip": "A modest procedure.",
                  "pre_merge_checks": [{"name": "Docs", "status": "warn", "detail": "No doc change."}]}
        text = reviewer.render_walkthrough(review, [], [note], [], HEAD)
        self.assertIn("> [!TIP]", text)
        self.assertIn("nothing is required before merge", text)
        self.assertNotIn("below;", text)
        self.assertNotIn("### 🔎 Defects", text)
        self.assertIn("> *A modest procedure.*", text)
        notes = text.split("<summary>Review notes</summary>", 1)[1]
        self.assertIn("**Control checks**", notes.split("</details>", 1)[0])

    def test_a_nearby_defect_follows_up_in_the_thread_it_continues(self):
        repaired = {"id": "a" * 16, "thread_id": "T_a", "comment_id": 11, "verdict": "resolved", "path": "src/a.ts",
                    "side": "RIGHT", "line": 25, "anchored": True, "note": "the index is clamped"}
        near, elsewhere = finding(line=40), finding(path="src/b.ts", line=26)
        again = finding(line=26)
        repairs = [
            repaired,
            # A thread holding an earlier finding raised again: neither is a follow-up of the other.
            {**repaired, "id": "b" * 16, "ids": [reviewer.finding_id(again), "b" * 16], "thread_id": "T_b", "comment_id": 12},
        ]
        matches = reviewer.follow_up_threads([near, elsewhere, again], repairs, lambda path: [])
        self.assertEqual([(m["finding_id"], m["comment_id"]) for m in matches], [(reviewer.finding_id(near), 11)])
        # A still-open thread keeps judging its own finding, and an outdated one's line is an old commit's.
        for other in ({"verdict": "still_open"}, {"anchored": False}):
            self.assertEqual(reviewer.follow_up_threads([near], [{**repaired, **other}], lambda path: []), [])
        intro = reviewer.follow_up_intro(matches[0], near, HEAD)
        self.assertIn("on " + chr(96) + "src/a.ts:40" + chr(96) + ": the original issue is fixed (the index is clamped); this remains:", intro)
        body = reviewer.render_finding_body(near, intro)
        standalone = reviewer.FOLLOW_UP_INTRO_RE.sub(r"\1", body, count=1)
        self.assertNotIn("Follow-up at", standalone)
        self.assertEqual(standalone, reviewer.render_finding_body(near))

    def test_autofix_names_each_thread_location(self):
        thread = {"path": "src/a.ts", "line": None, "original_line": 25, "body": reviewer.render_finding_body(finding())}
        self.assertIn("Thread at " + chr(96) + "src/a.ts:25" + chr(96) + ".", reviewer.autofix_task([thread]))

    def test_the_repair_prompt_tells_an_agent_to_verify_first(self):
        text = reviewer.render_agent_prompt_details([finding()], [])
        prompt = text.split(chr(96) * 3, 1)[1].split("\n", 1)[1]
        self.assertTrue(prompt.startswith(reviewer.VERIFY_FIRST.splitlines()[0]))
        self.assertIn("What breaks: Deleting the last swipe leaves the index past the end.", prompt)

    def test_a_rewritten_finding_takes_only_the_checker_quip(self):
        ctx = types.SimpleNamespace(anchorable={})
        rewrite = {"verdict": "confirmed", "title": "Index read past the end", "body": "selectSwipe reads swipes[length]."}
        with patch.object(reviewer, "evidence_grounded", lambda ctx, evidence: True):
            _, rewritten, _, _ = reviewer.judge(ctx, finding(), rewrite)
            _, kept, _, _ = reviewer.judge(ctx, finding(), {"verdict": "confirmed"})
            _, quoted, _, _ = reviewer.judge(ctx, finding(), {"verdict": "confirmed", "quip": "A new data point."})
            carried = reviewer.normalize_review_item(reviewer.unjudged_entries([finding()])[0], default_severity="medium")
            _, revived, _, _ = reviewer.judge(ctx, carried, {"verdict": "confirmed", "quip": "It returns. Splendid."})
        self.assertEqual(rewritten.quip, "")
        self.assertNotIn("> *", reviewer.render_finding_body(rewritten))
        self.assertEqual(kept.quip, finding().quip)
        self.assertEqual((quoted.quip, revived.quip), ("A new data point.", "It returns. Splendid."))

    def test_nineteen_maximal_candidates_are_carried(self):
        big = reviewer.dataclasses.replace(
            finding(path="packages/server/src/routes/" + "m" * 40 + ".ts", line=12345, title="t" * 400, body="b" * 2000),
            fix_hint="f" * 400, lead="l" * 400, quip="q" * 800,
        )
        entries = reviewer.unjudged_entries([big] * 19)
        self.assertEqual(len(entries), 19)
        # The last candidate gives up its lead first and leads with its body instead.
        carried = reviewer.normalize_review_item(entries[-1], default_severity="medium")
        self.assertEqual(carried.quip, "")
        self.assertTrue(reviewer.finding_lead(carried).startswith("b"))

    def test_a_thread_holding_a_finding_raised_again_stays_open(self):
        thread = {"id": "b" * 16, "ids": ["a" * 16, "b" * 16], "thread_id": "T_1", "verdict": "resolved"}
        self.assertEqual(reviewer.repaired_threads([thread], {"a" * 16}, set()), [])
        self.assertEqual(reviewer.repaired_threads([thread], set(), set()), [thread])

    def test_a_thread_is_judged_by_its_latest_finding(self):
        bot = {"__typename": "Bot", "login": "github-actions"}
        comments = [{"databaseId": 1, "body": "### MEDIUM: first\n<!-- dottore:finding=" + "a" * 16 + " -->", "author": bot},
                    {"databaseId": 2, "body": "Follow-up\n### LOW: second\n<!-- dottore:finding=" + "b" * 16 + " -->", "author": bot}]
        node = {"id": "T_1", "isResolved": False, "path": "src/a.ts", "line": 3, "diffSide": "RIGHT", "comments": {"nodes": comments}}
        payload = json.dumps({"data": {"repository": {"pullRequest": {"reviewThreads": {"nodes": [node]}}}}})
        gh = lambda args, **kwargs: types.SimpleNamespace(stdout=payload, stderr="", returncode=0)
        with patch.multiple(reviewer, run_gh=gh), patch.dict("os.environ", {"GITHUB_REPOSITORY": "owner/repo"}):
            [thread] = reviewer.dottore_threads("1")
        self.assertEqual((thread["id"], thread["comment_id"], thread["ids"]), ("b" * 16, 1, ["a" * 16, "b" * 16]))
        self.assertIn("second", thread["body"])

unittest.main(argv=["dottore-comment-shape"], verbosity=2)
`;
const result = spawnSync(python, ["-c", proof, reviewer], {
  encoding: "utf8",
  timeout: 10_000,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONUTF8: "1" },
});
assert.equal(result.status, 0, `${result.error?.message ?? ""}\n${result.stdout}${result.stderr}`);
console.info("Dottore comment shape regressions passed.");
