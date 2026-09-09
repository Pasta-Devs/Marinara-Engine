# Marinara Engine — glossaire du pack de documentation `fr`

## Provenance

This is the **second-generation** glossary for the French documentation pack. The
original working glossary written during the shipping cycle was lost to
temp-directory cleanup and is not recoverable.

It was **re-derived on 2026-09-01** from three sources, in authority order:

1. **The shipped pack itself** (`docs-i18n` branch, `fr/`, 125 Markdown files) —
   treated as ground truth. Every terminology row and typography rule below was
   re-verified by scanning the pack as shipped, and cites at least one
   `path:line` from it.
2. **The decision write-up of the pack's shipping PR**, Pasta-Devs/Marinara-Engine
   **#4191** ("Translation approach", "Validation done") — for rulings the pack
   content cannot show on its own.
3. **The 2026-09-01 mirror-cycle terminology notes** (`prd-notes-fr.md`), whose
   per-row choices were made against this same pack three hours before this
   glossary was written, plus the recorded decision ledger carried in project
   memory.

Supporting reference: `CONTRIBUTING.md § Translated documentation` on `staging`
(French per-language conventions), and the app locale file
`packages/client/src/localization/locales/fr.json`.

Rules are marked one of two ways:

- **[pack]** — verified against the shipped pack, with evidence.
- **[ruling]** — a recorded maintainer/cycle decision that the pack content
  cannot demonstrate (process, rationale, QA disposition). Kept because it was
  decided, not because it can be proven from the files.

Line numbers are those of the pack as it stands on 2026-09-01. If a file is
re-translated, re-verify before citing.

**Verification pass, 2026-09-01.** Every terminology row was re-scanned for both
its prescribed term *and* its banned alternates, by codepoint, over all 125
files. Corrections made in that pass, so the counts below are the scanned ones:
the `tag` row was split into four (the pack uses `tag`, `étiquette` and
`libellé` as standing terms, not banned ones); `curseur`/`pointeur` was split
(the pack's `curseur` is overwhelmingly a *slider*); `actualisation` was
promoted to its own **refresh** row; `figé` was split off from the Android
`gel`; several flat bans were narrowed to the sense actually meant, with their
other senses recorded so a future sweep does not "fix" correct prose; and the
counts in §2.1, §2.3, §2.6, §3.7, §4.7, §4.15, §5.2, §5.7 and Q7 were corrected
to the measured values. R4 was found to be wider than recorded, and R6 is new.

---

## 1. Register & address

| # | Rule | Status | Evidence |
| --- | --- | --- | --- |
| 1.1 | **Tutoiement throughout.** Second person singular, everywhere, including reference tables and developer docs. 1 148 occurrences of `tu`, 936 of `ton/ta/tes`. | [pack] | `CONFIGURATION.md:3` "un réglage que tu écris dans un fichier texte simple" |
| 1.2 | **Instructions are singular imperatives**, usually line-initial in steps and bullets: `Ouvre`, `Clique`, `Choisis`, `Active`, `Définis`, `Installe`, `Vérifie`. 211 line-initial instances. | [pack] | `FAQ.md:61` "Ouvre un chat Conversation et choisis **Schedule timezone**" |
| 1.3 | **Never `vous`, `votre`, `vos`, or `-ez` imperatives** in new or edited prose. The pack's remaining instances are known residuals, listed in §8. | [pack] | Clean baseline: `CONFIGURATION.md`, `FAQ.md`, `INSTALLATION.md`, `REMOTE_ACCESS.md` contain zero |
| 1.4 | **Warm, plain, explanatory tone.** Jargon is defined the first time it appears in a file rather than assumed (see §7.2). | [pack] | `TROUBLESHOOTING.md:12` "Le prompt, c'est le texte que Marinara envoie à l'IA" |
| 1.5 | **No inclusive-writing punctuation.** Zero midpoints (`utilisateur·rice`), zero parenthesised endings (`développeur(euse)`), zero doublets (`celles et ceux`). | [pack] | 0 matches pack-wide for `[a-z]·[a-z]` and `\w+\(e\)s?` |
| 1.6 | **Generic masculine for the reader-class noun**; where the role matters, use a periphrasis instead of a gendered doublet: `la personne qui exploite le serveur`, `la personne qui gère le serveur`. | [pack] | `CONFIGURATION.md:61`; `installation/ios-pwa.md:77` |
| 1.7 | **Named entities keep their real-world gender agreement.** Professor Mari is feminine (`seule Professor Mari peut...`, `l'assistante intégrée`). | [pack] | `FAQ.md:143`, `FAQ.md:161` |
| 1.8 | **Do not import register from `packages/client/src/localization/locales/fr.json`.** That file is vouvoiement (`Consultez le prompt utilisé...`), covers only 132 of 9 123 keys (~1.4 %), and uses curly apostrophes. The docs register is independent of it. | [ruling] (locale facts verified) | `fr.json` → `chat.help.actions.prompt`, `chat.help.targets.agents.body` |
| 1.9 | **Register applies to prose only.** Text inside code fences, JSON samples, log excerpts, and byte-exact English UI labels is never re-registered. | [pack] | `CONFIGURATION.md:44-50` (JSON sample untouched) |

---

## 2. Product, feature & mode names

| # | Rule | Status | Evidence |
| --- | --- | --- | --- |
| 2.1 | **`Marinara Engine` and `Marinara` are frozen**, never translated, never inflected, and take **no article**: `de Marinara Engine`, `sur Marinara Engine` — never `du Marinara Engine`. `Marinara Engine` occurs 248 times; `de Marinara` 182 times; **`du Marinara` 0 times**, which is the check that matters. | [pack] | `INSTALLATION.md:1` "# Installation de Marinara Engine"; `FAQ.md:3` |
| 2.2 | **Mode names stay English: `Conversation`, `Roleplay`, `Game Mode`.** Never `mode Jeu`, `Jeu de rôle`, `mode Conversation` as a translation. (284 `Game Mode`, 406 `Roleplay`, 418 `Conversation`.) | [pack] + PR #4191 | `FAQ.md:53-55`; `CONFIGURATION.md:205` |
| 2.3 | **Carrier patterns for mode names**, all attested — pick by sentence rhythm, do not invent a fifth: `en Game Mode` (60), `en Roleplay` (48), `en mode Conversation` (62), `le mode Roleplay` (12), `les chats Roleplay` (11). | [pack] | `FAQ.md:175` "Pour t'en servir en Game Mode"; `chats/group-chats.md:69` "Qui parle : le mode Roleplay"; `characters/sprites.md:141` |
| 2.4 | **Feature and product sub-names stay English**: `Noodle`, `Professor Mari`, `Memory Recall`, `Chat Summary`, `Knowledge Retrieval`, `Storyboard`, `Local Whisper`, `Agent Suite`, `Danger Zone`. | [pack] | `FAQ.md:119` (Noodle), `FAQ.md:127-128`, `CONFIGURATION.md:31` |
| 2.5 | **Agent package names stay English**, including inside French sentences and heading text: `Character Tracker`, `Beholder`, `Calls`, `Illustrator`. | [pack] | `agents/built-in-agents.md:111`, `:123`, `:276` |
| 2.6 | **`GM` is the term (113); `maître du jeu` is only the first-use gloss** — glossed per file, not once pack-wide (19 glosses across 17 files, per §5.5). Never `MJ` (0). | [pack] | `FAQ.md:55` "un Game Master (le maître du jeu)"; `agents/hierarchical-maps.md:516`; thereafter bare `GM` (`FAQ.md:173-177`) |
| 2.7 | **Doc-set section names in link text are translated**, because they are prose, not UI: `[Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md)`. | [pack] | `FAQ.md:204`; `CONFIGURATION.md:335` |
| 2.8 | **File names, paths, env-var names, CLI commands, and URLs are never translated or re-cased.** | [pack] | `CONFIGURATION.md:88` (`start.bat`, `start.sh`, `start-termux.sh`); `TROUBLESHOOTING.md:433` |

---

## 3. Core terminology

Format: **English** | **pack term (gender)** | **banned alternates** | **evidence**.

### 3.1 Prompting & model vocabulary

| English | This pack | Banned | Evidence |
| --- | --- | --- | --- |
| prompt | **le prompt** (m.) | `amorce` (0); `invite`, `requête`, `consigne` **in this sense only** — each is a live pack word elsewhere: `invite`/`inviter` (23 uses, none of them *prompt*: `invite de commandes` = Windows command prompt at `installation/windows.md:66`, plus Noodle **Invites** and the verb "t'invite à"), `requête` = network/HTTP request (129, e.g. `CONFIGURATION.md:208`), `consigne` = guidance/instruction (24, e.g. **Stored guidance** → `consigne enregistrée` at `chats/messages.md:21`) | `CONFIGURATION.md:183` "voir le prompt exact envoyé au modèle" |
| token | **le token** (m.), plural `les tokens` | **`jeton`** for an LLM token (0). All 13 `jeton` uses are other senses and are correct: poker chips (`conversation/table-games.md:109`), CSS design tokens (`appearance/card-css-theming.md:282`), selection tokens (`CONFIGURATION.md:244`), **interpolation tokens `{{name}}`** (`development/localization.md:65`, `:73`, `:92`), **OAuth access token** (`connections/providers-reference.md:51`) | `agents/agents-overview.md:55` "Un token est un petit morceau de texte" |
| token budget | **budget de tokens** | `budget de jetons` | `agents/hierarchical-maps.md:678` |
| preset | **le preset** (m.) | `préréglage` (0), `profil` (a distinct object — see next row); `prédéfini` in this sense (its 1 use, `development/frontend.md:338` "échantillons prédéfinis" = preset colour swatches, is a different sense and is fine) | `chats/chat-settings.md:55` "le mot **preset** désigne uniquement les presets de prompt" |
| settings profile | **le profil de réglages** | `preset` | `chats/chat-settings.md:38`, `:55` |
| generation parameters | **les paramètres (de génération)** | `réglages` in this sense | `TROUBLESHOOTING.md:129` "Le modèle refuse un paramètre" |
| embedding | **l'embedding** (m.), glossed *une représentation numérique du texte* | `plongement`, `vecteur` | `CONFIGURATION.md:208`; `connections/local-model.md:13` |
| streaming | **le streaming**, glossed *l'affichage au fil de l'écriture* | `diffusion en continu` | `TROUBLESHOOTING.md:132` "en cours de streaming, c'est-à-dire d'affichage au fil de l'écriture" |
| macro | **la macro** (f.) | `raccourci` **in this sense only** — the pack's 17 `raccourci` uses are desktop shortcuts, keyboard shortcuts and slash-command shortcuts, and are all correct (`INSTALLATION.md:26`, `chats/slash-commands.md:3`) | `characters/personas.md:13`, `conversation/profiles.md:22` |
| placeholder (macro in user text) | **l'espace réservé** (m.) | `marqueur` in this sense | `chats/guided-and-impersonate.md:88` "Une macro est un espace réservé que Marinara remplace" |
| placeholder (ComfyUI/LTX workflow) | **le placeholder** (m., kept English) | `marqueur`, `balise de remplacement` — see residual R3 in §8 | `media/comfyui.md:55` "## Ajouter les placeholders de Marinara"; `game/ltx-2-3-storyboards.md:96` |
| marker (prompt section / map pin) | **le marqueur** | — | `agents/built-in-agents.md:196` "le placement du contexte rappelé sur un marqueur de preset"; `agents/hierarchical-maps.md:841` |
| tag (XML/HTML/thinking/macro delimiter) | **la balise** (f.), 32 uses | `tag` and `étiquette` **in this markup sense only** — see the three rows below, which are the other senses and are not banned | `chats/sending-and-streaming.md:98` "**Thinking Tags** (balises de réflexion)"; `prompts/presets.md:122`; `development/ios-pwa-safe-area.md:17` (meta tag) |
| tag (metadata label on a character, chat, background or lorebook entry) | **le tag** (m.), plural `les tags` — 166 uses, the pack's standard term; glossed *une étiquette* | `balise` in this sense; `mot-clé` (reserved for lorebook trigger keys and agent **Activation Keywords**, 90 uses) | `characters/library-organization.md:86` "Les tags sont des étiquettes que tu ajoutes à un personnage"; `chats/managing-chats.md:101`; `characters/bot-browser.md:53` "## Filtrer par tags" |
| label / caption / badge (visible UI text *about* a control or state) | **l'étiquette** (f.), 60 uses | — | `appearance/chat-backgrounds.md:29` "avec l'étiquette **Library**"; `game/party-and-npcs.md:77` "Les étiquettes de réputation des PNJ"; `characters/bot-browser.md:49` |
| label (the caption a button or field displays) | **le libellé** (m.), 15 uses — narrower than `étiquette`: the text a control itself shows | — | `characters/creating-and-editing-characters.md:29` "Son libellé indique l'état en cours"; `game/hud-widgets.md:74` "**Label** (libellé)" |

### 3.2 Content objects

| English | This pack | Banned | Evidence |
| --- | --- | --- | --- |
| lorebook | **le lorebook** (m.), glossed *un recueil de faits sur ton univers* | `livre de lore` (0), `encyclopédie` (0); `codex` in this sense — its 6 uses are all the OpenAI **Codex** CLI product name (`connections/subscription-clis.md:55-74`) and must not be "corrected" | `FAQ.md:105`; gloss at `characters/personas.md:101` |
| (lorebook) entry | **l'entrée** (f.) | `fiche` in this sense | `FAQ.md:105`, `lorebooks/entries.md` |
| World Info | **World Info** (frozen) | `Infos du monde` | `FAQ.md:105` "un ensemble d'entrées de World Info" |
| character card | **la fiche de personnage** | **`carte de personnage`** (0 occurrences) | `FAQ.md:99` "## Qu'est-ce qu'une fiche de personnage ?" |
| character | **le personnage** | `perso`, `bot` | `FAQ.md:101` |
| persona | **le persona** (m.), 59 uses | **`la persona`** for the French common noun, `le profil`. Note the pack does have 3 feminine agreements, all on the **capitalised English UI object** `Persona`, which is a different thing and is left alone: `la Persona Library` (`characters/personas.md:23`), `la Persona du joueur` (`development/optional-agent-packages.md:71`), `la Persona sélectionnée` (`extending/writing-personal-extensions.md:144`) | `FAQ.md:107`; `characters/personas.md:7` |
| chat | **le chat** (m.) | `discussion` for the chat object; `conversation` (reserved for the mode name). The pack's 2 `discussion` uses are other senses and are fine: a narrative event (`agents/hierarchical-maps.md:832`) and "au fil de la discussion" (`integrations/discord-mirror.md:3`) | `CONFIGURATION.md:148`; `FAQ.md:53` |
| message | **le message** | — | `chats/messages.md`; `FAQ.md:101` |
| greeting / first message | **la salutation**; the character's opening line is **le message d'accueil** | `accueil` alone | `characters/creating-and-editing-characters.md:75` (`First Message` → message d'accueil); `chats/sending-and-streaming.md:54` (`salutations`) |
| swipe (alternate response) | **le swipe** (m.), 105 uses, glossed *une réponse alternative* | `variante`; `balayage` for the response object — but `le balayage tactile` is correct for the **physical touch gesture**, and the pack uses both in one line: `settings/settings-overview.md:97` "**Intuitive swipe navigation** (navigation intuitive entre les swipes) : ... ou le balayage tactile" | `chats/messages.md:17` "une nouvelle réponse alternative, un swipe"; `chats/branches.md:23` |
| sprite | **le sprite** (m.), glossed *l'image du personnage sur le plateau* | `lutin` | `installation/windows.md:156`; `TROUBLESHOOTING.md:188` |
| storyboard | **le storyboard** (m.) | `scénarimage` | `FAQ.md:177`; `TROUBLESHOOTING.md:200` |
| library (of characters/agents) | **la bibliothèque** | **`librairie`** (0 occurrences — false friend) | `agents/agents-overview.md:23` "C'est ta bibliothèque" |
| spellbook | **le grimoire** | `livre de sorts` | `roleplay/combat-encounters.md:37` |

### 3.3 Agents, connections, providers

| English | This pack | Banned | Evidence |
| --- | --- | --- | --- |
| agent | **l'agent** (m.) | `bot` as a synonym for agent or character — its 16 uses are the `bot-browser` route/file names and poker "bot" players (`conversation/table-games.md:49`), which are fine. **`assistant` is not banned**: the pack uses it freely to gloss what an agent is ("un petit assistant IA", `agents/built-in-agents.md:7`, `agents/custom-agents.md:3`) and for setup wizards ("l'assistant **New Game Setup**"); just do not use it as *the* standing noun for an agent | `FAQ.md:115` "Un **agent** est une aide IA facultative" |
| tracker | **le tracker** (m.) | `traqueur`, `suivi` | `agents/agents-overview.md:19`, `:50` |
| pipeline phase | **la phase du pipeline** | `étape du traitement` | `agents/agents-overview.md:15` |
| connection | **la connexion** (f.) | `connecteur` | `FAQ.md:67`; `CONFIGURATION.md:118` |
| provider | **le fournisseur** | `prestataire`, `provider` | `FAQ.md:71` "Quels fournisseurs d'IA sont pris en charge ?" |
| to support (a feature/provider) | **prendre en charge** | **`supporter` / `supporté`** (0 occurrences — false friend) | `FAQ.md:73` "Marinara prend en charge de nombreux fournisseurs" |
| package (Marinara capability package) | **le package** (m.) | `paquet` in this sense — see residual R4 in §8 | `CONFIGURATION.md:22` "Cycle de vie et stockage des packages"; `FAQ.md:115` |
| package (npm / OS / pnpm) | **le paquet** | `package` in this sense | `TROUBLESHOOTING.md:18` "pnpm est le gestionnaire de paquets" |
| NPC | **le PNJ** | `NPC` in French prose (English only inside byte-exact UI labels such as **Auto-Generate NPC Avatars**) | `agents/hierarchical-maps.md:459`; `game/combat.md:102`; label at `agents/built-in-agents.md:115` |
| party (Game Mode) | **l'équipe** (f.), 75 uses | `groupe` **for the party specifically** — `groupe` itself is a general pack word (132 uses: group chats, "un petit groupe de réglages", "le groupe **Writer Agents**") and is not banned outside this sense | `game/getting-started.md:82` "**Talk to Party** (parler à l'équipe)" |

### 3.4 Install, update, runtime

| English | This pack | Banned | Evidence |
| --- | --- | --- | --- |
| launcher | **le lanceur** | `démarreur`, `launcher` | `CONFIGURATION.md:88` "Les lanceurs shell (`start.bat`, `start.sh`, `start-termux.sh`)" |
| update (noun, software) | **la mise à jour**, 172 uses | `update`; `actualisation` **in this sense only** — see the next row | `CONFIGURATION.md:24` |
| refresh (noun/verb — reloading content, not upgrading software) | **l'actualisation** (f.) / **actualiser**, 29 uses — a distinct concept the pack keeps separate from `mise à jour` | `mise à jour` in this sense | `noodle/overview.md:115` "Avant qu'une actualisation fonctionne"; `agents/memory.md:64` "L'icône d'actualisation"; `roleplay/hud-and-trackers.md:70` "un petit bouton d'actualisation"; **Refresh voices** → `media/tts-setup.md:64` |
| to apply an update | **appliquer une mise à jour** | `installer` in this sense | `CONFIGURATION.md:237` "Autorise le navigateur à appliquer les mises à jour ordinaires" |
| release channel | **le canal (de publication)**, 17 uses | `canal de diffusion`; `chaîne` **in this sense only** — the pack's 33 `chaîne` uses are *string* (`chaîne JSON`, `chaîne vide`, `recherche par chaîne`) or *chain* (`chaîne audio de l'appel`, `chaîne de parents`) and are all correct | `UPGRADING.md:128` "**Release Channel** (canal de publication)"; `TROUBLESHOOTING.md:351` |
| checkout (a git working tree) | **`"git checkout"` kept English**, glossed once per file as *une copie installée avec l'outil Git* | `caisse`, `extraction`, `paiement` | `UPGRADING.md:33`; also `UPGRADING.md:37` |
| working copy (editor draft) | **la copie de travail** | `brouillon de travail` | `agents/hierarchical-maps.md:107`, `:156`, `:260` |
| build (a compiled release **artifact**) | **la build** (f.), 34 uses | `version compilée`; `compilation` for the artifact — but **`la compilation` is correct for the compiling *process***, which is how all 9 of its uses read (`TROUBLESHOOTING.md:35` "pendant la compilation du paquet partagé", `:196` "compilations natives") | `TROUBLESHOOTING.md:49` "cette build a téléchargé le lanceur actualisé"; `conversation/calls.md:243` "une build \"Lite\"" |
| commit | **le commit** (m.), glossed *une modification enregistrée* | `révision`; `validation` **in this sense only** — the pack's 41 `validation` uses are agent approval (`agents/memory.md:122` "une validation d'écriture par l'agent"), input validation (`development/frontend.md:414`, Zod schemas) and maintainer sign-off, and are all correct | `UPGRADING.md:145`; `development/localization.md:94` |
| log / logs | **le log**, glossed *le journal du serveur* | `journal` as the standing term (it is the gloss word, and `journal persistant` is fine descriptively) | `CONFIGURATION.md:170` "Un log est le journal du serveur"; `CONFIGURATION.md:176` |
| service worker | **le service worker** (m., kept English), glossed *un petit script que le navigateur utilise pour charger l'application vite et hors ligne* | `agent de service` | `UPGRADING.md:178`; `TROUBLESHOOTING.md:80` |
| cache (noun) | **le cache** | `antémémoire` | `TROUBLESHOOTING.md:80`; `UPGRADING.md:147` |
| to cache | **mettre en cache** / **garder en cache** | `cacher` | `CONFIGURATION.md:322`; `UPGRADING.md:147` |
| backup (noun) | **la sauvegarde** | `backup`, `copie de secours` | `CONFIGURATION.md:158`; `FAQ.md:92` |
| to back up | **sauvegarder** | `enregistrer` in this sense | `FAQ.md:132` "## Comment sauvegarder mes données ?" |
| to save (an edit) | **enregistrer** | `sauvegarder` in this sense | `CONFIGURATION.md:33` "Avant l'enregistrement, chaque import affiche..." |
| snapshot | **l'instantané** (m.), 101 uses | `snapshot`; `capture` as the noun for this object — but the regex **capture group** (`extending/regex-scripts.md:68-71`) and the verb `capturer` (`game/sessions-and-saves.md:125` "Elle en capture un") are correct and account for all 9 uses | `development/architecture-map.md:95` "persistance par instantanés JSON"; `development/file-storage.md:39` |
| checkpoint (resume point) | **le point de contrôle** | `checkpoint` in this sense | `agents/built-in-agents.md:161` "reprendre au dernier point de contrôle" |
| checkpoint (model weights file) | **le checkpoint** (m., kept English) | `point de contrôle` in this sense | `game/ltx-2-3-storyboards.md:56`, `:58` |
| extension | **l'extension** (f.), 261 uses | `module complémentaire`, `greffon` (0 each); `plugin` for a Marinara extension — its 3 uses are build-tool plugins in developer docs (`@tailwindcss/vite`, `@fastify/websocket`) and are correct | `CONFIGURATION.md:59`; `FAQ.md:141` |
| app / application | **l'application** (f.) | **`l'appli`, `l'app`** (0 occurrences) | `CONFIGURATION.md:18` "se règle dans l'application, pas ici" |

### 3.5 Memory, power & mobile runtime

| English | This pack | Banned | Evidence |
| --- | --- | --- | --- |
| in memory / resident | **en mémoire** | `résident` as an adjective (the pack uses `résider` only as a verb) | `CONFIGURATION.md:155` "garde en mémoire en même temps", `:156` "charger tous les chats en mémoire"; verb-only use at `appearance/fonts.md:32` |
| server memory | **la mémoire du serveur** | `RAM du serveur` | `TROUBLESHOOTING.md:182`; `characters/bot-browser.md:116` |
| least-recently-used | **le moins récemment utilisé** | `LRU`, `le moins récemment employé` | `CONFIGURATION.md:155`; cf. `chats/managing-chats.md:97` "les moins récemment actifs" |
| to evict (from memory) | **retirer de la mémoire** | `éviction`, `expulser`, `évincer` | `CONFIGURATION.md:155` "est retiré de la mémoire (jamais du disque)" |
| wake lock | **`` `wake lock` ``** — backticked, untranslated, glossed once as *qui empêche la mise en veille* | `verrou de réveil`, `verrou d'éveil` | `TROUBLESHOOTING.md:324` |
| battery optimization | **l'optimisation de la batterie** | `économiseur de batterie`, `optimisation batterie` | `TROUBLESHOOTING.md:326`, `:332` |
| to run in the background | **s'exécuter en arrière-plan** | `tourner en tâche de fond` | `TROUBLESHOOTING.md:326` |
| background activity | **l'activité en arrière-plan** | `activité de fond` | `TROUBLESHOOTING.md:332` |
| foreground | **au premier plan** | `à l'avant-plan` | `TROUBLESHOOTING.md:332` |
| recents screen | **l'écran des applications récentes** | `menu multitâche` | `TROUBLESHOOTING.md:332` |
| frozen (Android **process** freeze) | **gelé**; the mechanism is **le gel** (4 uses) | `suspendu` (reserve `suspension` for sleep); `figé` **for the process-freeze sense only** — `figé` is a common, correct pack word in two other senses (see the two rows below) and must not be swept | `TROUBLESHOOTING.md:330` "le processus hôte est **gelé**, pas planté" |
| fixed / pinned / immutable | **figé**, ~28 of its 30 uses | — | `CONFIGURATION.md:94` "figé au démarrage du serveur"; `installation/containers.md:123` "une version figée"; `game/sessions-and-saves.md:24` "un instantané figé" |
| frozen / hung (the **UI**, not the process) | **figé** — 2 uses, distinct from the Android `gel` above | — | `TROUBLESHOOTING.md:73` "## Écran blanc, figé ou d'apparence ancienne"; `UPGRADING.md:180` "l'application semble figée" |

### 3.6 Interface vocabulary (used in French prose *about* controls)

| English | This pack | Banned | Evidence |
| --- | --- | --- | --- |
| settings | **les réglages** | `paramètres` in this sense (reserved for generation parameters) | `CONFIGURATION.md:3`; gloss `FAQ.md:61` "**Chat Settings** (réglages du chat)" |
| toggle / switch | **l'interrupteur** (m.) | `le toggle`, `la bascule` as a noun (`basculer` as a verb is fine) | `CONFIGURATION.md:253`; `TROUBLESHOOTING.md:129` |
| tab | **l'onglet** (m.) | `tabulation` | `FAQ.md:134`; `FAQ.md:119` |
| dropdown | **le menu déroulant** (91) | `liste déroulante` — 1 residual occurrence remains (R6 in §8) | `UPGRADING.md:128`; `connections/connecting-to-a-provider.md:34` |
| checkbox | **la case à cocher** | `coche` | `characters/library-organization.md:103`; `chats/export-import.md:33` |
| tooltip | **l'infobulle** (f.) | `bulle d'aide` | `TROUBLESHOOTING.md:129` |
| slider control | **le curseur** (m.) — this is what `curseur` almost always means here (~28 of its 34 uses) | `glissière` (0) | `appearance/appearance-settings.md:57` "**Chat Font Size** ... est un curseur"; `media/tts-setup.md:104` "Le curseur **Speed**"; `chats/sending-and-streaming.md:68` |
| mouse pointer (hover instructions) | **le pointeur** (m.), 5 uses — *not* banned; this is the pack's term for "hover over" | — | `integrations/message-translation.md:91` "Passe le pointeur sur un message"; `characters/choosing-your-persona.md:21`; `media/scene-backgrounds.md:57` |
| mouse cursor (the drawn cursor) / text caret | **le curseur** | — | `appearance/appearance-settings.md:50` "**Custom Mouse Pointer** (curseur de souris personnalisé)"; caret at `conversation/calls.md:58` "place seulement le curseur dans le champ de texte" |
| to upload | **téléverser** | **`uploader`** (0 prose occurrences) | `agents/built-in-agents.md:57`; `TROUBLESHOOTING.md:205` |
| to download | **télécharger** | `downloader` | `CONFIGURATION.md:24` |
| to overwrite | **écraser** | `remplacer` when data is destroyed | `characters/personas.md:139`; `chats/settings-profiles.md:68` |
| unset (default-value cell) | **non défini** | `vide` in this sense | `CONFIGURATION.md:238`; `CONFIGURATION.md:280` "Laisse `TZ` non défini ... un `TZ=` vide équivaut aussi à non défini" |
| empty (default-value cell) | **vide** | `non défini` in this sense | `CONFIGURATION.md:124`, `:125`, `:127` (18 such cells) |
| off (default-value cell) | **désactivé** | `non` , `faux` | `CONFIGURATION.md:156` |

### 3.7 False friends and calques the pack deliberately avoids

| Trap | Pack behaviour | Evidence |
| --- | --- | --- |
| `librairie` for *library* | never used (0); `bibliothèque` (132) | `agents/agents-overview.md:23` |
| `supporter` for *to support* | never used (0); `prendre en charge` (112) | `FAQ.md:73` |
| `l'appli` / `l'app` (colloquial anglicisms) | never used (0 each); `l'application` (418) | pack-wide scan |
| `checker` / `digital` as French verbs/adjectives | never used as French words (0). Both strings do appear inside **English proper names**, which is correct and must not be swept: **Continuity Checker** (`agents/built-in-agents.md:31`, `agents/agents-overview.md:75`) and **Digital Painting** (`media/style-profiles.md:39`) | as cited |
| `éventuellement` | used **only** in the correct French sense *possibly / optionally*, never as *eventually* (3 occurrences) | `game/sessions-and-saves.md:56` "que tu as éventuellement écrite" |
| `actuellement` | used **only** as *currently*, never as *actually* (10 occurrences) | `chats/export-import.md:24` "le chat actuellement ouvert" |
| `jeton` for *LLM token* | never; `jeton` is reserved for poker chips and CSS design tokens | `agents/built-in-agents.md:300`; `appearance/card-css-theming.md:282` |

---

## 4. Typography & punctuation

The governing decision is deliberate and product-first: **ASCII-only French
typography**, so that literal substring search in the in-app docs viewer and
copy-paste out of it both keep working. It is *not* strict French print
convention, and that is intentional.

| # | Rule | Status | Evidence |
| --- | --- | --- | --- |
| 4.1 | **Straight apostrophe `'` only.** 11 919 straight apostrophes pack-wide. Curly `’` is banned (3 residual occurrences, see R1 in §8). | [pack] | `CONFIGURATION.md:73` "tu n'as donc pas à en créer un" |
| 4.2 | **Straight double quotes `"` only. No guillemets `« »` — zero in the pack.** | [pack] | `UPGRADING.md:145` `"N commits behind"`; `TROUBLESHOOTING.md:330` `"Opening chat..."` |
| 4.3 | **No non-breaking spaces.** Zero U+00A0 and zero U+202F pack-wide. | [pack] | verified by codepoint scan over all 125 files |
| 4.4 | **Plain ASCII space before `:` `;` `!` `?`.** 2 298 ` : `, 281 ` ; `, 41 ` ?`. | [pack] | `CONFIGURATION.md:61` "...exploite le serveur ; l'interrupteur de la Danger Zone..." |
| 4.5 | **The rationale for 4.1-4.4:** guillemets and non-breaking spaces would break the docs viewer's literal substring search and make copied text unusable. Recorded in PR #4191 and `CONTRIBUTING.md:236`. | [ruling] | not derivable from the pack |
| 4.6 | **Spaced en dash `–` (U+2013) is the parenthetical/appositive dash** — 60 occurrences, and the main carrier of first-use glosses (§7.2). Pairs open and close. | [pack] | `characters/personas.md:7` "dans chaque prompt – le texte que Marinara envoie à l'IA – pour que l'IA sache à qui elle parle" |
| 4.7 | **Em dash `—` is banned in French prose.** 5 in the pack: **4 prose occurrences remain, all residual** (R2 in §8; note `data/where-data-is-stored.md:21` carries a matched *pair* on one line), plus 1 legitimate use in English content quoted inside a code span. | [pack] | legitimate quoted case: `lorebooks/entries.md:189` (English sample inside backticks) |
| 4.8 | **Thousands are grouped with a plain ASCII space**, not a comma or period: `16 384`, `1 000 000`, `478 000`. | [pack] | `agents/built-in-agents.md:200`; `conversation/table-games.md:109`; `development/code-cleanup-audit.md:46` |
| 4.9 | **Decimal separator is a comma**: `5,4 Go`, `3,2 Go`. | [pack] | `connections/local-model.md:72-73` |
| 4.10 | **Numbers inside code spans, env values, CIDR blocks, and version strings are never re-formatted.** | [pack] | `REMOTE_ACCESS.md:90` `IP_ALLOWLIST=192.168.1.0/24,203.0.113.42` |
| 4.11 | **Times use 24-hour `HH:MM`**, not `8 h 00`. All 7 clock times in the pack follow this. | [pack] | `game/map-time-weather.md:64` "à 08:00 du matin"; `conversation/schedules.md:102` `09:00-11:30`; `noodle/settings.md:90` "entre 23:00 et 07:00" |
| 4.12 | **Dates use `DD/MM/YYYY`.** Thin evidence: the pack contains **exactly one** date, so treat this as a convention to follow rather than a broadly attested pattern. | [pack] | `development/hierarchical-locations-prd-v3.md:572` "le 13/07/2026" — the only occurrence |
| 4.13 | **Accents are kept on capitals**: `À`, `É`, `È` (205 occurrences). | [pack] | `CONFIGURATION.md:124` "À définir avec `BASIC_AUTH_PASS`"; `UPGRADING.md:27` "À la fin" |
| 4.14 | **Headings are French sentence case**, with a space before `?` in question headings. 1 861 headings. | [pack] | `CONFIGURATION.md:5` "## Dans quels cas configurer Marinara ?"; `agents/hierarchical-maps.md:288` |
| 4.15 | **Never convert between `…` and `...`** — each is copied from whatever the source shows. `…` is not a French typography choice you apply; of its 16 uses, **12 are inside byte-exact UI labels** (**Checking…**, **Saving…**, **Search entries…**), **3 are elisions inside code spans or code blocks** copied from source, and **1 is a genuine French suspension point in prose**. | [pack] | labels: `UPGRADING.md:139` **Checking…**; code spans: `TROUBLESHOOTING.md:275` `messages.post-unshard-…`, `agents/built-in-agents.md:160`, `development/localization.md:54`; prose: `game/map-time-weather.md:79` "littoral, montagne… Côté météo"; contrast the ASCII form in a quoted string at `TROUBLESHOOTING.md:330` `"Opening chat..."` |
| 4.16 | **List mechanics are structural, never localised**: bullet markers, numbering, indentation, table pipes and separator rows, code-fence lines, and blank-line placement are byte-identical to the English source. Only the cell text changes. | [pack] + branch README | `CONFIGURATION.md:44-50` (JSON block); `media/image-providers.md:172-176` (table skeleton) |
| 4.17 | **Table columns are re-padded only within the rows you touch.** Do not reflow untouched rows — it produces a diff that hides the real change. | [ruling] (mirror cycle) | recorded in `prd-notes-fr.md` |
| 4.18 | **Arrows and emoji in tables/paths are copied from the source, not localised** (`→`, `↔`, `⚠️`, `⛔`). | [pack] | `CONFIGURATION.md:31`; `TROUBLESHOOTING.md:351`; `extending/personal-extensions.md:169` |

---

## 5. UI labels & glosses

| # | Rule | Status | Evidence |
| --- | --- | --- | --- |
| 5.1 | **The French app UI does not exist.** `fr.json` ships 132 of 9 123 keys, so a French reader sees English controls. Every in-app label therefore stays **byte-exact English** in the docs — same words, same capitalisation, same trailing `…`, same `&`. | [pack] + locale file | `packages/client/src/localization/locales/fr.json`; label use at `FAQ.md:96` **Import Profile** |
| 5.2 | **Labels are bold**, glosses are not: `**Label**` + one space + `(gloss)`. 1 351 bold-label + parenthetical pairs in the pack, of which 1 225 open with a lowercase French gloss per §5.3 (the rest are the §5.4 capitalised exception or a non-gloss aside). | [pack] | `CONFIGURATION.md:24` "**Update** (mettre à jour)" |
| 5.3 | **The gloss is lowercase French**, an infinitive phrase or noun phrase, no final period inside the parentheses. | [pack] | `FAQ.md:108` "**Add Lorebook** (ajouter un lorebook)"; `FAQ.md:107` "**Linked Characters** (personnages liés)" |
| 5.4 | **Exception: a gloss that is itself a proper UI area keeps its capital**: `**Settings** (Paramètres)`. | [pack] | `FAQ.md:119` |
| 5.5 | **Gloss once per file, on first use**; later occurrences of the same label in that file are bare. The scope is the *file*, not the pack — `**Update**` is glossed independently in `CONFIGURATION.md:24` and `FAQ.md:115`. | [pack] + PR #4191 | as cited |
| 5.6 | **Navigation paths are glossed as a whole path**, separator included: `**Settings → Advanced → Danger Zone** (Paramètres → Avancé → Zone de danger)`. | [pack] | `CONFIGURATION.md:31` |
| 5.7 | **The path separator is copied from the English source, not normalised.** Both occur — 47 spaced ` → ` and 73 spaced ` > ` separators inside or between bold spans; match whichever the source line uses. Two shapes are both attested: the whole path in one bold span (`**Agents > Download Agents**`) and one bold span per segment (`**Settings** > **Advanced** > **Danger Zone**`); copy the source's shape too. | [pack] | `CONFIGURATION.md:20` (`**Agents → Download Agents**`) vs `FAQ.md:175` (`**Agents > Download Agents**`); split form at `extending/personal-extensions.md:180` |
| 5.8 | **Status strings and error banners are bold English with no parenthetical gloss** — the surrounding French sentence carries the meaning. This is a different class from navigation labels. | [pack] | `TROUBLESHOOTING.md:132` **A generation is already in progress for this chat**; `:164` **Embedding unavailable**; `:330` **Server unreachable**, **Unreachable (request timed out)** |
| 5.9 | **Quoted app strings (tooltips, transient states) go in straight double quotes, un-glossed**, in-line in the French sentence. | [pack] | `TROUBLESHOOTING.md:129` `(l'infobulle indique "This parameter is sent to the model")`; `:330` `"Opening chat..."` |
| 5.10 | **Option values inside a control keep their English name and take a French explanation after a colon**, not a parenthetical gloss. | [pack] | `UPGRADING.md:130` "- **Latest Stable** : suit les versions taguées `vX.Y.Z`." |
| 5.11 | **A label with no French-side name gets no invented one.** `Support Diagnostics` is left plain English, unbolded, mirroring the English source. | [pack] | `TROUBLESHOOTING.md:330` |
| 5.12 | **Never localise a label from `fr.json`.** Even for the 132 translated keys, the docs describe the English UI the reader actually sees. | [ruling] | follows from 5.1 |

---

## 6. Language-specific mechanics

| # | Rule | Status | Evidence |
| --- | --- | --- | --- |
| 6.1 | **All borrowed product nouns are masculine**: `le prompt`, `le token`, `le preset`, `le lorebook`, `le persona`, `le swipe`, `le tracker`, `le sprite`, `le embedding` → `l'embedding`, `le storyboard`, `le commit`, `le package`, `le worker`, `le checkpoint`, `le pipeline`, `le log`. | [pack] | determiner scan over the pack; e.g. `FAQ.md:103` "qu'un lorebook", `chats/messages.md:17` "un swipe" |
| 6.2 | **Exception: `build` is feminine** — `une ancienne build`, `une build "Lite"`. Both user-facing uses agree feminine; one developer-doc line disagrees (`un build`, R7 in §8). Keep writing it feminine. | [pack] | `TROUBLESHOOTING.md:49`; `conversation/calls.md:243` |
| 6.3 | **`la connexion`, `la balise`, `la macro`, `la fiche`, `l'extension`, `l'entrée`, `la sauvegarde` are feminine**; `l'instantané`, `le canal`, `le lanceur`, `le marqueur`, `l'interrupteur`, `l'onglet` masculine. | [pack] | `FAQ.md:67`; `CONFIGURATION.md:59`; `development/architecture-map.md:95` |
| 6.4 | **Plurals of loanwords take French `-s`**: `les prompts`, `les tokens`, `les lorebooks`, `les presets`, `les swipes`, `les packages`, `les placeholders`. No invariant forms, no `-es`. | [pack] | `UPGRADING.md:7` "les personas, les lorebooks, les presets, les connexions" |
| 6.5 | **Elision and contraction apply normally around loanwords**: `l'agent`, `d'un lorebook`, `au prompt`, `du preset`, `aux tokens`. | [pack] | `CONFIGURATION.md:183`, `:205` |
| 6.6 | **A bold English label is grammatically opaque** — do not elide or contract into it, and do not inflect it. Put the French article before the bold span or restructure: "ouvre **Chat Settings**", "le bouton **Check for Updates**". | [pack] | `UPGRADING.md:139`; `FAQ.md:61` |
| 6.7 | **Prefer restructuring over an agreement you cannot justify.** Where an English label's gender is undecidable, the pack attaches a French carrier noun: `le champ **Clip Skip**`, `un interrupteur **Restore faces**`, `le menu déroulant **Release Channel**`, `le statut **Embedding unavailable**`. | [pack] | `media/image-providers.md:166`; `UPGRADING.md:128`; `TROUBLESHOOTING.md:164` |
| 6.8 | **Link text is translated; link targets are not.** The `.md` path and the `#anchor` fragment stay byte-identical English, even when the visible text is French — including the `→` sub-section form. | [pack] | `chats/sending-and-streaming.md:56` `[... → Réutiliser une image de galerie ...](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings)`; `UPGRADING.md:188` |
| 6.9 | **Compound technical terms take `de`, not a hyphen calque**: `budget de tokens`, `préfixe de prompt`, `canal de publication`, `gestionnaire de paquets`, `fiche de personnage`. | [pack] | `agents/hierarchical-maps.md:678`; `media/image-providers.md:166`; `TROUBLESHOOTING.md:18` |
| 6.10 | **`en` + bare mode name; `de` + mode name after a noun**: `en Game Mode`, `les storyboards de Game Mode`, `les emplois du temps de Conversation`. | [pack] | `FAQ.md:175`; `TROUBLESHOOTING.md:200`; `CONFIGURATION.md:280` |

---

## 7. Explanatory conventions

| # | Rule | Status | Evidence |
| --- | --- | --- | --- |
| 7.1 | **Jargon is defined on first use in each file**, in one of two shapes: a spaced-en-dash apposition, or a standalone `X, c'est ...` / `Un X est ...` sentence. | [pack] | `TROUBLESHOOTING.md:12`; `characters/personas.md:7` |
| 7.2 | **Reuse the pack's fixed gloss wordings** rather than inventing new ones — they recur near-verbatim across files and readers rely on the repetition. | [pack] | see table below |
| 7.3 | **A gloss never replaces the term.** The loanword is still used in the rest of the file. | [pack] | `noodle/settings.md:160` "un token est un petit morceau de texte" then plain `tokens` after |

Fixed gloss wordings:

| Term | Standard gloss | Evidence |
| --- | --- | --- |
| prompt | *le texte que Marinara envoie à l'IA* | `chats/group-chats.md:25`; `prompts/presets.md:9`; `roleplay/backgrounds.md:26` |
| token | *un petit morceau de texte* | `agents/agents-overview.md:55`; `noodle/settings.md:160` |
| lorebook | *un recueil de faits sur ton univers* | `characters/personas.md:101`; `roleplay/combat-encounters.md:37`; `noodle/settings.md:158` |
| preset | *un modèle de prompt enregistré* | `characters/creating-and-editing-characters.md:116` |
| sprite | *l'image du personnage sur le plateau* | `installation/windows.md:156`; `TROUBLESHOOTING.md:188` |
| embedding | *une représentation numérique du texte* | `CONFIGURATION.md:208`; `connections/local-model.md:13` |
| log | *le journal du serveur* | `CONFIGURATION.md:170` |
| commit | *une modification enregistrée* | `UPGRADING.md:145` |
| service worker | *un petit script que le navigateur utilise pour charger l'application vite et hors ligne* | `UPGRADING.md:178` |
| macro | *un espace réservé que Marinara remplace par du vrai texte* | `chats/guided-and-impersonate.md:88` |
| API key | *un code secret, un peu comme un mot de passe* | `media/scene-video.md:21` |
| persona | *les personnages que tu incarnes* | `FAQ.md:107` |
| streaming | *l'affichage au fil de l'écriture* | `TROUBLESHOOTING.md:132` |
| wake lock | *qui empêche la mise en veille* | `TROUBLESHOOTING.md:324` |

---

## 8. QA checks & known traps

### 8.1 Mechanical checks (run before committing any `fr/` change)

Scan with a codepoint-aware tool — Windows `grep` under Git Bash mis-decodes
UTF-8 accented bytes and will report false positives on `À`, `é`, `ç` when you
search for `’` or `«`. Use Python with `encoding="utf-8"`, or `rg` with an
explicit UTF-8 locale.

| # | Check | Expected on a clean pack |
| --- | --- | --- |
| Q1 | `U+00AB` / `U+00BB` (guillemets) | 0 |
| Q2 | `U+00A0` / `U+202F` (NBSP, narrow NBSP) | 0 |
| Q3 | `U+2018` / `U+201C` / `U+201D` | 0 |
| Q4 | `U+2019` (curly apostrophe) | 0 — **currently 3, see R1** |
| Q5 | `U+2014` (em dash) in prose | 0 — **currently 4, see R2** |
| Q6 | `\bvous\b`, `\bvotre\b`, `\bvos\b` (excluding `rendez-vous`) | 0 — **currently 7, in 3 files, see R5** |
| Q7 | `\b\w{3,}ez\b` minus `chez/assez/nez/rez/rendez` (vous-imperatives) | 0 — **currently 28 across 5 files, see R5**. Keep `rendez` in the exclusion list or `rendez-vous` reports as a false positive. Run this with a Unicode-aware `\w` — see T7. |
| Q8 | `librairie`, `l'appli`, `l'app`, `supporte(r)` as French words | 0 each. **Do not** flag bare `checker`/`digital`: they occur only inside the English names **Continuity Checker** and **Digital Painting** (§3.7). |
| Q9 | `jeton` used for an LLM token | 0 (poker/CSS senses only) |
| Q10 | `carte de personnage`, `préréglage`, `librairie` | 0 each |
| Q10b | `\bla persona\b` **lowercase only** | 0. Case-insensitively there are 3 hits, all the capitalised English UI object `la Persona ...` — expected, leave them (§3.2) |
| Q11 | Code fences, inline code spans, link targets, `#anchors` byte-identical to the English source | exact match |
| Q12 | Heading count and heading levels match the English file | exact match |
| Q13 | Line endings LF only; no CRLF | clean |
| Q14 | `node scripts/docs-i18n/build-manifest.mjs <pack> --source-commit <sha>` then `validate-pack.mjs <pack>` | green, no orphans, valid hashes, no added images |

### 8.2 Tooling traps

| # | Trap | Status |
| --- | --- | --- |
| T1 | Git Bash `grep` with a bracket class containing non-ASCII characters matches accented Latin letters byte-wise and produces garbage hits. Always scan by codepoint. | [ruling] (observed 2026-09-01) |
| T2 | `packages/client/src/localization/locales/fr.json` is vouvoiement with curly apostrophes and only ~1.4 % coverage. Copying strings out of it silently injects both a wrong register and a banned character. | [ruling] (locale file verified) |
| T3 | Editors that "smarten" quotes will convert `'` → `’` and `"` → `« »` on save. Disable smart punctuation for this branch. | [ruling] |
| T4 | Re-padding an existing Markdown table's untouched rows makes the real edit unreviewable. Pad only the rows you add, consistently with each other. | [ruling] (mirror cycle) |
| T5 | Commit content and the regenerated `manifest.json` **together**; a stale manifest fails hash validation at download time. | [ruling] (branch README) |
| T6 | The `docs-i18n` branch carrying `fr/` must be pushed **before** the Engine-side PR merges, or selecting Français fails with a clean 502. | [ruling] (PR #4191) |
| T7 | **Never run the Q7 vouvoiement scan through a JavaScript regex.** JS `\w` is ASCII-only, so it does not match `é`/`è`/`ç`. `/\b\w{3,}ez\b/` reports `Vérifiez` as the wrong word `rifiez` (breaking any whole-word exclusion list) and **misses `préférez` entirely** — a real residual at `chats/sending-and-streaming.md:56`. Python's `re` (Unicode `\w` by default) or `rg` handle all of these correctly. | [pack] (verified 2026-09-01 against Node and Python on the pack's own strings) |

### 8.3 Known pack residuals (documented, deliberately not fixed here)

These are real inconsistencies in the shipped pack. They are recorded so that a
future sweep can fix them as one intentional change, rather than being silently
patched — or, worse, being copied as precedent.

| # | Residual | Location | Disposition |
| --- | --- | --- | --- |
| **R1** | Curly apostrophes `’` (3), violating §4.1 | `agents/built-in-agents.md:159`, `:161` | leave for a future sweep |
| **R2** | Em dashes `—` in French prose (4), violating §4.7 | `agents/custom-agents.md:113` (1), `:114` (1); `data/where-data-is-stored.md:21` (**2** — a matched pair around "par exemple, ... lorebook") | leave for a future sweep (the instance in `lorebooks/entries.md:189` is inside an English code span and is correct) |
| **R3** | **placeholder → marqueur mismatch.** `media/image-providers.md:166` describes the byte-exact label **Upload a 1x1 placeholder when no reference image is provided** and then calls the same objects `marqueurs d'image de référence`; `:130`, `:138`, `:140`, `:183` use `marqueur` throughout — while `media/comfyui.md:55-59`, `game/ltx-2-3-storyboards.md:96-126` and `game/storyboard.md:266` call them `placeholders`, and `media/scene-video.md:38` calls them `balises de remplacement`. A reader following the cross-reference at `:140` sees three names for one thing. | `media/image-providers.md:166` (+ the files above) | **explicitly left for a future sweep** — recorded ledger ruling |
| **R4** | `package` vs `paquet` overlap for Marinara capability packages. `CONFIGURATION.md:22`/`FAQ.md:115` use `packages` (313 pack-wide), but at least **7 lines across 3 files** use `paquet` for the same objects: `TROUBLESHOOTING.md:86` (installed cards/calls with their own routes), `:88` (`data/capability-packages` migration), `:90` (catalogue downloads), `:338` (legacy packages pruned by the launcher), `:396` (a package re-exported with an empty capability list); `conversation/selfies.md:11` ("le paquet optionnel **Illustrator**"); `CONFIGURATION.md:65` ("anciens paquets tiers" = external extensions). Wider than first recorded. | as listed | leave; prefer `package` in new prose (§3.3). `paquet` stays correct for npm/OS/pnpm packages (`TROUBLESHOOTING.md:18`) |
| **R5** | **Vouvoiement residuals**, violating §1.3 — the clearest register regression in the pack: **28 vous-imperatives across 5 files**, plus **7 `vous`/`votre`/`vos` across 3 files**. Lines: `TROUBLESHOOTING.md:49`, `:243`, `:245`, `:266`, `:267`, `:273`, `:277` (17 imperatives, the worst cluster); `UPGRADING.md:186`, `:188`; `characters/galleries.md:73`, `:83`, `:85`, `:91`; `chats/sending-and-streaming.md:54`, `:56`; `agents/custom-agents.md:113`. Note `agents/custom-agents.md:113` carries both R2 and R5, i.e. that bullet block appears to predate the register pass. | as listed | leave for a future sweep; never use as precedent |
| **R6** | `liste déroulante` (1) where the pack's standing term is `menu déroulant` (91), violating §3.6 | `noodle/settings.md:65` | leave for a future sweep |
| **R7** | `build` agreed **masculine** once ("une installation et un build propres"), against the feminine agreement of §6.2 and both user-facing uses | `development/code-cleanup-audit.md:253` | leave for a future sweep; write `la build` in new prose |

---

## 9. Sources

- Shipped pack: `docs-i18n` branch, `fr/` — 125 Markdown files + `manifest.json`
  (working copy scanned: `scratchpad/wt-glossaries/fr/`).
- Pasta-Devs/Marinara-Engine PR **#4191** — "Translation approach" and
  "Validation done".
- `prd-notes-fr.md` — 2026-09-01 mirror-cycle terminology notes.
- `CONTRIBUTING.md:236` (`staging`) — French per-language conventions.
- `packages/client/src/localization/locales/fr.json` — UI coverage reality check.

## Native NovelAI character descriptions (2026-09-09)

In `media/illustrator-agent.md`, a native NovelAI character caption is a
**description de personnage**: the description sent as a per-character image prompt,
not a subtitle or text drawn on the image. Keep this sense distinct from captions
on comic pages. The accompanying `media/image-providers.md` wording uses the same
native character-prompt meaning.
