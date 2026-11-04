# Variables de preset

Une variable de preset est un choix étiqueté intégré à un preset de prompt (un modèle de prompt enregistré). L'auteur du preset la définit une fois, et la personne qui utilise le preset choisit les options au moment de l'assigner à un chat. Sers-t'en pour qu'un même preset se comporte de plusieurs façons sans modifier le texte du prompt.

Tu donnes un nom à la variable, tu écris une question et tu listes des options. Puis tu saisis le nom entre doubles accolades, comme `{{tone}}`, dans n'importe quelle section de prompt. Quand l'IA génère une réponse, Marinara remplace `{{tone}}` par la valeur de l'option choisie par l'utilisateur.

Les variables de preset ont besoin d'un preset de prompt : elles fonctionnent donc dans les chats Roleplay. Elles ne s'appliquent pas aux chats Conversation ni aux chats Game Mode, qui utilisent un texte de prompt unique au lieu de sections. Pour les presets eux-mêmes, voir [Éditeur de presets et gestionnaire de prompts](presets.md).

## Les types de variable de preset

Par défaut, une variable qui a plusieurs options est un choix unique. L'utilisateur choisit une option, présentée sous forme de boutons radio. Trois réglages changent cela.

| Type | Comment l'obtenir | Comportement |
| --- | --- | --- |
| **Boolean Toggle** | Donne à la variable exactement une option. | Un interrupteur oui/non. Activé, il insère la valeur de l'option. Désactivé, il n'insère rien. |
| **Multi-Select** (sélection multiple) | Active **Multi-Select**. | L'utilisateur choisit plusieurs options. Les valeurs sont assemblées avec un séparateur, `, ` par défaut. Romance, Fantasy et Action deviennent "Romance, Fantasy, Action". |
| **Random Pick** (tirage aléatoire) | Active **Random Pick**. | Sur une variable à choix unique, Marinara présélectionne une option au hasard pour chaque nouveau chat, et le choix reste fixe jusqu'à ce que tu le changes. Avec **Multi-Select** activé, l'utilisateur choisit un vivier d'options, et chaque réponse en tire une. |

## Ajouter une variable de preset

1. Ouvre le panneau **Presets** et clique sur un preset pour ouvrir le **Preset Editor** (éditeur de preset).
2. Va dans l'onglet **Sections** et descends jusqu'au panneau **Preset Variables** (variables de preset), tout en bas.
3. Clique sur **Add Variable** (ajouter une variable). Une nouvelle carte de variable apparaît. Clique dessus pour la déplier.
4. Renseigne le champ **Variable Name** (nom de la variable). Il ne garde que les lettres, les chiffres et les tirets bas. C'est le nom que tu saisis entre accolades.
5. Remplis **Question (shown to user)**. C'est ce que l'utilisateur lit au moment de choisir.
6. Modifie la liste **Options**. Chaque option a un champ **Label** (libellé), ce que l'utilisateur voit, et un champ **Value** (valeur), le texte inséré dans le prompt. Une valeur vide n'insère rien.
7. Sous **Presentation** (présentation), choisis **Auto**, un style bouton (**Radios** ou **Checkboxes**) ou un style compact (**Dropdown** ou **Listbox**). Active **Alphabetical option display** (affichage alphabétique des options) pour trier les options par libellé.
8. Appuie sur <kbd>Escape</kbd> ou clique sur **Done** (terminé). Les modifications s'enregistrent toutes seules, et le pied de l'éditeur indique "Changes auto-save. Press Escape to close."

Saisis ensuite le nom entre accolades dans une section de prompt. Par exemple, place `{{tone}}` dans une section, puis crée une variable nommée `tone` avec une option **Gentle** et une option **Harsh**. Quand l'utilisateur choisit **Harsh**, la section reçoit sa valeur.

Une variable garde toujours au moins une option. Si tu essaies de supprimer la dernière, Marinara la garde.

## Répondre aux variables

Quand tu assignes à un chat un preset qui a des variables, la fenêtre **Configure Preset Variables** (configurer les variables de preset) s'ouvre. Elle indique : "This preset has configurable variables. Select option(s) for each to customize your experience."

Chaque variable affiche sa question, son espace réservé, par exemple `{{tone}}`, et, le cas échéant, un badge (**Boolean toggle**, **Multi-select** ou **Random pick**).

1. Choisis une valeur pour chaque variable.
2. Clique sur **Confirm Choices** (confirmer les choix).

Les autres boutons :

- **Save as default** (enregistrer par défaut) enregistre tes choix sur le preset, pour qu'ils soient pré-remplis la prochaine fois.
- **Skip** (passer) ferme la fenêtre sans enregistrer.

Le bouton **Confirm Choices** reste désactivé tant qu'une variable à choix unique n'a pas de valeur. Les variables **Boolean toggle** et **Multi-select** ne le bloquent pas, même si rien n'est choisi. Passer à un autre preset efface tes choix pour l'ancien.

## Modifier tes réponses plus tard

Dans **Chat Settings** (réglages du chat), la section **Prompt Preset** affiche un bouton crayon, **Edit preset variables** (modifier les variables de preset), quand le preset sélectionné a des variables. Clique dessus pour rouvrir la fenêtre avec tes choix actuels.

## Les noms qui ne sont pas des variables

Marinara résout d'abord les macros intégrées, comme `{{user}}` et `{{char}}`. Ensuite, il compare tout autre `{{NAME}}` (lettres, chiffres et tirets bas) à tes variables de preset. Si aucune ne correspond, il essaie les variables propres au chat, dans la section **Chat Variables** (variables du chat) de **Chat Settings**. La variable de preset l'emporte quand les deux portent le même nom. Si aucune ne porte ce nom, le texte reste exactement tel que tu l'as saisi, sans erreur. Voir [Macros de prompt](macros.md).

## Blocs de décision dans les options

La valeur d'une option peut contenir un bloc de décision, `{{#if decision:"..."}}`, comme tout autre texte de prompt. Seules les options sélectionnées dans le chat sont interrogées, et elles comptent dans **Decision statements per turn** (énoncés de décision par tour). Pour une variable **Random Pick**, toutes les options du vivier sont interrogées, car chacune peut être tirée. Voir [Interroger le Decision model](conditional-prompts.md#asking-the-decision-model).

La valeur d'une variable arrive là où se trouve son `{{name}}`. Si une décision change cette valeur près du début d'un preset, tu peux perdre une grande part de la réutilisation du cache de prompts du service. Place plus loin le contenu qui change souvent. Voir [Blocs de décision et cache de prompts](presets.md#decision-blocks-and-prompt-caching).

## Messages d'accueil

Les variables de preset sont aussi résolues dans les messages d'accueil des personnages, y compris les choix confirmés après la création du message d'accueil. Le message d'accueil original reste modifiable, avec ses macros intactes.

## Guides associés

- [Éditeur de presets et gestionnaire de prompts](presets.md)
- [Macros de prompt](macros.md)
