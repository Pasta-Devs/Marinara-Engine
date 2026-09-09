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
- `4d8-1` lance quatre dés à 8 faces et retire 1.
- `2d6+3` lance deux dés à 6 faces et ajoute 3.

Deux limites strictes s'appliquent : 100 dés au maximum en un seul jet, et 1000 faces au maximum par dé. Si tu demandes plus, l'application ne refuse pas le jet, elle ramène ta demande à ces limites. Et si ton texte ne respecte pas la notation `NdM`, le jet échoue et un message d'erreur te rappelle le format attendu.

## Jets de compétence

Un jet de compétence détermine si tu réussis une action risquée : te faufiler sans être vu, repérer un indice, convaincre un PNJ (personnage non-joueur). Tu ne déclenches pas un jet de compétence toi-même. C'est le Game Master qui en demande un dans sa narration. L'application le transforme alors en un jet de d20 animé, accompagné d'un bandeau de résultat.

Un jet demandé par texte commence par la tentative. Le moteur résout les dés, puis envoie une requête supplémentaire au modèle avec les résultats réels pour que le Game Master termine le dénouement dans le même tour. Cela corrige aussi un brouillon qui aurait deviné le dénouement avant le jet. Cette requête renvoie le prompt et consomme davantage de tokens d'entrée et de sortie. Si elle échoue, le tour conserve les résultats résolus sans enregistrer de dénouement inventé ou partiel.

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

### Avantage et désavantage

Le Game Master peut demander un jet avec avantage ou avec désavantage. Un jet n'est jamais lancé avec les deux à la fois.

- Avec avantage, l'application lance deux dés à 20 faces et garde le plus élevé.
- Avec désavantage, l'application lance deux dés et garde le plus bas.

Quand l'un des deux est actif, le bandeau affiche le mode à côté du DC et signale quel dé a été retenu.

### Lancer ton dé à l'avance

Rien ne t'empêche de mettre ton propre `d20` en attente depuis le menu des dés avant que le jet n'arrive. Dans ce cas, le jet de compétence reprend ton résultat au lieu de lancer un nouveau dé. Tes modificateurs de compétence et de caractéristique s'ajoutent par-dessus.

## Guides associés

- [Game Mode : le combat](combat.md)
- [Game Mode : premiers pas](getting-started.md)
- [Game Mode : équipe et PNJ](party-and-npcs.md)
