# Guide d'installation Android (Termux)

Fais tourner Marinara Engine sur un téléphone ou une tablette Android. Marinara s'exécute dans Termux, une application gratuite qui apporte à ton téléphone un petit système Linux. Tu peux tout mettre en place avec l'application Android de Marinara (le plus simple) ou à la main dans Termux.

## À propos de Termux et F-Droid

Marinara est un serveur Linux, pas une application Android native : il a donc besoin de Termux pour fonctionner. F-Droid est une boutique d'applications libre et gratuite. La configuration de l'application Android télécharge la version stable de Termux depuis F-Droid. Termux propose aussi une version expérimentale sur Google Play. Si elle est déjà installée, Marinara l'accepte, mais ce guide recommande F-Droid.

Installe Termux depuis [Termux sur F-Droid](https://f-droid.org/en/packages/com.termux/). Ne mélange pas Termux ni ses applications complémentaires provenant de sources différentes, car leurs signatures doivent correspondre. Consulte les [notes d'installation officielles de Termux](https://github.com/termux/termux-app#installation).

## Installer avec l'application Android

L'application Android de Marinara Engine configure Termux, puis ouvre Marinara une fois le serveur local démarré. En chemin, Android t'affiche quelques demandes système à approuver.

1. Touche [Télécharger le dernier APK Android](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Un APK est un fichier d'installation d'application Android.
2. Installe l'APK, puis ouvre l'application.
3. Appuie sur **Install / Start Marinara** (installer / démarrer Marinara).
4. Si Termux n'est pas installé, approuve les demandes d'installation d'Android, y compris l'autorisation pour l'application d'installer des applications, afin qu'elle puisse installer Termux depuis F-Droid.
5. Quand Android le demande, accorde la permission **Run commands in Termux environment** (exécuter des commandes dans l'environnement Termux).
6. Si Termux bloque la configuration, l'application copie une commande `allow-external-apps` et ouvre Termux. Appuie longuement sur l'écran de Termux, touche **Paste** (coller), appuie sur Enter, puis reviens en arrière et appuie de nouveau sur **Install / Start Marinara**.
7. Patiente pendant que Termux installe les dépendances (les éléments dont l'application a besoin) et compile Marinara. Termux affiche du texte qui défile. La première compilation prend quelques minutes.
8. Reviens dans l'application Marinara Engine quand Termux a terminé. Elle se connecte et s'authentifie toute seule dès que le serveur est prêt, et tu vois l'écran d'accueil de Marinara.

Pour utiliser plutôt ton navigateur, choisis **Open in browser** (ouvrir dans le navigateur) dans le lanceur de l'application. L'application retient ce choix, et la connexion y est aussi automatique.

Si ça n'a pas marché : appuie de nouveau sur **Install / Start Marinara** après avoir réglé la demande qui a bloqué l'installation. Si l'application ne peut pas ouvrir localhost, mets à jour l'APK et appuie sur **Install / Start Marinara**. Voir [Aide pour la connexion localhost sur Android](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503).

L'application ne demande ni clé de signature, ni mot de passe, ni modification de `CSRF_TRUSTED_ORIGINS`. Elle crée son propre identifiant privé pour localhost. N'ajoute pas `null` à `CSRF_TRUSTED_ORIGINS`.

## Installer à la main dans Termux

Utilise cette méthode si tu ne veux pas de l'application. Ouvre Termux, puis appuie longuement sur l'écran et touche **Paste** pour coller cette commande (copie-la en entier) :

```bash
pkg upgrade -y && pkg install -y git nodejs-lts && \
([ -d "$HOME/Marinara-Engine/.git" ] || \
  git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && \
cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

Dans l'ordre, elle :

1. Met à jour tous les paquets Termux. Une version plus récente de Node.js ne peut pas démarrer avec des bibliothèques Termux plus anciennes, donc Termux a besoin d'une mise à jour complète. Si elle te demande s'il faut garder un fichier de configuration, appuie sur Enter pour garder le tien.
2. Installe Git et Node.js. Marinara prend en charge Node.js 24, 25 et 26.
3. Télécharge Marinara, sauf s'il est déjà là.
4. Rend le lanceur (`start-termux.sh`) exécutable et le lance.

Le lanceur installe les dépendances, compile Marinara sur ton appareil et démarre le serveur local. Il met Node.js à jour si ta version est trop ancienne. Le premier lancement est lent et Termux affiche du texte qui défile. Les lancements suivants sont plus rapides.

Quand il indique que le serveur tourne, ouvre cette adresse dans ton navigateur Android :

```text
http://127.0.0.1:7860
```

Si tu as défini un autre `PORT`, utilise ce numéro. Pour obtenir une icône façon application, utilise l'option du menu de ton navigateur qui ajoute la page à l'écran d'accueil. Son nom change d'un navigateur à l'autre.

## Démarrer et arrêter Marinara

Avec l'application, ouvre-la et appuie sur **Install / Start Marinara** si le serveur est arrêté. Pour passer de l'application à ton navigateur ou inversement, utilise **Open in browser** dans le lanceur, puis **Retry connection** (réessayer la connexion). Depuis l'application, reviens au lanceur par **Settings → General → App Behavior → Open Android launcher (app or browser)** (Paramètres → Général → Comportement de l'application → Ouvrir le lanceur Android (application ou navigateur)).

Avec une installation manuelle, ouvre Termux et exécute :

```bash
cd Marinara-Engine
./start-termux.sh
```

Pour arrêter le serveur, appuie sur <kbd>Ctrl</kbd>+<kbd>C</kbd> dans Termux.

## Mettre à jour Marinara

Chaque fois que tu lances `./start-termux.sh`, le lanceur demande à GitHub s'il existe une version plus récente et fait la mise à jour avant de démarrer. Pour démarrer sans mise à jour, ajoute `--skip-update`. Pour d'autres options et les étapes de mise à jour de l'APK, voir [Mettre à jour Marinara Engine](../UPGRADING.md#android-termux).

Pendant les mises à jour, le lanceur supprime aussi les paquets inutilisés de son cache pnpm local. Cela évite que les anciennes versions remplissent plusieurs gigaoctets de stockage. Il ne touche ni à tes chats ni à tes réglages.

## Ouvrir Marinara depuis un autre appareil

Le lanceur permet aux autres appareils de ton Wi-Fi d'atteindre Marinara, mais il les bloque tant que tu n'as pas défini de connexion. Voir la [FAQ](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) et [Accès à distance](../REMOTE_ACCESS.md).

Si un autre appareil ne peut pas se connecter après une mise à jour, voir [Verrouillé après une mise à jour](../REMOTE_ACCESS.md#locked-out-after-updating). Dans Termux, cette commande supprime la connexion définie dans l'application et déconnecte tous les navigateurs :

```bash
cd "$HOME/Marinara-Engine" && node scripts/reset-login.mjs
```

## Guides associés

- [Installation de Marinara Engine](../INSTALLATION.md)
- [Guide de la PWA iOS / iPadOS](ios-pwa.md)
- [Mettre à jour Marinara Engine](../UPGRADING.md)
- [Foire aux questions](../FAQ.md)
