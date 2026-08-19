# Architecture du frontend (développeurs)

Ce document s'adresse aux développeurs, ce n'est pas un guide destiné aux utilisateurs. Il explique comment le client de Marinara Engine est construit : la structure de l'application React, les stores Zustand, les hooks React Query, les principaux composants et la carte de l'API du serveur. Si tu veux simplement te servir de l'application, commence plutôt par les guides utilisateur.

## Vue d'ensemble

Marinara Engine est une application de chat IA avec les modes Conversation, Roleplay et Game. Le client est une application React 19 monopage servie par Vite, stylée avec Tailwind CSS v4 et empaquetée en Progressive Web App (PWA).

Le client se trouve dans `packages/client`. Il dialogue avec un serveur d'API Fastify (`packages/server`) via REST et Server-Sent Events (SSE). Les contrats de données partagés (types, schémas Zod, constantes) vivent dans `packages/shared` et sont importés des deux côtés.

## Architecture de l'application

### Disposition en trois colonnes

L'interface reprend une disposition en trois colonnes inspirée de Discord, gérée par `components/layout/AppShell.tsx` :

```
+-------------+-----------------------------+--------------+
|  Left       |         Center              |  Right       |
|  Sidebar    |                             |  Panel       |
|             |  Chat area or Editor        |              |
|  Chat list  |  (lazy-loaded)              |  Characters  |
|  Folders    |                             |  Lorebooks   |
|  Mode tabs  |  ChatConversationSurface    |  Presets     |
|             |  ChatRoleplaySurface        |  Connections |
|             |  GameSurface                |  Agents      |
|             |  CharacterEditor            |  Personas    |
|             |  LorebookEditor             |  Settings    |
|             |  PresetEditor               |  Browser     |
|             |  ...other editors           |              |
+-------------+-----------------------------+--------------+
```

- Barre latérale gauche (`components/layout/ChatSidebar.tsx`) : la liste des chats, organisée par dossiers et filtrable par mode (Conversation, Roleplay, Game).
- Panneau central : soit la surface du chat actif, soit un éditeur plein écran (personnage, lorebook, preset, etc.). Un seul s'affiche à la fois. Les éditeurs remplacent la zone de chat.
- Panneau de droite (`components/layout/RightPanel.tsx`) : un explorateur de ressources et les réglages, que la barre du haut affiche ou masque. Une fois monté, un panneau reste dans le DOM (masqué en CSS) pour conserver sa position de défilement et son état local.
- Barre du haut (`components/layout/TopBar.tsx`) : les boutons d'accès rapide à chaque panneau de droite.

### Navigation

La navigation est pilotée par l'état. Il n'y a pas de routeur d'URL. Le store Zustand `stores/ui.store.ts` détermine ce qui s'affiche :

| Cible de navigation | Champ du store | Fonction de déclenchement |
| ---------------------- | -------------------- | ------------------------------------------------- |
| Ouvrir l'éditeur de personnage | `characterDetailId`  | `openCharacterDetail(id)`                          |
| Ouvrir l'éditeur de lorebook | `lorebookDetailId`   | `openLorebookDetail(id)`                           |
| Ouvrir l'éditeur de preset | `presetDetailId`     | `openPresetDetail(id)`                             |
| Ouvrir l'éditeur de connexion | `connectionDetailId` | `openConnectionDetail(id)`                         |
| Ouvrir l'éditeur d'agent | `agentDetailId`      | `openAgentDetail(id)`                              |
| Ouvrir l'éditeur de persona | `personaDetailId`    | `openPersonaDetail(id)`                            |
| Changer de panneau de droite | `rightPanel`         | `openRightPanel(name)` / `toggleRightPanel(name)` |
| Ouvrir une fenêtre | `modal`              | `openModal(type, props?)`                          |

### Découpage du code

Les éditeurs principaux et les composants lourds sont chargés à la demande dans `AppShell.tsx` grâce à `React.lazy()` et `Suspense`. Le bundle initial reste ainsi léger (voir le budget de bundle plus bas).

## Gestion de l'état

### Stores Zustand (état client)

Le client s'appuie sur un ensemble de stores Zustand rangés dans `packages/client/src/stores/` pour l'état de l'interface et l'état d'exécution. Le fichier `ui.store.ts` est le seul store persisté. Les autres portent l'état d'exécution des chats, des agents, des parties, du runtime de modèle local, de la traduction, des fenêtres, du backfill et des jeux de table.

Les fichiers de store actuels sont : `agent.store.ts`, `backfill.store.ts`, `chat.store.ts`, `chess-game.store.ts`, `dialog.store.ts`, `encounter.store.ts`, `gallery.store.ts`, `game-asset.store.ts`, `game-mode.store.ts`, `game-state.store.ts`, `poker-game.store.ts`, `sidecar.store.ts`, `translation.store.ts`, `ui.store.ts` et `uno-game.store.ts`.

#### `ui.store.ts` : réglages et habillage de l'interface

Le seul store persisté (dans localStorage, via le middleware `persist` de Zustand). Il contient :

- Thème : `visualTheme` ("default" ou "sillytavern"), la valeur `data-theme` (dark ou light) et les couleurs personnalisées qui prennent le dessus.
- Apparence : `fontSize`, `chatFontSize`, `fontFamily`, les polices personnalisées et le style de curseur.
- Affichage du chat : `boldDialogue`, `showTimestamps`, `showModelName` et `messagesPerPage`.
- Mise en forme du texte : couleur du texte du chat, opacité de l'arrière-plan des messages en Roleplay et contour du texte.
- Streaming : `enableStreaming` et `streamingSpeed`.
- Thème Conversation : les couleurs de dégradé des bulles de message.
- Son : `convoNotificationSound` et `rpNotificationSound`.
- Comportement : `confirmBeforeDelete`, `enterToSendRP`, `enterToSendConvo`, `weatherEffects` et `guideGenerations`.
- Navigation : `rightPanel`, `rightPanelOpen`, `sidebarOpen`, `settingsTab`, tous les champs `*DetailId` et `modal`.

Les thèmes personnalisés synchronisés ne sont pas stockés dans `ui.store.ts`. React Query les récupère depuis le serveur, et ils sont répliqués sur tous les appareils reliés à la même instance Marinara.

#### `chat.store.ts` : exécution du chat

Non persisté. Ce store suit la session de chat active :

- `activeChatId` : le chat affiché.
- `messages` : le tableau des messages en cours.
- `isStreaming`, `streamBuffer` : la génération en cours.
- `inputDrafts` : les brouillons de message, un par chat.
- `currentInput` : la valeur actuelle du champ de saisie du chat.
- `perChatTyping` : l'état de l'indicateur de saisie.
- `unreadCounts`, `chatNotifications` : les badges de notification.
- `abortControllers` : l'annulation des générations en cours.

#### `agent.store.ts` : exécution des agents

Suit l'état du pipeline d'agents pendant et après la génération :

- `activeAgents` : les agents en cours d'exécution.
- `thoughtBubbles` : le raisonnement des agents, affiché en direct.
- `echoMessages` : l'echo chamber (chat de spectateurs simulé).
- `cyoaChoices` : l'interface des choix de branchement.
- `debugLog` : les métriques de performance et la consommation de tokens.
- `failedAgentTypes` : les agents en erreur (pour l'interface de relance).

#### `game-state.store.ts` : compagnon RPG

Contient le contexte de scène et de monde du mode Roleplay :

- `current` (GameState) : date, heure, lieu, météo, personnages présents, événements, caractéristiques du joueur, quêtes et inventaire.
- `isVisible`, `expandedSections` : l'état d'affichage du HUD (le bandeau d'infos en haut du chat).

#### `encounter.store.ts` : système de combat

L'état du combat au tour par tour :

- `active` : indique si une rencontre est en cours.
- `party`, `enemies` : les combattants, avec PV, attaques et statuts.
- `environment` : les détails de l'arène.
- `playerActions`, `encounterLog` : la file d'actions et l'historique.
- `combatResult` : victoire, défaite, fuite ou interruption.

#### `gallery.store.ts` : superpositions d'images

- `pinnedImages` : les images épinglées en superposition sur la zone de chat.

### React Query (données du serveur)

Toutes les données du serveur passent par TanStack React Query, qui les récupère et les met en cache. La configuration se trouve dans `main.tsx` :

- Durée de fraîcheur : 30 secondes (valeur par défaut globale).
- Nouvelle tentative : 1 essai.
- Rechargement au retour du focus : désactivé.
- Cache : en mémoire uniquement (aucune persistance).

Chaque entité dispose d'un fichier de hooks dédié qui exporte les hooks de requête et de mutation.

## Référence des hooks

Tous les hooks vivent dans `src/hooks/` et suivent le schéma `use-{entity}.ts`.

### Hooks de chat (`use-chats.ts`)

| Hook | Type | Description |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()`                       | Query          | Tous les chats |
| `useChat(id)`                      | Query          | Un chat unique, par ID |
| `useChatMessages(chatId, perPage)` | Infinite Query | Les messages paginés d'un chat |
| `useChatGroup(groupId)`            | Query          | Un groupe de chats |
| `useCreateChat()`                  | Mutation       | Créer un chat |
| `useDeleteChat()`                  | Mutation       | Supprimer un chat |
| `useUpdateChatMetadata()`          | Mutation       | Mettre à jour les métadonnées du chat (agents, sprites, etc.) |
| `useBranchChat()`                  | Mutation       | Créer une branche de chat à partir d'un message précis |
| `useUpdateMessage()`               | Mutation       | Modifier le contenu d'un message (mise à jour optimiste) |
| `useDeleteMessage()`               | Mutation       | Supprimer un message |
| `useDeleteMessages()`              | Mutation       | Supprimer plusieurs messages |
| `useSetActiveSwipe()`              | Mutation       | Passer à un autre swipe de génération |
| `usePeekPrompt()`                  | Mutation       | Prévisualiser le prompt assemblé |
| `useClearAllData()`                | Mutation       | Tout supprimer (destructif) |

### Hooks de personnage (`use-characters.ts`)

| Hook | Type | Description |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()`      | Query    | Tous les personnages |
| `useCharacter(id)`     | Query    | Un personnage unique, avec les données de fiche analysées |
| `useCreateCharacter()` | Mutation | Créer un personnage |
| `useUpdateCharacter()` | Mutation | Mettre à jour les données de la fiche de personnage |
| `useDeleteCharacter()` | Mutation | Supprimer un personnage |
| `useUploadAvatar()`    | Mutation | Téléverser une image d'avatar |
| `usePersonas()`        | Query    | Tous les personas |
| `usePersona(id)`       | Query    | Un persona unique |
| `useCreatePersona()`   | Mutation | Créer un persona |
| `useUpdatePersona()`   | Mutation | Mettre à jour un persona |
| `useDeletePersona()`   | Mutation | Supprimer un persona |
| `useCharacterGroups()` | Query    | Les groupes de personnages |
| `usePersonaGroups()`   | Query    | Les groupes de personas |

### Hooks de preset (`use-presets.ts`)

| Hook | Type | Description |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()`                 | Query    | Tous les presets |
| `usePreset(id)`                | Query    | Un preset unique |
| `usePresetFull(id)`            | Query    | Un preset avec ses sections, groupes et choix |
| `useDefaultPreset()`           | Query    | Le preset par défaut |
| `useCreatePreset()`            | Mutation | Créer un preset |
| `useUpdatePreset()`            | Mutation | Mettre à jour un preset |
| `useDeletePreset()`            | Mutation | Supprimer un preset |
| `usePresetSections(presetId)`  | Query    | Les sections de prompt d'un preset |
| `usePresetGroups(presetId)`    | Query    | Les groupes de sections |
| `usePresetVariables(presetId)` | Query    | Les variables du preset (anciennement blocs de choix) |
| `usePreviewPreset()`           | Mutation | L'aperçu du prompt rendu pour `{ presetId, chatId, choices }` |

### Hooks d'agent (`use-agents.ts`)

| Hook | Type | Description |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()`  | Query    | Toutes les configurations d'agent |
| `useAgentConfig(id)` | Query    | La configuration d'un agent |
| `useCreateAgent()`   | Mutation | Créer un agent personnalisé |
| `useUpdateAgent()`   | Mutation | Mettre à jour la configuration d'un agent |
| `useDeleteAgent()`   | Mutation | Supprimer un agent |
| `useToggleAgent()`   | Mutation | Activer ou désactiver un agent intégré |

### Hook de génération (`use-generate.ts`)

Le hook le plus complexe. Il renvoie `{ generate, retryAgents }`.

`generate(params)` reçoit un unique objet d'options avec des champs comme `chatId`, `connectionId`, `userMessage`, `regenerateMessageId`, `continueMessageId`, `impersonate` et `attachments`. Il renvoie `false` si une génération est déjà en cours pour ce chat. Le déroulement est le suivant :

1. Passer l'état de streaming dans `chat.store.ts`.
2. Envoyer la demande de génération à `/api/generate`.
3. Analyser les événements SSE comme `token`, `agent_start`, `agent_result`, `agent_error`, `thinking`, `tool_call`, `game_state`, `game_state_patch`, `text_rewrite`, `scene_created`, `done` et `error`.
4. Mettre à jour le cache React Query avec les nouveaux messages.
5. Remplir le store des agents avec les bulles de pensée et les infos de débogage.
6. Traiter les erreurs et les signaler par des notifications toast.

### Autres hooks

Le dossier `src/hooks/` contient aussi de nombreux hooks propres à une fonctionnalité. Voici un échantillon représentatif :

| Fichier | Rôle |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts`           | CRUD des connexions d'API, plus le test |
| `use-lorebooks.ts`             | CRUD des lorebooks et des entrées |
| `use-scene.ts`                 | Planification, création et conclusion des scènes |
| `use-encounter.ts`             | Initialisation, action et résumé d'une rencontre de combat |
| `use-autonomous-messaging.ts`  | Interrogation et planification des messages autonomes |
| `use-idle-detection.ts`        | Détecteur d'inactivité de 10 minutes |
| `use-background-autonomous.ts` | Interrogation en arrière-plan des chats inactifs |
| `use-translate.ts`             | Traduction de texte |
| `use-apply-regex.ts`           | Exécution des scripts regex sur les messages |
| `use-custom-tools.ts`          | CRUD des outils personnalisés |
| `use-knowledge-sources.ts`     | Gestion des sources de connaissances |
| `use-gallery.ts`               | Images de la galerie du chat |
| `use-chat-folders.ts`          | CRUD des dossiers de chat, plus la réorganisation |
| `use-regex-scripts.ts`         | CRUD des scripts regex |
| `use-haptic.ts`                | Connexion et commandes des appareils haptiques |

## Guide des composants

### Système de chat (`components/chat/`)

Le système de chat est le plus gros domaine fonctionnel. Le fichier `ChatArea.tsx` charge à la demande trois surfaces de rendu : Conversation, Roleplay et Game Mode.

#### Mode Conversation (`ChatConversationSurface.tsx`)

Des bulles de chat façon messagerie. Les messages de l'utilisateur à droite, ceux de l'assistant à gauche. Au menu :

- Pagination par défilement infini (les messages plus anciens se chargent quand tu remontes).
- Actions par message : modifier, copier, régénérer, supprimer, créer une branche, inspecter le prompt.
- Prise en charge des pièces jointes (images et fichiers).
- Sélecteurs d'emoji et de GIF.
- Commandes slash.
- Sons de notification à l'arrivée d'un message.
- Brouillons conservés pour chaque chat.

#### Mode Roleplay (`ChatRoleplaySurface.tsx`)

Une interface sombre et immersive, aux couleurs du RPG. Elle reprend tout ce que propose le mode Conversation, et y ajoute :

- Des sprites de personnage dont l'expression change, pilotée par l'agent d'expression.
- Le HUD du mode Roleplay, qui affiche l'état du jeu (heure, lieu, météo, personnages présents).
- Des effets météo (des particules en surimpression, accordées à la météo de la scène).
- Le panneau de l'echo chamber (réactions simulées de spectateurs).
- Des rencontres de combat, avec un système d'actions au tour par tour.
- Un panneau World Info qui montre les entrées de lorebook actives.
- Un système de scènes pour créer des mini-roleplays en branche.
- Des images d'arrière-plan avec transitions en fondu enchaîné.

#### Game Mode (`GameSurface.tsx`)

La surface du Game Master (le maître du jeu) piloté par l'IA. Elle vit en dehors du dossier du chat, dans `components/game/GameSurface.tsx`. Le fichier `ChatArea.tsx` l'affiche quand le mode du chat vaut `game`. Elle lit les stores de jeu dédiés (`game-mode.store.ts`, `game-asset.store.ts`, `game-state.store.ts`). Elle pilote les sessions, les jets de dés, les jets de compétence, les cartes et les storyboards de tour à travers les hooks de `use-game.ts` et `use-game-storyboards.ts`.

#### Composants clés

- `ChatArea.tsx` : le chef d'orchestre central. Il récupère toutes les données (messages, personnages, personas), construit la carte des personnages, détermine le mode du chat et affiche la bonne surface.
- `ChatMessage.tsx` : affiche un message unique, avec le markdown, la navigation entre swipes, l'édition et les menus d'action. Il utilise un sous-composant `EditTextarea` non contrôlé pour éviter les rendus successifs pendant l'édition.
- `ChatInput.tsx` : la saisie de l'utilisateur, avec redimensionnement automatique, conservation des brouillons, complétion des commandes slash, gestion des pièces jointes et insertion d'emoji ou de GIF.

### Composants d'éditeur

Chaque type de ressource a son éditeur plein écran, qui remplace la zone de chat :

| Éditeur | Fichier | Ce qu'il gère |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Éditeur de personnage  | `components/characters/CharacterEditor.tsx`   | Champs de la fiche de personnage, avatar, message d'accueil, personnalité, prompt système, métadonnées |
| Éditeur de lorebook   | `components/lorebooks/LorebookEditor.tsx`     | Métadonnées du lorebook et entrées avec leurs clés, règles d'activation, réglages d'insertion |
| Éditeur de preset     | `components/presets/PresetEditor.tsx`         | Sections de prompt, groupes, marqueurs, paramètres de génération, blocs de choix |
| Éditeur de connexion | `components/connections/ConnectionEditor.tsx` | Fournisseur d'API, URL de base, modèle, fenêtre de contexte, options |
| Éditeur d'agent      | `components/agents/AgentEditor.tsx`           | Modèle de prompt de l'agent, phase, connexion, outils, réglages |
| Éditeur de persona    | `components/personas/PersonaEditor.tsx`       | Le persona de l'utilisateur, avec nom, description, caractéristiques, avatar |

### Système de fenêtres (`components/modals/`)

Les fenêtres sont rendues par `components/layout/ModalRenderer.tsx`. Ce composant lit `ui.store.modal` et affiche le composant correspondant à l'intérieur d'un `Suspense`. Les composants de fenêtre vivent sous `components/modals/`.

Les types de fenêtre actuels comprennent notamment (cette liste est indicative, pas exhaustive) :

| Type | Composant | Rôle |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character`         | `CreateCharacterModal`        | Création rapide d'un personnage (nom et avatar) |
| `create-connection`        | `CreateConnectionModal`       | Création rapide d'une connexion |
| `create-persona`           | `CreatePersonaModal`          | Création rapide d'un persona |
| `create-lorebook`          | `CreateLorebookModal`         | Création rapide d'un lorebook |
| `create-preset`            | `CreatePresetModal`           | Création rapide d'un preset |
| `import-character`         | `ImportCharacterModal`        | Import depuis un fichier (JSON ou PNG) |
| `import-connection`        | `ImportConnectionModal`       | Import d'un paquet de connexion |
| `import-lorebook`          | `ImportLorebookModal`         | Import depuis un fichier |
| `import-preset`            | `ImportPresetModal`           | Import depuis un fichier |
| `import-persona`           | `ImportPersonaModal`          | Import depuis un fichier |
| `character-card-update`    | `CharacterCardUpdateModal`    | Relecture d'une évolution de fiche proposée par un agent |
| `agent-write-approval`     | `AgentWriteApprovalModal`     | Consentement et relecture des écritures d'un agent |
| `docs-viewer`              | `DocsViewerModal`             | Le lecteur de documentation intégré |
| `st-bulk-import`           | `STBulkImportModal`           | Import en masse de données SillyTavern |
| `about-me-viewer`          | `AboutMeViewerModal`          | Consulter un About Me du mode Conversation |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | Réglages des préférences de prompt de scène |

Le schéma commun à toutes les fenêtres : elles acceptent `{ open, onClose }`, encapsulent leur contenu dans le composant de base `Modal`, passent par des mutations pour les appels d'API et affichent un état de chargement à partir de `mutation.isPending`.

### Système de panneaux (`components/panels/`)

Les panneaux de droite présentent des listes de ressources avec recherche, tri et filtrage. Quand tu cliques sur une ressource, son éditeur complet s'ouvre dans le panneau central.

Les panneaux sont enregistrés à deux endroits dans `RightPanel.tsx` :

1. `PANEL_CONFIG` : le titre, l'icône et la couleur du dégradé.
2. `PANELS` : la table des composants.

Les panneaux reposent sur une persistance au niveau du module. Un Set `mountedPanels` retient les panneaux déjà visités. Une fois monté, un panneau reste dans le DOM (masqué par `display: none` ou `aria-hidden`) pour conserver son état.

### Primitives d'interface (`components/ui/`)

| Composant | Description |
| ------------------ | --------------------------------------------------------------------- |
| `Modal`            | La fenêtre de base : clic sur le fond, touche Esc, animations d'entrée et de sortie |
| `ColorPicker`      | Sélecteur de couleur unie ou de dégradé, avec des échantillons prédéfinis |
| `ExpandedTextarea` | Une surimpression en portail plein écran pour modifier de gros blocs de texte |
| `EmojiPicker`      | Panneau contextuel d'emoji avec recherche (rendu en portail) |
| `GifPicker`        | Recherche de GIF via l'API Giphy |
| `HelpTooltip`      | Icône qui affiche au survol une infobulle positionnée en portail |

Tous les composants d'interface fonctionnent avec des props contrôlées (value et onChange) et un rendu en portail pour les surimpressions.

## Client d'API (`lib/api-client.ts`)

Toute la communication avec le serveur passe par l'objet `api` :

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| Méthode | Signature | Description |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)`             | `GET /api{path}`    | Récupérer du JSON |
| `api.post<T>(path, body)`      | `POST /api{path}`   | Envoyer du JSON, recevoir du JSON |
| `api.put<T>(path, body)`       | `PUT /api{path}`    | Mise à jour complète |
| `api.patch<T>(path, body)`     | `PATCH /api{path}`  | Mise à jour partielle |
| `api.delete(path)`             | `DELETE /api{path}` | Supprimer une ressource |
| `api.upload(path, FormData)`   | `POST /api{path}`   | Téléversement de fichier en multipart |
| `api.download(path, filename)` | `GET /api{path}`    | Téléchargement avec boîte de dialogue d'enregistrement |
| `api.stream(path, body)`       | `POST /api{path}`   | Générateur asynchrone SSE (tokens seulement) |
| `api.streamEvents(path, body)` | `POST /api{path}`   | Générateur asynchrone SSE (tous les types d'événement) |

En cas d'erreur, une exception `ApiError` est levée ; elle porte les propriétés `status` et `message`.

## Système de styles

### Tailwind CSS v4

Le projet utilise Tailwind CSS v4 avec le plugin `@tailwindcss/vite` (aucune configuration PostCSS n'est nécessaire). Les tokens de thème sont mis en correspondance avec les propriétés CSS personnalisées de `globals.css` :

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### Architecture des thèmes

Le fichier `globals.css` est découpé en sections nommées. On y trouve la correspondance `@theme` de Tailwind, les variables du thème sombre, les surcharges du thème clair, la réinitialisation de base, les curseurs personnalisés, les barres de défilement, les panneaux en verre, les utilitaires de lueur, les composants d'interface et les animations par images-clés. D'autres sections couvrent les animations du chat, le style du chat propre à chaque mode, les sprites et le HUD de jeu, les cartes d'appel de fonction, les règles responsives, le thème SillyTavern importé, les règles d'accessibilité et les indications de performance.

### Thèmes personnalisés

Chacun peut créer ses propres thèmes. Les définitions de thème sont stockées sur le serveur Marinara et se synchronisent entre les appareils connectés. Le thème personnalisé actif est partagé lui aussi. Le composant `CustomThemeInjector.tsx` insère le CSS dans une balise `style`.

Le CSS d'un thème synchronisé peut demander le moteur intégré Accent Pulse avec `--marinara-theme-accent-pulse: enabled`. Ajoute `--marinara-theme-accent-pulse-source: #a78bfa` (ou un dégradé) quand la pulsation doit employer une couleur d'accent précise du thème plutôt que l'accent en cours défini dans Appearance.

### Personal Extensions

Les Personal Extensions sont du code isolé en bac à sable, stocké sur le serveur et approuvé par empreinte exacte. L'interface Addons s'appuie sur `use-personal-extensions.ts` ; `PersonalExtensionInjector.tsx` héberge le code Browser approuvé dans un Worker dédié, à l'intérieur d'une iframe en bac à sable d'origine opaque, et sert d'intermédiaire pour des instantanés immuables du contexte du chat actif. Les champs de contexte sont toujours présents ; hors d'un chat actif, `chatId` et `characterId` valent `null` et `characterIds` est vide. Les champs limités de la fiche du personnage actif et du persona sélectionné exigent des permissions déclarées séparément et liées à l'empreinte. Les extensions serveur s'exécutent dans un processus Node distinct, sous macOS Seatbelt ou Linux Bubblewrap, et échouent par sécurité quand aucun de ces deux backends n'est disponible. Les sources externes exigent le verrou du fichier `.env` et l'activation explicite dans la section Danger Zone, aux frontières du listage, de l'approbation et de l'exécution.

Consulte [Architecture des Personal Extensions](personal-extensions.md) avant de modifier cette fonctionnalité.

## Paquet partagé (`packages/shared`)

Le frontend importe ses types, schémas et constantes depuis `@marinara-engine/shared`.

### Constantes

Les fichiers importants de `packages/shared/src/constants/` :

- `defaults.ts` : exporte entre autres `APP_VERSION`, `PROFESSOR_MARI_ID`, `DEFAULT_CONNECTION_ID`, `DEFAULT_GENERATION_PARAMS`, `MAX_FILE_SIZES` et `LIMITS`. C'est la source de vérité pour la version, et il porte les réglages de génération par défaut.
- `providers.ts` : exporte `PROVIDERS`, les configurations des fournisseurs d'API (OpenAI, Anthropic, Google, etc.) avec leurs URL et leur authentification.
- `model-lists.ts` : les catalogues de modèles statiques par fournisseur, plus `IMAGE_GENERATION_SOURCES` pour les fournisseurs de génération d'images.
- `agent-prompts.ts` : les prompts de résumé et de secret plot du socle de base, plus la recherche à l'exécution des prompts fournis par les paquets d'agents installés.

### Schémas (Zod)

Toute la validation des entrées repose sur les schémas Zod de `packages/shared/src/schemas/`. Fichiers représentatifs :

| Fichier de schéma | Entités |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts`       | Création et mise à jour d'AgentConfig, phases d'agent, types de résultat |
| `character.schema.ts`   | Fiches de personnage, métadonnées de compatibilité, character books, groupes |
| `chat.schema.ts`        | Création de chat, création de message, demande de génération |
| `connection.schema.ts`  | Création et mise à jour d'une connexion d'API |
| `custom-tool.schema.ts` | Définitions des outils personnalisés |
| `lorebook.schema.ts`    | Création et mise à jour des lorebooks et des entrées, conditions d'activation, emplois du temps |
| `prompt.schema.ts`      | Preset, section, groupe, bloc de choix, paramètres de génération |
| `regex.schema.ts`       | Création et mise à jour d'un script regex |
| `personal-extension.schema.ts` | Brouillons de Personal Extension, approbation par empreinte exacte, retour arrière et stockage privé |

Ce dossier abrite aussi les schémas des réglages de l'application, des profils de réglages de chat, des appels en Conversation, des emojis et stickers personnalisés, de Noodle et des thèmes.

### Types

Les définitions de type des entités vivent dans `packages/shared/src/types/`. Un échantillon des fichiers importants :

| Fichier de types | Interfaces principales |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts`            | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts`        | `Character`, `CharacterCardV2`, `CharacterData`, `RPGStatsConfig`                                           |
| `chat.ts`             | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent`                          |
| `connection.ts`       | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult`                                   |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings`                               |
| `game-state.ts`       | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem`                            |
| `lorebook.ts`         | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData`                         |
| `persona.ts`          | `Persona`, `PersonaStatsConfig`                                                                             |
| `personal-extension.ts` | `PersonalExtension`, métadonnées d'exécution, révisions, source et état du runtime serveur                |
| `prompt.ts`           | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters`                       |
| `scene.ts`            | `SceneMeta`, `SceneFullPlan`                                                                                |
| `haptic.ts`           | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand`                                                       |

### Utilitaires

| Fichier | Rôle |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)` : remplace les macros comme `{{date}}`, `{{char}}`, `{{random}}`, `{{roll:2d6}}` et `{{getvar::name}}` |
| `xml-wrapper.ts`  | `nameToXmlTag()` : convertit un nom affiché en slug de balise XML ("World Info (Before)" devient "world_info_before") |

## Points d'entrée de l'API

Le serveur (`packages/server`) expose des API REST sous `/api`. Ce qui suit est une carte générale, pas la liste exhaustive. La source de vérité reste le fichier `packages/server/src/routes/index.ts` et les fichiers de route individuels.

### Ressources principales

| Préfixe | Méthodes | Description |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters`    | GET, POST, PATCH, DELETE | CRUD des personnages, groupes, export (JSON ou PNG) |
| `/api/chats`         | GET, POST, PATCH, DELETE | CRUD des chats, messages, métadonnées, connexion et déconnexion |
| `/api/prompts`       | GET, POST, PATCH, DELETE | CRUD des presets, sections, groupes, blocs de choix, export |
| `/api/connections`   | GET, POST, PATCH, DELETE | CRUD des connexions d'API, duplication, test |
| `/api/agents`        | GET, POST, PATCH, DELETE | CRUD des agents, echo messages, exécutions ; l'activation des agents intégrés passe par `PUT /api/agents/toggle/:agentType` |
| `/api/lorebooks`     | GET, POST, PATCH, DELETE | CRUD des lorebooks, entrées, export |
| `/api/custom-tools`  | GET, POST, PATCH, DELETE | CRUD des outils personnalisés |
| `/api/regex-scripts` | GET, POST, PATCH, DELETE | CRUD des scripts regex |

Les outils de mémoire des agents passent par `/api/agents/memory/:agentType/:chatId`, où `agentType` est la chaîne du type d'agent et `chatId` l'identifiant du chat visé.

### Génération

| Point d'entrée | Méthode | Description |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate`              | POST   | La génération SSE principale, avec le pipeline d'agents |
| `/api/generate/retry-agents` | POST   | La relance SSE des types d'agent fournis par l'appelant |

### Fonctionnalités de chat

| Préfixe | Points d'entrée | Description |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders`       | CRUD plus réorganisation | Gestion des dossiers de chat |
| `/api/conversation`       | schedule, status, message, check | Système de messages autonomes |
| `/api/scene`              | create, plan, conclude           | Branchement de scènes |
| `/api/encounter`          | init, action, summary            | Rencontres de combat |
| `/api/translate`          | POST                             | Traduction de texte |
| `/api/game`               | CRUD et actions | Sessions et état du Game Mode |
| `/api/game-assets`        | CRUD et téléversement | Ressources de jeu |
| `/api/turn-games`         | Routes Chess, UNO, Poker | Jeux de table en Conversation |
| `/api/conversation-calls` | routes d'appel et de session | Appels audio en Conversation |

### Médias et ressources

| Préfixe | Description |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | Service des images d'avatar |
| `/api/backgrounds`            | CRUD des arrière-plans, plus le téléversement |
| `/api/sprites/:characterId`   | Gestion des expressions de sprite |
| `/api/fonts`                  | Gestion des polices personnalisées |
| `/api/gallery/:chatId`        | Images de galerie propres à un chat |
| `/api/global-gallery`         | Images de la galerie globale |
| `/api/tts`                    | Routes de Text to Speech |
| `/api/youtube`                | Routes du DJ YouTube |
| `/api/custom-emojis`          | Ressources d'emojis personnalisés |
| `/api/custom-stickers`        | Ressources de stickers personnalisés |
| `/api/gifs/search`            | Recherche de GIF (proxy Giphy) |

### Intégrations externes

| Préfixe | Description |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*`       | Recherche de personnages Chub |
| `/api/bot-browser/chartavern/*` | Recherche CharacterTavern |
| `/api/bot-browser/janny/*`      | Recherche JannyAI |
| `/api/bot-browser/pygmalion/*`  | Recherche Pygmalion |
| `/api/bot-browser/wyvern/*`     | Recherche Wyvern |
| `/api/bot-browser/datacat/*`    | Recherche DataCat |
| `/api/haptic/*`                 | Pilotage des appareils haptiques |
| `/api/spotify/*`                | Authentification Spotify |
| `/api/knowledge-sources`        | Base de connaissances pour la récupération d'informations |

### Système

| Point d'entrée | Description |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check`            | Vérification de version face aux releases GitHub |
| `/api/updates/latest`           | Métadonnées de la dernière release |
| `/api/updates/commits-behind`   | Retard de mise à jour d'une installation Git |
| `/api/backup`                   | Sauvegarde complète, export, import |
| `/api/import/*`                 | Import de profils SillyTavern et Marinara |
| `/api/admin/clear-all`          | Effacement complet des données |
| `/api/themes`                   | Thèmes personnalisés synchronisés |
| `/api/personal-extensions`      | Politique des extensions en bac à sable, brouillons, approbation, exécution et stockage privé |
| `/api/app-settings`             | Réglages de l'application côté serveur |
| `/api/sidecar`                  | Runtime de modèle local |
| `/api/chat-presets`             | Profils de réglages de chat (ancien nom de point d'entrée) |
| `/api/connection-folders`       | Dossiers de connexions |
| `/api/prompt-overrides`         | Surcharges des prompts intégrés |
| `/api/achievements`             | Déblocage des succès |
| `/api/noodle`                   | Le fil social Noodle |
| `/api/professor-mari/workspace` | Opérations sur l'espace de travail de Professor Mari |

## Prise en charge PWA

L'application est une Progressive Web App configurée avec VitePWA :

- Manifeste : `public/manifest.json`, avec le nom d'application "Marinara Engine", le mode d'affichage standalone et le thème sombre.
- Icônes : un favicon de 64 px, des icônes maskables de 192 px et 512 px, et un logo d'écran de démarrage.
- Service worker : Workbox, avec une stratégie de mise à jour automatique.
- Cache : les ressources statiques sont mises en cache ; les routes `/api/*` passent en NetworkOnly.
- Maintien en éveil : `lib/keep-alive.ts` combine l'API Web Locks et des pings BroadcastChannel pour empêcher l'onglet de s'endormir.

### Détection d'écart de version

Le fichier `App.tsx` interroge `/api/health` toutes les 5 minutes. Si la version du serveur diffère de la version que le client a en cache, le client désinscrit le service worker. Il vide aussi les caches pour forcer la mise à jour.

## Système d'agents

Le système d'agents traite les réponses de l'IA à travers des pipelines configurables. Les agents s'exécutent en trois phases :

1. Pré-génération : avant l'appel principal au LLM (par exemple l'insertion de contexte ou la récupération de connaissances).
2. Parallèle : en même temps que la génération principale (par exemple le suivi de l'état du monde ou le combat).
3. Post-traitement : après la réponse principale (par exemple la réécriture du texte ou la mise à jour des lorebooks).

Les demandes de relance passent par `/api/generate/retry-agents`, avec une liste `agentTypes` explicite. Une action d'interface globale comme **Re-run Trackers** (relancer les trackers) transmet tous les types de tracker actifs. La commande d'un widget particulier ne transmet que le tracker qu'elle vise.

Les outils de mémoire des agents, comme le panneau Secret Plot du Narrative Director, passent par `/api/agents/memory/:agentType/:chatId`. Cette route vaut pour les agents configurés qui conservent une mémoire par chat. La mémoire Secret Plot est stockée sous `director` dans les configurations actuelles, tandis que `secret-plot-driver` reste accepté pour les anciens chats.

### Agents téléchargeables officiels

Le moteur, volontairement léger, est livré avec un registre d'agents vide à l'exécution. Les paquets installés depuis le catalogue public [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) apportent, à l'exécution, des manifestes d'agent validés, des points d'entrée de fonctionnalité côté client et serveur, ainsi que des emplacements d'interface. Les définitions actives restent exposées via `BUILT_IN_AGENTS` par compatibilité, mais elles proviennent des paquets installés et non d'implémentations livrées avec le moteur. Le catalogue officiel contient les paquets suivants :

| Agent | Phase | Ce qu'il fait |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian`         | post_processing | Veille à la qualité d'écriture (anti-répétition, montrer plutôt que raconter) |
| `continuity`             | post_processing | Repère les ruptures de continuité et peut produire des consignes de réécriture |
| `director`               | pre_generation  | Insère des directions narratives et, en option, l'état du Secret Plot |
| `echo-chamber`           | parallel        | Simule les réactions du public |
| `world-state`            | post_processing | Extrait la date, l'heure, le lieu et la météo depuis la narration |
| `expression`             | post_processing | Choisit les expressions des sprites de personnage |
| `quest`                  | post_processing | Suit la création, la mise à jour et l'achèvement des quêtes |
| `background`             | post_processing | Choisit des images d'arrière-plan adaptées |
| `character-tracker`      | post_processing | Suit les changements d'état des personnages |
| `persona-stats`          | post_processing | Suit l'évolution des caractéristiques du persona du joueur |
| `custom-tracker`         | post_processing | Suit un état structuré défini par l'utilisateur |
| `inventory-tracker`      | post_processing | Suit les monnaies, l'équipement porté et l'inventaire |
| `illustrator`            | post_processing | Génère les prompts d'image de scène et les demandes de médias |
| `lorebook-keeper`        | post_processing | Crée et met à jour automatiquement les entrées de lorebook |
| `card-evolution-auditor` | post_processing | Audite les fiches de personnage et suggère des évolutions |
| `combat`                 | parallel        | Suit les rounds de combat, les PV, l'initiative et les résultats |
| `html`                   | post_processing | Réécrit les réponses Roleplay terminées pour y ajouter des visuels HTML diégétiques |
| `spotify`                | post_processing | Pilote la lecture du Music DJ (Spotify, YouTube ou musique locale) |
| `knowledge-retrieval`    | pre_generation  | Récupère du contexte depuis les sources de connaissances |
| `knowledge-router`       | pre_generation  | Aiguille les entrées de lorebook et de connaissances pertinentes |
| `haptic`                 | post_processing | Envoie des commandes aux appareils haptiques |
| `cyoa`                   | post_processing | Génère les prompts de choix |
| `conversation-calls`     | feature         | Ajoute les appels audio/vidéo en Conversation et leurs réglages |
| `hierarchical-maps`      | feature         | Ajoute les cartes Roleplay/Game, le contexte spatial et le déplacement |
| `uno`                    | feature         | Ajoute la table d'UNO en Conversation |
| `chess`                  | feature         | Ajoute l'échiquier en Conversation |
| `poker`                  | feature         | Ajoute la table de Texas Hold'em en Conversation |
| `eightball`              | feature         | Ajoute la table de billard 8-Ball en Conversation |
| `tic-tac-toe`            | feature         | Ajoute le morpion en Conversation |
| `rock-paper-scissors`    | feature         | Ajoute les parties de pierre-feuille-ciseaux en Conversation |

### Types de résultat des agents

Les agents produisent des résultats typés que le frontend sait traiter. L'union `AgentResultType`, dans `packages/shared/src/types/agent.ts`, comprend :

`game_state_update`, `text_rewrite`, `sprite_change`, `echo_message`, `quest_update`, `image_prompt`, `context_injection`, `continuity_check`, `director_event`, `lorebook_update`, `character_card_update`, `background_change`, `character_tracker_update`, `persona_stats_update`, `custom_tracker_update`, `inventory_tracker_update`, `spotify_control`, `youtube_control`, `local_music_control`, `haptic_command`, `cyoa_choices`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `prompt_patch`, `frontend_theme_update` et `about_me_update`.

## Modes de chat

### Mode Conversation

Un dialogue simple avec un ou plusieurs personnages IA. Les personnages peuvent afficher différents statuts (online, idle, do not disturb, offline) qui influent sur le rythme et le style des réponses. Les agents intégrés s'ajoutent chat par chat plutôt que de s'activer globalement.

### Mode Roleplay

Une expérience narrative immersive avec suivi de l'état du jeu : contexte de scène (lieu, heure, météo), présence et humeur des personnages, caractéristiques du joueur, inventaire et quêtes, rencontres de combat, World Info issu des lorebooks et expressions des sprites.

### Game Mode

Des sessions animées par un Game Master IA, avec des membres d'équipe, des dés, un état du jeu, des ressources, des storyboards, un journal et un cycle de session structuré. Le Game Mode s'appuie sur des stores et des routes dédiés pour l'état du jeu, les ressources, les jeux de table, les vidéos de scène et les storyboards. Voir [Game Mode : premiers pas](../game/getting-started.md) pour le déroulement côté utilisateur.

## Développement

### Commandes

Installer les dépendances :

```bash
pnpm install
```

Démarrer le serveur et le client avec rechargement à chaud :

```bash
pnpm dev
```

Lancer uniquement le serveur de développement du client :

```bash
pnpm dev:client
```

Lancer uniquement le serveur d'API :

```bash
pnpm dev:server
```

Lancer la validation de référence (TypeScript et ESLint) :

```bash
pnpm check
```

Compiler pour la production :

```bash
pnpm build
```

### Budget de bundle

- Entrée principale : 1 Mo maximum.
- Par chunk : 500 Ko maximum.
- Découpage des dépendances : react, tanstack, motion, zustand, icons et misc.

### Alias de chemin

`@/*` pointe vers `./src/*`, aussi bien dans la configuration TypeScript que dans celle de Vite.

## Guides associés

- [Carte de l'architecture (développeurs)](architecture-map.md)
- [Stockage file-native (développeurs)](file-storage.md)
