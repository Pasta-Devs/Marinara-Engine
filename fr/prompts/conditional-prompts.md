# Prompts conditionnels ({{#if}})

Ce guide explique comment utiliser les blocs `{{#if}}` dans Marinara Engine. Un bloc conditionnel n'ajoute un morceau de prompt (le texte que Marinara envoie à l'IA) que si une valeur correspond à la règle que tu as fixée. Les conditionnels font partie du système de macros : ils fonctionnent donc partout où les macros fonctionnent, y compris dans les fiches de personnage, les personas, les entrées de lorebook et les presets de prompt.

## À quoi servent les prompts conditionnels

Une macro est un espace réservé écrit entre `{{double-brace}}`, que Marinara Engine remplace par une valeur réelle pendant la construction du prompt. Un bloc conditionnel va plus loin. Il examine une valeur, garde un morceau de texte et jette le reste.

Tu écris une condition, le texte à utiliser quand elle est vraie et, si tu veux, le texte à utiliser quand elle est fausse. Marinara relit la condition à chaque construction du prompt. Une même fiche ou un même preset peut donc se comporter différemment selon les personnages, les personas ou les chats.

Un usage courant : donner des instructions propres à un personnage à l'intérieur d'un preset partagé. Autre usage courant : n'inclure un champ que s'il contient quelque chose, pour ne pas envoyer une étiquette vide au modèle.

## La syntaxe de base

Un bloc conditionnel commence par `{{#if condition}}` et se termine par `{{/if}}`. Tout ce qui se trouve entre les deux est le texte retenu quand la condition est vraie.

```
{{#if condition}}
Text used when the condition is true.
{{/if}}
```

Une branche `{{else}}` peut prendre en charge le cas faux :

```
{{#if condition}}
Text used when true.
{{else}}
Text used when false.
{{/if}}
```

Autre option : enchaîner des conditions supplémentaires avec `{{else if}}`. Marinara examine chaque branche dans l'ordre, de haut en bas. Il retient la première branche dont la condition est vraie, résout les macros qu'elle contient et écarte toutes les autres. Si aucune condition n'est vraie et qu'il n'y a pas de `{{else}}`, le bloc entier ne produit rien.

```
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

Un bloc s'écrit sur plusieurs lignes, comme ci-dessus, ou sur une seule. Tu peux aussi imbriquer un conditionnel dans une branche d'un conditionnel plus large.

## Opérateurs pris en charge

La condition se compose en général d'une valeur de gauche, d'un opérateur et d'une valeur de droite, par exemple `char == "Alice"`. Le tableau ci-dessous liste tous les opérateurs disponibles. Chacun est présenté en style code.

| Opérateur | Signification |
| --- | --- |
| `==`, `=`, `is` | Égal. |
| `!=`, `is not` | Différent. |
| `>` | Supérieur à (nombres uniquement). |
| `<` | Inférieur à (nombres uniquement). |
| `>=` | Supérieur ou égal (nombres uniquement). |
| `<=` | Inférieur ou égal (nombres uniquement). |
| `contains`, `includes` | La valeur de gauche contient la valeur de droite en tant que texte. |
| `not contains`, `not includes` | La valeur de gauche ne contient pas la valeur de droite. |

Quelques règles régissent la comparaison :

1. Avec `==`, `=`, `is`, `!=` et `is not`, si les deux côtés ressemblent à des nombres, Marinara les compare comme des nombres. Ainsi, `5` est égal à `5.0`. Sinon, la comparaison se fait sur le texte, sans distinction entre majuscules et minuscules. Ainsi, `Mari` est égal à `mari`.
2. Avec `>`, `<`, `>=` et `<=`, les deux côtés doivent être des nombres. Si l'un des deux n'en est pas un, la condition est fausse.
3. Avec `contains`, `includes`, `not contains` et `not includes`, la comparaison ignore la casse. Ainsi, `contains "dr"` correspond au texte `Dr Smith`.

## Combiner des conditions avec OR et AND

Utilise `||` quand l'une ou l'autre condition peut correspondre. Utilise `&&` quand toutes les conditions doivent correspondre.

```
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared Maukie and Pantalone instructions.
{{/if}}

{{#if characters contains "Maukie" && characters contains "Pantalone"}}
Both characters are present in this chat.
{{/if}}
```

`&&` est évalué avant `||`. Ajoute des parenthèses pour fixer l'ordre toi-même :

```
{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Si plusieurs égalités portent sur la même valeur, la partie gauche répétée peut être omise après `||` :

```
{{#if character == "Maukie" || "Pantalone"}}
Use the shared instructions.
{{/if}}
```

Cette écriture abrégée signifie `character == "Maukie" || character == "Pantalone"`. Elle vaut pour les opérateurs d'égalité `==`, `=` et `is`. Écris des conditions complètes des deux côtés de `&&` : une même valeur peut rarement être égale à deux choix différents en même temps.

### Tests de contenu (sans opérateur)

Si tu écris une condition sans opérateur, Marinara effectue un test de contenu. La question posée est simple : cette valeur contient-elle vraiment quelque chose ?

```
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

Un test de contenu est vrai quand la valeur n'est pas vide et qu'elle ne fait pas partie de ces mots : `false`, `0`, `no`, `off`, `null` ou `undefined`. La casse de ces mots n'a pas d'importance. Emploie un test de contenu quand tu ne veux inclure un texte que si un champ est rempli.

### Ce que tu peux comparer

Le côté gauche ou droit d'une condition accepte l'un des éléments suivants :

1. Un mot-clé de champ ou d'identité, comme `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input` ou `model`. Ces mots-clés lisent les mêmes valeurs que les macros correspondantes. `group` liste les autres personnages actifs du chat, une fois écarté celui qui répond.
2. Une valeur littérale entre guillemets, comme `"Alice"`.
3. Un nom de variable de preset, comme `length`. Une variable de preset est une valeur nommée que tu définis dans un preset de prompt. Voir [Variables de preset](preset-variables.md).
4. Une recherche de variable explicite, écrite `var:name` ou `var.name`.
5. Une autre macro, dont la valeur est résolue d'abord, puis comparée.
6. Les questions et choix Decision, comme `decision:"..."` et `decision_choice:"..."`. Ils demandent un jugement rapide au Decision model sélectionné avant de construire le prompt. Consulte [Interroger le modèle de décision](#asking-the-decision-model).

Si tu écris un mot isolé qui n'est pas un mot-clé, Marinara le prend pour un nom de variable. Si aucune variable ne porte ce nom, il utilise le mot comme simple texte. Mettre les valeurs littérales entre guillemets évite cette confusion : dans le doute, mets-les entre guillemets.

## Règles de mise entre guillemets

Quand tu compares avec un texte fixe, mets-le entre guillemets. Marinara le traite alors comme une valeur littérale exacte, et non comme un mot-clé ou une variable.

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{/if}}
```

Les guillemets doubles droits comme les guillemets simples droits conviennent. Marinara accepte aussi les guillemets courbes (typographiques), mais les guillemets droits sont les plus sûrs et correspondent à tous les exemples de l'application. À l'intérieur d'une valeur entre guillemets, une barre oblique inverse échappe un guillemet, et `\n` produit un retour à la ligne.

Mets toujours entre guillemets une valeur littérale contenant une espace, comme `"Dr Smith"`. Sans guillemets, une valeur de plusieurs mots est lue comme un seul nom de variable, ce qui n'est presque jamais l'effet recherché.

## Blocs de groupe pour plusieurs personnages

Dans un chat de groupe réunissant deux personnages ou plus, un bloc de groupe répète le même texte une fois par personnage. Tu écris ainsi un seul bloc qui décrit tous les personnages de la scène.

Pour créer un bloc de groupe, place un `[` seul sur sa ligne, puis ton texte, puis un `]` seul sur sa ligne. Le bloc doit contenir une macro de personnage, comme `{{char}}` ou `{{description}}`, ou une condition portant sur le personnage, comme `{{#if char == "Alice"}}`. Marinara répète alors le bloc une fois par personnage et résout les macros de personnage pour chacun à son tour.

```
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

Dans un chat de groupe avec Alice et Bob, le bloc s'exécute deux fois. Le premier passage insère le nom d'Alice et choisit sa branche. Le second insère le nom de Bob et choisit la sienne. Hors d'un bloc de groupe, une macro de personnage ne se résout que pour le personnage courant ou principal.

Les blocs de groupe ne se déploient que dans un chat comptant deux personnages ou plus. Dans un chat en tête-à-tête, les lignes `[` et `]` restent du texte ordinaire.

## Exemples concrets (avant et après)

Voici trois exemples complets, avec le résultat que reçoit le modèle.

Un ton propre à un personnage dans un preset partagé :

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Pour un personnage nommé `Dottore`, le modèle reçoit `Speak in a cold, clinical tone.` Pour tous les autres personnages, il reçoit `Speak warmly and casually.`

Inclure un champ seulement s'il est rempli :

```
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Si le personnage a un champ **Backstory** (histoire personnelle) rempli, le modèle reçoit cette ligne avec le texte correspondant. Si le champ **Backstory** est vide, le bloc entier ne produit rien : aucune étiquette vide n'est envoyée.

Reconnaître une partie du nom de l'utilisateur :

```
{{#if user contains "Dr"}}
Address the user as Doctor.
{{/if}}
```

Si le nom du persona contient `Dr`, le modèle reçoit la consigne de t'appeler Doctor. Sinon, le bloc ne produit rien.

<a id="asking-the-decision-model"></a>

## Interroger le Decision model

Une condition peut aussi interroger ton **Decision model** (modèle de décision) sur ce qui se passe dans le chat. C'est le modèle choisi sous **Decision model** dans le panneau Connections : ton modèle local actuel, une connexion Decision hébergée ou un modèle de décision installé. Il lit les derniers messages et un énoncé que tu écris, puis indique s'il est vrai. Il n'écrit jamais dans le chat. [Modèles de décision](../connections/decision-models.md) explique son rôle et comment le choisir.

Un preset, une fiche, une entrée de lorebook ou un prompt d'agent peut ainsi envoyer une instruction uniquement aux tours concernés, plutôt que "si X se produit, fais Y" à chaque tour. Pour décider de l'activation d'une entrée de lorebook entière plutôt que raccourcir son texte, utilise son champ [Decision](../lorebooks/entries.md#decision-activation). Quelques idées :

- **Changements de scène.** Décrire un nouveau lieu ou une ellipse temporelle seulement si la scène a réellement changé.
- **Types de scène.** Charger les règles de rythme du combat, de l'intimité ou de la tension uniquement pendant une scène de ce type.
- **Répondre d'abord à la question.** `{{#if decision:"In the latest message, {{user}} asks a direct question"}}Answer it before anything else.{{/if}}`
- **Humeurs dans les fiches.** Une fiche de personnage peut contenir un comportement en cas de trouble ou de colère qui n'apparaît que si les messages récents le montrent.
- **Garde-fous de rythme.** Un preset à progression lente peut retenir les instructions d'intensification jusqu'à une évolution visible de la relation.
- **Scènes de groupe.** Dans un bloc de groupe, `{{#if decision:"{{char}} is addressed in the latest message"}}` indique uniquement à la section du personnage interpellé de répondre directement.

### Oui ou non : `decision:`

```
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

La condition est vraie lorsque le Decision model juge l'énoncé vrai. Elle fonctionne avec tout le reste de ce guide : `{{else}}`, `{{else if}}`, `&&`, `||`, parenthèses, imbrication et blocs de groupe.

```
{{#if char == "Dottore" && decision:"In the latest message, {{user}} says something that contradicts what they said earlier"}}
Dottore notices the inconsistency and files it away.
{{/if}}
```

Les macros de l'énoncé sont d'abord résolues ; `{{user}}` et `{{char}}` fonctionnent donc. Dans un bloc de groupe, un énoncé nommant `{{char}}` est évalué une fois par personnage.

### Une réponse parmi plusieurs : `decision_choice:`

`decision_choice:` demande au Decision model de choisir une option. Les options sont les valeurs auxquelles tu le compares, n'importe où dans le prompt :

```
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

Ici, le modèle choisit entre "angry", "sad" et "none of these". La forme courte fonctionne aussi : `decision_choice:"The weather in the latest message" == "rain" || "snow"` propose les deux options. Écris l'énoncé comme un sujet, par exemple "Kaelen's mood in the latest message", et les options comme de courtes réponses.

<a id="sticky-and-cooldown"></a>

### Sticky et cooldown

Un énoncé peut conserver sa réponse pendant quelques tours au lieu d'être évalué à chaque tour. Écris `sticky:` et `cooldown:` après l'énoncé :

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- **sticky:N.** Après un oui, l'énoncé reste oui pendant les N tours suivants sans être réévalué : le contenu qu'il contrôle reste donc dans le prompt.
- **cooldown:N.** Commence à la fin de sticky, ou juste après le oui sans sticky. Pendant N tours, l'énoncé vaut non et n'est pas évalué. Il l'est ensuite de nouveau.
- Un tour correspond à chaque nouveau message lu par le Decision model. Régénérer ou changer le swipe du même message reste le même tour : relancer une réponse ne réduit jamais un minuteur.
- Tant que sticky ou cooldown maintient un énoncé, il n'est pas évalué et ne compte pas dans **Decision statements per turn** (énoncés de décision par tour), laissant sa place à un autre.
- Pour `decision_choice:`, sticky conserve l'option choisie et cooldown rend chaque comparaison fausse. Ne choisir aucune option ne démarre rien.
- Un énoncé présent à plusieurs endroits utilise les durées sticky et cooldown les plus longues indiquées.
- Peek Prompt montre la réponse maintenue sans jamais faire avancer un minuteur.

Ensemble, ils conviennent à ce qui doit apparaître une fois puis attendre : transition de scène, rappel ponctuel ou humeur durant plusieurs tours. Pour une entrée de lorebook activée par son champ **Decision**, utilise ses propres **Sticky** et **Cooldown** : une entrée sticky reste présente sans réévaluation, et une entrée en cooldown n'est pas interrogée.

<a id="checking-every-few-turns"></a>

### Vérifier tous les quelques tours

Certains énoncés n'ont pas besoin d'être évalués à chaque tour. Écris `every:` après l'énoncé pour l'évaluer seulement tous les N tours :

```
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Il est évalué au premier tour où il est atteint, puis 3 tours plus tard, et ainsi de suite.
- Changer le nombre prend effet immédiatement : la prochaine vérification compte depuis le dernier tour d'évaluation.
- Entre les vérifications, il vaut non, n'est pas évalué et ne compte pas dans **Decision statements per turn**.
- Les tours se comptent comme pour sticky et cooldown : une régénération ou un swipe n'avance pas le calendrier. La réutilisation d'une réponse suit les [règles du cache de réponses](#answer-reuse).
- Sticky et cooldown maintiennent toujours la réponse ; `every:` décide seulement quand évaluer un énoncé qu'ils ne maintiennent pas.
- Un énoncé écrit à plusieurs endroits utilise le plus petit `every:` indiqué.

<a id="priority"></a>

### Priorité

Si un plan de prompt contient plus d'énoncés que le budget **Decision statements per turn**, `priority:` détermine lesquels sont évalués. Le budget s'applique à [plusieurs étapes](#statement-allowance) :

```
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- Les énoncés `priority:high` sont évalués en premier, ceux `priority:low` en dernier. Sans priorité indiquée, elle est moyenne.
- À priorité égale, l'ordre d'apparition dans le prompt reste déterminant.
- Au-delà de la limite, les priorités les plus basses sont écartées d'abord : elles valent non et Peek Prompt les liste.
- Un énoncé présent à plusieurs endroits utilise la priorité la plus élevée indiquée.
- Les énoncés propres au prompt (preset, fiches, persona, notes d'auteur) sont planifiés d'abord. Ceux du texte des entrées de lorebook le sont une fois les entrées actives connues, avec les places restantes : ils ne prennent jamais la place d'un énoncé du prompt, quelle que soit leur priorité.

Tous les modificateurs se combinent dans n'importe quel ordre : `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Aucune réponse signifie non

Une condition de décision est **fausse** sans réponse : aucun Decision model défini, délai dépassé ou échec. Pour `decision_choice:`, toutes les comparaisons sont fausses. Un utilisateur sans Decision model reçoit donc la branche `{{else}}`, ou rien.

Conçois le contenu en conséquence :

- Utilise une décision pour **ajouter ou réduire des consignes**, jamais pour porter un contenu indispensable à l'histoire. Une branche manquée doit rendre la réponse un peu moins adaptée, pas la casser.
- Donne à chaque bloc un comportement par défaut cohérent : rien, ou un `{{else}}` convenant à n'importe quel tour.
- N'enchaîne pas les décisions au point qu'une erreur change plusieurs autres réponses.
- Ne conditionne pas le consentement, les avertissements de contenu ou les instructions de sécurité à une décision. Garde-les toujours présents.

Tout modèle peut se tromper. Écris pour "un modèle de décision", jamais "nécessite Jev" : un modèle de chat local peut aussi répondre à ces énoncés. La syntaxe est commune, mais les réponses et leur précision peuvent varier.

<a id="writing-statements"></a>

### Rédiger les énoncés

Ces conseils proviennent de tests sur un modèle de chat local et sur Open-Jev 2B et 9B :

- **Affirme un fait vrai ou faux**, comme une ligne de rapport. Pas une question ("Did the scene change?"), ni une instruction ("If the scene changed, describe it"). Un modèle de chat local a toujours répondu non à une instruction : le bloc ne s'exécutait jamais.
- **Dis "in the latest message"** pour désigner ce tour. Le modèle lit plusieurs messages ; il a répondu oui à "Mira asks questions" parce qu'un ancien message posait une question.
- **Nomme la personne concernée.** "He is angry" a été attribué au mauvais personnage.
- **Décris un élément visible dans le texte**, une action ou des paroles, pas un mot d'humeur à interpréter ("The scene is intense") ni une intention cachée ("Mira is lying").
- Reste bref. Un simple "and" ou une négation fonctionnaient bien dans les tests ; choisis la formulation naturelle.

Pour tester ta formulation :

1. Sélectionne un modèle sous **Decision model**, puis clique sur **Test** (tester). Cela vérifie la connexion avec un exemple fixe, sans tester ton énoncé ni lire ton chat actuel.
2. Ajoute l'énoncé au prompt et envoie des messages représentatifs : certains où il doit être vrai et d'autres où il doit être faux.
3. Utilise **Peek Prompt** pour inspecter la branche envoyée. Pour voir la probabilité et le résultat oui/non, active la [journalisation de débogage](../CONFIGURATION.md#logging-levels).
4. Ajuste la formulation et réessaie. Utilise de nouveaux messages ou modifie l'énoncé pour un nouveau cas : les réponses réussies peuvent être [réutilisées](#answer-reuse). Ouvrir un nouvel aperçu Peek Prompt n'interroge pas le modèle.

Résultats des tests. Chaque formulation a été essayée sur quatre tours de Roleplay étiquetés (deux attendus oui, deux non), avec Open-Jev 2B, Open-Jev 9B et un modèle local Gemma 4 E4B. C'est un petit échantillon d'une seule scène, pas une mesure générale de précision ni un test de Jev hébergé. Le tableau décrit cet échantillon sans promettre le même résultat pour un autre modèle ou chat.

| Écrire | Éviter | Résultat avec la formulation à éviter |
| --- | --- | --- |
| The latest message moves the scene to a new place. | Did the scene change? | La question a fait dépasser le seuil aux tours "non" d'Open-Jev 2B. Le modèle local n'était pas affecté. |
| In the latest message, a character draws a weapon or attacks someone. | The scene is intense. | Les trois ont qualifié une dispute animée d'"intense". Avec un mot vague, le modèle décide du sens à ta place. |
| In the latest message, Mira asks Kaelen a direct question. | Mira asks questions. | Le modèle local et Open-Jev 9B ont dit oui alors que le dernier message de Mira ne demandait rien, parce qu'un précédent le faisait. |
| Kaelen is angry in the latest message. | He is angry. | Le modèle local a interprété "he" comme le tavernier en colère. |
| In the latest message, Mira says something that contradicts what she said earlier. | Mira is lying. | Aucun modèle n'a identifié de façon fiable une contradiction comme un mensonge. |
| The latest message moves the scene to a new place. | If the scene changed, describe the new location in two sentences. | Le modèle local a toujours répondu non à l'instruction ; le bloc ne s'exécutait jamais. |
| Someone is injured in the latest message. | A fight starts and someone is injured and the city guards arrive. | Traitement correct. Séparer reste plus facile à réutiliser et à déboguer. |
| In the latest message, the characters stay in the same place. | The characters did not leave the room. | Aucune différence. Choisis la formulation naturelle. |

Les formulations recommandées ont obtenu 31 sur 32 sur Open-Jev 2B, 31 sur 32 sur Open-Jev 9B et 32 sur 32 sur le modèle local. Les formulations à éviter ont obtenu 26, 25 et 24. Ces petits échantillons illustrent des choix de rédaction ; utilise tes propres cas pour choisir le modèle adapté à tes chats.

<a id="limits-and-cost"></a>

### Limites et coût

<a id="statement-allowance"></a>

#### Budget d'énoncés

**Decision statements per turn**, sous **Decision model**, vaut 32 par défaut. Malgré son nom, ce n'est pas un plafond global sur toutes les requêtes Decision ni sur les dépenses. Marinara l'applique par étapes :

1. Les énoncés du prompt principal du chat sont planifiés dans le budget. Les décisions de lorebook utilisent ensuite ce que ce plan laisse disponible.
2. Pour les agents exécutés avant ou pendant la réponse, Marinara combine les énoncés du prompt principal et des prompts de ces agents, en utilisant de nouveau le budget configuré. Cette étape ne soustrait pas l'usage précédent du lorebook : le total peut donc dépasser le réglage.
3. Les agents de post-traitement reçoivent un budget séparé après la réponse. Leurs énoncés lisent la réponse terminée.

Les **questions d'activation** des agents et **Smart response order** (ordre de réponse Smart) sont séparés de ce réglage.

Seuls les énoncés utilisables à l'étape actuelle entrent dans son plan : sections et groupes de preset activés, options de variables sélectionnées et contenu d'entrées de lorebook activées. Une condition fixe peut exclure un énoncé : `{{#if char == "Dottore" && decision:"..."}}` n'est pas évalué si le personnage est Mira. Les variables peuvent changer pendant l'assemblage du prompt ; une condition de variable ne permet donc pas une exclusion anticipée.

Un énoncé maintenu par [sticky, cooldown](#sticky-and-cooldown) ou [`every:`](#checking-every-few-turns) ne prend aucune place. La [priorité](#priority) choisit ceux qui tiennent dans un plan. L'activation des lorebooks puise dans son budget restant au fil des entrées examinées. Les énoncés écartés valent non et Peek Prompt les liste.

#### Requêtes et durée

Un tour peut produire plusieurs requêtes facturées sur une connexion Decision hébergée. Les énoncés peuvent être regroupés, mais l'activation des lorebooks, le contenu nouvellement activé, les correspondances récursives et les phases des agents peuvent nécessiter plusieurs lots. Les questions d'activation sont regroupées par Scan Depth et phase ; l'ordre Smart fait sa propre requête. Le budget d'énoncés n'est pas une limite de requêtes ou d'argent.

Un modèle de chat local ajoute du temps de calcul plutôt que des frais hébergés. Il répond à `decision_choice:` par une question oui/non par option : un choix peut donc demander plusieurs générations.

Chaque requête a un [délai](../connections/decision-models.md#time-limits) : 1,5 seconde par défaut pour une connexion Decision, ou le budget du backend local. Plusieurs requêtes peuvent allonger l'attente cumulée. Un modèle local qui doit raisonner s'abstient avant la réponse, sauf si tu actives **Also gate agents that run before the reply** (évaluer aussi les agents exécutés avant la réponse).

<a id="answer-reuse"></a>

#### Réutilisation des réponses

Les réponses réussies sont normalement réutilisées pour le même tour et Decision model : une régénération envoie donc souvent les mêmes branches sans nouvelle requête. Ce cache vit dans le serveur en cours d'exécution et conserve jusqu'à 200 clés de tour. Un redémarrage ou une éviction peut provoquer une nouvelle requête. Un dernier message nouveau ou modifié, un autre modèle, un énoncé modifié ou un ensemble d'options changé peuvent aussi nécessiter une nouvelle réponse.

Les réponses absentes ou en échec ne sont pas mises en cache comme des réponses "non" valides : réessayer le même tour peut interroger de nouveau et emprunter une autre branche. Le minutage sticky/cooldown est indépendant de ce cache.

Les énoncés de prompts d'agents suivent les mêmes règles. Les agents avant/parallèles lisent le tour avant réponse ; ceux de post-traitement lisent la réponse terminée : un swipe modifié peut donc nécessiter de nouvelles réponses. Une relance manuelle réutilise les réponses réussies encore en cache pour ses entrées. Consulte [Énoncés de décision dans le prompt de l'agent](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Cache de prompts

Le **cache de prompts** du fournisseur est séparé du cache de réponses Decision de Marinara. Il peut réutiliser un préfixe inchangé du prompt envoyé au modèle de chat. Changer une branche peut empêcher la réutilisation à partir de ce point ; un préfixe antérieur inchangé peut rester admissible. La portion exacte et la facturation dépendent du fournisseur, des frontières du cache, de sa longueur minimale et de sa durée de vie.

**Place les blocs de décision changeants vers la fin du prompt**, par exemple dans les instructions après l'historique ou une note d'auteur peu profonde. Un changement tôt peut faire perdre l'essentiel des économies de cache. Garde une décision en haut uniquement si sa réponse change rarement et si ses instructions y ont leur place. Cela vaut aussi pour les options de variables de preset : leur texte arrive à l'emplacement de `{{name}}`.

Sur une connexion directe Anthropic avec **Enable prompt caching** (activer le cache de prompts), Marinara marque la fin du prompt système et un message situé **Cache depth** (profondeur du cache) messages avant le plus récent (5 par défaut). Un changement avant l'historique peut invalider la frontière système et l'historique suivant, même si un préfixe antérieur correspondant reste réutilisable. Un changement après la frontière marquée de l'historique peut préserver ce préfixe en cache. Entre les deux frontières, il peut préserver le préfixe système tout en perdant une partie de l'historique en cache. Les lectures et écritures du cache ont des prix différents.

La longueur minimale et les frontières prises en charge varient selon le modèle et peuvent changer. Consulte le [guide actuel du cache de prompts Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) ou le [guide du cache de prompts OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching) pour ces détails et les règles de facturation.

<a id="when-a-decision-branch-never-appears"></a>

### Quand une branche de décision n'apparaît jamais

Si un utilisateur signale qu'une branche n'apparaît jamais, les causes probables sont, dans l'ordre :

1. **Aucun Decision model défini.** Toutes les conditions de décision sont fausses à chaque tour. L'éditeur avertit sous chaque champ concerné.
2. **Le Decision model ne répond pas.** Connexion hébergée avec clé incorrecte, sans crédits ou limitée ; modèle local arrêté ou trop lent ; modèle de décision installé qui n'a pas démarré.
3. **C'est un modèle de raisonnement** qui s'abstient avant la réponse.
4. **Trop d'énoncés à l'étape de planification concernée**, au-delà de son budget.
5. **Il répond, mais sous son seuil.** Souvent à cause de la formulation, ou d'un modèle qui note ce tour plus bas que prévu.

Demande quel Decision model l'utilisateur a choisi et ce qu'affiche **Test**. **Peek Prompt** montre les branches réellement envoyées. S'il doit construire un nouvel aperçu, il liste les énoncés sans réponse, qui y valent non. Au niveau de journal debug, chaque énoncé, sa réponse et son interprétation comme oui sont enregistrés ; consulte [Niveaux de journalisation](../CONFIGURATION.md#logging-levels).

La correction se trouve rarement dans le preset. Quand c'est le cas, elle concerne généralement la formulation ou une branche portant quelque chose d'indispensable au prompt.

## Guides associés

- [Modèles de décision](../connections/decision-models.md)
- [Macros de prompt](macros.md)
- [Variables de preset](preset-variables.md)
- [Chats de groupe et conversations de groupe](../chats/group-chats.md)
