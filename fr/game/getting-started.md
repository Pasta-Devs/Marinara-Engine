# Game Mode : premiers pas

Game Mode transforme Marinara Engine en jeu de rôle solo, mené par un Game Master piloté par l'IA. Ce guide explique ce qu'est Game Mode et ce qu'il te faut avant de commencer. Il détaille ensuite l'assistant de configuration et indique où trouver chaque fonctionnalité de jeu. Lis-le une fois, lance une partie, puis suis les liens de fin de page pour approfondir.

## Ce qu'est Game Mode

Game Mode est l'un des modes de chat de Marinara. Les deux autres sont Conversation et Roleplay.

Dans Game Mode, un Game Master (GM) piloté par l'IA mène une histoire pour toi. Le Game Master, ou maître du jeu, est l'IA qui narre le monde, joue tous les personnages que tu croises et décide de la suite. Son rôle est celui du Dungeon Master dans un jeu de rôle sur table.

Le moteur suit l'état du jeu à ta place, tour après tour. Cela englobe la carte, ton équipe, les personnages non-joueurs (PNJ), tes objets, les quêtes, l'heure dans le monde et la météo. Une partie s'étend sur de nombreux tours. Tu peux découper une longue partie en plusieurs **sessions**, comme une tablée qui étale une campagne sur plusieurs soirées. La campagne, c'est l'histoire entière.

Rien ne t'oblige à utiliser toutes les mécaniques. Certains joueurs laissent de côté le combat et les dés, et se servent de Game Mode pour du jeu visuel, centré sur l'histoire. Les systèmes de jeu de rôle sont là quand tu en as envie.

## Avant de commencer

Une seule chose est indispensable pour lancer une partie : une connexion à un fournisseur d'IA pour le GM. Une connexion relie Marinara à un fournisseur d'IA afin qu'il puisse générer du texte. Si ce n'est pas encore fait, va voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

Tout le reste est optionnel et désactivé par défaut. Ces éléments s'ajoutent plus tard :

- **La génération d'images.** Game Mode a une mise en page visuelle, avec des arrière-plans et des illustrations de personnages. Pour la remplir, il te faut une connexion de génération d'images. Le réglage **Visual Generation** (génération visuelle) de l'assistant est désactivé par défaut : à toi de l'activer. Sans lui, tu gardes l'histoire, le suivi de l'état et le combat, mais les zones visuelles restent vides.
- **Un modèle local pour les effets de scène.** Marinara sait faire tourner un petit modèle sur ta propre machine, sous l'étiquette **Local Model (Gemma)**. Il alimente les suggestions d'arrière-plan et de musique sans coût supplémentaire. C'est le choix par défaut dans l'assistant. Voir [Configurer un modèle local](../connections/local-model.md).
- **L'agent Storyboard.** Installe-le depuis **Agents > Download Agents**. Active-le ensuite pour la partie créée, dans **Chat Settings > Agents**, quand tu veux des storyboards fixes ou animés.
- **Une connexion de génération de vidéos.** Elle ne sert que pour les vidéos de scène et les storyboards animés.
- **La musique.** L'agent **Music DJ** peut lancer la musique du jeu. Il lui faut Spotify ou un dossier de musique local, et il est désactivé par défaut.

## L'assistant de configuration

Quand tu crées un chat en Game Mode, un **assistant de configuration** s'ouvre. Il compte sept étapes. Le seul champ obligatoire est la connexion du GM, à la première étape. Tous les autres champs ont une valeur par défaut sensée. Rien ne t'empêche de traverser l'assistant rapidement et de laisser Marinara compléter le reste.

Voici les sept étapes :

1. **Connection** (connexion). Donne un nom à la partie, choisis la connexion du GM et, si tu veux, une connexion pour les effets de scène. Les effets de scène utilisent **Local Model (Gemma)** par défaut.
2. **World** (le monde). Règle le genre, l'univers, le ton, la difficulté, la classification du contenu et la langue.
3. **Party** (l'équipe). Choisis ton persona, c'est-à-dire le personnage que tu incarnes, le **Game Master Mode** (mode du Game Master) et, au besoin, des membres de l'équipe.
4. **Goals** (objectifs). Dis au GM ce que tu attends de l'aventure.
5. **Lorebooks**. Rattache les lorebooks dont les faits doivent faire foi pour le GM. Un lorebook est un recueil de faits sur ton univers. Voir [Lorebooks](../lorebooks/overview.md).
6. **Features** (fonctionnalités). Active les systèmes optionnels : Visual Generation, Music DJ et les widgets du HUD. Les agents installables s'activent depuis Chat Settings, une fois la partie créée.
7. **GM**. Choisis le style de présentation et relis les instructions avancées du GM avant la construction du monde.

Une fois l'assistant terminé, clique sur **Start Game**.

### Valeurs par défaut à connaître

Voici les valeurs de départ des étapes **World**, **Party** et **Features**. Tu peux toutes les modifier.

| Réglage | Par défaut | Notes |
|---|---|---|
| Genre | Fantasy | Choix multiple, avec tes propres entrées si tu veux |
| Tone | Heroic | Choix multiple |
| Difficulty | Normal | Casual, Normal, Hard ou Brutal ; plus le niveau monte, plus le combat est impitoyable |
| Content Rating | SFW | SFW ou NSFW ; NSFW autorise le contenu adulte, il ne l'impose pas |
| Language | English | Tout le texte en jeu est écrit dans cette langue |
| Game Master Mode | Standalone GM | Standalone GM construit un GM pour toi ; Character GM prend une de tes fiches de personnage comme GM |
| Visual Generation | Off | À activer pour les images ; nécessite une connexion de génération d'images |
| Game Presentation | Standard | **Storyboard Optimized** utilise le Storyboard Game Prompt pour façonner la narration du GM ; il n'installe pas l'agent Storyboard et ne l'active pas |
| Music DJ | Off | Nécessite Spotify ou un dossier de musique local |
| Custom HUD Widgets | On | Utilise les widgets d'état créés par l'IA pour le nouveau monde |
| Start Muted | Off | Démarre la partie avec le son coupé |

Tu débutes en Game Mode ? Laisse le réglage **Game Master Mode** sur **Standalone GM**. Marinara te construit un GM juste, avec un brin d'ironie, et tu prends la mesure du mode avant d'écrire ta propre fiche de GM.

Choisis **Storyboard Optimized** à la dernière étape quand tu veux des tours de GM écrits comme des séquences visuelles filmables. Ce choix retient le preset intégré **Storyboard Game Prompt** pour la narration du GM. Il n'installe pas l'agent Storyboard et ne l'active pas. Il ne touche pas non plus à la génération d'images ou de vidéos, ni aux connexions que tu as choisies. Les réglages par défaut du planificateur et de la mise en forme de l'agent restent eux aussi inchangés. Une fois la partie créée, installe et active Storyboard à part, puis configure ses réglages d'images-clés, de planificateur, d'images et de vidéos dans **Chat Settings > Agents > Storyboards**.

L'autre combinaison, celle du plan unique façon anime, reste disponible après la configuration : choisis **Anime Episode Director** pour l'Animation Planner et **Anime Game Video** pour le Storyboard Video Prompt.

L'éditeur **GM Prompt** affiche un aperçu du prompt effectif pour la présentation choisie. Avec **Storyboard Optimized**, ouvrir l'éditeur montre le Storyboard Game Prompt, y compris sa macro de nombre d'images-clés. Si tu laisses ce texte tel quel, le preset intégré reste sélectionné ; si tu le modifies, tu crées un prompt personnalisé qui prend le pas sur le preset de présentation.

## Les trois types d'appel à l'IA

Game Mode fait trois types d'appel à l'IA. Les connaître aide à comprendre d'où viennent les coûts et les erreurs.

1. **La génération du monde.** Elle a lieu une seule fois, quand tu cliques sur **Start Game**. La connexion du GM renvoie un gros document structuré, dans un format nommé JSON. Ce document contient la présentation du monde, la carte de départ, les PNJ, les feuilles de personnage de ton équipe et les widgets affichés à l'écran. Le JSON est un format texte strict que l'IA doit renvoyer à la lettre, sinon le jeu ne peut pas le lire. C'est l'étape la plus exigeante, et c'est là que le choix du modèle compte le plus.
2. **Les tours de jeu.** Chaque message que tu envoies construit un nouveau prompt, avec l'état courant. Le GM narre ensuite la suite et met à jour le monde. Les calculs des rounds de combat sont faits par le moteur, pas par le modèle : les résultats restent justes et cohérents.
3. **Les résumés de session.** Quand tu termines une session, le GM rédige un récapitulatif structuré et des notes de continuité. Quand tu en démarres une nouvelle, il écrit un court message de transition pour que le chapitre suivant reparte proprement. Les sessions plus anciennes sont compressées en résumés, pour qu'une longue campagne ne submerge pas le modèle.

## Les modes d'adresse : à qui tu parles

La barre de saisie comporte un petit bouton en forme de bulle, à côté du bouton de pièces jointes. Son infobulle indique "Choose who to address" (choisir à qui s'adresser). Ce bouton définit le destinataire de ton message, et il a trois états.

- Par défaut, ton message part dans la scène. C'est une action ou une réplique normale, dans le jeu. Le GM et ton équipe y répondent au fil de l'histoire.
- **Talk to Party** (parler à l'équipe) ajoute un marqueur `[To the party]` et s'adresse directement à tes compagnons. Sers-t'en pour les échanges tactiques, du genre "Qu'est-ce qu'on fait maintenant ?". Cette option n'apparaît que si ton équipe n'est pas vide.
- **Talk to GM** (parler au GM) ajoute un marqueur `[To the GM]` et interroge le GM hors personnage. Utilise-le pour des questions comme "Est-ce que mon personnage connaît le temple ?", ou pour demander un changement de rythme.

Le mode actif affiche un marqueur **On** dans le menu. Pour désactiver **Talk to Party** ou **Talk to GM**, clique de nouveau sur la même entrée du menu. Tes messages repartent alors dans la scène.

<a id="optional-tool-planning-and-lore-searches"></a>

## Planification facultative des outils et recherches dans le lore

Pendant la partie, ouvre **Chat Settings → Function Calling** (réglages du chat → appels de fonctions). **Let the GM search lore** (laisser le GM rechercher dans le lore) permet au GM de chercher des informations par leur sens sans activer tous les autres outils facultatifs. Active d'abord la vectorisation des lorebooks concernés et vectorise leurs entrées. Les recherches respectent les livres et dossiers activés ainsi que les interrupteurs d'entrées propres au chat. Elles utilisent la connexion d'embeddings configurée et peuvent ajouter une requête de suivi au modèle.

**Game tool connection** (connexion des outils du jeu) vaut par défaut **Same as narrator** (comme le narrateur), ce qui conserve la boucle d'outils habituelle. Choisir une autre connexion lance une seule requête de planification séparée avant la narration. Ce modèle choisit les outils, puis le narrateur reçoit leurs résultats réels sous forme de texte. La requête supplémentaire est facturée sur la connexion choisie ; un modèle moins cher peut réduire le coût des outils, mais choisir d'autres outils. Cette unique phase de planification ne peut pas enchaîner une deuxième recherche à partir du premier résultat. Utilise **Same as narrator** pour que le narrateur raisonne sur plusieurs cycles d'outils.

Les connexions par abonnement Claude et Grok ne prennent pas en charge les appels natifs aux outils. Les contrôles concernés l'expliquent et restent désactivés tant qu'une connexion compatible pour les outils de Game n'est pas choisie. Les commandes textuelles et les balises de dés fonctionnent toujours. Si une connexion séparée manque ou si sa requête échoue, le tour signale l'échec au lieu de poursuivre discrètement la narration sans le travail demandé aux outils.

## Activer les agents

Les agents sont des aides IA optionnelles qui tournent aux côtés du GM. Pour t'en servir en partie, ouvre **Chat Settings** (réglages du chat) pendant le jeu, va dans la section **Agents** et active **Enable Agents**. Faire tourner des agents coûte plus cher, puisqu'ils passent des appels supplémentaires.

Deux agents méritent l'attention en Game Mode :

- **Game Session Keeper** aide à maintenir la continuité d'une session à l'autre.
- **Music DJ** choisit la musique d'ambiance. Il lui faut Spotify ou un dossier de musique local.

Game Mode se sert aussi de **Review Agent Outputs** (relire les sorties des agents), pour que tu puisses vérifier ce qu'un agent a produit. Pour tout savoir sur les agents, voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

## Choisir un modèle

La génération du monde est la partie la plus difficile de Game Mode. Elle demande au modèle un long document JSON strict, sans le moindre champ manquant. Un modèle très à l'aise dans un chat ordinaire peut malgré tout échouer à cette étape.

Pour la génération du monde, prends un modèle récent et performant, du haut du panier, sur une connexion payante. En 2026, les joueurs rapportent de bons résultats avec les gammes phares des grands fournisseurs. Par exemple Anthropic Claude, OpenAI GPT et Google Gemini. Les noms de modèles changent souvent : vois-y des exemples, pas une liste figée.

Pour les tours de jeu courants, il est parfois possible de descendre vers un modèle moins cher, car un tour demande de la narration, pas du JSON strict. Si le GM se met à oublier des PNJ ou à contredire des détails passés, remonte vers un modèle plus solide.

Évite les modèles gratuits ou à routage automatique pour la génération du monde. Ils peuvent basculer vers un modèle plus petit, incapable de produire un JSON de génération du monde valide. Les petits modèles à poids ouverts échouent en général aussi à cette étape.

Pour la référence complète des paramètres, voir [Les paramètres de génération](../prompts/generation-parameters.md).

## Où trouver chaque sujet de jeu

Ce guide t'amène jusqu'au début de la partie. Chaque sujet plus poussé a son propre guide :

- [Game Mode : le combat](combat.md) traite des rencontres, du menu d'action, du calcul des dégâts et des quick-time events.
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md) traite de la barre d'équipe, des feuilles de personnage et de l'Adventure Journal.
- [Game Mode : sessions et sauvegardes](sessions-and-saves.md) traite de la fin et du démarrage des sessions, ainsi que de l'historique des sessions.
- [Game Mode : carte, temps et météo](map-time-weather.md) traite des vues de la carte, de l'horloge automatique et de la météo.
- [Game Mode : dés et jets de compétence](dice-and-skill-checks.md) traite du menu des dés et des règles de jet de compétence.
- [Game Mode : les widgets du HUD](hud-widgets.md) traite des widgets d'état affichés à l'écran.
- [Les ressources de jeu](game-assets.md) traite de la bibliothèque de musiques, de sons, de sprites et d'arrière-plans.
- [Guide de l'agent Storyboard](storyboard.md) explique l'installation, puis les storyboards en Roleplay et en Game Mode.

Les Author's Notes (notes de l'auteur) fonctionnent ici comme dans les autres modes. Voir [Mode Roleplay : premiers pas](../roleplay/getting-started.md).

## Dépannage

### La génération du monde échoue avec une erreur JSON ou 422

La cause la plus fréquente : le modèle n'a pas réussi à produire l'intégralité du JSON structuré. Essaie ceci, dans l'ordre.

1. Regarde quelle connexion le GM utilise. Si elle pointe vers un modèle gratuit ou à routage automatique, passe à un modèle payant performant.
2. Réessaie. Certains échecs sont ponctuels, et la même configuration passe au deuxième essai.
3. Raccourcis un champ d'univers ou de préférences trop long. Des saisies longues laissent moins de place au modèle pour produire le JSON.

Si un appel a presque abouti mais que le JSON est légèrement cassé, Marinara propose une fenêtre **Repair JSON** (réparer le JSON). Elle ouvre un éditeur numéroté ligne par ligne, avec la sortie brute du modèle. Une ligne d'état t'indique si le JSON est valide, ou affiche l'erreur d'analyse. Clique sur **Format** pour remettre au propre un JSON valide. Clique ensuite sur **Apply Repaired JSON** pour utiliser ta version corrigée, sans payer un nouvel essai complet. L'option **Repair JSON** apparaît aussi pour les résumés de session et les autres appels structurés.

Pour d'autres symptômes et solutions, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

### Le GM narre gaiement alors que tu as choisi un ton sombre

Certains modèles restent enjoués quoi qu'il arrive. Deux options s'offrent à toi. Ajoute une consigne claire dans le champ de préférences de l'assistant, par exemple "garde une narration sombre, n'adoucis pas les échecs". Ou passe à un modèle dont la voix par défaut colle au ton que tu veux.

## Guides associés

- [Game Mode : le combat](combat.md)
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md)
- [Game Mode : sessions et sauvegardes](sessions-and-saves.md)
- [Game Mode : carte, temps et météo](map-time-weather.md)
- [Game Mode : dés et jets de compétence](dice-and-skill-checks.md)
- [Game Mode : les widgets du HUD](hud-widgets.md)
- [Les ressources de jeu](game-assets.md)
- [Guide de l'agent Storyboard](storyboard.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Les paramètres de génération](../prompts/generation-parameters.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
