# Recherche sémantique pour les lorebooks

Avec la recherche sémantique, une entrée de lorebook (un recueil de faits sur ton univers) s'active par le sens, et plus seulement sur des mots-clés exacts. Une entrée associée au mot-clé "sword" peut alors correspondre à un message qui parle de "blade". Utilise-la quand tu emploies beaucoup de mots différents pour une même idée.

Elle s'appuie sur les embeddings, des listes de nombres qui capturent le sens d'un texte. Marinara enregistre un embedding, aussi appelé vecteur, pour chaque entrée. Les construire, c'est ce qu'on appelle la vectorisation. Au moment du chat, Marinara calcule l'embedding de tes messages récents et retrouve les entrées les plus proches.

La recherche sémantique ajoute des correspondances. Tes mots-clés continuent de fonctionner. Face aux budgets, les correspondances par mot-clé et les correspondances sémantiques ont la même priorité : quand tout ne tient pas, c'est le champ **Order** (ordre) des entrées qui tranche.

## Configurer la recherche sémantique

Il te faut d'abord une source d'embeddings, puis l'interrupteur **Vectors** (vecteurs), puis une vectorisation.

### Étape 1 : choisir une source d'embeddings

Avant de commencer : il te faut soit un compte dont le service propose des embeddings, soit le modèle intégré. Tous les services ne proposent pas d'embeddings. Si le tien n'en propose pas, l'éditeur t'invite à choisir un compte dédié aux embeddings.

Option 1 : un compte doté d'un modèle d'embedding.

1. Ouvre le panneau **Connections** (Connexions) et ouvre un compte pour le modifier.
2. Ouvre **Advanced** (avancé), puis **More** (plus), et repère **Semantic search (embeddings)** (recherche sémantique).
3. Saisis un nom de modèle d'embedding, comme `text-embedding-3-small`. Si tu n'es pas sûr du nom, consulte la documentation de ton service, ou utilise plutôt le modèle intégré.
4. Enregistre le compte.
5. Clique sur **Test embedding** (tester l'embedding) pour vérifier. Marinara enregistre d'abord, calcule l'embedding d'un court texte d'exemple et affiche la taille du vecteur, par exemple "1536 dimensions", ou l'erreur renvoyée par le service.

Pour envoyer les requêtes d'embedding avec la clé et l'adresse d'un autre compte, choisis ce compte sous **Embedding provider** (fournisseur d'embeddings). La valeur par défaut est **Same as this provider** (comme ce fournisseur). Si le compte choisi a son propre modèle d'embedding, Marinara l'utilise. Sinon, il utilise le nom de modèle saisi ici.

Option 2 : le modèle intégré. Il tourne sur ton ordinateur, sans clé API (un code secret, un peu comme un mot de passe), et s'appelle **Built-in model** (modèle intégré) dans le sélecteur. Il apparaît une fois téléchargé, et il est masqué sur les builds Lite. Voir [Configuration du modèle intégré](../connections/local-model.md).

Pour faire d'une source la valeur par défaut de tous les comptes qui n'en définissent aucune, ouvre **Connections** et choisis-la dans la tâche **Embeddings**. Le réglage propre à un compte garde la priorité. L'entrée par défaut, **Marinara's own search** (recherche propre à Marinara), conserve le modèle intégré comme solution de repli.

### Étape 2 : activer Vectors

La recherche sémantique est désactivée pour les nouveaux lorebooks.

1. Ouvre le lorebook et reste sur l'onglet **Overview** (vue d'ensemble).
2. Active **Vectors**. Quand il est activé, les entrées peuvent aussi être trouvées par le sens. Quand il est désactivé, les mots-clés fonctionnent toujours et le lorebook n'est pas vectorisé.

Tant que **Vectors** est désactivé, le panneau indique "Semantic search is disabled by the lorebook-level Vectors toggle."

### Étape 3 : vectoriser les entrées

1. Dans le panneau **Semantic search (embeddings)**, choisis une source dans le menu déroulant. La première option est **No semantic search** (pas de recherche sémantique). **Built-in model** vient ensuite, quand il est disponible, puis tes comptes éligibles.
2. Clique sur **Vectorize N missing**, par exemple "Vectorize 5 missing".
3. Attends. Une pastille affiche la progression, par exemple "8/12 entries vectorized", et passe au vert quand toutes les entrées sont traitées.

Si ça n'a pas marché : quand aucun compte n'a de modèle d'embedding, le panneau indique "No connections with an embedding model configured. Set an Embedding Model on a connection first." Termine l'étape 1 et réessaie.

## Le panneau Semantic search (embeddings)

Une fois **Vectors** activé, le panneau apparaît sur l'onglet **Overview** avec ces réglages.

| Réglage | Rôle | Par défaut | Plage |
| --- | --- | --- | --- |
| **Query Messages** | Le nombre de tes messages récents qui servent à la recherche. 0 utilise tous les messages disponibles. | 10 | 0 à 100 |
| **Score Threshold** | La similarité qu'une entrée doit atteindre pour s'activer. Plus la valeur est haute, plus c'est strict. | 0,3 | 0 à 1 |
| **Vector Limit** | Le nombre maximal d'entrées que ce lorebook peut ajouter par le sens dans une réponse. | 10 | 1 à 100 |

**Include character context** (inclure le contexte des personnages) cherche aussi dans les réponses récentes des personnages, séparément de tes messages, et garde la correspondance la plus forte. Ce réglage calcule l'embedding de texte supplémentaire et il est désactivé par défaut. **Query Messages** s'applique alors aussi aux réponses des personnages.

Une valeur basse de **Score Threshold**, comme 0,2, laisse passer plus d'entrées, au risque de correspondances hors sujet. Une valeur haute, comme 0,5, ne retient que les sens proches. Commence par la valeur par défaut.

**Vector Limit** ne compte que les correspondances par le sens. Tes budgets de tokens habituels (un token est un petit morceau de texte) s'appliquent toujours.

## Revectoriser, supprimer et exclure

- **Re-vectorize N entries** apparaît quand chaque entrée a un vecteur. Ce bouton reconstruit tous les vecteurs après ta confirmation.
- **Re-vectorize all** apparaît quand certaines entrées ont un vecteur et d'autres non. Ce bouton reconstruit tout en une seule passe.
- **Delete vectors** (supprimer les vecteurs) ne supprime que les vecteurs enregistrés. Le texte des entrées et les mots-clés restent, et les mots-clés continuent de fonctionner.
- **No Vector**, sur une entrée, l'exclut. Son texte d'aide indique que la vectorisation groupée ignore l'entrée et supprime tout embedding enregistré. L'entrée s'active toujours par mot-clé.

### Après un changement de modèle d'embedding

Les vecteurs enregistrés appartiennent au modèle qui les a produits. Après un changement de modèle, utilise **Re-vectorize N entries** ou **Re-vectorize all** pour que toutes les entrées s'appuient sur le même modèle. Un traitement limité aux entrées manquantes qui renvoie une taille de vecteur différente est refusé avec ce message : "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models."

Un échec, lui, est silencieux. Au moment du chat, Marinara calcule l'embedding de tes messages avec le modèle d'embedding du compte actif, ou avec le modèle de son réglage **Embedding provider**. Si le compte ne définit ni l'un ni l'autre, Marinara utilise la source de la tâche **Embeddings**, ou le modèle intégré. Si la taille de vecteur de ce modèle diffère de celle des vecteurs de tes entrées, Marinara écarte ces entrées de la correspondance sémantique et n'affiche aucune erreur. Vectorise avec la source que tu utilises pendant le chat, et revectorise après chaque changement de modèle.

## La recherche sémantique et le Knowledge Router

Quand un lorebook est vectorisé, l'agent **Knowledge Router** s'appuie aussi sur les correspondances par le sens pour dresser sa liste d'entrées candidates. Sans vecteurs, il n'utilise que les correspondances par mot-clé. Voir [Sources de connaissances : les agents Knowledge Retrieval et Knowledge Router](../agents/knowledge-sources.md).

## Guides associés

- [Vue d'ensemble des lorebooks](overview.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Configuration du modèle intégré](../connections/local-model.md)
- [Sources de connaissances : les agents Knowledge Retrieval et Knowledge Router](../agents/knowledge-sources.md)
