# Combat des ensembles de règles

Cette page fait partie du guide [Écrire des ensembles de règles Game Mode](writing-rulesets.md). Comment un ensemble de règles intervient dans un combat : le bloc `battle`, qui prête la fiche au combat de Marinara, et le bloc `combat`, qui résout l'intégralité du combat selon les règles propres à l'ensemble, avec son bestiaire, son plateau, ses réactions et ses confrontations.

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## Batailles : prêter la fiche au combat de Marinara

Par défaut, une bataille ignore la fiche. Elle construit les combattants comme toujours ; un personnage peut sortir du combat sans changement de ses points de vie sur la fiche.

Le bloc facultatif `battle` change cela dans un seul sens : il prête les nombres au combat et réécrit son résultat. **Il ne fait pas suivre tes règles au combat.** Les calculs, les coups qui touchent et leurs dégâts restent ceux de Marinara. La santé est donc transférée comme proportion du maximum, pas comme ton nombre : une fiche à moitié de sa santé commence à mi-barre de celle construite par Marinara. Ta réserve de 9 points n'est jamais placée directement dans une bataille où un coup fait 12.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health` : obligatoire. Réserve vivante représentant les points de vie en combat. Elle doit appartenir à `sheet.live.pools`, pas être une liste dont les lignes sont des réserves.
- `energy` : facultatif. Réserve dépensable par la bataille, qui devient la barre MP. Elle doit différer de `health` : le combat ne peut pas consommer la santé comme énergie.
- `slots` : facultatif. Réserves dépensées une unité à la fois, chacune avec `level` de 1 à 9 : `[{ "pool": "slots_1", "level": 1 }]`. Chaque niveau et chaque réserve ne sont utilisés qu'une fois.
- `skills` : facultatif, jusqu'à huit. Listes dont les lignes deviennent des compétences de combat. Seules comptent les lignes issues de tes catalogues et dont l'entrée porte `mechanics` : une ligne saisie à la main n'exprime rien numériquement. `onlyWhen` nomme une colonne booléenne qui doit être active, comme un sort préparé. `alwaysWhen` nomme une colonne et une valeur qui laissent passer malgré tout, comme un sort sans préparation. C'est l'exception à `onlyWhen`, donc elle est refusée sans lui.

### Ce qui entre et ce qui revient

**À l'entrée**, pour chaque membre dont la partie possède la fiche : la proportion de santé fixe le début sur la barre Marinara ; l'énergie devient MP ; chaque réserve d'emplacements devient ceux de ce niveau ; les lignes marquées deviennent des compétences. Santé maximale, attaque, défense, vitesse et niveau restent les nombres de Marinara. Une réserve de santé à zéro fait commencer à terre ; au-dessus de zéro, le personnage commence toujours avec au moins un point, pour qu'une petite proportion ne le fasse pas tomber par arrondi.

**À la sortie**, quand le combat est terminé : la proportion finale de la barre est convertie à l'échelle de la réserve, et la différence avec le début est appliquée en dégâts ou soins. Énergie et emplacements sont des comptes, pas des proportions ; ils reviennent tels quels. Tout suit les règles des boutons de la fiche ; un changement refusé est ignoré et signalé, pas forcé. Un combat sans changement de santé n'en écrit aucun, pour que les deux conversions ne puissent pas déplacer la fiche à elles seules.

**Dans aucun sens** : jets d'attaque, sauvegardes, concentration et effets d'un coût supérieur. Ils figurent dans `mechanics` pour être lus un jour par un véritable système de combat ; ce pont ne les applique pas et l'ensemble ne doit pas prétendre le contraire.

Une bataille abandonnée ne réécrit rien. Si tu supprimes le message de départ ou si elle ne finit jamais, la fiche reste identique : le combat n'a pas eu lieu.

### Comment une entrée devient une compétence

Le bloc `mechanics` est lu ainsi :

- `kind` devient le type de compétence. Les entrées `utility` et celles marquées `reaction` sont omises, car le combat Marinara n'a pas où les placer.
- `amount` fixe la puissance comme multiplicateur de l'attaque du combattant, pas comme nombre de dégâts. Des dés plus grands ne frappent jamais moins fort ; le multiplicateur reste dans la plage des compétences générées.
- `range` et `area.size` sont divisés par `units.distance.perCell` du catalogue pour obtenir des cases, sans jamais arrondir à zéro. Une explosion prend son rayon, un cône la moitié et une ligne une case. Une zone cible tous les ennemis couverts et respecte `friendlyFire`.
- `damageType` devient l'élément. `targets` n'est pas transféré : Marinara décide des cibles des soins, améliorations et attaques selon le type de compétence.
- Un `cost` d'énergie devient un coût MP ; plusieurs sont additionnés. Un `cost` d'exactement un emplacement en consomme un de ce niveau. Marinara facture une quantité d'énergie ou un emplacement, jamais les deux : il omet deux emplacements, des emplacements de deux niveaux ou un emplacement plus énergie. Les coûts d'autres réserves, comme la santé ou une ressource de classe, sont aussi omis pour ne pas les offrir gratuitement.
- `buff` et `debuff` deviennent les effets propres à Marinara. Les autres promesses du texte, comme retirer un état de la fiche, ne sont pas appliquées. Omets `mechanics` si l'effet n'a de sens qu'en dehors d'une bataille.

`coverage.combat` reste distinct et garde son sens : active-le seulement si les batailles suivent réellement les règles de ton système.

<a id="combat-a-fight-your-own-rules-resolve"></a>

## Combat : une lutte résolue par tes propres règles

Le bloc `battle` prête les nombres de la fiche au combat en gardant l'arithmétique Marinara. Le bloc facultatif `combat` définit comment tes règles RÉSOLVENT le combat. Il paramètre un type de combat détenu par le moteur, comme `resolution` paramètre les tests ; tous ses noms sont les tiens. Il en existe trois : `attack-vs-defense`, où les dés sont additionnés et comparés à un nombre, `dice-pool`, où un combat lance les réserves propres à ton ensemble `dice-pool` et compte les réussites (voir Un combat lancé en réserves, ci-dessous), et `symbol-pool`, où un combat lance les dés narratifs propres à ton ensemble `symbol-pool` et dépense les symboles restants (voir Un combat lancé avec des dés à symboles, ci-dessous).

**Une partie dont l'ensemble déclare `combat` combat selon ton bloc.** Les nombres du groupe viennent de leurs fiches, les adversaires de ton bestiaire ou échelle de menace, et chaque tour est résolu par tes dés. Toute dépense ou perte est écrite dans la fiche immédiatement : fermer l'onglet au milieu ne perd rien. L'écran utilise tes mots : attaques et capacités au menu, budgets, états et journal des vrais calculs. Ce qui manque est listé dans la section sur les limites actuelles.

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "grit" },
  "defense": { "derived": "guard" },
  "initiative": { "dice": { "count": 2, "sides": 6 }, "modifier": { "abilityMod": "wits" } },
  "attackRoll": { "dice": { "count": 2, "sides": 6 } },
  "economy": { "budgets": [{ "id": "act", "label": "Action", "per": "turn", "count": 1 }] },
  "attacks": [
    {
      "list": "gear",
      "budget": "act",
      "name": "name",
      "toHit": { "ability": { "column": "swing" } },
      "damage": { "dice": { "column": "damage" }, "ability": { "column": "swing" }, "type": { "column": "harm" } }
    }
  ],
  "abilities": [{ "list": "knacks", "budget": "act" }],
  "standard": ["dodge", "help"],
  "conditions": [
    { "condition": "shaken", "effects": ["own-attacks-disadvantage", "ends-on-damage"] },
    { "condition": "pinned", "effects": ["cannot-act", "speed-zero"] }
  ]
}
```

C'est tout le bloc Ember Roads, et ses parties l'utilisent pour combattre. Le brouillon 5e utilise les mêmes clés pour d20 :

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "hp" },
  "defense": { "field": "ac" },
  "initiative": { "dice": { "count": 1, "sides": 20 }, "modifier": { "derived": "initiative" } },
  "attackRoll": {
    "dice": { "count": 1, "sides": 20 },
    "advantage": true,
    "naturals": { "max": "critical", "min": "miss" },
    "critical": "double-dice"
  },
  "economy": {
    "budgets": [
      { "id": "action", "label": "Action", "per": "turn", "count": 1 },
      { "id": "bonus", "label": "Bonus action", "per": "turn", "count": 1 },
      { "id": "reaction", "label": "Reaction", "per": "turn", "count": 1 }
    ],
    "movement": { "field": "speed" }
  },
  "abilities": [
    {
      "list": "spells",
      "onlyWhen": "prepared",
      "alwaysWhen": { "column": "level", "equals": 0 },
      "budget": "action",
      "toHit": { "derived": "spell_attack" },
      "saveDifficulty": { "derived": "spell_save_dc" }
    }
  ],
  "concentration": { "text": "concentration", "save": "con_save", "floor": 10, "fromDamage": 0.5 }
}
```

<a id="every-key"></a>

### Toutes les clés

- `kind` : `"attack-vs-defense"` (un camp lance les dés contre la défense de l'autre ; toucher inflige des dégâts), `"dice-pool"` (voir Un combat lancé en réserves) ou `"symbol-pool"` (voir Un combat lancé avec des dés à symboles). Chaque clé ci-dessous a le même sens dans tous les cas, lue à la manière dont ce type lit les nombres.
- `health` : obligatoire. Ce que retire le combat : `{ "pool": "grit" }`, une réserve qui diminue et dont le tampon temporaire absorbe les dégâts d'abord s'il existe ; ou `{ "track": "harm" }`, une piste de blessures MARQUÉE. Une piste de blessures exige `damageKinds` à côté. Ou `{ "track": "wounds" }`, qui nomme une piste ordinaire (sans `levels` ni `boxes`) qui SE REMPLIT de son `min` à son `max` (Capability API 1.383) : les dégâts ajoutent des points, les soins les retirent, et une piste à son `max` est hors de combat, comme une réserve à zéro. C'est le cas des blessures de Genesys, avec le seuil de blessures comme `max` ; un système où l'on ne tombe qu'AU-DELÀ du seuil donne à `max` un point de plus. Une piste de santé ordinaire commence à son `default` (pas à un `startFrom`), ne peut pas commencer à son `max` et n'accepte pas de `damageKinds`. Un `max` calculé par la fiche est propre à chaque personnage, comme le maximum d'une réserve. Aucune piste n'accorde de points temporaires.
- `defense` : obligatoire, référence de valeur. Un champ saisi par le joueur ou une valeur dérivée calculée.
- `initiative` : obligatoire. Dés lancés une fois au début et référence facultative de modificateur. Une égalité favorise le plus grand modificateur, puis l'ordre de création du combat. `"each": "round"` relance l'initiative de tout le monde au début de chaque nouvelle ronde, avec le modificateur tel qu'il est alors (un modificateur qui lit une piste de blessures ralentit donc une fois blessé), et la ronde commence par celui qui est premier dans le nouvel ordre. Capability API 1.47. Un combat `dice-pool` peut plutôt la lancer comme une réserve : `pool` (une référence de valeur) indique combien de dés, et leurs réussites plus `plus` donnent le nombre, sans `dice` ni `modifier` à côté. `resource`, qui exige `pool`, conserve ce nombre et laisse les attaques le déplacer (voir "Une initiative que les attaques déplacent", ci-dessous). Capability API 1.48.
- `attackRoll` : obligatoire sous `attack-vs-defense`, et refusé sous `dice-pool`, qui lance les réserves propres à ta résolution. Définit les dés, si l'on lance deux fois pour en garder un (`advantage`), les faces extrêmes d'un seul dé (`naturals.max` : `critical`, `hit` ou `none` ; `naturals.min` : `miss` ou `none`) et l'effet d'un critique (`critical` : `double-dice` relance les dés de dégâts ; `max-dice` ajoute une fois leurs faces maximales ; `none` donne un coup ordinaire). Les faces spéciales exigent un seul dé, comme les tests. Les sauvegardes du combat utilisent les mêmes dés. `criticalFrom` élargit la face critique : une valeur lue sur la fiche de l'attaquant qui est la plus petite face naturelle comptant comme critique, comme `{ "field": "critical_from" }` pour un Champion de 5e dont la fiche indique 19. Elle est plafonnée à la face la plus haute du dé, une valeur inférieure à 2 signifie aucune plage (la face la plus haute seulement, comme pour un personnage dont le champ reste à 0), et elle exige un seul dé avec `naturals.max` réglé sur `critical`. Capability API 1.81.
- `economy` : obligatoire. `budgets` définit le contenu d'un tour : identifiant, libellé, `per` (`turn` remplit au début du tour du porteur ; `round`, au début d'une ronde) et `count`. Le PREMIER budget est le principal, dépensé par les actions standard. `movement` est une référence facultative de distance parcourue par tour, dans ton unité. Les combats sur plateau la lisent ; voir Positions.
- `attacks` : facultatif. Listes de fiche dont les lignes sont des armes. `name` est la colonne de nom ; `damage.dice`, celle des dés ; `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` et `damage.type` nomment des colonnes de la même liste. Une colonne `ability` est un `enum` contenant un identifiant d'attribut ; un autre contenu n'ajoute rien. `proficiency` est `boolean` : l'activer ajoute la maîtrise. Sans dés lisibles, la ligne n'est pas une attaque ; une corde reste une corde. `toHit.skill` nomme une colonne `enum` contenant l'un de tes identifiants de compétence : la ligne ajoute ce qu'ajoute un test de cette compétence, avec l'`ability` propre à la ligne à la place de celui de la compétence si elle en nomme un, exactement comme le `with=` d'un test l'échange (Capability API 1.47). `abilityChoices` associe une valeur de la colonne d'attribut de la ligne à deux de tes identifiants d'attributs ou plus (Capability API 1.793) : une ligne qui la lit attaque avec l'attribut qui ajoute le plus pour toucher et inflige ses dégâts avec ce même attribut. Cela correspond à la propriété Finesse du SRD 5.1, écrite `{ "finesse": ["str", "dex"] }` avec `finesse` parmi les valeurs de la colonne. La valeur est refusée si elle est elle-même un attribut, si elle nomme un attribut absent de ta fiche ou si aucune colonne d'attribut ne la propose. `toHit.sheetBonus` (Capability API 1.800) ajoute au jet pour toucher un nombre lu sur la fiche : `value` est une référence de valeur quelconque, et `when: { "column": ..., "equals": ... }` limite cet ajout aux lignes dont la colonne contient cette valeur. Archery du SRD 5.1, "+2 aux jets d'attaque que tu effectues avec des armes à distance", lit le `listSum` d'une colonne de capacités sur les lignes dont `reach` vaut 0 ; une dague lancée ne reçoit donc rien. `strikes` référence le nombre d'attaques acheté par UNE dépense du budget. Choisir une ligne sans attaques disponibles dépense le budget et met les restantes en réserve. Tant qu'il en reste, toutes les lignes déclarant `strikes` sont gratuites : changer d'arme, de cible ou marcher entre les attaques découle du menu. `strikesCappedBy` nomme une colonne booléenne limitant SA ligne à une seule attaque, quel que soit le nombre acheté : cela sert aux armes tirant une fois par tour, comme la propriété Loading du SRD 5.1. Cela n'a aucun sens, et est refusé, pour une liste qui achète déjà une attaque par dépense. Les attaques disponibles appartiennent au COMBATTANT, pas à une liste : deux listes déclarant `strikes` partagent le même nombre, quelle que soit la ligne utilisée. Elles sont effacées à la fin du tour qui les a achetées. Sans déclaration, chaque dépense achète une attaque, comme auparavant.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities` : facultatif. Listes dont les lignes marquées par catalogue sont des capacités, filtrées comme `battle.skills` avec `onlyWhen` et `alwaysWhen`. Leurs effets sont le `mechanics` de l'entrée ; le bloc fixe le `budget` par défaut, le `toHit` ajouté si elle lance pour toucher et la `saveDifficulty` des sauvegardes. Une entrée demandant une sauvegarde, propre ou terminant un état appliqué, est refusée si sa liste n'a pas `saveDifficulty` : une sauvegarde contre rien réussirait toujours. Avec Capability API 1.108, `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` choisit les références selon la classe d'une ligne. Un clerc 3 / magicien 2 peut dériver l'attaque du clerc de la maîtrise plus la Sagesse et son DD de 8 plus cette attaque, et ceux du magicien de l'Intelligence. La colonne doit exister dans la liste de la source, et `values` contient de 1 à 20 entrées. Chaque entrée peut remplacer l'une ou l'autre référence ; une référence omise, une valeur de colonne absente ou une valeur non listée garde la référence propre de la source. Le combat, le résumé de ligne de la fiche et le résumé du Game Master lisent les mêmes nombres par ligne. `stamp` et `byColumn` exigent tous deux schemaVersion 2 et capabilityApi 1.108 ou plus récent.
- `standard` : facultatif, liste fermée `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (attaques reçues lancées deux fois en gardant la pire) et `help` (prochaine attaque de l'allié lancée deux fois en gardant la meilleure) sont toujours résolus. `dash` (un autre déplacement complet) et `disengage` (personne ne frappe pour ton éloignement ce tour) sont résolus sur plateau et seulement enregistrés sans lui. `hide` et `ready` sont acceptés sans effet pour l'instant.
- `standardEffects` : facultatif, effets d'une action standard absents de son indicateur. Seul `dodge` en a aujourd'hui : `{ "dodge": { "saves": ["dex_save"] } }` indique les sauvegardes lancées deux fois en gardant la meilleure tant qu'il dure. Nomme seulement des sauvegardes déclarées, et seulement si `standard` comprend `dodge`. Sans cela, esquiver rend plus difficile à toucher, sans autre effet. `{ "help": { "beside": true } }` (Capability API 1.771) ne propose l'action Help (aider) qu'à côté d'un adversaire, et l'aide ne compte que contre un adversaire qui se trouvait à côté de celui qui aide ; cela nécessite `help` dans ta liste `standard`.
- `conditions` : facultatif. Associe TES identifiants d'états à leurs effets pour que fiche et combat partagent un registre : un personnage empoisonné le reste ensuite. Liste fermée : `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) et `cannot-approach-source`. `failsSaves` nomme les sauvegardes échouées sans jet. Les six effets nécessitant distance ou déplacement (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) n'agissent que sur plateau ; voir Positions. `cannot-react` exclut le porteur des fenêtres ouvertes par un déplacement : il n'est jamais interrogé. Quatre clés s'ajoutent :
  - `modifiers` : les nombres qu'il modifie tant qu'il dure. Voir Les nombres qu'un état modifie, ci-dessous.
  - `saves` : sauvegardes visées par les deux effets de sauvegarde et par tout modificateur de sauvegarde. Sans cette clé, toutes ; la déclarer sans l'un ni l'autre à côté est refusé.
  - `skills` : compétences visées par les deux effets de test et par tout modificateur de test qui ne nomme pas ses propres compétences. Sans cette clé, toutes ; la déclarer sans l'un ni l'autre à côté est refusé. Les confrontations d'un combat lancent les tests propres au combat, pas des compétences : ce qui est restreint à des compétences n'en atteint donc jamais aucune, mais un test hors combat sur l'une de ces compétences le lit (voir [Les tests hors combat](ruleset-items.md#checks-outside-a-fight)). Capability API 1.53.
  - `whileSourceInSight` : ce qui compte seulement quand l'auteur de l'état est visible du porteur. `true` conditionne tout l'état ; une liste de ses effets conditionne seulement ceux-ci et laisse les autres, comme une peur empêchant de s'approcher même sans voir la source. Un effet absent de l'état est refusé. Sans plateau, aucune ligne de vue ne peut être rompue et tout compte pareillement.
  - `endsWhenSourceDown` : l'état disparaît dès que son auteur tombe.
  - Sens (Capability API 1.127) : le `lacks` d'un état nomme des sens que son porteur n'a pas, et le `mechanics.needs` d'une entrée de catalogue ou le `needs` d'une action de créature nomme des sens qu'une cible doit avoir pour que l'effet agisse sur elle. Pour le Deafened de 5e, écris `"lacks": ["hearing"]` ; pour Command, écris `"needs": ["hearing"]` dans ses mécaniques. Une cible assourdie est retirée du menu de cibles de Command. Un effet de zone ou à plusieurs cibles qui nécessite l'ouïe ignore entièrement cette cible : ni sauvegarde, ni dégâts, ni états. Une fois Deafened terminé, la cible redevient valide. Chaque liste a de un à quatre identifiants de sens uniques, dans les mots propres de l'ensemble ; le moteur ne connaît aucun nom de sens.
  - Utilisable seulement quand la fiche le permet (Capability API 1.166) : le `mechanics.usableWhen` d'une entrée de catalogue s'écrit `{ "value": <value reference>, "atLeast": n, "atMost": n }` (une borne ou les deux). En combat, l'entrée est proposée, pendant le tour de son porteur ou dans une fenêtre de réaction, seulement tant que la valeur lue sur la fiche, l'état vivant et les objets de son porteur reste dans les bornes ; elle est relue chaque fois que le menu est affiché. La Protection de 5e exige un bouclier en main : `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. Le "no heavy armor" de Rage s'écrit de la même façon avec `"atMost": 0` sur le compte d'armures lourdes. Une créature écrite comme un bloc de statistiques n'a pas de fiche : rien ne la retient donc.
  - États appliqués seulement quand la fiche de celui qui les applique le permet (Capability API 1.167) : une entrée `applies` sur les mécaniques d'une entrée de catalogue ou l'utilisation d'un objet peut porter `"when"`, de même forme que `usableWhen`. Il est lu sur la fiche, l'état vivant et les objets de celui qui l'applique, au moment où l'état s'appliquerait, et une entrée hors de ses bornes est ignorée ; les autres s'appliquent quand même. La Rage de 5e applique `raging` et l'un de trois états de dégâts dans la limite de quatre entrées : `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, puis `raging_damage_3` avec `"atLeast": 9, "atMost": 15` et `raging_damage_4` avec `"atLeast": 16`. Quelqu'un qui applique sans fiche applique chaque entrée. Le bloc de statistiques d'une créature et le `onEnd` d'un état n'ont pas de fiche d'applicateur à lire : `when` y est donc refusé. Nécessite schemaVersion 2 et capabilityApi 1.167 ou plus récent.
  - Types de créatures et tests de cible (Capability API 1.168) : `combat.creatureTypes` liste ce qu'un combattant peut être, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`.
    Une créature nomme son propre `type` et ses `tags` ; le type d'un personnage est la valeur du champ texte ou à choix `field` quand c'est l'un des types, sinon `default` (les personnages de 5e sont humanoïdes). Un test de cible s'écrit `{ "types": [...], "tags": [...] }` et réussit dès qu'une correspondance existe ; un combattant sans type ni tags ne correspond jamais. Il se place à trois endroits : le `targetIs` d'une clause de dégâts n'inflige cette clause qu'à une cible qui correspond (une tueuse de dragons : `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, l'eau bénite : `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`) ; le `targetIs` d'une entrée `applies` n'applique cet état qu'à une cible qui correspond ; et `mechanics.targetTypes: { "is": test, "not": test }` dit qui peut être choisi ou pris tout court (Animal Friendship : `{ "is": { "types": ["beast"] } }` ; Sleep : `{ "not": { "types": ["undead"] } }`). Une zone passe par-dessus ceux que `targetTypes` exclut. Une prévision ne compte une clause `targetIs` que contre une cible qu'elle atteindrait ; la simple moyenne de la fiche la laisse de côté. Le panneau de bataille et le Game Master voient le type et les tags de chaque combattant. Nécessite schemaVersion 2 et capabilityApi 1.168 ou plus récent.
  - Fins d'état (Capability API 1.125) : Charm Person utilise `"endsWhen": ["harmed-by-source-side"]`. Des dégâts supérieurs à zéro venant de celui qui l'a appliqué ou de quiconque de son camp, ou le fait qu'ils visent son porteur avec une attaque, une sauvegarde ou un état nuisible, y mettent fin une fois l'action nuisible entièrement résolue, même si l'attaque rate ou que la sauvegarde réussit. `"saveWhenDamaged": true` répète une sauvegarde de tour sur des dégâts : chaque quantité de dégâts supérieure à zéro répète le `saveEnds` de l'action d'application à son DD enregistré ; une réussite y met fin. Sans sauvegarde ou DD enregistré, rien n'est lancé. Hypnotic Pattern utilise `"endsWhen": ["damaged"]` et `"shakeOff": { "budget": "action" }` : tout dégât supérieur à zéro y met fin immédiatement, ou un autre combattant du camp du porteur peut dépenser ce budget pendant son propre tour pour y mettre fin. `shakeOff.reach` est dans l'unité de distance de l'ensemble et vaut une case par défaut ; sans plateau, aucune distance n'est mesurée. L'économie doit déclarer son budget. `endsWhen` a une ou deux entrées uniques. Ces clés laissent inchangées les fins liées à la chute de l'auteur et à la concentration. Pour une sauvegarde uniquement sur des dégâts supérieurs à zéro, jamais au début ni à la fin d'un tour, utilise `saveEnds.at: "damaged"` (Capability API 1.129) : l'applies de Dominate Person s'écrit `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`, qui lance une fois par coup au DD enregistré de l'action d'application sans avoir besoin de `saveWhenDamaged`.
  - L'économie d'actions (Capability API 1.76), telle que Haste et Slow la modifient :
    - `budgets` : `[{ "budget": "haste", "flat": 1 }]` donne à son porteur autant d'unités en plus (ou en moins) d'un budget de tour à chaque tour, jamais en dessous de zéro. Seul un budget qui se remplit `per` tour peut être modifié ainsi. Un budget peut être déclaré avec `"count": 0` pour qu'il ne soit rempli que par un état, et l'écran ne l'affiche que tant que quelqu'un en a. Un adversaire inventé n'en dépense jamais.
    - `grants` : `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }` indique sur quoi ce budget peut être dépensé : les actions standard nommées (tirées de la liste
      `standard` propre de l'ensemble, jamais sur le premier budget, où se trouve déjà chaque action standard), une attaque d'arme d'une seule frappe (quelles que soient les frappes qu'une action mettrait autrement en main ; pour une créature, une attaque de son bloc de statistiques contre une seule cible, jamais une attaque multiple), et l'utilisation d'un objet : `true` pour n'importe quel objet, ou `{ "tags": ["mundane"] }` pour seulement un objet portant l'un de ces tags d'objet (le Use an Object de 5e concerne un objet ordinaire, jamais l'activation d'un objet magique). Ils sont proposés une fois épuisé le budget qu'ils dépenseraient habituellement, et seulement pendant le propre tour du porteur : un octroi ne paie jamais une réaction.
    - `exclusive` : `["action", "bonus"]`, deux budgets dont un tour ne dépense qu'un seul : dépenser l'un vide l'autre.
    - `attacksPerTurn` : le nombre d'attaques (actions qui lancent pour toucher, chaque partie attaquante d'une séquence, et une confrontation qui remplace une frappe, comme une lutte) que son porteur fait pendant son propre tour, quoi qu'une action donnerait. Une réaction pendant le tour de quelqu'un d'autre n'est ni plafonnée ni comptée.
    - `onEnd` : `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`, ce qu'il laisse derrière lui quand il prend fin pour de bon (il s'épuise, une sauvegarde ou des dégâts y mettent fin, la concentration est rompue), jamais quand il est appliqué de nouveau. Il dure quelques `rounds` (jamais `"until-save"` ni `"instant"`). Laissé en plein milieu du propre tour de son porteur, ses rondes commencent au tour suivant : une ronde correspond donc à tout le tour suivant.
  - Quand un combat prend fin, quelle que soit la façon, chaque état qu'il a appliqué avec un décompte, un `endsAfter` ou une concentration quitte la fiche sans rien laisser derrière lui, et la concentration prend fin. Un état sans décompte (l'état à terre causé par une chute) reste.

  `own-saves-advantage` et son contraire lancent deux fois et gardent un jet, comme les attaques ; ils s'annulent. `own-checks-advantage` et son contraire font de même pour le camp du porteur dans une confrontation, là où un combat fait ses tests d'attribut, et pour ses tests hors combat. `resist-all` réduit de moitié tous les dégâts en plus des défenses propres à la cible et s'annule avec une vulnérabilité de la même manière. `cannot-target-source` interdit de viser l'auteur de l'état avec quoi que ce soit (`cannot-target-source-side`, 1.278 : ni quiconque de son camp, sauf si c'est celui du porteur). `cannot-approach-source` interdit de s'en rapprocher davantage que la case actuelle, chemin compris : contourner jusqu'à une case aussi éloignée reste permis ; passer près de lui puis ressortir de l'autre côté ne l'est pas.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Dégâts qu'un état modifie (Capability API 1.133).** `damage` modifie ce que son porteur inflige ; `damage-taken` modifie ce que son porteur subit. Les deux acceptent `flat`, `dice` (et `minus`), ou `times: 0.5 | 2`. Les ajouts se produisent une fois par coup d'attaque réussi, même quand le coup a plusieurs clauses de dégâts ; les critiques doublent les dés ajoutés comme l'ensemble double ses autres dés. Les sauvegardes et les coups automatiques n'en reçoivent aucun. `times` modifie l'ensemble du coup après les ajouts et avant la résistance, en arrondissant le total vers le bas une seule fois pour toutes ses clauses. Les quantités ajoutées affrontent la résistance selon leur propre `damageType`, ou selon le type du coup s'il est omis. Les ajouts du même type rejoignent cette quantité avant la résistance.

  `attacks` vaut `weapon`, `spell` ou `any` (par défaut). Les lignes de liste d'attaques et les attaques d'objets équipés sont des armes, tout comme les jets d'attaque à cible unique des blocs de statistiques ; les capacités de catalogue (incantation des créatures comprise) et les utilisations d'objets sont des attaques de sort ou autres. `blow: "melee" | "ranged"` suit 1.118 : une arme de lancer utilisée à portée d'allonge compte donc comme au corps à corps. `ability` nomme l'attribut réellement choisi pour le jet d'attaque : l'attribut d'une ligne, ou le premier meilleur attribut proposé par un objet (finesse comprise). Les actions simples des blocs de statistiques n'en ont pas et ne correspondent jamais à une restriction d'attribut. Ces clés et `damageType` sont refusés sur les autres cibles de modificateur. `fromSource: true` est réservé à `damage-taken` : le coup doit venir de celui qui a appliqué l'état suivi. Un état non suivi, un niveau ou un objet n'a pas de source d'application et ne peut pas y correspondre.

  En 5e, déclare ces identifiants d'états sur la fiche, puis place ces entrées dans `combat.conditions` :

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor et Rage s'appliquent à leur lanceur ; Ray of Enfeeblement et Hunter's Mark s'appliquent à leur cible. Hex utilise l'entrée `damage-taken` de la marque avec `attacks: "any"` et `damageType: "necrotic"`. Les niveaux et les effets `worn`, `carried` et `otherwise` d'exigence des objets partagent ces modificateurs. Le menu d'attaque ne compte que les ajouts et multiplicateurs propres au porteur ; la marque d'une cible n'y est jamais promise. Les résumés de la fiche et du prompt décrivent les modificateurs de dégâts propres au porteur, et la vue de bataille décrit aussi ceux qu'il reçoit. Les packages qui utilisent l'une ou l'autre cible exigent schemaVersion 2 et capabilityApi 1.133 ou plus récent, y compris quand l'objet se trouve dans un fichier de catalogue séparé.

  **Les nombres qu'un état modifie.** Chaque entrée de `modifiers` nomme ce qu'elle modifie, `to`, et de combien :
  - `defense` : le nombre qu'une attaque contre le porteur doit atteindre. Un nombre fixe uniquement.
  - `attacks`, `saves`, `checks` : les jets d'attaque, sauvegardes et tests de confrontation du porteur. Un nombre fixe, ou des `dice` lancés à chaque jet (`"1d4"`) ; `minus: true` retire les dés au lieu de les ajouter.
  - `speed` : la distance que parcourt le porteur, dans ton unité de distance (`flat`), ou `times` 0.5 ou 2 pour la moitié ou le double, appliqué après tous les changements fixes. Lu seulement sur un plateau, comme `speed-zero`.
  - `health-max` : `times` 0.5 et rien d'autre réduit de moitié le maximum de santé du porteur, arrondi vers le bas et jamais en dessous de 1 (Capability API 1.115). Une piste de santé à cases n'a pas de maximum à réduire de moitié. La santé au-dessus du maximum réduit est perdue au début du combat, et les soins ne le dépassent jamais.

  Un modificateur de `checks` peut nommer ses propres `skills`, et un modificateur de `saves` ses propres `saves`, qui le restreignent à la place de ceux de l'état. L'un comme l'autre peut faire lancer deux fois avec `mode: "advantage"` ou `"disadvantage"`, compté avec les effets du même nom et s'annulant comme eux, avec ou sans nombre à côté ; un même état peut ainsi rendre Sneak plus difficile et Climb plus facile à la fois. Ces trois clés nécessitent Capability API 1.53.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  Un nombre fixe porte son propre signe, et 0 est refusé. Chaque modificateur apparaît dans le journal à côté du jet qu'il a modifié, avec le nom de l'état ("12 + 5 + 3 (Blessed) = 20"), et les chances de toucher et de gagner affichées dans le menu en tiennent compte. Les états se cumulent entre eux ; le même état deux fois reste un seul état.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels` : facultatif. Des niveaux d'une piste vivante qui comptent comme des états tant que la piste est assez haute : c'est ainsi que s'exprime un état qui empire par degrés, comme l'épuisement. Chaque entrée nomme une `track` ordinaire (pas une piste de blessures), le niveau `at` auquel il commence et ce qu'il fait, avec les mêmes `effects`, `modifiers`, `failsSaves`, `saves` et `skills` qu'un état. Chaque niveau atteint par la piste compte : ils s'additionnent donc à mesure qu'elle monte. Un niveau n'a pas d'auteur et ne prend fin que lorsque ce qu'il lit redescend ; `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side` et `cannot-approach-source` y sont donc refusés. Seul un combattant doté d'une fiche a des pistes. Le journal nomme un niveau par sa piste et son nombre ("- 1 (Heat 3)").

  À la place de `track`, un niveau peut lire une valeur `derived` (Capability API 1.54), calculée avec l'état courant et les objets du personnage, pour que personne n'ait rien à cocher : Ember Roads ralentit quiconque transporte 10 d'encombrement ou plus.

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  Un seuil qui diffère d'un personnage à l'autre ("plus de cinq fois la Force") est une valeur dérivée qui le soustrait : `scale` par -1 donne la part à retirer, et une `sum` des deux est ce que lit le niveau.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true` met le porteur hors du combat pour de bon dès le début, avant que quiconque ne bouge (Capability API 1.115). Cela, et la santé perdue par un maximum réduit de moitié, est réglé une seule fois, au début du combat ; tout autre niveau est lu chaque fois que le nombre qu'il modifie l'est.

  Les adversaires portent aussi des pistes (Capability API 1.115). Un adversaire sans fiche commence aux `tracks` qu'on lui donne, par tes identifiants de pistes : une créature que propose le Game Master peut les nommer (`"tracks": { "exhaustion": 2 }`), tout comme un adversaire du bestiaire placé dans un combat. Les `conditionImmunities` d'une créature peuvent nommer une piste que lit un niveau ; aucun des niveaux de cette piste ne la touche alors, avec ou sans fiche : les morts-vivants et les créatures artificielles de 5e, immunisés contre l'épuisement.

  Les modificateurs, les niveaux et les effets de test nécessitent Capability API 1.45.

- `checks` et `contests` : facultatifs. Ce que lit une confrontation, et les confrontations que n'importe qui peut engager en combat : agripper, pousser, se libérer. Voir Confrontations, ci-dessous. Capability API 1.43.
- `concentration` : facultatif. Champ vivant `text` enregistrant l'effet maintenu, `save` imposée par les dégâts, `floor` minimal de difficulté et `fromDamage`, part des dégâts qui la fixe si elle est supérieure. Commencer une autre capacité concentrée termine la première ; rater la sauvegarde la termine et retire les états qu'elle maintenait.
- `dying` : facultatif, `kind: "saves"`. Deux pistes comptant les jets (le nombre nécessaire est leur maximum), `dice`, `succeedAt`, effets des faces extrêmes (`naturals.max` : `revive-1` ou `success` ; `naturals.min` : `one-failure` ou `two-failures`), coût des dégâts à terre (`damageWhileDown`, `criticalWhileDown`) et `condition` du personnage à terre. Sans bloc, zéro santé met simplement à terre et les soins le ramènent.
- `damageTypes` : facultatif. Types du système, comparés sans tenir compte de la casse.
- `damageKinds` : obligatoire si `health` nomme une piste de blessures, refusé pour une réserve : seule une marque conserve un type (voir [Pistes de blessures](ruleset-sheets.md#wound-tracks-health-that-is-a-track-not-a-number)). Définit les `kinds` marqués par un coup et le nombre de cases. `default` reçoit tout ce qui n'est pas associé, y compris les dégâts sans type ; `byType` associe `damageTypes` aux types de marques sans distinguer la casse : `"Fire"` et `"fire"` sont la même clé et les déclarer ensemble est refusé. `marks` n'a pas de valeur par défaut car ses deux réponses s'opposent : `"per-point"` compte les niveaux de santé selon les dégâts, donc trois dégâts marquent trois cases et les réduire est utile ; `"per-blow"` marque une case si le coup touche, quelle que soit sa force. Un coup à plusieurs clauses marque encore une seule case en prenant le type le plus grave passé. Indique le choix de ton système : `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool` : obligatoire sous `dice-pool`, refusé sous `attack-vs-defense`. Voir Un combat lancé en réserves.
- `spendLimits` : facultatif. Combien d'une réserve vivante un combattant peut dépenser par `turn` ou par `round` en combat, quel que soit son type : `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` est lu une fois au début du combat. Un coût qui dépasse ce qui reste de la limite n'est pas abordable et sort donc du menu, quel que soit le contenu de la réserve. Une limite par tour repart au début du propre tour de son porteur, une limite par ronde au début d'une ronde. Un adversaire écrit en nombres simples ne paie rien sur une fiche, une limite ne le contraint donc jamais ; un adversaire écrit sous forme de fiche paie avec ses propres réserves et est soumis à la limite comme n'importe qui. Capability API 1.47.
- `threat` : facultatif, nécessaire à un bestiaire. `tiers` est l'échelle d'adversaires : identifiant, libellé, plage `health`, `defense`, `toHit`, plage `damagePerRound` et `saveDifficulty`. Chaque créature nomme un palier ; un adversaire non écrit est ramené à celui demandé par le GM, sans sortir de l'échelle. `damagePerRound` décrit ce qu'il inflige à UNE cible par ronde, séquence complète comprise.
  Un palier peut porter `worth`, la valeur qu'une créature de ce palier représente dans un budget de rencontre (les points d'expérience de 5e selon le facteur de puissance), et `threat` peut porter `budget`, ce qu'un combat peut contenir pour l'équipe qui l'affronte (Capability API 1.803) :
  - `level` : les champs numériques dont la somme est le niveau d'un membre (5e : un par classe).
  - `steps` : les étapes de difficulté, de la plus basse à la plus haute, chacune sous la forme `{ "id", "label" }`.
  - `byLevel` : `[{ "level": 5, "worth": [500, 750, 1100] }]`, une valeur par étape pour un membre de ce niveau ou plus, les niveaux étant croissants.
  - `crowd` : facultatif, `[{ "from": 2, "times": 1.5 }]`, le multiplicateur de la valeur des adversaires dès qu'ils sont aussi nombreux ; `smallParty` et `largeParty` font lire la ligne au-dessus pour une équipe dont l'effectif est inférieur au premier seuil et la ligne au-dessous pour une équipe dont l'effectif est supérieur au second (les multiplicateurs de 5e 2014). Omet cette clé pour le budget du SRD 5.2, qui additionne les valeurs telles quelles.
  - `forGame` : facultatif, l'étape à laquelle se joue chaque difficulté de jeu (`casual`, `normal`, `hard`, `brutal`). Sans cette clé, elles prennent les étapes dans l'ordre, et toute difficulté qui dépasse la dernière se joue à cette dernière étape.

  Le GM reçoit la valeur de chaque palier et le budget de l'équipe avant d'écrire un combat. Un combat qu'il invente et dont la valeur dépasse ce budget est abaissé : l'adversaire inventé de plus grande valeur descend d'un palier, puis l'opération se répète jusqu'à respecter le budget ; un combat comprenant un boss peut atteindre l'étape supérieure. Une créature de bestiaire et une créature qui revient d'un combat précédent sont comptées telles quelles, et le combat d'une histoire reste tel que son auteur l'a écrit. Les ajustements du combat indiquent ce qui a été abaissé.

### Sauvegardes contre des états, des dégâts ou la magie

Un modificateur avec `to: "saves"` peut porter `against`. Il faut au moins l'un de `conditions` (identifiants d'états de la fiche), `damage` (types de dégâts) ou `magic: true`. Une seule correspondance suffit ; `saves` restreint toujours la sauvegarde concernée, en s'y ajoutant comme un ET. Utilise le `mode: "advantage"` du modificateur, pas `effects`, pour restreindre ainsi l'avantage. Ces modificateurs fonctionnent sur les états, les niveaux de piste ou dérivés atteints et les effets d'objets. Pour les traits de race, dérive une valeur du choix de race de la fiche et attache le modificateur à un niveau atteint quand cette valeur vaut 1. Exemples de modificateurs :

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave utilise `conditions: ["frightened"]`. Magic Resistance utilise `magic: true` sans `saves`, sur un niveau dérivé de la fiche ou un niveau de piste d'une créature. Les `applies` d'une action comptent même si la sauvegarde empêche l'état ; ses dégâts incluent chaque clause `plus`. Les noms de dégâts sont comparés sans tenir compte de la casse. La magie désigne la qualité `"magical"` de 1.101 : les `mechanics.qualities` d'un catalogue (même sans dégâts), le `damage.qualities` d'une action de créature, ou les tags d'un objet arme. Un sort doit porter cette qualité ; son nom ou son catalogue seuls ne le rendent pas magique. Une sauvegarde pour mettre fin à un état, y compris `saveWhenDamaged` et `saveEnds.at: "damaged"`, ne vaut que contre cet état. Les sauvegardes de concentration et contre la mort ne valent contre rien. Hors combat, les demandes de sauvegarde du Game Master ne portent ni source ni état structurés ; `against` ne correspond jamais à ces demandes. La fiche, les détails d'objet, les détails de bataille et le résumé de fiche du Game Master affichent ces restrictions. Nécessite schemaVersion 2 et capabilityApi 1.134 ou plus récent.

### Un combat lancé en réserves : `dice-pool`

Un ensemble `dice-pool` compte des réussites au lieu d'additionner les dés, et ses combats le peuvent aussi. `"kind": "dice-pool"` exige que `resolution.kind` vaille `"dice-pool"`, et il lit la fiche comme le font déjà tes tests de réserve : **chaque nombre qu'un jet ajoute est un nombre de dés, et chaque nombre qu'il doit atteindre est un nombre de réussites.** Rien n'est donc renommé :

- Un nombre pour toucher (celui d'une ligne d'attaque, le `toHit` d'une liste de capacités, celui de l'action d'une créature) est la réserve que lance une attaque. Le dé, la cible qu'un dé doit atteindre, et les faces qui doublent, explosent, annulent ou provoquent une maladresse sont ceux de ta `resolution`. La piste de blessures nommée par ton `resolution.penaltyFrom` retire sa pénalité de la réserve, comme pour un test.
- `defense` est le nombre de réussites dont une attaque a besoin, jamais moins d'une. Le modificateur d'un état à `defense`, et la couverture (`cover.bonus`, ou `cover.threeQuarters`), s'y ajoutent.
- Chaque réussite au-delà de celles nécessaires ajoute un dé de dégâts. Une maladresse rate, quoi qu'elle ait compté. Il n'y a pas de critiques : un coup puissant vaut ses dés supplémentaires.
- Le nombre d'une sauvegarde est sa réserve, et sa difficulté le nombre de réussites nécessaires. Une confrontation lance le test de chaque camp comme une réserve, et le camp qui obtient le plus de réussites gagne.
- Le modificateur d'un état aux attaques, sauvegardes ou tests est un nombre de dés ajoutés ou retirés ; c'est donc un nombre `flat` : un modificateur lancé (`dice`) est refusé.
- Les dégâts sont des dés de ton dé : les `dice` d'une quantité (celle d'une créature, d'une entrée) indiquent combien, et doivent être de ton dé, et sa partie `flat` correspond à des réussites automatiques, jamais lancées. La colonne de dés de dégâts d'une ligne d'attaque est lue pour son nombre de dés, `damage.ability` ajoute la valeur de cet attribut en dés, et `damage.bonus` ajoute des réussites automatiques. `perCostStep` et `scales` ajoutent des dés, comme toujours. Les soins et les points temporaires sont des quantités, additionnées comme avant.
- L'initiative est une somme (`initiative.dice` et `modifier`), ou une réserve si tu en demandes une (`initiative.pool`, ci-dessous), et une règle d'agonie garde ses propres dés.

Ce qu'un combat à réserve lance en plus se trouve dans son bloc `pool` :

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage` : si un jet qui penche est lancé deux fois en gardant celui qui a le plus de réussites (une maladresse compte comme moins que tout jet sans maladresse). Sans lui, un combat lance une seule fois, quoi que dise un état.
- `damageTarget` : la cible par dé contre laquelle sont lancés les dés de dégâts et d'absorption. La cible par défaut de ta résolution si tu l'omets. Ces dés comptent une fois chaque face égale ou supérieure, et rien d'autre : aucune face n'y double, n'explose, n'annule ni ne provoque de maladresse.
- `soak` : ce qu'une cible retire des dégâts d'un coup, par type de blessure. `all` est une référence de valeur pour tous les types, et `byKind` en donne une par type de ta piste de santé, qui l'emporte sur `all` pour son type ; un type que ni l'un ni l'autre ne nomme n'est pas absorbé. Avec `"roll": true`, la cible lance ce nombre de dés contre la cible de dégâts et chaque réussite en retire un. Avec `"roll": false`, le nombre est retiré des dés de dégâts avant leur lancer : il ne touche donc jamais les réussites automatiques, que l'absorption lancée retire comme les autres. Rien ne descend sous zéro, et rien n'est lancé pour absorber un coup qui n'a rien compté. Une créature donne ses propres nombres sous la forme `soak: { "all": 1, "byKind": { "knock": 3 } }`, ce qui exige que le `soak` du bloc indique comment l'absorption se fait. La résistance, la vulnérabilité, l'immunité et `resist-all` s'appliquent après l'absorption, à ce qui reste.
- `hardness` : une référence de valeur pour la dureté d'un combattant, quand l'initiative est un nombre que les attaques déplacent. Voir [Armures et effets portés en combat](ruleset-items.md#armor-and-worn-effects-in-a-fight).

Les dégâts de chaque cible sont lancés pour cette cible, car ce qu'un coup a gagné au-delà des réussites nécessaires, et ce qu'elle absorbe, lui appartiennent. La seconde clause d'un coup, et un effet supplémentaire, forment chacun leur propre réserve de dégâts de leur propre type, sans dés supplémentaires du coup. Le menu prévoit une réserve exactement : la chance d'atteindre les réussites nécessaires, et ce que valent les dés de dégâts après ce qu'absorbe la première cible.

Gravewatch est écrit ainsi : ses gardiens lancent une valeur et un métier, absorbent les coups avec Sinew et pas du tout les déchirures, peuvent dépenser un point de Resolve par tour, et relancent l'initiative à chaque ronde.

**Déclarer dans l'ordre inverse n'est pas implémenté.** Certains systèmes font déclarer son action à chacun avant que quiconque n'agisse, du plus lent au plus rapide. Dans un combat où chaque combattant choisit une action quand vient son tour, déclarer en premier ne change rien de ce que lit une règle ; une clé n'aurait donc rien à dire.

<a id="a-fight-thrown-in-symbol-dice-symbol-pool"></a>

### Un combat lancé avec des dés à symboles : `symbol-pool`

Un ensemble `symbol-pool` lit des symboles plutôt que des nombres, et ses combats le peuvent aussi : le moteur mène donc tout le combat sans demander au Game Master ce qu'un avantage a acheté. `"kind": "symbol-pool"` exige que `resolution.kind` vaille `"symbol-pool"`, et il lit la fiche comme le font déjà tes tests à symboles :

- Un nombre pour toucher représente les dés de l'attaquant. Sur une fiche, le nombre d'une ligne d'attaque combine son attribut et les rangs de sa compétence : le plus grand est le nombre de dés lancés et le plus petit le nombre de dés améliorés, comme `pool.build: "larger-upgraded"` construit un test. Une action de créature l'indique par `toHit` (ses dés) et `upgrades` (combien sont améliorés), ce qui exige une réserve qui possède un dé `upgrade` et n'est pas construite par `sum`.
- `defense` est le nombre de dés de difficulté lancés contre ceux de l'attaquant. La `defense` d'une créature est son propre nombre de ces dés. La couverture et le modificateur d'un état à `defense` ajoutent des dés de difficulté.
- Le modificateur d'un état aux attaques, sauvegardes ou tests, et la pénalité de blessures nommée par ton `penaltyFrom`, sont des dés de fortune quand ils aident et d'infortune quand ils gênent : ce sont donc des nombres `flat` ; un modificateur lancé (`dice`) est refusé. Un jet qui penche d'un côté (longue portée, désavantage d'un état) lance un dé d'infortune de plus, ou un dé de fortune de plus s'il penche de l'autre côté.
- Les réussites nettes (le nombre indiqué par ton `success.needed`) font toucher. Le nombre d'une sauvegarde est ses dés, et sa difficulté les dés qui s'y opposent ; une confrontation lance les dés de chaque camp et celui qui a le plus de réussites nettes gagne. L'initiative peut être lancée comme une réserve (`initiative.pool`) : ses réussites nettes donnent le nombre.
- Les dégâts s'additionnent comme dans un combat `attack-vs-defense`. Chaque réussite nette ajoute `damage.perSuccess` (un) à un coup, toutes les réussites (`"counts": "all"`) ou seulement celles au-delà du nombre nécessaire pour toucher (`"beyond"`), et l'absorption de la cible se retire du coup entier, sans jamais descendre sous zéro.
- Rien ne provoque de maladresse et rien ne double un jet de dégâts. Un critique s'achète par une dépense.

Ce que font les symboles se trouve dans le bloc `symbols` :

```json
"symbols": {
  "damage": { "perSuccess": 1, "counts": "all" },
  "soak": { "all": { "derived": "soak" } },
  "spends": [
    { "id": "boost", "label": "Boost an ally", "by": "attacker", "symbol": "a", "cost": 1, "boost": { "dice": 1, "on": "attacker-ally" } },
    { "id": "crit", "label": "Critical", "by": "attacker", "symbol": "a", "cost": 2, "when": "hit", "critical": true, "condition": { "id": "injured", "on": "target", "rounds": 3 } },
    { "id": "triumph", "label": "Triumphant blow", "by": "attacker", "symbol": "t", "cost": 1, "when": "hit", "critical": true, "damage": 2 },
    { "id": "strain", "label": "Overextend", "by": "target", "symbol": "h", "cost": 2, "track": { "id": "strain", "by": 1, "on": "attacker" } },
    { "id": "setback", "label": "Opening", "by": "target", "symbol": "h", "cost": 1, "setback": { "dice": 1, "on": "attacker" } },
    { "id": "despair", "label": "Weapon slips", "by": "target", "symbol": "d", "cost": 1, "condition": { "id": "disarmed", "on": "attacker" } }
  ]
}
```

- `soak` : ce qu'une cible retire de chaque coup, lu sur sa fiche. `all` est une référence de valeur pour tout type de blessure, et `byKind` en donne une par type de ta piste de santé, qui l'emporte sur `all` pour son type. Une créature donne sa propre absorption avec `soak: { "all": 2 }`, ce qui exige que ce `soak` soit déclaré.
- `spends` : jusqu'à 16 effets qu'un symbole restant sur le jet d'une attaque permet d'acheter. `cost` exemplaires de `symbol` l'achètent une fois, et `max` (un) indique combien de fois un jet peut l'acheter ; une dépense qui donne un état (`condition`) ou un critique (`critical`) s'applique une seule fois, donc son `max` reste à un, et deux dépenses ne peuvent pas appliquer un même état (ou deux du même type `oneAtATime`) à une même cible sur le même jet. Une dépense n'est pas achetée si elle ne ferait rien : son état ne s'appliquerait pas (empêché, ou un état du même type déjà présent), ou sa piste n'a pas la place pour un pas entier dans cette direction (place qu'une dépense précédente du même jet a pu utiliser). `by` indique quel camp la choisit : l'attaquant dépense les symboles qui le favorisent (avantage, triomphe), la cible ceux qui la favorisent (menace, désespoir). Un seul camp dépense un symbole donné, et une dépense n'achète jamais avec les réussites, qui font déjà toucher et ajoutent aux dégâts.
- `when` : achetée seulement sur un coup au but (`hit`), seulement sur un raté (`miss`), ou dans les deux cas (`any`, par défaut). `damage` (les dégâts ajoutés au coup, avant absorption) et `critical` (le coup est critique, donc une clause qui indique `onCritical` s'applique et le journal le signale) exigent `"when": "hit"` et `"by": "attacker"`.
- Les effets d'une dépense, combinables : `condition` applique un de tes états à quelqu'un, pour `rounds` ou jusqu'à ce qu'un événement y mette fin ; `track` déplace une piste vivante ordinaire de `by` (tension, stress), jamais la piste de santé ; `boost` et `setback` ajoutent autant de dés au prochain jet effectué dans ce combat par celui qui les reçoit, et ce jet les consomme. `on` vaut `attacker`, `target`, `attacker-ally` ou `target-ally` ; un allié est le prochain de ce camp à jouer, et une dépense qui n'a aucun allié à désigner n'est pas achetée.
- `worth` : facultatif, la valeur en points de dégâts que l'IA attribue à la dépense. Sans cette clé, le moteur la calcule d'après les effets : les dégâts valent leurs points, un état vaut deux, un dé sur le prochain jet un peu plus d'un demi-point, un pas de piste un demi-point, contre l'autre camp, ou pour le camp de celui qui choisit si la dépense y réduit une piste ou ajoute des dés de fortune. Une dépense qui ne vaut rien pour celui qui la choisit n'est jamais achetée.

Le moteur achète, pour chaque camp, les dépenses qui valent le plus avec les symboles dont il dispose, pour les joueurs comme pour les adversaires, et les indique toutes dans le journal. Un joueur peut les choisir lui-même : avec "Choose my own symbol spends" coché sur l'écran de combat, un jet qui laisse quelque chose à acheter à un membre de l'équipe qu'il joue attend qu'il choisisse ses dépenses une par une, accepte le choix du moteur pour le reste, ou ne dépense plus rien. Son choix suit les mêmes règles que celui du moteur (coût, `max`, `when` et ce qui s'appliquerait), et le moteur continue de choisir pour tous les autres. L'ensemble de règles n'a rien à déclarer pour cela. Les symboles que personne ne dépense restent sur le jet pour que le Game Master les raconte. La prévision du menu compte toutes les issues possibles du jet : la probabilité de toucher et les dégâts d'un coup avec ses réussites et dépenses, après absorption. L'IA évalue chaque attaque d'après cela, en retirant ce que les dépenses de l'autre camp lui coûteraient.

**Ce qui reste au Game Master.** Le coût d'une dépense appartient à l'ensemble de règles, pas à chaque arme : une arme avec sa propre valeur critique s'écrit donc comme une dépense partagée par l'ensemble ; la table propre à un critique est à lancer par le Game Master. L'avantage sur une sauvegarde, un test ou une confrontation n'achète rien : seul le jet d'une attaque se dépense. L'amélioration des dés de difficulté en combat n'est pas implémentée.

### Dés de dégâts minimum

Un combat en réserves peut garder des dés même contre une forte absorption, comme le fait **Overwhelming** dans Exalted :

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

C'est `combat.damage.minimum`, une référence de valeur lue sur la fiche actuelle de l'**attaquant**. Après que l'absorption statique a retiré des dés de la première réserve de dégâts d'un coup, la réserve est relevée à au moins ce nombre. Ce sont des dés entiers, arrondis vers le bas et bornés entre zéro et `resolution.pool.max`, pas des réussites automatiques : chaque dé restant peut échouer. L'absorption lancée retire toujours des réussites après le jet de dégâts ; elle ne réduit pas une réserve de dés, donc le minimum ne protège pas les réussites contre elle. La résistance et l'immunité s'appliquent toujours. Les coups qui dépensent de l'initiative ignorent le minimum, comme ils ignorent les dégâts d'arme et l'absorption ; les coups qui prennent de l'initiative l'utilisent.

Une arme peut remplacer le minimum commun avec `item.attack.damage.minimum`. Il accepte les mêmes références de valeur sur son porteur, ou `{ "stat": "overwhelming" }` pour l'une des statistiques numériques propres à l'objet. Un zéro déclaré remplace aussi le minimum commun. Cela diffère du `floor` d'arme existant, qui garantit une quantité de dégâts après absorption. Les clauses de dégâts supplémentaires et les effets supplémentaires ne reçoivent pas d'autre minimum. Le registre du combat et le journal affichent le minimum résolu à côté des dés. La clé de combat et la clé d'arme nécessitent toutes deux **Capability API 1.146** dans un package, y compris pour les armes dans des fichiers de catalogue externes.

### Un coup qui étourdit

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` est destiné aux combats en réserves. `over` lit la fiche actuelle de la **cible**, juste avant le coup. Un seul coup doit infliger **strictement plus** de dégâts que ce nombre, après absorption, sauvegardes et résistance. Ses clauses de dégâts comptent ensemble ; des coups séparés ne s'accumulent jamais pour étourdir. Sur une piste qui marque par coup, un coup qui inflige des dégâts compte comme un niveau. Un coup qui prend de l'initiative plutôt que de la santé ne peut pas étourdir. `measure` ne vaut pour l'instant que `"damage"`.

La cible saute exactement son prochain tour. D'autres coups étourdissants avant ce tour n'ajoutent pas de tours sautés. Le tour sauté fait quand même avancer les décomptes des états et le reste de la gestion des tours, y compris les changements de ronde et l'initiative relancée. Enregistrer puis recharger le combat conserve le saut en attente. `condition`, quand il est présent, nomme un état déclaré de la fiche. Le combat le marque jusqu'à ce que le tour sauté soit passé ou que le combat prenne fin. Un état déjà présent est laissé en place ; l'immunité contre l'état empêche la marque mais pas le saut. `text` est une narration facultative, pas un autre effet. Le journal et le contexte de combat du Game Master enregistrent le coup et le saut. La clé nécessite **Capability API 1.147**.

### La cible détermine le type de blessure

Ajoute `remap` à l'association `combat.damageKinds` existante ; garde ses `default`, `byType` et `marks` :

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

Un combat en réserves choisit d'abord le type de l'attaque avec son association ordinaire, puis lit le `when` de chaque remappage sur la **cible**. Un nombre non nul active la règle. `from` et `to` doivent tous deux être des types de la piste de blessures de santé. La première règle qui correspond l'emporte ; les remappages ne s'enchaînent pas. On peut en donner au plus 12. Avec `tags`, au moins un doit correspondre à l'attaque : une arme porte déjà `item.tags`, et les mécaniques de catalogue et les dégâts de créature portent déjà `qualities`. Ces noms viennent de `items.tags`. Sans `tags`, toute attaque de ce type peut correspondre. Aucun nouveau champ de tag d'attaque n'est nécessaire.

Le type obtenu décide à la fois de l'**absorption** et des marques de blessure. Ainsi, le coup létal d'une arme à feu peut devenir contondant contre un vampire et utiliser l'absorption contondante ; la même arme à feu contre quelqu'un d'autre, ou une lame contre ce vampire, garde son type ordinaire. Le _type_ de dégâts d'origine de l'attaque reste inchangé pour la résistance et l'immunité. Chaque clause de dégâts utilise son propre type et les tags de l'attaque. Le registre du combat et le journal montrent les types d'origine et remappés, et la prévision de dégâts lit la même règle. Une créature simple sans fiche peut satisfaire une référence constante, mais ne peut pas fournir de valeurs de fiche pour ces règles ; donne-lui une fiche de créature pour cela. Seule la nouvelle clé `remap` nécessite **Capability API 1.148** ; les associations de types de dégâts plus anciennes gardent leur compatibilité existante.

### Une initiative que les attaques déplacent

Certains systèmes à réserve gardent l'initiative comme un nombre pour tout le combat et laissent les attaques le déplacer : une façon d'attaquer la prend à la cible, une autre dépense celle de l'attaquant comme dégâts, et quiconque tombe jusqu'à une ligne fixée s'effondre. Un combat `dice-pool` peut l'exprimer (Capability API 1.48) :

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **L'ouverture.** Chacun lance `pool` dés au début du combat, et les réussites plus `plus` forment son nombre ; `resource` exige donc `pool` : des dés additionnés donnent un ordre, pas un nombre de dés. L'`initiativeModifier` d'une créature est sa réserve, puisque tout nombre qu'ajoute un combat à réserve est en dés. Le nombre est conservé : il n'est jamais relancé (`each` est refusé à côté de `resource`), et au début de chaque ronde l'ordre est trié selon les nombres du moment.
- **Styles.** Chaque attaque (une ligne d'attaque, une capacité ou une entrée de catalogue qui lance pour toucher et inflige des dégâts, l'action d'une créature qui en inflige, et une action faite d'autres actions) est proposée une fois par style, et un joueur choisit le style avant la cible. Jusqu'à quatre ; chacun prend ou dépense, et au moins un prend. Un choix qui ne nomme aucun style se fait dans le premier ; un choix dans un style où l'attaque n'est pas proposée est refusé. Une attaque garde le style dans lequel elle a été faite jusqu'à sa fin, même quand une réponse change le nombre de son auteur avant qu'elle ne touche.
- **Un style qui prend.** Sur un coup au but, les dégâts sont lancés comme d'habitude (les dés supplémentaires du coup, les dés de l'arme, l'absorption par type, les réussites automatiques), et ce qu'ils comptent est retiré du nombre de la cible plutôt que de sa santé. L'attaquant gagne le tout plus `gain`.
- **Un style qui dépense.** Proposé seulement tant que le nombre de l'attaquant est au-dessus de la ligne d'effondrement (0 si tu ne donnes pas de `crash`), et jamais pour une action faite d'autres actions, puisqu'un nombre se dépense sur un seul coup. Sur un coup au but, les dégâts sont le nombre de l'attaquant au moment de l'attaque, en dés contre la cible de dégâts, et rien d'autre : ni dés d'arme, ni dés supplémentaires du coup, ni réussites automatiques, ni absorption. Il marque la santé selon le type de blessure propre à l'attaque. Une fois l'attaque terminée, un nombre qui a touché quelque part revient à `base`, et un nombre qui n'a rien touché perd ce qu'indique `onMiss` pour le nombre avec lequel l'attaque a été faite (une table à seuils : paires `[at least, lose]`, croissantes ; rien sous le premier palier).
- **L'effondrement.** Un nombre qui tombe à `crash.at` ou en dessous s'est effondré : la `condition` (l'un de tes états, facultatif) est infligée, et celui qui l'a fait tomber là gagne `bonus`. Un échec qui fait s'effondrer son propre auteur ne donne de bonus à personne. Un combattant effondré ne peut pas dépenser. L'effondrement prend fin, état compris, quand son nombre repasse au-dessus de la ligne, après `recoverAfter` de ses propres tours (son nombre revient à `base` au début de ce tour), et quand le combat se termine, quelle qu'en soit l'issue. Quelqu'un dont le jet d'ouverture est sur la ligne ou en dessous commence le combat effondré. `base` doit être au-dessus de `crash.at`, sinon y revenir le ferait s'effondrer à nouveau.

Le menu montre la prévision propre à chaque style : la chance de toucher, et ce que prendrait un style qui prend ou les dégâts que ferait un style qui dépense. Le panneau d'état montre le nombre de chacun, et le journal indique chaque changement et sa raison : "Ada gains 5 initiative for crashing Rats, and is on 14." Le sélecteur du moteur évalue un coup qui prend un tour à l'avance : prendre puis dépenser, comparé à dépenser maintenant puis de nouveau depuis la base.

<a id="what-a-fight-reads-from-mechanics"></a>

### Ce qu'un combat lit dans `mechanics`

`kind` détermine si `amount` représente des dégâts ou des soins ; toute entrée marquée `reaction` reste hors du menu, tout comme une entrée `utility`, sauf si elle modifie ce que le tour lui-même peut contenir (voir ci-dessous). `attackRoll` effectue un jet contre la défense de la cible avec le `toHit` de la liste ; `autoHit` saute entièrement cette étape. `save` lance la sauvegarde de la cible contre la `saveDifficulty` de la liste, et `onSuccess` détermine si une réussite subit la moitié ou rien. `targetCount` indique combien de cibles elle peut viser. Une capacité sans jet d'attaque (une zone contre laquelle chacun effectue une sauvegarde, quelque chose qui touche directement) lance ses dés UNE FOIS pour toutes les cibles ; une capacité qui lance pour toucher chaque cible relance ses dés à chaque coup au but. `applies` impose des états à ce qu'elle affecte, chacun avec une `duration` de `instant` (sans horloge propre : il reste jusqu'à ce que quelque chose le retire), `until-save` (qui exige `saveEnds` à côté) ou `{ "rounds": n }`, et éventuellement un `saveEnds` qui nomme la sauvegarde et indique si elle se répète à `turn-end` ou `turn-start`. Les rondes se décomptent sur les propres tours du porteur, à la fin de chacun ; `{ "rounds": 1, "at": "turn-start" }` les décompte au début de chacun, ce qui permet de dire "jusqu'au début de ton prochain tour". `"of": "source"` (Capability API 1.119) compte plutôt les tours de celui qui l'a appliqué, à partir de son prochain tour, ce qui permet de dire "jusqu'à la fin de ton prochain tour" à propos de quelqu'un d'autre. Le `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` de Guiding Bolt donne l'avantage au prochain jet d'attaque contre sa cible avant la fin du prochain tour du lanceur. Si la source quitte le combat, les rondes se décomptent sur les propres tours du porteur. Le `delays` d'un état de combat (Capability API 1.120) retarde ce qu'utilise son porteur : une action tirée de l'un de ses `catalogs`, payée avec son `budget`, lance un dé de `chance.sides` faces et, à `chance.atLeast` ou plus, elle ne se produit pas encore. Au début du prochain tour du porteur, elle est achevée avec ce même budget et se poursuit comme elle l'aurait fait, réponses comprises ; s'il ne peut pas agir ou n'a plus rien de ce budget, elle est perdue. Ce qu'elle a coûté reste dépensé dans tous les cas. Le Slow de 5e s'écrit `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`. `endsAfter` retire l'état après le premier `own-attack` (le prochain jet d'attaque du porteur), `attacked` (le prochain jet d'attaque fait contre le porteur) ou `own-save` (la prochaine sauvegarde du porteur), quoi que dise son horloge ; `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` signifie donc "sur sa prochaine attaque avant la fin de son prochain tour". Un état qui dure le temps d'une attaque dure toute cette attaque, dégâts compris, et un nouvel état infligé par le même coup reste. Les deux nécessitent Capability API 1.45. `temporary` accorde des points temporaires à la réserve de santé, qui ne se cumulent jamais : la plus grande protection reste. `scales` augmente la quantité du nombre de DÉS supplémentaires que sa table donne pour la valeur lue. `cost` se paie par la commande `use` de la fiche elle-même, et `budget` remplace la partie de l'économie dépensée.

`plus` contient jusqu'à trois quantités SUPPLÉMENTAIRES sur le même coup, à côté de `amount`, chacune avec son propre jet et son propre type ("and 2d6 fire"). Une clause est `{ "dice": "2d6", "flat": 1, "type": "fire" }` et peut porter sa propre `save`, `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`, que lance la CIBLE indépendamment de ce que l'action lui demandait déjà : `none` supprime toute cette clause en cas de réussite, `half` en laisse la moitié, et le reste du coup demeure intact dans les deux cas. Sans `difficulty`, elle reprend le nombre utilisé par la sauvegarde de l'action, puis la `saveDifficulty` de la liste. Un critique double les dés de chaque clause selon la même règle que ceux de la première quantité ; une clause sans `type` reprend le type de dégâts du coup, et le coup entier reste UN test de concentration, avec les dégâts additionnés, et un test de chute. Une clause nécessite un `amount` à accompagner, et un `heal` n'en porte aucune.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

Trois clés indiquent ce qu'une entrée fait à l'économie du tour lui-même, et une entrée `utility` qui en déclare une est proposée au lieu d'être écartée :

- `free` : elle ne coûte aucun budget. Elle paie toujours le `cost` indiqué et ne peut pas aussi nommer un `budget`.
- `gives` : `[{ "budget": "action", "count": 1 }]`, jusqu'à quatre. L'utiliser ajoute immédiatement à ces budgets, avec un plafond égal à ce qu'un tour contient plus le don, pour que rien ne puisse être mis de côté pour un tour ultérieur.
- `standard` : `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. Son détenteur peut effectuer ces actions standard avec CE budget. Elles sont proposées à côté des actions ordinaires sous la forme `standard:<id>@<budget>`, et l'entrée elle-même reste hors du menu lorsqu'elle n'est que cette permission, car une permission n'est pas quelque chose que l'on exécute.

Une entrée du nouveau `kind: "rider"` est PASSIVE : personne ne l'exécute, elle n'apparaît jamais au menu et ajoute automatiquement une clause de dégâts au premier coup au but admissible d'une période. Elle porte `rider` et rien d'autre qui puisse être exécuté :

```json
{
  "kind": "rider",
  "rider": {
    "on": "hit",
    "sources": ["attacks"],
    "requires": { "column": "finesse" },
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
    "oncePer": "turn",
    "amount": { "dice": "1d6" }
  },
  "scales": {
    "from": { "field": "level" },
    "table": [
      [1, 0],
      [3, 1]
    ]
  }
}
```

`sources` nomme les listes d'attaques dont elle provient et `requires` une colonne vraie de leurs lignes ; ainsi, un effet supplémentaire qui ne se déclenche qu'avec certaines armes les précise sans qu'Engine sache ce qu'est une arme. N'indiquer ni l'un ni l'autre signifie n'importe quel coup au but de son détenteur. Une arme tenue depuis le sac n'est pas une ligne ; `weapons` (Capability API 1.70) nomme donc aussi les tags d'objet sur lesquels il se déclenche : `"weapons": { "tags": ["finesse",
"ranged"] }` se déclenche sur un coup au but avec une arme tenue portant l'un ou l'autre tag, frappe de la main secondaire comprise. Ne nommer que `weapons` ne se déclenche sur aucune ligne, et ne nommer que des lignes ne se déclenche sur aucune arme tenue. `when` accepte N'IMPORTE LAQUELLE des options : `advantage` est l'orientation finale du jet d'attaque, et `ally-adjacent` désigne un allié de l'attaquant debout et capable d'agir, à une case de la cible sur un plateau et n'importe où sans plateau. `ally-adjacent-no-disadvantage` (Capability API 1.126) exige aussi que le jet final ne soit pas avec désavantage une fois avantage et désavantage annulés ; l'exemple ci-dessus l'utilise pour Sneak Attack. `oncePer` vaut `turn` (renouvelé au début de chaque tour, de sorte qu'un coup porté pendant qu'un autre agit peut encore en bénéficier) ou `round`. `amount` augmente avec le `scales` de l'entrée, et `type` est le type de dégâts, celui du coup par défaut.

<a id="creatures-a-bestiary-a-fight-reads"></a>

### Créatures : un bestiaire lu par le combat

Un catalogue qui déclare `"holds": "creatures"` contient des adversaires au lieu de lignes de fiche. Il n'alimente aucune liste, le sélecteur de l'éditeur de fiches ne le propose jamais, et tous ses nombres utilisent les clés déjà déclarées par ton bloc `combat`. Il nécessite un bloc `combat` et une échelle `threat`, car une créature est classée sous l'un de tes propres paliers.

```json
{
  "id": "road_trouble",
  "label": "Road trouble",
  "holds": "creatures",
  "filters": [{ "id": "tier", "label": "How bad", "type": "text" }],
  "entries": [
    {
      "id": "rust-jackal",
      "label": "Rust Jackal",
      "summary": "A lean thing that lives on the metal roads.",
      "filters": { "tier": "Pack trouble" },
      "creature": {
        "health": { "dice": "3d6" },
        "defense": 6,
        "initiativeModifier": 1,
        "speed": 16,
        "abilities": { "brawn": 1, "wits": 0, "heart": -1 },
        "tier": "pack",
        "actions": [
          {
            "id": "bite",
            "name": "Bite",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d6", "flat": 1, "type": "cut" },
            "reach": 2
          },
          {
            "id": "worry",
            "name": "Worry",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d4", "type": "cut" },
            "applies": [{ "condition": "shaken", "duration": { "rounds": 2 } }]
          },
          {
            "id": "snap_and_worry",
            "name": "Snap and worry",
            "budget": "act",
            "sequence": [
              { "action": "bite", "times": 1 },
              { "action": "worry", "times": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

Les nombres ci-dessous sont la manière directe d'écrire une créature. Une créature écrite dans les termes de ton ensemble de règles, sous forme de `sheet`, tire plutôt `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`, `soak` et `hardness` de cette fiche (voir "Une créature écrite dans les termes de ton ensemble de règles", ci-dessous).

- `health` : un nombre, ou `{ "dice": "3d6", "flat": 2 }`, lancé une fois à la création du combat. Une prévision lit la moyenne, donc un menu ne promet jamais un dé que personne n'a lancé.
- `defense`, `initiativeModifier`, `speed` : ce contre quoi l'attaque est lancée, ce qui est ajouté à l'initiative (ou, quand l'initiative est lancée comme une réserve, combien de dés elle lance) et la distance parcourue en un tour, dans ton unité de distance.
- `abilities` et `saves` : indexés par les identifiants de caractéristiques et de sauvegardes déclarés par ta fiche. Une sauvegarde absente vaut zéro.
- `checks` : ce qu'elle ajoute dans une confrontation, indexé par les identifiants de `combat.checks`. Un test qu'elle ne nomme pas vaut zéro. Capability API 1.43.
- `soak` : dans un combat `dice-pool` uniquement, ce qu'elle absorbe : `all` pour toute blessure, `byKind` pour un type de ta piste de santé. Capability API 1.47.
- `hardness` : quand l'initiative est un nombre que les attaques déplacent, un coup qui dépense et dont les dés sont inférieurs à cette valeur ne fait rien. Capability API 1.56.
- `speeds` et `hover` : la façon dont elle se déplace en plus de la marche (voir Autres façons de se déplacer, sous Positions). Capability API 1.113.
- `shield: true` : ses mains sont prises, donc l'alternative `twoHanded` d'une action ne s'applique pas. Capability API 1.102.
- `size` : l'une des `combat.sizes`, par identifiant, que lit le `maxSizeAbove` d'une confrontation (voir Tailles et DD d'évasion). Capability API 1.103.
- `type` et `tags` : l'un des `combat.creatureTypes.types` et jusqu'à huit de ses `tags`, par identifiant, que lisent les tests de cible (voir Types de créatures et tests de cible). Capability API 1.168.
- `resist`, `vulnerable`, `immune` : types de dégâts comparés sans tenir compte de la casse et vérifiés contre `combat.damageTypes` si tu en déclares. Une entrée `resist` ou `immune` peut aussi dire ce qui la traverse, `{ "type": "tearing", "except": ["silver"] }` : un coup porté par une arme (un objet) qui porte l'un de ces tags d'objet est subi tel quel (Capability API 1.55, voir [Les armes en combat](ruleset-items.md#weapons-in-a-fight)), tout comme une action dont les `damage.qualities` ou une entrée de catalogue dont les `mechanics.qualities` en nomment un (Capability API 1.101). `conditionImmunities` nomme tes propres états, ou une piste que lisent tes `combat.levels` (Capability API 1.115).
- `tier` : le barreau de `combat.threat` auquel elle appartient.
- `loot` (Capability API 1.63) : l'identifiant de la table de butin qu'un combat gagné lance pour elle (voir [Butin](ruleset-items.md#loot)).
- `inventory` (Capability API 1.795) : ce qu'elle peut porter au début d'un combat, jusqu'à 16 lignes. Chaque ligne nomme l'un de tes objets (`item`, sous la forme `<catalog>/<entry>`) ou l'une de tes tables de butin (`table`), avec `chance` (sur cent, 100 par défaut) et `count` (un nombre ou des dés, 1 par défaut ; une table est tirée autant de fois). Elle utilise ce qu'elle peut pendant le combat : une créature dotée d'une `sheet` utilise ses objets comme un membre de l'équipe, et un simple bloc de statistiques utilise un objet dont le `use` est consommé à l'utilisation et ne lit rien de son utilisateur (une potion, une huile). Ce qui lui reste tombe lorsqu'elle est vaincue, en plus de son `loot` ; si elle s'enfuit, elle l'emporte. Le GM (maître du jeu) peut à la place donner à un adversaire son propre inventaire (`carrying` dans la rencontre), qui remplace ces lignes.
- `traits` : de courtes paires nom/texte montrées au Game Master. Elles ne sont jamais résolues, donc tout ce qui contient des nombres appartient à une action.
- `signaturePoints` : points rendus au début de son propre tour et dépensés pour les actions `signature`.
- `riders` : jusqu'à quatre, identiques au `rider` d'une entrée de catalogue, écrits sur le bloc. Chacun vaut `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, avec un `type` facultatif et un `actions` facultatif qui nomme les actions de ce bloc sur lesquelles il se déclenche. L'effet supplémentaire d'un bloc ne lit aucune liste de fiche : `sources` et `requires` sont donc les deux clés qu'il ne possède pas. Une créature écrite sous forme de fiche reçoit les effets supplémentaires de ses listes, exactement comme un personnage.
- `actions` : jusqu'à douze, chacune avec son propre `id`. Une action porte ce qu'un bloc de statistiques écrit à la main porte (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), plus quatre éléments propres aux créatures. `reach` est sa portée de frappe, `range` sa portée de lancer ou de tir et `area` sa forme d'impact, le tout dans ton unité de distance ; `range` peut être un simple nombre ou `{ "normal": 30, "long": 120 }` si elle porte plus loin avec une pénalité, et `area` vaut `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (voir Positions) :
  - `uses` : `{ "per": "encounter" | "day", "count": n }`. Lorsqu'ils sont épuisés, l'action quitte le menu.
  - `recharge` : `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Elle commence le combat disponible, est dépensée à l'utilisation, puis lance les dés au début du propre tour de la créature : `from` ou plus la rétablit. Le journal contient les dés dans les deux cas.
  - `damage.alternatives` (Capability API 1.102) : jusqu'à quatre quantités qu'elle inflige à la place de la première, chacune `{ "when": ..., "dice": "1d10", "flat": 3 }`, la première qui s'applique l'emportant. Le type, les clauses et les qualités restent ceux de l'action. `"when": "twoHanded"` s'applique sauf si la créature a `"shield": true`, ce qui correspond au "or 8 (1d10 + 3) slashing damage if used with two hands" de 5e ; `"when": { "selfHealthAtMost": 0.5 }` s'applique tant que sa santé ne dépasse pas cette part de son maximum, ce qui correspond au "or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer" d'une nuée. La prévision du menu et le coup la lisent tous deux telle qu'elle est.
  - `sequence` : d'autres actions du même bloc, dans l'ordre, chacune avec sa propre cible. **C'est ainsi que s'écrit une créature qui frappe deux fois en une action.** Un budget paie toute la séquence. Une séquence ne porte rien de propre et ne peut jamais nommer une autre séquence.
  - `signature` : `{ "cost": n }`, payée avec les points de la créature plutôt qu'un budget et uniquement pendant qu'un autre agit : le combat la propose dans la fenêtre entre deux tours (voir Fenêtres).
  - `reaction` : le même objet que le `mechanics.reaction` d'une entrée de catalogue (voir Fenêtres) : l'action ne figure sur le menu d'aucun tour et est proposée à la place au moment qu'elle nomme. Une réaction n'est pas aussi une action distinctive, et aucune séquence ne peut en faire une.
  - `self: true` : elle s'applique à la créature elle-même plutôt qu'à quelqu'un d'autre, et ne prend donc ni `targetCount` ni `area`. Les deux nécessitent Capability API 1.46. Une parade (Parry) est les deux, avec un état `parrying` qui ajoute 2 à la défense :

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```
- Une sauvegarde nécessite une difficulté sur l'action elle-même : `save.difficulty` pour une sauvegarde imposée par l'action, ou `saveDifficulty` pour un état qui prend fin sur sauvegarde lorsque l'action n'a pas sa propre sauvegarde. Une action de bloc s'écrit avec des nombres simples même sur une créature dotée d'une fiche : ce nombre réside donc sur l'action. La sauvegarde d'une clause peut omettre sa `difficulty` et reprendre ce même nombre.
- `damage.plus` est la même liste de clauses que le `plus` d'une entrée de catalogue, et se lit exactement de la même manière : `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` est une morsure qui porte la chaleur comme quantité distincte, avec sa propre résistance et son propre doublement.

Une action de créature peut rendre des points de vie avec `heal` (des dés, une quantité fixe ou les deux), plafonnés au maximum de sa cible. `targets: "ally"` atteint son propre camp, elle-même comprise ; `targets: "any"` atteint l'un ou l'autre camp. Sans `targets`, elle atteint l'autre camp comme avant. Ces clés nécessitent Capability API 1.121. Un soin ne porte ni `damage`, ni `toHit`, ni `save`, ni `area` ; `targets` n'accepte ni `self` ni `sequence`, et une séquence ne porte aucune de ces clés. Le Healing Touch d'un deva s'écrit :

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

Le `spellcasting` d'une créature (Capability API 1.123) lance des sorts de catalogue sans dépenser d'emplacements ni de points. Ses `saveDifficulty` et `toHit` fournissent les nombres du sort ; une créature avec une `sheet` peut les omettre pour utiliser les nombres d'incantation de sa fiche. Une créature simple doit fournir chaque nombre dont ses sorts ont besoin. Chaque `entry` nomme une entrée de catalogue existante avec des `mechanics`. Des `uses` omis signifient à volonté ; `level` est le niveau de lancement pour la mise à l'échelle `perCostStep`, ou la base de l'entrée s'il est omis. L'entrée fournit toujours son budget, ses cibles, sa concentration, ses réactions, ses zones et ses invocations. La liste d'une dryade pourrait s'écrire ainsi ; ces identifiants de sorts sont donnés à titre d'illustration et doivent être fournis dans un catalogue `spells` :

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

Pour un cercle de guenaudes, ajoute `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }` à côté de `spells` et `"coven": true` sur chaque sort partagé. Ces sorts ne sont proposés que tant qu'au moins trois combattants debout du camp du lanceur portent cet identifiant de cercle, chacun à 30 unités de distance de l'ensemble ou moins du lanceur, en simple distance de cases. Sans plateau, tous les membres debout comptent. Les utilisations de chaque sort forment une réserve commune à ce cercle, indexée par identifiant de cercle et par entrée. Un bloc de cercle nécessite un sort de cercle et un sort de cercle nécessite le bloc ; les entrées en double sont refusées. Une créature proposée par le Game Master perd son `spellcasting` quand elle est ramenée dans les limites, car une échelle de menace ne peut pas borner une liste de sorts.

La copie de test d'un brouillon 5e utilisée par le moteur, `docs/development/ruleset-5e-2014.example.json`, contient un bestiaire de cinq créatures écrites à la main, couvrant une séquence, une recharge, une sauvegarde avec un état, des résistances et immunités, des utilisations limitées, des points d'actions distinctives et une créature écrite sous forme de fiche. Le bestiaire complet du SRD se trouve dans le fichier `catalogs/creatures.json` du [package officiel 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014).

#### Une créature écrite dans les termes de ton ensemble de règles

Une créature ne doit pas forcément s'écrire avec des nombres simples. Donne-lui plutôt une `sheet`, avec exactement la structure d'une fiche de personnage, et le combat la construit comme un membre du groupe : sa santé, sa défense, ses sauvegardes, son initiative, sa vitesse et chaque attaque et capacité de ses listes résultent de tes propres formules de fiche. C'est ainsi qu'un ensemble de règles indique que ses adversaires possèdent les mêmes caractéristiques, compétences et listes que ses personnages, quelles qu'elles soient. Le Toll Warden d'Ember Roads :

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **Chaque partie est facultative** : `abilities`, `skills`, `saves`, `bonuses`, `fields` et `lists`, indexés par les identifiants déclarés dans ta fiche. Tout élément omis prend la valeur par défaut de ta fiche, exactement comme sur un personnage vierge. Le Grit du gardien vaut 9 parce que ton `grit_max` additionne 4, sa Toughness et son Brawn, et sa Guard vaut 7 pour une raison similaire.
- **Chaque nombre n'a qu'une source.** Une créature avec une fiche ne fournit pas aussi `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves` ou `checks`, et Engine refuse le fichier si elle le fait. Elle peut n'avoir aucune `actions` propre, puisque ses listes définissent ce qu'elle fait. Une créature sans fiche fournit toujours les trois premiers et au moins une action.
- **Elle est vérifiée comme les données d'auteur qu'elle est.** Chaque identifiant doit être déclaré par ta fiche ; une compétence ou sauvegarde prend l'un des paliers de maîtrise que tu lui proposes ; un champ, score, bonus ou colonne contient ce qu'il est déclaré contenir (un entier dans son intervalle, une de ses valeurs, etc.), et une liste ne contient pas plus de lignes qu'elle n'en autorise. Il n'y a pas de partie `live`, car le combat conserve les dépenses de la créature.
- **Une ligne peut provenir d'un catalogue.** `_catalog: "<catalog>/<entry>"` nomme l'entrée dont une ligne a été sélectionnée, comme sur une fiche de personnage, et le combat lit dans cette entrée le coût et l'effet de la ligne. Le catalogue doit alimenter cette liste. Quand le catalogue est intégré au fichier, l'entrée doit s'y trouver ; quand il possède son propre fichier, une ligne qui nomme une entrée absente de ce fichier ne donne simplement rien à la créature. Les catalogues nommés par les fiches d'un bestiaire sont chargés pour le combat avec le bestiaire.
- **Ce que l'entrée indique à côté de la fiche compte toujours** : `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` et `conditionImmunities`.
- **Elle paie dans ses propres réserves.** Elles commencent pleines ; elle les dépense pour ce que lui donnent ses listes, et les paiements supérieurs (un sort avec un emplacement supérieur) lui sont proposés exactement comme à un membre du groupe, qu'Engine ou le Game Master décide pour elle. Hold the Line coûte de la Luck au gardien.
- **Avec une piste de blessures, sa santé est la piste.** Un coup marque la propre piste de la créature selon tes `damageKinds`, après application de ses `resist`, `vulnerable` et `immune` ; une créature immunisée à un type de dégâts n'en reçoit donc aucune marque.
- **Elle reste un adversaire.** À zéro, elle est hors combat plutôt que mourante ; elle ne lance jamais de sauvegarde contre la mort ; l'écran montre ce qu'il montrait toujours d'un adversaire et rien de sa fiche, et aucune de ses dépenses n'est réécrite ailleurs, même si un personnage porte le même nom.
- **Une fiche dont la santé totale est nulle** est exclue du combat, et le journal d'ouverture explique pourquoi, plutôt que de faire entrer quelque chose que personne ne peut blesser.
- Une couche qui retire une valeur d'un de tes champs énumérés ne supprime jamais une créature qui l'utilise : tant que la couche est active, ce champ prend sa valeur par défaut pour la créature, exactement comme pour un personnage, et la créature n'est pas refusée pour cette raison.
- Un Game Master peut aussi en inventer une, qui reste limitée à son palier (voir Adversaires que personne n'a écrits).
- Un package qui en fournit une déclare Capability API 1.34.

Le Toll Sergeant du brouillon 5e est la même chose sur une fiche d20 : son Armor Class, ses points de vie, ses sauvegardes et ses deux frappes par action proviennent de ses propres champs et de sa liste d'attaques.

#### Adversaires que personne n'a écrits

Lorsqu'un Game Master invente un adversaire, Engine ramène la proposition sur ton échelle `threat` avant tout jet : la santé dans la plage du palier ; la défense, le bonus d'attaque et les difficultés de sauvegarde au maximum à deux au-dessus du palier ; et les dégâts diminués jusqu'à ce que le meilleur round de la créature (sa séquence la plus forte ou son action individuelle la plus forte, mesurée contre une cible) entre dans le `damagePerRound` du palier. Il réduit d'abord le nombre de dés, puis la partie fixe, puis une frappe d'une séquence, et seulement ensuite la taille du dé, sans jamais réduire quoi que ce soit à néant. Les noms absents de ton ensemble de règles sont retirés : types de dégâts, états et sauvegardes inconnus, ainsi que tout ce qui dépasse les six premières actions. Un palier jamais déclaré se rabat sur le bas de ton échelle. Chaque changement est renvoyé sous forme d'une phrase simple pour que le journal puisse expliquer son intervention.

Une invention peut aussi s'écrire sous forme de `sheet`, comme une créature de bestiaire ; c'est ainsi qu'un mage inventé obtient emplacements et sorts. Le Game Master voit les identifiants de ta fiche et ce que chacun peut contenir, les listes lues par le combat et les noms que tes catalogues leur proposent ; ainsi, un sort est nommé plutôt que décrit : une ligne qui nomme une entrée de catalogue, quelle que soit sa casse, devient cette entrée, et les propres valeurs du Game Master (comme la préparation d'un sort) s'appliquent par-dessus. La fiche est lue avec tolérance, car un modèle l'a écrite : un nom absent de ton ensemble de règles est retiré, une valeur est ajustée à son champ ou sa colonne, et les nombres écrits à côté de la fiche ne sont pas utilisés.

Une créature inventée qui n'est pas un boss est limitée à ce que ton ensemble de règles lui ouvre. Un filtre de catalogue avec `startFrom` nomme le champ de fiche qui organise ses entrées (la liste de sorts du package 5e par `class`), et une créature inventée ne conserve que les entrées dont le filtre correspond à sa propre valeur de ce champ, selon la comparaison utilisée à l'ouverture du sélecteur. Ainsi, un Sorcerer n'a jamais toute la liste de sorts, et une créature sans classe indiquée ne reçoit rien d'un catalogue organisé par classe. Les choix laissés ouverts sont ensuite complétés sans interroger à nouveau le Game Master : pour chaque liste dont les lignes ne comptent qu'une fois choisies (`onlyWhen` sur une source de capacités de combat), parmi les entrées accessibles qu'elle peut payer avec ses propres réserves, chaque réserve qu'elle possède reçoit un petit nombre d'entrées (davantage pour une créature plus compétente), tout comme ce qu'elle peut utiliser à volonté. Ce qu'elle reçoit dépend de son tempérament et de sa compétence, les mêmes qui gouvernent son combat : une créature protectrice ou de soutien cherche ce qui soutient son camp ; une téméraire, les dégâts ; une méthodique ou patiente, ce qui entrave un ennemi ; et plus elle est compétente, plus elle risque de porter une réaction, un contre ou tout autre élément qui modifie le tour. Le tirage vient de la graine du combat, donc un même combat complète toujours de la même façon. Une ligne que le Game Master a nommée dans une telle liste compte comme choisie.

Un boss appartient entièrement au Game Master, en tant qu'exception possible : rien ne lui est retiré et rien n'est complété.

Puis l'un comme l'autre est limité à son palier :

- La santé entre dans la plage du palier par l'unique champ dont elle est lue : le maximum de la réserve est ce champ, ou une `sum` contenant exactement un champ (le maximum de points de vie de 5e, la Toughness d'Ember Roads). Une formule de santé sans champ unique reste telle quelle, et le journal le précise. La longueur d'une piste de blessures t'appartient et ne change jamais.
- Une fois la créature construite, la défense, le bonus d'attaque et les difficultés de sauvegarde sont limités à deux au-dessus du palier, et les dégâts diminuent jusqu'à ce que son meilleur round entre dans le `damagePerRound` du palier, en comptant le plus gros paiement qu'elle peut se permettre. Ce qu'achète un paiement supérieur diminue d'abord, puis les dés, la partie fixe, une frappe, et seulement ensuite la taille du dé.

Ton propre bestiaire n'est jamais plafonné. Ce sont des données que tu as écrites, donc Engine les accepte telles quelles.

### Positions : un combat sur un plateau

Un combat se déroule dans l'imagination jusqu'à ce que ton bloc indique la valeur d'une case de plateau. Déclare `distance` et il peut se jouer sur une grille ; mouvement, allonge, portées, zones, ligne de vue, couverture et frappes sur quelqu'un qui s'éloigne prennent alors un sens. Chacun est un nombre que tu as écrit ; Engine fournit le plateau et rien d'autre.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
"opportunity": { "budget": "reaction" }
```

Ember Roads n'en déclare qu'une ligne, et rien d'autre ; c'est tout l'intérêt : le reste n'est pas obligatoire.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**La case.** `distance.perCell` indique combien de TON unité vaut une case, et `label` nomme cette unité. Toutes les distances du monde du bloc l'utilisent : `economy.movement`, la `speed` d'une créature, le `reach` et le `range` d'une arme, et le `reach` et le `range` d'une action de créature. Un catalogue qui déclare son propre `units.distance` convertit ses `mechanics.range` et `area.size` avec son propre `perCell` ; sinon, il utilise celui-ci. Une distance supérieure à zéro est arrondie à la case la plus proche, jamais à aucune : tout ce à quoi tu as donné un nombre atteint donc au moins une case. Zéro n'est pas une courte distance et conserve son sens propre : un `mechanics.range` de 0 signifie soi-même ou contact (toucher quelqu'un d'autre atteint la case voisine), et une colonne d'arme `reach` ou `range` valant 0 sur une ligne signifie que cette ligne n'a pas cette distance.

**Le combat utilise-t-il un plateau ?** Deux éléments doivent concorder : ton bloc déclare `distance`, et la partie du joueur utilise le style de combat Tactical. Avec le style Classic, ou un ensemble de règles sans `distance`, le combat reste dans l'imagination : n'importe qui peut viser n'importe qui, et rien de ce qui suit n'est lu.

**Les styles qu'une partie peut utiliser.** `combat.styles` nomme les styles de combat qu'une partie utilisant ton ensemble peut jouer, par identifiant : `classic`, `tactical`, ou un style enregistré par un client (jusqu'à 8, chacun une seule fois, et au moins l'un de `classic` et `tactical`). Sans cette clé, tous les styles sont proposés, comme avant. Un ensemble dont les règles exigent un plateau (zones, allonge, couverture, prise en tenaille) indique `"styles": ["tactical"]` : l'assistant New Game et les réglages de la partie ne proposent alors que Tactical, et ses combats ont donc toujours des positions. Une partie déjà sauvegardée avec un style absent de ta liste utilise le premier de ceux que tu listes que le client peut dessiner (le premier style intégré de ta liste, sur un client qui n'a aucun des styles enregistrés que tu listes), et une partie ne peut être créée, ni modifiée dans ses réglages, pour utiliser un style absent de ta liste. Un combat déjà en cours conserve le style avec lequel il a commencé. La liste s'applique que le directeur de combat soit activé ou non : elle limite donc aussi les batailles Classic et Tactical propres à Marinara utilisant ton ensemble. Un ensemble qui utilise `styles` nécessite Capability API 1.379.

```json
"combat": {
  "kind": "attack-vs-defense",
  "styles": ["tactical"],
  "distance": { "label": "feet", "perCell": 5 }
}
```

**Ce que voit le joueur.** Le plateau est dessiné avec le terrain du style tactique. Chaque case est un bouton, accessible au pointeur ou aux touches fléchées, et indique sa nature, son occupant et ce qu'en fait le choix en cours. Marcher éclaire les cases proposées par le menu, chacune avec son coût DANS TON UNITÉ, trace le chemin et marque en ambre toute case dont le chemin provoquerait la frappe de quelqu'un, nommé sous le plateau. Une option qui prend une cible éclaire les personnes admissibles, à la fois sur le plateau et dans la liste. Une option avec une `area` vise une case, et celle sous le pointeur indique qui serait touché, alliés compris. Le mouvement restant apparaît à côté de tes budgets, toujours dans ton unité. L'écran ne mesure rien : chaque case, coût, chemin, cible et point de visée est envoyé par le serveur.

**Mouvement.** Le déplacement autorisé d'un tour vaut `economy.movement` pour un membre du groupe, ou la `speed` de la créature, divisé par `perCell` et arrondi VERS LE BAS, sans jamais descendre sous une case tant qu'elle peut bouger. Il se recharge au début du propre tour de son détenteur et peut se dépenser avant, entre et après les actions : marcher, frapper, marcher encore. Entrer dans une case coûte un, ou davantage en terrain difficile. Huit directions, toutes au même coût, car les grilles de jeu de rôle sur table visées fonctionnent ainsi. On peut traverser un allié mais s'arrêter sur personne ; un adversaire est un mur ; on ne peut entrer dans rien de solide ni couper un coin entre deux cases solides.

**Autres façons de se déplacer** (Capability API 1.113). Les `speeds` d'une créature donnent la façon dont elle se déplace en plus de la marche, `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }` dans ton unité, et `"hover": true` indique qu'un volant n'a pas besoin de mouvement pour rester en l'air (il lui faut une vitesse `fly`). Celles d'un membre de l'équipe viennent de la fiche par `economy.movementModes`, des références de valeur indexées de la même façon, comme le seraient la vitesse de nage d'une race ou la vitesse de vol d'un sort ; une valeur nulle signifie qu'il ne se déplace pas de cette façon. `speed` et `economy.movement` restent la marche. Sur un plateau :

- le crédit de mouvement est celui de la façon la plus rapide dont ils se déplacent, et chaque case parcourue est retirée de toutes les façons à la fois : une créature qui marche à 30 et vole à 60 peut marcher 10 puis voler 40, et ne jamais marcher au-delà de 30 ;
- un volant entre dans toute case non solide pour une case, eau et marche de n'importe quelle hauteur comprises ;
- un nageur traverse l'eau pour une case, et marche sur la terre ferme ;
- un grimpeur franchit une marche de n'importe quelle hauteur pour ce que coûte le sol sur lequel il pose le pied ;
- la vitesse de creusement d'un fouisseur est transmise au Game Master et compte comme une marche, puisqu'un plateau n'a pas de sol à creuser.

Chaque pas se fait de la façon la moins coûteuse à laquelle il reste assez de mouvement. Un combat sans plateau n'en lit rien, et quelqu'un qui ne fait que marcher se déplace exactement comme avant.

**Hauteur de vol** (Capability API 1.114). Sur un plateau dont l'ensemble donne `combat.elevation.levelHeight` et `combat.distance.perCell`, un volant se voit proposer Fly up et Fly down là où il se trouve, chacun coûtant un niveau de son vol (un niveau de 5 pieds sur des cases de 5 pieds vaut une case). Jusqu'à 20 niveaux au-dessus du sol qu'il survole. Tant qu'il est en l'air :

- il ne fait que voler, une case par pas, au-dessus de tout ce qui n'est pas solide ;
- la distance entre lui et n'importe qui d'autre est la plus grande de la distance au sol et de la hauteur qui les sépare : une épée d'une allonge de 5 pieds ne peut pas toucher un dragon à 30 pieds de haut, et sa propre morsure ne peut pas non plus toucher le chevalier ;
- il a l'avantage de la hauteur sur quiconque est plus bas, comme le lui donnerait une colline ;
- quitter l'allonge de quelqu'un pour qui il est trop haut ne provoque aucune frappe ;
- abattu, jeté à terre ou ramené à une vitesse nulle, il tombe sur le sol en dessous comme le dit `falling`, sauf s'il a `hover`.

Voler sur un sol aussi haut que lui, ou plus haut, le fait atterrir, comme un volant au sol vole sur une falaise. Aucune nouvelle clé : un moteur antérieur à 1.114 garde les volants au sol, donc un package qui compte sur la hauteur déclare 1.114.

**En l'air** (Capability API 1.354). Sur tout plateau, le fait qu'un volant soit en l'air est un état qui lui est propre : un volant sans marche, ou avec `hover`, commence en l'air ; un volant au sol décolle avec l'action gratuite Take off, en volant vers le haut, ou par un pas que seul son vol lui permet (au-dessus de l'eau, ou là où voler coûte moins cher que marcher), et redescend avec l'action gratuite Land (seulement s'il peut marcher), ou quand il est jeté à terre, abattu ou ramené à une vitesse nulle, sauf s'il fait du vol stationnaire. Fly down jusqu'au sol le garde en l'air à la hauteur du sol jusqu'à son atterrissage. Son illustration de créature est celle du vol tant qu'il est en l'air. Aucune autre règle ne lit encore cet état.

**Allonge et portée.** Une ligne d'arme les tire de `combat.attacks[].reach` et `.range`, chacun étant une colonne de la même liste ou le même nombre sur toutes les lignes :

```json
"attacks": [
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "toHit": { "ability": { "column": "ability" } },
    "damage": { "dice": { "column": "damage" } },
    "reach": { "column": "reach" },
    "range": { "normal": { "column": "range" }, "long": { "column": "long_range" } }
  }
]
```

Une colonne qui vaut 0 sur une ligne indique que cette ligne n'a pas cette distance ; c'est ainsi qu'une épée ordinaire figure dans la même liste qu'une hache de lancer. Une ligne sans allonge atteint une case. Une action de créature utilise son propre `reach` ou `range`, et une capacité de catalogue utilise `mechanics.range` (0 signifie soi-même ou contact, soit une case lorsqu'elle vise quelqu'un d'autre).

Une ligne avec LES DEUX est une arme de lancer : dans son allonge, c'est une frappe ; au-delà, un tir. Les règles de tir ci-dessous ne l'affectent donc pas en main, et elle permet de frapper quelqu'un qui passe, contrairement à un arc.

Une action de créature peut aussi porter l'`area` dans laquelle elle touche, dans ton unité : `{ "shape": "cone",
"size": 15 }`, avec `"friendlyFire": false` pour épargner son camp. C'est ainsi qu'un souffle devient un vrai cône sur le plateau plutôt qu'un nombre de cibles. Une séquence n'a pas de forme propre ; les actions qu'elle nomme ont les leurs. Un combat sans plateau ignore la forme et utilise `targetCount` ; une entrée de créature peut donc porter les deux et rester fidèle dans les deux cas.

**Jusqu'où envoyer une forme.** `range` le dit : une boule lancée à cent pieds en possède un. Sans portée, une explosion se produit là où elle est posée, sur la case de l'acteur, et un cône ou une ligne peut viser n'importe où dans la longueur qu'il dessine, car la case n'y indique que la direction. Cela vaut autant pour le `mechanics.area` d'une entrée de catalogue que pour l'aire d'une créature.

`ranged` indique le coût d'un tir au-delà de sa distance ordinaire `normal`, ou avec quelqu'un du camp adverse dans la case voisine. Chacun vaut `"disadvantage"` ou `"normal"` ; omets le bloc et aucun ne coûte quoi que ce soit. Une frappe n'est jamais un tir, donc aucune règle ne l'affecte, ni une arme de lancer utilisée dans sa propre allonge.

**Zones.** Le `mechanics.area` d'une entrée devient une vraie forme sur le plateau, visant une case plutôt qu'une personne, et `targetCount` n'y décide rien : la forme détermine combien elle atteint. Tous ceux qui occupent ces cases sont touchés, amis comme ennemis, sauf si l'entrée indique `"friendlyFire": false`.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

Une explosion englobe toutes les cases à une distance inférieure ou égale à sa taille de la case visée. Un cône part de l'acteur vers cette case, aussi large à chaque pas qu'il est éloigné. Une ligne suit la même direction, sur une case de large. Les trois s'arrêtent devant tout élément solide.

Une ligne sur la `mechanics.area` d'une entrée ou l'`area` d'une action de créature peut porter `width` dans la même unité que `size`, arrondie en cases avec un minimum d'une case (Capability API 1.128), par exemple `{ "shape": "line", "size": 60, "width": 10 }` pour une ligne de 60 pieds large de 10 pieds ; omets-le pour une case, et une largeur paire en cases place sa colonne supplémentaire à gauche du lanceur.

**Ligne de vue et couverture.** Une ligne droite de cases entre les deux : un mur ou une montagne sur cette ligne bloque un tir et empêche une zone de s'étendre au-delà, et la cible n'apparaît simplement pas au menu. On voit par-dessus l'eau : un tir traverse une rivière, et une zone en ligne continue au-dessus. Les combats propres du moteur utilisent le même test de vue.

La couverture se lit depuis l'endroit où se tient l'attaquant, selon les lignes de coin de la règle optionnelle de grille du DMG : depuis le meilleur coin de l'attaquant, une ligne vers chaque coin de la case de la cible. Trois ou quatre lignes passant par un mur ou une montagne donnent une couverture aux trois quarts ; une seule ligne qui en traverse un, ou qui traverse un terrain offrant une couverture (bois, ruines), donne une demi-couverture ; un terrain bas seul ne donne jamais plus qu'une demi-couverture. Une cible que l'attaquant ne peut pas voir du tout a une couverture totale et n'apparaît pas au menu. Contre une attaque, une cible qui se tient sur un terrain offrant une couverture a au moins une demi-couverture, comme toujours ; une sauvegarde n'est aidée que par ce qui se trouve entre elle et l'effet.

- `cover.bonus` est ce qu'une demi-couverture ajoute à la défense contre laquelle une attaque est lancée, et le journal le précise.
- `cover.threeQuarters` (Capability API 1.74) est ce qu'ajoute une couverture aux trois quarts ; sans lui, `bonus` sert pour les deux.
- `cover.saves` (1.74) nomme les sauvegardes que la couverture aide aussi, contre la sauvegarde propre d'une action (jamais une sauvegarde qui met fin à un état ou maintient la concentration) : depuis l'endroit où tombe une explosion, et depuis son auteur pour tout le reste. Le journal le dit aussi.
- `cover.creatures` (1.74) fait de toute personne qui se trouve sur le chemin une demi-couverture, amie ou ennemie.
- Une sauvegarde dont le texte dit que la cible ne bénéficie d'aucune couverture (le Sacred Flame de 5e) indique `"ignoresCover": true` (1.74), sur le `mechanics.save` d'une entrée, le `save` d'une action de créature ou le `save` de l'utilisation d'un objet.

**Hauteur.** Un plateau peut avoir de la hauteur, jusqu'à trois niveaux, et tout combat positionné se déplace et voit en en tenant compte, quoi que dise l'ensemble : monter d'un niveau coûte une case de plus, descendre ne coûte rien, une marche de deux niveaux ou plus est une falaise que personne ne franchit à pied (et sur laquelle personne n'est poussé), et un sol plus haut que les deux extrémités bloque la vue. En tirant vers le bas depuis un terrain plus élevé, une couverture basse entre les deux ne cache rien. Un ensemble indique ce que son système ajoute avec `elevation` (Capability API 1.75, et cela nécessite `distance`) :

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` est la hauteur d'un niveau dans la distance propre de l'ensemble.
- `highGround` est ce que frapper vers le bas depuis un terrain plus élevé donne à un jet d'attaque : `"advantage"`, ou `{ "bonus": n }`, retiré de la défense contre laquelle l'attaque est lancée. S'il est omis, il ne donne rien.
- `rangeBonus` est le nombre de cases supplémentaires que porte un tir depuis un terrain plus élevé.
- `falling` est ce que fait une chute : quelqu'un poussé d'une marche de deux niveaux ou plus atterrit en dessous et subit `dice` pour chaque `per` de la chute (niveaux multipliés par `levelHeight`), au plus `max` dés, de `type`, puis reçoit l'état `prone`, quand il y en a un. Les dés sont lancés comme le système lance les dégâts : additionnés, ou sous `dice-pool` comptés comme des réussites dont on retire l'absorption. Une chute est un coup comme un autre : elle peut donc mettre quelqu'un à terre ou rompre sa concentration. Le journal indique de quelle hauteur il est tombé. Sans `falling`, la chute est notée et ne fait rien.

**Frappes sur quelqu'un qui s'éloigne.** Déclare `opportunity.budget` : lorsqu'un combattant quitte en marchant l'allonge d'un ennemi debout, capable d'agir, disposant de ce budget et d'une arme de mêlée, le déplacement S'ARRÊTE là où il est et cet ennemi est invité à frapper ou non. Accepter dépense le budget et se résout exactement comme la même attaque pendant son propre tour ; laisser passer ne coûte rien. Dans les deux cas, la marche reprend où elle a été suspendue, en payant chaque case réellement traversée ; une frappe qui fait tomber le personnage en mouvement termine sa marche là où il tombe. Une occasion chacun pour toute la marche, quel que soit le nombre de fois où le chemin quitte la même allonge. `disengage` l'empêche pour le reste du tour, et un ensemble de règles sans `opportunity` n'a rien de tout cela.

La demande est une FENÊTRE, et elle suspend tout le combat : rien d'autre ne bouge avant la réponse de toutes les personnes interrogées. Le joueur répond à la fenêtre d'un membre du groupe, avec la frappe ou **Pass** (passer) à côté ; les autres sont gérées par celui qui les joue, un boss du Game Master par la décision du Game Master lui-même. Voir Fenêtres ci-dessous.

**Ce qu'un adversaire fait du plateau.** Un adversaire que personne ne joue évalue chaque case accessible face à chaque option qu'il pourrait y prendre, retire des points pour chaque frappe provoquée par la marche et préfère rester immobile s'il peut déjà faire de son mieux depuis sa position. Sans rien à portée, il se rapproche et sprinte d'abord si ta liste `standard` contient `dash`.

**Refus possibles.** `out-of-reach` (au-delà de la portée), `no-line-of-sight` (un obstacle solide), `unreachable` (une case que la marche ne peut payer ou sur laquelle elle ne peut finir) et `bad-cell` (une forme visant un endroit interdit).

### Ce que le combat fait de ton bloc sur le serveur

Une partie dont l'ensemble de règles déclare `combat` obtient un combat résolu par celui-ci, dans la même bataille sauvegardée qu'Engine a toujours utilisée :

- **Qui participe.** Le Game Master indique qui combat ; Engine lit les nombres de chaque membre du groupe dans sa propre fiche. Un membre sans fiche pour ton ensemble de règles est refusé par son nom plutôt que de recevoir des nombres que tu n'as pas écrits.
- **D'où viennent les nombres d'un adversaire**, dans cet ordre : la créature nommée par le Game Master dans ton bestiaire ; puis celle dont le libellé correspond au nom de l'adversaire ; puis un bloc de statistiques proposé pour ce combat par le Game Master, ajusté à ton échelle de menace ; enfin, une créature simple construite avec les nombres du palier. Chaque solution de repli et chaque ajustement est consigné en mots simples pour que le combat puisse expliquer son intervention. Un ensemble de règles sans entrée de bestiaire, proposition ni échelle de menace refuse le combat plutôt que d'en inventer un.
- **Tes fiches font foi.** Santé, réserves, états, concentration et compteurs de ta règle d'agonie sont écrits selon les propres règles de la fiche après chaque action acceptée ; un rechargement en plein combat montre donc exactement ce qu'il a laissé, sans bilan final qui pourrait le contredire.
- **Ton menu est la seule source de légalité.** Tout acteur, joueur ou adversaire, choisit un identifiant dans le même menu produit par ton bloc. Un adversaire joué par Engine y choisit avec les tactiques d'Engine ; un adversaire joué par le Game Master est invité à choisir un identifiant dans ce même menu, voit tes nombres et n'apprend jamais ce que feront les dés.
- **Tes dés.** Un combat possède sa propre graine et un curseur ; relu depuis le disque, il reprend donc avec les dés qu'il aurait lancés.

### À l'écran

Le combat se joue sur l'écran de bataille dans tes mots. Le menu contient tes attaques, tes capacités, tes confrontations et les actions standard que tu as listées, chacune indiquant ce qu'elle dépense dans tes budgets et réserves. L'ordre des tours, le round, chaque état nommé avec ses rounds restants, les points temporaires, la concentration et les deux compteurs de ta règle d'agonie sont affichés. Le journal imprime le calcul réel dans tes termes : "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Chaque action acceptée est écrite sur la fiche au moment où elle se produit ; un rechargement en plein combat est donc exact, et le Game Master reçoit ensuite l'instruction de ne pas changer ces nombres à nouveau.

Un combat avec positions est dessiné sur le plateau plutôt que sur la scène des portraits ; voir Positions pour les interactions du joueur. Chaque distance, sur le plateau, dans le menu et dans le journal, est exprimée dans TON unité : "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Confrontations : agripper, pousser, se libérer

Certaines actions ne sont pas une attaque contre une défense mais une confrontation : les deux camps lancent les dés, et celui qui fait mieux obtient gain de cause. Agripper quelqu'un, le renverser ou le repousser, et se libérer ont tous la même forme ; un ensemble exprime donc chacune de ces actions sous forme de données :

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`** sont les nombres que lit une confrontation, chacun une valeur de la fiche, lue une fois au début du combat comme une défense ou une sauvegarde. Une créature écrite en nombres simples donne les siens (`"checks": { "brawn": 2 }`) ; une créature dotée d'une fiche les lit sur celle-ci. Jusqu'à douze.
- **Le jet.** Les deux camps lancent tes `attackRoll.dice` et ajoutent le meilleur des tests qu'ils peuvent utiliser ici (`attacker.checks`, `defender.checks`). Le total le plus élevé gagne ; une égalité profite au défenseur, sauf si `ties` indique `"attacker"`. Le journal indique les deux camps : "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins."
- **Gagner** fait ce que dit `onWin`, au moins une chose :
  - `applies` inflige des états au perdant avec le gagnant comme auteur ; un état que tu marques `endsWhenSourceDown` prend donc fin quand celui qui maintient la prise tombe. `rounds` lui donne une horloge ; sans lui, il dure jusqu'à ce que quelque chose y mette fin.
  - `ends` retire des états à l'acteur ou à la cible.
  - `push` éloigne le perdant en ligne droite du gagnant, de cette distance dans ton unité, en s'arrêtant avant tout obstacle solide, toute personne debout, le bord du plateau et un coin trop étroit pour s'y faufiler. C'est un déplacement forcé : il ne dépense rien de son mouvement et personne ne le frappe pour autant. Un combat sans plateau ne déplace personne. Perdre ne fait rien : c'est ce qu'est une prise ratée.
- **`from: { "holding": "held" }`** fait qu'une confrontation ne vise que celui qui a infligé cet état à l'acteur, et ne la place au menu que tant que l'état dure : c'est ainsi que s'exprime se libérer.
- **`reach`**, dans ton unité de distance, est sa portée ; la case voisine si tu l'omets. `reach` et `push` exigent `combat.distance`.
- **`strike: true`** lui permet de remplacer une attaque quand une action en achète plusieurs, comme le fait une attaque : prise en premier, elle dépense le budget et laisse les autres attaques disponibles ; prise avec des attaques disponibles, elle en coûte une. La référence 5e gère ainsi la lutte et la bousculade.
- **Dans le menu**, une confrontation a son propre groupe et indique sa chance de gagner. Un adversaire joué par le moteur l'évalue comme le reste, mais avec mesure : une prise ou une poussée prépare quelque chose, et se libérer vaut le plus, seulement quand on est tenu. Un Game Master qui joue un adversaire en choisit une dans le même menu.
- Un adversaire inventé par un Game Master voit ses tests limités à son palier, comme sa chance de toucher.

Les confrontations relèvent de Capability API 1.43 pour un ensemble en package.

<a id="windows-holding-the-fight-open"></a>

### Fenêtres : maintenir le combat ouvert

Certains moments appartiennent à quelqu'un d'autre que l'acteur en cours. Engine maintient le combat ouvert pour cette personne plutôt que de décider pour elle ; cette pause est une fenêtre.

Sept événements en ouvrent une, dont deux proviennent de ce que tu as déjà déclaré :

- **Quelqu'un s'éloigne.** Une marche qui quitte l'allonge d'un ennemi capable de frapper s'arrête à cette étape et l'interroge. Voir Frappes sur quelqu'un qui s'éloigne, ci-dessus.
- **Entre deux tours.** À la fin d'un tour, chaque adversaire possédant des `signaturePoints` et pouvant payer l'une de ses propres actions `signature` est invité à en acheter une, avant le début du tour suivant. C'est le seul moment où elles s'achètent, sauf indication contraire de `combat.signatureAtTurnStart` : une action distinctive ne figure sur aucun menu de tour, pas même le sien.
- **Le tour d'un adversaire commence** (Capability API 1.805). Avec `"combat": {"signatureAtTurnStart": true}`, tous ceux qui possèdent des `signaturePoints` sont aussi interrogés au début du tour d'un adversaire, une fois que ce que ce début déclenche (états, sauvegardes, réactions) a eu lieu et avant que l'adversaire agisse : un boss répond au héros sur le point d'agir, comme le fait l'anticipation dans un combat générique. Les actions de repaire gardent leur propre compte et ne sont pas proposées à ce moment. Si ce réglage est omis, les actions distinctives ne s'achètent qu'entre les tours, comme les actions légendaires de 5e. Un ensemble de règles qui l'utilise nécessite Capability API 1.805.
- **Quelqu'un utilise quelque chose.** Avant sa résolution, toutes les personnes de l'AUTRE camp qui possèdent une entrée attendant ce moment sont interrogées, quelle que soit la cible, tant que cette entrée atteint celui qui l'utilise. Une action standard et une confrontation n'ouvrent pas ce moment.
- **Quelque chose vise quelqu'un.** Avant sa résolution, toutes les cibles de l'AUTRE camp possédant une entrée qui attend ce moment sont interrogées. Un ami qui te soigne n'est pas une menace à laquelle répondre ; son action n'ouvre donc aucune fenêtre.
- **Un jet d'attaque touche quelqu'un.** Avant ses dégâts, la personne touchée est interrogée si elle possède une entrée qui attend ce moment. Ce qu'elle choisit compte pour cette attaque : voir Le moment après un coup au but, ci-dessous.
- **Quelque chose a blessé quelqu'un.** Après sa résolution, toutes les personnes blessées possédant une entrée qui attend CE moment sont interrogées, quel qu'en soit l'auteur. Être blessé est un fait qui te concerne ; une entrée renvoyée vers le responsable ne peut toujours pas viser un ami.
- **Quelqu'un tombe.** Avant les dégâts et la chute à terre, pour quiconque possède une réaction qui atteint celui qui tombe et autorise son camp (Capability API 1.124).

- **Quelqu'un commence son tour.** Avant qu'il n'agisse, pour une entrée qui l'atteint dans le camp qu'elle vise (Capability API 1.131).

Les six dernières sont celles qu'une entrée de catalogue, ou l'action propre d'une créature, demande en nommant le moment qu'elle attend. Quand une même action ouvre à la fois `used` et `aimed`, l'utilisation est interrogée d'abord ; si personne ne l'annule, ceux qu'elle vise sont interrogés ensuite, et elle se résout une fois que les deux ont répondu. Être touché est interrogé à chaque jet qui touche, et être blessé une fois l'action entière terminée.

Ce que fait une fenêtre, quelle que soit son origine :

- **Rien d'autre ne bouge tant qu'elle est ouverte.** Ni l'acteur dont c'est le tour, ni la fin de ce tour, ni une autre fenêtre. Le combat attend. Une chute retient son atterrissage le temps que l'étape d'action qui l'a causée se termine ; les chutes suivantes sont interrogées ensuite.
- **Elle interroge une personne à la fois**, dans l'ordre des tours, une seule fois chacune. Passer est toujours une réponse et ne coûte rien. Une personne interrogée qui ne peut rien exécuter est ignorée plutôt qu'interrogée.
- **Elle reprend exactement où elle s'était arrêtée.** Une marche termine les cases restantes, en payant chacune de celles réellement traversées.
- **Celui qui joue répond.** La fenêtre de ton membre du groupe t'appartient, avec l'option et **Pass** (passer) à côté dans le menu ; celle d'un adversaire est gérée par celui qui le joue, et un boss du Game Master est interrogé par l'intermédiaire du Game Master, avec laisser passer ce moment parmi ses réponses.
- **Elle est sauvegardée avec le combat.** Une partie fermée au milieu d'une marche revient avec les mêmes personnes à interroger et les mêmes cases à parcourir.

Tu ne déclares rien pour les deux premières : un ensemble de règles avec `opportunity.budget` obtient l'une, un bestiaire avec `signaturePoints` obtient l'autre, et un ensemble de règles sans aucun des deux ne les voit jamais.

**Indiquer le moment qu'une entrée attend.** Écris `mechanics.reaction` comme un objet plutôt que `true` :

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` vaut `used`, `aimed`, `hit`, `harmed`, `falls` ou `turn-start` et place l'entrée dans le menu de cette fenêtre. Ce sont les six seuls moments qu'Engine surveille. Une entrée qui indique encore `"reaction": true` dit seulement qu'elle ne s'exécute pas pendant un tour ; cela ne suffit pas à la proposer quelque part, elle ne figure donc sur aucun menu.
- `at` vaut `source` (par défaut), `target` ou `chosen`. `source` dirige l'action vers le responsable du moment et remplit la cible, donc personne n'est invité à choisir ; `chosen` conserve les propres cibles de l'entrée et demande un choix. `target` vise la créature que concerne le moment. Une réponse `falls` s'applique à ceux qui tombent et qu'elle a choisis.
- `cancels` empêche entièrement ce que la fenêtre retenait de se produire. Seule une entrée `used` ou `aimed` peut le déclarer : un moment déjà survenu ne peut être annulé, et un coup au but a déjà été lancé.
- `against` restreint ce à quoi l'entrée répond aux éléments utilisés depuis certains catalogues : `"against": { "catalogs": ["spells"] }` répond à un sort et à rien d'autre. Une action sans entrée derrière elle (une arme d'une liste, l'action propre d'une créature) ne vient d'aucun catalogue ; elle n'ouvre donc jamais le moment pour une entrée qui nomme des catalogues. Omets `against` et l'entrée répond à tout.

Donne-lui aussi un `budget`, sinon elle dépense celui par défaut de la liste. Une réaction dépense presque toujours un budget propre, ce qui empêche un tour d'en contenir plusieurs.

**Son coût est dépensé avant d'interroger qui que ce soit.** Une action annulée est empêchée de se produire, pas d'avoir été achetée : budget et réserves sont déjà dépensés. Si ton système les rembourse, il ne peut pas encore le dire.

Un contre s'écrit ainsi, et sur un plateau il ne répond qu'à quelqu'un situé dans sa propre `range` :

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**Un contre qui ne monte que jusqu'à un certain niveau** (Capability API 1.116). `"upTo": "paid"` sur une réaction `used` qui annule n'arrête que ce qui a été payé à un niveau qui ne dépasse pas celui de la réponse elle-même, et `"above": { "check": <value>, "dc": 10 }` est le test qui arrête malgré tout quelque chose de plus élevé, contre `dc` plus son niveau. C'est le Counterspell de 5e, qui arrête un sort du niveau de son emplacement ou inférieur et demande au-delà un test de caractéristique d'incantation contre 10 + le niveau du sort, et qui se lance à niveau supérieur comme tout sort :

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

Le niveau de tout ce qui est payé est le niveau de la réserve dont il provient : le `level` propre d'une réserve, une valeur lue sur la fiche de son porteur, quand elle en indique un (les emplacements de pacte de 5e, lancés au niveau d'emplacement de l'occultiste), et sinon sa place dans son groupe, la première réserve étant de niveau 1. Ce qui n'a rien coûté, ou provient d'une réserve sans groupe, est de niveau 0 : tout contre de ce genre l'arrête donc. Le test utilise les propres dés du combat avec les états de celui qui répond sur les tests ; un combat `dice-pool` n'a pas de DD à atteindre et refuse `above`. Une créature sans fiche écrit son test `{ "const": n }`. Le journal indique le niveau et le jet chaque fois que la réponse vise plus haut qu'elle-même, et la ligne habituelle suit quand elle l'arrête. Sans `above`, quelque chose de plus élevé n'est simplement pas arrêté, et ce que la réponse a coûté reste dépensé.

**Le moment après un coup au but.** Une entrée sur `hit` est la manière d'exprimer Shield, une parade (Parry) et Uncanny Dodge. L'attaque est retenue après son jet, et la personne touchée est interrogée avant que des dégâts soient infligés. Ce qu'elle choisit compte pour cette attaque : son jet n'est pas refait mais vérifié à nouveau, contre sa défense telle qu'elle est maintenant ; un état qui ajoute à la défense peut donc transformer le coup au but en échec, et une face naturelle qui touche toujours touche encore. Un état qui dure une attaque (`endsAfter: "attacked"`) infligé en réponse couvre cette attaque, dégâts compris, et s'épuise avec elle. C'est ainsi que s'exprime "réduire de moitié les dégâts de cette attaque" : `resist-all` pour une seule attaque.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

L'attaque reprend exactement où elle a été retenue : le reste de ses cibles et, pour une action de créature faite d'autres actions, le reste de ses parties. Chaque jet qui touche quelqu'un possédant une telle réponse est retenu à son tour, et un combat sauvegardé pendant que la fenêtre est ouverte revient de la même manière. Une attaque faite à l'intérieur d'une fenêtre (une frappe sur quelqu'un qui s'éloigne, une action distinctive, une réponse) n'est jamais retenue, car rien de ce qui s'ouvre à l'intérieur d'une fenêtre n'en ouvre une autre. Le journal montre le jet et ce contre quoi il a été fait à l'ouverture de la fenêtre et, quand la réponse a changé la défense, s'il rate désormais. Les adversaires joués par le moteur ne prennent une garde que lorsqu'elle transforme le coup au but en échec.

Un package qui nomme un moment nécessite Capability API 1.33, et un package qui utilise `used` ou `against` nécessite 1.44. Un package qui attend `hit` nécessite 1.46.

**Répondre à un sort par son nom** (Capability API 1.117). `against` peut nommer des `entries` sous la forme `<catalog>/<entry>` à côté de `catalogs`, et l'une ou l'autre correspondance ouvre le moment. `also` prend la même réponse à jusqu'à trois autres moments, chacun avec son propre `against`. Le `noDamageFrom` d'un état écarte entièrement de son porteur les dégâts de ces entrées tant qu'il dure, quel que soit leur type. Le Shield de 5e se prend quand une attaque touche et quand Magic Missile vise son lanceur, et sous son effet Magic Missile ne fait rien :

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

Seul le premier moment peut annuler : une réaction qui annule n'a donc pas d'`also`. Le catalogue qu'une entrée nomme doit être un catalogue de l'ensemble. Une entrée qui n'y figure pas n'ouvre simplement jamais le moment. Un coup écarté de cette façon apparaît dans le journal comme un coup contre lequel la cible est immunisée.

**Ne répondre qu'à certains coups** (Capability API 1.118). Un moment `hit` peut indiquer `"blow": "melee"` ou `"blow": "ranged"`. Un coup est au corps à corps tant que sa cible se tient à portée d'allonge de l'arme : une dague lancée de loin est donc à distance, et la même dague utilisée à côté de sa cible est au corps à corps. Une arme qui a une allonge et pas de portée est toujours au corps à corps, et une arme qui a une portée et pas d'allonge est toujours à distance. Dans un combat sans plateau, une arme qui a une allonge est considérée comme maniée en main. `"seesSource": true`, sur n'importe quel moment sauf `falls`, ne l'ouvre que tant que son porteur voit celui qui l'a causé. Cela signifie une ligne de vue entre eux sur le plateau (sans plateau, tout le monde voit tout le monde), et jamais quelqu'un qui a fait l'action standard Hide, jusqu'à ce qu'elle se dissipe au début de son prochain tour. Le Parry de 5e utilise les deux :

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

Les deux clés peuvent aussi s'écrire sur un moment de `also`, et `blow` seulement sur un moment `hit`.

**Rattraper une chute** (Capability API 1.124). Une réaction sur `falls`, y compris dans `also`, répond à une créature qui tombe d'un rebord ou à un volant forcé de redescendre au sol, avant que la chute n'inflige des dégâts ou ne la mette à terre. Sa portée et le camp qu'elle vise sont vérifiés par rapport à celui qui tombe, et sa réponse s'applique à cette créature. Pour Feather Fall, donne ces mécaniques à l'entrée et déclare `feather_falling` dans les états vivants de la fiche :

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

Son entrée `combat.conditions` s'écrit `{ "condition": "feather_falling", "fallsSafely": true }`. Tant qu'il dure, cet état empêche les dégâts de chute et l'état à terre qu'une chute appliquerait ; il ne retire pas un état qui a causé la chute. Utilise `targets: "self"` pour une réponse qui ne vaut que pour la chute du lanceur lui-même. Une chute n'a pas d'entrée source : sa réaction ne peut donc porter ni `cancels`, ni `blow`, ni `seesSource`, ni `against`. Une entrée à cible unique interroge sur chaque chute séparément. Cela résout l'atterrissage ; cela ne suit pas une descente ralentie.

**Répondre pour une autre créature** (Capability API 1.131). `for` vaut `self` par défaut ; `ally` exclut le porteur, tandis que `any` l'inclut. Les deux interrogent les porteurs du camp de la cible situés dans la distance `within` exigée, dans l'unité de distance du catalogue, et seulement sur `aimed` ou `hit`. Ces clés fonctionnent aussi sur chaque moment `also`. `seesSource` exige toujours de voir l'attaquant. Protection applique `own-attacks-disadvantage` à la source avant que les dés d'attaque ne soient lancés. Sa durée `this-action` prend fin quand l'action se résout ou est annulée. Sans portée explicite vers la source, la réponse d'un témoin atteint cette source ; `within` mesure la distance jusqu'à la créature protégée. Déclare `protected_attack` sur la fiche et donne cet effet à son état de combat :

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**Placer la réponse sur la cible.** `at: "target"` s'applique à la créature attaquée, tandis que `source` reste l'attaquant. Shield Guardian représente le porteur de l'amulette comme un allié à 5 ou moins ; `parrying` accorde `+2` de défense. Le coup retenu revérifie la défense de cet allié après la réponse :

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**Au début d'un tour.** `on: "turn-start"` interroge quand une créature du camp visé par l'entrée commence son tour à sa portée, avant que cette créature n'agisse. Cette créature est la `source`. Une entrée nuisible répond à l'autre camp, une entrée utile à son propre camp. Elle ne peut porter ni `cancels`, ni `blow`, ni `against`, ni `upTo`. L'action de créature Unnerving Mask demande une sauvegarde de Sagesse ; une ronde sur le décompte de la créature affectée dure pendant ce tour et expire à sa fin (laisse `of: "source"` de côté) :

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**Annuler sur une sauvegarde.** `cancelSave: { save, dc }` exige `cancels` ; le porteur lance avec ses modificateurs de sauvegarde habituels. Une réussite annule, un échec laisse l'action d'origine se résoudre, et dans les deux cas la réaction est dépensée. `against.actions` nomme de une à douze actions de bloc de statistiques, en comparant le nom entier sans tenir compte de la casse (80 caractères au plus chacun). Rock Catching représente le fait d'attraper le rocher en annulant toute l'attaque, dégâts compris, plutôt que ses seuls dégâts contondants. Les identifiants de sauvegarde sont ceux de ton ensemble (`dex` ici ; `dex_save` dans l'exemple 5e fourni) :

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**Rattraper plusieurs chutes.** Une entrée `falls` avec un `targetCount` supérieur à un propose les créatures admissibles qui tombent à cause d'un même coup ou d'un même effet, à portée et dans le camp qu'elle vise. Le menu et le directeur prennent par défaut toutes les créatures admissibles jusqu'au nombre indiqué, les plus proches d'abord ; le joueur peut modifier la sélection. Une chute ultérieure est un événement séparé. Feather Fall utilise le même état `fallsSafely` que ci-dessus :

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### Pas encore

Dit clairement, car un ensemble de règles ne doit pas promettre ce qu'Engine ne fait pas :

- **Au-delà du plateau modeste** : pas de vol au-dessus des obstacles. Une créature n'est déplacée que par sa propre marche, celle d'une monture, une téléportation, ce qui la pousse (une confrontation, une entrée, l'action d'une créature ou une zone) et quiconque la traîne.
- **Une confrontation est simple.** Son jet n'ouvre aucune fenêtre, mais une chute qu'elle provoque peut recevoir une réponse.
- **Une entrée ne peut attendre que six moments**, `used`, `aimed`, `hit`, `harmed`, `falls` et `turn-start` (voir Fenêtres, ci-dessus). Ce sont les moments qu'Engine remarque pour une entrée ; les deux autres fenêtres, quelqu'un qui s'éloigne et la pause entre deux tours, sont ouvertes par le combat lui-même et ne sont pas des moments qu'une entrée peut demander. Il n'existe pas de moment pour un jet de sauvegarde ou une mort.
- **Pas d'enchaînement.** Le combat conserve une fenêtre plutôt qu'une pile, donc rien ouvert à l'intérieur d'une fenêtre n'en ouvre une autre : un contre ne peut pas être contré à son tour, ce qu'inflige une réaction n'ouvre aucun autre moment, et une attaque faite à l'intérieur d'une fenêtre n'est pas retenue quand elle touche. Une chute à laquelle on peut répondre, causée pendant une fenêtre, est retenue jusqu'à la fermeture de celle-ci, puis interrogée à son tour.
- **Seul un jet d'attaque est un coup au but.** Ce qui atteint sa cible sans jet (des fléchettes qui touchent d'office, une zone contre laquelle chacun fait une sauvegarde) n'ouvre aucun moment `hit`.
- **Les modificateurs de dégâts concernent les coups d'attaque.** Une réponse peut placer un modificateur de dégâts sur son porteur ou réduire de moitié les dégâts reçus avec `resist-all` ; les modificateurs de dégâts ne modifient jamais un effet fondé uniquement sur une sauvegarde.
- **Rien n'est remboursé.** Le coût d'une action annulée reste dépensé.
- **Ce qu'un état modifie est une liste fermée.** La défense, les jets d'attaque, les sauvegardes, les tests de confrontation, la vitesse, le maximum de santé, les dégâts infligés et les dégâts subis (aussi pour les niveaux et les effets d'objets). Les modificateurs de dégâts ne modifient que les coups d'attaque ; ils ne s'ajoutent jamais aux dégâts fondés sur une sauvegarde ni aux coups automatiques.
- **Une créature écrite en nombres simples n'a pas de piste de blessures.** Dans un ensemble de règles dont la santé est une piste, cette créature perd toujours des points ; donne-lui une `sheet` et les coups qu'elle reçoit marqueront des cases, d'abord atténués par ses propres `resist`, `vulnerable` et `immune`.
- **Un effet supplémentaire se déclenche seul.** `on` n'a qu'une valeur, `hit` : le premier coup au but admissible de la période l'applique, sans moment où l'on te demande si tu souhaites en dépenser un.
- **Un nombre que les attaques déplacent est simple.** Un coup qui dépense lance le nombre et rien d'autre : aucune arme ne le modifie, son `floor` compris (une cible robuste absorbe un coup qui prend, et sa dureté arrête un coup qui dépense, mais rien d'autre ne réduit l'un ou l'autre) ; un effondrement prend fin après un nombre fixe de tours, quelle que soit sa profondeur ; et une attaque faite dans une fenêtre (une frappe sur quelqu'un qui s'éloigne, une réaction, une action distinctive) se fait dans le premier style.
- **Un adversaire inventé n'absorbe rien et n'a pas de dureté.** Une créature que le Game Master invente pour un combat est limitée à ton échelle de menace, qui ne dit rien de l'absorption ni de la dureté ; elle n'a donc ni l'une ni l'autre.
