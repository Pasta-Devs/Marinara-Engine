# Organiser ta bibliothèque de personnages

Ce guide explique le panneau **Characters** (Personnages), la barre latérale qui rassemble tous tes personnages. Au programme : rechercher, trier, ranger les personnages dans des dossiers, marquer des favoris, filtrer par tag, puis exporter ou supprimer plusieurs personnages d'un coup.

## Le panneau Characters

Le panneau **Characters** est la liste des personnages affichée dans le panneau latéral. Il contient tous les personnages que tu as créés ou importés. Depuis le haut du panneau :

- Clique sur **Download** (télécharger) pour ouvrir le [Card Browser](bot-browser.md) et trouver des personnages sur des sites publics.
- Clique sur **Open Library** (ouvrir la bibliothèque) pour afficher les mêmes personnages dans une grande grille pleine page.
- Clique sur le bouton **New** (l'icône plus) pour ouvrir la fenêtre **Create Character**.
- Clique sur le bouton **Import** (l'icône de téléchargement) pour importer un fichier de personnage.
- Clique sur le bouton **Select** (l'icône de coche) pour activer le mode multi-sélection et agir sur plusieurs personnages à la fois.

La bibliothèque complète reprend la couleur de texte chroma choisie dans **Settings** (Paramètres). Elle conserve aussi la fiche sélectionnée, l'ordre de tri et la position de défilement quand tu ouvres un personnage pour le modifier, puis reviens.

Chaque ligne de personnage affiche l'avatar, le nom, une ligne de titre facultative, le créateur et la version, jusqu'à 3 tags et une estimation approximative du nombre de tokens (les petits morceaux de texte que l'IA compte). Une petite étoile signale un favori. Au survol d'une ligne, un bouton **Duplicate** et un bouton **Delete** apparaissent.

Si tu as beaucoup de personnages, un bouton **Load more** apparaît en bas. Clique dessus pour charger la page suivante de personnages.

## Recherche

Saisis du texte dans le champ de recherche en haut du panneau pour filtrer la liste. Le texte indicatif affiche **Search characters or -tag:"tag name"**.

Le texte simple est comparé au nom, au titre, à la description et aux tags d'un personnage. Par exemple, en tapant `knight`, tu vois tous les personnages dont l'un de ces champs contient "knight".

Autre option : exclure les personnages porteurs d'un tag donné. Place un signe moins devant le tag :

```
-tag:"tag name"
```

Quelques points à connaître sur l'exclusion par tag :

- Mets des guillemets quand le tag contient une espace, comme `-tag:"slow burn"`.
- Pour un tag d'un seul mot, les guillemets sont facultatifs, comme `-vampire`.
- Exclure un tag masque tous les personnages qui le portent, même si le reste du texte recherché leur correspond.

Tu peux combiner texte simple et exclusion dans le même champ. Par exemple, `mage -tag:"villain"` trouve les personnages correspondant à "mage" tout en masquant ceux tagués "villain".

## Tri

À côté du champ de recherche se trouve le menu déroulant de tri. Choisis l'un de ces ordres :

| Option        | Effet                             |
| ------------- | --------------------------------- |
| **Manual order** (ordre manuel) | L'ordre que tu as défini toi-même. |
| **A-Z**       | Noms de A à Z.                    |
| **Z-A**       | Noms de Z à A.                    |
| **Newest**    | Les créations les plus récentes d'abord. |
| **Oldest**    | Les créations les plus anciennes d'abord. |
| **Favorites** | Les favoris d'abord, puis le reste. |

Pour définir un ordre manuel, fais glisser une ligne de personnage vers le haut ou vers le bas. Tu peux aussi appuyer sur Alt+Up ou Alt+Down sur une ligne sélectionnée. Dans les deux cas, le tri passe sur **Manual order**.

## Dossiers

Les dossiers servent à regrouper des personnages liés à l'intérieur du panneau. Ils restent facultatifs : si tu préfères, garde tous tes personnages dans une seule liste à plat.

Pour créer un dossier :

1. Clique sur le bouton **New Folder** (nouveau dossier).
2. Un nouveau dossier apparaît, nommé **unnamed** par défaut.
3. Renomme-le tout de suite ou plus tard (voir ci-dessous).

Pour renommer un dossier, double-clique dessus, double-tape dessus, ou sélectionne-le et appuie sur la touche F2. Saisis le nouveau nom, puis appuie sur Enter.

Pour ranger un personnage dans un dossier, fais glisser la ligne du personnage et dépose-la sur le dossier. Dès que tu as au moins un dossier, une ligne d'aide indique **Drag and drop characters to folders, double-click or double-tap to rename**. Pour ressortir un personnage, survole sa ligne dans le dossier et clique sur le bouton de retrait du dossier, ou fais-le glisser en dehors.

Sur écran tactile, appuie longuement sur une ligne pour la saisir, puis fais-la glisser. Un balayage normal fait toujours défiler la liste. Pendant que tu maintiens une ligne, touche d'autres lignes avec un deuxième doigt pour les emporter en pile, puis dépose la pile sur un dossier.

Clique sur un dossier pour le déplier ou le replier. Le nombre affiché à côté du nom indique combien de personnages s'y trouvent.

Pour supprimer un dossier, survole-le et clique sur son bouton corbeille. S'il contient des personnages, un message de confirmation apparaît : **Delete "name"? Its N characters will stay in the library and move out of the folder.** Un dossier vide est supprimé immédiatement, sans confirmation. Supprimer un dossier ne supprime jamais les personnages qu'il contient : ils retournent simplement dans la liste principale.

## Favoris et pastilles de tag

### Favoris

Marquer un personnage comme favori permet de le retrouver facilement. L'étoile de favori se règle dans le personnage lui-même, pas depuis la liste du panneau. Ouvre un personnage et clique sur son étoile **Favorite** pour l'activer ou la désactiver. Les personnages favoris affichent une petite étoile sur leur avatar dans le panneau.

Sous la zone de recherche se trouvent trois boutons de filtre :

- **All** affiche tous les personnages.
- **Favs** n'affiche que tes favoris.
- **Non-favs** n'affiche que les personnages qui ne sont pas en favoris.

Autre possibilité : choisir **Favorites** dans le menu déroulant de tri pour faire remonter tous les favoris en haut de la liste.

### Tags

Les tags sont des étiquettes que tu ajoutes à un personnage pour le décrire, comme `fantasy` ou `slow burn`. L'ajout et la modification des tags d'un personnage se font dans l'éditeur de personnage.

Dans le panneau, chaque ligne de personnage affiche jusqu'à 3 de ses tags. Clique sur une pastille de tag, sur n'importe quelle ligne, pour ne garder que les personnages qui partagent ce tag.

Dès que tes personnages ont des tags, un bouton **Tags** apparaît dans la ligne de filtres, avec le nombre total de tags entre parenthèses (par exemple, **Tags (12)**). Clique dessus pour déplier la liste complète des tags :

- Clique sur un tag de la liste dépliée pour l'ajouter comme filtre. Si tu cliques sur plusieurs tags, l'affichage retient les personnages qui ont au moins un des tags sélectionnés.
- Chaque tag de la liste dépliée porte une petite croix X. Cliquer dessus supprime ce tag de tous les personnages qui l'ont. Une confirmation t'est demandée : **Remove tag "name" from all characters?**
- Un bouton **Clear** apparaît dès qu'un filtre de tag est actif. Clique dessus pour effacer tes filtres de tag.

Pour exclure un tag au lieu de l'inclure, utilise la syntaxe de recherche `-tag:` décrite plus haut, dans la section Recherche.

## Sélection multiple, export et suppression

Pour agir sur plusieurs personnages d'un coup, passe en mode sélection.

1. Clique sur le bouton **Select** en haut du panneau.
2. Une case à cocher apparaît sur chaque ligne de personnage.
3. Clique sur les personnages à inclure. L'en-tête du panneau indique combien sont sélectionnés.
4. Sers-toi de la barre d'actions en bas du panneau.

La barre d'actions comporte deux boutons :

- **Export** télécharge tous les personnages sélectionnés dans un seul fichier zip nommé `marinara-characters.zip`. C'est un export groupé, au format natif de Marinara Engine.
- **Delete** supprime tous les personnages sélectionnés. Une confirmation t'est demandée au préalable : **Delete N characters?**

En mode sélection, tu peux aussi faire glisser tous les personnages sélectionnés dans un dossier en une seule fois, au lieu de les déplacer un par un.

Pour la liste complète des formats de fichiers d'import et d'export, consulte le guide sur l'import et l'export, plus bas.

## Les dossiers servent aussi de listes pour les chats de groupe

Les dossiers que tu construis ici ont un second usage. Chaque dossier est aussi une liste de participants enregistrée, prête à être insérée dans un chat de groupe.

Quand tu configures un chat avec plusieurs personnages, cherche l'option **Add from Folder** (ajouter depuis un dossier). Elle ajoute en une étape tous les personnages d'un dossier choisi. C'est la façon la plus rapide de lancer un chat de groupe avec un ensemble de personnages que tu utilises souvent ensemble. Pour comprendre le fonctionnement des chats de groupe, consulte le guide correspondant, plus bas.

## Guides associés

- [Importer et exporter des fiches de personnage](import-export.md)
- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Chats de groupe et conversations de groupe](../chats/group-chats.md)
