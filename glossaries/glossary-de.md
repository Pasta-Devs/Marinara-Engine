# German (de) — pack conventions

**Provenance.** This is the *second-generation* German glossary, re-derived on
2026-09-01 after the original working glossaries were lost to temp-directory
cleanup. It was rebuilt from three surviving sources, in authority order:
the **shipped `de/` pack itself** (125 docs — the ground truth), the **decision
write-up of the pack's shipping PR** ([#4157](https://github.com/Pasta-Devs/Marinara-Engine/pull/4157)),
and the **terminology notes from the 2026-09-01 mirror cycle**
(`prd-notes-de.md`). Every prescriptive rule below is either verified against
the pack as shipped — with a cited evidence file, and line numbers where they
pin a single sentence — or explicitly marked as a **recorded ruling** carried
forward from the original cycle (§7 collects all seven). Nothing here is
invented to fill a gap: where the pack is inconsistent, this file says so in §8
rather than pretending a rule exists.

**Verification pass, 2026-09-01.** Every count and absence claim in §§1–6 was
re-measured against the 125 shipped files with a Unicode-aware scanner, and
every cited evidence line was opened. That pass corrected the register counts
in §1, the navigation-separator rule in §3, the `endpoint` and `tool` rows in
§4, and the NBSP claim in §5; it withdrew one residual as a false positive and
added three new ones (7, 8, 9). Where a claim could not be checked from this
branch — anything about `de.json`, `validate-pack.mjs` or `build-manifest.mjs`,
none of which live here — it is now labelled as such at the point of use.

German is language #3 of the FIGS(P) → CJK rollout, and it is the pack that
**originated the anti-calque approach** later languages inherited. That is why
§1's naturalness rule outranks every term row in §4: the terms are the floor,
not the goal.

---

## 1. Register & address

- **Informal, lowercase `du`.** Consistently, in every document class —
  onboarding, reference tables, troubleshooting, and the developer docs under
  `development/`. Evidence: `agents/custom-agents.md:3`
  ("wie **du** in Marinara Engine einen eigenen Agenten baust"),
  `CONFIGURATION.md:37`, `development/frontend.md:397` ("bevor **du** an dieser
  Funktion etwas änderst").
- **Lowercase in mid-sentence, always.** Never the courtesy `Du`/`Dein`/`Dir`
  as a politeness marker. Note the counting trap: a naive
  `\b(Du|Dein|Dir|Dich)\b` grep returns **174 hits**, and **173** of them are
  ordinary sentence-initial capitalisation of the informal pronoun
  ("Du findest sie unter …"), which is correct German. Exactly **one** capital
  falls mid-sentence — `game/map-time-weather.md:30`, inside the gloss
  `**You are here** (Du bist hier)`, where it renders an English UI label and
  is likewise correct. So the rule is real but it is *not* mechanically
  checkable by that grep; see §8 for the anchored version.
- **No `Sie` addressing the reader.** Capitalised `Sie` appears **237** times
  and every one is sentence-initial third person or the plural pronoun; the
  lowercase `sie` adds **839**, `Ihre*` **13**, `Ihnen` **1**. Examples:
  `home/professor-mari.md:79` ("## **Ihre** Änderungen prüfen" = *her* changes,
  Professor Mari's) and `roleplay/getting-started.md:64` ("**Ihre**
  Schaltflächen" = *its* buttons). A `Sie`/`Ihnen` that addresses the reader is
  a defect; see §8 for the verb-anchored grep that finds only those.
- **Imperatives address the reader directly** and are usually the short
  (apocopated) `du`-imperative. `Klick auf …` is **307 occurrences**; counting
  every imperative `Klick` it is ~351, and `Klick` in any function (including
  the noun *ein Klick*, 110) is 461. **`Klicke` appears exactly zero times**
  (`chats/messages.md`, `noodle/settings.md:59`). This one is absolute.
- Other verbs are **mixed and that is accepted**: `Wähle` 123 / `Wähl` 50,
  `Prüfe` 32 / `Prüf` 47, `Setze` 17 / `Setz` 21. Pick by rhythm; do not
  "normalize" an existing file in either direction. `Öffne` (342 as the bare
  imperative, 378 counting inflected `Öffnen`/`Öffnest`) and `Nimm` (60) are
  the settled forms for those two verbs.
- **Tone: warm, plain, second person.** 82 of the 125 files open with the exact
  frame `In dieser Anleitung erfährst du, …` — reuse it verbatim when adding a
  guide, and keep the sentence a promise about *what the reader will learn*,
  never a summary of the feature.
- **Gender-neutrality: soft, never typographic.** The pack uses no Gendersternchen
  (`*innen`), no Binnen-I, no colon or underscore forms. Neutrality is achieved
  lexically where it is natural — `die Erstellerin` in
  `development/hierarchical-locations-prd-v3.md:126` reads as a role noun, not
  a marked form — and otherwise the generic form stands. Do not retro-fit
  gender markers into existing prose; introducing them would break the
  hit-count search and the pack's plain register at once.
- **Reformed orthography only:** `dass` 182 / `daß` 0, `muss` 122 / `muß` 0.
  `ß` is used normally (Germany/Austria spelling, not Swiss `ss`).

---

## 2. Product, feature & mode names

- **`Marinara Engine` and `Marinara` are frozen.** No article, no declension,
  no hyphenated German plural. In compounds the product name hyphenates
  normally: `Marinara-Versionen` (`TROUBLESHOOTING.md:260`),
  `Marinara-Agents` (25×), `Marinara-Server`.
- **The three chat modes stay English:** `Conversation`, `Roleplay`,
  `Game Mode`. This matches the Engine-side change in PR #4157, which kept the
  same three names in the German sidebar map so the docs and the UI agree.
  Evidence: `integrations/discord-mirror.md:3` ("Das klappt in Conversation,
  Roleplay und Game Mode."), `agents/hierarchical-maps.md:287`.
- **Carrier-noun pattern for modes.** A mode name takes a German carrier noun
  by hyphenated compound, never a translated mode name:
  `Conversation-Chat` (63), `Roleplay-Chat(s)` (52), `Game-Chat(s)` (34),
  `Chat-Modus`/`Chat-Modi` (36). Banned: `Rollenspiel-Modus`, `Spielmodus`,
  `Unterhaltungsmodus` — all confirmed absent from the pack.
- **Agent and feature names stay English, unglossed after first use:**
  `Prose Guardian`, `Narrative Director`, `World State`, `Quest Tracker`,
  `Memory Recall`, `Illustrator`, `Music DJ`, `World Maps`, `Noodle`,
  `Professor Mari`, `Local Model`, `Agent Suite`, `Support Diagnostics`
  (`agents/built-in-agents.md`, `TROUBLESHOOTING.md:330`).
  They take German carrier nouns the same way: `Tracker-Agenten` (16),
  `Storyboard-Agenten` (13).
- **`Personal Extensions` is a frozen product name; `Erweiterung` is the
  common noun.** Both live in the pack and they are not interchangeable:
  the feature is `Personal Extensions` (`data/backup-and-restore.md:10`,
  `development/frontend.md:393`), an individual instance in running prose is
  `die Erweiterung` (`data/backup-and-restore.md:75`, "Jede wiederhergestellte
  **Erweiterung** kommt deaktiviert an"). The first mention in a guide gets the
  gloss `**Personal Extensions** (persönliche Erweiterungen)`
  (`extending/personal-extensions.md:3`).
- **`Engine` takes an article when it means the runtime**, not the product,
  and it is **feminine — `die Engine`**: `die Engine` 13, `der Engine`
  (gen./dat.) 19, `von der Engine` (`development/optional-agent-packages.md:62`,
  "Die Sicherheitsregeln **der Engine** haben Vorrang", `:98`). `das/dem/den
  Engine` are absent. The single `vom Engine` at `development/file-storage.md:35`
  is a gender slip, not the pattern — see §8 residual 9.
- **Articles for the frozen English loans** are listed in §4 and are
  load-bearing — `der Prompt`, `das Token`, `das Lorebook`, `das Preset`,
  `der Chat`, `die Persona`, `der Swipe`. Get the gender wrong and the
  declension cascade goes with it.

---

## 3. UI labels & glosses

The pack's single most distinctive convention, and the reason it reads the way
it does: **instructions are written to be followed against the English
interface.** The app ships an incomplete and uneven German UI locale, so the
docs deliberately do *not* mirror it (see §8, tooling traps).

1. **UI labels are byte-exact English in bold.** `**Save**`, `**Download Backup**`,
   `**Max Output Tokens**`, `**Review Agent Outputs**`. Never translated,
   never re-cased, never pluralized into German.
2. **Navigational control labels get a one-time German gloss in parentheses,
   lowercase-or-natural-case, on first use per document:**
   `**Settings** (Einstellungen)`, `**Chat Settings** (Chat-Einstellungen)`,
   `**Appearance** (Darstellung)`, `**Import Character** (Charakter importieren)`,
   `**Extract Colors from Avatar** (Farben aus dem Avatar übernehmen)`
   (`characters/colors-and-stats.md:19`), `**Delete This Branch Only**
   (Nur diese Verzweigung löschen)` (`chats/managing-chats.md:64`). Subsequent
   mentions in the same document drop the gloss.
3. **App-rendered *status* and error strings are bold English with NO gloss.**
   This is the split the mirror cycle re-confirmed: `**Untrusted request host**`
   (`TROUBLESHOOTING.md:103`), `**Save blocked: missing CSRF header**` (L114),
   `**Waiting for vector**` / `**Embedding unavailable**` (L163–164),
   `**Server unreachable**` / `**Unreachable (request timed out)**` (L330),
   `**No API connection configured for this chat**` (L128). A parenthetical
   gloss on a string that already contains parentheses would also collide, so
   the no-gloss rule is mechanical as well as stylistic.
4. **Navigation paths use two co-existing separators, split by where the bold
   starts and stops.** Both are productive; neither is a residual.
   - `>` **between two separate bold spans**: `**Settings** > **Addons**`
     (`data/backup-and-restore.md:75`, `TROUBLESHOOTING.md:129`) — **43**
     occurrences across 7 files.
   - `→` **inside a single bold span**, the usual form for multi-level
     Settings paths: `**Settings → Advanced → Danger Zone**`
     (`TROUBLESHOOTING.md:386`), `**Agents → Download Agents**`
     (`CONFIGURATION.md:20`), `**Chat Settings → Agents → Tracker Agents**`
     (`agents/built-in-agents.md:123`) — **66** occurrences across 21 files.

   A further 21 `→` sit outside bold in unrelated senses (sort orders
   `Name A→Z` at `lorebooks/entries.md:14`, place hierarchies at
   `agents/hierarchical-maps.md:295`, mappings at `lorebooks/entries.md:377`);
   87 arrows in total. Match the file you are editing rather than converting
   between the two forms.
5. **An in-app English string quoted as text (not as a control) goes in German
   quotation marks:** `„Opening chat...“` (`TROUBLESHOOTING.md:330`),
   `„This parameter is sent to the model“` (L129), and the panel heading
   `## Das Panel „Cached prompt injections“`
   (`agents/approvals-and-agent-suite.md:91`).
6. **Untranslated-by-design UI text is never invented around.** If a label has
   no German UI equivalent, it stays English; do not coin one.
7. **Placeholders and literal file/env names stay in backticks and untouched:**
   `` `MARINARA_MAX_RESIDENT_CHATS` ``, `` `~/.marinara-engine/logs/` ``,
   `` `server-*.log` `` (`CONFIGURATION.md:155`, `TROUBLESHOOTING.md:324`).

### The one-time definition pattern

The pack teaches jargon inline, once, in a short appositive sentence right
after first use — this is *why* the loanwords are safe to keep:

> `Ein Token ist ein kleines Textstück, ungefähr ein paar Zeichen lang.`
> — `lorebooks/token-budgets.md:5`

> `Ein Lorebook ist eine Sammlung von Weltwissen, auf die die KI zurückgreifen kann.`
> — `home/achievements.md:53`

> `Ein Agent ist ein kleiner KI-Helfer, der automatisch neben der eigentlichen
> Chat-Antwort mitläuft.` — `agents/built-in-agents.md:7`

Each new guide re-defines the terms it uses, because guides are entered
directly from search. The wording may vary slightly per document; **the
headword must not.**

---

## 4. Core terminology

One standardized term per concept — PR #4157's stated rationale is that the
docs viewer's hit-count search only works if a concept has exactly one German
spelling (R3). "Banned alternates" below are, unless the row says otherwise,
either confirmed absent from the pack (count 0) or present only in a different,
legitimate sense — which is noted inline.

**Four rows are exceptions and say so**: `character`, `character card`,
`endpoint` and `tool` point at §8 residuals, because the pack itself is
inconsistent there. Where that happens this file states what the pack does and
sends you to the residuals table for the counts, rather than prescribing a
term the pack does not use. All counts below were re-measured against the
shipped pack on 2026-09-01 with a Unicode-aware scanner.

| English | This pack's term | Banned alternates | Evidence |
|---|---|---|---|
| prompt | **der Prompt** (m.) | `Eingabeaufforderung` (2, both reserved for the Windows *Command Prompt*, `installation/windows.md:66`, `:78`) | `agents/built-in-agents.md:11` |
| token | **das Token** (n.), pl. **Tokens** | `Zeichen`, `Worteinheit` (0) | `lorebooks/token-budgets.md:5` |
| token budget | **das Token-Budget** | `Token-Etat`, `Zeichenbudget` (0) | `agents/built-in-agents.md:200` |
| preset | **das Preset** (n.) | `Voreinstellung` (0 in pack — but it *is* the app locale's word; see §8) | `prompts/presets.md:7` |
| lorebook | **das Lorebook** (n.) | `Weltbuch`, `Wissensbuch` (both 0) | `lorebooks/overview.md:7` |
| lorebook entry | **der Lorebook-Eintrag** (10), pl. `Lorebook-Einträge` (34), dat. `-Einträgen` (4) | `Lorebookeintrag` (closed compound, 0) | `characters/personas.md:101` |
| character | **der Charakter** (1,275) | `Figur` (see §8 residual), `Kunstfigur` (0) | `characters/personas.md:7` |
| character card | **die Charakterkarte** (91) | `Figurenkarte` (1 residual, §8), `Merkmalskarte` (0) | `agents/approvals-and-agent-suite.md:18` |
| persona | **die Persona** (f.) | `Rollenprofil`, `Spielerprofil` (0) | `characters/personas.md:7` |
| chat | **der Chat** (m.) | `Sitzung`, `Unterhaltung` as headword | `chats/messages.md:5` |
| message | **die Nachricht** (f.) | `Mitteilung` (0) | `chats/messages.md:1` |
| swipe (alt. reply) | **der Swipe**, glossed once as *(alternative Antworten)* | `Wischer`, `Variante` as headword | `chats/messages.md:56`, `chats/branches.md:23` |
| branch (a chat) | **die Verzweigung** (99) | `Zweig` in this sense | `chats/branches.md`, `agents/hierarchical-maps.md:481` |
| branch (macro / code) | **der Zweig** (11) — *distinct sense, keep separate* | `Verzweigung` in this sense | `prompts/conditional-prompts.md:23` (`{{else}}`-Zweig) |
| agent | **der Agent** (n-declension: *dem/den Agenten*) | `Assistent`, `Bot` as headword | `agents/built-in-agents.md:7` |
| AI | **die KI** (546 vs 71 `AI`, and the `AI` hits are all inside English UI labels) | `AI` in German prose | `agents/agents-overview.md:17` |
| connection | **die Verbindung** (565; zero competing headwords) | `Anschluss` (1, = film continuity, `game/ltx-2-3-storyboards.md:193`) | `connections/connecting-to-a-provider.md:7` |
| provider | **der Anbieter** | `Provider`, `Dienstleister` | `connections/providers-reference.md:11` |
| launcher | **der Launcher** (52), incl. `Shell-Launcher`, `Termux-Launcher` | `Starter` in this sense (`Starter` = 31, all *conversation starters* / starter library) | `CONFIGURATION.md:88`, `TROUBLESHOOTING.md:22` |
| update (noun) | **das Update** (210), pl. `Updates` | `Aktualisierung` as headword (21, secondary/verbal use only) | `TROUBLESHOOTING.md:92` |
| apply (an update) | **einspielen** | `anwenden`, `applizieren` | `CONFIGURATION.md:238` ("das serverseitige **Einspielen** von Updates") |
| apply (an editor change) | **übernehmen** — *distinct from updates* | `einspielen` in this sense | `development/hierarchical-locations-prd-v3.md:126` (`**Apply** (Übernehmen)`) |
| release channel | **der Release-Kanal** / **Update-Kanal** | `Ausgabekanal`, `Zweig` | `CONFIGURATION.md:237`, `installation/windows.md:201` |
| channel switch | **der Kanalwechsel** (4) | `Kanalumschaltung` (0) | `CONFIGURATION.md:238`, `installation/macos-linux.md:231` |
| Discord channel | **der Discord-Kanal** | `Discord-Channel` | `integrations/discord-mirror.md:3` |
| (development) checkout | **die Entwicklungs-Installation** | `Checkout`, `Arbeitskopie` (means an *editor draft* here — would mislead) | `CONFIGURATION.md:238` |
| working copy (in an editor) | **die Arbeitskopie** | `Entwurf` as headword | `agents/hierarchical-maps.md:69`, `:117` |
| check out (git, verb) | **auschecken** / **klonen** — attested as the participle `ausgecheckt` and as `klone`/`klonen`; the bare infinitive `auschecken` happens not to occur | — | `installation/containers.md:24` ("schon **ausgecheckt** hast … **klone** es zuerst"), `UPGRADING.md:33` |
| wake lock | **der Wake-Lock** (hyphenated, capitalized; `Android-Wake-Lock`) | `Wachhaltesperre`, `Aktivsperre` (0) | `TROUBLESHOOTING.md:324`, `:330` |
| battery optimization | **die Akkuoptimierung** | `Batterieoptimierung` (0) | `TROUBLESHOOTING.md:326`, `:332` |
| background activity / run in background | **die Aktivität im Hintergrund** / **die Ausführung im Hintergrund** | `Hintergrundaktivität` (closed compound) | `TROUBLESHOOTING.md:326`, `:332` |
| frozen (process) | **eingefroren** (bold when the EN is bold) | `blockiert`, `hängt` | `TROUBLESHOOTING.md:330` |
| memory / RAM / in memory | **der Arbeitsspeicher** (18) — "im Arbeitsspeicher halten", "in den Arbeitsspeicher laden" | `Speicher` alone (ambiguous with disk), `Erinnerung` | `CONFIGURATION.md:155`, `TROUBLESHOOTING.md:182`, `development/file-storage.md:39` |
| from disk | **von der Festplatte** | `vom Datenträger` | `CONFIGURATION.md:155`, `TROUBLESHOOTING.md:260`, `UPGRADING.md:186` |
| evict (from memory) | **aus dem Arbeitsspeicher entfernen** | `verdrängen`, `räumen` (0) | `CONFIGURATION.md:155` |
| least-recently-used | **der am längsten nicht genutzte …** (phrasal — no LRU noun exists in the pack) | `LRU`, `zuletzt-verwendet` | `CONFIGURATION.md:155` |
| cache (noun) | **der Cache** (21), pl. `Caches` | `Zwischenspeicher` as headword | `TROUBLESHOOTING.md:80`, `data/clearing-data.md:50` |
| cached (adj./verb) | **zwischengespeichert** / **zwischenspeichern** | `gecacht` | `agents/approvals-and-agent-suite.md:3`, `development/frontend.md:559` |
| backup | **das Backup** (95) | `Sicherung` as headword (2, developer prose only) | `data/backup-and-restore.md:9` |
| restore | **die Wiederherstellung** / **wiederherstellen** | `Rückspielen` | `data/backup-and-restore.md:20` |
| snapshot (runtime / state) | **der Snapshot** (73) | `Abbild` | `agents/hierarchical-maps.md:234`, `development/architecture-map.md:95` |
| snapshot (saved card version) | **die Momentaufnahme** (15) — *distinct sense* | `Snapshot` in this sense | `characters/creating-and-editing-characters.md:128`, `:141` |
| extension (common noun) | **die Erweiterung** (126) | `Ergänzung`, `Add-on` as headword | `data/backup-and-restore.md:75` |
| Personal Extensions (product) | **Personal Extensions** (English, frozen, 19) | `Persönliche Erweiterungen` as the name — 1 residual, the doc link title at `extending/personal-extensions.md:206`; the lowercase gloss `(persönliche Erweiterungen)` after the frozen name is correct and appears 4× | `development/frontend.md:393` |
| NPC | **der NPC**, pl. **NPCs**, glossed once as *(Nicht-Spieler-Charaktere)* | `Nichtspielercharakter` (0), `NSC` (0) | `game/party-and-npcs.md:3`, `game/sessions-and-saves.md:70` |
| sprite | **das Sprite** (n.) | `Figurenbild` | `characters/sprites.md:7`, `chats/slash-commands.md:90` |
| theme | **das Theme** (n.), `Theme-Bibliothek` | `Erscheinungsbild` as headword | `home/professor-mari.md:27` |
| tool (custom tool / function calling) | **das Tool** (n.) — but see §8 residual 8 | `Werkzeug` as the headword *for this sense* (`Werkzeugleiste` = *toolbar*, 37, different; `Werkzeug`/`Werkzeuge` for a generic piece of software — Tailscale, Git — is fine and common) | `extending/custom-tools.md:15`, `:153` |
| webhook | **der Webhook** | `Web-Haken` | `integrations/discord-mirror.md:9` |
| environment variable | **die Umgebungsvariable** | `Umgebungs-Variable` (hyphenated) | `CONFIGURATION.md:3`, `media/music.md:68` |
| unset (env var) | **nicht gesetzt** — *keep distinct from* `leer` (empty) | `leer` for *unset* | `CONFIGURATION.md:238`, `:244` |
| off / unlimited (defaults) | **aus** / **unbegrenzt** | `deaktiviert`, `unlimitiert` | `CONFIGURATION.md:155`, `:156` |
| endpoint | **der Endpunkt** (27 across 12 files) — but see §8 residual 7 | `Endpoint` in German prose (6, five of them in one file) | `connections/providers-reference.md:66`, `development/frontend.md:456` ("## API-Endpunkte") |
| port | **der Port**, glossed as *der nummerierte Kanal* | `Anschluss` | `connections/local-self-hosted.md:37` |
| rate limit | **⚠ not standardized** — see §8. `Ratenlimit` is a false friend and the pack's only instance | `Ratenlimit` (the one occurrence is the defect) | `noodle/settings.md:200` |

### Anti-calque quick list

PR #4157 shipped the pack against an explicit anti-calque table. That table was
lost with the first-generation glossary; what survives is its output, and the
absence-checks above reconstruct the enforceable part of it. Confirmed absent
from all 125 files, and to stay absent: `Voreinstellung`, `Weltbuch`,
`Wissensbuch`, `Mitteilung`, `Kunstfigur`, `Merkmalskarte`, `Wachhaltesperre`,
`Batterieoptimierung`, `Nichtspielercharakter`, `Rollenspiel-Modus`,
`Spielmodus`, `Unterhaltungsmodus`, `Rate-Begrenzung`, `Beiwerk`,
`Aktivsperre`, `Token-Etat`, `Zeichenbudget`, `Rollenprofil`, `Spielerprofil`,
`Wischer`, `Figurenbild`, `Web-Haken`, `Kanalumschaltung`, `Dienstleister`,
`Umgebungs-Variable`, `Datenträger`, `gecacht`, `Rückspielen`, `NSC`,
`Lorebookeintrag`, `daß`, `muß` — all re-verified at 0 on 2026-09-01.

Two words that an earlier draft of this list treated as absent are **not**
absent and have been moved out of it: `Endpunkt` (27) and `Werkzeug` (97).
Both are covered by §8 residuals 7 and 8.

---

## 5. Typography & punctuation

- **Quotation marks are German `„…“`** (low-open, high-close) — 325 pairs,
  balanced. Straight `"` never appears in German prose; its 928 occurrences are
  all inside code fences, CSS, or quoted English JSON
  (`agents/custom-agents.md:182`, `appearance/card-css-theming.md:290`).
- **Dashes: en dash `–` for parenthetical and appositive breaks, spaced.**
  806 en dashes against 4 em dashes. This is the settled rule.
  Example: `Agenten kosten zusätzliche Tokens und zusätzliche Modellaufrufe –
  ein Token ist ein kleines Textstück.` (`agents/agents-overview.md:55`).
  Three of the four em dashes are residuals; the fourth is correct because it
  sits inside an English code span (§8 residual 5).
- **En dash also for numeric ranges, unspaced:** `128–16.384`, `1–20`, `1–100`
  (`agents/built-in-agents.md:200`).
- **Digits: German thousands separator is a period**, and it is applied to
  four-digit-and-up numbers in prose: `16.384`, `2.048`, `1.000`
  (`agents/built-in-agents.md:200`, `development/hierarchical-locations-prd-v3.md:356`).
  **Numbers inside backticks, code fences, env-var defaults and file paths keep
  their source form** — `` `4096` ``, `` `32768` `` — because they are literals
  the reader types.
- **Percent takes a space:** `5 %`, `200 %`, `40 %`, `80 %`
  (`characters/sprites.md:154`, `game/map-time-weather.md:39`,
  `prompts/macros.md:174`, `lorebooks/entries.md`) — DIN 5008. Be honest about
  how thin this majority is: **15 spaced occurrences across 4 files against 16
  unspaced across 2** (§8 residual 4). It is the right rule and it holds in
  every file except two, but one non-conforming file alone outweighs all the
  conforming ones by raw count, so do not cite "the pack does it" as
  self-evident — cite the four conforming files.
- **Units take a space:** `180 MB`, `350 MB` (`conversation/calls.md:69`),
  `16–24 GB` (`game/ltx-2-3-storyboards.md:40`).
- **Decimals take a comma:** `rund 5,4 GB`, `rund 7,5 GB`
  (`connections/local-model.md:72`, `:77`) — never a decimal point in German
  prose. Together with the thousands rule above this inverts the English
  source's punctuation on both sides, so numbers are a per-file check, not a
  copy-through.
- **No NBSP — and the count is zero, not "a few".** A full character scan finds
  **0 × U+00A0** across all 125 files, and 0 × U+3000, U+200B and U+200D as
  well: the only non-ASCII spacing-class characters in the pack are none at
  all. German docs here rely on normal spaces and the renderer. (An earlier
  draft of this glossary reported "5 NBSP" in
  `extending/personal-extensions.md:167–171`. Those 5 characters are **U+FE0F
  variation selectors** on the ⚠️ emoji in that table, one per row — see §8
  residual 6. Scan for the codepoint, not for "something wide-looking".)
- **Emoji are rare and localized — do not spread them.** The whole pack holds
  21: a ✅/⚠️/⛔ capability matrix in `extending/personal-extensions.md:167–171`,
  🎲 in three dice/connection guides, 🔞 twice in `characters/bot-browser.md`,
  and one ✦ in `appearance/card-css-theming.md`. Prose does not decorate
  headings or bullets with them. The ⚠️ carries a U+FE0F variation selector,
  which is why a careless character scan mistakes it for stray whitespace.
- **LF-only line endings.** Zero CRLF across all 125 files — `validate-pack.mjs`
  enforces this and the Windows checkout is the usual way to break it. This is
  the one item in R6's structural gate that is mechanically checkable here, and
  it passes.
- **Sentence terminators:** ordinary `.`; no `!` in instructional prose.
  Headings never take a terminator; question headings do take `?`
  (`CONFIGURATION.md:5` "## Wann lohnt sich eine Konfiguration?").
- **List mechanics:** bullets that are full sentences end with a period;
  bullets that are noun phrases or table-like fragments do not. Both patterns
  coexist within a file (`FAQ.md`) — match the surrounding list, do not
  normalize.
- **Bold-label list items** use `- **Label** (Glosse): Text` with a colon
  (`agents/agents-overview.md:49`) or `- **Label**: Text`
  (`agents/built-in-agents.md:115`). The spaced-en-dash form
  `- **Label** — Text` exists only in the two em-dash residuals; prefer the colon.

---

## 6. Language-specific mechanics

- **Compounds are hyphenated whenever an English loan or a proper name is a
  member.** `Prompt-Preset`, `Token-Budget`, `Chat-Einstellungen`,
  `Lorebook-Eintrag`, `Persona-Editor`, `Roleplay-Chat`, `Cached-App-Freezer`,
  `Release-Kanal`, `Wake-Lock`, `Entwicklungs-Installation`. This is Duden-style
  and it is what makes the loans declinable and searchable.
- **Native-only compounds stay closed:** `Charakterkarte`, `Arbeitsspeicher`,
  `Akkuoptimierung`, `Nachrichtenbox`, `Werkzeugleiste`, `Umgebungsvariable`,
  `Kanalwechsel`, `Fertigkeitsprobe`. Never hyphenate these.
- **Never a Deppenleerzeichen.** `Token Budget` (open compound) is wrong;
  `Token-Budget` is right. The only space-separated capitalized sequences in
  German prose are **UI labels inside `**…**`**, which are English by rule.
- **Genders and declension of the loans** are fixed by §4 and cascade:
  `der Prompt` → *dem Prompt, den Prompt, die Prompts*;
  `das Token` → *dem Token, die Tokens*;
  `das Lorebook` → *dem Lorebook, die Lorebooks*;
  `der Chat` → *dem Chat, den Chat, die Chats*;
  `die Persona` → *der Persona, die Personas*.
  Loan plurals take **-s**, not German umlaut plurals.
- **`Agent` is an n-declension noun**: *der Agent, **des/dem/den Agenten**, die
  Agenten* — `agents/agents-overview.md:9` ("Auf einer Charakterkarte gibt es
  keinen Schalter für **Agenten**"), `custom-agents.md:3` ("einen eigenen
  **Agenten** baust"). `dem Agent` / `den Agent` are errors.
- **Compounds built on frozen mode names keep the English member capitalized**:
  `Game-Chat`, not `game-Chat`; `Conversation-Chat`, not `Konversations-Chat`.
- **Verb-final subordinate clauses are welcome** — the pack does not chop
  sentences into English-shaped fragments to stay "simple." Naturalness beats
  parallelism with the English source: the German sentence may split, merge, or
  re-order clauses freely as long as every fact survives.
- **Headings are translated; anchor targets are not.** Heading text is German
  (`# Server-Konfiguration – Referenz`) while link fragments keep the **English**
  slug of the English source heading:
  `[Schreibstrategie](entries.md#authoring-strategy-choosing-the-right-entry)`
  (`lorebooks/overview.md:81`),
  `](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings)`
  (`chats/sending-and-streaming.md:56`). A "helpfully" translated fragment is a
  dead link — the viewer resolves against the English structure. The pack has
  only **9** fragment links in total, and **0** of them carry an umlaut in the
  fragment, so the rule is currently unbroken — and cheap to keep that way.
- **Section headings may keep an English feature name whole** when the section
  *is* that feature: `### External Extensions` (`CONFIGURATION.md:57`).

---

## 7. Recorded rulings (no in-pack evidence possible)

These are process and priority rulings preserved from the original cycle and
from PR #4157's write-up. They govern how the pack is *authored*; the pack can
show their consequences but cannot prove the rules themselves.

- **R1 — Naturalness over calque is the top rule.** It outranks every term row
  in §4. If a standardized term makes a sentence read like translated English,
  restructure the sentence — do not swap the term. (PR #4157: "makes natural,
  idiomatic phrasing the top rule (with an explicit anti-calque table)".)
- **R2 — German originated the anti-calque approach**, in response to the
  Spanish pack (#4100) reading too literally. Later packs inherited it. When
  this glossary and a later language's glossary disagree on method, this one is
  the ancestor, not the deviation.
- **R3 — One standardized term per concept, because the docs viewer's
  hit-count search depends on it.** The rationale, not just the practice.
- **R4 — Known pack residuals are documented, not silently fixed.** Discovered
  drift is recorded in §8 and left for a deliberate sweep, so a translation
  edit never rides along inside an unrelated change. `Anbindung` and
  `Ratenlimit` were both flagged in an earlier cycle under this rule.
- **R5 — The `Ratenlimit` false friend and the `Anbindung` variants are
  deferred to a future sweep**, not to the next content edit that happens to
  touch those files.
- **R6 — Structural verification is a gate, not a review step:** byte-identical
  code fences and link targets, heading parity with the English source, LF-only,
  no added images — plus an address-form and terminology sweep and an
  independent language-QA panel. (PR #4157, "Translation approach".)
- **R7 — A change that sets a new terminology or style precedent updates this
  glossary in the same commit.** (Branch `README.md`, "Updating a pack", step 4.)

---

## 8. QA checks & known traps

### Mechanical checks (run these on any changed `de/` file)

```sh
# 1. Formal address must not appear (should return nothing).
grep -rnE '\b(Sie|Ihnen|Ihre[mnrs]?) (können|müssen|sollten|finden|klicken|öffnen|wählen|haben|brauchen)' de/

# 1b. Courtesy-capital du-forms. NOTE: a bare \b(Du|Dein|Dir|Dich)\b grep is
#     USELESS here — 173 of its 174 hits are correct sentence-initial
#     capitals. Anchor to mid-sentence instead (expect exactly 1 hit, the
#     "(Du bist hier)" UI gloss in game/map-time-weather.md:30).
grep -rnE '[a-zäöüß,] (Du|Dein|Deine[mnrs]?|Dir|Dich)\b' de/

# 2. Imperative: Klicke is always wrong here.
grep -rn '\bKlicke\b' de/

# 3. Typography.
grep -rn '—' de/                       # em dash: 4 known (3 residual + 1 correct)
grep -rnP '\x{00A0}' de/               # NBSP: must be ZERO (not 5 — see residual 6)
grep -rnU $'\r' de/                    # CRLF: must be zero
grep -rnE '[0-9]%' de/ | grep -v '`'   # unspaced percent in prose: 16 known

# 4. Banned alternates (all must be zero).
grep -rnE 'Voreinstellung|Weltbuch|Wissensbuch|Mitteilung|Kunstfigur|Merkmalskarte|Wachhaltesperre|Aktivsperre|Batterieoptimierung|Nichtspielercharakter|Rollenspiel-Modus|Spielmodus|Unterhaltungsmodus|Rate-Begrenzung|Beiwerk|Token-Etat|Zeichenbudget|Rollenprofil|Spielerprofil|Wischer|Figurenbild|Web-Haken|Kanalumschaltung|Dienstleister|Umgebungs-Variable|Datenträger|gecacht|Rückspielen|Lorebookeintrag|daß|muß' de/

# 4b. NOT zero — known drift with a documented baseline. Investigate only a
#     count that moved; see the residuals table for the current numbers.
grep -rc 'Endpunkt' de/ | grep -v ':0'    # 27 across 12 files  (residual 7)
grep -rc 'Werkzeug' de/ | grep -v ':0'    # 97 total, 28 of them tool-sense in
                                          # integrations/home-assistant.md (residual 8)
grep -rn 'Figur' de/ | grep -v 'table-games\|built-in-agents\|prd-v3'  # residual 3
grep -rn 'Ratenlimit\|Anbindung\|vom Engine' de/          # residuals 1, 2, 9

# 5. Declension traps.
grep -rnE '\b(dem|den) Agent\b' de/    # must be Agenten
grep -rnE 'Token Budget|Prompt Preset|Chat Einstellungen' de/   # Deppenleerzeichen

# 6. Link fragments must stay English-slugged (9 links total, 0 offenders).
grep -rnoE '\]\([^)]*#[a-zäöüß-]*[äöüß][a-zäöüß-]*\)' de/
```

A note for whoever ports these checks to a script: **do not reach for a
JS-flavoured `\w` or `\b`.** In JavaScript `\w` is `[A-Za-z0-9_]`, so `\bPrüf\b`
and `\bWähle\b` misfire on the umlaut and every count in §1 comes out wrong.
Python's `re` is Unicode-aware by default and was used for every number in this
file; GNU `grep -P` needs the `(*UCP)` verb or an explicit class. The same trap
bites much harder on non-Latin packs — **it must stay documented for `ru`**,
where a JS `\w` matches nothing at all in Cyrillic.

### Tooling traps

- **The app locale `de.json` is NOT a terminology source.** It uses
  `Voreinstellungen` for presets, `Zweig` for a chat branch, and
  `Persönliche Erweiterungen` as a product name — all of which contradict this
  glossary — and it carries outright defects (`benutzergegonnene`, `Kopiiere`,
  `Wissenquellen`, "lokale **Coden**"). The docs are written against the
  **English** UI by design (§3). Consult `de.json` only to check whether a
  German UI string exists at all, never for wording.
  *(Carried forward from the original cycle. `de.json` lives in the Engine
  repo, not on this branch, so the specific defect list could not be
  re-verified during the 2026-09-01 re-derivation — treat it as a recorded
  ruling, not a measured claim.)*
- **Windows checkouts silently rewrite line endings.** `validate-pack.mjs`
  fails on CRLF; `.gitattributes` on this branch is the guard — verified
  present and reading `* text eol=lf`, with the comment "Never check out
  CRLF" — but a copy through an editor or a scratch directory can defeat it.
  Re-run the validator after any out-of-tree edit. The pack is currently clean
  at **0 CRLF**.
- **The manifest must be rebuilt in the same commit as content**
  (`build-manifest.mjs`, then `validate-pack.mjs`) or the pack fails hash
  verification at download time, and the user gets the English fallback with no
  visible explanation.
- **Renames and deletions must be mirrored from `docs/` on `staging`**, or the
  file is orphaned — `validate-pack.mjs` catches orphans, but only for files
  that exist; a *missing* translation degrades silently to the per-file English
  fallback and is easy to miss in review.

### Known pack residuals — documented, not fixed (see R4/R5)

| # | Residual | Where | Why it is left |
|---|---|---|---|
| 1 | **`Anbindung`** used as the carrier noun in the "what is a connection" definition, against the plurality choice `Verknüpfung` | `agents/memory.md:36` ("Eine Verbindung ist eine gespeicherte **Anbindung** an einen KI-Anbieter."), `noodle/overview.md:16` (plus two unrelated-sense uses: `development/chat-resource-drag-drop-plan.md:237` "Anbindung der Panels", `development/code-cleanup-audit.md:239` "Anbindung an den Host") | Flagged in an earlier cycle; 4 files untouched since. The **headword** `Verbindung` is fully standardized (565 hits, no competing headword) — only the definitional carrier noun varies: `Verknüpfung` ×3 (`chats/chat-settings.md:28`, `chats/guided-and-impersonate.md:90`, `conversation/getting-started.md:29`), `Anbindung` ×2, `Setup` ×1 (`connections/connecting-to-a-provider.md:7`), `Verbindung` self-referentially ×1 (`media/illustrator-agent.md:15`). *Corrected 2026-09-01: an earlier draft listed `Eintrag` and `Konfiguration` here; neither is attested.* Low reader impact. |
| 2 | **`Ratenlimit`** — false friend (`Rate` = *installment payment* in ordinary German) | `noodle/settings.md:200`, the pack's only rate-limit rendering | Flagged in an earlier cycle. Because there is no competing precedent anywhere in the pack, the correct term is an open decision (`Rate Limit` vs `Anfragelimit`) and is deliberately **not** resolved here. |
| 3 | **`Figur` / `Figurenkarte` / `Figurenreihenfolge` / `Figuren-ID` / `Figurengalerie`** instead of `Charakter` / `Charakterkarte` | `characters/galleries.md` lines 73, 79, 81, 83, 85, 89, 91 — **13 occurrences**, plus **3** at `chats/sending-and-streaming.md:56` (`Figur`, `Figurengalerie`, `Figurengalerien`); **16 in the drifted sense** | *Discovered 2026-09-01; recount 2026-09-01 raised it from the 8 first reported to 13 in `galleries.md`.* Genuine terminology drift in one guide against 1,275 `Charakter` / 91 `Charakterkarte`, and `Figurenkarte` is the pack's only competing spelling of `Charakterkarte`. It breaks the hit-count search for the most searched noun in the pack. **Highest-priority residual.** Correct, leave alone: `Figuren` = *chess pieces* in `conversation/table-games.md:89–91` and `agents/built-in-agents.md:288`; `Figur`/`Figuren` in `development/hierarchical-locations-prd-v3.md:159/161/419/1041/1111` contrasts with `Charaktere` in the same sentences ("sichtbare Charaktere … die führende sichtbare Figur") and reads as deliberate. |
| 4 | **Unspaced percent in prose** (`0%`, `100%`, `90%`) against the pack's `5 %` convention — **16 occurrences** | `appearance/appearance-settings.md:87, 90, 91, 97, 98` (15 occurrences on 5 lines), `agents/knowledge-sources.md:83` (1) | Cosmetic, and file-scoped to two files — but note it outnumbers the 15 conforming occurrences, so the convention is a 4-file majority rather than an overwhelming one. Percent inside code fences and CSS is correct as-is and must not be touched. |
| 5 | **Em dash in German prose** (3 instances) against the 806:3 en-dash convention | `agents/custom-agents.md:113`, `:114`, `TROUBLESHOOTING.md:260` | Cosmetic. The fourth em dash (`lorebooks/entries.md:189`) is **correct** — it is inside a byte-identical English code span and must stay. |
| 6 | ~~NBSP as table padding~~ — **withdrawn; there is no NBSP in the pack** | `extending/personal-extensions.md:167–171` | *Corrected 2026-09-01.* A full codepoint scan returns **0 × U+00A0**. The 5 characters on those lines are **U+FE0F variation selectors**, one per row, attached to the ⚠️ emoji in the capability matrix. Kept in the table so the next reviewer does not re-file the same false positive. Nothing to sweep. |
| 7 | **`Endpoint` vs `Endpunkt`** — the pack's actual split, and the reverse of what an earlier draft of this glossary prescribed | `Endpunkt` **27** across 12 files (`development/frontend.md:456` "## API-Endpunkte", `connections/providers-reference.md:66`, `CONFIGURATION.md:132`, `media/image-providers.md:96`, …). `Endpoint` **11**: 5 inside English UI labels or code (`**Embedding Endpoint URL**`, `**Local / Custom Endpoint**`, `**RunPod Endpoint ID**`) which are correct by §3.1, and **6 in bare German prose — 5 of them in `connections/local-self-hosted.md:9, 55, 59`** plus `media/comfyui.md:20` | *Discovered 2026-09-01.* `Endpunkt` is the settled German headword by a wide margin; `connections/local-self-hosted.md` is a single drifted guide that also carries the concept's inline definition ("Ein **Endpoint** ist die Webadresse, unter der ein Server auf Anfragen wartet."), which is why an earlier pass mistook the minority for the rule. Fix as a terminology change in its own commit, and rewrite that definition sentence with it. Second-priority residual after 3. |
| 8 | **`Werkzeug`/`Werkzeuge` as the headword for a custom tool**, against `das Tool` | `integrations/home-assistant.md` — **28 `Werkzeug*` against 7 `Tool`** in one guide (lines 11, 15, 80, 81, 92, 102, 104, 106, 111, 113, 115, 128, 143, 188, 190, 192, 204, 210, 220, 228, 232) | *Discovered 2026-09-01.* The canonical guide `extending/custom-tools.md` uses `Tool` **60×** and `Werkzeug` **0×**; `home-assistant.md` inverts that for the identical concept, and its line 11 makes the collision explicit: "Sie legt Smart-Home-**Werkzeuge** in Marinara an … Marinara nennt sie „custom tools“." One guide, one sweep. **Do not** mass-replace `Werkzeug` pack-wide: of the 97 bare `Werkzeug`/`Werkzeuge`/`Werkzeugen` in the pack, 27 are this guide's and the other **70** mean a generic piece of software (Tailscale at `FAQ.md:39` and `REMOTE_ACCESS.md:16`, Git at `UPGRADING.md:33`, `backgroundremover` at `TROUBLESHOOTING.md:197`) — those are correct, as are the 37 `Werkzeugleiste` = *toolbar*. |
| 9 | **`vom Engine`** — wrong gender for `die Engine` | `development/file-storage.md:35` ("werden **vom Engine** nie gelöscht") | *Discovered 2026-09-01.* One slip against 32 correctly feminine article uses (`die Engine` 13, `der Engine` 19, `von der Engine` at `development/optional-agent-packages.md:62`). Should read `von der Engine`. Trivial, but it is a grammar defect rather than a style choice, so it does not need the same deliberation as a terminology sweep — fold it into the next edit that touches `file-storage.md`. |

Residuals 1, 2, 4 and 5 are cosmetic or scoped; 6 is withdrawn and 9 is a
one-word grammar fix. **Residuals 3, 7 and 8 are the ones worth dedicated
sweeps** — each is a real terminology split that defeats the hit-count search
(§4), each is confined to one or two guides, and each should be fixed as a
terminology change with its own manifest rebuild rather than folded into
unrelated content work. Priority order: **3** (`Figur`, 16 hits, the most
searched noun in the pack), then **7** (`Endpoint`, 6 prose hits and a wrong
inline definition), then **8** (`Werkzeug`, 28 hits in one guide).

Per R5 the `Ratenlimit` and `Anbindung` scheduling ruling still stands and is
untouched by this review; residuals 3, 7 and 8 are new findings from the
2026-09-01 re-derivation and inherit R4's "document, do not silently fix"
treatment rather than any earlier scheduling decision.

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, a native NovelAI character caption is a
**Figurenbeschreibung**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.
