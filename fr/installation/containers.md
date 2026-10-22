# Lancer Marinara dans un conteneur (Docker / Podman)

Ce guide explique comment faire tourner Marinara Engine dans un conteneur, avec Docker ou Podman. Un conteneur est un paquet autonome qui embarque l'application et tout ce dont elle a besoin pour fonctionner. Inutile d'installer Node.js ou d'autres outils sur l'ordinateur. Si tu débutes et que tu veux simplement voir Marinara tourner, c'est la voie la plus simple.

## Prérequis

Avant de commencer, installe l'un de ces outils sur la machine qui fera tourner Marinara :

- Docker Desktop (Windows ou macOS) ou Docker Engine (Linux). Docker est l'outil de conteneurs le plus répandu.
- Ou Podman. Podman remplace Docker sans rien changer d'autre. Il fonctionne sans service en arrière-plan et se passe très bien des droits root.

Quelques termes employés plus bas :

- **Image** : un modèle en lecture seule, téléchargeable, qui contient Marinara Engine. Lancer une image crée un conteneur en cours d'exécution.
- **Volume** : un espace de stockage géré par l'outil de conteneurs. Un volume conserve les données même si tu supprimes puis recrées le conteneur.
- **LAN** : le réseau local (le Wi-Fi ou le réseau filaire de la maison ou du bureau).

Les images officielles de Marinara sont publiées sur `ghcr.io/pasta-devs/marinara-engine`.

## Récupérer l'image et la lancer

Le dépôt contient un fichier `docker-compose.yml` prêt à l'emploi, à la racine du projet. Compose lit ce fichier et démarre le conteneur à ta place. C'est la méthode recommandée pour faire tourner Marinara.

1. Récupère une copie du dépôt. Si tu as déjà une copie locale de Marinara Engine, ouvre un terminal dans ce dossier. Sinon, clone-le d'abord :

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Place-toi dans le dossier :

```bash
cd Marinara-Engine
```

3. Démarre le conteneur en arrière-plan :

```bash
docker compose up -d
```

Le fichier `docker-compose.yml` utilise l'image `ghcr.io/pasta-devs/marinara-engine:latest` et la télécharge au premier lancement de cette commande. Ce premier téléchargement peut prendre quelques minutes.

## Vérifier que tout fonctionne

1. Ouvre le navigateur.
2. Va à cette adresse :

```text
http://127.0.0.1:7860
```

L'écran d'accueil de Marinara Engine doit apparaître. Si c'est le cas, le conteneur tourne. L'adresse `127.0.0.1` désigne "cet ordinateur-ci", et `7860` est le port par défaut sur lequel Marinara écoute.

Si la page ne se charge pas, va voir la section Dépannage plus bas.

## Où sont enregistrées tes données

Tes données (les chats, les personnages, les fichiers téléversés, les polices et les arrière-plans par défaut) sont enregistrées sous forme de simples fichiers. Marinara utilise un stockage à base de fichiers : les données existent comme des fichiers normaux, et non à l'intérieur d'un unique fichier de base de données. Compose range ces fichiers dans un volume nommé `marinara-data`.

Compose ajoute le nom du dossier de projet devant les noms de volumes : le vrai nom du volume suit donc le motif `PROJECT_marinara-data`. Pour connaître le nom exact sur ta machine, liste les volumes :

```bash
docker volume ls --filter name=marinara-data
```

Inspecte ensuite celui de la liste pour savoir où il se trouve :

```bash
docker volume inspect PROJECT_marinara-data
```

Remplace `PROJECT_marinara-data` par le nom affiché par la commande précédente.

À chaque démarrage, le conteneur prépare le dossier de données. Par défaut, il démarre en root. Il corrige le propriétaire du dossier pour que l'application puisse y écrire, puis bascule sur un utilisateur non-root par sécurité. Cette réparation vaut aussi bien pour le volume nommé que pour un dossier monté depuis ta machine hôte. Les installations plus anciennes passent ainsi au stockage à base de fichiers sans que tu aies à lancer la moindre commande de changement de propriétaire.

Au premier démarrage, Marinara crée aussi un fichier de réglages vide dans le volume, à l'emplacement `/app/data/.env`. C'est là que tu pourras ajouter des réglages serveur par la suite. Comme il vit dans le volume, tes réglages survivent aux redémarrages du conteneur et aux mises à jour de l'image. La liste complète des réglages se trouve dans [Référence de configuration du serveur](../CONFIGURATION.md).

## Rendre Marinara accessible sur ton réseau local

Par défaut, Compose n'autorise l'accès à Marinara que depuis le même ordinateur. C'est le réglage sûr. Pour ouvrir Marinara sur ton téléphone ou sur un autre ordinateur du réseau, deux actions sont nécessaires. Change la redirection de port, et active une connexion pour que des inconnus ne puissent pas y accéder.

Les autres appareils ont besoin d'une connexion avant de pouvoir utiliser Marinara. N'expose jamais Marinara sur ton réseau sans connexion.

1. Ouvre le fichier `docker-compose.yml` dans un éditeur de texte.

2. Repère la ligne des ports. Elle ressemble à ceci :

```yaml
ports:
  - "127.0.0.1:${PORT:-7860}:7860"
```

3. Supprime la partie `127.0.0.1:` pour que l'application soit joignable depuis les autres appareils :

```yaml
ports:
  - "${PORT:-7860}:7860"
```

4. Dans le même fichier, ajoute un secret d'administration à la liste `environment:`. Utilise ta propre valeur :

```yaml
environment:
  - ADMIN_SECRET=another-long-random-value
```

5. Enregistre le fichier et redémarre le conteneur :

```bash
docker compose up -d
```

Les autres appareils du réseau atteignent désormais Marinara à l'adresse `http://YOUR_COMPUTER_IP:7860` tant que la variable `PORT` n'est pas définie. Si tu définis `PORT`, remplace `7860` par ce port hôte. Ils devront saisir le nom d'utilisateur et le mot de passe que tu as choisis. Ils voient une page qui demande une connexion. Pour la définir, trouve le code de configuration à usage unique avec `docker logs <container> 2>&1 | grep "setup code"`. Saisis le code sur cette page avec un nouveau nom d'utilisateur et un nouveau mot de passe. Tu peux modifier la connexion plus tard dans **Paramètres → Avancé → Accès**, dans un navigateur connecté. Si tu oublies le mot de passe, lance `docker exec <container> node scripts/reset-login.mjs`. Cela ne change pas une connexion définie par `BASIC_AUTH_USER` et `BASIC_AUTH_PASS` : modifie ces valeurs dans le fichier compose et recrée le conteneur. Tu peux aussi définir une connexion dans le fichier compose avec `BASIC_AUTH_USER` et `BASIC_AUTH_PASS` dans la liste `environment:`.

Avec Docker Desktop, OrbStack et Docker sans root (rootless), tous les appareils atteignent le conteneur depuis la même adresse, ton propre navigateur compris. Une fois la connexion définie, cet ordinateur te la demande donc aussi, et une liste d'autorisation d'IP ne peut pas distinguer les appareils. Définis la connexion avant de retirer `127.0.0.1:`. Sur ces environnements, ouvre Marinara sur cet ordinateur à l'adresse `http://localhost:7860` et utilise **Paramètres**, ou définis `BASIC_AUTH_USER` et `BASIC_AUTH_PASS` dans le fichier compose. Ne retire jamais `127.0.0.1:` sans la connexion : avec ces environnements, Marinara ne peut pas distinguer les autres appareils de cet ordinateur. Pour découvrir de bonnes façons de n'autoriser que certains appareils, et pour comprendre le rôle du secret d'administration, lis [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md).

## Choisir une image : latest, staging ou lite

Marinara publie plusieurs tags d'images. Prends celui qui correspond à tes besoins.

- `latest` est la version stable recommandée. Le fichier `docker-compose.yml` l'utilise par défaut.
- `X.Y.Z` correspond à une version figée, par exemple `ghcr.io/pasta-devs/marinara-engine:2.0.6`. Sers-t'en pour rester sur une version précise.
- `staging` est une version de test instable, construite à partir du code de développement le plus récent. Ne l'utilise que pour essayer des changements pas encore publiés. Elle peut casser, changer de comportement sans prévenir, et t'empêcher de ramener tes données vers une version stable.
- `lite` est une image plus légère. La section suivante la décrit en détail.

Si tu lances l'image `staging`, utilise un volume distinct pour qu'une version instable ne touche pas à tes données stables :

```bash
docker run -d --name marinara-staging -p 127.0.0.1:7860:7860 -v marinara-staging-data:/app/data ghcr.io/pasta-devs/marinara-engine:staging
```

### L'image lite

L'image lite est une variante plus légère : elle abandonne certaines fonctions hors ligne en échange d'un téléchargement bien plus petit. Elle repose sur Wolfi, une base Linux minimale conçue pour les conteneurs.

L'image lite retire les fonctions qui réclament de gros fichiers locaux :

| Retiré dans lite | Ce que tu perds |
| --- | --- |
| Modèle local (Gemma, tourne sur ta machine) | Impossible de faire tourner un modèle d'IA sur ton propre matériel. |
| Modèle d'embeddings local | Plus d'embeddings de texte calculés sur l'appareil. |
| Memory Recall (recherche sémantique) | Dépend du modèle d'embeddings local. |
| Entrée vocale Whisper locale | La reconnaissance vocale des appels en mode Conversation disparaît. |
| Lecteur d'humeur des avatars | 2D Avatars et 3D Avatars choisissent les expressions à partir d'une liste de mots au lieu du petit modèle d'émotions local. |

Tout le reste fonctionne à l'identique : le chat, le roleplay, Game Mode, les agents, les lorebooks, les personnages et les connexions aux fournisseurs d'IA distants. Pour profiter des fonctions d'IA avec l'image lite, il faut connecter un fournisseur externe (OpenRouter, OpenAI ou un modèle auto-hébergé, par exemple). Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

Le tag lite est `ghcr.io/pasta-devs/marinara-engine:lite`, et chaque version publie également un tag lite figé du type `ghcr.io/pasta-devs/marinara-engine:X.Y.Z-lite`. Pour la lancer :

```bash
docker run -d --name marinara-lite -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:lite
```

Certaines anciennes images lite plantent sur Raspberry Pi 4 et sur les ordinateurs ARM similaires. Le plantage affiche une erreur `SIGILL` (une erreur d'instruction illégale renvoyée par le processeur) pendant les appels sortants vers le fournisseur d'IA. Si tu utilises l'un de ces appareils, prends plutôt l'image `latest` classique. Les détails à jour figurent dans [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Mettre à jour

Les images de conteneurs ne se mettent pas à jour toutes seules. Tu récupères une image plus récente et tu redémarres le conteneur à la main. Fais d'abord une sauvegarde, pour pouvoir revenir exactement là où tu en étais. Voir [Sauvegarder et restaurer Marinara](../data/backup-and-restore.md).

Avec Docker Compose, une seule commande suffit :

```bash
docker compose pull && docker compose up -d
```

Avec Podman Compose, une seule commande suffit :

```bash
podman compose pull && podman compose up -d
```

Autre option : vérifier la version depuis l'application. Ouvre la section **Settings** (Paramètres), va dans l'onglet **Advanced** et repère la section **Updates**. Clique sur le bouton **Check for Updates**. Sur une installation en conteneur, Marinara détecte qu'il tourne dans Docker et t'affiche le tag de l'image publiée ainsi que la commande à lancer sur l'hôte. Il ne peut pas appliquer la mise à jour depuis le navigateur : c'est donc à toi de lancer la commande ci-dessus sur la machine hôte.

Pour revenir à une version antérieure, indique son tag de version sur la ligne `image:` du fichier `docker-compose.yml`, par exemple `ghcr.io/pasta-devs/marinara-engine:2.5.0`, puis lance `docker compose up -d`. Revenir à la version 2.5.0 fonctionne et tes chats s'ouvrent normalement, mais la version 2.5.0 ne connaît pas les réglages et les données de jeu ajoutés par les fonctionnalités plus récentes. Tout chat ou toute connexion que la version 2.5.0 enregistre perd ces données, et une nouvelle mise à jour ne les fait pas revenir. Voir [Revenir à la version 2.5.0](../UPGRADING.md#going-back-to-250).

## Podman

Podman fait tourner les mêmes images que Docker. Dans la plupart des cas, il suffit de remplacer `docker` par `podman` dans les commandes ci-dessus.

Pour démarrer avec Compose :

```bash
podman compose up -d
```

Pour lancer un conteneur unique sans Compose :

```bash
podman run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

La commande `podman compose` a besoin de l'utilitaire `podman-compose`. Installe-le avec la commande adaptée à ton système.

Sur Fedora :

```bash
sudo dnf install podman-compose
```

Sur Debian ou Ubuntu :

```bash
sudo apt install podman-compose
```

Avec pip :

```bash
pip install podman-compose
```

## Construire l'image toi-même

Si tu préfères construire l'image depuis les sources plutôt que de la télécharger :

```bash
docker build -t marinara-engine .
```

Lance ensuite ta propre version :

```bash
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Pour construire l'image lite depuis les sources, indique à Docker le fichier de build lite :

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## Dépannage

**La page ne se charge pas, ou le port est déjà utilisé.** Un autre programme occupe peut-être déjà le port `7860`. Change la redirection de port vers un port libre, par exemple `8080:7860` dans la liste `ports:`. Redémarre ensuite avec `docker compose up -d` et ouvre `http://127.0.0.1:8080`.

**Marinara n'arrive pas à écrire de fichiers, ou des erreurs de permission apparaissent.** Le conteneur corrige le propriétaire du dossier de données à chaque démarrage. Cela vaut pour les volumes nommés comme pour les dossiers montés depuis ta machine hôte. Cette réparation peut échouer sur certains systèmes de fichiers hôtes, et elle est ignorée si tu définis `MARINARA_SKIP_DATA_CHOWN=true`. Si les erreurs persistent, utilise le volume nommé `marinara-data` par défaut. C'est le choix le plus fiable.

**L'image lite plante sur un Raspberry Pi 4.** Voir la remarque sur l'image lite plus haut. Sur ce matériel, prends l'image `latest` classique.

Pour aller plus loin, lis [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Référence de configuration du serveur](../CONFIGURATION.md)
- [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
