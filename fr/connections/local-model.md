# Configuration du modèle intégré

Le **Built-in model** (modèle intégré) est un petit modèle d'IA que Marinara télécharge et fait tourner sur ton propre ordinateur. Il ne demande ni clé API (un code secret, un peu comme un mot de passe) ni compte en ligne, et rien ne quitte ton ordinateur.

Comme il est petit, il convient au travail d'assistance en arrière-plan : les agents trackers (des assistants qui gardent la trace des détails de l'histoire), les effets de scène en Game Mode, les embeddings des lorebooks, ces recueils de faits sur ton univers, et les vérifications de décision. Il est trop faible pour un bon roleplay ou pour les retouches de Professor Mari. Pour ça, utilise un compte plus puissant. Voir [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md).

Si la carte **Built-in model** n'apparaît pas, tu as une installation "Lite", une build allégée sans le runtime local.

## Télécharger le modèle intégré

Avant de commencer, vérifie que tu as assez d'espace disque libre et de mémoire (RAM) pour le modèle. Les tailles sont dans le tableau plus bas.

1. Clique sur **Connections** (Connexions) dans la barre du haut.
2. Repère la carte **Built-in model** sous l'encadré **Jobs** (tâches). Elle affiche **Not downloaded**.
3. Clique sur la carte, ou sur son bouton **Download** (télécharger). Une fenêtre intitulée **Built-in model** s'ouvre.
4. Sous **Which model?** (quel modèle ?), choisis un modèle. **Gemma 4 E2B — Q8 (Best Quality)** porte l'étiquette **Recommended**. Si ton ordinateur a peu de mémoire, choisis **Q4_K_M**. Il demande environ 3,4 Go de RAM au lieu de 5,4 Go.
5. Clique sur le bouton **Download** en bas. Il affiche la taille du modèle, par exemple **Download 5.0 GB**.
6. Patiente. La fenêtre affiche trois étapes : **Install runtime** (installer le runtime), **Download model** (télécharger le modèle) et **Start and test** (démarrer et tester). Un runtime est le programme qui exécute le modèle. Marinara l'installe d'abord s'il manque.
7. Quand la fenêtre affiche le nom du modèle avec un point vert, clique sur **Test** (tester). Un encadré intitulé **Local test message** affiche **Succeeded** et indique le temps qu'a pris la réponse.
8. Clique sur **Done** (terminé).

La carte affiche maintenant **Ready**, avec la taille du modèle et les tâches dont il s'occupe.

Si ça n'a pas marché :

- **Sidecar runtime install is disabled** (un message d'erreur). Installer le runtime est une action protégée. Voir [Autoriser l'installation du runtime](#allow-runtime-installs).
- **Local runtime failed to start.** Voir [Dépannage](#troubleshooting).
- **Download failed.** La fenêtre affiche l'erreur. Vérifie ta connexion internet et l'espace disque libre, puis clique de nouveau sur le bouton de téléchargement.

Tu peux aussi ouvrir cette fenêtre depuis **Add** (ajouter) dans le panneau **Connections**, sous **Built-in model** dans la fenêtre **Add account** (ajouter un compte).

### Presets sélectionnés

La fenêtre propose deux presets tout prêts de Gemma 4 E2B, un petit modèle de Google. Sur les ordinateurs Apple Silicon, ce sont des versions MLX au lieu de fichiers GGUF. GGUF et MLX sont deux formats de fichier pour les modèles locaux. Les tailles ci-dessous sont celles qu'affiche la fenêtre (en Go, où 1 Go vaut 1024 × 1024 × 1024 octets).

| Preset | Téléchargement | RAM en fonctionnement |
| --- | --- | --- |
| Q8 (Best Quality) | 5,0 Go | 5,4 Go |
| Q4_K_M (Smaller, Faster) | 3,0 Go | 3,4 Go |

Sur Apple Silicon, la fenêtre affiche à la place deux presets MLX :

| Preset | Téléchargement | RAM en fonctionnement |
| --- | --- | --- |
| 8-bit MLX (Best Quality) | 5,5 Go | 7,0 Go |
| 4-bit MLX (Smaller, Faster) | 3,4 Go | 4,5 Go |

Marinara ne garde qu'un seul modèle intégré sur le disque à la fois. Choisir un autre modèle remplace le premier. Pour changer plus tard, ouvre la carte et clique sur **Change model** (changer de modèle) dans la fenêtre **Built-in model**. Sur la page de la carte, les boutons à côté de **Model** (modèle) passent d'un preset à l'autre et te demandent d'abord de confirmer la taille du téléchargement.

### Utiliser ton propre modèle

Sous **Your own model** (ton propre modèle), tu peux utiliser un modèle GGUF de Hugging Face (un site public de partage de modèles) ou un fichier sur l'ordinateur qui fait tourner Marinara.

1. Clique sur **Your own model**, puis choisis un onglet : **Hugging Face** ou **File on the server** (fichier sur le serveur).
2. Dans l'onglet **Hugging Face**, tape le nom du dépôt sous la forme `owner/repo`, puis clique sur **Find files** (trouver les fichiers). Choisis un fichier dans la liste.
3. Dans l'onglet **File on the server**, tape le chemin complet du fichier `.gguf`. Marinara utilise le fichier là où il se trouve et ne le copie pas.
4. Clique sur le bouton en bas : **Download**, ou **Use this file** (utiliser ce fichier) pour un fichier sur le serveur.

Sur Apple Silicon, **Find files** s'appelle **Validate repo** (valider le dépôt), et le dépôt doit être nativement MLX. Un fichier GGUF sur le serveur y fonctionne quand même et utilise alors llama.cpp au lieu de MLX.

## Utiliser le modèle intégré pour les tâches d'assistance

Ouvre la carte **Built-in model** une fois le modèle téléchargé. Sa page affiche son état, sa mémoire utilisée et **Used by** (utilisé par), et propose ces contrôles :

| Contrôle | Ce qu'il fait |
| --- | --- |
| **Use for tracker agents (roleplay)** (utiliser pour les agents trackers, roleplay) | Garde le modèle en fonctionnement pour les agents trackers. Désactivé par défaut. |
| **Use for game scene analysis** (utiliser pour l'analyse des scènes de jeu) | Le garde en fonctionnement pour les effets de scène de Game Mode, comme les arrière-plans, la musique et la météo. Activé par défaut. |
| **Use the built-in model for all tracker agents** (utiliser le modèle intégré pour tous les agents trackers) | Fait pointer tous les agents trackers intégrés vers ce modèle. Cela ne les active pas. |
| **Change in Defaults** (modifier dans les valeurs par défaut) | Ouvre l'encadré **Jobs**, où tu peux lui confier d'autres tâches. |

Si les deux interrupteurs sont désactivés, le modèle ne démarre pas de lui-même. Il démarre quand tu en actives un, ou quand un chat ou une tâche l'utilise. Pour activer les agents, voir [Rappel de mémoire et résumés de chat](../agents/memory.md).

Dans la configuration de Game Mode, **Scene effects model** (modèle des effets de scène) peut utiliser le modèle intégré. Voir [Game Mode : premiers pas](../game/getting-started.md).

### Embeddings des lorebooks

Les embeddings sont des nombres qui permettent à un lorebook de chercher par le sens. Pour utiliser le modèle intégré pour les embeddings, choisis **Built-in model (on this device)** (modèle intégré, sur cet appareil) comme modèle de vectorisation du lorebook. Active d'abord **Use for tracker agents (roleplay)** ou **Use for game scene analysis**, sinon la requête échoue. Ce chemin a besoin du runtime GGUF : il ne fonctionne donc pas sur Apple Silicon MLX. Voir [Recherche sémantique pour les lorebooks](../lorebooks/semantic-search.md).

### Modèle de décision

Tu peux aussi choisir le modèle intégré comme modèle de décision (Decision model). Voir [Modèles de décision](decision-models.md).

### Modèle de chat

Pour discuter avec le modèle intégré :

1. Ouvre un chat et clique sur le bouton du modèle dans la zone de saisie du chat (l'icône de lien).
2. Dans **Model for this chat** (modèle pour ce chat), choisis **Built-in model (on this device)**. Il se trouve en bas de la liste et s'affiche une fois le modèle téléchargé.
3. Envoie un message. Un avertissement indique que le modèle est petit : les réponses peuvent donc être lentes, courtes ou de qualité médiocre.

## Réglages du runtime

Pour les ouvrir, clique sur **Runtime settings** (réglages du runtime) sur la page de la carte, ou sur **Settings** (paramètres) dans la fenêtre **Built-in model**. Ils sont répartis en quatre groupes. Les menus déroulants et les interrupteurs s'enregistrent tout de suite. Les champs numériques s'enregistrent quand tu cliques sur **Apply settings** (appliquer les réglages). **Physical batch size** et **Custom GPU layers** ont chacun leur propre bouton **Apply** (appliquer).

**Speed** (vitesse)

| Réglage | Par défaut | Ce qu'il fait |
| --- | --- | --- |
| **Runtime target** (cible du runtime) | Auto detect | La famille de cartes graphiques pour laquelle Marinara installe le runtime. |
| **GPU offload** (délestage vers le GPU) | Auto offload | La part du travail confiée à la carte graphique. Choisis **Auto offload** (délestage automatique), **CPU only** (processeur uniquement) ou **Custom GPU layers** (couches GPU personnalisées, de 1 à 1024). |

**Memory** (mémoire)

| Réglage | Par défaut | Ce qu'il fait |
| --- | --- | --- |
| **Context window** (fenêtre de contexte) | 8192 | La quantité de texte que le modèle lit d'un coup, en tokens (de petits morceaux de texte). 512 ou plus. |
| **KV cache type** (type de cache KV) | f16 | La façon dont le modèle stocke ce qu'il a lu. Choisis f16, q8_0 ou q4_0. Les deux derniers utilisent moins de mémoire et demandent la prise en charge de Flash Attention. |

**Replies** (réponses)

| Réglage | Par défaut | Ce qu'il fait |
| --- | --- | --- |
| **Max response tokens** (nombre maximal de tokens de réponse) | 4096 | La réponse la plus longue que le modèle peut écrire. 64 ou plus. |
| **Temperature** (température) | 0.3 | Le degré de hasard des réponses. De 0 à 2. |
| **Top P** | 0.95 | Une limite sur le choix des mots. Au-dessus de 0, jusqu'à 1. |
| **Top K** | 64 | Une limite sur le choix des mots. De 0 à 500. |

**Expert**

| Réglage | Par défaut | Ce qu'il fait |
| --- | --- | --- |
| **Native tool calls** (appels d'outils natifs) | On | Permet au modèle d'utiliser des outils. Professor Mari et les agents personnalisés ont besoin qu'il soit activé. |
| **Max parallel agent jobs** (nombre maximal de tâches d'agent en parallèle) | 2 | Le nombre de tâches exécutées en même temps. De 1 à 16. |
| **Pooling type** (type de pooling) | None | La façon dont le modèle transforme le texte en nombres pour la recherche dans les lorebooks. Choisis **Mean** pour les embeddings des lorebooks. |
| **Physical batch size** (taille de lot physique) | 512 | La quantité de texte par lot d'embeddings de lorebook. De 128 à 32 768. Augmente-la quand de longues entrées échouent. Gemma fonctionne souvent avec 1024. |

Certains réglages varient selon le système :

- **Runtime target**, sous Windows et Linux (x64), propose Auto detect, NVIDIA GPU, AMD GPU, Intel GPU, Vulkan GPU, CPU only et System llama-server. Les autres systèmes proposent moins de choix.
- Sur Apple Silicon, MLX choisit l'accélérateur à ta place. **Runtime target**, **GPU offload**, **KV cache type**, **Native tool calls**, **Pooling type** et **Physical batch size** ne s'affichent pas.
- **Max response tokens** ne limite pas l'analyse de scène de Game Mode, qui a sa propre limite.
- **Diagnostics** (diagnostic), dans **Expert**, affiche la build du runtime, la carte graphique détectée et la dernière commande de lancement.

<a id="allow-runtime-installs"></a>

### Autoriser l'installation du runtime

Installer ou réinstaller le runtime est une action protégée. Les installations Windows en un clic l'autorisent pour toi. Sur macOS, Linux et Docker, fais l'une de ces opérations, puis réessaie :

- Saisis le secret d'administration dans **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur). Le secret d'administration est un second mot de passe pour les actions risquées. Tu le crées dans **Admin Access** sur l'ordinateur du serveur lui-même, ou tu le définis sous le nom `ADMIN_SECRET` dans le fichier `.env` du serveur. Voir [Admin Access](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).
- Ajoute `SIDECAR_RUNTIME_INSTALL_ENABLED=true` au fichier `.env` du serveur, puis redémarre Marinara. Le fichier `.env` est un fichier texte qui se trouve dans le dossier de Marinara. Voir [Modifier le fichier .env](../CONFIGURATION.md#edit-the-env-file).

Marinara ne télécharge que les versions de llama.cpp, MLX et uv approuvées pour ta version de Marinara, et vérifie la taille et la somme de contrôle SHA-256 de chaque fichier avant d'exécuter quoi que ce soit.

## Modèle vocal local

Le **Local speech model** (modèle vocal local) transforme ta voix en texte sur ton propre ordinateur pour les appels Conversation. C'est un modèle Whisper, un modèle qui transforme la parole en texte. Il a besoin du package d'agent **Calls**, que tu installes dans **Agents → Agent Organizer** (Agents → organisateur d'agents).

1. Ouvre le panneau **Connections** et clique sur l'élément **Speech to text** (reconnaissance vocale) sous **On this device** (sur cet appareil).
2. Sous **Local speech model**, choisis un modèle dans le menu déroulant.
3. Clique sur **Download Whisper** (télécharger Whisper).
4. Attends **Ready**. Redémarre complètement Marinara avant d'utiliser Calls.

| Modèle | Téléchargement | RAM en fonctionnement |
| --- | --- | --- |
| Whisper Tiny (Multilingual) | environ 180 Mo | environ 350 Mo |
| Whisper Base (Multilingual) | environ 320 Mo | environ 650 Mo |

Tiny est le meilleur premier choix pour les téléphones et les ordinateurs anciens. Base est plus précis sur une parole confuse, mais plus lent à démarrer. Clique sur **Delete Local Whisper** (supprimer Local Whisper, le bouton corbeille) pour retirer le modèle téléchargé. La désinstallation de Calls le supprime aussi.

Ton audio reste sur ton ordinateur. Seul le texte part vers ton modèle de chat. Pour t'en servir pendant un appel, règle l'entrée audio de l'appel sur Local Whisper. Voir [Appels audio et vidéo en Conversation](../conversation/calls.md). Si tu actives plutôt le serveur **Speech to text**, les appels y envoient ta voix. Voir [Utiliser ton propre serveur de reconnaissance vocale](../conversation/calls.md#use-your-own-speech-to-text-server).

<a id="troubleshooting"></a>

## Dépannage

| Symptôme | Solution |
| --- | --- |
| **Sidecar runtime install is disabled** (un message d'erreur). | Voir [Autoriser l'installation du runtime](#allow-runtime-installs). |
| **Local runtime failed to start.** La fenêtre affiche l'erreur et le chemin d'un fichier de log (un journal). La carte affiche **Local runtime unavailable**. | Clique sur **Retry startup** (relancer le démarrage). Si ça échoue, clique sur **Reinstall runtime** (réinstaller le runtime), ou choisis une autre valeur de **Runtime target**. **Continue without local AI** (continuer sans IA locale) désactive les interrupteurs d'assistance et garde Marinara en état de marche sans le modèle. |
| Le téléchargement du runtime signale une taille ou une somme de contrôle SHA-256 qui ne correspond pas. | Marinara a écarté le fichier. Mets Marinara à jour et réessaie. Si ça échoue encore, n'ouvre pas le fichier toi-même. Signale la cible du runtime et l'erreur. |
| La recherche dans les lorebooks indique que le modèle local n'est pas activé. | Active **Use for tracker agents (roleplay)** ou **Use for game scene analysis**, puis relance la vectorisation. |
| Un bandeau de Game Mode affiche **Local scene helper failed to start**. | Clique sur **Open Local AI Model** (ouvrir le modèle d'IA local) dans le bandeau pour réessayer, changer de modèle ou désactiver l'analyse de scène locale. |

Pour plus d'aide, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Modèles de décision](decision-models.md)
- [Connecter un modèle local ou auto-hébergé](local-self-hosted.md)
- [Rappel de mémoire et résumés de chat](../agents/memory.md)
- [Appels audio et vidéo en Conversation](../conversation/calls.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Recherche sémantique pour les lorebooks](../lorebooks/semantic-search.md)
