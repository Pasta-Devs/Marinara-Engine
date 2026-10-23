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
import pathlib, subprocess, sys, tempfile, threading, types, unittest
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
            candidates = [
                reviewer.Finding("high", "f.py", 5, "Moved", "Lines above it were added.", "fix"),
                reviewer.Finding("medium", "f.py", 8, "Rewritten", "Its line was rewritten.", "fix", packet=None),
                reviewer.Finding("low", "f.py", 2, "Judged", "The checker rejected it.", "fix"),
            ]
            def check(ctx, packet, group):
                return [("rejected" if item.title == "Judged" else "unverified", item, "", []) for item in group]
            with patch.object(reviewer, "verify_file", check), ThreadPoolExecutor(2) as pool:
                _, _, counts, unjudged = reviewer.verify_candidates(NS(), candidates, pool)
            self.assertEqual(sorted(item.title for item in unjudged), ["Moved", "Rewritten"])
            entries = [{"severity": c.severity, "path": c.path, "line": c.line, "side": c.side, "title": c.title, "body": c.body} for c in unjudged]
            partial = {"verification": counts, "unjudged_candidates": entries, "pre_merge_checks": []}
            body = reviewer.render_walkthrough(partial, [], [], [], old)
            self.assertIn(f"last-reviewed-sha={old} -->", body)
            self.assertTrue(reviewer.is_completed_review_body(body))  # so the next auto review is incremental
            none_judged = {**partial, "verification": {**counts, "rejected": 0}}
            body_none = reviewer.render_walkthrough(none_judged, [], [], [], old)
            self.assertIn("last-reviewed-sha=unrecorded", body_none)
            self.assertNotIn("dottore:unjudged=", body_none)
            with patch.object(reviewer, "latest_walkthrough_comment", lambda pr: {"body": body}), \
                    patch.object(reviewer, "REPO_ROOT", pathlib.Path(tree)):
                carried = reviewer.carried_candidates("1", old)
                self.assertEqual(reviewer.carried_candidates("1", "0" * 40), [])
            self.assertEqual(sorted((c.title, c.line, c.segment) for c in carried), [("Moved", 8, "carried"), ("Rewritten", 11, "carried")])

unittest.main(argv=["dottore-stream-progress"], verbosity=2)
`;
const result = spawnSync(python, ["-c", proof, reviewer], {
  encoding: "utf8",
  timeout: 10_000,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});
assert.equal(result.status, 0, `${result.error?.message ?? ""}\n${result.stdout}${result.stderr}`);
console.info("Dottore stream progress regressions passed.");
