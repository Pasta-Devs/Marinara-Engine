# Référence des agents téléchargeables

Ce guide présente, par groupe, les agents officiels de Marinara proposés dans **Agents → Agent Organizer** (Agents → organisateur d'agents). Une installation neuve ne contient aucun agent. Leurs sources et leur catalogue sont publics dans [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Chaque entrée indique ce que fait l'agent, quand il s'exécute, où il fonctionne et ses principaux réglages. Pour installer et activer des agents, commence par lire la [vue d'ensemble des agents](agents-overview.md). Les entrées marquées **staging only** (staging uniquement) sont accessibles aux utilisateurs d'Engine sur staging ; les utilisateurs du canal stable les voient une fois le package promu.

## Comment lire cette référence

Installe un agent depuis **Agent Organizer**, puis ajoute-le à chaque chat où tu le veux. Les agents se configurent chat par chat, et non fiche de personnage par fiche de personnage. La [vue d'ensemble des agents](agents-overview.md) couvre l'installation, la mise à jour, la configuration par chat et le coût.

Chaque entrée donne les mêmes repères rapides.

- **Phase** ou **Intégration** : le moment où s'exécute un agent de pipeline. **Pre-Generation** (avant la génération) s'exécute avant la réponse et peut ajouter du texte au prompt, c'est-à-dire au texte que Marinara envoie à l'IA. **Parallel** (en parallèle) s'exécute en même temps que la réponse et ne voit pas le texte terminé. **Post-Processing** (après la génération) s'exécute après la réponse et peut la lire. Certains peuvent la réécrire. Les packages de fonctionnalité comme World Maps, Calls et les jeux de Conversation s'intègrent plutôt à leur écran de chat. Les Apps s'ouvrent dans leur propre onglet **Home** (accueil).
- **Où ça marche** : les modes de chat qui acceptent l'agent. La plupart des agents fonctionnent en Roleplay.
- **Réglages clés** : les réglages que tu risques le plus de modifier, dans la carte de l'agent, dans **Chat Settings** (réglages du chat).

Avec un intervalle d'exécution, un agent s'exécute une fois tous les quelques messages, les tiens et ceux de l'IA, au lieu de s'exécuter après chaque message. Tu peux le régler jusqu'à 100.

En Roleplay, l'intervalle d'exécution d'Illustrator se règle chat par chat, dans sa carte de **Chat Settings**. La valeur de sa configuration sert de valeur par défaut aux chats qui n'ont pas la leur. Illustrator accepte aussi **0** : il ne s'exécute alors jamais automatiquement et reste disponible pour les actions de Gallery.

## Apps

Les Apps ont leur propre onglet dans **Home**. Tu les utilises de façon autonome au lieu de les ajouter à un chat. Chacune demande un redémarrage après son installation.

### Noodle

Ajoute le fil public local et facultatif de Noodle, dans son propre onglet **Home**. Noodle ne s'exécute pas dans le pipeline des agents de chat.

- **Intégration** : package de fonctionnalité, avec des routes locales, des flux de génération et de médias, et des planificateurs en arrière-plan.
- **Où ça marche** : Home, avec du contexte facultatif provenant des chats Conversation, Roleplay et Game.
- **Réglages clés** : installe-le depuis **Agents → Agent Organizer** et redémarre lorsque cela t'est demandé. Dans Noodle, tu définis les comptes invités, les connexions de texte et d'image, les actualisations du fil, les utilisateurs aléatoires et la reprise vers les chats.
- **Données** : la désinstallation retire l'onglet et arrête les planificateurs après un redémarrage. Tes données Noodle sont conservées pour une réinstallation ultérieure.
- **Guide complet** : [Noodle : la timeline sociale intégrée](noodle.md).

### Slurp

Une application sociale privée pour tes personnages. Transforme tes personnages et tes personas en Creators, publie des photos publiques ou verrouillées, et regarde un public simulé suivre, s'abonner, acheter, commenter et envoyer des messages. Par défaut, elle est réglée pour du contenu adulte. Tout cela n'est qu'un jeu : les prix sont fictifs et aucun paiement réel n'a lieu.

- **Intégration** : App dans son propre onglet **Slurp**, dans **Home**.
- **Où ça marche** : Home.
- **Réglages clés** : installe-la, redémarre lorsque cela t'est demandé, puis ouvre **Home → Slurp**. Pour que les personnages d'un chat se souviennent des posts et messages Slurp récents, active **Include Slurp activity** (inclure l'activité Slurp) dans les **Chat Settings** de ce chat, sous **Connected Chats** (chats connectés). La reprise vers les chats doit aussi être activée pour ce mode de chat dans les réglages de Slurp. **Slurp Settings → Autopurge** (réglages de Slurp → purge automatique) supprime les anciens médias Slurp pour libérer de la place. Ce réglage est désactivé par défaut.
- **Anciens noms** : les anciens catalogues l'affichent sous le nom **Slurp Remastered**, à côté du package retiré **Slurp Legacy**, qui ne reçoit plus de mises à jour.
- **Guide complet** : [guide du package Slurp](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/slurp2/README.md).

### Gacha Forge

Un jeu gacha construit à partir d'un monde que tu décris : des bannières sur lesquelles faire des tirages, une distribution de personnages que le modèle écrit et dessine, des chapitres d'histoire racontés par un narrateur façon visual novel, ainsi que des combats, de l'équipement et des événements. Tes lorebooks peuvent alimenter le monde, mais un scénario écrit à la main suffit.

- **Intégration** : App dans son propre onglet **Gacha Forge**, dans **Home**.
- **Où ça marche** : Home.
- **Réglages clés** : installe-le, redémarre lorsque cela t'est demandé, puis ouvre **Home → Gacha Forge**. La désinstallation retire l'onglet après un redémarrage.
- **Guide complet** : [guide du package Gacha Forge](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/gacha-forge/README.md).

### Modern Life Sim

Une simulation de vie. Tu vis dans une petite ville au rythme de l'horloge, avec un emploi à garder, des factures à payer, et ton énergie et ta faim à surveiller. Les gens qui t'entourent viennent de tes fiches de personnage, et un narrateur façon visual novel raconte les scènes qui comptent.

- **Intégration** : App dans son propre onglet **Life Sim**, dans **Home**.
- **Où ça marche** : Home.
- **Disponibilité** : **Staging only**, avec Engine **2.4.4+** (avant 4.0.0). C'est une version alpha. Si une mise à jour modifie un élément dont dépend une ancienne sauvegarde, Life Sim te prévient à l'ouverture de cette sauvegarde. Tu peux commencer une nouvelle vie ou continuer à tes risques et périls.
- **Réglages clés** : installe-la, redémarre lorsque cela t'est demandé, puis ouvre **Home → Life Sim**. Elle a besoin d'une connexion de texte. Une connexion d'images est facultative : sans elle, les lieux affichent des cartes illustrées. Les modules facultatifs restent désactivés tant que tu ne les actives pas pour une vie. Le module **Adult** (adulte) te demande de confirmer que tu es majeur.
- **Guide complet** : [guide du package Modern Life Sim](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/modern-life-sim/README.md).

### Story Writer

Un livre que tu écris avec le modèle. Prépare l'histoire, les personnages et les lorebooks dans une barre latérale, laisse tes consignes d'auteur sur une note adhésive, et le modèle écrit le chapitre suivant quand tu le demandes. Tu peux cliquer n'importe où dans le texte pour le modifier, ou écrire toi-même le premier chapitre.

- **Intégration** : App dans son propre onglet **Story Writer**, dans **Home**.
- **Où ça marche** : Home.
- **Disponibilité** : nécessite une version de Marinara Engine plus récente que **v2.5.1** (la prochaine version ou une build staging actuelle).
- **Réglages clés** : installe-le, redémarre lorsque cela t'est demandé, puis ouvre **Home → Story Writer** et choisis une connexion de texte dans sa barre latérale. Les histoires sont enregistrées sur ton serveur Marinara. Tu peux en commencer de nouvelles, reprendre les anciennes et les télécharger en Markdown ou en texte brut.
- **Guide complet** : [guide du package Story Writer](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/story-writer/README.md).

## Writer Agents

Les Writer Agents façonnent l'histoire ou le style. Ils ajoutent des consignes avant la réponse ou nettoient la réponse après coup.

### Prose Guardian

Réécrit la dernière réponse pour supprimer les mots bannis et les répétitions sans en changer le sens. Utilise-le pour empêcher un modèle de répéter les mêmes tournures ou d'abuser d'un mot.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : les champs de texte **Banned Words** (mots bannis, `ozone` par défaut), **Prefer In Writing** (à privilégier dans l'écriture) et **Remove From Writing** (à retirer de l'écriture). **Hold Message Until Rewrite** (retenir le message jusqu'à la réécriture), activé par défaut, masque la réponse jusqu'à la fin du nettoyage. Sans ce réglage, la réponse brute s'affiche d'abord, puis elle est remplacée.

### Continuity Checker

Corrige les erreurs de logique concrètes de la dernière réponse, comme un personnage à deux endroits en même temps ou une chronologie incohérente. Quand il repère des problèmes, il affiche une liste à cocher pour que tu choisisses les corrections à appliquer.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : l'interrupteur **Hold Message Until Rewrite**.

### Card Evolution Auditor

Observe l'évolution d'un personnage au fil du jeu et propose des modifications de sa fiche de personnage. Il ne modifie jamais rien automatiquement. Chaque suggestion ouvre la fenêtre **Review Character Card Updates** (relire les mises à jour de la fiche), où tu approuves ou refuses.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : par défaut, il s'exécute une fois tous les 8 messages, les tiens et ceux de l'IA. Voir [Approbations d'agents et Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Crée un coup de pouce ponctuel pour l'histoire quand tu le demandes. Quand cet agent est actif dans un chat Roleplay, un bouton **Push Story** (faire avancer l'histoire) apparaît. Clique dessus pour armer la prochaine réponse, qui fait alors avancer l'intrigue ou ajoute une surprise.

- **Phase** : Pre-Generation.
- **Où ça marche** : Roleplay uniquement.
- **Réglages clés** : le réglage **Story Push Mode** (**Natural** fait avancer les fils en cours, **Random Event** ajoute une surprise plausible). L'agent peut aussi entretenir un arc narratif caché à long terme, le **Secret Plot**. Voir [Narrative Director et Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Parcourt les lorebooks que tu choisis, ainsi que les fichiers que tu téléverses, avant la réponse. Il résume les passages utiles et ajoute ce résumé au prompt. Un lorebook est un recueil de faits sur ton univers. Il s'agit d'une recherche légère, qui ne demande aucune base de données séparée.

- **Phase** : Pre-Generation.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Use chat-active lorebooks** (utiliser les lorebooks actifs du chat), un sélecteur **Fixed Source Lorebooks** (lorebooks sources fixes) et le téléversement de fichiers. Ne l'utilise pas en même temps que Knowledge Router : leurs rôles se chevauchent. Voir [Sources de connaissances](knowledge-sources.md).

### Knowledge Router

Une alternative moins coûteuse à Knowledge Retrieval. Il lit les courtes descriptions des entrées de tes lorebooks et ajoute mot pour mot les entrées correspondantes. Il donne le meilleur résultat quand les entrées sont bien décrites.

- **Phase** : Pre-Generation.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Use chat-active lorebooks** et un sélecteur **Fixed Source Lorebooks**. Un badge de couverture indique le pourcentage d'entrées sources dotées d'une description. Voir [Sources de connaissances](knowledge-sources.md).

## Tracker Agents

Les Tracker Agents tiennent à jour un relevé de la scène, des personnages et de tes caractéristiques. **Add as Prompt Section** (ajouter comme section du prompt) ajoute le dernier résultat d'un agent au prompt, pour que le modèle reste cohérent. Ce réglage est activé par défaut pour tous les trackers, sauf Expression Engine et Background.

### World State

Suit la date, l'heure, la météo, le lieu et les personnages présents. La scène reste ainsi ancrée et le modèle n'oublie pas où et quand l'histoire se déroule.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut).

### Expression Engine

Lit l'émotion de la dernière réponse et choisit le sprite ou l'expression qui lui correspond pour le personnage. Un sprite est une image du personnage affichée dans la scène. Utilise-le pour une illustration de personnage en pied qui change avec l'humeur.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : le réglage **Sprite Source** (**Expressions**, **Full-body** ou les deux), l'interrupteur **Expression Avatars** (avatars d'expression), le sélecteur **Sprite Owners** (propriétaires des sprites), et les curseurs de taille et d'opacité. Voir [Sprites de personnage](../characters/sprites.md).

### Quest Tracker

Gère les objectifs de quête, leur achèvement et leurs récompenses. Utilise-le pour un jeu d'aventure où tu veux une liste de tâches visible.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut).

### Background

Choisit, parmi les arrière-plans que tu as téléversés, le meilleur arrière-plan pour la scène en cours. Il ne génère pas d'images. Utilise Illustrator pour des arrière-plans de scène générés.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : la connexion de l'agent et les contrôles de contexte habituels. Il choisit uniquement parmi les images déjà présentes dans ta bibliothèque d'arrière-plans.

### Character Tracker

Suit les personnages présents, avec leur humeur, leurs actions, leur apparence, leur tenue, leurs pensées et leurs caractéristiques individuelles comme les PV. Il peut aussi créer des portraits pour les nouveaux personnages qui n'en ont pas.

Une fiche qui décrit plusieurs personnes, par exemple une fiche de scénario avec une distribution, peut être suivie personne par personne. Marque chaque personne dans le texte de la fiche avec un en-tête `[CHARACTER: Name]` ou un champ `Name:`. Chaque membre garde son propre nom, son humeur, sa tenue, ses pensées et son portrait. Les membres ne partagent pas le portrait de la fiche. Une ancienne entrée portant le nom de la fiche reste jusqu'à ce que le tracker signale un membre individuel pour la remplacer. Les personnages ajoutés manuellement gardent leur identité manuelle.

Quand un personnage revient après avoir quitté la scène, le tracker reprend ses dernières caractéristiques et ses champs personnalisés enregistrés. Les personnages associés à une fiche reçoivent aussi leurs réserves et attributs RPG configurés. Dans un groupe Roleplay en mode Merged, les personnages présents peuvent aussi déterminer quelles fiches de personnage sont actives pour la prochaine réponse. Voir [Automate active characters](../chats/group-chats.md#automate-active-characters-merged-only).

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut) et le réglage facultatif **Auto-Generate NPC Avatars** (générer automatiquement les avatars des PNJ), avec son propre sélecteur de connexion d'images. **Include the outfit in portraits** (inclure la tenue dans les portraits) est activé par défaut. Désactive-le pour dessiner les portraits à partir de l'apparence seule.

### Beholder

Suit les vêtements de chaque personnage par zone du corps, ainsi que les objets tenus, les blessures, les parties du corps manquantes, les zones explicitement nues et les espèces non humaines. Son dernier instantané validé apparaît dans le tiroir de Beholder, dans les **Chat Settings** de Roleplay. Il est transmis au prochain appel de suivi de Beholder et à la prochaine réponse principale.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay uniquement.
- **Réglages clés** : ajoute-le sous **Chat Settings → Agents → Tracker Agents** (réglages du chat → Agents → agents de suivi), puis ouvre **Configure Beholder** (configurer Beholder) pour choisir sa connexion, son modèle, son prompt, son contexte et ses limites de sortie. **Add as Prompt Section** est activé par défaut.
- **Modèle de prompt** : choisis le modèle de prompt qui correspond au modèle derrière la connexion de Beholder. Marinara ne peut pas détecter le modèle : ce choix reste donc manuel. Un mauvais choix n'est pas fatal, mais donne de moins bons résultats.
  - **SOTA model — one prompt** (modèle SOTA – un prompt, par défaut) : un seul appel qui couvre tous les champs suivis. Utilise un modèle général puissant.
  - **Beholder local model — five passes** (modèle local Beholder – cinq passes) : cinq appels ciblés, un par catégorie suivie, pour l'extracteur [Beholder](https://huggingface.co/GetBeholder/Beholder-GGUF), entraîné spécialement pour cette tâche et exécuté sur ton ordinateur (par exemple `Beholder-Q8_0.gguf` derrière koboldcpp ou llama.cpp). Ce modèle répond à une catégorie à la fois : avec le modèle de prompt unique, il renvoie donc un état partiel. Il fonctionne hors ligne et sans frais.
- **Origine** : adapté de [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), sous licence AGPL-3.0-only. Le package officiel ne charge ni le DOM, ni le polling, ni l'environnement de stockage local de l'ancienne extension.

### Persona Stats

Suit les barres d'état de ton propre personnage, comme Satiety, Energy et Hygiene, plus toutes les barres personnalisées que tu ajoutes. Utilise-le pour une partie de survie ou de simulation de vie.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut). Voir [Couleurs et caractéristiques des personnages](../characters/colors-and-stats.md).

### Custom Tracker

Suit des champs que tu définis toi-même, comme des monnaies, des compteurs ou des indicateurs. Utilise-le quand les trackers intégrés ne couvrent pas un besoin de ton histoire.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut).

### Inventory Tracker

Suit l'argent, l'équipement porté et les objets transportés sous forme de trois listes structurées. Les noms en double sont fusionnés, et les lignes verrouillées restent inchangées lors des passages suivants du tracker.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Add as Prompt Section** (activé par défaut). Le HUD et le Tracker Panel permettent de modifier et de verrouiller chaque nom et chaque quantité.

### Quartermaster

Gère l'inventaire du persona actif, ses emplacements d'équipement, les quantités et les lieux de stockage des objets, ainsi que les tenues enregistrées. Il lit l'histoire après les réponses et applique les changements d'objets. Un panneau flottant et le Tracker Panel permettent de modifier le même inventaire à la main. Les illustrations des objets et des tenues sont facultatives.

- **Phase** : Post-Processing, avec le contexte de l'inventaire transmis aux réponses suivantes.
- **Où ça marche** : Roleplay. Il suit le persona actif, pas les membres de l'équipe ni les PNJ.
- **Disponibilité** : nécessite Engine **2.4.6+**.
- **Installation** : installe-le et redémarre lorsque cela t'est demandé. Dans chaque chat Roleplay, active les agents dans **Chat Settings → Agents**, ajoute Quartermaster sous **Tracker Agents** et choisis sa connexion au modèle. Ouvre le panneau flottant avec le bouton de lancement situé au-dessus du Tracker Panel.
- **Contrôles clés** : équiper et ranger des objets, enregistrer des tenues, restaurer l'inventaire ou annuler les derniers changements du tracker, et exporter ou importer la configuration d'un chat. La génération d'images utilise sa propre connexion d'images. Consulte le [guide du package Quartermaster](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/quartermaster/README.md) avant d'activer la macro d'apparence ou le remplacement de l'avatar.

### Relationship Tracker

Tient à jour un réseau de relations modifiable pour les fiches de personnage d'un chat Roleplay de groupe, ainsi que la façon dont chaque personnage voit le persona actif. Les relations sont positives, neutres, négatives ou compliquées. Les verrouillages manuels protègent tes modifications contre les changements automatiques.

- **Phase** : Post-Processing, avec le contexte des relations transmis aux réponses suivantes.
- **Où ça marche** : chats Roleplay de groupe.
- **Disponibilité** : nécessite Engine **2.4.4+** (avant 4.0.0).
- **Installation** : installe-le et redémarre lorsque cela t'est demandé. Dans chaque chat Roleplay, active les agents dans **Chat Settings → Agents**, ajoute-le sous **Tracker Agents** et choisis sa connexion au modèle. Le réseau apparaît dans le Tracker Panel. Sélectionne-y une fois **All relationships** (toutes les relations) ou **Scene-only relationships** (relations de la scène uniquement) pour démarrer le chat.
- **Contrôles clés** : **All relationships** ou **Scene-only relationships** pour le contexte du prompt, **Update from History** (actualiser depuis l'historique) pour analyser les messages récents, la modification et le verrouillage manuels, et **Resume automatic updates** (reprendre les mises à jour automatiques). **Context Size** (taille du contexte, 5 messages par défaut), **Presence lookback** (historique de présence, 15 par défaut) et le nombre de messages analysés dans l'historique sont des réglages distincts. Consulte le [guide du package Relationship Tracker](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/relationship-tracker/README.md).

### Memory Nag

Conserve un petit coffre de souvenirs modifiable pour chaque chat Roleplay. Il analyse le chat par lots, classe les souvenirs selon les participants actuels et passés, et déplace les souvenirs réglés vers une liste Resolved restaurable. Un souvenir peut conserver mot pour mot une courte réplique lorsque la formulation exacte compte.

Après chaque réponse, une correspondance de mots ne transmet au tracker que les souvenirs actifs les plus pertinents. Le tracker décide si la scène justifie un rappel et ne peut choisir que parmi ces souvenirs. Il ne peut pas créer de nouveau souvenir pendant le rappel.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay uniquement.
- **Réglages clés** : **Vault scan connection** (connexion d'analyse du coffre, par défaut la connexion de l'agent), **Messages per batch** (messages par lot, 20), **Maximum memories created per character** (nombre maximal de souvenirs créés par personnage, 10), **Maximum memories considered per character** (nombre maximal de souvenirs examinés par personnage, 5) et **Maximum memories injected** (nombre maximal de souvenirs injectés, 3). Utilise **Scan chat** (analyser le chat) pour le premier remplissage et **Open vault** (ouvrir le coffre) pour rechercher, ajouter, modifier, résoudre, restaurer ou supprimer des souvenirs.
- **Placement dans le prompt** : sans marqueur de preset, les rappels choisis entrent dans la réponse suivante au sein de `<context><memory_nags>…</memory_nags></context>`. Ajoute une section Memory Nag Agent pour les placer toi-même.
- **Données** : le coffre appartient à un seul chat et reste enregistré si le package est désactivé ou désinstallé. La suppression d'un souvenir est définitive et demande toujours confirmation.

### World Maps

Ajoute à une histoire des lieux imbriqués et des liens spatiaux. Tu crées des régions, des zones, des salles et des connexions, tu te déplaces d'un lieu à l'autre, et la position actuelle ajoute du contexte spatial à la génération. Game Mode reçoit aussi une vue carte du monde.

- **Intégration** : package de fonctionnalité, avec une interface de carte et du contexte de chat, au lieu d'un agent lié à une phase de génération.
- **Où ça marche** : Roleplay et Game.
- **Réglages clés** : active-le pour un chat Roleplay dans **Chat Settings → Agents**, ou choisis-le à la création d'une partie et gère-le dans les réglages de cette partie. L'installer ou le retirer demande un redémarrage.
- **Guide complet** : [World Maps : installation, création et déplacements](hierarchical-maps.md).

## Misc Agents

Les Misc Agents ajoutent des extras comme des images, de la musique, des réactions du public et des mises à jour de fiches.

### Echo Chamber

Simule un public en direct qui réagit à ta scène, dans un widget **Echo** flottant dans la zone de chat. Il dévoile une nouvelle réaction toutes les 30 secondes.

- **Phase** : Parallel.
- **Où ça marche** : Roleplay.
- **Réglages clés** : choisis un style comme **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** ou **Harbingers**. Le widget propose **Re-run Echo Chamber** (relancer Echo Chamber) et **Clear messages** (effacer les messages).

### Long-Term Memory

Extrait des souvenirs durables des résumés de chat, des fiches de personnage et des lorebooks vers un coffre appartenant au package, puis rappelle le contexte pertinent avant la réponse principale. Il permet de parcourir le coffre, d'importer des sources, de relire les brouillons en attente et de placer le contexte sur un marqueur de preset.

- **Intégration** : package de fonctionnalité, avec du contexte avant la génération et une interface de gestion de la mémoire.
- **Où ça marche** : Conversation, Roleplay et Game.
- **Réglages clés** : budget de tokens du rappel (128-16 384), nombre maximal de fragments rappelés (1-100), seuil de score, contexte des messages récents (1-20), style de rappel, pondérations de recherche, inclusion des souvenirs résolus, préambule de rappel, réglages d'extraction, limites de sources, modèles de prompt, extraction de mots-clés par l'IA et extraction en Game Mode.
- **Données** : les contrôles de sauvegarde de Memory Settings servent à exporter ou remplacer le coffre, les brouillons et les réglages. **Delete all data** (supprimer toutes les données) efface définitivement les souvenirs, les brouillons, l'activité et les index, mais conserve les réglages. La désinstallation conserve le coffre pour une réinstallation ultérieure. L'installer, le mettre à jour ou le retirer demande un redémarrage.
- **Compatibilité** : Engine `2.3.5` jusqu'à `4.0.0` exclu. Permissions : `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage`, `ui`.

### Illustrator

Crée des images et des vidéos. Il rédige des prompts visuels pour les moments importants et les envoie à ton service d'images ou de vidéo.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : par défaut, Illustrator s'exécute une fois tous les 5 messages, les tiens et ceux de l'IA. Pour changer cela, règle **Image Run Interval** (intervalle des images) sur sa carte dans chaque chat Roleplay. Les clips automatiques utilisent **Video Run Interval** (intervalle des vidéos) lorsque **Illustrator makes** (ce que crée Illustrator) vaut **Pictures and clips** ou **Clips only**. Mets **Video Run Interval** à **0** pour désactiver les clips automatiques. Les réglages comprennent **Prompt Model** (modèle de rédaction du prompt), **Image Style** (style d'image), **Attach Card Appearance** (joindre l'apparence de la fiche) et **Send Avatar References** (envoyer les avatars en référence). Pour la configuration complète, voir [Agent Illustrator](../media/illustrator-agent.md).

### Lorebook Keeper

Crée et met à jour des entrées de lorebook à partir des faits importants de ton chat : tes notes d'univers s'étoffent au fil du jeu.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay. En Game Mode, une variante de fin de session, **Game Session Keeper**, fait le même travail.
- **Réglages clés** : par défaut, il s'exécute une fois tous les 8 messages, les tiens et ceux de l'IA. **Target Lorebook** (lorebook cible) détermine la destination des entrées, avec une option de sélection automatique. Les prompts avancés peuvent renvoyer le nom d'un lorebook accessible en écriture ou un alias comme `world`, `npc`, `scene` ou `player`. Les destinations d'alias manquantes sont créées et associées au chat. Sans destination, le comportement avec un seul lorebook est conservé.

### Combat

Gère le combat : l'initiative, les PV et l'ordre des tours. Quand il est actif, un bouton **Encounter** (rencontre) apparaît au-dessus de la zone de saisie.

- **Phase** : Parallel.
- **Où ça marche** : Roleplay.
- **Réglages clés** : il comprend un outil de jet de dés pour résoudre les tours.

### Immersive HTML

Ajoute à la dernière réponse des éléments visuels issus de l'univers, par exemple une note ou un écran mis en forme, sans toucher à l'histoire.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay uniquement.
- **Réglages clés** : l'interrupteur **Hold Message Until Rewrite**.

### Music DJ

Lit l'ambiance de la scène et joue une musique assortie. Il peut passer par Spotify, YouTube ou des fichiers audio locaux.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay et Game.
- **Réglages clés** : le réglage **Music Player** (lecteur de musique) choisit le fournisseur, et chaque fournisseur demande sa propre configuration. Pour la marche à suivre complète avec Spotify, YouTube et la musique locale, voir [Music DJ](../media/music.md).

### Haptic Feedback

Lit la narration et pilote en temps réel les jouets intimes connectés, via Intiface Central. Intiface Central doit déjà tourner avec un jouet connecté avant que tu actives cet agent.

- **Phase** : Post-Processing.
- **Où ça marche** : Conversation, Roleplay et Game.
- **Réglages clés** : le choix **Touch Sensitivity** (**Subtle**, **Standard** ou **Intense**) et le champ **Intiface URL** (URL Intiface). La sensibilité guide les choix de l'agent sans limiter la plage d'intensité `0.0-1.0` disponible. Pour la configuration complète, voir [Configurer Haptic Feedback](../integrations/haptic-feedback.md).

### CYOA Choices

Ajoute après chaque réponse des boutons de choix cliquables "What will you do?", pour une ambiance de livre dont tu es le héros (CYOA). Chaque bouton contient une action complète que tu envoies d'un clic.

- **Phase** : Post-Processing.
- **Où ça marche** : Roleplay.
- **Réglages clés** : **Edit** (modifier) pour réécrire les choix et **Re-roll** (relancer) pour en générer de nouveaux. Active **Add CYOA choices to the message box instead of sending them** (ajouter les choix CYOA à la zone de saisie au lieu de les envoyer) dans **Settings → General → Input & Editing** (Paramètres → Général → Saisie et édition) pour que les choix cliqués aillent dans ta zone de saisie.

### Storyboard

Prépare des storyboards fixes ou animés à partir des échanges Roleplay terminés et de la narration de Game. Une planification séparée et une mise en forme adaptée au fournisseur préservent l'ordre de l'histoire, l'identité des personnages et le style choisi sur les images-clés et les vidéos.

- **Intégration** : package d'agent ; Game et Roleplay utilisent ses modèles de prompt et ses réglages via l'intégration Storyboard d'Engine.
- **Où ça marche** : Roleplay et Game.
- **Réglages clés** : planificateurs image fixe ou animation, connexions d'images et de vidéo, nombre d'images-clés, durée, mode d'affichage, gestion des références de personnage, modèles d'épisode et de style pour Roleplay, et modèles d'illustration et de vidéo pour Game.
- **Compatibilité** : Engine `2.3.5` jusqu'à `3.0.0` exclu. Permissions : `agent-runtime`, `chat-read`, `prompt-context`, `storage`, `ui`. Aucun redémarrage nécessaire.
- **Guide complet** : [Agent Storyboard : Roleplay et Game Mode](../game/storyboard.md).

### 2D Avatars

Affiche les personnages et les personas sous forme d'avatars 2D animés qui clignent des yeux, parlent et changent de visage à chaque réponse. Un avatar est soit un ensemble de sprites façon PNGTuber (tes sprites d'expression avec des images de clignement et de parole), soit un fichier d'avatar mesh (`.mavatar`).

- **Intégration** : package d'agent. Engine dessine les avatars. L'agent n'envoie aucune requête supplémentaire à tes connexions d'IA pendant que tu discutes.
- **Où ça marche** : Roleplay et Game, pour les personnages et les personas.
- **Disponibilité** : dans **Agent Organizer** pour toutes les installations. Nécessite Marinara Engine 2.5.1 ou une version plus récente.
- **Réglages clés** : configure chaque avatar sur la page de l'agent, dans **Agents**. L'agent fournit aussi les prompts qui créent les images de clignement et de parole, ainsi qu'un avatar mesh, à partir d'un sprite.
- **Compatibilité** : Engine `2.5.0` jusqu'à `4.0.0` exclu, Capability API 1.73. Permissions : `agent-runtime`, `chat-read`, `storage`, `ui`. Aucun redémarrage nécessaire.
- **Guide complet** : [Avatars 2D et 3D](avatars.md).

### 3D Avatars

Affiche les personnages et les personas sous forme de modèles 3D animés qui clignent des yeux, parlent et changent de visage à chaque réponse. Il prend en charge les modèles VRM (`.vrm`, versions 0.x et 1.0) avec une animation au repos facultative (`.vrma`), les modèles MMD PMX, et les modèles GLB et FBX dotés d'un squelette d'animation, dont les os sont reconnus d'après leur nom.

- **Intégration** : package d'agent. Engine dessine les avatars. L'agent n'envoie aucune requête supplémentaire à tes connexions d'IA pendant que tu discutes.
- **Où ça marche** : Roleplay et Game, pour les personnages et les personas.
- **Disponibilité** : dans **Agent Organizer** pour toutes les installations. Nécessite Marinara Engine 2.5.1 ou une version plus récente.
- **Réglages clés** : configure chaque avatar sur la page de l'agent, dans **Agents**.
- **Compatibilité** : la même que 2D Avatars.
- **Guide complet** : [Avatars 2D et 3D](avatars.md).

### Calls

Ajoute des appels audio et vidéo en direct avec les personnages de Conversation : appels que tu lances, appels entrants, transcriptions propres à l'appel, synthèse vocale, entrée micro et clips vidéo de personnage.

- **Intégration** : package de fonctionnalité pour Conversation, avec des contrôles dans la barre d'outils, dans le chat et dans Chat Settings.
- **Où ça marche** : Conversation.
- **Réglages clés** : ouvre **Chat Settings → Agents → Calls** pour activer les appels et régler la voix, le micro, la sonnerie et la vidéo. Voir [Appels audio et vidéo en Conversation](../conversation/calls.md). L'installer ou le retirer demande un redémarrage.

### UNO

Ajoute une table de UNO avec application des règles, pour toi et les personnages de Conversation, avec des règles maison et de deux à dix joueurs.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/uno`, puis choisis les joueurs et les règles maison. L'installer ou le retirer demande un redémarrage.

### Chess

Ajoute un échiquier en tête-à-tête avec vérification des coups légaux, détection de l'échec et de l'échec et mat, pièces capturées et tours de l'adversaire joués dans son personnage.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/chess`, puis choisis l'adversaire et ta couleur. L'installer ou le retirer demande un redémarrage.

### Poker

Ajoute une table de Texas Hold'em de deux à huit joueurs, avec blinds, tours d'enchères, pots secondaires, abattages et adversaires joués dans leur personnage.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/poker`, puis choisis les joueurs, les jetons de départ et les blinds. L'installer ou le retirer demande un redémarrage.

### 8-Ball Pool

Ajoute une table de billard en tête-à-tête avec billes pleines et rayées, visée et puissance de tir, fautes, bille en main et tirs de l'adversaire joués dans son personnage.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/8ball`, puis choisis l'adversaire. L'installer ou le retirer demande un redémarrage.

### Tic-Tac-Toe

Ajoute une grille de morpion en tête-à-tête avec symboles choisis ou aléatoires, gestion des tours, et détection de la victoire et du match nul.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/tictactoe` (alias `/ttt`), puis choisis l'adversaire et ton symbole. L'installer ou le retirer demande un redémarrage.

### Rock-Paper-Scissors

Ajoute un match en tête-à-tête où les deux choix restent cachés jusqu'à la révélation.

- **Intégration** : package de jeu pour Conversation.
- **Où ça marche** : Conversation.
- **Réglages clés** : lance-le depuis le sélecteur de jeux ou avec `/rps`, puis choisis l'adversaire et un match au meilleur des trois, cinq ou sept manches. L'installer ou le retirer demande un redémarrage.

## Guides associés

- [Vue d'ensemble des agents](agents-overview.md)
- [Agent Illustrator](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Configurer Haptic Feedback](../integrations/haptic-feedback.md)
- [Sources de connaissances](knowledge-sources.md)
- [Narrative Director et Secret Plot](../roleplay/narrative-director.md)
- [Appels audio et vidéo en Conversation](../conversation/calls.md)
- [Jeux de table en Conversation](../conversation/table-games.md)
