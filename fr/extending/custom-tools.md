# Outils personnalisés et appel de fonctions

Un outil personnalisé (aussi appelé fonction) permet à l'IA d'exécuter une petite action pendant un chat. L'action peut renvoyer un texte fixe, appeler une adresse web ou exécuter un court script sur le serveur. Utilises-en un quand tu veux que l'IA cherche une information ou fasse un calcul au lieu de deviner.

L'appel de fonctions, c'est quand l'IA demande à l'application d'exécuter une action, puis utilise le résultat dans sa réponse. Marinara fournit déjà des outils intégrés, comme les jets de dés, la recherche dans les lorebooks et la mise à jour de l'état du jeu. Tes outils personnalisés fonctionnent à côté d'eux. Un outil personnalisé n'est pas rattaché à une fiche de personnage. Tu l'actives pour un chat, ou tu le rattaches à un agent (une aide qui tourne en parallèle de ton chat).

> **Remarque :** les outils exigent une connexion qui les prend en charge. Les connexions par abonnement Claude et Grok ignorent les définitions d'outils : **Chat Settings** (réglages du chat) affiche donc un avis et désactive les contrôles des outils pour elles. Les commandes textuelles et les balises de dés fonctionnent toujours.

## Créer un outil

Avant de commencer, ouvre le panneau **Presets** depuis la barre du haut. Les outils se trouvent dans sa section **Functions** (fonctions, icône de clé à molette). Si tu ouvres Marinara depuis un autre appareil, enregistre d'abord le secret d'administration dans **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur). Il doit correspondre au `ADMIN_SECRET` du serveur ; consulte la [Référence de configuration du serveur](../CONFIGURATION.md).

Pour un premier essai, choisis **Static Result** (résultat fixe) : il n'a besoin de rien d'autre.

### Création d'un outil

1. Ouvre **Presets** et repère **Functions**.
2. Clique sur **Create function** (créer une fonction, icône plus). Un éditeur d'outil vierge s'ouvre.
3. Saisis un nom en minuscules et en snake_case, comme `check_weather`. C'est exactement ce nom que l'IA appelle. Il commence par une lettre minuscule, puis n'emploie que des lettres minuscules, des chiffres et des tirets bas.
4. Remplis **Description** (description). Rédige-la comme une consigne adressée à l'IA, car c'est ce texte qu'elle lit pour décider quand appeler l'outil. Exemple : `Get the current weather for a city the user names.`
5. Ajoute les paramètres dont l'outil a besoin (voir [Ajouter des paramètres](#add-parameters)).
6. Choisis un **Execution Type** (type d'exécution) : **Static Result**, **Webhook** ou **Script**.
7. Remplis le champ correspondant à ce type (voir [Choisir un type d'exécution](#choose-an-execution-type)).
8. Clique sur **Save** (enregistrer). Un **Saved** vert s'affiche brièvement près du bouton.

Règles pour les noms et les descriptions :

- Le nom compte de 1 à 100 caractères. La description compte de 1 à 500 caractères.
- Deux outils ne peuvent pas porter le même nom, et un outil ne peut pas utiliser un nom intégré comme `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` ou `update_about_me`. Un conflit affiche un message comme `"your_name" is a reserved built-in tool name.`
- Si tu quittes l'éditeur avec des modifications non enregistrées, une bannière propose **Keep editing** (continuer à modifier), **Discard** (abandonner) ou **Save & close** (enregistrer et fermer).

L'en-tête de **Functions** comporte trois boutons-icônes :

- **Create function** (icône plus)
- **Import functions from ZIP or JSON** (importer des fonctions depuis un ZIP ou un JSON)
- **Export functions to ZIP** (exporter les fonctions vers un ZIP), grisé tant que tu n'as aucun outil

Chaque outil de la liste affiche :

- son nom, son type, son nombre de paramètres et sa description
- un interrupteur marche/arrêt
- **Edit function** (modifier la fonction) et **Delete Function** (supprimer la fonction)

Fais glisser un outil par sa poignée pour réorganiser la liste. Cet ordre ne sert qu'à l'affichage. Tant que tu n'as aucun outil, la liste indique **No functions yet**.

<a id="add-parameters"></a>

## Ajouter des paramètres

Les paramètres sont les valeurs d'entrée que l'IA envoie quand elle appelle ton outil. Chacun a un nom, un type, un indicateur d'obligation et une description.

1. Dans le groupe **Parameters** (paramètres), clique sur **Add Parameter** (ajouter un paramètre).
2. Saisis un nom, comme `city`.
3. Choisis un type : `string`, `number`, `boolean`, `array` ou `object`.
4. Active **Required** (obligatoire) si l'IA doit toujours envoyer cette valeur.
5. Rédige une description qui indique à l'IA ce que représente la valeur, comme `The city name to look up, such as Tokyo.`

Ajoute d'autres lignes avec **Add Parameter**, ou supprime une ligne avec son bouton moins. Une ligne dont le nom est vide est écartée à l'enregistrement.

Si l'IA ne semble jamais appeler un outil importé, ses paramètres sont peut-être invalides : l'application ignore alors l'outil sans te prévenir. Supprime les paramètres et ajoute-les de nouveau à la main.

<a id="choose-an-execution-type"></a>

## Choisir un type d'exécution

### Static Result

Un outil **Static Result** renvoie le même texte à chaque fois. Il n'a besoin d'aucun service extérieur. Sa carte indique **Returns a fixed string when called.**

Le seul champ est **Static Result**, une zone de texte multiligne. Si tu le laisses vide, l'outil renvoie `OK`.

Exemple : un outil nommé `store_hours`, sans paramètre, avec ce **Static Result** :

```text
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Quand l'IA appelle `store_hours`, elle reçoit ce texte avec le nom de l'outil et les arguments qu'elle a envoyés, et peut annoncer tes horaires à l'utilisateur.

### Webhook

Un outil **Webhook** envoie l'appel à une adresse web et renvoie la réponse de ce service à l'IA. Un webhook est une adresse qui accepte des données et en renvoie. Sa carte indique **Sends a POST request to an external URL.**

Le seul champ est **Webhook URL** (URL du webhook). L'application envoie une requête POST, une façon d'envoyer des données à un service web. Le corps est du JSON, un format texte pour les données structurées, de cette forme :

```json
{ "tool": "your_tool_name", "arguments": { ... } }
```

Si tu actives **Include hidden chat context** (inclure le contexte caché du chat), le corps contient aussi une valeur `context`. Le service répond en JSON ou en texte brut, et cette réponse est transmise à l'IA.

Exemple : un outil nommé `check_weather` avec un paramètre obligatoire de type chaîne, `city`, et cette **Webhook URL** :

```text
https://api.example.com/weather
```

Quand l'IA l'appelle avec `city` réglé sur Tokyo, ton service consulte la météo et répond, et l'IA utilise la réponse dans son message.

Limites :

- La réponse est plafonnée à 512 Ko.
- Chaque appel a un délai maximal. Par défaut, 60 secondes (`CUSTOM_TOOL_TIMEOUT_MS`).
- Par défaut, seules les adresses en `https://` sont autorisées. Les adresses privées et locales, comme `localhost` ou une adresse de réseau domestique, sont bloquées tant qu'un administrateur du serveur ne les autorise pas. Consulte la [Référence de configuration du serveur](../CONFIGURATION.md).
- Si l'appel échoue ou expire, l'IA reçoit un résultat d'erreur et le chat continue.

Si ça n'a pas marché : vérifie que l'adresse commence par `https://` et qu'elle est joignable. Une adresse locale reste bloquée tant que l'administrateur ne l'autorise pas. Un service lent peut atteindre la limite de 60 secondes.

### Script

Un outil **Script** exécute un court morceau de JavaScript sur le serveur et en renvoie le résultat. JavaScript est un langage de programmation courant. Sa carte indique **Runs a JavaScript expression server-side.**

Les outils de type script sont désactivés par défaut. Si ton serveur ne les a pas activés, la carte **Script** est grisée et une pastille ambre **Script disabled** s'affiche. Pour les activer, l'administrateur du serveur ajoute cette ligne dans le fichier `.env` du serveur et redémarre Marinara :

```text
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

Le seul champ est **Script Body** (corps du script). Le script lit `args` (les valeurs envoyées par l'IA) et doit faire un `return` d'un résultat. `JSON`, `Math` et `Date` sont disponibles.

Exemple : un outil nommé `add_numbers` avec deux paramètres numériques obligatoires, `x` et `y`, et ce **Script Body** :

```js
const result = args.x + args.y;
return { sum: result };
```

Quand l'IA l'appelle avec `x` réglé sur 2 et `y` sur 3, l'outil renvoie une somme de 5. Si le script lève une erreur, l'IA reçoit un résultat d'erreur.

Un script exécute du vrai code sur ton serveur, dans un bac à sable (un espace cloisonné qui limite ce que le code peut faire) :

- Aucun accès réseau et aucun accès aux fichiers.
- Aucun accès aux variables d'environnement ni aux secrets du serveur.
- Un délai maximal. Par défaut, 60 secondes.

Le bac à sable n'est pas une isolation complète au niveau du système d'exploitation. Quelqu'un qui peut créer des outils reste capable d'écrire un script qui gaspille le processeur ou la mémoire. N'active les outils de type script que sur des serveurs de confiance, et sois prudent avec les scripts écrits par d'autres personnes.

Si ça n'a pas marché : quand la carte **Script** est grisée, demande à l'administrateur de définir `CUSTOM_TOOL_SCRIPT_ENABLED=true` et de redémarrer.

### Inclure le contexte caché du chat

Les outils **Webhook** et **Script** peuvent recevoir des données de chat supplémentaires que l'IA ne voit pas comme des entrées d'outil. Active **Include hidden chat context** dans l'éditeur d'outil (désactivé par défaut). Ton outil reçoit alors une valeur `context` qui peut contenir :

- le mode du chat
- le nom du persona actif et les noms des personnages
- les variables de chat enregistrées
- en Game Mode, l'état du jeu

Un outil peut ainsi personnaliser son résultat sans que l'IA ait à transmettre toutes ces données.

## Activer les outils dans un chat

Créer un outil ne suffit pas à ce que l'IA s'en serve. Tu dois aussi activer l'usage des outils pour le chat.

1. Ouvre un chat, puis **Chat Settings**.
2. Ouvre la section **Function Calling** (appel de fonctions, icône de clé à molette).
3. Active **Enable Tool Use** (autoriser l'usage des outils). Sa description indique **Allow AI to call functions (dice rolls, game state, etc.)**. Il est désactivé par défaut dans un nouveau chat.
4. Vérifie que ça marche : pose à l'IA une question à laquelle ton outil répond, comme "What are your store hours?" pour l'exemple `store_hours`. La réponse devrait utiliser le texte de l'outil.

Quand **Enable Tool Use** est activé et qu'aucun outil n'est ajouté en dessous, le chat peut utiliser tous les outils activés globalement qu'il prend en charge : les outils intégrés, plus chaque outil personnalisé dont l'interrupteur est activé dans **Functions**. Les chats Game exigent aussi **Let the GM search lore** (laisser le GM rechercher dans le lore) pour `search_lorebook`.

Pour limiter un chat à une sélection :

1. Clique sur **Add Functions** (ajouter des fonctions). Un sélecteur s'ouvre, avec un champ de recherche qui ne compare que les noms d'outils.
2. Coche les outils voulus. La liste mélange outils intégrés et outils personnalisés.
3. Clique sur **Add Selected** (ajouter la sélection).

Dès que tu ajoutes des outils, seuls ces outils fonctionnent dans ce chat. **New Custom Function** (nouvelle fonction personnalisée), dans le sélecteur, mène directement à l'éditeur d'outil.

Les chats Game peuvent utiliser une connexion séparée pour planifier les outils. Consulte [Planification facultative des outils et recherches dans le lore](../game/getting-started.md#optional-tool-planning-and-lore-searches) pour connaître son coût et son fonctionnement.

Si ça n'a pas marché : vérifie que **Enable Tool Use** est activé, que l'outil figure dans la liste du chat si tu as ajouté des outils précis, et que l'interrupteur de l'outil est activé dans **Functions**. Une **Description** plus claire et des descriptions de paramètres plus claires aident l'IA à décider quand l'appeler.

## Rattacher des outils à un agent

Tu peux aussi confier un outil à un agent plutôt qu'à un chat.

1. Ouvre le panneau **Agents** et ouvre un agent.
2. Ouvre son groupe **Tools / Function Calling** (outils / appel de fonctions).
3. Active les outils que cet agent peut utiliser.

Tu dois quand même activer **Enable Tool Use** dans la section **Function Calling** du chat. Le pied de page de l'éditeur d'agent te le rappelle. Pour les agents en général, consulte [Créer des agents personnalisés](../agents/custom-agents.md).

## Exporter et importer des outils

- Pour exporter un seul outil, ouvre-le et clique sur **Export function** (exporter la fonction). Un fichier `.json` est enregistré.
- Pour exporter tous les outils, clique sur **Export functions to ZIP**.
- Pour importer, clique sur **Import functions from ZIP or JSON** et choisis un fichier `.json` ou `.zip`. Un message indique combien d'outils ont été importés.

Les outils de type webhook et script importés sont toujours enregistrés désactivés, avec **Include hidden chat context** désactivé, même si le fichier demande l'un ou l'autre. Marinara affiche ensuite le type, l'adresse du webhook et les permissions demandées par le fichier. Ouvre chaque outil importé, examine-le, et ne l'active que si tu lui fais confiance. Les outils statiques conservent l'état marche/arrêt qu'ils avaient à l'import.

Un import ignore tout outil dont le nom entre en conflit avec un outil existant ou intégré. Les packages d'agents n'embarquent pas les outils personnalisés : exporte-les et examine-les séparément, puis rattache-les après avoir importé l'agent.

## Guides associés

- [Créer des agents personnalisés](../agents/custom-agents.md)
- [Intégration Home Assistant](../integrations/home-assistant.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
