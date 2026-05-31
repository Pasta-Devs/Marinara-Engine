# scripts/bunny_review.py
import json, os, pathlib, subprocess, glob, fnmatch
from openai import OpenAI

REPO_ROOT = pathlib.Path.cwd().resolve()
MAX_TOOL_ITERS = 30
MAX_FILE_BYTES = 200_000

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

# --- read-only git only; no build/check commands ---
ALLOWED_GIT = {
    "status", "diff", "log", "show", "rev-parse",
    "merge-base", "name-only", "ls-files", "blame",
}
def run_git(args):
    if not args or args[0] not in ALLOWED_GIT:
        return f"refused: git '{args[0] if args else ''}' not allowed"
    out = subprocess.run(
        ["git", *args], cwd=REPO_ROOT,
        capture_output=True, text=True, timeout=60,
    )
    return (out.stdout + out.stderr)[:60_000]

def read_file(path, start=1, end=None):
    p = _safe_path(path)
    data = p.read_text(encoding="utf-8", errors="replace")[:MAX_FILE_BYTES]
    lines = data.splitlines()
    end = end or len(lines)
    chunk = lines[max(0, start - 1):end]
    return "\n".join(f"{i + start}: {l}" for i, l in enumerate(chunk))

def list_dir(path="."):
    p = _safe_path(path)
    return "\n".join(sorted(
        f"{c.name}/" if c.is_dir() else c.name for c in p.iterdir()
    ))

def search(pattern, glob_expr="**/*"):
    hits = []
    for f in glob.glob(str(REPO_ROOT / glob_expr), recursive=True):
        fp = pathlib.Path(f)
        if not fp.is_file():
            continue
        try:
            for n, line in enumerate(fp.read_text("utf-8", "replace").splitlines(), 1):
                if pattern in line:
                    rel = fp.relative_to(REPO_ROOT)
                    hits.append(f"{rel}:{n}: {line.strip()[:200]}")
                    if len(hits) >= 100:
                        return "\n".join(hits)
        except Exception:
            continue
    return "\n".join(hits) or "no matches"

TOOLS = [
    {"type": "function", "function": {
        "name": "run_git",
        "description": "Run a read-only git command. First arg is the subcommand.",
        "parameters": {"type": "object", "properties": {
            "args": {"type": "array", "items": {"type": "string"}}},
            "required": ["args"]}}},
    {"type": "function", "function": {
        "name": "read_file",
        "description": "Read a repo file. Optional 1-based start/end lines.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
            "start": {"type": "integer"}, "end": {"type": "integer"}},
            "required": ["path"]}}},
    {"type": "function", "function": {
        "name": "list_dir",
        "description": "List a directory inside the repo.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"}}, "required": []}}},
    {"type": "function", "function": {
        "name": "search",
        "description": "Substring search across files matching a glob.",
        "parameters": {"type": "object", "properties": {
            "pattern": {"type": "string"}, "glob_expr": {"type": "string"}},
            "required": ["pattern"]}}},
]
DISPATCH = {"run_git": run_git, "read_file": read_file,
            "list_dir": list_dir, "search": search}

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

    # Build the user message with CI status if available
    user_content = (
        f"Review this PR. The review base branch is '{base}'. "
        f"Follow the skill's Setup and Review Passes using the tools, "
        f"load only the docs and marinara skills that match the touched area, "
        f"and produce the final review in the skill's Output Shape. "
        f"Do not edit files."
    )
    
    if ci_status:
        user_content += (
            f"\n\nCI Status: {ci_status}\n"
            f"The CI jobs (typecheck, build, cargo check, architecture checks, tests) "
            f"have already run. Reference their status in your What I Checked section rather "
            f"than re-running these commands. Focus your verification on reasoning checks "
            f"that CI cannot perform: ownership boundaries, failure-path analysis, "
            f"mode separation, and contract correctness."
        )
    
    user_content += (
        "\n\nUse the tools for focused inspection only. When you have enough context, "
        "stop calling tools and reply with only the review text in the Output Shape format."
    )

    messages = [
        {"role": "system", "content": skill},
        {"role": "user", "content": user_content},
    ]

    for _ in range(MAX_TOOL_ITERS):
        resp = client.chat.completions.create(
            model=os.environ.get("LLM_MODEL", "gpt-5.5"),
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
            except Exception as e:
                result = f"error: {e}"
            messages.append({
                "role": "tool", "tool_call_id": call.id,
                "content": str(result)[:60_000],
            })

    messages.append({
        "role": "user",
        "content": (
            "The tool-call budget is now closed. Do not call any more tools. "
            "Using only the context already gathered, produce the final Bunny Review "
            "in the required Output Shape. If evidence is incomplete, say so in "
            "What I Checked instead of continuing research."
        ),
    })
    resp = client.chat.completions.create(
        model=os.environ.get("LLM_MODEL", "gpt-5.5"),
        messages=messages,
        tools=TOOLS,
        tool_choice="none",
    )
    msg = resp.choices[0].message
    pathlib.Path("review.md").write_text(
        msg.content or "Bunny could not produce review text after the tool budget closed.",
        "utf-8",
    )

if __name__ == "__main__":
    main()
