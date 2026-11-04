# Gérer la liste des chats

Le panneau **Chats**, à gauche, contient tous tes chats. Sers-t'en pour lancer, retrouver, trier, organiser et supprimer des chats.

## La liste des chats et les onglets de mode

En haut du panneau se trouvent trois onglets de mode. Chaque onglet n'affiche que les chats de ce mode.

| Onglet | Mode |
| --- | --- |
| **CONVO** | Conversation : un chat façon messagerie. |
| **RP** | Roleplay : une scène avec des personnages et un suivi de l'univers. |
| **GM** | Game : un jeu de rôle solo mené par l'IA. |

Chaque ligne affiche le nom du chat et les avatars de ses personnages. Dans les chats Conversation, un point de couleur sur un avatar indique le statut de ce personnage. Un badge rouge indique le nombre de messages non lus. Une ligne avec une petite icône de branche et un nombre correspond à un chat qui a plusieurs branches, regroupées sur une seule ligne. Voir [Branches de chat](branches.md).

## Créer un chat

Avant de commencer : ajoute au moins un compte dans **Connections** (Connexions). Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Clique sur l'onglet du mode voulu.
2. Touche le bouton **+** en haut du panneau. Son libellé est **New Conversation**, **New Roleplay** ou **New Game**, selon l'onglet.

Marinara crée et ouvre le chat. **Chat Settings** (réglages du chat) et un assistant de configuration s'ouvrent à côté. Le chat porte d'abord le nom **New Conversation**, **New Roleplay** ou **New Game**. Si tu as enregistré un profil de réglages par défaut marqué d'une étoile pour Conversation ou Roleplay, Marinara l'applique au nouveau chat. Voir [Profils de réglages](settings-profiles.md).

Si ça n'a pas marché : sans compte enregistré, la fenêtre **Add account** (ajouter un compte) s'ouvre à la place d'un chat. Choisis un service, clique sur **Connect** (connecter), puis choisis un modèle. La marche à suivre complète se trouve dans [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

## Importer un chat

Tu peux importer un historique de chat `.jsonl` depuis SillyTavern ou Marinara.

1. Clique sur l'onglet du mode dans lequel le chat doit atterrir.
2. Touche le bouton **Import** (importer) en haut du panneau. Son libellé est **Import SillyTavern or Marinara chat JSONL**.
3. Choisis ton fichier `.jsonl`.

Marinara crée le chat, l'ouvre et affiche **Imported N messages**. Pour les formats d'export et l'export en lot, voir [Exporter et importer des chats](export-import.md).

Si ça n'a pas marché : un petit message en bas de l'écran affiche **Import failed** avec la raison. Seuls les fichiers `.jsonl` sont acceptés.

## Renommer un chat

Le nom du chat n'est là que pour toi. Il n'est pas envoyé au modèle.

1. Ouvre le chat, puis ouvre **Chat Settings**.
2. Dans **Chat Name** (nom du chat), clique sur le nom actuel.
3. Saisis le nouveau nom, puis appuie sur <kbd>Enter</kbd> ou clique sur la coche.

Voir [Vue d'ensemble des Chat Settings](chat-settings.md) pour savoir comment ouvrir le panneau.

<a id="delete-a-chat"></a>

## Supprimer un chat

1. Touche le bouton en forme de corbeille sur la ligne du chat. Sur un ordinateur, il apparaît quand tu passes le pointeur sur la ligne.
2. Dans la boîte de dialogue **Delete Chat** (supprimer le chat), clique sur **Delete** (supprimer).

La suppression est définitive. Elle interrompt aussi toute réponse encore en cours d'écriture pour ce chat.

Si le chat a plusieurs branches, la boîte de dialogue indique combien et propose deux choix :

- **Delete This Branch Only** (supprimer seulement cette branche) retire la branche sur laquelle tu as cliqué.
- **Delete All N branches** (supprimer les N branches) retire toutes les branches du groupe.

Pour gérer les branches sans supprimer le chat, voir [Branches de chat](branches.md).

Le réglage global de l'application **Confirm before deleting** (confirmer avant de supprimer) contrôle ces boîtes de dialogue. Il est activé par défaut. Il se trouve dans **Settings → General** (Paramètres → Général).

## Les dossiers de chat

Les dossiers regroupent des chats à l'intérieur d'un onglet de mode.

1. Ouvre un onglet qui contient au moins un chat. **New Folder** (nouveau dossier) n'apparaît sous les onglets que dans ce cas.
2. Clique sur **New Folder**. Le dossier s'appelle **unnamed** (puis **unnamed 2**, **unnamed 3**).

| Pour faire ceci | Fais cela |
| --- | --- |
| Renommer un dossier | Double-clique dessus ou touche-le deux fois, ou sélectionne-le et appuie sur <kbd>F2</kbd>. Un nom vide est ignoré. |
| Supprimer un dossier | Clique sur le bouton en forme de corbeille sur la ligne du dossier. Une boîte de dialogue **Delete Folder** apparaît quand le dossier contient des chats. Les chats remontent au niveau supérieur et ne sont pas supprimés. |
| Réordonner les dossiers | Fais glisser un dossier vers le haut ou vers le bas. Le menu de tri passe sur **Custom** (personnalisé). |
| Déplacer un chat dans un dossier | Fais glisser la ligne du chat sur le dossier. Sur un écran tactile, appuie d'abord sur le chat pendant une demi-seconde environ. |
| Sortir un chat d'un dossier | Fais-le glisser sur la zone vide sous les dossiers. |

Quand plusieurs chats sont sélectionnés, en faire glisser un déplace toute la sélection. Les chats hors dossier sont listés sous les dossiers.

## Rechercher, trier et filtrer

### Retrouver un chat par son nom

Chaque onglet a un champ de recherche. Son texte indicatif est **Search conversations**, **Search roleplays** ou **Search games**. Saisis un mot. La recherche porte sur les noms des chats, leurs tags et les noms des personnages, pas sur le texte des messages.

### Retrouver un message dans tous les chats

1. Touche **Search all chats** (rechercher dans tous les chats), le bouton à côté du menu de tri.
2. Saisis tes mots.

La recherche parcourt tous les chats et peut filtrer par mode, personnage, expéditeur et date.

Le menu de tri (**Sort chats**) propose ces options :

| Option | Ordre |
| --- | --- |
| **Custom** | L'ordre de tes dossiers. |
| **Manual order** | Les chats dans l'ordre où tu les fais glisser. Au clavier, sélectionne un chat et appuie sur <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd>. |
| **Recent** | Les plus récemment actifs en premier. C'est l'option par défaut. |
| **Newest** | Les plus récemment créés en premier. |
| **Oldest** | Les plus anciens en premier. |
| **A-Z** et **Z-A** | Par nom. |

Quand un chat de l'onglet a un tag, une pastille **Tags (N)** apparaît. Clique dessus pour dérouler les tags, puis clique sur un tag pour n'afficher que les chats qui le portent. Clique sur **Clear** (effacer) pour retirer le filtre. Ce panneau ne permet pas d'ajouter des tags à un chat.

La liste affiche 100 chats à la fois. Clique sur **Load more** (charger plus) pour voir le lot suivant.

<a id="selecting-multiple-chats"></a>

## Sélectionner plusieurs chats

1. Clique sur le bouton en forme de coche, **Select chats** (sélectionner des chats), en haut du panneau.
2. Clique sur chaque chat voulu. Les lignes affichent une case à cocher au lieu d'ouvrir le chat.
3. Utilise la barre en bas, qui indique combien de chats sont sélectionnés.

**Export** (exporter) télécharge les chats sélectionnés dans un seul fichier `.zip` de fichiers `.jsonl`. **Delete** te demande de confirmer dans une boîte de dialogue **Delete Chats**, puis les supprime. Clique de nouveau sur le bouton en forme de coche pour quitter le mode sélection. Changer d'onglet efface aussi la sélection.

## Les chats récents sur l'écran d'accueil

L'écran d'accueil comporte un widget **Recent chats** (chats récents) avec tes derniers chats. Chacun affiche son nom, un badge de mode et son dernier message. Clique sur un chat pour l'ouvrir. Sans aucun chat, le widget affiche **Your chats will show here**. Voir [Les widgets de l'accueil](../home/welcome.md#home-widgets).
