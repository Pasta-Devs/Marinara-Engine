# Opus 5 and Opus 5.5

The staging guidance below comes from Opus 5 samples; Opus 5.5 has not been
sampled for staging, so apply it as a prior. Clark et al. (arXiv 2610.29162)
measured both for compressed syntax: Opus 5.5 scored lower than Opus 5 on 19 of
21 comparisons, and both still overuse it relative to human text.

## Editing a draft this model wrote

Expect a clean lint report and a heavily staged draft. Do not let the report
shorten the pass: spend it on steps 2b, 3 and 4.

1. Read every header first. Rewrite each verdict into a label (entry 7). Expect
   most of them to be verdicts, some two sentences long: *A cache doesn't make
   things faster. It makes some things faster and everything else slower.*
2. Read the last sentence of every paragraph next. If it restates the paragraph
   as a maxim, delete it (entry 12): *Read-through caching is a p50 optimization
   sold as a latency optimization.* Keep it only if it states a fact the
   paragraph has not.
3. Split any sentence where `and` or `so` joins a fact to a generalisation of
   that fact (entry 39): *…a second system that can be slow in new ways, and your
   users only ever feel the slow ways.*
4. Cut significance designations the linter's noun list misses (entry 3): *the
   real fix*, *the actual heuristic*, *that was the trap*.
5. Keep every technical claim. The argument under the staging is usually sound;
   run `declaude_diff.py` to confirm the cuts removed none of it.

## Running the pass as this model

- After rewriting several instances of one flagged shape, check whether the
  rewrites all landed on the same new shape. Verdict headers rewritten into
  nominalized headers (entry 41) is the usual one.
- Leave a title that states what happened in plain words. It is already a
  label. Turning *Order dashboards undercounted a day's orders after a timezone
  change* into *dashboard undercount of one day's orders after a timezone
  change* swaps a sentence for a noun pile (entry 41).
- Re-read every sentence you rewrote against entry 2. Rewrites of a staged
  line tend to land on a reversal: *Finance found this problem; our monitoring
  never flagged it.* State the fact once: *No alert fired; finance found it.*
- Read your rewrite once against entries 43 to 47 alone. Your clean prose
  defaults to that register: `plainly`, `quietly`, `byte-identical`, `nothing`
  standing in for a search.
- Read the rewrite once against entries 53 to 56. A tighter sentence from you
  tends to drop *that* (*the others check behaviour the old code never
  reached*) or stack nouns in a parenthesis (*long error-message string
  literals*). Lengthen it.
- Lint the finished artifact, including your own annotations, summary and
  change list, not only the text you edited.
- If you also wrote the draft, run step 2b in a subagent or separate context.
  In PR #771 a pass by the drafting model let through six sentences the reader
  then flagged.

Evidence: `oaustegard/experiments` `model-register-drift/` (two samples, one
prompt) and claude-skills PRs #769, #771, #779.
