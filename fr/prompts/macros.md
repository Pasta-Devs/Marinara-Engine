# Macros de prompt

Ce guide explique les macros de prompt dans Marinara Engine. Une macro est une courte balise `{{tag}}` que Marinara remplace par une valeur à jour. Cette valeur est calculée au moment où le prompt (le texte que Marinara envoie à l'IA) est construit : ton nom, la date du jour, etc. Au programme : toutes les macros intégrées, les endroits où tu peux les saisir, et les erreurs à éviter.

## Ce qu'est une macro et où elle fonctionne

Une macro est un texte littéral encadré par des doubles accolades, comme `{{user}}` ou `{{char}}`. Quand Marinara construit le texte envoyé à l'IA, il repère ces balises et remplace chacune d'elles par sa valeur du moment. Aucun interrupteur n'active les macros : tout champ qui les prend en charge les résout systématiquement.

Pour les macros intégrées, la casse n'a pas d'importance. `{{user}}` et `{{USER}}` fonctionnent donc à l'identique.

Les macros se saisissent à de nombreux endroits de l'application :

- Les champs de personnage dans l'éditeur **Character Editor** (éditeur de personnage) : Description, Personality, Backstory, Appearance, Scenario, Example Dialogue, System Prompt, Post-History Instructions, et le champ **Depth Prompt**.
- Les champs de persona dans l'éditeur **Persona Editor** (éditeur de persona) – les mêmes champs de fiche.
- Les champs Description et Content d'une entrée de lorebook.
- Les sections d'un preset de prompt dans l'éditeur **Preset Editor** (éditeur de presets).
- Les champs Find, Replace et Trim d'un script regex.
- Les modèles de prompt des agents.
- Le champ de saisie du chat. Saisis `{{roll:1d20}}` dans un message : la macro est résolue avant l'envoi.

La valeur d'une macro peut contenir une autre macro, que Marinara résout à son tour.

## Avant de commencer

Il n'y a rien à configurer. Les macros intégrées fonctionnent tout de suite, sans clé API et sans connexion supplémentaire. La clé API est le code secret qui autorise Marinara à parler à un fournisseur d'IA, mais les macros, elles, tournent en local dans Marinara.

Deux fonctions de macro dépendent malgré tout d'autres parties de l'application :

- Les variables de preset (le fourre-tout `{{NAME}}`) réclament un preset de prompt qui les définit. Voir [Variables de preset](preset-variables.md).
- La macro d'agent `{{agent::TYPE}}` n'affiche du texte qu'une fois l'agent correspondant exécuté et son résultat produit.

## Macros d'identité, de personnage et de persona

Ces macros récupèrent les noms et les champs de fiche de celui qui parle et du personnage qui répond. L'utilisateur, c'est toi (ou le persona actif). Le personnage, c'est l'IA qui répond.

| Macro | Valeur obtenue |
| --- | --- |
| `{{user}}` / `{{userName}}` | Le nom affiché du moment (ou le nom du persona). Par défaut `User` si aucun persona n'est défini. |
| `{{userNamePhonetic}}` | Le champ Phonetic name du persona, ou `{{user}}` s'il est vide. |
| `{{char}}` / `{{charName}}` | Le nom du personnage en cours. Par défaut `Character`. |
| `{{<21-character-card-ID>}}` | Syntaxe indicative pour le nom d'une autre fiche de personnage. Remplace le texte entre chevrons par l'ID exact de 21 caractères de cette fiche. |
| `{{persona-21-character-card-ID}}` | Syntaxe indicative pour le nom d'un autre persona. Remplace le texte après `persona-` par l'ID exact de 21 caractères de cette fiche afin d'en récupérer le contexte. |
| `{{charNamePhonetic}}` | Le champ Phonetic name du personnage, ou `{{char}}` s'il est vide. |
| `{{characters}}` | Tous les personnages du chat, séparés par des virgules. |
| `{{group}}` | Tous les autres personnages actifs du chat de groupe, sauf celui qui répond. Le persona ne figure pas dans cette liste de personnages. |
| `{{persona}}` | Les champs Description, Personality, Backstory, Appearance et Scenario du persona, séparés par des retours à la ligne. |
| `{{personaDescription}}` | Le champ Description du persona. |
| `{{personaPersonality}}` | Le champ Personality du persona. |
| `{{personaBackstory}}` | Le champ Backstory du persona. |
| `{{personaAppearance}}` | Le champ Appearance du persona. |
| `{{personaScenario}}` | Le champ Scenario du persona. |

Les macros de champ de personnage lisent la fiche du personnage en cours :

| Macro | Champ de la fiche de personnage |
| --- | --- |
| `{{description}}` | Description |
| `{{personality}}` | Personality |
| `{{backstory}}` | Backstory |
| `{{appearance}}` | Appearance |
| `{{scenario}}` | Scenario |
| `{{example}}` | Example Dialogue |
| `{{charSysInfo}}` | System Prompt |
| `{{charPostHistory}}` | Post-History Instructions |

Dans un chat avec un seul personnage, elles se résolvent d'après ce personnage. Dans un chat de groupe, elles se résolvent par défaut d'après le premier personnage. Pour répéter un texte pour chaque personnage, place-le dans un bloc de groupe entre crochets. Voir [Prompts conditionnels](conditional-prompts.md) pour les blocs de groupe.

`{{group}}` suit le personnage qui répond, y compris pendant les générations individuelles d'un groupe. Par exemple, si Pantalone répond dans un groupe Roleplay contenant Powers That Be, Maukie et Pantalone, `{{group}}` donne `Powers That Be, Maukie`. Une fiche de personnage reste dans cette liste même si son nom coïncide avec `{{user}}`.

Le champ Phonetic name a deux rôles. Il fixe la prononciation du nom par la synthèse vocale (Text to Speech). Il alimente aussi `{{charNamePhonetic}}` et `{{userNamePhonetic}}`. Tu le trouves à la fois dans l'éditeur **Character Editor** et dans l'éditeur **Persona Editor**.

Pour faire référence à un personnage absent du chat en cours, copie l'ID de sa fiche et place-le directement entre doubles accolades, par exemple `{{V1StGXR8_Z5jdHi6B-myT}}`. Marinara remplace la macro par le nom de la fiche et ajoute au prompt système le contexte de personnage de la fiche référencée. Les messages d'accueil et les exemples de dialogue de cette fiche sont exclus. Les lorebooks activés rattachés à cette fiche restent soumis à leurs règles habituelles de mots-clés, d'entrées **Constant**, de filtres, de probabilité et de budget de tokens.

Pour faire référence à un persona inactif, ajoute `persona-` devant l'ID copié, par exemple `{{persona-P1StGXR8_Z5jdHi6B-myT}}`. Marinara remplace la macro par le nom du persona et ajoute ses champs Description, Personality, Appearance, Backstory et Scenario aux ID Macro Cards. Les lorebooks joints suivent toujours leurs règles d'activation habituelles.

## Macros du mode Conversation

Ces quatre macros ne fonctionnent que dans le mode Conversation. Dans tous les autres modes, elles donnent toujours un résultat vide, même si le même texte de fiche ou de preset est partagé entre les modes.

| Macro | Valeur obtenue |
| --- | --- |
| `{{convo_display}}` | Le champ **Convo Display Name** du personnage, ou le nom de la fiche s'il est vide. |
| `{{char_about}}` | Le texte **About Me** du personnage (la valeur propre au chat si elle existe, sinon celle de la fiche). |
| `{{persona_about}}` | Le texte About Me du persona. |
| `{{convo_behavior}}` | Le texte **Convo Behavior** du personnage, mais seulement si son réglage d'insertion le place à cette macro. |

Ces champs se modifient dans l'onglet **Convo** de l'éditeur **Character Editor** et de l'éditeur **Persona Editor**. Pour la configuration complète, voir [Profils du mode Conversation](../conversation/profiles.md).

## Macros de placement en mode Conversation

Le mode Conversation insère automatiquement plusieurs blocs dans le prompt. Ces macros permettent à un preset de **déplacer** un bloc là où tu poses la macro. Quand tu en utilises une, Marinara affiche ce bloc à l'emplacement de la macro et **saute** son insertion automatique : le contenu n'est donc jamais dupliqué. Chaque macro possède un ou plusieurs alias, tous équivalents.

| Macro (et alias) | Ce qu'elle place |
| --- | --- |
| `{{context}}`, `{{status}}` | Le bloc de contexte ou de statut de la conversation. |
| `{{commands}}`, `{{commandList}}` | Le rappel des commandes disponibles. |
| `{{reactRules}}`, `{{emojiReact}}` | Les règles de **réaction** par emoji personnalisé. |
| `{{replyRules}}` | Les règles de **réponse** par emoji personnalisé et par sticker. |
| `{{memories}}`, `{{memoryRecall}}` | Le bloc de rappel de mémoire. |
| `{{lorebook}}`, `{{lore}}` | Les insertions de lorebook. |

Tout cela ne vaut que dans le mode Conversation. Dans une conversation à un seul personnage, placer toi-même les présentations des participants avec `{{char_about}}` / `{{persona_about}}` (voir plus haut) donne le même résultat : Marinara saute alors son bloc automatique de présentation, si bien que rien n'apparaît deux fois. Les conversations de groupe conservent le bloc automatique, car chacune de ces deux macros ne couvre qu'un seul participant et ne doit pas masquer la présentation des autres.

## Macros de contexte

Ces macros décrivent le chat en cours et la requête en cours.

| Macro | Valeur obtenue |
| --- | --- |
| `{{input}}` | Le message utilisateur le plus récent disponible pour le prompt. |
| `{{model}}` | Le nom du modèle en cours, quand un modèle est sélectionné. |
| `{{chatId}}` | L'identifiant du chat en cours. |
| `{{lastGenerationType}}` | Une étiquette indiquant pourquoi cette réponse est générée. |
| `{{idle_duration}}` | Le temps écoulé depuis la dernière activité du chat, sous forme de texte comme `8 minutes` ou `1 hour 5 minutes`. |
| `{{gameStoryboardKeyframeCount}}` | L'objectif **Keyframes per Turn** du moment en Game Mode, de 1 à 6. Par défaut `3`. |
| `{{agent::TYPE}}` | Le résultat enregistré d'un agent du type indiqué. |

La valeur de `{{lastGenerationType}}` est une simple étiquette. Parmi les valeurs observées dans l'application : `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan` et `retry_agents`. Cette liste peut s'allonger : vois-la comme des exemples, pas comme un ensemble figé.

`{{gameStoryboardKeyframeCount}}` est fourni aux prompts du GM en Game Mode, dont le **Storyboard Game Prompt** intégré. C'est un objectif narratif, pas une exigence d'un nombre exact de paragraphes. Le planificateur de storyboard renvoie quand même moins de plans quand un tour ne contient pas assez de moments visuels distincts.

La macro `{{agent::TYPE}}` insère le résultat enregistré d'un agent, c'est-à-dire d'un module qui travaille en arrière-plan et remplit par exemple un tracker de scène. Le plus simple est de passer par l'éditeur **Preset Editor** : clique sur **Add Section** (ajouter une section), ouvre le groupe **Agent Sections** et choisis un agent. Marinara crée une section qui contient déjà la bonne balise `{{agent::TYPE}}`. Cette macro est résolue en dernier, si bien que le texte d'un agent ne peut pas insérer d'autres macros dans le prompt.

## Macros d'outlet de lorebook

`{{outlet::name}}` insère le contenu des entrées de lorebook dont le champ **Position** vaut **Outlet** et dont le champ **Outlet name** correspond exactement à `name`. Les noms d'outlet (points d'insertion nommés) sont sensibles à la casse. Ainsi, `{{outlet::character_rules}}` ne correspond pas à un outlet nommé `Character_Rules`.

Les entrées d'outlet suivent l'activation normale des lorebooks. Les mots-clés, le mode Constant, la probabilité, les filtres, le timing, les limites d'entrées et les budgets de tokens décident si une entrée est active pour la génération en cours. Les entrées actives portant le même nom d'outlet sont assemblées selon leur champ **Order**, séparées par des retours à la ligne. Elles sont insérées uniquement à l'emplacement de la macro, et pas en plus à une position de lorebook classique.

Les macros d'outlet s'utilisent dans les sections de prompt des modes Conversation, Roleplay et Game. La macro fonctionne même si elle apparaît avant le marqueur de lorebook du preset, et un preset n'a pas besoin de marqueur de lorebook s'il n'utilise que des entrées d'outlet. Un outlet inconnu ou inactif donne un résultat vide. Une entrée d'outlet ne peut pas développer une autre macro d'outlet : les outlets imbriqués ne sont donc pas récursifs.

## Macros de temps

Toutes les macros de temps lisent un même instant partagé à chaque résolution : elles restent donc toujours cohérentes entre elles. Le fuseau horaire vient du navigateur.

| Macro | Valeur obtenue |
| --- | --- |
| `{{date}}` | La date du jour, au format `YYYY-MM-DD`. |
| `{{time}}` | L'heure actuelle, au format `HH:MM` sur 24 heures. |
| `{{datetime}}` / `{{isotime}}` | Un horodatage complet avec le décalage de fuseau horaire. Les deux noms font la même chose. |
| `{{weekday}}` | Le nom du jour de la semaine, par exemple `Monday`. |
| `{{timezone}}` | Le nom du fuseau horaire, par exemple `Europe/Warsaw`. |

## Macros d'aléatoire et de dés

Ces macros ajoutent du hasard dans tes prompts. Utilise la macro aléatoire (`{{random}}`) pour les nombres et les choix, et la macro de dés (`{{roll}}`) pour les jets de dés.

| Macro | Comportement |
| --- | --- |
| `{{random}}` | Un nombre entier au hasard entre 0 et 100. |
| `{{random:X:Y}}` | Un nombre entier au hasard entre X et Y, bornes comprises. |
| `{{random::A::B::C}}` | Tire une option au hasard, puis résout les macros à l'intérieur de la seule option retenue. |
| `{{random::A@2::B@0.5}}` | Un tirage aléatoire pondéré. Voir les règles de pondération ci-dessous. |
| `{{roll:XdY}}` | Le total d'un jet de dés. Par exemple, `{{roll:2d6}}` lance deux dés à six faces et additionne le résultat. |

Voici un tirage aléatoire simple que tu peux copier :

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

### Choix pondérés

Ajoute un `@number` final à une option pour régler sa probabilité. Ce nombre est un poids relatif : plus il est grand, plus l'option sort souvent.

```text
{{random::Common event@1::Rare event@0.25}}
```

Dans cet exemple, le poids total vaut 1.25, d'où les probabilités suivantes :

| Option | Poids | Probabilité |
| --- | --- | --- |
| Common event | 1 | 80 % |
| Rare event | 0.25 | 20 % |

Règles de pondération :

- Un poids absent compte pour 1.
- Les poids décimaux sont acceptés, par exemple 0.5 ou 0.01.
- Un poids de 0 conserve l'option, mais elle ne peut jamais sortir.
- Si toutes les options ont un poids de 0, la macro donne un résultat vide.
- Seul un `@number` final compte comme poids. Un `@` ailleurs, dans une adresse e-mail par exemple, reste intact.

## Variables dynamiques

Les variables permettent à une partie du prompt de stocker une valeur qu'une partie ultérieure pourra lire.

| Macro | Comportement |
| --- | --- |
| `{{setvar::name::value}}` | Stocke une valeur et ne laisse rien dans le texte. |
| `{{getvar::name}}` | Lit une valeur stockée (rien si elle n'a jamais été définie). |
| `{{addvar::name::value}}` | Additionne si les deux valeurs sont numériques ; sinon, ajoute le texte à la suite. |
| `{{addnumvar::name::value}}` | Extension Marinara qui effectue toujours une addition numérique. Une valeur absente ou invalide vaut 0 ; un dépassement est ignoré. |
| `{{incvar::name}}` | Ajoute 1 à une variable numérique et insère la nouvelle valeur. |
| `{{decvar::name}}` | Retire 1 à une variable numérique et insère la nouvelle valeur. |

Les variables se résolvent de gauche à droite pendant la construction du prompt et sont enregistrées dans le chat en cours. Une valeur définie tôt, par exemple dans une entrée de lorebook placée en premier, se relit plus loin dans le même prompt. Comme les variables locales de SillyTavern, elle persiste lors des tours suivants et après un redémarrage, sans se propager aux autres chats.

Tout `{{NAME}}` qui n'est pas une macro intégrée est traité comme une variable de preset et recherché par son nom. Si aucune variable ne porte ce nom, la balise reste dans le texte exactement telle que tu l'as écrite. Voir [Variables de preset](preset-variables.md) pour apprendre à les définir.

## Macros de mise en forme

Ces macros agissent sur le texte qui les entoure.

| Macro | Comportement |
| --- | --- |
| `{{newline}}` / `{{\n}}` | Insère un saut de ligne. |
| `{{trim}}` | Se supprime et retire les espaces autour de cet endroit. |
| `{{trimStart}}` | Retire les espaces au début du texte environnant. |
| `{{trimEnd}}` | Retire les espaces à la fin du texte environnant. |
| `{{uppercase}}...{{/uppercase}}` | Met le texte encadré EN MAJUSCULES. |
| `{{lowercase}}...{{/lowercase}}` | Met le texte encadré en minuscules. |
| `{{noop}}` | Disparaît du résultat. Pratique pour réserver une place sans effet pendant que tu modifies le texte. |
| `{{// comment}}` | Une note d'auteur qui disparaît du résultat. |
| `{{banned "text"}}` | Disparaît du résultat. Ne filtre et ne bloque rien du tout. |

## Afficher des doubles accolades telles quelles

Il n'existe aucun caractère d'échappement pour les macros. Pour que des doubles accolades restent dans le texte, choisis un nom que Marinara ne connaît pas. Tout `{{name}}` inconnu reste tel quel, tant qu'aucune variable de preset ne porte ce nom. S'il te faut une note privée qui n'atteint jamais l'IA, écris plutôt `{{// like this}}`.

## La référence des macros et /macros

Chaque champ compatible avec les macros porte deux petits boutons dans son coin :

- Le bouton **Expand editor** (agrandir l'éditeur) ouvre une fenêtre d'édition plus grande pour ce champ.
- Le bouton **Macro reference** (référence des macros) ouvre une fenêtre intitulée **Macro reference** qui liste toutes les macros intégrées par catégorie, chacune avec sa syntaxe exacte. Cette liste est générée à partir de la source utilisée par le moteur : elle est donc toujours juste.

Autre option : saisir `/macros` dans le champ de saisie du chat (la forme courte `/macro` marche aussi). La liste complète des macros s'affiche directement dans le chat, en guise de pense-bête.

Les blocs conditionnels peuvent combiner des comparaisons avec `||` (OU), `&&` (ET) et des parenthèses. Les listes d'égalité acceptent la forme compacte `{{#if character == "Maukie" || "Pantalone"}}`. Voir [Prompts conditionnels](conditional-prompts.md) pour la priorité des opérateurs, des exemples en chat de groupe et la liste complète.

## Erreurs fréquentes

- N'écris pas de variables dans un bloc `{{random::...}}`. Un `{{setvar}}` placé dans une option aléatoire s'exécute pour toutes les options avant le tirage, pas seulement pour celle qui sort.
- N'utilise pas une variable locale comme une variable globale. Les valeurs définies avec `{{setvar}}` persistent uniquement dans le chat en cours ; chaque autre chat possède sa propre valeur.
- `{{prompt}}` n'est pas une macro. Si ton message se réduit à `{{prompt}}`, Marinara ouvre la fenêtre **Peek Prompt** au lieu de l'envoyer. Voir [Peek Prompt](../chats/peek-prompt.md).
- Les Custom Tools n'utilisent pas le texte `{{macro}}`. Ne colle pas `{{roll:1d20}}` dans un champ d'outil en espérant qu'il se résolve.
- Le modèle de prompt **Impersonate** n'accepte que quelques valeurs de substitution, et non la liste complète des macros. Leurs noms diffèrent aussi : une macro qui fonctionne dans une fiche peut donc rester inerte ici.
- Un résultat de macro très volumineux ou très imbriqué est tronqué en silence. Aucune erreur ne s'affiche : garde donc des expansions de macro raisonnables.

## Guides associés

- [Prompts conditionnels](conditional-prompts.md)
- [Variables de preset](preset-variables.md)
- [Éditeur de presets et gestionnaire de prompts](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Profils du mode Conversation](../conversation/profiles.md)
