# Foire aux questions

Ce guide répond aux questions les plus fréquentes sur Marinara Engine. Les réponses sont regroupées par thème. Chacune renvoie vers un guide complet quand tu veux aller plus loin.

## Comment accéder à Marinara Engine depuis mon téléphone ou un autre appareil ?

Marinara Engine tourne comme serveur local sur un ordinateur. Tu l'ouvres dans un navigateur web. Cette réponse explique comment y accéder depuis un téléphone, une tablette ou un autre ordinateur du même réseau.

Les scripts de démarrage (`start.sh`, `start.bat` et `start-termux.sh`) lient déjà le serveur à toutes les interfaces réseau (`0.0.0.0`). Les autres appareils peuvent donc atteindre le serveur, mais le contrôle d'accès les bloque par défaut. Tant que l'accès n'est pas configuré sur l'ordinateur hôte, un appareil distant ne voit qu'une page **Access blocked** (accès bloqué) avec les instructions de configuration.

Voici la marche à suivre :

1. Laisse Marinara tourner sur l'ordinateur hôte.
2. Sur l'ordinateur hôte, configure le contrôle d'accès : Basic Auth (un nom d'utilisateur et un mot de passe) ou une liste d'autorisation d'adresses IP (les adresses des appareils de confiance). [Accès à distance](REMOTE_ACCESS.md) détaille chaque option, y compris un contournement pour les réseaux privés entièrement fiables.
3. Trouve l'adresse IP locale de l'ordinateur hôte. Sous Windows, lance cette commande et lis la ligne **IPv4 Address** :

```
ipconfig
```

Sous macOS ou Linux, lance cette commande :

```
hostname -I
```

4. Sur l'autre appareil, ouvre un navigateur web et va à l'adresse IP de l'hôte suivie du port. Le port par défaut est `7860` :

```
http://192.168.1.42:7860
```

Remplace `192.168.1.42` par l'adresse IP de ton propre hôte.

5. Connecte-toi si le navigateur demande le nom d'utilisateur et le mot de passe Basic Auth. Si une page **Access blocked** s'affiche à la place, termine d'abord l'étape 2 sur l'hôte.

Dans une installation de bureau ordinaire, aucun mot de passe n'est nécessaire sur le même ordinateur (`127.0.0.1`). Les installations Android gérées par l'APK ajoutent une connexion privée sur localhost pour empêcher une autre application Android de se faire passer pour Marinara, mais l'enveloppe Android crée et utilise automatiquement cet identifiant. Les autres appareils restent bloqués tant que le contrôle d'accès n'est pas configuré (Basic Auth ou liste d'autorisation d'adresses IP). Chaque option est expliquée dans [Accès à distance](REMOTE_ACCESS.md).

Si les deux appareils ne sont pas sur le même réseau, un outil comme Tailscale peut aider. Tailscale donne à chaque appareil une adresse privée stable. Tu peux ensuite te connecter depuis n'importe où, sans exposer Marinara à l'internet public. Si la connexion échoue, consulte [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md).

## Existe-t-il une application mobile pour Marinara ?

Marinara n'a pas d'application mobile native dédiée. Sur téléphone ou tablette, tu utilises la même application web dans un navigateur. La plupart des navigateurs mobiles proposent une option **Add to Home Screen** (ajouter à l'écran d'accueil) ou **Install App** (installer l'application) qui donne l'impression d'une vraie application, sans barre de navigateur. C'est ce qu'on appelle une PWA (Progressive Web App, un site web qui s'installe comme une application).

Sous Android, tu peux aussi [télécharger directement le dernier APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Il fait tourner Marinara localement sur le téléphone via Termux. L'installation ne demande ni clé de signature, ni mot de passe, ni secret d'accès local ; consulte [Installation sur Android](installation/android-termux.md) pour les demandes d'autorisation Android. Sur iPhone et iPad, voir le [guide PWA pour iOS](installation/ios-pwa.md).

L'enveloppe Android se connecte automatiquement lorsqu'elle ouvre son serveur Termux géré par l'APK. L'identifiant privé n'est visible que si tu ouvres volontairement le serveur dans un autre navigateur du même téléphone : ouvre `/android-login`, exécute `cat ~/.marinara-engine/android-secret` dans Termux et colle la valeur affichée. La CLI `mari` locale lit automatiquement ce même secret géré par le lanceur. Les installations Termux manuelles conservent les règles normales pour localhost et l'accès réseau.

## Quels sont les trois modes de chat ?

Marinara propose trois modes de chat, affichés sous forme d'onglets quand tu ouvres la liste des chats :

- **Conversation** : un chat de style SMS ou message privé, comme si tu écrivais à un personnage dans une application de messagerie.
- **Roleplay** : une scène de récit immersive, avec narration, avatars des personnages et illustrations facultatives.
- **Game Mode** : une aventure textuelle guidée par un Game Master (le maître du jeu), avec images de scène et vidéos facultatives.

Chaque mode a son propre guide de démarrage. Commence par le mode qui t'intéresse, puis explore ses guides détaillés.

## Comment changer le fuseau horaire utilisé par les emplois du temps Conversation ?

Ouvre un chat Conversation et choisis **Schedule timezone** (fuseau horaire des emplois du temps) dans **Chat Settings** (réglages du chat). Autre option : le choisir pendant la création des emplois du temps, dans l'assistant de configuration Conversation. Marinara part du fuseau horaire indiqué par l'appareil, mais tu peux sélectionner n'importe quel fuseau IANA pris en charge, ou choisir **Use device** pour revenir à celui de l'appareil. Ce réglage est global pour tous les chats Conversation, y compris les messages autonomes générés côté serveur, et il se synchronise avec les autres appareils connectés au même serveur Marinara.

## Ai-je besoin d'une clé API pour utiliser Marinara ?

Presque toujours, oui. Une **connexion** est un lien enregistré qui indique à Marinara comment joindre un service d'IA : quel fournisseur, quel modèle et tes identifiants. Une **clé API** est un code secret, un peu comme un mot de passe. Un fournisseur d'IA te la fournit pour que Marinara puisse dialoguer avec lui à ta place.

Il faut au moins une connexion avant de pouvoir démarrer un chat. Pour en créer une, ouvre le panneau **Connections** (connexions), clique sur le bouton **New** (nouveau), choisis un fournisseur, colle la clé dans le champ **API Key**, puis sélectionne un modèle. Pour la marche à suivre complète, voir [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md).

Quelques fournisseurs n'utilisent pas de clé API du tout. Les options par abonnement (Claude, ChatGPT et Grok) passent par un outil en ligne de commande, et le Local Model intégré tourne sur ta propre machine sans aucune clé.

## Quels fournisseurs d'IA sont pris en charge ?

Marinara prend en charge de nombreux fournisseurs. Tu en choisis un par connexion.

Pour le texte des chats et du roleplay, les choix sont **OpenAI**, **OpenAI (ChatGPT)**, **Anthropic**, **Claude (Subscription)**, **Grok CLI (Subscription)**, **Google Gemini**, **Google Vertex AI**, **Mistral**, **Cohere**, **OpenRouter**, **NanoGPT**, **xAI / Grok**, ainsi que **Custom (OAI-Compatible)** pour les modèles locaux ou auto-hébergés comme Ollama, LM Studio et KoboldCpp.

Pour la génération d'images, les choix comprennent **OpenAI (DALL-E)**, **Stability AI**, **Together AI**, **NovelAI**, **OpenRouter Images**, **xAI / Grok Imagine**, **Venice.ai**, **Atlas Cloud**, **Pollinations**, **Stable Horde**, **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **RunPod Serverless (ComfyUI)**, **Draw Things**, **NanoGPT** et **Block Entropy**.

Pour la génération de vidéos, les choix sont **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **Atlas Cloud**, **Seedance 2.0**, ainsi que les workflows locaux au format API de **ComfyUI**.

Tu peux enregistrer plusieurs connexions à la fois et en attribuer une différente à chaque chat. Voir [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md).

## Faut-il payer pour utiliser Marinara ?

Marinara est gratuit et tourne sur ton propre ordinateur. Tu paies ce que facture le fournisseur d'IA choisi, ce qui varie selon le fournisseur et le modèle.

Certaines options ne coûtent rien à l'essai. La génération d'images **Pollinations** ne demande aucune clé. **Stable Horde** est gratuit, et une clé facultative permet de passer en priorité. Le **Local Model** intégré tourne sur ta machine sans clé. Les options par abonnement (Claude, ChatGPT et Grok) s'appuient sur un forfait payant que tu as peut-être déjà, au lieu d'une clé API facturée à l'usage.

## Mes clés API sont-elles en sécurité ?

Oui. Marinara chiffre chaque clé API en AES-256 avant de l'enregistrer sur le disque. Les exports de connexions et de
profils retirent les valeurs secrètes. Une sauvegarde complète, c'est différent : elle contient les enregistrements chiffrés et, s'il existe, le fichier de clé de
chiffrement qui permet de les déverrouiller. Garde donc les ZIP de sauvegarde complète pour toi.

Comme l'import de profil laisse volontairement les valeurs secrètes de côté, tu dois ressaisir chaque clé API après avoir importé un
profil, y compris quand tu utilises **Import Profile** (importer un profil) sur un ZIP de sauvegarde complète. Une restauration manuelle du dossier de données complet conserve
les clés chiffrées, à condition de restaurer aussi le fichier de clé de chiffrement correspondant.

## Qu'est-ce qu'une fiche de personnage ?

Une **fiche de personnage** est le profil enregistré d'un personnage IA : son nom, son avatar, sa personnalité, son passé et son message d'accueil. Tu crées et modifies les fiches dans le **Character Editor** (éditeur de personnage). Tu peux aussi importer des fiches créées dans d'autres applications. Voir [Créer et modifier des personnages](characters/creating-and-editing-characters.md).

## Qu'est-ce qu'un lorebook, et comment l'utiliser avec plusieurs personnages ?

Un **lorebook** est un ensemble d'entrées de World Info, autrement dit un recueil de faits sur ton univers. Chaque entrée ajoute des faits au prompt (le texte que Marinara envoie à l'IA) uniquement quand ses mots-clés déclencheurs apparaissent dans le chat. Cela économise des tokens (de petits morceaux de texte) et garde le lore cohérent. Il existe trois façons de définir la portée d'un lorebook. Choisis celle qui te convient :

1. Lie-le à des personnages ou à des personas, les personnages que tu incarnes. Dans l'éditeur de lorebook, remplis le champ **Linked Characters** (personnages liés) ou **Linked Personas** (personas liés). Le lorebook s'active alors dans tout chat qui inclut un personnage lié ou qui utilise un persona lié. Les deux champs acceptent plusieurs valeurs : ajoute donc tous les personnages voulus.
2. Rattache-le à un seul chat. Ouvre **Chat Settings**, va dans la section **Lorebooks** et utilise le bouton **Add Lorebook** (ajouter un lorebook). C'est le bon choix quand le lore ne concerne qu'un chat précis.
3. Filtre les entrées une par une selon le personnage. Dans un lorebook partagé, tu peux marquer chaque entrée pour qu'elle ne se déclenche qu'en présence de certains personnages. Pratique pour un grand lorebook d'univers dont certaines entrées sont propres à un personnage.

Pour la fonctionnalité complète, voir [Lorebooks](lorebooks/overview.md).

## Qu'est-ce qu'un agent ?

Un **agent** est une aide IA facultative qui tourne pendant un chat pour accomplir une tâche précise. Par exemple : suivre la scène en cours, surveiller la qualité d'écriture, ajouter des cartes ou des appels, ou animer un jeu de table en mode Conversation. Une installation neuve ne contient aucun agent facultatif. Ouvre le panneau **Agents**, clique sur **Download Agents** (télécharger des agents), lis le détail d'un élément, puis installe-le. Active ensuite les agents compatibles chat par chat dans **Chat Settings**. Quand un package officiel installé reçoit une mise à jour compatible, Marinara demande confirmation avant de la télécharger. Si tu réponds **No**, la version actuelle est conservée et le bouton **Update** (mettre à jour) reste disponible dans Download Agents pour plus tard. Si l'hôte est hors ligne ou si la vérification échoue, la version installée continue de fonctionner. Le catalogue gère aussi la suppression complète d'un package. Voir [Agents : des aides IA pour tes chats](agents/agents-overview.md) et le [dépôt public Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).

## Comment configurer Noodle ?

Noodle est le réseau social local et fictif de Marinara, réservé à tes personnages. Ouvre l'onglet **Noodle**, puis ouvre ses **Settings** (Paramètres). Invite des personnages ou des dossiers de personnages, choisis une connexion de génération sous **Refresh**, puis sélectionne **Refresh now** pour générer la première activité. Tu peux aussi régler des horaires d'actualisation automatique, la génération d'images, des utilisateurs aléatoires et la reprise dans tes chats.

Voir [Noodle : le fil social intégré](noodle/overview.md) et [Réglages de Noodle et reprise dans les chats](noodle/settings.md) pour les guides complets.

## Pourquoi mon personnage ne se souvient-il pas des messages plus anciens ?

Les modèles d'IA ne peuvent traiter qu'une quantité limitée de texte à la fois : dans les longs chats, les vieux messages finissent donc par sortir du champ. Marinara dispose de deux systèmes de mémoire qui aident :

- **Memory Recall** cherche dans les messages précédents et réinsère discrètement les passages les plus pertinents dans le prompt. Active cette option dans **Chat Settings**, section **Memory Recall**.
- Les résumés compressent les anciens messages en récapitulatifs courts. Les chats Roleplay utilisent **Chat Summary**, les chats Conversation utilisent **Automatic Summarization**.

Pour la configuration et les détails, voir [Mémoire et résumés](agents/memory.md).

## Comment sauvegarder mes données ?

Ouvre **Settings**, va dans l'onglet **Advanced** (avancé), trouve la section **Backup & Export** et clique sur **Download Backup** (télécharger la sauvegarde). Marinara enregistre une seule archive `.zip`, avec tes données et les fichiers que tu as téléversés. Pour la restaurer plus tard, utilise **Import Profile (JSON/ZIP)** dans **Settings**, onglet **Imports**, et choisis le même fichier `.zip`.

Autre option : activer dans la même section une sauvegarde automatique tournante, quotidienne, hebdomadaire ou mensuelle. Les ZIP de sauvegarde complète peuvent
contenir les enregistrements chiffrés et le fichier de clé qui permet de les déverrouiller : garde-les pour toi. **Import Profile** laisse
toujours les secrets des fournisseurs vides, alors ressaisis les clés après un import. Pour le guide complet, voir
[Sauvegarder et restaurer](data/backup-and-restore.md).

## Comment fonctionnent les extensions, et puis-je importer du code tiers ?

Par défaut, seule Professor Mari peut créer pour toi un brouillon d'extension personnelle. Il démarre désactivé, et tu dois inspecter son code puis approuver le hash SHA-256 exact avant qu'il ne s'exécute.

Par défaut, le code navigateur s'exécute dans un Worker dédié, à l'intérieur d'une iframe à origine opaque. En plus des capacités restreintes (logs, stockage privé, minuteries, nettoyage et interface déclarative), il reçoit les identifiants opaques du chat actif et des personnages. Des extensions comme Notepad gardent ainsi un état propre à chaque chat. Une extension navigateur peut demander en plus des instantanés limités : uniquement les fiches des personnages présents dans ce chat, et/ou le persona choisi pour lui. Ces autorisations s'affichent au moment de l'approbation du hash exact ; sans elles, les enregistrements correspondants sont absents. Les extensions isolées ne reçoivent jamais les messages, les bibliothèques complètes de personnages ou de personas, les champs non déclarés, les métadonnées du chat, l'accès au DOM, l'accès réseau ni les API de modification. Le code serveur s'exécute dans un processus séparé, isolé par le système, sur les hôtes macOS et Linux pris en charge, et ne reçoit pas le contexte de chat du navigateur.

Les imports tiers sont masqués par défaut. L'opérateur de l'hôte doit définir `ENABLE_EXTERNAL_EXTENSIONS=true` dans le fichier `.env`, puis l'utilisateur doit accepter l'avertissement sous **Settings → Advanced → Danger Zone**. Tant que ces deux verrous ne sont pas levés, les enregistrements externes, y compris ceux stockés manuellement et ceux importés depuis un profil, n'apparaissent pas, ne peuvent pas être approuvés et ne peuvent pas s'exécuter.

Une extension externe peut demander l'option **Full page access** (accès complet à la page) quand la compatibilité avec du code ancien exige réellement le DOM de Marinara. Ce mode n'est pas isolé : le code exact approuvé s'exécute dans la page de Marinara. Il accède alors au contenu de la page, au stockage du navigateur, aux API réseau et à la session en cours sur la même origine. Les brouillons de Professor Mari ne peuvent pas la demander. Ne l'active qu'après avoir inspecté cette version précise et lui avoir accordé ta confiance. Si des modifications non enregistrées subsistent, recharge la page après l'avoir désactivée. Voir [Extensions personnelles](extending/personal-extensions.md).

## Où mes données sont-elles stockées ?

Tout reste sur l'ordinateur qui fait tourner Marinara, dans le dossier `data` de ton installation. Tes personnages, chats, personas, lorebooks, presets et réglages y sont tous enregistrés. Rien n'est stocké dans le cloud. Voir [Où sont stockées tes données](data/where-data-is-stored.md).

## Vais-je perdre mes données en mettant à jour ?

Non. La mise à jour de Marinara conserve tes personnages, tes chats et tes réglages en place. Mieux vaut quand même faire une sauvegarde avant une grosse mise à jour, au cas où. Pour les étapes de mise à jour sur chaque plateforme, voir [Mettre à jour](UPGRADING.md).

## Que peut faire Professor Mari ?

Professor Mari est l'assistante intégrée de l'écran d'accueil. Ouvre-la avec le bouton **Ask Professor Mari** (demander à Professor Mari). Elle explique le fonctionnement de l'application et aide à la configuration. Elle peut aussi créer ou modifier tes données quand tu le demandes en langage courant : personnages, personas, lorebooks, presets de prompt (des modèles d'instructions enregistrés) et nouveaux chats.

Elle affiche aussi des pastilles de suggestion de réponse rapide au-dessus du champ de saisie, pour guider les créations et les modifications en plusieurs étapes sans te faire taper chaque détail à la main.

Quand elle modifie tes données, une carte de revue apparaît avec les boutons **Keep** (garder) et **Restore** (restaurer) : tu peux ainsi annuler ce que tu ne veux pas. C'est une aide, pas un remplacement de ces guides quand une question dépend de la version. Pour la liste complète de ce qu'elle sait faire, voir [Professor Mari](home/professor-mari.md).

Professor Mari peut aussi modifier les fichiers source ordinaires de Marinara. En revanche, les fichiers de dépendances, les lanceurs, les installeurs et les workflows CI attendent une revue explicite. Si sa modification nécessite une bibliothèque npm publique, Marinara affiche la version résolue exacte et l'intégrité du registre avant de l'installer, scripts de cycle de vie désactivés.

À noter : sur une adresse distante ordinaire, les actions de Professor Mari qui modifient des données exigent à la fois Basic Auth et un secret d'administration. Les routes réseau de confiance ou autorisées peuvent utiliser les contournements décrits dans [Accès à distance](REMOTE_ACCESS.md).

## Qu'est-ce que l'agent Storyboard et comment l'utiliser en Game Mode ?

L'agent **Storyboard**, à télécharger, transforme un texte d'histoire terminé en une séquence ordonnée d'images-clés, et il peut animer chaque image-clé en un court clip. En **Game Mode**, il traite un tour de narration terminé du Game Master (GM) et affiche les images dans une visionneuse flottante ou en arrière-plan du jeu. En **Roleplay**, il réunit les échanges qui viennent de se terminer en un épisode affiché dans le fil.

Pour t'en servir en Game Mode, installe **Storyboard** depuis **Agents > Download Agents**. Ouvre le jeu, va dans **Chat Settings > Agents**, active **Enable Agents** et **Enable Storyboards**, puis choisis une connexion d'images dans le jeu ou dans la configuration globale de Storyboard. Termine un tour de narration du GM, puis ouvre la **Gallery** (galerie) et clique sur **Create storyboard**. Le bouton **View storyboard** rouvre la visionneuse.

Pour des storyboards automatiques en Game Mode, active **Automatic Storyboard Illustrations**. Active aussi **Automatic Storyboard Animations** et choisis une connexion de génération de vidéos si tu veux des clips. Dans l'assistant de création de partie, la présentation **Storyboard Optimized** façonne seulement la narration du GM : elle n'installe pas l'agent et ne l'active pas. Pour la configuration en Game Mode et en Roleplay, les prompts, les visionneuses, le comportement à la migration et le dépannage, voir [Guide de l'agent Storyboard](game/storyboard.md).

## Les personnages peuvent-ils parler à voix haute pendant un appel ?

Oui, en mode **Conversation**. Les appels audio et vidéo sont réservés au mode Conversation. Pour entendre un personnage parler, configure d'abord **Text to Speech** (synthèse vocale) dans le panneau **Connections**.

Si tu veux répondre au micro et que la reconnaissance vocale du navigateur manque de fiabilité, installe d'abord **Calls** depuis **Agents > Download Agents**. Ouvre ensuite le panneau **Connections**, déplie la carte **Local Model**, trouve **Local Speech Model**, choisis **Whisper Tiny (Multilingual)** ou **Whisper Base (Multilingual)**, puis clique sur **Download Whisper**. Désinstaller Calls supprime aussi ses téléchargements Whisper, ce qui libère de l'espace disque. Pour la configuration complète des appels, voir [Appels](conversation/calls.md).

## Marinara peut-il générer des images ?

Oui. Ajoute une connexion de génération d'images, par exemple **Pollinations** (aucune clé nécessaire) ou un fournisseur payant. Marinara peut alors créer des avatars de personnages, des illustrations de scène, des selfies et les images-clés de l'agent Storyboard, en Roleplay comme en Game Mode. Voir [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md) pour en ajouter une.

## Comment lire la documentation dans l'application ?

Chaque installation embarque l'intégralité des guides. Tu peux les lire sans quitter l'application :

- Sur l'écran d'accueil, clique sur le bouton **Documentation** dans le pied de page, à côté de **Replay Tutorial**.
- Dans la FAQ de l'écran d'accueil, ouvre la question sur la documentation et clique sur **Open Documentation**.

Les deux boutons ouvrent la même visionneuse intégrée. Elle liste tous les guides et les affiche dans Marinara.

## Où trouver de l'aide ou signaler un bug ?

Commence par [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md), qui est organisé par symptôme. Dans le pied de page de l'écran d'accueil, le bouton **Discord** ouvre le chat de la communauté et le bouton **Support** ouvre la page de support du projet. Pour les bugs et les demandes de fonctionnalités, utilise la page GitHub du projet.

## Guides associés

- [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md)
- [Installation](INSTALLATION.md)
- [Accès à distance](REMOTE_ACCESS.md)
- [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md)
