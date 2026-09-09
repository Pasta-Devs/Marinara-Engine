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

## Google Vertex AI

- Documentation sur les identifiants : `https://cloud.google.com/vertex-ai/docs/authentication`
- URL de base par défaut : `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** propose les modèles Gemini via un projet Google Cloud. La configuration est plus lourde qu'avec **Google Gemini**. Tu dois modifier le champ **Base URL** (URL de base) et remplacer `YOUR_PROJECT_ID` par l'identifiant réel de ton projet. Change aussi la région si ce n'est pas `us-central1`.

Le champ **API Key** accepte l'un de ces trois types d'identifiants, et Marinara reconnaît celui que tu as collé :

1. Une clé JSON de compte de service.
2. Un jeton d'accès OAuth, par exemple issu de `gcloud auth print-access-token`.
3. Une clé API Vertex.

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

## xAI / Grok

- Où obtenir une clé : `https://console.x.ai`
- URL de base par défaut : `https://api.x.ai/v1`

**xAI / Grok** propose les modèles Grok. Quand tu choisis ce fournisseur dans la fenêtre **Create Connection**, Marinara préremplit le modèle avec Grok 4.5. Rien ne t'empêche de le changer ensuite.

## Z.AI

- Où obtenir une clé : `https://z.ai/manage-apikey/apikey-list`
- URL de base par défaut : `https://api.z.ai/api/paas/v4`

**Z.AI** propose les modèles GLM (GLM 5.3, GLM 5.3 Flash et les précédents) sur sa propre API. La liste **Model** affiche les modèles GLM actuels, et **Fetch Models from API** la met à jour depuis ton compte. Les modèles GLM 5.3 raisonnent toujours : le réglage **Reasoning Effort** (effort de raisonnement) de ton preset est ramené aux trois niveaux acceptés par Z.AI : **Low** pour un effort faible, **High** pour un effort élevé et **Maximum** pour un effort maximal. Si tu ne le définis pas, Z.AI utilise sa valeur par défaut, **Maximum**. L'URL de base par défaut correspond au point d'accès facturé à l'usage. Le Coding Plan de Z.AI utilise un autre point d'accès que sa politique d'utilisation réserve aux outils de sa liste ; il ne faut donc pas s'attendre à ce qu'une clé de ce plan fonctionne ici.

## Claude (Subscription)

- Clé API : aucune. Tu t'identifies dans un outil local à la place.

**Claude (Subscription)** exploite ton abonnement Anthropic Pro ou Max via l'outil Claude Code. L'outil tourne sur l'ordinateur qui héberge le serveur Marinara, et tu t'y identifies une seule fois. Les champs **API Key** et **Base URL** sont masqués pour ce fournisseur. Il ne propose pas d'embeddings (voir la section Embeddings plus bas).

Les étapes d'installation et d'identification figurent dans [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md).

## OpenAI (ChatGPT)

- Clé API : aucune. Tu t'identifies dans un outil local à la place.

**OpenAI (ChatGPT)** exploite ton compte ChatGPT via l'outil Codex. L'outil tourne sur l'ordinateur qui héberge le serveur Marinara, et tu t'y identifies une seule fois. Les champs **API Key** et **Base URL** sont masqués pour ce fournisseur. Il ne propose pas d'embeddings (voir la section Embeddings plus bas).

Les étapes d'installation et d'identification figurent dans [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md).

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

**Video Generation** est également un fournisseur à part, avec son propre sélecteur **Video Service** (service vidéo). Game Mode s'en sert pour produire de courtes vidéos de scène au format MP4. Les services sont **Google AI Studio**, **xAI Imagine**, **OpenRouter Video** et **Seedance 2.0**. Chaque service exige une clé API.

La configuration complète et les limites de chaque service vidéo se trouvent dans [Génération de vidéos de scène](../media/scene-video.md).

## Embeddings

Les embeddings font tourner la recherche sémantique des lorebooks et Memory Recall. Ils transforment le texte en listes de nombres, ce qui permet à Marinara de retrouver les entrées apparentées. Chez la plupart des fournisseurs de chat, tu peux définir un **Embedding Model** (modèle d'embeddings) et, en option, une **Embedding Endpoint URL** (URL du point de terminaison d'embeddings) dans l'éditeur de connexion.

Certains fournisseurs ne savent pas produire d'embeddings. **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** et **Grok CLI (Subscription)** n'en proposent pas. Dans ce cas, utilise le menu déroulant **Embedding Connection** (connexion d'embeddings) pour emprunter une autre connexion : une connexion compatible OpenAI, **Google Gemini** ou le **Local Model** intégré.

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md)
- [Connecter un modèle local ou auto-hébergé](local-self-hosted.md)
- [Fournisseurs de génération d'images et configuration](../media/image-providers.md)
- [Génération de vidéos de scène](../media/scene-video.md)
