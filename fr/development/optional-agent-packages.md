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

Les contributions de contexte restent enregistrées par `api.registerPromptContext` et nécessitent `prompt-context`. La requête expose maintenant `targetCharacterIds`, `personaId` et `placedAgentTypes`, facultatif pour la compatibilité. Ce dernier indique quelles sections de données d'agents sont déjà placées par le preset pour éviter les doublons. L'hôte conserve l'identité du paquet de chaque contribution dans `packageBlocks` pour placer son texte dans la section d'agent correspondante. Un texte destiné à un public particulier doit respecter les identifiants de personnages cibles reçus.

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

L'hôte renvoyé possède `spaceId`, `label` et `embed(texts, signal?)`. Il utilise la source configurée et se replie sur le générateur local MiniLM intégré si aucune source n'est disponible ou si la résolution de configuration échoue. `embed` peut renvoyer `null` ; les lots vides, plus de 128 textes ou plus de 200 000 caractères cumulés sont refusés. Un nouvel hôte ne recalcule pas les vecteurs existants : le paquet doit traiter un changement de `spaceId` avant de comparer les nouveaux vecteurs aux anciens.

Les moteurs actuels exposent cette méthode quelle que soit la version d'API déclarée. Déclare API 1.15 si le suivi des changements de connexion est nécessaire. Pour accepter les anciens moteurs, tu peux vérifier `typeof api.runtime.resolveEmbeddings === "function"` et utiliser sinon `api.runtime.embeddings`, avec sa limite à l'état d'activation.

### Capability API 1.16 : verbes du Game Master déclarés par un paquet

Capability API 1.16 permet à un paquet Experience de déclarer une courte liste fermée d'actions nommées du Game Master, les verbes. Le moteur les affiche dans le rappel de format du GM, les extrait de la narration terminée et les exécute pour le paquet. Aucun code serveur du paquet ne s'exécute pour cela : une Experience `game-surface` avec seulement des points d'entrée `agents` et `client` peut faire modifier son monde par le GM dans la prose.

L'intégration est complète : schéma, noms réservés et propriété des clés, lecteur de table, rendu du prompt et exécuteur. Un paquet qui fournit une table et détient `chat-write` voit ses verbes dans le rappel de chaque tour Game d'un chat lié ; ils sont exécutés lorsque le GM les utilise. Un chat sans paquet lié, ou lié à un paquet sans table, résout zéro verbe et conserve un tour identique octet par octet à celui d'avant cette intégration.

Déclare la table comme `gm-verbs.json`, dans `contributions.assets.paths` et fixée par hash dans `files[]`, comme toute ressource. Elle est découverte par ce nom réservé, une nouvelle convention : tous les autres fichiers sont lus par leur chemin déclaré (`entrypoints`, icônes, ressources), et rien d'autre n'est découvert par sa forme. Un fichier dans `files[]` mais absent de `contributions.assets.paths` ne produit aucun diagnostic à l'installation ni à la construction du catalogue : le paquet n'a simplement aucun verbe. La ressource déclarée est servie sans protection sur `/api/capability-packages/<id>/assets/gm-verbs.json`, car cette route ne contrôle pas l'accès privilégié ; la table ne doit jamais contenir d'information sensible. Comme 1.11–1.13, l'intégration reste facultative : un ancien moteur voit une ressource JSON ordinaire et l'ignore. Tu peux la livrer sans réduire les versions acceptées ; ne déclare `capabilityApi` 1.16 que si le paquet exige les verbes, car cela refuse tous les moteurs antérieurs.

Le document est `{ "schemaVersion": 1, "verbs": [ … ] }`, avec 1 à 16 verbes. Chaque verbe est strict : une clé inconnue est refusée. Les champs inconnus à côté de `schemaVersion` et `verbs` ont délibérément un autre traitement : le moteur les retire pour garder les verbes compris d'une table plus récente, tandis que le schéma partagé de création est strict et les refuse. La validation pendant l'écriture est donc plus stricte que la lecture à l'exécution :

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

Un nom de verbe suit `[a-z][a-z0-9_]*`, compte au maximum 32 caractères et ne peut pas être une balise du GM propre au moteur. La vérification ignore la casse : le rappel écrit `[Note:` et `[Book:`, mais l'expression de lecture est insensible à la casse ; `note` masquerait la balise du journal. L'ensemble réservé vient de toutes les balises que les rappels du GM et du groupe peuvent produire dans leurs branches, et des cinq analyseurs de narration : analyseur de balises et formateur du client, éditeur de segments du serveur, analyseur de scènes du sidecar et réécriture des dialogues de la route de génération. Leur vocabulaire comprend aussi `main`, `side`, `extra`, `action`, `thought`, `whisper` et le couple `qte_bonus` / `qte_result`, reconnu uniquement par le formateur. Un verbe `whisper` retirerait `[whisper:Tam]` d'une réplique avant sa sauvegarde, qui cesserait définitivement d'être une ligne de dialogue.

Les régressions fixent aussi les extracteurs : chaque analyseur apportant un nom exclusif, comme `party-chat` / `party-turn` ou le couple QTE, doit continuer à le fournir. Si une source cesse d'être parcourue, la compilation échoue au lieu de rétrécir discrètement l'ensemble. Les trois autres sont parcourus aussi pour repérer de nouvelles balises. Cela ne garantit pas l'exhaustivité : une balise dans un fichier non parcouru ou sous une forme illisible pour l'extracteur peut échapper au contrôle ; élargis l'ensemble quand un analyseur apparaît. Les mots ordinaires `action`, `state`, `status` et `note` sont aussi réservés ; leur refus vient généralement de cette règle plutôt que d'une faute de frappe.

`description` occupe une ligne de 1 à 200 caractères sans crochets ni sauts de ligne, car elle entre telle quelle dans `COMMANDS:`. Outre CR et LF, `U+0085`, `U+2028`, `U+2029`, les contrôles C0 et DEL, dont la tabulation, sont refusés car ils déforment le bloc. Les macros de tout le rappel sont toutefois développées ensuite : `{{…}}` dans la description est évalué, y compris `{{setvar::…}}`, qui écrit des variables du chat. Cela ne donne pas plus d'accès que `chat-write`, mais évite ces accolades sauf si tu les souhaites vraiment. Un verbe accepte six arguments maximum, chacun `{ name, type, enum?, maxLength?, optional? }`, nommés `[a-z][a-zA-Z0-9_]*` sur 32 caractères au plus. Contrairement au verbe, les majuscules sont permises car ce sont des clés JSON, pas des balises. Seules les chaînes acceptent un `enum` de 1 à 16 valeurs distinctes ; les doublons sont refusés. Une chaîne sans enum doit déclarer `maxLength` de 1 à 500 : l'analyse ciblée de l'exécuteur n'hérite d'aucun autre plafond et pourrait avaler un fragment entier de narration. Déclarer `enum` et `maxLength` ensemble est refusé, car l'enum borne déjà la valeur. Les charges sont du JSON plat sur une ligne ; un `}` imbriqué termine la correspondance trop tôt. Une seule occurrence de chaque nom est analysée par message, donc un verbe répété n'est appliqué qu'une fois.

N'explique pas ces arguments dans la description. La table analysée produit une charge schématique, la description puis un exemple à copier :

```
- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — Set the sky when the weather visibly changes. Example: [weather:{"word":"fair"}]
```

Le schéma enseigne le vocabulaire : arguments dans l'ordre, facultatifs marqués `"name"?:` hors de la chaîne JSON, alternatives complètes des enums, plafond des chaînes libres et nombres ou booléens sans guillemets. Le validateur refuse `"3"` comme nombre au lieu de le convertir. L'exemple ne montre qu'une valeur d'enum ; avec seulement `{"word":"fair"}`, le GM peut écrire "sunny", refusé sans avertissement visible. La balise est retirée dès que le nom correspond, pas lorsque la validation réussit : la narration reste propre mais le monde ne change pas. Tirer schéma et exemple de la même table empêche leur divergence ; les valeurs ne vivent plus dans une description susceptible de promettre une valeur interdite. Consacre les 200 caractères au moment où utiliser le verbe, pas à répéter ses arguments.

La dégradation se fait par verbe. Un `effect` plus récent, une forme impossible à représenter, un nom réservé ou une clé étrangère est ignoré avec une ligne de journal ; les autres continuent, comme pour `parseCapabilityCatalogWithCompat`. Si un verbe n'apparaît pas, lis le journal. Un document inutilisable, avec `schemaVersion` inconnu, tableau `verbs` vide ou racine autre qu'un objet, produit une table vide et une ligne de journal. Il est aussi refusé avant lecture si son `files[].bytes` déclaré dépasse 64 KB ; `files[]` accepte jusqu'à 100 MB et rien d'autre ne borne une ressource avant lecture. En cas d'échec, le tour survit sans changement.

Un verbe avec `metadataKey` est un **verbe d'état** : tous ses arguments sont écrits sous cette clé des métadonnées du chat ; le paquet voit le changement dans ses propriétés habituelles. Sans `metadataKey`, c'est un **verbe d'événement**, envoyé en direct comme événement client de capacité, sans écriture durable, file, rejeu ni accusé de réception. Un événement refuse `metadataKey` pour ne pas réserver une clé qu'il n'écrit pas ; l'état l'exige.

L'état est durable et ne revient jamais en arrière : changer de variante, modifier ou supprimer le tour laisse la valeur. La dernière variante générée gagne, pas la dernière affichée ; prose et monde peuvent diverger sans réconciliation. Un événement n'a aucune mémoire : une image, un envoi synchrone. Il est perdu sans bruit si le tour est annulé, si l'onglet est fermé ou rechargé pendant la diffusion, s'il arrive avant le premier montage du paquet, si le joueur change de chat ou si le paquet reste derrière son écran de chargement. Rien ne le renvoie. En échange, son effet peut revenir en arrière avec l'histoire si le paquet le stocke dans un état reconstruit par le retour en arrière ; les métadonnées du chat ne reviennent pas en arrière. Un événement appliqué à l'état vivant puis perdu lors d'un rechargement forcé avant la prochaine sauvegarde ne laisse aucune trace dans aucun des deux cas.

La sémantique relative est donc interdite par conception pour les deux types. L'état remplace une valeur absolue et ne peut pas exprimer "ajouter cinq pièces d'or". Un événement relatif est aussi interdit : régénérer crée un nouvel indice de variante sans reprendre les marques de la précédente, donc il s'accumulerait une fois par variante générée. Dédupliquer avec `chatId:messageId:swipeIndex` protège du renvoi, que ce canal ne fait pas, mais pas de la régénération, qu'il fait. Ce sont les valeurs absolues, pas un registre de transactions, qui permettent d'appliquer deux fois un verbe sans risque. Transforme le vocabulaire relatif en valeurs absolues par message.

Si un tour porte les deux types, l'événement synchrone arrive avant la fin du rechargement asynchrone de l'état. Son gestionnaire ne doit pas lire l'effet d'un verbe d'état du même tour en s'attendant à la nouvelle valeur.

Le moteur ne valide que la forme : noms et types d'arguments, appartenance aux enums et limites de chaînes. La sémantique appartient au paquet : on ne peut pas énumérer les PNJ à la déclaration si le monde est compilé par chat. Le refus du paquet pour un verbe d'état n'est donc qu'indicatif, car les métadonnées sont déjà enregistrées à sa réception. Pour un événement, il est effectif : le moteur n'a rien enregistré et le paquet peut réellement refuser un nom inconnu.

`metadataKey` doit appartenir au paquet selon trois règles : commencer par son identifiant normalisé en camelCase (`hierarchical-maps` → `hierarchicalMaps`), continuer par un suffixe non vide commençant à une majuscule, et ne pas avoir un identifiant normalisé qui soit un espace de noms du moteur ou l'étende à une frontière de majuscule. Cela empêche d'usurper le préfixe d'un autre paquet. La liste du moteur dérive de toutes les clés supérieures de `ChatMetadata`, de ses constantes et des clés présentes seulement dans la signature d'index, comme `encounterActive`, `internalAssistant` et `imageGenConnectionId`, invisibles pour les deux premières sources.

Ce troisième groupe nécessite sept sources : les objets passés à `patchMetadata`/`updateMetadata` ; ceux renvoyés par les callbacks de mise à jour, presque aussi fréquents ; la mutation `useUpdateChatMetadata()` et la propriété `onMetadataChange` du client ; les appels directs `PATCH /chats/:id/metadata`, utilisés sans ce hook pour les clés de combat, scène et narration ; les lectures `chatMetadata.key` et `chat.metadata.key` ; les lectures du résultat de `parseChatMetadata(…)`, l'idiome le plus courant et le seul qui voit `scenario` ; et la liste manuelle de clés par chat des profils de réglages, couvrant celles écrites et lues à travers des frontières de fonctions.

Les régressions fixent toutes les sources et leurs extracteurs. Deux limites sont délibérées. Une écriture recevant une variable ou le résultat d'une fonction, comme `patchMetadata(id, hydratedMeta)` ou la même forme sur la route de métadonnées, contient des clés invisibles à un balayage statique : il existe vingt appels de ce type et la régression fixe ce nombre ; un vingt-et-unième impose une lecture manuelle. Une lecture dans un auxiliaire à partir d'un paramètre est également hors de portée : c'est le cas de `spatialContext`, écrit par le client de `hierarchical-maps` distribué depuis Agents et lu ici via un auxiliaire et une analyse locale au fichier. La liste manuelle comble ce second manque ; l'une des sept sources est donc choisie à la main. Les limites sont nommées plutôt que niées. `persona` constitue aussi un minimum ajouté manuellement qu'aucune source ne produit aujourd'hui.

La troisième règle refuse délibérément des paquets entiers : `conversation-calls` devient `conversationCalls`, et `conversationCalls` + `Enabled` est déjà une clé du moteur. Ce paquet ne peut pas posséder de clés sous son identifiant ; `noodle` et `background` sont dans le même cas, ce dernier étant déjà une clé de métadonnées. Ils peuvent toujours déclarer des événements, qui ne possèdent aucune clé. Les clés sont plates et au premier niveau parce que c'est la forme que lit déjà le réconciliateur du paquet.

Les commandes du modèle déclarées par un package ne s'exécutent que si le package déclare `chat-write`, est installé et prêt. Cette permission contrôle aussi les écritures via l'API de persistance du package : messages, métadonnées du chat, événements de roleplay et instantanés spatiaux. `chat-read` contrôle la lecture des chats, messages, états du jeu et instantanés spatiaux. Les mêmes contrôles s'appliquent dans les transactions de persistance et les verrous de chat ; le droit d'écriture ne donne pas implicitement le droit de lecture. Les appels de persistance propres au moteur restent de confiance.

Après installation, la vue détaillée de **Download Agents** (télécharger des agents) affiche les permissions déclarées par la version installée. Si la version du catalogue demande d'autres permissions, elle les affiche séparément. Installer ou mettre à jour du code exige toujours l'approbation existante liée à cette version et à cette somme de contrôle exactes ; les commandes du modèle ne demandent pas une approbation séparée à chaque tour.

Ce sont des contrôles d'API, pas un environnement JavaScript isolé. Les permissions de réseau, de stockage et d'interface sont des déclarations d'accès. Le code du package côté navigateur et serveur reste du code de confiance et peut accéder à son environnement hôte ; installe uniquement des packages auxquels tu fais confiance. Le contrôle porte sur l'état prêt plutôt que sur la possibilité de servir les fichiers : une mise à jour laissant le package en `restart-required` suspend la résolution de ses commandes jusqu'au redémarrage du moteur.

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

Le choix des appels d'outils plutôt que d'un format de réponse est volontaire. Un format occupe toute la réponse : la narration devrait devenir un champ d'un objet JSON et ne pourrait pas arriver en streaming. Un appel d'outil peut accompagner le texte pendant que le modèle écrit son tour. Le package reçoit des arguments déjà contraints par le fournisseur, au lieu de les extraire de la narration terminée. Un schéma impose des règles ; une convention demande simplement au modèle de les respecter.

Les énumérations rendent la différence concrète. Un package qui connaît douze lieux peut inscrire leurs douze noms dans le schéma. Un treizième nom est refusé avant d'atteindre le gestionnaire. Le validateur d'arguments existant d'Engine indique les valeurs acceptées pour que le modèle puisse corriger l'appel. Le résultat renvoyé par le gestionnaire est montré au modèle comme résultat de l'outil.

Avant d'écrire un outil, retiens ces règles :

- Les noms suivent `<packageId>_<name>`, avec `-` remplacé par `_` : `set_time` du package `world-clock` devient `world_clock_set_time`. Un nom déjà pris par un autre package est refusé. Les outils intégrés et les outils personnalisés activés gardent les noms en conflit ; la définition du package est omise. Le nom complet est limité à **64 caractères**. Les définitions et l'exécution suivent le même ordre : intégré, personnalisé, package.
- Les outils sont joints tant que le package est actif. Il n'existe pas de second interrupteur par chat comme pour les outils intégrés : déclarer la permission et enregistrer l'outil constitue la décision. Le fournisseur choisi doit prendre en charge les appels d'outils natifs.
- Le schéma des paramètres est copié et compilé lors de l'enregistrement. Si Engine ne peut pas le compiler, l'activation échoue, ce qui rend le problème visible pendant le développement plutôt qu'au milieu d'un tour.
- Une exception du gestionnaire fait échouer l'appel et est journalisée ; son message n'est pas transmis au modèle. Après **10 secondes** sans résultat, le tour cesse aussi d'attendre. Le gestionnaire continue de tourner, mais ne bloque plus le tour.
- Les résultats doivent être sérialisables sur au plus **64 KiB**. Un résultat plus gros ou non sérialisable fait échouer l'appel au lieu de prendre la place de la conversation. Les descriptions et résultats sont du contenu de package considéré comme fiable. Vérifie `chatId` avant de lire ou modifier les données d'un chat.
- Chaque définition est sérialisée dans la requête au fournisseur à chaque tour et comptée dans l'ajustement du contexte. Les limites sont **16 outils par package**, **64 pour tous les packages**, **512 caractères** par description et **8 KiB** par schéma. Les dépasser lève une erreur qui fait échouer l'activation. Réenregistrer un nom appartenant au package remplace l'outil sans prendre de place supplémentaire.
- Le contexte d'activation cesse de fonctionner après son démontage. Un package qui conserve `api` et appelle `registerTool` depuis un callback ultérieur est refusé : une ancienne exécution ne peut ni enregistrer des outils ni remplacer ceux d'une nouvelle activation.
- Désactiver, mettre à jour ou supprimer un package libère ses outils. Le modèle ne reçoit pas d'outil dont le package ne peut plus répondre. Les outils sont retirés avant d'attendre le nettoyage ; chaque callback de nettoyage dispose de 8 secondes.

Ces délais limitent uniquement l’attente asynchrone. Les packages s’exécutent comme du code de confiance dans le processus serveur ; un minuteur ne peut pas interrompre un traitement synchrone qui bloque la boucle d’événements. Une annulation forcée nécessiterait un worker ou un processus séparé, ce que cette API ne fournit pas.

`api.registerTool` n'existe qu'à partir de cette version d'Engine. Un package qui en dépend doit déclarer `capabilityApi` 1.19 et refuse de s'installer sur une version antérieure.

## Énoncés de décision et modèle de décision

Le **Decision model** (Modèle de décision) de l'utilisateur répond aux énoncés oui/non et à choix sur le chat récent. Consulte [Modèles de décision](../connections/decision-models.md) pour son rôle et sa configuration.

Un modèle de prompt d'agent livrée par un paquet peut utiliser `{{#if decision:"..."}}` et `{{#if decision_choice:"..." == "..."}}` comme un agent personnalisé. Le moteur les trouve et les pose avant d'exécuter l'agent (après la réponse pour un agent de post-traitement), puis résout le modèle avec les réponses. Aucune version d'API de capacités n'intervient. Consulte la syntaxe et la formulation dans [Prompts conditionnels](../prompts/conditional-prompts.md#asking-the-decision-model), et les phases dans [Créer des agents personnalisés](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

Le code d'exécution d'un paquet ne peut pas encore interroger directement le modèle de décision. Il faut une méthode d'API de capacités et son propre changement de version.

Conçois chaque usage pour quelqu'un sans modèle de décision. Un énoncé sans réponse vaut non : la branche `{{else}}`, ou rien, doit fournir un comportement par défaut raisonnable. Écris pour un modèle de décision en général, sans exiger Jev : les modèles de chat locaux et les autres backends compatibles emploient la même syntaxe, mais peuvent répondre différemment. Consulte [Seuils](../connections/decision-models.md#thresholds) et [Limites et coût](../prompts/conditional-prompts.md#limits-and-cost) avant de dépendre d'un score, d'un nombre de requêtes ou d'une réponse en cache précis.

### Note aux développeurs d'Experiences Game Mode

Le combat du moteur décide lui-même des actions des ennemis ordinaires. Chaque ennemi non-boss du GM reçoit un rôle selon ses compétences et sa classe (bruiser, bulwark, skirmisher, marksman, spellcaster, supporter ou controller), une maîtrise selon son niveau sauf s'il la définit (novice, trained, veteran ou master), et un tempérament comme reckless, cautious, opportunistic ou protective. Les bêtes et monstruosités sont toujours mindless. Le code choisit ces valeurs depuis une graine sans appel au modèle ; la difficulté modifie la régularité avec laquelle ils suivent leur type. Seuls les boss écrits expressément sont dirigés par le GM via un appel au modèle. Consulte [IA de combat de Game Mode](game-combat-ai-design.md).

D'autres améliorations arrivent. Avant d'introduire des décisions dans le combat, vérifie si le moteur standard répond déjà au besoin. Pour une personnalité précise, choisis d'abord la maîtrise et le tempérament correspondants. Une décision par tour ennemi ajouterait du travail de modèle et un délai ; un backend hébergé ajouterait aussi des requêtes réseau et des frais. Le combat dépendrait d'un modèle que l'utilisateur n'a peut-être pas configuré et devrait prévoir un comportement raisonnable sans réponse.

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

Au démarrage du serveur, l'hôte récupère le catalogue une fois, à condition qu'au moins un package officiel soit installé, retient uniquement les versions plus récentes compatibles avec le moteur et l'API de capacités en cours d'exécution, les vérifie par le pipeline d'installation habituel, puis les installe avant que les runtimes des packages ne s'activent. Les échecs sont isolés package par package. Les fichiers existants et l'état du registre restent utilisables lorsque le catalogue est hors ligne ou que la vérification échoue, et les échecs de disponibilité du runtime serveur empruntent le chemin de rollback vers la version précédente.

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

Le panneau **Agents** contient un contrôle `Download Agents` qui reprend le principe du contrôle `Download Cards` du Card Browser. Il ouvre une bibliothèque plein écran et responsive, avec recherche, types de packages, informations de compatibilité, état d'installation ou de mise à jour, permissions, coût de stockage, documentation et contrôles de désinstallation.

Sur ordinateur, une liste de navigation s'accompagne d'une zone de détail voisine. Sur mobile, un seul panneau est affiché, avec un retour explicite et des actions dimensionnées pour le tactile. Les états vide, hors ligne, incompatible, téléchargement corrompu, installation interrompue, mise à jour, rollback et redémarrage requis sont traités comme des cas de premier plan.

## Critère d'extraction

Une extraction n'est complète que lorsque les bundles de production du client et du serveur de base ne contiennent plus l'implémentation du package, qu'une installation neuve ne peut pas l'activer sans télécharger le package, qu'une installation mise à jour la conserve, et que l'installation, la mise à jour et la désinstallation du package fonctionnent sur les systèmes de fichiers d'ordinateur, de mobile et compatibles Termux.

### Capability API 1.20 : ensembles de règles de Game Mode

Un ensemble fournit des données validées : résolution de tests connue d'Engine, fiche composée d'éléments prédéfinis, repos et consignes GM. La ressource réservée `ruleset.json` est découverte comme `gm-verbs.json`, via `contributions.assets.paths` et son hash dans `files[]`.

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

L'exemple montre seulement les champs concernés ; `name`, `version`, `description`, `engine` et `builtAgainst` restent obligatoires. Aucun agent, permission ni point d'entrée client ou serveur n'est nécessaire. Le type `ruleset` et `ruleset.json` s'exigent mutuellement. Aucun code ni expression textuelle ne s'exécute ; une nouvelle résolution exige une modification d'Engine. Le format et l'exemple 5e figurent dans [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

Le manifeste doit déclarer API 1.20 ; un Engine antérieur refuse l'installation. Engine rejette une taille déclarée supérieure à 256 KB avant lecture, revérifie le hash installé et applique le schéma strict `packages/shared/src/schemas/ruleset.schema.ts`. Un fichier invalide est ignoré avec une seule entrée de journal donnant paquet et premières erreurs `path: message`. Pour un identifiant répété, le premier paquet par ordre d'ID de paquet gagne ; l'autre est ignoré avec un journal. `engine-legacy` et `traditional` sont réservés.

Le choix est enregistré une fois dans `chat.metadata.gameRuleset`. Sans choix, les règles existantes s'appliquent. Un paquet absent ou une définition ancienne rend l'ensemble indisponible sans le remplacer. Le lien vérifie ID de l'ensemble et paquet fournisseur, empêchant un autre paquet de récupérer la partie avec le même ID.

### Capability API 1.21 : catalogues

Les catalogues proposent sorts, capacités de classe et équipement dans l'éditeur de fiche. L'en-tête se trouve sous `catalogs` dans `ruleset.json` ; les entrées peuvent être intégrées ou dans une ressource réservée :

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

`catalogs/<id>.json` doit correspondre à l'ID du catalogue, jamais à un autre. Le fichier porte un hash dans `files[]` et exige le `ruleset.json` qui le déclare. Une taille déclarée supérieure à 1 MB est refusée avant lecture. Les deux formes sont validées contre la même fiche. Limites : 12 catalogues par ensemble et 2000 entrées par catalogue.

Le client charge le contenu à l'ouverture du sélecteur via `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. La liste installée contient seulement les nombres d'entrées. Le texte n'entre pas automatiquement dans le prompt ; le GM ne voit que ce que sélectionne `gm.sheetSummary`. Les ressources et le champ `catalogs` du fichier vérifié exigent API 1.21. Un ancien schéma strict rejetterait tout le fichier. Aucune permission.

### Capability API 1.22 : bloc battle

`battle` désigne la santé, éventuellement les MP, les réserves d'emplacements et les listes dont les lignes de catalogue deviennent des `CombatSkill`. Après le combat, les valeurs reviennent via les mêmes opérations de fiche que les boutons du joueur.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

C'est un lien de données vers le combat d'Engine, pas un adaptateur complet de jeu sur table. Le calcul intégré n'utilise ni `attackRoll`, `save`, `concentration` ni `perCostStep`. Les règles exactes relèvent d'une intégration distincte aux adaptateurs. `coverage.combat` garde son sens indépendant et n'est pas lu par ce lien. Le contenu vérifié de `ruleset.json` impose API 1.22 pour `battle`, comme API 1.21 pour `catalogs`. Aucune permission ni modification des ensembles sans ce bloc.

### Capability API 1.23 : valeurs de catalogue évolutives

`scaled` associe jusqu'à quatre colonnes numériques propres à une ligne aux valeurs maintenues par l'ensemble. Chaque colonne utilise une référence existante et une table de seuils facultative, par exemple ressources selon le niveau ou utilisations selon une caractéristique, sans nouvelle arithmétique.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

Le recalcul se fait à l'édition, pas à la lecture. État du jeu, prompt GM et combat lisent le nombre enregistré. Les lignes peuvent être dans `ruleset.json` ou `catalogs/<id>.json` ; le contenu vérifié exige API 1.23 pour `scaled`. Aucune permission ni modification des catalogues sans cette fonction.

`[sheet: op="use" name="..."]` paie `mechanics.cost` et une utilisation de chaque réserve de ligne créée par l'entrée. Il ne nécessite pas de nouvelle déclaration puisqu'il lit les catalogues déjà pris en charge.

### Capability API 1.24 : réserves de dés

`resolution` accepte `"kind": "dice-pool"` au lieu de `"dice-sum"`. La valeur de fiche donne le nombre de dés ; les résultats atteignant le seuil sont comptés. L'ensemble peut définir doubles succès, explosions, annulations, échecs critiques, succès exceptionnels et limites des ajustements du GM.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

La fiche reste la même : le modificateur de somme devient un nombre de dés. Aucun nouvel élément de fiche, emplacement d'éditeur ou code de paquet. Le contenu vérifié de `ruleset.json` exige API 1.24 pour `dice-pool` ; les anciens moteurs limités à `dice-sum` rejetteraient le fichier entier. Aucune permission ni modification des ensembles à somme.

### Capability API 1.25 : couches et consignes du monde

`layers` contient des variantes nommées, choisies à la création et fixées dans le lien de la partie. Le bloc de base `gm` accepte la chaîne facultative `worldGuidance` ; `gm.worldGuidance` est lu une fois lors de la création du monde pour l'adapter aux règles du groupe.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Les effets autorisés ajoutent des consignes après celles de l'ensemble, retirent des valeurs d'énumération, remplacent l'échelle de difficulté par une échelle du même type de résolution et masquent des entrées de catalogue. Ils n'ajoutent aucun élément de fiche : les fiches restent lisibles avec toutes les couches. Aucun code de paquet ni appel supplémentaire au modèle. Les couches tierces sont prévues plus tard. Les deux champs vérifiés exigent API 1.25. Aucune permission ni modification des ensembles qui ne les utilisent pas.

### Capability API 1.30 : blessures, dépenses sur un test et combat sur une piste

Une entrée `live.tracks` peut déclarer `levels` et `kinds` pour passer d'un entier borné à une PISTE DE BLESSURES : des cases portant chacune un libellé et une pénalité, sur lesquelles se placent les marques. `levels` compte 1 à 16 degrés, du meilleur au pire, chacun avec `label` et un entier `penalty`. `kinds` compte 1 à 6 types de dégâts, chacun avec `id`, un court `label` et une `severity` distincte. Ils vont ensemble : `kinds` sans `levels` est refusé faute de cases à marquer. `resolution.penaltyFrom` nomme la piste dont la pénalité touche chaque jet : sous `dice-pool`, elle retire des dés sans descendre sous `pool.min` ; sous `dice-sum`, c'est un modificateur fixe.

Le reste de 1.30 comprend ces ajouts ; un paquet utilisant un seul d'entre eux doit déclarer 1.30 :

- `combat.health` peut nommer une piste de blessures au lieu d'une réserve. `combat.damageKinds` indique ce que marque chaque type : `default`, une correspondance `byType` facultative et `marks`, avec `per-blow` pour une case par coup réussi ou `per-point` pour compter les niveaux de santé selon le jet de dégâts. `damageKinds` est obligatoire avec une piste de blessures et refusé avec une réserve.
- `resolution.spend`, pour `dice-pool` seulement, définit la réserve à dépenser sur un test, le coût d'un paiement, son achat de `successes` ou de `dice`, et `perCheck`, le plafond par jet.
- `mechanics.check` sur une entrée de catalogue définit ce qu'un élément CHOISI par le personnage fait au test : `reroll` (`upTo` et `once` ou `until`), `dice`, `successes` ou `threshold`. Réservé également aux réserves de dés.

```json
{
  "capabilityApi": { "major": 1, "minor": 30 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

La longueur d'une piste correspond à ses niveaux : `min` doit être 0 et `max`, `levels.length`. Un fichier qui dit autre chose est refusé, pas corrigé discrètement. `resolution.penaltyFrom` doit nommer une piste de blessures ; une piste ordinaire n'a aucune pénalité à appliquer.

Ce n'est pas une intégration facultative, pour la même raison que 1.20–1.28 : un moteur qui ne lit pas `levels`, `kinds`, `penaltyFrom`, `damageKinds`, `resolution.spend` ou `mechanics.check` refuse le fichier entier. L'installation lit les octets vérifiés de `ruleset.json` et refuse le paquet sous une déclaration antérieure. Rien ne change pour les pistes numériques, la santé en réserve et les règles sans dépense sur les tests.

### Capability API 1.29 : ce que permet un tour de combat de l'ensemble de règles

Cinq ajouts facultatifs concernent le bloc `combat` et les entrées de catalogue lues par le combat :

- Un coup peut porter jusqu'à trois quantités SUPPLÉMENTAIRES. `mechanics.plus` d'une entrée et `damage.plus` d'une action de créature utilisent `{ dice?, flat?, type?, save?: { save,
difficulty?, onSuccess: "none" | "half" } }` : chaque partie est lancée, typée, doublée par un critique et soumise à une sauvegarde séparément. Le coup entier garde un seul test de concentration et un seul test pour tomber.
- `combat.attacks[].strikes` référence une valeur indiquant le nombre d'attaques achetées par une dépense du budget de cette liste. Les restantes restent disponibles jusqu'à la fin du tour ; tant qu'il en reste, toutes les lignes de cette liste sont gratuites en budget.
- `mechanics.free` ne dépense aucun budget ; `mechanics.gives` en rend pour ce tour seulement, en respectant son plafond ; `mechanics.standard` permet d'acheter des actions standard avec un autre budget. Une entrée `utility` avec `gives` ou `standard` est proposée au lieu d'être ignorée.
- Le nouveau type `rider`, et les `riders` d'une créature, ajoutent une clause de dégâts au premier coup admissible du tour ou du round, passivement et sans figurer au menu.
- La liste fermée d'effets d'états ajoute `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` et `cannot-approach-source`. Un état peut restreindre les sauvegardes concernées (`saves`), compter seulement si sa source est visible (`whileSourceInSight`) ou finir lorsqu'elle tombe (`endsWhenSourceDown`).

```json
{
  "capabilityApi": { "major": 1, "minor": 29 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Ce n'est pas une intégration facultative, pour la même raison que 1.20–1.28 : un moteur qui ne comprend pas ces clés refuse l'ensemble de règles entier ou le catalogue qui les contient. L'installation lit les octets vérifiés de `ruleset.json` et de chaque `catalogs/<id>.json` déclaré, et les refuse sous une déclaration antérieure. Aucun nouveau droit, aucun changement pour les ensembles de règles qui ne déclarent rien de cela.

### Capability API 1.28 : combat de l'ensemble de règles sur un plateau

Le bloc `combat` peut définir la valeur d'une case dans sa propre distance (`distance: { label, perCell }`) ; c'est ce qui rend les positions possibles. `ranged` définit la pénalité d'un tir au-delà de la portée normale ou près d'un ennemi dans la case voisine ; `cover`, l'ajout du couvert à la défense ; `opportunity`, le budget payé pour frapper quelqu'un qui s'éloigne. Une liste d'attaques peut donner à ses lignes `reach` et `range`, lus depuis une colonne ou définis une fois pour toutes ; le `range` d'une action de créature peut être `{ "normal": 30, "long": 120 }` plutôt qu'un nombre.

```json
{
  "capabilityApi": { "major": 1, "minor": 28 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Déclarer `ranged`, `cover`, `opportunity` ou une portée d'arme SANS `distance` est refusé à l'importation : cela n'a aucun sens sans case pour la mesurer. Le plateau réutilise le générateur, le terrain et le déploiement du style tactique existant ; aucun second modèle de champ ni permission n'est ajouté.

Ce n'est pas une intégration facultative, pour la même raison que 1.20–1.27 : un moteur qui ne comprend pas ces clés refuse l'ensemble de règles entier ou le catalogue contenant une créature avec une paire pour portée. L'installation lit les octets vérifiés de `ruleset.json` et de chaque `catalogs/<id>.json` déclaré, et les refuse sous une déclaration antérieure. Aucun changement pour les ensembles de règles qui ne définissent pas de distance.

### Capability API 1.26: format de combat

API 1.26 ajoute `combat` pour jets, cibles, économie d'actions, attaques, capacités, états, concentration, santé nulle, types de dégâts et échelle des adversaires. `mechanics` peut décrire cibles, touches garanties, états, points temporaires, évolution selon la fiche et budget dépensé.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

### Capability API 1.27: bestiaires de l'ensemble de règles

API 1.27 permet `"holds": "creatures"`. Les blocs utilisent `combat` : santé fixe ou tirée au début, défense, initiative, caractéristiques et sauvegardes par ID de fiche, résistances, vulnérabilités, immunités, menace et traits pour le GM. Les actions peuvent attaquer, exiger une sauvegarde, appliquer un état, limiter les utilisations, se recharger par jet, enchaîner plusieurs actions avec un budget ou dépenser leurs propres points spéciaux.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Un catalogue de créatures ne déclare pas `feeds` et n'apparaît pas dans le sélecteur de fiches. Avec le directeur de combat activé, une partie dotée de `combat` utilise ces règles et son bestiaire sur l'écran de bataille, puis enregistre les fiches après chaque action. Il s'agit du style `ruleset`, sans niveau supplémentaire de Capability API. Sans `combat`, le bloc `battle` ou la préférence Classic/Tactical reste utilisé. L'installation contrôle les fichiers vérifiés `ruleset.json` et `catalogs/<id>.json` : `combat` et les nouvelles clés de `mechanics` exigent 1.26, `holds` et `creature` exigent 1.27. Un ancien schéma strict refuserait le fichier. Aucun nouveau droit ; les ensembles sans ces champs restent inchangés.

### Capability API 1.18 : conserver la configuration d'Experience dans l'assistant Game

Un package `game-surface` peut déclarer `contributions.gameSurface.setup` avec la version 2 du schéma et Capability API 1.18. Engine conserve ses sept étapes habituelles de configuration, dont **Party** (groupe), les objectifs, les modèles et les lorebooks. Seules les nouvelles parties proposent des Experiences ; rouvrir la configuration d'une partie existante conserve son Experience et la configuration du package. Les packages sans cette déclaration conservent leur ancienne boîte de dialogue de configuration.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

Les trois champs sont facultatifs. La graine déclarée apparaît sous l'Experience sélectionnée avec un bouton **Randomize** (choisir au hasard). Une saisie vide ou sans valeur numérique finie bloque **Start** (démarrer). L'hôte écrit la graine numérique et les constantes déclarées dans `experienceConfig` ; `config` ne peut pas contenir la clé de la graine. Les constantes doivent tenir dans 8 000 caractères après sérialisation. Le libellé de la graine est un texte d'affichage rédigé par le package ; omets-le pour utiliser le libellé localisé d'Engine.

Une exigence déclarée concernant les widgets fournit la valeur par défaut uniquement jusqu'à ce que le joueur modifie ce contrôle. Désactiver l'Experience rétablit la valeur par défaut habituelle, tandis que les choix explicites du joueur restent inchangés. Le contrôle explique ce qu'attend l'Experience et reste modifiable. Les contrôles de configuration de carte spatiale sont masqués pour ces Experiences : aucun brouillon, modèle ou outil de création de carte distinct n'est lancé.

L'étape **Lorebooks** (lorebooks) permet de sélectionner jusqu'à 100 entrées individuelles activées, y compris dans des livres non joints. Les livres et entrées désactivés ainsi que les exclusions du chat sont respectés. Ces identifiants sont transmis dans `GameSetupConfig.activeLorebookEntryIds`. Dans `/game/setup`, ce sont des entrées forcées supplémentaires : elles évitent les tirages de probabilité tout en conservant les limites habituelles de tokens. Le lore global, lié aux personnages et joint participe toujours à l'analyse ordinaire. Les packages peuvent lire les mêmes identifiants sélectionnés dans la configuration pour leur propre requête de génération du monde.

L'importation d'un fichier de configuration restaure une Experience installée et compatible ainsi que sa graine numérique valide, mais écarte toute configuration arbitraire du package. Le manifeste actuel fournit à nouveau les constantes. Les parties existantes ignorent les importations d'Experience avec une explication. Les instantanés de création conservent le nom de l'Experience et la graine pour le résumé de configuration.

Utilise indépendamment la déclaration existante de disponibilité au démarrage lorsque le monde doit être préparé avant le premier tour. Déclare API 1.18 comme minimum du package ; les hôtes plus anciens ne savent pas interpréter cette déclaration de configuration.

### Capability API 1.34 : une créature écrite dans les termes de l'ensemble de règles

Une créature de bestiaire peut porter `sheet` : une fiche dans les termes de l'ensemble de règles, aussi partielle que souhaité. Le combat la construit comme celle d'un membre du groupe : santé, défense, sauvegardes, initiative, vitesse et capacités des listes proviennent des déclarations de l'ensemble et sont payées avec ses propres réserves. Elle ne déclare pas en plus `health`, `defense`, `initiativeModifier`, `speed`, `abilities` ou `saves`, et peut n'avoir aucune action de bloc propre :

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

`@marinara-engine/shared` exporte les types partagés de requête et de résultat. Garde la construction des prompts et l'orchestration propres au paquet dans celui-ci ; utilise ces points d'entrée de l'hôte pour les E/S de fournisseur plutôt que copier les services du moteur. Les types et auxiliaires purs peuvent toujours être inclus dans le paquet.
