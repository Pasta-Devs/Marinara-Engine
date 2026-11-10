# Where entries 43 to 47 come from

Entries 1 to 42 were promoted from drafts, one specimen at a time, under the
rule in `SKILL.md`: a phrase earns an entry after it shows up twice. Entries 43
to 47 came the other way round, from a corpus that had already counted the
phrases. This file records what was measured, so a later reader can check the
entries against the evidence instead of taking them on trust.

## The source

Louis Abraham's [load-bearing](https://github.com/louisabraham/load-bearing)
samples GitHub pull request descriptions — ten five-minute windows a day drawn
by a date-seeded RNG, bodies fetched through the search API, bot logins and
mass-posters filtered out — and clusters them by the words they are written
with. Ten clusters, hard assignment, KL k-means with no time parameter anywhere
in the fit, so a cluster's weekly share is attribution after the fact rather
than a trend the model was free to draw.

The numbers below are from `analysis.js` generated 2026-08-28: 595 days in 85
whole weeks, 2025-01-06 to 2026-08-17, 461,121 descriptions, 51,079,244 word
appearances, 19,798 words past the 50-distinct-authors floor. `k=10`, `SEED=6`,
8 fits, cheapest published.

One of the ten clusters was **0.70% of the first eight weeks and 39.5% of the
last four**. The least-squares line over the last twelve weeks is +1.24 points a
week. Its highest-lift words, by the ratio of inside-frequency to
outside-frequency:

```
load-bearing 39x   plainly 34x   quietly 30x   refusal 28x   survived 28x
re-derived 27x     halves 27x    asserted 25x  nobody 25x    genuinely 24x
deliberately 24x   premise 23x   refuses 23x   outright 23x  byte-identical 23x
ruling 22x         genuine 22x   handed 22x    carries 21x   died 20x
```

## The register this skill produces

That is not the slop vocabulary of entry 20. There is no *delve*, no *tapestry*,
no *robust*. It is flat, concrete, verdict-shaped technical prose: the register
this skill's Overcorrection section describes as the target, where the writing is
plain-and-sure, facts are short, and failures are stated dryly.

**The register this skill produces is the fastest-growing cluster in the
corpus.** Entries 43 to 47 exist because a subtractive pass that removes 42
staging tics and lands the draft in a register 39% of GitHub now writes has
traded one detectable shape for another.

Putting the staging back would be worse. What the entries ask instead is that
flat certainty be checked the way staging is, by the same generative test one
register over: am I stating the finding, or performing having settled it? An
author reaches for these shapes when a sentence has to sound settled.

## The measured rates and their limits

Rate of the cluster's top-150 vocabulary as a percentage of body-prose word
tokens, measured the way `declaude_lint.py` measures it — headings, tables, code
fences and, where marked, quoted specimens excluded:

| text | rate |
|---|---|
| Python stdlib docstrings, 116k words, 46 chunks of 2,500 | median 0.08, p90 0.17, max 0.32 |
| `tests/sample-clean.md`, this skill's human control | 0.34 |
| load-bearing's own `README.md`, written by a person | 1.51 |
| this skill's `SKILL.md` | 1.47 |
| this skill's `README.md` | 1.71 |
| `tests/sample-tics.md` | 2.87 |
| this file | 2.65 |
| this skill's `references/register.md` | 3.17 |

The stdlib figure is a floor rather than a fair control. API reference prose is a
different genre, so some of the separation is genre and not authorship.

The third row is the one that settles what the rule can claim. Louis Abraham's
README scores 1.51, above this skill's `SKILL.md`, on `nothing` x9, `carries` x3,
`alone` x2, `never` x2 and `half` x2. Quoted specimens are already excluded, so
they do not account for it. He writes this way, and writes it well.

So the rate is a **register locator, not an authorship detector**. It answers one
question: is this draft written in the cluster's register. The
`corpus-register` density line in `declaude_lint.py` says so in its note. That
wording carries weight. A reader who takes the line for a detector will start
cutting `nothing` and `measured` out of correct sentences, which is entry 23's
failure mode with a number attached to it.

That is also why there is no blocklist here. Every word in the list is a word a
person writes. Entries 43 to 47 fire on the shape each family builds, and each
one carries an earned column because each family carries claims.

## Reproducing it

```bash
git clone --depth 1 https://github.com/louisabraham/load-bearing
python3 - <<'EOF'
import json, re
s = open('load-bearing/analysis.js').read()
d = json.loads(s[s.index('{'):s.rindex('}') + 1])
lead = set(d['components'][0]['word_list'][:150])
words = re.findall(r"[A-Za-z0-9/_-]*[A-Za-z][A-Za-z0-9/_-]*", open('DRAFT.md').read().lower())
print(100 * sum(w in lead for w in words) / len(words))
EOF
```

The list ships in `declaude_lint.py` as `CORPUS_LEAD`, so re-running that against
a fresh `analysis.js` is also how the list gets updated. The cluster is one fit's
answer, and load-bearing's own §5 says the seed moves the headline, so treat a
shifted list as a shifted sample and not a correction to this one.

## The top of the table

The two highest rows are this skill's own files: `references/register.md` at
3.17, this one at 2.65. Both are documents whose subject is the vocabulary, so
the result is expected, and it is also the demonstration. A rate reports where
the prose sits. Authorship and quality are outside what it measures.
