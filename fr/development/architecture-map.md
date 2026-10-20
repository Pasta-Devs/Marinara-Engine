# Carte de l'architecture (développeurs)

Ce guide s'adresse aux contributeurs. Il décrit l'organisation du code de Marinara Engine : fondations partagées, systèmes de fonctionnalités, répartition par mode, et place exacte de chaque morceau de code. Il recense aussi les gros fichiers actuels et la direction prise par les futurs travaux de refactorisation.

Périmètre : `packages/client/src`, `packages/server/src` et `packages/shared/src`. Le dépôt ne contient pas de suite `.test.ts` classique. La validation automatique repose sur les scripts de régression suivis et sur la couverture Playwright de type smoke ; les fichiers de preuve `.test.ts` temporaires sont ignorés par Git et supprimés après usage.

Le nombre de fichiers, de lignes et de routes évolue au fil du dépôt. Cette carte donne des ordres de grandeur et des noms. Pour les chiffres exacts, réfère-toi toujours à l'arborescence actuelle.

## Codes de section

Utilise ces codes pour planifier un déplacement, étiqueter une issue ou ajouter un court en-tête à un fichier qui ne peut pas encore être déplacé.

| Code | Signification | Emplacement principal |
| --- | --- | --- |
| `CORE-CONTRACT` | Types, schémas, constantes et helpers purs partagés entre le client et le serveur | `packages/shared/src` |
| `CLIENT-APP` | Amorçage de l'application React, coquille de mise en page, câblage global de l'interface | `packages/client/src/App.tsx`, `main.tsx`, `components/layout` |
| `CLIENT-SHARED` | Primitives d'interface propres au client, hooks communs, helpers navigateur communs, stores globaux | `packages/client/src/components/ui`, `hooks`, `lib`, `stores` |
| `SERVER-APP` | Amorçage de l'application Fastify, middlewares, enregistrement des routes, configuration d'exécution | `packages/server/src/app.ts`, `index.ts`, `middleware`, `config` |
| `SERVER-SHARED` | Fondations propres au serveur : stockage, base de données, LLM, prompt, lorebook, import et intégrations | `packages/server/src/services`, `db`, `utils`, `lib` |
| `MODE-CONVERSATION` | Interface et comportement serveur réservés à Conversation | composants de conversation, `/api/conversation`, services de conversation |
| `MODE-ROLEPLAY` | Interface Roleplay, scènes, sprites, helpers de rencontre | composants de chat roleplay, `/api/scene`, `/api/encounter`, `/api/sprites` |
| `MODE-GAME` | Interface de Game Mode, prompts du GM, dés, équipe, carte, combat, assets, sessions | `components/game`, `/api/game`, services de jeu |
| `FEATURE-AGENTS` | Définitions d'agents, exécution, état de débogage, routage des connaissances | composants d'agent, store d'agents, routes et services d'agents |
| `FEATURE-ASSETS` | Arrière-plans, avatars, galerie, images générées, sprites, assets de jeu | routes d'assets, stockage de la galerie, services d'image |
| `FEATURE-SIDECAR` | Exécution des modèles locaux, analyse de scène, téléchargements, pilotage des processus | store sidecar, `/api/sidecar`, services sidecar |
| `FEATURE-TTS` | Configuration Text to Speech (TTS), routage des voix, clés de cache, lecture audio | réglages, hooks, routes et services TTS |
| `FEATURE-IMPORT` | Importeurs SillyTavern et Marinara, helpers de migration | routes et services d'import |
| `TEST` | Régressions suivies et couverture smoke navigateur, plus des tests de preuve temporaires si besoin | `scripts/regressions`, `e2e`, et fichiers temporaires `packages/server/src/**/__tests__/` supprimés après usage |

Le mieux est que le chemin lui-même indique la section. Un commentaire comme `// Section: MODE-GAME` n'a d'intérêt que tant qu'un fichier reste dans un dossier mixte.

## Frontières entre packages

### packages/shared

`CORE-CONTRACT`. Ce package doit rester indépendant de l'environnement d'exécution.

Contenu actuel :

- `types` : chat, personnage, jeu, état du jeu, combat, scène, sidecar, TTS, agents, prompts, lorebooks, exports, thèmes.
- `schemas` : schémas Zod des entités persistées et partagées.
- `constants` : fournisseurs, valeurs par défaut, modes de chat, listes de modèles, prompts d'agents.
- `utils` : helpers purs, comme l'expansion des macros, l'encapsulation XML et le scoring musical.
- `features` : manifestes et registre d'agents, définitions d'appels de fonction, packages de dossiers, moteurs de jeux au tour par tour pour UNO, Chess et Poker, ensembles de règles du Game Mode et leur combat (`rulesets`, `ruleset-combat`, `tactical-combat` et les fichiers `combat-*`), et le générateur de mondes avec ses fichiers de partage (kits d'univers, mondes, packs de tuiles, de plateaux et de créatures) dans `world`.

Règles :

- Aucun code React, DOM, Fastify, stockage serveur, système de fichiers, réseau ou SDK de fournisseur.
- Ne déplace du code ici que si le client et le serveur ont besoin du même contrat ou du même algorithme pur.
- Ne transforme pas `shared` en fourre-tout pour des helpers réservés au client.

### packages/client

React 19 et Vite PWA (application web installable). Ce package compte aujourd'hui plusieurs centaines de fichiers source.

Structure actuelle de premier niveau :

- `App.tsx`, `main.tsx` : amorçage de l'application, React Query, PWA, effets globaux.
- `components/layout` : coquille de l'application, barres latérales, barre supérieure, rendu des fenêtres.
- `components/ui` : primitives d'interface réutilisables.
- `components/chat` : mélange d'interface de chat commune, Conversation, Roleplay, scène, sprite et rencontre.
- `components/game` : surface et panneaux de Game Mode.
- `components/panels`, `components/modals`, éditeurs d'entités : réglages et gestion des ressources.
- `features` : modules de fonctionnalités extraits, aujourd'hui les sections de chat-settings, des morceaux du panneau de trackers, le multijoueur, ainsi que le contrat, la configuration, la scène et les moteurs de rendu des agents d'avatars (`features/avatars`).
- `hooks` : hooks React Query et hooks d'exécution pour la plupart des fonctionnalités de l'API.
- `lib` : helpers navigateur et client. Les helpers communs y côtoient pour l'instant des helpers propres à Game Mode.
- `stores` : stores Zustand pour l'interface, l'exécution du chat, les agents, l'état du jeu, Game Mode, les assets, le sidecar, la traduction, la galerie, les rencontres et les jeux au tour par tour.
- `styles` : feuille de style globale et CSS propre aux thèmes.

Recoupements notables aujourd'hui :

- `components/game` importe `components/chat` pour des éléments visuels partagés, comme la météo et les panneaux latéraux de galerie.
- `components/chat` importe l'état du jeu et l'état des rencontres pour des fonctionnalités Roleplay.
- `hooks/use-generate.ts` touche à l'état du chat, à l'état des agents, à l'état du jeu, à l'état de Game Mode, à l'état de traduction et aux réglages d'interface.
- Les helpers `lib/game-*` sont propres à Game Mode mais vivent à côté des helpers globaux.

### packages/server

API Fastify, stockage natif sur fichiers et intégrations de fournisseurs. Ce package compte aujourd'hui plusieurs centaines de fichiers source.

Structure actuelle de premier niveau :

- `app.ts`, `index.ts` : fabrique de l'application, amorçage, service des fichiers statiques, hydratation du stockage fichier et seeders.
- `routes` : de nombreux fichiers de routes. La plupart sont de simples API CRUD, mais `generate.routes.ts` et `game.routes.ts` sont de gros fichiers d'orchestration. Un dossier `routes/generate/` regroupe les morceaux extraits jusqu'ici du chemin de génération, dont la chaîne de sortie des tokens (`generation-stream-output.ts`), les tours d'appels d'outils (`tool-rounds.ts`), l'analyse des commandes de réponse et le nettoyage du texte, ainsi que l'enregistrement de la réponse (`save-generated-reply.ts`).
- `services/storage` : couche de façade du stockage pour les chats, les personnages, les prompts, les lorebooks, les réglages, les assets, les thèmes et l'état du jeu.
- `services/llm` : registre des fournisseurs, contrat de base des fournisseurs, fournisseurs compatibles OpenAI, passerelle vers le sidecar local.
- `services/prompt` : assemblage partagé du prompt pour la génération hors Game Mode.
- `services/conversation` : emplois du temps, messages autonomes, awareness, profils de conversation, traitement des commandes de conversation.
- `services/game` : prompts du GM, dés, combat, machine à états, prompts d'équipe, cartes, météo, temps, sessions, points de contrôle, réputation, assets.
- `services/sidecar` : exécution locale, gestion des modèles, analyse de scène, post-traitement de scène.
- `services/agents` : exécution des agents et routage des connaissances.
- Fondations de fonctionnalités : `services/import`, `services/lorebook`, `services/image`, `services/haptic`, `services/tools`, `services/regex`, `services/professor-mari`, `services/mari-db`, `services/turn-games`, `services/spotify`, `services/video`, `services/generation`, `services/chat-summary`, `services/achievements`, `services/prompt-overrides`, `services/setup`, `services/noodle`, `services/memory-recall`, `services/avatars` (stockage et génération des modèles d'avatars, et classificateur d'émotions des agents d'avatars), `speech-to-text.service.ts` et `discord-webhook.ts`.
- `db/schema` : définitions des tables fichier pour les données stockées sous `DATA_DIR/storage`.
- `db/file-schema.ts`, `db/file-query.ts` : métadonnées des tables natives et expressions de requête.
- `db/file-backed-store.ts` : store de tables en mémoire, frontière transactionnelle, reprise après crash et persistance par instantanés JSON. Voir [Stockage natif sur fichiers (développeurs)](file-storage.md).

Recoupements notables aujourd'hui :

- Les routes importent directement le stockage, le LLM, le prompt, le lorebook, les services de jeu, le sidecar et les services de fonctionnalités.
- `generate.routes.ts` sert le chemin de génération principal de Conversation et de Roleplay, ainsi que le pipeline des agents.
- `game.routes.ts` orchestre Game Mode et va aussi piocher dans le LLM, le sidecar, le lorebook, l'image, le stockage et le comportement du webhook Discord.
- L'analyse de scène vit dans les services sidecar, mais Game Mode peut l'exécuter soit via le sidecar, soit via une connexion LLM sélectionnée.

## Répartition par mode

### Commun à tous les modes

Voici les fondations globales :

- Persistance des chats et des messages : `packages/server/src/routes/chats.routes.ts`, `packages/server/src/services/storage/chats.storage.ts`, types et schémas de chat partagés.
- Personnages et personas : routes, stockage et schémas de personnages, plus les hooks et éditeurs de personnages côté client.
- Connexions et fournisseurs : routes de connexion, stockage, constantes de fournisseurs partagées et `services/llm`.
- Presets de prompt, lorebooks, regex, outils personnalisés : fondations partagées de création et d'insertion dans le prompt.
- Transport de la génération : `packages/client/src/hooks/use-generate.ts`, `packages/server/src/routes/generate.routes.ts` et le registre des fournisseurs.
- TTS, traduction, galerie, thèmes, réglages, imports, sauvegardes.

### Mode Conversation

Code principal :

- Client : `components/chat/ChatConversationSurface.tsx`, `ConversationView.tsx`, `ConversationMessage.tsx`, `ConversationInput.tsx`, et le câblage du démarrage rapide de Conversation dans `ChatArea.tsx`.
- Hooks client : `use-autonomous-messaging.ts`, `use-background-autonomous.ts`.
- Serveur : `/api/conversation`, `services/conversation/*`.
- Métadonnées partagées : `conversationSchedulesEnabled`, `characterSchedules`, `scheduleWeekStart`, et les résumés par jour et par semaine.

Frontière attendue :

- Conversation gère les emplois du temps, les prises de contact autonomes, l'activité de conversation et l'affichage des messages hors Roleplay.
- Conversation ne doit rien savoir des dés du jeu, des tags du GM, des événements en temps limité, des cartes de jeu ni du combat.

### Mode Roleplay

Code principal :

- Client : `components/chat/ChatRoleplaySurface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, les composants `RoleplayHUD`, `SpriteOverlay.tsx`, `SceneBanner.tsx`, `CyoaChoices.tsx` et `EncounterModal.tsx`.
- Serveur : `/api/scene`, `/api/encounter`, `/api/sprites`, et des parties de `/api/generate`.
- Contrats partagés : `scene`, les champs de métadonnées de chat liés à Roleplay, et les types de placement des sprites.

Frontière attendue :

- Roleplay gère les scènes, l'affichage des sprites, les choix CYOA, le HUD de Roleplay et les flux d'aide aux rencontres.
- Les effets visuels partagés que Game Mode utilise aussi doivent sortir de `components/chat`.

### Game Mode

Code principal :

- Client : `components/game/*`, `hooks/use-game.ts`, `hooks/use-scene-analysis.ts`, `stores/game-mode.store.ts`, `stores/game-state.store.ts`, `stores/game-asset.store.ts`, `lib/game-*`, `lib/party-dialogue-parser.ts`.
- Serveur : `/api/game`, `/api/game-assets`, `services/game/*`, et les parties jeu de `services/sidecar/scene-analyzer.ts` et `scene-postprocess.ts`.
- Contrats partagés : `types/game.ts`, `types/game-state.ts`, `types/combat-encounter.ts`, et les champs de jeu dans `ChatMetadata`.

Frontière attendue :

- Game Mode gère les prompts du GM, les prompts d'équipe, les dés, les jets de compétence, les événements en temps limité, le combat, les cartes, les voyages et le repos, la météo et le temps, la réputation des PNJ, les résumés de session, les assets de jeu générés et les logs de jeu.
- Game Mode ne doit pas dépendre de l'interface des modes de chat, sauf via des primitives partagées ou des composants de fonctionnalité explicitement partagés.

## Gros fichiers actuels

Ces fichiers risquent le plus de ralentir les travaux à venir, parce qu'ils mélangent beaucoup de préoccupations au même endroit. Le nombre de lignes bouge souvent : cette liste donne un ordre de grandeur et la préoccupation, pas des tailles exactes.

| Fichier | Section | Préoccupation |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | génération partagée et agents | Route, streaming, prompt, agents, stockage et effets de bord cohabitent dans un seul fichier. |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | Handlers d'API, flux du GM, analyse de scène, assets, combat et persistance sont couplés. |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | Rendu, orchestration de l'état, assets, logs, narration, combat et effets sont couplés. |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | réglages de chat mélangés | L'extraction des sections est en cours dans `features/chat-settings`, mais le panneau latéral reste gros. |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | Le rendu de l'affichage et le formatage des commandes sont étroitement couplés. |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | L'affichage du combat, les contrôles et les logs peuvent devenir des panneaux et des hooks plus petits. |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | Une découpe est en partie faite via `RoleplayHUDActionsMenu.tsx` et `RoleplayHUDPanels.tsx`. |

## Structure cible

Voici la direction des refactorisations à venir. Rien n'oblige à tout déplacer d'un coup.

### Cible côté client

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### Cible côté serveur

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### Cible côté shared

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

L'ancienne organisation à plat en `types`, `schemas` et `constants` ne raconte plus toute l'histoire. `packages/shared/src/features/` héberge désormais les agents, les appels de fonction, les packages de dossiers, les jeux au tour par tour, les ensembles de règles et le combat, ainsi que le générateur de mondes. Le premier nettoyage de `shared` doit se limiter aux types et se faire par petites touches, pas par un déplacement massif de fichiers.

## Règles de migration

1. Place le nouveau code dans la section correcte la plus étroite.
2. Si au moins deux modes utilisent un composant client, déplace-le dans `CLIENT-SHARED` avant d'y ajouter d'autres comportements propres à un mode.
3. Si le client et le serveur ont tous les deux besoin d'un type, d'un schéma ou d'un helper pur, déplace-le dans `CORE-CONTRACT`.
4. Si seul le serveur en a besoin, garde-le hors de `packages/shared`.
5. Les fichiers de routes valident l'entrée HTTP et appellent les services. Les décisions métier appartiennent aux services.
6. Un store est soit global (`ui`, `chat`, `sidecar`), soit propre à un mode (`game-mode`, `encounter`). Évite qu'un même store possède discrètement plusieurs modes.
7. Les métadonnées doivent devenir discriminées par `ChatMode` : des métadonnées de base, plus les champs Conversation, Roleplay et Game Mode.
8. Déplace une fonctionnalité à la fois. Laisse des exports ou des wrappers de compatibilité quand un chemin d'import très utilisé brasserait sinon tout le dépôt.
9. Après chaque déplacement, lance le lint :

   ```bash
   pnpm lint
   ```

   Puis lance une vérification Prettier ciblée sur les fichiers modifiés.

## Premiers candidats à la refactorisation

Ces passes de nettoyage sont de bons points de départ : elles réduisent le couplage sans changer le comportement.

1. Découper `components/chat` en groupes commun, Conversation et Roleplay.
   - Candidats communs : `ChatCommonOverlays`, `ChatBranchSelector`, `ChatGalleryDrawer`, `WeatherEffects`, et les primitives de message et de saisie partagées.
   - Candidats Conversation : `ChatConversationSurface`, `ConversationView`, `ConversationMessage`, `ConversationInput`.
   - Candidats Roleplay : `ChatRoleplaySurface`, `SpriteOverlay`, `SceneBanner`, `CyoaChoices`, `EncounterModal`. La découpe du HUD de Roleplay est en partie faite dans `RoleplayHUDActionsMenu.tsx` et `RoleplayHUDPanels.tsx`.
2. Déplacer sous un module de jeu les helpers client réservés à Game Mode.
   - Candidats : `game-audio`, `game-tag-parser`, `game-full-body-pose`, `game-character-name-match`, `game-segment-edits`, `party-dialogue-parser`.
3. Découper `GameSurface.tsx` en hooks d'exécution et en conteneurs plus petits.
   - Hooks candidats : exécution de la narration, des assets, de l'analyse de scène, du combat, des logs et de l'historique, de l'audio.
4. Découper `GameNarration.tsx` en analyse et formatage des commandes, plus des composants d'affichage.
5. Découper `game.routes.ts` par groupe de handlers.
   - Groupes candidats : configuration et session, génération du tour, dés et compétences et événements en temps limité, journal et inventaire, carte et voyage et météo, combat, assets et analyse de scène.
6. Découper `generate.routes.ts` en transport de la génération, traitement du pipeline des agents, routes de réessai, et helpers de commande et de post-traitement. L'issue #7573 a commencé ce travail : la chaîne de sortie des tokens, les tours d'appels d'outils, les commandes de réponse, le nettoyage du texte de réponse, les informations de génération du message enregistré, l'ancre de commande masquée et l'enregistrement de la réponse vivent désormais dans `routes/generate/`, chacun avec sa propre régression.
7. Découper `ChatMetadata` en contrats de métadonnées propres à chaque mode.
8. Sortir les visuels partagés Roleplay et Game Mode de `components/chat` avant que Game Mode n'importe encore plus d'éléments internes du chat.

## Démarrage pratique

Pour la prochaine PR de nettoyage, procède dans cet ordre :

1. Crée les dossiers cibles d'une seule zone.
2. Déplace d'abord les helpers purs.
3. Déplace ensuite les composants feuilles.
4. Laisse le gros orchestrateur en place tant que ses imports ne pointent pas majoritairement vers le nouveau module.
5. N'ajoute des ré-exports de compatibilité que là où le brassage des imports détournerait l'attention du vrai changement.
6. Lance le lint :

   ```bash
   pnpm lint
   ```

   Puis lance des vérifications Prettier ciblées sur les fichiers modifiés.

## Guides associés

- [Architecture du frontend (développeurs)](frontend.md)
- [Stockage natif sur fichiers (développeurs)](file-storage.md)
