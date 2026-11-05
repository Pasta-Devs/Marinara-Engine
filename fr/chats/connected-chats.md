# Connecter un chat Conversation à un chat Roleplay ou Game

Relie un chat Conversation à un chat Roleplay ou Game pour que les deux partagent le contexte. Un usage courant : tu mènes une histoire dans un chat et tu en parles hors personnage (OOC) dans un chat Conversation qui reste au courant de l'histoire.

La section **Connected Chats** (chats connectés) de **Chat Settings** (réglages du chat) regroupe deux fonctionnalités différentes. Un lien **Connected Chats** est un à un, et tu le crées à la main. **Cross-Chat Awareness** (conscience entre chats) est un interrupteur qui fonctionne tout seul et permet à un personnage de se souvenir de ses autres chats Conversation.

## Fonctionnement d'un lien

Un lien joint un chat Conversation à un chat Roleplay ou Game. Chaque chat ne peut avoir qu'un seul lien à la fois.

- La Conversation lit automatiquement les messages récents du chat d'histoire lié, à chaque tour.
- Le chat d'histoire ne lit pas la Conversation en retour. Les personnages font passer des informations dans l'autre sens avec des balises, décrites plus bas.

## Relier une Conversation à un chat Roleplay ou Game

Avant de commencer : prépare les deux chats. Voir [Gérer ta liste de chats](managing-chats.md).

1. Ouvre le chat Conversation, puis **Chat Settings**. Voir [Chat Settings](chat-settings.md).
2. Ouvre la section **Connected Chats**.
3. Clique sur **Link to Roleplay or Game** (relier à un Roleplay ou un Game).
4. Cherche le chat dans le sélecteur, puis clique dessus.

La section affiche alors le nom et le mode du chat lié, avec un petit bouton de déliaison.

Si ça n'a pas marché : seuls les chats qui ne sont pas déjà liés apparaissent dans le sélecteur. Délie d'abord l'autre chat.

Pour partir d'un chat Game, ouvre **Chat Settings → Connected Chats** dans ce chat, clique sur **Link to Conversation** (relier à une Conversation) et choisis la Conversation. Un chat Roleplay n'a pas de bouton de liaison. Il affiche le lien une fois celui-ci créé : crée-le donc du côté Conversation.

### Supprimer un lien

Ouvre **Chat Settings → Connected Chats** et clique sur le bouton de déliaison (libellé **Disconnect**). Cela efface aussi les influences en attente et les notes enregistrées rattachées au lien. Supprimer un chat le déconnecte également.

## Cross-Chat Awareness

**Cross-Chat Awareness** est un interrupteur de la section **Connected Chats** d'un chat Conversation. Sa description indique "Characters know what happens in their other chats". Quand un personnage est présent dans plusieurs chats Conversation, il peut se souvenir de ce qui s'est passé dans les autres et en parler. Marinara rapproche ces chats par personnage partagé, pas par utilisateur partagé. L'interrupteur est activé par défaut et ne demande aucun lien.

## Faire passer des informations dans le lien

Les personnages écrivent ces balises dans leurs messages. Tu n'as rien à faire. C'est ainsi que les deux chats communiquent.

| Balise | Ce qu'elle fait |
| --- | --- |
| `<influence>` | Une orientation ponctuelle de la Conversation vers le chat d'histoire lié. Elle agit sur le prochain tour du chat lié, puis elle est consommée. |
| `<note>` | Enregistre un fait durable de la Conversation dans le chat d'histoire. Il reste dans le prompt (le texte que Marinara envoie à l'IA) du chat d'histoire à chaque tour, jusqu'à ce que tu l'effaces. |
| `<ooc>` | Permet à un personnage Roleplay de sortir de l'histoire et de répondre à la Conversation liée. Marinara y publie le texte. |

### Conversation Notes

Les faits enregistrés avec `<note>` apparaissent dans une section **Conversation Notes** (notes de la Conversation) de la fenêtre **Chat Settings** du chat d'histoire. Chaque note a son bouton de suppression. **Clear all notes** (tout effacer) les supprime toutes après ta confirmation, et l'opération est irréversible. Sans note, la section indique que les notes encadrées par une balise `<note>` apparaîtront à cet endroit.

<a id="switching-between-connected-chats"></a>

## Passer d'un chat connecté à l'autre

Une fois le lien en place, un bouton **Connected chat** (chat connecté), avec une icône en double flèche, apparaît dans les deux chats. Sur ordinateur, il se trouve d'abord en haut à droite, et tu peux le faire glisser. Sur téléphone, ouvre le menu à trois points **Chat tools** (outils du chat), ouvre **Connected chat**, puis choisis **Switch to** (passer à) et le nom de l'autre chat.

Pour garder la commande dans Chat Settings, choisis **Put back in Chat Settings** (remettre dans Chat Settings). Elle apparaît alors comme une section **Connected chat** à part entière. Utilise le bouton de détachement de cette section pour en refaire une fenêtre séparée.

## Les autres réglages de cette section

- **Discord webhook URL** : un champ sans étiquette, avec seulement un texte indicatif qui commence par `https://discord.com/api/webhooks/`. Colle l'URL d'un webhook pour recopier les messages du chat dans un salon Discord. Cette fonctionnalité a son propre guide.
- **Allow Noodle references** (autoriser les références Noodle) : permet à la timeline Noodle de récupérer les messages récents de ce chat. Désactivé par défaut, ce réglage n'apparaît que si Noodle est installé.
- **Allow character DMs** (autoriser les messages privés des personnages), côté Roleplay : permet à un personnage Roleplay de t'ouvrir un nouveau message privé en mode Conversation depuis l'histoire. Désactivé par défaut, ce réglage fonctionne même sans lien.
