# Roleplay : jouer avec un ensemble de règles

Un chat Roleplay peut se jouer avec un ensemble de règles sur table, du même genre que ceux qu'utilise Game Mode. Le narrateur demande un test quand quelque chose d'incertain arrive, Marinara lance les dés à partir de la fiche du personnage, et la réponse raconte ce que le jet a décidé. Utilise-le quand tu veux de vrais dés et une fiche de personnage dans un roleplay sans lancer une partie de Game Mode.

Tout ensemble de règles que tu as installé pour Game Mode fonctionne, comme 5e (SRD 5.1), ainsi que les fiches que tu as déjà remplies pour lui dans l'éditeur de personnages et de personas.

## Activer un ensemble de règles pour un chat

Avant de commencer : installe un ensemble de règles. Voir [Obtenir un ensemble de règles](../game/rulesets.md#get-a-ruleset).

1. Ouvre le chat Roleplay.
2. Ouvre **Chat Settings** (Réglages du chat) et cherche la section **Ruleset** (ensemble de règles).
3. Choisis un ensemble de règles dans la liste. Elle affiche les ensembles que tu as installés.
4. Marinara donne une fiche à chaque membre du chat et indique combien elle en a ajouté. Chaque membre est listé sous l'ensemble de règles.

Chaque membre reçoit une copie de sa propre fiche pour cet ensemble de règles depuis l'éditeur de personnages ou de personas (voir [Fiches d'ensembles de règles](../characters/colors-and-stats.md#ruleset-sheets)). Un membre sans fiche en reçoit une vierge, marquée **blank sheet** (fiche vierge) dans la liste, à remplir dans le chat. Ton persona passe en premier. Les changements faits dans le chat restent dans le chat et ne reviennent jamais au personnage ni au persona.

Si ça n'a pas marché : un ensemble de règles importé a besoin de **Allow custom Agent imports** (autoriser l'import d'agents personnalisés) activé. Voir [Obtenir un ensemble de règles](../game/rulesets.md#get-a-ruleset).

### Remplir une fiche vierge

1. Dans la section **Ruleset**, clique sur **Build sheet** (créer la fiche) à côté du membre.
2. La fiche de personnage s'ouvre dans l'éditeur de fiche. Quand l'ensemble de règles propose un assistant pas à pas, il s'ouvre d'abord dessus, comme dans Game Mode et dans l'éditeur de personnages.
3. Fais tes choix et clique sur **Save sheet** (enregistrer la fiche).

### Ajouter une fiche pour un nouveau membre

Quand un personnage rejoint le chat plus tard, clique sur **Add missing sheets** (ajouter les fiches manquantes). Les membres qui ont déjà une fiche la gardent.

### Retirer une fiche

Un membre qui ne devrait pas avoir de fiche, comme une carte de narrateur, peut la perdre.

1. Dans la section **Ruleset**, clique sur l'icône de corbeille à côté du membre.
2. Clique sur **Remove sheet** (retirer la fiche).

Le chat s'en souvient : **Add missing sheets** et une version plus récente de l'ensemble de règles laissent ce membre de côté. Pour lui redonner une fiche, clique sur son bouton après **No sheet:** (aucune fiche), par exemple **Give Mira a sheet** (donner une fiche à Mira).

### Changer d'ensemble de règles ou le désactiver

- Choisis **None** (aucun) pour arrêter de jouer avec l'ensemble de règles. Les fiches sont conservées : choisir à nouveau le même ensemble reprend donc là où tu t'étais arrêté.
- Un autre ensemble de règles repart de zéro sur chaque fiche, car une fiche faite pour un ensemble ne veut rien dire pour un autre.

## Les tests en jeu

Tu écris ton tour comme d'habitude. Quand ton personnage tente quelque chose d'incertain dont l'issue compte, le narrateur demande un test au lieu de décider du résultat. Marinara le lance depuis la fiche, puis le narrateur écrit ce que le jet a décidé.

Le message terminé affiche une carte de dés là où le test a eu lieu, avec la compétence, la difficulté, les dés et **Success** (réussite) ou **Failure** (échec). Les actions ordinaires qui ne peuvent pas vraiment échouer ne reçoivent pas de test.

> **Astuce :** Certains modèles ignorent la consigne de demander des tests et décident eux-mêmes du résultat. Si aucun test n'apparaît, essaie un modèle plus fort pour la **Connection** (connexion) du chat.

Les tests ne sont pas lancés pour les tours d'**Impersonate** (incarner). Un salon multijoueur ne peut pas se jouer avec un ensemble de règles.

## Utiliser les fiches de personnage

Clique sur **Open sheet** (ouvrir la fiche) à côté d'un membre dans la section **Ruleset**. La fiche est la même que celle qu'affiche Game Mode. Le bouton en forme de parchemin en haut du Tracker Panel ouvre la fiche de ton persona.

- Clique sur **−** et **+** à côté d'une réserve ou d'une piste, comme les points de vie ou le stress, pour la changer. Le changement est enregistré avec le message courant : il suit donc les swipes (réponses alternatives) et les branches.
- Clique sur **Edit ruleset sheet** (modifier la fiche de l'ensemble de règles) pour changer les scores, les rangs de compétence, les champs et les listes, puis sur **Save sheet** (enregistrer la fiche).

Le narrateur lit les fiches à chaque tour et les modifie avec des commandes de fiche dans sa réponse, que Marinara applique et masque dans le message. Pour te reposer, dis-le dans ton tour, par exemple "on prend un repos long". Le narrateur note le repos, et les fiches récupèrent ce que le repos de l'ensemble de règles restaure. Tu peux aussi cliquer sur **Rest** (repos) sur une fiche.

## Créer ton propre ensemble de règles

Le constructeur d'ensembles de règles crée un petit ensemble de règles à partir d'un formulaire : la façon dont les tests se lancent, ce qui figure sur la fiche et ce qui est dit au narrateur. Utilise-le pour un système que Marinara n'a pas. Un ensemble de règles que tu crées fonctionne comme un ensemble installé, en Roleplay et en Game Mode.

Avant de commencer : active **Allow custom Agent imports**, car le constructeur enregistre l'ensemble de règles comme le fait un import. Voir [Obtenir un ensemble de règles](../game/rulesets.md#get-a-ruleset).

1. Dans **Chat Settings → Ruleset**, clique sur **New ruleset…** (nouvel ensemble de règles).
2. Saisis un nom dans **Name** (nom).
3. Sous **Dice** (dés), choisis comment les tests se lancent (voir le tableau ci-dessous). Ce choix remplit des caractéristiques, des réserves et des pistes de départ, que tu peux modifier.
4. Modifie **Difficulties** (difficultés), **Stats** (caractéristiques), **Skills** (compétences) et le reste du formulaire. La plupart des sections s'expliquent d'elles-mêmes en une ligne sous leur titre.
5. Clique sur **Create ruleset** (créer l'ensemble de règles).

Marinara enregistre l'ensemble de règles. Dans un chat sans ensemble de règles, elle active aussi le nouveau. Un chat qui a déjà un ensemble de règles le garde, avec ses fiches ; pour changer, choisis le nouvel ensemble de règles dans la liste.

Si un ensemble de règles installé lance déjà les dés de la façon que tu as choisie, la section **Dice** le nomme. Chaque ensemble de règles est une fiche distincte sur chaque personnage : pour garder une seule fiche par personnage, joue avec cet ensemble de règles ou modifie-le au lieu d'en créer un autre.

| Dés | Comment un test se lance |
| --- | --- |
| **d20 + modifier** (d20 + modificateur) | Un d20 plus la caractéristique et la compétence, contre un nombre de difficulté. |
| **2d6 bands** (2d6 par paliers) | 2d6 plus la caractéristique : 10 ou plus est une réussite forte, 7 à 9 une réussite faible, 6 ou moins un échec. |
| **Dice pool** (réserve de dés) | Un dé par point de caractéristique et de compétence. Chaque dé qui atteint le nombre cible compte. Tu choisis d6 ou d10, et la cible. |
| **Highest d6** (d6 le plus haut) | Un d6 par point, en gardant le plus haut : 6 est une réussite totale, 4 ou 5 une réussite partielle, deux 6 une réussite critique. |
| **Percentile** (pourcentage) | Un d100. Le test réussit à un résultat égal ou inférieur au nombre de la compétence. |
| **Hope and Fear** (espoir et peur) | Deux d12 plus la caractéristique. Le dé le plus haut indique si le résultat s'accompagne d'Espoir ou de Peur. |
| **No dice** (sans dés) | Aucun dé n'est lancé. La caractéristique et la compétence sont additionnées et comparées à la difficulté. |

### Modifier un ensemble de règles que tu as créé

1. Active l'ensemble de règles pour un chat.
2. Dans **Chat Settings → Ruleset**, clique sur **Edit ruleset** (modifier l'ensemble de règles).
3. Fais tes modifications et clique sur **Save new version** (enregistrer une nouvelle version).

Le chat passe à la nouvelle version et garde chaque fiche. Renommer une caractéristique, une compétence, une réserve ou une colonne de liste conserve ce que chaque personnage y a inscrit. Un autre chat sur le même ensemble de règles passe à la nouvelle version quand tu cliques sur **Add missing sheets** dans ce chat.

Le bouton **Edit ruleset** apparaît pour un ensemble de règles que tu as créé ou importé depuis un fichier, quand le formulaire peut le contenir en entier : un ensemble créé par le constructeur, ou un fichier écrit à la main qui n'utilise que ce que montre le formulaire. Le bouton n'apparaît pas pour un ensemble de règles issu d'un package ou d'un dépôt. Le constructeur n'ouvre jamais un ensemble de règles qui contient davantage, comme des règles de combat ou des commentaires : il ne peut donc pas perdre ce qu'il ne montre pas. Le bouton n'apparaît par ailleurs que dans un chat qui joue la version la plus récente ; dans un chat sur une version plus ancienne, clique d'abord sur **Add missing sheets**.

### Organiser la fiche

| Dans le formulaire | Sur la fiche |
| --- | --- |
| L'ordre des lignes | Les caractéristiques, compétences, réserves, pistes, champs et onglets de listes s'affichent dans l'ordre du formulaire. Fais glisser une ligne par sa poignée pour la déplacer, ou mets le focus sur la poignée et appuie sur les touches fléchées haut et bas. |
| Le **Group** (groupe) d'une caractéristique ou d'une compétence | Les caractéristiques ou compétences du même groupe s'affichent sous un même titre. |
| **Skill ranks** (rangs de compétence) | Les rangs que tu choisis pour chaque compétence sur la fiche, chacun avec ce qu'il ajoute : au total d'un jet de d20 ou de 2d6, des dés pour une réserve, des points pour un pourcentage. |
| **Show ranks on the sheet as** (afficher les rangs sur la fiche sous forme de) | Ce que la fiche affiche à côté de chaque compétence et de chaque sauvegarde entraînées : **Check value (+2)** (valeur de test), le **Rank name** (nom du rang), **Dots (●●○)** (points), **Roman numerals (II)** (chiffres romains) ou le **Rank number (2)** (numéro du rang). Les tests et la copie de la fiche que reçoit le narrateur ne changent pas. |
| **Practice meter** (jauge de pratique) | Chaque compétence entraînée montre où elle en est vers son prochain rang, de 0 à 99 %. La pratique dans l'histoire fait monter la jauge, et une montée de rang la fait repartir de zéro. Tu peux la corriger sur la fiche. Sous **No meter for:** (pas de jauge pour), coche un groupe pour en exclure les compétences. |
| **Number** (nombre), **Bar** (barre) ou **Dots** (points) sur une réserve ou une piste | Le nombre seul, une barre de remplissage à côté, ou une rangée de points remplis jusqu'à ce nombre, un point par unité. Plus de 20 points s'affichent sous forme de barre. |
| **Lists** (listes) | Chaque liste a son propre onglet, qui porte le nom de la liste sauf si tu saisis un autre nom d'onglet. Les listes qui ont le même nom d'onglet partagent un onglet. |
| Les colonnes d'une liste | Chaque ligne a un nom, plus tes colonnes : **Text** (texte), **Number** ou **Checkbox** (case à cocher). La première colonne de cases à cocher s'affiche sous forme de coche à côté de chaque nom. |

### Expliquer tes règles au narrateur

La section **Prompts** contient ce qui est dit au narrateur sur ton ensemble de règles. **Checks** (tests) et **Keeping the sheets** (tenue des fiches) affichent un texte par défaut ; laisse l'un ou l'autre vide pour utiliser ce texte. Les retours à la ligne deviennent des espaces. Les noms et les prompts ne peuvent contenir ni crochets ni doubles accolades, car les balises et les macros du narrateur les utilisent.

| Zone | À quoi elle sert |
| --- | --- |
| **Checks** | Quand demander un test, et comment choisir la compétence et la difficulté. |
| **Keeping the sheets** | Comment les fiches changent en cours de jeu. |
| **Rules reference** (référence des règles) | Les règles maison et tout ce que le narrateur doit toujours avoir sous les yeux. |
| **World (Game Mode)** | Lue une fois, quand une partie de Game Mode est créée avec l'ensemble de règles, pour que son monde convienne aux règles. |

## Dépannage

| Symptôme | Solution |
| --- | --- |
| **This chat's ruleset is not installed here, so its checks and sheets are paused.** | Installe à nouveau l'ensemble de règles, ou choisis-en un autre. |
| Le narrateur ne demande jamais de test. | Utilise un modèle plus fort pour le chat. Certains modèles sautent la consigne des tests. |
| Un nouveau personnage n'a pas de fiche. | Clique sur **Add missing sheets**. |

## Guides associés

- [Game Mode : jouer avec un ensemble de règles](../game/rulesets.md)
- [Game Mode : dés et tests de compétence](../game/dice-and-skill-checks.md)
- [Mode Roleplay : premiers pas](getting-started.md)
