# Guide d'installation Android (Termux)

Ce guide explique comment faire tourner Marinara Engine sur un téléphone ou une tablette Android. Marinara s'exécute dans Termux, un environnement Linux gratuit pour Android. Deux chemins possibles : la méthode simple, avec l'application Android, ou l'installation à la main dans le terminal Termux.

## Termux et F-Droid, c'est quoi

Termux est une application gratuite qui apporte à ton téléphone un petit système Linux et une ligne de commande. Marinara Engine en a besoin parce que Marinara est un serveur Linux, pas une application Android native.

F-Droid est une boutique d'applications Android libre et gratuite. La configuration automatique de Marinara télécharge la version stable de Termux depuis F-Droid. Termux propose aussi une version expérimentale distincte sur Google Play ; si elle est déjà installée, Marinara reconnaît sa signature officielle, mais F-Droid reste la voie recommandée dans ce guide.

Installe Termux depuis F-Droid ici : [Termux sur F-Droid](https://f-droid.org/en/packages/com.termux/). Ne mélange pas Termux ni ses applications complémentaires provenant de sources différentes, car leurs signatures doivent correspondre. Consulte les [notes d'installation officielles de Termux](https://github.com/termux/termux-app#installation) pour les détails propres à chaque source.

## Installer avec l'application Android (APK)

Le chemin le plus simple passe par l'application Android de Marinara Engine. Un APK est un fichier d'installation d'application Android. Cette application joue le rôle d'assistant : elle configure Termux à ta place, puis ouvre Marinara une fois le serveur local démarré. Elle a toujours besoin de Termux pour le vrai travail, donc Android t'affiche quelques demandes système à approuver. Installer l'APK précompilé ne demande ni clé de signature, ni mot de passe, ni secret d'accès local, ni modification de `CSRF_TRUSTED_ORIGINS`. L'application génère et échange automatiquement son identifiant privé pour localhost. N'ajoute pas `null` à `CSRF_TRUSTED_ORIGINS` ; il est volontairement traité comme absent et l'échange de l'APK n'en a pas besoin.

1. Touche [Télécharger le dernier APK Android](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk).
2. Installe l'APK, puis ouvre l'application.
3. Appuie sur le bouton **Install / Start Marinara** (installer / démarrer Marinara).
4. Si Termux n'est pas encore installé, approuve les demandes d'installation d'Android pour que l'application puisse télécharger et installer Termux depuis F-Droid.
5. Quand Android le demande, accorde la permission **Run commands in Termux environment** (exécuter des commandes dans l'environnement Termux).
6. Si Termux bloque la configuration, l'application copie pour toi une commande `allow-external-apps`. Colle cette commande une fois dans Termux, puis appuie de nouveau sur **Install / Start Marinara**.
7. Patiente pendant que Termux installe les dépendances et compile Marinara. La première compilation prend quelques minutes.
8. Reviens dans l'application Marinara Engine lorsque Termux a terminé. L'application se connecte et s'authentifie automatiquement dès que le serveur local est prêt.

Si tu préfères une icône sur l'écran d'accueil qui ouvre Marinara comme une application ordinaire, cette même application Android te la fournit. Ce n'est qu'une enveloppe autour du serveur Termux : le serveur doit donc être configuré d'abord. Elle ne peut pas passer outre les demandes d'installation et de permission d'Android, mais elle ne te demande de configurer aucun secret d'installation Marinara.

## Installer à la main dans Termux

Si tu préfères te passer de l'application, installe Marinara à la main. Ouvre Termux et colle cette commande unique :

```
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

Cette commande unique fait cinq choses :

1. Elle met à jour les paquets Termux.
2. Elle installe Git et Node.js. Marinara prend en charge Node.js en versions 24, 25 et 26.
3. Elle télécharge Marinara Engine, sauf s'il est déjà installé.
4. Elle rend le lanceur (le script `start-termux.sh`) exécutable.
5. Elle lance le lanceur une première fois.

Le lanceur installe les dépendances de l'application, compile Marinara sur l'appareil et démarre le serveur local. Il met aussi Node.js à jour si la version installée est trop ancienne. Le premier lancement est lent, car il compile l'application. Les suivants sont bien plus rapides.

Une fois terminé, ouvre cette adresse dans le navigateur Android :

```
http://127.0.0.1:7860
```

Marinara écoute sur le port défini par la variable `PORT` (le port réseau utilisé par l'application). La valeur par défaut est 7860. Si tu as choisi un autre `PORT`, utilise ce numéro-là.

Astuce : pour obtenir une icône façon application, ouvre le menu du navigateur et choisis l'option qui ajoute Marinara à l'écran d'accueil. Le nom exact de cette option change d'un navigateur à l'autre.

## Redémarrer Marinara

Après la première configuration, plus besoin de refaire l'installation. Ouvre Termux et exécute :

```
cd Marinara-Engine
./start-termux.sh
```

Le lanceur vérifie s'il existe une mise à jour, puis démarre Marinara. Pour lancer la copie actuelle sans interroger GitHub, ajoute `--skip-update` :

```
cd Marinara-Engine
./start-termux.sh --skip-update
```

Le lanceur supprime aussi les paquets devenus inutiles de son cache pnpm local pendant les mises à jour de dépendances. Les anciennes versions n'accumulent ainsi pas plusieurs gigaoctets sur le téléphone ; les chats, les réglages et les autres données personnelles de Marinara restent intacts.

## Accéder depuis un autre appareil

Par défaut, le lanceur rend Marinara accessible sur le réseau local. Autrement dit, un ordinateur portable ou un autre téléphone connecté au même Wi-Fi peut l'ouvrir. Pour trouver la bonne adresse pas à pas, consulte la [Foire aux questions](../FAQ.md).

## Mise à jour

À chaque exécution du lanceur (`./start-termux.sh`), celui-ci demande à GitHub s'il existe une version plus récente et fait la mise à jour avant de démarrer. Le plus simple pour rester à jour est donc de démarrer Marinara normalement.

Pour démarrer la copie installée sans mise à jour, utilise l'option de contournement :

```
./start-termux.sh --skip-update
```

Pour conserver la version installée d'un lancement à l'autre, ajoute `AUTO_UPDATE_ENABLED=false` dans le fichier `.env` du projet. Cela ne désactive ni les commandes de mise à jour manuelles ni **Settings → Advanced → Updates**.

Autre option : vérifier les mises à jour depuis l'application. Ouvre le panneau **Settings** (Paramètres), va dans l'onglet **Advanced**, puis ouvre la section **Updates**. Clique sur le bouton **Check for Updates** (vérifier les mises à jour) pour savoir s'il existe une version plus récente. Le bouton **Apply Update** (appliquer la mise à jour) intégré est désactivé par défaut et demande une configuration. Pour savoir comment l'activer et l'utiliser, consulte [Mettre à jour Marinara Engine](../UPGRADING.md).

## Guides associés

- [Installation de Marinara Engine](../INSTALLATION.md)
- [Guide de la PWA iOS / iPadOS](ios-pwa.md)
- [Mettre à jour Marinara Engine](../UPGRADING.md)
- [Foire aux questions](../FAQ.md)
