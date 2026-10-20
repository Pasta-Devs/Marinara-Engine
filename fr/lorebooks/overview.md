# Vue d'ensemble des lorebooks

Ce guide explique ce qu'est un lorebook (recueil de faits sur ton univers) dans Marinara Engine, comment fonctionne le panneau **Lorebooks**, et comment un lorebook devient actif dans un chat. Tu y crées aussi ton premier lorebook et sa première entrée. Les sujets plus pointus, comme les mots-clés, le déclenchement et la recherche sémantique, ont chacun leur guide, en lien à la fin.

## Ce qu'est un lorebook

Un lorebook est une petite base de connaissances dans laquelle l'IA peut puiser pendant un chat (conversation enregistrée). On l'appelle aussi **World Info** : les deux noms désignent la même chose. Chaque lorebook contient une liste d'entrées. Une entrée a deux parties : des mots-clés déclencheurs et un bloc de texte.

Quand un mot-clé apparaît dans les messages récents, Marinara Engine ajoute le texte de cette entrée au prompt. Le prompt, ce sont les instructions invisibles et l'historique envoyés à l'IA pour chaque réponse. L'IA exploite ainsi des faits que personne ne lui a dits directement dans la conversation.

Voici un exemple simple. Tu écris une entrée de lorebook avec le mot-clé `Eldoria` et ce texte :

```
Eldoria is a rainy port city ruled by a council of nine merchants.
```

Désormais, dès que tu mentionnes Eldoria, ou qu'un personnage le fait, l'IA reçoit ce fait. Elle peut alors répondre comme si elle avait toujours connu la ville. Sans l'entrée, elle en serait réduite à deviner.

Les lorebooks servent au lore d'un univers, aux histoires personnelles des personnages, aux noms de lieux, aux factions, aux règles, et à tout fait que l'IA doit retenir. Inutile de répéter ces faits dans chaque message. Le lorebook les fournit uniquement quand ils sont pertinents, ce qui économise de la place dans le prompt.

La correspondance par mots-clés fonctionne avec n'importe quelle connexion à une IA, sans réglage supplémentaire. Marinara sait aussi repérer les entrées par le sens plutôt que par les mots exacts, grâce à la recherche sémantique. C'est une option distincte, à activer soi-même, traitée dans son propre guide.

## Le panneau Lorebooks

Le panneau **Lorebooks** est la bibliothèque où tu parcours, recherches et gères tous les lorebooks. Ouvre-le depuis la barre latérale de l'application. Le panneau affiche chaque lorebook avec son image, son nom et une courte description.

Trois boutons-icônes se trouvent en haut du panneau. Ils n'affichent qu'une icône, sans texte. Survole un bouton avec la souris pour voir son nom.

- Le bouton **New** (nouveau), un signe plus, ouvre la fenêtre **Create Lorebook** (créer un lorebook) pour fabriquer un lorebook.
- Le bouton **Import** (importer), une flèche vers le bas, ouvre la fenêtre **Import Lorebook** pour charger un fichier de lorebook.
- Le bouton **Select** (sélectionner), une coche, active la sélection multiple pour exporter ou supprimer plusieurs lorebooks d'un coup.

Sous les boutons, un champ de recherche affiche le texte indicatif **Search lorebooks**. Il filtre la liste par nom, description, nom du personnage ou du persona lié, et tags. À côté, le menu déroulant **Sort order** (ordre de tri) propose ces choix : **Manual order** (ordre manuel), **A-Z**, **Z-A**, **Newest**, **Oldest** et **Token Budget**. Avec **Manual order**, fais glisser les lorebooks dans l'ordre que tu veux, ou déplaces-en un avec Alt+Up et Alt+Down au clavier. Ton ordre est conservé.

Chaque ligne de lorebook comporte un bouton **Copy** (copier) et un bouton **Delete** (supprimer). Ces boutons apparaissent au survol de la ligne. Sur mobile, ils restent toujours visibles. Le bouton **Copy** duplique le lorebook. Un lorebook désactivé porte un petit badge **OFF**. Clique sur l'image pour la téléverser ou la remplacer.

Autre possibilité : créer des dossiers de bibliothèque avec le bouton **New Folder** (nouveau dossier). Fais glisser un lorebook sur un dossier pour l'y ranger. Une grande bibliothèque reste ainsi bien ordonnée. Sur téléphone, maintiens un lorebook appuyé un instant, puis fais-le glisser. Ces dossiers de bibliothèque n'ont rien à voir avec les dossiers d'entrées que tu peux créer à l'intérieur d'un lorebook.

## Les catégories

Chaque lorebook appartient à une catégorie. La catégorie n'est qu'une étiquette qui t'aide à organiser la bibliothèque. Elle ne change ni la manière ni le moment où le lorebook s'active.

Le panneau propose ces onglets de catégorie :

- L'onglet **All** affiche tous les lorebooks, regroupés par catégorie.
- L'onglet **Active** n'affiche que les lorebooks pertinents pour le chat ouvert en ce moment.
- Les onglets **World**, **Character**, **NPC**, **Spellbook** et **Other** affichent chacun les lorebooks de cette seule catégorie.

À la création d'un lorebook, tu choisis l'une des cinq catégories : **World**, **Character**, **NPC**, **Spellbook** ou **Other**. Par défaut, c'est **Other**. La catégorie se change plus tard depuis l'onglet **Overview** (vue d'ensemble) du lorebook. Attention : dans l'onglet **Overview**, cette même catégorie s'appelle **Uncategorized** et non **Other**. Utilise les étiquettes qui te parlent. Par exemple, range les notes sur les lieux et le cadre dans **World**, et l'histoire d'un compagnon dans **Character**.

## Comment un lorebook s'active

Un lorebook n'alimente l'IA que s'il est actif dans le chat en cours. Trois voies mènent à cette activation. À toi de choisir celle qui convient.

1. **Global.** Un lorebook global est actif dans tous les chats, tant qu'il est activé. Active l'interrupteur **Global** dans l'onglet **Overview** du lorebook. Réserve-le aux faits valables partout, comme les règles de ton univers commun.
2. **Lié à un personnage ou à un persona.** Un lorebook lié s'active automatiquement dans tout chat qui inclut ce personnage ou utilise ce persona (le personnage que tu incarnes). Les liens se définissent dans l'onglet **Overview**, ou depuis l'éditeur de personnage ou de persona. C'est le choix le plus courant pour l'histoire personnelle d'un personnage.
3. **Épinglé à un seul chat.** Tu peux ajouter un lorebook à un unique chat depuis les réglages de ce chat. Il reste actif dans ce chat, et nulle part ailleurs. Pratique pour du lore qui ne vaut que pour une histoire, pas pour toute la bibliothèque.

Un même lorebook ne peut pas être à la fois global et lié. Activer **Global** efface tous les liens vers un personnage ou un persona au moment de l'enregistrement. Marinara traite ces deux options comme exclusives l'une de l'autre.

Chaque lorebook actif reste soumis à son interrupteur **Enabled** (activé). Si un lorebook est désactivé, aucune de ses entrées ne s'active, même s'il est global ou lié. Pour savoir quels lorebooks sont actifs dans le chat ouvert, ouvre les réglages du chat et repère la section **Lorebooks**. La liste des lorebooks actifs se modifie aussi à cet endroit. Un guide distinct est consacré à cette section.

## Créer ton premier lorebook et ta première entrée

Voici la marche à suivre pour créer un lorebook et y ajouter une entrée.

1. Ouvre le panneau **Lorebooks** et clique sur **New**. La fenêtre **Create Lorebook** s'ouvre.
2. Saisis un nom dans le champ **Name** (nom). Ce champ est obligatoire. Un exemple clair : `Eldoria World Lore`.
3. Ajoute une courte **Description** si tu le souhaites. C'est facultatif, et cela sert seulement à retrouver le lorebook plus tard.
4. Choisis une **Category** (catégorie) dans le menu déroulant, ou laisse **Other**.
5. Clique sur le bouton **Create Lorebook**. Le nouveau lorebook apparaît dans la liste du panneau.

Ton lorebook n'a encore aucune entrée. Ajoutes-en une.

1. Clique sur la ligne de ton lorebook dans le panneau. L'éditeur pleine page s'ouvre.
2. Clique sur l'onglet **Entries** (entrées). Le badge à côté indique le nombre d'entrées.
3. Clique sur **Add Entry** (ajouter une entrée). Une nouvelle entrée vide apparaît.
4. Dans l'entrée, ajoute un ou plusieurs mots-clés déclencheurs, par exemple `Eldoria`.
5. Dans le champ **Content** (contenu) de l'entrée, écris le texte que l'IA doit recevoir.

L'entrée s'enregistre toute seule un instant après que tu as cessé de taper. Une brève mention **Saved automatically** s'affiche. Ton lorebook est opérationnel : quand un mot-clé correspond aux messages récents, le contenu de l'entrée rejoint le prompt. Le [guide des entrées](entries.md) détaille les mots-clés, les règles de correspondance et les options de déclenchement. Ses sections [Stratégie de rédaction](entries.md#authoring-strategy-choosing-the-right-entry) et [Exemple complet](entries.md#worked-example-a-small-setting) montrent comment choisir les bons contrôles pour chaque entrée.

## Les réglages de l'onglet Overview

Ouvre un lorebook et clique sur l'onglet **Overview** pour régler le comportement du lorebook entier. Les champs les plus importants sont le nom, la catégorie, les liens et les interrupteurs décrits plus haut. L'onglet contient aussi ces réglages numériques.

| Réglage | Rôle | Par défaut |
|---|---|---|
| **Scan Depth** | Nombre de messages récents que Marinara examine à la recherche de mots-clés. Mets 0 pour analyser tout le chat. | 2 |
| **Token Budget** | Nombre maximal de tokens que ce lorebook peut ajouter à un prompt. Mets 0 pour ne fixer aucune limite. | 2048 |
| **Entry Limit** | Nombre maximal d'entrées que ce lorebook peut ajouter à un prompt. La plage va de 1 à 1000. | 100 |
| **Max Depth** | Nombre de passes récursives supplémentaires à effectuer. Ce champ n'apparaît que si **Recursive** est activé. La plage va de 1 à 10. | 3 |

Un token est un petit morceau de texte, quelques caractères environ. L'IA dispose d'une place limitée pour le prompt : le champ **Token Budget** empêche donc un seul lorebook de la remplir.

L'onglet propose également trois interrupteurs :

- **Enabled** active ou désactive le lorebook entier. Il est activé par défaut.
- **Recursive** autorise le texte d'une entrée activée à en déclencher d'autres lors de passes supplémentaires. Il est désactivé par défaut. Active-le quand ton lore doit s'enchaîner avec du lore apparenté.
- **Vectors** permet aux entrées d'utiliser la correspondance sémantique. Il est désactivé par défaut. La correspondance par mots-clés continue de fonctionner quand il est désactivé.

Sous ces réglages se trouve le panneau **Semantic Search (Embeddings)** (recherche sémantique). Il construit les données qui alimentent la correspondance par le sens. Le guide de la recherche sémantique traite la configuration, les sources d'embeddings et les boutons de vectorisation.

Les subtilités des budgets, du champ **Entry Limit** et de la récursivité ont elles aussi leur guide. Commence par les valeurs par défaut ci-dessus. Elles conviennent à la plupart des lorebooks, et tu pourras les ajuster ensuite.

## Guides associés

- [Les entrées de lorebook : mots-clés, position et déclenchement](entries.md)
- [Budgets de tokens et récursivité des lorebooks](token-budgets.md)
- [La recherche sémantique pour les lorebooks](semantic-search.md)
- [Lier des lorebooks à des personnages et des personas](linking-to-characters.md)
- [Importer et exporter des lorebooks](import-export.md)
- [Sources de connaissances : agents de récupération et de routage](../agents/knowledge-sources.md)
