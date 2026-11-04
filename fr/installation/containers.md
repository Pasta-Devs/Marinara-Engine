# Lancer Marinara dans un conteneur (Docker / Podman)

Fais tourner Marinara Engine dans un conteneur, avec Docker ou Podman. Un conteneur est un paquet qui contient l'application et tout ce dont elle a besoin : tu n'installes donc pas Node.js. Si tu veux faire tourner Marinara avec le moins de configuration possible, commence ici.

## Avant de commencer

Installe l'un de ces outils sur l'ordinateur qui fera tourner Marinara :

- Docker Desktop (Windows ou macOS) ou Docker Engine (Linux).
- Podman, un remplaçant de Docker qui n'a besoin d'aucun service en arrière-plan et fonctionne sans droits root.

Termes employés plus bas :

- **Image** : une copie de Marinara téléchargeable et en lecture seule. Tu lances une image pour créer un conteneur.
- **Volume** : un espace de stockage géré par l'outil de conteneurs. Il conserve tes données quand tu supprimes puis recrées le conteneur.

Les images officielles se trouvent sur `ghcr.io/pasta-devs/marinara-engine`.

<a id="start-marinara"></a>

## Démarrer Marinara

Le projet contient un fichier `docker-compose.yml` prêt à l'emploi. Compose est la partie de Docker qui lit ce fichier et démarre le conteneur. C'est la méthode recommandée.

1. Ouvre un terminal, une fenêtre dans laquelle tu tapes des commandes. Si tu as déjà un checkout de Marinara (une copie installée avec l'outil Git), ouvre le terminal dans ce dossier et saute les deux étapes suivantes.
2. Télécharge les fichiers du projet.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Ouvre le nouveau dossier.

   ```bash
   cd Marinara-Engine
   ```

4. Démarre le conteneur en arrière-plan.

   ```bash
   docker compose up -d
   ```

   Le premier lancement télécharge l'image `ghcr.io/pasta-devs/marinara-engine:latest`, ce qui peut prendre quelques minutes. À la fin, le terminal affiche le conteneur comme `Started`.

5. Ouvre `http://127.0.0.1:7860` dans ton navigateur. L'écran d'accueil de Marinara se charge.

Si ça n'a pas marché : un autre programme utilise peut-être le port `7860`. Choisis un port libre, par exemple `8080`. Crée un fichier nommé `.env` dans le même dossier que `docker-compose.yml`, avec la ligne `PORT=8080`, puis relance `docker compose up -d`. Compose lit ce fichier à chaque fois : les mises à jour suivantes gardent donc le nouveau port. Ouvre ensuite `http://127.0.0.1:8080`. Les autres solutions se trouvent dans [Dépannage](#troubleshooting).

## Arrêter Marinara

Lance ceci depuis le même dossier. La commande arrête et supprime le conteneur. Tes données restent dans le volume.

```bash
docker compose down
```

Avec Podman, utilise `podman compose down`.

## Où sont enregistrées tes données

Marinara enregistre tes chats, tes personnages, tes fichiers téléversés, tes polices et les arrière-plans par défaut sous forme de simples fichiers, dans un volume Compose nommé `marinara-data`. Compose ajoute le nom du dossier de projet devant : le vrai nom ressemble donc à `PROJECT_marinara-data`. Pour trouver le nom exact et l'endroit où il se trouve :

```bash
docker volume ls --filter name=marinara-data
docker volume inspect PROJECT_marinara-data
```

Remplace `PROJECT_marinara-data` par le nom affiché par la première commande.

Au premier démarrage, Marinara crée aussi un fichier de réglages vide à l'emplacement `/app/data/.env`, dans le volume. Ajoute-y les réglages du serveur. Ils survivent aux redémarrages et aux mises à jour de l'image. Voir la [Référence de configuration du serveur](../CONFIGURATION.md).

À chaque démarrage, le conteneur corrige le propriétaire du dossier de données pour que l'application puisse y écrire. Il démarre en root, corrige le propriétaire, puis bascule sur un utilisateur non-root. Cela fonctionne pour le volume comme pour un dossier que tu montes depuis ton ordinateur.

<a id="open-marinara-from-another-device"></a>

## Ouvrir Marinara depuis un autre appareil

Par défaut, Compose ne laisse que cet ordinateur atteindre Marinara. Pour l'ouvrir sur un téléphone ou un autre ordinateur, publie le port sur toutes les interfaces et définis d'abord une connexion. N'expose jamais Marinara sur ton réseau sans connexion.

Docker Desktop, OrbStack et Docker rootless (Docker sans root) font apparaître chaque appareil sous une même adresse de passerelle. Sans connexion, un port publié sur toutes les interfaces laisse entrer tout le monde. Une fois la connexion définie, cet ordinateur doit lui aussi la fournir. Voir [Contournement Tailscale et Docker](../REMOTE_ACCESS.md#tailscale-and-docker-bypass).

1. Ouvre `docker-compose.yml`, dans le dossier Marinara, avec un éditeur de texte.
2. Dans la liste `ports:`, supprime `127.0.0.1:`.

   ```yaml
   ports:
     - "${PORT:-7860}:7860"
   ```

3. Dans la liste `environment:`, ajoute un secret d'administration. Utilise ta propre valeur, longue et aléatoire.

   ```yaml
   environment:
     - ADMIN_SECRET=another-long-random-value
   ```

4. Dans la même liste, ajoute une connexion. Utilise ton propre nom d'utilisateur et un mot de passe long et aléatoire.

   ```yaml
   - BASIC_AUTH_USER=your-username
   - BASIC_AUTH_PASS=another-long-random-password
   ```

5. Enregistre le fichier et redémarre le conteneur.

   ```bash
   docker compose up -d
   ```

6. Sur l'autre appareil, ouvre `http://YOUR_COMPUTER_IP:7860`. Si tu as défini `PORT`, utilise ce port. La page te demande ta connexion.

Si tu omets `BASIC_AUTH_USER` et `BASIC_AUTH_PASS`, la page demande à la place un code de configuration à usage unique. Trouve-le dans les logs (le journal du serveur), puis saisis-le sur la page avec un nouveau nom d'utilisateur et un nouveau mot de passe.

```bash
docker logs <container> 2>&1 | grep "setup code"
```

Tu peux modifier plus tard une connexion d'application dans **Settings → Advanced → Access** (Paramètres → Avancé → Accès), dans un navigateur où tu es connecté. Si tu oublies le mot de passe, lance `docker exec <container> node scripts/reset-login.mjs`. Cette commande ne change pas une connexion définie par `BASIC_AUTH_USER` et `BASIC_AUTH_PASS`. Modifie ces valeurs dans le fichier compose et recrée le conteneur.

Avec Docker Desktop, OrbStack et Docker rootless, ouvre Marinara sur cet ordinateur à l'adresse `http://localhost:7860` pour définir la connexion dans **Settings**. Une liste d'autorisation d'IP ne peut pas y distinguer les appareils : utilise donc une connexion. Pour d'autres façons de limiter l'accès, et pour comprendre le rôle du secret d'administration, voir [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md).

## Mettre à jour Marinara

Les conteneurs ne se mettent pas à jour tout seuls. Fais d'abord une sauvegarde (voir [Sauvegarder et restaurer Marinara](../data/backup-and-restore.md)), puis récupère la nouvelle image et redémarre. Lance ceci depuis le dossier qui contient `docker-compose.yml` :

```bash
docker compose pull && docker compose up -d
```

Avec Podman, utilise plutôt `podman compose`. Dans l'application, **Settings → Advanced → Updates → Check for Updates** (Paramètres → Avancé → Mises à jour → Vérifier les mises à jour) affiche le tag de l'image et cette commande. L'application ne peut pas appliquer elle-même la mise à jour d'un conteneur.

Pour revenir à une version antérieure, indique son tag sur la ligne `image:` de `docker-compose.yml`, puis lance `docker compose up -d`. Lis d'abord [Revenir à une ancienne version](../UPGRADING.md#downgrading-to-an-older-version). Les builds plus anciennes ne peuvent pas ouvrir les données enregistrées par des builds plus récentes.

## Choisir un tag d'image

| Tag | Ce que c'est |
| --- | --- |
| `latest` | La version stable. `docker-compose.yml` l'utilise. |
| `X.Y.Z` | Une version figée, par exemple `ghcr.io/pasta-devs/marinara-engine:2.5.1`. |
| `staging` | Une build de test instable, faite à partir de code non publié. Elle peut casser, et tu ne pourras peut-être pas ramener tes données vers une build stable. |
| `lite` | Une image plus légère. Voir plus bas. |
| `X.Y.Z-lite` | Une version figée de l'image lite. |

Si tu lances `staging`, utilise un volume distinct pour qu'elle ne puisse pas modifier tes données stables :

```bash
docker run -d --name marinara-staging \
  -p 127.0.0.1:7860:7860 \
  -v marinara-staging-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:staging
```

### L'image lite

L'image lite est un téléchargement plus léger, construit sur Wolfi, une base Linux minimale pour les conteneurs. Elle laisse de côté les fonctions qui réclament de gros fichiers locaux :

| Absent de lite | Ce que tu perds |
| --- | --- |
| Modèle intégré | Tu ne peux pas faire tourner un modèle d'IA sur ton propre matériel. |
| Modèle d'embeddings local | Pas d'embeddings de texte (une représentation numérique du texte) calculés sur l'appareil. |
| Memory Recall (recherche sémantique) | Il dépend du modèle d'embeddings local. |
| Entrée vocale Local Whisper | Pas de reconnaissance vocale pour les appels Conversation. |
| Lecteur d'humeur des avatars | 2D Avatars et 3D Avatars choisissent les expressions à partir d'une liste de mots, et non du petit modèle d'émotions local. |

Tout le reste fonctionne : le chat, le roleplay, Game Mode, les agents, les lorebooks, les personnages et les services d'IA distants. Pour les fonctions d'IA, tu dois ajouter un compte pour un service externe. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

```bash
docker run -d --name marinara-lite \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:lite
```

Certaines anciennes images lite plantent sur Raspberry Pi 4 et les ordinateurs ARM similaires, avec une erreur `SIGILL` (une erreur d'instruction illégale) pendant les appels sortants vers l'IA. Sur ces appareils, utilise l'image `latest` classique. Les détails à jour figurent dans [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Podman

Podman fait tourner les mêmes images. Dans la plupart des commandes, remplace `docker` par `podman`.

```bash
podman compose up -d
```

Pour lancer un conteneur unique sans Compose :

```bash
podman run -d \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose` a besoin de l'utilitaire `podman-compose`. Installe-le avec l'une de ces commandes :

```bash
sudo dnf install podman-compose
sudo apt install podman-compose
pip install podman-compose
```

La première ligne est pour Fedora, la deuxième pour Debian ou Ubuntu, et la troisième fonctionne partout où pip est installé.

## Construire l'image toi-même

Pour construire l'image depuis les sources au lieu de la télécharger :

```bash
docker build -t marinara-engine .
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Pour construire l'image lite, utilise le fichier de build lite :

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

<a id="troubleshooting"></a>

## Dépannage

**La page ne se charge pas, ou le port est déjà utilisé.** Voir la solution pour le port dans [Démarrer Marinara](#start-marinara).

**Marinara n'arrive pas à écrire de fichiers, ou des erreurs de permission apparaissent.** Le conteneur corrige le propriétaire des dossiers à chaque démarrage. Cette correction peut échouer sur certains systèmes de fichiers hôtes, et elle est ignorée si tu définis `MARINARA_SKIP_DATA_CHOWN=true`. Si les erreurs persistent, utilise le volume `marinara-data` par défaut. C'est le plus fiable.

**L'image lite plante sur un Raspberry Pi 4.** Utilise l'image `latest` classique.

Pour plus d'aide, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Référence de configuration du serveur](../CONFIGURATION.md)
- [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
