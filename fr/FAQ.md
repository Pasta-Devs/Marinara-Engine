# Foire aux questions

Des réponses courtes aux questions courantes sur Marinara Engine. Chacune renvoie vers le guide qui donne les étapes complètes.

<a id="how-do-i-access-marinara-engine-from-my-phone-or-another-device"></a>

## Comment accéder à Marinara Engine depuis mon téléphone ou un autre appareil ?

Marinara tourne comme serveur sur un ordinateur, et tu l'ouvres dans un navigateur. Les scripts de démarrage laissent les autres appareils atteindre le serveur, mais le contrôle d'accès les bloque tant que tu n'as pas défini une connexion (un nom d'utilisateur et un mot de passe) sur l'ordinateur hôte. D'ici là, un appareil distant ne voit qu'une page **Access blocked** (accès bloqué).

1. Laisse Marinara tourner sur l'ordinateur hôte.
2. Trouve l'adresse IP locale de l'hôte. Sous Windows, lance `ipconfig` et lis la ligne **IPv4 Address**. Sous macOS ou Linux, lance `hostname -I`.
3. Sur l'autre appareil, ouvre `http://<host IP>:7860` dans un navigateur, par exemple `http://192.168.1.42:7860`. `7860` est le port par défaut.
4. Définis une connexion. Depuis l'autre appareil, ouvre Marinara : la page de blocage contient un formulaire **Setup code** (code de configuration). Trouve le code à usage unique dans le log du serveur, sur l'ordinateur hôte (dans Docker, lance `docker logs <container> 2>&1 | grep "setup code"`), puis saisis-le avec un nouveau nom d'utilisateur et un nouveau mot de passe. Autre option : dans un navigateur déjà connecté sur l'hôte, ouvre **Settings → Advanced → Access** (Paramètres → Avancé → Accès).
5. Connecte-toi. Pour ajouter d'autres appareils sans saisir le mot de passe, utilise **Add a device** (ajouter un appareil) dans **Settings → Advanced → Access**.

Dans une installation de bureau ordinaire, le même ordinateur (`127.0.0.1`) n'a besoin d'aucun mot de passe. Un reverse proxy sur le même ordinateur compte comme un visiteur distant et exige la connexion. Pour toutes les options, les codes de configuration et Docker, voir [Accès à distance](REMOTE_ACCESS.md#option-1-login-recommended). Pour des appareils sur des réseaux différents, utilise Tailscale : voir [Se connecter de n'importe où avec Tailscale](REMOTE_ACCESS.md#connect-from-anywhere-with-tailscale). Si tu n'arrives pas à te connecter, voir [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md).

## Existe-t-il une application mobile pour Marinara ?

Il n'existe pas d'application native à part. Sur téléphone ou tablette, utilise l'application web dans un navigateur. La plupart des navigateurs proposent **Add to Home Screen** (ajouter à l'écran d'accueil) ou **Install App** (installer l'application), qui l'enregistre comme PWA (un site web qui s'ouvre comme une application, sans barre de navigateur).

Sous Android, tu peux aussi [télécharger le dernier APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Il fait tourner Marinara sur le téléphone via Termux. Voir [Installation sur Android](installation/android-termux.md). Sur iPhone et iPad, voir le [guide PWA pour iOS](installation/ios-pwa.md).

Dans l'application Android, le lanceur propose **Open in browser** (ouvrir dans le navigateur), **Retry connection** (réessayer la connexion) et **Install / Start Marinara** (installer / démarrer Marinara). Pour changer ton choix plus tard, utilise **Settings → General → App Behavior → Open Android launcher (app or browser)** (Paramètres → Général → comportement de l'application → ouvrir le lanceur Android, application ou navigateur). Avec les anciens APK, la connexion se fait manuellement à `/android-login`.

<a id="can-i-play-with-other-people"></a>

## Puis-je jouer avec d'autres personnes ?

Oui. Le multijoueur facultatif permet à plusieurs personnes de partager un même chat Conversation, Roleplay ou Game. Chacun active le réglage, puis héberge ou rejoint. Les invités n'ont pas besoin de clé IA. Un mot de passe ne rend pas un hôte inconnu sûr. Lis la [configuration, les avertissements et les limites du multijoueur](CONFIGURATION.md#optional-multiplayer) avant de l'activer.

## Quels sont les trois modes de chat ?

- **Conversation** : un chat de style messagerie avec un personnage.
- **Roleplay** : une scène de récit immersive, avec narration et avatars des personnages.
- **Game** : une aventure textuelle menée par un Game Master IA (le maître du jeu).

Pour en choisir un, voir [Démarrer avec Marinara Engine](home/welcome.md#choose-a-chat-mode).

## Comment changer le fuseau horaire utilisé par les emplois du temps Conversation ?

Ouvre un chat Conversation, puis choisis **Schedule timezone** (fuseau horaire des emplois du temps) dans Chat Settings (réglages du chat). **Use device** (utiliser l'appareil) le remet sur le fuseau horaire de ton appareil. C'est un seul réglage global pour tous les chats Conversation, et il se synchronise avec les autres appareils connectés au même serveur. Voir [Mode Conversation : premiers pas](conversation/getting-started.md).

<a id="does-each-conversation-chat-have-its-own-schedule"></a>

## Chaque chat Conversation a-t-il son propre emploi du temps ?

Non. Un emploi du temps appartient au personnage : tous les chats Conversation avec ce personnage l'utilisent donc. Modifie-le dans **Character Editor → Convo → Weekly schedule** (éditeur de personnage → Convo → emploi du temps hebdomadaire).

Pour obtenir des réponses immédiates dans un seul chat, désactive **Conversation schedules** (emplois du temps Conversation) dans les Chat Settings de ce chat. Un forçage manuel du statut, comme **dnd**, s'applique toujours, et il appartient au personnage dans tous les chats. Utilise **clear** pour le retirer.

## Ai-je besoin d'une clé API pour utiliser Marinara ?

Oui, pour les services d'IA en ligne. Une **clé API** est un code secret fourni par un service d'IA, qui permet à Marinara d'utiliser ton compte chez lui. Il te faut au moins un compte avant de pouvoir démarrer un chat. Ouvre **Connections** (Connexions), clique sur **Add** (ajouter), choisis un service, colle ta clé et clique sur **Connect** (connecter). Voir [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md).

Certaines options n'ont pas besoin de clé. Les options par abonnement (Claude, ChatGPT et Grok) se connectent via un outil en ligne de commande. Le **Built-in model** (modèle intégré) tourne sur ton ordinateur. Voir [Configuration du modèle intégré](connections/local-model.md).

## Quels fournisseurs d'IA sont pris en charge ?

Marinara prend en charge OpenAI, Anthropic, Google Gemini, OpenRouter et bien d'autres services pour la génération de texte, d'images et de vidéos, ainsi que les serveurs **OpenAI-compatible** (compatibles OpenAI) comme Ollama, LM Studio et KoboldCpp. La liste complète se trouve dans [Fournisseurs d'IA pris en charge](connections/providers-reference.md). Pour en ajouter un, voir [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md).

## Faut-il payer pour utiliser Marinara ?

Marinara est gratuit. Tu paies ce que facture ton service d'IA. Certaines options ne coûtent rien à l'essai : les images **Pollinations** ne demandent aucune clé, **Stable Horde** est gratuit, et le **Built-in model** tourne sur ton ordinateur. Les options par abonnement utilisent un forfait payant que tu as peut-être déjà.

## Mes clés API sont-elles en sécurité ?

Oui. Chaque clé API est chiffrée en AES-256 avant d'être enregistrée. Les exports de comptes et de profils laissent les valeurs secrètes de côté : ressaisis donc tes clés après avoir utilisé **Import Profile** (importer un profil), y compris sur un ZIP de sauvegarde complète. Un ZIP de sauvegarde complète contient les enregistrements chiffrés et le fichier de clé qui les déverrouille : garde-le pour toi. Voir [Sauvegarder et restaurer Marinara](data/backup-and-restore.md).

## Qu'est-ce qu'une fiche de personnage ?

Une fiche de personnage est le profil enregistré d'un personnage IA : son nom, son avatar, sa personnalité, son passé et son message d'accueil. Tu crées les fiches dans le **Character Editor**, ou tu les importes depuis d'autres applications. Voir [Créer et modifier des personnages](characters/creating-and-editing-characters.md).

## Qu'est-ce qu'un lorebook, et comment l'utiliser avec plusieurs personnages ?

Un lorebook est un recueil de faits sur ton univers. Chaque entrée rejoint le prompt (le texte que Marinara envoie à l'IA) uniquement quand ses mots déclencheurs apparaissent dans le chat. Tu peux :

1. Remplir **Linked Characters** (personnages liés) ou **Linked Personas** (personas liés) dans l'éditeur de lorebook. Il fonctionne alors dans tout chat avec eux.
2. Ouvrir **Chat Settings → Lorebooks → Add Lorebook** (réglages du chat → Lorebooks → ajouter un lorebook) pour le rattacher à un seul chat.
3. Réserver des entrées précises à certains personnages.

Voir [Lorebooks](lorebooks/overview.md).

## Qu'est-ce qu'un agent ?

Un agent est une aide IA facultative qui tourne pendant un chat pour accomplir une tâche précise, comme suivre la scène ou ajouter des cartes. Une installation neuve n'en contient aucun. Ouvre **Agents → Agent Organizer** (Agents → organisateur d'agents), choisis-en un et installe-le. Active-le ensuite chat par chat dans **Chat Settings**. Voir [Agents](agents/agents-overview.md).

## Comment configurer Noodle ?

Noodle est un réseau social local et fictif pour tes personnages. Installe **Noodle** depuis **Agents → Agent Organizer**, redémarre Marinara quand on te le demande, puis ouvre **Home → Noodle** (accueil → Noodle). Voir [Noodle : la timeline sociale intégrée](agents/noodle.md).

## Pourquoi mon personnage ne répond-il pas ?

En général, le chat n'a ni compte ni modèle, la clé API est fausse, ou le compte n'a plus de crédit. Voir [Mon personnage ne répond pas](TROUBLESHOOTING.md#my-character-does-not-reply).

## Pourquoi mon personnage ne se souvient-il pas des messages plus anciens ?

Les modèles ne lisent qu'une quantité limitée de texte à la fois : dans les longs chats, les vieux messages finissent donc par sortir. Deux outils aident. **Memory Recall** ramène les anciens messages pertinents, et les résumés compressent les vieux messages en récapitulatifs. Les deux se trouvent dans **Chat Settings**. Pour les longs chats Roleplay, utilise **Advanced Memory Recall** (rappel de mémoire avancé) dans **Chat Settings → Memory Recall**. Voir [Mémoire et résumés](agents/memory.md).

## Comment sauvegarder mes données ?

Ouvre **Settings → Advanced → Backup & Export** (Paramètres → Avancé → Sauvegarde et export) et clique sur **Download Backup** (télécharger la sauvegarde). Marinara enregistre un `.zip` de tes données et de tes fichiers téléversés. Pour restaurer, utilise **Import Profile (JSON/ZIP)** dans **Settings → Imports** (Paramètres → Imports). La même section peut lancer une sauvegarde quotidienne, hebdomadaire ou mensuelle. Voir [Sauvegarder et restaurer Marinara](data/backup-and-restore.md).

## Comment fonctionnent les extensions, et puis-je importer du code tiers ?

Par défaut, seule Professor Mari crée des brouillons de Personal Extension. Un brouillon démarre désactivé, et tu approuves son code exact avant qu'il ne s'exécute. Les imports tiers restent masqués tant que `ENABLE_EXTERNAL_EXTENSIONS=true` n'est pas défini dans le `.env` de l'hôte et que tu n'as pas accepté l'avertissement sous **Settings → Advanced → Danger Zone** (Paramètres → Avancé → Zone de danger). Voir [Extensions personnelles](extending/personal-extensions.md).

## Où mes données sont-elles stockées ?

Sur l'ordinateur qui fait tourner Marinara, dans le dossier `data` de ton installation. Rien n'est stocké dans le cloud. Voir [Où Marinara enregistre tes données](data/where-data-is-stored.md).

## Vais-je perdre mes données en mettant à jour ?

Non. Une mise à jour conserve tes personnages, tes chats et tes réglages. Fais quand même une sauvegarde avant. Revenir à une version plus ancienne peut faire perdre des données que seule la version plus récente enregistre. Voir [Mettre à jour Marinara Engine](UPGRADING.md) et [Revenir à une ancienne version](UPGRADING.md#downgrading-to-an-older-version).

## Que peut faire Professor Mari ?

Professor Mari est l'assistante intégrée de l'écran d'accueil. Elle explique l'application, et crée ou modifie des personnages, des personas, des lorebooks et des presets quand tu le demandes. Chaque modification affiche un encart avec **Undo** (annuler). Voir [Professor Mari](home/professor-mari.md).

## Qu'est-ce que l'agent Storyboard et comment l'utiliser en Game Mode ?

Il transforme un texte d'histoire terminé en images. Installe **Storyboard** depuis **Agents → Agent Organizer**, puis active-le dans le chat. Voir le [Guide de l'agent Storyboard](game/storyboard.md).

## Les personnages peuvent-ils parler à voix haute pendant un appel ?

Oui, en mode Conversation. Il faut que **Text to Speech** (synthèse vocale) soit configuré dans **Connections**. Pour les étapes, y compris la reconnaissance vocale pour ton micro, voir [Appels](conversation/calls.md).

## Marinara peut-il générer des images ?

Oui. Ajoute un compte de génération d'images, par exemple **Pollinations** (aucune clé nécessaire) ou un service payant. Voir [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md).

## Comment lire la documentation dans l'application ?

Sur l'écran d'accueil, clique sur **Documentation** dans les marque-pages. Sur téléphone, ouvre d'abord le menu des marque-pages. Dans la FAQ de l'accueil, tu peux aussi cliquer sur **Open Documentation** (ouvrir la documentation).

## Où trouver de l'aide ou signaler un bug ?

Commence par [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md). Sur l'accueil, **Discord** ouvre le chat de la communauté et **Support** ouvre la page de support du projet. Signale les bugs et les demandes de fonctionnalités sur la page GitHub du projet.

## Guides associés

- [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md)
- [Installation](INSTALLATION.md)
- [Accès à distance](REMOTE_ACCESS.md)
- [Se connecter à un fournisseur d'IA](connections/connecting-to-a-provider.md)
