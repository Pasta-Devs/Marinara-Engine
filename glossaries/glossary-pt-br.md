# Marinara Engine — glossário do pacote de documentação `pt-br`

**Português do Brasil · docs-i18n language pack `pt-br` · label `Português (Brasil)`**

## Provenance

This is the **second-generation glossary** for the `pt-br` documentation pack. It was
**re-derived on 2026-09-01**, after the original working glossaries were lost to
temp-directory cleanup, from three sources in authority order:

1. **The shipped pack as ground truth** — `pt-br/` on the `docs-i18n` branch, 125 guides
   (125 `.md` files) plus `manifest.json`, 126 files in all, mirroring `docs/` on `staging`
   1:1 (same 125 paths, no orphans either way). Every prescriptive
   rule below was re-checked against those bytes with `grep`; each terminology row cites a
   pack file that shows the term in use.
2. **The pack's shipping PR decision write-up** — `Pasta-Devs/Marinara-Engine` PR **#4229**
   ("Brazilian Portuguese documentation pack", language #5 after `es`/`de`/`fr`), plus the
   per-language conventions it landed in `CONTRIBUTING.md` line 237.
3. **The 2026-09-01 mirror-cycle terminology notes** (`prd-notes-pt-br.md`), whose rows are
   themselves in the pack now and are cited as pack evidence below.

Where a rule comes from a **recorded maintainer or cycle ruling** that the pack cannot
mechanically show — process decisions, QA procedure, the history behind a reversed rule —
it is tagged **[RULING]** and carries no evidence citation. Everything else is verified
against the pack as shipped. Where the ledger and the pack disagree, the **pack wins** and
the disagreement is written down rather than quietly harmonised (see §7.3 and §7.4).

Evidence paths are relative to the pack root (`pt-br/`). Line numbers are from the shipped
bytes; treat them as pointers, re-grep the string if a file has moved on.

**Counting convention.** Unless a row says otherwise, a count is *case-insensitive, whole
word, singular + plural*, where "whole word" means the match is not flanked by
`[A-Za-zÀ-ÿ]` — an ASCII-only `\b` silently drops accented words (§7.2). Counts were
re-measured on 2026-09-01 with a Python scan over all 125 `.md` files; where this
re-measure disagreed with the ledger, the re-measure is what is written down.

---

## 1. Register & address

| Rule | Verified how |
|---|---|
| **Address the reader as `você`.** Never `tu`, never `vós`, never `o senhor / a senhora`. | 1 309 hits for `você`; **0** for `tu`, `teu`, `tua`, `vós`, `o senhor`. |
| **Imperatives take the 3rd-person (você) form**: `Clique`, `Abra`, `Veja`, `Use`, `Escolha`, `Defina`. The `tu` imperative (`Clica`, `Abre`, `Vê`) is banned. | `Clique` 392 · `Abra` 324 · `Veja` 237 · `Use` 331 · `Escolha` 161 · `Defina` 46; `Clica` 0, `Vê` 0. `installation/android-termux.md:90` shows the canonical shape. |
| **Informal but not chatty.** No slang, no exclamation marks in instructions, no `nós` cheerleading (`vamos configurar…`). `vamos` survives only inside quoted example text — in-fiction dialogue or an example the reader is told to type. | `vamos` **5** hits, every one quoted: `agents/hierarchical-maps.md:444,445,806` ("Vamos para a Kitchen"), `lorebooks/entries.md:97` (`> **John:** Vamos visitar o castelo do Vlad.`), `conversation/getting-started.md:117` ("vamos jogar uno", an example the reader types). `iremos` 0. |
| **Possessives stay light.** Prefer the bare noun over `o seu`/`a sua` where Portuguese does not need it; `seu`/`sua` is reserved for genuine reader-ownership ("os seus dados"). | Singular `seu` 166 · `sua` 191; plural `seus` 100 · `suas` 47. `data/where-data-is-stored.md:1` "Onde Marinara salva os seus dados" vs `CONFIGURATION.md:3` "A maioria dos usuários nunca precisa desta página." |
| **Gender-neutrality: default generic masculine, no typographic workarounds.** Write `o usuário`, `os usuários`. Banned: `usuário(a)`, `usuári@`, `usuárixs`, `todes`, `ele/ela` slashes. | `o usuário` 22; `usuária` 0, `usuário(a)` 0, `@s` 0, `xs` 0, `ele/ela` 0, `dele/dela` 0. |
| **Avoid gendering the reader at all** where possible — the docs address actions, not people, so the question rarely arises. | Whole-pack: no reader-directed past participle agreeing in gender. |
| **Brazilian vocabulary only, European Portuguese banned.** `arquivo` (828) not `ficheiro`; `salvar` (525 across all `salv-` forms, 84 of them the bare infinitive) not `guardar`-as-save; `tela` (212) not `ecrã`; `usuário` (141) not `utilizador`; `celular` (109) not `telemóvel`; `gerenciar` (`gerenci-` 84) not `gerir`; `clique em` not `carregue em`. | `ficheiro` 0 · `ecrã` 0 · `utilizador` 0 · `telemóvel` 0 · `aceder` 0 · `gerir` 0 · `carregar em` 0 · `rato` 0. `CONFIGURATION.md:3`, `chats/managing-chats.md:1` ("Como gerenciar a lista de chats"). |
| **`guardar` is allowed only in its Brazilian sense "to store / to hold"**, never as the Save command. Save is always `salvar`. | `guardar` (infinitive) 7 hits, all store-sense. `agents/memory.md:71` "Marinara guarda blocos de memória"; `CONFIGURATION.md:71` "O arquivo `.env` guarda dados". Save sense uses `salvar`: `characters/personas.md:133` "Toda vez que você salva uma mudança". |
| **Current *Acordo Ortográfico* spelling.** No trema, no pre-reform accents. | `ü` 0 · `freqüe` 0 · `conseqüe` 0 · `idéia` 0 · `pára` 0 · `vôo` 0 · `pólo` 0. |
| **False-friend guardrails.** `library` → `biblioteca` (never `livraria` = bookshop); `actually` → `na verdade` (never `atualmente`, which correctly means *currently*); `eventually` → `com o tempo` / `mais tarde` (never `eventualmente`, which means *occasionally*). | `biblioteca` 130, `livraria` **0**; `eventualmente` **0**; `atualmente` 1, in its correct *currently* sense (`extending/writing-personal-extensions.md:203` "atualmente `1`"). `lorebooks/overview.md:25` "a biblioteca onde você navega". These three pairs are all that survived of the original anti-calque table (§7.5); rebuild the rest from sweeps. |
| **Tone: explain the jargon inline the first time.** The pack consistently defines a loanword in the same sentence it introduces it. | `lorebooks/overview.md:9` "insere o texto daquela entrada no prompt. O prompt é o conjunto de instruções ocultas e de histórico…"; `agents/knowledge-sources.md:7` "Um token é um pedacinho de texto que a IA lê". |

---

## 2. Product, feature & mode names

### 2.1 The product name and its article — **MAINTAINER RULING**

**[RULING] The maintainer-ruled standard is `do Marinara` / `no Marinara` — with the
article.** This *reversed* the original glossary's no-article rule; the reversal itself is a
recorded ruling with no in-pack artifact, but the shipped outcome is verifiable and
one-sided:

| Form | Hits | Verdict |
|---|---|---|
| `do Marinara` | 258 | **standard** |
| `no Marinara` | 62 | **standard** |
| `de Marinara` (uncontracted) | 2 | residual, both in the same fixed formula (see below) |
| `em Marinara` | 0 | — |
| `do Marinara Engine` / `no Marinara Engine` | 92 / 28 | **standard** |
| `de Marinara Engine` | **0** | — |

Precise statement of the rule as the pack actually applies it:

1. **`de` and `em` always contract**: `do Marinara`, `no Marinara`, `do Marinara Engine`,
   `no Marinara Engine`. Evidence: `agents/agents-overview.md:3`, `appearance/appearance-settings.md:3,50`, `lorebooks/overview.md:3` ("o que é um lorebook
   **no** Marinara Engine"), `development/file-storage.md:3` ("a arquitetura de persistência
   local **do** Marinara Engine").
2. **Subject position stays bare**: `Marinara verifica…`, `Marinara aceita apenas…`,
   `Marinara escolhe sozinho…`. Sentence-initial bare `Marinara` **266** vs sentence-initial
   `O Marinara` **10** (42 hits of a standalone `o/O Marinara` in any position).
   Evidence: `CONFIGURATION.md:20,55`, `characters/personas.md:7`.
3. **Other prepositions stay bare**: `com Marinara` 17 vs `com o Marinara` 1;
   `sobre Marinara` 1 vs `sobre o Marinara` 0. Evidence: `FAQ.md:3` "sobre Marinara Engine".
4. **The one fixed uncontracted formula is the first-mention alias**, which is idiomatic and
   must be left alone: `agents/memory.md:7` "Marinara Engine (chamado **de Marinara** daqui
   em diante)"; `installation/macos-linux.md:3` "(chamado só **de Marinara** daqui em
   diante)". This is `chamar de X`, not a missing article.

So the QA check is **not** "insert an article everywhere" — it is "`de/em` + Marinara must
never appear uncontracted outside the `chamado de` formula".

### 2.2 Names that stay English

| Kept in English | Evidence |
|---|---|
| **Mode names** — `Conversation Mode` (142), `Roleplay` (411), `Game Mode` (258). Never `modo Conversa`, `Modo Jogo`, or `Interpretação de papéis` *as the mode's name*. | H1s: `conversation/getting-started.md:1` "Conversation Mode: primeiros passos"; `game/combat.md:1` "Game Mode: combate". `modo Conversa` 0, `Modo Jogo` 0. Also PR #4229 and `CONTRIBUTING.md:237`. Two documented nuances below. |
| **Nuance — `Modo Conversation` (4 hits)** mirrors English's *generic lowercase* "Conversation mode", which is a descriptor, not the frozen product name. Leave it; do not "fix" it to `Conversation Mode`. | `development/architecture-map.md:117`, `development/frontend.md:247,618` (EN: "### Conversation mode"), `game/storyboard.md:319` (EN: "Conversation is not supported"). |
| **Nuance — `interpretação de papéis` (2 hits)** is allowed as a one-time parenthetical *gloss* of `Roleplay`, never as a replacement name. | `chats/group-chats.md:9` "**Roleplay** (interpretação de papéis)"; `game/party-and-npcs.md:5` "um RPG (jogo de interpretação de papéis)". |
| **`World Maps`** — the user-facing feature name, matching the English H1 exactly. | `agents/hierarchical-maps.md:1` "# World Maps: instalação, criação e viagem" (EN: "# World Maps: Setup, Authoring, and Travel"); `World Maps` 34 hits. |
| **`Hierarchical Maps`** — retained only where English retains it, i.e. the developer PRD. | `development/hierarchical-locations-prd-v3.md:1` "# Hierarchical Maps e contexto espacial V3" (EN: "# Hierarchical Maps and Spatial Context V3"). |
| **`Haptic Feedback`** — the *feature and agent name* stays English; never `retorno háptico`. **But `feedback tátil` is the pack's descriptive common noun for the thing itself** and is correct where English uses lowercase "haptic feedback". | `Haptic Feedback` 13, `retorno háptico` **0**, `feedback tátil` **7** — all in `integrations/haptic-feedback.md:5,7,11,15,30,102` and its intro line 3, e.g. `:5` "## O que é feedback tátil". Name form: `integrations/haptic-feedback.md:1` "# Configuração do Haptic Feedback"; `agents/built-in-agents.md:244` "### Haptic Feedback". |
| **Named agents, packages and surfaces** — `Professor Mari` (93), `Noodle` (205), `Agent Suite` (9), `Danger Zone` (23), `Music DJ`, `Beholder`, `Card Evolution Auditor`, `Storyboard`, `Support Diagnostics`, `Illustrator`. | `agents/approvals-and-agent-suite.md:3,40`; `TROUBLESHOOTING.md:330`; `home/professor-mari.md`. |
| **Third-party names** — `Termux`, `Android`, `Docker`, `Podman`, `Node`, `F-Droid`, `SillyTavern`, `Spotify`, `Giphy`, `Home Assistant`, `Intiface`. | `installation/android-termux.md:11`; `installation/containers.md`. |

**[RULING]** The English resolution for `Hierarchical Maps` and `Haptic Feedback` was decided
*per UI evidence*. That evidence still holds and is checkable: `pt-BR.json` is a **partial
locale** (136 lines against `en.json`'s 9 127) and contains **no** key for either feature, so
a Brazilian user sees those controls in English. Path:
`packages/client/src/localization/locales/pt-BR.json`.

### 2.3 Carrier nouns and gender of the frozen names

Frozen English names take a Portuguese carrier noun or article that fixes their gender:

- `o painel **Lorebooks**`, `o painel **Personas**` — `lorebooks/overview.md:23`,
  `characters/personas.md:9`.
- `a janela **Review Character Card Updates**` — `agents/approvals-and-agent-suite.md:40`.
- `o botão **Apply Update**`, `o botão **Save**` — `installation/windows.md:204`,
  `characters/creating-and-editing-characters.md:29`.
- `a opção **Enable Agents**`, `a seção **Updates**`, `a aba **Advanced**` —
  `agents/agents-overview.md:42`, `installation/macos-linux.md:229`.
- `o agente **Combat**`, `o agente **Card Evolution Auditor**` —
  `roleplay/combat-encounters.md:9`, `agents/approvals-and-agent-suite.md:40`.
- **`Professor Mari` is feminine, with no exceptions in the shipped bytes.**
  Feminine-marked forms total **41 across 17 files**: bare `a Professor Mari` 19,
  `da Professor Mari` 18, `à Professor Mari` 2, `pela Professor Mari` 2. Masculine forms —
  `o` / `do` / `ao` / `pelo Professor Mari` — are **0**. `Professor Mari` unmarked (no
  article) is 93 hits overall. Evidence: `CONFIGURATION.md:63,320,321,322`,
  `home/professor-mari.md:3,5,15`, `extending/personal-extensions.md:3`,
  `conversation/profiles.md:30,32,36`.

---

## 3. Core terminology

Table columns: English term · this pack's term · banned alternates · one pack file that
shows it.

**How to read the "Banned alternates" column.** A word listed as banned is banned *for this
meaning only*. Many of these strings do occur in the pack in an unrelated sense, and a naive
grep will light them up — the "legitimate other sense" notes are there so a sweep does not
file a false regression. Where the pack genuinely contradicts its own rule, the row says so
and points at §7.3.

| English | `pt-br` term | Banned alternates | Evidence |
|---|---|---|---|
| prompt | **o prompt** (m., loanword, plural `os prompts`) | `a prompt`, `solicitação`, `comando de entrada`. Legit other sense: `solicitação` (9) = an HTTP request or a credential prompt — `CONFIGURATION.md:140`, `installation/containers.md:83` | `lorebooks/overview.md:9`; `prompt(s)` 914; `o/os prompt(s)` 152 vs feminine article **0** |
| token | **o token** (m., `os tokens`) | `a token`, `ficha`, `símbolo`. Legit other sense: `ficha(s)` (26) = poker chips and Game Mode character sheets, never a token — `conversation/table-games.md:109,112` | `agents/knowledge-sources.md:7` "Um token é um pedacinho de texto que a IA lê"; `chats/messages.md:95`; `token(s)` 171 |
| preset | **o preset** (m., `os presets`) | `predefinição` (**0**), `pré-ajuste` (**0**), `perfil` for a preset | `prompts/presets.md:88`; `preset(s)` 301; `o/os preset(s)` 53 vs feminine **0** |
| lorebook | **o lorebook** (m., `os lorebooks`) — alias **World Info** (13) given once, both names kept English | `livro de lore` (**0**), `a lorebook`, `enciclopédia` (**0**) | `lorebooks/overview.md:3,7`; `lorebook(s)` 706; `o/os lorebook(s)` 103 vs feminine **0** |
| character card | **o card de personagem** (m., loan `card`), plural `cards de personagem` | `cartão de personagem` (§7.3, residual 2). **Not banned:** `ficha de personagem` — that is the Game Mode party character sheet, a different object (`game/party-and-npcs.md:15,21`, `game/getting-started.md:115`) | `agents/agents-overview.md:9`; `agents/approvals-and-agent-suite.md:18`; `card(s)` 551, `card de personagem` 59 |
| card (UI panel/tile) | **o cartão** | `card` for a UI panel | `connections/local-self-hosted.md:79` "o cartão **Connection Tests**"; `extending/regex-scripts.md:134,136,138`; `media/scene-video.md:127,129`; `cartão/cartões` 14, of which 12 are UI cards and 2 are residual 2 |
| chat | **o chat** (m., `os chats`) | `a chat`, `conversa` when it means the record, `bate-papo` (**0**) | `chats/managing-chats.md:1`; `chat(s)` 2 435; `o/os chat(s)` 321 vs feminine **0** |
| conversation (the human sense) | **a conversa** — the ongoing exchange between reader and character, and group talk. Never the stored chat record | using `conversa` for the chat object | `chats/group-chats.md:1` "Chats em grupo e conversas em grupo"; `chats/connected-chats.md:15` "uma conversa paralela"; `agents/built-in-agents.md:153` "examina a conversa em lotes"; `conversa(s)` 75, of which ~49 carry a determiner |
| message | **a mensagem** (f.) | `msg` (**0**), `recado` (**0**) | `chats/messages.md:1` "Ações de mensagem: editar, excluir, swipe e regenerar"; `mensagem/mensagens` 850 |
| swipe | **o swipe** (m., verb `dar swipe` / noun kept) | `deslizar` as the noun (1 residual, §7.3), `variação` for a swipe. Legit other sense: `variação` (2) = a Named prompt option — `agents/custom-agents.md:147,149` | `chats/messages.md:1`; `TROUBLESHOOTING.md:260`; `swipe(s)` 111 |
| turn | **o turno** | `rodada` **in the prompt/chat sense**. Legit other sense: `rodada` (18) = a combat round, a poker round, a tool-call round — `game/combat.md:22,26,30`, `CONFIGURATION.md:215` | `agents/knowledge-sources.md:7` "as entradas a cada turno desperdiça tokens"; `turno(s)` 198 |
| agent | **o agente** (m.) — but the panel/product name stays `**Agents**` | `assistente` for an Agent, `bot` for an Agent. Legit other senses: `assistente` (91) = the assistant chat role, a setup wizard, or Professor Mari; `bot` (13) = `Bot Browser`, `/api/bot-browser/`, a table-game bot | `agents/agents-overview.md:1` "Agentes: ajudantes de IA para os seus chats"; `agente(s)` 727 |
| connection | **a conexão** (f.) | `ligação`, `conta`, `integração` for an AI connection. Legit other senses: `ligação` (35) = a map link or a connected-chat link; `integração` (50) = a package's integration type | `connections/connecting-to-a-provider.md`; `agents/custom-agents.md:162`; `conexão/conexões` 592 |
| provider (AI) | **o provedor** | `fornecedor` (**0**), `provedora` (**0**) | `connections/providers-reference.md:15`; `provedor(es)` 373 |
| launcher | **o inicializador** | `lançador` (3 residual, §7.3), `launcher` untranslated in prose | `CONFIGURATION.md:71,88,142`; `TROUBLESHOOTING.md:324`; `inicializador(es)` 73. `launcher` has exactly 3 hits and all three are the script path `scripts/protect-launcher-data.mjs` (`TROUBLESHOOTING.md:270,277`, `development/file-storage.md:31`) |
| launch script | **o script de inicialização** | `script de lançamento` (**0**) | `FAQ.md:9`; `installation/macos-linux.md:3` |
| update (noun) / apply an update | **a atualização** / **aplicar a atualização** — the button stays `**Apply Update**` | `upgrade` (**0**), `atualizar` as a noun | `installation/android-termux.md:90`; `installation/windows.md:204`; `UPGRADING.md:1` "Atualizando Marinara Engine"; `atualização/atualizações` 210 |
| release channel | **o canal (de versão)** | `faixa`, `trilha`, `canal de lançamento` for the release channel. Legit other senses: `faixa` (95) = a CIDR range, a valid value range, a HUD/safe-area strip; `trilha` (47) = `trilha de navegação` (breadcrumb), `trilha musical`, `trilha do catálogo` | `CONFIGURATION.md:237,238`; `installation/windows.md:201`; `installation/macos-linux.md:231`; `UPGRADING.md:128,135`; `canal/canais` 26 |
| channel (Discord) | **o canal do Discord** | `sala`, `servidor` | `chats/connected-chats.md:83`; `integrations/discord-mirror.md:3` (8 of the 26 `canal` hits) |
| channel (network port sense) | **o canal numerado** | reusing `canal` bare where `porta` is meant | `connections/local-self-hosted.md:37` "A porta é o canal numerado que o servidor…" |
| breadcrumb (Maps) | **a trilha de navegação** | `migalhas`, `breadcrumb` | `agents/hierarchical-maps.md:23,41,377,487,605` |
| catalog track | **a trilha do catálogo** | `canal do catálogo` | `CONFIGURATION.md:20` |
| editor working copy (Maps/PRD) | **a cópia de trabalho** — a *local, unsaved* editor buffer, not a Git tree | using it for a Git checkout | `agents/hierarchical-maps.md:162,186,198,265,702`; `development/hierarchical-locations-prd-v3.md:126,880,987`; 12 hits, none of them Git |
| checkout (Git working tree) | **`checkout` stays English in prose**; the install itself is **a instalação via Git**, and the dev tree is **a cópia de desenvolvimento** | translating `git checkout` in a command; `clone` as a Portuguese noun for the tree | `TROUBLESHOOTING.md:39` "Se o próprio checkout não conseguir atualizar"; `UPGRADING.md:33,37`; `installation/containers.md:24` "um checkout do Marinara Engine". `instalação via Git` 5 (`CONFIGURATION.md:237`, `UPGRADING.md:145,169,196`); `cópia de desenvolvimento` 1 (`CONFIGURATION.md:238`). `clone` (19) is legitimate as `git clone` and as the UI button **Clone** (`lorebooks/entries.md:401`, `media/style-profiles.md:55,58`) |
| wake lock | **o wake lock** — untranslated, **unbolded**, lowercase | `bloqueio de ativação` (**0**), `trava de vigília` (**0**), bolding it as if it were a UI label | Exactly 2 hits: `TROUBLESHOOTING.md:324` "solicita um wake lock do Android" and `:330` |
| battery optimization | **a otimização de bateria** | `otimização da bateria` (**0**), `economia de bateria` (**0**) | `TROUBLESHOOTING.md:326,332`; 2 hits |
| background activity / run in background | **a atividade em segundo plano** / **rodar em segundo plano** | `plano de fundo` for process background, `background` in prose. Legit other senses: `plano de fundo` (144) = a wallpaper or scene background; `background` (89) = English UI/CSS/env names such as **Background Change**, `--background`, `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `TROUBLESHOOTING.md:326,332`; `em segundo plano` 23 |
| foreground | **primeiro plano** (`trazido para primeiro plano`, `manter em primeiro plano`) | `frente`, `foreground` in prose. Legit other sense: `foreground` (3) = the CSS tokens `--foreground`, `--primary-foreground`, `--muted-foreground` in `appearance/custom-css-themes.md:75,77,81` | `TROUBLESHOOTING.md:328` (H3) and `:332`; `primeiro plano` 3 |
| frozen (process) | **congelado** / **o congelamento** | `travado` for the OS-frozen process state. Legit other senses: `travado` (11) = a *locked* setting or panel (`CONFIGURATION.md:94,217`, `game/hud-widgets.md:54`) or a *stuck* page/command (`UPGRADING.md:180`, `home/professor-mari.md:55`) | `TROUBLESHOOTING.md:330` "o processo do host está **congelado**"; `congelado` 21, `congelamento` 3 |
| crash | **a falha** / **cair por falha** | `crashar` (**0**), `quebrar` for a crash. Legit other sense: `quebrar` (6) = to break in general — `home/welcome.md:49` "Se algo quebrar", `development/ios-pwa-safe-area.md:57` | `TROUBLESHOOTING.md:330` "e não caiu por falha"; `development/file-storage.md:35` "recuperação após falha"; `falha(s)` 85 |
| phone vendor / OEM | **o fabricante do celular** | `fornecedor`, `OEM` (**0**) | `TROUBLESHOOTING.md:324,326,332`; `fabricante` 3 |
| memory / in memory | **a memória** / **em memória**, **na memória** | `na memória RAM`, `residente` (**0**) | `CONFIGURATION.md:155` "mantém em memória"; `development/file-storage.md:31`; `characters/bot-browser.md:116` "guardados apenas na memória do servidor"; `memória(s)` 87, `em/na memória` 17 |
| phone memory (OOM) | **a memória do celular** | `RAM do aparelho` | `CONFIGURATION.md:155`; `TROUBLESHOOTING.md:314` "o Android ficou sem memória" |
| least-recently-used | **o … usado menos recentemente** | `menos usado recentemente`, `LRU` bare | `CONFIGURATION.md:155` (the one hit); built on `chats/managing-chats.md:96,97` "atividade mais recente" / "atividade mais antiga" |
| evict / drop from memory | **descartar** — `descartado da memória`, `desativa o descarte` | `expulsar` (**0**), `remover da memória` (implies disk deletion) | `CONFIGURATION.md:155`; root shared with `development/file-storage.md:35`, `lorebooks/import-export.md:45`; `descart-` forms 46 |
| cache | **o cache** (m.) — `guardar em cache`, `em cache`, `acertos de cache` | `memória temporária` (**0**), `a cache` | `CONFIGURATION.md:322`; `agents/approvals-and-agent-suite.md:3,95`; `chats/messages.md:95`; 47 hits |
| backup | **o backup** (m., `os backups`) — verb `fazer backup` | `cópia de segurança` (**0**), `salvaguarda` (**0**) | `data/backup-and-restore.md:1` "Fazer backup e restaurar Marinara"; 143 hits |
| snapshot (version history / state) | **o instantâneo** | `snapshot` in user-facing prose, `foto`, `captura` | `characters/creating-and-editing-characters.md:128,141,143`; `characters/personas.md:133`; `chats/branches.md:24`; 12 hits |
| snapshot (English, byte-exact) | left as `snapshot` **only** inside developer-internals docs, English UI labels, and quoted UI strings | translating a quoted string; using `snapshot` in a user-facing guide | 45 hits, fully accounted for: 43 under `development/` (36 of them in `hierarchical-locations-prd-v3.md`), the label **Stats Snapshot** at `game/sessions-and-saves.md:72`, and the quoted string `"Restored the previous app data snapshot."` at `home/professor-mari.md:86` |
| extension | **a extensão** (f.) — the product surface stays `**Personal Extensions**` / `**External Extensions**` | `plugin`, `add-on` (**0**) for Marinara extensions. Legit other sense: `plugin` (5) = a Tailwind/Fastify/PostCSS plugin or a Termux plugin app | `CONFIGURATION.md:57,59`; `extensão/extensões` 102; `extending/personal-extensions.md:3` |
| NPC | **o NPC** (m., `os NPCs`) — the term itself is never translated | `PNJ` (**0**), or replacing `NPC` with `personagem não jogável`. **First-mention gloss is allowed** and the pack uses it: `NPC (personagem não jogável)` | `game/party-and-npcs.md:1,3,65,99`; `NPC(s)` 49. The gloss appears in 7 files — `agents/built-in-agents.md:111`, `game/dice-and-skill-checks.md:68`, `game/getting-started.md:11`, `game/party-and-npcs.md:3`, `game/sessions-and-saves.md:70`, `integrations/discord-mirror.md:47`, `media/tts-setup.md:89` |
| persona | **a persona** (f.) | `o persona` (**0**), `perfil` for the persona object. Legit other sense: `perfil/perfis` (274) = the separate Profiles features — Conversation Mode profiles, settings profiles, style profiles, Noodle profiles | `characters/personas.md:3,7,9`; `characters/choosing-your-persona.md:3`; `a/as persona(s)` 97 |
| app / application | **o aplicativo** — enforced everywhere in Portuguese prose | **`app`** as a Portuguese noun | `aplicativo` 443. `app` has **73** hits and every one is non-prose: a path or identifier (`/app/data`, `App.tsx`, `app.ts`, `--sidebar`-style code), an English UI label (**Refresh App**, **App Style**, **App Behavior**, **Install App**), the phrase `Progressive Web App`/PWA, a quoted English string, the CSS class `mari-app`, or the fixed technical term `app shell` (§7.3, residual 6) |
| user | **o usuário** | `utilizador` (**0**) | `CONFIGURATION.md:3,152`; 141 hits |
| file / folder | **o arquivo** / **a pasta** | `ficheiro` (**0**), `diretório` in user-facing prose (6 residual, §7.3) | `CONFIGURATION.md:71`; `data/where-data-is-stored.md:11`; `arquivo(s)` 828, `pasta(s)` 426 |
| save (verb) | **salvar** | `guardar` as save, `gravar` (1, and it means "to write to disk") | `characters/personas.md:133`; `salv-` forms 525 (infinitive `salvar` 84) |
| delete | **excluir** | `deletar` (**0**); `apagar` for user data (6 residual, §7.3) | `data/clearing-data.md:3` "aprende a excluir os seus dados"; `excluir` 118, all `exclu-` forms 212 |
| screen | **a tela** | `ecrã` (**0**) | `agents/custom-agents.md:33`; `tela(s)` 212 |
| library (of characters/lorebooks) | **a biblioteca** | `livraria` (**0**) | `lorebooks/overview.md:23,25`; `characters/library-organization.md`; 130 hits |
| toggle | **o botão liga/desliga** | `alternador` (**0**); `interruptor` and `botão de alternância` (4 residual, §7.3). Legit other senses: `toggle` (9) and `switch` (15) only ever appear as code identifiers or English UI labels (**Switch branch**, **Boolean toggle**) | `agents/memory.md:71`; `extending/regex-scripts.md:134`; 139 hits |
| dropdown | **o menu suspenso** | `lista suspensa` (**0**), `dropdown` in prose. Legit other sense: `dropdown` (1) is the English UI option label **Dropdown** at `prompts/preset-variables.md:33` | `connections/connecting-to-a-provider.md:34`; `media/scene-video.md:127`; 96 hits |
| slider | **o controle deslizante** | `cursor deslizante` (**0**), `slider` in prose. Legit other sense: `slider` (2) appears only inside code blocks (`kind: "slider"`) | `appearance/appearance-settings.md:87,90,95`; 26 hits |
| tab | **a aba** | `separador` for a tab, `guia` (reserved for *guide*). Legit other sense: `separador` (3) = a separator character — `chats/messages.md:74`, `prompts/preset-variables.md:19` | `installation/macos-linux.md:229`; `extending/regex-scripts.md:136`; `aba(s)` 311 |
| guide (document) | **o guia** | `manual` as a noun for a guide. Legit other sense: `manual`/`manualmente` (130) = manual/by hand — `CONFIGURATION.md:37`, `FAQ.md:47` | `agents/agents-overview.md:3`; `guia(s)` 409 |
| checkbox | **a caixa de seleção** | `checkbox` (**0**) | `characters/bot-browser.md:72,77,81`; `data/clearing-data.md:44`; 22 hits |
| sidebar vs side panel | **a barra lateral** is the app rail with the tab icons; **o painel lateral** is the panel that opens inside it (Chat Settings, Agents, Personas). Both are correct — they are different objects | `sidebar` in prose. Legit other sense: `sidebar` (3) = the CSS tokens `--sidebar`, `--sidebar-border` and one ASCII layout diagram | `barra lateral` 30 — `lorebooks/overview.md:25`, `characters/creating-and-editing-characters.md:13`, `agents/hierarchical-maps.md:120`. `painel lateral` 34 — `agents/agents-overview.md:23,37`, `chats/group-chats.md:43,45` |
| slash command | **o comando de barra** | `comando slash` (**0**), `barra de comandos` (**0**) | `chats/slash-commands.md:1` "Referência de comandos de barra"; 27 hits |
| streaming | **o streaming** (m.) | `transmissão` for the token stream. Legit other sense: `transmissão` (1) = a broadcast, at `roleplay/getting-started.md:96` | `chats/sending-and-streaming.md:1` "Enviar mensagens e streaming"; `streaming` 36 |
| embedding (the object) | **o embedding** (m., `os embeddings`) | `incorporação` (**0**) as the noun | `agents/memory.md:71`; `lorebooks/semantic-search.md:11`; `embedding(s)` 118 |
| vectorizing (the action) | **a vetorização** / `vetorizado`, `vetorizada` — the *process* of producing embeddings, matching the **Vectorize** button | using `vetorização` for the embedding object | `lorebooks/semantic-search.md:75,88,96,104`; `connections/local-model.md:151`; `vetorização` 9 + `vetorizad-` 6 = 15 hits |
| tracker | **o tracker** (m.) | `rastreador` (**0**) | `roleplay/hud-and-trackers.md`; `chats/branches.md:24`; `tracker(s)` 158 |
| sprite | **o sprite** (m.) | `boneco` (**0**), `imagem de personagem` (**0**) | `characters/sprites.md:1` "Sprites de personagem (expressões e corpo inteiro)"; `sprite(s)` 268 |
| achievement | **a conquista** — the panel and button stay `**Achievements**` | `realização` (**0**), `troféu` for the achievement. Legit other sense: `troféu` (1) = the literal trophy icon at `home/achievements.md:15` | `home/achievements.md:13,15,25`; `conquista(s)` 29 |
| API key | **a chave de API** | `chave da API` (**0**), `API key` in Portuguese prose. Legit other sense: `API Key` (26) is the English UI field label and quoted English text | `conversation/emoji-stickers-gifs.md:79`; `connections/providers-reference.md:11`; `chave(s) de API` 105 |
| model | **o modelo** | `motor` for an AI model. Legit other sense: `motor` (12) = an *engine* — the sprite background-removal engine, the regex engine, the ONNX runtime, the game engine | `connections/providers-reference.md:15`; `modelo(s)` 683 |
| prompt override | **a substituição de prompt** — the UI section stays `**Prompt Overrides**` | `sobrescrita` **as the name of this feature** (**0**), `override` as a Portuguese noun. Legit other senses: `override` (39) is always an English UI name (**Scenario Override**, **Connection Override**, **Prompt Overrides**) or `docker-compose.override.yml`; `sobrescrit-` (7) is the ordinary verb "to overwrite" — `chats/chat-settings.md:51`, `home/professor-mari.md:90` | `prompts/prompt-overrides.md:3`; `development/noodle-internals.md:7,22`; 4 hits |
| unset (config default) | **não definido** — distinct from `vazio` (empty) and `desligado` (off) in the same table | using `vazio` for unset | 5 hits: `CONFIGURATION.md:155`, `:238` (`UPDATES_APPLY_DISABLED` default), `:280` "um `TZ=` vazio também conta como não definido"; `TROUBLESHOOTING.md:365`; `installation/android-termux.md:15` |
| timeout | **o tempo limite** / **tempo … esgotado** | `timeout` in prose. Legit other sense: `timeout` (27) appears only inside env-var names such as `CHAT_GENERATION_TIMEOUT_MS` | `CONFIGURATION.md:15,201`; `TROUBLESHOOTING.md:330` "tempo da requisição esgotado"; `tempo(s) limite` 31 |
| allowlist | **a lista de IPs permitidos** | `whitelist` (**0**), `lista branca` (**0**) | `REMOTE_ACCESS.md:1,3,85,87`; `FAQ.md:14,37`; `CONFIGURATION.md:12,110`; 28 hits |
| shard / sharded storage | **o fragmento** / **fragmentos identificados pela chave de propriedade**; the verb is **fragmentar** | `shard` as a Portuguese noun. Legit other sense: `shard` (4) appears only in code identifiers — the `unshard` command and `SHARD_KEY_COLUMNS` | `development/file-storage.md:31,35,64`; `data/where-data-is-stored.md:21`; `fragmento(s)` 9 |

---

## 4. Typography & punctuation

All figures below are whole-pack counts over the shipped bytes.

| Rule | Verified how |
|---|---|
| **Straight ASCII double quotes only** (`"…"`). Curly quotes `“ ” ‘ ’` and guillemets `« »` are banned — Portuguese typographic quotes are *not* used in this pack. | `“ ” ‘ ’` **0 occurrences**; `« »` **0**. `TROUBLESHOOTING.md:330` `"Opening chat..."`; `home/achievements.md:61`. Matches `CONTRIBUTING.md:237` ("straight quotes"). |
| **En dash `–` is the parenthetical dash**, spaced. Em dash `—` is not the house dash. | `–` 54 hits in 11 files (`lorebooks/entries.md:174,179,185`; `game/game-assets.md:95`; `agents/hierarchical-maps.md:613`); `—` only 7, in 4 files, all residual (§7.3, residual 1). `CONTRIBUTING.md:237` says "en dashes". |
| **Menu paths use `→`**, normally inside a single bold span, then one Portuguese gloss with the same arrows. 45 of the 82 arrows sit inside a bold span; the other 37 are in glosses, backticked location paths, or the four unbolded table cells noted below. | `→` 82 hits in 21 files. `agents/built-in-agents.md:3` `**Agents → Download Agents** (agentes → baixar agentes)`; `CONFIGURATION.md:31` `**Settings → Advanced → Danger Zone** (Configurações → Avançado → Zona de perigo)`. Non-menu uses that are correct: backticked Maps hierarchies (`agents/hierarchical-maps.md:389,513,705` — `` `Tower → Floor 7 → Alchemy Lab` ``) and "then" between two bold labels (`lorebooks/entries.md:377`). Unbolded menu paths inside table cells — `CONFIGURATION.md:243,316`, 4 arrows — are residual (§7.3, residual 9). |
| **No NBSP, no narrow NBSP, no soft hyphen, no ideographic space, no zero-width joiner.** Portuguese needs no pre-punctuation space. | U+00A0 **0**, U+202F **0**, U+2011 **0**, U+00AD **0**, U+3000 **0**, U+200B **0**, U+200D **0**. Also U+2212 (minus), U+2012, U+2015, U+2032: all **0**. |
| **Ellipsis: never author one.** `…` (U+2026, 15 hits in 8 files) and `...` (ASCII, 102 hits) appear **only** where they are copied byte-exact out of an English UI string, an English code/XML placeholder, or a path pattern that English also shows with an ellipsis. Do not normalise either direction. | `…`: UI labels at `UPGRADING.md:27,135,139,182`, `lorebooks/entries.md:13,31`, `characters/creating-and-editing-characters.md:29`, `connections/connecting-to-a-provider.md:34`, `data/backup-and-restore.md:30`; non-label but still English-mirrored at `TROUBLESHOOTING.md:275` (`` `messages.post-unshard-…` ``), `agents/built-in-agents.md:160` (`<memory_nags>…</memory_nags>`), `development/localization.md:51` (a Polish sample string). ASCII form at `TROUBLESHOOTING.md:330` `"Opening chat..."`, `characters/bot-browser.md:34,57,136` (**Search characters...**, **Importing...**). See §5.1 for why. |
| **Decimal comma, thousands period** — Brazilian convention, in prose and tables. | `connections/local-model.md:72,73,77` "cerca de 5,4 GB", "cerca de 3,6 GB"; `game/combat.md:43` "multiplica o total por 1,5"; `agents/built-in-agents.md:200` "16.384"; `conversation/table-games.md:109` "1.000". |
| **Never reformat numbers inside code, paths, versions, or IPs.** `192.168.1.42`, `0.0-1.0`, `7860`, `versionCode` stay byte-identical to English. | `FAQ.md:30` `http://192.168.1.42:7860`; `agents/built-in-agents.md:250` `0.0-1.0`. |
| **Percent sign is closed up**: `75%`, `250%`. | 65 closed-up hits; `appearance/appearance-settings.md:87,90` ("de 0% a 100%", "de 75% a 250%"). A digit followed by space-then-`%` occurs **0** times. |
| **Headings are sentence case in Portuguese**, with English proper names keeping their own capitalisation. | `chats/managing-chats.md:1` "Como gerenciar a lista de chats"; `game/combat.md:1` "Game Mode: combate"; `characters/sprites.md:1` "Sprites de personagem (expressões e corpo inteiro)". |
| **Bold is allowed inside headings** when the heading names a UI surface. | `lorebooks/overview.md:23` `## O painel **Lorebooks**`. |
| **List mechanics**: full-sentence bullets end with a period; label bullets use `- **Label**: gloss` or `- **Label** — gloss` and still end with a period. Numbered procedure steps end with a period. | `CONFIGURATION.md:22-29`; `agents/custom-agents.md:113,114`; `FAQ.md:13-30`. |
| **Colon before a code fence or a menu path**, not a comma. | `FAQ.md:15`; `installation/windows.md:204`. |
| **Files are LF, UTF-8, no BOM, with a trailing newline.** | Re-verified over all 126 files: 0 CRLF files, 0 BOM, 0 files missing a trailing newline. Enforced by the branch's `.gitattributes`; the Engine's own root file pins `* text=auto eol=lf` (added for #5598), and the pack needs the same because `manifest.json` hashes working-tree bytes. |

---

## 5. UI labels & glosses

### 5.1 Byte-exact rule

**Any string the reader will see on screen is reproduced byte-for-byte from English.** That
includes capitalisation, the ellipsis character, trailing periods, and the `/` in
`Install / Start Marinara`. Never translate it, never "fix" it, never localise its
punctuation.

- `**Install / Start Marinara**` — the slash and its spaces are part of the string. 7 hits:
  `INSTALLATION.md:27`, `TROUBLESHOOTING.md:289,300,310`, `UPGRADING.md:103`,
  `installation/android-termux.md:19,22`.
- `characters/creating-and-editing-characters.md:29` `**Uploading…**`, `**Embedding…**`,
  `**Saving…**` — U+2026, because `en.json` uses U+2026 for those keys.
- `TROUBLESHOOTING.md:330` `"Opening chat..."` — ASCII dots, because
  `en.json` key `ui.chat.chatarea.openingChat` is literally `"Opening chat..."`.
  Source of truth: `packages/client/src/localization/locales/en.json`.
- `lorebooks/entries.md:13` `**Search entries…**` ↔ `en.json` `chat.settings.inlineLorebook.search`.
- `data/backup-and-restore.md:30` `**Creating backup…**` ↔ `en.json`
  `ui.panels.advancedsettings.creatingBackup`.

### 5.2 The two presentation patterns

**Pattern A — bold label + one parenthetical Portuguese gloss** (the dominant one; **974**
bold spans are immediately followed by a parenthetical, against **6 752** bold spans in
total — i.e. the gloss is a *first-mention* device, not a per-occurrence one. Note that not
every bold span is an English label: some bold Portuguese, so 6 752 is an upper bound on
"bold English labels", and 974 an upper bound on glosses, since a few parentheticals are
not glosses):

```
Abra **Agents → Download Agents** (baixar agentes) para instalar ou desinstalar.
```
`CONFIGURATION.md:20`. More: `installation/android-termux.md:90` `**Settings**
(Configurações)`, `**Check for Updates**` (procurar atualizações), `**Apply Update**`
(aplicar a atualização); `FAQ.md:9` `**Access blocked**` (acesso bloqueado);
`TROUBLESHOOTING.md:330` `**Server unreachable**` (servidor inacessível) and
`**Unreachable (request timed out)**` (inacessível: tempo da requisição esgotado).

Gloss mechanics:
- The gloss is **lowercase** unless it is itself a proper name or a menu label that the
  Portuguese UI would capitalise (`(Configurações)`, `(Configurações → Avançado → Zona de
  perigo)`).
- **Gloss once per file, at first mention.** In `installation/android-termux.md`,
  `**Settings**` occurs exactly once, at line 90, and carries its gloss there. In files
  where a label recurs, only the first mention is glossed — `UPGRADING.md:13` glosses
  `**Settings** (Configurações)` and later lines use it bare.
- When a gloss would itself need parentheses, use a **colon** inside the gloss rather than
  nesting: `**Unreachable (request timed out)** (inacessível: tempo da requisição esgotado)`
  — `TROUBLESHOOTING.md:330`.
- **Do not stack three parentheticals in one sentence.** Where a third label appears, leave
  it unglossed as a proper name — `Support Diagnostics` in `TROUBLESHOOTING.md:330`, which
  also mirrors English in not bolding it.

**Pattern B — quoted status/help string, byte-exact, no gloss.** Full sentences the app
prints are quoted in straight double quotes and left in English with no Portuguese
rendering:

```
Aparece a mensagem "Restored the previous app data snapshot."
```
`home/professor-mari.md:86`. More: `TROUBLESHOOTING.md:129`
`"This parameter is sent to the model"`; `home/achievements.md:61`; `UPGRADING.md:133,164`;
`media/scene-backgrounds.md:81` `"Every image request needs a prompt."`;
`media/scene-video.md:127`. **`pt-br` is not one of the locales that translate these.**
Re-measured: **678** double-quoted spans in prose (fenced and inline code excluded), of
which **15** are Portuguese — and every one of those 15 is an allowed exception, not a
translated UI message: a quoted cross-reference to another section's Portuguese title
(`appearance/card-css-theming.md` "O que você não pode estilizar";
`conversation/calls.md` "Ative as chamadas em um chat") or example dialogue and example
prompts the reader types (`game/combat.md` "Eu chuto areia na lente rachada do Ruin
Guard."; `home/professor-mari.md` "o que você lembra?"; `lorebooks/entries.md` "não saia do
personagem"; `agents/hierarchical-maps.md` "Vamos para a Kitchen"). A Portuguese quoted
string that is neither of those is a regression.

### 5.3 Emphasis on state words

An English state word that the UI itself shows keeps the English bold; a Portuguese state
word takes bold only where English bolds it: `agents/approvals-and-agent-suite.md:55` marks
the edit as `**stale**` (desatualizada); `TROUBLESHOOTING.md:330` writes `**congelado**`,
keeping English's bold on `frozen` while translating the word.

---

## 6. Language-specific mechanics

| Mechanic | Rule | Evidence |
|---|---|---|
| **Preposition + article contraction** | Mandatory throughout: `de`+`o` → `do`, `em`+`o` → `no`, `a`+`o` → `ao`, `por`+`o` → `pelo`, `de`+`a` → `da`. This is what makes the product-name rule in §2.1 a *contraction* rule, not an *article* rule. | `CONFIGURATION.md:20` "do catálogo"; `agents/agents-overview.md:3` "no Marinara" |
| **Gender assignment for English loanwords** | Tech loans are **masculine by default**: `o prompt`, `o token`, `o preset`, `o lorebook`, `o chat`, `o card`, `o backup`, `o cache`, `o swipe`, `o tracker`, `o sprite`, `o embedding`, `o streaming`, `o NPC`, `o wake lock`. The exceptions are loans with an obvious Portuguese feminine anchor: **`a persona`**, **`a API`**, **`a URL`**. | Masculine-article hits: prompt 152 · lorebook 103 · preset 53 · chat 321 · card 94 · token 18, each with **0** genuine feminine counterparts. `a persona(s)` 97 vs `o persona(s)` **0**; `characters/personas.md:3` "uma persona" |
| **Plural of loanwords** | Add `-s` and leave the stem alone: `prompts`, `tokens`, `presets`, `lorebooks`, `chats`, `cards`, `backups`, `sprites`, `NPCs`, `swipes`. Never `NPC's`, never an invariable plural. | `game/party-and-npcs.md:1` "equipe e NPCs"; `characters/galleries.md:91` |
| **Adjective agreement with the carrier noun**, not with the English name | `a janela **Review Character Card Updates**` → feminine agreement; `o painel **Lorebooks**` → masculine. | `agents/approvals-and-agent-suite.md:40`; `lorebooks/overview.md:23` |
| **Verb "to support"** | Use `ter suporte a`, not the calque `suportar`. | `connections/subscription-clis.md:51` "só têm suporte a chat de texto", `:129` "só tem suporte a chat de texto"; `suporte a` 15. **One residual**: `connections/local-self-hosted.md:59` "não suporta chamadas de ferramenta" (§7.3, residual 10) — that is the only `suportar` form in the pack |
| **Hyphenation of prefixes** | Follow the Acordo: `pré-visualização`, `pós-processamento`, but `automaticamente`, `autoridade` closed. | `pré-visualização` 7 (`CONFIGURATION.md:55` ×2, `:242`; `agents/hierarchical-maps.md:349,666,881`; `characters/colors-and-stats.md:13`); `pós-processamento` 6 (`agents/built-in-agents.md:147,198`; `development/frontend.md:567`; `media/illustrator-agent.md:7`; `development/architecture-map.md:90,290`) |
| **`por que` / `porque` / `por quê`** | Standard Brazilian orthography; interrogative headings use `Por que…`. | `FAQ.md` question headings |
| **Do not translate code, paths, env-var names, URLs, link targets, or fragments** | `DATA_DIR`, `/app/data`, `start-termux.sh`, `ipconfig`, `.env`, `#anchors` all stay byte-identical. This is enforced by the branch rules and by `validate-pack.mjs`. | `CONFIGURATION.md:76,152`; `FAQ.md:15,30`; `docs-i18n/README.md` step 1 |
| **Table cells keep the pack's compact pipe formatting** | No English-style column padding; write `| a | b |` and let it be ragged. | `CONFIGURATION.md:152-160`; `connections/local-model.md:72` |

---

## 7. QA checks & known traps

### 7.1 Mechanical checks (run these before shipping an edit)

Run from the pack root (`pt-br/`) unless stated. Every expected count below is the state of
the pack as shipped.

1. **European Portuguese sweep** — must be **0** hits:
   `grep -rEn "ficheiro|ecrã|utilizador|telemóvel|\bgerir\b|\baceder\b|carregar em|\brato\b" .`
   (`rato` needs eyeballing: it is a substring of `barato`/`retrato`.)
2. **`app` sweep** — every hit must be a path or identifier, a code block, an English UI
   label (**Refresh App**, **App Style**, **App Behavior**, **Install App**), the phrase
   `Progressive Web App`, a quoted English string, the CSS class `mari-app`, or the fixed
   term `app shell`: `grep -rEn "\bapp\b" .` — **73 hits today, all accounted for**. A hit
   that is none of those (an `app` used as a Portuguese noun) is the regression.
3. **Product-name contraction** — must be **0** outside the `chamado de` formula:
   `grep -rEn "\b(de|em) Marinara" .` (2 hits today, both `chamado (só) de Marinara`:
   `agents/memory.md:7`, `installation/macos-linux.md:3`).
4. **Address form** — must be **0**: `grep -rEn "\b(tu|vós|teu|tua)\b|o senhor|\bClica\b" .`
5. **Curly quotes / guillemets** — must be **0**: `grep -rn "[“”‘’«»]" .`
6. **Em dash** — 7 known residuals in 4 files (§7.3); any new one is a regression:
   `grep -rn "—" .`
7. **Invisible characters** — must be **0** for U+00A0, U+202F, U+2011, U+00AD, U+3000,
   U+200B, U+200D: `grep -rnP "\x{00A0}"` (or a Python scan; plain `grep -E` with a
   `\uXXXX` escape does *not* work in this shell — see §7.2).
8. **Loanword gender** — must be **0 *real* hits**:
   `grep -rEn "\bas? (prompts?|tokens?|presets?|lorebooks?|chats?|cards?|backups?)\b" .`
   This grep returns **9 hits today and every one is a false positive** — the `a` is the
   preposition (`vinculados a chats`, `suporte a chat de texto`, `dedicada a embeddings`,
   `chat a chat`) or is inside a quoted English string (`"Every image request needs a
   prompt."`). Eyeball each hit; the check passes only when none is a genuine article.
   The reliable positive control: masculine-article counts in §6.
9. **Line endings / BOM / trailing newline** — 0 CRLF files, 0 BOM, 0 missing final newline.
10. **UI-string byte-exactness** — for every quoted or bolded English label, diff it against
    `packages/client/src/localization/locales/en.json`. Watch the ellipsis: `en.json` mixes
    `…` (e.g. `ui.panels.advancedsettings.creatingBackup`) and `...` (e.g.
    `ui.chat.chatarea.openingChat`). Normalising either way is a regression.
11. **Link text ↔ target H1** — recompute the mirroring table (see §7.4) and compare with the
    baseline using the *same* classifier: 902 whole-file links, 745 exact, 14 case-only,
    143 differing beyond case. Do not compare a fresh split against a differently-classified
    ledger number (§7.4).
12. **Pack validator** — from an Engine checkout at the matching `staging` commit:
    `node scripts/docs-i18n/validate-pack.mjs <path>/pt-br` then
    `node scripts/docs-i18n/build-manifest.mjs <path>/pt-br --source-commit <engine-sha>`.
    Validator re-run on 2026-09-01: **passed — "Pack validation passed: 125 translated
    docs, 125 English docs."**

### 7.2 Tooling traps

- **`grep -E` in this Git-Bash shell does not expand `$'\uXXXX'` escapes**, and a bracket
  expression like `[“”]` matches *bytes*, producing spectacular false counts
  (52 039 "curly quotes" in a pack that has none). Use the `Grep` tool with the literal
  character pasted in, or a small Python scan with `encoding='utf-8'`.
- **Python on this machine prints to a cp1252 console.** Any script that prints `→` or `…`
  dies with `UnicodeEncodeError`. Wrap stdout:
  `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')`.
- **Word boundaries break on accented characters** in this locale: `grep -Eo "\bvocê\b"`
  returns 0 in a file with 1 309 occurrences, because ASCII `\b` sees the boundary *inside*
  `você`. Drop the trailing `\b` after an accented letter, or use the explicit class this
  glossary counts with: `(?<![A-Za-zÀ-ÿ])…(?![A-Za-zÀ-ÿ])`. Same failure mode hits `conexão`,
  `atualização`, `extensão`, `instantâneo`, `pré-visualização`. This is the Latin-script
  version of a trap that is total in non-Latin scripts — a JS-style `\w`/`\b` matches no
  Cyrillic, CJK or Devanagari character at all, so a `\w`-based sweep silently reports zero
  on those packs. Never trust a zero from a `\b`/`\w` pattern on non-ASCII text.
- **`\bde Marinara\b` also matches `onde Marinara`.** Anchor on a leading space or `(^|\s)`.
- **A "banned term" grep almost always over-fires.** Most banned alternates in §3 exist in
  the pack in an unrelated sense (`faixa` = CIDR range, `motor` = engine, `perfil` =
  Profiles feature, `manual` = manually, `rodada` = combat round, `ficha` = poker chip).
  Read the §3 "legit other sense" notes before filing a regression from a raw count.
- **Never let Git check the pack out as CRLF.** The branch `.gitattributes` must pin LF
  (the Engine root uses `* text=auto eol=lf`, added for #5598) precisely because
  `manifest.json` hashes working-tree bytes and `raw.githubusercontent.com` serves LF. A
  CRLF checkout invalidates all 125 hashes at once.
- **`validate-pack.mjs` is narrower than it looks.** Read against the script itself: it
  checks orphan files with no English counterpart, a leading `# ` H1 on every file,
  relative link *targets* existing in the English source, images the English source does
  not have, and `manifest.json` presence, completeness and hash freshness. It does **not**
  check terminology, link *text*, UI-string byte-exactness, fragment validity, or content
  drift — the pack passes today while carrying the drift in residual 8.

### 7.3 Known pack residuals — documented, not silently fixed

These exist in the shipped bytes. Leave them alone unless a maintainer asks for a cleanup
pass; they are listed so a future sweep does not "discover" them as new regressions.

1. **7 em dashes** in 4 files, where the house dash is the en dash:
   `agents/custom-agents.md:113,114` (label bullets), `TROUBLESHOOTING.md:260,326`,
   `data/where-data-is-stored.md:21` (**two** on that one line, a paired parenthetical),
   `lorebooks/entries.md:189` (inside quoted English example content, so arguably correct).
2. **`cartão` used for the character card** in `characters/galleries.md:81,91` ("no cartão",
   "as exportações de cartão PNG"), against the pack's dominant `card de personagem` (59).
   The other 12 `cartão`/`cartões` hits are the correct UI-card sense.
3. **`interruptor` for a toggle** in `agents/agents-overview.md:42,43` and
   `prompts/preset-variables.md:17`, against the dominant `botão liga/desliga` (139 hits);
   plus one **`botão de alternância`** in `chats/connected-chats.md:75`.
4. **`Personal Extensions` translated in one file, kept English in its sibling**:
   `extending/personal-extensions.md:1` H1 is "Extensões pessoais" (EN H1: "Personal
   Extensions") while `extending/writing-personal-extensions.md:1` is "Como escrever
   Personal Extensions" (EN: "Writing Personal Extensions"). The two cross-links between
   them therefore cannot both mirror their targets.
5. ~~One `o Professor Mari`.~~ **Withdrawn on 2026-09-01: this residual does not exist.**
   A full sweep finds **0** masculine-marked forms (`o` / `do` / `ao` / `pelo Professor
   Mari`) against 41 feminine-marked ones. See §2.3. The slot is kept numbered so the
   cross-references in older notes still resolve.
6. **`app shell` kept as a technical term** in `development/ios-pwa-safe-area.md:29,35,54,
   67,68,69,96,97`. This is the only prose survival of `app` and it is deliberate — the term
   names a specific DOM container (`mari-app`), not "the application".
7. **`manifest.json` carries no `sourceCommit`.** `build-manifest.mjs` accepts
   `--source-commit` and writes the field only when given; the shipped `pt-br/manifest.json`
   has just `language` and `files`. There is consequently **no recorded English baseline**
   for this pack. Supply `--source-commit` on the next rebuild.
8. **Content drift against `docs/` at `staging` HEAD** (2026-09-01): 8 files where the
   English side has since gained links or table rows —
   `CONFIGURATION.md` (+3 table rows, +1 link), `FAQ.md` (+1 heading),
   `agents/built-in-agents.md` (+1 link), `characters/creating-and-editing-characters.md`
   (+1 link), `development/frontend.md` (+2 table rows),
   `extending/personal-extensions.md` (+1 row, +1 link), `media/tts-setup.md` (+1 link),
   `prompts/macros.md` (+1 heading). `validate-pack.mjs` passes anyway (see §7.2). Because
   of residual 7 this cannot be attributed to a specific English revision. Re-measured
   2026-09-01 against `docs/` and unchanged: the same 8 files, the same deltas, and the
   file sets are otherwise identical in both directions (0 orphans, 0 missing).
9. **Four unbolded menu-path arrows in table cells**: `CONFIGURATION.md:243`
   ("consentir em Settings → Advanced → Danger Zone") and `:316`
   ("(Settings → General → Documentation Language)"). The house pattern puts a menu path
   inside one bold span; these two cells mirror English's unbolded prose instead.
10. **One `suportar` calque**: `connections/local-self-hosted.md:59` "não suporta chamadas
    de ferramenta", against the house `ter suporte a` (§6). It is the only `suportar` form
    in the pack.
11. **`lançador` for launcher, 3 hits, all in developer docs**:
    `development/code-cleanup-audit.md:242`, `development/optional-agent-packages.md:140`
    (×2), against the user-facing `inicializador` (73).
12. **`checkout` left untranslated in Portuguese prose, 3 hits**: `TROUBLESHOOTING.md:39`,
    `UPGRADING.md:37`, `installation/containers.md:24`. This is now written up as the rule
    in §3 rather than as a defect, because the pack is consistent about it and there is no
    competing Portuguese rendering — but it *was* recorded as banned, so it is listed here.
13. **`diretório` in user-facing prose, 6 hits**, all `diretório de dados` in
    `TROUBLESHOOTING.md:241,243,245`, against the house `pasta` (426).
14. **`apagar` used for user data, 6 hits**, including `data/clearing-data.md:3,42,54`
    ("apagar tudo de uma vez", "apagar parte dos dados"), against the house `excluir` (118).
    The ledger recorded `apagar` as banned for user data; the pack does not honour that.
15. **One `deslizar` as a noun**: `settings/settings-overview.md:97` "o deslizar do dedo",
    inside the gloss of **Intuitive swipe navigation**, against the house `swipe` (111).

### 7.4 Link-text ↔ H1 mirroring — the ledger claim, corrected

**[RULING]** The recorded cycle ruling reads: *"Link-text↔H1 mirroring is mechanically
enforced (0 paraphrases)."* PR #4229 states it more narrowly: *"link text unified to each
target's actual H1 for the most-linked guides."*

**The pack does not support the absolute form.** Measured over all 902 whole-file relative
links (fragment links and external URLs excluded), re-run on 2026-09-01 against both trees:

| | `pt-br` | `docs/` (English baseline) |
|---|---|---|
| whole-file links | 902 | 902 |
| link text == target H1 | **745** (82.6 %) | 703 (77.9 %) |
| case-only difference | 14 | 11 |
| differs beyond case | **143** | 188 |
| — of those, short form of the H1 | 115 | 105 |
| — of those, **reworded** | **28** | 83 |

So the audit was real and substantial — the pack roughly *tripled* the exact-mirroring
margin over English and cut reworded link text to about a third of English's — but
"0 paraphrases" is not true of the shipped bytes. **Record the ruling, enforce the
measurable version**: no *new* reworded link text, and the set below is the accepted one.

**The short-form/reworded split is classifier-sensitive; the first three rows are not.**
The ledger recorded 118/25 for `pt-br` and 112/76 for English; this re-measure gets 115/28
and 105/83 from the same 902/745/14/11/703 skeleton. The difference is entirely where you
draw "short form": the classifier used here counts a link as *short form* only when the H1
starts with the link text, or the link text equals the H1's text before its first `:` or
its first `(`. Anything else — a suffix match, a case-differing prefix — lands in
*reworded*. **Re-run with this same rule before comparing**, or the delta is an artifact.

The 28 reworded links under that classifier, by source → target:

- `CONFIGURATION.md` → `media/scene-video.md` ×2 — "Vídeo de cena" vs "Geração de vídeo de cena"
- `settings/settings-overview.md` → `media/scene-video.md` ×1 — same pair
- `settings/settings-overview.md` → `media/music.md` — "Música" vs "Music DJ: Spotify, YouTube e músicas locais"
- `TROUBLESHOOTING.md`, `extending/personal-extensions.md`,
  `extending/writing-personal-extensions.md`, `integrations/home-assistant.md` ×2
  → `CONFIGURATION.md` (5 links) — "Configuração do servidor" vs "Referência de configuração do servidor"
- `INSTALLATION.md` → `installation/windows.md` ×2 — "Instalação no Windows" vs "Guia de instalação no Windows"
- `INSTALLATION.md` and `FAQ.md` → `installation/android-termux.md` ×2 — vs "Guia de instalação no Android (Termux)"
- `chats/branches.md` → `chats/managing-chats.md` ×2 — "Gerenciar a lista de chats" vs "Como gerenciar a lista de chats"
- `chats/guided-and-impersonate.md` → `prompts/presets.md` ×2 — "Presets" vs "Editor de presets e gerenciador de prompts"
- `extending/personal-extensions.md` → `extending/writing-personal-extensions.md` ×2 and
  `extending/writing-personal-extensions.md` → `extending/personal-extensions.md` ×2 — the
  four cross-links of residual 4, which cannot all mirror because the sibling H1s disagree
- `extending/writing-personal-extensions.md` → `development/personal-extensions.md` — "Arquitetura de Personal Extensions" vs "Arquitetura das Personal Extensions"
- `media/animated-expressions.md` → `characters/sprites.md` ×2 — "Sprites de Personagem" vs "Sprites de personagem (expressões e corpo inteiro)" (case-differing prefix)
- `agents/built-in-agents.md` → `noodle/overview.md` — "…a linha do tempo social do aplicativo" vs "…dentro do aplicativo"
- `agents/built-in-agents.md` → `game/storyboard.md` — "Agente Storyboard: Roleplay e Game Mode" vs "Guia do agente Storyboard"
- `lorebooks/overview.md` → `lorebooks/entries.md` — "guia de entradas" vs the full H1
- `noodle/settings.md` → `conversation/schedules.md` — "agendas de personagem" vs "Agendas de personagem e mensagens autônomas"

### 7.5 Recorded rulings kept without pack evidence

Carried forward from the original cycle; the pack cannot show them, so they are recorded,
not verified:

- **The article standard was a maintainer ruling that reversed an earlier decision.** The
  original glossary prescribed *no* article with the product name; the maintainer overruled
  it to `do/no Marinara`. The pack shows only the outcome (§2.1, one-sided and verified),
  never the reversal — there is no in-pack artifact of the earlier rule or its overturning.
- **"Link-text↔H1 mirroring mechanically enforced, 0 paraphrases"** — recorded as stated,
  and **disproved** by the pack: 28 reworded link texts survive. §7.4 carries the
  measurable replacement rule and the accepted set.
- **Process ruling (PR #4229): every file passed structural verification, dialect,
  address-form and terminology sweeps, plus an independent language-QA panel.** No artifact
  of those sweeps ships with the pack.
- **Process ruling (PR #4229): runtime verification against a throwaway data dir** with a
  materialized pack — viewer fully Portuguese, Settings coverage counts, switch flows. Not
  reproducible from pack bytes.
- **Process ruling: the original glossary carried an explicit anti-calque table.** Its
  individual entries are lost; only the three false-friend pairs recorded in the ledger
  (`livraria`/`biblioteca`, `atualmente`, `eventualmente`) survived, and those *are*
  verified in §1. Treat the anti-calque table as reconstructable only from future sweeps.
- **Repo process ruling: `[docs-i18n]` follow-ups are batched, not filed per PR.** A change
  to `docs/` that renames or deletes a file must still be mirrored here or the translation is
  silently orphaned (`CLAUDE.md`, `CONTRIBUTING.md § Translated documentation`).

---

## 8. Quick reference card

```
você + 3rd-person imperative      Clique · Abra · Veja · Use · Escolha · Defina
Brazilian only                    arquivo salvar tela usuário celular gerenciar
                                  NEVER ficheiro guardar(=save) ecrã utilizador gerir
product name                      do/no Marinara · bare Marinara as subject
                                  the only "de Marinara" is "chamado de Marinara"
app                               aplicativo (never "app" as a Portuguese noun;
                                  all 73 "app" hits are paths, UI labels, PWA, app shell)
modes                             Conversation Mode · Roleplay · Game Mode (English)
                                  but "Modo Conversation" where EN says "Conversation mode"
frozen names                      World Maps · Haptic Feedback · Professor Mari (f., 0 masc.)
                                  Noodle · Agent Suite · Danger Zone · Support Diagnostics
                                  BUT the common noun is "feedback tátil"
loan genders                      o prompt/token/preset/lorebook/chat/card/backup/
                                  cache/swipe/tracker/sprite/NPC/wake lock
                                  a persona · a API · a URL
NPC                               never PNJ; first-mention gloss
                                  "NPC (personagem não jogável)" IS used
sidebar vs panel                  barra lateral = the rail · painel lateral = the panel
                                  in it — both correct, different objects
embedding vs vetorização          o embedding = the object · a vetorização = the action
quotes                            "straight" only — no “ ” ‘ ’ « »
dashes                            – (en dash), spaced · never — (7 residuals)
menu paths                        **A → B → C** (gloss → em → português)
numbers                           5,4 GB · 16.384 · 75%
UI strings                        byte-exact English; ellipsis exactly as en.json has it
gloss                             **English Label** (gloss em minúsculas) — once per file
files                             LF · UTF-8 · no BOM · trailing newline · 125 .md + manifest
```

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, translate a native NovelAI character caption as
**descrição de personagem**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.
