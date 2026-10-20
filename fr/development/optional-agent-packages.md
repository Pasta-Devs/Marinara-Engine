# Packages d'agents et de capacités optionnels

Statut : implémenté pendant le cycle de développement de la v2.3.0, dans le ticket #3612.

## Objectif

La distribution de base de Marinara Engine ne doit ni compiler ni livrer les implémentations d'agents et de capacités optionnels. Une installation neuve démarre sans aucun package optionnel. Une mise à jour conserve les capacités disponibles avant l'arrivée de ce système de packages.

Le catalogue officiel, les sources des packages, les artefacts reproductibles, les scripts de validation et le processus de contribution se trouvent dans [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Les artefacts installés sont placés sous le dossier de données Marinara configuré, pour que les mises à jour de l'application ne puissent pas les écraser.

## Modèle de package

Un package d'agent peut apporter un ou plusieurs agents déclaratifs, ainsi que des capacités exécutables de confiance en option :

- des points d'entrée serveur pour les routes, les hooks de cycle de vie, les fournisseurs de prompts, les gestionnaires de résultats et les migrations de stockage ;
- des points d'entrée client pour les panneaux, les surfaces de chat, les sections de réglages, les choix de configuration, les affichages d'exécution et les surfaces complètes de Game Mode ;
- des schémas JSON partagés et des contrats de communication stables ;
- des ressources, de la documentation et des fragments de connaissances pour Professor Mari, tous détenus par le package.

Les packages ciblent une version précise de l'API de capacités Marinara. Ils ne doivent pas importer de chemins de source privés du moteur.

Les éléments d'interface de capacité reçoivent la langue d'interface retenue par le moteur via leurs attributs `lang` et `dir` et via
l'objet `capabilityProps.localization`. Les interfaces détenues par un package gardent leurs propres fichiers de langue et retombent sur
l'anglais du package ; le moteur ne traduit ni les prompts du package ni les valeurs machine qu'il définit. Un changement de langue réutilise
l'événement `marinara-capability-props` existant : une interface installée se réaffiche donc sans redémarrer le moteur.

### Distribution et mise en cache

Les fichiers des packages installés sont servis avec des validateurs forts dérivés des empreintes SHA-256 de chaque fichier du manifeste, les mêmes valeurs que le moteur utilise pour revérifier les octets à chaque lecture. Le bundle client (`/api/capability-packages/<id>/client`) et chaque ressource du package sont toujours revalidés (`no-cache` avec un `ETag`) : un fichier inchangé répond `304 Not Modified` au lieu d'être téléchargé à nouveau, tandis qu'un fichier republié est pris en compte immédiatement. Rien n'est servi avec `immutable` : la politique d'installation autorise la republication d'une même version avec des octets différents, aucune URL de package n'est donc adressée par contenu.

L'API de capacités 1.1 ajoute une façade d'exécution générique au contexte d'activation serveur.
Les packages peuvent lire l'état effectif du débogage d'agent et écrire dans le logger Pino
du moteur, y compris en forçant explicitement le mode débogage, sans importer le
logger privé ni les modules de configuration d'exécution. La façade expose des opérations,
pas les objets internes du moteur.

L'API de capacités 1.2 ajoute des opérations de chat et de message limitées à une transaction, des
écritures ciblées de métadonnées de chat, des lectures d'existence d'entrée de lore et le magasin de compatibilité
des instantanés spatiaux. Les packages peuvent valider des changements métier à l'intérieur d'une transaction du
moteur et valider de façon atomique des métadonnées avec un message propriétaire, un swipe ou un instantané
spatial, sans jamais recevoir de connexion à la base de données ni d'objet de table. Le moteur garde la main sur le
rollback et sur la compatibilité du stockage historique ; les packages gardent la validation et la politique métier. La même API expose
les enregistrements normalisés de chats et de personnages, la sélection des entrées de lore éligibles,
l'analyse des réponses au format JSON ou approchant, et les appels résolus au modèle de langage.
Les identifiants de connexion, les implémentations de fournisseurs, les connexions à la base de données et les objets de stockage
restent privés au moteur.

### Espace de noms client de l'hôte

Le moteur détient l'état de son client et ses bibliothèques, et les clients des packages d'agents s'en servent au lieu d'en embarquer des copies. Une copie garde son propre état : les clients de packages qui embarquaient le store des réglages d'interface enregistraient une ancienne version de ce store par-dessus les réglages du moteur à chaque chargement (Pasta-Devs/Marinara-Agents#1478), et chaque store de chat embarqué gardait le chat ouvert au moment du chargement de la page.

Avant d'importer le premier client de package, le moteur définit une seule variable globale :

```ts
globalThis.__MARINARA_HOST__ = {
  version: 1,
  capabilityApi,
  stores,
  services,
  modules,
  queryClient,
  components,
  data,
  api,
};
```

La propriété n'est ni accessible en écriture ni configurable, et l'espace de noms ainsi que ses objets `stores`, `services`, `modules`, `components` et `data` sont figés. Le chargeur de packages (`useCapabilityClientModules`) charge `lib/marinara-host.ts` avec `import()` et attend `ensureMarinaraHost()` avant d'importer le moindre client de package : l'espace de noms est donc complet quand un module de package est évalué. Un moteur sans client de package ne le charge jamais. S'il ne peut pas se charger (un chunk périmé après une mise à jour, par exemple), chaque package affiche son erreur de chargement habituelle et le reste du moteur continue de fonctionner. Le type TypeScript est `MarinaraHostV1`, dans `packages/client/src/lib/marinara-host-contract.ts`, avec les listes de cette page. Les builds des packages déclarent des types structurels correspondants au lieu d'importer le code source du moteur.

| Membre              | Valeur                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`           | `1`. Elle ne change qu'en cas de rupture de la forme.                                                                                                                                   |
| `capabilityApi`     | Le `supportedCapabilityApi` du moteur, par exemple `{ major: 1, minor: 341 }`.                                                                                                          |
| `stores`            | Les stores zustand actifs `ui`, `chat`, `agent`, `sidecar`, `dialog`, `gallery`, `encounter`, `gameState` et `backfill`. `chat` inclut la tranche des transitions spatiales en attente. |
| `services.tts`      | Le module `lib/tts-service.ts` (`ttsService`, `playWhenAvailable`, ...).                                                                                                                |
| `services.dialogs`  | Le module `lib/app-dialogs.ts` (`showAlertDialog`, `showConfirmDialog`, `showPromptDialog`, `showChoiceDialog`).                                                                        |
| `modules`           | Les modules de bibliothèques, indexés par spécificateur nu (voir plus bas).                                                                                                             |
| `queryClient`       | L'unique `QueryClient` React Query avec lequel le moteur fait son rendu.                                                                                                                |
| `components.Modal`  | Le `Modal` du moteur, avec son ordre de superposition et sa gestion d'Échap et du bouton Retour.                                                                                        |
| `data.emojiCatalog` | Le module `lib/emoji-catalog.generated.ts`.                                                                                                                                             |
| `api`               | Le module `lib/api-client.ts` (`api`, `ApiError`, `getApiErrorMessage`, ...).                                                                                                           |

Un package ne lit un membre qu'après l'avoir vérifié, par exemple
`const host = globalThis.__MARINARA_HOST__; if (host?.version === 1 && typeof host.stores?.ui?.getState === "function")`.
L'espace de noms ne fait que s'agrandir : un nouveau membre arrive avec une version mineure de Capability API, et un package qui en a besoin exige cette version mineure. Les packages construits pour l'espace de noms exigent la version de Capability API qui l'a ajouté : un moteur plus ancien ne les installe donc jamais et garde la version qu'il a. Si un membre manque malgré tout, le package ne se rabat jamais sur une copie embarquée d'un service du moteur qui a un état : les stores `ui` et `chat` deviennent des copies en lecture seule qui n'écrivent jamais, et chaque autre membre signale que la fonctionnalité demande une version plus récente de Marinara Engine.

**Modules de l'hôte.** `modules[specifier]` est exactement ce que renvoie `import * as m from "<specifier>"` dans la build propre du moteur, y compris `default` quand la bibliothèque en a un. Les spécificateurs sont `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@tanstack/react-query`, `zustand`, `zustand/middleware`, `sonner`, `zod`, `i18next`, `react-i18next`, `framer-motion`, `tailwind-merge` et `clsx`. La build d'un package résout ces spécificateurs vers des shims qui lisent l'espace de noms : le package fait donc son rendu avec l'unique React du moteur et partage son cache React Query et ses notifications toast.

- Les packages n'affichent jamais de `<Toaster>` et ne créent jamais de `QueryClient`. Un `toast` de `sonner` s'affiche à la position des notifications toast choisie par l'utilisateur. Les valeurs par défaut des requêtes du moteur (`staleTime` de 30 secondes, une seule nouvelle tentative, pas de nouvelle récupération quand la fenêtre reprend le focus) s'appliquent sauf si une requête définit ses propres options, et une nouvelle clé de requête détenue par un package commence par l'identifiant du package.
- Un package garde sa propre instance i18next, issue de `i18next.createInstance()`, à l'intérieur de `<I18nextProvider>`. Il n'utilise jamais `initReactI18next`, `setI18n` ni `setDefaults`, qui remplaceraient l'instance du moteur.
- `lucide-react`, `chess.js`, `scheduler` et `@marinara-engine/shared` ne sont pas des modules de l'hôte ; les packages embarquent ce qu'ils en utilisent.
- Les packages sont construits pour ces versions majeures : `react` 19, `react-dom` 19, `@tanstack/react-query` 5, `zustand` 5, `sonner` 2, `zod` 3, `i18next` 26, `react-i18next` 17, `framer-motion` 13, `tailwind-merge` 3 et `clsx` 2. Le passage de l'une d'elles à une nouvelle version majeure dans le moteur (React en premier) casse tous les packages construits pour l'ancienne : il exige donc une version **majeure** de Capability API. `scripts/regressions/marinara-host-namespace.regression.ts` échoue quand une version majeure change dans `packages/client/package.json` sans que le contrat change.

**Champs de store que lisent les packages.** Les packages publiés lisent aujourd'hui ces champs. Le moteur les conserve tous, et en supprimer ou en renommer un demande une version majeure de Capability API (`MARINARA_HOST_STORE_FIELDS` les fige avec `Pick<>`) :

| Store       | Champs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui`        | `achievementsEnabled`, `debugMode`, `includeReasoningInExports`, `enableStreaming`, `userStatus`, `enterToSendConvo`, `conversationCallVoiceVolume`, `conversationCallVoiceMuted`, `setConversationCallVoiceVolume`, `setConversationCallVoiceMuted`, `conversationTimeZone`, `noodleNavigation`, `setNoodleNavigation`, `noodleSelectedPersonaId`, `setNoodleSelectedPersonaId`, `reviewImagePromptsBeforeSend`, `musicPlayerEnabled`, `musicPlayerSource`, `sidebarOpen`, `setSidebarOpen`, `chatBackground`, `setChatBackground`, `characterDetailId`, `lorebookDetailId`, `presetDetailId`, `connectionDetailId`, `agentDetailId`, `toolDetailId`, `personaDetailId`, `regexDetailId`, `characterLibraryOpen`, `botBrowserOpen`, `gameAssetsBrowserOpen`, `modal`, `rightPanelOpen`, `closeModal`, `closeRightPanel`, `closeBotBrowser`, `closeAllDetails` |
| `chat`      | `activeChatId`, `activeChat`, `isStreaming`, `streamingChatId`, `abortControllers`, `reset`, `pendingSpatialTransitions`, `setPendingSpatialTransition`, `clearPendingSpatialTransition`, `setPendingSpatialTransitionStatus`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `agent`     | `setYoutubePlay`, `reset`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `sidecar`   | `modelDownloaded`, `modelDisplayName`, `fetchStatus`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `dialog`    | `dialog`, `openDialog`, `closeDialog`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `gallery`   | `pinImage`, `pinVideo`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `encounter` | `reset`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `gameState` | `current`, `setGameState`, `reset`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `backfill`  | `resetBackfill`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Stockage du navigateur détenu par le moteur.** Les packages peuvent lire ces clés, mais ne les écrivent ni ne les suppriment jamais : `marinara-engine-ui`, `marinara-engine-ui:host`, `marinara-active-chat-id`, `marinara-input-drafts` (stockage local et stockage de session), `marinara-pending-spatial-transitions`, `marinara-pinned-gallery-images` et `marinara_sidecar_prompted`. Ils n'ouvrent jamais la base de données IndexedDB `marinara-tts-audio-cache`. Pour changer un réglage, un package appelle l'action du store, par exemple `host.stores.ui.getState().setConversationCallVoiceMuted(true)`, et le moteur l'enregistre.

**Boîtes de dialogue de l'application.** Le moteur affiche ses boîtes de dialogue d'alerte, de confirmation, de saisie et de choix sur sa couche la plus haute, celle de la barre de commandes : une boîte de dialogue qu'ouvre un package s'affiche donc au-dessus de la superposition propre au package et prend le focus.

**Builds de packages antérieures à l'espace de noms.** Elles embarquent leur propre copie du store d'interface en version 74 et écrasent `marinara-engine-ui` avec les seuls réglages que connaît cette copie. Le moteur enregistre aussi chaque écriture dans une copie `marinara-engine-ui:host` réservée à l'hôte et, au chargement, ignore un blob enregistré plus ancien que sa propre version tant que cette copie est à la version actuelle. Le moteur définit toujours `globalThis.React` et `globalThis.ReactDOM` pour les bundles installés qui utilisent le runtime JSX classique.

### Capability API 1.7 : branches de chat

Capability API 1.7 ajoute des métadonnées de branche normalisées à `CapabilityChatRecord` :

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` contient le nom de branche enregistré, sans espaces superflus. Les chats racines renvoient `null`. Les branches connues créées par le moteur exposent le chat parent direct, le message source de la bifurcation et le message enfant copié. Les branches vides utilisent des ancres de message null. Les anciennes branches, les métadonnées incorrectes et les chats frères de groupe importés sans relation connue renvoient des champs de filiation null ; le moteur ne déduit pas de relations historiques. L'exportation et l'importation génériques omettent les ID de parent et de message, car les ID changent d'une installation à l'autre. La suppression du parent ne modifie pas la filiation de l'enfant.

### Capability API 1.8 : expériences Game

Capability API 1.8 ajoute les expériences Game fournies par les packages, le contexte de prompt par tour de Game et les écritures de ressources.

Un package peut fournir un Game Mode complet plutôt qu'un ajout au mode intégré. Il déclare l'emplacement `game-surface` et se choisit lors de la création d'une partie, dans le bloc Experiences de l'assistant de configuration. Le choix est enregistré sur la partie et reste fixe pendant toute sa durée : une expérience n'est jamais activée ou désactivée en cours de partie. Sa surface dessine son propre HUD, ses menus et ses combats sur la narration commune, puis déclare les systèmes intégrés qu'elle remplace. Tout élément non déclaré reste intégré ; une expérience ne désactive donc que ce qu'elle met réellement en oeuvre. Le champ facultatif `contributions.gameSurface.surfaceClass` nomme une classe appliquée par le moteur à la zone de jeu pendant le montage de la surface, ce qui permet à la feuille de style du package de modifier l'interface commune rendue hors de son propre élément.

Les packages dotés de l'autorisation `prompt-context` ajoutent du texte au prompt système de chaque tour de Game généré. Un package propriétaire d'un état actif peut ainsi maintenir la cohérence du modèle avec ce que voit le joueur. Une contribution peut aussi déclarer les systèmes intégrés qu'elle remplace ; le moteur cesse alors de demander au modèle de les piloter. Les contributions sont recueillies à chaque tour et ne sont jamais obligatoires : une contribution vide est ignorée ; si elle lève une erreur ou ne se termine pas dans le délai prévu, elle est journalisée puis ignorée sans affecter la génération.

La façade de ressources permet les écritures en plus des lectures. Le flux de configuration d'un package peut donc rechercher ou créer la Persona du joueur et son lorebook. Le stockage, la validation et l'identité restent sous le contrôle du moteur ; le contenu métier reste sous celui des packages.

### Capability API 1.10 : ressources de package

Capability API 1.10 ajoute la distribution générale des ressources statiques détenues par un package. Un manifeste peut déclarer `contributions.assets.paths`, une liste autorisée comportant jusqu'à 256 images (`png`/`webp`/`gif`/`jpg`/`jpeg`) et fichiers JSON fournis dans le package. Le moteur les sert sous `/api/capability-packages/<id>/assets/<path>` avec la même chaîne de vérification que les icônes d'onglet : confinement du chemin, présence de l'empreinte dans `files[]`, liste autorisée de types de contenu passifs et nouvelle vérification de l'intégrité à chaque lecture. Le schéma refuse les types de documents actifs (SVG, HTML et scripts) ; chaque chemin déclaré doit être épinglé par une empreinte dans `files[]` ; et le fichier `manifest.json` interne au package ne peut jamais être servi, même s'il est déclaré. `contributions.assets` exige un manifeste `schemaVersion` 2 avec `capabilityApi` 1.10 ou plus récent ; un manifeste v1 ne peut pas le déclarer. Les ressources sont toujours revalidées : comme le bundle client, elles portent un `ETag` fort fondé sur l'empreinte du manifeste et répondent à une revalidation inchangée par `304 Not Modified`, sans corps. Un tileset n'est donc retéléchargé que lorsque ses octets changent vraiment. Les réponses ne sont volontairement jamais `immutable`, car la politique d'installation autorise la republication d'une même version avec d'autres octets et une URL portant un numéro de version n'est donc pas adressée par contenu. Une expérience `game-surface` peut ainsi fournir de véritables illustrations au lieu de les intégrer à son bundle client.

Un manifeste qui enfreint ces règles est refusé à l'installation avec l'un des messages suivants : "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", l'erreur d'extension du schéma pour un chemin qui n'est ni une image ni du JSON, ou, pour les archives dont les noms ne diffèrent que par la casse et qui seraient confondus sur un système de fichiers insensible à la casse, "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Chaque élément de capacité reçoit sa propre identité à cet effet : `capabilityProps.packageId` et `capabilityProps.packageVersion` arrivent avec `localization`. Un bundle construit donc ses URL de ressources sous la forme `/api/capability-packages/<packageId>/assets/<path>`, éventuellement avec `?v=<packageVersion>` pour qu'un changement de version invalide tout cache intermédiaire, sans récupérer à nouveau la liste des packages installés ni analyser sa propre URL d'importation.

### Capability API 1.11 : interface de combat des expériences

Capability API 1.11 ajoute une interface de combat aux propriétés de capacité `game-surface`. `combatActive` indique l'instant où l'interface de combat intégrée est réellement montée, contrairement à `chatMeta.gameActiveState`, l'état narratif de la scène du GM, qui réagit plus tard et peut indiquer "combat" sans rencontre existante. `combatStyle` contient le style effectif (`classic` ou `tactical`). `requestCombat()` demande au moteur de générer une rencontre par le même processus que le bouton manuel Start Combat, sans boîte de confirmation puisque l'interface de l'expérience a déjà exprimé l'intention. Le processus de génération du moteur décide toujours du contenu de la rencontre. Un package ne peut volontairement pas fournir directement les combattants ou l'état du combat : le combat reste géré par le moteur.

`requestCombat()` garde une identité stable, reste silencieux sur le chemin du package et renvoie un code dont l'expérience tire son propre retour : `"started"`, ou un refus, `"combat-active"`, `"pending"` (une génération est déjà en cours), `"no-turn"` (le GM n'a encore écrit aucun tour) ou `"unavailable"` (session terminée ou rediffusion). `combatPending` et `combatError` reflètent l'avancement et l'échec de la génération pour qu'un package n'attende pas indéfiniment `combatActive` après un échec. Comme les interfaces 1.7 et 1.8, mais à la différence de `contributions.assets` de 1.10, strictement contrôlé, ces propriétés sont remises à tous les packages `game-surface`, quel que soit le `capabilityApi` déclaré. L'étiquette 1.11 indique leur date d'apparition ; un package qui en dépend déclare 1.11 et les anciens moteurs le refusent proprement.

### Capability API 1.12 : événements spatiaux pour l'expérience propriétaire

Capability API 1.12 adresse aussi les événements de capacité spatiale au package de l'expérience propriétaire de la partie. `spatial_transition_committed`, `spatial_transition_rejected` et le signal non typé `spatial_context_refresh`, auparavant adressés uniquement à `hierarchical-maps` dans l'événement de fenêtre `marinara-capability-server-event`, sont désormais aussi distribués avec `packageId` défini sur le `gameExperienceId` du chat. Les charges diffèrent : un événement validé transporte `{ chatId, commandId, currentLocationId, definitionRevision, travel? }` ; un événement rejeté transporte `{ chatId, commandId, code?, message? }`, sans champ d'emplacement puisque le déplacement n'a pas eu lieu ; le signal d'actualisation transporte `data: null`. Une expérience qui a envoyé une commande de voyage avec l'argument `pendingSpatialTransition` de `sendMessage` peut donc confirmer ou effacer son trajet dès que l'hôte connaît le résultat, au lieu de le déduire de lectures ultérieures. La version 1.12 ferme aussi une lacune qui touchait World Maps : les transitions rejetées sur l'un des deux chemins HTTP silencieux, la validation avant diffusion du tour propriétaire pendant une génération ou la validation REST autonome, ne produisaient auparavant aucun événement. Les deux synthétisent désormais `spatial_transition_rejected`, uniquement sur une preuve définitive, soit un code d'erreur `spatial_*` autre que `already_applied`. Les échecs non concluants, comme une erreur réseau qui a peut-être perdu une validation réussie, émettent plutôt le signal non typé `spatial_context_refresh`, pour que les abonnés se resynchronisent avec le serveur au lieu d'accepter un verdict inventé. Un événement validé dont `travel.mode` vaut `"step_by_step"` et `complete: false` signifie que le trajet continue ; conserve l'état en attente jusqu'à l'événement final. Il s'agit d'une interface souple comme la 1.11 : les événements sont distribués quel que soit le `capabilityApi` déclaré. Ne déclare 1.12 que si le package en dépend.

### Capability API 1.13 : repli temporaire de la narration

Capability API 1.13 ajoute `requestsCollapsedNarration` à la déclaration d'interface qu'un package `game-surface` transmet à `setExperienceChrome`. Tant que le drapeau est true, le panneau de narration du Game Mode se replie sur sa poignée fine, afin qu'une expérience libère l'écran pour une cinématique ou une séquence en plein écran.

C'est une DEMANDE, pas une préférence. Le réglage de repli du joueur n'est jamais modifié et le drapeau n'est respecté que tant que l'expérience constitue la surface active. Retire le drapeau ou cesse d'être la surface active, et le panneau reprend le choix du joueur. C'est la garantie qu'il se rouvre toujours ensuite ; un package ne peut volontairement pas rendre le repli permanent.

Les règles de sécurité du moteur ont priorité. Le panneau s'ouvre de force lorsque la saisie de texte du joueur est affichée, y compris au tout début d'une scène avant tout segment, et lorsque les contrôles d'avancement du segment sont actifs. Ces contrôles sont le seul moyen de finir un tour ; un package capable de les masquer pourrait bloquer définitivement le joueur. La poignée continue aussi d'afficher son indicateur d'attention lorsqu'une nouvelle tentative d'analyse de scène, de génération ou de génération de combat est en attente. Si le joueur ouvre manuellement le panneau pendant une demande, il reste ouvert jusqu'à la fin de celle-ci. Comme les interfaces 1.11 et 1.12, il s'agit d'une interface souple : le champ est respecté quel que soit le `capabilityApi` déclaré. L'étiquette 1.13 indique son apparition ; un package qui en dépend déclare donc 1.13.

### Capability API 1.14 : surfaces de suivi et cycle de vie des agents

Capability API 1.14 ajoute deux valeurs de `contributions.slots` pour les paquets d'agents Roleplay actifs et activés disposant d'un point d'entrée client :

- `roleplay-tracker` monte la vue `toolbar` du paquet dans le HUD Roleplay. Ses propriétés comprennent `chatId`, `chatMode`, `mobileCompact`, `toolbarButtonClass` de l'hôte, `onRerunTracker`, `trackerRetryBusy`, `lockMode` et `onToggleLockMode`. Les callbacks sont facultatifs : vérifie leur présence avant de les appeler.
- `tracker-panel` monte la vue `tracker` dans le Tracker Panel existant avec `chatId`, `chatMode` et `detached`. Réutilise cette surface au lieu d'ouvrir un second panneau. Les deux emplacements reçoivent aussi les propriétés habituelles d'identité et de localisation des capacités.

Les contributions de contexte restent enregistrées par `api.registerPromptContext` et nécessitent `prompt-context`. La requête expose maintenant `targetCharacterIds`, `personaId` et `placedAgentTypes`, facultatif pour la compatibilité. `placedAgentTypes` indique au contributeur quelles sections de données d'agents le preset a déjà placées, pour qu'il évite de dupliquer son contexte. L'hôte conserve l'identité du paquet de chaque contribution dans `packageBlocks` pour placer son texte dans la section d'agent correspondante. Un texte destiné à un public particulier doit respecter les identifiants de personnages cibles reçus.

Un point d'entrée serveur peut aussi enregistrer son service de cycle de vie de post-traitement via `api.registerService("agent-runtime:<package-id>", service)`. La permission `agent-runtime` est requise ; enregistrer un autre identifiant de paquet est refusé. Les hooks facultatifs sont :

```ts
const cleanup = api.registerService(`agent-runtime:${packageId}`, {
  prepareContext({ agent, context }) {
    // Return small, JSON-serializable context for this agent, or nothing.
    return { chatId: context.chatId };
  },
  finalizeResult({ agent, context, preparedContext, result }) {
    // Validate or enrich the result before the host publishes/applies it.
    return result;
  },
});
// Return cleanup from activate(), or include it in the activation cleanup.
```

`prepareContext` s'exécute avant le post-traitement ; son résultat non nul appartient à l'agent et entre dans son prompt comme contexte d'exécution sérialisé. `finalizeResult` reçoit cette valeur et le résultat généré, puis renvoie un `AgentResult`. La génération et les relances manuelles attendent la finalisation avant de publier. Chaque hook asynchrone a deux secondes : une préparation ratée est journalisée et ignorée ; une finalisation ratée transforme le résultat en échec sans appliquer une sortie non validée. Ce sont de courts hooks de l'hôte, pas un emplacement pour un autre appel lent au modèle.

Ces ajouts n'ont pas de contrôle de version 1.14 par champ. Un paquet peut détecter les propriétés facultatives et fonctionner avec moins de possibilités sur un ancien moteur ; s'il exige ces surfaces, leur placement ou ce cycle de vie, il doit déclarer `capabilityApi: { major: 1, minor: 14 }` dans son manifeste v2 pour qu'un ancien moteur refuse proprement l'installation.

### Capability API 1.15 : configuration actuelle des embeddings

`api.runtime.resolveEmbeddings()` renvoie un nouveau `Promise<CapabilityEmbeddingHost>` utilisant la configuration actuelle de connexion de l'agent du paquet. Appelle-le au début de chaque opération d'embeddings au lieu de conserver `api.runtime.embeddings`, un instantané de l'activation qui ne suit pas les changements ultérieurs sans réactivation.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const vectors = await embeddings.embed(texts, signal);
// Store/compare embeddings.spaceId with persisted vectors; do not mix embedding spaces.
```

L'hôte renvoyé possède `spaceId`, `label` et `embed(texts, signal?, inputType?)` (voir Capability API 1.68 pour le type d'entrée). Il utilise la source configurée et se replie sur le générateur local MiniLM intégré si aucune source n'est disponible ou si la résolution de configuration échoue. `embed` peut renvoyer `null` ; les lots vides, plus de 128 textes ou plus de 200 000 caractères cumulés sont refusés. Un nouvel hôte ne recalcule pas les vecteurs existants : le paquet doit traiter un changement de `spaceId` avant de comparer les nouveaux vecteurs aux anciens.

Les moteurs actuels exposent cette méthode quelle que soit la version d'API déclarée. Déclare API 1.15 si le suivi des changements de connexion est nécessaire. Pour accepter les anciens moteurs, tu peux vérifier `typeof api.runtime.resolveEmbeddings === "function"` et utiliser sinon `api.runtime.embeddings`, avec sa limite à l'état d'activation.

### Capability API 1.16 : verbes du Game Master déclarés par un package

Capability API 1.16 permet à un package Experience de déclarer une courte liste fermée d'actions nommées du Game Master, les verbes, qu'Engine affiche dans le rappel de format du GM, retrouve dans la narration terminée et exécute pour le compte du package. Aucun code serveur du package ne s'exécute pour cela : une Experience `game-surface` qui n'a que des points d'entrée `agents` et `client` peut quand même laisser le GM changer son monde dans la prose.

L'intégration est entièrement en service : le schéma, les règles de noms réservés et de propriété des clés, le lecteur de table, le rendu dans le prompt et l'exécuteur. Un package qui fournit une table et détient `chat-write` voit ses verbes affichés dans le rappel du GM à chaque tour Game d'un chat qui lui est lié, et exécutés quand le GM en utilise un. Un chat lié à aucun package, ou à un package qui ne déclare aucune table, résout zéro verbe, et son tour est identique octet pour octet à un tour d'avant cette intégration.

Un package déclare sa table sous le nom `gm-verbs.json`, listée dans `contributions.assets.paths` et fixée par hash dans `files[]` comme toute autre ressource. La découverte passe par ce nom de fichier réservé, ce qui est une nouvelle convention et non une convention existante : tous les autres fichiers du pipeline des packages sont des chemins déclarés, lus par leur nom (`entrypoints`, chemins d'icônes, chemins de ressources), et rien d'autre n'est trouvé d'après sa forme. Deux conséquences de ce passage par les ressources méritent d'être dites clairement. Un fichier livré dans `files[]` mais absent de `contributions.assets.paths` reste muet dans les deux sens : l'installation et la construction du catalogue restent propres, et le package n'a simplement aucun verbe, sans diagnostic nulle part. Et une ressource déclarée est servie sans protection sur `/api/capability-packages/<id>/assets/gm-verbs.json`, car la route des ressources n'a aucun contrôle d'accès privilégié : une table de verbes ne doit donc jamais contenir quoi que ce soit de sensible. Comme les intégrations 1.11–1.13, c'est une intégration facultative : un Engine plus ancien voit une ressource JSON ordinaire et l'ignore, si bien qu'un package peut livrer une table sans réduire sa plage d'installation. Ne déclare `capabilityApi` 1.16 que si ton package _exige_ que les verbes s'exécutent, car cette déclaration refuse l'installation sur tous les Engines antérieurs à celui-ci.

Le document est `{ "schemaVersion": 1, "verbs": [ … ] }`, avec un à seize verbes. Chaque verbe est strict : une clé inconnue à l'intérieur d'un verbe entraîne un refus, pas un ajout ignoré en silence. Les champs inconnus à côté de `schemaVersion` et `verbs` sont traités différemment par les deux surfaces, volontairement : la lecture propre à Engine les retire, si bien qu'une table écrite pour un Engine plus récent fournit quand même les verbes que celui-ci comprend, tandis que le schéma de document partagé, celui qu'un outil de création utiliserait pour valider, est strict et les refuse. Valider ta table avec ce schéma est donc plus strict qu'Engine à l'exécution, ce qui est le bon sens pendant que tu l'écris :

```json
{
  "schemaVersion": 1,
  "verbs": [
    {
      "name": "weather",
      "description": "Set the sky when the weather visibly changes.",
      "effect": "state",
      "metadataKey": "pixelforgeWeather",
      "args": [
        { "name": "word", "type": "string", "enum": ["fair", "overcast", "rain", "storm", "snow"] },
        { "name": "intensity", "type": "string", "enum": ["light", "heavy"], "optional": true }
      ]
    }
  ]
}
```

Un nom de verbe suit `[a-z][a-z0-9_]*`, compte au plus 32 caractères et ne peut pas être l'une des balises entre crochets du GM propres à Engine. Cette vérification ignore la casse, car le rappel écrit `[Note:` et `[Book:` avec une majuscule alors que l'expression régulière d'analyse livrée est insensible à la casse : un verbe `note` en minuscules masquerait la balise du journal. L'ensemble réservé est dérivé de toutes les balises que les rappels du GM et de l'équipe peuvent produire dans toutes leurs branches, et de toutes les balises que les cinq analyseurs de narration d'Engine retrouvent dans un tour terminé : l'analyseur de balises et le formateur de narration du client, l'éditeur de segments du serveur, l'analyseur de scènes du sidecar et la réécriture des dialogues de la route de génération. Leur vocabulaire est plus large que ce que produit un rappel : il comprend les balises de dialogue `main`, `side`, `extra`, `action`, `thought` et `whisper`, ainsi que le couple QTE `qte_bonus` / `qte_result`, que seul le formateur de narration reconnaît. Ce dernier groupe explique pourquoi ce verrou vaut la peine : un verbe nommé `whisper` ferait retirer `[whisper:Tam]` d'une ligne de dialogue avant l'enregistrement du tour, et la ligne cesserait pour de bon d'être une ligne de dialogue. Ce verrou est fixé par des régressions, extracteurs compris : chaque analyseur qui fournit un nom qu'aucun autre ne fournit (les `party-chat` / `party-turn` de l'analyseur de balises, le couple QTE du formateur) doit continuer à le fournir, si bien qu'une source qui sort discrètement du balayage fait échouer la compilation au lieu de réduire l'ensemble verrouillé ; les trois analyseurs qui n'apportent rien d'unique sont balayés quand même, pour qu'une balise qui apparaîtrait d'abord dans l'un d'eux soit tout de même détectée. Ce que le verrou ne promet pas, c'est l'exhaustivité : une balise intégrée ajoutée dans un fichier hors de l'ensemble balayé, ou écrite sous une forme que l'extracteur ne sait pas lire, passerait encore inaperçue ; l'ensemble est donc élargi quand un nouvel analyseur apparaît, au lieu d'être considéré comme définitivement fermé. Des mots d'apparence ordinaire sont réservés pour la même raison (`action`, `state`, `status` et `note` sont tous des balises intégrées) : un refus sur un nom de verbe banal vient donc généralement de cette règle plutôt que d'une faute de frappe. La `description` tient sur une ligne de 1 à 200 caractères, sans crochets ni sauts de ligne, car elle est reproduite telle quelle dans la ligne du verbe, dans le bloc `COMMANDS:` du rappel. "Saut de ligne" a ici un sens plus large que CR et LF : il inclut `U+0085`, `U+2028` et `U+2029`, qui terminent une ligne pour tout ce qui relit le bloc, et la description est aussi refusée si elle contient des caractères de contrôle C0 ou DEL (une tabulation étant le cas le plus probable), car ils déforment le bloc sans même terminer une ligne. Reproduite telle quelle dans le bloc, mais pas au-delà du passage des macros du rappel : tout le rappel est développé par les macros avant l'envoi, si bien que `{{…}}` dans une description est développé au lieu d'être affiché, y compris les macros qui _écrivent_ des variables de chat, comme `{{setvar::…}}`. Cela ne donne pas plus de portée que la permission `chat-write` n'en accorde déjà à un package, mais il est facile d'y tomber par accident : garde les accolades de macro hors d'une description, sauf si tu les veux vraiment. Un verbe prend jusqu'à six arguments, chacun de la forme `{ name, type, enum?, maxLength?, optional? }`, nommés selon `[a-z][a-zA-Z0-9_]*` sur 32 caractères au plus, une règle volontairement plus large que celle des noms de verbe, qui n'admet aucune majuscule, car un nom d'argument est une clé JSON et non une balise entre crochets. Seul un argument de type chaîne peut porter un `enum` (de 1 à 16 valeurs, qui doivent être distinctes : une valeur répétée n'ajoute rien à un ensemble et elle est refusée comme tout autre doublon dans une table de verbes) ; un argument de type chaîne _sans_ enum doit déclarer `maxLength` (de 1 à 500), car l'analyse ciblée de l'exécuteur n'hérite d'aucun plafond propre et un argument de texte libre sans limite inviterait tout un fragment de narration dans le package ; enfin, un argument qui porte à la fois un `enum` et un `maxLength` est refusé, car l'enum borne déjà la valeur. Les charges utiles sont du JSON plat sur une seule ligne (un `}` imbriqué termine trop tôt la correspondance de la balise), et une seule occurrence par nom de verbe et par message est analysée : un verbe répété dans une même narration n'est appliqué qu'une fois.

Tu n'as rien de tout cela à préciser dans la description. La ligne du rappel est construite à partir de la table analysée : chaque verbe s'affiche sous forme de charge utile schématique, puis la description, puis un exemple à copier :

```
- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — Set the sky when the weather visibly changes. Example: [weather:{"word":"fair"}]
```

C'est le schéma qui enseigne le vocabulaire : chaque argument dans l'ordre de déclaration, les arguments facultatifs marqués `"name"?:` hors de la chaîne JSON, un enum sous forme d'alternative complète, une chaîne sans enum sous forme de son plafond, et un nombre ou un booléen sans guillemets, puisque le validateur refuse `"3"` pour un nombre au lieu de le convertir. L'exemple n'est qu'une instance concrète et ne peut jamais montrer qu'une seule valeur d'enum, et c'est pourquoi il n'est pas le canal d'apprentissage : un GM qui n'a reçu que `{"word":"fair"}` écrit "sunny", le validateur refuse un mot qu'on ne lui a jamais montré, et ce refus est invisible, car la balise est retirée dès que le nom correspond et non quand la validation réussit : la narration paraît propre et le monde n'a simplement jamais changé. Tirer le schéma et l'exemple de la même table analysée est aussi ce qui les empêche de diverger : une description ne peut pas promettre une valeur que le validateur refuse, parce que les valeurs ne vivent plus dans la description. Consacre les 200 caractères à _quand_ utiliser le verbe, pas à répéter ses arguments.

La dégradation se fait verbe par verbe. Un verbe que cet Engine ne peut pas utiliser (un `effect` plus récent, une forme qu'il ne sait pas représenter, ou une déclaration qu'il refuse d'emblée, comme un nom réservé ou une clé qui n'appartient pas au package) est écarté seul, avec une ligne de log, tandis que chaque verbe qu'il comprend continue de fonctionner : c'est la règle que `parseCapabilityCatalogWithCompat` applique déjà aux entrées du catalogue. Un verbe refusé échoue donc discrètement plutôt que bruyamment : lis la ligne de log si un verbe que tu as déclaré n'apparaît jamais. Un document inutilisable dans son ensemble (un `schemaVersion` que cet Engine ne connaît pas, un tableau `verbs` vide, autre chose qu'un objet) produit une table vide et une seule ligne de log. La table est aussi refusée d'après son `files[].bytes` _déclaré_, au-delà de 64 KB, avant même d'être lue, puisque `files[]` admet jusqu'à 100 MB et que rien d'autre ne plafonne une ressource avant sa lecture. Dans tous les cas d'échec, le tour survit intact.

Un verbe qui déclare `metadataKey` est un **verbe d'état** : ses arguments sont écrits en bloc sous cette clé dans la ligne de métadonnées du chat, et le package voit le changement à travers les propriétés qu'il reçoit déjà. Un verbe sans `metadataKey` est un **verbe d'événement** : il est livré au package en direct sous forme d'événement client de capacité, sans écriture durable, sans file d'attente, sans rejeu et sans accusé de réception. `metadataKey` est refusé sur un verbe d'événement, pour qu'un tel verbe ne puisse pas accaparer une clé qu'il n'écrit jamais, et obligatoire sur un verbe d'état.

Les deux moitiés diffèrent sur des points à connaître avant d'en choisir une. Une écriture d'état est durable et ne revient jamais en arrière : passer à un autre swipe du tour, modifier le tour ou le supprimer laisse la valeur en place, et le symptôme visible est que c'est le dernier swipe _généré_ qui l'emporte, et non le dernier swipe _affiché_ : la prose et le monde peuvent donc se contredire pendant une session sans que rien ne les réconcilie. Un événement n'a aucune mémoire (une image, un envoi synchrone) et il est perdu, sans bruit, si le tour est interrompu, si l'onglet est fermé ou rechargé pendant le streaming, si l'envoi arrive avant le premier montage du package, si le joueur a quitté ce chat, et tant que l'écran de chargement propre au package est actif. Rien ne le renvoie. En échange, l'effet d'un événement revient en arrière avec l'histoire quand le package le conserve dans un endroit qu'un retour en arrière reconstruit, ce que la moitié état ne peut pas faire : une ligne de métadonnées de chat ne revient pas en arrière. La seule perte qui ne laisse de trace dans aucun cas est celle d'un événement appliqué à l'état vivant puis perdu lors d'un rechargement forcé avant la prochaine sauvegarde du package.

La sémantique relative est donc refusée par conception des deux côtés. Un verbe d'état ne peut pas exprimer "ajouter cinq pièces d'or", par construction, puisque l'écriture remplace la valeur par une valeur absolue. Un verbe d'_événement_ relatif est refusé par principe, car régénérer un tour crée un nouvel indice de swipe et ne reporte pas les marques du swipe précédent : un verbe relatif s'accumulerait donc une fois par swipe généré. Dédupliquer sur `chatId:messageId:swipeIndex` protège contre un renvoi, que ce canal ne fait de toute façon pas, et ne protège pas contre la régénération, qui, elle, aura lieu. C'est le caractère absolu, et non un registre, qui permet d'appliquer un verbe deux fois sans risque. Les vocabulaires relatifs n'ont leur place ici que reformulés en valeurs absolues par message.

Sur un tour qui porte les deux types, l'envoi synchrone de l'événement atteint le package _avant_ que le rechargement asynchrone du verbe d'état n'aboutisse. Un gestionnaire d'événement ne doit pas lire l'effet d'un verbe d'état du même tour en s'attendant à voir la nouvelle valeur.

Les refus sont asymétriques, et cette asymétrie est voulue. Engine ne valide que la forme (noms et types des arguments, appartenance aux enums, plafonds des chaînes), car la sémantique appartient au package : un nom de PNJ ne peut pas être énuméré au moment de la déclaration quand le monde est compilé pour chaque chat. Pour un verbe d'état, le refus propre au package n'est donc qu'_indicatif_, puisque la ligne de métadonnées est déjà enregistrée au moment où le package la voit. Pour un verbe d'événement, le même refus est _contraignant_ : rien n'a été enregistré côté Engine, si bien qu'un package qui rejette un nom inconnu l'a réellement rejeté.

Le `metadataKey` d'un verbe d'état doit être une clé que le package déclarant a le droit d'écrire, selon trois règles. La clé commence par l'identifiant du package normalisé en camel case (`hierarchical-maps` → `hierarchicalMaps`) ; elle continue par un suffixe non vide qui commence à une frontière de majuscule, ce qui empêche un package de préfixer l'espace de noms d'un autre ; et l'identifiant normalisé ne doit pas être un espace de noms de métadonnées appartenant à Engine, ni en prolonger un à une frontière de majuscule. Cette liste d'espaces de noms est dérivée de toutes les clés de premier niveau de `ChatMetadata`, des constantes de clés de métadonnées propres à Engine, et des clés qui vivent dans la signature d'index de l'interface plutôt que dans sa déclaration : `encounterActive`, `internalAssistant`, `imageGenConnectionId` et le reste des métadonnées de chat non déclarées d'Engine, que les deux premières sources ne voient pas du tout. Lire ce troisième groupe demande sept sources, car Engine écrit et lit les métadonnées de chat sous plusieurs formes : l'objet que passe un appel `patchMetadata`/`updateMetadata`, l'objet qu'un callback de mise à jour _renvoie_ (une forme presque aussi fréquente que la première), la mutation `useUpdateChatMetadata()` propre au client et sa propriété `onMetadataChange` (qui ne touchent jamais `patchMetadata`), les appels directs `PATCH /chats/:id/metadata` du client (qui contournent aussi ce hook : la surface Game écrit ainsi ses clés de combat, de scène et de narration), les lectures de propriétés `chatMetadata.key` et `chat.metadata.key`, les lectures sur un résultat de `parseChatMetadata(…)` (l'idiome qu'Engine utilise le plus, et le seul qui voit des clés comme `scenario`) et, enfin, la liste des clés de métadonnées par chat qu'Engine tient déjà à la main pour les profils de réglages de chat, où apparaissent les clés écrites et lues entièrement à travers des frontières de fonctions.

Tout cela est fixé par des régressions, extracteurs compris. Deux choses restent délibérément hors des balayages. Une écriture qui reçoit une variable ou la valeur de retour d'un auxiliaire (`patchMetadata(id, hydratedMeta)`, ou la même forme sur la route des métadonnées) enregistre des clés qu'aucun balayage statique ne peut lire ; il existe aujourd'hui vingt appels de ce type et la régression fixe ce nombre : un vingt-et-unième fait échouer la compilation jusqu'à ce que quelqu'un le lise à la main. Et une lecture qui a lieu _à l'intérieur_ d'un auxiliaire, à partir d'un paramètre, est interprocédurale et hors de portée de tout balayage des lectures : c'est la forme que prend `spatialContext`, écrit dans les métadonnées du chat par le client propre au package `hierarchical-maps`, qui est livré depuis le dépôt Agents et non depuis celui-ci, puis relu ici à travers un auxiliaire et une analyse locale au fichier. C'est ce second angle mort que comble la liste tenue à la main, et c'est pourquoi l'une des sept sources est une liste choisie plutôt qu'une dérivation. La dérivation nomme ses angles morts au lieu de prétendre ne pas en avoir. Une entrée de la liste, `persona`, est un minimum ajouté à la main qu'aucune source ne produit aujourd'hui. La troisième règle refuse délibérément des packages entiers : `conversation-calls` se normalise en `conversationCalls`, et `conversationCalls` + `Enabled` est une clé existante d'Engine, si bien que ce package ne peut pas posséder de clés de métadonnées de chat sous son propre identifiant ; `noodle` et `background` sont dans la même situation, le second parce que `background` est à lui seul une clé de métadonnées de chat d'Engine. Un tel package peut toujours déclarer des verbes d'événement, qui ne possèdent aucune clé. Les clés sont plates et de premier niveau parce que c'est la forme que le réconciliateur d'un package lit déjà.

Les verbes ne s'exécutent que pour un package qui déclare `chat-write`, est installé et prêt. Cette permission contrôle aussi les écritures via l'API de persistance du package : messages, métadonnées du chat, événements de roleplay et instantanés spatiaux. `chat-read` contrôle la lecture des chats, messages, états du jeu et instantanés spatiaux. Les mêmes contrôles s'appliquent dans les transactions de persistance et les verrous de chat ; le droit d'écriture ne donne pas implicitement le droit de lecture. Les appels de persistance propres à Engine restent de confiance.

Après installation, la vue détaillée de **Download Agents** (télécharger des agents) affiche les permissions déclarées par la version installée. Si la version du catalogue demande d'autres permissions, elle les affiche séparément. Installer ou mettre à jour du code exige toujours l'approbation existante liée à cette version et à cette somme de contrôle exactes ; les commandes du modèle ne demandent pas une approbation séparée à chaque tour.

Ce sont des contrôles d'API, pas un environnement JavaScript isolé. Les permissions de réseau, de stockage et d'interface sont des déclarations d'accès. Le code du package côté navigateur et serveur reste du code de confiance et peut accéder à son environnement hôte ; installe uniquement des packages auxquels tu fais confiance. Le contrôle porte sur l'état prêt plutôt que sur la possibilité de servir les fichiers : une mise à jour laissant le package en `restart-required` suspend la résolution de ses verbes jusqu'au redémarrage d'Engine.

### Capability API 1.17 : préparer une Experience avant son premier tour

Un package `game-surface` peut déclarer `contributions.gameSurface.prepareBeforeStart: true` avec la version 2 du schéma et Capability API 1.17. Engine monte cette surface lorsque la partie est prête, avant d'activer **Start Game** (démarrer la partie). Les parties classiques et les packages sans cet indicateur conservent leur déroulement de démarrage habituel.

La surface principale qui active cette option reçoit deux propriétés supplémentaires :

- `startup: boolean` reste à true jusqu'à ce que le joueur termine l'introduction d'Engine avec **Continue** (continuer). Suspends la simulation du monde et les actions du joueur pendant ce temps.
- `setStartupReady(context: string | null): void` signale l'état de préparation. Envoie `null` pendant le chargement, l'enregistrement ou la récupération après un échec. N'envoie une chaîne qu'une fois le monde réel enregistré durablement et utilisable ; une chaîne vide autorise le démarrage sans contexte supplémentaire.

L'hôte bloque **Start Game**, sa confirmation de préparation des widgets et les nouvelles tentatives du premier tour jusqu'à réception d'une chaîne signalant que tout est prêt. Pendant le blocage, l'interface de chargement et d'échec avec nouvelle tentative du package reste visible. Une fois prêt, le package est masqué derrière l'introduction habituelle d'Engine. **Continue** ouvre la surface ordinaire, qui peut être remontée : rends la préparation du monde idempotente et restaure l'état enregistré au lieu de le générer à nouveau. Revenir dans une partie dont l'introduction est déjà terminée ne répète pas la préparation initiale.

Le contexte d'ouverture est limité à **8 000 caractères**. Un contexte invalide ou trop long maintient le démarrage bloqué et affiche une erreur ; l'hôte ne tronque pas les faits du monde. Fournis une description compacte du lieu de départ préparé et des personnages qui s'y trouvent réellement. Engine ajoute ce texte à son `generationGuide` existant du premier tour avec la source `game_start`, afin que l'ouverture utilise le monde qui existe. Cela n'enregistre pas de contexte pour les tours suivants ; continue d'utiliser la contribution habituelle du package au prompt ou son contexte de génération de tour.

Les fonctions de rappel de disponibilité appartiennent au chat, à la partie et au package montés. Les rappels tardifs d'un autre périmètre sont ignorés. Un échec du module ou de l'environnement d'exécution bloque le démarrage au lieu de considérer l'absence de contexte du monde comme une réussite. Après un rechargement, le package doit signaler sa disponibilité à partir de son monde enregistré. Le fournisseur de contexte du prompt côté serveur reste en lecture seule et soumis à son délai court ; ne l'utilise ni pour générer le monde ni comme barrière de démarrage prolongée.

### Capability API 1.19 : outils fournis par les packages

Capability API 1.16 permettait à un package de faire _dire_ au modèle quelque chose sur lequel il pouvait agir. Cette version lui permet de faire _appeler_ quelque chose. Un package doté de la nouvelle permission `tools` enregistre un outil nommé depuis son point d'entrée serveur. Engine le propose avec les outils intégrés à chaque tour de chaque chat, valide l'appel avec le JSON Schema du package et transmet les arguments à son gestionnaire.

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

Ce sont des appels d'outils plutôt qu'un format de réponse, et c'est voulu. Un format de réponse s'empare de toute la réponse : la narration devrait alors être un champ dans un objet JSON et ne pourrait pas arriver en streaming. Un appel d'outil arrive à côté de la prose et ne lui coûte rien : le modèle écrit son tour normalement et appelle l'outil au passage. Cela signifie aussi que le package reçoit des arguments que le fournisseur lui-même a contraints, au lieu de les extraire de la narration terminée : c'est toute la différence entre un schéma et une convention que l'on demande au modèle de respecter.

C'est surtout pour les enums que cela compte. Un package qui connaît les douze lieux de son monde peut inscrire ces douze chaînes dans le schéma, et un appel qui en nomme un treizième est refusé avant que le gestionnaire ne le voie. Les refus réutilisent le validateur d'arguments d'outils propre à Engine, qui nomme les valeurs qui auraient fonctionné : le modèle reçoit ainsi une indication exploitable plutôt que "must be equal to one of the allowed values". Ce que renvoie le gestionnaire est montré au modèle comme résultat de l'outil.

Avant d'écrire un outil, retiens ces règles :

- Les noms reçoivent l'espace de noms `<packageId>_<name>`, avec `-` aplati en `_` : le `set_time` de `world-clock` parvient donc au modèle sous le nom `world_clock_set_time`. Un nom qualifié déjà pris par un autre package est refusé. Les outils intégrés et les outils personnalisés activés restent propriétaires des noms en conflit ; la définition du package est omise et c'est le gestionnaire intégré ou personnalisé qui s'exécute. Les noms qualifiés doivent respecter la limite des fournisseurs de **64 caractères**. La résolution passe d'abord par les outils intégrés, puis personnalisés, puis ceux des packages, aussi bien dans les définitions montrées au modèle que dans l'exécuteur : le propriétaire d'un nom est donc toujours celui qui exécute l'appel.
- Les outils sont joints tant que le package est actif. Il n'existe pas de second interrupteur par chat comme pour les outils intégrés : déclarer la permission et enregistrer l'outil constitue la décision. Le fournisseur choisi doit prendre en charge les appels d'outils natifs.
- Le schéma des paramètres est copié et compilé lors de l'enregistrement. Si Engine ne peut pas le compiler, l'activation échoue, ce qui rend le problème visible pendant le développement plutôt qu'au milieu d'un tour.
- Un gestionnaire qui lève une exception est signalé au modèle comme un appel d'outil en échec et journalisé ; son message n'est pas transmis. Un gestionnaire qui n'a pas abouti en **10 secondes** est abandonné de la même façon : il continue de tourner, mais le tour cesse de l'attendre.
- Les résultats doivent être sérialisables sur au plus **64 KiB**. Un résultat plus gros ou non sérialisable fait échouer l'appel au lieu de prendre la place de la conversation. Les descriptions et résultats sont du contenu de package considéré comme fiable. Vérifie `chatId` avant de lire ou modifier les données d'un chat.
- Chaque définition est sérialisée dans la requête au fournisseur à chaque tour et comptée dans l'ajustement du contexte. Les limites sont **16 outils par package**, **64 pour tous les packages**, **512 caractères** par description et **8 KiB** par schéma. Les dépasser lève une erreur qui fait échouer l'activation. Réenregistrer un nom appartenant au package remplace l'outil sans prendre de place supplémentaire.
- Le contexte d'activation cesse de fonctionner après son démontage. Un package qui conserve `api` et appelle `registerTool` depuis un callback ultérieur est refusé : une ancienne exécution ne peut ni enregistrer des outils ni remplacer ceux d'une nouvelle activation.
- Désactiver, mettre à jour ou supprimer un package libère ses outils : un outil n'est donc jamais proposé à un modèle alors que son package n'est plus là pour y répondre. Les outils sont retirés avant d'attendre le nettoyage du package, dont chaque callback dispose d'un délai de 8 secondes.

Ces délais limitent uniquement l'attente asynchrone. Les packages s'exécutent comme du code de confiance dans le processus serveur ; un minuteur ne peut pas interrompre un traitement synchrone qui bloque la boucle d'événements. Une annulation forcée nécessiterait un worker ou un processus séparé, ce que cette API ne fournit pas.

Ce n'est pas une intégration facultative. `api.registerTool` n'existe qu'à partir de cette version d'Engine. Un package qui en dépend doit déclarer `capabilityApi` 1.19 et refuse de s'installer sur une version antérieure.

## Énoncés de décision et modèle de décision

Le **Decision model** (Modèle de décision) de l'utilisateur répond aux énoncés oui/non et à choix sur le chat récent. Consulte [Modèles de décision](../connections/decision-models.md) pour son rôle et sa configuration.

Un modèle de prompt d'agent livré par un package peut utiliser des énoncés de décision exactement comme le fait l'agent personnalisé d'un utilisateur : `{{#if decision:"..."}}` et `{{#if decision_choice:"..." == "..."}}`. Engine les trouve dans le modèle, les pose avant l'exécution de l'agent (après la réponse, pour un agent de post-traitement) et résout le modèle avec les réponses. Aucune version de capability API n'entre en jeu. Consulte [Prompts conditionnels](../prompts/conditional-prompts.md#asking-the-decision-model) pour la syntaxe et les conseils de formulation, et [Créer des agents personnalisés](../agents/custom-agents.md#decision-statements-in-the-agents-prompt) pour la façon dont les phases d'agent les lisent.

Le code serveur d'un package peut aussi poser au modèle de décision configuré par l'utilisateur des questions oui/non et à choix, en nombre limité, sur un contexte fourni par le package, via `api.runtime.decisions.evaluate(...)`. Il utilise le même modèle de décision que les questions d'activation des agents et les conditions de prompt (un modèle local géré ou une connexion de décision) et n'expose jamais de clés ni d'éléments internes d'Engine. `decisions` est facultatif et ne demande ni API de capacités plus récente ni permission : vérifie `typeof api.runtime.decisions?.evaluate === "function"` et prévois un repli sur les anciens moteurs.

```ts
const result = await api.runtime.decisions?.evaluate({
  messages: [{ role: "user", content: "The tavern falls silent as the stranger draws a blade." }],
  questions: [
    { id: "danger", question: "Someone is about to be attacked." },
    { id: "mood", question: "The mood of the scene is", options: ["calm", "tense", "festive"] },
  ],
  // Optional: pass `signal` to cancel and `debugMode: true` to log the Decision prompt.
});
// null: no Decision model is configured, or it gave no answer (unreachable, timed out or cancelled).
if (result && (result.answers.danger ?? 0) >= result.threshold) {
  // ...
}
```

- `messages` est le contexte propre au package, du plus ancien au plus récent (200 messages et 200 000 caractères au maximum ; le `name` d'un message compte 100 caractères au maximum). Les messages les plus anciens sont écartés pour tenir dans le modèle.
- Chaque `question` compte 500 caractères au maximum ; les identifiants doivent être uniques. Une question à choix a au moins deux `options`, et sa réponse est l'une d'elles ou `"none of these"`.
- Une requête peut demander au plus autant de réponses que la limite **Decision statements per turn** (énoncés de décision par tour) de l'utilisateur ; chaque option d'une question à choix compte une fois, plus un. Une requête invalide lève une `TypeError`.
- `answers` contient la probabilité de oui pour chaque question oui/non, et une question absente n'a pas reçu de réponse. Compare-la à `threshold`, le point de fonctionnement propre au modèle : les probabilités ne sont pas comparables d'un modèle de décision à l'autre.

Conçois chaque usage pour quelqu'un sans modèle de décision. Un énoncé sans réponse vaut non : la branche `{{else}}`, ou rien, doit fournir un comportement par défaut raisonnable. Écris pour un modèle de décision en général, sans exiger Jev : les modèles de chat locaux et les autres backends compatibles emploient la même syntaxe, mais peuvent répondre différemment. Consulte [Seuils](../connections/decision-models.md#thresholds) et [Limites et coût](../prompts/conditional-prompts.md#limits-and-cost) avant de dépendre d'un score, d'un nombre de requêtes ou d'une réponse en cache précis.

### Note aux développeurs d'Experiences Game Mode

Le combat du moteur décide lui-même des actions des ennemis ordinaires. Chaque ennemi non-boss du GM reçoit un rôle selon ses compétences et sa classe (bruiser, bulwark, skirmisher, marksman, spellcaster, supporter ou controller), une maîtrise selon son niveau sauf s'il la définit (novice, trained, veteran ou master), et un tempérament comme reckless, cautious, opportunistic ou protective. Les bêtes et monstruosités sont toujours mindless. Le code choisit ces valeurs depuis une graine sans appel au modèle ; la difficulté modifie la régularité avec laquelle ils suivent leur type. Seuls les boss écrits expressément sont dirigés par le GM via un appel au modèle. Consulte [IA de combat de Game Mode](game-combat-ai-design.md).

D'autres améliorations du combat sont en préparation. Avant d'impliquer un modèle de décision où que ce soit dans le pipeline de combat, vérifie que le combat standard d'Engine ne fait pas déjà ce dont tu as besoin. Si un ennemi a besoin d'une personnalité particulière, donne-lui d'abord la maîtrise et le tempérament correspondants. Une décision par tour ennemi ajouterait du travail au modèle et un délai ; un backend hébergé ajouterait aussi des requêtes réseau et des frais. Le combat dépendrait alors des réponses d'un modèle que l'utilisateur n'a peut-être pas configuré, et il lui faudrait un repli raisonnable en l'absence de réponse.

## Packages initiaux

- tous les agents actuellement intégrés ;
- les cartes spatiales hiérarchiques pour Roleplay et Game ;
- les appels audio et vidéo du mode Conversation ;
- UNO ;
- les échecs ;
- le poker ;
- le billard 8-Ball ;
- le morpion ;
- pierre-papier-ciseaux.

La base conserve le gestionnaire de packages, le client de catalogue, les contrats génériques du pipeline d'agents, les contrats génériques d'hébergement de jeu au tour par tour et des interfaces hôtes inertes. Les implémentations concrètes appartiennent aux packages.

## Confiance et installation

Le catalogue officiel est un document JSON versionné, validé par schéma et récupéré en HTTPS. Chaque entrée de version contient des URL d'artefacts immuables, des empreintes SHA-256, des tailles en octets, la compatibilité moteur, les permissions et l'indication d'un redémarrage nécessaire à son exécution.

Les mises à jour exigent le consentement de l'utilisateur : à part les migrations ponctuelles qui conservent les anciens éléments intégrés d'une installation mise à jour (voir [Migration de compatibilité](#compatibility-migration)), le démarrage ne télécharge ni n'installe jamais de package. `GET /api/capability-packages/updates/pending` liste chaque package officiel installé dont la version du catalogue est plus récente et compatible avec le moteur et l'API de capacités en cours d'exécution, en laissant de côté une version que l'utilisateur a déjà refusée. Le client les affiche dans une seule invite **Agent updates available** (mises à jour d'agents disponibles). **Update all** (tout mettre à jour) installe chacun par le pipeline d'installation habituel, épinglé à la version proposée et au SHA-256 de l'artefact. **Not now** (pas maintenant) enregistre les versions refusées dans `DATA_DIR/capability-packages/update-decisions-v1.json` (`POST /api/capability-packages/updates/decline`) : cette version n'est plus proposée, mais une version plus récente le sera. **Update** reste disponible dans **Download Agents** dans tous les cas. Les échecs sont isolés package par package. Les fichiers existants et l'état du registre restent utilisables lorsque le catalogue est hors ligne ou que la vérification échoue, et les échecs de disponibilité du runtime serveur empruntent le chemin de rollback vers la version précédente.

Les notes de version sont publiées dans un fichier `notes.json` à côté du `catalog.json` qu'elles décrivent, jamais dans une entrée de catalogue ni dans un manifeste : un moteur plus ancien écarte une entrée de catalogue qui contient une clé qu'il ne connaît pas. Chaque mise à jour en attente transporte, dans `releaseNotes`, les notes de chaque version postérieure à celle installée jusqu'à celle proposée, de la plus récente à la plus ancienne, et `releaseHighlight` vaut true quand l'une d'elles est marquée comme un changement que l'utilisateur remarquera. Les notes sont du texte brut et ne sont jamais affichées comme du Markdown ou du HTML.

L'installateur doit :

1. exiger un accès privilégié en loopback ou administrateur ;
2. imposer HTTPS, des limites de téléchargement et des délais d'expiration ;
3. vérifier la confiance du catalogue et le SHA-256 de l'artefact avant extraction ;
4. rejeter les chemins absolus, la traversée de dossiers, les liens, les fichiers de périphérique et les fichiers non déclarés ;
5. valider le manifeste et la compatibilité moteur ;
6. extraire dans un dossier temporaire voisin ;
7. n'activer de façon atomique qu'une fois la validation réussie ;
8. conserver la version précédente jusqu'au démarrage réussi du nouveau runtime ;
9. annuler l'activation en cas d'échec ;
10. n'exécuter aucun script d'installation, de mise à jour ou de désinstallation.

Seuls les packages exécutables de confiance issus du projet lui-même sont activés par le catalogue officiel. Un futur circuit pour les packages tiers demandera une conception de confiance explicite et distincte.

## Exécution et comportement au redémarrage

Le serveur détient le registre des packages installés et expose les capacités installées aux clients. Les modules déclaratifs et rechargeables s'activent immédiatement. L'interface invalide les requêtes de catalogue, d'agents, de capacités de mode et de chat actif après l'activation.

Le manifeste ne peut déclarer `restartRequired` que si l'hôte ne sait pas recharger ce point d'entrée sans risque. Une activation à chaud réussie affiche `Agent installed. It is ready to use.` Une activation qui exige un redémarrage affiche `Agent installed. Restart Marinara Engine to finish setup.`

Les packages de jeu au tour par tour se rechargent à chaud : l'installation enregistre aussitôt leur moteur serveur et leur lanceur manuel en commande slash, et la désinstallation détache le runtime sans redémarrer le moteur. Les réglages Conversation Commands propres à chaque chat déterminent seulement si les personnages peuvent émettre la commande cachée du package ; ils ne bloquent pas le lanceur slash de l'utilisateur. Les manifestes officiels actuels des jeux au tour par tour gardent leur ancien marqueur de redémarrage, par prudence, pour rester compatibles avec le moteur 2.x ; le moteur 3.x reconnaît le type `turn-game`, réalise l'activation à chaud en toute sécurité et renvoie le package comme actif et prêt.

### Espace disque : copies d'exécution et versions conservées

Le serveur d'un package ne s'exécute pas depuis `DATA_DIR/capability-packages/versions/<id>/<version>`. Chaque activation vérifie les fichiers installés, les copie dans un nouveau dossier sous `DATA_DIR/capability-runtime-snapshots` et importe la copie. La copie est supprimée quand ce runtime s'arrête.

- **Copies d'exécution.** Une copie contient chaque fichier vérifié du manifeste, sauf le point d'entrée client. Le serveur ne le charge jamais, et le navigateur le récupère dans `versions/`. Les ressources restent : un serveur peut donc lire des fichiers à côté de son `server.mjs`, comme Quartermaster le fait avec `icons/`. Les fichiers copiés sont en lecture seule.
- **Nettoyage au démarrage.** Un plantage ou un arrêt forcé saute le nettoyage d'une copie. À chaque démarrage, avant qu'aucun package ne s'active, le moteur supprime toutes les entrées de `capability-runtime-snapshots` sauf les liens `node_modules` partagés, car aucune d'elles ne peut être utilisée par le nouveau processus. Il rend d'abord les fichiers en lecture seule modifiables, ce dont Windows a besoin, et ne suit jamais les liens. Seul le processus qui détient le bail d'écriture du stockage atteint cette étape : un second moteur démarré sur le même dossier de données s'arrête donc à l'ouverture du stockage et ne supprime jamais les copies d'un moteur en cours d'exécution.
- **Versions conservées.** `versions/<id>` garde la version actuelle et `previousVersion`, que le rollback restaure quand un nouveau runtime serveur ne démarre pas. Les versions plus anciennes, ainsi que la version abandonnée lors du rollback d'une mise à jour échouée, sont supprimées après la réussite d'une activation ou d'une mise à jour, et au démarrage. Un package dont la mise à jour attend un redémarrage (`restart-required`), ou dont le runtime n'a pas encore démarré (`readiness: "pending"`), garde toutes ses versions jusqu'à ce qu'il ait démarré.
- **Jamais supprimés :** les données des packages (des dossiers comme `DATA_DIR/long-term-memory` et les tables du package dans `storage`), les chats, les réglages, `installed.json`, les décisions de mise à jour, les dossiers `.install-*` et les dossiers `versions/` des identifiants absents du registre. La désinstallation retire toujours le code du package et garde ses données.

<a id="compatibility-migration"></a>

## Migration de compatibilité

Au premier lancement après mise à jour :

- les agents personnalisés restent intacts ;
- chaque ancien agent intégré visible dans cette installation est enregistré comme installé ;
- les cartes, les appels du mode Conversation et les jeux du mode Conversation gardent leur disponibilité antérieure ;
- la configuration existante propre à chaque chat, les instantanés, l'état du jeu, l'historique des appels et la mémoire des agents restent en place ;
- la migration est idempotente et n'enregistre son achèvement qu'une fois toutes les entrées de disponibilité héritées écrites durablement.

Les artefacts des anciens packages restent disponibles dans le catalogue officiel comme sources de migration. Une installation neuve ne les expose ni ne les active tant que l'utilisateur ne les a pas installés.

## Désinstallation

La désinstallation retire le package des sélections de chat actives, supprime la configuration de ses agents et les fichiers exécutables téléchargés, et détache son runtime au redémarrage si nécessaire. Les chats, messages, instantanés de carte, résumés d'appels et parties terminées de l'historique restent lisibles : retirer un package ne peut donc pas détruire le travail de l'utilisateur. La suppression destructive des données métier historiques est une action distincte et explicite de l'utilisateur.

Chaque désinstallation demande une confirmation. Les chats concernés reviennent à leurs surfaces de base habituelles sans corrompre l'historique.

## Interface du catalogue

Le panneau **Agents** contient un contrôle `Download Agents` qui reprend le bouton `Download` des panneaux Characters et Personas, lequel ouvre le Card Browser. Il ouvre une bibliothèque plein écran et responsive, avec recherche, types de packages, informations de compatibilité, état d'installation ou de mise à jour, permissions, coût de stockage, documentation et contrôles de désinstallation.

Sur ordinateur, une liste de navigation s'accompagne d'une zone de détail voisine. Sur mobile, un seul panneau est affiché, avec un retour explicite et des actions dimensionnées pour le tactile. Les états vide, hors ligne, incompatible, téléchargement corrompu, installation interrompue, mise à jour, rollback et redémarrage requis sont traités comme des cas de premier plan.

## Critère d'extraction

Une extraction n'est complète que lorsque les bundles de production du client et du serveur de base ne contiennent plus l'implémentation du package, qu'une installation neuve ne peut pas l'activer sans télécharger le package, qu'une installation mise à jour la conserve, et que l'installation, la mise à jour et la désinstallation du package fonctionnent sur les systèmes de fichiers d'ordinateur, de mobile et compatibles Termux.

### Capability API 1.30 : blessures, dépenses sur un test et combat sur une piste

Une entrée `live.tracks` d'un ensemble de règles peut déclarer `levels` et `kinds`, ce qui la fait passer d'un entier borné à une PISTE DE BLESSURES : une colonne de cases, chacune avec son propre libellé et sa propre pénalité, sur laquelle se place une marque. `levels` compte de 1 à 16 degrés, du meilleur au pire, chacun avec un `label` et un entier `penalty`. `kinds` compte de 1 à 6 sortes de dégâts que la piste peut subir, chacune avec un `id`, un court `label` et une `severity` distincte. Les deux vont ensemble : `kinds` sans `levels` est refusé, car il n'y aurait rien à marquer. À côté, `resolution.penaltyFrom` nomme la piste dont la pénalité s'applique à chaque jet : sous `dice-pool`, elle retire autant de dés de la réserve, sans jamais descendre sous `pool.min`, et sous `dice-sum`, c'est un modificateur fixe sur le jet.

Le reste de 1.30 regroupe tout ce que cette tranche a ajouté par ailleurs, et un package qui livre UN SEUL de ces éléments déclare 1.30 :

- `combat.health` peut nommer une piste de blessures au lieu d'une réserve. `combat.damageKinds` indique ce que marque chaque type : `default`, une correspondance `byType` facultative et `marks`, avec `per-blow` pour une case par coup réussi ou `per-point` pour compter les niveaux de santé selon le jet de dégâts. `damageKinds` est obligatoire avec une piste de blessures et refusé avec une réserve.
- `resolution.spend` (ensemble de règles `dice-pool` uniquement) : la réserve qu'un joueur peut dépenser sur un test, ce que coûte un paiement, s'il achète des `successes` ou des `dice`, et `perCheck`, le plafond pour un seul jet.
- `mechanics.check` sur une entrée de catalogue définit ce qu'un élément CHOISI par le personnage fait au test : `reroll` (`upTo` et `once` ou `until`), `dice`, `successes` ou `threshold`. Réservé également aux réserves de dés.

```json
{
  "capabilityApi": { "major": 1, "minor": 30 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

La longueur d'une piste de blessures correspond à ses niveaux : son `min` vaut donc 0 et son `max` vaut `levels.length`, et un fichier qui indique autre chose est refusé au lieu d'être corrigé en silence. Une piste nommée par `resolution.penaltyFrom` doit être une piste de blessures : une piste ordinaire ne porte aucune pénalité à appliquer.

Ce n'est pas une intégration facultative, pour la même raison que 1.20 à 1.28 : un Engine qui ne sait pas lire `levels`, `kinds`, `penaltyFrom`, `damageKinds`, `resolution.spend` ou `mechanics.check` refuse tout le fichier de l'ensemble de règles ; l'installation lit donc les octets vérifiés de `ruleset.json` et refuse le package sous une déclaration plus ancienne. Rien ne change pour un ensemble de règles dont les pistes sont de simples nombres, dont la santé est une réserve et qui ne dit rien des dépenses sur un test.

### Capability API 1.29 : ce que permet un tour de combat de l'ensemble de règles

Cinq ajouts facultatifs concernent le bloc `combat` et les entrées de catalogue lues par le combat :

- Un coup peut porter jusqu'à trois quantités SUPPLÉMENTAIRES en plus de la première. `mechanics.plus` sur une entrée de catalogue et `damage.plus` sur une action de créature sont chacun de la forme `{ dice?, flat?, type?, save?: { save,
difficulty?, onSuccess: "none" | "half" } }` : chaque quantité est lancée et typée séparément, doublée séparément par un critique et fait l'objet d'une sauvegarde séparée par la cible, et le coup entier reste un seul test de concentration et un seul test pour tomber.
- `combat.attacks[].strikes` référence une valeur indiquant le nombre d'attaques achetées par une dépense du budget de cette liste. Les restantes restent disponibles jusqu'à la fin du tour ; tant qu'il en reste, toutes les lignes de cette liste sont gratuites en budget.
- `mechanics.free` ne coûte aucun budget, `mechanics.gives` rend des budgets pour ce tour seulement (plafonnés là où ils arrivent), et `mechanics.standard` permet à son détenteur d'acheter des actions standard nommées avec un autre budget. Une entrée `utility` qui déclare `gives` ou `standard` est proposée au lieu d'être écartée.
- Le nouveau type `rider`, et les `riders` d'une créature, ajoutent une clause de dégâts au premier coup admissible du tour ou du round, passivement et sans figurer au menu.
- La liste fermée d'effets d'états ajoute `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` et `cannot-approach-source`. Un état peut restreindre les sauvegardes concernées (`saves`), compter seulement si sa source est visible (`whileSourceInSight`) ou finir lorsqu'elle tombe (`endsWhenSourceDown`).

```json
{
  "capabilityApi": { "major": 1, "minor": 29 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Ce n'est pas une intégration facultative, pour la même raison que 1.20 à 1.28 : un Engine qui ne sait pas lire ces clés refuse tout le fichier de l'ensemble de règles, ou le fichier de catalogue qui les contient ; l'installation lit donc les octets vérifiés de `ruleset.json` et de chaque `catalogs/<id>.json` déclaré, et refuse l'un ou l'autre sous une déclaration plus ancienne. Aucune permission, et rien ne change pour un ensemble de règles qui n'en déclare aucune.

### Capability API 1.28 : combat de l'ensemble de règles sur un plateau

Le bloc `combat` d'un ensemble de règles peut indiquer ce que vaut une case du champ de bataille dans sa propre unité de distance (`distance: { label, perCell }`), et c'est ce qui rend un combat positionnable. À côté : `ranged` indique ce que coûte un tir au-delà de sa distance ordinaire, ou effectué avec un ennemi dans la case voisine ; `cover` indique ce que le fait de se tenir derrière quelque chose ajoute à la défense contre laquelle une attaque est lancée ; `opportunity` nomme le budget sur lequel est payé un coup porté à quelqu'un qui s'éloigne ; une liste d'attaques peut donner à ses lignes une `reach` et un `range`, chacun lu dans une colonne de cette liste ou écrit une seule fois pour toutes les lignes ; et le `range` d'une action de créature peut être `{ "normal": 30, "long": 120 }` au lieu d'un simple nombre.

```json
{
  "capabilityApi": { "major": 1, "minor": 28 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Un ensemble de règles qui déclare `ranged`, `cover`, `opportunity` ou une allonge ou une portée d'arme SANS `distance` est refusé à l'import : aucun de ces éléments n'a de sens sans case pour le mesurer. Le plateau lui-même est le générateur, le terrain et le déploiement propres au style de combat tactique : ce niveau n'ajoute donc ni second modèle de champ de bataille ni permission.

Ce n'est pas une intégration facultative, pour la même raison que 1.20 à 1.27 : un Engine qui ne sait pas lire ces clés refuse tout le fichier de l'ensemble de règles, ou le fichier de catalogue qui contient la créature dont la portée est une paire ; l'installation lit donc les octets vérifiés de `ruleset.json` et de chaque `catalogs/<id>.json` déclaré, et refuse l'un ou l'autre sous une déclaration plus ancienne. Rien ne change pour un ensemble de règles qui ne dit rien de la distance.

### Capability API 1.27 : bestiaires de l'ensemble de règles

Un catalogue d'ensemble de règles peut déclarer `"holds": "creatures"` et contenir des profils de créatures au lieu de lignes de fiche. Une créature s'écrit avec les nombres que le bloc `combat` déclare déjà : une santé qui peut être un nombre ou des dés lancés au début du combat, une défense, un modificateur d'initiative, des valeurs de caractéristiques et des modificateurs de sauvegarde sous les identifiants propres à la fiche, les types de dégâts auxquels elle résiste, qui la blessent davantage ou qu'elle ignore, les états qu'elle ne subit jamais, le palier de menace auquel elle appartient, les traits montrés au Game Master, et des actions qui peuvent toucher, imposer une sauvegarde, appliquer un état, être limitées à un nombre d'utilisations, revenir sur un jet de recharge, enchaîner plusieurs autres actions du profil pour un seul budget, ou s'acheter avec les points spéciaux propres à la créature.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Un catalogue de créatures ne déclare pas `feeds` et n'est jamais proposé par le sélecteur de l'éditeur de fiche : il est lu par un combat, pas par une fiche de personnage. Le combat qui le lit est le style `ruleset` du directeur de combat, qui n'a pas besoin de son propre niveau de Capability API : il joue le bloc `combat` et le bestiaire qu'un ensemble de règles installé contient déjà.

Ce n'est pas une intégration facultative, pour la même raison que 1.20 à 1.26 : un moteur qui ne sait pas lire `holds` ou la `creature` d'une entrée refuse le fichier entier de l'ensemble de règles, ou le fichier de catalogue qui la contient. L'installation lit donc les octets vérifiés de `ruleset.json` et de chaque `catalogs/<id>.json` déclaré, et refuse l'un ou l'autre sous une déclaration antérieure. Aucune permission, et aucun changement pour un ensemble de règles sans bestiaire.

### Capability API 1.26 : combat de l'ensemble de règles

Un ensemble de règles peut contenir un bloc `combat` facultatif, au premier niveau, qui dit comment un combat est RÉSOLU avec ses propres nombres : ce qui est lancé et contre quoi, l'économie d'actions, quelles listes de la fiche sont des attaques et lesquelles sont des capacités, ce que font ses états, la concentration, ce qui arrive à un personnage tombé à zéro, ses types de dégâts et l'échelle dans laquelle un adversaire est choisi. La même version permet au `mechanics` d'une entrée de catalogue d'indiquer combien de cibles elle prend, qu'elle touche toujours, quels états elle applique, quels points temporaires elle accorde, comment elle évolue avec la fiche et quel budget elle dépense.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Une partie sur un ensemble de règles qui déclare `combat`, avec le directeur de combat activé, mène ses combats selon ce bloc sur l'écran de combat. Un ensemble de règles sans ce bloc combat comme avant, via son bloc `battle` ou la préférence Classic ou Tactical du joueur.

Ce n'est pas une intégration facultative, pour la même raison que 1.20 à 1.25 : un moteur qui ne sait pas lire `combat` ou les nouvelles clés de `mechanics` refuse le fichier entier de l'ensemble de règles, ou le fichier de catalogue qui les contient. L'installation lit donc les octets vérifiés de `ruleset.json` et de chaque `catalogs/<id>.json` déclaré, et refuse l'un ou l'autre sous une déclaration antérieure. Aucune permission, et aucun changement pour un ensemble de règles qui n'a ni l'un ni l'autre.

### Capability API 1.25 : couches de l'ensemble de règles et consignes pour le monde

Un ensemble de règles peut déclarer un tableau `layers` facultatif, au premier niveau : des variantes nommées de lui-même (Low magic, Hard winter) qu'un joueur active à la création d'une partie, figées dans le lien de cette partie pour toute sa durée. La même version donne au bloc de base `gm` une chaîne facultative `worldGuidance`, que la génération du monde lit une fois à la configuration pour que l'univers convienne aux règles avec lesquelles l'équipe jouera.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Les effets d'une couche forment un ensemble fermé, et chacun d'eux restreint ou ajoute : des consignes ajoutées après celles de l'ensemble de règles, des valeurs retirées d'un champ d'énumération, l'échelle de difficulté remplacée par une échelle du même type de résolution, et des entrées de catalogue masquées dans le sélecteur de l'éditeur de fiche. Rien n'est ajouté à la fiche : une fiche de personnage reste donc lisible quelles que soient les couches choisies par une partie, et une couche n'apporte ni code de package ni appel supplémentaire au modèle. Les couches fournies par quelqu'un d'autre que l'auteur de l'ensemble de règles viendront plus tard.

Ce n'est pas une intégration facultative, pour la même raison que 1.20 à 1.24 : un moteur qui ne connaît pas `layers` ou `gm.worldGuidance` refuse le fichier entier de l'ensemble de règles. L'installation lit donc les octets vérifiés de `ruleset.json` et refuse l'un ou l'autre sous une déclaration antérieure. Aucune permission, et aucun changement pour un ensemble de règles qui n'a ni l'un ni l'autre.

### Capability API 1.24 : le type de résolution par réserve de dés

La `resolution` d'un ensemble de règles peut déclarer `"kind": "dice-pool"` au lieu de `"dice-sum"`. Le test lance alors le nombre de dés propre à la fiche de personnage et compte ceux qui atteignent un seuil, avec en option des faces doublées, des faces qui explosent, des faces qui annulent, des échecs critiques, des succès exceptionnels et une plage de dés de circonstance que le Game Master peut ajouter ou retirer pour un test.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

La fiche reste la même : ce que `dice-sum` ajoute au jet est ici le nombre de dés. Ce type n'apporte donc ni nouveau vocabulaire de fiche, ni emplacement d'éditeur, ni code de package.

Ce n'est pas une intégration facultative, pour la même raison que 1.20 à 1.23 : un moteur qui ne connaît que `dice-sum` refuse le fichier entier de l'ensemble de règles. L'installation lit donc les octets vérifiés de `ruleset.json` et refuse une résolution `dice-pool` sous une déclaration antérieure. Aucune permission, et aucun changement pour un ensemble de règles qui additionne ses dés.

### Capability API 1.23 : valeurs de catalogue évolutives

La ligne d'une entrée de catalogue peut contenir une table `scaled` facultative : jusqu'à quatre des colonnes numériques de cette ligne dont la valeur est tenue par l'ensemble de règles plutôt que par le joueur. Chacune est une référence de valeur ordinaire avec une table de paliers facultative : une ressource de classe peut ainsi suivre un niveau, et les utilisations d'une capacité suivre une valeur de caractéristique, sans que le format apprenne une nouvelle arithmétique.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

La valeur est calculée quand la fiche est modifiée, jamais quand elle est lue : l'état en jeu, le bloc de prompt du Game Master et le pont de combat continuent tous de lire le nombre enregistré.

Une ligne évolutive peut se trouver directement dans `ruleset.json` ou dans une ressource `catalogs/<id>.json`. Le manifeste déclare les deux fichiers comme ressources mais ne peut pas montrer les clés qu'ils contiennent : l'installation lit donc les octets vérifiés des deux et refuse une clé `scaled` sous une
déclaration antérieure à 1.23, exactement comme pour `catalogs` sous 1.21 et `battle` sous 1.22. Le schéma strict d'un moteur plus ancien refuserait de toute façon le fichier qui la contient. Aucune permission, et aucun changement pour un ensemble de règles dont les catalogues n'en contiennent pas.

La même version ajoute la commande `[sheet: op="use" name="..."]`, qui paie le `mechanics.cost` d'une entrée de catalogue plus une utilisation de chaque réserve de ligne écrite par cette entrée. Elle ne demande aucune déclaration : elle lit des catalogues que le moteur sert déjà.

### Capability API 1.22 : le bloc battle

Un ensemble de règles peut contenir un bloc `battle` facultatif, qui prête à un combat les nombres de la fiche de personnage : la réserve en jeu qui sert de points de vie, une réserve facultative qui devient les MP, les réserves qui deviennent des emplacements de sorts, et les listes de la fiche dont les lignes marquées par le catalogue deviennent les `CombatSkill` propres au moteur. À la fin du combat, les points de vie, l'énergie et les emplacements dépensés sont réécrits par les mêmes opérations de fiche que celles des boutons du joueur.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Ce n'est pas un adaptateur de combat. L'arithmétique des dégâts reste celle du moteur, et `attackRoll`, `save`,
`concentration` et `perCostStep` sur une entrée de catalogue ne sont lus par personne : la résolution fidèle aux règles relève des adaptateurs par ensemble de règles du transfert de combat. `coverage.combat` garde son propre sens et le pont ne le lit jamais.

Le bloc se trouve dans `ruleset.json`, que le manifeste ne peut pas montrer : l'installation lit donc les octets vérifiés et refuse une clé `battle` sous une déclaration antérieure à 1.22, exactement comme pour `catalogs` sous 1.21. Le schéma strict d'un moteur plus ancien refuserait de toute façon le fichier entier de l'ensemble de règles. Aucune permission, et aucun changement pour un ensemble de règles sans bloc `battle`.

### Capability API 1.21 : catalogues de l'ensemble de règles

Un ensemble de règles peut fournir des **catalogues** : des collections nommées d'entrées toutes prêtes (sorts, capacités de classe, équipement) que l'éditeur de fiche propose dans un sélecteur, pour qu'un joueur ne saisisse pas une liste ligne par ligne. L'en-tête se trouve dans `ruleset.json` sous `catalogs` ; les entrées se trouvent soit directement dans cet en-tête, soit dans une ressource réservée qui leur est propre, un fichier par catalogue :

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json` est une famille de ressources réservée : le nom du fichier est l'identifiant propre au catalogue, si bien que le moteur trouve le fichier à partir de l'ensemble de règles seul et qu'aucun catalogue ne peut nommer le fichier d'un autre. Une ressource de catalogue est épinglée par son hash dans `files[]` comme toute autre ressource déclarée, n'est jamais livrée qu'à côté du `ruleset.json` qui la déclare, et est refusée si sa taille déclarée dépasse 2 MB, avant même d'être lue (1 MB avant Capability API 1.340 ; un package dont un fichier de catalogue dépasse 1 MB déclare 1.340).
Son contenu passe par les mêmes contrôles que les entrées intégrées, face à la même fiche : un catalogue ne peut donc jamais écrire une ligne que la fiche ne pourrait pas contenir. Jusqu'à 12 catalogues par ensemble de règles et 2000 entrées par catalogue.

Le client ne récupère un catalogue qu'à l'ouverture d'un sélecteur, via
`GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. La liste des ensembles de règles installés ne contient jamais les entrées intégrées, seulement leur nombre, car elle est lue à chaque ouverture d'un éditeur de fiche. Le texte des catalogues n'atteint jamais un prompt : le Game Master ne voit toujours que ce que nomme `gm.sheetSummary`, et les catalogues ne coûtent donc aucun token.

Comme 1.20, ce n'est pas une intégration facultative, et le contrôle a deux volets, car les catalogues vivent dans le fichier de l'ensemble de règles plutôt que dans le manifeste. Déclarer une ressource `catalogs/<id>.json` exige 1.21, et un `ruleset.json` qui contient une clé `catalogs` est refusé à l'installation si le manifeste déclare moins, car le schéma strict d'un moteur plus ancien refuserait de toute façon le fichier entier de l'ensemble de règles. Aucune permission, comme avant.

### Capability API 1.20 : ensembles de règles de Game Mode

Un ensemble de règles, ce sont les règles d'une partie sous forme de données validées : un type de résolution que le moteur met déjà en œuvre, une fiche de personnage déclarée à partir d'un ensemble fermé d'éléments de base, des repos, et des consignes pour le prompt du Game Master. Un package le fournit sous la forme de la ressource au nom réservé `ruleset.json`, découverte par convention exactement comme `gm-verbs.json` : listée dans `contributions.assets.paths` et épinglée par son hash dans `files[]`.

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

L'extrait ne montre que les clés qui comptent pour un ensemble de règles ; les champs habituels du manifeste (`name`,
`version`, `description`, `engine`, `builtAgainst`) restent obligatoires.

Un package d'ensemble de règles n'a besoin d'aucune permission, d'aucun point d'entrée serveur ou client ni d'aucun agent. Le type et la ressource vont ensemble : un package de type `ruleset` doit lister `ruleset.json`, et un package qui liste `ruleset.json` doit déclarer ce type, si bien qu'un ensemble de règles ne peut pas se glisser sous un autre type. Rien dans le fichier n'est exécuté : il n'y a pas de chaînes d'expression, et une mécanique qu'aucun type de résolution n'exprime demande une modification du moteur qui ajoute un type, pas quelque chose qu'un ensemble de règles peut faire. Le format, le fichier 5e officiel et les raisons de sa forme se trouvent dans
[`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

Ce n'est pas une intégration facultative. Un package d'ensemble de règles ne fait rien sur un moteur qui ne sait pas le lire : un manifeste qui liste `ruleset.json` doit donc déclarer Capability API 1.20, et un moteur plus ancien refuse proprement l'installation.

Le moteur refuse la ressource si sa taille déclarée dépasse 512 KB, avant même de la lire (256 KB avant Capability API 1.340 ; un package dont l'ensemble de règles dépasse 256 KB déclare 1.340), la revérifie face au hash de l'installation, et la valide avec le schéma partagé strict
(`packages/shared/src/schemas/ruleset.schema.ts`). Un fichier inutilisable est écarté avec une seule ligne de log qui nomme le package et les premiers problèmes `path: message`. Quand deux packages déclarent le même identifiant d'ensemble de règles, le premier dans l'ordre des identifiants de package l'emporte, et l'autre est écarté avec une ligne de log.
`engine-legacy` et `traditional` sont des identifiants propres au moteur qu'un fichier ne peut pas revendiquer.

Une partie fixe son ensemble de règles une seule fois, à sa création, dans `chat.metadata.gameRuleset`. Sans ce lien, ce sont les règles propres au moteur qui s'appliquent, exactement comme avant. Un lien que l'installation ne peut pas honorer (le package a disparu, ou la définition installée est plus ancienne que la version liée) est signalé comme indisponible et n'est jamais réinterprété comme un autre ensemble de règles. Le lien est vérifié sur l'identifiant de l'ensemble de règles et sur le package qui l'a fourni : un autre package qui revendique le même identifiant ne prend donc pas le contrôle d'une partie existante.

### Capability API 1.73 : les agents d'avatar

Engine héberge les deux agents d'avatar, `2d-avatars` (sprites PNGTuber et avatars mesh) et `3d-avatars` (modèles VRM). Leurs packages restent légers : une définition d'agent chacun, des prompts par défaut, des locales et l'entrée du catalogue. Engine possède tout le reste : le stockage par propriétaire sous `DATA_DIR/avatar-models/`, l'import, les moteurs de rendu chargés à la demande, la configuration sur la page de chaque agent dans l'éditeur d'agent, le directeur de streaming, le classifieur d'expressions et les routes de génération. Le contrat partagé est `packages/shared/src/types/avatars.ts` (ses schémas se trouvent dans `schemas/avatars.schema.ts`), et la moitié client est `packages/client/src/features/avatars/contract.ts`. Le guide utilisateur est [`docs/agents/avatars.md`](../agents/avatars.md).

Il n'y a aucun nouveau champ de manifeste. Un package d'avatar déclare la version 2 du schéma et Capability API 1.73 : un moteur qui n'a pas ces surfaces refuse donc l'installation au lieu de lister un agent qui n'affiche rien. Le changement qui a introduit 1.73 a livré ces surfaces sous forme de coquilles vides inertes ; la configuration, la scène et les moteurs de rendu d'Engine sont maintenant sur `staging`, et les deux packages figurent dans le catalogue de préversion. Les URL d'artefacts qu'ils référencent doivent être publiées pour que l'installation fonctionne ; une entrée de catalogue ne prouve pas à elle seule que son artefact téléchargeable est disponible. Les prompts de génération de l'agent 2D sont livrés sous forme de collection de modèles de prompt `avatarGenerationTemplates` dans ses `defaultSettings`, avec les identifiants dans `AVATAR_PROMPT_TEMPLATE_IDS` ; l'éditeur d'agent les fusionne et les réinitialise comme n'importe quelle autre collection de modèles intégrée.

### Capability API 1.72 : le pack de carte d'une Experience

Un package `game-surface` qui se configure dans l'assistant Game (`gameSurface.setup`, 1.18) peut livrer un pack de carte avec la version 2 du schéma et Capability API 1.72 : son propre kit d'univers, des mondes prêts à l'emploi construits avec ce kit, et son propre pack de tuiles. Chacun est le fichier de partage que Game Mode et Pixelforge lisent et écrivent déjà (un `.worldkit.json`, des fichiers `.world.json` et un `.tilepack.json`), et chacun est aussi une ressource déclarée, épinglée par son empreinte.

```json
{
  "gameSurface": {
    "setup": {},
    "mapPack": {
      "kit": "map/riverlands.worldkit.json",
      "worlds": ["map/upriver.world.json", "map/downriver.world.json"],
      "tiles": "map/riverlands.tilepack.json"
    }
  },
  "assets": {
    "paths": [
      "map/riverlands.worldkit.json",
      "map/upriver.world.json",
      "map/downriver.world.json",
      "map/riverlands.tilepack.json"
    ]
  }
}
```

`worlds` (32 au maximum) et `tiles` sont facultatifs. Un fichier de monde peut contenir le script d'histoire de son monde (worldgen W10), qui est livré avec la carte et en fait partie. Un fichier de monde en version 2 contient aussi le `snapshot` du monde, c'est-à-dire le monde tel qu'il a été créé (W11) : un moteur dont le générateur de monde a changé depuis lit le monde à partir de lui, exactement tel qu'il a été créé, si bien qu'un pack continue de fonctionner d'une mise à jour d'Engine à l'autre. Écris les fichiers depuis **Download** (télécharger) sur une partie ou sur un monde de la bibliothèque (ou avec `GET /api/game/:chatId/world/file`) : ces fichiers l'incluent. Un fichier de pack est limité à 8 Mo, le plus gros fichier de partage que lit Engine (un pack de tuiles garde ses propres limites, plus petites) : un monde dont le fichier est plus gros (l'instantané d'un très grand monde) ne peut donc pas être livré dans un pack. Un monde dont l'histoire définit un `intro` exige Capability API 1.339 (voir [Le message d'introduction](../extending/writing-story-scripts.md#the-intro-message)). `tiles` peut être un pack de tuiles en images (pack de tuiles version 2 : des planches PNG sur une grille de cellules, avec des sprites de plusieurs cellules), qui exige Capability API 1.80 ; Engine décode et vérifie ses planches une fois par version de package. Avec l'Experience activée, une nouvelle partie est verrouillée sur le kit du pack ; si le pack livre des mondes, le joueur en choisit un (histoire comprise) et n'en crée aucun autre. Désactiver l'Experience rend au joueur ses propres choix. `POST /api/game/create` impose le même verrou à une partie. La partie garde son kit et son monde comme n'importe quelle partie : elle continue donc si le package est retiré, et dessine sa carte du monde et ses villes avec les tuiles du pack tant que le package est installé.

Engine lit les fichiers par le chemin de ressources vérifié (taille déclarée de 8 Mo au plus par fichier, empreinte contrôlée de nouveau) et les vérifie comme il vérifie les fichiers de partage. Un pack est refusé en entier, avec la raison, quand un fichier ne se lit pas, quand un monde a été créé avec un autre kit ou ne lui correspond pas, ou quand ses octets ne sont pas ceux qui ont été installés ; l'Experience ne peut alors lancer aucune partie. Un ensemble de règles ne fait jamais partie d'un pack de carte : une Experience qui a besoin de ses propres règles livre un package d'ensemble de règles distinct.

### Capability API 1.18 : conserver la configuration d'Experience dans l'assistant Game

Un package `game-surface` peut déclarer `contributions.gameSurface.setup` avec la version 2 du schéma et Capability API 1.18. Engine conserve ses sept étapes habituelles de configuration, dont **Party** (équipe), les objectifs, les modèles et les lorebooks. Seules les nouvelles parties proposent des Experiences ; rouvrir la configuration d'une partie existante conserve son Experience et la configuration du package. Les packages sans cette déclaration conservent leur ancienne boîte de dialogue de configuration.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

Les trois champs sont facultatifs. La graine déclarée apparaît sous l'Experience sélectionnée avec un bouton **Randomize** (choisir au hasard). La graine est un nombre entier non signé de 0 à 4294967295 ; une saisie vide, décimale, négative, avec exposant ou hexadécimale bloque **Start** (démarrer). L'hôte écrit la graine numérique et les constantes déclarées dans `experienceConfig` ; `config` ne peut pas contenir la clé de la graine. Les constantes doivent tenir dans 8 000 caractères après sérialisation. Le libellé de la graine est un texte d'affichage rédigé par le package ; omets-le pour utiliser le libellé localisé d'Engine.

Une exigence déclarée concernant les widgets est appliquée tant que l'Experience est active. L'hôte règle le contrôle sur la valeur déclarée, le verrouille et indique quelle Experience l'a fixé. L'importation d'un fichier de configuration ne peut pas remplacer la valeur déclarée. Le choix antérieur du joueur reste intact et il est rétabli dès que l'Experience est désactivée. Les contrôles de configuration de carte spatiale sont masqués pour ces Experiences : aucun brouillon, modèle ou outil de création de carte distinct n'est lancé.

L'étape **Lorebooks** (lorebooks) permet de sélectionner jusqu'à 100 entrées individuelles activées, y compris dans des livres non joints. Les livres et entrées désactivés ainsi que les exclusions du chat sont respectés. Ces identifiants sont transmis dans `GameSetupConfig.activeLorebookEntryIds`. Dans `/game/setup`, ce sont des entrées forcées supplémentaires : elles évitent les tirages de probabilité tout en conservant les limites habituelles de tokens. Le lore global, lié aux personnages et joint participe toujours à l'analyse ordinaire. Les packages peuvent lire les mêmes identifiants sélectionnés dans la configuration pour leur propre requête de génération du monde. Les identifiants d'entrées importés qui n'existent pas sur cette machine sont signalés et ignorés.

L'importation d'un fichier de configuration restaure une Experience installée et compatible ainsi que sa graine numérique valide, mais écarte toute configuration arbitraire du package. Le manifeste actuel fournit à nouveau les constantes. Un fichier qui ne contient aucune graine d'Experience utilisable laisse intacte la graine aléatoire déjà remplie. Les parties existantes ignorent les importations d'Experience avec une explication. Les instantanés de création conservent le nom de l'Experience et la graine pour le résumé de configuration.

Utilise indépendamment la déclaration existante de disponibilité au démarrage lorsque le monde doit être préparé avant le premier tour. Déclare API 1.18 comme minimum du package ; les hôtes plus anciens ne savent pas interpréter cette déclaration de configuration.

### Capability API 1.71 : lire les messages comme les agents les lisent

En Roleplay, un message peut contenir des murmures qui ne font pas partie de son `content`. Chaque agent exécuté par Engine les lit, et un package qui lit lui-même le chat peut désormais lire le même texte. Chaque enregistrement renvoyé par `persistence.listMessages(chatId)` reçoit `agentContent` : le message tel que les agents d'Engine le lisent. Chaque murmure se trouve à sa place, marqué `[Private whisper to <name>: …]`, et un message qui n'est qu'un murmure se lit comme ses murmures. Un document qu'un personnage remet, comme une lettre, suit le message. Les notes privées du joueur sont laissées de côté.

`agentContent` n'est présent que dans les chats Roleplay. Il est absent dans les autres modes et dans un salon multijoueur hébergé, où tout le monde voit ce qu'écrivent les agents. `content` ne change jamais : c'est toujours le texte public. `extra` ne change pas non plus : ce sont les données enregistrées du message, avec tous ses murmures, dans tous les modes. N'affiche jamais un texte construit à partir de lui à des joueurs ou à des personnages auxquels un murmure n'était pas destiné.

```ts
const messages = await api.runtime.persistence.listMessages(chatId);
const history = messages.map((message) => message.agentContent ?? message.content);
```

Il s'agit d'une interface souple : les anciens moteurs omettent ce champ, donc un package qui lit `agentContent ?? content` n'a pas besoin de déclarer 1.71. Il lui faut la permission `chat-read`, comme pour `listMessages`. Les murmures sont privés : tout ce qu'un package écrit à partir d'eux, comme une note ou un souvenir, peut atteindre des personnages auxquels le murmure n'était pas destiné.

### Capability API 1.68 : calculer l'embedding des requêtes de recherche en tant que requêtes

`embeddings.embed(texts, signal?, inputType?)` accepte un troisième argument : passe `"query"` pour un texte de recherche, comme une requête de rappel. Par défaut, les textes sont traités comme `"document"`. Certains modèles d'embedding attendent un préfixe sur les requêtes, et certains aussi sur les documents : e5 et nomic-embed-text en utilisent un pour chacun, et Snowflake Arctic Embed v2 ne préfixe que les requêtes. Engine ajoute celui qui convient. Le rappel est moins bon quand l'embedding d'une requête est calculé comme celui d'un document. Les autres modèles, dont le générateur local MiniLM intégré, ne reçoivent de préfixe dans aucun cas. Le type d'entrée ne change pas `spaceId` : les vecteurs enregistrés restent donc comparables et rien n'a besoin d'être recalculé.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const [queryVector] = (await embeddings.embed([query], signal, "query")) ?? [];
const memoryVectors = await embeddings.embed(memoryTexts, signal); // documents
```

Il s'agit d'une interface souple : un ancien moteur ignore le troisième argument, donc un package peut toujours le passer et n'a pas besoin de déclarer 1.68. Passe le type d'entrée en troisième argument, jamais dans un objet d'options : un ancien moteur transmet le deuxième argument directement au fournisseur comme signal d'annulation.

### Capability API 1.67 : ouvrir un personnage dans l'éditeur

La vue du navigateur reçoit `openCharacter(characterId, { tab })`. Elle ouvre l'éditeur de personnage, sur l'onglet indiqué le cas échéant, afin qu'un package puisse envoyer l'utilisateur vers un champ de la fiche qu'il lit. Les anciens moteurs ne l'ont pas : vérifie que `openCharacter` existe avant d'afficher le lien.

```ts
if (typeof props.openCharacter === "function") props.openCharacter(characterId, { tab: "convo" });
```

<a id="capability-api-150-professor-mari-actions"></a>

### Capability API 1.66 : scènes depuis les fils d'un package

Une scène de roleplay part en général d'une Conversation (`/scene`). Un package qui détient la nouvelle permission `scenes`
peut faire de ses propres fils, comme un fil de messages privés, le point de départ à la place. La scène
est un chat de scène ordinaire : le même planificateur, la même boîte de dialogue de préférences de prompt, les mêmes instructions de scène, les mêmes commandes End Scene,
Discard et Convert, et la même mémoire de personnage quand elle se conclut. Le package gère le côté
du fil : ce que lit le planificateur, le verrou pendant que la scène se déroule, et ce qu'il advient du résumé.

```ts
export async function activate({ api }) {
  api.registerSceneOrigin({
    // Planning context, or null when the thread no longer exists.
    getContext: async (threadId) => ({
      characterIds: [creatorCharacterId],
      personaId,
      connectionId: null, // the Engine's default connection
      transcript: [{ speaker: "Mina", content: "Come to my shoot tonight?" }],
      notes: "Stage persona, limits and anything else the scene writer must respect.",
    }),
    // Lock the thread. Return false when it already has an active scene.
    claim: async (threadId, { sceneChatId, characterIds }) => lockThread(threadId, sceneChatId),
    // Unlock and receive the outcome.
    release: async (threadId, end) => {
      if (!(await holdsLock(threadId, end.sceneChatId))) return;
      if (end.kind === "concluded") await saveRecap(threadId, end.summary);
      await unlockThread(threadId);
    },
  });
}
```

La vue de navigateur (`home-browser-tab`) reçoit ces propriétés :

- `startScene({ originId, prompt?, planHint?, plan?, data?, initiatorCharacterId?, initiatorName? })` ouvre la
  boîte de dialogue de préférences de prompt de la scène, planifie et crée la scène, puis ouvre son chat. Passe `plan` (un
  `SceneFullPlan` : nom, description, scénario caché, premier message, prompt système de la scène, classification,
  historique de la relation, guide de participation, arrière-plan, distribution) pour écrire la scène toi-même ; la
  boîte de dialogue et le planificateur du moteur sont alors sautés, et la scène est créée exactement comme prévu. La fonction se résout en
  `{ chatId }`, ou en `null` quand l'utilisateur annule ou que la création échoue (l'utilisateur voit pourquoi). L'utilitaire
  utilise toujours l'identifiant propre au package. C'est une commodité, pas une frontière : les routes de scène acceptent n'importe quel identifiant
  de package, donc `getContext` ne doit renvoyer que ce que le joueur peut de toute façon voir dans ce fil.
- `openChat(chatId)` ouvre un chat, pour un bouton "Go to scene" sur un fil verrouillé.
- `focusSceneOriginId` est le fil à afficher quand l'utilisateur revient d'une scène (Back, End Scene,
  Discard). Appelle `onFocusSceneOriginHandled()` une fois que tu l'as affiché.

Règles à connaître :

- `data` contient les réglages propres à cette scène, un simple objet JSON d'au plus 4 000 caractères. Le moteur
  le conserve avec la scène et le transmet à `claim(originId, { sceneChatId, characterIds, data })` et
  à `release` sous la forme `end.data` : chaque scène peut ainsi décider pour elle-même. `claim` peut admettre une scène sans
  verrouiller (renvoyer `true` sans rien enregistrer), et `release` peut déverrouiller sans prendre le résumé, ou
  le prendre avec la portée que la scène a demandée.
- Seul `getContext` est obligatoire. Un package qui veut seulement lancer des scènes omet `claim` et
  `release` : rien n'est verrouillé, autant de scènes que voulu peuvent partir de la même origine, et rien n'est
  transmis quand elles se terminent (**Back** ramène toujours au package). N'omets que `release` pour verrouiller
  sans connaître l'issue, ou que `claim` pour connaître les issues sans verrou.
- Un seul fournisseur par package ; un nouvel enregistrement le remplace, et la désactivation le retire.
- `characterIds` doit contenir des personnages du moteur ; les identifiants inconnus sont écartés, et un contexte sans aucun personnage
  connu est refusé. Un `personaId` inconnu est traité comme absent. `notes` est coupé à 8 000 caractères
  et transmis au planificateur et, avec la transcription, à l'auteur de la scène comme contexte caché.
- `claim` s'exécute une fois le chat de scène créé. `false` l'écarte avec une erreur 409 ; une exception l'écarte avec
  une erreur 503. `getContext`, `claim` et `release` disposent chacun de 8 secondes : un `getContext` ou un `claim` en retard
  compte comme un échec (503, le chat de scène est supprimé), un `release` en retard est journalisé et ignoré.
- `release` reçoit `concluded` (avec `summary`, `description`, `scenario`, `rating` et la distribution),
  `abandoned`, `deleted` ou `converted`. Il doit être idempotent et ignorer une scène qui ne
  détient pas le verrou. Un release qui lève une exception, ou qui arrive pendant que le package est inactif, est journalisé et
  ignoré : le chat de scène reste terminé dans tous les cas. Pour réparer un verrou obsolète, lis donc le chat de scène
  avec `chat-read`. Ses métadonnées contiennent `sceneStatus`, et une scène conclue contient aussi `sceneSummary`.
- Le moteur n'écrit rien dans une Conversation pour une origine de package. La mémoire des personnages est enregistrée à
  la conclusion exactement comme pour une scène de Conversation.

`scenes` est refusé sur un manifeste qui déclare un `capabilityApi` antérieur à 1.66.

### Capability API 1.50 : actions de Professor Mari

Un package doté de la nouvelle permission `mari-actions` peut proposer des actions nommées à Professor Mari. Il enregistre un service sous son propre identifiant ; l'outil `package_service` de Mari liste les actions et en exécute une à la demande de l'utilisateur.

```ts
export async function activate({ api }) {
  api.registerService("mari-actions:my-package", {
    list: () => [
      {
        name: "add-idea",
        summary: "Give a Creator an idea for a post.",
        inputs: { accountId: "The Creator.", text: "The idea." },
      },
    ],
    run: async (name, input, { signal }) => {
      const parsed = schemas[name]?.safeParse(input);
      if (!parsed?.success) return { ok: false, status: 400, error: "Invalid input." };
      return { ok: true, value: await doIt(name, parsed.data, signal) };
    },
  });
}
```

Règles importantes :

- La clé doit être `mari-actions:<package-id>` pour le package qui s'enregistre. Sans permission ou sous l'identifiant d'un autre package, l'enregistrement lève une erreur : l'action exécutée par Mari appartient donc toujours au package nommé.
- `list()` renvoie des entrées `{ name, summary?, inputs? }`. Les noms comptent de 1 à 80 lettres, chiffres, `.`, `_` ou `-` ; les autres entrées sont masquées. Mari lit `summary` et `inputs` : écris-les clairement. Seules les 50 premières actions sont visibles ou exécutables. Mari voit au plus 40 entrées par action ; les noms sont tronqués à 80 caractères et chaque texte à 300. `list()` doit répondre sous 5 secondes, sinon les actions du package sont omises.
- `run(name, input, { signal })` n'est appelé qu'avec un nom listé et un objet JSON simple de 64 000 caractères maximum. L'entrée vient d'un modèle : valide-la avec ton schéma avant toute action. Réponds `{ ok: true, value }` ou `{ ok: false, status?, error }` ; Mari voit les 2 000 premiers caractères de l'erreur. `signal` s'annule quand l'utilisateur arrête Mari ou après 5 minutes ; l'Engine cesse alors d'attendre, donc arrête aussi ton travail.
- L'Engine masque les URL de données dans `value` avant lecture par Mari et tronque les réponses longues. Retourne des identifiants et du texte court, pas des fichiers.
- La liste est en lecture seule. Toute exécution compte comme modification dans Permissions Mode de Mari : Plan la refuse, Manual attend l'Accept de l'utilisateur. L'Engine ne peut ni prévisualiser ni annuler une action de package ; aucune carte Keep/Restore n'apparaît. Propose ta propre action d'annulation pour les changements difficiles à inverser. Pour cette raison, Plan refuse aussi les actions uniquement en lecture.
- Désactiver ou supprimer le package retire ses actions.

`mari-actions` est refusé si le manifeste déclare une `capabilityApi` antérieure à 1.50.

### Capability API 1.36 : les succès des packages

Un package disposant du nouveau droit `achievements` peut ajouter des badges au panneau **Achievements** (succès) de l'écran d'accueil, consulter leur état de déblocage et les débloquer. Le panneau les affiche dans une section portant le nom du package, après les badges propres à Engine.

```ts
export async function activate({ api }) {
  api.registerAchievements([
    { id: "first_run", title: "First Run", description: "Ran the package once.", iconPath: "art/first-run.png" },
    {
      id: "ten_runs",
      title: "Regular",
      description: "Ran the package ten times.",
      target: 10,
      readProgress: () => runs,
    },
  ]);
  // Later, when the package decides a badge is earned:
  if (await api.runtime.achievements.unlock("first_run")) celebrate();
}
```

Quelques règles à connaître :

- Les identifiants utilisent l'espace de noms `<packageId>.<id>`. Un identifiant intégré ne contient aucun point : les deux ne peuvent donc pas entrer en conflit. L'hôte accepte l'identifiant local ou celui qui inclut l'espace de noms et refuse tout identifiant que le package n'a pas enregistré lui-même.
- `unlock(id)` se résout avec `true` uniquement pour l'appel qui a débloqué le badge. `isUnlocked(id)` et `list()` lisent l'état ; `list()` renvoie les badges propres au package avec leur progression.
- Le comptage reste à la charge du package. Un badge à paliers définit `target` et un callback `readProgress` : les deux ou aucun. Engine le débloque lors du même passage que ses propres badges à paliers une fois le compteur arrivé à l'objectif. Conserve le compteur dans l'hôte de persistance. Si un callback lève une exception ou ne se termine pas dans les **2 secondes**, la valeur signalée est zéro et le problème est journalisé. Comme pour les outils, cette limite ne concerne que les attentes asynchrones : un traitement synchrone qui bloque la boucle d'événements ne peut pas être interrompu.
- `iconPath` est un chemin à l'intérieur du répertoire racine des ressources du package, servi par la route des ressources du package. Une carte verrouillée affiche toujours le cadenas. Si l'illustration ne se charge pas, la carte utilise `icon` en remplacement (`trophy` par défaut).
- `title` et `description` sont les textes affichés. Un pack de langue peut les remplacer au moyen de `capabilityAchievements.<packageId>.<id>.title` et `.description`.
- Au maximum **32 badges par package**. Un lot contenant une seule entrée invalide n'enregistre rien.
- Désactiver ou supprimer le package masque ses badges. Les déblocages sont conservés, comme ceux des badges propres à Engine, et réapparaissent au retour du package.

`api.registerAchievements` et `api.runtime.achievements` n'existent que dans un Engine de cette version ou d'une version ultérieure : un package qui les utilise déclare donc `capabilityApi` 1.36.

<a id="capability-api-135-agent-home-widgets"></a>

### Capability API 1.35 : widgets Home des agents

Un package d'agent peut proposer jusqu'à trois cartes dans la grille de widgets Home. L'Engine ne les place jamais seul : l'utilisateur les ajoute, masque, restaure et réorganise dans **Widget Manager** (gestionnaire de widgets), où elles sont regroupées sous l'agent. L'Engine possède grille, cadre et disposition ; le package possède l'intérieur de la carte.

Déclare ensemble le slot `home-widget` et les définitions :

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 35 },
  "kind": ["agent"],
  "permissions": ["ui"],
  "entrypoints": { "client": "client.js" },
  "contributions": {
    "slots": ["home-widget"],
    "homeWidgets": [
      {
        "id": "latest",
        "label": "Latest Posts",
        "description": "The newest posts from the feed.",
        "size": "large",
        "iconPath": "art/widget.png",
        "accent": "violet",
        "surface": "solid",
        "header": "banner"
      }
    ]
  }
}
```

- `id` utilise le kebab-case minuscule, jusqu'à 64 caractères, et reste unique dans le package.
- `label` (1–80 caractères) et `description` (jusqu'à 200) sont les textes du Widget Manager. Un pack de langue peut les remplacer via `localizations.<locale>.homeWidgets.<id>.label` et `.description`.
- `size` vaut `compact` ou `large`. Un grand widget occupe plus de place.
- `icon` est un nom d'icône Engine (`activity`, `bell`, `calendar`, `chart`, `circle`, `clock`, `file`, `flame`, `heart`, `image`, `list`, `message`, `sparkles`, `star`, `zap`). `iconPath` est une illustration du package (`gif`, `jpg`, `jpeg`, `png`, `webp`) et doit figurer dans `files[]`.
- `accent`, `surface` et `header` sélectionnent les presets de présentation de l'Engine.

L'installation est refusée si le package n'est pas un `agent` avec permission `ui` et point d'entrée client, si slot et `homeWidgets` ne sont pas déclarés ensemble, si deux widgets partagent un identifiant ou si `capabilityApi` est antérieure à 1.35.

L'Engine monte l'élément client du package avec `view="widget"`. En plus des habituels `packageId`, `packageVersion` et `localization`, `capabilityProps` contient :

- `widgetId`, `widgetLabel`, `widgetDescription`, `widgetIcon`, `widgetIconPath`, `widgetAccent`, `widgetSurface` et `widgetHeader` : définition de la carte affichée, pour qu'un bundle dessine tous ses widgets.
- `active` : `true` uniquement si Home est affiché et la carte visible. Suspends interrogations et animations lorsque la valeur est `false`.
- `onOpenNoodle()` : ouvre l'onglet navigateur Home du package. Malgré son nom, fonctionne pour tout package déclarant aussi `home-browser-tab`. Sans cet onglet, cette fonction et `onOpenPost` ne font rien.
- `onOpenPost(id)` : ouvre l'onglet Home du package sur un élément. `id` est une chaîne de 128 caractères maximum ; le reste est ignoré. L'élément `view="browser"` reçoit alors `focusPostId: id`. Il doit appeler `onFocusPostHandled()` après affichage pour ne pas répéter le focus. Passer à un autre onglet abandonne le focus en attente.

Un widget est une petite vue de l'agent, pas une seconde copie. Garde-le léger et renvoie vers l'onglet navigateur pour les tâches plus grandes.

### Capability API 1.34 : une créature écrite dans les termes de l'ensemble de règles

Une créature de bestiaire peut porter `sheet` : une fiche dans les termes de l'ensemble de règles, aussi partielle que souhaité. Le combat la construit comme celle d'un membre de l'équipe : santé, défense, sauvegardes, initiative, vitesse et capacités des listes proviennent des déclarations de l'ensemble et sont payées avec ses propres réserves. Elle ne déclare pas en plus `health`, `defense`, `initiativeModifier`, `speed`, `abilities` ou `saves`, et peut n'avoir aucune action de bloc propre :

```json
{
  "capabilityApi": { "major": 1, "minor": 34 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/creatures.json"] } }
}
```

Le contrôle lit les octets de l'ensemble et chaque catalogue détenu par l'installation, comme 1.27. Une ligne de la fiche de créature peut porter `_catalog: "<catalog>/<entry>"` pour une entrée d'un catalogue qui alimente cette liste ; le moteur charge ces catalogues avec le bestiaire pour le combat. Ce n'est pas une intégration facultative, pour la même raison que 1.20–1.33 : un moteur qui ne comprend pas la clé refuse le catalogue strict entier. Le paquet qui l'inclut déclare 1.34. Aucun droit supplémentaire.

### Capability API 1.33 : le moment qu'attend une réaction

`mechanics.reaction` d'une entrée peut être un objet plutôt que `true`. `on` nomme le moment remarqué par le moteur, `at` indique la cible de l'action prise et `cancels` empêche ce que la fenêtre tenait en attente de se produire :

```json
{
  "capabilityApi": { "major": 1, "minor": 33 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

`on` vaut `aimed`, avant qu'une chose touche le porteur, ou `harmed`, après qu'il a subi des dégâts ; en nommer un place l'entrée dans le menu de cette fenêtre. `at` vaut `source`, qui remplit l'auteur du moment, ou `chosen`, qui garde les cibles de l'entrée. Seule une entrée `aimed` peut `cancel` : on ne peut pas annuler ce qui s'est déjà produit. Le coût d'une action annulée reste dépensé, car il a été payé avant la question.

Une entrée gardant `"reaction": true` dit seulement qu'elle ne se prend pas pendant un tour ; cela ne suffit pas pour la proposer dans une fenêtre. Elle ne figure sur aucun menu et ne nécessite rien de plus récent. Ce n'est pas une intégration facultative, pour la même raison que 1.20–1.32 : un moteur qui ne comprend pas l'objet refuse tout le catalogue strict. Le paquet qui l'inclut déclare 1.33. Aucun droit supplémentaire.

### Capability API 1.32 : une arme qui limite ses propres attaques

Une source d'attaques peut déclarer `strikesCappedBy`, une colonne booléenne de sa liste. Si elle est active sur une ligne, celle-ci achète une seule attaque, quel que soit le nombre acheté par `strikes` pour la liste. Une arme qui tire une fois par tour garde donc cette limite tandis que le reste attaque autant que le prévoit la fiche. Cela correspond à la propriété Loading du SRD 5.1 : "you can fire only one piece of ammunition when you use an action, bonus action, or reaction to fire it, regardless of the number of attacks you can normally make."

```json
{
  "capabilityApi": { "major": 1, "minor": 32 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

`strikes` est requis ; sans lui, la clé est refusée, car une liste achetant une attaque par dépense limite déjà chaque ligne à une. Ce n'est pas une intégration facultative, pour la même raison que 1.20–1.31 : un moteur qui ne comprend pas la clé refuse le fichier de règles entier. Le paquet qui l'inclut déclare 1.32. Aucun droit supplémentaire.

### Capability API 1.31 : intégrations de génération de l'hôte

Les paquets serveur peuvent utiliser `api.runtime.integrations` pour accéder aux services actuels du moteur pour les LLM, images et vidéos. Déclare API de capacités 1.31 dans le manifeste et vérifie la disponibilité de l'hôte d'intégration pendant l'activation. Les anciens moteurs refusent l'exigence API avant l'activation. Les opérations de fournisseur nécessitent `network` ; enregistrer, préparer et retirer des médias nécessite `storage`.

- `llm.createProvider(...)` accepte les réglages de connexion de la fabrique du moteur, dont les paramètres de requête et en-têtes personnalisés. Le fournisseur accepte `chat`, `chatComplete`, `embed`, `maxContextValue` et `maxTokensOverrideValue`. Il n'expose aucune propriété d'identifiants secrets.
- `llm.localSidecar()` renvoie le fournisseur sidecar local de l'hôte par la même façade.
- `llm.withFallback(...)` enveloppe un fournisseur créé par le même hôte de paquet. Il conserve l'admission, les notifications de repli et le choix du fournisseur du moteur.
- `images.generate(...)` et `videos.generate(...)` utilisent les implémentations actives du moteur, avec annulation, journalisation des requêtes, contrôles réseau et files de médias. Transmets le `signal` et le `debugMode` de l'interface de l'appelant lorsqu'ils existent.
- `images.save`, `images.remove`, `images.stage` et `images.sweepStaged` réutilisent les écritures sûres et le cycle des fichiers préparés de la galerie. `videos.save` et `videos.remove` réutilisent le chemin de stockage vidéo. `images.resolveNovelAiRequestSize` réutilise la normalisation des tailles NovelAI de l'hôte. La durée vidéo et la normalisation d'envoi public de références sont disponibles via `videos.resolveDuration` et `videos.resolveReferenceUpload`.
- `speech.transcribe(audio, { filename, mimeType, signal })` envoie l'audio enregistré au serveur de reconnaissance vocale que l'utilisateur a défini dans **Connections → Speech to Text** (Connexions → Reconnaissance vocale) et se résout avec la transcription, ou avec `null` tant que ce serveur est désactivé, pour que le package continue d'utiliser sa propre transcription. Il applique la politique d'URL de l'hôte (`STT_LOCAL_URLS_ENABLED`) ainsi que les limites de taille et de durée, et n'expose jamais la clé enregistrée. `speech` est facultatif et ne demande aucune API de capacités plus récente : vérifie `typeof api.runtime.integrations?.speech?.transcribe === "function"` et prévois un repli pour les anciens moteurs.

`@marinara-engine/shared` exporte les types partagés de requête et de résultat. Garde la construction des prompts et l'orchestration propres au paquet dans celui-ci ; utilise ces points d'entrée de l'hôte pour les E/S de fournisseur plutôt que copier les services du moteur. Les types et auxiliaires purs peuvent toujours être inclus dans le paquet.

### Capability API 1.341 : services d'exécution de l'hôte et bibliothèques serveur partagées

Le serveur d'un package qui embarque sa propre copie d'un service du moteur en exécute une seconde instance, avec son propre état :
sa propre connexion Intiface, sa propre admission des connexions, sa propre file de métadonnées de chat et son propre registre de services.
Capability API 1.341 ajoute des membres à `api.runtime` qui accèdent plutôt aux instances actives du moteur, et permet aux serveurs de
packages d'utiliser certaines bibliothèques du moteur au lieu de les embarquer. Chaque nouveau membre est facultatif dans
`CapabilityRuntimeHost` : vérifie donc sa présence avant de l'utiliser.

- `runtime.services.get(key)` renvoie un service qu'un package a enregistré avec `api.registerService`, ou `null` tant qu'il est
  absent ou pendant une génération dans un salon partagé. Il lit le registre propre au moteur, que tous les packages peuvent donc consulter.
  Les clés `agent-runtime:` et `mari-actions:` renvoient toujours `null` ; seul le moteur les lit.
- `runtime.commands.parse(content)`, `strip(content)` et `instructions()` lisent les commandes de Conversation avec la
  grammaire du moteur et les balises enregistrées de chaque package.
- `runtime.logger.isLevelEnabled(level)` indique si le système de logs du moteur écrit actuellement ce niveau.
- `runtime.persistence.patchChatMetadata(chatId, patch, { touchUpdatedAt })` est la modification de métadonnées mise en file par le moteur,
  avec une file par chat partagée avec les écritures propres au moteur, la protection des salons partagés et les numéros d'ordre d'écriture. Les clés de la
  modification remplacent ces clés, et toutes les autres restent en place. `patch` peut être une fonction des métadonnées actuelles. Dans
  `withChatLock` pour le même chat, la modification s'exécute sous ce verrou. Comme `updateChatMetadata`, elle refuse une nouvelle référence à
  une image de Global Gallery qui n'existe plus.
- `runtime.persistence.appendMessages(chatId, messages)` ajoute des messages, chacun avec son premier swipe, en un seul lot et
  les renvoie. `createChatNote` et `createChatInfluence` ajoutent une note ou une influence ponctuelle depuis une Conversation
  vers le Roleplay qui lui est connecté. Ces quatre membres de persistance nécessitent `chat-write`.
- `runtime.persistence.updateCharacterStatus(chatId, characterId, { status, activity, duration })` applique une
  `[schedule_update]` comme le fait le moteur après une réponse de Conversation : un statut temporaire sur la fiche de personnage,
  que le personnage affiche dans tous les chats jusqu'à son expiration. `status` vaut `online`, `idle`, `dnd` ou `offline`, `activity`
  contient au plus 500 caractères, et au moins l'un des deux est requis. `duration` s'écrit comme dans la commande (`2h`,
  `30m`) ; sans durée, ou si elle ne peut pas être lue, le statut dure 60 minutes, et jamais plus d'une semaine. Le résultat est
  `{ status, activity, expiresAt }`, ou `null` si rien n'a changé : un statut défini à la main par l'utilisateur garde la priorité,
  et un salon partagé conserve ses propres routines. La méthode refuse une modification non valide, un chat qui n'est pas de Conversation
  et un personnage qui n'est pas dans le chat, et nécessite `chat-write`. Elle a rejoint l'API de capacités 1.341 après les
  premiers moteurs qui annoncent 1.341 : vérifie donc `typeof api.runtime.persistence.updateCharacterStatus === "function"` et
  ignore le changement de statut si elle manque.
- `runtime.integrations.admission` est l'admission des connexions du moteur : le travail d'arrière-plan d'un package attend donc les
  requêtes de l'utilisateur sur la même connexion. `withProvider(provider, connectionId, mode)` enveloppe un fournisseur créé par
  les intégrations du même package, `run(connectionId, mode, operation)` exécute une tentative, `tryBackground(connectionId)`
  prend le créneau d'arrière-plan lorsque la connexion est libre, et `isFailure(error)` reconnaît les erreurs du moteur signalant une connexion occupée ou
  un refus. Aucune permission n'est nécessaire, car il réserve seulement des créneaux.
- `runtime.integrations.haptics` (`status`, `connect`, `executeCommand`) utilise l'unique connexion Intiface Central
  du moteur. Il nécessite `network`.
- `runtime.integrations.spotify` (`commandsAvailable`, `playSong`) utilise le compte Spotify de l'agent Music DJ.
  `playSong` échoue avec `ConversationSpotifyCommandError` ; les codes `spotify_unavailable` et
  `missing_playback_scope` signifient que Spotify n'est pas configuré : abandonne alors la commande sans afficher de message. Il nécessite `network`.
- `runtime.integrations.speech.transcribeLocal(wav)` transcrit un enregistrement PCM WAV avec le modèle Local Whisper
  téléchargé dans **Connections**, et échoue avec le message du moteur si ce modèle n'est pas téléchargé. Il nécessite `network`.
- `runtime.integrations.images.addToChatGallery(input)` fait figurer une image enregistrée avec `images.save` dans la galerie
  du chat, et `images.persistToEntityGalleries(input)` la fait figurer dans les galeries des personnages et des personas qu'elle
  représente, comme pour les images générées par le moteur. Les deux nécessitent `storage`.

**Jamais de copie embarquée.** Lorsqu'un de ces membres manque, le package indique que la fonction nécessite une version plus récente de
Marinara Engine. Il ne se rabat jamais sur une copie embarquée d'un service du moteur qui conserve un état, comme le registre des fournisseurs,
le sidecar local, l'admission des connexions, le service haptique, Spotify, le système de logs, un registre ou une file de stockage, car une seconde
copie sépare un état que le moteur conserve en un seul endroit. Les types et auxiliaires purs peuvent toujours être embarqués.

**Bibliothèques serveur partagées.** Le serveur d'un package peut laisser `zod`, `adm-zip`, `dotenv`, `nanoid` et `jsonrepair` hors de
son bundle et les importer par leur nom, comme il peut déjà le faire pour `@huggingface/transformers`, `onnxruntime-node`,
`onnxruntime-web`, `sharp`, `pino`, `pino-pretty` et `undici`. Node les résout depuis la copie d'exécution du package
par deux liens, de `<runtime copy>/node_modules` vers `DATA_DIR/capability-packages/node_modules`, puis vers
`packages/server/node_modules` du moteur : le package reçoit donc l'instance même du module qu'utilise le moteur. pnpm n'y garde que les
dépendances directes du serveur : seuls ces noms peuvent donc être résolus, et non une dépendance d'une dépendance, telle que `ws`.
Le moteur conserve les noms ci-dessus comme dépendances directes de production de `packages/server`, et chaque installation garde cette
structure : les installations depuis les sources ou par le lanceur, Windows (où le lien de données est une jonction), Android et Termux, ainsi que les deux
images Docker. Lorsqu'il démarre ou active un package, le moteur recrée un lien de données qui pointe ailleurs,
y compris un lien devenu sans cible après le déplacement d'un dossier de données depuis un autre chemin d'installation. Tout ce qui se trouve à cet emplacement sans être un lien
reste intact.

**Déclaration.** Un package qui utilise l'un de ces éléments déclare `schemaVersion: 2`, `capabilityApi: { major: 1, minor: 341 }`
et `builtAgainst`, et conserve sa plage `engine`. Un manifeste `schemaVersion: 1` n'est jamais vérifié par rapport à
l'API de capacités : il passe donc à la version 2. C'est l'API de capacités qui conditionne l'accès, et non la version du moteur : un moteur sans
ces membres refuse l'installation ou la mise à jour ("Package requires capability API 1.341; this Engine supports ..."),
laisse le package hors de sa liste de mises à jour et garde la version installée en cours d'exécution.
