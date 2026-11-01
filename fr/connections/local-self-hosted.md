# Connecter un modèle local ou auto-hébergé

Ce guide explique comment relier Marinara Engine à un modèle d'IA qui tourne sur ton propre ordinateur ou sur ton propre serveur. Au programme : les serveurs de modèles locaux les plus répandus, comme Ollama, LM Studio et KoboldCpp, ainsi que les réglages qui les font fonctionner.

## Ce que veut dire auto-hébergé

Un modèle auto-hébergé est un modèle d'IA qui tourne sur du matériel que tu maîtrises. Tu installes un serveur de modèles local, ce serveur charge un modèle, puis il répond aux requêtes à une adresse web sur ta machine. Marinara Engine dialogue alors avec cette adresse au lieu d'un service cloud payant.

Parmi les serveurs de modèles locaux courants, on trouve Ollama, LM Studio et KoboldCpp. Chacun tourne sur ton ordinateur et te donne un endpoint privé. Un endpoint, c'est l'adresse web à laquelle le serveur attend les requêtes.

Ce guide traite des serveurs locaux externes, ceux que tu installes et lances toi-même. Marinara embarque aussi son propre petit modèle intégré, qui ne demande aucun serveur séparé. Si c'est plutôt ça que tu cherches, va voir le guide [Configurer le modèle local](local-model.md).

Avant de commencer, vérifie que le serveur de modèles local est déjà installé, lancé, et qu'un modèle y est chargé. Marinara ne démarre pas ce serveur à ta place : il se contente de s'y connecter.

## Créer une connexion Custom

Marinara se relie aux serveurs locaux via le fournisseur **Custom (OAI-Compatible)**. OAI-compatible veut dire que le serveur parle le même format de requêtes que l'API Chat Completions d'OpenAI. Ollama, LM Studio et KoboldCpp proposent tous ce format.

Voici la marche à suivre pour créer la connexion :

1. Ouvre le panneau **Connections** (Connexions) depuis le côté droit de l'application.
2. Clique sur **Add** (ajouter). La fenêtre **Add account** (ajouter un compte) s'ouvre.
3. À l'étape 1, choisis **Custom (OAI-Compatible)**. Il se trouve sous **On your computer** (sur ton ordinateur).
4. À l'étape 2, saisis l'adresse du serveur local dans le champ **Address** (adresse), voir le tableau ci-dessous.
5. Laisse le champ **API key** (clé API) vide. La plupart des serveurs locaux n'ont besoin d'aucune clé. Pour donner à la connexion un nom comme `Ollama Local`, ouvre **More options** (plus d'options) et saisis-le sous **Name (optional)** (nom, facultatif).
6. Clique sur **Connect** (connecter).
7. À l'étape 3, choisis un modèle dans la liste annoncée par le serveur. Autre option : taper un identifiant de modèle à la main. Clique sur **Done** (terminé).

La connexion apparaît maintenant dans le panneau **Connections**, avec son modèle regroupé en dessous. Teste-la avant de t'en servir dans un chat, voir la section "Tester la connexion" plus bas.

Le champ **API Key** est facultatif pour les serveurs locaux. Avec le fournisseur **Custom (OAI-Compatible)**, l'éditeur affiche un rappel sous ce champ : il précise que la clé peut rester vide pour les modèles locaux comme Ollama, LM Studio et KoboldCpp. Il suffit de renseigner le champ **Address** à la place.

## URL de base des serveurs locaux courants

Le champ **Address** (aussi appelé URL de base) indique à Marinara où écoute le serveur local. Chaque serveur a une adresse et un port par défaut. Un port, c'est le canal numéroté qu'un serveur utilise sur ta machine. Prends l'adresse du serveur que tu fais tourner.

| Serveur local | Point d'accès |
|---|---|
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |

Ici, `localhost` signifie "ce même ordinateur". Si Marinara tourne sur le même ordinateur que le serveur de modèles, ces adresses fonctionnent telles quelles.

Le champ **Address** affiche un avertissement de sécurité : "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." Ne saisis qu'une adresse que tu as configurée toi-même ou en laquelle tu as pleinement confiance.

### Remarque sur le pare-feu Windows

Sous Windows, un serveur local peut être bloqué alors même qu'il tourne. L'éditeur affiche cette remarque pour le fournisseur **Custom (OAI-Compatible)** : si le proxy ou le serveur local n'est pas détecté, le pare-feu Windows Defender bloque peut-être la connexion. Pour corriger ça, ouvre Windows Security, puis Firewall and network protection, puis Allow an app through firewall, et ajoute Node.js ou l'application de ton serveur.

## L'interrupteur Treat as local/custom endpoint

L'éditeur de connexion comporte une section **Local / Custom Endpoint** avec un interrupteur intitulé **Treat as local/custom endpoint** (traiter comme un endpoint local ou personnalisé). Il est désactivé par défaut. Active-le pour les endpoints auto-hébergés ou passant par un proxy, en particulier une adresse web personnalisée qui pointe vers un serveur de modèles sur ton réseau local.

Quand cet interrupteur est désactivé, Marinara reste prudent avec les appels d'outils pour les modèles qu'il ne reconnaît pas. En l'activant, tu demandes à Marinara de toujours tenter les appels d'outils. Tu demandes aussi à Professor Mari d'utiliser une méthode d'outils de secours, un protocole d'outils en JSON, plutôt que les seuls appels d'outils natifs. Professor Mari est l'assistante intégrée à l'application.

Active cet interrupteur si Professor Mari s'arrête après avoir utilisé un outil. Active-le aussi si l'endpoint se dit compatible OpenAI mais gère mal les appels d'outils. Si le modèle local fonctionne très bien sans, laisse-le désactivé.

## Joindre un serveur sur un autre ordinateur

Marinara autorise toujours les connexions vers ton propre ordinateur. Les adresses comme `localhost` et `127.0.0.1` s'appellent des adresses de bouclage : elles désignent "cette même machine". Elles fonctionnent toujours pour une connexion, sans configuration supplémentaire.

Si le serveur de modèles tourne sur un autre ordinateur de ton réseau domestique ou professionnel, il s'agit d'une adresse de réseau privé. Par sécurité, Marinara bloque les adresses de réseau privé par défaut. Pour les autoriser, la personne qui administre le serveur Marinara doit définir une variable d'environnement. Une variable d'environnement est un réglage que le serveur lit à son démarrage.

Ajoute cette ligne au fichier `.env` du serveur :

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

Enregistre le fichier et redémarre le serveur Marinara pour que le changement prenne effet. Ensuite, tu peux utiliser un Base URL qui pointe vers une autre machine de ton réseau, par exemple `http://192.168.1.50:11434/v1`.

Sur Android, ce réglage est activé par défaut tant que tu ne le définis pas. Pour en savoir plus sur le fichier `.env` et les réglages du serveur, va voir la [Référence de configuration du serveur](../CONFIGURATION.md).

## Tester la connexion

**Connect**, dans le parcours d'ajout, a déjà vérifié la connexion. L'éditeur de modèle comporte une carte **Connection Tests** (tests de connexion) tout en bas pour une seconde vérification. Sers-t'en avant de compter sur la connexion dans un chat.

1. Clique sur ton modèle dans le panneau **Connections**. L'éditeur de modèle s'ouvre.
2. Clique sur **Test Connection** (tester la connexion). Marinara vérifie que le Base URL et la configuration sont joignables, et indique le temps que ça a pris.
3. Choisis un modèle si ce n'est pas déjà fait.
4. Clique sur **Send Test Message** (envoyer un message de test). Marinara envoie le mot "hi" au modèle choisi et affiche la réponse.

Si les deux tests réussissent, le modèle local est prêt à servir dans un chat. Ouvre un chat, ouvre ses réglages, et choisis cette connexion, ou utilise le menu **Connections** de la zone de saisie du chat.

Ce même modèle peut aussi répondre aux décisions, comme les questions d'activation des agents, sans que Marinara en charge une seconde copie. Clique sur **Use this model for decisions** (utiliser ce modèle pour les décisions) dans les réglages de la connexion ; voir [Modèles de décision](decision-models.md#on-a-server-you-already-run).

Si un test échoue, vérifie d'abord que le serveur local tourne toujours et que le modèle est bien chargé. Contrôle ensuite que le champ **Address** correspond exactement à l'adresse et au port du serveur. Pour un serveur situé sur un autre ordinateur, confirme que `PROVIDER_LOCAL_URLS_ENABLED` est défini et que tu as bien redémarré le serveur Marinara.

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Configurer le modèle local](local-model.md)
- [Modèles de décision](decision-models.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
