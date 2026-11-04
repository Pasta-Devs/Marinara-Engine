# Approbations d'agents et Agent Suite

Les agents peuvent écrire dans ton chat : entrées de lorebook, résumés et modifications de fiche de personnage. Ce guide explique comment relire ces écritures avant leur enregistrement, et comment consulter et corriger ce que les agents ont stocké avec l'éditeur **Agent Suite**.

## Relire les écritures des agents avant leur enregistrement

Par défaut, certaines écritures d'agents s'enregistrent toutes seules. Avec l'interrupteur **Review Agent Outputs** (relire les sorties des agents), chacune attend ton approbation.

1. Ouvre le chat et clique sur **Chat Settings** (réglages du chat).
2. Descends jusqu'à la section **Agents**.
3. Dans un chat Roleplay, ouvre **Trackers Control** (contrôle des trackers). Dans une partie, ignore cette étape.
4. Active **Review Agent Outputs**.

Quand il est activé, les mises à jour de lorebook, les mises à jour de résumé et les autres sorties d'agents rédacteurs soumises à relecture t'attendent. Quand il est désactivé, les mises à jour de lorebook et de résumé peuvent s'enregistrer automatiquement.

Les modifications de fiche de personnage demandent toujours ton accord d'abord, même quand **Review Agent Outputs** est désactivé. Impossible de désactiver cette vérification.

### Relire une mise à jour de lorebook ou de résumé

Quand un agent propose une écriture, une fenêtre s'ouvre avec le titre **Review Lorebook Update** ou **Review Summary Update**. Elle affiche le nom de l'agent et un champ **Proposed Text** (texte proposé) que tu peux modifier. Pour les écritures de lorebook, elle te rappelle aussi de garder chaque entrée sous un titre `###`.

- **Accept** (accepter) enregistre le texte, avec tes modifications.
- **Regenerate** (régénérer) relance uniquement cet agent pour obtenir une nouvelle proposition.
- **Discard** (abandonner) écarte la proposition sans rien enregistrer.

Si d'autres propositions attendent, la fenêtre indique combien. Elle se rouvre sur la suivante quand tu as terminé celle en cours.

Un agent doté de la capacité **Create character cards** (créer des fiches de personnage) peut aussi proposer une nouvelle fiche de personnage. Il ouvre une fenêtre de relecture avec le texte de la fiche. Rien n'est enregistré tant que tu n'as pas accepté.

### Relire une mise à jour de fiche de personnage

L'agent **Card Evolution Auditor** propose des modifications d'une fiche de personnage d'après ce qui s'est passé dans le roleplay. En mode Conversation, l'outil intégré `update_about_me` peut aussi proposer une modification de la partie publique About Me. Aucun des deux ne modifie ta fiche tout seul. Les deux ouvrent **Review Character Card Updates**.

Pour chaque modification proposée, la fenêtre affiche le champ de la fiche concerné, une courte justification quand l'agent en donne une, un bloc **Before** (avant) avec le texte actuel et un champ **After** (après) que tu peux modifier.

- **Approve** (approuver) applique les modifications. Le chiffre sur le bouton indique combien seront appliquées. L'approbation fait monter le numéro de version du personnage et enregistre une entrée dans l'historique des versions.
- **Regenerate** relance l'agent pour obtenir de nouvelles propositions.
- **Reject** (rejeter) les écarte sans modifier la fiche.

Si la fiche a changé après que l'agent a rédigé sa proposition, la modification est marquée comme obsolète et grisée. Un bouton **Override stale** apparaît alors avec le nombre de modifications concernées. Ne l'utilise que si tu veux toujours ce texte. Marinara te demande de confirmer, puis ajoute le texte obsolète au champ au lieu de remplacer un texte qui ne correspond plus.

## Consulter et modifier ce que les agents ont stocké

L'éditeur **Agent Suite** affiche tout ce que les agents de ce chat ont stocké : les données de tracker, comme la scène en cours, les personnages présents et les caractéristiques du persona, ainsi que les sorties enregistrées des agents personnalisés. Sers-t'en pour corriger un nom erroné, rectifier une caractéristique ou nettoyer un texte bancal.

1. Ouvre **Chat Settings** et descends jusqu'à **Agents**.
2. Clique sur **Agent Suite**.
3. Choisis un agent dans la liste de gauche.

La partie droite présente des blocs modifiables, répartis en trois groupes au plus : **Stored Memory** (mémoire stockée), **Tracker Data** (données de tracker, pour les trackers uniquement) et **Recent Outputs** (sorties récentes, pour les agents personnalisés uniquement). Les agents qui ne suivent aucune donnée n'affichent que **Stored Memory**.

Chaque bloc est un éditeur de texte ou de JSON. Les blocs JSON affichent des numéros de ligne et signalent tout de suite un JSON invalide. **Save** (enregistrer) reste désactivé tant que le JSON n'est pas valide. Pour chercher dans toutes les données de tracker ou les modifier sous forme de champs, clique sur **Open in State Editor** dans l'en-tête de **Tracker Data**. Voir [Le State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

Après avoir modifié un bloc, clique sur **Save** pour le conserver ou sur **Reset** (réinitialiser) pour revenir à la valeur stockée.

### Laisser l'IA réécrire un bloc

1. Clique sur **AI Edit** (édition par IA) sur le bloc.
2. Pour ne modifier qu'une partie, sélectionne d'abord ce texte. Sans sélection, c'est tout le bloc qui est réécrit.
3. Saisis une instruction, par exemple "corrige les noms de personnages déformés, elle s'appelle Mira".
4. Facultatif : clique sur **Add Context** (ajouter du contexte) pour joindre des fiches de personnage ou des entrées de lorebook, afin que l'IA sache ce que représentent les données.
5. Choisis la connexion (le service d'IA et le modèle) qui réalise la réécriture.
6. Clique sur **Rewrite** (réécrire).

Le résultat arrive dans le bloc sous forme de brouillon non enregistré. Relis-le, puis clique sur **Save** ou **Reset**.

- Tant que des agents tournent encore pour ce chat, l'enregistrement attend qu'ils aient fini.
- Le bouton **Clear memory** (effacer la mémoire) n'apparaît dans **Stored Memory** que si l'agent a stocké des données. Il supprime d'un coup tout ce que cet agent a stocké pour ce chat, sans retour possible. Marinara te demande d'abord confirmation.
- Pour le **Narrative Director**, les spoilers stockés sont masqués. Utilise **Reveal spoilers** (afficher les spoilers) pour les voir et les modifier.

## Voir les insertions de prompt en cache

Avant la génération d'une réponse, certains agents rédacteurs ajoutent du texte au prompt (le texte que Marinara envoie à l'IA). C'est courant pour **Prose Guardian**, **Narrative Director** et les agents d'insertion personnalisés. Le panneau **Cached prompt injections** (insertions de prompt en cache) affiche ce texte pour la réponse la plus récente. C'est une vue de dépannage.

Avant de commencer : active **Debug mode** (mode débogage). Voir la [vue d'ensemble des agents](agents-overview.md#tell-whether-an-agent-ran). Dans un chat Roleplay, ouvre l'onglet **Injections** du panneau **Agent activity** (activité des agents). Voir [Agent activity](../roleplay/getting-started.md#agent-activity).

Pour chaque insertion, tu peux la déplier pour lire et modifier le texte, cliquer sur l'icône **Save** pour conserver ta modification, ou cliquer sur l'icône **Re-run** (relancer) pour que cet agent en rédige une nouvelle.

Les insertions de **Knowledge Retrieval** et **Knowledge Router** ne peuvent pas être relancées ici. Les modifications et les relances ne prennent effet que si tu régénères cette même réponse. Une relance s'appuie sur l'historique du chat tel qu'il était à ce moment-là, sans les messages plus récents.

## Guides associés

- [Agents : des aides IA pour tes chats](agents-overview.md)
- [Référence des agents téléchargeables](built-in-agents.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
