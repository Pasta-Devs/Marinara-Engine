# Annotated mode

One self-contained HTML file: the rewritten text, every changed passage marked,
each with the original verbatim, the tic name, and why. A button toggles the
marks off so the result reads as prose.

Build it from `assets/annotated.template.html` — substitute `{{TITLE}}`,
`{{SUBTITLE}}`, `{{TALLY_ROWS}}` and `{{BODY}}`. No build step, no CDN, no
dependencies. It opens from a file:// URL and survives being emailed.

## Markup

Changed passage, inline:

```html
<span class="chg">the rewritten text</span>
```

Its note, immediately after the containing paragraph or list item:

```html
<aside class="ed"><b>tic name</b> was: <q>the original, verbatim</q> —
why this instance is a tic.</aside>
```

Kept passage worth marking:

```html
<aside class="ed ok"><b>kept</b> Why this one works.</aside>
```

Section left alone entirely:

```html
<p class="unedited">Credit section: unchanged.</p>
```

`body.clean` hides `.ed`, `.unedited` and the `.chg` highlight. The toggle sets
it. Nothing else depends on it.

## The tally

Head the document with a table of tic categories, counts, and a one-line
description of each shape. `{{TALLY_ROWS}}` takes `<tr><td>name</td><td>n</td>
<td>shape</td></tr>`. Order by count descending.

Count honestly. If 34 passages carry 45 instances because several stack, say
both numbers. Inflated counts are the tic this skill exists to remove, applied
to its own output.

## Writing the notes

**Quote the original verbatim.** An edit the reader cannot check is an
assertion. Where a passage carried several tics, quote all of the original and
write one note that names each.

**Name the tic from the register's vocabulary.** The reader should finish with
a vocabulary, not forty unrelated opinions.

**Say why this instance is a tic.** Explaining the category teaches nothing. *The reader never proposed the wrong answer* is a general
truth. *The previous paragraph proposed quantization, so this contrast is
earned* is a note about the text in front of you.

**Note the earned exceptions where they survive.** When a negation or a short
closer stays in, mark it and say what made it legitimate. The contrast between
a kept instance and a cut instance of the same shape teaches the rule better
than either alone.

**Bundle stacked tics.** One note per passage. Splitting a sentence into four
notes inflates the count and fragments the reading.

**Report contradictions in their own note, marked.** Use `<aside class="ed
flag"><b>factual</b> …</aside>`. Do not fix them in the rewrite, since only the
author can say which version is true.

## Structure of the page

1. Toolbar with the toggle and the passage count.
2. How to read this — two short paragraphs.
3. The tally table.
4. A one-line statement of the root pattern.
5. The rewritten piece with its notes.

Keep 1–4 under a screen. The document is the artifact; the preamble is
navigation.

## Fidelity

Reproduce tables, code blocks, numbers and commands unchanged, or replace them
with a `<p class="unedited">` line saying so. Never retype data. A transcription
error in an editing artifact destroys its credibility, and the numbers are the
one thing a register pass has no business touching.
