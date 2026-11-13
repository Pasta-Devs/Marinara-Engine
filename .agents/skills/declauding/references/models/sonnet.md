# Sonnet 4.6 and Sonnet 5

## Editing a draft Sonnet wrote

1. Work through the linter's `em-dash` and `negation-first` flags first; on
   Sonnet 5 they carry most of the pass. Rewrite the reversal as a plain
   statement (entry 2): *The cache wasn't broken — it was doing exactly what we
   asked it to do.* Apply the entry-16 dash guard unless the author's sample
   uses dashes at that rate.
2. On Sonnet 4.6, merge fragment runs into sentences (entry 15): *The p50
   improved. The p99 got demolished.* Cut subjectless asides (entry 35):
   *Straightforward stuff.*
3. Read the closers; both versions end some paragraphs on a verdict (entry 12).

## Running the pass as Sonnet, or delegating it to Sonnet

Sonnet cuts the evidence along with the framing: "5,697-line gather cut at line
120" became "thousands of lines" in the PR #791 audit.

- Run `declaude_diff.py` on every draft, however short, and restore each `LOST`
  number, date or command value.
- In a delegate's brief, state that dates, measured numbers and copy-pasteable
  values stay even when the sentence around them is cut.
- Review every edit that is mostly deletion before accepting it.

Evidence: `oaustegard/experiments` `model-register-drift/` (three samples, one
prompt) and claude-skills PR #791.
