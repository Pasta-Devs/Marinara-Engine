# Game Mode : les widgets HUD

Les widgets HUD sont de petits panneaux posés le long des bords gauche et droit de l'écran de jeu. Ils suivent des choses comme une barre de vie, un compteur d'or ou le niveau de confiance d'un allié. HUD signifie "heads-up display". Chaque partie a ses propres widgets, indépendants des trackers du HUD de Roleplay (voir [Le HUD et les trackers en Roleplay](../roleplay/hud-and-trackers.md)).

Une partie peut avoir jusqu'à 4 widgets au total, répartis entre le côté gauche et le côté droit comme tu veux. Les widgets ne servent que si l'option **Custom HUD Widgets** (widgets HUD personnalisés) est activée pour la partie. Elle l'est par défaut dans l'assistant de configuration. Le Game Master (GM, le maître du jeu) conçoit alors un ensemble de widgets de départ pendant qu'il construit ton monde.

## Types de widgets

Le GM choisit un type pour chaque widget qu'il crée. Tu peux choisir les types toi-même quand tu construis des widgets à la main.

| Type de widget | Ce qu'il affiche |
| --- | --- |
| **Progress Bar** | Une barre horizontale pour une valeur rapportée à un maximum, comme la vie ou l'endurance. |
| **Gauge** | Un cadran en demi-cercle pour une valeur rapportée à un maximum. |
| **Relationship Meter** | Une barre avec des marqueurs d'étape et une étiquette, pratique pour la confiance d'un PNJ (personnage non-joueur) ou pour un lien affectif. |
| **Counter** | Un seul grand nombre, comme l'or, les jours écoulés ou les ennemis vaincus. |
| **Stat Block** | Une petite grille de champs nommés avec leurs valeurs, comme STR et DEX, ou un mot d'état. |
| **List** | Une courte liste à puces d'éléments texte, comme les objectifs en cours. |
| **Inventory Grid** | Une grille d'emplacements d'objets, avec onglets de catégorie et compteurs d'objets en option. |
| **Timer** | Un compte à rebours en minutes et secondes, qui peut défiler en direct. |

## Vérifier les widgets avant le début de la partie

Quand des widgets personnalisés existent, un bouton **Review Starting Widgets** (vérifier les widgets de départ) se trouve sous **Start Game** (démarrer la partie) sur l'écran de jeu. Un clic dessus ouvre la fenêtre **Review Starting Widgets** avant que tu commences. Elle liste chaque widget de départ pour que tu puisses les ajuster avant que la partie ne les fige.

1. Appuie sur **Edit** (modifier) sur un widget pour changer ses valeurs de départ ou renommer les champs d'un **Stat Block**.
2. Appuie sur **Remove** (supprimer) pour retirer un widget dont tu ne veux pas.
3. Appuie sur **Start Game** pour commencer à jouer avec les widgets tels qu'ils s'affichent. Appuie sur **Back** (retour) pour fermer la fenêtre sans lancer la partie.

Une fenêtre similaire, **Prepare Next Session Widgets** (préparer les widgets de la prochaine session), apparaît quand tu démarres une nouvelle session dans une partie en cours. Elle propose **Start Next Session** (démarrer la session suivante) au lieu de **Start Game**, et **Cancel** (annuler) au lieu de **Back**.

## Modifier un widget en cours de partie

Le GM met à jour les valeurs des widgets à mesure que l'histoire avance. S'il oublie une mise à jour, corrige le widget à la main.

1. Repère le panneau du widget sur le bord gauche ou droit de l'écran.
2. Clique sur le bouton crayon (**Edit**) dans l'en-tête du widget.
3. Change les valeurs dans la fenêtre d'édition, par exemple **Maximum value** (valeur maximale) sur une barre.
4. Clique sur **Save Changes** (enregistrer les modifications).

Clique sur l'en-tête du widget pour replier ou déplier son contenu.

## Déplacer et verrouiller les panneaux

Les panneaux de widgets sont verrouillés en place par défaut. Chacun a une icône de cadenas dans son en-tête.

1. Clique sur l'icône de cadenas pour déverrouiller le panneau. Un contour léger indique qu'il peut être déplacé.
2. Fais glisser le panneau jusqu'à un nouvel emplacement.
3. Clique de nouveau sur l'icône de cadenas pour le verrouiller.

Pour remettre un panneau à sa place par défaut, double-clique sur son icône de cadenas, ou appuie sur <kbd>R</kbd> quand l'icône a le focus. Chaque panneau retient sa position et son état de verrouillage partie par partie. Ta disposition ne se reporte pas sur les autres parties.

Sur un téléphone, les widgets s'affichent sous forme de petites pastilles plutôt que de panneaux complets. Touche une pastille pour ouvrir ce widget, et touche le X pour le refermer.

## Créer tes propres widgets

Tu peux concevoir les widgets toi-même au lieu de laisser le GM les créer. Ouvre l'éditeur manuel à l'un de ces deux endroits :

- Dans l'assistant de configuration : active **Custom HUD Widgets**, puis active **Build Widget Setup** (construire la configuration des widgets). L'éditeur apparaît en dessous.
- Dans une partie existante : ouvre **Chat Settings** (réglages du chat), puis la section **Widgets**.

1. Choisis un type de widget dans le menu déroulant et appuie sur **Add** (ajouter).
2. Règle **Icon** (icône : un court symbole ou emoji), **Label** (libellé), **Type**, **Side** (côté : **Left HUD** ou **Right HUD**) et **Accent** (la couleur).
3. Remplis les champs propres à ce type : une barre utilise **Value** et **Max**, un compteur **Count**, une grille d'inventaire **Slots** et **Contents**, et un minuteur **Seconds** et **Running**.
4. Dans **Chat Settings**, appuie sur **Save Widgets** (enregistrer les widgets) pour appliquer tes changements. **Reset** (réinitialiser) annule les modifications non enregistrées.

L'éditeur indique combien de widgets tu as utilisés sur les 4 autorisés.

## Partager des widgets par import et export

Tu peux enregistrer une disposition de widgets dans un fichier et la charger dans une autre partie. L'assistant de configuration et la section **Widgets** de **Chat Settings** proposent tous deux ces boutons.

1. Appuie sur **Export Widgets** (exporter les widgets) pour télécharger tes widgets dans un fichier JSON (un format de données en texte brut).
2. Dans une autre partie, appuie sur **Import Widgets** (importer des widgets) et choisis ce fichier.
3. Dans **Chat Settings**, appuie sur **Save Widgets** pour que les widgets chargés s'appliquent.

## Guides associés

- [Game Mode : premiers pas](getting-started.md)
- [Le HUD et les trackers en Roleplay](../roleplay/hud-and-trackers.md)
