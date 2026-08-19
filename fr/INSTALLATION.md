# Installation de Marinara Engine

Ce guide t'aide à choisir la bonne méthode d'installation de Marinara Engine selon ton appareil. Marinara tourne sur ta propre machine : les chats et les données restent en local. Chaque plateforme ci-dessous a son guide pas à pas, accessible depuis le tableau.

## Choisis ta plateforme

Choisis le guide qui correspond à l'appareil sur lequel tu veux faire tourner Marinara.

| Plateforme | Guide d'installation |
|---|---|
| Windows | [Installation sur Windows](installation/windows.md) |
| macOS ou Linux | [Installation sur macOS et Linux](installation/macos-linux.md) |
| Docker ou Podman | [Installation en conteneur](installation/containers.md) |
| Téléphone ou tablette Android | [Télécharger l'APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) · [Guide d'installation Android](installation/android-termux.md) |
| iPhone ou iPad | [iOS et iPadOS](installation/ios-pwa.md) |

Quelques points à connaître avant de choisir :

- Sur **iPhone ou iPad**, Marinara ne fait pas tourner le serveur lui-même. Le serveur tourne sur un ordinateur, un serveur domestique ou un appareil Android. Ensuite, tu l'ouvres dans Safari depuis ton iPhone ou ton iPad. Le guide iOS détaille la marche à suivre.
- Sur **Android**, Marinara tourne dans **Termux**. Termux est une application gratuite qui apporte un petit environnement Linux à Android. Touche le lien direct de téléchargement de l'APK, accepte les demandes obligatoires d'installation et d'autorisation Termux d'Android, puis laisse l'application gérer automatiquement son identifiant privé pour localhost. L'installateur ne demande jamais d'identifiants de signature Android ni ce secret local.

## Lequel choisir

Si tu débutes et que tu veux le minimum de configuration, choisis l'une de ces options :

- Sur **Windows**, utilise le **programme d'installation Windows**. Il télécharge et configure tout à ta place, puis ajoute un raccourci sur le bureau.
- Sur **Android**, utilise le lien **Télécharger l'APK** ci-dessus. Ouvre le fichier téléchargé, puis touche **Install / Start Marinara** dans l'application.
- Sur **macOS**, **Linux** ou un serveur domestique, utilise **Docker**. Une seule commande lance l'application. L'image contient déjà Node.js, toutes les dépendances et une version compilée de l'application. Tu n'as donc ni Node.js à installer, ni application à compiler.

Si le terminal ne te fait pas peur et que tu comptes peut-être modifier le code, installe plutôt depuis les sources. "Installer depuis les sources" veut dire que tu télécharges le code et que tu compiles l'application sur ta machine. Les guides **Windows**, **macOS et Linux** et **Android (Termux)** couvrent tous cette méthode.

## Configuration minimale

- Il te faut un ordinateur ou un appareil capable de faire tourner un serveur : Windows, macOS, Linux ou Android.
- Pour installer depuis les sources, il te faut **Node.js** version 24 et **Git**. Node.js exécute l'application, Git télécharge et met à jour le code. Les guides par plateforme donnent les liens de téléchargement des deux.
- Les installations **Docker** et **Podman** n'ont pas besoin de Node.js. La configuration Compose recommandée utilise quand même Git pour télécharger les fichiers du projet. Le guide des conteneurs explique ce point.
- Par défaut, l'application tourne sur ta propre machine à cette adresse :

```text
http://127.0.0.1:7860
```

- L'adresse `127.0.0.1` désigne ton propre ordinateur, et `7860` est le port par défaut. Pour accéder à Marinara depuis ton téléphone ou un autre appareil du réseau, consulte la [FAQ](FAQ.md) au sujet de l'accès en réseau local (LAN).

## Et après l'installation

Une fois Marinara lancé et ouvert dans le navigateur, lis [Démarrer avec Marinara Engine](home/welcome.md). Ce guide t'accompagne dans tes premières actions : ajouter une connexion, créer ou importer un personnage, et démarrer un chat.

Pour garder ton installation à jour par la suite, consulte [Mettre à jour Marinara Engine](UPGRADING.md).

## Guides associés

- [Installation sur Windows](installation/windows.md)
- [Installation sur macOS et Linux](installation/macos-linux.md)
- [Installation en conteneur](installation/containers.md)
- [Installation sur Android (Termux)](installation/android-termux.md)
- [iOS et iPadOS](installation/ios-pwa.md)
- [Mettre à jour Marinara Engine](UPGRADING.md)
- [Démarrer avec Marinara Engine](home/welcome.md)
