# Polish (`pl`) documentation-pack glossary

## Provenance

This is the **second-generation** glossary for the `pl` documentation pack on the
`docs-i18n` branch. It was **re-derived on 2026-09-01**, after the original
working glossaries were lost to temp-directory cleanup, from three sources in
authority order:

1. **The shipped pack itself** (`pl/`, 125 guides + `manifest.json`) — treated as
   ground truth. Every prescriptive rule below is either verified against the pack
   by scan and cited as `path:line`, or explicitly marked as a recorded ruling.
   All scans were run in Python with `str` regexes, never with shell `grep` —
   see T-5, which explains why the distinction is load-bearing for Polish and not
   pedantry.
2. **The pack's shipping PR decision write-up** — Marinara-Engine PR
   [#4235](https://github.com/Pasta-Devs/Marinara-Engine/pull/4235) ("Polish
   documentation language pack", closes #4258), plus the Polish clause added by
   that PR to `CONTRIBUTING.md § Translated documentation` (line 238 on
   `staging`). That one line is a genuinely independent check on this glossary,
   because it states the same rules in prose without reference to the pack bytes:
   *"ty" with 2nd-person imperatives* (R-1), *avoid reader-gendering past-tense
   forms* (R-3), *product names stay UNDECLINED with a carrier noun where the case
   demands — "w aplikacji Marinara Engine", never "w Marinarze" — while assimilated
   loanwords decline normally* (R-8/R-9/R-10/R-20), *straight ASCII quotes only,
   never „…", and no non-breaking spaces* (R-95/R-98), *mode names
   Conversation/Roleplay/Game Mode stay English* (R-14). Where a rule below is
   corroborated there as well as in the pack, it is about as settled as anything
   in this document gets.
3. **The 2026-09-01 mirror-cycle notes** (`prd-notes-pl.md`) — per-row,
   evidence-cited choices made while mirroring three English deltas (storage
   table, security table, Termux troubleshooting) plus three new UI labels. All
   of those choices are now landed in the pack and are re-verified here against
   the shipped text, not against the notes.

Where a source ruling is a **process rule** or a **claim about app behavior** that
the pack's own bytes cannot demonstrate, it is kept but labelled `RR-n`
(**recorded ruling**) rather than counted as verified.

Rule IDs: `R-n` = verified against the pack. `RR-n` = recorded maintainer/cycle
ruling, no in-pack evidence possible. Counts of "0 hits" are themselves evidence —
a pack-wide scan returning nothing is how a prohibition gets verified, *provided*
the scanner can see Polish letters (T-5).

Where the pack contradicts itself, this document says so rather than picking a
winner silently: the rule states the target form and a numbered entry under §7
records the counter-evidence with counts and file cites. §7 residuals 1, 6 and 7
are live splits, not stray typos — treat them as open work, not as noise.

Pack facts at the time of derivation: 125 files, 1:1 with English `docs/`, no
extra and no missing files, and `manifest.json` lists exactly those 125; all
NFC-normalized (0 combining marks); no BOM; LF endings; no trailing whitespace;
exactly one `# ` H1 per file.

---

## 1. Register & address

**R-1 — Informal `ty`, second-person singular imperatives.** The reader is
addressed directly and informally, with 2sg imperatives for every instruction.
*Evidence:* `chats/slash-commands.md:7` — "wpisz ją w polu wiadomości na dole
czatu i naciśnij przycisk **Send**"; `lorebooks/overview.md:25` — "Otwórz go z
paska bocznego aplikacji."

**R-2 — No formal register.** `Pan` / `Pani` / `Państwo` and the corporate
`proszę + infinitive` construction never appear. *Evidence:* 0 hits pack-wide for
`\bPan(i|u|a|ie)?\b`, `\bPaństw\w*` and `proszę \w+ć`.

**R-3 — Gender-neutrality is absolute for the reader.** Polish past-tense verbs
encode gender, so 2sg past forms in `-łeś` / `-łaś` are banned outright.
*Evidence:* 0 hits pack-wide for `\w+ł[ae]ś\b` across all 125 files, and 0 for the
conditionals `\w+ł[ab]yś\b`. (The 42 hits for `-łem/-łam` are all false positives
inside ordinary nouns in the instrumental case — `hasłem`, `tłem`, `źródłem`,
`kanałem` — not verbs.) This is the rule whose check is easiest to fake a pass on;
read T-5 before you trust a clean result here.

**R-4 — The gender-neutral toolkit.** To avoid gendered past tense, the pack uses,
in rough order of frequency: 2sg imperatives; present tense; impersonal `-się`
constructions; and the modal frames `da się`, `można`, `warto`, `trzeba`.
*Evidence:* `CONFIGURATION.md:9` — "Konfigurację zmienia się zwykle po to, żeby";
`lorebooks/overview.md:21` — "Marinara umie też dopasowywać wpisy po znaczeniu";
`lorebooks/overview.md:31` — "dzięki czemu da się naraz wyeksportować lub usunąć
kilka lorebooków"; `UPGRADING.md:19` — "Warto ją zrobić przed każdym większym
skokiem".

**R-5 — Reader pronouns are lowercase.** `ciebie`, `tobie`, `twój/twoja/twoje` are
written lowercase mid-sentence; the capitalized epistolary forms `Ciebie`,
`Tobie`, `Twój` are not the pack's convention. *Evidence:* 51 lowercase `ciebie`
vs. 7 capitalized mid-sentence occurrences — `home/achievements.md:53` "profil,
który reprezentuje ciebie w czacie"; `appearance/chat-backgrounds.md:80` "Marinara
wraca za ciebie do tła wbudowanego". The 7 capitalized cases are a known residual
(§7 residual 2).

**R-6 — Address is used sparingly.** Capability and behavior statements are
impersonal; the second person is reserved for actions the reader performs.
*Evidence:* `CONFIGURATION.md:7` — "Marinara Engine działa od razu po instalacji"
(impersonal statement) immediately followed by the imperative instruction block at
`CONFIGURATION.md:9`.

**R-7 — Definitional glosses use the `X to …` copula, not a verb.** Jargon is
introduced with a bare nominal definition. *Evidence:* `chats/peek-prompt.md:5`
"Prompt to cały blok instrukcji i historii czatu"; `agents/built-in-agents.md:7`
"Agent to niewielki pomocnik AI"; `characters/personas.md:7` "Persona to ktoś, kim
jesteś w czacie"; `chats/chat-settings.md:28` "Połączenie to zapisany skrót do
dostawcy AI".

**RR-1 — Why informal `ty`.** Chosen to match the informal-register precedent set
by every earlier pack (es/de/fr/pt-br) and Polish consumer-software convention.
The result is verifiable (R-1); the cross-pack rationale is a PR #4235 ruling.

---

## 2. Product, feature & mode names

**R-8 — Marinara product names are never declined.** No case-inflected form of the
brand exists anywhere in the pack. *Evidence:* 0 hits pack-wide for
`Marinar(ze|y|ą|ę|om|ami|ach)\b`.

**R-9 — Oblique cases take a declinable carrier noun.** The standard carrier is
`aplikacja`, inflected while the name stays frozen. *Evidence:* 427 hits for
`aplikacj\w+ Marinara Engine`, distributed `aplikacji` 319 / `aplikację` 57 /
`aplikacja` 33 / `aplikacją` 18. `CONFIGURATION.md:3` — "zmieniać ustawienia
serwera w aplikacji Marinara Engine"; `TROUBLESHOOTING.md:63` — "uruchom aplikację
Marinara Engine ponownie".

**R-10 — A preposition takes the carrier noun, not the bare frozen name.**
`w Marinara Engine`, `do Marinara`, `z Marinara` do not occur anywhere.
*Evidence:* 0 hits pack-wide for `\bw(e)? Marinara`, `\bdo Marinara`,
`\bz Marinara`, and 427 carrier-noun constructions instead (R-9). The rule is not
absolute in the shipped pack: 6 bare-preposition uses survive with `przez` and
`pod`, all in the same two files. See §7 residual 11. New text should use the
carrier.

**R-11 — Bare `Marinara` is allowed as a nominative subject, with feminine
agreement.** *Evidence:* `CONFIGURATION.md:20` — "Marinara sama wybiera z katalogu
… ścieżkę"; `CONFIGURATION.md:71` — "Marinara nie wykonuje znaku `$`";
`lorebooks/overview.md:21` — "Marinara umie też dopasowywać wpisy".

**R-12 — `silnik Marinara` is not a carrier.** The engine-as-noun framing is never
attached to the brand. *Evidence:* 0 hits pack-wide for `silnik\w* Marinara`. The
word `silnik` itself is common (28 occurrences across 15 files) but always in the
generic sense — a game engine, an ONNX engine, "the engine" as the codebase
(`agents/built-in-agents.md:202` "silnik od wersji `2.3.5`";
`conversation/calls.md:241` "ONNX to silnik, który uruchamia lokalny model mowy";
`CONFIGURATION.md:278`).

**R-13 — Third-party product names take the same carrier-noun treatment.**
*Evidence:* `system Windows` ×20 (`FAQ.md:15` "W systemie Windows uruchom to
polecenie"); `środowisko Termux` ×18 (`CONFIGURATION.md:278`); `kontener Docker`
×20 (`CONFIGURATION.md:25` "w kontenerze Docker") plus `obraz Docker` ×2;
`serwis GitHub` ×9 (`CONFIGURATION.md:27` "gdy połączenie HTTPS z serwisem GitHub
jest niedostępne"). `Termux`, `GitHub` and `Windows` are never declined (0 hits
for `Termuxie`, `Termuxa`, `GitHubie`, `GitHuba`, `Windowsie`, `Windowsa`);
`Docker` is declined 3 times — see §7 residual 8.

**R-14 — Mode names stay English behind the carrier noun `tryb`.**
`Conversation`, `Roleplay`, `Game Mode` are never translated. *Evidence:*
`FAQ.md:53-55` — "**Conversation**: czat w stylu SMS-ów…", "**Game Mode**:
prowadzona przygoda tekstowa"; `agents/knowledge-sources.md:16` — "Obaj agenci
działają wyłącznie na czatach w trybie **Roleplay**. W trybie Conversation Mode
ani w trybie Game Mode nie da się ich dodać."; `characters/sprites.md:12` — "tylko
w trybie **Roleplay Mode** i **Game Mode**".

**R-15 — Panel, section, tab and control names stay English, in bold.**
*Evidence:* `CONFIGURATION.md:20` — "Otwórz sekcję **Agents → Download Agents**";
`lorebooks/overview.md:25` — "Panel **Lorebooks**"; `UPGRADING.md:128` — "Lista
rozwijana **Release Channel**".

**R-16 — Named features stay English.** Peek Prompt, Memory Recall, Impersonate,
Chat Summary, Release Channel, Support Diagnostics, Danger Zone, World Info.
*Evidence:* `chats/peek-prompt.md:5` "Dzięki funkcji **Peek Prompt**";
`chats/guided-and-impersonate.md:59` "Funkcja Impersonate każe AI napisać";
`TROUBLESHOOTING.md:330` "kopia z sekcji Support Diagnostics";
`characters/personas.md:101` / `lorebooks/overview.md:7` "**World Info**".

**R-17 — Agent names stay English.** *Evidence:* `FAQ.md:173` "Agent
**Storyboard**"; `agents/built-in-agents.md:111` "Character Tracker";
`agents/approvals-and-agent-suite.md:40` "Agent **Card Evolution Auditor**".

**R-18 — Professor Mari is frozen and takes the feminine carrier `asystentka`.**
*Evidence:* `FAQ.md:161` — "Professor Mari to wbudowana asystentka na ekranie
głównym"; `CONFIGURATION.md:322` — "Jak długo asystentka Professor Mari trzyma w
pamięci podręcznej odczyt z wiki."

**R-19 — A heading may stay English when the heading *is* the UI control name.**
*Evidence:* `UPGRADING.md:126` "### Release Channel"; `UPGRADING.md:137`
"### Check for Updates"; `agents/approvals-and-agent-suite.md:91` "## Panel Cached
prompt injections" (carrier + English name).

**R-20 — Ordinary loanwords, unlike product names, decline fully.** The freeze
applies to *names*, not to vocabulary — the two policies coexist in a single
sentence. *Evidence:* `lorebooks/overview.md:9` — "Marinara Engine dodaje tekst
tego wpisu do promptu" (frozen name, declined loanword); `CONFIGURATION.md:18` —
"klucze API dostawców AI, postacie i opcje czatu". Full paradigms in §6.

**RR-2 — Why the freeze.** A declined product name fragments the docs viewer's
literal substring search: "Marinarze" does not contain-match "Marinara". Recorded
in PR #4235 and in `CONTRIBUTING.md:238`. The rule's *effect* is verified (R-8);
the search-behavior claim is not observable from pack bytes.

---

## 3. Core terminology

Table conventions: **Term** is the English source word. **Pack's term** is the
form the shipped `pl/` pack uses, with the inflections it actually shows.
**Banned** lists alternates that must not be introduced (including forms that are
*correct Polish* but split the substring search, and forms that are reserved for a
different sense). **Evidence** is one file in the pack that shows the term.

| # | English term | Pack's term | Banned alternates | Evidence |
|---|---|---|---|---|
| R-21 | prompt | `prompt`, declines fully: promptu, promptem, prompcie, prompty, promptów | podpowiedź (reserved: tooltip), monit, polecenie (reserved: shell command), zachęta, znak zachęty | `chats/peek-prompt.md:5` |
| R-22 | prompt (first-use gloss) | "prompt to tekst, który Marinara wysyła do AI" — in parentheses on first use per file | ad-hoc paraphrases of the gloss | `lorebooks/entries.md:5`, `game/storyboard.md:5` |
| R-23 | token | `token`, declines: tokeny, tokenów, tokenach | żeton (reserved: poker chips, `conversation/table-games.md:109`), znacznik | `chats/slash-commands.md:17` |
| R-24 | token (first-use gloss) | "token to mały kawałek tekstu" / "jednostka, którą większość dostawców AI mierzy i rozlicza tekst" | — | `chats/messages.md:95`, `lorebooks/entries.md:19` |
| R-25 | preset | `preset`, declines: presetu, presetem, presety, presetów | ustawienie wstępne, szablon (bare — reserved: template), profil (reserved: settings profile / persona profile) | `prompts/presets.md:7` |
| R-26 | lorebook | `lorebook`, declines: lorebooka, lorebookiem, lorebooki, lorebooków | księga wiedzy (this is the app's `pl.json` UI string — see §7 residual 10), zbiór wiedzy, kompendium | `lorebooks/overview.md:7` |
| R-27 | World Info | `World Info` — kept English as the stated synonym of lorebook | Informacje o świecie | `lorebooks/overview.md:7` |
| R-28 | lorebook entry | `wpis` (wpisu, wpisy, wpisów) | pozycja, rekord, notka | `lorebooks/entries.md:5` |
| R-29 | keyword / key | `słowo kluczowe` (słowa kluczowe, słów kluczowych) | klucz, hasło | `agents/custom-agents.md:122` |
| R-30 | character card | `karta postaci` | karta znaku, karta bohatera | `FAQ.md:99` |
| R-31 | chat (the object) | `czat`, fully assimilated and declined: czatu, czacie, czatem, czaty, czatów, czatach | chat (English spelling in Polish prose), pogawędka, konwersacja | `CONFIGURATION.md:18` |
| R-32 | conversation (human sense) | `rozmowa` | — (do not use `rozmowa` for the chat object; that is `czat`) | `agents/built-in-agents.md:153` |
| R-33 | message | `wiadomość` (wiadomości, wiadomościach) | komunikat (reserved: system/error message, `TROUBLESHOOTING.md:330`) | `chats/messages.md:95` |
| R-34 | agent | `agent`, declines: agenta, agentem, agenci, agentów | asystent (reserved for Professor Mari), bot | `agents/built-in-agents.md:7` |
| R-35 | connection | `połączenie` (połączenia, połączeniu) — gloss "zapisany skrót do dostawcy AI" | łącze, konfiguracja połączenia | `chats/chat-settings.md:28` |
| R-36 | provider | `dostawca (AI)` (dostawcy, dostawców) | usługodawca, provider | `connections/connecting-to-a-provider.md:7` |
| R-37 | launcher | `program uruchamiający` (programy uruchamiające) ×46 is the dominant form; two rival forms survive — `launcher` in `UPGRADING.md`, `skrypt startowy` throughout `installation/macos-linux.md` — see §7 residual 1 | uruchamiacz (0 hits), skrypt uruchomieniowy | `TROUBLESHOOTING.md:324`, `CONFIGURATION.md:278` |
| R-38 | update (noun) | `aktualizacja` (aktualizacje, aktualizacji) | uaktualnienie (0 hits pack-wide), upgrade | `UPGRADING.md:19` |
| R-39 | apply (an update) | `wgrać` / `wgrywanie` / `wgranie aktualizacji` | zastosować aktualizację (reserved for the *remote* apply framing, `installation/windows.md:213`), zaaplikować, nałożyć | `CONFIGURATION.md:239` |
| R-40 | release channel | `kanał wydań`; channel switch = `zmiana kanału` | kanał wersji, tor wydawniczy | `UPGRADING.md:128`, `CONFIGURATION.md:237` |
| R-41 | checkout (a Git working copy) | `kopia repozytorium`; the literal string `git checkout` stays frozen in quotes | kopia robocza (**reserved**: an editor draft, `agents/hierarchical-maps.md:100`), wypożyczenie, kasa | `TROUBLESHOOTING.md:39`, `UPGRADING.md:33` |
| R-42 | development checkout | `deweloperska kopia repozytorium` | deweloperska kopia robocza | `CONFIGURATION.md:238` |
| R-43 | loopback | `pętla zwrotna` | interfejs zwrotny, localhost (as a translation) | `CONFIGURATION.md:238` |
| R-44 | wake lock | `blokada uśpienia`; the commands `termux-wake-lock` / `termux-wake-unlock` stay byte-exact in backticks | blokada wybudzenia, wake lock (untranslated in prose) | `TROUBLESHOOTING.md:324`, `:326` |
| R-45 | battery optimization | `optymalizacja baterii` (wyłącz … optymalizację baterii) | oszczędzanie baterii, optymalizacja zużycia energii | `TROUBLESHOOTING.md:326` |
| R-46 | background activity | `działanie w tle` (zezwól aplikacji Termux na działanie w tle) | aktywność w tle, praca w tle | `TROUBLESHOOTING.md:326`, `:332` |
| R-47 | memory (RAM) / in memory | `pamięć`; residency = `trzymać w pamięci`, `żyć wyłącznie w pamięci` | RAM (as a prose noun outside hardware requirements) | `CONFIGURATION.md:155`, `characters/bot-browser.md:116`, `TROUBLESHOOTING.md:182` |
| R-48 | dropped from memory / evicted | `usuwany z pamięci (nigdy z dysku)`; the concept = `usuwanie z pamięci` | eksmisja, wyrzucanie, usuwanie danych (ambiguous with deletion) | `CONFIGURATION.md:155` |
| R-49 | least-recently-used | `najdawniej używany` | najrzadziej używany (that is LFU, a different policy), ostatnio nieużywany | `CONFIGURATION.md:155` |
| R-50 | memories (agent memory vault) | `wspomnienia` (wspomnienie, wspomnień) — distinct from R-47 `pamięć` | pamięci (plural of RAM sense) | `TROUBLESHOOTING.md:163`, `agents/built-in-agents.md:153` |
| R-51 | phone memory | `pamięć telefonu` | pamięć urządzenia mobilnego | `TROUBLESHOOTING.md:347` |
| R-52 | cache | prose: `pamięć podręczna` (w pamięci podręcznej) ×24; developer docs keep `cache` with an apostrophe before Polish endings (`cache'u` ×2) | bufor / buforowanie (**leaks twice** for *prompt caching* — §7 residual 12), podręczna pamięć (word order), keszowanie | `TROUBLESHOOTING.md:80`, `development/frontend.md:559` |
| R-53 | backup | `kopia zapasowa` (kopię zapasową, kopii zapasowych) | backup (in Polish prose), zabezpieczenie danych | `FAQ.md:132`, `UPGRADING.md:19` |
| R-54 | snapshot | `migawka` (migawki, migawkę) | zrzut (reserved: screenshot/dump), stan zapisany, snapshot | `characters/creating-and-editing-characters.md:128`, `agents/hierarchical-maps.md:381` |
| R-55 | checkpoint | `punkt kontrolny` (×17) | checkpoint (**reserved**: the ComfyUI/LTX model file, `game/ltx-2-3-storyboards.md:43`), punkt zapisu | `agents/built-in-agents.md:153` |
| R-56 | extension | `rozszerzenie` (rozszerzenia, rozszerzeń); the panel/menu name **Extensions** stays English | dodatek (**reserved**: glosses the **Addons** settings section, `CONFIGURATION.md:312`), wtyczka (reserved: a build-tool plugin, `development/frontend.md:372`), plugin | `CONFIGURATION.md:57`, `development/personal-extensions.md:93` |
| R-57 | NPC | `NPC` frozen and undeclined, behind the carrier noun `postać`: `postać NPC`, `postaci NPC`; first-use gloss "(postaci niezależnej)" | BN, NPC-e, NPC-ów, postać niezależna as the standing term | `game/dice-and-skill-checks.md:68`, `game/party-and-npcs.md:79` |
| R-58 | persona | `persona` (persony, personie, person) — gloss "postać, w którą się wcielasz" | profil użytkownika (ambiguous with settings profile), awatar | `characters/personas.md:7`, `chats/slash-commands.md:98` |
| R-59 | slash command | `komenda slash` (komendy slash, komendę) | polecenie slash, ukośnikowe polecenie | `chats/slash-commands.md:1` |
| R-60 | shell / CLI command | `polecenie` (poleceniem, polecenia) | komenda (reserved for R-59), rozkaz | `TROUBLESHOOTING.md:23`, `FAQ.md:15` |
| R-61 | sprite | `sprite` with an ASCII apostrophe before Polish endings: sprite'y, sprite'ów, sprite'ami, sprite'a | sprajt, duszek, spritey (no apostrophe) | `CONFIGURATION.md:104`, `characters/sprites.md:12` |
| R-62 | swipe (response variant) | `swipe` with apostrophe: swipe'y, swipe'em | przesunięcie, machnięcie | `agents/hierarchical-maps.md:379` |
| R-63 | variant (of a response) | `wariant` (warianty, wariantów) | wersja (reserved: version) | `TROUBLESHOOTING.md:260` |
| R-64 | widget | `widget` in Latin spelling, declines: widgety, widgetach, widgetów | widżet (0 hits in the pack; this *is* the app's `pl.json` spelling — see §7 residual 10) | `game/hud-widgets.md:1`, `roleplay/hud-and-trackers.md:3` |
| R-65 | tracker | `tracker` (trackery, trackerów) | śledzik, monitor | `CONFIGURATION.md:206`, `roleplay/hud-and-trackers.md:3` |
| R-66 | HUD | `HUD` frozen and undeclined, behind the carrier `pasek HUD` | interfejs nagłówkowy, HUD-u | `roleplay/hud-and-trackers.md:3`, `roleplay/getting-started.md:9` |
| R-67 | branch (chat or Git) | `gałąź` (gałęzi, gałęzie) | odnoga, branch | `CONFIGURATION.md:316` |
| R-68 | summary | `podsumowanie` (podsumowania); the shortened text = `streszczenie` | skrót, sumaryzacja | `FAQ.md:128` |
| R-69 | embedding | `embedding` (embeddingów, embeddingi) | osadzenie, wektor (reserved: vector) | `CONFIGURATION.md:15`, `agents/memory.md:36` |
| R-70 | macro | `makro` (makra) | makropolecenie | `agents/custom-agents.md:166` |
| R-71 | sandbox | `piaskownica` (piaskownicy) | sandbox, izolatka | `FAQ.md:145`, `TROUBLESHOOTING.md:419` |
| R-72 | theme (CSS) | `motyw` (motywu, motywy) | temat, skórka | `appearance/custom-css-themes.md:31` |
| R-73 | sticker | `naklejka` (naklejki) | stiker, nalepka | `characters/galleries.md:43` |
| R-74 | badge | `plakietka` (plakietkę) ×25 | odznaka (**reserved**: the collectible achievement badge, `home/achievements.md:7`), znaczek | `agents/custom-agents.md:40`, `lorebooks/overview.md:35` |
| R-75 | tooltip | `podpowiedź` ("jej podpowiedź brzmi **Edit theme CSS**") | dymek (**reserved**: the chat message bubble / `.mari-message-bubble`, `appearance/card-css-theming.md:83`), tooltip, chmurka | `appearance/custom-css-themes.md:31` |
| R-76 | toggle / switch | `przełącznik` | suwak (reserved: R-77), włącznik | `CONFIGURATION.md:31` |
| R-77 | slider | `suwak` | pasek przewijania | `appearance/appearance-settings.md:90` |
| R-78 | dropdown | `lista rozwijana` | rozwijane menu, dropdown | `UPGRADING.md:128` |
| R-79 | checkbox | `pole wyboru` | checkbox, kratka | `characters/bot-browser.md:77` |
| R-80 | placeholder text | `tekst zastępczy` | placeholder (**reserved**: the byte-exact English label **Upload a 1x1 placeholder…**, `media/comfyui.md:141`), tekst podpowiedzi | `REMOTE_ACCESS.md:190`, `lorebooks/overview.md:33` |
| R-81 | tab | `zakładka` (zakładce, zakładki) | karta (reserved: character card / browser tab — "w osobnej karcie", `agents/built-in-agents.md:186`) | `FAQ.md:51` |
| R-82 | panel | `panel` (panelu, panele) | okienko (**reserved**: a small floating/minimized window, `conversation/calls.md:159`) | `lorebooks/overview.md:25` |
| R-83 | modal / dialog | `okno` (okno **Create Lorebook**, w oknie) | modal, dialog, okienko dialogowe | `lorebooks/overview.md:29`, `CONFIGURATION.md:124` |
| R-84 | folder (on disk / in library) | `folder` (folderu, foldery, folderach) | katalog (reserved: R-85), teczka | `CONFIGURATION.md:26`, `lorebooks/overview.md:37` |
| R-85 | catalog (of agent packages) | `katalog` | sklep, repozytorium (reserved: Git repo) | `CONFIGURATION.md:20` |
| R-86 | storage (as a subsystem) | `przechowywanie`; the on-disk area = the frozen path `storage` | składowanie, magazynowanie | `CONFIGURATION.md:22`, `data/where-data-is-stored.md:21` |
| R-87 | restart | `restart` / `uruchomić ponownie` (uruchom ponownie) | reset (reserved: **Reset** control), przeładowanie | `CONFIGURATION.md:92`, `TROUBLESHOOTING.md:23` |
| R-88 | game master (GM) | `mistrz gry`; the character name **GM** stays English | narrator (reserved: Narrative Director) | `FAQ.md:55` |
| R-89 | party | `drużyna` (drużyny) | grupa, ekipa | `game/party-and-npcs.md:19` |
| R-90 | dice / dice roll | `kość`, `rzut kością` (kostka for the die object) | kostki do gry, dice | `agents/built-in-agents.md:226` |
| R-91 | env default: empty | `pusta` (feminine, agreeing with the implied `wartość`) | puste, brak | `CONFIGURATION.md:154` |
| R-92 | env default: unset | `nieustawiona` in the Defaults column — the pack's **only** occurrence, so treat it as the form to reuse rather than as an attested paradigm; there is no established prose form (`brak ustawienia` and `nieustawione` have 0 hits) | niezdefiniowana, pusta (reserved: R-91) | `CONFIGURATION.md:238` |
| R-93 | env default: off | `wyłączone` | off, nieaktywne | `CONFIGURATION.md:156` |
| R-94 | `0` (unlimited) | `` `0` (bez limitu) `` | nieograniczone, bez ograniczeń | `CONFIGURATION.md:155` |

---

## 4. Typography & punctuation

**R-95 — Straight ASCII double quotes only.** Polish typographic quotes `„…"` are
banned outright, as are curly `""`. *Evidence:* 0 hits pack-wide for U+201E,
U+201C, U+201D; 1500 ASCII `"` across 99 files. `TROUBLESHOOTING.md:330` —
`komunikacie "Opening chat..."`; `UPGRADING.md:133` — `wyświetla ostrzeżenie:
"Staging builds are pre-release tester builds. …"`.

**R-96 — No curly apostrophe.** *Evidence:* 0 hits pack-wide for U+2019, including
inside declined loanwords. (Note this diverges from the app's own `pl.json`, which
writes `sprite’ów` — see §7 residual 10.)

**R-97 — ASCII apostrophe `'` carries Polish endings on Latin-final loanwords.**
*Evidence:* `sprite'y`, `sprite'ów`, `sprite'ami` (`CONFIGURATION.md:104`,
`characters/sprites.md:12`); `swipe'em` (`agents/hierarchical-maps.md:379`);
`cache'u` (`development/frontend.md:215`, `:559`).

**R-98 — No non-breaking spaces, anywhere.** *Evidence:* 0 hits pack-wide for
U+00A0. Polish orthography tolerates NBSP after one-letter prepositions; the pack
does not use it, because it is not a plain ASCII space for search and copy-paste
purposes.

**R-99 — The en dash `–`, spaced, is the default parenthetical/interruption
dash.** *Evidence:* 279 occurrences across 74 files. `CONFIGURATION.md:18` —
"Prawie całą resztę – klucze API dostawców AI, postacie i opcje czatu – ustawia
się w aplikacji"; `lorebooks/overview.md:17` — "każda wzmianka o mieście Eldoria –
twoja albo postaci – sprawia".

**R-100 — Em dash `—` is a minority form confined to a handful of files; do not
introduce new ones.** *Evidence:* 14 occurrences in 7 files, against 279 en
dashes. Within `TROUBLESHOOTING.md` the em dash is the local precedent (lines 49,
260, 326, 330) and the 2026-09-01 delta deliberately followed it; outside that
file, use the en dash. See §7 residual 5.

**R-101 — U+2026 `…` never appears in freeform Polish prose.** Of the 15
occurrences, 12 are byte-exact English UI labels and 3 are elisions carried over
unchanged from the English source inside code spans or code blocks.
*Evidence, labels:* `UPGRADING.md:139` **Checking…**, `data/backup-and-restore.md:30`
**Creating backup…**, `lorebooks/entries.md:31` **Autosaving…** / **Saving…**,
`UPGRADING.md:27` **Creating backup…**, `:135` **Switching…**, `:182`
**Refreshing…**, `characters/creating-and-editing-characters.md:29` **Uploading…**
/ **Embedding…** / **Saving…**, `connections/connecting-to-a-provider.md:34`
**Search models…**, `lorebooks/entries.md:13` **Search entries…**. Each matches
`en.json` exactly (`settings.notifications.customSound.status.loading` =
`"Checking…"`, `ui.panels.advancedsettings.creatingBackup` = `"Creating
backup…"`, `editor.save.uploading` = `"Uploading…"`).
*The 3 non-label uses,* each identical to the English source line:
`TROUBLESHOOTING.md:275` `` `messages.post-unshard-…` `` (elided path),
`agents/built-in-agents.md:160` `` `<context><memory_nags>…</memory_nags></context>` ``
(elided XML body), `development/localization.md:53` `"chat.input.placeholder":
"Napisz odpowiedź…"` (a locale-file example that is Polish in `docs/` too).
Do not add a fourth: outside a quoted label or a mirrored code fence, write out the
sentence. Where the app itself writes three ASCII dots, the pack does too:
`TROUBLESHOOTING.md:330` `"Opening chat..."` = `ui.chat.chatarea.openingChat`.

**R-102 — Decimal separator is a comma.** *Evidence:*
`connections/local-model.md:73` "około 3,2 GB"; `:77` "około 5,9 GB pobierania i
około 7,5 GB RAM".

**R-103 — Thousands separator is a plain space, never a comma.** *Evidence:* 13
space-grouped figures — `conversation/table-games.md:109` "od 100 do 1 000 000";
`development/code-cleanup-audit.md:46` "478 000 linii";
`development/hierarchical-locations-prd-v3.md:356` "2 048 tokenów", `:289` "4 000
znaków"; `extending/writing-personal-extensions.md:225` "1 000 000 bajtów".
(One residual comma-grouped English figure survives — see §7 residual 4.)

**R-104 — Headings never end with a period.** *Evidence:* 0 of 1861 headings.
Question headings keep `?` (24 of them, e.g. `FAQ.md` "## Czym jest karta
postaci?"; `CONFIGURATION.md:5` "## Kiedy warto zmieniać konfigurację?").

**R-105 — No space before `:` `;` `!` `?`.** Polish is not French. *Evidence:* all
13 pack-wide hits for `" [;:!?]"` are inside fenced code blocks (CSS `!important`,
JS `?.`, `!==`); prose has zero.

**R-106 — Bullets that are full sentences end with a period; a fragment series may
be chained with semicolons.** *Evidence:* 2343 of 3184 bullets end with `.`;
`development/personal-extensions.md:93-95` shows the semicolon-chained fragment
style.

**R-107 — Ranges use a plain ASCII hyphen.** *Evidence:*
`agents/built-in-agents.md:200` "(1-100)", "(1-20)"; `chats/slash-commands.md:50`
"`/hide 2-5,9,12`".

**R-108 — `→` is the target UI-path separator, but the pack has not settled.**
*Evidence:* 80 U+2192 across 21 files, of which ~74 are UI paths —
`CONFIGURATION.md:20` "**Agents → Download Agents**"; `CONFIGURATION.md:31`
"**Settings → Advanced → Danger Zone**". The remaining ~6 arrows are not paths:
in-world location chains (`agents/hierarchical-maps.md:366` `Tower → Floor 7 →
Alchemy Lab`, `:490`), sort-option labels (`lorebooks/entries.md:14` **Name A→Z**)
and a logical "leads to" (`:377`). Two rival separators are nearly as common — `>`
(74 UI-path occurrences) and the prose connector `, dalej` (28) — so this is a
forward rule, not a description of a consistent pack. See §7 residual 6.

**R-109 — Files are NFC-normalized, LF-terminated, BOM-free, with no trailing
whitespace, and exactly one `# ` H1.** *Evidence:* verified across all 125 files;
0 combining marks pack-wide.

**RR-3 — Why straight quotes.** PR #4235 records two reasons: the app's own Quote
style default is Straight, and mixing quote forms splits search hits. The outcome
is verified (R-95); the app-behavior reasoning is not observable in the pack.

---

## 5. UI labels & glosses

**R-110 — English UI labels are reproduced byte-exactly, in bold.** Casing,
punctuation, ellipsis character and spelling all follow the app string, not
Polish orthography. *Evidence:* `UPGRADING.md:139` **Check for Updates**,
**Checking…**; `characters/creating-and-editing-characters.md:29` **Uploading…**,
**Embedding…**, **Saving…**; each matches `packages/client/src/localization/locales/en.json`
verbatim.

**R-111 — The gloss pattern is: bold English label, one space, Polish gloss in
parentheses.** *Evidence:* 962 instances of `**Label** (gloss)` pack-wide.
`chats/chat-settings.md:28` — "Sekcja **Connection** (połączenie)";
`UPGRADING.md:128` — "**Release Channel** (kanał wydań)";
`agents/custom-agents.md:40` — "przycisk **Save** (zapis)".

**R-112 — The gloss is lowercase descriptive Polish, usually a verbal noun.**
*Evidence:* `CONFIGURATION.md:20` "(agenci, pobieranie agentów)";
`characters/personas.md` "(powiązane postacie)"; `data/backup-and-restore.md`
"(pobranie kopii zapasowej)". Of 962 glosses, 836 begin lowercase, 116 begin
uppercase and 10 begin with something else (a digit, a backtick or a quote). (The
116 capitalized ones are a residual — §7 residual 3.)

**R-113 — Gloss once per document, on first use; later mentions are the bare bold
label.** *Evidence:* `lorebooks/overview.md:3` glosses "**Lorebooks**
(Lorebooki)"; `:25`, `:29`, `:30` then use **Lorebooks**, **New**, **Import**
with icon-shape glosses only.

**R-114 — Icon-only controls get a shape-describing gloss.** *Evidence:*
`lorebooks/overview.md:29` "Przycisk **New** (nowy, znak plus)"; `:30`
"**Import** (import, strzałka w dół)"; `:31` "**Select** (wybór, znak
zaznaczenia)"; `characters/galleries.md:48` "przycisk oznaczania z podpowiedzią
**Tag as emoji or sticker**".

**R-115 — A quoted runtime string (not a control label) is set in straight ASCII
double quotes and needs no gloss.** *Evidence:* `UPGRADING.md:133`; `TROUBLESHOOTING.md:129`
"This parameter is sent to the model"; `integrations/haptic-feedback.md:38`
"Allow this agent to send touch cues during the chat."

**R-116 — A label with no natural Polish gloss stays bare English behind a carrier
noun.** *Evidence:* `TROUBLESHOOTING.md:330` — "kopia z sekcji Support
Diagnostics" (no parenthetical); `agents/approvals-and-agent-suite.md:91` —
"## Panel Cached prompt injections".

**R-117 — A bold label that *does* carry a gloss keeps it even when the label is
long.** *Evidence:* `TROUBLESHOOTING.md:330` — "**Unreachable (request timed
out)** (nieosiągalny, przekroczono limit czasu żądania)"; "**Server unreachable**
(serwer nieosiągalny)".

**R-118 — UI path arrows are glossed as a Polish chain in one parenthesis.**
*Evidence:* `CONFIGURATION.md:20` "**Agents → Download Agents** (agenci,
pobieranie agentów)"; `CONFIGURATION.md:31` "**Settings → Advanced → Danger Zone**
(ustawienia, zaawansowane, strefa zagrożenia)".

**R-119 — The pack does not import the app's shipped Polish UI strings as
glosses.** The `pl.json` locale covers only 592 of `en.json`'s 9121 translatable
keys (6.5%; flattened leaf keys, `_meta` excluded), so
almost every label a Polish reader sees is still English — which is why the
English-label-plus-gloss convention holds throughout. Where `pl.json` *does*
translate a label, the pack still uses its own gloss: `pl.json`
`navigation.topbar.lorebooks` = "Księgi wiedzy", while the pack writes "**Lorebooks**
(Lorebooki)" (`lorebooks/overview.md:3`). *Evidence:* both files as cited.

**RR-4 — Forward rule for gloss capitalization.** Write glosses lowercase (R-112).
Capitalize a gloss only when it is verbatim the app's shipped Polish string from
`pl.json` (e.g. "Ustawienia" = `navigation.topbar.settings`). The pack mostly
already behaves this way: **Settings** is glossed `(Ustawienia)` 49 times against
`(ustawienia)` 6, and `Ustawienia` *is* the shipped string. What is genuinely
unresolved is the 116 uppercase glosses overall (R-112) and the 58 labels carrying
more than one gloss (§7 residual 3). This is a cycle ruling because the criterion —
"is this string in `pl.json`?" — was chosen here, not inherited from the pack.

Note for anyone re-deriving this: a pack-wide count of `(Ustawieni*` vs
`(ustawieni*` gives 51 vs 59 and looks like an even split. It is an artifact — the
lowercase bucket is dominated by `(ustawienia czatu)` ×44 glossing **Chat
Settings**, a different label. Always count per label.

---

## 6. Language-specific mechanics

**R-120 — Assimilated loanwords take full Polish inflection.** prompt →
promptu / prompcie / prompty / promptów; token → tokeny / tokenów; czat → czatu /
czacie / czatów; preset → presetu / presety / presetów; lorebook → lorebooka /
lorebooki / lorebooków; agent → agenta / agenci / agentów; tracker → trackery /
trackerów; embedding → embeddingów; widget → widgety / widgetach. *Evidence:*
`lorebooks/overview.md:31` "kilka lorebooków"; `CONFIGURATION.md:15`
"embeddingów"; `chats/slash-commands.md:17` "zużywać tokeny".

**R-121 — Genitive plural of these borrowings is `-ów`.** *Evidence:* lorebooków,
presetów, tokenów, agentów, widgetów, trackerów, promptów — all attested above.

**R-122 — The apostrophe is used only where the Latin stem ends in a silent or
foreign-sounding letter.** `sprite'y` / `swipe'em` / `cache'u` take it (stem-final
silent `e`); `prompty`, `tokeny`, `presety`, `czaty`, `widgety` do not. *Evidence:*
the two groups as cited in R-97 and R-120; no `prompt'y`-style forms occur.

**R-123 — Frozen acronyms take a carrier noun instead of an inflected ending.**
`postać NPC` / `postaci NPC` rather than `NPC-a`; `pasek HUD` rather than `HUD-u`.
*Evidence:* `game/party-and-npcs.md:79` "co każda postać NPC do Ciebie czuje";
`roleplay/hud-and-trackers.md:3` "czym jest pasek HUD w trybie Roleplay". 0 hits
for hyphen-inflected `NPC-` or `HUD-` forms.

**R-124 — First-use glossing of a frozen acronym goes in parentheses after the
carrier phrase.** *Evidence:* `game/dice-and-skill-checks.md:68` — "przekonanie
postaci NPC (postaci niezależnej)".

**R-125 — Impersonal `-się` is the default voice for capability and behavior
statements; the imperative is the default for steps.** *Evidence:*
`CONFIGURATION.md:9` "Konfigurację zmienia się zwykle po to, żeby";
`CONFIGURATION.md:18` "ustawia się w aplikacji, a nie tutaj"; against
`lorebooks/overview.md:25` "Otwórz go z paska bocznego aplikacji."

**R-126 — Possibility is expressed with `da się` / `można` / `warto` / `trzeba`,
never with a gendered past modal.** *Evidence:* `lorebooks/overview.md:31` "da się
naraz wyeksportować"; `UPGRADING.md:19` "Warto ją zrobić"; `FAQ.md:136` "można też
włączyć". 0 hits pack-wide for the conditional forms `-łbyś` / `-łabyś`.

**R-127 — Verbal nouns (`pobranie`, `wgrywanie`, `import`, `zapis`) carry
action-label glosses, keeping them gender-free.** *Evidence:*
`CONFIGURATION.md:221` "kopie zapasowe, czyszczenie danych, wgrywanie
aktualizacji"; `agents/custom-agents.md:40` "**Save** (zapis)".

**R-128 — Polish diacritics are mandatory and complete.** No ASCII-stripped forms
(`pamieci`, `wlacz`, `czesc`) appear in the pack; all 125 files are NFC.
*Evidence:* R-109 plus every quoted line above. Note that intermediate cycle notes
may be written ASCII-stripped for tooling reasons — the pack never is.

**R-129 — Link text is the target file's H1, or a clean prefix of it.**
*Evidence:* the pack has 910 intra-pack `.md` links. 128 of them (in 37 files) use
text that is not literally the target's H1, but 109 of those are clean prefixes —
`FAQ.md` "[Dostęp zdalny]" → H1 "Dostęp zdalny: Basic Auth i lista dozwolonych
adresów IP". Only 19 links (in 10 files) are neither the H1 nor a prefix of it;
they are listed in §7 residual 7. The English source, measured the same way, has
208 non-literal link texts of 912 and 102 non-prefix ones, so the pack really did
normalize link text toward the translated H1 — by roughly 5× on the
non-prefix count.

**R-130 — Code, paths, URLs and link targets are byte-identical to English.**
*Evidence:* comparing all 125 pl files with `docs/`: 0 fence-sequence differences;
link-target lists match on 120 of 125 files, with the 5 differences all being
links present only in the newer English source (upstream drift, §7 residual 9).

---

## 7. QA checks & known traps

### Mechanical checks (run these on any pl pack edit)

Each check is written so that **a non-empty result is a defect**.

**Run every one of these in Python, not `grep`.** Checks 1–3 and 15 all hinge on
`\w` or `\b` next to a Polish diacritic, and command-line `grep` gets that wrong —
see T-5 below, which is the single most dangerous trap on this list. The patterns
are written in Python `re` syntax against `str` (not `bytes`), which is
Unicode-aware by default:

```python
import re, pathlib
files = {p: p.read_text(encoding="utf-8") for p in pathlib.Path("pl").rglob("*.md")}
def check(pattern):
    rx = re.compile(pattern)
    return [(p, i, ln) for p, t in files.items()
            for i, ln in enumerate(t.split("\n"), 1) if rx.search(ln)]
```

1. **Declined product name** — `check(r'Marinar(ze|y|ą|ę|om|ami|ach)\b')`.
   Must be empty (R-8). Also `check(r'\b(w|we|do|z|od|dla|na|przez|pod|przy) Marinar')`
   for missing carrier nouns (R-10) — this one currently returns the 6 known
   residuals in §7 residual 11, so diff against that list rather than expecting
   zero.
2. **Reader gendering** — `check(r'\w+ł[ae]ś\b')`. Must be empty (R-3).
   Extend with `\w+ł[ab]yś\b` for conditionals (also currently 0).
3. **Formal register leak** — `check(r'\bPan(i|u|a|ie)?\b|proszę \w+ć|\bPaństw\w*')`.
   Must be empty (R-2).
4. **Typographic quotes** — grep for U+201E, U+201C, U+201D, U+2019, U+00AB,
   U+00BB. Must be empty (R-95, R-96).
5. **Non-breaking space** — grep for U+00A0. Must be empty (R-98).
6. **Curly apostrophe in declension** — grep for `’`. Must be empty; the correct
   form is `sprite'y` with ASCII `'` (R-97).
7. **New em dashes** — grep for U+2014 outside `TROUBLESHOOTING.md`. Any hit in a
   file that had none is a regression toward the wrong dash (R-99, R-100). Baseline
   is 14 occurrences in 7 files (§7 residual 5).
8. **Ellipsis in prose** — grep for U+2026 and confirm every hit sits inside a
   bold English label, a quoted app string, or one of the 3 code-span/code-block
   elisions mirrored from English (R-101). Baseline is 15.
9. **English thousands separator** — `check(r'[0-9],[0-9]{3}')` and check each hit
   is a real decimal comma and not a copied English figure (R-103). Two hits are
   expected: `agents/built-in-agents.md:200` (the known residual 4) and
   `REMOTE_ACCESS.md:90` `IP_ALLOWLIST=192.168.1.0/24,203.0.113.42`, which is a
   comma-separated CIDR list, not a number.
10. **Space before punctuation** — `check(r' [;:!?]')` and confirm every hit is
    inside a fenced code block (R-105). Baseline is 13, all fenced.
11. **Heading terminators** — no heading may end in `.` (R-104); every file has
    exactly one `# ` H1 (R-109).
12. **Normalization** — assert `NFC(text) == text` for every file, no BOM, LF
    endings, no trailing whitespace (R-109).
13. **Structural parity vs English** — same file set as `docs/`; identical fenced
    code-block sequence; identical link-target list. The link-target check is what
    catches a translated `#fragment` or a rewritten relative path (R-130).
14. **Link text ↔ H1** — for every intra-pack `.md` link, the link text must equal
    the target's H1 or be a prefix of it (R-129).
15. **Terminology split** — check each banned alternate in §3. The ones that
    currently return **zero** and must stay at zero: `księg\w* wiedzy`, `widżet`,
    `uaktualnieni`, `polecen\w* slash`, `ukośnikow`, `sprajt`, `duszek`,
    `usługodawc`, `skórk`, `stiker`, `nalepk`, `teczk`, `checkbox`, `dropdown`,
    `włącznik`, `makropolecen`, `izolatk`, `kanał\w* wersji`, `wypożyczeni`.
    The ones that return hits **in a reserved sense only** — read the §3 row before
    calling any of them a defect: `podpowied` (tooltip, R-75), `żeton` (poker
    chips, R-23), `szablon`/`profil` (template / settings profile, R-25),
    `komunikat` (system message, R-33), `klucz` (API key, R-29), `kopi\w* robocz`
    (editor draft, R-41), `dymek` (message bubble, R-75), `odznak` (achievement
    badge, R-74), `dodatk` (**Addons**, R-56), `checkpoint` (ComfyUI model file,
    R-55), `okienk` (small floating window, R-82).
16. **Gloss shape** — every new `**English Label**` on first use in a file should
    carry `(gloss)` or sit behind a carrier noun (R-111, R-116); the gloss should
    start lowercase unless it is a verbatim `pl.json` string (RR-4). Count per
    label, never pack-wide — see the note under RR-4.
17. **Manifest** — after any content edit run
    `node scripts/docs-i18n/build-manifest.mjs <pack>/pl --source-commit <sha>`
    then `node scripts/docs-i18n/validate-pack.mjs <pack>/pl` from an Engine
    checkout, and commit content plus manifest together (RR-5). `--source-commit`
    is optional in the script and no shipped pack currently carries a
    `sourceCommit` key — `pl/manifest.json` has only `language` and `files` (125
    entries, matching the 125 `.md` files), as do all nine sibling packs. Passing
    it is still the README's instruction; just do not read its absence in the
    current manifest as a pl-specific defect.

### Tooling traps

**T-1 — ASCII-stripped intermediate notes.** Working notes for this language are
sometimes produced without diacritics (`pamieci`, `wylacz`) because of Windows
console encoding. Never paste from such a note into the pack; re-type with full
diacritics (R-128). When scripting greps on Windows, set `PYTHONIOENCODING=utf-8`
and read/write with `encoding='utf-8'` — the default `cp1252` codec throws on
`ś`, `ż`, `ł` and will silently truncate a scan.

**T-2 — Git Bash `$'\uXXXX'` does not expand.** The `\uXXXX` escape is
not supported in this shell's `$'...'` quoting, so the pattern reaches `grep` as
the six literal characters `\u2014` and matches nothing — another false clean:

```
$ printf '%s' $'\u2014' | xxd | head -1
00000000: 5c75 3230 3134                           \u2014
$ grep -rl $'\u2014' pl/ | wc -l
0                                    # <- wrong, reads as a clean pack
$ grep -rl '—' pl/ | wc -l
7                                    # correct: 7 files carry an em dash
```

Pasting the literal character works, but then you cannot tell by reading the
command whether you pasted an em dash or an en dash — and that is exactly the
distinction R-99/R-100 turn on. Use a Python scan with an explicit `chr(0x2014)`
for every codepoint-level check above.

**T-3 — Cross-file `#fragment` links point at English anchors.** Because link
targets stay byte-identical to English (R-130) while headings are translated, 8 of
the pack's cross-file fragment links have no matching Polish heading slug (e.g.
`lorebooks/overview.md` → `entries.md#authoring-strategy-choosing-the-right-entry`,
`UPGRADING.md` → `TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version`).
This is the intended trade-off, not a bug to "fix" by translating the fragment —
translating it would break the link for every reader whose pack falls back to
English. Do not add same-file fragment links: the pack currently has 0.

**T-4 — Declension is not the only search hazard.** A gloss written two ways
(`(Ustawienia)` vs `(ustawienia)`) splits a reader's literal search just as a
declined name would. Prefer the §3 form over a synonym even when the synonym reads
better.

**T-5 — `\w` and `\b` do not see Polish letters. This is the worst trap here.**
Polish `ą ć ę ł ń ó ś ż ź` are outside ASCII, and a regex engine in byte or
ASCII mode treats them as *non-word* characters. `\w+` then refuses to cross them
and `\b` fires in the wrong places, so a pattern built around a Polish stem
matches **nothing** — and a check whose contract is "empty output means clean"
reports a clean pack that was never scanned. Reproduction, on a line that plainly
contains three banned forms:

```
$ printf 'Jeśli wpisałeś tekst, to zrobiłaś to dobrze. Wybrałeś?\n' > t.txt
$ grep -cE '\w+ł[ae]ś\b' t.txt      # the check as it is tempting to write
0                                    # <- silently, catastrophically wrong
$ grep -cE '[[:alpha:]]+ł[ae]ś' t.txt
1                                    # correct
```

Python's `re` on `str` is Unicode-aware and gets it right
(`re.findall(r'\w+ł[ae]ś\b', t)` → `['wpisałeś', 'zrobiłaś', 'Wybrałeś']`), but
the same pattern on `bytes`, or with `re.ASCII`, returns `[]`. So: decode to
`str`, never pass `re.ASCII`, never scan `bytes`. If a shell grep is unavoidable,
use POSIX classes (`[[:alpha:]]`) and drop `\b` entirely rather than trusting it
next to a diacritic. Note this cuts both ways for verification too — a "0 hits"
result is only evidence of a prohibition (per the header) if the tool that
produced it can see Polish letters at all.

### Known pack residuals (documented, not silently fixed)

1. **Three words for "launcher".** The dominant form is `program uruchamiający`,
   46 occurrences across 6 files (`TROUBLESHOOTING.md` ×16, `CONFIGURATION.md` ×14,
   `installation/windows.md` ×12, `home/professor-mari.md` ×2, `FAQ.md` ×1,
   `UPGRADING.md` ×1). Against it:
   - the bare loanword `launcher`, 12 times in prose — `UPGRADING.md:37`, `:46`,
     `:48`, `:52`, `:62`, `:66`, `:82`, `:85`, `:101`, `:194`, plus `FAQ.md:167`
     and `development/file-storage.md:31`. (`TROUBLESHOOTING.md:270` and `:277`
     also contain the string, but only inside the script path
     `scripts/protect-launcher-data.mjs`, which is code and correctly frozen.)
   - `skrypt startowy`, 11 times, **all** in `installation/macos-linux.md`
     (`:3`, `:70`, `:86`, `:102`, `:104`, `:115`, `:128`, `:132`, `:181`, `:217`,
     `:225`).
     English calls it "the launcher" throughout that file, so this is a whole-file
     divergence, not a slip — and it is the alternate R-37 previously listed as
     banned with 0 hits, which was wrong.

   New text should use `program uruchamiający` (R-37). Do not mass-rewrite
   `installation/macos-linux.md` as a side effect of an unrelated edit; that file
   is internally consistent and deserves its own change.
2. **Capitalized reader pronouns.** 7 mid-sentence `Ciebie` / `Tobie` against 51
   lowercase `ciebie`: `conversation/profiles.md:5` (×2), `:78`,
   `game/party-and-npcs.md:19`, `:79`, `:90`, `:105`. Lowercase is the rule (R-5).
3. **Gloss capitalization split.** 116 of 962 glosses start uppercase (836 start
   lowercase, 10 start with a digit/backtick/quote). Per label the picture is much
   less even than a naive pack-wide count suggests: `**Settings**` is glossed
   `(Ustawienia)` 49 times against `(ustawienia)` 6 — see the note under RR-4.
   Separately, 58 of 609 distinct labels carry more than one gloss — some
   legitimately (icon shape vs meaning, e.g. **Chat Settings** → "ikona koła
   zębatego" / "ustawienia czatu", and it also has "ikona zębatki" and the combined
   "ustawienia czatu, ikona koła zębatego"), some not (**Admin Access** → "dostęp
   administracyjny" / "dostęp administratora"; **Review Agent Outputs** →
   "przeglądanie wyników agentów" / "sprawdzanie wyników agentów").
4. **English thousands separator survives once.** `agents/built-in-agents.md:200`
   — "limit tokenów przywołania (128-16,384)". Polish wants `16 384` (R-103).
5. **Em dashes in 7 files.** 14 U+2014 against 279 U+2013 (R-100):
   `TROUBLESHOOTING.md:49`, `:260`, `:326`, `:330`;
   `agents/custom-agents.md:113`, `:114`; `data/where-data-is-stored.md:21`;
   `development/file-storage.md:35`; `extending/personal-extensions.md:67`;
   `lorebooks/entries.md:189`; `noodle/settings.md:84`.
6. **UI-path separator split — much closer to even than it looks.** `→` ×80 in 21
   files (≈74 of them actual UI paths) against `>` ×74 in 14 files, plus the prose
   connector `, dalej` ×28 in 15 files. The `>` total is 43 occurrences between two
   bold spans (`TROUBLESHOOTING.md:425` "**Settings** > **Advanced** > **Message
   Tools**") and 31 inside a single bold span (`FAQ.md:175` "**Agents > Download
   Agents**"); `, dalej` is at e.g. `agents/agents-overview.md:76`. The split runs
   by file, not by sentence, which is what makes it fixable: `game/storyboard.md`
   (`>` ×14, arrows 0), `settings/settings-overview.md` (8, 0) and
   `extending/writing-personal-extensions.md` (7, 0) never use the arrow at all,
   while `conversation/calls.md` leans on `, dalej` (×11) and
   `agents/hierarchical-maps.md` (arrows ×17, `>` 0) and `CONFIGURATION.md`
   (12, 0) are already clean. Only `TROUBLESHOOTING.md` (arrows ×6, `>` ×15) and
   `FAQ.md` (2, 3) mix the two inside one file. `→` is the target form (R-108) but
   this is a live inconsistency, not a stray residual: converging it is a
   deliberate per-file sweep, not a drive-by fix.
7. **Nineteen link texts that are neither the H1 nor a prefix of it** (R-129),
   in 10 files. The clearest violations, where a title was paraphrased:
   `extending/personal-extensions.md` links to `writing-personal-extensions.md` as
   "Tworzenie rozszerzeń osobistych" (×1) and "przewodnika tworzenia rozszerzeń
   osobistych" (×1) while that file's H1 is "Pisanie własnych rozszerzeń";
   `extending/writing-personal-extensions.md` links back with untranslated text
   "Personal Extensions" (×2) and "Architektura Personal Extension" against the
   Polish H1s "Rozszerzenia osobiste" / "Architektura rozszerzeń osobistych";
   `agents/built-in-agents.md` → `noodle/overview.md` as "Noodle: oś czasu
   społeczności w aplikacji" against H1 "Noodle: wbudowana oś czasu
   społecznościowa"; `characters/colors-and-stats.md` and
   `roleplay/getting-started.md` (×2) → "HUD i trackery" / "HUD i trackery w trybie
   Roleplay" against H1 "Pasek HUD i trackery w trybie Roleplay";
   `FAQ.md` → "PWA na iOS" against H1 "Przewodnik po PWA na iOS / iPadOS";
   `settings/settings-overview.md` → "Muzyka" against H1 "Music DJ: Spotify,
   YouTube i muzyka lokalna". The rest are mid-sentence descriptive links where the
   text is a noun phrase rather than a title (`extending/writing-personal-extensions.md`
   "tabelę platform", "kontekstu aktywnego czatu", "paneli renderowanych przez
   aplikację Marinara"; `roleplay/getting-started.md` "tryb Conversation";
   `lorebooks/overview.md` "Strategia pisania", "Przykład w praktyce";
   `UPGRADING.md` "Po przejściu na starszą wersję czaty nie pokazują wiadomości",
   which is a section title used as whole-file link text;
   `chats/sending-and-streaming.md` "Galerie postaci → Ponowne używanie obrazu z
   galerii w wiadomościach i powitaniach"). Those read fine and are only
   technically R-129 violations; fix the paraphrased titles first.
8. **Third-party name declined 3 times.** `Dockera` / `w Dockerze` at
   `TROUBLESHOOTING.md:245`, `:404`, `:417`, against 22 carrier-noun uses
   (`kontener Docker` ×20, `obraz Docker` ×2). Docker is the only third-party name
   the pack ever declines — `Termux`, `GitHub` and `Windows` are clean. Prefer the
   carrier (R-13).
9. **Upstream drift: 5 English links not yet mirrored.** English `docs/` has since
   gained links absent from the pack — `CONFIGURATION.md#restart-or-hot-reload`;
   `agents/built-in-agents.md` → huggingface.co/GetBeholder/Beholder-GGUF;
   `characters/creating-and-editing-characters.md` →
   `galleries.md#reuse-a-gallery-image-in-messages-and-greetings`;
   `extending/personal-extensions.md` →
   `../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available`;
   `media/tts-setup.md` → github.com/kyutai-labs/pocket-tts. These are English-side
   additions, not dropped Polish links.
10. **Pack/app vocabulary divergence.** The pack says `lorebook` (R-26) and
    `widget` (R-64) where the shipped `pl.json` says "Księgi wiedzy" and "Widżety
    gry"; the pack says `prompt` (R-21) where `pl.json` says "polecenie"
    (`onboarding.presets.body`). The pack's forms are the standing convention —
    the locale covers only 6.5% of keys, so the docs' readers overwhelmingly see
    English labels, and switching the docs to the sparse UI vocabulary would split
    every prompt/lorebook search (R-119). Flag it if the locale coverage ever
    grows substantially. (The apostrophe diverges too: `pl.json` writes `sprite’ów`
    with U+2019 in 10 strings, the pack writes `sprite'ów` with ASCII — R-96.)
11. **Bare preposition plus the frozen name, 6 times.** R-10 holds for `w`, `we`,
    `do` and `z` (0 hits each), but not for `przez` and `pod`:
    `extending/personal-extensions.md:27` "panelu rysowanego przez Marinara
    Engine", `:67`, `:140`, `:155`; `characters/import-export.md:3` "typy plików
    obsługiwane przez Marinara"; `FAQ.md:37` "nie mogła podszyć się pod Marinara
    Engine". All six read as the frozen name standing in for an accusative, which
    is exactly what the carrier noun exists to avoid. Prefer "przez aplikację
    Marinara Engine" in new text.
12. **`buforowanie` for caching, twice.** `connections/providers-reference.md:30`
    "Obsługuje buforowanie promptu" and `:76` "wysyła wskazówki o buforowaniu"
    translate *prompt caching* with the alternate R-52 bans. The prose form is
    `pamięć podręczna` (24 occurrences); `buforowanie` should become
    `zapisywanie promptu w pamięci podręcznej` or similar. Unrelated `bufor` hits
    at `development/code-cleanup-audit.md:16` and `development/file-storage.md:33`
    are genuine buffers and are fine.

### Recorded rulings without in-pack evidence

- **RR-1** — informal `ty` chosen for cross-pack register consistency (§1).
- **RR-2** — the frozen-name rule exists because declension breaks the viewer's
  literal substring search (§2).
- **RR-3** — straight quotes chosen because the app's Quote style default is
  Straight and mixed quote forms split search hits (§4).
- **RR-4** — forward rule for gloss capitalization: lowercase unless the gloss is
  verbatim a shipped `pl.json` string (§5). The criterion is the ruling; the pack
  largely already complies for **Settings** (49 `(Ustawienia)` vs 6
  `(ustawienia)`), so what this actually resolves is the wider 116-gloss
  uppercase tail and the 58 multi-gloss labels (§7 residual 3).
- **RR-5** — process: after editing, run `build-manifest.mjs` then
  `validate-pack.mjs` and commit content plus manifest together
  (`docs-i18n/README.md`, `CONTRIBUTING.md:244`).
- **RR-6** — process: renames and deletions under `docs/` MUST be mirrored here,
  or a `[docs-i18n] <affected paths>` follow-up issue opened; a translation left
  at an old path is silently ignored by the app (`CONTRIBUTING.md:231`).
- **RR-7** — process: PR #4235 mandates a mechanical declension/address/typography/
  terminology sweep plus an independent language-QA panel before a pack ships;
  §7's checks are the mechanical half of that sweep.
- **RR-8** — process: PR #4235 records runtime verification against a throwaway
  data dir with a materialized pack (viewer categories, titles, diacritic search,
  Settings coverage counts, switch flows) as part of shipping validation.

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, a native NovelAI character caption is a
**opis postaci**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.
