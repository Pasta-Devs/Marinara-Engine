# Les entrées de lorebook : mots-clés, position et déclenchement

Une entrée, c'est un fait dans un lorebook (un recueil de faits sur ton univers), accompagné des règles qui décident quand Marinara l'ajoute au prompt, le texte que Marinara envoie à l'IA. Ce guide explique comment ajouter des entrées, choisir les clés et les types d'entrée, décider où une entrée se place, et régler le déclenchement.

Avant de commencer : crée un lorebook et ouvre-le. Voir [Vue d'ensemble des lorebooks](overview.md).

## L'onglet Entries

Ouvre un lorebook depuis le panneau **Lorebooks**. L'éditeur a deux onglets, **Overview** (vue d'ensemble) et **Entries** (entrées). Clique sur **Entries** pour afficher la liste. Le badge de l'onglet indique combien d'entrées tu as.

La barre d'outils propose ces contrôles.

- **Search entries…** filtre par nom, par clés ou par contenu.
- Le menu de tri propose **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Fired ↓**, **Newest** et **Oldest**. Les options ↓ trient du plus grand au plus petit.
- **Select** (sélectionner) active la sélection multiple, pour copier, déplacer ou supprimer plusieurs entrées.
- **Add Folder** (ajouter un dossier) crée un dossier (voir [Les dossiers d'entrées](#entry-folders)).
- **Add Entry** (ajouter une entrée) ajoute une entrée vide en haut de la liste.

Sous la barre d'outils, une ligne affiche le nombre d'entrées, le nombre de dossiers et le total estimé, en tokens (de petits morceaux de texte), du contenu de toutes les entrées.

## Ajouter et modifier une entrée

1. Clique sur **Add Entry**. Une nouvelle ligne apparaît.
2. Saisis un nom dans la ligne. Chaque entrée doit en avoir un. Le nom te sert à toi et à la recherche, pas à l'IA.
3. Clique sur la ligne, ou sur sa flèche. Un panneau s'ouvre sous la ligne avec tous les champs.
4. Saisis une clé dans **Primary Keys** (clés principales) et appuie sur <kbd>Enter</kbd>. Écris ensuite le texte destiné à l'IA dans **Content** (contenu). Voir [Contenu et clés](#content-and-keys).

Les modifications s'enregistrent d'elles-mêmes. Le tiroir affiche **Autosaving…**, puis **Saving…**, puis **Saved automatically**. Si un enregistrement échoue, ton texte reste en place et Marinara réessaie à ta modification suivante.

Pour copier une entrée, clique sur **Duplicate entry** (dupliquer l'entrée) sur sa ligne. Pour la supprimer, clique sur **Delete entry** (supprimer l'entrée) et confirme. Sur un ordinateur, ces boutons apparaissent quand tu passes le pointeur sur la ligne.

<a id="content-and-keys"></a>

### Contenu et clés

| Champ | Ce que c'est |
| --- | --- |
| **Primary Keys** | Les mots qui déclenchent l'entrée. Saisis une clé et appuie sur <kbd>Enter</kbd> pour l'ajouter. Une seule correspondance suffit à activer une entrée **Normal**. |
| **Content** | Le texte envoyé à l'IA. Écris un simple fait. Il peut utiliser des [macros](../prompts/macros.md), des espaces réservés que Marinara remplace par du vrai texte, et une estimation en tokens s'affiche sous le champ. |
| **Secondary Keys** (clés secondaires) | Des clés supplémentaires, utilisées seulement par les entrées **Selective**. |
| **Description** | Un court résumé que seul l'agent **Knowledge Router** lit. Il n'est jamais envoyé au modèle principal. Voir [Sources de connaissances](../agents/knowledge-sources.md). |

Une liste de plus de 10 clés n'affiche que les 10 premières. Clique sur **Show N more** (en afficher N de plus) pour voir le reste, et sur **Collapse** (replier) pour les masquer. Les clés masquées continuent de correspondre.

Par exemple, une entrée nommée `Silverhaven`, avec les clés `Silverhaven` et `the capital` et le contenu `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.`, parvient à l'IA dès que l'une des deux clés apparaît dans le chat récent.

### Règles de correspondance

Par défaut, une clé correspond dès qu'elle apparaît quelque part dans le chat récent, sans distinction de majuscules ni de minuscules. Trois contrôles modifient ce comportement.

- **Whole Words** (mots entiers ; panneau de l'entrée, désactivé par défaut) : la clé doit être un mot entier. `Ash` correspond à "Ash", mais pas à "cash".
- **Case Sensitive** (sensible à la casse ; panneau de l'entrée, désactivé par défaut) : les majuscules doivent correspondre. `IT` correspond à "IT", mais pas à "it".
- **Regex** (une icône sur la ligne, avec l'infobulle **Enable regex key matching**, désactivée par défaut) : traite chaque clé comme une expression régulière, c'est-à-dire un motif de recherche dans le texte. L'icône devient orange quand l'option est active.

N'utilise **Regex** que si tu connais les expressions régulières. Chaque motif s'exécute avec un court délai limite, et un motif trop long à s'exécuter ne correspond à rien : garde donc des motifs simples. Par exemple, `\bVlad(?:'s)?\b` correspond à "Vlad" et à "Vlad's".

## Choisir un type d'entrée

Clique sur le point coloré de la ligne pour ouvrir le menu des types.

- **Normal** (point vert, le type par défaut) : s'active quand une clé principale correspond. Utilise-le pour la plupart des entrées : personnes, lieux, objets. Donne à chacune trois à huit clés précises.
- **Constant** (point jaune) : s'active à chaque fois que le lorebook est actif, sans aucune clé. Utilise-le pour les quelques faits qui doivent toujours être présents, comme l'année ou le ton. Le déclenchement, la probabilité et les filtres s'appliquent toujours.
- **Selective** (point rouge) : s'active quand une clé principale correspond et que la logique des clés secondaires passe. Utilise-le quand une clé courante partirait dans la mauvaise scène.

Chaque entrée **Constant** coûte des tokens à chaque message : garde-en peu.

Pour une entrée **Selective**, ajoute des **Secondary Keys** et choisis un bouton **Logic** (logique).

| Logique | L'entrée part quand |
| --- | --- |
| **AND Any** | Au moins une clé secondaire apparaît aussi. |
| **AND All** | Toutes les clés secondaires apparaissent aussi. |
| **NOT Any** | Aucune clé secondaire n'apparaît. |
| **NOT All** | Les clés secondaires n'apparaissent pas toutes ensemble. |

Par exemple, la clé principale `king` avec la clé secondaire `Silverhaven` et **AND Any** ne part que si le chat mentionne les deux.

Si ça n'a pas marché : une entrée **Normal** sans clé n'a rien à faire correspondre. Ajoute des clés, ou passe-la en **Constant**. Une entrée sans clé peut encore être retrouvée par le sens, mais seulement si la [recherche sémantique](semantic-search.md) est complètement configurée.

## Position, Depth et Order

Ces contrôles décident de l'endroit où une entrée activée atterrit dans le prompt. Sur un écran large, ils se trouvent sur la ligne compacte. Sur un écran étroit, touche le bouton **Entry quick controls** (contrôles rapides de l'entrée) de la ligne.

| Contrôle | Ce qu'il fait |
| --- | --- |
| **Position** | L'endroit où va l'entrée. La valeur par défaut est **Before character definitions**. |
| **Before character definitions** | Avant la fiche de personnage dans le prompt. Étiquette de la ligne : **↑Char**. |
| **After character definitions** | Après la fiche de personnage. Étiquette de la ligne : **↓Char**. |
| **@ Depth** | À l'intérieur de l'historique du chat. Étiquette de la ligne : **@Depth**. |
| **Outlet** | Nulle part automatiquement (voir plus bas). |
| **Depth** (profondeur) | N'apparaît que pour **@ Depth**. Le nombre de messages à remonter, depuis le dernier, pour placer l'entrée. 4 par défaut. |
| **Order** (ordre) | L'ordre quand plusieurs entrées s'activent. Un nombre plus petit passe en premier et survit à la coupe quand le budget est serré. 100 par défaut. |

**Role** (rôle) se trouve dans le panneau déplié de l'entrée, pas dans les contrôles rapides. Il étiquette le texte inséré **System**, **User** ou **Assistant**, ne compte que pour **@ Depth**, et vaut **System** par défaut.

Laisse ces contrôles sur leurs valeurs par défaut, sauf si une entrée a besoin de plus. Utilise **@ Depth** avec parcimonie. Le texte atterrit entre les messages récents, comme une interruption : réserve-le à une règle que le modèle oublie sans cesse ou à un fait qui vient de changer. Par exemple, "The tavern is now on fire." en **@ Depth** 1.

### Outlet

Une entrée **Outlet** n'apparaît qu'à l'endroit où tu places une macro.

1. Règle **Position** sur **Outlet**. Un champ **Outlet name** (nom de l'outlet) apparaît.
2. Saisis un nom exact, sensible à la casse, par exemple `character_rules`.
3. Place `{{outlet::character_rules}}` dans une section de prompt de ton [preset](../prompts/presets.md), un modèle de prompt enregistré.

Les entrées qui partagent un même nom sont réunies dans l'ordre défini par **Order**, séparées par des sauts de ligne. Les macros outlet fonctionnent dans les sections de prompt des chats Conversation, Roleplay et Game. Seules les entrées activées pour cette réponse apparaissent. Elles suivent toujours les clés, la probabilité, les filtres, le déclenchement, **Entry Limit** (limite d'entrées) et **Token Budget** (budget de tokens). Sans entrée active, la macro n'ajoute rien. Une entrée Outlet ne peut pas appeler une autre macro outlet. Pour la macro, voir [les macros](../prompts/macros.md).

## Probabilité et déclenchement

**Probability** (probabilité) est la chance qu'une entrée parte quand ses clés correspondent. La valeur par défaut est 100 %. Règle-la sur 25 % pour une chance sur quatre à chaque fois.

Les champs **Timing** (déclenchement) règlent le comportement sur plusieurs messages. Au départ, les quatre ne sont pas définis, c'est-à-dire désactivés.

| Champ | Ce qu'il fait | Exemple |
| --- | --- | --- |
| **Sticky** | Après son déclenchement, l'entrée reste active pendant ce nombre de messages supplémentaires, même sans correspondance de clé. | Un secret révélé, réglé sur 3, reste présent pendant trois messages. |
| **Cooldown** | Après son déclenchement, elle attend ce nombre de messages avant de pouvoir repartir. | Un présage réglé sur 5 part au maximum une fois tous les cinq messages. |
| **Delay** | Elle ne peut pas partir avant ce nombre de messages dans le chat. | Un rebondissement réglé sur 20 reste caché au début. |
| **Ephemeral** | Elle se désactive d'elle-même après ce nombre d'activations. 0 signifie illimité. | Une note d'introduction réglée sur 1 part une seule fois. |

**Sticky**, **Cooldown** et **Delay** comptent des messages. **Ephemeral** compte des activations.

<a id="decision-activation"></a>

## Activation par Decision

Le champ **Decision** (décision) laisse ton modèle de décision, un petit modèle qui répond à des questions par oui ou par non, déterminer si une entrée s'applique. Écris un énoncé sur le chat récent, comme `In the latest message, a dragon is physically present`, et choisis un mode.

| Mode | Effet |
| --- | --- |
| **Off** (désactivé) | L'entrée s'active normalement. C'est la valeur par défaut. |
| **Require** (exiger) | L'entrée s'active normalement, et seulement si l'énoncé est aussi vrai. Cela filtre les mentions passagères. |
| **Trigger** (déclencher) | L'énoncé est une autre façon d'activer l'entrée, même sans clé présente. Cela détecte les reformulations et les situations. |

Tu peux utiliser des macros comme `{{user}}` et `{{char}}` dans l'énoncé.

Avant de commencer : choisis un modèle de décision sous **Decision model** (modèle de décision) dans le panneau **Connections** (Connexions). Sans modèle de décision, ou sans réponse, l'énoncé compte comme non. L'éditeur t'avertit quand aucun n'est défini.

- **Require** n'admet alors jamais de nouvelle entrée, même si un maintien **Sticky** existant peut en garder une active.
- **Trigger** n'ajoute aucune voie, et l'entrée peut toujours s'activer par ses clés.

Donne aussi une voie ordinaire aux entrées importantes, et n'utilise **Require** que pour filtrer du lore facultatif.

**Require** ne vérifie qu'une entrée déjà admissible par ses clés, une correspondance sémantique, **Constant** ou un lieu de carte, et l'entrée ne passe alors que si l'énoncé est aussi vrai. Sur une entrée **Constant**, il rend l'entrée contextuelle, par exemple des règles de combat avec `A fight is happening in the latest message`. Il n'analyse pas chaque entrée inutilisée.

Les énoncés de décision ajoutent des requêtes au modèle et partagent la limite **Decision statements per turn** (énoncés de décision par tour). Pour les conseils de formulation, les limites, le coût et la réutilisation des réponses, voir [Rédiger les énoncés](../prompts/conditional-prompts.md#writing-statements), [Limites et coût](../prompts/conditional-prompts.md#limits-and-cost) et [Réutilisation des réponses](../prompts/conditional-prompts.md#answer-reuse). Pour la configuration du modèle, voir [Modèles de décision](../connections/decision-models.md).

Plus de détails :

- Une entrée **sticky** n'est pas interrogée à nouveau tant que son maintien dure, et une entrée en cooldown n'est pas interrogée du tout.
- La liste des lorebooks actifs affiche **decision** pour une entrée activée par un énoncé **Trigger**.
- **Peek Prompt** n'interroge jamais. Il affiche les réponses dont le tour dispose déjà.
- L'activation par décision ne s'applique qu'aux tours du chat. La configuration Game et les analyses que les agents font pour eux-mêmes interprètent les entrées de décision comme non.
- Un `{{#if decision:"..."}}` dans le contenu de l'entrée, c'est autre chose. Il raccourcit le texte d'une entrée déjà activée.

## Groupes, filtres et autres options

Le tiroir déplié contient d'autres champs.

| Champ | Ce qu'il fait |
| --- | --- |
| **Group** (groupe) | Les entrées d'un même groupe s'excluent mutuellement. Une seule s'active par réponse. Utilise-le pour des variantes, comme trois entrées "météo du jour". Associe-le à une **Probability** basse pour que les rumeurs restent occasionnelles. |
| **Tag** | Une étiquette libre, pour ton propre classement. Elle n'influence pas l'activation. |
| **Locked** (verrouillé) | Empêche l'agent **Lorebook Keeper** de modifier cette entrée. Voir [Référence des agents téléchargeables](../agents/built-in-agents.md). |
| **No Vector** | Exclut l'entrée de la recherche sémantique. Voir [Recherche sémantique pour les lorebooks](semantic-search.md). |
| **Recursion** (récursivité) | Permet au contenu de cette entrée de déclencher d'autres entrées. Désactivé par défaut. Voir [Budgets de tokens et récursivité des lorebooks](token-budgets.md). |

La section **Context filters & matching sources** (filtres de contexte et sources analysées) limite une entrée à certains personnages, à certains tags de personnage ou à certains types de génération. Elle permet aussi d'analyser des champs supplémentaires de la fiche, comme la description du personnage, à la recherche des clés de l'entrée. Dans un chat de groupe en mode **Individual** (individuel), chaque réponse ne compte que le personnage qui l'écrit : un filtre de personnage tient donc l'entrée à l'écart des réponses des autres personnages. Dans une réponse **Merged (Narrator)** (fusionné, avec narrateur), tous les personnages du chat comptent : l'entrée reste donc présente si l'un des personnages filtrés est dans le chat. Sers-t'en pour les secrets qu'un seul personnage connaît.

## Choisir les réglages d'un fait

Demande-toi quand l'IA doit voir le fait, puis sers-toi de ce tableau.

| Le fait | Réglage |
| --- | --- |
| Toujours vrai | **Constant**. Garde-en peu. |
| Ne compte que lorsqu'il est nommé | **Normal** avec des clés précises, comme `Castle Dracul`, `the castle`, `the fortress`. |
| Sa clé est un mot courant, comme `king` ou `home` | **Whole Words**, ou **Selective** avec des clés secondaires. |
| Important mais rarement nommé | **Normal** avec la [recherche sémantique](semantic-search.md), ou des clés plus larges. |
| Plusieurs versions qui ne doivent pas apparaître ensemble | Le même **Group**. |
| Une règle que le modèle oublie en pleine scène | **@ Depth**, entre 1 et 4 environ. |

Les habitudes qui gardent un lorebook léger :

- Utilise des clés précises. Une clé comme `he` ou `the city` correspond à presque tous les messages et gaspille le budget.
- Remplis **Description** sur chaque entrée que tu comptes faire router par le **Knowledge Router**. Il lit la description, pas le contenu.
- Construis les grands univers en arbre. Ajoute une entrée pivot pour un ensemble, par exemple une entrée The Empire qui liste ses membres, à côté d'une entrée pour chaque membre.
- Laisse **Recursion** désactivé sur les pivots. Sinon, nommer l'ensemble tire d'un coup l'entrée complète de chaque membre dans le prompt.

Prends par exemple la règle qui dit comment le méchant peut être tué, un fait que l'IA a tendance à oublier. Passe l'entrée en **Selective** avec **AND Any**, **Whole Words** activé et **Order** 10. Utilise les clés principales `weakness`, `kill`, `destroy`, `stake` et les clés secondaires `Vlad`, `the count`. Les clés secondaires la gardent muette quand l'équipe tue un loup. **Whole Words** empêche `stake` de correspondre à "mistake". L'ordre bas lui évite d'être coupée dans une scène chargée.

L'endroit où vit un lorebook décide quels chats le voient. Pour les lorebooks globaux, liés et intégrés, voir [Vue d'ensemble des lorebooks](overview.md) et [Lier des lorebooks à des personnages et à des personas](linking-to-characters.md).

## Les macros dans le contenu d'une entrée

**Content** est développé comme n'importe quel autre texte de prompt avant d'être envoyé. Les macros utiles :

- `{{char}}` et `{{user}}` donnent les noms, pour qu'une entrée partagée se lise bien dans n'importe quel chat.
- `{{roll:1d6}}` lance un dé. `{{setvar::mood::angry}}` enregistre une valeur pour ce chat, et `{{getvar::mood}}` la relit.
- `{{random::a::b::c}}` tire une option au hasard. Ajoute des poids, comme dans `{{random::common@3::rare@1}}`. Associe-le à une **Probability** basse pour faire tenir toute une table de rencontres dans une seule entrée.
- `{{include::Entry name}}` insère le texte d'une autre entrée du même lorebook, même désactivée. Voir [Macro d'inclusion de lorebook](../prompts/macros.md#lorebook-include-macro).
- `{{// note}}` est un commentaire. Il est retiré avant que l'IA le voie, et avant les analyses de récursivité : il ne peut donc jamais rien déclencher.

Pour la liste complète, voir [Macros de prompt](../prompts/macros.md).

Quand **Recursive** (récursif) est activé, Marinara réanalyse le contenu développé des entrées activées. Le texte produit par une macro peut déclencher d'autres entrées.

## L'outil Keyword test

Le panneau **Keyword test** (test de mots-clés), en haut de l'onglet **Entries**, vérifie tes clés sans chat.

1. Déplie **Keyword test**.
2. Colle un paragraphe d'exemple ou quelques messages dans le champ.

Les entrées qui correspondraient reçoivent un liseré vert et une pastille **Would activate**. Les entrées **Constant** reçoivent une pastille **Always active**. Une ligne de décompte indique combien d'entrées activées se déclencheraient. L'interrupteur **Include other lorebooks** (inclure les autres lorebooks) vérifie aussi les entrées activées de tes autres lorebooks.

Le test ignore le déclenchement, la probabilité, les filtres de personnage et de persona, et la correspondance par le sens : un vrai chat peut donc encore différer.

<a id="entry-folders"></a>

## Les dossiers d'entrées

Les dossiers regroupent des entrées à l'intérieur d'un même lorebook. Ils sont distincts des dossiers de bibliothèque du panneau **Lorebooks**.

- Clique sur **Add Folder**, puis renomme le dossier sur place.
- Fais glisser une entrée sur un dossier, ou utilise le sélecteur **Folder** (dossier) de l'entrée (il fonctionne au toucher).
- Fais glisser un dossier sur un autre pour l'imbriquer, ou sur la bande du haut pour le sortir de son parent.
- Chaque dossier a un interrupteur d'activation (infobulle "Folder enabled"). Quand il est désactivé, toutes les entrées qu'il contient cessent de s'activer.
- **Clone folder** (cloner le dossier) copie le dossier avec toutes ses entrées et ses sous-dossiers.
- **Delete folder** (supprimer le dossier) ne supprime que le dossier. Son contenu remonte au niveau supérieur.

Les dossiers ne s'affichent comme des groupes que si tu tries par **Order** sans recherche. Sinon, tu vois une liste à plat et la note **Folder view paused (clear search and sort by Order)**.

## Dépannage

| Symptôme | Solution |
| --- | --- |
| Une entrée ne part jamais. | Donne-lui des clés ou passe-la en **Constant**. Vérifie que le lorebook est activé et actif dans le chat. |
| Une clé fonctionnait, puis a cessé. | Marinara n'analyse que les derniers messages (**Scan Depth**, profondeur d'analyse, 2 par défaut). Augmente **Scan Depth**, ajoute du **Sticky**, ou passe l'entrée en **Constant**. |
| Une entrée part dans les mauvaises scènes. | Utilise **Whole Words**, des clés secondaires **Selective**, ou un filtre de personnage. |
| Du lore important est écarté. | Donne-lui un **Order** plus bas ou augmente le **Token Budget**. **Active Context** (contexte actif), dans **Chat Settings** (réglages du chat), montre ce qui a été écarté, et pourquoi. Voir [Budgets de tokens et récursivité des lorebooks](token-budgets.md). |
| L'IA ignore une entrée. | Vérifie dans **Active Context** qu'elle s'est bien activée. Un fait loin du dernier message pèse moins qu'un fait placé près du dernier message avec **@ Depth**. |

## Guides associés

- [Vue d'ensemble des lorebooks](overview.md)
- [Modèles de décision](../connections/decision-models.md)
- [Budgets de tokens et récursivité des lorebooks](token-budgets.md)
- [Recherche sémantique pour les lorebooks](semantic-search.md)
- [Sources de connaissances : les agents Knowledge Retrieval et Knowledge Router](../agents/knowledge-sources.md)
