# Marinara Engine — Spanish (`es`) documentation-pack glossary

## Provenance

This is the **second-generation** `es` glossary, **re-derived 2026-09-01**. The original
working glossaries from the pack-authoring cycle were lost to temp-directory cleanup, so
nothing here is inherited text — every rule below was re-established from source.

Sources, in authority order:

1. **The shipped pack** (`docs-i18n` branch, `es/`, 125 `.md` guides plus `manifest.json` =
   126 files) — **ground truth**. Every terminology row and prescriptive rule below cites a pack
   file (and, where useful, a line) that demonstrates it. **Counts in this document are
   occurrence counts over the 125 guides**, produced with accent-aware, case-insensitive-where-
   noted matching (see § 7, "Counting traps").
2. **The pack's shipping PR decision write-up** — PR
   [#4100](https://github.com/Pasta-Devs/Marinara-Engine/pull/4100) ("Documentation Language
   setting + first full translation: Spanish, 123 guides"). Its terminology paragraph is the
   origin of the one-term-per-concept and loanword rulings.
3. **The 2026-09-01 mirror-cycle notes** (`prd-notes-es.md`) — per-row, evidence-cited choices
   made three hours before this glossary, covering the `#5604` / `#5720` / `#5718` deltas.
4. **The app locale file** `packages/client/src/localization/locales/es.json` — consulted only
   for UI-gloss reality checks (see § 5 and § 7; it is **not** an authority over the pack).

**Descriptive, not aspirational.** The recorded maintainer ruling for `es` is that the pack
**skews literal by history**, and that naturalness/anti-calque critiques were **deliberately
deferred**. This glossary therefore documents the pack **as shipped**. If `es` is ever
re-opened for a naturalness pass, the recorded ruling is that **the `de` glossary's anti-calque
approach is the template** — but that is a future-work note, not a rule that governs edits
today. *(Recorded maintainer ruling; not verifiable from pack content.)*

---

## 1. Register & address

| Rule | Evidence |
| --- | --- |
| **Informal `tú` throughout.** Second-person singular, `tú` verb forms, `tu/tus` possessives. Never `usted`/`ustedes` for addressing the reader. `usted` has **zero** occurrences in the pack. | `es/agents/agents-overview.md:51` "abre un visor donde **puedes** leer"; `es/agents/approvals-and-agent-suite.md:18` "Siempre piden **tu** aprobación" |
| **Never `vosotros`.** Zero occurrences of `podéis` / `vuestro`. Plural address, when unavoidable, goes through impersonal or `tú`-singular rephrasing. | pack-wide grep: 0 hits |
| **Imperative for instructions**, `tú` form: `Haz clic`, `Abre`, `Escribe`, `Elige`, `Establece`, `Consulta`, `Revisa`. | `es/agents/approvals-and-agent-suite.md:65` "**Haz clic** en **Agent Suite**." |
| **Neutral / pan-American lexicon**, not peninsular. `computadora` (106) — **never** `ordenador` (0) or `computador` (0); `archivo` (406) — never `fichero` (0); `video` (290) — never `vídeo` (0); `celular` (0) is not used, the phone is `teléfono` (85) with `móvil` (15) as adjective. | `es/INSTALLATION.md:43` "significa tu propia **computadora**"; `es/chats/messages.md:5` "en una **computadora**, o cuando tocas el mensaje en un **teléfono**" |
| **`app`** is the default word for the application — the bare token `app` occurs 441× (`apps` 12×), of which `la app` is 325×, against `aplicación` 35× / `aplicaciones` 2×. `aplicación` survives mostly in platform prose and in `la aplicación de actualizaciones` (= *applying* updates, 2×). | `es/TROUBLESHOOTING.md:80` "guarda **la app** web en caché"; `es/CONFIGURATION.md:238` "la **aplicación** de actualizaciones" |
| **Gender-neutral where natural**, achieved by rephrasing — `quienes crean personajes`, `quien colabora`, plural `personas`, agentless constructions. The pack leans on `se`-impersonal and second-person `tú` far more than on these relative-clause forms (each occurs once), so treat them as licensed rather than expected. | `es/appearance/card-css-theming.md:3` "muestra a **quienes crean** personajes y personas"; `es/development/localization.md:62` "Traduce un valor de la comunidad solo cuando **quien colabora** pueda aportar…" |
| **Banned inclusive orthography**: `@`, `x`, or `-e` endings (`usuari@s`, `usuarixs`, `todes`). Zero occurrences; the pack solves gender by rewriting, not by glyph. | pack-wide grep: 0 hits |
| **`la IA`** is the actor in prose (261 `la IA`, 197 `de IA`). Bare `AI` appears only inside byte-exact English UI labels (`**Create with AI**`, `**AI Edit**`). | `es/lorebooks/overview.md:7` "de la que **la IA** puede tomar datos"; `es/agents/hierarchical-maps.md:91` "**Create with AI**" |
| **Click vs. tap**: `haz clic` (255) is the default; `pulsa` (30) is for **keys** and hardware-ish presses; `toca` (26, plus `doble toque` 5 and enclitic `tócala`) is the touch verb. Don't swap them. `doble clic` (10) and `doble toque` (5) are the paired mouse/touch forms. | `es/characters/library-organization.md:62` "haz **doble clic** en ella, **tócala dos veces**, o selecciónala y **pulsa** la tecla F2" |

---

## 2. Product, feature & mode names

| Rule | Evidence |
| --- | --- |
| **Product names never translate**: `Marinara`, `Marinara Engine`, `Termux`, `Android`, `Node`, `Docker`, `GitHub`, `Discord`. The token `Marinara` occurs 1247× in all, of which 239 are the formal `Marinara Engine` and ~1008 the short form; keep whichever the English source used. | `es/development/localization.md:56` "Deja sin cambios los **nombres de producto** como Marinara Engine"; `es/CONFIGURATION.md:71` |
| **UI-surfaced feature and panel names stay English**, styled as the English source styled them: `Local Model` (69), `Download Agents` (34), `Character Editor` (18), `World Info` (18), `Global Gallery` (11), `Apply Update` (11), `Release Channel` (3), `Agents Manager` (1), `Support Diagnostics` (1), `Professor Mari` (93), `Noodle` (167), `Card Browser` (24). | `es/lorebooks/overview.md:7` "También se le llama **World Info**"; `es/TROUBLESHOOTING.md:330` "la copia de **Support Diagnostics**" |
| **A frozen English name takes a Spanish gloss the first time it is a *clickable label*** — see § 5. A frozen name used as a *proper noun of a subsystem* (e.g. `Support Diagnostics`, `Agents Manager`) is left bare and unglossed when the English source leaves it unbolded. | `es/TROUBLESHOOTING.md:330` — `Support Diagnostics` bare and unglossed in the same sentence where two bold labels **are** glossed |
| **Mode names stay English behind a Spanish carrier noun**: `modo Conversation` (30), `modo Roleplay` (10), `modo Game` (7). `Game Mode` is itself a frozen two-word name and stays whole (235 occurrences) — do **not** rewrite it to `modo Game` when the English source said "Game Mode". | `es/appearance/card-css-theming.md:211` "En el **modo Conversation**"; `es/game/getting-started.md:1` "# **Game Mode**: primeros pasos" |
| `modo de juego` (7) means *a game mode* generically, **not** the product's Game Mode. Keep the distinction. | `es/game/` prose vs. `es/game/getting-started.md:1` |
| **Carrier-noun + English-name is the general pattern** for typed things: `el panel **Personas**`, `el botón **Apply Update**`, `el asistente New Game Setup`, `la pestaña **Advanced**`. Gender/article come from the Spanish carrier noun, never from the English name. | `es/characters/personas.md:19` "El **panel** **Personas** es tu biblioteca"; `es/UPGRADING.md:151` "El **botón** **Apply Update**" |
| **Agent names stay English**: `Narrative Director`, `Character Tracker`, `Beholder`, `Illustrator`. Introduce them with the Spanish carrier `agente`. | `es/roleplay/narrative-director.md:7` "El **Narrative Director** es uno de estos **agentes**." |
| **Headings translate**, sentence case, Spanish question marks where the English heading is a question. `Overview` → `Descripción general de <noun>`, and the **H1 headings are consistent about it** — all three that use the pattern say `Descripción general de …`. The competing forms (`Resumen de`, `Visión general de`, `Vista general de`, `Introducción a`) appear only in **link text**; do not import them into a heading. See § 7 residual 8. | `es/lorebooks/overview.md:1` "# Descripción general de los lorebooks"; `es/settings/settings-overview.md:1`; `es/chats/chat-settings.md:1`; `es/CONFIGURATION.md:5` "## ¿Cuándo configurarías Marinara?" |
| **Titles may be recast as `Nombre: descripción`** where English used a bare noun phrase. | `es/agents/agents-overview.md:1` "# Agentes: ayudantes de IA para tus chats"; `es/noodle/overview.md:1` "# Noodle: la línea de tiempo social dentro de la app" |

---

## 3. Core terminology

Column 2 is **the pack's term — use it**. Column 3 lists renderings that must **not** be
introduced (either because the pack never uses them, or because the pack reserves them for a
different concept). Evidence is one pack file that demonstrates the row.

| English term | This pack's term | Banned alternates | Evidence |
| --- | --- | --- | --- |
| prompt | **prompt**, masculine — `el prompt` (105), `un prompt` (46), `los prompts` (53); 727 in all. First use in a guide takes the gloss `prompt (las instrucciones enviadas a la IA)`. | `la prompt` / `una prompt` (0 — the pack is uniformly masculine); `indicación` *(reserved — see the last row)*; `aviso` *(reserved: 64 uses for a browser/password prompt, an on-screen notice or a toast — `es/CONFIGURATION.md:124` "un **aviso** de contraseña")*; `mensaje del sistema`; `instrucción` as a standalone equivalent | `es/characters/personas.md:7` "en cada **prompt** (las instrucciones enviadas a la IA)"; `es/lorebooks/overview.md:9` (definition-sentence variant) |
| token | **token**, masculine — `un token`, `los tokens`, `de tokens`, `recuentos de tokens`, `presupuesto de tokens` (129 in all). First use glossed `un token (un fragmento de texto)`. | `ficha` *(reserved — 13 uses, all UI chips/tiles: poker chips `es/conversation/table-games.md:112,114,122`, attachment chips `es/chats/sending-and-streaming.md:32`, emoji/sticker tiles `es/conversation/emoji-stickers-gifs.md:42,50,51,68`, recent-chat tiles `es/home/welcome.md:14`)*; `unidad léxica`; `símbolo` | `es/prompts/generation-parameters.md:31`; `es/lorebooks/token-budgets.md:1` "Presupuestos de **tokens**" |
| preset | **preset**, masculine — `un preset` (37), `el preset`, `los presets` (231 in all). First use glossed `preset (ajuste guardado)`. | `preajuste`; `ajuste predefinido`; `plantilla` *(reserved — 103 uses for a genuine **template**: map templates, `Prompt Template`, storyboard templates; `es/agents/hierarchical-maps.md:31` "**plantillas** de mapa")* | `es/data/importing-from-sillytavern.md:17` "Un **preset** (ajuste guardado) es un paquete guardado de ajustes de generación." |
| lorebook | **lorebook**, masculine — `un lorebook` (89), `los lorebooks` (605 in all). First use glossed `lorebook (libro de trasfondo)` — the gloss phrase `libro de trasfondo` occurs 19× across 19 files (once per file that introduces the term). Also announce the synonym `World Info`. | `libro de conocimiento`; `libro de lore`; `códice`; using `libro de trasfondo` as the standalone term | `es/lorebooks/overview.md:3,7`; `es/data/importing-from-sillytavern.md:17` |
| character card | **tarjeta de personaje** (61 sg. / 27 pl.). The English `character card` appears only when the source is quoting the term itself. | `ficha de personaje`; `carta de personaje`; `perfil de personaje` as the term | `es/FAQ.md:101` "Una **character card** (tarjeta de personaje) es el perfil guardado…" |
| chat | **chat**, masculine — `un chat` (329), `el chat` (209), `los chats` (100); the token `chat` occurs 1734× and `chats` 422×. Verb: `chatear` (10). | `conversación` as the term for a chat — but note it is **not** unused: 77 occurrences carry the ordinary sense "a conversation" (`es/chats/managing-chats.md:45` "no cambia la **conversación**") and the `Conversation` mode gloss. Reserve it for those; never make it the noun for a saved chat. Also banned: `charla` (1, `es/conversation/schedules.md`) | `es/chats/chat-settings.md:28`; `es/CONFIGURATION.md:155` "cuántos **chats** mantiene el servidor en memoria" |
| message | **mensaje**, masculine — `el mensaje`, `los mensajes`, `un mensaje`. `barra de herramientas del mensaje`, `historial de mensajes`, `rama de mensajes`. | `entrada` for a chat message *(reserved for lorebook entries and log entries)*; `post` | `es/chats/messages.md:5`; `es/chats/branches.md:23` |
| agent | **agente**, masculine — `el agente` (105), `los agentes` (73), `un agente` (62); 655 in all. Agent *names* stay English. | `asistente` as the term for an Engine agent — reserved, and heavily used (91): the assistant **chat role** (`mensajes del usuario y del **asistente**`), **setup wizards** (`el **asistente** New Game Setup`, `es/characters/choosing-your-persona.md:48`), Professor Mari (`es/FAQ.md:161`) and a generic outside `asistente de IA` (`es/appearance/card-css-theming.md:524`). `ayudante de IA` (32) is the pack's explanatory gloss for *agent*, not a second term. Also banned: `bot` | `es/roleplay/narrative-director.md:7`; `es/agents/agents-overview.md:1` |
| connection | **conexión**, feminine — `una conexión` (163), `la conexión` (120), `las conexiones` (16); `conexión`/`conexiones` 569 in all. Panel label stays `**Connections** (Conexiones)`. | `enlace` as the term for a saved connection — reserved and common (124): a **hyperlink** (`es/INSTALLATION.md:27` "usa el **enlace** Descargar APK") and the network **gateway** `puerta de enlace` (`es/REMOTE_ACCESS.md:17`). It appears once in the *definition* of a connection (`un enlace guardado a un proveedor`) and must not be promoted from there. Also banned: `perfil de conexión` | `es/chats/chat-settings.md:28` "Una **conexión** es un enlace guardado a un proveedor de IA" |
| provider | **proveedor** (286) / `proveedores` (56). English `provider` (78) survives only inside frozen labels, code, and URLs. | `suministrador`; `servicio` as the term | `es/chats/chat-settings.md:28` "qué **proveedor** de IA y qué modelo responden" |
| launcher | **lanzador**, masculine — `el lanzador`, `los lanzadores`, `los lanzadores de shell`, `el lanzador de Termux` (91 in all). | `iniciador`; `arrancador`; leaving `launcher` in English (3 residual hits, all naming a script/binary) | `es/CONFIGURATION.md:71,88`; `es/TROUBLESHOOTING.md:324` |
| update (noun/verb) | **actualización** (151) / **actualizar** (37). "Apply an update" → `aplicar la actualización`; the noun phrase for server-side apply is `la aplicación de actualizaciones` (2). The button itself stays `**Apply Update** (Aplicar actualización)`. | `parche` for a release update *(reserved: 7 uses in dev docs for a **patch** to state — "los **parches** del agente World State")*; `upgrade` (0); `actualizamiento` (0) | `es/UPGRADING.md:120,151`; `es/CONFIGURATION.md:238` |
| channel (release/update) | **canal**, masculine (24 in all). The bare `canal` carries most of the load; the expanded phrase is rare and appears in **two forms** — `canal de versiones` 1× and `canal de versión` 1× — so match the neighbouring file rather than standardising. A channel switch is `un cambio de canal` (2). The label `**Release Channel**` is itself glossed **two different ways** — `(Canal de versiones)` and `(Canal de lanzamiento)`; see § 7 residual 10. | `rama` for a release channel *(reserved for message/git branches)*; `vía` *(reserved: 33 uses meaning "via/route")*; `flujo` *(reserved: 166 uses for a ComfyUI **workflow**, `flujo de trabajo`)* | label: `es/installation/windows.md:201`; `canal de versiones`: `es/installation/macos-linux.md:231`; `canal de versión`: `es/CONFIGURATION.md:237`; `cambio de canal`: `es/CONFIGURATION.md:238` |
| channel (Discord) | **canal de Discord** — same noun, different qualifier. Never merge the two senses in one sentence without the qualifier. | `servidor de Discord` for a channel | `es/integrations/discord-mirror.md:3,7` |
| checkout (git working tree) | **checkout**, masculine loanword (9) — `un checkout de desarrollo`, `un git checkout`. Kept English because it names the Git artifact. | `pago` *(reserved: 14 uses meaning payment)*; `pedido`; `descarga`; `copia de trabajo` **in the git sense** | `es/CONFIGURATION.md:238` "nunca pueda reescribir un **checkout** de desarrollo"; `es/UPGRADING.md:33,37`; `es/TROUBLESHOOTING.md:39` |
| working copy (editor buffer) | **copia de trabajo** (12) — the *editor's* unsaved buffer, an unrelated concept from git checkout. | `checkout`; `borrador` *(reserved: 99 uses for an AI or extension **draft**, `un borrador de IA`)* | `es/agents/hierarchical-maps.md:69,98,117,146` |
| wake lock | **wake lock**, masculine loanword — `solicita un wake lock de Android`, `Un wake lock por sí solo`. | `bloqueo de activación`; `bloqueo de suspensión`; `wakelock` (one word) | `es/TROUBLESHOOTING.md:324,330` |
| battery optimization | **optimización de batería** (no article on `batería`). "Remove/exempt from it" → `quítale la optimización de batería` / `exime a Termux de la optimización de batería`. | `optimización de la batería`; `ahorro de batería`; `optimización energética` | `es/TROUBLESHOOTING.md:326,332` |
| background (activity / running) | **en segundo plano** — `funcionar en segundo plano`, `la actividad en segundo plano`, `mensajes autónomos en segundo plano`, `un script en segundo plano`. | `en el fondo`; `de trasfondo` *(`trasfondo` is reserved for lore/backstory)*; `background` | `es/TROUBLESHOOTING.md:326,332,363`; `es/TROUBLESHOOTING.md:80` |
| memory / in memory | **memoria** / **en memoria** — bare, articleless `en memoria` (8) is the *residency* sense: `mantiene el servidor en memoria`, `cargar cada chat en memoria`, `las filas en memoria`, `store de tablas en memoria`. Take the article only when the memory is **possessed or specified**: `en la memoria del servidor`, `la memoria de la página`, `la memoria de la GPU`, `la memoria del teléfono` (6 such). | `en la memoria` for the bare residency sense; `residente`; `memoria RAM` in prose | articleless: `es/CONFIGURATION.md:155,156`; `es/development/file-storage.md:39,43`; `es/development/architecture-map.md:95`. Possessed: `es/characters/bot-browser.md:116`; `es/media/comfyui.md:13` |
| eviction / evict | **descarte** / **descartar(se)** — `se descarta de la memoria (nunca del disco)`, `desactiva el descarte`. | `desalojo`; `expulsión`; `desahucio`; `evicción` | `es/CONFIGURATION.md:155` |
| least-recently-used | **el chat usado menos recientemente** (there is no `LRU` precedent in `es`; this follows the pack's `actividad menos reciente` pattern). | `LRU`; `menos usado recientemente`; `el más antiguo` | `es/CONFIGURATION.md:155`; pattern source `es/chats/managing-chats.md` |
| cache | **caché**, feminine (41; `en caché` 24) — `la caché del navegador`, `una copia en caché`, `guarda la app web en caché`, `apps en caché`. Masculine `el caché` has **0** occurrences. | `memoria caché` in running prose (0); `cache` unaccented *(1 residual, inside the HTTP literal `no-cache` at `es/development/optional-agent-packages.md:28` — code, not prose)*; masculine `el caché` | `es/TROUBLESHOOTING.md:75,80,330`; `es/UPGRADING.md:192`; `es/media/tts-setup.md:142` |
| backup | **copia de seguridad** (48 sg. / 17 pl.). Verb phrase: `haz una copia de seguridad`. `respaldo` (22) exists but as the *fallback / backing* sense (`el respaldo en tiempo de ejecución`, `nodos con respaldo de trasfondo`), **not** as a backup file. | `respaldo` for a backup archive; `backup` in Spanish prose — the English word does survive 26× but **only** inside frozen labels (`**Creating backup…**`, `**Download Backup**`, `**Existing backups**`), directory/file names (`backups/`, `marinara-automatic-backup.zip`), routes (`/api/backup`) and link targets; `salvaguarda` | `es/data/backup-and-restore.md:9,20,36`; frozen-label case `es/data/backup-and-restore.md:121`; contrast `es/development/localization.md:5` "la de **respaldo** en tiempo de ejecución" |
| snapshot | **instantánea**, feminine (43) — `instantáneas de viaje`, `la instantánea espacial`, `las instantáneas de las tablas`. | `captura` *(reserved: 10 uses meaning a screenshot / regex capture group)*; `foto`; `punto de restauración`; English `snapshot` in prose — see § 7 residual 2 | `es/agents/hierarchical-maps.md:18,234`; `es/development/file-storage.md:39` |
| extension | **extensión** / **extensiones** (147) — `extensiones personales`, `extensiones externas`. | `complemento` for an Engine extension *(reserved — see next row)*; `plugin` (3, all naming third-party code in dev docs); `añadido` | `es/extending/personal-extensions.md:3,11,15` |
| add-on | **complemento** (5) — the pack's word for a bolt-on that is **not** an Engine extension: the Termux platform add-on, an optional animation add-on, a generic drop-in add-on in dev docs. Not restricted to Android/Termux. | `extensión` for these | `es/TROUBLESHOOTING.md:326` "no hace falta ningún **complemento**"; `es/game/storyboard.md:15` "**complemento** de animación opcional"; `es/development/chat-resource-drag-drop-plan.md:452` |
| NPC | **NPC**, invariable acronym, masculine — `los NPC` (10), `un NPC`; 44 in all. First use glossed `NPC (personaje no jugador)` / `(personajes no jugadores)` (10). **In Spanish prose the acronym never takes `-s`** — `los NPCs` has 0 occurrences. `NPCs` does appear 6×: 4 inside frozen English labels (the **NPCs** tab, `**Use default voices for random NPCs**`) which are correct, and 2 in translated **link text**, which are residuals (§ 7, residual 9). | `PNJ` (0); `NPCs` in running Spanish prose; translating the acronym away | `es/agents/built-in-agents.md:115`; `es/agents/hierarchical-maps.md:263`; `es/game/party-and-npcs.md:79` |
| persona | **persona**, feminine — `tu persona`, `una persona`, `las personas`, `la persona activa`, `el panel **Personas**`. Disambiguate on first use with a definition sentence, because the word collides with the everyday `persona`. | `perfil de usuario` as the term; `personaje del usuario`; `avatar` as the term *(reserved: 161 uses for the actual profile **picture**)* | `es/characters/personas.md:3,7`; `es/conversation/profiles.md:5` "Una **persona** es el perfil que te representa (el `{{user}}`)" |
| swipe | **swipe**, masculine (110) — `un swipe`, `los swipes`; verb `hacer swipe` (1 — rare, prefer the noun). First use glossed `swipe (respuesta alternativa)` / `swipes (respuestas alternativas)` (12). | `deslizamiento`; `variante` as the term; `pasada` *(reserved: 20 uses meaning a **pass** over data)* | `es/chats/messages.md:1,3`; `es/chats/branches.md:23`; `es/agents/hierarchical-maps.md:234` |
| macro | **macro** (126) — first use glossed `Un macro es un marcador de posición…`. **Gender is inconsistent in the shipped pack.** Counting case-insensitively, feminine leads 48–15: `las macros` 22, `una macro` 13, `la macro` 11, `esta macro` 2, against `los macros` 8, `el macro` 4, `un macro` 3. Feminine owns `es/prompts/macros.md`; masculine owns `es/characters/personas.md` and `es/conversation/profiles.md`. See § 7 residual 1; for **new** text follow the local file's existing gender rather than introducing a third pattern. | inventing a translated term (`macroinstrucción`) | feminine `es/prompts/macros.md`; masculine `es/characters/personas.md:11,13`; `es/conversation/profiles.md:22` |
| placeholder | **marcador de posición** | `placeholder`; `comodín` | `es/characters/personas.md:13`; `es/chats/connected-chats.md:83` |
| branch (chat / git) | **rama** (85 sg. / 40 pl.) — `rama de mensajes`, `crear una rama`, `la rama **`staging`**`. Bare `branch`/`branches` (9 + 11 = 20) only inside code, command text and frozen labels such as `**Chat Branches**`. | `bifurcación` for a branch *(the pack spends `bifurcación` (5) on a GitHub **fork** and on a branch-point in `es/development/optional-agent-packages.md:60`)*; `hilo` | `es/chats/branches.md:23`; `es/development/localization.md:74` "una rama enfocada de tu **bifurcación**" |
| streaming | **streaming**, masculine loanword (32) — `la respuesta aparece en pantalla con streaming`, `mientras una respuesta está en streaming`. | `transmisión` (0 occurrences); `en directo` (0); `flujo` *(reserved: 166 uses for a ComfyUI **workflow**)* | `es/chats/sending-and-streaming.md:1,3,14` |
| API key | **API key**, feminine (93 sg. / 10 pl.) — `una API key`, `tus API keys guardadas`; first use glossed `API key (clave de API)` (26; `claves de API` 2). | `clave API` (1 occurrence at `es/media/tts-setup.md:64` — a residual, don't propagate); `llave de API`; `token de API` as the term for an Engine API key *(1 legitimate use at `es/media/image-providers.md:96`, where it names **RunPod's own** "API token")* | `es/chats/chat-settings.md:28`; `es/agents/memory.md:46`; `es/characters/bot-browser.md:9` |
| log | **registro** (74 sg. / 39 pl.) — `el registro persistente`, `el registro de la sesión`, `los registros del juego`. English `log` (12) only inside filenames, extensions and API identifiers (`server-*.log`, `.log`, `marinara.log.info`) — never in prose. | `bitácora` (0); `log` in prose | `es/TROUBLESHOOTING.md:324`; `es/extending/writing-personal-extensions.md:116` |
| hash | **hash**, masculine loanword (47 sg. / 2 pl.) — `compara el hash que se muestra`, `los hashes`. | `resumen` as the term *(reserved: 137 uses meaning a **summary**)*; `huella` as the term *(the pack does use the verb `toma la huella del código`, 10)* | `es/extending/personal-extensions.md:15`; `es/agents/agents-overview.md:27` |
| data folder | **carpeta de datos** (28) — `la carpeta de Marinara`. `directorio de datos` (3) survives only where the English said "directory" of a configured path. | `directorio` as the default word for a user-facing folder | `es/TROUBLESHOOTING.md:39`; `es/data/where-data-is-stored.md` |
| host process | **el proceso host** — `host` stays a loanword for the process and for compounds (`nombre de host`, `zona horaria del host`). `anfitrión` (20) is the adjective for the **machine or server** that runs Marinara: `la computadora anfitriona`, `el dispositivo anfitrión`, `el servidor anfitrión`, `el operador del anfitrión`. | `proceso anfitrión` for the OS process (0); `proceso principal` (1, and it means something else) | `es/TROUBLESHOOTING.md:330` "el **proceso host** está congelado"; `es/installation/ios-pwa.md:23` "la dirección del **servidor anfitrión**"; `es/FAQ.md:13` "la **computadora anfitriona**" |
| frozen / freeze | **congelado** (20) / **congelación** / **congelar**; Android's cached-app freezer is `el congelador de apps en caché`. | `bloqueado` for a frozen process — reserved and busy (51): blocked network traffic (`es/REMOTE_ACCESS.md`), blocked saves (`Guardado bloqueado`), disabled controls. `suspendido` as the term *(the pack uses the verb `suspende` for the action: "**suspende** todo el proceso de Termux")*; `helado` | `es/TROUBLESHOOTING.md:330,332` |
| crashed | **caído** / **se cae** | `colapsado`; `crasheado` | `es/TROUBLESHOOTING.md:330` "está **congelado**, no **caído**"; `es/TROUBLESHOOTING.md:369` "El contenedor Lite **se cae**" |
| unreachable | **inalcanzable** | `inaccesible`; `no disponible` | `es/TROUBLESHOOTING.md:330` "(Servidor **inalcanzable**)" |
| unset (table default) | **sin configurar** (7) — in the *Default* column of an env-var table. | `no establecido` (1 residual); `sin definir` (2 residual); `vacío` as the unset-default *(reserved: 143 uses, and it is the pack's own default-column word for English "empty" — `es/CONFIGURATION.md:124` `BASIC_AUTH_USER` \| `vacío`)*; `ninguno` *(reserved: 109 uses glossing the **None** option)* | `es/CONFIGURATION.md:238`; `es/REMOTE_ACCESS.md` |
| off (table default) | **desactivado** (206) | `apagado` *(23 — reserved for a device/feature being powered off, not for a table default)*; `no`; `false` | `es/CONFIGURATION.md:156` |
| unlimited (table default) | **ilimitado** (5) | `sin límite` (2 residual); `infinito` (1 residual) | `es/CONFIGURATION.md:155`; `es/lorebooks/token-budgets.md` |
| default (adj./adv.) | **predeterminado/a** (612 across all four inflections) / **de forma predeterminada** (180). | `por defecto` — **0 occurrences in the pack**; do not introduce it | `es/chats/guided-and-impersonate.md:36` "desactivado **de forma predeterminada**" |
| wins over / takes precedence | **tiene prioridad sobre** (2) is the prescribed form, **but the pack is not consistent**: the banned-looking `gana sobre` actually occurs 3× and `anula` 8×. Prefer `tiene prioridad sobre` in new text; do not retro-fit the existing three. See § 7 residual 7. | `prevalece sobre` (0) | `es/CONFIGURATION.md:71,238`; counter-examples `es/characters/choosing-your-persona.md:32`; `es/prompts/generation-parameters.md:136`; `es/agents/knowledge-sources.md:71` |
| lore / backstory | **trasfondo** (127) — also the head of the lorebook gloss `libro de trasfondo`. | `lore` in Spanish prose; `historia de fondo` (1); `mitología`. English `lore` does survive 16×, but **only** inside frozen labels (`**Selected lore**`, `**Linked lore**`), code identifiers (`lore_strict`, `{{lore}}`) and quoted English strings | `es/lorebooks/overview.md:3`; `es/development/hierarchical-locations-prd-v3.md:126` "Los nodos con respaldo de **trasfondo**"; frozen-label case `es/agents/hierarchical-maps.md:189` |
| directive/prompt-adjacent "hint" | **indicación** (17) — **reserved**; the pack spends it on a *signal / hint / cue / on-screen prompt* (motion hints, voice cues, schedule guidance, installer prompts, UI strings, a typeless event), never on an LLM prompt. | using `indicación` for `prompt` | The distinction is drawn explicitly at `es/development/localization.md:7`: "cambia los controles y las **indicaciones** de Marinara, no los **prompts** del modelo". Also `es/game/storyboard.md:60,180` "**indicaciones** de movimiento"; `es/development/optional-agent-packages.md:88` "la **indicación** sin tipo `spatial_context_refresh`"; `es/roleplay/narrative-director.md:7` |

---

## 4. Typography & punctuation

| Rule | Evidence |
| --- | --- |
| **Straight double quotes `"…"` are the pack standard** (1458 occurrences), used for quoted English UI strings, quoted output messages, and scare quotes. | `es/TROUBLESHOOTING.md:129` `"This parameter is sent to the model"`; `es/TROUBLESHOOTING.md:330` `"Opening chat..."` |
| **Curly quotes `“…”` are a residual** (8 pairs in **3** files). They cluster on *in-world example sentences* and *quoted concept phrases* in narrative dev docs. Do **not** introduce new ones; do **not** mass-convert the existing ones either (that would reflow untouched lines). Single curly quotes `‘ ’` have 0 occurrences. | `es/agents/hierarchical-maps.md:260` (2 pairs), `:261`, `:477`; `es/development/code-cleanup-audit.md:114,202,233`; `es/development/hierarchical-locations-prd-v3.md:375` |
| **Angle quotes `«…»` are never used** (0 occurrences). Do not "correct" the pack toward peninsular typographic style. | pack-wide grep: 0 hits |
| **Em dash `—` (67)** for parenthetical asides, set **unspaced-or-spaced as the English source had it**; the pack most often mirrors the English spacing. **En dash `–` (4)** only for numeric and time ranges. | `es/agents/hierarchical-maps.md:261` "al que se pueda volver —o su descubrimiento— puede agregarlo"; `es/agents/built-in-agents.md:200` "(128**–**16.384)"; `es/noodle/settings.md:217` "23:00**–**07:00" |
| **A colon frequently replaces the English em dash** when the aside is an explanation. This is the pack's habit and is fine to continue. | `es/TROUBLESHOOTING.md:330` "abres Termux**:** el proceso host está **congelado**" |
| **No invisible or exotic spacing characters anywhere**: U+00A0 NBSP **0**, U+202F narrow NBSP **0**, U+3000 ideographic space **0**, U+200B ZWSP **0**, U+200D ZWJ **0**, U+00AD soft hyphen **0**, tabs **0**. Spanish needs none of them, and any one would change file bytes and break the manifest hash silently. | pack-wide scan: 0 hits each |
| **The non-ASCII inventory is small and deliberate**: the six Spanish accented letters plus `ñ`/`ü`, `¿` `¡`, `—` `–` `…`, `→` (96) and `↓ ↑ ↔ ↘ ↙ ↺` in flow prose, box-drawing `─ │ ├ └` (66) in tree diagrams, `×` (4) in dimensions, `·` (1) as a table separator, `½` (1), a Greek `α` (1) in a LaTeX example, and a handful of emoji. A `ź` at `es/development/localization.md:44` is intentional — it is a **Polish** example string in the localization guide, not a defect. Anything outside this inventory in a diff is a mojibake or paste accident. | `es/media/comfyui.md:45` "`832×480`"; `es/development/localization.md:44` `"Napisz odpowiedź…"` |
| **Spanish opening marks are mandatory**: `¿` (52) on every interrogative, `¡` (3) on exclamations. Headings that are questions carry both marks. | `es/CONFIGURATION.md` "## **¿**Cuándo configurarías Marinara**?**" |
| **Numbers use es conventions in prose**: `.` as thousands separator (`16.384`, `8.000`, `4.000`), `,` as decimal separator (`1,5`). | `es/agents/built-in-agents.md:200` "(128–16.384)"; `es/game/combat.md:43` "multiplica el total por **1,5**" |
| **Numbers inside code, literals, versions, IPs, ports and paths are byte-exact and never reformatted**: `192.168.1.0/24`, `127.0.0.1`, `7860`, `2.4.5`, `` `0` ``, `` `1` ``, `` `2` ``, `` `8` ``. | `es/CONFIGURATION.md:115,116,155,156`; `es/INSTALLATION.md:43` |
| **Sentence terminators**: single `.`; no space before `.`, `,`, `:`, `;`, `?`, `!`. Spanish takes no French-style spacing. | pack-wide |
| **List mechanics**: bullets are `- `; ordered lists are `1.`/`2.`/`3.`; bullet text is a full sentence with a terminal period; a leading bold lead-in keeps the English source's bold span. | `es/CONFIGURATION.md:24-27`; `es/agents/hierarchical-maps.md:91,97,98` |
| **Markdown skeleton is untouchable**: fences, indentation, link targets, `#fragments`, backticked literals, table pipes and the source's column padding all stay byte-identical. Only prose, headings and **link text** translate. | branch `README.md` § "Updating a pack"; `es/FAQ.md:14` `[Acceso remoto](REMOTE_ACCESS.md)` — text translated, target untouched |
| **Link text is translated *by policy* but only unevenly *in practice*.** Of 910 internal `.md` links, **54 keep a fully English link text** across 15 files, and the same target is routinely linked under several different Spanish names. Translate link text in new work, and **match whatever the neighbouring links in that file already say** rather than standardising the pack. Do not sweep-fix the existing ones — see § 7 residual 8. | English residue: `es/chats/export-import.md:80-82` `[Importing from SillyTavern]` / `[Backup and Restore]` / `[Settings Overview]`. Divergence: `connecting-to-a-provider.md` is linked as `[Conectarse a un proveedor de IA]` (28), `[Conectar con un proveedor de IA]` (9), `[Conectar a un proveedor de IA]` (3), `[Connecting to an AI Provider]` (3), and two more |
| **No trailing whitespace and LF-only endings** — the shipped pack has 0 trailing-space lines and 0 CRLF files. | pack-wide grep |

---

## 5. UI labels & glosses

**The base rule: a UI label the app renders in English is reproduced byte-exact in English, and
the Spanish meaning goes in a parenthetical gloss after it.** The `es` app locale is only
partially translated (`es.json` ships **131 keys**), which is exactly why the pack keeps English
labels — the reader will see English on screen.

| Rule | Evidence |
| --- | --- |
| **Primary gloss pattern**: `**English Label** (Gloss en español)` — bold on the English only, gloss in plain text inside parentheses, sentence case, no terminal period inside the parens. | `es/agents/agents-overview.md:25` "**Download Agents** (Descargar agentes)"; `es/agents/approvals-and-agent-suite.md:71` "**Save** (Guardar)" |
| **The gloss is per-file, not once per pack.** `**Settings** (Configuración)` appears 53× across the pack — in exactly 53 distinct files, once each — because each guide re-glosses on its own first use. Inside a single file, the other 77 bare `**Settings**` spans are later repeats that drop the gloss. | `es/CONFIGURATION.md:59` — the file's single glossed `**Settings**`, against bare repeats at `:31,229,243,286,316`; `es/chats/chat-settings.md` and `es/agents/built-in-agents.md` have 0, because they gloss other labels instead |
| **Colon-carrying bold lead-ins put the gloss inside the bold**: `**Updates (Actualizaciones):**` — because the English source bolded the trailing colon too. | `es/CONFIGURATION.md:24-27` |
| **Menu paths gloss as a whole path**, with the separator preserved on both sides. The pack uses **three** separators, inherited from whatever the English source used — **`→`** (96, the most common inside bold labels), **`>`** (107 bold spans contain one) and ASCII **`->`** (52). Copy the source's separator; never normalise one into another, and keep the same one on both sides of the gloss. | `→`: `es/CONFIGURATION.md:20` "**Agents → Download Agents** (Agentes → Descargar agentes)". `>`: `es/development/localization.md:7` "**Settings > General > App Behavior > Language** (Configuración > General > Comportamiento de la app > Idioma)". `->`: `es/appearance/appearance-settings.md:3` "**Settings -> Appearance** (Configuración -> Apariencia)" |
| **Labels that need no gloss** are left bare: transparent cognates, proper subsystem names, and labels the surrounding sentence already explains. Do not force a gloss where the pack left one off. | `es/agents/hierarchical-maps.md:91` "**Create with AI**" (unglossed); `es/TROUBLESHOOTING.md:129` "**Advanced Parameters**" (unglossed, in the same sentence where **Chat Settings** *is* glossed) |
| **Quoted *strings* (not labels) use straight double quotes and no bold**, glossed only if the sentence needs it. | `es/TROUBLESHOOTING.md:129` `"This parameter is sent to the model"`; `es/TROUBLESHOOTING.md:330` `"Opening chat..."` |
| **When a gloss itself contains parentheses in the English label, use a colon instead of nesting parens.** | `es/TROUBLESHOOTING.md:330` "**Unreachable (request timed out)** (Inalcanzable**:** se agotó el tiempo de espera de la solicitud)" (nested-gloss precedent also exists at `es/agents/memory.md:39`) |
| **A gloss never replaces the label.** Never write only the Spanish for a control the reader must click. | `es/UPGRADING.md:156` "Si haces clic en **Apply Update**…" — bare English on repeat use |
| **Byte-exactness of the label is absolute**: capitalization, ellipsis style (`...` vs `…`), spacing, and internal punctuation are copied from the app string, not normalized. `"Opening chat..."` keeps three ASCII dots; `**Checking…**` and `**Creating backup…**` keep the single-glyph U+2026 ellipsis. All 16 U+2026 in the pack sit inside English UI labels or quoted strings — never in Spanish prose. | `es/TROUBLESHOOTING.md:330` (`...`); `es/UPGRADING.md:139` (`**Checking…**`), `es/UPGRADING.md:27` (`**Creating backup…**`); `es/characters/creating-and-editing-characters.md:29` (`**Uploading…**`, `**Embedding…**`, `**Saving…**`) |
| **Environment-variable names, commands, packages and file globs are never translated and never glossed inline**: `MARINARA_MAX_RESIDENT_CHATS`, `MARINARA_EAGER_STORAGE`, `UPDATES_APPLY_DISABLED`, `UPDATES_APPLY_ENABLED`, `termux-wake-lock`, `termux-wake-unlock`, `termux-tools`, `termux-api`, `Termux:API`, `server-*.log`, `DATA_DIR`. | `es/CONFIGURATION.md:155,156,238`; `es/TROUBLESHOOTING.md:324,326` |

---

## 6. Language-specific mechanics

| Rule | Evidence |
| --- | --- |
| **Gender comes from the Spanish carrier noun, never from the English loanword.** `el prompt`, `un token`, `un preset`, `un lorebook`, `un swipe`, `un hash`, `un wake lock`, `un checkout`, `el chat` are all masculine; `una API key`, `una conexión`, `la caché`, `una instantánea`, `una extensión`, `una persona` are feminine. | `es/chats/chat-settings.md:28`; `es/TROUBLESHOOTING.md:75,324` |
| **Loanwords pluralize with `-s` and stay unaccented**: `prompts`, `tokens`, `presets`, `lorebooks`, `swipes`, `hashes`, `NPC` (invariable acronym — **no** `NPCs`). | `es/lorebooks/overview.md`; `es/chats/branches.md:23`; `es/agents/built-in-agents.md:111` |
| **Article + English proper name**: contract normally (`del panel`, `al chat`), but never contract *into* the English name itself. Write `el botón **Apply Update**`, not `el **Apply Update**`. | `es/UPGRADING.md:151`; `es/characters/personas.md:19` |
| **Enclitic pronouns attach to imperatives and infinitives** and carry the accent when required: `tócala dos veces`, `quítale la optimización`, `arrástralo fuera`, `Ábrelo`, `inícialo de nuevo`. | `es/characters/library-organization.md:62,64`; `es/TROUBLESHOOTING.md:39,326` |
| **`se`-impersonal is the pack's default for system behavior** — `se ejecuta` (136), `se muestra` (76), `se envía` (47), `se guarda` (28), `se aplica` (25), `se cargan` (6), `se descarta` (2). Prefer it over an invented agent. | `es/CONFIGURATION.md:155` "los chats **se cargan** cuando se abren"; `es/agents/hierarchical-maps.md:234` "El movimiento **se guarda** con el turno"; `es/extending/custom-tools.md:63` "**se descarta** al guardar" |
| **Compound English feature names do not get hyphenated or hispanicized**: `Game Mode`, `World Info`, `Global Gallery`, `Card Browser`, `Local Model`. | `es/game/getting-started.md:1`; `es/characters/bot-browser.md:9` |
| **Adjective agreement follows the Spanish noun even when the noun is a loanword**: `el prompt ensamblado` (3), `los lorebooks vinculados` (11), `los presets integrados`, `apps en caché`. The loanword takes the gender assigned in § 3 and the adjective agrees with *that*, not with the English word. | `es/development/frontend.md:158` "el **prompt ensamblado**"; `es/lorebooks/linking-to-characters.md` "**lorebooks vinculados**"; `es/data/importing-from-sillytavern.md:63` "los **presets integrados**"; `es/TROUBLESHOOTING.md:330` "**apps en caché**" |
| **`de` + English name** is the standard genitive: `el lanzador **de** Termux`, `el editor **de** mapas`, `la notificación **de** Termux`, `el congelador **de** apps en caché`. No Saxon-genitive calques. | `es/CONFIGURATION.md:276`; `es/agents/hierarchical-maps.md:148`; `es/TROUBLESHOOTING.md:330,332` |
| **Capitalization is Spanish, not English**: only the first word of a heading/sentence and proper nouns. Never title-case a translated heading to match the English source's title case. | `es/CONFIGURATION.md` "## Referencia completa de variables de entorno" |

---

## 7. QA checks & known traps

### Mechanical checks (run before committing a pack edit)

1. **`git diff` scoped to `es/` must show only the intended hunks.** No reflowed lines, no
   whitespace-only lines, no reformatted tables. *(Cycle ruling — `i18n-brief.md`; and the shape
   the 2026-09-01 delta actually shipped in, per `prd-notes-es.md`.)*
2. **Rebuild and re-validate the manifest**, or the pack fails integrity on the client, which
   verifies every file by `sha256` **and** `bytes`:
   `node scripts/docs-i18n/build-manifest.mjs <path>/es --source-commit <engine-sha>` then
   `node scripts/docs-i18n/validate-pack.mjs <path>/es`. *(Evidence: `es/manifest.json` carries
   per-file `sha256` + `bytes`; procedure from the branch `README.md`.)*
3. **Invisible-character sweep**: `grep -P "\xc2\xa0"` must return 0 (NBSP), trailing-space
   `grep -n " $"` must return 0, and no file may gain CRLF. All three are 0 in the shipped pack;
   any of them silently changes the hash. **On Windows, a PowerShell redirect or
   `Set-Content` without `-Encoding utf8` will rewrite the file as ANSI/UTF-8-BOM and corrupt
   every accented character** — edit with UTF-8-aware tooling only.
4. **Frozen-literal diff**: every `MARINARA_*` / `UPDATES_*` name, `termux-*` command or package,
   `Termux:API`, `server-*.log`, backticked numeric literal, version string (`2.4.5`), IP, port
   and path must be identical to the English source. `diff <(grep -o '`[^`]*`' docs/X.md) <(grep
   -o '`[^`]*`' es/X.md)` is the cheap version of this check.
5. **Link-target diff**: translated link *text*, byte-identical link *targets* including
   `#fragments`. A translated fragment is a silently dead link.
6. **Table-shape check**: same number of `|` per row as the English source, and column padding
   matched to the neighboring rows in the *pack* file (the pack's padding is its own, not the
   English file's).
7. **Terminology sweep** over the § 3 banned column. These are genuinely **0** in the shipped
   pack and must stay 0: `por defecto`, `ordenador`, `computador`, `fichero`, `vídeo` (accented),
   `celular`, `transmisión`, `PNJ`, `preajuste`, `ajuste predefinido`, `bitácora`, `desalojo`,
   `evicción`, `salvaguarda`, `macroinstrucción`, `suministrador`, `iniciador`, `arrancador`,
   `memoria caché`, `el caché`, `la prompt`, `perfil de usuario`, `deslizamiento`, `«`, `usted`,
   `vosotros`. Do **not** assert 0 for terms this glossary marks *reserved* (`indicación`,
   `aviso`, `ficha`, `plantilla`, `enlace`, `asistente`, `conversación`, `borrador`, `flujo`,
   `avatar`, `resumen`, `captura`, `vacío`, `ninguno`, `bloqueado`) — they are legitimately
   present in another sense, and a zero-expectation there produces false alarms.
8. **Gloss-pattern check**: every newly introduced bold English label either has a
   `(gloss)` on its first appearance in that file, or matches an unglossed precedent in the
   same file.

### Counting traps (they bit the re-derivation of this glossary)

- **Word boundaries must be accent-aware.** A JS/PCRE `\b` or `\w` treats `á é í ó ú ñ ü` as
  non-word characters, so `\bvideo\b` matches *inside* `vídeo`, and `\btoca\b` matches inside
  `tócala`. Count with an explicit Unicode letter class (Python `[^\W\d_]` with `re.UNICODE`,
  or `grep -P` with `\p{L}`). The same trap is recorded for `ru`, where `\w` misses Cyrillic
  entirely — do not copy an ASCII-`\w` recipe between packs.
- **Count case-insensitively when the term can start a sentence or a heading.** The masculine
  `macro` forms were undercounted 15→7 by a case-sensitive grep, because `Un macro…` and
  `### El macro {{user}}` were skipped.
- **Separate singular from plural before quoting a number.** `archivo` 406 and `archivos` 266
  are different facts; a combined 672 supports neither claim.
- **On Windows, use a UTF-8-aware reader.** `Get-Content`/`Select-String` under the ANSI
  codepage silently mis-decodes every accented character and returns wrong counts.

### Known traps

- **`persona` collides with the ordinary Spanish word.** In a sentence about people, `una
  persona` reads as "a person". Every guide that introduces the feature defines it explicitly
  first (`Una persona es tu propia tarjeta de personaje…`). Never introduce the feature term
  without that definition. Evidence: `es/characters/personas.md:3,7`;
  `es/conversation/profiles.md:5`.
- **`indicación` is a false friend for `prompt`.** The pack already spends `indicación` on
  *hint / cue / signal / on-screen prompt*. One sentence contrasts the two senses directly and
  settles it: `es/development/localization.md:7` — "cambia los controles y las **indicaciones**
  de Marinara, no los **prompts** del modelo". `es/game/storyboard.md` carries both senses in
  the same file (`:60,180` motion hints vs. `:200` illustration prompts).
- **`ficha` is spent on UI chips and tiles**, so it cannot be recycled for `token` — poker chips
  (`es/conversation/table-games.md:112,114,122`), attachment chips
  (`es/chats/sending-and-streaming.md:32`), emoji and sticker tiles
  (`es/conversation/emoji-stickers-gifs.md:42,50,51,68`) and recent-chat tiles
  (`es/home/welcome.md:14`).
- **`asistente` is not free either.** It carries the assistant *chat role*
  ("mensajes del usuario y del **asistente**"), *setup wizards* ("el **asistente** New Game
  Setup") and Professor Mari. An Engine agent is always `agente`; `ayudante de IA` is the gloss,
  not a synonym. Evidence: `es/agents/built-in-agents.md:17`;
  `es/characters/choosing-your-persona.md:48`; `es/FAQ.md:161`.
- **`enlace` means hyperlink, and `puerta de enlace` means gateway.** It appears exactly once in
  the *definition* of a connection and must not be promoted into the term. Evidence:
  `es/INSTALLATION.md:27`; `es/REMOTE_ACCESS.md:17`; `es/chats/chat-settings.md:28`.
- **`respaldo` means *fallback*, not *backup*, in this pack.** Evidence:
  `es/development/localization.md` "el respaldo en tiempo de ejecución" vs.
  `es/data/backup-and-restore.md:9` "copia de seguridad".
- **`rama` vs `bifurcación`**: `rama` = message branch / git branch; `bifurcación` = GitHub
  fork. Swapping them makes contributor docs wrong. Evidence: `es/chats/branches.md:23`;
  `es/development/localization.md`.
- **Do not back-port `es.json` wording into the pack.** The app locale translates mode names
  (`Ayuda de Conversación`, `Ayuda de Juego`) while the pack deliberately keeps
  `modo Conversation` / `Game Mode`. With only 131 translated keys, most labels still render in
  English, which is precisely what the pack's English-label-plus-gloss convention assumes.
  *(Cycle ruling; cross-source evidence: `packages/client/src/localization/locales/es.json` vs.
  `es/appearance/card-css-theming.md:211` and `es/game/getting-started.md:1`.)*
- **Do not "fix" unrelated pre-existing pack issues while mirroring a delta.** That work is
  tracked separately; touching it inflates the diff and breaks check 1.
  *(Cycle ruling — `i18n-brief.md`.)*
- **Naturalness critiques are out of scope for `es`.** The pack is literal by history and the
  maintainer deferred the naturalness pass. Report calques; do not unilaterally de-calque.
  *(Recorded maintainer ruling.)*

### Known pack residuals (documented, not silently fixed)

1. **`macro` gender is mixed** — counting case-insensitively, feminine dominates 48–15
   (`las macros` 22, `una macro` 13, `la macro` 11, `esta macro` 2) but masculine survives
   (`los macros` 8, `el macro` 4, `un macro` 3), including a heading
   (`### El macro {{user}}`) two lines above `Un macro es un marcador de posición`. The split is
   roughly per-file: `es/prompts/macros.md` is feminine throughout, while
   `es/characters/personas.md` and `es/conversation/profiles.md` are masculine throughout.
   Evidence: `es/characters/personas.md:11,13`; `es/conversation/profiles.md:22`;
   `es/prompts/macros.md`.
2. **`snapshot` is untranslated in one dev doc** — `es/development/architecture-map.md:95`
   "persistencia de **snapshots** JSON" against `es/development/file-storage.md:39` "las
   **instantáneas** de las tablas" (`instantánea` 43 pack-wide). This is the only genuine
   instance. Of the 59 `snapshot` hits in total, 57 are in
   `es/development/hierarchical-locations-prd-v3.md` and are identifier-adjacent, and one
   (`es/home/professor-mari.md:86`) is inside a quoted English app message
   ("Restored the previous app data snapshot.") — neither is the same defect.
3. **`clave API` appears once** (`es/media/tts-setup.md:64`) against `clave de API` 26 times.
4. **Eight curly-quote pairs** survive in **three** files against 1458 straight quotes. Evidence:
   `es/agents/hierarchical-maps.md:260` (two pairs), `:261`, `:477`;
   `es/development/code-cleanup-audit.md:114,202,233`;
   `es/development/hierarchical-locations-prd-v3.md:375`.
5. **Mirror-cycle note vs. shipped text — `checkout`.** `prd-notes-es.md` records the intent to
   use `copia de trabajo` for *checkout*, citing `es/agents/hierarchical-maps.md`. The line that
   actually shipped reads "nunca pueda reescribir un **checkout** de desarrollo"
   (`es/CONFIGURATION.md:238`). **The pack is ground truth**: `checkout` (git) and `copia de
   trabajo` (editor buffer) are two distinct terms, as recorded in § 3. The note's citation was
   to the *editor-buffer* sense.
6. **`Game Mode` is not glossed anywhere**, unlike `modo Conversation` (glossed once as
   "Conversation (conversación)"). This is consistent with treating `Game Mode` as a frozen
   product name, but the asymmetry is deliberate to record. Evidence:
   `es/game/getting-started.md:1`; `es/integrations/discord-mirror.md:3`.
7. **`gana sobre` outnumbers the prescribed `tiene prioridad sobre` 3–2.** The § 3 row keeps
   `tiene prioridad sobre` as the form for new text, but the pack is genuinely split and the
   three counter-examples are not defects to sweep. Evidence: prescribed at
   `es/CONFIGURATION.md:71,238`; counter-examples at
   `es/characters/choosing-your-persona.md:32`, `es/prompts/generation-parameters.md:136`,
   `es/agents/knowledge-sources.md:71`. `anula` (8) is a third, milder variant.
8. **Link text is unevenly translated.** 54 of 910 internal `.md` link texts are still fully
   English (15 files), and several targets are linked under many different Spanish names:
   `getting-started.md` has 15 distinct link texts, `overview.md` 10, `REMOTE_ACCESS.md` 7,
   `agents-overview.md` 7, `connecting-to-a-provider.md` 6. Both halves are pre-existing debt,
   out of scope for a delta. Evidence: `es/chats/export-import.md:80-82`;
   `es/conversation/getting-started.md:29,49,152`; `es/integrations/home-assistant.md:12`.
9. **`NPCs` with a Spanish plural `-s` reaches translated link text twice** —
   `[Game Mode: Grupo y NPCs](party-and-npcs.md)` at `es/game/combat.md:102` and
   `es/game/dice-and-skill-checks.md:107` — against `los NPC` (10) and `NPCs` 0 in running
   prose. The other four `NPCs` are frozen English labels and are correct.
10. **The `Release Channel` label is glossed two different ways.**
    `es/UPGRADING.md:128` gives "(Canal de lanzamiento)"; `es/installation/windows.md:201` gives
    "(Canal de versiones)". Only two occurrences carry a gloss, so neither is dominant. Match the
    file you are editing; this is the clearest live counter-example to the
    one-term-per-concept ruling in the appendix.
11. **Capitalised heading-case leaks into two link texts** — `[Game Mode: Primeros pasos]`
    (8×, e.g. `es/TROUBLESHOOTING.md:212`) against `[Game Mode: primeros pasos]` (11×, e.g.
    `es/agents/hierarchical-maps.md:541`), for the same target and the same Spanish words. The
    lowercase form matches the § 6 capitalization rule and the actual heading at
    `es/game/getting-started.md:1`.

---

## Appendix — recorded rulings carried without in-pack evidence

These are process/QA rulings from the original cycle, PR #4100, or the 2026-09-01 mirror cycle.
They govern how the pack is edited, not what words it contains, so the pack itself cannot
demonstrate them:

- Informal `tú`, gender-neutral-where-natural, and established-loanwords-kept were the original
  cycle's stated register policy (each is *also* independently pack-verified above).
- **One standardized Spanish term per concept**, adopted so the docs viewer's literal-substring
  search and hit counts stay consistent across the pack (PR #4100). **This is the stated intent,
  not an achieved property of the shipped pack** — § 7 records the live exceptions (`macro`
  gender, the `Release Channel` gloss, `canal de versiones`/`canal de versión`,
  `tiene prioridad sobre`/`gana sobre`, and the link-text divergence). Honour the ruling in new
  text; do not use it to justify sweeping the existing pack.
- **Community loanwords are kept on purpose** — *prompt, preset, lorebook, swipe* named
  explicitly in PR #4100.
- **The pack skews literal by history; naturalness critiques were deliberately deferred by the
  maintainer.** This glossary describes the pack as shipped.
- **If `es` is ever revisited, the `de` glossary's anti-calque approach is the template.**
- **Translation QA procedure** used for the original pack: per-file structural verification,
  terminology-consistency sweeps, and an independent language-QA panel over 20 representative
  guides (PR #4100).
- **Delta discipline**: mirror the English anchor placement exactly, match the pack file's own
  table padding, never reflow untouched lines, and never fix unrelated pre-existing pack issues
  in a delta PR (`i18n-brief.md`, 2026-09-01 cycle).

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, translate a native NovelAI character caption as
**descripción de personaje**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.
