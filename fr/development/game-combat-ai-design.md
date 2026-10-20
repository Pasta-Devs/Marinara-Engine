# IA de combat de Game Mode : ennemis, compagnons et boss GM

**Statut : l'IA ordinaire et la première implémentation des boss GM/réactions existent localement ; Summoning et les règles nommées restent des propositions.** Préparé le 17 septembre 2026 depuis le code de combat fusionné dans staging par [PR #6266](https://github.com/Pasta-Devs/Marinara-Engine/pull/6266). Référence staging auditée initialement : `1f2e965c34f77b19a1457439f61e291300e163c7` ; le checkout `025442b1722b090b4640e0f078d1e08a4435f965` avait la même implémentation de combat pertinente. L'implémentation locale actuelle part de staging `abe61d30a`. Revérifie staging avant de poursuivre ; les numéros de ligne de l'audit original décrivent son ancienne référence.

Ce document autonome permet de reprendre le développement sans la conversation initiale. Il consigne exigences du mainteneur, audit des sources, valeurs recommandées, limites d'implémentation et scénarios d'acceptation. Les nombres et champs proposés hors du périmètre implémenté de la section 13 ne sont ni des contrats existants ni des affirmations d'équilibrage éprouvé. Implémentation et transmissions sont des travaux locaux ; aucune issue ni aucun PR n'a été soumis.

## Actualisation du périmètre du 17 septembre

Le mainteneur a approuvé l'IA ordinaire dans Classic et Tactical ainsi que le contrôle facultatif des compagnons par l'IA, puis autorisé la suite consacrée aux boss GM/réactions. Les boss définis explicitement peuvent utiliser des actions légendaires indépendamment du choix de règles 5e. Le GM, le maître du jeu, reçoit les fiches de combat/ressources du groupe et peut prévoir les actions probables au début d'une activation. Les réactions payantes comme Counterspell exigent une décision du contrôleur, pas une utilisation systématique dès qu'elles sont disponibles. Summoning reste une extension de conception. L'audit original et le détail du projet sont conservés ci-dessous ; les sections 13–17 précisent les décisions actuelles et remplacent l'ordre limité à Tactical, la proposition initiale de huit adjectifs, les anciennes limites à l'exploration et le prompt de boss initial ne contenant que l'état observé.

Le travail d'exécution est une première politique fondée sur l'utilité, pas l'achèvement de tous les scénarios d'acceptation. Ses limites sont consignées aux sections 13 et 16. La [transmission d'implémentation des règles](game-combat-rulesets-implementation.md) traite séparément les frappes supplémentaires de vitesse Traditional, l'ordre des tours/mouvements, les réserves et les futurs profils propres aux éditions.

## 1. Demandes du mainteneur

- Les ennemis ordinaires utilisent un comportement contrôlé par l'Engine, décrit par **un adjectif et un rôle de combat**, comme Reckless Bruiser ou Cautious Spellcaster.
- **Seuls les boss reçoivent un contrôle GM tour par tour.** L'Engine continue de déterminer les actions légales et leurs résultats. Contrôler un boss signifie choisir pendant le combat, pas seulement générer un script avant celui-ci.
- L'attribution de l'adjectif pondère compétence/niveau, rôle et personnalité connue, avec une part aléatoire. Les ennemis expérimentés doivent plus souvent avoir des habitudes adaptées au rôle, sans rendre tous les vétérans identiques.
- **Toute Beast et Monstrosity est Mindless.** Elle poursuit le membre du groupe le plus proche par le chemin légal le plus court, sans tenir compte de sa santé ni des avantages/inconvénients du terrain. N'exempte pas silencieusement les boss ou créatures nommées.
- Privilégie plaisir stratégique, plausibilité et rejouabilité, notamment pour le jeu tactique et les futurs systèmes proches du jeu de rôle sur table. Cela n'exige pas d'implémenter 5e ou V20 dans cette modification d'IA.
- Préserve une conception détaillée pour la suite. Le périmètre d'exploration original a été étendu à l'IA ordinaire et au contrôle des compagnons ; voir l'actualisation ci-dessus.

Les orientations liées figurent dans la [feuille de route du combat](game-combat-roadmap.md) : règles du champ de bataille, participation du groupe/Summoning et profils de règles sur table sont indépendants. La tactique ennemie doit l'être aussi. Summoning reste une priorité ultérieure.

### Valeurs recommandées encore soumises à acceptation de conception

1. Commence avec huit adjectifs : Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly.
2. Affiche adjectif et rôle dans l'inspection ennemie avec une courte explication. Garde probabilités, poids d'utilité et analyse brute de personnalité hors de l'interface normale.
3. Interprète le chemin Mindless le plus court comme **le moins de pas spatiaux légaux**, pas le coût de terrain minimal. Il peut traverser une forêt par un chemin plus court même si un détour ouvert serait plus rapide. Le mouvement paie toujours le coût réel du terrain.
4. Un boss Beast/Monstrosity reste Mindless. Le GM ne choisit que des actions respectant sa cible et sa poursuite obligatoires.
5. Tire et enregistre les profils ordinaires une seule fois. Un PNJ nommé récurrent conserve son tempérament établi ; monter de niveau ne tire pas à nouveau sa personnalité au hasard.
6. Implémente l'IA ordinaire dans Tactical et Classic ensemble selon le périmètre révisé. Le système complet demandé comprend de vrais tours de boss GM ; un jalon limité à l'Engine ne doit pas être présenté comme la totalité.

## 2. Audit des sources avant la refonte

La seconde hypothèse du mainteneur est la plus proche : chaque moteur de combat actif possède une politique automatique commune. Le GM rédige la rencontre, mais ne choisit pas les tours individuels dans les interfaces de combat actives de Game Mode.

| Domaine                    | Classic Game Mode                                                         | Tactical Game Mode                                                            |
| ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Ordre des tours              | Jets d'initiative plus vitesse ; tous les combattants participent                   | Par initiative dans les nouvelles parties (une unité à la fois, un ordre tiré une seule fois, combat C6c) ; par camp dans les anciennes (phase du joueur, puis ennemis par vitesse) |
| Politique ennemie            | Heuristique commune de capacités, sinon cible adverse vivante aléatoire           | Politique commune : soin prioritaire, attaque évaluée, puis approche                        |
| Différences de classe       | Aucune politique de décision par classe                                         | Six classes changent portée, mouvement et critique ; toutes partagent la politique |
| Personnalité/compétence | Aucun modèle tactique de personnalité ou d'entraînement enregistré                          | Aucun modèle tactique de personnalité ou d'entraînement enregistré                              |
| Décisions des boss          | Politique ordinaire et mécaniques scriptées prises en charge                   | Même politique ordinaire ; le marqueur boss influe sur placement/interface                         |
| GM à chaque tour     | Absent du résolveur actif                                                | Absent du résolveur actif                                                    |
| Reproductibilité         | Décisions/jets aléatoires sans graine                                      | Graine et compteur d'actions gouvernent décisions et jets                   |
| Persistance             | Le client restaure l'instantané ; état de round/animation incomplet | Le client conserve l'instantané Tactical complet dans les métadonnées du chat               |

Il existe aussi un système distinct de rencontre en fenêtre modale, avec route `/encounter/action` pilotée par modèle et types d'actions de combat. Le `EncounterModal` général du chat l'utilise via `useEncounter`, pas la `GameCombatUI` actuelle de Game Mode. Ce modèle peut renvoyer un état réécrit ; ne le réutilise pas tel quel pour le contrôleur de boss validé par l'Engine proposé ici. Suis les vrais appelants avant de réutiliser ou supprimer quoi que ce soit.

La manoeuvre explicite **Special** (action spéciale) de Classic demande aussi au GM d'arbitrer une action narrative et autorise les balises d'état/élément prises en charge. Elle ne résout pas un round ordinaire et ne choisit pas les tours ennemis habituels. Préserve cette distinction dans les prompts GM ; le contrôle des tours réservé aux boss n'interdit ni génération de rencontre, ni arbitrage narratif, ni narration après combat.

### Politique Classic

Dans `combat.service.ts`, `resolveCombatRound` appelle `chooseAutoSkill` pour les alliés et ennemis automatiques :

1. Une capacité est utilisable si les MP suffisent et si son délai de récupération passe un contrôle par modulo du round.
2. Soigne l'allié éligible le plus blessé s'il a au plus 75 % de HP et qu'une capacité de soin est disponible.
3. Sinon, avec 45 % de probabilité, choisis une capacité non soignante aléatoire et une cible ennemie aléatoire.
4. Sinon, attaque un adversaire aléatoire.

Les ennemis ne fournissent qu'eux-mêmes comme liste d'alliés, donc cette politique ne soigne pas d'autres ennemis actuellement. Les capacités non soignantes comprennent améliorations et attaques/affaiblissements ; le remplacement doit valider le camp visé par chaque capacité plutôt que garder ce regroupement. En pratique, l'omission de MP des ennemis générés décrite ci-dessous empêche leurs capacités payantes, ne laissant que des attaques de base à cible aléatoire. Le premier combattant vivant du camp joueur reçoit sa commande ; les autres alliés agissent automatiquement. Changer les tactiques ennemies ne doit pas modifier silencieusement contrôle des compagnons ou identité du joueur.

Les mécaniques générées sont traitées séparément après les actions normales. Seuls `round_interval` et `hp_threshold` s'exécutent actuellement ; les déclencheurs acceptés `on_hit`, `on_attack` et `passive` ne s'exécutent pas. Les mécaniques de seuil HP se répètent aux rounds ultérieurs remplissant la condition, et `damage_one` choisit la première cible adverse. Ce n'est pas un GM choisissant en direct un coup de boss. Distingue explicitement effets uniques et récurrents avant adaptation.

Classic résout aussi les capacités non soignantes par un circuit orienté dégâts ; améliorations/affaiblissements ne sont pas équivalents aux opérations de soutien Tactical, même si un état nommé peut accompagner un coup. Un vrai soutien/contrôle et des délais par utilisation sont nécessaires avant d'annoncer ces comportements Classic. Défendre/attendre automatiquement exige aussi une prise en charge du résolveur ; la défense actuelle appartient à la position d'initiative du joueur contrôlé, donc les ennemis plus rapides agissent avant son application. La difficulté module actuellement les dégâts d'attaque des deux camps via le résolveur commun, pas la qualité des décisions. Conserve ou modifie cela séparément du tempérament.

Une autre incohérence existante de contrôle mérite sa propre preuve : le serveur transfère les commandes au premier allié vivant si la position zéro est KO, tandis que l'indice du joueur actif reste zéro dans l'interface. Une capacité indisponible peut alors devenir une attaque de base. Consigne/corrige cela indépendamment du tempérament ennemi.

### Politique Tactical

`packages/shared/src/features/tactical-combat/ai.ts` effectue actuellement ceci :

1. Essaie la première capacité de soin prête sur l'allié ayant la plus faible fraction de HP à deux cases ou moins, s'il a au plus 60 % de HP. Ne se déplace pas d'abord à portée de soin.
2. Évalue les destinations accessibles face aux adversaires vivants, avec attaques de base et capacités offensives prêtes.
3. Note les attaques par `1000 * likelyKill + expectedDamage - 0.75 * counterRisk`. likelyKill signifie que les dégâts prévus atteignent les HP actuels avec au moins 50 % de chance de toucher ; ce n'est pas une mort garantie.
4. Remplace parfois la meilleure attaque non létale par une autre attaque légale aléatoire : 60 % casual, 30 % normal, 10 % hard, 0 % brutal. L'acceptation du soin vaut respectivement 50 %, 80 %, 100 %, 100 %.
5. Sans attaque disponible, approche l'adversaire le plus proche selon Manhattan via la case accessible la plus proche selon Manhattan. Ce n'est pas une poursuite par plus court chemin sur tout le plateau ; des obstacles peuvent bloquer sa progression.

Le terrain influe sur mouvement et prévisions de dégâts/touche, mais la politique n'évalue pas globalement l'exposition de l'unité lors de la prochaine phase joueur. Elle ne choisit pas délibérément améliorations, affaiblissements, défense ou objets. La portée des capacités est simplifiée. Les descriptions générées d'AoE ne constituent pas un résolveur spatial complet des effets de zone.

Les classes sont Fighter, Knight, Rogue, Archer, Mage et Healer. La dérivation utilise un indice explicite, soins, mots-clés des noms/capacités, attaques élémentaires et heuristiques de caractéristiques. Un libellé de rôle ne crée pas de capacités.

### Lacunes fondamentales qui compromettraient un système de personnalités

Ces constats viennent de l'inspection du code, pas d'une reproduction exécutée dans le navigateur :

| Lacune                                                     | Preuve et conséquence                                                                                                                                                    | Prochaine étape ciblée                                                                                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Les ennemis générés n'ont pas de MP                            | `generatedEnemyToCombatant` omet MP/maxMP ; les capacités générées autres que l'attaque de base ont un coût en MP positif. Les deux moteurs traitent les MP absents comme zéro. Ces ennemis ne peuvent pas utiliser ces capacités. | Ajoute une régression passant par l'hydratation réelle du blueprint ; conserve les ressources explicites ou applique une règle documentée pour celles des ennemis générés. N'accorde pas de sorts illimités. |
| Le niveau est déduit des HP                               | Le niveau d'un ennemi généré vient normalement de maxHP/20 arrondi. Une créature résistante n'a pas forcément une formation tactique.                                                       | Ajoute un indice de compétence borné ; n'utilise le niveau que comme repli déclaré jusqu'à ce que les profils de règles fournissent des données de formation adaptées.                                                  |
| L'identité de boss est heuristique                              | Tactical désigne l'ennemi le plus fort dans les groupes d'au moins deux selon maxHP + level\*10 + attack. Cette heuristique ne désigne jamais un ennemi seul.                               | Ajoute une identité de boss explicite par ennemi. Le palier musical de la rencontre ne suffit pas à déterminer quelle unité reçoit les tours du GM.                                                               |
| Les mécaniques des boss générés n'atteignent pas Tactical          | Classic reçoit les propriétés des mécaniques ; Tactical ne consomme pas la liste générée.                                                                                       | Associe les mécaniques prises en charge à des opérations tactiques validées, avec état de phase/déclencheur sauvegardé. Signale les mécaniques non prises en charge au lieu de raconter qu'elles ont été exécutées.          |
| Le type de créature et la personnalité ne sont pas des contrats d'exécution | La description de l'ennemi existe dans le blueprint mais disparaît pendant l'hydratation ; Beast/Monstrosity ne sont pas des catégories typées.                                                | Transporte la catégorie explicite et les entrées d'attribution bornées à travers toutes les conversions et frontières de persistance.                                                                 |
| La ligne de vue et la couverture tactiques sont communes (combat C6)        | Un mur ou une montagne bloque la ligne de vue dans les combats natifs comme dans ceux des ensembles de règles, et la couverture est graduée sur le même test (demi, trois quarts) : aperçus, actions, contre-attaques, zones, réactions, indications de menace et IA utilisent `hasLineOfSight` et `coverTier`. | Garde un seul test de ligne de vue et un seul test de couverture pour tous les appelants.                                                                                                                 |
| Les prévisions des candidats de l'IA lisent la case candidate        | Les deux IA prévoient une attaque, et la contre-attaque qu'elle risque, depuis la case d'où elles frapperaient : la couverture (combat C6a-2) est donc prise en compte telle qu'elle comptera au jet. | Garde prévisions et résolution sur le même `hitChance`.                                                                                                                      |

Une autre lacune de conversion touche les deux moteurs : le type d'attaque générée est déduit de mots-clés anglais dans son nom/sa description, alors que le texte de rencontre peut être généré dans d'autres langues. Le drapeau `AoE`/`both` du blueprint ne survit pas non plus comme véritable comportement multicible. Des champs de capacités explicites et validés doivent alimenter la future dérivation du rôle ; les noms traduits ne doivent pas décider si un sort soigne ou attaque.

N'intègre pas une réécriture complète du combat à ces prérequis. Ajoute les preuves minimales, corrige le flux concerné et réutilise les helpers existants de déplacement, prévision, disponibilité des capacités et résolution des actions.

## 3. Séparer capacités, tempérament et contrôle

Pour chaque ennemi, il faut répondre à des questions distinctes :

| Dimension           | Signification                                          | Exemple                                                                |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Catégorie de créature   | Applique les règles de type obligatoires                      | Beast impose Mindless                                                  |
| Rôle                | Ce que ses capacités réelles lui permettent de bien faire           | Supporter dispose de soins/améliorations utilisables                            |
| Tempérament         | Ce qu'il privilégie parmi les actions légales | Cautious privilégie l'évitement du danger                                  |
| Compétence         | La régularité avec laquelle il exécute ses habitudes          | Un Reckless Bruiser vétéran prend toujours des risques, mais gaspille moins d'actions |
| Contrôleur          | Qui choisit l'action                           | L'Engine pour les ennemis ordinaires ; le GM pour les boss explicites                    |
| Objectif de rencontre | Ce que le camp essaie d'accomplir               | Vaincre le groupe maintenant ; protéger/fuir/capturer plus tard                         |

Utilise d'abord un seul adjectif principal. N'introduis pas d'empilement arbitraire de traits, d'éditeur de vecteur de personnalité, de dépendances d'arbres de comportement ni de framework général de planification. Une petite table de profils autour de candidats légaux partagés suffit.

### Des rôles fondés sur les capacités

Conserve les classes tactiques existantes comme presets de géométrie/caractéristiques. Une petite correspondance avec des rôles de politique peut les affiner lorsque les capacités le justifient :

| Rôle proposé | Indices de capacité                                | Tâche habituelle                                          | Adjectifs probables                    |
| ------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Bruiser       | Fortes attaques rapprochées                         | Se rapprocher et échanger des dégâts                               | Reckless, Disciplined, Opportunistic |
| Bulwark       | Capacités de mêlée résistantes                                  | Tenir une position utile près d'alliés vulnérables        | Protective, Disciplined, Cautious    |
| Skirmisher    | Mobilité et dégâts rapprochés utiles            | Choisir des engagements favorables                           | Opportunistic, Cautious, Reckless    |
| Marksman      | Attaques à distance soutenues, éventuellement avec portée minimale | Maintenir une distance de tir utile                    | Cautious, Disciplined, Opportunistic |
| Spellcaster   | Magie offensive utilisable et réserve de ressources associée       | Exercer une pression à distance sans gaspiller les capacités limitées | Cautious, Disciplined, Opportunistic |
| Controller    | Affaiblissements/effets de contrôle utilisables                     | Affaiblir une menace pertinente                             | Disciplined, Opportunistic, Cautious |
| Supporter     | Soins/améliorations utilisables                            | Maintenir l'efficacité du groupe                             | Supportive, Protective, Cautious     |

Ce sont des a priori, pas des interdictions. Un Cowardly Fighter ou un Reckless Spellcaster doit rester possible. Un Cleric doté d'armure et de capacités de mêlée peut être Bulwark ; un soigneur peut préférer l'arrière. Ne déduis pas le tempérament d'un simple stéréotype de classe. Un épuisement temporaire des MP change les actions légales, pas le rôle ni l'adjectif sauvegardés. N'attribue pas Supportive à des capacités qui n'ont jamais permis le soutien.

## 4. Catalogue des adjectifs

### Les huit premiers

| Adjectif         | Préférence de cible                                                             | Placement et risque                                                                                    | Capacités/ressources                                                                                      | Ce que le joueur peut apprendre                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Mindless**      | Membre vivant et accessible du groupe le plus proche, selon la règle de la section 6               | Plus court trajet spatial légal ; ignore l'utilité du terrain, l'exposition et la formation                           | Attaque légale simple sur cette cible ; ni triage des soins, ni tirs concentrés, ni optimisation des ressources                   | L'attirer par la proximité, le terrain et les passages étroits             |
| **Reckless**      | Dégâts immédiats et pression à portée ; pas automatiquement la victime la plus faible | Se rapproche agressivement, tolère les contre-attaques et les destinations exposées                                  | Dépense volontiers les attaques puissantes disponibles ; s'arrête rarement pour défendre                                             | Punir les avancées excessives et l'attirer dans des échanges défavorables            |
| **Cautious**      | Cibles qu'il peut menacer en limitant les dégâts en retour                          | Privilégie les destinations sûres, la portée utile et le terrain défensif                                            | Préserve les ressources rares lorsqu'une attaque de base est presque aussi utile ; soigne/défend si nécessaire                | Réduire son espace sûr ; exploiter son hésitation à s'engager   |
| **Opportunistic** | Cibles blessées, exposées ou déjà compromises ; chances fiables d'achever   | Accepte un certain risque pour une ouverture concrète                                                                | Valorise une capacité lorsqu'elle crée ou exploite cette ouverture                                                      | Protéger les alliés vulnérables et empêcher les attaques finales faciles   |
| **Protective**    | Menaces contre un allié vulnérable désigné ou un groupe proche soutenu          | Reste à distance de soutien ; occupe des cases de blocage utiles lorsque c'est légal                                    | Utilise défense/soutien pour préserver le protégé ; attaque lorsque la protection n'est pas urgente              | Séparer le groupe ou approcher de plusieurs directions   |
| **Supportive**    | Santé des alliés et améliorations utiles avant dégâts personnels                           | Se déplace à portée légale de soutien en évitant l'exposition inutile                                        | Soigne des HP manquants significatifs, évite les soins excédentaires inutiles et améliorations en double, attaque lorsque le soutien apporte peu | Faire pression sur le soutien ou le séparer de ses bénéficiaires |
| **Disciplined**   | Cibles efficaces pour son rôle, occasions raisonnables d'achever                      | Équilibre dégâts, sécurité, placement et ressources ; engagement modéré envers une cible                            | Bases fiables du rôle sans spécialisation dans un extrême                                               | Perturber son rôle et imposer des choix défavorables              |
| **Cowardly**      | Cibles accessibles sans danger qui n'invitent pas à riposter                       | La préservation de soi augmente fortement avec les blessures ou l'infériorité numérique locale ; recule vers un espace allié plus sûr | Se soigne/défend plus volontiers et évite les engagements coûteux                                                | Couper la retraite sûre et maintenir une pression à distance    |

Protective ne redirige pas magiquement les dégâts, ne provoque pas, n'intercepte pas les attaques et n'obtient pas de réactions. L'occupation actuelle permet le blocage positionnel ; une protection plus forte exige de vraies capacités. Cowardly peut reculer et défendre, mais l'action `flee` actuelle de Tactical termine tout le combat. **N'utilise jamais la fuite globale comme échappatoire d'un seul ennemi.** La retraite/reddition par unité exige de nouvelles règles explicites.

Cautious et Cowardly doivent produire des résultats différents : un Cautious Marksman en bonne santé choisit une bonne position de tir ; un Cowardly Marksman blessé peut renoncer à un bon tir pour se préserver. Protective et Supportive diffèrent de même : l'un garde une personne ou une position, l'autre maximise les actions de soutien utiles.

### Extensions possibles, seulement avec comportement distinct et preuves

| Adjectif   | Comportement distinct                                                                                         | Nécessaire avant publication                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Vengeful    | S'engage contre le dernier attaquant ou le meurtrier observé d'un allié même si une autre cible est légèrement meilleure | Petite mémoire de combat persistée ; changement légal de cible lorsque celle-ci est indisponible      |
| Patient     | Tient une position précieuse et laisse les ennemis entrer à portée favorable                                          | Règles bornées de maintien/engagement et garde de progression pour éviter l'attente infinie           |
| Predatory   | Traque les cibles isolées et s'engage lorsqu'une ouverture apparaît                                              | Mesure d'isolement ; ne doit pas remplacer Mindless obligatoire pour Beast/Monstrosity           |
| Fanatical   | Sacrifie sa sécurité pour un rituel, chef ou objectif explicite                                               | Objectifs de rencontre avec progression et conditions d'échec visibles                     |
| Methodical  | Construit une séquence prise en charge d'affaiblissement/attaque plutôt que de poursuivre les dégâts immédiats                            | Dépendances de combo explicites, mémoire bornée et distinction claire avec Disciplined |
| Coordinated | Prend en compte les intentions alliées et réduit les attaques/soutiens redondants                                      | Intention d'équipe bornée, sans coordination parfaite omnisciente                          |
| Territorial | Défend un lieu et cesse de poursuivre au-delà d'une limite                                                    | Territoire/objectif sauvegardé et désengagement lisible                       |
| Deceptive   | Utilise une vraie capacité de feinte, leurre ou dissimulation pour tromper                                              | Mécaniques de tromperie/perception prises en charge ; la narration seule ne crée pas d'effet     |

Évite de lancer des synonymes dont les scores sont identiques. Cruel revient surtout à Opportunistic sauf si les règles offrent un objectif distinct. Réserve plutôt Strategic à une vraie planification bornée, au lieu d'une étiquette signifiant meilleur en tout. Courage et intelligence ne sont pas nécessairement les extrémités opposées d'une seule échelle.

## 5. Attribuer les profils : rôle, expérience, personnalité, puis variété avec graine

### Priorité

1. Valide la catégorie explicite de créature. Beast ou Monstrosity impose Mindless, indépendamment du niveau, de la personnalité, de la difficulté ou du statut de boss. Les indices d'adjectif contradictoires générés par le modèle sont écartés avec la provenance de l'attribution. Un profil résolu explicitement rédigé/importé qui entre en conflit est rejeté avec une erreur exploitable ; ne réécris pas silencieusement un choix rédigé et sauvegardé.
2. Conserve un profil valide déjà résolu pour une rencontre reprise. Conserve le tempérament établi d'un PNJ récurrent connu lorsqu'une identité stable existe.
3. Respecte un profil rédigé pour les autres créatures s'il est compatible avec leurs capacités. Une entrée explicite non prise en charge ou contradictoire reçoit une erreur de validation claire ; une entrée absente reçoit les valeurs par défaut.
4. Résous le rôle à partir des capacités réelles, avec un indice de rôle validé pour les ensembles ambigus.
5. Calcule la compétence, les a priori du rôle et les ajustements de personnalité bornés.
6. Tire un profil par choix pondéré avec graine ; sauvegarde le résultat et la version de politique.

Mindless est initialement exclu de l'attribution aléatoire ordinaire. De futurs comportements rédigés de morts-vivants/constructions peuvent l'utiliser, mais sa règle obligatoire Beast/Monstrosity doit rester appliquée. Pour les anciens ennemis de catégorie inconnue, utilise une valeur explicite `unknown` ; ne suppose pas qu'un nom contenant "beast" constitue une déclaration taxonomique.

### La compétence n'est ni les HP, ni la difficulté, ni la valeur morale

Privilégie un palier de formation fourni par le profil de règles ou des données fiables de fiche de PNJ. Ensuite, utilise un indice explicite validé de rencontre. Ne te rabats sur le niveau qu'en l'absence des deux, en enregistrant cette source. Le niveau actuel déduit des HP est un repli faible qui ne doit pas devenir silencieusement une mesure d'intelligence faisant autorité.

Pour une première implémentation neutre vis-à-vis des règles, les paliers novice/formé/vétéran/maître pourraient correspondre à la compétence `c = 0, 0.35, 0.7, 1`. Un repli provisoire concret sur le niveau de l'Engine serait : niveau 1–2 novice, 3–7 formé, 8–14 vétéran, 15+ maître. C'est une courbe de conception de jeu réglable, pas une règle de jeu de rôle sur table ; marque sa source comme `level-fallback`, surtout tant que les niveaux sont déduits des HP. Lie cette correspondance à la version d'attribution et remplace-la par celle des profils de règles lorsqu'ils existent. N'assimile pas le facteur de puissance de 5e au niveau de personnage et n'impose pas une seule échelle de niveaux aux jeux de type V20.

L'expérience influe **à la fois** sur la probabilité d'un tempérament adapté au rôle lors de la première attribution et sur la régularité avec laquelle l'unité le suit. Pour l'IA locale ordinaire, elle ne révèle ni capacités cachées du joueur ni commandes en attente. Les boss du GM bénéficient de la connaissance plus large des fiches du groupe décrite à la section 16 ; aucun contrôleur ne voit les futurs jets aléatoires ni ne connaît un choix du joueur non confirmé. L'hypothèse de survie est un biais utile de construction du monde, pas une loi factuelle selon laquelle tous les sorciers vétérans sont prudents.

### Un modèle de pondération concret

Utilise une petite table rôle/adjectif et une formule bornée. Exemples de valeurs initiales, à tester en jeu :

```text
w[a] = baseRoleWeight[role,a] * exp(1.2*c*roleAffinity[role,a] + 1.5*q*personalityMatch[a])
P[a] = 0.94 * w[a]/sum(w) + 0.06/N
```

- `c` : compétence, 0..1.
- `roleAffinity` : adéquation rédigée de -1..1 ; certaines personnalités conviennent à plusieurs rôles.
- `personalityMatch` : indices bornés de -1..1, pas des nombres sans restriction fournis par le modèle.
- `q` : confiance dans la personnalité connue, 0..1 ; zéro lorsqu'elle est inconnue.
- `N` : nombre d'adjectifs compatibles ; retire les profils incompatibles avant normalisation. S'il n'en reste aucun, utilise un repli Disciplined/de base validé et enregistre le problème d'entrée.
- Le mélange de 6 % laisse une petite chance à chaque profil inhabituel compatible. Il n'affaiblit jamais les règles de type strictes.

Exemple d'un **lanceur de sorts polyvalent avec une capacité de soutien**, sans indice de personnalité :

| Adjectif     | Poids de base | Affinité du rôle | Probabilité novice | Probabilité maître |
| ------------- | ----------- | ------------- | ------------------ | ------------------ |
| Cautious      | 4           | 1             | 23,0 %              | 35,8 %              |
| Disciplined   | 4           | 1             | 23,0 %              | 35,8 %              |
| Opportunistic | 3           | 0,5           | 17,4 %              | 15,2 %              |
| Supportive    | 1           | 0             | 6,4 %               | 3,5 %               |
| Protective    | 1           | 0             | 6,4 %               | 3,5 %               |
| Reckless      | 2           | -1            | 11,9 %              | 2,4 %               |
| Cowardly      | 2           | -0,5          | 11,9 %              | 3,7 %               |

Les arrondis peuvent empêcher un total d'exactement 100 %. Une personnalité connue comme téméraire augmente le poids de Reckless même à forte compétence. L'adjectif existant d'un PNJ nommé ne doit pas être tiré à nouveau au hasard à chaque changement de niveau. Ces nombres illustrent la tendance souhaitée, pas l'équilibrage final.

### Extraire la personnalité sans appel au modèle à chaque tour ordinaire

Utilise l'appel existant de génération de rencontre pour interpréter la personnalité connue du personnage/PNJ en trois indices maximum issus d'une énumération fermée, chacun avec confiance faible/moyenne/forte et référence source bornée. Exemples : loyal, amateur de risque, soucieux de sa survie, compatissant, patient. L'Engine transforme les indices en poids numériques. Ne demande pas au modèle d'inventer des probabilités arbitraires ni du code d'exécution.

Utilise la personnalité réellement connue lorsqu'elle existe. Une apparence comme "un sorcier balafré" ne prouve pas la prudence. La négation compte : "pas lâche" ne doit pas favoriser Cowardly. Les descriptions multilingues et contradictoires nécessitent des fixtures de régression. Si l'extraction est absente, mal formée ou non prise en charge, n'ajuste pas la personnalité ; rôle, compétence et RNG suffisent. Ne présente pas une simple correspondance de mots-clés comme une compréhension sémantique.

Persiste les indices acceptés et leur provenance nécessaires pour expliquer l'attribution, pas les transcriptions du raisonnement du modèle. L'identité stable d'un PNJ doit venir des références d'entités existantes, pas uniquement des noms affichés. Les monstres anonymes répétés peuvent recevoir de nouveaux profils de rencontre ; les personnages nommés récurrents ont besoin d'un profil lié à l'identité avant de promettre une cohérence entre sessions.

### Limites de l'aléatoire

- Utilise une graine d'attribution IA dérivée de la graine de rencontre, d'un ID d'ennemi stable et de la version d'attribution. Sépare son domaine de ceux du terrain et des jets de combat.
- Ne consomme pas le RNG de combat pour simplement énumérer/noter des candidats ou afficher des aperçus.
- Sauvegarde le profil résolu. Actualisation, nouvelle tentative, import, retour à un point de contrôle et redémarrage du même combat ne doivent pas tirer accidentellement un nouveau tempérament.
- De nouvelles rencontres/graines peuvent faire varier composition et tempéraments. Un nouveau tirage explicite doit créer une révision de rencontre, pas modifier secrètement le combat courant.
- Tactical partage actuellement un curseur avec graine entre décisions et résultats. Changer son usage constitue un changement de comportement versionné ; préserve la politique des anciens combats en cours ou fournis une migration explicite testée.
- Le résolveur de Classic sans graine exige un adaptateur RNG/persistance distinct avant de prétendre à une reproduction exacte.

## 6. Mindless : un contrat de poursuite exact

C'est une règle demandée pour Beast/Monstrosity dans ce projet, pas une affirmation selon laquelle ces étiquettes impliquent ce comportement dans les règles officielles de jeu de rôle sur table ou chez les animaux réels.

### Cible et trajet

1. Considère les membres vivants du groupe et les positions légales depuis lesquelles l'attaque simple désignée de la créature peut atteindre chacun. La case occupée par la cible n'est pas une destination légale.
2. Pour la marche, cherche sur le plateau les trajets légaux les plus courts en **pas de grille**, en ignorant le surcoût du terrain pour les classer. Murs, eau et montagnes bloquent toujours un marcheur ordinaire. Les règles actuelles permettent de traverser les alliés ; terminer sur une position occupée reste interdit.
3. Privilégie le membre du groupe nécessitant le moins de pas jusqu'à une position d'attaque légale. Entre objectifs d'attaque également accessibles, privilégie la cible spatialement la plus proche, puis l'ID stable de cible et l'ordre des coordonnées. Ne départage jamais selon HP, défense, esquive, classe ou dégâts prévus.
4. Suis le trajet sélectionné aussi loin que le budget réel de déplacement du tour le permet. La forêt coûte toujours deux points de mouvement. Choisis le point d'arrêt légal inoccupé le plus éloigné sur ce trajet, pas un raccourci moins coûteux hors du trajet choisi pour son avantage tactique.
5. Si la cible est à portée d'attaque légale après déplacement, utilise l'attaque simple désignée contre elle. Sinon, attends après déplacement. L'attaque de base est la valeur par défaut ; une attaque signature innée validée peut être désignée à la création. Ne cherche pas la meilleure capacité de dégâts et ne change pas de cible pour un groupe en AoE.
6. Recalcule à l'activation suivante à partir du plateau mis à jour. Si un trajet est bloqué, choisis la prochaine cible accessible. Si aucune ne l'est, attends ; n'attaque jamais via un raccourci de déplacement illégal et ne boucle jamais indéfiniment.

Le but est un poursuivant délibérément peu sophistiqué, pas un échec de recherche de chemin. Un mur en U peut exiger de s'éloigner temporairement selon Manhattan. La recherche sur tout le plateau doit trouver ce trajet.

**Exemple de terrain :** le trajet A comporte trois pas légaux en forêt ; le trajet B en comporte cinq en plaine. Mindless choisit A même si son coût en points de mouvement est supérieur. Il reçoit toujours la défense/l'esquive de forêt s'il s'y arrête et paie son coût de déplacement. Un ennemi Cautious peut préférer délibérément une position défensive en forêt ; un ennemi Mindless reçoit le même bonus fortuitement.

Pour vol et téléportation, utilise leur véritable contrat de déplacement. Le vol traverse les sols bloqués et cases occupées et peut stationner sur un terrain autrement impraticable ; la téléportation traverse les obstacles intermédiaires mais exige un terrain d'arrivée légal. Aucun mode ne peut terminer sur une case occupée. Selon les règles actuelles de grille plate, leur mesure de distance est Manhattan, pas "un saut de téléportation vers n'importe où". Sur plusieurs tours, une poursuite par téléportation nécessite un trajet passant par des positions d'arrivée légales accessibles ; ne choisis jamais une cible apparemment proche au-delà d'un vide plus large que tous les sauts légaux. La défense/l'esquive du terrain reste effective pour chaque mode de déplacement.

N'implémente pas pour Mindless un second jeu de permissions de traversée subtilement différent. Factorise/réutilise les prédicats de déplacement existants. La préférence de trajet peut ignorer le coût, tandis que l'exécution continue d'appliquer légalité et coûts habituels.

### Exclusions strictes et priorité des boss

Mindless n'inspecte pas les HP des cibles pour choisir ses victimes ; n'optimise pas les chances de tuer ; ne choisit pas le terrain pour sa couverture ; ne coordonne pas des tirs concentrés ; ne soigne pas les alliés blessés ; ne recule pas par peur ; et ne change pas de cible parce qu'une autre classe a plus de valeur. Difficulté et compétence ne peuvent pas rétablir ces comportements.

Pour un boss Mindless, limite le menu de candidats du GM à cette cible et à la poursuite imposée, avec des options légales de signature/phase qui ne contournent pas ces contraintes. S'il ne reste qu'une action, exécute-la sans appel inutile au modèle. Une future exception pour des boss Beast/Monstrosity intelligents serait une modification délibérée des règles du produit nécessitant l'accord du mainteneur, pas une commodité d'implémentation.

Classic n'a pas de distance spatiale. Il ne peut pas implémenter fidèlement "le plus proche par le plus court chemin". Une adaptation proposée est un ordre d'engagement de rencontre sauvegardé et doté d'une graine, sans pondération HP/terrain, ciblant la première entrée vivante. **L'implémentation non spatiale révisée utilise cette abstraction** et doit être présentée ainsi ; elle ne satisfait pas l'exigence spatiale exacte. Ne décris pas l'abstraction non spatiale comme une distance ; une vraie règle de cible la plus proche exigerait un futur modèle de formation/position. Ajouter plus tard une formation avant/arrière pourrait fournir une telle règle ; l'ordre du tableau ne doit pas devenir silencieusement une distance. La règle de trajet de Tactical reste le comportement normatif de Mindless dans cette proposition.

## 7. Décisions des ennemis ordinaires

### Réutiliser le résolveur ; varier les priorités

Génère d'abord les actions candidates légales, puis note-les avec les poids de rôle et d'adjectif. Utilise les helpers existants de déplacement, prévision et disponibilité ; ajoute la fonction minimale de légalité réutilisable nécessaire à l'IA de l'Engine et aux unités contrôlées par le GM. N'appelle pas `performUnitAction`, qui ne fait que muter l'état, avec une entrée du modèle non validée.

Les candidats doivent inclure :

- Attaque de base et capacités d'attaque utilisables, avec destinations légales pour se déplacer puis agir.
- Soins, améliorations et affaiblissements sur le bon camp, y compris déplacement à portée de soutien.
- Défense, attente et déplacement utile lorsqu'aucune attaque/action de soutien utile n'est disponible.

N'inclus que les mécaniques réellement prises en charge par le résolveur. Les objets ennemis exigent d'abord un véritable inventaire et suivi de consommation. Le calculateur de score ne peut inventer géométrie d'AoE, invocations, provocations, nouvelles réactions, attaques d'opportunité, couverture ou fuite. Tactical dispose déjà de contre-attaques et défense/attente ; Classic a besoin d'une défense/attente automatique explicite et d'opérations correctes d'amélioration/affaiblissement avant d'offrir des profils équivalents. C'est un travail de résolveur, pas un simple changement de poids.

Utilise des facteurs normalisés pour dégâts attendus, probabilité d'achever, soins/soutien utiles, risque immédiat de contre-attaque, exposition à la phase suivante, progression vers la portée d'engagement du rôle et coût en ressources. Multiplie-les par une petite table de profils. Un énorme bonus universel d'élimination effacerait les différences de tempérament ; remplace-le donc, pour la nouvelle politique, par une valeur d'achèvement bornée dépendant du profil.

Il s'agit d'une petite approche de notation d'utilité : comparer les actions légales sur des échelles cohérentes et varier les priorités selon la personnalité. L'approche générale et l'inertie décisionnelle sont décrites dans [An Introduction to Utility Theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf) de David "Rez" Graham. Les profils concrets, la formule, les valeurs par défaut et le plan d'intégration présentés ici sont des recommandations propres à Marinara.

### Garde-fous pratiques

- Calcule les prévisions depuis la destination hypothétique, avec son terrain, sans modifier l'état réel ni consommer de RNG. La probabilité de contre-attaque doit correspondre aux véritables règles de touche/survie/contre-attaque ; ne qualifie pas un tir à 50 % d'élimination certaine.
- Estime le danger de la phase suivante avec les positions actuellement observables et les attaques connues. Ni lecture du futur RNG ni d'une commande joueur en attente. Garde une estimation de menace bornée à une activation avant d'envisager une recherche plus profonde.
- Évite le spam de soins : valorise soins effectifs, urgence, coût d'opportunité et MP. Une égratignure d'un HP ne doit pas automatiquement surpasser une action importante. Évite de renouveler sans bénéfice une amélioration encore utile.
- Évite les changements incessants : conserve une cible/un protégé valide sauf si une autre option est nettement meilleure. Sauvegarde la petite quantité de mémoire effectivement utilisée. Mindless suit son contrat de cible la plus proche plutôt que cet attachement tactique.
- Évite fuite à distance/défense sans fin : en l'absence de soutien significatif ou de progression de retraite, favorise un engagement utile. Utilise une garde de stagnation bornée ; ne force pas une unité Cowardly à une charge suicidaire simplement pour raccourcir les tours.
- Ne laisse pas chaque unité choisir un plan de phase précalculé identique. Résous dans l'ordre courant, puis évalue l'unité suivante sur l'état mis à jour, pour réduire soins gaspillés et attaques contre des cibles vaincues.
- Protective choisit un allié vivant selon rôle/besoin et le garde comme protégé jusqu'à ce qu'il soit invalide ou clairement inadapté. Protéger un boss explicite peut être un indice de préparation ; ce n'est pas le comportement universel de tous les renforts.
- Utilise une faible variation avec graine entre actions presque optimales **au sein du tempérament sélectionné**. Ne réutilise pas le choix aléatoire uniforme actuel parmi toutes les attaques restantes, qui peut effacer la personnalité.

Réglage initial proposé : normalise l'utilité de politique sur une échelle fixe ; laisse les novices choisir parmi les options à moins de 0,15 du meilleur score de profil, les maîtres à moins de 0,03, avec interpolation pour les compétences intermédiaires. Ajoute un petit ajustement documenté de difficulté, borné pour qu'elle ne change jamais le tempérament. Ces seuils nécessitent simulation et tests en jeu ; ce ne sont pas des valeurs d'équilibrage prouvées.

## 8. Tours des boss contrôlés par le GM

### Identité et responsabilité

Ajoute une identité explicite de boss par unité dans les données de rencontre. Ne transforme pas automatiquement le membre le plus fort de chaque groupe en boss du GM. Paliers suggérés : ordinaire, élite, boss ; une élite reste contrôlée par l'Engine sauf désignation explicite comme boss. La classification musicale existante de toute la rencontre peut rester séparée.

Le GM choisit une action légale pour ce boss selon sa personnalité établie, l'intention de rencontre, le plateau actuel, les capacités/ressources/objets du groupe et les mécaniques prises en charge. Cette connaissance plus large permet d'anticiper, pas de connaître un choix joueur non confirmé ; la section 16 définit le contrat d'information et d'interruption. L'Engine gère portée, déplacement, ressources, jets, dégâts, états et budgets de tour. Les renforts ordinaires restent contrôlés par l'Engine, même en présence d'un boss.

Préparation recommandée : active le nouveau système tactique pour les nouvelles parties lorsque la fonctionnalité complète est publiée, et propose "GM directs bosses" (le GM dirige les boss) comme réglage clairement expliqué utilisant la connexion GM configurée. Explique que les tours de boss peuvent attendre une réponse du modèle et consommer l'usage habituel du fournisseur. Les parties existantes gardent leur comportement jusqu'à activation par l'utilisateur ; fixe ce choix au début d'une rencontre. Une option Engine seule/hors ligne utilise les mêmes profils pour les boss. N'ajoute pas une nouvelle énumération de style de combat pour ce réglage et ne change pas silencieusement de contrôleur au milieu d'un combat.

### Orchestration des tours

Garde les appels au fournisseur dans un service d'orchestration serveur, hors du moteur partagé pur :

1. Accepte une action joueur avec identité de rencontre, ID d'action et révision attendue. Valide-la contre l'état accepté du combat.
2. Avance vers la prochaine action ordinaire ou décision d'interruption dans l'ordre existant. Sépare déclaration et résolution des effets pour qu'une réaction puisse interrompre un sort en attente ; ne résous pas un round entier pour le réécrire ensuite.
3. Persiste l'activation/fenêtre en attente : ID d'unité, révision, curseur de tour, action déclenchante/en attente, version de politique et menu borné de candidats légaux.
4. Demande à la connexion GM un ID structuré de candidat ou de passer. Inclus l'instantané courant des fiches du groupe, l'intention du boss, les mécaniques prises en charge et uniquement les informations d'action adaptées à cette fenêtre, selon la section 16. Une courte narration facultative ne peut pas modifier l'état.
5. Valide réponse, révision courante, unité, appartenance au menu et légalité courante. Enregistre atomiquement la décision et applique l'action une seule fois.
6. Reprends l'action/activation suspendue à partir de l'état mis à jour, puis les participants restants. Revalide après interruption ; fais progresser chaque budget/effet exactement une fois à la frontière définie par ses règles, puis rends le contrôle au joueur.

Les ID de candidats doivent désigner des actions entièrement spécifiées générées par l'Engine, pas des coordonnées arbitraires du modèle. Un grand plateau peut produire beaucoup de candidats presque identiques. Construis un menu déterministe borné préservant les familles d'actions utiles : signatures, cibles d'attaque, soutien, défense et mouvement. Un menu d'environ 8–16 candidats variés est un objectif initial à mesurer. N'élimine pas toutes les alternatives selon un seul profil générique avant que le GM les voie.

### Latence, échecs et requêtes répétées

Le plafond initial est un appel fournisseur par fenêtre distincte de décision du boss ; aucun appel pour les renforts courants, simples clics de sélection ou fenêtres sans choix légal utile. Tours ordinaires, anticipation, actions légendaires après un tour et réactions déclenchées peuvent créer des fenêtres différentes ; borne donc la latence totale d'activation/phase avec plusieurs boss. Commence par une cible souple configurable d'environ cinq secondes et une limite stricte d'environ dix secondes par appel, puis ajuste selon les fournisseurs réellement pris en charge. Ce sont des objectifs de conception, pas des garanties de réponse mesurées. Enregistre un repli déterministe ou un passage lorsque le budget cumulé est épuisé plutôt que d'émettre des appels illimités.

Délai dépassé, fournisseur indisponible, sortie mal formée ou candidat invalide doivent utiliser la même politique de repli déterministe sauvegardée. Sauvegarde ce repli comme décision ; une réponse tardive du modèle ne doit ni la remplacer ni ajouter un tour. Garde l'interface réactive, affiche simplement que le boss réfléchit et permets l'annulation vers le repli accepté sans redémarrer toute la rencontre.

Les nouvelles tentatives du même ID d'action renvoient le résultat stocké. Un onglet actualisé rejoint la décision en attente. Des onglets concurrents ne peuvent pas faire avancer deux fois le même boss. Changer de chat ne doit pas rattacher une réponse à une autre rencontre. Le retour/la branche depuis un point de contrôle crée ou restaure une identité de combat et un historique de décisions cohérents ; ne rejoue pas les appels externes simplement parce que l'animation a redémarré.

**Prérequis de persistance :** les requêtes tactiques actuelles acceptent l'état du client et renvoient un nouvel instantané ; il n'existe aucun registre de tours serveur faisant autorité. Classic accepte aussi les combattants/mécaniques complets fournis par le client sans les comparer à un round sauvegardé faisant autorité. Un ID de candidat sauvegardé uniquement dans le navigateur ne résout ni nouvelles tentatives ni concurrence. Avant de publier des décisions de boss externes dans l'un ou l'autre mode, introduis le stockage minimal de révisions/décisions de combat détenu par le serveur, en réutilisant les files de stockage existantes lorsque c'est pertinent. Les réglages de rencontre détenus par le serveur et l'identité de boss acceptée doivent déterminer si un appel au modèle est autorisé ; un drapeau client ne doit pas activer les appels. Audite les espaces de noms turn-game/Experience avant de supposer que `game_engine_state` convient. C'est un changement borné de l'état de combat, pas une raison de reconcevoir tout le stockage du jeu.

### Mécaniques des boss et lisibilité

Ne transforme en opérations structurées que les mécaniques générées prises en charge. Donne aux transitions de phase uniques des ID stables et un état de déclenchement sauvegardé. Distingue action normale, transition de phase et action supplémentaire explicitement prise en charge ; une description évocatrice de boss n'autorise pas des dégâts gratuits.

Annonce les grandes attaques dans l'interface/le journal avant leur résolution lorsque la mécanique exige un avertissement. Le GM peut improviser l'ambiance autour des événements acceptés, mais doit raconter les résultats réels. La personnalité apprise du boss et ses capacités signatures doivent rester reconnaissables lors des reprises, même lorsque ses choix légaux varient.

Si le contrôle du GM est désactivé ou indisponible, affiche que le repli de l'Engine est utilisé au lieu de prétendre que le GM a pris cette décision. La reproductibilité avec un GM consiste à rejouer les choix et jets sauvegardés, pas à attendre de nouvelles réponses identiques du modèle avec la même graine.

## 9. Contrat de données et d'intégration

Privilégie un petit objet partagé de métadonnées transporté par le pipeline de combat existant. Exemple de forme résolue :

```ts
type ResolvedEnemyTactics = {
  version: 1;
  creatureCategory: "beast" | "monstrosity" | "other" | "unknown";
  role: EnemyRole;
  adjective: EnemyAdjective;
  proficiency: "novice" | "trained" | "veteran" | "master";
};
```

Cette catégorie minimale distingue les règles obligatoires sans prétendre implémenter toute la taxonomie des créatures de 5e. Conserve une catégorie canonique plus riche si elle est introduite ailleurs. Stocke le rang explicite de rencontre séparément pour ne pas encoder l'identité de boss dans la personnalité. Déduis le contrôleur du rang et du réglage de contrôle des boss fixé pour la rencontre ; évite deux sources de vérité modifiables indépendamment.

Les indices d'attribution du blueprint et les données résolues d'exécution sont des contrats différents. Le blueprint peut contenir des indices bornés de rôle/compétence/personnalité et une référence stable de PNJ. L'Engine les résout une seule fois dans le profil sauvegardé. Persiste la provenance d'attribution une fois avec la rencontre, et une petite mémoire de décision uniquement pour les politiques qui en ont besoin. Ne stocke pas des descriptions brutes de personnalité dupliquées sur chaque unité à chaque tour.

Classic exige en plus la propagation du profil à travers `sanitizeCombatantForRound`, le schéma de requête de round et `CombatantStats`. Son instantané actuel omet volontairement l'état du round/de l'initiative/de la file d'actions ; sauvegarder uniquement un tempérament ne permet donc pas des tours GM reprenables, de vrais temps de recharge ou une reproduction déterministe. Persiste l'état de round/activation faisant autorité nécessaire à ces fonctions ; les animations doivent consommer les résultats acceptés plutôt que provoquer une nouvelle résolution.

Trace toute la frontière :

```text
known NPC/card data + scene
  -> encounter prompt/schema and generated blueprint
  -> accepted assignment inputs and explicit boss identity
  -> generatedEnemyToCombatant / fallback encounter construction
  -> Classic request OR Tactical start request
  -> resolved units + pinned AI version + encounter identity
  -> action resolution / optional server boss decision
  -> snapshot, checkpoint/branch restore, import/export, post-combat summary
```

Valide les énumérations et valeurs bornées à chaque frontière externe. `.passthrough()` ne valide pas les nouveaux champs d'IA. Préserve les champs omis des anciennes sauvegardes ; rejette les valeurs explicites mal formées avec une erreur utile plutôt qu'un changement silencieux de tempérament. Une nouvelle version de politique ne doit pas réinterpréter accidentellement un ancien instantané.

Pour les anciennes rencontres en cours, conserve par défaut l'ancienne politique et applique le nouveau système aux nouveaux combats. Les anciens instantanés sans taxonomie ne peuvent pas être reclassifiés rétroactivement de façon fiable ; ne prétends pas avoir évalué la règle de type obligatoire. Un Beast/Monstrosity nouvellement connu entrant dans la nouvelle politique doit être résolu en Mindless.

Tous les chemins de création d'ennemis comptent : rencontres générées, combat manuel/de repli, sauvegardes restaurées et futures unités invoquées. N'ajoute pas des champs uniquement à l'interface TypeScript pour les perdre lors de la copie explicite des propriétés.

## 10. Vérifications de plaisir, réalisme et rejouabilité

**Plaisir :** les ennemis doivent avoir des habitudes reconnaissables et exploitables. Gagner en séparant un garde Protective d'un soigneur Supportive est plus satisfaisant que gagner parce qu'un calculateur universel a choisi aléatoirement un mauvais coup. Évite de transformer tous les ennemis en machines parfaites de concentration des tirs.

**Réalisme :** utilise des buts crédibles, des informations limitées et une compétence adaptée à l'ennemi. Lâcheté, loyauté, agressivité et formation sont des qualités différentes. Mindless est la simplification demandée pour deux catégories de créatures. De futurs systèmes de moral/objectifs peuvent ajouter reddition, défense territoriale et fuite sans prétendre qu'ils existent déjà.

**Rejouabilité :** varie profils et composition des rencontres selon les graines, en préservant l'identité au sein d'un combat et pour les PNJ récurrents. Terrain, combinaisons de rôles, ressources ennemies et objectifs doivent apporter plus de variété qu'un autre jet critique. La difficulté doit modifier le défi de façon prévisible sans transformer soudain un Mindless Beast en chasseur de soigneurs.

Exemple de rencontre sur la même carte :

- Un Reckless Bruiser quitte sa case sûre pour faire pression sur une unité de première ligne accessible.
- Un Protective Bulwark reste près du lanceur de sorts Supportive au lieu de se joindre à l'assaut.
- Un Cautious Marksman conserve une ligne de tir et évite une destination exposée.
- Un Mindless Beast prend le trajet plus court en forêt vers le membre accessible le plus proche du groupe, ignorant un lanceur de sorts blessé plus éloigné.
- Un boss humanoïde nommé reçoit un tour du GM pour choisir entre pression signature légale et protection de sa retraite. Ses renforts continuent d'utiliser leurs propres profils.

Une graine différente peut produire un Cowardly Bruiser et un Opportunistic Marksman, modifiant l'engagement. Une actualisation ne le peut pas. Une apparition ultérieure du même boss nommé doit préserver ses habitudes établies sauf changement par l'histoire ou modification explicite.

## 11. Découpage d'implémentation suggéré

C'est une grande fonctionnalité : elle modifie contrats persistés, prompts, décisions ennemies et orchestration asynchrone. Mets-toi d'accord sur la conception, puis implémente de petites tranches révisables sur staging courant.

| Tranche                                  | Livrable                                                                                                                    | Preuve de sortie                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A. Fondations des capacités et de l'identité | Prouver/corriger la perte des ressources ennemies générées ; indices explicites de catégorie/rang/compétence ; préserver les champs à travers tous les chemins de création  | Un lanceur de sorts généré peut utiliser et consommer ses vraies ressources ; l'identité d'un boss seul survit à la restauration |
| B. Attribution et persistance          | A priori de rôle, indices de personnalité, adjectif sauvegardé avec graine, ancien comportement versionné                                              | Tendances d'attribution, priorité stricte du type, stabilité après actualisation/import/point de contrôle                  |
| C. Ennemis ordinaires de Tactical           | Candidats légaux partagés, poursuite exacte Mindless, huit profils distincts, texte d'inspection                                      | Matrice de scénarios comportementaux, parité des prévisions, preuves mobile/navigateur, performances bornées           |
| D. Tours GM des boss                       | Frontière serveur de révision/idempotence, phase ennemie reprenable, réponse de candidat validée, repli sauvegardé, mécaniques prises en charge | Tests délai/nouvelle tentative/concurrence/restauration et combat manuel de boss avec vrai fournisseur                        |
| E. Adaptation de Classic                  | Sémantique non spatiale des profils, ensembles corrects d'alliés/soutien, état des décisions/jets avec graine et intégration des boss à l'initiative           | Régressions de rounds/ressources Classic et preuve de restauration/reproduction ; aucune fausse affirmation de comportement sur grille        |

Les tranches A–C constituent un premier jalon utile, mais **ne suffisent pas à réaliser les boss contrôlés par le GM**. Pour Classic, une décision de boss doit être demandée au bon emplacement d'initiative après les actions précédentes, pas sur un plateau périmé du début de round. Réutilise tables de profils et logique d'attribution sans forcer moteurs spatiaux et non spatiaux dans un résolveur géant.

Travail ultérieur à périmètre séparé : ligne de vue/couverture communes, ciblage réel d'AoE, moral/fuite par unité, objectifs, adjectifs supplémentaires, coordination, IA d'invocation, économies d'actions propres aux profils de règles. Les règles de jeu de rôle sur table doivent déterminer la légalité ; le tempérament ennemi décide comment utiliser ces options légales.

### Carte du code pour l'agent chargé de l'implémentation

| Fichier / symbole                                                                                                                                                                                                                                    | Pourquoi il compte                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [types de combat partagés](../../packages/shared/src/types/game.ts), `Combatant`, `GameCombatStateSnapshot`                                                                                                                                           | Métadonnées d'exécution et contrat de restauration Classic                                              |
| [types de rencontre](../../packages/shared/src/types/combat-encounter.ts), `CombatEnemy`, `CombatInitState`                                                                                                                                         | Blueprint généré, mécaniques et types distincts du modal de rencontre                          |
| [routes de rencontre](../../packages/server/src/routes/encounter.routes.ts)                                                                                                                                                                         | Prompts/schémas de génération et contexte de personnage existant ; route d'action distincte du modal     |
| [prompts du GM](../../packages/server/src/services/game/gm-prompts.ts)                                                                                                                                                                              | Indiquent actuellement au GM que l'interface gère les mécaniques de combat                             |
| [GameSurface](../../packages/client/src/components/game/GameSurface.tsx), `generatedEnemyToCombatant`                                                                                                                                            | Perd la description et omet les MP ennemis ; hydratation explicite et chemins de restauration/création        |
| [interface Classic](../../packages/client/src/components/game/GameCombatUI.tsx) et [hooks de jeu](../../packages/client/src/hooks/use-game.ts)                                                                                                           | Requêtes Classic actives, comportement des rounds/animations et flux des actions joueur                   |
| [service Classic](../../packages/server/src/services/game/combat.service.ts), `chooseAutoSkill`, `resolveCombatRound`                                                                                                                            | Politique automatique partagée, RNG, mécaniques et initiative                                     |
| [routes de jeu](../../packages/server/src/routes/game.routes.ts), `/combat/round`, `/combat/tactical/start`, `/combat/tactical/action`                                                                                                             | Schémas et frontière d'orchestration ; aller-retour de l'état client                                |
| [IA Tactical](../../packages/shared/src/features/tactical-combat/ai.ts), `decide`, `runEnemyPhase`                                                                                                                                               | Politique actuelle et boucle traitant toute la phase ennemie à la fois                                          |
| [moteur Tactical](../../packages/shared/src/features/tactical-combat/engine.ts)                                                                                                                                                                  | Conversion d'unités, heuristique de boss, déplacement, légalité, résolution, prévisions et progression des rounds |
| [classes Tactical](../../packages/shared/src/features/tactical-combat/classes.ts)                                                                                                                                                                | Six classes existantes et dérivation des capacités                                             |
| [types Tactical](../../packages/shared/src/features/tactical-combat/types.ts), [mathématiques](../../packages/shared/src/features/tactical-combat/math.ts), [RNG](../../packages/shared/src/features/tactical-combat/rng.ts)                              | Contrats d'instantané/action, prévisions de terrain et flux déterministe                      |
| [interface Tactical](../../packages/client/src/components/game/TacticalCombatUI.tsx) et [métadonnées de chat](../../packages/shared/src/types/chat.ts)                                                                                                       | Instantané Tactical sauvegardé, états occupés et reprise d'un boss en attente                             |
| [régressions de terrain existantes](../../scripts/regressions/hybrid-terrain.regression.ts), [preuve de route](../../scripts/regressions/hybrid-terrain-route.regression.ts), [preuve de préparation](../../scripts/regressions/hybrid-terrain-setup.regression.ts) | Modèles de preuves exécutables existantes à étendre lorsque c'est pertinent                                  |

Avant d'implémenter, cherche issues, PR ouvertes/brouillons, branches liées et éléments de projet pour éviter les doublons. L'ancienne feuille de route du combat cite la PR #4391 fermée/non fusionnée comme travail antérieur ; revérifie son statut et sa responsabilité, et n'absorbe pas toute cette extension comme prérequis. Suis les versions actuelles d'`AGENTS.md`, `CONTRIBUTING.md`, des instructions de package et de la surcouche Chai. N'implémente pas uniquement à partir de numéros de ligne périmés.

## 12. Plan d'acceptation et de validation

Utilise de petites preuves exécutables `*.regression.ts` dans le runner existant. Ne conserve pas de fichiers temporaires `.test.ts`. Les assertions doivent démontrer le comportement, pas simplement reproduire les constantes de poids.

| Scénario                                                                                        | Résultat requis                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Beast/Monstrosity avec adjectif contradictoire, compétence maître, personnalité connue ou rang de boss | Les indices générés donnent toujours Mindless ; les profils résolus rédigés/importés contradictoires sont rejetés avec une erreur utile |
| Tank proche en bonne santé contre lanceur de sorts blessé plus éloigné                                              | Mindless poursuit le tank ; Opportunistic peut choisir le lanceur de sorts                                                            |
| Court trajet en forêt contre trajet dégagé plus long                                                     | Mindless choisit moins de pas en payant le coût réel ; il reçoit normalement les bonus fortuits du terrain              |
| Mur imposant de s'éloigner temporairement ; adversaire inaccessible                                      | La poursuite trouve le détour légal ou une autre cible accessible ; aucun blocage dû à Manhattan                                         |
| Unités Mindless volantes/se téléportant                                                               | Respectent leurs règles distinctes de traversée/arrivée/occupation et portée par tour ; aucun enchaînement impossible d'arrivées                       |
| Allié blessé hors de portée actuelle des soins                                                      | Supportive peut se déplacer et soigner légalement ; MP épuisés/temps de recharge bloquent la capacité                                               |
| Unité Protective sans provocation ni interception                                           | Placement seulement ; aucune redirection de dégâts inventée                                                                          |
| Ennemi Cowardly blessé                                                                          | Peut reculer/défendre ; ne déclenche jamais la fuite globale du groupe                                                                      |
| Forte compétence sur un grand ensemble fixe de graines                                                     | Les profils adaptés au rôle deviennent plus fréquents, les profils rares compatibles restent possibles ; sorties stables par graine                |
| Personnalité connue, trait nié, indices contradictoires, indices absents/invalides, texte non anglais  | Ajustements bornés documentés ; aucun contrôle numérique arbitraire ni affirmation accidentelle de prise en charge limitée à l'anglais                             |
| Épuisement temporaire des MP                                                                         | Rôle/adjectif inchangés ; seuls les choix d'actions légales changent                                                                |
| Deux ennemis visent une unité blessée, le premier la vainc                                             | Le second évalue l'état mis à jour ; aucune attaque sur cible morte ni soin réservé en double                                |
| Terrain de destination différent du terrain d'origine                                               | Prévisions de candidats et contre-attaques réelles concordent sur positions, terrain et règles                                             |
| Le GM invente coordonnées, capacités, actions gratuites, ID de cible ou ressources illégales                   | Aucune mutation ; seulement un repli légal sauvegardé ou un candidat valide                                                                 |
| Délai GM suivi d'un succès tardif, actualisation, requête dupliquée ou onglets simultanés            | Exactement une action de boss acceptée et un débit de ressources ; réponse périmée écartée                                     |
| Victoire/défaite du groupe pendant une phase ennemie suspendue                                          | Bon résultat terminal ; aucun tour restant de boss/renfort après la fin du combat                                                     |
| Restauration de point de contrôle, branche, import/export, ancienne sauvegarde, PNJ récurrent                        | Préserver profils acceptés et identité correcte du combat ; aucun nouveau tirage involontaire ni décision externe dupliquée             |
| Mindless Classic et boss GM                                                                    | Règle de ciblage non spatial explicite et bon emplacement d'initiative ; aucune affirmation de comportement de grille/terrain                        |

Mesure le coût décisionnel aux limites de requête prises en charge de 40 unités / 64 par 64, avec modes de déplacement mélangés, nombreuses capacités et obstacles denses. Mets en cache les calculs de mouvement/menace par décision lorsque c'est justifié ; invalide après changement d'état. Fixe un budget temporel mesurable de phase ordinaire après profilage du moteur actuel sur ordinateur et appareil mobile représentatif. Ne prétends pas à un budget précis en millisecondes sans mesure et n'ajoute pas de recherche profonde avant profilage.

Pour l'implémentation : commence par `pnpm install` ; exécute `pnpm check`, les régressions ciblées combat/routes, `pnpm regression:prompt` si tu changes les prompts et `pnpm localization:check` pour le texte d'interface. Utilise les régressions navigateur pour le véritable flux de combat, l'actualisation, l'attente/l'échec du boss, l'accès clavier, les petits écrans et les thèmes clair/sombre. Ajoute les entrées `[Unreleased]` adaptées au changelog. Lis `packages/client/.instructions.md` avant les modifications client. Journalise prompts/résultats fournisseur avec les fonctions de débogage existantes et Pino, sans exposer de secrets sans rapport.

Avant de demander la revue d'une PR, exécute CodeRabbit localement, traite les constats substantiels puis relance-le. Documente les rejets fondés sur le code pour les faux positifs ou suggestions purement tatillonnes ; ne boucle pas indéfiniment. Laisse les cases du plan de test de PR décochées pour le contributeur humain. Lorsque ce document est publié dans une PR, inclus le suivi `[docs-i18n]` requis ou les mises à jour traduites correspondantes.

### Ce que l'exploration initiale a vérifié

Les descriptions du comportement courant viennent du traçage du code client actif, des routes et résolveurs, avec audits séparés Classic/Tactical. L'exemple de probabilité a été calculé directement. Aucun code d'IA de combat n'a été modifié, aucune nouvelle politique n'a été simulée, et aucun flux de boss dans le navigateur ou avec vrai fournisseur n'a été exercé. Ce sont des exigences d'acceptation pour l'implémentation, pas des preuves fournies par cette conception.

## 13. Limites de l'implémentation actuelle de l'IA ordinaire

Vocabulaire de politique implémenté : Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical et Coordinated**. Les autres adjectifs ci-dessous sont des pistes, pas des réglages cachés d'exécution.

Le contrat partagé `features/combat-ai.ts` sépare du contrôle le rôle, l'adjectif, le palier de formation et la graine sauvegardés. Les nouveaux combats reçoivent des attributions sauvegardées ; ceux restaurés sans profil conservent l'ancienne politique automatique. Changer le contrôleur d'un compagnon ne tire pas à nouveau son adjectif au hasard. Les réserves finies de MP générées et les types/coûts explicites de capacités passent dans l'exécution ; l'absence de MP ennemis utilise la même réserve provisoire `20 + 3 × level` que les alliés sans caractéristiques, en préservant un zéro explicite. C'est un repli générique de l'Engine, pas une règle de ressources de jeu de rôle sur table.

L'attribution v1 est volontairement plus petite que la formule proposée en section 5 : les profils compatibles commencent avec un poids positif, ceux favorisés par le rôle gagnent un bonus dépendant de la formation, et un indice facultatif de personnalité issu d'une énumération fermée ajoute une préférence bornée. La priorité de catégorie impose Mindless ; un indice explicite Mindless sélectionne aussi ce comportement pour les autres catégories de créatures. L'appel existant de génération de rencontre fournit les indices dans l'une ou l'autre langue ; l'Engine n'analyse pas lui-même la personnalité en prose. Les autres indices de tempérament sont des préférences, pas des garanties, et la compréhension par le modèle de la négation/caractérisation multilingue nécessite encore une évaluation fournisseur. La provenance complète et la personnalité liée à l'identité entre rencontres de PNJ récurrents restent à faire. Sans indice, le niveau de repli déduit des HP reste un substitut faible de formation.

Chaque mode énumère attaques de base, capacités et options défensives exécutables, puis note dégâts, achèvement, soins effectifs, soutien, coût et facteurs tactiques pertinents. Aucun appel au modèle n'est ajouté aux tours ordinaires. Les profils ne donnent jamais une capacité indisponible, des MP illimités, une activation supplémentaire ou des mécaniques de terrain inexistantes.

- **Classic :** aucun score spatial. Mindless utilise un ordre stable avec graine des adversaires vivants, indépendant des HP. Le soutien utilise le bon ensemble allié. Les capacités d'amélioration/affaiblissement appliquent un véritable modificateur nommé de défense plutôt qu'une approximation limitée aux dégâts. Les nouveaux profils ont des temps de recharge par utilisation. Les compagnons manuels mettent en file leurs choix attaque/capacité/défense pour leurs propres emplacements d'initiative ; l'inventaire du groupe et les actions narratives restent au chef actif. Les autres compagnons sont par défaut en IA, conformément à l'interaction établie de Classic. Les commandes soumises identifient leur acteur, y compris lorsque le chef initial est KO.
- **Tactical :** les destinations accessibles légales d'attaque/soutien alimentent la politique. Mindless suit un trajet au minimum de pas en payant le coût réel ; vol et téléportation conservent leurs restrictions de traversée/arrivée. Le soutien peut se déplacer avant de lancer. Les nouvelles estimations de contre-attaque utilisent la destination envisagée. Une estimation prudente de portée à partir de l'état public mesure l'exposition ; ce n'est pas une recherche complète de chemin au tour suivant. Un mur ou une montagne bloque la ligne de vue pour chaque frappe (combat C6).
- **Patient :** préfère un maintien défensif borné à un engagement défavorable ; Classic attend un temps de recharge presque terminé plutôt qu'un mouvement fictif. Il ne peut pas continuer d'attendre indéfiniment lorsqu'une action utile existe.
- **Methodical :** préfère une préparation prise en charge de réduction de défense, garde la cible choisie et attaque lorsque l'état est utile. Aucun arbre de combo inventé ni recherche des jets futurs.
- **Coordinated :** prend en compte les cibles enregistrées des alliés et les affaiblissements utiles, en recalculant après chaque action acceptée. Aucun planificateur d'équipe omniscient ni réservation d'actions joueur non soumises.
- **Compagnons :** sélection localisée **Player/AI** (joueur/IA) par membre dans le combat, avec chef actif maintenu manuel. Les compagnons Tactical agissent après les commandes manuelles restantes ou la sélection d'**End Turn** (fin du tour). Le contrôle manuel reste possible avant qu'un compagnon agisse. Changements de contrôleur, profils et mémoire persistent avec les combattants/instantanés Tactical.
- **Persistance Classic :** les résultats de round acceptés et le numéro du round suivant sont transmis au callback d'instantané existant avant l'animation cosmétique. Les vrais temps de recharge par utilisation survivent à cet aller-retour. Classic utilise toujours ses jets aléatoires existants ; ce n'est ni une reproduction exacte des jets ni un registre idempotent d'actions serveur. Les garanties entre onglets simultanés appartiennent au futur travail de boss faisant autorité.

Le premier jalon s'arrêtait avant les appels fournisseur des boss et les réactions ; la section 16 consigne leur implémentation ultérieure. Restent limités : fuite par unité, provocation, objectifs plus riches, initiative par ruleset, normalisation complète des ressources de fiches et registre de profils de PNJ récurrents. Les parties non implémentées de la proposition initiale restent du travail d'acceptation, pas des fonctionnalités implicitement publiées. Les mesures synthétiques sur ordinateur ne constituent pas une calibration de performances sur véritable appareil mobile.

## 14. Davantage d'adjectifs, avec comportement sensible à la classe

Garde un adjectif visible et un rôle dérivé des capacités. Ce sont des priorités distinctes, pas des synonymes d'"intelligent". Autorise les combinaisons inhabituelles mais mécaniquement valides.

| Adjectif | Fighter / Knight | Rogue / Archer | Mage / Healer | Distinction et prérequis |
| --- | --- | --- | --- | --- |
| **Frugal** | Utilise une frappe normale avant une technique de combat limitée | Garde munitions spéciales ou capacités de rafale pour les cibles importantes | Utilise des sorts efficaces ; réserve les soins coûteux aux pertes importantes de HP | Efficacité des ressources même en sécurité ; différent de Cautious. Exige de vrais coûts de ressources finies |
| **Relentless** | Maintient la pression sur un ennemi choisi | Maintient poursuite ou pression à distance sur une cible | Poursuit une séquence prise en charge de dégâts/contrôle sur la même menace | Fort engagement de cible, pas prise de risque Reckless ; exige cible sauvegardée et sortie en cas de cible invalide/manque de progression |
| **Disruptive** | Utilise un désarmement, une interruption ou une frappe incapacitante disponible | Interrompt une canalisation prise en charge d'un lanceur exposé ou applique un affaiblissement | Privilégie dissipation, silence, purification ou contrôle utiles | Empêche les actions significatives plutôt que de maximiser les dégâts. Active seulement les effets réellement pris en charge ; aucun faux silence fondé sur le nom |
| **Vengeful** | Riposte contre l'ennemi qui l'a blessé ou a abattu son protégé | Marque le dernier agresseur et cherche une ouverture légale | Maudit cet agresseur ou protège sa victime prévue | Rancune issue des événements, pas sélection du plus faible. Exige une mémoire bornée du dernier attaquant/de la défaite d'un allié |
| **Adaptive** | Change de tactique après une résistance observée ou un engagement raté | Cesse de répéter les attaques inefficaces | Change d'élément ou de plan de soutien selon les résultats observés | N'apprend que des preuves publiques. Exige un historique d'observation borné ; aucun accès aux tables cachées de résistances |
| **Opportunistic** (déjà inclus) | Choisit un achèvement sûr plutôt qu'un duel plus long | Exploite une cible blessée/exposée | Utilise un sort pour assurer une vraie ouverture | Le profil existant sert de référence ; n'ajoute pas "Cruel" avec le même calculateur de score |
| **Resolute** | Continue son rôle assigné malgré une faible santé | Conserve une position de tir utile sous pression | Termine un soin important ou une canalisation prise en charge | Sang-froid à faible santé, différent de l'agressivité Reckless ; exige intention/engagement et invalidation d'urgence |
| **Territorial** | Tient une porte ou une zone de garde rédigée | Surveille une approche définie et cesse la poursuite au-delà | Soutient les alliés dans la zone défendue | Exige un objectif/périmètre réel dans Tactical. Dans Classic, défends un objectif nommé, pas des coordonnées imaginaires |
| **Zealous** | Privilégie un chef ou une cause explicitement désignés à sa survie | Dépense ses rares rafales sur les menaces contre cet objectif | Engage soutien/ressources pour la mission même au risque de sa vie | Fidélité à l'objectif, différente du soutien général Supportive ; exige métadonnées d'objectif/rang |
| **Deceptive** | Utilise une feinte ou un changement de posture pris en charge | Utilise dissimulation, leurres ou détournement de cible réels | Crée une illusion ou un appât pris en charge | Exige des mécaniques de perception/tromperie aux réponses lisibles. Les affirmations narratives seules n'ont aucun effet |
| **Merciful** | Choisit un achèvement non létal pris en charge | Neutralise plutôt que tue lorsqu'une reddition est possible | Utilise retenue/contrôle et accepte la reddition | Exige résultats non létaux et règles de reddition ; aucune attaque de cible vaincue ni effet de clémence inventé |
| **Selective** | Appelle un protecteur résistant seulement si nécessaire | Appelle un poursuivant ou une unité à distance pour une ouverture actuelle | Choisit une invocation élémentaire/de soutien adaptée aux menaces visibles | Future politique de sélection d'invocations, pas nouvelle préférence générique de dégâts ; exige suivi des invocations |

Meilleurs ajouts après les onze actuels : **Frugal, Relentless, Disruptive et Vengeful**. Frugal et Relentless conviennent aux capacités existantes avec de petits changements d'état. Disruptive exige une vraie sémantique d'incapacitation/dissipation ; Vengeful exige une mémoire d'événements de combat. Adaptive et Territorial offrent beaucoup de rejouabilité mais de plus grands prérequis. Traite Resolute et Zealous comme des candidats dont il faut tester les recouvrements avant d'étendre le vocabulaire public.

Les trois ajouts demandés varient aussi selon la classe :

| Adjectif | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Se prépare en attendant qu'un échange défavorable s'améliore ; tient une approche précieuse dans Tactical | Attend une portée légale utile au lieu de forcer un tir faible | Conserve un tour pour un sort presque prêt ou évite un soin gaspillé ; n'attend jamais une régénération de mana inexistante |
| Methodical | Applique une vraie technique d'affaiblissement, puis attaque cet ennemi | Prépare une vulnérabilité prise en charge avant une rafale | Affaiblit avant de faire des dégâts ou prépare une séquence défensive prise en charge ; ne réapplique pas les effets actifs utiles |
| Coordinated | Fait pression sur la cible actuelle d'un allié ou fournit une préparation utile | Achève une cible déjà menacée par l'équipe | Apporte un soutien non redondant ou un affaiblissement exploitable par les alliés ; recalcule après chaque action |

Ces descriptions sont des objectifs de réglage. La première implémentation utilise le modèle générique pris en charge d'amélioration/affaiblissement de défense ; des combinaisons plus riches propres aux classes exigent les capacités et scénarios de régression correspondants.

## 15. Extension de conception pour Summoning

Commence sans grille. Une invocation est un vrai combattant avec ID stable de rencontre, référence au propriétaire, camp, profil, contrôleur, durée, coût en ressources et budget explicite d'activation. La classe change ses capacités légales ; l'adjectif change ses priorités comme dans Classic.

Sépare le **choix d'invocation** de l'invocateur de la **politique de combat** de l'unité invoquée. Un invocateur Patient peut préserver un emplacement pour une menace future ; un Knight invoqué Protective protège par des actions prises en charge ; un Mage invoqué Methodical prépare un affaiblissement ; un soigneur Coordinated évite les soins en double. Les invocations Beast/Monstrosity restent Mindless selon la règle actuelle du projet, même amicales.

Le ruleset décide si les commandes consomment l'action du propriétaire, si une invocation agit immédiatement ou au round suivant, si elle partage l'initiative et ce qu'elle fait sans commande. Valeur générique recommandée : invoquer consomme l'action ordinaire du propriétaire, la nouvelle unité s'active d'abord au round suivant et utilise l'IA de l'Engine sauf contrôle explicite. N'accorde pas un nouveau tour ordinaire en renvoyant/réinvoquant la même unité. Impose un plafond de population et un suivi stable d'une activation par round avant d'ajouter des capacités d'essaim.

KO du propriétaire, charme/changement d'allégeance, renvoi, fin de durée, défaite du groupe et fin de rencontre exigent chacun des règles explicites de nettoyage. Sauvegarde propriété et durée restante à travers actualisation/import. Une invocation vaincue n'est ni un objet d'inventaire ni un membre permanent du groupe. Le coût en sorts/MP est débité une fois pour la création acceptée. Les actions d'invocation ne doivent pas fabriquer de fenêtres d'actions légendaires au-delà des règles d'éligibilité du modificateur de boss fixé.

## 16. Boss GM, actions légendaires et réactions

### Adaptateur générique Engine implémenté

Les nouvelles parties créées dans l'assistant activent le combat dirigé par le serveur. **GM directs bosses** contrôle l'usage du fournisseur ; adversaires ordinaires et compagnons IA restent locaux. Les parties existantes sans `combatDirector` restent sur leur ancien résolveur. La préparation de rencontre fixe activation du GM, difficulté, graine, terrain et capacités pour que les changements de réglages pendant le combat ne réécrivent pas les règles acceptées. Le générateur doit rédiger explicitement `boss` ; beaucoup de HP ou un marqueur visuel de boss ne donnent aucune action supplémentaire. Un boss seul est pris en charge.

`combat-director.routes.ts` stocke un instantané versionné détenu par le serveur dans le stockage existant de l'état de jeu sous `experience:marinara-engine.combat`, ancré au message de début de rencontre. L'instantané inclut curseur d'initiative, pile d'effets en attente, choix disponibles, budgets de réaction/actions légendaires, ressources, ID de requêtes acceptées et journal récent d'événements. Les commandes portent ID de rencontre, ID d'instance de stockage et révision ; les soumissions dupliquées ou périmées renvoient l'état accepté. La consommation d'inventaire et la sauvegarde du combat partagent une transaction. Les réponses fournisseur sont aussi vérifiées contre l'identité de ligne, la révision et la fenêtre sauvegardées ; une réponse tardive ne peut donc pas traverser un repli, une restauration de point de contrôle ou une branche.

- **Classic :** les emplacements individuels d'initiative s'arrêtent maintenant pour une décision de personnage manuel ou de boss. Le directeur résout un acteur à la fois, puis applique une fois les mécaniques/progressions d'états de fin de round existantes. Les anciennes parties conservent leurs commandes initiales de round en file.
- **Tactical :** inspecter/sélectionner un pion est gratuit. **Begin [name]'s turn** (commencer le tour de [name]) confirme l'activation et ouvre les éventuelles opportunités d'anticipation. Le mouvement seul ne produit pas une nouvelle activation ni fenêtre légendaire. Les compagnons IA et ennemis conservent la structure de phases. Les briefs de terrain, graines de rencontre et tailles de préparation acceptés restent la référence. Les nouvelles rencontres ignorent les préférences obsolètes de graine de campagne.
- **Boss :** le budget initial rédigé est généralement de trois points légendaires, chaque action supplémentaire proposée ayant un coût positif. Les points se renouvellent à l'activation ordinaire du boss. Anticipation et opportunités après tour partagent cette réserve ; actions supplémentaires et réactions ne génèrent jamais leur propre chaîne légendaire. Le générateur rédige les coûts légaux d'attaque/défense/mouvement et de capacité. Un boss Mindless respecte les restrictions de poursuite ; une seule action légale s'exécute localement.
- **Fournisseur :** utilise la connexion d'outil GM configurée, avec repli sur celle du chat. Fournis capacités, ressources, quantités d'objets, états, profils, positions et événements acceptés actuels du groupe/adversaires. N'envoie jamais commandes privées en attente, état RNG ou choix joueur saisis/survolés. Le GM renvoie un ID de candidat légal, jamais un état réécrit. La journalisation de débogage des prompts/résultats suit les fonctions existantes de l'hôte. Une décision expire après dix secondes ; douze appels par round est le plafond cumulé actuel. Le repli ordinaire utilise l'IA locale ; les fenêtres légendaires facultatives passent. L'interface identifie les événements de repli et propose un repli local pendant l'attente du GM. Ce sont des limites initiales fixes, pas des garanties de latence configurables.
- **Réactions :** les capacités explicitement marquées `counterspell` et `guard` ont des fenêtres déclenchées. Les personnages manuels reçoivent des choix capacité/cible/coût et **Pass** (passer) ; l'IA locale évalue menace et rareté, les boss GM choisissent via le même contrat fournisseur. Une unité a une réaction, renouvelée à son activation, et les temps de recharge explicites restent applicables. Les contresorts peuvent eux-mêmes être des sorts et être contrés. L'ordre stable des unités et la pile parent sauvegardée bornent la résolution à la limite de quarante unités par rencontre. Passer ne consomme rien.
- **Coûts :** réserve/dépense les MP de la capacité déclarée ou un emplacement de sort de niveau exact avant les réactions, sans double débit à la résolution. L'adaptateur générique consomme ce coût même si le sort ou Counterspell échoue. Une réaction dépense aussi son droit ; les capacités légendaires dépensent leur coût rédigé et des points légendaires. Les emplacements sont des données explicites facultatives des capacités, pas déduites d'une classe ou d'un nom de capacité. Ni lancement à niveau supérieur ni règles de remboursement propres aux éditions ne sont implémentés.
- **Effets génériques :** Counterspell a une chance avec graine de `clamp(65% + 3% × level difference, 20%, 95%)` ; il n'annule que des effets en attente. Guard applique temporairement la réduction existante de défense à un allié menacé pour cette attaque. Les réactions Tactical vérifient la portée rédigée et la ligne de vue commune (combat C6), comme les attaques ordinaires. `areaRadius` et `friendlyFire` explicites permettent les zones d'attaque Tactical, tandis que `targetScope: all-enemies` dans Classic applique un seul lancement payé au groupe adverse. Ce sont des règles volontairement génériques, pas Counterspell de l'une des deux éditions de 5e.
- **Commandes :** les écrans de combat existants affichent l'état accepté faisant autorité, les budgets de réaction/actions légendaires et un panneau de choix ciblé accessible au clavier. L'inventaire Tactical propose de vrais objets pris en charge au lieu de l'ancienne potion provisoire illimitée. Recharger restaure la décision en attente. La correction de réinitialisation avant restauration préserve l'ancre de rencontre et les mécaniques, y compris lors du montage répété de React en développement. Les totaux de ressources sont inclus dans le récapitulatif de combat.

**Limites actuelles :** le directeur ne propose ni l'ancienne manœuvre libre **Special** (spéciale) ni redémarrage du combat sur place, car ni l'une ni l'autre n'a encore de contrat d'action/retour arrière faisant autorité ; les anciens combats gardent ces commandes. Utilise les commandes existantes d'histoire/points de contrôle pour restaurer. Le menu GM est limité à seize choix ordinaires/légendaires ; seul un petit ensemble de destinations de repositionnement est proposé. Guard réduit les dégâts, ce n'est ni déplacement/interception ni attaque d'opportunité. La riposte Tactical existante reste un échange automatique distinct, pas une réaction de sort. Classic conserve ses dés aléatoires et la couverture existante des mécaniques scriptées ; Tactical ne gagne pas les mécaniques scriptées de Classic. Il n'y a ni adaptateur complet de jeu de rôle sur table, ni résurrection, propriété d'invocation, concentration générale, lancement à niveau supérieur ou registre de profils de PNJ récurrents. La normalisation complète des fiches et les ressources durables entre rencontres distinctes appartiennent toujours au travail sur les rulesets. L'évaluation de la qualité fournisseur et du rythme sur appareil réel reste à effectuer en jeu.

### Exigences de conception acceptées

**Accepté :** les actions légendaires doivent être disponibles aux boss rédigés indépendamment d'un ruleset 5e. Le GM connaît les capacités/ressources de combat du groupe et peut agir sur une prédiction plausible avant une action ordinaire. Les unités IA évaluent les réactions facultatives et peuvent les refuser pour préserver leurs ressources. Elles ont maintenant une première implémentation générique Engine, distincte de la politique des tours ordinaires.

### Connaissances et prédiction du GM

Donne au GM un instantané lié à une révision des capacités/sorts de chaque membre du groupe, portées légales et formes de zone prises en charge, HP et MP/points de sorts actuels/maximaux, emplacements par niveau, temps de recharge, états, équipement, quantités d'objets utilisables et usages restants. Inclus propriété/accès à l'inventaire partagé, positions courantes si pertinentes, invocations, actions acceptées récentes et unité qui commence son activation. Une donnée absente est inconnue, pas zéro ni illimitée. Obtiens cela des fiches et inventaires acceptés, pas d'un résumé inventé par le modèle. L'accès en lecture aux objets du groupe ne donne pas au boss le pouvoir de les utiliser ou de les retirer.

Le GM peut utiliser cette connaissance plus large de la rencontre pour prédire les menaces tout en choisissant un comportement adapté à la personnalité et à la compétence du boss. L'IA locale ordinaire conserve sa frontière d'information existante. Aucun ne reçoit le futur RNG, les brouillons privés saisis, les capacités/cibles survolées ou les commandes en file d'autres unités avant leur déclaration. Un sort réellement déclaré ne fournit que les détails du déclencheur exposés par le ruleset ; connaître la liste des sorts du lanceur ne prouve pas lequel il choisira. Le serveur peut valider l'état complet tout en filtrant le contexte décisionnel du contrôleur.

**Exemple Fireball :** le mage sélectionné dispose de Fireball, de ressources suffisantes et d'une explosion légale menaçant le boss sans toucher ses alliés. Le GM peut en déduire une forte probabilité de Fireball et dépenser un point légendaire pour un repositionnement, une protection ou une action de pression légaux. Il peut se tromper ; il doit aussi considérer pourquoi un sort monocible ou une autre action serait préférable. Il ne peut inventer esquive, silence ou mouvement gratuit. Utilise les vraies règles d'AoE, de tir allié et de visibilité de l'Engine ; l'ancienne approximation monocible ne pouvait pas permettre cette prévision spatiale. Le directeur prend maintenant en charge les zones d'attaque explicitement rédigées. Dans Classic/Summoning, utilise les groupes de cibles et menaces non spatiaux réels plutôt qu'une portée de grille inventée.

### Trois fenêtres temporelles distinctes

Comportement de référence : les [règles d'actions légendaires de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/monsters) placent ces actions après le tour d'une autre créature et renouvellent leur budget au propre tour du boss. Anticiper le mage nouvellement sélectionné **avant** son action est une extension délibérée de Marinara, pas la chronologie standard de 5e. Garde-la disponible indépendamment du ruleset via un modificateur de boss explicite fixé pour la rencontre ; un profil fidèle à 5e utilise la chronologie native sauf activation de cette règle maison. Ne la mélange pas silencieusement aux [règles de monstres de 2024](https://www.dndbeyond.com/sources/dnd/br-2024/how-to-use-a-monster).

| Fenêtre | Déclencheur et informations disponibles | Budget et continuation |
| --- | --- | --- |
| Action légendaire anticipatoire | L'activation d'une autre unité commence ; le GM voit cet acteur, les fiches et l'état courant, pas son action non confirmée | Dépenser dans la réserve légendaire existante, puis laisser l'acteur choisir/revalider son action |
| Réaction déclenchée | Un événement pris en charge survient, comme le début d'un sort ; ne révéler que les détails autorisés du déclencheur | Dépenser le droit de réaction et le coût MP/emplacement/usage de la capacité, puis reprendre ou annuler l'action en attente selon les règles |
| Action légendaire après tour | Une autre unité termine son activation ordinaire | Dépenser dans la même réserve légendaire, puis avancer à l'activation ordinaire suivante |

Dans Tactical, distingue inspecter/sélectionner une unité de **commencer son activation**. La première sélection confirmée pour agir peut ouvrir la fenêtre d'anticipation avant mouvement/action, une fois par activation d'acteur. Une fois acceptée, changer de sélection, annuler un menu, actualiser ou changer de méthode d'entrée ne peut ni la rouvrir ni changer d'acteur pour multiplier les décisions. La simple inspection reste gratuite. Rends cet engagement visible ; après interruption, l'unité sélectionnée conserve son action ordinaire sauf empêchement par un véritable effet incapacitant. Une courte indication explicative vaut mieux qu'un boss attaquant à chaque clic.

Classic collecte actuellement les commandes avant de résoudre tout un round d'initiative. Une sélection pendant la saisie de commande n'est pas l'activation réelle de l'unité. Le futur résolveur doit s'arrêter à l'emplacement d'initiative, exposer l'acteur actif sans révéler sa commande en file, résoudre l'anticipation puis valider/traiter la déclaration de cette commande. Si l'interruption rend un choix en file illégal, demande un nouveau choix manuel (ou réévalue l'IA) avant le début du lancement. N'appelle pas le GM à chaque sélection de menu et n'exécute pas prématurément un futur emplacement d'initiative. Applique le même cycle aux compagnons IA et futures invocations.

Valeurs par défaut proposées du modificateur générique :

- Rédige une identité de boss explicite et un petit menu légendaire légal ; ne déduis pas les privilèges GM des HP les plus élevés.
- Commence avec un budget visible de 3 points, des actions coûtant 1–3, renouvelé au début de l'activation ordinaire du boss. Fixe budget initial et politique de surprise/incapacitation au début de la rencontre. C'est le réglage proposé par Marinara, pas l'obligation de copier un monstre publié.
- Autorise au maximum un choix légendaire anticipatoire et un choix après tour par boss et activation éligible d'une autre unité, tous deux dans la même réserve finie. Ce réglage permet l'anticipation demandée sans accorder davantage de points. Passer ferme aussi la fenêtre. Résous la précédente fenêtre après tour avant de commencer l'activation suivante.
- Dans Tactical, la fenêtre après tour suit mouvement plus action ou **Wait** (attendre), pas les clics de mouvement, chaque frappe, contre-attaque, image d'animation ou toute la phase joueur. Dans Classic, elle suit l'emplacement d'initiative résolu. **End Turn** ferme chaque activation éligible sautée au maximum une fois ; les invocations suivent les règles d'éligibilité fixées.
- Propose `pass` et uniquement des candidats légaux dans le budget. Aucune action légendaire n'ouvre une autre fenêtre légendaire ni ne double la vitesse. Un sort lancé comme action légendaire ne peut déclencher Counterspell que si l'adaptateur de règles sélectionné prend cette réaction en charge ; les budgets restent séparés.
- Revérifie que le boss est vivant/capable d'agir, la légalité de la cible et l'issue du combat avant de demander puis d'accepter une décision. Un boss vaincu ne peut dépenser une réponse tardive. Les contraintes de catégorie Mindless restent applicables au ciblage/à la poursuite, y compris aux options légendaires.
- Distingue action ordinaire, réaction, action légendaire et événement de repaire/phase. Leurs budgets/déclencheurs sont séparés ; ne laisse pas une description créer de nouveaux dégâts ou activations gratuites.
- Les renforts ordinaires restent en IA locale. Les appels GM ne concernent que les fenêtres de boss avec choix significatif. Réutilise connexion GM configurée, journalisation de débogage, repli sauvegardé et limite cumulée de latence de la section 8.

### Counterspell et autres réactions facultatives

**Évaluer automatiquement, dépenser sélectivement.** Posséder Counterspell ne signifie pas le lancer contre chaque sort. Un déclencheur ouvre un choix entre réactions éligibles et `pass`. Compagnons IA et ennemis ordinaires choisissent localement selon leurs capacités, adjectif, compétence, réserves courantes et valeur de l'annulation de cet effet particulier. Les boss GM utilisent leur contrôleur GM dans la même fenêtre légale. Les unités contrôlées par le joueur reçoivent un choix **React/Pass** (réagir/passer) avec coût ; ne dépense pas silencieusement leurs rares emplacements simplement parce qu'elles possèdent une capacité. Les effets passifs obligatoires suivent leurs propres règles sans être présentés comme des réactions discrétionnaires.

Évalue dégâts/contrôle attendus empêchés, défaite alliée évitée, soins/préparations ennemis précieux refusés, réussite estimée et coût d'opportunité de la ressource comme de la consommation de la réaction avant renouvellement. Counterspell peut viser un sort de soin ou utilitaire si ses règles le permettent, pas uniquement les attaques. N'inspecte pas les jets futurs ni les choix encore privés. Une réaction coûteuse contre un sort inoffensif peut perdre face au passage ; le dernier emplacement peut valoir la peine pour empêcher l'anéantissement du groupe. Les préférences de réserve sont des priorités souples de politique sauf limite stricte explicitement définie par le joueur.

| Style / capacités | Exemple de priorité de réaction |
| --- | --- |
| Protective Knight ou Mage | Intercepter une frappe menaçant un allié ou contrer un sort létal, uniquement avec la vraie capacité correspondante |
| Cautious ou Patient Mage | Passer face à un sort faible pour conserver réaction et ressources rares contre une menace grave |
| Methodical Mage | Refuser une purification, un soin ou un sort de contrôle pris en charge qui briserait son plan établi |
| Lanceur de soutien Coordinated | Réévaluer après la réaction d'un allié ; ne pas contrer un sort déjà annulé ni réserver deux fois une réaction |
| Lanceur Reckless | Dépenser plus volontiers pour préserver la pression offensive ; ne peut toujours pas lancer lorsque son budget de ressources/réaction est épuisé |
| Lanceur Frugal (adjectif proposé) | Préférer une réponse suffisante moins chère ou passer ; comparer le dernier emplacement aux futurs besoins de soins/dégâts |

Utilise des ID de capacités et des métadonnées explicites de déclencheur/effet, jamais le mot traduit "Counterspell". Chaque réaction nécessite déclencheur, chronologie, exigences de cible/visibilité, coût en ressources, coût/règle de renouvellement de réaction et opération de résolution. Sépare MP, points de sorts et emplacements. Counterspell se déclenche quand le lancement commence, avant les effets du sort ; sélectionner le mage ou ouvrir son menu de sorts ne suffit pas. [Counterspell 2014](https://www.dndbeyond.com/spells/2051-counterspell) et [Counterspell 2024](https://www.dndbeyond.com/spells/2619072-counterspell) ont des résultats de réussite/ressources différents ; l'adaptateur doit les définir explicitement. Traditional a besoin de sa propre formule/coût d'interruption documentés, pas d'un mélange accidentel.

Revalide déclencheur, état vivant/capable, visibilité/portée, cible et ressources avant confirmation. Déduis une seule fois le coût de la réaction choisie même si la tentative échoue, sauf remboursement accordé par une règle implémentée. Le coût et la consommation d'action du sort original en attente suivent leur propre ruleset, séparément du paiement du contresorteur. Passer ne dépense ni l'un ni l'autre. Aucun remboursement automatique pour une animation annulée. Valeur Traditional proposée : un droit de réaction par unité, initialement disponible sauf condition explicite de rencontre, renouvelé au début de son activation ordinaire. Les autres adaptateurs définissent leur propre quantité/frontière de renouvellement ; une interruption ou attaque supplémentaire de vitesse ne le renouvelle jamais implicitement. Les contre-attaques d'échange Tactical existantes ne sont pas automatiquement des réactions de sort ; préserve leur sémantique actuelle jusqu'à association explicite par un ruleset.

### Résolution et persistance des interruptions

La [PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) fournit un précédent utile : préserver l'action initialement tentée, afficher l'interruption acceptée, mettre immédiatement à jour le contexte suivant et empêcher restauration/nouvelle tentative d'écraser des changements ultérieurs. Son implémentation Roleplay coupe le texte à une phrase littérale validée ; cet analyseur n'est pas un moteur de chronologie ni de ressources de combat. Réutilise les principes de persistance/visibilité, pas la troncature du texte pour décider si des dégâts ont eu lieu.

Représente une action ordinaire par une déclaration sauvegardée, des effets en attente et un résultat de résolution. Séquence proposée : début d'activation et renouvellement du budget → anticipation facultative → déclaration légale d'action/engagement de ressources → fenêtre(s) de réaction éligible(s) → effets restants → fin d'activation → fenêtre légendaire après tour. Counterspell peut annuler les effets en attente, jamais défaire des dégâts déjà acceptés. Après un changement d'état dû à une réponse, revalide l'action restante, notamment cibles, portée et états incapacitants. Avant le début du lancement, un choix en file invalidé peut être remplacé sans dépense ; après ce début, annulation/remboursement suivent la règle sélectionnée. Journaux et narration GM doivent décrire les événements acceptés, pas la suite non exécutée d'une manœuvre tentée.

Plusieurs réacteurs éligibles utilisent une priorité stable définie par les règles, en réévaluant la légalité après chaque réponse acceptée. Ne prends en charge les réactions imbriquées comme contrer Counterspell que via une capacité explicite du ruleset et une pile bornée d'actions en attente. Chaque entrée porte son ID de parent/déclencheur ; une unité peut répondre une fois à un déclencheur donné et doit disposer d'un droit de réaction restant. Ferme les déclencheurs épuisés, annulés ou déjà résolus. Ni récursion illimitée, demandes répétées de passer, dépenses répétées ni chaînes légendaire-vers-légendaire. Un premier adaptateur volontairement limité doit annoncer toute chaîne de réactions non prise en charge plutôt que revendiquer le comportement complet de 5e.

Contrat sauvegardé minimal : ID de rencontre, révision, ID/curseur d'activation, acteur confirmé, type/ID de fenêtre, événement déclencheur et ID d'action en attente/parent, révision du contexte contrôleur, révision des candidats, ordre des réacteurs éligibles/résolus, budgets légendaires et de réaction, variations de ressources réservées/engagées/remboursées, choix/passage accepté, statut de résolution, résultat fournisseur/repli et effets restants. Accepte atomiquement les décisions avec coûts/résultats. Une réponse tardive ou dupliquée ne doit pas dépenser à nouveau. Restaurer reprend la fenêtre en attente ou rejoue son résultat accepté ; branche/retour arrière isole tout le registre de combat, pas seulement la narration. Il n'existe pas de restauration uniquement textuelle remboursant une réaction acceptée. Le registre serveur décrit ci-dessous fournit l'implémentation initiale ; la section 8 conserve le contrat à plus long terme.

Interface : affiche points légendaires restants, disponibilité de réaction et coût de la capacité proposée ; distingue anticipation et réaction déclenchée. Montre pourquoi une action a été interrompue et si le sort original se résout, échoue ou nécessite un nouveau choix. Rends réflexion/attente, nouvelle tentative/repli et annulation accessibles. Annonce les attaques chargées si nécessaire. Ne prétends jamais que le GM a choisi un repli local. Garde scores/prompts internes hors du menu d'actions du joueur.

Preuves requises : sorts/ressources/objets corrects du groupe dans le contexte GM ; prévision avec ressources épuisées ; prédiction plausible mais fausse de Fireball ; aucune fuite de brouillon/commande en file ; aucune multiplication par clic brut/nouvelle sélection ; changement d'action légale par le joueur après anticipation ; chronologie native 5e contre règle maison activée ; Counterspell seulement après déclencheur légal de lancement ; sort faible ignoré contre sort létal contesté ; absence de MP/emplacement/réaction ; coût unique après contre raté ; remboursement du sort original propre aux règles ; visibilité/portée interdite ; plusieurs réacteurs et contres contrés ; aucune fenêtre légendaire supplémentaire pour déplacement/attaque supplémentaire/réaction ; bon emplacement d'initiative Classic ; action manuelle en file invalidée ; unités Tactical sautées/éligibilité des invocations ; budget légendaire épuisé ; renouvellement exactement une fois ; mort/issue pendant l'attente ; requêtes dupliquées ; délai dépassé puis succès tardif ; actualisation, onglets simultanés, branche/retour arrière et changements de réglages. Ajoute comportement avec vrai fournisseur et rythme sur mobile représentatif après les tests déterministes de routes.

## 17. Relais à l'Agent d'environnement de rencontre

La zone de texte **Terrain guidance** (consignes de terrain) et sa ligne récapitulative ont été retirées de la création de partie. D'anciens fichiers de préparation peuvent encore contenir le champ par compatibilité, mais la génération de rencontre ne l'injecte plus dans chaque combat. **Battlefield Size** (taille du champ de bataille) reste une préférence de préparation réutilisable. Les nouveaux combats reçoivent des graines internes individuelles ; cartes sauvegardées et redémarrages conservent les graines acceptées. Le libellé Tactical décrit déplacement, terrain et prévisions sans nommer un autre jeu.

Un futur Agent **Battlefield Scout** devrait s'exécuter pendant la préparation d'une rencontre, avec lieu actuel du joueur, dernière scène/environnement, détails de carte rédigés, météo et événements récents pertinents. Il envoie un bref descriptif environnemental au GM avant la génération de rencontre, pas à la création du monde ni à chaque tour ordinaire.

Frontière :

| Responsable | Travail |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Définition d'Agent, prompt par défaut, exécution du package, catalogue/manifeste, ressources, réglages détenus par cet Agent |
| Marinara Engine, `staging` | Hook de préparation de rencontre, contrat borné d'entrée de scène, livraison validée du résultat d'Agent, routage du fournisseur configuré, cache et repli, provenance du terrain sauvegardée |

Les entrées doivent porter la révision de rencontre/lieu et distinguer faits observés et suggestions incertaines. Sortie : court résumé de l'environnement pris en charge, caractéristiques de terrain bornées utilisant le schéma `TacticalBattlefieldBrief` existant si pertinent, et références sources. Ni règles exécutables, coordonnées arbitraires de cases, ressources inventées, privilèges de boss ni changements de HP. Classic peut recevoir dangers descriptifs/contexte, mais aucun modificateur de grille si son résolveur ne le prend pas en charge.

Le GM reçoit le contexte accepté et produit toujours la rencontre ; l'Engine valide le terrain final. Mets en cache par révision de rencontre/lieu, écarte les réponses périmées après voyage ou changement de scène et évite les appels payants répétés lors de nouvelles tentatives. Si l'Agent est désactivé, absent ou hors délai, utilise le contexte actuel de génération avec le repli habituel de terrain procédural. Persiste le terrain accepté au lieu de le régénérer au rechargement. Ajoute journalisation de débogage des prompts et tests de schéma/délai/lieu périmé. Cet Agent est documenté ici, pas implémenté dans l'Engine ni installé silencieusement.

### Validation consignée pour la première implémentation

La validation locale de base `pnpm check` passe, ainsi que la régression ciblée d'IA de combat, les régressions existantes de route/préparation/moteur hybrid-terrain et `pnpm regression:prompt`. Les tests navigateur ciblés utilisent les véritables routes Classic/Tactical et couvrent sélection de compagnons, commandes manuelles en file, actions automatiques de compagnons, persistance des rounds acceptés et rechargement. Les vérifications préparation/hydratation couvrent suppression des consignes de terrain, graine zéro, types explicites de sorts non anglais et MP explicitement à zéro. Chromium en thème clair sur ordinateur et thème sombre au format Android a réussi ; WebKit n'a pas pu démarrer faute de bibliothèques système requises. Les captures sont des artefacts locaux de test, pas des ressources de documentation commitées.

Un plateau ouvert synthétique de 40 unités, 64×64, mélangeant marche/vol/téléportation et capacités de soutien a pris environ 400–440 ms pour une phase ennemie ordinaire sur cet hôte. Ce n'est ni un budget de pire cas avec obstacles denses ni une mesure sur téléphone physique. Équilibrage et rythme complet des rencontres nécessitent encore des tests en jeu. Ces mesures ne couvrent que le premier jalon ; elles n'établissent ni la latence des fenêtres de boss ni un futur ruleset.


### Validation consignée pour l'implémentation boss/réactions

`pnpm check` et `pnpm regression:prompt` passent. L'avertissement existant sans rapport du hook `GameNarration` reste présent. Les régressions ciblées IA ordinaire, directeur, routes et fournisseur couvrent confirmation d'activation, préservation du tour normal, contres imbriqués, passage, paiement d'un contre raté, MP/emplacements vides, protections de zone, réactions bloquées par un mur, tours désactivés, transactions d'inventaire, commandes dupliquées/périmées, véritable délai strict, limites d'appels par round et identité de point de contrôle/branche. L'adaptateur fournisseur a été exercé contre une fixture HTTP locale, y compris son véritable contexte sortant et le rejet de choix mal formés/inconnus. Cela prouve l'intégration, pas la qualité stratégique d'un modèle payant.

Seize vérifications navigateur Chromium sur ordinateur/mobile passent sur les commandes de compagnons Classic/Tactical anciennes et dirigées, les véritables actions de menu, la fin de round ordinaire, le rechargement d'une réaction en attente, la consommation du dernier emplacement de sort exactement une fois, l'hydratation de capacités générées et le nettoyage de préparation. Les captures ont été inspectées en thèmes clair sur ordinateur et sombre sur mobile ; le panneau de réaction est visible, focalisé et utilisable. Performances sur appareil physique, couverture WebKit courante et qualité/rythme des décisions avec vrai fournisseur restent non vérifiés. La preuve de route étendue exécute aussi le vrai délai de dix secondes et rejette les réponses ultérieures. Cette validation n'a utilisé aucun appel à un modèle de jeu réel. Le mainteneur a ensuite autorisé la revue externe CodeRabbit dans le workflow attendu du projet ; la première revue locale s'est terminée avec 15 constats.


### Suivi de la revue locale CodeRabbit

La première passe a conduit à corriger la consommation d'objets Classic acceptés après nouvelles tentatives/tours sautés, les prévisions de puissance des capacités Tactical, un point d'entrée public IA compatible avec l'ancien comportement, les métadonnées de boss réservées aux ennemis, les requêtes d'état mal formées et coûts de décisions importés, l'absence d'événements automatiques de phase ennemie, la normalisation manquante des MP maximaux, les ID d'unités contrôlées invalides, les menus de capacités uniquement de réaction, le nettoyage des fixtures fournisseur et le partage de résolution des connexions dans la couche service. Le constat sur les objets supposait plusieurs menus d'objets du groupe ; seul le chef en possède actuellement un, mais retirer la référence périmée d'objet corrige un vrai problème de nouvelle tentative abandonnée. La consommation suit maintenant les ordres acceptés et les véritables résultats d'action.

Suggestions examinées mais non appliquées, avec raisons fondées sur le code :

- Les emplacements de sorts n'acceptent volontairement que les niveaux 1–9. Supprimer silencieusement les clés non prises en charge des blueprints générés pourrait masquer des capacités rédigées invalides ; le schéma existant les rejette. Tours de magie et comportement des rulesets nommés appartiennent au contrat distinct de ruleset.
- Les coûts de l'IA ordinaire se rabattent maintenant des MP maximaux sur les MP actuels en l'absence de maximum. La rareté des réactions divise volontairement par les MP **restants** : Counterspell dépensant les derniers points doit être considéré coûteux même si la réserve initiale était grande.
- L'énumération des candidats de boss construit déjà une seule fois sa liste de cases accessibles. Chaque candidat passe toujours le validateur d'action faisant autorité. Retirer les vérifications répétées ou ajouter un cache distinct de validation nécessite des preuves de performance et doit préserver cette frontière ; c'était une suggestion de performance, pas un bug observé d'action illégale.
- `CombatAttackResult` n'a pas de marqueur existant de motif d'échec d'action. Le nouveau résolveur profilé rejette les capacités indisponibles avant exécution et le directeur valide avant paiement. Ajouter un protocole résultat/interface uniquement pour l'ancien repli sans effet est reporté comme amélioration de présentation ; le repli n'applique aucun effet et ne dépense aucune ressource.

La deuxième passe locale complète s'est terminée avec six constats. Ont été corrigés les fusions d'emplacements acceptés et réinitialisations de propriétés périmées dans l'écran Classic autonome ; les profils sont attribués directement à la construction des unités ; la caractérisation GM est extraite des champs de fiche plutôt que de métadonnées sérialisées ; les capacités de réaction sont bloquées dans les deux anciens chemins de commandes ordinaires et la sélection automatique ; les lectures d'état sauvegardé mal formé renvoient une erreur récupérable.

La suggestion restante sur les blueprints ne s'applique pas : `CombatAttack[]` dans les types partagés de rencontre, le prompt de rencontre générée et `combatSkillsFromGeneratedAttacks` exigent tous des objets d'attaque avec un nom. Les entrées uniquement textuelles n'ont pas de comportement d'hydratation pris en charge. Le schéma d'objet reste strict au lieu d'accepter des données inutilisables par l'écran de combat.

Après ces corrections, `pnpm check` et `pnpm regression:prompt` passent. Quatre régressions de combat et celle de la route hybrid-terrain passent, y compris l'extraction réelle du contexte fournisseur avec commentaires/notes d'édition de fiche exclus. Seize vérifications de combat sur ordinateur/mobile ont réussi après les premières corrections ; les huit dernières vérifications navigateur Classic passent aussi avec couverture explicite de nouvelle tentative d'objet, objet sauté et épuisement du dernier emplacement. Une collision de rafraîchissement de build a interrompu une exécution navigateur antérieure ; la nouvelle exécution réussie a eu lieu après la fin du build. La troisième revue a identifié la condition de panneau vide de capacités Classic uniquement de réaction, maintenant corrigée sur les deux présentations. Le chemin correspondant ancien de soin/résolution Tactical rejette aussi les capacités uniquement de réaction. La vérification finale de revue est consignée ci-dessous.


Décisions supplémentaires de revue :

- L'endpoint d'action Tactical route déjà les changements de contrôle par `applyTacticalTurn` et `applyAction` ; `applyAction` rejette l'attribution de l'IA à la première unité vivante du groupe. La régression de route exerce maintenant cette requête et vérifie HTTP 400 avec l'erreur de chef manuel. Dupliquer la même règle dans la route créerait une seconde source de vérité.
- Indices IA et champs d'interruption peuvent être omis. Lorsqu'ils sont fournis, ils doivent respecter leurs schémas explicites. Intercepter et supprimer silencieusement des capacités mal formées transformerait un Counterspell, coût ou ensemble de capacités de boss généré en d'autres règles sans explication. Tolérer des valeurs invalides dans toute capacité facultative serait un changement intentionnel de comportement, pas une garde manquante.
- Un alias exporté `TacticalUnitAction` plus étroit est une suggestion de nettoyage de types. Le traitement du contrôle retourne déjà dans `applyAction` avant validation/exécution ordinaires, et les schémas d'action du directeur excluent le contrôle. Cela ne bloque pas la fonctionnalité ; un futur nettoyage d'API pourrait resserrer cette union interne sans changer le comportement.


La persistance de l'ancien inventaire reste un suivi distinct. La revue a relevé que `GameCombatUI` détache le callback d'inventaire après le résultat d'un ancien round. C'est préexistant dans la révision de base, qui utilise aussi `void onInventoryItemUsed?.(usedItemName)`. L'attendre simplement ne constitue pas une correction idempotente : `handleUseCombatInventoryItem` traite les échecs en interne et les anciens rounds n'ont pas de transaction sauvegardée requête/résultat faisant autorité à réessayer. Les nouveaux combats dirigés contournent ce callback et utilisent la déduction atomique d'inventaire et la sauvegarde d'état accepté du registre serveur. Les anciens combats gardent cette frontière ; migrer ensemble leur persistance de round et d'inventaire exige une migration explicite de compatibilité. Cette limite est documentée, pas prétendue corrigée par les changements de nouvelle tentative d'objet/ordres en file.

Le libellé de disponibilité des réactions utilise maintenant les variantes singulier/pluriel du catalogue de localisation. Les dernières régressions ciblées de combat, types client, lint du workspace et preuve de route de contrôle du chef passent après les petites gardes de réaction ; l'avertissement préexistant du hook `GameNarration` reste présent.


La vérification finale a aussi conduit à des replis déterministes attaque de base/défense pour les unités Classic sans profil sauvegardé ou sans ennemis restants, ainsi qu'à des identifiants bornés d'ordres du groupe qui doivent nommer des combattants vivants du groupe. Leurs régressions ciblées et vérifications de types serveur passent ; la validation de localisation passe pour les pluriels de compte de réactions.

Les suggestions restantes sans effet comportemental sont reportées : dédupliquer les schémas identiques d'emplacements de sorts, renvoyer un ID d'action en attente au lieu de prendre le plus récent immédiatement après déclaration synchrone, resserrer les types internes d'action et remplacer le tri de frontière de téléportation par une recherche du minimum. Le code actuel a des bornes explicites, préserve la validation par action et aucune déclaration intercalée ne survient entre insertion et sélection de cette entrée en attente. Ces suggestions ne démontrent pas un résultat de combat changé. De même, l'ancien temps de recharge 0/omis est temporairement stocké comme 1 puis décrémenté à la fin du même résolveur de round entier ; il est disponible à l'activation suivante. Le directeur utilise un chemin distinct de paiement par activation avec 0 directement. Égaliser ces valeurs intermédiaires n'est pas nécessaire pour une disponibilité identique.


Le changement de cache proposé par la revue suppose que `/director/start` n'est pas idempotent. Il l'est pour un chat/une ancre acceptés : la route sérialisée charge et renvoie le registre existant avant toute création ou paiement, et sa régression vérifie que rejouer start avec des combattants client périmés renvoie exactement la session acceptée. Conserver les rafraîchissements au remontage/à la reconnexion permet au client de voir l'état serveur restauré ou mis à jour. Les désactiver conserverait des combats périmés en cache ; le rafraîchissement explicite reste disponible et les nouvelles tentatives sont désactivées.

La quatrième passe locale s'est terminée avec 15 constats, dont répétitions et nettoyages facultatifs. Sa dernière correction de comportement respecte les indices Mindless explicites pour les catégories autres/inconnues ; la régression ciblée a reproduit l'indice ignoré avant correction. Les profils sauvegardés conservent leur comportement établi. Le plafond proposé de 40 pour la map en attente rejetterait une entrée terminale de pile valide : la déclaration insère d'abord, puis supprime les tâches de réaction supplémentaires lorsque le compte dépasse 40 ; la borne sauvegardée est donc 41. Le rayon de zone 0 signifie volontairement aucune expansion de zone, conformément aux deux résolveurs. Remplacer l'import dynamique hérité du fournisseur par un import statique dans le helper de connexion est un nettoyage facultatif. Aucun résultat de revue sans constats n'est revendiqué ; le suivi préexistant de persistance de l'ancien inventaire ci-dessus reste ouvert.

Vérification finale après toutes les corrections de revue : `pnpm check` passe, y compris localisation, formatage, types, lint et builds de production ; la régression ciblée d'IA de combat passe après démonstration du défaut de l'indice Mindless avant correction. Les résultats précédents prompts, directeur/routes/fournisseur et navigateur ordinateur/mobile restent ceux consignés ci-dessus. Les dernières petites corrections de revue ont été vérifiées localement, puis une autre revue externe a eu lieu pendant la préparation de la PR.


### Revue de préparation de la PR

La responsabilité et le périmètre d'implémentation sont suivis dans [#6299](https://github.com/Pasta-Devs/Marinara-Engine/issues/6299) ; la parité des traductions de ces deux documents de développement est suivie dans [#6300](https://github.com/Pasta-Devs/Marinara-Engine/issues/6300). Le lien symbolique partagé des skills se résout et les 52 fichiers de skills ont été comparés octet par octet à leur contenu Git précédent. `pnpm check` passe après leur déplacement. `AGENTS.md` est une adaptation distincte de `CLAUDE.md` pour Codex, avec passage explicite du brouillon à prêt lorsque implémentation, validation locale requise et revue locale sont terminées.

Décisions de la revue de publication :

- Le skill Impeccable se trouve dans `.agents/skills/impeccable`. La copie `.claude/skills` et son alias `.agents/skills` ont été supprimés le 07/10/2026 ; la garde de projet Impeccable lit le skill depuis `.agents/skills`.
- Les constats sur les exemples Impeccable, la formulation, la provenance du bundle intégré et les internes existants des outils actifs concernent des fichiers déplacés sans modification de contenu. Ce ne sont pas des régressions de cette PR. La migration préserve le skill installé au lieu d'intégrer un projet distinct de maintenance du skill amont.
- La portée d'objet Tactical `any` est explicitement prise en charge par `CombatItemEffect`, la validation de route et les vérifications de cible du directeur. Remplacer toute portée autre que soi/ennemi par `ally` casserait ce comportement pris en charge. La valeur par défaut existante ne s'applique qu'à la portée absente.
- Le calcul anticipé de poursuite est borné et ne change pas l'action légale gagnante. Le rendre paresseux est une optimisation facultative ; la mesure consignée de phase avec déplacements mixtes reste la preuve actuelle, pas l'affirmation qu'aucune optimisation n'est possible.
- Les capacités d'attaque générées sont validées par le schéma de rencontre puis par les schémas start/action du directeur. Remplacer les coûts ou capacités explicites mal formés par des valeurs par défaut pendant l'hydratation modifierait silencieusement des capacités rédigées. Garde les champs absents compatibles et valide les champs fournis, comme documenté ci-dessus.
- La demande répétée de désactiver les rafraîchissements de requête start est rejetée pour les raisons d'idempotence et d'état périmé ci-dessus ; la véritable preuve de répétition de route reste l'élément probant.

La revue de publication s'est terminée avec 34 constats : 30 dans le skill déplacé inchangé et quatre dans le code de combat. Les quatre suggestions de combat sont couvertes par les décisions ci-dessus (poursuite paresseuse, ciblage d'objet `any` pris en charge, rafraîchissements start idempotents et validation explicite des capacités). Aucune autre modification d'implémentation n'était nécessaire à cette passe. Les constats précédemment acceptés restent corrigés et testés. C'est une revue avec décisions documentées, pas une affirmation de zéro constat.

## Suivi de difficulté et de météo

Consulte [Difficulté de combat et météo](game-combat-difficulty-weather.md) pour l'implémentation #6305 : difficulté normalisée, modificateurs de dégâts Traditional réservés aux ennemis, régularité décisionnelle avec graine, météo acceptée dans les deux modes, traits explicites d'attaque, neutralité des expositions abritées/inconnues et conditions fixes à travers les rechargements. Les rulesets alternatifs doivent définir leur propre politique de difficulté avant d'hériter de l'échelle de dégâts.
