# Scripts regex

Ce guide explique les scripts regex dans Marinara Engine. Un script regex est une règle de recherche et de remplacement qui réécrit automatiquement le texte du chat. Au programme : à quoi servent les scripts regex, comment en créer un, où ils s'appliquent et comment les limiter à un seul personnage.

## Qu'est-ce qu'un script regex

Regex est l'abréviation de "regular expression", c'est-à-dire expression régulière. Une expression régulière est un motif de recherche. Elle repère le texte qui correspond à une règle, et le script regex remplace ce texte par autre chose. Aucune connaissance en programmation n'est nécessaire.

Un script regex s'exécute tout seul, chaque fois qu'un message passe dans un chat. Il peut nettoyer une réponse de l'IA avant que tu la voies. Il peut modifier ton propre message avant l'envoi. Il peut aussi modifier le texte que reçoit le modèle. Tu définis le motif une seule fois, et il continue d'agir dans chaque message correspondant.

Voici un exemple simple, avant et après. Certains modèles entourent les actions d'astérisques, comme ceci :

```
*She smiles* Hello there.
```

Si tu cherches le motif `\*([^*]+)\*` et que tu le remplaces par `$1`, les astérisques disparaissent et le texte qu'elles encadraient est conservé :

```
She smiles Hello there.
```

Dans le remplacement, `$1` signifie "le texte capturé par le motif dans la première paire de parenthèses". Tu utiliseras souvent `$1`, `$2` et les tokens du même genre.

Usages courants : supprimer les astérisques, effacer les remarques hors personnage entre parenthèses, censurer un mot, corriger les manies de mise en forme d'un personnage.

## Où trouver tes scripts regex

Les scripts regex globaux se trouvent dans le panneau **Presets** (presets). Ouvre-le avec le bouton **Presets** de la barre du haut, puis repère la section intitulée **Regexes** (regex). La note de section indique "Find/replace patterns applied to AI output or user input".

Chaque ligne de la liste affiche :

- Le nom du script.
- Une petite pastille **AI** ou **User** qui indique où le script s'applique.
- Le motif, sous la forme `/pattern/flags`.
- Un interrupteur pour activer ou désactiver le script. L'effet est immédiat, sans passer par l'éditeur.
- Un bouton **Edit regex** (modifier la regex), avec une icône de crayon.
- Un bouton **Delete regex** (supprimer la regex), avec une icône de corbeille.

Tant qu'aucun script n'existe, la liste affiche "No regexes yet". Attrape une ligne par sa poignée et fais-la glisser pour changer l'ordre d'exécution. Cette liste ne montre que les scripts globaux. Les scripts liés à un seul personnage sont rangés à part. Voir "Scripts regex limités à un personnage" plus bas.

L'en-tête de la section propose aussi trois boutons à icône :

- **Create regex** (créer une regex) : ouvre un nouveau script vierge.
- **Import regexes from JSON** (importer des regex depuis un fichier JSON) : lit les scripts d'un fichier.
- **Export regexes to JSON** (exporter les regex vers un fichier JSON) : enregistre tous tes scripts globaux dans un seul fichier.

## Créer un script regex

Pour créer un script global :

1. Ouvre le panneau **Presets** et repère la section **Regexes**.
2. Clique sur **Create regex**. L'éditeur complet de script regex s'ouvre.
3. Saisis un nom dans le champ du haut. Un nouveau script porte d'abord le nom "New Regex Script".
4. Remplis les champs décrits ci-dessous.
5. Clique sur **Save** (enregistrer). Une mention verte **Saved** apparaît un instant.

L'éditeur contient les champs suivants.

### Find Pattern (Regex)

Le champ **Find Pattern (Regex)** (motif recherché) contient le motif de recherche. Écris-le sans les barres obliques de délimitation. Le texte indicatif montre un exemple : `\*([^*]+)\*`. Si le motif est invalide ou dangereux, une erreur rouge s'affiche sous le champ et bloque l'enregistrement. Voir "Sécurité et performances" plus bas.

### Replace With

Le champ **Replace With** (texte de remplacement) contient le texte qui remplace chaque correspondance. Laisse-le vide pour supprimer le texte trouvé. Tu peux réutiliser le texte capturé avec `$1`, `$2`, et ainsi de suite. Placées devant une capture, les transformations de casse changent ses majuscules et minuscules :

- `\u$1` met la première lettre de la capture en majuscule.
- `\U$1\E` met toute la capture en majuscules.
- `\l$1` met la première lettre de la capture en minuscule.
- `\L$1\E` met toute la capture en minuscules.

Une barre oblique inverse littérale, comme dans un chemin Windows du type `C:\Users`, est conservée telle quelle.

### Regex Flags

Les **Regex Flags** (drapeaux de la regex) sont des boutons qui changent la façon dont le motif s'applique. Un nouveau script démarre avec `g` et `i` activés :

- `g` (global) : remplace toutes les correspondances, pas seulement la première.
- `i` (case-insensitive) : ignore la différence entre majuscules et minuscules.
- `m` (multiline) : autorise `^` et `$` à correspondre aux sauts de ligne.
- `s` (dotAll) : autorise `.` à correspondre aussi aux retours à la ligne.
- `u` (unicode), `y` (sticky) et `d` (match indices) sont des drapeaux avancés, réservés à des cas particuliers.

### Trim Strings

Le champ **Trim Strings** (chaînes à retirer) est une liste facultative de textes simples à supprimer une fois le remplacement effectué. Clique sur **Add trim string** (ajouter une chaîne à retirer) pour ajouter une ligne, et sur le bouton **X** pour en enlever une. Pratique pour effacer un texte fixe plus rapide à taper qu'à décrire par un motif.

### Live Test

Le champ **Live Test** (test en direct) permet de vérifier le motif avant l'enregistrement. Colle un texte d'exemple dans le champ : le résultat s'affiche en dessous, sous **Result:**. Live Test ne valide que la recherche, le remplacement et les chaînes à retirer. Il ne vérifie ni le placement, ni l'état activé ou désactivé, ni la portée par personnage, ni la profondeur. La note sous le champ le rappelle : "Pattern preview only: placement, enabled state, character scope, and depth are evaluated at runtime".

Tu peux utiliser des macros comme `{{user}}` et `{{char}}` dans le motif, dans le remplacement et dans les chaînes à retirer. Dans Live Test, elles prennent des valeurs d'exemple. Dans un vrai chat, elles prennent les vrais noms et les vrais textes. Pour en savoir plus sur les macros, voir [Macros](../prompts/macros.md).

## Placement : AI Output ou User Input

Le champ **Apply To** (appliquer à) détermine quel côté du chat le script surveille. Au moins une option doit rester sélectionnée. Les deux peuvent l'être en même temps.

- **AI Output** : le script s'applique aux réponses de l'IA avant leur affichage.
- **User Input** : le script s'applique à tes messages avant leur envoi.

Choisis **AI Output** pour nettoyer ce qu'écrit le modèle. Choisis **User Input** pour corriger ou remodeler ton propre texte.

Avec **Only Prompt** ou **Both**, dans un chat **Roleplay** en mode de groupe **Individual** (réponses individuelles), le champ d'application dépend du personnage qui reçoit le prompt : tes messages et ceux des autres personnages relèvent de **User Input**, tandis que les propres réponses du personnage qui va répondre relèvent de **AI Output**. Cela vaut aussi pour les réponses précédentes du même tour de groupe. Les restrictions par personnage déterminent toujours qui reçoit le prompt réécrit : un narrateur exclu d'un script qui masque les pensées conserve donc les pensées d'origine. Choisis **Only Prompt** pour garder intact le texte enregistré du chat.

## Apply Mode : Only Display, Only Prompt ou Both

Le sélecteur **Apply Mode** (mode d'application) se trouve dans **Advanced Options** (options avancées). Il détermine à quel moment la réécriture prend effet. C'est indépendant du placement. Un nouveau script démarre sur **Only Display**.

- **Only Display** : ne change que ce que tu vois dans le chat. Le message enregistré et le texte transmis au modèle aux tours suivants restent intacts.
- **Only Prompt** : ne change que ce que reçoit le modèle. L'affichage du chat et le message enregistré restent intacts. C'est aussi ce que montre l'aperçu du prompt dans l'application.
- **Both** : change à la fois l'affichage et le texte du prompt.

### Quel mode d'application choisir

Voici un repère rapide :

- Tu veux seulement soigner l'apparence d'une réponse à l'écran : choisis **Only Display**. C'est l'option la plus sûre pour les corrections cosmétiques.
- Tu veux modifier ce que lit le modèle, par exemple retirer une balise qu'il n'arrête pas de recopier : choisis **Only Prompt**.
- Tu veux que la modification vaille à l'écran et dans le contexte du modèle : choisis **Both**.

Une précision sur tes propres messages. Quand un script **User Input** est réglé sur **Only Display** ou sur **Both**, la réécriture a lieu juste avant l'envoi. Elle modifie donc le message réellement enregistré et envoyé, pas seulement son apparence après coup. Il n'existe pas de mode purement visuel pour tes messages sortants.

## Execution Order et Depth

Les deux réglages se trouvent dans **Advanced Options**.

Le champ **Execution Order** (ordre d'exécution) attend un nombre. Les plus petits nombres passent en premier. Cela compte dès que plusieurs scripts peuvent correspondre au même texte. Un nouveau script démarre à 0, et l'application lui attribue le premier nombre libre à l'enregistrement : les scripts tout neufs n'entrent donc pas en conflit. Autre option : réordonne les lignes par glisser-déposer dans la liste **Regexes**.

Le réglage **Depth Range** (plage de profondeur) limite jusqu'où le script remonte dans le chat, à l'aide de deux champs numériques, **Min** et **Max**. La profondeur se compte à rebours depuis le message le plus récent. Le message le plus récent est à la profondeur 0, le précédent à la profondeur 1, et ainsi de suite. Laisse les deux champs vides pour agir à n'importe quelle profondeur. Si le minimum dépasse le maximum, l'enregistrement est bloqué.

## Scripts regex limités à un personnage

Un script regex peut appartenir à un ou plusieurs personnages précis au lieu de s'appliquer partout. Deux méthodes existent pour limiter un script à un personnage.

La première passe par l'éditeur. Active l'interrupteur **Specific Characters** (personnages précis) dans l'encadré **Apply To**, puis choisis un ou plusieurs personnages dans la grille. Quand l'interrupteur est désactivé, le script "Applies to all characters". Si tu l'actives, tu dois choisir au moins un personnage.

La seconde passe par le personnage lui-même. Ouvre un personnage, va dans l'onglet **Advanced** (avancé) et repère l'encadré intitulé **Regex Scripts** (scripts regex). Cet encadré ne liste que les scripts liés à ce personnage, et il dispose de ses propres boutons **Create regex**, d'import et d'export. Le personnage doit être enregistré avant que tu puisses lui ajouter des scripts. Si ce n'est pas le cas, l'encadré te le signale.

Ouvrir l'éditeur complet depuis cet encadré fait quitter l'éditeur de personnage. Si le personnage comporte des modifications non enregistrées, l'application t'avertit d'abord, pour éviter toute perte.

### Le réglage Scoped Regex Scripts, chat par chat

Les scripts limités à un personnage ne s'exécutent pas automatiquement dans tous les chats. Un réglage propre à chaque chat les commande. Ouvre le panneau **Chat Settings** (réglages du chat) d'un chat. Une section intitulée **Scoped Regex Scripts** (scripts regex à portée limitée) n'apparaît que si au moins un personnage de ce chat possède des scripts limités. Elle propose trois modes :

- **Disabled** (valeur par défaut) : les scripts limités à un personnage sont désactivés, et seuls les scripts globaux s'appliquent.
- **Exclusive** : chaque script limité ne modifie que les messages du personnage auquel il appartient.
- **Chat** : chaque script limité modifie tous les messages du chat.

Sous les boutons de mode, le panneau liste chaque personnage possédant des scripts limités et permet d'activer ou de désactiver chaque script pour ce chat. Ce réglage commande les scripts côté affichage. Les scripts côté prompt suivent toujours le personnage qui génère réellement la réponse.

## Importer des scripts regex depuis SillyTavern

Marinara sait lire les scripts regex intégrés à une fiche de personnage SillyTavern. À l'import d'une fiche, une section intitulée **Imported regex scripts** (scripts regex importés) propose deux choix :

- **Character only** (valeur par défaut) : les scripts restent limités à ce seul personnage.
- **Global** : les scripts rejoignent le panneau **Presets** et s'appliquent dans tous les chats.

Ce choix apparaît aussi bien dans la fenêtre d'import d'un personnage seul que dans l'import groupé **Import from SillyTavern Folder** (importer depuis un dossier SillyTavern). Les scripts intégrés dont le motif est vide, ou dont le motif échoue au contrôle de sécurité, sont ignorés à l'import. Autre option : importe un simple fichier JSON de scripts avec le bouton **Import regexes from JSON** de la section **Regexes**. Pour la marche à suivre complète, voir [Importer depuis SillyTavern](../data/importing-from-sillytavern.md).

## Sécurité et performances

Chaque motif est contrôlé avant de pouvoir être enregistré ou exécuté. Marinara bloque les motifs très susceptibles d'être lents et de figer l'application. Un motif bloqué affiche ce message : "Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns." L'enregistrement reste bloqué tant que tu ne l'as pas corrigé.

En clair, évite les formes suivantes :

- Les motifs de plus de 1000 caractères.
- Un groupe répété placé à l'intérieur d'un autre groupe répété, comme `(a+)+`.
- Deux jokers larges à la suite, comme `.*.*` ou `\s*\w*`. Un joker large est un élément du type `.*`, `\s*` ou `\w+`, capable de correspondre à une quantité illimitée de texte.
- Trois jokers larges ou plus dans un même motif, même séparés par d'autres éléments.

Une répétition simple comme `a+` ou `(a+)` ne pose pas de problème. Un seul joker large isolé, par exemple un unique `.*`, ne pose pas de problème non plus.

Même avec un motif sûr, l'application limite aussi la durée d'un remplacement sur un message un peu long. Si un script prend trop de temps sur un message, l'application saute ce script pour ce message-là uniquement et poursuit. Le script n'est pas désactivé : il retentera sa chance au message suivant. Par précaution, teste toujours un nouveau motif dans **Live Test** sur un court texte d'exemple avant de l'activer.

## Guides associés

- [Macros](../prompts/macros.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Importer depuis SillyTavern](../data/importing-from-sillytavern.md)
