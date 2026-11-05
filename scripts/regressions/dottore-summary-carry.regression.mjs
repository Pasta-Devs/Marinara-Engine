import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// An incremental review sees only the commits since the last reviewed head; the walkthrough keeps the PR's summary.
const reviewer =
  process.argv[2] ?? fileURLToPath(new URL("../../.github/dottore-review/dottore_review.py", import.meta.url));
const python = ["python3", "python"].find(
  (command) =>
    spawnSync(command, ["-c", "import sys; sys.exit(sys.version_info < (3, 9))"], { timeout: 5_000 }).status === 0,
);
assert.ok(python, "Dottore summary regressions require Python 3.9 or newer");

const result = spawnSync(
  python,
  [
    "-c",
    String.raw`
import __future__, pathlib, sys, types
module = types.ModuleType("dottore_summary_carry")
module.__file__ = sys.argv[1]
sys.modules[module.__name__] = module
exec(compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec", flags=__future__.annotations.compiler_flag), module.__dict__)

heads = [f"{digit}" * 40 for digit in "abcdef"]
base = {"base_ref": "staging", "verification": {}, "pre_merge_checks": []}

def render(review, head):
    return module.render_walkthrough({**base, **review}, [], [], [], head)

def handed(body):
    module.latest_walkthrough_comment = lambda pr: {"body": body}
    return module.prior_walkthrough_summary("8197")

def incremental(body, lines, head):
    return render({"mode": "incremental", "change_summary": lines, "prior_summary": handed(body)}, head)

def summary(body):
    return module.walkthrough_summary(body)

full = render({"mode": "full", "change_summary": ["The PR moves imports\nto a queue.", "It also adds a retry."]}, heads[0])
assert summary(full) == ["The PR moves imports to a queue.", "It also adds a retry."], summary(full)
print("PASS full review writes the summary")

prior = handed(full)
assert prior == {"since": heads[0], "lines": summary(full)}, prior
second = incremental(full, ["The fixup renames a flag."], heads[1])
assert summary(second) == [*summary(full), "*Since \x60aaaaaaaa\x60:* The fixup renames a flag."], summary(second)
print("PASS incremental review keeps the summary and adds its own line")

body = second
for index, head in enumerate(heads[2:], start=2):
    body = incremental(body, [f"Push {index}."], head)
lines = summary(body)
assert lines[:2] == summary(full), lines
assert [line.split(":* ")[1] for line in lines[2:]] == ["Push 3.", "Push 4.", "Push 5."], lines
assert len(lines) == 2 + module.MAX_SUMMARY_UPDATES, lines
print("PASS incremental lines are capped and the full summary survives")

assert summary(incremental(full, [], heads[1])) == summary(full)
print("PASS an incremental review without a summary keeps the prior one")

assert summary(incremental(full, ["Judged what was left."], heads[0])) == summary(full)
print("PASS a rerun on the reviewed head adds no update line")

again = render({"mode": "full", "change_summary": ["A fresh look."], "prior_summary": handed(second)}, heads[2])
assert summary(again) == ["A fresh look."], summary(again)
print("PASS full review writes the summary afresh")

# What a failed review renders: its record says so, and its text is no summary of the PR.
failed = render({"mode": "full", "change_summary": ["Review Failed: provider down."], "pre_merge_checks": [{"name": "Review Failed", "status": "fail", "detail": "down"}]}, heads[0])
assert handed(failed) == {}, handed(failed)
assert summary(incremental(failed, ["Only the delta."], heads[1])) == ["Only the delta."]
print("PASS a failed walkthrough's text is not carried")

assert summary(render({"mode": "full", "change_summary": []}, heads[0])) == []
assert module.NO_SUMMARY in render({"mode": "full", "change_summary": []}, heads[0])
print("PASS an empty summary renders the placeholder and is not carried")
`,
    reviewer,
  ],
  { encoding: "utf8", timeout: 30_000 },
);
assert.equal(result.status, 0, result.stderr || result.stdout);
process.stdout.write(result.stdout);
