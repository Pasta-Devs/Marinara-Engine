# Importer et exporter des fiches de personnage

Ce guide explique comment importer des fiches de personnage dans Marinara Engine et comment exporter tes propres personnages. Au programme : les types de fichiers acceptés, les options de la fenêtre d'import et les trois formats d'export.

Une fiche de personnage est un fichier unique qui contient un personnage : son nom, sa description, sa personnalité, ses messages d'accueil et, souvent, un avatar. Grâce aux fiches, un personnage passe de Marinara à une autre application de roleplay, et inversement.

## Formats d'import

La fenêtre **Import Character** (importer un personnage) accepte quatre types de fichiers. Tu peux déposer plusieurs fichiers d'un coup, même de types différents.

| Type de fichier | De quoi il s'agit |
| --- | --- |
| **.json** | Une fiche de personnage simple, sous forme de texte (Chara Card V2). |
| **.png** | Une image de fiche de personnage, avec les données de la fiche dissimulées dans l'image. |
| **.charx** | Un paquet Character Card V3 (CharX), le format zip utilisé par RisuAI. |
| **.marinara** | Un export natif de Marinara (parfois nommé `.marinara.json`). |

Un fichier **.marinara** conserve le plus de détails, puisqu'il s'agit du format propre à Marinara. Les trois autres viennent de SillyTavern, Chub, Risu et d'outils similaires.

## Importer un personnage

Voici la marche à suivre pour ajouter une ou plusieurs fiches à ta bibliothèque.

1. Ouvre le panneau **Characters** (personnages).
2. Clique sur le bouton **Import** (importer) dans la barre d'outils. C'est un bouton icône avec une flèche de téléchargement. La fenêtre **Import Character** s'ouvre.
3. Fais glisser les fichiers sur la fenêtre, ou clique dessus pour parcourir l'ordinateur. Le texte "Drop one or more files here or click to browse" s'affiche.
4. Règle les deux options d'import (décrites plus bas). Elles s'appliquent à tous les fichiers du lot.
5. Attends la liste des résultats. Chaque fichier affiche une coche verte avec "Imported" et le nom, ou une marque rouge avec une erreur.

### Choisir les tags à conserver

L'option **Imported card tags** (tags des fiches importées) décide du sort des tags présents sur la fiche entrante. C'est ce qu'on appelle le mode d'import des tags. Trois choix s'offrent à toi :

- **All tags** : conserve tous les tags de la fiche source. C'est la valeur par défaut.
- **No tags** : ignore les tags de la source.
- **Existing only** : ne garde que les tags qui existent déjà dans ta bibliothèque.

### Choisir la portée des scripts regex

Certaines fiches embarquent des scripts regex, de petites règles de remplacement de texte. L'option **Imported regex scripts** (scripts regex importés) définit leur portée :

- **Character only** : les scripts ne s'appliquent qu'à ce personnage. C'est la valeur par défaut.
- **Global** : les scripts sont ajoutés aux **Presets**, dans la section **Regexes**, et s'appliquent dans tous les chats.

Choisis **Character only**, sauf si tu veux vraiment que ces règles s'appliquent partout.

### Fiches avec un lorebook intégré

Un lorebook (recueil de faits sur ton univers) rassemble des informations de fond que l'IA peut consulter pendant un chat. Si une fiche que tu importes contient un lorebook intégré, l'import s'interrompt et le panneau **Embedded lorebook found** apparaît. Il liste chaque fichier et le nombre d'entrées qu'il contient. Choisis une option pour l'ensemble du lot :

- **Import Lorebook** (importer le lorebook) : crée aussi un lorebook Marinara autonome, lié au personnage.
- **No Import** : garde le lorebook uniquement à l'intérieur de la fiche.

### Importer plusieurs fiches d'un coup

La même fenêtre **Import Character** gère les imports par lot. Sélectionne plusieurs fichiers : Marinara les importe l'un après l'autre. La liste des résultats affiche une ligne par fichier, ce qui montre d'un coup d'œil les fiches réussies et celles en échec.

## Exporter un personnage

Ouvre un personnage dans l'éditeur, puis clique sur **Export character** (exporter le personnage) dans la barre d'outils du haut. La fenêtre **Export Character** propose trois formats.

| Format | Ce que tu obtiens | Idéal pour |
| --- | --- | --- |
| **Marinara Native** | Un fichier `.marinara.json` qui conserve les métadonnées Marinara, les sprites, les images de la galerie et les lorebooks attachés. | Déplacer un personnage d'une installation Marinara à une autre sans rien perdre. |
| **Compatible JSON** | Du JSON Chara Card V2 simple, sans l'enveloppe Marinara. | Partager la fiche vers d'autres applications qui lisent les fiches JSON. |
| **Compatible PNG Card** | Une image Chara Card V2 avec les données de la fiche intégrées à l'image. | Les applications et les sites qui attendent une fiche PNG, comme SillyTavern, Chub et Risu. |

Choisis **Marinara Native** pour tout conserver. Choisis l'un des formats **Compatible** quand le fichier part vers un autre outil. Ces deux formats compatibles abandonnent les éléments propres à Marinara, comme les sprites et les images de la galerie. Ils ajoutent les champs **Backstory** (histoire du personnage) et **Appearance** (apparence) non vides à la Description standard, afin que les autres lecteurs V2 conservent ces informations sur le personnage. Ces champs sont retirés des extensions exportées pour éviter les doublons lors d'une réimportation. Ta fiche enregistrée ne change pas ; **Marinara Native** conserve les champs séparés.

## Exporter plusieurs personnages d'un coup

Un lot de personnages s'exporte dans un seul fichier zip.

1. Ouvre le panneau **Characters**.
2. Clique sur le bouton **Select** (sélectionner) dans la barre d'outils pour passer en mode sélection. C'est un bouton icône avec une coche.
3. Coche les personnages voulus.
4. Clique sur **Export** dans la barre d'actions, en bas. Marinara télécharge un zip nommé `marinara-characters.zip`.

Le zip contient un fichier **Marinara Native** par personnage. L'export par lot ne propose ni PNG ni JSON compatible : pour ces formats, passe par l'export d'un seul personnage.

## Importer un dossier SillyTavern complet

Les étapes ci-dessus concernent les fiches que tu choisis à la main. Pour déplacer une installation SillyTavern entière d'un coup, utilise plutôt l'importateur de dossier par lot. Il récupère ensemble les personnages, les chats, les presets et les lorebooks. Il se trouve dans **Settings** (Paramètres), sous l'onglet **Imports**. Voir [Importer depuis SillyTavern](../data/importing-from-sillytavern.md) pour le déroulé complet.

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Card Browser : trouver et importer des personnages](bot-browser.md)
- [Importer depuis SillyTavern](../data/importing-from-sillytavern.md)
