# Gérer la liste des chats

Ce guide explique la liste des chats de Marinara Engine, autrement dit tes conversations enregistrées. Au programme : les trois onglets de mode, puis la façon de créer, importer, renommer, supprimer, organiser, rechercher et gérer en lot les chats. Il présente aussi la rangée des chats récents sur l'écran d'accueil.

## La liste des chats et les onglets de mode

Les chats se trouvent dans le panneau **Chats**, la barre latérale de gauche. En haut de ce panneau, trois onglets de mode :

- **CONVO** pour Conversation, un chat simple, façon messagerie.
- **RP** pour Roleplay, une scène immersive avec des personnages et un suivi de l'univers.
- **GM** pour Game, un jeu de rôle solo mené par l'IA.

Chaque onglet n'affiche que les chats du mode correspondant. Quand tu cliques sur un onglet, la liste change.

Chaque ligne de la liste affiche le nom du chat et l'avatar du ou des personnages. Dans les chats Conversation, un petit point de couleur sur l'avatar indique le statut de chaque personnage. Un badge rouge sur une ligne, lui, correspond au nombre de messages non lus.

Certaines lignes portent une petite icône de branche accompagnée d'un nombre. Cela signifie que le chat compte plusieurs branches, regroupées sur une seule ligne. Pour savoir ce qu'est une branche, consulte [Les branches de chat](branches.md).

## Créer un chat

1. Choisis l'onglet de mode voulu (**CONVO**, **RP** ou **GM**).
2. Clique sur le bouton **+** en haut du panneau. Son infobulle indique **New Conversation**, **New Roleplay** ou **New Game**, selon l'onglet actif.
3. L'application crée le chat, l'ouvre, puis affiche le panneau **Chat Settings** (réglages du chat) et un assistant de configuration pour terminer la mise en place.

Le nouveau chat s'appelle **New Conversation**, **New Roleplay** ou **New Game**. Rien n'empêche de le renommer plus tard (voir Renommer un chat, plus bas).

Il faut au moins une connexion pour qu'un chat s'ouvre. Une connexion relie Marinara à un fournisseur d'IA. Sans connexion, la fenêtre **Set Up** (configuration) s'affiche à la place du chat. Elle te demande d'abord de choisir une connexion. Si tu n'en as aucune, elle affiche "No connections found" avec un bouton **Open Connections**. Pour en créer une, consulte [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

Si tu as enregistré un profil de réglages par défaut marqué d'une étoile pour ce mode, Marinara l'applique automatiquement au nouveau chat. Voir [Vue d'ensemble des Chat Settings](chat-settings.md).

## Importer un chat

Tu peux importer un historique de chat enregistré au format `.jsonl`, depuis SillyTavern ou depuis Marinara.

1. Choisis l'onglet de mode dans lequel le chat importé doit atterrir.
2. Clique sur le bouton **Import** (importer) en haut du panneau. Son infobulle indique **Import SillyTavern or Marinara chat JSONL**.
3. Sélectionne le fichier `.jsonl`.

Marinara crée un chat dans le mode de l'onglet actif et l'ouvre. Un message doit apparaître : **Imported N messages**, où N est le nombre de messages.

Pour toutes les façons d'importer et d'exporter des chats, formats et import en lot compris, consulte [Exporter et importer des chats](export-import.md).

## Renommer un chat

Le nom du chat n'est visible que par toi. Marinara ne l'envoie pas à l'IA et il ne change rien à la conversation.

1. Ouvre le chat.
2. Ouvre **Chat Settings** avec son bouton dans le chat.
3. Dans la section **Chat Name**, clique sur le nom actuel pour le transformer en champ de saisie.
4. Saisis le nouveau nom, puis appuie sur Enter ou clique sur le bouton en forme de coche.

Pour en savoir plus sur le panneau **Chat Settings**, consulte [Vue d'ensemble des Chat Settings](chat-settings.md).

## Supprimer un chat

Pour supprimer un seul chat, survole sa ligne et clique sur le bouton en forme de corbeille. Sur mobile, ce bouton reste toujours visible. Une boîte de dialogue intitulée **Delete Chat** (supprimer le chat) demande "Delete this chat?". Clique sur **Delete** pour confirmer.

Un chat supprimé l'est définitivement. Cela interrompt aussi toute réponse encore en cours de génération pour ce chat.

### La boîte de dialogue de choix de branche

Si le chat que tu supprimes compte plusieurs branches, une autre fenêtre s'ouvre. Intitulée **Delete Chat**, elle indique que la conversation comporte plusieurs branches. Deux choix s'offrent à toi :

- **Delete This Branch Only** (supprimer seulement cette branche) ne retire que la branche sur laquelle tu as cliqué.
- **Delete All N Branches** (supprimer les N branches) retire toutes les branches du groupe, où N est le nombre de branches.

Pour gérer les branches sans supprimer le chat entier, consulte [Les branches de chat](branches.md).

### Activer ou désactiver les confirmations de suppression

Un réglage global de l'application, **Confirm before deleting** (confirmer avant de supprimer), détermine si ces confirmations apparaissent. Il est activé par défaut et se trouve dans **Settings** (Paramètres), sous l'onglet **General**. Son texte d'aide conseille de le laisser activé.

## Les dossiers de chat

Tu peux regrouper les chats en dossiers à l'intérieur de chaque onglet de mode.

1. Vérifie que l'onglet actif contient au moins un chat. Le bouton **New Folder** (nouveau dossier) n'apparaît au-dessus de la liste que dans ce cas.
2. Clique sur **New Folder**. Le dossier est créé sous le nom **unnamed** (ou **unnamed 2**, **unnamed 3**, et ainsi de suite si le nom est déjà pris).

Pour renommer un dossier, double-clique dessus, double-tape dessus, ou sélectionne-le et appuie sur F2. Un nom vide est ignoré.

Pour supprimer un dossier, clique sur le bouton en forme de corbeille sur la ligne du dossier. Une boîte de dialogue intitulée **Delete Folder** demande confirmation. Supprimer un dossier ne supprime jamais les chats qu'il contient. Ces chats remontent au niveau supérieur.

Pour réordonner les dossiers, fais-les glisser vers le haut ou vers le bas par la poignée.

Pour déplacer un chat dans un dossier, fais glisser sa ligne sur le dossier. Pour le sortir de tout dossier, fais-le glisser sur la zone vide sous les dossiers. Sur écran tactile, appuie sur un chat pendant une demi-seconde environ pour lancer le glisser-déposer. Si plusieurs chats sont sélectionnés, en faire glisser un déplace toute la sélection.

Les chats qui ne sont rangés dans aucun dossier apparaissent dans une simple liste sous les dossiers.

## Rechercher, trier et filtrer par tag

Chaque onglet de mode a son propre champ de recherche en haut de la liste. Le texte indicatif change selon l'onglet : **Search conversations...**, **Search roleplays...** ou **Search games...**. La recherche porte sur le nom du chat, ses tags et les noms de ses personnages. Elle ne cherche pas dans le texte des messages.

À côté du champ de recherche, un menu de tri porte l'infobulle **Sort chats**. Il propose quatre options :

- **Newest**, l'option par défaut, place les chats les plus récemment actifs en tête.
- **Oldest** place les moins récemment actifs en tête.
- **A-Z** trie par nom, de A à Z.
- **Z-A** trie par nom, de Z à A.

Si un chat de l'onglet porte des tags, une ligne de filtres apparaît. Clique sur la pastille **Tags** pour dérouler la liste des tags. Clique ensuite sur un tag pour n'afficher que les chats qui le portent. Clique sur **Clear** pour retirer le filtre. Quand les tags sont nombreux, une pastille **+N more** révèle les autres.

À noter : cet écran filtre uniquement sur les tags qu'un chat possède déjà. Aucun bouton ne permet d'ajouter un tag à un chat depuis cet écran.

La liste affiche jusqu'à 100 chats à la fois. Au-delà, un bouton **Load more** (charger plus) apparaît en bas pour dévoiler le lot suivant.

## Sélectionner plusieurs chats

Tu peux agir sur plusieurs chats d'un coup.

1. Clique sur le bouton **Select chats** (sélectionner des chats) en haut du panneau, celui avec l'icône de coche.
2. Clique sur chaque chat voulu. Une case à cocher s'active sur chaque ligne sélectionnée, au lieu d'ouvrir le chat.
3. Une barre en bas indique le nombre de chats sélectionnés et propose deux boutons.

Le bouton **Export** télécharge tous les chats sélectionnés ensemble, dans un seul fichier `.zip`. Le bouton **Delete** les supprime. La suppression demande d'abord une confirmation, dans une fenêtre intitulée **Delete Chats**.

Pour quitter le mode sélection sans rien faire, clique de nouveau sur le bouton de sélection. Changer d'onglet efface aussi la sélection.

## Les chats récents sur l'écran d'accueil

L'écran d'accueil affiche une rangée compacte **Recent Chats** (chats récents) avec les trois chats les plus récemment actifs. Chaque chat y prend la forme d'une petite pastille avec un avatar, un badge de mode et le nom du chat. Clique sur une pastille pour ouvrir le chat correspondant. Sans aucun chat, la rangée affiche "No chats yet".

## Guides associés

- [Les branches de chat](branches.md)
- [Exporter et importer des chats](export-import.md)
- [Vue d'ensemble des Chat Settings](chat-settings.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
