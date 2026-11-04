# Importer et exporter des lorebooks

Importe des lorebooks pour faire entrer des faits sur ton univers depuis des fichiers, et exporte-les pour les partager ou les sauvegarder. Ce guide couvre un fichier à la fois, plusieurs fichiers d'un coup et les quatre formats d'export. Un lorebook est un ensemble de notes déclenchées par des mots-clés, que Marinara ajoute au prompt (le texte que Marinara envoie à l'IA) quand un mot correspondant apparaît. D'autres outils appellent cette fonctionnalité World Info.

## Ce que tu peux importer

Marinara reconnaît le type de fichier tout seul. Les deux types sont des fichiers `.json`, et il ne te faut ni compte ni clé API (un code secret, un peu comme un mot de passe).

- Un lorebook exporté depuis Marinara. Tous les champs et tous les dossiers sont conservés.
- Un fichier World Info venu d'un autre outil, comme les fichiers World Info de SillyTavern ou le format "character-book" des fiches de personnage V2. Marinara fait correspondre les champs aux siens.

## Importer un lorebook

1. Ouvre le panneau **Lorebooks**.
2. Clique sur l'icône de flèche de téléchargement dans la rangée du haut, celle du milieu parmi les trois icônes. Son infobulle indique **Import** (importer). L'icône plus est **New** (nouveau) et l'icône coche est **Select** (sélectionner).
3. Dans la fenêtre **Import Lorebook** (importer un lorebook), touche ou clique sur la zone qui affiche **Drop one or more lorebook files here or click to browse**, et choisis tes fichiers `.json`. Sur ordinateur, tu peux aussi déposer les fichiers sur la zone. Tu peux en choisir plusieurs d'un coup, et mélanger fichiers Marinara et fichiers World Info.
4. Attends les résultats. Chaque fichier affiche soit une coche verte avec **Imported lorebook**, soit une marque rouge avec une erreur. Avec plusieurs fichiers, une ligne de synthèse indique le nombre de réussites et d'échecs.
5. Clique sur **Close** (fermer). Les nouveaux lorebooks se trouvent dans le panneau **Lorebooks**.

Marinara conserve la date propre au fichier comme date de création.

Si ça n'a pas marché : lis l'erreur à côté du fichier. Un fichier qui n'est pas un lorebook, ou qui est endommagé, échoue seul, et les autres fichiers sont quand même importés.

## Après l'import

Un lorebook importé fonctionne tout de suite avec les mots-clés. Si tu utilises la recherche sémantique, reconstruis ses vecteurs. Voir [Recherche sémantique pour les lorebooks](semantic-search.md).

## Exporter un lorebook

1. Dans le panneau **Lorebooks**, clique sur un lorebook pour l'ouvrir.
2. Clique sur l'icône d'export dans l'en-tête de l'éditeur, en haut à droite. Son infobulle indique **Export lorebook** (exporter le lorebook).
3. Dans la fenêtre **Export Lorebook**, choisis un format. Ton navigateur télécharge le fichier.

| Format | Ce que tu obtiens | À utiliser pour |
| --- | --- | --- |
| **Marinara Native** | Tous les champs des entrées et tous les dossiers. Le nom du fichier se termine par `.marinara.json`. | Transférer un lorebook vers une autre installation Marinara. |
| **Compatible JSON** | Un fichier World Info sans dossiers, dont le nom se termine par `.json`. Certains détails propres à Marinara sont abandonnés. | Les autres outils de roleplay. |
| **Markdown** | Un titre `## Name` par entrée, avec une ligne `Keys:`. | La lecture et la modification dans un éditeur de texte. |
| **CSV** | Une feuille de calcul avec les colonnes name, keys, content, folder, enabled, constant et probability. | La modification de nombreuses entrées dans un tableur. |

## Exporter plusieurs lorebooks d'un coup

1. Dans le panneau **Lorebooks**, clique sur l'icône coche (**Select**).
2. Coche chaque lorebook voulu.
3. Clique sur **Export** (exporter) dans la barre du bas.

Ton navigateur télécharge `marinara-lorebooks.zip`. L'export groupé utilise toujours **Marinara Native** : tout revient quand tu l'importes.

## Importer des entrées depuis Markdown ou CSV

Tu peux ajouter des entrées à un lorebook depuis un fichier texte Markdown ou CSV, par exemple un fichier que tu as modifié après l'export.

1. Ouvre le lorebook et clique sur **Import entries from Markdown or CSV** (importer des entrées depuis Markdown ou CSV) dans l'en-tête de l'éditeur.
2. Dans la fenêtre **Import entries** (importer des entrées), clique sur **Choose file** (choisir un fichier), ou colle du texte dans la zone.
3. Vérifie le champ **Format**. Marinara le devine d'après le texte.
4. Lis l'aperçu. En Markdown, mets un titre `## Name` par entrée, une ligne `Keys: a, b` facultative, puis le texte. En CSV, mets une ligne d'en-tête avec name, keys et content, plus les colonnes facultatives folder, enabled, constant et probability. L'aperçu indique combien d'entrées sont prêtes et liste les erreurs et les avertissements par ligne.
5. Sous **Import into** (importer dans), choisis **This lorebook** (ce lorebook) ou **New lorebook** (nouveau lorebook). Pour un nouveau lorebook, saisis un nom sous **New lorebook name** (nom du nouveau lorebook).
6. Sous **When an entry name already exists** (quand un nom d'entrée existe déjà), choisis **Skip the imported entry** (ignorer l'entrée importée), **Import as a renamed copy** (importer comme copie renommée) ou **Overwrite the existing entry** (écraser l'entrée existante).
7. Clique sur le bouton **Import**, qui affiche le nombre d'entrées.

Une notification t'indique combien d'entrées ont été ajoutées, écrasées et ignorées.

Si ça n'a pas marché : le bouton reste désactivé quand le fichier a une erreur qui touche tout le fichier, comme des colonnes obligatoires manquantes, ou quand aucune entrée n'est valide. Corrige les lignes que l'aperçu liste.

## Importer un dossier SillyTavern complet

Pour importer depuis un dossier SillyTavern complet, avec les personnages, les chats et les presets, voir [Importer depuis SillyTavern](../data/importing-from-sillytavern.md).

## Guides associés

- [Vue d'ensemble des lorebooks](overview.md)
- [Lier des lorebooks à des personnages et à des personas](linking-to-characters.md)
- [Recherche sémantique pour les lorebooks](semantic-search.md)
- [Importer depuis SillyTavern](../data/importing-from-sillytavern.md)
