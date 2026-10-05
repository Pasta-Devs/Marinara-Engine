# Connecter un chat Conversation à un chat Roleplay ou Game

Ce guide explique comment relier un chat Conversation à un chat Roleplay ou Game pour que les deux partagent le contexte. Au programme aussi : **Cross-Chat Awareness** (conscience entre chats), les balises spéciales qui font passer des informations d'un côté à l'autre du lien, et le passage d'un chat lié à l'autre.

Marinara Engine (appelé Marinara par la suite) dispose de deux fonctionnalités distinctes qui permettent aux chats de se connaître. L'une est automatique. L'autre est un lien explicite, un à un, que tu crées toi-même. Ce guide les traite séparément, car elles ne fonctionnent pas de la même façon.

## Ce que font les Connected Chats

**Connected Chats** (chats connectés) relie un chat Conversation à un chat Roleplay ou Game. Le lien est un à un. Chaque chat ne peut être connecté qu'à un seul autre chat à la fois.

Une fois le lien créé, le côté Conversation lit automatiquement les messages récents du chat d'histoire lié. Il les reprend dans son propre contexte à chaque tour. C'est le sens automatique du lien.

Le chat d'histoire (le Roleplay ou le Game) ne lit pas automatiquement les messages de la Conversation en retour. Pour transmettre des informations dans l'autre sens, un personnage utilise des balises spéciales. Elles sont décrites plus bas.

Un usage courant : tu joues un Roleplay ou un Game immersif dans un chat, et tu tiens en parallèle un chat Conversation décontracté, hors personnage (OOC), en message privé. Le chat OOC reste au courant de l'histoire, ce qui te permet d'en parler pendant qu'elle se déroule.

## Cross-Chat Awareness n'est pas un lien

Ces deux fonctionnalités se confondent facilement. Lis cette section avant de configurer quoi que ce soit.

**Cross-Chat Awareness** fonctionne tout seul. C'est un réglage du mode Conversation. Quand un personnage est présent dans plusieurs chats Conversation, il peut se souvenir de ce qui s'est passé dans ces autres chats et y faire référence. Aucun lien à créer à la main. Le réglage est actif par défaut.

Tu le trouves dans la section **Cross-Chat Awareness** de **Chat Settings** (réglages du chat). Son texte d'aide indique : "Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context." Marinara rapproche ces chats frères par personnage partagé, pas par utilisateur partagé.

Un lien **Connected Chats**, c'est autre chose. Tu le crées volontairement. Il joint exactement un chat Conversation à un chat Roleplay ou Game. Il transporte le contexte de l'histoire et les balises spéciales décrites ci-dessous.

En résumé : **Cross-Chat Awareness** relie automatiquement un personnage à travers ses propres chats Conversation. Un lien **Connected Chats** joint à la main un chat Conversation à un chat d'histoire.

## Relier une Conversation à un chat Roleplay ou Game

Le lien se crée depuis le chat Conversation, ou depuis un chat Game. Voici la marche à suivre pour partir du côté Conversation :

1. Ouvre le chat Conversation que tu veux relier.
2. Ouvre **Chat Settings** (réglages du chat) avec son bouton dans le chat. Il se trouve en haut à droite, sauf si tu l'as déplacé.
3. Repère la section **Connected Chats**.
4. Clique sur **Link to Roleplay or Game** (relier à un Roleplay ou un Game).
5. Cherche le chat Roleplay ou Game dans le sélecteur, puis clique dessus.

Le nom du chat lié et son mode s'affichent alors dans la section **Connected Chats**. Un petit bouton de déliaison se trouve juste à côté.

Pour partir plutôt d'un chat Game, ouvre la fenêtre **Chat Settings** de ce chat, repère la section **Connected Chats** et clique sur **Link to Conversation** (relier à une Conversation). Choisis ensuite la Conversation.

Un chat Roleplay n'a pas son propre bouton de liaison. Il affiche le lien une fois celui-ci créé, mais c'est du côté Conversation qu'il faut le créer.

Seuls les chats qui ne sont pas déjà liés apparaissent dans le sélecteur. Un chat ne porte qu'un seul lien à la fois.

### Supprimer un lien

Pour supprimer un lien, ouvre **Chat Settings**, repère la section **Connected Chats** et clique sur le bouton de déliaison (son infobulle indique **Disconnect**). La déconnexion efface aussi les influences en attente et les notes enregistrées rattachées à ce lien.

Supprimer un chat le déconnecte également du chat auquel il était lié.

## Faire passer des informations dans le lien

La Conversation lit le chat d'histoire automatiquement. Les autres sens passent par des balises. Ces balises apparaissent dans les messages d'un personnage. C'est l'IA qui les écrit. Normalement, tu n'as pas à les saisir toi-même, mais savoir à quoi elles servent aide à comprendre la passerelle.

Si tu as besoin d'y faire référence, écris-les telles quelles. Chacune est présentée ici en code pour s'afficher exactement.

- `<influence>` envoie une orientation ponctuelle de la Conversation vers le chat d'histoire lié. Elle agit sur le tout prochain tour du chat lié, puis elle est consommée.
- `<note>` enregistre un fait durable de la Conversation dans le chat d'histoire lié. Il reste dans le prompt (le texte que Marinara envoie à l'IA) du chat d'histoire à chaque tour, jusqu'à ce que tu l'effaces.
- `<ooc>` permet à un personnage Roleplay de sortir de l'histoire et de répondre directement à la Conversation liée. Marinara publie ce texte dans le chat de messages privés lié.

Un personnage Conversation peut donc orienter discrètement l'histoire ou l'informer avec `<influence>` et `<note>`. Un personnage Roleplay peut répondre à la Conversation avec `<ooc>`.

## Conversation Notes

Quand un personnage Conversation enregistre une `<note>` durable, elle apparaît du côté histoire. Le chat Roleplay ou Game reçoit une section **Conversation Notes** (notes de la Conversation) dans sa fenêtre **Chat Settings**.

Cette section liste toutes les notes enregistrées. Chaque note a son bouton de suppression. Pour toutes les supprimer d'un coup, utilise le bouton **Clear all notes** (tout effacer). Marinara demande confirmation avant d'effacer, et l'opération est irréversible.

Si aucun personnage n'a encore enregistré de note, la section explique que les notes encadrées par une balise `<note>` apparaîtront ici une fois enregistrées.

<a id="switching-between-connected-chats"></a>

## Passer d'un chat connecté à l'autre

Quand un chat a un chat lié, un bouton déplaçable **Connected chat**, avec une double flèche, apparaît en haut à droite. Tu peux le déplacer sur un ordinateur ou un téléphone. Clique ou appuie dessus pour ouvrir une petite fenêtre, puis choisis **Switch to** suivi du nom de l'autre chat.

Cette action ouvre directement le chat connecté, sans avoir à le chercher dans la liste. Le bouton apparaît des deux côtés du lien, en Conversation comme en Roleplay.

Si tu préfères le garder dans Chat Settings, choisis **Put back in Chat Settings** dans la fenêtre. Il devient la section **Connected chat**. Le bouton de détachement de cette section lui redonne une fenêtre séparée.

## Les autres réglages de cette section

La section **Connected Chats** contient aussi deux réglages qui appartiennent à d'autres fonctionnalités. Ils s'affichent ici par commodité.

- Un champ **Discord webhook URL**. Il n'a pas d'étiquette visible, seulement un texte indicatif qui commence par `https://discord.com/api/webhooks/`. Colle ici l'URL d'un webhook Discord pour recopier les messages du chat dans un salon Discord. Cela fait partie de la fonctionnalité de miroir de messages Discord, qui a son propre guide.
- Un interrupteur **Allow Noodle references** (autoriser les références Noodle), désactivé par défaut. Il autorise la timeline Noodle intégrée à récupérer les messages récents de ce chat. Noodle a son propre guide.

Du côté Roleplay, tu vois aussi un interrupteur **Allow character DMs** (autoriser les messages privés des personnages), désactivé par défaut. Quand il est actif, un personnage Roleplay peut t'ouvrir un nouveau message privé en mode Conversation depuis l'histoire. Cela fonctionne même si aucune Conversation n'est encore liée.

## Guides associés

- [Mode Conversation : premiers pas](../conversation/getting-started.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
