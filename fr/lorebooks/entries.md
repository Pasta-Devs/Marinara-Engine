# Les entrées de lorebook : mots-clés, position et déclenchement

Ce guide explique comment construire les entrées d'un lorebook (un recueil de faits sur ton univers). Au programme : l'onglet **Entries** (entrées), les mots-clés déclencheurs et les trois types d'entrée. Tu découvres aussi où chaque entrée se place dans le prompt (le texte que Marinara envoie à l'IA) et les réglages de déclenchement qui décident du moment où une entrée part. Si tu débutes avec les lorebooks, commence par [Vue d'ensemble des lorebooks](overview.md).

Une entrée, c'est un bloc de texte accompagné des règles qui décident quand Marinara Engine ajoute ce texte au prompt de l'IA. Quand une entrée s'active, Marinara insère son contenu, et l'IA "se souvient" d'un fait que tu n'as jamais tapé dans le chat.

## L'onglet Entries

Ouvre un lorebook depuis le panneau **Lorebooks** pour accéder à son éditeur pleine page. L'éditeur a deux onglets latéraux : **Overview** (vue d'ensemble) et **Entries**. Clique sur **Entries** pour afficher la liste des entrées. Le badge de l'onglet indique le nombre d'entrées du lorebook.

La barre d'outils en haut de l'onglet **Entries** propose ces contrôles :

- Le champ **Search entries…** : filtre la liste par nom d'entrée, par clés ou par contenu.
- Un menu déroulant de tri avec **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Newest** et **Oldest**. Les options ↓ trient du plus grand au plus petit.
- Le bouton **Select** (sélectionner) : active la sélection multiple, pour copier, déplacer ou supprimer plusieurs entrées d'un coup.
- Le bouton **Add Folder** (ajouter un dossier) : crée un dossier pour regrouper des entrées (voir la section sur les dossiers d'entrées plus bas).
- Le bouton **Add Entry** (ajouter une entrée) : crée une entrée vide en haut de la liste.

Sous la barre d'outils, une ligne de résumé affiche le nombre d'entrées, le nombre de dossiers et l'estimation totale, en tokens (de petits morceaux de texte), du contenu de toutes les entrées.

## Ajouter et modifier une entrée

Voici la marche à suivre pour créer une entrée.

1. Ouvre ton lorebook et clique sur l'onglet **Entries**.
2. Clique sur **Add Entry**. Une nouvelle ligne apparaît dans la liste.
3. Saisis un nom dans le champ de nom de la ligne. Chaque entrée doit avoir un nom.
4. Clique sur la ligne (ou sur son chevron) pour déplier le panneau latéral d'édition complet.
5. Remplis les mots-clés et le contenu, décrits dans les sections suivantes.

Marinara enregistre les modifications automatiquement. Pendant que tu écris, le panneau latéral affiche **Autosaving…**, puis **Saving…**, puis **Saved automatically**. Si un enregistrement échoue, ton texte reste en place et Marinara réessaie à la modification suivante. Les entrées n'ont pas besoin d'un bouton d'enregistrement séparé.

Chaque entrée se présente comme une ligne compacte, sur une seule ligne. Cette ligne réunit les contrôles les plus utilisés. Déplie-la pour accéder au reste.

Pour dupliquer une entrée, survole la ligne et clique sur le bouton **Duplicate** (dupliquer). Pour en supprimer une, clique sur le bouton **Delete** (supprimer). Marinara demande confirmation avec le message "Delete this lorebook entry?".

## Contenu et clés d'une entrée

Déplie une entrée pour modifier ses champs principaux.

- **Primary Keys** (clés principales) : les mots-clés qui déclenchent cette entrée. Dès que l'un de ces mots apparaît dans le chat récent, l'entrée s'active. Saisis un mot-clé et appuie sur Enter pour l'ajouter sous forme de pastille.
- **Content** (contenu) : le texte que Marinara insère dans le prompt de l'IA quand l'entrée s'active. Écris-le comme un simple fait que l'IA doit connaître. Le contenu accepte les macros de prompt, et une estimation en tokens s'affiche en direct sous le champ.
- **Secondary Keys** (clés secondaires) : des mots-clés supplémentaires, utilisés uniquement quand le type d'entrée est **Selective**. Voir la section sur les types d'entrée plus bas.
- **Description** : un court résumé de l'entrée. Seul l'agent **Knowledge Router** le lit, pour décider s'il faut insérer l'entrée. Ce texte n'est jamais envoyé à l'IA principale comme contenu. Voir [Sources de connaissances](../agents/knowledge-sources.md).

Voici un exemple simple.

- Nom : `Silverhaven`
- Primary Keys : `Silverhaven`, `the capital`
- Contenu : `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.`

Dès que `Silverhaven` ou `the capital` apparaît dans le chat, sous ta plume ou sous celle de l'IA, l'IA reçoit ce fait automatiquement.

C'est l'entrée la plus simple qui soit : un nom, deux ou trois clés, un fait. Les sections **Stratégie de rédaction** et **Exemple complet**, plus bas, expliquent quand recourir aux autres contrôles. Elles construisent aussi un petit univers à partir de zéro.

## Règles de correspondance des mots-clés

Par défaut, une clé principale correspond si le mot apparaît quelque part dans le texte récent du chat, sans distinction de majuscules ni de minuscules. Trois contrôles modifient ce comportement. Les options **Whole Words** et **Case Sensitive** se trouvent dans le panneau latéral déplié. L'interrupteur **Regex** est la petite icône de la ligne compacte, et il devient orange quand il est actif.

| Contrôle | Emplacement | Par défaut | Effet |
|---|---|---|---|
| **Whole Words** | Panneau latéral de l'entrée | Off | La clé doit correspondre à un mot entier, pas à un morceau d'un mot plus long. |
| **Case Sensitive** | Panneau latéral de l'entrée | Off | Les majuscules et les minuscules doivent correspondre exactement. |
| **Regex** | Ligne compacte | Off | Traite chaque clé comme un motif d'expression régulière plutôt que comme du texte brut. |

Une expression régulière (regex) est un langage de recherche de motifs dans du texte. Ne l'utilise que si tu maîtrises les regex. Marinara exécute chaque clé regex avec un court délai d'expiration de sécurité. Un motif trop lent ne correspond à rien lors de cette analyse : garde donc des motifs simples.

## Types d'entrée : Normal, Constant, Selective

Chaque entrée a un type. Clique sur le petit point coloré de la ligne pour ouvrir le menu des types et en choisir un.

- **Normal** (point vert) : se déclenche quand une clé principale correspond au texte analysé. C'est le type par défaut.
- **Constant** (point jaune) : s'insère à chaque fois que le lorebook est actif, sans aucun mot-clé. Réserve ce type aux faits qui doivent toujours être présents.
- **Selective** (point rouge) : les clés principales doivent correspondre, et la logique des clés secondaires doit également passer.

Une entrée **Constant** reste soumise au déclenchement, à la probabilité et aux filtres que tu as définis. Elle se passe simplement de mot-clé.

Quand une entrée est **Selective**, ajoute une ou plusieurs **Secondary Keys** et choisis un bouton **Logic** (logique) dans le panneau latéral :

- **AND Any** : au moins une clé secondaire doit apparaître elle aussi.
- **AND All** : toutes les clés secondaires doivent apparaître elles aussi.
- **NOT Any** : l'entrée est bloquée si une clé secondaire apparaît.
- **NOT All** : l'entrée est bloquée seulement si toutes les clés secondaires apparaissent.

Prends par exemple une entrée **Selective** avec la clé principale `king` et la clé secondaire `Silverhaven`, réglée sur **AND Any**. Elle ne part que si le chat mentionne à la fois le roi et Silverhaven. Un mot courant comme `king` ne se déclenche donc pas dans la mauvaise scène.

## Position, Depth et Order

Ces contrôles décident de l'endroit où une entrée activée atterrit dans le prompt. Ils se trouvent sur la ligne compacte quand l'écran est large. Sur un écran étroit, touche le bouton de contrôles rapides de la ligne pour y accéder.

- **Position** : choisis **Before chat**, **After chat**, **@ Depth** ou **Outlet**. Before chat et After chat placent l'entrée autour de l'historique du chat. L'option **@ Depth** insère l'entrée à l'intérieur de l'historique du chat. L'option **Outlet** n'insère pas l'entrée automatiquement : elle met le contenu activé à disposition d'une macro nommée `{{outlet::name}}`. Sur un écran large, la ligne affiche les trois premières positions sous les étiquettes courtes **↑Char**, **↓Char** et **@Depth**.
- **Depth** (profondeur) : n'apparaît que si **Position** vaut **@ Depth**. Ce champ fixe le nombre de messages à remonter, depuis le dernier message, pour insérer l'entrée. La valeur par défaut est 4.
- **Order** (ordre) : l'ordre d'insertion quand plusieurs entrées s'activent en même temps. Un nombre plus petit arrive plus tôt dans le prompt. La valeur par défaut est 100.

Utilise **@ Depth** avec parcimonie, et toujours à bon escient. Comme cette option insère l'entrée *à l'intérieur* des messages récents, et non autour, le texte ressemble à une interruption lâchée au milieu de la conversation :

> **John :** Allons visiter le château de Vlad.
> **Bob :** Ça marche.
> *Le point faible du comte, c'est l'ail : une allergie extrême qu'il cache à tout prix.*
> **John :** Super, on y va demain ? Je ne travaille pas.

Ne t'en sers que si une note doit vraiment se placer juste à côté du dernier tour : une règle que le modèle oublie sans cesse, ou un fait qui vient de changer. Laisse le lore ordinaire sur **Before chat** ou **After chat**.

Quand tu choisis **Outlet**, un champ **Outlet name** apparaît. Saisis un nom exact, sensible à la casse, par exemple `character_rules`, puis place `{{outlet::character_rules}}` dans une section de prompt. Chaque entrée affectée à cet outlet (un point d'insertion nommé) continue de suivre ses règles habituelles : mot-clé, constante, probabilité, filtre, déclenchement, limite d'entrées et budget de tokens. Seules les entrées activées pour la génération en cours sont récupérées. Les entrées qui partagent le même nom d'outlet sont réunies dans l'ordre défini par **Order**, séparées par des sauts de ligne.

Une macro outlet sans entrée active correspondante ne produit rien. Le contenu d'un outlet ne peut pas appeler une autre macro outlet, ce qui évite les boucles récursives. Les macros outlet fonctionnent dans les sections de prompt des modes Conversation, Roleplay et Game Mode.

## Probabilité de déclenchement

Chaque entrée possède une valeur **Probability** (probabilité), affichée en pourcentage sur la ligne. Par défaut, elle vaut 100 % : l'entrée part donc à chaque fois que ses clés correspondent. Baisse-la pour que l'entrée ne parte qu'une fois de temps en temps. Avec 25 %, par exemple, l'entrée a une chance sur quatre de s'activer à chaque correspondance de ses clés.

## Déclenchement : Sticky, Cooldown, Delay, Ephemeral

Les champs **Timing** du panneau latéral règlent le comportement d'une entrée sur plusieurs messages. **Sticky**, **Cooldown** et **Delay** se comptent en messages. **Ephemeral** compte des activations. Les quatre champs partent à 0, c'est-à-dire désactivés.

- **Sticky** : après son déclenchement, l'entrée reste active pendant ce nombre de messages supplémentaires, même sans nouvelle correspondance de mot-clé.
- **Cooldown** : après son déclenchement, l'entrée attend ce nombre de messages avant de pouvoir se déclencher à nouveau.
- **Delay** : l'entrée attend ce nombre de messages dans le chat avant de pouvoir s'activer une première fois.
- **Ephemeral** : l'entrée se désactive d'elle-même après ce nombre d'activations. La valeur 0 signifie illimité.

Par exemple, règle **Sticky** sur 3 pour garder un fait dans le prompt pendant quelques tours après son apparition. Ainsi, l'IA ne l'oublie pas en pleine scène.

## Autres options d'entrée

Le panneau latéral déplié contient encore quelques champs.

- **Role** (rôle) : définit si le texte inséré est étiqueté **System**, **User** ou **Assistant**. Ce réglage ne compte que si **Position** vaut **@ Depth**. La valeur par défaut est **System**.
- **Group** (groupe) et **Tag** : place des entrées dans le même **Group** pour qu'une seule d'entre elles s'active à la fois. Le champ **Tag** est une étiquette libre, pour ton propre classement.
- **Locked** (verrouillé) : empêche l'agent **Lorebook Keeper** de modifier cette entrée. Voir [Référence des agents téléchargeables](../agents/built-in-agents.md).
- L'option **No Vector** et le badge d'état de vectorisation concernent la recherche sémantique. Voir [La recherche sémantique pour les lorebooks](semantic-search.md).

Le panneau latéral comporte aussi une section **Context filters & matching sources** (filtres de contexte et sources analysées). Elle permet de limiter une entrée à certains personnages, à certains tags de personnage ou à certains types de génération. Tu peux aussi y analyser des champs supplémentaires de la fiche de personnage (la description du personnage, par exemple) à la recherche des mots-clés de l'entrée.

## Stratégie de rédaction : choisir la bonne entrée

Les sections précédentes décrivent le rôle de chaque contrôle. Celle-ci les relie aux décisions que tu prends en écrivant un lorebook : quel type choisir, quand resserrer un mot-clé, comment garder le prompt léger. Pars d'une seule question : *quand l'IA doit-elle voir ce fait ?*

- **Le fait doit toujours être vrai** : le postulat de l'univers, l'année, le ton, une règle qui teinte chaque scène. Passe l'entrée en **Constant** : elle s'insère à chaque fois que le lorebook est actif, sans aucun mot-clé. Garde-en peu. Chaque entrée Constant dépense des tokens à chaque message, et une pleine page de ces entrées finit par étouffer le chat lui-même.
- **Le fait ne compte que lorsqu'il surgit** : une personne, un lieu, une faction, un objet. Garde le type **Normal** par défaut, avec trois à huit **Primary Keys** bien précises : le nom, plus les façons dont les personnages le désignent vraiment (`Castle Dracul`, `the castle`, `the fortress`). C'est le type de base, celui de la plupart des entrées.
- **Le mot-clé est un mot courant** qui partirait dans la mauvaise scène (`king`, `home`, `hunter`) : active l'option **Whole Words**, pour que `art` cesse de correspondre à `start`, ou passe l'entrée en **Selective** et ajoute des **Secondary Keys** qui l'arriment au bon contexte.
- **Plusieurs entrées occupent la même place et ne doivent jamais sortir ensemble** : trois versions d'un même château, deux histoires personnelles concurrentes. Donne-leur le même **Group**, pour qu'une seule se charge à la fois.
- **Le fait est important, mais rarement nommé en toutes lettres** : un thème, une relation, une règle que personne n'énonce. Laisse l'entrée en **Normal** et active la correspondance sémantique, pour qu'elle soit retrouvée par le sens (voir [La recherche sémantique](semantic-search.md)). Cette correspondance a besoin d'un modèle d'embedding, qui transforme le texte en représentation numérique. À défaut, replie-toi sur **Constant**, quand le fait doit vraiment toujours être là, ou sur des clés plus larges.

Quelques habitudes gardent un lorebook en bonne santé :

- **Donne à chaque entrée un moyen de partir.** Une entrée **Normal** sans clé n'offre aucune prise à la correspondance par mots-clés. Elle ne s'active que si la recherche sémantique la retrouve par le sens, ce qui exige un lorebook vectorisé et un modèle d'embedding (voir [La recherche sémantique](semantic-search.md)). Si un fait doit toujours être présent, passe l'entrée en **Constant**. Sinon, donne-lui des clés, pour qu'elle parte sans dépendre de la recherche sémantique.
- **Préfère les clés précises.** Une clé comme `he`, `it` ou `the city` correspond à presque tous les messages et gaspille le budget. Quand une clé fait trop de bruit, mise sur les noms exacts, l'option **Whole Words** ou les clés secondaires **Selective**.
- **Remplis le champ Description** de chaque entrée que l'agent **Knowledge Router** doit router : il lit la description, pas le contenu, pour juger de la pertinence (voir [Sources de connaissances](../agents/knowledge-sources.md)).
- **Laisse Position, Depth, Order et Role sur leurs valeurs par défaut**, sauf raison précise. Sers-toi du champ **Order** quand plusieurs entrées partent et que le budget est serré : un nombre plus petit se charge en premier et survit à la coupe. Réserve la position **@ Depth** au rappel rare qui doit se placer à côté du dernier message, comme signalé plus haut. Garde un œil sur les champs **Token Budget** et **Entry Limit** du lorebook (voir [Budgets de tokens et récursivité](token-budgets.md)).

### Organiser le lore en arbre

Un grand univers se gère mieux en arbre qu'en simple liste d'entrées sans hiérarchie. À côté d'une entrée par personnage, par lieu ou par objet, ajoute des **entrées pivots** pour les ensembles auxquels ils appartiennent : une entrée *The Empire* qui décrit l'empire et énumère ses membres marquants, ou une entrée de royaume qui liste ses villes importantes. Un pivot donne une carte à l'IA. Quand l'empire arrive dans la conversation, le modèle sait ce qu'il est et qui en fait partie, sans que l'entrée complète de chaque membre encombre le prompt.

Laisse la récursivité désactivée sur les pivots. L'interrupteur **Recursive** du lorebook et l'interrupteur **Recursion** d'une entrée sont désactivés par défaut, et c'est exactement ce qu'il faut à un pivot : il livre sa vue d'ensemble au modèle, et laisse l'entrée de chaque membre n'apparaître que si ce membre est vraiment nommé. Si tu actives la récursivité ailleurs pour enchaîner du lore apparenté, garde-la désactivée sur les entrées pivots. Sinon, nommer le groupe tire d'un coup l'entrée complète de chaque membre dans le prompt : des milliers de tokens de détails qui ne servent pas encore.

### Réutiliser le lore entre personnages et chats

L'endroit où vit un lorebook décide quels chats le voient. Choisis donc le contenant selon le type de lore :

- **Les règles d'un univers commun**, celui auquel appartient toute ta bibliothèque, vont dans un lorebook **Global**, actif dans tous les chats (active l'interrupteur **Global** dans l'onglet **Overview** du lorebook).
- **Le lore propre à un personnage**, son histoire, ses secrets, ses relations, va dans un lorebook **lié** à ce personnage : il s'active tout seul dans ses chats, et nulle part ailleurs. Quand plusieurs personnages partagent un même lorebook, ajoute un **filtre** de personnage aux entrées qui n'appartiennent qu'à l'un d'eux.
- **Une fiche que tu comptes partager** : **intègre** le lorebook dans la fiche de personnage, pour que son lore parte avec l'export. L'intégration ne concerne que les personnages, et une fiche ne contient qu'un lorebook intégré à la fois.
- **Le lore d'une seule histoire** : épingle le lorebook à ce chat précis, depuis ses réglages.

Le fonctionnement de l'activation est détaillé dans [Vue d'ensemble des lorebooks](overview.md), et les contrôles d'affectation, de portée et d'intégration dans [Lier des lorebooks à des personnages et des personas](linking-to-characters.md).

## Exemple complet : un petit univers

Imagine un roleplay d'horreur gothique, en Valachie dans les années 1890. Un lorebook squelettique se contenterait d'empiler des entrées nom-plus-contenu. Un lorebook bien construit se sert des contrôles ci-dessus pour que chaque fait sorte pile au bon moment. Voici comment quelques entrées pourraient être réglées, et pourquoi.

Commence par les fondations : un fait toujours actif et deux ou trois détails déclenchés par mots-clés.

**Le postulat** – *Constant.*

- Contenu : `The year is 1890. Vampires are real and hunt the Carpathian nights; the living bar their windows after dark.`
- Pourquoi **Constant** : les règles de base teintent chaque réponse, donc cette entrée est toujours présente, sans mot-clé. C'est la seule entrée que tu peux justifier de garder toujours active. Résiste à l'envie d'en passer d'autres en Constant.

**Castle Dracul** – *Normal.*

- Primary Keys : `Castle Dracul`, `the castle`, `the fortress`
- Contenu : `A black-stone fortress on the ridge above the village, the seat of the vampire count.`
- Pourquoi **Normal** avec ces clés : le château ne compte que lorsqu'il entre en jeu, donc l'entrée attend un mot-clé. Les clés couvrent son nom et les façons dont les personnages le désignent.

**Count Vlad** – *Normal, avec Whole Words activé.*

- Primary Keys : `Vlad`
- Description : `The setting's central vampire.`
- Contenu : `The immortal count who rules Wallachia after dark — charming, patient, and without mercy.`
- Pourquoi **Whole Words** : `Vlad` est court et pourrait se loger dans un mot plus long ; la correspondance par mot entier évite les faux déclenchements. Le champ **Description** est rempli pour que le Knowledge Router puisse router l'entrée, si tu utilises cet agent.

### Empiler plusieurs contrôles sur une même entrée

La plupart des entrées demandent un ou deux contrôles ; quelques-unes en méritent plusieurs d'un coup. Prends la règle qui dit comment le méchant peut vraiment être tué, un fait que l'IA a tendance à oublier au pire moment :

**Le point faible du comte** – *Selective (AND Any), Whole Words activé, Order 10, avec une Description.*

- Primary Keys : `weakness`, `kill`, `destroy`, `stake`
- Secondary Keys : `Vlad`, `the count`
- Description : `How Count Vlad can actually be destroyed.`
- Contenu : `Vlad can only be destroyed by a blackthorn stake through the heart, driven at dawn. Sunlight alone merely weakens him.`

Pourquoi cette entrée-là mérite plusieurs contrôles avancés :

- **Selective** avec ces clés secondaires : `weakness`, `kill` et `destroy` sont des mots de combat génériques, qui reviennent dès que l'équipe se bat contre quoi que ce soit. Les clés secondaires arriment l'entrée au comte. Elle reste donc muette quand l'équipe tue un loup ou complote contre un rival, et ne part que si c'est *sa* mort à lui qui est en jeu.
- **Whole Words** : sans cette option, `stake` correspondrait à `mistake` et `kill` à `skill`. Les clés courtes et courantes réclament presque toujours la correspondance par mot entier.
- **Order 10** : une scène décisive active beaucoup d'entrées d'un coup et peut faire exploser le budget de tokens. Un ordre bas charge cette entrée en premier. Si la fin de la liste est coupée, le fait dont dépend toute la scène survit.
- **Description** : l'agent Knowledge Router la lit pour router l'entrée par le sens. La règle peut donc remonter même si les clés exactes ne figurent pas dans le dernier message.

### Des variantes qui ne doivent pas se cumuler

Tu veux que les ragots du village sur le comte se contredisent un peu, mais jamais deux rumeurs opposées dans la même réponse. Mets les deux dans un même **Group**, et laisse la probabilité les garder rares :

**Rumeur : le pacte** et **Rumeur : la lignée** – *toutes deux dans le Group `count-rumor`, Probability 40 %.*

- Clés communes aux deux : `rumor`, `they say`, `the count`
- Contenus : `They say the count was once a crusader who bargained with something in the dark.` et `They say the count is not one man but a line of them, each wearing the last one's face.`
- Pourquoi le **Group** `count-rumor` : les entrées d'un même groupe s'excluent mutuellement, une seule s'active par génération, donc les deux rumeurs ne se contredisent jamais dans le même message. Pourquoi **Probability 40 %** : une rumeur qui remonte à chaque fois que le sujet arrive cesse d'être une rumeur. Avec des chances plus faibles, elle redevient un aparté occasionnel, plein de saveur.

Sur l'ensemble du lorebook, seul le postulat est en Constant, une seule entrée combine la logique sélective et un ordre bas, et tout le reste attend simplement ses clés. C'est ainsi que le prompt reste léger, tout en mettant le bon fait sous les yeux de l'IA au bon moment.

## Cas d'usage par paramètre

La stratégie et l'exemple ci-dessus montrent ces contrôles en combinaison. Cette section sert d'aide-mémoire : à quoi *sert* chaque contrôle, avec un exemple par contrôle.

### La correspondance

**Whole Words** : empêche une clé de correspondre à l'intérieur d'un mot plus long.

- À utiliser pour : les clés courtes ou d'une seule syllabe, les sigles, ou une clé qui forme un morceau d'autres mots.
- *Exemple :* la clé `Ash` (un personnage) correspond à "Ash", mais pas à "ashes" ni à "cash".

**Case Sensitive** : la clé doit respecter exactement les majuscules et les minuscules.

- À utiliser pour : une clé qui est aussi un mot courant en minuscules ; les sigles et les acronymes ; les codes où la casse porte du sens.
- *Exemple :* `IT` (le service informatique) correspond à "IT", mais pas au mot "it".

**Regex** : traite la clé comme un motif d'expression régulière.

- À utiliser pour : plusieurs orthographes ou formes d'un coup, des suffixes facultatifs, ou des nombres et des codes qui suivent un motif. Garde des motifs simples : chacun s'exécute sous un court délai d'expiration de sécurité.
- *Exemple :* `\bVlad(?:'s)?\b` correspond à la fois à "Vlad" et à "Vlad's", en mots entiers.

### Le type d'entrée

**Constant** : s'insère à chaque tour, sans aucun mot-clé.

- À utiliser pour : le postulat et les règles de base de l'univers, une consigne de ton ou de style, ou un fait si central que l'IA ne doit jamais s'en passer.
- *Exemple :* une entrée Constant sans clé, "Everyone speaks in period 1800s English.", est présente dans chaque réponse.

**Selective (clés secondaires + logique)** : ajoute une deuxième condition de mots-clés par-dessus les clés principales.

- À utiliser pour : une clé principale courante qui part dans la mauvaise scène, du lore réservé à une combinaison précise de sujets, ou le blocage d'une entrée dès qu'un certain terme apparaît.
- *Exemple (AND Any) :* clé principale `king`, clé secondaire `Silverhaven` : l'entrée du roi ne part que si Silverhaven est mentionné aussi.
- *Exemple (NOT Any) :* clé principale `the prophecy`, clé secondaire `fulfilled` : l'entrée de la "prophétie non accomplie" est bloquée dès que la prophétie s'accomplit.

### Le placement

**Before chat / After chat** : où l'entrée se place par rapport à la conversation.

- À utiliser pour : la majorité du lore (Before chat, la valeur par défaut) ; un coup de pouce que tu veux au plus près de la prochaine réponse du modèle (After chat).
- *Exemple :* le résumé d'une faction en Before chat ; un court rappel "stay in character" en After chat.

**@ Depth (avec Depth et Role)** : insère l'entrée *à l'intérieur* des messages récents. À utiliser avec parcimonie, voir la mise en garde de la section **Position, Depth et Order** plus haut.

- À utiliser pour : une règle que le modèle oublie sans cesse en pleine scène, ou un fait qui vient de changer et doit atterrir à côté du dernier tour. Le champ **Role** étiquette la ligne insérée **System**, **User** ou **Assistant**.
- *Exemple :* "The tavern is now on fire." en @ Depth 1, Role System.

**Order** : l'ordre dans lequel les entrées activées se chargent.

- À utiliser pour : faire gagner une entrée quand plusieurs partent et que le budget est serré, ou régler l'ordre d'entrées apparentées.
- *Exemple :* une règle décisive pour l'intrigue en Order 10 se charge avant les entrées d'ambiance restées à 100, et survit à la coupe du budget.

**Outlet** : rassemble les entrées activées dans une macro nommée au lieu de les insérer directement.

- À utiliser pour : regrouper plusieurs entrées à un seul endroit du prompt, ou construire un bloc dynamique que tu places toi-même.
- *Exemple :* trois entrées en Position Outlet, sous le nom `house_rules` ; place `{{outlet::house_rules}}` dans une section de prompt, et seules celles qui se sont activées ce tour-ci y apparaissent, réunies selon leur Order.

### Quand et à quelle fréquence une entrée part

**Probability** : le pourcentage de chances que l'entrée parte quand ses clés correspondent.

- À utiliser pour : une touche d'ambiance de temps en temps, des événements aléatoires, ou une manie qui ne doit surgir que par intermittence.
- *Exemple :* "the innkeeper is in a foul mood today" en Probability 30 %.

**Sticky** : garde l'entrée active pendant un nombre défini de messages après son déclenchement.

- À utiliser pour : retenir un fait dans le prompt pendant quelques tours, pour que le modèle ne l'oublie pas en pleine scène.
- *Exemple :* un secret révélé en Sticky 3 reste actif trois messages après son apparition.

**Cooldown** : empêche l'entrée de repartir pendant un nombre défini de messages après son déclenchement.

- À utiliser pour : éviter qu'une entrée dramatique ou lourde ne se répète à chaque message, ou espacer un événement récurrent.
- *Exemple :* un présage "the ground trembles" en Cooldown 5 part au maximum une fois tous les cinq messages.

**Delay** : l'entrée ne peut pas partir avant un nombre défini de messages dans le chat.

- À utiliser pour : du lore qui ne doit pas sortir dès le début ; un rebondissement ou un fait de fin d'arc, gardé de côté le temps que l'histoire avance.
- *Exemple :* une entrée "the mentor was the traitor all along" en Delay 20.

**Ephemeral** : l'entrée se désactive d'elle-même après un nombre défini d'activations.

- À utiliser pour : du contenu à usage unique, ou presque : une introduction, une note de première rencontre, un conseil de tutoriel.
- *Exemple :* "You wake with no memory of how you got here." en Ephemeral 1 part une fois, puis se coupe tout seul.

### Organisation et contrôle

**Group** : rend les entrées mutuellement exclusives ; une seule entrée du groupe s'active par réponse.

- À utiliser pour : des variantes (une rumeur, une humeur ou une version parmi plusieurs), ou un vivier de tirage au hasard.
- *Exemple :* trois entrées "météo du jour" dans le Group `weather` : exactement une est retenue par réponse.

**Tag** : une étiquette libre, pour ton propre classement. Elle n'influence pas l'activation.

- À utiliser pour : organiser et filtrer les entrées dans l'éditeur.
- *Exemple :* tague les entrées `npc`, `location` ou `wip` pour les retrouver et les gérer vite.

**Description** : un résumé que l'agent Knowledge Router lit pour router l'entrée ; jamais envoyé à l'IA comme contenu.

- À utiliser pour : donner à une entrée dense ou bourrée de macros un résumé en langage clair, que le routeur peut rapprocher par le sens, ou te laisser une note à toi-même.
- *Exemple :* une entrée pleine de macros de mise en forme reçoit la Description "les règles de l'arène de duel".

**Recursion** (par entrée) : permet au contenu de cette entrée d'en déclencher d'autres. Désactivé par défaut.

- À utiliser pour : une entrée dont tu *veux* qu'elle enchaîne sur un ensemble limité de lore apparenté. Laisse l'option désactivée sur les entrées pivots (voir **Organiser le lore en arbre** plus haut).
- *Exemple :* "The party enters the Thornwood." avec Recursion activé et un contenu qui nomme les points de repère du bois, pour que ces entrées s'activent aussi.

**No Vector** : exclut l'entrée de la recherche sémantique.

- À utiliser pour : empêcher une entrée générique ou passe-partout de polluer les correspondances par le sens, ou réserver une entrée à ses clés exactes.
- *Exemple :* marque une entrée d'instructions de mise en forme en No Vector, pour qu'elle ne remonte jamais comme résultat sémantique de "lore apparenté".

**Locked** : protège l'entrée de l'agent Lorebook Keeper.

- À utiliser pour : une entrée réglée à la main, qu'une passe automatique ne doit pas réécrire.
- *Exemple :* verrouille ton postulat soigneusement formulé, pour que le Keeper ne puisse pas le modifier.

**Context filters** : limitent une entrée à certains personnages, tags de personnage ou types de génération.

- À utiliser pour : du lore qui ne vaut que pour certains personnages ou certains types de génération.
- Filtrer sur un personnage ne fait pas que cacher l'entrée aux autres chats : dans un chat de groupe, cela la tient aussi à l'écart des réponses des *autres* personnages, et ne l'active que si le personnage filtré est celui qui répond. Parfait pour les histoires personnelles privées, les secrets et le savoir qu'un seul personnage détient.
- *Exemple :* filtre l'allégeance secrète d'une espionne sur cette espionne : elle nourrit ses propres réponses, mais ne fuite jamais dans celles des personnages qu'elle trompe.

## Utiliser les macros dans le contenu d'une entrée

Le champ **Content** d'une entrée est développé comme n'importe quel texte de prompt : les macros sont résolues avant l'insertion du contenu. Voici celles qui rendent le plus service dans une entrée de lorebook :

- `{{char}}` et `{{user}}` : le nom du personnage actif et celui de l'utilisateur ou du persona, pour qu'une entrée partagée se lise naturellement dans n'importe quel chat.
- `{{random::a::b::c}}` et `{{roll:1d6}}` : tire une option au hasard ou lance les dés, pour une touche d'ambiance qui change à chaque déclenchement. Ajoute des poids avec `@`, comme dans `{{random::common@3::rare@1}}`, pour rendre certaines options plus probables que d'autres.
- `{{#if ...}}...{{else}}...{{/if}}` : change le texte selon qui parle, selon une variable ou selon le personnage actif.
- `{{getvar::name}}` et `{{setvar::name::value}}` : lis ou définis une variable persistante propre au chat, pour qu'une entrée réagisse à l'état ou le pilote lors des tours suivants sans le propager aux autres chats.

Le tirage aléatoire pondéré se marie bien avec **Probability** : à eux deux, ils font tenir toute une table aléatoire dans une seule entrée. Au lieu d'un groupe de vingt entrées de monstres, crée une seule entrée "rencontre errante". Donne-lui une **Probability** basse, pour que la rencontre reste occasionnelle, et une liste pondérée de ce qui apparaît :

`{{random::a lone wolf@5::a bandit scout@3::a wounded traveler@2::a displacer beast@1}}`

L'entrée ne part que de temps en temps, et quand elle part, elle tire une seule rencontre. La pondération fait revenir les ennemis courants plus souvent que les rares, sans aucun catalogue d'entrées séparées à maintenir.

Sers-toi de la **macro de commentaire** pour laisser une note qui n'atteint jamais l'IA :

- `{{// draft wording, revisit later}}` : tout ce qui se trouve dans `{{// ... }}` est retiré du résultat.

**Une remarque sur la récursivité.** Quand l'analyse **Recursive** est activée pour le lorebook (voir [Budgets de tokens et récursivité](token-budgets.md)), Marinara réanalyse le contenu *développé* des entrées activées à la recherche de nouveaux mots-clés. Comme les macros sont résolues en premier, le texte qu'elles produisent peut déclencher d'autres entrées : un contenu qui se développe en un nom, par exemple, peut activer une entrée dont c'est la clé. Le `{{// comment}}` fait exception : il est réduit à rien avant la réanalyse, donc son texte ne déclenche jamais rien. Les commentaires servent uniquement à prendre des notes. Si tu veux qu'un texte alimente la récursivité, écris-le en clair.

## Les pièges courants

- **Une entrée ne part jamais.** Une entrée **Normal** sans clé n'offre aucune prise à la correspondance par mots-clés : donne-lui des clés, ou passe-la en **Constant**. (Une entrée sans clé peut encore être retrouvée par le sens, mais seulement si la recherche sémantique est complètement en place : l'interrupteur **Vectors** activé, un modèle d'embedding configuré et l'entrée vectorisée ; voir [La recherche sémantique](semantic-search.md).) Vérifie aussi que le lorebook est activé et actif dans le chat.
- **Un mot-clé a cessé de fonctionner.** Les clés ne sont cherchées que dans les derniers messages, selon le champ **Scan Depth** du lorebook (2 par défaut). Dès que le mot déclencheur sort de cette fenêtre, l'entrée se tait. Augmente le champ **Scan Depth**, ajoute du **Sticky** pour qu'un fait s'attarde une fois parti, ou passe l'entrée en **Constant**.
- **Une entrée part dans les mauvaises scènes.** Une clé trop large comme `home` ou `king` correspond à tout. Resserre-la avec **Whole Words**, conditionne-la avec des clés secondaires **Selective**, ou filtre l'entrée sur le bon personnage.
- **Du lore important est sans cesse écarté.** Quand plus d'entrées correspondent que le budget ne l'autorise, la fin de la liste est coupée. Baisse le champ **Order** des entrées qui comptent, relève le champ **Token Budget**, ou déplace le gros lore de référence derrière l'agent Knowledge Router. Le panneau **Active Context** (contexte actif) montre exactement ce qui a été écarté, et pourquoi (voir [Budgets de tokens et récursivité](token-budgets.md)).
- **L'IA ignore ton lore.** Vérifie dans **Active Context** que l'entrée s'est bien activée. Et souviens-toi qu'elle est en concurrence avec le reste du prompt : un fait enfoui loin du dernier tour pèse moins qu'un fait placé en **After chat** ou, avec parcimonie, en **@ Depth**.

## Liste de vérification de rédaction

Une passe rapide pour chaque entrée que tu écris :

1. **Nomme-la** clairement. Le nom te sert à toi et à la recherche, pas à l'IA.
2. **Décide comment elle part :** un fait toujours vrai → **Constant** ; tout le reste → **Normal**, avec trois à huit **clés** précises.
3. **Dompte les clés bruyantes** avec **Whole Words**, ou répartis-les sur des clés secondaires **Selective**.
4. **Écris le contenu** comme un simple fait, en aussi peu de tokens que possible.
5. **Remplis le champ Description** si tu utilises l'agent Knowledge Router.
6. **Laisse le placement sur ses valeurs par défaut**, sauf si l'entrée réclame vraiment un réglage **Position**, **Depth** ou **Order** sur mesure.
7. **Regroupe** les variantes mutuellement exclusives ; **filtre** le lore propre à un personnage sur ce personnage.
8. **Teste-la** dans le panneau **Keyword test**, puis surveille **Active Context** dans un vrai chat pour confirmer qu'elle part et qu'elle tient dans le budget.

## L'outil Keyword test

Le panneau **Keyword test** (test de mots-clés), en haut de l'onglet **Entries**, sert à vérifier tes mots-clés sans démarrer un chat. Déplie-le et colle un paragraphe d'exemple ou quelques messages dans le champ.

Les entrées dont les clés correspondraient reçoivent un liseré vert et une pastille **Would activate**. Les entrées **Constant** reçoivent une pastille **Always active**, puisqu'elles partent quel que soit le texte. Une ligne de décompte indique combien de tes entrées activées se déclencheraient.

Ce test vérifie uniquement les règles de mots-clés. Il ignore le déclenchement, la probabilité, les filtres de personnage et la correspondance sémantique : un chat réel peut donc différer de l'aperçu.

## Les dossiers d'entrées

Les dossiers regroupent des entrées à l'intérieur d'un même lorebook. Ils sont distincts des dossiers de bibliothèque du panneau **Lorebooks** principal.

- Clique sur **Add Folder** pour en créer un, puis renomme-le sur place.
- Fais glisser une entrée sur un dossier pour l'y classer, ou utilise le sélecteur **Folder** de l'entrée.
- Fais glisser un dossier sur un autre dossier pour l'imbriquer, ou dépose-le sur la bande du haut pour le sortir de son parent.
- Chaque dossier possède un interrupteur **Enabled** (activé). Quand tu désactives un dossier, toutes les entrées qu'il contient cessent de s'activer, même si leur propre interrupteur est actif.
- L'en-tête d'un dossier propose aussi **Clone** (cloner) et **Delete**. **Clone** copie le dossier en profondeur, avec toutes ses entrées et ses sous-dossiers. **Delete** ne supprime que le dossier lui-même. Ses entrées et ses sous-dossiers remontent au niveau supérieur.

Les dossiers ne s'affichent comme des groupes que si tu tries par **Order** sans recherche active. Tout autre tri, ou une recherche, bascule la liste en mode plat et affiche la note "Folder view paused (clear search and sort by Order)".

## Guides associés

- [Vue d'ensemble des lorebooks](overview.md)
- [Budgets de tokens et récursivité des lorebooks](token-budgets.md)
- [La recherche sémantique pour les lorebooks](semantic-search.md)
- [Sources de connaissances : agents de récupération et de routage](../agents/knowledge-sources.md)
