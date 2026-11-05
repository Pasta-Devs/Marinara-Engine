# Prompts conditionnels ({{#if}})

Un bloc `{{#if}}` n'ajoute un morceau de prompt – le texte que Marinara envoie à l'IA – que si une condition est vraie. Sers-t'en pour donner à un même preset partagé des instructions différentes selon les personnages, les personas ou les chats, ou pour laisser de côté un champ vide. Les conditionnels font partie du système de macros : ils fonctionnent donc partout où les [macros](macros.md) fonctionnent, c'est-à-dire dans les fiches de personnage, les personas, les entrées de lorebook et les presets.

Marinara vérifie la condition à chaque construction du prompt, garde le texte qui correspond et écarte le reste. C'est une fonctionnalité avancée, et la plupart des chats n'en ont jamais besoin.

## La syntaxe de base

Un bloc commence par `{{#if condition}}` et se termine par `{{/if}}`. Ajoute `{{else}}` pour le cas faux, et `{{else if}}` pour enchaîner d'autres conditions. Marinara examine chaque branche de haut en bas et garde la première qui est vraie. Si aucune ne l'est et qu'il n'y a pas de `{{else}}`, le bloc ne produit rien.

```text
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

Un bloc peut tenir sur une seule ligne ou sur plusieurs, et tu peux imbriquer des blocs.

## Opérateurs

Une condition se compose en général d'une valeur de gauche, d'un opérateur et d'une valeur de droite, par exemple `char == "Alice"`.

| Opérateur | Signification |
| --- | --- |
| `==`, `=`, `is` | Égal. |
| `!=`, `is not` | Différent. |
| `>`, `<`, `>=`, `<=` | Supérieur, inférieur, supérieur ou égal, inférieur ou égal (nombres uniquement). |
| `contains`, `includes` | La valeur de gauche contient la valeur de droite en tant que texte. |
| `not contains`, `not includes` | La valeur de gauche ne contient pas la valeur de droite. |

Règles de comparaison :

1. Avec les opérateurs d'égalité, si les deux côtés ressemblent à des nombres, Marinara les compare comme des nombres : `5` est donc égal à `5.0`. Sinon, il compare le texte sans tenir compte de la casse : `Mari` est donc égal à `mari`.
2. Avec `>`, `<`, `>=` et `<=`, les deux côtés doivent être des nombres. Sinon, la condition est fausse.
3. `contains` et `includes` ignorent la casse : `contains "dr"` correspond donc à `Dr Smith`.

### Combiner des conditions

Utilise `||` pour OU et `&&` pour ET. `&&` est évalué avant `||`. Ajoute des parenthèses pour fixer l'ordre.

```text
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared instructions.
{{/if}}

{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Pour plusieurs choix d'égalité sur une même valeur, tu peux omettre la partie gauche répétée : `character == "Maukie" || "Pantalone"`. Cela fonctionne avec `==`, `=` et `is`. Écris des conditions complètes des deux côtés de `&&`.

### Tests de contenu

Une condition sans opérateur est vraie quand la valeur a un vrai contenu. Elle est fausse quand la valeur est vide ou vaut `false`, `0`, `no`, `off`, `null` ou `undefined`, quelle que soit la casse.

```text
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

### Ce que tu peux comparer

Chaque côté d'une condition peut être :

1. Un mot-clé de champ ou d'identité, comme `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input`, `model` ou `reasoning`. Ces mots-clés lisent les mêmes valeurs que les macros correspondantes. `group` liste les autres personnages actifs, sans celui qui répond.
2. Une valeur littérale entre guillemets, comme `"Alice"`.
3. Un nom de variable de preset, comme `length`. Voir [Variables de preset](preset-variables.md).
4. Une recherche de variable explicite, écrite `var:name` ou `var.name`.
5. Une autre macro, résolue en premier.
6. Une question pour ton modèle de décision : `decision:"..."` ou `decision_choice:"..."`. Voir [Interroger le modèle de décision](#asking-the-decision-model).

Un mot isolé qui n'est pas un mot-clé est lu comme un nom de variable. Si aucune variable ne porte ce nom, il est utilisé comme simple texte. Mets les valeurs littérales entre guillemets pour éviter la confusion.

### Mise entre guillemets

Mets le texte fixe entre guillemets droits, doubles ou simples. À l'intérieur d'une valeur entre guillemets, échappe un guillemet avec une barre oblique inverse, et écris `\n` pour un retour à la ligne. Mets toujours entre guillemets une valeur littérale qui contient une espace, comme `"Dr Smith"`. Sans guillemets, une valeur de plusieurs mots est lue comme un seul nom de variable.

## Blocs de groupe pour plusieurs personnages

Dans un chat de groupe avec deux personnages ou plus, un bloc de groupe répète son texte une fois par personnage. Place `[` seul sur une ligne, puis ton texte, puis `]` seul sur une ligne. Le bloc doit contenir une macro de personnage, comme `{{char}}` ou `{{description}}`, ou une condition portant sur le personnage.

```text
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

Avec Alice et Bob, le bloc s'exécute deux fois, une fois par personnage. Hors d'un bloc de groupe, une macro de personnage ne se résout que pour le personnage courant ou principal. Dans un chat avec un seul personnage, les lignes `[` et `]` restent du texte ordinaire.

## Exemples

Un ton différent selon le personnage :

```text
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

N'inclure un champ que s'il est rempli. Avec un champ **Backstory** (histoire personnelle) vide, le bloc ne produit rien : aucune étiquette vide n'est envoyée.

```text
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Des instructions pour une famille de modèles. `model` est l'ID du modèle, comme `claude-opus-5-5` : `contains` correspond donc à toutes les versions d'Opus, et `==` à un seul modèle précis.

```text
{{#if model contains "opus"}}
Keep replies under 400 words.
{{/if}}
```

Des instructions de planification qui dépendent du raisonnement. Avec le raisonnement activé, quel que soit le niveau, le modèle reçoit la première ligne. Avec le raisonnement désactivé, `{{reasoning}}` vaut `off`, ce qui se lit comme faux. Pour agir sur un seul niveau, compare-le, comme dans `{{#if reasoning == "max"}}`.

```text
{{#if reasoning}}
Plan the reply in your thinking before you write it.
{{else}}
Before replying, write your plan inside <plan></plan> tags.
{{/if}}
```

<a id="asking-the-decision-model"></a>

## Interroger le modèle de décision

Une condition peut demander à ton modèle de décision ce qui se passe dans le chat. Le modèle de décision est un petit modèle qui lit les derniers messages et un énoncé que tu écris, puis indique si l'énoncé est vrai. Il n'écrit jamais dans le chat. Un preset, une fiche, une entrée de lorebook ou un prompt d'agent peut ainsi envoyer une instruction uniquement aux tours où elle s'applique.

Avant de commencer : choisis un modèle de décision sous **Decision model** (modèle de décision) dans le panneau **Connections** (Connexions). [Modèles de décision](../connections/decision-models.md) explique ce que c'est et comment en choisir un. Pour décider si une entrée de lorebook entière s'active, utilise plutôt son champ [Decision](../lorebooks/entries.md#decision-activation).

Quelques idées : décrire un nouveau lieu seulement si la scène a changé d'endroit, charger les règles de rythme du combat uniquement pendant un combat, retenir l'intensification dans un preset à progression lente, ou, dans un bloc de groupe, faire répondre directement le seul personnage interpellé.

### Oui ou non : `decision:`

```text
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

La condition est vraie quand le modèle de décision juge l'énoncé vrai. Elle fonctionne avec `{{else}}`, `&&`, `||`, les parenthèses, l'imbrication et les blocs de groupe. Les macros de l'énoncé sont remplies d'abord : `{{user}}` et `{{char}}` fonctionnent donc. Dans un bloc de groupe, un énoncé qui nomme `{{char}}` est évalué une fois par personnage.

### Une réponse parmi plusieurs : `decision_choice:`

`decision_choice:` demande au modèle de choisir une option. Les options sont les valeurs auxquelles tu le compares.

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

Le modèle choisit entre "angry", "sad" et "none of these". Écris l'énoncé comme un sujet, et les options comme de courtes réponses. La forme courte `== "rain" || "snow"` propose les deux options.

Pour dire ce qu'une option signifie dans ton histoire, ajoute des critères après elle, séparés par deux-points, avec le même type de guillemets sur les deux parties : `== "angry":"Kaelen raises his voice, makes threats or breaks something"`. Le modèle répond toujours "angry". Si une option reçoit des critères différents à plusieurs endroits, ce sont les premiers qui sont utilisés.

<a id="sticky-and-cooldown"></a>

### Sticky et cooldown

Ajoute `sticky:` et `cooldown:` après un énoncé pour garder sa réponse pendant quelques tours au lieu de l'évaluer à chaque tour.

```text
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- `sticky:N` : après un oui, l'énoncé reste oui pendant N tours sans être évalué.
- `cooldown:N` : commence à la fin de sticky, ou juste après le oui. Pendant N tours, l'énoncé vaut non et n'est pas évalué.
- Un tour correspond à chaque nouveau message que lit le modèle de décision. Une régénération ou un swipe du même message reste le même tour : relancer une réponse ne réduit donc jamais un minuteur.
- Un énoncé maintenu n'est pas évalué et ne compte pas dans **Decision statements per turn** (énoncés de décision par tour).
- Pour `decision_choice:`, sticky conserve l'option choisie, et cooldown fait valoir non à chaque comparaison.
- Un énoncé écrit à plusieurs endroits utilise les sticky et cooldown les plus longs.
- Peek Prompt montre la réponse maintenue et ne fait jamais avancer un minuteur.

Pour une entrée de lorebook activée par son champ **Decision**, utilise plutôt les réglages **Sticky** et **Cooldown** propres à l'entrée.

<a id="until-and-while"></a>

### Until et while

Pour garder un bloc actif tant que dure une situation, ajoute `until:` ou `while:` avec un second énoncé.

```text
{{#if decision:"A fight starts in the latest message" until:"The fight ends in the latest message"}}
Keep combat pacing rules in effect.
{{/if}}
```

- Après un oui, le bloc reste actif. Le premier énoncé n'est pas évalué. L'énoncé `until` est évalué à sa place à chaque tour, et le bloc se désactive au tour où il est vrai.
- `while:` fonctionne à l'inverse : le bloc reste actif tant que son énoncé est vrai, et se désactive quand il est faux.
- Utilise l'un ou l'autre. Si les deux sont écrits, seul le premier compte.
- Quand le bloc se désactive, cooldown démarre comme d'habitude. Sans réponse lors d'un tour, le bloc reste actif.
- L'énoncé `until` ou `while` compte dans **Decision statements per turn**. Le premier énoncé n'y compte pas tant que le bloc est actif.
- Cela fonctionne avec `decision:`, pas avec `decision_choice:`.

Avec **sticky**, ajoute `:and` (aussi écrit `:restrict`) ou `:or` (aussi écrit `:extend`) après le second énoncé pour choisir comment les deux se combinent.

| Ce que tu écris | Après le oui, le bloc reste actif |
| --- | --- |
| `until:"..." sticky:5` ou `until:"...":and sticky:5` | Pendant 5 tours supplémentaires au maximum, et se désactive plus tôt si l'énoncé until est vrai. |
| `until:"...":or sticky:5` | Pendant au moins 5 tours supplémentaires, puis jusqu'à ce que l'énoncé until soit vrai. |
| `while:"..." sticky:5` ou `while:"...":or sticky:5` | Pendant au moins 5 tours supplémentaires, puis tant que l'énoncé while est vrai. |
| `while:"...":and sticky:5` | Pendant 5 tours supplémentaires au maximum, et se désactive plus tôt si l'énoncé while est faux. |

<a id="checking-every-few-turns"></a>

### Vérifier tous les quelques tours

Ajoute `every:N` pour n'évaluer un énoncé que tous les N tours.

```text
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Il est évalué au premier tour où il est atteint, puis 3 tours plus tard, et ainsi de suite. Entre deux vérifications, il vaut non, n'est pas évalué et ne compte pas dans **Decision statements per turn**.
- Une régénération ou un swipe ne fait pas avancer le calendrier.
- Sticky et cooldown maintiennent toujours une réponse. `every:` décide seulement quand évaluer un énoncé qui n'est pas maintenu.
- Un énoncé écrit à plusieurs endroits utilise le plus petit `every:`.

<a id="priority"></a>

### Priorité

Quand un plan de prompt contient plus d'énoncés que le budget **Decision statements per turn**, `priority:high` ou `priority:low` décide lesquels sont évalués. Sans priorité, elle est moyenne.

```text
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- Les énoncés de priorité haute sont évalués en premier, ceux de priorité basse en dernier. À priorité égale, l'ordre dans le prompt décide.
- Les énoncés au-delà de la limite valent non, en commençant par la priorité la plus basse, et Peek Prompt les liste.
- Un énoncé écrit à plusieurs endroits utilise la priorité la plus haute.
- Les énoncés propres au prompt (preset, fiches, persona, notes d'auteur) sont planifiés en premier. Les énoncés de lorebook utilisent les places restantes, quelle que soit leur priorité.

Tu peux combiner tous les modificateurs dans n'importe quel ordre : `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Aucune réponse signifie non

Une condition de décision est fausse dès qu'il n'y a pas de réponse : aucun modèle de décision n'est défini, il n'a pas répondu à temps, ou il a échoué. Pour `decision_choice:`, toutes les comparaisons sont fausses. Conçois ton contenu en conséquence.

- Utilise une décision pour ajouter ou réduire des consignes, jamais pour porter un contenu dont l'histoire dépend.
- Donne à chaque bloc de décision un comportement par défaut : rien, ou un `{{else}}` qui convient à n'importe quel tour.
- N'enchaîne pas les décisions de façon qu'une seule mauvaise réponse en change plusieurs autres.
- Ne fais pas dépendre d'une décision le consentement, les avertissements de contenu ou les instructions de sécurité.

Tout modèle peut se tromper. Écris pour "un modèle de décision", pas pour un produit précis.

<a id="writing-statements"></a>

### Rédiger les énoncés

- Affirme un fait vrai ou faux, comme une ligne de rapport. Pas une question ("Did the scene change?"), ni une instruction ("If the scene changed, describe it"). Les petits modèles répondent souvent non à une instruction, et le bloc ne s'exécute alors jamais.
- Dis "in the latest message" quand tu parles de ce tour. Le modèle lit plusieurs messages, et un message plus ancien peut lui faire répondre oui.
- Nomme la personne concernée. "He is angry" peut être attribué au mauvais personnage.
- Décris un élément visible dans le texte, comme une action ou une réplique. Évite les mots d'ambiance ("The scene is intense") et les intentions cachées ("Mira is lying").
- Reste bref. Découpe un long énoncé en plusieurs parties si tu veux les réutiliser ou les déboguer.

Pour tester ta formulation :

1. Sélectionne un modèle sous **Decision model**, puis clique sur **Test** (tester). Cela vérifie la connexion avec un exemple fixe. Cela ne teste pas ton énoncé.
2. Ajoute l'énoncé à ton prompt, puis envoie des messages où il devrait être vrai et d'autres où il devrait être faux.
3. Utilise **Peek Prompt** pour voir quelle branche a été envoyée. Ouvre **Decision diagnostics** (diagnostic des décisions), puis choisis **Test decisions** (tester les décisions) pour obtenir de nouvelles réponses sans lancer de génération. Les tests hébergés peuvent être payants. Voir [Tester les énoncés de décision](../chats/peek-prompt.md#testing-decision-statements).
4. Ajuste la formulation et teste de nouveau. Pour voir les réponses des générations réelles, active Debug Mode ou les [logs de débogage](../CONFIGURATION.md#logging-levels) du serveur.

<a id="limits-and-cost"></a>

### Limites et coût

<a id="statement-allowance"></a>

#### Budget d'énoncés

**Decision statements per turn**, sous **Decision model**, vaut 32 par défaut. Ce n'est pas un plafond unique sur toutes les requêtes Decision ni sur les dépenses. Marinara l'applique par étapes.

1. Les énoncés du prompt principal du chat sont planifiés dans le budget. Les décisions de lorebook utilisent ce qui reste.
2. Les agents exécutés avant ou pendant la réponse reçoivent un plan combiné avec le prompt principal, qui utilise de nouveau le budget. Cette étape ne soustrait pas ce qu'a utilisé le lorebook : le total peut donc dépasser le réglage.
3. Les agents de post-traitement reçoivent un budget séparé après la réponse.

Les questions d'activation des agents et l'ordre de réponse Smart sont indépendants de ce réglage.

Seuls les énoncés qu'une étape peut utiliser entrent dans son plan : sections et groupes de preset activés, options de variables sélectionnées et contenu des entrées de lorebook activées. Une condition fixe peut exclure un énoncé, comme `{{#if char == "Dottore" && decision:"..."}}` quand le personnage est Mira. Une condition de variable ne le peut pas, car les variables peuvent changer pendant la construction du prompt. Les énoncés maintenus par sticky, cooldown ou `every:` ne prennent aucune place. Les énoncés écartés valent non.

#### Requêtes et durée

Sur un compte Decision hébergé, un tour peut produire plusieurs requêtes facturées. Les énoncés peuvent être regroupés, mais l'activation des lorebooks, le contenu des entrées nouvellement activées, les correspondances récursives et les phases des agents peuvent nécessiter d'autres lots. Un modèle de chat local ajoute du temps de calcul plutôt que des frais, et répond à un `decision_choice:` par une question oui/non par option.

Chaque requête a un délai : 1,5 seconde par défaut pour un compte Decision hébergé, ou 4 secondes pour un compte de modèle de chat compatible OpenAI ou pour un modèle local. Voir [Délais](../connections/decision-models.md#time-limits). Un modèle local de raisonnement s'abstient avant la réponse, sauf si tu actives **Also gate agents that run before the reply** (évaluer aussi les agents exécutés avant la réponse).

<a id="answer-reuse"></a>

#### Réutilisation des réponses

Marinara réutilise normalement les réponses réussies pour le même tour et le même modèle de décision : une régénération envoie donc souvent les mêmes branches sans nouvelle requête. Ce cache vit dans le serveur en cours d'exécution et conserve jusqu'à 200 tours. Un redémarrage, un retrait de la mémoire, un dernier message nouveau ou modifié, un autre modèle, ou un énoncé ou un ensemble d'options modifié peuvent nécessiter une nouvelle réponse.

Les réponses absentes ou en échec ne sont pas mises en cache : un nouvel essai peut donc interroger de nouveau le modèle et emprunter une autre branche. Les énoncés des prompts d'agents suivent les mêmes règles. Une relance manuelle d'un agent réutilise les réponses encore en cache pour ses entrées. Voir [Énoncés de décision dans le prompt de l'agent](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Cache de prompts

Le cache de prompts du fournisseur est distinct du cache de réponses de Marinara. Il peut réutiliser un début inchangé du prompt envoyé à ton modèle de chat. Changer une branche de décision peut empêcher la réutilisation à partir de ce point, même si une partie antérieure inchangée peut rester admissible. La facturation dépend du fournisseur.

Place les blocs de décision qui changent souvent vers la fin du prompt, par exemple dans les instructions après l'historique ou une note d'auteur peu profonde. Garde une décision près du début uniquement si sa réponse change rarement. Les options de variables de preset fonctionnent de la même façon, car leur texte arrive à l'endroit où apparaît `{{name}}`.

Sur un compte Anthropic direct avec **Enable prompt caching** (activer le cache de prompts) actif, Marinara marque la fin du prompt système et un message du chat situé **Cache depth** (profondeur du cache) messages avant le plus récent (5 par défaut). Un changement avant l'historique peut invalider la frontière système et l'historique qui suit. Un changement après la frontière marquée de l'historique peut préserver la partie en cache. La longueur minimale du cache varie selon le modèle. Consulte le guide actuel du fournisseur : le [guide du cache de prompts d'Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) ou le [guide du cache de prompts d'OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching).

<a id="when-a-decision-branch-never-appears"></a>

### Quand une branche de décision n'apparaît jamais

Causes probables, dans l'ordre :

1. Aucun modèle de décision n'est défini. Toutes les conditions de décision sont fausses. L'éditeur affiche un avertissement sous chaque champ qui en utilise une.
2. Le modèle de décision ne répond pas : clé incorrecte, plus de crédits ou limite de requêtes sur un compte hébergé, modèle local arrêté ou trop lent, ou modèle de décision installé qui n'a pas démarré.
3. C'est un modèle de raisonnement qui s'abstient avant la réponse.
4. Trop d'énoncés à l'étape de planification, au-delà du budget.
5. Il répond, mais sous son seuil. C'est généralement une question de formulation.

Regarde ce qu'indique **Test**, et utilise **Peek Prompt** pour voir les branches envoyées. Il liste les énoncés encore sans réponse, qui valent non. Avec le niveau de log sur debug, chaque énoncé, sa réponse et le fait qu'il se lise ou non comme un oui sont enregistrés dans le log. Voir [Niveaux de log](../CONFIGURATION.md#logging-levels). La correction se trouve rarement dans le preset. Il s'agit généralement de la formulation, ou d'une branche qui porte quelque chose dont le prompt ne peut pas se passer.

## Guides associés

- [Modèles de décision](../connections/decision-models.md)
- [Macros de prompt](macros.md)
- [Variables de preset](preset-variables.md)
- [Chats de groupe et conversations de groupe](../chats/group-chats.md)
