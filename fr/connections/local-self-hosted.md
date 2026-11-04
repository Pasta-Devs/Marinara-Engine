# Connecter un modèle local ou auto-hébergé

Ce guide relie Marinara Engine à un modèle d'IA qui tourne sur ton propre ordinateur ou sur ton propre serveur, via un programme comme Ollama, LM Studio, KoboldCpp ou llama.cpp. Pour le petit modèle que Marinara fait tourner sans serveur séparé, voir [Configuration du modèle intégré](local-model.md).

## Configurer une connexion Custom

Dans l'application, ce type de compte s'appelle **OpenAI-compatible** (compatible OpenAI). Cela veut dire que le serveur accepte le même format de requêtes que l'API de chat d'OpenAI. Ollama, LM Studio, KoboldCpp et llama.cpp l'acceptent tous.

Avant de commencer, installe un serveur de modèles, démarre-le et charge un modèle dans ce serveur. Par exemple, télécharge Ollama depuis `ollama.com` et suis ses étapes pour récupérer un modèle. Marinara se connecte au serveur et ne le démarre pas à ta place. Le serveur répond aux requêtes à une adresse web sur ton ordinateur, appelée point d'accès (endpoint).

1. Clique sur **Connections** (Connexions) dans la barre du haut, puis sur **Add** (ajouter). La fenêtre **Add account** (ajouter un compte) s'ouvre.
2. Sous **Chat**, clique sur ton serveur : **Ollama**, **LM Studio**, **KoboldCpp** ou **llama.cpp**. Ces tuiles portent l'étiquette **Self-hosted** (auto-hébergé). Pour tout autre serveur, clique sur **OpenAI-compatible address** (adresse compatible OpenAI).
3. Vérifie le champ **Server address** (adresse du serveur). Pour les quatre serveurs nommés, il est déjà rempli. Pour un autre serveur, tape son adresse. Voir le tableau ci-dessous.
4. Laisse le champ **API key (optional)** (clé API, facultative) vide. La plupart des serveurs locaux n'ont besoin d'aucune clé. Pour nommer le compte, tape un nom dans **Name (optional)** (nom, facultatif).
5. Clique sur **Connect** (connecter). Marinara teste l'adresse. **Connected** veut dire que Marinara a pu joindre le serveur.
6. La suite varie selon que tu as déjà un modèle Main (principal) ou non. Si tu n'en as pas, ou si tu as ouvert Add depuis un nouveau chat, la fenêtre affiche les modèles annoncés par ton serveur. Choisis-en un, ou tape un ID de modèle dans **Search or enter model ID…** (rechercher ou saisir un ID de modèle), puis clique sur **Done** (terminé). Si tu as déjà un modèle Main, la fenêtre se ferme et un message indique que le compte a été ajouté. Clique alors sur **⋯** sur le compte et choisis **Add model** (ajouter un modèle).

Le panneau affiche maintenant le compte. Teste-le avant de compter dessus (voir [Tester la connexion](#test-the-connection)).

Si ça n'a pas marché :

- **Marinara could not reach** s'affiche quand Marinara n'a pas pu joindre l'adresse. Vérifie que le serveur tourne et que l'adresse et le port correspondent. **Continue anyway** (continuer quand même) enregistre le compte sans test réussi.
- L'adresse se trouve sur un autre ordinateur. Voir [Joindre un serveur sur un autre ordinateur](#reach-a-server-on-another-computer).

## Adresses des serveurs locaux courants

Un port est le canal numéroté qu'un serveur utilise sur ton ordinateur. `localhost` désigne ce même ordinateur : ces adresses fonctionnent donc telles quelles quand Marinara et le serveur tournent sur le même ordinateur.

| Serveur | Adresse |
| --- | --- |
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |
| llama.cpp | `http://localhost:8080/v1` |

Dans **Edit model** (modifier le modèle), le champ d'adresse affiche cet avertissement : "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." Ne saisis qu'une adresse que tu as configurée toi-même ou en laquelle tu as pleinement confiance.

Sous Windows, un serveur qui tourne peut quand même être bloqué. Si Marinara ne le détecte pas, le pare-feu Windows Defender le bloque peut-être. Ouvre **Windows Security → Firewall & network protection → Allow an app through firewall** (Sécurité Windows → Pare-feu et protection du réseau → Autoriser une application via le pare-feu), et ajoute Node.js ou le programme de ton serveur.

<a id="test-the-connection"></a>

## Tester la connexion

**Connect** a déjà vérifié l'adresse. L'éditeur de modèle propose une carte **Provider tests** (tests du fournisseur) pour une seconde vérification.

1. Clique sur ton modèle dans le panneau **Connections**. L'éditeur de modèle s'ouvre.
2. Clique sur **Test provider** (tester le fournisseur). Il vérifie que l'adresse est joignable et indique le temps que ça a pris.
3. Choisis un modèle si ce n'est pas déjà fait, puis clique sur **Send test message** (envoyer un message de test). Il envoie un court message et affiche la réponse.

Si les deux réussissent, ouvre un chat et choisis le compte dans **Model for this chat** (modèle pour ce chat). Voir [Choisir un modèle pour un seul chat](connecting-to-a-provider.md#choosing-a-model-for-one-chat).

Si un test échoue, vérifie que le serveur tourne avec un modèle chargé, et que l'adresse et le port correspondent exactement. Pour un serveur sur un autre ordinateur, vérifie les étapes ci-dessous.

<a id="reach-a-server-on-another-computer"></a>

## Joindre un serveur sur un autre ordinateur

Les adresses comme `localhost` et `127.0.0.1` fonctionnent toujours. Si ton serveur de modèles se trouve sur un autre ordinateur de ton réseau, Marinara bloque cette adresse privée par défaut. La personne qui gère le serveur Marinara peut l'autoriser avec une variable d'environnement, un réglage que le serveur lit à son démarrage.

1. Ouvre le fichier `.env` du serveur. Sur une installation normale, il se trouve dans le dossier du projet Marinara. Pour Docker et Podman, voir [Référence de configuration du serveur](../CONFIGURATION.md#edit-the-env-file).
2. Ajoute cette ligne :

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

3. Enregistre le fichier et redémarre le serveur Marinara.
4. Utilise l'adresse de l'autre ordinateur, par exemple `http://192.168.1.50:11434/v1`.

Sur Android, ce réglage est activé par défaut tant que tu ne le définis pas.

## Utiliser le modèle pour les décisions

Le même modèle peut répondre aux questions de décision, comme les vérifications d'activation des agents, sans charger une seconde copie. Clique sur **⋯** sur le modèle dans le panneau et choisis **Use this model for decisions** (utiliser ce modèle pour les décisions). Cette option s'affiche pour un modèle compatible OpenAI qui a un nom de modèle. Voir [Modèles de décision](decision-models.md#on-a-server-you-already-run).

## L'interrupteur Treat as local/custom endpoint

Dans **Edit model**, un interrupteur nommé **Treat as local/custom endpoint** (traiter comme un point d'accès local ou personnalisé) se trouve sous **Local / custom endpoint** (point d'accès local ou personnalisé). Il est désactivé par défaut. Il ne s'affiche que pour les anciens modèles qui ne sont pas liés à un compte. Les modèles que tu ajoutes aujourd'hui ne l'affichent jamais.

Active-le pour un proxy ou un serveur auto-hébergé qui n'est pas un service connu. Il pousse Marinara à toujours tenter les appels d'outils, et il permet à Professor Mari d'utiliser une méthode d'outils de secours (un protocole d'outils en JSON) au lieu des seuls appels d'outils natifs. Active-le si Professor Mari s'arrête après avoir utilisé un outil, ou si ton serveur se dit compatible OpenAI mais gère mal les appels d'outils. Si ton modèle fonctionne sans, laisse-le désactivé.

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Configuration du modèle intégré](local-model.md)
- [Modèles de décision](decision-models.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
