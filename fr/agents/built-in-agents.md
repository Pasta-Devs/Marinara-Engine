# Référence des agents téléchargeables

Ce guide présente les 36 packages officiels proposés par Marinara dans **Agents → Download Agents** (télécharger des agents), classés par catégorie. Une installation neuve de Marinara Engine ne contient aucun agent. Les sources des packages, les manifestes, les artefacts et le catalogue lisible par une machine sont publiés dans [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Pour chaque agent, tu trouves ici ce qu'il fait, à quel moment il s'exécute ou comment il s'intègre, les modes de chat qui l'acceptent et ses principaux réglages. Pour l'installation et l'activation, commence par lire la [Agents : des aides IA pour tes chats](agents-overview.md).

## Comment lire cette référence

Un agent est un petit assistant IA qui s'exécute automatiquement en parallèle de la réponse principale du chat. Installe-le d'abord depuis le catalogue, puis active-le et configure-le chat par chat, et non fiche de personnage par fiche de personnage. Le téléchargement, la mise à jour, la désinstallation, la configuration par chat et l'avertissement sur les coûts sont détaillés dans la [Agents : des aides IA pour tes chats](agents-overview.md).

Chaque agent ci-dessous est résumé en trois points.

- **Phase ou intégration** : le moment où s'exécute un agent de pipeline classique. **Pre-Generation** (avant la génération) s'exécute avant la réponse et peut ajouter du texte au prompt, c'est-à-dire au texte que Marinara envoie à l'IA. **Parallel** (en parallèle) s'exécute en même temps que la réponse et ne voit pas le texte terminé. **Post-Processing** (après la génération) s'exécute une fois la réponse complète et peut la lire, certains agents pouvant même la réécrire. Les packages de fonctionnalité comme Maps, Calls et les jeux de Conversation s'intègrent plutôt directement à leur surface de chat.
- **Où ça marche** : les modes de chat dans lesquels tu peux ajouter l'agent. La plupart des agents fonctionnent dans les chats **Roleplay**. Quelques-uns fonctionnent dans d'autres modes, et chaque fiche le précise.
- **Réglages clés** : les réglages que tu risques le plus de modifier. Ils se définissent au moment où tu ajoutes l'agent, ou plus tard dans la fiche de configuration de l'agent, dans **Chat Settings** (réglages du chat).

Marinara répartit ses agents en trois catégories dans le panneau **Agents** : **Writer Agents**, **Tracker Agents** et **Misc Agents**. Cette référence reprend le même classement.

Un intervalle d'exécution signifie que l'agent s'exécute périodiquement, après un certain nombre de messages, les tiens et ceux de l'IA, au lieu de s'exécuter après chaque message. Cet intervalle se change dans la configuration de l'agent, jusqu'à 100.

## Writer Agents

Les Writer Agents façonnent l'histoire ou le style. Soit ils ajoutent des consignes avant la réponse, soit ils nettoient la réponse après coup.

### Prose Guardian

Réécrit la dernière réponse pour supprimer les mots bannis et les répétitions, sans en changer le sens. Utile quand un modèle répète les mêmes tournures ou abuse d'un mot.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : les champs de texte **Banned Words** (mots bannis, `ozone` par défaut), **Prefer In Writing** et **Remove From Writing**. L'interrupteur **Hold Message Until Rewrite**, activé par défaut, masque la réponse jusqu'à la fin du nettoyage. Sans lui, la réponse brute s'affiche d'abord, puis elle est remplacée.

### Continuity Checker

Corrige les erreurs de logique concrètes de la dernière réponse : un personnage présent à deux endroits en même temps, une chronologie incohérente, etc. Quand il repère des problèmes, il les présente sous forme de liste à cocher pour que tu choisisses les corrections à appliquer.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : l'interrupteur **Hold Message Until Rewrite**.

### Card Evolution Auditor

Observe l'évolution d'un personnage au fil du jeu et propose des modifications de sa fiche de personnage. Il ne modifie jamais rien tout seul. Chaque suggestion ouvre la fenêtre **Review Character Card Updates**, où tu approuves ou refuses.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : par défaut, il s'exécute une fois tous les 8 messages, les tiens et ceux de l'IA. Voir [Approbations d'agents et Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Crée un coup de pouce ponctuel pour l'histoire, uniquement quand tu le demandes. Quand cet agent est actif dans un chat Roleplay, un bouton **Push Story** apparaît au-dessus de la zone de saisie. Clique dessus pour armer la prochaine réponse, qui fera alors avancer l'intrigue ou introduira une surprise.

- **Phase** : **Pre-Generation**.
- **Où ça marche** : Roleplay uniquement.
- **Réglages clés** : le réglage **Story Push Mode** (**Natural** pour prolonger les fils en cours, ou **Random Event** pour ajouter une surprise plausible). L'agent peut aussi entretenir un arc narratif caché et facultatif, le **Secret Plot**. Pour la marche à suivre complète, voir [Narrative Director et Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Parcourt les lorebooks que tu sélectionnes, ainsi que les fichiers que tu téléverses, avant la réponse. Il résume les passages utiles et ajoute ce résumé au prompt. Un lorebook est un recueil de faits sur ton univers et tes personnages. Il s'agit d'une recherche légère, qui ne réclame donc aucune base de données séparée.

- **Phase** : **Pre-Generation**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : l'interrupteur **Use chat-active lorebooks**, le sélecteur **Fixed Source Lorebooks** et le téléversement de fichiers dans les formats pris en charge. N'utilise pas cet agent en même temps que Knowledge Router : leurs rôles se chevauchent. Pour la configuration, voir [Sources de connaissances](knowledge-sources.md).

### Knowledge Router

Une alternative moins coûteuse à Knowledge Retrieval. Au lieu de résumer, il lit les courtes descriptions des entrées de tes lorebooks. Il ajoute ensuite les entrées correspondantes, mot pour mot. Il donne le meilleur résultat quand les entrées sont bien décrites.

- **Phase** : **Pre-Generation**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : l'interrupteur **Use chat-active lorebooks** et le sélecteur **Fixed Source Lorebooks**. Un badge de couverture indique le pourcentage d'entrées sources dotées d'une description. Pour la configuration, voir [Sources de connaissances](knowledge-sources.md).

## Tracker Agents

Les Tracker Agents tiennent à jour un relevé de la scène, des personnages et de tes caractéristiques. Tu peux ajouter leur dernier résultat au prompt sous forme de section, pour que le modèle reste cohérent. World State, Quest Tracker, Character Tracker, Persona Stats, Custom Tracker, Inventory Tracker et Beholder ont **Add as Prompt Section** activé par défaut. Expression Engine et Background font exception.

### World State

Suit la date, l'heure, la météo, le lieu et les personnages présents. La scène reste ainsi ancrée et le modèle n'oublie pas où et quand l'histoire se déroule.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (ajouter comme section du prompt), activé par défaut.

### Expression Engine

Lit l'émotion de la dernière réponse et choisit le sprite ou l'expression qui lui correspond pour le personnage. Un sprite est une image du personnage affichée dans la scène. Pratique pour un personnage debout dont l'illustration change avec l'humeur.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : le réglage **Sprite Source** (**Expressions**, **Full-body** ou les deux), l'interrupteur **Expression Avatars**, le sélecteur **Sprite Owners**, et les curseurs de taille et d'opacité. Voir [Sprites de personnage](../characters/sprites.md).

### Quest Tracker

Gère les objectifs de quête, leur achèvement et leurs récompenses. Utile pour un jeu d'aventure où tu veux une liste de tâches visible.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut).

### Background

Choisit, parmi les arrière-plans que tu as téléversés, l'image d'arrière-plan qui correspond le mieux à la scène en cours. Il ne génère pas d'images : pour une génération automatique d'arrière-plan de scène, utilise Illustrator.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : la connexion de l'agent et les contrôles de contexte habituels. Le choix de l'arrière-plan se limite aux images déjà présentes dans ta bibliothèque d'arrière-plans.

### Character Tracker

Suit les personnages présents, ainsi que leur humeur, leurs actions, leur apparence, leur tenue, leurs pensées et leurs caractéristiques individuelles comme les PV. Il peut aussi créer des portraits pour les nouveaux personnages qui n'en ont pas.

Quand un personnage récurrent revient après avoir quitté la scène, Character Tracker réutilise ses dernières caractéristiques enregistrées et ses champs personnalisés, par souci de continuité. Les personnages adossés à une fiche reçoivent en plus leurs jauges et attributs RPG configurés comme point d'ancrage, et conservent toujours l'avatar et le cadrage de la fiche. La génération automatique de portraits reste réservée aux PNJ, les personnages non-joueurs, qui n'ont pas de fiche de personnage correspondante.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut) et le réglage facultatif **Auto-Generate NPC Avatars**, avec son propre sélecteur de connexion image.

### Beholder

Suit les vêtements actuels de chaque personnage, par zone du corps, ainsi que les objets tenus, les blessures, les parties du corps manquantes, les zones explicitement nues et les espèces non humaines. Son dernier instantané validé apparaît dans le tiroir Chat Settings de Beholder en Roleplay et alimente à la fois le prochain suivi de Beholder et la prochaine réponse Roleplay principale.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay uniquement.
- **Réglages clés** : ajoute-le ou retire-le sous **Chat Settings → Agents → Tracker Agents** ; ouvre **Configure Beholder** au même endroit pour choisir sa connexion, son modèle, son prompt, son contexte et ses limites de sortie. **Add as Prompt Section** est activé par défaut.
- **Modèle recommandé** : utilise un modèle SOTA comme OpenAI GPT-5.5+, Claude Opus 4.8+ ou Kimi K3+ pour un suivi fiable de l'état complet.
- **Origine** : adapté à l'environnement Agent natif d'Engine à partir de [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), sous licence AGPL-3.0-only. Le package officiel ne charge ni le DOM, ni le polling, ni l'environnement de stockage local de l'ancienne extension.

### Persona Stats

Suit les barres d'état de ton propre personnage, comme Satiety, Energy et Hygiene, plus toutes les barres personnalisées que tu ajoutes. Utile pour du survival ou de la simulation de vie.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut). Voir [Couleurs et caractéristiques des personnages](../characters/colors-and-stats.md).

### Custom Tracker

Suit les champs que tu définis toi-même : monnaies, compteurs, indicateurs. Utile quand les trackers intégrés ne couvrent pas un besoin de ton histoire.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut).

### Inventory Tracker

Suit l'argent, l'équipement porté et les objets transportés dans trois listes structurées, sans réutiliser l'inventaire de Persona Stats ni condenser les données dans des chaînes de Custom Tracker. Les noms en double sont fusionnés, les quantités de un restent visuellement compactes et les lignes verrouillées survivent sans modification aux passages suivants du tracker.

- **Phase** : Post-Processing (post-traitement).
- **Modes compatibles** : Roleplay.
- **Réglages principaux** : **Add as Prompt Section** (activé par défaut). Le HUD et le Tracker Panel permettent de modifier et de verrouiller chaque nom et chaque quantité.

### Memory Nag

Conserve un petit coffre de souvenirs modifiable pour chaque chat Roleplay. Il analyse la conversation par lots avec points de reprise, classe les souvenirs selon les personnages actuels et passés, puis déplace les souvenirs clairement réglés vers une liste Resolved restaurable. Un souvenir peut conserver mot pour mot une courte réplique lorsque sa formulation exacte compte.

Après chaque réponse, une correspondance déterministe des mots ne fournit au tracker que les souvenirs actifs les plus pertinents pour les personnages concernés. Le tracker décide alors si la situation justifie vraiment un rappel et ne peut choisir que parmi ces souvenirs ; il ne peut pas en inventer un pendant le rappel.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay uniquement.
- **Réglages clés** : une **Vault scan connection** distincte (par défaut, la connexion de l’Agent), **Messages per batch** (20), **Maximum memories created per character** (10), **Maximum memories considered per character** (5) et **Maximum memories injected** (3). Utilise **Scan chat** pour l’analyse initiale et **Open vault** pour rechercher, filtrer, ajouter, modifier, résoudre, restaurer ou supprimer des souvenirs.
- **Placement dans le prompt** : sans marqueur de preset, les souvenirs choisis entrent dans la réponse suivante au sein de `<context><memory_nags>…</memory_nags></context>`. Ajoute une section Agent Memory Nag pour les placer explicitement.
- **Cycle de vie des données** : le coffre appartient à un seul chat et reste enregistré si le package est désactivé ou désinstallé ; une réinstallation peut donc reprendre au dernier point de contrôle. La suppression d’un souvenir est définitive et demande toujours confirmation.

### World Maps

Ajoute à une histoire des lieux imbriqués persistants et des relations spatiales. Tu peux créer des régions, des zones, des salles et des connexions, te déplacer d'un lieu à l'autre, et laisser la position actuelle enrichir la génération d'un contexte spatial. Game Mode gagne en plus la vue carte du monde fournie par le package.

- **Intégration** : package de fonctionnalité ; il apporte une interface de carte et du contexte d'exécution au chat, au lieu de s'exécuter comme un agent classique lié à une phase de génération.
- **Où ça marche** : Roleplay et Game.
- **Réglages clés** : active-le pour le chat Roleplay depuis **Chat Settings → Agents**, ou sélectionne-le pendant la création de la partie et gère-le ensuite depuis les réglages de cette partie. L'installer ou le retirer demande un redémarrage de Marinara.
- **Guide complet** : [World Maps : installation, création et déplacements](hierarchical-maps.md).

## Misc Agents

Les Misc Agents ajoutent des extras : images, musique, réactions du public, mises à jour de fiches.

### Echo Chamber

Simule un public en direct qui réagit à ta scène, sous la forme d'un widget **Echo** flottant dans la zone de chat. Il dévoile une nouvelle réaction toutes les 30 secondes.

- **Phase** : **Parallel**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : tu choisis un style parmi les options proposées, par exemple **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** et **Harbingers**. Le widget propose notamment les commandes **Re-run Echo Chamber** et **Clear messages**.

### Noodle

Ajoute un monde social local facultatif avec le fil public Noodle et le fil de jeu de rôle entre créateurs et fans NoodleR. Il s'ouvre dans un onglet Home dédié au lieu de passer par le pipeline habituel des agents de chat.

- **Intégration** : pack de fonctionnalités ; il apporte l'onglet Home, les routes locales, les flux de génération et de médias, ainsi que les planificateurs en arrière-plan.
- **Modes compatibles** : Home, avec du contexte facultatif provenant des chats Conversation, Roleplay et Game.
- **Réglages principaux** : installe-le depuis **Agents → Download Agents**, puis redémarre Marinara Engine lorsqu'on te le demande. Dans Noodle, tu peux configurer les comptes invités, les connexions de texte et d'image, les actualisations du fil, les profils Creator NoodleR, l'accès aux publications simulées et l'activité du public.
- **Cycle de vie des données** : la désinstallation retire l'onglet Home et arrête les routes et planificateurs du pack après redémarrage, tout en conservant les données Noodle et NoodleR existantes pour une réinstallation ultérieure.
- **Guide complet** : [Noodle : le fil social intégré](../noodle/overview.md).

### Long-Term Memory

Extrait des souvenirs durables depuis les résumés de chat, les fiches de personnages et les lorebooks, vers un coffre appartenant au package, puis rappelle le contexte pertinent avant la réponse principale. Il gère la consultation du coffre par périmètre, l'import de sources, la relecture des brouillons en attente et le placement du contexte rappelé sur un marqueur de preset.

- **Intégration** : package de fonctionnalité ; il apporte du contexte avant la génération et une interface de gestion de la mémoire, au lieu de s'exécuter comme un tracker classique après la génération.
- **Où ça marche** : Conversation, Roleplay et Game.
- **Réglages clés** : activation, budget de tokens du rappel (128-16 384), nombre maximum de fragments rappelés (1-100), seuil de score, contexte des messages récents (1-20), style de rappel et pondérations sémantique, lexicale, graphe et mots-clés, inclusion des souvenirs résolus, préambule de rappel, raisonnement et verbosité de l'extraction, limites de génération, limites de sources, modèles de prompt, extraction de mots-clés par l'IA, et extraction en Game Mode.
- **Cycle de vie des données** : les contrôles de sauvegarde de Memory Settings servent à exporter ou remplacer le coffre, les brouillons et les réglages. La suppression de toutes les données efface définitivement les souvenirs, les brouillons, l'activité et les index dérivés, mais conserve les réglages. Désinstaller le package préserve le coffre Long-Term Memory en vue d'une réinstallation. L'installer, le mettre à jour ou le retirer demande un redémarrage de Marinara.
- **Compatibilité** : moteur `2.3.5` jusqu'à, mais sans inclure, `4.0.0`. Le package utilise les permissions `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage` et `ui`.

### Illustrator

Prend en charge la génération d'images et de vidéos. Il rédige des prompts visuels pour les moments importants, puis les envoie au fournisseur média configuré.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : par défaut, il s'exécute une fois tous les 5 messages, les tiens et ceux de l'IA. Les réglages comprennent **Prompt Model**, **Image Style**, **Attach Card Appearance** et **Send Avatar References**. Pour la configuration complète, voir [Agent Illustrator](../media/illustrator-agent.md).

### Lorebook Keeper

Crée et met à jour des entrées de lorebook à partir des faits importants de ton chat : tes notes d'univers s'étoffent au fil du jeu.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay. En Game Mode, une variante de fin de session, **Game Session Keeper**, fait le même travail à la fin d'une session.
- **Réglages clés** : par défaut, il s'exécute une fois tous les 8 messages, les tiens et ceux de l'IA. Le sélecteur **Target Lorebook** détermine la destination des entrées, avec une option de sélection automatique. Les configurations de prompt avancées peuvent renvoyer le nom exact d'un lorebook modifiable ou un alias configuré comme `world`, `npc`, `scene` ou `player` ; si la destination d'un alias n'existe pas, elle est créée et associée automatiquement au chat actuel. Sans destination, le comportement existant avec un seul lorebook est conservé.

### Combat

Gère le combat, y compris l'initiative, les PV et l'ordre des tours. Quand il est actif, un bouton **Encounter** apparaît au-dessus de la zone de saisie.

- **Phase** : **Parallel**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : il est livré avec un outil de jet de dés pour résoudre les tours.

### Immersive HTML

Ajoute à la dernière réponse des éléments visuels issus de l'univers, par exemple une note ou un écran mis en forme, sans toucher à l'histoire.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay uniquement.
- **Réglages clés** : l'interrupteur **Hold Message Until Rewrite**.

### Music DJ

Lit l'ambiance de la scène et joue une musique assortie. Il peut passer par Spotify, YouTube ou des fichiers audio locaux.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay et Game.
- **Réglages clés** : le réglage **Music Player** choisit le fournisseur, et chaque fournisseur demande sa propre configuration. Pour la marche à suivre complète avec Spotify, YouTube et la musique locale, voir [Music DJ](../media/music.md).

### Haptic Feedback

Lit la narration et pilote en temps réel les jouets intimes connectés, via Intiface Central. Intiface Central doit déjà tourner avec un jouet connecté avant que tu actives cet agent.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Conversation, Roleplay et Game.
- **Réglages clés** : le choix **Touch Sensitivity** (**Subtle**, **Standard** ou **Intense**) et le champ **Intiface URL**. La sensibilité guide les choix de l'agent sans limiter la plage d'intensité `0.0-1.0` disponible. Pour la configuration complète, voir [Configurer Haptic Feedback](../integrations/haptic-feedback.md).

### CYOA Choices

Ajoute après chaque réponse des boutons de choix cliquables "What will you do?", pour une ambiance de livre dont tu es le héros (CYOA). Chaque bouton contient une action complète que tu envoies d'un clic.

- **Phase** : **Post-Processing**.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Edit** pour réécrire les choix et **Re-roll** pour en générer de nouveaux.

### Storyboard

Prépare des storyboards visuels, fixes ou animés, à partir des échanges Roleplay terminés et de la narration en Game Mode. La planification et la mise en forme adaptée au fournisseur sont séparées : la chronologie de la source, l'identité des personnages et le style visuel choisi restent intacts sur les images-clés et les vidéos générées.

- **Intégration** : package d'agent ; Game et Roleplay utilisent les modèles de prompt et les réglages du package installé, via l'intégration hôte Storyboard du moteur.
- **Où ça marche** : Roleplay et Game.
- **Réglages clés** : choisis les planificateurs image fixe ou animation, les connexions image et vidéo, le nombre d'images-clés, la durée, le mode d'affichage, la gestion des références de personnage, les modèles d'épisode et de style pour Roleplay, et les modèles d'illustration et de vidéo pour Game.
- **Compatibilité** : moteur `2.3.5` jusqu'à, mais sans inclure, `3.0.0`. Le package utilise les permissions `agent-runtime`, `chat-read`, `prompt-context`, `storage` et `ui`, et ne demande aucun redémarrage.
- **Guide complet** : [Agent Storyboard : Roleplay et Game Mode](../game/storyboard.md).

### Calls

Ajoute des appels audio et vidéo en direct avec les personnages de Conversation : appels que tu lances, appels entrants, transcriptions propres à l'appel, Text to Speech (synthèse vocale), entrée micro et clips vidéo de personnage.

- **Intégration** : package de fonctionnalité pour Conversation ; il ajoute des contrôles dans la barre d'outils, dans la surface de chat et dans **Chat Settings**, au lieu de s'exécuter comme un agent classique lié à une phase de génération.
- **Où ça marche** : Conversation.
- **Réglages clés** : ouvre **Chat Settings → Agents → Calls** pour activer les appels et régler la voix, le micro, la sonnerie et la vidéo. Voir [Appels audio et vidéo en Conversation](../conversation/calls.md). L'installer ou le retirer demande un redémarrage de Marinara.

### UNO

Ajoute une table de UNO avec application des règles, pour toi et les personnages de Conversation, avec des règles maison configurables et de deux à dix joueurs au total.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/uno` ; la configuration fixe les joueurs et les règles maison. L'installer ou le retirer demande un redémarrage de Marinara.

### Chess

Ajoute un échiquier en tête-à-tête avec application des coups légaux, détection de l'échec et de l'échec et mat, pièces capturées, et tours de l'adversaire joués dans son personnage.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/chess`, puis choisis l'adversaire et la couleur que tu joues. L'installer ou le retirer demande un redémarrage de Marinara.

### Poker

Ajoute une table de Texas Hold'em de deux à huit joueurs au total, avec blinds, tours d'enchères, pots secondaires, évaluation à l'abattage et adversaires joués dans leur personnage.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/poker`, puis choisis les joueurs, les jetons de départ et la valeur des blinds. L'installer ou le retirer demande un redémarrage de Marinara.

### 8-Ball Pool

Ajoute une table de billard en tête-à-tête avec billes pleines et rayées, visée et puissance de tir, fautes, bille en main, et tirs de l'adversaire joués dans son personnage.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/8ball`, puis choisis l'adversaire. L'installer ou le retirer demande un redémarrage de Marinara.

### Tic-Tac-Toe

Ajoute une grille de morpion en tête-à-tête avec symboles au choix ou aléatoires, gestion des tours légaux, et détection de la victoire et du match nul.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/tictactoe` (alias `/ttt`), puis choisis l'adversaire et ton symbole. L'installer ou le retirer demande un redémarrage de Marinara.

### Rock-Paper-Scissors

Ajoute un pierre-feuille-ciseaux en tête-à-tête où les deux choix restent cachés jusqu'à la révélation.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/rps`, puis choisis l'adversaire et un match au meilleur des trois, cinq ou sept manches. L'installer ou le retirer demande un redémarrage de Marinara.

## Guides associés

- [Agents : des aides IA pour tes chats](agents-overview.md)
- [Agent Illustrator](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Configurer Haptic Feedback](../integrations/haptic-feedback.md)
- [Sources de connaissances](knowledge-sources.md)
- [Narrative Director et Secret Plot](../roleplay/narrative-director.md)
- [Appels audio et vidéo en Conversation](../conversation/calls.md)
- [Jeux de table en Conversation](../conversation/table-games.md)
