# scripts/bunny_review.py
import json, os, pathlib, re, subprocess, time
from openai import OpenAI

REPO_ROOT = pathlib.Path.cwd().resolve()
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

# --- safety: keep file reads inside the repo and away from secrets ---
def _safe_path(rel: str) -> pathlib.Path:
    full = (REPO_ROOT / rel).resolve()
    if full != REPO_ROOT and REPO_ROOT not in full.parents:
        raise ValueError("path escapes repo root")
    name = full.name.lower()
    if name.startswith(".env") or name in {
        "credentials.json", "id_rsa", "id_ed25519", ".npmrc", ".netrc"
    }:
        raise ValueError("blocked sensitive file")
    return full

def run_git(args, limit=MAX_SECTION_CHARS):
    out = subprocess.run(
        ["git", *args], cwd=REPO_ROOT,
        capture_output=True, text=True, timeout=60,
    )
    return truncate(out.stdout + out.stderr, limit)

def truncate(text, limit):
    if len(text) <= limit:
        return text
    return (
        text[:limit]
        + f"\n\n[truncated: section was {len(text)} chars, limit is {limit} chars]\n"
    )

def read_text(path, limit=MAX_SECTION_CHARS):
    p = _safe_path(path)
    return truncate(p.read_text(encoding="utf-8", errors="replace"), limit)

def read_context_file(path):
    return read_text(path, MAX_CONTEXT_FILE_CHARS)

def search_repo(pattern):
    if not pattern or len(pattern) > 120:
        return "refused: search pattern must be 1-120 characters"
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
        if path.stat().st_size > MAX_SEARCH_FILE_BYTES:
            continue
        try:
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
        "true", "false", "null", "none", "some", "string", "value", "json",
        "expect", "should", "test", "result", "state", "data", "content",
        "message", "messages", "chat", "chats", "role", "rows", "row",
        "import", "imported", "storage", "create", "get", "list", "id",
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

def select_guidance(files):
    guidance = ["AGENTS.md"]
    joined = "\n".join(files)
    if any(
        marker in joined
        for marker in (
            "src/engine/",
            "src/features/",
            "src/shared/api/",
            "src-tauri/",
        )
    ):
        guidance.append("skills/marinara-architecture-guard/SKILL.md")
    if any(
        marker in joined
        for marker in (
            "chat",
            "roleplay",
            "game",
            "modes",
            "prompt",
            "generation",
            "summary",
            "memory",
        )
    ):
        guidance.append("skills/marinara-mode-separation/SKILL.md")
    if any(
        marker in joined
        for marker in (
            "fix/",
            "storage",
            "imports",
            "provider",
            "transport",
            "commands",
        )
    ):
        guidance.append("skills/marinara-bugfix-discipline/SKILL.md")
    if any(marker in joined for marker in ("README", "docs/", "skills/", "AGENTS.md")):
        guidance.append("skills/marinara-getting-started/SKILL.md")
    return list(dict.fromkeys(guidance))

def build_review_packet(base, ci_status):
    files = changed_files(base)
    patch = run_git(
        ["diff", "--find-renames", "--unified=80", f"{base}...HEAD"],
        MAX_SECTION_CHARS,
    )
    sections = [
        ("git status", run_git(["status", "--short", "--branch"], 12_000)),
        ("repo root", run_git(["rev-parse", "--show-toplevel"], 4_000)),
        ("merge base", run_git(["merge-base", "HEAD", base], 4_000)),
        ("diff stat", run_git(["diff", "--stat", f"{base}...HEAD"], 20_000)),
        ("changed files", "\n".join(files) or "No changed files reported."),
        ("numstat", run_git(["diff", "--numstat", f"{base}...HEAD"], 20_000)),
        (
            "patch",
            patch,
        ),
        ("changed identifier usage", build_identifier_context(patch)),
    ]
    if ci_status:
        sections.append(("CI status", ci_status))
    for path in select_guidance(files):
        try:
            sections.append((f"guidance: {path}", read_text(path, 30_000)))
        except Exception as exc:
            sections.append((f"guidance: {path}", f"Could not read: {exc}"))

    packet = "\n\n".join(
        f"## {title}\n```text\n{body}\n```" for title, body in sections
    )
    return truncate(packet, MAX_REVIEW_PACKET_CHARS)

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
    )
    stats["model_calls"] += 1
    add_usage(stats, getattr(resp, "usage", None))
    if isinstance(resp, str):
        return resp
    return resp.choices[0].message.content or ""

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
        "searches": [value for value in searches if isinstance(value, str)][:MAX_CONTEXT_SEARCHES],
    }

def clean_review_text(content):
    cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL | re.IGNORECASE)
    marker = "## Bunny Review"
    if marker in cleaned:
        cleaned = cleaned[cleaned.find(marker):]
    return cleaned.replace("FINAL_REVIEW", "", 1).strip()

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

def main():
    client = OpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        base_url=os.environ.get("LLM_BASE_URL"),
    )
    skill_path = pathlib.Path(
        os.environ.get("BUNNY_REVIEW_SKILL_PATH", "skills/bunny-style-review/SKILL.md")
    )
    if not skill_path.is_absolute():
        skill_path = REPO_ROOT / skill_path
    skill = skill_path.read_text("utf-8")
    base = os.environ.get("PR_BASE_REF", "main")
    ci_status = os.environ.get("CI_STATUS", "")
    review_packet = build_review_packet(base, ci_status)

    triage_content = (
        f"Review this PR. The review base branch is '{base}'. "
        "Use the provided review packet as the complete inspection context. "
        "You have one chance to request focused extra context before the final review. "
        "If the packet is enough, reply with FINAL_REVIEW followed by the review in the skill's Output Shape. "
        "If more context is necessary to validate a concrete potential finding, reply only with "
        'CONTEXT_REQUEST and JSON like {"files":["path"],"searches":["literal text"]}. '
        f"Request at most {MAX_CONTEXT_FILES} files and {MAX_CONTEXT_SEARCHES} literal searches."
    )
    triage_content += (
        "\n\nFocus on correctness, contracts, failure paths, tests, and architecture. "
        "If the packet is truncated or missing context for a potential issue, mention that "
        "limitation in What I Checked rather than inventing certainty."
        f"\n\n# Review Packet\n{review_packet}"
    )

    messages = [
        {"role": "system", "content": skill},
        {"role": "user", "content": triage_content},
    ]
    stats = build_stats(review_packet)

    first_response = model_call(client, messages, stats)
    request = parse_context_request(first_response)
    if request is None:
        review = clean_review_text(first_response)
    else:
        extra_context = build_extra_context(request, stats)
        final_messages = [
            {"role": "system", "content": skill},
            {"role": "user", "content": triage_content},
            {"role": "assistant", "content": first_response},
            {
                "role": "user",
                "content": (
                    "Here is the bounded extra context you requested. "
                    "Do not request more context. Produce only the final review in the skill's Output Shape."
                    f"\n\n# Extra Context\n{extra_context}"
                ),
            },
        ]
        review = clean_review_text(model_call(client, final_messages, stats))
    pathlib.Path("review.md").write_text(review or "Bunny could not produce review text.", "utf-8")
    print_telemetry(stats)

if __name__ == "__main__":
    main()
