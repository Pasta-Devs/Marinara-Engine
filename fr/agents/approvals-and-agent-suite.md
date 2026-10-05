# Approbations d'agents et Agent Suite

Ce guide explique comment relire et piloter ce que les agents (de petits programmes d'IA qui travaillent en parallèle de tes réponses) écrivent pendant un chat. Au programme : l'interrupteur **Review Agent Outputs** (relire les sorties des agents), les deux fenêtres de relecture, l'éditeur **Agent Suite** et le panneau **Cached prompt injections** (insertions de prompt en cache).

## Review Agent Outputs

Certains agents veulent écrire de nouvelles données dans le chat. Un agent Lorebook peut ajouter des entrées de lorebook. Un agent de résumé peut enregistrer un résumé du chat. Par défaut, une partie de ces écritures est enregistrée automatiquement. Avec l'interrupteur **Review Agent Outputs**, tu vérifies chaque écriture d'abord.

Pour trouver cet interrupteur :

1. Ouvre le chat que tu veux piloter.
2. Ouvre **Chat Settings** (réglages du chat).
3. Descends jusqu'à la section **Agents**.
4. Active **Review Agent Outputs**.

Quand **Review Agent Outputs** est activé, les mises à jour de lorebook, les mises à jour de résumé et les autres sorties d'agents rédacteurs soumises à relecture attendent ton approbation avant d'être enregistrées. Quand il est désactivé, les mises à jour de lorebook et de résumé peuvent être enregistrées automatiquement.

Les modifications de fiche de personnage sont un cas à part. Elles demandent toujours ton approbation, même quand **Review Agent Outputs** est désactivé. Impossible de désactiver cette sécurité.

## La fenêtre d'approbation des écritures d'agents

Quand **Review Agent Outputs** est activé et qu'un agent propose une écriture de lorebook ou de résumé, une fenêtre de relecture s'ouvre. Son titre est **Review Lorebook Update** ou **Review Summary Update**, selon le type d'écriture.

La fenêtre affiche :

- Le nom de l'agent à l'origine de la proposition.
- Un champ **Proposed Text** (texte proposé) que tu peux modifier avant d'enregistrer.
- Pour les écritures de lorebook, un rappel : chaque entrée doit rester sous un titre `###`.

Trois choix s'offrent à toi en bas de la fenêtre :

- **Accept** (accepter) : enregistre le texte dans le chat, avec tes éventuelles modifications.
- **Regenerate** (régénérer) : relance uniquement cet agent pour obtenir une nouvelle proposition.
- **Discard** (abandonner) : jette la proposition sans rien enregistrer.

Si plusieurs propositions attendent, la fenêtre indique combien il en reste dans la file. Elle se rouvre sur la suivante dès que tu as traité la précédente.

## La relecture des mises à jour de fiche de personnage

L'agent **Card Evolution Auditor** peut proposer des modifications des champs de la fiche de personnage, d'après ce qui s'est passé pendant le roleplay. En mode Conversation, l'outil intégré `update_about_me` peut lui aussi proposer une modification de la partie publique About Me. Aucun des deux ne touche à la fiche tout seul : les deux ouvrent la fenêtre **Review Character Card Updates** et c'est toi qui décides.

La fenêtre liste chaque modification proposée. Pour chacune, tu vois :

- Le champ de la fiche concerné (description, personnalité ou apparence, par exemple).
- Une courte justification, quand l'agent en donne une.
- Un bloc **Before** (avant) avec le texte actuel.
- Un champ **After** (après) avec le nouveau texte. Tu peux le modifier avant de l'approuver.

Voici les actions disponibles :

- **Approve** (approuver) : applique les modifications. Le chiffre affiché sur le bouton indique combien seront appliquées. Une approbation fait monter le numéro de version du personnage et enregistre une entrée dans l'historique des versions.
- **Regenerate** : relance l'agent pour obtenir de nouvelles propositions.
- **Reject** (rejeter) : écarte les propositions sans modifier la fiche.

Il arrive qu'une fiche ait changé depuis que l'agent a rédigé sa proposition. Dans ce cas, l'application marque la modification comme **stale** (obsolète) et la grise. S'il y a des modifications obsolètes, un bouton **Override stale** apparaît avec leur nombre. Ne l'utilise que si tu tiens vraiment à conserver ce texte. L'application te demande d'abord confirmation. Elle ajoute ensuite le texte obsolète au champ, au lieu de remplacer un texte qui ne correspond plus.

## L'éditeur Agent Suite et la réécriture assistée par IA

L'éditeur **Agent Suite** te montre tout ce que les agents de ce chat ont stocké, et te laisse le modifier. Cela couvre les données de tracker (scène en cours, personnages présents, caractéristiques du persona) et les sorties enregistrées de tes agents personnalisés. Corrige un nom erroné, rectifie une caractéristique ou nettoie un texte stocké bancal, à la main ou avec l'aide de l'IA.

Pour l'ouvrir :

1. Ouvre **Chat Settings**.
2. Descends jusqu'à la section **Agents**.
3. Clique sur **Agent Suite**.

À gauche s'affiche la liste des agents actifs dans ce chat. Choisis-en un pour voir ce qu'il a stocké. La partie droite présente des blocs modifiables, répartis entre **Stored Memory** (mémoire stockée), **Tracker Data** (données de tracker, pour les trackers uniquement) et **Recent Outputs** (sorties récentes, pour les agents personnalisés uniquement). Les agents qui ne suivent aucune donnée n'affichent que **Stored Memory**.

Chaque bloc est un éditeur de texte ou de JSON. Après avoir modifié un bloc :

- Clique sur **Save** (enregistrer) pour conserver ta modification.
- Clique sur **Reset** (réinitialiser) pour annuler ta modification non enregistrée et revenir à la valeur stockée.

Autre option : laisser l'IA réécrire un bloc à ta place.

1. Clique sur **AI Edit** (édition par IA) sur le bloc à modifier.
2. Pour ne viser qu'une partie du texte, sélectionne-la d'abord dans l'éditeur. Sans sélection, c'est tout le bloc qui est réécrit.
3. Saisis une instruction, par exemple "corrige les noms de personnages déformés, elle s'appelle Mira".
4. Facultatif : clique sur **Add Context** (ajouter du contexte) pour joindre des fiches de personnage ou des entrées de lorebook. L'IA comprend ainsi mieux ce que représentent les données.
5. Choisis la connexion (le fournisseur d'IA et le modèle) qui réalisera la réécriture.
6. Clique sur **Rewrite** (réécrire).

Le texte réécrit arrive dans le bloc sous forme de brouillon non enregistré. Relis-le, puis clique sur **Save** pour le garder ou sur **Reset** pour l'abandonner.

Quelques précisions :

- Si des agents tournent encore pour ce chat, l'enregistrement est suspendu jusqu'à ce qu'ils aient fini.
- La section **Stored Memory** comporte un bouton **Clear memory** (effacer la mémoire). Il n'apparaît que si l'agent a stocké des données. Il supprime d'un coup tout ce que cet agent a stocké pour ce chat, sans retour possible. L'application te demande d'abord confirmation.
- Pour le **Narrative Director**, les spoilers stockés sont masqués. Utilise **Reveal spoilers** (afficher les spoilers) pour les voir et les modifier.

## Le panneau Cached prompt injections

Avant la génération de ta réponse, certains agents rédacteurs ajoutent du texte au prompt (le texte que Marinara envoie à l'IA). C'est courant pour **Prose Guardian**, **Narrative Director** et les agents d'insertion personnalisés. Le panneau **Cached prompt injections** sert à inspecter ce texte ajouté quand quelque chose cloche. Tu le trouves dans l'onglet **Injections** de [Agent activity](../roleplay/getting-started.md#agent-activity) en Roleplay, quand **Debug mode** est activé. Il porte sur la réponse la plus récente.

Pour chaque insertion en cache, tu peux :

- La déplier pour lire et modifier le texte.
- Cliquer sur l'icône **Save** pour conserver ta modification.
- Cliquer sur l'icône **Re-run** (relancer) pour que cet agent rédige une nouvelle insertion.

Les insertions de **Knowledge Retrieval** et **Knowledge Router** ne peuvent pas être relancées depuis ce panneau. Tes modifications et tes relances ne prennent effet que si tu régénères cette même réponse. Une relance s'appuie sur l'historique du chat tel qu'il était à ce moment-là, sans les messages plus récents.

## Guides associés

- [Agents : des aides IA pour tes chats](agents-overview.md)
- [Référence des agents téléchargeables](built-in-agents.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
