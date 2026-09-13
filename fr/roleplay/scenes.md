# Les scènes : créer une branche de roleplay

Ce guide explique les scènes dans Marinara Engine. Une scène est un roleplay court et autonome, qui part d'un chat **Conversation** (une conversation enregistrée en mode messagerie). Au programme : comment en lancer une, comment la jouer, puis comment la terminer, l'abandonner, la cloner ou la convertir.

## Ce qu'est une scène

Une scène est un roleplay parallèle qui naît d'un chat **Conversation**. Le mode **Conversation**, c'est le mode messagerie, en tête-à-tête. Une scène te permet, avec un personnage, de sortir de ce chat le temps d'un moment de roleplay bien précis. Ce moment peut être un flash-back, un rendez-vous ou un combat. Le fil principal, lui, n'est pas perdu.

Chaque scène est un chat de roleplay à part entière. Elle a son propre arrière-plan, ses propres personnages sur le plateau (la zone de scène) et son propre message d'accueil. Au démarrage de la scène, c'est le personnage ou l'histoire qui écrit la mise en place à ta place.

Une scène est temporaire par nature. Tant qu'elle est ouverte, le chat **Conversation** d'origine affiche une petite carte qui annonce **A scene is in progress**. Cette carte contient un bouton **Go to Scene** (aller à la scène) qui t'emmène directement dans la scène active.

À la fin, c'est toi qui décides du sort de la scène. Tu peux enregistrer un résumé dans la conversation, jeter la scène, ou la garder comme roleplay permanent à part entière. Ces choix sont détaillés plus bas.

## Lancer une scène

Une scène se lance depuis un chat **Conversation** avec la commande `/scene`. La commande a un alias, `/rp`, qui fait exactement la même chose.

Voici la marche à suivre :

1. Ouvre un chat **Conversation** qui contient déjà quelques messages.
2. Dans la zone de saisie, tape la commande de scène. Tu peux ajouter derrière une courte description de ce que tu veux.

```
/scene we sneak into the old library at midnight
```

3. Appuie sur Enter. La fenêtre **Scene Prompt Setup** (configuration du prompt de scène) s'ouvre.
4. Choisis un **Prompt preset** (préréglage de prompt) pour la nouvelle scène, ou garde **None** (aucun). Marinara mémorise ce choix pour la scène suivante. Les instructions propres à la scène continuent de s'appliquer avec le préréglage sélectionné.
5. Sous **POV**, choisis le point de vue du texte : **First Person**, **Second Person** ou **Third Person**.
6. Sous **Tense** (le temps), choisis **Past**, **Present** ou **Future**.
7. Si tu le souhaites, écris des consignes dans le champ **Extra instructions** (instructions supplémentaires) pour orienter la scène.
8. Clique sur **Plan Scene** (planifier la scène).

Marinara planifie la scène et l'ouvre comme un nouveau chat de roleplay. La nouvelle scène apparaît dans la liste des chats et s'ouvre toute seule, avec un message d'accueil qui plante la situation. Si tu changes d'avis dans la fenêtre de configuration, clique sur **Cancel** (annuler) : aucune scène n'est créée.

Autre option : lancer une scène sans description. Tape seulement la commande, à condition que la conversation ait déjà assez d'historique pour servir de base.

```
/scene
```

Si la conversation ne contient encore aucun message, Marinara te demande d'ajouter une description ou de discuter un peu avant de pouvoir planifier une scène.

Un personnage peut lui aussi proposer de lancer une scène. Dans ce cas, la même fenêtre **Scene Prompt Setup** s'ouvre, avec une ligne du type "[Character] wants to start a scene." Choisis le **Prompt preset**, le **POV** et le **Tense**, puis clique sur **Plan Scene** comme d'habitude – ou clique sur **Cancel** pour refuser.

## La barre de scène : End Scene, Discard, Convert et Back to conversation

Quand tu es dans une scène active, une barre se place juste au-dessus de la zone de saisie. Elle regroupe les commandes qui décident du sort de la scène. Les boutons affichés dépendent de la présence ou non d'une conversation liée.

- **Back to conversation** (retour à la conversation) te ramène au chat **Conversation** qui a lancé la scène. La scène reste ouverte et active : tu peux y revenir plus tard. Ce bouton n'apparaît que si la scène a une conversation d'origine.
- **End Scene** (terminer la scène) clôt la scène et enregistre un résumé. Au clic, la barre demande **End and save summary?** avec un bouton **Yes** et un bouton **No**. Clique sur **Yes** pour confirmer. Le bouton affiche l'état **Saving...** pendant l'opération. Marinara écrit un court résumé de la scène dans la conversation d'origine, sous forme de souvenir, puis te ramène là où cette conversation s'était arrêtée.
- **Discard** (abandonner) jette la scène sans rien enregistrer. Au clic, la barre demande **Discard scene?** avec les boutons **Yes** et **No**. Clique sur **Yes** pour supprimer la scène et revenir à la conversation. Rien n'est écrit en retour.
- **Convert** (convertir) transforme la scène en chat de roleplay indépendant. Ce bouton a sa propre section plus bas, parce qu'il modifie la scène définitivement.

Prends le temps de réfléchir avant de cliquer sur **End Scene** ou sur **Discard** : dans les deux cas, la scène disparaît de ta conversation. **End Scene** garde un souvenir de ce qui s'est passé. **Discard** ne garde rien.

## Cloner une scène à partir d'un message

Dans un chat de scène, chaque message dispose d'un petit bouton d'action dont l'infobulle indique **Clone from here** (cloner à partir d'ici). Tu peux ainsi dériver le contenu de la scène dans un tout nouveau chat de roleplay, copié jusqu'à ce message inclus.

Pour t'en servir :

1. Survole le message à partir duquel tu veux créer une branche.
2. Clique sur l'action **Clone from here**.

Marinara crée un roleplay indépendant à partir de la scène, en copiant les messages jusqu'à ce point. La scène d'origine reste ouverte et active : c'est donc une façon sans risque d'explorer une autre voie. Un message de confirmation t'indique que la scène a été clonée en roleplay, et le nouveau chat s'ouvre.

Le clonage conserve la scène d'origine. La conversion, décrite juste après, ne la conserve pas.

## Convertir une scène en roleplay indépendant

Le bouton **Convert** de la barre de scène détache la scène et en fait un chat de roleplay permanent. Au clic sur **Convert**, une fenêtre de confirmation s'ouvre, intitulée **Convert this scene into a standalone roleplay?**

La fenêtre explique ce qui va se passer. Marinara crée un nouveau chat de roleplay à partir de la scène en cours et détache la scène d'origine de sa conversation. Ni résumé de scène ni souvenir de personnage ne sont écrits dans la conversation d'origine. Clique sur **Convert** pour valider, ou sur **Cancel** pour tout laisser en l'état.

Utilise **Convert** quand une scène est devenue une histoire que tu veux garder et poursuivre comme un roleplay normal. Utilise plutôt **Clone from here** quand tu veux une copie tout en laissant la scène d'origine en place.

Pour bien distinguer les deux façons de dériver : **Clone from here** crée des branches de scène pendant que l'original reste actif. **Convert** transforme les branches de scène en roleplay indépendant et retire l'original de sa conversation.

## Pourquoi les scènes n'héritent pas du contexte des chats connectés

Un chat **Conversation** peut être connecté à un roleplay pour que le contexte circule entre les deux. Les scènes fonctionnent autrement, et c'est volontaire : une scène est autonome.

Une scène ne reprend pas automatiquement le contexte des échanges d'une conversation connectée, même quand le chat parent le fait. Une conversation connectée peut glisser discrètement de courtes consignes d'orientation dans le roleplay lié pour infléchir son histoire, mais une scène ignore ces consignes. La scène reste ainsi concentrée sur son propre moment, sans traîner toute la conversation derrière elle.

C'est pour cette raison qu'une scène se lit comme une petite histoire à part entière. Si tu veux un lien permanent, dans les deux sens, entre une conversation et un roleplay, passe par un chat connecté plutôt que par une scène. Le guide des chats connectés, en lien ci-dessous, décrit cette fonctionnalité.

## Guides associés

- [Le mode Roleplay : premiers pas](getting-started.md)
- [Les branches de chat](../chats/branches.md)
- [Connecter une Conversation à un Roleplay ou à un Game](../chats/connected-chats.md)
