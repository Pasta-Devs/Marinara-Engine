# .github/bunny-review/bunny_review.py
import argparse
import base64
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import time
from dataclasses import dataclass

REPO_ROOT = pathlib.Path.cwd().resolve()
BUNNY_MARKER = "<!-- bunny-review:walkthrough -->"
COMMAND_STATUS_MARKER = "<!-- bunny-review:command-status -->"
FINDING_MARKER_RE = re.compile(r"<!-- bunny-review:finding=([0-9a-f]{16}) -->")
STATE_MARKER_RE = re.compile(r"<!-- bunny-review:last-reviewed-sha=([0-9a-f]{40}) -->")
CONTRACT_STATE_RE = re.compile(r"<!-- bunny-review:contract-state=([A-Za-z0-9_=-]+) -->")
MAX_REVIEW_PACKET_CHARS = 180_000
MAX_SECTION_CHARS = 60_000
MAX_CONTEXT_FILES = 5
MAX_CONTEXT_SEARCHES = 5
MAX_CONTEXT_CHARS = 80_000
MAX_CONTEXT_FILE_CHARS = 20_000
MAX_SEARCH_HITS = 30
MAX_SEARCH_FILE_BYTES = 250_000
MAX_IDENTIFIER_CONTEXT_CHARS = 60_000
MAX_IDENTIFIER_TERMS = 24
MAX_IDENTIFIER_HITS_PER_TERM = 12
MAX_FILE_PATCH_CHARS = 55_000
MAX_FILE_SUMMARY_CHARS = 9_000
MAX_REVIEW_CHUNKS = 8
MAX_CHUNK_PATCH_CHARS = 90_000
MAX_INLINE_COMMENT_CHARS = 1_200
MAX_CONTRACT_STATE_ENTRIES = 12
MAX_CONTRACT_STATE_TEXT_CHARS = 320
MAX_CONTRACT_STATE_LIST_ITEMS = 3
MODEL_REQUEST_TIMEOUT = 120
MODEL_MAX_RETRIES = 1
SECRET_VALUE_RE = re.compile(
    r"(?i)(api[_-]?key|token|secret|password|passwd|authorization|bearer|client[_-]?secret)"
    r"(\s*[:=]\s*|\s+)([^\s'\"`;&|]+)"
)
SECRET_FILE_PART_RE = re.compile(
    r"(?i)(^|[/\\])(\.env[^/\\]*|.*secret.*|.*credential.*|id_rsa|id_ed25519|\.npmrc|\.netrc)([/\\]|$)"
)


class ReviewTooLarge(Exception):
    pass


@dataclass
class Finding:
    severity: str
    path: str
    line: int | None
    title: str
    body: str
    fix_hint: str
    repair_contract: dict | None = None


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
    result = subprocess.run(
        args,
        cwd=REPO_ROOT,
        input=input_text,
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


def read_context_file(path):
    return read_text(path, MAX_CONTEXT_FILE_CHARS)


def search_repo(pattern):
    if not pattern or len(pattern) > 120:
        return "refused: search pattern must be 1-120 characters"
    if not shutil.which("rg"):
        return search_repo_with_python(pattern)
    rg = run(
        [
            "rg",
            "--fixed-strings",
            "--line-number",
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
            p = _safe_path(rel)
            if p.stat().st_size > MAX_SEARCH_FILE_BYTES:
                continue
            lines.append(f"{rel}:{line_no}: {body.strip()[:220]}")
        except Exception:
            continue
        if len(lines) >= MAX_SEARCH_HITS:
            break
    return "\n".join(lines) or "no matches"


def search_repo_with_python(pattern):
    hits = []
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
    for path in REPO_ROOT.rglob("*"):
        if len(hits) >= MAX_SEARCH_HITS:
            break
        if any(part in ignored_parts for part in path.parts):
            continue
        if not path.is_file():
            continue
        try:
            if path.stat().st_size > MAX_SEARCH_FILE_BYTES:
                continue
            rel = path.relative_to(REPO_ROOT)
            text = path.read_text("utf-8", "replace")
        except Exception:
            continue
        for line_no, line in enumerate(text.splitlines(), 1):
            if pattern in line:
                hits.append(f"{rel}:{line_no}: {line.strip()[:220]}")
                if len(hits) >= MAX_SEARCH_HITS:
                    break
    return "\n".join(hits) or "no matches"


def search_repo_hits(pattern, max_hits):
    result = search_repo(pattern)
    if result == "no matches" or result.startswith("refused:"):
        return []
    return result.splitlines()[:max_hits]


def extract_changed_identifiers(patch):
    stop_words = {
        "true",
        "false",
        "null",
        "none",
        "some",
        "string",
        "value",
        "json",
        "expect",
        "should",
        "test",
        "result",
        "state",
        "data",
        "content",
        "message",
        "messages",
        "chat",
        "chats",
        "role",
        "rows",
        "row",
        "import",
        "imported",
        "storage",
        "create",
        "get",
        "list",
        "id",
    }
    counts = {}
    for line in patch.splitlines():
        if not line.startswith(("+", "-")) or line.startswith(("+++", "---")):
            continue
        for token in re.findall(r"[A-Za-z_][A-Za-z0-9_]{3,}", line):
            if token.lower() in stop_words:
                continue
            counts[token] = counts.get(token, 0) + 1
    preferred = sorted(
        counts,
        key=lambda token: (
            not any(char.isupper() for char in token) and "_" not in token,
            -counts[token],
            token.lower(),
        ),
    )
    return preferred[:MAX_IDENTIFIER_TERMS]


def build_identifier_context(patch):
    terms = extract_changed_identifiers(patch)
    sections = []
    for term in terms:
        hits = search_repo_hits(term, MAX_IDENTIFIER_HITS_PER_TERM)
        if not hits:
            continue
        sections.append(f"### {term}\n" + "\n".join(hits))
    if not sections:
        return "No changed identifier usage context found."
    return truncate("\n\n".join(sections), MAX_IDENTIFIER_CONTEXT_CHARS)


def changed_files(base):
    names = run_git(["diff", "--name-only", f"{base}...HEAD"])
    return [line.strip() for line in names.splitlines() if line.strip()]


def load_json_file(path):
    try:
        return json.loads(read_text(path, 50_000))
    except FileNotFoundError:
        return None
    except Exception as exc:
        return {"_load_error": str(exc)}


def bunny_prompt_path():
    prompt_path = pathlib.Path(
        os.environ.get("BUNNY_REVIEW_PROMPT_PATH")
        or os.environ.get("BUNNY_REVIEW_SKILL_PATH")
        or ".github/bunny-review/reviewer-prompt.md"
    )
    if not prompt_path.is_absolute():
        prompt_path = REPO_ROOT / prompt_path
    return prompt_path


def bunny_skill_dir():
    return bunny_prompt_path().parent


def load_rules():
    rules_path = bunny_skill_dir() / "rules.json"
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
        guidance.append("docs/ARCHITECTURE_MAP.md")
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
        guidance.append("docs/FILE_STORAGE_MIGRATION.md")
    if any(marker in joined for marker in ("README", "docs/", "AGENTS.md", "CONTRIBUTING.md", "CLAUDE.md")):
        guidance.append("CONTRIBUTING.md")
    return list(dict.fromkeys(guidance))


def matching_path_rules(files):
    rules = load_rules()
    if not rules or "_load_error" in rules:
        return "No additional Bunny path rules loaded."
    matched = []
    for item in rules.get("path_instructions", []):
        prefixes = item.get("prefixes", [])
        if any(any(path.startswith(prefix) for prefix in prefixes) for path in files):
            matched.append(item)
    payload = {
        "severity_policy": rules.get("severity_policy", {}),
        "review_focus": rules.get("review_focus", []),
        "matched_path_instructions": matched,
    }
    return json.dumps(payload, indent=2, sort_keys=True)


def diff_for_path(base, path):
    return redact_for_model(
        run_git_raw(["diff", "--find-renames", "--unified=80", f"{base}...HEAD", "--", path])
    )


def build_file_context(base, files):
    sections = []
    for path in files:
        patch = diff_for_path(base, path)
        if not patch:
            continue
        if len(patch) <= MAX_FILE_PATCH_CHARS:
            sections.append(f"### {path}\n```diff\n{patch}\n```")
            continue
        sections.append(
            "### "
            + path
            + "\n```text\n"
            + truncate(run_git(["diff", "--stat", f"{base}...HEAD", "--", path], 2_000), 2_000)
            + truncate(patch, MAX_FILE_SUMMARY_CHARS)
            + "\n```"
        )
    return "\n\n".join(sections) or "No per-file patch context found."


def build_review_packet(base, ci_status, mode, focus_files=None, include_full_patch=True):
    files = changed_files(base)
    context_files = focus_files or files
    if focus_files is None or include_full_patch:
        patch = redact_for_model(
            run_git_raw(["diff", "--find-renames", "--unified=80", f"{base}...HEAD"])
        )
    else:
        patch = "\n".join(diff_for_path(base, path) for path in focus_files)
    patch_body = patch
    if len(patch_body) > MAX_SECTION_CHARS:
        patch_body = (
            "Full patch exceeded the inline packet limit; use the per-file patch sections "
            "below and request focused extra context for specific files if needed.\n\n"
            + truncate(patch_body, MAX_SECTION_CHARS)
        )
    sections = [
        ("review mode", mode),
        ("git status", run_git(["status", "--short", "--branch"], 12_000)),
        ("repo root", run_git(["rev-parse", "--show-toplevel"], 4_000)),
        ("merge base", run_git(["merge-base", "HEAD", base], 4_000)),
        ("diff stat", run_git(["diff", "--stat", f"{base}...HEAD"], 20_000)),
        ("changed files", "\n".join(files) or "No changed files reported."),
        ("numstat", run_git(["diff", "--numstat", f"{base}...HEAD"], 20_000)),
        ("focus files", "\n".join(context_files) or "All changed files."),
        ("patch overview", patch_body),
        ("per-file patch context", build_file_context(base, context_files)),
        ("changed identifier usage", build_identifier_context(patch)),
        ("Bunny path rules", matching_path_rules(files)),
    ]
    if ci_status:
        sections.append(("CI status", ci_status))
    for path in select_guidance(files):
        try:
            sections.append((f"guidance: {path}", read_text(path, 30_000)))
        except Exception as exc:
            sections.append((f"guidance: {path}", f"Could not read: {exc}"))

    packet = "\n\n".join(
        f"## {title}\n```text\n{redact_for_model(body)}\n```" for title, body in sections
    )
    if len(packet) > MAX_REVIEW_PACKET_CHARS:
        packet = truncate(packet, MAX_REVIEW_PACKET_CHARS)
    return packet


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
    totals["reasoning_tokens"] += usage_value(
        usage, "completion_tokens_details", "reasoning_tokens"
    )


def build_stats(review_packet):
    return {
        "started_at": time.monotonic(),
        "model_calls": 0,
        "review_packet_chars": len(review_packet),
        "extra_context_chars": 0,
        "context_files": 0,
        "context_searches": 0,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "reasoning_tokens": 0,
        "total_tokens": 0,
    }


def print_telemetry(stats):
    elapsed = time.monotonic() - stats["started_at"]
    print(
        "Bunny telemetry: "
        f"elapsed_s={elapsed:.1f}; "
        f"model_calls={stats['model_calls']}; "
        f"review_packet_chars={stats['review_packet_chars']}; "
        f"extra_context_chars={stats['extra_context_chars']}; "
        f"context_files={stats['context_files']}; "
        f"context_searches={stats['context_searches']}; "
        f"prompt_tokens={stats['prompt_tokens']}; "
        f"completion_tokens={stats['completion_tokens']}; "
        f"reasoning_tokens={stats['reasoning_tokens']}; "
        f"total_tokens={stats['total_tokens']}",
        flush=True,
    )


def model_call(client, messages, stats):
    resp = client.chat.completions.create(
        model=os.environ.get("LLM_MODEL", "gpt-5.5"),
        messages=messages,
        timeout=MODEL_REQUEST_TIMEOUT,
    )
    stats["model_calls"] += 1
    add_usage(stats, getattr(resp, "usage", None))
    if isinstance(resp, str):
        return resp
    return resp.choices[0].message.content or ""


def extract_json_or_repair(client, messages, content, stats):
    try:
        return extract_json(content)
    except ValueError:
        repair_messages = [
            *messages,
            {"role": "assistant", "content": content},
            {
                "role": "user",
                "content": (
                    "The previous response did not contain a JSON object. Reply only "
                    "with FINAL_REVIEW followed by one JSON object matching the required "
                    "Bunny Review schema. Do not include prose, Markdown, or another "
                    "context request."
                ),
            },
        ]
        return extract_json(model_call(client, repair_messages, stats))


def review_packet_with_model(client, skill, triage_content, stats):
    messages = [
        {"role": "system", "content": skill},
        {"role": "user", "content": triage_content},
    ]
    first_response = model_call(client, messages, stats)
    request = parse_context_request(first_response)
    if request is None:
        return extract_json_or_repair(client, messages, first_response, stats)
    extra_context = build_extra_context(request, stats)
    final_messages = [
        {"role": "system", "content": skill},
        {"role": "user", "content": triage_content},
        {"role": "assistant", "content": first_response},
        {
            "role": "user",
            "content": (
                "Here is the bounded extra context you requested. "
                "Do not request more context. Produce only the final JSON review object."
                f"\n\n# Extra Context\n{extra_context}"
            ),
        },
    ]
    final_response = model_call(client, final_messages, stats)
    return extract_json_or_repair(client, final_messages, final_response, stats)


def skeptical_review_pass(client, skill, triage_content, stats):
    audit_prompt = (
        "Run an independent skeptical specialist review over the same packet. Do not treat "
        "any broad-review conclusion as authoritative. Focus on invariant mismatches "
        "introduced by the diff: data collected in a pre-scan but persisted after later "
        "filters, parent metadata derived from rows that are not imported as children, "
        "fallback behavior that diverges from validation, rollback paths, partial writes, "
        "contract drift, and tests that prove only the happy path. Report only concrete "
        "actionable findings that cite added or changed diff lines. If there are no "
        "findings from this specialist lens, return the same JSON schema with empty "
        "findings and nitpicks arrays and mention the skeptical audit in what_i_checked."
    )
    messages = [
        {"role": "system", "content": skill},
        {"role": "user", "content": triage_content},
        {"role": "user", "content": audit_prompt},
    ]
    response = model_call(client, messages, stats)
    return extract_json_or_repair(client, messages, response, stats)


def judge_review_pass(client, skill, triage_content, broad_review, skeptical_review, stats):
    judge_prompt = (
        "Merge these two independent review passes into the final Bunny Review JSON. "
        "Deduplicate overlapping findings, keep the clearest title/body/fix_hint, normalize "
        "severity, and reject weak or speculative findings. Preserve concrete findings even "
        "if only one pass found them, and include a repair_contract for every defect finding. "
        "Enumerate every distinct actionable finding visible in these passes that you would "
        "flag in a production code review. Do not defer known findings to later review rounds, "
        "and do not manufacture marginal findings to appear comprehensive. "
        "Preserve up to 2 concrete nitpicks in the separate nitpicks array when they are "
        "actionable changed-line polish; non-blocking does not mean weak. Every final "
        "finding and nitpick must be actionable and cite an added or changed diff line. Combine useful "
        "change_summary, nitpicks, pre_merge_checks, "
        "open_questions, and what_i_checked entries without repeating yourself. Reply only "
        "with FINAL_REVIEW followed by the final JSON object."
        f"\n\n# Broad Review JSON\n{json.dumps(broad_review, indent=2, sort_keys=True)}"
        f"\n\n# Skeptical Review JSON\n{json.dumps(skeptical_review, indent=2, sort_keys=True)}"
    )
    messages = [
        {"role": "system", "content": skill},
        {"role": "user", "content": triage_content},
        {"role": "user", "content": judge_prompt},
    ]
    response = model_call(client, messages, stats)
    return extract_json_or_repair(client, messages, response, stats)


def three_pass_review(client, skill, triage_content, stats):
    broad_review = review_packet_with_model(client, skill, triage_content, stats)
    skeptical_review = skeptical_review_pass(client, skill, triage_content, stats)
    return judge_review_pass(
        client,
        skill,
        triage_content,
        broad_review,
        skeptical_review,
        stats,
    )


def parse_context_request(content):
    marker = "CONTEXT_REQUEST"
    if marker not in content:
        return None
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end < start:
        return {"files": [], "searches": []}
    try:
        parsed = json.loads(content[start : end + 1])
    except Exception:
        return {"files": [], "searches": []}
    files = parsed.get("files", [])
    searches = parsed.get("searches", [])
    return {
        "files": [value for value in files if isinstance(value, str)][:MAX_CONTEXT_FILES],
        "searches": [
            value for value in searches if isinstance(value, str)
        ][:MAX_CONTEXT_SEARCHES],
    }


def extract_json(content):
    cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL | re.IGNORECASE)
    cleaned = cleaned.replace("FINAL_REVIEW", "", 1).strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("model response did not contain a JSON object")
    return json.loads(cleaned[start : end + 1])


def build_extra_context(request, stats):
    sections = []
    for path in request.get("files", []):
        stats["context_files"] += 1
        try:
            body = read_context_file(path)
        except Exception as exc:
            body = f"Could not read: {exc}"
        sections.append((f"context file: {path}", body))
    for pattern in request.get("searches", []):
        stats["context_searches"] += 1
        try:
            body = search_repo(pattern)
        except Exception as exc:
            body = f"Could not search: {exc}"
        sections.append((f"context search: {pattern}", body))
    context = "\n\n".join(
        f"## {title}\n```text\n{body}\n```" for title, body in sections
    )
    context = truncate(context, MAX_CONTEXT_CHARS)
    stats["extra_context_chars"] = len(context)
    return context


def touched_lines(base):
    by_path: dict[str, set[int]] = {}
    current_path = None
    new_line = None
    diff = run_git_raw(["diff", "--unified=0", f"{base}...HEAD"])
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            current_path = line.removeprefix("+++ b/")
            by_path.setdefault(current_path, set())
            continue
        match = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", line)
        if match:
            new_line = int(match.group(1))
            continue
        if current_path is None or new_line is None:
            continue
        if line.startswith("+") and not line.startswith("+++"):
            by_path[current_path].add(new_line)
            new_line += 1
        elif line.startswith("-") and not line.startswith("---"):
            continue
        else:
            new_line += 1
    return by_path


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


def normalize_review_item(item, *, default_severity):
    return Finding(
        severity=str(item.get("severity", default_severity)).lower(),
        path=str(item.get("path", "")).strip(),
        line=item.get("line"),
        title=str(item.get("title", "")).strip(),
        body=str(item.get("body", "")).strip(),
        fix_hint=str(item.get("fix_hint", "")).strip(),
        repair_contract=normalize_repair_contract(item.get("repair_contract")),
    )


def validate_review_items(review_obj, base):
    allowed = touched_lines(base)
    findings = []
    nitpicks = []
    invalid = []
    severities = {"blocking", "high", "medium", "low"}
    for item in review_obj.get("findings", []):
        try:
            finding = normalize_review_item(item, default_severity="medium")
        except Exception as exc:
            invalid.append(f"Malformed finding skipped: {exc}")
            continue
        target = nitpicks if finding.severity == "nitpick" else findings
        if finding.severity not in severities:
            finding.severity = "nitpick" if target is nitpicks else "medium"
        if not finding.path or finding.path not in allowed:
            invalid.append(
                f"{finding.severity} '{finding.title or '<untitled>'}' at "
                f"{finding.path or '<missing path>'}: not in changed files"
            )
            continue
        if not isinstance(finding.line, int):
            invalid.append(
                f"{finding.severity} '{finding.title or '<untitled>'}' at "
                f"{finding.path}: missing integer line"
            )
            continue
        if finding.line not in allowed.get(finding.path, set()):
            invalid.append(
                f"{finding.severity} '{finding.title or '<untitled>'}' at "
                f"{finding.path}:{finding.line}: line is not an added/changed diff line"
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
        if not isinstance(nitpick.line, int):
            invalid.append(
                f"nitpick '{nitpick.title or '<untitled>'}' at "
                f"{nitpick.path}: missing integer line"
            )
            continue
        if nitpick.line not in allowed.get(nitpick.path, set()):
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
    return findings, nitpicks[:2], invalid


def render_finding_body(finding):
    meta = severity_meta(finding.severity)
    parts = [
        finding_marker(finding),
        f"### {meta['icon']} {meta['label']}: {finding.title}",
        "",
        f"**Location:** `{finding.path}:{finding.line}`",
        "",
        blockquote(finding.body),
    ]
    if finding.fix_hint:
        parts.extend([""] + alert_block("TIP", [f"**Suggested fix:** {finding.fix_hint}"]))
    return inline_truncate("\n".join(parts).strip())


def finding_id(finding):
    raw = f"{finding.path}:{finding.line}:{finding.title}".encode("utf-8", "replace")
    return hashlib.sha256(raw).hexdigest()[:16]


def finding_marker(finding):
    return f"<!-- bunny-review:finding={finding_id(finding)} -->"


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
        "CI Timing",
        "Non-blocking Coverage",
    }
    if explicit in allowed:
        return explicit
    combined = " ".join(
        str(item.get(key, "")) for key in ("name", "status", "detail")
    ).lower()
    if "ci" in combined or "check" in combined or "pending" in combined:
        return "CI Timing"
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


def finding_summary(findings):
    if not findings:
        return "No actionable defects isolated."
    counts = {}
    for finding in findings:
        severity = str(finding.severity or "unknown").lower()
        counts[severity] = counts.get(severity, 0) + 1
    pieces = []
    for severity in ("blocking", "high", "medium", "low", "nitpick", "unknown"):
        count = counts.get(severity, 0)
        if not count:
            continue
        meta = severity_meta(severity)
        pieces.append(f"{meta['icon']} {count} {severity}")
    return f"{len(findings)} finding(s): " + ", ".join(pieces)


def has_failed_review_check(pre_merge):
    return any(
        str(item.get("name", "")).strip().lower() == "review failed"
        and status_meta(item.get("status"))["label"] == "FAIL"
        for item in pre_merge
    )


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
            "detail": "Bunny already reviewed this head; this run did not inspect new changes.",
        }
    review_incomplete = has_incomplete_review_check(pre_merge)
    if review_incomplete:
        return {
            "label": "REVIEW INCOMPLETE",
            "title": "Review Incomplete",
            "admonition": "CAUTION",
            "detail": "Bunny Review did not complete, so no model findings are available.",
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
            "label": "DO NOT MERGE",
            "title": "Do Not Merge",
            "admonition": "CAUTION",
            "detail": "Repair blocking/high findings or failed controls before merge.",
        }
    if findings or any(warn_is_blocking_proof_gap(item) for item in pre_merge):
        return {
            "label": "ACTION NEEDED",
            "title": "Action Needed",
            "admonition": "WARNING",
            "detail": "Actionable findings or blocking proof gaps remain for this head.",
        }
    has_notes = nitpicks or any(
        status_meta(item.get("status"))["label"] in {"WARN", "WARNING", "PENDING", "UNKNOWN"}
        for item in pre_merge
    )
    if has_notes:
        return {
            "label": "READY WITH NOTES",
            "title": "Ready With Notes",
            "admonition": "WARNING",
            "detail": "No actionable defects were isolated, but non-blocking notes remain.",
        }
    return {
        "label": "READY",
        "title": "Ready",
        "admonition": "TIP",
        "detail": "No actionable findings were isolated for this head. Expected CI controls were observed passing.",
    }


def render_merge_signal(review_obj, findings, nitpicks, pre_merge, head_sha):
    signal = merge_signal(review_obj, findings, nitpicks, pre_merge)
    controls = control_summary(pre_merge)
    mode = review_obj.get("mode") or "unknown"
    body = [
        f"## Bunny Merge Signal: {signal['title']}",
        "",
        f"> [!{signal['admonition']}]",
        f"> **{signal['label']}**",
        f"> {signal['detail']}",
        "",
        "| Findings | Nitpicks | Controls | Reviewed Head | Mode |",
        "| ---: | ---: | --- | --- | --- |",
        f"| {len(findings)} | {len(nitpicks)} | {md_cell(controls)} | `{short_ref(head_sha)}` | `{md_cell(mode)}` |",
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


def review_callout(findings, pre_merge):
    has_blocking = any(
        severity_meta(finding.severity)["rank"] <= severity_meta("high")["rank"]
        for finding in findings
    )
    review_failed = has_failed_review_check(pre_merge)
    has_failed_check = any(
        status_meta(item.get("status"))["label"] == "FAIL" for item in pre_merge
    )
    has_warn_check = any(
        status_meta(item.get("status"))["label"] in {"WARN", "WARNING", "PENDING", "UNKNOWN"}
        for item in pre_merge
    )
    summary = finding_summary(findings)
    if review_failed and not findings:
        return "\n".join(
            [
                "> [!CAUTION]",
                "> **Specimen unexamined.** Bunny Review did not complete, so no model findings are available.",
                "> Repair the failed review control or rerun Bunny before treating this PR as reviewed.",
            ]
        )
    if has_blocking or has_failed_check:
        return "\n".join(
            [
                "> [!CAUTION]",
                f"> **Specimen unstable.** {summary}",
                "> Repair blocking/high findings and failed controls before merge.",
            ]
        )
    if findings or has_warn_check:
        return "\n".join(
            [
                "> [!WARNING]",
                f"> **Anomalies remain.** {summary}",
                "> Examine the findings and warning rows before merge.",
            ]
        )
    return "\n".join(
        [
            "> [!TIP]",
            "> **No actionable defects isolated.** The examined mechanism yielded no merge-blocking specimen.",
        ]
    )


def render_review_metadata(review_obj, head_sha):
    mode = review_obj.get("mode") or "unknown"
    base = review_obj.get("review_base") or review_obj.get("base_ref") or "unknown"
    commit_message = review_obj.get("head_commit_message") or review_obj.get(
        "commit_message"
    )
    return "\n".join(
        [
            "> [!NOTE]",
            f"> Mode: `{mode}`  ",
            f"> {commit_line(head_sha, commit_message, label='Head')}  ",
            f"> {commit_line(base, label='Base')}",
        ]
    )


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


def agent_prompt_for_finding(finding):
    contract = finding.repair_contract or {}
    lines = [
        f"Task: Fix `{finding.path}:{finding.line}`.",
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
        "title": compact_state_text(finding.title, 180),
        "fix_hint": compact_state_text(finding.fix_hint, 260),
        "repair_contract": contract,
    }


def contract_identity(entry):
    return (
        str(entry.get("id") or "").strip(),
        str(entry.get("path") or "").strip(),
        compact_state_text(entry.get("title"), 180).lower(),
    )


def contract_matches_finding(entry, finding):
    entry_id, entry_path, entry_title = contract_identity(entry)
    if entry_id and entry_id == finding_id(finding):
        return True
    if entry_path and entry_path == finding.path:
        finding_title = compact_state_text(finding.title, 180).lower()
        if entry_title and entry_title == finding_title:
            return True
    return False


def resolved_contracts_since_last_review(prior_entries, current_findings, changed):
    resolved = []
    for entry in normalize_contract_state_entries(prior_entries):
        path = entry.get("path") or ""
        if not path or path not in changed:
            continue
        if any(contract_matches_finding(entry, finding) for finding in current_findings):
            continue
        resolved.append(
            {
                "id": entry.get("id"),
                "severity": entry.get("severity"),
                "path": path,
                "line": entry.get("line"),
                "title": entry.get("title") or "Prior Bunny finding",
                "status": "likely_resolved",
            }
        )
        if len(resolved) >= MAX_CONTRACT_STATE_ENTRIES:
            break
    return resolved


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
    return f"<!-- bunny-review:contract-state={encoded} -->"


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
        return "No prior Bunny repair contracts found."
    lines = [
        "Prior Bunny repair contracts from earlier review rounds. Judge whether the current diff satisfies each invariant before reporting adjacent defects.",
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


def is_ci_check(item):
    name = str(item.get("name", "")).strip().lower()
    return name in {"ci", "ci status", "checks", "github checks"}


def is_stale_ci_text(text):
    lowered = text.lower()
    if "ci" not in lowered and "pnpm" not in lowered and "build" not in lowered:
        return False
    stale_markers = (
        "still running",
        "not available",
        "unavailable",
        "unknown",
        "pending",
        "not include",
        "not provided",
    )
    return any(marker in lowered for marker in stale_markers)


def is_stale_ci_check(item):
    if is_ci_check(item):
        return True
    combined = " ".join(
        str(item.get(key, "")) for key in ("name", "status", "detail")
    )
    return is_stale_ci_text(combined)


def normalize_ci_status(ci_status):
    if not ci_status:
        return ""
    unique_lines = []
    seen = set()
    for raw_line in ci_status.splitlines():
        line = raw_line.strip()
        if not line or line.lower() == "### ci status":
            continue
        if line.startswith("- "):
            key = line.lower()
            if key in seen:
                continue
            seen.add(key)
        unique_lines.append(line)
    return "\n".join(unique_lines).strip()


def ci_status_to_pre_merge_checks(ci_status):
    normalized = normalize_ci_status(ci_status)
    if not normalized:
        return []
    lowered = normalized.lower()
    if "failure:" in lowered or ": failure" in lowered or ": cancelled" in lowered:
        return [
            {
                "name": "CI Status",
                "status": "fail",
                "type": "CI Timing",
                "detail": "One or more expected CI controls failed or were cancelled; the specimen is not fit for merge.",
            }
        ]
    if "warning:" in lowered or "still running" in lowered:
        return [
            {
                "name": "CI Status",
                "status": "warn",
                "type": "CI Timing",
                "detail": "Expected CI controls were missing or incomplete when Bunny posted; verify the control path before merge.",
            }
        ]
    return [
        {
            "name": "CI Status",
            "status": "pass",
            "type": "CI Timing",
            "detail": "Expected CI controls completed without a reported failure.",
        }
    ]


def render_walkthrough(
    review_obj,
    findings,
    nitpicks,
    invalid_findings,
    ci_status,
    head_sha,
    prior_contracts=None,
):
    summary = review_obj.get("change_summary") or []
    questions = review_obj.get("open_questions") or []
    checked = review_obj.get("what_i_checked") or []
    normalized_ci_status = normalize_ci_status(ci_status)
    pre_merge = review_obj.get("pre_merge_checks") or []
    if normalized_ci_status:
        pre_merge = [item for item in pre_merge if not is_stale_ci_check(item)]
        checked = [item for item in checked if not is_stale_ci_text(str(item))]
        pre_merge = ci_status_to_pre_merge_checks(normalized_ci_status) + pre_merge
    resolved = review_obj.get("resolved_since_last_review") or []
    state_marker = (
        f"<!-- bunny-review:last-reviewed-sha={head_sha} -->"
        if head_sha and not has_incomplete_review_check(pre_merge)
        else "<!-- bunny-review:last-reviewed-sha=unrecorded -->"
    )
    contract_state_marker = encode_contract_state(
        merge_contract_state(
            findings, open_prior_contract_state(findings, prior_contracts or [])
        )
    )
    body = [
        BUNNY_MARKER,
        state_marker,
    ]
    if contract_state_marker:
        body.append(contract_state_marker)
    body.extend([
        "## 🐰 Bunny Review",
        "",
        render_merge_signal(review_obj, findings, nitpicks, pre_merge, head_sha),
        "",
        render_review_metadata(review_obj, head_sha),
        "",
        "### 🧭 Specimen Summary",
    ])
    body.extend([f"- {line}" for line in summary[:2]] or ["- No specimen summary produced."])
    body.extend(["", "### 🔎 Isolated Defects"])
    if findings:
        body.extend(
            [
                "| Severity | Location | Finding |",
                "| :---: | --- | --- |",
            ]
        )
        for finding in findings:
            meta = severity_meta(finding.severity)
            body.append(
                "| "
                f"{status_badge(meta)} | "
                f"`{md_cell(finding.path)}:{finding.line}` | "
                f"{md_cell(finding.title)} |"
            )
    else:
        if has_failed_review_check(pre_merge):
            body.extend(
                [
                    "",
                    "> [!CAUTION]",
                    "> No model findings are available because Bunny Review failed before completing inspection.",
                ]
            )
        else:
            body.extend(["", "> [!TIP]", "> No actionable defects isolated."])
    if resolved:
        body.extend(["", "### ✅ Resolved Since Last Review"])
        for item in resolved[:5]:
            location = f"{item.get('path') or 'unknown'}:{item.get('line') or '?'}"
            title = item.get("title") or "Prior Bunny finding"
            body.append(f"- `{md_cell(location)}` - {md_cell(title)}")
    body.extend(["", "### 🧹 Nitpicks"])
    if nitpicks:
        body.extend(
            [
                "| Location | Nitpick |",
                "| --- | --- |",
            ]
        )
        for nitpick in nitpicks:
            body.append(
                "| "
                f"`{md_cell(nitpick.path)}:{nitpick.line}` | "
                f"{md_cell(nitpick.title)} |"
            )
    else:
        body.append("- None recorded.")
    agent_prompt = render_agent_prompt_details(
        findings, "🤖 Copy prompt for isolated Bunny findings"
    )
    if agent_prompt:
        body.extend(["", agent_prompt])
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
        body.extend(["", "### ❓ Open Questions"])
        body.extend([f"- {line}" for line in questions[:2]])
    body.extend(["", "### 🧪 Observations"])
    body.extend([f"- {line}" for line in checked[:3]] or ["- Review packet and diff context inspected."])
    if invalid_findings:
        body.extend(
            [
                "",
                "### 📝 Reviewer Notes",
                "> [!WARNING]",
                f"> Withheld {len(invalid_findings)} model finding(s) because their diff locations failed validation.",
            ]
        )
        body.extend([f"- {note}" for note in invalid_findings[:5]])
    if normalized_ci_status:
        body.extend(["", "### 🧰 CI Status", normalized_ci_status])
    return "\n".join(body).strip() + "\n"


def merge_review_objects(reviews):
    merged = {
        "change_summary": [],
        "findings": [],
        "nitpicks": [],
        "pre_merge_checks": [],
        "open_questions": [],
        "what_i_checked": [],
    }
    seen_findings = set()
    for review in reviews:
        for key in ("change_summary", "open_questions", "what_i_checked"):
            for item in review.get(key, []):
                if item not in merged[key]:
                    merged[key].append(item)
        for check in review.get("pre_merge_checks", []):
            key = (check.get("name"), check.get("status"), check.get("type"), check.get("detail"))
            if key not in {
                (item.get("name"), item.get("status"), item.get("type"), item.get("detail"))
                for item in merged["pre_merge_checks"]
            }:
                merged["pre_merge_checks"].append(check)
        for key_name in ("findings", "nitpicks"):
            for finding in review.get(key_name, []):
                key = (
                    finding.get("path"),
                    finding.get("line"),
                    finding.get("title"),
                )
                if key in seen_findings:
                    continue
                seen_findings.add(key)
                merged[key_name].append(finding)
    merged["nitpicks"] = merged["nitpicks"][:2]
    return merged


def prior_review_contracts_context(pr_num, limit=12_000):
    if not pr_num:
        return "No prior Bunny review context available."
    state_entries = prior_review_contract_state(pr_num)
    if state_entries:
        return format_contract_entries_for_prompt(state_entries, limit)
    comment = latest_walkthrough_comment(pr_num)
    if not comment:
        return "No prior Bunny walkthrough comment or inline contract comments found."
    body = comment.get("body", "")
    if not body:
        return "Prior Bunny walkthrough comment was empty."
    useful_lines = []
    keep = False
    for line in body.splitlines():
        if line.startswith("### 🔎") or line.startswith("### 🧹") or "Repair contract" in line:
            keep = True
        elif line.startswith("### ") and keep:
            keep = False
        if keep or "bunny-review:finding=" in line or "Invariant" in line or "Expected proof" in line:
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


def model_failure_detail(exc):
    message = " ".join(str(exc).split())
    if len(message) > 500:
        message = message[:497] + "..."
    return (
        f"Bunny Review could not complete because the model provider rejected the "
        f"review request: {type(exc).__name__}: {message}"
    )


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
                f"pull/{pr_num}/head:refs/remotes/bunny-review/pr-{pr_num}",
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
        comment for comment in issue_comments(pr_num) if BUNNY_MARKER in comment.get("body", "")
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
        if "bunny-review:finding=" not in comment.get("body", ""):
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
        entries = decode_contract_state_from_body(comment.get("body", ""))
        if entries:
            return entries
    return prior_inline_contract_state(pr_num)


def is_completed_review_body(body):
    if not STATE_MARKER_RE.search(body):
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
        matches = STATE_MARKER_RE.findall(body)
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
    head_sha = data["headRefOid"]
    explicit_base = os.environ.get("BUNNY_BASE_SHA")
    mode = requested_mode
    if explicit_base:
        return explicit_base, base_ref, head_sha, "custom"
    if mode == "full":
        return f"origin/{base_ref}", base_ref, head_sha, mode
    explicit_previous = os.environ.get("BUNNY_LAST_REVIEWED_SHA", "").strip()
    if valid_review_base_sha(explicit_previous, head_sha):
        return explicit_previous, base_ref, head_sha, "incremental"
    previous = discover_last_reviewed_sha(pr_num)
    if valid_review_base_sha(previous, head_sha):
        return previous, base_ref, head_sha, "incremental"
    return f"origin/{base_ref}", base_ref, head_sha, "full"


def parse_command_mode():
    body = os.environ.get("BUNNY_COMMENT_BODY", "")
    if "/bunny-review" not in body:
        return os.environ.get("BUNNY_REVIEW_MODE", "auto")
    if re.search(r"/bunny-review\s+full\b", body):
        return "full"
    if re.search(r"/bunny-review\s+review\b", body):
        return "auto"
    return "auto"


def produce_review(args):
    pr_num = os.environ.get("PR_NUM", "")
    if not pr_num and not os.environ.get("OPENAI_API_KEY"):
        write_skipped_review(
            "Review Skipped",
            "The reviewer could not run because `OPENAI_API_KEY` is absent from this workflow run. Repository-secret withholding leaves the specimen unexamined.",
        )
        print("Bunny telemetry: skipped=missing_openai_api_key", flush=True)
        return

    requested_mode = args.mode or parse_command_mode()
    base, base_ref, head_sha, effective_mode = resolve_review_base(pr_num, requested_mode)
    ensure_local_head(head_sha, pr_num)
    patch_command_status_running(pr_num, head_sha, effective_mode)
    ci_status = os.environ.get("CI_STATUS", "")
    files = changed_files(base)
    if not files and effective_mode == "incremental":
        write_skipped_review(
            "No New Diff Reviewed",
            "Bunny already reviewed this head; this run did not inspect new changes.",
            status="pass",
            metadata={
                "head_sha": head_sha,
                "head_commit_message": commit_subject(head_sha),
                "review_base": base,
                "base_ref": base_ref,
                "mode": effective_mode,
                "review_state": "no_new_diff_reviewed",
            },
        )
        print("Bunny telemetry: skipped=no_new_diff_reviewed", flush=True)
        return

    if not os.environ.get("OPENAI_API_KEY"):
        write_skipped_review(
            "Review Skipped",
            "The reviewer could not run because `OPENAI_API_KEY` is absent from this workflow run. Repository-secret withholding leaves the specimen unexamined.",
            metadata={
                "head_sha": head_sha,
                "head_commit_message": commit_subject(head_sha),
                "review_base": base,
                "base_ref": base_ref,
                "mode": effective_mode,
            },
        )
        print("Bunny telemetry: skipped=missing_openai_api_key", flush=True)
        return

    chunks = chunk_changed_files(base, files)
    use_chunked_review = len(chunks) > 1

    from openai import OpenAI

    client = OpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        base_url=os.environ.get("LLM_BASE_URL"),
        max_retries=MODEL_MAX_RETRIES,
    )
    skill = bunny_prompt_path().read_text("utf-8")
    prior_contract_state = prior_review_contract_state(pr_num)
    prior_contract_context = (
        format_contract_entries_for_prompt(prior_contract_state)
        if prior_contract_state
        else prior_review_contracts_context(pr_num)
    )

    def triage_for_packet(review_packet, focus_note):
        triage = (
            f"Review this PR. The review base is '{base}' from target branch '{base_ref}', "
            f"head is '{head_sha}', and mode is '{effective_mode}'. {focus_note} "
            "Use the provided review packet as the complete inspection context. "
            "If prior Bunny contracts are included, first judge whether the current diff satisfies "
            "or leaves those contracts incomplete before issuing adjacent related findings. "
            "You have one chance to request focused extra context before the final review. "
            "If the packet is enough, reply with FINAL_REVIEW followed by a JSON object in the skill's schema. "
            "If more context is necessary to validate a concrete potential finding, reply only with "
            'CONTEXT_REQUEST and JSON like {"files":["path"],"searches":["literal text"]}. '
            f"Request at most {MAX_CONTEXT_FILES} files and {MAX_CONTEXT_SEARCHES} literal searches."
        )
        triage += (
            "\n\nFocus on correctness, contracts, failure paths, tests, CI/deployment risks, "
            "and architecture. Findings must point to changed diff lines. "
            "If the packet is truncated or missing context for a potential issue, mention that "
            "limitation in what_i_checked rather than inventing certainty."
            f"\n\n# Prior Bunny Repair Contracts\n{prior_contract_context}"
            f"\n\n# Review Packet\n{review_packet}"
        )
        return triage

    if use_chunked_review:
        stats = build_stats("")
        chunk_reviews = []
        for index, chunk in enumerate(chunks, 1):
            review_packet = build_review_packet(
                base,
                ci_status,
                effective_mode,
                focus_files=chunk,
                include_full_patch=False,
            )
            stats["review_packet_chars"] += len(review_packet)
            focus_note = (
                f"This is chunk {index} of {len(chunks)}. Review only these focus files: "
                + ", ".join(chunk)
                + "."
            )
            triage_content = triage_for_packet(review_packet, focus_note)
            try:
                chunk_reviews.append(
                    three_pass_review(client, skill, triage_content, stats)
                )
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
        review_obj = merge_review_objects(chunk_reviews)
        review_obj.setdefault("what_i_checked", []).append(
            f"Examined the PR in {len(chunks)} file chunk(s) so the large diff did not contaminate context retention."
        )
    else:
        review_packet = build_review_packet(base, ci_status, effective_mode)
        stats = build_stats(review_packet)
        triage_content = triage_for_packet(review_packet, "Review the full current diff.")
        try:
            review_obj = three_pass_review(client, skill, triage_content, stats)
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
    review_obj.setdefault("head_sha", head_sha)
    review_obj.setdefault("head_commit_message", commit_subject(head_sha))
    review_obj.setdefault("review_base", base)
    review_obj.setdefault("base_ref", base_ref)
    review_obj.setdefault("mode", effective_mode)
    review_obj.setdefault("_prior_bunny_contract_state", prior_contract_state)
    review_obj.setdefault("what_i_checked", []).append(
        f"Selected review base `{base}` for target branch `{base_ref}` in `{effective_mode}` mode."
    )
    try:
        valid_findings, _, _ = validate_review_items(review_obj, base)
        review_obj["resolved_since_last_review"] = resolved_contracts_since_last_review(
            prior_contract_state,
            valid_findings,
            set(files),
        )
    except Exception:
        review_obj.setdefault("resolved_since_last_review", [])
    pathlib.Path("review.json").write_text(
        json.dumps(review_obj, indent=2, sort_keys=True) + "\n", "utf-8"
    )
    print_telemetry(stats)


def read_ci_status():
    path = pathlib.Path("bunny-ci-status.md")
    if path.exists():
        return path.read_text("utf-8")
    return ""


def findings_for_inline_comments(findings):
    mode = os.environ.get("BUNNY_INLINE_FINDINGS", "urgent").strip().lower()
    if mode in {"none", "off", "false", "0"}:
        return []
    if mode in {"all", "true", "1"}:
        return findings
    return [
        finding
        for finding in findings
        if severity_meta(finding.severity)["rank"] <= severity_meta("medium")["rank"]
    ]


def render_review(args):
    review_obj = json.loads(pathlib.Path(args.review_json).read_text("utf-8"))
    base = (
        args.base
        or os.environ.get("BUNNY_VALIDATION_BASE")
        or os.environ.get("BUNNY_BASE_SHA")
        or review_obj.get("review_base")
    )
    if not base:
        pr_num = os.environ.get("PR_NUM", "")
        requested_mode = args.mode or parse_command_mode()
        base, _, _, _ = resolve_review_base(pr_num, requested_mode)
    findings, nitpicks, invalid = validate_review_items(review_obj, base)
    ci_status = read_ci_status()
    head_sha = review_obj.get("head_sha") or os.environ.get("BUNNY_HEAD_SHA", "")
    walkthrough = render_walkthrough(
        review_obj,
        findings,
        nitpicks,
        invalid,
        ci_status,
        head_sha,
        prior_contracts=review_obj.get("_prior_bunny_contract_state") or [],
    )
    pathlib.Path("review.md").write_text(walkthrough, "utf-8")
    inline_findings = findings_for_inline_comments(findings)
    inline = [
        {
            "path": f.path,
            "line": f.line,
            "side": "RIGHT",
            "body": render_finding_body(f),
        }
        for f in inline_findings
    ]
    pathlib.Path("inline-comments.json").write_text(
        json.dumps(inline, indent=2, sort_keys=True) + "\n", "utf-8"
    )


def find_walkthrough_comment(pr_num):
    comment = latest_walkthrough_comment(pr_num)
    if comment:
        return comment.get("id")
    return None


def find_command_status_comment(pr_num):
    for comment in issue_comments(pr_num):
        if COMMAND_STATUS_MARKER in comment.get("body", ""):
            return comment.get("id")
    return None


def patch_command_status_running(pr_num, head_sha, mode):
    body = "\n".join(
        [
            COMMAND_STATUS_MARKER,
            "## 🐰 Bunny Review Running",
            "",
            "> [!NOTE]",
            "> Reviewer workflow is running. The specimen is under observation.",
            "",
            f"- **Mode:** `{mode or 'unknown'}`",
            f"- **{commit_line(head_sha)}**",
        ]
    )
    patch_or_create_command_status(pr_num, body)


def patch_command_status_complete(pr_num, head_sha):
    body = "\n".join(
        [
            COMMAND_STATUS_MARKER,
            "## ✅ Bunny Review Completed",
            "",
            "> [!TIP]",
            "> Review posted. The specimen has left the observation table.",
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
    head_sha_match = STATE_MARKER_RE.search(body)
    head_sha = head_sha_match.group(1) if head_sha_match else os.environ.get(
        "PR_HEAD_SHA", ""
    )
    comment_id = find_walkthrough_comment(pr_num)
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

    patch_command_status_complete(pr_num, head_sha)

    comments = json.loads(pathlib.Path(args.inline_json).read_text("utf-8"))
    comments = filter_duplicate_inline_comments(pr_num, comments)
    if not comments:
        return
    payload = {
        "event": "COMMENT",
        "body": "Bunny Review inline findings",
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


def truthy(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "on"}


def load_review_for_status(path):
    try:
        return json.loads(pathlib.Path(path).read_text("utf-8"))
    except Exception:
        return {}


def ci_control_has_failure(path):
    try:
        data = json.loads(pathlib.Path(path).read_text("utf-8"))
    except Exception:
        return False
    failed = data.get("failed") if isinstance(data, dict) else []
    return bool(failed)


def ci_control_has_pending_or_missing(path):
    try:
        data = json.loads(pathlib.Path(path).read_text("utf-8"))
    except Exception:
        return False
    if not isinstance(data, dict):
        return False
    return bool(data.get("pending") or data.get("missing"))


def status_state(args):
    if str(args.job_status or "").lower() != "success":
        print("state=failure")
        print("description=Bunny Review did not complete. Inspect the trusted workflow run for details.")
        return
    if not pathlib.Path(args.review_json).exists():
        print("state=failure")
        print("description=Bunny Review did not produce review.json; inspect the trusted workflow run.")
        return
    review_obj = load_review_for_status(args.review_json)
    pre_merge = review_obj.get("pre_merge_checks") if isinstance(review_obj, dict) else []
    findings = status_findings(review_obj)
    if has_incomplete_review_check(pre_merge or []):
        print("state=failure")
        print("description=Bunny Review posted a failure or skipped report; rerun after repairing the review control.")
        return
    draft = truthy(args.draft)
    has_high_or_blocking = any(
        severity_meta(finding.severity)["rank"] <= severity_meta("high")["rank"]
        for finding in findings
    )
    failed_ci = ci_control_has_failure(args.ci_control)
    pending_ci = ci_control_has_pending_or_missing(args.ci_control)
    if not draft and has_high_or_blocking:
        print("state=failure")
        print("description=Bunny found blocking/high issues; repair before merge.")
        return
    if not draft and failed_ci:
        print("state=failure")
        print("description=Expected CI controls failed; repair CI before merge.")
        return
    if not draft and pending_ci:
        print("state=pending")
        print("description=Expected CI controls are still pending or missing.")
        return
    if draft and (findings or failed_ci):
        print("state=success")
        print("description=Draft review posted with notes.")
        return
    if findings:
        print("state=success")
        print("description=Bunny posted non-blocking findings or notes.")
        return
    print("state=success")
    print("description=Bunny posted or updated its review for this pull request.")


def status_findings(review_obj):
    base = (review_obj or {}).get("review_base")
    if base:
        try:
            findings, _, _ = validate_review_items(review_obj, base)
            return findings
        except Exception:
            pass
    findings = []
    for raw in (review_obj or {}).get("findings", []):
        try:
            finding = normalize_review_item(raw, default_severity="medium")
        except Exception:
            continue
        if finding.severity not in {"blocking", "high", "medium", "low", "nitpick"}:
            finding.severity = "medium"
        findings.append(finding)
    return findings


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
    status = sub.add_parser("status-state")
    status.add_argument("--review-json", default="review.json")
    status.add_argument("--ci-control", default="bunny-ci-control.json")
    status.add_argument("--draft", default=os.environ.get("BUNNY_IS_DRAFT", "false"))
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


if __name__ == "__main__":
    main()
