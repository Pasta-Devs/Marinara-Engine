# Référence de configuration du serveur

Ce guide liste les réglages du serveur que tu peux modifier avec des variables d'environnement, c'est-à-dire des réglages que le serveur lit dans un fichier texte simple nommé `.env`. Marinara fonctionne sans aucune configuration. La plupart des gens n'en ont besoin que pour laisser d'autres appareils se connecter, protéger un serveur partagé, déplacer le dossier de données, rendre le log – le journal du serveur – plus détaillé ou laisser plus de temps aux tâches lentes.

Tes comptes d'IA, tes personnages et tes options de chat se règlent dans l'application. Pour ajouter un compte d'IA, consulte [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md).

<a id="edit-the-env-file"></a>

## Modifier le fichier .env

Marinara crée un fichier `.env` vide au premier démarrage. Chaque ligne a la forme `KEY=value`. Les lignes qui commencent par `#` sont des commentaires.

| Installation | Où se trouve `.env` |
| --- | --- |
| Installation normale | Le dossier racine du projet |
| Image Docker ou Podman officielle | `/app/data/.env`, dans le même volume que tes données |

1. Ouvre `.env.example` dans le même dossier. Il liste chaque réglage avec sa valeur par défaut.
2. Copie la ligne voulue dans `.env`.
3. Change la valeur après `=` et enregistre le fichier.

```text
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

`.env` contient des données, ce n'est pas un script shell. Marinara n'exécute ni `$`, ni `$(...)`, ni aucune autre syntaxe shell dans une valeur. Une valeur déjà définie dans l'environnement du lanceur l'emporte sur la même entrée de `.env`.

Le serveur lit `.env` quelle que soit la façon dont tu le démarres. Les lanceurs (`start.bat`, `start.sh`, `start-termux.sh`) définissent aussi `HOST=0.0.0.0` pour que les autres appareils puissent se connecter, et ouvrent ton navigateur une fois le serveur prêt. `AUTO_OPEN_BROWSER=false` empêche cette ouverture. Avec `pnpm start` seul, le serveur n'écoute que sur cet ordinateur, sauf si tu définis `HOST`.

<a id="restart-or-hot-reload"></a>

## Redémarrage ou rechargement à chaud

Marinara surveille `.env` pendant son exécution. La plupart des réglages s'appliquent presque aussitôt, sans redémarrage. Le log affiche une ligne `[env-watcher]` à chaque changement. Si la surveillance ne peut pas démarrer, le serveur vérifie le fichier toutes les 30 secondes et l'indique dans le log.

Si tes modifications ne sont pas prises en compte, par exemple quand tu modifies le fichier depuis une autre machine ou dans un montage lié (bind mount) de conteneur, définis `MARINARA_ENV_WATCH=poll`. Pour désactiver la surveillance, définis `MARINARA_ENV_WATCH=0`. Ce sont deux options avancées.

Ces réglages ne sont lus qu'au démarrage. En changer un demande un redémarrage, et le log te prévient :

- `PORT`, `HOST`, `SSL_CERT` et `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`, `ENCRYPTION_KEY` et `MARINARA_EAGER_STORAGE`
- `MARINARA_ENV_FILE`, `MARINARA_ENV_WATCH` et `TZ`
- `AUTO_OPEN_BROWSER` et `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING` et `LOG_FORMAT`
- `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` et `SHUTDOWN_FORCE_EXIT_ON_REPEAT`
- Les délais d'expiration et les réglages d'interrogation pour l'image, la vidéo, les sprites et ComfyUI : `IMAGE_GEN_TIMEOUT_MS`, `IMAGE_GEN_MAX_RESPONSE_BYTES`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT` et les quatre réglages `*_VIDEO_POLL_INTERVAL_MS`

Les lanceurs lisent `AUTO_UPDATE_ENABLED` avant le démarrage du serveur. Une modification s'applique donc à partir du lancement suivant, et le log ne te prévient pas.

Les réglages de contrôle d'accès et les secrets (`BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET`, `CSRF_TRUSTED_ORIGINS`) n'ont pas besoin de redémarrage.

<a id="access-control"></a>

## Contrôle d'accès

Le contrôle d'accès décide qui peut joindre un serveur en cours d'exécution. Pour une marche à suivre et des exemples, consulte [Accès à distance : connexion et liste d'autorisation d'IP](REMOTE_ACCESS.md).

Tu peux aussi définir la connexion sans `.env` : utilise **Settings → Advanced → Access** (Paramètres → Avancé → Accès) dans un navigateur déjà connecté, ou le code de configuration à usage unique affiché dans le log du serveur. Le serveur n'affiche ce code que tant qu'aucune connexion n'est définie et qu'il écoute au-delà du loopback. La connexion est enregistrée dans `DATA_DIR/.remote-login.json`. `node scripts/reset-login.mjs` (à lancer dans le dossier de Marinara) la supprime et déconnecte chaque navigateur. Une connexion définie dans `.env` l'emporte. Pour modifier ou supprimer la connexion, il faut le mot de passe actuel. Pour les proxys de connexion, consulte [Proxys de connexion (forward auth)](REMOTE_ACCESS.md#login-proxies-forward-auth).

Termes employés ci-dessous :

- **Loopback** : l'ordinateur sur lequel tourne le serveur, à l'adresse `127.0.0.1` ou `localhost`.
- **Plage CIDR** : une façon abrégée d'écrire un bloc d'adresses IP, comme `192.168.1.0/24`.
- **Basic Auth** : un nom d'utilisateur et un mot de passe envoyés avec chaque requête. Les scripts et les clients d'API l'utilisent, et les navigateurs utilisent la page `/login`. Ces identifiants sont encodés, pas chiffrés : utilise donc le HTTPS sur un serveur public.

Sans connexion définie, le serveur n'accepte que les sources de confiance : le loopback, les adresses de `IP_ALLOWLIST`, Tailscale et le trafic du pont Docker sur le même hôte. Tous les autres, y compris ton réseau domestique, reçoivent `403 Forbidden`. Pour que d'autres appareils puissent tout simplement se connecter, le serveur doit écouter sur une adresse joignable : définis `HOST=0.0.0.0`.

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `BASIC_AUTH_USER` | vide | Nom d'utilisateur de connexion. À définir avec `BASIC_AUTH_PASS`. |
| `BASIC_AUTH_PASS` | vide | Mot de passe de connexion. Laisse l'un des deux vide pour désactiver la connexion. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Nom du realm dans le défi Basic Auth. |
| `IP_ALLOWLIST` | vide | Adresses IP ou plages CIDR séparées par des virgules, toujours autorisées. Le loopback direct est toujours autorisé. Un reverse proxy sur la même machine ne l'est pas. |
| `IP_ALLOWLIST_ENABLED` | `true` | `false` garde la liste mais cesse de l'appliquer. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | Autorise l'accès sans mot de passe depuis les réseaux privés quand aucune connexion n'est définie. Exclut `100.64.0.0/10`, que les fournisseurs d'accès partagent entre leurs clients. Ajoute cette plage à `TRUSTED_PRIVATE_NETWORKS` seulement si tu lui fais confiance. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | Autorise l'accès sans mot de passe depuis n'importe quelle adresse, y compris internet. Déconseillé. |
| `TRUSTED_PRIVATE_NETWORKS` | plages intégrées | Remplace les plages privées par défaut. Pense à y inclure les plages par défaut que tu veux garder. |
| `BYPASS_AUTH_TAILSCALE` | automatique | Vide : un appareil ne saute la connexion que s'il se connecte directement à l'adresse Tailscale de cet ordinateur. Tailscale Serve, Funnel ou un autre proxy exigent toujours une connexion. `true` : ancien contournement de toute la plage `100.64.0.0/10`. `false` : contrôle d'accès normal. |
| `BYPASS_AUTH_DOCKER` | automatique | Vide : ne fait confiance qu'à une interface de conteneur détectée et à sa passerelle, et seulement tant qu'aucune connexion, aucun `IP_ALLOWLIST` ni aucun `TRUSTED_AUTH_PROXY` n'est défini. `true` : réseaux anciens ou personnalisés. `false` : contrôle d'accès normal. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | Exige la connexion ou la liste d'autorisation pour le trafic Docker qu'un proxy relaie. Ne mets `false` que si le proxy lui-même fait connecter chaque visiteur. |
| `REQUIRE_AUTH_FOR_LOOPBACK_PROXY` | `true` | Traite comme distantes les requêtes transmises par un proxy ou un tunnel sur la même machine, y compris en HTTP/1.0, comme le `proxy_pass` par défaut de nginx. Ne mets `false` que si le proxy lui-même fait connecter chaque visiteur. |
| `TRUSTED_AUTH_PROXY` | vide | IP ou plages CIDR d'un proxy forward auth (tinyauth, Authelia, Authentik, oauth2-proxy) qui fait connecter chaque visiteur. Ses requêtes passent outre la connexion et `IP_ALLOWLIST`. Il doit protéger chaque chemin, et Marinara ne doit pas être joignable en le contournant. |
| `TRUSTED_HOSTS` | vide | Noms d'hôte publics ou de proxy supplémentaires auxquels Marinara répond, comme `chat.example.com`. Les IP directes, `localhost`, `.local`, `.home.arpa` et les noms LAN à étiquette unique fonctionnent sans. Les noms présents dans `CSRF_TRUSTED_ORIGINS` ou `CORS_ORIGINS` sont aussi acceptés. |
| `SSL_CERT` | vide | Chemin vers un certificat TLS. À définir avec `SSL_KEY` pour servir directement en HTTPS. |
| `SSL_KEY` | vide | Chemin vers la clé privée TLS. |
| `CSRF_TRUSTED_ORIGINS` | vide | Origines de navigateur supplémentaires autorisées à enregistrer des modifications, pour un domaine public ou un port inhabituel. La valeur littérale `null` est ignorée, y compris pour l'APK Android. |

> **Avertissement :** une large plage publique dans `IP_ALLOWLIST`, comme `0.0.0.0/0`, peut laisser entrer des clients d'internet sans connexion. N'indique que des adresses de confiance.

## Stockage

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | Dossier racine de toutes les données utilisateur. Les images Docker utilisent `/app/data`. |
| `FILE_STORAGE_DIR` | `storage` dans `DATA_DIR` | Remplace le dossier de stockage des fichiers. |
| `ENCRYPTION_KEY` | vide | Clé qui chiffre les clés API enregistrées. |
| `MARINARA_MAX_RESIDENT_CHATS` | `0` (illimité) ; `8` sur SteamOS et Termux | Nombre maximal de chats gardés en mémoire en même temps. Au-delà de cette limite, le chat le moins récemment utilisé qui n'a aucune modification non enregistrée est retiré de la mémoire (jamais du disque) après chaque enregistrement. Un texte invalide revient à la valeur par défaut de la plateforme. Les valeurs positives inférieures à `2` deviennent `2`. `0` désactive ce retrait de la mémoire. |
| `MARINARA_EAGER_STORAGE` | désactivé | `1` charge tous les chats au démarrage, comme avant la version 2.4.5. Consomme beaucoup plus de mémoire sur les gros profils. Demande un redémarrage. |

Génère une clé de chiffrement et colle-la dans `ENCRYPTION_KEY` :

```bash
openssl rand -hex 32
```

Marinara conserve tes données sous forme de simples fichiers JSON : tu peux donc copier et lire tes sauvegardes. Pour savoir ce que contient chaque dossier, consulte [Où Marinara enregistre tes données](data/where-data-is-stored.md).

<a id="logging-levels"></a>

## Niveaux de log

`LOG_LEVEL` définit la quantité d'informations que le serveur affiche. Il masque tout ce qui se situe sous le niveau choisi.

| Niveau | Ce que ça affiche |
| --- | --- |
| `error` | Uniquement les échecs graves. |
| `warn` | Les erreurs et les avertissements. C'est la valeur par défaut. |
| `info` | Ajoute les logs de démarrage et de chaque requête. |
| `debug` | Tout, y compris les prompts complets – les textes que Marinara envoie à l'IA – et les réponses du modèle. Produit beaucoup de texte. |

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `LOG_LEVEL` | `warn` | Le niveau ci-dessus. |
| `LOG_PRESET` | `default` | `prompt-connections` affiche le même détail de prompt et de modèle que `debug`, mais masque les lignes de requête de routine comme `GET /api/chats`. |
| `LOG_DISABLE_REQUEST_LOGGING` | `false` | `true` masque les lignes de requête de routine et garde ton niveau. Demande un redémarrage. |
| `LOG_FORMAT` | automatique | `pretty` affiche des lignes lisibles partout, par exemple pour lire les prompts affichés par **Debug mode** (mode débogage) dans `docker logs`. `json` affiche un objet JSON par ligne. Demande un redémarrage. |

Dans un terminal, le serveur affiche des lignes lisibles. Ailleurs, par exemple dans les logs Docker, un serveur de production affiche des lignes JSON. Le lanceur Termux demande des lignes lisibles. Le log du navigateur est séparé et ne dépend pas de `LOG_LEVEL`.

## Délais d'expiration

Un délai d'expiration est la durée maximale pendant laquelle le serveur attend une tâche lente. Ouvre **Settings → Advanced → Request timeouts** (Paramètres → Avancé → Délais des requêtes) pour modifier, en secondes, les limites du texte, des agents, des prompts d'images Game, des images, des vidéos, de ComfyUI et des embeddings (des représentations numériques du texte). Des limites plus élevées aident les backends locaux lents. Elles ne peuvent pas contourner une limite fixée par le service. L'enregistrement demande l'accès d'administration du serveur.

Ces réglages s'appliquent à tous les profils et sont enregistrés à côté du `.env` actif, sous le nom `.env.timeouts.json` (ou `<custom-env-path>.timeouts.json`). Ils remplacent les variables correspondantes sans modifier `.env`. Les changements pour le texte, les agents, les prompts d'images Game et les embeddings s'appliquent aux nouvelles requêtes. Les changements pour les médias et les packages d'agents installés demandent un redémarrage. Pour revenir aux variables, supprime ce fichier et redémarre.

Les valeurs sont en millisecondes, sauf si le nom indique autre chose. Pour les délais validés du chat, des agents et des prompts d'images Game, une valeur invalide, nulle, négative ou hors plage déclenche un avertissement dans le log, et la valeur par défaut est utilisée. Pour en savoir plus sur les tâches vidéo, consulte [Vidéo de scène](media/scene-video.md).

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000` (5 min) | Temps jusqu'au premier token et intervalle entre deux fragments pour les réponses Conversation, Roleplay et Game. Un token est un petit morceau de texte. C'est aussi le budget des tâches d'arrière-plan qui n'ont pas de délai propre (Professor Mari, actualisation de Noodle, réponses de Slurp). Plage : `10000`-`3600000`. Ne change pas les délais des agents, des médias, des embeddings ni des outils. |
| `AGENT_CALL_TIMEOUT_MS` | `300000` (5 min) | Durée maximale sans données avant ou pendant un appel de modèle d'agent, y compris les agents téléchargeables. Les données reçues renouvellent ce délai. Plage : `10000`-`3600000`. L'Illustrator garde au minimum son budget d'inactivité intégré de 30 minutes. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 s) | Durée totale maximale de l'appel au modèle qui transforme une scène de Game en prompt d'image. Plage : `10000`-`3600000`. |
| `EMBEDDING_TIMEOUT_MS` | `300000` (5 min) | Temps accordé à une requête d'embedding. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000` (30 min) | Temps accordé à une requête de génération d'image. |
| `IMAGE_GEN_MAX_RESPONSE_BYTES` | `31457280` (30 Mio) | Taille maximale de réponse d'image acceptée. Augmente-la quand un ComfyUI local intègre de volumineuses métadonnées. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000` (30 min) | Temps accordé à une requête de vidéo de scène, y compris les workflows vidéo ComfyUI. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160` (160 Mio) | Taille maximale de téléchargement de vidéo de scène acceptée. |
| `COMFYUI_GEN_TIMEOUT` | `2400` (40 min, en secondes) | Temps accordé à un workflow d'image ComfyUI une fois mis en file d'attente. |
| `SPRITE_GENERATION_TIMEOUT_MS` | `IMAGE_GEN_TIMEOUT_MS` | Temps accordé à une tâche de sprite par l'IA. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000` (1 min) | Temps accordé à un appel d'outil personnalisé. |
| `MAX_TOOL_ROUNDS` | `100` | Nombre maximal de tours d'appel d'outils avant que le modèle doive répondre. Un tour de Game en a au plus 4, un agent 16 et un rattrapage de lorebook 64, ou cette valeur si elle est plus basse. |

## API privilégiées (ADMIN_SECRET)

Les actions destructrices ou risquées, comme les sauvegardes, l'effacement des données, l'application des mises à jour et l'installation de thèmes, demandent un secret supplémentaire en plus des contrôles d'accès habituels. Tu peux en créer un dans **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur) sur l'ordinateur du serveur lui-même (voir [Admin Access](REMOTE_ACCESS.md#admin-access-and-privileged-actions)), ou définir une valeur longue et aléatoire sur le serveur :

```text
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

Sur l'ordinateur du serveur lui-même, ces actions fonctionnent en général sans le secret. Une requête transmise par un proxy ou un tunnel sur cet ordinateur compte comme distante, sauf avec `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`. Les requêtes directes depuis un autre appareil demandent le secret. Colle la même valeur dans **Settings → Advanced → Admin Access**, et l'application l'envoie pour toi. `ADMIN_SECRET` dans `.env` l'emporte sur un secret créé dans l'application. Sans secret d'administration, les actions privilégiées échouent depuis tout appareil autre que l'ordinateur du serveur, et le message d'erreur t'indique d'en définir un. Les agents installés fonctionnent depuis tout appareil connecté avec la connexion ; les installer, les mettre à jour et les supprimer demande le secret.

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `ADMIN_SECRET` | vide | Secret pour les actions privilégiées depuis des appareils distants. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | `true` exige aussi le secret sur l'ordinateur du serveur. |
| `UPDATES_APPLY_ENABLED` | `false` | Autorise le navigateur à appliquer les mises à jour du même canal (**Apply Update**, appliquer la mise à jour). Un changement de canal de publication depuis un navigateur sur l'ordinateur du serveur fonctionne sans. Installations Git uniquement. |
| `UPDATES_APPLY_DISABLED` | non défini | Refuse toute application de mise à jour côté serveur, y compris le changement de canal. L'emporte sur `UPDATES_APPLY_ENABLED`. Les lanceurs de développement et e2e le définissent. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | Autorise un appareil distant à appliquer les mises à jour, avec un secret valide. |
| `HAPTICS_ALLOW_REMOTE` | `false` | Autorise un appareil distant à lancer des actions haptiques, avec un secret valide. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | Active les outils de script personnalisés. Laisse-le désactivé pour les outils non fiables ou importés. |
| `MARI_DB_ALLOW_UNSAFE_TRANSFORMS` | `false` | Autorise les scripts de transformation de base de données de Professor Mari à s'exécuter sur les hôtes sans bac à sable du système (Seatbelt de macOS ou Bubblewrap de Linux, utilisés quand ils sont présents). Laisse-le désactivé, sauf si tu as relu le script. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Active l'aperçu et la synchronisation manuels de dépôts d'agents GitHub dans Agent Organizer. Voir [Dépôts d'agents personnalisés](#custom-agent-repositories). |
| `MARINARA_OVERWORLD_GAMES` | `false` | Permet aux joueurs de créer des parties Overworld (un kit d'univers et un monde généré) et de convertir une ancienne partie en partie Overworld. Désactivé, l'assistant ne propose que des parties Classic. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | Première des deux barrières pour l'import d'extensions tierces. Voir [Extensions externes](#external-extensions). |
| `IMPORT_ALLOWED_ROOTS` | vide | Dossiers que l'import en masse peut lire sans jeton de sélection. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456` (256 Mio) | Taille maximale d'un export JSON de profil que le serveur construit en une fois. |

## Autorisations pour les adresses locales

Par défaut, les requêtes sortantes vers les services d'IA, les services d'images et les webhooks refusent les adresses privées ou locales. Cela bloque la SSRF (server-side request forgery), où une requête est détournée vers une adresse interne. Les serveurs de modèles en loopback fonctionnent toujours. N'active que l'interrupteur dont tu as besoin pour un service auto-hébergé sur une autre machine du réseau privé.

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | Les URL de services d'IA peuvent atteindre des adresses privées ou du réseau local. Activé par défaut sur Android. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | Les URL de services d'images peuvent atteindre des adresses privées ou du réseau local. Les URL de résultat privées doivent quand même correspondre exactement à l'origine du service. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | Les URL de synthèse vocale peuvent atteindre des adresses privées ou du réseau local. |
| `STT_LOCAL_URLS_ENABLED` | `false` | L'URL du serveur Speech to text (reconnaissance vocale) peut atteindre des adresses privées ou du réseau local. Un serveur sur la même machine fonctionne sans. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | Les URL de traduction DeepLX peuvent atteindre des adresses privées ou du réseau local. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | Les webhooks d'outils personnalisés peuvent atteindre des adresses privées ou du réseau local. |

Pour connecter un modèle local ou auto-hébergé, consulte [Connecter un modèle local ou auto-hébergé](connections/local-self-hosted.md).

<a id="feature-switches"></a>

## Interrupteurs de fonctions

Les comportements facultatifs du serveur, comme réessayer les appels fournisseur échoués ou garder stables les choix des groupes de lorebook, se trouvent dans **Settings → Advanced → Features** (Paramètres → Avancé → Fonctions). Tous sont désactivés par défaut. Quelques-uns ont une variable qui l'emporte sur l'interrupteur lorsqu'elle est définie. Voir [Interrupteurs de fonctions](configuration/features.md).

<a id="marinara-notices"></a>

## Avis de Marinara

Les avis sont de courts avertissements des mainteneurs, par exemple sur un problème de sécurité ou une étape manuelle que ta version exige. Ils s'affichent sous forme de bandeau.

- Au démarrage, puis toutes les heures, le serveur télécharge un petit fichier, `notices.json`, depuis la branche `notices` du dépôt Marinara Engine. Il ne garde que les avis qui visent ta version. Ton navigateur demande ces avis à ton propre serveur une fois au chargement de la page, puis toutes les heures.
- Si un téléchargement échoue, le serveur garde les avis qu'il a déjà et le démarrage n'est pas retardé.
- La requête n'envoie aucune donnée sur toi, tes chats ou tes réglages. Seuls les mainteneurs peuvent modifier la branche `notices`, et chaque modification est relue.
- Un avis est du texte brut, avec une limite de taille. Les liens ne sont conservés que s'ils pointent vers `https://github.com/Pasta-Devs/`. Un avis ne peut rien installer, exécuter ni modifier.
- Toi seul vois les avis : sur l'ordinateur du serveur, depuis une adresse de `IP_ALLOWLIST`, ou après ta connexion. Les autres visiteurs reçoivent une liste vide.

Pour désactiver les avis, définis `MARINARA_NOTICES_ENABLED=false`.

> **Avertissement :** sans les avis, Marinara ne peut pas t'informer des correctifs de sécurité ni des étapes requises. Surveille toi-même les [versions GitHub](https://github.com/Pasta-Devs/Marinara-Engine/releases).

Les forks peuvent faire pointer `MARINARA_NOTICES_URL` vers leur propre fichier.

<a id="optional-multiplayer"></a>

## Multijoueur facultatif

Le multijoueur est désactivé par défaut. Il permet de partager un salon privé Conversation, Roleplay ou Game sans plafond fixe de participants. Chaque invité utilise sa propre installation Marinara de confiance. Les invités n'ont besoin d'aucun compte d'IA. L'hôte fournit les comptes d'IA et peut lire et conserver les contenus partagés. Tant que l'une des deux barrières est fermée, Marinara n'effectue aucune vérification de session, de certificat ou de pair en arrière-plan.

1. Définis `MULTIPLAYER_ENABLED=true` dans le `.env` de chaque installation Marinara participante et redémarre-la. Seule la valeur exacte `true` fonctionne, et le rechargement à chaud ne l'applique pas.
2. Ouvre **Settings → Advanced → Multiplayer** (Paramètres → Avancé → Multijoueur), lis l'avertissement et active le réglage. Cela ne lance aucune écoute et ne rejoint aucun salon.
3. Pour héberger, utilise **Create shared session** (créer une session partagée) ou **Play together** (jouer ensemble) dans le parcours de mode ou de configuration. Vérifie la configuration, ton nom affiché et le texte de persona que tu partages. Un chat existant ne partage que ses choix de configuration, jamais son historique, ses notes ni ses souvenirs.
4. Sur l'hôte, définis `SSL_CERT` et `SSL_KEY` pour un certificat valide pour le nom d'hôte du salon et reconnu par les invités. Choisis une adresse HTTPS et un port distincts pour le salon, par exemple `https://room.example.org:7861`. L'action d'hébergement ouvre ce port. Ne fais passer que le port du salon par ton pare-feu ou ton routeur. N'expose pas l'API normale de Marinara. Aucune redirection de port, aucun relais ni aucun contournement de certificat n'est configuré pour toi.
5. Définis un mot de passe de salon d'au moins 12 caractères, différent de tes identifiants d'administration. Envoie séparément l'invitation à durée limitée et le mot de passe à des personnes de confiance. L'invité vérifie l'empreinte liée au nom d'hôte, le nom du salon et le texte de persona, puis demande à entrer. L'hôte approuve chaque demande dans **Players** (joueurs) avant tout envoi d'historique.

Limites et comportement :

- TLS vérifie la chaîne du certificat et le nom d'hôte, ainsi que l'empreinte du certificat de l'invitation, avant l'envoi d'un mot de passe. Les certificats autosignés ne sont pas acceptés silencieusement. Un certificat renouvelé demande une nouvelle invitation.
- Les invitations expirent après 30 minutes. Les sessions admises durent au plus 12 heures. Le remplacement ou la révocation met fin aux invitations inutilisées. **Kick** (expulser) retire un invité admis.
- L'hôte contrôle les réponses automatiques ou manuelles, **Pause**/**Resume** (mettre en pause/reprendre) et **Stop** (arrêter). L'allocation par défaut est de 100 tours de génération coordonnée par session d'hébergement. Un tour de groupe ou la configuration de Game peut faire plus d'un appel au modèle. C'est une limite de tours, pas une estimation de prix.
- Dans Game, vérifie l'équipe avant **Start Game** (démarrer la partie). Chaque joueur requis soumet une action ou passe, et le GM (Game Master, le maître du jeu) résout le tour quand tous sont prêts. Un joueur déconnecté reste requis jusqu'à son retour ou jusqu'à ce que l'hôte le fasse passer ou le retire. Les tours suspendus ou interrompus ne répètent jamais d'eux-mêmes une requête payante ni des effets déjà enregistrés sur le monde.
- **Stop**, **Leave** (quitter), la désactivation du réglage et un redémarrage du serveur terminent la session en cours. Un redémarrage n'héberge ni ne rejoint jamais de lui-même.
- Les outils personnalisés et de packages ainsi que les commandes dangereuses restent indisponibles dans les salons. Les invités n'exécutent jamais de planificateur ni de commandes locales à partir du texte reçu. Les emplois du temps de Conversation utilisent le planificateur de l'hôte.
- Les nouveaux joueurs et les changements de persona prennent effet au tour suivant.
- Les salons ne transportent que du texte de taille limitée. Il n'y a aucun transfert de fichiers, de médias, d'extensions ni de packages. L'enveloppe Android native ne peut pas rejoindre de salon.

> **Avertissement :** ne te connecte qu'à des personnes de confiance, et utilise ton propre client Marinara. N'installe jamais un client, une extension ou un fichier fourni par l'hôte. L'hôte peut lire ce que tu partages, et le contenu partagé peut être envoyé à ses services d'IA. Les connexions directes révèlent les adresses réseau. Ne partage ni mots de passe, ni clés API, ni informations personnelles. Quitte immédiatement le salon si quelque chose semble anormal.

Pour les restrictions exactes et les plateformes testées, consulte le [registre de compatibilité et de vérification](development/multiplayer.md). En cas de problème, consulte [Résoudre les problèmes](TROUBLESHOOTING.md#multiplayer-connection-or-turn-problems).

## Agents et extensions

Installe les agents officiels facultatifs dans l'application : **Agents → Agent Organizer** (Agents → organisateur d'agents). Marinara choisit le catalogue [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) qui correspond à sa version majeure.

- **Mises à jour :** Marinara demande avant de télécharger une nouvelle version d'un package installé. **Not now** (pas maintenant) garde la version actuelle et laisse **Update** (mettre à jour) disponible dans Agent Organizer. Une installation neuve n'a aucun package.
- **Emplacement des packages :** `DATA_DIR/capability-packages`. Les volumes Docker, les dossiers de données personnalisés, les sauvegardes et les mises à jour normales les conservent. C'est valable sur ordinateur, sous Docker et sur Termux. iOS et les autres navigateurs utilisent les packages de leur serveur hôte.
- **Espace disque :** Marinara garde la version actuelle et la version précédente de chaque package, et supprime les versions plus anciennes ainsi que les copies temporaires de `DATA_DIR/capability-runtime-snapshots`. Les données des packages ne sont jamais supprimées.
- **Hors ligne :** les packages installés continuent de fonctionner dans leur version quand GitHub est injoignable, qu'une mise à jour est refusée ou que la vérification échoue.

### Import d'agents personnalisés

Les fichiers, dossiers et dépôts d'agents externes sont verrouillés. Pour les autoriser, active **Allow custom Agent imports** (autoriser l'import d'agents personnalisés) dans **Settings → Advanced → Danger Zone** (Paramètres → Avancé → Zone de danger). Aucune variable d'environnement n'est nécessaire. Les commandes d'import restent grisées tant que tu ne l'as pas fait.

Chaque import affiche d'abord les capacités demandées par l'agent. Les permissions doivent être approuvées explicitement. Les fonctions et sélections d'outils fournies avec l'agent ne sont pas importées, le CSS généré est nettoyé, et les actions issues des résultats sont vérifiées par rapport aux capacités approuvées. Fermer cette barrière arrête les agents importés. Les agents créés dans Marinara et les packages officiels ne sont pas concernés.

<a id="custom-agent-repositories"></a>

### Dépôts d'agents personnalisés

Les dépôts sont désactivés par défaut, car leurs prompts et leurs outils ne sont pas vérifiés. Définis `ENABLE_CUSTOM_AGENT_REPOS=true`, active **Allow custom Agent imports**, puis ouvre **Agents → Agent Organizer → Custom Sources** (Agents → organisateur d'agents → sources personnalisées) pour prévisualiser un dépôt GitHub public. L'ajout d'une source et l'application de modifications ultérieures demandent tous deux une confirmation. La synchronisation est manuelle, et Marinara ne clone ni n'interroge jamais les dépôts en arrière-plan. Seules les URL GitHub de racine de dépôt sont acceptées.

Un dépôt publie des agents, des ensembles de règles de Game Mode ou les deux. À la racine :

- `agents.json` est un tableau au format des agents téléchargeables :

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

- `rulesets` contient un ensemble de règles par fichier `.json`, jusqu'à 32 fichiers de 512 KB. Seuls les fichiers placés directement dedans sont lus. L'aperçu liste le nom, la version et la couverture de chaque ensemble de règles. Le texte destiné au Game Master d'un ensemble de règles est envoyé au modèle dans chaque partie qui l'utilise : n'installe donc que des ensembles venant de personnes de confiance.

Les ensembles de règles importés portent le nom du propriétaire du dépôt, comme `alice/my-5e` : ils ne prennent donc jamais un nom officiel. Chaque version est conservée, et une partie se joue sur la version exacte avec laquelle elle a commencé. Si la même version revient avec un contenu différent, Marinara garde celle qui est installée et te dit de demander à l'auteur d'augmenter le numéro de version. Un fichier que Marinara ne sait pas lire est listé avec la raison, puis ignoré.

Pendant la synchronisation, les valeurs distantes de prompt, de réglages et d'outils remplacent les valeurs gérées par le dépôt affichées dans l'aperçu. Tes choix de compte et d'illustrations restent locaux. Si un agent disparaît à la source, il reste un agent local ordinaire et ne perd que son lien vers le dépôt. Retirer une source fonctionne de la même façon, et ses ensembles de règles restent installés.

Les agents personnalisés peuvent aussi activer **Previous output** (sortie précédente) dans la section Context Sources pour lire leur propre dernière sortie réussie. Avec **JSON context output** (sortie de contexte en JSON), renvoie `{"text":"main prompt content","agent-context":"private continuation context"}`. Seul `text` va dans le prompt principal. **Hide output as spoilers** (masquer les sorties comme des spoilers) garde les sorties enregistrées repliées. Les régénérations excluent le tour remplacé, et les messages supprimés ou les swipes inactifs ne peuvent pas fournir de contexte.

<a id="external-extensions"></a>

### Extensions externes

L'import d'extensions tierces demande deux accords. La variable d'environnement est l'autorisation de la personne qui exploite le serveur. L'interrupteur de la Danger Zone est l'acceptation de l'utilisateur.

1. Définis `ENABLE_EXTERNAL_EXTENSIONS=true` dans `.env`.
2. Ouvre **Settings → Advanced → Danger Zone**, descends sous les commandes de suppression de données, lis l'avertissement et active **Allow third-party extension imports** (autoriser l'import d'extensions tierces).

La section **External Extensions** (extensions externes) apparaît alors sous **Settings → Addons** (Paramètres → Modules complémentaires). Fermer l'une ou l'autre barrière désactive les enregistrements externes et arrête leur code. Les enregistrements stockés manuellement, hérités, importés depuis un profil ou d'origine inconnue comptent comme externes : déposer des fichiers dans un dossier ne permet donc pas de contourner les barrières. Les brouillons de Professor Mari n'ont besoin d'aucune des deux barrières. Ils démarrent désactivés et demandent l'approbation de leur empreinte de code exacte.

Les Sandboxed Browser Extensions (extensions de navigateur isolées) sont le mode par défaut. Certains anciens packages affichent **Full page access** (accès complet à la page), car ils ont besoin de la page de Marinara. Ce mode exécute le code approuvé dans la page de Marinara, avec accès au contenu de la page, au stockage du navigateur, aux API réseau et à ta session. Il n'est proposé qu'aux External Extensions quand les deux barrières sont ouvertes, et il demande une acceptation d'avertissement distincte. Recharge la page après l'avoir désactivé.

## Référence complète des variables d'environnement

Les tableaux ci-dessus couvrent le contrôle d'accès, le stockage, le log, les délais d'expiration, les actions privilégiées et les autorisations pour les adresses locales. Les autres réglages sont ici.

### Serveur et démarrage

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `PORT` | `7860` | Port sur lequel le serveur écoute. Garde la même valeur sur Android, Docker et Termux. |
| `HOST` | `127.0.0.1` (`0.0.0.0` dans les lanceurs et les images Docker) | Interface réseau sur laquelle écouter. Utilise `0.0.0.0` pour un accès depuis le réseau local. Le fichier Compose par défaut ne publie le port Docker que sur `127.0.0.1`. |
| `MARINARA_ANDROID_SECRET` | vide | Secret interne pour les installations Termux gérées par l'APK. L'application Android le crée et le lanceur Termux l'exporte. Ne demande jamais aux utilisateurs de le définir. Doit faire exactement 64 caractères hexadécimaux. Une valeur non vide invalide fait échouer les requêtes locales de l'appareil avec HTTP 503. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Fichier de secret utilisé par le lanceur Termux et la commande `mari` locale. L'APK et le lanceur le gèrent. |
| `AUTO_OPEN_BROWSER` | `true` | Indique si les lanceurs ouvrent l'URL de l'application. `false` empêche cette ouverture. L'installation gérée par l'APK la désactive. |
| `AUTO_UPDATE_ENABLED` | `true` | Indique si les lanceurs basés sur Git récupèrent et appliquent les mises à jour avant le démarrage. `false` les désactive à partir du lancement suivant. Le lanceur vérifie quand même, en lecture seule, s'il existe des versions plus récentes et affiche un rappel. `--skip-update` ignore les deux vérifications pour un seul démarrage. |
| `MARINARA_NOTICES_ENABLED` | `true` | Indique si le serveur récupère les avis des mainteneurs. Voir [Avis de Marinara](#marinara-notices). |
| `MARINARA_NOTICES_URL` | `notices.json` de la branche `notices` | Remplace le fichier d'avis, pour les forks et les miroirs. Il est validé de la même façon, et les liens hors de `https://github.com/Pasta-Devs/` sont supprimés. |
| `MARINARA_ENV_FILE` | `.env` à la racine du projet | Chemin de remplacement pour le fichier `.env`. À définir avant le démarrage. |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4` | Nombre maximal de requêtes d'image ou de vidéo simultanées, pour tout le serveur. Baisse-le à 1-2 si un ComfyUI ou un SwarmUI local manque de VRAM. `0` supprime le plafond. Les valeurs invalides sont ignorées avec un avertissement. Le travail par lots n'occupe jamais le dernier emplacement. S'ajoute à **Queue media generation requests** (mettre les requêtes de génération de médias en file d'attente), un réglage de **Settings → Generations → Overall Generations** (Paramètres → Générations → Générations globales) activé par défaut, qui met en file d'attente les tâches d'image et de vidéo par compte. |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000` (10 min) | Durée pendant laquelle une requête attend un emplacement libre avant d'échouer. `0` attend indéfiniment. |
| `MARINARA_SHARED_GPU_HOSTS` | vide | Liste de `host:port` séparés par des virgules pour un GPU partagé entre un modèle local et un backend local d'images ou de vidéos, comme llama-swap. Les requêtes de texte et de médias vers un hôte de la liste passent à tour de rôle : une image ne peut donc pas attendre indéfiniment derrière les réponses du chat. Une image ou un clip attend au maximum `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS`. Les embeddings ne sont pas mis en attente. S'applique aux nouvelles requêtes sans redémarrage. |
| `MARINARA_ENV_WATCH` | `1` | Façon dont `.env` est surveillé. Par défaut : des événements de modification (appliqués après un délai d'environ 250 ms), avec une vérification toutes les 30 secondes en repli. `poll` : toujours la vérification toutes les 30 secondes. `0` : désactivé. Voir [Redémarrage ou rechargement à chaud](#restart-or-hot-reload). |
| `TZ` | valeur système par défaut | Fuseau horaire de repli de l'hôte pour les tâches du serveur, comme `Europe/Warsaw`. Laisse-le non défini ou vide pour utiliser le fuseau horaire de l'hôte. Un réglage **Schedule timezone** (fuseau horaire de l'emploi du temps) enregistré en mode Conversation a la priorité pour les emplois du temps. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Origines de navigateur autorisées à faire des requêtes multi-origines. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | Indicateur hérité. Les builds actuelles n'embarquent aucune clé de démarrage : il ne crée donc rien. Ajoute ton propre compte dans l'application. |

Le réglage **Schedule timezone** utilise par défaut le fuseau horaire de ton appareil. Tu peux le changer pendant la configuration d'une Conversation, dans les Chat Settings (réglages du chat) d'une Conversation ou dans l'éditeur d'emploi du temps du personnage. C'est un réglage global unique, partagé par tous les chats Conversation et synchronisé avec les autres clients du même serveur.

### Outils de médias et de sprites

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `FFMPEG_PATH` | vide | Chemin vers `ffmpeg`, utilisé pour les GIF d'expression animés. À défaut, le `ffmpeg` de ton PATH est utilisé. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 min) | Temps accordé pour convertir un clip d'expression animé. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | `auto` essaie d'abord le nettoyage intégré, puis l'outil d'IA facultatif. `builtin` n'utilise que le nettoyage intégré. `backgroundremover` impose l'outil d'IA. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | `true` installe au lancement l'outil facultatif de suppression d'arrière-plan par l'IA. |
| `BACKGROUNDREMOVER_COMMAND` | vide | Chemin vers un programme `backgroundremover` du système. |
| `BACKGROUNDREMOVER_PYTHON` | vide | Chemin vers un Python où `backgroundremover` est installé. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000` (10 min) | Temps accordé à un appel de suppression d'arrière-plan par l'IA. |

### Fournisseurs de vidéo de scène

Les comptes vidéo se configurent dans l'application. Ces réglages ne font qu'ajuster les tâches. Les valeurs sont en millisecondes.

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | Fréquence à laquelle le serveur vérifie une tâche Google Veo. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | Fréquence à laquelle il vérifie une tâche xAI Imagine. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | Fréquence à laquelle il vérifie une tâche vidéo OpenRouter. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | Fréquence à laquelle il vérifie une tâche Seedance. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | vide | Adresse HTTPS publique de ce serveur, pour les services qui doivent récupérer une image de référence par URL. |

<a id="lorebooks"></a>

### Lorebooks

Les deux réglages sont désactivés par défaut et s'appliquent à la génération suivante après une modification de `.env`. Quand `LOREBOOK_STABLE_GROUP_WINNERS` est défini, il l'emporte sur l'interrupteur **Stable lorebook picks** (sélections stables du lorebook) dans **Settings → Advanced → Features**. Sinon, c'est l'interrupteur qui décide. Voir [Interrupteurs de fonctions](configuration/features.md).

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | `false` | Garde le même gagnant de groupe d'inclusion par chat tant que les candidats ne changent pas, au lieu d'un nouveau tirage à chaque génération. Garde stable le début du prompt pour le cache de prompt du fournisseur. |
| `LOREBOOK_COMPACT_STORED_SCANS` | `false` | Ne stocke le texte intégral des entrées activées que sur le message d'assistant ou de narrateur le plus récent. Les anciens messages gardent les identifiants, les clés et les scores des entrées. Réduit fortement la taille des chats à gros lorebooks. Si des messages plus récents sont supprimés, Active Context et les nouvelles tentatives d'agents affichent le texte actuel de l'entrée pour le message redevenu le plus récent. |

`scripts/compact-lorebook-scans.mjs` applique la même règle aux anciens chats. Arrête d'abord le serveur. C'est une simulation, sauf si tu passes `--apply`, et le script sauvegarde les deux tables de messages avant d'écrire.

<a id="robustness"></a>

### Robustesse

Tous sont désactivés par défaut, ce qui conserve l'ancien comportement. `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` et `SHUTDOWN_FORCE_EXIT_ON_REPEAT` demandent un redémarrage. Les autres s'appliquent après une modification de `.env`. Quand `PROVIDER_RETRY_TRANSIENT_ERRORS` est défini, il l'emporte sur l'interrupteur **Retry failed provider calls** (réessayer les appels fournisseur échoués) dans **Settings → Advanced → Features**. Sinon, c'est l'interrupteur qui décide.

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | `false` | Réessaie une connexion refusée ou injoignable, ou une erreur 502 ou 503, au plus deux fois avec une attente de 5 s au maximum, et seulement avant que du texte te parvienne. Une 504 ou une connexion coupée n'est jamais réessayée. Ne sert pas quand le compte a une solution de repli, qui est alors essayée immédiatement. Un hôte qui échoue lentement peut retarder l'erreur d'environ 20 s. |
| `STORAGE_SKIP_UNCHANGED_WRITES` | `false` | Un enregistrement évite de réécrire un fichier de chat ou `manifest.json` quand son contenu correspond à ce que ce serveur a écrit en dernier et que le fichier sur disque n'a pas changé. Un fichier tout juste restauré depuis son `.bak` est toujours réécrit. |
| `STORAGE_YIELDING_SERIALIZE` | `false` | Prépare les gros fichiers de chat à l'enregistrement par petites tranches : enregistrer un très long chat ne met donc pas en pause les autres requêtes. Les octets écrits sont identiques. |
| `STORAGE_CACHE_WINDOWS_BOOT_ID` | `false` | Windows uniquement. Mémorise jusqu'au prochain redémarrage, dans `.writer-boot-id.json` sous `DATA_DIR`, la vérification de l'heure de démarrage que le verrou de stockage effectue à chaque lancement (environ 1,5 à 2 s de PowerShell). |
| `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` | `false` | Windows uniquement. <kbd>Ctrl</kbd>+<kbd>Break</kbd> et la fermeture de la console arrêtent aussi proprement le serveur et écrivent les enregistrements en attente. Une fermeture de console reçoit des délais plus courts pour tenir dans les quelque 5 s que Windows accorde. |
| `SHUTDOWN_FORCE_EXIT_ON_REPEAT` | `false` | Un nouvel appui sur <kbd>Ctrl</kbd>+<kbd>C</kbd> ou <kbd>Ctrl</kbd>+<kbd>Break</kbd> plus de 1,5 s après le premier arrête immédiatement le serveur. Des enregistrements non écrits peuvent être perdus. Sans ce réglage, les répétitions sont ignorées et la limite d'arrêt de 8 s s'applique. |
| `SHUTDOWN_EARLY_FLUSH` | `false` | Commence à écrire les enregistrements en attente dès qu'un signal d'arrêt arrive, pendant que les connexions se ferment encore. Le redémarrage depuis Advanced Settings ne l'utilise pas. |
| `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` | `0` | Durée pendant laquelle un signal d'arrêt attend les runtimes d'arrière-plan (packages, extensions, modèle intégré) avant de fermer le stockage. `0` les attend tous. `2500` au maximum, pour que le stockage se ferme dans la limite de 8 s. Le redémarrage depuis Advanced Settings attend toujours tous les runtimes. |

### Intégrations et extras

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI` | `true` | Indique si les comptes **Claude (Subscription)** utilisent le Claude Code de cet ordinateur quand il est au moins aussi récent que la copie fournie. Android n'a pas de copie fournie et a besoin que ce réglage reste activé. `false` utilise toujours la copie fournie. S'applique en moins de cinq minutes. |
| `DOCS_I18N_BASE_URL` | branche `docs-i18n` officielle | Source de téléchargement des packs de langue de la documentation et de l'interface. Les packs de l'interface utilisent son sous-arbre `ui/`. Doit être un hôte public `https://`. |
| `GIPHY_API_KEY` | vide | Clé Giphy pour la recherche de GIF en mode Conversation. La recherche reste désactivée tant que tu ne l'as pas définie et que tu n'as pas redémarré. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Adresse par défaut de l'application haptique Intiface. |
| `SPOTIFY_REDIRECT_URI` | déduite de la requête | Remplace l'URL de rappel de connexion Spotify. À définir quand le TLS est terminé en amont. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Taille maximale du contenu d'une page de wiki que Professor Mari lit avant de le rogner. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Temps accordé à une requête wiki de Professor Mari. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Durée pendant laquelle Professor Mari garde en cache une lecture de wiki. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (le lanceur Windows le met à `true`) | Permet d'installer le runtime pour le **Built-in model** (modèle intégré) sans en-tête d'administration en loopback. |

Pour le **Built-in model**, consulte [Configuration du modèle intégré](connections/local-model.md).

<a id="outbound-http-proxy"></a>

### Proxy HTTP sortant

Certains réseaux n'accèdent à internet que par un proxy HTTP, par exemple v2rayN sans le mode TUN. Marinara peut y faire passer ses requêtes vers les services d'IA, les services d'images, les serveurs d'embeddings et le catalogue d'agents. Définis ces variables là où Marinara démarre ou dans `.env`, puis redémarre.

| Variable | Par défaut | Ce que ça fait |
| --- | --- | --- |
| `NODE_USE_ENV_PROXY` | non défini | `1` active le proxy. Sans cela, Marinara ignore les réglages de proxy, comme le fait Node.js. |
| `HTTP_PROXY` | vide | Adresse du proxy, comme `http://127.0.0.1:10809`. Utilisée pour chaque requête quand `HTTPS_PROXY` n'est pas défini. |
| `HTTPS_PROXY` | vide | Proxy pour les adresses `https://`, quand il diffère de `HTTP_PROXY`. |
| `NO_PROXY` | vide | Hôtes séparés par des virgules qui contournent le proxy. Ajoute les serveurs de modèles de ton réseau. `localhost`, `127.0.0.1` et `::1` le contournent toujours. |

## Guides associés

- [Interrupteurs de fonctions](configuration/features.md)
- [Accès à distance : connexion et liste d'autorisation d'IP](REMOTE_ACCESS.md)
- [Où Marinara enregistre tes données](data/where-data-is-stored.md)
- [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md)
- [Vidéo de scène](media/scene-video.md)
- [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md)
