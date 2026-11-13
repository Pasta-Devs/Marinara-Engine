# Content preservation and staging rank

Why `declaude_diff.py` is lexical, why `declaude_rank.py` is a fitted direction
rather than a judge, and what each was measured on.

## The failure this exists for

A register pass has two destructive failures and they look identical from the
outside: the edit drops a claim, or it invents one. Both leave prose that reads
better than the original, which is why a read-through does not catch them. Three
real instances, from one pass over a published post on 2026-08-29:

| source | rewrite | what was lost |
|---|---|---|
| "the format that most invites staged reveals" | "invites staged reveals more than most formats do" | a ranking over all formats became a comparison against most of them |
| "Both are machine-written and only one is performing." | "Both are machine-written." | the section's finding |
| "That LLM judges are prompt-sensitive is old news." | "Prompt sensitivity in LLM judges is well documented." | nothing — register only, and the author's phrasing outranks the rule |

The editor caught all three on self-review. The regex scan reported none of them.

## Cosine similarity on the three cases

The obvious mechanical check is cosine similarity between source and rewrite:
low similarity means something changed. Measured on the three cases above with
`all-MiniLM-L6-v2`:

| case | cos(source, lossy) | cos(source, faithful) |
|---|---|---|
| ranking lost | **0.9396** | 0.9128 |
| finding lost | 0.5145 | — |
| register only, nothing lost | 0.8914 | — |

The lossy rewrite of case 1 scores **higher** than the faithful one. A threshold
that flagged case 3 at 0.8914 would pass case 1 at 0.9396, so the ordering is
inverted on exactly the pair that matters.

The reason is structural rather than a matter of picking a better model.
Paraphrase invariance is the property a sentence embedder is trained to have,
and dropping one ranking word is a paraphrase by that measure. Any encoder good
enough to be worth using is good enough to be blind here.

So `declaude_diff.py` checks set membership: numbers (digits and their spelled
forms), proper nouns, quoted strings, code and link targets by presence, and
superlative, scope, negation and hedge **constructions** by count. Constructions
rather than tokens, because case 1 keeps the token `most` and loses the ranking —
counting words misses it, and counting `the X that most VERBs` against
`more than most X` does not.

It guards claims, not voice. Case 3 is silent by design.

## Sentence shortlisting

Not documents, and not verdicts. One thing: shortlisting sentences.

The axis is the mean of `embed(was) - embed(now)` over the 41 matched
before/after pairs in `register.md` — same content on both sides, staging the
only variable, so the direction is not confounded with topic or genre.

**Fitted, sentence level.** Leave-one-out over the 41 pairs, scoring each held-out
`was` against its own `now`: **76%** correct, chance 50%.

**Transfer to a real pass.** On the pre-edit version of the post above, 53
sentences, 9 of which the editor went on to rewrite: the 9 land at ranks 3, 4, 7,
11, 13, 17, 21, 23, 37. Median rank **13 of 53** against a chance median of 26;
6 of the 9 in the top 20. Permutation test over 200,000 draws, p = **0.031**.

For contrast, the regex scan found 1 of those 9. The two sentences the axis
ranks first are ones the editor considered and deliberately kept, which is the
behaviour wanted from a shortlist: it finds the decision points and does not make
the decision.

One draft is one draft. This is a single case with 9 labelled sites, not a
validated instrument.

**Where it fails.** It cannot rank documents. Against the ten human-graded samples
in `oaustegard/experiments`, scoring each document by the mean of its top quartile
of sentences, Spearman against the judged staging strength is **-0.26, p = 0.46**.
A first attempt with a cruder axis — a centroid of `tests/sample-tics.md` against
human prose — scored **-0.10, p = 0.79**, which is what the paired construction
fixes, and why the pairs are worth curating.

The regex scan does no better at that job: **-0.37, p = 0.29** on the same ten,
and note the sign. Its rate runs *opposite* to staging, because it measures the
flat lexical tells and the samples that carry those are the ones that stage
least. The two scores are measuring different things, which is the same result
the judged experiment found between its two question phrasings.

No document-level number is offered by `declaude_rank.py` for this reason.

## Fitted axis against a model judge

A judge takes a prompt, and two defensible phrasings of one judging question
ranked the same ten texts at **-0.50** to each other while two different judge
models on one fixed question agreed at **+0.66**. The question is a larger source
of variance than the model. A fitted axis has no question to phrase, no sampling
temperature, and no API key, so the same draft scores the same today and in six
months.

That is the whole of its advantage. It is worse than a model at judging, and it
is not asked to judge.

## Reproducing

```sh
python3 scripts/declaude_rank.py --fit          # refits from register.md, prints leave-one-out
python3 scripts/declaude_diff.py A.md B.md      # stdlib only
```

Adding entries with before/after pairs to `register.md` changes the axis. Refit
and check the leave-one-out number did not fall before committing the new
`assets/staging-axis.json`.
