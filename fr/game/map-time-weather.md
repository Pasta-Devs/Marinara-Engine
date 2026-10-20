# Game Mode : carte, heure et météo

Ce guide explique le panneau de carte du Game Mode et les systèmes qui suivent l'évolution du monde autour de ton équipe : le jour et l'heure, la météo et le moral de l'équipe. Au programme aussi : les vues de la carte, le déplacement et le zoom, et le réglage manuel du jour et de l'heure.

## Le panneau de carte

Le Game Mode affiche un petit panneau de carte sur l'écran de jeu. Ce panneau indique le nom de la carte en cours, le jour de jeu et une icône de ciel qui donne le moment de la journée.

Sur un ordinateur, la carte s'affiche directement dans un panneau, lisible d'un coup d'œil. Tu peux faire glisser le panneau et le verrouiller en place. Pour comprendre le fonctionnement des panneaux déplaçables, consulte le guide des widgets HUD en lien plus bas.

Sur un téléphone, touche **Map** (carte) pour ouvrir le panneau de carte. Son bouton commence près du coin supérieur gauche et peut être déplacé dans le chat. Utilise le bouton **Lock window** (verrouiller la fenêtre) du panneau pour garder le bouton de carte en place ; **Close** (fermer) ramène à ce bouton. La position est enregistrée avec le chat. La carte sur téléphone suit le style des widgets du chat choisi dans **Settings → Appearance → App** (Paramètres → Apparence → Application), et son bouton reste séparé du menu à trois points **Chat tools** (outils du chat).

<a id="the-overworld"></a>

## La carte du monde

Une partie avec un monde généré (voir [Créer un monde](getting-started.md#making-a-world)) s'ouvre sur l'**overworld**, la carte du monde : le sol du monde dessiné comme une carte en pixels derrière la narration, avec ses forêts, ses collines, ses côtes et ses mers, les routes et les voies entre ses localités, chaque localité dessinée selon sa taille, et ton équipe. Les plus grands lieux sont nommés sur la carte, tout comme celui où tu te trouves. Fais glisser la carte pour regarder autour.

Touche ou clique sur une localité, ou choisis-la dans **Places** (lieux), où les plus proches viennent en premier avec la durée du trajet, pour voir sa taille et le trajet depuis l'endroit où tu es : combien de jours ou d'heures de route, et par quelles voies. **Walk there** (y aller) envoie l'équipe vers ce lieu par les voies du monde, par l'itinéraire le plus rapide, et les jours de marche passent aussitôt sur l'horloge. L'équipe s'y trouve dès lors, et **ton prochain tour indique au Game Master** où tu es allé, combien de temps cela a pris et par quelles voies, pour qu'il raconte l'arrivée. Le monde vit ces jours en même temps, comme quand le Game Master dit que le temps passe. Une deuxième marche avant ton prochain tour reprend là où la première s'est arrêtée.

Les grottes, les mines, les cryptes et les ruines situées à quelques pas d'une localité sont dessinées sur la carte du monde comme des **sites** : un nouveau monde en a un ou deux dans chaque région, nommés d'après la localité voisine ("Hollin Caves", "Ashby Ruins"), et un outil de création de mondes peut en ajouter d'autres, avec un tel nom ou une carte faite pour eux. Un monde créé avant l'arrivée des sites garde ses lieux tels quels. **Walk there** mène à un site comme à une localité : par les voies du monde jusqu'à sa localité, puis à pied hors de la route. Sur un site, son encart propose **Enter** (entrer), qui ouvre la carte du site (voir [Donjons, grottes et stations](#dungeons-caves-and-stations)) ; en sortir ramène l'équipe sur la carte du monde, au site. Un site important pour l'histoire de la partie reste **fermé** (dessiné estompé, sans trajet ni entrée possible) jusqu'à ce que le Game Master l'ouvre quand l'histoire y arrive ; un outil de création de mondes peut aussi garder un site caché sur la carte jusque-là, ou le laisser ouvert dès le départ.

Un lieu en ruine est dessiné en ruine. À la nuit tombée, la carte s'assombrit et les fenêtres des localités s'allument. Chaque famille d'univers a ses propres tuiles : la fantasy, le wuxia, l'époque moderne, les années 1920, la science-fiction et les terres dévastées ont chacun leurs couleurs et leurs bâtiments. Un kit d'univers sans famille dessine des tuiles simples.

La carte du monde est une vue, et la vue de scène (les arrière-plans et les illustrations de personnages de la partie) n'est qu'à un clic : choisis **Show the scene** (afficher la scène) dans **Game controls** (contrôles du jeu), qui se trouve sur téléphone dans le menu à trois points **Chat tools**, puis **Show the overworld** (afficher la carte du monde) pour revenir. La partie se souvient de ton choix. Un combat et la relecture d'une session utilisent leurs propres écrans.

### Les packs de tuiles

La carte du monde et les villes sont dessinées à partir de **packs de tuiles** : une palette et chaque tuile (chaque type de sol, les localités selon leur taille, l'équipe, ainsi que les rues, les toits et les habitants des villes) sous forme de rangées de pixels. Chaque famille d'univers a son propre pack intégré. Ouvre le panneau **Agents** et trouve **Tile packs** (packs de tuiles) pour :

- choisir le pack avec lequel chaque univers est dessiné ; **Built in** (intégré) désigne son propre pack ;
- utiliser **Import a tile pack** (importer un pack de tuiles) avec un fichier `.tilepack.json` que quelqu'un a partagé ;
- utiliser **Export** (exporter) pour partager un pack, ou **Remove** (retirer) pour le supprimer, ce qui ramène tout univers dessiné avec ce pack à ses propres tuiles.

Un pack n'a besoin que des tuiles qu'il change : tout ce qu'il omet est dessiné simplement. Un pack qui nomme une tuile que Marinara Engine ne dessine pas garde le reste et indique ce qu'il a laissé de côté.

<a id="the-town"></a>

### La ville

Quand l'équipe se trouve dans une localité, choisis-la sur la carte du monde puis **Enter** pour voir la ville. Elle est disposée à partir du monde : ses rues et sa place, les lieux que le monde ou l'histoire y placent (nommés sur leurs bâtiments), sa grande salle dans un lieu plus important, les ateliers des métiers qui font sa réputation, et ses habitations. Ses habitants sont là où l'heure les place : au travail le jour, sur la place au crépuscule, chez eux la nuit.

Une ville peut aussi être **disposée à la main** avec un outil de création comme Pixelforge, dans le cadre des modifications manuelles du monde : ses bâtiments déplacés sur d'autres parcelles (un bâtiment déplacé sur la parcelle d'un autre échange sa place avec lui, et chaque bâtiment donne toujours sur une rue), et son sol peint de rues, de pavés, de terrain dégagé, d'arbres ou d'un puits (jamais sous un bâtiment ni devant sa porte, au milieu de la place ou sous un étal de marché). Qui vit et travaille où ne change jamais, et la durée de la marche vers un bâtiment déplacé se compte depuis sa nouvelle porte. L'outil refuse une disposition qui ne convient pas à la ville, en donnant la raison ; les lieux que l'histoire ajoute en cours de partie trouvent toujours une parcelle. Une disposition peut aussi placer des bâtiments hors des parcelles, peindre des champs, des chemins de terre, de l'eau enjambée de ponts et des haies, et répartir des décorations dans la ville ; la vue de la ville les dessine tous (les décorations seulement avec un pack d'images qui les contient).

Choisis un bâtiment ou la place, ou fais ton choix dans **Places in town** (lieux en ville), pour voir qui s'y trouve en ce moment et à combien de minutes c'est. **Walk there** fait traverser la ville à l'équipe par les rues, en contournant les bâtiments (et les arbres, les puits, l'eau et les haies qu'une disposition manuelle a peints, en passant par ses ponts) : les minutes du trajet passent sur l'horloge, et **ton prochain tour indique au Game Master** où l'équipe est allée et qui s'y trouve. Une visite dans un lieu nommé, comme une auberge que l'histoire a ajoutée, en fait le lieu où se trouve l'équipe. **Leave town** (quitter la ville) ramène à la carte du monde. La partie se souvient de la vue où tu étais.

<a id="dungeons-caves-and-stations"></a>

### Donjons, grottes et stations

Dans une partie Overworld RPG (voir [Classic ou Overworld RPG](getting-started.md#classic-or-overworld-rpg)), quand l'histoire passe sous terre ou à bord, le Game Master peut ouvrir une **carte du lieu** : un donjon, une grotte ou une station, dessiné par-dessus la scène. Chacun est disposé à partir de la partie et du nom du lieu : le même lieu a donc toujours les mêmes salles, et revenir dans un lieu où l'équipe se trouve déjà garde la carte telle qu'elle était. Le Game Master choisit aussi son apparence parmi onze : grottes de roche, de glace, de cristal et de lave ; une crypte, des égouts et un temple ; et les couloirs, le laboratoire, le pont moteur et la serre hydroponique d'une station. Avec un pack de tuiles pour cette apparence dans la bibliothèque de packs de tuiles, la carte est dessinée avec ses graphismes ; sans pack, elle est dessinée en couleurs simples.

Un lieu de la ville où l'équipe peut descendre (une grotte, une mine, une crypte, des égouts ou une ruine, d'après son nom ; dans un univers de science-fiction, une épave ou un bunker) propose **Go down** (descendre) quand l'équipe s'y trouve. Il ouvre la carte de ce lieu de la même façon, la même carte à chaque fois, et en sortir ramène l'équipe en ville, là où elle est descendue. Si l'équipe est sur une autre carte, quitte d'abord celle-ci. Un lieu peut aussi avoir une carte **faite à la main** pour lui avec un outil de création comme Pixelforge : Go down ouvre alors cette carte, quel que soit le nom du lieu, dessinée avec le pack qu'elle nomme. Sur une telle carte, la sortie est là où l'équipe est entrée, ses accessoires ne bloquent jamais le passage, et des personnes se tiennent à ses emplacements nommés aux heures que la carte leur donne ; le Game Master est informé de qui s'y trouve.

Clique sur un endroit de la carte, ou utilise les flèches du clavier, pour t'y rendre par le chemin le plus court. Les minutes passent sur l'horloge (environ une minute tous les trente pas), et **ton prochain tour indique au Game Master** de quelle zone à quelle zone l'équipe a marché. L'étiquette en haut indique dans quelle zone se trouve l'équipe. **Show the scene** et **Show the map** (afficher la carte), dans **Game controls**, font passer de la carte à la scène et inversement ; la partie se souvient de celle où tu étais.

Pour sortir, reviens à la sortie (un escalier, une échelle ou une trappe, selon l'apparence du lieu) et choisis **Leave** (sortir). Le Game Master peut aussi fermer la carte quand l'histoire quitte le lieu. Régénérer un tour qui a ouvert une carte, qui s'y est déplacé ou qui l'a quittée remet la carte dans l'état d'avant ce tour. Les parties sans carte se jouent comme avant.

## Vue en grille et vue en nœuds

La carte a deux vues. Marinara Engine choisit la vue à ta place, selon le type de lieu que la carte représente. Le passage d'une vue à l'autre ne se fait pas à la main.

- La vue **en grille** convient aux zones ouvertes : une carte du monde, une région, une ville. Elle affiche des cases colorées selon le terrain – herbe, forêt, eau, montagne, désert, neige, ville, route et grotte.
- La vue **en nœuds** convient aux zones fermées comme les donjons et les intérieurs. Elle affiche les lieux sous forme de cercles reliés par des lignes. Un lieu que tu n'as pas encore découvert porte une icône de point d'interrogation. Une ligne en pointillés signale un chemin que tu n'as pas encore emprunté. Une ligne pleine signale un chemin déjà parcouru.

## Déplacer ton équipe

Pour voyager, choisis un lieu sur la carte. Tous les lieux ne sont pas sélectionnables. Sur une carte en grille, la case doit être adjacente à ton équipe et déjà découverte. Sur une carte en nœuds, le nœud doit être relié au lieu où tu te trouves, ou déjà découvert. Les autres cases et nœuds ne font rien quand tu cliques dessus.

1. Clique sur une case de la grille, ou sur un nœud dans une carte en nœuds.
2. Une pastille **Destination:** apparaît au-dessus de la zone de saisie, avec le nom du lieu.
3. Rédige ton message et envoie-le. Marinara ajoute une courte ligne du type `*moves to <place>*` au début du message.

Pour annuler, clique sur le petit bouton d'effacement (la croix X) de la pastille **Destination:**.

Sur un téléphone, la marche à suivre change un peu. Touche un nœud une fois pour le sélectionner, puis touche **Set destination** (définir la destination) dans le pied de page. Le nœud marqué **You are here** correspond au lieu où tu te trouves.

## Zoomer sur la carte

Chaque carte dispose d'une commande de zoom en haut à droite.

- Clique sur **Zoom in** (le bouton plus) pour te rapprocher.
- Clique sur **Zoom out** (le bouton moins) pour voir plus large.

Le zoom va de 75 % à 180 %, par paliers de 25 %.

## Passer d'une carte à l'autre

Certaines parties comptent plusieurs cartes ou régions. Dès qu'il y a plus d'une carte, un petit menu déroulant apparaît en haut du panneau de carte. Sers-t'en pour consulter une autre carte. La carte où tu te trouves vraiment porte la mention **(Current)**.

## Générer une nouvelle carte

En haut à gauche du panneau de carte, un bouton en forme de baguette magique s'appelle **Generate another map** (générer une autre carte). Clique dessus pour remplacer la carte en cours par une carte toute neuve.

Si une partie n'a pas encore de carte, le panneau affiche **No map yet** avec un bouton **Generate** qui fait la même chose.

## Régler le jour et l'heure à la main

La commande de jour et d'heure se trouve en haut du panneau de carte. Elle affiche **Day** (jour) suivi d'un nombre, plus une petite icône de ciel pour le moment de la journée.

1. Clique sur la commande **Day**.
2. Saisis un nouveau numéro de jour dans le champ. Le jour va de 1 à 9999.
3. Choisis un moment de la journée dans le menu déroulant. Les choix sont **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night** et **Midnight**.
4. Clique en dehors du champ ou appuie sur Enter pour enregistrer.

Il s'agit d'un réglage manuel, qui prend le pas sur l'horloge automatique décrite juste après : c'est toi qui fixes le jour et l'heure. L'horloge peut aussi afficher **Noon** d'elle-même, mais Noon ne fait pas partie des choix manuels.

## Comment le temps s'écoule tout seul

L'horloge de jeu tourne toute seule. Elle repose sur des calculs fixes, pas sur l'IA, donc elle reste toujours cohérente. Chaque nouvelle partie commence au jour 1, à 08:00 du matin. Chaque action que tu fais avance l'horloge d'une durée déterminée.

| Action | Temps ajouté |
|---|---|
| Parler | 15 minutes |
| Explorer | 30 minutes |
| Un round de combat | 5 minutes |
| Un repos court | 1 heure |
| Un repos long | 8 heures |
| Un voyage | 2 heures |

Quand l'horloge dépasse minuit, le numéro du jour augmente de un.

Dans une partie avec un monde, le temps passe aussi tout seul :

- Tant que la carte du monde est au premier plan et que la partie attend ton action, une minute de jeu passe toutes les cinq secondes réelles. Elle s'arrête pendant que le Game Master écrit, tant que tu n'as pas lu sa réponse, quand la vue de scène est au premier plan et quand l'application est en arrière-plan.
- Une marche sur la carte du monde fait passer les jours que prend son itinéraire.
- Quand le Game Master dit que des jours passent (un voyage, un repos long, une attente), l'horloge avance aussi de ces jours. Une réponse régénérée ne la fait pas avancer de nouveau ; règle le jour à la main si le nouveau récit prend un temps différent.

## La météo

Le jeu suit aussi la météo tout seul, avec des calculs fixes et sans IA. La météo dépend du biome et de la saison. Le biome, c'est le type de milieu où se trouve ton équipe : désert, arctique, littoral, montagne… Côté météo, on trouve par exemple le ciel dégagé, les nuages, la pluie, l'orage, la neige, le blizzard, le brouillard et la tempête de sable.

La météo peut changer quand tu agis. Elle change le plus souvent lors d'un voyage ou d'un repos long, parfois quand tu explores, rarement dans les autres cas. La météo influence la façon dont le Game Master (le maître du jeu) décrit chaque scène.

Pour voir la météo à l'écran, active le réglage **Dynamic weather effects (rain, snow, fog, etc.)** dans les réglages d'apparence de l'application. Il est actif par défaut. Une fois activé, des particules animées – pluie, neige, brouillard – se superposent au jeu. Elles correspondent à la météo et au moment de la journée. Pour les autres options d'affichage, consulte le guide des réglages d'apparence en lien plus bas.

## Le moral de l'équipe

Le jeu tient un score de moral d'équipe caché, de 0 à 100. Il comporte cinq niveaux, du plus bas au plus haut : Broken, Low, Steady, High et Inspired.

Le moral évolue au fil de l'histoire. Gagner un combat, terminer une quête ou trouver un trésor le fait monter. Perdre un combat, rater une quête ou perdre un allié le fait descendre. Avec le temps, le moral revient peu à peu vers le milieu.

Le moral n'apparaît pas sous forme de nombre dans le jeu : il agit en coulisses. Il modifie tes jets de dés, de plus 2 au niveau Inspired à moins 2 au niveau Broken. Il teinte aussi la façon dont le Game Master décrit l'humeur de ton équipe.

## Guides associés

- [Game Mode : premiers pas](getting-started.md)
- [Game Mode : widgets HUD](hud-widgets.md)
- [Réglages d'apparence](../appearance/appearance-settings.md)
