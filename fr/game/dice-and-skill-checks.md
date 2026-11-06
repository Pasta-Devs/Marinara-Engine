# Game Mode : jets de dés et jets de compétence

En Game Mode, utilise le bouton de dés pour lancer des dés à l'intention du Game Master (GM, le maître du jeu). Ce guide montre aussi comment le GM mène un jet de compétence face à un degré de difficulté (DC, pour Difficulty Class), le nombre qu'un jet doit atteindre ou dépasser.

## Lancer les dés

La barre de saisie du message comporte un bouton de dés. Son infobulle indique **Roll dice** (lancer les dés).

1. Clique sur le bouton de dés pour ouvrir le menu de dés rapides.
2. Clique sur un preset : d20, d6, 2d6, d10, d100, d4, d8 ou d12.
3. Une pastille apparaît dans la barre de saisie, du type `🎲 d20`. Le jet est mis en file d'attente, il n'est pas encore envoyé.
4. Envoie ton message. Marinara lance les dés et ajoute le résultat à la fin de ton message sous forme de balise, que le GM lit et autour de laquelle il construit sa narration.

Pour retirer un jet en attente avant l'envoi, clique sur **Clear queued roll** (supprimer le jet en attente) sur la pastille.

Un dé unique, sans bonus, donne ceci :

```text
[dice: d20 = 14]
```

Avec plusieurs dés, ou un bonus, le détail s'affiche aussi :

```text
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

Le GM peut aussi demander un jet dans sa narration avec `[dice: 3d8+2]`. Marinara fournit les vrais nombres et affiche la même carte animée. Cela fonctionne avec les connexions limitées au texte, y compris les abonnements Claude et Grok. Quand le GM lance les dés plusieurs fois dans un tour, chaque carte de dés attend son tour : ferme-en une pour voir la suivante. Tous les jets sont enregistrés dans le swipe actif (la réponse alternative) de ce tour et restent dans **Logs** (journaux) après un rechargement. Continuer un tour conserve ses jets précédents. Régénérer crée un nouvel ensemble de jets pour le nouveau swipe.

## Lancer des dés personnalisés

Le menu de dés comporte un champ de texte pour un jet personnalisé en notation `NdM` : `N` dés de `M` faces chacun, avec un bonus ou un malus facultatif à la fin. Le champ affiche l'exemple `3d8+2` (trois dés à 8 faces, ajouter 2).

1. Ouvre le menu de dés.
2. Saisis ta notation, par exemple `2d6+1`.
3. Appuie sur <kbd>Enter</kbd> ou clique sur le bouton en forme d'avion en papier. Le jet est mis en attente sous forme de pastille.

| Notation | Signification |
| --- | --- |
| `d20` | Un dé à 20 faces |
| `4d8-1` | Quatre dés à 8 faces, soustraire 1 |
| `4d6kh3` | Lancer quatre dés à 6 faces, garder les trois plus hauts |
| `2d20kl1` | Garder le plus bas : un jet avec désavantage |
| `4d6dl1+2` | Écarter le dé le plus bas, ajouter 2 |

`kh` et `kl` gardent les dés les plus hauts ou les plus bas. `dh` et `dl` les écartent. Chaque dé lancé est enregistré, et seuls les dés gardés sont additionnés.

Si ça n'a pas marché : un texte qui n'est ni `NdM` ni un simple `dM`, éventuellement suivi de `kh`, `kl`, `dh` ou `dl` et d'un nombre, échoue avec une erreur qui indique le format attendu.

Tu peux lancer au maximum 100 dés à la fois, et chaque dé peut avoir au plus 1000 faces. Un jet simple qui dépasse ces limites y est ramené, et la carte affiche la notation réduite : `500d6` donne donc une carte `100d6`. Un jet qui garde ou écarte des dés et dépasse les limites, comme `101d6kh3`, est refusé avec une erreur de dépassement des limites, car réduire le nombre de dés changerait ceux qui sont gardés.

<a id="skill-checks"></a>

## Jets de compétence

Un jet de compétence met à l'épreuve une action risquée, comme te faufiler sans être vu, repérer un indice ou convaincre un PNJ (personnage non-joueur). Tu ne le déclenches pas toi-même. Le GM le demande dans sa narration, et Marinara le transforme en un jet de d20 animé accompagné d'un bandeau de résultat. Le bandeau affiche la compétence et la cible, par exemple **Stealth Check** avec **DC 15**. Chaque jet résolu reçoit son propre bandeau, après les éventuelles cartes de dés en attente.

<a id="how-the-result-is-decided"></a>

### Comment le résultat est calculé

Le jet lance un d20 et ajoute deux modificateurs :

- Un modificateur de compétence, issu du niveau de compétence que le jeu suit pour ton personnage. Il vaut 0 si le jeu n'a pas encore de niveau pour cette compétence.
- Un modificateur de caractéristique, issu de la caractéristique dont dépend la compétence. Chaque compétence est rattachée automatiquement à une caractéristique : Stealth utilise Dexterity, Perception utilise Wisdom, Persuasion utilise Charisma. Une compétence que Marinara ne reconnaît pas utilise Intelligence.

Dans une partie utilisant les classes **MRPG**, le modificateur de caractéristique vient plutôt des caractéristiques MRPG du personnage, celles que lui donne sa classe active (voir [Classes MRPG](mrpg-classes.md)). Les éventuelles caractéristiques Legacy qui restent sur une fiche mise à niveau ne sont pas utilisées. Chaque compétence s'appuie sur une caractéristique :

| Caractéristique | Compétences |
| --- | --- |
| Force | Athletics, Intimidation |
| Vitesse | Acrobatics, Stealth |
| Compétence | Sleight of Hand, Investigation, Perception, Medicine, Survival, Animal Handling, et toute compétence qui ne figure pas ici |
| Défense | Endurance, Constitution |
| Magie | Arcana, History, Nature, Intelligence |
| Résistance | Insight, Religion, Wisdom |
| Chance | Persuasion, Deception, Performance, Charisma |

Le jet ajoute un cinquième de cette caractéristique, arrondi à l'inférieur, jusqu'à +5. Cela représente environ +1 pour la meilleure caractéristique d'un nouveau personnage, +2 ou +3 au niveau 10 et +5 au maximum. Une caractéristique faible n'ajoute rien.

Si le total atteint ou dépasse le DC, le jet réussit. Deux résultats passent outre le calcul :

- Un 20 naturel est une réussite critique, **CRITICAL SUCCESS**, et réussit toujours.
- Un 1 naturel est un échec critique, **CRITICAL FAILURE**, et échoue toujours.

Le bandeau affiche **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** ou **CRITICAL FAILURE**.

### Avantage et désavantage

Le GM peut demander un jet avec avantage (lancer deux d20 et garder le plus haut) ou avec désavantage (garder le plus bas). Le bandeau affiche le mode à côté du DC et signale le dé retenu. Si le GM demande les deux à la fois, Marinara laisse ce jet de côté au lieu de deviner : tu n'obtiens alors aucun bandeau pour lui.

### Lancer ton propre d20 à l'avance

Mets un `d20` en attente depuis le menu de dés avant que le jet n'ait lieu. Le jet utilise alors ton nombre au lieu de lancer un nouveau dé. Tes modificateurs de compétence et de caractéristique s'appliquent toujours.

Pour savoir comment le GM termine un tour après un jet, et ce que cela coûte, consulte [Comment un tour avec des dés est raconté](#how-a-rolled-turn-is-narrated).

<a id="games-that-use-a-ruleset"></a>

### Parties utilisant un ensemble de règles

Dans une partie utilisant un ensemble de règles, comme 5e (SRD 5.1), les tests utilisent les dés propres à l'ensemble de règles, son échelle de difficulté et ses modificateurs de fiche, et, dans certains ensembles de règles, une réserve de dés ou des dés à symboles. Consulte [Tests avec un ensemble de règles](rulesets.md#checks-on-a-ruleset).

## Référence

<a id="how-a-rolled-turn-is-narrated"></a>

### Comment un tour avec des dés est raconté

Quand le GM demande un test dans le texte, Marinara résout les dés et dispose de trois façons de terminer l'issue. Les trois se trouvent dans **Chat Settings → Function Calling** (réglages du chat → appels de fonctions).

| Réglage | Par défaut | Ce qui se passe |
| --- | --- | --- |
| **Finish rolled turns in one request** (terminer les tours avec des dés en une seule requête) | Activé | Une seule requête. Le GM écrit l'issue sans nombres et Marinara les complète. Voir plus bas. |
| **Narrate dice outcomes immediately** (raconter immédiatement les résultats des dés) | Activé | Deux requêtes. Le GM rédige un brouillon, Marinara lance les dés, puis une requête supplémentaire renvoie le prompt avec les vrais résultats pour que le GM termine l'issue dans le même tour. Cela coûte davantage de tokens d'entrée et de sortie. |
| Les deux désactivés | | Les vrais résultats sont conservés pour le tour suivant, sans requête supplémentaire. |

Avec **Narrate dice outcomes immediately**, si la requête supplémentaire échoue, le tour conserve les résultats résolus dans son journal sans enregistrer d'issue devinée ou partielle. Un avis avec un bouton **Regenerate turn** (régénérer le tour) reste affiché sur le tour, même après un rechargement. Une demande sans jet réel ne déclenche jamais la requête supplémentaire.

Avec une connexion qui prend en charge l'outil de dés, le GM peut plutôt obtenir un vrai jet pendant la génération. La carte de dés apparaît dès que l'outil répond, et le test terminé enregistre ce résultat sans relancer les dés.

<a id="finishing-a-rolled-turn-in-one-request"></a>

#### Terminer un tour avec des dés en une seule requête

Sans cette option, un tour qui lance des dés coûte deux requêtes. **Finish rolled turns in one request** supprime la seconde. L'option est activée par défaut. Désactive-la dans un chat pour que ce chat réécrive plutôt chaque tour avec des dés en utilisant les vrais nombres.

Cela fonctionne parce que le GM fixe son texte avant qu'un nombre existe. Il ne voit jamais un jet avant de décider ce qui arrive : il ne peut donc pas orienter l'issue. Marinara lance les dés ensuite et enregistre son propre résultat. Tant que l'interrupteur est activé, le GM écrit un test de l'une de ces trois façons :

- **Deux issues.** Le GM écrit le test sans nombres, puis une ligne de réussite et une ligne d'échec. Marinara lance les dés, garde la moitié choisie par le jet et supprime l'autre avant que tu lises le tour.
- **Seulement un nombre.** Pour des dégâts, des soins, de l'or, une durée, une quantité ou une distance, le GM écrit un espace réservé comme `[[roll: 2d6+3]]` au milieu de la phrase, et Marinara met le nombre à sa place. Un espace réservé peut nommer un modificateur de fiche, comme dans `[[roll: 1d8+STR]]`. Cette forme n'est proposée que si ta partie a une fiche à lire, et un nom que Marinara ne peut pas résoudre est refusé plutôt que traité comme zéro. Passe le pointeur sur un nombre issu d'un espace réservé pour voir ses dés. Chacun apparaît aussi dans **Logs** comme sa propre ligne de jet.
- **Trois fins ou plus.** Le GM demande la valeur et s'arrête. Marinara lance les dés et l'enregistre, le tour se termine sans l'issue, et le GM raconte ce que signifiait le nombre au début du tour suivant.

Un test écrit sous aucune de ces formes revient au dernier comportement : rien ne reste non résolu et rien n'est inventé.

- **Narrate dice outcomes immediately** n'est pas utilisé tant que cette option est activée. Il reste visible mais désactivé, et sa valeur enregistrée est conservée pour le moment où tu désactiveras cette option.
- Les tours existants ne changent pas. L'interrupteur ne concerne que les tours générés après son activation.
- Un tour peut encore coûter plus d'une requête dans deux cas : **Enable Tool Use** (autoriser l'usage des outils) est activé et l'outil de dés figure dans ta liste d'outils (un appel d'outil coûte un aller-retour complet supplémentaire), ou un **Game tool provider** (fournisseur des outils du jeu) autre que **Same as narrator** (comme le narrateur) est défini (il fait toujours une requête de planification).
- Quand quelque chose ne peut pas être lancé, un court avis remplace le nombre, jamais une valeur inventée. **Logs** indique ce qui a été omis.
- Pendant l'écriture du tour, les espaces réservés et les blocs de branches sont retenus hors du texte en streaming (l'affichage au fil de l'écriture) : tu ne vois donc jamais un nombre changer.

<a id="symbol-dice-by-name"></a>

### Dés à symboles par leur nom

Dans une partie dont l'ensemble de règles lance des dés à symboles (un ensemble de règles `symbol-pool`, comme un système de type Genesys), le champ personnalisé accepte aussi ces dés par leur nom. Indique un nombre et un nom de dé pour chaque type, par exemple `2 ability 1 proficiency vs 2 difficulty`. Les noms peuvent être l'identifiant ou le libellé d'un dé, sans distinction de casse, séparés par des espaces, des virgules, `+` ou `vs`. Un jet peut désigner jusqu'à 40 dés.

La carte affiche chaque dé avec les symboles de sa face, puis les symboles qui restent après annulation et indique s'il s'agit d'une réussite. La balise du message reprend ces informations, par exemple `[dice: 2 ability vs 1 difficulty = 1 Success, 1 Advantage; success]`. L'outil de dés du GM accepte aussi ces noms. La notation simple `NdM` fonctionne toujours dans toutes les parties.

### Autres dés dans un jet de compétence

Le GM peut indiquer une autre notation, comme `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Ces tests utilisent le modificateur fixe de la notation au lieu des modificateurs de fiche du d20, et réussissent quand le total atteint le DC. Les règles du 1 naturel et du 20 naturel ne s'appliquent qu'au test standard au d20.

Une réserve de succès doit indiquer à la fois un seuil par dé et le nombre de succès nécessaires : `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` lance six d10, compte chaque dé qui affiche au moins 6, et réussit avec au moins quatre succès. Marinara ne devine pas un seuil manquant et ne gère ni les dés explosifs, ni les échecs catastrophiques, ni d'autres règles particulières de réserve. Une réserve sans seuil valide reste non résolue, et les nombres inventés sont retirés.

C'est la réserve dont dispose une partie sans ensemble de règles. Une partie dont l'ensemble de règles repose sur des réserves de dés est différente : consulte [Tests avec un ensemble de règles](rulesets.md#checks-on-a-ruleset).

L'attribut `dice=` d'un test n'accepte que la notation simple `NdM`. Les demandes comme `4d6kh3`, `3d6!` ou `4dF` ne sont pas lancées : Marinara consigne la notation non prise en charge et retire les nombres inventés, et l'issue reste ouverte.

### Laisser le Game Master voir un dé de chaque taille

**Let the Game Master see one die of each size** (laisser le Game Master voir un dé de chaque taille) se trouve sous **Finish rolled turns in one request**. Il est désactivé par défaut. Il sert un cas que les formes à l'aveugle ne peuvent pas traiter : un nombre qui doit choisir entre trois fins ou plus, comme une marge de réussite ou une table de localisation des coups. Sans lui, ce test termine le tour et il est raconté au tour suivant.

Quand il est activé, Marinara lance un dé de chaque taille standard avant le tour et montre au GM la prochaine valeur de chacun, pour qu'il puisse écrire ce qu'elle signifie dans la même passe.

> **Avertissement :** le GM voit alors le nombre avant de décider quoi tester et à quelle difficulté. Il peut choisir une difficulté que le dé qu'il détient dépassera, ou éviter de demander un test tant qu'il détient un mauvais nombre. Marinara ne peut pas savoir si une difficulté convient à la fiction : il ne peut donc pas détecter cela. Une séance étrangement héroïque peut cacher une chance arrangée.

Ce que Marinara impose sans la coopération du GM :

- Les valeurs sortent dans l'ordre et aucune ne sort deux fois.
- Tous les nombres du registre viennent de Marinara. Le jet, le modificateur, le total et l'issue sont recalculés à partir de la file et de ta fiche. Un nombre qui ne correspond pas est remplacé, et **Logs** le signale.
- La difficulté est maintenue entre 1 et 40. Une partie avec un ensemble de règles peut aller jusqu'au bout de l'échelle de difficulté de son ensemble de règles.
- Un swipe, une régénération ou une continuation du même tour reçoit les mêmes valeurs : impossible donc de relancer pour tenter sa chance.
- **Values shown per size** (valeurs montrées par taille) fixe combien de valeurs le GM voit par taille. La valeur par défaut est 1. Les jets suivants de cette taille dans un tour ne sont pas vus et sont racontés au tour suivant.
- **Rethrow after idle turns** (relancer après des tours sans utilisation, 3 par défaut) relance un dé non dépensé après ce nombre de tours. Sans cela, une valeur basse pourrait rester en tête de file pendant tout le reste du chat. Mets 0 pour désactiver la relance.
- Si le GM demande plus de jets que la file n'en contient, le test garde sa question, perd tous ses nombres et est raconté au tour suivant. **Logs** indique quel tour.

## Guides associés

- [Game Mode : jouer avec un ensemble de règles](rulesets.md)
- [Game Mode : le combat](combat.md)
- [Game Mode : premiers pas](getting-started.md)
- [Game Mode : l'équipe et les PNJ](party-and-npcs.md)
