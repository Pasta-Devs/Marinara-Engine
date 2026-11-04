# Budgets de tokens et récursivité des lorebooks

Les budgets limitent la quantité de texte de lorebook qui parvient à l'IA, pour que les lorebooks n'étouffent pas le chat. Ce guide couvre le **Token Budget** (budget de tokens) et le champ **Entry Limit** (limite d'entrées) de chaque lorebook, le **Lorebook Token Budget** (budget de tokens des lorebooks) du chat, la façon dont Marinara élague les entrées, et l'analyse **Recursive** (récursive).

Les tokens sont de petits morceaux de texte que les modèles comptent. La fenêtre de contexte d'un modèle, c'est la quantité de texte qu'il peut lire d'un coup, comptée en tokens. Le texte des lorebooks partage cette fenêtre avec le reste du prompt, c'est-à-dire le texte que Marinara envoie à l'IA.

## Deux budgets de tokens

Marinara applique deux budgets chaque fois qu'il construit un prompt. Si une entrée fait dépasser son plafond à l'un des deux, elle est écartée.

- Chaque lorebook a son propre **Token Budget** : le nombre maximal de tokens que ce lorebook peut ajouter à une réponse.
- Chaque chat a un seul **Lorebook Token Budget** : le nombre maximal de tokens que tous les lorebooks actifs peuvent ajouter ensemble.

## Régler les champs Token Budget et Entry Limit d'un lorebook

1. Ouvre un lorebook depuis le panneau **Lorebooks**.
2. Clique sur l'onglet **Overview** (vue d'ensemble).
3. Règle **Token Budget** et **Entry Limit**.

| Réglage | Par défaut | Rôle |
| --- | --- | --- |
| **Token Budget** | 2048 | Le nombre maximal de tokens que ce lorebook ajoute dans une réponse. 0 signifie illimité. |
| **Entry Limit** | 100 | Le nombre maximal d'entrées que ce lorebook ajoute dans une réponse. Plage de 1 à 1000. |

**Entry Limit** compte des entrées, pas des tokens. Un lorebook cesse d'ajouter des entrées dès qu'il atteint l'une ou l'autre limite.

Par exemple, avec un **Token Budget** de 2048, une entrée de 3000 tokens ne peut jamais être ajoutée, même seule. Baisse un budget si un lorebook prend trop de place. Augmente-le si des entrées importantes sont sans cesse écartées.

## Régler le Lorebook Token Budget du chat

1. Ouvre un chat.
2. Ouvre **Chat Settings** (réglages du chat).
3. Repère la section **Lorebooks** et renseigne **Lorebook Token Budget**.

La valeur par défaut est 8192, et 0 signifie illimité. C'est le total pour tous les lorebooks actifs dans ce chat, en plus du **Token Budget** propre à chaque lorebook.

## Comment les entrées sont élaguées

Quand plus d'entrées correspondent qu'un budget ne l'autorise, Marinara ajoute les entrées dans cet ordre.

1. Les entrées **Constant**.
2. Les entrées qui correspondent aux derniers messages.
3. Les autres, dans leur ordre d'insertion (le champ **Order** de l'entrée).

Marinara ajoute chaque entrée qui tient encore. Quand une entrée ne tient pas, il l'écarte et continue d'examiner les suivantes. Une entrée plus petite peut donc encore passer après qu'une plus grosse a été écartée.

<a id="seeing-skipped-entries-in-active-context"></a>

## Voir les entrées écartées dans Active Context

1. Ouvre **Chat Settings**.
2. Déplie **Active Context** (contexte actif). Cette section affiche la dernière analyse des lorebooks.

Si des entrées correspondantes ont été écartées, un avertissement en haut indique "N matching lore entries were skipped by token budget." Il nomme chaque budget qui a écarté des entrées et indique où le modifier. Déplie-le pour voir chaque entrée écartée, son lorebook, ses mots-clés correspondants, sa taille estimée et la part du budget déjà consommée. Le motif est l'un des suivants.

| Motif | Signification |
| --- | --- |
| **lorebook budget** | L'entrée ne tenait pas dans le **Token Budget** de ce lorebook. |
| **chat budget** | L'entrée ne tenait pas dans le **Lorebook Token Budget** du chat. |
| **lorebook and chat budgets** | Les deux plafonds étaient déjà pleins. |
| **current-location context cap** | L'entrée est rattachée au lieu actuel de la carte, qui a son propre plafond fixe de 2 048 tokens. |

Une entrée dont le texte est vide, ou réduit à rien par les macros, n'est pas listée. Ses macros s'exécutent quand même : un `{{setvar}}` qu'elle contient définit toujours la variable. Avec les deux budgets à 0, seul le plafond du lieu peut faire apparaître des entrées écartées.

Si de gros lorebooks sont sans cesse écartés, **Active Context** suggère les agents **Knowledge Retrieval** ou **Knowledge Router**. Voir [Sources de connaissances](../agents/knowledge-sources.md). Ces agents conviennent souvent mieux aux gros lorebooks qu'un plafond plus élevé.

## Analyse récursive

En temps normal, Marinara ne cherche les mots-clés que dans tes messages récents. Avec **Recursive** activé, il parcourt aussi le texte des entrées qui viennent de s'activer. Une entrée peut ainsi en entraîner d'autres qui lui sont liées.

1. Ouvre le lorebook et clique sur **Overview**.
2. Active **Recursive**. L'option est désactivée par défaut.
3. Règle **Max Depth** (profondeur maximale) si tu veux changer la longueur de l'enchaînement.

**Max Depth** est le nombre de passes d'analyse supplémentaires. La valeur par défaut est 3 et la plage va de 1 à 10. Plus la valeur est élevée, plus tu trouves de lore relié, et plus le traitement est lourd.

Chaque entrée a aussi son propre interrupteur **Recursion**, désactivé par défaut, qui détermine si le contenu de cette entrée peut déclencher d'autres entrées. Laisse-le désactivé, sauf si l'entrée doit en entraîner d'autres. Voir [Les entrées de lorebook : mots-clés, position et déclenchement](entries.md).

La récursivité ne contourne pas les budgets. Les entrées trouvées par une passe récursive comptent dans le **Token Budget**, le champ **Entry Limit** et le **Lorebook Token Budget** du chat.

## Guides associés

- [Les entrées de lorebook : mots-clés, position et déclenchement](entries.md)
- [Vue d'ensemble des lorebooks](overview.md)
- [Sources de connaissances : les agents Knowledge Retrieval et Knowledge Router](../agents/knowledge-sources.md)
