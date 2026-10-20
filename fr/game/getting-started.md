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

1. **Connection** (connexion). Choisis le **Game Mode** : **Overworld RPG** ou **Classic**. Overworld RPG n'est pas encore prêt : pour l'instant, les nouvelles parties démarrent donc en **Classic**. Voir [Classic ou Overworld RPG](#classic-or-overworld-rpg). Donne un nom à la partie, choisis la connexion du GM et, si tu veux, une connexion pour les effets de scène. Les effets de scène utilisent **Local Model (Gemma)** par défaut.
2. **World.** Définis le genre, le cadre, le ton, la difficulté, la classification du contenu et la langue. Les idées proposées sous le cadre, puis plus tard sous les objectifs, viennent de différents types d'univers, dans un nouveau mélange à chaque ouverture de l'assistant. Choisis **Classic** (combat par menus) ou **Tactical** (combat sur grille) sous **Combat Preference** (préférence de combat). Les parties Tactical proposent aussi une graine, une taille et des indications de terrain facultatives pour le champ de bataille. Si un ensemble de règles Game Mode est installé, **Rules** (règles) apparaît dessous : garde **Marinara's own rules** ou choisis l'ensemble de règles. Consulte [Choisir les règles](#choosing-rules). En Overworld RPG, on trouve encore dessous **Setting kit** (kit d'univers) et **Your world** (ton monde). Consulte [Choisir un kit d'univers](#choosing-a-setting-kit) et [Créer un monde](#making-a-world).
3. **Party** (l'équipe). Choisis ton persona, c'est-à-dire le personnage que tu incarnes, le **Game Master Mode** (mode du Game Master) et, au besoin, des membres de l'équipe. **GM intro message** (message d'introduction du GM) définit le premier message de la partie. Consulte [Le message d'introduction du GM](#the-gm-intro-message).
4. **Goals** (objectifs). Dis au GM ce que tu attends de l'aventure.
5. **Lorebooks**. Rattache les lorebooks dont les faits doivent faire foi pour le GM. Un lorebook est un recueil de faits sur ton univers. Voir [Lorebooks](../lorebooks/overview.md).
6. **Features** (fonctionnalités). Active les systèmes optionnels : Visual Generation, Music DJ et les widgets du HUD. Les agents installables s'activent depuis Chat Settings, une fois la partie créée.
7. **GM**. Choisis le style de présentation et relis les instructions avancées du GM avant la construction du monde.

Une fois l'assistant terminé, clique sur **Start Game**.

Dans une partie Tactical, laisse les options du champ de bataille vides pour que le GM choisisse une description adaptée à la scène et que le moteur génère le plateau. Une graine fixe reproduit la génération pour les mêmes données de rencontre ; les indications demandent au GM des éléments comme un mur en ruine ou une clairière. Consulte [Game Mode : le combat](combat.md#tactical-battles-and-terrain) pour les règles de déplacement, les bonus de terrain et les échecs de génération.

<a id="classic-or-overworld-rpg"></a>

### Classic ou Overworld RPG

Une nouvelle partie se joue dans l'un de deux Game Modes, choisi à la première étape et conservé pour toutes les sessions de la partie :

- **Overworld RPG** (le choix par défaut une fois prêt) : un monde créé pour ton univers, parcouru sur une carte du monde, avec des villes à visiter, des lieux à explorer et des donjons où descendre. Il lui faut un kit d'univers et un monde ; tant que tu n'as pas choisi de kit, celui de ton premier genre est pris (High fantasy pour un genre qui n'en a pas), et un monde est tiré au sort pour lui.
- **Classic** : Game Mode tel qu'il a toujours été. L'histoire se raconte scène par scène, avec la carte de scène et les combats, sans kit d'univers, monde, carte du monde, villes ni cartes de donjon.

Une partie créée avant l'existence de ce choix continue de se jouer comme avant : avec un monde, c'est une partie Overworld ; sans monde, une partie Classic.

Overworld RPG est encore en cours de finition. Tant qu'il n'est pas prêt, son encart est grisé avec la note "Overworld games, with a setting kit and a generated world, are not ready yet. New games start as Classic games." Toutes les nouvelles parties sont alors Classic, et les choix de kit d'univers et de monde ci-dessous n'apparaissent pas. Ils décrivent les parties Overworld RPG.

<a id="choosing-rules"></a>

### Choisir les règles

**Rules** n'apparaît que si au moins un ensemble de règles est installé, et seulement pour une nouvelle partie. Ce choix est indépendant de **Combat Preference** : l'un décide du fonctionnement des tests et des feuilles de personnage, l'autre de la présentation des combats.

- **Marinara's own rules** est le choix par défaut : les tests d20 intégrés et la feuille à six attributs.
- Un ensemble de règles, comme **5e (SRD 5.1)**, affiche un court résumé de ce qu'il couvre, et une ligne qui indique ce que feront les combats. Un ensemble de règles qui résout ses propres combats le signale. Un ensemble qui ne fait que prêter la feuille indique que les combats se déroulent avec le combat de Marinara, en utilisant la santé, l'énergie et les capacités propres à la feuille. Un ensemble qui ne fait ni l'un ni l'autre indique que les combats se déroulent avec le combat de Marinara et nomme la **Combat Preference** que tu as choisie.

Quand l'ensemble de règles résout ses propres combats, l'écran de combat est celui de cet ensemble : le menu présente les attaques et capacités propres à ton personnage, chacune indiquant ce qu'elle dépense dans l'économie d'actions et les réserves de l'ensemble de règles ; le panneau en dessous affiche l'ordre des tours, le round, les états de chacun sous les noms propres à l'ensemble de règles, et ce qui reste de chaque budget ; et le journal affiche le vrai calcul, comme "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Chaque action est écrite dans la feuille de personnage dès qu'elle aboutit : fermer l'onglet en plein combat ne fait donc rien perdre, et le Game Master est ensuite informé que les chiffres sont déjà réglés. Si cet ensemble de règles indique aussi ce que vaut une case de champ de bataille dans sa propre unité de distance, ta **Combat Preference** décide de la présentation du combat : **Classic** le joue sans positions, et **Tactical** le joue sur un plateau où tu te déplaces, mesures l'allonge et la portée dans l'unité propre à l'ensemble de règles, et vises une case avec une zone. Consulte [Combat](combat.md#games-whose-ruleset-resolves-its-own-fights). Un ensemble de règles qui ne dit rien de la distance garde la préférence sans l'utiliser.

L'ensemble de règles est fixé à la création de la partie et reste attaché à cette partie. Il ne peut pas être changé ni ajouté plus tard.

Certains ensembles de règles proposent des **layers** (couches) : des variantes nommées comme Low magic ou Hard winter, affichées sous forme d'interrupteurs sous l'ensemble de règles, avec une ligne qui indique ce que fait chacune. Une couche peut durcir les difficultés, restreindre un choix sur la feuille de personnage, retirer certaines entrées toutes prêtes du sélecteur de l'éditeur de fiche, et donner des instructions supplémentaires au Game Master, y compris pour le monde qu'il construit à la configuration. Certaines couches s'excluent mutuellement, et l'assistant désactive celle que tu ne peux pas prendre. Les couches sont fixées une fois la partie commencée, exactement comme l'ensemble de règles lui-même, et une fiche qui utilise déjà quelque chose qu'une couche retire le conserve.

Les ensembles de règles viennent de deux endroits. Les officiels s'installent depuis **Download Agents**, où ils portent l'étiquette **Rules**. Ceux de la communauté s'importent depuis un fichier ou depuis le dépôt GitHub d'un auteur, et sont rangés selon leur provenance, comme `local/ember-roads` ou `alice/v20`. L'import utilise le même interrupteur **Allow custom Agent imports** (autoriser l'import d'agents personnalisés) que les agents importés. Tant que cet interrupteur est désactivé, les ensembles de règles importés sont exclus des nouvelles parties, et les parties qui en utilisent déjà un continuent de fonctionner. Une partie sur un ensemble de règles importé se joue toujours sur la version exacte avec laquelle elle a été créée. Pour écrire le tien, consulte [Écrire des ensembles de règles](../extending/writing-rulesets.md).

Après le choix d'un ensemble de règles, l'étape **Party** liste ton persona et les membres de l'équipe sous les sélecteurs, et indique qui **Has a sheet** (a une fiche) pour cet ensemble et qui **Starts on a blank sheet** (commence avec une fiche vierge). Une fiche s'ajoute sous **Stats** dans l'éditeur de personnage ou de persona (voir [Fiches d'ensembles de règles](../characters/colors-and-stats.md#ruleset-sheets)). La partie prend une copie de chaque fiche quand le monde est généré. Rien de ce que tu changes en jeu ne revient au personnage ou au persona. Un membre sans fiche reçoit une fiche vierge où chaque valeur est celle par défaut de l'ensemble de règles ; la génération du monde n'invente jamais de valeurs.

Un fichier de configuration partagé mémorise son ensemble de règles. Si tu en importes un sans avoir cet ensemble de règles, ou avec une version plus ancienne, l'assistant t'indique de quel ensemble il s'agissait, et la partie utilise les règles propres à Marinara, sauf si tu l'installes et le choisis.

<a id="choosing-a-setting-kit"></a>

### Choisir un kit d'univers

Un **Setting kit** donne au Game Master les mots dans lesquels s'écrit ton type de monde : le nom de ses lieux et la taille que peut atteindre une agglomération, ses types de groupes, ce pour quoi un lieu peut être connu, la façon dont on y voyage, le nom d'une année et d'un jour, la façon dont ses peuples se nomment, ce qu'un combat gagné peut rapporter, sa monnaie et les objets du quotidien qu'on y vend, ses éléments, les lieux où ses combats se déroulent, et la famille d'illustrations, de musiques et de sons qu'il utilise (voir [Les visuels et la musique propres à un univers](game-assets.md#a-settings-own-art-and-music)). Il indique aussi quels types de changements connaît le monde, comme les rivalités, le crime, les guerres ou les catastrophes, et à quelle vitesse il change de lui-même. Un type désactivé n'est jamais introduit comme événement de fond, et une scène ne dégénère pas dans ce sens : une querelle peut donc rester une querelle.

Il n'est proposé que pour une nouvelle partie Overworld RPG, qui en a toujours un : tant que tu n'as pas choisi de kit, celui de ton premier genre est pris. Il y en a huit pour commencer : high fantasy, wuxia et xianxia, époque moderne, moderne surnaturel, années 1920, cyberpunk, space opera et post-apocalyptique. L'époque moderne est paisible par défaut, sans crime, conflit ni catastrophe, à un rythme lent, pour la tranche de vie.

Choisir un kit avant d'avoir choisi un genre définit le genre qui lui correspond, comme **Cyberpunk** pour cyberpunk ou **Wuxia** pour wuxia et xianxia, et les idées de cadre et d'objectifs commencent alors par celles du kit. Un genre que tu as choisi toi-même reste tel quel.

Une fois le kit choisi, **Write it for my setting** (l'écrire pour mon univers) demande à ta connexion de Game Master de le réécrire pour le genre, le cadre et le ton que tu as choisis. Si ce qu'écrit le modèle ne tient pas debout, la demande lui est refaite une fois avec les raisons, puis l'assistant t'indique ce qui n'allait pas et garde le kit que tu avais. **Change its words** (modifier ses termes) ouvre chaque mot du kit à la modification. Une liste se saisit sur une seule ligne, avec des virgules entre les éléments. Un kit qui a un problème, comme un nom vide ou aucune agglomération, indique ce qui ne va pas, et la partie ne peut pas commencer tant qu'il n'est pas corrigé.

La partie garde le kit avec lequel elle a été créée. Le Game Master le lit à chaque tour, et la génération du monde utilise ses mots. Un fichier de configuration partagé emporte aussi son kit.

Une Experience peut fournir son propre **map pack** (pack de cartes) : un kit d'univers, des cartes toutes prêtes et ses propres tuiles. Avec
cette Experience activée, la configuration affiche son kit comme déjà défini (aucun kit à choisir) et, si elle fournit des cartes, une **Map** (carte)
à choisir ; la partie se joue sur cette carte, dessinée avec les tuiles de l'Experience. Désactiver
l'Experience te rend tes propres choix.

**Download this kit** (télécharger ce kit) enregistre le kit dans un fichier (`.worldkit.json`) à partager, et **Import a kit file** (importer un fichier de kit) en relit un. **Import a world file** (importer un fichier de monde) fait entrer un monde entier d'un coup (voir plus bas).

<a id="making-a-world"></a>

### Créer un monde

Une fois un kit d'univers choisi, **Your world** dispose un monde entier dans les mots du kit avant le début de la partie : ses régions, ses agglomérations de toutes les tailles de l'échelle du kit, ce pour quoi chaque lieu est connu, et les chemins qui les relient (routes, rivières, voies maritimes, couloirs de saut) avec le nombre de jours que prend chaque trajet. Chaque nouvelle partie Overworld RPG en a un, tiré d'une graine que tu peux changer.

Un monde se crée à partir d'une **World seed** (graine du monde). La même graine, le même kit et le même brief (les grandes lignes écrites pour le monde) donnent toujours le même monde : **Roll** (tirer) t'en donne donc un autre, et ressaisir un nombre en fait revenir un. L'aperçu en dessous est le monde que jouera la partie : une petite carte du sol et de ses agglomérations, le point de départ de l'équipe, et la liste de toutes les agglomérations par région.

- **Start from this lore** (partir de ce lore) lit les lorebooks que tu coches pour y trouver les lieux qu'ils décrivent et les événements datés qu'ils rapportent, chacun conservé exactement comme le dit le lore, avec les entrées d'où il vient. **Build around the lore** (construire autour du lore) complète le monde autour d'eux ; **Only the lore's places** (seulement les lieux du lore) ne crée rien d'autre.
- **Write the world's brief** (écrire le brief du monde) demande le reste à ta connexion de Game Master : le présent au début de la partie, les lieux majeurs, les groupes autour desquels tourne ce présent (ce que veut chacun, et qui sont ses alliés et ses rivaux), et des noms pour les lieux et les personnes que dessine le monde, dans la sonorité et l'ordre propres à chacun des peuples du kit. Les lieux du lore sont conservés quoi qu'écrive le modèle, et tout ce qui ne correspond pas au kit est écarté et compté, tout comme les quelques noms vers lesquels les modèles reviennent sans cesse. **Change the brief** (modifier le brief) ouvre ses mots à la modification, y compris les prénoms et les noms de famille de chaque peuple.

Sans brief, le monde se limite au kit et aux lieux du lore, et les lieux qu'il dessine sont numérotés jusqu'à ce qu'un brief leur donne des noms.

Un monde a aussi un passé. Avant le début de la partie, le moteur propre au monde le fait avancer année après année depuis sa fondation : chaque agglomération est fondée et grandit jusqu'à sa taille actuelle, les groupes du brief sont fondés à leur siège, prennent et perdent des chefs, se rapprochent et se brouillent entre eux et, là où le monde en a, les bandits, les guerres et les famines laissent leur marque, certains lieux disparaissant à cause d'eux. Un changement grave ne survient qu'après avoir couvé un moment (des tensions avant une guerre, une sécheresse avant une famine), et il n'utilise que les types de changements que le kit autorise : le passé d'un monde paisible est paisible lui aussi. Les événements datés qu'indique ton lore, ou que nomme le brief, se produisent quand et où ils le disent. La même graine et le même brief donnent toujours le même passé.

Le Game Master apprend les événements les plus notables du passé, qui tient le lieu où se trouve l'équipe et qui le dirige, ainsi que le passé propre à ce lieu. Pour tout autre lieu ou groupe, il peut demander, et reçoit la réponse à son tour suivant.

Chaque agglomération a ses habitants, tirés par la graine quand l'équipe y arrive : plus nombreux dans les grands lieux, chacun avec un nom tiré de la liste de sa propre culture, un métier adapté à ce pour quoi le lieu est connu, un tempérament, ce qui lui tient à cœur, sa façon de parler et son apparence, certains étant venus d'ailleurs. Le Game Master voit quelques habitants du lieu actuel que l'équipe n'a pas encore rencontrés, et en fait entrer un quand quelqu'un de nouveau arrive dans la scène. Une personne qu'il nomme en entier rejoint les personnages suivis par la partie, avec ce qu'elle fait et son apparence : deux personnes qui portent le même nom restent donc distinctes. Sans les listes de noms d'un brief, les gens sont désignés par leur métier.

En jeu, le Game Master sait toujours où se trouve l'équipe, où elle peut aller de là et combien de temps prend chaque chemin. Il nomme l'endroit où va l'équipe avec une balise de lieu. Un lieu que liste le monde garde la taille que le monde lui a donnée. Avec un ensemble de règles qui a des marchés, il prend aussi la taille correspondante sur l'échelle du marché : la capitale d'un monde est donc le plus grand lieu du marché. Un lieu que le monde ne liste pas, comme une ferme ou un campement, garde le nom que lui donne le Game Master. Une fois la partie commencée, le passé du monde est figé. Sa disposition l'est aussi, sauf pour les modifications manuelles (voir plus bas). Un fichier de configuration partagé emporte le monde tel qu'il a été créé à l'origine.

Ce que fait l'équipe au monde reste fait. Quand l'équipe aide ou gêne un groupe, rend deux groupes amis ou ennemis, se range du côté d'un groupe ou le trahit, améliore ou abîme un lieu, prend un lieu pour un groupe, détruit un groupe, met quelqu'un à la tête d'un groupe ou mène un lieu à la ruine, le Game Master l'enregistre dans sa réponse, comme il le fait pour un lieu ou un groupe que l'histoire introduit. Chaque changement est vérifié par rapport au monde : un changement d'un type que le kit désactive, comme une guerre dans un monde moderne paisible, ou qui nomme un lieu ou un groupe que le monde n'a pas, est refusé. Dès lors, le Game Master reçoit le monde tel que l'histoire l'a laissé : l'état du lieu, qui le tient et qui le dirige, ce que l'équipe y a fait, la réputation de l'équipe auprès de chaque groupe avec lequel elle a traité, et ce qui a changé depuis le début de la partie. Un lieu ajouté par l'histoire est un lieu où l'équipe peut aller. Un changement appartient à la réponse qui l'a produit : un swipe, une régénération ou un message supprimé l'annule donc avec cette réponse.

Le monde continue aussi sans l'équipe. Quand le Game Master dit que le temps passe (un voyage, une nuit de repos, une longue attente), le monde avance de lui-même, une semaine à la fois, et seulement dans les types de changements qu'autorise le kit : les fortunes montent et descendent, des nouveaux venus s'installent, des groupes se rapprochent ou deviennent rivaux, des chefs se retirent et, là où le monde en a, les ennuis touchent les lieux en difficulté, et la tension entre deux groupes peut devenir une guerre après une saison à monter. Les catastrophes ne viennent jamais d'elles-mêmes ; seul le Game Master peut en narrer une, comme tout événement hors de portée de l'équipe, refusé si son type est désactivé. Rien n'est décidé là où se trouve l'équipe : ce qui est sur le point d'y arriver est laissé à la scène. Les nouvelles voyagent : le Game Master apprend un changement une fois écoulés les jours que prennent les routes, sous la forme d'une rumeur venue de loin, et voit ce qui couve à proximité, pour que l'équipe puisse intervenir. Il ne peut retenir une guerre qui couve que si elle n'a aucun sens pour le monde ou ruinerait la partie sans réelle chance pour l'équipe de l'arrêter. Les actes de l'équipe comptent davantage à mesure qu'elle se fait connaître : l'aide d'un inconnu change peu de choses, celle d'une équipe célèbre beaucoup.

Un monde peut aussi conserver des **hand edits** (modifications manuelles). Ce sont les changements que tu fais avec un éditeur de monde, un outil qui modifie un monde après sa création. Tu peux renommer ou déplacer des lieux, peindre le sol, et ajouter des lieux et des habitants. Tu peux aussi peindre le champ de bataille tactique d'un lieu (voir [Combat](combat.md#tactical-battles-and-terrain)) et disposer une ville à la main (voir [La ville](map-time-weather.md#the-town)). Chaque partie du jeu voit aussitôt les modifications : le Game Master, la carte du monde, les villes et l'onglet World. Un lieu renommé répond toujours à son ancien nom, et le Game Master apprend comment il s'appelait autrefois.

Les modifications manuelles changent le monde à partir de maintenant, jamais son passé. L'histoire du monde, et les changements qu'il a faits de lui-même, restent tels qu'ils étaient. Une agglomération que tu ajoutes reste telle que tu l'as ajoutée. Une ville garde sa disposition : les lieux et les habitants que tu ajoutes vont donc sur ses prochaines parcelles libres et dans ses prochains logements libres.

Un monde peut voyager sous forme de fichier. **Download this world** (télécharger ce monde), sous **Your world**, enregistre le monde que tu es en train de créer, et **Download the world** (télécharger le monde), dans l'onglet World d'une partie, enregistre le monde de cette partie, modifications manuelles comprises, dans un fichier `.world.json`. **Import a world file** (à côté du kit d'univers) en lit un dans la configuration d'une nouvelle partie : il choisit le kit d'univers du fichier et crée son monde, avec ses modifications manuelles. **Your worlds** (tes mondes) fait de même avec un monde conservé dans ta bibliothèque, comme un monde créé hors de toute partie avec un outil comme Pixelforge.

Un fichier de monde peut aussi emporter l'**histoire** du monde : les événements et les scènes qu'un créateur a écrits pour lui. L'histoire accompagne le monde et est conservée aux mêmes conditions. En jeu, les scènes d'une histoire apparaissent dans la narration avant la réponse du Game Master, exactement telles qu'elles ont été écrites. Ses objectifs de quête sont listés sous **Story** (histoire) dans l'onglet World du journal dès que l'histoire les fait apparaître. Pour en écrire une, consulte [Écrire des scripts d'histoire Game Mode](../extending/writing-story-scripts.md).

Les modifications manuelles et l'histoire ont été faites pour cette graine et ce brief : elles sont donc écartées si tu changes l'un ou l'autre. Si un fichier ne peut pas être lu, il est refusé et l'assistant dit pourquoi. Un fichier de monde emporte aussi le monde tel qu'il a été créé : un monde créé par une autre version du générateur de mondes s'ouvre donc exactement tel qu'il a été créé. Un fichier plus ancien qui ne l'emporte pas est refusé. Si quelque chose dans le fichier ne correspond pas au kit d'univers, c'est écarté et l'assistant indique quoi.

Une partie créée sans monde avant l'existence du choix du Game Mode peut en recevoir un plus tard, seulement si tu le veux : l'onglet **World** (monde) du journal propose **Make a world for this game** (créer un monde pour cette partie), avec les mêmes choix de kit d'univers et de monde qu'une nouvelle partie. Le monde commence au tour suivant ; les tours passés de la partie, sa carte et ses personnages restent tels quels. Tant qu'Overworld RPG n'est pas prêt, le bouton est grisé avec la même note que dans la configuration.

Une partie garde son monde tel qu'il a été créé. Les lieux, les habitants, les villes et le passé sont enregistrés avec la partie à son début et à chaque enregistrement de ses modifications manuelles : une mise à jour qui change la façon de créer les mondes ne modifie donc jamais un monde déjà en jeu. Une nouvelle session, une branche et un chat exporté gardent le même monde, et la façon dont le monde a évolué lors des sessions précédentes (ses fortunes, ses dirigeants et ses guerres) est conservée telle qu'elle s'est jouée. Un monde créé par une version antérieure du générateur de mondes continue de se jouer tel qu'il a été créé, mais ne peut plus être modifié.

Une partie avec un monde s'ouvre sur l'**overworld**, la carte du monde : le monde dessiné comme une carte en pixels, où tu peux faire marcher l'équipe d'agglomération en agglomération le long des chemins du monde et entrer dans la ville où elle se trouve ; la vue de scène n'est qu'à un clic. Consulte [La carte du monde](map-time-weather.md#the-overworld).

<a id="the-gm-intro-message"></a>

### Le message d'introduction du GM

**GM intro message**, à l'étape **Party**, décide de la façon dont la partie s'ouvre :

- **None** (aucun), le choix par défaut : le Game Master ouvre la partie comme il l'entend.
- **Defined** (défini) : saisis le premier message exactement tel qu'il doit se lire. La partie s'ouvre avec exactement ce message, et le régénérer donne le même texte.
- **Guided** (guidé) : décris comment l'ouverture doit se passer, par exemple où elle commence, qui est là et ce qui arrive en premier. Le Game Master écrit l'ouverture à partir de là.

Le texte peut compter jusqu'à 8 000 caractères. Il ne peut pas contenir de doubles accolades, et le texte **Guided** ne peut pas non plus contenir de crochets. Le champ indique quand le texte ne peut pas être utilisé. L'histoire d'un monde peut apporter sa propre introduction. Quand l'histoire la verrouille, le champ l'affiche avec "Set by this Experience and locked, so the game opens as its creator meant." et elle ne peut pas être changée.

### Valeurs par défaut à connaître

Voici les valeurs de départ des étapes **World**, **Party** et **Features**. Tu peux toutes les modifier.

| Réglage | Par défaut | Notes |
|---|---|---|
| Genre | Fantasy | Choix multiple, avec tes propres entrées si tu veux ; un kit d'univers choisi en premier définit le sien |
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

Les chats Game exigent **Let the GM search lore** pour les recherches dans les lorebooks par outil, même quand **Enable Tool Use** est activé. Lorsque l'option est désactivée, `search_lorebook` est indisponible dans le sélecteur d'outils. Un élément déjà sélectionné reste visible avec une explication, pour que tu puisses le retirer ou réactiver la recherche de lore.

**Game tool connection** (connexion des outils du jeu) vaut par défaut **Same as narrator** (comme le narrateur), ce qui conserve la boucle d'outils habituelle. Choisir une autre connexion lance une seule requête de planification séparée avant la narration. Ce modèle choisit les outils, puis le narrateur reçoit leurs résultats réels sous forme de texte. La requête supplémentaire est facturée sur la connexion choisie ; un modèle moins cher peut réduire le coût des outils, mais choisir d'autres outils. Cette unique phase de planification ne peut pas enchaîner une deuxième recherche à partir du premier résultat. Utilise **Same as narrator** pour que le narrateur raisonne sur plusieurs cycles d'outils (jusqu'à quatre par tour, après quoi il poursuit la narration avec les résultats dont il dispose).

Les connexions par abonnement Claude et Grok ne prennent pas en charge les appels natifs aux outils. Les contrôles concernés l'expliquent et restent désactivés tant qu'une connexion compatible pour les outils de Game n'est pas choisie. Les commandes textuelles et les balises de dés fonctionnent toujours. Si une connexion séparée manque ou si sa requête échoue, le tour signale l'échec au lieu de poursuivre discrètement la narration sans le travail demandé aux outils.

**Finish rolled turns in one request** (Terminer les tours avec des dés en une requête) change le second type d'appel décrit plus haut. Un tour avec des jets coûte normalement deux requêtes : le brouillon, puis une réécriture avec les vrais nombres. Avec cette option, le GM écrit l'issue à l'aveugle et le moteur remplit les nombres ensuite : le tour coûte une requête. Elle est désactivée par défaut. Deux choses ajoutent encore une requête : un appel à l'outil de dés avec **Enable Tool Use** actif et une **Game tool connection** distincte, qui fait toujours sa propre planification. Consulte [Game Mode : Dés et tests de compétence](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Si tes modèles locaux partagent une mémoire GPU limitée, ouvre **Chat Settings → Agents** et active **Run Game tasks one at a time** (exécuter les tâches Game une par une). La narration, les agents et les médias de scène s'attendent dans ce chat Game. L'option est désactivée par défaut et ne réserve pas le GPU face aux autres chats ou applications. Les commandes d'annulation existantes restent disponibles pendant l'exécution et l'attente.

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

<a id="the-games-controls"></a>

## Les contrôles du jeu

Sur ordinateur, les contrôles du jeu s'ouvrent avec les boutons près du coin supérieur droit du chat. Sur téléphone, ils se trouvent dans le menu à trois points déplaçable **Chat tools** (outils du chat) :

- **Game controls** (contrôles du jeu, la manette) :
  - **Retry turn**, **Retry scene analysis**, **Retry Music DJ** quand Music DJ joue la musique du jeu, et **Retry assets image generation**.
  - Quand un storyboard joue en arrière-plan du jeu, il propose aussi relecture, lecture/pause et coupure du son.
  - Dans une partie avec un monde, **Show the scene** (afficher la scène) et **Show the overworld** (afficher la carte du monde) changent de vue, et **Show the map** (afficher la carte) revient à une carte de donjon, de grotte ou de station ouverte.
  - **Edit game data** (modifier les données de jeu) corrige à la main les données enregistrées de la partie (voir [Modifier les données de la partie à la main](sessions-and-saves.md#editing-game-data-by-hand)), et **Checkpoints** (points de contrôle) ramène la partie à un moment antérieur (voir [Comment ta partie s'enregistre](sessions-and-saves.md#how-your-game-saves)).
- **Session** (la plume) : historique des sessions, journal et contrôles de session. Consulte [Game Mode : sessions et sauvegardes](sessions-and-saves.md).
- **Volume** (le haut-parleur) : volume de **Master**, **Music**, **Sound Effects**, **TTS** et **Ambient**.
- **Game Assets** (le dossier) : médias de scène et Asset Browser. Consulte [Ressources du jeu](game-assets.md).
- **Connected chat**, quand le jeu est lié à Conversation. Consulte [Chats connectés](../chats/connected-chats.md#switching-between-connected-chats).

Choisis un outil pour ouvrir ses contrôles dans une fenêtre déplaçable sur ordinateur, ou dans un panneau sur toute la largeur sur téléphone. Sur ordinateur, fais glisser son bouton pour le déplacer. Sur téléphone, déplace le menu à trois points, ou déverrouille-le pour réordonner les outils qu'il contient. Fermer la fenêtre ou le panneau te permet de rouvrir l'outil depuis le même endroit. Consulte [Fenêtres de contrôles et leurs boutons](../chats/chat-settings.md#control-windows-and-their-buttons).

Tu peux aussi garder ces contrôles dans **Chat Settings**. Ouvre la fenêtre d'un contrôle et choisis **Put back in Chat Settings** : il devient une section repliable. Son bouton de détachement lui redonne une fenêtre séparée. Chaque partie enregistre ton choix, et **Reset View** (réinitialiser la vue) rétablit la disposition de départ : des boutons sur ordinateur, ou des entrées de Chat tools sur téléphone.

**Character Profiles** (profils des personnages) reste en dehors de Chat tools, sur ordinateur comme sur téléphone. Fais glisser son bouton en forme de portrait où tu veux, puis ouvre-le pour choisir un membre de l'équipe et consulter ou modifier sa feuille de personnage. Sur téléphone, **Map** a aussi son propre bouton déplaçable. Les deux suivent le style de widget de ton chat, enregistrent leur position pour cette partie et peuvent être verrouillés depuis leur fenêtre ouverte. La carte sur ordinateur garde ses contrôles habituels de panneau de carte.

## Où trouver chaque sujet de jeu

Ce guide t'amène jusqu'au début de la partie. Chaque sujet plus poussé a son propre guide :

- [Game Mode : le combat](combat.md) traite des rencontres, du menu d'action, du calcul des dégâts et des quick-time events.
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md) traite de Character Profiles, des feuilles de personnage et de l'Adventure Journal.
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
