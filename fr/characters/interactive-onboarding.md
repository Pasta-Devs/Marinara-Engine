# Accueil interactif

Tu n'as besoin de ce guide que si tu crées des fiches pour que d'autres personnes les jouent. L'accueil interactif (interactive onboarding) permet à une fiche de personnage de poser des questions au joueur quand il commence un chat Roleplay, puis de construire un persona à partir de ses réponses. Les auteurs le configurent dans le Character Editor (éditeur de personnage). Les joueurs répondent dans l'assistant de nouveau chat.

## À quoi sert l'accueil interactif

Un persona est la fiche de personnage qui te représente dans un chat. Voir [Personas](personas.md). D'habitude, tu en écris un toi-même avant de jouer. Avec l'accueil interactif, la fiche fournit à la place un modèle de persona : les cinq champs du persona – **Description**, **Personality** (personnalité), **Backstory** (passé), **Appearance** (apparence) et **Scenario** (scénario) – avec des blancs pour le joueur, plus les questions qui servent à les remplir.

Quand un joueur commence un chat Roleplay avec la fiche, il peut choisir **Create your persona** (créer ton persona), répondre aux questions et obtenir un nouveau persona ordinaire. Les réponses sont inscrites une seule fois dans le texte. Le joueur peut modifier, garder ou supprimer ce persona comme n'importe quel autre. La fiche ne change pas.

Une fiche peut aussi poser des questions sur le personnage, dont les réponses sont enregistrées dans ce chat plutôt que dans un persona. Voir [Questions sur le personnage](#character-questions). L'accueil interactif utilise la syntaxe de macro existante et n'exécute aucun script.

## Le configurer en tant qu'auteur

1. Ouvre le personnage dans le Character Editor. Voir [Créer et modifier des personnages](creating-and-editing-characters.md).
2. Ouvre l'onglet **Onboarding** (accueil), à côté de **Card**.
3. Active **Interactive onboarding** (accueil interactif). Un court guide **How onboarding works** (fonctionnement de l'accueil) apparaît sous l'interrupteur.

Désactiver l'interrupteur masque les champs de l'accueil interactif, mais conserve ce que tu as écrit.

<a id="let-professor-mari-write-it"></a>

### Laisser Professor Mari l'écrire

Demande-le à [Professor Mari](../home/professor-mari.md), par exemple : "Écris un accueil interactif amusant pour Queen Ayrene, avec un modèle de persona." Elle écrit les questions et les champs du persona, puis active l'accueil interactif. L'application vérifie son travail avant l'enregistrement. Un nom mal orthographié, un `{{name}}` sans question ou une condition à laquelle il manque son `#` lui est renvoyé pour correction. Pour une question sur le personnage, elle ajoute aussi son `{{name}}` à l'un des champs propres à la fiche. Ses modifications apparaissent dans un encart de modification que tu peux examiner ou annuler.

### Ajouter des questions de persona

Sous **Persona Questions** (questions du persona), clique sur **Add Question** (ajouter une question). Chaque question fonctionne comme une variable de preset, un blanc nommé qu'une réponse vient remplir. Voir [Presets](../prompts/presets.md). Une fiche peut compter jusqu'à 100 questions.

| Champ | Ce qu'il fait |
| --- | --- |
| **Variable Name** (nom de variable) | Le nom que tu utilises dans les champs, par exemple `faction`. Utilise des lettres, des chiffres et des tirets bas, en commençant par une lettre ou un tiret bas. Les noms sont sensibles à la casse : `Gender` et `gender` sont différents. |
| **Question (shown to user)** | Le texte que lit le joueur. Il peut reprendre des réponses précédentes, par exemple `What does {{player}} look like?`. `{{char}}` est le nom de la fiche et `{{user}}` celui du joueur. |
| **Options** | Transforme la question en choix. La première option est sélectionnée par défaut. Sans option, le joueur saisit une réponse libre. |
| **Value** (valeur) | Ce qui entre dans le persona. Les majuscules et les minuscules sont conservées telles que tu les tapes, et les macros qu'il contient sont remplacées. Laisse-le vide pour utiliser le libellé de l'option. Utilise une valeur en minuscules, par exemple `ranger`, si la réponse s'insère au milieu d'une phrase. |
| **Help text for players** (texte d'aide pour les joueurs) | Un texte facultatif affiché sous l'option. |
| **Allow own answer** (autoriser une réponse personnelle) | Ajoute un choix **Write your own** (écrire ta propre réponse) à côté de tes options. |
| **Multi-Select** (sélection multiple) | Permet au joueur de choisir plusieurs options, reliées par le séparateur. |

Une question nommée `player` définit le nom du persona. Sans elle, les joueurs doivent d'abord indiquer leur nom. L'éditeur t'avertit quand un nom est vide, invalide, utilisé deux fois ou déjà pris par une macro intégrée, et quand une question n'est utilisée dans aucun champ.

### Rédiger les champs du persona

Écris les cinq champs comme pour un persona à toi, et place `{{name}}` là où une réponse doit apparaître. Clique dans un champ pour voir ses **Available variables** (variables disponibles), puis clique sur l'une d'elles pour l'insérer à l'emplacement de ton curseur.

```text
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

Utilise `{{#if}}` pour n'afficher du texte que pour certaines réponses :

```text
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

Une question qui n'apparaît qu'à l'intérieur d'un `{{#if}}` n'est posée que lorsque la condition est vraie. Ici, `relationToAna` est une question de suivi qui apparaît dès que le joueur répond **yes**. Les comparaisons ignorent la différence entre majuscules et minuscules.

`{{user}}` et `{{char}}` restent des macros dans le persona créé. Les autres macros (des espaces réservés que Marinara remplace par une valeur, comme `{{random}}` pour un nombre aléatoire ou `{{time}}` pour l'heure) sont remplacées une seule fois, à la création du persona, ou laissées vides si elles n'ont pas de valeur à ce moment-là.

La section **Rendered preview** (aperçu du rendu), en bas, montre le persona construit à partir de réponses d'exemple et liste les questions posées, dans l'ordre.

<a id="character-questions"></a>

### Questions sur le personnage

Le même onglet contient une seconde liste, **Character Questions** (questions sur le personnage). Elles fonctionnent comme les questions de persona, mais les réponses sont enregistrées dans le chat, pas dans un persona. Place le nom dans l'un des champs propres à la fiche (**Description**, **Personality**, **Backstory**, **Appearance** ou **Scenario**), car ce sont les champs que lit le modèle.

```text
{{char}} treats {{relationshipToUser}} with open warmth.
```

Un message d'accueil peut utiliser le `{{name}}` d'une question sur le personnage, et il affiche la réponse du joueur. Un message d'accueil peut aussi utiliser le `{{name}}` d'une question de persona, comme `Ah, so you are a {{class}}`, mais il n'est rempli que lorsque le joueur crée ce persona dans l'assistant de nouveau chat, dans le premier message et ses messages d'accueil alternatifs. Avec un persona existant ou avec Quick Start, la balise s'affiche telle qu'elle est écrite, et le Character Editor t'en avertit. Clique dans un message d'accueil et ses **Available variables** présentent les deux types de questions, avec leur étiquette.

Les réponses sont stockées comme variables du chat, si bien que la fiche lit une valeur différente dans chaque chat sans jamais avoir besoin d'être modifiée. Une question sur le personnage est posée dès que la fiche est dans le chat, que le joueur crée un persona ou non. La fenêtre n'affiche **About you** (à propos de toi) que lorsqu'un persona est en cours de création.

Trois points à connaître :

- **Une réponse jamais renseignée reste une balise littérale.** Une question à texte libre sans valeur par défaut n'est pas préremplie, donc un chat lancé sans l'assistant affiche `{{name}}` tel quel. Les questions à choix préremplissent leur première option, ce qui couvre la plupart des fiches.
- **Deux fiches d'un même chat qui déclarent le même nom partagent une seule valeur.** La dernière réponse enregistrée est celle que lisent les deux fiches. La fenêtre t'en avertit.
- **Une fiche qui quitte un chat emporte ses réponses avec elle.** Quand un personnage est retiré, les variables du chat qui appartiennent à ses questions sur le personnage sont supprimées, sauf si un autre personnage du chat déclare le même nom.

## Répondre aux questions en tant que joueur

1. Commence un nouveau chat Roleplay. À l'étape **Persona & Characters** (persona et personnages), les fiches dotées de l'accueil interactif affichent une petite icône de personne avec un plus dans la liste des personnages.
2. Ajoute le personnage. Pour obtenir un nouveau persona, sélectionne **Create your persona** en haut de **Your Persona** (ton persona). Cette ligne indique le nom de la fiche à laquelle elle appartient. Tout autre choix, y compris **None**, ignore le persona.
3. Clique sur **Next** (suivant). La fenêtre des questions s'ouvre dès qu'une fiche du chat comporte des questions sur le personnage, que tu crées un persona ou non.
4. Réponds aux questions. Les questions sur le personnage viennent en premier, avec une section par fiche, puis **About you** quand un persona est en cours de création. Les questions de suivi apparaissent à mesure que tes réponses les rendent pertinentes.
5. Clique sur **Review persona** (examiner le persona) pour voir le nom et les champs que produisent tes réponses. Les parties remplies par tes réponses sont surlignées. L'aperçu n'enregistre rien.
6. Clique sur **Create persona** (créer le persona), ou sur **Save answers** (enregistrer les réponses) si tu n'en crées pas. Les réponses sur le personnage sont enregistrées dans le chat, puis l'assistant continue.

Si ça n'a pas marché : si le persona a été créé mais pas sélectionné, choisis-le sous **Your Persona**. Si les réponses n'ont pas pu être enregistrées, le chat utilise à la place le texte par défaut propre à chaque fiche.

Les questions de l'accueil interactif sont posées dans l'assistant de nouveau chat Roleplay. Quick Start, la configuration Conversation et le lancement d'un chat directement depuis une fiche de personnage ne les posent pas encore. Un chat lancé ainsi préremplit la première option de chaque question, si bien que `{{relationshipToUser}}` est résolu au lieu d'afficher la balise. Répondre dans l'assistant remplace cette valeur par défaut pour ce chat uniquement.

Tu peux aussi répondre après la configuration, depuis **Chat Settings** (réglages du chat) :

- Dans un chat Roleplay, le sélecteur **Persona** liste **Create your persona** pour chaque fiche du chat qui en propose un. Sers-t'en si tu as sauté l'assistant ou si tu veux un nouveau persona plus tard. Voir [Choisir ton persona dans un chat](choosing-your-persona.md).
- Le marqueur d'accueil interactif à côté d'un personnage, dans **Characters** (personnages), rouvre uniquement les questions sur le personnage de cette fiche. Elles s'ouvrent sur les réponses que le chat contient déjà : enregistrer une modification laisse donc les autres telles quelles. L'enregistrement restaure aussi une réponse que tu as supprimée de **Chat Variables** (variables du chat). Les réponses des autres fiches ne sont pas touchées, sauf pour un nom que deux fiches partagent : c'est une seule valeur, donc les deux fiches lisent la nouvelle réponse.

Ajouter une fiche avec des questions sur le personnage à un chat Roleplay en cours, depuis **Chat Settings** ou en la déposant sur le chat, pose d'abord ses questions. Son message d'accueil est ensuite proposé avec tes réponses insérées et signalées.

## Partager des fiches avec accueil interactif

L'accueil interactif est enregistré avec la fiche. Les exports **Marinara Native** et **Compatible PNG Card** le conservent : un joueur qui importe la fiche reçoit donc aussi les questions. **Compatible JSON** le laisse de côté. Une fiche importée avec plus de 100 questions garde les 100 premières. Voir [Importer et exporter des fiches de personnage](import-export.md).

## Guides associés

- [Créer et modifier des personnages](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Choisir ton persona dans un chat](choosing-your-persona.md)
- [Macros](../prompts/macros.md)
- [Importer et exporter des fiches de personnage](import-export.md)
