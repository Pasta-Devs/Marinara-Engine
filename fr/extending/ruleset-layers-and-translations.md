# Couches, traductions et migrations des ensembles de règles

Cette page fait partie du guide [Écrire des ensembles de règles Game Mode](writing-rulesets.md). Elle traite des variantes qu'un joueur active pour une partie, des traductions du texte d'un ensemble de règles et du déplacement de valeurs vers de nouveaux identifiants quand une fiche change.

## Couches : variantes de ton propre ensemble de règles

Une couche est une variante nommée de ton ensemble de règles, activée par le joueur à la création d'une partie : magie rare, hiver rude, difficulté plus âpre. Les couches résident dans le fichier de l'ensemble de règles, dans un tableau facultatif `layers` ; elles voyagent donc avec lui et ne peuvent jamais manquer à une partie qui les a utilisées. L'assistant les affiche comme des interrupteurs sous ton ensemble de règles, et le choix reste fixé pour toute la durée de vie de cette partie, exactement comme l'ensemble lui-même.

```json
"layers": [
  {
    "id": "hard_winter",
    "label": "Hard winter",
    "summary": "Cold, hunger and short days. Everything is harder.",
    "conflicts": ["mud_season"],
    "gm": {
      "guidance": "Hard winter is on. Let a failed check cost warmth, food or daylight as well as progress.",
      "worldGuidance": "Hard winter is on. Build a world of closed roads, thin stores and rationed settlements."
    },
    "fields": [{ "id": "calling", "removeValues": ["Sailor"], "default": "Hauler" }],
    "difficultyLadder": [{ "label": "Easy", "dc": 7 }],
    "catalogs": [{ "id": "knacks", "hide": { "filter": "grit", "above": 0 } }]
  },
  {
    "id": "mud_season",
    "label": "Mud season",
    "summary": "Thaw, flooded roads and slow going."
  }
]
```

**Ce qu'une couche peut faire.** La liste est fermée, et chaque effet restreint quelque chose ou ajoute du texte :

- `gm.guidance` est ajouté à la fin de ton `gm.checkGuidance`, après ton propre texte et celui des couches précédentes. `gm.worldGuidance` est ajouté à `gm.worldGuidance` de la même manière.
- `fields` retire des valeurs d'un champ **énuméré**. `removeValues` nomme des valeurs déjà présentes ; au moins une doit subsister, et si le `default` du champ est retiré, la couche nomme à la place un `default` qui subsiste.
- `difficultyLadder` remplace ton échelle par une autre, dans la structure de ton propre type de résolution : `{label, dc}` pour `dice-sum` et `{label, successes, target?}` pour `dice-pool`. Elle subit exactement les mêmes vérifications que ton échelle. Lorsque plusieurs couches actives en déclarent une, la dernière l'emporte.
- `catalogs` masque des entrées du sélecteur de l'éditeur de fiches. Chaque règle nomme l'un des `filters` déclarés par ce catalogue et exactement une comparaison : `above` ou `below` pour un filtre `number`, `equals` ou `notIn` pour un filtre `text` ou `tags`. Une entrée qui ne définit pas ce filtre n'est jamais masquée.
- `currencies` retire des pièces : `removeUnits` nomme des pièces isolées et `removeFamilies` des familles entières. La plus petite pièce d'une famille ne part qu'avec sa famille ; chaque famille restante peut donc toujours payer et rendre la monnaie. Tant que la couche est active, personne ne gagne, ne paie avec, ne choisit ni ne lâche une pièce retirée, et la ligne de la bourse l'omet. Un prix exprimé dans cette pièce est donné dans la plus grosse pièce restante qui le paie exactement, à valeur égale : la longue nuit de Gravewatch retire la couronne ; un pistolet de guet à 3 couronnes coûte donc 15 shillings. Un objet dont toute la famille a disparu n'a pas de prix.

**Ce qu'une couche ne peut pas faire.** Elle ne peut ajouter une valeur énumérée, un champ, une compétence, une réserve ou un repos, changer le type de résolution, toucher l'état en cours ou les nombres de combat, ni ajouter un appel de modèle. Une valeur qu'une couche _ajouterait_ serait inconnue de tous les autres lecteurs de la fiche ; les valeurs ne peuvent donc que disparaître. Tout ce qui dépasse cette liste constitue une modification de l'ensemble de règles lui-même ou un second ensemble.

**Conflits.** `conflicts` nomme les couches qui ne peuvent être actives ensemble. Nommer un seul côté de la paire suffit. L'assistant désactive l'autre interrupteur, et si un choix sauvegardé contient malgré tout les deux, la couche déclarée **plus tard** est retirée ; les deux mêmes choix donnent donc toujours les mêmes règles.

**Une fiche contenant déjà une valeur retirée la conserve.** Rien ne réécrit un personnage. L'éditeur cesse simplement de proposer la valeur, et un personnage qui la possédait déjà l'affiche telle quelle. Désactive la couche dans une nouvelle partie et la valeur sera proposée à nouveau. Il en va de même pour une entrée de catalogue masquée : elle disparaît du sélecteur, et une ligne déjà choisie par le joueur reste sur la fiche. Les pièces qu'une couche retire et que quelqu'un transporte déjà restent dans son sac.

**Limites.** 12 couches par ensemble de règles et 4000 caractères de consignes par couche, les deux chaînes comptées ensemble. Un ensemble de règles en package qui déclare `layers`, ou un `gm.worldGuidance` de base, nécessite Capability API 1.25, et un ensemble dont les couches retirent des pièces nécessite 1.64. Un ensemble que tu importes est validé par Engine à la lecture et n'a donc besoin de rien.

**Les couches écrites par quelqu'un d'autre** (une couche de magie rare pour un ensemble de règles que tu n'as pas écrit, livrée dans son propre fichier) viendront plus tard. Aujourd'hui, une couche est livrée à l'intérieur de l'ensemble de règles auquel elle appartient.

## Traductions

**Traductions** (Capability API 1.811). Les chaînes affichées d'un ensemble de règles dans une autre langue sont regroupées en une traduction par langue, nommée d'après le code de la langue comme les propres packs de langue du moteur (`ru`, `pt-BR`, `zh-Hans`). Dans le catalogue officiel d'agents, chacune est un pack de langue à côté du fichier de l'ensemble de règles (ci-dessous). Un fichier de package d'ensemble de règles que tu partages peut les contenir à la place, avec un fichier par langue à côté de `ruleset.json` : `locales/<language>.json`, listé dans le manifeste comme les autres fichiers. Dans les deux cas, chacun est un catalogue de localisation de package avec une section `ruleset` : chaque clé est une chaîne affichée de l'ensemble de règles ou de ses catalogues, mot pour mot en anglais, et sa valeur est cette chaîne dans la langue du fichier.

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

`_meta.locale` doit être la langue d'après laquelle le fichier est nommé, et le fichier contient `$schema`, `_meta`, `package` et `ruleset`, sans rien d'autre, toutes les valeurs étant du texte. Une chaîne laissée vide n'est pas encore traduite et s'affiche en anglais ; un fichier sans section `ruleset` (la propre présentation en anglais d'un package, `locales/en.json`) ne traduit rien. Les traductions ne concernent que l'affichage : les règles, les commandes de fiche et tout ce qui est dit au GM continuent à lire l'anglais. L'écran d'un combat (noms, états, actions, sorts, journal et ordre des tours) affiche chaque chaîne dans la langue du joueur si la traduction de l'ensemble de règles la contient, d'abord depuis le fichier de cette langue, puis depuis celui de la langue dont elle est une variante (`pt` pour `pt-BR`), et en anglais sinon ; "Goblin 2" lit la traduction de "Goblin" avec son nombre. Un fichier de package contenant des traductions nécessite Capability API 1.811. Son importation ne conserve que la traduction dans la langue définie pour le moteur (ou dans celle dont elle est une variante) et supprime les autres ; pour lire l'ensemble de règles dans une autre langue, change la langue du moteur et importe de nouveau le fichier, ce qui remplace la traduction conservée. Les traductions ne font pas partie de la version : importer de nouveau la même version avec une traduction corrigée remplace donc aussi celle-ci, et un fichier de cette version sans traduction laisse celle qui était conservée.

Un ensemble de règles du catalogue ne contient jamais `locales/<language>.json` dans son fichier (s'il en contient un, il est refusé avant son téléchargement). Ses traductions sont des packs de langue (Capability API 1.811) : un fichier JSON par langue, `<id>-<version>.<language>.json`, publié à côté de `<id>-<version>.ruleset.json` et contenant exactement ce que contient un `locales/<language>.json` (`_meta.locale` indique la langue d'après laquelle il est nommé, et il possède une section `ruleset`). L'entrée du catalogue les liste à côté de son `artifact` :

```json
"locales": {
  "ru": {
    "url": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/ember-roads-1.0.0.ru.json",
    "sha256": "<64 hex>",
    "bytes": 812345,
    "name": "Угольные дороги",
    "description": "<the store card's description in Russian>"
  }
}
```

Chaque pack est une URL https de la même forme que celle de l'artefact, nommée d'après sa version et sa langue, avec son sha256 et sa taille (8 MB au plus) ; un ensemble de règles en liste au plus 40, jamais `en` (l'anglais est l'ensemble de règles lui-même), et son manifeste déclare Capability API 1.811. `name` et `description` sont ceux de la fiche de la boutique dans cette langue, de sorte que la fiche se lit dans la langue du moteur sans récupérer le pack. Une installation récupère le fichier de l'ensemble de règles, puis uniquement le pack dans la langue définie pour le moteur (ou dans celle dont elle est une variante), vérifie sa taille, sa somme de contrôle et sa langue, et le conserve avec la version installée. Quand la langue du moteur change (et chaque fois qu'une page s'y ouvre), chaque ensemble de règles installé depuis le catalogue qui liste un pack dans la nouvelle langue le récupère, et le pack de l'ancienne langue est supprimé. Un pack qui ne peut pas être obtenu (hors ligne, aucun pack listé ou fichier différent de celui que liste le catalogue) laisse l'ensemble de règles en anglais ; l'installation ou le changement de langue suivant réessaie. Une mise à jour conserve la version précédente pour permettre un retour arrière, sans son pack : après un retour arrière, le changement de langue suivant récupère de nouveau le pack de cette version, si le catalogue le liste encore.

## Déplacer des valeurs vers de nouveaux identifiants : `sheet.migrations`

Ajouter des éléments ne demande rien de plus. Quand une nouvelle disposition déplace une valeur ailleurs (un champ renommé, un niveau unique qui devient un niveau par classe, une réserve de dés de vie unique qui devient une réserve par dé), indique comment dans `sheet.migrations` (Capability API 1.77), pour que chaque personnage créé avec l'ancienne disposition garde ses nombres : dans la bibliothèque, dans les parties, dans les anciennes sauvegardes, branches et points de contrôle, et dans les fiches importées.

```json
"migrations": [
  {
    "from": 3,
    "steps": [
      { "rename": "field", "from": "xp", "to": "experience" },
      {
        "route": "level",
        "by": "class",
        "cases": [
          { "words": ["fighter"], "to": "level_fighter" },
          { "words": ["wizard"], "to": "level_wizard" }
        ],
        "else": "level_other",
        "default": 1
      },
      {
        "routeLive": "pool",
        "from": "hit_dice",
        "cases": ["hit_dice_d6", "hit_dice_d8", "hit_dice_d10", "hit_dice_d12"],
        "else": "hit_dice_d8"
      }
    ]
  }
]
```

- Chaque entrée fait passer une fiche stockée de la version `from` à `from + 1`, et s'exécute pour chaque fiche stockée à cette version ou à une version plus ancienne, dans l'ordre. N'en retire jamais une une fois qu'elle a été publiée : une fiche stockée il y a longtemps en a encore besoin. Une version qui ne fait qu'ajouter n'en a besoin d'aucune.
- `rename` (un `ability`, `skill`, `save` ou `field`) : la valeur est copiée vers son nouvel identifiant. Une compétence ou une sauvegarde emporte son bonus. Un renommage peut prolonger celui d'une entrée antérieure, ou alimenter un champ qu'un `route` ultérieur fait suivre ; l'importation suit la chaîne jusqu'à son terme.
- `route` : la valeur d'un champ va vers le champ que nomme le texte d'un autre champ. Un cas l'emporte quand ses mots apparaissent dans le texte de `by` comme mots entiers (seules les lettres forment un mot, donc "Fighter3" nomme un guerrier), sans tenir compte de la casse, et qu'un seul cas correspond. S'il n'y en a aucun, ou plusieurs ("Fighter 3 / Wizard 2", qu'un seul nombre ne permet pas de répartir sans demander), elle va vers `else`. `default` tient lieu de valeur pour une fiche qui ne l'a jamais stockée. `by` est un champ que la fiche possède, ou un champ qu'une disposition antérieure a renommé. Les cibles sont des champs numériques ou texte sans valeur par défaut, ou avec une valeur par défaut de 0 ou vide : la valeur arrive dans l'un d'eux et chaque autre garde sa valeur par défaut, si bien que toute autre valeur par défaut se lirait comme un niveau que personne n'a donné. Une cible qu'un renommage ultérieur déplace est suivie jusque-là.
- `routeLive` (un `pool` ou un `track` de l'état vivant) : la valeur stockée va vers celui des `cases` que la fiche migrée affiche (une réserve dont le maximum dépasse 0, une piste que la fiche ne cache pas), sinon vers `else`. Les pistes vers lesquelles va une valeur sont toutes des pistes de blessures (elle porte les marques) ou toutes des pistes ordinaires (elle porte le nombre).
- `setColumn` (Capability API 1.794) : `{ "setColumn": { "list": "attacks", "where": { "name": ["Dagger", "Rapier"], "ability": ["str", "dex"] }, "column": "ability", "to": "finesse" } }` définit la valeur d'une colonne sur chaque ligne d'une liste dont les colonnes `where` contiennent chacune l'une des valeurs listées (le texte est comparé sans tenir compte de la casse ni des espaces à ses extrémités ; un nombre doit correspondre exactement). Utilise-le pour corriger des lignes créées avant que ton ensemble de règles sache les gérer correctement, par exemple des lignes d'attaque créées avant que le choix d'attribut d'une arme existe. La liste et toutes les colonnes qu'il nomme doivent figurer sur la fiche.
- Chaque autre étape de construction copie : l'ancienne valeur reste là où elle était, si bien qu'une version plus ancienne de ton ensemble de règles lit toujours la fiche comme avant, et l'étape n'écrase jamais une valeur déjà présente dans sa cible. `setColumn` est la seule étape qui écrase.
- L'importation refuse une entrée égale ou supérieure à `sheet.version`, deux entrées partant de la même version, une étape qui écrit vers un identifiant que la fiche n'a pas, un cas listé deux fois, et un `rename` ou un `routeLive` qui lit un identifiant que la fiche possède encore (un identifiant déplacé n'est plus jamais utilisé, ce qui permet de relancer ces étapes sans risque).
- Les fiches sont migrées chaque fois qu'elles sont lues, et la nouvelle disposition est stockée à la modification suivante. L'état vivant n'a pas de version propre : `routeLive` s'exécute donc à chaque lecture ; l'ancienne clé est supprimée et sa valeur ne se déplace que tant que la nouvelle clé n'existe pas encore, si bien qu'une valeur dépensée ou restaurée par un repos depuis n'est jamais écrasée. L'endroit où elle est allée est fixé par la première écriture après la mise à jour : une fiche corrigée plus tard (un niveau de classe déplacé à la main) ne la déplace pas de nouveau. Un combat déjà en cours à l'arrivée de la nouvelle version se termine quand même, comme avant.
