# Branches de chat

Ce guide explique les branches de chat dans Marinara Engine : ce qu'est une branche et comment en créer une. Il montre aussi comment changer de branche, la renommer, la supprimer, l'exporter et l'importer. Une branche permet d'essayer un autre chemin dans un chat (une conversation enregistrée) sans perdre l'original.

## Ce qu'est une branche

Une branche est une copie d'un chat qui partage l'historique jusqu'à un point que tu choisis. Les branches servent à explorer une autre direction sans toucher au chat d'origine.

Toutes les branches d'un même chat sont regroupées. Dans la liste des chats, un chat qui a plusieurs branches n'occupe qu'une seule ligne. Un petit compteur de branches s'affiche à côté. Pour ouvrir ses branches et passer de l'une à l'autre, utilise le panneau contextuel **Chat Branches** (branches du chat), décrit plus bas.

Chaque branche peut avoir son propre nom d'affichage : tu peux ainsi les étiqueter "fin amicale" et "fin sombre". Ce nom d'affichage est indépendant du nom du chat sous-jacent.

## Créer une branche avec **Branch from here**

Une branche se crée depuis n'importe quel message du chat.

1. Survole un message (ou appuie dessus sur téléphone) pour faire apparaître la barre d'actions du message.
2. Clique sur le bouton **Branch from here** (créer une branche ici). Il porte une petite icône de branche.

Marinara copie le chat jusqu'à ce message inclus dans une nouvelle branche. Cette nouvelle branche :

- Conserve le même mode, les mêmes personnages, le même persona (le personnage que tu incarnes), le même preset de prompt (modèle de prompt enregistré) et la même connexion que le chat d'origine.
- Copie tous les messages, y compris tous les swipes (les réponses alternatives) et celui qui était actif. Le [guide des actions sur les messages](messages.md) explique le fonctionnement des swipes.
- Copie les instantanés des trackers (agents de suivi) et de l'état du jeu liés aux messages copiés : les chats en mode Roleplay et Game Mode gardent ainsi leur état.
- Porte au départ le nom d'affichage **New Branch**. Tu peux la renommer, voir plus bas.
- Reste dans le même dossier de chats que le chat d'origine.

Les résumés du jour et de la semaine ne sont pas repris. Les résumés glissants dont les plages de messages enregistrées sont entièrement comprises dans la branche copiée sont repris et réattribués aux nouveaux identifiants de messages de la branche. Les résumés dont la plage source traverse le point de branchement, ainsi que les anciens résumés sans métadonnées de messages, sont ignorés. La nouvelle branche recommence ces résumés à zéro.

Impossible de créer une branche dans un chat de scène. Dans ce type de chat, le bouton **Branch from here** n'apparaît pas : une action distincte, **Clone from here** (cloner à partir d'ici), prend le relais. Le guide [Scènes : créer une branche d'un roleplay](../roleplay/scenes.md) explique son fonctionnement.

## Le panneau contextuel **Chat Branches**

Ouvre le panneau depuis le bouton de branche, dans la barre d'outils du chat. Ce bouton porte une icône de branche et affiche le nombre de branches actuel. Son infobulle indique **Switch branch** (changer de branche).

Le panneau s'intitule **Chat Branches** et porte le sous-titre "Switch, import, export, or clean up this chat's branches." Il liste toutes les branches du chat en cours, en affichant d'abord celle que tu consultes. Chaque ligne indique le nom d'affichage de la branche et la date de sa dernière modification.

### Passer à une autre branche

Clique sur la ligne d'une branche dans le panneau pour l'ouvrir. Le panneau se ferme et la vue du chat bascule sur la branche choisie.

### Renommer une branche

1. Ouvre le panneau contextuel **Chat Branches**.
2. Clique sur le bouton en forme de crayon (renommer) sur la ligne de la branche concernée.
3. Une fenêtre intitulée **Rename Branch** s'ouvre avec le message "Set a display name for this chat branch."
4. Saisis un nouveau nom et valide avec le bouton **Rename**.

Un nom vide, ou un nom que tu n'as pas modifié, est ignoré.

### Supprimer une branche

1. Ouvre le panneau contextuel **Chat Branches**.
2. Clique sur le bouton en forme de corbeille (supprimer) sur la ligne de la branche.
3. Une fenêtre intitulée **Delete Branch** demande "Delete this branch? Messages will be lost."
4. Valide avec le bouton **Delete**.

Supprimer une branche efface uniquement cette branche et ses messages. Les autres branches restent en place.

### Supprimer toutes les branches

Dès qu'un chat compte au moins deux branches, un bouton **Delete All Branches** (tout supprimer) apparaît en bas du panneau. Il demande "Delete all N branches? This cannot be undone." Valide avec le bouton **Delete All** pour supprimer d'un coup toutes les branches du groupe.

Autre point de départ : la liste des chats. Supprime un chat qui a des branches via son icône de corbeille. Une fenêtre intitulée **Delete Chat** demande alors ce que tu veux supprimer. Elle propose un bouton **Delete This Branch Only** et un bouton **Delete All N Branches**. Le guide [Gérer la liste des chats](managing-chats.md) donne plus de détails sur la suppression depuis la liste.

## Exporter une branche

Le panneau **Chat Branches** propose des boutons d'export en haut. Ils exportent la branche que tu consultes.

- **JSONL** : télécharge la branche dans un fichier JSONL. JSONL signifie un message par ligne de texte, et ce format est compatible avec SillyTavern.
- **Text** : télécharge la branche sous forme de transcription en texte brut.

Pour exporter plusieurs chats d'un coup, consulte [Exporter et importer des chats](export-import.md). Ce guide décrit aussi l'option qui inclut le raisonnement du modèle dans les exports.

## Importer un fichier JSONL comme nouvelle branche

Un historique de chat enregistré s'importe comme nouvelle branche du chat ouvert.

1. Ouvre le panneau contextuel **Chat Branches**.
2. Clique sur le bouton **Import**.
3. Choisis un fichier JSONL (`.jsonl`) exporté depuis SillyTavern ou depuis Marinara.

Marinara ajoute le fichier comme nouvelle branche dans le groupe du chat en cours. Un message du type "Imported N messages as a new branch" s'affiche. L'application bascule ensuite sur la nouvelle branche.

## Guides associés

- [Actions sur les messages : modifier, supprimer, swiper, régénérer](messages.md)
- [Exporter et importer des chats](export-import.md)
- [Gérer la liste des chats](managing-chats.md)
