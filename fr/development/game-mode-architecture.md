# Architecture de Game Mode : ensembles de règles, tests et combat

Voici les repères pour quiconque s'apprête à modifier le code des règles de Game Mode : où un ensemble de règles est lu, comment un test et un combat sont résolus, où l'état est conservé et ce qu'exige une nouvelle clé d'ensemble de règles. La documentation des joueurs se trouve dans `docs/game/`, le guide de l'auteur d'ensembles de règles commence à [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md), et l'IA de combat a sa propre page, [IA de combat de Game Mode](game-combat-ai.md).

## Où se trouvent les éléments

| Domaine | Code |
| --- | --- |
| Le format des ensembles de règles | `packages/shared/src/schemas/ruleset.schema.ts` : le schéma zod, `RulesetRef` (l'épinglage) et les vérifications croisées exécutées à l'importation. Le schéma JSON pour l'éditeur, `docs/extending/ruleset.schema.json`, en est généré avec `pnpm ruleset:schema`. |
| API de capacités | `supportedCapabilityApi` dans `packages/shared/src/schemas/capability-package.schema.ts`, avec une ligne de commentaire par version mineure décrivant ses ajouts. |
| Calculs de fiche et état vivant | `packages/shared/src/features/rulesets/` : `sheet-math.ts`, `live-state.ts` (les opérations `[sheet:]`), `sheet-commands.ts`, `sheet-builder.ts`, `layers.ts`, `item-*.ts`, `loot.ts`, `market.ts`, `combat-bridge.ts` (le bloc `battle`). |
| Combats des ensembles de règles | `packages/shared/src/features/ruleset-combat/` : `resolve.ts`, `options.ts` (le contenu du menu), `grid.ts`, `sight.ts`, `zones.ts`, `creatures.ts`, `pool.ts`, `symbols.ts`, `dice.ts`. Tous sont purs et opèrent sur `(definition, state)`. |
| Combat propre à Marinara | `packages/shared/src/features/tactical-combat/` (moteur Tactical, génération de grille, IA), `combat-director.ts`, `combat-conditions.ts`. |
| IA de combat | `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts` ; consulte [IA de combat de Game Mode](game-combat-ai.md). |
| Serveur : ensembles de règles | `packages/server/src/services/game/ruleset-registry.service.ts` (lit les ensembles de règles installés et importés, résout l'épinglage d'une partie), `ruleset-catalog.service.ts`, `ruleset-sheet-turn.service.ts` (applique les commandes `[sheet:]` d'un tour), `game-ruleset-version.service.ts`, `routes/game-rulesets.routes.ts`. |
| Serveur : tests et dés | `skill-check-resolution.service.ts`, `skill-check.service.ts`, `dice.service.ts`, `dice-pool.service.ts`, `one-request-dice.ts`, `dice-rng.ts`. |
| Serveur : combats | `combat-director.service.ts` (Classic et Tactical), `combat.service.ts` (les calculs de round Classic, `resolveCombatRound`), `ruleset-combat-director.service.ts` (un combat résolu par l'ensemble de règles), `combat-ai.service.ts`, `combat-boss.service.ts`, `tactical-battlefield.service.ts`, `made-battlefield.service.ts`. Routes : `routes/combat-director.routes.ts` (démarrage, état et commande du directeur), `routes/encounter.routes.ts`, ainsi que les anciennes routes `POST /game/combat/round`, `/game/combat/tactical/start` et `/game/combat/tactical/action` dans `routes/game.routes.ts`. |
| Prompt | `gm-prompts.ts` (`buildGmFormatReminder`, les blocs de fiche et les balises enseignées). |
| Client | `packages/client/src/components/game/` : `GameRulesetSheet.tsx`, `GameSetupRulesChooser.tsx`, `RulesetCombatScreen.tsx` et les autres `RulesetCombat*.tsx`, `TacticalCombatUI.tsx`, `GameCombatUI.tsx`, `DirectedCombatUI.tsx`. |

## Un ensemble de règles, du package à la partie

1. **Source.** Un ensemble de règles officiel est un package de capacités de type `ruleset` qui liste `ruleset.json` (et les éventuels `catalogs/<id>.json`) dans `contributions.assets.paths`, épinglés par leur empreinte dans `files[]`. Un ensemble de règles communautaire est importé sous forme d'un fichier unique, d'un fichier de package `<name>.ruleset.json`, ou depuis le dossier `rulesets/` d'un dépôt, et est stocké sous un identifiant doté d'un espace de noms (`local/<id>`, `<owner>/<id>`) afin de ne jamais pouvoir masquer un ensemble officiel.
2. **Langue.** Les traductions d'un ensemble de règles officiel sont des packs par langue listés dans son entrée de catalogue ; le gestionnaire de packages ne conserve que la langue du moteur (`syncRulesetLocalePack` dans `package-manager.service.ts`). Un fichier de package importé ne conserve que la langue active à l'importation.
3. **Registre.** `ruleset-registry.service.ts` analyse chaque définition avec le schéma partagé et écarte toute définition inutilisable en l'indiquant dans une ligne de log. Les définitions sont stockées par identifiant et version ; une même version dont les octets diffèrent est refusée.
4. **L'épinglage.** La création d'une partie écrit `chat.metadata.gameRuleset` une seule fois : `{ id, version, packageId, source?, options }`, où `options` contient les couches choisies. Sans épinglage, les règles propres à Marinara s'appliquent. Un épinglage que cette installation ne peut pas respecter (ensemble absent ou plus ancien que la version épinglée) est signalé et les tests de la partie restent à résoudre ; ils ne sont jamais résolus selon les règles d'un autre système.

## État

| Partie | Contenu | Emplacement | Retour arrière avec les swipes |
| --- | --- | --- | --- |
| Configuration de départ | La fiche qu'un joueur remplit sur une fiche de personnage ou un persona | `data.extensions.rulesetSheets[rulesetId]` de la fiche de personnage, `personaStats.rulesetSheets[rulesetId]` du persona | sans objet |
| Configuration de partie | Une copie prise à la configuration, modifiée par **Edit sheet** (modifier la fiche) et les montées de niveau | `chat.metadata.gameCharacterCards[].rulesetSheet` | Non |
| État vivant | Réserves, pistes, états, statuts, notes | `game_state_snapshots.ruleset_live` | Oui |
| Un combat | La rencontre, sa graine et son curseur de dés, le tour en cours | La ligne de stockage du directeur de combat, une par chat | Restauré avec le tour qui l'a commencé |

L'état vivant appartient à l'instantané pour qu'un tour régénéré ne dépense jamais deux fois. Une fiche stockée est `{ v, build }`, limitée à 64 KB et lue avec tolérance : les champs inconnus sont conservés et les champs manquants prennent les valeurs par défaut. Une disposition qui déplace des valeurs vers de nouveaux identifiants déclare `sheet.migrations`, appliquées à la lecture par `readRulesetSheetEnvelope` et `readStoredLiveState`. La fiche d'un ensemble de règles qui n'est pas installé est conservée en sommeil, jamais supprimée.

## Un test, de bout en bout

1. Le GM écrit `[skill_check: …]`, éventuellement avec `who=`, `with=`, un nom d'étape d'échelle, un charme ou une dépense. Avec les dés en une seule requête activés, il peut écrire à la place un bloc de branches ou un espace réservé `[[roll: …]]` (`one-request-dice.ts`).
2. `skill-check-resolution.service.ts` lit l'ensemble de règles épinglé et répartit le traitement selon `resolution.kind` : `dice-sum`, `dice-pool`, `dice-highest`, `roll-against` ou `symbol-pool`. Les nombres écrits par le modèle sont vérifiés et remplacés, sauf si l'ensemble de règles les cautionne ; les réserves, les dés conservés et les résultats par tranches ne sont jamais cautionnés.
3. Dés : un test lance les dés avec `rollDieSecurely` (Web Crypto, dans `packages/shared/src/utils/dice-notation.ts`). Un combat d'ensemble de règles, ses utilisations d'objets, son butin et ses marchés lancent les dés avec `seededDieRoller(seed, cursor)` du même module, afin qu'un combat puisse être rejoué à partir de sa graine. Depuis #8608, il n'y a aucun autre mécanisme de lancer de dés.
4. Le résultat est réécrit sous forme d'une balise complète et d'une carte de dés, et enregistré dans **Logs** (journaux).

## Commandes de fiche

Le GM modifie une fiche avec `[sheet: who="Name" op="…"]`. Les opérations qu'une balise peut spécifier sont `spend`, `restore` (alias `heal`), `damage`, `temp`, `track`, `condition`, `state`, `note`, `rest`, `use` (alias `cast`), `pass`, `advance`, `dismiss`, `prepare` et `unprepare` (`RULESET_SHEET_OP_NAMES` et `RulesetSheetOp` dans `live-state.ts`). `ruleset-sheet-turn.service.ts` valide chacune par rapport à la fiche vivante ; une opération impossible, comme le lancement d'un sort sans emplacement restant, est refusée, consignée dans les journaux et signalée une fois par tour, et rien n'est partiellement appliqué. `sheet` est une balise réservée au GM.

## Un combat, de bout en bout

Un combat d'une partie se joue selon l'un des trois styles, choisi par l'ensemble de règles et le réglage **Combat Preference** (préférence de combat) de la partie :

| Ensemble de règles | Style | Serveur |
| --- | --- | --- |
| Aucun, ou aucun bloc `battle`/`combat` | Combat Classic ou Tactical de Marinara | `combat-director.service.ts` |
| Bloc `battle` | Combat de Marinara, auquel sont prêtés les réserves, emplacements et compétences de catalogue de la fiche ; santé transférée en proportion du maximum, puis réécrite sur la fiche | `combat-director.service.ts` avec `combat-bridge.ts` |
| Bloc `combat` | Combat propre à l'ensemble de règles, sur un plateau lorsque `combat` donne la distance d'une case et que la partie est en Tactical | `ruleset-combat-director.service.ts` |

Tous trois partagent le registre du directeur : une ligne de stockage par chat, une révision, une protection par identifiant de requête et une file d'attente par chat. Le registre ne couvre que les combats gérés par le directeur. Les anciennes routes de `game.routes.ts`, `POST /game/combat/round` (qui appelle `resolveCombatRound` sur les combattants qui lui sont envoyés), `/game/combat/tactical/start` et `/game/combat/tactical/action`, ne tiennent aucun registre : le client conserve l'état du combat et le renvoie à chaque appel. Dans un combat d'ensemble de règles, le menu décide de la légalité (`options.ts`), le résolveur applique un choix (`resolve.ts`), les dés proviennent de la graine et du curseur du combat, et tout ce qu'un membre de l'équipe dépense ou perd est écrit selon les règles propres à la fiche ; fermer l'onglet en plein combat ne fait donc rien perdre. Les adversaires que personne n'a définis sont construits à partir du bestiaire et du budget de rencontre de l'ensemble de règles ; le GM peut jouer les adversaires nommés et les boss, en choisissant parmi les suggestions classées du moteur.

## Ajouter une clé d'ensemble de règles

1. Ajoute-la à `ruleset.schema.ts`, avec ses vérifications croisées, et aux types TypeScript que le résolveur lit.
2. Augmente `supportedCapabilityApi` d'une version mineure et ajoute sa ligne de commentaire. Soumets la clé à une exigence de version afin qu'un ensemble de règles qui l'utilise doive déclarer cette version mineure ou une plus récente.
3. Implémente-la d'abord dans le code partagé pur, puis raccorde le serveur, puis le client.
4. Exécute `pnpm ruleset:schema` pour régénérer `docs/extending/ruleset.schema.json`.
5. Documente-la sur la page correspondante du guide de l'auteur (`docs/extending/ruleset-*.md`), et dans la documentation des joueurs si elle leur sera visible.
6. Ajoute un fichier `scripts/regressions/*.regression.ts` qui la fait passer par le code pur, avec notamment une entrée refusée.
7. Liste les pages anglaises modifiées dans l'issue `[docs-i18n]` ouverte.

`docs/development/ruleset-5e-2014.example.json` est une ébauche 5e allégée que des centaines de tests de régression et de tests de bout en bout lisent comme jeu de données de test. Ce n'est pas le package SRD distribué, qui se trouve dans Marinara-Agents sous `packages/ruleset-5e-2014/`.

## Travaux en cours

- Survoler les obstacles sur un plateau d'ensemble de règles : une créature volante est déplacée comme n'importe qui d'autre.
- L'invocation dans les combats Classic et Tactical propres à Marinara (les combats des ensembles de règles invoquent déjà). La conception se trouve dans [IA de combat de Game Mode](game-combat-ai.md#summoning-design-extension).
- Un agent Battlefield Scout qui prépare le descriptif du terrain d'un combat, décrit dans [IA de combat de Game Mode](game-combat-ai.md#encounter-environment-agent-handoff).
