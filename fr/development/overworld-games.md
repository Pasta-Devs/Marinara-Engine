# Parties Overworld (non disponibles)

Notes réservées aux développeurs. Les parties **Overworld** (kits d'univers, mondes générés, carte du monde, villes et cartes de donjon) ne sont pas encore implémentées pour les joueurs. Rien ici ne relève de la documentation utilisateur : Professor Mari et la page de documentation intégrée ne lisent pas `docs/development` (à part les quelques guides qu'elles répertorient). Garde donc le contenu Overworld dans ce fichier jusqu'à la sortie du mode. À sa sortie, remets ces sections dans les guides des joueurs sous `docs/game/`.

Le mode reste verrouillé sauf si le serveur définit ce drapeau. Ne le documente pas dans `docs/CONFIGURATION.md` ou `.env.example` tant que le mode est inachevé.

| Variable | Par défaut | Description |
| --- | --- | --- |
| `MARINARA_OVERWORLD_GAMES` | `false` | Permet aux joueurs de créer des parties Overworld (un kit d'univers et un monde généré) et de convertir une ancienne partie en partie Overworld. Désactivé, l'assistant ne propose que des parties VN. |

## Configuration : mode de jeu, kit d'univers et monde

### VN ou Overworld

Une nouvelle partie se joue dans l'un de deux modes de jeu, choisi à la première étape et conservé pour toutes ses sessions :

- **Overworld** : un monde créé pour ton univers, parcouru sur une carte du monde, avec des villes, des lieux à explorer et des donjons. Il lui faut un kit d'univers et un monde. Tant que tu n'as pas choisi de kit, celui de ton premier genre est pris (High fantasy si le genre n'en a pas), et un monde est tiré au sort pour lui.
- **VN** : Game Mode tel qu'il a toujours été, raconté comme un roman visuel, scène par scène, avec la carte de scène et les combats, et sans kit d'univers, monde, carte du monde, villes ni cartes de donjon.

Overworld est verrouillé tant que la personne qui exploite le serveur ne définit pas `MARINARA_OVERWORLD_GAMES`. Tant qu'il est verrouillé, son encart est grisé avec la note "Les parties Overworld, avec un kit d'univers et un monde généré, ne sont pas encore prêtes. Les nouvelles parties commencent comme des parties VN." Toute nouvelle partie est alors une partie VN, et les choix de kit d'univers et de monde n'apparaissent pas. Une partie créée avant l'existence de ce choix continue de se jouer comme avant : avec un monde, c'est une partie Overworld ; sans monde, une partie VN.

### Choisir un kit d'univers

Un **Kit d'univers** donne au GM (le maître du jeu) les mots dans lesquels s'écrit ton type de monde : les noms de lieux et les tailles d'agglomération, les types de groupes, la façon dont on voyage, le nom d'une année et d'un jour, la façon dont les peuples se nomment, la monnaie et les marchandises, les éléments, les lieux de combat et la famille d'illustrations et de musiques qu'il utilise (voir [Ressources de jeu](#art-and-music-families)). Il indique aussi quels types de changements le monde autorise, comme les rivalités, le crime, les guerres ou les catastrophes, et à quelle vitesse il change. Un type désactivé n'est jamais introduit : une querelle peut donc rester une querelle.

Il y a huit kits : high fantasy, wuxia et xianxia, époque moderne, moderne surnaturel, années 1920, cyberpunk, space opera et post-apocalyptique. L'époque moderne est paisible par défaut, sans crime, conflit ni catastrophe, à un rythme lent.

- Choisir un kit avant un genre définit le genre qui lui correspond. Un genre que tu as choisi toi-même reste tel quel.
- **L'écrire pour mon univers** demande à ton modèle de GM de réécrire le kit pour le genre, le cadre et le ton que tu as choisis. Si le résultat ne tient pas debout, la demande est refaite une fois au modèle avec les raisons. Si cela échoue encore, l'assistant t'indique ce qui n'allait pas et garde le kit que tu avais.
- **Modifier ses mots** ouvre chaque mot du kit. Tape une liste sur une seule ligne, avec des virgules entre les éléments. Un kit qui a un problème, comme un nom vide ou aucune agglomération, indique ce qui ne va pas, et la partie ne peut pas commencer tant qu'il n'est pas corrigé.
- **Télécharger ce kit** enregistre un fichier `.worldkit.json` à partager. **Importer un fichier de kit** en relit un.

La partie garde le kit avec lequel elle a été créée, et un fichier de configuration partagé l'inclut. Une Experience peut fournir son propre pack de carte (un kit, des cartes toutes prêtes et des tuiles). Avec cette Experience activée, la configuration affiche son kit comme déjà défini et, si elle fournit des cartes, une **Carte** à choisir. Désactiver l'Experience te rend tes choix.

### Créer un monde

Une fois un kit choisi, **Ton monde** dispose un monde dans les mots du kit avant le début de la partie : les régions, les agglomérations de toutes les tailles, ce pour quoi chaque lieu est connu et les chemins qui les relient (routes, rivières, voies maritimes, couloirs de saut), avec la durée de chaque trajet en jours.

Un monde se crée à partir d'une **Graine du monde**. La même graine, le même kit et le même brief donnent toujours le même monde. **Tirer** en donne un autre, et ressaisir un nombre en fait revenir un. L'aperçu montre une petite carte du sol et des agglomérations, le point de départ de l'équipe et la liste des agglomérations par région.

- **Partir de ce lore** lit les lorebooks cochés pour y trouver les lieux et les événements datés qu'ils indiquent, conservés exactement tels qu'ils sont écrits. **Construire autour du lore** complète le monde autour d'eux. **Seulement les lieux du lore** ne crée rien d'autre.
- **Écrire le brief du monde** demande à ton modèle de GM le présent, les lieux majeurs, les groupes autour desquels tourne le présent (ce que veut chacun, ses alliés et ses rivaux) et des noms pour les lieux et les personnes, dans la sonorité propre à chaque peuple. Les lieux du lore sont conservés quoi qu'écrive le modèle. Tout ce qui ne correspond pas au kit est écarté et compté. **Modifier le brief** ouvre ses mots, y compris les prénoms et les noms de famille de chaque peuple. Sans brief, les lieux sont numérotés et les gens sont désignés par leur métier.

**Un monde a un passé.** Avant le début de la partie, le monde avance année après année depuis sa fondation. Les agglomérations grandissent, et les groupes sont fondés, prennent et perdent des chefs, se rapprochent et se brouillent entre eux. Là où le monde en a, les bandits, les guerres et les famines laissent leur marque. Un changement grave ne survient qu'après avoir couvé, et seulement dans les types que le kit autorise. Les événements datés de ton lore ou du brief se produisent quand et où ils le disent. La même graine et le même brief donnent le même passé.

**Ce que sait le GM.** Le GM sait toujours où se trouve l'équipe, où elle peut aller et combien de temps prend chaque chemin. Il apprend les événements les plus notables du passé, qui dirige le lieu actuel et le passé de ce lieu. Pour tout autre lieu ou groupe, il peut demander, et reçoit la réponse à son tour suivant. Il nomme l'endroit où va l'équipe avec une balise de lieu. Un lieu que liste le monde garde la taille que le monde lui a donnée. Un lieu que le monde ne liste pas, comme une ferme, garde le nom que lui donne le GM. Chaque agglomération a ses habitants, tirés par la graine quand l'équipe y arrive : un nom issu de leur culture, un métier adapté au lieu, un tempérament, une façon de parler et une apparence. Quand le GM nomme quelqu'un en entier, cette personne rejoint les personnages suivis.

**Ce que fait l'équipe reste fait.** Quand l'équipe aide ou gêne un groupe, change ce que deux groupes pensent l'un de l'autre, prend ou ruine un lieu, ou met quelqu'un à la tête d'un groupe, le GM l'enregistre dans sa réponse. Chaque changement est vérifié par rapport au monde. Un changement d'un type que le kit désactive, ou qui nomme un lieu ou un groupe que le monde n'a pas, est refusé. Dès lors, le GM reçoit le monde tel que l'histoire l'a laissé. Un lieu ajouté par l'histoire est un lieu où l'équipe peut aller. Un swipe (une réponse alternative), une régénération ou un message supprimé annule un changement avec sa réponse.

**Le monde continue sans l'équipe.** Quand le GM dit que le temps passe, le monde avance d'une semaine à la fois, seulement dans les types de changements qu'autorise le kit. Les catastrophes ne viennent jamais d'elles-mêmes : seul le GM peut en narrer une, et elle est refusée si son type est désactivé. Rien n'est décidé là où se trouve l'équipe. Les nouvelles voyagent : le GM apprend un changement lointain une fois écoulés les jours que prennent les routes. Les actes de l'équipe comptent davantage à mesure qu'elle se fait connaître.

**Modifications manuelles.** Dans un éditeur de monde, tu peux renommer ou déplacer des lieux, peindre le sol, ajouter des lieux et des habitants, peindre le champ de bataille tactique d'un lieu (voir [Combat](../game/combat.md#tactical-battles-and-terrain)) et disposer une ville (voir [La ville](#the-town)). Tous les éléments du jeu voient aussitôt les modifications. Un lieu renommé répond toujours à son ancien nom. Les modifications changent le monde à partir de maintenant, jamais son passé. Une ville garde sa disposition : les lieux et les habitants que tu ajoutes vont donc sur ses prochaines parcelles libres et dans ses prochains logements libres.

**Fichiers de monde.** **Télécharger ce monde**, sous **Ton monde**, enregistre le monde que tu es en train de créer, et **Télécharger le monde**, dans l'onglet Monde d'une partie, enregistre le monde de cette partie, modifications manuelles comprises, dans un fichier `.world.json`. **Importer un fichier de monde**, à côté du kit d'univers, en lit un dans la configuration d'une nouvelle partie : il choisit le kit du fichier et crée son monde. **Tes mondes** fait de même avec un monde de ta bibliothèque. Un fichier peut aussi contenir l'histoire du monde : les événements et les scènes que son créateur a écrits. Les scènes d'une histoire apparaissent dans la narration avant la réponse du GM, exactement telles qu'elles ont été écrites, et ses objectifs de quête sont listés sous **Histoire** dans l'onglet Monde du journal. Pour en écrire une, voir [Écrire des scripts d'histoire Game Mode](writing-story-scripts.md). Les modifications manuelles et l'histoire appartiennent à cette graine et à ce brief : elles sont donc écartées si tu changes l'un ou l'autre. Un fichier illisible est refusé, et l'assistant dit pourquoi. Si le contenu d'un fichier ne correspond pas au kit, il est en partie écarté, et l'assistant indique ce qui l'a été.

**Plus tard, et ce qui est enregistré.** Une partie créée sans monde peut en recevoir un plus tard depuis l'onglet **Monde** du journal, avec **Créer un monde pour cette partie**. Le monde commence au tour suivant, et les tours passés, la carte et les personnages restent. Le bouton est grisé tant qu'Overworld RPG est verrouillé. Une partie garde son monde tel qu'il a été créé : une nouvelle session, une branche et un chat exporté gardent donc le même monde. Un monde créé par une version antérieure du générateur continue de se jouer, mais ne peut plus être modifié.

Une partie avec un monde s'ouvre sur l'**overworld**, la carte du monde en pixels où tu fais marcher l'équipe d'une agglomération à l'autre et où tu entres dans les villes. Voir [La carte du monde](#the-overworld).

## Cartes

### La carte du monde

Une partie avec un monde généré (voir [Créer un monde](#making-a-world)) s'ouvre sur l'**overworld**, la carte du monde : le sol du monde dessiné comme une carte en pixels derrière la narration, avec les forêts, les collines, les côtes et les mers, les routes et les voies entre les localités, chaque localité dessinée selon sa taille, et ton équipe. Les plus grands lieux sont nommés, tout comme celui où tu te trouves. Fais glisser la carte pour regarder autour.

1. Touche ou clique sur une localité, ou choisis-la dans **Lieux**, où les plus proches viennent en premier, avec la durée du trajet.
2. Lis sa taille et le trajet depuis l'endroit où tu es : des jours ou des heures, et par quelles voies.
3. Clique sur **Y aller**. L'équipe suit les voies du monde par l'itinéraire le plus rapide, et les jours de marche passent aussitôt sur l'horloge.

Ton prochain tour indique au GM où tu es allé, combien de temps cela a pris et par quelles voies, pour qu'il raconte l'arrivée. Une deuxième marche avant ton prochain tour reprend là où la première s'est arrêtée.

Les grottes, les mines, les cryptes et les ruines situées à quelques pas d'une localité sont dessinées comme des **sites**. Un nouveau monde en a un ou deux dans chaque région, nommés d'après la localité voisine ("Hollin Caves", "Ashby Ruins"). **Y aller** suit les voies jusqu'à sa localité, puis continue à pied hors de la route. Sur un site, **Entrer** ouvre sa carte (voir [Donjons, grottes et stations](#dungeons-caves-and-stations)). Un site important pour l'histoire reste **fermé** (estompé, sans trajet ni entrée) jusqu'à ce que le GM l'ouvre. Un outil de création de mondes peut aussi cacher un site jusque-là, ou l'ouvrir dès le départ.

Un lieu en ruine est dessiné en ruine. À la nuit tombée, la carte s'assombrit et les fenêtres s'allument. Chaque famille d'univers (la fantasy, le wuxia, l'époque moderne, les années 1920, la science-fiction, les terres dévastées) a ses propres tuiles. Un kit sans famille dessine des tuiles simples.

Pour changer de vue, utilise **Afficher la scène** et **Afficher la carte du monde** dans **Contrôles du jeu**, qui se trouve sur téléphone dans le menu à trois points **Outils du chat**. La partie se souvient de ton choix. Un combat et la relecture d'une session utilisent leurs propres écrans.

### Les packs de tuiles

Les packs de tuiles contiennent la palette et chaque tuile (chaque type de terrain, les localités selon leur taille, l'équipe, ainsi que les rues, les toits et les habitants d'une ville) sous forme de lignes de pixels. Chaque famille d'univers possède un pack intégré. Ouvre le panneau **Agents** et trouve **Packs de tuiles** pour :

- choisir le pack avec lequel chaque univers est dessiné : **Intégré** désigne son propre pack,
- utiliser **Importer un pack de tuiles** avec un fichier `.tilepack.json`,
- utiliser **Exporter** pour partager un pack, ou **Retirer** pour le supprimer, ce qui ramène tout univers dessiné avec ce pack à ses propres tuiles.

Un pack n'a besoin que des tuiles qu'il change, et tout ce qu'il omet est dessiné simplement. Un pack qui nomme une tuile que Marinara ne dessine pas garde le reste et indique ce qu'il a laissé de côté.

### La ville

Dans une localité, choisis-la sur la carte du monde puis **Entrer** pour voir la ville. Elle est disposée à partir du monde : des rues et une place, les lieux que le monde ou l'histoire y placent (nommés sur leurs bâtiments), une grande salle dans un lieu plus important, des ateliers pour les métiers qui font la réputation du lieu, et des habitations. Les habitants sont là où l'heure les place : au travail le jour, sur la place au crépuscule, chez eux la nuit.

Choisis un bâtiment ou la place, ou fais ton choix dans **Lieux en ville**, pour voir qui s'y trouve et à combien de minutes c'est. **Y aller** fait traverser la ville par les rues, en contournant les bâtiments et tout ce qu'une disposition manuelle a peint, en passant par ses ponts. Les minutes passent sur l'horloge, et ton prochain tour indique au GM où l'équipe est allée et qui s'y trouve. Une visite dans un lieu nommé, comme une auberge que l'histoire a ajoutée, en fait le lieu actuel de l'équipe. **Quitter la ville** ramène à la carte du monde. La partie se souvient de la vue où tu étais.

Une ville peut être **disposée à la main** avec un éditeur de monde comme Pixelforge, dans le cadre des modifications manuelles du monde.

- Les bâtiments peuvent être déplacés sur d'autres parcelles. Un bâtiment déplacé sur la parcelle d'un autre échange sa place avec lui, et chaque bâtiment donne toujours sur une rue.
- Le sol peut être peint de rues, de pavés, de terrain dégagé, d'arbres ou d'un puits, mais jamais sous un bâtiment, devant sa porte, au milieu de la place ou sous un étal de marché.
- Qui vit et travaille où ne change jamais, et la durée de la marche vers un bâtiment déplacé se compte depuis sa nouvelle porte.
- L'éditeur refuse une disposition qui ne convient pas à la ville et explique pourquoi. Les lieux que l'histoire ajoute en cours de partie trouvent toujours une parcelle.
- Une disposition peut aussi placer des bâtiments hors des parcelles, peindre des champs, des chemins de terre, de l'eau enjambée de ponts, et des haies, et placer des décorations. La vue de la ville les dessine tous (les décorations seulement avec un pack d'images qui les contient).

### Donjons, grottes et stations

Quand l'histoire passe sous terre ou à bord, le GM peut ouvrir une **carte du lieu** : un donjon, une grotte ou une station, dessiné par-dessus la scène. Elle est disposée à partir de la partie et du nom du lieu : le même lieu a donc toujours les mêmes salles, et y revenir garde la carte telle qu'elle était. Le GM choisit une apparence parmi onze : grottes de roche, de glace, de cristal et de lave ; une crypte, des égouts et un temple ; et les couloirs, le laboratoire, le pont moteur et la serre hydroponique d'une station. Avec un pack de tuiles pour cette apparence, la carte utilise ses graphismes. Sans pack, elle est en couleurs simples.

Un lieu de la ville où l'équipe peut descendre (une grotte, une mine, une crypte, des égouts ou une ruine d'après son nom, ou en science-fiction une épave ou un bunker) affiche **Descendre** quand l'équipe s'y trouve.

- Il ouvre la même carte à chaque fois, et en sortir ramène l'équipe en ville.
- Si l'équipe est sur une autre carte, quitte d'abord celle-ci.
- Un lieu peut aussi avoir une carte faite à la main avec un éditeur de monde comme Pixelforge. **Descendre** ouvre alors cette carte, quel que soit le nom du lieu, dessinée avec le pack qu'elle nomme. Sur une telle carte, la sortie est là où l'équipe est entrée, les éléments de décor ne bloquent jamais le passage, et des personnes se tiennent sur des emplacements nommés aux heures que la carte leur donne. Le GM est informé de qui s'y trouve.

Clique sur un endroit de la carte, ou utilise les flèches du clavier, pour t'y rendre par le chemin le plus court. Les minutes passent sur l'horloge (environ une minute tous les trente pas), et ton prochain tour indique au GM de quelle zone à quelle zone l'équipe a marché. L'étiquette en haut indique la zone actuelle. **Afficher la scène** et **Afficher la carte**, dans **Contrôles du jeu**, font passer de la scène à la carte et inversement.

Pour sortir, reviens à la sortie (un escalier, une échelle ou une trappe) et choisis **Quitter**. Le GM peut aussi fermer la carte quand l'histoire quitte le lieu. Régénérer un tour qui a ouvert une carte, s'y est déplacé ou l'a quittée remet la carte dans l'état d'avant ce tour.

## Temps

Dans une partie avec un monde, le temps passe aussi tout seul :

- Tant que la carte du monde est au premier plan et que la partie attend ton action, une minute de jeu passe toutes les cinq secondes réelles. L'horloge s'arrête pendant que le GM écrit, tant que tu n'as pas lu sa réponse, quand la vue de scène est au premier plan et quand l'application est en arrière-plan.
- Une marche sur la carte du monde fait passer les jours que prend son itinéraire.
- Quand le Game Master (GM) dit que des jours passent (un voyage, un repos long, une attente), l'horloge avance de ces jours. Une réponse régénérée ne la fait pas avancer de nouveau. Règle le jour à la main si le nouveau récit prend un temps différent.

## Combat

### Les éléments

Les éléments qui existent dépendent de l'univers :

- Sans kit d'univers, ou avec un kit qui n'en nomme aucun : les six classiques (feu, glace, foudre, poison, sacré, ombre).
- Wuxia : les cinq phases (bois, feu, terre, métal, eau), chacune l'emportant sur la suivante.
- Cyberpunk et space opera : cinétique, thermique, EM, et chimique ou plasma.
- Époque moderne et années 1920 : aucun.

La pluie et les orages en terrain découvert affaiblissent les éléments de type feu et renforcent ceux de type foudre. Dans un combat tactique, un élément frappe plus fort contre un élément qu'il domine et moins fort contre un élément qui le domine. Tu peux changer les éléments d'un kit et ses réactions sous **Modifier ses mots**. Consulte [Choisir un kit d'univers](#choosing-a-setting-kit).

### Butin

Ce qui tombe dépend de ton univers. Une partie avec un kit d'univers fait tomber le butin propre au kit (une partie à l'époque moderne donne une carte cadeau ou une trousse de premiers secours, jamais une épée enchantée), et tu peux changer ces mots sous **Modifier ses mots**. Une partie sans kit fait tomber ce que son genre propose d'habitude. Un genre sans kit de départ, comme Steampunk, fait tomber des objets ordinaires qui n'appartiennent à aucun univers. Dans une partie dont l'ensemble de règles a ses propres tables de butin, les ennemis lâchent plutôt les objets de l'ensemble de règles, et un ensemble de règles qui désactive les objets propres à Game Mode ne fait tomber que les siens.

### Champs de bataille faits à la main

Un monde peut aussi avoir des champs de bataille faits à la main : des plateaux peints case par case pour l'un de ses lieux, avec un éditeur de monde comme Pixelforge. Quand un combat commence dans ce lieu, ou dans un lieu qu'il contient, il utilise l'un de ces plateaux au lieu d'un plateau généré.

- Le plateau est utilisé exactement tel qu'il a été peint. Si le lieu en a plusieurs, c'est la graine du combat (un nombre qui en désigne un) qui choisit.
- La description de terrain du GM n'y est pas utilisée, mais sa formation décide toujours où chaque camp commence. Le GM est informé que le plateau a été fait pour ce lieu.
- Un plateau fait à la main doit respecter trois règles : il a l'une des trois tailles de plateau, les deux colonnes de chaque côté sont des plaines où les camps se mettent en place, et chaque case où un combattant peut se tenir est reliée aux autres. L'outil de création refuse un plateau qui enfreint une règle et explique pourquoi.

Ces plateaux sont conservés avec les modifications manuelles du monde : ils voyagent donc dans les fichiers de monde, les packs de carte et la bibliothèque.

### Les scènes de champ de bataille

Une partie avec un kit d'univers nomme ses propres scènes dans ses mots : un combat cyberpunk se déroule ainsi sur un toit ou dans un couloir de mégabloc, et un combat wuxia dans une forêt de bambous ou une maison de thé. Les cases du plateau utilisent elles aussi les mots de l'univers (abri et débris plutôt que forêt et ruines). Tu peux changer les scènes d'un kit et les mots de ses cases sous **Modifier ses mots**.

## Journal, argent et sessions

L'onglet **Monde** montre où tu te trouves et à quel point l'équipe est connue, sa réputation auprès de chaque groupe, ce qu'elle a fait, les nouvelles qui lui sont parvenues (les rumeurs sont signalées), les troubles qui couvent et dont elle a entendu parler, et le passé que n'importe quel habitant raconterait. Il ne montre que ce que l'équipe peut savoir. Les secrets que seul le GM connaît restent cachés. Il suit l'histoire à travers les swipes et les branches.

Une partie sans ensemble de règles a elle aussi de l'argent et un marché quand son kit d'univers en prévoit. C'est le cas de chaque kit de départ, par exemple le cuivre, l'argent et l'or en high fantasy, les sapèques de cuivre et les taels d'argent en wuxia, les dollars et les cents à l'époque moderne, et les crédits en cyberpunk et en space opera. La boutique du kit liste des objets du quotidien, chacun avec un prix et le plus petit lieu qui le vend : un village a un café, mais seule une ville a une trousse de premiers secours. Tu peux changer l'argent et la boutique sous **Modifier ses mots** dans le kit, ou retirer l'argent. Voir [Choisir un kit d'univers](#choosing-a-setting-kit).

Dans une partie avec un monde généré, le monde reprend là où il en était : les jours écoulés, les actes et la réputation de l'équipe, les lieux et groupes ajoutés par l'histoire, et les déplacements de l'équipe.

## Familles d'images et de musique

Une partie lancée avec un kit d'univers a une famille artistique, affichée sous **Visuels et musique** quand tu modifies les mots du kit : `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland`, ou une famille propre au kit. La partie utilise les dossiers qui portent le nom de sa famille et tous les dossiers qui ne portent le nom d'aucune famille, et laisse de côté les dossiers des autres familles. Une partie cyberpunk ne joue jamais de musique de bataille fantasy et n'affiche jamais la forêt enchantée. Quand rien ne convient dans sa famille ni dans les dossiers partagés, rien n'est joué, plutôt qu'une piste d'une autre famille. Une partie sans kit d'univers utilise tous les dossiers.

- **Musique** : place les pistes de l'univers dans `music/<state>/<family>/<intensity>`, par exemple `combat/wuxia/intense`. Elles passent avant les pistes partagées.
- **Arrière-plans** : `backgrounds/<family>`. Les arrière-plans générés dans une partie avec un kit d'univers y sont aussi enregistrés.
- **Sons de combat** : un son placé dans `sfx/combat/<family>` qui porte le même nom qu'un son fourni, comme `sword-swing`, le remplace dans les parties de cette famille. Les sons de combat fournis sont de style fantasy : les combats des autres familles restent donc silencieux tant que tu n'ajoutes pas les leurs.

Les arrière-plans de départ fournis comptent comme partagés, sauf ceux de fantasy (`ancient_library`, `castle_cliff`, `enchanted_forest`) et `city_night`, de la famille modern. Un kit d'univers enregistré avant l'arrivée des familles artistiques fonctionne toujours : un kit créé à partir d'un kit de départ utilise la famille de ce kit de départ, et tout autre kit utilise tous les dossiers jusqu'à ce que tu choisisses une famille sous **Visuels et musique**. La barre de sélection décrite plus haut indique la famille de la partie ouverte.

## World Maps : À partir du monde

- **À partir du monde** apparaît quand la partie Game crée un monde (voir [Créer un monde](#making-a-world)). Cette option dispose ce monde en carte : ses régions, ses agglomérations et ses lieux, ainsi que les chemins qui les relient, avec leurs temps de trajet. Tu la vérifies avant qu'elle soit enregistrée. Elle ne demande aucune génération par l'IA, et les lieux de la carte sont ceux du monde. En jeu, les deux restent synchronisés. Le Game Master et les marchés utilisent le lieu où la carte place l'équipe. Quand le Game Master nomme un lieu du monde, la carte y déplace l'équipe. Avec World Maps 1.6.0 ou ultérieur, elle prend l'itinéraire le plus court. Les versions antérieures ne déplacent l'équipe que d'une étape : un lieu intérieur, le lieu qui l'entoure, ou un lieu relié par un chemin.

## Scripts d'histoire

Les mondes peuvent contenir des scripts d'histoire. Voir [Écrire des scripts d'histoire pour Game Mode](writing-story-scripts.md).
