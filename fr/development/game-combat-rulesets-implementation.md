# Règles de combat versionnées : transmission pour l'implémentation

> **État au 19 septembre 2026.** L'adaptateur `5e-2014` réservé par ce document est construit comme un type de combat PILOTÉ PAR LES DONNÉES plutôt qu'un adaptateur TypeScript par système : l'ensemble de règles déclare un bloc `combat` facultatif et le moteur possède le type qui le résout, comme il possède les types de résolution des tests. Le raisonnement, l'architecture et les étapes se trouvent dans `game-rulesets-and-sheets-implementation.md` § Real ruleset combat ; le travail est suivi dans l'[issue #6361](https://github.com/Pasta-Devs/Marinara-Engine/issues/6361). Le reste reste valable : l'ensemble de règles Traditional et son comportement de vitesse accepté, le contrat produit, la règle qui attribue la difficulté à l'ensemble de règles sans jamais en faire un multiplicateur de dégâts, le registre unique du directeur contrôlé par le serveur, les fenêtres de réaction et d'actions légendaires, et le contrat de sauvegarde, d'interface et de déploiement.
>
> Depuis C3a le type est RACCORDÉ : il résout un combat dans le registre existant du directeur comme troisième `style` à côté de `classic` et `tactical`, avec les mêmes révision, idempotence, mutex et appel unique au modèle pour choisir un identifiant candidat. Depuis C3b il est À L'ÉCRAN : un ensemble de règles déclarant `combat` joue dans l'interface Classic avec son menu, ses mots et les vrais calculs dans le journal ; les fiches sont enregistrées pendant le combat, pas après. Depuis C4a il possède des POSITIONS : `combat.distance` permet de combattre sur le plateau généré du moteur tactique, avec déplacements, allonges, portées, zones d'explosion, cône et ligne, ligne de vue, couvert et attaques contre quelqu'un qui s'éloigne, tous résolus à partir des nombres de l'ensemble de règles, et un adversaire qui se déplace. Depuis C4b le plateau est À L'ÉCRAN : le terrain du style tactique affiche les cases accessibles et leur coût, les chemins, les personnes provoquées par un pas, les cibles valides et les origines possibles d'une zone, tous issus de la vue du serveur et exprimés dans la distance de l'ensemble de règles. Les réactions et les fenêtres d'actions spéciales restent à venir en C5.
>
> Le champ est dessiné à l'écran depuis C4b. Depuis C5a un TOUR peut faire ce que permet un tour sur table : un coup peut porter une autre clause de dégâts ; une action peut acheter plusieurs attaques ; une capacité peut ne rien coûter, rendre un budget ou permettre d'acheter une action standard avec un autre ; un effet supplémentaire peut s'ajouter au premier coup admissible d'une période ; un état peut modifier les sauvegardes de son porteur, réduire tous les dégâts de moitié, empêcher d'attaquer ou d'approcher celui qui l'a appliqué, compter seulement tant qu'il est visible ou finir quand il tombe. Depuis C5b le combat peut RESTER EN ATTENTE : quitter la portée de quelqu'un arrête le déplacement sur place et lui demande s'il veut frapper, au lieu de le faire à sa place ; l'intervalle entre deux acteurs s'arrête et demande à chaque bloc disposant de points s'il veut acheter l'une de ses actions. Tant qu'une fenêtre est ouverte, rien d'autre ne bouge ; le combat reprend exactement où il s'est arrêté. Depuis C5c une entrée de catalogue indique QUEL moment elle attend : `aimed`, avant qu'une chose touche son porteur, peut l'annuler ; `harmed`, après qu'il a été blessé, vise en retour celui qui l'a blessé. Le coût est payé avant de poser la question : annuler l'action empêche son effet, pas son achat. Les chaînes viendront plus tard : il existe une seule fenêtre, pas une pile, donc un contre ne peut pas être contré à son tour.

Statut : proposition d'implémentation du 17 septembre 2026. La refonte de l'IA n'implémente pas ces règles. Les frappes supplémentaires liées à la vitesse de Traditional sont une orientation produit acceptée ; les seuils et autres valeurs ci-dessous restent des propositions à ajuster. Implémente sur le `staging` actuel après avoir vérifié les travaux liés.

## Contrat produit

Conserve quatre choix indépendants :

| Choix | Ce qu'il contrôle | Exemples |
| --- | --- | --- |
| Présentation | Informations spatiales et saisie | Menus Classic ; grille Tactical |
| Participation | Qui combat | Groupe ; futur Summoning |
| Règles | Actions légales, ressources, déroulement des tours, résolution | Traditional ; 5e explicitement versionné ; V20 |
| Contrôleur | Qui choisit une action légale | Joueur ; IA locale ; boss GM |

Un Cautious Mage doit rester prudent dans les deux présentations. Changer de règles modifie ses possibilités, pas sa personnalité. Summoning est un système de participation, pas un troisième moteur de règles ; sa première présentation peut être non spatiale. Aucun mode ne doit inventer une distance de grille sans modèle de position.

Affiche des descriptions lisibles dans l'interface. Évite les comparaisons avec d'autres jeux dans la description de Traditional ou Tactical. Un ensemble de règles volontairement nommé d'après un système implémenté doit indiquer précisément l'édition et le périmètre pris en charge.

### La difficulté doit appartenir aux règles

Les multiplicateurs actuels de dégâts ennemis de l'Engine, Casual 0,6, Normal 1, Hard 1,3 et Brutal 1,6, sont réservés à Traditional. Réexamine-les pour les règles alternatives : 5e, V20 et les futurs adaptateurs ne doivent pas en hériter automatiquement. Définis la difficulté selon le modèle de rencontre et de résolution propre à chaque système. Sépare le réglage des décisions de l'IA de la modulation arithmétique des dégâts. Ajoute une régression d'adaptateur prouvant que sélectionner d'autres règles n'applique pas silencieusement la table Traditional. Cette note ne renomme pas les anciennes mécaniques actuelles en un système Traditional implémenté.

## Sources actuelles et contraintes

- `packages/shared/src/types/game.ts` : `Combatant`, `CombatSkill`, résultats et instantanés Classic. Les caractéristiques actuelles sont des nombres génériques ; `speed` n'est ni la Dextérité d'un jeu de rôle sur table, ni un mouvement en pieds.
- `packages/server/src/services/game/combat.service.ts` : Classic lance l'initiative à chaque round, résout une commande par participant et utilise des formules génériques de dégâts. Les anciennes parties font transiter l'état par le client ; les nouvelles parties de l'assistant utilisent le registre du directeur de combat détenu par le serveur.
- `packages/shared/src/features/tactical-combat/{engine,math,types}.ts` : phases groupe/ennemis alternées, portée liée à la classe et mouvement dérivé de la vitesse, contre-attaques, sans frappe supplémentaire de vitesse pour l'instant.
- `packages/shared/src/features/combat-ai.ts` et adaptateurs de mode : priorités parmi les actions disponibles. L'IA ordinaire conserve sa limite d'information ; les boss GM reçoivent fiches/ressources du groupe pour anticiper, mais aucun ne voit les jets futurs ou les choix du joueur avant leur déclaration.
- `packages/server/src/routes/combat-director.routes.ts` et `services/game/combat-director.service.ts` : état de rencontre versionné faisant autorité, curseur d'activation, réactions en attente, budgets légendaires et protection contre les réponses dupliquées/périmées. Étends ce circuit d'actions acceptées aux adaptateurs plutôt que de créer un second registre. Chance de Counterspell, paiement des emplacements et coût d'annulation sont actuellement des politiques génériques de l'Engine, pas des règles 5e.
- `packages/server/src/routes/game.routes.ts` : validation ancienne des rounds/démarrages/actions. `GameCombatUI`, `TacticalCombatUI` et `use-game.ts` : saisies, prévisions, résultats acceptés et persistance.
- `GameSurface.tsx` : conversion des plans générés en données utilisables et instantanés de combat. `encounter.routes.ts` : prompt de génération des rencontres. `game-setup-share.ts` : import/export réutilisable des configurations.

Ne renomme pas la formule actuelle de dégâts en Traditional sans implémenter et vérifier le comportement de vitesse accepté. Ne présente pas un d20 accompagné des caractéristiques actuelles de l'Engine comme une conformité à 5e.

## Architecture minimale

Commence par un registre fermé d'adaptateurs intégrés, purs, en TypeScript. N'ajoute ni langage de script ni paquets de règles exécutables arbitraires. Réutilise les types d'actions légales et de résultats existants ; extrais une fonction commune seulement lorsque les deux appelants en ont besoin.

Enregistre une référence figée sur chaque nouvelle rencontre :

```ts
type RulesetRef = {
  id: "engine-legacy" | "traditional" | "5e-2014" | "v20";
  version: number;
  options: Record<string, boolean | number | string>;
};
```

Chaque adaptateur valide son schéma fermé d'options, au lieu d'accepter librement l'objet d'exemple. Inclus une liste des capacités prises en charge : mouvement, contre-attaque, emplacements de sorts, dépense de sang, invocations, réactions des boss. Refuse une option explicite non prise en charge avec une erreur utile. L'absence de données de règles signifie `engine-legacy`, jamais une migration automatique vers Traditional.

Une petite interface doit couvrir :

1. Valider/normaliser une fiche propre aux règles sans deviner de conversions.
2. Démarrer une rencontre et lancer ou établir l'ordre une fois, au moment défini par les règles.
3. Commencer une activation : renouveler les budgets autorisés, faire progresser les états appropriés.
4. Énumérer actions légales et réactions facultatives, ensembles de cibles, portée, coût et fenêtre temporelle, y compris passer.
5. Produire une prévision en lecture seule sans consommer le générateur aléatoire.
6. Accepter une déclaration d'action, enregistrer son engagement de ressources et exposer les fenêtres de déclenchement prises en charge avant les effets.
7. Résoudre effets/réactions en attente en événements ordonnés et variations de ressources ; exposer les fenêtres de boss au début/après l'activation uniquement si elles sont activées.
8. Terminer le round lorsque ses participants ont tous agi ; faire progresser une seule fois les effets limités au round.

Le même adaptateur alimente saisie du joueur, IA ordinaire, menus de candidats GM et prévisions. Le GM ne peut fournir ni HP finaux, ni identifiants de capacité inventés, ni nouvel ordre, ni changements gratuits de ressources. La légalité utilise l'état accepté ; les contextes de décision exposent l'information adaptée au contrôleur et à la fenêtre. Les boss GM connaissent capacités, points/emplacements de sorts, délais de récupération et inventaire utilisable du groupe pour prévoir les menaces. Sélections non validées et autres actions en file restent privées jusqu'à leur déclaration. Une prévision donne des valeurs attendues, pas les futurs résultats des dés.

Conserve les fiches propres aux règles dans une union discriminée. Ne ramène pas toutes les ressources à `mp` : MP, nombres d'emplacements, Blood Pool, Willpower, dépenses par round et utilisations par repos ont des sens différents. Barres d'interface et coûts lisent les descripteurs de l'adaptateur choisi. Sépare ressources actuelles et maximales ; normalise les noms uniquement pour l'affichage, jamais pour leur identité.

## Traditional v1 : comportement de vitesse accepté

**Chaque participant vivant et éligible obtient au plus une activation ordinaire et une ouverture de combat par round. Une frappe supplémentaire de vitesse appartient au même échange, ce n'est pas une nouvelle activation.**

Équilibrage initial proposé :

| Règle | Comportement v1 proposé |
| --- | --- |
| Initiative | Vitesse effective décroissante, ordre stable de rencontre en cas d'égalité ; aucune activation supplémentaire pour égalité ou vitesse élevée |
| Déroulement Tactical | Phase du groupe puis ennemis ; le joueur choisit les unités n'ayant pas agi, les unités automatiques suivent la vitesse |
| Déroulement Classic | Ordre commun par vitesse effective décroissante ; l'interface met les commandes manuelles en file puis résout les cibles légales actuelles à chaque position |
| Mouvement | Budget explicite indépendant de la vitesse. Valeur proposée : 4 cases avec ajustements bornés de classe/capacité |
| Vitesse d'attaque | Vitesse effective avec seulement les pénalités/bonus explicitement modélisés ; aucun poids d'arme fictif |
| Seuil de frappe supplémentaire | Vitesse d'attaque de l'attaquant au moins égale à celle du défenseur + 5 ; configurable uniquement par une option de règles validée |
| Action éligible | Attaque de base ou capacité explicitement marquée `allowsSpeedFollowUp` ; faux par défaut pour les capacités |
| Échange | Frappe de l'initiateur → contre-attaque légale du défenseur survivant → frappe supplémentaire éligible de l'initiateur survivant |
| Défenseur plus rapide | Une contre-attaque légale en v1 ; sa frappe supplémentaire est une option d'équilibrage distincte, désactivée par défaut |
| MP | Réserve explicite et coût par capacité, déduit une fois par activation choisie ; la capacité doit préciser le coût des frappes supplémentaires |
| Renouvellement du mouvement | Une fois à l'activation ordinaire suivante ; contre-attaque/frappe supplémentaire ne le renouvellent jamais |

Le seuil de 5 et l'ordre des échanges sont des propositions de Marinara, sans prétendre reproduire les règles d'un jeu particulier. Le mainteneur a demandé que l'unité attaquante plus rapide frappe deux fois ; doubler en défense n'est pas exigé.

Revérifie entre les frappes l'état vivant, la validité des cibles, la portée, les états incapacitants et les budgets restants. Une unité tuée par la contre-attaque ne peut refrapper. Rater la première frappe n'annule pas à lui seul celle liée à la vitesse. Une cible vaincue ne peut être frappée à nouveau ni remplacée silencieusement dans le même échange. Empêche les contre-attaques récursives. Une contre-attaque ne dépense pas l'ouverture ordinaire du défenseur et n'en accorde pas une autre. Soin, amélioration, objet, invocation et action légendaire ne doublent pas sans exception explicite d'une capacité prise en charge.

Calcule l'éligibilité à partir des caractéristiques effectives acceptées au début de l'échange ; applique immédiatement les effets incapacitants intermédiaires, mais n'ajoute pas rétroactivement des frappes après une amélioration de vitesse pendant l'échange. Inscris le résultat dans la liste d'événements, avec une prévision d'une ou deux frappes et de la possibilité de contre-attaque. Recharger pendant une animation rejoue les événements acceptés sans relancer les dés ni payer deux fois.

Classic n'a pas de portée de déplacement : omets le mouvement ou fournis un modèle d'engagement défini séparément. Les contre-attaques Traditional dans Classic exigent une règle explicite `canCounter` ; ne transpose pas les distances de grille aux positions d'un tableau. Pour v1, garde-les désactivées jusqu'à la définition d'un engagement de base mêlée/distance, tout en conservant les frappes supplémentaires de vitesse de l'attaquant.

## Profil 5e : nommer l'édition avant de coder

Première cible recommandée : `5e-2014`, figée sur SRD 5.1. Un futur profil 2024/SRD 5.2 exige son identifiant/version et ses tests ; ne mélange pas silencieusement les éditions. L'[index officiel des SRD](https://www.dndbeyond.com/srd) publie les versions et [SRD 5.1](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) est la référence primaire initiale.

Examine la source primaire avant d'implémenter : initiative fondée sur la Dextérité ; mouvement en distance ; disponibilité d'action, d'action bonus et de réaction ; emplacements de sorts ; concentration et états ; jets d'attaque et de sauvegarde distincts. Cela exige champs de fiche et scénarios de résolution dédiés. Niveau/attaque/défense génériques de l'Engine ne peuvent les remplacer. Les points de sorts constituent une variante explicitement choisie, avec source examinée et limites propres, pas une réserve d'emplacements renommée.

Livre d'abord un sous-ensemble décrit honnêtement, par exemple attaques d'armes simples, mouvement, Dodge et petite liste de sorts, en rendant indisponibles les actions non prises en charge. Une formule d'initiative ne suffit pas à annoncer 5e complet. Garde le doublement Traditional désactivé ; les attaques supplémentaires proviennent seulement des capacités implémentées du profil.

## Profil V20 : examen dédié requis

Cible Vampire: The Masquerade 20th Anniversary Edition, ni V5 ni V20 Dark Ages. Obtiens la bonne source primaire avant de coder précisément initiative, ordre de déclaration, actions multiples, Celerity, dégâts/absorption, pénalités de blessure et limites de dépense. Cette transmission n'approuve aucune formule exacte de V20.

Réserve une fiche propre aux règles pour Attributes/Abilities, niveaux de santé, Blood Pool et Willpower, avec contraintes de dépense par tour lorsqu'elles sont prises en charge. Ne convertis ni Blood Pool en MP génériques ni Celerity en doublement de vitesse Traditional. Les tests doivent citer l'édition et le passage utilisé ; une réponse de forum ou un aperçu Dark Ages ne suffit pas pour V20 moderne. Vérifie réutilisation et attribution dans la source réellement choisie avant de distribuer du texte ou des blocs de caractéristiques copiés ; ce document n'en fournit aucun.

## Actions légendaires, anticipation et réactions

Orientation acceptée : les boss GM peuvent avoir des actions légendaires sous Traditional ou d'autres règles non 5e. C'est un **modificateur explicite de rencontre de boss**, indépendant de l'initiative ordinaire, du tempérament et de la participation. Consulte la section des boss du document de conception de l'IA.

L'adaptateur expose `afterActivation` ; un modificateur d'anticipation Marinara activé peut aussi exposer `activationStarted` une fois qu'un acteur s'engage à commencer son tour. Les deux fenêtres dépensent la **même** réserve finie du boss. Clics simples, inspection, menus annulés et rechargements n'ouvrent pas de fenêtres supplémentaires. Le GM peut prédire Fireball à partir des capacités/ressources disponibles du mage et des vraies règles de zone/tir allié avant la déclaration du joueur ; il ne peut lire une future commande. Cette anticipation est une règle maison étendant le moment après-tour de 5e, explicitement figée sur la rencontre. Un profil fidèle conserve le moment natif sauf activation du modificateur.

L'unique ouverture de Traditional concerne les activations ordinaires ; une action légendaire définie n'accorde ni activation ordinaire ni frappe supplémentaire de vitesse. Classic doit suspendre à la position d'initiative de l'acteur, sans interruption anticipée pendant la collecte des ordres d'un round entier. Revalide les commandes en file après interruption et demande un remplacement si elles deviennent illégales avant engagement. Tactical exige un engagement distinct au début de l'activation, afin que consulter les unités soit sans risque et que les resélections ne multiplient pas les interruptions.

Les réactions comme Counterspell relèvent de **déclencheurs d'événements** pris en charge, indépendamment du statut légendaire. Définis au moins événement, moment avant/après effet, visibilité/portée, coût, réserve/renouvellement de réaction, résultat et annulation/remboursement de l'action d'origine. GM des boss et IA ordinaire utilisent les mêmes fenêtres légales ; les unités manuelles choisissent React/Pass. L'IA évalue automatiquement la fenêtre et peut passer selon tempérament, valeur de menace, réussite estimée, rareté des MP/emplacements et coût de perdre sa réaction. La disponibilité seule ne force jamais la dépense. Une unité ordinaire peut réagir sans devenir boss.

Counterspell exige un lancement de sort en attente, pas seulement un mage sélectionné. Sépare ressources MP/points/emplacements. Le [sort de 2014](https://www.dndbeyond.com/spells/2051-counterspell) utilise niveau de sort/tests, alors que le [sort de 2024](https://www.dndbeyond.com/spells/2619072-counterspell) utilise une sauvegarde de Constitution et précise qu'un sort à emplacement interrompu avec succès ne dépense pas cet emplacement. N'étends pas ce remboursement de 2024 à toutes les éditions ni au paiement du lanceur de Counterspell. Traditional exige une opération d'interruption explicitement réglée ; V20 doit mapper ses propres capacités réactives au lieu d'hériter de Counterspell par son nom.

Réserve et engage les ressources atomiquement avec déclarations/réactions acceptées, en enregistrant séparément les remboursements propres aux règles. Proposition Traditional : une réaction initialement disponible sauf condition explicite de rencontre, renouvelée au début de l'activation ordinaire de l'unité. Les autres adaptateurs définissent leur réserve et son renouvellement. Actions légendaires et frappes supplémentaires ne la renouvellent jamais implicitement. Sépare les contre-attaques d'échange existantes sauf correspondance explicite. Si une option légendaire lance un sort, expose les réactions seulement dans la mesure permise par les règles choisies.

Utilise une pile bornée et sauvegardée d'actions en attente, avec identifiants parents/déclencheurs pour les réactions imbriquées prises en charge, priorité stable des réacteurs et revalidation après chaque réponse. Un sort déjà annulé ne peut être contré à nouveau. Passer ferme l'occasion de cette unité pour ce déclencheur. Un adaptateur limité doit signaler les chaînes de contre-réactions non prises en charge. Résous une seule fois les événements acceptés et déduis-en la narration ; l'interruption textuelle réversible de [PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) est un précédent de persistance/contexte, pas une autorisation d'annuler le combat en tronquant la prose. Voir la section 16 de la conception IA pour le cycle complet et la matrice d'acceptation.

## Contrat de sauvegarde, d'interface et de déploiement

- Fige dans l'instantané de rencontre identifiant/version/options effectives des règles, contrôleurs, fiches, ordre initial, activation actuelle/engagée, budgets légendaires/de réaction et renouvellements, pile d'actions en attente, identifiants de déclencheur/décision, engagements/remboursements, délais de récupération, état aléatoire et interruptions acceptées.
- Exige un registre de révisions/actions détenu par le serveur avant les décisions GM asynchrones. Refuse les soumissions concurrentes périmées et rends les relances idempotentes. Un identifiant de candidat stocké dans le navigateur ne suffit pas.
- Les changements de réglages s'appliquent à la rencontre suivante. Préserve les règles figées du combat actif, y compris après importation, restauration de point de contrôle/branche, reconnexion et mise à jour.
- Garde les anciens combats en cours sur `engine-legacy`. Propose une conversion explicite pour un futur combat avec aperçu des caractéristiques/ressources sans correspondance ; n'écrase jamais silencieusement fiches ou réserves enregistrées.
- Les versions inconnues sont en lecture seule/récupérables, sans interprétation silencieuse comme la dernière version.
- Ajoute un sélecteur localisé **Combat rules** (règles de combat), distinct de **Combat presentation** (présentation du combat) et du futur **Participation** (participation). Décris brièvement ordre, ressources et comportements clés ; affiche les limites de compatibilité avant le démarrage.
- Demande les champs de fiche obligatoires manquants avant le combat ; n'utilise les anciennes règles que sur sélection explicite. Ne laisse pas la génération fabriquer des caractéristiques faisant autorité.

## Ordre d'implémentation et preuves de sortie

| Étape | Travail | Plus petite preuve utile |
| --- | --- | --- |
| 1 | Inventorier les résolveurs, définir identité figée et adaptateur ancien | Anciennes sauvegardes et deux présentations reproduisent leur comportement antérieur |
| 2 | Implémenter activation/échange Traditional et ressources explicites | Matrice des seuils de vitesse ; une ouverture/round ; comptabilisation MP et délais |
| 3 | Relier prévisions, sélection d'interface et événements acceptés sauvegardés | Accord prévision/résolution ; tests de recharge/import/point de contrôle ; captures ordinateur/mobile |
| 4 | Ajouter séparation déclaration/effet, réactions facultatives, anticipation des boss et fenêtres après-tour | Pas de multiplication par sélection ni de fuite des commandes futures ; l'IA peut passer ; coûts/renouvellements/remboursements corrects ; aucun tour ordinaire supplémentaire ou doublement |
| 5 | Implémenter un sous-ensemble déclaré de 5e-2014 depuis les sources primaires | Exemples positifs/négatifs propres à l'édition pour chaque action prise en charge |
| 6 | Examiner et implémenter un sous-ensemble déclaré de V20 | Exemples vérifiés d'initiative, limites de ressources et dégâts ; aucune arithmétique 5e/Traditional accidentelle |
| 7 | Adapter budgets et propriété des commandes de Summoning | Apparition/renvoi/mort, plafond de population et aucune multiplication d'actions par invocation |

Cas d'acceptation Traditional : écart de vitesse 4 contre 5 ; vitesses égales ; contre-attaque tuant l'attaquant ; première frappe tuant la cible ; première frappe ratée ; incapacité pendant l'échange ; contre-attaque distante indisponible ; délai/MP insuffisants ; légalité identique joueur/IA/GM ; deux unités rapides ouvrent chacune une seule fois ; une action légendaire ne réinitialise pas ces marqueurs ; renouvellement du round une seule fois ; échec sûr d'une version inconnue.

Cas réaction/anticipation : sélection d'acteur contre activation engagée ; resélection/rechargement ; position Classic exacte ; menace Fireball payable contre mage épuisé ; prédiction pouvant être fausse ; passer un sort faible contre contrer une menace importante ; réaction/MP/emplacement insuffisants ; contre raté toujours payé ; remboursement du sort initial selon l'édition ; déclencheur hors portée/invisible ; plusieurs réacteurs ; contre imbriqué pris en charge et limites de pile ; réponse périmée après mort de cible ; revalidation du choix interrompu en file ; moment natif contre règle maison ; aucune commande cachée en file ni futur aléatoire dans les prompts des contrôleurs.

Exécute `pnpm install`, `pnpm check`, les preuves ciblées `*.regression.ts`, les régressions de prompts lors de changements des prompts GM/schémas et les tests rapides d'interface des deux présentations. Suis le processus issue/PR et inclus textes localisés, changelog, suivi de traduction et CodeRabbit avant revue. Laisse décochées les cases de vérification manuelle du PR.
