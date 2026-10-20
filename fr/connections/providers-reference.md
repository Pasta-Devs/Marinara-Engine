# Fournisseurs d'IA pris en charge

Ce guide recense tous les fournisseurs d'IA auxquels Marinara Engine peut se connecter. Pour chacun, tu trouves où obtenir une clé API, l'URL de base par défaut et les particularités à connaître. Une clé API est un code secret délivré par un fournisseur, qui autorise Marinara à dialoguer avec son service d'IA.

Pour la marche à suivre générale, lis d'abord [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md). Cette page-ci est une référence à consulter quand tu cherches un détail sur un fournisseur précis.

## Comment lire cette page

Tu choisis un fournisseur au moment de créer une connexion dans le panneau **Connections** (Connexions). Chaque fournisseur dispose d'un bouton **Provider** (fournisseur) dans la fenêtre **Create Connection** (créer une connexion), portant exactement le nom indiqué ci-dessous.

La plupart des fournisseurs de cette page sont des services cloud qui hébergent l'IA à ta place. Tu crées un compte chez le fournisseur, tu copies une clé API, puis tu la colles dans le champ **API Key** (clé API). Trois fournisseurs sur abonnement passent par une identification locale au lieu d'une clé. Leurs sections le précisent.

Deux termes reviennent souvent :

- URL de base : l'adresse web à laquelle Marinara envoie les requêtes. La plupart des fournisseurs la remplissent pour toi. Tu ne la modifies que pour les serveurs locaux ou personnalisés.
- Modèle : le modèle d'IA précis que tu choisis après avoir sélectionné un fournisseur. Les modèles disponibles changent souvent, cette page ne les liste donc pas. Pour voir la liste du moment, utilise le menu déroulant **Model** (modèle) ou le bouton **Fetch Models from API** (récupérer les modèles depuis l'API) dans l'éditeur de connexion.

## OpenAI

- Où obtenir une clé : `https://platform.openai.com/api-keys`
- URL de base par défaut : `https://api.openai.com/v1`

**OpenAI** propose la famille de modèles GPT. Une fois la clé collée, choisis un modèle dans le menu déroulant ou clique sur **Fetch Models from API** pour charger la liste du moment. Cette connexion ne sert qu'aux modèles de chat. Pour les images DALL-E, passe plutôt par le fournisseur **Image Generation** (génération d'images) et son service **OpenAI (DALL-E)**.

## Anthropic

- Où obtenir une clé : `https://console.anthropic.com/settings/keys`
- URL de base par défaut : `https://api.anthropic.com/v1`

**Anthropic** propose les modèles Claude. Le fournisseur prend en charge la mise en cache des prompts (le prompt, c'est le texte que Marinara envoie à l'IA), ce qui peut réduire le coût des longs chats. Active-la avec l'interrupteur **Enable prompt caching** (activer la mise en cache des prompts) dans l'éditeur de connexion.

**Anthropic** ne propose pas d'embeddings. Les embeddings transforment le texte en listes de nombres, ce qui permet à Marinara de fouiller les lorebooks et la mémoire. Pour ces fonctions, utilise une connexion d'embeddings distincte (voir la section Embeddings plus bas).

## Google Gemini

- Où obtenir une clé : `https://aistudio.google.com/apikey`
- URL de base par défaut : `https://generativelanguage.googleapis.com/v1beta`

**Google Gemini** propose les modèles Gemini via Google AI Studio. C'est la plus simple des deux options Google.

Marinara désactive les filtres de sécurité ajustables de Google sur les deux options Google, sauf pour toute catégorie que tu règles toi-même dans **Custom Parameters** (paramètres personnalisés). Les protections de base de Google, comme la protection de l'enfance, s'appliquent toujours.

## Google Vertex AI

- Documentation sur les identifiants : `https://cloud.google.com/vertex-ai/docs/authentication`
- URL de base par défaut : `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** propose les modèles Gemini via un projet Google Cloud. La configuration est plus lourde qu'avec **Google Gemini**. Tu dois modifier le champ **Base URL** (URL de base) et remplacer `YOUR_PROJECT_ID` par l'identifiant réel de ton projet. Change aussi la région si ce n'est pas `us-central1`.

Le champ **API Key** accepte l'un de ces trois types d'identifiants, et Marinara reconnaît celui que tu as collé :

1. Une clé JSON de compte de service.
2. Un jeton d'accès OAuth, par exemple issu de `gcloud auth print-access-token`.
3. Une clé API Vertex.

**Gemini 4 Argon** ne fonctionne que dans les emplacements `global`, `us` et `eu`, pas dans une région unique comme `us-central1`. Pour l'utiliser, règle le champ **Base URL** sur `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`. Avec tout autre emplacement, Google renvoie une erreur, et Marinara l'affiche.

Argon peut mettre plusieurs minutes à répondre, sur l'une ou l'autre des connexions Google. Si les réponses du chat atteignent le délai d'expiration, augmente `CHAT_GENERATION_TIMEOUT_MS`. Si les appels d'agents atteignent le délai d'expiration, augmente `AGENT_CALL_TIMEOUT_MS` (voir [Référence de configuration du serveur](../CONFIGURATION.md)). Google conseille de prévoir au moins 15 minutes, soit `900000`.

## Mistral

- Où obtenir une clé : `https://console.mistral.ai/api-keys`
- URL de base par défaut : `https://api.mistral.ai/v1`

**Mistral** propose la famille de modèles Mistral. Aucune configuration particulière n'est nécessaire au-delà de la clé API.

## Cohere

- Où obtenir une clé : `https://dashboard.cohere.com/api-keys`
- URL de base par défaut : `https://api.cohere.ai/compatibility/v1`

**Cohere** utilise par défaut son point de terminaison compatible OpenAI. Si tu colles une ancienne URL Cohere v2, Marinara la bascule pour toi vers le point de terminaison de compatibilité. Les requêtes continuent de fonctionner.

## OpenRouter

- Où obtenir une clé : `https://openrouter.ai/keys`
- URL de base par défaut : `https://openrouter.ai/api/v1`

**OpenRouter** est un agrégateur. Une seule clé te donne accès à de nombreux modèles de nombreuses entreprises. Deux options supplémentaires apparaissent dans l'éditeur de connexion :

- **Preferred Provider** (fournisseur préféré) : un champ de texte qui force **OpenRouter** à router vers un backend nommé. Le nom doit correspondre à celui affiché sur la page des modèles d'OpenRouter. Laisse-le vide pour un routage automatique.
- **Enable prompt caching** : envoie des indications de mise en cache pour les modèles Claude routés via **OpenRouter**. La plupart des autres modèles d'**OpenRouter** gèrent le cache tout seuls et n'en ont pas besoin.

## NanoGPT

- Où obtenir une clé : `https://nano-gpt.com/api`
- URL de base par défaut : `https://nano-gpt.com/api/v1`

**NanoGPT** est lui aussi un agrégateur. Il n'a pas de liste de modèles intégrée, le menu déroulant **Model** est donc vide au départ. Une fois la clé collée, clique sur **Fetch Models from API** pour charger les modèles auxquels ton compte a droit.

Marinara lit le catalogue détaillé de NanoGPT. Le menu déroulant indique donc quels modèles ton abonnement couvre et lesquels en consomment davantage :

- Un modèle inclus affiche une pastille de **multiplicateur de tokens d'entrée** : `1x` en vert pour la consommation normale, ou une valeur supérieure comme `2x` si chaque token envoyé décompte autant de tokens d'entrée de ton quota. Un modèle *non inclus* affiche **Paid** (payant), car son utilisation est facturée sur ton solde payant. Sans pastille, le modèle n'avait aucune donnée d'abonnement à communiquer.

### Consommation de l'abonnement

Si tu as un abonnement NanoGPT, cette connexion peut afficher ton quota actuel :

1. Active **Show subscription usage** (afficher la consommation de l'abonnement) dans l'éditeur de connexion et enregistre.
2. Tu peux d'abord coller un **Management Token** (jeton de gestion).

Le widget interroge le point d'accès de consommation de NanoGPT et affiche tes quotas hebdomadaires et quotidiens de tokens d'entrée. Deux identifiants permettent de les lire :

- **Management Token** (recommandé) : crée-le sur `https://nano-gpt.com/settings#management-api-tokens` avec la portée **Usage only** (consommation uniquement). Il peut lire tes quotas, mais ne peut ni exécuter de modèles ni dépenser ton solde : c'est donc le choix le plus sûr pour afficher la consommation. Marinara le conserve chiffré et l'envoie uniquement au point d'accès de gestion de NanoGPT.
- **Ta clé API** : utilisée automatiquement si aucun jeton de gestion n'est enregistré. Cela fonctionne, mais les lectures emploient alors le même identifiant que celui permettant de dépenser ton solde.

Sous chaque barre, le widget indique ce qu'il reste et quand la fenêtre se réinitialise, par exemple `42M remaining · resets in 4d`.

Un quota que NanoGPT ne peut pas communiquer apparaît comme **unknown**, et non comme inutilisé. Un abonnement inactif est signalé au lieu d'être représenté avec tout son quota disponible. Le bouton d'actualisation du widget permet de le rafraîchir à la demande.

Le même indicateur apparaît sous celui du contexte dans le sélecteur de connexion du chat et dans ses réglages **Connection** (connexion). Tu peux ainsi suivre ton quota sans quitter le chat. Il suit la connexion active : il apparaît uniquement pour une connexion NanoGPT avec **Show subscription usage** activé, jamais pour **Random**, qui ne désigne pas une seule connexion à interroger. Dans le sélecteur, il reprend le style de la barre de contexte au-dessus et se lit de la même manière : consommation par rapport au quota hebdomadaire, par exemple `8.9M / 60M tokens`, avec l'heure de réinitialisation à côté du pourcentage.

## xAI / Grok

- Où obtenir une clé : `https://console.x.ai`
- URL de base par défaut : `https://api.x.ai/v1`

**xAI / Grok** propose les modèles Grok. Quand tu choisis ce fournisseur dans la fenêtre **Create Connection**, Marinara préremplit le modèle avec Grok 4.5. Rien ne t'empêche de le changer ensuite. Grok 4.6 et 4.7 disposent d'une fenêtre de contexte de 500 000 tokens et d'un raisonnement allant jusqu'à **Extra high** (`xhigh`). Ils prennent en charge les outils existants du chat, dont **Web Search** (recherche web), pour intégrer les résultats de recherche à la réponse finale.

## Arli AI

- Où obtenir une clé : `https://www.arliai.com/account`
- URL de base par défaut : `https://api.arliai.com/v1`

**Arli AI** est un service de chat hébergé. Il n'a pas de liste de modèles intégrée, le menu déroulant **Model** est donc vide au départ. Une fois la clé collée, clique sur **Fetch Models from API** pour charger ses modèles du moment. Pour les images Arli AI, passe plutôt par le fournisseur **Image Generation** et son service **Arli AI**.

## Z.AI

- Où obtenir une clé : `https://z.ai/manage-apikey/apikey-list`
- URL de base par défaut : `https://api.z.ai/api/paas/v4`

**Z.AI** propose les modèles GLM (GLM 5.3, GLM 5.3 Flash et les précédents) sur sa propre API. La liste **Model** affiche les modèles GLM actuels, et **Fetch Models from API** la met à jour depuis ton compte. Les modèles GLM 5.3 raisonnent toujours : le réglage **Reasoning Effort** (effort de raisonnement) de ton preset est ramené aux trois niveaux acceptés par Z.AI : **Low** pour un effort faible, **High** pour un effort élevé et **Maximum** pour un effort maximal. Si tu ne le définis pas, Z.AI utilise sa valeur par défaut, **Maximum**. L'URL de base par défaut correspond au point d'accès facturé à l'usage. Le Coding Plan de Z.AI utilise un autre point d'accès que sa politique d'utilisation réserve aux outils de sa liste ; il ne faut donc pas s'attendre à ce qu'une clé de ce plan fonctionne ici.

## DeepSeek

- Où obtenir une clé : `https://platform.deepseek.com/api_keys`
- URL de base par défaut : `https://api.deepseek.com/v1`

**DeepSeek** propose ses propres modèles de chat, `deepseek-flash` et `deepseek-v4-pro`. Une fois la clé collée, le menu déroulant **Model** les affiche, et **Fetch Models from API** actualise la liste depuis ton compte.

DeepSeek réfléchit par défaut. Son réglage **Reasoning Effort** utilise les niveaux propres à DeepSeek – **Low**, **High** et **Max** – et **Off** (désactivé) coupe la réflexion pour cette requête. Il n'y a pas de **Medium** : DeepSeek traite une requête de niveau moyen comme High, Marinara propose donc High plutôt qu'un second bouton qui ferait la même chose. Sa réflexion apparaît dans la réponse, avec l'affichage habituel des pensées.

Certains réglages du panneau des paramètres ne s'appliquent pas à DeepSeek : le panneau les omet donc, au lieu de faire comme s'ils fonctionnaient. **Verbosity**, **Top K** et les pénalités en font partie : DeepSeek les a abandonnés et les ignore. **Temperature** (température) et **Top P** forment une paire – DeepSeek n'en utilise qu'un à la fois, selon qu'il réfléchit ou non –, si bien que tu vois **Temperature** quand la réflexion est désactivée et **Top P** quand elle est active.

Passe par ce fournisseur pour connecter DeepSeek, plutôt que de diriger le fournisseur **OpenAI** vers l'URL de DeepSeek. Le fournisseur OpenAI attend les modèles propres à OpenAI : avec un modèle DeepSeek, il masque donc les commandes de génération et n'envoie presque aucun de tes réglages.

## Claude (Subscription)

- Clé API : aucune. Tu t'identifies dans un outil local à la place.

**Claude (Subscription)** exploite ton abonnement Anthropic Pro ou Max via l'outil Claude Code. L'outil tourne sur l'ordinateur qui héberge le serveur Marinara, et tu t'y identifies une seule fois. Les champs **API Key** et **Base URL** sont masqués pour ce fournisseur. Il ne propose pas d'embeddings (voir la section Embeddings plus bas).

Les étapes d'installation et d'identification figurent dans [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md).

### Consommation du forfait

Cette connexion peut afficher la part des limites de ton forfait Claude déjà consommée :

1. Active **Show subscription usage** (afficher la consommation de l'abonnement) dans l'éditeur de connexion.
2. Laisse cochées **5-hour window** (fenêtre de 5 heures) et **Weekly window** (fenêtre hebdomadaire), ou décoche celle que tu ne veux pas voir.
3. Enregistre la connexion.

Chaque fenêtre a une barre avec le pourcentage consommé et le moment de sa réinitialisation, par exemple `58% · resets in 2h`. Les mêmes barres apparaissent sous l'indicateur de contexte dans le sélecteur de connexion d'un chat et dans les réglages **Connection** du chat tant que cette connexion est active. Elles n'apparaissent pas pour **Random**, qui ne désigne pas une seule connexion à interroger.

À savoir :

- Les barres comptent tout ce qui passe par ton forfait Claude, comme Claude Code et claude.ai, pas seulement Marinara.
- Claude donne un pourcentage par fenêtre et aucun nombre de tokens, donc aucun n'est affiché.
- Une lecture demande à l'outil Claude Code de l'hôte Marinara les mêmes données que sa commande `/usage`. Elle n'envoie aucun message à Claude et n'utilise rien de ton forfait. Elle prend une seconde ou deux, et le bouton d'actualisation la relit.
- Le nom du forfait à côté du titre, comme **Pro**, est celui que Claude indique pour le compte connecté.
- Claude Code signale ces données d'usage comme expérimentales. Si une version future les change, les barres affichent une erreur avec un bouton de nouvel essai plutôt qu'un chiffre faux.

## OpenAI (ChatGPT)

- Clé API : aucune. Tu t'identifies dans un outil local à la place.

**OpenAI (ChatGPT)** exploite ton compte ChatGPT via l'outil Codex. L'outil tourne sur l'ordinateur qui héberge le serveur Marinara, et tu t'y identifies une seule fois. Les champs **API Key** et **Base URL** sont masqués pour ce fournisseur. Il ne propose pas d'embeddings (voir la section Embeddings plus bas). Son niveau de réflexion correspond au réglage **Reasoning Effort** des paramètres de la connexion ou du chat ; tant que tu n'en choisis aucun, Codex utilise sa propre valeur par défaut pour le modèle.

Les étapes d'installation et d'identification figurent dans [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md).

### Consommation du forfait

Cette connexion peut afficher la part des limites Codex de ton forfait ChatGPT déjà consommée. Elle fonctionne comme celle de Claude (Subscription) ci-dessus : active **Show subscription usage**, laisse cochées ou décoche **5-hour window** et **Weekly window**, puis enregistre. Les barres apparaissent dans l'éditeur de connexion, dans le sélecteur de connexion d'un chat et dans les réglages **Connection** du chat.

À savoir :

- Les barres comptent tout l'usage de Codex sur ton forfait ChatGPT, comme la Codex CLI, pas seulement Marinara. Les chats sur chatgpt.com ont leurs propres limites et ne font pas partie de ces barres.
- ChatGPT donne un pourcentage par fenêtre et aucun nombre de tokens, donc aucun n'est affiché.
- Une lecture demande à ChatGPT les mêmes données que la Codex CLI affiche comme ses limites, en utilisant la connexion Codex de l'hôte Marinara. Elle n'envoie aucun message à un modèle et n'utilise rien de ton forfait.
- Un forfait qui n'a qu'une des deux fenêtres affiche une seule barre.

## Grok CLI (Subscription)

- Clé API : aucune. Tu t'identifies dans un outil local à la place.

**Grok CLI (Subscription)** exploite ton compte SuperGrok ou X Premium+ via l'outil Grok CLI. L'outil tourne sur l'ordinateur qui héberge le serveur Marinara, et tu t'y identifies une seule fois. Les champs **API Key** et **Base URL** sont masqués pour ce fournisseur. Il ne propose pas d'embeddings (voir la section Embeddings plus bas).

Les étapes d'installation et d'identification figurent dans [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md).

## Custom (OAI-Compatible)

- URL de base par défaut : aucune. Tu dois en saisir une.

Choisis le fournisseur **Custom (OAI-Compatible)** pour te connecter à un serveur de modèles local ou auto-hébergé, comme Ollama, LM Studio ou KoboldCpp. Il convient aussi à tout proxy hébergé qui parle le format de chat d'OpenAI. Sur la plupart des serveurs locaux, le champ **API Key** peut rester vide. Renseigne le champ **Base URL** avec l'adresse de ton serveur.

Pour la configuration pas à pas et l'interrupteur **Treat as local/custom endpoint** (traiter comme un point de terminaison local ou personnalisé), lis [Connecter un modèle local ou auto-hébergé](local-self-hosted.md). Pour le petit modèle livré avec Marinara, lis [Configuration du modèle local](local-model.md).

## Image Generation

**Image Generation** est un fournisseur à part. Une fois que tu l'as choisi, tu sélectionnes aussi un **Service** (service), c'est-à-dire le moteur d'images qui fait le travail. Chaque service a sa propre URL de base par défaut et sa propre règle sur la nécessité d'une clé API. On y trouve des API cloud payantes comme **OpenAI (DALL-E)**, **Stability AI**, **NovelAI** et **Z.AI**. On y trouve aussi des options gratuites comme **Pollinations** et **Stable Horde**. Les serveurs locaux comme **ComfyUI** et **SD Web UI (AUTOMATIC1111 / Forge)** fonctionnent également.

La liste complète des services d'images, leur configuration et les réglages de génération se trouvent dans [Fournisseurs de génération d'images et configuration](../media/image-providers.md).

## Video Generation

**Video Generation** est également un fournisseur à part, avec son propre sélecteur **Video Service** (service vidéo). Marinara s'en sert pour produire de courtes vidéos de scène au format MP4. Les services sont **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **NanoGPT**, **Atlas Cloud**, **Seedance 2.0**, **ComfyUI** et **SwarmUI**. Les services cloud exigent une clé API. **ComfyUI** et **SwarmUI** tournent sur ton propre ordinateur et n'en ont normalement pas besoin.

La configuration complète et les limites de chaque service vidéo se trouvent dans [Génération de vidéos de scène](../media/scene-video.md).

## Decision

- URL de base par défaut : `https://api.typesafe.ai` pour la source **TypeSafe**.

**Decision** (décision) est un fournisseur à part, facultatif, pour un modèle qui répond par oui ou par non à des questions sur ton chat. Il peut par exemple décider si un agent personnalisé doit s'exécuter. Ses réponses orientent Marinara et ne sont pas publiées dans le chat. Une fois que tu l'as choisi, sélectionne une source : **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (point d'accès System One personnalisé) ou **OpenAI-compatible chat model** (modèle de chat compatible OpenAI). Les sources hébergées exigent une clé API.

Le rôle d'un modèle de décision, la façon d'en choisir un et la configuration complète sont détaillés dans [Modèles de décision](decision-models.md).

## Audio

**Audio** est un fournisseur à part pour les voix et les sons générés. Une fois que tu l'as choisi, sélectionne une **Audio Source** (source audio) :

- **ElevenLabs** : parole, effets sonores et musique.
- **OpenAI-compatible** : OpenAI, ou tout serveur qui reproduit le format de synthèse vocale d'OpenAI.
- **PocketTTS** : un serveur de voix gratuit que tu fais tourner sur ton propre ordinateur.
- **xAI Voice** : le service de voix de xAI.

Chaque source remplit une URL de base et un modèle par défaut. **Default Voice** (voix par défaut) est la voix utilisée quand rien de plus précis, comme une voix propre à un personnage, n'est défini. **Request timeout (seconds)** (délai d'attente de la requête, en secondes) est le temps pendant lequel Marinara attend une réplique parlée, 60 secondes par défaut ; augmente-le pour un serveur vocal lent. Pour choisir la connexion audio que Marinara utilise par défaut, ouvre le panneau **Connections**, déplie **Defaults** (valeurs par défaut) et choisis-la sous **Audio**. Pour lire les messages à voix haute avec une connexion audio, choisis-la comme **Source** dans la carte **Text to Speech** (synthèse vocale). Voir [Utiliser une connexion Audio](../media/tts-setup.md#use-an-audio-connection).

Avec la source **ElevenLabs**, deux interrupteurs supplémentaires apparaissent : **Game sound effects** (effets sonores du jeu) et **Game music** (musique du jeu). Ils permettent à Game Mode de produire des effets sonores et de la musique avec cette connexion. Voir [Effets sonores et musique générés](../game/game-assets.md#generated-sound-effects-and-music). Pour les voix et la lecture des messages à voix haute, voir [Configuration du Text to Speech (TTS)](../media/tts-setup.md).

## Embeddings

Les embeddings font tourner la recherche sémantique des lorebooks et Memory Recall. Ils transforment le texte en listes de nombres, ce qui permet à Marinara de retrouver les entrées apparentées. Chez la plupart des fournisseurs de chat, tu peux définir un **Embedding Model** (modèle d'embeddings) et, en option, une **Embedding Endpoint URL** (URL du point de terminaison d'embeddings) dans l'éditeur de connexion.

Certains fournisseurs ne savent pas produire d'embeddings. **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** et **Grok CLI (Subscription)** n'en proposent pas. Dans ce cas, utilise le menu déroulant **Embedding Connection** (connexion d'embeddings) pour emprunter une autre connexion : une connexion compatible OpenAI, **Google Gemini** ou le **Local Model** intégré.

Pour utiliser une même source d'embeddings pour toutes les connexions qui n'ont pas leurs propres réglages d'embedding, ouvre le panneau **Connections**, déplie **Defaults** et choisis-la sous **Embeddings**. **None (built-in local model)** garde le modèle d'embedding local intégré. Le modèle d'embedding propre à une connexion, ou son **Embedding Connection**, reste prioritaire. Revectorise tes lorebooks et tes souvenirs après ce changement. Consulte [Recherche sémantique pour les lorebooks](../lorebooks/semantic-search.md).

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md)
- [Connecter un modèle local ou auto-hébergé](local-self-hosted.md)
- [Fournisseurs de génération d'images et configuration](../media/image-providers.md)
- [Génération de vidéos de scène](../media/scene-video.md)
- [Modèles de décision](decision-models.md)
- [Configuration du Text to Speech (TTS)](../media/tts-setup.md)
