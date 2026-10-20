# Peek Prompt : voir ce que l'IA a reçu

La fonction **Peek Prompt** (aperçu du prompt) affiche le texte exact que Marinara Engine a envoyé au modèle d'IA pour obtenir une réponse. Elle peut aussi afficher un aperçu en direct du prompt avant tout envoi. Ce guide explique ce que montre la fenêtre, comment l'ouvrir, comment lire les directions enregistrées et comment s'en servir pour comprendre une réponse.

Un prompt, c'est le bloc complet d'instructions et d'historique du chat que Marinara assemble puis envoie au modèle. Le modèle lit ce bloc et rédige une réponse. Avec Peek Prompt, tu vois ce bloc une fois assemblé : plus rien de mystérieux dans les réponses.

## Ce que montre Peek Prompt

Quand tu ouvres Peek Prompt, une fenêtre intitulée **Assembled Prompt** (prompt assemblé) apparaît. Elle comporte trois parties.

Un badge de provenance se trouve en haut, à côté du titre. Il indique quelle version du prompt tu consultes :

- **Exact Text Model Request** : la requête littérale envoyée au modèle.
- **Live Preview** : un aperçu reconstruit à l'instant.
- **Raw Messages** : la liste brute des messages.
- **Prompt Preview** : un aperçu général.
- **Decision test preview** : un prompt assemblé avec les réponses d'un test de décision explicite. Il n'a pas été envoyé au modèle de chat.

Sous le badge se trouve un panneau d'informations sur la génération. Il peut afficher le nom du fournisseur et du modèle, une estimation du nombre de tokens, et le nombre réel de tokens du prompt une fois la réponse terminée. Un token est un petit morceau de texte : les modèles comptent en tokens plutôt qu'en mots. Ce panneau montre aussi de petites pastilles pour les valeurs employées, comme **Temperature**, **Max Output Tokens**, **Thinking**, **Reasoning**, **Verbosity**, **Service Tier** et **Assistant Prefill**. Des valeurs d'échantillonnage comme **Top P**, **Top K** et **Min P** peuvent également y figurer. Si la connexion à laquelle la réponse était destinée a échoué et que ta connexion de secours l'a écrite à sa place, le panneau indique aussi la connexion qui a échoué, son modèle et une courte raison, comme "key rejected" ou "rate limited".

Le reste de la fenêtre, c'est le prompt lui-même, découpé en sections repliables. Chaque section porte une étiquette et sa propre estimation approximative de tokens. Les messages du chat sont regroupés dans une seule section **Chat History** (historique du chat). Pour une requête exacte enregistrée, le fournisseur a parfois fusionné plusieurs tours de chat en un seul bloc. Déplie chaque bloc pour inspecter tout le texte visible par le modèle. Clique sur l'en-tête d'une section pour l'ouvrir ou la refermer.

Pour emporter tout le prompt ailleurs, clique sur le bouton de copie à côté du bouton de fermeture, en haut de la fenêtre. Il copie chaque section et chaque message du chat en texte brut, dans l'ordre d'envoi, y compris les sections que tu n'as pas ouvertes. Chaque message commence par une ligne qui nomme son rôle, comme `[system]`, `[user]` ou `[assistant]`. Pour une requête exacte enregistrée, il copie cette requête telle qu'elle a été envoyée. La copie n'envoie rien au modèle et ne modifie pas le prompt.

## Ouvrir Peek Prompt

Il existe deux façons d'ouvrir la fenêtre.

La première passe par la barre d'actions du message. Voici la marche à suivre :

1. Survole le dernier message de l'IA dans le chat.
2. Repère l'action **Peek prompt**. Son icône est une loupe.
3. Clique dessus. La fenêtre **Assembled Prompt** s'ouvre.

L'action **Peek prompt** n'apparaît que sur le dernier message de l'IA. Les messages plus anciens ne la proposent pas.

La seconde façon est un raccourci à taper. Il fonctionne même avant toute réponse de l'IA, ce qui permet de prévisualiser le prompt à l'avance. Voici la marche à suivre :

1. Clique dans le champ de saisie du message.
2. Saisis exactement ce texte :

```
{{prompt}}
```

3. Appuie sur Enter ou clique sur Send.

Au lieu d'envoyer un message, Marinara vide le champ et ouvre la fenêtre Peek Prompt. Les raccourcis `{{prompt_preview}}` et `{{preview_prompt}}` font la même chose.

## Lire les directions enregistrées

La génération guidée permet d'orienter une réponse avec une instruction hors personnage. Quand un message a été produit avec une direction enregistrée, il porte une action distincte, **Stored guidance** (direction enregistrée). Son icône est un petit parchemin. Cette action apparaît aussi sur les messages produits avec la commande `/impersonate`.

Clique sur **Stored guidance** pour ouvrir une fenêtre qui affiche la direction employée pour ce message. Pour un message guidé, la fenêtre précise d'où venait la direction :

- **/guided** : tu as utilisé la commande slash `/guided`.
- **Guided regenerate** : tu as régénéré le message avec une direction saisie.
- **Game start** : la direction vient de la configuration de Game Mode.

Un bouton **Copy /guided** apparaît uniquement pour les directions **/guided** et **Guided regenerate**. Il recopie la direction sous forme de commande `/guided`. Colle cette commande plus tard pour réutiliser la même orientation. Le bouton n'apparaît pas pour les directions **Game start**.

Pour un message d'impersonation, la fenêtre affiche les détails de l'impersonation au lieu d'une direction unique. Le déroulé complet de la génération guidée et de l'impersonation est décrit dans le guide indiqué plus bas.

## Comprendre une réponse avec Peek Prompt

Peek Prompt est l'outil idéal quand une réponse te surprend. Sers-t'en dès qu'un personnage oublie un élément, ignore une règle ou sort de son rôle.

Ouvre la fenêtre **Assembled Prompt** et vérifie ces points :

- Cherche les informations manquantes. Si une entrée de lorebook, un souvenir ou un détail du persona ne figure dans aucune section, le modèle ne l'a jamais vu.
- Regarde les pastilles de paramètres. Une valeur de **Temperature** très élevée rend les réponses aléatoires, et une valeur de **Max Output Tokens** trop basse coupe les réponses.
- Déplie la section **Chat History**. Vérifie que les messages attendus sont bien là, et dans le bon ordre.
- Lis le nombre réel de tokens après une réponse. Un prompt très volumineux peut pousser les anciens messages hors de la limite du modèle.

Une fois que tu sais ce que le modèle a réellement reçu, tu peux corriger la cause. Par exemple : modifier une fiche de personnage, ajuster une entrée de lorebook ou changer une valeur dans les paramètres de génération.

<a id="testing-decision-statements"></a>

## Tester les déclarations de décision

Ouvre **Decision diagnostics** (diagnostic des décisions) dans Peek Prompt pour examiner les déclarations du prompt et les décisions des lorebooks du chat actuel. Ouvrir le panneau ou choisir **Preview inputs** (aperçu des entrées) prépare les corps des requêtes sans interroger le modèle de décision ni démarrer un modèle local. Déplie **Prepared request bodies** (corps des requêtes préparés) pour voir les messages récents, les déclarations résolues, les options et le format de requête propre au modèle. D'autres déclarations de lorebooks peuvent ne devenir accessibles qu'après la réponse à une décision précédente.

Choisis **Test decisions** (tester les décisions) pour envoyer les questions admissibles au modèle de décision sélectionné. Cela effectue de vraies requêtes de décision, qu'un modèle hébergé peut facturer. Le test ne génère pas de réponse de chat, n'exécute aucun agent, ne modifie pas l'état du jeu et n'enregistre ni ses réponses ni ses temporisations dans le chat.

Un test explicite peut attendre un modèle local de raisonnement même lorsque les décisions ordinaires précédant la réponse sont différées. Cela ne change pas ta préférence pour les réponses en cours ; l'aperçu des entrées n'envoie toujours aucune requête au modèle.

Chaque résultat affiche son score, s'il est disponible, le seuil appliqué à une déclaration oui/non et la réponse obtenue. Un modèle qui ne renvoie qu'un mot oui/non est signalé comme tel ; sa réponse n'est pas présentée comme une probabilité. Les résultats Choice indiquent l'option sélectionnée. Les décisions maintenues, différées, hors limite, indisponibles ou échouées ont chacune leur explication, afin de ne pas confondre une absence de réponse avec un score faible.

Après un test, le prompt affiché dessous utilise ses réponses. **Show original prompt** (afficher le prompt original) revient au contenu ouvert initialement ; **Show tested prompt** (afficher le prompt testé) revient à la version du test. **Requests sent and results** (requêtes envoyées et résultats) montre les corps réels des requêtes de décision et les résultats reçus, sans en-têtes d'authentification.

Les tests utilisent le chat et les réglages actuels, même si Peek Prompt a été ouvert depuis une ancienne réponse. Ils ne reconstituent pas les requêtes de décision d'origine. Ils couvrent les déclarations du prompt et les décisions des lorebooks ; ils ne lancent ni l'activation des agents ni les décisions après réponse. Peek Prompt reste passif tant que tu ne choisis pas explicitement **Test decisions**.

Lorsque **Use Decision model** (utiliser le modèle de décision) est activé pour Advanced Memory, le panneau affiche aussi **Advanced Memory activity** (activité d'Advanced Memory). Ces rapports enregistrés décrivent le dernier rappel et la dernière vérification de fin de scène, avec leur modèle, durée, scores, sélections et état du repli. Ils peuvent apparaître même sans déclaration de décision dans le prompt. Ils décrivent de vrais appels passés, pas l'aperçu actuel ni une répétition de l'ancienne réponse sélectionnée. Les swipes compatibles peuvent réutiliser un rapport de rappel précédent. Chaque rapport conserve jusqu'à 128 résultats, les sélectionnés en premier ; les résultats omis sont comptés. Les nouveaux rapports apparaissent après le prochain appel admissible au modèle de décision. Les consulter n'envoie aucune requête au modèle.

## Guides associés

- [Paramètres de génération](../prompts/generation-parameters.md)
- [Éditeur de presets et gestionnaire de prompts](../prompts/presets.md)
- [Modèles de décision](../connections/decision-models.md)
- [Génération guidée et impersonation](guided-and-impersonate.md)
- [Actions sur les messages : modifier, supprimer, swipe, régénérer](messages.md)
