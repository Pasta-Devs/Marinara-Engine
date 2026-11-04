# Arrière-plans de chat

La bibliothèque d'arrière-plans rassemble les images que tu téléverses et que tu choisis à la main pour les afficher derrière le chat. Pour l'agent **Background** (arrière-plan), qui choisit un décor à ta place à chaque tour, voir [Les arrière-plans en Roleplay](../roleplay/backgrounds.md). Pour les arrière-plans générés par IA depuis la galerie, voir [Les arrière-plans de scène et la galerie](../media/scene-backgrounds.md).

Un arrière-plan de chat s'affiche dans tous les modes de chat. Dans les chats Conversation, le dégradé de **Conversation Theme** (thème de Conversation) reste par-dessus l'image, et **Conversation background image opacity** (opacité de l'image d'arrière-plan en Conversation) règle la visibilité de l'image. Voir [Réglages d'apparence](appearance-settings.md).

## Changer l'arrière-plan d'un chat

Avant de commencer : ouvre le chat que tu veux modifier. L'arrière-plan que tu choisis s'applique à ce chat.

1. Ouvre **Settings** (Paramètres), puis **Appearance** (apparence), puis le bouton **App**.
2. Dans **Backgrounds** (arrière-plans), touche **Browse library** (parcourir la bibliothèque).
3. Touche une image. Elle devient l'arrière-plan de ce chat, et la fenêtre se ferme.

Pour utiliser ta propre image, importe-la d'abord (voir [Importer un arrière-plan](#import-a-background)).

## Où trouver les arrière-plans

1. Ouvre **Settings**.
2. Choisis l'onglet **Appearance**, puis le bouton **App**.
3. Repère la section **Backgrounds**.

Elle contient le sélecteur **Chat Background** (arrière-plan du chat), le curseur **Background Blur** (flou d'arrière-plan), ainsi que les contrôles **Conversation background image opacity** et **Chat List Backgrounds** (arrière-plans de la liste des chats). Voir [Réglages d'apparence](appearance-settings.md).

Le sélecteur affiche un aperçu de l'arrière-plan actuel, ou **Default background** quand aucun n'est choisi. En dessous, jusqu'à trois arrière-plans **Recent** (récents) sont accessibles d'une seule touche. Clique sur **Browse library** pour ouvrir la fenêtre **Background Library** (bibliothèque d'arrière-plans).

## La bibliothèque d'arrière-plans

La bibliothèque mélange les images que tu as téléversées et les visuels livrés avec Marinara. Chaque image porte une étiquette.

| Étiquette | Signification |
| --- | --- |
| **My upload** | Une image que tu as téléversée. Tu peux la renommer, la taguer et la supprimer. |
| **Game asset** | Un visuel intégré. Il est en lecture seule : ni renommage, ni tags, ni suppression. |

Les boutons **Filter by source** (filtrer par source), **All sources**, **My uploads** et **Game assets**, indiquent combien d'images chacun contient.

<a id="import-a-background"></a>

### Importer un arrière-plan

1. Dans la fenêtre **Background Library**, repère **Import Backgrounds** (importer des arrière-plans) à côté du champ de recherche.
2. Touche-le ou clique dessus, puis choisis des fichiers image. Tu peux en choisir plusieurs d'un coup. Sur ordinateur, tu peux aussi y déposer des fichiers.
3. Attends. **Importing…** s'affiche pendant l'opération.

Les nouvelles images apparaissent dans la grille avec l'étiquette **My upload**.

Chaque fichier doit être au format JPG, PNG, GIF, WebP ou AVIF et peser au plus 20 Mo. Marinara vérifie le contenu du fichier, pas son nom. Un fichier qui n'est pas une image, renommé en `.png`, est refusé.

### Choisir un arrière-plan pour le chat en cours

1. Ouvre **Browse library**.
2. Clique sur une miniature. Une coche apparaît, l'image devient l'arrière-plan de ce chat, et la fenêtre se ferme.
3. Pour revenir à l'arrière-plan par défaut, clique de nouveau sur la miniature sélectionnée, ou clique sur la croix (**Clear selection**, effacer la sélection) sur l'aperçu.

### Chercher et filtrer

- **Search backgrounds** (chercher des arrière-plans) filtre par nom, par tag ou par source. Une ligne de comptage indique combien d'images correspondent, par exemple "3 of 20 backgrounds". Clique sur la croix dans le champ pour l'effacer.
- **Sort backgrounds** (trier les arrière-plans) propose **Manual order** (ordre manuel), **A-Z**, **Z-A**, **Newest** et **Oldest**. Avec **Manual order**, fais glisser les images pour les réordonner, ou appuie sur <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd> sur une image qui a le focus.
- Les pastilles de dossier **All folders** (tous les dossiers), **Favorites** (favoris) et **Unfiled** (sans dossier), plus une pastille par dossier, filtrent par dossier.
- Côté tags, **All** efface les filtres de tags. Déplie **Tags** et choisis un ou plusieurs tags. Une image correspond dès qu'elle porte l'un des tags choisis.

Clique sur l'étoile d'une image pour l'ajouter à tes favoris. Cela ne change pas l'arrière-plan par défaut.

### Ranger les arrière-plans dans des dossiers

Les dossiers organisent la bibliothèque sans déplacer ni masquer les fichiers image.

1. Clique sur **New Folder** (nouveau dossier), saisis un nom et clique sur **Add** (ajouter).
2. Touche le bouton **Move to folder** (déplacer vers un dossier) d'une image et choisis le dossier. Tu peux aussi faire glisser l'image sur une pastille de dossier. Sur téléphone ou tablette, appuie longuement sur l'image, puis fais-la glisser.
3. Pour sortir une image de son dossier, fais-la glisser sur **Unfiled**.
4. Sélectionne une pastille de dossier pour afficher les boutons crayon (**Rename folder**, renommer le dossier) et corbeille (**Delete folder**, supprimer le dossier).

Supprimer un dossier renvoie ses images dans **Unfiled**, sans les supprimer. Les dossiers sont enregistrés sur le serveur et inclus dans les sauvegardes. L'agent **Background** voit toujours tous les arrière-plans, y compris ceux rangés dans des dossiers.

### Renommer un arrière-plan

Seules les images **My upload** peuvent être renommées.

1. Clique sur le crayon (**Rename background**, renommer l'arrière-plan) sur l'image.
2. Saisis le nouveau nom. Inutile de taper l'extension du fichier.
3. Clique sur **Save** (enregistrer).

### Taguer un arrière-plan

Seules les images **My upload** peuvent être taguées.

1. Clique sur l'icône de tag (**Edit tags**, modifier les tags) sur l'image.
2. Saisis un tag dans **Add tag…**. Marinara propose les tags que tu as déjà utilisés.
3. Appuie sur <kbd>Enter</kbd> ou clique sur **Add**.

Pour retirer un tag, clique dessus pendant la modification des tags.

<a id="download-a-background"></a>

### Télécharger un arrière-plan

Clique sur l'icône de téléchargement (**Download background**, télécharger l'arrière-plan) sur n'importe quelle image, y compris les images intégrées. Sur iPhone ou iPad, la feuille de partage s'ouvre. Si elle ne s'ouvre pas, touche **Save file** (enregistrer le fichier) dans le message qui s'affiche.

### Supprimer un arrière-plan

Seules les images **My upload** peuvent être supprimées.

1. Clique sur l'icône de corbeille (**Delete background**, supprimer l'arrière-plan) sur l'image.
2. Confirme.

Si c'était l'arrière-plan du chat en cours ou l'arrière-plan Roleplay par défaut, Marinara revient à l'arrière-plan intégré par défaut.

## Définir un arrière-plan Roleplay par défaut

L'arrière-plan Roleplay par défaut est l'image avec laquelle démarre chaque nouveau chat Roleplay.

1. Dans la fenêtre **Background Library**, repère l'image.
2. Clique sur son icône d'épingle (**Set as default for new Roleplay chats**, définir par défaut pour les nouveaux chats Roleplay).

La miniature affiche l'étiquette **Default** (par défaut). Pour annuler, clique de nouveau sur l'épingle de cette image, ou clique sur **Reset Roleplay default** (réinitialiser l'arrière-plan Roleplay par défaut) au-dessus de la grille. Ce bouton n'apparaît que si ton arrière-plan par défaut diffère de celui intégré.

## Background Blur

Le réglage **Background Blur** adoucit l'arrière-plan derrière le chat pour rendre le texte plus lisible. Il s'applique aux arrière-plans de tous les modes de chat.

1. Dans la section **Backgrounds**, repère le curseur **Background Blur**.
2. Fais-le glisser entre 0 et 24. Plus la valeur est élevée, plus le flou est marqué.

À 0, il affiche **Off**, et les arrière-plans restent nets. La valeur par défaut est 0.

## Où tes choix d'arrière-plan sont enregistrés

| Réglage | Enregistrement |
| --- | --- |
| L'arrière-plan **Chat Background** d'un chat | Avec ce chat, sur le serveur. Il suit le chat sur tous les appareils. |
| Les dossiers et leurs affectations | Sur le serveur, avec la bibliothèque. |
| L'arrière-plan Roleplay par défaut et **Background Blur** | Par appareil. Ils ne se synchronisent pas entre navigateurs ni entre appareils. |

Pour le détail du modèle de synchronisation, voir [Réglages d'apparence](appearance-settings.md).

## Guides associés

- [Les arrière-plans en Roleplay](../roleplay/backgrounds.md) : l'agent Background, qui choisit un décor à chaque tour.
- [Les arrière-plans de scène et la galerie](../media/scene-backgrounds.md) : les arrière-plans de scène générés par IA depuis la galerie. Ils arrivent aussi dans cette bibliothèque.
- [Réglages d'apparence](appearance-settings.md) : tout l'onglet Appearance.
