# Sprites de personnage (expressions et corps entier)

Ce guide explique comment ajouter des illustrations de personnage appelées sprites et comment les faire générer par l'IA. Il montre aussi comment nettoyer l'arrière-plan et régler l'affichage des sprites à l'écran. Les sprites fonctionnent en mode Roleplay et en Game Mode.

## Ce qu'est un sprite

Un sprite est une illustration de personnage debout : une image que Marinara Engine fait flotter au-dessus de la scène du chat. Marinara utilise deux types de sprite :

- **Facial Expressions** (expressions du visage) : des portraits pour différentes humeurs, comme joyeux, triste ou en colère.
- **Full-body** (corps entier) : des images en pied pour différentes poses, comme au repos, en marche ou en position de combat.

Les sprites ne s'affichent qu'en mode **Roleplay** et en **Game Mode**. Les chats en mode Conversation, eux, n'affichent aucun sprite. Rien ne t'empêche d'en téléverser depuis n'importe quel mode : un personnage conserve ses sprites, quel que soit le chat qui l'utilise.

Les sprites s'ajoutent personnage par personnage. Autre option : en ajouter à un persona, le personnage que tu incarnes. L'éditeur de persona propose le même onglet **Sprites** que celui décrit plus bas.

## Où trouver l'onglet Sprites

Les sprites se gèrent depuis l'éditeur de personnage (ou de persona).

1. Ouvre un personnage pour le modifier.
2. Clique sur l'onglet **Sprites** dans l'éditeur.
3. En haut de l'onglet, choisis une catégorie : **Facial Expressions**, **Full-body** ou **Clips**.

Ce guide traite des catégories **Facial Expressions** et **Full-body**. La catégorie **Clips** relève d'une autre fonctionnalité, dédiée aux appels audio et vidéo. Pour les clips, consulte [Appels audio et vidéo en mode Conversation](../conversation/calls.md).

## Téléverser tes propres sprites

Tu peux téléverser les illustrations que tu as déjà. Marinara accepte les formats d'image courants. Les fichiers PNG transparents donnent le meilleur résultat : la zone vide autour du personnage laisse voir la scène.

### Téléverser un sprite

1. Ouvre l'onglet **Sprites** et choisis **Facial Expressions** ou **Full-body**.
2. Dans l'encadré **Add Sprite** (ajouter un sprite), saisis un nom dans le champ de texte. Pour les expressions, le texte indicatif affiche "Expression name (e.g. happy, sad, angry)". Pour les poses, il affiche "Pose name (e.g. idle, walk, battle_stance)".
3. Clique sur **Upload** (téléverser) et choisis un fichier image.

Le nouveau sprite apparaît dans la grille en dessous, sous le nom que tu lui as donné.

### Ajouter rapidement les expressions courantes

Dans la catégorie **Facial Expressions**, une ligne **Quick add** (ajout rapide) propose des noms d'expression que tu n'utilises pas encore, par exemple happy ou angry. Clique sur l'un d'eux pour ouvrir le sélecteur de fichiers avec ce nom déjà rempli. Tu évites ainsi de saisir le nom toi-même.

### Téléverser un dossier entier d'un coup

Si tes sprites sont déjà rassemblés dans un dossier, importe-les tous en une seule opération.

1. Nomme chaque fichier image d'après l'expression ou la pose. Par exemple, un fichier nommé `admiration.png` crée une expression appelée admiration.
2. Dans l'encadré **Add Sprite**, clique sur **Upload Folder** (téléverser un dossier).
3. Choisis le dossier qui contient les images.

Chaque nom de fichier, extension mise à part, devient le nom du sprite. Pendant l'opération, une ligne de progression indique "Uploading X/Y sprites".

Pour créer plusieurs versions d'une même expression, donne-leur un nom commun avant un tiret bas. Par exemple, `happy_01.png` et `happy_blush.png` comptent tous deux comme des variantes de happy.

### Gérer un sprite

Passe la souris sur une carte de sprite dans la grille pour faire apparaître ses actions :

- **Frame** (recadrer) : recadre l'image pour placer le personnage où tu le souhaites.
- **Download** (télécharger) : enregistre le fichier du sprite sur ton ordinateur.
- **Replace** (remplacer) : téléverse une nouvelle image sous le même nom.
- **Delete** (supprimer) : supprime ce sprite.

La suppression demande une confirmation avec le message "Delete sprite for" suivi du nom. Quand plusieurs sprites sont affichés, la même fenêtre propose aussi **Delete All Expressions** ou **Delete All Full-Body**.

## Générer des sprites avec l'IA

Si une connexion d'images est configurée, Marinara peut dessiner les sprites à ta place. Une connexion, c'est le lien entre Marinara et un service d'IA. La génération de sprites demande une connexion d'images, et les sprites animés une connexion vidéo. Consulte [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md) pour en configurer une.

Pour commencer, clique sur **Generate Sprite** (générer un sprite) dans l'encadré **Add Sprite**. La fenêtre **Generate Sprites** s'ouvre. En haut, choisis une source : **Expressions (Portrait)** ou **Full-body**.

Remplis la fenêtre :

1. Choisis une connexion dans le menu déroulant **Image Generation Connection** (connexion de génération d'images).
2. Ajoute jusqu'à quatre **Reference Images** (images de référence) si tu veux que l'illustration respecte un style précis. Autre possibilité : coche la case pour utiliser l'avatar actuel comme référence.
3. Rédige une **Appearance Description** (description de l'apparence) du personnage. Ce champ est obligatoire.
4. Si tu le souhaites, active l'option **Transparent sprite background** (arrière-plan de sprite transparent). Marinara demande d'abord une transparence PNG native. Si le fournisseur ne renvoie pas de couche alpha, Marinara retient un fond vert, magenta ou cyan saturé, celui qui recoupe le moins les couleurs de la **Appearance Description**, puis le retire automatiquement.
5. Indique le nombre d'images à produire avec **Expression Count** (nombre d'expressions), ou **Pose Count** (nombre de poses) pour le corps entier, puis choisis les expressions ou les poses à remplir.
6. Clique sur le bouton **Generate** (générer).

À l'arrivée des images, tu les passes en revue. Tu peux activer ou désactiver chacune d'elles, la renommer et la recadrer avant d'enregistrer. Quand le résultat te convient, enregistre les images retenues dans le jeu de sprites du personnage.

Dans la source **Full-body**, si le personnage possède déjà des expressions en portrait, tu peux cocher **Match existing expression sprites**. Marinara crée alors des poses en pied qui correspondent à chaque nom d'expression déjà présent.

Deux remarques sur la génération par IA :

- La génération peut prendre plusieurs minutes, même si le texte affiché dans l'application laisse entendre le contraire. Les services d'IA lents mettent plus de temps. Patiente plutôt que de tout recommencer.
- Sur certains appareils, notamment certaines installations Android, la génération de sprites par IA et le nettoyage d'arrière-plan ne sont pas disponibles. Dans ce cas, le bouton est désactivé et Marinara affiche la raison à l'écran.

### Sprites de portrait animés

Dans la source **Expressions (Portrait)** se trouve une case à cocher **Generate animated portraits** (générer des portraits animés). Une fois activée, Marinara produit de courts clips animés au lieu d'images fixes, puis transforme chaque clip en sprite GIF qui tourne en boucle. Un GIF est un fichier image qui joue une courte animation. Les portraits animés passent par une connexion vidéo, et non par une connexion d'images.

## Nettoyer l'arrière-plan des sprites

Un sprite rend mieux quand seul le personnage apparaît et que l'arrière-plan laisse voir la scène. Les sprites fixes générés utilisent la transparence native quand le fournisseur la prend en charge. Sinon, Marinara retire un fond chroma uni adaptatif avec un bord adouci, et en efface la couleur dans les cheveux, les tissus et les autres pixels partiellement transparents. Les anciens sprites sur arrière-plan blanc restent pris en charge.

### Nettoyer un sprite à la main

Clique sur l'image d'un sprite dans la grille pour ouvrir un éditeur de nettoyage. Tu peux y effacer l'arrière-plan, repeindre certaines zones et vérifier le résultat sur des fonds sombre, clair et en damier. Tu peux annuler, revenir à l'original et appliquer tes modifications une fois terminé.

### Nettoyer plusieurs sprites d'un coup

Le bouton **Clean Backgrounds** (nettoyer les arrière-plans) retire l'arrière-plan de tous les sprites affichés dans la grille.

1. Règle le curseur **Cleanup strength** (intensité du nettoyage). Il va de Soft à Aggressive, sur une échelle de 0 à 100, et démarre à 35. Une valeur élevée retire davantage d'arrière-plan, mais risque de mordre sur le personnage.
2. Clique sur **Clean Backgrounds** et confirme.

Après un nettoyage groupé, Marinara conserve une sauvegarde. Une ligne indique "Last cleanup has a restore point", avec un bouton **Undo Cleanup** (annuler le nettoyage). Clique dessus pour remettre chaque sprite concerné dans son état d'origine.

Le nettoyage d'arrière-plan fonctionne sur les images PNG, JPG, JPEG, WEBP et AVIF. Il ne fonctionne pas sur les fichiers GIF ni SVG.

Le nettoyage automatique examine l'image avant de choisir un moteur. Le nettoyage de fond intégré, rapide, traite d'abord les fonds chroma unis et les anciens arrière-plans blancs. Si la bordure n'est pas vraiment uniforme, Marinara peut se rabattre sur le module d'IA de suppression d'arrière-plan, à condition qu'il soit installé. Pour une scène chargée ou un sujet dont les couleurs sont presque identiques à celles de l'arrière-plan, l'éditeur de nettoyage manuel reste l'option la plus sûre.

## Exporter des sprites

Tu peux enregistrer les sprites d'un personnage sur ton ordinateur sous forme de fichier zip. Un zip est un fichier unique qui en rassemble plusieurs.

1. Ouvre l'onglet **Sprites**.
2. Clique sur **Export** (exporter) dans l'encadré **Add Sprite**.
3. Choisis **Expressions only** ou **Full-body only** pour exporter la catégorie en cours, ou **All sprites** pour tout exporter.

Le téléchargement se compose d'un seul dossier, nommé d'après le personnage, qui contient les fichiers image des sprites.

## Comment les sprites s'affichent dans le chat

Téléverser des sprites ne fait que la moitié du travail. Tu décides aussi quand et comment ils apparaissent pendant un chat. Cela se règle dans les réglages du chat, pas dans l'éditeur de personnage.

### Mode Roleplay

En mode **Roleplay**, c'est l'agent optionnel **Expression Engine** qui pilote l'affichage des sprites. Télécharge-le depuis **Agents → Agent Organizer (organisateur d’agents)**, puis ajoute-le au chat. Il analyse l'humeur de chaque message et choisit le sprite d'expression correspondant. Consulte [Référence des agents téléchargeables](../agents/built-in-agents.md) pour le détail.

Pour que les sprites apparaissent dans un chat Roleplay, il faut que toutes ces conditions soient réunies :

- L'agent **Expression Engine** est activé pour le chat.
- Au moins un personnage ou le persona actif est désigné comme porteur de sprites.
- Au moins une source de sprites est activée.

Ouvre les réglages du chat et repère la carte de l'agent **Expression Engine**. C'est là que tu règles l'affichage des sprites :

- **Sprite Source** (source des sprites) : choisis **Expressions**, **Full-body** ou les deux. Les deux sont actives par défaut. Au moins une doit le rester.
- **Expression Avatars** : remplace le petit avatar du message par le sprite d'expression correspondant, au lieu d'afficher une image flottante par-dessus la scène. Cette option est désactivée par défaut et ne concerne que le mode Roleplay.

### Game Mode

En **Game Mode**, un sprite en pied s'affiche automatiquement pour le personnage qui parle ou qui combat. L'agent Expression Engine n'est pas nécessaire. Il suffit d'avoir téléversé des sprites de corps entier pour ce personnage. Consulte [Game Mode : premiers pas](../game/getting-started.md) pour la configuration générale du Game Mode.

### Déplacer et redimensionner les sprites (mode Arrange)

Dès qu'un porteur de sprites est activé, la carte de l'agent **Expression Engine** affiche une section **Sprite Layout** (disposition des sprites).

- Clique sur **Arrange** (disposer) pour passer en mode glisser-déposer, puis fais glisser chaque sprite à l'endroit voulu. Clique sur **Done** (terminé) une fois satisfait.
- Le bouton **Reset** efface tes positions personnalisées et rétablit la disposition automatique.
- **Default Side** (côté par défaut) définit si les nouveaux sprites penchent vers la gauche, **Left**, ou vers la droite, **Right**. La valeur par défaut est **Left**. Changer de côté retourne la disposition en cours.
- Quatre curseurs règlent la taille et la transparence : **Expression Size** et **Full-body Size** vont de 5 % à 200 %. **Expression Opacity** et **Full-body Opacity** vont de 15 % à 100 %. Tous démarrent à 100 %.

## Clips d'appel vidéo

La catégorie **Clips** de l'onglet **Sprites** relève d'une autre fonctionnalité. Elle produit de courtes vidéos en boucle qui tiennent lieu de caméra au personnage pendant un appel audio ou vidéo en mode Conversation. Comme elle appartient à la fonctionnalité d'appel, elle est documentée à part. Consulte [Appels audio et vidéo en mode Conversation](../conversation/calls.md).

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Appels audio et vidéo en mode Conversation](../conversation/calls.md)
- [Expressions animées](../media/animated-expressions.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
