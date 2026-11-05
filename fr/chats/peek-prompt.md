# Peek Prompt : voir ce que l'IA a reçu

Peek Prompt affiche le texte exact que Marinara Engine a envoyé au modèle pour une réponse, ou un aperçu en direct de la suivante. Sers-t'en quand une réponse ne correspond pas à ce que tu attendais et que tu veux savoir ce que le modèle a vu.

Le prompt, c'est le bloc complet d'instructions et d'historique du chat que Marinara assemble puis envoie. Le modèle le lit et écrit la réponse.

## Ouvrir Peek Prompt

Il existe deux façons d'ouvrir la fenêtre **Assembled Prompt** (prompt assemblé).

Depuis un message :

1. Touche le dernier message de l'IA pour afficher sa barre d'actions.
2. Clique sur **Peek prompt** (voir le prompt), l'icône en forme de loupe.

L'action n'apparaît que sur le dernier message de l'IA. Les messages plus anciens ne l'affichent pas.

Depuis la zone de saisie, ce qui fonctionne aussi avant toute réponse de l'IA :

1. Saisis exactement ce texte dans la zone de message : `{{prompt}}`
2. Appuie sur <kbd>Enter</kbd> ou clique sur **Send** (envoyer).

Marinara vide la zone et ouvre la fenêtre au lieu d'envoyer un message. `{{prompt_preview}}` et `{{preview_prompt}}` font la même chose.

## Ce que montre la fenêtre

Un badge à côté du titre indique quelle version du prompt tu lis.

| Badge | Signification |
| --- | --- |
| **Exact Text Model Request** | La requête littérale envoyée au modèle. |
| **Live Preview** | Un aperçu construit à l'instant. |
| **Raw Messages** | La liste brute des messages. |
| **Prompt Preview** | Un aperçu général. |
| **Decision test preview** | Un prompt construit avec les réponses d'un test de décision. Il n'a pas été envoyé au modèle de chat. |

En dessous, un panneau d'informations peut afficher le service et le modèle, une estimation du nombre de tokens, et le nombre réel de tokens du prompt une fois la réponse terminée. Un token est un petit morceau de texte que les modèles comptent à la place des mots. Le panneau montre aussi des pastilles pour les valeurs employées, comme **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** et **Assistant Prefill**, et des valeurs d'échantillonnage comme **Top P**, **Top K** et **Min P**. Les pastilles comme **Service Tier** et **Assistant Prefill**, ainsi que les valeurs d'échantillonnage, sont des réglages avancés du modèle. Tu peux les ignorer au début. Si le premier modèle a échoué et que ton modèle de secours a écrit la réponse, le panneau nomme le modèle qui a échoué et donne une courte raison, comme "key rejected" ou "rate limited".

Le reste, c'est le prompt découpé en sections repliables, chacune avec sa propre estimation approximative de tokens. Les messages du chat sont regroupés sous **Chat History** (historique du chat). Pour une requête exacte enregistrée, le service a pu fusionner plusieurs tours du chat en un seul bloc : déplie chaque bloc pour voir tout le texte. Clique sur l'en-tête d'une section pour l'ouvrir ou la fermer.

Avec le badge **Exact Text Model Request**, tu lis la requête telle qu'elle a été envoyée pour cette réponse. Elle a été enregistrée avant tout ce qui s'est exécuté après la réponse, comme un résumé automatique ou le masquage de messages : elle peut donc contenir des messages que la prochaine réponse ne recevra pas. Clique sur **Show current context** (afficher le contexte actuel) pour construire le prompt à partir du chat tel qu'il est maintenant, sans l'envoyer. Clique sur **Show sent request** (afficher la requête envoyée) pour revenir en arrière.

### Copier le prompt

Clique sur le bouton de copie à côté du bouton de fermeture. Il copie chaque section et chaque message en texte brut, dans l'ordre d'envoi, y compris les sections fermées. Chaque message commence par une ligne qui nomme son rôle, comme `[system]`, `[user]` ou `[assistant]`. Pour une requête exacte enregistrée, il copie la requête telle qu'elle a été envoyée. La copie n'envoie rien.

### Rechercher du texte dans le prompt

Utilise le champ **Find** (rechercher) en haut, ou appuie sur <kbd>Ctrl</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>F</kbd> sur un Mac) dans la fenêtre. La recherche ne distingue pas les majuscules des minuscules et parcourt tout le prompt, y compris les sections fermées et l'historique du chat. Le compteur affiche l'occurrence actuelle, par exemple "2 of 5". Utilise les boutons haut et bas, ou <kbd>Enter</kbd> et <kbd>Shift</kbd>+<kbd>Enter</kbd>, pour passer d'une occurrence à l'autre. La navigation boucle aux deux extrémités. Tant que **Find** contient du texte, la fenêtre affiche le texte complet des messages. Vide le champ pour revenir aux sections.

## Vérifier une réponse avec Reply checkup

Quand Marinara repère une cause probable d'une réponse décevante, la fenêtre affiche un panneau **Reply checkup** (bilan de la réponse) au-dessus du prompt. Il peut indiquer :

- La fiche de personnage est volumineuse et prend une grosse part du budget du prompt (**Large character card**).
- La réponse a atteint sa limite de tokens et s'est arrêtée au milieu d'une phrase (**Cut off**).
- Le modèle n'a renvoyé aucun texte visible (**Empty reply**).
- Des messages plus anciens n'ont pas été envoyés, parce que le prompt ne tenait pas (**N older messages not sent**).
- Des entrées de lorebook correspondaient, mais ne tenaient pas dans le budget (**N lorebook entries left out**).
- La limite de réponse a été abaissée pour faire de la place au prompt (**Reply limit cut**).

Quand c'est utile, un lien mène au réglage à changer, comme **Max output tokens** ou **Lorebook token budget**.

## Déboguer une réponse inattendue

Ouvre **Assembled Prompt** et vérifie :

- **Informations manquantes.** Si une entrée de lorebook, un souvenir ou un détail du persona ne figure dans aucune section, le modèle ne l'a jamais vu.
- **Pastilles de paramètres.** Une valeur de **Temperature** élevée peut rendre les réponses aléatoires, et une valeur de **Max Output Tokens** basse peut les couper.
- **Chat History.** Vérifie que les messages attendus sont là, dans le bon ordre.
- **Nombre de tokens.** Un prompt volumineux peut pousser les anciens messages hors de la limite du modèle.

Corrige ensuite la cause : modifie une fiche de personnage, ajuste une entrée de lorebook ou change un paramètre de génération. Voir [Paramètres de génération](../prompts/generation-parameters.md).

Pour lire la direction qui a orienté une réponse, utilise **Stored guidance** (consigne enregistrée) sur le message. Voir [Génération guidée et Impersonate](guided-and-impersonate.md#read-stored-guidance).

<a id="testing-decision-statements"></a>

## Tester les énoncés de décision

Un [modèle de décision](../connections/decision-models.md) répond à des questions oui/non pour des fonctionnalités comme les lorebooks. **Decision diagnostics** (diagnostic des décisions), dans Peek Prompt, te permet d'examiner et de tester ces questions pour le chat actuel.

1. Ouvre Peek Prompt et repère **Decision diagnostics**.
2. L'ouvrir, ou cliquer sur **Preview inputs** (aperçu des entrées), prépare les corps des requêtes sans interroger aucun modèle. Déplie **Prepared request bodies** (corps des requêtes préparés) pour voir les messages récents, les énoncés résolus, les options et le format de requête.
3. Clique sur **Test decisions** (tester les décisions) pour poser les questions admissibles à ton modèle de décision.

**Test decisions** effectue de vraies requêtes : un modèle hébergé peut donc les facturer. Le test n'écrit pas de réponse de chat, n'exécute aucun agent, ne modifie pas l'état du jeu et n'enregistre ni ses réponses ni ses temporisations dans le chat. Des énoncés de lorebook ultérieurs peuvent ne devenir accessibles qu'après la réponse à un énoncé précédent. Un test explicite peut attendre un modèle local de raisonnement même quand les décisions ordinaires qui précèdent la réponse sont différées. Cela ne change pas ton réglage pour les réponses en direct.

Chaque résultat affiche son score quand il y en a un, le seuil d'un énoncé oui/non, et la réponse. Un modèle qui ne renvoie que "yes" ou "no" est signalé comme tel, et sa réponse n'est pas présentée comme une probabilité. Les résultats à choix indiquent l'option sélectionnée. Les décisions maintenues, différées, hors limite, indisponibles et échouées ont chacune leur propre explication.

Après un test, le prompt affiché dessous utilise les réponses du test. Clique sur **Show original prompt** (afficher le prompt original) pour revenir à ce que tu avais ouvert, ou sur **Show tested prompt** (afficher le prompt testé) pour revenir à la version testée. **Requests sent and results** (requêtes envoyées et résultats) montre les corps réels des requêtes et les résultats, sans les en-têtes d'authentification.

Si ça n'a pas marché : **Could not prepare the decision test. Check the chat connection and try again.** Vérifie que le chat a un modèle qui fonctionne, puis réessaie.

Les tests utilisent le chat et les réglages actuels, même si tu as ouvert Peek Prompt depuis une ancienne réponse. Ils ne reconstituent pas les requêtes de décision d'origine. Ils couvrent les énoncés du prompt et les décisions des lorebooks, pas l'activation des agents ni les décisions après la réponse.

Quand **Use Decision model** (utiliser le modèle de décision) est activé pour Advanced Memory (la fonctionnalité de mémoire à long terme de Marinara, voir [Mémoire et résumés de chat](../agents/memory.md)), le panneau affiche aussi **Advanced Memory activity** (activité d'Advanced Memory). Ces rapports enregistrés montrent le dernier rappel et la dernière vérification de fin de scène, avec leur modèle, leur durée, leurs scores, leurs sélections et l'état du repli. Ils décrivent des appels passés, pas l'aperçu actuel, et peuvent apparaître même quand le prompt ne contient aucun énoncé de décision. Les swipes compatibles peuvent réutiliser un rapport de rappel précédent. Chaque rapport conserve jusqu'à 128 résultats, les sélectionnés en premier, et compte les autres. Les nouveaux rapports apparaissent après le prochain appel admissible au modèle de décision. Les consulter n'envoie aucune requête au modèle.
