# Résoudre les problèmes de Marinara Engine

Trouve ton symptôme, puis applique la solution. La plupart des problèmes disparaissent quand tu redémarres Marinara avec son lanceur (`start.bat`, `start.sh` ou `start-termux.sh`).

## Les premiers réflexes

1. Force le rafraîchissement de la page : <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> sous Windows ou Linux, <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> sur un Mac.
2. Regarde la console du serveur (la fenêtre de terminal qui fait tourner Marinara) et cherche les lignes d'erreur en rouge. Elles désignent en général le vrai problème.
3. Pour demander de l'aide, active d'abord le **Debug mode** (mode débogage). Voir [Obtenir de l'aide](#get-more-help).

<a id="my-character-does-not-reply"></a>

## Mon personnage ne répond pas

Vérifie ces points dans l'ordre.

1. Cherche une notification (un court message en bas de l'écran). Elle nomme en général le problème. Voir [Erreurs de connexion et de génération](#connection-and-generation-errors).
2. Vérifie que le chat a un compte et un modèle : ouvre **Chat Settings** (réglages du chat) et regarde la connexion. S'il n'y en a aucune, ajoute un compte dans **Connections** (Connexions). Voir [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md).
3. Vérifie que la clé API est correcte et que le compte a du crédit. Une clé erronée ou un solde vide est une cause fréquente.
4. Vérifie le nom du modèle et, pour un serveur local comme Ollama ou LM Studio, que le serveur tourne.
5. Renvoie ton message, ou choisis un autre modèle.

Si rien n'y fait, active le **Debug mode** et lis la console du serveur. Voir [Obtenir de l'aide](#get-more-help).

## L'application ne se charge pas sur un mobile ou un autre appareil

Tu n'arrives pas à ouvrir Marinara depuis un téléphone, une tablette ou un autre ordinateur ?

Le plus souvent, c'est l'une de ces trois causes :

- **Adresse.** Par défaut, le serveur écoute sur `127.0.0.1` (cet ordinateur seulement). Les lanceurs définissent `HOST=0.0.0.0`. Si tu as démarré avec `pnpm start`, définis d'abord `HOST=0.0.0.0` dans `.env`.
- **Réseau.** Les deux appareils doivent être sur le même réseau Wi-Fi, et aucun pare-feu ne doit bloquer le port. Le port par défaut est `7860`, ou ton `PORT`.
- **Connexion.** Définis-en une. Sur l'appareil bloqué, saisis le code de configuration à usage unique affiché dans le log du serveur, avec un nouveau nom d'utilisateur et un nouveau mot de passe. Dans Docker, trouve le code avec `docker logs <container> 2>&1 | grep "setup code"`. Tu peux aussi la définir dans **Settings → Advanced → Access** (Paramètres → Avancé → Accès), dans un navigateur déjà connecté. Sur un serveur sans interface graphique, lance `ssh -L 7860:127.0.0.1:7860 user@server`, ouvre `http://localhost:7860` et utilise **Settings**. Voir [Accès à distance](REMOTE_ACCESS.md#option-1-login-recommended).

Autres causes :

- **Proxy ou tunnel sur la même machine.** Un reverse proxy ou un tunnel sur la même machine exige la connexion. Le trafic Tailscale direct est approuvé par défaut. Tailscale Serve ou Funnel et le `proxy_pass` HTTP/1.0 par défaut de nginx comptent comme relayés et exigent la connexion. Le trafic Docker de pont sur le même hôte n'est approuvé que tant que tu n'as défini ni connexion, ni `IP_ALLOWLIST`, ni `TRUSTED_AUTH_PROXY`.
- **Nom personnalisé pour cet ordinateur.** Un nom associé à `127.0.0.1` dans `/etc/hosts` compte comme relayé. Utilise plutôt `localhost`, `127.0.0.1`, le nom d'hôte de la machine ou un nom `*.localhost`.
- **Too many wrong passwords.** Attends 15 minutes, puis connecte-toi. Tu as oublié le mot de passe ? Lance `node scripts/reset-login.mjs` dans le dossier Marinara, sur l'ordinateur qui fait tourner Marinara. Dans Docker, lance `docker exec <container> node scripts/reset-login.mjs`. Redémarrer le serveur permet aussi de réessayer.
- **Untrusted request host.** Pour un domaine public ou un domaine de reverse proxy, ajoute son nom d'hôte exact à `TRUSTED_HOSTS` dans `.env`. Les adresses IP directes restent acceptées.
- **Actions sensibles bloquées** (sauvegardes, effacement de données, mises à jour) depuis cet appareil. Sur l'ordinateur du serveur lui-même, ouvre **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur) et clique sur **Make admin secret** (créer un secret d'administration), ou définis `ADMIN_SECRET` dans le `.env` du serveur. Saisis le secret dans **Admin Access** sur l'autre appareil et clique sur **Save** (enregistrer).

Voir [Accès à distance](REMOTE_ACCESS.md) et la [FAQ](FAQ.md). Si tu as été verrouillé après une mise à jour, voir [Verrouillé après une mise à jour](REMOTE_ACCESS.md#locked-out-after-updating).

## Enregistrement bloqué, ou réglages qui ne tiennent pas

Un enregistrement semble réussir, mais il est annulé quand tu recharges la page. La protection intersites (CSRF) le bloque, parce qu'elle ne fait pas confiance à l'adresse de ce navigateur. Tu vois une bannière rouge qui prévient que les enregistrements échoueront silencieusement, ou une notification intitulée **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** ou **Save blocked: origin not trusted**.

La boucle locale, les adresses de réseau privé, Tailscale et le pont Docker sont approuvés automatiquement. Le problème arrive surtout avec une adresse IP publique ou un nom de domaine. Ajoute l'adresse à `CSRF_TRUSTED_ORIGINS` dans `.env`, en séparant les valeurs par des virgules. La bannière a un bouton **Copy** (copier) qui compose la ligne pour toi. Aucun redémarrage n'est nécessaire.

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

<a id="connection-and-generation-errors"></a>

## Erreurs de connexion et de génération

Les erreurs de génération s'affichent sous forme de notification en bas de l'écran. La notification donne la raison et reste affichée assez longtemps pour être copiée.

| Message ou symptôme | Solution |
| --- | --- |
| **No API connection configured for this chat** | Le chat n'a aucun compte. Ajoutes-en un dans **Connections**, puis choisis-le pour le chat. Voir [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md). |
| Le modèle n'accepte pas un paramètre | Ouvre **Chat Settings → Advanced Parameters** (réglages du chat → paramètres avancés) et désactive l'interrupteur à côté du paramètre que nomme la notification. |
| Le modèle indique qu'un paramètre est obligatoire | Active l'interrupteur de ce paramètre. |
| **This model's chat template needs user and assistant messages to take turns** | Certains modèles locaux, comme les modèles basés sur Mistral servis par llama.cpp, ont besoin de messages qui alternent. Marinara fusionne les messages consécutifs et réessaie une fois. Si le problème persiste, règle **Post-Processing Messages** (post-traitement des messages) sur **Single User Message** (un seul message utilisateur) dans **Chat Settings → Advanced Parameters**, ou sers le modèle avec un gabarit de chat (chat template) moins strict. |
| **The AI returned an empty response. Try sending your message again.** | Renvoie ton message. Si ça se répète, essaie un autre modèle ou un autre compte. |
| **A generation is already in progress for this chat** | Une réponse est encore en cours de streaming, c'est-à-dire d'affichage au fil de l'écriture. Attends, ou clique sur **Stop** (arrêter), puis réessaie. |
| **No connections are marked for the random pool** | Le routage aléatoire est activé, mais aucun compte n'est dans le pool. Ajoutes-en un, ou désactive le routage aléatoire. |
| Chaque message échoue avec une erreur réseau, et ton ordinateur n'accède à Internet que par un proxy | Indique ce proxy à Marinara. Voir [Proxy HTTP sortant](CONFIGURATION.md#outbound-http-proxy). |

## Après une mise à jour

Les problèmes juste après une mise à jour, d'abord en termes simples :

- L'écran est blanc ou paraît ancien : voir [Écran blanc, figé ou d'apparence ancienne](#blank-stale-or-old-looking-screen) et [Page blanche ou JavaScript renvoyé en HTML après une mise à jour](#blank-page-or-javascript-served-as-html-after-an-update).
- Des chats ou des presets semblent manquer : voir [Des données semblent manquer après une mise à jour](#data-seems-missing-after-an-update). Tes données sont presque toujours encore sur le disque.
- Les chats paraissent vides après un retour à une ancienne version : voir [Les chats n'affichent aucun message après un retour à une ancienne version](#chats-show-no-messages-after-switching-to-an-older-version).

<a id="blank-stale-or-old-looking-screen"></a>

### Écran blanc, figé ou d'apparence ancienne

Le serveur tourne, mais le navigateur affiche une page blanche, ou l'application paraît ancienne après une mise à jour. Le navigateur conserve une copie en cache de l'application web.

1. Force le rafraîchissement.
2. Si ça ne suffit pas, ouvre **Settings → Advanced → Updates** (Paramètres → Avancé → Mises à jour) et clique sur **Refresh App** (rafraîchir l'application).

Le bouton **Refresh App** vide le service worker du navigateur (un script d'arrière-plan qui met l'application en cache) et son cache, puis recharge la page. Il ne modifie pas tes données et ne met pas le serveur à jour. Pour mettre l'application elle-même à jour, voir [Mettre à jour Marinara Engine](UPGRADING.md).

<a id="blank-page-or-javascript-served-as-html-after-an-update"></a>

### Page blanche ou JavaScript renvoyé en HTML après une mise à jour

Une erreur comme "Failed to load module script" avec un type `text/html` signifie que le navigateur a demandé un fichier JavaScript absent de la build. Supprimer tes données ne règle pas le problème.

1. Arrête le serveur.
2. Relance `start.bat`, `start.sh` ou `start-termux.sh`. Le lanceur recompile les fichiers incomplets du client avant de démarrer. Pour une installation manuelle, lance d'abord `pnpm build` depuis la racine du dépôt.
3. Si la page reste blanche, force le rafraîchissement ou essaie une fenêtre de navigation privée.

Si ça échoue encore, signale l'URL complète du fichier en échec, le statut HTTP, le Content-Type et la première ligne de la réponse, avec la sortie du lanceur.

<a id="data-seems-missing-after-an-update"></a>

### Des données semblent manquer après une mise à jour

Ne supprime aucun dossier de données. Marinara conserve les données actives dans un dossier `storage`, à l'intérieur de son dossier de données. Cherche `storage` dans `packages/server/data/` et dans `data/`. Le serveur affiche au démarrage les dossiers qu'il a retenus.

<a id="chats-show-no-messages-after-switching-to-an-older-version"></a>

### Les chats n'affichent aucun message après un retour à une ancienne version

Les versions récentes de Marinara stockent les enregistrements de chaque chat (messages, swipes, souvenirs, images) dans leurs propres fichiers, ce qui accélère l'enregistrement des longs chats. Les anciennes versions ne savent pas lire cette organisation, donc les chats paraissent vides. Les données sont toujours sur le disque.

Marinara bloque les retours en arrière évidents. Le lanceur saute une mise à jour automatique qui mènerait à une version incompatible, et le programme de mise à jour intégré affiche une erreur qui renvoie ici.

Si tu as fait une mise à jour, puis es revenu à une ancienne version, restaure la sauvegarde que tu as faite avant la mise à jour. Voir [Revenir à une ancienne version](UPGRADING.md#downgrading-to-an-older-version). Les détails techniques suivent.

Tes données sont désormais au format de stockage 10. Les formats 8, 9 et 10 ajoutent les réglages des avatars 3D (MMD, puis GLB et FBX) et les liens de compte des connexions, que les anciennes builds ne peuvent pas lire sans risque. Si tes données ont atteint le format 8 ou un format plus récent, restaure une sauvegarde complète faite avant cette mise à niveau pour utiliser une ancienne build. La commande ci-dessous ne convertit que les anciennes organisations des fichiers de chat. Ne change pas le numéro de format à la main. Voir [Revenir à une ancienne version](UPGRADING.md#downgrading-to-an-older-version).

Pour des données antérieures au format 8, convertis l'organisation des fichiers de chat :

1. Arrête le serveur Marinara.
2. Depuis le dossier Marinara, lance :

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. Passe à l'ancienne version et démarre-la.

La commande reconstruit l'organisation à fichier unique à partir des fichiers propres à chaque chat. Rien n'est supprimé. Les fichiers propres à chaque chat restent dans des dossiers nommés `<table>.post-unshard-<timestamp>`, et les éventuels originaux `.pre-shard` restent aussi. Quand tu refais la mise à jour, Marinara reconvertit tes données.

Dans Docker ou Podman, les données sont dans le volume `marinara-data`. Arrête le conteneur, lance la commande ci-dessous, puis démarre l'ancienne image :

```bash
docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard
```

## Problèmes d'installation et de lancement

### Termux : CANNOT LINK EXECUTABLE "node"

Termux affiche `CANNOT LINK EXECUTABLE "node"` avec `cannot locate symbol` ou `library ... not found`. Node.js a été mis à jour sans le reste de Termux. L'application Android peut alors s'arrêter avec **Could not verify that this Marinara Android build can safely read your stored data**. Tes données n'en sont pas la cause, et réinstaller l'APK ne règle pas le problème.

1. Dans Termux, lance :

   ```bash
   pkg upgrade -y
   ```

2. Appuie sur **Install / Start Marinara** (installer / démarrer Marinara) dans l'application Android. Pour une installation manuelle, lance `cd "$HOME/Marinara-Engine" && ./start-termux.sh`.

Si la mise à jour te demande s'il faut garder un fichier de configuration, appuie sur Enter pour garder le tien. Les lanceurs et les applications Android actuels font cette mise à jour d'eux-mêmes.

### Termux : JavaScript heap out of memory pendant la compilation du client

Vite s'arrête avec `Reached heap limit` ou `JavaScript heap out of memory`. Mets à jour, puis relance `./start-termux.sh`. Les compilations du client utilisent leur propre tas mémoire de 1536 Mio, plafonné à la moitié de la RAM de l'appareil, mais jamais en dessous de 1280 Mio. Une limite de tas que tu as définie dans `NODE_OPTIONS` prime : retire donc une ancienne limite de 1024 Mio. Ferme les autres applications avant de réessayer. Les téléphones qui ont moins de 3 Go de RAM environ peuvent encore manquer de mémoire. Ne supprime ni tes chats ni ton profil pour réparer un échec de compilation.

### Ordinateur : JavaScript heap out of memory pendant la vérification des types du client

La compilation s'arrête et indique `The client type-check needs about 2.5 GiB of Node.js heap`. La limite définie dans ton `NODE_OPTIONS` est trop basse, et la compilation conserve une limite que tu as définie. Monte `--max-old-space-size` à 2560 ou plus. Si `NODE_OPTIONS` contient `--max-old-space-size-percentage`, augmente plutôt celui-ci, car il prend le pas sur l'autre. Tu peux aussi retirer les deux options. Relance ensuite le lanceur. Tes données restent intactes.

### Termux : fichier du client invité multijoueur manquant

Le démarrage signale l'absence de `packages/client/dist/multiplayer/guest.js`. Mets Marinara à jour et relance `./start-termux.sh`, qui effectue la compilation complète du client. Tu n'as pas besoin d'activer le multijoueur.

### Termux : le serveur s'arrête quand tu ouvres Marinara, ou Sharp ne peut pas se charger

Sharp est la bibliothèque d'images que Marinara utilise pour les miniatures et les sprites – un sprite, c'est l'image du personnage sur le plateau. Sur Android, elle passe par une solution de repli WebAssembly. Mets Marinara à jour et laisse le lanceur réinstaller les dépendances. Si le serveur s'arrête avant que tu puisses faire la mise à jour, répare l'installation à la main dans Termux :

```bash
cd ~/Marinara-Engine
rm -f node_modules/.modules.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile --prefer-offline
./start-termux.sh
```

Tes chats et tes réglages restent intacts. Si Sharp ne peut toujours pas se charger, Marinara continue de fonctionner avec le traitement des images désactivé. Les miniatures existantes s'affichent toujours, les nouvelles utilisent l'image en taille réelle, et la génération de sprites comme la suppression d'arrière-plan intégrée sont indisponibles. Ne remplace pas Sharp par une autre version. Conserve toute la sortie d'erreur pour un rapport.

<a id="browser-opens-before-startup-finishes"></a>

### Le navigateur s'ouvre avant la fin du démarrage

Mets à jour et redémarre avec le lanceur. Celui-ci n'ouvre le navigateur qu'une fois que le serveur signale qu'il est prêt. Si le démarrage échoue, aucun onglet ne s'ouvre : conserve donc l'erreur du terminal. Pour ouvrir l'application toi-même, définis `AUTO_OPEN_BROWSER=false`.

### Windows : erreur EPERM ou erreur de signature corepack pendant l'installation de pnpm

pnpm est le gestionnaire de paquets dont Marinara se sert pour installer son code. `EPERM: operation not permitted` ou une erreur de signature corepack signifie que corepack n'a pas pu écrire dans le dossier d'installation de Node. Essaie l'une de ces solutions, puis relance le lanceur :

1. Fais un clic droit sur ton terminal, choisis **Run as administrator** (exécuter en tant qu'administrateur) et lance le lanceur.
2. Installe pnpm toi-même : `npm install -g pnpm@12.15.0`
3. Dans un terminal administrateur, mets corepack à jour : `npm install -g corepack`

### Erreur de version de pnpm, ou `'pnpm' is not recognized`

Marinara utilise pnpm 12.15.0. Le lanceur récupère la bonne version pour toi, et tu n'as pas besoin de remplacer d'abord une ancienne version globale de pnpm. Mets Marinara à jour (`git pull` dans son dossier si le lanceur n'y arrive pas), puis relance le lanceur. Si ça échoue encore, installe la version exacte et relance le lanceur :

```bash
npm install -g pnpm@12.15.0
```

### Linux : ERR_PNPM_ENAMETOOLONG pendant l'installation

Une ancienne installation a laissé derrière elle des chemins de dossiers trop longs. Depuis le dossier Marinara, lance :

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Relance ensuite `./start.sh`. Pour une installation manuelle, lance `pnpm install`.

### L'installation affiche "Ignored build scripts: @google/genai"

Cet avis est sans danger. Ne lance pas `pnpm approve-builds`, car cette commande modifie un fichier suivi par Marinara. Si l'avis continue de s'afficher après une mise à jour, supprime `node_modules/.modules.yaml` dans le dossier Marinara et relance le lanceur.

### ERR_PNPM_TRUST_DOWNGRADE pendant l'installation

C'est presque toujours le signe d'une installation inachevée. Relance le lanceur. Pour une installation manuelle, lance cette commande depuis le dossier Marinara :

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Problèmes du modèle intégré

Le **Built-in model** (modèle intégré) tourne sur ton ordinateur, sans clé API. Certains messages d'erreur l'appellent le sidecar. Pour la configuration, voir [Configuration du modèle intégré](connections/local-model.md).

- **Sidecar runtime install is disabled.** Sur ton propre ordinateur, définis `SIDECAR_RUNTIME_INSTALL_ENABLED=true` dans `.env`. Depuis un autre appareil, enregistre d'abord ton secret d'administration dans **Settings → Advanced → Admin Access**.
- **Le téléchargement ou la configuration du modèle échoue depuis un autre appareil** (une adresse réseau ou Docker). Le secret d'administration peut lui aussi être nécessaire. Sur ton propre ordinateur, il ne l'est pas.
- **Écart de taille ou d'empreinte SHA-256** pour un fichier llama.cpp, MLX ou uv fourni. Marinara a rejeté le fichier avant de l'utiliser. Mets à jour ou réinstalle Marinara, puis réessaie. Ne décompresse pas, ne modifie pas et ne contourne pas le fichier.

## Mémoire et résumés

### Memory Recall ne rappelle rien

**Memory Recall** parcourt les messages précédents et réinsère les plus pertinents dans le prompt, le texte que Marinara envoie à l'IA.

1. Ouvre **Chat Settings → Memory Recall** et vérifie que **Enable Memory Recall** (activer Memory Recall) est activé.
2. Ouvre **Access memories for this chat** (accéder aux souvenirs de ce chat). Dans **Memories for This Chat** (souvenirs de ce chat), regarde le statut de chaque fragment.
3. Le statut **Waiting for vector** signifie que le souvenir est encore en cours de traitement. Attends, puis reprends le chat.
4. Le statut **Embedding unavailable** signifie qu'aucune source d'embedding (une représentation numérique du texte) ne fonctionne. Configure un compte d'embedding, ou laisse le modèle intégré se charger. Pour utiliser une même source pour chaque chat, choisis-la sous **Embeddings** dans la section **Defaults** (valeurs par défaut) de **Connections**.

Un souvenir a besoin d'au moins 5 nouveaux messages pour être créé. Le rappel n'affiche que les souvenirs qui correspondent étroitement à ton nouveau message : il peut donc ne rien renvoyer même quand des souvenirs existent.

<a id="advanced-memory-says-scenes-need-attention"></a>

### Advanced Memory signale des scènes à vérifier

Un point fixe sur le bouton **Chat Settings**, ou une notification indiquant qu'Advanced Memory a trouvé des problèmes, signifie que certains souvenirs de scène sont flous, obsolètes ou manquants.

1. Ouvre **Chat Settings → Memory Recall**, ou clique sur **Fix** (corriger) dans la notification.
2. Clique sur **Fix**. Le bouton répare toutes les scènes qu'il peut avec le Helper model (le modèle auxiliaire) et ne touche jamais aux résumés que tu as modifiés.
3. Sélectionne chaque numéro de scène sous **need your review** (à vérifier), vérifie son texte et ses personnages dans **Access memories for this chat**, puis clique sur **Save correction** (enregistrer la correction).

Si **Fix** s'arrête sur une erreur, vérifie le compte du Helper model, puis clique sur **Resume processing** (reprendre le traitement) ou de nouveau sur **Fix**. Voir [Corriger les problèmes de mémoire](agents/memory.md#fixing-memory-problems).

### Les résumés ne se génèrent pas

Les résumés ont besoin d'un compte texte fonctionnel.

- Roleplay : ouvre **Chat Settings → Chat Summary**, vérifie qu'un compte est défini, et utilise **Backfill Summary** (rattraper le résumé) pour rattraper le retard d'un chat ancien.
- Conversation : ouvre **Automatic Summarization** (résumé automatique) et utilise **Backfill** (rattraper) pour retenter les jours en échec.
- Si ton chat exige une approbation d'écriture pour les agents, un résumé rédigé par l'IA attend ta relecture.
- Un résumé qui échoue à répétition, par exemple à cause d'une clé API invalide, est retenté plus tard. Corrige le compte, puis utilise **Backfill**.

## Problèmes avec les agents téléchargeables

- **Catalogue indisponible dans Agent Organizer.** L'ordinateur qui fait tourner le serveur, et pas seulement ton navigateur, doit pouvoir joindre le catalogue [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) en HTTPS. Les agents installés continuent de fonctionner hors ligne. Rétablis la connexion, puis clique sur **Refresh** (actualiser) ou **Try again** (réessayer).
- **Une carte ou un appel installé n'apparaît pas.** Ferme complètement Marinara, puis redémarre-le. Ces packages restent à l'état **Restart required** jusqu'au prochain démarrage. Les jeux de Conversation s'activent tout de suite. Si l'installation a échoué, actualise le catalogue et vérifie que le jeu est indiqué comme prêt. Ajouter un jeu dans les réglages **Commands** (commandes) d'un chat n'est nécessaire que pour que les personnages puissent le lancer eux-mêmes, pas pour sa commande slash manuelle.
- **La première migration des packages ne se termine pas.** Ne supprime ni `data/capability-packages` ni tes données de chat. Marinara réessaie au démarrage suivant, et les sélections de tes chats restent enregistrées.
- **`data/capability-runtime-snapshots` ou `data/capability-packages/versions` volumineux.** Inutile de faire le ménage. Marinara supprime les anciennes copies au démarrage et garde la version actuelle et la précédente de chaque agent.
- **Un téléchargement de package est refusé.** La somme de contrôle, la liste de fichiers, la plage de versions de Marinara ou les chemins de l'archive ne correspondent pas au catalogue officiel. Mets Marinara à jour, actualise le catalogue et réessaie. N'extrais pas un artefact à la main dans le dossier de données.
- **Mises à jour.** Les mises à jour d'agents ne s'appliquent jamais au démarrage. Marinara te demande d'abord. Avec **Not now** (pas maintenant), tu gardes la version installée, et le bouton **Update** (mettre à jour) reste disponible dans **Agents → Agent Organizer** (Agents → organisateur d'agents). Une mise à jour échouée laisse la version installée en place. Un environnement d'exécution serveur qui rate son contrôle de démarrage revient à la version précédente.

## Problèmes de Card Browser

Le **Card Browser** (navigateur de fiches) cherche sur les sites publics de personnages. Ouvre-le avec le bouton **Download** (télécharger) en haut du panneau **Characters** (personnages) ou **Personas** (personas).

- **JannyAI affiche un blocage Cloudflare.** Visite une fois le site JannyAI dans le même navigateur pour passer la vérification, puis réessaie.
- **La connexion à Pygmalion ne tient pas après un redémarrage.** C'est normal. Cette connexion ne vit que dans la mémoire du serveur. Ouvre la fenêtre de connexion et recolle ton token.
- **CharacterTavern affiche un avis au lieu des résultats.** C'est normal. Son nouveau site web ne propose plus la connexion qu'utilisait Marinara. Télécharge la fiche depuis character-tavern.com et importe le fichier.

## Problèmes de génération de médias

### Le nettoyage de l'arrière-plan d'un sprite peine sur une scène complexe

Les sprites générés utilisent normalement la transparence native ou un fond uni que Marinara retire. Une pièce photographiée, un décor détaillé, des ombres marquées ou des couleurs qui se confondent avec l'arrière-plan peuvent nécessiter la solution de secours par IA, qui est facultative :

```bash
pnpm backgroundremover:install
```

Redémarre ensuite Marinara et clique sur **Reapply Cleanup** (réappliquer le nettoyage) dans la fenêtre de génération de sprites. Marinara essaie d'abord le nettoyage intégré et n'utilise le modèle d'IA que si le bord ne paraît pas uniforme. Si l'installation échoue :

- Vérifie que Python 3.9 à 3.11 est installé. Les versions plus récentes peuvent imposer de lentes compilations natives.
- Lance `pnpm backgroundremover:reinstall`.
- Pour te passer de la solution de secours par IA pendant que tu cherches la panne, définis `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` dans `.env`.

### Les storyboards de Game Mode ou de Roleplay n'apparaissent pas

Les storyboards transforment une narration terminée en images-clés, avec des clips en option. Voir le [Guide de l'agent Storyboard](game/storyboard.md) et [Game Mode : premiers pas](game/getting-started.md).

- Installe **Storyboard** depuis **Agents → Agent Organizer**, puis active **Enable Agents** (activer les agents) et **Enable Storyboards** (activer les storyboards) pour le chat.
- Les images-clés ont besoin d'un compte d'images. Les clips ont aussi besoin d'un compte vidéo.
- Game, en automatique : ouvre **Chat Settings → Agents → Storyboards** et vérifie que **Automatic Storyboard Illustrations** (illustrations automatiques de storyboard) est activé. Active **Automatic Storyboard Animations** (animations automatiques de storyboard) pour les clips.
- Vidéo de scène manuelle : ouvre **Chat Settings → Gallery** (réglages du chat → galerie), génère ou téléverse une image, puis utilise **Video** (vidéo) ou **Animate** (animer). Regarde l'onglet **Videos**.
- Roleplay : ajoute l'agent **Storyboard** au chat. Choisis **Still images** (images fixes) ou **Animations**, règle **Messages per episode** (messages par épisode) et choisis le compte d'images. Avec **Manual only** (manuel uniquement), la génération part de **Create storyboard** (créer un storyboard) dans la section **Gallery** de **Chat Settings**.
- Si un prompt personnalisé fonctionne mieux avec tous les personnages réunis, désactive **Use NovelAI Character Prompts** (utiliser les prompts de personnage NovelAI).
- Les services lents peuvent dépasser le délai d'attente. Augmente `IMAGE_GEN_TIMEOUT_MS` ou `VIDEO_GEN_TIMEOUT_MS` dans `.env`, puis redémarre Marinara.
- `Outbound response exceeded 31457280 bytes` : par défaut, une réponse d'image de plus de 30 Mio échoue. Les fichiers ComfyUI qui intègrent le workflow et les images de référence peuvent atteindre cette taille. Augmente `IMAGE_GEN_MAX_RESPONSE_BYTES` dans `.env` et redémarre, ou désactive les métadonnées dans ComfyUI.

### La génération du monde en Game Mode affiche une erreur JSON

Si le modèle renvoie du JSON invalide (du texte structuré), Marinara ouvre la fenêtre **Repair JSON** (réparer le JSON) au lieu de jeter le tour.

1. Corrige les accolades, les virgules ou les champs dans l'éditeur. La bannière affiche **JSON is valid.** dès que le texte est analysable.
2. Clique sur **Format** (mettre en forme) pour remettre la présentation au propre.
3. Clique sur **Apply Repaired JSON** (appliquer le JSON réparé) pour l'utiliser sans régénérer la réponse.

## Voix, appels et TTS

- **Les personnages ne parlent pas pendant un appel.** Text to Speech (la synthèse vocale) n'est pas configuré. Ouvre **Connections → Text to Speech** (Connexions → Synthèse vocale), active-le, choisis une source, saisis ta clé, choisis une voix et enregistre. Un personnage sans voix apparaît uniquement en texte.
- **La voix s'arrête avec "No audio after N s".** Ton serveur vocal est plus lent que le délai d'attente de Marinara, ce qui est courant pour un serveur local sur un portable. `N` est ton délai d'attente actuel. Augmente **Request timeout (seconds)** (délai d'attente des requêtes, en secondes) dans **Connections → Text to Speech**, ou dans le compte audio que nomme le message. Voir [Délai d'attente des requêtes](media/tts-setup.md#request-timeout).
- **Le microphone ne fonctionne pas.** Installe **Calls** depuis **Agents → Agent Organizer**. Ouvre ensuite **Connections → Speech to text** (Connexions → Reconnaissance vocale), repère **Local speech model** (modèle vocal local) sous **On this device** (sur cet appareil), choisis un modèle Whisper et clique sur **Download Whisper** (télécharger Whisper). Firefox en a besoin, car il ne propose pas de reconnaissance vocale intégrée au navigateur. Désinstaller Calls supprime ses modèles Whisper. Tu peux aussi utiliser ton propre serveur : voir [Utiliser ton propre serveur de reconnaissance vocale](conversation/calls.md#use-your-own-speech-to-text-server).
- **Local Whisper is disabled in Lite mode.** L'image lite ne peut pas faire tourner le modèle vocal local. Utilise une installation complète.

### La connexion Spotify du Music DJ échoue sur une installation distante ou réseau

Le mode Spotify de l'agent Music DJ passe par OAuth, un transfert de connexion dans lequel Spotify te renvoie vers une adresse de rappel (l'URI de redirection). Spotify n'accepte que les adresses en `https://` ou `http://127.0.0.1`, et refuse les simples adresses IP de réseau.

- Sur localhost, l'éditeur affiche une adresse de rappel en `127.0.0.1`. Déclare-la auprès de Spotify.
- En HTTPS, l'éditeur affiche ton adresse de rappel HTTPS. Déclare celle-là.
- Si le HTTPS se termine en amont et que l'hôte ne correspond pas, définis `SPOTIFY_REDIRECT_URI` dans `.env` avec ton adresse de rappel publique.
- Sur une installation réseau en HTTP simple, la fenêtre pop-up ne peut pas se charger, mais sa barre d'adresse contient un code valide. Copie l'URL complète, déplie **Browser couldn't reach the callback?** sous le bouton Connect et colle-la. L'URL reste valide 10 minutes.

La solution la plus propre consiste à servir Marinara en HTTPS.

## Stockage et données

### Le serveur ne revient pas après Restart Server

Démarre Marinara avec `start.bat`, `start-local.bat`, `start.sh`, `start-termux.sh` ou `pnpm start`. Ces commandes gardent le serveur rattaché à son lanceur et démarrent un remplaçant une fois l'ancien processus terminé. Le redémarrage depuis l'application ferme les connexions persistantes après quatre secondes et force la sortie après huit. Une sortie forcée peut interrompre des écritures en attente. Les lancements directs avec `node` et les processus de surveillance de développement ne sont pas remplacés : arrête-les et relance-les toi-même. Docker utilise la politique de redémarrage de son conteneur. Sous Windows, appuie sur <kbd>Ctrl</kbd>+<kbd>C</kbd> dans la console du lanceur et attends **Shutdown complete** avant de la fermer.

Ne lance pas un second serveur sur le même dossier de données tant que le premier tourne encore. Arrête d'abord un processus resté actif.

### Le démarrage indique qu'un autre processus utilise peut-être le répertoire de données

Un seul serveur peut écrire dans un dossier de données local. Si le démarrage signale **Another Marinara Engine process ... may be using** le dossier, ferme l'autre processus Marinara et recommence.

Après un plantage ou le déplacement d'un volume Docker, le démarrage peut signaler **The storage writer lease ... is incomplete or invalid**, ou nommer un processus qui n'existe plus.

1. Vérifie que tous les processus et conteneurs Marinara qui utilisent ce dossier de données sont arrêtés.
2. Supprime uniquement le dossier `.writer-lease` nommé dans l'erreur.
3. Redémarre Marinara. Ne supprime pas le dossier `storage` ni aucun fichier de table.

Marinara libère de lui-même un bail d'écriture laissé par un processus planté sous Linux, sous Android, dans les conteneurs et sous Windows quand le dossier de données se trouve sur un disque local. L'étape manuelle est le repli pour le stockage réseau ou partagé, les lecteurs amovibles et (sous Windows) un ordinateur renommé après le plantage.

### Backup ou Export renvoie une erreur 403

Les sessions sur le même ordinateur peuvent faire des sauvegardes sans secret d'administration. Les requêtes venant d'un autre appareil, d'une adresse réseau, de Docker, ou d'un proxy ou d'un tunnel sur le même ordinateur en exigent un. Crée-le dans **Settings → Advanced → Admin Access** sur l'ordinateur du serveur lui-même, ou définis `ADMIN_SECRET` sur le serveur, puis enregistre la même valeur dans **Admin Access** sur l'autre appareil. Pour que la boucle locale l'exige aussi, définis `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`. Si `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`, les visiteurs transmis profitent du contournement local. Garde cette protection activée pour un proxy ou un tunnel public.

### L'import indique que le fichier n'est pas une archive ZIP lisible

Marinara lit les fiches `.charx`, les packages `.marinara`, les packages d'agent et les dépôts d'agents personnalisés comme des archives ZIP. Il refuse une archive endommagée, ou dont le contenu ne correspond pas à sa liste de fichiers, avec **The file is not a readable ZIP archive** (ou **Could not read .marinara package**). La cause habituelle est un téléchargement incomplet : télécharge de nouveau le fichier. Si tu as créé l'archive toi-même, recrée-la avec l'option de compression de ton système, `zip` ou 7-Zip.

**Package contains too many files** signifie qu'un package d'agent ou un dépôt contient plus de 8 192 fichiers. **.marinara package has too many entries** signifie qu'un package `.marinara` contient plus de 8 entrées. Retire les fichiers en trop et réessaie.

### Les emplois du temps de Conversation ou Noodle utilisent le mauvais fuseau horaire, ou affichent `Etc/Unknown`

Pour les emplois du temps de Conversation, choisis **Schedule timezone** (fuseau horaire des emplois du temps) dans les Chat Settings d'un chat Conversation ou dans l'éditeur d'emploi du temps d'un personnage. L'option **Use device** (utiliser l'appareil) le réinitialise.

Pour Noodle ou d'autres tâches du serveur, supprime toute ligne `TZ=` vide du `.env` et redémarre Marinara pour qu'il utilise le fuseau horaire de l'hôte. Pour en définir un, utilise un nom IANA comme `TZ=Europe/Warsaw`.

## Problèmes Android

### L'application Android reste bloquée sur Connecting ou Waiting for Server

L'application Android est une petite enveloppe autour de Termux, une application de terminal Linux pour Android qui fait tourner le vrai serveur Marinara.

1. Appuie sur **Install / Start Marinara**.
2. Si Android demande d'installer Termux, accepte les demandes.
3. Si Android demande d'exécuter des commandes dans Termux, accorde l'autorisation.
4. Attends que le lanceur démarre le serveur, puis reviens à l'application.

L'application crée son identifiant privé pour localhost et se connecte automatiquement. Tu n'as jamais de secret à coller. N'ajoute ni `null`, ni `http://null`, ni le secret de l'APK à `CSRF_TRUSTED_ORIGINS`.

Vérifie aussi que l'application et Termux utilisent le même port. Par défaut, c'est `7860`. Si tu as compilé l'application avec un autre port, définis la même valeur de `PORT` dans le `.env` de Termux.

<a id="android-localhost-opens-the-login-page-or-returns-401503"></a>

### Android localhost ouvre la page de connexion ou renvoie 401/503

Les installations Termux gérées par l'APK protègent localhost avec un secret privé propre à chaque installation, et l'application se connecte automatiquement. Si la page de connexion apparaît dans l'application, installe le [dernier APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk), appuie de nouveau sur **Install / Start Marinara** et reviens une fois Termux terminé.

Une erreur qui nomme l'origine `null` signale une ancienne paire APK et serveur. Modifier `.env` ne peut pas la corriger. Mets à jour l'APK et Marinara.

Pour ouvrir un navigateur sur le même téléphone, appuie sur **Open in browser** (ouvrir dans le navigateur) dans le lanceur Android, puis sur **Retry connection** (réessayer la connexion). Rouvre-le de cette façon après un redémarrage du serveur ou une session expirée. Pour revenir au lanceur, utilise **Settings → General → App Behavior → Open Android launcher (app or browser)** (Paramètres → Général → Comportement de l'application → Ouvrir le lanceur Android, application ou navigateur).

Les anciens APK se connectent sur `/android-login` avec la valeur de `cat ~/.marinara-engine/android-secret`. Un lien de navigateur ne fonctionne qu'une fois et expire après une minute : ouvres-en donc un nouveau depuis le lanceur.

- **401 :** le secret collé ou le défi d'authentification a été refusé. Recharge `/android-login` et colle la valeur actuelle.
- **503 :** le serveur a reçu un secret mal formé. Redémarre avec `./start-termux.sh`. Si le lanceur indique que son fichier de secret est invalide ou vide, appuie sur **Install / Start Marinara** dans l'application pour le recréer.

La commande locale `mari` lit automatiquement le même fichier. Garde le secret hors des captures d'écran et des rapports de problème.

### La mise à jour Android s'arrête avec le code de sortie 134

Android a manqué de mémoire pendant une étape de compilation. Relance le lanceur :

```bash
./start-termux.sh
```

Si ça s'arrête encore, ferme les autres applications, rouvre Termux et réessaie.

### Termux se ferme ou redémarre pendant l'exécution de Marinara

Le lanceur demande un wake lock, qui empêche la mise en veille, pendant que le serveur tourne, et enregistre chaque session dans `~/.marinara-engine/logs/`. Après un redémarrage inattendu, joins à ton rapport le fichier `server-*.log` le plus récent. S'il se termine sans erreur Marinara ou Node, c'est très probablement Android ou le fabricant du téléphone qui a arrêté Termux.

Dans les réglages Android, autorise Termux à s'exécuter en arrière-plan et désactive son optimisation de la batterie. Les commandes `termux-wake-lock` et `termux-wake-unlock` sont fournies avec une installation Termux standard. Ces réglages ne peuvent pas empêcher tous les arrêts propres aux fabricants.

### Marinara ne répond plus tant que Termux n'est pas remis au premier plan

Les chats restent bloqués sur "Opening chat...", l'application signale **Server unreachable**, le texte copié par Support Diagnostics affiche **Unreachable (request timed out)** pour les champs du serveur, et tout repart dès que tu ouvres Termux. Le mécanisme Android de gel des applications mises en cache a suspendu le processus Termux. Le téléphone accepte la connexion, mais le serveur gelé n'y répond jamais. Un wake lock n'empêche pas ce gel. Le journal de session montre un trou dans les horodatages pendant la période de gel, pas une erreur.

Exclus Termux de l'optimisation de la batterie, autorise son activité en arrière-plan, verrouille Termux dans l'écran des applications récentes si ton téléphone le permet, et garde sa notification visible. Si les gels continuent, garde Termux au premier plan ou l'écran allumé pendant que tu utilises Marinara.

### La mise à jour Android manque d'espace de stockage pendant l'installation des dépendances

Une empreinte temporaire importante pendant une mise à jour vient en général du magasin de dépendances de pnpm, après plusieurs versions ou une réinstallation interrompue. Le lanceur actuel élague les anciens paquets, et les mises à jour depuis l'application n'installent que les paquets pour Android. Si un ancien lanceur a rempli l'appareil, libère de l'espace et réessaie :

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Ne supprime ni `data`, ni `storage`, ni `marinara-engine.db`, car ils peuvent contenir tes chats et tes réglages. Si ça s'arrête encore, relève les lignes à partir de `Installing dependencies` et joins à ton rapport l'espace libre et la mémoire du téléphone.

### La mise à jour intégrée échoue en passant de Stable à Staging sur Android

Changer de canal impose une réinstallation quasi complète des dépendances, ce qui est lent sur le stockage de Termux. L'outil de mise à jour intégré accorde plus de temps à chaque étape. Si une mise à jour échoue quand même, l'erreur nomme l'étape en échec et affiche la fin de sa sortie. Une vraie erreur de dépendance ou de fichier de verrouillage y apparaît. Tu peux aussi faire la mise à jour à la main depuis Termux avec la commande que propose l'indication de l'erreur, ou libérer de l'espace au préalable :

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

## Problèmes Docker

### Permission refusée dans un conteneur sur un volume monté

- Volume nommé, après une mise à jour : lance `docker compose pull && docker compose up -d`. L'image officielle répare les droits de propriété au démarrage.
- Montage lié : rends le dossier hôte accessible en écriture à l'utilisateur et au groupe d'identifiant `1000`, ou utilise un volume nommé.
- Systèmes SELinux comme Fedora ou RHEL : ajoute le suffixe `:Z` au montage du volume.

### Le conteneur Lite plante sur un Raspberry Pi 4

Si l'image lite redémarre dès qu'elle envoie une requête à l'IA sur un Raspberry Pi 4 ou un appareil ARM similaire, regarde le code de sortie. Un code 132 ou un SIGILL (le processeur a rencontré une instruction qu'il ne sait pas exécuter) pointe vers un problème connu, en amont, dans la build de Node de l'image lite sur certaines puces ARM. Utilise l'image classique sur cet appareil.

<a id="a-server-extension-says-no-supported-sandbox-is-available"></a>

### Une Server Extension signale qu'aucun bac à sable pris en charge n'est disponible

Les Server Extensions et les commandes shell brutes de Professor Mari ne fonctionnent qu'avec Seatbelt de macOS ou Bubblewrap de Linux. Sur un hôte Linux natif, installe `bwrap` et redémarre Marinara. L'image Docker officielle inclut Bubblewrap, mais le conteneur par défaut ne peut pas créer ses espaces de noms imbriqués : Marinara garde donc ces fonctions désactivées.

Si tu acceptes des privilèges de conteneur plus larges, enregistre ceci comme `docker-compose.override.yml` à côté de `docker-compose.yml`, puis recrée le conteneur :

```yaml
services:
  marinara:
    environment:
      MARINARA_DOCKER_USER: root
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor=unconfined
```

> **Avertissement :** faire tourner le serveur en root avec `SYS_ADMIN` et sans profil AppArmor constitue une importante élévation de privilèges. Ne l'active pas uniquement pour faire disparaître ce message.

Le profil seccomp par défaut de Docker s'adapte aux capacités ajoutées : tu ne devrais donc pas avoir besoin de `seccomp=unconfined` avec les versions actuelles de Docker.

Windows, Android et les autres hôtes non pris en charge refusent d'exécuter une Server Extension. Les Browser Extensions s'exécutent toujours dans leur bac à sable.

## Problèmes d'extensions

### External Extensions n'apparaît pas dans Addons

La section reste masquée tant que les deux verrous ne sont pas ouverts.

1. Définis `ENABLE_EXTERNAL_EXTENSIONS=true` dans le `.env` de l'hôte.
2. Patiente un instant, puis ouvre **Settings → Advanced → Danger Zone** (Paramètres → Avancé → Zone de danger), fais défiler sous les commandes de suppression des données et active **Allow third-party extension imports** (autoriser les imports d'extensions tierces).

Si l'interrupteur est désactivé, l'indicateur de l'hôte est encore à faux, ou l'application n'a pas vu le changement. Vérifie que tu as modifié le `.env` actif décrit dans [Configuration du serveur](CONFIGURATION.md). Sur Docker, c'est normalement `/app/data/.env`.

Tant que l'un des verrous est fermé, les enregistrements d'extensions externes n'apparaissent pas et ne peuvent pas s'exécuter. Rouvrir les verrous ne les réactive pas.

### Une extension de navigateur importée s'affiche mais ne fonctionne pas

Ouvre-la dans **Settings → Addons → External Extensions** (Paramètres → Modules complémentaires → Extensions externes) et lis **Requested access** (accès demandés). Les anciens packages `marinara.extension` v1 sans déclaration de capacités affichent **Full page access** (accès complet à la page). N'approuve que l'empreinte exacte que tu as inspectée et à laquelle tu fais confiance.

Un package réexporté avec une liste de capacités vide est traité comme une extension de bac à sable sûre, et le code qui a besoin du DOM de la page ne fonctionnera pas. N'ajoute `full_page_access` à son manifeste que si tu acceptes que le code accède à toute la page, au stockage du navigateur, aux API réseau et à ta session.

Après avoir désactivé une extension à accès complet à la page, recharge Marinara s'il reste un élément de barre d'outils, une surcouche ou un écouteur. Le nettoyage se fait au mieux, car le code de la page peut produire des effets de bord que Marinara ne suit pas.

<a id="multiplayer-connection-or-turn-problems"></a>

## Problèmes de connexion ou de tours multijoueurs

| Symptôme | Solution |
| --- | --- |
| Commandes indisponibles | Mets `MULTIPLAYER_ENABLED=true` dans le `.env` du bon Marinara, redémarre-le, puis active le réglage séparément. L'enveloppe Android native ne peut pas rejoindre de salon. |
| Hôte indisponible | Utilise un port HTTPS de salon distinct et joignable, une chaîne de certificat et un nom d'hôte valides, et l'empreinte correspondante de l'invitation. Ne désactive pas les vérifications TLS, n'ajoute pas `null` aux origines de confiance, n'expose pas l'API normale et n'ouvre pas de client fourni par l'hôte. |
| En attente d'approbation | L'hôte doit t'approuver dans Players. Tu ne vois aucun historique avant l'approbation. Demande une nouvelle invitation si elle a expiré. |
| Déconnecté | Garde ton propre Marinara en marche. Il se reconnecte au même hôte tant que la session est active, et les brouillons non envoyés restent. Après un redémarrage, rejoins de nouveau le salon. Pour garder le même nom de persona, demande d'abord à l'hôte de retirer ton ancienne place. |
| Game en attente | Ouvre Players. Les joueurs déconnectés ne sont pas passés automatiquement. L'hôte peut choisir **Pass** (passer), **Kick** (expulser) ou **Pause** (mettre en pause). |
| Génération interrompue | Ne soumets pas de nouveau le tour. L'hôte doit vérifier la narration et l'état enregistrés, puis reprendre ou arrêter le salon. Le multijoueur ne rejoue jamais une requête au résultat incertain et n'applique jamais deux fois ses effets sur le monde. |
| Commande restreinte ou média absent | Les salons ne transportent que du texte. Voir la [matrice de compatibilité](development/multiplayer.md#command-and-feature-compatibility). N'installe pas de fichier ou d'extension fourni par un pair. |

Pour signaler une erreur de connexion, indique le mode, la plateforme, l'erreur visible et si l'approbation a fonctionné. Ne publie pas d'invitations, de mots de passe de salon, de jetons de session, d'historiques privés ni de clés API.

## L'installation en PWA sur Chrome pour Android échoue derrière une connexion

Utilise une adresse HTTPS, connecte-toi et recharge après la mise à jour de Marinara. L'application demande son manifeste avec les identifiants, donc la connexion peut rester activée. Si l'installation reste indisponible, vérifie que ton proxy renvoie `/manifest.json` au format JSON, et non une page de connexion ou une erreur.

<a id="get-more-help"></a>

## Obtenir de l'aide

1. Ouvre **Settings → Advanced → Message Tools** (Paramètres → Avancé → Outils de message) et active le **Debug mode**. Il écrit le prompt et la réponse dans la console du serveur.
2. Note ton système d'exploitation, ta version de Node.js et le texte complet de l'erreur affichée dans la console.
3. Retire les clés API, les jetons d'accès, les secrets d'administration et le contenu privé des chats avant de partager quoi que ce soit.

Contacte ensuite la communauté :

- Lis les [tickets ouverts](https://github.com/Pasta-Devs/Marinara-Engine/issues).
- Rejoins le [Discord](https://discord.com/invite/KdAkTg94ME).
- Signale un bug dans ces mêmes tickets GitHub, avec les informations ci-dessus.

## Guides associés

- [Foire aux questions](FAQ.md)
- [Référence de configuration du serveur](CONFIGURATION.md)
- [Accès à distance](REMOTE_ACCESS.md)
- [Mettre à jour Marinara Engine](UPGRADING.md)
- [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md)
- [Configuration du modèle intégré](connections/local-model.md)
- [Game Mode : premiers pas](game/getting-started.md)
- [Vue d'ensemble des paramètres](settings/settings-overview.md)

<details>
<summary>Mainteneurs : mettre à jour les environnements d'exécution locaux épinglés</summary>

Rien ne garantit que les archives sources générées par GitHub restent identiques octet pour octet, même quand le contenu de leur commit ne change pas. Ne "corrige" jamais l'écart signalé par un utilisateur en acceptant les octets vus sur sa machine, ni en affaiblissant la vérification. Ne réépingle les entrées d'environnement d'exécution que dans une modification relue de Marinara Engine :

1. Choisis une révision ou un fichier de release immuable en amont, et relis les changements en amont.
2. Télécharge l'artefact dans un dossier temporaire, note sa taille exacte en octets et calcule son empreinte SHA-256 de ton côté.
3. Mets à jour `runtime-integrity-manifest.ts` avec la révision, l'URL, la taille et l'empreinte. Pour MLX, régénère `packages/server/src/assets/mlx-runtime-requirements.lock` à partir de son fichier `.in` avec la version d'uv épinglée, sur Apple Silicon et Python 3.12, relis chaque changement de dépendance et mets à jour `requirementsLockSha256`.
4. Lance `pnpm regression:runtime-integrity`, `pnpm check` et une véritable installation propre de l'environnement d'exécution sur la plateforme concernée.
5. Publie la mise à jour relue de Marinara Engine avant de demander aux utilisateurs de réessayer. Ne propose pas de contournement manuel de la somme de contrôle.

</details>
