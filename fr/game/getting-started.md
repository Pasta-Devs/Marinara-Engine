# Game Mode : premiers pas

Game Mode transforme Marinara Engine en jeu de rôle solo, mené par un Game Master piloté par l'IA. Ce guide t'aide à lancer une partie, à jouer le premier tour et à trouver les contrôles.

Game Mode est l'un des trois modes de chat (Conversation, Roleplay et Game Mode). Le Game Master (GM), ou maître du jeu, est l'IA qui narre le monde, joue tous les personnages que tu croises et décide de la suite, comme le Dungeon Master d'un jeu de rôle sur table. Marinara suit la carte, ton équipe, les personnages non-joueurs (PNJ), les objets, les quêtes, l'heure dans le monde et la météo. Tu peux découper une longue partie en plusieurs **sessions**, comme les soirées de jeu d'une même campagne.

Rien ne t'oblige à utiliser toutes les mécaniques. Tu peux laisser de côté le combat et les dés, et jouer pour l'histoire.

## Avant de commencer

Il te faut une seule chose : un compte d'IA pour le Game Master. Si tu n'en as pas encore ajouté, va voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

Tout le reste est optionnel et désactivé par défaut. Tu peux l'ajouter plus tard :

- **Les images.** L'agent **Illustrator** dessine les portraits des PNJ, les arrière-plans des lieux et les images de scène. Télécharge-le depuis **Agents → Agent Organizer** (Agents → organisateur d'agents). Il lui faut un compte de génération d'images. Sans lui, tu gardes l'histoire, le suivi de l'état et le combat, mais les zones visuelles restent vides.
- **Les effets de scène avec le Built-in model (modèle intégré).** Marinara peut faire tourner un petit modèle sur ton propre ordinateur pour choisir les arrière-plans et la musique, sans frais. Il devient le **Scene effects model** (modèle des effets de scène) par défaut une fois que tu l'as téléchargé. D'ici là, le choix par défaut est **Skip - use inline tags from GM** (ignorer, utiliser les balises en ligne du GM). Voir [Configuration du modèle intégré](../connections/local-model.md).
- **Les storyboards.** Télécharge l'agent Storyboard, puis active-le pour la partie. Voir [Guide de l'agent Storyboard](storyboard.md).
- **La vidéo.** Un compte de génération de vidéos n'est nécessaire que pour les vidéos de scène ou les storyboards animés.
- **La musique.** L'agent **Music DJ** joue de la musique depuis Spotify ou un dossier de musique local.

## Lancer une partie

1. Clique sur **Chats** dans la barre du haut, ouvre l'onglet **GM** et clique sur le bouton **+** (**New Game**, nouvelle partie). Tu peux aussi cliquer sur **Game** dans l'écran d'accueil. L'assistant de configuration s'ouvre. Voir [Gérer la liste des chats](../chats/managing-chats.md).
2. À la première étape, choisis le **Model** (modèle) qui fait tourner le GM. Choisis un compte que tu as déjà ajouté. Si la liste est vide, ajoutes-en un d'abord. Pour la génération du monde, prends un modèle payant performant (voir [Choisir un modèle](#choosing-a-model)).
3. Clique sur **Next** (suivant) à chaque étape. Tous les autres champs ont une valeur par défaut : tu peux donc simplement cliquer jusqu'au bout.
4. À la dernière étape, clique sur **Create world** (créer le monde). Le bouton affiche **Generating World…** pendant que Marinara construit ton monde. C'est une seule grosse requête à ton modèle : attends qu'elle se termine.
5. Quand le monde est prêt, l'écran de jeu affiche **Start Game** (démarrer la partie). Clique dessus. Le GM écrit alors le premier message.

Si les widgets HUD personnalisés sont activés (c'est le cas par défaut), un bouton **Review Starting Widgets** (vérifier les widgets de départ) se trouve sous **Start Game**. Tu peux l'ignorer, ou t'en servir pour modifier d'abord les widgets de départ. Voir [Game Mode : les widgets HUD](hud-widgets.md).

> **Astuce :** si tu débutes en Game Mode, laisse **Game Master Mode** (mode du Game Master) sur **Standalone GM**. Marinara te construit un narrateur sarcastique.

Si ça n'a pas marché, voir [La génération du monde échoue avec une erreur JSON ou 422](#world-generation-fails-with-a-json-or-422-error).

### L'assistant de configuration

| Étape | Ce que tu définis |
| --- | --- |
| **Connection** (connexion) | **Game Name** (nom de la partie), le **Model** qui fait tourner le GM et un **Scene effects model** facultatif. L'encart **Game Mode** n'affiche que **VN** pour l'instant. |
| **World** (monde) | Le genre, le cadre, le ton, la difficulté, la classification du contenu, le style de l'histoire, la violence, les limites de contenu et la langue. **Combat Preference** (préférence de combat) se règle sur **Turn-Based** ou **Tactical**. Chaque nouvelle partie utilise les classes **MRPG** (Marinara RPG) (voir [Classes MRPG](mrpg-classes.md)). Quand un ensemble de règles est installé, un choix **Rules** (règles) apparaît (voir [Choisir les règles](#choose-rules)). |
| **Party** (équipe) | Ton persona (le personnage que tu incarnes), le **Game Master Mode**, les membres de l'équipe et le **GM intro message** (message d'introduction du GM). Voir [Le message d'introduction du GM](#the-gm-intro-message). L'arbre MRPG de départ de chaque membre vient de la section **Game Mode** de sa fiche (voir [Choisir les arbres d'un personnage](mrpg-classes.md#choose-a-characters-trees)). |
| **Goals** (objectifs) | Ce que tu attends de l'aventure. |
| **Lorebooks** | Les lorebooks qui font foi pour le GM. Un lorebook est un recueil de faits sur ton univers. Voir [Lorebooks](../lorebooks/overview.md). |
| **Features** (fonctionnalités) | **Enable Agents** (activer les agents), puis un encart pour chaque agent téléchargé (**Illustrator**, **Music DJ**, **Lorebook Keeper**), ainsi que **Custom HUD Widgets** (widgets HUD personnalisés), **Quick Time Events** et **Start Muted** (démarrer en sourdine). |
| **GM** | Le style de présentation et le **GM Prompt** (prompt du GM). |

Les idées proposées sous le cadre et les objectifs changent à chaque ouverture de l'assistant. Dans une partie Tactical, le GM rédige une courte description de chaque combat, et Marinara construit un plateau à partir de celle-ci. Voir [Combat](combat.md#tactical-battles-and-terrain).

L'étape **World** propose aussi des options de combat pour les boss. **GM directs bosses** (le GM dirige les boss) est activé par défaut. Il laisse le GM décider des tours des boss avec ta connexion de GM, ce qui peut prendre un moment. Les ennemis ordinaires décident seuls, sauf si **GM directs bosses** est activé et que l'ensemble de règles de la partie confie l'opposition au Game Master (voir [Texte du Game Master](../extending/ruleset-sheets.md#game-master-text)). Tant que **GM directs bosses** est activé, **Game Master also plays named and brilliant opponents** (le Game Master joue aussi les adversaires nommés et brillants), activé par défaut, permet au GM de jouer aussi les personnages nommés et les ennemis très rusés. Deux autres options sont toujours affichées : **Companions fight on their own** (les compagnons combattent seuls), activé par défaut (désactive-le pour jouer toi-même toute l'équipe), et **Let cruel opponents strike the fallen** (laisser les adversaires cruels frapper ceux qui sont à terre), désactivé par défaut. Une nouvelle partie propose aussi **Permadeath** (mort permanente), désactivé par défaut : un membre de l'équipe qui tombe au combat et n'est pas sauvé avant la fin disparaît définitivement. Voir [Combat](combat.md).

Avec l'agent **Hierarchical Maps** téléchargé (désormais appelé World Maps, voir [World Maps](../agents/hierarchical-maps.md)) et **Enable Agents** activé, l'étape **Features** peut aussi esquisser une **Hierarchical world map** (carte hiérarchique du monde), utiliser un modèle de carte enregistré ou lier un monde partagé.

### Valeurs par défaut à connaître

| Réglage | Par défaut | Notes |
| --- | --- | --- |
| Genre | Fantasy | Choix multiple, avec tes propres entrées. |
| Tone | Heroic | Choix multiple. |
| Difficulty | Normal | **Casual**, **Normal**, **Hard** ou **Brutal**. Plus le niveau est élevé, plus les combats sont difficiles : des ennemis plus nombreux et plus puissants dans une partie MRPG (voir [Batailles dans une partie MRPG](combat.md#battles-in-an-mrpg-game)), et des ennemis qui frappent plus fort dans une partie Legacy (voir [L'ajustement selon la difficulté](combat.md#difficulty-scaling)). |
| Content Rating (sexual content) (classification du contenu (contenu sexuel)) | SFW | **SFW** ou **NSFW**. Concerne uniquement le contenu sexuel. NSFW l'autorise, sans l'imposer. |
| Story style (style de l'histoire) | Standard | **Gentle** : un GM plus doux et moins stressant. Voir [Style de l'histoire, violence et limites de contenu](#story-style-violence-and-content-boundaries). |
| Violence | Serious (SFW) ou Graphic (NSFW) | **Mild** : légère, **Serious** : grave ou **Graphic** : explicite. Réglage distinct de la classification du contenu. |
| Content boundaries (limites de contenu) | Aucune | Sujets que le GM exclut de l'histoire. |
| Language | English | Tout le texte en jeu est écrit dans cette langue. |
| Game Master Mode | Standalone GM | **Character GM** prend une de tes fiches de personnage comme GM. |
| Scene effects model | Built-in model | Seulement une fois que tu l'as téléchargé. D'ici là, le choix par défaut est **Skip - use inline tags from GM**. |
| Enable Agents | Off | À activer pour voir les encarts des agents. |
| Illustrator | Off | Nécessite l'agent Illustrator et un compte de génération d'images. |
| Music DJ | Off | Nécessite Spotify ou un dossier de musique local. |
| Custom HUD Widgets | On | Le modèle conçoit des widgets d'état pour le nouveau monde. |
| Quick Time Events | On | À désactiver pour jouer avec un lecteur d'écran ou sans limite de temps. |
| Start Muted | Off | Démarre la partie avec tout le son coupé. |
| Game Presentation | Standard | Voir plus bas. |

### Style de l'histoire, violence et limites de contenu

L'étape **World** propose quatre réglages qui déterminent ce que l'histoire peut contenir et l'intensité de ses conséquences. Ils sont regroupés sous **Content Rating (sexual content)**. Tu peux tous les modifier après le début de la partie, sauf la classification du contenu. Voir [Les modifier pendant une partie](#change-them-during-a-game).

| Réglage | Ce qu'il détermine |
| --- | --- |
| **Content Rating (sexual content)** | **SFW** : romance et affection, et les scènes de sexe passent au noir. **NSFW** : les scènes de sexe peuvent être décrites explicitement. Ce réglage ne détermine rien d'autre. |
| **Story style** | **Standard** : les erreurs et la malchance ont de vraies conséquences. **Gentle** : de vrais défis, mais les revers ne tournent pas à la punition ou au traumatisme. |
| **Violence** | **Mild**, **Serious** ou **Graphic** : la façon de représenter la violence. Le réglage initial est **Serious** pour SFW et **Graphic** pour NSFW, ce qui correspond depuis toujours à ces classifications. |
| **Content boundaries** | Sujets que tu ne veux jamais voir dans l'histoire, un par ligne, comme `harm to animals`. |

#### Le style d'histoire Gentle

Choisis **Gentle** si tu veux profiter de l'histoire et de ses personnages sans que le GM punisse chaque faux pas. Avec **Gentle** :

- Les revers font perdre du temps, la face ou des ressources, ou imposent un détour. Le GM n'y répond pas par des blessures, de l'humiliation, la perte d'un proche ou un traumatisme vers lequel tu n'as pas orienté l'histoire.
- Le GM ne demande un jet de compétence que lorsque les compétences ou les choix de ton personnage comptent. Il ne fait jamais de jet contre quelque chose que ton personnage ne peut pas contrôler, comme un handicap, une maladie, son corps ou ses origines. Voir [Jets de compétence dans une partie Gentle](dice-and-skill-checks.md#skill-checks-in-a-gentle-game).
- Le monde est conçu avec chaleur : les arcs narratifs naissent autant des espoirs et des relations que des blessures, et les rebondissements te surprennent sans te trahir.

**Gentle** remplace uniquement les instructions intégrées du GM. Si tu as écrit ton propre **GM Prompt**, le GM conserve ton texte. Le combat, les dégâts et le réglage de difficulté fonctionnent de la même façon dans les deux styles.

#### Limites de contenu

Écris un sujet par ligne, jusqu'à 40 sujets et 2 000 caractères au total. Tout ce qui dépasse l'une de ces limites est omis. Le GM traite chaque sujet comme une limite absolue, qui prime sur la classification, le ton, la personnalité des personnages et l'intrigue. Il ne les évoque pas, ne s'en sert pas comme menace, rebondissement ou élément du passé, et n'y fait pas allusion. Si tu en évoques un toi-même, le GM reste bref et passe à autre chose. Les limites s'appliquent aux deux styles d'histoire et aux deux classifications, et tes propres règles de classification ne peuvent pas les supprimer.

> **Remarque :** l'histoire est écrite par un modèle d'IA, donc Marinara ne peut pas garantir qu'un sujet de la liste n'apparaîtra jamais. Si l'un d'eux apparaît, génère un autre swipe ou modifie la réponse.

#### Modifier les règles de classification

Sous les boutons de classification, déplie **Edit rating guidelines** (modifier les règles de classification) pour voir le texte que le GM reçoit pour la classification, la violence et le style d'histoire choisis. Modifie-le pour définir tes propres règles de contenu pour cette partie, ou clique sur **Reset to default** (réinitialiser par défaut) pour revenir au texte intégré. Tant que tu le laisses inchangé, il suit la classification, la violence et le style que tu choisis.

#### Les modifier pendant une partie

Ouvre **Chat Settings → Prompt Preset** (réglages du chat → preset de prompt). Dans une partie, cette section contient aussi **Story style**, **Violence**, **Content boundaries** et **Rating guidelines** (règles de classification). Les changements s'appliquent dès le tour suivant. La classification du contenu elle-même est fixée à la création de la partie.

Un preset de prompt peut aussi contenir un style d'histoire, un niveau de violence et des limites, pour les réutiliser dans chaque partie. Voir [Réglages d'histoire du jeu](../prompts/presets.md#game-story-settings).

<a id="choose-rules"></a>

### Choisir les règles

**Rules** n'apparaît que pour une nouvelle partie, et seulement si au moins un ensemble de règles est installé. **Marinara's own rules** (règles propres à Marinara) est le choix par défaut : les tests intégrés au d20 et la fiche à six attributs. Un ensemble de règles comme **5e (SRD 5.1)** les remplace par les tests et la fiche de personnage propres à un système de jeu de rôle sur table, et peut aussi résoudre les combats selon ses propres règles. L'assistant montre ce que couvre chaque ensemble de règles. Le choix est fixé une fois la partie créée. Voir [Jouer avec un ensemble de règles](rulesets.md).

<a id="the-gm-intro-message"></a>

### Le message d'introduction du GM

**GM intro message** (à l'étape **Party**) décide de la façon dont la partie s'ouvre :

- **None** (aucun), le choix par défaut : le GM ouvre la partie comme il l'entend.
- **Defined** (défini) : saisis le premier message exactement tel qu'il doit se lire. La partie s'ouvre avec ce texte, et le régénérer donne le même texte.
- **Guided** (guidé) : décris comment l'ouverture doit se passer, par exemple où elle commence et qui est là. Le GM écrit l'ouverture à partir de là.

Le texte peut compter jusqu'à 8 000 caractères. Il ne peut pas contenir de doubles accolades, et le texte **Guided** ne peut pas non plus contenir de crochets. Le champ t'indique quand le texte ne peut pas être utilisé. L'histoire d'un monde peut définir sa propre introduction. Le champ l'affiche alors comme verrouillée, et tu ne peux pas la changer.

### Storyboard Optimized

À l'étape **GM**, **Game Presentation** (présentation de la partie) peut valoir **Standard** ou **Storyboard Optimized**. **Storyboard Optimized** utilise le Storyboard Game Prompt, qui façonne les tours du GM en séquences visuelles filmables. Il ne télécharge pas l'agent Storyboard et ne l'active pas, il n'active pas la génération d'images ou de vidéos et il ne change pas tes comptes. Une fois la partie créée, configure tout cela dans **Chat Settings → Agents → Storyboards** (réglages du chat → agents → storyboards).

L'éditeur **GM Prompt** affiche un aperçu du prompt de la présentation choisie. Si tu laisses le texte tel quel, le preset intégré reste sélectionné. Si tu le modifies, ton texte prend le pas sur le preset.

Une autre combinaison, celle du plan unique façon anime, reste disponible après la configuration : choisis **Anime Episode Director** pour l'Animation Planner et **Anime Game Video** pour le Storyboard Video Prompt.

## Jouer ton premier tour

Tape ce que ton personnage fait ou dit, puis envoie-le. Le GM répond, met à jour le monde et peut demander un jet de dés ou lancer un combat.

Le bouton en forme de bulle, à côté du bouton de pièces jointes (infobulle **Choose who to address**, choisir à qui s'adresser), définit qui reçoit ton message :

| Mode | Ce qu'il fait |
| --- | --- |
| Par défaut | Ton message part dans la scène, comme une action ou une réplique. Le GM et ton équipe répondent dans l'histoire. |
| **Talk to Party** (parler à l'équipe) | Ajoute un marqueur `[To the party]` et s'adresse à tes compagnons. N'apparaît que si ton équipe n'est pas vide. |
| **Talk to GM** (parler au GM) | Ajoute un marqueur `[To the GM]` et interroge le GM hors personnage, par exemple "Est-ce que mon personnage connaît le temple ?". |

Le mode actif affiche **On** dans le menu. Clique de nouveau sur la même entrée pour le désactiver.

<a id="the-games-controls"></a>

## Les contrôles du jeu

Sur ordinateur, les contrôles s'ouvrent avec les boutons près du coin supérieur droit du chat. Sur téléphone, ils se trouvent dans le menu à trois points déplaçable **Chat tools** (outils du chat).

| Contrôle | Ce qu'il contient |
| --- | --- |
| **Game controls** (contrôles du jeu, icône de manette) | **Retry turn** (relancer le tour), **Retry scene analysis** (relancer l'analyse de scène), **Retry Music DJ** (relancer Music DJ, quand Music DJ joue la musique) et **Retry assets image generation** (relancer la génération des images des ressources). Pour un arrière-plan de storyboard, aussi relecture, lecture/pause et coupure du son. **Edit game data** (modifier les données de jeu) corrige à la main les données enregistrées (voir [Modifier les données de la partie à la main](sessions-and-saves.md#editing-game-data-by-hand)). **Checkpoints** (points de contrôle) ramène la partie à un moment antérieur (voir [Comment ta partie s'enregistre](sessions-and-saves.md#how-your-game-saves)). |
| **Session** (icône de plume) | L'historique des sessions, le journal et les contrôles de session. Voir [Game Mode : sessions et sauvegardes](sessions-and-saves.md). |
| **Volume** (icône de haut-parleur) | Le volume de **Master** (général), **Music** (musique), **Sound Effects** (effets sonores), **TTS** (synthèse vocale) et **Ambient** (ambiance). |
| **Game Assets** (ressources de jeu, icône de dossier) | Les médias de scène et l'Asset Browser. Voir [Ressources de jeu](game-assets.md). |
| **Connected chat** (chat connecté) | Affiché quand la partie est liée à un chat Conversation. Voir [Chats connectés](../chats/connected-chats.md#switching-between-connected-chats). |

Choisis un outil pour l'ouvrir dans une fenêtre déplaçable sur ordinateur, ou dans un panneau sur toute la largeur sur téléphone. Sur ordinateur, fais glisser le bouton d'un outil pour le déplacer. Sur téléphone, déplace le menu à trois points, ou déverrouille-le pour réordonner les outils qu'il contient. Voir [Fenêtres de contrôles et leurs boutons](../chats/chat-settings.md#control-windows-and-their-buttons).

Tu peux aussi garder un contrôle dans **Chat Settings**. Ouvre la fenêtre du contrôle et choisis **Put back in Chat Settings** (remettre dans Chat Settings). Il y apparaît alors comme une section repliable, et son bouton de détachement en refait une fenêtre. Chaque partie enregistre ton choix. **Reset View** (réinitialiser la vue) rétablit la disposition de départ.

**Character Profiles** (profils des personnages) reste en dehors de Chat tools, sur ordinateur comme sur téléphone. Fais glisser son bouton en forme de portrait où tu veux, puis ouvre-le pour choisir un membre de l'équipe et consulter ou modifier sa feuille de personnage. Sur téléphone, **Map** (carte) a aussi son propre bouton déplaçable. Les deux suivent le style de widget de ton chat, enregistrent leur position pour cette partie et peuvent être verrouillés depuis leur fenêtre ouverte.

<a id="choosing-a-model"></a>

## Choisir un modèle

La génération du monde est la partie la plus difficile de Game Mode. Elle demande au modèle un long document JSON strict (un format texte qui doit être exact, sinon le jeu ne peut pas le lire), sans le moindre champ manquant. Un modèle à l'aise dans un chat peut malgré tout échouer à cette étape.

- Pour la génération du monde, prends un modèle récent et performant, du haut du panier, sur un compte payant. En 2026, les joueurs rapportent de bons résultats avec les gammes phares des grands fournisseurs, comme Anthropic Claude, OpenAI GPT et Google Gemini. Les noms de modèles changent souvent : vois-y des exemples, pas une liste figée.
- Les modèles les moins chers que nous recommandons, tous deux testés en jeu au 31/10/2026, sont DeepSeek V4 Flash et Claude Haiku 5.5.
- Pour les tours suivants, tu peux parfois passer à un modèle moins cher, car un tour demande de la narration, pas du JSON strict. Si le GM oublie des PNJ ou contredit des détails passés, reviens à un modèle plus solide.
- Évite les modèles gratuits ou à routage automatique pour la génération du monde. Ils peuvent basculer vers un petit modèle incapable de produire un JSON valide. Les petits modèles à poids ouverts échouent en général aussi.

Pour la référence complète des paramètres, voir [Paramètres de génération](../prompts/generation-parameters.md).

## Ce que coûte un tour

Game Mode fait trois types de requêtes à l'IA :

1. **La génération du monde.** Une seule fois, quand tu cliques sur **Start Game**. Une grosse requête qui renvoie la présentation du monde, la carte de départ, les PNJ, les feuilles de l'équipe et les widgets.
2. **Les tours de jeu.** Chaque message construit un nouveau prompt avec l'état courant. Le GM narre et met à jour le monde. C'est le moteur, et non le modèle, qui fait les calculs des rounds de combat : les résultats restent justes.
3. **Les résumés de session.** Quand tu termines une session, le GM écrit un récapitulatif et des notes de continuité. Quand tu démarres la suivante, il écrit un court message de transition. Les sessions plus anciennes sont compressées en résumés, pour que les longues campagnes tiennent dans le modèle.

<a id="optional-tool-planning-and-lore-searches"></a>

## Planification facultative des outils et recherches dans le lore

Pendant la partie, ouvre **Chat Settings → Function Calling** (réglages du chat → appels de fonctions).

- **Let the GM search lore** (laisser le GM rechercher dans le lore) permet au GM de chercher des faits des lorebooks par leur sens. Active d'abord la vectorisation des lorebooks et vectorise leurs entrées. Les recherches respectent les livres et dossiers activés ainsi que les interrupteurs d'entrées propres au chat. Elles utilisent ton compte d'embeddings et peuvent ajouter une requête au modèle. Les chats Game ont besoin de cet interrupteur pour les recherches dans les lorebooks, même quand **Enable Tool Use** (autoriser l'usage des outils) est activé. Tant qu'il est désactivé, `search_lorebook` est indisponible dans le sélecteur d'outils.
- **Game tool provider** (fournisseur des outils du jeu) vaut par défaut **Same as narrator** (comme le narrateur), ce qui conserve la boucle d'outils habituelle (jusqu'à quatre cycles d'outils par tour). Choisir un autre compte lance une requête de planification séparée avant la narration. Ce modèle choisit les outils, et le narrateur reçoit leurs résultats sous forme de texte. Cela coûte une requête de plus par tour sur ce compte. Un modèle moins cher peut réduire le coût, mais choisir d'autres outils. Une seule phase de planification ne peut pas enchaîner une deuxième recherche.
- **Finish rolled turns in one request** (terminer les tours avec des dés en une requête) est activé par défaut et économise une requête sur les tours où l'on lance des dés. Voir [Game Mode : jets de dés et jets de compétence](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Les comptes par abonnement Claude et Grok ne prennent pas en charge les appels natifs aux outils. Les contrôles l'expliquent et restent désactivés tant qu'un **Game tool provider** compatible n'est pas choisi. Les commandes textuelles et les balises de dés fonctionnent toujours. Si un compte séparé manque ou si sa requête échoue, le tour signale l'échec au lieu de narrer sans le travail des outils.

Si tes modèles locaux partagent une mémoire GPU limitée, ouvre **Chat Settings → Agents** (réglages du chat → agents) et active **Run Game tasks one at a time** (exécuter les tâches Game une par une). La narration, les agents et les médias de scène s'attendent alors les uns les autres dans ce chat Game. L'option est désactivée par défaut et ne réserve pas le GPU face aux autres chats ou applications.

## Activer les agents

Les agents sont des aides IA facultatives qui tournent aux côtés du GM. Ils font des requêtes supplémentaires, ce qui augmente le coût. Pour t'en servir, ouvre **Chat Settings → Agents** pendant la partie et active **Enable Agents**. Deux agents sont utiles en Game Mode :

- **Game Session Keeper** aide à maintenir la continuité d'une session à l'autre.
- **Music DJ** choisit la musique d'ambiance.

**Review Agent Outputs** (relire les sorties des agents) te permet de vérifier ce qu'un agent a produit. Voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

## Dépannage

<a id="world-generation-fails-with-a-json-or-422-error"></a>

### La génération du monde échoue avec une erreur JSON ou 422

Le modèle n'a probablement pas réussi à produire l'intégralité du JSON. Essaie ceci, dans l'ordre.

1. Regarde quel modèle utilise le GM. Si c'est un modèle gratuit ou à routage automatique, passe à un modèle payant performant.
2. Réessaie. Certains échecs sont ponctuels.
3. Raccourcis un champ de cadre ou de préférences trop long. Une saisie longue laisse moins de place au JSON.

Si un appel a presque abouti, Marinara propose une fenêtre **Repair JSON** (réparer le JSON) avec la sortie brute du modèle dans un éditeur numéroté ligne par ligne. Une ligne d'état indique si le JSON est valide, ou affiche l'erreur d'analyse. Clique sur **Format** (mettre en forme) pour remettre au propre un JSON valide, puis sur **Apply Repaired JSON** (appliquer le JSON réparé) pour utiliser ta correction sans payer un nouvel essai. **Repair JSON** apparaît aussi pour les résumés de session et les autres appels structurés. Pour d'autres solutions, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

### Le GM narre gaiement alors que tu as choisi un ton sombre

Vérifie que **Story style** est réglé sur **Standard** dans la partie : **Gentle** atténue volontairement les revers (voir [Le style d'histoire Gentle](#the-gentle-story-style)). Certains modèles restent enjoués. Ajoute une consigne claire dans le champ de préférences de l'assistant, par exemple "garde une narration sombre, n'adoucis pas les échecs". Ou passe à un modèle dont la voix par défaut colle au ton.

### Le modèle refuse un tour

Une notification affiche **The model declined this request** lorsque le modèle a refusé d'écrire le tour. Certains modèles refusent à cause de formulations dans les règles de classification d'une partie, un preset ou une fiche de personnage. Essaie ceci dans l'ordre :

1. Relance le tour. Certains refus sont ponctuels.
2. Si tu as modifié les règles de classification, ouvre **Chat Settings → Prompt Preset** et rétablis le texte intégré de **Rating guidelines**.
3. Essaie un autre modèle pour cette partie.

## Où trouver chaque sujet

- [Game Mode : le combat](combat.md) : les rencontres, le menu d'action, le calcul des dégâts et les quick-time events.
- [Game Mode : classes MRPG](mrpg-classes.md) : le choix des classes, les caractéristiques, les niveaux et les promotions, la fiche de classe, les parties partagées et le passage d'une partie Legacy à MRPG.
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md) : Character Profiles, les feuilles de personnage et l'Adventure Journal.
- [Game Mode : sessions et sauvegardes](sessions-and-saves.md) : la fin et le début des sessions, l'historique et les points de contrôle.
- [Game Mode : carte, heure et météo](map-time-weather.md) : les vues de la carte, l'horloge, la météo et le moral.
- [Game Mode : jets de dés et jets de compétence](dice-and-skill-checks.md) : le menu des dés et les règles des jets de compétence.
- [Game Mode : les widgets HUD](hud-widgets.md) : les widgets d'état affichés à l'écran.
- [Ressources de jeu](game-assets.md) : la bibliothèque de musiques, de sons, de sprites et d'arrière-plans.
- [Guide de l'agent Storyboard](storyboard.md) : les storyboards pour Game Mode et Roleplay.
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md) : les Author's Notes (notes de l'auteur) fonctionnent ici de la même façon.
