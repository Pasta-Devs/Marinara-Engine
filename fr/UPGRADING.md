# Mettre à jour Marinara Engine

Ce guide explique comment passer Marinara Engine à une version plus récente. Il couvre chaque type d'installation, les outils de mise à jour intégrés à l'application, et la marche à suivre quand une mise à jour échoue. Les chats et les réglages sont conservés lors d'une mise à jour.

## Tes données sont préservées

Mettre à jour Marinara Engine ne supprime aucune donnée. Les chats, les personnages, les personas, les lorebooks, les presets, les connexions et les réglages restent en place.

Marinara range les données dans un dossier de données local, sur la machine qui fait tourner le serveur. Avec Docker et Podman, elles se trouvent dans le volume `marinara-data`. Une mise à jour remplace uniquement le code de l'application, pas ce dossier ni ce volume.

Quand tu viens d'une version qui embarquait les agents, cartes, appels ou jeux Conversation d'origine, le premier démarrage télécharge les packages optionnels correspondants depuis le catalogue officiel. Les sélections faites dans les chats, les réglages des agents, les données d'exécution stockées et l'historique sont préservés. Garde le serveur connecté pour ce premier démarrage. Si le catalogue est injoignable, Marinara relance la migration au démarrage suivant plutôt que de supprimer ou de désactiver ta configuration enregistrée.

Si tu utilises une langue de documentation téléchargée (**Settings** (Paramètres) → **General** → **Documentation Language**), le premier démarrage après une mise à jour vérifie aussi les changements de ce pack de langue et le rafraîchit automatiquement. Si la source de téléchargement est injoignable, Marinara conserve le pack installé (les guides qui y manquent s'affichent en anglais) et retente au démarrage suivant. Une mise à jour ne réinitialise jamais ton choix de langue.

Pour savoir où vivent tes données et comment en enregistrer une copie, consulte [Sauvegarder et restaurer Marinara](data/backup-and-restore.md).

## Fais d'abord une sauvegarde

Les mises à jour sont sûres, mais une sauvegarde coûte peu et rassure. Fais-en une avant tout grand saut de version.

1. Ouvre **Settings**.
2. Va dans l'onglet **Advanced**.
3. Repère la section **Backup & Export** (sauvegarde et export).
4. Clique sur **Download Backup** (télécharger la sauvegarde).
5. Enregistre le fichier `.zip` dans un endroit sûr.

Le bouton affiche **Creating backup…** pendant le traitement. À la fin, le navigateur enregistre une archive `.zip` de tes données.

La marche à suivre complète pour sauvegarder et restaurer se trouve dans [Sauvegarder et restaurer Marinara](data/backup-and-restore.md).

## Mise à jour selon la plateforme

Choisis la section qui correspond à ta façon d'installer Marinara. Un "git checkout" ci-dessous désigne une copie installée avec l'outil Git. Un "clone" est une copie téléchargée avec Git.

### Windows

Si tu es passé par l'installateur Windows ou par un git checkout, le lanceur te met à jour automatiquement.

1. Ferme Marinara Engine.
2. Rouvre-le depuis le raccourci du menu Démarrer, ou lance `start.bat`.

Le lanceur récupère le code le plus récent, réinstalle ce qui a changé, reconstruit l'application et démarre la nouvelle version. Cela fonctionne aussi bien avec l'installateur qu'avec un clone manuel.

Pour un seul démarrage, lance `start.bat --skip-update`. Pour conserver la version installée du moteur d'un démarrage à l'autre, mets `AUTO_UPDATE_ENABLED=false` dans le fichier `.env` du projet. Cela désactive seulement les mises à jour automatiques du moteur ; les commandes manuelles et **Settings → Advanced → Check for Updates** restent disponibles.

Si le lanceur indique que Node.js est trop ancien, installe Node.js 24 LTS, puis relance Marinara. LTS signifie Long Term Support, la version stable recommandée de Node.js.

Autre option : télécharge le tout dernier installateur depuis la page GitHub Releases et exécute-le. Il emprunte le même chemin basé sur Git, donc les futures mises à jour passent toujours par le lanceur.

### macOS et Linux

Ferme Marinara Engine, puis lance le lanceur depuis ton dossier Marinara.

```bash
./start.sh
```

Le lanceur récupère le code le plus récent, réinstalle les dépendances modifiées, reconstruit et démarre la nouvelle version.

Utilise `./start.sh --skip-update` pour un seul démarrage, ou mets `AUTO_UPDATE_ENABLED=false` dans le fichier `.env` pour une désactivation durable. Les commandes de mise à jour manuelles et les contrôles de mise à jour intégrés à l'application restent disponibles.

Si le message dit que Node.js est trop ancien, installe Node.js 24 LTS, puis relance le lanceur.

### Docker ou Podman

Les installations en conteneur se mettent à jour en récupérant une nouvelle image, pas via le lanceur. Lance ceci depuis le dossier qui contient ton fichier Compose.

```bash
docker compose down && docker compose pull && docker compose up -d
```

Pour Podman, utilise les mêmes commandes avec `podman`.

```bash
podman compose down && podman compose pull && podman compose up -d
```

Les images de version sont publiées sous `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` et `:latest`, avec les tags `-lite` correspondants. Récupère `:latest` ou le tag de version le plus récent, sauf si tu veux rester volontairement sur une version antérieure. Un `pull` ne touche pas aux données du volume `marinara-data`.

### Android (Termux)

Termux est un terminal et un environnement Linux pour Android. Son lanceur met Marinara à jour à chaque exécution.

1. Ouvre Termux.
2. Lance le lanceur.

```bash
cd Marinara-Engine
./start-termux.sh
```

Le lanceur met le code à jour, met Node.js à niveau si nécessaire, reconstruit et démarre le serveur local.

Si une mise à jour est défectueuse et que tu dois rester sur ta copie actuelle, saute plutôt la vérification de mise à jour.

```bash
cd Marinara-Engine
./start-termux.sh --skip-update
```

Pour une désactivation durable, mets `AUTO_UPDATE_ENABLED=false` dans le fichier `.env` du projet. Cela ne concerne que les mises à jour du moteur pilotées par le lanceur ; les mises à jour manuelles et les contrôles intégrés à l'application restent disponibles.

Si tu utilises l'icône de l'application Android (l'APK), [télécharge le dernier APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) et ouvre le fichier téléchargé pour qu'Android mette à jour l'enveloppe elle-même. Ouvre ensuite Marinara Engine et touche **Install / Start Marinara** pour mettre à jour et démarrer la copie Termux. L'application conserve et échange automatiquement son identifiant privé pour localhost ; une mise à jour ne demande jamais d'identifiants de signature ni ce secret.

### iPhone et iPad

L'iPhone et l'iPad ne font pas tourner le serveur Marinara. Ils ouvrent, via Safari, un serveur hébergé sur un autre appareil. La copie posée sur ton écran d'accueil est une PWA, abréviation de Progressive Web App. Une PWA est un site web que tu ajoutes à l'écran d'accueil pour qu'il s'ouvre comme une application.

1. Mets à jour l'ordinateur, l'hôte Docker ou l'appareil Android qui fait réellement tourner ton serveur Marinara. Reporte-toi à la section de cet appareil ci-dessus.
2. Recharge la PWA de l'écran d'accueil ou l'onglet Safari sur ton iPhone ou ton iPad.

Si Safari continue d'afficher une ancienne version alors que l'hôte est à jour, réinitialise la copie en cache.

1. Supprime l'icône de l'écran d'accueil.
2. Efface les données de site Safari pour l'hôte Marinara.
3. Rajoute-la à l'écran d'accueil.

## Vérifier et appliquer les mises à jour depuis l'application

Marinara sait interroger GitHub pour repérer une version plus récente sans quitter l'application. Certaines installations peuvent aussi appliquer la mise à jour depuis le navigateur.

1. Ouvre **Settings**.
2. Va dans l'onglet **Advanced**.
3. Repère la section **Updates** (mises à jour).

### Release Channel

Le menu déroulant **Release Channel** (canal de publication) détermine les versions que tu suis. Il propose deux choix.

- **Latest Stable** : suit les versions taguées `vX.Y.Z`. C'est le choix normal pour la plupart des utilisateurs.
- **Staging/UAT** : suit les versions de test pré-publication. Elles peuvent être inachevées. Sauvegarde tes données avant de les utiliser.

Choisir **Staging/UAT** affiche un avertissement : "Staging builds are pre-release tester builds. Back up your app data before applying them."

Changer de canal est traité comme un choix délibéré. Quand tu sélectionnes un autre canal depuis un navigateur situé sur la machine qui fait tourner le serveur, le bouton de mise à jour devient **Switch to** suivi du nom du canal, et il fonctionne même si les mises à jour intégrées à l'application sont désactivées. Il affiche **Switching…** pendant l'opération. Les mises à jour normales dans le même canal exigent toujours la configuration décrite plus bas sous Apply Update, et les appareils distants aussi.

### Check for Updates

Clique sur **Check for Updates** (vérifier les mises à jour). Le bouton affiche **Checking…** pendant le traitement.

Sous le bouton apparaissent ta version **Release** et le code de commit de ton **Build**. Une ligne **Branch** s'affiche également quand la branche est connue.

- Si tu es à jour, une ligne verte cochée indique "You're on the latest ... target" avec ta version.
- Si une version plus récente existe, une carte affiche "vX.Y.Z available" avec un lien **Release notes**.
- Sur une installation Git simplement en retard, la carte affiche plutôt "N commits behind". Un commit est une modification enregistrée dans le code : ce décompte peut donc inclure du travail non publié.

Les résultats de la vérification sont mis en cache. La vérification de la version publiée est gardée en cache environ 15 minutes. Le décompte "commits behind" est gardé environ 5 minutes. Recliquer aussitôt sur **Check for Updates** peut donc afficher les mêmes chiffres.

### Apply Update

Le bouton **Apply Update** (appliquer la mise à jour) n'apparaît que si ton installation peut se mettre à jour toute seule depuis le navigateur. Deux conditions sont nécessaires.

- Une installation basée sur Git (Docker et les installations packagées ne peuvent pas procéder ainsi).
- Le propriétaire du serveur a mis `UPDATES_APPLY_ENABLED=true` dans le fichier `.env` du serveur. Le fichier `.env` contient les réglages du serveur.

Si tu cliques sur **Apply Update** depuis la machine qui fait tourner le serveur, cela suffit. Aucun secret n'est demandé sur place.

Appliquer une mise à jour depuis un autre appareil est désactivé par défaut. Trois conditions sont alors nécessaires.

- Le propriétaire du serveur a mis `UPDATES_ALLOW_REMOTE_APPLY=true` dans le fichier `.env`.
- Le propriétaire du serveur a défini `ADMIN_SECRET` (un mot de passe pour les actions protégées) dans le fichier `.env`.
- Tu as enregistré ce même secret dans **Settings -> Advanced -> Admin Access** sur ton appareil.

Quand tu cliques sur **Apply Update**, le bouton affiche **Updating...**. Le serveur récupère le nouveau code, réinstalle les dépendances, reconstruit, puis s'arrête. Tu vois alors : "Update applied successfully. Please relaunch the app to use the new version." Relance Marinara pour terminer.

Si **Apply Update** n'est pas disponible, Marinara explique pourquoi et propose une alternative.

- Les installations en conteneur affichent le tag de l'image et la commande `docker compose pull && docker compose up -d` à lancer sur l'hôte.
- Les installations Git dont l'application automatique est désactivée affichent une commande de mise à jour manuelle que tu peux copier.
- Les autres installations affichent un lien **Download** vers la version GitHub.

Si la vérification elle-même échoue, tu vois : "Could not check for updates. Try again later." C'est en général un souci de réseau ou un souci du côté de GitHub : réessaie dans un moment.

## Le bouton Refresh App

Le bouton **Refresh App** (rafraîchir l'application) se trouve dans la même section **Updates**. Ce n'est pas une mise à jour du serveur. Il rafraîchit seulement l'application dans le navigateur en cours.

**Refresh App** désinscrit le service worker, vide les caches du navigateur, puis recharge la page. Un service worker est un petit script que le navigateur utilise pour charger l'application vite et hors ligne. Les chats, réglages et autres données locales enregistrés restent intacts.

Utilise **Refresh App** quand l'application semble figée sur une ancienne version ou affiche un écran blanc après une mise à jour, alors que le serveur tourne déjà sur la nouvelle version. Cela répare une page web bloquée. Le code du serveur n'est pas touché : ce n'est donc pas un substitut à une vraie mise à jour.

Le bouton affiche **Refreshing…** pendant le traitement, puis l'application se recharge.

## Revenir à une ancienne version

Les mises à niveau sont toujours sûres, mais revenir directement en arrière n'est pas toujours possible. Les versions récentes de Marinara stockent les messages dans un format sur disque plus récent qu'une ancienne version ne peut pas lire. Pour protéger votre historique, le lanceur ignore les mises à jour automatiques vers une version incompatible et le programme de mise à jour intégré refuse de les appliquer.

Si vous avez tout de même besoin d'une ancienne version, une commande de conversion remet d'abord vos données dans l'ancien format. Consultez [Les chats n'affichent aucun message après un retour à une ancienne version](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version) pour suivre les étapes.

## Si une mise à jour échoue

La plupart des problèmes de mise à jour viennent d'une version de Node.js trop ancienne, d'un téléchargement incomplet ou d'un cache de navigateur périmé.

- Si le lanceur signale que Node.js est trop ancien, installe Node.js 24 LTS et relance.
- Si l'application semble cassée après la mise à jour du serveur, essaie le bouton **Refresh App** ci-dessus.
- Si une installation Git ne se met pas à jour proprement, lance les commandes de mise à jour manuelles de ta plateforme, indiquées dans son guide d'installation.

Pour les messages d'erreur et les correctifs pas à pas, consulte [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md).

## Guides associés

- [Sauvegarder et restaurer Marinara](data/backup-and-restore.md)
- [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md)
- [Guide d'installation Windows](installation/windows.md)
- [Guide d'installation macOS / Linux](installation/macos-linux.md)
- [Lancer via un conteneur (Docker / Podman)](installation/containers.md)
- [Guide d'installation Android (Termux)](installation/android-termux.md)
- [Guide de la PWA iOS / iPadOS](installation/ios-pwa.md)
