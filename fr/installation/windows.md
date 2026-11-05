# Guide d'installation sous Windows

Installe Marinara Engine sur un PC Windows avec l'installateur (le moins d'étapes) ou depuis les sources. Marinara tourne ensuite sur ton propre PC.

## Avant de commencer

Il te faut Windows 10 ou Windows 11 (64 bits), quelques gigaoctets d'espace disque libre et une connexion internet pendant l'installation. L'installateur recommande environ 2,5 Go d'espace libre.

Il te faut aussi deux outils :

- **Node.js** 24, 25 ou 26. Node.js fait tourner l'application. La version 24 est la version LTS (Long Term Support) recommandée.
- **Git**. Git télécharge le code et permet à Marinara de se mettre à jour tout seul.

Si tu utilises l'installateur, ne les installe pas : il récupère les deux à ta place. Si tu installes depuis les sources, tu les installes toi-même. Tu n'as pas besoin d'installer pnpm (l'outil qui installe les différentes parties de l'application). L'installateur et `start.bat` s'en chargent.

## Installer avec l'installateur Windows

1. Ouvre la [page des versions de Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine/releases).
2. Télécharge l'installateur Windows le plus récent. Son nom est `Marinara-Engine-Installer-` suivi de la version.
3. Lance l'installateur. Si Windows affiche "Windows protected your PC", choisis **More info** (informations complémentaires), puis **Run anyway** (exécuter quand même), mais seulement pour un fichier venant de la page des versions.
4. Suis les indications à l'écran. Si Node.js ou Git manque, laisse l'installateur l'installer.
5. Choisis le dossier d'installation, ou accepte celui par défaut (`%LOCALAPPDATA%\Marinara-Engine`).
6. Patiente pendant qu'il télécharge et compile l'application. Une liste de progression affiche chaque étape. Cela prend quelques minutes.
7. Quand il indique que l'installation est terminée, double-clique sur le raccourci **Marinara Engine** du bureau.

Une fenêtre de console (une fenêtre de texte noire) s'ouvre et affiche la progression. Ton navigateur ouvre ensuite Marinara. Sinon, va sur `http://127.0.0.1:7860`.

L'installateur crée une copie Git de la dernière version stable : Marinara peut ainsi se mettre à jour à chaque lancement.

> **Astuce :** certains antivirus signalent l'installateur parce qu'il télécharge Node.js et Git. Ne lance l'installateur que si tu l'as obtenu depuis la page des versions indiquée ci-dessus.

## Démarrer et arrêter Marinara

- **Démarrer :** double-clique sur le raccourci du bureau ou sur l'entrée du menu Démarrer. Pour une installation depuis les sources, lance `start.bat` dans le dossier Marinara.
- **Arrêter :** le raccourci ouvre une fenêtre de console. Appuie sur <kbd>Ctrl</kbd>+<kbd>C</kbd> dans cette fenêtre.

Si Marinara tourne déjà, le raccourci le rouvre dans ton navigateur.

## Installer depuis les sources

Utilise cette méthode si tu préfères lancer les commandes toi-même, ou si tu veux la version staging (de test).

1. Installe [Node.js](https://nodejs.org/en/download) et [Git pour Windows](https://git-scm.com/download/win).
2. Ouvre une nouvelle fenêtre d'invite de commandes (une fenêtre de texte dans laquelle tu tapes des commandes).
3. Vérifie les deux outils. `node -v` doit afficher la version 24, 25 ou 26.

   ```bat
   node -v
   git --version
   ```

   Si une commande est introuvable, ferme puis rouvre l'invite de commandes, ou réinstalle l'outil manquant.

4. Télécharge le code.

   ```bat
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

5. Ouvre son dossier.

   ```bat
   cd Marinara-Engine
   ```

6. Facultatif : passe à la version staging avant le premier lancement. Saute cette étape pour rester sur la version stable. Sauvegarde tes données avant d'utiliser staging.

   ```bat
   git checkout staging
   ```

   Le lanceur te maintient ensuite sur staging lors des mises à jour.

7. Exécute le lanceur, le script qui configure et démarre Marinara.

   ```bat
   start.bat
   ```

Le premier lancement prend quelques minutes, le temps de tout installer et compiler. Une fenêtre de console affiche la progression. Ton navigateur ouvre Marinara quand tout est prêt. Pour redémarrer plus tard, lance `start.bat` depuis le même dossier.

Si ça n'a pas marché : `[ERROR] Node.js 24 LTS or newer is required` signifie que ton Node.js est trop ancien. Installe Node.js 24 ou plus récent depuis [nodejs.org](https://nodejs.org), puis relance `start.bat`.

### Installation manuelle sans le lanceur

Cette voie a besoin de la commande `pnpm`. Lance ces commandes depuis le dossier `Marinara-Engine`.

1. Installe pnpm une seule fois.

   ```bat
   npm install -g pnpm
   ```

2. Installe les dépendances (les parties dont l'application a besoin), compile l'application et démarre le serveur.

   ```bat
   pnpm install --force
   pnpm build
   pnpm start
   ```

3. Ouvre `http://127.0.0.1:7860`.

Avec `pnpm start`, seul ce PC peut atteindre Marinara. Pour laisser les autres appareils se connecter, crée un fichier nommé `.env` dans le dossier `Marinara-Engine`, ajoute-lui cette ligne et redémarre le serveur.

```env
HOST=0.0.0.0
```

## Ouvrir Marinara depuis un autre appareil

L'installateur, son raccourci et `start.bat` laissent les autres appareils de ton réseau atteindre Marinara, mais Marinara les bloque tant que tu n'as pas défini de connexion. Pour les étapes, voir [Accès à distance](../REMOTE_ACCESS.md) et la [Foire aux questions](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device).

## Mettre à jour Marinara

Chaque fois que tu démarres Marinara depuis le raccourci ou `start.bat`, le lanceur cherche les mises à jour, les installe, recompile et démarre. Tes chats, tes personnages et tes réglages restent en place. Si tu as modifié le code toi-même, le lanceur met tes modifications de côté et les remet en place après la mise à jour. S'il n'y arrive pas, il garde ta version actuelle et affiche une note. Pour le bouton **Apply Update** (appliquer la mise à jour) de l'application, pour sauter une mise à jour et pour les commandes manuelles, voir [Mettre à jour Marinara Engine](../UPGRADING.md#windows).

## Trouver tes données ou désinstaller

Tes données se trouvent dans le dossier `packages\server\data`, à l'intérieur du dossier Marinara. Pour désinstaller, ouvre l'entrée **Uninstall Marinara Engine** (désinstaller Marinara Engine) du menu Démarrer. Le programme de désinstallation demande s'il doit aussi supprimer tes données. Choisis **No** (non) pour les garder en vue d'une réinstallation. Voir [Sauvegarder et restaurer Marinara](../data/backup-and-restore.md).

## Optionnel : suppression d'arrière-plan des sprites par IA

Marinara demande des arrière-plans transparents pour les sprites générés – un sprite, c'est l'image du personnage sur le plateau – et nettoie lui-même les fonds unis. En renfort pour les décors détaillés, tu peux installer l'outil optionnel `backgroundremover`. Il télécharge de gros fichiers d'apprentissage automatique : il est donc désactivé par défaut.

1. Installe Python 3.11 depuis [python.org](https://www.python.org/downloads/windows/). Les versions 3.9 à 3.11 de Python fonctionnent.
2. Lance ceci depuis le dossier `Marinara-Engine`.

   ```bat
   pnpm backgroundremover:install
   ```

Cela crée un dossier Python privé (un venv) dans ton dossier de données. Marinara s'en sert automatiquement.

Pour laisser `start.bat` l'installer au prochain lancement, ajoute cette ligne à ton fichier `.env` :

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## En cas de problème

Vérifie que Node.js est en version 24, 25 ou 26 et que Git est installé. Pour d'autres solutions, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Installation de Marinara Engine](../INSTALLATION.md)
- [Mettre à jour Marinara Engine](../UPGRADING.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
- [Foire aux questions](../FAQ.md)
