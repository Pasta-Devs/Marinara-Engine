# Fournisseurs d'IA pris en charge

Cette page est une référence pour les principaux services auxquels Marinara Engine peut se connecter : où obtenir leur clé API, leur adresse par défaut et leurs particularités. Pour ajouter un compte pas à pas, lis d'abord [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md).

Tu choisis un service dans la fenêtre **Add account** (ajouter un compte), sous la section qui correspond à ce qu'il fait : **Chat**, **Images & video** (images et vidéo), **Voice** (voix) ou **Decisions** (décisions). La tuile porte le nom indiqué ci-dessous. L'adresse est l'adresse web à laquelle Marinara envoie les requêtes. Elle s'appelle **Address** (adresse) dans l'éditeur du compte et **Base URL** (URL de base) dans l'éditeur du modèle. Marinara la remplit pour les services connus. Ne la change que pour un proxy ou un serveur que tu fais tourner.

Les modèles changent souvent, cette page ne les liste donc pas. Une fois le compte connecté, la liste des modèles se charge dans le sélecteur. Clique sur **Refresh model list** (actualiser la liste des modèles) dans le sélecteur pour la recharger.

## Services de chat

Ces services utilisent une clé API, sauf les trois services par abonnement, qui passent par une identification sur ton ordinateur.

| Service | Où obtenir une clé |
| --- | --- |
| LinkAPI | `linkapi.ai` |
| OpenAI | `platform.openai.com/api-keys` |
| Anthropic | `console.anthropic.com/settings/keys` |
| Google Gemini | `aistudio.google.com/apikey` |
| Google Vertex AI | `cloud.google.com/vertex-ai/docs/authentication` (guide des identifiants) |
| Mistral | `console.mistral.ai/api-keys` |
| Cohere | `dashboard.cohere.com/api-keys` |
| OpenRouter | `openrouter.ai/keys` |
| NanoGPT | `nano-gpt.com/api` |
| xAI / Grok | `console.x.ai` |
| Arli AI | `www.arliai.com/account` |
| Z.AI | `z.ai/manage-apikey/apikey-list` |
| DeepSeek | `platform.deepseek.com/api_keys` |
| OpenAI-compatible, Claude (Subscription), OpenAI (ChatGPT), Grok CLI (Subscription) | Pas de page de clé. Voir les notes ci-dessous. |

Adresses par défaut, que Marinara remplit pour toi :

- LinkAPI : `https://linkapi.ai/v1` (une passerelle compatible OpenAI avec sa propre clé)
- OpenAI : `https://api.openai.com/v1`
- Anthropic : `https://api.anthropic.com/v1`
- Google Gemini : `https://generativelanguage.googleapis.com/v1beta`
- Google Vertex AI : `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`
- Mistral : `https://api.mistral.ai/v1`
- Cohere : `https://api.cohere.ai/compatibility/v1`
- OpenRouter : `https://openrouter.ai/api/v1`
- NanoGPT : `https://nano-gpt.com/api/v1`
- xAI / Grok : `https://api.x.ai/v1`
- Arli AI : `https://api.arliai.com/v1`
- Z.AI : `https://api.z.ai/api/paas/v4`
- DeepSeek : `https://api.deepseek.com/v1`
- OpenAI-compatible et les services par abonnement : aucune. Tu saisis une adresse, ou aucune n'est nécessaire.

Toutes les pages de clés commencent par `https://`.

Les trois services par abonnement masquent le champ **API key** (clé API) et le champ d'adresse. Ils ne proposent pas d'embeddings. Les étapes d'installation et d'identification se trouvent dans [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md), qui traite aussi de la consommation du forfait.

Un agrégateur est un service où une seule clé donne accès aux modèles de nombreuses entreprises. OpenRouter et NanoGPT sont des agrégateurs. Une passerelle repose sur la même idée, pour un proxy que tu fais tourner ou que tu loues.

## Notes par service

### OpenAI

**OpenAI** fait tourner les modèles GPT. Pour les images DALL-E, ajoute **OpenAI** et choisis des modèles **Image** sur le même compte. Il en va de même pour les autres services qui génèrent des images avec la même clé.

### Anthropic

**Anthropic** fait tourner les modèles Claude. La mise en cache des prompts permet au service de réutiliser le début de ton prompt, ce qui peut réduire le coût des longs chats. Active-la avec **Enable prompt caching** (activer la mise en cache des prompts) dans l'éditeur du modèle. **Anthropic** ne propose pas d'embeddings (voir [Embeddings](#embeddings)).

### Google Gemini et Google Vertex AI

**Google Gemini** fait tourner les modèles Gemini via Google AI Studio. C'est la plus simple des deux options Google. Sur les deux options Google, Marinara désactive les filtres de sécurité ajustables de Google, sauf pour toute catégorie que tu règles toi-même dans **Custom Parameters** (paramètres personnalisés). Les protections de base de Google, comme la protection de l'enfance, s'appliquent toujours.

**Google Vertex AI** fait tourner Gemini via un projet Google Cloud et demande plus de configuration. Modifie l'adresse et remplace `YOUR_PROJECT_ID` par l'identifiant de ton projet. Change la région si ce n'est pas `us-central1`. Le champ **API key** accepte l'un des éléments suivants, et Marinara reconnaît celui que tu as collé :

1. Une clé JSON de compte de service (un fichier fourni par Google Cloud qui désigne un compte de service).
2. Un jeton d'accès OAuth, par exemple issu de `gcloud auth print-access-token`.
3. Une clé API Vertex.

**Gemini 4 Argon** et **Gemini 4 Carbon** ne fonctionnent que dans les emplacements `global`, `us` et `eu`, pas dans une région unique comme `us-central1`, d'après une note du code de Marinara qui suit la documentation de Google. Pour utiliser l'un ou l'autre, règle l'adresse sur `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`. Avec un autre emplacement, Google renvoie une erreur, et Marinara l'affiche.

### Cohere

**Cohere** utilise son point d'accès compatible OpenAI. Si tu colles une ancienne adresse Cohere v2, Marinara la bascule pour toi vers le point d'accès de compatibilité.

### OpenRouter

**OpenRouter** est un agrégateur qui ajoute deux options dans l'éditeur du modèle :

- Le champ **Preferred provider** (fournisseur préféré) force le routage vers un backend nommé. Le nom doit correspondre à celui de la page des modèles d'OpenRouter. Laisse-le vide pour un routage automatique.
- L'option **Enable prompt caching** envoie des indications de mise en cache pour les modèles Claude routés via OpenRouter. La plupart des autres modèles gèrent le cache tout seuls.

### NanoGPT

**NanoGPT** est un agrégateur sans liste de modèles intégrée. Une fois le compte connecté, le sélecteur charge les modèles auxquels ton compte a droit. Il lit le catalogue détaillé de NanoGPT et indique quels modèles ton abonnement couvre :

| Pastille | Signification |
| --- | --- |
| `1x` en vert | Inclus dans ton abonnement, au tarif normal. |
| Une valeur supérieure comme `2x` | Inclus, mais chaque token d'entrée coûte autant de tokens de ton quota. |
| **Paid** (payant) | Non inclus. L'utilisation est facturée sur ton solde payant. |
| Pas de pastille | NanoGPT n'avait aucune donnée d'abonnement pour ce modèle. |

#### Consommation de l'abonnement

Avec un abonnement NanoGPT, le compte peut afficher ton quota en temps réel.

1. Clique sur **⋯** sur la ligne du compte, choisis **Edit account** (modifier le compte) et ouvre **Usage and balance** (utilisation et solde).
2. Si les lectures externes sont désactivées, clique sur **Turn on** (activer). Pour ajouter une clé de gestion, clique sur **Add a usage-only key** (ajouter une clé réservée à la consommation), colle-la, puis clique sur **Show usage** (afficher la consommation).
3. Active **Show the usage meter on the card** (afficher l'indicateur de consommation sur la carte) et enregistre.

L'indicateur affiche tes quotas hebdomadaires et quotidiens de tokens d'entrée, avec ce qu'il reste et le moment où chacun se réinitialise, par exemple `42M remaining · resets in 4d`. Un quota que NanoGPT ne peut pas communiquer apparaît comme inconnu, et non comme inutilisé. Un abonnement inactif est signalé au lieu d'être représenté comme plein. Le bouton d'actualisation le relit.

Deux identifiants permettent de lire la consommation :

- **Management key** (clé de gestion, recommandée). Crée-en une sur `https://nano-gpt.com/settings#management-api-tokens`, uniquement pour lire la consommation. Elle lit les quotas, mais ne peut ni exécuter de modèles ni dépenser ton solde. Marinara la conserve chiffrée et l'envoie uniquement au point d'accès de gestion de NanoGPT.
- **Ta clé API**, utilisée quand aucune clé de gestion n'est enregistrée. Cela fonctionne, mais la lecture du quota utilise alors une clé qui peut dépenser ton solde.

Le même indicateur apparaît sous la barre de contexte dans le sélecteur de connexion d'un chat et dans les réglages **Connection** (connexion) du chat. Il n'apparaît que si le modèle du chat est un modèle NanoGPT dont l'indicateur est activé, et pas pour **Shuffle** (mélange).

### xAI / Grok

**xAI / Grok** fait tourner les modèles Grok. Grok 4.6 et 4.7 disposent d'une fenêtre de contexte de 500 000 tokens et d'un raisonnement allant jusqu'à **Extra high** (très élevé). Ils prennent en charge les outils du chat, dont **Web Search** (recherche web), pour que les résultats de recherche alimentent la réponse finale.

### Arli AI

**Arli AI** est un service de chat hébergé sans liste de modèles intégrée. Une fois le compte connecté, le sélecteur charge ses modèles. Pour les images Arli AI, ajoute **Arli AI** et choisis des modèles **Image** sur le même compte.

### Z.AI

**Z.AI** sert les modèles GLM (GLM 5.3, GLM 5.3 Flash et les précédents) sur sa propre API. Les modèles GLM 5.2 et 5.3 acceptent le niveau de raisonnement **Maximum**. L'adresse par défaut correspond au point d'accès facturé à l'usage. Le Coding Plan de Z.AI utilise un autre point d'accès : une clé Coding Plan risque donc de ne pas fonctionner ici.

### DeepSeek

**DeepSeek** sert `deepseek-flash` et `deepseek-v4-pro`. DeepSeek réfléchit par défaut. Son réglage **Reasoning Effort** (effort de raisonnement) utilise les niveaux propres à DeepSeek, et **Off** (désactivé) coupe la réflexion pour cette requête. DeepSeek traite une requête de niveau moyen comme High. La réflexion apparaît dans la réponse, avec l'affichage habituel des pensées.

Certains paramètres ne s'appliquent pas : le panneau les omet donc. **Verbosity** (verbosité), **Top K** et les pénalités sont abandonnés et ignorés. **Temperature** (température) et **Top P** forment une paire, car DeepSeek n'en utilise qu'un à la fois. Tu vois **Temperature** quand la réflexion est désactivée et **Top P** quand elle est active.

Connecte DeepSeek avec sa propre tuile, plutôt que de diriger **OpenAI** vers l'adresse de DeepSeek. Le service OpenAI attend les modèles d'OpenAI : avec un modèle DeepSeek, il masque donc les commandes de génération et n'envoie presque aucun de tes réglages.

### OpenAI-compatible

Le service **OpenAI-compatible** connecte un serveur ou un proxy qui accepte le format de requête d'OpenAI, comme Ollama, LM Studio ou KoboldCpp. Dans la fenêtre **Add account**, il apparaît sous le nom **OpenAI-compatible address** (adresse compatible OpenAI). Sur la plupart des serveurs locaux, la clé peut rester vide. C'est toi qui saisis l'adresse. Consulte [Connecter un modèle local ou auto-hébergé](local-self-hosted.md). Pour le petit modèle que Marinara fait tourner lui-même, consulte [Configuration du modèle intégré](local-model.md).

## Images et vidéo

Sous **Images & video**, chaque tuile a sa propre adresse et sa propre règle sur la nécessité d'une clé. Les tuiles sont Stability AI, Together AI, NovelAI, Venice.ai, Atlas Cloud, fal.ai, SpicyAPI, Pollinations, Stable Horde, Seedance 2.0 et des serveurs locaux : ComfyUI, SD Web UI (AUTOMATIC1111 / Forge), SwarmUI, RunPod Serverless (ComfyUI), Draw Things et Block Entropy. Draw Things, ComfyUI, SwarmUI, SD Web UI et RunPod portent l'étiquette **Self-hosted** (auto-hébergé).

Les modèles d'images et de vidéo d'OpenAI, OpenRouter, xAI, NanoGPT, Arli AI, Z.AI et Google proviennent de ton compte de chat pour ce service. Ajoute le compte de chat, puis choisis des modèles **Image** ou **Video** (vidéo) sur ce compte.

Consulte [Fournisseurs de génération d'images et configuration](../media/image-providers.md) et [Génération de vidéos de scène](../media/scene-video.md).

## Decision

Sous **Decisions**, les tuiles sont **TypeSafe** (adresse par défaut `https://api.typesafe.ai`), **Own decision server** (ton propre serveur de décision) et **Built-in model (decisions)**. Les services de chat qui utilisent le format de chat d'OpenAI peuvent aussi prendre des décisions, mais seulement avec un modèle qui renvoie des log-probabilités (des scores pour chaque réponse possible). Un modèle de décision répond par oui ou par non à des questions sur ton chat. Consulte [Modèles de décision](decision-models.md).

## Audio

Sous **Voice**, un service audio fait parler les voix des personnages et la narration. Choisis une **Audio source** (source audio) :

| Source | Ce que c'est |
| --- | --- |
| ElevenLabs | Voix des personnages et narration. |
| OpenAI-compatible | OpenAI, ou tout serveur qui reproduit le format de synthèse vocale d'OpenAI. |
| PocketTTS | Un serveur de voix gratuit que tu fais tourner sur ton propre ordinateur. |
| xAI Voice | Le service de voix de xAI. |

Chaque source remplit une adresse et un modèle par défaut. Le réglage **Default voice** (voix par défaut) désigne la voix utilisée quand rien de plus précis, comme une voix propre à un personnage, n'est défini. Le réglage **Request timeout (seconds)** (délai d'attente de la requête, en secondes) fixe le temps pendant lequel Marinara attend une réplique parlée. Augmente-le pour un serveur vocal lent.

Pour choisir le compte de synthèse vocale que Marinara utilise par défaut, clique sur la ligne **Voice (Text to Speech)** (voix, synthèse vocale) dans l'encadré **Jobs** (tâches). Pour lire les messages à voix haute avec l'un d'eux, choisis-le comme **Source** dans la carte **Text to Speech** (synthèse vocale). Consulte [Configuration du Text to Speech (TTS)](../media/tts-setup.md) et [Utiliser une connexion Audio](../media/tts-setup.md#use-an-audio-connection).

<a id="music--sound-effects"></a>

## Musique et effets sonores

Ce type de compte génère de la musique instrumentale et des effets sonores, séparément de la parole. La fenêtre **Add account** n'a pas de tuile pour lui. Ces comptes proviennent d'une mise à jour (voir plus bas) ou d'un import. Tu en modifies un avec **Edit model** (modifier le modèle), où tu choisis son service et actives **Music generation** (génération de musique), **Sound-effect generation** (génération d'effets sonores) ou les deux. La configuration de Game en demande un dans **Music & Sound Effects account** (compte de musique et d'effets sonores), dont le choix par défaut est **Use the default Music & Sound Effects account** (utiliser le compte de musique et d'effets sonores par défaut).

Les services :

- **ElevenLabs** : adresse par défaut `https://api.elevenlabs.io`. Nécessite une clé ElevenLabs. La musique et les effets sonores ont des champs de modèle distincts.
- **SunoAPI** : adresse par défaut `https://apibox.erweima.ai`. Nécessite une clé de [sunoapi.org](https://sunoapi.org/) et, quand la musique est activée, une **SunoAPI music callback URL** (URL de rappel pour la musique SunoAPI) publique en HTTPS. Il s'agit du service propre à SunoAPI, pas d'une identification avec un abonnement Suno.
- **Custom compatible server** (serveur compatible personnalisé) : l'adresse de ton serveur. Nécessite un chemin de point d'accès explicite pour la musique ou les effets sonores, et un format de requête pris en charge. Consulte les [contrats audio compatibles](../media/tts-setup.md#game-music-and-sound-effects-on-a-compatible-audio-server).

À savoir :

- SunoAPI a besoin de l'adresse de rappel, même si Marinara vérifie lui-même quand la piste est terminée. C'est toi qui fournis l'adresse. Marinara n'en crée pas.
- Les prompts de style musical peuvent compter jusqu'à 1 000 caractères. Ceux des effets sonores, jusqu'à 500.
- Chaque requête peut être facturée par ton fournisseur. Consulte l'[API de musique](https://docs.sunoapi.org/suno-api/generate-music) et l'[API d'effets sonores](https://docs.sunoapi.org/suno-api/generate-sounds). Les effets sonores SunoAPI n'ont pas été vérifiés avec un compte payant.

Lors de la mise à jour, chaque compte Audio dont la génération est activée reçoit un compte Music & Sound Effects distinct. Les anciens réglages ElevenLabs autonomes de Game peuvent créer le leur : tu peux donc en voir plusieurs. Les comptes de voix et les voix attribuées ne changent pas, et les identifiants de compte enregistrés pour Game non plus. La génération ne fonctionne que si le compte migré correspondant est disponible et que l'option de musique ou d'effets sonores y est activée. Sinon, choisis un autre compte adapté. Supprimer un compte migré ne le recrée pas au redémarrage. Les points d'accès restaurés depuis un profil restent indisponibles tant que tu ne les as pas vérifiés et enregistrés localement.

Active l'audio généré pour chaque Game, ou active **Sound effects** (effets sonores) dans les réglages des commandes de Roleplay pour utiliser `[sound: description]`. Gacha Forge possède son propre réglage d'audio génératif. L'audio fourni avec Game reste disponible quand la génération est désactivée.

## Embeddings

Les embeddings transforment le texte en listes de nombres pour que Marinara puisse retrouver du texte apparenté. Ils font tourner la recherche sémantique des lorebooks et Memory Recall. La plupart des services de chat te permettent de définir un modèle d'embedding et, en option, une **Embedding endpoint URL** (URL du point d'accès d'embeddings) sous **Semantic search (embeddings)** (recherche sémantique) dans l'éditeur du modèle.

**Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** et **Grok CLI (Subscription)** ne savent pas produire d'embeddings. Pour ceux-là, utilise le menu déroulant **Embedding provider** (fournisseur d'embeddings) pour emprunter un autre compte, comme un compte compatible OpenAI, **Google Gemini** ou le **Built-in model** (modèle intégré).

Pour utiliser une même source d'embeddings pour tous les comptes qui n'ont pas leurs propres réglages d'embedding, clique sur la ligne **Embeddings** dans l'encadré **Jobs**. L'option **Marinara's own search** (recherche propre à Marinara) garde le modèle d'embedding intégré. Le modèle d'embedding propre à un compte, ou son **Embedding provider**, reste prioritaire. Revectorise tes lorebooks et tes souvenirs après ce changement. Consulte [Recherche sémantique pour les lorebooks](../lorebooks/semantic-search.md).

## Délais d'expiration

Les modèles lents peuvent atteindre les délais d'expiration du serveur pour les réponses de chat et les appels d'agents. Les réglages du serveur correspondants se trouvent dans [Configuration](../CONFIGURATION.md).

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md)
- [Connecter un modèle local ou auto-hébergé](local-self-hosted.md)
- [Fournisseurs de génération d'images et configuration](../media/image-providers.md)
- [Génération de vidéos de scène](../media/scene-video.md)
- [Modèles de décision](decision-models.md)
- [Configuration du Text to Speech (TTS)](../media/tts-setup.md)
