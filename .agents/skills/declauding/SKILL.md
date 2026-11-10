---
name: declauding
description: Load at the start of any task whose deliverable is prose another person will read — a PR description, commit message, README, doc, postmortem, blog post, issue or review comment, report, release note or essay — before drafting it, whether the result is pushed, posted, published or saved to a file, without being asked. Draft, then run this pass on the draft before handing it over. Also use when someone says "de-claude", "de-slop", "humanize this", "this reads like AI", "make it sound human", or asks for a voice, tone or register edit. Rewrites the constructions that mark prose as model-written (staged reveals, verdict headers, aphoristic closers, "it's not X, it's Y", em-dash drama, forced triads, flat-certainty adverbs, noun stacks, dropped 'that') into plain technical prose and checks the rewrite kept every claim. Not for fiction, poetry, code, or quoted text; for a full adversarial review of a deliverable use challenging.
metadata:
  version: 0.13.0
---

# Declauding

Turn LLM-shaped prose into prose a human technical writer would have written.

Two output modes:
- **clean** (default) — the rewritten text, nothing else.
- **annotated** — a single-file HTML artifact: rewritten text, every changed
  passage marked, each with the original, the tic name, and why it goes. A
  toggle hides the marks so the result can be read straight through.

Three ways it gets called, which change what you deliver:
- **Pasted text** (default) — the user gives text in the conversation. Return
  the rewrite, plus a short list of what changed if the edit was substantial.
- **File** — the user points at a path. Rewrite the file in place and report a
  summary in the conversation rather than pasting the whole result back. Edit
  prose only: leave code blocks, frontmatter, data, link targets and quoted
  specimens alone.
- **Embedded** — another skill or agent is calling this as one step of a larger
  job (a PR description, a commit message, a doc). Return the final text and
  nothing else. No preamble, no summary, no tic list.

## Do not invent specifics

The rewrite must not contain a fact, name, number, date, quote or citation that
is not in the source. This is the failure mode the skill invites rather than
prevents: the fix for a vague sentence is a specific one, and the specific has
to come from the source or from the author.

*Experts believe it plays a crucial role* becomes *the sources here do not say
who studies it*, or gets cut. It does not become *researchers at Lanzhou
University* unless the source says so. When a sentence needs real-world detail
to work, ask for it or write the plain version without it.

Opinions and stance count as voice rather than fact. Keeping the author's
judgment is required (see Overcorrection); adding a factual claim they did not
make is a defect even when the result reads more human.

## The one pattern

Almost every tic in `references/register.md` is a version of the same move:
**the sentence is built to make the reader feel a finding arrive, instead of
stating the finding.**

The generative test, applied per sentence: *am I saying the thing, or
performing having had the thought?* Say the thing.

The register has four families. Read the one the draft needs first.

| Entries | Family | Mechanism |
|---|---|---|
| 1–23, 37–42 | Staging | The sentence performs a finding arriving: reveals, verdict headers, aphoristic closers, welded epigrams |
| 24–36 | Encyclopedic and chatbot | Nothing is staged; the writing runs on defaults: copula avoidance, participle tails, forced triads, chatbot residue |
| 43–47 | Flat certainty | This skill's own output. An adverb, compound or absolute negative stands in for evidence: `plainly`, `quietly`, `refusal`, `re-derived`, `byte-identical`, `nothing` |
| 48–52 | Confiding essayist | Staging aimed at the reader's trust: announced honesty, stranded auxiliaries, obituary headlines. From Simon Willison's [llm-cliche-highlighter](https://github.com/simonw/tools/blob/main/llm-cliche-highlighter.html), updated 2026-08-27 |
| 53–56 | Compressed syntax | Nothing is staged; a claim is packed into fewer words than a reader can parse: noun stacks, verbed nouns, dropped *that*, a subject waiting behind a list for its verb. The fix makes the sentence longer. From [arXiv 2610.29162](https://arxiv.org/abs/2610.29162) |

The flat-certainty register is where a clean pass lands, and it is now the
fastest-growing cluster of GitHub pull request descriptions: 0.70% of early
2025, 39.5% of August 2026 (`references/corpus.md`). Its test is the same one
turned over: *am I stating the finding, or performing having settled it?* The
fix is never to put the staging back. It is to check that the adverb, compound
or negative carries evidence.

## Model profiles

When you know which model wrote the draft, read its file in
`references/models/` before step 2. When you know which model you are, read your
own file too. Each file has two sections: what to look for in that model's
drafts, and what to check in your own rewrite when you are that model.

| Model | File | Where its tics sit |
|---|---|---|
| Opus 5, Opus 5.5 | `models/opus-5.md` | Headers and paragraph closers; the linter misses most of them |
| Opus 4.6, 4.8 | `models/opus-4.md` | Closers, em dashes, one metaphor reused across paragraphs |
| Sonnet 4.6, 5 | `models/sonnet.md` | Em dashes and negation-first reversals |
| Haiku 4.5 | `models/haiku.md` | The encyclopedic family; the linter catches most of it |
| Sonnet 5.5, Haiku 5.5 | not yet profiled | Use the same tier's file as a prior and expect drift |
| Fable 5.1 | `models/fable.md` | Bolded list leads and takeaways |

When Claude is cleaning its own draft, one file covers both sections; run step
2b in a subagent or separate context. When the author is unknown or human, skip
the profiles.

On any model's draft, check the opening for a contents-list standfirst (entry
42): *here's what happened, and what we should have measured*.

## Author's writing sample

If the user supplies a sample of their writing, read it before editing and match
its habits: sentence lengths, paragraph openings, punctuation, recurring
phrases, vocabulary level. Do not upgrade casual words, regularize deliberate
quirks, or apply a register rule the sample contradicts.

The sample wins over every rule here, including the em-dash density guard in
entry 16. If the author uses em dashes at three per hundred words, that is their
voice, and scrubbing the tell would make the text less like them and no more
human. The same holds for their existing published work when it is available and
the current draft is not.

## Workflow

Script paths below are relative to this skill's directory. From any other
working directory, prefix them with `/mnt/skills/user/declauding/`.

**1. Read the whole piece before editing anything.** Tics carry factual errors.
A sentence written to sound important is disproportionately likely to be wrong,
because it was built for shape rather than for accuracy. Designations of the form
*the X that answers the real question* frequently designate the wrong X, and the
draft itself often contradicts them a paragraph later. Note contradictions now;
they are the most valuable thing this pass produces.

**1a. Find the point before fixing sentences.** Write, in one sentence of your
own, the thing the draft wants the reader to come away knowing. If you cannot,
or the draft spends most of its length on material that does not bear on that
sentence, the problem is above the sentence level and the sentence pass will not
fix it: every sentence can be locally fine while the piece says little, which is
why readers of model drafts report reaching the end of a page and not knowing
what it said. In that case, say so, get the point from the author when it is
theirs to supply, write that sentence first, and rebuild from it, keeping only
the material that supports it. Rewriting from the point is cheaper than
sentence-by-sentence repair on a draft like this, and is what editors of model
prose report doing anyway. On a draft whose point is clear, this step takes one
sentence and moves on. Hand the stated point to step 4a's reader as well: the
newcomer read checks that a reader who does not share your context can find it.

**2. Run the mechanical scan.**

```
python3 scripts/declaude_lint.py DRAFT.md
python3 scripts/declaude_lint.py DRAFT.html               # HTML is flattened automatically
python3 scripts/declaude_lint.py DRAFT.md --skip-quoted   # if the draft quotes bad prose
```

It flags greppable tells with line numbers and categories, plus four shapes that
are not lexical: forced triads in both their comma-list and anaphora forms,
one-line-paragraph beats, fragment runs, and constructions the document uses more
than once. The `reuse` block is the cheapest signal it produces, because a
construction used twice is a habit and counting is free.

It has no judgment. Everything it flags still needs the sentence-level test, it
reaches roughly two thirds of what a careful pass finds, and the third it misses
is the expensive third: staged paragraph shape, staged closers, dressed metaphor,
and every earned exception. Step 2b takes part of that third; the rest is yours.
Treat a clean report as meaningless on its own, and expect one on Opus 5
drafts, which stage heavily in shapes the scan cannot see.

Use `--skip-quoted` on any draft that quotes bad prose as a specimen. Without it
the scan reports the draft's own examples, which is how a real pass loses time.

HTML input is flattened before scanning: `<h1>`–`<h6>` become headings so the
header rules see them, and a `.subtitle`, `.eyebrow` or `.post-meta` element is
treated as a heading too, because a subtitle is a header by every test that
matters. Force with `--html`, disable with `--no-html`. Reported line numbers
refer to the flattened view.

The `corpus-register` density line locates a register. It does not detect an
author. Above roughly 1.0 per 100 words the draft sits in the cluster's register,
and a person who chooses that register scores there too, so the line is a cue to
read entries 43 to 47 and never a licence to cut `nothing` or `measured` on
sight. `references/corpus.md` has the figures.

Lint every string that reaches the reader, not only the body file. Page titles,
subtitles and deck headers are prose, and a builder that takes them as CLI
arguments rather than from the file will hide them from this scan.

**2a. Optionally, rank the sentences.**

```
python3 scripts/declaude_rank.py DRAFT.md --top 15
```

Sorts sentences by how staged they look, using a fitted direction in embedding
space (the mean of `embed(was) - embed(now)` over the register's before/after
pairs). It shortlists and decides nothing. On the one pass it was measured
against it ranked all nine edited sentences at a median of 13 of 53, where the
regex scan had found one of the nine. It cannot score documents. Needs torch and
transformers; every other stage is standard library. `references/preservation.md`
has the numbers.

**2b. Run the structural review.**

```
python3 scripts/declaude_review.py DRAFT.md
```

This is the third the scan cannot reach. It extracts the slots regex cannot
judge — every header, the opening sentence, each closing sentence, isolated
one-sentence paragraphs — and sends only those to a model with the structural
entries from `references/register.md`. Slots rather than the whole document,
because the payload stays small enough to run on every draft. Use
`--emit-prompt` where no API key is available, `--slots` to see the extraction
alone.

The two stages do not subsume each other. Stage 1 finds the flat verdict header
deterministically and over-flags commas, including the ones that belong to a
citation. Stage 2 reads a comma in context and finds the aphoristic closer, which
no regex reaches. Run both.

Run stage 2 in a context that did not write the draft. A model reviewing its own
prose is the actor that chose the words. With `--emit-prompt`: if you did not
write the draft, answer the prompt yourself; if you did, hand it to a subagent.
If you wrote it and cannot spawn one, answer it anyway and say in your report
that the review was not independent.

For a full-document register review against a named voice signature — positive
markers, drift across the piece, imposter test — use the `challenging` skill's
`prose-register` profile instead. This script is the cheap pass; that one is the
thorough one.

**3. Sentence pass.** For every sentence, in order: stating or staging? Load
`references/register.md` for the catalogue of tells and their fixes, and
`references/exceptions.md` before deleting any flagged shape — it lists when
each shape carries a claim. Start with the family the draft needs: the author
model's profile names it; on a draft this skill or another model already
cleaned, read 43 to 47 first; on a personal essay, a launch post, or anything
addressed to the reader as a confidant, read 48 to 52 first; on a chat reply or a
coding-session report, read 53 to 56 first.

**4. Structure pass.** Headers (are they labels or verdicts?), paragraph breaks
(is an isolated line a real pivot or a drum roll?), fragment runs, rhetorical
questions, and the closer (does the last paragraph paraphrase the subtext of
what preceded it? delete it).

**4a. Newcomer read, when the draft describes something that just changed.**
Run this step on a README, doc, page or results section written or revised right
after a change to the thing it describes. The failure it catches: text that
leans on a version the reader never saw, because it was written with the
change in mind. No sentence-level pass sees it. A bad example: a game's
start-screen step reading *pick your options here, upright*, written after the
options moved off a sideways screen. *Here* and *upright* only mean something
to a reader who saw that screen; the step a newcomer needs is *lock rotation in
portrait, then choose your options below*. The same failure shows as a README
that explains how a bug was fixed where the reader needs to know how the
feature behaves, or as one section updated while another still describes the
old behaviour. Words like *now* and *no longer* are rarely present, and
automatic judges missed it (`references/fresh-eyes.md`). A reader who never
saw the old version catches it. You cannot be that reader for your own text, so
hand the text to one:

```
python3 scripts/fresh_eyes.py packet README.md docs/setup.md
```

Pass every reader-facing file the work touched. The script writes the packet, a
single Markdown file holding those files' text as it stands (Markdown whole,
visible text only for HTML), and prints its path and a prompt. Send the prompt
verbatim to a subagent that has not seen this conversation; the subagent reads
the packet from disk and lists what a newcomer would stumble on, section by
section. Fix each point or say why it stands; the step is done when a read of
the final text comes back with nothing you have not answered. Where no
subagent tool exists, read the packet yourself top to bottom, with nothing else
open, list every phrase that leans on something the packet never says, and
report that the read was not independent.

When this skill is installed as a plugin, a Stop hook enforces the step: a turn
that changed visible prose in a `.md` or `.html` file cannot end until a
subagent has been sent that prompt after the last edit to those files. It skips
changelogs, Log sections, generated pages and edits under 20 characters of
prose, and logs each run to `~/.claude/fresh-eyes-log.jsonl`, which shows
whether the hook runs in a given environment.

**5. Check what the edit did.**

```
python3 scripts/declaude_diff.py SOURCE.md REWRITE.md
python3 scripts/declaude_diff.py --git path/to/draft.html --ref HEAD
```

Run this before reporting the pass done. It compares source against rewrite for
numbers, names, quotations, code and link targets by presence, and for
superlative, scope, negation and hedge constructions by count, and reports what
the edit lost and what it invented. Constructions rather than tokens, because
rewriting "the format that most invites staged reveals" as "more than most
formats do" keeps the word and drops the ranking.

An embedding similarity does not substitute for it: on the three real cases in
`references/preservation.md` the lossy rewrite scores *higher* cosine to the
source than the faithful one. Paraphrase invariance is what an encoder is trained
for, and dropping a ranking word is a paraphrase by that measure.

The script guards claims and not voice, and a finding is a question rather than a
verdict — a rephrasing it cannot see through takes a `--waive`. Four failure
modes, all of them common:
- Content lost. Ask it as a question and answer it claim by claim, not paragraph
  by paragraph: *does the rewrite drop a claim the source made?* A dropped
  superlative leaves the paragraph looking intact, which is why the
  read-through misses it. Every fact, number, caveat and hedge-with-content must
  survive; a tic wrapping a real qualification is still a real qualification.
  See Earned exceptions for what hides inside a watched phrase. Structure is
  free — merge or split paragraphs, compress the dull parts, dwell where the
  author would. When keeping the information and mirroring the original's shape
  pull against each other, the information wins.
- Claims changed. Rewriting "the drop is largest where chains are longest" into
  "long chains cause the drop" is an edit that invents a finding. Register only.
- Facts invented. Ask it directly: does the rewrite state any name, number, date
  or citation that is not in the source? See "Do not invent specifics" above.
- Mush. See Overcorrection below.

**6. Report factual problems separately.** Never silently fix a contradiction
found while editing. The author needs to know their draft disagreed with
itself, and only they can say which version is true.

## Overcorrection

The failure mode of this skill is prose stripped of confidence, rhythm and
personality until every sentence is the same length and the writer has no
opinions. That is worse than the tics.

- Shorter is not plainer. A rewrite that cuts staging tends to compress what is
  left: three nouns stacked where a phrase stood, *that* dropped from a long
  clause, a noun pressed into service as a verb. If the rewrite is shorter and
  takes longer to parse, it is worse. Entries 53 to 56.
- Flat is not hedged. "Class imbalance breaks the metric before overfitting
  does" is flat *and* certain. Target plain-and-sure, never plain-and-timid.
- Do not delete first-person judgment. "I did not expect the overlap to survive
  a 3x range in bits per weight" is exactly right — specific, falsifiable,
  personal. Human technical writers state preferences and surprise directly.
- Do not enforce uniform sentence length. Short for facts, compound for
  dependencies and caveats. Variation carries information; monotony is its own
  tell.
- Do not delete metaphor. Delete metaphor that is *doing significance work*
  where a plain noun fits. A metaphor that is the clearest available description
  stays.
- Digression, asides and mild informality are human. Symmetry, antithesis and
  balanced parallel clauses are not.

## Leave these alone

These are evidence of a person writing. Editing them out is how a register pass
makes a draft worse, and each one is easier to destroy than to put back.

- **Specific, hard-to-fabricate detail.** A street name, an odd quote, "the guy
  who used to run the build before he left". Models round specifics off; people
  hoard them.
- **Mixed feelings and unresolved tension.** *I think this is mostly right and it
  still bothers me and I cannot say why.* Clean takes are the model default.
- **Genuine self-interruption.** A parenthesis that corrects the sentence it sits
  in, an aside that goes nowhere. Models rarely interrupt themselves.
- **Repetition of a word** where a synonym would be worse. That is entry 27 read
  in the right direction.
- **Uneven depth.** Three paragraphs on the part the author cares about and one
  line on the part they do not is how people write.
- **Dated and subcultural references.** Slang or in-jokes pinned to a year.

Things that are not tells on their own, and should not be edited on their own:
polished grammar, formal vocabulary, a mixed casual-and-formal register, curly
quotes, a single em dash, one short emphatic sentence, an unsourced claim, a
salutation or sign-off. Look for **clusters**. One em dash is punctuation; em
dashes plus a forced triad plus *vibrant tapestry* plus a Conclusion section is a
confession.

Do not edit a watched phrase inside a quotation, a title, a proper name, or an
example where the phrase is being discussed rather than used. The linter's
`--skip-quoted` does this mechanically; do it by eye too.

## Earned exceptions

Every entry fires on a shape, and a shape sometimes carries a claim. Cutting it
then removes content while looking like it removed only style, and the result
reads fluently, so a read-through does not catch it. `references/exceptions.md`
has a banned-when and earned-when row for each shape; check the row before
deleting. Two common cases: "X rather than Y" is earned when the reader was
already holding Y, and a short closer is earned when it states a fact
("Default retries are back to 3.") rather than a moral.

**Modifiers inside a watched phrase carry content.** "The single most important
new build" ranks that item against every other item; "the important new build"
ranks nothing. "Simultaneously X, Y and Z" claims the three hold at once; "X, Y
and Z" does not. Superlatives, rankings, simultaneity, scope words, and the
condition attached to a hedge all live inside phrasings this skill cuts.

## Annotated mode

Read `references/annotating.md`. It specifies the artifact: markup for changed
spans and edit notes, the toggle, the tic-tally table, and how to handle
passages deliberately left alone.

Rules that make the annotation useful rather than decorative:
- Quote the original verbatim in every note. An edit the reader cannot check is
  an assertion.
- Name the tic using the register's vocabulary so the reader accumulates a
  vocabulary rather than 40 unrelated opinions.
- Say why *this instance* is a tic. Explaining the category teaches nothing
  about the text in front of the reader.
- Mark what was kept and why. A pass that only flags failures teaches avoidance.
- Bundle stacked tics into one note per passage. Do not split a sentence into
  four notes to inflate the count.

## Calibration

When a draft's register is genuinely unclear, read real prose in the target
genre before editing — the author's own earlier writing, or a well-known human
writer in that domain. Human technical prose runs on, digresses, states
preferences without justifying them, and repeats a word rather than reaching for
elegant variation. Its sentences vary because the thoughts vary.

## Scope

Applies to: blog posts, READMEs, PR and commit descriptions, reports,
documentation, essays, release notes, technical explainers.

Do not apply to: fiction and poetry (different register entirely), direct
quotations, other people's text being quoted, marketing copy where the client
wants the staging, or anything where the "tic" is the author's established
voice. Ask before running this on someone else's writing rather than a draft.

## Extending

The register is a working document, not a standard. Adding to it:

1. Add the specimen to `tests/sample-tics.md`, verbatim from real prose.
2. Add a register entry: tell, why, fix, and the real before/after. Entries
   without a before/after get argued about instead of applied.
3. If the tell is lexical, add a rule to `scripts/declaude_lint.py` and confirm
   `tests/sample-clean.md` still reports zero. That file is human-written prose;
   a rule that fires on it is a bad rule, and the false-positive budget is the
   thing that keeps the linter worth running.
4. Bump `metadata.version`.

To add a model profile, sample that model with no voice instruction and score
it as `oaustegard/experiments` `model-register-drift/` did. Write the file as
instructions: where to look, what to cut, with one specimen per rule. Leave the
scores in the experiment; the file gets one evidence line. Add a row to the
Model profiles table.

Promote a phrase to its own register entry only after it appears twice in real
drafts. Reuse is the strongest evidence that a construction is a habit rather
than a choice, and a register that grows on single sightings becomes a phrase
blocklist that misses the next paraphrase.
