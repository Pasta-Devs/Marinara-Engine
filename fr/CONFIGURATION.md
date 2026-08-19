# Référence de configuration du serveur

Ce guide explique comment modifier les réglages du serveur de Marinara Engine à l'aide de variables d'environnement. Une variable d'environnement est un réglage que tu écris dans un fichier texte simple, que le serveur lit ensuite. La plupart des utilisateurs n'ont jamais besoin de cette page. La liste complète des variables se trouve vers le bas.

## Dans quels cas configurer Marinara ?

Marinara Engine fonctionne tel quel, sans aucune configuration. Cette page ne sert que pour un petit nombre de tâches, presque toujours liées à l'usage du serveur depuis plusieurs appareils.

Tu peux avoir besoin de modifier la configuration pour :

- Rendre le serveur accessible aux autres appareils du réseau (contrôle d'accès).
- Protéger un serveur partagé par un mot de passe ou une liste d'autorisation d'adresses IP.
- Changer l'emplacement des données sur le disque.
- Augmenter le niveau de log pour diagnostiquer un problème.
- Laisser plus de temps aux tâches lentes d'image, de vidéo ou d'embedding (délais d'expiration).
- Débloquer les actions privilégiées, comme les sauvegardes ou les mises à jour, depuis un appareil distant.

Presque tout le reste – les clés API des fournisseurs, les personnages, les options de chat – se règle dans l'application, pas ici. Pour ajouter un fournisseur d'IA, consulte [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md).

Les agents officiels optionnels se gèrent eux aussi dans l'application. Ouvre **Agents → Download Agents** (télécharger des agents) pour les installer ou les désinstaller. Marinara sélectionne automatiquement la voie du catalogue [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) correspondant à la version majeure de son moteur.

Cycle de vie et stockage des packages :

- **Mises à jour :** Marinara vérifie si les packages officiels déjà installés ont une mise à jour compatible, et demande confirmation avant chaque téléchargement. Si tu réponds **No**, la version actuelle reste en place et l'action manuelle **Update** (mettre à jour) reste disponible dans Download Agents. Une installation neuve reste vide tant que tu n'as pas choisi de packages.
- **Plateformes :** Le comportement est identique sur ordinateur, sous Docker et sur les installations Android hébergées par Termux. Sur iOS et les autres clients navigateur, ce sont les packages installés sur le serveur hôte Marinara qui s'appliquent.
- **Persistance :** Les packages se trouvent dans `DATA_DIR/capability-packages`. Les volumes Docker, les dossiers de données personnalisés, les sauvegardes et les mises à jour normales les conservent.
- **Résistance hors ligne :** Les packages déjà installés continuent de fonctionner dans leur version installée si l'accès HTTPS sortant vers GitHub est indisponible, si une mise à jour est refusée ou si une mise à jour échoue à la vérification.

### Import d'agents personnalisés

Les fichiers, dossiers et dépôts d'agents externes sont verrouillés par défaut. Pour les autoriser, ouvre **Settings → Advanced → Danger Zone** (Paramètres → Avancé → Zone de danger) et active **Allow custom Agent imports** (autoriser l'import d'agents personnalisés). Contrairement aux extensions externes, cette barrière est entre les mains de l'utilisateur et ne demande aucune variable d'environnement. Les commandes d'import restent grisées tant qu'elle n'est pas activée.

Avant l'enregistrement, chaque import affiche les capacités demandées par l'agent. Les permissions doivent être approuvées explicitement, les fonctions et sélections d'outils fournies avec l'agent ne sont pas importées, le CSS généré est nettoyé, et les actions issues des résultats sont vérifiées par rapport aux capacités approuvées. Désactiver la barrière empêche les agents importés de l'extérieur de s'exécuter. Les agents personnalisés créés dans Marinara et les packages officiels installés via **Download Agents** restent exécutables et ne passent pas par cette barrière.

### Dépôts d'agents personnalisés

Les dépôts personnalisés sont désactivés par défaut, car leurs prompts et leurs sélections d'outils sont du contenu tiers non vérifié. Un prompt, c'est le texte que Marinara envoie à l'IA. Définis `ENABLE_CUSTOM_AGENT_REPOS=true`, active **Allow custom Agent imports** dans la Danger Zone, puis ouvre **Agents → Download Agents → Custom Sources** pour prévisualiser un dépôt GitHub public. L'ajout d'une source et l'application de toute modification ultérieure du contenu demandent tous deux une confirmation explicite. La synchronisation est manuelle : Marinara ne clone pas les dépôts et ne les interroge pas en arrière-plan.

La racine du dépôt doit contenir un tableau `agents.json` au même format de définition d'agent que les packages d'agents téléchargeables. Voici à quoi ressemble un fichier minimal :

```json
[
  {
    "id": "continuity-helper",
    "name": "Continuity Helper",
    "description": "Checks recent turns for contradictions.",
    "phase": "post_processing",
    "enabledByDefault": false,
    "category": "writer",
    "defaultPromptTemplate": "Check {{messages}} for continuity errors."
  }
]
```

Marinara n'accepte que les URL pointant sur la racine d'un dépôt GitHub, et valide l'archive bornée ainsi que chaque définition d'agent avant d'afficher l'aperçu. Pendant la synchronisation, les valeurs distantes de prompt, de réglages et d'outils remplacent les valeurs gérées par le dépôt qui figurent dans cet aperçu. Les choix de connexion et d'illustration restent locaux. Si un agent disparaît en amont, Marinara le conserve comme un agent personnalisé local ordinaire et supprime seulement son lien vers le dépôt. La suppression d'une source suit la même règle de conservation en local.

### Extensions externes

L'import d'extensions externes exige deux accords indépendants. Définis `ENABLE_EXTERNAL_EXTENSIONS=true` dans le fichier `.env`, puis ouvre **Settings → Advanced → Danger Zone**, descends sous les commandes de suppression de données, lis l'avertissement et active **Allow third-party extension imports** (autoriser l'import d'extensions tierces). La section **External Extensions** n'apparaît sous **Settings → Addons** qu'à cette condition.

La variable d'environnement est l'autorisation de la personne qui exploite le serveur ; l'interrupteur de la Danger Zone est l'acceptation explicite de l'utilisateur. La section, les routes d'import, les routes d'approbation et les deux chargeurs d'exécution appliquent tous cette double règle. Fermer l'une ou l'autre des barrières désactive les enregistrements externes et arrête le code externe en cours d'exécution. Les enregistrements d'extension stockés manuellement, hérités, importés depuis un profil ou d'origine inconnue sont traités comme externes : déposer des fichiers dans un dossier lié aux extensions ne permet donc pas de contourner ces barrières.

Les brouillons de Professor Mari restent disponibles sans cet indicateur. Ils sont créés désactivés et exigent malgré tout l'approbation de leur empreinte de code exacte.

Le mode Sandboxed Browser Extensions (extensions de navigateur isolées) reste celui par défaut. Certains anciens paquets tiers portent la mention **Full page access** (accès complet à la page) parce qu'ils dépendent du DOM de Marinara. Dans ce mode, le code approuvé s'exécute tel quel à l'intérieur de la page de Marinara et peut accéder au contenu de la page, au stockage du navigateur, aux API réseau et à la session en cours de même origine. Il n'est proposé qu'aux External Extensions une fois les deux barrières ouvertes, et il exige une acceptation d'avertissement distincte. Désactive-le et recharge la page si l'extension laisse derrière elle des changements visuels ou de comportement.

## Où se trouve le fichier .env

La configuration se trouve dans un fichier nommé `.env`. C'est un fichier texte simple, avec un réglage par ligne, sous la forme `KEY=value`. Les lignes qui commencent par `#` sont des commentaires et le serveur les ignore.

Le fichier `.env` contient des données, ce n'est pas un script shell. Marinara n'exécute ni `$`, ni les substitutions de commande comme `$(...)`, ni aucune autre syntaxe shell trouvée dans une valeur. Les lanceurs macOS/Linux et Termux appliquent la même règle de non-évaluation au petit ensemble de réglages dont ils ont besoin avant le démarrage du serveur. Une valeur déjà fournie dans l'environnement du lanceur prend le pas sur l'entrée correspondante du fichier `.env`.

Marinara crée un fichier `.env` vide au premier démarrage : tu n'as donc pas à en créer un à la main.

- Sur une installation normale, le fichier `.env` se trouve dans le dossier racine du projet.
- Sur les images Docker ou Podman officielles, il se trouve dans `/app/data/.env`, à l'intérieur du même volume de stockage que les données.

Un fichier nommé `.env.example`, placé dans le même dossier, liste chaque réglage avec sa valeur par défaut. Pour modifier un réglage, copie la ligne du fichier `.env.example` vers le fichier `.env`, puis change la valeur après le signe `=`.

Voici un exemple de fichier `.env` qui change le port et active un mot de passe :

```
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Le serveur lit le fichier `.env` de lui-même, quelle que soit la façon dont tu le démarres, y compris avec la commande `pnpm start` lancée directement. Les lanceurs shell (`start.bat`, `start.sh`, `start-termux.sh`) ajoutent deux extras : ils définissent `HOST=0.0.0.0` pour que les autres appareils puissent joindre le serveur, et ils ouvrent le navigateur à ta place. Avec la commande `pnpm start` seule, le serveur n'écoute que sur cet ordinateur, sauf si tu définis `HOST` toi-même.

## Redémarrage ou rechargement à chaud

Marinara surveille le fichier `.env` pendant son exécution. Quand tu enregistres une modification, la plupart des réglages s'appliquent en 2 secondes environ, sans redémarrage. Le serveur écrit une ligne de log commençant par `[env-watcher]` à chaque changement appliqué.

Un petit groupe de réglages bas niveau est figé au démarrage du serveur. Les modifier demande un redémarrage complet. Ces réglages sont les suivants :

- `PORT`, `HOST`
- `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`
- `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_UPDATE_ENABLED`, `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`
- Les réglages de délai d'expiration et d'interrogation pour l'image, la vidéo, les sprites et ComfyUI (`IMAGE_GEN_TIMEOUT_MS`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT`, ainsi que les quatre réglages `*_VIDEO_POLL_INTERVAL_MS`)

Quand l'un d'eux change, le log signale qu'un redémarrage est nécessaire. Les réglages de contrôle d'accès et les secrets comme `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET` et `CSRF_TRUSTED_ORIGINS` n'ont pas besoin de redémarrage.

## Contrôle d'accès

Le contrôle d'accès décide qui a le droit de joindre un serveur en cours d'exécution. Cette section est un aide-mémoire. Pour une marche à suivre détaillée avec des exemples, lis [Accès distant : Basic Auth et liste d'autorisation d'adresses IP](REMOTE_ACCESS.md).

Quelques termes employés ci-dessous :

- Loopback désigne l'ordinateur même sur lequel tourne le serveur. Tu l'atteins à l'adresse `127.0.0.1` ou `localhost`.
- Une plage CIDR est une écriture abrégée pour tout un bloc d'adresses IP, comme `192.168.1.0/24`. CIDR signifie Classless Inter-Domain Routing.
- Les plages RFC 1918 sont les plages d'adresses privées standard utilisées dans les réseaux domestiques et professionnels, par exemple `10.x.x.x` et `192.168.x.x`.

Par défaut, tant qu'aucun mot de passe n'est défini, le serveur n'accepte les connexions que depuis des sources de confiance : le loopback, toute adresse présente dans `IP_ALLOWLIST`, Tailscale, et le trafic du pont ou de la passerelle Docker sur le même hôte. Tout autre appelant, y compris ton réseau domestique habituel, reçoit un `403 Forbidden` tant que tu n'as pas choisi l'une des options ci-dessous.

Voici les principaux réglages de contrôle d'accès :

| Variable                                | Par défaut        | Ce que ça fait                                                                                                                                            |
| --------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BASIC_AUTH_USER`                       | vide              | Nom d'utilisateur pour la demande de mot de passe. À définir avec `BASIC_AUTH_PASS` pour exiger une connexion.                                             |
| `BASIC_AUTH_PASS`                       | vide              | Mot de passe de la demande de connexion. Laisse l'un des deux champs vide pour désactiver la connexion.                                                    |
| `BASIC_AUTH_REALM`                      | `Marinara Engine` | Texte affiché dans la fenêtre de mot de passe du navigateur.                                                                                               |
| `IP_ALLOWLIST`                          | vide              | Adresses IP ou plages CIDR séparées par des virgules, toujours autorisées. Le loopback est toujours autorisé.                                              |
| `IP_ALLOWLIST_ENABLED`                  | `true`            | Mets `false` pour garder la liste tout en suspendant son application.                                                                                      |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false`           | Rétablit l'accès sans mot de passe depuis les réseaux privés quand aucune connexion n'est configurée.                                                      |
| `ALLOW_UNAUTHENTICATED_REMOTE`          | `false`           | Autorise l'accès sans mot de passe depuis n'importe quelle adresse, y compris l'internet public. Déconseillé.                                              |
| `TRUSTED_PRIVATE_NETWORKS`              | valeurs internes  | Remplace les plages de réseau privé par défaut. Pense à inclure celles que tu veux conserver.                                                              |
| `BYPASS_AUTH_TAILSCALE`                 | automatique       | Une valeur vide ne fait confiance aux connexions Tailscale directes que si leurs deux extrémités utilisent des adresses du tailnet. Mets `true` pour l'ancien contournement de toute la plage `100.64.0.0/10`, ou `false` pour imposer le contrôle d'accès normal. |
| `BYPASS_AUTH_DOCKER`                    | automatique       | Une valeur vide ne fait confiance qu'à une interface de conteneur détectée et à sa passerelle exacte. Mets `true` pour conserver la compatibilité avec les réseaux anciens ou personnalisés, ou `false` pour imposer le contrôle d'accès normal. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY`         | `true`            | Impose les vérifications normales de connexion et de liste d'autorisation au trafic Docker transmis par un proxy. Ne mets `false` que si tous les clients en amont sont de confiance. |
| `TRUSTED_HOSTS`                         | vide              | Noms d'hôte publics ou de proxy inverse supplémentaires auxquels Marinara peut répondre. L'IP directe, localhost, `.local`, `.home.arpa` et les noms LAN à étiquette unique fonctionnent automatiquement. |
| `SSL_CERT`                              | vide              | Chemin vers un fichier de certificat TLS. À définir avec `SSL_KEY` pour servir directement en HTTPS.                                                       |
| `SSL_KEY`                               | vide              | Chemin vers le fichier de clé privée TLS.                                                                                                                 |
| `CSRF_TRUSTED_ORIGINS`                  | vide              | Origines de navigateur supplémentaires autorisées à enregistrer des modifications. Utile pour un domaine public ou un port inhabituel. La valeur littérale `null` est ignorée et ne doit pas servir pour l'APK Android ; ses routes de connexion auto-authentifiées fonctionnent sans accorder une confiance globale à une origine opaque. |

Basic Auth est l'abréviation de HTTP Basic Authentication, une simple demande de nom d'utilisateur et de mot de passe. Ses identifiants sont seulement encodés, pas chiffrés : associe-la donc toujours au HTTPS quand le serveur est exposé à l'internet public. Le HTTPS est la version sécurisée et chiffrée du HTTP. Pour l'activer directement, définis à la fois `SSL_CERT` et `SSL_KEY`, ou place un proxy inverse devant Marinara.

Pour que les autres appareils puissent joindre le serveur, celui-ci doit d'abord écouter sur une interface accessible. Définis `HOST=0.0.0.0`. Les lanceurs shell le font pour toi, mais la commande `pnpm start` n'écoute que sur le loopback.

Les téléphones, tablettes, pairs Tailscale et autres ordinateurs peuvent continuer à se connecter par l'adresse IP du serveur, sans l'ajouter à `TRUSTED_HOSTS`. Si tu publies Marinara derrière un nom d'hôte public ou de proxy inverse, ajoute ce nom exact, par exemple `TRUSTED_HOSTS=chat.example.com`. Les noms déjà présents dans `CSRF_TRUSTED_ORIGINS` ou `CORS_ORIGINS` sont également acceptés, par compatibilité. Cette vérification de l'en-tête Host empêche le nom DNS d'un site public d'être réassocié à l'adresse loopback de Marinara.

## Stockage

Les réglages de stockage déterminent où vivent les données locales : les chats, les personnages, les avatars et les médias générés.

| Variable           | Par défaut                                 | Ce que ça fait                                                            |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------- |
| `DATA_DIR`         | `packages/server/data`                     | Dossier racine de toutes les données utilisateur. Les images Docker utilisent `/app/data`. |
| `FILE_STORAGE_DIR` | le dossier `storage` situé dans `DATA_DIR` | Remplace le dossier de stockage des fichiers.                             |
| `ENCRYPTION_KEY`   | vide                                       | Clé servant à chiffrer les clés API enregistrées. Génère-la avec la commande ci-dessous. |

Marinara conserve les données sous forme de simples fichiers JSON. Les sauvegardes sont ainsi faciles à copier et à inspecter.

Pour générer une clé de chiffrement, lance cette commande et colle le résultat dans `ENCRYPTION_KEY` :

```
openssl rand -hex 32
```

Pour savoir ce que contient chaque dossier de données, consulte [Où sont stockées tes données](data/where-data-is-stored.md).

## Niveaux de log

Le log détermine le niveau de détail que le serveur affiche dans sa console. Un log est le journal du serveur. Le réglage principal est `LOG_LEVEL` : le serveur masque tout ce qui se situe sous le niveau choisi.

| Niveau  | Ce que ça affiche                                                       |
| ------- | ----------------------------------------------------------------------- |
| `error` | Uniquement les échecs graves et irrécupérables.                         |
| `warn`  | Les erreurs, plus les avertissements non bloquants. C'est la valeur par défaut. |
| `info`  | Les avertissements, plus les logs de démarrage et de chaque requête.    |
| `debug` | Tout, y compris les prompts complets et les réponses du modèle. Très verbeux. |

Recommandations :

- Garde la valeur par défaut `warn` pour un usage normal. Elle est discrète et ne signale que les vrais problèmes.
- Choisis `info` pour voir les requêtes et les grandes étapes sans inonder la console.
- Choisis `debug` quand tu as besoin de voir le prompt exact envoyé au modèle et la réponse reçue. Attends-toi à beaucoup de texte.

Pour lire le détail des prompts et des connexions sans les logs de requête de routine, définis un preset de log plutôt qu'un niveau :

```
LOG_PRESET=prompt-connections
```

Ce preset affiche le même détail de prompt et de modèle que `debug`, mais masque les lignes de requête répétitives comme `GET /api/chats`. Pour ne faire taire que ces lignes de routine tout en gardant le niveau actuel, définis ceci puis redémarre :

```
LOG_DISABLE_REQUEST_LOGGING=true
```

Le log du navigateur est séparé et ne dépend pas de `LOG_LEVEL`.

## Délais d'expiration

Un délai d'expiration est la durée maximale pendant laquelle le serveur attend une tâche lente avant d'abandonner. Les tâches multimédias, comme la génération d'images et de vidéos, peuvent être lentes : leurs délais sont donc généreux par défaut. Toutes les valeurs de délai sont en millisecondes, sauf mention contraire dans le nom.

| Variable                               | Par défaut                                  | Ce que ça fait                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHAT_GENERATION_TIMEOUT_MS`           | `300000` (5 minutes)                        | Délai pour les en-têtes du fournisseur, le premier token et l'intervalle entre deux fragments, pour les générations ordinaires en mode Conversation, Roleplay et Game, ainsi que le budget jusqu'au premier octet pour les générations en arrière-plan qui n'ont pas de délai propre (rafraîchissement de la chronologie Noodle, réponses de Noodler). Un token est un petit morceau de texte. Plage valide : `10000`-`3600000`. Ce réglage ne change pas les délais des agents, des médias, des embeddings ni des outils. |
| `AGENT_CALL_TIMEOUT_MS`                | `300000` (5 minutes)                        | Durée totale maximale d'un appel LLM d'agent (trackers, reformateur HTML et autres agents), appliquée même pendant que la réponse est encore en streaming. Augmente-la pour les modèles locaux lents qui ont besoin de plus de 5 minutes par passage d'agent. Plage valide : `10000`-`3600000`. L'Illustrator conserve au minimum son budget interne de 30 minutes. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 secondes)                       | Durée totale maximale de l'appel au modèle qui transforme la scène de jeu en cours en prompt d'image dynamique. Augmente-la pour les modèles locaux plus lents. Plage valide : `10000`-`3600000`.                                                                                                                             |
| `EMBEDDING_TIMEOUT_MS`                 | `300000` (5 minutes)                        | Temps accordé à une requête d'embedding. Un embedding est une représentation numérique du texte. Une valeur plus élevée aide les serveurs d'embedding locaux lents.                                                                                                                                                          |
| `IMAGE_GEN_TIMEOUT_MS`                 | `1800000` (30 minutes)                      | Temps accordé à une requête de génération d'images.                                                                                                                                                                                                                                                                          |
| `VIDEO_GEN_TIMEOUT_MS`                 | `1800000` (30 minutes)                      | Temps accordé à une requête de génération de vidéo de scène, y compris les workflows vidéo ComfyUI locaux.                                                                                                                                                                                                                   |
| `VIDEO_GEN_MAX_RESPONSE_BYTES`         | `167772160` (160 Mio)                       | Téléchargement de vidéo de scène le plus volumineux que le serveur accepte.                                                                                                                                                                                                                                                  |
| `COMFYUI_GEN_TIMEOUT`                  | `2400` (40 minutes, en secondes)            | Temps accordé à un workflow d'image ComfyUI une fois celui-ci mis en file d'attente.                                                                                                                                                                                                                                         |
| `SPRITE_GENERATION_TIMEOUT_MS`         | reprend la valeur de `IMAGE_GEN_TIMEOUT_MS` | Temps accordé à une tâche de génération de sprite par l'IA.                                                                                                                                                                                                                                                                  |
| `CUSTOM_TOOL_TIMEOUT_MS`               | `60000` (1 minute)                          | Temps accordé à un appel d'outil personnalisé.                                                                                                                                                                                                                                                                               |
| `MAX_TOOL_ROUNDS`                      | `100`                                       | Nombre maximal de tours d'appel d'outils avant que le modèle doive donner une réponse finale.                                                                                                                                                                                                                                |

Les délais d'image, de vidéo, de sprite et de ComfyUI sont figés au démarrage : les modifier demande donc un redémarrage. Les délais de génération de chat, d'agent, de prompt d'image dynamique de Game Mode, d'embedding et d'outil personnalisé s'appliquent dès la requête ou l'exécution d'agent suivante, sans redémarrage. Pour les délais validés de chat, d'agent et de prompt d'image dynamique de Game Mode, une valeur invalide, nulle, négative ou hors plage déclenche un avertissement dans le log et la valeur par défaut documentée est utilisée sans risque. Augmente un délai multimédia quand les tâches volumineuses ou de haute qualité échouent en cours de route. Pour en savoir plus sur les tâches vidéo, consulte [Vidéo de scène](media/scene-video.md).

## API privilégiées (ADMIN_SECRET)

Certaines actions sont destructrices ou à haut risque : elles réclament donc un secret supplémentaire, en plus des contrôles d'accès habituels. C'est le cas des sauvegardes, de l'effacement des données, de l'application des mises à jour et de l'installation de thèmes.

Définis une valeur longue et aléatoire pour `ADMIN_SECRET` sur le serveur :

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

Sur la machine qui exécute le serveur (loopback), ces actions fonctionnent en général sans le secret. Depuis un autre appareil, l'application doit envoyer le secret. Colle la même valeur dans l'application sous **Settings**, puis **Advanced**, puis **Admin Access** (accès administrateur). Ensuite, l'application s'en charge pour toi.

Réglages privilégiés associés :

| Variable                                    | Par défaut            | Ce que ça fait                                                                                                                                                                        |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_SECRET`                              | vide                  | Secret partagé exigé pour les actions privilégiées depuis un appareil distant.                                                                                                        |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false`               | Sur `true`, exige le secret même sur la machine locale.                                                                                                                               |
| `UPDATES_APPLY_ENABLED`                     | `false`               | Autorise le navigateur à appliquer les mises à jour ordinaires du même canal. Un changement de canal de version délibéré, depuis un navigateur ouvert sur la machine du serveur, fonctionne sans cet indicateur. Installations basées sur Git uniquement. |
| `UPDATES_ALLOW_REMOTE_APPLY`                | `false`               | Autorise un appareil distant à appliquer les mises à jour, avec un secret valide.                                                                                                     |
| `HAPTICS_ALLOW_REMOTE`                      | `false`               | Autorise les actions sur un appareil haptique depuis un appareil distant, avec un secret valide.                                                                                      |
| `CUSTOM_TOOL_SCRIPT_ENABLED`                | `false`               | Active les outils de script personnalisés. Laisse-le désactivé pour les outils non fiables ou importés.                                                                               |
| `ENABLE_CUSTOM_AGENT_REPOS`                 | `false`               | Active l'aperçu et la synchronisation manuels d'un dépôt d'agents GitHub dans le gestionnaire d'agents. Les agents tiers ne sont pas vérifiés et demandent une confirmation explicite avant import ou mise à jour. |
| `ENABLE_EXTERNAL_EXTENSIONS`                | `false`               | Première des deux barrières pour l'import d'extensions tierces. L'utilisateur doit aussi donner son accord sous Settings → Advanced → Danger Zone.                                     |
| `IMPORT_ALLOWED_ROOTS`                      | vide                  | Dossiers du système de fichiers que l'import en masse peut lire sans jeton de sélection.                                                                                              |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES`           | `268435456` (256 Mio) | Export JSON de profil le plus volumineux que le serveur peut construire en une fois.                                                                                                  |

Si `ADMIN_SECRET` n'est pas défini sur le serveur, les actions privilégiées échouent depuis tout appareil autre que la machine locale. Le message d'erreur t'invite alors à définir le secret et à le coller dans **Admin Access**.

## Autorisations pour les adresses locales

Par défaut, les requêtes sortantes vers les fournisseurs, les services d'images et les webhooks refusent d'atteindre une adresse privée ou locale. Cela bloque une famille d'attaques appelée SSRF (server-side request forgery), où une requête est détournée vers une adresse interne. Les adresses de fournisseur en loopback restent autorisées, pour que les serveurs de modèles locaux continuent de fonctionner.

Active uniquement l'interrupteur dont tu as besoin pour un service auto-hébergé sur une autre machine du réseau privé.

| Variable                      | Par défaut | Ce que ça fait                                                                       |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false`    | Autorise les URL de fournisseur d'IA à atteindre des adresses privées ou du réseau local. Activé par défaut sur Android. |
| `IMAGE_LOCAL_URLS_ENABLED`    | `false`    | Autorise les URL de fournisseur d'images à atteindre des adresses privées ou du réseau local. L'URL de résultat d'une image générée privée doit malgré tout correspondre exactement à l'origine du fournisseur configuré. |
| `TTS_LOCAL_URLS_ENABLED`      | `false`    | Autorise les URL de Text to Speech (synthèse vocale) à atteindre des adresses privées ou du réseau local. |
| `DEEPLX_LOCAL_URLS_ENABLED`   | `false`    | Autorise les URL de traduction DeepLX à atteindre des adresses privées ou du réseau local. |
| `WEBHOOK_LOCAL_URLS_ENABLED`  | `false`    | Autorise les webhooks d'outils personnalisés à atteindre des adresses privées ou du réseau local. |

Pour connecter un modèle local ou auto-hébergé, consulte [Connecter un modèle local ou auto-hébergé](connections/local-self-hosted.md).

## Référence complète des variables d'environnement

Cette section liste les réglages restants, regroupés par usage. Les tableaux ci-dessus couvrent déjà le contrôle d'accès, le stockage, le log, les délais d'expiration, les actions privilégiées et les autorisations pour les adresses locales.

### Serveur et démarrage

| Variable                         | Par défaut                                       | Ce que ça fait                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                           | `7860`                                           | Le port sur lequel le serveur écoute. Garde la même valeur sur Android, Docker et Termux.                                                                                                                                                                                                                                                                                                                                                                                        |
| `HOST`                           | `127.0.0.1` (`0.0.0.0` dans les lanceurs shell)  | L'interface réseau à écouter. Utilise `0.0.0.0` pour un accès depuis le réseau local.                                                                                                                                                                                                                                                                                                                                                                                            |
| `MARINARA_ANDROID_SECRET`        | vide                                             | Secret interne d'authentification locale pour les installations Termux gérées par l'APK. Ce n'est pas une donnée à saisir dans l'installateur : l'enveloppe Android le génère et le transmet, puis le lanceur Termux l'exporte automatiquement. Ne demande pas aux utilisateurs de l'APK de le fournir et ne le définis pas pour les installations de bureau ordinaires ou Termux manuelles. Lorsqu'il est défini, il doit comporter exactement 64 caractères hexadécimaux. Une valeur non vide incorrecte fait échouer les requêtes locales de l'appareil avec HTTP 503 au lieu d'affaiblir l'authentification. |
| `MARINARA_ANDROID_SECRET_FILE`   | `~/.marinara-engine/android-secret`             | Chemin du fichier de secret privé utilisé par le lanceur Termux et la CLI `mari` locale. L'APK et le lanceur gèrent ce fichier automatiquement ; un utilisateur normal de l'APK n'a jamais besoin de le lire ni de le copier. |
| `AUTO_OPEN_BROWSER`              | `true`                                           | Détermine si les lanceurs shell ouvrent l'URL de l'application à ta place. Mets `false` pour l'empêcher. La configuration gérée par l'APK désactive l'ouverture automatique du navigateur pour ce lancement afin que l'application Android déjà authentifiée se connecte à la place. |
| `AUTO_UPDATE_ENABLED`            | `true`                                           | Détermine si les lanceurs Windows, macOS/Linux et Termux basés sur Git récupèrent et appliquent les mises à jour du moteur avant le démarrage. Mets `false` pour un refus durable ; le changement prend effet au lancement suivant. Le lanceur continue de vérifier, en lecture seule, l'existence de versions publiées plus récentes et affiche un rappel de téléchargement le cas échéant, tandis que les vérifications manuelles, la mise à jour depuis l'application, les mises à jour de packages et de modèles restent disponibles. Utilise `--skip-update` pour ignorer les deux vérifications du lanceur pour un seul démarrage. |
| `MARINARA_ENV_FILE`              | fichier `.env` à la racine du projet             | Chemin de remplacement facultatif pour le fichier `.env`. À définir avant le démarrage.                                                                                                                                                                                                                                                                                                                                                                                          |
| `TZ`                             | valeur système par défaut                        | Fuseau horaire de repli de l'hôte pour les tâches côté serveur. Les emplois du temps de Conversation utilisent le fuseau horaire global choisi dans leurs commandes d'emploi du temps, dès qu'un fuseau a été enregistré. Laisse `TZ` non défini pour hériter du fuseau horaire de l'hôte ; un `TZ=` vide équivaut aussi à non défini.                                                                                                                                            |
| `CORS_ORIGINS`                   | `http://localhost:5173,http://127.0.0.1:5173`    | Origines de navigateur autorisées à faire des requêtes multi-origines.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true`                                           | Indicateur hérité. Les versions actuelles n'embarquent aucune clé de démarrage : ce réglage ne crée donc rien. Ajoute ta propre connexion dans l'application.                                                                                                                                                                                                                                                                                                                    |

`AUTO_CREATE_DEFAULT_CONNECTION` n'est conservé que pour les anciennes installations. Les nouvelles versions ne livrent plus de connexion de démarrage intégrée : le laisser activé ne fait donc rien. Pour commencer à discuter, ajoute une connexion en suivant [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md).

Les commandes d'emploi du temps de Conversation utilisent par défaut le fuseau horaire signalé par le navigateur ou l'appareil. Le réglage **Schedule timezone** (fuseau horaire de l'emploi du temps) se change pendant la configuration d'une Conversation, dans les **Chat Settings** (réglages du chat) d'une Conversation, ou dans l'éditeur d'emploi du temps du personnage. Le fuseau horaire IANA sélectionné est une préférence globale unique, partagée par tous les chats en mode Conversation et synchronisée avec les autres clients Marinara connectés au même serveur.

### Outils de médias et de sprites

| Variable                            | Par défaut            | Ce que ça fait                                                                                                                                                             |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FFMPEG_PATH`                       | vide                  | Chemin vers un programme `ffmpeg`. Sert aux GIF d'expression animés. À défaut, le `ffmpeg` de ton PATH est utilisé.                                                         |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 minutes)  | Temps accordé pour convertir un clip d'expression animé.                                                                                                                   |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE`  | `auto`                | Moteur de nettoyage des sprites. `auto` tente d'abord le détourage adaptatif avant le repli facultatif par l'IA ; `builtin` ne garde que la méthode par détourage ; `backgroundremover` impose l'outil d'IA. |
| `BACKGROUNDREMOVER_AUTO_INSTALL`    | `false`               | Sur `true`, installe au lancement l'outil facultatif de suppression d'arrière-plan par l'IA.                                                                                |
| `BACKGROUNDREMOVER_COMMAND`         | vide                  | Chemin vers un programme `backgroundremover` du système.                                                                                                                   |
| `BACKGROUNDREMOVER_PYTHON`          | vide                  | Chemin vers un programme Python où `backgroundremover` est installé.                                                                                                       |
| `BACKGROUNDREMOVER_TIMEOUT_MS`      | `600000` (10 minutes) | Temps accordé à un appel de suppression d'arrière-plan par l'IA.                                                                                                           |

### Fournisseurs de vidéo de scène

Les fournisseurs de vidéo de scène se configurent comme des connexions dans l'application, pas par des variables d'environnement. Les réglages ci-dessous ne font qu'ajuster les tâches sous-jacentes. Toutes les valeurs sont en millisecondes.

| Variable                            | Par défaut | Ce que ça fait                                                                                 |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000`    | Fréquence à laquelle le serveur vérifie une tâche Google Veo.                                  |
| `XAI_VIDEO_POLL_INTERVAL_MS`        | `5000`     | Fréquence à laquelle le serveur vérifie une tâche xAI Imagine.                                 |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000`    | Fréquence à laquelle le serveur vérifie une tâche vidéo OpenRouter.                            |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS`   | `10000`    | Fréquence à laquelle le serveur vérifie une tâche Seedance.                                    |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL`   | vide       | Adresse HTTPS publique de ce serveur, utilisée quand un fournisseur doit récupérer une image de référence par URL. |

### Intégrations et extras

| Variable                          | Par défaut                                   | Ce que ça fait                                                                     |
| --------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `DOCS_I18N_BASE_URL`              | branche `docs-i18n` officielle               | Emplacement de téléchargement des packs de documentation traduite (Settings → General → Documentation Language). Doit être un hôte `https://` public ; les forks et miroirs peuvent le pointer vers leur propre copie de la branche `docs-i18n`. |
| `GIPHY_API_KEY`                   | vide                                         | Clé Giphy pour la recherche de GIF en mode Conversation. La recherche est inactive tant qu'elle n'est pas définie. |
| `INTIFACE_URL`                    | `ws://127.0.0.1:12345`                       | Adresse par défaut de l'application haptique Intiface.                              |
| `SPOTIFY_REDIRECT_URI`            | déduite de la requête                        | Remplace l'URL de rappel de connexion Spotify. À définir quand le TLS est géré en amont. |
| `MARI_WIKI_CONTENT_MAX_BYTES`     | `50000`                                      | Taille maximale du contenu d'une page de wiki que Professor Mari lit avant de le rogner. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS`    | `30000`                                      | Temps accordé à une requête wiki de Professor Mari.                                |
| `MARI_WIKI_CACHE_TTL_MS`          | `300000`                                     | Durée pendant laquelle Professor Mari met en cache une lecture de wiki.            |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (le lanceur Windows le met à `true`) | Autorise l'installation du runtime de modèle local sans en-tête administrateur en loopback. |
| `SSL_CERT`                        | vide                                         | Chemin vers un certificat TLS. Voir la section Contrôle d'accès ci-dessus.         |
| `SSL_KEY`                         | vide                                         | Chemin vers une clé privée TLS. Voir la section Contrôle d'accès ci-dessus.        |

Côté clé Giphy, retiens que la recherche de GIF reste indisponible tant que tu n'as pas défini `GIPHY_API_KEY` et redémarré. Pour le modèle local intégré, consulte [Configurer un modèle local](connections/local-model.md).

## Guides associés

- [Accès distant : Basic Auth et liste d'autorisation d'adresses IP](REMOTE_ACCESS.md)
- [Où sont stockées tes données](data/where-data-is-stored.md)
- [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md)
- [Vidéo de scène](media/scene-video.md)
- [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md)
