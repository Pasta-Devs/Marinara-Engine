# Mode Roleplay : premiers pas

Le mode Roleplay est le mode de chat pensé pour les histoires. Il ajoute un plateau derrière tes messages (un arrière-plan et des sprites de personnages) et un affichage tête haute (HUD, heads-up display) qui montre les détails de l'histoire. Un agent est une aide qui tourne en parallèle des réponses, par exemple un agent qui suit la météo ou qui choisit un sprite.

Choisis Roleplay pour une scène d'histoire. Choisis [Conversation](../conversation/getting-started.md) pour une messagerie simple, ou [Game Mode](../game/getting-started.md) pour un jeu structuré, avec une équipe, des combats et des dés. Roleplay fonctionne comme un chat en texte seul sans génération d'images : les emplacements de sprites restent vides, l'arrière-plan est une couleur unie, et le HUD continue de suivre l'histoire.

## Lancer un roleplay

Avant de commencer : ajoute un compte dans le panneau **Connections** (Connexions), sur le côté droit de l'application. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Dans la barre latérale des chats, clique sur l'onglet **RP**.
2. Clique sur le bouton **+** près du haut de la barre latérale. Son infobulle indique **New Roleplay** (nouveau roleplay).

Le chat s'ouvre avec **Chat Settings** (réglages du chat) et un assistant de configuration en cinq étapes. Seul le compte est obligatoire. Tu peux tout changer plus tard.

1. **Name & Connection** (nom et connexion). Nomme le roleplay (facultatif) et choisis la connexion qui répond.
2. **Pick a Preset** (choisir un preset). Un preset règle la structure du prompt et les valeurs de génération. Celui par défaut convient à la plupart des chats.
3. **Persona & Characters** (persona et personnages). Choisis ton persona et les personnages de la scène. À cette étape, un bouton nommé **Create your persona** (créer ton persona) peut te construire un persona à partir de quelques questions. Voir [Accueil interactif](../characters/interactive-onboarding.md).
4. **Attach Lorebooks** (attacher des lorebooks). Un lorebook est un recueil de faits sur ton univers, que l'IA lit quand leurs mots-clés apparaissent. Facultatif.
5. **Enable Agents** (activer des agents). Choisis les agents qui tournent dans ce chat. Tu peux changer cela plus tard dans **Chat Settings → Agents**.

Quand tu as terminé, tu vois le chat avec une zone de saisie. Tape ton premier message et envoie-le.

## Le plateau : arrière-plan, sprites et HUD

- **Arrière-plan** : une image pleine scène derrière tes messages, qui change en fondu. L'agent **Background** peut en choisir un à chaque tour, ou tu peux en fixer un par chat. Voir [Arrière-plans en Roleplay](backgrounds.md).
- **Sprites** : les images des personnages sur le plateau. Chaque personnage dont les sprites sont activés peut apparaître. Un personnage a besoin d'une bibliothèque de sprites sur sa fiche, sinon son emplacement reste vide. Voir [Sprites de personnage](../characters/sprites.md).
- **HUD** : tes trackers (date, heure, météo, lieu, personnes présentes, inventaire, quêtes, caractéristiques). Active-les dans **Chat Settings → Agents**. Voir [HUD et trackers en Roleplay](hud-and-trackers.md).

### Réglages d'affichage des sprites

Ouvre **Chat Settings** (le bouton de curseurs dans le chat), va dans **Agents** et trouve la carte **Expression Engine**. C'est l'agent qui choisit les expressions des sprites. Ces contrôles apparaissent dès qu'au moins un personnage a des sprites activés.

| Contrôle | Ce qu'il fait |
| --- | --- |
| **Sprite Source** (source des sprites) | Choisis **Expressions**, **Full-body** (corps entier) ou les deux. L'un des deux doit rester actif. |
| **Expression Size**, **Full-body Size** | Règlent la taille de chaque type de sprite. |
| **Expression Opacity**, **Full-body Opacity** | Règlent la transparence de chaque type. |
| **Default Side** (côté par défaut) | **Left** (gauche) ou **Right** (droite) : le côté où démarrent les nouveaux sprites. |
| **Expression Avatars** | Quand l'option est activée, les avatars des messages utilisent le sprite d'expression actuel du personnage. |

Les quatre curseurs de taille et d'opacité sont enregistrés dans ce navigateur seulement. Ils ne se synchronisent pas avec les autres appareils.

Pour déplacer les sprites à la main :

1. Clique sur **Arrange** (disposer), le bouton sur la scène. Il devient **Done** (terminé).
2. Fais glisser un sprite, puis clique sur la petite coche au-dessus pour valider.
3. Clique sur **Done** pour terminer. **Reset** (réinitialiser) efface tous les placements personnalisés.

Pour définir une expression en tapant, envoie `/emote happy` pour la scène, ou `/emote "Aria" angry` pour un seul personnage. Envoie `/emote` seul pour lister les expressions de chaque personnage.

Si ça n'a pas marché : les sprites ont besoin d'une bibliothèque de sprites téléversée sur le personnage. Sans elle, l'agent d'expression tourne mais n'a rien à afficher.

## Les outils du chat

Les outils du chat (recherche, branches, résumé, contexte actif, Agent activity, Author's Notes, Gallery) sont des sections de **Chat Settings**. Ouvre-le avec le bouton de curseurs dans le chat. Voir [Vue d'ensemble des Chat Settings](../chats/chat-settings.md) pour le rôle de chacune, et [Détacher une section dans sa propre fenêtre](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Author's Notes

**Author's Notes** (notes de l'auteur) est une note que l'IA lit à chaque réponse. Utilise-la pour un rappel permanent, comme une règle de ton ou un fait caché.

1. Ouvre **Chat Settings** et déplie **Author's Notes**, sous **Agents**.
2. Tape ta note, par exemple : "Garde un ton sombre et plein de suspense."
3. Laisse le champ **Injection Depth** (profondeur d'insertion) tel quel si tu hésites. Il règle la place de la note dans le chat : 0 la place après le message le plus récent, et 4 la place quatre messages avant la fin.

Pour une note plus longue, fais glisser le coin inférieur du champ sur ordinateur. Author's Notes fonctionne de la même façon en Game Mode et en mode Conversation.

<a id="agent-activity"></a>

## Agent activity

**Agent activity** (activité des agents) montre ce que les agents du chat ont fait. Cette section apparaît dès que le chat utilise des agents ou Advanced Memory. Tu la trouves comme section à part, juste sous **Agents** dans **Chat Settings**, en bas du Tracker Panel et, sur ordinateur, en bas de la fenêtre Trackers.

- Onglet **Activity** (activité) : les sorties que les agents ont enregistrées, appelées bulles de pensée. Écarte-en une, ou utilise **Clear all** (tout effacer). Les sorties des agents personnalisés apparaissent ici aussi.
- Pendant que les agents travaillent, son icône se change en roue de chargement. Si un agent échoue, un point apparaît sur l'icône jusqu'à ce que tu l'ouvres.
- Les agents en échec sont listés avec un bouton pour réessayer. Tu peux aussi arrêter les agents en cours, relancer les trackers et utiliser **Clear Trackers** (effacer les trackers).
- Onglet **Injections** : affiché seulement quand **Debug mode** (mode débogage) est activé dans **Settings → Advanced** (Paramètres → Avancé). Il liste les fragments de prompt que les agents de type rédacteur ont enregistrés avant la dernière réponse. Parmi ces agents figurent **Prose Guardian**, qui réécrit les réponses selon tes règles de style, et le **Narrative Director**, qui oriente l'intrigue. Tu peux consulter, modifier et relancer un fragment. Une modification ne change que ce qui sera utilisé quand tu régénéreras cette même réponse, si bien que la régénération reste reproductible. Elle ne change pas la réponse affichée à l'écran.

Pour tous les agents, voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md). Pour l'agent qui oriente l'histoire, voir [Narrative Director et Secret Plot](narrative-director.md).

## Combat et scènes

- Le mode Roleplay a une couche de combat légère. Ajoute l'agent Combat, puis clique sur **Encounter** (rencontre) au-dessus de la zone de saisie. Voir [Rencontres de combat (Roleplay)](combat-encounters.md).
- Une scène est une branche latérale pour un flash-back ou un lieu secondaire. Voir [Scènes : créer une branche d'un roleplay](scenes.md).
- Pour orienter l'intrigue, voir [Narrative Director et Secret Plot](narrative-director.md).
- Pour jouer selon des règles sur table, avec des tests de dés et des fiches de personnage, voir [Roleplay : jouer avec un ensemble de règles](rulesets.md).

## Choisir les modèles

La connexion du chat écrit la prose des personnages. Un modèle plus puissant garde la voix d'un personnage stable sur les longues scènes. Les connexions des agents exécutent de petites tâches structurées, comme lire l'état ou choisir une expression, et les petits modèles peuvent s'y tromper. Beaucoup de gens font tourner le chat sur un modèle puissant et les agents sur un modèle rapide et bon marché. Si les valeurs du HUD ou les sprites déraillent sans arrêt, passe les agents sur un modèle plus puissant. Pour les réglages du sampler, voir [Paramètres de génération](../prompts/generation-parameters.md).

## Commandes

Ce sont des fonctions facultatives. Les commandes sont des actions qu'un personnage peut faire de lui-même, écrites dans sa réponse sous forme de court texte entre crochets, comme `[illustrate: ...]`. Marinara lit ce texte entre crochets, exécute l'action et le masque dans le message.

### Activer une commande

1. Ouvre **Chat Settings → Agents** et déplie **Commands** (commandes).
2. Active l'interrupteur **Commands** en haut. Toutes les commandes qu'il contient sont désactivées au départ.
3. Active les commandes que tu veux. Une commande grisée indique ce qui lui manque encore.

- **Illustrations**, **Video clips** (clips vidéo) : ajoute l'agent Illustrator à ce chat.
- **Combat** : ajoute l'agent Combat à ce chat.
- **Soundtrack** (bande-son) : ajoute l'agent Music DJ et active les agents.
- **Personal Notes** (notes personnelles), **Reminders** (rappels), **Whisper** (murmure) : utilise un chat solo, ou un chat de groupe avec la génération **Individual** (individuel).
- **Sound Cues** (signaux sonores) : choisis une connexion Music & Sound Effects (musique et effets sonores) avec les effets sonores activés.
- **Documents**, **HTML Artifacts** (artefacts HTML), **Rolls** (jets), **Direct Messages** (messages privés), **Interruptions** : rien de plus.

**Rolls**, **Combat**, **Documents** et **Whisper** demandent aussi qui peut les utiliser : **All** (tous) les personnages, ou seulement le **Narrator** (narrateur). Le narrateur est le personnage que tu choisis sous **Narrator character** (personnage narrateur). Il peut utiliser les commandes réservées au narrateur et lire les notes, rappels et murmures de tout le monde.

Si ça n'a pas marché : il manque à une commande grisée son agent ou son type de chat. Lis la ligne sous son interrupteur.

### Illustrations

Avant de commencer : ajoute l'agent Illustrator au chat et active **Illustrations**.

Un personnage peut maintenant demander une image avec `[illustrate: subject="..." characters="..."]`. L'image utilise les réglages Illustrator du chat et apparaît sous le message.

Active **Render in-line** (afficher dans le texte) pour afficher chaque image à l'intérieur du message, là où le personnage a écrit la commande. Sélectionne une image pour voir son prompt, ou utilise **X** pour la retirer. Le réglage s'applique seulement aux nouvelles images. Les images que l'agent Illustrator crée de lui-même et la disposition Visual Novel ne changent pas.

Tu peux aussi créer une illustration toi-même avec `/illustrate`. En Roleplay, cette commande a besoin de l'agent Illustrator.

<a id="artifacts-on-demand"></a>

### Artefacts à la demande

Active **HTML Artifacts** pour laisser le narrateur créer un objet propre à l'univers de l'histoire, comme une page de grimoire, un panneau, un croquis sur une lettre ou l'affichage d'un terminal. La commande est `[html: prompt="..."]`. Elle ne nécessite aucun agent. Tu peux aussi en demander un toi-même avec `/html <what you want>`.

L'artefact apparaît là où le narrateur a placé la commande, une fois la réponse terminée. Dans la disposition Visual Novel, tu ne vois qu'un marqueur. Une réponse peut créer au maximum 3 artefacts, et chacun fait l'objet d'une requête séparée au modèle. La requête utilise la connexion de l'agent **Immersive HTML** s'il en a une, sinon ta connexion d'agent par défaut, sinon la connexion du chat. Le réglage **Parallel requests** (requêtes en parallèle) de cette connexion (dans l'éditeur de compte) fixe combien de requêtes tournent en même temps. Pour une simple page mise en forme, les types de **Documents** intégrés sont gratuits et instantanés.

Le narrateur ne voit pas le HTML de l'artefact. Aux tours suivants, il en voit une courte version en texte brut : le texte lisible de l'artefact et une ligne sur son apparence. Ouvre le marqueur "used html command" sous le message pour lire ou modifier ce texte, ou pour supprimer l'artefact, ce qui le retire aussi de la mémoire du narrateur. Si une exécution échoue, le marqueur en indique la raison.

<a id="whispers-and-secrets"></a>

### Murmures et secrets

Active **Whisper** pour des apartés privés, des secrets et des visions dans une réponse. La commande est `[whisper: character="name" text="the secret"]`. Nomme exactement un personnage du chat, ou ton persona. Seuls ce personnage et le narrateur reçoivent le texte dans leurs prompts. Un nom inconnu ou ambigu est ignoré, pour que le secret ne fuite pas.

- **Reveal a secret** (révéler un secret) affiche un murmure sur ton écran. Cela change seulement ce que tu vois, pas ce que savent les personnages. Les murmures adressés à ton persona sont visibles tout de suite.
- **Edit whisper** (modifier le murmure) te permet de changer le texte, puis de choisir **Save** (enregistrer). Pour retirer un murmure, efface son texte et choisis **Save**. **Cancel** (annuler) le laisse tel quel.
- Tu peux écrire un murmure dans ton propre message pour murmurer à un personnage. La même commande entre crochets fonctionne quand tu modifies le message d'un personnage ou du narrateur. Le texte peut s'étendre sur plusieurs lignes et garder des guillemets, comme `text=""I love you.""`.
- Un message qui ne contient qu'un murmure est masqué pour les personnages qu'il n'atteint pas.
- Si tu utilises **Hide from AI** (masquer à l'IA) sur un message pour certains personnages, le destinataire du murmure reçoit quand même le murmure, mais rien du reste du message.

Les agents peuvent aussi lire les murmures :

- Ces agents les lisent : Echo Chamber, les trackers, Lorebook Keeper et Long-Term Memory. Dans les chats de groupe, l'ordre de réponse **Smart** (intelligent) les lit aussi, si bien qu'un murmure peut faire répondre ce personnage ensuite.
- Chaque murmure est marqué comme privé et nomme son destinataire. Ce qu'un agent écrit à partir de lui, comme une entrée de lorebook ou une note de tracker, peut quand même atteindre d'autres personnages.
- Dans un salon multijoueur hébergé, les agents et l'ordre de réponse **Smart** ne reçoivent aucun murmure.
- Relationship Tracker et Memory Nag lisent eux-mêmes le chat et ne voient pas encore les murmures.

<a id="your-private-notes"></a>

### Tes notes privées

Active **Personal Notes**, puis écris `[notes: content="your private note"]` dans ton propre message. Seul le narrateur reçoit ces notes, pas les autres personnages ni les agents partagés. Utilise les détails de commande du message pour en modifier ou en supprimer une. Si un personnage est désactivé ou retiré du groupe, le narrateur cesse de recevoir les notes de ce personnage. Réactiver le personnage les rétablit.

Tu peux aussi garder une note sur un seul message :

1. Choisis **Bookmark, pin or note** (ajouter un signet, épingler ou annoter) sous le message.
2. Écris une **Private note** (note privée). Par défaut, elle reste privée et n'est pas envoyée au modèle.
3. Pour la partager avec le modèle, active **Show the note to the narrator character** (montrer la note au personnage narrateur) et choisis un personnage. Seul ce personnage reçoit la note, à côté de ce message. Le partage nécessite un chat solo ou la génération de groupe **Individual**.

**Remove note** (supprimer la note) met aussi fin à son partage.

<a id="video-clips"></a>

### Clips vidéo

Avant de commencer : ajoute l'agent Illustrator au chat et choisis une connexion vidéo dans **Scene Videos** (vidéos de scène) d'Illustrator.

Active **Video clips** pour laisser les personnages demander un court clip d'un moment clé avec `[video: subject="the moment" motion="what moves and how the camera moves" characters="names"]`. Le modèle a pour consigne de le préférer à `[illustrate]` quand le moment repose sur le mouvement. Le clip part de l'image définie par le réglage **First frame** (première image) d'Illustrator (une nouvelle image d'Illustrator, l'avatar ou le sprite du personnage, ou aucune). Il se lit dans la réponse quand il est prêt. Un clip n'est proposé que tant que **Video Run Interval** (intervalle entre les vidéos) le permet, et il compte dans **Videos per reply** (vidéos par réponse).

### Interruptions par les personnages

Active **Interruptions** pour laisser un personnage couper le dernier message quand une interruption s'y prête. La commande est `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara trouve cette expression dans le message juste avant la réponse, garde le texte jusqu'à elle et le termine par un tiret. Le dialogue garde son guillemet fermant. Si l'expression est absente ou apparaît deux fois, le message reste tel quel.

Pour récupérer l'original, ouvre les informations de commande de la réponse et choisis **Restore original message** (restaurer le message original). Une régénération restaure d'abord l'original complet, pour que la nouvelle réponse puisse choisir à nouveau. Choisir un swipe existant applique l'interruption de ce swipe, sauf si tu l'as restauré. Tes modifications manuelles ultérieures sont conservées.

## Echo Chamber

**Echo Chamber** est un agent facultatif qui ajoute un public en direct réagissant à ta scène, comme un chat de streaming qui publie une nouvelle réaction à intervalle régulier. Active-le dans **Chat Settings → Agents**, sur la carte **Echo Chamber**.

- Sur ordinateur, fais glisser sa barre de titre pour le déplacer, et un bord pour le redimensionner. Épingle-le pour le garder ouvert. **X** le réduit à un bouton déplaçable.
- Sur téléphone, il démarre dans une fenêtre compacte au-dessus des messages. Fais glisser sa barre de titre pour le déplacer, ou un bord ou un coin pour le redimensionner. L'épingle le garde ouvert quand tu appuies ailleurs, et le verrou empêche les déplacements accidentels.
- Il suit ton **Chat widget style** (style des widgets du chat) dans **Settings → Appearance → App** (Paramètres → Apparence → Application). Chaque chat mémorise sa disposition.

## Choix CYOA

CYOA signifie Choose Your Own Adventure, soit "l'aventure dont tu es le héros". L'agent CYOA Choices est désactivé par défaut et ne fonctionne qu'en Roleplay. Quand il est activé, il ajoute des boutons de choix cliquables après une réponse, et cliquer sur l'un d'eux l'envoie comme ton message suivant. Pour combiner des choix ou en modifier un d'abord, active **Add CYOA choices to the message box instead of sending them** (ajouter les choix CYOA à la zone de saisie au lieu de les envoyer) dans **Settings → General → Input & Editing** (Paramètres → Général → Saisie et édition). Cliquer sur un choix ajoute alors son texte à ta zone de saisie.

## Dépannage

| Symptôme | Solution |
| --- | --- |
| Une valeur du HUD est fausse. | Modifie-la à la main et verrouille-la pour que la prochaine exécution n'y touche pas. Voir [HUD et trackers en Roleplay](hud-and-trackers.md). Si les valeurs continuent de dériver, utilise un modèle d'agent plus puissant. |
| Les sprites ne changent pas. | Vérifie que le personnage a une bibliothèque de sprites. Tu peux aussi utiliser `/emote`. |
| L'arrière-plan ne change jamais. | L'agent **Background** choisit dans ta bibliothèque : ajoute donc d'autres arrière-plans. Voir [Arrière-plans en Roleplay](backgrounds.md). |
| Une réponse régénérée garde la mauvaise direction. | Active **Debug mode**, ouvre **Agent activity → Injections**, puis modifie ou relance le fragment enregistré avant de régénérer. |

Pour plus d'aide, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Arrière-plans en Roleplay](backgrounds.md)
- [HUD et trackers en Roleplay](hud-and-trackers.md)
- [Rencontres de combat (Roleplay)](combat-encounters.md)
- [Narrative Director et Secret Plot](narrative-director.md)
- [Roleplay : jouer avec un ensemble de règles](rulesets.md)
- [Scènes : créer une branche d'un roleplay](scenes.md)
- [Sprites de personnage](../characters/sprites.md)
- [Connecter une Conversation à un Roleplay ou à une partie](../chats/connected-chats.md)
- [Macros](../prompts/macros.md)
