# Guide d'installation macOS / Linux

Ce guide explique comment installer et lancer Marinara Engine sur macOS ou Linux. Au programme : installer les deux outils requis, démarrer l'application avec le lanceur shell, puis la mettre à jour plus tard. Marinara Engine (appelé Marinara par la suite) fonctionne entièrement sur ton ordinateur.

## Prérequis

Deux outils gratuits doivent être installés avant de commencer :

- **Node.js** : le programme qui exécute Marinara. Installe la version 24, 25 ou 26 (la version 24 est la version LTS recommandée).
- **Git** : l'outil qui télécharge Marinara et récupère les mises à jour.

Pas besoin d'installer pnpm toi-même. pnpm est le gestionnaire de paquets avec lequel Marinara récupère ses composants. Le lanceur shell installe la bonne version de pnpm à ta place.

### Installer sur macOS

Le plus simple est de passer par Homebrew. Une seule commande installe les deux outils :

```bash
brew install node git
```

Si tu n'utilises pas Homebrew, télécharge l'installateur de Node.js depuis https://nodejs.org. Installe ensuite Git avec les outils en ligne de commande de Xcode :

```bash
xcode-select --install
```

### Installer sur Linux

Utilise le gestionnaire de paquets de ta distribution. Sur Ubuntu ou Debian, la version de Node.js fournie par défaut est souvent antérieure à la version 24. Ajoute d'abord la version plus récente de NodeSource :

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
```

Installe ensuite Node.js et Git :

```bash
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

Vérifie que les deux outils sont prêts. Lance cette commande :

```bash
node -v
```

Le résultat doit afficher `v24` ou un numéro supérieur. Lance ensuite cette commande :

```bash
git --version
```

Le résultat doit ressembler à `git version 2.40`, ou à une version plus récente. Si l'une des deux commandes répond "command not found", l'outil n'est pas installé correctement.

## Démarrage rapide avec le lanceur

Le script de lancement `start.sh` est la méthode recommandée pour exécuter Marinara. Il installe tout, compile l'application et l'ouvre dans le navigateur.

1. Télécharge Marinara. Lance cette commande :

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Place-toi dans le nouveau dossier. Lance cette commande :

```bash
cd Marinara-Engine
```

3. Rends le lanceur exécutable. Lance cette commande :

```bash
chmod +x start.sh
```

4. Démarre Marinara. Lance cette commande :

```bash
./start.sh
```

Le premier lancement prend quelques minutes, le temps de tout télécharger et de tout compiler. Une fois terminé, Marinara s'ouvre dans le navigateur à l'adresse http://127.0.0.1:7860. Le numéro 7860 est le port par défaut, c'est-à-dire la porte d'entrée que l'application utilise sur ton ordinateur.

Si le navigateur ne s'ouvre pas tout seul, ouvre-le et va à cette même adresse.

### Ce que le lanceur fait à chaque démarrage

À chaque exécution de `./start.sh` depuis un téléchargement Git, le lanceur va :

1. Chercher une version plus récente et se mettre à jour s'il en trouve une.
2. Confirmer que Node.js et la bonne version de pnpm sont prêts.
3. Installer les composants manquants.
4. Recompiler l'application si le code a changé.
5. Préparer le stockage local de tes données.
6. Démarrer le serveur et ouvrir l'application dans le navigateur.

### Désactiver l'ouverture automatique du navigateur

Par défaut, le lanceur ouvre le navigateur à ta place. Pour l'en empêcher, crée un fichier nommé `.env` dans le dossier de Marinara et ajoutes-y cette ligne :

```bash
AUTO_OPEN_BROWSER=false
```

Le fichier `.env` est un simple fichier texte qui contient tes réglages, un par ligne. Un fichier `.env` de départ ressemble à ceci :

```bash
PORT=7860
AUTO_OPEN_BROWSER=true
```

La variable `PORT` définit le port de l'adresse (7860 par défaut). Par défaut, le lanceur autorise aussi les autres appareils de ton LAN à atteindre le serveur. LAN veut dire réseau local, celui de ta maison ou de ton bureau. Marinara bloque malgré tout ces appareils tant que tu n'as pas mis en place un mot de passe ou une autre option d'accès. Le guide [Accès distant : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md) explique comment faire.

## Installation manuelle

Pour la plupart des utilisateurs, le lanceur ci-dessus est le meilleur choix. Si tu préfères exécuter chaque étape toi-même, suis plutôt ces commandes. L'installation manuelle nécessite pnpm. Node.js 24 inclut Corepack, contrairement à Node.js 25.

1. Sur Node.js 24, active pnpm via Corepack :

```bash
corepack enable pnpm
```

Sur Node.js 25 ou 26, installe d'abord le paquet Corepack fourni par l'utilisateur, puis active pnpm :

```bash
npm install --global corepack
corepack enable pnpm
```

2. Télécharge Marinara. Lance cette commande :

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

3. Place-toi dans le dossier. Lance cette commande :

```bash
cd Marinara-Engine
```

4. Installe les composants. Lance cette commande :

```bash
pnpm install --force
```

5. Compile l'application. Lance cette commande :

```bash
pnpm build
```

6. Démarre le serveur. Lance cette commande :

```bash
pnpm start
```

Ouvre maintenant http://127.0.0.1:7860 dans le navigateur. Avec la commande `pnpm start`, le serveur écoute par défaut uniquement sur ton ordinateur. Tout fonctionne en local, et le stockage de tes données est préparé au premier démarrage.

### Si l'installation échoue sur Linux

Certains systèmes Linux refusent les chemins de fichiers très longs pendant l'installation. Si une erreur contenant `ERR_PNPM_ENAMETOOLONG` apparaît, supprime les dossiers restés incomplets et recommence depuis le lanceur. Lance cette commande :

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Lance ensuite cette commande :

```bash
./start.sh
```

## Suppression d'arrière-plan facultative

Marinara sait supprimer l'arrière-plan des images de sprite de personnage. Un sprite est l'image du personnage utilisée dans les modes Roleplay et Game. La transparence native et le nettoyage adaptatif du masque de détourage intégré fonctionnent sans ce téléchargement. N'installe l'outil de suppression par IA supplémentaire que si tu as besoin d'une solution de repli pour des sprites réalisés sur un décor détaillé, avec des ombres ou d'autres arrière-plans non uniformes ; il télécharge de gros fichiers.

Cet outil supplémentaire est un programme Python. Son installation crée un venv Python (un environnement virtuel, un dossier privé qui contient les paquets Python). Elle télécharge aussi PyTorch, une bibliothèque d'apprentissage automatique. Enfin, elle télécharge les modèles U2Net, les fichiers qui repèrent le sujet dans une image.

Pour l'installer une fois pour toutes, lance cette commande depuis le dossier de Marinara :

```bash
pnpm backgroundremover:install
```

Sur macOS, la version 3.11 de Python est le choix le plus fiable. Installe-la d'abord avec Homebrew :

```bash
brew install python@3.11
```

Relance ensuite la commande d'installation :

```bash
pnpm backgroundremover:install
```

Pour que le lanceur installe cet outil à ta place au prochain démarrage, ajoute cette ligne au fichier `.env` :

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Mise à jour

Quand tu démarres Marinara avec `./start.sh` depuis un téléchargement Git, le lanceur cherche une version plus récente. Il se met à jour automatiquement avant de démarrer. Tes chats, tes personnages et tes réglages sont conservés.

Lance `./start.sh --skip-update` pour sauter une vérification. Pour conserver la version installée du moteur d'un lancement à l'autre, ajoute `AUTO_UPDATE_ENABLED=false` au fichier `.env`. La vérification et la mise à jour manuelles restent possibles depuis **Settings → Advanced → Updates** (Paramètres → Avancé → Mises à jour) ou avec des commandes Git.

La vérification est aussi possible depuis l'application. Ouvre le panneau **Settings**, va dans l'onglet **Advanced**, puis trouve la section **Updates**. Clique sur le bouton **Check for Updates** (rechercher des mises à jour) pour savoir s'il existe une version plus récente. Le bouton **Apply Update** (appliquer la mise à jour) est désactivé par défaut. Pour l'activer, règle quelques options du serveur. Enregistre ensuite un secret d'administration sous **Settings**, **Advanced**, **Admin Access**. Sans cette activation, relance simplement avec `./start.sh` pour mettre à jour.

Pour la marche à suivre complète, y compris comment sauvegarder au préalable et comment changer de canal de version, consulte le guide de mise à jour en lien ci-dessous.

## Termes clés

- **pnpm** : le gestionnaire de paquets avec lequel Marinara télécharge et organise ses composants.
- **Corepack** : un utilitaire inclus avec Node.js qui active pnpm.
- **LAN** : le réseau local, le réseau privé de ta maison ou de ton bureau.
- **.env** : un simple fichier texte de réglages placé dans le dossier de Marinara, un réglage par ligne.
- **venv** : un environnement virtuel Python, un dossier privé qui contient les paquets Python.
- **PyTorch** : une bibliothèque d'apprentissage automatique utilisée par l'outil de suppression d'arrière-plan facultatif.
- **U2Net** : les fichiers de modèle avec lesquels l'outil de suppression d'arrière-plan repère le sujet dans une image.

## Guides associés

- [Installation de Marinara Engine](../INSTALLATION.md) : choisis la méthode d'installation adaptée à ton appareil.
- [Mettre à jour Marinara Engine](../UPGRADING.md) : la marche à suivre complète pour la mise à jour et la sauvegarde, sur toutes les plateformes.
- [Accès distant : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md) : mets en place un mot de passe pour que d'autres appareils atteignent Marinara.
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md) : solutions aux problèmes d'installation et de démarrage.
