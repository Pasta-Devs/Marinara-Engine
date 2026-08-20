# Où Marinara enregistre tes données

Ce guide explique où Marinara Engine conserve tes données, sur ton propre ordinateur. Au programme : le dossier de données principal, le dossier `storage` et les dossiers de ressources qu'il contient, ainsi que le fichier de clé de chiffrement qui protège les clés API enregistrées.

Marinara Engine (appelé "Marinara" dans la suite) fonctionne sur ta propre machine. Marinara enregistre les personnages, les chats et les réglages uniquement sur ton ordinateur. Garde en tête qu'au moment de générer une réponse, Marinara envoie quand même le contenu du chat au fournisseur d'IA auquel tu es connecté.

## Le dossier de données (DATA_DIR)

Tout ce que tu crées dans Marinara se trouve dans un seul dossier, sur la machine qui fait tourner le serveur. Ce dossier s'appelle le dossier de données. La variable d'environnement qui pointe vers lui se nomme `DATA_DIR`. Une variable d'environnement est une valeur définie sur le serveur, en dehors de l'application. Tu ne la trouveras donc pas dans le panneau **Settings** (Paramètres) de l'application.

Par défaut, le dossier de données est un dossier nommé `data` que Marinara crée à côté de ses fichiers serveur. Si tu utilises un conteneur Docker officiel, le dossier de données est `/app/data`, à l'intérieur du conteneur.

Si tu ne sais pas où se trouve le dossier de données, regarde le log de démarrage du serveur (le journal du serveur). Au démarrage, Marinara affiche une ligne qui commence par `[storage] DATA_DIR=`, suivi du chemin complet vers ton dossier de données.

Tu peux déplacer le dossier de données ailleurs en définissant toi-même `DATA_DIR`. Pour savoir comment faire, consulte la [Référence de configuration du serveur](../CONFIGURATION.md). Marinara doit redémarrer pour qu'une nouvelle valeur de `DATA_DIR` prenne effet.

## Le dossier storage et les dossiers de ressources

À l'intérieur du dossier de données, tes données sont réparties entre un dossier `storage` et plusieurs dossiers de ressources.

Le dossier `storage` contient tes données textuelles : personnages, chats, messages, lorebooks, presets et connexions. Marinara enregistre chaque table dans de petits fichiers regroupés par propriétaire — par exemple, les messages d'un chat ou les entrées d'un lorebook — afin que la modification d'un élément ne réécrive pas un fichier JSON global toujours plus volumineux. Lors de la mise à niveau unique depuis un ancien stockage, Marinara conserve les fichiers de table d'origine à côté des nouveaux dossiers avec le suffixe `.pre-shard`.

Les images, les fichiers audio et les autres médias occupent leurs propres dossiers, chacun nommé d'après ce qu'il contient. Voici les principaux dossiers de ressources :

| Dossier | Ce qu'il contient |
| --- | --- |
| `avatars` | Avatars des personnages et des personas |
| `sprites` | Sprites des personnages |
| `backgrounds` | Arrière-plans de chat que tu as téléversés |
| `gallery` | Images de la galerie |
| `fonts` | Polices personnalisées que tu as ajoutées |
| `knowledge-sources` | Fichiers téléversés pour les agents de connaissances |
| `game-assets` | Ressources du Game Mode |
| `custom-emojis` | Images d'emojis personnalisés |
| `custom-stickers` | Images de stickers personnalisés |

Pour une explication technique plus poussée du fonctionnement du dossier `storage`, les développeurs peuvent lire [Stockage natif sur fichiers](../development/file-storage.md).

## Le fichier de clé de chiffrement

Marinara chiffre les clés API enregistrées pour qu'elles ne soient pas stockées en clair. La clé utilisée pour ce chiffrement est conservée dans un fichier nommé `.encryption-key`, à l'intérieur de ton dossier de données.

Ce fichier compte au moment de déplacer ou de restaurer tes données. Imagine que tu copies le dossier de données sur une nouvelle machine, en laissant le fichier `.encryption-key` derrière toi. Marinara ne peut plus déchiffrer les clés API enregistrées, et il faut donc les saisir à nouveau. Garde toujours ce fichier avec le reste de tes données.

Certaines configurations avancées fournissent la clé par la variable d'environnement `ENCRYPTION_KEY` plutôt que par le fichier. Si tu utilises cette variable, conserve sa valeur en lieu sûr, de son côté. Dans ce cas, il n'y a aucun fichier `.encryption-key` à copier. Consulte la [Référence de configuration du serveur](../CONFIGURATION.md) pour les détails.

## Où sont mes données sur Android

Sur Android, le dossier de données du serveur se trouve en général dans un espace de stockage de l'application inaccessible sans accès root. Impossible, donc, de simplement copier le dossier depuis le téléphone.

Pour récupérer une copie de tes données sur Android, utilise le bouton **Download Backup** (télécharger la sauvegarde). Tu le trouves dans **Settings**, sur l'onglet **Advanced**, dans la section **Backup & Export**. Il crée un seul fichier zip contenant tes données. Le zip inclut le fichier `.encryption-key` quand celui-ci existe. C'est la méthode la plus fiable pour sauvegarder tes données depuis un téléphone.

La même section peut conserver de 1 à 9999 archives automatiques tournantes quotidiennes, hebdomadaires ou mensuelles dans
`backups/`, à l'intérieur du dossier de données. La plus récente porte le nom `marinara-automatic-backup.zip` et les anciennes
archives automatiques conservées sont horodatées. Cette limite ne s'applique qu'aux sauvegardes automatiques. Copie aussi les
sauvegardes importantes ailleurs que dans l'espace de stockage de l'application : désinstaller ou réinitialiser l'application
peut supprimer à la fois les données actives et ses sauvegardes automatiques locales.

Pour la marche à suivre complète, sauvegarde et restauration, sur chaque plateforme, consulte [Sauvegarder et restaurer Marinara](backup-and-restore.md).

## Guides associés

- [Sauvegarder et restaurer Marinara](backup-and-restore.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
- [Stockage natif sur fichiers](../development/file-storage.md)
