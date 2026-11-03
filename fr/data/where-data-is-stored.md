# Où Marinara enregistre tes données

Trouve le dossier où Marinara Engine garde tes données, et sache quelles parties conserver quand tu les déplaces ou les copies.

Marinara s'exécute sur ton propre ordinateur et y enregistre tes personnages, tes chats et tes réglages. Quand tu génères une réponse, Marinara envoie quand même le contenu de ton chat au service d'IA que tu as connecté.

## Trouve le dossier de données

Tout ce que tu crées vit dans un seul dossier sur l'ordinateur qui exécute le serveur. C'est le dossier de données. Son réglage est `DATA_DIR`, une valeur que tu donnes au serveur avant son démarrage (une variable d'environnement). Il n'est pas dans **Settings** (Paramètres).

- Par défaut, c'est un dossier nommé `data` à côté des fichiers du serveur.
- Dans le conteneur Docker officiel, c'est `/app/data`.
- Pour voir le chemin exact, regarde la fenêtre où tu as démarré Marinara (le terminal ou la console). Au démarrage, elle affiche une ligne qui commence par `[storage] DATA_DIR=` suivie du chemin. Si tu ne trouves pas cette fenêtre, cherche un dossier nommé `data` dans le dossier Marinara.

Pour déplacer le dossier, définis `DATA_DIR` et redémarre Marinara. Voir la [référence de configuration du serveur](../CONFIGURATION.md).

## Ce que contient le dossier

Tes données texte sont dans le dossier `storage` : personnages, chats, messages, lorebooks, presets et connexions. Marinara les enregistre dans autant de petits fichiers que nécessaire. Après une mise à jour depuis l'ancienne organisation, tu peux avoir d'anciennes copies dans `storage/tables/` avec des noms qui finissent par `.pre-shard`. Marinara ne les supprime jamais. Tu peux les supprimer toi-même pour libérer de la place, quand tout fonctionne.

Tes images, ton audio et tes autres fichiers sont dans leurs propres dossiers, à côté de `storage`. Les noms des dossiers sont :

| Dossier | Ce qu'il contient |
| --- | --- |
| `avatars` | Avatars de personnages et de personas |
| `sprites` | Sprites de personnages |
| `avatar-models` | Fichiers des agents **2D Avatars** et **3D Avatars**, comme des images PNGTuber et des modèles 3D |
| `backgrounds` | Arrière-plans de chat que tu as téléversés |
| `gallery` | Images de la galerie |
| `fonts` | Polices personnalisées que tu as ajoutées |
| `knowledge-sources` | Fichiers que tu as téléversés pour les agents de connaissances |
| `game-assets` | Ressources du Game Mode |
| `game-scene-videos` | Vidéos de scène du Game Mode |
| `conversation-call-character-videos` | Vidéos de personnages pour les appels Conversation |
| `custom-emojis` | Images d'emojis personnalisés |
| `custom-stickers` | Images de stickers personnalisés |
| `notification-sounds` | Ton son de notification personnalisé |
| `long-term-memory` | Données de l'agent de mémoire à long terme |
| `lorebooks/images`, `prompts/images`, `agents/images`, `connections/images` | Images attachées aux lorebooks, presets, agents et comptes |

Le dossier de données contient aussi `backups/` (tes [sauvegardes automatiques](backup-and-restore.md#automatic-backups)) et le fichier de clé de chiffrement. **Download Backup** (télécharger la sauvegarde) inclut chaque dossier du tableau, `storage` et le fichier de clé. Les développeurs peuvent lire le [stockage par fichiers](../development/file-storage.md).

## Garde le fichier de clé de chiffrement

Marinara chiffre tes clés API enregistrées. La clé pour cela est le fichier `.encryption-key` dans le dossier de données.

Si tu copies tes données vers un nouvel ordinateur sans ce fichier, Marinara ne peut pas lire tes clés API enregistrées. Tu dois les saisir à nouveau. Copie-le avec le reste du dossier de données.

Certaines installations donnent la clé par la variable d'environnement `ENCRYPTION_KEY`. Dans ce cas, il n'y a pas de fichier à copier. Garde cette valeur en lieu sûr, à part. Voir la [référence de configuration du serveur](../CONFIGURATION.md).

## Copier tes données depuis Android

Sur Android, le dossier de données est dans le stockage de l'application, auquel tu ne peux pas accéder sans accès root. Tu ne peux donc pas le copier. Utilise **Settings → Advanced → Backup & Export → Download Backup** (Paramètres → Avancé → Sauvegarde et export → Télécharger la sauvegarde). Le `.zip` inclut le fichier `.encryption-key` quand il existe. Voir [Sauvegarder et restaurer Marinara](backup-and-restore.md).

Les sauvegardes automatiques sont enregistrées dans le même stockage de l'application. Si tu désinstalles ou réinitialises l'application, tu peux les perdre avec les données actives. Garde donc une copie ailleurs.

## Guides associés

- [Sauvegarder et restaurer Marinara](backup-and-restore.md)
- [Effacer ou réinitialiser tes données](clearing-data.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
- [Stockage par fichiers](../development/file-storage.md)
