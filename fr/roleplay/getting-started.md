# Mode Roleplay : premiers pas

Ce guide explique ce qu'est le mode Roleplay, comment lancer un roleplay et ce que tu vois à l'écran. Au programme aussi : les réglages des sprites, la barre d'outils du chat, les **Author's Notes** (notes de l'auteur) et les guides à lire ensuite pour aller plus loin.

## À quoi sert le mode Roleplay

Le mode Roleplay est l'un des modes de chat de Marinara Engine. Les deux autres sont Conversation et Game. Le roleplay t'offre une vue de scène immersive, construite autour d'une histoire.

Une scène de roleplay peut afficher une image d'arrière-plan, des sprites de personnages et un bandeau d'état du monde. Un sprite est une image du personnage qui change selon l'émotion. Ce bandeau, appelé HUD, est la petite bande de widgets d'infos en haut du chat.

Le roleplay s'appuie aussi sur des aides appelées agents. Un agent est une petite tâche automatique qui tourne en parallèle de la réponse de l'IA. Les agents suivent l'état du monde, choisissent les sprites, sélectionnent les arrière-plans, et bien plus encore.

La génération d'images n'est pas indispensable pour utiliser le mode Roleplay. Sans elle, le mode fonctionne comme un chat en texte seul. Les emplacements de sprites restent vides, l'arrière-plan affiche une couleur unie, et le HUD continue de tout suivre. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md) pour configurer une connexion.

Choisis le mode Roleplay quand tu veux une scène immersive. Choisis le [mode Conversation](../conversation/getting-started.md) pour un chat en messages simples. Choisis [Game Mode](../game/getting-started.md) pour un jeu de rôle structuré, avec une équipe, des combats et des dés.

## Lancer un roleplay

Crée un chat Roleplay pour ouvrir l'assistant de configuration. Cet assistant compte cinq étapes. Seule la connexion à l'IA est obligatoire. Toutes les autres étapes sont facultatives et se modifient plus tard.

1. **Name & Connection** (nom et connexion). Nomme le roleplay et choisis la connexion à l'IA qui répond. Le nom peut rester vide.
2. **Pick a Preset** (choisir un preset). Un preset est un modèle de prompt enregistré : il règle la structure du prompt et les paramètres de génération. Le preset par défaut convient à la plupart des chats.
3. **Persona & Characters** (persona et personnages). Choisis le persona que tu incarnes et les personnages présents dans la scène.
4. **Attach Lorebooks** (attacher des lorebooks). Un lorebook est un recueil de faits sur ton univers, que l'IA lit quand des mots-clés apparaissent. Cette étape est facultative.
5. **Enable Agents** (activer des agents). Choisis les agents qui tournent dans ce chat. Tu peux en ajouter ou en retirer plus tard dans la section **Chat Settings** (réglages du chat), sous **Agents**.

Une fois l'assistant terminé, la scène s'ouvre et tu peux envoyer ton premier message.

## Le plateau : arrière-plan, sprites et HUD

Le plateau du roleplay, c'est la zone de scène derrière et autour de tes messages. Il comporte trois parties principales.

L'**arrière-plan** est une image pleine scène placée derrière la colonne des messages. Il change par un fondu enchaîné tout en douceur. L'agent **Background** peut en choisir un à chaque tour dans ta bibliothèque d'arrière-plans. Autre option : fixer un arrière-plan unique par chat. Voir [Arrière-plans en Roleplay](backgrounds.md) pour le système complet.

Les **sprites** sont les images de personnages posées sur le plateau. Il n'y a aucune limite fixe. Chaque personnage du chat dont les sprites sont activés peut apparaître. Les sprites exigent une bibliothèque de sprites téléversée sur la fiche de personnage. Sans elle, l'emplacement de sprite n'affiche rien. Voir [Sprites de personnage](../characters/sprites.md) pour ajouter des sprites à un personnage.

Le **HUD** est une rangée de petits widgets en haut du chat. Chaque widget appartient à un tracker, un agent de suivi : un widget n'apparaît donc que si son agent est activé. Les widgets affichent la date, l'heure, la météo, le lieu, les personnages présents, l'inventaire, les quêtes et les caractéristiques. Clique sur un widget pour ouvrir un panneau et modifier ses valeurs. Voir [HUD et trackers en Roleplay](hud-and-trackers.md) pour la liste des widgets et des modes de verrouillage.

### Réglages d'affichage des sprites

Les réglages des sprites se trouvent dans la section **Chat Settings**, sous **Agents**, sur la carte **Expression Engine**. Ils apparaissent dès qu'au moins un personnage a des sprites activés.

- **Sprite Source**. Un interrupteur avec **Expressions** et **Full-body**. Choisis l'un des deux ou les deux. Au moins un doit rester actif.
- **Expression Size**, **Full-body Size**, **Expression Opacity** et **Full-body Opacity**. Quatre curseurs qui règlent la taille des sprites et leur niveau de transparence. Ces réglages restent sur ce navigateur et ne se synchronisent pas avec les autres appareils.
- **Default Side**. Un interrupteur **Left** ou **Right** qui définit le côté où les nouveaux sprites démarrent.
- **Expression Avatars**. Quand l'option est active, les avatars des messages de la transcription reprennent le sprite d'expression du moment.

Pour déplacer les sprites à la main, clique sur le bouton **Arrange** sur le plateau. Il devient **Done** tant que le mode est actif. Fais glisser un sprite, puis clique sur la petite coche au-dessus pour valider. Clique sur **Done** pour terminer. Le bouton **Reset** efface tous les placements personnalisés.

Il est aussi possible de définir une expression en tapant la commande **/emote** dans la zone de saisie. Deux formes fonctionnent :

```
/emote happy
```

```
/emote "Aria" angry
```

La première forme définit l'expression pour la scène. La seconde vise un personnage nommé. Tape **/emote** sans autre mot pour lister les expressions disponibles pour chaque personnage de la scène.

## La barre d'outils du chat

La barre d'outils se place en haut de la zone de chat. Ses boutons ouvrent de petits panneaux contextuels. Les principaux boutons sont les suivants :

- **Chat Summary** (résumé du chat). Affiche et modifie le résumé continu du chat.
- **Active Context** (contexte actif). Liste les personnages liés, les entrées de lorebook et le preset qui ont alimenté la dernière réponse. Il indique quelles entrées de lorebook ont correspondu et ont été insérées.
- **Author's Notes**. Une note en texte libre ajoutée au prompt à chaque tour. Voir ci-dessous.
- **Gallery** (galerie). Ouvre la galerie d'images et de vidéos du chat, où tu peux générer une illustration ou un arrière-plan.
- **Chat Settings**. Ouvre le panneau latéral de réglages complet de ce chat.

### Author's Notes

**Author's Notes** est une note que tu écris et que l'IA lit à chaque génération. Utilise-la comme rappel permanent : une règle de ton, un fait caché. Ouvre-la avec le bouton en forme de stylo dans la barre d'outils.

Tape la note dans le champ. Par exemple : "Garde un ton sombre et plein de suspense. Le méchant est en réalité un allié."

Sous la note se trouve le champ numérique **Injection Depth** (profondeur d'insertion). Il détermine à quelle hauteur de l'historique du chat la note est placée. L'aide intégrée indique : "Depth 0 = after the latest message, 4 = four messages from the end." Une profondeur de 0 garde la note au plus près de la réponse la plus récente.

**Author's Notes** fonctionne de la même façon en Game Mode et en mode Conversation. Ce guide en est la référence principale.

## Le menu Agents & Actions

Le bouton en forme d'étincelle, dans la rangée du HUD, ouvre le menu **Agents & Actions** (agents et actions). Son onglet **Activity** liste les sorties des agents, appelées bulles de pensée. Tu peux les écarter une par une ou utiliser **Clear all**. Les sorties des agents personnalisés apparaissent ici aussi.

Si un agent a échoué au dernier tour, une liste d'échecs s'affiche avec un bouton pour réessayer. Depuis ce menu, tu peux aussi relancer tous les trackers. Pour une visite guidée en langage clair de tout le système d'agents, voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

Un onglet **Injections** n'apparaît que si le **Debug mode** (mode débogage) est activé. Active-le dans la section **Settings** (Paramètres), sous **Advanced**. Cet onglet montre les fragments de prompt que les agents de type rédacteur ont enregistrés avant la dernière réponse. Parmi ces agents figurent **Prose Guardian**, qui réécrit les réponses selon tes règles de style, et **Narrative Director**, qui oriente l'intrigue.

Tu peux consulter, modifier et relancer un fragment enregistré. Une modification n'agit que sur ce qui sera utilisé quand tu régénéreras cette même réponse. Elle ne change pas la réponse déjà affichée. La régénération reste ainsi stable et reproductible.

Le **Narrative Director** dispose d'un bouton **Push Story** au-dessus de la zone de saisie. Il n'arme le Director que pour la réponse suivante. Le **Narrative Director** peut aussi garder un arc caché à long terme, appelé **Secret Plot**. Voir [Narrative Director et Secret Plot](narrative-director.md) pour les deux.

## Interruptions par les personnages

Dans **Chat Settings → Agents → Roleplay Commands**, active **Interruptions** (interruptions) pour permettre aux personnages de couper le dernier message lorsqu'une intervention verbale ou physique est plausible. Cette fonction est désactivée au départ et ne nécessite aucun agent à télécharger.

Le modèle utilise `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara cherche cette expression exacte uniquement dans le message précédant immédiatement la réponse, conserve le texte jusqu'à l'expression incluse et remplace la fin par un tiret d'interruption. Le dialogue garde son guillemet fermant ; les actions n'en reçoivent pas. Si la correspondance manque ou est ambiguë, le message reste intact.

Ouvre les informations de commande de la réponse et choisis **Restore original message** (restaurer le message original) pour récupérer le message initial. La régénération restaure d'abord l'entrée originale complète, afin que la nouvelle réponse puisse choisir de l'interrompre ou non. Sélectionner une variante existante applique son interruption, sauf si tu as explicitement restauré le message. Les modifications manuelles ultérieures sont conservées au lieu d'être écrasées par une ancienne interruption.

## Echo Chamber

**Echo Chamber** est un agent facultatif qui ajoute un public en direct réagissant à ta scène. Il fonctionne comme un chat de streaming qui publie une nouvelle réaction à intervalle régulier. Active-le dans la section **Chat Settings**, sous **Agents**, sur la carte **Echo Chamber**. Le panneau flotte au-dessus de la scène et se replie en petite pastille.

## Choix CYOA

**CYOA** signifie Choose Your Own Adventure, soit "l'aventure dont tu es le héros". L'agent **CYOA Choices** est désactivé par défaut. Une fois activé, il ajoute des boutons de choix cliquables après une réponse. Quand tu cliques sur un choix, il part comme message suivant. Cela ne fonctionne que dans le mode Roleplay.

## Rencontres de combat

Le mode Roleplay propose une couche de combat légère. Active l'agent **Combat**, puis clique sur le bouton **Encounter** au-dessus de la zone de saisie (son infobulle indique "Start Combat Encounter"). Une fenêtre de configuration s'ouvre, suivie d'un écran de combat avec barres de vie et boutons d'action. C'est indépendant du combat propre à Game Mode. Voir [Rencontres de combat (Roleplay)](combat-encounters.md) pour le déroulé complet.

## Scènes

Une **scène** est une branche latérale d'un roleplay. Sers-t'en pour un flash-back, un lieu secondaire ou un chemin alternatif, sans perdre le fil principal. Une scène ne récupère pas le contexte d'une Conversation connectée, même quand le roleplay parent le fait. Voir [Scènes : créer une branche d'un roleplay](scenes.md).

## Choisir les modèles

Les valeurs par défaut conviennent bien au mode Roleplay. Deux conseils généraux aident dans la plupart des configurations.

La connexion du chat écrit la prose des personnages. Un modèle de milieu de gamme ou mieux garde une voix stable sur les longues scènes. Les connexions des agents exécutent de petites tâches structurées : lire l'état du monde, choisir une expression. Des modèles très faibles produisent parfois un état erroné ou de mauvais choix de sprites.

Rien n'empêche d'affecter aux agents un modèle moins cher qu'au chat. Beaucoup d'utilisateurs font tourner le chat sur un modèle puissant et les agents sur un modèle rapide et bon marché. Si les valeurs du HUD ou les sprites déraillent sans arrêt, bascule la connexion des agents sur un modèle plus capable. Pour les réglages du sampler, voir [Paramètres de génération](../prompts/generation-parameters.md).

## Dépannage

**Un widget du HUD affiche une valeur erronée.** C'est un tracker qui remplit chaque widget. Ouvre le panneau du widget et corrige la valeur à la main. Si les valeurs continuent de dériver, bascule la connexion de l'agent sur un modèle plus puissant. Tu peux aussi verrouiller un champ pour que la prochaine exécution automatique ne l'écrase pas.

**Les expressions des sprites ne changent pas.** Vérifie que le personnage a bien une bibliothèque de sprites téléversée. La génération d'images ne sert que si tu veux que Marinara crée de nouveaux sprites. Sans sprite à montrer, l'agent d'expression tourne mais n'a rien à afficher. Tu peux aussi définir une expression à la main avec la commande **/emote**.

**L'arrière-plan ne change jamais.** L'agent **Background** puise dans ta bibliothèque d'arrière-plans. Avec un ou deux arrière-plans seulement, il retombe toujours sur les mêmes. Ajoutes-en pour lui laisser plus de choix. Voir [Arrière-plans en Roleplay](backgrounds.md).

**Une réponse régénérée garde la mauvaise direction.** Active le **Debug mode** dans la section **Settings**, sous **Advanced**. Ouvre le menu **Agents & Actions**, va dans l'onglet **Injections**, puis modifie ou relance le fragment enregistré avant de régénérer. Pour plus d'aide, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Arrière-plans en Roleplay](backgrounds.md)
- [HUD et trackers en Roleplay](hud-and-trackers.md)
- [Rencontres de combat (Roleplay)](combat-encounters.md)
- [Narrative Director et Secret Plot](narrative-director.md)
- [Scènes : créer une branche d'un roleplay](scenes.md)
- [Sprites de personnage](../characters/sprites.md)
- [Connecter une Conversation à un Roleplay ou à une partie](../chats/connected-chats.md)
- [Macros](../prompts/macros.md)
