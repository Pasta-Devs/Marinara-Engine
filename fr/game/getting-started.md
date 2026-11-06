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

1. Dans la barre latérale des chats, ouvre l'onglet **GM** et clique sur le bouton **+** (**New Game**, nouvelle partie). Tu peux aussi cliquer sur **Game** dans l'écran d'accueil. L'assistant de configuration s'ouvre. Voir [Gérer la liste des chats](../chats/managing-chats.md).
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
| **Connection** (connexion) | **Game Name** (nom de la partie), le **Model** qui fait tourner le GM et un **Scene effects model** facultatif. L'encart **Game Mode** n'affiche que **VN** pour l'instant (voir [VN ou Overworld](#vn-or-overworld)). |
| **World** (monde) | Le genre, le cadre, le ton, la difficulté, la classification du contenu et la langue. **Combat Preference** (préférence de combat) se règle sur **Turn-Based** ou **Tactical**. Chaque nouvelle partie utilise les classes **MRPG** (Marinara RPG) (voir [Classes MRPG](mrpg-classes.md)). Quand un ensemble de règles est installé, un choix **Rules** (règles) apparaît (voir [Choisir les règles](#choose-rules)). |
| **Party** (équipe) | Ton persona (le personnage que tu incarnes), le **Game Master Mode**, les membres de l'équipe et le **GM intro message** (message d'introduction du GM). Voir [Le message d'introduction du GM](#the-gm-intro-message). |
| **Goals** (objectifs) | Ce que tu attends de l'aventure. |
| **Lorebooks** | Les lorebooks qui font foi pour le GM. Un lorebook est un recueil de faits sur ton univers. Voir [Lorebooks](../lorebooks/overview.md). |
| **Features** (fonctionnalités) | **Enable Agents** (activer les agents), puis un encart pour chaque agent téléchargé (**Illustrator**, **Music DJ**, **Lorebook Keeper**), ainsi que **Custom HUD Widgets** (widgets HUD personnalisés), **Quick Time Events** et **Start Muted** (démarrer en sourdine). |
| **GM** | Le style de présentation et le **GM Prompt** (prompt du GM). |

Les idées proposées sous le cadre et les objectifs changent à chaque ouverture de l'assistant. Dans une partie Tactical, le GM rédige une courte description de chaque combat, et Marinara construit un plateau à partir de celle-ci. Voir [Combat](combat.md#tactical-battles-and-terrain).

L'étape **World** propose aussi des options de combat pour les boss. **GM directs bosses** (le GM dirige les boss) est activé par défaut. Il laisse le GM décider des tours des boss avec ta connexion de GM, ce qui peut prendre un moment. Les ennemis ordinaires décident seuls, sauf si **GM directs bosses** est activé et que l'ensemble de règles de la partie confie l'opposition au Game Master (voir [Texte du Game Master](../extending/ruleset-sheets.md#game-master-text)). Tant que **GM directs bosses** est activé, **Game Master also plays named and brilliant opponents** (le Game Master joue aussi les adversaires nommés et brillants), activé par défaut, permet au GM de jouer aussi les personnages nommés et les ennemis très rusés. Deux autres options sont toujours affichées : **Companions fight on their own** (les compagnons combattent seuls), activé par défaut (désactive-le pour jouer toi-même toute l'équipe), et **Let cruel opponents strike the fallen** (laisser les adversaires cruels frapper ceux qui sont à terre), désactivé par défaut. Voir [Combat](combat.md).

Avec l'agent **Hierarchical Maps** téléchargé (désormais appelé World Maps, voir [World Maps](../agents/hierarchical-maps.md)) et **Enable Agents** activé, l'étape **Features** peut aussi esquisser une **Hierarchical world map** (carte hiérarchique du monde), utiliser un modèle de carte enregistré ou lier un monde partagé.

### Valeurs par défaut à connaître

| Réglage | Par défaut | Notes |
| --- | --- | --- |
| Genre | Fantasy | Choix multiple, avec tes propres entrées. Un kit d'univers choisi en premier définit le sien. |
| Tone | Heroic | Choix multiple. |
| Difficulty | Normal | **Casual**, **Normal**, **Hard** ou **Brutal**. Plus le niveau est élevé, plus les attaques ennemies frappent fort (voir [Combat](combat.md#difficulty-scaling)). |
| Content Rating | SFW | **SFW** ou **NSFW**. NSFW autorise seulement le contenu adulte, il ne l'impose pas. |
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
| **Game controls** (contrôles du jeu, icône de manette) | **Retry turn** (relancer le tour), **Retry scene analysis** (relancer l'analyse de scène), **Retry Music DJ** (relancer Music DJ, quand Music DJ joue la musique) et **Retry assets image generation** (relancer la génération des images des ressources). Pour un arrière-plan de storyboard, aussi relecture, lecture/pause et coupure du son. **Show the scene** (afficher la scène), **Show the overworld** (afficher la carte du monde) et **Show the map** (afficher la carte) changent de vue dans les parties qui en ont. **Edit game data** (modifier les données de jeu) corrige à la main les données enregistrées (voir [Modifier les données de la partie à la main](sessions-and-saves.md#editing-game-data-by-hand)). **Checkpoints** (points de contrôle) ramène la partie à un moment antérieur (voir [Comment ta partie s'enregistre](sessions-and-saves.md#how-your-game-saves)). |
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

Certains modèles restent enjoués. Ajoute une consigne claire dans le champ de préférences de l'assistant, par exemple "garde une narration sombre, n'adoucis pas les échecs". Ou passe à un modèle dont la voix par défaut colle au ton.

## Où trouver chaque sujet

- [Game Mode : le combat](combat.md) : les rencontres, le menu d'action, le calcul des dégâts et les quick-time events.
- [Game Mode : classes MRPG](mrpg-classes.md) : les classes, les niveaux et la fiche, les nouveaux venus et le passage d'une partie Legacy à MRPG.
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md) : Character Profiles, les feuilles de personnage et l'Adventure Journal.
- [Game Mode : sessions et sauvegardes](sessions-and-saves.md) : la fin et le début des sessions, l'historique et les points de contrôle.
- [Game Mode : carte, heure et météo](map-time-weather.md) : les vues de la carte, l'horloge, la météo et le moral.
- [Game Mode : jets de dés et jets de compétence](dice-and-skill-checks.md) : le menu des dés et les règles des jets de compétence.
- [Game Mode : les widgets HUD](hud-widgets.md) : les widgets d'état affichés à l'écran.
- [Ressources de jeu](game-assets.md) : la bibliothèque de musiques, de sons, de sprites et d'arrière-plans.
- [Guide de l'agent Storyboard](storyboard.md) : les storyboards pour Game Mode et Roleplay.
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md) : les Author's Notes (notes de l'auteur) fonctionnent ici de la même façon.

## Overworld

Les sections ci-dessous décrivent les parties **Overworld**, qui ne sont pas encore disponibles. Ne les lis que si ton serveur les a activées.

<a id="vn-or-overworld"></a>

### VN ou Overworld

Une nouvelle partie se joue dans l'un de deux modes de jeu, choisi à la première étape et conservé pour toutes ses sessions :

- **Overworld** : un monde créé pour ton univers, parcouru sur une carte du monde, avec des villes, des lieux à explorer et des donjons. Il lui faut un kit d'univers et un monde. Tant que tu n'as pas choisi de kit, celui de ton premier genre est pris (High fantasy si le genre n'en a pas), et un monde est tiré au sort pour lui.
- **VN** : Game Mode tel qu'il a toujours été, raconté comme un roman visuel, scène par scène, avec la carte de scène et les combats, et sans kit d'univers, monde, carte du monde, villes ni cartes de donjon.

Overworld est verrouillé tant que la personne qui exploite le serveur ne définit pas `MARINARA_OVERWORLD_GAMES`. Tant qu'il est verrouillé, son encart est grisé avec la note "Overworld games, with a setting kit and a generated world, are not ready yet. New games start as VN games." Toute nouvelle partie est alors une partie VN, et les choix de kit d'univers et de monde n'apparaissent pas. Une partie créée avant l'existence de ce choix continue de se jouer comme avant : avec un monde, c'est une partie Overworld ; sans monde, une partie VN.

<a id="choosing-a-setting-kit"></a>

### Choisir un kit d'univers

Un **Setting kit** (kit d'univers) donne au GM les mots dans lesquels s'écrit ton type de monde : les noms de lieux et les tailles d'agglomération, les types de groupes, la façon dont on voyage, le nom d'une année et d'un jour, la façon dont les peuples se nomment, la monnaie et les marchandises, les éléments, les lieux de combat et la famille d'illustrations et de musiques qu'il utilise (voir [Ressources de jeu](game-assets.md#a-settings-own-art-and-music)). Il indique aussi quels types de changements le monde autorise, comme les rivalités, le crime, les guerres ou les catastrophes, et à quelle vitesse il change. Un type désactivé n'est jamais introduit : une querelle peut donc rester une querelle.

Il y a huit kits : high fantasy, wuxia et xianxia, époque moderne, moderne surnaturel, années 1920, cyberpunk, space opera et post-apocalyptique. L'époque moderne est paisible par défaut, sans crime, conflit ni catastrophe, à un rythme lent.

- Choisir un kit avant un genre définit le genre qui lui correspond. Un genre que tu as choisi toi-même reste tel quel.
- **Write it for my setting** (l'écrire pour mon univers) demande à ton modèle de GM de réécrire le kit pour le genre, le cadre et le ton que tu as choisis. Si le résultat ne tient pas debout, la demande est refaite une fois au modèle avec les raisons. Si cela échoue encore, l'assistant t'indique ce qui n'allait pas et garde le kit que tu avais.
- **Change its words** (modifier ses mots) ouvre chaque mot du kit. Tape une liste sur une seule ligne, avec des virgules entre les éléments. Un kit qui a un problème, comme un nom vide ou aucune agglomération, indique ce qui ne va pas, et la partie ne peut pas commencer tant qu'il n'est pas corrigé.
- **Download this kit** (télécharger ce kit) enregistre un fichier `.worldkit.json` à partager. **Import a kit file** (importer un fichier de kit) en relit un.

La partie garde le kit avec lequel elle a été créée, et un fichier de configuration partagé l'inclut. Une Experience peut fournir son propre pack de carte (un kit, des cartes toutes prêtes et des tuiles). Avec cette Experience activée, la configuration affiche son kit comme déjà défini et, si elle fournit des cartes, une **Map** à choisir. Désactiver l'Experience te rend tes choix.

<a id="making-a-world"></a>

### Créer un monde

Une fois un kit choisi, **Your world** (ton monde) dispose un monde dans les mots du kit avant le début de la partie : les régions, les agglomérations de toutes les tailles, ce pour quoi chaque lieu est connu et les chemins qui les relient (routes, rivières, voies maritimes, couloirs de saut), avec la durée de chaque trajet en jours.

Un monde se crée à partir d'une **World seed** (graine du monde). La même graine, le même kit et le même brief donnent toujours le même monde. **Roll** (tirer) en donne un autre, et ressaisir un nombre en fait revenir un. L'aperçu montre une petite carte du sol et des agglomérations, le point de départ de l'équipe et la liste des agglomérations par région.

- **Start from this lore** (partir de ce lore) lit les lorebooks cochés pour y trouver les lieux et les événements datés qu'ils indiquent, conservés exactement tels qu'ils sont écrits. **Build around the lore** (construire autour du lore) complète le monde autour d'eux. **Only the lore's places** (seulement les lieux du lore) ne crée rien d'autre.
- **Write the world's brief** (écrire le brief du monde) demande à ton modèle de GM le présent, les lieux majeurs, les groupes autour desquels tourne le présent (ce que veut chacun, ses alliés et ses rivaux) et des noms pour les lieux et les personnes, dans la sonorité propre à chaque peuple. Les lieux du lore sont conservés quoi qu'écrive le modèle. Tout ce qui ne correspond pas au kit est écarté et compté. **Change the brief** (modifier le brief) ouvre ses mots, y compris les prénoms et les noms de famille de chaque peuple. Sans brief, les lieux sont numérotés et les gens sont désignés par leur métier.

**Un monde a un passé.** Avant le début de la partie, le monde avance année après année depuis sa fondation. Les agglomérations grandissent, et les groupes sont fondés, prennent et perdent des chefs, se rapprochent et se brouillent entre eux. Là où le monde en a, les bandits, les guerres et les famines laissent leur marque. Un changement grave ne survient qu'après avoir couvé, et seulement dans les types que le kit autorise. Les événements datés de ton lore ou du brief se produisent quand et où ils le disent. La même graine et le même brief donnent le même passé.

**Ce que sait le GM.** Le GM sait toujours où se trouve l'équipe, où elle peut aller et combien de temps prend chaque chemin. Il apprend les événements les plus notables du passé, qui dirige le lieu actuel et le passé de ce lieu. Pour tout autre lieu ou groupe, il peut demander, et reçoit la réponse à son tour suivant. Il nomme l'endroit où va l'équipe avec une balise de lieu. Un lieu que liste le monde garde la taille que le monde lui a donnée. Un lieu que le monde ne liste pas, comme une ferme, garde le nom que lui donne le GM. Chaque agglomération a ses habitants, tirés par la graine quand l'équipe y arrive : un nom issu de leur culture, un métier adapté au lieu, un tempérament, une façon de parler et une apparence. Quand le GM nomme quelqu'un en entier, cette personne rejoint les personnages suivis.

**Ce que fait l'équipe reste fait.** Quand l'équipe aide ou gêne un groupe, change ce que deux groupes pensent l'un de l'autre, prend ou ruine un lieu, ou met quelqu'un à la tête d'un groupe, le GM l'enregistre dans sa réponse. Chaque changement est vérifié par rapport au monde. Un changement d'un type que le kit désactive, ou qui nomme un lieu ou un groupe que le monde n'a pas, est refusé. Dès lors, le GM reçoit le monde tel que l'histoire l'a laissé. Un lieu ajouté par l'histoire est un lieu où l'équipe peut aller. Un swipe (une réponse alternative), une régénération ou un message supprimé annule un changement avec sa réponse.

**Le monde continue sans l'équipe.** Quand le GM dit que le temps passe, le monde avance d'une semaine à la fois, seulement dans les types de changements qu'autorise le kit. Les catastrophes ne viennent jamais d'elles-mêmes : seul le GM peut en narrer une, et elle est refusée si son type est désactivé. Rien n'est décidé là où se trouve l'équipe. Les nouvelles voyagent : le GM apprend un changement lointain une fois écoulés les jours que prennent les routes. Les actes de l'équipe comptent davantage à mesure qu'elle se fait connaître.

**Modifications manuelles.** Dans un éditeur de monde, tu peux renommer ou déplacer des lieux, peindre le sol, ajouter des lieux et des habitants, peindre le champ de bataille tactique d'un lieu (voir [Combat](combat.md#tactical-battles-and-terrain)) et disposer une ville (voir [La ville](map-time-weather.md#the-town)). Tous les éléments du jeu voient aussitôt les modifications. Un lieu renommé répond toujours à son ancien nom. Les modifications changent le monde à partir de maintenant, jamais son passé. Une ville garde sa disposition : les lieux et les habitants que tu ajoutes vont donc sur ses prochaines parcelles libres et dans ses prochains logements libres.

**Fichiers de monde.** **Download this world** (télécharger ce monde), sous **Your world**, enregistre le monde que tu es en train de créer, et **Download the world** (télécharger le monde), dans l'onglet World d'une partie, enregistre le monde de cette partie, modifications manuelles comprises, dans un fichier `.world.json`. **Import a world file** (importer un fichier de monde), à côté du kit d'univers, en lit un dans la configuration d'une nouvelle partie : il choisit le kit du fichier et crée son monde. **Your worlds** (tes mondes) fait de même avec un monde de ta bibliothèque. Un fichier peut aussi contenir l'histoire du monde : les événements et les scènes que son créateur a écrits. Les scènes d'une histoire apparaissent dans la narration avant la réponse du GM, exactement telles qu'elles ont été écrites, et ses objectifs de quête sont listés sous **Story** (histoire) dans l'onglet World du journal. Pour en écrire une, voir [Écrire des scripts d'histoire Game Mode](../extending/writing-story-scripts.md). Les modifications manuelles et l'histoire appartiennent à cette graine et à ce brief : elles sont donc écartées si tu changes l'un ou l'autre. Un fichier illisible est refusé, et l'assistant dit pourquoi. Si le contenu d'un fichier ne correspond pas au kit, il est en partie écarté, et l'assistant indique ce qui l'a été.

**Plus tard, et ce qui est enregistré.** Une partie créée sans monde peut en recevoir un plus tard depuis l'onglet **World** du journal, avec **Make a world for this game** (créer un monde pour cette partie). Le monde commence au tour suivant, et les tours passés, la carte et les personnages restent. Le bouton est grisé tant qu'Overworld RPG est verrouillé. Une partie garde son monde tel qu'il a été créé : une nouvelle session, une branche et un chat exporté gardent donc le même monde. Un monde créé par une version antérieure du générateur continue de se jouer, mais ne peut plus être modifié.

Une partie avec un monde s'ouvre sur l'**overworld**, la carte du monde en pixels où tu fais marcher l'équipe d'une agglomération à l'autre et où tu entres dans les villes. Voir [La carte du monde](map-time-weather.md#the-overworld).
