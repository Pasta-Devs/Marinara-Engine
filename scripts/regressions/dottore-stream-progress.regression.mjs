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
from collections import defaultdict
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

    def test_an_empty_max_tokens_reply_is_resent_at_the_same_effort(self):
        submit = {"type": "function", "function": {"name": "submit", "description": "Submit.", "parameters": {"type": "object"}}}
        def usage(output):
            return NS(input_tokens=19248, output_tokens=output, cache_read_input_tokens=0, cache_creation_input_tokens=0)
        empty = NS(stop_reason="max_tokens", content=[], usage=usage(0))
        thought = {"type": "thinking", "thinking": "x" * 100, "signature": "s"}
        spent = NS(stop_reason="max_tokens", content=[NS(type="thinking", model_dump=lambda **kwargs: thought)], usage=usage(64000))
        done = NS(stop_reason="tool_use", content=[NS(type="tool_use", id="t", name="submit", input={"findings": []})], usage=usage(50))
        # 996 s is the finder's deadline (the review's less the checker's reserve) from its start in run 41931881745.
        def run(*replies, role="finder", tool=submit, keep=None, deadline=996, cost_limit=0, cache_key="", prompt="Review.", **limits):
            replies = list(replies)
            # Time passes in the waits and in a reply given as (seconds, reply), so each limit is met exactly.
            clock = [0]
            seen = NS(efforts=[], waits=[], out=io.StringIO(), result=None, error=None)
            def sleep(wait):
                seen.waits.append(wait)
                clock[0] += wait
            class MessageStream(list):
                def __enter__(self): return self
                def __exit__(self, *args): return False
                def get_final_message(self):
                    seconds, reply = replies.pop(0) if isinstance(replies[0], tuple) else (0, replies.pop(0))
                    clock[0] += seconds
                    if isinstance(reply, Exception):
                        raise reply
                    return reply
            def stream(**request):
                seen.efforts.append(request["output_config"]["effort"])
                return MessageStream()
            settings = {"slot": "large", "model": "claude-sonnet-5-5", "api": "anthropic", "effort": "xhigh",
                        "max_tokens": 64000, "reads": 0, "chars": 0, "minutes": 10, **limits}
            seen.ctx = NS(clients={"large": NS(messages=NS(stream=stream))}, models={role: settings}, failures={},
                          lock=threading.Lock(), cost_limit=cost_limit, spent_usd=0.0, deadline=deadline,
                          stats={"roles": {role: defaultdict(int)}})
            seen.totals = seen.ctx.stats["roles"][role]
            modules = {"anthropic": NS(Timeout=lambda *args, **kwargs: None), "httpx2": NS(TimeoutException=TimeoutError, TransportError=OSError)}
            try:
                with patch.dict(sys.modules, modules), patch.object(reviewer.time, "monotonic", lambda: clock[0]), \
                        patch.object(reviewer.time, "sleep", sleep), patch.object(reviewer, "run_tool", lambda *args: "code"), \
                        contextlib.redirect_stdout(seen.out):
                    seen.result = reviewer.run_agent(seen.ctx, role, [{"role": "user", "content": prompt}], tool, cache_key=cache_key, keep=keep)
            except Exception as error:
                seen.error = error
            return seen
        # Each empty reply still billed its 19248 prompt tokens, so the cost limit and telemetry count every reply.
        one = reviewer.call_cost_usd("claude-sonnet-5-5", {"prompt_tokens": 19248})
        written = reviewer.call_cost_usd("claude-sonnet-5-5", {"completion_tokens": 50})
        self.assertEqual((reviewer.RETRY_DELAYS, reviewer.EMPTY_REPLY_DELAYS), ((15, 45), (15, 45, 90, 120)))
        # This request's spread lengthens the 15, 45, 90 and 120 s waits by up to a third, to these.
        waits = [19, 55, 117, 132]
        with self.subTest("an empty reply is resent after the transient-error wait, at the same effort"):
            seen = run(empty, done)
            self.assertEqual((seen.result, seen.efforts, seen.waits, seen.ctx.failures), ({"findings": []}, ["xhigh", "xhigh"], waits[:1], {"finder": 0}))
            self.assertIn("before Claude wrote anything", seen.out.getvalue())
            self.assertEqual((seen.totals["model_calls"], seen.totals["prompt_tokens"], seen.totals["completion_tokens"]), (2, 2 * 19248, 50))
            self.assertAlmostEqual(seen.ctx.spent_usd, 2 * one + written)
        with self.subTest("a reply that spent its cap thinking still goes down a level"):
            seen = run(spent, done)
            self.assertEqual((seen.result, seen.efforts, seen.waits), ({"findings": []}, ["xhigh", "high"], []))
            self.assertIn("output cap at effort xhigh; retrying once at high", seen.out.getvalue())
        # Run 41931881745's packet 0 finder: empty after 8 s and 50 s, then thinking to its cap for 480 s, about 2 s
        # inside its 600 s box; after this request's longer waits the cap comes 12 s past it. The time chat lost to the
        # gateway does not count against the box, so the reply still goes down a level, as does one capped after a
        # third empty reply and the first longer resend.
        for label, failed in (("two", [(8, empty), (50, empty)]), ("three", [(50, empty)] * 3)):
            with self.subTest(f"a reply capped after {label} empty replies still goes down a level"):
                seen = run(*failed, (480, spent), done)
                self.assertEqual((seen.result, seen.efforts, seen.waits), ({"findings": []}, ["xhigh"] * (len(failed) + 1) + ["high"], waits[: len(failed)]))
                self.assertIn("output cap at effort xhigh; retrying once at high", seen.out.getvalue())
        with self.subTest("a stall is resent at once, MODEL_MAX_RETRIES times"):
            seen = run(reviewer.StreamStalled("dropped"), done)
            self.assertEqual((seen.result, seen.waits, seen.ctx.failures), ({"findings": []}, [0], {"finder": 0}))
            seen = run(reviewer.StreamStalled("dropped"), reviewer.StreamStalled("dropped"), done)
            self.assertEqual((type(seen.error), seen.waits, seen.ctx.failures), (reviewer.StreamStalled, [0], {"finder": 1}))
        with self.subTest("a burst of four empty replies, past the old three-attempt limit, still ends in a reply"):
            seen = run(empty, empty, empty, empty, done)
            self.assertEqual((seen.result, seen.efforts, seen.waits, seen.ctx.failures), ({"findings": []}, ["xhigh"] * 5, waits, {"finder": 0}))
            self.assertEqual((seen.totals["model_calls"], seen.totals["prompt_tokens"], seen.totals["completion_tokens"]), (5, 5 * 19248, 50))
            self.assertAlmostEqual(seen.ctx.spent_usd, 5 * one + written)
        with self.subTest("empty on all five attempts, the call fails once as a gateway failure, not a spent cap"):
            seen = run(empty, empty, empty, empty, empty, done)
            self.assertRegex(reviewer.error_text(seen.error), "^ResponseFailed: .*max_tokens before Claude wrote anything")
            self.assertTrue(reviewer.transient_error(seen.error))
            self.assertEqual((seen.efforts, seen.waits, seen.ctx.failures), (["xhigh"] * 5, waits, {"finder": 1}))
            self.assertEqual((seen.totals["model_calls"], seen.totals["prompt_tokens"]), (5, 5 * 19248))
            self.assertAlmostEqual(seen.ctx.spent_usd, 5 * one)
        # A longer resend is sent only while the resent reply still has the role's whole box before the role's
        # deadline, and bills a prompt only under the cost limit. The RETRY_DELAYS resends are every transient
        # error's, so a call already past its deadline (a forced submission) or the cost limit still gets them.
        for label, limits, kept in (
            ("the fifth attempt would have 577 s of its 600 s box before a 900 s deadline", {"deadline": 900}, 3),
            ("with a 4-minute box, the fifth would have 177 s of it before a 500 s deadline", {"minutes": 4, "deadline": 500}, 3),
            ("the deadline had passed before the call, as for a forced submission", {"deadline": -1}, 2),
            ("three empty replies reached the cost limit", {"cost_limit": 2.5 * one}, 2),
            ("the first empty reply reached the cost limit, which stops only the longer resends", {"cost_limit": 0.5 * one}, 2),
        ):
            with self.subTest(f"a longer resend the review cannot afford fails at once: {label}"):
                seen = run(empty, empty, empty, empty, empty, done, **limits)
                self.assertIsInstance(seen.error, reviewer.ResponseFailed)
                self.assertEqual((seen.waits, seen.ctx.failures, seen.totals["model_calls"]), (waits[:kept], {"finder": 1}, kept + 1))
                self.assertAlmostEqual(seen.ctx.spent_usd, (kept + 1) * one)
        with self.subTest("a longer resend is not sent when its reply could not finish before the deadline"):
            # After four 50 s empty replies, the fifth attempt would start 473 s before a 996 s deadline.
            seen = run(*[(50, empty)] * 4, (480, done), done)
            self.assertIsInstance(seen.error, reviewer.ResponseFailed)
            self.assertEqual((seen.waits, seen.ctx.failures, seen.totals["model_calls"]), (waits[:3], {"finder": 1}, 4))
        with self.subTest("other gateway failures keep the RETRY_DELAYS resends, and one that will not change fails at once"):
            overloaded = [reviewer.ResponseFailed("overloaded", "server_error") for _ in range(3)]
            seen = run(*overloaded, done)
            self.assertEqual((type(seen.error), seen.waits, seen.ctx.failures, seen.totals["model_calls"]), (reviewer.ResponseFailed, waits[:2], {"finder": 1}, 0))
            seen = run(reviewer.ResponseFailed("invalid prompt", "invalid_prompt"), done)
            self.assertEqual((type(seen.error), seen.waits, seen.ctx.failures), (reviewer.ResponseFailed, [], {"finder": 1}))
        with self.subTest("calls that fail together resend apart, by a spread each request fixes"):
            # The finders on two packets share the prompt but not the cache key; a packet's scouts share the key
            # but not their share.
            finders = [run(empty, done, cache_key=f"dottore-pr-p{index}").waits for index in (0, 1)]
            scouts = [run(empty, done, role="scout", cache_key="dottore-pr-s0", prompt=f"Gather for {name}.").waits for name in "ab"]
            self.assertEqual((finders, scouts), ([[16], [20]], [[18], [20]]))
            self.assertEqual(run(empty, done, cache_key="dottore-pr-p0").waits, [16])
        keep_places = {"type": "function", "function": {"name": "keep_places", "description": "Keep.", "parameters": {"type": "object"}}}
        place = {"path": "a.py", "start": 1, "end": 2, "why": "caller"}
        read = NS(stop_reason="tool_use", usage=usage(50), content=[
            NS(type="tool_use", id="r", name="read_file", input={"path": "a.py"}),
            NS(type="tool_use", id="k", name="keep_places", input={"places": [place]}),
        ])
        with self.subTest("a keep run whose later call fails on every resend ends with what it kept"):
            seen = run(read, *[empty] * 5, role="scout", tool=keep_places, keep="places", reads=10, chars=100000, max_tokens=16000)
            self.assertEqual((seen.error, seen.result), (None, {"places": [place]}))
            self.assertEqual((seen.efforts, seen.waits, seen.totals["stop_error"]), (["xhigh"] * 6, [17, 51, 113, 120], 1))
            self.assertIn("scout call failed; ending with the 1 kept: ResponseFailed", seen.out.getvalue())
        with self.subTest("a keep run that has kept nothing still fails"):
            seen = run(*[empty] * 5, role="scout", tool=keep_places, keep="places", reads=10, chars=100000, max_tokens=16000)
            self.assertIsInstance(seen.error, reviewer.ResponseFailed)

    def test_an_empty_incomplete_response_is_resent_unless_filtered(self):
        def reply(reason, output, items=()):
            response = NS(output=list(items), usage=NS(input_tokens=10, output_tokens=output),
                          incomplete_details=NS(reason=reason), status="incomplete")
            class Stream(list):
                def __enter__(self): return self
                def __exit__(self, *args): return False
            client = NS(responses=NS(create=lambda **request: Stream([NS(type="response.incomplete", response=response)])))
            modules = {"openai": NS(Timeout=lambda *args, **kwargs: None, APIConnectionError=ConnectionError),
                       "httpx2": NS(TimeoutException=TimeoutError, TransportError=OSError)}
            settings = {"slot": "large", "model": "gpt-5.6-sol", "effort": "xhigh", "max_tokens": 0}
            with patch.dict(sys.modules, modules):
                return reviewer.responses_reply(NS(clients={"large": client}), settings, [{"role": "user", "content": "Review."}], [], "auto", 600, 0, {}, "")
        # A response cut short before any output is resent like a failure without a code; a filter stops every resend.
        for reason, code in (("max_output_tokens", ""), (None, ""), ("content_filter", "content_filter")):
            with self.subTest(reason=reason):
                with self.assertRaisesRegex(reviewer.ResponseFailed, "before the model wrote anything") as stopped:
                    reply(reason, 0)
                self.assertEqual((stopped.exception.code, reviewer.transient_error(stopped.exception)), (code, not code))
                self.assertEqual(stopped.exception.usage["prompt_tokens"], 10)
        message, _ = reply("max_output_tokens", 64000, [NS(type="reasoning", encrypted_content=None)])
        self.assertEqual((message.capped, message.stop_reason), (True, "max_output_tokens"))

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
