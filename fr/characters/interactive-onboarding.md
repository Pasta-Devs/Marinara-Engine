# Accueil interactif

Ce guide présente l'**accueil interactif** (interactive onboarding), une fonction des fiches de personnage qui permet aux joueurs de construire leur persona en répondant aux questions de l'auteur de la fiche quand ils commencent un chat Roleplay. Il explique comment les auteurs le configurent dans le Character Editor (éditeur de personnage) et ce que les joueurs voient dans l'assistant de nouveau chat.

## À quoi sert l'accueil interactif

Un persona est le personnage qui te représente dans un chat. Voir [Personas utilisateur](personas.md). D'habitude, tu écris toi-même un persona avant de jouer. Avec l'accueil interactif, une fiche de personnage fournit à la place un modèle de persona. Ce modèle, ce sont les cinq champs du persona – **Description**, **Personality** (personnalité), **Backstory** (passé), **Appearance** (apparence) et **Scenario** (scénario) – avec des blancs que le joueur remplit, plus les questions qui servent à les remplir.

Quand un joueur commence un chat Roleplay avec la fiche, il peut choisir **Create your persona** (créer ton persona), répondre aux questions et obtenir un nouveau persona ordinaire. Les réponses sont inscrites une seule fois dans le texte. Le résultat est un persona normal, que le joueur peut modifier, garder ou supprimer comme n'importe quel autre. La fiche elle-même ne change pas.

Une fiche peut aussi poser des **questions sur le personnage**, dont les réponses sont enregistrées dans ce chat plutôt que dans un persona. Voir [Questions sur le personnage](#character-questions) plus bas.

L'accueil interactif utilise la syntaxe de macro existante. Il n'exécute aucun script.

## Le configurer en tant qu'auteur

1. Ouvre le personnage dans le Character Editor. Voir [Créer et modifier des personnages](creating-and-editing-characters.md).
2. Ouvre l'onglet **Onboarding** (accueil), à côté de **Card**.
3. Active **Interactive onboarding** (accueil interactif). Un court guide **How onboarding works** (fonctionnement de l'accueil) apparaît sous l'interrupteur.

Désactiver l'interrupteur masque les champs de l'accueil interactif, mais conserve ce que tu as écrit.

<a id="let-professor-mari-write-it"></a>

### Laisser Professor Mari l'écrire

Tu peux aussi demander à [Professor Mari](../home/professor-mari.md) d'écrire l'accueil interactif, par exemple : "Écris un accueil interactif amusant pour Queen Ayrene, avec un modèle de persona." Elle écrit les questions et les champs du persona, puis active l'accueil interactif. L'application vérifie son travail avant l'enregistrement : un nom mal orthographié, un `{{name}}` sans question ou une condition à laquelle il manque son `#` lui est renvoyé pour correction. Pour une question sur le personnage, elle ajoute aussi son `{{name}}` à l'un des champs propres à la fiche. Ses modifications apparaissent dans un encart de modification que tu peux examiner ou annuler, comme ses autres changements.

### Ajouter des questions

Sous **Persona Questions** (questions du persona), clique sur **Add Question** (ajouter une question). Chaque question fonctionne comme une variable de preset. Voir [Presets](../prompts/presets.md). Une fiche peut compter jusqu'à 100 questions.

- **Variable Name** (nom de variable) est le nom que tu utilises dans les champs, par exemple `faction`. Choisis n'importe quel nom fait de lettres, de chiffres et de tirets bas, qui commence par une lettre ou un tiret bas. Les noms sont sensibles à la casse : `Gender` et `gender` sont différents.
- **Question (shown to user)** est le texte que lit le joueur. Il peut reprendre des réponses précédentes, par exemple `What does {{player}} look like?`. Ici, `{{char}}` est le nom de la fiche et `{{user}}` celui du joueur.
- Avec **Options**, la question devient un choix. La première option est sélectionnée par défaut. Sans option, le joueur saisit une réponse libre.
- **Value** (valeur) est ce qui entre dans le persona. Les majuscules et les minuscules sont conservées telles que tu les tapes ; les macros de ce champ sont remplacées comme dans le reste des champs. Laisse ce champ vide pour utiliser le libellé de l'option. Saisis une valeur en minuscules, par exemple `ranger`, si la réponse s'insère au milieu d'une phrase.
- **Help text for players** (texte d'aide pour les joueurs) est un texte facultatif affiché sous l'option.
- **Allow own answer** (autoriser une réponse personnelle) ajoute un choix **Write your own** (écrire ta propre réponse) à côté de tes options.
- **Multi-Select** (sélection multiple) permet au joueur de choisir plusieurs options. Elles sont alors reliées par le séparateur.

Une question nommée `player` définit le nom du persona. Si tu n'en ajoutes pas, les joueurs doivent d'abord indiquer leur nom.

L'éditeur t'avertit quand un nom est vide, invalide, utilisé deux fois ou déjà pris par une macro intégrée, et quand une question n'est utilisée dans aucun champ.

<a id="character-questions"></a>

### Questions sur le personnage

Plus bas dans le même onglet, une seconde liste s'appelle **Character Questions** (questions sur le personnage). Ses questions fonctionnent exactement comme celles du dessus, mais les réponses sont enregistrées dans le **chat**, pas dans un persona. Place le nom dans l'un des champs propres à la fiche : **Description**, **Personality**, **Backstory**, **Appearance** ou **Scenario**.

```
{{char}} treats {{relationshipToUser}} with open warmth.
```

Ces cinq champs sont ceux que lit le modèle : ce sont donc les seuls qu'une réponse sur le personnage peut atteindre.

Les réponses sont stockées comme variables du chat, si bien que la fiche lit une valeur différente dans chaque chat sans jamais avoir besoin d'être modifiée. Une question de fiche est posée dès que la fiche est dans le chat, que le joueur crée un persona ou non. La fenêtre n'affiche une section **About you** (à propos de toi) que lorsqu'un persona est en cours de création.

Trois points à connaître pour un auteur :

- **Une réponse jamais renseignée reste une balise littérale.** Une question à texte libre sans valeur par défaut n'est pas préremplie, donc un chat lancé sans l'assistant affiche `{{name}}` tel quel. Les questions à choix préremplissent leur première option, ce qui couvre la plupart des fiches.
- **Si deux fiches d'un même chat déclarent le même nom, elles partagent une seule valeur.** Un chat ne stocke qu'une réponse par nom : la dernière enregistrée est celle que lisent les deux fiches. La fenêtre t'en avertit quand cela arrive.
- **Une fiche qui quitte un chat emporte ses réponses avec elle.** Quand un personnage est retiré, les variables du chat qui appartiennent à ses questions sur le personnage sont supprimées, sauf si un autre personnage encore présent dans le chat déclare le même nom. Un nom partagé reste, car la fiche restante peut encore le lire.

### Rédiger les champs du persona

Écris les cinq champs comme pour un persona à toi, et place `{{name}}` là où une réponse doit apparaître :

```
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

Quand tu cliques dans un champ, ses **Available variables** (variables disponibles) apparaissent dessous. Clique sur l'une d'elles pour l'insérer à l'emplacement de ton curseur.

Utilise `{{#if}}` pour n'afficher du texte que pour certaines réponses :

```
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

Une question qui n'apparaît qu'à l'intérieur d'un `{{#if}}` n'est posée que lorsque cette condition est vraie. Dans l'exemple, `relationToAna` est une question de suivi qui apparaît dès que le joueur répond **yes**. Les comparaisons ignorent la différence entre majuscules et minuscules.

`{{user}}` et `{{char}}` restent des macros dans le persona créé : elles continuent donc de fonctionner comme dans n'importe quel persona. Les autres macros, comme `{{random}}`, `{{time}}` ou `{{getvar}}`, sont remplacées une seule fois à la création du persona, ou laissées vides si elles n'ont pas de valeur à ce moment-là.

La section **Rendered preview** (aperçu du rendu), en bas, montre le persona construit à partir de réponses d'exemple, et liste les questions posées, dans l'ordre.

## Répondre aux questions en tant que joueur

1. Commence un nouveau chat Roleplay. À l'étape **Persona & Characters** (persona et personnages), les fiches dotées de l'accueil interactif affichent une petite icône de personne avec un plus dans la liste des personnages.
2. Ajoute le personnage. Pour en tirer un nouveau persona, sélectionne la ligne **Create your persona** en haut de **Your Persona** (ton persona). Elle indique le nom de la fiche à laquelle elle appartient. Tout autre choix (ou **None**) ignore le persona et garde le tien.
3. Clique sur **Next** (suivant). La fenêtre des questions s'ouvre dès qu'une fiche du chat comporte des questions sur le personnage, que tu crées un persona ou non.
4. Réponds aux questions. Les **Character questions** (questions sur le personnage) viennent en premier, avec une section par fiche, puis **About you** quand un persona est en cours de création. Les questions de suivi apparaissent dès que tes réponses les rendent pertinentes.
5. Clique sur **Review persona** (examiner le persona) pour voir le nom et les champs que produisent tes réponses, exactement tels qu'ils seront enregistrés. Les parties remplies par tes réponses sont surlignées. L'aperçu n'écrit rien ; seul **Create persona** (créer le persona) le fait.
6. Clique sur **Create persona**, ou sur **Save answers** (enregistrer les réponses) si tu n'en crées pas. Les réponses sur le personnage sont enregistrées dans le chat, puis l'assistant continue.

Les questions de l'accueil interactif sont posées dans l'assistant de nouveau chat Roleplay. Quick Start, la configuration Conversation et le lancement d'un chat directement depuis une fiche de personnage ne les posent pas encore. Un chat lancé ainsi préremplit tout de même la première option de chaque question, si bien que `{{relationshipToUser}}` est résolu au lieu d'afficher la balise. Répondre dans l'assistant remplace cette valeur par défaut, pour ce chat uniquement.

Les deux parcours fonctionnent aussi après la configuration, depuis **Chat Settings** (réglages du chat) :

- Dans un chat Roleplay, le sélecteur **Persona** liste **Create your persona** pour chaque fiche du chat qui en propose un. Sers-t'en si tu as sauté l'assistant ou si tu veux un nouveau persona plus tard.
- Le marqueur d'accueil interactif à côté d'un personnage, dans **Characters** (personnages), rouvre uniquement les questions sur le personnage de cette fiche. Elles s'ouvrent sur les réponses que le chat contient déjà : enregistrer une modification laisse donc les autres telles quelles, et enregistrer de nouveau restaure aussi une réponse que tu as supprimée de Chat Variables (variables du chat). Les réponses des autres fiches ne sont pas touchées, sauf pour un nom que deux fiches partagent : c'est une seule valeur, donc les deux fiches lisent la nouvelle réponse.

## Partager des fiches avec accueil interactif

L'accueil interactif est enregistré avec la fiche. Les exports **Marinara Native** et **Compatible PNG Card** le conservent : un joueur qui importe la fiche reçoit donc aussi les questions. L'export **Compatible JSON** le laisse de côté. Une fiche importée avec plus de 100 questions garde les 100 premières. Voir [Importer et exporter des fiches de personnage](import-export.md).

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Personas utilisateur : créer et modifier](personas.md)
- [Choisir ton persona dans un chat](choosing-your-persona.md)
- [Macros](../prompts/macros.md)
- [Importer et exporter des fiches de personnage](import-export.md)
