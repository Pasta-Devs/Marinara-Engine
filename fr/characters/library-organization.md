# Organiser ta bibliothèque de personnages

Le panneau **Characters** (personnages) est la liste, dans la barre latérale, de tous les personnages que tu as créés ou importés. Sers-t'en pour rechercher, trier, regrouper des personnages dans des dossiers, marquer des favoris, filtrer par tags, et exporter ou supprimer plusieurs personnages d'un coup.

## Le panneau Characters

Depuis le haut du panneau, tu peux :

- Cliquer sur **Download** (télécharger) pour ouvrir le [Card Browser](bot-browser.md) et trouver des personnages sur des sites publics.
- Cliquer sur **Open Library** (ouvrir la bibliothèque) pour ouvrir une grille plus grande, en pleine page, des mêmes personnages.
- Cliquer sur **New** (nouveau), l'icône plus, pour ouvrir la fenêtre **Create Character** (créer un personnage).
- Cliquer sur **Import** (importer), l'icône de téléchargement, pour importer un fichier de personnage. Voir [Importer et exporter des fiches de personnage](import-export.md).
- Cliquer sur **Select** (sélectionner), l'icône de coche, pour activer le mode sélection et agir en bloc.

La bibliothèque complète conserve la fiche sélectionnée, l'ordre de tri et la position de défilement quand tu ouvres un personnage pour le modifier, puis que tu reviens.

Chaque ligne affiche l'avatar, le nom, une ligne de titre facultative, le créateur et la version, jusqu'à 3 tags et une estimation approximative du nombre de tokens (un token est un petit morceau de texte). Une petite étoile signale un favori. Passe le pointeur sur une ligne pour voir **Duplicate** (dupliquer) et **Delete** (supprimer). Si tu as beaucoup de personnages, clique sur **Load more** (charger plus) en bas pour charger la page suivante.

<a id="search"></a>

## Recherche

Saisis du texte dans le champ de recherche en haut. Le texte indicatif affiche **Search characters/tags** (rechercher des personnages/tags). Le texte simple est comparé au nom, au titre, à la description et aux tags d'un personnage, sans tenir compte de la casse. Taper `knight` affiche tous les personnages dont l'un de ces champs contient "knight".

| Recherche | Ce qu'elle trouve |
| --- | --- |
| `male genshin` ou `male,genshin` | Les fiches qui portent ces deux tags exacts. |
| `male "Modern AU"` | Mets entre guillemets un tag qui contient des espaces ou des virgules. |
| `-tag:"slow burn"` | Masque toutes les fiches qui portent ce tag, même si le reste de ta recherche leur correspond. |
| `-vampire` | La même chose, pour un tag d'un seul mot. Tu peux omettre les guillemets. |
| `mage -tag:"villain"` | Les fiches correspondant à "mage", sans celles taguées "villain". |

Les recherches de phrases habituelles fonctionnent toujours. La même recherche fonctionne dans la Character Library en pleine page et pour les personas.

## Tri

Choisis un ordre dans le menu déroulant de tri, à côté du champ de recherche.

| Option | Ce qu'elle fait |
| --- | --- |
| **Manual order** (ordre manuel) | L'ordre que tu as défini toi-même. |
| **A-Z** | Les noms de A à Z. |
| **Z-A** | Les noms de Z à A. |
| **Newest** (plus récents) | Les créations les plus récentes d'abord. |
| **Oldest** (plus anciens) | Les créations les plus anciennes d'abord. |
| **Favorites** (favoris) | Les favoris d'abord, puis le reste. |

Pour définir un ordre manuel, fais glisser une ligne vers le haut ou vers le bas, ou appuie sur <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd> sur une ligne qui a le focus. Dans les deux cas, le tri passe sur **Manual order**.

## Dossiers

Les dossiers regroupent des personnages liés, par exemple par histoire ou par série, pour qu'une longue liste soit plus facile à parcourir. Ils sont facultatifs.

1. Clique sur **New Folder** (nouveau dossier). Un dossier nommé **unnamed** apparaît.
2. Renomme-le : double-clique ou double-tape dessus, ou sélectionne-le et appuie sur <kbd>F2</kbd>. Saisis le nouveau nom et appuie sur <kbd>Enter</kbd>.
3. Fais glisser une ligne de personnage sur le dossier pour l'y ranger. Dès que tu as un dossier, une ligne d'aide indique **Drag and drop characters to folders, double-click or double-tap to rename**.

Pour ressortir un personnage, passe le pointeur sur sa ligne dans le dossier et clique sur le bouton de retrait du dossier, ou fais-le glisser en dehors. Clique sur un dossier pour le déplier ou le replier. Le nombre à côté de son nom indique combien de personnages il contient.

Sur écran tactile, appuie longuement sur une ligne pour la saisir, puis fais-la glisser. Un balayage normal fait toujours défiler la liste.

Pour en déplacer plusieurs à la fois, maintiens une ligne et touche d'autres lignes avec un deuxième doigt pour les emporter en pile. Dépose ensuite la pile sur un dossier.

Pour supprimer un dossier, passe le pointeur dessus et clique sur son bouton corbeille. Un dossier qui contient des personnages te demande de confirmer : **Delete "name"? Its N characters will stay in the library and move out of the folder.** Un dossier vide est supprimé immédiatement. Supprimer un dossier ne supprime jamais les personnages qu'il contient.

### Utiliser un dossier comme liste de participants d'un chat de groupe

Chaque dossier est aussi une liste de participants enregistrée pour les chats de groupe. Quand tu configures un chat avec plusieurs personnages, **Add from Folder** (ajouter depuis un dossier) ajoute en une étape tous les personnages d'un dossier. Voir [Chats de groupe et conversations de groupe](../chats/group-chats.md).

## Favoris et tags

### Favoris

Ouvre un personnage et clique sur son étoile **Favorite** (favori) pour l'activer ou la désactiver. Tu ne peux pas la régler depuis la liste du panneau. Les favoris affichent une petite étoile. Sous le champ de recherche, trois boutons filtrent la liste :

- **All** (tous) affiche tous les personnages.
- **Favs** (favoris) n'affiche que les favoris.
- **Non-favs** (non favoris) n'affiche que les personnages qui ne sont pas en favoris.

Tu peux aussi choisir **Favorites** dans le menu déroulant de tri pour placer les favoris en haut.

### Tags

Les tags sont des étiquettes comme `fantasy` ou `slow burn`. Tu les ajoutes dans l'éditeur de personnage. Voir [Créer et modifier des personnages](creating-and-editing-characters.md#metadata-tab). Dans le panneau, clique sur une pastille de tag, sur n'importe quelle ligne, pour ne garder que les personnages qui partagent ce tag.

Dès que tes personnages ont des tags, un bouton **Tags** apparaît avec un nombre, par exemple **Tags (12)**. Clique dessus pour déplier la liste complète :

- Clique sur un tag pour l'ajouter comme filtre. Avec plusieurs tags sélectionnés, un personnage correspond s'il porte au moins l'un d'eux.
- Clique sur le X d'un tag pour supprimer ce tag de tous les personnages qui le portent. Une confirmation t'est demandée : **Remove tag "name" from all characters?**
- **Clear** (effacer) apparaît dès qu'un filtre de tag est actif. Clique dessus pour effacer les filtres de tag.

Pour exclure un tag à la place, utilise `-tag:` dans le champ de recherche, comme le montre [Recherche](#search).

<a id="export-or-delete-many-characters"></a>

## Exporter ou supprimer plusieurs personnages

1. Clique sur **Select** en haut du panneau. Une case à cocher apparaît sur chaque ligne.
2. Clique sur les personnages voulus. L'en-tête du panneau indique combien sont sélectionnés.
3. Sers-toi de la barre d'actions en bas.

La barre d'actions comporte deux boutons :

- **Export** (exporter) télécharge les personnages sélectionnés dans un seul zip nommé `marinara-characters.zip`, au format natif de Marinara.
- **Delete** supprime les personnages sélectionnés. Une confirmation t'est d'abord demandée : **Delete N characters?**

En mode sélection, tu peux aussi faire glisser ensemble les personnages sélectionnés dans un dossier. Pour les formats de fichiers, voir [Importer et exporter des fiches de personnage](import-export.md).

## Guides associés

- [Importer et exporter des fiches de personnage](import-export.md)
- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Chats de groupe et conversations de groupe](../chats/group-chats.md)
