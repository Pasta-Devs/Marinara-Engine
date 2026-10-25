import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const python = ["python3", "python"].find(
  (command) =>
    spawnSync(command, ["-c", "import sys; sys.exit(sys.version_info < (3, 9))"], { timeout: 5_000 }).status === 0,
);
assert.ok(python, "Dottore stream regressions require Python 3.9 or newer");
const reviewer =
  process.argv[2] ?? fileURLToPath(new URL("../../.github/dottore-review/dottore_review.py", import.meta.url));
const proof = String.raw`
from __future__ import annotations
import contextlib, io, pathlib, subprocess, sys, tempfile, threading, types, unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace as NS
from unittest.mock import patch

reviewer = types.ModuleType("dottore_stream_regression")
reviewer.__file__ = sys.argv[1]
sys.modules[reviewer.__name__] = reviewer
# Postponed annotations also let the stdlib-only proof run on macOS Python 3.9.
exec(compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec"), reviewer.__dict__)

def delta(**fields):
    return NS(delta=NS(**fields))

class StreamProgress(unittest.TestCase):
    def watch(self, schedule):
        clock = [0]
        timing = {}
        def events():
            for elapsed, event in schedule:
                clock[0] = elapsed
                yield event
        with patch.object(reviewer.time, "monotonic", lambda: clock[0]):
            events = list(reviewer.watched(events(), 0, timing, limit=600))
        return events, timing

    def test_meaningful_progress_continues_past_600_seconds(self):
        events = [
            delta(thinking="thought"),
            delta(text="text"),
            delta(partial_json='{"path":'),
            NS(choices=[NS(delta=NS(reasoning_content="thought"))]),
            NS(choices=[NS(delta=NS(content="text"))]),
            NS(choices=[NS(delta=NS(tool_calls=[NS(function=NS(arguments='{"path":'))]))]),
            NS(type="response.reasoning_summary_text.delta", delta="thought"),
            NS(type="response.output_text.delta", delta="text"),
            NS(type="response.function_call_arguments.delta", delta='{"path":'),
        ]
        for event in events:
            with self.subTest(event=event):
                received, timing = self.watch([(1, event), (599, event), (1197, event)])
                self.assertEqual(len(received), 3)
                self.assertEqual(timing["first_chunk"], 1)

    def test_pings_empty_blocks_and_metadata_do_not_refresh_progress(self):
        schedule = [
            (1, delta(thinking="x")),
            (300, NS(type="ping")),
            (400, delta(thinking="", text="", partial_json="")),
            (500, NS(choices=[NS(delta=NS(role="assistant"))])),
            (550, NS(usage=NS(output_tokens=1))),
            (602, NS(type="ping")),
        ]
        with self.assertRaisesRegex(TimeoutError, "no thinking, text or tool-input progress for 601s") as stopped:
            self.watch(schedule)
        self.assertIn("1 thinking, 0 text and 0 tool-input", str(stopped.exception))
        self.assertIn("last at 1s", str(stopped.exception))

    def test_a_late_content_event_cannot_erase_an_idle_timeout(self):
        with self.assertRaises(TimeoutError):
            self.watch([(1, delta(thinking="x")), (602, delta(thinking="late"))])

    def test_initial_ping_only_stream_still_times_out(self):
        with self.assertRaises(TimeoutError):
            self.watch([(0, NS(type="ping")), (601, NS(type="ping"))])

    def test_claude_requests_observable_summarized_thinking(self):
        captured = {}
        class MessageStream(list):
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def get_final_message(self):
                return NS(stop_reason="end_turn", content=[], usage=NS(
                    input_tokens=0, output_tokens=0, cache_read_input_tokens=0, cache_creation_input_tokens=0,
                ))
        def stream(**request):
            captured.update(request)
            return MessageStream()
        ctx = NS(clients={"large": NS(messages=NS(stream=stream))})
        settings = {"slot": "large", "model": "claude-opus-5-5", "effort": "xhigh", "max_tokens": 32000}
        modules = {
            "anthropic": NS(Timeout=lambda *args, **kwargs: None),
            "httpx2": NS(TimeoutException=TimeoutError, TransportError=OSError),
        }
        with patch.dict(sys.modules, modules):
            message, _ = reviewer.claude_reply(ctx, settings, [{"role": "user", "content": "Review."}], [], "auto", 600, 0, {}, "")
        self.assertEqual(captured["thinking"], {"type": "adaptive", "display": "summarized"})
        self.assertEqual(message.stop_reason, "end_turn")
        self.assertEqual(captured["output_config"], {"effort": "xhigh"})

    def test_provider_transport_failures_use_httpx2_without_legacy_httpx(self):
        class TransportError(Exception): pass
        def fail(**request): raise TransportError("stream disconnected")
        modules = {
            "httpx": None,
            "httpx2": NS(TimeoutException=TimeoutError, TransportError=TransportError),
            "openai": NS(Timeout=lambda *args, **kwargs: None, APIConnectionError=ConnectionError),
            "anthropic": NS(Timeout=lambda *args, **kwargs: None),
        }
        client = NS(chat=NS(completions=NS(create=fail)), responses=NS(create=fail), messages=NS(stream=fail))
        ctx = NS(clients={"large": client})
        settings = {"slot": "large", "model": "claude-opus-5-5", "effort": "xhigh", "max_tokens": 64000}
        for reply in (reviewer.openai_reply, reviewer.responses_reply, reviewer.claude_reply):
            with self.subTest(provider=reply.__name__), patch.dict(sys.modules, modules):
                with self.assertRaisesRegex(reviewer.StreamStalled, "stream disconnected"):
                    reply(ctx, settings, [{"role": "user", "content": "Review."}], [], "auto", 600, 0, {}, "")

        class DroppedStream:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def __iter__(self): raise ConnectionError("SDK-wrapped disconnect")
        def connect_failure(**request): raise ConnectionError("connection never opened")
        for create, expected in ((lambda **request: DroppedStream(), reviewer.StreamStalled), (connect_failure, ConnectionError)):
            client.chat.completions.create = client.responses.create = create
            for reply in (reviewer.openai_reply, reviewer.responses_reply):
                with self.subTest(provider=reply.__name__, error=expected), patch.dict(sys.modules, modules):
                    with self.assertRaises(expected) as stopped:
                        reply(ctx, settings, [{"role": "user", "content": "Review."}], [], "auto", 600, 0, {}, "")
                    self.assertIs(type(stopped.exception), expected)

    def test_chat_completions_reply_keeps_its_stop_reason(self):
        chunks = [
            NS(usage=None, choices=[NS(finish_reason=None, delta=NS(content="text", tool_calls=None))]),
            NS(usage=None, choices=[NS(finish_reason="length", delta=NS(content=None, tool_calls=None))]),
        ]
        message, _ = reviewer.read_stream(chunks, reviewer.time.monotonic(), {})
        self.assertEqual((message.content, message.stop_reason), ("text", "length"))

    def test_every_finder_starts_at_once_whatever_the_packet_count(self):
        barrier = threading.Barrier(7)
        def finder(ctx, role, messages, tools, **kwargs):
            barrier.wait(timeout=3)
            return {"findings": []}
        ctx = NS(packets=["packet"] * 7, system="system", deadline=reviewer.time.monotonic() + 600, cache_key="key")
        with patch.object(reviewer, "run_agent", finder), patch.object(reviewer, "finder_count", lambda: 1), \
                patch.object(reviewer, "finder_instructions", lambda ctx: "find"):
            reports = reviewer.run_finders(ctx)
        self.assertEqual([index for _, index, _ in reports], list(range(7)))

    def test_unjudged_candidates_are_recorded_and_carried_to_the_next_head(self):
        with tempfile.TemporaryDirectory() as tree:
            def git(*args):
                return subprocess.run(["git", "-C", tree, *args], check=True, capture_output=True, text=True).stdout.strip()
            git("init", "-q")
            pathlib.Path(tree, "f.py").write_text("".join(f"line {n}\n" for n in range(1, 11)))
            git("add", "f.py")
            git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "old")
            old = git("rev-parse", "HEAD")
            lines = ["new a", "new b", "new c", *(f"line {n}" for n in range(1, 11))]
            lines[10] = "line 8 rewritten"
            pathlib.Path(tree, "f.py").write_text("".join(f"{line}\n" for line in lines))
            git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "new")
            contract = {"invariant": ["The moved line is guarded."]}
            candidates = [
                reviewer.Finding("high", "f.py", 5, "Moved", "Lines above it were added.", "fix", contract),
                reviewer.Finding("medium", "f.py", 8, "Rewritten", "Its line was rewritten.", "fix", packet=None),
                reviewer.Finding("low", "f.py", 2, "Judged", "The checker rejected it.", "fix"),
                reviewer.Finding("low", "gone.py", 3, "Gone", "Its file is deleted by the next push.", "fix"),
            ]
            def check(ctx, packet, group):
                return [("rejected" if item.title == "Judged" else "unverified", item, "", []) for item in group]
            with patch.object(reviewer, "verify_file", check), ThreadPoolExecutor(2) as pool:
                _, _, counts, unjudged = reviewer.verify_candidates(NS(), candidates, pool)
            self.assertEqual(sorted(item.title for item in unjudged), ["Gone", "Moved", "Rewritten"])
            entries = reviewer.unjudged_entries(unjudged)
            partial = {"verification": counts, "unjudged_candidates": entries, "pre_merge_checks": []}
            body = reviewer.render_walkthrough(partial, [], [], [], old)
            self.assertIn(f"last-reviewed-sha={old} -->", body)
            self.assertTrue(reviewer.is_completed_review_body(body))  # so the next auto review is incremental
            none_judged = {**partial, "verification": {**counts, "rejected": 0}}
            body_none = reviewer.render_walkthrough(none_judged, [], [], [], old)
            self.assertIn("last-reviewed-sha=unrecorded", body_none)
            self.assertNotIn("dottore:unjudged=", body_none)
            # A removed line is numbered in this examination's old file, so leaving one unjudged leaves the head unrecorded.
            removed = {**partial, "unjudged_candidates": [*entries, {**entries[0], "side": "LEFT"}]}
            self.assertIn("last-reviewed-sha=unrecorded", reviewer.render_walkthrough(removed, [], [], [], old))
            # A failed review posted after the recorded one does not hide the candidates of the head the base comes from.
            walkthroughs = [{"body": body}, {"body": body_none}]
            out = io.StringIO()
            with patch.object(reviewer, "sorted_walkthrough_comments", lambda pr: walkthroughs), \
                    patch.object(reviewer, "REPO_ROOT", pathlib.Path(tree)), contextlib.redirect_stdout(out):
                carried = reviewer.carried_candidates("1", old)
                self.assertEqual(reviewer.carried_candidates("1", "0" * 40), [])
            self.assertEqual(out.getvalue().count("Dottore carried:"), 1)
            self.assertIn(f"Dottore carried: candidates=2; dropped=1; from={old[:12]}", out.getvalue())
            self.assertEqual(sorted((c.title, c.line, c.segment) for c in carried), [("Moved", 8, "carried"), ("Rewritten", 11, "carried")])
            moved = next(c for c in carried if c.title == "Moved")
            self.assertEqual((moved.fix_hint, moved.repair_contract), ("fix", contract))
            # Confirmed without new prose, the carried candidate is published with its repair.
            verdict = {"verdict": "confirmed", "evidence": [{"path": "f.py", "line": 8, "snippet": "line 5"}]}
            with patch.object(reviewer, "evidence_grounded", lambda ctx, evidence: True):
                outcome, finding, _, _ = reviewer.judge(NS(anchorable={}), moved, verdict)
            self.assertEqual((outcome, finding.fix_hint, finding.repair_contract), ("confirmed", "fix", contract))

    def test_confirmed_carried_finding_survives_incremental_publication(self):
        full = {"f.py": {"RIGHT": {10, 20}, "LEFT": set()}}
        incremental = {"f.py": {"RIGHT": {20}, "LEFT": set()}}
        candidate = reviewer.Finding("low", "f.py", 10, "Carried defect", "Still broken.", "Fix it", segment="carried")
        with patch.object(reviewer, "evidence_grounded", return_value=True):
            outcome, finding, _, _ = reviewer.judge(NS(anchorable=full), candidate, {"verdict": "confirmed"})
        self.assertEqual((outcome, finding.outside_diff), ("confirmed", False))
        report = {
            "mode": "incremental", "base_ref": "staging", "review_base": "previous", "head_sha": "a" * 40,
            "findings": [reviewer.dataclasses.asdict(finding)],
            "nitpicks": [{"path": "f.py", "line": 10, "title": "Old note", "body": "Not newly changed."}],
        }
        with tempfile.TemporaryDirectory() as tree, \
                patch.object(reviewer, "git_out", return_value="full-pr"), \
                patch.object(reviewer, "touched_lines", side_effect=lambda base: full if base == "full-pr" else incremental):
            # New, unverified finder output and nitpicks remain limited to this increment.
            fresh, _, invalid = reviewer.validate_review_items(report, "previous")
            self.assertEqual(fresh, [])
            self.assertTrue(invalid)
            previous_dir = reviewer.os.getcwd()
            try:
                reviewer.os.chdir(tree)
                pathlib.Path("review.json").write_text(reviewer.json.dumps(report))
                reviewer.render_review(NS(review_json="review.json", base=None, mode=None))
                published = reviewer.json.loads(pathlib.Path("review.json").read_text())["published"]
                inline = reviewer.json.loads(pathlib.Path("inline-comments.json").read_text())
                self.assertEqual(published, {"defects": 1, "notes": 0, "verdict": "Repair Required"})
                self.assertEqual([(item["path"], item["line"]) for item in inline], [("f.py", 10)])
                self.assertIn("Carried defect", pathlib.Path("review.md").read_text())
                # A carried file can also be absent from the entire incremental diff.
                with patch.object(reviewer, "touched_lines", side_effect=lambda base: full if base == "full-pr" else {"g.py": {"RIGHT": {20}, "LEFT": set()}}):
                    kept, _, _ = reviewer.validate_review_items(report, "previous", outside_ok=True)
                self.assertEqual([(item.path, item.line) for item in kept], [("f.py", 10)])
            finally:
                reviewer.os.chdir(previous_dir)

    def test_failed_finder_settles_active_work_and_cancels_queued_work(self):
        active = threading.Event()
        release = threading.Event()
        shutdown = threading.Event()
        returned = threading.Event()
        completed = threading.Event()
        calls = []
        futures = []
        errors = []
        lock = threading.Lock()
        class TrackedPool(ThreadPoolExecutor):
            def submit(self, *args, **kwargs):
                future = super().submit(*args, **kwargs)
                futures.append(future)
                return future
            def shutdown(self, *args, **kwargs):
                shutdown.set()
                return super().shutdown(*args, **kwargs)
        deadline = reviewer.time.monotonic() + 600
        def finder(*args, **kwargs):
            with lock:
                index = len(calls)
                calls.append(kwargs["deadline"])
            if index == 0:
                if not active.wait(3): raise RuntimeError("Fixture worker did not start")
                raise RuntimeError("First finder failed")
            active.set()
            if not release.wait(3): raise RuntimeError("Fixture worker was not released")
            completed.set()
            return {"findings": []}
        def run():
            try:
                reviewer.run_finders(NS(packets=["packet"], system="system", deadline=deadline, cache_key="key"))
            except Exception as error:
                errors.append(str(error))
            finally:
                returned.set()
        with patch.object(reviewer, "ThreadPoolExecutor", TrackedPool), \
                patch.object(reviewer, "MAX_CONCURRENCY", 2), patch.object(reviewer, "CACHE_STAGGER_SECONDS", 0), \
                patch.object(reviewer, "run_agent", finder), patch.object(reviewer, "finder_count", return_value=4), \
                patch.object(reviewer, "finder_instructions", return_value="find"):
            thread = threading.Thread(target=run)
            thread.start()
            try:
                self.assertTrue(shutdown.wait(3))
                self.assertFalse(returned.wait(0.05), "failure escaped while a finder was still active")
                self.assertFalse(completed.is_set())
            finally:
                release.set()
                thread.join(3)
            self.assertFalse(thread.is_alive())
        self.assertEqual(errors, ["First finder failed"])
        self.assertTrue(completed.is_set())
        self.assertTrue(any(future.cancelled() for future in futures))
        self.assertTrue(all(future.done() for future in futures))
        self.assertTrue(all(value == deadline - reviewer.CHECKER_RESERVE_SECONDS for value in calls))

    def test_carried_entries_mark_a_cut_body_and_fit_their_budget(self):
        contract = {key: ["y" * 400] * 5 for key in ("invariant", "related_failure_paths", "adjacent_traps", "acceptable_fix_shapes", "expected_proof")}
        candidates = [reviewer.Finding("low", "f.py", n, "T", "x" * 700, "fix", contract) for n in range(1, reviewer.MAX_VERIFIED_CANDIDATES + 1)]
        entries = reviewer.unjudged_entries(candidates)
        self.assertEqual((len(entries[0]["body"]), entries[0]["body"][-1]), (reviewer.MAX_CARRIED_TEXT_CHARS, "…"))
        self.assertLessEqual(len(reviewer.json.dumps(entries, separators=(",", ":"))), reviewer.MAX_CARRIED_MARKER_CHARS)
        self.assertIsNotNone(entries[0]["repair_contract"])
        self.assertIsNone(entries[-1]["repair_contract"])
        # The 19 a recorded examination can leave fit at full length; text that escapes heavily is not carried.
        path = "packages/server/src/services/some/deeply/nested/module/file-name-of-typical-length.ts"
        full = [reviewer.Finding("low", path, 1234, "t" * 300, "b" * 900, "h" * 400, contract) for _ in range(reviewer.MAX_VERIFIED_CANDIDATES - 1)]
        self.assertEqual(len(reviewer.unjudged_entries(full)), reviewer.MAX_VERIFIED_CANDIDATES - 1)
        escaped = [reviewer.Finding("low", path, 1234, "é" * 300, "é" * 900, "é" * 400) for _ in range(reviewer.MAX_VERIFIED_CANDIDATES - 1)]
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(reviewer.unjudged_entries(escaped), [])
        self.assertIn("Dottore unjudged: 19 candidates need", out.getvalue())
        overrun = {"verification": {"rejected": 1, "unverified": 19}, "unjudged_candidates": [], "pre_merge_checks": []}
        self.assertIn("last-reviewed-sha=unrecorded", reviewer.render_walkthrough(overrun, [], [], [], "a" * 40))

    def test_carried_candidates_take_their_place_by_severity_under_the_cap(self):
        carried = [reviewer.Finding("low", "f.py", n, f"Carried {n}", "body", "fix") for n in range(1, reviewer.MAX_VERIFIED_CANDIDATES + 1)]
        fresh = reviewer.Finding("high", "f.py", 99, "Fresh", "body", "fix")
        judged = []
        def check(ctx, packet, group):
            judged.extend(item.title for item in group)
            return [("rejected", item, "", []) for item in group]
        ctx = NS(chunks=[["f.py"]], stats={}, base="base")
        with patch.object(reviewer, "scout_bundles", lambda ctx, pool: (0, 0)), \
                patch.object(reviewer, "check_threads", lambda ctx, threads, pool: lambda: []), \
                patch.object(reviewer, "run_finders", lambda ctx: []), \
                patch.object(reviewer, "validate_review_items", lambda review, base: ([fresh], [], [])), \
                patch.object(reviewer, "verify_file", check), ThreadPoolExecutor(2) as pool:
            review = reviewer.agentic_review(ctx, "incremental", pool, carried=carried)
        self.assertIn("Fresh", judged)
        self.assertNotIn(f"Carried {reviewer.MAX_VERIFIED_CANDIDATES}", judged)
        self.assertEqual(review["verification"]["capped"], 1)

unittest.main(argv=["dottore-stream-progress"], verbosity=2)
`;
const result = spawnSync(python, ["-c", proof, reviewer], {
  encoding: "utf8",
  timeout: 10_000,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});
assert.equal(result.status, 0, `${result.error?.message ?? ""}\n${result.stdout}${result.stderr}`);
console.info("Dottore stream progress regressions passed.");
