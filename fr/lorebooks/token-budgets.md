# Budgets de tokens et récursivité des lorebooks

Ce guide explique comment Marinara Engine limite la quantité de texte de lorebook qui parvient à l'IA. Au programme : le **Token Budget** (budget de tokens) et le champ **Entry Limit** (limite d'entrées) propres à chaque lorebook, ainsi que le **Lorebook Token Budget** valable pour tout le chat. Tu découvres aussi comment Marinara élague les entrées quand un budget est plein, et à quoi sert l'analyse **Recursive** (récursive).

Un token est un petit morceau de texte, quelques caractères environ. Chaque modèle possède une fenêtre de contexte limitée, c'est-à-dire la quantité totale de texte qu'il peut lire d'un coup. Les budgets empêchent les lorebooks de remplir cette fenêtre et d'étouffer la conversation elle-même.

## Deux budgets de tokens

Marinara applique deux budgets de tokens distincts à chaque fois qu'il construit un prompt, le texte qu'il envoie à l'IA. Si une entrée fait dépasser l'un des deux plafonds, Marinara l'écarte.

1. Chaque lorebook a son propre **Token Budget**. Il plafonne la quantité de texte que ce seul lorebook peut ajouter par réponse.
2. Le chat dispose d'un unique **Lorebook Token Budget**. Il plafonne le texte cumulé de tous les lorebooks actifs dans ce chat.

Les deux plafonds s'appliquent en même temps. Une entrée peut être bloquée par le budget du lorebook, par celui du chat, ou par les deux.

## Régler les champs Token Budget et Entry Limit d'un lorebook

Ouvre un lorebook depuis le panneau **Lorebooks**, puis va dans l'onglet **Overview** (vue d'ensemble). Deux champs numériques apparaissent près des réglages d'analyse.

- **Token Budget** (par défaut **2048**) : le nombre maximal de tokens que ce lorebook peut ajouter dans une réponse. Mets **0** pour un budget illimité.
- **Entry Limit** (par défaut **100**) : le nombre maximal d'entrées que ce lorebook peut ajouter dans une réponse. La valeur va de **1** à **1000**.

Le champ **Entry Limit** est un plafond distinct du budget de tokens. Il compte des entrées, pas des tokens. Même s'il reste de la place dans le budget de tokens, un lorebook cesse d'ajouter des entrées dès qu'il atteint cette limite. À l'inverse, le budget de tokens peut écarter des entrées alors que le lorebook n'a pas atteint son **Entry Limit**.

Prends l'exemple d'un lorebook dont le **Token Budget** vaut **2048** et qui contient une entrée de 3000 tokens. Ce lorebook ne pourra jamais ajouter cette entrée. Baisse le budget seulement si un lorebook prend trop de place. Augmente-le si des entrées importantes sont écartées en permanence.

## Le Lorebook Token Budget commun au chat

Le plafond au niveau du chat se trouve dans le panneau latéral **Settings** (Paramètres) du chat, dans la section **Lorebooks**.

1. Ouvre un chat.
2. Ouvre le panneau latéral **Settings** du chat.
3. Repère la section **Lorebooks**.
4. Renseigne le champ **Lorebook Token Budget**.

La valeur par défaut est **8192**. Mets **0** pour un budget illimité. Ce budget vaut pour l'ensemble des lorebooks actifs dans ce chat. Il s'ajoute au **Token Budget** propre à chaque lorebook.

## Comment les entrées sont élaguées

Quand plus d'entrées correspondent qu'un budget ne l'autorise, Marinara garde les plus importantes et abandonne le reste. Marinara trie les entrées avant d'élaguer, pour que celles dont tu as le plus besoin survivent.

- Les entrées **Constant** viennent en premier. Ce sont celles réglées pour être insérées chaque fois que le lorebook est actif.
- Viennent ensuite les entrées qui correspondent à ton dernier message.
- Les entrées restantes suivent dans leur ordre d'insertion habituel.

Marinara parcourt cette liste et ajoute chaque entrée qui tient encore. Si une entrée fait dépasser un budget, Marinara l'écarte et passe à la suivante. Toutes les entrées situées en dessous sont malgré tout examinées. Une petite entrée peut donc passer même après qu'une plus grosse a été écartée.

<a id="seeing-skipped-entries-in-active-context"></a>

## Voir les entrées écartées dans Active Context

Pas besoin de deviner quelles entrées ont été écartées. Ouvre **Chat Settings** et déplie **Active Context** (contexte actif). Cette section affiche le résultat en direct de la dernière analyse des lorebooks.

Si des entrées correspondantes ont été écartées, un avertissement ambre s'affiche en haut. Il indique "N matching lore entries were skipped by token budget." Déplie-le pour voir chaque entrée écartée.

Chaque entrée écartée indique de quel lorebook elle provient et pourquoi elle a été bloquée. Le motif est l'un des suivants :

- **lorebook budget** : l'entrée ne tenait pas dans le **Token Budget** de ce seul lorebook.
- **chat budget** : l'entrée ne tenait pas dans le **Lorebook Token Budget** commun au chat.
- **lorebook and chat budgets** : les deux plafonds étaient déjà pleins.

Déplie une entrée écartée pour en savoir plus. Tu y trouves les mots-clés correspondants, la taille estimée en tokens et la part du budget déjà consommée. Si de gros lorebooks sont écartés en permanence, **Active Context** suggère les agents **Knowledge Retrieval** ou **Knowledge Router**. Ils gèrent souvent mieux les gros lorebooks qu'une augmentation des plafonds.

## Analyse récursive

En temps normal, Marinara ne cherche les correspondances de mots-clés que dans tes messages récents. Avec l'analyse **Recursive** activée, il parcourt aussi le texte des entrées qui viennent de s'activer. Une entrée activée peut ainsi en entraîner d'autres, celles dont les mots-clés figurent dans son texte.

Active l'option dans l'onglet **Overview** du lorebook.

1. Ouvre le lorebook.
2. Ouvre l'onglet **Overview**.
3. Active l'interrupteur **Recursive**. Il est désactivé par défaut.
4. Règle le champ **Max Depth** (profondeur maximale) si tu veux changer la longueur de l'enchaînement.

Le champ **Max Depth** (par défaut **3**) fixe le nombre de passes d'analyse supplémentaires. Chaque passe cherche de nouvelles correspondances de mots-clés dans les entrées fraîchement activées. La valeur va de **1** à **10**. Plus elle est élevée, plus tu trouves de lore relié, mais plus le traitement est lourd.

La récursivité s'active aussi entrée par entrée. Dans le panneau latéral déplié d'une entrée, l'interrupteur **Recursion** détermine si le contenu de cette entrée peut déclencher d'autres entrées. Il est désactivé par défaut. Laisse-le ainsi, sauf si cette entrée doit vraiment en entraîner d'autres. Voir [Entrées de lorebook : clés, position et moment d'insertion](entries.md) pour tous les réglages d'entrée.

La récursivité ne contourne pas les budgets. Les entrées trouvées par une passe récursive comptent dans le **Token Budget**, dans le champ **Entry Limit** et dans le **Lorebook Token Budget** commun au chat, comme n'importe quelle autre entrée.

## Guides associés

- [Entrées de lorebook : clés, position et moment d'insertion](entries.md)
- [Vue d'ensemble des lorebooks](overview.md)
- [Sources de connaissances : agents Retrieval et Router](../agents/knowledge-sources.md)
