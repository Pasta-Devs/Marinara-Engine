# Actions sur un message : modifier, supprimer, swipe, régénérer

Chaque message, le tien comme celui de l'IA, a une barre d'outils. Elle sert à modifier, supprimer, régénérer ou masquer un message, ou à créer une branche à partir de lui.

La barre d'outils apparaît quand tu touches un message sur un téléphone ou une tablette, ou quand tu passes le pointeur dessus sur un ordinateur.

## La barre d'outils du message

Les plus utilisés :

- **Edit** (modifier) change le texte du message.
- **Regenerate** (régénérer) demande au modèle une nouvelle version d'une réponse de l'IA. Chaque version s'appelle un swipe.
- **Delete** (supprimer) retire le message.

Les boutons sont des icônes. Leurs libellés sont listés ci-dessous. Certains n'apparaissent que dans des situations précises.

| Bouton | Ce qu'il fait |
| --- | --- |
| **Copy** (copier) | Copie le texte du message. |
| **Edit** | Ouvre le message en modification. |
| **Regenerate** | Crée un nouveau swipe (une autre version de la réponse). Messages de l'IA uniquement. Présent aussi sur tes messages en Roleplay, et sur tes messages Impersonate en mode Conversation. |
| **Delete** | Supprime le message. |
| **Translate** / **Hide translation** (traduire / masquer la traduction) | Traduit le message dans ta langue, puis masque la traduction. |
| **Add reaction** (ajouter une réaction) | Ouvre un sélecteur d'émojis. En mode Conversation uniquement. |
| **Hide from AI** / **Unhide from AI** (masquer à l'IA / rendre visible à l'IA) | Arrête ou reprend l'envoi de ce message au modèle. Dans un chat de groupe Roleplay, ouvre un sélecteur de personnages. |
| **Bookmark, pin or note** (ajouter un signet, épingler ou annoter) | Ajoute un signet au message, l'épingle pour qu'il reste dans le prompt au-delà de la limite d'historique (jusqu'à 10 par chat), ou ajoute une **Private note** (note privée). Le modèle ne voit jamais une note, sauf si tu actives **Show the note to the narrator character** (montrer la note au personnage narrateur), ce qui fonctionne dans les chats à un seul personnage et dans les chats de groupe à réponses individuelles. |
| **Branch from here** (créer une branche ici) | Copie le chat jusqu'à ce message dans une nouvelle branche. Absent des chats de scène. |
| **Clone from here** (cloner à partir d'ici) | Copie un chat de scène jusqu'à ce message dans un nouveau Roleplay. Chats de scène uniquement. |
| **Peek prompt** (voir le prompt) | Affiche le prompt exact de cette réponse. Dernier message de l'IA uniquement. |
| **Stored guidance** (consigne enregistrée) | Affiche la direction qui a orienté cette réponse. Seulement pour les réponses produites avec une consigne ou avec Impersonate. |
| **View model thoughts** (voir les pensées du modèle) | Ouvre le raisonnement caché du modèle. Seulement si le modèle a renvoyé un raisonnement. |
| **Show original before rewrite** / **Show rewritten version** (voir l'original avant réécriture / voir la version réécrite) | Bascule entre le texte d'origine et le texte réécrit quand un agent (une aide qui s'exécute en parallèle des réponses) a réécrit le message. |
| **Mark as new start** (marquer comme nouveau début) | Roleplay uniquement. Fait partir de ce message la mémoire que le modèle garde du chat, quand Advanced Memory (la fonctionnalité de mémoire à long terme de Marinara) est activé. Voir [Advanced Memory](../agents/memory.md). |
| **Pause speaking** / **Resume speaking** / **Restart speaking** (mettre en pause / reprendre / relancer la lecture) | Pilote l'audio parlé quand Text to Speech (une voix lit les messages à haute voix) est activé et en train de parler. |

Pour aller plus loin : [Peek Prompt](peek-prompt.md), [Branches de chat](branches.md), [Les scènes](../roleplay/scenes.md) (un chat de scène est un court Roleplay créé en branche à partir d'un chat), [Traduction des messages](../integrations/message-translation.md), [Configuration du Text to Speech (TTS)](../media/tts-setup.md), [Génération guidée et Impersonate](guided-and-impersonate.md), [notes privées](../roleplay/getting-started.md#your-private-notes).

## Modifier un message

1. Clique sur **Edit** sur le message. Le texte devient une zone modifiable.
2. Modifie le texte.
3. Clique sur **Save** (enregistrer), ou appuie sur <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> sur un Mac).
4. Pour arrêter sans enregistrer, clique sur **Cancel** (annuler) ou appuie sur <kbd>Esc</kbd>.

Deux réglages de **Settings → General → Input & Editing** (Paramètres → Général → Saisie et édition) permettent de lancer une modification plus vite. Les deux sont activés par défaut.

- **Up Arrow edits last message** (la flèche du haut modifie le dernier message) : appuie sur <kbd>Up</kbd> quand la zone de saisie est vide.
- **Double-click edits messages** (le double-clic modifie les messages) : double-clique sur un message Roleplay, ou touche-le deux fois.

## Supprimer un message

1. Clique sur **Delete** sur le message. La boîte de dialogue **Delete message** s'ouvre.
2. Choisis une option.

| Option | Ce qu'elle fait |
| --- | --- |
| **Delete only this swipe (1/3)** | Retire le swipe affiché. Visible seulement s'il y a plus d'un swipe. |
| **Delete all other swipes** | Garde le swipe affiché et retire les autres. Visible seulement s'il y a plus d'un swipe. |
| **Delete this message** | Retire le message et tous ses swipes. |
| **Delete more** | Sélectionne ce message et tous ceux qui se trouvent en dessous, puis ouvre la barre de sélection. |
| **Cancel** | Ferme la boîte de dialogue. |

Dans la barre de sélection, clique sur des messages pour les ajouter. **Select all messages above** (sélectionner tous les messages au-dessus) et **Select all messages below** (sélectionner tous les messages en dessous) étendent la sélection, **Unselect all** (tout désélectionner) la vide, et **Delete selected** (supprimer la sélection) supprime ce qui reste sélectionné. La barre indique combien de messages sont sélectionnés.

Les messages système, comme une ligne "joined the chat", se suppriment en un clic, sans boîte de dialogue.

## Les swipes : des réponses alternatives

Un swipe est une version d'une réponse de l'IA. Un même message peut en contenir plusieurs : tu compares les réponses et tu gardes celle qui te plaît. Un contrôle de swipe apparaît dès qu'un message en compte deux ou plus. Il affiche le swipe actif et le total, par exemple "2/4".

- **Previous swipe** et **Next swipe** (swipe précédent et swipe suivant) parcourent les swipes.
- La zone numérique permet de sauter à un swipe. Saisis un numéro et appuie sur <kbd>Enter</kbd>. Son libellé est **Jump to swipe 1-N**.
- Sur le swipe le plus récent, le bouton pour avancer devient **Generate next swipe** (générer le swipe suivant) et crée un nouveau swipe.

Tu ne peux pas supprimer le dernier swipe. L'application affiche "Cannot delete the last remaining swipe". Utilise plutôt **Delete this message**.

## Régénérer, continuer et relancer

Ces trois actions se ressemblent, mais font des choses différentes.

| Action | Résultat |
| --- | --- |
| **Regenerate** | Un nouveau swipe. L'original est conservé. Sur un écran tactile, l'application demande d'abord "Regenerate this message as a new swipe?". Quand une consigne est armée, le bouton affiche **Regenerate (guided)**. |
| `/continue` | Plus de texte dans le même message, sans nouveau swipe. |
| **Send** (envoyer) à vide | Une réponse toute neuve. |

### Continuer une réponse

Saisis `/continue` (ou `/cont`) dans la zone de saisie et envoie-le. Le modèle reprend là où sa dernière réponse s'est arrêtée.

```text
/continue
```

Marinara ajoute une ligne vide avant le nouveau texte. Pour l'accrocher directement au dernier caractère, désactive **Settings → General → Responses → Add a new line before /continue text** (Paramètres → Général → Réponses → ajouter une nouvelle ligne avant le texte de /continue).

### Relancer avec un Send à vide

Si le dernier message est le tien et que la zone de saisie est vide, **Send** relance au lieu d'envoyer. En Roleplay, un **Send** à vide lance aussi un nouveau tour après la réponse de l'IA. Il ne rallonge jamais la réponse précédente. Voir [Envoyer des messages et le streaming](sending-and-streaming.md#retry-without-retyping).

## Masquer un message à l'IA

Clique sur **Hide from AI** pour garder un message hors du prompt lors des tours suivants. Le message reste visible pour toi, avec une étiquette **Hidden from AI**. Clique sur **Unhide from AI** pour l'envoyer de nouveau.

Dans un chat de groupe Roleplay, **Hide from AI** ouvre un sélecteur d'avatars. Choisis l'avatar du groupe pour masquer le message à tout le monde, ou choisis un ou plusieurs personnages pour ne le masquer qu'à eux. Un marqueur en forme d'œil barré sur le message montre qui ne peut pas le voir. Dans un chat à un seul personnage, le bouton masque ou réaffiche directement.

Si tu masques un message à un seul personnage, ce personnage reçoit quand même le murmure qui s'y trouve, mais rien du reste. Masquer le message à tout le monde retire aussi les murmures. Voir [Murmures et secrets](../roleplay/getting-started.md#whispers-and-secrets).

Pour masquer une plage de messages, utilise `/hide` et `/unhide`. Voir [Commandes slash](slash-commands.md). La numérotation des messages commence à 1 au premier message.

Quand l'option **Decide who sees new messages** (décider qui voit les nouveaux messages) d'Advanced Memory est activée, les nouveaux messages d'un chat de groupe où les personnages répondent un par un sont automatiquement masqués aux personnages absents. Ton propre choix l'emporte toujours. Voir [Décider qui voit les nouveaux messages](../agents/memory.md#deciding-who-sees-new-messages).

<a id="message-display-toggles"></a>

## Interrupteurs d'affichage des messages

Ils se trouvent dans **Settings → Advanced → Message Tools** (Paramètres → Avancé → Outils de message).

| Interrupteur | Par défaut | Ce qu'il affiche |
| --- | --- | --- |
| **Show message numbers** (afficher les numéros de message) | Désactivé | Un numéro sur chaque message, les mêmes numéros que ceux qu'utilisent `/goto`, `/hide` et `/unhide`. |
| **Show token usage on messages** (afficher l'usage des tokens sur les messages) | Désactivé | Les tokens du prompt et de la réponse pour chaque réponse de l'IA (les tokens sont de petits morceaux de texte que le modèle compte), plus les accès au cache et le temps de réponse quand ils sont disponibles. |
| **Show model name on messages** (afficher le nom du modèle sur les messages) | Désactivé | Le modèle qui a écrit chaque réponse. |
| **Show "older messages not sent" note** (afficher la note "anciens messages non envoyés") | Activé | Une note sous une réponse, comme "1109 older messages not sent", quand des messages plus anciens ne tenaient pas dans le prompt. Les notes sur une réponse coupée ou vide s'affichent toujours. |
