# Galeries de personnages et de personas

Ce guide explique l'onglet **Gallery** (galerie) des éditeurs de personnage et de persona. Il montre comment ajouter des images et des vidéos qui restent rattachées à un personnage ou à un persona. Tu découvres aussi comment marquer une image de la galerie comme emoji ou sticker personnalisé.

## L'onglet Gallery

Chaque personnage et chaque persona possède son propre onglet **Gallery**. Ouvre un personnage dans l'éditeur **Character Editor** (éditeur de personnage), ou un persona dans l'éditeur **Persona Editor** (éditeur de persona), puis clique sur l'onglet **Gallery** (icône d'appareil photo).

La galerie compte deux sous-onglets :

- **Images** : les images que tu téléverses pour ce personnage ou ce persona.
- **Videos** : les vidéos que tu téléverses, ainsi que les vidéos de scène et les extraits d'appel vidéo liés à ce personnage.

La galerie d'un personnage s'intitule **Character Gallery**. Celle d'un persona s'intitule **Persona Gallery**. Les deux fonctionnent de la même façon.

## En quoi la galerie diffère de celle d'un chat

Les images de la galerie appartiennent au personnage ou au persona, pas à un chat en particulier. Si tu supprimes un chat, ces images restent en place. Utilise la galerie pour les planches de référence, les variantes de tenue ou les packs d'images de personnage importés.

La galerie propre à un chat, elle, est différente. Elle contient les illustrations liées à une scène et les pièces jointes générées dans les messages de ce chat précis. Garde les images de scène éphémères dans la galerie du chat. Garde les images durables du personnage dans la galerie **Gallery** du personnage ou du persona.

## Ajouter des images

1. Ouvre l'éditeur de personnage ou de persona.
2. Clique sur l'onglet **Gallery**.
3. Vérifie que le sous-onglet **Images** est bien sélectionné.
4. Fais glisser des fichiers image sur la zone **Upload Character Images** (téléverser des images de personnage), ou clique dessus pour choisir des fichiers. Dans un persona, cette zone s'appelle **Upload Persona Images**.
5. Attends la fin du téléversement. Les nouvelles images apparaissent dans la grille en dessous.

Les formats d'image courants passent sans problème : JPG, PNG, GIF, WebP et AVIF. Clique sur une image pour l'ouvrir en plus grand. Chaque vignette dispose aussi d'une commande de téléchargement et d'une commande de suppression.

## Ajouter des vidéos

1. Clique sur l'onglet **Gallery**.
2. Sélectionne le sous-onglet **Videos**.
3. Fais glisser des fichiers vidéo sur la zone **Upload Character Videos** (téléverser des vidéos de personnage), ou clique dessus pour choisir des fichiers. Dans un persona, cette zone s'appelle **Upload Persona Videos**.
4. Attends la fin du téléversement.

Les formats vidéo pris en charge sont MP4, WebM et MOV. Le sous-onglet **Videos** liste également les vidéos de scène générées dans les chats avec ce personnage, ainsi que les extraits d'appel vidéo. Les plus récents arrivent en premier.

## Marquer une image de la galerie comme emoji ou sticker personnalisé

Une image de la galerie peut devenir un emoji personnalisé ou un sticker pour le mode **Conversation** (le mode de chat façon messagerie). Un emoji personnalisé est une petite image insérée dans le texte, écrite `:name:`. Un sticker est une image plus grande affichée en bloc, écrite `sticker:name:`. Cela ne fonctionne que dans les chats en mode Conversation.

Pour marquer une image :

1. Ouvre l'onglet **Gallery** et sélectionne le sous-onglet **Images**.
2. Repère l'image voulue. Dans son coin supérieur gauche se trouve un petit bouton de marquage, avec l'infobulle **Tag as emoji or sticker**.
3. Clique sur ce bouton de marquage. Un menu s'ouvre avec **Make emoji** et **Make sticker**.
4. Clique sur **Make emoji** ou sur **Make sticker**.
5. Dans la boîte de dialogue **Custom Emoji** ou **Custom Sticker**, saisis un nom, puis confirme.

Le nom accepte les lettres minuscules, les chiffres et les tirets bas, dans la limite de 32 caractères. Marinara convertit les autres caractères à ta place. Par exemple, "Big Grin" devient `big_grin`.

Les limites de taille dépendent du type choisi, pas de la galerie. Une image d'emoji ne doit pas dépasser 256 sur 256 pixels. Une image de sticker ne doit pas dépasser 512 sur 512 pixels. Si l'image est trop grande, un message d'erreur s'affiche et le marquage n'est pas appliqué.

### Gérer une image marquée

Une fois l'image marquée, son bouton en surimpression affiche le nom attribué. Clique dessus pour ouvrir un menu avec d'autres options :

- **Rename** (renommer) : change le nom.
- **Switch to sticker** ou **Switch to emoji** : change le type. Le changement revérifie la limite de taille du nouveau type. Une image de sticker de plus de 256 sur 256 pixels est trop grande pour devenir un emoji. Dans ce cas, une erreur s'affiche et le type reste inchangé.
- **Remove emoji** ou **Remove sticker** : retire le marquage. L'image n'est pas supprimée de la galerie pour autant.

### Où fonctionnent ces emojis et stickers rattachés

Un emoji ou un sticker marqué dans la galerie reste rattaché à ce seul personnage ou persona. Il fonctionne uniquement dans les chats en mode Conversation qui incluent ce personnage ou ce persona. C'est indépendant des collections globales d'emojis et de stickers, accessibles depuis la zone de rédaction des messages.

Si un nom de la galerie correspond à un nom de la collection globale, c'est la version de la galerie qui l'emporte dans ce chat. L'unicité des noms n'est pas vérifiée. Choisis un nom distinct pour chaque image afin d'éviter les mauvaises surprises.

## Réutiliser une image de galerie dans les messages et les salutations

Toute image de la galerie d'un personnage peut s'afficher dans le texte du chat : une salutation, un message d'exemple ou un message envoyé par le personnage. Survolez l'image et cliquez sur **Copy image reference** (l'icône de lien). Un court fragment Markdown est copié et peut être collé partout où le personnage parle :

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

Une seule règle : **`self` désigne le personnage qui prononce ce message.** Au rendu, Marinara remplace `self` par ce personnage et affiche l'image de sa galerie.

Cela fonctionne dans **First Message**, **Alternate Greetings** et **Example Dialogue** sur la fiche, dans tout message envoyé par un personnage en Roleplay comme en Conversation, et dans les chats de groupe. Pour une réponse à plusieurs intervenants, `self` est résolu séparément pour chacun. Si sa galerie ne contient pas le fichier, Marinara le cherche dans celles des autres personnages du chat.

Par conception, cela ne fonctionne pas dans vos propres messages, qui n'ont pas de personnage locuteur, ni dans les messages système, qui n'affichent pas les images Markdown. Pour publier vous-même une image, utilisez le navigateur de ressources du chat, qui écrit la forme complète `card://characters/<id>/...`. Les galeries de persona utilisent `card://personas/<id>/gallery/<file>`.

Si deux personnages ont une image portant le même nom de fichier, celle du locuteur l'emporte toujours. S'il ne la possède pas, la première correspondance selon l'ordre des personnages du chat est utilisée. Choisissez des noms distincts si vous voulez une version précise.

### Pourquoi `self` plutôt que le lien complet

Un lien complet contient l'id interne du personnage (`card://characters/<id>/gallery/<file>`), et cet id est régénéré à chaque import ; le lien se brise donc au partage. La forme `self` ne contient ni id ni adresse de serveur. Elle résiste à un **export et import JSON natif** : les images de galerie voyagent avec l'export et conservent leur nom.

Une limite demeure : **les exports de fiche PNG n'incluent pas la galerie**. Partagez l'export `.json` natif lorsqu'un personnage utilise des références de galerie.

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Personas utilisateur : création et modification](personas.md)
- [Emojis, stickers et GIF personnalisés](../conversation/emoji-stickers-gifs.md)
- [Arrière-plans de scène et galerie](../media/scene-backgrounds.md)
