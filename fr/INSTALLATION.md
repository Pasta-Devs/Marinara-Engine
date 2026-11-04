# Installation de Marinara Engine

Marinara tourne sur ton propre appareil. Choisis ci-dessous le guide qui correspond à ton appareil.

## Choisis ta plateforme

| Ton appareil | Guide |
| --- | --- |
| Windows | [Installation sur Windows](installation/windows.md) |
| macOS ou Linux | [Installation sur macOS et Linux](installation/macos-linux.md) |
| Docker ou Podman | [Installation en conteneur](installation/containers.md) |
| Téléphone ou tablette Android | [Guide d'installation Android](installation/android-termux.md) |
| iPhone ou iPad | [iOS et iPadOS](installation/ios-pwa.md) |

## Lequel choisir ?

- **Windows :** utilise le programme d'installation Windows. Il configure tout et ajoute un raccourci sur le bureau.
- **Android :** [télécharge l'APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Ouvre le fichier téléchargé, puis touche **Install / Start Marinara** (installer / démarrer Marinara) dans l'application.
- **macOS, Linux ou un serveur domestique :** choisis l'une des deux méthodes. Le guide natif fait tourner Marinara directement sur ton ordinateur avec un script de lancement. Docker ne demande pas Node.js et ne compile rien, mais tu dois d'abord installer Docker.
- **iPhone ou iPad :** Marinara ne peut pas faire tourner le serveur sur ces appareils. Fais-le tourner sur un ordinateur, un serveur domestique ou un appareil Android, puis ouvre Marinara dans Safari. Le guide iOS explique comment faire.
- **Tu veux modifier le code :** installe depuis les sources. Cela veut dire que tu télécharges le code et que tu compiles l'application sur ton appareil. Les guides Windows, macOS et Linux, et Android couvrent tous cette méthode.

Sur Android, Marinara tourne dans **Termux**, une application Android gratuite qui apporte à ton téléphone un petit système Linux. L'APK configure Termux à ta place.

## Ce qu'il te faut

- Pour installer depuis les sources : **Node.js** 24, 25 ou 26, et **Git**. Node.js exécute l'application. Git télécharge le code et le met à jour. Les guides par plateforme donnent les liens de téléchargement des deux.
- Pour Docker ou Podman : pas besoin de Node.js. La configuration Compose recommandée utilise Git une seule fois, pour télécharger les fichiers du projet.

## Ouvrir Marinara

Quand Marinara tourne, ouvre cette adresse dans un navigateur sur le même appareil. Ne l'utilise pas depuis un autre appareil.

```text
http://127.0.0.1:7860
```

`127.0.0.1` désigne cet appareil. `7860` est le port par défaut, le numéro sur lequel l'application écoute. Les lanceurs (les scripts qui démarrent Marinara) permettent aussi aux autres appareils de ton réseau de l'atteindre, mais ceux-ci restent bloqués tant que tu n'as pas défini de connexion. Une installation Docker ou Podman ne répond que sur cet appareil tant que tu n'as pas modifié sa ligne de port ; voir [Conteneurs](installation/containers.md#open-marinara-from-another-device).

## Ouvrir Marinara sur ton téléphone

1. Installe et démarre Marinara sur un ordinateur, un serveur domestique ou un téléphone Android.
   Avec Docker ou Podman, suis d'abord [Ouvrir Marinara depuis un autre appareil](installation/containers.md#open-marinara-from-another-device).
2. Définis une connexion sur cet appareil. Voir [Accès à distance](REMOTE_ACCESS.md#option-1-login-recommended).
3. Trouve l'adresse IP de cet appareil. La [FAQ](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) montre comment faire.
4. Sur ton téléphone, ouvre `http://` suivi de l'adresse IP et de `:7860`.

Pour un iPhone, voir [iOS et iPadOS](installation/ios-pwa.md).

## Après l'installation

Lis [Démarrer avec Marinara Engine](home/welcome.md) pour ajouter une connexion, créer ou importer un personnage et démarrer un chat. Pour faire les mises à jour plus tard, voir [Mettre à jour Marinara Engine](UPGRADING.md).

## Guides associés

- [Installation sur Windows](installation/windows.md)
- [Installation sur macOS et Linux](installation/macos-linux.md)
- [Installation en conteneur](installation/containers.md)
- [Installation sur Android (Termux)](installation/android-termux.md)
- [iOS et iPadOS](installation/ios-pwa.md)
- [Mettre à jour Marinara Engine](UPGRADING.md)
- [Démarrer avec Marinara Engine](home/welcome.md)
