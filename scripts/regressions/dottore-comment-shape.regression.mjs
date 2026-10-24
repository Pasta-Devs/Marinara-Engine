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
        self.assertNotIn("### 🔎 Defects", text)
        self.assertIn("> *A modest procedure.*", text)
        notes = text.split("<summary>Review notes</summary>", 1)[1]
        self.assertIn("**Control checks**", notes.split("</details>", 1)[0])

    def test_a_nearby_defect_follows_up_in_the_thread_it_continues(self):
        repairs = [{"id": "a" * 16, "thread_id": "T_a", "comment_id": 11, "verdict": "resolved", "path": "src/a.ts",
                    "side": "RIGHT", "line": 25, "note": "the index is clamped"}]
        near, elsewhere = finding(line=40), finding(path="src/b.ts", line=26)
        again = finding(line=26)
        repairs.append({**repairs[0], "id": reviewer.finding_id(again), "thread_id": "T_b", "comment_id": 12})
        matches = reviewer.follow_up_threads([near, elsewhere, again], repairs, lambda path: [])
        self.assertEqual([(m["finding_id"], m["comment_id"]) for m in matches], [(reviewer.finding_id(near), 11)])
        intro = reviewer.follow_up_intro(matches[0], HEAD)
        self.assertIn("the original issue is fixed (the index is clamped); this remains:", intro)

    def test_the_repair_prompt_tells_an_agent_to_verify_first(self):
        text = reviewer.render_agent_prompt_details([finding()], [])
        prompt = text.split(chr(96) * 3, 1)[1].split("\n", 1)[1]
        self.assertTrue(prompt.startswith(reviewer.VERIFY_FIRST.splitlines()[0]))
        self.assertIn("What breaks: Deleting the last swipe leaves the index past the end.", prompt)

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
