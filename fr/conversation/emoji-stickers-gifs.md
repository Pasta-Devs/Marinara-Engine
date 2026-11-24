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

- **Semantic** (par défaut) : propose ceux qui correspondent le mieux à la conversation récente. Il utilise un petit modèle sur ton propre ordinateur. Si ce n'est pas disponible, il en choisit au hasard. Quand un seul personnage répond, ses propres emojis et stickers sont classés avec ceux qui sont partagés, et les siens l'emportent si les résultats sont proches.
- **Random** : propose un ensemble aléatoire à chaque réponse.
- **Tool-call** : un modèle choisit ceux qui conviennent à chaque réponse. Choisis un modèle dans **Select a model...**. Si aucun n'est défini ou s'il échoue, il utilise Semantic. Il est ignoré quand plusieurs personnages répondent dans un même tour de groupe.

**Max offered (each)** est le nombre de noms d'emojis et de noms de stickers proposés par tour. La valeur par défaut est 20, de 1 à 100.

Si un personnage écrit le nom d'un sticker comme celui d'un emoji, par exemple `:hug:` au lieu de `sticker:hug:`, la réponse affiche le sticker. Cela se produit seulement si aucun emoji personnalisé ne porte ce nom.

<a id="describe-emojis-and-stickers"></a>

### Décrire les emojis et les stickers

Une description indique ce qu'un emoji ou un sticker montre et le sentiment qu'il exprime, par exemple "chat qui dépasse la tête au-dessus d'un oreiller ; timide, gêné". Elle est utile quand le nom ne dit pas ce que l'image signifie.

- Pour en écrire une, clique sur **Edit** dans l'onglet **Custom emojis** ou **Stickers**, puis sur le petit bouton de description dans le coin d'une tuile. Pour un emoji ou un sticker tagué dans une galerie, clique sur son bouton de tag et choisis **Add description** (ajouter une description).
- Pour les faire écrire par l'IA, clique sur **Edit**, puis sur **Describe with AI** (décrire avec l'IA). Le modèle **Image reading** (lecture des images) examine chaque image et rédige une courte description. Si certains emojis ou stickers en ont déjà une, choisis **Describe only the … without** (décrire seulement ceux qui n'en ont pas) ou **Describe all … again** (tout décrire à nouveau).

Avant de commencer : les descriptions par l'IA nécessitent un modèle capable de lire les images. Marinara utilise le modèle **Image reading** si tu en as défini un sur la page **Jobs** (tâches) de **Connections** (Connexions), et sinon le modèle de tes agents.

Deux réglages dans **Selection preferences** les utilisent :

- **Use descriptions** (utiliser les descriptions, activé par défaut) : tient compte de la description en plus du nom pour classer les emojis et stickers à proposer, en **Semantic** et en **Tool-call**. Cela n'ajoute rien au prompt.
- **Show descriptions to the model** (montrer les descriptions au modèle, désactivé par défaut) : ajoute aussi la description de chaque emoji ou sticker proposé à côté de son nom, pour que le modèle sache ce qu'il signifie. Cela ajoute environ 1 000 à 1 800 tokens d'entrée par réponse avec le nombre proposé par défaut de 20.

Les descriptions qui servent seulement à choisir les emojis et stickers proposés n'apprennent pas au modèle ce qu'un nom signifie. Si un nom dit le contraire du sentiment exprimé, comme un `:fine:` sarcastique, active **Show descriptions to the model** ou **Show them to the model**.

### Les montrer au modèle

Normalement, le modèle ne voit que les noms de tes emojis et stickers personnalisés. Si le modèle du chat peut lire les images, **Show them to the model** (les montrer au modèle), dans le même panneau, lui envoie aussi des images pour qu'il sache à quoi chacun ressemble. C'est surtout utile quand les noms ne décrivent pas les images.

- **Off** (désactivé, par défaut) : les noms seulement.
- **Last message** (dernier message) : montre les emojis et stickers personnalisés du message le plus récent.
- **Recent** (récents) : montre ceux des derniers messages. **Messages to look at** (messages à examiner) définit leur nombre, de 2 à 20. La valeur par défaut est 6.

**Offered ones on the sheet** (éléments proposés sur la planche) ajoute aux images ce nombre d'emojis proposés et ce nombre de stickers proposés, de 0 à 30. La valeur par défaut est 6. Une planche contient au plus 30 emojis et 12 stickers ; ceux du chat sont prioritaires, et les éléments proposés occupent la place restante.

À chaque réponse, le modèle reçoit une image d'emojis numérotés et une image de stickers numérotés, avec leurs noms exacts sous forme de texte. Cela consomme des tokens d'entrée supplémentaires à chaque réponse (les tokens sont les petits morceaux de texte et d'images qu'un service facture), environ 1 000 avec les réglages par défaut. Ce réglage n'a aucun effet si le modèle du chat ne peut pas lire les images ou si **Description des images** est activé. Si le modèle refuse les images, Marinara envoie seulement les noms.

## Les réactions utilisent seulement tes emojis personnalisés principaux

Tu peux réagir à un message avec un emoji personnalisé, mais seulement parmi les emojis que tu as téléversés dans l'onglet **Custom emojis**. Les emojis, stickers et GIF tagués depuis la galerie ne sont pas disponibles comme réactions. Quand un personnage réagit avec le nom d'un sticker, la réaction affiche ce sticker. Voir [Réagir et être notifié](getting-started.md#react-and-get-notified).

## Guides associés

- [Mode Conversation : premiers pas](getting-started.md)
- [Galeries de personnages et de personas](../characters/galleries.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
