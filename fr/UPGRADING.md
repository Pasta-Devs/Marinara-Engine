# Mettre à jour Marinara Engine

Passe Marinara Engine à une version plus récente, vérifie les mises à jour dans l'application et reviens en arrière si quelque chose casse. Tes chats et tes réglages sont conservés lors d'une mise à jour.

## Quelle méthode de mise à jour me correspond ?

| Ton type d'installation | Comment mettre à jour |
| --- | --- |
| Installateur Windows ou `start.bat` | Ferme Marinara et rouvre-le. Voir [Windows](#windows). |
| macOS ou Linux | Relance `./start.sh`. Voir [macOS et Linux](#macos-and-linux). |
| Docker ou Podman | Récupère la nouvelle image et redémarre. Voir [Docker ou Podman](#docker-or-podman). |
| Application Android | Mets à jour l'APK, puis touche **Install / Start Marinara** (installer / démarrer Marinara). Voir [Android (Termux)](#android-termux). |
| iPhone ou iPad | Mets à jour l'appareil qui fait tourner le serveur. Voir [iPhone et iPad](#iphone-and-ipad). |

<a id="back-up-first"></a>

## Fais d'abord une sauvegarde

Fais une sauvegarde avant tout grand saut de version, et toujours avant un éventuel retour à une version plus ancienne.

1. Ouvre **Settings** (Paramètres).
2. Va dans l'onglet **Advanced** (avancé).
3. Repère la section **Backup & Export** (sauvegarde et export).
4. Clique sur **Download Backup** (télécharger la sauvegarde).
5. Enregistre le fichier `.zip` dans un endroit sûr.

Le bouton affiche **Creating backup…** pendant le traitement. À la fin, ton navigateur enregistre un `.zip` de tes données. Pour la restauration, voir [Sauvegarder et restaurer Marinara](data/backup-and-restore.md).

## Mise à jour selon la plateforme

Choisis la section qui correspond à ta façon d'installer Marinara. Une copie Git est une copie installée avec l'outil Git, ce qui inclut l'installateur Windows et tout `git clone`.

### Windows

Le lanceur met Marinara à jour à chaque démarrage.

1. Ferme Marinara Engine.
2. Rouvre-le depuis le raccourci du bureau ou du menu Démarrer, ou lance `start.bat`.

Le lanceur récupère le code le plus récent, réinstalle ce qui a changé, reconstruit et démarre la nouvelle version. Si tu as modifié le code toi-même, il met tes modifications de côté et les remet en place après la mise à jour. S'il n'y arrive pas, il garde ta version actuelle et affiche une note. Il copie tes données avant la mise à jour, et il saute une mise à jour qui mènerait à une version plus ancienne que tes données (voir [Revenir à une ancienne version](#downgrading-to-an-older-version)).

Pour sauter la mise à jour une seule fois, lance `start.bat --skip-update`. Pour garder ta version installée d'un démarrage à l'autre, mets `AUTO_UPDATE_ENABLED=false` dans le fichier `.env` du projet. Cela désactive seulement les mises à jour automatiques. Les commandes manuelles et **Settings → Advanced → Check for Updates** (Paramètres → Avancé → Vérifier les mises à jour) fonctionnent toujours.

Si le lanceur indique que Node.js est trop ancien, installe Node.js 24 LTS (Long Term Support, la version stable recommandée), puis relance Marinara. Tu peux aussi télécharger le tout dernier installateur depuis la page GitHub Releases et l'exécuter.

<a id="macos-and-linux"></a>

### macOS et Linux

1. Ferme Marinara Engine.
2. Exécute le lanceur depuis ton dossier Marinara.

```bash
./start.sh
```

Le lanceur récupère le code le plus récent, réinstalle les dépendances modifiées, reconstruit et démarre la nouvelle version. Utilise `./start.sh --skip-update` pour sauter la mise à jour une seule fois, ou `AUTO_UPDATE_ENABLED=false` dans `.env` pour désactiver les mises à jour automatiques. Si Node.js est trop ancien, installe Node.js 24 LTS et relance le lanceur.

<a id="docker-or-podman"></a>

### Docker ou Podman

Les conteneurs se mettent à jour en récupérant une nouvelle image, pas via le lanceur. Fais une sauvegarde, puis lance ceci depuis le dossier qui contient ton fichier Compose.

```bash
docker compose pull && docker compose up -d
```

Avec Podman, utilise plutôt `podman compose`. Les images de version sont `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` et `:latest`, avec les tags `-lite` correspondants. Récupérer une image ne touche pas à tes données du volume `marinara-data`. Voir [Installation en conteneur](installation/containers.md).

### Android (Termux)

Termux est l'application Android qui fait tourner un petit système Linux pour Marinara. Son lanceur met Marinara à jour à chaque exécution.

1. Ouvre Termux.
2. Exécute le lanceur.

```bash
cd Marinara-Engine
./start-termux.sh
```

Le lanceur met le code à jour, met Node.js à niveau si nécessaire, reconstruit et démarre le serveur. Si une mise à jour casse quelque chose et que tu veux rester sur ta copie actuelle, ajoute `--skip-update`. Pour désactiver les mises à jour automatiques, mets `AUTO_UPDATE_ENABLED=false` dans le fichier `.env` du projet.

Si tu utilises l'application Android (l'APK), [télécharge le dernier APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) et ouvre-le pour qu'Android mette l'application à jour. Ouvre ensuite Marinara Engine et touche **Install / Start Marinara** pour mettre à jour et démarrer la copie Termux. Une mise à jour ne te demande jamais d'identifiants de signature ni de secret.

<a id="iphone-and-ipad"></a>

### iPhone et iPad

Ces appareils ne font pas tourner le serveur. L'icône de l'écran d'accueil est une PWA, un site web enregistré sur l'écran d'accueil qui s'ouvre comme une application.

1. Mets à jour l'ordinateur, l'hôte de conteneurs ou l'appareil Android qui fait tourner ton serveur Marinara. Suis sa section ci-dessus.
2. Recharge l'application de l'écran d'accueil ou l'onglet Safari.

Si Safari continue d'afficher une ancienne build, réinstalle la PWA. Voir [Effacer et réinstaller la PWA](installation/ios-pwa.md#clearing-and-reinstalling-the-pwa).

<a id="manual-update-git-copy-no-launcher"></a>

### Mise à jour manuelle (copie Git, sans lanceur)

Utilise cette méthode si tu fais tourner une copie Git avec `pnpm start` au lieu du lanceur. Lance ces commandes depuis le dossier Marinara.

1. Récupère le code stable le plus récent.

```bash
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. Place-toi dessus.

```bash
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. Réinstalle les dépendances, reconstruis et démarre.

```bash
pnpm install --force --frozen-lockfile
pnpm build
pnpm start
```

Pour la version staging (de test), lance ces deux commandes à la place des étapes 1 et 2 :

```bash
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
git checkout -B staging origin/staging
```

> **Avertissement :** les builds staging sont des builds de test pré-publication. Sauvegarde tes données avant de les utiliser.

## Mettre à jour depuis l'application

Marinara peut interroger GitHub pour repérer une version plus récente. Certaines installations peuvent aussi appliquer la mise à jour depuis le navigateur.

1. Ouvre **Settings**.
2. Va dans l'onglet **Advanced**.
3. Repère la section **Updates** (mises à jour).

### Choisir un canal de publication

Le menu déroulant **Release Channel** (canal de publication) détermine les builds que tu suis.

- **Latest Stable** : les versions taguées `vX.Y.Z`. C'est le choix normal.
- **Staging/UAT** : les builds de test pré-publication, qui peuvent être inachevées. Le choisir affiche l'avertissement "Staging builds are pre-release tester builds. Back up your app data before applying them."

Quand tu choisis un autre canal dans un navigateur situé sur l'ordinateur même du serveur, le bouton de mise à jour affiche **Switch to** (passer à) suivi du nom du canal. Il fonctionne même quand les mises à jour ordinaires depuis l'application sont désactivées, et affiche **Switching…** pendant l'opération. Les appareils distants ne peuvent pas le faire, sauf s'ils remplissent les conditions décrites plus bas pour **Apply Update** (appliquer la mise à jour).

### Check for Updates

Clique sur **Check for Updates**. Le bouton affiche **Checking…** pendant le traitement. En dessous, tu vois ta version sous **Release**, le code de commit de ta build sous **Build** et, quand elle est connue, ta branche sous **Branch**.

- Si tu es à jour, une ligne verte indique "You're on the latest" avec ta version.
- Si une version plus récente existe, une carte affiche "vX.Y.Z available" avec un lien **Release notes** (notes de version).
- Si une copie Git est en retard, la carte affiche "N commits behind". Un commit est une modification enregistrée dans le code : ce décompte peut donc inclure du travail non publié.

La vérification de version est gardée en cache environ 15 minutes et le décompte de commits environ 5 minutes : un deuxième clic juste après peut donc afficher les mêmes chiffres.

Si la vérification échoue, tu vois "Could not check for updates. Try again later." C'est en général un problème de réseau ou de GitHub.

### Apply Update

Le bouton **Apply Update** met à jour une copie Git depuis le navigateur. Il n'apparaît que si toutes ces conditions sont remplies :

- L'installation est une copie Git. Les conteneurs et les autres installations ne peuvent pas appliquer de mise à jour de cette façon.
- La branche est `main`, `master` ou `staging`, ou bien la copie est un checkout détaché. Une copie sur toute autre branche compte comme un checkout de développement et Marinara refuse.
- Le propriétaire du serveur a mis `UPDATES_APPLY_ENABLED=true` dans le fichier `.env` du serveur.
- `UPDATES_APPLY_DISABLED` n'est pas défini. Il bloque toute application de mise à jour, y compris le changement de canal, et les lanceurs de développement le définissent.

Tu n'as pas besoin du secret d'administration pour appliquer la mise à jour depuis l'ordinateur qui fait tourner le serveur. Ouvre Marinara sur `http://127.0.0.1:7860` ou `http://localhost:7860`.

Deux réglages changent cela :

- Une adresse servie par un reverse proxy ou un tunnel compte comme un autre appareil. `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` fait compter ces visiteurs comme locaux, y compris pour le contournement local du secret d'administration. Laisse ce réglage activé pour un proxy ou un tunnel public.
- `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true` impose le secret même aux requêtes locales.

Appliquer une mise à jour depuis un autre appareil est désactivé par défaut. Il faut alors ces trois conditions :

- `UPDATES_ALLOW_REMOTE_APPLY=true` dans le `.env` du serveur.
- `ADMIN_SECRET` défini dans le `.env` du serveur. C'est un second mot de passe pour les actions risquées.
- Le même secret enregistré sur ton appareil dans **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur).

Clique sur **Apply Update**. Le bouton affiche **Updating…** pendant que le serveur récupère le code, réinstalle, reconstruit et s'arrête. Tu vois ensuite "Update applied successfully. Please relaunch the app to use the new version." Relance Marinara pour terminer.

Si ça n'a pas marché : quand le bouton **Apply Update** n'apparaît pas, Marinara explique pourquoi.

- Les installations en conteneur affichent le tag de l'image et la commande `docker compose pull && docker compose up -d` à lancer sur l'hôte.
- Les copies Git dont l'application des mises à jour est désactivée affichent une commande manuelle que tu peux copier.
- Les autres installations affichent un lien **Download** (télécharger) vers la version GitHub.

## Rafraîchir l'application dans ton navigateur

Le bouton **Refresh App** (rafraîchir l'application) se trouve dans la même section **Updates**. Il ne met pas le serveur à jour. Il supprime le service worker (un petit script que ton navigateur utilise pour charger l'application vite) et vide les caches du navigateur, puis recharge la page. Tes chats et tes réglages restent.

Utilise-le quand l'application semble ancienne ou reste blanche alors que le serveur est déjà à jour. Le bouton affiche **Refreshing…** pendant le traitement.

## Tes données et les téléchargements optionnels

Une mise à jour remplace le code de l'application, pas ton dossier de données ni le volume `marinara-data`. Tes chats, personnages, personas, lorebooks, presets, connexions et réglages restent en place. Pour savoir où se trouvent les données, lis [Sauvegarder et restaurer Marinara](data/backup-and-restore.md).

- **Packages optionnels.** Quand tu mets à jour depuis une version qui embarquait les agents, cartes, appels ou jeux Conversation d'origine, le premier démarrage télécharge les packages optionnels correspondants. Tes sélections, tes réglages et ton historique restent. Garde le serveur connecté pour ce premier démarrage. Si la source de téléchargement est injoignable, Marinara réessaie au démarrage suivant et ne supprime rien.
- **Langue des guides.** Si tu utilises une langue de documentation téléchargée, choisie dans **Settings → General → Documentation Language** (Paramètres → Général → Langue de la documentation), le premier démarrage après une mise à jour l'actualise. Si elle est injoignable, Marinara garde ton pack installé, affiche en anglais les guides manquants et réessaie au démarrage suivant.
- **Langue de l'interface.** Les packs de langue de l'interface sont un téléchargement séparé et manuel. Lors de la première mise à jour depuis une version qui incluait les traductions, l'interface revient à l'anglais. Choisis de nouveau ta langue dans **Settings → General → Language** (Paramètres → Général → Langue). Les mises à jour suivantes conservent les packs téléchargés. Utilise **Refresh language pack** (actualiser le pack de langue) pour obtenir les nouvelles traductions. Les traductions manquantes s'affichent en anglais.

<a id="updating-from-250"></a>

## Mettre à jour depuis la version 2.5.0

Les étapes ci-dessus restent les mêmes. Quelques changements touchent un serveur utilisé par d'autres appareils ou d'autres personnes. Ouvre les détails si c'est ton cas.

<details>
<summary>Changements pour les serveurs partagés</summary>

- **Un reverse proxy ou un tunnel sur le même ordinateur.** Les visiteurs que nginx, Caddy, Cloudflare Tunnel, Tailscale Serve ou ngrok transmettent à Marinara comptent désormais comme distants. Sans connexion, ils voient la page de configuration, et les sauvegardes et les autres actions protégées demandent le secret d'administration. Voir [Reverse proxies et tunnels sur le même ordinateur](REMOTE_ACCESS.md#reverse-proxies-and-tunnels-on-the-same-computer).
- **Exception de connexion Tailscale.** Les connexions directes vers l'adresse Tailscale de cet ordinateur passent toujours sans connexion. Les autres connexions depuis `100.64.0.0/10` ne passent plus sans connexion, et les visiteurs de Tailscale Serve et Funnel doivent se connecter. Voir [Contournement Tailscale et Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Docker avec un mot de passe ou une liste d'autorisation.** Avec une connexion définie (connexion d'application ou Basic Auth), le navigateur de l'ordinateur hôte doit désormais lui aussi la fournir. Il en va de même avec `TRUSTED_AUTH_PROXY`, sauf si c'est le proxy qui se connecte. Si seule `IP_ALLOWLIST` est définie, le navigateur de l'hôte est refusé à moins que tu ne listes la passerelle du conteneur : utilise donc une connexion. Voir [Contournement Tailscale et Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Chats et profils déplacés vers une autre installation.** Un journal de chat, un profil de réglages ou un profil complet n'emporte plus son **Discord Mirror** (miroir Discord), son **DeepLX URL** (URL DeepLX), sa **DeepL API Key** (clé API DeepL) ni son **Intiface URL** (URL Intiface) vers une autre installation. Saisis-les de nouveau là-bas. Tes propres profils, ainsi qu'un profil complet restauré sur la même installation, les conservent.
- **Verrouillé après une mise à jour ?** Voir [Verrouillé après une mise à jour](REMOTE_ACCESS.md#locked-out-after-updating).

</details>

<a id="downgrading-to-an-older-version"></a>

## Revenir à une ancienne version

Revenir en arrière n'est pas toujours possible. Les versions récentes enregistrent les données dans un format de stockage plus récent, et une build refuse les données dans un format plus récent que celui qu'elle connaît. Les builds actuelles utilisent le format de stockage 10. Les formats 8, 9 et 10 ont ajouté les avatars MMD, les liens entre connexions et comptes, et les avatars GLB/FBX. Une build qui ne connaît qu'un format plus ancien ne peut pas ouvrir les données enregistrées dans ces formats.

Le lanceur saute une mise à jour automatique qui mènerait à une version incompatible, et le programme de mise à jour intégré refuse d'en appliquer une. Pour revenir à une build plus ancienne, arrête Marinara et restaure une sauvegarde complète faite avant ta mise à jour. La commande de conversion des fichiers de chat ci-dessous ne peut pas convertir les réglages des avatars MMD. Ne change pas le numéro de format à la main.

Si tes données sont antérieures au format de stockage 8, une conversion en une seule commande peut remettre les fichiers de chat dans leur ancienne organisation. Voir [Les chats n'affichent aucun message après un retour à une ancienne version](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version).

<a id="going-back-to-250"></a>

### Revenir à la version 2.5.0

La version 2.5.0 ne peut pas ouvrir les données mises à niveau vers le format de stockage 8 ou plus récent. Utilise une sauvegarde faite avant la mise à niveau.

Avec des données plus anciennes qu'elle peut ouvrir, la version 2.5.0 ne connaît pas ce que les fonctionnalités plus récentes ont ajouté : certains réglages de connexion, les informations servant à régénérer les images du chat, et une partie des points de contrôle de jeu, des horloges d'ensemble de règles et des vidéos de scène. Quand la version 2.5.0 enregistre un chat ou une connexion, par exemple quand tu envoies un message, joues un tour de jeu, crées une image ou modifies une connexion, elle supprime ces données récentes de tout le chat ou de toute la connexion. Une nouvelle mise à jour ne les fait pas revenir.

Pour revenir exactement là où tu en étais, fais une sauvegarde avant de mettre à jour. Voir [Fais d'abord une sauvegarde](#back-up-first).

## Si une mise à jour échoue

La plupart des échecs viennent d'une version de Node.js trop ancienne, d'un téléchargement incomplet ou d'un cache de navigateur périmé.

- Si le lanceur indique que Node.js est trop ancien, installe Node.js 24 LTS et relance.
- Si l'application semble cassée après la mise à jour du serveur, clique sur **Refresh App**.
- Si une copie Git ne se met pas à jour proprement, utilise les commandes de [mise à jour manuelle](#manual-update-git-copy-no-launcher).

Pour les messages d'erreur et les correctifs, consulte [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md).

## Guides associés

- [Sauvegarder et restaurer Marinara](data/backup-and-restore.md)
- [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md)
- [Guide d'installation Windows](installation/windows.md)
- [Guide d'installation macOS / Linux](installation/macos-linux.md)
- [Lancer via un conteneur (Docker / Podman)](installation/containers.md)
- [Guide d'installation Android (Termux)](installation/android-termux.md)
- [Guide de la PWA iOS / iPadOS](installation/ios-pwa.md)
