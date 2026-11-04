# Guide d'installation macOS / Linux

Installe Marinara Engine sur un Mac ou un ordinateur Linux et démarre-le avec le lanceur `start.sh`. Marinara tourne ensuite sur ton propre ordinateur.

## Avant de commencer

Il te faut deux outils :

- **Node.js** 24, 25 ou 26. Node.js fait tourner Marinara. La version 24 est la version LTS (Long Term Support) recommandée.
- **Git**. Git télécharge Marinara et récupère les mises à jour.

Tu n'as pas besoin d'installer pnpm (l'outil qui installe les différentes parties de l'application). Le lanceur met en place la bonne version.

### Installer Node.js et Git sur macOS

Avec Homebrew, une seule commande installe les deux :

```bash
brew install node git
```

Sans Homebrew, télécharge l'installateur de Node.js depuis [nodejs.org](https://nodejs.org). Installe ensuite Git avec les outils en ligne de commande de Xcode :

```bash
xcode-select --install
```

### Installer Node.js et Git sur Linux

Utilise ton gestionnaire de paquets. Sur Ubuntu ou Debian, le Node.js fourni par défaut est souvent antérieur à la version 24 : ajoute donc d'abord la version de NodeSource :

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs git
```

Sur Fedora :

```bash
sudo dnf install -y nodejs git
```

Sur Arch :

```bash
sudo pacman -S nodejs npm git
```

### Vérifier les outils

```bash
node -v
git --version
```

`node -v` doit afficher `v24` ou plus. Si l'une des deux commandes répond "command not found", l'outil n'est pas installé correctement.

## Installer et démarrer Marinara

1. Ouvre un terminal, une fenêtre dans laquelle tu tapes des commandes. Sur un Mac, appuie sur <kbd>Cmd</kbd>+<kbd>Space</kbd>, tape Terminal et appuie sur Enter. Sous Linux, ouvre ton application Terminal.
2. Télécharge Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Ouvre le nouveau dossier.

   ```bash
   cd Marinara-Engine
   ```

4. Démarre Marinara avec le lanceur, le script qui le configure et le démarre.

   ```bash
   ./start.sh
   ```

Le premier lancement prend quelques minutes, le temps de tout télécharger et compiler. Le terminal affiche la progression, puis `Press Ctrl+C to stop`. Marinara s'ouvre dans ton navigateur à l'adresse `http://127.0.0.1:7860`. Si le navigateur ne s'ouvre pas, va toi-même à cette adresse.

Si ça n'a pas marché :

- `permission denied` : lance `chmod +x start.sh`, puis relance `./start.sh`.
- `[ERROR] Node.js 24 LTS or newer is required` : ton Node.js est trop ancien. Installe une version plus récente, puis relance `./start.sh`.

## Démarrer et arrêter Marinara

- **Redémarrer :** lance `./start.sh` depuis le dossier Marinara. Si Marinara tourne déjà, le lanceur le rouvre dans ton navigateur.
- **Arrêter :** appuie sur <kbd>Ctrl</kbd>+<kbd>C</kbd> dans le terminal.

Chaque fois que tu lances `./start.sh` depuis un téléchargement Git, le lanceur :

1. Cherche une version plus récente et se met à jour s'il en trouve une.
2. Vérifie Node.js et la bonne version de pnpm.
3. Installe les parties manquantes et recompile l'application si le code a changé.
4. Démarre le serveur et ouvre ton navigateur.

## Modifier les réglages du lanceur

Les réglages du lanceur se trouvent dans un fichier `.env`, dans le dossier Marinara. Un fichier `.env` est un simple fichier texte avec un réglage par ligne. Pour empêcher le lanceur d'ouvrir ton navigateur, ajoute cette ligne :

```bash
AUTO_OPEN_BROWSER=false
```

`PORT` définit le port, le nombre après les deux-points dans l'adresse (7860 par défaut). Le lanceur laisse les autres appareils de ton réseau local atteindre Marinara, mais Marinara les bloque tant que tu n'as pas défini de connexion. Voir [Accès à distance](../REMOTE_ACCESS.md).

## Mettre à jour Marinara

Lancer `./start.sh` met d'abord Marinara à jour. Tes chats, tes personnages et tes réglages restent en place. Si tu as modifié le code toi-même, le lanceur met tes modifications de côté et les remet en place après la mise à jour. Pour sauter une mise à jour, pour le bouton **Apply Update** (appliquer la mise à jour) de l'application et pour les commandes manuelles, voir [Mettre à jour Marinara Engine](../UPGRADING.md#macos-and-linux).

## Installation manuelle sans le lanceur

La plupart des gens devraient utiliser le lanceur. Pour exécuter chaque étape toi-même, il te faut pnpm. Node.js 24 inclut Corepack, un outil qui active pnpm. Node.js 25 ne l'inclut pas.

1. Sur Node.js 24, active pnpm :

   ```bash
   corepack enable pnpm
   ```

   Sur Node.js 25 ou 26, installe d'abord Corepack :

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. Télécharge Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Ouvre son dossier.

   ```bash
   cd Marinara-Engine
   ```

4. Installe les parties de l'application, compile-la et démarre le serveur.

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. Ouvre `http://127.0.0.1:7860`.

Avec `pnpm start`, le serveur n'écoute que sur ton propre ordinateur. Pour laisser les autres appareils se connecter, ajoute `HOST=0.0.0.0` à `.env` et redémarre.

## Optionnel : outil de suppression d'arrière-plan

Marinara demande des arrière-plans transparents pour les sprites générés (les images des personnages) et nettoie lui-même les fonds unis. En renfort pour les décors détaillés ou les ombres, tu peux installer l'outil optionnel de suppression d'arrière-plan par IA. Il met en place un venv Python (un dossier privé pour les paquets Python) et télécharge de gros fichiers : PyTorch (une bibliothèque d'apprentissage automatique) et les modèles U2Net (des fichiers qui repèrent le sujet d'une image).

1. Sur macOS, Python 3.11 fonctionne le mieux. Installe-le d'abord. Les versions 3.9 à 3.11 de Python fonctionnent.

   ```bash
   brew install python@3.11
   ```

2. Depuis le dossier Marinara, lance :

   ```bash
   pnpm backgroundremover:install
   ```

Pour laisser le lanceur l'installer au prochain lancement, ajoute cette ligne à `.env` :

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## En cas de problème

Sur certains systèmes Linux, l'installation échoue avec une erreur qui contient `ERR_PNPM_ENAMETOOLONG` (chemins de fichiers trop longs). Supprime les dossiers restés incomplets et relance le lanceur :

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

Pour d'autres solutions, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Installation de Marinara Engine](../INSTALLATION.md)
- [Mettre à jour Marinara Engine](../UPGRADING.md)
- [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
