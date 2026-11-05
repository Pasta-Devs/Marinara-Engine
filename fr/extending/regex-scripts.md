# Scripts regex

Un script regex est une règle de recherche et de remplacement qui réécrit automatiquement le texte du chat. Utilises-en un pour nettoyer une réponse de l'IA, remodeler ton propre message ou modifier le texte que reçoit le modèle. Aucune connaissance en programmation n'est nécessaire pour t'en servir.

Regex est l'abréviation de "regular expression" (expression régulière), un motif de recherche qui repère le texte correspondant à une règle. Tu définis le motif une seule fois, et il s'applique à chaque message correspondant.

Exemple : certains modèles entourent les actions d'astérisques.

```text
*She smiles* Hello there.
```

Copie ce motif à l'identique : `\*([^*]+)\*`. Remplace-le par `$1` : les astérisques disparaissent et le texte qu'elles encadrent reste :

```text
She smiles Hello there.
```

`$1` signifie "le texte capturé par la première paire de parenthèses". Autres usages courants : effacer les remarques hors personnage entre parenthèses, censurer un mot et corriger les manies de mise en forme d'un personnage.

## Créer un script regex

Tes scripts globaux se trouvent dans le panneau **Presets**, dans la section **Regexes** (regex). Ouvre-le avec le bouton **Presets** de la barre du haut.

### Création d'un script regex

1. Ouvre **Presets** et repère **Regexes**.
2. Clique sur **Create regex** (créer une regex). L'éditeur complet s'ouvre.
3. Saisis un nom en haut. Un nouveau script s'appelle "New Regex Script".
4. Dans **Find Pattern (Regex)** (motif recherché), saisis `\*([^*]+)\*` (voir [Champs de l'éditeur](#editor-fields)).
5. Dans **Replace With** (texte de remplacement), saisis `$1`.
6. Dans **Apply To** (appliquer à), laisse **AI Output** sélectionné. Le mode d'application par défaut, **Only Display**, est le choix sûr (voir [Choisir où un script s'applique](#choose-where-a-script-runs)).
7. Colle `*She smiles* Hello there.` dans **Live Test** (test en direct). **Result:** devrait afficher `She smiles Hello there.`
8. Clique sur **Save** (enregistrer). Une mention verte **Saved** apparaît un instant.
9. Vérifie dans un chat : quand une réponse de l'IA contient du texte entre astérisques, les astérisques ne s'affichent plus.

Si ça n'a pas marché : une erreur rouge sous **Find Pattern (Regex)** bloque l'enregistrement. Le motif est invalide ou dangereux ; voir [Sécurité et performances](#safety-and-performance).

### Gérer tes scripts

Chaque ligne de la liste **Regexes** affiche le nom du script, une étiquette **AI** ou **User**, le motif sous la forme `/pattern/flags`, un interrupteur marche/arrêt (effet immédiat), **Edit regex** (modifier la regex, crayon) et **Delete regex** (supprimer la regex, corbeille). Tant qu'il n'y a aucun script, la liste affiche "No regexes yet". Fais glisser une ligne par sa poignée pour changer l'ordre d'exécution.

L'en-tête de la section comporte trois boutons-icônes : **Create regex**, **Import regexes from JSON** (importer des regex depuis un fichier JSON) et **Export regexes to JSON** (exporter les regex vers un fichier JSON), qui enregistre tous tes scripts globaux dans un seul fichier. Les scripts liés à un seul personnage sont rangés à part ; voir [Limiter un script à un personnage](#limit-a-script-to-one-character).

<a id="editor-fields"></a>

## Champs de l'éditeur

### Find Pattern (Regex)

Le motif de recherche. N'écris que le motif, sans barre oblique au début ni à la fin. Le texte indicatif montre un exemple : `\*([^*]+)\*`.

### Replace With

Le texte qui remplace chaque correspondance. Laisse-le vide pour supprimer la correspondance. Réutilise le texte capturé avec `$1`, `$2`, et ainsi de suite. Ces changements de casse fonctionnent devant une capture :

| Écris | Résultat |
| --- | --- |
| `\u$1` | Met la première lettre de la capture en majuscule |
| `\U$1\E` | Met toute la capture en majuscules |
| `\l$1` | Met la première lettre de la capture en minuscule |
| `\L$1\E` | Met toute la capture en minuscules |

Une barre oblique inverse littérale, comme dans un chemin Windows du type `C:\Users`, est conservée telle quelle.

### Regex Flags

Des boutons à activer ou désactiver, qui changent la façon dont le motif trouve les correspondances. Un nouveau script démarre avec `g` et `i` activés.

| Drapeau | Signification |
| --- | --- |
| `g` | Global : remplace toutes les correspondances, pas seulement la première |
| `i` | Insensible à la casse |
| `m` | Multiline : `^` et `$` correspondent aux sauts de ligne |
| `s` | dotAll : `.` correspond aussi aux caractères de saut de ligne |
| `u`, `y`, `d` | Unicode, sticky et match indices, pour des cas particuliers |

### Trim Strings

Une liste facultative de chaînes simples retirées une fois le remplacement effectué. Clique sur **Add trim string** (ajouter une chaîne à retirer) pour ajouter une ligne, et sur le bouton **X** pour en enlever une. Sers-t'en pour un texte fixe plus simple à taper qu'à décrire par un motif.

### Live Test

Colle un texte d'exemple : le résultat s'affiche sous **Result:**. Live Test ne vérifie que la recherche, le remplacement et le retrait de chaînes. Le placement, l'état marche/arrêt, la portée par personnage et la profondeur sont évalués dans un vrai chat. Tu peux utiliser des macros comme `{{user}}` et `{{char}}` dans le motif, le remplacement et les chaînes à retirer. Dans Live Test, elles prennent des valeurs d'exemple. Voir [Macros](../prompts/macros.md).

<a id="choose-where-a-script-runs"></a>

## Choisir où un script s'applique

### Apply To

**Apply To** détermine quel côté du chat le script surveille. Garde au moins une option sélectionnée. Tu peux choisir les deux.

- **AI Output** : s'applique aux réponses de l'IA avant leur affichage.
- **User Input** : s'applique à tes messages avant leur envoi.

### Apply Mode

**Apply Mode** (mode d'application) se trouve dans **Advanced Options** (options avancées). Il détermine ce que la réécriture modifie. Un nouveau script démarre sur **Only Display**.

- **Only Display** : change ce que tu vois dans le chat. Le message enregistré et le contexte que le modèle reçoit ensuite restent les mêmes. C'est le plus sûr pour soigner l'apparence d'une réponse.
- **Only Prompt** : change ce que reçoit le modèle, que montre aussi l'aperçu du prompt. L'affichage et le message enregistré restent les mêmes. Sers-t'en pour retirer quelque chose que le modèle n'arrête pas de recopier.
- **Both** : change l'affichage et le texte du prompt.

Pour tes propres messages, un script **User Input** réglé sur **Only Display** ou **Both** réécrit le message juste avant son envoi. C'est le message enregistré et envoyé qui change, pas seulement son apparence. Il n'existe pas de mode purement visuel pour les messages sortants.

### Execution Order et Depth Range

Les deux se trouvent dans **Advanced Options**.

- **Execution Order** (ordre d'exécution) est un nombre. Les plus petits nombres passent en premier, ce qui compte quand plusieurs scripts peuvent correspondre au même texte. Un nouveau script démarre à 0, et l'application attribue le prochain nombre libre à l'enregistrement. Tu peux aussi faire glisser les lignes dans la liste **Regexes**.
- **Depth Range** (plage de profondeur) limite jusqu'où un script remonte, avec **Min** et **Max**. Le message le plus récent est à la profondeur 0, le précédent à la profondeur 1, et ainsi de suite. Laisse les deux vides pour agir à n'importe quelle profondeur. L'enregistrement est bloqué si **Min** est supérieur à **Max**.

### Chats de groupe

Ceci s'applique à **Only Prompt** et **Both** dans un chat **Roleplay** en mode de groupe **Individual** (réponses individuelles).

- Le placement suit le personnage qui reçoit le prompt.
- Tes messages et ceux des autres personnages comptent comme **User Input**.
- Les propres réponses du personnage qui répond comptent comme **AI Output**, y compris ses réponses précédentes du même tour de groupe.
- Les limites par personnage décident toujours qui reçoit le prompt réécrit. Un narrateur exclu d'un script qui masque les pensées conserve les pensées d'origine.

<a id="limit-a-script-to-one-character"></a>

## Limiter un script à un personnage

Un script peut appartenir à des personnages précis au lieu de s'appliquer partout. Il y a deux façons de faire.

- Dans l'éditeur, active **Specific Characters** (personnages précis) dans l'encadré **Apply To** et choisis un ou plusieurs personnages. Quand l'interrupteur est désactivé, le script "Applies to all characters". Quand il est activé, choisis au moins un personnage.
- Depuis le personnage : ouvre le personnage, va dans l'onglet **Advanced** (avancé) et repère l'encadré **Regex Scripts** (scripts regex). Il ne liste que les scripts de ce personnage et dispose de ses propres boutons **Create regex**, d'import et d'export. Enregistre d'abord le personnage, sinon l'encadré indique qu'il ne peut pas encore ajouter de scripts.

Ouvrir l'éditeur complet depuis cet encadré fait quitter le Character Editor (éditeur de personnage). Si le personnage comporte des modifications non enregistrées, l'application t'avertit d'abord.

<a id="the-per-chat-scoped-regex-scripts-setting"></a>

### Le réglage Scoped Regex Scripts, chat par chat

Les scripts limités à un personnage ne s'exécutent pas d'eux-mêmes dans tous les chats. Un réglage propre à chaque chat les commande. Ouvre **Chat Settings** (réglages du chat). La section **Scoped Regex Scripts** (scripts regex à portée limitée) n'apparaît que si au moins un personnage de ce chat possède des scripts limités.

| Mode | Ce qui se passe |
| --- | --- |
| **Disabled** (par défaut) | Les scripts limités sont désactivés. Seuls les scripts globaux s'appliquent. |
| **Exclusive** | Chaque script limité ne modifie que les messages de son propre personnage. |
| **Chat** | Chaque script limité modifie tous les messages du chat. |

**Use preset default** (utiliser la valeur par défaut du preset) suit le réglage **Scoped regex default** (mode par défaut des regex à portée limitée) du preset de prompt. Choisir un mode prend le pas sur ce réglage pour ce chat. Pour démarrer les nouveaux chats avec un mode, utilise l'une de ces méthodes :

- Définis-le comme valeur par défaut du preset.
- Enregistre-le dans ton [profil de réglages par défaut](../chats/settings-profiles.md#choosing-the-default-profile).
- Choisis-le, puis clique sur l'étoile de disposition favorite près de **Reset View** (réinitialiser la vue). Voir [Choisir une disposition pour les nouveaux chats](../chats/chat-settings.md#choosing-a-layout-for-new-chats).

Sous les modes, le panneau liste les scripts limités de chaque personnage, avec un interrupteur pour chacun. Cet interrupteur appartient au script lui-même : il le modifie donc dans tous les chats. Le mode commande les scripts côté affichage. Les scripts côté prompt suivent toujours le personnage qui génère la réponse.

## Importer et remplacer des scripts

### Importer depuis SillyTavern

Marinara lit les scripts regex intégrés à une fiche de personnage SillyTavern. Quand tu importes une fiche, une section **Imported regex scripts** (scripts regex importés) propose deux choix :

- **Character only** (par défaut) : les scripts restent limités à ce personnage.
- **Global** : les scripts sont ajoutés à **Presets** et s'appliquent dans tous les chats.

Ce choix apparaît dans la fenêtre d'import d'un personnage seul et dans l'import groupé **Import from SillyTavern Folder** (importer depuis un dossier SillyTavern). Les scripts dont le motif est vide, ou dont le motif échoue au contrôle de sécurité, sont ignorés. Pour importer un simple fichier JSON de scripts, utilise **Import regexes from JSON** dans **Regexes**. Voir [Importer depuis SillyTavern](../data/importing-from-sillytavern.md).

### Remplacer un ensemble de scripts regex

1. Dans **Presets → Regexes**, choisis **Select regex scripts** (sélectionner des scripts regex).
2. Coche les entrées de l'ancien ensemble, ou choisis **Select all regex scripts** (sélectionner tous les scripts regex).
3. Utilise **Export** (exporter) ou **Delete** (supprimer) dans la barre d'actions. La suppression demande une seule confirmation et ne peut pas être annulée.
4. Importe l'ensemble à jour.

Les suppressions qui échouent restent sélectionnées pour que tu puisses réessayer. Les scripts non sélectionnés restent en place. Les affectations aux presets restent disponibles dans l'éditeur regex.

<a id="safety-and-performance"></a>

## Sécurité et performances

Chaque motif est contrôlé avant de pouvoir être enregistré ou exécuté. Un motif susceptible d'être lent et de figer l'application est bloqué avec ce message, et l'enregistrement reste bloqué tant que tu ne l'as pas corrigé :

```text
Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns.
```

Si tu vois ce message, raccourcis et simplifie le motif. Évite ces formes :

- Les motifs de plus de 1 000 caractères.
- Un groupe répété à l'intérieur d'un autre groupe répété, comme `(a+)+`.
- Deux jokers larges à la suite, comme `.*.*` ou `\s*\w*`. Un joker large est un élément comme `.*`, `\s*` ou `\w+`, capable de correspondre à une quantité illimitée de texte.
- Trois jokers larges ou plus n'importe où dans un même motif, même séparés par d'autres éléments.

Une répétition simple comme `a+` ou `(a+)`, ou un seul joker large comme un unique `.*`, ne pose pas de problème.

Même un motif sûr a une limite de durée par remplacement sur un long message. Si un script prend trop de temps sur un message, l'application saute ce script pour ce message uniquement. Le script reste activé et réessaie au message suivant. Teste d'abord un nouveau motif dans **Live Test** sur un court texte d'exemple.

## Guides associés

- [Macros](../prompts/macros.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Importer depuis SillyTavern](../data/importing-from-sillytavern.md)
