# Variables de preset

Ce guide explique les **Preset Variables** (variables de preset), ces petits choix façon formulaire que tu peux intégrer à un preset de prompt (un modèle de prompt enregistré). L'auteur du preset définit les choix une fois pour toutes, et la personne qui utilise le preset sélectionne les options au moment où le preset est assigné à un chat. On parle parfois de blocs de choix.

## À quoi servent les variables de preset

Un preset de prompt est un plan réutilisable pour le texte envoyé à l'IA. Une variable de preset ajoute un choix étiqueté à ce plan. Tu donnes un nom au choix, tu écris une question, puis tu listes des options.

Dans n'importe quelle section de prompt, saisis le nom de la variable entre doubles accolades, par exemple `{{tone}}`. Au moment de la génération, Marinara Engine remplace `{{tone}}` par la valeur de l'option retenue. Un même preset produit ainsi des comportements différents, sans toucher au texte du prompt.

Les variables de preset vivent à l'intérieur d'un preset de prompt : elles fonctionnent donc dans les modes de chat qui utilisent des presets de prompt. Elles ne s'appliquent pas au mode Conversation. Ce mode remplace le preset découpé en sections par un texte de prompt unique, et les variables n'ont alors rien à remplir. Pour tout savoir sur les presets eux-mêmes, voir [Éditeur de preset et Prompt Manager](presets.md).

## Les trois types de variable de preset

Le comportement d'une variable dépend de ses options et de deux interrupteurs. Par défaut, une variable qui propose plusieurs options est un choix unique : la personne retient exactement une option, présentée sous forme de boutons radio. À partir de cette base, il existe trois types nommés.

**Boolean Toggle.** Si une variable ne comporte qu'une seule option, elle devient un interrupteur oui/non. Quand il est activé, la valeur de l'option est insérée. Quand il est désactivé, rien n'est inséré. L'éditeur affiche l'étiquette **Boolean Toggle** sur ces variables.

**Multi-Select.** Active l'interrupteur **Multi-Select** (sélection multiple) pour autoriser plusieurs options à la fois. Par défaut, les valeurs retenues sont assemblées avec un séparateur. Le séparateur est un petit champ de texte, et vaut par défaut une virgule suivie d'une espace. Par exemple, les options Romance, Fantasy et Action assemblées avec `, ` donnent le texte "Romance, Fantasy, Action".

**Random Pick** (tirage aléatoire). Pour une variable à choix unique, Marinara présélectionne une option au hasard à chaque nouveau chat. Tu peux la changer avant de confirmer ; le choix enregistré reste ensuite fixe jusqu'à ta prochaine modification. Avec **Multi-Select** activé, l'application tire au sort une des options retenues à chaque génération. Pratique pour varier : tu constitues un vivier d'options, et chaque réponse en pioche une.

## Ajouter une variable de preset

Les variables s'ajoutent pendant l'édition d'un preset. Procède ainsi :

1. Ouvre le panneau **Presets** et clique sur un preset pour ouvrir le **Preset Editor** (éditeur de preset).
2. Va dans l'onglet **Sections** et descends jusqu'au panneau **Preset Variables**, tout en bas.
3. Clique sur **Add Variable** (ajouter une variable). Une nouvelle carte de variable apparaît. Clique dessus pour déplier l'éditeur.
4. Renseigne le champ **Variable Name** (nom de la variable). Seuls les lettres, les chiffres et les tirets bas sont acceptés. C'est ce nom que tu saisis entre accolades, comme `{{variable_name}}`.
5. Remplis le champ **Question (shown to user)** (question affichée à l'utilisateur). C'est le texte que la personne lit au moment de choisir une valeur.
6. Modifie la liste **Options**. Chaque option possède un **Label** (ce qui s'affiche) et une **Value** (le texte inséré dans le prompt). Une valeur vide n'insère rien.
7. Choisis un mode d'affichage sous **Presentation** : **Auto**, le style bouton (**Radios** ou **Checkboxes**), ou le style compact (**Dropdown** ou **Listbox**). Active **Alphabetical option display** pour trier les options par étiquette.
8. Les modifications sont enregistrées toutes seules. Le pied de l'éditeur indique "Changes auto-save. Press Escape to close." Appuie sur Escape ou clique sur **Done** quand tu as terminé.

Pour utiliser la variable, saisis son nom entre accolades dans le contenu de n'importe quelle section de prompt. Par exemple, place `{{tone}}` dans une section, puis crée une variable nommée `tone` avec une option **Gentle** et une option **Harsh**. Quand Harsh est retenu, la section reçoit la valeur correspondante.

Une variable conserve toujours au moins une option. Si tu essaies de supprimer la dernière, Marinara la garde.

## La fenêtre Configure Preset Variables

Quand tu assignes à un chat un preset qui contient des variables, la fenêtre **Configure Preset Variables** (configurer les variables de preset) s'ouvre d'elle-même. Son introduction indique : "This preset has configurable variables. Select option(s) for each to customize your experience."

Chaque variable affiche sa question, le token auquel elle correspond (par exemple `{{tone}}`) et, le cas échéant, un petit badge **Boolean toggle**, **Multi-select** ou **Random pick**. Choisis une valeur pour chaque variable.

- **Save as default** (enregistrer par défaut) reporte tes choix sur le preset : ils seront pré-remplis la prochaine fois.
- **Skip** (passer) ferme la fenêtre sans enregistrer tes choix.
- **Confirm Choices** (confirmer les choix) enregistre tes choix. Le bouton reste désactivé tant qu'une variable à choix unique n'a pas de valeur. Les variables **Boolean toggle** et **Multi-select** ne le bloquent pas, même si rien n'est retenu.

Passer à un autre preset efface les choix de variables faits pour le preset en cours.

## Modifier tes réponses plus tard

Inutile de rouvrir un preset depuis le début pour changer tes réponses. Dans le panneau latéral des réglages du chat, la section **Prompt Preset** affiche un bouton crayon intitulé **Edit preset variables** (modifier les variables de preset) dès que le preset sélectionné contient des variables. Clique dessus pour rouvrir la fenêtre **Configure Preset Variables** avec tes choix actuels déjà remplis.

## Le fourre-tout {{NAME}}

Marinara résout de nombreuses macros intégrées, comme `{{user}}` et `{{char}}`. Ensuite, tout emplacement restant de la forme `{{NAME}}` (lettres, chiffres et tirets bas uniquement) est comparé à tes variables de preset.

S'il existe une variable portant exactement ce nom, l'emplacement prend la valeur retenue. Si aucune variable ne correspond, le texte `{{NAME}}` reste exactement tel que tu l'as saisi. C'est pourquoi un emplacement inconnu ressort inchangé dans le résultat au lieu de provoquer une erreur. Pour la liste complète des macros, voir [Macros de prompt](macros.md).

## Guides associés

- [Éditeur de preset et Prompt Manager](presets.md)
- [Macros de prompt](macros.md)

Les variables de preset sont aussi résolues dans les messages d'accueil des personnages, y compris les choix confirmés après la création du message. Le message d'accueil original reste modifiable avec ses macros intactes.
