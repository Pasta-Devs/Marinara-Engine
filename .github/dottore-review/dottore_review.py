# .github/dottore-review/dottore_review.py
import argparse
import base64
import dataclasses
import fnmatch
import hashlib
import itertools
import json
import os
import pathlib
import posixpath
import re
import shutil
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from types import SimpleNamespace

REPO_ROOT = pathlib.Path.cwd().resolve()
DOTTORE_MARKER = "<!-- dottore:walkthrough -->"
# Dottore posts with the workflow's GITHUB_TOKEN; a comment from anyone else carrying its markers is not its own.
DOTTORE_LOGIN = "github-actions[bot]"
# Written into the walkthrough when the examined head's verdict is Viable, so approval reads the verdict, not prose.
DISCHARGE_MARKER = "<!-- dottore:discharge -->"
COMMAND_STATUS_MARKER = "<!-- dottore:command-status -->"
AUTOFIX_MARKER = "<!-- dottore:autofix -->"
AUTOFIX_BOX = f"- [ ] 🩺 Let Dottore fix the open findings on this PR {AUTOFIX_MARKER}"
AUTOFIX_BOX_RE = re.compile(r"^- \[([ xX])\] .*" + re.escape(AUTOFIX_MARKER), re.M)
# Each autofix commit carries this trailer; the push job writes it and autofix_rounds counts it.
AUTOFIX_TRAILER = "Dottore-Autofix:"
MAX_AUTOFIX_ROUNDS = 3
FINDING_MARKER_RE = re.compile(r"<!-- dottore:finding=([0-9a-f]{16}) -->")
STATE_MARKER_RE = re.compile(r"<!-- dottore:last-reviewed-sha=([0-9a-f]{40}) -->")
CONTRACT_STATE_RE = re.compile(r"<!-- dottore:contract-state=([A-Za-z0-9_=-]+) -->")


def walkthrough_header(body):
    """The marker lines Dottore wrote at the top of a walkthrough, the only place a marker is read from: the rest of
    the comment is model-written text, which a prompt planted in the specimen could make write a marker."""
    lines = []
    for line in str(body or "").splitlines():
        if not line.startswith("<!-- dottore:"):
            break
        lines.append(line)
    return "\n".join(lines)


# The Doctor himself beside the verdict: one of his chibis from .github/dottore-review/chibi, served raw from the
# tooling checkout the workflow pinned (DOTTORE_TOOLING_REPOSITORY and DOTTORE_TOOLING_SHA), so a branch's own chibis
# render in its reviews. A few poses per verdict; chibi and remark are chosen by the head SHA so a head re-renders the
# same. The command status window has poses of its own that no verdict uses, so the two comments on a pull request
# never show the same chibi at once, whichever heads they were rendered for.
DOTTORE_CHIBIS = {
    "VIABLE": ["viable", "discharged"],
    "VIABLE, WITH NOTES": ["viable-with-notes", "writing"],
    "REPAIR REQUIRED": ["repair-required", "stitching", "explaining", "writing"],
    "SPECIMEN UNSTABLE": ["specimen-unstable", "repair-required", "explaining"],
    "NO NEW DIFF REVIEWED": ["discharged", "viable"],
    "REVIEW INCOMPLETE": ["instrument-failed"],
    # The command status window while the review runs, and once it has posted.
    "EXPERIMENT IN PROGRESS": ["inspecting", "reading", "sorting"],
    "CONCLUDED": ["sorting", "reading"],
    "": ["instrument-failed"],
}
# One remark per verdict, in his voice.
DOTTORE_REMARKS = {
    "VIABLE": [
        "Not a tremor on the table. Dismissed, for now.",
        "A clean specimen. How dull. How welcome.",
        "Nothing to cut. I am almost disappointed.",
        "The instruments found nothing to object to. Carry on before I look harder.",
    ],
    "VIABLE, WITH NOTES": [
        "Nothing worth the scalpel, only a few smudges on the glass.",
        "Healthy enough. Polish the notes before the next exhibit.",
        "No incisions today. Read the notes; I do not write them for my own amusement.",
    ],
    "REPAIR REQUIRED": [
        "The specimen lives, but it twitches where it should not. Hold the scalpel for now.",
        "Fascinating. Bring it back when it stops bleeding.",
        "Every thread below is an incision. Close each one and I will look again.",
        "I have marked where it fails. Mend it, or let me.",
    ],
    "SPECIMEN UNSTABLE": [
        "Do not move this specimen. Something inside is still reacting.",
        "Lethal, and therefore interesting. Contain it before it reaches the branch.",
        "The table is not clean. Repair the worst of it before anyone else touches it.",
    ],
    "NO NEW DIFF REVIEWED": [
        "Nothing new under the glass since the last examination. The prior verdict stands.",
        "A base merge is not a specimen. I examined what changed, which was nothing.",
    ],
    "REVIEW INCOMPLETE": [
        "The instruments failed before the specimen did. Rerun the examination.",
        "An interrupted experiment proves nothing. Again.",
    ],
    "": ["The examination ended before a verdict. Ask again and I will look properly."],
}


THREAD_FOOTER = "*🎭 Push a repair and Dottore re-examines this thread; or tick the 🩺 box in his walkthrough to let him repair it.*"


def pick_for_head(pool, head_sha, slot=""):
    """Stable for a head; the slot keeps the remark, the chibi and the status window from moving in step."""
    digits = re.sub(r"[^0-9a-f]", "", str(head_sha or "").lower())[:8]
    return pool[int(hashlib.sha1(f"{slot}:{digits}".encode()).hexdigest()[:8], 16) % len(pool)]


def dottore_remark(label, head_sha):
    return pick_for_head(DOTTORE_REMARKS.get(label) or DOTTORE_REMARKS[""], head_sha, "remark")


def dottore_chibi(label, head_sha):
    pose = pick_for_head(DOTTORE_CHIBIS.get(label) or DOTTORE_CHIBIS[""], head_sha, f"chibi:{label}")
    repo = os.environ.get("DOTTORE_TOOLING_REPOSITORY") or "Pasta-Devs/Marinara-Engine"
    ref = os.environ.get("DOTTORE_TOOLING_SHA") or "staging"
    return f"https://raw.githubusercontent.com/{repo}/{ref}/.github/dottore-review/chibi/dottore-{pose}.png"
MAX_REVIEW_PACKET_CHARS = 180_000
MAX_SECTION_CHARS = 60_000
MAX_CONTEXT_FILE_CHARS = 20_000
MAX_SEARCH_HITS = 30
# Search skips minified lines, not large files, so large real sources stay findable; the Python
# fallback still skips files over MAX_SEARCH_FILE_BYTES.
MAX_SEARCH_FILE_BYTES = 5_000_000
MAX_SEARCH_LINE_CHARS = 1_000
DIFF_CONTEXT_LINES = 8
GITHUB_CONTEXT_LINES = 3  # unchanged lines GitHub shows around each change in a PR diff
MAX_FILE_PATCH_CHARS = 55_000
MAX_REVIEW_CHUNKS = 8
MAX_CHUNK_PATCH_CHARS = 90_000
MAX_INLINE_COMMENT_CHARS = 1_200
MAX_CONTRACT_STATE_ENTRIES = 12
MAX_CONTRACT_STATE_TEXT_CHARS = 320
MAX_CONTRACT_STATE_LIST_ITEMS = 3
# Replies stream, so these limit silence on the stream, not the reply: an attempt that sends nothing for
# this long is retried. An agent's first call has nothing cached yet and has stalled for minutes in the
# provider's queue, while a working one starts replying within about a minute, so it is retried sooner. A call
# offered only its submit tool thinks over the whole bundle before replying, so it may stay silent for the rest of
# its role's time instead (see chat).
MODEL_REQUEST_TIMEOUT = 360
FIRST_CALL_TIMEOUT = 180
# Limits time without thinking, text or tool-input progress; pings do not keep an attempt alive.
MODEL_STREAM_LIMIT = 900
# Reasoning efforts from least to most. A role offered no tools whose reply hits its output cap is retried once at the
# next lower effort: the cap is a symptom of thinking, and effort is the lever that reduces it.
EFFORT_LEVELS = ("low", "medium", "high", "xhigh", "max")
MODEL_MAX_RETRIES = 1
# Waits before resending a call that hit a transient gateway error (unavailable, overloaded, cut stream).
RETRY_DELAYS = (15, 45)
# The scout gathers the code the bundle builder could not follow, the finder proposes claims at changed lines from the
# bundle alone, and the checker ("verify") judges each claim against the code. Reading takes the small model and
# judging the large one, each set by its DOTTORE_SMALL_* or DOTTORE_LARGE_* settings (README.md).
REVIEW_ROLES = ("scout", "finder", "verify")
MODEL_SLOTS = {"scout": "small", "finder": "large", "verify": "large"}
MAX_SEED_HITS_PER_NAME = 10
MAX_TRACE_SEEDS = 40
MAX_SEED_CHARS = 12_000
# Definitions of the local values the change reads, quoted by code.
MAX_DEFINITIONS = 40
MAX_DEFINITION_LINES = 8
DEFINITION_HOPS = 2
SITE_LINES_AFTER = 2
CODE_SUFFIXES = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rs", ".go", ".java", ".kt", ".swift")
# The bundle quotes, per packet, each change with this many lines either side, the named block around it in full when
# it is short, the definitions it reads and the same-file functions that code calls, CALL_HOPS deep.
BUNDLE_WINDOW = DIFF_CONTEXT_LINES
BUNDLE_CALL_HOPS = 2
MAX_CHANGED_BLOCK_LINES = 150
MAX_CALLEE_LINES = 60
MAX_BUNDLE_CODE_CHARS = 160_000
MAX_PR_DESCRIPTION_CHARS = 4_000
# Scouts add code the bundle builder could not follow by name: places they keep, quoted by code. Each scout of a
# packet takes a share of its changed functions and they run at once, so the reading takes one scout's time.
MAX_SCOUT_PLACES = 6
SCOUTS = 4
MAX_SCOUT_LINES = 80
MAX_SCOUT_CHARS = 40_000
# Per-role limits (README.md). Reading is the scout's job, so the finder makes
# one call on the bundle with no tools, and the checker gets the code around each candidate quoted by code and a few
# reads for what is still out of reach. Cost then follows the bundle's size, not a model's appetite for reading:
# every turn of a tool loop resends the whole conversation.
ROLE_DEFAULTS = {
    "scout": {"reads": 10, "chars": 40_000, "minutes": 5, "max_tokens": 16_000, "places": MAX_SCOUT_PLACES, "scouts": SCOUTS},
    "finder": {"reads": 0, "chars": 0, "minutes": 10, "max_tokens": 32_000},
    "verify": {"reads": 5, "chars": 40_000, "max_tokens": 32_000},
}
# DOTTORE_COST_LIMIT_USD stops a review's model calls once it has spent that much (calls in flight still finish). Unset,
# a review may spend this much; 0 removes the limit.
DEFAULT_COST_LIMIT_USD = 1.00
# Prices are per 1M tokens in USD: input, cached input, output and, for Claude, a 5-minute cache write. A model not
# listed counts at the dearest rates, so an unknown model reaches the limit early rather than late.
# ponytail: the prices of the endpoints Dottore was measured on (LinkAPI, OpenRouter); a maintainer on other
# endpoints sets their own.
MODEL_PRICES_USD = {
    "gpt-6-astra": (0.4286, 0.04286, 2.143),
    "gpt-6.1-sol": (0.2857, 0.01143, 1.143),
    "gpt-6-luna": (0.005357, 0.0004286, 0.02143),
    "anthropic/claude-haiku-5.5": (0.10, 0.01, 0.50),
    "claude-haiku-5-5": (0.03286, 0.003286, 0.1643, 0.04107),
    "claude-sonnet-5-5": (0.6571, 0.03286, 3.286, 0.8214),
    "claude-opus-5-5": (1.314, 0.06571, 6.571, 1.643),
}
# A checker judging several candidates gets this much more per extra candidate.
VERIFIER_READS_PER_EXTRA = 1
VERIFIER_CHARS_PER_EXTRA = 4_000
# The last part of the review deadline belongs to the checker: finders submit before it starts.
CHECKER_RESERVE_SECONDS = 8 * 60
# A second finder or scout on a packet starts this long after the first, so its first call can reuse the prefix the
# first has just cached instead of both paying for it in full.
CACHE_STAGGER_SECONDS = 8
MAX_FINDERS = 2
MAX_PLACE_WHY_CHARS = 400
# A role whose calls fail this many times in a row stops the review before it spends more.
MAX_ROLE_FAILURES = 3
MAX_SUBMIT_ATTEMPTS = 3
# Every later turn resends a tool result, so reads are kept to a section.
MAX_TOOL_LINES = 120
MAX_TOOL_CHARS = 8_000
NEARBY_LINES = 3
MAX_VERIFIED_CANDIDATES = 20
MAX_OPEN_QUESTIONS = 2
MAX_NITPICKS = 2
MAX_REVIEW_LIMITATIONS = 2
MAX_GUIDANCE_HEADINGS = 40
EVIDENCE_WINDOW = 3
# Each model is reached through OpenAI's Chat Completions format, which most providers and gateways offer, Claude's
# Messages format, or OpenAI's Responses format for a model its provider serves only there; gateways such as LinkAPI
# serve Claude only through the Messages format when tools are used.
APIS = ("openai", "anthropic", "responses")
CACHE_BREAKPOINT = {"type": "ephemeral"}
DEFAULT_CONCURRENCY = 4
MAX_CONCURRENCY = 16
# The review step times out at 40 minutes; after this, agents submit and no new verifier starts. The scout, a
# one-call finder thinking silently for minutes and the checker run in turn, so each needs its whole slot.
REVIEW_DEADLINE_SECONDS = 30 * 60
SECRET_VALUE_RE = re.compile(
    r"(?i)(api[_-]?key|token|secret|password|passwd|authorization|bearer|client[_-]?secret)"
    r"(\s*[:=]\s*|\s+)([^\s'\"`;&|]+)"
)
SECRET_FILE_PART_RE = re.compile(
    r"(?i)(^|[/\\])(\.env[^/\\]*|.*secret.*|.*credential.*|id_rsa|id_ed25519|\.npmrc|\.netrc)([/\\]|$)"
)


@dataclass
class Finding:
    severity: str
    path: str
    line: int | None
    title: str
    body: str
    fix_hint: str
    repair_contract: dict | None = None
    side: str = "RIGHT"
    segment: str = ""
    # A confirmed defect the checker placed on a line the PR did not change: walkthrough only, never inline.
    outside_diff: bool = False
    packet: int = 0


def _safe_path(rel: str) -> pathlib.Path:
    full = (REPO_ROOT / rel).resolve()
    if full != REPO_ROOT and REPO_ROOT not in full.parents:
        raise ValueError("path escapes repo root")
    name = full.name.lower()
    if name.startswith(".env") or name in {
        "credentials.json",
        "id_rsa",
        "id_ed25519",
        ".npmrc",
        ".netrc",
    }:
        raise ValueError("blocked sensitive file")
    return full


def run(args, *, input_text=None, timeout=120, check=False):
    # Without input, give the command an empty stdin: rg with no path reads a piped stdin and hangs.
    stdin = {"input": input_text} if input_text is not None else {"stdin": subprocess.DEVNULL}
    result = subprocess.run(
        args,
        cwd=REPO_ROOT,
        **stdin,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"{' '.join(args)} failed with {result.returncode}:\n"
            f"{result.stdout}{result.stderr}"
        )
    return result


def run_git_raw(args):
    result = run(["git", *args], timeout=90)
    return result.stdout + result.stderr


def run_git(args, limit=MAX_SECTION_CHARS):
    result = run(["git", *args], timeout=90)
    return truncate(result.stdout + result.stderr, limit)


def run_gh(args, *, input_text=None, timeout=120, check=False):
    return run(["gh", *args], input_text=input_text, timeout=timeout, check=check)


def truncate(text, limit):
    if len(text) <= limit:
        return text
    return (
        text[:limit]
        + f"\n\n[truncated: section was {len(text)} chars, limit is {limit} chars]\n"
    )


def redact_for_model(text):
    text = str(text or "")
    text = SECRET_VALUE_RE.sub(lambda match: match.group(1) + match.group(2) + "[REDACTED]", text)
    redacted_lines = []
    for line in text.splitlines():
        if line.startswith(("diff --git ", "+++ ", "--- ", "rename from ", "rename to ")):
            redacted_lines.append(SECRET_FILE_PART_RE.sub(r"\1[REDACTED-SENSITIVE-PATH]\3", line))
            continue
        if SECRET_FILE_PART_RE.search(line) and line.startswith(("+", "-")):
            redacted_lines.append(line[:1] + "[REDACTED-SENSITIVE-LINE]")
            continue
        redacted_lines.append(line)
    return "\n".join(redacted_lines)


def inline_truncate(text, limit=MAX_INLINE_COMMENT_CHARS):
    if len(text) <= limit:
        return text
    suffix = f"\n\n[truncated: inline finding was {len(text)} chars, limit is {limit} chars]"
    keep = max(0, limit - len(suffix))
    return text[:keep].rstrip() + suffix


def compact_state_text(value, limit=MAX_CONTRACT_STATE_TEXT_CHARS):
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 3)].rstrip() + "..."


def compact_state_values(value):
    values = compact_list(value)
    return [
        compact_state_text(item)
        for item in values[:MAX_CONTRACT_STATE_LIST_ITEMS]
        if compact_state_text(item)
    ]


def read_text(path, limit=MAX_SECTION_CHARS):
    p = _safe_path(path)
    return truncate(p.read_text(encoding="utf-8", errors="replace"), limit)


def search_repo(pattern, code=False):
    """Literal search; code=True matches whole identifiers in code files, sorted by path so the bundle repeats."""
    if not pattern or len(pattern) > 120:
        return "refused: search pattern must be 1-120 characters"
    if not shutil.which("rg"):
        return search_repo_with_python(pattern, code)
    rg = run(
        [
            "rg",
            "--fixed-strings",
            "--line-number",
            *(["--word-regexp", "--sort=path", "--glob", "*.{" + ",".join(s[1:] for s in CODE_SUFFIXES) + "}"] if code else []),
            "--glob",
            "!node_modules",
            "--glob",
            "!target",
            "--glob",
            "!dist",
            "--glob",
            "!build",
            "--glob",
            "!coverage",
            "--glob",
            "!playwright-report",
            pattern,
        ],
        timeout=60,
    )
    if rg.returncode not in (0, 1):
        return truncate(rg.stdout + rg.stderr, MAX_CONTEXT_FILE_CHARS)
    lines = []
    for line in rg.stdout.splitlines():
        try:
            rel, line_no, body = line.split(":", 2)
            _safe_path(rel)
            if excluded_path(rel) or len(body) > MAX_SEARCH_LINE_CHARS:
                continue
            lines.append(f"{rel}:{line_no}: {body.strip()[:220]}")
        except Exception:
            continue
        if len(lines) >= MAX_SEARCH_HITS:
            break
    return "\n".join(lines) or "no matches"


def search_repo_with_python(pattern, code=False):
    hits = []
    whole = re.compile(rf"(?<!\w){re.escape(pattern)}(?!\w)")
    ignored_parts = {
        ".git",
        "node_modules",
        "target",
        "dist",
        "build",
        ".next",
        "coverage",
        "playwright-report",
    }
    for path in sorted(REPO_ROOT.rglob("*")) if code else REPO_ROOT.rglob("*"):
        if len(hits) >= MAX_SEARCH_HITS:
            break
        if any(part in ignored_parts for part in path.parts):
            continue
        if not path.is_file() or (code and not path.name.endswith(CODE_SUFFIXES)):
            continue
        try:
            if path.stat().st_size > MAX_SEARCH_FILE_BYTES:
                continue
            rel = path.relative_to(REPO_ROOT)
            # rg skips hidden folders such as .agents/ (tooling, not product code); keep the bundle the same.
            if excluded_path(rel.as_posix()) or (code and any(part.startswith(".") for part in rel.parts)):
                continue
            text = path.read_text("utf-8", "replace")
        except Exception:
            continue
        if "\0" in text[:8_000]:
            continue
        for line_no, line in enumerate(text.splitlines(), 1):
            if (whole.search(line) if code else pattern in line) and len(line) <= MAX_SEARCH_LINE_CHARS:
                hits.append(f"{rel}:{line_no}: {line.strip()[:220]}")
                if len(hits) >= MAX_SEARCH_HITS:
                    break
    return "\n".join(hits) or "no matches"


def diff_command(base, *options, paths=None):
    """A git diff from the review base, a commit HEAD descends from or one built by own_changes_base, to HEAD."""
    command = ["diff", *options, base, "HEAD"]
    if paths is not None:
        command.extend(["--", *paths])
    return command


def excluded_path(path):
    """True for paths rules.json excludes, such as generated bundles; tools neither read nor search them."""
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in load_rules().get("exclude_paths", []))


def changed_files(base, excluded=False):
    """Changed paths the review reads, or with excluded=True the changed paths rules.json excludes."""
    names = run_git(diff_command(base, "--find-renames", "--name-status"))
    patterns = load_rules().get("exclude_paths", [])
    paths = []
    for line in names.splitlines():
        fields = line.split("\t")
        if len(fields) < 2:
            continue
        changed = fields[1:] if fields[0].startswith("R") else fields[1:2]
        if any(fnmatch.fnmatchcase(path, pattern) for path in changed for pattern in patterns) == excluded:
            paths.extend(changed)
    return list(dict.fromkeys(paths))


def dottore_prompt_path():
    prompt_path = pathlib.Path(
        os.environ.get("DOTTORE_REVIEW_PROMPT_PATH")
        or ".github/dottore-review/reviewer-prompt.md"
    )
    if not prompt_path.is_absolute():
        prompt_path = REPO_ROOT / prompt_path
    return prompt_path


def load_rules():
    rules_path = pathlib.Path(
        os.environ.get("DOTTORE_REVIEW_RULES_PATH")
        or dottore_prompt_path().parent / "rules.json"
    )
    if not rules_path.is_absolute():
        rules_path = REPO_ROOT / rules_path
    try:
        return json.loads(rules_path.read_text("utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as exc:
        return {"_load_error": str(exc)}


def guidance_from_rules(files, rules):
    guidance = ["AGENTS.md"]
    for item in rules.get("path_instructions", []):
        prefixes = item.get("prefixes", [])
        if any(any(path.startswith(prefix) for prefix in prefixes) for path in files):
            guidance.extend(item.get("guidance", []))
    return list(dict.fromkeys(guidance))


def select_guidance(files):
    rules = load_rules()
    if rules and "_load_error" not in rules:
        return guidance_from_rules(files, rules)
    guidance = ["AGENTS.md"]
    joined = "\n".join(files)
    if any(
        marker in joined
        for marker in ("packages/shared/", "packages/server/src/", "packages/client/src/")
    ):
        guidance.append("docs/development/architecture-map.md")
    if "packages/client/" in joined:
        guidance.extend(["docs/development/frontend.md", "packages/client/.instructions.md", "docs/development/localization.md"])
    if "packages/server/" in joined:
        guidance.extend(["CONTRIBUTING.md", "docs/development/logging.md"])
    if any(
        marker in joined
        for marker in (
            "chat",
            "roleplay",
            "game",
            "conversation",
            "prompt",
            "generation",
            "summary",
            "memory",
        )
    ):
        guidance.append("packages/client/.instructions.md")
    if any(
        marker in joined
        for marker in ("storage", "import", "provider", "db/", "migration", "services/")
    ):
        guidance.append("docs/development/file-storage.md")
    if any(marker in joined for marker in ("README", "docs/", "AGENTS.md", "CONTRIBUTING.md", "CLAUDE.md")):
        guidance.append("CONTRIBUTING.md")
    return list(dict.fromkeys(guidance))


def guidance_index(path):
    """List a guidance file's size and headings so an agent can read_file just the section it needs."""
    lines = _safe_path(path).read_text("utf-8", "replace").splitlines()
    headings = [
        f"  {number}: {line.strip()}"
        for number, line in enumerate(lines, 1)
        if re.match(r"#{1,3} ", line)
    ]
    if len(headings) > MAX_GUIDANCE_HEADINGS:
        headings = headings[:MAX_GUIDANCE_HEADINGS] + ["  ..."]
    return "\n".join([f"{path} ({len(lines)} lines)", *headings])


def matching_path_rules(files):
    rules = load_rules()
    if not rules or "_load_error" in rules:
        return "No additional Dottore path rules loaded."
    matched = []
    for item in rules.get("path_instructions", []):
        prefixes = item.get("prefixes", [])
        if any(any(path.startswith(prefix) for prefix in prefixes) for path in files):
            matched.append(item)
    payload = {
        "severity_policy": rules.get("severity_policy", {}),
        "review_focus": rules.get("review_focus", []),
        "matched_path_instructions": matched,
        "repo_concerns": rules.get("repo_concerns", []),
    }
    return json.dumps(payload, indent=2, sort_keys=True)


def diff_for_path(base, path):
    return redact_for_model(
        run_git_raw(diff_command(base, "--find-renames", f"--unified={DIFF_CONTEXT_LINES}", paths=[path]))
    )


BUNDLE_NOTE = (
    "Built by code from the PR head. It holds the PR description; the changed files, the diff stat, the path rules "
    "and a guidance index by heading; the production code with changed lines marked `+` after the line number and "
    "removed lines shown unnumbered with `-` where they stood, each change with the code around it and its enclosing "
    "function when short, where the values the changed lines read are defined, and the same-file functions that code "
    "calls, two calls deep; where each changed function and each name declared on a changed line is used outside the "
    "diff; the diff of files other than code (docs, changelog, strings); and, when scouts ran, the code they added "
    "from other files: callers, imported definitions and what the changed values flow into. Test files are listed, "
    "not shown."
)
SCOUT_NOTE = (
    "Places the scouts read and kept, quoted by code from the PR head (or from the review base where marked), "
    "with the PR's changed lines marked `+`."
)


def pr_description(pr_num):
    """The PR's title and description, or "" when gh cannot read them."""
    if not pr_num:
        return ""
    result = run_gh(["pr", "view", pr_num, "--json", "title,body", "--jq", '.title + "\\n\\n" + .body'])
    return truncate(redact_for_model(result.stdout.strip()), MAX_PR_DESCRIPTION_CHARS) if result.returncode == 0 else ""


def removed_lines(base):
    """The PR's removed lines by path and the head line they stood before: {path: {line: [text, ...]}}."""
    removed, path, line = {}, None, None
    for text in run_git_raw(diff_command(base, "--find-renames", "--unified=0")).splitlines():
        if text.startswith("diff --git "):
            path = line = None
        elif line is None and text.startswith("+++ "):
            path = text.removeprefix("+++ b/") if text.startswith("+++ b/") else None
        elif match := re.match(r"@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", text):
            # A hunk that adds nothing names the head line before the removal.
            line = int(match.group(1)) + (match.group(2) == "0")
        elif path and line is not None and text.startswith("-"):
            removed.setdefault(path, {}).setdefault(line, []).append(text[1:])
        elif line is not None and text.startswith("+"):
            line += 1
    return removed


# ponytail: same-file and by name only. A call through an import or an overload is not followed; the scout reads
# those with its tools and submits them, and a language server would resolve them properly.
def bundle_code(touched, sites, removed, marked=None, kind="bundle"):
    """The production code that decides the change, quoted per file from the PR head with changed lines marked: each
    change with BUNDLE_WINDOW lines either side and its short enclosing block, the definitions value_definitions
    follows, and the same-file functions any of that calls, BUNDLE_CALL_HOPS deep. Files in path order, cut at the
    limit. The lines in touched are quoted; the lines in marked (touched by default) are marked `+`, so the checker's
    candidate slices quote unchanged lines with the PR's changes still marked."""
    try:
        found = value_definitions(touched, sites)
    except Exception as exc:
        print(f"Dottore definitions failed: {error_text(exc)}", flush=True)
        found = []
    definitions = {}
    for path, start, end, name, read_at in found:
        definitions.setdefault(path, []).append((start, end, f"`{name}` defined, read at line {read_at}"))
    sections, callees = [], 0
    for path in sorted(set(touched) | set(definitions)):
        if not path.endswith(CODE_SUFFIXES) or TEST_PATH_RE.search(path):
            continue
        try:
            lines = head_file_text(path).splitlines()
        except Exception:
            continue
        focus = {number for number in touched.get(path, {}).get("RIGHT", ()) if number <= len(lines)}
        changed = {number for number in (marked or touched).get(path, {}).get("RIGHT", ()) if number <= len(lines)}
        gone = removed.get(path, {})
        ranges = list(definitions.get(path, ()))
        for number in sorted(focus | {line for line in gone if line <= len(lines)}):
            ranges.append((max(1, number - BUNDLE_WINDOW), min(len(lines), number + BUNDLE_WINDOW), ""))
            block = enclosing_block(lines, number)
            if block:
                end = statement_end(lines, block[1], MAX_CHANGED_BLOCK_LINES + 1)
                if number <= end < block[1] + MAX_CHANGED_BLOCK_LINES:
                    ranges.append((block[1], end, ""))
        if not ranges:
            continue
        declared = declared_names(lines)
        frontier = [(low, high) for low, high, _ in ranges]
        for _ in range(BUNDLE_CALL_HOPS):
            calls = []
            for low, high in frontier:
                for number in range(low, high + 1):
                    for match in CALLED_NAME_RE.finditer(lines[number - 1].split("//")[0]):
                        head = declared.get(match.group(1))
                        if head is None or any(start <= head <= end for start, end, _ in ranges):
                            continue
                        end = statement_end(lines, head, MAX_CALLEE_LINES)
                        ranges.append((head, end, f"`{match.group(1)}`, called at line {number}"))
                        calls.append((head, end))
            callees += len(calls)
            frontier = calls
        merged = []
        for low, high, label in sorted(ranges):
            if merged and low <= merged[-1][1] + 1:
                merged[-1][1] = max(high, merged[-1][1])
                merged[-1][2].append(label)
            else:
                merged.append([low, high, [label]])
        for low, high, labels in merged:
            named = list(dict.fromkeys(label for label in labels if label))
            heading = f" ({'; '.join(named[:4])}{'; ...' if len(named) > 4 else ''})" if named else ""
            body = "\n".join(
                "".join(f"-    {text}\n" for text in gone.get(number, ()))
                + f"{number}{'+' if number in changed else ':'} {lines[number - 1]}"
                for number in range(low, high + 1)
            )
            sections.append(f"## {path}:{low}-{high}{heading}\n```text\n{redact_for_model(body)}\n```")
    code = "\n\n".join(sections)
    print(
        f"Dottore {kind} code: sections={len(sections)}; definitions={len(found)}; callees={callees}; "
        f"chars={len(code)}" + ("; cut at the limit" if len(code) > MAX_BUNDLE_CODE_CHARS else ""),
        flush=True,
    )
    return truncate(code, MAX_BUNDLE_CODE_CHARS)


def bundle_ranges(text):
    """The line ranges a bundle's code sections already show, by path, from their `## path:low-high` headings."""
    shown = {}
    for path, low, high in re.findall(r"^## (\S+?):(\d+)-(\d+)", text, re.M):
        shown.setdefault(path, []).append((int(low), int(high)))
    return shown


def shown_in(shown, path, start, end):
    return any(low <= start and end <= high for low, high in shown.get(path, ()))


def build_bundle(base, focus, description):
    """One packet's bundle, everything its finder and checker share, built by code: the PR description, the
    changed files and path rules, the guidance index, the production code that decides the change with its changes
    marked (bundle_code), where changed names are used outside the diff, and the diff of files other than code."""
    files = changed_files(base)
    tests = [path for path in focus if TEST_PATH_RE.search(path)]
    every = touched_lines(base)
    touched = {path: sides for path, sides in every.items() if path in focus}
    seeds, _, sites = trace_seeds(touched, every)
    other = [path for path in focus if path not in tests and not path.endswith(CODE_SUFFIXES)]
    patch = redact_for_model(run_git_raw(diff_command(base, "--find-renames", "--unified=3", paths=other))) if other else ""
    # Guidance is indexed, not inlined; readers read_file the sections that bear on a suspicion.
    index = []
    for path in select_guidance(focus):
        try:
            index.append(guidance_index(path))
        except Exception as exc:
            index.append(f"{path}: could not read: {exc}")
    elsewhere = [path for path in files if path not in focus]
    listed = "\n".join(focus) + (
        f"\n\nChanged files reviewed in other packets ({len(elsewhere)}):\n" + "\n".join(elsewhere) if elsewhere else ""
    )
    sections = [
        ("Pull Request", description or "No description could be read."),
        ("Changed Files", listed + (f"\n\nTest files ({len(tests)}) are listed but not shown." if tests else "")),
        # Listed so a reader does not mistake an excluded file, such as a rebuilt bundle, for one the PR forgot.
        ("Changed but Excluded From Review", "\n".join(changed_files(base, excluded=True)) or "None."),
        ("Diff Stat", run_git(diff_command(base, "--stat", paths=focus), 20_000) if focus else "No included changes."),
        ("Path Rules", matching_path_rules(focus)),
        ("Guidance Index", "\n\n".join(index) or "No guidance selected."),
        ("Code at the PR Head", bundle_code(touched, sites, removed_lines(base)) or "No code could be quoted."),
        (
            "Uses Outside the Diff",
            "Where each changed function, and each name declared on a changed line, is used outside the diff.\n\n"
            + (seeds or "No named changes found."),
        ),
    ]
    if patch:
        sections.append(("Diff of Files Other Than Code", f"```diff\n{truncate(patch, MAX_SECTION_CHARS)}\n```"))
    bundle = f"# Bundle\n{BUNDLE_NOTE}\n\n" + "\n\n".join(f"# {title}\n{redact_for_model(body)}" for title, body in sections)
    return truncate(bundle, MAX_REVIEW_PACKET_CHARS)


def chunk_changed_files(base, files):
    chunks = []
    current = []
    current_size = 0
    for path in files:
        patch_size = len(diff_for_path(base, path))
        if current and current_size + patch_size > MAX_CHUNK_PATCH_CHARS:
            chunks.append(current)
            current = []
            current_size = 0
        current.append(path)
        current_size += patch_size
    if current:
        chunks.append(current)
    if len(chunks) <= MAX_REVIEW_CHUNKS:
        return chunks
    merged = chunks[: MAX_REVIEW_CHUNKS - 1]
    overflow = [path for chunk in chunks[MAX_REVIEW_CHUNKS - 1 :] for path in chunk]
    merged.append(overflow)
    return merged


def usage_value(usage, *path):
    current = usage
    for key in path:
        if current is None:
            return 0
        if isinstance(current, dict):
            current = current.get(key)
        else:
            current = getattr(current, key, None)
    return current or 0


def add_usage(totals, usage):
    totals["prompt_tokens"] += usage_value(usage, "prompt_tokens")
    totals["completion_tokens"] += usage_value(usage, "completion_tokens")
    totals["total_tokens"] += usage_value(usage, "total_tokens")
    totals["cached_tokens"] += usage_value(usage, "prompt_tokens_details", "cached_tokens")
    totals["reasoning_tokens"] += usage_value(
        usage, "completion_tokens_details", "reasoning_tokens"
    )


def build_stats(review_packet):
    return {
        "started_at": time.monotonic(),
        "review_packet_chars": len(review_packet),
        "bundle_chars": len(review_packet),
        "roles": {
            role: {
                "model": "",
                "usd": 0.0,
                "model_calls": 0,
                "tool_calls": 0,
                "tool_chars": 0,
                "stop_own": 0,
                "stop_calls": 0,
                "stop_chars": 0,
                "stop_time": 0,
                "stop_box": 0,
                "stop_cap": 0,
                "prompt_tokens": 0,
                "cached_tokens": 0,
                "completion_tokens": 0,
                "reasoning_tokens": 0,
                "total_tokens": 0,
            }
            for role in REVIEW_ROLES
        },
        "verification": {},
    }


def print_telemetry(stats):
    elapsed = time.monotonic() - stats["started_at"]
    roles = stats["roles"]
    counters = ("model_calls", "tool_calls", "prompt_tokens", "cached_tokens", "completion_tokens", "reasoning_tokens", "total_tokens")
    bundle_chars = stats["bundle_chars"]
    parts = [
        f"elapsed_s={elapsed:.1f}",
        f"review_packet_chars={stats['review_packet_chars']}",
        f"bundle_chars={bundle_chars}",
        f"usd={sum(role['usd'] for role in roles.values()):.3f}",
    ]
    parts += [f"{key}={sum(role[key] for role in roles.values())}" for key in counters]
    for name, role in roles.items():
        fields = [f"{key}:{value}" for key, value in role.items() if value and key != "usd"]
        if role["prompt_tokens"]:
            # Prompt tokens sent per bundle token (about one per four characters): a one-call role sends about one
            # bundle; a tool loop sends the growing conversation again every turn. Cost should follow this ratio and
            # the model's price, nothing else.
            fields += [f"usd:{role['usd']:.3f}", f"prompt_x_bundle:{role['prompt_tokens'] / max(bundle_chars / 4, 1):.1f}"]
        parts.append(f"{name}=" + ",".join(fields))
    parts += [f"{key}={value}" for key, value in stats["verification"].items()]
    print("Dottore telemetry: " + "; ".join(parts), flush=True)


def model_slot(slot):
    """The small or large model from its DOTTORE_<SLOT>_MODEL, _API, _EFFORT and _BASE_URL settings."""
    prefix = f"DOTTORE_{slot.upper()}_"
    values = {name: os.environ.get(prefix + name.upper(), "").strip() for name in ("model", "api", "effort", "base_url")}
    values["api"] = values["api"].lower() or APIS[0]
    if values["api"] not in APIS:
        raise ValueError(f"{prefix}API must be {' or '.join(APIS)}, not {values['api']}.")
    return {"slot": slot, **values}


def role_models():
    """Each role's settings: its model slot's (MODEL_SLOTS) and its limits (ROLE_DEFAULTS)."""
    slots = {slot: model_slot(slot) for slot in set(MODEL_SLOTS.values())}
    return {role: {**slots[MODEL_SLOTS[role]], **ROLE_DEFAULTS[role]} for role in REVIEW_ROLES}


def missing_model_setup():
    """The settings a review cannot run without that this run lacks: each model's name and key."""
    return [
        f"DOTTORE_{slot}_{name}"
        for slot in ("SMALL", "LARGE")
        for name in ("MODEL", "API_KEY")
        if not os.environ.get(f"DOTTORE_{slot}_{name}", "").strip()
    ]


def finder_count():
    raw = os.environ.get("DOTTORE_FINDERS", "").strip() or "1"
    if raw not in {str(count) for count in range(1, MAX_FINDERS + 1)}:
        raise ValueError(f"DOTTORE_FINDERS must be a whole number from 1 to {MAX_FINDERS}.")
    return int(raw)


def cost_limit():
    raw = os.environ.get("DOTTORE_COST_LIMIT_USD", "").strip()
    try:
        return float(raw) if raw else DEFAULT_COST_LIMIT_USD
    except ValueError as exc:
        raise ValueError("DOTTORE_COST_LIMIT_USD must be a number of dollars.") from exc


def review_clients(models):
    """One client per model slot, at its base URL (the provider's own when empty) with its DOTTORE_<SLOT>_API_KEY."""
    clients = {}
    for settings in models.values():
        slot = settings["slot"]
        if slot in clients:
            continue
        options = {
            "api_key": os.environ[f"DOTTORE_{slot.upper()}_API_KEY"].strip(),
            "base_url": settings["base_url"] or None,
            "max_retries": MODEL_MAX_RETRIES,
        }
        if settings["api"] in ("openai", "responses"):
            from openai import OpenAI

            clients[slot] = OpenAI(**options)
        else:
            from anthropic import Anthropic

            clients[slot] = Anthropic(**options)
    return clients


def call_cost_usd(model, usage):
    rates = MODEL_PRICES_USD.get(model) or tuple(max(column) for column in zip(*(r[:3] for r in MODEL_PRICES_USD.values())))
    prompt = usage_value(usage, "prompt_tokens")
    cached = usage_value(usage, "prompt_tokens_details", "cached_tokens")
    written = usage_value(usage, "prompt_tokens_details", "cache_write_tokens")
    output = usage_value(usage, "completion_tokens")
    write_rate = rates[3] if len(rates) > 3 else rates[0]
    return ((prompt - cached - written) * rates[0] + cached * rates[1] + written * write_rate + output * rates[2]) / 1e6


def review_concurrency():
    raw = os.environ.get("DOTTORE_CONCURRENCY", "").strip()
    if not raw:
        return DEFAULT_CONCURRENCY
    if not raw.isdigit() or int(raw) < 1:
        raise ValueError("DOTTORE_CONCURRENCY must be a positive whole number.")
    return min(int(raw), MAX_CONCURRENCY)


@dataclass
class ReviewRun:
    """What every agent in one review shares: the clients, models, telemetry and the diff scope."""

    clients: dict
    prompts: dict
    system: str
    # One bundle per packet and the packet built on it; the scout appends to both before the other roles run.
    bundles: list
    packets: list
    cache_key: str
    allowed: dict
    models: dict
    stats: dict
    base: str
    merge_base: str
    files: frozenset
    deadline: float
    cost_limit: float = 0.0
    spent_usd: float = 0.0
    failures: dict = field(default_factory=dict)
    # The lines a review thread can anchor to: the diff from the merge base, which is `allowed` in a full review.
    anchorable: dict = field(default_factory=dict)
    # Each packet's changed files; empty means one packet of every changed file.
    chunks: list = field(default_factory=list)
    lock: threading.Lock = field(default_factory=threading.Lock)


def function_tool(name, description, properties, required):
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required},
        },
    }


PATH_PARAM = {"type": "string", "description": "Repository-relative path."}
LINE_RANGE = {
    "start": {"type": "integer", "description": "First line, 1-based."},
    "end": {"type": "integer", "description": "Last line, inclusive."},
}
READ_TOOLS = [
    function_tool(
        "read_file",
        f"Read numbered lines of a repository file at the PR head, at most {MAX_TOOL_LINES} lines per call.",
        {"path": PATH_PARAM, **LINE_RANGE},
        ["path"],
    ),
    function_tool(
        "search",
        f"Find literal text in the repository at the PR head; returns up to {MAX_SEARCH_HITS} path:line hits.",
        {"literal": {"type": "string", "description": "Exact text to find, 1-120 characters."}},
        ["literal"],
    ),
    function_tool(
        "file_diff",
        "Show the pull request's diff for one changed file.",
        {"path": PATH_PARAM},
        ["path"],
    ),
    function_tool(
        "base_version",
        f"Read numbered lines of a file at the review base, for code the PR removes or rewrites; at most {MAX_TOOL_LINES} lines per call.",
        {"path": PATH_PARAM, **LINE_RANGE},
        ["path"],
    ),
]
STRING_LIST = {"type": "array", "items": {"type": "string"}}
REVIEW_ITEM = {
    "type": "object",
    "properties": {
        "severity": {"type": "string", "enum": ["blocking", "high", "medium", "low"]},
        "path": {"type": "string"},
        "line": {"type": "integer"},
        "side": {"type": "string", "enum": ["LEFT", "RIGHT"]},
        "title": {"type": "string"},
        "body": {"type": "string"},
        "fix_hint": {"type": "string"},
        "repair_contract": {"type": "object"},
    },
    "required": ["path", "line", "title", "body"],
}
EVIDENCE = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "line": {"type": "integer"},
            "snippet": {"type": "string"},
        },
        "required": ["path", "line", "snippet"],
    },
}
SUBMIT_FINDINGS = function_tool(
    "submit_findings",
    "Submit the candidate findings and notes. This ends the pass.",
    {
        "change_summary": STRING_LIST,
        "findings": {"type": "array", "items": REVIEW_ITEM},
        "nitpicks": {"type": "array", "items": REVIEW_ITEM},
        "pre_merge_checks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "status": {"type": "string", "enum": ["pass", "warn", "fail", "unknown"]},
                    "type": {"type": "string", "enum": ["Proof Gap", "Review Limitation", "Non-blocking Coverage"]},
                    "detail": {"type": "string"},
                },
                "required": ["name", "status", "detail"],
            },
        },
        "open_questions": STRING_LIST,
        "what_i_checked": STRING_LIST,
    },
    ["change_summary", "findings", "nitpicks", "pre_merge_checks", "open_questions", "what_i_checked"],
)
SUBMIT_VERDICTS = function_tool(
    "submit_verdicts",
    "Submit a verdict on each candidate. This ends the check.",
    {
        "verdicts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "candidate": {"type": "integer"},
                    "verdict": {"type": "string", "enum": ["confirmed", "rejected", "uncertain"]},
                    "severity": {"type": "string", "enum": ["blocking", "high", "medium", "low"]},
                    "evidence": EVIDENCE,
                    "note": {"type": "string"},
                    "same_as": {"type": "integer", "description": "The candidate number this one shares a defect with."},
                    **{key: REVIEW_ITEM["properties"][key] for key in ("path", "line", "title", "body", "fix_hint", "repair_contract")},
                },
                "required": ["candidate", "verdict", "severity", "evidence", "note"],
            },
        },
    },
    ["verdicts"],
)
SUBMIT_REPAIRS = function_tool(
    "submit_repairs",
    "Submit a verdict on each open thread. This ends the check.",
    {
        "verdicts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "thread": {"type": "integer"},
                    "verdict": {"type": "string", "enum": ["resolved", "still_open", "uncertain"]},
                    "evidence": EVIDENCE,
                    "note": {"type": "string"},
                },
                "required": ["thread", "verdict", "evidence", "note"],
            },
        },
    },
    ["verdicts"],
)


def tool_path(path):
    """Normalize a model-supplied path; refuse anything outside the tree, in .git, or secret-looking."""
    normalized = posixpath.normpath(str(path or "").strip())
    if (
        normalized in {".", ".."}
        or normalized.startswith(("/", "../"))
        or ".git" in normalized.split("/")
        or SECRET_FILE_PART_RE.search(normalized)
    ):
        raise ValueError(f"path {path!r} is outside the reviewable repository")
    return normalized


def readable_text(path, text):
    if excluded_path(path):
        raise ValueError(f"{path} is generated or excluded by the review rules; read its source instead")
    if "\0" in text[:8_000]:
        raise ValueError(f"{path} is a binary file")
    return text


def head_file_text(path):
    full = _safe_path(tool_path(path))
    # Check the resolved path too, so a symlink cannot lead into .git or a secret file.
    relative = tool_path(full.relative_to(REPO_ROOT).as_posix())
    return readable_text(relative, full.read_text("utf-8", "replace"))


def base_file_text(ctx, path):
    shown = run(["git", "show", f"{ctx.merge_base}:{tool_path(path)}"], timeout=60)
    if shown.returncode != 0:
        raise ValueError(f"{path} does not exist at the review base")
    return readable_text(tool_path(path), shown.stdout)


def numbered_lines(text, start=None, end=None):
    lines = text.splitlines()
    first = max(1, int(start or 1))
    last = min(len(lines), int(end or first + MAX_TOOL_LINES - 1), first + MAX_TOOL_LINES - 1)
    if first > last:
        return f"No lines in that range; the file has {len(lines)} lines."
    body = "\n".join(f"{number}: {lines[number - 1]}" for number in range(first, last + 1))
    return truncate(body, MAX_TOOL_CHARS)


def searchable_hit(hit):
    try:
        tool_path(hit.split(":", 1)[0])
    except ValueError:
        return False
    return True


def run_tool(ctx, name, arguments):
    """Run one read-only tool call; every result is redacted and every failure becomes a refusal."""
    try:
        args = json.loads(arguments or "{}")
        if not isinstance(args, dict):
            raise ValueError("arguments must be a JSON object")
        if name == "read_file":
            result = numbered_lines(head_file_text(args.get("path")), args.get("start"), args.get("end"))
        elif name == "base_version":
            result = numbered_lines(base_file_text(ctx, args.get("path")), args.get("start"), args.get("end"))
        elif name == "file_diff":
            path = tool_path(args.get("path"))
            if path not in ctx.files:
                raise ValueError(f"{path} is not a changed file; use read_file")
            result = truncate(diff_for_path(ctx.base, path), MAX_FILE_PATCH_CHARS)
        elif name == "search":
            hits = search_repo(str(args.get("literal") or "")).splitlines()
            result = "\n".join(hit for hit in hits if searchable_hit(hit)) or "no matches"
        else:
            raise ValueError(f"unknown tool {name}")
    except Exception as exc:
        return f"refused: {exc}"
    return redact_for_model(result)


class StreamStalled(Exception):
    """The connection went quiet or dropped after the reply stream opened."""


class ResponseFailed(Exception):
    """The provider reported a failed response inside a Responses stream, with its error code when it gave one."""

    def __init__(self, detail, code=None):
        super().__init__(f"the response failed: {detail}")
        self.code = code or ""


def watched(stream, started, timing, limit=MODEL_STREAM_LIMIT):
    """Yield a stream's events, noting when the first arrived and stopping one that makes no progress. A stopped stream
    returns no usage, so the error carries what had streamed by then: thinking, text and tool-input characters."""
    seen = {"thinking": 0, "text": 0, "tool": 0}
    last = 0.0  # when the counts last grew; pings and block boundaries do not count
    for event in stream:
        elapsed = time.monotonic() - started
        timing.setdefault("first_chunk", elapsed)
        if elapsed - last > limit:
            raise TimeoutError(
                f"the reply made no thinking, text or tool-input progress for {elapsed - last:.0f}s "
                f"(limit {limit:.0f}s, elapsed {elapsed:.0f}s), with {seen['thinking']} thinking, {seen['text']} text "
                f"and {seen['tool']} tool-input characters streamed, the last at {last:.0f}s"
            )
        delta = getattr(event, "delta", None)  # Claude content_block_delta, or a Responses delta event's string
        if delta is None and getattr(event, "choices", None):  # Chat Completions chunk
            delta = event.choices[0].delta
        kind = str(getattr(event, "type", ""))  # Responses: response.output_text.delta, ...function_call_arguments.delta, ...reasoning_*.delta
        streamed = "text" if "output_text" in kind else "tool" if "function_call_arguments" in kind else "thinking"
        for key, names in (("thinking", ("thinking", "reasoning", "reasoning_content")), ("text", ("text", "content")), ("tool", ("partial_json",))):
            if isinstance(delta, str):
                grew = len(delta) if key == streamed else 0
            else:
                grew = sum(len(getattr(delta, name, None) or "") for name in names) if delta is not None else 0
                if key == "tool":
                    grew += sum(
                        len(getattr(getattr(call, "function", None), "arguments", None) or "")
                        for call in getattr(delta, "tool_calls", None) or []
                    )
            seen[key] += grew
            last = elapsed if grew else last
        yield event


def read_stream(stream, started, timing, limit=MODEL_STREAM_LIMIT):
    """Assemble a streamed Chat Completions reply; return (message, usage)."""
    content, calls, usage = [], {}, None
    for chunk in watched(stream, started, timing, limit):
        usage = getattr(chunk, "usage", None) or usage
        for choice in chunk.choices or []:
            delta = choice.delta
            content.append(delta.content or "")
            for part in delta.tool_calls or []:
                call = calls.setdefault(part.index, {"id": "", "name": "", "arguments": ""})
                call["id"] = call["id"] or part.id or ""
                if part.function:
                    call["name"] = call["name"] or part.function.name or ""
                    call["arguments"] += part.function.arguments or ""
    tool_calls = [
        SimpleNamespace(id=call["id"], function=SimpleNamespace(name=call["name"], arguments=call["arguments"]))
        for _, call in sorted(calls.items())
    ]
    return SimpleNamespace(content="".join(content) or None, tool_calls=tool_calls or None), usage


def openai_reply(ctx, settings, messages, tools, tool_choice, read_timeout, started, timing, cache_key, stream_limit=MODEL_STREAM_LIMIT):
    import httpx
    import openai

    claude = "claude" in settings["model"]
    request = {
        "model": settings["model"],
        "messages": messages,
        "stream": True,
        "stream_options": {"include_usage": True},
        "timeout": openai.Timeout(read_timeout, connect=30),
    }
    if tools:
        # Claude rejects forced tool use through a gateway's OpenAI-format endpoint too (see claude_reply).
        request.update(tools=tools, tool_choice="auto" if claude else tool_choice)
    if settings["effort"]:
        request["reasoning_effort"] = settings["effort"]
    if claude and settings["max_tokens"]:
        request["max_tokens"] = settings["max_tokens"]
    if cache_key:
        # One key per packet keeps the finder's and checker's requests, which share the bundle, on the same cache.
        request["extra_body"] = {"prompt_cache_key": cache_key}
    try:
        with ctx.clients[settings["slot"]].chat.completions.create(**request) as stream:
            return read_stream(stream, started, timing, stream_limit)
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        raise StreamStalled(error_text(exc)) from exc


def responses_input(messages):
    """Chat Completions messages as Responses instructions and input items. An assistant turn's reasoning
    goes back before its text and calls, so the model keeps its train of thought between turns."""
    instructions, items = [], []
    for message in messages:
        role, content = message["role"], message.get("content")
        if role == "system":
            instructions.append(content)
        elif role == "tool":
            items.append({"type": "function_call_output", "call_id": message["tool_call_id"], "output": content})
        elif role == "assistant":
            items.extend(message.get("reasoning_items") or [])
            if content:
                items.append({"role": "assistant", "content": content})
            items.extend(
                {
                    "type": "function_call",
                    "call_id": call["id"],
                    "name": call["function"]["name"],
                    "arguments": call["function"]["arguments"],
                }
                for call in message.get("tool_calls") or []
            )
        elif content:
            items.append({"role": "user", "content": content})
    return "\n\n".join(instructions), items


def responses_reply(ctx, settings, messages, tools, tool_choice, read_timeout, started, timing, cache_key, stream_limit=MODEL_STREAM_LIMIT):
    """One streamed Responses call, returned in the Chat Completions shape the agents use."""
    import httpx
    import openai

    instructions, items = responses_input(messages)
    request = {
        "model": settings["model"],
        "input": items,
        # Nothing is kept on the provider; the encrypted reasoning comes back so the next turn can resend it.
        "store": False,
        "include": ["reasoning.encrypted_content"],
        "stream": True,
        "timeout": openai.Timeout(read_timeout, connect=30),
    }
    if instructions:
        request["instructions"] = instructions
    if tools:
        request["tools"] = [{"type": "function", "strict": False, **tool["function"]} for tool in tools]
        # "auto" and "required" pass through; only the named form takes Responses' own shape.
        request["tool_choice"] = (
            {"type": "function", "name": tool_choice["function"]["name"]} if isinstance(tool_choice, dict) else tool_choice
        )
    if settings["effort"]:
        request["reasoning"] = {"effort": settings["effort"]}
    if cache_key:
        request["extra_body"] = {"prompt_cache_key": cache_key}
    response, capped = None, False
    try:
        with ctx.clients[settings["slot"]].responses.create(**request) as stream:
            for event in watched(stream, started, timing, stream_limit):
                if event.type in ("response.completed", "response.incomplete"):
                    response = event.response
                    # An incomplete response was cut short, by the output cap or a filter, as Claude's max_tokens stop.
                    capped = event.type == "response.incomplete"
                elif event.type in ("response.failed", "error"):
                    failure = getattr(getattr(event, "response", None), "error", None) or event
                    raise ResponseFailed(getattr(failure, "message", None) or "the provider gave no message", getattr(failure, "code", None))
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        raise StreamStalled(error_text(exc)) from exc
    if response is None:
        raise StreamStalled("the reply stream ended before the response completed")
    text, calls, reasoning = [], [], []
    for item in response.output or []:
        if item.type == "message":
            text += [part.text for part in item.content or [] if getattr(part, "type", "") == "output_text"]
        elif item.type == "function_call" and not capped:
            # A call in a cut-short response may have lost the end of its arguments (see claude_reply).
            calls.append(SimpleNamespace(id=item.call_id, function=SimpleNamespace(name=item.name, arguments=item.arguments)))
        elif item.type == "reasoning" and getattr(item, "encrypted_content", None):
            reasoning.append(item.model_dump(exclude_none=True))
    prompt = usage_value(response.usage, "input_tokens")
    output = usage_value(response.usage, "output_tokens")
    usage = {
        "prompt_tokens": prompt,
        "completion_tokens": output,
        "total_tokens": prompt + output,
        "prompt_tokens_details": {"cached_tokens": usage_value(response.usage, "input_tokens_details", "cached_tokens")},
        "completion_tokens_details": {"reasoning_tokens": usage_value(response.usage, "output_tokens_details", "reasoning_tokens")},
    }
    message = SimpleNamespace(content="".join(text) or None, tool_calls=calls or None, reasoning_items=reasoning, capped=capped)
    return message, usage


def claude_messages(messages):
    """Chat Completions messages as Claude's system blocks and turns, with cache breakpoints after the
    system prompt, on the first message (the packet both finders share) and on the newest block."""
    system, turns = [], []
    for message in messages:
        role, content = message["role"], message.get("content")
        if role == "system":
            system.append({"type": "text", "text": content})
            continue
        if role == "assistant":
            # Claude's own blocks go back unchanged: thinking must be returned with its signature.
            blocks = message.get("claude_blocks") or ([{"type": "text", "text": content}] if content else [])
        elif role == "tool":
            blocks = [{"type": "tool_result", "tool_use_id": message["tool_call_id"], "content": content}]
        else:
            blocks = [{"type": "text", "text": content}] if content else []
        speaker = "assistant" if role == "assistant" else "user"
        if not blocks:
            continue
        if turns and turns[-1]["role"] == speaker:
            turns[-1]["content"].extend(blocks)
        else:
            turns.append({"role": speaker, "content": list(blocks)})
    if system:
        system[-1] = {**system[-1], "cache_control": CACHE_BREAKPOINT}
    for blocks, index in ((turns[0]["content"], 0), (turns[-1]["content"], -1)) if turns else ():
        blocks[index] = {**blocks[index], "cache_control": CACHE_BREAKPOINT}
    return system, turns


def claude_reply(ctx, settings, messages, tools, tool_choice, read_timeout, started, timing, cache_key, stream_limit=MODEL_STREAM_LIMIT):
    """One streamed Claude Messages call, returned in the Chat Completions shape the agents use."""
    import anthropic
    import httpx2

    system, turns = claude_messages(messages)
    request = {
        "model": settings["model"],
        "max_tokens": settings["max_tokens"] or ROLE_DEFAULTS["finder"]["max_tokens"],
        "system": system,
        "messages": turns,
        "timeout": anthropic.Timeout(read_timeout, connect=30),
    }
    if tools:
        # The API holds back each tool-input parameter until it is complete, so a submission's findings list streams
        # nothing while it is written: a Sonnet finder at low ran out its 600 s box with 912 tool-input characters
        # shown. Eager streaming sends the input as it is written, so a cut-off reply says how far it got.
        request["tools"] = [
            {
                "name": tool["function"]["name"],
                "description": tool["function"]["description"],
                "input_schema": tool["function"]["parameters"],
                "eager_input_streaming": True,
            }
            for tool in tools
        ]
        # Opus 5.5 and Sonnet 5.5 reject forced tool use, so the tool choice is always left to Claude;
        # once a budget is spent, run_agent refuses every tool but the submit tool.
        request["tool_choice"] = {"type": "auto"}
    if settings["effort"]:
        # OpenRouter passes effort to Claude unchanged only beside a thinking field. Alone, it becomes OpenRouter's
        # own reasoning setting, under which Haiku thought until the output cap on every first call.
        request["thinking"] = {"type": "adaptive", "display": "summarized"}
        request["output_config"] = {"effort": settings["effort"]}
    try:
        with ctx.clients[settings["slot"]].messages.stream(**request) as stream:
            for _ in watched(stream, started, timing, stream_limit):
                pass
            reply = stream.get_final_message()
    except (httpx2.TimeoutException, httpx2.TransportError) as exc:
        raise StreamStalled(error_text(exc)) from exc
    if reply.stop_reason is None:
        # A connection that closes mid-reply ends the stream without an error or a stop reason.
        raise StreamStalled("the reply stream ended before Claude finished")
    capped = reply.stop_reason == "max_tokens"
    blocks, text, calls = [], [], []
    for block in reply.content:
        if block.type == "tool_use" and capped:
            # The cap cut this call off partway through its input, which would otherwise be taken as a short
            # submission.
            continue
        if block.type == "tool_use":
            blocks.append({"type": "tool_use", "id": block.id, "name": block.name, "input": block.input})
            calls.append(
                SimpleNamespace(id=block.id, function=SimpleNamespace(name=block.name, arguments=json.dumps(block.input)))
            )
        elif block.type == "text":
            text.append(block.text)
            if block.text:
                blocks.append({"type": "text", "text": block.text})
        else:
            blocks.append(block.model_dump(exclude_none=True))
    cached = reply.usage.cache_read_input_tokens or 0
    written = reply.usage.cache_creation_input_tokens or 0
    prompt = reply.usage.input_tokens + written + cached
    usage = {
        "prompt_tokens": prompt,
        "completion_tokens": reply.usage.output_tokens,
        "total_tokens": prompt + reply.usage.output_tokens,
        "prompt_tokens_details": {"cached_tokens": cached, "cache_write_tokens": written},
        "completion_tokens_details": {"reasoning_tokens": usage_value(reply.usage, "output_tokens_details", "thinking_tokens")},
    }
    message = SimpleNamespace(content="".join(text) or None, tool_calls=calls or None, claude_blocks=blocks, capped=capped)
    return message, usage


def transient_error(exc):
    """A gateway error worth retrying: unavailable, overloaded, rate limited, or a dropped connection.

    A gateway can report these inside the reply stream, as a bare APIError the client never retries.
    """
    if isinstance(exc, StreamStalled):
        return True
    if isinstance(exc, ResponseFailed):
        # Any other code, such as invalid_prompt, fails the same way on every resend. A failure a gateway relays
        # without a code is retried, like a bare APIError below.
        return exc.code in ("", "server_error", "rate_limit_exceeded")
    import anthropic
    import openai

    if isinstance(exc, anthropic.APIStatusError):
        # An error event inside a Claude stream carries the stream's 200 and names its kind in the body.
        body = getattr(exc, "body", None) if isinstance(getattr(exc, "body", None), dict) else {}
        error = body.get("error") if isinstance(body.get("error"), dict) else body
        kind = error.get("type")
        return exc.status_code == 429 or exc.status_code >= 500 or kind in {"overloaded_error", "api_error", "rate_limit_error"}
    if isinstance(exc, openai.APIStatusError):
        return exc.status_code == 429 or exc.status_code >= 500
    return isinstance(exc, (openai.APIError, anthropic.APIError))


class CostLimitReached(Exception):
    """The review has spent its DOTTORE_COST_LIMIT_USD, so no further model call is made."""


def chat(ctx, role, messages, tools, tool_choice, cache_key="", until=None, settings=None):
    settings = settings or ctx.models[role]
    with ctx.lock:
        if ctx.cost_limit and ctx.spent_usd >= ctx.cost_limit:
            raise CostLimitReached(
                f"the review has spent ${ctx.spent_usd:.3f}, its ${ctx.cost_limit:.2f} limit, so it makes no more model calls"
            )
        if ctx.failures.get(role, 0) >= MAX_ROLE_FAILURES:
            raise RuntimeError(f"the {role} role failed {MAX_ROLE_FAILURES} calls in a row, so it makes no more")
    first_call = not any(message.get("role") == "assistant" for message in messages)
    reply = {"anthropic": claude_reply, "responses": responses_reply}.get(settings["api"], openai_reply)
    # The client retries a request that fails before its stream opens. This retries one that stalls after
    # it at once, at most MODEL_MAX_RETRIES times since each stall has already used a read timeout, and
    # waits out a transient gateway error, which can arrive mid-stream with a request to resend. A role whose calls
    # give up MAX_ROLE_FAILURES times in a row stops: a dead endpoint costs no more. Attempts are not counted, so a
    # rate-limit burst across parallel calls does not trip the breaker before any of them retries.
    stalls = 0
    for attempt in range(len(RETRY_DELAYS) + 1):
        started = time.monotonic()
        timing = {}
        if len(tools) == 1 and until:
            # Offered only its submit tool, the model does all its thinking before its first byte, which over a
            # whole bundle takes minutes, so it may stay silent for the rest of the role's time box (`minutes`).
            # Meaningful stream progress refreshes that idle allowance; the workflow still bounds an in-flight call.
            read_timeout = stream_limit = max(FIRST_CALL_TIMEOUT, until - started)
        else:
            read_timeout, stream_limit = (FIRST_CALL_TIMEOUT if first_call else MODEL_REQUEST_TIMEOUT), MODEL_STREAM_LIMIT
        try:
            message, usage = reply(ctx, settings, messages, tools, tool_choice, read_timeout, started, timing, cache_key, stream_limit)
            break
        except Exception as exc:
            stalled = isinstance(exc, StreamStalled)
            stalls += stalled
            retry = stalls <= MODEL_MAX_RETRIES if stalled else transient_error(exc)
            if not retry or attempt == len(RETRY_DELAYS):
                with ctx.lock:
                    ctx.failures[role] = ctx.failures.get(role, 0) + 1
                raise
            wait = 0 if stalled else RETRY_DELAYS[attempt]
            print(
                f"Dottore call retry: role={role}; attempt={attempt + 1}; after_s={time.monotonic() - started:.1f}; "
                f"wait_s={wait}; {error_text(exc)}",
                flush=True,
            )
            time.sleep(wait)
    with ctx.lock:
        ctx.failures[role] = 0
        totals = ctx.stats["roles"][role]
        totals["model"] = settings["model"]
        totals["model_calls"] += 1
        add_usage(totals, usage)
        cost = call_cost_usd(settings["model"], usage)
        totals["usd"] += cost
        ctx.spent_usd += cost
    # request_chars lets the provider's token counts be compared with what was actually sent.
    print(
        f"Dottore call: role={role}; messages={len(messages)}; "
        f"request_chars={len(json.dumps([messages, tools], ensure_ascii=False))}; "
        f"prompt_tokens={usage_value(usage, 'prompt_tokens')}; "
        f"cached_tokens={usage_value(usage, 'prompt_tokens_details', 'cached_tokens')}; "
        f"cache_write_tokens={usage_value(usage, 'prompt_tokens_details', 'cache_write_tokens')}; "
        f"completion_tokens={usage_value(usage, 'completion_tokens')}; "
        f"reasoning_tokens={usage_value(usage, 'completion_tokens_details', 'reasoning_tokens')}; "
        f"first_chunk_s={timing.get('first_chunk', 0):.1f}; elapsed_s={time.monotonic() - started:.1f}; "
        f"review_spent_usd={ctx.spent_usd:.3f}",
        flush=True,
    )
    return message


def lower_effort(effort):
    """The effort one level below the given one, or "" when there is none or the value is not a known level."""
    levels = {level: index for index, level in enumerate(EFFORT_LEVELS)}
    index = levels.get(str(effort or "").lower(), 0)
    return EFFORT_LEVELS[index - 1] if index else ""


def assistant_turn(message, **fields):
    """The assistant message to keep in history, with Claude's original blocks or the Responses reasoning
    when the provider sent them."""
    kept = {key: getattr(message, key, None) for key in ("claude_blocks", "reasoning_items")}
    return {"role": "assistant", **fields, **{key: value for key, value in kept.items() if value}}


def tool_call_key(call):
    try:
        args = json.dumps(json.loads(call.function.arguments or "{}"), sort_keys=True)
    except ValueError:
        args = call.function.arguments
    return call.function.name, args


def call_arguments(call):
    """A tool call's arguments, or None when they are not one JSON object."""
    try:
        arguments = json.loads(call.function.arguments or "{}")
    except ValueError:
        return None
    return arguments if isinstance(arguments, dict) else None


def run_agent(ctx, role, messages, submit_tool, deadline=None, cache_key="", budget=None, output_budget=None, keep=None):
    """Let one agent read with the tools until it calls its submit tool; return the submitted arguments.

    The role's reads count read-tool calls and its chars their characters (budget and output_budget override them);
    a repeated call is answered from the earlier result for free. A role without reads is offered only its submit
    tool. Once either budget is spent, or the deadline (the review's by default, and no later than the role's
    minutes from now) has passed, the model is made to call the submit tool, and a few malformed submissions are
    tolerated. The role's stats record which limit, if any, ended the run.

    With keep, the name of the submit tool's list argument, the submit tool does not end the run: each call adds its
    items, and the first turn that makes no read, or the turn after a limit, ends it with every item kept. No final
    call restates them, and a limit loses only the reads not yet kept.

    A reply cut off at its output cap without a tool call is sent once more at the next lower effort. A cap that
    cannot be retried raises, or ends a keep run that has kept items with them.
    """
    settings = ctx.models[role]
    budget = settings["reads"] if budget is None else budget
    output_budget = settings["chars"] if output_budget is None else output_budget
    submit = submit_tool["function"]["name"]
    # Claude's tool choice cannot be forced, so a role without reads is not offered them: Opus called the reads it
    # was offered and, refused, thought to its output cap on the next call.
    tools = [*READ_TOOLS, submit_tool] if budget else [submit_tool]
    claude = settings["api"] == "anthropic" or "claude" in settings["model"]
    messages = list(messages)
    kept = []
    used = 0
    spent = 0
    answered = {}
    deadline = deadline or ctx.deadline
    box = time.monotonic() + settings["minutes"] * 60 if settings.get("minutes") else deadline
    lowered = False
    for turn in range(budget + MAX_SUBMIT_ATTEMPTS):
        limits = [
            name
            for name, hit in (
                ("calls", bool(budget) and (used >= budget or turn >= budget)),
                ("chars", bool(budget) and spent >= output_budget),
                ("time", time.monotonic() > deadline),
                ("box", time.monotonic() > box),
            )
            if hit
        ]
        forced = bool(limits) or not budget
        choice = {"type": "function", "function": {"name": submit}} if forced else "auto"
        if forced and len(tools) == 1:
            # "required" forces the only tool and every gateway takes it; one LinkAPI route refuses the named form
            # with 400 "Missing required parameter: 'tool_choice.name'".
            choice = "required"
        if limits and claude and messages[-1]["role"] == "tool":
            # Claude cannot be made to submit, so it is told; its reads stay offered so the cached prefix holds.
            messages.append({"role": "user", "content": f"Your reads are spent and further reads are refused. Call {submit} now."})
        message = chat(ctx, role, messages, tools, choice, cache_key, until=min(deadline, box), settings=settings)
        calls = list(message.tool_calls or [])
        # Ahead of the keep return, which would take a capped reply's missing call for an empty submission.
        if not calls and getattr(message, "capped", False):
            lower = lower_effort(settings["effort"])
            if lowered or not lower or time.monotonic() > min(deadline, box):
                if kept:
                    # Like any other limit, the cap ends a keep run with the items already kept.
                    with ctx.lock:
                        ctx.stats["roles"][role]["stop_cap"] += 1
                    return {keep: kept}
                raise RuntimeError(f"the {role} reply reached its {settings['max_tokens']}-token output cap")
            # The cap was spent on thinking, so the same call is sent once more at the next lower effort, with a
            # time box of its own: the capped call has usually spent most of the first one.
            print(f"Dottore {role} reached its {settings['max_tokens']}-token output cap at effort {settings['effort']}; retrying once at {lower}", flush=True)
            settings = {**settings, "effort": lower}
            box = time.monotonic() + settings["minutes"] * 60 if settings.get("minutes") else deadline
            lowered = True
            continue
        if keep and (forced or all(call.function.name == submit for call in calls)):
            kept += [item for call in calls if call.function.name == submit for item in as_list((call_arguments(call) or {}).get(keep))]
            with ctx.lock:
                ctx.stats["roles"][role][f"stop_{limits[0] if limits else 'own'}"] += 1
            return {keep: kept}
        if not calls:
            print(f"Dottore {role} replied without a tool call: {redact_for_model(message.content or '')[:400]!r}", flush=True)
            if time.monotonic() > min(deadline, box):
                # Asking again takes as long as the first reply did: a one-call finder took 6-15 minutes a reply on 7288.
                raise RuntimeError(f"the {role} replied without calling {submit} and its time is spent")
            messages += [
                assistant_turn(message, content=message.content or ""),
                {"role": "user", "content": f"Call {submit} to finish."},
            ]
            continue
        messages.append(
            assistant_turn(
                message,
                content=message.content,
                tool_calls=[
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {"name": call.function.name, "arguments": call.function.arguments},
                    }
                    for call in calls
                ],
            )
        )
        for call in calls:
            if call.function.name == submit and keep:
                added = as_list((call_arguments(call) or {}).get(keep))
                kept += added
                reply = f"Kept {len(added)}; {len(kept)} kept so far."
            elif call.function.name == submit:
                submitted = call_arguments(call)
                if submitted is not None:
                    with ctx.lock:
                        ctx.stats["roles"][role][f"stop_{limits[0] if limits else 'own'}"] += 1
                    return submitted
                reply = f"refused: {submit} needs one JSON object as its arguments; call it again."
            elif tool_call_key(call) in answered:
                reply = f"Already returned above as tool call {answered[tool_call_key(call)]}; reuse that result."
            elif forced or used >= budget or spent >= output_budget:
                reply = f"refused: the tool budget is spent; call {submit} now."
            else:
                used += 1
                answered[tool_call_key(call)] = used
                reply = truncate(run_tool(ctx, call.function.name, call.function.arguments), output_budget - spent)
                spent += len(reply)
                with ctx.lock:
                    ctx.stats["roles"][role]["tool_calls"] += 1
                    ctx.stats["roles"][role]["tool_chars"] += len(reply)
            messages.append({"role": "tool", "tool_call_id": call.id, "content": reply})
    raise RuntimeError(f"The {role} agent never called {submit}.")


def prompt_sections(text):
    """The reviewer prompt split by its "## " headings; the text before the first one is under ""."""
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)
    sections, name = {"": []}, ""
    for line in text.splitlines():
        if line.startswith("## "):
            name = line[3:].strip()
            sections[name] = []
        else:
            sections[name].append(line)
    return {name: "\n".join(lines).strip() for name, lines in sections.items()}


def role_prompt(ctx, name, **values):
    """A role's section with the shared list of where changes break and its other placeholders filled."""
    text = ctx.prompts[name].replace("{WHERE_CHANGES_BREAK}", ctx.prompts["Where Changes Break"])
    for key, value in values.items():
        text = text.replace("{" + key + "}", str(value))
    return text


def reviewer_system(prompts):
    """The system prompt the finder and checker share, so their calls on a packet reuse one cached prefix."""
    return "\n\n".join(
        [prompts[""], *(f"## {name}\n\n{prompts[name]}" for name in ("Voice Contract", "Output Shape", "Verdict Shape"))]
    )


def finder_packet(review_target, focus_note, prior_contracts, bundle):
    # Shared by the finder and the checker and placed before their instructions, so providers can cache it.
    return f"{review_target} {focus_note}\n\n# Prior Dottore Repair Contracts\n{prior_contracts}\n\n{bundle}"


def tools_line(settings, in_view):
    """The sentence that tells a role what it can see: the bundle alone, or the read-only tools within its budget."""
    if not settings["reads"]:
        return f"You have no tools: {in_view} all you see."
    return (
        f"{in_view[:1].upper()}{in_view[1:]} in view; the read-only tools (read_file, search, file_diff, base_version) "
        f"reach the rest of the repository within {settings['reads']} tool calls and {settings['chars']} characters of "
        "tool output. Do not fetch what is already in view, put independent reads in one turn, and spend reads on the "
        "deciding code; a repeated call returns nothing new."
    )


def finder_instructions(ctx):
    settings = ctx.models["finder"]
    return f"{role_prompt(ctx, 'Finder', TOOLS=tools_line(settings, 'the bundle is'))}\n\nFinish by calling submit_findings."


def head_line_exists(path, line):
    try:
        return line <= len(head_file_text(path).splitlines())
    except Exception:
        return False


KEEP_PLACES = function_tool(
    "keep_places",
    "Keep places whose code the reviewers need, as soon as you have read them. Each call adds to the places kept.",
    {
        "places": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "path": PATH_PARAM,
                    **LINE_RANGE,
                    "why": {"type": "string", "description": "One clause: what this code is and how the change reaches it."},
                    "base": {"type": "boolean", "description": "true for lines at the review base, where the PR removed or rewrote them."},
                },
                "required": ["path", "start", "end", "why"],
            },
        }
    },
    ["places"],
)


def scout_places(ctx, submitted, shown, limit):
    """The scout's valid places, at most limit: (path, start, end, why, base). A place in a test file, without lines
    at the head (or the base, when marked), or already shown by the bundle is dropped; one longer than
    MAX_SCOUT_LINES is cut."""
    kept = []
    for place in as_list(submitted.get("places")):
        if len(kept) == limit:
            break
        if not isinstance(place, dict):
            continue
        try:
            path = tool_path(place.get("path"))
        except ValueError:
            continue
        start, end, base = place.get("start"), place.get("end"), place.get("base") is True
        if any(isinstance(value, bool) or not isinstance(value, int) or value <= 0 for value in (start, end)) or end < start:
            continue
        end = min(end, start + MAX_SCOUT_LINES - 1)
        if TEST_PATH_RE.search(path) or (not base and shown_in(shown, path, start, end)):
            continue
        try:
            if start > len((base_file_text(ctx, path) if base else head_file_text(path)).splitlines()):
                continue
        except Exception:
            continue
        if any(kept_path == path and kept_base == base and kept_start <= start and end <= kept_end
               for kept_path, kept_start, kept_end, _, kept_base in kept):
            continue
        why = " ".join(redact_for_model(str(place.get("why") or "")).split())[:MAX_PLACE_WHY_CHARS]
        kept.append((path, start, end, why, base))
    return kept


def scout_code(ctx, places):
    """The places quoted by code, in the bundle's format, with the PR's changed lines marked; cut at MAX_SCOUT_CHARS."""
    sections = []
    for path, start, end, why, base in places:
        try:
            lines = (base_file_text(ctx, path) if base else head_file_text(path)).splitlines()
        except Exception:
            continue
        if start > len(lines):
            continue
        end = min(end, len(lines))
        changed = set() if base else ctx.allowed.get(path, {}).get("RIGHT", set())
        body = "\n".join(f"{number}{'+' if number in changed else ':'} {lines[number - 1]}" for number in range(start, end + 1))
        where = " at the review base" if base else ""
        sections.append(f"## {path}:{start}-{end}{where} ({why})\n```text\n{redact_for_model(body)}\n```")
    return truncate("\n\n".join(sections), MAX_SCOUT_CHARS), len(sections)


def scout_shares(ctx, index, count):
    """The packet's changed production code split into at most count shares of about equal size, each a run of
    changed functions in path and line order: [[(path, name, first changed line, last, changed lines), ...], ...]."""
    removed = removed_lines(ctx.base)
    areas = []
    for path in ctx.chunks[index] if ctx.chunks else sorted(ctx.allowed):
        if not path.endswith(CODE_SUFFIXES) or TEST_PATH_RE.search(path):
            continue
        try:
            lines = head_file_text(path).splitlines()
        except Exception:
            continue
        blocks = {}
        for number in sorted({*ctx.allowed.get(path, {}).get("RIGHT", ()), *removed.get(path, {})}):
            block = enclosing_block(lines, min(number, len(lines))) if lines else None
            blocks.setdefault((block[1], f"`{block[0]}`") if block else (0, "top-level code"), []).append(number)
        areas += sorted(((path, name, numbers[0], numbers[-1], len(numbers)) for (_, name), numbers in blocks.items()), key=lambda area: area[2])
    total = sum(area[4] for area in areas)
    shares, done = [], 0
    for area in areas:
        if not shares or (len(shares) < count and done >= total * len(shares) / count):
            shares.append([])
        shares[-1].append(area)
        done += area[4]
    return shares


def run_scout(ctx, index, share, scouts):
    """One scout over one packet's share: it reads outward from the bundle and keeps places as it goes. Returns the
    places it kept, unchecked."""
    settings = ctx.models["scout"]
    messages = [
        {
            "role": "system",
            "content": role_prompt(ctx, "Scout", places=settings["places"], lines=MAX_SCOUT_LINES, TOOLS=tools_line(settings, "the bundle is")),
        },
        {"role": "user", "content": ctx.bundles[index]},
    ]
    if scouts > 1:
        # After the bundle, so every scout on the packet reuses its cached prefix.
        messages.append(
            {
                "role": "user",
                "content": "# Your Share\nOther scouts gather for the rest of the change at the same time. Gather for these changes:\n"
                + "\n".join(
                    f"- {name} in {path}: " + (f"{count} changed lines from {first} to {last}" if last > first else f"changed line {first}")
                    for path, name, first, last, count in share
                ),
            }
        )
    kept = run_agent(
        ctx,
        "scout",
        messages,
        KEEP_PLACES,
        deadline=ctx.deadline - CHECKER_RESERVE_SECONDS - ctx.models["finder"]["minutes"] * 60,
        cache_key=f"{ctx.cache_key}-s{index}",
        keep="places",
    )["places"]
    print(f"Dottore scout: packet={index}; share={', '.join(area[1] for area in share) or 'all'}; kept={len(kept)}", flush=True)
    return kept[: settings["places"]]


def scout_bundles(ctx, pool):
    """Stage 0: scouts on each packet, one per share of its changes, add the code the bundle builder could not follow,
    before any reviewer runs. Off when the scout has no reads or no places. A failed scout is logged and its share
    keeps the code-built bundle. Returns how many scouts failed and how many ran."""
    settings = ctx.models["scout"]
    if not settings["reads"] or not settings["places"] or not settings["scouts"]:
        print("Dottore scout: off", flush=True)
        return 0, 0
    # ponytail: the scouts share the review's DOTTORE_CONCURRENCY workers, so a PR split into packets runs more scouts
    # than workers in turn; raise DOTTORE_CONCURRENCY to run them all at once.
    jobs = [
        (index, pool.submit(staggered, CACHE_STAGGER_SECONDS * bool(number), run_scout, ctx, index, share, len(shares)))
        for index in range(len(ctx.bundles))
        for shares in [scout_shares(ctx, index, settings["scouts"]) or [[]]]
        for number, share in enumerate(shares)
    ]
    failures = 0
    gathered = {index: [] for index in range(len(ctx.bundles))}
    for index, future in jobs:
        try:
            gathered[index].append(future.result())
        except Exception as exc:
            failures += 1
            print(f"Dottore scout failed on packet {index}: {error_text(exc)}", flush=True)
    for index, lists in gathered.items():
        # Round-robin, so the character limit cuts every scout's last places rather than one scout's all.
        merged = [place for row in itertools.zip_longest(*lists) for place in row if place is not None]
        places = scout_places(ctx, {"places": merged}, bundle_ranges(ctx.bundles[index]), len(merged))
        code, added = scout_code(ctx, places)
        print(f"Dottore scout: packet={index}; scouts={len(lists)}; kept={len(merged)}; valid={len(places)}; added={added}; chars={len(code)}", flush=True)
        for path, start, end, why, base in places:
            print(f"Dottore place: {path}:{start}-{end}{' (base)' if base else ''}; {why}", flush=True)
        if code:
            section = f"\n\n# Code the Scout Added\n{SCOUT_NOTE}\n\n{code}"
            ctx.bundles[index] += section
            ctx.packets[index] += section
    with ctx.lock:
        ctx.stats["bundle_chars"] = sum(len(bundle) for bundle in ctx.bundles)
    return failures, len(jobs)


def staggered(delay, function, *args, **kwargs):
    time.sleep(delay)
    return function(*args, **kwargs)


def run_finders(ctx, pool):
    """Stage 1: the finder copies run over every packet concurrently. Returns the finder reports as (label, packet,
    report). A finder failure ends the review."""
    copies = finder_count()
    finders = [
        (
            "finder" if copy == 0 else f"finder-{copy + 1}",
            index,
            pool.submit(
                staggered,
                CACHE_STAGGER_SECONDS * copy,
                run_agent,
                ctx,
                "finder",
                [
                    {"role": "system", "content": ctx.system},
                    {"role": "user", "content": packet},
                    {"role": "user", "content": finder_instructions(ctx)},
                ],
                SUBMIT_FINDINGS,
                deadline=ctx.deadline - CHECKER_RESERVE_SECONDS,
                cache_key=f"{ctx.cache_key}-p{index}",
            ),
        )
        for index, packet in enumerate(ctx.packets)
        for copy in range(copies)
    ]
    try:
        return [(label, index, future.result()) for label, index, future in finders]
    except Exception:
        for _, _, future in finders:
            future.cancel()
        raise


# ponytail: line-based declaration patterns, not a parser. An unnamed callback or an unusual signature
# yields no seed, and the finder still has the diff and its tools; move to tree-sitter if seeds miss.
NAMED_BLOCK_RES = (
    re.compile(r"\b(?:function\*?|class|def)\s+([A-Za-z_$][\w$]*)"),
    re.compile(
        r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|"
        r"(?:React\.)?use(?:Callback|Memo)\(|(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+?)?=>|\([^()]*$)"
    ),
    # Object-literal and class methods; their callers reach them through an object, so search the repo.
    re.compile(r"^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s+)?(?:function\b|\([^()]*\)\s*(?::[^=]+?)?=>)"),
    re.compile(
        r"^\s*(?:(?:export|default|public|private|protected|static|async|readonly|override|get|set)\s+)*"
        r"\*?([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\((?!.*\bfunction\b)[^=]*\)\s*(?::[^{=]+)?\{\s*$"
    ),
)
DECLARED_RE = re.compile(
    r"\b(?:const|let|var|function\*?|class|def)\s+([A-Za-z_$][\w$]*)"
    r"|^\s*(?:export\s+)?(?:declare\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)"
)
TEST_PATH_RE = re.compile(r"(^|/)(tests?|e2e|__tests__|regressions?)/|\.(test|spec|regression|e2e)\.")
NOT_NAMES = {"if", "for", "while", "switch", "catch", "return", "function", "else", "do", "try", "with", "new", "constructor"}
# A call by name, including through an object (`store.applyManualEdits(`), matched to a same-file declaration.
CALLED_NAME_RE = re.compile(r"(?<![\w$])([A-Za-z_$][\w$]*)\s*\(")


def declared_names(lines):
    """Each named block's first declaration line, by name."""
    declared = {}
    for number, text in enumerate(lines, 1):
        for pattern in NAMED_BLOCK_RES:
            match = pattern.search(text)
            if match and match.group(1) not in NOT_NAMES:
                declared.setdefault(match.group(1), number)
                break
    return declared


def enclosing_block(lines, number, limit=None):
    """The named function, method or class whose declaration encloses a line, by indentation: (name, line, kind, text).

    With limit, only a declaration indented less than limit counts, which finds the block around a declaration.
    """
    for index in range(number - 1, -1, -1):
        text = lines[index]
        stripped = text.strip()
        depth = len(text) - len(text.lstrip())
        if not stripped or (limit is not None and depth >= limit):
            continue
        for kind, pattern in enumerate(NAMED_BLOCK_RES):
            match = pattern.search(text)
            if match and match.group(1) not in NOT_NAMES:
                return match.group(1), index + 1, kind, text
        # A closing bracket ends a multi-line signature, so the declaration can still be above at this depth.
        if not stripped.startswith((")", "]", "}")):
            limit = depth
    return None


def private_name(path, kind, declaration):
    """True when only its own file can use a name: an unexported JS/TS function or const. Methods and
    Python names are reached from other files, so those are searched across the repository."""
    return kind < 2 and "export" not in declaration and not path.endswith(".py")


def name_uses(path, name, local, touched):
    """Whole-word uses of a name outside the diff: in its own file when local, otherwise across the repository."""
    if local:
        pattern = re.compile(rf"(?<![\w$]){re.escape(name)}(?![\w$])")
        hits = [
            f"{path}:{number}: {line.strip()[:220]}"
            for number, line in enumerate(head_file_text(path).splitlines(), 1)
            if pattern.search(line) and len(line) <= MAX_SEARCH_LINE_CHARS
        ]
    else:
        found = search_repo(name, code=True)
        hits = [] if found == "no matches" or found.startswith("refused:") else found.splitlines()
    outside = []
    for hit in hits:
        hit_path, line_no, _ = hit.split(":", 2)
        if line_no.isdigit() and int(line_no) in touched.get(hit_path, {}).get("RIGHT", ()):
            continue
        outside.append(hit)
    return outside[:MAX_SEED_HITS_PER_NAME]


def trace_seeds(touched, every=None):
    """Where each changed function and each name declared on a changed line in touched is used outside the diff
    (every changed line of the PR, touched by default)."""
    every = every or touched
    blocks = {}
    declared = {}
    for path, sides in sorted(touched.items()):
        if not path.endswith(CODE_SUFFIXES) or not sides["RIGHT"]:
            continue
        try:
            lines = head_file_text(path).splitlines()
        except Exception:
            continue
        for number in sorted(sides["RIGHT"]):
            if number > len(lines):
                continue
            text = lines[number - 1]
            # Only module-level names: a local's uses sit in its enclosing block, and a file-wide search
            # for a short local name such as `start` mostly finds unrelated variables.
            if not text[:1].isspace() and not text.startswith(("//", "*", "/*", "#")):
                for match in DECLARED_RE.finditer(text):
                    declared.setdefault((path, match.group(1) or match.group(2)), (number, private_name(path, 0, text)))
            block = enclosing_block(lines, number)
            if block:
                name, line, kind, decl = block
                blocks.setdefault((path, name), (line, private_name(path, kind, decl)))
    seeds = [(key, value, "changed lines inside it") for key, value in blocks.items()]
    seeds += [(key, value, "declared on a changed line") for key, value in declared.items() if key not in blocks]
    # Production code first, so the seed limit trims tests.
    seeds.sort(key=lambda seed: bool(TEST_PATH_RE.search(seed[0][0])))
    sections = []
    sites = []
    for (path, name), (line, local), why in seeds[:MAX_TRACE_SEEDS]:
        uses = [hit for hit in name_uses(path, name, local, every) if not hit.startswith(f"{path}:{line}:")]
        sites += [(hit_path, int(line_no)) for hit_path, line_no, _ in (hit.split(":", 2) for hit in uses) if line_no.isdigit()]
        scope = "uses in this file" if local else "uses in the repository"
        sections.append(
            f"### {name} ({why}; declared at {path}:{line}; {scope})\n"
            + ("\n".join(uses) or "Every use is inside the diff.")
        )
    return truncate("\n\n".join(sections), MAX_SEED_CHARS), len(seeds), sites


# ponytail: simple `const|let|var name =` declarations only, scoped to the nearest earlier one at the same or
# lower indentation that sits at module level or in a named function enclosing the reader. Destructuring and
# shadowing in an unnamed sibling block are missed or misread; a language server would resolve them properly.
VALUE_DECL_RE = re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=(?![=>])")
READ_NAME_RE = re.compile(r"(?<![\w$.])([A-Za-z_$][\w$]{2,})")


def statement_end(lines, start, limit=MAX_DEFINITION_LINES):
    """The last line of the statement starting at a 1-based line, by bracket balance, within limit lines."""
    last = min(len(lines), start + limit - 1)
    depth = 0
    for number in range(start, last + 1):
        text = lines[number - 1]
        depth += sum(text.count(char) for char in "([{") - sum(text.count(char) for char in ")]}")
        if depth <= 0:
            return number
    return last


def enclosing_chain(lines, number):
    """Declaration lines of every named block enclosing a line, innermost first."""
    chain = []
    block = enclosing_block(lines, number)
    while block:
        chain.append(block[1])
        depth = len(block[3]) - len(block[3].lstrip())
        block = enclosing_block(lines, block[1] - 1, limit=depth) if depth and block[1] > 1 else None
    return chain


def value_definitions(touched, sites):
    """Where each local value read at the change is defined, then where that definition's inputs are, as
    (path, start, end, name, read_at) spans.

    The change is read on its changed lines and at the call sites of changed functions, where a condition
    often continues on the next lines. A bug there can sit in how a value it combines with was built, such
    as a set filtered for a whole audience, which the diff names but does not show.
    """
    readers = {}
    for path, sides in touched.items():
        readers.setdefault(path, []).extend(sorted(sides["RIGHT"]))
    for path, line in sites:
        readers.setdefault(path, []).extend(range(line, line + SITE_LINES_AFTER + 1))
    found = []
    for path, numbers in sorted(readers.items()):
        if not path.endswith(CODE_SUFFIXES) or TEST_PATH_RE.search(path):
            continue
        try:
            lines = head_file_text(path).splitlines()
        except Exception:
            continue
        declared = {}
        for number, text in enumerate(lines, 1):
            match = VALUE_DECL_RE.match(text)
            if match:
                declared.setdefault(match.group(1), []).append((number, len(text) - len(text.lstrip())))
        owners = {}

        def owner(line):
            if line not in owners:
                block = enclosing_block(lines, line - 1, limit=len(lines[line - 1]) - len(lines[line - 1].lstrip())) if line > 1 else None
                owners[line] = block[1] if block else None
            return owners[line]

        changed = touched.get(path, {}).get("RIGHT", set())
        # The bundle already quotes these lines around each change, so a definition here is followed but not listed.
        shown = {line + offset for line in changed for offset in range(-BUNDLE_WINDOW, BUNDLE_WINDOW + 1)}
        visited = set()
        frontier = [(number, 1) for number in dict.fromkeys(numbers) if number <= len(lines)]
        while frontier:
            number, hop = frontier.pop(0)
            text = lines[number - 1]
            indent = len(text) - len(text.lstrip())
            # A definition counts only at module level or inside a function that encloses the reader;
            # otherwise the name is a parameter, and an earlier function's variable of that name is unrelated.
            scopes = {None, *enclosing_chain(lines, number)}
            for name in dict.fromkeys(READ_NAME_RE.findall(text.split("//")[0])):
                earlier = [
                    line
                    for line, depth in declared.get(name, ())
                    if line < number and depth <= indent and owner(line) in scopes
                ]
                if not earlier or (start := max(earlier)) in visited:
                    continue
                visited.add(start)
                end = statement_end(lines, start)
                if start not in shown:
                    found.append((path, start, end, name, number))
                if hop < DEFINITION_HOPS:
                    frontier += [(line, hop + 1) for line in range(start, end + 1)]
    print(
        f"Dottore definitions: found={len(found)}; quoted="
        + (", ".join(f"{path}:{start}-{end}({name})" for path, start, end, name, _ in found[:MAX_DEFINITIONS]) or "none"),
        flush=True,
    )
    return found[:MAX_DEFINITIONS]


def as_list(value):
    return value if isinstance(value, list) else []


def same_spot(left, right):
    def spot(item):
        line = item.get("line")
        return (
            str(item.get("path", "")).strip(),
            str(item.get("side") or "RIGHT").strip().upper(),
            line if isinstance(line, int) and not isinstance(line, bool) else None,
        )

    (left_path, left_side, left_line), (right_path, right_side, right_line) = spot(left), spot(right)
    if (left_path, left_side) != (right_path, right_side):
        return False
    if left_line is None or right_line is None:
        return left.get("line") == right.get("line")
    return abs(left_line - right_line) <= NEARBY_LINES


def merge_segments(reports):
    """Combine the finder reports without a model call."""
    merged = {key: [] for key in ("change_summary", "findings", "nitpicks", "open_questions")}
    checks = {}
    notes = []
    status_rank = {"fail": 0, "warn": 1, "unknown": 2, "pass": 3}
    severity_rank = {"blocking": 0, "high": 1, "medium": 2, "low": 3}
    for number, (role, packet, report) in enumerate(reports):
        if number == 0 or role == "finder":
            merged["change_summary"].extend(str(item) for item in as_list(report.get("change_summary")))
        for key in ("findings", "nitpicks"):
            for item in as_list(report.get(key)):
                if not isinstance(item, dict):
                    continue
                # Finder copies word the same defect differently and cite neighbouring lines, so findings
                # within a few lines of each other keep one candidate: the most severe. "segment"
                # names every finder that reported it, for telemetry.
                entry = {**item, "segment": role, "packet": packet}
                index = next(
                    (index for index, kept in enumerate(merged[key]) if same_spot(kept, entry)), None
                )
                if index is None:
                    merged[key].append(entry)
                    continue
                kept = merged[key][index]
                segments = "+".join(sorted({*kept["segment"].split("+"), role}))
                rank = severity_rank.get(str(item.get("severity", "")).lower(), 4)
                if rank < severity_rank.get(str(kept.get("severity", "")).lower(), 4):
                    kept = entry
                merged[key][index] = {**kept, "segment": segments}
        for check in as_list(report.get("pre_merge_checks")):
            if not isinstance(check, dict):
                continue
            name = str(check.get("name", "")).strip().lower()
            rank = status_rank.get(str(check.get("status", "")).lower(), 2)
            if name not in checks or rank < status_rank.get(str(checks[name].get("status", "")).lower(), 2):
                checks[name] = check
        for question in as_list(report.get("open_questions")):
            if question not in merged["open_questions"]:
                merged["open_questions"].append(question)
        notes.append(as_list(report.get("what_i_checked")))
    limitations = [check for check in checks.values() if control_type(check) == "Review Limitation"]
    merged["pre_merge_checks"] = [
        check
        for check in checks.values()
        if control_type(check) != "Review Limitation" or check in limitations[:MAX_REVIEW_LIMITATIONS]
    ]
    merged["nitpicks"] = merged["nitpicks"][:2]
    # Interleave the reports' notes so the rendered first few show each of them.
    merged["what_i_checked"] = [note for group in itertools.zip_longest(*notes) for note in group if note]
    return merged


def evidence_snippet(text):
    # Models often copy the numbered or diff-marked lines the tools and the bundle showed them.
    lines = [re.sub(r"^\s*\d+[:+] ?", "", re.sub(r"^[+-]", "", line)) for line in str(text or "").splitlines()]
    return " ".join(" ".join(lines).split())


def evidence_grounded(ctx, evidence, base=True):
    """True when at least one quoted snippet appears near its cited line in the head file, or with base the base file."""
    reads = (head_file_text, lambda path: base_file_text(ctx, path)) if base else (head_file_text,)
    for item in evidence:
        snippet = evidence_snippet(item.get("snippet"))
        if len(snippet) < 3:
            continue
        line = item.get("line")
        for read in reads:
            try:
                lines = read(item.get("path")).splitlines()
            except Exception:
                continue
            if isinstance(line, int) and not isinstance(line, bool) and line > 0:
                lines = lines[max(0, line - 1 - EVIDENCE_WINDOW) : line + EVIDENCE_WINDOW]
            window = "\n".join(lines)
            if any(snippet in " ".join(text.split()) for text in (window, redact_for_model(window))):
                return True
    return False


def verification_prompt(ctx, candidates):
    listed = []
    for number, candidate in enumerate(candidates, 1):
        entry = {key: getattr(candidate, key) for key in ("severity", "path", "line", "side", "title", "body", "fix_hint")}
        listed.append({"candidate": number, **entry})
    path = candidates[0].path
    reads, chars = verifier_budget(ctx, candidates)
    around = candidate_code(ctx, candidates[0].packet, [(c.path, c.line, c.side) for c in candidates])
    return (
        f"{role_prompt(ctx, 'Checker', TOOLS=tools_line({'reads': reads, 'chars': chars}, 'the bundle and the code around each candidate are'))}"
        "\n\nFinish by calling submit_verdicts with one verdict per candidate number."
        f"\n\n# Candidates in {path}\n{json.dumps(listed, indent=2)}"
        + (f"\n\n# Code Around the Candidates\nQuoted by code from the PR head where the bundle does not already show it, with the PR's changed lines marked `+`.\n\n{around}" if around else "")
        + f"\n\n# Path Rules\n{matching_path_rules([path])}"
        f"\n\n# Diff of {path}\n{truncate(diff_for_path(ctx.base, path), MAX_CONTEXT_FILE_CHARS) or 'Unchanged by this PR.'}"
    )


def candidate_code(ctx, packet, places):
    """The code around each (path, line, side) place the packet's bundle does not already show, quoted the bundle's
    way: the line's window and short enclosing block, the values it reads and the same-file functions it calls.
    Questions mostly point at unchanged code the change feeds, which is where the checker used to spend its reads."""
    shown = bundle_ranges(ctx.bundles[packet])
    touched = {}
    for path, line, side in places:
        if line and side == "RIGHT" and not shown_in(shown, path, line, line):
            touched.setdefault(path, {"RIGHT": set(), "LEFT": set()})["RIGHT"].add(line)
    if not touched:
        return ""
    try:
        return bundle_code(touched, [], {}, marked=ctx.allowed, kind="candidate")
    except Exception as exc:
        print(f"Dottore candidate code failed for {', '.join(touched)}: {error_text(exc)}", flush=True)
        return ""


def verifier_budget(ctx, candidates):
    settings = ctx.models["verify"]
    extra = len(candidates) - 1
    if not settings["reads"]:
        return 0, 0
    return settings["reads"] + VERIFIER_READS_PER_EXTRA * extra, settings["chars"] + VERIFIER_CHARS_PER_EXTRA * extra


FINDING_FIELDS = ("title", "body", "fix_hint")


def judge(ctx, candidate, verdict):
    """Turn one submitted verdict into (outcome, finding, note, evidence). A confirmation's finding text, when the
    checker wrote one, replaces the candidate's."""
    if not isinstance(verdict, dict):
        return "unverified", candidate, "", []
    outcome = str(verdict.get("verdict", "")).strip().lower()
    note = " ".join(str(verdict.get("note") or "").split())
    evidence = [item for item in as_list(verdict.get("evidence")) if isinstance(item, dict)]
    if outcome not in {"confirmed", "rejected", "uncertain"}:
        outcome = "uncertain"
    if outcome == "confirmed" and not evidence_grounded(ctx, evidence):
        outcome = "uncertain"
        note = f"The quoted evidence did not match the code. {note}".strip()
        for item in evidence[:3]:
            print(
                f"Dottore evidence unmatched: {candidate.path}:{candidate.line}; {item.get('path')}:{item.get('line')}; "
                f"{evidence_snippet(item.get('snippet'))[:200]!r}",
                flush=True,
            )
    written = {key: str(verdict.get(key) or "").strip() for key in FINDING_FIELDS}
    if outcome != "confirmed":
        return outcome, candidate, note, evidence
    severity = str(verdict.get("severity", "")).strip().lower()
    finding = dataclasses.replace(candidate)
    if severity in {"blocking", "high", "medium", "low"}:
        finding.severity = severity
    if written["title"] and written["body"]:
        finding.title, finding.body = written["title"], written["body"]
        finding.fix_hint = written["fix_hint"] or finding.fix_hint
        finding.repair_contract = normalize_repair_contract(verdict.get("repair_contract")) or finding.repair_contract
    line = verdict.get("line")
    if isinstance(line, int) and not isinstance(line, bool) and line > 0:
        try:
            path = tool_path(verdict.get("path") or finding.path)
        except ValueError:
            path = ""
        anchored = finding.line in ctx.anchorable.get(finding.path, {}).get(finding.side, set())
        nearby = anchored and path == finding.path and abs(line - finding.line) <= GITHUB_CONTEXT_LINES
        # A place a few lines from a changed-line anchor is the same spot (often a removal, which has no head line):
        # keep the anchor so the finding stays an inline thread.
        if path and head_line_exists(path, line) and not nearby:
            finding.path, finding.line, finding.side = path, line, "RIGHT"
    # A defect the checker places outside the changed lines is published in the walkthrough, not inline.
    finding.outside_diff = finding.line not in ctx.anchorable.get(finding.path, {}).get(finding.side, set())
    return outcome, finding, note, evidence


def verify_file(ctx, packet, candidates):
    """Stage 2: the checker judges one file's candidates against the code in a single agent run, after the packet the
    finder read. Each file's run has its own cache key: checkers run in parallel, and conversations sharing a key past
    the provider's per-key request rate are spread over machines that do not hold their earlier turns."""
    if time.monotonic() > ctx.deadline:
        return [("unverified", candidate, "", []) for candidate in candidates]
    reads, chars = verifier_budget(ctx, candidates)
    submitted = run_agent(
        ctx,
        "verify",
        [
            {"role": "system", "content": ctx.system},
            {"role": "user", "content": ctx.packets[packet]},
            {"role": "user", "content": verification_prompt(ctx, candidates)},
        ],
        SUBMIT_VERDICTS,
        cache_key=f"{ctx.cache_key}-p{packet}-{hashlib.sha1(candidates[0].path.encode()).hexdigest()[:8]}",
        budget=reads,
        output_budget=chars,
    )
    by_number = {}
    for verdict in as_list(submitted.get("verdicts")):
        if isinstance(verdict, dict) and isinstance(verdict.get("candidate"), int):
            by_number.setdefault(verdict["candidate"], verdict)
    results = [judge(ctx, candidate, by_number.get(number)) for number, candidate in enumerate(candidates, 1)]
    # A confirmation the checker marks as the same defect as another confirmed candidate publishes once.
    for number, (outcome, finding, note, evidence) in enumerate(results, 1):
        same = (by_number.get(number) or {}).get("same_as")
        if (
            outcome == "confirmed"
            and isinstance(same, int)
            and not isinstance(same, bool)
            and same != number
            and 0 < same <= len(results)
            and results[same - 1][0] == "confirmed"
        ):
            results[number - 1] = ("same_as", finding, note, evidence)
    return results


def verify_candidates(ctx, candidates, pool):
    """Check the finder's highest-severity claims, one checker per packet and file in parallel, and sort them by
    outcome."""
    chosen = candidates[:MAX_VERIFIED_CANDIDATES]
    groups = {}
    for candidate in sorted(chosen, key=lambda candidate: (candidate.packet, candidate.path, candidate.line or 0)):
        groups.setdefault((candidate.packet, candidate.path), []).append(candidate)
    futures = {key: pool.submit(verify_file, ctx, key[0], group) for key, group in groups.items()}
    counts = dict.fromkeys(("candidates", "confirmed", "rejected", "uncertain", "same_as", "unverified", "failed", "capped"), 0)
    counts["candidates"] = len(candidates)
    # Claims past the cap are the lowest-severity ones and a rerun would skip them again, so they are counted apart
    # from the chosen candidates the checker left without a verdict.
    counts["capped"] = len(candidates) - len(chosen)
    results = {}
    for key, future in futures.items():
        try:
            for candidate, result in zip(groups[key], future.result()):
                results[id(candidate)] = result
        except Exception as exc:
            print(f"Dottore checker failed for {key[1]}: {error_text(exc)}", flush=True)
            counts["failed"] += len(groups[key])
    confirmed, hypotheses = [], []
    for candidate in chosen:
        if id(candidate) not in results:
            continue
        outcome, finding, note, evidence = results[id(candidate)]
        counts[outcome] += 1
        print(
            f"Dottore candidate: {outcome}; found_by={finding.segment}; {finding.severity}; "
            f"{candidate.path}:{candidate.line}"
            + (f" -> {finding.path}:{finding.line}" if (finding.path, finding.line) != (candidate.path, candidate.line) else "")
            + (" (outside diff)" if outcome == "confirmed" and finding.outside_diff else "")
            + f"; {finding.title[:120]}; note={note[:400]}",
            flush=True,
        )
        if outcome == "confirmed":
            confirmed.append({**dataclasses.asdict(finding), "verification": {"note": note, "evidence": evidence[:3]}})
        elif outcome == "uncertain":
            hypotheses.append(f"{finding.title} (`{finding.path}:{finding.line}`): {note}")
    return confirmed, hypotheses, counts


def repair_prompt(ctx, packet, threads):
    listed = []
    for number, thread in enumerate(threads, 1):
        entry = {"thread": number, "path": thread["path"], "side": thread["side"]}
        if thread["line"]:
            entry["line"] = thread["line"]
        else:
            entry["line_at_the_earlier_head"] = thread["original_line"]
        entry["finding"] = thread["finding"]
        if thread["contract"]:
            entry["repair_contract"] = thread["contract"]
        listed.append(entry)
    paths = sorted({thread["path"] for thread in threads})
    reads, chars = verifier_budget(ctx, threads)
    around = candidate_code(ctx, packet, [(thread["path"], thread["line"], thread["side"]) for thread in threads])
    diffs = "\n\n".join(f"## {path}\n{diff_for_path(ctx.base, path)}" for path in paths)
    return (
        f"{role_prompt(ctx, 'Repair Check', TOOLS=tools_line({'reads': reads, 'chars': chars}, 'the bundle and the code around each thread are'))}"
        "\n\nFinish by calling submit_repairs with one verdict per thread number."
        f"\n\n# Open Threads\n{json.dumps(listed, indent=2)}"
        + (f"\n\n# Code Around the Threads\nQuoted by code from the PR head where the bundle does not already show it, with the PR's changed lines marked `+`.\n\n{around}" if around else "")
        + f"\n\n# Path Rules\n{matching_path_rules(paths)}"
        f"\n\n# Diff of the Thread Files Since the Review Base\n{truncate(diffs, MAX_CONTEXT_FILE_CHARS)}"
    )


def check_repairs(ctx, packet, threads):
    """The checker re-judges one packet's open threads against the PR head in one agent run, after the packet the
    finder read, and returns one result per thread. A thread counts as resolved only on evidence quoted from the head."""
    reads, chars = verifier_budget(ctx, threads)
    submitted = run_agent(
        ctx,
        "verify",
        [
            {"role": "system", "content": ctx.system},
            {"role": "user", "content": ctx.packets[packet]},
            {"role": "user", "content": repair_prompt(ctx, packet, threads)},
        ],
        SUBMIT_REPAIRS,
        cache_key=f"{ctx.cache_key}-p{packet}-repairs",
        budget=reads,
        output_budget=chars,
    )
    by_number = {}
    for verdict in as_list(submitted.get("verdicts")):
        if isinstance(verdict, dict) and isinstance(verdict.get("thread"), int):
            by_number.setdefault(verdict["thread"], verdict)
    results = []
    for number, thread in enumerate(threads, 1):
        verdict = by_number.get(number) or {}
        outcome = str(verdict.get("verdict", "")).strip().lower()
        note = " ".join(str(verdict.get("note") or "").split())
        evidence = [item for item in as_list(verdict.get("evidence")) if isinstance(item, dict)]
        if outcome not in {"resolved", "still_open"}:
            outcome = "uncertain"
        if outcome == "resolved" and not evidence_grounded(ctx, evidence, base=False):
            outcome, note = "uncertain", f"The quoted evidence did not match the code at the head. {note}".strip()
        print(f"Dottore thread: {outcome}; {thread['path']}:{thread['line'] or thread['original_line']}; {thread['title'][:120]}; note={note[:400]}", flush=True)
        results.append(
            {
                **{key: thread[key] for key in ("thread_id", "comment_id", "id", "path", "side", "title")},
                # An outdated thread has no line at the head; the walkthrough shows where it was opened.
                "line": thread["line"] or thread["original_line"],
                "verdict": outcome,
                "note": note,
                "evidence": evidence[:3],
            }
        )
    return results


def check_threads(ctx, threads, pool):
    """Start one repair check per packet holding open threads, and return a function that waits for the results."""
    groups = {}
    for thread in threads:
        packet = next((index for index, chunk in enumerate(ctx.chunks) if thread["path"] in chunk), 0)
        groups.setdefault(packet, []).append(thread)
    futures = [pool.submit(check_repairs, ctx, packet, group) for packet, group in sorted(groups.items())]

    def results():
        checked = []
        for future in futures:
            try:
                checked += future.result()
            except Exception as exc:
                print(f"Dottore repair check failed: {error_text(exc)}", flush=True)
        return checked

    return results


def agentic_review(ctx, mode, pool, threads=()):
    """Scout, find, merge, then let the checker judge each candidate before it can be posted. The open threads are
    re-judged alongside, once the scouts have filled the bundle."""
    scout_failures, scouts = scout_bundles(ctx, pool)
    repairs = check_threads(ctx, threads, pool)
    reports = run_finders(ctx, pool)
    merged = merge_segments(reports)
    claims, severity_nitpicks, withheld = validate_review_items(
        {"findings": merged["findings"], "mode": mode}, ctx.base
    )
    merged["nitpicks"] = (merged["nitpicks"] + [dataclasses.asdict(item) for item in severity_nitpicks])[:2]
    confirmed, hypotheses, counts = verify_candidates(ctx, claims, pool)
    ctx.stats["verification"] = counts
    open_questions = hypotheses + merged["open_questions"]
    merged["findings"] = confirmed
    merged["open_questions"] = open_questions[:MAX_OPEN_QUESTIONS]
    merged["withheld_findings"] = withheld
    merged["verification"] = counts
    merged["repairs"] = repairs()
    if scout_failures:
        merged["pre_merge_checks"].append(
            {
                "name": "Gathered Code",
                "status": "warn",
                "type": "Review Limitation",
                "detail": f"{scout_failures} of {scouts} scouts failed, so the code they would have gathered is missing from the bundle.",
            }
        )
    unresolved = len(hypotheses) - MAX_OPEN_QUESTIONS
    if unresolved > 0:
        merged["pre_merge_checks"].append(
            {
                "name": "Unresolved Candidates",
                "status": "warn",
                "type": "Review Limitation",
                "detail": f"{plural(unresolved, 'more candidate')} could be neither confirmed nor refuted from the code, so they were withheld.",
            }
        )
    unexamined = counts["capped"] + counts["unverified"] + counts["failed"]
    if unexamined:
        merged["pre_merge_checks"].append(
            {
                "name": "Verification Coverage",
                "status": "warn",
                "type": "Review Limitation",
                "detail": f"{plural(unexamined, 'candidate')} went unexamined ({counts['capped']} past the {MAX_VERIFIED_CANDIDATES}-claim cap, {counts['unverified']} after the time limit or without a verdict, {counts['failed']} after a checker error), so they were withheld.",
            }
        )
    return merged


def touched_lines(base):
    by_path: dict[str, dict[str, set[int]]] = {}
    old_path = new_path = None
    old_line = new_line = None
    diff = run_git_raw(diff_command(base, "--find-renames", "--unified=0"))
    for line in diff.splitlines():
        if line.startswith("diff --git "):
            old_path = new_path = None
            old_line = new_line = None
            continue
        if old_line is None and line.startswith("--- "):
            old_path = line[4:]
            if old_path.startswith("a/"):
                old_path = old_path[2:]
            elif old_path == "/dev/null":
                old_path = None
            if old_path:
                by_path.setdefault(old_path, {"RIGHT": set(), "LEFT": set()})
            continue
        if new_line is None and line.startswith("+++ b/"):
            new_path = line.removeprefix("+++ b/")
            by_path.setdefault(new_path, {"RIGHT": set(), "LEFT": set()})
            continue
        if new_line is None and line.startswith("+++ /dev/null"):
            new_path = None
            continue
        match = re.match(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
        if match:
            old_line = int(match.group(1))
            new_line = int(match.group(3))
            continue
        if old_line is None or new_line is None:
            continue
        if line.startswith("\\"):
            continue
        if line.startswith("+"):
            if new_path:
                by_path[new_path]["RIGHT"].add(new_line)
            new_line += 1
        elif line.startswith("-"):
            path = new_path or old_path
            if path:
                by_path[path]["LEFT"].add(old_line)
            old_line += 1
        else:
            old_line += 1
            new_line += 1
    files = set(changed_files(base))
    return {path: sides for path, sides in by_path.items() if path in files}


def normalize_repair_contract(value):
    if not isinstance(value, dict):
        return None
    allowed_keys = (
        "invariant",
        "related_failure_paths",
        "adjacent_traps",
        "acceptable_fix_shapes",
        "expected_proof",
    )
    contract = {}
    for key in allowed_keys:
        raw = value.get(key)
        if isinstance(raw, list):
            items = [str(item).strip() for item in raw if str(item).strip()]
            if items:
                contract[key] = items[:5]
        elif isinstance(raw, str) and raw.strip():
            contract[key] = raw.strip()
    return contract or None


def normalize_review_item(item, *, default_severity, outside_ok=False):
    side = str(item.get("side", "RIGHT")).strip().upper()
    if side not in {"LEFT", "RIGHT"}:
        raise ValueError("side must be LEFT or RIGHT")
    return Finding(
        severity=str(item.get("severity", default_severity)).lower(),
        path=str(item.get("path", "")).strip(),
        line=item.get("line"),
        title=str(item.get("title", "")).strip(),
        body=str(item.get("body", "")).strip(),
        fix_hint=str(item.get("fix_hint", "")).strip(),
        repair_contract=normalize_repair_contract(item.get("repair_contract")),
        side=side,
        segment=str(item.get("segment", "")).strip(),
        outside_diff=outside_ok and item.get("outside_diff") is True,
        packet=item.get("packet") if isinstance(item.get("packet"), int) else 0,
    )


def validate_review_items(review_obj, base, outside_ok=False):
    """The findings and nitpicks whose diff locations hold. With outside_ok, a confirmed finding the checker placed
    outside the changed lines keeps its place when that line exists at the head; the finder's never do."""
    allowed = touched_lines(base)
    findings = []
    nitpicks = []
    invalid = []
    severities = {"blocking", "high", "medium", "low"}
    for item in review_obj.get("findings", []):
        try:
            finding = normalize_review_item(item, default_severity="medium", outside_ok=outside_ok)
        except Exception as exc:
            invalid.append(f"Malformed finding skipped: {exc}")
            continue
        target = nitpicks if finding.severity == "nitpick" else findings
        if finding.severity not in severities:
            finding.severity = "nitpick" if target is nitpicks else "medium"
        if finding.outside_diff and finding.side == "RIGHT":
            try:
                exists = isinstance(finding.line, int) and head_line_exists(tool_path(finding.path), finding.line)
            except ValueError:
                exists = False
            if not exists or isinstance(finding.line, bool) or not finding.title or not finding.body:
                invalid.append(f"{finding.severity} '{finding.title or '<untitled>'}' at {finding.path}: no such line at the head")
                continue
            target.append(finding)
            continue
        if not finding.path or finding.path not in allowed:
            invalid.append(
                f"{finding.severity} '{finding.title or '<untitled>'}' at "
                f"{finding.path or '<missing path>'}: not in changed files"
            )
            continue
        if isinstance(finding.line, bool) or not isinstance(finding.line, int) or finding.line <= 0:
            invalid.append(
                f"{finding.severity} '{finding.title or '<untitled>'}' at "
                f"{finding.path}: missing integer line"
            )
            continue
        if finding.side == "LEFT" and review_obj.get("mode") != "full":
            # GitHub anchors LEFT lines to the PR base, not the incremental review base.
            invalid.append(
                f"{finding.severity} '{finding.title or '<untitled>'}' at "
                f"{finding.path}:{finding.line}: deleted-line findings need a full review (`/dottore full`)"
            )
            continue
        removed = allowed[finding.path].get("LEFT", set())
        if finding.side == "LEFT" and finding.line not in removed and removed:
            # A defect that only removes code is often placed on the unchanged line beside the deletion; anchor it on
            # the nearest removed line GitHub shows with it rather than withhold it.
            near = min(removed, key=lambda number: abs(number - finding.line))
            if abs(near - finding.line) <= GITHUB_CONTEXT_LINES:
                finding.line = near
        if finding.line not in allowed[finding.path].get(finding.side, set()):
            invalid.append(
                f"{finding.severity} '{finding.title or '<untitled>'}' at "
                f"{finding.path}:{finding.line}: line is not part of the change"
            )
            continue
        if not finding.title or not finding.body:
            invalid.append(f"{finding.path}:{finding.line}: missing title/body")
            continue
        target.append(finding)

    for item in review_obj.get("nitpicks", [])[:2]:
        try:
            nitpick = normalize_review_item(item, default_severity="nitpick")
            nitpick.severity = "nitpick"
        except Exception as exc:
            invalid.append(f"Malformed nitpick skipped: {exc}")
            continue
        if not nitpick.path or nitpick.path not in allowed:
            invalid.append(
                f"nitpick '{nitpick.title or '<untitled>'}' at "
                f"{nitpick.path or '<missing path>'}: not in changed files"
            )
            continue
        if nitpick.side != "RIGHT":
            invalid.append(f"nitpick '{nitpick.title or '<untitled>'}' at {nitpick.path}:{nitpick.line}: nitpicks go on added lines")
            continue
        if isinstance(nitpick.line, bool) or not isinstance(nitpick.line, int) or nitpick.line <= 0:
            invalid.append(
                f"nitpick '{nitpick.title or '<untitled>'}' at "
                f"{nitpick.path}: missing integer line"
            )
            continue
        if nitpick.line not in allowed[nitpick.path].get("RIGHT", set()):
            invalid.append(
                f"nitpick '{nitpick.title or '<untitled>'}' at "
                f"{nitpick.path}:{nitpick.line}: line is not an added/changed diff line"
            )
            continue
        if not nitpick.title or not nitpick.body:
            invalid.append(f"{nitpick.path}:{nitpick.line}: missing nitpick title/body")
            continue
        nitpicks.append(nitpick)

    severity_rank = {"blocking": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda finding: severity_rank.get(finding.severity, 2))
    return findings, nitpicks[:MAX_NITPICKS], invalid


def render_finding_body(finding):
    meta = severity_meta(finding.severity)
    parts = [
        finding_marker(finding),
        f"### {meta['icon']} {meta['label']}: {finding.title}",
        "",
        f"**Location:** {location_label(finding)}",
        "",
        blockquote(finding.body),
    ]
    if finding.fix_hint:
        parts.extend([""] + alert_block("TIP", [f"**Suggested fix:** {finding.fix_hint}"]))
    # The finding is cut to leave room for the footer, so a long one still carries its next step.
    body = inline_truncate("\n".join(parts).strip(), MAX_INLINE_COMMENT_CHARS - len(THREAD_FOOTER) - 2)
    return f"{body}\n\n{THREAD_FOOTER}"


def finding_id(finding):
    raw = f"{finding.side}:{finding.path}:{finding.line}:{finding.title}".encode("utf-8", "replace")
    return hashlib.sha256(raw).hexdigest()[:16]


def finding_marker(finding):
    return f"<!-- dottore:finding={finding_id(finding)} -->"


def short_ref(value):
    if not value:
        return "unknown"
    value = str(value)
    if re.fullmatch(r"[0-9a-f]{40}", value):
        return value[:8]
    if value.startswith("origin/"):
        return value
    return value[:24]


def commit_subject(head_sha):
    if not head_sha:
        return ""
    result = run(["git", "log", "-1", "--format=%s", head_sha], timeout=30)
    if result.returncode != 0:
        return ""
    return " ".join(result.stdout.split())


def commit_line(head_sha, message=None, label="Commit"):
    subject = " ".join(str(message or "").split()) or commit_subject(head_sha)
    ref = short_ref(head_sha)
    if subject:
        return f"{label}: {ref} - {subject}"
    return f"{label}: {ref}"


def md_cell(value):
    return str(value or "").replace("|", "\\|").replace("\n", "<br>").strip()


def blockquote(text):
    lines = str(text or "").strip().splitlines() or [""]
    return "\n".join(f"> {line}" if line else ">" for line in lines)


def alert_block(kind, lines):
    body = [f"> [!{kind}]"]
    for line in lines:
        body.extend(blockquote(line).splitlines())
    return body


def compact_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def severity_meta(severity):
    return {
        "blocking": {"icon": "🚫", "label": "BLOCKING", "rank": 0},
        "high": {"icon": "🔥", "label": "HIGH", "rank": 1},
        "medium": {"icon": "⚠️", "label": "MEDIUM", "rank": 2},
        "low": {"icon": "ℹ️", "label": "LOW", "rank": 3},
        "nitpick": {"icon": "🧹", "label": "NITPICK", "rank": 4},
    }.get(str(severity or "").lower(), {"icon": "❔", "label": "UNKNOWN", "rank": 9})


def is_defect(finding):
    """Every graded finding is a defect, low included: it gets a review thread, as a CodeRabbit finding does, and
    withholds the verdict until repaired. Severity grades the size of the repair, not whether one is owed. Only an
    ungraded item is a note beside the nitpicks."""
    return severity_meta(finding.severity)["rank"] <= severity_meta("low")["rank"]


def plural(count, noun):
    return f"{count} {noun}{'' if count == 1 else 's'}"


def status_meta(status):
    normalized = str(status or "").lower()
    if normalized in {"fail", "failure", "failed", "cancelled"}:
        return {"icon": "❌", "label": "FAIL"}
    if normalized in {"warn", "warning", "pending", "unknown"}:
        return {"icon": "⚠️", "label": normalized.upper() or "WARN"}
    if normalized in {"pass", "success", "passed", "skipped"}:
        return {"icon": "✅", "label": "PASS"}
    return {"icon": "❔", "label": normalized.upper() or "UNKNOWN"}


def status_badge(meta):
    return f"<strong>{meta['icon']}&nbsp;{meta['label']}</strong>"


def control_type(item):
    explicit = str(item.get("type") or item.get("kind") or "").strip()
    allowed = {
        "Proof Gap",
        "Review Limitation",
        "Non-blocking Coverage",
    }
    if explicit in allowed:
        return explicit
    combined = " ".join(
        str(item.get(key, "")) for key in ("name", "status", "detail")
    ).lower()
    if "proof" in combined or "test" in combined or "coverage" in combined:
        if "missing" in combined or "gap" in combined or "lacks" in combined:
            return "Proof Gap"
        return "Non-blocking Coverage"
    if "truncated" in combined or "context" in combined or "packet" in combined:
        return "Review Limitation"
    return "Review Limitation"


def warn_is_proof_gap(item):
    return status_meta(item.get("status"))["label"] in {"WARN", "WARNING", "PENDING", "UNKNOWN"} and control_type(item) == "Proof Gap"


def warn_is_blocking_proof_gap(item):
    if not warn_is_proof_gap(item):
        return False
    combined = " ".join(
        str(item.get(key, "")) for key in ("name", "detail", "blocking", "severity")
    ).lower()
    if "non-blocking" in combined or "not blocking" in combined:
        return False
    return "blocking" in combined or "merge-blocking" in combined


def has_failed_review_check(pre_merge):
    return any(
        str(item.get("name", "")).strip().lower() == "review failed"
        and status_meta(item.get("status"))["label"] == "FAIL"
        for item in pre_merge
    )


def unexamined_candidates(review_obj):
    """Chosen candidates the checker did not judge (it failed, or the deadline left some without a verdict). Claims past
    the cap do not count: a rerun would skip them again."""
    counts = review_obj.get("verification") if isinstance(review_obj.get("verification"), dict) else {}
    return any(isinstance(counts.get(key), int) and counts[key] > 0 for key in ("failed", "unverified"))


def has_incomplete_review_check(pre_merge):
    names = {"review failed", "review skipped"}
    return any(str(item.get("name", "")).strip().lower() in names for item in pre_merge)


def merge_signal(review_obj, findings, nitpicks, pre_merge):
    state = str(review_obj.get("review_state") or "").lower()
    if state == "no_new_diff_reviewed":
        return {
            "label": "NO NEW DIFF REVIEWED",
            "title": "No New Diff Reviewed",
            "admonition": "NOTE",
            "detail": "Dottore already reviewed this head; this run did not inspect new changes.",
        }
    review_incomplete = has_incomplete_review_check(pre_merge)
    if review_incomplete:
        return {
            "label": "REVIEW INCOMPLETE",
            "title": "Specimen Unexamined",
            "admonition": "CAUTION",
            "detail": "Dottore Review did not complete, so no model findings are available.",
        }
    has_blocking = any(
        severity_meta(finding.severity)["rank"] <= severity_meta("high")["rank"]
        for finding in findings
    )
    has_failed_check = any(
        status_meta(item.get("status"))["label"] == "FAIL" for item in pre_merge
    )
    if has_blocking or has_failed_check:
        return {
            "label": "SPECIMEN UNSTABLE",
            "title": "Specimen Unstable",
            "admonition": "CAUTION",
            "detail": "Repair blocking/high findings or failed controls before merge.",
        }
    if findings or any(warn_is_blocking_proof_gap(item) for item in pre_merge):
        return {
            "label": "REPAIR REQUIRED",
            "title": "Repair Required",
            "admonition": "WARNING",
            "detail": "Actionable findings or blocking proof gaps remain for this head.",
        }
    if unexamined_candidates(review_obj):
        # Chosen candidates went unjudged (the Lab Notes count them): nothing certifies this head as viable.
        return {
            "label": "REVIEW INCOMPLETE",
            "title": "Examination Incomplete",
            "admonition": "CAUTION",
            "detail": "Some candidates went unjudged, so no viable verdict is certified; rerun the review.",
        }
    has_notes = nitpicks or any(
        status_meta(item.get("status"))["label"] in {"WARN", "WARNING", "PENDING", "UNKNOWN"}
        for item in pre_merge
    )
    if has_notes:
        return {
            "label": "VIABLE, WITH NOTES",
            "title": "Viable, With Notes",
            "admonition": "WARNING",
            "detail": "No actionable defects were isolated, but non-blocking notes remain.",
        }
    return {
        "label": "VIABLE",
        "title": "Viable",
        "admonition": "TIP",
        "detail": "No actionable findings were isolated for this head.",
    }


def render_merge_signal(review_obj, defects, notes, pre_merge, head_sha):
    """The verdict once: in the title, with its one-line reason, and a row of counts."""
    signal = merge_signal(review_obj, defects, notes, pre_merge)
    controls = control_summary(pre_merge)
    mode = review_obj.get("mode") or "unknown"
    base = review_obj.get("review_base") or review_obj.get("base_ref") or "unknown"
    body = [
        f"## 🎭 Dottore Review: {signal['title']}",
        "",
        # Floated right of the verdict box and the counts beneath it, inset from the comment's edge.
        f'<img src="{dottore_chibi(signal["label"], head_sha)}" alt="Dottore" width="128" align="right" hspace="16">',
        "",
        f"> [!{signal['admonition']}]",
        f"> {signal['detail']}",
        ">",
        f"> *{dottore_remark(signal['label'], head_sha)}*",
        "",
        "| Defects | Notes | Controls | Mode | Head | Base |",
        "| ---: | ---: | --- | --- | --- | --- |",
        f"| {len(defects)} | {len(notes)} | {md_cell(controls)} | `{md_cell(mode)}` | `{short_ref(head_sha)}` | `{short_ref(base)}` |",
    ]
    return "\n".join(body)


def control_summary(pre_merge):
    if not pre_merge:
        return "none"
    counts = {}
    for item in pre_merge:
        label = status_meta(item.get("status"))["label"].lower()
        counts[label] = counts.get(label, 0) + 1
    ordered = []
    for label in ("fail", "warn", "warning", "pending", "unknown", "pass"):
        count = counts.get(label)
        if count:
            ordered.append(f"{count} {label}")
    return ", ".join(ordered) or f"{len(pre_merge)} control(s)"


CONTRACT_LABELS = (
    ("invariant", "Invariant"),
    ("related_failure_paths", "Related failure paths"),
    ("adjacent_traps", "Adjacent traps"),
    ("acceptable_fix_shapes", "Acceptable fix shapes"),
    ("expected_proof", "Expected proof"),
)
CONTRACT_LABEL_TO_KEY = {label.lower(): key for key, label in CONTRACT_LABELS}


def code_block_text(text):
    return str(text or "").replace("```", "'''").strip()


def location_label(finding, cell=str):
    """`path:line` as people read it; a removed line says so, since its number is in the old file."""
    return f"`{cell(finding.path)}:{finding.line}`" + (" (removed line)" if finding.side == "LEFT" else "")


def agent_prompt_for_finding(finding):
    contract = finding.repair_contract or {}
    lines = [
        f"Task: Fix {location_label(finding)}.",
        f"Finding: {finding.title}",
        f"Severity: {finding.severity}",
    ]
    if finding.severity != "nitpick":
        for key, label in (
            ("invariant", "Goal"),
            ("related_failure_paths", "Cover"),
            ("adjacent_traps", "Avoid"),
            ("acceptable_fix_shapes", "Acceptable fixes"),
            ("expected_proof", "Proof required"),
        ):
            values = compact_list(contract.get(key))
            if values:
                lines.append(f"{label}: " + "; ".join(values))
    lines.append("Run the narrowest relevant check. If stale, leave code unchanged and record why.")
    return "\n".join(lines)


def render_agent_prompt_details(findings, summary):
    if not findings:
        return ""
    prompt = code_block_text(
        "\n\n".join(agent_prompt_for_finding(finding) for finding in findings)
    )
    if not prompt:
        return ""
    return "\n".join(
        [
            "<details>",
            f"<summary>{summary}</summary>",
            "",
            "```text",
            prompt,
            "```",
            "",
            "</details>",
        ]
    )


def compact_contract_for_state(contract):
    if not isinstance(contract, dict):
        return None
    compact = {}
    for key, _ in CONTRACT_LABELS:
        values = compact_state_values(contract.get(key))
        if values:
            compact[key] = values
    return compact or None


def contract_state_entry_from_finding(finding, *, status="open"):
    contract = compact_contract_for_state(finding.repair_contract)
    if not contract or finding.severity == "nitpick":
        return None
    return {
        "id": finding_id(finding),
        "status": status,
        "severity": str(finding.severity or "medium"),
        "path": finding.path,
        "line": finding.line,
        "side": finding.side,
        "title": compact_state_text(finding.title, 180),
        "fix_hint": compact_state_text(finding.fix_hint, 260),
        "repair_contract": contract,
    }


def contract_identity(entry):
    return (
        str(entry.get("id") or "").strip(),
        str(entry.get("path") or "").strip(),
        str(entry.get("side") or "RIGHT").strip().upper(),
        compact_state_text(entry.get("title"), 180).lower(),
    )


def contract_matches_finding(entry, finding):
    entry_id, entry_path, entry_side, entry_title = contract_identity(entry)
    if entry_id and entry_id == finding_id(finding):
        return True
    if entry_path and entry_path == finding.path and entry_side == finding.side:
        finding_title = compact_state_text(finding.title, 180).lower()
        if entry_title and entry_title == finding_title:
            return True
    return False


def normalize_contract_state_entries(entries):
    normalized = []
    if not isinstance(entries, list):
        return normalized
    for raw in entries:
        if not isinstance(raw, dict):
            continue
        contract = compact_contract_for_state(raw.get("repair_contract"))
        if not contract:
            continue
        normalized.append(
            {
                "id": compact_state_text(raw.get("id"), 40),
                "status": compact_state_text(raw.get("status") or "prior", 40),
                "severity": compact_state_text(raw.get("severity") or "medium", 24),
                "path": compact_state_text(raw.get("path"), 260),
                "line": raw.get("line") if isinstance(raw.get("line"), int) else None,
                "side": str(raw.get("side") or "RIGHT").strip().upper(),
                "title": compact_state_text(raw.get("title"), 180),
                "fix_hint": compact_state_text(raw.get("fix_hint"), 260),
                "repair_contract": contract,
            }
        )
        if len(normalized) >= MAX_CONTRACT_STATE_ENTRIES:
            break
    return normalized


def merge_contract_state(current_findings, prior_entries):
    merged = []
    seen = set()
    for finding in current_findings:
        entry = contract_state_entry_from_finding(finding, status="open")
        if not entry:
            continue
        seen.add(entry["id"])
        merged.append(entry)
    for entry in normalize_contract_state_entries(prior_entries):
        entry_id = entry.get("id")
        if entry_id and entry_id in seen:
            continue
        if entry_id:
            seen.add(entry_id)
        merged.append(entry)
        if len(merged) >= MAX_CONTRACT_STATE_ENTRIES:
            break
    return merged


def open_prior_contract_state(current_findings, prior_entries):
    open_entries = []
    for entry in normalize_contract_state_entries(prior_entries):
        if any(contract_matches_finding(entry, finding) for finding in current_findings):
            continue
        open_entries.append(entry)
    return open_entries


def encode_contract_state(entries):
    normalized = normalize_contract_state_entries(entries)
    if not normalized:
        return ""
    payload = {"version": 1, "contracts": normalized}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    encoded = base64.urlsafe_b64encode(raw).decode("ascii")
    return f"<!-- dottore:contract-state={encoded} -->"


def decode_contract_state_from_body(body):
    matches = CONTRACT_STATE_RE.findall(body or "")
    if not matches:
        return []
    encoded = matches[-1]
    try:
        decoded = base64.urlsafe_b64decode(encoded.encode("ascii"))
        payload = json.loads(decoded.decode("utf-8"))
    except Exception:
        return []
    return normalize_contract_state_entries(payload.get("contracts"))


def format_contract_entries_for_prompt(entries, limit=12_000):
    entries = normalize_contract_state_entries(entries)
    if not entries:
        return "No prior Dottore repair contracts found."
    lines = [
        "Prior Dottore repair contracts from earlier review rounds. Judge whether the current diff satisfies each invariant before reporting adjacent defects.",
    ]
    for index, entry in enumerate(entries, 1):
        location = f"{entry.get('path') or 'unknown'}:{entry.get('line') or '?'}"
        lines.extend(
            [
                "",
                f"## Contract {index}: {entry.get('title') or '<untitled>'}",
                f"- ID: {entry.get('id') or 'unknown'}",
                f"- Status: {entry.get('status') or 'prior'}",
                f"- Severity: {entry.get('severity') or 'medium'}",
                f"- Location: {location}",
                f"- Side: {entry.get('side') or 'RIGHT'}",
            ]
        )
        if entry.get("fix_hint"):
            lines.append(f"- Suggested repair: {entry['fix_hint']}")
        contract = entry.get("repair_contract") or {}
        for key, label in CONTRACT_LABELS:
            values = compact_state_values(contract.get(key))
            if values:
                lines.append(f"- {label}: " + "; ".join(values))
    return truncate("\n".join(lines).strip(), limit)


def render_walkthrough(
    review_obj,
    findings,
    nitpicks,
    invalid_findings,
    head_sha,
    prior_contracts=None,
):
    summary = review_obj.get("change_summary") or []
    questions = review_obj.get("open_questions") or []
    checked = review_obj.get("what_i_checked") or []
    pre_merge = review_obj.get("pre_merge_checks") or []
    resolved = review_obj.get("resolved_since_last_review") or []
    # An examination that left candidates unjudged is not recorded: the commit status fails on it, the head is not
    # discharged, and the next review examines it in full.
    state_marker = (
        f"<!-- dottore:last-reviewed-sha={head_sha} -->"
        if head_sha and not has_incomplete_review_check(pre_merge) and not unexamined_candidates(review_obj)
        else "<!-- dottore:last-reviewed-sha=unrecorded -->"
    )
    # Every graded finding is a defect: a review thread and a hold on the verdict. The notes are the nitpicks.
    defects = [finding for finding in findings if is_defect(finding)]
    notes = [finding for finding in findings if not is_defect(finding)] + list(nitpicks)
    contract_state_marker = encode_contract_state(
        merge_contract_state(
            defects, open_prior_contract_state(defects, prior_contracts or [])
        )
    )
    body = [
        DOTTORE_MARKER,
        state_marker,
    ]
    # ponytail: a head with no new diff to review is not discharged even when the last verdict was Viable;
    # carry the prior verdict forward if base merges keep withholding approval.
    signal = merge_signal(review_obj, defects, notes, pre_merge)
    if "unrecorded" not in state_marker and signal["label"] in ("VIABLE", "VIABLE, WITH NOTES"):
        body.append(DISCHARGE_MARKER)
    if contract_state_marker:
        body.append(contract_state_marker)
    body.extend([
        render_merge_signal(review_obj, defects, notes, pre_merge, head_sha),
        "",
        "### 🧭 Specimen Summary",
    ])
    body.extend([f"- {line}" for line in summary[:2]] or ["- No specimen summary produced."])
    body.extend(["", "### 🔎 Isolated Defects"])
    if defects:
        body.extend(
            [
                "| Severity | Location | Finding |",
                "| :---: | --- | --- |",
            ]
        )
        for finding in defects:
            meta = severity_meta(finding.severity)
            body.append(
                "| "
                f"{status_badge(meta)} | "
                f"{location_label(finding, md_cell)} | "
                f"{md_cell(finding.title)} |"
            )
    else:
        if has_failed_review_check(pre_merge):
            body.extend(
                [
                    "",
                    "> [!CAUTION]",
                    "> No model findings are available because Dottore Review failed before completing inspection.",
                ]
            )
        else:
            body.extend(["", "> [!TIP]", "> No actionable defects isolated."])
    if resolved:
        body.extend(["", "### ✅ Repairs Confirmed"])
        for item in resolved[:5]:
            location = f"{item.get('path') or 'unknown'}:{item.get('line') or '?'}"
            title = item.get("title") or "Prior Dottore finding"
            body.append(f"- `{md_cell(location)}` - {md_cell(title)}")
    body.extend(["", "### 🧹 Minor Imperfections"])
    if notes:
        body.extend(
            [
                "| Kind | Location | Note |",
                "| :---: | --- | --- |",
            ]
        )
        for note in notes:
            body.append(
                "| "
                f"{status_badge(severity_meta(note.severity))} | "
                f"{location_label(note, md_cell)} | "
                f"{md_cell(note.title)} |"
            )
    else:
        body.append("- None recorded.")
    body.extend(
        [
            "",
            "### 🩺 Autofix",
            AUTOFIX_BOX,
            "",
            "While this is ticked, Dottore pushes a repair for its open findings after each review, then examines it like"
            f" any push, and makes at most {MAX_AUTOFIX_ROUNDS} repair{'s' if MAX_AUTOFIX_ROUNDS != 1 else ''} between pushes"
            " from a person. Ticking needs write access.",
        ]
    )
    if pre_merge:
        body.extend(
            [
                "",
                "### ✅ Control Checks",
                "| Status | Type | Check | Detail |",
                "| :---: | --- | --- | --- |",
            ]
        )
        for item in pre_merge[:5]:
            name = item.get("name", "check")
            status = item.get("status", "unknown")
            detail = item.get("detail", "")
            meta = status_meta(status)
            body.append(
                "| "
                f"{status_badge(meta)} | "
                f"{md_cell(control_type(item))} | "
                f"{md_cell(name)} | "
                f"{md_cell(detail)} |"
            )
    if questions:
        body.extend(["", "### ❓ Unresolved Hypotheses"])
        body.extend([f"- {line}" for line in questions[:2]])
    body.extend(["", "### 🧪 Observations"])
    body.extend([f"- {line}" for line in checked[:3]] or ["- Bundle and diff context inspected."])
    verification = review_obj.get("verification") or {}
    if invalid_findings or verification:
        body.extend(["", "### 📝 Lab Notes"])
    if verification:
        unexamined = verification.get("capped", 0) + verification.get("unverified", 0) + verification.get("failed", 0)
        body.append(
            f"- {plural(verification.get('candidates', 0), 'candidate')} examined against the code: "
            f"{verification.get('confirmed', 0)} confirmed, {verification.get('rejected', 0)} rejected, "
            f"{verification.get('uncertain', 0)} left unresolved"
            + (f", {verification['same_as']} the same defect as another" if verification.get("same_as") else "")
            + (f", {unexamined} unexamined." if unexamined else ".")
        )
    if invalid_findings:
        body.extend(
            [
                "",
                "> [!WARNING]",
                f"> {plural(len(invalid_findings), 'candidate')} withheld: their diff locations failed validation.",
            ]
        )
        body.extend([f"- {note}" for note in invalid_findings[:5]])
    # Last, for a pull request Dottore cannot push to (a fork without maintainer edits): the same repair contracts, for
    # an agent of your own.
    agent_prompt = render_agent_prompt_details(defects, "🩺 Repair prompt for an agent of your own")
    if agent_prompt:
        body.extend(["", agent_prompt])
    return "\n".join(body).strip() + "\n"


def prior_review_contracts_context(pr_num, limit=12_000):
    if not pr_num:
        return "No prior Dottore review context available."
    state_entries = prior_review_contract_state(pr_num)
    if state_entries:
        return format_contract_entries_for_prompt(state_entries, limit)
    comment = latest_walkthrough_comment(pr_num)
    if not comment:
        return "No prior Dottore walkthrough comment or inline contract comments found."
    body = comment.get("body", "")
    if not body:
        return "Prior Dottore walkthrough comment was empty."
    useful_lines = []
    keep = False
    for line in body.splitlines():
        if line.startswith("### 🔎") or line.startswith("### 🧹") or "Repair contract" in line:
            keep = True
        elif line.startswith("### ") and keep:
            keep = False
        if keep or "dottore:finding=" in line or "Invariant" in line or "Expected proof" in line:
            useful_lines.append(line)
    compact = "\n".join(useful_lines).strip()
    if not compact:
        compact = body[:limit]
    return truncate(compact, limit)


def write_skipped_review(title, body, *, status="unknown", metadata=None):
    review_obj = {
        "change_summary": [body],
        "findings": [],
        "nitpicks": [],
        "pre_merge_checks": [{"name": title, "status": status, "detail": body}],
        "open_questions": [],
        "what_i_checked": ["No model pass ran; the specimen remained unexamined."],
    }
    if metadata:
        review_obj.update(metadata)
    pathlib.Path("review.json").write_text(
        json.dumps(review_obj, indent=2, sort_keys=True) + "\n",
        "utf-8",
    )


def error_text(exc):
    message = " ".join(str(exc).split())
    if len(message) > 500:
        message = message[:497] + "..."
    return f"{type(exc).__name__}: {message}"


def model_failure_detail(exc):
    # Provider errors, a bad DOTTORE_<SLOT>_API value and an agent that never submits all land here.
    return f"Dottore Review could not complete: {error_text(exc)}"


def current_head_sha():
    result = run(["git", "rev-parse", "HEAD"], timeout=30, check=True)
    return result.stdout.strip()


def ensure_local_head(head_sha, pr_num):
    if not head_sha or current_head_sha() == head_sha:
        return
    if pr_num:
        run(
            [
                "git",
                "fetch",
                "--force",
                "origin",
                f"pull/{pr_num}/head:refs/remotes/dottore-review/pr-{pr_num}",
            ],
            timeout=120,
        )
    checkout = run(["git", "checkout", "--detach", head_sha], timeout=90)
    if checkout.returncode != 0:
        raise RuntimeError(
            "Local checkout does not contain the PR head GitHub reported: "
            f"{head_sha}\n{checkout.stdout}{checkout.stderr}"
        )
    actual = current_head_sha()
    if actual != head_sha:
        raise RuntimeError(f"Local checkout is {actual}, expected PR head {head_sha}")


def issue_comments(pr_num):
    gh = run_gh(
        [
            "api",
            f"repos/{os.environ['GITHUB_REPOSITORY']}/issues/{pr_num}/comments?per_page=100",
            "--paginate",
        ],
        check=True,
    )
    return load_json_list(gh.stdout)


def sorted_walkthrough_comments(pr_num):
    walkthroughs = [
        comment
        for comment in issue_comments(pr_num)
        if DOTTORE_MARKER in comment.get("body", "") and (comment.get("user") or {}).get("login") == DOTTORE_LOGIN
    ]
    return sorted(
        walkthroughs,
        key=lambda comment: (
            comment.get("updated_at") or "",
            comment.get("created_at") or "",
            comment.get("id") or 0,
        ),
    )


def latest_walkthrough_comment(pr_num):
    walkthroughs = sorted_walkthrough_comments(pr_num)
    if not walkthroughs:
        return None
    return walkthroughs[-1]


def pull_inline_comments(pr_num):
    gh = run_gh(
        [
            "api",
            f"repos/{os.environ['GITHUB_REPOSITORY']}/pulls/{pr_num}/comments?per_page=100",
            "--paginate",
        ],
        check=True,
    )
    return load_json_list(gh.stdout)


REVIEW_THREADS_QUERY = """
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id isResolved path line originalLine diffSide
          comments(first: 50) { nodes { databaseId body author { __typename login } } }
        }
      }
    }
  }
}
"""
RESOLVE_THREAD_MUTATION = "mutation($thread: ID!) { resolveReviewThread(input: {threadId: $thread}) { thread { id } } }"
MAX_REPAIR_THREADS = 12


def open_dottore_threads(pr_num, answered=False):
    """The unresolved review threads Dottore opened that no one else has replied to, or all of them with answered."""
    # ponytail: the first 100 threads and 50 comments a thread; page reviewThreads when a PR outgrows that.
    owner, name = os.environ["GITHUB_REPOSITORY"].split("/", 1)
    gh = run_gh(
        ["api", "graphql", "-f", f"query={REVIEW_THREADS_QUERY}", "-f", f"owner={owner}", "-f", f"name={name}", "-F", f"number={pr_num}"],
        check=True,
    )
    data = json.loads(gh.stdout or "{}").get("data") or {}
    nodes = ((((data.get("repository") or {}).get("pullRequest") or {}).get("reviewThreads") or {}).get("nodes")) or []
    threads = []
    for node in nodes:
        comments = (node.get("comments") or {}).get("nodes") or []
        if node.get("isResolved") or not comments:
            continue
        first = comments[0]
        author = first.get("author") or {}
        marker = FINDING_MARKER_RE.search(first.get("body") or "")
        if author.get("__typename") != "Bot" or not marker:
            continue
        # A person who answered the thread owns its outcome.
        if not answered and any((comment.get("author") or {}).get("login") != author.get("login") for comment in comments[1:]):
            continue
        threads.append(
            {
                "thread_id": node.get("id"),
                "comment_id": first.get("databaseId"),
                "id": marker.group(1),
                "path": node.get("path") or "",
                "line": node.get("line"),
                "original_line": node.get("originalLine"),
                "side": node.get("diffSide") or "RIGHT",
                "body": first.get("body") or "",
            }
        )
    return threads


def threads_to_check(pr_num, files, prior_contracts):
    """The open Dottore threads on the files this round changed, with their finding text and repair contract."""
    # ponytail: a thread whose file this round left alone is not checked, so a repair made only in another file
    # waits for a person or a later round that touches the thread's file; check every open thread if that shows up.
    try:
        threads = open_dottore_threads(pr_num) if pr_num else []
    except Exception as exc:
        print(f"Dottore could not list the open threads: {error_text(exc)}", flush=True)
        return []
    contracts = {entry.get("id"): entry for entry in prior_contracts}
    chosen = []
    for thread in threads:
        if thread["path"] not in files:
            continue
        body = thread.pop("body")
        heading = re.search(r"### .*?\b(?:BLOCKING|HIGH|MEDIUM|LOW):\s*(.+)", body)
        contract = contracts.get(thread["id"]) or {}
        chosen.append(
            {
                **thread,
                "title": contract.get("title") or (heading.group(1).strip() if heading else "Prior Dottore finding"),
                "finding": redact_for_model(FINDING_MARKER_RE.sub("", body).strip()),
                "contract": contract.get("repair_contract"),
            }
        )
    if len(chosen) > MAX_REPAIR_THREADS:
        print(f"Dottore threads: checking {MAX_REPAIR_THREADS} of {len(chosen)} open threads on changed files", flush=True)
    return chosen[:MAX_REPAIR_THREADS]


def resolve_repaired_threads(pr_num, repaired, head_sha):
    """Resolve each thread the checker found repaired, then reply, unless it was resolved or answered since."""
    repaired = [item for item in repaired if item.get("thread_id") and item.get("comment_id")]
    if not repaired:
        return
    try:
        still_open = {thread["thread_id"] for thread in open_dottore_threads(pr_num)}
    except Exception as exc:
        print(f"::warning::Dottore could not list the open threads, so none were resolved: {error_text(exc)}", flush=True)
        return
    for item in repaired:
        if item["thread_id"] not in still_open:
            continue
        reply = f"🎭 Hypothesis confirmed — repaired in `{short_ref(head_sha)}`: {item.get('note') or 'the defect no longer reproduces at this head.'}"
        evidence = (item.get("evidence") or [{}])[0]
        if evidence.get("snippet"):
            reply += f"\n\n`{evidence.get('path')}:{evidence.get('line')}`\n```text\n{code_block_text(evidence['snippet'])}\n```"
        # Resolve first: a reply on a thread that stays open would be posted again by every later review.
        try:
            run_gh(["api", "graphql", "-f", f"query={RESOLVE_THREAD_MUTATION}", "-f", f"thread={item['thread_id']}"], check=True)
        except Exception as exc:
            print(f"::warning::Dottore could not resolve thread {item['thread_id']}: {error_text(exc)}", flush=True)
            continue
        print(f"Dottore resolved thread {item['thread_id']} ({item.get('path')}:{item.get('line')})", flush=True)
        try:
            run_gh(
                ["api", "--method", "POST", f"repos/{os.environ['GITHUB_REPOSITORY']}/pulls/{pr_num}/comments/{item['comment_id']}/replies", "--input", "-"],
                input_text=json.dumps({"body": reply}),
                check=True,
            )
        except Exception as exc:
            print(f"::warning::Dottore resolved thread {item['thread_id']} but could not reply: {error_text(exc)}", flush=True)


def extract_repair_contract_from_markdown(body):
    contract = {}
    in_contract = False
    current_key = None
    for raw_line in (body or "").splitlines():
        line = raw_line.strip()
        if "<summary>Repair contract</summary>" in line:
            in_contract = True
            continue
        if in_contract and line == "</details>":
            break
        if not in_contract or not line:
            continue
        label_match = re.match(r"- \*\*(.+?):\*\*\s*(.*)$", line)
        if label_match:
            key = CONTRACT_LABEL_TO_KEY.get(label_match.group(1).strip().lower())
            if not key:
                current_key = None
                continue
            current_key = key
            value = label_match.group(2).strip()
            contract[key] = [value] if value else []
            continue
        if current_key and line.startswith("- "):
            contract.setdefault(current_key, []).append(line[2:].strip())
    return compact_contract_for_state(contract)


def inline_comment_contract_entry(comment):
    body = comment.get("body", "")
    contract = extract_repair_contract_from_markdown(body)
    if not contract:
        return None
    marker = inline_comment_marker(comment) or ""
    title = ""
    severity = "medium"
    for line in body.splitlines():
        match = re.match(r"### .*?\b(BLOCKING|HIGH|MEDIUM|LOW):\s*(.+)$", line.strip())
        if match:
            severity = match.group(1).lower()
            title = match.group(2).strip()
            break
    path = str(comment.get("path") or "").strip()
    line_number = comment.get("line") if isinstance(comment.get("line"), int) else None
    location_match = re.search(r"\*\*Location:\*\* `(.+):(\d+)`", body)
    if location_match:
        path = location_match.group(1).strip()
        line_number = int(location_match.group(2))
    fix_hint = ""
    fix_match = re.search(r"\*\*Suggested fix:\*\*\s*(.+)", body)
    if fix_match:
        fix_hint = fix_match.group(1).strip()
    return {
        "id": marker,
        "status": "prior",
        "severity": severity,
        "path": path,
        "line": line_number,
        "side": str(comment.get("side") or "RIGHT").upper(),
        "title": title,
        "fix_hint": fix_hint,
        "repair_contract": contract,
    }


def prior_inline_contract_state(pr_num):
    if not pr_num:
        return []
    try:
        comments = pull_inline_comments(pr_num)
    except Exception:
        return []
    entries = []
    seen = set()
    for comment in sorted(
        comments,
        key=lambda item: (
            item.get("updated_at") or "",
            item.get("created_at") or "",
            item.get("id") or 0,
        ),
        reverse=True,
    ):
        if "dottore:finding=" not in comment.get("body", ""):
            continue
        entry = inline_comment_contract_entry(comment)
        if not entry:
            continue
        key = entry.get("id") or (
            entry.get("path"),
            entry.get("line"),
            entry.get("title"),
        )
        if key in seen:
            continue
        seen.add(key)
        entries.append(entry)
        if len(entries) >= MAX_CONTRACT_STATE_ENTRIES:
            break
    return normalize_contract_state_entries(entries)


def prior_review_contract_state(pr_num):
    if not pr_num:
        return []
    comment = latest_walkthrough_comment(pr_num)
    if comment:
        entries = decode_contract_state_from_body(walkthrough_header(comment.get("body")))
        if entries:
            return entries
    return prior_inline_contract_state(pr_num)


def is_completed_review_body(body):
    if not STATE_MARKER_RE.search(walkthrough_header(body)):
        return False
    lowered = body.lower()
    failed_markers = (
        "review failed",
        "specimen unexamined",
        "could not complete",
        "no model findings are available",
        "review skipped",
    )
    return not any(marker in lowered for marker in failed_markers)


def discover_last_reviewed_sha(pr_num):
    for comment in reversed(sorted_walkthrough_comments(pr_num)):
        body = comment.get("body", "")
        if not is_completed_review_body(body):
            continue
        matches = STATE_MARKER_RE.findall(walkthrough_header(body))
        if matches:
            return matches[-1]
    return None


def valid_review_base_sha(candidate, head_sha):
    if not candidate or not re.fullmatch(r"[0-9a-f]{40}", candidate):
        return False
    exists = run(["git", "cat-file", "-e", f"{candidate}^{{commit}}"])
    if exists.returncode != 0:
        run(["git", "fetch", "--no-tags", "--depth=200", "origin", candidate], timeout=120)
        exists = run(["git", "cat-file", "-e", f"{candidate}^{{commit}}"])
    if exists.returncode != 0:
        return False
    ancestor = run(["git", "merge-base", "--is-ancestor", candidate, head_sha])
    return ancestor.returncode == 0


def resolve_review_base(pr_num, requested_mode):
    pr = run_gh(
        [
            "pr",
            "view",
            pr_num,
            "--json",
            "baseRefName,headRefOid",
        ],
        check=True,
    )
    data = json.loads(pr.stdout)
    base_ref = os.environ.get("PR_BASE_REF") or data["baseRefName"]
    head_sha = os.environ.get("PR_HEAD_SHA") or data["headRefOid"]
    mode = requested_mode
    if mode == "full":
        return f"origin/{base_ref}", base_ref, head_sha, mode
    explicit_previous = os.environ.get("DOTTORE_LAST_REVIEWED_SHA", "").strip()
    if valid_review_base_sha(explicit_previous, head_sha):
        return explicit_previous, base_ref, head_sha, "incremental"
    previous = discover_last_reviewed_sha(pr_num)
    if valid_review_base_sha(previous, head_sha):
        return previous, base_ref, head_sha, "incremental"
    return f"origin/{base_ref}", base_ref, head_sha, "full"


def git_out(args):
    result = run(["git", *args])
    return result.stdout.strip() if result.returncode == 0 else ""


def review_base_commit(base, base_ref, mode):
    """The commit the diff runs from, and the mode. A full review diffs from where the PR left its base branch. An
    incremental one diffs from the last reviewed head; when the base branch was merged into the PR since, it diffs
    from that head with the same base merged into it, so only the PR's own changes show. If that merge conflicts,
    the review is full."""
    target = f"origin/{base_ref}"
    if mode != "incremental":
        return git_out(["merge-base", target, "HEAD"]) or base, mode
    now, then = git_out(["merge-base", target, "HEAD"]), git_out(["merge-base", target, base])
    if not now or not then or now == then:
        return base, mode
    merged = run(["git", "merge-tree", "--write-tree", "--no-messages", now, base])
    tree = merged.stdout.split("\n", 1)[0].strip()
    if merged.returncode == 0 and tree:
        commit = git_out(
            ["-c", "user.name=Dottore", "-c", "user.email=dottore@localhost", "commit-tree", tree, "-p", base, "-p", now, "-m", "Dottore review base"]
        )
        if commit:
            print(f"Dottore review base: {base[:12]} with {target} at {now[:12]} merged in", flush=True)
            return commit, mode
    print(f"Dottore review base: the base branch merged since {base[:12]} conflicts; reviewing in full", flush=True)
    return git_out(["merge-base", target, "HEAD"]) or target, "full"


def anchorable_lines(allowed, base_ref, mode):
    """GitHub anchors a review thread to the pull request's diff from its merge base, not to an incremental review's
    base: a line the previous head changed and this head changed back has no thread, so its finding goes in the
    walkthrough."""
    merge_base = git_out(["merge-base", f"origin/{base_ref}", "HEAD"]) if mode == "incremental" else ""
    return touched_lines(merge_base) if merge_base else allowed


def parse_command_mode():
    body = os.environ.get("DOTTORE_COMMENT_BODY", "")
    if "/dottore" not in body:
        return os.environ.get("DOTTORE_REVIEW_MODE", "auto")
    if re.search(r"/dottore\s+full\b", body):
        return "full"
    if re.search(r"/dottore\s+review\b", body):
        return "auto"
    return "auto"


def missing_model_text(missing):
    names = ", ".join(f"`{name}`" for name in missing)
    return f"The reviewer could not run because {names} {'is' if len(missing) == 1 else 'are'} not set for this workflow run. The specimen stays unexamined."


def produce_review(args):
    pr_num = os.environ.get("PR_NUM", "")
    missing = missing_model_setup()
    if not pr_num and missing:
        write_skipped_review("Review Skipped", missing_model_text(missing))
        print("Dottore telemetry: skipped=missing_model_setup", flush=True)
        return

    requested_mode = args.mode or parse_command_mode()
    base, base_ref, head_sha, effective_mode = resolve_review_base(pr_num, requested_mode)
    ensure_local_head(head_sha, pr_num)
    base, effective_mode = review_base_commit(base, base_ref, effective_mode)
    patch_command_status_running(pr_num, head_sha, effective_mode)
    files = changed_files(base)
    if not files and effective_mode == "incremental":
        # The last walkthrough (a base merge or a repeated /dottore changed nothing) is carried to this head.
        carried = (latest_walkthrough_comment(pr_num) or {}).get("body") or ""
        write_skipped_review(
            "No New Diff Reviewed",
            "Dottore already reviewed this head; this run did not inspect new changes.",
            status="pass",
            metadata={
                "head_sha": head_sha,
                "head_commit_message": commit_subject(head_sha),
                "review_base": base,
                "base_ref": base_ref,
                "mode": effective_mode,
                "review_state": "no_new_diff_reviewed",
                "carried_walkthrough": carried if STATE_MARKER_RE.search(walkthrough_header(carried)) else "",
            },
        )
        print("Dottore telemetry: skipped=no_new_diff_reviewed", flush=True)
        return

    if missing:
        write_skipped_review(
            "Review Skipped",
            missing_model_text(missing),
            metadata={
                "head_sha": head_sha,
                "head_commit_message": commit_subject(head_sha),
                "review_base": base,
                "base_ref": base_ref,
                "mode": effective_mode,
            },
        )
        print("Dottore telemetry: skipped=missing_model_setup", flush=True)
        return

    chunks = chunk_changed_files(base, files)
    prompts = prompt_sections(dottore_prompt_path().read_text("utf-8"))
    prior_contract_state = prior_review_contract_state(pr_num)
    prior_contract_context = (
        format_contract_entries_for_prompt(prior_contract_state)
        if prior_contract_state
        else prior_review_contracts_context(pr_num)
    )
    threads = threads_to_check(pr_num, set(files), prior_contract_state)
    review_target = (
        f"Review this PR. The review base is commit '{base}' on target branch '{base_ref}', "
        f"head is '{head_sha}', and mode is '{effective_mode}'."
    )
    description = pr_description(pr_num)
    bundles, packets = [], []
    for index, chunk in enumerate(chunks, 1):
        bundle = build_bundle(base, chunk, description)
        focus_note = (
            f"This is packet {index} of {len(chunks)}. Review only these focus files: {', '.join(chunk)}."
            if len(chunks) > 1
            else "Review the full current diff."
        )
        bundles.append(bundle)
        packets.append(finder_packet(review_target, focus_note, prior_contract_context, bundle))
    stats = build_stats("".join(bundles))
    print(f"Dottore bundles: packets={len(bundles)}; chars={','.join(str(len(bundle)) for bundle in bundles)}", flush=True)
    allowed = touched_lines(base)
    try:
        models = role_models()
        ctx = ReviewRun(
            clients=review_clients(models),
            prompts=prompts,
            system=reviewer_system(prompts),
            bundles=bundles,
            packets=packets,
            cache_key=f"dottore-{os.environ.get('GITHUB_REPOSITORY', 'local')}-{pr_num or head_sha[:12]}",
            allowed=allowed,
            anchorable=anchorable_lines(allowed, base_ref, effective_mode),
            models=models,
            stats=stats,
            base=base,
            merge_base=base,
            files=frozenset(files),
            deadline=stats["started_at"] + REVIEW_DEADLINE_SECONDS,
            cost_limit=cost_limit(),
            chunks=chunks,
        )
        print(
            "Dottore roles: "
            + "; ".join(
                f"{role}={settings['slot']}:{settings['api']}/{settings['model']}/{settings['effort'] or '-'}"
                for role, settings in models.items()
            )
            + f"; finders={finder_count()}; cost_limit_usd={ctx.cost_limit or '-'}",
            flush=True,
        )
        with ThreadPoolExecutor(max_workers=review_concurrency()) as pool:
            review_obj = agentic_review(ctx, effective_mode, pool, threads)
    except Exception as exc:
        write_skipped_review(
            "Review Failed",
            model_failure_detail(exc),
            status="fail",
            metadata={
                "head_sha": head_sha,
                "head_commit_message": commit_subject(head_sha),
                "review_base": base,
                "base_ref": base_ref,
                "mode": effective_mode,
            },
        )
        print_telemetry(stats)
        return
    if len(chunks) > 1:
        review_obj["what_i_checked"].append(
            f"Examined the PR in {len(chunks)} file packet(s) so the large diff did not contaminate context retention."
        )
    for key in ("findings", "nitpicks", "pre_merge_checks"):
        if review_obj.get(key) is None:
            review_obj[key] = []
    review_obj.setdefault("head_sha", head_sha)
    review_obj.setdefault("head_commit_message", commit_subject(head_sha))
    review_obj.setdefault("review_base", base)
    review_obj.setdefault("base_ref", base_ref)
    review_obj.setdefault("mode", effective_mode)
    review_obj.setdefault("what_i_checked", []).append(
        f"Selected review base `{base}` for target branch `{base_ref}` in `{effective_mode}` mode."
    )
    try:
        valid_findings, _, _ = validate_review_items(review_obj, base, outside_ok=True)
        raised = {finding_id(finding) for finding in valid_findings}
    except Exception:
        raised = set()
    # A thread whose finding this round raised again stays open, whatever its check said.
    resolved = [item for item in review_obj.get("repairs") or [] if item["verdict"] == "resolved" and item["id"] not in raised]
    review_obj["resolved_since_last_review"] = resolved
    # A resolved thread's contract is not carried into the next round.
    review_obj["_prior_dottore_contract_state"] = [
        entry for entry in prior_contract_state if entry.get("id") not in {item["id"] for item in resolved}
    ]
    pathlib.Path("review.json").write_text(
        json.dumps(review_obj, indent=2, sort_keys=True) + "\n", "utf-8"
    )
    print_telemetry(stats)


def findings_for_inline_comments(findings):
    """Every defect, low included, becomes a review thread; nitpicks never do."""
    return [finding for finding in findings if is_defect(finding)]


CARRY_NOTE_RE = re.compile(r"\n\n> 🎭 \*No new diff since [^\n]*\*\s*$")


def carry_walkthrough(body, head_sha):
    """The last walkthrough, now recorded for this head: its verdict, threads state and discharge stand, because the
    code it examined is this head's code. A fresh examination is one `/dottore full` away."""
    reviewed = STATE_MARKER_RE.search(walkthrough_header(body))
    carried = body.replace(reviewed.group(0), f"<!-- dottore:last-reviewed-sha={head_sha} -->", 1)
    return CARRY_NOTE_RE.sub("", carried).rstrip() + (
        f"\n\n> 🎭 *No new diff since `{short_ref(reviewed.group(1))}`; that examination stands for `{short_ref(head_sha)}`."
        " Comment `/dottore full` for a fresh one.*"
    )


def carried_title(review_obj):
    match = re.search(r"^## 🎭 Dottore Review: (.+)$", review_obj.get("carried_walkthrough") or "", re.M)
    return match.group(1).strip() if match else ""


def render_review(args):
    review_obj = json.loads(pathlib.Path(args.review_json).read_text("utf-8"))
    if review_obj.get("review_state") == "no_new_diff_reviewed" and carried_title(review_obj):
        head_sha = review_obj.get("head_sha") or os.environ.get("PR_HEAD_SHA", "")
        pathlib.Path("review.md").write_text(carry_walkthrough(review_obj["carried_walkthrough"], head_sha), "utf-8")
        pathlib.Path("inline-comments.json").write_text("[]\n", "utf-8")
        return
    base = args.base or review_obj.get("review_base")
    if not base:
        pr_num = os.environ.get("PR_NUM", "")
        requested_mode = args.mode or parse_command_mode()
        base, _, _, _ = resolve_review_base(pr_num, requested_mode)
    findings, nitpicks, invalid = validate_review_items(review_obj, base, outside_ok=True)
    # Candidates withheld before verification count with the ones withheld here.
    invalid = [*as_list(review_obj.get("withheld_findings")), *invalid]
    head_sha = review_obj.get("head_sha") or os.environ.get("PR_HEAD_SHA", "")
    walkthrough = render_walkthrough(
        review_obj,
        findings,
        nitpicks,
        invalid,
        head_sha,
        prior_contracts=review_obj.get("_prior_dottore_contract_state") or [],
    )
    pathlib.Path("review.md").write_text(walkthrough, "utf-8")
    # The counts the walkthrough published, for the commit status: the raw report still holds the withheld ones.
    defects = [finding for finding in findings if is_defect(finding)]
    notes = [finding for finding in findings if not is_defect(finding)] + list(nitpicks)
    review_obj["published"] = {
        "defects": len(defects),
        "notes": len(notes),
        "verdict": merge_signal(review_obj, defects, notes, review_obj.get("pre_merge_checks") or [])["title"],
    }
    pathlib.Path(args.review_json).write_text(json.dumps(review_obj, indent=2, sort_keys=True) + "\n", "utf-8")
    inline_findings = findings_for_inline_comments([finding for finding in findings if not finding.outside_diff])
    inline = [
        {
            "path": f.path,
            "line": f.line,
            "side": f.side,
            "body": render_finding_body(f),
        }
        for f in inline_findings
    ]
    pathlib.Path("inline-comments.json").write_text(
        json.dumps(inline, indent=2, sort_keys=True) + "\n", "utf-8"
    )


def find_command_status_comment(pr_num):
    """The latest status window Dottore posted; another author's comment carrying the marker cannot be edited."""
    ids = [
        comment.get("id")
        for comment in issue_comments(pr_num)
        if COMMAND_STATUS_MARKER in comment.get("body", "") and (comment.get("user") or {}).get("login") == DOTTORE_LOGIN
    ]
    return ids[-1] if ids else None


def patch_command_status_running(pr_num, head_sha, mode):
    body = "\n".join(
        [
            COMMAND_STATUS_MARKER,
            "## 🎭 Dottore Review — Experiment in Progress",
            "",
            f'<img src="{dottore_chibi("EXPERIMENT IN PROGRESS", head_sha)}" alt="Dottore" width="96" align="right" hspace="16">',
            "",
            "> [!NOTE]",
            "> Reviewer workflow is running. The specimen is under observation.",
            "",
            f"- **Mode:** `{mode or 'unknown'}`",
            f"- **{commit_line(head_sha)}**",
        ]
    )
    patch_or_create_command_status(pr_num, body)


def patch_command_status_complete(pr_num, head_sha, carried=False):
    body = "\n".join(
        [
            COMMAND_STATUS_MARKER,
            "## 🎭 Dottore Review — Concluded",
            "",
            f'<img src="{dottore_chibi("CONCLUDED", head_sha)}" alt="Dottore" width="96" align="right" hspace="16">',
            "",
            "> [!TIP]",
            "> No new diff since the last examination; its verdict stands for this head. Comment `/dottore full` for a fresh one."
            if carried
            else "> Review posted. The specimen has left the observation table.",
            "",
            f"- **{commit_line(head_sha)}**",
        ]
    )
    patch_or_create_command_status(pr_num, body)


def patch_or_create_command_status(pr_num, body):
    comment_id = find_command_status_comment(pr_num)
    if comment_id:
        run_gh(
            [
                "api",
                "--method",
                "PATCH",
                f"repos/{os.environ['GITHUB_REPOSITORY']}/issues/comments/{comment_id}",
                "--input",
                "-",
            ],
            input_text=json.dumps({"body": body}),
            check=True,
        )
        return
    run_gh(
        [
            "api",
            "--method",
            "POST",
            f"repos/{os.environ['GITHUB_REPOSITORY']}/issues/{pr_num}/comments",
            "--input",
            "-",
        ],
        input_text=json.dumps({"body": body}),
        check=True,
    )


def load_json_list(stdout):
    try:
        loaded = json.loads(stdout or "[]")
        return loaded if isinstance(loaded, list) else []
    except json.JSONDecodeError:
        items = []
        for line in stdout.splitlines():
            if not line.strip():
                continue
            loaded = json.loads(line)
            if isinstance(loaded, list):
                items.extend(loaded)
        return items


def existing_inline_finding_markers(pr_num):
    markers = set()
    for comment in pull_inline_comments(pr_num):
        markers.update(FINDING_MARKER_RE.findall(comment.get("body", "")))
    return markers


def inline_comment_marker(comment):
    match = FINDING_MARKER_RE.search(comment.get("body", ""))
    if not match:
        return None
    return match.group(1)


def filter_duplicate_inline_comments(pr_num, comments):
    existing = existing_inline_finding_markers(pr_num)
    if not existing:
        return comments
    filtered = []
    for comment in comments:
        marker = inline_comment_marker(comment)
        if marker and marker in existing:
            continue
        filtered.append(comment)
    return filtered


def post_review(args):
    pr_num = os.environ["PR_NUM"]
    body = pathlib.Path(args.review_md).read_text("utf-8")
    head_sha_match = STATE_MARKER_RE.search(walkthrough_header(body))
    head_sha = head_sha_match.group(1) if head_sha_match else os.environ.get(
        "PR_HEAD_SHA", ""
    )
    existing = latest_walkthrough_comment(pr_num)
    if existing and autofix_ticked(existing.get("body")):
        body = body.replace(AUTOFIX_BOX, AUTOFIX_BOX.replace("- [ ]", "- [x]", 1), 1)
    comment_id = existing.get("id") if existing else None
    if comment_id:
        run_gh(
            [
                "api",
                "--method",
                "PATCH",
                f"repos/{os.environ['GITHUB_REPOSITORY']}/issues/comments/{comment_id}",
                "--input",
                "-",
            ],
            input_text=json.dumps({"body": body}),
            check=True,
        )
    else:
        run_gh(["pr", "comment", pr_num, "--body-file", args.review_md], check=True)

    patch_command_status_complete(pr_num, head_sha, carried=bool(carried_title(load_review_for_status(args.review_json))))

    comments = json.loads(pathlib.Path(args.inline_json).read_text("utf-8"))
    comments = filter_duplicate_inline_comments(pr_num, comments)
    if not comments:
        return
    payload = {
        "event": "COMMENT",
        "commit_id": head_sha,
        "body": "Dottore Review — isolated defects from the specimen.",
        "comments": comments,
    }
    run_gh(
        [
            "api",
            "--method",
            "POST",
            f"repos/{os.environ['GITHUB_REPOSITORY']}/pulls/{pr_num}/reviews",
            "--input",
            "-",
        ],
        input_text=json.dumps(payload),
        check=True,
    )


def autofix_ticked(body):
    match = AUTOFIX_BOX_RE.search(body or "")
    return bool(match and match.group(1) in "xX")


def autofix_rounds(pr_num):
    """Dottore's repairs at the tip of the PR since the last commit a person pushed."""
    # ponytail: the PR commits API lists at most 250 commits; past that the count reads 0 and the cap resets.
    gh = run_gh(["api", f"repos/{os.environ['GITHUB_REPOSITORY']}/pulls/{pr_num}/commits?per_page=100", "--paginate"], check=True)
    rounds = 0
    for commit in reversed(load_json_list(gh.stdout)):
        if AUTOFIX_TRAILER not in ((commit.get("commit") or {}).get("message") or ""):
            break
        rounds += 1
    return rounds


def autofix_task(threads):
    parts = [
        "Fix the open code-review findings below in this repository. Read AGENTS.md (and CLAUDE.md if present) for its"
        " rules first.",
        "Make the smallest change that repairs each one and touch only the files it needs. Never edit a file under"
        " .github/workflows/: if a finding needs that, leave it and say so.",
        "If a finding is wrong or cannot be fixed safely, leave that code alone and say why in your final message.",
        "Do not run tests, builds or commands: CI runs this repository's checks on your change after you finish, and"
        " you do not commit.",
        "Your final message becomes the commit body under a title that names the findings. Write it as a change"
        " description in the third person, two to four sentences per finding: what was wrong and what the code now"
        " does. No first person, no greetings, no mention of tests you did not run, no trailers.",
    ]
    for number, thread in enumerate(threads[:MAX_REPAIR_THREADS], 1):
        parts += ["", f"## Finding {number}", re.sub(r"<!--.*?-->", "", thread["body"], flags=re.S).strip()]
    return "\n".join(parts) + "\n"


def autofix_prompt(args):
    """Whether Dottore repairs this PR now: a person asked (ticked the box or commented /dottore autofix), or a review
    just finished with the box ticked. Writes the fixer's prompt and the head it is for, and prints autofix=true for
    GITHUB_OUTPUT; a reason it cannot goes to the PR as a comment."""
    pr_num, repo = os.environ["PR_NUM"], os.environ["GITHUB_REPOSITORY"]
    asked = args.trigger == "asked"
    if not asked:
        walkthrough = latest_walkthrough_comment(pr_num)
        if not walkthrough or not autofix_ticked(walkthrough.get("body")):
            return
    fields = "isCrossRepository,maintainerCanModify,headRepository,headRepositoryOwner,headRefName,headRefOid,state"
    pr = json.loads(run_gh(["pr", "view", pr_num, "--repo", repo, "--json", fields], check=True).stdout)
    if pr.get("state") != "OPEN":
        return
    # The repair goes to the head branch's repository: this one, or a fork whose author allowed edits by maintainers.
    owner, name = (pr.get("headRepositoryOwner") or {}).get("login"), (pr.get("headRepository") or {}).get("name")
    head_repo = f"{owner}/{name}"
    note, threads = "", []
    if not name:
        note = "This pull request's fork was deleted, so Dottore has no branch to push a repair to."
    elif pr.get("isCrossRepository") and not pr.get("maintainerCanModify"):
        note = (
            f"Dottore cannot push repairs to `{head_repo}`, because this pull request does not allow edits by"
            " maintainers. Its author can tick **Allow edits and access to secrets by maintainers** on the pull request"
            " (a fork owned by an organisation cannot), or use the repair prompt at the end of the review instead."
        )
    elif os.environ.get("DOTTORE_SMALL_API", "").strip().lower() != "anthropic":
        # The repair runs Claude Code, which speaks only Claude's Messages format. Read raw, so a bad value gets this
        # reply instead of model_slot's error.
        note = "Dottore repairs with its small model through Claude Code, which needs `DOTTORE_SMALL_API` set to `anthropic`."
    elif not asked and (rounds := autofix_rounds(pr_num)) >= MAX_AUTOFIX_ROUNDS:
        note = (
            f"Dottore made {rounds} repair{'s' if rounds != 1 else ''} since the last push from a person and stops here."
            " Push a change, or untick and tick the box, to let it try again."
        )
    else:
        # The resolve job closes the threads this review found repaired after this step, so they are not open work.
        repaired = {item.get("thread_id") for item in load_review_for_status(args.review_json).get("resolved_since_last_review") or []}
        threads = [thread for thread in open_dottore_threads(pr_num) if asked or thread["thread_id"] not in repaired]
        if not threads and asked:
            note = "There are no open Dottore findings to repair."
    if note:
        run_gh(["pr", "comment", pr_num, "--repo", repo, "--body", f"🩺 {note}"], check=True)
    if not threads:
        return
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "prompt.md").write_text(autofix_task(threads), "utf-8")
    # The branch name and the findings are data for the push job (jq, quoted), never sourced as shell; the findings
    # name the commit.
    findings = []
    for thread in threads[:MAX_REPAIR_THREADS]:
        heading = re.search(r"### .*?\b(?:BLOCKING|HIGH|MEDIUM|LOW):\s*(.+)", thread["body"])
        title = heading.group(1).strip() if heading else "Dottore finding"
        findings.append({"path": thread["path"], "line": thread["line"], "title": title})
    meta = {"head_repo": head_repo, "head_ref": pr["headRefName"], "head_sha": pr["headRefOid"], "findings": findings}
    (out / "meta.json").write_text(json.dumps(meta), "utf-8")
    print("autofix=true")


def checks_not_passed(base, head):
    """The checks the base branch's rulesets require that have not passed on head; every check on head when the
    rulesets require none."""
    repo = os.environ["GITHUB_REPOSITORY"]
    rules = load_json_list(run_gh(["api", f"repos/{repo}/rules/branches/{base}"], check=True).stdout)
    required = {
        check.get("context")
        for rule in rules
        if rule.get("type") == "required_status_checks"
        for check in (rule.get("parameters") or {}).get("required_status_checks") or []
    }
    passed = {}
    # ponytail: the first 100 check runs on the head (the latest per name); page them when a PR carries more.
    runs = json.loads(run_gh(["api", f"repos/{repo}/commits/{head}/check-runs?per_page=100"], check=True).stdout)
    for check_run in runs.get("check_runs") or []:
        done = check_run.get("status") == "completed" and check_run.get("conclusion") in ("success", "neutral", "skipped")
        passed[check_run.get("name")] = done
    combined = json.loads(run_gh(["api", f"repos/{repo}/commits/{head}/status"], check=True).stdout)
    for status in combined.get("statuses") or []:
        passed[status.get("context")] = status.get("state") == "success"
    return sorted(name for name in (required or passed) if not passed.get(name))


def approve(args):
    """Approve the head when Dottore's verdict on it is Viable, none of its threads are unresolved and the checks
    passed, and dismiss its approvals of earlier heads. The approval is a signal: no ruleset counts it. A person who
    asked (/dottore approve) is told what is still missing."""
    pr_num, repo = os.environ["PR_NUM"], os.environ["GITHUB_REPOSITORY"]
    asked = args.trigger == "asked"
    pr = json.loads(
        run_gh(["pr", "view", pr_num, "--repo", repo, "--json", "state,isDraft,headRefOid,baseRefName"], check=True).stdout
    )
    head = pr["headRefOid"]
    reviews = load_json_list(run_gh(["api", f"repos/{repo}/pulls/{pr_num}/reviews?per_page=100", "--paginate"], check=True).stdout)
    approvals = [
        review
        for review in reviews
        if (review.get("user") or {}).get("login") == DOTTORE_LOGIN and review.get("state") == "APPROVED"
    ]
    for review in approvals:
        if review.get("commit_id") != head:
            message = f"message=The specimen changed; `{short_ref(head)}` needs its own examination."
            run_gh(["api", "-X", "PUT", f"repos/{repo}/pulls/{pr_num}/reviews/{review['id']}/dismissals", "-f", message, "-f", "event=DISMISS"], check=True)
    if pr.get("state") != "OPEN" or pr.get("isDraft"):
        return
    if any(review.get("commit_id") == head for review in approvals):
        if asked:
            run_gh(["pr", "comment", pr_num, "--repo", repo, "--body", f"🎭 Dottore already discharged `{short_ref(head)}`."], check=True)
        return
    body = walkthrough_header((latest_walkthrough_comment(pr_num) or {}).get("body"))
    reviewed = STATE_MARKER_RE.search(body)
    missing = []
    if not reviewed or reviewed.group(1) != head:
        missing.append(f"Dottore has not finished examining `{short_ref(head)}`")
    elif DISCHARGE_MARKER not in body:
        missing.append("its examination of this head did not end Viable")
    if unresolved := len(open_dottore_threads(pr_num, answered=True)):
        missing.append(f"{unresolved} Dottore thread(s) are unresolved")
    if failing := checks_not_passed(pr["baseRefName"], head):
        missing.append("these checks have not passed: " + ", ".join(f"`{name}`" for name in failing))
    if missing:
        print("Not approved: " + "; ".join(missing))
        if asked:
            note = "🎭 Dottore cannot discharge this specimen yet: " + "; ".join(missing) + "."
            run_gh(["pr", "comment", pr_num, "--repo", repo, "--body", note], check=True)
        return
    approval = (
        f"🎭 **Specimen discharged.** Dottore's examination of `{short_ref(head)}` ended Viable, every Dottore thread is"
        " resolved and the checks passed. This approval is a signal; the merge decision stays with the maintainers."
    )
    result = run_gh(
        ["api", "-X", "POST", f"repos/{repo}/pulls/{pr_num}/reviews", "-f", f"commit_id={head}", "-f", "event=APPROVE", "-f", f"body={approval}"]
    )
    if result.returncode:
        # GitHub refuses unless the repository allows GitHub Actions to approve pull requests.
        print(f"::warning::Dottore could not approve {short_ref(head)}: {(result.stderr or result.stdout).strip()[:300]}")
        return
    print(f"Approved {head}")


def load_review_for_status(path):
    try:
        return json.loads(pathlib.Path(path).read_text("utf-8"))
    except Exception:
        return {}


def status_state(args):
    if str(args.job_status or "").lower() != "success":
        print("state=failure")
        print("description=Dottore Review did not complete. Inspect the trusted workflow run for details.")
        return
    if not pathlib.Path(args.review_json).exists():
        print("state=failure")
        print("description=Dottore Review did not produce review.json; inspect the trusted workflow run.")
        return
    review_obj = load_review_for_status(args.review_json)
    required_lists = ("findings", "nitpicks", "pre_merge_checks")
    if not isinstance(review_obj, dict) or any(
        not isinstance(review_obj.get(key), list) for key in required_lists
    ):
        print("state=failure")
        print("description=Dottore Review produced an invalid review.json; inspect the trusted workflow run.")
        return
    pre_merge = review_obj["pre_merge_checks"]
    if any(not isinstance(item, dict) for item in pre_merge):
        print("state=failure")
        print("description=The control record is malformed; Dottore cannot certify this examination.")
        return
    if unexamined_candidates(review_obj):
        print("state=failure")
        print("description=Some candidates went unexamined, so Dottore cannot certify this examination; rerun the review.")
        return
    if has_incomplete_review_check(pre_merge or []):
        print("state=failure")
        print("description=Dottore Review posted a failure or skipped report; rerun after repairing the review control.")
        return
    if carried := carried_title(review_obj):
        print("state=success")
        print(f"description={carried}: no new diff since the last examination, which stands for this head."[:140])
        return
    # The verdict in GitHub's 140 characters, from the counts the render step published; the raw report's severities
    # stand in when the render did not run.
    published = review_obj.get("published") if isinstance(review_obj.get("published"), dict) else None
    if published:
        defects = [SimpleNamespace(severity="medium")] * int(published.get("defects", 0))
        notes = [SimpleNamespace(severity="nitpick")] * int(published.get("notes", 0))
    else:
        items = [SimpleNamespace(severity=item.get("severity", "medium")) for item in review_obj["findings"] if isinstance(item, dict)]
        defects = [item for item in items if is_defect(item)]
        notes = [item for item in items if not is_defect(item)] + review_obj["nitpicks"]
    title = (published or {}).get("verdict") or merge_signal(review_obj, defects, notes, pre_merge)["title"]
    if defects:
        detail = f"{plural(len(defects), 'defect')} isolated, awaiting repair"
    elif notes:
        detail = f"no defects isolated; {plural(len(notes), 'note')} for the record"
    else:
        detail = "no defects isolated"
    print("state=success")
    print(f"description={title}: {detail}."[:140])


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")
    produce = sub.add_parser("produce")
    produce.add_argument("--mode", choices=["auto", "full", "incremental"])
    render = sub.add_parser("render")
    render.add_argument("--review-json", default="review.json")
    render.add_argument("--base")
    render.add_argument("--mode", choices=["auto", "full", "incremental"])
    post = sub.add_parser("post")
    post.add_argument("--review-md", default="review.md")
    post.add_argument("--inline-json", default="inline-comments.json")
    post.add_argument("--review-json", default="review.json")
    resolve = sub.add_parser("resolve")
    resolve.add_argument("--review-json", default="review.json")
    autofix = sub.add_parser("autofix-prompt")
    autofix.add_argument("--trigger", choices=["review", "asked"], default="review")
    autofix.add_argument("--out", default="/tmp/dottore-autofix")
    autofix.add_argument("--review-json", default="review.json")
    approve_cmd = sub.add_parser("approve")
    approve_cmd.add_argument("--trigger", choices=["auto", "asked"], default="auto")
    status = sub.add_parser("status-state")
    status.add_argument("--review-json", default="review.json")
    status.add_argument("--job-status", default="success")
    args = parser.parse_args()

    if args.command in (None, "produce"):
        produce_review(args)
    elif args.command == "render":
        render_review(args)
    elif args.command == "post":
        post_review(args)
    elif args.command == "status-state":
        status_state(args)
    elif args.command == "autofix-prompt":
        autofix_prompt(args)
    elif args.command == "approve":
        approve(args)
    elif args.command == "resolve":
        review_obj = load_review_for_status(args.review_json)
        resolve_repaired_threads(os.environ["PR_NUM"], review_obj.get("resolved_since_last_review") or [], review_obj.get("head_sha") or "")


if __name__ == "__main__":
    main()
