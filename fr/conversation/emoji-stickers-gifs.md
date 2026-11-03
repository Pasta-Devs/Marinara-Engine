# Emojis, stickers et GIF personnalisés

Téléverse tes propres emojis et stickers, cherche des GIF et contrôle quels emojis et stickers personnalisés un personnage peut utiliser dans ses réponses. Ces outils fonctionnent seulement en mode Conversation. Les modes Roleplay et Game ont le sélecteur d'emojis simple.

## Où trouver ces outils

Dans un chat Conversation, clique sur le bouton rond en forme de sourire **Emoji, GIFs & stickers** à côté du champ de message. Un panneau s'ouvre au-dessus (une feuille au-dessus du clavier sur un téléphone). Ses onglets sont :

- **Emoji** : la grille d'emojis standard, plus un onglet étoile **Custom emojis** pour tes images téléversées.
- **GIFs** : recherche de GIF en direct.
- **Kaomoji** : des visages en texte comme `(^_^)`.
- **Stickers** : tes stickers téléversés.

Un onglet **Tools** s'affiche aussi quand d'autres outils de saisie sont activés.

## Téléverser un emoji personnalisé

Un emoji personnalisé est une petite image que tu téléverses une fois et que tu utilises dans n'importe quel chat Conversation. Dans un message, tu l'écris comme un shortcode : le nom entre deux-points, comme `:kekw:`.

1. Ouvre le panneau, va dans **Emoji**, puis dans l'onglet étoile **Custom emojis**.
2. Clique sur **Upload** et choisis un ou plusieurs fichiers image.
3. Dans la fenêtre **Name this emoji**, tape un nom et clique sur **Add**.

L'emoji apparaît dans la grille **Custom emojis**.

Règles :

- Un nom fait de 1 à 32 caractères : lettres minuscules, chiffres et tirets bas. L'application change les autres caractères pour toi.
- L'image fait au plus 256 sur 256 pixels. Les fichiers GIF animés fonctionnent et se jouent dans le chat.
- Les noms doivent être uniques. Un nom déjà pris affiche `An emoji named ":name:" already exists.`

Si ça n'a pas marché : vérifie le nom et la taille de l'image par rapport aux règles ci-dessus.

## Utiliser un emoji personnalisé

Clique sur une tuile dans la grille **Custom emojis**. Cela insère son shortcode dans ton message et ne l'envoie pas. Tu peux aussi taper le shortcode, en minuscules, exactement comme il est enregistré.

Dans un chat Conversation, un shortcode s'affiche comme un petit emoji en ligne. Un message composé seulement de shortcodes d'emojis s'affiche plus grand. Si le nom n'existe plus, par exemple après que tu l'as supprimé, le message affiche le texte simple `:kekw:`.

## Renommer, supprimer, exporter et importer

Clique sur **Edit** en haut de l'onglet **Custom emojis** pour activer le mode édition.

- Clique sur une tuile pour ouvrir **Rename emoji**, puis clique sur **Rename**.
- Clique sur le badge corbeille d'une tuile pour la supprimer. **Delete emoji** t'avertit que les messages qui l'utilisaient afficheront le texte à la place.
- Clique sur **Export** pour télécharger tous tes emojis personnalisés dans `marinara-custom-emojis.json`. Les images sont dans le fichier.
- Clique sur **Import** pour charger un fichier exporté. Il ignore les emojis qui enfreignent les règles de nom ou de taille ou qui entrent en conflit avec un emoji existant.

## Stickers personnalisés

Un sticker est une image plus grande qui s'affiche sur sa propre ligne. Tu le cliques normalement dans l'onglet **Stickers** ; le texte `sticker:name:` est ce qui est inséré. Dans l'onglet **Stickers**, clique sur **Upload** et utilise **Edit**, **Export** et **Import** comme pour les emojis. Les différences :

- La fenêtre de téléversement est **Name this sticker**.
- La plus grande image fait 512 sur 512 pixels (emojis : 256 sur 256).
- Le fichier d'export est `marinara-custom-stickers.json`.

Pour envoyer un sticker, clique sur sa tuile. La fenêtre **Send sticker** propose :

- **Send & reply** : publie le sticker comme son propre message et laisse le personnage répondre.
- **Add to message** : met le texte `sticker:name:` dans ton message pour que tu puisses continuer à taper.

## Chercher des GIF

L'onglet **GIFs** cherche dans Giphy, une bibliothèque de GIF en ligne. Tape dans le champ de recherche ou parcours la liste des tendances, puis clique sur un GIF pour l'envoyer.

**Avant de commencer :** la recherche de GIF a besoin d'une clé API Giphy gratuite. Une clé est un code secret qui permet à Marinara d'utiliser le service Giphy pour toi. Sans clé, l'onglet affiche une carte de configuration. La mettre en place veut dire modifier le fichier `.env`, le fichier de réglages en texte brut de Marinara. Il est dans le dossier du projet Marinara, ou à `/app/data/.env` dans Docker (voir [Modifier le fichier .env](../CONFIGURATION.md#edit-the-env-file)).

1. Ouvre le tableau de bord développeur de Giphy à `https://developers.giphy.com/dashboard/`.
2. Crée une clé API pour une application web et copie-la.
3. Ouvre le fichier `.env` dans un éditeur de texte.
4. Ajoute cette ligne à la fin, avec ta clé à la place de `your_key_here`, et enregistre le fichier :

   ```text
   GIPHY_API_KEY=your_key_here
   ```

5. Redémarre Marinara. Cela veut dire l'arrêter et le démarrer à nouveau comme tu le démarres d'habitude (voir [Installation](../INSTALLATION.md)).

Les résultats de GIF utilisent la classification pour adultes de Giphy. Tu ne peux pas la changer dans l'application, donc les résultats peuvent inclure des GIF pour adultes. Il n'y a pas de source de GIF sans contenu adulte.

## Taguer une image de galerie comme emoji ou sticker

N'importe quelle image d'une Character Gallery ou d'une Persona Gallery peut devenir un emoji ou un sticker. Cela fonctionne seulement dans les chats qui incluent ce personnage ou cette persona.

1. Ouvre le **Character Editor** ou le **Persona Editor**.
2. Ouvre l'onglet **Gallery**, puis le sous-onglet **Images**.
3. Survole une image et clique sur le bouton de tag dans son coin en haut à gauche.
4. Choisis **Make emoji** ou **Make sticker**.
5. Dans la fenêtre **Custom Emoji** ou **Custom Sticker**, tape un nom.

Le bouton de tag affiche maintenant le nom. Les mêmes limites de taille s'appliquent, et une image trop grande affiche une erreur rouge. Pour le changer plus tard, clique à nouveau sur le bouton de tag : tu y trouves une option **Rename**, une option de bascule comme **Switch to sticker**, ou une option de retrait comme **Remove emoji**. L'image reste aussi une image de galerie normale.

## Préférences de sélection

Marinara dit au personnage qui répond quels emojis et stickers personnalisés il peut utiliser. Pour changer la façon dont il les choisit, clique sur l'engrenage **Selection preferences** en haut de l'onglet **Custom emojis** ou **Stickers**. Les deux ouvrent le même réglage, enregistré par chat.

- **Semantic** (par défaut) : propose ceux qui correspondent le mieux à la conversation récente. Il utilise un petit modèle sur ton propre ordinateur. Si ce n'est pas disponible, il en choisit au hasard.
- **Random** : propose un ensemble aléatoire à chaque réponse.
- **Tool-call** : un modèle choisit ceux qui conviennent à chaque réponse. Choisis un modèle dans **Select a model...**. Si aucun n'est défini ou s'il échoue, il utilise Semantic. Il est ignoré quand plusieurs personnages répondent dans un même tour de groupe.

**Max offered (each)** est le nombre de noms d'emojis et de noms de stickers proposés par tour. La valeur par défaut est 20, de 1 à 100.

## Les réactions utilisent seulement tes emojis personnalisés principaux

Tu peux réagir à un message avec un emoji personnalisé, mais seulement parmi les emojis que tu as téléversés dans l'onglet **Custom emojis**. Les emojis, stickers et GIF tagués depuis la galerie ne sont pas disponibles comme réactions. Voir [Réagir et être notifié](getting-started.md#react-and-get-notified).

## Guides associés

- [Mode Conversation : premiers pas](getting-started.md)
- [Galeries de personnages et de personas](../characters/galleries.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
