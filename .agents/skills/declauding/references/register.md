# The register

Every entry: the **tell** (surface pattern to scan for), why it is a tic, the
**fix**, and a real before/after. Entries are grouped by mechanism because the
lexical bans always leak — new phrasings arrive faster than a phrase list grows.
Scan at the sentence level, not the phrase level.

---

## 1. Staged reveal (the root)

A sentence is **staged** when it withholds, contrasts, or significance-tags to
manufacture a beat. It is **stated** when it lands content in subject-verb-object.
Most entries below are special cases of this one.

Generative test, per sentence: *stating or staging?*

---

## 2. Negation-first reveal

**Tell:** says what something is NOT before saying what it is — "It's not that X,
it's that Y", "The problem wasn't A. It was B.", "not because P — because Q",
"X, not Y" as a closer, "doesn't just X, it Y's".

**Why:** the reader never proposed the wrong answer. You supplied it so you could
knock it down, which converts a plain fact into a small drama in which you are
right.

**Fix:** state what it is. If the contrast is genuinely informative, keep it in
one clause.

> was: *It is not a wrong answer. It is a non-answer. Counting it as a failure is
> the conservative choice, and it is what these numbers do.*
> now: *It is a non-answer rather than a wrong answer, and these numbers count it
> as a failure, which is the conservative choice.*

**Earned when** the reader was actually holding the wrong answer — the previous
paragraph proposed it, or it is the obvious default in the field. Then the
negation does work.

---

## 3. Significance designation

**Tell:** "the real X", "the actual question", "the part that matters", "the part
that transfers", "the useful question", "the detail that makes the point", "the
most interesting number", "the one thing nobody said", "here's the thing", "and
that's the interesting part", "and it has a name here". Also the staged variants
of the same gesture: "here's the twist / the catch / the kicker / the rub",
"that's the part", "the part that makes me trust the rest", "my favourite part
of".

**Why:** it ranks your own sentences for the reader instead of writing a sentence
worth ranking first. The reader decides what is interesting.

**Fix:** delete the designation and state the content. If the content cannot
carry itself, the problem is the content.

> was: *Nobody had checked whether it could still think. It is the leg that
> answers the actual question.*
> now: *Earlier testing measured its size and not its accuracy, so this run is
> the first accuracy number for it.*

**Watch for reuse.** Emphasis is a budget. The same designation twice in one
piece ("the part that matters" / "the part that transfers") is no longer
emphasis, and reuse is the easiest instance to catch. `declaude_lint.py` groups
its own hits and reports a `reuse` block for any construction used twice, so this
one costs nothing to check.

---

## 4. Abstraction agency

**Tell:** a non-agent in the subject slot doing something — "the table shows it",
"the median hides it", "the data tells us", "the failure modes live in different
places", "the metric lies", "quantization is a concern", "truncation cuts
compute", "the tool is about to discover", "the joke does the work an argument
would have to".

**Why:** nothing in the sentence has hands. Nominalized verbs and inanimate
objects get the subject slot, and the actual actor disappears.

**Fix:** put a real agent in subject position — a person, a named artifact, a
concrete thing — and let the verb be a verb.

> was: *Median hides it: the middle of every distribution is similar.*
> now: *The middle of every distribution is similar.*

> was: *Truncation cuts compute natively.*
> now: *A shorter vector is a shorter dot product.*

The commonest form in model chat and code reports is an inanimate subject on a
verb that needs a mind or a body: *bites*, *swallows*, *promises*, *forgets*,
*expects*, *asks*, *misunderstands*. Clark et al. (arXiv 2610.29162) found every
frontier model they tested using it more than people do in the same genre.
Readers use animacy to parse, so the mismatch costs a second look, and the verb
usually stands in for a longer plain phrase (*bites* for *causes a problem*).

> was: *The docstring promises they're skipped when they "appear anywhere in
> the source_dir path".* (Fable 5)
> now: *According to the docstring, they're skipped when they "appear anywhere
> in the source_dir path".*

Conventional uses are earned: *the function expects an int*, *the table shows*
in a caption. The test is whether a reader in the field has seen the pairing
before.

---

## 5. Deferred noun

**Tell:** a placeholder where the noun belongs — "One thing is not flat", "The
sixth is not", "There was just one problem", "That is the variable...", "What X
means" — when the actual noun and number were available.

**Why:** points at the content instead of writing it, forcing the reader down a
line to collect what could have been in the subject slot.

**Fix:** name it, with its number.

> was: *Five of those six rows are one cluster. The sixth is not.*
> now: *Five legs pass 77 to 81 of the 92 and exhaust 6 to 9. fit-17g passes 62
> and exhausts 21.*

---

## 6. Structural-metaphor locator

**Tell:** "the seam where...", "the hinge", "the joint", "the fault line", "the
leg that...", "the place where it breaks down", "X is doing the work that Y
would".

**Why:** makes an ordinary observation sound like architecture you uncovered.
Usually stacks with abstraction agency.

**Fix:** name the plain mechanism.

> was: *It's the seam where the laugh is doing the work an argument would have to.*
> now: *The piece never engages the bull case; the joke covers the gap.*

---

## 7. Coy and thesis-shaped headers

**Tell:** a header that states a verdict ("The default was wrong", "The one gap
that does clear the bar") or hides its contents ("What 'exhausted' means", "What
the data actually shows", "Why it matters"). Also any comma in a header — an
appositive, participle or relative clause ("The obvious follow-up, measured";
"The catch, which is not small").

**Why:** headers are navigation. A header that could top three different sections
is a thesis, not a label. No real person puts sentence clauses in a headline.

**Fix:** name the content as a flat noun phrase. Or, if the definition is the
point, make the header the definition.

> was: *What "exhausted" means* → now: *Exhausted cases*
> was: *The one gap that does clear the bar* → now: *The 2.876-bit gap*

**Test:** read the header alone, as a table-of-contents entry. Does it tell you
what is in the section?

---

## 8. Suspense construction

**Tell:** a paragraph ending on a colon that introduces the culprit on the next
line; a sentence that withholds the noun to force a break; "1, 2, and then 3 —
the killer"; "Then the part that almost killed it."; "But here's where it gets
interesting."

**Why:** suspense is a fiction technique. In technical writing it costs the
reader time to buy the writer a beat.

**Fix:** state the finding when you have it.

---

## 9. Drama line break

**Tell:** a single sentence alone on its own line as a gravitas beat — "It isn't.",
"That is not a result.", "And then everything broke."

**Why:** whitespace is being used as a drum roll.

**Fix:** put the sentence back in its paragraph. **Earned** for a real pivot: new
actor, category shift, time jump.

---

## 10. Rhetorical question plus fragment answer

**Tell:** "So how does it fail?" / "Mostly by not finishing." — asking the reader
something in order to answer it yourself.

**Why:** two beats where none are needed, and it stages the writer as a guide
walking the reader through a discovery.

**Fix:** one declarative. *"fit-17g fails mostly by not finishing."*

**Two in a row is the same tic amplified.** *Do I know how it works? Where it
breaks? Which corners it cut?* — the second and third are fragments riding on
the first, and none of them is asked of anyone. The linter reports runs of
consecutive questions separately from the single standalone one, because a run
does not need the fragment answer to be the tic. An interview transcript and a
FAQ are the earned cases.

---

## 11. Straw-man knockdown

**Tell:** quoting a wrong reading attributed to the reader, then rejecting it —
*"It thinks twice as long" is the obvious reading of that, and it is wrong.*

**Why:** entry 2's negation-first shape with an invented interlocutor supplying
the negated half. The correction is the same length without them. (This sentence
used to read "the negation-first shape wearing a costume", which is entry 37.)

**Fix:** give the correction directly. *"That median does not mean it thinks twice
as long. On the questions it finishes..."*

---

## 12. Aphoristic closer

**Tell:** a final sentence that compresses the paragraph into a contrast, moral,
or quotable line — "It is the kind of number that looks like evidence and is
not", "The bridge was the move, not novel math", "Verifier > judge by a wide
margin", "the failure that looks like diligence", "X is the load-bearing part".

**Why:** it restates what the paragraph already established, in a shape built to
be quoted. It also grades your own argument.

**Fix:** delete it. If the paragraph needs it, the paragraph is not working.
Where a landing is genuinely wanted, land on a fact: *"Default retries are back
to 3."*

---

## 13. Self-grading

**Tell:** "earned, not asserted", "this isn't just X, it's genuinely Y", "to be
clear, this is rigorous because", "That is what the data shows", "That
distinction changes what you would predict", "not a relabel", "worth noting", "a
distinction worth keeping separate".

**Why:** narrates the epistemic status of your own reasoning instead of reasoning.
If the point is earned, the reader can see it.

**Fix:** make the point and stop.

---

## 14. Performed humility

**Tell:** "Their phrasing for it is better than mine", "This might be a small
thing, but", "I'm not sure this is worth writing up, but", "Probably nobody cares,
but", "classic me".

**Why:** a bow. It asks for credit for modesty and weakens the piece.

**Fix:** if it is worth publishing, publish it straight. Attribution without
ranking: *"from a conversation with X"*.

---

## 15. Staccato fragment cadence

**Tell:** three or more fragments in series for rhythm — *Six legs. One GPU, one
server build, one sampler, one question set.* — or parallel fragment pairs, *Most
questions it handles at a normal length. A subset runs away and hits the wall.*

**Why:** rhythm engineering. The content is a list; the drumbeat is decoration.

**Fix:** one sentence. *"Six legs, all on the same GPU with the same server build,
sampler and question set."*

---

## 16. Em-dash gotcha

**Tell:** a clause after an em-dash that delivers the punch, especially at the end
of a paragraph.

**Why:** the dash stages the beat. Em-dashes for genuine inline asides are fine
and human; the tic is the dash-as-drum-roll.

**Fix:** if the clause is the point, make it the sentence. Also: count em-dashes.
More than roughly one per 150 words reads as machine-written regardless of what
each one is doing. The linter reports the density and, separately, each dash
whose clause runs to the end of its sentence, which is the drum-roll shape rather
than the aside.

**Demotion test:** replace the dashes with commas. An aside survives it. A beat
does not, because the beat was the punctuation.

---

## 17. Throat-clearing and process narration

**Tell:** "I want to talk about", "In this post, I'll cover", "Let me explain",
"First, some background", "Before I get into it", "Let me consult my memories",
"Storing this before I answer", "First I'll X, then Y".

**Why:** preamble wearing a competence badge. The reader sees the result, not the
procedure.

**Fix:** start where you would start with no preamble budget.

---

## 18. RTFM as revelation

**Tell:** "It turns out that", bare sentence-initial "Turns out", "I finally
discovered", "Hidden in the API",
"Buried in the docs" — followed by standard documented behaviour.

**Fix:** if the finding is that you missed something obvious, say that.

---

## 19. Generic-developer vocabulary

**Tell:** footgun, shot itself in the foot, almost killed it, fell apart, rabbit
hole, yak shaving, belt-and-suspenders, load-bearing (as metaphor), moving the
needle, first-class citizen, under the hood, magic, just works, sane defaults,
batteries included, zero config, small enough to fit in your head.

**Why:** the writer reached for the easy phrase instead of the accurate one. The
accurate phrase is usually shorter.

---

## 20. Slop vocabulary

**Tell:** delve, tapestry, testament to, navigate the complexities, in today's
fast-paced, it's important to note, landscape (figurative), realm, robust,
seamless, leverage (as verb), utilize, crucial, pivotal, myriad, plethora, elevate,
unlock, harness, embark, dive deep, at the end of the day, that said.

**Why:** these do not signal a tic so much as an absence of choice. Replace with
the specific word.

---

## 21. Sanitized quotes

**Tell:** reported speech where the verb is "expressed", "indicated", "voiced
concern about".

**Fix:** if they said "WTF", write "WTF".

---

## 22. Time-scale inflation

**Tell:** vague durations on recent work — "a month ago", "for a long time", "all
year", "recently", "yesterday" — when the real timeline is hours or days.

**Fix:** check the timestamp, or drop the time framing. The pull toward narrative
time is strong and needs an empirical counter.

---

## 23. Editorializing modifiers

**Tell:** adjectives that pre-load the verdict the piece is supposed to reach —
"aggressive", "surprising", "impressive", "brutal", "collapse" for a 15-point
drop, "exactly" where the contrast already carries it.

**Fix:** let the number be the adjective.

---

# Encyclopedic and chatbot patterns

Entries 1 to 23 are staging mechanisms: a sentence built so the reader feels a
finding arrive. Entries 24 to 36 are a different family. They come from the
Wikipedia AI Cleanup project's *Signs of AI writing*, by way of the
[humanizer](https://github.com/blader/humanizer) skill, and they show up in the
flatter registers — encyclopedic summary, product copy, README boilerplate,
pasted chat transcripts — where the writing is not staging anything, just
running on defaults.

Several of these are surface patterns rather than mechanisms, which is a real
limitation: a phrase list misses the next paraphrase, and entries 30 and 31 in
particular are lists. They stay because they are cheap to check and they fire on
text nobody would otherwise re-read.

---

## 24. Copula avoidance

**Tell:** "serves as", "stands as", "represents", "marks", "boasts", "features",
"offers" where "is" or "has" would do.

**Why:** the elaborate verb adds a beat of ceremony and usually a claim the
source does not make. "Serves as" implies purpose; "is" states a fact.

**Fix:** use the copula.

> was: *Gallery 825 serves as LAAA's exhibition space. The gallery features four
> separate spaces and boasts over 3,000 square feet.*
> now: *Gallery 825 is LAAA's exhibition space. It has four rooms totalling 3,000
> square feet.*

---

## 25. Participle tail

**Tell:** a clause tacked onto the end of a sentence with a present participle —
"highlighting", "underscoring", "emphasizing", "reflecting", "symbolizing",
"showcasing", "ensuring", "fostering", "contributing to", "encompassing".

**Why:** the tail asserts significance the sentence has not earned, and it is
almost always unsourced. Two or three stacked in one sentence is the strongest
single tell in this family.

**Fix:** cut the tail. If the claim inside it is real and sourced, make it its
own sentence.

> was: *The temple's palette resonates with the region's natural beauty,
> symbolizing Texas bluebonnets and the Gulf of Mexico, reflecting the
> community's deep connection to the land.*
> now: *The temple is painted blue, green and gold, colours chosen to evoke
> Texas bluebonnets and the Gulf of Mexico.*

**Earned when** the clause carries a sourced claim. Then it is the shape that is
wrong, not the content: promote it to its own sentence rather than cutting it.

---

## 26. Forced triad

**Tell:** three parallel items where the content has two or five — "keynote
sessions, panel discussions, and networking opportunities", "innovation,
inspiration, and industry insights".

**Why:** three reads as complete, so the model pads to three or truncates to
three. The count is chosen by rhythm rather than by the content.

**Fix:** list what there is. Two items is a normal number.

> was: *The event features keynote sessions, panel discussions, and networking
> opportunities.*
> now: *The event has talks and panels, with time between them to talk to people.*

**Earned when** there are genuinely three things, or a superlative or ranking
rides on the phrasing.

**Three shapes, one tic.** The comma list ("keynote sessions, panel discussions,
and networking opportunities") is the obvious one. The anaphora form carries the
parallelism in the opening words instead: *It was a message. It was a permission
slip. It was an out.* across sentences, or *something to steer toward, something
to be measured against, something to fear* inside one. The echo form keys on
neither the commas nor the opening, but on a skeleton reused whole: *A shopping
cart is an object in the system. A chat room is an object in the system.* Two
sentences sharing four or more words in sequence are a template being filled,
and a reader who has read the first has read the second. The linter catches all
three, and the document-level `opening repetition` count is the same tic spread
thin enough that no single passage looks wrong. Entry 27 read in the right
direction is the guard: repetition that is the point stays.

---

## 27. Elegant variation

**Tell:** the same referent renamed on every mention — protagonist, main
character, central figure, hero; the model, the system, the network, the
architecture.

**Why:** repetition penalties push the next token away from the word already
used. Human technical writers repeat the noun, because a second name for a thing
reads as a second thing.

**Fix:** pick the noun and keep it. Repetition is clarity here, not a defect.

> was: *The protagonist faces many challenges. The main character must overcome
> obstacles. The central figure eventually triumphs.*
> now: *The protagonist faces many challenges and eventually wins.*

**Earned when** the second term names a genuinely different thing. Check that the
referents really are identical before collapsing them.

---

## 28. False range

**Tell:** "from X to Y" where X and Y are not endpoints of any scale — "from the
Big Bang to dark matter", "from startups to enterprises", "from onboarding to
retention".

**Why:** the construction promises a spectrum and delivers two examples, so it
implies coverage the sentence does not have.

**Fix:** list the items, or name the actual range with its actual endpoints.

> was: *Our journey has taken us from the singularity of the Big Bang to the
> grand cosmic web, from the birth of stars to the dance of dark matter.*
> now: *The book covers the Big Bang, star formation and current theories about
> dark matter.*

**Earned when** the endpoints are real: "from 2 to 8 bits", "from onboarding to
offboarding". A range with a scale under it is a range.

---

## 29. Inline-header list

**Tell:** bullets that open with a bolded label and a colon, where the label
restates the first words of the item — `- **Performance:** Performance has been
improved`.

**Why:** it is an outline rendered as prose. The labels carry no information the
sentences do not, and the shape survives from the model's plan into the output.

**Fix:** write the paragraph, or cut the labels and keep the bullets, or keep the
labels only where they are a real index (a term being defined, an option name).

> was: *- **Performance:** Performance has been enhanced through optimized
> algorithms.*
> now: *Load times dropped after the index moved off the hot path.*

**Earned when** the label is a real index rather than a restatement: a term being
defined, an option or flag name, a case name in a table of cases.

---

## 30. Typographic tells

**Tell:** bold scattered mid-sentence on phrases that are not terms; Title Case
On Every Word Of A Heading; emoji as bullet or heading decoration; curly quotes
in a plain-text or code context.

**Why:** none of these is wrong on its own, and each has an innocent source
(Word, a CMS, a house style). They matter as a cluster, and they matter most in
documents where the surrounding convention is clearly different.

**Fix:** bold for terms on first use and nothing else; sentence case in headings;
no emoji unless the document already uses them; straight quotes in anything a
program will read.

**Not a tell on its own.** Curly quotes are the default in most editors, and one
bolded term is normal writing.

---

## 31. Chatbot residue

**Tell:** the conversational wrapper left in the pasted text — "Great question",
"Certainly", "You're absolutely right", "I hope this helps", "Let me know if
you'd like", "Would you like me to", "Want me to give examples", "Here is an
overview of".

**Why:** it is correspondence, not content. It reaches the document because
someone pasted a reply rather than an artifact.

**Fix:** delete. There is no rewrite; the sentence has no content.

---

## 32. Filler and hedge stacking

**Tell:** phrases that expand without adding — "in order to", "due to the fact
that", "at this point in time", "in the event that", "has the ability to", "it is
important to note that"; and hedges in series — "could potentially possibly",
"might arguably suggest".

**Why:** each is a token-cheap way to sound careful. Stacked hedges do not make a
claim more careful, only harder to hold to.

**Fix:** "to", "because", "now", "if", "can". One hedge carries all the
uncertainty three of them do.

> was: *It could potentially possibly be argued that the policy might have some
> effect on outcomes.*
> now: *The policy may affect outcomes.*

**Do not overcorrect.** A hedge with content ("on the two runs that finished") is
a caveat and stays. See the Overcorrection section of `SKILL.md`.

---

## 33. Speculative gap-filling

**Tell:** "while specific details are limited", "based on available information",
"not publicly available", "maintains a low profile", "keeps personal details
private", "likely grew up", "it is believed that", "as of my last update".

**Why:** two tells with one cause. The model cannot find a source, writes a
sentence about not finding one, then fills the gap with the stock guess. The
guess is unsourced and the meta-sentence is about the model, not the subject.

**Fix:** say what is not known, or cut the sentence. Never dress the guess as
fact.

> was: *Information about her early life is not publicly available, suggesting
> she maintains a low profile. She likely grew up in a middle-class household.*
> now: *Her early life is not documented in the sources used here.*

---

## 34. Diff-anchored documentation

**Tell:** documentation or a code comment that narrates a change rather than
describing the thing — "this function was added to replace", "we now use", "the
previous approach was", "this has been updated to".

**Why:** the document is being written from the diff that produced it, so it
reads coherently only to someone who knows what the last commit did. Six months
later nobody does.

**Fix:** describe the current state. The change belongs in the commit message or
the changelog.

**Earned when** the document is version-scoped by design — a changelog, release
notes, a migration guide, an upgrade path. Narrating the change is the job there.

> was: *This function was added to replace the previous approach of iterating
> through all items, which caused quadratic performance.*
> now: *Looks up items through a hash map, so cost is constant per item rather
> than quadratic in the list length.*

---

## 35. Subjectless fragment

**Tell:** a claim with the actor removed — "No configuration file needed", "The
results are preserved automatically", "Changes applied on save".

**Why:** the reader cannot tell who does the thing, which matters most in exactly
the documents where these appear: who preserves the results, and can I rely on
it? Related to abstraction agency (entry 4), which puts the wrong subject in the
slot rather than none.

**Fix:** name the actor.

> was: *No configuration file needed. The results are preserved automatically.*
> now: *You do not need a config file. The runner writes results to `out/` when
> the job exits.*

**Earned when** the register is genuinely clipped throughout — release notes, a
feature table, a CLI help string.

---

## 36. Predicate-position hyphenation

**Tell:** a compound modifier keeping its hyphen after the noun — "the report is
high-quality", "the team is cross-functional", "the pipeline is end-to-end".

**Why:** the model hyphenates the pair uniformly wherever it appears. Human
writers hyphenate attributively and mostly drop it in the predicate.

**Fix:** keep the hyphen before the noun, drop it after.

> was: *The team is cross-functional and the report is data-driven.*
> now: *The team is cross functional and the report is data driven.*

**Minor.** One instance proves nothing; a document that hyphenates every pair in
both positions is a cluster member.

---

## 37. Dressed metaphor

Back in the staging family, not the encyclopedic one, and numbered last because
it arrived last.

**Tell:** a figure of speech standing in for a mechanism you could have named —
"wearing the costume of", "dressed up as", "in a new hat", "is X in Y's
clothing", plus visceral or lurid imagery on a mundane observation. Entry 6 is
the special case where the figure is *locational* ("the seam where"); this is the
general one.

**Why:** the figure feels vivid, so it reads as insight, and it usually replaces
the plain description rather than adding to it. The accurate phrase is almost
always shorter and less pleased with itself.

**Fix:** describe the mechanism.

> was: *That is information loss wearing the costume of a style fix.*
> now: *The edit removes content while looking like it removed only style.*

> was: *every time we pushed on a mechanism the hard part squirted out.*
> now: *each mechanism we examined had the same difficulty underneath it.*

**Earned when** the metaphor is the clearest available description and no plain
noun fits. Delete the ones doing significance work, not the ones doing work.

**No regex reaches this one.** `declaude_lint.py` cannot see it, and a phrase
list for it would be three entries long and obsolete by the next draft. It is
caught on the sentence pass or not at all. Both specimens above shipped past a
clean lint report.

---

## 38. Announce-then-deliver

**Tell:** a counted noun-phrase label with a clipped qualifier, standing before
the content it names — "One factual note, not fixed:", "Two things I did not
do.", "One judgment call left alone.", "The exception, worth restating:", "and
worth saying why it works:".

**Why:** the label carries nothing the content does not. It buys the writer a
beat to compose in and costs the reader a clause before the subject arrives. A
person either writes the label the way they would say it — "One note I did not
fix" — or, more often, just states the thing.

Distinct from entry 5, where a placeholder sits *in* the subject slot; here a
whole announcement sits *in front of* the sentence and the real subject is fine.
Distinct from entry 17, which narrates the writer's procedure rather than
labelling the content. Entry 29 is the bulleted cousin: same restating label,
rendered as a bold lead-in instead of a standalone phrase.

**Fix:** delete the announcement and start with the content. Where a label is
genuinely needed, write it as speech, not as a caption.

> was: *One factual note, not fixed: X and Y both assert what people generally
> do. Nothing in the repo supports either.*
> now: *Two sentences assert what people generally do, and nothing in the repo
> supports either: X and Y.*

**Earned when** the count is real navigation over a list the reader will scan —
"Three shapes, and the fix differs for each:" ahead of an actual three-item
list. The test is whether deleting the label loses anything.

**Watch the reuse.** Measured nine times in one 40 KB document, including twice
as a section header, in a piece whose own subject was bad headers. A writer who
reaches for this once reaches for it throughout; the linter's `reuse` block is
the cheapest way to see it.

---

## 39. Welded epigram

**Tell:** a factual clause joined by `and` or `so` to a second clause that
restates it as a general truth — ", so a child never carries a grant its parent
lacks", ", and the failure it prevents is silent", ", and nothing errors". The
second clause typically contains no concrete noun and would read as true of any
system, not this one.

**Why:** the first clause says what happens; the second says what it means, in a
shape built to be quoted. It also loses precision, because a maxim has to drop
the conditions that made the mechanism specific. *A child never carries a grant
its parent lacks* is vaguer than the rule it paraphrases, and a reader cannot
act on it.

**Fix:** keep the clause that says what happens. Delete the one that says what it
means.

> was: *Entries the caller does not itself hold are dropped, so a child never
> carries a grant its parent lacks.*
> now: *List a tool you do not have yourself and it is dropped.*

> was: *The rest of the surface depends on this parameter, and the failure it
> prevents is silent.*
> now: *Leave it out and nothing errors — the child just comes up bare.*

Distinct from entry 12, which is a whole sentence at the end of a paragraph.
This one hides inside a single sentence, mid-paragraph, and survives a pass that
is only checking closers.

---

## 40. Spec-ese

**Tell:** the register of a standards document rather than of a person
explaining something. Demonstrative subject where "it" would do ("That child
holds no repository"); reflexive emphatics ("does not itself hold"); latinate
state verbs for a program doing nothing ("idles", "holds", "carries", "awaits");
participle tails on those verbs ("awaiting input"); passive with the actor
displaced into a subordinate clause.

**Why:** it reads as translated from a schema. The formality signals precision
without adding any — every specimen below says less than its plain rewrite,
because the plain rewrite names who does the thing.

**Fix:** use "it". Use the verb you would say aloud. Name the reader as the actor
where the reader is the actor.

> was: *That child holds no repository and waits for input.*
> now: *It comes up with no repo and does nothing until you send it a message.*

> was: *Omit it and the child idles awaiting input.*
> now: *Leave it out and the session just sits there.*

**Earned when** the term is the system's own — a queue whose documented states
are `waiting` and `held`, a flag literally named `AWAIT`. Then it is a
quotation, not a register choice.

---

## 41. Nominalized header

**Tell:** a header whose head noun is an abstraction — "GitHub authorship in a
sourced child", "Spawn availability", "Channels between siblings", "Detecting a
parked child". Shapes to scan for: `<-ship/-tion/-ment/-ance/-ity noun> in|of|for
<thing>`, and a bare gerund standing in for the sentence the section actually
makes.

**Why:** it names a topic area instead of the content, so it fails entry 7's
table-of-contents test while passing entry 7's regex. A reader scanning
"Spawn availability" learns that the section is about spawning, which they knew.

**Fix:** name the concrete thing, or ask the reader's question.

> was: *GitHub authorship in a sourced child* → now: *Who the delegate posts as*
> was: *Spawn availability* → now: *When create_session fails*

**This is the standard overcorrection from entry 7.** Diagnosed 2026-08-23: a
draft's four verdict-shaped section headers ("A sourced child signs GitHub
writes as the token owner", "There is no reply channel between siblings") were
all rewritten into nominalizations in a single pass, and the linter then
reported the document clean. Fleeing a verdict into an abstraction is not a fix.
The target is a concrete label, and both failures miss it in opposite
directions.

---

## 42. Contents-list standfirst

**Tell:** a subtitle or opening line built as `<noun phrase>, plus <noun
phrase>` — "The create_session parameter surface, plus the behavior the schema
leaves out". Variants: "…, and what it means for X", "…, and the N things you
need to know". The second half is usually a coy reduced relative that claims
value without naming any ("the behavior the schema leaves out", "the part the
docs skip").

**Why:** it is a table of contents wearing a sentence, and the second half is a
significance tag (entry 3) in disguise — it tells the reader the withheld
material is worth having rather than saying what it is.

**Fix:** say what the page contains, or drop the subtitle. A reference does not
need one.

> was: *The create_session parameter surface, plus the behavior the schema
> leaves out.*
> now: *Every parameter, and four behaviors that only show up in practice.*

---

# Flat-certainty patterns

Entries 43 to 47 are the register this skill produces, once the staging is gone.
They come from a count rather than from a draft: the cluster of GitHub pull
request descriptions that went from 0.70% of early 2025 to 39.5% of August 2026,
whose highest-lift words are `load-bearing`, `plainly`, `quietly`, `refusal`,
`re-derived`, `asserted`, `nobody`, `genuinely`, `outright`, `byte-identical`.
`references/corpus.md` carries the method, the numbers and the limits.

Nothing here is staging a reveal. These sentences are trying to sound *settled* —
adjudicated, verified, exhaustively negated — and the same test applies one
register over: **am I stating the finding, or performing having settled it?**

Every family below is also a family a careful writer uses correctly, which is why
each entry has an earned column. Do not treat any of these words as a blocklist;
`references/corpus.md` explains what the measurement does and does not support.

---

## 43. Flat-certainty adverb

**Tell:** a bare adverb doing the work of the evidence — "plainly", "quietly",
"outright", "merely", "genuinely", "deliberately", "provably", "empirically",
"demonstrably", "structurally", "legitimately", "precisely", "honestly",
"vacuously", "adversarially", "silently", "loudly", "routinely", "identically".

**Why:** `plainly` and `quietly` are the second and third highest-lift words in
the corpus cluster. The adverb asserts the reader's reaction — that this is
obvious, that it happened without noise, that the check was real — where the
sentence has not shown it. "Provably correct" without the proof is "correct" with
a costume on. It is entry 23 in the flat register: the modifier pre-loads the
verdict.

**Fix:** delete it, or replace it with what makes it true.

> was: *The retry is provably safe.*
> now: *The retry is idempotent: the handler keys on the request id.*

> was: *The flag was quietly dropped in 4.2.*
> now: *The flag was dropped in 4.2. The changelog does not mention it.*

**Earned:** the adverb names a real contrast the reader can check — "silently"
against a version that logs, "identically" against a version that differs. One
adverb carrying a comparison is information; three in a paragraph is a register.

---

## 44. Juridical register

**Tell:** code, tests and processes described as a court — "refusal", "refuses",
"declines", "admits", "ruling", "verdict", "precedent", "carve-out", "standing",
"grounds", "obligation", "owed", "remedy", "ratified", "sanctioned", "honoured",
"answerable", "cites".

**Why:** `refusal` is the fourth highest-lift word in the cluster and `ruling` the
seventeenth. The register borrows finality from a domain that has procedures for
producing it. A linter does not *rule*; it exits non-zero. A default is not a
*carve-out* unless something granted it. The vocabulary makes an implementation
detail sound adjudicated, and it stacks with entry 4 — the thing doing the ruling
is usually an abstraction with no hands.

**Fix:** name the mechanism and its exit condition.

> was: *The guard refuses any caller without standing.*
> now: *The guard returns 403 when the token has no `write` scope.*

> was: *That is the carve-out the header check honors.*
> now: *The header check skips one-word titles.*

**Earned:** the system's own documented vocabulary. A policy engine whose API
says `deny` denies; an RFC that says MUST is an obligation. Use the word the
system uses, not the word that sounds like it.

---

## 45. Verification-provenance compound

**Tell:** a hyphenated compound asserting how thoroughly something was checked —
"byte-identical", "bit-identical", "byte-for-byte", "byte-exact",
"mutation-checked", "mutation-verified", "mutation-tested", "live-verified",
"cross-checked", "root-caused", "hand-verified", "re-derived", "re-verified",
"re-measured", "re-checked", "re-confirmed".

**Why:** eleven of the cluster's top hundred words are this shape, and it is the
newest family in the register — it arrived with agents that report on their own
work. The compound is a claim about method compressed to an adjective, which puts
it past the place a reader would ask for the method. "Byte-identical" is
checkable and often true; "mutation-checked" usually means a mutation run
happened, not that this line survived one. The `re-` prefix is the same move in a
verb: it claims a second pass without saying what the second pass did
differently.

**Fix:** state what was run and what came back.

> was: *The rewrite is byte-identical and mutation-checked.*
> now: *`diff` reports no change. The mutation run killed 14 of 15; the survivor
> is in `parse_header`.*

> was: *I re-derived the threshold.*
> now: *I recomputed the threshold from the 46 chunks and got 0.20 again.*

**Earned:** the compound is the precise term and the number is beside it.
"Byte-identical" against a stated diff is exact and shorter than the alternative.
A `re-` verb earns its prefix when the first pass is on the page and the second
disagreed with it.

---

## 46. Privative coinage

**Tell:** a thing named by what was not done to it — "ungated", "unguarded",
"unwired", "uncapped", "unbuilt", "unparseable", "unverifiable", "unmeasured",
"unresolvable", "unsatisfiable", "unrecognised", "vacuous", "inert".

**Why:** the coinage sounds like a diagnosis and carries no measurement. "The
hook is unwired" and "the hook is not in settings.json" say the same thing, but
the first sounds like a category the writer already knew and the second can be
checked. Several of these are not words outside this register, which is the tell:
the writer minted an adjective rather than describe a state.

**Fix:** say what is missing, and where.

> was: *Three of the paths are unguarded.*
> now: *Three of the paths have no length check before the index.*

> was: *The assertion is vacuous.*
> now: *The assertion passes on an empty list, which is what the test supplies.*

**Earned:** the term is the field's ("unsatisfiable" in SAT, "unbuilt" of a build
target), or the absence is the finding and the entry names it once before the
detail.

---

## 47. Exhaustive negation

**Tell:** an absolute quantifier standing in for the argument — "nothing in it
does X", "nowhere else for it to be", "no path reaches", "never", "neither",
"nobody". Often in a closer, often as the whole of the evidence.

**Why:** `nobody`, `nowhere` and `nothing` are all in the cluster's top
twenty-five. A universal negative is the strongest available claim and the most
expensive to establish, so it is the cheapest to assert. "Nothing else could
cause it" is a claim about the search, and the search is what the reader wants.
Entry 2 covers the negation that sets up a reveal and entry 3 the unfalsifiable
"nobody noticed"; this is the flat form, where the negation *is* the finding.

**Fix:** state the scope you actually checked.

> was: *Nothing in the fit varies with time.*
> now: *The fit has one parameter per cluster and none per week.*

> was: *There is nowhere else for the rise to be.*
> now: *The weekly shares are counted after assignment, so a rise is in the
> assignments.*

**Earned:** the scope is bounded and named. "None of the 46 chunks exceeds 0.57%"
is a universal over a set the reader can see. So is a negative that follows an
exhaustive mechanism — "the enum has three members and the switch covers all
three".

---

## 48. Performative candour

**Tell:** "I'll be honest", "let's be honest", "to be clear", "I won't pretend",
sentence-initial "Honestly," / "Look," / "Frankly,", and the invitation that
follows them — "you don't have to take my word for it".

**Why:** sincerity announced instead of shown. The reader had no reason to
suspect the preceding sentences, so the announcement marks the next one as the
true one and demotes the rest. "Don't take my word for it" is the same move
aimed at evidence: it offers a check and hands over nothing to check with.

**Fix:** delete the announcement and keep the sentence. Where the invitation to
verify is real, link the thing.

> was: *Let's be honest: the benchmark does not measure what the README claims.
> And you don't have to take my word for it.*
> now: *The benchmark times decode only. The README claims end to end. The
> harness is `bench/run.py`, line 40.*

**Earned:** reported speech, where a person said it. Also "to be clear"
introducing a correction of a misreading the draft itself caused, once.

---

## 49. Stranded auxiliary reversal

**Tell:** a clause that ends on a bare auxiliary carrying the reversal — "The
tool died; the data didn't.", "Reading mostly passed. Writing didn't.", "Maybe
it wouldn't have."

**Why:** the auxiliary does the work and the verb is elided, so the clause lands
as a beat rather than as a fact. Entry 2 stages a reveal by negating first; this
stages one by negating last, with the content left out of the half that is
supposed to carry it.

**Fix:** say what the second clause is claiming.

> was: *The tool died; the data didn't.*
> now: *The tool stopped writing checkpoints on 12 August. The rows already
> written are still in the bucket.*

**Earned:** ordinary ellipsis, where the elided verb is the one just used and
the contrast rides in the same breath rather than in a beat of its own —
"Digression and mild informality are human. Symmetry and antithesis are not."
Also where both halves are measured and the reader can see both numbers: "reads
passed on all 12 shards, writes on none". The tic is the reversal given its own
sentence as a drop, with the verb withheld.

---

## 50. Retroactive significance

**Tell:** "that's why X mattered", "this is why keeping every transcript
counted", "which is why the open environment mattered".

**Why:** entry 3 tells the reader which sentence matters before they read it;
this tells them which one did. The retroactive form is the worse of the two,
because the passage being graded has already had its chance with the reader and
the grade is an admission it did not take.

**Fix:** cut it. If the earlier passage did not carry the point, the earlier
passage is the problem.

> was: *That's why being able to open the environment mattered.*
> now: *Opening the environment recovered 40 GB of checkpoints. Without it the
> run restarts at step 0.*

**Earned:** a "which is why" that introduces a consequence the reader has not
seen yet. New information, not a grade on old information.

---

## 51. Totalizing designation

**Tell:** "that's the whole point", "the entire business model is X", "here's
the whole trick", "the only marketing I trust", "the only thing that matters".

**Why:** entry 3 with the scope widened to everything. "The whole point" claims
the rest of the paragraph is decoration. "The only X I trust" ranks a field
whose other members are never named, so there is nothing to disagree with.
Neither can be checked, and both ask the reader to accept a total where a part
was demonstrated.

**Fix:** state the part, and let it be a part.

> was: *That's the whole point of the format.*
> now: *The format keeps the offsets in the header, so a reader can seek without
> decompressing.*

> was: *Changelogs are the only release notes I trust.*
> now: *I check release notes against the diff, which per-entry links make
> possible.*

**Earned:** a real count of one over a named set — "the only one of the six runs
that finished".

---

## 52. Obituary headline

**Tell:** "X is dead", "long live X", "the death of X", "RIP X" — usually a
header or a first line.

**Why:** a headline built to be argued with rather than read. It states a
verdict, which entry 7 already bars in headers, and it borrows a form whose
function is to overstate. The body then spends its opening paragraph walking the
claim back, which is the tell that the header was never the finding.

**Fix:** name what changed.

> was: *Peer code review is dead*
> now: *Three of our four teams dropped the second-approval requirement in July*

**Earned:** the phrase belongs to something quoted or named — a post you are
citing, a product whose vendor announced end of life.

---

## Compressed syntax: entries 53 to 56

Clark, Martin and Mahowald ([arXiv 2610.29162](https://arxiv.org/abs/2610.29162),
October 2026) parsed chat, coding-session and essay output from nine frontier
models. They compared each reply with a paraphrase of the same sentences made by
translating it to Japanese and back, and with human text from the same genre.
The models used more of six constructions that psycholinguistics links to slower
reading: rare word pairs, long distances between a word and the word it depends
on, object relative clauses with the optional *that* left out, stacks of three or
more nouns, nouns used as verbs, and inanimate subjects on verbs that normally
take a person. All nine overused the rare word pairs and the inanimate subjects
compared with human text. The authors' explanation is training that rewards a
correct answer in fewer tokens. A length penalty alone pushed a small model to
pick the shorter form of every syntactic alternation it was trained on, and of
one it never saw.

These entries are a different mechanism from staging. Nothing here performs a
finding. Each shape packs a claim into fewer words than a person would use, and
the reader pays for the saving in parse effort. The fix usually makes the
sentence longer, which is why a pass that aims only at brevity produces these
shapes instead of removing them. Rare word pairs are not an entry of their own:
they are what noun stacks, verbed nouns and dressed metaphor (entry 37) add up
to when someone counts them.

The effect is largest in multi-turn chat and coding sessions and smaller in
single-prompt essays. It also moves with training: Opus 5.5 scored lower than
Opus 5 on 19 of the paper's 21 comparisons.

The linter reaches none of entries 53 to 56; they need a parse. Read for them in
the sentence pass. Inanimate subjects on animate verbs are entry 4, where the
linter flags the commonest of those verbs.

---

## 53. Noun stack

**Tell:** three or more nouns in a row, each modifying the next, often with a
hyphen fusing two of them: "reader-patience budget", "Policy 1's class-time
shutdown requirement", "dry-run write prevention", "the existing xfailed
lazy-intermediate Lookup behavior".

**Why:** English lets any noun modify another and never marks how they group.
The reader has to work out the bracketing (*dog bite victim*) and supply the
relation the writer left out: a budget *of* patience, or *for* it? A stack is
the shortest way to name something the writer has in mind and the reader has
never seen.

**Fix:** unstack into a phrase with prepositions, or a clause that names the
relation.

> was: *New tests for paths with spaces, dry-run write prevention, and
> idempotent config reinstalls.* (GPT-5.6 Terra, paper Table 2)
> now: *New tests cover paths with spaces, check that a dry run writes nothing,
> and check that reinstalling the config is idempotent.*

> was: *I acknowledge concerns about distraction, but Policy 1's class-time
> shutdown requirement directly addresses this.* (Kimi K2.5)
> now: *Policy 1 requires phones to be off during class, which addresses the
> concern about distraction.*

**Earned:** an established term in the reader's field (*foreign key
constraint*, *money market fund*), or a stack the document defines once and
then reuses as a name.

---

## 54. Verbed noun

**Tell:** a noun used as a verb where the field has no such verb: "footnote it",
"calendar it", "ticket that", "bucket them", "this papercuts every new user".

**Why:** readers parse a word as the part of speech they expect, and a noun in
verb position forces a second look. Conventional conversions (*bottle*, *email*,
*stage a change*) cost nothing because the reader has seen them. An ad-hoc one
saves two words, *put it in a*, and spends them back as reanalysis.

**Fix:** use a plain verb with the noun as its object.

> was: *…the convoluted sentence you are currently reading is quietly eating
> its own reader-patience budget — footnote it.* (the paper's opening specimen)
> now: *…this sentence is hard to read. Move it to a footnote.*

**Earned:** the conversion is standard in the reader's field (*to scope*, *to
gate a release*, *to shard*), or the text is quoting someone.

---

## 55. Dropped *that*

**Tell:** an object relative clause or a complement clause with the optional
*that* left out, where the clause is long or its subject is a new noun phrase:
"the others check behaviour the old code never reached", "the unclosed-tag
errors are the papercut people feel day-to-day", "we found the cache key
omitted the locale".

**Why:** people drop *that* when what follows is predictable and keep it when it
is not (Levy and Jaeger 2007; Jaeger 2010). Without it, two noun phrases sit
side by side and nothing tells the reader that a clause has begun. In the
paper's length-penalty runs the trained model left *that* out more than 98% of
the time, where people choose by context.

Rewriting a passive into an object relative to save a word ("the house that the
contractors built" for "the house that was built by the contractors") belongs
here too.

**Fix:** put *that* back when the clause runs past a few words or its subject is
a noun phrase the reader has not met.

> was: *Three fail on the old code; the others check behaviour the old code never
> reached.* (Opus 5.5)
> now: *Three fail on the old code; the others check behaviour that the old code
> never reached.*

**Earned:** a short clause after a common verb, where the reader already expects
it: "the book I read", "I think the build is broken".

---

## 56. Distant verb

**Tell:** a subject held apart from its verb by a list, a dash aside or an
appositive: "All five expression shapes — attribute access, subscript, calls,
nested calls, string literals — leave current on NAME('b')", "Class time, where
a total blackout policy would apply under Policy 1, remains protected".

**Why:** the reader keeps the subject in working memory until the verb arrives,
and the cost grows with the distance (Gibson 1998). People writing for readers
put the long part after the verb.

**Fix:** give the verb early. Move the list or the aside after the main clause,
or into a sentence of its own.

> was: *All five expression shapes — attribute access, subscript, calls, nested
> calls, string literals — leave current on NAME('b'), and the full template
> renders correctly.* (Fable 5)
> now: *All five expression shapes leave current on NAME('b'): attribute access,
> subscript, calls, nested calls and string literals. The full template renders
> correctly.*

**Earned:** a list of two or three short items, or a subject that is long because
it is a quoted name.

---

## Quick self-check before shipping an edit

1. Does any sentence exist to make a finding feel bigger than it is?
2. Does any sentence tell the reader which sentence matters?
3. Is anything in a subject slot that cannot act?
4. Does any header state a verdict, hide its contents, contain a comma, or
   name an abstraction instead of the content?
5. Is any noun deferred that was available?
6. Does the last paragraph paraphrase the subtext of the piece?
7. Did the edit remove content, change a claim, or add hedging?
8. Does the result still sound like a person with opinions?
9. Does any sentence end in a participle tail that asserts significance?
10. Does the rewrite contain a fact, name, number, date or citation that is not
    in the source? A fabrication is a defect even when it sounds more human than
    the vague original.
11. Does any sentence weld a maxim onto a fact with "and" or "so"?
12. Would you say it aloud in those words, or is it schema prose?
13. Does the rewrite drop a claim the source made? Check claim by claim, not
    paragraph by paragraph. Superlatives, rankings, simultaneity, scope words and
    the condition attached to a hedge all sit inside phrasings this register
    cuts, and the paragraph looks intact after they go.
14. Does an adverb, a hyphenated compound or an absolute negative carry a claim
    the sentence never shows? Flat certainty has tics of its own; entries 43 to
    47 and `references/corpus.md`.
15. Does any sentence announce its own honesty, grade an earlier passage, claim
    a whole where a part was shown, or land a reversal on a bare auxiliary?
    Entries 48 to 52.
16. Is the rewrite shorter and harder to parse? Look for three nouns in a row,
    a noun used as a verb, a long clause with its *that* dropped, and a subject
    waiting behind a list for its verb. Entries 53 to 56.
