import fnmatch
import glob
import json
import os
import pathlib
import subprocess
from typing import Any

from openai import OpenAI

REPO_ROOT = pathlib.Path.cwd().resolve()
MAX_ITERS = 40
MAX_FILE_BYTES = 200_000
MAX_TOOL_OUTPUT = 60_000

BLOCKED_NAMES = {
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".npmrc",
    ".netrc",
    "credentials.json",
    "id_ed25519",
    "id_rsa",
}
BLOCKED_DIRS = {
    ".git",
    ".idea",
    ".vscode",
    "dist",
    "dist-ssr",
    "node_modules",
    "playwright-report",
    "src-tauri/target",
    "target",
}


def _safe_path(rel: str) -> pathlib.Path:
    full = (REPO_ROOT / rel).resolve()
    if full != REPO_ROOT and REPO_ROOT not in full.parents:
        raise ValueError("path escapes repo root")
    relative = full.relative_to(REPO_ROOT).as_posix()
    name = full.name.lower()
    if name.startswith(".env") or name in BLOCKED_NAMES:
        raise ValueError("blocked sensitive file")
    if any(relative == blocked or relative.startswith(f"{blocked}/") for blocked in BLOCKED_DIRS):
        raise ValueError("blocked generated or internal path")
    return full


def _is_readable_repo_file(path: pathlib.Path) -> bool:
    try:
        relative = path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return False
    name = path.name.lower()
    if name.startswith(".env") or name in BLOCKED_NAMES:
        return False
    if any(relative == blocked or relative.startswith(f"{blocked}/") for blocked in BLOCKED_DIRS):
        return False
    return path.is_file()


ALLOWED_GIT = {
    "status",
    "diff",
    "log",
    "show",
    "rev-parse",
    "merge-base",
    "name-only",
    "ls-files",
    "blame",
}


def run_git(args: list[str]) -> str:
    if not args or args[0] not in ALLOWED_GIT:
        return f"refused: git '{args[0] if args else ''}' not allowed"
    out = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    return (out.stdout + out.stderr)[:MAX_TOOL_OUTPUT]


def read_file(path: str, start: int = 1, end: int | None = None) -> str:
    p = _safe_path(path)
    data = p.read_text(encoding="utf-8", errors="replace")[:MAX_FILE_BYTES]
    lines = data.splitlines()
    stop = end or len(lines)
    chunk = lines[max(0, start - 1) : stop]
    return "\n".join(f"{i + start}: {line}" for i, line in enumerate(chunk))


def list_dir(path: str = ".") -> str:
    p = _safe_path(path)
    return "\n".join(sorted(f"{c.name}/" if c.is_dir() else c.name for c in p.iterdir()))


def search(pattern: str, glob_expr: str = "**/*") -> str:
    hits: list[str] = []
    for candidate in glob.glob(str(REPO_ROOT / glob_expr), recursive=True):
        fp = pathlib.Path(candidate)
        if not _is_readable_repo_file(fp):
            continue
        rel = fp.relative_to(REPO_ROOT).as_posix()
        if not fnmatch.fnmatch(rel, glob_expr):
            continue
        try:
            for line_number, line in enumerate(fp.read_text("utf-8", "replace").splitlines(), 1):
                if pattern in line:
                    hits.append(f"{rel}:{line_number}: {line.strip()[:200]}")
                    if len(hits) >= 100:
                        return "\n".join(hits)
        except OSError:
            continue
    return "\n".join(hits) or "no matches"


TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "run_git",
            "description": "Run a read-only git command. First arg is the subcommand.",
            "parameters": {
                "type": "object",
                "properties": {"args": {"type": "array", "items": {"type": "string"}}},
                "required": ["args"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a repo file. Optional 1-based start/end lines.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "start": {"type": "integer"},
                    "end": {"type": "integer"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List a directory inside the repo.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search",
            "description": "Substring search across files matching a glob.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string"},
                    "glob_expr": {"type": "string"},
                },
                "required": ["pattern"],
            },
        },
    },
]

DISPATCH = {
    "run_git": run_git,
    "read_file": read_file,
    "list_dir": list_dir,
    "search": search,
}


def _client() -> OpenAI:
    kwargs: dict[str, str] = {"api_key": os.environ["OPENAI_API_KEY"]}
    base_url = os.environ.get("LLM_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs)


def main() -> None:
    client = _client()
    skill_path = pathlib.Path(
        os.environ.get("BUNNY_SKILL_PATH", REPO_ROOT / "skills/bunny-style-review/SKILL.md")
    )
    skill = skill_path.read_text("utf-8")
    base = os.environ.get("PR_BASE_REF", "origin/main")
    model = os.environ.get("LLM_MODEL", "gpt-5.5")

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": skill},
        {
            "role": "user",
            "content": (
                f"Review this PR. The review base branch is '{base}'. "
                "Follow the skill's Setup and Review Passes using the tools, "
                "load only the docs and Marinara skills that match the touched area, "
                "and produce the final review in the skill's Output Shape. "
                "Do not edit files. When done, reply with only the review text."
            ),
        },
    ]

    for _ in range(MAX_ITERS):
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOLS,
        )
        msg = resp.choices[0].message
        messages.append(msg.model_dump(exclude_none=True))

        if not msg.tool_calls:
            pathlib.Path("review.md").write_text(msg.content or "", "utf-8")
            return

        for call in msg.tool_calls:
            try:
                args = json.loads(call.function.arguments or "{}")
                result = DISPATCH[call.function.name](**args)
            except Exception as exc:
                result = f"error: {exc}"
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": str(result)[:MAX_TOOL_OUTPUT],
                }
            )

    pathlib.Path("review.md").write_text(
        "Review did not converge within the iteration budget.",
        "utf-8",
    )


if __name__ == "__main__":
    main()
