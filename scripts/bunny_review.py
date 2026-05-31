# scripts/bunny_review.py
import os, pathlib, subprocess, time
from openai import OpenAI

REPO_ROOT = pathlib.Path.cwd().resolve()
MAX_REVIEW_PACKET_CHARS = 180_000
MAX_SECTION_CHARS = 60_000

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
    sections = [
        ("git status", run_git(["status", "--short", "--branch"], 12_000)),
        ("repo root", run_git(["rev-parse", "--show-toplevel"], 4_000)),
        ("merge base", run_git(["merge-base", "HEAD", base], 4_000)),
        ("diff stat", run_git(["diff", "--stat", f"{base}...HEAD"], 20_000)),
        ("changed files", "\n".join(files) or "No changed files reported."),
        ("numstat", run_git(["diff", "--numstat", f"{base}...HEAD"], 20_000)),
        (
            "patch",
            run_git(
                ["diff", "--find-renames", "--unified=80", f"{base}...HEAD"],
                MAX_SECTION_CHARS,
            ),
        ),
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

def print_telemetry(stats):
    elapsed = time.monotonic() - stats["started_at"]
    print(
        "Bunny telemetry: "
        f"elapsed_s={elapsed:.1f}; "
        f"model_calls={stats['model_calls']}; "
        f"review_packet_chars={stats['review_packet_chars']}; "
        f"prompt_tokens={stats['prompt_tokens']}; "
        f"completion_tokens={stats['completion_tokens']}; "
        f"reasoning_tokens={stats['reasoning_tokens']}; "
        f"total_tokens={stats['total_tokens']}",
        flush=True,
    )

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

    user_content = (
        f"Review this PR. The review base branch is '{base}'. "
        "Use the provided review packet as the complete inspection context. "
        "Do not ask for tools, do not claim you ran commands beyond the packet, "
        "and produce only the final review in the skill's Output Shape."
    )
    user_content += (
        "\n\nFocus on correctness, contracts, failure paths, tests, and architecture. "
        "If the packet is truncated or missing context for a potential issue, mention that "
        "limitation in What I Checked rather than inventing certainty."
        f"\n\n# Review Packet\n{review_packet}"
    )

    messages = [
        {"role": "system", "content": skill},
        {"role": "user", "content": user_content},
    ]
    stats = {
        "started_at": time.monotonic(),
        "model_calls": 0,
        "review_packet_chars": len(review_packet),
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "reasoning_tokens": 0,
        "total_tokens": 0,
    }

    resp = client.chat.completions.create(
        model=os.environ.get("LLM_MODEL", "gpt-5.5"),
        messages=messages,
    )
    stats["model_calls"] += 1
    add_usage(stats, getattr(resp, "usage", None))
    msg = resp.choices[0].message
    pathlib.Path("review.md").write_text(
        msg.content or "Bunny could not produce review text from the review packet.",
        "utf-8",
    )
    print_telemetry(stats)

if __name__ == "__main__":
    main()
