# Profils du mode Conversation (Display Name, About Me, Behavior)

Chaque personnage et chaque persona a un petit profil de style application de chat pour le mode Conversation : un nom d'affichage, une bio "à propos de moi" et une instruction de comportement. Ces champs ne servent jamais en mode Roleplay ni en Game Mode.

Ce n'est pas un profil de réglages (un ensemble enregistré d'options de chat, voir [Profils de réglages](../chats/settings-profiles.md)). Tu découvres le mode ? Lis d'abord [Mode Conversation : premiers pas](getting-started.md). Une persona est la fiche de personnage qui te représente.

## Où se trouvent ces champs

Les champs sont dans un onglet nommé **Convo**.

1. Ouvre le personnage dans le **Character Editor** (éditeur de personnage), ou la persona dans le **Persona Editor** (éditeur de persona). Pour y aller, ouvre le panneau **Characters** depuis la barre latérale, ou le panneau **Personas** depuis l'icône de personne dans la barre du haut de la barre latérale droite, puis clique sur la fiche (voir [Créer et modifier des personnages](../characters/creating-and-editing-characters.md) et [Personas utilisateur](../characters/personas.md)).
2. Clique sur l'onglet **Convo**.

L'onglet contient **Convo Display Name**, **About Me** et **Convo Behavior**. Sur un personnage, il a aussi **Weekly schedule** (avec **Edit schedule** ou **Create schedule**, voir [emplois du temps](schedules.md)) et **Image generation instructions**, des directives facultatives pour les selfies de ce personnage (voir [Selfies](selfies.md)).

## Définir un nom d'affichage

**Convo Display Name** (nom d'affichage Convo) est le nom affiché dans les chats Conversation. Laisse-le vide pour utiliser le nom de la fiche. Les messages existants se mettent à jour tout de suite.

Les personnages ont aussi **Declare this name on the card in the prompt**. Quand il est activé, Marinara ajoute une ligne comme "Conversation display name: X" au texte de la fiche dans le prompt (le texte que Marinara envoie au modèle), pour que le modèle sache quelle fiche utilise quel nom. Il a besoin d'abord d'un nom d'affichage.

## Écrire un About Me

**About Me** (à propos de moi) est une courte bio : une ligne ou deux, un emoji, une blague, ou rien. Marinara ajoute le **About Me** de chaque personnage et de chaque persona présents au prompt à chaque tour, pour que le modèle sache comment chacun se présente. Tu n'as rien à faire pour cela.

Pour le remplir :

- Écris-le toi-même. Le bouton emoji de la barre d'outils insère un emoji. **Revert** (rétablir) restaure le texte d'avant ta modification en cours.
- Sur un personnage enregistré, clique sur le bouton baguette (**Generate About Me from this card**, générer le About Me à partir de cette fiche).
- Demande à **Professor Mari** sur l'écran Home, par exemple `Write Luna's About Me as a cryptic one-line bio.` Elle lit le profil enregistré, écrit la bio avec la voix de cette personne et l'enregistre. Tu peux garder ou restaurer sa modification dans le flux de relecture habituel.

Si ça n'a pas marché : le bouton baguette manque sur une fiche pas encore enregistrée. Enregistre d'abord la fiche.

## Définir le Convo Behavior

**Convo Behavior** (comportement Convo) est une instruction sur la façon dont le personnage ou la persona agit en mode Conversation, par exemple : garde les réponses courtes et en minuscules, et écris comme une vraie personne. Les instructions post-history sont du texte de prompt placé après l'historique récent du chat. Garde la valeur par défaut si tu n'écris pas de prompts personnalisés. Utilise **Insertion** pour choisir où l'instruction va dans le prompt :

| Option | Où va l'instruction |
| --- | --- |
| **Constant — after the card** (défaut) | Toujours, juste après le texte de la fiche. |
| **Constant — before the card** | Toujours, juste avant le texte de la fiche. |
| **Append to post-history** | À la fin des instructions post-history. |
| **Prepend to post-history** | Au début des instructions post-history. |
| **Replace post-history** | À la place des instructions post-history. |
| **Only where {{convo_behavior}} is placed** | Seulement où tu mets la macro dans un prompt personnalisé. |

## Remplacements du About Me propres à un chat

Le **About Me** de la fiche est la valeur par défaut partout. Tu peux définir une autre bio pour un seul chat.

1. Dans un chat Conversation, clique sur l'avatar ou le nom d'un personnage ou d'une persona. Une fiche de profil s'ouvre à côté (depuis le bas sur un téléphone).
2. Lis la fiche. Elle montre l'avatar, le nom et le **About Me** actuel. Un badge indique **Default** ou **Chat-specific**. Les personnages affichent aussi **Online**, **Away**, **Busy** ou **Offline**.
3. Clique sur **Edit**.
4. Tape la bio pour ce chat. Un sélecteur d'emojis avec un onglet **Custom emojis** est disponible.
5. Clique sur **Save**. Tu vois "Chat-specific about me saved".

**Cancel** ferme le mode édition sans enregistrer. **Revert** annule les modifications non enregistrées. **Clear** supprime un remplacement existant et revient à la valeur par défaut de la fiche. Enregistrer une bio vide l'efface aussi.

## Laisser un personnage changer son propre About Me

C'est une option avancée. Un outil nommé `update_about_me` permet à un personnage de modifier sa propre bio pendant un chat. Il est désactivé par défaut. Pour l'utiliser, ouvre **Chat Settings → Function Calling**, active **Enable Tool Use**, puis active l'outil `update_about_me`.

Le personnage choisit entre deux options. Tu l'approuves d'abord.

- Public change la vraie bio vue dans chaque chat.
- Chat change une bio privée pour le chat actuel.

## Macros pour les prompts personnalisés

Tu n'as pas besoin de macros pour que les profils atteignent le modèle. Utilise-les seulement pour placer une valeur à un endroit précis dans un prompt personnalisé. Chacune est vide hors du mode Conversation. Voir [Macros](../prompts/macros.md).

| Macro | Valeur |
| --- | --- |
| `{{convo_display}}` | Le nom d'affichage du personnage qui répond. |
| `{{char_about}}` | Le **About Me** effectif du personnage. |
| `{{persona_about}}` | Le **About Me** effectif de la persona. |
| `{{convo_behavior}}` | Le **Convo Behavior** du personnage. |

## Guides associés

- [Mode Conversation : premiers pas](getting-started.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Personas utilisateur : création et modification](../characters/personas.md)
- [Macros](../prompts/macros.md)
