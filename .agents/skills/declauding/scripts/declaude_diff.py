#!/usr/bin/env python3
"""Content-preservation check for a register pass.

Step 5 of the skill's workflow as an exit code. A register edit is supposed to
change how a draft sounds and nothing about what it claims, and the two failures
that violate that — a claim dropped, a fact invented — both read fluently
afterwards, which is why a read-through misses them.

    python3 declaude_diff.py SOURCE.md REWRITE.md
    python3 declaude_diff.py --git blog/post.html          # working tree vs HEAD
    python3 declaude_diff.py A.md B.md --json
    python3 declaude_diff.py A.md B.md --waive footnote --waive 2024

Reports LOST (in the source, gone from the rewrite) and ADDED (in the rewrite,
absent from the source). Exit 1 if either is non-empty after waivers.

Deliberately lexical. An embedding of the source and an embedding of the
rewrite sit at cosine ~0.99 whether or not a superlative survived, because
paraphrase invariance is the property embedders are trained for and dropping
one ranking word is a paraphrase by that measure. See references/preservation.md
for the numbers. What this checks is set membership, not similarity.

It guards claims, not voice. Rewriting "old news" as "well documented" changes
register and no rule here fires on it; that is what the author's-sample rule in
SKILL.md is for.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from declaude_lint import html_to_lines, looks_like_html
except ImportError:                                          # standalone copy
    def looks_like_html(text: str) -> bool:
        return "<html" in text[:4000].lower() or "<p>" in text[:4000].lower()

    def html_to_lines(text: str) -> str:
        return re.sub(r"<[^>]+>", " ", text)

# Spans whose content is quoted material, code, or a link target. Prose edits do
# not touch them, so a change inside one is reported as its own class rather
# than decomposed into missing tokens.
CODE_SPAN = re.compile(r"`[^`\n]+`|<code>.*?</code>", re.S | re.I)
FENCED = re.compile(r"^```.*?^```", re.S | re.M)
URL = re.compile(r"https?://[^\s)\"'<>]+")

NUMBER = re.compile(r"(?<![\w.])[+−-]?\d[\d,]*(?:\.\d+)?%?(?![\w])")
NUMBER_WORD = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14",
    "fifteen": "15", "sixteen": "16", "seventeen": "17", "eighteen": "18",
    "nineteen": "19", "twenty": "20",
}

# A superlative RANKS over a set; a comparative does not. The distinction is the
# whole point: "the format that most invites staged reveals" rewritten as
# "invites staged reveals more than most formats do" keeps the token `most` and
# loses the ranking, so counting tokens misses it and counting constructions
# does not.
SUPERLATIVE = re.compile(
    r"\bthe\s+(?:single\s+|very\s+)?(?:most|least|best|worst|first|last|only|"
    r"largest|smallest|highest|lowest|fastest|slowest|[a-z]{3,}est)\b"
    r"|\bmost\s+likely\s+to\b|\bby\s+far\b|\bof\s+(?:all|any)\b"
    # "the format that most invites staged reveals" — the relative pronoun is
    # optional and was the reason the first cut missed the case it was written
    # for. The rewrite that lost it, "more than most formats do", is a
    # comparative and must not match here.
    r"|\bthe\s+\w+(?:\s+(?:that|which|who))?\s+(?:most|least)\s+\w+",
    re.I,
)
COMPARATIVE = re.compile(r"\b(?:more|less|fewer|better|worse|[a-z]{3,}er)\s+than\b", re.I)

# Words that set the scope of a claim. Losing one turns a universal into an
# example and an example into a universal.
SCOPE = re.compile(
    r"\b(?:all|every|each|none|no|any|both|either|neither|only|solely|exclusively"
    r"|always|never|entirely|wholly|simultaneously|at\s+once|per\b|across)\b", re.I)

# A hedge with a condition attached is a real qualification. A hedge with none
# is entry 32. This records the pair so a lost condition is visible.
HEDGE = re.compile(
    r"\b(?:roughly|approximately|about|around|nearly|almost|mostly|largely|"
    r"generally|typically|usually|often|sometimes|may|might|could|would|likely|"
    r"probably|apparently|seems?|appears?|estimated?)\b", re.I)

NEGATION = re.compile(r"\b(?:not|n't|never|without|cannot|lacks?|absent|fails?\s+to)\b", re.I)

# Capitalised tokens that are not sentence-initial: names, products, versions.
PROPER = re.compile(r"(?<![.!?]\s)(?<!^)\b([A-Z][A-Za-z0-9]*(?:[-.][A-Za-z0-9]+)*)\b", re.M)
PROPER_STOP = frozenset("""A An The I If In On At To Of For And But Or So It This That These
Those We You They He She There Here When Where What Why How Not No Its His Her Their""".split())

QUOTED = re.compile(r"[\"“]([^\"”\n]{3,120})[\"”]")


def load(path: str) -> str:
    text = Path(path).read_text(encoding="utf-8")
    if looks_like_html(text):
        text = html_to_lines(text)
    return text


def strip_untouchable(text: str) -> tuple[str, list[str]]:
    """Pull code, fences and URLs out; a prose pass must leave them alone."""
    held: list[str] = []

    def take(m: re.Match) -> str:
        held.append(m.group(0))
        return " "

    for pat in (FENCED, CODE_SPAN, URL):
        text = pat.sub(take, text)
    return text, held


def normalise_numbers(text: str) -> Counter:
    """Digits and their spelled forms are the same claim."""
    c = Counter(m.group(0).replace(",", "").lstrip("+") for m in NUMBER.finditer(text))
    for word, digit in NUMBER_WORD.items():
        n = len(re.findall(rf"\b{word}\b", text, re.I))
        if n:
            c[digit] += n
    return c


def features(text: str) -> dict[str, Counter]:
    body, held = strip_untouchable(text)
    proper = Counter(
        m.group(1) for m in PROPER.finditer(body)
        if m.group(1) not in PROPER_STOP and not m.group(1).isupper() or len(m.group(1)) > 3
    )
    return {
        "number": normalise_numbers(body),
        "superlative": Counter([m.group(0).lower() for m in SUPERLATIVE.finditer(body)]),
        "comparative": Counter([m.group(0).lower() for m in COMPARATIVE.finditer(body)]),
        "scope": Counter(m.group(0).lower().replace("  ", " ") for m in SCOPE.finditer(body)),
        "hedge": Counter(m.group(0).lower() for m in HEDGE.finditer(body)),
        "negation": Counter(m.group(0).lower() for m in NEGATION.finditer(body)),
        "proper": proper,
        "quoted": Counter(m.group(1).strip() for m in QUOTED.finditer(body)),
        "verbatim": Counter(h.strip() for h in held),
    }


# Two kinds of class, and the difference decides what a finding is.
#
# COUNTED: the construction carries the claim and its wording does not. "The
# format that most invites X" rewritten as "the format most likely to invite X"
# keeps the ranking and changes every word of it, so per-token reporting is pure
# noise here and the total is the whole signal.
#
# MEMBERSHIP: the token IS the claim. A number, a name, a quotation and a link
# target either survive verbatim or the rewrite says something the source did
# not.
COUNTED_CLASSES = ("superlative", "scope", "negation", "hedge")
MEMBERSHIP_CLASSES = ("number", "proper", "quoted", "verbatim")

CLASS_NOTE = {
    "number": "a number in the source is not in the rewrite — every figure, date and version must survive",
    "superlative": "a ranking construction was lost; a comparative is not a superlative",
    "scope": "a scope word was lost — a universal became an example, or the reverse",
    "hedge": "a hedge was lost; check it was not carrying a real condition",
    "negation": "a negation was lost — the claim may now say the opposite",
    "proper": "a name, product or identifier in the source is not in the rewrite",
    "quoted": "quoted material changed; a register pass does not edit inside quotation marks",
    "verbatim": "code, a fenced block or a link target changed",
}


def compare(src: str, dst: str, waive: set[str]) -> list[dict]:
    a, b = features(src), features(dst)
    out: list[dict] = []

    def waived(token: str) -> bool:
        return any(w.lower() in token.lower() for w in waive)

    # Presence, not frequency. A name the source uses twelve times and the
    # rewrite thirteen has not been invented, and a number it uses thirteen
    # times and the rewrite twelve has not been dropped — reporting either is
    # how a guard becomes noise a reader learns to skip. What matters is a
    # token that was there and is now gone, or one that was never there at all.
    for cls in MEMBERSHIP_CLASSES:
        for token, n in a[cls].items():
            if not waived(token) and b[cls].get(token, 0) == 0:
                out.append({"direction": "LOST", "class": cls, "token": token,
                            "source": n, "rewrite": 0, "note": CLASS_NOTE[cls]})
        for token, n in b[cls].items():
            if not waived(token) and a[cls].get(token, 0) == 0:
                out.append({"direction": "ADDED", "class": cls, "token": token,
                            "source": 0, "rewrite": n,
                            "note": "in the rewrite and nowhere in the source — the rewrite "
                                    "must not invent a fact, name, number, date or citation"})

    for cls in COUNTED_CLASSES:
        na = sum(n for tok, n in a[cls].items() if not waived(tok))
        nb = sum(n for tok, n in b[cls].items() if not waived(tok))
        if nb < na:
            gone = sorted(set(a[cls]) - set(b[cls]))
            out.append({"direction": "COUNT", "class": cls, "token": f"{cls} total",
                        "source": na, "rewrite": nb,
                        "note": f"{na - nb} fewer — {CLASS_NOTE[cls]}"
                                + (f" Gone from the rewrite: {', '.join(repr(g) for g in gone[:4])}."
                                   if gone else "")})

    order = {"LOST": 0, "ADDED": 1, "COUNT": 2}
    return sorted(out, key=lambda h: (order[h["direction"]], h["class"], h["token"]))


def git_show(path: str, ref: str) -> str:
    return subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True,
                          text=True, check=True).stdout


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", nargs="?", help="the draft before the pass")
    ap.add_argument("rewrite", nargs="?", help="the draft after it")
    ap.add_argument("--git", metavar="PATH",
                    help="compare PATH in the working tree against a git ref")
    ap.add_argument("--ref", default="HEAD", help="ref for --git (default HEAD)")
    ap.add_argument("--waive", action="append", default=[], metavar="TOKEN",
                    help="ignore findings whose token contains TOKEN; repeatable")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if args.git:
        try:
            src = git_show(args.git, args.ref)
        except subprocess.CalledProcessError:
            print(f"{args.git} is not in {args.ref} — new file, nothing to preserve")
            return 0
        if looks_like_html(src):
            src = html_to_lines(src)
        dst = load(args.git)
        label = f"{args.ref}:{args.git} -> working tree"
    elif args.source and args.rewrite:
        src, dst = load(args.source), load(args.rewrite)
        label = f"{args.source} -> {args.rewrite}"
    else:
        ap.error("give SOURCE and REWRITE, or --git PATH")

    hits = compare(src, dst, set(args.waive))
    if args.json:
        print(json.dumps({"target": label, "findings": hits}, indent=1))
        return 1 if hits else 0

    if not hits:
        print(f"{label}: every claim survives, nothing invented")
        return 0

    print(f"{label}: {len(hits)} finding(s)\n")
    for h in hits:
        print(f"  [{h['direction']:5}] {h['class']:<12} {h['token'][:60]!r}  "
              f"source {h['source']} -> rewrite {h['rewrite']}")
        print(f"          {h['note']}")
    print("\nA finding is not a verdict. Each one is either a claim the edit dropped,")
    print("a fact it invented, or a rephrasing this check cannot see through — decide")
    print("which, and --waive the ones that are rephrasings.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
