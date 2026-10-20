# Sources de connaissances : les agents Knowledge Retrieval et Knowledge Router

Ce guide explique les deux agents Knowledge de Marinara Engine : **Knowledge Retrieval** et **Knowledge Router**. Tous deux puisent des faits dans les lorebooks (des recueils de faits sur ton univers) et les amènent dans un chat uniquement quand la scène en a besoin. Tu évites ainsi de faire figurer chaque détail dans chaque prompt, le texte que Marinara envoie à l'IA.

## Ce que font ces agents

Un lorebook rassemble des notes sur l'univers ou les personnages, écrites à l'avance. Chaque note s'appelle une entrée. Quand un chat s'allonge, envoyer toutes les entrées à chaque tour gaspille des tokens. Un token est un petit morceau de texte que l'IA lit, et plus il y a de tokens, plus le coût monte. Tout envoyer risque aussi d'embrouiller l'IA.

Les agents Knowledge répondent à ce problème avec le RAG, pour retrieval-augmented generation. L'application repère les entrées qui collent à la scène en cours, puis ajoute ces seules entrées au prompt, pour ce tour uniquement.

Marinara propose deux agents facultatifs pour cela :

- **Knowledge Retrieval** lit les sources que tu as choisies, résume les faits qui comptent et ajoute ce résumé au prompt.
- **Knowledge Router** lit une courte liste de tes entrées, sélectionne celles qui collent à la scène et les ajoute mot pour mot.

Les deux agents ne fonctionnent que dans les chats **Roleplay**. Impossible de les ajouter en mode Conversation ou en Game Mode. Aucun des deux n'est actif par défaut. Tu ajoutes toi-même celui que tu veux à un chat.

## Knowledge Retrieval ou Knowledge Router

Ce tableau t'aide à choisir. Lis les remarques qui le suivent avant de trancher.

| Question | Knowledge Retrieval | Knowledge Router |
|---|---|---|
| Façon d'ajouter le contenu | Résume d'abord les sources | Ajoute les entrées choisies mot pour mot |
| Coût par tour | Plus élevé | Plus faible |
| Peut lire des fichiers téléversés | Oui | Non |
| Idéal pour | Les sources modestes, ou quand tu veux un résumé bien net | Les gros lorebooks dont les entrées sont bien décrites |

**Knowledge Retrieval** lit chaque entrée activée des lorebooks que tu as choisis, plus le texte des fichiers que tu téléverses. Il demande ensuite à l'IA de rédiger un court résumé des faits qui collent aux messages récents. Le coût par tour monte, car l'IA lit tout le matériau source.

**Knowledge Router** est l'option la moins chère. Il construit un petit catalogue de tes entrées. Chaque ligne du catalogue contient un identifiant, un nom, quelques mots-clés et un court résumé. L'IA lit ce catalogue, choisit les entrées qui collent à la scène, et Marinara ajoute ces entrées en entier. L'IA ne lit jamais toutes les entrées en entier : l'agent Router reste donc économique, même avec un gros lorebook.

Rien n'empêche d'ajouter les deux agents à un même chat, mais ils risquent d'apporter du contenu redondant et de faire grimper le coût en tokens. L'éditeur d'agents t'avertit quand les deux sont configurés. Pour des prompts plus propres, n'en garde qu'un.

## Ajouter un agent Knowledge à un chat

À faire depuis un chat **Roleplay**.

1. Ouvre **Chat Settings** (réglages du chat).
2. Repère la section **Agents**.
3. Active **Enable Agents** (activer les agents). La liste des agents se débloque.
4. Clique sur **Add Agent** (ajouter un agent).
5. Ouvre le groupe **Writer Agents**.
6. Choisis **Knowledge Retrieval** ou **Knowledge Router**.

Une fenêtre de configuration s'ouvre pour que tu choisisses tes sources tout de suite. Une fois l'agent ajouté, sa carte de réglages apparaît dans la section **Agents**. L'agent tourne ensuite tout seul à chaque nouveau tour.

Pendant que **Knowledge Retrieval** travaille, l'indicateur de progression peut afficher la phase **Retrieving knowledge...**.

Note : ces agents ne se relancent pas quand tu régénères une réponse existante. Ils ne tournent que sur les nouveaux tours.

## Téléverser des fichiers pour Knowledge Retrieval

Seul **Knowledge Retrieval** sait lire des fichiers téléversés. **Knowledge Router** se contente des lorebooks.

Dans les réglages de **Knowledge Retrieval**, tu trouves une liste de fichiers et un bouton **Upload file** (téléverser un fichier). Les fichiers téléversés restent disponibles pour tous les chats qui utilisent **Knowledge Retrieval**, pas seulement pour le chat en cours.

Les types de fichiers pris en charge sont .txt, .md, .csv, .json, .xml, .html, .htm, .log, .yaml, .yml, .tsv et .pdf. Le sélecteur de fichiers bloque les autres. Chaque fichier de la liste affiche son nom et sa taille, avec un bouton de suppression à côté.

Garde ces limites en tête :

- Tout fichier autre qu'un PDF est lu comme du texte brut. Un fichier qui n'est pas vraiment du texte, par exemple une image renommée en .txt, se téléverse quand même, mais n'apporte qu'un contenu illisible.
- Un PDF scanné, composé uniquement d'images, n'a pas de couche de texte : l'agent ne peut donc pas le lire. Quand l'extraction échoue, l'agent insère un contenu de remplacement à la place du contenu réel. Utilise un PDF dont le texte est sélectionnable.

## Choisir tes sources : sources fixes ou lorebooks du chat

Les deux agents partagent les mêmes réglages de source dans leur carte.

L'interrupteur **Use chat-active lorebooks** (utiliser les lorebooks actifs du chat) est activé par défaut. Dans l'éditeur d'agents, le même interrupteur porte l'étiquette **Use this chat's active lorebooks**. Tant qu'il est activé et que tu ne choisis aucun lorebook fixe, l'agent utilise les lorebooks actifs du chat en cours.

Juste en dessous se trouve **Fixed source override**, affiché **Fixed Source Lorebooks** dans la fenêtre de configuration. Choisis-y un ou plusieurs lorebooks pour verrouiller l'agent sur cet ensemble précis. Une sélection fixe l'emporte toujours sur les lorebooks actifs du chat, et cela pour tous les chats qui utilisent cet agent.

Passe par des sources fixes quand tu veux qu'un agent lise toujours le même lorebook de référence. Laisse l'interrupteur activé, sans sélection fixe, quand tu veux que l'agent suive ce que le chat utilise.

## Rédiger de bonnes descriptions d'entrée

Cette section concerne surtout **Knowledge Router**. L'agent Router décide quoi ajouter en lisant le champ **Description** de chaque entrée. C'est une bonne description qui lui permet de choisir la bonne entrée.

Tu écris cette description dans l'éditeur d'entrée du lorebook, dans le champ **Description**. Garde un résumé court et précis de ce que couvre l'entrée. L'agent Router se sert de ce texte uniquement pour choisir les entrées. Il n'est pas envoyé à l'IA principale comme contenu narratif.

Si une entrée n'a pas de description, l'agent Router se rabat sur le début du contenu de l'entrée. Ce repli est moins précis. Remplis donc une description pour chaque entrée que tu veux rendre repérable.

Quand tu sélectionnes des lorebooks source pour l'agent Router, un petit badge de couverture apparaît à côté de **Fixed source override**. Il indique combien d'entrées ont une description, en pourcentage et en nombre, par exemple **75% described (9/12)**. Le point est vert à partir de 75 %, orange entre 25 et 74 %, et rouge en dessous de 25 %. Il affiche **No entries yet** quand les lorebooks choisis sont vides. Vise le vert.

## Présélection sémantique facultative

**Knowledge Router** sait aussi repérer des entrées candidates par le sens, et pas seulement par mot-clé. C'est ce qu'on appelle la correspondance sémantique. Elle s'appuie sur un embedder, un petit modèle qui transforme le texte en nombres pour que l'application puisse comparer le sens. Cette étape est facultative. L'agent Router fonctionne très bien sans elle.

Pour l'activer, vectorise ton lorebook. Vectoriser, c'est passer l'embedder une fois sur chaque entrée et enregistrer les résultats. Ouvre l'éditeur de lorebook et repère la section **Semantic Search (Embeddings)** (recherche sémantique). Choisis une connexion qui dispose d'un modèle d'embedding, ou une **Embedding Connection** (connexion d'embeddings). Si tu as choisi une connexion par défaut **Embeddings** sous **Defaults** (valeurs par défaut) dans **Connections** (connexions), elle est sélectionnée pour toi, sauf si tu as déjà choisi une autre source. Vérifie la source sélectionnée avant de vectoriser, et utilise la même source d'embeddings que ta connexion de chat : les vecteurs d'une taille différente sont ignorés pendant la correspondance sémantique. Clique ensuite sur **Vectorize N missing**, où N est le nombre d'entrées qui n'ont pas encore de vecteurs. Autre option : le bouton **Re-vectorize** refait toutes les entrées. Pour les détails, consulte le guide de recherche sémantique en lien ci-dessous.

Si un lorebook n'a aucun vecteur, ou si aucun embedder n'est disponible, l'agent Router revient à la correspondance par mots-clés pour construire sa liste de candidats. Rien ne casse. Il se repose simplement sur les mots-clés.

## Guides associés

- [Recherche sémantique pour les lorebooks](../lorebooks/semantic-search.md)
- [Présentation des lorebooks](../lorebooks/overview.md)
- [Agents : des aides IA pour tes chats](agents-overview.md)
