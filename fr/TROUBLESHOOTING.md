# Résoudre les problèmes de Marinara Engine

Ce guide recense les problèmes courants de Marinara Engine et la façon de les régler. Repère la section qui correspond à ton symptôme, puis applique les étapes. Si rien ne fonctionne, va voir la dernière section, Obtenir de l'aide.

## Les premiers réflexes

Beaucoup de problèmes disparaissent en deux gestes rapides.

1. Recharge la page en forçant le rafraîchissement. Appuie sur **Ctrl+Shift+R** sous Windows ou Linux, ou sur **Cmd+Shift+R** sur un Mac.
2. Regarde la console du serveur (la fenêtre de terminal qui fait tourner Marinara) et cherche les lignes d'erreur en rouge. Ces lignes désignent en général le vrai problème.

Si tu demandes de l'aide à l'équipe, active d'abord le **Debug mode** (mode débogage) pour que le serveur enregistre le prompt et la réponse dans les logs. Le prompt, c'est le texte que Marinara envoie à l'IA, et le log est le journal du serveur. Voir Obtenir de l'aide à la fin de ce guide.

## Problèmes d'installation et de lancement

### Windows : erreur EPERM ou erreur de signature corepack pendant l'installation de pnpm

pnpm est le gestionnaire de paquets dont Marinara se sert pour installer son code. Si tu vois `EPERM: operation not permitted` ou un échec de vérification de signature corepack, c'est que corepack n'a pas pu écrire dans le dossier d'installation de Node.

Choisis l'une de ces solutions :

1. Fais un clic droit sur le terminal, choisis Exécuter en tant qu'administrateur, puis relance le lanceur.
2. Installe pnpm toi-même. Lance cette commande, puis relance le lanceur :

```bash
npm install -g pnpm
```

3. Mets corepack à jour dans un terminal administrateur, puis relance le lanceur :

```bash
npm install -g corepack
```

### Windows : `'pnpm' is not recognized` pendant la compilation du paquet partagé

Marinara v2.3.0 arrivait à démarrer pnpm via Corepack, puis échouait pendant la compilation du paquet partagé, parce que cette compilation tentait de lancer un second exécutable `pnpm`, global celui-là. La v2.3.1 supprime cette dépendance imbriquée. Ferme le lanceur en échec et relance `start.bat` : il récupérera le script de compilation corrigé avant de recompiler. Inutile de supprimer tes données.

Si le dépôt lui-même n'arrive pas à se mettre à jour, lance `git pull` dans le dossier Marinara puis redémarre. Contournement temporaire en v2.3.0 : installe globalement la version épinglée du gestionnaire de paquets, relance le lanceur, puis mets à jour normalement :

```bash
npm install -g pnpm@10.33.2
```

### Linux : ERR_PNPM_ENAMETOOLONG pendant l'installation

Cela signifie qu'une ancienne installation a laissé derrière elle des chemins de dossiers trop longs. Depuis le dossier Marinara, efface l'installation partielle puis relance le lanceur :

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Redémarre ensuite Marinara avec `./start.sh`. Si tu installes à la main, lance `pnpm install` après avoir supprimé ces dossiers.

### ERR_PNPM_TRUST_DOWNGRADE pendant l'installation

C'est presque toujours le signe d'une installation inachevée. Relance d'abord le lanceur pour qu'il répare l'espace de travail. Si tu installes à la main, lance cette commande unique depuis le dossier Marinara :

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Écran blanc, figé ou d'apparence ancienne

Il arrive que le serveur tourne mais que le navigateur affiche une page blanche, ou que l'application ressemble à une ancienne version après une mise à jour. Dans ce cas, le navigateur conserve une copie en cache de l'application web.

1. Force le rafraîchissement de la page (**Ctrl+Shift+R** ou **Cmd+Shift+R**).
2. Si ça ne suffit pas, ouvre **Settings** (Paramètres), va dans l'onglet **Advanced**, puis dans la section **Updates**, et clique sur **Refresh App**.

Le bouton **Refresh App** vide le service worker du navigateur (un script d'arrière-plan qui met l'application web en cache) ainsi que le cache du navigateur, puis recharge la page. Tes données ne bougent pas. Les chats, les réglages et les autres données locales restent intacts. En revanche, le code du serveur n'est pas mis à jour : ce n'est donc pas un substitut à une vraie mise à jour. Voir [Mettre à jour Marinara Engine](UPGRADING.md) pour mettre l'application elle-même à jour.

## Problèmes avec les agents téléchargeables

Si **Agents → Download Agents** indique que le catalogue est indisponible, c'est que la machine qui fait tourner le serveur Marinara (et pas seulement le navigateur) doit pouvoir joindre le catalogue officiel [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) via GitHub en HTTPS. Les agents déjà installés continuent de fonctionner hors ligne, dans leur version actuelle. Rétablis la connexion du serveur, puis clique sur **Refresh** ou **Try again** pour parcourir le catalogue et vérifier les mises à jour.

Si une carte ou un appel installé n'apparaît pas, ferme complètement Marinara Engine puis redémarre. Ces paquets, qui apportent leurs propres routes, restent à l'état **Restart required** jusqu'au prochain démarrage du processus. Les jeux de conversation, eux, fonctionnent autrement : les versions actuelles du moteur les activent à chaud, immédiatement. Actualise le catalogue si l'installation a échoué, puis vérifie que le jeu est bien indiqué comme prêt ; l'ajouter dans les réglages **Commands** d'un chat n'est nécessaire que si tu veux que les personnages le lancent eux-mêmes, pas pour la commande slash manuelle du jeu.

Si une installation plus ancienne n'arrive pas à terminer sa première migration de paquets, ne supprime ni le dossier `data/capability-packages` ni tes données de chat. Marinara laisse la migration inachevée et retente au démarrage suivant. Les sélections et les réglages de chat existants restent enregistrés tant que le catalogue est injoignable.

Les téléchargements de paquets sont refusés quand leur somme de contrôle, la liste de fichiers déclarée, la plage de versions du moteur ou les chemins de l'archive ne correspondent pas au catalogue officiel. Mets d'abord Marinara Engine à jour, actualise le catalogue et réessaie. N'extrais jamais un artefact à la main dans le dossier de données.

Les mises à jour d'agents ne sont jamais appliquées au démarrage. Quand une version plus récente et compatible existe, Marinara te demande si tu veux l'appliquer. Choisis **No** pour conserver la version installée ; le bouton **Update** reste disponible dans **Agents → Download Agents**. Une mise à jour échouée laisse elle aussi la version installée enregistrée, et un environnement d'exécution serveur fraîchement mis à jour qui rate son autodiagnostic de démarrage revient à la version précédente.

## Accéder à Marinara depuis un autre appareil

Si tu n'arrives pas à joindre Marinara depuis un téléphone, une tablette ou un autre ordinateur du réseau, passe ces points en revue.

- Fais écouter le serveur sur une adresse joignable. Par défaut, il écoute sur `127.0.0.1` (la boucle locale, ta machine et rien d'autre). Les lanceurs shell définissent `HOST=0.0.0.0` pour toi. Si tu as démarré à la main avec `pnpm start`, commence par définir `HOST=0.0.0.0` dans le fichier `.env`.
- Vérifie que les deux appareils sont sur le même réseau Wi-Fi.
- Vérifie qu'aucun pare-feu ne bloque le port. Le port par défaut est `7860`, ou celui que tu as défini dans `PORT`.
- Mets en place un contrôle d'accès. Pour les clients ordinaires du réseau ou publics, définis `BASIC_AUTH_USER` et `BASIC_AUTH_PASS` dans le fichier `.env`. La boucle locale reste sans mot de passe. Le trafic direct passant par Tailscale et par le pont Docker local, ou par une passerelle de conteneur détectée, est approuvé par défaut ; le trafic Docker relayé par un proxy exige une autorisation normale, sauf si tu définis explicitement `REQUIRE_AUTH_FOR_DOCKER_PROXY=false`.
- Pour les actions privilégiées depuis cet appareil (sauvegardes, effacement de données, mises à jour), définis `ADMIN_SECRET` dans le fichier `.env` du serveur. Colle ensuite la même valeur dans **Settings** > **Advanced** > **Admin Access** sur cet appareil et clique sur **Save**.
- Si tu passes par un domaine public ou un proxy inverse et que tu vois **Untrusted request host**, ajoute son nom d'hôte exact à `TRUSTED_HOSTS` dans le fichier `.env`. Les adresses IP directes utilisées par les téléphones, les ordinateurs du réseau local et les pairs Tailscale restent acceptées automatiquement.

Pour le guide complet, voir [Accès à distance](REMOTE_ACCESS.md) et la [Foire aux questions](FAQ.md).

## Enregistrement bloqué, ou réglages qui ne tiennent pas

Si un enregistrement semble réussir mais revient en arrière au rechargement, c'est la protection intersites de Marinara qui le bloque. La protection CSRF (falsification de requête intersites) surveille les actions qui modifient des données. Elle n'accorde sa confiance qu'à certaines origines de navigateur.

Un de ces deux signes, ou les deux, apparaît :

- Une bannière rouge en haut de l'écran qui prévient que les enregistrements échoueront silencieusement, cette origine n'étant pas approuvée.
- Une notification intitulée **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** ou **Save blocked: origin not trusted**.

La boucle locale, les adresses de réseau privé, Tailscale et le pont Docker sont approuvés automatiquement. Le problème n'arrive donc en général que si tu joins Marinara par une adresse IP publique ou un nom de domaine. Ajoute cette adresse à `CSRF_TRUSTED_ORIGINS` dans le fichier `.env`. Sépare les valeurs par des virgules s'il y en a plusieurs, par exemple :

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

Aucun redémarrage n'est nécessaire. La bannière propose un bouton Copy qui compose la ligne exacte pour toi. Voir [Accès à distance](REMOTE_ACCESS.md) pour en savoir plus.

## Erreurs de connexion et de génération

Les erreurs de génération apparaissent sous forme de notification en bas de l'écran. Si une connexion a échoué, la notification en donne la raison. Elle reste affichée assez longtemps pour être lue et copiée.

- **No API connection configured for this chat** : aucune connexion n'est sélectionnée pour ce chat. Ouvre le panneau **Connections**, crée une connexion, puis choisis-la pour le chat. Voir [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md). Une clé API est un code secret fourni par un fournisseur, qui autorise Marinara à utiliser ses modèles.
- Le modèle refuse un paramètre : la notification t'indique lequel. Ouvre **Chat Settings** (réglages du chat) > **Advanced Parameters** et repère ce paramètre. Désactive l'interrupteur à côté de son nom (l'infobulle indique "This parameter is sent to the model").
- Le modèle exige un paramètre : même manipulation, mais active l'interrupteur à côté du paramètre concerné.
- **The AI returned an empty response. Try sending your message again.** : renvoie ton message. Si le problème persiste, essaie un autre modèle ou une autre connexion.
- **A generation is already in progress for this chat** : une réponse est encore en cours de streaming, c'est-à-dire d'affichage au fil de l'écriture. Attends la fin ou clique sur le bouton Stop, puis réessaie.
- **No connections are marked for the random pool** : tu as activé le routage aléatoire des connexions sans désigner la moindre connexion pour le pool. Ajoute au moins une connexion au pool, ou désactive le routage aléatoire.

## Problèmes de Local Model

Le **Local Model** est un modèle d'IA qui tourne sur ta propre machine, sans clé API. Certains messages d'erreur emploient le mot sidecar pour désigner cette fonctionnalité.

- Si l'installation d'un environnement d'exécution échoue avec **Sidecar runtime install is disabled**, c'est que le serveur a désactivé cette action par sécurité. Sur ta propre machine, définis `SIDECAR_RUNTIME_INSTALL_ENABLED=true` dans le fichier `.env`. Depuis un autre appareil, colle d'abord ton secret administrateur dans **Settings** > **Advanced** > **Admin Access**.
- Si le téléchargement ou la configuration du modèle échoue depuis un autre appareil (une adresse réseau ou Docker), le secret administrateur peut lui aussi être nécessaire. Sur ta propre machine, il ne l'est pas. Le point précédent indique où coller le secret.
- Si une vérification de llama.cpp, de MLX, d'uv ou du verrou de dépendances MLX fournis signale une taille de fichier ou une empreinte SHA-256 qui ne correspond pas, Marinara a écarté ou refusé le fichier avant l'extraction ou l'installation. Mets à jour ou réinstalle Marinara, puis réessaie. N'exécute pas, ne décompresse pas, ne modifie pas et ne contourne pas manuellement le fichier rejeté.

### Mainteneurs : mettre à jour les environnements d'exécution locaux épinglés

Rien ne garantit que les archives sources générées par GitHub restent identiques octet pour octet, même quand le contenu de leur commit ne change pas. Ne "corrige" jamais l'écart signalé par un utilisateur en acceptant les octets vus sur sa machine, ni en affaiblissant la vérification. Les entrées d'environnement d'exécution se réépinglent uniquement dans une modification relue de Marinara Engine :

1. Choisis en amont une révision ou un fichier de release immuable, et relis les changements en amont.
2. Télécharge le fichier dans un dossier temporaire, note sa taille exacte en octets et calcule son empreinte SHA-256 de ton côté.
3. Mets à jour le fichier `runtime-integrity-manifest.ts` avec la révision, l'URL, la taille et l'empreinte. Pour MLX, régénère le fichier `packages/server/src/assets/mlx-runtime-requirements.lock` à partir de son fichier `.in`, avec la version d'uv épinglée, sur Apple Silicon et Python 3.12. Relis chaque changement de dépendance, puis mets à jour `requirementsLockSha256`.
4. Lance `pnpm regression:runtime-integrity`, `pnpm check`, ainsi qu'une véritable installation propre de l'environnement d'exécution sur la plateforme concernée.
5. Publie la mise à jour relue de Marinara Engine avant de demander aux utilisateurs de réessayer. Ne propose aucun contournement manuel de la somme de contrôle.

Pour la configuration complète, voir [Configurer le Local Model](connections/local-model.md).

## Mémoire et résumés

### Memory Recall ne rappelle rien

**Memory Recall** parcourt les messages précédents et réinsère discrètement les plus pertinents dans le prompt. Si rien ne semble mémorisé, vérifie ces points.

1. Ouvre **Chat Settings** > **Memory Recall** et vérifie que **Enable Memory Recall** est activé.
2. Ouvre **Access memories for this chat**. Dans la fenêtre **Memories for This Chat**, regarde le statut de chaque fragment.
3. Le statut **Waiting for vector** signifie que le souvenir est encore en cours de traitement. Attends, puis reprends le chat.
4. Le statut **Embedding unavailable** signifie qu'aucune source d'embedding ne fonctionne. Un embedding est une représentation numérique du texte. Configure une connexion d'embedding, ou laisse le modèle local intégré se charger. Voir [Configurer le Local Model](connections/local-model.md).

Un souvenir a besoin d'au moins 5 nouveaux messages pour être créé. Le rappel n'affiche par ailleurs que les souvenirs qui correspondent étroitement à ton nouveau message : il peut donc ne rien renvoyer alors même que des souvenirs existent.

### Les résumés ne se génèrent pas

Les résumés de chat ont besoin d'une connexion texte fonctionnelle pour être rédigés.

- En mode Roleplay, ouvre le panneau contextuel **Chat Summary** et vérifie qu'une connexion est définie. Utilise **Backfill Summary** pour rattraper le retard sur un chat ancien.
- En mode Conversation, ouvre **Automatic Summarization** et utilise **Backfill** pour retenter les jours en échec.
- Si ton chat exige une approbation d'écriture pour les agents, un résumé rédigé par l'IA attend ta relecture avant de prendre effet.
- Un résumé qui échoue à répétition (à cause d'une clé API invalide, par exemple) est retenté après un délai. Corrige la connexion, puis utilise **Backfill**.

## Problèmes de Card Browser

Le **Card Browser** te permet de chercher des personnages sur les sites publics et de les importer. Ouvre-le depuis l'icône **Card Browser** dans la barre du haut, puis clique sur **Download Cards**.

- Si une recherche JannyAI ou une page de personnage échoue sur un blocage Cloudflare, Marinara affiche un message. Il te demande de visiter une fois le site JannyAI dans le même navigateur pour passer la vérification Cloudflare, puis de réessayer.
- Si tes identifiants CharacterTavern ou Pygmalion cessent de fonctionner après un redémarrage du serveur, c'est normal. Ces identifiants ne vivent que dans la mémoire du serveur et disparaissent au redémarrage. Ouvre la fenêtre de connexion et recolle ton cookie ou ton token.

## Problèmes de génération de médias

### Le nettoyage de l'arrière-plan d'un sprite peine sur une scène complexe

Les sprites fixes générés (le sprite étant l'image du personnage sur le plateau) utilisent normalement la transparence native ou un fond uni adaptatif qui sert au détourage. Le nettoyage intégré reconnaît aussi les anciens fonds blancs, préserve les détails intérieurs du sujet, adoucit le bord alpha et supprime les débordements de la couleur de fond. Une pièce photographiée, un décor détaillé, des ombres portées marquées ou un sujet dont les couleurs se confondent avec l'arrière-plan peuvent malgré tout réclamer la solution de secours par IA, qui est facultative :

```bash
pnpm backgroundremover:install
```

Redémarre ensuite Marinara et clique sur **Reapply Cleanup** dans la fenêtre de génération de sprites. Marinara essaiera toujours la méthode de détourage intégrée en premier et n'emploiera le modèle d'IA que si le bord ne paraît pas uniforme. Si l'installation échoue :

- Vérifie que Python 3.9 à 3.11 est installé. Les versions plus récentes de Python peuvent imposer de lentes compilations natives.
- Recompile l'outil avec `pnpm backgroundremover:reinstall`.
- Pour forcer le nettoyage automatique par détourage sans la solution de secours par IA pendant que tu cherches la panne, définis `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` dans le fichier `.env`.

### Les storyboards de Game Mode ou de Roleplay n'apparaissent pas

Les storyboards de Game Mode transforment une narration du GM terminée en images-clés, avec des clips en option. Les storyboards de Roleplay réunissent les échanges terminés et affichent le résultat directement sous la réponse de l'IA.

- Vérifie que **Storyboard** est installé depuis **Agents** > **Download Agents**, puis active **Enable Agents** et **Enable Storyboards** pour le chat.
- Pour une vidéo de scène manuelle, génère ou téléverse d'abord une image dans la **Gallery**, puis utilise son action **Video** ou **Animate**. La **Gallery** répartit **Images** et **Videos** dans des onglets distincts : pense à regarder l'onglet **Videos**.
- Pour les storyboards automatiques de Game Mode, ouvre **Chat Settings** > **Agents** > **Storyboards** et vérifie que **Automatic Storyboard Illustrations** est activé. Active aussi **Automatic Storyboard Animations** si tu veux également des clips.
- En Roleplay, ajoute l'agent **Storyboard** au chat. Choisis **Still images** ou **Animations**, règle **Messages per episode**, puis sélectionne la connexion d'images du storyboard. Avec **Manual only**, la génération part plutôt de **Create storyboard** dans la **Gallery**.
- Les images-clés ont besoin d'une connexion d'images. Les clips ont en plus besoin d'une connexion vidéo.
- Si un prompt personnalisé donne de meilleurs résultats avec tous les personnages réunis, désactive **Use NovelAI Character Prompts**.
- Les fournisseurs lents peuvent atteindre le délai d'expiration. Augmente `IMAGE_GEN_TIMEOUT_MS` ou `VIDEO_GEN_TIMEOUT_MS` dans le fichier `.env`, puis redémarre Marinara. Le serveur ne lit ces valeurs qu'au démarrage.

Voir [Guide de l'agent Storyboard](game/storyboard.md) pour les deux méthodes et [Game Mode : premiers pas](game/getting-started.md) pour la configuration du jeu.

### La génération du monde en Game Mode affiche une erreur JSON

Si le lancement d'une partie échoue parce que le modèle a renvoyé du JSON invalide, Marinara ouvre la fenêtre **Repair JSON** au lieu de jeter tout le tour. Le JSON est le format de texte structuré que le modèle doit renvoyer.

1. Corrige les accolades, les virgules ou les champs dans l'éditeur. La bannière affiche **JSON is valid.** dès que le texte est analysable.
2. Clique sur **Format** pour remettre la présentation au propre.
3. Clique sur **Apply Repaired JSON** pour l'utiliser sans régénérer toute la réponse.

## Voix, appels et TTS

- Si les personnages ne parlent pas pendant un appel, c'est que Text to Speech (la synthèse vocale) n'est pas configuré. Ouvre **Connections** > **Text to Speech**, active la fonctionnalité, choisis une source, saisis ta clé, choisis une voix et enregistre. Un personnage sans voix apparaît uniquement en texte.
- Si le microphone ne fonctionne pas, il te faut peut-être le modèle de reconnaissance vocale local. Installe **Calls** depuis **Agents > Download Agents**, puis ouvre **Connections** > **Local Model**, déplie la fiche, repère **Local Speech Model**, choisis un modèle Whisper et clique sur **Download Whisper**. Firefox en a particulièrement besoin, car il ne propose pas de reconnaissance vocale intégrée au navigateur. Désinstaller Calls supprime ses modèles Whisper pour libérer de l'espace disque.
- Sur une version Lite, le message **Local Whisper is disabled in Lite mode** signifie que cette version allégée ne peut pas faire tourner le modèle de reconnaissance vocale local. Utilise plutôt une installation complète de Marinara.

### La connexion Spotify du Music DJ échoue sur une installation distante ou réseau

Le mode Spotify de l'agent Music DJ passe par OAuth. OAuth est un mécanisme de connexion déléguée : Spotify te renvoie ensuite vers une adresse de rappel. L'URI de redirection est cette adresse de rappel, et Spotify n'accepte que les adresses en `https://` ou l'adresse de boucle locale `http://127.0.0.1`. Il refuse les simples adresses IP de réseau.

- Si tu joins Marinara sur localhost, l'éditeur affiche une adresse de rappel en `127.0.0.1`. Déclare-la auprès de Spotify et la connexion aboutit.
- Si tu joins Marinara en HTTPS, l'éditeur affiche ton adresse de rappel HTTPS. Déclare celle-là.
- Si le HTTPS est terminé en amont et que l'hôte ne correspond pas, définis `SPOTIFY_REDIRECT_URI` dans le fichier `.env` avec ton adresse de rappel publique.
- Sur une installation réseau en HTTP simple, la fenêtre pop-up ne peut pas se charger, mais sa barre d'adresse contient tout de même un code valide. Copie l'URL complète depuis la fenêtre pop-up. Déplie ensuite **Browser couldn't reach the callback?** sous le bouton Connect et colle-la. L'URL collée reste valide 10 minutes.

La solution la plus propre sur le long terme consiste à placer le serveur derrière HTTPS. Dernière vérification avec Marinara Engine 2.2.0. Spotify a durci ces règles en février 2025.

## Stockage et données

### Des données semblent manquer après une mise à jour

Si tes chats ou tes presets semblent avoir disparu après une mise à jour, ne supprime encore aucun dossier de données. Marinara conserve tes données actives dans un dossier `storage`, à l'intérieur de son dossier de données.

Cherche un dossier `storage` à ces deux emplacements locaux :

1. `packages/server/data/`
2. `data/`

Le serveur affiche au démarrage les dossiers de données et de stockage qu'il a retenus.

### Backup ou Export renvoie une erreur 403

Les sessions en boucle locale peuvent créer des sauvegardes sans secret administrateur. Depuis un autre appareil, une adresse réseau ou Docker, les sauvegardes et les exports de profil en demandent davantage. Définis `ADMIN_SECRET` sur le serveur et enregistre la même valeur dans **Settings** > **Advanced** > **Admin Access**. Si tu veux que la boucle locale exige elle aussi le secret, définis `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`.

## Android et Docker

### L'application Android reste bloquée sur Connecting ou Waiting for Server

L'application Android est une simple enveloppe autour de Termux. Termux est une application de terminal Linux pour Android, et c'est elle qui fait tourner le vrai serveur Marinara.

1. Appuie sur **Install / Start Marinara**.
2. Si Android demande d'installer Termux, accepte les invites.
3. Si Android demande d'exécuter des commandes dans Termux, accorde l'autorisation.
4. Attends que le lanceur termine et démarre le serveur, puis reviens à l'application.

Vérifie aussi que l'application et Termux utilisent le même port. Par défaut, c'est `7860`. Si tu as compilé l'application avec un autre port, définis la même valeur de `PORT` dans le fichier `.env` de Termux.

### Android localhost ouvre la page de connexion ou renvoie 401/503

Les installations Termux gérées par l'APK protègent localhost avec un secret privé propre à chaque installation. L'application Android s'authentifie automatiquement. Dans un autre navigateur du même téléphone, ouvre `/android-login` et colle la valeur affichée par cette commande Termux :

```bash
cat ~/.marinara-engine/android-secret
```

La CLI `mari` locale lit automatiquement le même fichier. Une erreur 401 signifie que le secret collé ou une demande d'authentification a été refusé ; recharge `/android-login` et colle la valeur actuelle. Une erreur 503 signifie que le serveur a reçu un secret configuré au mauvais format. Redémarre avec `./start-termux.sh` ; si le lanceur signale que son fichier de secret est incorrect ou vide, retourne dans l'application Android et appuie sur **Install / Start Marinara** pour que l'APK le crée à nouveau. Ne mets pas ce secret dans une capture d'écran ou un rapport de problème.

### La mise à jour Android s'arrête avec le code de sortie 134

Le code de sortie 134 signifie en général qu'Android a manqué de mémoire pendant une étape de compilation. Relance la mise à jour depuis le dernier lanceur :

```bash
./start-termux.sh
```

Si ça s'arrête encore, ferme les autres applications Android, rouvre Termux et relance la commande.

### Termux se ferme ou redémarre pendant l'exécution de Marinara

Le lanceur demande un `wake lock` Android, qui empêche la mise en veille pendant l'exécution du serveur, et enregistre chaque session dans `~/.marinara-engine/logs/`. Après un redémarrage inattendu, joins au rapport le fichier `server-*.log` le plus récent. S'il se termine sans erreur Marinara ou Node, Android ou le fabricant du téléphone a très probablement arrêté Termux en dehors du processus serveur.

Autorise Termux à s'exécuter en arrière-plan et désactive son optimisation de la batterie dans les réglages Android. Sur les appareils compatibles avec l'extension Termux:API, installe cette extension et le paquet `termux-api` afin que `termux-wake-lock` soit disponible. Ces réglages ne peuvent pas empêcher tous les arrêts propres aux fabricants, mais ils éliminent la cause courante de suspension en veille, tandis que le journal persistant conserve les indices des échecs de l'application.

### La mise à jour Android manque d'espace de stockage pendant l'installation des dépendances

L'application Marinara compilée ne pèse pas plusieurs gigaoctets, et Noodle ne télécharge pas ses propres modèles d'IA. Une empreinte temporaire importante pendant une mise à jour vient en général du magasin de dépendances de pnpm et de son magasin virtuel, surtout après plusieurs versions ou une réinstallation forcée interrompue.

Le lanceur actuel élague les paquets hérités des versions précédentes et évite de reconstruire le magasin de dépendances plus d'une fois pour une même mise à jour. Si un ancien lanceur a déjà rempli l'appareil, mets le lanceur à jour et libère son cache non référencé avant de réessayer :

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Ne supprime ni `data`, ni `storage`, ni `marinara-engine.db` : ces emplacements peuvent contenir tes chats et tes réglages. Si la commande s'arrête encore, relève les lignes à partir de `Installing dependencies` et joins au rapport l'espace libre et la mémoire du téléphone.

### La mise à jour intégrée échoue en passant de Stable à Staging sur Android

Changer de canal (Stable ↔ Staging) impose une réinstallation quasi complète des dépendances, ce qui, sur le stockage plus lent de Termux, prend bien plus de temps qu'une mise à jour ordinaire. L'outil de mise à jour intégré accorde désormais plus de temps à chaque étape sur Android : un changement de canal qui s'arrêtait autrefois sur un laconique `Update failed: Command failed: corepack pnpm ... install` devrait aller au bout.

Si une mise à jour échoue quand même, l'erreur nomme désormais l'étape fautive et inclut la fin de sa sortie. Lis ce message : une vraie erreur de dépendance ou de fichier de verrouillage y est signalée. Autre option : lancer la mise à jour à la main depuis Termux avec la commande manuelle indiquée dans l'indication de l'erreur, ou libérer de l'espace au préalable :

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

### Noodle affiche `Etc/Unknown` ou les emplois du temps utilisent le mauvais fuseau horaire

Pour les emplois du temps en Conversation, ouvre les **Chat Settings** du mode Conversation ou l'éditeur d'emploi du temps d'un personnage et choisis **Schedule timezone**. Ce choix global s'applique à tous les chats Conversation, y compris aux messages autonomes d'arrière-plan, et se réinitialise avec **Use device**.

Pour Noodle ou pour les tâches du serveur sans réglage Conversation qui les remplace, supprime toute ligne `TZ=` vide du fichier `.env` et redémarre Marinara, afin que le serveur hérite du fuseau horaire de l'hôte. Pour choisir explicitement un fuseau de repli côté hôte, indique un nom IANA valide, par exemple `TZ=Europe/Warsaw` ou `TZ=America/New_York`. Les versions actuelles considèrent une valeur vide comme non définie, mais un redémarrage reste nécessaire pour que l'état du fuseau horaire de Node et les tâches planifiées soient reconstruits de façon cohérente.

### Permission refusée dans un conteneur sur un volume monté

Si un conteneur Docker ou Podman échoue avec des erreurs de permission sur le volume de données :

- Pour les volumes nommés après une mise à jour, récupère la dernière image et redémarre avec `docker compose pull && docker compose up -d`. L'image officielle répare les droits de propriété au démarrage.
- Pour les montages liés, rends le dossier hôte accessible en écriture aux identifiants d'utilisateur et de groupe `1000`, ou utilise plutôt un volume nommé.
- Sur les systèmes SELinux comme Fedora ou RHEL, ajoute le suffixe `:Z` au montage du volume.

### Le conteneur Lite plante sur un Raspberry Pi 4

Si le conteneur lite redémarre dès qu'il envoie une requête à l'IA sur un Raspberry Pi 4 ou un appareil ARM similaire, regarde le code de sortie. Un code 132 ou un SIGILL pointe vers un problème connu, en amont, dans la compilation de Node de l'image lite sur certaines puces ARM. SIGILL signifie que le programme a rencontré une instruction que le processeur ne sait pas exécuter.

L'image classique (non lite) n'est pas concernée. En attendant le correctif en amont, utilise l'image classique sur cet appareil. Les images lite connues comme affectées comprennent `1.5.7-lite` et `1.5.8-lite`. Dernière vérification avec Marinara Engine 2.2.0.

### External Extensions n'apparaît pas dans Addons

La section est volontairement masquée tant que les deux verrous de sécurité ne sont pas ouverts :

1. Définis `ENABLE_EXTERNAL_EXTENSIONS=true` dans le fichier `.env` de l'hôte.
2. Patiente environ deux secondes, le temps que le surveillant de configuration réagisse, puis ouvre **Settings → Advanced → Danger Zone**, fais défiler sous les commandes de suppression des données et active **Allow third-party extension imports**.

Si l'interrupteur de la Danger Zone est désactivé, c'est que l'indicateur côté hôte est encore à faux, ou que l'application n'a pas encore vu le changement. Vérifie que tu as bien modifié le fichier `.env` actif décrit dans [Configuration du serveur](CONFIGURATION.md). Sur Docker, c'est normalement `/app/data/.env`.

Tant que l'un des deux verrous est fermé, les extensions externes, héritées, importées depuis un profil, stockées manuellement ou d'origine inconnue n'apparaissent pas et ne peuvent pas s'exécuter. Rouvrir les verrous ne les réactive pas automatiquement.

### Une extension de navigateur importée s'affiche mais ne fonctionne pas

Ouvre l'extension dans **Settings → Addons → External Extensions** et examine la section **Requested access**. Les paquets plus anciens, au format `marinara.extension` v1 et sans déclaration de capacités, doivent afficher **Full page access**. N'approuve que l'empreinte exacte que tu as inspectée et à laquelle tu fais confiance.

Si un ancien paquet a été réexporté avec une liste de capacités explicitement vide, Marinara le traite comme une extension de bac à sable sûre : le code qui dépend du DOM n'y fonctionne pas. N'ajoute `full_page_access` à son manifeste que si tu mesures la conséquence : le code accède alors à toute la page Marinara, au stockage du navigateur, aux API réseau et à la session de même origine.

Après avoir désactivé une extension à accès complet, recharge Marinara s'il reste un élément de la barre d'outils, une surcouche, un écouteur ou un changement visuel. Le nettoyage se fait au mieux, car le code de la page peut produire des effets de bord en dehors de l'API de compatibilité suivie par Marinara.

### Une Server Extension signale qu'aucun bac à sable pris en charge n'est disponible

Les Server Extensions ne s'exécutent qu'avec Seatbelt sur macOS ou Bubblewrap sur Linux. Installe `bwrap` sur l'hôte Linux, puis redémarre Marinara. Windows, Android et les autres hôtes non pris en charge refusent délibérément d'exécuter une Server Extension plutôt que de se rabattre sur le processus serveur principal. Les Browser Extensions peuvent toujours utiliser leur bac à sable Worker à origine opaque.

## Obtenir de l'aide

S'il te faut encore de l'aide, commence par rassembler des informations précises.

1. Ouvre **Settings** > **Advanced** > **Message Tools** et active le **Debug mode**. Les contenus du prompt et de la réponse sont alors écrits dans la console du serveur, ce qui te permet de les partager.
2. Note ton système d'exploitation, ta version de Node.js et le texte complet de l'erreur affichée dans la console du serveur.

Avant de partager une sortie de débogage, retire les clés API, les tokens d'accès, les secrets administrateur, les prompts privés et le contenu privé des chats.

Contacte ensuite la communauté :

- Consulte les tickets ouverts sur https://github.com/Pasta-Devs/Marinara-Engine/issues
- Rejoins le Discord pour obtenir de l'aide de la communauté sur https://discord.com/invite/KdAkTg94ME
- Signale un bug sur https://github.com/Pasta-Devs/Marinara-Engine/issues avec les informations réunies ci-dessus.

## Guides associés

- [Foire aux questions](FAQ.md)
- [Référence de configuration du serveur](CONFIGURATION.md)
- [Accès à distance](REMOTE_ACCESS.md)
- [Mettre à jour Marinara Engine](UPGRADING.md)
- [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md)
- [Configurer le Local Model](connections/local-model.md)
- [Game Mode : premiers pas](game/getting-started.md)
- [Vue d'ensemble des paramètres](settings/settings-overview.md)
