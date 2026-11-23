# Importer et exporter des fiches de personnage

Une fiche de personnage est un fichier unique qui contient un personnage : son nom, sa description, sa personnalité, ses salutations et, souvent, un avatar. Importe des fiches pour ajouter des personnages venus d'autres applications et d'autres sites. Exporte tes propres personnages pour les sauvegarder ou les partager.

## Importer un personnage

Avant de commencer : il te faut un fichier de fiche de personnage sur ton appareil. Pour trouver plutôt des fiches en ligne, voir [Card Browser](bot-browser.md).

1. Clique sur **Characters** (personnages) dans la barre de navigation du haut. Si tu ne le vois pas, ouvre d'abord **More** (plus).
2. Clique sur **Import** (importer) dans la barre d'outils (l'icône avec une flèche de téléchargement). La fenêtre **Import Character** (importer un personnage) s'ouvre.
3. Règle les options d'import décrites plus bas. Elles s'appliquent à tous les fichiers de ce lot.
4. Dépose tes fichiers sur la fenêtre, ou touche-la ou clique dessus pour ouvrir le sélecteur de fichiers de ton appareil. Tu peux choisir plusieurs fichiers, et leurs types peuvent être mélangés.
5. Attends la liste des résultats. Chaque fichier affiche une coche verte, ou une marque rouge avec une erreur. Le texte est `Imported "Name"`, `Imported "Name" with its embedded lorebook` ou `Imported "Name" without creating the embedded lorebook`.
6. Retrouve le nouveau personnage dans **Characters**.

Marinara accepte quatre types de fichiers :

| Type de fichier | De quoi il s'agit |
| --- | --- |
| **.json** | Une fiche enregistrée sous forme de texte. Les exports Marinara (`.marinara.json`) sont aussi des fichiers .json. |
| **.png** | Une image de fiche, avec les données de la fiche dissimulées dans l'image. |
| **.charx** | Un paquet de fiche, enregistré sous forme de fichier zip. |
| **.marinara** | Un fichier d'export Marinara. |

Un export Marinara conserve le plus de détails. Les autres types viennent de SillyTavern, Chub, Risu et d'outils similaires.

Si ça n'a pas marché : lis le message rouge à côté du fichier. Les autres fichiers du lot sont tout de même importés.

<a id="import-options"></a>

### Options d'import

| Option | Choix |
| --- | --- |
| **Imported card tags** (tags des fiches importées) | **All tags** (par défaut) : garde tous les tags. |
| | **No tags** : ignore-les. |
| | **Existing only** : garde les tags déjà présents dans ta bibliothèque. |
| **Imported regex scripts** (scripts regex importés) | **Character only** (par défaut) : les règles s'exécutent pour ce personnage. |
| | **Global** : les règles vont dans **Presets → Regexes** (presets → regex) et peuvent s'exécuter dans plusieurs chats. |
| **Split description into fields** (répartir la description en champs) | Désactivée par défaut. Coche-la pour sortir de **Description** les passages de personnalité, d'apparence et autres annoncés par un intitulé, et placer chacun dans son propre champ. |

Les scripts regex sont de petites règles de remplacement de texte. Garde **Character only**, sauf si tu veux ces règles partout. La répartition ne touche pas aux fiches de narrateur, d'univers ou à plusieurs personnages.

### Fiches avec un lorebook intégré

Un lorebook est un recueil de faits de contexte que l'IA consulte pendant un chat. Si une fiche en contient un, l'import s'interrompt et affiche **Embedded lorebook found**. Chaque fichier y est listé avec son nombre d'entrées. Choisis une option pour tout le lot :

- **Import Lorebook** (importer le lorebook) crée aussi un lorebook Marinara autonome, lié au personnage.
- **No Import** (ne pas importer) garde le lorebook uniquement à l'intérieur de la fiche.

### Importer un dossier SillyTavern complet

Pour déplacer une installation SillyTavern entière, utilise l'importateur par lot de **Settings** (Paramètres), dans l'onglet **Imports**. Il récupère ensemble les personnages, les chats, les presets et les lorebooks. Voir [Importer depuis SillyTavern](../data/importing-from-sillytavern.md).

## Mettre à jour un personnage que tu as déjà

Quand l'auteur d'une fiche publie une nouvelle version, tu peux mettre à jour ta copie sur place au lieu d'en ajouter une deuxième. Le personnage conserve ses chats, ses souvenirs, sa galerie, ses sprites, son dossier, son étoile de favori, ses couleurs et tes propres tags. Sa fiche actuelle est d'abord enregistrée dans **Historique des versions** (même si l'enregistrement automatique des versions est désactivé), pour que tu puisses revenir en arrière.

### Depuis la fenêtre d'import

1. Importe le nouveau fichier de fiche comme d'habitude (étapes ci-dessus).
2. S'il ressemble à un personnage que tu as déjà, l'import s'interrompt sur **Déjà dans ta bibliothèque**. Marinara reconnaît une fiche téléchargée depuis la même page du Card Browser, ou portant le même nom et le même créateur. La raison s'affiche sous chaque choix.
3. Pour chaque fiche, choisis une option :
   - **Mettre à jour "Nom"** : mettre à jour ce personnage sur place (par défaut).
   - **Mettre à jour un autre personnage…** : choisir n'importe quel personnage dans une liste. Utilise cette option pour une fiche arrivée par un autre chemin, par exemple d'un site web à SillyTavern puis à Marinara, et dont le nom ou le créateur ne correspond donc plus.
   - **Ajouter comme nouveau personnage** : garder les deux.
   - **Passer cette fiche** : l'ignorer.
4. Choisis si tu veux **Utiliser l'image de la nouvelle fiche**, et ce qu'il faut faire des **Notes du créateur** (voir ci-dessous).
5. Clique sur **Continuer**. Si la fiche contient un lorebook intégré, l'étape suivante te demande quoi en faire comme d'habitude. Le lorebook lié au personnage mis à jour reçoit les nouvelles entrées, sans être copié une deuxième fois.
6. Le résultat indique `Updated "Name". Its old card is in Version history.`

### Depuis l'éditeur de personnage

1. Ouvre le personnage et enregistre d'abord les modifications éventuelles.
2. Clique sur **⋯** à côté de **Enregistrer** et choisis **Mettre à jour depuis un fichier de fiche…**.
3. Choisis la fiche plus récente (.png, .json ou .charx), vérifie les choix et clique sur **Mettre à jour**.

Pour un personnage téléchargé depuis le [Card Browser](bot-browser.md), le même menu propose **Rechercher une mise à jour**. Il ouvre la page de cette fiche dans le Card Browser, où tu peux comparer et importer la nouvelle version.

### Notes du créateur

Les notes du créateur sont le court texte sous chaque fiche dans **Personnages**, et certaines personnes y conservent du CSS personnalisé. Choisis une option :

| Choix | Ce qui se passe |
| --- | --- |
| **Fusionner : garder mes notes et ajouter les changements de l'auteur** (par défaut) | Ton texte et ton CSS restent. Les lignes ajoutées par l'auteur sont insérées avant ton premier bloc de style, et celles qu'il a retirées sont supprimées si tu ne les avais pas modifiées. Si tu n'as jamais modifié les notes, elles deviennent simplement celles de la nouvelle fiche. |
| **Utiliser les notes de la fiche** | Tes notes sont remplacées par celles de la fiche. |
| **Garder mes notes** | Tes notes restent exactement telles quelles. |

Les fiches importées avant cette fonctionnalité ne conservent pas leurs notes d'origine : la première fusion ajoute donc seulement les lignes que tu n'as pas encore.

### Annuler une mise à jour

Ouvre le personnage, trouve **Historique des versions** dans l'onglet **Métadonnées** et restaure la version d'avant la mise à jour. Voir [Historique des versions](creating-and-editing-characters.md#version-history).

## Exporter un personnage

1. Ouvre le personnage dans l'éditeur.
2. Clique sur **…**, puis sur **Export character** (exporter le personnage) dans l'en-tête. La fenêtre **Export Character** s'ouvre.
3. Choisis un format. Marinara télécharge le fichier.

| Format | Ce que tu obtiens | Idéal pour |
| --- | --- | --- |
| **Marinara Native** | Un fichier `.marinara.json` avec les métadonnées Marinara, les sprites, les images de la galerie et les lorebooks attachés. | Déplacer un personnage d'une installation Marinara à une autre en gardant tous les détails. |
| **Compatible JSON** | Un fichier de fiche simple que les autres applications savent lire. Il abandonne les éléments propres à Marinara, comme les sprites et les images de la galerie. | Les autres applications qui lisent les fiches JSON. |
| **Compatible PNG Card** | Une image de fiche avec les données intégrées à l'image. Elle emporte tes sprites, mais pas les images de la galerie. | Les applications et les sites qui attendent une fiche PNG, comme SillyTavern, Chub et Risu. |

Les deux formats **Compatible** ajoutent les champs **Backstory** (histoire du personnage) et **Appearance** (apparence) non vides à la **Description** standard, pour que les autres applications conservent ces informations. Ta fiche enregistrée ne change pas.

L'[accueil interactif](interactive-onboarding.md) d'une fiche est conservé par **Marinara Native** et **Compatible PNG Card** : la fiche pose donc toujours ses questions quand quelqu'un l'importe dans Marinara. **Compatible JSON** le laisse de côté.

## Exporter plusieurs personnages d'un coup

1. Clique sur **Characters** dans la barre de navigation du haut (ou d'abord sur **More**, s'il n'apparaît pas).
2. Clique sur **Select** (sélectionner) dans la barre d'outils (l'icône de coche) et coche les personnages voulus.
3. Clique sur **Export** (exporter) dans la barre du bas. Marinara télécharge `marinara-characters.zip`.

Le zip contient un fichier **Marinara Native** par personnage. L'export par lot ne propose ni PNG ni JSON. Pour ces formats, passe par l'export d'un seul personnage. Pour d'autres façons de sélectionner des personnages, voir [Organiser ta bibliothèque de personnages](library-organization.md#export-or-delete-many-characters).

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Card Browser : trouver et importer des personnages](bot-browser.md)
- [Importer depuis SillyTavern](../data/importing-from-sillytavern.md)
