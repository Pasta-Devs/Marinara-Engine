# Sources de connaissances : les agents Knowledge Retrieval et Knowledge Router

**Knowledge Retrieval** et **Knowledge Router** puisent des faits dans tes lorebooks et les amènent dans un chat uniquement quand une scène en a besoin. Tu n'as pas à faire figurer chaque détail dans chaque prompt, le texte que Marinara envoie à l'IA. Les deux agents ne fonctionnent que dans les chats Roleplay, et aucun des deux n'est actif par défaut.

## Pourquoi les utiliser

Un lorebook est un ensemble de notes sur l'univers ou les personnages. Chaque note est une entrée. Envoyer toutes les entrées à chaque tour gaspille des tokens (les petits morceaux de texte qu'un modèle lit et que tu paies) et peut embrouiller l'IA.

Ces agents utilisent le RAG (retrieval-augmented generation, génération augmentée par récupération) : Marinara repère les entrées qui collent à la scène en cours et n'ajoute que celles-là au prompt pour ce tour.

## Choisir entre Retrieval et Router

| Question | Knowledge Retrieval | Knowledge Router |
| --- | --- | --- |
| Façon d'ajouter le contenu | Résume d'abord les sources | Ajoute les entrées choisies mot pour mot |
| Coût par tour | Plus élevé | Plus faible |
| Peut lire des fichiers téléversés | Oui | Non |
| Idéal pour | Les sources modestes, ou un résumé bien net | Les gros lorebooks dont les entrées sont bien décrites |

- **Knowledge Retrieval** lit chaque entrée activée des lorebooks que tu as choisis, plus les fichiers téléversés, et demande à l'IA de résumer les faits qui collent aux messages récents. Il coûte plus cher, car l'IA lit tout le texte source.
- **Knowledge Router** construit un petit catalogue de tes entrées. Chaque ligne contient un identifiant, un nom, quelques mots-clés et un court résumé. L'IA choisit des entrées dans le catalogue, et Marinara les ajoute en entier. L'IA ne lit jamais toutes les entrées : l'agent Router reste donc économique avec un gros lorebook.

Tu peux ajouter les deux à un même chat, mais ils se recoupent et font grimper le coût. L'éditeur d'agents t'avertit quand les deux sont configurés. Choisis-en un.

## Ajouter un agent Knowledge à un chat

Avant de commencer : installe l'agent depuis **Agent Organizer** (organisateur d'agents). Voir la [vue d'ensemble des agents](agents-overview.md).

1. Dans un chat Roleplay, ouvre **Chat Settings** (réglages du chat).
2. Repère la section **Agents** et active **Enable Agents** (activer les agents).
3. Clique sur **Add Agent** (ajouter un agent).
4. Ouvre le groupe **Writer Agents** et choisis **Knowledge Retrieval** ou **Knowledge Router**.
5. Dans la fenêtre de configuration, choisis tes sources (voir plus bas).

La carte de réglages de l'agent apparaît alors dans **Agents**, et l'agent tourne à chaque nouveau tour. Pendant que Knowledge Retrieval travaille, l'indicateur de progression peut afficher **Retrieving knowledge...**.

> **Remarque :** ces agents ne tournent que sur les nouveaux tours. Ils ne se relancent pas quand tu régénères une réponse.

## Choisir les sources

Les deux agents partagent les mêmes réglages de source.

- L'interrupteur **Use chat-active lorebooks** (utiliser les lorebooks actifs du chat) est activé par défaut. Dans l'éditeur d'agents, le même interrupteur s'appelle **Use this chat's active lorebooks**. Tant qu'il est activé et que tu ne choisis aucun lorebook fixe, l'agent lit les lorebooks actifs du chat en cours.
- **Fixed source override** (**Fixed Source Lorebooks** dans la fenêtre de configuration) verrouille l'agent sur les lorebooks que tu choisis. Une sélection fixe l'emporte toujours sur les lorebooks actifs du chat, dans chaque chat qui utilise cet agent.

Passe par des sources fixes quand un agent doit toujours lire le même lorebook de référence. Laisse l'interrupteur activé, sans sélection fixe, pour suivre ce que le chat utilise.

## Téléverser des fichiers (Knowledge Retrieval uniquement)

Dans les réglages de **Knowledge Retrieval**, clique sur **Upload file** (téléverser un fichier). Les fichiers téléversés sont disponibles pour tous les chats qui utilisent Knowledge Retrieval.

Les types pris en charge sont `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.htm`, `.log`, `.yaml`, `.yml`, `.tsv` et `.pdf`. Le sélecteur de fichiers bloque les autres types. Chaque fichier affiche son nom et sa taille, avec un bouton de suppression.

- Tout fichier autre qu'un PDF est lu comme du texte brut. Un fichier qui n'est pas du texte, par exemple une image renommée en `.txt`, se téléverse mais n'apporte qu'un contenu illisible.
- Un PDF scanné ou composé uniquement d'images n'a pas de couche de texte. L'agent insère alors un texte de remplacement au lieu du contenu. Utilise un PDF dont le texte est sélectionnable.

## Rédiger de bonnes descriptions d'entrée

C'est surtout important pour Knowledge Router, qui choisit les entrées d'après leur **Description**.

1. Ouvre l'entrée dans l'éditeur de lorebook.
2. Remplis le champ **Description** avec un résumé court et précis de ce que couvre l'entrée.

L'agent Router se sert de la description uniquement pour choisir les entrées. Elle n'est pas envoyée à l'IA principale comme contenu narratif. Sans description, l'agent Router se rabat sur le début du contenu de l'entrée, ce qui est moins précis.

Quand tu choisis des lorebooks source pour l'agent Router, une étiquette de couverture apparaît à côté de **Fixed source override**, par exemple **75% described (9/12)**. Le point est vert à partir de 75 %, orange de 25 % à 74 %, et rouge en dessous de 25 %. Elle affiche **No entries yet** pour des lorebooks vides. Vise le vert.

## Facultatif : présélectionner par le sens

Knowledge Router peut aussi repérer des entrées candidates par le sens, et pas seulement par mot-clé. Il s'appuie pour cela sur un embedder, un petit modèle qui transforme le texte en nombres pour que Marinara puisse comparer le sens. L'agent Router fonctionne sans lui.

1. Ouvre l'éditeur de lorebook et repère **Semantic search (embeddings)** (recherche sémantique).
2. Choisis un compte qui dispose d'un modèle d'embedding. Si tu as défini une valeur par défaut **Embeddings** dans **Connections → Defaults** (Connexions → Valeurs par défaut), elle est sélectionnée pour toi, sauf si tu as déjà choisi une autre source.
3. Utilise la même source d'embeddings que ton compte de chat. Les vecteurs d'une taille différente sont ignorés.
4. Clique sur le bouton de vectorisation. Il indique combien d'entrées n'ont pas encore de vecteurs. **Re-vectorize all** (tout revectoriser) refait toutes les entrées.

Si un lorebook n'a aucun vecteur, ou si aucun embedder n'est disponible, l'agent Router construit sa liste de candidats à partir des seuls mots-clés. Rien ne casse. Voir [Recherche sémantique pour les lorebooks](../lorebooks/semantic-search.md).

## Guides associés

- [Recherche sémantique pour les lorebooks](../lorebooks/semantic-search.md)
- [Présentation des lorebooks](../lorebooks/overview.md)
- [Agents : des aides IA pour tes chats](agents-overview.md)
