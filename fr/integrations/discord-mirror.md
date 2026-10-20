# Miroir de messages Discord

Ce guide explique le miroir de messages Discord de Marinara Engine. Le miroir recopie les messages du chat dans un salon Discord, dans un seul sens, au fil de la discussion. Il fonctionne dans les modes Conversation, Roleplay et Game.

## À quoi sert le miroir

Le miroir de messages Discord est un relais à sens unique. Marinara envoie les messages vers un salon Discord. Discord ne peut rien renvoyer vers Marinara. Ce n'est donc pas un bot Discord bidirectionnel.

Le miroir s'appuie sur un webhook Discord. Un webhook est une URL spéciale qui autorise une application à publier des messages dans un salon Discord.

Le miroir se règle chat par chat. Chaque chat a sa propre URL de webhook. Pour l'activer sur un chat, colle une URL dedans. Les autres chats restent inactifs tant que tu n'as pas collé une URL dans chacun d'eux.

## Créer une URL de webhook Discord

Le webhook se crée dans Discord, pas dans Marinara. Il te faut la permission de gérer le salon Discord visé.

1. Ouvre le serveur Discord et choisis le salon où les messages doivent apparaître.
2. Ouvre les réglages de ce salon, puis **Integrations**, puis **Webhooks**.
3. Crée un nouveau webhook et copie son URL de webhook.

Une URL de webhook Discord ressemble à ceci :

```
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Garde cette URL privée. Quiconque la possède peut publier des messages dans le salon Discord.

## Activer le miroir

Le réglage du webhook se trouve dans les réglages de chaque chat, à l'intérieur de la section **Connected Chats** (chats connectés). Le champ de saisie s'intitule **Discord Mirror** (miroir Discord), et son texte indicatif affiche `https://discord.com/api/webhooks/...`.

1. Ouvre le chat à mettre en miroir.
2. Ouvre la section **Chat Settings** (réglages du chat).
3. Repère la section **Connected Chats**.
4. Colle l'URL de webhook dans le champ de saisie, vers le bas de cette section.

Le miroir est actif pour ce chat. Pour le désactiver, vide le champ de saisie.

Si l'URL n'est pas un webhook Discord valide, le texte rouge "Invalid webhook URL format" s'affiche sous le champ. Corrige l'URL et le miroir s'enregistre. Marinara vérifie aussi l'URL côté serveur au moment de l'enregistrement.

L'URL du webhook reste sur cette installation de Marinara. Les exports de chat, les profils de réglages exportés et les fichiers **Export Profile** (exporter le profil) la laissent de côté, et l'import de l'un d'eux n'active jamais de miroir. Pour recopier un chat que tu as déplacé vers une autre installation, colle de nouveau l'URL là-bas. Un profil de réglages enregistré sur cette installation règle toujours ton miroir quand tu l'appliques.

## Ce qui part vers Discord

Marinara recopie tes messages ainsi que les réponses de l'IA à mesure qu'elles sont générées.

- Nom de l'expéditeur : tes messages portent le nom du persona actif, c'est-à-dire le personnage que tu incarnes. Les messages de l'IA portent le nom du personnage.
- En Game Mode, la narration de l'histoire part sous le nom "Narrator". Les tours joués par les membres de l'équipe ou par les PNJ (personnages non-joueurs) partent sous le nom "Party". Si la partie utilise l'option **Character GM**, les réponses du Game Master (le maître du jeu) portent le nom de ce personnage.
- Aucune image n'est envoyée. Discord affiche uniquement le nom de l'expéditeur et le texte.
- Messages longs : Discord plafonne chaque message à 2000 caractères. Au-delà de 1997 caractères, le message est raccourci et la copie envoyée se termine par "...".
- Les mentions du type @everyone ou @here présentes dans le texte ne notifient personne dans le salon Discord.

## Ce qui ne part pas

- Les réponses régénérées et les swipes, ces réponses alternatives, ne repartent pas vers Discord. Seule la première réponse de chaque tour est envoyée.
- Les messages écrits par la fonction Impersonate ne sont pas recopiés. Impersonate, c'est la fonction qui laisse l'IA écrire un message à ta place.
- Si un envoi vers Discord échoue, Marinara n'affiche pas d'erreur et ne réessaie pas. L'échec est seulement noté dans le log du serveur.

## Limitation du débit

Discord limite la vitesse de publication d'une application. Marinara envoie au plus un message toutes les 1,2 seconde environ par webhook, soit à peu près 50 messages par minute. Les messages en trop attendent dans une file et partent dans l'ordre. Si Discord demande à Marinara de ralentir, Marinara patiente, puis reprend les envois.

## Guides associés

- [Connecter une Conversation à un Roleplay ou une partie](../chats/connected-chats.md)
