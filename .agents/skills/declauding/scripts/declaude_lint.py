#!/usr/bin/env python3
"""Mechanical scan for LLM prose tics.

Finds candidates. Does not decide. Every hit still needs the sentence-level
test in references/register.md, and the structural tics (fragment cadence,
drama line breaks, staged paragraph shape) are only partly reachable by regex.
A clean report means nothing on its own.

    python3 declaude_lint.py DRAFT.md [--json] [--quiet-slop]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# (category, regex, note). Case-insensitive unless the pattern needs case.
RULES: list[tuple[str, str, str]] = [
    # --- negation-first -----------------------------------------------------
    ("negation-first", r"\b(?:is|it's|its|was|it was)\s+not\s+(?:that\s+)?[^.;]{2,60}[.;—-]\s*(?:it|that)\s+(?:is|was|'s)\b", "is-not / it-is pair"),
    ("negation-first", r"\bnot\s+because\b[^.]{0,80}—\s*because\b", "not-because / because"),
    ("negation-first", r"\b(?:doesn't|does not|didn't|did not)\s+just\b[^.]{0,60}\b(?:it|they)\b", "doesn't just X, it Y's"),
    ("negation-first", r"\bthe\s+(?:problem|failure|issue|point|question|bug|risk)\s+(?:wasn't|isn't|was not|is not)\b", "the problem wasn't X"),
    ("negation-first", r"[.!?]\s+Not\s+\w+[^.]{0,60}\.", "trailing 'Not X.' fragment"),
    ("negation-first", r",\s*not\s+[a-z][^.]{0,40}\.\s*$", "X, not Y closer"),
    ("negation-first", r"\b(?:is|are|was|were)\s+[a-z]{3,20},\s*not\s+[a-z]{3,20}\.", "X is A, not B — mid-paragraph, check the reader was holding B"),

    # --- significance designation -------------------------------------------
    ("significance", r"\bthe\s+(?:real|actual|true|useful|interesting|important|key)\s+(?:question|problem|issue|point|reason|answer|finding|story|move|tool|test|variable|number|fix|heuristic|lesson|insight|takeaway|culprit|cause|trap|trick|win)\b", "the real/actual X"),
    ("significance", r"\bthe\s+(?:part|thing|bit|piece|detail)\s+(?:that|which)\b", "the part that — designation; the reader decides what matters"),
    ("significance", r"\bthe\s+(?:one|leg|row|line|number|question)\s+that\s+(?:matters|counts|transfers|makes the point|does the work|answers|explains)\b", "the X that matters"),
    ("significance", r"\b(?:here'?s|this is)\s+(?:the thing|where it gets interesting|what)\b", "here's the thing"),
    ("significance", r"\bhere(?:'?s|\s+is)\s+(?:the|a|my|one)\s+(?:twist|catch|kicker|rub|surprising|interesting|best|worst)\b", "staged reveal — 'here's the twist/catch/kicker'"),
    ("significance", r"\b(?:that|this|it)(?:'?s|\s+(?:is|was))\s+the\s+part\b", "that's the part — the reader decides which part"),
    ("significance", r"\bmy\s+favou?rite\s+part\s+of\b", "gesturing at a favoured detail instead of stating it"),
    ("significance", r"\band\s+(?:that'?s|it has)\s+(?:the interesting part|a name here)\b", "manufactured reveal"),
    ("significance", r"\bthe\s+(?:one|only)\s+thing\s+(?:nobody|no one)\b", "the one thing nobody"),
    ("significance", r"\b(?:most|more)\s+(?:interesting|telling|revealing|surprising)\s+(?:part|thing|number|finding)\b", "significance tag"),
    ("significance", r"\bNobody\s+(?:had\s+)?(?:checked|noticed|asked|mentioned|said|told|saw|knew|looked|realized|realised|caught|tried|bothered|thought)\b", "unfalsifiable 'nobody' claim — earned only with a named mechanism"),

    # --- abstraction agency --------------------------------------------------
    ("agency", r"\b(?:the\s+)?(?:table|chart|graph|data|numbers?|median|mean|metric|figure|plot|log|code|result|headline)\s+(?:shows?|hides?|tells?|reveals?|says?|proves?|admits?|knows?|wants?)\b", "inanimate subject acting"),
    ("agency", r"\b(?:is|are|was|were)\s+doing\s+the\s+work\b", "X is doing the work"),
    ("agency", r"(?<!\bI )(?<!\byou )(?<!\bwe )(?<!\bthey )\b(?:earns?|demands?|buys?|deserves?)\s+(?:its|their|the)\s+\w+", "abstraction earning something"),
    ("agency", r"\b(?:truncation|quantization|rescoring|compression|optimization|abstraction|complexity|scalability)\s+(?:cuts?|adds?|breaks?|solves?|reranks?|is a concern)\b", "nominalization as agent"),
    ("agency", r"\b(?:about to|going to)\s+discover\b", "tool personified"),
    ("agency", r"\b(?:it|this|that|which|the\s+[a-z_]+)(?:\s+[a-z_]+)?\s+(?:bites|promises|forgets|misunderstands|pretends|hopes|swallows)\b", "animate verb on an inanimate subject — say what happens (entry 4)"),

    # --- deferred noun -------------------------------------------------------
    ("deferred-noun", r"\bOne\s+thing\s+(?:is|isn't|is not|that)\b", "One thing ..."),
    ("deferred-noun", r"\bThe\s+(?:second|third|fourth|fifth|sixth|seventh|other|last)\s+(?:is|isn't|is not|does|doesn't)\b\s*[.,]", "pointer instead of name"),
    ("deferred-noun", r"\bThere\s+(?:was|is)\s+(?:just\s+)?one\s+(?:problem|catch|issue|wrinkle)\b", "there was just one problem"),

    # --- announce-then-deliver (entry 38) -------------------------------------
    # A counted label standing in front of the content it names. Partially
    # reachable: the appositive-qualifier form is regular, the bare "One note:"
    # form is not without over-firing on legitimate list intros.
    ("announce", r"^(?:One|Two|Three|Four|A single|The one)\s+[a-z][\w -]{2,30},\s+(?:not|un\w+|left|stated|worth|flagged|still|so far)\b[^.:;]{0,25}[:.]", "counted label announcing the content it precedes"),
    ("announce", r"\b(?:One|Two|Three|Four)\s+things?\s+(?:I|we)\s+(?:did|didn'?t|have|haven'?t|will|won'?t)\b[^.:;]{0,20}[:.]", "announcing a list of what you did before doing it"),
    ("announce", r"\band\s+worth\s+(?:saying|noting|restating|repeating|mentioning|a\s+look)\b[^.]{0,25}:", "'and worth saying why' — say why"),
    ("announce", r"^(?:One|Two|Three|Four)\s+[a-z][\w -]{2,25}\s+(?:left\s+(?:alone|aside|open|unfixed)|unresolved|unfixed|untouched|not\s+fixed)\s*[.:]", "counted label with a participle qualifier, no comma"),
    ("announce", r"^The\s+\w+,\s+(?:worth|stated|noted|flagged|measured|left)\s+\w+[^.:;]{0,45}:", "appositive caption before the content"),

    # --- structural-metaphor locator ----------------------------------------
    ("locator", r"\bthe\s+(?:seam|hinge|joint|fault[- ]line|crux|linchpin|leg|place)\s+where\b", "structural-metaphor locator"),
    ("locator", r"\bload[- ]bearing\b", "load-bearing as metaphor"),

    # --- suspense / staging --------------------------------------------------
    ("staging", r"\b(?:but\s+)?here'?s\s+where\s+it\s+gets\b", "here's where it gets"),
    ("staging", r"\bwhat\s+(?:I|we|you)\s+(?:didn't|did not)\s+(?:realize|know|expect)\b", "movie-trailer voiceover"),
    ("staging", r"\bthis\s+is\s+the\s+story\s+of\b", "trailer opener"),
    ("staging", r"\band\s+that'?s\s+(?:when|where|why)\b", "and that's when"),
    ("staging", r"^\s*(?:So|Then|And)\s+(?:the|here|now)\b[^.\n]{0,40}:\s*$", "colon-staged section lead"),
    ("staging", r"\bthe\s+(?:defensible|honest|short|real)\s+(?:statement|answer|version)\s*:", "noun-phrase colon stage"),

    # --- em-dash gotcha, per instance ----------------------------------------
    ("em-dash", r"—\s*[^—\n]{3,90}[.!?]\s*$", "clause after a dash running to the end of the sentence — dash as drum roll"),

    # --- forced triad ---------------------------------------------------------
    ("triad", r"\b(?!who\b|which\b|that\b|when\b)(\w+(?:\s+\w+){0,2}),\s+(?!who\b|which\b|that\b|when\b|obviously\b|however\b)(\w+(?:\s+\w+){0,2}),\s+and\s+(?!who\b|which\b|that\b|when\b)(\w+(?:\s+\w+){0,2})\b", "three parallel items — check the content has three, not two padded or five truncated"),

    # --- rhetorical question -------------------------------------------------
    ("rhetorical-q", r"^\s*(?:So\s+)?(?:how|why|what|where|when|does|is|can|should)\b[^?\n]{0,70}\?\s*$", "standalone rhetorical question — check if you answer your own question next"),

    # --- self-grading --------------------------------------------------------
    ("self-grading", r"\b(?:earned,?\s+not\s+asserted|not\s+a\s+relabel|to be clear,\s*this is)\b", "grading own rigor"),
    ("self-grading", r"\b(?:that|this)\s+is\s+what\s+the\s+(?:data|numbers?|table|evidence)\s+shows?\b", "that is what the data shows"),
    ("self-grading", r"\b(?:it'?s|it is)\s+(?:worth|important)\s+(?:noting|mentioning|pointing out)\b", "worth noting"),
    ("self-grading", r"\ba\s+distinction\s+worth\b", "grading the distinction"),
    ("self-grading", r"\bgenuinely\s+(?:useful|interesting|hard|novel|different|new|considered|rigorous|surprising|original|important)\b", "intensifier as self-grade"),

    # --- performed humility --------------------------------------------------
    ("humility", r"\b(?:better|sharper|cleaner)\s+than\s+mine\b", "ranking others above yourself"),
    ("humility", r"\b(?:this\s+might\s+be\s+a\s+small\s+thing|probably\s+nobody\s+cares|not\s+sure\s+this\s+is\s+worth)\b", "apologizing for the piece"),
    ("humility", r"\bclassic\s+me\b", "self-deprecation as performance"),

    # --- throat-clearing / process narration ---------------------------------
    ("throat-clearing", r"\b(?:in this (?:post|article|piece),?\s*(?:I|we)'?ll|I want to talk about|let me explain|first,? some background|before I get into)\b", "preamble"),
    ("throat-clearing", r"\b(?:let me|I'?ll)\s+(?:consult|check|search|pull up|recall)\s+my\b", "AI self-narration"),

    # --- RTFM ----------------------------------------------------------------
    ("rtfm", r"\b(?:it turns out|I finally (?:discovered|realized|found)|hidden in the|buried in the (?:docs|api))\b", "RTFM as revelation"),
    ("rtfm", r"(?:^|[.!?\u2013\u2014]\s+)Turns\s+out\b", "bare 'Turns out' opener — a casual reveal bolted to a tidy conclusion"),

    # --- dev cliché ----------------------------------------------------------
    ("dev-cliche", r"\b(?:footgun|shot itself in the foot|rabbit hole|yak[- ]shav\w*|belt[- ]and[- ]suspenders|moving the needle|first[- ]class citizen|under the hood|just works|sane defaults|almost killed it|batteries[- ]included|zero[- ]config(?:uration)?)\b", "generic developer vocabulary"),
    ("dev-cliche", r"\b(?:hold|holds|held|fit|fits)\s+(?:it\s+)?in\s+your\s+head\b", "dev-blog boilerplate for simplicity — say how big it is"),

    # --- slop ----------------------------------------------------------------
    ("slop", r"\b(?:delve|tapestry|testament to|navigate the complexities|in today'?s fast[- ]paced|realm of|robust|seamless|leverage|utilize|crucial|pivotal|myriad|plethora|elevate|unlock the|harness the|embark|dive deep|at the end of the day)\b", "slop vocabulary"),

    # --- editorializing ------------------------------------------------------
    ("editorializing", r"\b(?:collapse[sd]?|catastrophic|dramatic(?:ally)?|brutal|staggering|remarkable|impressive)\b", "check the number justifies the adjective"),
    ("editorializing", r"\b(?:finally|belatedly|ultimately|eventually|inevitably),\s+(?:finally|belatedly|ultimately|eventually|inevitably),?\s", "doubled adverb — one of them is the verdict"),

    # --- time inflation ------------------------------------------------------
    ("time-inflation", r"\b(?:a (?:month|few months|while) ago|for a long time|all year|recently|these days)\b", "ground the duration or drop it"),
    # --- aphoristic closer ---------------------------------------------------
    ("aphorism", r"\bthe\s+kind\s+of\s+\w+\s+that\b[^.]{0,60}\band\s+is\s+not\b", "X that looks like Y and is not"),
    ("aphorism", r"\bthe\s+\w+\s+that\s+looks\s+like\s+\w+", "X that looks like Y"),
    ("aphorism", r"\b(?:by\s+a\s+wide\s+margin|was\s+the\s+move)\b", "quotable closer"),
    ("aphorism", r"\bthe\s+(?:entire|whole)\s+\w+\s+of\s+the\s+thing\b", "quotable closer"),

    # --- staging (more) ------------------------------------------------------
    ("staging", r"\b(?:here|this)\s+is\s+what\s+[^.]{0,60}\blooks?\s+like\b", "here is what X looks like"),
    ("staging", r"\bthen\s+the\s+(?:useful|real|interesting)\s+question\b", "heralding your own question"),
    ("staging", r"\b(?:Here|This)\s+is\s+what\s+[^.\n]{0,60}:", "announces a list before giving it"),
    ("staging", r"\bwhich\s+(?:was|is)\s+this\s*:", "withheld payload — the colon buys a beat"),
    ("staging", r"\bthat'?s\s+not\s+quite\s+right\b", "self-correcting opener — the correction is the sentence; the error was supplied"),

    # ===== entries 24-36: encyclopedic and chatbot patterns ==================

    # --- copula avoidance ----------------------------------------------------
    ("copula", r"\b(?:serves?|stands?|acts?)\s+as\s+(?:a|an|the)\b", "serves as — use is"),
    ("copula", r"\bboasts?\s+(?:a|an|the|over|more than|some|\d)", "boasts — use has"),
    ("copula", r"\b(?:it|which|that|the\s+\w+)\s+features\s+(?:a|an|the|over|\d)", "features — use has"),
    ("copula", r"\b(?:represents?|represented|marks?|marked)\s*(?:,\s*[^,\n]{0,45},)?\s*(?:a|an|the)\s+(?:kind|sort|type)\s+of\b", "represents a kind of X — use is"),
    ("copula", r"\b(?:represents|represented|marks|marked)\s*(?:,\s*[^,\n]{0,45},)?\s*(?:a|an|the)\s+(?:shift|turning point|milestone|step|departure|moment|horizon|threshold)\b", "represents a shift"),

    # --- participle tail -----------------------------------------------------
    ("participle", r",\s*(?:highlight|underscor|emphasiz|reflect|symboliz|showcas|ensur|foster|cultivat|encompass|solidif|cement|underlin)\w*ing\b", "participle tail asserting significance"),
    ("participle", r",\s*contributing\s+to\b", "participle tail asserting significance"),
    ("participle", r",\s+\w{3,}ing\b[^.!?\n]{0,70}[.!?]", "participle tail at sentence end — cut it, or make the claim its own sentence"),

    # --- false range ---------------------------------------------------------
    ("false-range", r"\bfrom\s+[^,.;]{3,45}\s+to\s+[^,.;]{3,45},\s*from\s+", "stacked from-X-to-Y ranges"),
    ("false-range", r"\b(?:everything|anything|ranging)\s+from\b[^.]{0,60}\bto\b", "false range — list the items"),
    ("false-range", r"^From\s+the\s+[^,.;\n]{3,45}\s+to\s+the\s+[^,.;\n]{3,45},", "sentence-initial from-X-to-Y — check X and Y are endpoints of something"),

    # --- inline-header list --------------------------------------------------
    ("list-shape", r"^\s*[-*+]\s+\*\*[^*\n]{2,45}\*\*\s*:", "inline-header bullet — the label restates the item"),
    ("list-shape", r"^\s*[-*+]\s+\*\*[^*\n]{2,45}:\*\*", "inline-header bullet — the label restates the item"),
    ("list-shape", r"^\s*[-*+]\s+\*\*(\w{4,})[^*\n]{0,44}\*\*\s*:?\s+(?:the|a|an)?\s*\1\b", "the bold label restates the item — an outline showing through the prose"),

    # --- chatbot residue -----------------------------------------------------
    ("chatbot", r"\b(?:great|excellent|good)\s+question\b", "chatbot residue"),
    ("chatbot", r"\byou'?re\s+absolutely\s+right\b", "chatbot residue"),
    ("chatbot", r"\bI\s+hope\s+this\s+helps\b", "chatbot residue"),
    ("chatbot", r"\blet\s+me\s+know\s+if\s+you'?d\b", "chatbot residue"),
    ("chatbot", r"\b(?:would|do)\s+you\s+(?:like|want)\s+me\s+to\b", "chatbot residue"),
    ("chatbot", r"\bwant\s+me\s+to\s+(?:give|show|expand|continue|explain)\b", "chatbot residue"),
    ("chatbot", r"\b(?:should|shall)\s+I\s+continue\b", "chatbot residue"),
    ("chatbot", r"^\s*(?:Certainly|Of course|Absolutely)[!,]", "chatbot residue"),
    ("chatbot", r"\bhere\s+is\s+an\s+overview\s+of\b", "chatbot residue"),

    # --- filler and hedge stacking -------------------------------------------
    ("filler", r"\bin\s+order\s+to\b", "in order to — use to"),
    ("filler", r"\bdue\s+to\s+the\s+fact\s+that\b", "due to the fact that — use because"),
    ("filler", r"\bat\s+this\s+point\s+in\s+time\b", "at this point in time — use now"),
    ("filler", r"\bin\s+the\s+event\s+that\b", "in the event that — use if"),
    ("filler", r"\bhas\s+the\s+ability\s+to\b", "has the ability to — use can"),
    ("filler", r"\bit\s+is\s+important\s+to\s+note\s+that\b", "delete the frame, keep the claim"),
    ("filler", r"\b(?:could|might|may|can)\s+(?:potentially|possibly|arguably|conceivably)\b", "stacked hedges — one carries the uncertainty"),
    ("filler", r"\bpotentially\s+possibly\b", "stacked hedges"),
    ("filler", r"\bin\s+its\s+own\s+way,?\s+a\s+kind\s+of\b", "double hedge on a plain noun"),

    # --- speculative gap-filling ---------------------------------------------
    ("gap-fill", r"\bmaintains?\s+a\s+low\s+profile\b", "stock filler for an absent source"),
    ("gap-fill", r"\bkeeps?\s+(?:personal\s+)?details?\s+private\b", "stock filler for an absent source"),
    ("gap-fill", r"\b(?:is|are)\s+not\s+publicly\s+available\b", "say what is not known, or cut"),
    ("gap-fill", r"\bbased\s+on\s+(?:the\s+)?available\s+information\b", "meta-sentence about the search, not the subject"),
    ("gap-fill", r"\bas\s+of\s+my\s+last\s+(?:update|training)\b", "knowledge-cutoff disclaimer"),
    ("gap-fill", r"\bdetails\s+(?:about|are)[^.]{0,50}\b(?:limited|scarce|not\s+extensively)\b", "meta-sentence about the search"),
    ("gap-fill", r"\bit\s+is\s+believed\s+that\b", "unsourced guess"),
    ("gap-fill", r"\blikely\s+(?:grew\s+up|studied|began|started|attended)\b", "unsourced guess about a person"),

    # --- diff-anchored documentation -----------------------------------------
    ("diff-anchored", r"\b(?:was|were)\s+added\s+to\s+(?:replace|fix|handle|support)\b", "documents the change, not the thing"),
    ("diff-anchored", r"\bthe\s+(?:previous|old|former)\s+(?:approach|implementation|version|behaviour|behavior|method)\b", "documents the change, not the thing"),
    ("diff-anchored", r"\bhas\s+(?:since\s+)?been\s+(?:updated|changed|replaced|refactored)\s+to\b", "documents the change, not the thing"),
    ("diff-anchored", r"\bwe\s+now\s+(?:use|do|call|store|write)\b", "documents the change, not the thing"),

    # --- subjectless fragment ------------------------------------------------
    ("subjectless", r"\bNo\s+\w+(?:\s+\w+){0,2}\s+(?:needed|required)\s*[.!]", "subjectless claim — name the actor"),
    ("subjectless", r"\b(?:is|are)\s+\w+ed\s+automatically\b", "subjectless claim — who does it?"),

    # --- welded epigram (entry 39) -------------------------------------------
    ("aphorism", r",\s*so\s+(?:a|an|the|it|they|you)\s+[^.]{0,50}\bnever\b[^.]{0,40}\.", "welded epigram — second clause restates the first as a maxim"),
    ("aphorism", r",\s*and\s+(?:the|its)\s+(?:failure|error|cost|risk|difference|effect|result|damage|loss)\s+[^.]{0,40}\bis\b[^.]{0,30}\.", "welded epigram — second clause generalizes the first"),
    ("aphorism", r",\s*(?:so|and)\s+nothing\s+\w+s\b[^.]{0,40}\.", "welded epigram — 'and nothing X's' closer"),

    # --- spec-ese (entry 40) --------------------------------------------------
    ("spec-ese", r"(?:^|[.!?]\s+)That\s+(?:child|session|process|container|job|worker|request|instance|delegate)\b(?!'s)", "demonstrative subject for a thing already named — use 'it'"),
    ("spec-ese", r"\bdoes\s+not\s+itself\b", "reflexive-emphatic formality"),
    ("spec-ese", r"\b(?:idles?|sits?|waits?)\s+awaiting\b", "latinate state verb plus participle tail"),
    ("spec-ese", r"\bawaiting\s+(?:input|instructions|a\s+\w+|the\s+\w+)\b", "awaiting — say what the reader has to do"),
    ("spec-ese", r"\b(?:holds|carries|comprises|obtains)\s+no\s+\w+", "latinate state verb — say what is not there"),
    ("spec-ese", r"\bnever\s+carries\s+a\b", "latinate state verb for a permission or flag"),

    # --- contents-list standfirst (entry 42) ----------------------------------
    ("announce", r"^[^.\n]{10,90},\s*plus\s+the\s+\w+", "'X, plus Y' standfirst — a contents list shaped as a sentence"),
    ("announce", r",\s*(?:plus|and)\s+the\s+\w+\s+(?:the|that|which)\s+\w+\s+(?:leaves?|skips?|misses?|omits?)\b", "coy reduced relative — name what is in it"),

    # --- predicate-position hyphenation --------------------------------------
    ("hyphenation", r"\b(?:is|are|was|were|feels?|seems?)\s+(?:high-quality|cross-functional|data-driven|end-to-end|real-time|long-term|well-known|client-facing|decision-making|third-party|open-source)\b", "drop the hyphen after the noun"),

    # --- flat certainty (entries 43-47) ---------------------------------------
    # Corpus-derived; references/corpus.md. Each fires on a shape, never on a
    # word alone: an adverb needs a verb to modify, a privative needs a copula.
    ("flat-certainty", r"\b(?:plainly|quietly|outright|merely|provably|demonstrably|empirically|vacuously|adversarially|legitimately|structurally)\s+(?=\w)", "flat-certainty adverb — say what makes it true, or cut it"),
    ("flat-certainty", r"\b(?:is|are|was|were|reads?|remains?|stays?)\s+(?:plainly|quietly|merely|genuinely|outright)\b", "adverb asserting the reader's reaction"),
    ("flat-certainty", r"\b(?:deliberately|genuinely|honestly|routinely|silently|identically|precisely)\s+\w+(?:ed|ing|s)\b", "flat-certainty adverb on a verb — check it names a contrast the reader can check"),

    ("juridical", r"\b(?:the\s+)?\w+\s+(?:refuses|declines|admits|rules|ratifies|sanctions|honou?rs|forbids|governs|decides|settles)\s+(?:the|a|an|any|no|that|it)\b", "juridical verb — name the mechanism and its exit condition"),
    ("juridical", r"\b(?:a|the|its|this|that|one)\s+(?:refusal|ruling|verdict|precedent|carve-out|remedy|obligation|standing|grounds)\b", "juridical noun for a program state"),
    ("juridical", r"\b(?:has|have|had|lacks?|without|no)\s+standing\b", "standing — say what the caller is missing"),

    ("verification", r"\b(?:byte|bit)-(?:identical|exact|identity|for-byte)\b", "verification compound — put the diff or the number beside it"),
    ("verification", r"\bbyte-for-byte\b", "verification compound — put the diff beside it"),
    ("verification", r"\bmutation-(?:checked|verified|tested|proof)\b", "mutation compound — say what the run killed and what survived"),
    ("verification", r"\b(?:live|hand|cross|independently|adversarially)-(?:verified|checked|tested|confirmed|audited)\b", "verification compound — state what was run and what came back"),
    ("verification", r"\bre-(?:derived?|derives|deriving|verified|verifies|measured|measures|checked|confirmed|read|reads)\b", "re- prefix claims a second pass — say what the second pass did differently"),
    ("verification", r"\broot-caused\b", "root-caused — name the cause"),

    ("privative", r"\b(?:is|are|was|were|remains?|stays?|left|leaves?)\s+(?:ungated|unguarded|unwired|uncapped|unbuilt|unparseable|unverifiable|unmeasured|unresolvable|vacuous|inert)\b", "privative coinage — say what is missing, and where"),
    ("privative", r"\b(?:an?|the|three|two|several|most|all)\s+(?:ungated|unguarded|unwired|uncapped|unbuilt|unmeasured|unverifiable)\s+\w+", "privative coinage naming a thing by what was not done to it"),

    ("exhaustive", r"\bnothing\s+(?:in|else|about|here|there)\b[^.]{0,60}\b(?:does|is|can|could|would|varies|reaches|touches|explains)\b", "exhaustive negation — state the scope you checked"),
    ("exhaustive", r"\bnowhere\s+(?:else|in|for|to)\b", "nowhere — a universal over an unnamed search"),
    ("exhaustive", r"\b(?:no|not\s+a\s+single)\s+(?:path|caller|branch|test|case|line|file)\s+\w+s\b", "universal negative — bound it to a set the reader can see"),
    ("exhaustive", r"\bcan\s+never\b|\bwill\s+never\b|\bnever\s+(?:fires|happens|reaches|runs|returns)\b", "never — an absolute is the most expensive claim and the cheapest to assert"),

    # ===== entries 48-52: the confiding-essayist register ====================
    # Ported from Simon Willison's llm-cliche-highlighter, 2026-08-27. The
    # shapes there are tuned for essays; several are narrowed here to keep the
    # false-positive budget on technical prose. references/register.md says
    # which, and why.

    ("candour", r"\bI\s+(?:will\s+not|won'?t)\s+pretend\b", "announced sincerity — show it instead"),
    ("candour", r"\b(?:I'?ll|let'?s|to)\s+be\s+(?:honest|clear|blunt|real)\b", "announced sincerity — the sentence after this is the one you meant to write"),
    ("candour", r"(?:^|[.!?\u2013\u2014]\s+)(?:honestly|look|truthfully|frankly)\s*,", "confiding opener — delete it and keep the sentence"),
    ("candour", r"\b(?:you\s+)?(?:do\s+not|don'?t)\s+(?:have\s+to\s+)?take\s+my\s+word\s+for\b", "invitation to verify with nothing to verify against — link the thing"),

    ("reversal", r"[;:,]\s+[^.;:!?\n]{2,50}\s(?:did|does|do|was|were|is|are|has|have|had|can|could|would|will)(?:n'?t|\s+not)\s*[.;]", "clause landing on a bare auxiliary — say what the second half claims"),
    ("reversal", r"[.!?]\s+[A-Z][^.;:!?\n]{2,40}\s(?:did|does|was|were|is|are|has|have|had|can|could|would|will)(?:n'?t|\s+not)\s*\.", "sentence landing on a bare auxiliary — the verb is elided and the beat is doing the work"),
    ("reversal", r"\b(?:maybe|perhaps)\s+\w+[^.!?\n]{0,40}\s(?:would|could|might|should|did|had|was|is)(?:n'?t)\s+(?:have\s*)?\.", "speculative reversal on a stranded auxiliary"),

    ("retroactive", r"\b(?:that|this|which)(?:'?s|\s+(?:is|was))\s+why\b[^.!?\n]{0,80}?\b(?:matter(?:s|ed)|count(?:s|ed))\b", "grading a passage the reader has already read"),

    ("totalizing", r"(?<!here)(?:\b(?:is|was|are|were)|'?s)\s+the\s+(?:whole|entire)\s+(?:point|game|thing|trick|pitch|idea|story|premise|argument|bug|business\s+model)\b", "the whole point — claims a total where a part was shown"),
    ("totalizing", r"\bthe\s+(?:whole|entire)\s+(?:point|game|trick|pitch|premise|argument|business\s+model)\s+(?:is|was)\b", "the whole point is — the flipped twin"),
    ("totalizing", r"\bhere(?:'?s|\s+is)\s+the\s+(?:whole|entire)\s+\w+", "here's the whole X — a total announced, not shown"),
    ("totalizing", r"\bthe\s+only\s+[\w'-]+(?:\s+[\w'-]+){0,2}?\s+(?:I|you|we|they)\s+(?:trust|need|needs|want|wants|use|uses|care|believe)\b", "narrowing superlative over an unnamed set"),
    ("totalizing", r"\bthe\s+only\s+[\w'-]+\s+that\s+(?:matters|counts|works|survives)\b", "narrowing superlative — name the set or drop the only"),

    ("obituary", r"\blong\s+live\s+\w+", "obituary headline — name what changed"),
]

HTML_HEADING_RE = re.compile(r"<h([1-6])\b[^>]*>(.*?)</h\1>", re.S | re.I)
HTML_MASTHEAD_RE = re.compile(
    r'<[^>]+class="[^"]*\b(subtitle|eyebrow|post-meta)\b[^"]*"[^>]*>(.*?)</', re.S | re.I)
HTML_BLOCK_RE = re.compile(r"<(p|li|figcaption|summary)\b[^>]*>(.*?)</\1>", re.S | re.I)
HTML_DROP_RE = re.compile(r"<(script|style|pre|code)\b.*?</\1>", re.S | re.I)
HTML_ENTITIES = {"&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
                 "&quot;": '"', "&#39;": "'", "&#8212;": "\u2014", "&mdash;": "\u2014"}


def looks_like_html(text: str) -> bool:
    head = text[:4000].lower()
    return "<html" in head or "<!doctype html" in head or bool(HTML_HEADING_RE.search(text))


def _detag(fragment: str) -> str:
    out = re.sub(r"<[^>]+>", " ", fragment)
    for ent, ch in HTML_ENTITIES.items():
        out = out.replace(ent, ch)
    return re.sub(r"\s+", " ", out).strip()


def html_to_lines(text: str) -> str:
    """Flatten HTML into the line-oriented prose the rules expect.

    Headings become markdown headings so the header rules see them, and
    composing-html's masthead classes are treated as headings too — a subtitle
    is a header by every test that matters. Line numbers refer to this
    flattened view, not the source file.
    """
    text = HTML_DROP_RE.sub(" ", text)
    parts: list[tuple[int, str]] = []
    for m in HTML_HEADING_RE.finditer(text):
        parts.append((m.start(), "#" * int(m.group(1)) + " " + _detag(m.group(2))))
    for m in HTML_MASTHEAD_RE.finditer(text):
        parts.append((m.start(), "## " + _detag(m.group(2))))
    for m in HTML_BLOCK_RE.finditer(text):
        parts.append((m.start(), _detag(m.group(2))))
    lines = [t for _, t in sorted(parts) if t.strip(" #")]
    return "\n\n".join(lines) + "\n"


HEADER_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*$")
COY_HEADER_RE = re.compile(r"^(?:what|why|how)\b(?!.*\?$)", re.I)
VERDICT_HEADER_RE = re.compile(r"\b(?:is|are|isn'?t|aren'?t|was|wasn'?t|does|doesn'?t|actually|really|wrong|right|matters|counts)\b", re.I)

_NOM = r"(?:ship|tion|sion|ment|ance|ence|ity|ness)"
# Fires on a nominalization with a prepositional tail ("Authorship in a sourced
# child") or a two-word modifier+abstraction label ("Spawn availability"). A bare
# one-word nominalization is a legitimate label for a term the document defines
# — "Overcorrection", "Calibration", "Provenance" — and must not fire.
NOMINAL_HEADER_RE = re.compile(
    r"^(?:(?:\w+\s+){0,2}\w+" + _NOM + r"\s+(?:in|of|for|between|across|under)\b"
    r"|\w+\s+\w+" + _NOM + r"\s*$)", re.I)
GERUND_HEADER_RE = re.compile(r"^\w+ing\s+(?:a|an|the)\b", re.I)

# Entry 52. Inline "X is dead" is left alone — a dead process is a dead process.
# In a header the phrase is only ever the obituary shape.
OBITUARY_HEADER_RE = re.compile(r"\b(?:is|are)\s+dead\b|\blong\s+live\b|^(?:the\s+)?death\s+of\b", re.I)

TITLE_CASE_SKIP = {
    "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into",
    "nor", "of", "on", "onto", "or", "over", "the", "to", "up", "via", "with",
}
# Emoji-presentation blocks only. An earlier version included U+2190-U+21FF and
# U+2300-U+23FF, so a plain -> arrow or a technical symbol reported as decoration.
EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF☀-➿]|.️"
)

CATEGORY_ORDER = [
    "negation-first", "significance", "agency", "deferred-noun", "announce", "locator",
    "staging", "triad", "em-dash", "aphorism", "rhetorical-q", "self-grading", "humility", "throat-clearing",
    "rtfm", "dev-cliche", "slop", "editorializing", "time-inflation",
    "copula", "participle", "false-range", "list-shape", "chatbot", "filler",
    "gap-fill", "diff-anchored", "subjectless", "hyphenation", "spec-ese",
    "flat-certainty", "juridical", "verification", "privative", "exhaustive",
    "candour", "reversal", "retroactive", "totalizing", "obituary",
    "header", "typography", "cadence", "reuse", "density",
]

# A one-line paragraph that is a line of dialogue is a line of dialogue.
DIALOGUE_RE = re.compile("^[\"\u201c\u2018']|[\"\u201d'](\\s*,)?\\s*(\\w+\\s+)?(said|asked|replied|answered)\\b")

# The 150 highest-lift words of the fastest-growing cluster in Louis Abraham's
# load-bearing corpus of GitHub pull request descriptions (analysis.js generated
# 2026-08-28: 461,121 descriptions, 85 whole weeks, the cluster 0.70% of the
# first eight weeks and 39.5% of the last four). Used ONLY for the rate in
# scan_density — never as a blocklist. Every word here is a word a person
# writes, and load-bearing's own human-written README scores above this skill's
# SKILL.md on it. references/corpus.md carries the method and the limits, and
# how to regenerate this list from a fresh analysis.js.
CORPUS_LEAD = frozenset("""
admits alone argued armed arms asserted asserts asymmetry backstop bit-identical
bites byte-for-byte byte-identical carried carries carrying carve-out ceiling
cheap chokepoint cited cites contradicted contradicting decides declines defect
defects degrades deliberate deliberately died disagree disagreed disagreement
drains drifted eleven empirically escalates ever faithful falsified filed folded
folds forever genuine genuinely half halves handed held holds honest honestly
honoured indistinguishable inert judged landed lands legitimately lever
load-bearing loses loud loudly machinery mattered measured merely minted mints
mutation-checked mutation-tested mutation-verified never nine nobody nothing
nowhere obligation opposite outright owed parked plainly pre-fix precedent
precisely predates premise probed provably proven proves quietly re-derived
re-derives re-measured re-read re-verified reaches reaped reds refusal refusals
refused refuses refusing refuted remedy reproduces restated rests retires rides
ruling rung says seam self-heals settles short-circuits sitting spellings stamped
stamps standing stranded structurally survived survives surviving sweep symptom
thirteen throwaway told ungated unguarded vacuous vacuously walked wedge wedged
whoever whose worse
""".split())

CORPUS_WORD_RE = re.compile(r"[a-z0-9/_-]*[a-z][a-z0-9/_-]*")

STOPWORDS = frozenset(
    "the a an and or but if of to in for on at by is are was were be been it its "
    "this that these those as with from not no so then than there here".split()
)

COMPILED = [(cat, re.compile(pat, re.I | re.M), note) for cat, pat, note in RULES]


def _blank_quoted(text: str) -> str:
    """Blank out quoted specimens, preserving line numbering."""
    def blank(m: re.Match) -> str:
        return "\n" * m.group(0).count("\n")

    # Blockquotes and table rows go first. Doing this after the span pass let a
    # bold marker inside a table cell mis-pair the italic regex across lines,
    # leaving the row's own specimens visible to the scanner.
    text = "\n".join("" if ln.lstrip().startswith((">", "|")) else ln
                     for ln in text.splitlines())
    text = re.sub(r"```.*?```", blank, text, flags=re.S)       # fenced code
    text = re.sub(r"`[^`\n]+`", blank, text)                   # inline code span
    text = re.sub(r"(?<!\*)\*[^*]+\*(?!\*)", blank, text)      # *italic*, may wrap lines
    return re.sub(r"<q>.*?</q>", blank, text, flags=re.S)


def scan_lines(text: str) -> list[dict]:
    hits: list[dict] = []
    lines = text.splitlines()

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        for cat, rx, note in COMPILED:
            for m in rx.finditer(line):
                hits.append({
                    "line": i, "category": cat, "note": note,
                    "col": m.start(), "match": m.group(0).strip()[:90],
                })

        # headers
        h = HEADER_RE.match(line)
        if h:
            title = h.group(2).strip().rstrip("#").strip()
            if "," in title:
                hits.append({"line": i, "category": "header",
                             "note": "comma-clause header — no real person puts sentence clauses in a headline",
                             "match": title[:90]})
            if OBITUARY_HEADER_RE.search(title):
                hits.append({"line": i, "category": "obituary",
                             "note": "obituary headline — a verdict in a form built to overstate; name what changed",
                             "match": title[:90]})
            elif COY_HEADER_RE.match(title):
                hits.append({"line": i, "category": "header",
                             "note": "coy header — could top three different sections; name the content",
                             "match": title[:90]})
            elif not title.endswith("?") and VERDICT_HEADER_RE.search(title) and len(title.split()) > 3:
                hits.append({"line": i, "category": "header",
                             "note": "thesis-shaped header — states a verdict instead of labelling",
                             "match": title[:90]})
            elif NOMINAL_HEADER_RE.match(title) or GERUND_HEADER_RE.match(title):
                hits.append({"line": i, "category": "header",
                             "note": "nominalized header — names a topic area, not the content "
                                     "(the standard overcorrection from a verdict header)",
                             "match": title[:90]})
            words = title.split()
            minor = [w for w in words[1:] if w.lower() not in TITLE_CASE_SKIP]
            if len(words) > 3 and minor and all(
                w[:1].isupper() and not w.isupper() for w in minor
            ):
                hits.append({"line": i, "category": "typography",
                             "note": "Title Case heading — sentence case unless the document says otherwise",
                             "match": title[:90]})

        # drama line break: very short standalone paragraph
        if stripped and not stripped.startswith(("#", "-", "*", ">", "|", "`")):
            prev_blank = i == 1 or not lines[i - 2].strip()
            next_blank = i >= len(lines) or not lines[i].strip()
            words = len(stripped.split())
            if (prev_blank and next_blank and words <= 8
                    and stripped.endswith((".", "!"))
                    and not DIALOGUE_RE.search(stripped)):
                hits.append({"line": i, "category": "cadence",
                             "note": "one-line paragraph — gravitas beat unless it is a real pivot",
                             "match": stripped[:90]})

    hits.extend(_fragment_runs(text))
    hits.extend(_anaphora_runs(text))
    hits.extend(_echo_runs(text))
    hits.extend(_question_runs(text))
    return hits


def _anaphora_runs(text: str) -> list[dict]:
    """Three units in a row opening on the same two words.

    Across sentences this is the `It was a message. It was a permission slip.
    It was an out.` shape; within one sentence it is `something to X, something
    to Y, something to Z`. Both are entry 26 with the parallelism carried by
    the opening rather than by a comma list, and neither is reachable by the
    triad regex.
    """
    out = []
    line_no = 1

    def key(unit: str) -> str:
        return " ".join(unit.lower().split()[:2]).strip(",;:.\"'()")

    for para in re.split(r"\n\s*\n", text):
        n = para.count("\n") + 1
        if not para.strip().startswith(("#", "-", "*", ">", "|", "`")):
            sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", para.strip()) if s.strip()]
            for scope, units in (("sentences", sents),
                                 *(("clauses", [c.strip() for c in re.split(r"[,;]\s+", s) if c.strip()])
                                   for s in sents)):
                keys = [key(u) for u in units]
                run = 1
                for i in range(1, len(keys)):
                    run = run + 1 if keys[i] and keys[i] == keys[i - 1] else 1
                    if run == 3:
                        out.append({
                            "line": line_no, "category": "triad",
                            "note": f"three consecutive {scope} opening on the same two words — "
                                    "forced triad carried by anaphora",
                            "match": f"{keys[i]!r} x3: {units[i][:60]}",
                        })
                        break
        line_no += n + 1
    return out


ECHO_WORD = re.compile(r"[a-z0-9\u2019'-]+")


def _echo_runs(text: str, min_gram: int = 5, min_share: float = 0.5) -> list[dict]:
    """Consecutive sentences built on the same skeleton.

    The third shape of entry 26. Anaphora keys on the opening words and the
    triad regex on the commas; this keys on a run of words reused anywhere in
    the sentence — `A shopping cart is an object in the system. A chat room is
    an object in the system.` A reader who has read the first has read the
    second.

    Two thresholds, both needed. `min_gram` is 5 rather than the 4 the source
    tool uses, and the run must also cover `min_share` of the shorter sentence.
    A shared five-word run alone is an idiom, not a template: on 181,000 words
    of Python stdlib docstrings the gram test alone fires 91 times, on phrases
    like "is the same as using" inside sentences that are otherwise unalike.
    Requiring half the shorter sentence takes that to single figures and still
    catches the filled template, where the shared run is most of both.
    """
    out = []
    line_no = 1

    def longest_run(a: list[str], b: list[str]) -> tuple[int, int]:
        """Longest common contiguous run, and where it starts in `a`."""
        best, best_i = 0, 0
        prev = [0] * (len(b) + 1)
        for i in range(1, len(a) + 1):
            cur = [0] * (len(b) + 1)
            for j in range(1, len(b) + 1):
                if a[i - 1] == b[j - 1]:
                    cur[j] = prev[j - 1] + 1
                    if cur[j] > best:
                        best, best_i = cur[j], i - cur[j]
            prev = cur
        return best, best_i

    for para in re.split(r"\n\s*\n", text):
        n = para.count("\n") + 1
        if not para.strip().startswith(("#", "-", "*", ">", "|", "`")):
            sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", para.strip()) if s.strip()]
            words = [ECHO_WORD.findall(s.lower()) for s in sents]
            for i in range(1, len(sents)):
                a, b = words[i - 1], words[i]
                shorter = min(len(a), len(b))
                if shorter < 6:
                    continue
                run, at = longest_run(a, b)
                if run >= min_gram and run >= min_share * shorter:
                    out.append({
                        "line": line_no, "category": "triad",
                        "note": f"two consecutive sentences sharing a {run}-word run that is "
                                f"{run / shorter:.0%} of the shorter one — echoing skeleton, "
                                "entry 26's third shape",
                        "match": f"{' '.join(a[at:at + run])!r}: {sents[i][:60]}",
                    })
                    break
        line_no += n + 1
    return out


def _question_runs(text: str, min_run: int = 2, tail_words: int = 6) -> list[dict]:
    """Two or more questions in a row where the later ones are fragments.

    Entry 10 without the fragment answer. `Do I know how it works? Where it
    breaks? Which corners it cut?` — the second and third have no verb of their
    own and ride on the first.

    The run alone is not enough. Two full questions in sequence is how a person
    changes subject: *So, what's next? Is this a project that starts and ends
    with DeepSeek v4 Flash?* is in `tests/sample-clean.md` and must stay silent.
    What makes the run a tic is a clipped question after the first, so the rule
    requires one.
    """
    out = []
    line_no = 1
    for para in re.split(r"\n\s*\n", text):
        n = para.count("\n") + 1
        if not para.strip().startswith(("#", "-", "*", ">", "|", "`")):
            sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", para.strip()) if s.strip()]
            run: list[str] = []
            for s in sents:
                run = run + [s] if s.endswith("?") else []
                if (len(run) >= min_run
                        and any(len(q.split()) <= tail_words for q in run[1:])):
                    out.append({"line": line_no, "category": "rhetorical-q",
                                "note": f"{len(run)} questions in a row, at least one of them clipped — "
                                        "stacked rhetorical questions; an interview or a FAQ is the "
                                        "earned case",
                                "match": s[:90]})
                    break
        line_no += n + 1
    return out


def _fragment_runs(text: str) -> list[dict]:
    """Three or more short sentences in a row inside one paragraph."""
    out = []
    line_no = 1
    for para in re.split(r"\n\s*\n", text):
        n = para.count("\n") + 1
        if not para.strip().startswith(("#", "-", "*", ">", "|", "`")):
            sents = [x.strip() for x in re.split(r"(?<=[.!?])\s+", para.strip()) if x.strip()]
            run = 0
            for x in sents:
                run = run + 1 if len(x.split()) <= 8 else 0
                if run == 3:
                    out.append({"line": line_no, "category": "cadence",
                                "note": "three or more short sentences in a row — fragment cadence, write it as one sentence",
                                "match": para.strip()[:90]})
                    break
        line_no += n + 1
    return out


def scan_reuse(hits: list[dict]) -> list[dict]:
    """Constructions the document uses more than once.

    Emphasis is a budget. One `the part that` is emphasis; three is a habit,
    and it is the cheapest structural tic to catch because you only have to
    count. This adds no rules — it groups the hits already found.
    """
    groups: dict[tuple[str, str], list[int]] = {}
    seen: set[tuple] = set()
    for h in hits:
        if h["category"] in {"density", "typography", "reuse"} or not h["line"]:
            continue
        norm = " ".join(h["match"].lower().split())[:40]
        # two rules firing on one span is one instance, not a repetition. Hits
        # from the header and cadence scans carry no offset, so fall back to the
        # matched text, which is the whole line for those.
        ident = (h["category"], h["line"], h["col"] if h.get("col") is not None else norm)
        if ident in seen:
            continue
        seen.add(ident)
        groups.setdefault((h["category"], norm), []).append(h["line"])

    out = []
    for (cat, match), lines in groups.items():
        if len(lines) < 2:
            continue
        where = ", ".join(f"L{n}" for n in sorted(lines))
        out.append({"line": 0, "category": "reuse",
                    "note": f"[{cat}] used {len(lines)} times ({where}) — "
                            "reuse is the evidence that a construction is a habit, not a choice",
                    "match": match})
    return out


def scan_density(text: str) -> list[dict]:
    out = []
    body = re.sub(r"```.*?```", "", text, flags=re.S)
    # headings, table rows and list bullets are not sentences
    body = "\n".join(ln for ln in body.splitlines()
                      if not ln.lstrip().startswith(("#", "|", "-", "*", ">")))
    words = len(body.split()) or 1

    dashes = len(re.findall(r"—|(?<= )--(?= )", body))
    per150 = dashes / words * 150
    if per150 > 1.0:
        out.append({"line": 0, "category": "density",
                    "note": f"{dashes} em-dashes in {words} words ({per150:.1f} per 150) — above ~1.0 reads machine-written",
                    "match": "em-dash density"})

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", body) if s.strip()]
    frags = [s for s in sentences if 1 <= len(s.split()) <= 5 and not s.startswith(("#", "-", "|"))]
    if sentences and len(frags) / len(sentences) > 0.12:
        out.append({"line": 0, "category": "density",
                    "note": f"{len(frags)} of {len(sentences)} sentences are <=5 words — check for fragment cadence",
                    "match": "fragment density"})

    curly = len(re.findall(r"[“”‘’]", body))
    if curly:
        out.append({"line": 0, "category": "typography",
                    "note": f"{curly} curly quote characters — straight quotes in anything a program reads. "
                            "Not a tell on its own: most editors curl by default",
                    "match": "curly quotes"})

    emoji = EMOJI_RE.findall(text)
    if emoji:
        out.append({"line": 0, "category": "typography",
                    "note": f"{len(emoji)} emoji — decoration on headings and bullets is a tell "
                            "unless the document already uses them",
                    "match": "".join(sorted(set(emoji))[:12])})

    if len(sentences) >= 10:
        openings: dict[str, int] = {}
        for s in sentences:
            k = " ".join(s.lower().split()[:2]).strip(",;:.\"'()")
            if k:
                openings[k] = openings.get(k, 0) + 1
        floor = max(3, len(sentences) * 0.03)
        hot = sorted((n, k) for k, n in openings.items() if n >= floor)
        if hot:
            worst = ", ".join(f"{k!r} x{n}" for n, k in reversed(hot[-3:]))
            out.append({"line": 0, "category": "density",
                        "note": f"repeated sentence openings: {worst} — anaphora spread across a "
                                "document is the diffuse form of the forced triad",
                        "match": "opening repetition"})

    toks = re.findall(r"[a-z']+", body.lower())
    grams: dict[tuple[str, ...], int] = {}
    for i in range(len(toks) - 2):
        g = tuple(toks[i:i + 3])
        if not all(w in STOPWORDS for w in g):
            grams[g] = grams.get(g, 0) + 1
    repeats = sorted((n, g) for g, n in grams.items() if n >= 3)
    if repeats:
        worst = ", ".join(f"{' '.join(g)!r} x{n}" for n, g in reversed(repeats[-3:]))
        out.append({"line": 0, "category": "density",
                    "note": f"repeated phrases: {worst} — check each is the deliberate "
                            "repetition entry 27 protects and not a cadence",
                    "match": "phrase repetition"})

    toks_all = CORPUS_WORD_RE.findall(body.lower())
    if len(toks_all) >= 400:
        lead = sum(1 for w in toks_all if w in CORPUS_LEAD)
        per100 = lead / len(toks_all) * 100
        if per100 >= 1.0:
            out.append({"line": 0, "category": "density",
                        "note": f"{lead} of {len(toks_all)} words are top-150 vocabulary of the "
                                f"load-bearing corpus cluster ({per100:.2f} per 100; 46 chunks of human "
                                "stdlib docstrings run 0.08 median, 0.32 at worst) — this locates "
                                "the register, it does not "
                                "detect a machine. Read entries 43 to 47, and do not cut these "
                                "words on sight: references/corpus.md",
                        "match": "corpus-register density"})

    lens = [len(s.split()) for s in sentences]
    if len(lens) > 20:
        mean = sum(lens) / len(lens)
        var = sum((x - mean) ** 2 for x in lens) / len(lens)
        if var ** 0.5 < 5:
            out.append({"line": 0, "category": "density",
                        "note": f"sentence-length sd {var ** 0.5:.1f} — uniform length is its own tell; vary by content",
                        "match": "sentence monotony"})
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path", help="file to scan, or - for stdin")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--quiet-slop", action="store_true", help="hide the slop/editorializing/time categories")
    ap.add_argument("--skip-quoted", action="store_true",
                    help="ignore blockquotes, *italic* spans and table cells — use on docs that quote bad prose as specimens")
    ap.add_argument("--html", action="store_true",
                    help="force HTML flattening (headings, masthead subtitle, block prose)")
    ap.add_argument("--no-html", action="store_true", help="never flatten; scan the raw source")
    args = ap.parse_args()

    text = sys.stdin.read() if args.path == "-" else Path(args.path).read_text(encoding="utf-8")
    if args.html or (not args.no_html and looks_like_html(text)):
        text = html_to_lines(text)
    if args.skip_quoted:
        text = _blank_quoted(text)

    hits = scan_lines(text) + scan_density(text)
    hits += scan_reuse(hits)
    if args.quiet_slop:
        hits = [h for h in hits if h["category"] not in {"slop", "editorializing", "time-inflation"}]

    hits.sort(key=lambda h: (CATEGORY_ORDER.index(h["category"]) if h["category"] in CATEGORY_ORDER else 99, h["line"]))

    if args.json:
        print(json.dumps({"hits": hits, "total": len(hits)}, indent=2))
        return 1 if hits else 0

    if not hits:
        print("no lexical tells found — this says nothing about the structural tics; run the sentence pass anyway")
        return 0

    counts: dict[str, int] = {}
    for h in hits:
        counts[h["category"]] = counts.get(h["category"], 0) + 1

    print(f"{len(hits)} candidates in {len(counts)} categories\n")
    current = None
    for h in hits:
        if h["category"] != current:
            current = h["category"]
            print(f"\n[{current}]  ({counts[current]})")
        loc = f"L{h['line']}" if h["line"] else "  —"
        print(f"  {loc:>6}  {h['match']}")
        print(f"          {h['note']}")

    print("\nCandidates, not verdicts. Check each against references/register.md,")
    print("and note that no regex reaches staged paragraph shape or a staged closer.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
