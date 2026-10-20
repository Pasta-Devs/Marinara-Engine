# Recherche sémantique pour les lorebooks

Ce guide explique la recherche sémantique appliquée aux lorebooks dans Marinara Engine. Avec elle, une entrée de lorebook s'active par le sens, et plus seulement sur des mots-clés exacts. Au programme : choisir une source d'embeddings, vectoriser les entrées et affiner la correspondance.

## Ce qu'apporte la recherche sémantique

Un lorebook (recueil de faits sur ton univers) est un ensemble d'entrées. Chaque entrée contient des mots-clés déclencheurs et un bloc de texte. En temps normal, une entrée ne s'active que si l'un de ses mots-clés exacts apparaît dans le chat récent. Dès que la formulation change, l'entrée reste muette.

La recherche sémantique règle le problème. Elle compare le sens du chat récent avec le sens des entrées. Une entrée peut donc s'activer même sans mot-clé exact. Exemple : une entrée associée au mot-clé "sword" peut aussi répondre à un message qui parle seulement de "blade".

Tout repose sur les embeddings. Un embedding est une liste de nombres qui capture le sens d'un texte, une sorte de représentation numérique. Marinara enregistre un embedding, aussi appelé vecteur, pour chaque entrée. C'est ce qu'on appelle la vectorisation. Au moment du chat, Marinara calcule l'embedding des messages récents et retrouve les entrées dont le sens s'en rapproche le plus.

La correspondance par mot-clé continue de fonctionner quand la recherche sémantique est active. La recherche sémantique ajoute des correspondances supplémentaires. Elle ne remplace pas les mots-clés.

Les correspondances par mot-clé et les correspondances sémantiques ont la même priorité quand Marinara applique la limite d'entrées et le budget de tokens du lorebook (un token, c'est un petit morceau de texte). Si toutes les entrées trouvées ne tiennent pas, c'est l'ordre des entrées que tu as défini qui départage les correspondances par mot-clé et sémantiques du moment ; la méthode d'activation ne l'emporte pas.

## Avant de commencer : choisis une source d'embeddings

La recherche sémantique a besoin d'un modèle capable de créer des embeddings. Tu as deux options.

Quel que soit ton choix, tu peux en faire la source par défaut de toute l'application : ouvre **Connections** (connexions), puis **Defaults** (valeurs par défaut) et choisis-la sous **Embeddings**. Toute connexion sans modèle d'embedding ni **Embedding Connection** (connexion d'embeddings) propre l'utilise alors. Le réglage propre à une connexion garde la priorité, et la ligne indique combien de connexions utilisent leurs propres réglages. **None** conserve le modèle local intégré comme solution de repli.

Option 1 : une connexion dotée d'un modèle d'embedding.

1. Ouvre le panneau **Connections** (Connexions).
2. Ouvre une connexion pour la modifier.
3. Repère la section **Semantic Search (Embeddings)** (recherche sémantique).
4. Saisis un nom de modèle d'embedding dans le champ du modèle. Une valeur courante est `text-embedding-3-small`.
5. Enregistre la connexion.

Une connexion peut aussi envoyer ses requêtes d'embedding via la clé API et l'adresse d'une autre connexion. Dans la même section, choisis cette connexion sous **Embedding Connection**. La valeur par défaut est **Same as this connection** (comme cette connexion). Si la connexion choisie a son propre modèle d'embedding, Marinara l'utilise ; sinon, elle utilise le nom de modèle saisi ici. Cela vaut aussi bien pendant la vectorisation que pendant le chat.

Tous les fournisseurs ne proposent pas d'embeddings. Si le fournisseur n'en est pas capable, l'éditeur t'invite à choisir plutôt une connexion dédiée aux embeddings.

Option 2 : le modèle local intégré.

Marinara peut faire tourner un petit modèle d'embedding sur ta machine, sans clé API (un code secret, un peu comme un mot de passe). Dans le sélecteur du lorebook, cette option s'appelle **Local Model (sidecar)**. Elle n'apparaît qu'une fois le modèle local téléchargé. Voir [Installer le modèle local](../connections/local-model.md) pour la procédure d'installation.

Sur une version Marinara Lite, l'option **Local Model (sidecar)** est masquée. Sur Lite, la recherche sémantique exige une connexion dotée d'un modèle d'embedding.

## Activer Vectors pour un lorebook

Pour les nouveaux lorebooks, la recherche sémantique est désactivée par défaut. Elle s'active lorebook par lorebook.

1. Ouvre le lorebook que tu veux interroger par le sens.
2. Reste sur l'onglet **Overview** (Vue d'ensemble).
3. Repère l'interrupteur **Vectors** (Vecteurs) et active-le.

Le texte d'aide de **Vectors** indique : "When on, entries in this lorebook may use semantic embeddings. When off, keyword matching still works and vectorization skips this lorebook."

Tant que **Vectors** est désactivé, le panneau sémantique affiche cette note : "Semantic search is disabled by the lorebook-level Vectors toggle."

## Le panneau Semantic Search (Embeddings)

Une fois **Vectors** activé, le panneau **Semantic Search (Embeddings)** apparaît sur l'onglet **Overview**. Une pastille d'état indique combien d'entrées sont vectorisées, par exemple "8/12 entries vectorized". Elle passe au vert avec une coche dès que toutes les entrées sont traitées.

Le panneau propose trois réglages numériques.

| Réglage | Rôle | Par défaut | Plage |
|---|---|---|---|
| **Query Messages** | Nombre de messages récents du chat dont l'embedding est calculé pour interroger ce lorebook. | 10 | 0 à 100 |
| **Score Threshold** | Similarité calibrée minimale qu'une entrée doit atteindre pour s'activer. Plus la valeur est haute, plus c'est strict. | 0.3 | 0 à 1 |
| **Vector Limit** | Nombre maximal de correspondances sémantiques que ce lorebook peut ajouter à une génération. | 10 | 1 à 100 |

Mets **Query Messages** sur 0 pour interroger tout l'historique du chat plutôt qu'une fenêtre récente.

**Score Threshold** règle le degré de proximité de sens exigé. Une valeur basse comme 0.2 laisse passer plus d'entrées, au risque de correspondances hors sujet. Une valeur haute comme 0.5 est plus stricte et ne retient que les sens très proches. Commence par la valeur par défaut, puis ajuste si tu obtiens trop ou trop peu de correspondances.

Marinara calibre ce score face à plusieurs passages neutres sans rapport entre eux, produits par le même modèle d'embedding. Cela élimine le plancher de similarité cosinus anormalement élevé de certains moteurs d'embedding locaux ou compatibles OpenAI, où des textes sans rapport peuvent tous tourner autour de 0.95, voire plus. Le réglage reste ainsi utile quel que soit le modèle d'embedding, au lieu d'imposer un seuil proche de 1.0 propre à chaque modèle.

**Vector Limit** plafonne uniquement les correspondances sémantiques. Les budgets de tokens habituels s'appliquent en plus.

## Vectoriser les entrées

Vectoriser, c'est calculer puis enregistrer l'embedding de chaque entrée. Cette étape est indispensable avant toute correspondance sémantique.

1. Active **Vectors** pour le lorebook.
2. Dans le panneau **Semantic Search (Embeddings)**, choisis une source d'embeddings dans le menu déroulant. La première option est **No semantic search**. Vient ensuite **Local Model (sidecar)**, quand il est disponible. Les connexions éligibles suivent.
3. Clique sur le bouton de vectorisation. Quand certaines entrées n'ont pas encore de vecteur, le bouton affiche **Vectorize N missing**, par exemple "Vectorize 5 missing".
4. Attends la fin du traitement. La pastille d'état se met à jour et montre toutes les entrées vectorisées.

Si aucune connexion ne dispose d'un modèle d'embedding ou d'une **Embedding Connection**, le panneau affiche cette note à la place du menu déroulant : "No connections with an embedding model configured. Set an Embedding Model on a connection first." Configure d'abord une source d'embeddings, en suivant les étapes ci-dessus.

Quand chaque entrée possède déjà un vecteur, le bouton principal devient **Re-vectorize N entries**. Il reconstruit tous les vecteurs enregistrés, après une demande de confirmation avant l'écrasement.

Un bouton distinct **Re-vectorize all** apparaît lorsque certaines entrées ont un vecteur et d'autres non. Il sert à tout reconstruire en une seule passe.

Pour effacer les vecteurs enregistrés, clique sur **Delete vectors**. Seuls les embeddings disparaissent. Le texte des entrées et les mots-clés ne changent pas. La correspondance par mot-clé continue de fonctionner après la suppression des vecteurs.

### Exclure une entrée

Tu peux laisser une entrée de côté pendant la vectorisation et traiter toutes les autres. Ouvre l'entrée, puis active son interrupteur **No Vector**. Son texte d'aide indique : "When enabled, bulk vectorization skips this entry and removes any stored embedding." Cette entrée reste activable par mot-clé. Elle ne peut simplement pas correspondre par le sens.

## Revectoriser après un changement de modèle

Les vecteurs enregistrés sont liés au modèle d'embedding qui les a produits. Si tu passes à un autre modèle d'embedding, les anciens vecteurs risquent de ne plus correspondre.

Reconstruis tous les vecteurs après un changement de modèle d'embedding. Utilise **Re-vectorize N entries** ou **Re-vectorize all** pour que toutes les entrées s'appuient sur le même modèle.

Ne lance pas une vectorisation partielle après un changement de modèle. Si un traitement limité aux entrées manquantes renvoie une taille de vecteur différente de celle des vecteurs enregistrés, le serveur le refuse avec ce message : "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models."

Il existe un cas d'échec silencieux à connaître. Au moment du chat, Marinara calcule l'embedding des messages récents avec un modèle de requête. Ce modèle de requête est le modèle d'embedding propre à la connexion active, ou celui de son menu **Embedding Connection** s'il est renseigné. Si la connexion n'a ni l'un ni l'autre, Marinara utilise la valeur par défaut **Embeddings** sous **Defaults** dans **Connections**, ou le modèle local intégré quand elle vaut **None**. Ce modèle de requête peut produire une taille de vecteur différente de celle du modèle qui a vectorisé les entrées. Marinara écarte alors ces entrées de la correspondance sémantique. Aucune erreur ne s'affiche. Pour éviter cela, vectorise les entrées avec la source d'embeddings que tu utilises pendant le chat. Définir une valeur par défaut **Embeddings** aide : le sélecteur de vectorisation démarre dessus, sauf si tu as choisi autre chose avant, et les connexions sans réglages d'embedding propres s'en servent pour interroger. Et revectorise après chaque changement de modèle.

## Ce que cela apporte à l'agent Knowledge Router

La recherche sémantique aide aussi l'agent **Knowledge Router**. Cet agent sélectionne les entrées de lorebook pertinentes et les insère dans le prompt (le texte que Marinara envoie à l'IA) pour les gros lorebooks. Quand un lorebook est vectorisé, le router s'appuie sur les correspondances sémantiques pour dresser sa liste d'entrées candidates, en plus des correspondances par mot-clé.

Cette étape reste facultative pour le router. Si le lorebook n'est pas vectorisé, ou qu'aucune source d'embeddings n'est disponible, le router se rabat sur les seules correspondances par mot-clé. La vectorisation lui offre simplement une meilleure liste. Voir [Sources de connaissances : agents de récupération et de routage](../agents/knowledge-sources.md) pour le fonctionnement de cet agent.

## Guides associés

- [Vue d'ensemble des lorebooks](overview.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Installer le modèle local](../connections/local-model.md)
- [Sources de connaissances : agents de récupération et de routage](../agents/knowledge-sources.md)
