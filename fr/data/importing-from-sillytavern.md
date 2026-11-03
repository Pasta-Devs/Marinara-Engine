# Importer depuis SillyTavern

Amène tes données SillyTavern dans Marinara Engine. Importe un fichier à la fois, ou analyse un dossier SillyTavern complet et importe tout d'un coup.

## Ce que tu peux amener

| Données SillyTavern | Dans Marinara |
| --- | --- |
| Characters | Personnages |
| Chats et chats de groupe | Chats |
| Presets | Presets (un ensemble enregistré de paramètres de génération) |
| World Info | Lorebooks (des notes que l'IA lit quand certains mots apparaissent) |
| Backgrounds | Arrière-plans de chat |
| Personas | Personas (le profil qui te représente) |

## Imports rapides d'un seul fichier

1. Ouvre **Settings → Imports** (Paramètres → Imports).
2. Dans **SillyTavern Import**, clique sur le bouton qui correspond à ton type de fichier.
3. Choisis le fichier.

| Bouton | Fichier |
| --- | --- |
| **Import Character (JSON/PNG)** (importer un personnage) | Un personnage en `.json` ou `.png`. |
| **Import Chat (JSONL)** (importer un chat) | Un journal de chat en `.jsonl` (un enregistrement JSON par ligne, le format dans lequel SillyTavern enregistre les chats). |
| **Import Preset (JSON)** (importer un preset) | Un preset en `.json`. |
| **Import Lorebook (JSON)** (importer un lorebook) | Un fichier World Info en `.json`. |

Les boutons n'ont pas d'options. Un import de personnage garde tous les tags source et limite les scripts regex à ce personnage. Un script regex est une règle de recherche et remplacement pour du texte. Pour choisir ces options, utilise **Import** dans le panneau Characters. Voir [Importer et exporter des fiches de personnage](../characters/import-export.md).

Si une fiche de personnage contient un lorebook, ton navigateur demande si tu veux l'importer comme son propre lorebook. Clique sur **OK** pour le garder comme un lorebook réutilisable, ou sur **Cancel** pour importer seulement le personnage.

**Import Chat (JSONL)** crée un chat Roleplay, sauf si le fichier enregistre un autre mode, et l'ouvre.

### Importer un chat dans le mode de ton choix

Pour choisir le mode, utilise le bouton d'import en haut de la liste des chats. Son infobulle est **Import SillyTavern or Marinara chat JSONL**. Il importe dans l'onglet de mode que tu as ouvert (Conversation, Roleplay ou Game). Voir [Exporter et importer des chats](../chats/export-import.md).

## Importer un dossier SillyTavern

**Avant de commencer :** l'assistant lit les fichiers sur l'ordinateur du serveur. Si SillyTavern est sur un autre ordinateur, copie d'abord son dossier (celui où tu as installé SillyTavern) sur l'ordinateur de Marinara. Sur l'ordinateur de Marinara, l'assistant fonctionne tout de suite. Depuis un autre appareil, définis le secret d'administration et saisis-le dans **Settings → Advanced → Admin Access**. Voir [Sauvegarder et restaurer Marinara](backup-and-restore.md) et la section "Privileged APIs (ADMIN_SECRET)" de la [référence de configuration du serveur](../CONFIGURATION.md).

1. Ouvre **Settings → Imports → SillyTavern Import**.
2. Clique sur **Import from SillyTavern Folder**.
3. Choisis ton dossier SillyTavern. Choisis le dossier principal, d'habitude celui qui contient un dossier `data/` ou `public/`. Utilise l'une de ces méthodes :
   - Clique sur **Browse** et choisis le dossier.
   - S'il n'y a pas de sélecteur de dossier (un serveur distant), un navigateur de dossiers intégré s'ouvre. Il liste seulement les dossiers dans le dossier personnel de l'utilisateur qui exécute le serveur. Clique sur **Select This Folder**.
   - Saisis le chemin dans **SillyTavern Folder Path**, par exemple `/path/to/SillyTavern`. Un chemin saisi ne fonctionne que si le réglage `IMPORT_ALLOWED_ROOTS` du serveur liste un dossier qui le contient.
4. Clique sur **Scan Folder**. Marinara affiche combien d'éléments il a trouvés dans chaque catégorie.
5. Dans **Choose exactly what to import**, coche les éléments que tu veux. Chaque catégorie a des boutons **All** et **None**, et un bouton **Show** ou **Hide** pour les éléments individuels.
6. Clique sur **Import Selected**. Une barre de progression montre l'élément en cours et un compteur par catégorie.
7. Quand tu vois **Import complete!**, lis le compte de chaque catégorie et clique sur **Done**.

La plupart des éléments sont cochés au départ. Marinara laisse décochés les presets de base de SillyTavern, comme `deterministic`, `neutral` et les presets `universal-*`, et une bannière l'indique. Laisse-les décochés sauf si tu veux des copies.

Si l'analyse trouve des personnages, deux options de plus apparaissent :

**Imported character tags** (par défaut **All tags**) :

- **All tags** garde les tags source.
- **No tags** les ignore.
- **Existing only** garde seulement les tags que tu as déjà.

**Imported regex scripts** (par défaut **Character only**) :

- **Character only** applique les scripts au personnage.
- **Global** les ajoute à **Presets → Regexes** pour chaque personnage.

Si ça n'a pas marché :

- "Could not find SillyTavern data directory." veut dire que Marinara ne peut pas lire ce dossier. Choisis le dossier principal de SillyTavern.
- "folderPath is not allowed" veut dire que le serveur a refusé le chemin. Clique sur **Browse** et choisis plutôt le dossier. Le propriétaire du serveur peut limiter les dossiers importables avec le réglage `IMPORT_ALLOWED_ROOTS`. S'il est défini, même un dossier choisi doit se trouver dans l'un de ces dossiers. Demande à la personne qui gère le serveur, ou consulte la [référence de configuration du serveur](../CONFIGURATION.md).
- Si un élément échoue, Marinara l'ignore, garde le reste et le liste sous les avertissements à la dernière étape, par exemple `Character "Foo": error message`.

## Ce qui arrive à tes données

- Les fichiers de chat qui appartiennent à un personnage s'importent comme des branches d'un seul chat. Une branche est une copie d'un chat que tu continues séparément.
- Les chats de groupe s'importent comme des chats Roleplay.
- Les éléments importés gardent la date de dernière modification du fichier source, pas la date de l'import.

## Ce qui ne se transfère pas

L'assistant lit seulement les catégories du premier tableau. Les autres données SillyTavern, comme les réglages globaux de l'application et les réponses rapides, ne sont pas importées.

## Guides associés

- [Importer et exporter des fiches de personnage](../characters/import-export.md)
- [Importer et exporter des lorebooks](../lorebooks/import-export.md)
- [Exporter et importer des chats](../chats/export-import.md)
- [Scripts regex](../extending/regex-scripts.md)
