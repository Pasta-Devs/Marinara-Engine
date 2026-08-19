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
