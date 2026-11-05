# Miroir de messages Discord

Le miroir de messages Discord recopie les messages de ton chat dans un salon Discord, au fil de la discussion. Il fonctionne dans les modes Conversation, Roleplay et Game.

C'est un relais à sens unique. Marinara envoie les messages, et Discord ne peut rien renvoyer : ce n'est donc pas un bot bidirectionnel. Le miroir s'appuie sur un webhook Discord, une URL spéciale qui autorise une application à publier des messages dans un salon Discord. Le miroir se règle chat par chat. Chaque chat a sa propre URL de webhook, et les autres chats restent inactifs tant que tu n'as pas collé une URL dans chacun d'eux.

## Créer une URL de webhook Discord

Le webhook se crée dans Discord, pas dans Marinara. Il te faut la permission de gérer le salon Discord visé.

1. Ouvre le serveur Discord et choisis le salon où les messages doivent apparaître.
2. Ouvre les réglages de ce salon, puis **Integrations**, puis **Webhooks**.
3. Crée un nouveau webhook et copie son URL de webhook.

Une URL de webhook Discord ressemble à ceci :

```text
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Garde cette URL privée. Quiconque la possède peut publier des messages dans le salon Discord.

## Activer le miroir

Le champ du webhook se trouve dans les réglages de chaque chat, dans **Connected Chats** (chats connectés). Il s'intitule **Discord Mirror** (miroir Discord), et son texte indicatif affiche `https://discord.com/api/webhooks/...`.

1. Ouvre le chat à mettre en miroir.
2. Ouvre **Chat Settings** (réglages du chat).
3. Repère la section **Connected Chats**.
4. Colle l'URL de webhook dans le champ de saisie, vers le bas de cette section.

Le miroir est maintenant actif pour ce chat. Pour le désactiver, vide le champ.

Si ça n'a pas marché : une URL qui n'est pas un webhook Discord valide affiche le texte rouge "Invalid webhook URL format" sous le champ. Corrige l'URL et le miroir s'enregistre. Marinara vérifie de nouveau l'URL côté serveur au moment de l'enregistrement.

L'URL du webhook reste sur cette installation de Marinara. Les exports de chat, les profils de réglages exportés et les fichiers **Export Profile** (exporter le profil) la laissent de côté, et l'import de l'un d'eux n'active jamais de miroir. Pour recopier un chat que tu as déplacé vers une autre installation, colle de nouveau l'URL là-bas. Un profil de réglages enregistré sur cette installation règle toujours ton miroir quand tu l'appliques.

## Ce qui part vers Discord

Marinara recopie tes messages ainsi que les réponses de l'IA à mesure qu'elles sont générées.

- Nom de l'expéditeur : tes messages portent le nom du persona actif, c'est-à-dire le personnage que tu incarnes. Les messages de l'IA portent le nom du personnage.
- En Game Mode, les tours joués par les membres de l'équipe ou par les PNJ (personnages non-joueurs) partent sous le nom "Party". La narration de l'histoire part sous "Narrator". Si la partie utilise l'option **Character GM**, les réponses du GM (le maître du jeu) portent le nom de ce personnage.
- Aucune image n'est envoyée. Discord affiche uniquement le nom de l'expéditeur et le texte.
- Messages longs : Discord plafonne chaque message à 2 000 caractères. Au-delà de 1 997 caractères, le message est raccourci et la copie envoyée se termine par "...".
- Les mentions du type @everyone ou @here présentes dans le texte ne notifient personne dans le salon Discord.

## Ce qui ne part pas

- Les réponses régénérées et les swipes ne repartent pas vers Discord. Un swipe est une autre réponse conservée sur le même message. Seule la première réponse de chaque tour est envoyée.
- Les messages écrits par la fonction Impersonate ne sont pas recopiés. Impersonate, c'est la fonction qui laisse l'IA écrire un message à ta place.
- Un envoi qui échoue n'est pas renvoyé. Un envoi auquel Discord répond par une limitation de débit (429) n'est pas renvoyé non plus ; voir plus bas. Un envoi en échec n'affiche aucune erreur dans le chat. Les échecs autres qu'une limitation de débit ne sont notés que sur le serveur.

## Limitation du débit

Discord limite la vitesse de publication d'une application. Marinara envoie au plus un message toutes les 1,2 seconde environ par webhook, soit à peu près 50 messages par minute. Les messages en trop attendent dans une file et partent dans l'ordre. Si Discord répond à un envoi par un code 429 (demande de ralentir), ce message n'est pas renvoyé. Marinara attend le délai Retry-After indiqué par Discord, puis continue avec le message suivant de la file.

## Guides associés

- [Connecter une Conversation à un Roleplay ou une partie](../chats/connected-chats.md)
