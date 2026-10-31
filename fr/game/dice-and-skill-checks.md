# Game Mode : jets de dés et jets de compétence

Ce guide explique comment lancer les dés dans le Game Mode de Marinara Engine. Au programme : le menu de dés rapides, la notation personnalisée et les limites imposées aux jets personnalisés. Tu verras aussi comment le Game Master (le maître du jeu) résout un jet de compétence face à un degré de difficulté (DC, pour Difficulty Class).

## Lancer les dés

Dans un chat en Game Mode, la barre de saisie du message comporte un bouton dé. Survole-le : l'infobulle indique **Roll dice** (lancer les dés). Clique dessus pour ouvrir le menu de dés rapides.

Le menu propose huit presets accessibles en un clic :

| Preset | Ce que ça lance |
|---|---|
| d20 | un dé à 20 faces |
| d6 | un dé à 6 faces |
| 2d6 | deux dés à 6 faces |
| d10 | un dé à 10 faces |
| d100 | un dé à 100 faces |
| d4 | un dé à 4 faces |
| d8 | un dé à 8 faces |
| d12 | un dé à 12 faces |

Pour un jet rapide, procède ainsi :

1. Ouvre la barre de saisie du message dans un chat en Game Mode.
2. Clique sur le bouton dé.
3. Clique sur l'un des huit presets, par exemple **d20**.
4. Une petite pastille apparaît dans la barre de saisie, du type `🎲 d20`.

Le jet ne part pas tout de suite : il est mis en file d'attente. Pour retirer un jet en attente, clique sur le bouton d'effacement de la pastille. Son infobulle indique **Clear queued roll** (supprimer le jet en attente).

Le calcul des dés se fait au moment où tu envoies ton prochain message. L'application ajoute le résultat à la fin du message, sous forme de tag. Un dé unique, sans bonus, donne ceci :

```
[dice: d20 = 14]
```

Un jet avec plusieurs dés ou avec un bonus affiche aussi le détail :

```
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

Le Game Master lit ce tag et construit sa narration autour du résultat.

Quand le Game Master effectue plusieurs jets dans un tour, chaque carte de dés occupe sa propre place dans la file. Ferme une carte pour voir la suivante. Tous les jets sont enregistrés dans le swipe actif (la réponse alternative) de ce tour et restent dans **Logs** (journaux) après un rechargement. Continuer un tour conserve ses jets précédents ; le régénérer crée un ensemble distinct pour le nouveau swipe.

Le Game Master peut aussi demander un jet dans la narration avec `[dice: 3d8+2]`. Le moteur fournit les vrais nombres et affiche la même carte animée. Cela fonctionne avec les connexions limitées au texte, y compris les abonnements Claude et Grok. La notation et les limites sont les mêmes que dans le menu de dés.

## Notation personnalisée

Le menu des dés contient aussi un champ de texte pour un jet personnalisé. Il utilise la notation standard `NdM` : `N` est le nombre de dés à lancer et `M` le nombre de faces de chaque dé. Tu peux ajouter un bonus ou un malus à la fin.

Le texte indicatif du champ donne un exemple : `3d8+2`. Autrement dit, lance trois dés à 8 faces et ajoute 2 au total.

Pour utiliser un jet personnalisé, procède ainsi :

1. Clique sur le bouton dé pour ouvrir le menu.
2. Saisis ta notation dans le champ de texte, par exemple `2d6+1`.
3. Appuie sur Enter, ou clique sur le petit bouton en forme d'avion en papier (envoyer) à côté du champ.
4. Le jet se met en attente sous forme de pastille, prêt à partir.

Voici d'autres exemples que tu peux saisir :

- `d20` lance un dé à 20 faces.
- `4d8-1` lance quatre dés à 8 faces et soustrait 1.
- `2d6+3` lance deux dés à 6 faces et ajoute 3.
- `4d6kh3` lance quatre dés à 6 faces et garde les trois plus hauts. `kl` garde les plus bas, tandis que `dh` et `dl` écartent respectivement les plus hauts ou les plus bas : `2d20kl1` est donc un lancer avec désavantage et `4d6dl1+2` écarte le dé le plus bas et ajoute 2. Chaque dé lancé est enregistré, et seuls les dés gardés sont additionnés.

Deux limites strictes s'appliquent. Tu peux lancer au maximum 100 dés à la fois, et chaque dé peut avoir au plus 1000 faces. Si un lancer simple en demande davantage, l'application le réduit à ces limites au lieu de le refuser. La carte de résultat affiche la notation réduite : saisir `500d6` donne donc une carte `100d6` pour les cent dés réellement lancés. Un lancer qui garde ou écarte des dés et dépasse les limites, comme `101d6kh3`, est en revanche refusé avec une erreur de dépassement des limites, car réduire le nombre de dés changerait ceux qui sont gardés. Si ton texte n'est pas une notation de dés valide – `NdM`, ou un simple `dM` comme `d20`, éventuellement suivi de `kh`, `kl`, `dh` ou `dl` et d'un nombre –, le jet échoue et une erreur indique le format attendu.

<a id="symbol-dice-by-name"></a>

### Dés à symboles par leur nom

Dans une partie dont l'ensemble de règles lance des dés à symboles (un ensemble `symbol-pool`, comme un système de type Genesys), le champ personnalisé accepte aussi ces dés par leur nom. Indique un nombre et le nom du dé pour chaque type, par exemple `2 ability 1 proficiency vs 2 difficulty`. Tu peux utiliser l'identifiant du dé ou son libellé, sans distinction de casse, et les séparer par des espaces, des virgules, `+` ou `vs`.

La carte affiche chaque dé avec les symboles de sa face, puis les symboles qui restent après annulation et indique si le jet est une réussite. Le tag ajouté à ton message reprend ces informations, par exemple `[dice: 2 ability vs 1 difficulty = 1 Success, 1 Advantage; success]`. Un jet peut désigner jusqu'à 40 dés. Quand le Game Master lance les dés avec son outil, il peut aussi utiliser ces noms. La notation simple `NdM` continue de fonctionner comme ci-dessus dans toutes les parties.

<a id="skill-checks"></a>

## Jets de compétence

Un jet de compétence détermine si tu réussis une action risquée : te faufiler sans être vu, repérer un indice, convaincre un PNJ (personnage non-joueur). Tu ne déclenches pas un jet de compétence toi-même. C'est le Game Master qui en demande un dans sa narration. L'application le transforme alors en un jet de d20 animé, accompagné d'un bandeau de résultat.

Un test demandé dans le texte commence par la tentative. Le moteur résout les dés, puis effectue une requête supplémentaire au modèle avec les résultats réels pour que le Game Master puisse terminer le dénouement dans le même tour. Cela corrige aussi un brouillon qui avait deviné le résultat avant le jet. La requête supplémentaire renvoie le prompt et consomme davantage de tokens d'entrée et de sortie. Si elle échoue, le tour conserve les résultats résolus dans son journal, sans enregistrer de dénouement inventé ou partiel. Un avis avec le bouton **Regenerate turn** (régénérer le tour) reste affiché sur le tour, même après avoir rechargé le chat.

Désactive **Narrate dice outcomes immediately** (raconter immédiatement les résultats des dés) dans **Chat Settings → Function Calling** pour conserver les résultats réels pour le tour suivant sans cette requête supplémentaire. Ce réglage est activé par défaut. Les demandes qui ne produisent aucun lancer réel ne déclenchent jamais la requête de narration supplémentaire.

Une troisième option conserve l'issue dans le même tour sans seconde requête. Consulte [Terminer un tour avec des dés en une seule requête](#finishing-a-rolled-turn-in-one-request).

Avec une connexion prenant en charge l'outil de dés, le Game Master peut obtenir un vrai jet pendant la génération. La carte apparaît dès que l'outil répond ; le jet de compétence terminé enregistre ce résultat sans relancer les dés. Chaque jet de compétence résolu reçoit son propre bandeau, après les cartes de dés en attente.

Le bandeau affiche la compétence et le nombre à atteindre, par exemple **Stealth Check** avec **DC 15** juste à côté. DC signifie Difficulty Class, le degré de difficulté : c'est le nombre que ton jet doit atteindre ou dépasser.

### Comment le résultat est calculé

Le jet utilise un dé à 20 faces auquel s'ajoutent deux modificateurs :

- Un modificateur de compétence, issu du niveau de compétence que le jeu suit pour ton personnage. Si le jeu n'a pas encore de niveau pour cette compétence, ce modificateur vaut 0.
- Un modificateur de caractéristique, issu de la caractéristique associée à cette compétence.

Le résultat du dé plus les deux modificateurs donne ton total. Si le total atteint ou dépasse le DC, le jet est réussi. Sinon, il échoue. Chaque compétence est rattachée automatiquement à une caractéristique. Par exemple, Stealth s'appuie sur Dexterity, Perception sur Wisdom et Persuasion sur Charisma. Une compétence que l'application ne reconnaît pas bascule sur Intelligence.

### Réussite critique et échec critique

Deux résultats de dé passent outre le calcul :

- Un 20 naturel (le dé lui-même affiche 20) est une **CRITICAL SUCCESS** (réussite critique). Le jet passe toujours, même face à un DC élevé.
- Un 1 naturel (le dé lui-même affiche 1) est une **CRITICAL FAILURE** (échec critique). Le jet rate toujours, même avec de gros modificateurs.

Le bandeau affiche l'un de ces quatre résultats : **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** ou **CRITICAL FAILURE**.

### Autres systèmes de dés

Le Game Master peut indiquer une autre notation, par exemple `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Ces jets utilisent le modificateur fixe de la notation plutôt que les modificateurs de d20 de la fiche du personnage et réussissent quand le total atteint la DC. Les règles du 1 naturel et du 20 naturel ne concernent que le jet standard de d20 décrit plus haut.

Les réserves de succès doivent préciser le seuil de chaque dé et le nombre de succès nécessaires : `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` lance six d10, compte une fois chaque dé affichant au moins 6 et réussit avec au moins quatre succès. Le moteur ne devine pas un seuil absent et ne gère ni dés explosifs, ni échecs catastrophiques, ni autres règles particulières de réserve. Une réserve sans seuil valide reste non résolue, et les nombres inventés par le modèle sont supprimés.

C'est la réserve d'une partie **sans ensemble de règles**, et elle ne change pas. Une partie utilisant un ensemble de règles à réserves est différente : le moteur détient ses règles. Consulte [Les tests avec un ensemble de règles](rulesets.md#checks-on-a-ruleset).

L'attribut `dice=` d'un test n'accepte que la notation simple `NdM`. Les demandes qui y figurent, comme `4d6kh3`, `3d6!` ou `4dF`, ne sont pas lancées. Le moteur consigne la notation non prise en charge et retire les nombres inventés des enregistrements de tests. Ces résultats restent ouverts ; le moteur ne remplace pas silencieusement le système de dés.

### Avantage et désavantage

Le Game Master peut demander un jet avec avantage ou avec désavantage. Un jet n'est jamais lancé avec les deux à la fois.

- Avec avantage, l'application lance deux dés à 20 faces et garde le plus élevé.
- Avec désavantage, l'application lance deux dés et garde le plus bas.

Si le GM demande les deux à la fois, l'application laisse le test tel quel au lieu de deviner son intention ; aucune bannière ne s'affiche pour lui.

Quand l'un des deux est actif, le bandeau affiche le mode à côté du DC et signale quel dé a été retenu.

### Lancer ton dé à l'avance

Rien ne t'empêche de mettre ton propre `d20` en attente depuis le menu des dés avant que le jet n'arrive. Dans ce cas, le jet de compétence reprend ton résultat au lieu de lancer un nouveau dé. Tes modificateurs de compétence et de caractéristique s'ajoutent par-dessus.

<a id="games-that-use-a-ruleset"></a>

## Parties utilisant un ensemble de règles

Dans une partie utilisant un ensemble de règles, comme 5e (SRD 5.1), les tests sont lancés selon cet ensemble de règles : ses propres dés, son échelle de difficulté et ses modificateurs lus sur la fiche, et, pour certains ensembles de règles, une réserve de dés ou des dés à symboles. Consulte [Les tests avec un ensemble de règles](rulesets.md#checks-on-a-ruleset).

<a id="finishing-a-rolled-turn-in-one-request"></a>

## Terminer un tour avec des dés en une seule requête

Sans cette option, un tour avec des jets coûte deux requêtes au modèle : une pour le brouillon, une pour réécrire l'issue avec les vrais nombres. **Finish rolled turns in one request** (Terminer les tours avec des dés en une requête), dans **Chat Settings → Function Calling**, supprime la seconde. L'option est activée par défaut ; désactive-la dans un chat pour que ce chat réécrive chaque tour avec des jets en utilisant les vrais nombres.

Cela fonctionne parce que le Game Master fixe son texte avant qu'un nombre existe. Il ne voit aucun jet avant de décider ce qui arrive, donc il ne peut pas orienter l'issue vers le dé reçu. Le moteur lance ensuite les dés et c'est son résultat qui est enregistré.

Quand l'option est active, le GM doit écrire le test sous l'une de ces trois formes, selon la nature de l'issue.

**Si l'issue a deux possibilités, il écrit les deux.** Le test est écrit sans nombres, suivi d'un bloc contenant une ligne de réussite et une ligne d'échec. Le moteur lance les dés, garde la moitié choisie par le résultat et retire l'autre avant que tu lises le tour. Tu vois une seule issue, comme si le jet avait eu lieu avant.

**Si le résultat est seulement un nombre, il écrit un marqueur et continue.** Dégâts, soins, or, durée, quantité ou distance : le GM écrit `[[roll: 2d6+3]]` au milieu de la phrase et le moteur le remplace par le nombre. Un marqueur peut nommer un modificateur de fiche plutôt qu'une valeur, comme `[[roll: 1d8+STR]]`, et le moteur l'ajoute ; cette forme n'est proposée que si la partie dispose d'une fiche à lire. Un nom impossible à résoudre est refusé, pas traité comme zéro. Survole un nombre issu d'un marqueur pour voir ses dés ; chacun apparaît aussi dans **Logs** (Journaux) comme une ligne de jet distincte.

**Si le nombre doit choisir entre au moins trois fins différentes, il demande la valeur et s'arrête.** C'est le même test minimal ou la même demande `[dice:]` que le GM écrit aujourd'hui. Le moteur lance les dés et enregistre le résultat ; le tour se termine sans son issue. Le GM raconte ce que signifiait le nombre au début du tour suivant, exactement comme lorsque **Narrate dice outcomes immediately** est désactivé.

Un test qui ne suit aucune de ces formes revient à ce même comportement : rien ne reste non résolu et rien n'est inventé.

Voici quelques détails à connaître avant de l'activer :

- **Narrate dice outcomes immediately n'est pas utilisé tant que cette option est active.** Le réglage reste visible, désactivé et accompagné d'une note. Sa valeur enregistrée ne change pas ; désactiver la requête unique rétablit ton réglage précédent.
- **Tes tours existants ne changent pas.** Seuls les tours générés après l'activation sont concernés ; une transcription déjà enregistrée reste identique à la lecture.
- **Un tour peut encore coûter plusieurs requêtes dans deux cas.** Si **Enable Tool Use** est actif et que l'outil de dés figure dans la liste, le GM peut toujours l'appeler, ce qui coûte un aller-retour complet supplémentaire. Une **Game tool connection** autre que **Same as narrator** fait aussi toujours sa propre requête de planification. Aucune de ces requêtes n'est la réécriture de l'issue que supprime cette option.
- **Tu es averti si quelque chose ne peut pas être lancé.** Un nombre illisible pour le moteur est remplacé par un court avis plutôt qu'une valeur inventée. Une branche illisible conserve le jet enregistré et perd ses deux moitiés. Dans les deux cas, une ligne dans **Logs** indique ce qui a été omis.
- **Pendant l'écriture du tour**, les marqueurs et blocs de branches sont retenus du texte diffusé pour éviter qu'un nombre apparaisse puis change. La phrase terminée arrive quand le tour est fini.

### Laisser le Game Master voir un dé de chaque taille

Un second réglage se trouve dessous : **Let the Game Master see one die of each size** (Laisser le Game Master voir un dé de chaque taille), désactivé par défaut. Il sert au cas que les deux formes à l'aveugle ne peuvent pas traiter : un nombre qui choisit entre au moins trois fins différentes, comme une marge de réussite, une table de localisation des coups ou un jet de réaction. Sans lui, ce test doit terminer le tour et être raconté au début du suivant.

Quand il est actif, le moteur lance un dé de chaque taille standard avant le tour et montre au GM la prochaine valeur de chacun, pour qu'il puisse en dépenser une et raconter sa signification dans la même passe.

**C'est le compromis à comprendre, et il mérite une lecture attentive.** Le GM voit le nombre avant de décider quoi tester et à quelle difficulté. Il peut donc orienter les issues d'une manière impossible avec les formes à l'aveugle : choisir une difficulté que le dé reçu dépassera, ou éviter de demander un test tant qu'il détient un mauvais nombre. Le moteur ne peut pas savoir si une difficulté convient à la fiction ; il ne peut donc pas détecter cela. Un joueur qui ignore que le GM a vu les dés prendra une séance étrangement héroïque pour de la chance.

Le moteur impose bien les règles suivantes, sans demander au GM de coopérer :

- **Les valeurs sortent dans l'ordre et aucune ne sort deux fois.** Le moteur tient la file et donne la suivante, quoi que prétende le tour.
- **Tous les nombres du registre viennent du moteur.** Le jet, le modificateur, le total et l'issue sont recalculés à partir de la file et de ta fiche. Un nombre du GM qui ne correspond pas est remplacé et une ligne dans **Logs** le signale.
- **La difficulté est bornée.** Elle reste entre 1 et 40, ce qui n'était pas imposé auparavant à un test écrit. Une partie avec un ensemble de règles peut aller jusqu'au bout de son échelle de difficulté.
- **Redemander n'améliore pas la chance.** Un swipe, une régénération ou une continuation du même tour reçoit les mêmes valeurs : impossible de relancer jusqu'à obtenir un bon résultat.
- **Seule la prochaine valeur de chaque taille est montrée.** C'est le réglage **Values shown per size** (Valeurs montrées par taille), à 1 par défaut. Les jets suivants de la même taille dans un tour ne sont pas vus et sont racontés au tour suivant.
- **Un dé non dépensé est relancé après un certain temps.** C'est **Rethrow after idle turns** (Relancer après des tours sans utilisation), à 3 par défaut. Sans cela, une valeur basse peut rester en tête de file pendant tout le chat tandis que le GM évite cette taille. Le mettre à 0 désactive la relance et permet de nouveau ce comportement.
- **Demander plus de jets que la file n'en contient n'en produit pas un autre.** Le test garde sa question, perd tous ses nombres et sera raconté au tour suivant. **Logs** indique le tour concerné.

## Guides associés

- [Game Mode : jouer avec un ensemble de règles](rulesets.md)
- [Game Mode : le combat](combat.md)
- [Game Mode : premiers pas](getting-started.md)
- [Game Mode : équipe et PNJ](party-and-npcs.md)
