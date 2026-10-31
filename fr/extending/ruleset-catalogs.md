# Catalogues des ensembles de règles

Cette page fait partie du guide [Écrire des ensembles de règles Game Mode](writing-rulesets.md). Les entrées préparées que l'éditeur de fiche propose dans un sélecteur : l'en-tête du catalogue, les entrées, les valeurs maintenues par l'ensemble de règles, les commandes de fiche et la commande d'utilisation.

Saisir une liste de sorts, un tableau d'équipement ou une page de capacités ligne par ligne est pénible. Un catalogue est une collection nommée d'entrées préparées que tu distribues avec l'ensemble. L'éditeur les propose dans un sélecteur sur chaque liste alimentée par le catalogue ; un choix remplit la ligne.

Les catalogues sont facultatifs. Un ensemble peut en avoir douze ; le moteur ne connaît pas leur sujet : chaque identifiant, colonne, filtre et mot vient de ton fichier.

## L'en-tête

L'en-tête va dans `catalogs`, au premier niveau du fichier, à côté de `gm`.

```json
"catalogs": [
  {
    "id": "knacks",
    "label": "Knacks",
    "feeds": ["knacks", "tricks"],
    "filters": [
      { "id": "grit", "label": "Grit cost", "type": "number" },
      { "id": "road", "label": "Road", "type": "text" },
      { "id": "callings", "label": "Calling", "type": "tags", "startFrom": { "field": "calling" } }
    ],
    "units": { "distance": { "label": "paces", "perCell": 2 } },
    "entries": []
  }
]
```

- `id` et `label` : l'identifiant suit les règles des identifiants de fiche ; le libellé nomme le sélecteur.
- `holds` : `"rows"` (valeur par défaut, et celle de tous les catalogues antérieurs à cette version), `"creatures"` ou `"items"`. Un catalogue de créatures est un bestiaire lu par le combat, et un catalogue d'objets liste ce que transporte une équipe. Aucun des deux n'écrit dans une fiche, ne déclare `feeds` ni n'apparaît dans le sélecteur. Consulte [Créatures](ruleset-combat.md#creatures-a-bestiary-a-fight-reads) et [Objets](ruleset-items.md) ci-dessous.
- `feeds` : les une à huit listes de fiche où ses entrées peuvent écrire. Obligatoire pour les lignes, refusé pour les créatures et les objets. Une entrée ne peut écrire ni dans une autre liste, ni une valeur que ses colonnes ne peuvent contenir.
- `filters` : facultatif, jusqu'à huit. Définit comment réduire le sélecteur : `number`, une valeur `text` ou `tags` (plusieurs mots). `startFrom` nomme le champ utilisé à l'ouverture : un personnage dont Calling vaut Tinker voit d'abord les entrées Tinker.
- `units` : facultatif. Définit le sens d'une portée ou d'une taille de zone dans le bloc `mechanics` d'une entrée.

## Une entrée

```json
{
  "id": "road-sense",
  "label": "Road Sense",
  "summary": "You read a road the way other people read a face.",
  "filters": { "grit": 0, "road": "Ash Flats", "callings": ["Scout", "Courier"] },
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Road Sense", "notes": "Sneak to notice where a road turns bad." }
    }
  ]
}
```

- `id` : minuscules, chiffres et tirets simples, unique dans le catalogue.
- `label` et `summary` : ce qu'affiche le sélecteur. Le résumé est facultatif, sur une ligne et limité à 300 caractères.
- `filters` : valeurs des filtres déclarés par l'en-tête. `number` prend un nombre ; `text`, une chaîne ; `tags`, une liste de chaînes.
- `rows` : ce qu'écrit le choix, entre une et six lignes. `list` appartient à `feeds` ; les clés de `values` sont les identifiants de colonnes de cette liste.
- `creature` : un adversaire plutôt que des lignes, dans un catalogue dont `holds` indique des créatures. Une entrée a exactement l'un de `rows` ou `creature`. Une créature ne porte pas `mechanics` : elle exprime ses effets dans ses actions.

Chaque valeur est vérifiée contre les colonnes cibles. Un nom mal écrit ou un nombre hors limites est signalé avec son entrée d'origine. Les entrées dans le fichier de règles sont vérifiées à son chargement, donc à l'importation pour un fichier importé. Un catalogue séparé de package est vérifié lorsque le sélecteur le demande pour la première fois ; s'il contient une erreur, il montre les raisons plutôt que des entrées.

## Une entrée, plusieurs listes

Une capacité à usages limités occupe deux lignes : la capacité et son compteur. Cela reste un seul choix.

```json
{
  "id": "last-ember",
  "label": "Last Ember",
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Last Ember", "notes": "Spend 1 Grit to give a downed friend 3 Grit back." }
    },
    { "list": "tricks", "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" } }
  ]
}
```

## Valeurs maintenues à jour par l'ensemble

Les nombres d'une ligne appartiennent au joueur dès qu'il la choisit. Une exception est utile : un maximum dépendant du personnage, comme des usages égaux à un attribut ou une ressource de classe qui augmente avec le niveau. Une ligne peut nommer jusqu'à quatre de ses colonnes numériques dans `scaled` ; l'éditeur maintient ces cellules à jour.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- La clé est l'une des colonnes `number` de la liste.
- `from` est une référence de valeur ordinaire, utilisant le même vocabulaire fermé qu'ailleurs. Pour plus complexe, déclare une valeur `derived` et pointe `from` dessus (`"from": { "derived": "lay_on_hands_max" }`). Aucune nouvelle arithmétique n'est ajoutée ici.
- `table` est facultatif. Il cherche la valeur de référence dans une table à seuils, comme un niveau donnant un nombre : `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`.
- `values` doit toujours contenir un nombre simple pour la colonne ; son absence est refusée. C'est la valeur avant de connaître une fiche et celle que garde une fiche sans cette référence.
- Une ligne avec `scaled` doit être l'unique ligne de l'entrée pour cette liste, pour qu'une ligne marquée corresponde toujours à une seule spécification, ou bien (Capability API 1.92) chaque ligne que l'entrée écrit dans cette liste doit porter son propre nom dans la colonne de nom de la liste (le `nameColumn` de ses réserves, sinon sa première colonne de texte). La ligne de la fiche est alors associée à sa spécification par ce nom : un même trait peut ainsi donner deux usages qui progressent chacun de leur côté ; une ligne renommée par le joueur est laissée telle quelle.

La valeur est calculée à l'édition, jamais à la lecture : une ligne sauvegardée contient toujours le nombre qu'elle annonce. Elle est adaptée à la colonne : bornée par `min` et `max`, puis arrondie vers le bas si la colonne prend des entiers. Dans l'exemple, Heart 3 donne trois usages et Heart 0 ou moins n'en donne aucun. La ligne reste avec 0 usage ; un compteur au maximum de 0 n'étant pas une réserve, rien n'est dépensable en jeu.

Les colonnes à échelle nécessitent Capability API 1.23 pour les ensembles en package. Un ensemble communautaire importé est validé par le moteur qui le lit et n'a besoin de rien d'autre.

## Les lignes choisies sont des copies

Chaque ligne choisie est copiée sur la fiche avec une clé supplémentaire, `_catalog`, contenant `<catalog id>/<entry id>`. Les identifiants de colonnes commencent par une lettre ; cette clé ne peut donc pas être l'une des tiennes.

La copie appartient au personnage. Le joueur peut tout modifier ensuite ; la fiche fonctionne sans l'ensemble installé et publier une version n'écrase jamais les personnages. La marque permet au sélecteur d'afficher ce que possède déjà la fiche et à l'actualisation décrite ci-dessous de le reconnaître.

## Actualiser depuis l'ensemble de règles

Grâce à la marque, l'éditeur peut avertir le joueur si ton nouveau texte diffère de sa ligne. Une courte ligne sous la liste indique combien de lignes ont un texte nouveau ; **Review** (Examiner) montre le contenu de la fiche à côté de celui de l'ensemble, avec une case par ligne. Rien n'est écrit avant **Update selected** (Mettre à jour la sélection) ; seules les colonnes différentes des lignes cochées changent. Tout le reste est conservé, marque comprise.

La comparaison est volontairement étroite :

- Les valeurs existantes ne sont comparées que dans `text`, `longtext`, `dice` et `enum`. Les valeurs `number` et `boolean` appartiennent au joueur et sont conservées, y compris 0 et false. Une colonne encore absente peut être proposée avec sa valeur typée, nombres et interrupteurs compris. Une colonne à échelle est exclue car elle suit déjà la fiche.
- Seules les colonnes définies par ton entrée sont comparées. Une colonne omise n'est jamais touchée, quel que soit son contenu.
- Une valeur que refuserait la colonne, comme un `enum` retiré ou un texte dépassant `maxLength`, est ignorée plutôt qu'écrite.
- La ligne est reliée à celle d'origine par sa position parmi les lignes de même marque dans cette liste, tant que la fiche en garde autant que l'entrée en écrit. Sinon, cela fonctionne seulement si l'entrée écrit une ligne unique pour cette liste. Si le joueur supprime l'une de deux lignes, l'entrée reste intacte plutôt que devinée.
- Une ligne dont l'entrée n'existe plus dans le catalogue est laissée intacte, sans bruit.

Reformuler ou renommer une entrée peut donc atteindre les personnages qui l'ont déjà choisie, s'ils l'acceptent. Changer le sens d'un nombre ne le peut pas et ne le fera pas : cette colonne appartient au joueur depuis qu'il possède la ligne.

## Commandes de fiche : progression permanente

Un ensemble peut accepter des modifications de la construction permanente du personnage avec `sheet.advancement` :

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

N'inclus que des identifiants de champs que ta fiche déclare comme nombre ou texte (`text` ou `longtext`), 24 au plus. Les booléens autorisent respectivement tous les attributs, toutes les compétences ou toutes les sauvegardes ; omis ou faux, ils n'autorisent rien. Un ensemble d'autorisations vide, un champ inconnu, un type de champ non pris en charge ou une clé inconnue sont refusés à l'importation. `text` est une consigne facultative d'au plus 400 caractères destinés au prompt. Sans `advancement`, les commandes existantes se comportent comme avant et toute demande `advance` est refusée.

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

Nomme exactement une cible. Les champs et les attributs prennent exactement l'un de `by` ou `to` ; le texte ne prend que `to`. Les noms et les niveaux correspondent aux identifiants ou aux libellés, sans tenir compte de la casse. Les compétences et les sauvegardes acceptent tout niveau déclaré dans `resolution.proficiencyTiers`. Les champs numériques respectent `integer`, `min` et `max` ; les attributs respectent leurs bornes entières ; le texte respecte `maxLength`. Une valeur invalide est refusée avec une raison `bad-amount` qui indique la borne, jamais ramenée silencieusement dans les limites. Une progression désactivée, des cibles non autorisées, des noms inconnus et des niveaux inconnus sont aussi refusés. La balise réécrite porte `result` et la nouvelle valeur dans `now`. Omets `who` pour le joueur, ou utilise `who="party"` pour chaque fiche de l'équipe identifiée sans ambiguïté ; les refus partiels nomment les fiches qui n'ont pas pu progresser.

Le moteur enregistre la construction sur la fiche de personnage de la partie par le même stockage de métadonnées qu'une modification du joueur, en gardant sa version de fiche et en recalculant les valeurs dérivées à partir de la nouvelle construction. Les fiches de la bibliothèque ne sont pas modifiées. Comme pour les commandes vivantes, un swipe alternatif ou une réponse régénérée part d'avant les modifications de la réponse sortante. Chaque réponse enregistre la construction à laquelle elle aboutit, y compris les réponses sans progression. Sélectionner un swipe restaure son instantané ; supprimer la dernière réponse fait réapparaître l'instantané précédent. Supprimer une réponse plus ancienne laisse un instantané ultérieur en vigueur jusqu'à ce que cette réponse ultérieure soit supprimée. Une continuation met à jour l'instantané de la même réponse. Annuler ne modifie que les valeurs qui correspondent encore au résultat enregistré : les modifications ultérieures du joueur sont conservées, et des modifications sans rapport n'empêchent pas d'annuler une attribution d'XP.

<a id="the-use-command-letting-the-game-master-spend-a-price-you-wrote"></a>

## La commande `use` : laisser le Game Master payer un prix que tu as écrit

Pendant la narration, le GM actualise les fiches avec `[sheet: ...]` : `spend`, `restore` (`heal` a le même sens), `damage`, `temp`, `track`, `condition`, `note` et `rest`. Un ensemble avec catalogues en reçoit une autre :

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` équivaut à `op="use"` et `spell=` à `name=` : l'expression choisie par le GM fonctionne sans que ton format connaisse le mot "spell".

Le nom est comparé sans tenir compte de la casse aux lignes du personnage issues de tes catalogues. Une ligne répond au nom montré au GM (colonne de nom `sheetSummary`, puis `pools.nameColumn`, puis première colonne de texte) et au `label` de l'entrée d'origine. Renommer une ligne ne fait donc pas perdre son accès. Un nom sans correspondance et un nom partagé par deux entrées distinctes sont tous deux refusés.

Ce qui est dépensé :

- Chaque terme de `mechanics.cost`. Un terme nommant une réserve vivante paie depuis celle-ci ; un terme nommant un GROUPE paie depuis la première réserve du groupe capable de payer, dans l'ordre de déclaration. Aucune montée automatique vers une réserve supérieure : un groupe n'est pas toujours une échelle.
- Plus un de chaque réserve de ligne écrite par la même entrée, comme un compteur d'usages : la seconde ligne de `Last Ember`. Un compteur au maximum de 0 n'a aucun usage ; la commande est refusée plutôt qu'exécutée gratuitement.

`pool=` représente l'incantation à niveau supérieur : le même prix unique, payé depuis une autre réserve du groupe. Il est accepté seulement si le coût a un terme unique et si la réserve nommée appartient au même groupe, ou paie pour ce groupe. Tout autre cas est refusé plutôt que réinterprété.

**Une réserve qui paie pour un autre groupe** (Capability API 1.171). Le `pays` d'une réserve vivante nomme jusqu'à quatre autres groupes dont elle peut aussi payer les coûts, à son propre niveau (son `level`, ou sa place dans son propre groupe), et jamais pour un coût d'un niveau supérieur au sien. Les emplacements de pacte de 5e paient pour des sorts dont le coût est exprimé en emplacements de sorts, comme peut le faire un occultiste multiclassé :

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

Un combat propose une telle réserve à côté des réserves supérieures du groupe propre au sort, et un paiement depuis elle fait grandir le sort d'autant de crans que son niveau dépasse celui du sort : un emplacement de pacte de niveau 3 paie Magic Missile comme le ferait un emplacement de niveau 3. Une utilisation dont la propre réserve est vide est toujours proposée, payée seulement depuis une réserve supérieure ou une réserve qui paie pour elle : un sort de niveau 1 se lance ainsi avec un emplacement de niveau 2 une fois les emplacements de niveau 1 épuisés. `targetsPerCostStep` (1.171, de 1 à 10) sur les `mechanics` d'une entrée ajoute autant de cibles pour chaque cran dont elle est payée au-dessus, jusqu'à 20 au plus : Hold Person s'écrit `"targetCount": 1,
"targetsPerCostStep": 1`.

C'est tout ou rien. Si une partie du prix ne peut pas être payée, toute la commande est refusée, rien ne change et le joueur est averti. Une entrée gratuite, comme un tour de magie ou une capacité passive, est acceptée sans rien changer.

## Dans le fichier, ou dans son propre fichier

Un petit catalogue est intégré à `ruleset.json`, dans les `entries` de son en-tête. Un long catalogue a son fichier, nommé par `asset` dans l'en-tête. Il possède exactement l'une de ces deux formes.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

Le chemin est toujours `catalogs/<the catalog's id>.json`. Le fichier ressemble à ceci :

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Les fichiers de catalogue séparés viennent dans un package : un package publié par le catalogue officiel, ou un fichier de package d'ensemble que tu importes toi-même (voir [Partager ton ensemble de règles](writing-rulesets.md#sharing-your-ruleset)). Le package liste le fichier dans `contributions.assets.paths` avec `ruleset.json` et nécessite Capability API 1.21. Un catalogue de créatures, intégré ou séparé, nécessite Capability API 1.27, et un catalogue d'objets, 1.49. **Un ensemble importé comme fichier unique ou partagé par GitHub contient ses catalogues dans le fichier**, donc ils doivent tenir dans sa limite totale de 512 KB. Cela permet quelques centaines d'entrées courtes.

Les limites sont douze catalogues par ensemble, 2000 entrées par catalogue dans les deux cas et 2 MB par fichier de catalogue. Un package dont le `ruleset.json` dépasse 256 KB, ou dont un fichier de catalogue dépasse 1 MB, nécessite Capability API 1.340, qui a relevé ces deux limites.
