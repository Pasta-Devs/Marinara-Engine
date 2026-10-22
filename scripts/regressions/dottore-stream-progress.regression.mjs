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
import pathlib, sys, types, unittest
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
            reviewer.claude_reply(ctx, settings, [{"role": "user", "content": "Review."}], [], "auto", 600, 0, {}, "")
        self.assertEqual(captured["thinking"], {"type": "adaptive", "display": "summarized"})
        self.assertEqual(captured["output_config"], {"effort": "xhigh"})

unittest.main(argv=["dottore-stream-progress"], verbosity=2)
`;
const result = spawnSync(python, ["-c", proof, reviewer], {
  encoding: "utf8",
  timeout: 10_000,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});
assert.equal(result.status, 0, `${result.error?.message ?? ""}\n${result.stdout}${result.stderr}`);
console.info("Dottore stream progress regressions passed.");
