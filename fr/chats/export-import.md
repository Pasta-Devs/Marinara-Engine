# Exporter et importer des chats

Ce guide explique comment enregistrer un chat (une conversation enregistrée) dans un fichier, puis le recharger dans Marinara Engine. Tu peux exporter un seul chat ou plusieurs d'un coup. Autre possibilité : importer un fichier de chat venant de Marinara ou de SillyTavern (une autre application de chat pour le roleplay).

## Les formats de fichier que tu vas croiser

Marinara utilise deux formats de fichier pour les chats.

- **JSONL** : JSONL veut dire JSON Lines. C'est un fichier texte brut qui enregistre un message par ligne. C'est le format d'export par défaut. Un fichier JSONL se réimporte ensuite dans Marinara sans problème.
- **Text** : une transcription `.txt` lisible telle quelle. Facile à lire et à partager, mais Marinara ne sait pas la réimporter. Réserve le format **Text** aux chats destinés à être lus par un humain.

L'import de chat accepte uniquement un fichier `.jsonl`. Si tu comptes réimporter un chat plus tard, exporte-le en **JSONL**, pas en **Text**.

## Exporter un seul chat

Pour exporter un chat dans un fichier, passe par la section **Chat Branches** de **Chat Settings** (branches du chat). C'est le moyen le plus rapide d'exporter l'historique du chat d'une seule conversation.

1. Ouvre le chat à exporter.
2. Ouvre **Chat Settings** et déplie **Chat Branches**, sous **Chat Name**.
3. Clique sur **JSONL** pour enregistrer le chat en fichier JSONL, ou sur **Text** pour l'enregistrer en fichier texte lisible.
4. Le navigateur télécharge le fichier.

Le téléchargement porte sur le chat actuellement ouvert, messages compris.

## Exporter plusieurs chats d'un coup

Tu peux sélectionner plusieurs chats et les télécharger ensemble dans un seul fichier `.zip`.

1. Ouvre la liste des chats dans la barre latérale de gauche.
2. Choisis l'onglet de mode voulu : **CONVO** (Conversation), **RP** (Roleplay) ou **GM** (Game). Chaque onglet n'exporte que ses propres chats.
3. Clique sur le bouton **Select chats** (sélectionner des chats) en haut de la liste.
4. Clique sur chaque chat à inclure. Une case à cocher s'active pour chacun.
5. Une barre apparaît en bas avec le décompte, par exemple "3 selected".
6. Clique sur **Export** dans cette barre.
7. Le navigateur télécharge un fichier `.zip` de transcriptions JSONL, un fichier par chat.

L'export groupé utilise toujours le format **JSONL**. Le bouton **Delete** de la même barre sert uniquement à supprimer les chats sélectionnés.

## Importer un chat comme nouveau chat

Cette méthode crée un chat tout neuf à partir d'un fichier `.jsonl`. Sers-t'en pour importer des fichiers de chat enregistrés par Marinara ou exportés depuis SillyTavern.

1. Ouvre la liste des chats dans la barre latérale de gauche.
2. Choisis l'onglet de mode voulu : **CONVO**, **RP** ou **GM**. Marinara crée le chat importé dans l'onglet ouvert à cet instant.
3. Clique sur le bouton d'import situé à côté du bouton **New** en haut de la liste. Son infobulle indique **Import SillyTavern or Marinara chat JSONL**.
4. Choisis le fichier `.jsonl` dans le sélecteur de fichiers.
5. Un message "Imported N messages" doit s'afficher, et Marinara te bascule dans le nouveau chat.

Pour que le nouveau chat soit en mode Roleplay, ouvre l'onglet **RP** avant d'importer. C'est l'onglet ouvert qui fixe le mode, pas le fichier.

## Importer un chat comme nouvelle branche

Autre option : charger un fichier `.jsonl` dans un chat existant sous forme de nouvelle branche. Une branche est une copie enregistrée à part d'un chat, que tu explores de ton côté. Voir [Branches du chat](branches.md) pour en savoir plus.

1. Ouvre le chat auquel ajouter la branche.
2. Ouvre **Chat Settings** et déplie **Chat Branches**, sous **Chat Name**.
3. Clique sur **Import** dans cette section.
4. Choisis le fichier `.jsonl`.
5. Un message "Imported N messages as a new branch" doit s'afficher.

La nouvelle branche rejoint le chat ouvert. Elle reprend les personnages, le persona, la connexion et le preset de prompt du chat ouvert.

## Inclure le raisonnement dans les exports

Certains modèles enregistrent, avec la réponse, un texte de réflexion ou de raisonnement masqué. Un réglage décide si ce texte masqué part dans les fichiers d'export.

Ce réglage s'appelle **Include reasoning in exports** (inclure le raisonnement dans les exports). Tu le trouves dans **Settings** (Paramètres), onglet **Advanced**, section **Message Tools**. C'est un interrupteur, réglé sur **off** par défaut.

- Quand il est sur **off**, Marinara laisse de côté le texte de réflexion et de raisonnement enregistré, aussi bien dans les exports **JSONL** que **Text**.
- Quand il est sur **on**, Marinara ajoute ce texte de réflexion et de raisonnement masqué aux deux formats.

Ce réglage vaut pour les exports d'un seul chat comme pour les exports groupés en `.zip`.

Laisse **Include reasoning in exports** sur off avant de partager une transcription avec quelqu'un. Le raisonnement masqué peut contenir des notes que tu n'avais pas prévu de transmettre. Active-le seulement quand tu veux un enregistrement complet pour toi.

## Guides associés

- [Branches du chat](branches.md)
- [Importer depuis SillyTavern](../data/importing-from-sillytavern.md)
- [Sauvegarde et restauration](../data/backup-and-restore.md)
- [Vue d'ensemble des paramètres](../settings/settings-overview.md)
