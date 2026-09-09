# Outils personnalisés et appel de fonctions

Ce guide explique les outils personnalisés, aussi appelés **Functions** (fonctions), dans Marinara Engine. Un outil personnalisé apprend à l'IA à exécuter une petite action pendant un chat, une conversation enregistrée. Il peut renvoyer un texte fixe, interroger une adresse web extérieure ou exécuter un court script sur le serveur. Au programme : comment en créer un, comment activer l'usage des outils dans un chat, et comment garder les outils de type script sans danger.

## Ce qu'est l'appel de fonctions

L'appel de fonctions permet à l'IA de demander à l'application d'exécuter une action, puis d'utiliser le résultat dans sa réponse. L'application fournit déjà des outils intégrés : jets de dés, recherche dans les lorebooks, mise à jour de l'état du jeu. Les outils personnalisés côtoient ces outils intégrés dans le même système **Function Calling** (appel de fonctions).

Voici le genre de choses qu'un outil personnalisé peut faire :

- Renvoyer un fait fixe, comme tes horaires d'ouverture ou un ensemble de règles maison.
- Demander des données en direct à un service extérieur, comme la météo ou un appareil domotique.
- Faire un calcul rapide, comme additionner des nombres ou produire un tirage particulier.

Un outil personnalisé n'est pas rattaché à une fiche de personnage. Tu l'actives plutôt pour un chat, ou tu le rattaches à un agent. Un agent est un module auxiliaire qui tourne en parallèle du chat. Les deux méthodes sont décrites plus bas.

Les appels natifs de fonctions nécessitent une connexion compatible avec les outils. Les transports par abonnement Claude et Grok ignorent les définitions natives d'outils : **Chat Settings** (réglages du chat) affiche donc une indication de disponibilité et désactive les contrôles des outils pour ces connexions. Leurs commandes textuelles et balises de dés restent disponibles. Les chats Game peuvent choisir une connexion séparée pour planifier les outils ; consulte [Planification facultative des outils et recherches dans le lore](../game/getting-started.md#optional-tool-planning-and-lore-searches) pour connaître son coût et son fonctionnement.

Les recherches dans les lorebooks classent les résultats par sens lorsque les entrées activées ont des vecteurs compatibles. Conversation et Roleplay conservent la recherche textuelle si la recherche sémantique est indisponible. La recherche de lore de Game s'active séparément et signale les vecteurs absents ou incompatibles ; elle ne vectorise jamais un livre automatiquement.

## La section Functions

Les outils personnalisés se créent et se gèrent dans le panneau **Presets** (presets).

1. Ouvre la barre du haut et clique sur **Presets**.
2. Repère la section **Functions** (son icône est une clé à molette).
3. Sous l'en-tête s'affiche la légende **Custom function calls available from Chat Settings**.

L'en-tête de la section comporte trois boutons-icônes :

- **Create function** (créer une fonction, icône plus) ouvre un éditeur d'outil vierge.
- **Import functions from ZIP or JSON** (importer des fonctions, icône de téléchargement) ouvre un sélecteur de fichiers.
- **Export functions to ZIP** (exporter les fonctions vers un ZIP, icône de téléversement) enregistre tous tes outils dans un seul fichier. Ce bouton est grisé tant que tu n'as aucun outil.

Chaque outil de la liste affiche son nom et deux petites pastilles (le type et le nombre de paramètres). S'y ajoutent une courte description, un interrupteur marche/arrêt, un bouton **Edit function** (modifier la fonction) et un bouton **Delete function** (supprimer la fonction). Un outil de type **Script** affiche en plus une pastille ambre **Script disabled** quand les outils de type script sont désactivés sur le serveur. La section Type d'exécution : Script, plus bas, explique comment les activer. Fais glisser un outil par sa poignée pour réorganiser la liste. Cet ordre ne sert qu'à l'affichage et ne change rien au comportement. Tant que tu n'as créé aucun outil, la liste indique **No functions yet**.

La gestion des outils (création, modification, suppression, réorganisation et interrupteur marche/arrêt) passe par une partie protégée de l'application. Si tu gères les outils depuis un autre appareil que l'ordinateur qui fait tourner le serveur, tu dois d'abord enregistrer un secret d'administration. Consulte la [Référence de configuration du serveur](../CONFIGURATION.md) et la remarque de la section Sécurité des scripts, plus bas.

## Créer un outil

Voici la marche à suivre pour construire un outil :

1. Dans la section **Functions**, clique sur **Create function**. L'éditeur d'outil complet s'ouvre.
2. Dans le champ de nom, en haut, saisis un nom en minuscules et en snake_case. C'est exactement ce nom que l'IA utilise pour appeler l'outil. Un nom valide commence par une lettre minuscule, puis n'emploie que des lettres minuscules, des chiffres et des tirets bas. Exemple : `check_weather`.
3. Remplis le champ **Description** (description). Rédige-le comme une consigne adressée à l'IA, car c'est ce texte qu'elle lit pour décider quand appeler l'outil. Exemple : `Get the current weather for a city the user names.`
4. Ajoute les **Parameters** (paramètres) dont l'outil a besoin (voir la section suivante).
5. Choisis un **Execution Type** (type d'exécution) : **Static Result**, **Webhook** ou **Script**.
6. Remplis le champ correspondant au type choisi.
7. Clique sur **Save** (enregistrer). Un **Saved** vert clignote brièvement à côté du bouton.

Quelques règles à connaître :

- Le nom doit compter de 1 à 100 caractères. La description, de 1 à 500 caractères.
- Deux outils ne peuvent pas porter le même nom. Un nom d'outil intégré est également interdit (voir Noms réservés, plus bas).
- Si tu quittes l'éditeur avec des modifications non enregistrées, une bannière propose **Keep editing** (continuer à modifier), **Discard** (abandonner) ou **Save & close** (enregistrer et fermer).

## Le constructeur de paramètres

Les paramètres sont les valeurs d'entrée que l'IA transmet quand elle appelle ton outil. Chaque paramètre a un nom, un type, un indicateur d'obligation et une description.

1. Dans le groupe **Parameters**, clique sur **Add Parameter** (ajouter un paramètre).
2. Saisis un nom de paramètre, par exemple `city`.
3. Choisis un type dans le menu déroulant : `string`, `number`, `boolean`, `array` ou `object`.
4. Active **Required** (obligatoire) si l'IA doit toujours envoyer cette valeur.
5. Rédige une description qui indique à l'IA ce que représente la valeur. Exemple : `The city name to look up, such as Tokyo.`

Ajoute d'autres lignes avec **Add Parameter**, ou supprime une ligne avec son bouton moins. Une ligne laissée sans nom est écartée à l'enregistrement. De bonnes descriptions de paramètres comptent beaucoup : c'est ainsi que l'IA comprend quoi envoyer.

Si un outil ne semble jamais appelé, une configuration de paramètres cassée en est une cause fréquente. Cela arrive surtout quand tu importes un outil issu d'un fichier modifié à la main dont les paramètres sont invalides. Dans ce cas, l'application ignore silencieusement l'outil pendant la génération et se contente d'écrire une note dans le log du serveur, le journal du serveur.

## Type d'exécution : Static Result

Un outil **Static Result** (résultat fixe) renvoie le même texte à chaque appel de l'IA. Il ne dépend d'aucun service extérieur et fonctionne immédiatement pour tout le monde. Sa carte indique **Returns a fixed string when called.**

Le seul champ est **Static Result**, une zone de texte multiligne. Tout ce que tu y écris est renvoyé à l'IA lorsqu'elle appelle l'outil. Si tu le laisses vide, l'outil renvoie `OK`.

Exemple concret. Crée un outil nommé `store_hours` sans aucun paramètre. Dans la zone **Static Result**, saisis ceci :

```
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Désormais, quand l'IA appelle `store_hours`, elle reçoit ce texte en retour et peut annoncer tes horaires. L'IA voit ton texte accompagné du nom de l'outil et des arguments qu'elle a envoyés, et non la ligne brute toute seule.

## Type d'exécution : Webhook

Un outil **Webhook** envoie l'appel de ton outil à une adresse web extérieure et renvoie la réponse de ce service à l'IA. Un webhook est une adresse web qui accepte des données et en renvoie. Sa carte indique **Sends a POST request to an external URL.**

Le seul champ est **Webhook URL** (URL du webhook). L'application envoie une requête POST à cette adresse. Une requête POST est une façon d'envoyer des données à un service web. Le corps de la requête est du JSON, un format texte pour les données structurées, de cette forme :

```
{ "tool": "your_tool_name", "arguments": { ... } }
```

Le service doit répondre en JSON ou en texte brut. Cette réponse est transmise à l'IA.

Exemple concret. Crée un outil nommé `check_weather` avec un paramètre obligatoire de type chaîne nommé `city`. Renseigne le champ **Webhook URL** avec l'adresse de ton propre service :

```
https://api.example.com/weather
```

Quand l'IA appelle `check_weather` avec `city` réglé sur Tokyo, ton service reçoit la requête, consulte la météo et répond. L'IA utilise ensuite cette réponse dans son message.

À savoir sur les webhooks :

- La réponse est plafonnée à 512 Ko.
- Chaque appel est soumis à un délai d'expiration fixé par le serveur. Par défaut, 60 secondes.
- Par défaut, seules les adresses en `https://` sont autorisées. Les adresses privées et locales, comme `localhost` ou une adresse de réseau domestique, sont bloquées. Un administrateur du serveur doit activer un réglage pour autoriser les adresses locales. Consulte la [Référence de configuration du serveur](../CONFIGURATION.md).
- Si l'appel échoue ou expire, l'IA reçoit un résultat d'erreur au lieu de faire planter le chat.

## Type d'exécution : Script

Un outil **Script** exécute un court morceau de JavaScript sur le serveur et en renvoie le résultat. JavaScript est un langage de programmation courant. Sa carte indique **Runs a JavaScript expression server-side.**

Les outils de type script sont désactivés par défaut, par sécurité. Si ton serveur ne les a pas activés, la carte **Script** est grisée et un avertissement apparaît. Pour activer les scripts, l'administrateur du serveur ajoute cette ligne dans le fichier `.env` du serveur, puis redémarre l'application :

```
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

Le seul champ est **Script Body** (corps du script). Ton script peut lire `args` (les valeurs envoyées par l'IA) et doit faire un `return` d'un résultat. Tu as aussi accès à `JSON`, `Math` et `Date`.

Exemple concret. Crée un outil nommé `add_numbers` avec deux paramètres numériques obligatoires nommés `x` et `y`. Dans la zone **Script Body**, saisis ceci :

```
const result = args.x + args.y;
return { sum: result };
```

Quand l'IA appelle `add_numbers` avec `x` réglé sur 2 et `y` sur 3, l'outil renvoie une somme de 5. Si ton script lève une erreur, l'IA reçoit un résultat d'erreur au lieu d'un plantage. Lis la section Sécurité des scripts, plus bas, avant d'activer les scripts.

## Inclure le contexte caché du chat

Les outils **Webhook** comme les outils **Script** peuvent recevoir un objet de contexte caché. Il s'agit de données de chat supplémentaires que l'IA ne voit pas comme des entrées d'outil. Active l'interrupteur **Include hidden chat context** (inclure le contexte caché du chat) dans l'éditeur d'outil. Il est désactivé par défaut.

Une fois activé, ton webhook ou ton script reçoit une valeur `context` en plus des arguments. Elle peut contenir le mode du chat, le nom du persona actif et les noms des personnages présents dans le chat. Elle peut aussi contenir les variables de chat enregistrées et, en Game Mode, l'état du jeu. Ton outil peut ainsi personnaliser son résultat sans que l'IA ait à transmettre elle-même toutes ces données.

## Activer l'usage des outils dans un chat

Créer un outil ne suffit pas à ce que l'IA s'en serve. Tu dois aussi activer l'usage des outils pour le chat.

1. Ouvre un chat et clique sur la roue dentée pour ouvrir **Chat Settings** (réglages du chat).
2. Ouvre la section **Function Calling** (son icône est une clé à molette).
3. Active **Enable Tool Use** (autoriser l'usage des outils). Sa description indique **Allow AI to call functions (dice rolls, game state, etc.)**. Ce réglage est désactivé par défaut dans un nouveau chat.

Avec **Enable Tool Use** activé et aucun outil ajouté en dessous, le chat peut utiliser tous les outils activés globalement. Cela comprend les outils intégrés, comme les jets de dés et la recherche dans les lorebooks, ainsi que chaque outil personnalisé que tu as activé dans la section **Functions**. Pour limiter un chat à une sélection précise, ajoute des outils spécifiques :

1. Clique sur **Add Functions** (ajouter des fonctions). Un sélecteur s'ouvre avec un champ de recherche.
2. Coche les outils voulus. La liste mélange les outils intégrés et tes propres outils personnalisés.
3. Clique sur **Add Selected** (ajouter la sélection) pour les ajouter.

Dès que tu ajoutes un ou plusieurs outils, seuls ces outils fonctionnent dans ce chat. Autre option : clique sur **New Custom Function** (nouvelle fonction personnalisée) dans le sélecteur pour aller directement à l'éditeur d'outil. Le champ de recherche du sélecteur ne compare que les noms d'outils, pas les descriptions.

## Rattacher des outils à un agent

Tu peux aussi confier un outil à un agent plutôt qu'à un chat. Un agent est un module semi-autonome, par exemple un gardien de lorebook ou un sélectionneur de musique, qui s'exécute pendant la génération.

1. Ouvre le panneau **Agents** et ouvre un agent.
2. Ouvre son groupe **Tools / Function Calling**.
3. Active les outils que cet agent doit utiliser.

Même avec un agent configuré, il faut toujours activer **Enable Tool Use** dans la section **Function Calling** du chat. Une remarque sur le vocabulaire : le pied de page de l'éditeur d'agent demande d'activer "Enable Function Calling". L'interrupteur sur lequel tu cliques s'appelle en réalité **Enable Tool Use**. Il s'agit du même contrôle. Pour une présentation plus détaillée des agents, consulte [Créer des agents personnalisés](../agents/custom-agents.md).

## Sécurité des scripts

Un outil **Script** exécute du vrai code sur ton serveur : sois prudent. L'application exécute chaque script dans un bac à sable, un espace cloisonné qui limite ce que le code peut faire. Voici ces limites :

- Aucun accès réseau. Un script ne peut appeler ni internet ni aucune adresse web.
- Aucun accès aux fichiers. Un script ne peut ni lire ni écrire de fichiers sur le serveur.
- Aucun accès aux variables d'environnement ni aux secrets du serveur.
- Un délai d'expiration. Un script trop long est arrêté. La limite par défaut est de 60 secondes.

Cela protège des accidents et bloque l'accès au réseau et aux fichiers. Ce n'est pas une isolation complète au niveau du système d'exploitation. Quelqu'un qui peut créer des outils reste capable d'écrire un script qui gaspille le processeur ou la mémoire du serveur. N'active les outils de type script que sur des serveurs de confiance. Sois prudent quand tu importes des outils de type script écrits par d'autres personnes.

La gestion des outils depuis un autre appareil est elle aussi protégée. Si tu n'es pas sur l'ordinateur qui fait tourner le serveur, enregistre un secret d'administration dans **Settings** (Paramètres), puis **Advanced**, puis **Admin Access**. Ce secret doit correspondre au réglage du serveur. Pour le côté serveur, consulte la [Référence de configuration du serveur](../CONFIGURATION.md).

## Exporter et importer

Les outils se déplacent d'une installation à l'autre.

- Pour exporter un seul outil, ouvre-le et clique sur **Export function** (exporter la fonction). Un fichier `.json` est enregistré.
- Pour exporter tous les outils, clique sur **Export functions to ZIP** dans la section **Functions**.
- Pour importer, clique sur **Import functions from ZIP or JSON** et choisis un fichier `.json` ou `.zip`. Un message indique combien d'outils ont été importés.

Les outils de type Webhook et Script importés sont toujours enregistrés désactivés, avec l'interrupteur **Include hidden chat context** désactivé lui aussi, même si le fichier réclame l'une ou l'autre permission. Après l'import, Marinara affiche le type d'exécution, la destination du webhook le cas échéant et les permissions demandées par le fichier. Ouvre chaque outil exécutable importé, examine-le, puis ne l'active que si tu lui fais confiance. Les outils de type Static conservent l'état d'activation qu'ils avaient dans le fichier.

Un import ignore tout outil dont le nom entre en conflit avec un outil existant ou avec un nom d'outil intégré. Les packages d'agents n'embarquent ni n'importent les outils personnalisés : exporte séparément les fonctions de confiance, examine-les dans **Function Calls**, puis rattache-les explicitement après avoir importé l'agent.

## Noms réservés

Le nom de ton outil personnalisé ne peut pas correspondre à un nom d'outil intégré. Parmi ces noms intégrés figurent `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` et `update_about_me`. Si tu essaies d'en enregistrer un, tu obtiens ce message :

```
"your_name" is a reserved built-in tool name.
```

Deux outils personnalisés ne peuvent pas non plus porter le même nom. Réutiliser un nom affiche un message signalant qu'un outil de ce nom existe déjà.

## Dépannage

L'IA n'appelle jamais mon outil.

- Vérifie que **Enable Tool Use** est activé dans la section **Function Calling** du chat.
- Si tu as ajouté des outils précis au chat, vérifie que ton outil figure dans cette liste.
- Vérifie que l'interrupteur marche/arrêt de l'outil, dans la section **Functions**, est activé.
- Rends la **Description** et les descriptions de paramètres plus claires, pour que l'IA sache quand appeler l'outil.
- Si tu as importé l'outil, une configuration de paramètres cassée peut pousser l'application à l'ignorer. Reconstruis les paramètres à la main.

La carte Script est grisée.

- Les scripts sont désactivés sur ce serveur. Demande à l'administrateur de définir `CUSTOM_TOOL_SCRIPT_ENABLED=true` et de redémarrer. Consulte la [Référence de configuration du serveur](../CONFIGURATION.md).

Mon webhook échoue ou expire.

- Vérifie que l'adresse commence par `https://` et qu'elle est joignable.
- Une adresse locale est bloquée tant que l'administrateur n'autorise pas les adresses locales. Consulte la [Référence de configuration du serveur](../CONFIGURATION.md).
- Les services lents peuvent atteindre la limite de 60 secondes.

Je n'arrive pas à créer ou modifier des outils depuis mon téléphone ou un autre appareil.

- Enregistre un secret d'administration correspondant dans **Settings**, puis **Advanced**, puis **Admin Access**.

## Guides associés

- [Créer des agents personnalisés](../agents/custom-agents.md)
- [Intégration de Home Assistant](../integrations/home-assistant.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
