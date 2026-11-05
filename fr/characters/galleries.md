# Galeries de personnages et de personas

L'onglet **Gallery** (galerie) des éditeurs de personnage et de persona conserve des images et des vidéos rattachées à un personnage ou à un persona : elles restent même si tu supprimes des chats. Sers-t'en pour les planches de référence, les variantes de tenue et les packs d'images importés. Tu peux aussi marquer une image de la galerie comme emoji ou sticker personnalisé.

## L'onglet Gallery

Chaque personnage et chaque persona possède son propre onglet **Gallery** (icône d'appareil photo). Ouvre le personnage dans le Character Editor (éditeur de personnage) ou le persona dans le Persona Editor (éditeur de persona), puis clique sur **Gallery**. La galerie d'un personnage s'intitule **Character Gallery**, et celle d'un persona **Persona Gallery**. Les deux fonctionnent de la même façon.

La galerie compte deux sous-onglets :

- **Images** contient les images que tu téléverses.
- **Videos** contient les vidéos que tu téléverses, ainsi que les vidéos de scène et les extraits d'appel vidéo liés à ce personnage.

La galerie propre à un chat est différente. Elle contient les illustrations de scène et les pièces jointes générées pour ce seul chat. Garde-y les images de scène éphémères, et garde ici les images durables.

### Ajouter des images

1. Ouvre l'onglet **Gallery** et sélectionne **Images**.
2. Fais glisser des fichiers image sur **Upload Character Images** (téléverser des images de personnage), ou clique dessus pour choisir des fichiers. Dans un persona, la zone s'appelle **Upload Persona Images** (téléverser des images de persona).
3. Attends la fin du téléversement. Les nouvelles images apparaissent dans la grille.

Clique sur une image pour la voir en plus grand. Chaque vignette a une commande de téléchargement et une commande de suppression.

### Ajouter des vidéos

1. Ouvre l'onglet **Gallery** et sélectionne **Videos**.
2. Fais glisser des fichiers vidéo sur **Upload Character Videos** (téléverser des vidéos de personnage), ou clique dessus pour choisir des fichiers. Dans un persona, la zone s'appelle **Upload Persona Videos** (téléverser des vidéos de persona).
3. Attends la fin du téléversement.

Les formats pris en charge sont MP4, WebM et MOV. Les vidéos les plus récentes sont listées en premier. Pour savoir quelles vidéos de scène et quels extraits apparaissent pour quel personnage, voir [Quelles vidéos sont listées](#which-videos-are-listed).

## Marquer une image de la galerie comme emoji ou sticker personnalisé

Un emoji personnalisé est une petite image insérée dans le texte, écrite `:name:`. Un sticker est une image plus grande affichée en bloc, écrite `sticker:name:`. Les deux ne fonctionnent que dans les chats en mode Conversation, le mode façon messagerie.

1. Ouvre l'onglet **Gallery** et sélectionne **Images**.
2. Clique sur le petit bouton de marquage dans le coin supérieur gauche de l'image (infobulle **Tag as emoji or sticker**).
3. Clique sur **Make emoji** (en faire un emoji) ou sur **Make sticker** (en faire un sticker).
4. Dans la boîte de dialogue **Custom Emoji** ou **Custom Sticker**, saisis un nom et confirme.

Un nom compte de 1 à 32 lettres minuscules, chiffres et tirets bas. Les autres caractères sont convertis à ta place : "Big Grin" devient ainsi `big_grin`.

Si ça n'a pas marché : une image d'emoji ne doit pas dépasser 256 sur 256 pixels, et un sticker 512 sur 512. Si l'image est trop grande, une erreur s'affiche et rien n'est marqué.

### Gérer une image marquée

Une fois l'image marquée, son bouton en surimpression affiche le nom. Clique dessus pour d'autres options :

- **Rename** (renommer) change le nom.
- **Switch to sticker** (passer en sticker) ou **Switch to emoji** (passer en emoji) change le type. La limite de taille du nouveau type est vérifiée : un sticker de plus de 256 sur 256 pixels ne peut donc pas devenir un emoji. Une erreur s'affiche et le type reste inchangé.
- **Remove emoji** (retirer l'emoji) ou **Remove sticker** (retirer le sticker) retire le marquage. L'image reste dans la galerie.

Un emoji ou un sticker marqué dans la galerie ne fonctionne que pour ce seul personnage ou persona, dans les chats en mode Conversation qui l'incluent. C'est indépendant des collections globales d'emojis et de stickers de la zone de rédaction des messages. Si un nom de la galerie correspond à un nom global, c'est la version de la galerie qui l'emporte dans ce chat. L'unicité des noms n'est pas vérifiée : choisis donc un nom distinct pour chaque image.

<a id="reuse-a-gallery-image-in-messages-and-greetings"></a>

## Réutiliser une image de galerie dans les messages et les salutations

Toute image de la galerie d'un personnage peut s'afficher dans le texte du chat : une salutation, un message d'exemple ou un message envoyé par le personnage. Passe le pointeur sur une image de la galerie et clique sur **Copy image reference** (copier la référence de l'image), l'icône de lien. Un fragment de Markdown est copié, à coller partout où le personnage parle :

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

`self` désigne le personnage qui prononce ce message. À l'affichage du message, Marinara remplace `self` par ce personnage et charge l'image depuis sa galerie.

Cela fonctionne dans :

- **First Message** (message d'accueil), **Alternate Greetings** (salutations alternatives) et **Example Dialogue** (exemples de dialogue) sur la fiche de personnage. L'aperçu Markdown du champ affiche l'image pendant que tu modifies le texte.
- Tout message envoyé par un personnage, en mode Roleplay comme en mode Conversation.
- Les chats de groupe. Dans une réponse à plusieurs intervenants, `self` est résolu pour chaque intervenant. Si la galerie de l'intervenant ne contient pas le fichier, Marinara le cherche chez les autres personnages du chat, dans l'ordre du chat. Si deux personnages ont le même nom de fichier, l'image propre à l'intervenant l'emporte.

Cela ne fonctionne pas dans :

- **Tes propres messages**. Ils n'ont pas de personnage qui parle : une référence `self` s'affiche donc comme une image cassée. Pour publier toi-même l'image d'un personnage, utilise l'insertion du navigateur de ressources du chat, qui écrit la forme complète `card://characters/<id>/...`.
- **Les messages système**. Ils n'affichent pas les images Markdown : la référence s'affiche donc comme du texte.
- **Les galeries de persona**. Tes messages n'ont pas d'intervenant : utilise donc la forme de persona `card://personas/<id>/gallery/<file>`.

Un lien complet contient l'id interne du personnage, et les id sont régénérés à l'import d'un personnage : les liens complets se brisent donc pour toute personne avec qui tu partages le personnage. La forme `self` ne contient aucun id. Elle résiste à un export puis un import **Marinara Native**, car les images de la galerie voyagent dans l'export avec leur nom de fichier. Les exports **Compatible PNG Card** et **Compatible JSON** n'incluent pas la galerie : aucune référence de galerie ne peut donc fonctionner après un partage de ce type. Utilise **Marinara Native** quand un personnage utilise des images de galerie.

<a id="save-web-images-from-greetings"></a>

### Enregistrer les images web des salutations

Beaucoup de fiches affichent dans leurs salutations des images venues d'autres sites web, et ces liens peuvent cesser de fonctionner. Quand **First Message** ou **Alternate Greetings** affichent des images web, **Dialogue & Greetings** (dialogues et salutations) propose un bouton **Save images locally** (enregistrer les images localement).

1. Ouvre l'onglet **Card** (fiche) et trouve **Dialogue & Greetings**.
2. Clique sur **Save images locally**. Marinara télécharge les images dans la galerie et remplace chaque lien par une référence `card://self/gallery/...`.
3. Clique sur **Save** (enregistrer) pour conserver les nouveaux liens.

Rien n'est téléchargé tant que tu ne cliques pas sur le bouton. Seules les images PNG, JPEG, GIF et WebP d'au plus 10 Mo et 40 mégapixels sont enregistrées. Les liens vers ton propre ordinateur ou ton réseau domestique sont refusés. Une image qui ne peut pas être enregistrée garde son lien web, et un avertissement en indique la raison.

**Restore web links** (restaurer les liens web) remet les liens d'origine dans les salutations. Les copies enregistrées restent dans la galerie jusqu'à ce que tu les supprimes. Les images des lorebooks ne sont pas concernées.

<a id="which-videos-are-listed"></a>

## Quelles vidéos sont listées

Le sous-onglet **Videos** liste les vidéos de scène générées dans les chats avec ce personnage, ainsi que les extraits d'appel vidéo. Le personnage qui liste une vidéo dépend de sa provenance :

- Un message vidéo de Conversation est listé pour les personnages qu'il montre : celui qui l'a envoyé et toute personne qu'il nomme. Un prénom suffit quand personne d'autre dans le chat ne le porte, à condition qu'il soit écrit avec une majuscule. Tout le monde dans le chat est inclus quand le texte demande une photo ou un selfie de groupe. Les noms entre guillemets ne comptent pas.
- La galerie de ton persona ne liste un extrait que s'il nomme ton persona.
- Les vidéos plus anciennes, et celles des chats Roleplay et Game Mode, sont listées pour chaque personnage et pour le persona de leur chat.

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Emojis, stickers et GIF personnalisés](../conversation/emoji-stickers-gifs.md)
- [Arrière-plans de scène et galerie](../media/scene-backgrounds.md)
