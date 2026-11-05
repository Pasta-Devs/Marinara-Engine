# Branches de chat

Une branche est une copie d'un chat jusqu'à un message donné. Sers-t'en pour essayer un autre chemin pendant que l'original reste intact. Ce guide explique comment créer des branches, passer de l'une à l'autre, les afficher, les renommer, les supprimer, les exporter et les importer.

Toutes les branches d'un même chat sont regroupées. Dans la liste des chats, le chat garde une seule ligne et affiche un compteur de branches. Quand au moins une branche du groupe enregistre le chat dont elle provient, clique sur le compteur pour ouvrir l'arbre ; une branche sans cette information se place directement sous le chat. Si aucune branche du groupe n'a cette information (branches anciennes ou importées), le groupe reste sur une seule ligne ; ouvre alors ses branches depuis **Chat Branches** (branches du chat). Une branche créée à partir d'une branche s'imbrique sous elle : tu vois donc un arbre. Chaque branche a un nom d'affichage et une date de dernière activité : tu peux ainsi les étiqueter "fin amicale" et "fin sombre". Le nom d'affichage est indépendant du nom du chat. Un groupe Game garde une seule ligne, car les sessions Game sont des sessions numérotées, pas des branches.

## Créer une branche avec Branch from here

1. Touche le message (sur un ordinateur, passe le pointeur dessus) pour afficher la barre d'actions du message.
2. Clique sur **Branch from here** (créer une branche ici), la petite icône de branche.

Marinara copie le chat jusqu'à ce message inclus dans une nouvelle branche nommée **New Branch**. Tu peux la renommer plus tard.

La branche :

- Garde le même mode, les mêmes personnages, le même persona, le même preset de prompt et la même connexion.
- Copie chaque message avec tous ses swipes, et retient quel swipe était actif. Voir [Actions sur un message](messages.md).
- Copie l'état des trackers et du jeu lié aux messages copiés.
- Conserve le travail d'Advanced Memory dans un chat Roleplay. Les souvenirs des scènes antérieures, déjà terminées, restent prêts à être rappelés. La scène à partir de laquelle tu crées la branche redevient la scène en cours, et ses anciens souvenirs sont supprimés. Voir [Mémoire et résumés de chat](../agents/memory.md).
- Reste dans le même dossier de chats que la source.

Les résumés du jour et de la semaine ne sont pas repris. Les résumés glissants entièrement compris dans les messages copiés sont repris. Les résumés qui traversent le point de branchement, ainsi que les anciens résumés sans données de messages, sont laissés de côté, et la branche recommence ces résumés à zéro.

Si ça n'a pas marché : **Branch from here** n'apparaît pas dans un chat de scène. Les chats de scène ont **Clone from here** (cloner à partir d'ici) à la place. Voir [Scènes : créer une branche d'un roleplay](../roleplay/scenes.md).

## La section Chat Branches

Ouvre **Chat Settings** (réglages du chat) et déplie **Chat Branches**, sous **Chat Name** (nom du chat). Son en-tête indique le nombre de branches. Sur un ordinateur, tu peux en faire une fenêtre séparée. Voir [Vue d'ensemble des Chat Settings](chat-settings.md#popping-a-section-out-into-its-own-window).

La section liste toutes les branches du chat, en commençant par celle que tu consultes. Chaque ligne indique le nom d'affichage et l'heure de la dernière modification. Clique sur une ligne pour passer à cette branche.

Boutons au-dessus de la liste :

| Bouton | Ce qu'il fait |
| --- | --- |
| **Branch graph** (graphe des branches) | Ouvre la fenêtre du graphe. Voir plus bas. |
| **JSONL**, **Text**, **Markdown**, **Story** | Exportent la branche que tu consultes. Voir [Exporter et importer des chats](export-import.md). |
| **Export a range** (exporter une plage) | Exporte une partie du chat. Non disponible en Game Mode. Voir [Exporter et importer des chats](export-import.md#export-part-of-a-chat). |
| **Import** (importer) | Ajoute un fichier `.jsonl` comme nouvelle branche. Voir plus bas. |
| **Stats** (statistiques) | Ouvre les statistiques du chat pour la branche que tu consultes. |

### Voir le graphe des branches

Le graphe montre où chaque branche s'est séparée, ce que la liste ne peut pas montrer.

1. Ouvre **Chat Branches** et clique sur **Branch graph**. Clique de nouveau dessus pour fermer le graphe.

Le graphe s'ouvre dans sa propre fenêtre, que tu peux déplacer et redimensionner. Sur un téléphone, il s'ouvre dans un panneau. Chaque chat du groupe a une ligne, dans le même ordre que la liste des chats. Les messages vont de gauche à droite, un point par message.

- Les points gris sont tes messages, les points de la couleur d'accent sont les réponses des personnages, et les cercles vides sont les messages du narrateur ou du système.
- Une branche n'affiche que ses propres messages. Une ligne la relie au message dont elle est issue.
- Une branche sans point de séparation enregistré est reliée au chat du haut par une ligne en pointillés, et la légende affiche **Fork not recorded**. C'est le cas des anciennes branches et des branches dont le chat source a été supprimé.
- Les longues portions sans séparation se replient en un marqueur **··· N ···**, où N est le nombre de messages masqués. Clique dessus pour les afficher. **Expand all** (tout déplier) déplie toutes les portions et **Collapse long runs** (replier les longues portions) les replie de nouveau.
- Les points de séparation et le dernier message de chaque branche portent un anneau. Touche-le, passe le pointeur dessus ou sélectionne-le au clavier pour voir le numéro du message, son auteur et le début de son texte.
- Clique sur le nom ou la ligne d'une branche pour y passer. La branche que tu consultes est mise en évidence.

Le graphe s'actualise quand tu crées une branche, renommes ou supprimes un chat, et peu après l'arrivée de nouveaux messages.

### Renommer une branche

1. Dans **Chat Branches**, clique sur le bouton en forme de crayon sur la ligne de la branche.
2. Dans la boîte de dialogue **Rename Branch** ("Set a display name for this chat branch."), saisis un nouveau nom.
3. Clique sur **Rename** (renommer).

Un nom vide ou inchangé est ignoré.

### Supprimer une branche

1. Dans **Chat Branches**, clique sur le bouton en forme de corbeille sur la ligne de la branche.
2. Dans la boîte de dialogue **Delete Branch** ("Delete this branch? Messages will be lost."), clique sur **Delete** (supprimer).

Cela retire uniquement cette branche et ses messages. Les autres branches restent en place.

Avec deux branches ou plus, **Delete All Branches** (supprimer toutes les branches) apparaît en bas de la section. Il demande "Delete all N branches? This cannot be undone." Confirme avec **Delete All** (tout supprimer). Tu peux aussi partir de la liste des chats : supprimer un chat qui a des branches propose **Delete This Branch Only** (supprimer seulement cette branche) et **Delete All N branches** (supprimer les N branches). Voir [Gérer la liste des chats](managing-chats.md#delete-a-chat).

### Importer un fichier comme nouvelle branche

1. Dans **Chat Branches**, clique sur **Import**.
2. Choisis un fichier `.jsonl` exporté depuis SillyTavern ou Marinara.

Marinara l'ajoute comme nouvelle branche dans le groupe du chat en cours, affiche "Imported N messages as a new branch", puis bascule dessus.

## Comment les branches sont liées

Cette section s'adresse aux personnes qui développent à partir des données des branches.

- Chaque branche enregistre son chat source immédiat et le message où la branche a été créée. L'identifiant du message source et celui de sa copie sont tous deux conservés : les intégrations peuvent ainsi retrouver la limite de la branche, même si les messages copiés reçoivent de nouveaux identifiants.
- Créer une branche d'une branche enregistre cette dernière comme parent, et non la racine d'origine.
- Dès qu'au moins une branche d'un groupe enregistre sa source, cliquer sur le compteur dans la liste des chats ouvre l'arbre. Une branche dont la source est inconnue se place directement sous le chat. Un groupe sans source connue garde une seule ligne, et ses branches s'ouvrent depuis **Chat Branches**.
- Supprimer un chat parent ne change pas la source enregistrée de ses enfants. Supprimer tout le groupe supprime tous les chats qu'il contient.
