# Mode Conversation : premiers pas

Ce guide explique le mode Conversation de Marinara Engine, le mode de chat qui ressemble à une messagerie. Au programme : à quoi sert ce mode et comment fonctionne l'assistant de configuration en quatre étapes. Tu découvres aussi les fonctionnalités réservées au mode Conversation : messages autonomes, statut de présence, réactions, selfies et jeux de table.

## Ce qu'est le mode Conversation

Le mode Conversation est l'un des modes de chat de Marinara Engine. Il fonctionne comme une application de messagerie. Tu as un ou plusieurs personnages, une barre de saisie et un historique de messages qui défile.

Vois-le comme des messages privés, ou DM, comme quand tu écris à un ami. Pas de Game Master (le maître du jeu), pas d'illustrations de scène, aucune mécanique imposée. C'est le mode de chat le plus léger, et beaucoup d'utilisateurs y passent l'essentiel de leur temps.

Le mode Conversation ajoute des fonctionnalités qui n'ont de sens que dans une relation suivie par messagerie. Les personnages ont un statut en ligne ou absent, ainsi qu'un emploi du temps hebdomadaire. Ils peuvent t'écrire les premiers, envoyer des selfies, réagir avec des emojis et jouer à des jeux de table. Chaque personnage et chaque persona dispose aussi d'un petit profil façon Discord, avec un nom affiché et une présentation. Les champs de ce profil sont détaillés dans [Profils du mode Conversation](profiles.md).

Aucune de ces fonctionnalités propres au mode Conversation ne s'applique dans le mode Roleplay ou dans Game Mode, même si tu y réutilises la même fiche de personnage.

À l'inverse, certains champs de la fiche ne s'appliquent pas en mode Conversation. Un chat Conversation ne commence pas par le **First Message** (premier message) de la fiche ni par une autre salutation ; seuls les chats Roleplay le font. Il n'utilise pas non plus la **Dialogue Highlight Color** (couleur de surbrillance des dialogues) ni la **Message Box Color** (couleur de la bulle de message) de la fiche. La **Name Display Color** (couleur d'affichage du nom) colore toujours le nom du personnage au-dessus de chaque message. Consulte [Où les couleurs apparaissent](../characters/colors-and-stats.md#where-your-colors-show).

### Quand choisir le mode Conversation

Choisis le mode Conversation si tu veux l'une de ces choses :

- Discuter avec un personnage comme tu écrirais à un ami en message privé : du texte en entrée, du texte en sortie.
- Parler à plusieurs personnages à la fois dans un même fil.
- Laisser les personnages agir d'eux-mêmes : envoyer des messages, suivre leur emploi du temps et réagir au fil du temps.

Choisis plutôt le mode Roleplay ou Game Mode si tu veux des illustrations de scène, comme les sprites (image du personnage sur le plateau) et les arrière-plans, ou des mécaniques de jeu structurées.

## L'assistant de configuration en quatre étapes

Quand tu démarres un nouveau chat en mode Conversation, un assistant de configuration en quatre étapes s'ouvre. Autre option : le fermer et tout régler plus tard depuis le panneau latéral des réglages du chat. Voici les quatre étapes :

1. L'étape **Name & Connection** (nom et connexion) : donne un nom au chat et choisis la connexion à l'IA qu'utilisent les personnages. Une connexion est un lien enregistré vers un fournisseur d'IA. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).
2. L'étape **Prompt Preset** (preset de prompt) : choisis le preset (modèle de prompt enregistré) qui fournit le prompt du mode Conversation, autrement dit le texte que Marinara envoie à l'IA, ou garde celui par défaut.
3. L'étape **Persona & Characters** (persona et personnages) : choisis ton persona et un ou plusieurs personnages.
4. L'étape **Automation** (automatisation) : décide de ce que les personnages peuvent faire d'eux-mêmes.

Le persona, c'est le personnage que tu incarnes. Voir [Personas utilisateur](../characters/personas.md).

Le nombre de personnages choisis détermine la forme du chat. Un seul personnage donne un message privé en tête-à-tête. Deux personnages ou plus donnent un chat de groupe, sans mode supplémentaire à activer. Les réglages du chat de groupe sont décrits dans [Chats de groupe](../chats/group-chats.md).

Une fois la connexion et au moins un personnage définis, clique sur **Start Chatting** (commencer à discuter) pour ouvrir le chat.

### L'étape Automation

L'étape **Automation** comprend toujours ces réglages :

| Interrupteur | Par défaut | Rôle |
|---|---|---|
| **Autonomous Messages** | On | Les personnages peuvent t'écrire les premiers quand tu es inactif. |
| **Generate Schedules** | Off | Crée des routines hebdomadaires facultatives. Affiché uniquement quand **Autonomous Messages** est activé. |

Si tu as installé un package d'agent qui apporte des commandes pour le mode Conversation, l'étape affiche aussi **Commands** (commandes). Les appels, les selfies de l'agent **Illustrator**, **Music DJ**, **Haptic Feedback** et chaque jeu de table n'apparaissent que si le package correspondant est installé. Pour les appels, voir [Appels audio et vidéo en mode Conversation](calls.md).

### La grille des commandes

Quand **Commands** est disponible et activé, une grille pouvant compter jusqu'à 17 familles de commandes s'affiche. Chaque famille correspond à une action cachée qu'un personnage peut déclencher seul. Les entrées fournies par un package n'apparaissent que si ce package est installé. Toutes les familles visibles sont activées au départ. Désactiver un interrupteur retire uniquement cette famille. Les commandes sont des actions pilotées par le modèle, pas des choses que tu tapes.

Voici la liste complète des familles de commandes :

- **Schedule Updates** : les personnages peuvent changer leur statut du moment.
- **Cross-Post** : les personnages peuvent rediriger un message vers un autre chat.
- **Selfies** : les personnages peuvent demander des selfies générés.
- **Memories** : les personnages peuvent créer des souvenirs pour d'autres personnages.
- **Scenes** : les personnages peuvent lancer une scène immersive.
- **Music** : les personnages peuvent jouer des morceaux via le **Music Player** actif.
- **Haptics** : les personnages peuvent piloter les appareils haptiques connectés.
- **Influence** : les personnages peuvent influencer un chat connecté.
- **Notes** : les personnages peuvent enregistrer des notes durables pour un chat connecté.
- **Calls** : les personnages peuvent te sonner pour un appel en mode Conversation.
- **Reactions** : les personnages peuvent réagir aux messages avec des badges emoji.
- **UNO** : les personnages peuvent lancer une partie d'UNO à la table quand tu acceptes de jouer.
- **Chess** : les personnages peuvent accepter un duel d'échecs à la table.
- **Poker** : les personnages peuvent s'installer à la table pour une partie de Texas Hold'em.
- **8-Ball Pool** : les personnages peuvent lancer une partie de billard américain à la table.
- **Tic-Tac-Toe** : les personnages peuvent accepter un duel de morpion.
- **Rock-Paper-Scissors** : les personnages peuvent accepter un duel de pierre-feuille-ciseaux.

Un unique interrupteur principal **Commands** commande l'ensemble. Quand cet interrupteur principal est désactivé, aucune famille de commandes ne fonctionne, même si elle semble activée.

## Messages autonomes et statut de présence

Les messages autonomes permettent à un personnage de te contacter en premier. Quand **Autonomous Messages** est activé, un personnage peut t'écrire après un moment de silence de ta part. Il tient compte de son propre bavardage et, si les emplois du temps sont activés, de sa disponibilité. Une fois l'assistant de configuration terminé, les messages autonomes sont activés par défaut.

Ce réglage se change à tout moment. Ouvre le panneau latéral des réglages du chat, puis va dans la section **Autonomous Messaging** (messagerie autonome).

### Ton statut de présence

Tu as un statut de présence qui influence le moment où les personnages te contactent. Il se trouve en pied de la barre latérale, sous forme de pastille colorée affichant ton statut actuel. Clique sur la pastille pour choisir parmi quatre options :

- **Active** : tu es en ligne et disponible.
- **Idle** : appliqué automatiquement quand tu t'absentes.
- **Do Not Disturb** : bloque les messages autonomes.
- **Invisible** : masque ton statut aux personnages.

À côté de la pastille se trouve le champ **What are you doing?**. Saisis-y une courte activité personnalisée si tu veux que les personnages sachent ce que tu fais. Le statut de présence est global : il reste le même dans tous les chats.

## Réactions et notifications

Tout message du mode Conversation peut recevoir une réaction emoji. Utilise le bouton de réaction sur un message pour ajouter la tienne. Marinara enregistre la réaction sous forme de note, du type `[User reacted with ...]`, et les réponses suivantes la voient. Un personnage peut ainsi remarquer que tu as réagi.

Quand la famille de commandes **Reactions** est activée, les personnages réagissent aussi. Ils peuvent réagir à tes messages ou à ceux des autres personnages. C'est pratique dans les chats de groupe : un personnage peut réagir brièvement, sans écrire un message complet.

Quand un personnage t'écrit dans un chat que tu n'as pas sous les yeux, une bulle d'avatar flottante apparaît au bord de l'écran. Clique sur la bulle pour rejoindre ce chat, ou ferme-la avec le X. Sur mobile, plusieurs bulles en attente se regroupent en un seul bloc à toucher.

## Selfies

Les personnages peuvent t'envoyer des selfies, c'est-à-dire des photos du personnage générées par l'IA. Un selfie n'est pas une illustration de scène comme dans le mode Roleplay ou dans Game Mode : il est lié à un seul personnage.

Pour utiliser les selfies, installe **Illustrator** depuis **Agents → Download Agents**. Ouvre ensuite le panneau latéral des réglages du chat, va dans **Agents → Illustrator Settings**, puis renseigne le champ **Selfie Connection**. Une connexion de selfie pointe vers un fournisseur de génération d'images. Chaque selfie consomme un appel de génération d'images.

La configuration complète, avec le style, la résolution et le bouton de demande manuelle, est détaillée dans [Selfies](selfies.md).

## Jeux de table

Le mode Conversation propose six packages de jeux de table facultatifs : **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** et **Rock-Paper-Scissors**. Installe les jeux qui t'intéressent depuis **Agents → Download Agents**. L'application met en place le plateau de jeu, applique les règles et fait narrer à chaque personnage ses propres coups, en restant dans son rôle. Les jeux de table ne fonctionnent que dans les chats en mode Conversation.

Une partie se lance de trois façons :

1. Tape une commande slash dans la zone de message, puis appuie sur Enter.
2. Écris un message normal, du genre "let's play uno".
3. Laisse un personnage t'inviter, quand sa famille de commandes est activée.

Voici les commandes slash :

```
/uno
```

```
/chess
```

```
/poker
```

```
/8ball
```

```
/tictactoe
```

```
/rps
```

Chaque jeu a sa propre fenêtre de configuration avec des options. Pour les règles complètes, les fenêtres de configuration et les plateaux de jeu, voir [Jeux de table](table-games.md).

## Emplois du temps des personnages

Chaque personnage d'un chat en mode Conversation peut avoir un emploi du temps hebdomadaire. Cet emploi du temps fixe son statut et son activité sur une grille de 7 jours et 24 heures. Les messages autonomes suivent alors la routine : un personnage marqué absent ne te contacte pas pendant ces heures.

Tu peux créer un emploi du temps pendant la configuration en activant **Generate Schedules**. Autre option : en créer ou en modifier un plus tard, depuis la section **Autonomous Messaging** du panneau latéral des réglages du chat. [Emplois du temps des personnages et messagerie autonome](schedules.md) présente l'éditeur complet, les limites quotidiennes et la commande `/status`, qui force le statut.

## Dépannage

### Les messages autonomes arrivent trop souvent

Ouvre le panneau latéral des réglages du chat et désactive **Autonomous Messages** dans la section **Autonomous Messaging**. Autre option : passer ton statut de présence sur **Do Not Disturb**, qui bloque les messages autonomes. Si tu utilises les emplois du temps, marque davantage d'heures comme absent, voir [Emplois du temps des personnages et messagerie autonome](schedules.md).

### Un seul personnage répond à tout dans un chat de groupe

Les chats de groupe offrent des réglages de tour de parole, comme **Reply When Mentioned**. Ouvre [Chats de groupe](../chats/group-chats.md) pour définir qui parle et quand.

### Un personnage oublie ce qui s'est passé plus tôt

Les chats longs saturent la mémoire du modèle. Essaie un modèle avec une fenêtre de contexte plus grande, ou ajoute les faits importants à une entrée de lorebook, un recueil de faits sur ton univers, pour qu'ils restent dans le contexte. Autre option : repartir sur un nouveau chat avec le même personnage et le même persona. Pour plus d'aide, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

### Un selfie ne ressemble pas au personnage

Ouvre les réglages **Selfies** et règle **Attach Card Appearance** (joindre l'apparence de la fiche) sur **Images only** (images seulement) ou **Images and videos** (images et vidéos). Si ton fournisseur d'images prend en charge les images de référence, règle aussi **Send Avatar References** (envoyer l'avatar en référence). Voir [Selfies](selfies.md) pour le détail.

## Guides associés

- [Appels audio et vidéo en mode Conversation](calls.md)
- [Emplois du temps des personnages et messagerie autonome](schedules.md)
- [Profils du mode Conversation](profiles.md)
- [Selfies](selfies.md)
- [Emojis, stickers et GIF personnalisés](emoji-stickers-gifs.md)
- [Jeux de table](table-games.md)
- [Connecter une Conversation à un Roleplay ou à une partie](../chats/connected-chats.md)
