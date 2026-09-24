# Configuration du Local Model

Ce guide explique le **Local Model** intégré, un petit modèle d'IA que Marinara Engine télécharge et exécute sur ta propre machine. Il ne demande ni clé API ni compte en ligne. Au programme : la configuration, les **Runtime Settings** (réglages d'exécution) et le rôle du Local Model dans les tâches d'assistance, comme les trackers, les effets de scène en Game Mode et la transcription des appels hors ligne.

## Ce qu'est le Local Model

Le **Local Model** est un modèle de langage compact (Gemma) qui tourne entièrement sur ton ordinateur. Une clé API est un code secret qui autorise Marinara à parler à un service d'IA en ligne. Le Local Model n'en a pas besoin, puisque rien ne quitte ta machine.

Le Local Model est volontairement petit. Il sert au travail d'assistance en arrière-plan, pas au chat principal ni au roleplay. Marinara l'utilise pour les tâches suivantes :

- Les trackers (agents de suivi) en mode Roleplay.
- Les effets de scène en Game Mode : arrière-plans, musique, météo.
- Les embeddings (représentations numériques du texte) des lorebooks, ces recueils de faits sur ton univers, pour la recherche sémantique.
- La transcription du micro dans les appels Conversation, via un modèle vocal distinct.

- Répondre aux questions d'activation et aux énoncés de décision, si tu le choisis comme Decision model. Consulte [Modèles de décision](decision-models.md).
La fenêtre de configuration l'appelle **Local AI Model**. Les menus déroulants de connexion l'appellent **Local Model (sidecar)**. C'est la même fonctionnalité.

Évite le Local Model pour le chat principal, le roleplay, la narration du Game Master (le maître du jeu) et les retouches de Professor Mari. Il est trop petit pour donner de bons résultats là. Utilise plutôt une connexion plus puissante. Voir [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md).

## Ouvrir la carte Local Model

Le Local Model se trouve dans le panneau **Connections** (Connexions).

1. Ouvre le panneau **Connections**.
2. Repère la carte intitulée **Local Model**.
3. Clique sur la carte, ou sur son bouton en forme d'engrenage intitulé **Open local model settings**.

Le bouton engrenage ouvre la fenêtre de configuration complète, intitulée **Local AI Model**. Si aucun modèle n'est encore téléchargé, la carte affiche aussi un bouton **Download now** et un bouton **Choose model options**. Les deux ouvrent la même fenêtre de configuration.

Dans cette fenêtre, un encadré d'avertissement s'intitule **Local Model is for helpers, not main roleplay**. Il rappelle que le modèle est réservé aux tâches d'assistance.

## Matériel et systèmes d'exploitation pris en charge

Le Local Model télécharge un runtime (le programme qui exécute le modèle) et un fichier de modèle. Ton ordinateur doit avoir assez d'espace disque libre et assez de mémoire (RAM) pour les deux.

La prise en charge dépend de ton système d'exploitation :

- **Windows (64 bits) et Linux (64 bits)** : tu disposes du sélecteur **Runtime Target** complet, qui te laisse choisir la famille de ta carte graphique (GPU) ou l'exécution sur le processeur (CPU) uniquement.
- **Windows sur ARM et Linux sur ARM** : un jeu d'options réduit, essentiellement basé sur le CPU.
- **macOS sur Apple Silicon** : Marinara utilise le runtime MLX, optimisé pour les puces Apple. Les modèles personnalisés sont des dépôts HuggingFace, et non des fichiers uniques.
- **macOS sur Intel et Android** : CPU uniquement, en pratique.

Le Local Model n'existe pas dans les installations "Lite". Une installation Lite est une version allégée qui laisse de côté le runtime local pour gagner de la place. Sur une installation Lite, la carte Local Model n'apparaît pas.

## Première configuration

Installe d'abord le runtime, puis choisis un modèle.

1. Ouvre la fenêtre de configuration **Local AI Model**.
2. Clique sur **Install Runtime**. Sur Apple Silicon, ce bouton s'appelle **Install MLX Runtime**.
3. Attends la fin de l'installation du runtime. Une barre de progression suit le téléchargement.
4. Choisis un modèle comme expliqué dans la section **Télécharger un modèle** ci-dessous.
5. Attends la fin du téléchargement du modèle.
6. Quand le statut affiche **Ready**, clique sur **Done**.

Si tu n'es pas prêt à terminer, clique sur **Skip for Now**. Dès qu'un modèle est installé, ce bouton devient **Close**.

Installer ou réinstaller le runtime est une action protégée. Sur les installations Windows en un clic, elle est activée automatiquement pour toi. Sur macOS, Linux et Docker, il faut parfois l'autoriser. Voir la section **Dépannage** ci-dessous.

Marinara ne télécharge que les versions de llama.cpp, MLX et uv approuvées pour ta version d'Engine. Marinara vérifie la taille exacte du fichier et la somme de contrôle SHA-256 avant d'extraire ou d'exécuter quoi que ce soit. Le jeu de dépendances Python de MLX est lui aussi verrouillé par version et vérifié par empreinte, avant l'installation du code source mlx-lm relu, sans résolution de paquets supplémentaires. Les mises à jour du runtime arrivent donc par des mises à jour de Marinara relues, et non en suivant en silence une version "latest" venue de l'amont.

## Télécharger un modèle

La fenêtre de configuration propose deux façons d'obtenir un modèle.

### Presets sélectionnés

Sous **Curated Gemma 4 Presets**, tu choisis l'un des deux presets prêts à l'emploi, c'est-à-dire des configurations déjà enregistrées. Sur du matériel non-Apple, ils utilisent le format GGUF :

| Preset | Taille du téléchargement | RAM en fonctionnement |
| --- | --- | --- |
| Q8 (Best Quality) | environ 5,4 Go | environ 5,8 Go |
| Q4_K_M (Smaller, Faster) | environ 3,2 Go | environ 3,6 Go |

Le choix Q8 porte la mention **Recommended**. C'est lui qui donne la meilleure qualité. Le choix Q4_K_M est plus petit et plus rapide, et il consomme moins de mémoire.

Sur Apple Silicon, ces presets deviennent des presets MLX. Le preset MLX 8 bits demande environ 5,9 Go de téléchargement et environ 7,5 Go de RAM. Le preset MLX 4 bits demande environ 3,6 Go de téléchargement et environ 4,8 Go de RAM.

Pour télécharger un preset :

1. Sélectionne le preset voulu.
2. Clique sur **Use Curated Preset**. Si tu as déjà un modèle, ce bouton devient **Switch to Curated Preset**.

### Utiliser ton propre modèle

Sous **Use Your Own Model From HuggingFace**, tu peux fournir ton propre modèle depuis HuggingFace, un site public de partage de modèles.

1. Saisis le nom du dépôt dans le champ. Le format est `owner/repo`.
2. Clique sur **List Models**. Sur Apple Silicon, ce bouton s'appelle **Validate Repo**.
3. Sur du matériel non-Apple, choisis un fichier précis dans le menu déroulant, puis clique sur **Download Selected GGUF**.
4. Sur Apple Silicon, une fois le dépôt validé, clique sur **Use Validated MLX Repo**.

Marinara ne garde qu'un seul fichier de Local Model sur le disque à la fois. Le téléchargement d'un nouveau modèle supprime d'abord l'ancien. Il n'y a pas de bouton de suppression dédié pour le Local Model principal. Pour t'en débarrasser, télécharge un autre modèle par-dessus.

## Référence des Runtime Settings

Ouvre la section **Runtime Settings** dans la fenêtre de configuration pour ajuster le fonctionnement du modèle. Les champs s'enregistrent de différentes façons :

- Les menus déroulants et l'interrupteur **Native Tool Calls** s'enregistrent dès que tu les modifies.
- **Context Window**, **Max Response Tokens**, **Temperature**, **Top P** et **Top K** ne prennent effet qu'après un clic sur **Apply Settings**.
- **Physical Batch Size** a son propre bouton **Apply**. Il en va de même pour le champ du nombre de couches, qui apparaît quand **GPU Offload** est réglé sur **Custom GPU layers**.

| Réglage | Par défaut | Ce qu'il règle |
| --- | --- | --- |
| Runtime Target | Auto detect | La famille de GPU pour laquelle Marinara installe le runtime |
| GPU Offload | Auto offload | La part de travail confiée au GPU |
| Native Tool Calls | On | Autorise le modèle à utiliser des outils et des appels de fonctions |
| Pooling Type | None | Le calcul des embeddings pour la recherche dans les lorebooks |
| Physical Batch Size | 512 | La taille des lots pour les requêtes d'embedding des lorebooks |
| Context Window | 8192 | La quantité de texte que le modèle lit d'un coup |
| Max Response Tokens | 4096 | La longueur maximale d'une réponse du modèle |
| Temperature | 0.3 | Le degré d'imprévisibilité des réponses |
| Top P | 0.95 | Une limite d'échantillonnage pour le choix des mots |
| Top K | 64 | Une limite d'échantillonnage pour le choix des mots |

Quelques précisions sur les champs les plus délicats :

- **Runtime Target** et **GPU Offload** n'apparaissent que sur le runtime GGUF. Sur Apple Silicon, MLX choisit l'accélérateur à ta place.
- **Pooling Type** et **Physical Batch Size** n'apparaissent eux aussi que sur le runtime GGUF, sous le titre **Embedding Endpoint**. Ils ne touchent qu'aux embeddings des lorebooks, jamais aux réponses normales du chat.
- **Pooling Type** vaut **None** par défaut. Passe-le sur **Mean** quand tu utilises le Local Model pour les embeddings des lorebooks.
- **Physical Batch Size** fixe la quantité de texte que le point d'accès d'embedding traite en un lot. Augmente-la quand la vectorisation échoue sur de longues entrées de lorebook. L'application suggère 1024 pour Gemma.
- **Native Tool Calls** doit être activé pour que les outils fonctionnent. L'avertissement indique que Professor Mari et les agents personnalisés en ont besoin avant que le modèle local puisse exécuter des outils. Cette option n'existe pas sur le runtime MLX.
- **Max Response Tokens** limite les réponses du chat normal et des agents. En revanche, ce réglage ne limite pas l'analyse de scène de Game Mode, qui a sa propre limite interne.

## Send Test Message

Utilise **Send Test Message** pour vérifier que le runtime fonctionne. Ce bouton se trouve dans la section Runtime. Il reste inactif tant qu'un modèle n'est pas téléchargé et le runtime installé.

1. Clique sur **Send Test Message**.
2. Attends l'encadré de résultat.
3. En cas de réussite, l'encadré affiche **Local Test Message Succeeded** avec le temps d'aller-retour.
4. En cas d'échec, l'encadré affiche **Local Test Message Failed** avec l'erreur.

Le test utilise un prompt fixe, c'est-à-dire un texte que Marinara envoie à l'IA. Il ignore tes réglages de Temperature et de tokens, ces petits morceaux de texte : c'est donc une vérification propre de la réponse du modèle.

## Utiliser le Local Model pour les tâches d'assistance

Dès qu'un modèle est téléchargé, la carte Local Model affiche deux interrupteurs :

- **Use for tracker agents (roleplay)**. Désactivé par défaut.
- **Use for game scene analysis**. Activé par défaut.

Ces deux interrupteurs décident si Marinara garde le Local Model en fonctionnement en arrière-plan. Si les deux sont désactivés, le runtime ne démarre pas de lui-même. Dès que tu en actives un, Marinara lance automatiquement le serveur local. Le premier démarrage après cette activation peut prendre un moment.

La carte propose aussi un bouton **Use local model for all tracker agents**. Il fait pointer tous les trackers intégrés vers le Local Model en un clic. Une ligne en dessous indique combien de trackers pointent vers le modèle local, par exemple "3/7 built-in tracker agents currently point at the local model." Cela change uniquement le modèle utilisé par les agents, sans les activer. Pour les activer, voir [Rappel de mémoire et résumés de chat](../agents/memory.md) ainsi que le guide de ton mode.

En Game Mode, tu peux aussi confier le travail de scène au Local Model. Dans la configuration du jeu, le menu déroulant **Scene Effects Connection** propose **Local Model (Gemma)**. Ce choix active l'interrupteur **Use for game scene analysis**. Voir [Game Mode : premiers pas](../game/getting-started.md).

### Le Local Model pour les embeddings de lorebooks

Le Local Model peut aussi alimenter la recherche sémantique dans les lorebooks. Dans les contrôles de vectorisation d'un lorebook, choisis **Local Model (sidecar)** comme connexion. Il faut d'abord activer **Use for tracker agents (roleplay)** ou **Use for game scene analysis**. Si les deux sont désactivés, la requête échoue avec un message expliquant que le modèle local doit être activé pour les trackers ou l'analyse de scène du jeu. Ce chemin passe par le runtime GGUF et n'existe pas sur Apple Silicon MLX. Voir [Recherche sémantique pour les lorebooks](../lorebooks/semantic-search.md).

## Utiliser le Local Model comme connexion de chat

Dès qu'un modèle est téléchargé, le Local Model apparaît en bas de la plupart des sélecteurs de connexion. Il s'affiche comme **Local Model (sidecar)**, ou comme **Local Model** suivi du nom du modèle entre parenthèses quand ce nom est connu.

Si tu le choisis pour un chat normal, un avertissement apparaît. Il explique que le Local Model est minuscule et destiné aux tâches d'assistance. Il prévient aussi que les réponses du chat principal et du roleplay risquent d'être lentes, courtes ou de qualité médiocre. Cette entrée n'est pas une vraie connexion enregistrée : impossible donc d'y enregistrer des valeurs par défaut de connexion.

Le choisir pour un chat démarre le serveur local à la demande, même si les deux interrupteurs d'assistance sont désactivés. Le menu déroulant du modèle principal de Game Mode ne le propose pas. Game Mode n'utilise le Local Model qu'à travers **Scene Effects Connection**.

## Local Speech Model pour les appels

Le **Local Speech Model** est un téléchargement optionnel de Calls, destiné à la transcription hors ligne du micro. Il alimente les appels Conversation quand tu choisis de transcrire ta voix sur ta propre machine. C'est un modèle Whisper, un modèle de reconnaissance vocale qui transforme tes paroles en texte.

Installe d'abord **Calls** depuis **Agents > Download Agents**. Tu peux ensuite gérer Whisper depuis la carte **Local Model** dans Connections, sous le titre **Local Speech Model**. Ce titre et les contrôles de téléchargement restent masqués tant que Calls n'est pas installé.

Deux choix sont proposés :

- **Whisper Tiny (Multilingual)** : environ 180 Mo de téléchargement, environ 350 Mo de RAM. Le meilleur premier choix pour les téléphones et les machines anciennes.
- **Whisper Base (Multilingual)** : environ 320 Mo de téléchargement, environ 650 Mo de RAM. Plus précis sur une parole confuse, mais plus long à démarrer.

Pour le configurer :

1. Ouvre la carte **Local Model** et déplie-la.
2. Sous **Local Speech Model**, choisis un modèle dans le menu déroulant.
3. Clique sur **Download Whisper**.
4. Quand l'état affiche **Ready**, tout est prêt.

Pour supprimer uniquement le modèle sélectionné, clique sur le bouton corbeille intitulé **Delete Local Whisper**. La désinstallation de Calls supprime automatiquement tous les modèles Whisper téléchargés et la sélection enregistrée, ce qui libère leur espace disque. Si tu réinstalles Calls plus tard, les contrôles du Local Speech Model reviennent et tu peux télécharger Whisper à nouveau.

Ton audio enregistré ne quitte jamais ta machine. Seul le texte transcrit part vers la connexion de chat que tu as choisie. Pour t'en servir pendant un appel, règle le mode d'entrée audio de l'appel sur l'option Local Whisper. Voir [Appels audio et vidéo en Conversation](../conversation/calls.md).

## Dépannage

**"Sidecar runtime install is disabled."** Installer ou réinstaller le runtime est une action protégée. Les installations Windows en un clic l'activent pour toi. Sur macOS, Linux et Docker, tu as deux options. Définis `SIDECAR_RUNTIME_INSTALL_ENABLED=true` dans le fichier `.env` du serveur, par exemple :

```
SIDECAR_RUNTIME_INSTALL_ENABLED=true
```

Ou saisis une fois ton secret Admin Access dans **Settings -> Advanced -> Admin Access** (Paramètres), puis réessaie. Voir [Référence de configuration du serveur](../CONFIGURATION.md).

**Le runtime n'a pas démarré.** La fenêtre de configuration affiche un encadré intitulé **Local runtime failed to start** avec l'erreur et le chemin d'un fichier de log, le journal du serveur. Clique sur **Retry Startup**. Si cela échoue, clique sur **Reinstall Runtime**, ou essaie une autre valeur de **Runtime Target**. Le bouton **Continue Without Local AI** te permet de continuer à utiliser Marinara sans le Local Model. La carte dans Connections signale le même problème avec la mention **Local runtime unavailable**.

**Le téléchargement du runtime signale une taille ou une somme de contrôle SHA-256 qui ne correspond pas.** Marinara a écarté le téléchargement avant l'extraction. Mets d'abord Marinara à jour, puis réessaie pour que le manifeste des runtimes approuvés et le téléchargement concordent. Si la même version échoue encore, ne tente pas d'extraire ou d'exécuter l'archive à la main : signale la valeur de **Runtime Target** et l'erreur aux mainteneurs.

**La recherche dans les lorebooks dit que le modèle local n'est pas activé.** Active **Use for tracker agents (roleplay)** ou **Use for game scene analysis** dans la carte Local Model, puis relance la vectorisation.

**Un bandeau de Game Mode affiche "Local scene helper failed to start."** Clique sur **Open Local AI Model** dans le bandeau pour réessayer, changer de modèle ou désactiver l'analyse de scène locale.

Pour plus d'aide, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Modèles de décision](decision-models.md)
- [Connecter un modèle local ou auto-hébergé](local-self-hosted.md)
- [Rappel de mémoire et résumés de chat](../agents/memory.md)
- [Appels audio et vidéo en Conversation](../conversation/calls.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Recherche sémantique pour les lorebooks](../lorebooks/semantic-search.md)
