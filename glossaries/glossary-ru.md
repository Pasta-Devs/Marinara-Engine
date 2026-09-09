# Russian (`ru`) — documentation-pack glossary

## Provenance

This is the **second-generation** `ru` glossary, **re-derived 2026-09-01** after the original
working glossaries were lost to temp-directory cleanup. It was rebuilt from three sources, in
authority order:

1. **The shipped pack** at `docs-i18n:ru/` (125 files) — **ground truth**. Every terminology row
   and prescriptive rule below was re-verified against the pack as shipped, with a cited evidence
   file and line.
2. **The pack's shipping PR decision write-up** — Pasta-Devs/Marinara-Engine **PR #4281**
   ("Russian conventions" section), which is the record of what the original cycle decided and why.
3. **The 2026-09-01 mirror-cycle notes** (`prd-notes-ru.md`) — evidence-backed choices made during
   the same-day delta mirror, each carrying its own in-pack citation.

**How to read the rules.** Every prescriptive statement is either

- **verified** — followed by a `file:line` citation into `ru/`, meaning the pack demonstrably does
  this today; or
- marked **`[recorded ruling]`** — a maintainer or cycle decision that the pack cannot show,
  because it is a process rule, a tooling trap, or a negative finding. These are preserved as
  rulings, not invented.

Where the pack **contradicts** a rule in a small number of places, the rule stands and the
exceptions are logged in §7 *Known pack residuals* — documented, not silently normalized.

Line numbers refer to the pack as shipped in PR #4281. Re-verify after any pack edit.

**Verification pass, 2026-09-01 (same day).** Every row below was re-scanned against the 125 shipped
`ru/*.md` files with a UTF-8 Python scanner (never MSYS `grep` — see §7 trap 2). That pass changed
four things worth flagging up front:

- **Two rulings previously marked unverifiable are in fact attested**, both in the same table row
  `CONFIGURATION.md:155`: the **least-recently-used** rendering and the **noun** `вытеснение`. They
  are now verified rows, not rulings. The earlier "no precedent" finding was a false negative — the
  exact failure mode trap 2 describes.
- **The ellipsis question is settled**, by reading `en.json` rather than the pack. See §4 and
  residual E.
- **Banned alternates needed scoping.** Most "banned" words are live pack vocabulary in a *different*
  sense (`подсказка` = tooltip, `эпизод` = Storyboard episode, `пост` = Noodle post …). A bare grep
  for a banned alternate is therefore not a defect check. §3 now states the sense each ban covers and
  gives the false-positive count.
- **Several evidence citations were off** and have been corrected against the shipped files.

---

## 1. Register & address

| Rule | Detail | Evidence |
|---|---|---|
| Formal **lowercase `вы`** | Russian is the **first formal-address pack** (de/fr/pt-br/pl are informal). `ты` reads noticeably over-familiar in app documentation; mainstream Russian software convention (Yandex, VK, Telegram) is lowercase `вы`. | 419 lowercase `вы` in prose outside code fences; `FAQ.md:37`, `CONFIGURATION.md:3` |
| **Never honorific `Вы`** mid-sentence | Capitalized `Вы` is reserved for sentence-initial position only. A mid-sentence `Вы` is a defect. | **39** capitalized `Вы` outside code fences, **all 39 sentence-initial**; **0** mid-sentence pack-wide. Examples: `conversation/calls.md:17`, `lorebooks/entries.md:303` |
| **Plural imperative** for instructions | `Нажмите`, `Откройте`, `Задайте`, `Выберите`, `Проверьте`, `Введите`, `Смотрите`. Singular imperatives (`Нажми`, `Открой`) are banned. | `Нажмите` ×366, `Откройте` ×293, `Выберите` ×126; singular forms ×0 |
| **Gender neutrality comes free** | The plural agreement `вы` takes (`вы хотите`, `вы увидите`, `вы работаете`) is gender-neutral by construction. No gendered participle or past-tense form ever needs to agree with the reader, so the pack needs **no** `(-а)` bracket forms, no `пользователь/пользовательница` doubling, and no passive-voice contortions. | `CONFIGURATION.md:9` ("Настройки стоит поменять, если **вы хотите**:"), `TROUBLESHOOTING.md:103` ("Если **вы работаете** через публичный домен") |
| Third-party subjects stay neutral | Refer to the reader's counterpart by role (`тот, кто держит сервер`), not by gendered noun. | `CONFIGURATION.md:61` ("разрешение от того, кто держит сервер") |
| `ты` only inside quoted user utterances | The single legitimate `ты` in the pack is an example query the **user speaks to Professor Mari** — informal address to the assistant, not to the reader. Do not generalize it. | `home/professor-mari.md:131` (`"что ты помнишь?"`) |
| **Professor Mari is feminine** | Referred to as `она` / `ее`; the Latin name itself never declines. | `home/professor-mari.md:3` ("где **ее** найти, что **она** умеет") |
| **`Marinara` takes feminine agreement** | When the bare product name is the grammatical subject, verbs agree feminine (`Marinara сама выбирает`, `Marinara хранит`). ~59 such constructions. | `CONFIGURATION.md:20` ("Marinara **сама** выбирает"), `CONFIGURATION.md:158` ("Marinara **хранит** данные") |

---

## 2. Product, feature & mode names

**The frozen-name rule.** Product, mode, agent and feature names **stay in Latin script and never
decline**. A Cyrillicized or declined name breaks the docs viewer's literal-substring search, which
is why this is a hard rule rather than a stylistic preference (PR #4281).

- Verified: **0** Cyrillicized product-name residuals pack-wide (`Маринар*`, `Термукс`, `Андроид`,
  `Ноудл`, `СиллиТаверн` — all zero), and **0** Latin stems carrying a Cyrillic case suffix.

**The carrier-noun rule.** Because the name cannot decline, a **Russian carrier noun takes the
case** and the frozen name sits behind it in the nominative.

| Do | Never |
|---|---|
| `в приложении Marinara Engine` | `в Маринаре` |
| `сервер Marinara` / `установка Marinara` | `Marinar'ы`, `Marinarе` |
| `каталог Pasta-Devs/Marinara-Agents` | any inflected repo name |
| `персонажи NPC` / `персонаж NPC` | `НПС`, `неписи` |
| `в скопированном отчете Support Diagnostics` | `в Support Diagnostics'е` |

- 103 instances of the `в приложении Marinara …` carrier form. Evidence: `CONFIGURATION.md:3`,
  `FAQ.md:3`, `chats/branches.md:3`.
- Carrier + Latin `NPC`: `game/party-and-npcs.md:1` (`# Game Mode: отряд и персонажи NPC`),
  `:79`, `:95`. `NPC` appears **47×** in Latin (43 as the standalone word, 4 inside the plural
  `NPCs`); the carrier form `персонаж NPC` accounts for 25 of them. `НПС` **0×** — ban holds.

**What stays English (never translated, never transliterated):**

| Class | Members (as they appear) |
|---|---|
| Product & shell | `Marinara`, `Marinara Engine`, `Noodle`, `Professor Mari`, `Termux`, `Docker`, `Android`, `Windows`, `Linux`, `Node.js`, `Tailscale`, `SillyTavern`, `ComfyUI`, `Spotify`, `Home Assistant`, `OpenAI` |
| Chat modes | `Conversation`, `Roleplay`, `Game Mode` (and bare `Game`) |
| Agents & packages | `Storyboard`, `Illustrator`, `Music DJ`, `World Maps`, `Knowledge Router`, `Local Model`, `Agent Suite` |
| Acronyms | `API`, `JSON`, `CSS`, `HUD`, `GM`, `GIF`, `PWA`, `HP`, `MP`, `CSRF`, `SSRF` |
| UI controls & panels | every bold label — see §6 |

**Glossed-on-first-use, then bare.** A frozen name that is not self-evident gets a one-time
Russian explanation on first use in that document, then runs bare:

- `HUD – это heads-up display, экранная панель` — `agents/agents-overview.md:50`
- `Ключ API – это секретный код от провайдера` — `TROUBLESHOOTING.md:128`
- `Эмбеддинг – это числовое представление текста` — `TROUBLESHOOTING.md:164`
- `Токен – это небольшой кусочек текста` — `lorebooks/token-budgets.md:5`
- `PWA (Progressive Web App – сайт, который можно установить как приложение)` — `FAQ.md:43`

Note the gloss connector is ` – это ` (spaced en dash + `это`), not a colon and not an em dash.

**Articles / determiners:** Russian has none. Do **not** import English `the`/`a` as `данный`,
`указанный`, or `этот` unless the demonstrative is genuinely contrastive. The pack writes
`Ветка – это копия чата`, not `Ветка – это данная копия чата` (`chats/branches.md:7`).

---

## 3. Core terminology

Banned alternates are **defect classes**: a reviewer finding one *used for this concept* should
treat it as a regression, not a synonym choice. The whole point of the single-rendering rule is that
the docs viewer's search is literal-substring — two renderings of one concept split the result set.

> **Read this before grepping for a banned alternate.** A ban is **sense-scoped**, never
> word-scoped. Most banned alternates are ordinary, correct pack vocabulary in some *other* sense,
> and several are among the most common words in the pack. Grepping the bare word does not find
> defects — it finds the pack doing its job. The measured false-positive load, whole-tree:
>
> | Banned alternate | Occurrences | What they actually are |
> |---|---|---|
> | `вариант` | 299 | **option / choice** (`три варианта действий`) — never "swipe" |
> | `запрос` | 241 | HTTP/provider **request**, `по запросу` — never "prompt" |
> | `удаление` | 186 | ordinary **deletion** of data — never "eviction" |
> | `элемент` | 178 | `элементы управления` = UI **controls**, list items — never "widget" |
> | `лорбука` | 150 | the **genitive of masculine `лорбук`** — correct, see §6 |
> | `шаг` | 128 | a numbered **step** in an instruction — never "Game Mode turn" |
> | `группа` | 128 | lorebook **groups** and general grouping — never "party" |
> | `сервис` | 105 | an external **AI service** — never "provider" (the configured entity) |
> | `подсказка` | 103 | **tooltip** (`всплывающая подсказка`, 35×), **placeholder** (`подсказка в поле`, 10×), **hint/tip** — never "prompt" |
> | `аватар` | 109 | the **avatar image** (`Roleplay Avatars`, `круг аватара`) — never "persona" |
> | `пункт` | 70 | menu / list **item** — never "lorebook entry" |
> | `заметка` | 67 | a user's or agent's **note** — never "saved memory" |
> | `помощник` | 56 | the **definitional gloss** for agent — see the agent row |
> | `off` | 41 | the **verbatim UI state** `**off**` — the ban covers the Russian default column only |
> | `ассистент` | 40 | the **assistant message role** and Professor Mari — see the agent row |
> | `реплика` | 34 | **in-fiction speech** in quotes — never "message" |
> | `знак` | 21 | punctuation **mark**, the tic-tac-toe **mark** — never "token" |
> | `вложение` | 21 | file **attachment** — never "embedding" |
> | `эпизод` | 21 | the **Storyboard episode** — never "scene" |
> | `встраивание` | 16 | an agent's **pipeline phase** (`способ встраивания`) — never "embedding" |
> | `пост` | 13 | a **Noodle post** — never "chat message" |
> | `векторизация` | 13 | the **act** of vectorizing a lorebook — see the embedding row |
> | `картинка персонажа` | 13 | the **avatar** (`characters/creating-and-editing-characters.md:89`) — never "sprite" |
> | `диалог` | 10 | **dialogue box** (`Game Dialogue Display`) — never "chat" |
> | `переписка` | 10 | messaging **as prose description** — never the term for "chat" |
> | `соединение` | 5 | a **network/physical** connection — never a configured provider connection |
> | `круг` | 3 | `круг аватара` = avatar **circle** — never "combat round" |
> | `буфер` | 2 | `буфер обмена` = **clipboard** — never "cache" |
> | `alter ego` | 1 | inside the verbatim UI label `**Inspired alter ego (Hinted)**`, `noodle/settings.md:28` |
> | `индексация` | 1 | graph **indexing** in a dev doc — never "vectorization" |
>
> The **rest of the banned alternates are genuinely absent (0×) and safe to grep bare**: `кэш`,
> `НПС`, `непись`, `НИП`, `учетная запись`, `затравка`, `лексема`, `предустановка`, `шаблон
> настроек`, `книга знаний`, `книга лора`, `предание`, `мифология`, `чар`, `герой`, `профиль
> пользователя`, `беседа`, `чат группы`, `мультичат`, `смахивание`, `отслеживатель`, `следилка`,
> `мини-приложение`, `поставщик`, `лаунчер`, `стартер`, `накатить`, `ветка выпусков`, `релиз-канал`,
> `бранч`, `чекаут`, `вейк-лок`, `аккумулятор`, `энергосбережение`, `резидентно`, `ОЗУ`, `выселение`,
> `бэкап`, `дамп`, `снапшот`, `слепок`, `срез`, `коннекшн`, `чарактер-кард`, `реквизиты`, `данные для
> входа`, `хаб-запись`, `узловая запись`, `бюджет токенов`, `косая команда`, `ролл`, `кидание`,
> `пати`, `вайтлист`, `переменная среды`, `энв`, `неограниченно`, `таймаут`.
>
> So the split is: **the 30 words in the table need a sense check before you call anything a defect;
> the other 58 are clean mechanical checks.**

Where a banned alternate appears in the table above, its ban is **narrow** even if the cell below
does not repeat the restriction — check the count and sense there first. This applies in particular
to `вариант` (swipe), `шаг` (turn), `группа` (party), `сервис` (provider), `заметка` (memory item)
and `удаление` (eviction), all of which are common, correct words elsewhere in the pack.

| English term | This pack's term | Banned alternates | Evidence |
|---|---|---|---|
| prompt | **промпт** (declines), 581× | подсказка, запрос, затравка — **for the prompt sense only** | `CONFIGURATION.md:37`; `chats/peek-prompt.md:70`. The pack draws the line itself at `settings/settings-overview.md:44`: "меняет элементы управления и **подсказки** приложения, но не **промпты** для модели" |
| tooltip | **всплывающая подсказка** (bare **подсказка** once the tooltip is in view) | тултип, всплывающий текст | `chats/branches.md:38`, `chats/group-chats.md:43`, `game/dice-and-skill-checks.md:29` — 35× in the full form |
| placeholder text | **подсказка в поле** | плейсхолдер, заполнитель | `characters/sprites.md:33`, `chats/connected-chats.md:83`, `REMOTE_ACCESS.md:190` |
| token | **токен** (declines) | лексема, знак | `lorebooks/token-budgets.md:5` |
| preset | **пресет** (declines) | предустановка, шаблон настроек | `CONFIGURATION.md:185`. **Not** `профиль настроек` — that is a different feature, next row |
| settings profile | **профиль настроек** | пресет (that is the prompt preset), профиль чата | `chats/settings-profiles.md` (whole guide); `:14` states the relationship: "пресет промпта – лишь один из элементов профиля настроек"; also `chats/managing-chats.md:29`, `chats/group-chats.md:118` |
| lorebook | **лорбук** (declines, **masculine**) | книга знаний, книга лора | `FAQ.md:101`. The 150 hits for `лорбука` are the **genitive singular** and are correct; what is banned is treating it as a feminine **nominative** (§6) |
| lore | **лор** (declines) | предание, мифология | `lorebooks/entries.md:155` ("подтягивать связанный лор") |
| character card | **карточка персонажа** | карта персонажа, чарактер-кард | `agents/approvals-and-agent-suite.md:38` |
| character | **персонаж** | чар, герой | `CONFIGURATION.md:18` |
| persona | **персона** (declines) | профиль пользователя, alter ego; `аватар` (reserved for the **avatar image** — `appearance/appearance-settings.md:88`, `characters/creating-and-editing-characters.md:15`) | `FAQ.md:103` (`**Linked Personas** (связанные персоны)`) |
| chat | **чат** (declines) | беседа; `диалог` (reserved for the **dialogue box** — `appearance/appearance-settings.md:100`, `Game Dialogue Display`); `переписка` (fine as descriptive prose for messaging, e.g. `FAQ.md:53`, but never as the term) | `CONFIGURATION.md:148` |
| group chat | **групповой чат** | чат группы, мультичат | `characters/creating-and-editing-characters.md:57` |
| message | **сообщение** | реплика (reserved for in-fiction speech, `appearance/appearance-settings.md:66`), пост (reserved for **Noodle posts**, `noodle/overview.md:47`) | `FAQ.md:121` |
| swipe | **свайп** (declines) | смахивание, вариант (bare) | `chats/branches.md:25` (glossed once: `свайпами (альтернативными вариантами ответа)`) |
| agent | **агент** (declines) | бот (reserved: AI card-game players, `conversation/table-games.md:49`), отслеживатель | `CONFIGURATION.md:29`. **`помощник` is not banned** — it is the pack's own definitional gloss for an agent and appears in the guide's H1: `agents/agents-overview.md:1` (`# Агенты: помощники ИИ в чатах`), `:7`, `agents/built-in-agents.md:7`. Use it to *explain* an agent, never as the standalone term |
| assistant (message role) | **ассистент** | — | `agents/built-in-agents.md:17`, `:45`, `:210` (`сообщений пользователя и ассистента`). The same word is also correct for Professor Mari as an assistant persona: `characters/creating-and-editing-characters.md:159` (`персонаж-ассистент`), `conversation/profiles.md:32`. It is **not** a synonym for `агент` |
| tracker | **трекер** (declines) | отслеживатель, следилка | `agents/agents-overview.md:50` (`**Manual Trackers**`); `appearance/appearance-settings.md:67` |
| widget | **виджет** (declines) | мини-приложение | `game/hud-widgets.md:1` (`# Game Mode: виджеты панели HUD`), `:7`, `:9`; `characters/colors-and-stats.md:71`. 86× pack-wide — but **0× in `agents/agents-overview.md`**, which is about agents, not widgets |
| sprite | **спрайт** (declines) | картинка персонажа (that phrase means something else) | `CONFIGURATION.md:213` |
| connection (configured provider) | **подключение** | коннекшн; `соединение` (reserved for a **network/physical** link — `conversation/calls.md:20`, `development/personal-extensions.md:55`) | `CONFIGURATION.md:263` |
| provider | **провайдер** (declines) | поставщик, сервис | `CONFIGURATION.md:18` |
| embedding (the object) | **эмбеддинг** (declines) | вложение, встраивание | `CONFIGURATION.md:208`; glossed at `TROUBLESHOOTING.md:164` and `lorebooks/semantic-search.md:11` |
| vectorize / vectorization (the action) | **векторизовать** / **векторизация** | эмбеддить, индексация | `agents/knowledge-sources.md:89` (`векторизуйте лорбук`; `при векторизации`), `connections/local-model.md:151`. 13× — this is a **separate, attested term**, not a banned rendering of *embedding* |
| launcher / launch script | **скрипт запуска** (56×) | лаунчер, стартер | `CONFIGURATION.md:276`, `TROUBLESHOOTING.md:324`; declined form at `CONFIGURATION.md:274` (`в скриптах запуска`). `программа запуска` survives 4× — see residual F |
| update (verb) / apply | **применить обновление**, n. **применение обновления** | накатить, установить обновление (for the in-app Apply action) | `CONFIGURATION.md:238`; `UPGRADING.md:158` |
| release channel | **канал выпусков** | ветка выпусков, релиз-канал | `UPGRADING.md:128` |
| branch (chat) | **ветка** | ответвление (used only as a loose descriptor), форк | `chats/branches.md:1`, `:7` |
| branch (git / repo) | **ветка** (same word — context disambiguates) | бранч | `CONFIGURATION.md:316` (`официальная ветка docs-i18n`) |
| checkout (working tree) | **рабочая копия** | чекаут, выгрузка | `TROUBLESHOOTING.md:39` |
| wake lock | **блокировка сна** | вейк-лок, удержание пробуждения | `TROUBLESHOOTING.md:324` |
| battery optimization | **оптимизация батареи** | оптимизация аккумулятора, энергосбережение | `TROUBLESHOOTING.md:326`, `:332` |
| background activity / run in background | **фоновая активность** / **работать в фоне** | активность в фоновом режиме, бэкграунд | `TROUBLESHOOTING.md:326`, `:332` |
| in memory / resident | **в памяти** (`держит в памяти`, `хранятся только в памяти`) | в оперативной памяти, резидентно, в ОЗУ | `CONFIGURATION.md:155`; `TROUBLESHOOTING.md:182`; `development/architecture-map.md:95` |
| memory (the system) | **память** | воспоминания (that is the item, not the system) | `CONFIGURATION.md:156` |
| memory (a saved item) | **воспоминание** | фрагмент памяти (used only in the counting phrase), заметка | `TROUBLESHOOTING.md:163`, `:166` |
| Saved memories (prose) | **Сохраненные воспоминания** | Сохраненная память, Мои воспоминания | `home/professor-mari.md:114` — panel label itself stays **Memories**, `:121` |
| eviction (from a bounded space) | verb **вытеснить**; noun **вытеснение**; "drop from memory" = **убрать из памяти** | выселение, выброс, удаление | verb: `chats/peek-prompt.md:70`, `lorebooks/token-budgets.md:5`, `lorebooks/entries.md:138`. **Noun: `CONFIGURATION.md:155`** (`значение 0 … отключает вытеснение`, rendering EN "disables eviction"). `убирается из памяти` on the same line renders EN "is dropped from memory" |
| least-recently-used | **тот, к которому дольше всего не обращались** | LRU, давний, наименее используемый | `CONFIGURATION.md:155` — `чат, к которому дольше всего не обращались и в котором нет несохраненных изменений, убирается из памяти`, rendering EN `docs/CONFIGURATION.md:157` "the least-recently-used chat with no unsaved changes is dropped from memory". Reuse this relative-clause construction; do not coin a noun |
| cache (n. / v.) | **кеш**, **кешировать**, **кешируется** | **кэш** (hard ban); `буфер` (reserved for `буфер обмена` = **clipboard**, `game/sessions-and-saves.md:30`) | `TROUBLESHOOTING.md:75`; `UPGRADING.md:147`; `CONFIGURATION.md:322` — `кэш` appears **0×** |
| backup | **резервная копия** | бэкап, бекап, дамп | `CONFIGURATION.md:158`, `:16` |
| snapshot | **снимок** (`снимок состояния`, `снимок пространства`) | слепок, срез, снапшот | `agents/hierarchical-maps.md:24`, `:103`; `agents/hierarchical-maps.md:488` |
| extension (Marinara add-on) | **расширение** | дополнение (reserved for *add-on package* sense), плагин | `CONFIGURATION.md:57` (`### Внешние расширения`) |
| account | **аккаунт** (declines) | **учетная запись** (banned), профиль | `agents/hierarchical-maps.md:35`, `:112`; 126 occurrences, 0 `учетная запись` |
| credentials | **учетные данные** | реквизиты, данные для входа | `FAQ.md:47`; `TROUBLESHOOTING.md:294` — the `учетн-` stem survives here **only** in this sense |
| NPC | **NPC** (Latin, undeclined) + carrier noun `персонаж NPC` | **НПС** (hard ban), неписи, НИП | `game/party-and-npcs.md:1`, `:79`, `:95` — `НПС` appears **0×** |
| setting (fictional world) | **мир** | **сеттинг** (banned — 1 residual, see §7 residual C) | `FAQ.md:101`, `:105`; `agents/hierarchical-maps.md:35` |
| turn (Game Mode) | **ход** | раунд (reserved for combat rounds), шаг | `game/getting-started.md:11` (`от хода к ходу`), `:104` |
| every turn / each time (Mari, chat, lorebook) | **каждый раз** | каждый ход (Game-Mode-only word) | `home/professor-mari.md:127`, `:129`; `chats/chat-settings.md:30`; `lorebooks/entries.md:73` |
| round (combat) | **раунд** | `круг` (reserved for `круг аватара` = the **avatar circle**, `characters/creating-and-editing-characters.md:15`) | `game/combat.md:9` |
| hub entry (lorebook) | **запись-узел** / pl. **записи-узлы** | хаб-запись, узловая запись, родительская запись | `lorebooks/entries.md:153`, `:155`, `:324` |
| entry (lorebook) | **запись** | статья; `пункт` (reserved for a **menu / list item** — `appearance/custom-css-themes.md:59`) | `FAQ.md:101` |
| token budget / entry limit | **лимит токенов** / **лимит записей** | бюджет токенов, квота | `lorebooks/token-budgets.md:1`, `:3` |
| slash command | **слеш-команда** | косая команда, команда со слешем | `chats/guided-and-impersonate.md:11`, `:96` |
| scene | **сцена** | эпизод — **but** `эпизод` is the Storyboard agent's own unit (`game/storyboard.md:11`, `:14`, `:15`), so the ban covers the *narrative-scene* sense only | `roleplay/getting-started.md:108` |
| dice roll / skill check | **бросок кубика** / **проверка навыка** | кидание, ролл, чек | `chats/slash-commands.md:82`; `agents/built-in-agents.md:226` |
| party | **отряд** | группа (reserved for lorebook groups), пати | `game/party-and-npcs.md:1`; `game/sessions-and-saves.md:72` |
| log (server) | **журнал** | лог, логи | `CONFIGURATION.md:14` (`подробность журнала сервера`), `:106`, `:217` |
| environment variable | **переменная окружения** | переменная среды, энв | `CONFIGURATION.md:3` |
| timeout | **тайм-аут** | таймаут (no hyphen), время ожидания | `CONFIGURATION.md:15`, `:205` |
| allowlist | **список разрешенных адресов** (37×) | вайтлист, белый список | `FAQ.md:14`, `:37`; `CONFIGURATION.md:12`, `:134`. `белый список` survives 1× in a *fields* (not addresses) sense — residual G |
| unset (default column) | **не задано** | пусто (reserved for EN "empty"), нет значения | `CONFIGURATION.md:238` — the **only** `не задано` in the table; contrast 18× `пусто` at `:124`, `:125`, `:127`, `:135-138`, `:154`, `:235`, `:244`, `:275`, `:292`, `:296`, `:297`, `:310`, `:317`, `:324`, `:325`; prose form `не задан` at `:118`, `:247` |
| off (default column) | **выключено** (16×) | отключено, off — **in the default column**. In running prose `отключено` is fine for "is disabled" (`TROUBLESHOOTING.md:139`, 1×) | `CONFIGURATION.md:156` |
| unlimited (default column) | **без ограничений** | неограниченно, ∞ | `CONFIGURATION.md:155` |

### Terms carried from the 2026-09-01 mirror cycle

These rows were decided during the same-day delta mirror and are reproduced here with the
citations they shipped with:

- **`least-recently-used` — CORRECTED, now verified.** The earlier cycles recorded this as
  "no established LRU rendering, phrase it naturally". **That was a false negative.** The pack does
  render it, at `CONFIGURATION.md:155` (the `MARINARA_MAX_RESIDENT_CHATS` row):
  `чат, к которому дольше всего не обращались … убирается из памяти` — translating EN
  `docs/CONFIGURATION.md:157` "the least-recently-used chat … is dropped from memory". The prescribed
  phrasing and the shipped phrasing turn out to be the same string, so the guidance is unchanged, but
  it is now an **in-pack term with a citation**, not an invention to be avoided.
  The related `chats/managing-chats.md:97` (**Oldest** — `чаты, в которых активности не было дольше
  всего`) is a *sort order*, a second, consistent use of the same construction.
- **`eviction` as a noun — CORRECTED, now verified.** `вытеснение` **is** attested, on that same
  line: `значение 0 (или незаданная переменная) отключает вытеснение` for EN "disables eviction".
  The verb remains the more common form (3×) and is still the better default in running prose, but
  the noun is a pack term and no longer needs rewriting away.
- **Why both were missed.** The original greps (`давн*`, `вытесн*`, `выгруж*`, `из памяти`,
  `кеш`, `обращал*`) *should* have hit — `CONFIGURATION.md:155` matches four of the six. A grep that
  returns nothing on Cyrillic is the documented MSYS failure in §7 trap 2, and this is a concrete
  instance of it producing a wrong glossary entry. **Re-run any negative finding through the Python
  scanner before recording it as a ruling.**
- **`unset` ≠ `empty`** — do **not** collapse the distinction. Re-verified this cycle and the
  split is clean: the default column renders EN *empty* as `пусто` **18 times**, always for a
  variable whose value is an empty **string** (`BASIC_AUTH_USER`, `SSL_CERT`, `GIPHY_API_KEY` …,
  `CONFIGURATION.md:124`–`:325`), while `не задано` appears **exactly once**
  (`CONFIGURATION.md:238`, `UPDATES_APPLY_DISABLED`) — a set/not-set **flag**. EN deliberately uses
  a different word there, so `не задано` stays separate. Related non-literal defaults follow the
  same lowercase-Russian-word pattern (`автоматически`, `встроенные значения`, `выключено`,
  `без ограничений`).

---

## 4. Typography & punctuation

| Rule | Detail | Evidence |
|---|---|---|
| **En dash `–` (U+2013) for тире** | Wherever Russian grammar wants a dash — subject/predicate copula, parenthetical, list intro — use the **en dash**, spaced on both sides. | 1762 occurrences; `CONFIGURATION.md:3`, `FAQ.md:101` |
| **Em dash `—` (U+2014) is banned** | Pack-wide ban. 14 characters survive across 7 lines (6 Russian-prose lines + 1 by-design English literal) — see §7 residual A. | see §7 residual A |
| Unspaced en dash = numeric range only | `5–3`, `23:00–07:00`. In prose the dash is always ` – `. | `agents/hierarchical-maps.md:4`, `:7`, `:430`; `noodle/settings.md:219`; 4 unspaced instances total, all ranges |
| **Straight ASCII quotes only** | `"..."`. **No «ёлочки»**, no „нижние лапки", no curly `“ ” ‘ ’`. | `«»` **0×**, curly quotes **0×**; `TROUBLESHOOTING.md:330` (`"Opening chat..."`) |
| **No non-breaking spaces** | U+00A0 appears **0×**. Do not introduce them for numeral+unit or preposition binding. | full character inventory: no U+00A0 |
| **`е`, not `ё`** | One spelling per word keeps search deterministic. The sole allowed exceptions are **всё / всём / всё-таки** (14 conforming uses). Capital `Ё` appears **0×**. | 9 non-conforming words remain — see §7 residual B |
| Thousands separator = **space**, in prose quantities only | `1 000 000`, `2 000`, `478 000`. Never `1,000`, never `1.000` (**0** of each — the ban holds). **Technical and config values stay bare**: `4096`, `8192`, `300000`, ports, hex. Only 6 separated numbers exist pack-wide, so treat this as a narrow prose rule, not a sweep target. | `extending/writing-personal-extensions.md:206`, `:221`, `:225`; `development/code-cleanup-audit.md:46` (`478 000`); `conversation/table-games.md:109`. Bare technical values: `noodle/settings.md:133`, `:160`; `agents/custom-agents.md:163`. **Inconsistency:** `conversation/table-games.md:109` carries `**1000**` and `1 000 000` in one row |
| Decimal separator = **comma** in prose, **period** in code/values | Env-var values and code fences keep the literal ASCII form. | `CONFIGURATION.md:205` (`300000` (5 минут)) |
| Percent | Numeral + `%` with **no space** (`100%`, `75%`, `40%`) for values and UI figures; spelled `процентов` when the sentence reads as prose. Both are in use; match the local sentence. | `characters/creating-and-editing-characters.md:57` (`от 0 до 100 процентов`); `lorebooks/entries.md:218` (`Probability 40%`) |
| Sentence terminators | Full stop. Russian does not double punctuation; `!.` appears **0×**. The 2 hits for `?.` are JavaScript optional chaining inside code (`extending/personal-extensions.md:97`, `:107`) — not punctuation. | pack-wide |
| **No exclamation marks in Russian prose** | **0** in Russian sentences. All 17 `!` outside code are inside **verbatim English UI strings** (`**Victory!**`, `**React quickly!**`, `**Import complete!**`, `"{winner} wins!"`) — reproduce those as the app renders them, but never write an exclamation in your own Russian. | `game/combat.md:70`, `:84`; `data/importing-from-sillytavern.md:78`; `conversation/table-games.md:73` |
| **List mechanics** | Bullets are full sentences and end with a **period** — 2232 of 2865 bullets longer than 40 characters (78%). Bullets ending `)` (425) are label-gloss forms; `;` (102) appears in enumerations that continue one sentence across items. | `CONFIGURATION.md:11-16`; `agents/hierarchical-maps.md:35-40` (semicolon run) |
| Colon before a list | Used when the stem is a genuine lead-in — **373 of 578 list intros (64%)**. A stem that is already a complete sentence takes a period instead. | colon: `CONFIGURATION.md:9` (`…если вы хотите:`), `:22` (`Жизненный цикл пакетов и их хранение:`), `chats/managing-chats.md:94`. Period (182 intros): `agents/agents-overview.md:71` (`Проверить можно так.`), `agents/built-in-agents.md:25` |
| Ordered lists | `1.` `2.` `3.` with a period, imperative sentence per step. | `FAQ.md:9-31` |
| Ellipsis in verbatim UI strings | Reproduce **byte-exact** what the app renders — **never normalize**. The pack ships **15** U+2026 and **45** verbatim ASCII `...` strings, and that mixture is very largely *correct*, because the app itself is mixed. It is mixed **per component, not per word**: `en.json` has `ui.chat.summarypopover.generating = 'Generating...'` next to `ui.layout.chatsidebar.generating = 'Generating…'`, and `ui.game.gamejournal.savingEntry = 'Saving...'` next to `editor.save.saving = 'Saving…'`. So you cannot infer the form from the word — **look up the specific key for the specific screen** before writing it. One genuine mismatch found — residual E. | `UPGRADING.md:135` (`**Switching…**` = `ui.panels.advancedsettings.switching`) vs `TROUBLESHOOTING.md:330` (`"Opening chat..."` = `ui.chat.chatarea.openingChat`) |
| Menu-path separator | `→` (U+2192) is the majority form (80×). Two ASCII variants also ship — see §7 residual D. | `CONFIGURATION.md:31` (`**Settings** (настройки) **→ Advanced → Danger Zone**`) |

---

## 5. UI labels & glosses

**The byte-exact rule.** The `ru` app locale (`packages/client/src/localization/locales/ru.json`)
covers **132 of 9,123** English UI keys — **1.4%**. The overwhelming majority of Marinara's
interface renders **in English** for a Russian reader. That is the reason the docs keep control
names in English: a translated label in the docs would not match anything on screen.

So: **UI control names stay in English, bold, byte-exact as rendered.**

### Pattern A — interactive controls: bold EN + one-time parenthetical gloss

The gloss is **lowercase Russian in parentheses**, given **once per document** on first mention;
every later mention in that same document runs bare.

```
Агенты включаются внутри каждого чата, в выдвижной панели **Chat Settings** (настройки чата).
```
— `agents/agents-overview.md:37`

Verified gloss-once behaviour: `agents/agents-overview.md` mentions **Chat Settings** 4 times and
glosses it once; `chats/chat-settings.md` 5 times, glossed once; `agents/approvals-and-agent-suite.md`
2 times, glossed once.

More in-pack examples:

| Label | Gloss | Where |
|---|---|---|
| `**Agents**` | (агенты) | `agents/agents-overview.md:3` |
| `**Download Agents**` | (скачать агентов) | `agents/agents-overview.md:25` |
| `**Review Agent Outputs**` | (проверять результаты агентов) | `agents/agents-overview.md:49` |
| `**Debug mode**` | (режим отладки) | `agents/agents-overview.md:76` |
| `**Release Channel**` | (канал выпусков) | `UPGRADING.md:128` |
| `**Memories**` | (воспоминания) | `home/professor-mari.md:121` |
| `**Token Budget**` | (лимит токенов) | `lorebooks/token-budgets.md:3` |
| `**Manual Trackers**` | (ручные трекеры; только для чатов Roleplay) | `agents/agents-overview.md:50` |

Gloss style: lowercase, no terminal punctuation inside the parentheses, imperative for verbs
(`скачать агентов`, `проверять результаты агентов`), noun phrase for nouns.

#### A bold label's parentheses are not always a gloss

This matters for review and for QA check 14. A bold EN label takes **four** different kinds of
parenthetical, and only the first is the once-per-document translation gloss:

| Kind | Example | Repeatable? |
|---|---|---|
| **Translation gloss** | `**Session** (сессия)` — `game/sessions-and-saves.md:13` | **No** — once per document |
| **Icon / locator** | `**Session** (иконка пера)` — `:16`, `:27`; `**Constant** (желтая точка)` — `lorebooks/entries.md:73` | Yes, as often as the reader needs to find the control |
| **Default state** | `**Add as Prompt Section** (включено по умолчанию)` — `agents/built-in-agents.md:81`, `:97`, `:115`, `:133`, `:141`; `**Token Budget** (по умолчанию **2048**)` — `lorebooks/token-budgets.md:20` | Yes |
| **Example / scope note** | `**Pools** (сначала HP и MP на 100 из 100)` — `characters/colors-and-stats.md:58`; `**Allow Noodle references** (для каждого чата)` — `noodle/settings.md:245` | Yes |

A naive `**Label** (` regex conflates all four and reports 23 false "double glosses" (9 after
filtering obvious default/icon wording). The pack's true repeat-translation count is **0**.

### Pattern B — status and error strings: bold EN, **no gloss**

Strings the app *emits* (rather than controls the user clicks) carry no parenthetical gloss. The
surrounding Russian sentence explains them.

- `**Untrusted request host**` — `TROUBLESHOOTING.md:103`
- `**Save blocked: missing CSRF header**` — `TROUBLESHOOTING.md:114`
- `**Waiting for vector**` — `TROUBLESHOOTING.md:163`
- `**Embedding unavailable**` — `TROUBLESHOOTING.md:164`
- `**No API connection configured for this chat**` — `TROUBLESHOOTING.md:128`
- `**Server unreachable**`, `**Unreachable (request timed out)**` — `TROUBLESHOOTING.md:330`

This precedent also avoids nesting a gloss inside a label that already carries its own parentheses.

### Pattern C — long verbatim strings: straight double quotes, unbolded

Multi-word sentences the app prints are quoted, not bolded:

- `"Opening chat..."` — `TROUBLESHOOTING.md:330`
- `"Update applied successfully. Please relaunch the app to use the new version."` — `UPGRADING.md:164`
- `"Staging builds are pre-release tester builds. Back up your app data before applying them."` — `UPGRADING.md:133`
- `"N commits behind"` — `UPGRADING.md:145`; `"vX.Y.Z available"` — `UPGRADING.md:144`

### Never copy a gloss from `ru.json`

The divergence is **measured and confirmed** (re-counted this cycle from
`packages/client/src/localization/locales/ru.json`): of its 132 values, **12 contain `ё`**
(`сохранённые`, `Загрузка…`, `Щёлкните`, `включённых`), **2** use `…` (U+2026), **1** uses an em
dash (`connections.mediaSources.atlas.videoDefaultsNote`), and **0** use an en dash. Every one of
those is a docs-pack violation.

**`[recorded ruling]`** — the *precedence* decision: where the two disagree, the **docs style
contract wins**. Glosses are written in the pack's own register (`е` not `ё`, en dash, straight
quotes) and are **never** pasted from `ru.json`. The measurement above is verifiable; the ordering
of the two contracts is a maintainer call the pack cannot show.

### Feature names with no `ru` precedent

An unbolded English feature name with no pack precedent stays Latin behind a carrier noun:
`в скопированном отчете Support Diagnostics` (`TROUBLESHOOTING.md:330`).

---

## 6. Language-specific mechanics

**Declension of loanwords.** Community-standard Cyrillic loanwords decline **normally**. Case
endings are suffixes, so the searchable stem survives declension — this is why loanwords may
decline while frozen Latin names may not.

```
промпт  → промпта, промпту, промптом, промпты, промптов
токен   → токена, токенов, токенам
пресет  → пресета, пресеты, пресетов
лорбук  → лорбука, лорбуку, лорбуки, лорбуков, лорбукам
чат     → чата, чату, чатом, чаты, чатов, чатам
свайп   → свайпа, свайпами
спрайт  → спрайта, спрайтов
виджет / трекер / провайдер / эмбеддинг / аккаунт — likewise
```

**`лорбук` is masculine.** `большой лорбук`, `общего лорбука`, `в лорбуке`. Never treat it as
feminine (`лорбука` as nominative). **`[recorded ruling]`** the form itself was adopted because it is
the **RU SillyTavern community's own term** — the pack's readers arrive already using it (PR #4281).
The pack confirms the term; the community-usage rationale is the recorded justification.

**Compound nouns with a Latin head** hyphenate the Russian modifier and decline only the Russian
part when the Russian part is the head:

- `агенты-писатели`, `агенты-трекеры` (`agents/agents-overview.md:11`)
- `записи-узлы` → gen. `записей-узлов`, prep. `на записях-узлах` (`lorebooks/entries.md:153`, `:155`, `:324`)
- `слеш-команда` → instr. `слеш-командой` (`chats/guided-and-impersonate.md:96`)

**Carrier-noun case selection.** The carrier takes whatever case the sentence needs; the Latin name
never moves: `в приложении Marinara Engine` (prep.), `сервера Marinara` (gen.),
`с сервером Marinara` (instr.), `каталог Pasta-Devs/Marinara-Agents` (acc.).

**Genitive after quantities:** `33 пакета`, `5 новых сообщений`, `тысячи токенов подробностей`
(`agents/agents-overview.md:11`, `TROUBLESHOOTING.md:166`, `lorebooks/entries.md:155`).

**Aspect in instructions.** Steps use the **perfective** imperative (`Нажмите`, `Откройте`,
`Задайте`) for a single completed action; the **imperfective** appears for habitual or ongoing
behaviour (`держите выключенным`, `Управлять воспоминаниями можно`).

**In-fiction content is not translated.**

- Example lorebook **entry names, keys and content stay Latin/English** by design:
  `**Count Vlad**`, `Primary Keys: \`Vlad\``,
  `Content: \`The immortal count who rules Wallachia after dark…\`` (`lorebooks/entries.md:180-190`).
  Where an entry *heading* is a descriptive Russian phrase (`**Слабость графа**`,
  `lorebooks/entries.md:196`), its key/content fields still stay English.
- **Literal-matching demonstrations stay English by design** — the whole point is that the
  substring behaviour is visible: `ключевое слово \`Ash\` совпадает с "Ash", но не с "ashes" и не
  с "cash"` (`lorebooks/entries.md:231`). Translating these destroys the demonstration.

---

## 7. QA checks & known traps

### Tooling traps — read before writing any check

1. **JavaScript `\w` does NOT match Cyrillic — even with the `/u` flag. `[verified 2026-09-01]`**
   A validator built on `\w` reports a clean pack because it matched nothing at all. Reproduced:

   ```
   $ node -e "const t='промпт токен лорбук';
              console.log(t.match(/\w+/gu));               // null
              console.log(t.match(/[а-яё]+/gu));           // ['промпт','токен','лорбук']
              console.log(t.match(/\p{Script=Cyrillic}+/gu)); // ['промпт','токен','лорбук']"
   ```

   Use `[а-яёА-ЯЁ]` or `\p{Script=Cyrillic}` with `/u`. Highest-value trap in the list, because the
   failure mode is a **false pass**.

2. **MSYS bash `$'\uXXXX'` does not expand — greps silently return nothing. `[verified 2026-09-01]`**
   Reproduced against a file with a known-good ground truth of **2** em-dash lines
   (`ru/agents/custom-agents.md`, counted in Python):

   ```
   $ printf '%s' $'—' | od -c        # ->  \   u   2   0   1   4   (six literal bytes)
   $ grep -c $'—' ru/agents/custom-agents.md   # -> 0   WRONG (false pass)
   $ grep -c '—'       ru/agents/custom-agents.md   # -> 2   correct (literal character)
   ```

   Also confirmed: MSYS `grep`/`sed` are **byte-oriented** for Cyrillic —
   `grep -o '[А-Яа-я]\{4,\}'` emits truncated UTF-8, leaving dangling lead bytes (`0xD1`) mid-word,
   so `-o` output, `[А-Яа-я]` classes, and `-P` lookarounds all mis-slice multibyte text.
   **Run every Cyrillic check through a Python script reading UTF-8** (or ripgrep), never through
   MSYS `grep -P` + `sed`. Paste the literal character rather than an escape.

   **This trap has already cost this glossary two wrong entries** — the "no LRU rendering" and
   "eviction noun unattested" findings in §3 were both false negatives produced this way. Treat any
   *negative* Cyrillic finding as unproven until a Python scan confirms it.

### Mechanical checks (each catches a real `ru` regression class)

All counts below were re-measured 2026-09-01 with the UTF-8 Python scanner.

| # | Check | Expected | Measured |
|---|---|---|---|
| 1 | Em dash `U+2014` outside English literal content | 0 | **6 prose lines / 13 chars** — residual A |
| 2 | `ё` outside `всё`/`всём`/`всё-таки`; capital `Ё` | 0 | **9 words, 2 files**; `Ё` 0 — residual B |
| 3 | `кэш` | 0 | **0** ✓ |
| 4 | `учетная/учетную/учетной запись` | 0 (`учетные данные` allowed, 11×) | **0** ✓ |
| 5 | `НПС`, `непись`, `НИП` | 0 | **0** ✓ |
| 6 | `сеттинг` | 0 | **1** — residual C |
| 7 | `«` `»` `“` `”` `‘` `’` `„` | 0 | **0** ✓ |
| 8 | Non-breaking space `U+00A0` (also `U+3000`, `U+200B`, `U+200D`, `U+2011`, `U+2212`) | 0 | **0** each ✓ |
| 9 | Mid-sentence capitalized `Вы` | 0 | **0** ✓ (39 sentence-initial are correct) |
| 10 | Singular imperatives `Нажми`, `Открой`, `Задай`, `Выбери`; `ты`-family outside quoted user utterances | 0 | **0** imperatives; **1** legitimate quoted `ты` (`home/professor-mari.md:131`) ✓ |
| 11 | Cyrillicized product names (`Маринар`, `Термукс`, `Андроид`, `Ноудл`, `СиллиТаверн`) | 0 | **0** ✓ |
| 12 | Latin stem carrying a Cyrillic case suffix (`\b[A-Za-z]{3,}[а-яё]{1,4}\b`) | 0 | **0** ✓ |
| 13 | Unspaced en dash outside numeric ranges | 0 | **0** ✓ (4 unspaced, all ranges) |
| 14 | Bold EN label **translation-glossed** more than once in the same file | 0 | **0** ✓ — **but not naively greppable**, see §5 "A bold label's parentheses are not always a gloss" |
| 15 | Structural parity vs `en/`: file count, headings, code fences, link targets, table shapes | 125/125 | **125/125 filenames match `docs/` exactly**, 0 extra, 0 missing ✓ |
| 16 | Link text ↔ target H1 agreement | 0 paraphrases (PR #4281 drove this to zero; it degrades search ranking) | not re-run this cycle |
| 17 | `программа запуска` (use `скрипт запуска`) | 0 | **4** — residual F |
| 18 | `белый список` (use `список разрешенных адресов`) | 0 | **1** — residual G |
| 19 | `1,000` / `1.000` thousands forms | 0 | **0** ✓ |
| 20 | `таймаут` without hyphen | 0 | **0** ✓ (24 correct `тайм-аут`) |

**Checks 3–13 and 17–20 are the safely greppable ones.** Do **not** build a check by grepping a
banned alternate from the §3 table without its sense restriction — see the false-positive table at
the top of §3.

Check 15/16 are the pack-level gates PR #4281 ran via
`node scripts/docs-i18n/build-manifest.mjs ru` + `validate-pack.mjs ru` and `pnpm regression:docs`.

### Known pack residuals

Documented, **not** silently fixed. Each is a real deviation from a rule above; fix them in a
deliberate, reviewable change rather than as a drive-by.

**A. Em dash `—` in Russian prose (6 lines, 13 characters, rule §4).**

| Location | Count | Note |
|---|---|---|
| `TROUBLESHOOTING.md:260` | 1 | `чаты выглядят пустыми — данные по-прежнему лежат на диске` |
| `TROUBLESHOOTING.md:417` | 1 | ``root с `SYS_ADMIN` — широкое повышение прав`` |
| `agents/custom-agents.md:113` | 1 | `**Image Connection** — переопределяет подключение` |
| `agents/custom-agents.md:114` | 1 | `**Camera button** — немедленно создает изображение` |
| `development/file-storage.md:31` | **6** | one very long paragraph; the dashes head a run of appositive `— по чату; … — по персонажу; …` clauses. Rewriting it needs care, not a character swap |
| `extending/personal-extensions.md:67` | **3** | `` `kind: "menu-item"` — действие в меню Extensions ``, plus two more in the `button` / `menu-item` / `panel` field run |

`lorebooks/entries.md:189` holds the 14th em dash but is **not** a residual: it sits inside an
English in-fiction `Content:` literal, which stays English by design (§6).

**B. `ё` outside the allowed exceptions (9 words, 2 files, rule §4).**

- `agents/built-in-agents.md:153` — `Ведёт`, `завершённые`
- `agents/built-in-agents.md:155` — `передаёт`
- `agents/built-in-agents.md:161` — `остаётся`, `сохранённым`
- `prompts/macros.md:42`, `:74` — `её` (×2)
- `prompts/macros.md:194` — `нулём`
- `prompts/macros.md:236` — `своё`

**C. `сеттинг` (1 occurrence, rule §3).**
`agents/hierarchical-maps.md:112` — `для многоразовых фанатских миров, сеттингов кампаний,
подземелий…`. The ruling is `setting → мир`; this line reaches for a second word to avoid repeating
`миров` in the same clause. A fix must rewrite the clause, not just swap the word.

**D. Menu-path separator is inconsistent (3 variants, rule §4).**
`→` 80× (majority, correct), `->` 51×, `**X** > **Y**` 44×. Examples:
`appearance/appearance-settings.md:3` (`**Settings -> Appearance**`),
`extending/personal-extensions.md:180` (`**Settings** > **Advanced** > **Danger Zone**`),
`CONFIGURATION.md:31` (`**Settings** (настройки) **→ Advanced → Danger Zone**`).
Normalizing to `→` is a mechanical, low-risk sweep — but it edits ~95 lines, so it deserves its own
change.

**E. Ellipsis in verbatim UI strings — RESOLVED 2026-09-01 (rule §4).**

The earlier ruling deferred this as "requires checking the app". It has now been checked, against
`packages/client/src/localization/locales/en.json`. The app really does use both forms, and the pack
is **correct nearly everywhere** — this was mostly a false alarm:

| Pack string | Pack form | `en.json` key | App form | Verdict |
|---|---|---|---|---|
| `**Switching…**` `UPGRADING.md:135` | U+2026 | `ui.panels.advancedsettings.switching` | `Switching…` | ✓ |
| `**Checking…**` `:139` | U+2026 | `settings.notifications.customSound.status.loading` | `Checking…` | ✓ |
| `**Refreshing…**` `:182` | U+2026 | `ui.panels.advancedsettings.refreshing` | `Refreshing…` | ✓ |
| `**Creating backup…**` `:27` | U+2026 | `ui.panels.advancedsettings.creatingBackup` | `Creating backup…` | ✓ |
| `"Opening chat..."` `TROUBLESHOOTING.md:330` | ASCII | `ui.chat.chatarea.openingChat` | `Opening chat...` | ✓ |
| `**Importing...**` `appearance/chat-backgrounds.md:28` | ASCII | `ui.botBrowser.detailview.importing` | `Importing...` | ✓ |
| `**Search models…**` `connections/connecting-to-a-provider.md:34` | U+2026 | `ui.connections.connectioneditor.searchModels` | `Search models…` | ✓ |
| `**Autosaving…**` `lorebooks/entries.md:31` | U+2026 | `ui.lorebooks.expandeddrawer.autosaving` | `Autosaving…` | ✓ |
| `**Search entries…**` `lorebooks/entries.md:13` | U+2026 | `chat.settings.inlineLorebook.search` | `Search entries…` | ✓ |
| **`**Updating...**` `UPGRADING.md:164`** | **ASCII** | `ui.panels.advancedsettings.updating` | **`Updating…`** | ✗ **defect** |

**One real fix:** `UPGRADING.md:164` should read `**Updating…**` with U+2026. The context is
unambiguous — the surrounding sentences document the **Apply Update** button on the Advanced
Settings panel (`:151`, `:156`, `:164`), and every sibling progress string on that panel
(`switching`, `refreshing`, `creatingBackup`) uses U+2026. The ASCII `Updating...` in `en.json`
belongs to `ui.game.gamesessionhistory.updating`, a different screen.

The rule itself stands and is now evidence-backed: **look the string up in `en.json`; never
normalize the pack to one form.**

One loose end left for a maintainer: several search placeholders are written with a trailing
`...` in the pack (`**Search characters...**` `chats/group-chats.md:19`,
`**Search conversations...**` `chats/managing-chats.md:92`) while the nearest `en.json` values
(`search.panels.characters`) carry **no** ellipsis at all. The component may append one at render
time. This needs a look at the running app, not at `en.json` — do not "fix" these from the locale
file alone.

**F. `программа запуска` for the launcher (4 occurrences, rule §3).**
The pack's term is `скрипт запуска` (56×). These four reach for a different noun:
`TROUBLESHOOTING.md:45` (a heading — `### Обновление программы запуска до pnpm 10.34.5`), `:47`,
`:262`, `UPGRADING.md:186`. The heading is the awkward one: changing it changes an anchor, so
check inbound links before editing.

**G. `белый список` (1 occurrence, rule §3).**
`development/personal-extensions.md:22` — `ограниченные поля из белого списка`. Note the pack term
`список разрешенных адресов` is scoped to *addresses* and does not fit a **field** allowlist, so
this needs a phrasing decision (`список разрешенных полей`?), not a find-and-replace.

**H. Thousands separator applied inconsistently in one row (rule §4).**
`conversation/table-games.md:109` carries `**1000**` and `1 000 000` in the same table row.

---

## Change log

| Date | Change |
|---|---|
| 2026-09-01 | Second-generation glossary re-derived from the shipped pack, PR #4281, and the 2026-09-01 mirror-cycle notes, after the originals were lost to temp-directory cleanup. Added measured residual inventory (A–E), the `ru.json` 1.4%-coverage finding behind the byte-exact UI rule, and the LRU negative finding. |
| 2026-09-01 | **Verification pass against the 125 shipped files.** Corrected two rulings that the pack contradicts: `least-recently-used` and the noun `вытеснение` are both **attested** at `CONFIGURATION.md:155` (the earlier "no precedent" findings were MSYS-grep false negatives). Resolved the ellipsis ruling against `en.json` — the pack is correct except `UPGRADING.md:164`. Added sense-scoping to §3 with a measured false-positive table, after finding that 30 of the 88 "banned" alternates are live pack vocabulary in other senses (`подсказка` 103×, `запрос` 241×, `лорбука` 150× genitive …). Removed the wrong bans on `профиль настроек` (a distinct feature), `помощник` (the pack's own gloss for *agent*) and `ассистент` (the message role); added rows for tooltip, placeholder, settings profile, assistant role, and vectorization. Upgraded both §7 tooling traps from recorded rulings to **verified** with reproductions. Fixed citations for `widget`, `log`, `allowlist`, gender-neutrality, and the thousands separator; corrected the capitalized-`Вы` count (2 → 39, all sentence-initial), the em-dash per-line counts, and the `§8` cross-references (residuals live in §7). Added residuals F–H and checks 17–20. |

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, translate a native NovelAI character caption as
**описание персонажа**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.
