# Hindi (`hi`) — documentation-pack glossary

## Provenance

This is the **second-generation** `hi` glossary, **re-derived 2026-09-01** after the original
working glossaries were lost to temp-directory cleanup. It was rebuilt from three sources, in
authority order:

1. **The shipped pack** at `docs-i18n:hi/` (125 files) — **ground truth**. Every terminology row
   and prescriptive rule below was re-verified against the pack as shipped, with a cited evidence
   file and line.
2. **The pack's shipping PR decision write-up** — Pasta-Devs/Marinara-Engine **PR #4471**
   ("Hindi conventions" section), the record of what the original cycle decided and why.
3. **The 2026-09-01 mirror-cycle notes** (`prd-notes-hi.md`) — evidence-backed choices made during
   the same-day delta mirror, each carrying its own in-pack citation.

**How to read the rules.** Every prescriptive statement is either

- **verified** — followed by a `file:line` citation into `hi/`, or a measured pack-wide count,
  meaning the pack demonstrably does this today; or
- marked **`[recorded ruling]`** — a maintainer or cycle decision the pack cannot show, because it
  is a process rule, a tooling trap, or a negative finding. These are preserved as rulings, not
  invented.

Where the pack **contradicts** a rule in a small number of places, the rule stands and the
exceptions are logged in §7 *Known pack residuals* — documented, not silently normalized.

**Why the mechanical rules are hard rules.** The in-app docs search is a literal, case-insensitive
substring scan with no normalization, stemming, or folding —
`packages/server/src/routes/docs.routes.ts:557-596` (`const needle = query.toLowerCase()`,
`line.toLowerCase().indexOf(needle)`). For Devanagari that means फ़ाइल and फाइल are simply
different strings, a stray ZWNJ is an unmatchable byte, and a Devanagari numeral never answers a
search for `7860`. Spelling discipline here is a search-correctness requirement, not a style
preference.

Line numbers refer to the pack as shipped at `docs-i18n` commit `43eef09e2`. Re-verify after any
pack edit.

---

## 1. Register & address

| Rule | Detail | Evidence |
|---|---|---|
| **आप only** | Second-person address is always **आप**. `तुम` and `तू` are banned for reader address. | आप ×1,600 pack-wide; `तुम` **0×**; the 12 `तू` strings are all substrings of बातूनी / तूफ़ान (`conversation/schedules.md:14`, `game/map-time-weather.md:79`), **0** pronoun uses |
| **करें-style imperatives** | Instructions use the आप-imperative: `करें`, `खोलें`, `चुनें`, `सेट करें`, `चलाएँ`, `देखें`. The `कीजिए/कीजिये` register is banned outright. | `करें` ×2,042, `खोलें` ×469, `चलाएँ`, `देखें`; `कीजिए` **0×**, `कीजिये` **0×**; `CONFIGURATION.md:31`, `installation/containers.md:24` |
| **करो/तुम survive only inside quoted in-fiction speech** | The two `करो` forms in the pack are example utterances a *user types to a character*, not reader address. Do not generalize. | `game/getting-started.md:141` (`"…हल्का मत करो"`), `home/professor-mari.md:164` |
| **Modern technical Hindi, Google/Microsoft register** | Everyday vocabulary with Devanagari loanwords. **शुद्ध / Sanskritized purisms are banned.** | `संगणक` **0×**. Measured splits: इस्तेमाल 794 vs उपयोग 2 / प्रयोग 1; अगर 307 vs यदि **0**; हर 1,593 vs प्रत्येक **0**; ज़रूरी 215 vs आवश्यक **0**; मदद 109 vs सहायता **0**; कोशिश 59 vs प्रयास **0**; जवाब 413 vs उत्तर 2; सिर्फ़ 789 vs केवल 24 |
| **No reader gendering** | Never make a verb or participle agree with the reader's gender. The polite plural आप takes `-ते हैं` and is neutral by construction; where a participle must agree it agrees with the **object**, not the reader. | `आप चाहते हैं` ×2 and **0** feminine reader forms (`आप चाहती`, `आप कर सकती`, `आप देखेंगी` all **0×**); `आपने सेट किया` / `आपने टाइप की` agree with the object |
| **Devanagari loanwords, not calques** | Loan the technical noun (`फ़ाइल`, `सर्वर`, `प्रॉम्प्ट`, `लोरबुक`, `कनेक्शन`) rather than coining a Hindi equivalent. | `CONFIGURATION.md:3`; see §3 |
| **`यानी` is the plain-language gloss connector** | Jargon gets a one-time inline definition introduced by `यानी` (or a parenthetical), then runs bare. | ×303 pack-wide; `CONFIGURATION.md:3` (`एनवायरनमेंट वेरिएबल यानी वह सेटिंग जो…`), `game/hud-widgets.md:3` (`HUD यानी heads-up display…`), `chats/slash-commands.md:3`, `prompts/macros.md:3` |
| **The app locale `hi.json` is NOT the register authority** | `packages/client/src/localization/locales/hi.json` uses a markedly more Sanskritized register than the docs pack and must never be copied from. | `hi.json` ships `उपयोग`, `यदि`, `त्रुटि`, `नियंत्रण`, `सामग्री`, `सूचना`, `दृश्य`, `सहेजा गया`, and translates the mode names (`बातचीत`, `रोलप्ले`, `गेम`). The pack ships `इस्तेमाल` (×794), `अगर` (×307), `एरर` (×77, `त्रुटि` **0×**), `कंट्रोल` (×234 vs `नियंत्रण` ×8), `नोटिफ़िकेशन` (×22 vs `सूचना` ×4), `सेव` (×676 vs `सहेज` ×1), and keeps the mode names in Latin |

---

## 2. Product, feature & mode names

**The frozen-name rule.** Product, mode, agent and feature names **stay in Latin script**. A
Devanagari transliteration of a frozen name splits the literal-substring search index and is a
defect, not a synonym (PR #4471).

Measured: `Roleplay` 462 vs `रोलप्ले` 19 (all generic-sense, see below) · `Conversation` 465 vs
`कन्वर्सेशन` 2 — one inside a label gloss (`appearance/chat-backgrounds.md:15`,
`**Conversation Theme** (कन्वर्सेशन थीम)`), one inside a code-identifier gloss
(`development/code-cleanup-audit.md:237`) · `Game Mode` 266 vs `गेम मोड` 1, inside a label gloss
(`game/ltx-2-3-storyboards.md:3`) · `Noodle` 202, `नूडल` **0×** · `Professor Mari` 88,
`प्रोफ़ेसर` **0×**.

**The spaced-postposition rule.** Because the name cannot inflect, the Hindi postposition follows
it as a **separate word**, never hyphenated and never attached:

| Do | Never |
|---|---|
| `Marinara Engine में` | `Marinara-में`, `Marinaraमें` |
| `Android पर`, `Termux पर`, `Docker पर` | `Androidपर` |
| `Support Diagnostics की कॉपी` | any inflected/attached form |
| `Marinara तक पहुँच` | — |

Verified: **1,034** spaced `frozen name + postposition` constructions across **98** distinct
name+postposition pairs — `Marinara को` ×72, `Marinara के` ×70, `Game Mode में` ×60, `Marinara में`
×54, `Marinara Engine की` ×52 … The locative subset alone is 51 (`Marinara तक` ×11, `Android पर`
×9, `Linux पर` ×5, `Windows पर` ×4, `Docker पर` ×4, `Noodle पर` ×4 …). Against that: **0**
hyphen-attached postpositions and **0** occurrences of a Devanagari character immediately followed
by a Latin letter, pack-wide. The rule is not a handful of special cases — it is how the pack
inflects every frozen name, a thousand times over.

**Exception — the danda attaches directly.** A sentence ending on a Latin token takes `।` with
**no** intervening space (131 instances, e.g. `…Marinara Engine।`). This is the one place Latin and
Devanagari touch.

**The activity/mode sense split.** The *frozen mode name* is Latin; the *generic activity* is
Devanagari:

- `- **Conversation**: बिना रोलप्ले वाली सीधी AI चैट` — `home/welcome.md:36`
- `डाइस वाले व्यवस्थित रोलप्लेइंग गेम के लिए…` — `roleplay/getting-started.md:15`
- `बातचीत` (×22) likewise means *talking*, never the `Conversation` mode.

**What stays English (never translated, never transliterated):**

| Class | Members (as they appear) |
|---|---|
| Product & shell | `Marinara`, `Marinara Engine`, `Noodle`, `Professor Mari`, `Termux`, `Docker`, `Android`, `Windows`, `Linux`, `Node`, `Tailscale`, `SillyTavern`, `ComfyUI`, `Spotify`, `Home Assistant`, `Discord` |
| Chat modes | `Conversation`, `Roleplay`, `Game Mode` (and bare `Game`) |
| Agents & packages | `World Maps`, `Storyboard`, `Illustrator`, `Music DJ`, `Character Tracker`, `Local Model`, `Agent Suite`, `Memory Recall` |
| Acronyms | `API`, `JSON`, `CSS`, `HUD`, `GM`, `NPC`, `DM`, `OOC`, `GIF`, `PWA`, `CSRF`, `APK`, `RAM`, `LTX` |
| UI controls & panels | every bold label — see §5 |

**Acronyms are expanded once, in a parenthesis or with `यानी`, then run bare:**

- `NPC (नॉन-प्लेयर कैरेक्टर)` — `game/party-and-npcs.md:3` (`NPC` on 37 lines; `एनपीसी` **0×**)
- `HUD यानी heads-up display, गेम स्क्रीन के … छोटे जानकारी-पैनल` — `game/hud-widgets.md:3`
- `APK यानी Android ऐप की इंस्टॉल फ़ाइल` — `installation/android-termux.md:15`
- `रेजेक्स "regular expression" का छोटा रूप है` — `extending/regex-scripts.md:7`

**Articles:** Hindi has none. Do not import English `the`/`a` as `वह`/`एक` unless genuinely
contrastive; the pack writes `कैरेक्टर कार्ड वह फ़ाइल है जो AI कैरेक्टर को परिभाषित करती है`
(`characters/creating-and-editing-characters.md:7`) — the demonstrative is doing definitional work
there, not standing in for an article.

---

## 3. Core terminology

Banned alternates are **defect classes**: a reviewer finding one should treat it as a regression,
not a synonym choice. Two renderings of one concept split the substring-search result set.

**Bans are sense-scoped, and a bare grep will over-report.** A word banned as a rendering of *this
row's* concept is often the pack's correct word for a *different* concept, and the pack uses it
freely there. Before filing a regression, read the sense. Measured, and all legitimate:

| Word | Banned as | But is the pack's word for | Count |
|---|---|---|---|
| संकेत | prompt | cue / hint / indicator (`[whispering]` voice cues, typing indicator, drop hint) | 20 |
| संवाद | chat | dialogue (`**Dialogue Examples**`, `**Color Dialogues**`, spoken lines) | 13 |
| बॉट | agent | bot (table-game bot, `Discord बॉट`, "the bot that replies") | 8 |
| व्यक्तित्व | persona | personality (the `**Personality**` card field) | 5 |
| स्टार्टर | launcher | starter set (`साथ आने वाला स्टार्टर सेट`, `game/game-assets.md:17`) | 5 |
| विस्तार | extension | expansion (`AI मैप ड्राफ़्ट और विस्तार`), and `विस्तार से` = in detail | 9 |
| प्लगइन | extension | a third-party plugin outside Marinara (Vite, Fastify, Termux plugin apps) | 4 |
| झलक | snapshot | preview / show-through | 5 |
| पड़ाव | checkpoint | milestone, waypoint | 3 |
| वर्णन · कथन | narration | the verb *to describe*; `कहानी-कथन` = storytelling | 4 · 1 |
| दृश्य | scene | *visual* as an adjective (`खास दृश्य फ़रमाइशों`) | 2 |

Two more are pure substring artifacts and never appear as words at all: `कोष` (×11, always
`कोष्ठक` = bracket) and `संबंध` (×15, almost always `संबंधित`/`असंबंधित` = related — exactly **1**
bare use, `appearance/appearance-settings.md:30`). Tokenize before you count.

| English term | This pack's term | Banned alternates | Evidence |
|---|---|---|---|
| prompt | **प्रॉम्प्ट** | संकेत, निर्देश-पाठ, सूचक | `prompts/presets.md:3`; `CONFIGURATION.md:33` |
| token | **टोकन** | शब्दखंड, इकाई | `lorebooks/token-budgets.md:1`, `:5` |
| token budget | **टोकन बजट** | टोकन सीमा (bare), टोकन कोटा | `lorebooks/token-budgets.md:1`; `agents/built-in-agents.md:200` |
| preset | **प्रीसेट** | पूर्व-निर्धारित सेटिंग, पूर्वनिर्धारण | `prompts/presets.md:3` |
| lorebook | **लोरबुक** (fem.) | विश्वकोश, ज्ञानकोश, लोर-पुस्तक | `lorebooks/overview.md:3`; `FAQ.md` |
| lorebook entry | **एंट्री** (fem.) | प्रविष्टि, लेख | `lorebooks/entries.md`; `lorebooks/token-budgets.md:1` |
| character | **कैरेक्टर** | पात्र, किरदार | कैरेक्टर ×1,315; किरदार **0×**; पात्र ×2 (residual, §7) — `characters/creating-and-editing-characters.md:7` |
| character card | **कैरेक्टर कार्ड** | पात्र-कार्ड, चरित्र कार्ड | `characters/creating-and-editing-characters.md:7`; `lorebooks/linking-to-characters.md:9` |
| persona | **पर्सोना** | उपयोगकर्ता प्रोफ़ाइल, व्यक्तित्व | `characters/personas.md:1` |
| chat | **चैट** (fem.) | वार्तालाप, संवाद, बातचीत (that word means *talking*) | चैट ×1,934; वार्तालाप **0×** — `chats/managing-chats.md:3` |
| message | **संदेश** | **मैसेज** as the bare count noun (banned) | संदेश ×816 vs मैसेज ×23. The 23 break down as मैसेजिंग ×15 · `डायरेक्ट मैसेज`/`डायरेक्ट-मैसेज` ×5 · `सैंडबॉक्स मैसेज`/`रनटाइम मैसेज` ×2 (`extending/writing-personal-extensions.md:227`, `:252`) · **1 bare verbal use**, `किसी दोस्त को मैसेज करते हैं` (`conversation/getting-started.md:9`) — `chats/messages.md:1`; `conversation/schedules.md:7` |
| messaging (the app genre) | **मैसेजिंग** | संदेशन | `conversation/getting-started.md:3`; `roleplay/scenes.md:7` |
| branch (chat) | **ब्रांच** (fem.) | शाखा — but **फ़ोर्क is the verb**, not a banned word | ब्रांच ×169. `फ़ोर्क` ×11 is the pack's word for the *fork action* and for a git fork (`चैट … पर फ़ोर्क हुआ`, `chats/branches.md:13`; `सीन की ब्रांच फ़ोर्क होती हैं`, `roleplay/scenes.md:78`; `अपने फ़ोर्क की एक अलग ब्रांच`, `development/localization.md:89`). Never use it as the branch *noun*. शाखा ×1, a residual (§7-F) — `chats/branches.md:3` |
| agent | **एजेंट** | सहायक, बॉट, असिस्टेंट | एजेंट ×733. `असिस्टेंट` ×36 is **not** reserved for Professor Mari: its dominant pack sense is the **assistant message role** (`हर 8 यूज़र और असिस्टेंट संदेशों पर`, `agents/built-in-agents.md:45`; `असिस्टेंट के जवाब`, `असिस्टेंट स्वाइप`), plus generic `AI असिस्टेंट` (`appearance/card-css-theming.md:524`) and Professor Mari's own epithet `बिल्ट-इन असिस्टेंट` (`home/professor-mari.md:1`). What is banned is असिस्टेंट as a rendering of *agent* — `agents/agents-overview.md:1` |
| capability (an agent declares) | **क्षमता** | योग्यता, सामर्थ्य | `CONFIGURATION.md:33` |
| permission — **OS / browser prompt** | **अनुमति** | परमिशन, इजाज़त | `installation/android-termux.md:21` (`**Run commands in Termux environment** अनुमति दें`), `TROUBLESHOOTING.md:290`, `:291`, `:332`, `conversation/calls.md:235` (microphone) |
| permission — **Marinara-level capability grant** | **परमिशन** | अनुमति, इजाज़त | परमिशन ×33 — `CONFIGURATION.md:33`; `agents/built-in-agents.md:202` (`` `agent-runtime`, `chat-read` … परमिशन ``); `extending/personal-extensions.md:130`; `development/personal-extensions.md:23`. Two shipped lines use अनुमति for this sense instead — a residual, §7-F |
| permission — **an OS/filesystem permission *error*** | **परमिशन एरर** | अनुमति एरर | `TROUBLESHOOTING.md:369` (Docker/Podman volume); `installation/containers.md:234`; `home/professor-mari.md:175` |
| "is allowed to" (predicate, allowlists/CORS) | **इजाज़त** (verbal, never a countable noun) | — | `CONFIGURATION.md:127`, `:138`, `:281`; `REMOTE_ACCESS.md:217` |
| connection | **कनेक्शन** | संबंध, जुड़ाव | `connections/connecting-to-a-provider.md:3` |
| provider | **प्रोवाइडर** | सेवा-प्रदाता, आपूर्तिकर्ता | `connections/providers-reference.md:3` |
| API key | **API कुंजी** | API की, चाबी | कुंजी ×202 — `connections/connecting-to-a-provider.md:3`; `CONFIGURATION.md:154` |
| launcher | **लॉन्चर** | प्रक्षेपक, स्टार्टर, आरंभक | लॉन्चर ×92 — `TROUBLESHOOTING.md:22`, `:314`, `:324`; `CONFIGURATION.md:274` |
| apply an update | **अपडेट लागू करना** | अपडेट चढ़ाना, अपडेट इंस्टॉल करना (for the in-app *Apply* action) | `CONFIGURATION.md:221`, `:237`, `:238` |
| release channel | **रिलीज़ चैनल** | विमोचन चैनल, रिलीज़ शाखा | `CONFIGURATION.md:237`; `installation/macos-linux.md:231`; `installation/windows.md:201` |
| channel (Discord) | **चैनल** | माध्यम | `integrations/discord-mirror.md:7` |
| checkout (working tree) | **चेकआउट** | कार्य-प्रति, निकासी | `installation/containers.md:24`; `TROUBLESHOOTING.md:39`; `CONFIGURATION.md:238` |
| repository | **रिपॉज़िटरी** | भंडार, कोष | `CONFIGURATION.md:35`, `:37`; `installation/containers.md:24` |
| wake lock | **`wake lock`** — left in English, **unbolded, unbackticked** | वेक लॉक, जागृति-लॉक, निद्रा-रोक | `TROUBLESHOOTING.md:324` (`लॉन्चर Android wake lock माँगता है`), `:330`; वेक लॉक **0×** |
| `termux-wake-lock` / `termux-wake-unlock` / `termux-tools` | byte-exact in backticks | any transliteration | `TROUBLESHOOTING.md:326` |
| battery optimization | **बैटरी ऑप्टिमाइज़ेशन** | बैटरी अनुकूलन, ऊर्जा बचत | `TROUBLESHOOTING.md:326` (`बैटरी ऑप्टिमाइज़ेशन हटाएँ`), `:332` (`…से छूट दें`) |
| background activity / run in background | **बैकग्राउंड में चलना** — the OS allowance is `बैकग्राउंड में चलने की अनुमति` | पृष्ठभूमि, बैकग्राउंड परमिशन | `TROUBLESHOOTING.md:326`, `:332`; `TROUBLESHOOTING.md:80` |
| foreground | **फ़ोरग्राउंड** — chosen for symmetry with the pack's `बैकग्राउंड` | अग्रभूमि | `TROUBLESHOOTING.md:328` (heading), `:332` |
| freeze (cached-app freezer) | **फ़्रीज़** (bold for emphasis, not as a label) | जमना, हिमीकरण | `TROUBLESHOOTING.md:330`; फ़्रीज़ ×26 |
| memory (RAM sense) | **मेमोरी** (fem.) | स्मृति, रैम-स्मृति, याददाश्त | मेमोरी ×120, स्मृति **0×** — `CONFIGURATION.md:155`; `TROUBLESHOOTING.md:314`; `connections/local-model.md:34` (`मेमोरी (RAM)`) |
| in memory / resident | **मेमोरी में रखना** / **मेमोरी से हटाना** | निवासी, रेज़िडेंट, स्थायी-स्मृति | `CONFIGURATION.md:155` (`कितनी चैट मेमोरी में रख सकता है` … `मेमोरी से हटा दी जाती है … (डिस्क से यह कभी नहीं हटती)`), `:156` |
| memory (a saved recall item) | **याद** / pl. **यादें** | मेमोरी (that is RAM), स्मरण | `agents/built-in-agents.md:153`; `agents/memory.md` |
| Memory Recall (the feature) | **Memory Recall** (Latin) + gloss `(मेमोरी रिकॉल)` on first mention | मेमोरी वापसी | `TROUBLESHOOTING.md:159` |
| least-recently-used | *no coined term* — phrase it as a relative clause | LRU, न्यूनतम-प्रयुक्त | `CONFIGURATION.md:155` (`वह चैट … जो सबसे लंबे समय से इस्तेमाल नहीं हुई`) — see the mirror-cycle note below |
| cache (n. / v.) | **कैश** | संचय, अस्थायी भंडार | कैश ×44 — `TROUBLESHOOTING.md:75`, `:80`; `CONFIGURATION.md:322` |
| backup | **बैकअप** | प्रतिलिपि, सुरक्षा प्रति | बैकअप ×87 — `data/backup-and-restore.md:9`; `CONFIGURATION.md:16` |
| snapshot | **स्नैपशॉट** | झलक, क्षण-चित्र | स्नैपशॉट ×101 — `agents/hierarchical-maps.md:31`; `development/personal-extensions.md:22` |
| checkpoint | **चेकपॉइंट** | जाँच-बिंदु, पड़ाव | `agents/built-in-agents.md:153`; `game/sessions-and-saves.md:84` |
| extension (Marinara add-on) | **एक्सटेंशन** | विस्तार, संवर्धन, प्लगइन | एक्सटेंशन ×122 — `extending/personal-extensions.md:3`; `CONFIGURATION.md:59` |
| store / storage | **स्टोरेज**, verb **सेव करना** | सहेजना, भंडारण | सेव ×676 vs सहेज ×1 (residual, §7) — `data/where-data-is-stored.md:21` |
| data | **डेटा** | आँकड़े (5 residual uses), सामग्री | डेटा ×288 — `CONFIGURATION.md:152` |
| environment variable | **एनवायरनमेंट वेरिएबल** | पर्यावरण चर, परिवेश-चर | `CONFIGURATION.md:3` |
| default (the value) | **डिफ़ॉल्ट** | तयशुदा, पूर्वनिर्धारित — **for the *default* sense only** | डिफ़ॉल्ट ×614 — `CONFIGURATION.md:150` (table header `डिफ़ॉल्ट`). `तयशुदा` ×23 never means *default* in the pack: it is its word for **deterministic** (21 of 23 in `development/hierarchical-locations-prd-v3.md` — `तयशुदा क्रम`, `तयशुदा कटौती`, `ग्राफ़ वैलिडेशन तयशुदा है`), plus *fixed/specified* at `game/getting-started.md:73`, `noodle/settings.md:29`. Keep it for *deterministic*; never write it in a default column |
| timeout | **टाइमआउट** | समय-सीमा (that is a limit, not a timeout) | `CONFIGURATION.md:15`, `:201` |
| allowlist | **अलाउलिस्ट** | श्वेत-सूची, अनुमति-सूची, वाइटलिस्ट | अलाउलिस्ट ×44 — `CONFIGURATION.md:12`, `:110` |
| log (server) | **लॉग**, v. **लॉगिंग** | अभिलेख, पंजी | `TROUBLESHOOTING.md:324`; `CONFIGURATION.md:106`, `:170` |
| process | **प्रोसेस** | प्रक्रिया (reserved for *a procedure*) | प्रोसेस ×44, प्रक्रिया ×13 — `TROUBLESHOOTING.md:324`, `:330`; `development/personal-extensions.md:117` |
| manufacturer (OEM) | **निर्माता** | कंपनी, विनिर्माता | `TROUBLESHOOTING.md:324`, `:326` |
| behavior | **व्यवहार** preferred; `बर्ताव` **not yet settled** | आचरण | व्यवहार ×63 vs बर्ताव ×17 — `CONFIGURATION.md:25`, `:156`. The pack has **not** closed this split: बर्ताव carries the same sense in shipped user-facing guides (`कैरेक्टर … कैसा बर्ताव करे`, `conversation/profiles.md:40`; `एंट्री … कैसा बर्ताव करे`, `lorebooks/entries.md:114`; the heading `रनटाइम और रीस्टार्ट का बर्ताव`, `development/optional-agent-packages.md:139`), and `prompts/generation-parameters.md:152` uses **both in one sentence**. Write व्यवहार in new text; do not mass-rewrite existing बर्ताव as a drive-by — see §7-F |
| macro | **मैक्रो** | बृहद्-आदेश, संक्षेपक | `prompts/macros.md:3` |
| regex / regex script | **रेजेक्स** (with `रेगुलर एक्सप्रेशन` as the one-time expansion) | नियमित अभिव्यक्ति | रेजेक्स ×36 — `extending/regex-scripts.md:7` |
| slash command | **स्लैश कमांड** | तिरछी-रेखा कमांड | `chats/slash-commands.md:3` |
| widget | **विजेट** | घटक, उपकरण | `game/hud-widgets.md:3` |
| tracker | **ट्रैकर** | अनुरेखक, निगरानीकर्ता | `roleplay/hud-and-trackers.md:3` |
| scene | **सीन** | दृश्य | सीन ×346 — `roleplay/scenes.md:1` |
| narration | **नैरेशन** (masc., see §6) | वर्णन, कथन | `game/getting-started.md:56`; `game/storyboard.md:14` |
| embedding | **एम्बेडिंग** | अंतःस्थापन, सन्निवेशन | `lorebooks/semantic-search.md:3` |
| semantic search | **सिमैंटिक सर्च** | अर्थ-आधारित खोज | `lorebooks/semantic-search.md:3` |
| NPC | **NPC** (Latin, undeclined), expanded once as `(नॉन-प्लेयर कैरेक्टर)` | एनपीसी, गैर-खिलाड़ी पात्र | `game/party-and-npcs.md:3`; एनपीसी **0×** |
| party (Game Mode) | **पार्टी** | दल, टोली | `game/party-and-npcs.md:3` |
| dice roll / skill check | **डाइस** / **स्किल चेक** | पासा, कौशल-परीक्षण | `game/dice-and-skill-checks.md:3` |
| gallery | **गैलरी** (fem.) | चित्रशाला | `characters/galleries.md:3` |
| sprite | **स्प्राइट** | आकृति | `characters/sprites.md:1` |
| export / import | **एक्सपोर्ट** / **इंपोर्ट** | निर्यात / आयात | `chats/export-import.md:3` |
| exactly / byte-identical | **हूबहू** | यथावत् | हूबहू ×38 lines — `development/frontend.md:395`; `agents/knowledge-sources.md:14`; `CONFIGURATION.md:144` |
| literal (text taken as-is, not interpreted) | **अक्षरशः** — a *different* word from हूबहू, not a banned alternate | — | अक्षरशः ×9: `अक्षरशः टेक्स्ट` (`prompts/macros.md:7`, `extending/regex-scripts.md:73`), `**Exact Text Model Request**` = `वही अक्षरशः रिक्वेस्ट` (`chats/peek-prompt.md:13`), `अक्षरशः वैल्यू` (`prompts/conditional-prompts.md:128`). `chats/connected-chats.md:57` uses both correctly in one breath: `इन्हें अक्षरशः टेक्स्ट की तरह लिखें … ताकि वह हूबहू दिखे।` हूबहू = *byte-identical to a source*; अक्षरशः = *read literally* |
| user | **यूज़र** (in `यूज़र पर्सोना`, `यूज़र डेटा`) | उपयोगकर्ता | यूज़र ×86, उपयोगकर्ता **0×** — `characters/personas.md:1`; `CONFIGURATION.md:152` |
| app | **ऐप** | एप्लिकेशन, अनुप्रयोग | ऐप ×466, एप्लिकेशन **0×** — `TROUBLESHOOTING.md:75` |

### Default-column vocabulary (`CONFIGURATION.md` tables)

The default column renders word-defaults in Hindi and keeps literal values in backticks. The
`empty` / `unset` distinction is deliberate and must not be collapsed:

| EN default | Pack rendering | Count | Evidence |
|---|---|---|---|
| *empty* (an empty **string** value) | **खाली** | 18 rows | `CONFIGURATION.md:124`, `:125`, `:127`, `:135-138`, `:154`, `:235`, `:244`, `:275`, `:292`, `:296`, `:297`, `:310`, `:317`, `:324`, `:325` |
| *unset* (a set/not-set **flag**) | **सेट नहीं** | exactly 1 row | `CONFIGURATION.md:238` (`UPDATES_APPLY_DISABLED`); the inline form is `(या सेट न होना)` at `:155` |
| *off* | **बंद** | | `CONFIGURATION.md:156` |
| *unlimited* | **`0` (असीमित)** | | `CONFIGURATION.md:155` |
| *automatic* | **अपने-आप** (hyphenated **in the default column only**) | 2 rows | `CONFIGURATION.md:132`, `:133` |
| *built-in defaults* | **बिल्ट-इन डिफ़ॉल्ट** | | `CONFIGURATION.md:131` |

### Terms carried from the 2026-09-01 mirror cycle

Reproduced with the citations they shipped with (`prd-notes-hi.md`):

- **`resident` / `in memory`** — reuse the pack's established **मेमोरी** for the RAM sense; there is
  **no separate "resident" coinage** and none should be invented. `मेमोरी में रखना` carries it.
  (`CONFIGURATION.md:155`; `TROUBLESHOOTING.md:314`; `connections/local-model.md:34`.)
- **`least-recently-used`** — **`[recorded ruling]`** the pack has **no LRU precedent**. The nearest
  candidate, `media/tts-setup.md:142` (`कैश अपनी सबसे पुरानी क्लिप खुद ही हटाता रहता है`), encodes
  *oldest-created*, not *last-used*, and was rejected as unusable. Phrase it as an unambiguous
  relative clause — `वह चैट … जो सबसे लंबे समय से इस्तेमाल नहीं हुई` (`CONFIGURATION.md:155`). A
  later cycle may pin a canonical term; until then do not coin one.
- **`unset` ≠ `empty`** — do not collapse. `खाली` is the empty-string default (18 rows), `सेट नहीं`
  the flag default (1 row). Verified again this cycle; counts above.
- **wake-lock vocabulary** — the Termux section's existing wording was reused verbatim in register
  rather than re-coined: `wake lock` stays English and unbolded, `बैटरी ऑप्टिमाइज़ेशन` and
  `बैकग्राउंड में चलने` are reused from `TROUBLESHOOTING.md:326`. `Termux:API` / `termux-api` were
  dropped with the retired sentence.

---

## 4. Typography & punctuation

| Rule | Detail | Evidence |
|---|---|---|
| **Danda `।` (U+0964) ends every Hindi sentence** | Including **mid-line** sentences. A line-end-anchored check will not see most of them. | 15,316 dandas total; **7,606** of them sit mid-line *counting prose lines only* (table rows excluded — those are counted in the table-cell row below; include them and it is 8,235). **0** instances of a Devanagari character followed by an ASCII full stop outside code fences |
| **No space before the danda** | `…है।`, and after a Latin token `…Marinara Engine।` | 0 space-before-danda; 131 Latin+danda joins |
| **No double danda `॥`** | | **0×** |
| **Fragments take no terminator** | Metadata lines, inline dash-separated enumerations, and label fragments end bare. | Counting blocks that end on a bare Devanagari **letter** (the danda is itself in the Devanagari block — exclude U+0964 or every sentence scores as a fragment): **2** non-bullet prose blocks (`development/hierarchical-locations-prd-v3.md:3`, `:5` — both metadata lines) and **104** bullets; **87** after joining hard-wrapped continuations. Every one inspected is a genuine fragment. Also `:97`; `chats/settings-profiles.md:20` |
| **Bullets: sentence → danda, fragment → bare** | | 2,371 bullets end `।`; 104 end on a bare Devanagari letter (fragments) — `CONFIGURATION.md:11-16` |
| **Table cells: fragment is the norm** | Cells are predominantly noun phrases and take **no** danda; a cell containing a full sentence does. | Of Devanagari-bearing cells, 1,170 end on a bare Devanagari letter vs 457 danda-terminated (1,354 end without a danda once cells closing on `**`, backticks, Latin or digits are included) — `CONFIGURATION.md:124` (bare-ish) vs `:155` (sentences) |
| **Headings never take a danda** | Including FAQ question headings, which keep their `?`. | **0** headings contain `।`; FAQ `##` headings 23/24 end in `?` (the 24th is `मिलती-जुलती गाइड`, `FAQ.md:202`) |
| **Straight ASCII quotes only** | `"…"`. No curly `“ ” ‘ ’`, no guillemets. | curly **0×**, `«»` **0×**; 1,496 straight double quotes — `TROUBLESHOOTING.md:330` (`"Opening chat..."`) |
| **International digits `0-9` only** | Devanagari digits `०-९` never appear: `०७८६०` would not answer a search for `7860`. | Devanagari digits **0×** pack-wide |
| **Western 3-digit grouping** | `8,192`, `16,384`, `1,000,000`, `478,000`. **No** Indian `1,00,000` grouping, no `लाख`/`करोड़`. | 0 Indian-style groupings; `लाख` **0×**, `करोड़` **0×**; `agents/built-in-agents.md:200`, `development/file-storage.md` |
| **Percent** | Numeral + `%` with no space for values; `प्रतिशत` only when the sentence reads as prose. | 65 `N%` vs 13 `प्रतिशत` |
| **NFC, zero ZWJ/ZWNJ** | Decomposed nukta forms and invisible joiners are unmatchable bytes for the substring search. | all 125 files NFC-normalized; U+200C/U+200D **0×**; **0** precomposed nukta codepoints (U+0958-095F) — the pack uses base + U+093C consistently |
| **No non-breaking spaces** | | U+00A0 **0×**, U+202F **0×** |
| **Em dash is rare and spaced** | Prefer a danda-terminated clause. Where an em dash is used it is spaced. | 7 em dashes total, 1 en dash — `TROUBLESHOOTING.md:326`; the 2 unspaced ones at `data/where-data-is-stored.md:21` are a residual (§7) |
| **Menu-path separator is `→` (U+2192)** | Prescribed form — but the pack does **not** yet follow it. `→` accounts for only **46** of the 107 menu paths; the other **61** use ASCII separators and are a live residual (§7-G), not a licence. Write `→` in new text. | `→`: `CONFIGURATION.md:31`, `agents/custom-agents.md:205` · ASCII residuals: `TROUBLESHOOTING.md:102`, `game/storyboard.md:62`, `UPGRADING.md:162` |
| **Ellipsis inside verbatim UI strings is byte-exact** | Reproduce what the client renders; do not normalize. | `TROUBLESHOOTING.md:330` (`"Opening chat..."`, three ASCII periods) |
| **Code fences, paths, URLs and link targets stay byte-identical to `en/`** | | 125/125 files: **0** code-fence mismatches against `docs/` |

---

## 5. UI labels & glosses

**The byte-exact rule.** The `hi` app locale (`packages/client/src/localization/locales/hi.json`)
covers **131 of 9,122** English UI keys — **1.4%**. Practically the whole interface renders **in
English** for a Hindi reader, and the docs pack ships independently of the reader's UI-language
setting. A translated control name in the docs would therefore match nothing on screen.

So: **UI control names stay in English, bold, byte-exact as rendered.**

Verified: of **6,356** bold Latin labels in the pack (6,222 counting only Title-case-initial spans),
**6,299 appear verbatim in the English counterpart file**. The **57 exceptions span 41 (file, label)
pairs**, and they are two different problems:

- **12 pairs / 15 occurrences** are English-source drift — EN renamed or dropped the control since
  the mirror. Not translation defects; enumerated at §7-E.
- **The remaining 29 pairs / 42 occurrences are hi-side over-bolding**: the pack bolds a control the
  English source mentions unbolded or not at all (`**Send**` ×5 in `chats/guided-and-impersonate.md`,
  `**Danger Zone**` ×3 and `**Extensions**` ×3 in `development/personal-extensions.md`,
  `**Gallery**` ×3 in `game/ltx-2-3-storyboards.md`, `**Presets**`, `**Share**`, `**Goals**`,
  `**Impersonate**`, `**Sparkles**` …). That invents a label, which is exactly what the byte-exact
  rule forbids. Logged at §7-H.

### Pattern A — navigational / feature controls: bold EN + one-time parenthetical gloss

The gloss is **Devanagari in parentheses**, given **once per document** on first mention; every
later mention in that document runs bare.

```
इस गाइड में Marinara Engine के प्रॉम्प्ट प्रीसेट के बारे में बताया गया है। … **Preset Editor** (प्रीसेट एडिटर) में इसे कैसे बनाते हैं …
```
— `prompts/presets.md:3`

Verified gloss-once behaviour: of the **45** files using the bold `**Chat Settings**`, **44 gloss it
at least once** and run bare thereafter. Two miss the *first-mention* placement (§7-D): `FAQ.md`
never glosses the bold label at all — its only gloss is on an unbolded mention at `FAQ.md:61` — and
`prompts/presets.md` glosses at its second bold mention (`:141`), not its first (`:138`). Pack-wide,
**562 of 6,356** bold labels carry a Devanagari parenthetical gloss (≈9%) — glosses are for the
*first* navigational mention, not every mention.

| Label | Gloss | Where |
|---|---|---|
| `**Settings**` | (सेटिंग्स) | `extending/personal-extensions.md:3` — 53 glossed instances |
| `**Chat Settings**` | (चैट सेटिंग्स) | 43 glossed instances |
| `**Agents**` | (एजेंट) | `development/optional-agent-packages.md:167` |
| `**Connections**` | (कनेक्शन) | 24 glossed instances |
| `**Lorebooks**` | (लोरबुक) | `lorebooks/overview.md:3` |
| `**Preset Editor**` | (प्रीसेट एडिटर) | `prompts/presets.md:3` |
| `**Persona Editor**` | (पर्सोना एडिटर) | `conversation/profiles.md:12`; `media/animated-expressions.md:32` |
| `**Character Editor**` | (कैरेक्टर एडिटर) | `appearance/card-css-theming.md:21`; `characters/galleries.md:7` |
| `**Memory Recall**` | (मेमोरी रिकॉल) | `TROUBLESHOOTING.md:159` |
| `**Personal Extensions**` | (पर्सनल एक्सटेंशन) | `extending/personal-extensions.md:3` |
| `**Download Backup**` | (बैकअप डाउनलोड) | `data/backup-and-restore.md:9` |
| `**Game Mode**` | (गेम मोड) | `game/ltx-2-3-storyboards.md:3` |
| `**Conversation Theme**` | (कन्वर्सेशन थीम) | `appearance/chat-backgrounds.md:15` |

Gloss style: noun phrase for nouns, आप-imperative for verbs (`**Download Agents** (एजेंट डाउनलोड
करें)`), no terminal punctuation inside the parentheses.

### Arrow paths are glossed **whole**

A menu path's gloss covers **every segment**, mirroring the `→` chain:

```
**Settings → Advanced → Danger Zone** (सेटिंग्स → एडवांस्ड → डेंजर ज़ोन)
```
— `CONFIGURATION.md:31`; likewise `**Agents → Download Agents** (एजेंट → एजेंट डाउनलोड करें)`
(`CONFIGURATION.md:20`).

A gloss covering only the first segment is a defect — two shipped instances are logged at §7-C.
The gloss must also mirror the separator the label uses; `appearance/appearance-settings.md:3`
(`**Settings -> Appearance** (सेटिंग्स -> अपीयरेंस)`) and `development/localization.md:9` carry an
ASCII separator into the Devanagari gloss, which §7-G covers.

### Pattern B — status and error strings: bold EN, **no gloss**

Strings the app *emits* carry no parenthetical gloss; the surrounding Hindi sentence explains them.

- `**Server unreachable**`, `**Unreachable (request timed out)**` — `TROUBLESHOOTING.md:330`
- `**Save blocked: missing CSRF header**`, `**Save blocked: cross-site…**` — `TROUBLESHOOTING.md:114`
- `**Waiting for vector**` — `TROUBLESHOOTING.md:163`
- Emphasis bold on a Hindi word is *not* a label: `**फ़्रीज़**` at `TROUBLESHOOTING.md:330`.

### Pattern C — long verbatim strings: straight double quotes, unbolded, unglossed

- `"Opening chat..."` — `TROUBLESHOOTING.md:330`. `hi` is **not** one of the two locales (ko,
  zh-Hans) that translate this string.
- `"Timeline refreshes may include recent messages from this chat…"` — `noodle/settings.md:195`
- `"currently dnd (At the office)"` — `noodle/settings.md:195`

### Unbolded feature names with no pack precedent

Stay Latin, with a spaced postposition: `Support Diagnostics की कॉपी` — `TROUBLESHOOTING.md:330`.
Do not invent a bold label the English source does not bold.

### Table cells may leave a path unglossed

Inside a `CONFIGURATION.md` variable table the arrow path runs bare —
`दूसरा गेट Settings → Advanced → Danger Zone में खुद चालू करना पड़ता है` (`CONFIGURATION.md:243`) —
while the same path is glossed in prose at `:31`. Cell width, not inconsistency: keep it.

### Never copy a gloss from `hi.json`

**`[recorded ruling]`** The app locale is a different register (§1) and translates mode names. A
gloss must be written in the pack's own register, never pasted from `hi.json`.

---

## 6. Language-specific mechanics

### Nukta policy

**Keep the nukta on ज़ and फ़ only.** Of the Perso-Arabic nukta letters, only these two are written:
`ज़` ×3,013 and `फ़` ×5,909, against `क़` **0×**, `ग़` **0×**, and `ख़` ×2 (both residuals, §7-A).

So: `फ़ाइल` (never `फाइल`), `ज़रूरी` (never `जरूरी`), `सिर्फ़`, `ज़्यादा`, `काफ़ी`, `फ़ोल्डर` —
but `खास` (never `ख़ास`), `सख्त` (never `सख़्त`), `तारीखों` (never `तारीख़ों`).

**`ड़` and `ढ़` are not covered by this rule** — they are obligatory native Devanagari letters, not
optional Perso-Arabic nuktas: `ड़` ×2,057, `ढ़` ×455 (`बड़ा`, `जोड़ने`, `पढ़ें`, `बढ़ानी`).

**Encoding:** nukta is always the combining U+093C after the base letter. Precomposed U+0958-095F
codepoints appear **0×** and must never be introduced — NFC does not unify them, so they would be
invisible to search.

### Grammatical gender of loanwords

Derived from the pack by adjective and verb agreement (`नया/नई`, `पूरा/पूरी`, `होता है/होती है`).
Getting this wrong produces reader-visible agreement errors, so treat the list as normative.

| Feminine | Masculine |
|---|---|
| चैट, फ़ाइल, एंट्री, ब्रांच, लोरबुक, इमेज, स्क्रिप्ट, लिस्ट, गाइड, कुंजी, मेमोरी, कॉपी, वैल्यू, विंडो, थीम, फ़ील्ड, एरर, सेटिंग, गैलरी, हिस्ट्री, रिपॉज़िटरी, इंस्टॉलेशन, डिवाइस, मैक्रो | प्रॉम्प्ट, टोकन, प्रीसेट, कार्ड, संदेश, एजेंट, कनेक्शन, सर्वर, फ़ोल्डर, बैकअप, कैश, स्नैपशॉट, पर्सोना, **नैरेशन**, सीन, मॉडल, अपडेट, वर्ज़न, चेकपॉइंट, पैकेज, टेम्पलेट, प्रोवाइडर, विजेट, लॉग, टैब, पैनल, बटन, ऐप, प्रोसेस, लॉन्चर |

Measured signal: 92 feminine vs 5 masculine attributive adjectives on `चैट`, 25 vs 1 on `फ़ाइल`,
20 vs 1 on `एंट्री` and on `ब्रांच`, 26 vs 3 on `इमेज`; 19 vs 4 masculine on `संदेश`, 12 vs 0 on
`मॉडल`, 18 vs 0 on `वर्ज़न`, 46 masculine verb agreements vs 0 feminine on `बटन`.

Sample evidence: `नई चैट` (`chats/managing-chats.md:19`) / `चैट … हटा दी जाती है`
(`CONFIGURATION.md:155`) · `नई एंट्री` (`agents/approvals-and-agent-suite.md:7`), `एंट्री … जुड़ती
है` (`characters/creating-and-editing-characters.md:151`) · `पूरे बैकअप की ZIP फ़ाइलों`
(`FAQ.md:136`) · `नैरेशन के ऊपर` (`game/combat.md:7`), `GM के नैरेशन से`
(`agents/built-in-agents.md:262`), `नैरेशन को` (`development/optional-agent-packages.md:96`) —
masculine throughout, with **no** feminine counter-instance across all **41** uses (40 lines). The
unified-masculine `नैरेशन` ruling from the lost glossary is confirmed by the pack.

**Unattested — do not assume.** `एक्सटेंशन`, `ट्रैकर` and `स्टोरेज` appear only in oblique or
postpositional positions and carry **zero** agreeing modifiers pack-wide, so the pack cannot settle
their gender; `विजेट` and `मैक्रो` are attested only weakly. Whoever first writes an agreeing form
for one of these sets the precedent — say so in the PR and add the row here.

Method note: `N का` / `N की` is **not** a gender signal for `N` — the postposition agrees with the
*following* noun. Only attributive adjectives (`नया/नई`) and predicate agreement (`होता है/होती है`)
are usable.

### Spacing and compounds

- **Postpositions are separate words** after both Latin names (§2) and Devanagari nouns:
  `Marinara Engine में`, `चैट की सेटिंग्स`.
- **Hindi echo/paired compounds hyphenate:** `मिलती-जुलती` ×126, `समस्या-समाधान` ×24,
  `एक-दूसरे` ×12, `साफ़-सुथरा` ×4, `गिने-चुने` (`CONFIGURATION.md:7`).
- **Loaned English compounds hyphenate:** `बिल्ट-इन` ×88, `थर्ड-पार्टी` ×8, `फ़र्स्ट-पार्टी` ×5,
  `नॉन-प्लेयर` (`game/party-and-npcs.md:3`), `फ़ाइल-स्टोरेज` (`CONFIGURATION.md:153`).
- **`अपने आप` is unhyphenated in prose** (×274). The hyphenated `अपने-आप` is correct **only** as the
  `CONFIGURATION.md` default-column value (`:132`, `:133`) — but that is just **2** of its **21**
  shipped uses. The other **19 are prose** and are a residual (§7-F): `REMOTE_ACCESS.md:127`, `:134`,
  `:136`; `TROUBLESHOOTING.md:294`, `:300`, `:310`; `FAQ.md:37`, `:47`; `installation/android-termux.md:9`,
  `:24`; `CONFIGURATION.md:276`, `:277`; and others.

### Recurring boilerplate headings — one rendering each

| EN | Hindi | Count |
|---|---|---|
| Related guides | **मिलती-जुलती गाइड** | 116 (+1 residual `संबंधित गाइड`, §7-D) |
| Troubleshooting | **समस्या-समाधान** | 21 |
| Before you start | **शुरू करने से पहले** | 11 exact, +1 extended (`## शुरू करने से पहले: एम्बेडिंग सोर्स चुनें`, `lorebooks/semantic-search.md:17`) |
| Quick start | **तुरंत शुरुआत** | 3 |

Across all files whose heading count matches `en/`, **exactly one** English heading has more than
one Hindi rendering — see §7-D. Keep it that way.

### In-fiction and demonstration content is not translated

Example lorebook keys, entry content, and literal-matching demonstrations stay English by design;
translating them destroys the demonstration (`lorebooks/entries.md`). Example *user utterances* may
use in-fiction informal address (§1).

---

## 7. QA checks & known traps

### Tooling traps — read before writing any check

1. **A line-end-anchored danda check is a false pass.** Most Hindi sentences in
   this pack end **mid-line** (7,606 mid-line dandas in prose lines, 8,235 counting table rows). A
   regex anchored with `$` will report a clean pack while missing nearly every sentence. Check
   *sentences*, not lines.
2. **Hard-wrapped source lines make the dual mistake.** Many pack files wrap paragraphs at ~80
   columns (`agents/hierarchical-maps.md`, `FAQ.md`), so "line does not end in `।`" yields **354
   false positives**. Join wrapped continuations before testing the terminator — that drops to
   **87**, all legitimate fragments (mostly enumerated bullet lists in
   `development/hierarchical-locations-prd-v3.md` and `agents/hierarchical-maps.md`).
   **Exclude U+0964 from your "Devanagari" character class when testing terminators** — the danda
   lives inside U+0900–U+097F, so a naive `[ऀ-ॿ]$` test scores every correctly terminated
   sentence as a bare fragment. Use `[ऀ-ॣ०-ॿ]$`.
3. **`[recorded ruling]` `\w` and MSYS `grep` are unsafe for Devanagari.** JavaScript `/\w/u` does not match Devanagari,
   and MSYS `grep -P` / `sed` are byte-oriented, so `-o` output and character classes mis-slice
   multibyte text. Run every Devanagari check through **ripgrep or a Python script reading UTF-8**.
4. **`grep` substring counts over-report nukta pairs.** `सिर्फ` and `सिर्फ़` both "match" 789 times
   because the former is a prefix of the latter. Tokenize before counting; the nukta detector below
   does this correctly.

### Mechanical checks (each catches a real `hi` regression class)

| # | Check | Expected |
|---|---|---|
| 1 | **Nukta-stripped-key detector** — tokenize all Devanagari runs, group by the token with U+093C removed, flag any key with more than one surface form | 4 keys today, of which 2 are legitimate minimal pairs (`मोड`/`मोड़`, `पेड`/`पेड़`) and 2 are defects (§7-A) |
| 2 | Perso-Arabic nuktas other than ज़/फ़ (`क़ ख़ ग़ य़` and precomposed U+0958-095F) | 0 (currently 2 `ख़` — §7-A) |
| 3 | Devanagari digits `०-९` | 0 |
| 4 | ZWJ / ZWNJ (U+200C, U+200D) | 0 |
| 5 | Non-NFC files | 0 |
| 6 | Curly quotes `“ ” ‘ ’`, guillemets | 0 |
| 7 | Non-breaking space U+00A0 / U+202F | 0 |
| 8 | Devanagari character followed by an ASCII `.` (outside code fences) | 0 |
| 9 | Whitespace before `।`; any `॥` | 0 |
| 10 | Danda inside a heading | 0 |
| 11 | FAQ `##` headings not ending in `?` | 1 (`मिलती-जुलती गाइड` — correct) |
| 12 | `तुम` / `तू` / `कीजिए` / `कीजिये` as reader address | 0 |
| 13 | Purism markers: `संगणक`, `यदि`, `प्रत्येक`, `आवश्यक`, `सहायता`, `प्रयास`, `उपयोगकर्ता`, `एप्लिकेशन`, `त्रुटि` | 0 |
| 14 | Devanagari transliterations of frozen names: `नूडल`, `प्रोफ़ेसर`, `मैरिनारा`, `टरमक्स`, `एनपीसी` | 0 |
| 15 | A Devanagari character immediately adjacent to a Latin letter (no space) | 0 |
| 16 | Hyphen-attached postposition after a Latin token (`[A-Za-z]-में` …) | 0 |
| 17 | Bold Latin label not appearing verbatim in the `en/` counterpart file | 0 (currently **57 occurrences / 41 (file, label) pairs** — 12 pairs are EN drift §7-E, 29 are hi-side over-bolding §7-H) |
| 18 | Arrow-path gloss whose segment count ≠ the label's segment count | 0 (currently 2 — §7-C) |
| 19 | An EN heading with more than one Hindi rendering across the pack | 0 (currently 1 — §7-D) |
| 20 | `- [text](target.md)` bullet whose text ≠ the target's H1, where `en/` *does* match | 0 (currently 18 of 452 checked — §7-D) |
| 21 | Bare lowercase English words in unmarked prose (fences, backticks, bold labels, link targets and quoted strings excluded; ≥3 letters) | flag for review; currently 1,143 — §7-B. Definition-sensitive: loosen any exclusion and it climbs fast, so pin the script, not the number |
| 22 | Structural parity vs `en/`: file count, heading count, code fences, link targets | 125/125 files, every one with an EN counterpart; 0 fence mismatches (2 heading + 5 link deltas are EN drift — §7-E) |
| 23 | ASCII menu-path separator: `->` or `>` inside a bold label, or joining two adjacent bold labels | 0 (currently 61 — §7-G) |
| 24 | `अपने-आप` outside the `CONFIGURATION.md` default column | 0 (currently 19 — §7-F) |

Checks 22 and the manifest hashes are the pack-level gates run via
`node scripts/docs-i18n/build-manifest.mjs hi` + `validate-pack.mjs hi` and `pnpm regression:docs`.

### Process rulings preserved from the original cycle

These are pipeline requirements, not text properties, so the pack cannot evidence them:

- **`[recorded ruling]` The nukta-stripped-key detector is a required pipeline step**, not an
  optional lint: PR #4471 states it audited *every Devanagari token pack-wide*. Check 1 above is
  that detector; re-run it on any pack edit, because a single nukta slip silently halves a search
  result set and nothing else in the pipeline notices.
- **`[recorded ruling]` Term-split closure is a whole-pack sweep, not a per-file fix.** The original
  cycle ran a 620-edit consistency sweep that drove transliteration splits to zero across 24 pairs
  and link-text↔H1 mismatches from 267 to 0 (PR #4471). A mirror that fixes one file's spelling
  without re-running the sweep re-opens the split.
- **`[recorded ruling]` The `अनुमति` / `परमिशन` sense split came out of cross-panel reconciliation.**
  Four independent native-reader QA panels read all 124 files end-to-end; the reconciliation pass
  resolved the OS-prompt vs Marinara-capability collision as a recorded ruling (PR #4471). The split
  itself is verified in §3; its provenance is why it is not negotiable in review.

### Known pack residuals

Documented, **not** silently fixed. Each is a real deviation from a rule above; fix them in a
deliberate, reviewable change rather than as a drive-by.

**A. Nukta violations (3 instances, rule §6).**

| Location | Shipped | Should be | Caught by |
|---|---|---|---|
| `integrations/haptic-feedback.md:80` | `सख़्त` | `सख्त` (13 correct uses elsewhere) | checks 1 **and** 2 |
| `agents/hierarchical-maps.md:629` | `काफी` | `काफ़ी` (17 correct uses elsewhere) | check 1 |
| `agents/memory.md:54` | `तारीख़ों` | `तारीखों` | check 2 only — `तारीखों` never co-occurs, so the split-key detector cannot see it |

The first and third add a banned `ख़`; the second drops a required `फ़`. Note that the two checks
are **not** redundant: check 1 finds inconsistency, check 2 finds a banned letter used consistently.

**B. Under-translated / code-mixed regions (rule §1, §3).**

**1,143** bare lowercase English words survive in unmarked prose (check 21's definition), heavily
concentrated:

| File | Count | Note |
|---|---|---|
| `agents/hierarchical-maps.md` | 250 | Worst at `:611-660` (map export/import lore). `Exact entry ID तभी authoritative है जब वह destination lorebook की हो` (`:629`) is Hinglish, not the pack register. Also carries `केवल` ×4 and the `काफी` nukta defect. |
| `noodle/settings.md` | 122 | The NoodleR publishing section `:84-98` keeps `post`, `publish`, `creators`, `toggle`, `default`, `counter`, `reserve` untranslated. |
| `development/file-storage.md` | 90 | Developer-facing; lower priority. |
| `characters/galleries.md` | 67 | **User-facing** — higher priority than its rank suggests. |
| `TROUBLESHOOTING.md` | 66 | **User-facing** — same. |
| `development/frontend.md` | 41 | Developer-facing. |
| `agents/custom-agents.md` | 36 | `:113-114` — `render कर सकता है`, `activation keywords का इंतज़ार`, `error toast`. |

A related register drift: `तथा` ×139 and `केवल` ×24 cluster in `development/` and
`agents/hierarchical-maps.md`; `उत्तर` ×2 and `पात्रों` ×2 in `agents/built-in-agents.md:153`, `:155`
are the only Sanskritized-register lines in a user-facing guide.

**C. Truncated arrow-path glosses (2 instances, rule §5).**

- `agents/custom-agents.md:205` — `**Settings → Advanced → Danger Zone** (सेटिंग्स)`
- `agents/built-in-agents.md:3` — `**Agents → Download Agents** (एजेंट)`

Both should gloss the whole path, as `CONFIGURATION.md:31` and `:20` do.

**D. Link-text and heading splits (rule §5, §6).**

- `extending/writing-personal-extensions.md:254` renders *Related guides* as `संबंधित गाइड` against
  116 uses of `मिलती-जुलती गाइड`. (`chats/sending-and-streaming.md:16`, `:127` use `संबंधित गाइड`
  as ordinary prose — those are fine.)
- 18 of 452 "Related guides" bullets have link text that drifts from the target's H1 while the
  English source matches exactly. 15 of them are `AI प्रोवाइडर से कनेक्ट करना` pointing at
  `connections/connecting-to-a-provider.md`, whose H1 is `किसी AI प्रोवाइडर से कनेक्ट करना` — one
  missing `किसी`. The other 3 point at `extending/writing-personal-extensions.md`,
  `extending/personal-extensions.md` and `development/personal-extensions.md`. This degrades search
  ranking; PR #4471 drove this class to zero once and it has drifted back.
- `**Chat Settings**` first-mention gloss: `FAQ.md` never glosses the bold label (only the unbolded
  mention at `:61`), and `prompts/presets.md` glosses at `:141` rather than at its first bold
  mention `:138`. 44 of the 45 files gloss it somewhere.

**E. English-source drift, **not** translation defects (as of 2026-09-01 `staging`).**

This is the 12-pair / 15-occurrence slice of check 17; the other 29 pairs are §7-H.

The pack is behind current `docs/` in a few places; the mirror cycle owns these:

- `FAQ.md` and `prompts/macros.md` each lack one section EN has gained
  (EN's *Lorebook size macro* in `macros.md`, one new FAQ question).
- `media/tts-setup.md` lacks one EN link (`pocket-tts`).
- 12 distinct (file, label) pairs — 15 occurrences — have no verbatim EN counterpart because EN has
  since renamed or dropped the control: `LTX Director Video` (×6 across
  `game/ltx-2-3-storyboards.md`, `development/ltx-director-storyboard.md`, `game/storyboard.md`;
  current EN spells it `LTX Simple Image` and friends), `Subscribers` / `PPV` / `Subscriber access`
  / `Subscriptions include PPV` (`noodle/settings.md`; EN's section is now
  *Subscriptions and post access*), plus `Discard draft`, `Restore portable map lore`,
  `Import a new copy` (`agents/hierarchical-maps.md`), `Game Mode`
  (`appearance/card-css-theming.md`), `Character Tracker` (`characters/personas.md`).

Verify against `docs/` before "fixing" any of these — the correct fix is a mirror, not a retranslation.

**F. Minor style residuals.**

- `अपने-आप` hyphenated in **19** prose places where `अपने आप` is the norm (274). Only 2 of its 21
  uses (`CONFIGURATION.md:132`, `:133`) are the licensed default-column form. Check 24.
- 2 unspaced em dashes at `data/where-data-is-stored.md:21`; the pack's other 5 are spaced.
- `सहेज` ×1 against `सेव` ×676; `आँकड़े` ×5 against `डेटा` ×288; `पात्र` ×2 against `कैरेक्टर` ×1,315;
  `याददाश्त` ×2 (`noodle/settings.md:145`, `:147`) against `मेमोरी` ×120.
- `शाखा` ×1 at `agents/hierarchical-maps.md:652` — an *archived map-tree branch*, not a chat branch,
  but it is still the banned alternate and `ब्रांच` (×169) would read correctly there.
- **`अनुमति` used for a Marinara-level capability grant** in 2 places, against the §3 sense split:
  `development/optional-agent-packages.md:74` (`` `prompt-context` अनुमति वाले पैकेज ``, where
  `agents/built-in-agents.md:267` writes the same permission as `परमिशन`) and
  `extending/personal-extensions.md:11` (`अलग से अनुमति माँगने वाले External Extensions फ़्लो`, where
  the same file writes `परमिशन` at `:118`, `:130`, `:155`).
- **`बर्ताव` ×17 against `व्यवहार` ×63** for *behavior*, with no sense boundary — `prompts/generation-parameters.md:152`
  uses both in one sentence. Not forced this cycle; resolve in a whole-pack sweep, not per file.
- `content` is split between `कंटेंट` (23, mostly `development/`) and `सामग्री` (56) with no clean
  sense boundary. **`[recorded ruling]`** no forced ruling this cycle — flagged for the next
  consistency sweep rather than normalized blind.

**G. Menu-path separator: the pack is majority-ASCII (rule §4).**

The prescribed `→` is the **minority** form. Measured across 107 menu paths:

| Form | Count | Where |
|---|---|---|
| `→` inside a bold label (`**Settings → Advanced → Danger Zone**`) | 45 | `CONFIGURATION.md:20`, `:31`; `agents/custom-agents.md:205` |
| `→` joining two bold labels | 1 | |
| **`>` joining two bold labels** (`**Settings** > **Advanced** > **Admin Access**`) | **28** | `TROUBLESHOOTING.md:102`, `:139`, `:281`, `:425`; `settings/settings-overview.md:42`, `:57`, `:106`, `:138`; `extending/writing-personal-extensions.md:12`, `:14`, `:100`, `:250`; `noodle/settings.md:21`, `:43`, `:84`, `:141`, `:152`; `REMOTE_ACCESS.md:200`; `data/backup-and-restore.md:75`; `home/professor-mari.md:27`; `extending/personal-extensions.md:3`, `:180`, `:182` |
| **`>` inside a bold label** (`**Chat Settings > Agents > Storyboards**`) | **23** | `game/storyboard.md:13`, `:25`, `:62`, `:106`, `:169`, `:280`, `:310`, `:318`; `game/getting-started.md:23`, `:63`; `FAQ.md:175`, `:183`; `TROUBLESHOOTING.md:225`; `development/localization.md:9`, `:124`; `media/scene-video.md:135`; `connections/local-model.md:165`; `game/ltx-2-3-storyboards.md:27` |
| **`->` inside a bold label** | **10** | `UPGRADING.md:162`; `appearance/appearance-settings.md:3`; `appearance/custom-css-themes.md:64`, `:108`; `connections/local-model.md:191`; `data/importing-from-sillytavern.md:68`, `:91`; `development/noodle-internals.md:12`, `:14`, `:38` |

Two consequences a reviewer must not miss. First, `appearance/appearance-settings.md:3` carries the
ASCII form **into the Devanagari gloss** — `**Settings -> Appearance** (सेटिंग्स -> अपीयरेंस)` —
and `development/localization.md:9` does the same with `>`. Second, three separator forms for one
menu path split the literal substring index three ways, which is precisely the failure the §4 rules
exist to prevent. Fix as one sweep (§7 process ruling), not file by file.

ASCII `->` also appears in flow diagrams at `development/chat-resource-drag-drop-plan.md:349-361`,
`development/hierarchical-locations-prd-v3.md:144-147`, `game/ltx-2-3-storyboards.md:11-14` and
`game/storyboard.md:193-196`. Those are pipeline arrows, **not** menu paths — leave them.

**H. Over-bolded labels the English source does not bold (rule §5).**

29 (file, label) pairs / 42 occurrences, distinct from the EN drift at §7-E. The pack bolds a
control that the EN counterpart mentions unbolded or not at all — inventing a label, which the
byte-exact rule forbids. Heaviest: `**Send**` ×5 (`chats/guided-and-impersonate.md`),
`**Danger Zone**` ×3 and `**Extensions**` ×3 (`development/personal-extensions.md`), `**Gallery**`
×3 (`game/ltx-2-3-storyboards.md`), `**Chat Settings**` ×4 (`development/hierarchical-locations-prd-v3.md`)
and ×1 (`CONFIGURATION.md`). Singles include `**Presets**`, `**Share**`, `**Goals**`, `**GM**`,
`**Connection**`, `**Impersonate**`, `**New Draft**`, `**Sparkles**`, `**current story location**`,
`**Game Assets**`, `**Conversation Commands**`, `**Character Editor**`, `**Persona Editor**`,
`**Lorebooks**`, `**Agents**`, `**Settings**`, `**Connections**`, `**Character**`.

Check the EN file before unbolding: some of these are cases where EN *should* bold the control and
the fix belongs upstream in `docs/`, not in the translation.

---

## Change log

| Date | Change |
|---|---|
| 2026-09-01 | **Verification pass against the shipped pack.** Every terminology row re-greped for its prescribed term *and* its banned alternates, and every mechanical claim re-measured. Corrections: the `→` menu-path rule was stated as already-held when the pack is in fact 61-to-46 ASCII (new §7-G, check 23); check 17 was reported as 12 exceptions when it is 57 across 41 pairs (new §7-H); `असिस्टेंट` is the *assistant message role*, not a Professor Mari reservation; `बर्ताव`/`व्यवहार`, `तयशुदा` (= deterministic) and `हूबहू`/`अक्षरशः` were flat bans the pack contradicts, now sense-scoped or logged as unresolved splits; `अपने-आप` is 19-in-prose, not default-column-only; the spaced-postposition count was 54 against a measured 1,034. Added a sense-scoped-ban table so a grep stops producing false regressions, the U+0964-inside-the-Devanagari-block terminator trap, and re-measured counts for `मैसेज`, the boilerplate headings, `नैरेशन`, the fragment/cell definitions and §7-B. Confirmed exactly as shipped: all §1 register splits, the nukta measurements and 4-key split detector, §7-A, §7-C, §7-D's 18 link drifts, §7-E's 12/15, the default-column table, and every typography scan (digits, quotes, ZWJ/ZWNJ, NFC, NBSP, grouping, fences). |
| 2026-09-01 | Second-generation glossary re-derived from the shipped pack, PR #4471, and the 2026-09-01 mirror-cycle notes, after the originals were lost to temp-directory cleanup. Added the measured residual inventory (A–F), the re-derived loanword gender list confirming the unified-masculine `नैरेशन` ruling, the ज़/फ़-only nukta measurement (with `ड़`/`ढ़` explicitly excluded from the rule), the `hi.json` 1.4%-coverage finding behind the byte-exact UI rule, the `अनुमति`/`परमिशन`/`इजाज़त` three-way sense split, and the mid-line-danda and hard-wrap tooling traps. |

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, a native NovelAI character caption is a
**कैरेक्टर का विवरण**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.
