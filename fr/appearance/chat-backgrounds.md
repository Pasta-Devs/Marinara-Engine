# Arrière-plans de chat

Ce guide explique la bibliothèque d'arrière-plans de Marinara Engine. Il s'agit des images que tu importes et que tu choisis à la main pour les afficher derrière le chat. Pour l'agent **Background** (arrière-plan), celui qui choisit un arrière-plan de scène à ta place à chaque tour, voir [Arrière-plans en Roleplay](../roleplay/backgrounds.md). Pour les arrière-plans de scène générés par IA depuis la galerie, voir [Arrière-plans de scène et galerie](../media/scene-backgrounds.md).

## Où trouver les arrière-plans

Tout se gère au même endroit : la section **Backgrounds** (arrière-plans), dans l'onglet **Appearance** (apparence) du panneau **Settings** (Paramètres).

La section **Backgrounds** compte trois parties :

1. Le sélecteur **Chat Background** (arrière-plan du chat), pour choisir l'image du chat ouvert.
2. Le curseur **Background Blur** (flou d'arrière-plan).
3. La bibliothèque d'arrière-plans, où tu importes, organises, filtres, tagues, renommes, télécharges et supprimes les images.

Un arrière-plan de chat ne s'affiche que dans les chats en mode Roleplay et Game Mode. Le mode Conversation utilise plutôt un dégradé, que tu règles dans la section **Conversation Theme** (thème de la Conversation). Voir [Paramètres d'apparence](appearance-settings.md) pour cela.

## La bibliothèque d'arrière-plans

La bibliothèque rassemble toutes les images disponibles. Elle mélange tes propres images et les visuels intégrés livrés avec Marinara. Chaque image porte une petite étiquette qui permet de les distinguer :

- **Library** : une image que tu as importée toi-même. Ces images se renomment, se taguent et se suppriment.
- **Game asset** : une image intégrée, livrée avec Marinara. Elle est en lecture seule : ni renommage, ni tag, ni suppression.

### Importer un arrière-plan

1. Repère la zone **Import Backgrounds** (importer des arrière-plans) en haut de la bibliothèque.
2. Fais glisser un ou plusieurs fichiers image sur cette zone, ou clique dessus pour choisir des fichiers.
3. Attends la fin du téléversement. La zone affiche **Importing...** pendant l'opération.
4. Les nouvelles images apparaissent dans la grille en dessous, avec l'étiquette **Library**.

Plusieurs fichiers peuvent être importés d'un coup. Chaque fichier doit être une image dans l'un de ces formats : JPG, PNG, GIF, WebP ou AVIF. Chaque fichier peut peser jusqu'à 20 Mo.

Marinara vérifie le contenu réel de chaque fichier, pas seulement son nom. Si tu renommes un fichier qui n'est pas une image pour qu'il finisse par `.png`, le téléversement est refusé.

### Choisir un arrière-plan pour le chat en cours

1. Ouvre **Settings**, puis **Appearance**, puis **Backgrounds**.
2. Dans la grille, clique sur la miniature voulue.
3. Une coche apparaît sur l'image sélectionnée. Elle devient l'arrière-plan du chat ouvert.
4. Pour revenir à la valeur par défaut, clique de nouveau sur la miniature sélectionnée, ou clique sur le bouton **Remove** (retirer) à côté de **Chat Background**.

### Chercher dans la bibliothèque

Utilise le champ **Search backgrounds** (chercher des arrière-plans) au-dessus de la bibliothèque pour filtrer par nom, par tag ou par source. Le compteur indique combien d'images correspondent, par exemple "3 of 20 backgrounds". Clique sur la petite croix dans le champ de recherche pour l'effacer.

Utilise le sélecteur à côté de la recherche pour trier les arrière-plans par **A-Z**, **Z-A**, **Newest** ou **Oldest**. Choisis **All** pour effacer les filtres de tags, ou déplie **Tags** et sélectionne un ou plusieurs tags. Quand plusieurs tags sont sélectionnés, un arrière-plan correspond dès qu'il porte l'un d'eux.

### Ranger les arrière-plans dans des dossiers

Les dossiers organisent la bibliothèque sans déplacer ni masquer les fichiers image sous-jacents.

1. Clique sur **New Folder** (nouveau dossier). Marinara crée un dossier au nom unique.
2. Double-clique ou touche deux fois le nom du dossier pour le renommer. Tu peux aussi le sélectionner et appuyer sur F2.
3. Sur ordinateur, fais glisser une ligne d'arrière-plan dans un dossier. Sur téléphone ou tablette, appuie longuement sur la ligne, puis fais-la glisser.
4. Ramène un arrière-plan dans la zone hors dossier pour le sortir de son dossier.

Les dossiers et leurs affectations sont enregistrés sur le serveur et inclus dans les sauvegardes. Supprimer un dossier renvoie ses arrière-plans dans la liste hors dossier ; les images, elles, restent en place. Les filtres de recherche et de tags font apparaître automatiquement les éléments correspondants à l'intérieur de leurs dossiers.

L'agent **Background** continue de voir tous les arrière-plans disponibles, y compris ceux rangés dans des dossiers. Les dossiers ne changent que l'organisation dans **Settings**.

### Renommer un arrière-plan

Seules les images portant l'étiquette **Library** peuvent être renommées.

1. Survole la ligne de l'image et clique sur l'icône en forme de crayon (**Rename**, renommer).
2. Saisis le nouveau nom. Inutile de taper l'extension du fichier.
3. Clique sur **Save** (enregistrer).

### Taguer un arrière-plan

Les tags aident à regrouper et à retrouver tes imports. Seules les images portant l'étiquette **Library** peuvent être taguées.

1. Clique sur l'icône de tag (**Edit tags**, modifier les tags) sur la ligne de l'image.
2. Saisis un tag dans le champ **Add tag...**. Au fil de la frappe, Marinara propose les tags déjà utilisés.
3. Appuie sur Enter ou clique sur **Add** (ajouter).
4. Pour retirer un tag, clique dessus. Pendant la modification des tags, chaque tag s'affiche sous forme de bouton avec une croix.

<a id="download-a-background"></a>

### Télécharger un arrière-plan

Tu peux télécharger n'importe quel arrière-plan, y compris les arrière-plans intégrés. Survole la ligne de l'image et clique sur l'icône de téléchargement (**Download background**, télécharger l'arrière-plan). L'image est enregistrée sous son nom de fichier. Sur iPhone ou iPad, la feuille de partage s'ouvre pour que tu puisses l'enregistrer ; si elle ne s'ouvre pas, touche **Save file** (enregistrer le fichier) dans le message qui s'affiche.

### Supprimer un arrière-plan

Seules les images portant l'étiquette **Library** peuvent être supprimées. Survole la ligne de l'image, clique sur l'icône de corbeille, puis confirme la suppression. Si l'image servait d'arrière-plan au chat en cours ou d'arrière-plan Roleplay par défaut, Marinara rebascule pour toi sur l'arrière-plan intégré par défaut.

## Définir un arrière-plan Roleplay par défaut

L'arrière-plan Roleplay par défaut est l'image avec laquelle démarre chaque nouveau chat Roleplay, avant qu'il ne choisisse la sienne. Une fois défini, tous les nouveaux chats Roleplay l'utilisent.

1. Dans la section **Backgrounds**, repère l'image voulue dans la grille.
2. Clique sur l'icône d'épingle (**Set as default for new Roleplay chats**, définir par défaut pour les nouveaux chats Roleplay) sur la ligne de cette image.
3. Le bouton d'épingle reste mis en évidence, et une étiquette **Default** (par défaut) apparaît sur la miniature. Les nouveaux chats Roleplay démarrent désormais avec cette image.

L'étoile dans le coin supérieur gauche de l'image l'ajoute à tes favoris. Elle ne change pas l'arrière-plan par défaut.

Pour revenir en arrière, clique sur l'épingle de l'image par défaut actuelle. Autre option : le bouton **Reset Roleplay default** (réinitialiser l'arrière-plan Roleplay par défaut), en haut de la grille. Ce bouton n'apparaît que si ton arrière-plan par défaut diffère de celui d'origine intégré.

## Background Blur

Le réglage **Background Blur** adoucit l'image d'arrière-plan derrière le chat pour rendre le texte plus lisible. Il s'applique aux arrière-plans des modes Roleplay et Game Mode.

1. Dans la section **Backgrounds**, repère le curseur **Background Blur**.
2. Fais-le glisser de 0 à 24. Plus la valeur est élevée, plus le flou est marqué.
3. Mets-le sur 0 pour garder des arrière-plans nets. À 0, la valeur affichée est **Off**.

La valeur par défaut est 0 (**Off**).

## Comment tes imports et les arrière-plans intégrés se mélangent

La bibliothèque affiche tes imports et les images **Game asset** intégrées dans une seule et même grille. Le choix se fait de la même façon dans les deux cas. Seule différence : les images **Game asset** sont en lecture seule, donc les commandes de renommage, de tag et de suppression n'apparaissent pas dessus.

Les arrière-plans de scène générés par IA depuis la galerie atterrissent eux aussi dans cette bibliothèque, ce qui permet de les réutiliser plus tard. Voir [Arrière-plans de scène et galerie](../media/scene-backgrounds.md).

## Où tes choix d'arrière-plan sont enregistrés

Trois réglages distincts déterminent l'arrière-plan affiché par un chat, et ils ne s'enregistrent pas de la même façon :

- L'arrière-plan **Chat Background** choisi pour un chat est enregistré avec ce chat, sur le serveur. Il suit le chat sur tous les appareils où tu l'ouvres.
- Les dossiers d'arrière-plans et leurs affectations sont enregistrés sur le serveur et suivent la bibliothèque sur les autres appareils.
- L'arrière-plan Roleplay par défaut et le réglage **Background Blur** sont enregistrés par appareil. Ils ne se synchronisent pas entre navigateurs ni entre appareils. Pour le détail du modèle de synchronisation, voir [Paramètres d'apparence](appearance-settings.md).

## Arrière-plans automatiques et générés par IA

Ce guide explique la bibliothèque dans laquelle tu choisis à la main. Deux fonctionnalités voisines s'occupent des arrière-plans à ta place :

- L'agent **Background** peut choisir seul un arrière-plan de scène dans ta bibliothèque, tour après tour, dans les chats Roleplay. Voir [Arrière-plans en Roleplay](../roleplay/backgrounds.md).
- La galerie peut générer par IA un arrière-plan de scène tout neuf à partir de la scène en cours. Voir [Arrière-plans de scène et galerie](../media/scene-backgrounds.md).

## Guides associés

- [Arrière-plans en Roleplay](../roleplay/backgrounds.md) : l'agent Background, qui choisit tout seul un arrière-plan à chaque tour.
- [Arrière-plans de scène et galerie](../media/scene-backgrounds.md) : les arrière-plans de scène générés par IA depuis la galerie.
- [Paramètres d'apparence](appearance-settings.md) : tout l'onglet Appearance, avec les réglages qui se synchronisent et ceux qui restent sur un seul appareil.
