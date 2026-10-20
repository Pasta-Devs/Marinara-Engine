# Actions sur un message : modifier, supprimer, swipe, régénérer

Ce guide explique ce que tu peux faire avec un message pris isolément dans un chat (une conversation enregistrée). Au programme : la barre d'outils du message, la modification et la suppression d'un message, et le fonctionnement des swipes (réponses alternatives) et de la régénération. Les interrupteurs d'affichage qui montrent le nombre de tokens et les numéros de message sont aussi de la partie.

Chaque message de Marinara Engine, que tu l'aies écrit toi-même ou que l'IA l'ait produit, possède une petite barre d'outils. Elle apparaît quand tu survoles le message sur un ordinateur, ou quand tu touches le message sur un téléphone ou une tablette.

## La barre d'outils du message

Les boutons ci-dessous apparaissent sur les messages. Certains ne se montrent que dans des situations précises, indiquées dans le tableau. Chaque bouton a une infobulle qui reprend l'étiquette donnée ici.

| Bouton | Ce qu'il fait | Quand il apparaît |
| --- | --- | --- |
| **Copy** (copier) | Copie le texte du message. L'icône se change un instant en coche. | Toujours |
| **Add reaction** (ajouter une réaction) | Ouvre un sélecteur d'émojis et active ou retire ta réaction sur le message. | Mode Conversation uniquement |
| **Translate** / **Hide translation** (traduire / masquer la traduction) | Traduit le message dans ta langue, puis masque à nouveau la traduction. | Toujours |
| **Edit** (modifier) | Ouvre le message en modification. Voir plus bas. | Toujours |
| **Regenerate** (régénérer) | Crée une nouvelle réponse alternative, un swipe. Voir plus bas. | Messages de l'IA. En mode Roleplay, aussi sur tes messages. En mode Conversation, aussi sur tes messages produits par Impersonate |
| **Show original before rewrite** / **Show rewritten version** (voir l'original avant réécriture / voir la version réécrite) | Bascule entre le texte d'origine et le texte réécrit. Les deux versions restent disponibles : compare-les, puis garde celle que tu préfères. | Seulement après la réécriture du message par un agent |
| **Hide from AI** / **Unhide from AI** (masquer à l'IA / rendre visible à l'IA) | Arrête ou reprend l'envoi de ce message à l'IA lors des tours suivants. Dans un chat de groupe en mode Roleplay, ouvre un sélecteur de personnages. | Toujours |
| **Peek prompt** (voir le prompt) | Affiche le prompt exact que l'IA a reçu pour cette réponse. Le prompt, c'est le texte que Marinara envoie à l'IA. | Seulement sur le dernier message de l'IA |
| **Stored guidance** (consigne enregistrée) | Affiche la direction qui a orienté cette réponse. | Seulement si la réponse a suivi une direction guidée ou vient d'Impersonate |
| **Branch from here** (créer une branche ici) | Copie le chat jusqu'à ce message dans une nouvelle branche. | Toujours |
| **View model thoughts** (voir les pensées du modèle) | Ouvre le texte de raisonnement caché du modèle. | Seulement si le modèle a renvoyé un raisonnement |
| **Delete** (supprimer) | Supprime le message. Voir plus bas. | Toujours |
| **Pause speaking** / **Resume speaking** / **Restart speaking** (mettre en pause / reprendre / relancer la lecture) | Pilote l'audio parlé d'un message. | Seulement quand Text to Speech est actif et en train de parler |

Pour la visionneuse **Peek prompt**, voir [Peek Prompt](peek-prompt.md). Pour **Branch from here**, voir [Branches de chat](branches.md). Pour **Translate**, voir [Traduction des messages](../integrations/message-translation.md). Pour les commandes de lecture audio, voir [Configuration du Text to Speech (TTS)](../media/tts-setup.md). Pour les directions guidées, **Stored guidance** et Impersonate, voir [Génération guidée et Impersonate](guided-and-impersonate.md).

## Modifier un message

Le texte de n'importe quel message se modifie, le tien comme celui de l'IA.

1. Clique sur **Edit** sur le message. Le texte se change en zone modifiable.
2. Modifie le texte.
3. Clique sur **Save** (enregistrer), ou appuie sur Ctrl et Enter en même temps (Cmd et Enter sur un Mac). L'infobulle du bouton indique **Save (Cmd+Enter)**.
4. Pour arrêter sans enregistrer, clique sur **Cancel** (annuler) ou appuie sur la touche Esc. L'infobulle du bouton indique **Cancel (Esc)**.

Deux réglages offrent des raccourcis pour passer en modification. Les deux se trouvent dans **Settings** (Paramètres), onglet **General**, section **Input & Editing**.

- **Up Arrow edits last message** (la flèche du haut modifie le dernier message, actif par défaut) : appuie sur la touche Up Arrow quand la zone de saisie est vide. Le message le plus récent s'ouvre en modification.
- **Double-click edits messages** (le double-clic modifie les messages, actif par défaut) : double-clique ou appuie deux fois sur un message en mode Roleplay pour l'ouvrir en modification.

## Supprimer un message

Quand tu supprimes un message, une boîte de dialogue intitulée **How to proceed?** apparaît. Les options de suppression sont les suivantes :

- **Delete only this swipe (1/3)** : retire uniquement le swipe que tu as sous les yeux. Cette option n'apparaît que si le message compte plusieurs swipes. Les chiffres indiquent quel swipe est actif et combien il y en a.
- **Delete this message** : retire le message entier et tous ses swipes.
- **Delete more** : sélectionne ce message et tous ceux en dessous, puis active la sélection multiple pour te laisser ajuster la sélection avant de supprimer.
- **Cancel** : ferme la boîte de dialogue sans rien supprimer.

Les messages système, par exemple une ligne "joined the chat", ont un simple bouton de suppression, sans boîte de dialogue.

## Les swipes : des réponses alternatives

Un swipe est une version d'une réponse de l'IA. Un même message peut en contenir plusieurs : tu compares alors différentes réponses au même tour et tu gardes celle qui te plaît.

Un contrôle de swipe apparaît sur le message dès qu'il en compte deux ou plus. Il affiche le swipe actif et le total, par exemple "2/4", avec ces contrôles :

- **Previous swipe** et **Next swipe** (swipe précédent et swipe suivant) : recule ou avance d'un swipe.
- Une zone numérique : saisis un numéro de swipe et appuie sur Enter pour y sauter directement. Son infobulle indique **Jump to swipe 1-N**, où N est le total.
- **Generate next swipe** (générer le swipe suivant) : quand tu es sur le swipe le plus récent, le bouton "suivant" se change en celui-ci et crée un swipe tout neuf.

Le dernier swipe d'un message ne peut pas être supprimé. Si tu essaies, l'application affiche "Cannot delete the last remaining swipe". Passe plutôt par **Delete this message** pour retirer le message entier.

## Régénérer, continuer et relancer

Ces trois actions se ressemblent, mais leurs effets diffèrent. Choisis celle qui correspond à ton besoin.

**Regenerate** crée un nouveau swipe. Clique sur **Regenerate** sur un message de l'IA pour générer une autre version de cette réponse. Le swipe d'origine est conservé. Sur un écran tactile, l'application demande d'abord "Regenerate this message as a new swipe?", pour éviter les déclenchements involontaires. Quand une direction guidée est armée, le bouton affiche **Regenerate (guided)**.

La commande **/continue** prolonge le même message. Saisis `/continue` (ou sa forme courte `/cont`) dans la zone de saisie et envoie-la. L'IA reprend là où sa dernière réponse s'est arrêtée et ajoute du texte à ce même message, au lieu de créer un swipe.

Par défaut, Marinara insère une ligne vide avant le texte ajouté. Pour que les suites s'accrochent directement au dernier caractère de la réponse précédente, désactive **Settings → General → Responses → Add a new line before /continue text**. Marinara demande alors au modèle de reprendre exactement à l'endroit de la coupure, sans séparateur.

```
/continue
```

La relance par envoi à vide démarre une réponse toute neuve. Si le dernier message du chat est le tien et que la zone de saisie est vide, le bouton **Send** (envoyer) relance la génération au lieu d'envoyer. Son apparence ne change pas. Clique dessus, ou appuie sur Enter, pour obtenir une réponse sans retaper le message. En mode Roleplay, un **Send** à vide peut aussi inviter l'IA à poursuivre la scène par un nouveau tour. À ne pas confondre avec **/continue** : l'envoi à vide crée toujours une nouvelle réponse, tandis que **/continue** rallonge celle qui existe déjà.

## Masquer un message à l'IA

Le contexte de l'IA, c'est l'ensemble des messages que l'application envoie à l'IA à chaque tour. Clique sur **Hide from AI** pour tenir un message hors de ce contexte lors des tours suivants. Le message reste visible pour toi et porte une étiquette **Hidden from AI**. Clique sur **Unhide from AI** pour le renvoyer.

Dans un chat de groupe en mode Roleplay comptant plusieurs personnages, **Hide from AI** ouvre un sélecteur d'avatars compact. Sélectionne l'avatar du groupe pour masquer le message à tout le monde, ou sélectionne un ou plusieurs avatars de personnages pour ne le masquer qu'à ces personnages. Sélectionner tout le monde efface les sélections individuelles, et sélectionner un personnage précis désactive l'option "tout le monde". Le marqueur en forme d'œil barré sur le message montre les avatars des personnages qui ne peuvent pas le voir. Dans un chat à un seul personnage, le bouton masque ou réaffiche le message directement.

Un murmure contenu dans un message parvient quand même à son destinataire si tu masques le message uniquement à ce personnage. Il reçoit le murmure, mais rien du reste du message. Masquer le message à tout le monde retire aussi ses murmures. Consulte [Murmures et secrets](../roleplay/getting-started.md#whispers-and-secrets).

Tu peux aussi masquer des messages avec `/hide [range] [name (optional)]`, par exemple `/hide 3-8`. Dans Roleplay, `/hide 3-8 Maukie` les masque uniquement pour Maukie ; sans nom, ils sont masqués pour tout le monde. `/unhide [range]` rétablit les messages masqués globalement. Pour annuler le masquage par personnage, utilise le sélecteur d'avatars dans un chat Roleplay de groupe, ou l'action **Unhide from AI** du message dans un chat Roleplay avec un seul personnage. La numérotation des messages commence à 1, à partir du premier message du chat. Consulte la [Référence des commandes slash](slash-commands.md) pour les formats et les exemples.

Quand l'option **Decide who sees new messages** (décider qui voit les nouveaux messages) d'Advanced Memory est activée, les nouveaux messages d'un chat de groupe où les personnages répondent l'un après l'autre sont automatiquement masqués aux personnages absents, avec le même marqueur. Si tu modifies toi-même le choix pour un message, c'est toujours ton choix qui l'emporte ; consulte [Décider qui voit les nouveaux messages](../agents/memory.md#deciding-who-sees-new-messages).

## Interrupteurs d'affichage des messages

Deux interrupteurs modifient le niveau de détail affiché sur les messages. Les deux se trouvent dans **Settings**, onglet **Advanced**, section **Message Tools**. Les deux sont désactivés par défaut.

- **Show message numbers** (afficher les numéros de message) : affiche un numéro sur chaque message. La numérotation commence à 1 au premier message du chat. Ce sont les numéros qu'utilisent les commandes `/goto`, `/hide` et `/unhide`. Active ce réglage quand tu as besoin de retrouver le numéro d'un message.
- **Show token usage on messages** (afficher l'usage des tokens sur les messages) : ajoute aux réponses de l'IA un décompte de tokens message par message. Un token est un petit morceau de texte que l'IA lit et écrit. Le décompte indique les tokens du prompt et ceux de la réponse. Quand l'information existe, il montre aussi les accès au cache et le temps qu'a pris la réponse.

Un réglage voisin, dans la même section **Message Tools**, **Show model name on messages** (afficher le nom du modèle sur les messages), ajoute le nom du modèle d'IA qui a écrit chaque réponse. Lui aussi est désactivé par défaut.

Quand des messages plus anciens ont dû être laissés hors du prompt pour qu'il tienne, une courte note sous la réponse indique combien, par exemple "1109 older messages not sent". Pour masquer cette note sous la réponse, désactive **Show "older messages not sent" note** (afficher la note "anciens messages non envoyés") dans la même section. Elle peut encore apparaître quand tu ouvres Checkup. Ce réglage est activé par défaut. Les notes sur une réponse coupée ou revenue vide s'affichent toujours.

## Guides associés

- [Envoyer des messages et streaming](sending-and-streaming.md)
- [Génération guidée et Impersonate](guided-and-impersonate.md)
- [Peek Prompt](peek-prompt.md)
- [Branches de chat](branches.md)
- [Configuration du Text to Speech (TTS)](../media/tts-setup.md)
- [Traduction des messages](../integrations/message-translation.md)
- [Vue d'ensemble des paramètres](../settings/settings-overview.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
