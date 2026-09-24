# Chats de groupe et conversations de groupe

Ce guide explique les chats de groupe de Marinara Engine, c'est-à-dire les chats qui réunissent deux personnages ou plus. Tu y découvres comment créer un chat de groupe et comment en ajouter ou en retirer des membres. Il montre aussi comment régler qui prend la parole en mode Conversation et en mode Roleplay.

## Ce qu'est un chat de groupe

Un chat de groupe, c'est tout simplement un chat qui contient deux personnages ou plus. Marinara n'a pas de bouton "chat de groupe" dédié. Un chat normal devient un chat de groupe dès que tu ajoutes un deuxième personnage.

Les chats de groupe fonctionnent dans deux modes : **Conversation** et **Roleplay**. Game Mode dispose de son propre système d'équipe, qui n'est pas traité ici.

Le mot "groupe" recouvre plusieurs choses dans Marinara. Un chat de groupe, ce sont plusieurs personnages réunis dans un même chat. C'est différent des dossiers **Folders**, qui sont des listes de personnages enregistrées et réutilisables. C'est aussi différent des branches **Chat Branches**, qui sont des versions alternatives d'un même chat. Ce guide ne parle que des chats de groupe.

## Créer un chat de groupe

Un chat de groupe se crée avec l'assistant de configuration habituel, celui de n'importe quel chat. Il suffit de sélectionner plusieurs personnages.

1. Dans la barre latérale, clique sur le bouton de nouveau chat correspondant au mode voulu. Le bouton indique **New Conversation** (nouvelle conversation) ou **New Roleplay** (nouveau roleplay).
2. Va à l'étape de l'assistant intitulée **Persona & Characters** (persona et personnages).
3. Sers-toi du champ **Search characters...** pour trouver un personnage, puis clique sur son avatar ou sur son nom pour l'ajouter.
4. Ajoute un deuxième personnage de la même façon. Rien ne limite le nombre d'ajouts.
5. Termine l'assistant pour ouvrir le chat.

Dès l'ajout d'un deuxième personnage, l'intitulé au-dessus du sélecteur change. En mode Conversation, il affiche **Group Chat** (chat de groupe) suivi du nombre de membres. En mode Roleplay, il affiche **Characters** (personnages) suivi de ce même nombre.

Le nombre de personnages n'est pas plafonné. En pratique, plus il y a de personnages, plus le prompt – le texte que Marinara envoie à l'IA – est long, et plus chaque réponse coûte cher. N'ajoute que les personnages dont la scène a besoin.

Si tu ne renommes pas le chat, Marinara le nomme d'après les personnages, séparés par des virgules. Par exemple "Alice, Bob, Carol".

### Ajouter plusieurs personnages d'un coup avec les dossiers

Si tu as créé un dossier de personnages, tu peux ajouter tout le dossier en une seule étape. Les dossiers sont des listes de personnages enregistrées, que tu constitues dans le panneau **Characters**. C'est le moyen le plus rapide de monter un chat de groupe destiné à resservir.

1. À l'étape **Persona & Characters**, ouvre le menu déroulant **Add from Folder** (ajouter depuis un dossier).
2. Choisis un dossier dans la liste.
3. Clique sur le bouton **Add** (ajouter), à côté du menu déroulant.

Tous les personnages de ce dossier qui ne sont pas déjà dans le chat y sont ajoutés. Le contrôle **Add from Folder** n'apparaît que si tu as au moins un dossier. Pour savoir comment créer et gérer les dossiers, consulte le guide sur l'organisation de la bibliothèque de personnages, indiqué plus bas.

Autre option : clique sur la ligne **Random** (aléatoire), signalée par l'étiquette **Dice pick**, pour ajouter au hasard un personnage qui n'est pas encore dans le chat.

## Gérer les membres après la création

Tu ajoutes, retires et réorganises les personnages depuis le panneau latéral **Chat Settings** (réglages du chat). Ouvre-le avec l'icône d'engrenage, dans l'en-tête du chat. L'infobulle de l'engrenage indique **Chat Settings**.

Dans le panneau latéral, repère la section **Characters**. Elle affiche le nombre de membres et le texte d'aide "Characters in this chat. Each character has their own personality that the AI roleplays as." Chaque ligne de membre comporte un avatar, le nom du personnage, une poignée de déplacement, une icône d'œil et une icône de corbeille.

- Pour ajouter un personnage de plus, clique sur le bouton **Add Character** (ajouter un personnage) et lance une recherche.
- Pour ajouter un dossier entier, clique sur **Add from Folder** et choisis-en un.
- Pour retirer un personnage, clique sur l'icône de corbeille. Son infobulle indique **Remove from chat** (retirer du chat).
- Pour changer l'ordre des personnages, fais glisser un membre vers le haut ou vers le bas avec la poignée de déplacement. Son infobulle indique **Drag to reorder** (glisser pour réordonner).

L'ordre des membres compte. Avec l'ordre de réponse **Sequential**, expliqué plus bas, les personnages répondent dans l'ordre où ils apparaissent ici. Fais glisser un membre pour changer le moment où il prend la parole.

La section **Characters** n'apparaît pas en Game Mode, qui gère son équipe ailleurs.

### Mettre un membre en pause sans le retirer

Il arrive qu'un personnage doive rester en retrait un moment, sans pour autant quitter la liste. Sers-toi de l'icône d'œil sur sa ligne de membre.

- Clique sur l'œil pour désactiver un personnage. L'infobulle devient **Disable in chat** (désactiver dans le chat) et l'œil se barre d'un trait.
- Clique à nouveau dessus pour le réintégrer. L'infobulle indique alors **Enable in chat** (activer dans le chat).

Un personnage désactivé reste dans la liste des membres, mais il est écarté de toutes les réponses. Marinara n'envoie pas sa fiche de personnage au modèle, et il ne peut pas être choisi pour parler.

Un garde-fou existe. Si tu désactives tous les personnages du chat, Marinara les considère de nouveau tous comme actifs. Cela évite une réponse sans aucun personnage.

Cet état activé ou désactivé est enregistré chat par chat. Il ne change rien au personnage ailleurs dans l'application.

## Qui parle : le mode Roleplay

En mode Roleplay, un chat de groupe dispose d'une section **Group Chat** dans **Chat Settings**. Elle n'apparaît que si le chat compte deux personnages ou plus. Elle sert à régler la façon dont les personnages répondent.

### Merged (Narrator) ou Individual

Le réglage **Mode** se présente sous la forme de deux boutons.

- **Merged (Narrator)** (fusionné, avec narrateur) est la valeur par défaut. Une seule réponse fait parler tous les personnages, narration comprise, d'un seul bloc.
- **Individual** (individuel) fait générer à chaque personnage sa propre réponse, séparément.

### Color Dialogues (mode Merged uniquement)

Quand **Mode** est réglé sur **Merged (Narrator)**, tu peux activer **Color Dialogues** (dialogues colorés). L'option est désactivée par défaut. Une fois activée, les répliques de chaque personnage s'affichent avec ses propres couleurs. Ces couleurs viennent de l'onglet **Colors** (couleurs) de l'éditeur de personnage. Cet onglet définit la couleur du nom, la couleur des dialogues et la couleur de l'encadré. Le guide sur l'édition des personnages explique comment les régler.

<a id="response-order-individual-only"></a>

### Response Order (mode Individual uniquement)

Quand **Mode** est réglé sur **Individual**, un réglage **Response Order** (ordre des réponses) apparaît. Il se présente sous la forme de trois boutons.

- **Sequential** (séquentiel) est la valeur par défaut. Chaque personnage répond à son tour, dans l'ordre de la liste **Characters**. Réorganise les membres pour changer l'ordre des tours.
- **Smart** (intelligent) passe par un court appel à l'IA, invisible, pour déterminer quel personnage – ou quels personnages – doit répondre ensuite. Il lit les messages récents ainsi que les détails de chaque personnage, et retient en général un seul intervenant. Si tu écris une mention comme `@Alice` dans ton message, elle prime sur ce choix.

  Si tu as choisi un **Decision model** (modèle de décision ; voir [Modèles de décision](../connections/decision-models.md)), tu peux activer **Also use it to pick who speaks in Smart response order** (l'utiliser aussi pour choisir qui parle dans l'ordre Smart) juste dessous. Smart demande alors un score oui/non distinct pour chaque candidat. Les questions partagent les cinq derniers messages et une liste indiquant les noms, statuts, activités, niveaux de bavardage et un court extrait de personnalité ou de description des candidats. Un fournisseur hébergé reçoit aussi cette liste ; consulte [Ce que voit le modèle](../connections/decision-models.md#what-the-model-sees).

  Ces scores peuvent être plus rapides à obtenir qu'une réponse IA complète, mais vitesse et coût dépendent du modèle et du nombre de candidats. En Roleplay, Marinara choisit l'interlocuteur le plus probable. En Conversation, tous ceux ayant une raison de répondre le font, les plus probables d'abord. Le personnage qui vient de parler attend si un autre a une raison de répondre. Si le Decision model ne répond pas, Smart effectue son appel IA habituel.
- **Manual** (manuel) supprime toute réponse automatique. C'est toi qui désignes précisément qui répond, avec le sélecteur **Trigger Response** (déclencher une réponse) de la barre de message.

Avec l'ordre **Smart**, l'IA peut mettre plusieurs personnages en file d'attente. Seul le premier répond immédiatement. Pour désigner celui qui parle ensuite, utilise le sélecteur **Trigger Response** de la barre de message. Autre option : envoie un message vide pour générer le personnage suivant dans la file.

Deux autres interrupteurs apparaissent en mode **Individual** :

- **Add Turn To Prompt** (ajouter le tour au prompt) est activé par défaut. Cette option ajoute une courte instruction précisant quel personnage doit répondre à ce tour.
- **Name Prefix History** (préfixer l'historique par les noms) est désactivé par défaut. Cette option change la façon dont les messages passés sont étiquetés avec le nom de leur auteur avant d'être envoyés au modèle. Laisse-la désactivée, sauf si un personnage confond sans arrêt qui a dit quoi.

### Scenario Override

Le champ **Scenario Override** (remplacement du scénario) sert à donner un scénario commun à tous les personnages du chat. Saisis-y un texte, et ce texte remplace dans le prompt le scénario propre à chaque personnage. Laisse-le vide, et chaque personnage conserve son scénario habituel.

Il n'y a pas d'interrupteur d'activation. Saisir du texte active l'option. Effacer le texte la désactive. Pour éditer dans une fenêtre plus grande, clique sur l'icône d'agrandissement (infobulle **Expand editor**). L'éditeur agrandi s'intitule **Group Scenario Override**.

Une remarque pour la réutilisation : le texte de **Scenario Override** est lié à ce chat précis. Il n'est pas repris dans les profils de réglages, donc il ne suivra pas un profil vers un nouveau chat.

### Réglages et valeurs par défaut (Roleplay)

| Réglage | Emplacement | Par défaut |
|---|---|---|
| **Mode** (**Merged (Narrator)** / **Individual**) | Section Group Chat | Merged (Narrator) |
| **Color Dialogues** | Section Group Chat, mode Merged | Off |
| **Response Order** (Sequential / Smart / Manual) | Section Group Chat, mode Individual | Sequential |
| **Add Turn To Prompt** | Section Group Chat, mode Individual | On |
| **Name Prefix History** | Section Group Chat, mode Individual | Off |
| **Scenario Override** | Section Group Chat | Vide (désactivé) |

La plupart de ces réglages sont enregistrés dans les profils de réglages, ce qui permet de les réutiliser. Seule exception : **Scenario Override**, qui reste attaché à un seul chat.

## Qui parle : le mode Conversation

Le mode Conversation prend en charge les mêmes chats de groupe, mais il n'affiche pas la section **Group Chat**. Ses contrôles se trouvent dans la section **Autonomous Messaging** (messages autonomes) de **Chat Settings**.

Par défaut, une conversation de groupe se comporte comme le mode Merged. Une même réponse peut faire parler plusieurs personnages à la fois, et leurs répliques sont colorées automatiquement selon l'intervenant. Le mode Conversation n'a pas d'interrupteur de couleur distinct à régler.

### Reply When Mentioned

Active **Reply When Mentioned** (répondre si mentionné) pour passer le chat en mode un personnage à la fois. Une fois l'option activée, les personnages ne répondent que si tu les nommes ou si tu les déclenches à la main. La description de l'interrupteur indique "Characters wait for direct mentions or manual response triggers."

Pour nommer un personnage, sers-toi d'une mention. Tape `@` suivi du nom du personnage dans le champ de message, et une liste d'autocomplétion s'affiche. Les personnages que tu mentionnes sont ceux qui répondent.

Pour désigner un intervenant sans écrire de mention, utilise le sélecteur **Trigger Response**.

- Sur ordinateur, c'est un bouton placé à côté du bouton Send.
- Sur téléphone, il se trouve sous l'intitulé **Trigger Response**, dans le tiroir d'outils que tu ouvres depuis la barre de message.

L'infobulle du bouton indique "Trigger character response".

### Character Exchanges

Active **Character Exchanges** (échanges entre personnages) pour laisser les personnages se parler entre eux d'eux-mêmes. L'option est désactivée par défaut. Sa description indique "Characters chat with each other in group chats."

Une fois l'option activée, les personnages peuvent se répondre entre eux pendant ton absence, et pas seulement te répondre à toi. Cela ne fonctionne que tant que Marinara est ouvert dans le navigateur. Si tu fermes l'application, les échanges s'arrêtent. Ils partagent aussi la limite quotidienne de messages appliquée aux messages autonomes.

## La gestion des tours en un coup d'œil

| Mode et réglage | Ce qui se passe | Comment l'orienter |
|---|---|---|
| Roleplay, Merged | Une seule réponse fait parler tous les personnages | Toujours tous les personnages ensemble |
| Roleplay, Individual, Sequential | Chaque personnage répond dans l'ordre des membres | Fais glisser les membres pour les réordonner |
| Roleplay, Individual, Smart | L'IA choisit le ou les prochains intervenants | La mention `@Name` prime sur ce choix |
| Roleplay, Individual, Manual | Personne ne répond de lui-même | Utilise le sélecteur **Trigger Response** |
| Conversation, par défaut | Une même réponse peut faire parler plusieurs personnages | La mention `@Name` cible un personnage |
| Conversation, Reply When Mentioned activé | Personne ne répond sans mention ni déclenchement | Mention `@Name` ou sélecteur **Trigger Response** |
| Conversation, Character Exchanges activé | Les personnages peuvent aussi s'écrire entre eux | Désactive l'option pour que cela cesse |

## Guides associés

- [Organiser la bibliothèque de personnages](../characters/library-organization.md)
- [Mode Conversation : premiers pas](../conversation/getting-started.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
