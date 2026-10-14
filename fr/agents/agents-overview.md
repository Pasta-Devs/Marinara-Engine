# Agents : des aides IA pour tes chats

Ce guide explique ce que sont les agents dans Marinara Engine, comment les télécharger, à quel moment ils se déclenchent et comment les activer dans un chat. Au programme : le panneau **Agents**, le catalogue officiel, les réglages propres à chaque chat et les signes qui montrent qu'un agent est passé par là. Le catalogue officiel complet est détaillé dans les guides liés en fin de page.

## À quoi servent les agents

Les agents sont de petites aides IA qui se déclenchent automatiquement autour de la réponse principale du chat. Chacun fait un travail précis pendant que tu discutes avec un personnage. L'un suit l'heure et la météo, ou choisit l'expression d'un personnage. Un autre réécrit la réponse pour supprimer les répétitions. D'autres encore génèrent une image pour un moment important.

Les agents s'activent chat par chat, pas personnage par personnage. Aucun interrupteur d'agent ne figure sur une fiche de personnage. Deux chats avec le même personnage peuvent faire tourner des agents totalement différents. Le choix se fait dans les réglages de chaque chat.

Une installation neuve de Marinara Engine ne contient aucun agent optionnel. L'application de base et l'installation Termux restent ainsi plus légères. **Download Agents** (télécharger des agents) regroupe les packages officiels installables en un clic en **Apps**, **Writer Agents**, **Tracker Agents** et **Misc Agents**. Le catalogue comprend Long-Term Memory, World Maps, Calls, Inventory Tracker et les six jeux de Conversation. Leur code source, leurs manifestes, les fichiers téléchargeables et le catalogue du dépôt sont publics sur [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Pour le détail agent par agent, va voir la [Référence des agents téléchargeables](built-in-agents.md). Pour créer les tiens, lis [Créer des agents personnalisés](custom-agents.md).

## Les trois phases

Chaque agent se déclenche à l'un des trois moments qui entourent la réponse. On appelle ce moment la **phase du pipeline** de l'agent. Tu la définis dans l'éditeur d'agent, et chaque agent intégré arrive avec une valeur par défaut adaptée.

- **Pre-Generation** : avant que l'IA n'écrive sa réponse. L'agent peut ainsi ajouter du contexte utile au prompt, c'est-à-dire au texte que Marinara envoie à l'IA. Les agents de recherche de connaissances travaillent ici.
- **Parallel** : en même temps que la réponse. L'agent n'attend pas la réponse et ne peut pas la modifier. Un agent de réaction du public en direct travaille ici.
- **Post-Processing** : une fois la réponse terminée. L'agent peut la lire et, pour les agents de réécriture, la modifier. La plupart des trackers, l'agent de nettoyage du style et l'agent d'images travaillent ici.

## Le panneau Agents

Ouvre le panneau **Agents** depuis les onglets du panneau de droite (l'icône Sparkles). C'est là que tu parcours, crées et organises les agents. C'est ta bibliothèque, pas l'interrupteur qui active un agent dans un chat précis.

Clique sur le bouton **Download Agents**, en haut, pour ouvrir le catalogue officiel en plein écran. Il fonctionne sur ordinateur comme sur téléphone. Sélectionne un élément pour lire sa description, le type de fonctionnalité pris en charge, la taille du téléchargement, les permissions, la compatibilité des versions et la documentation. Clique sur le bouton **Install** (installer) pour l'ajouter ; le même écran propose des mises à jour manuelles immédiates et un bouton **Uninstall** (désinstaller) pour les packages déjà présents.

Le catalogue intégré s'appuie sur le [dépôt public Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Tu peux y inspecter chaque package et chaque fichier, mais mieux vaut passer par le bouton **Download Agents** : Marinara valide alors la compatibilité, les permissions, les empreintes, le contenu des archives et les redémarrages nécessaires.

Le catalogue réunit les agents de chat maison, World Maps, les appels audio et vidéo de Conversation, ainsi que tous les jeux optionnels de Conversation. Les agents installés sont répartis entre **Apps**, **Writer Agents**, **Tracker Agents** et **Misc Agents**, plus une section **Custom Agents** pour ceux que tu crées. Les **Apps** sont des packages dotés de leur propre onglet Home, comme Noodle et Slurp, que tu utilises de façon autonome au lieu de les ajouter à un chat. Désinstaller un package du catalogue retire son code et ses réglages de l'Engine, tout en conservant les messages et l'historique du chat. Supprimer un agent personnalisé est définitif.

Un paquet marqué **Rules** fournit un ensemble de règles de Game Mode, comme 5e (SRD 5.1), et non un agent. Choisis-le sous **Rules** à la création d'une partie ; voir [Choisir les règles](../game/getting-started.md#choosing-rules). Il n'a pas d'interrupteur d'activation par chat. Le paquet 5e est un aperçu, actuellement visible uniquement dans le catalogue d'Engine sur la branche `staging`.

Si tu viens d'une version de l'Engine qui intégrait ces fonctionnalités, Marinara télécharge une seule fois les packages correspondants. Il conserve les sélections faites dans les chats, les réglages des agents, les données de runtime enregistrées et l'historique. Si cette migration n'atteint pas le catalogue, elle réessaie au démarrage suivant au lieu de perdre quoi que ce soit.

<a id="updating-packages"></a>

### Mettre à jour les packages

Marinara te demande ton accord avant de mettre à jour un package. Quand une version compatible plus récente d'un package que tu as installé est disponible, une fenêtre **Agent updates available** (mises à jour d'agents disponibles) s'affiche. Elle liste chaque mise à jour avec sa nouvelle version et indique si elle demande un redémarrage. Quand le package publie des notes de version, **What changed** (ce qui a changé) les affiche. Un point signale un changement que tu remarqueras ; les mises à jour sans point sont des correctifs de routine.

- Clique sur **Update all** (tout mettre à jour) pour installer toutes les mises à jour listées. Redémarre Marinara Engine si cela t'est demandé.
- Clique sur **Not now** (pas maintenant) pour garder tes versions actuelles. Marinara ne te reposera pas la question pour une version que tu as ignorée.

Tu peux toujours mettre à jour un package plus tard depuis **Download Agents**. Les packages installés continuent de fonctionner dans leur version actuelle jusqu'à ce que tu les mettes à jour, même quand le catalogue est inaccessible.

Les mises à jour ne concernent que les packages que tu as déjà installés. Les installations sur ordinateur, Docker et Android/Termux gardent leurs packages sur leur serveur local. Sur iOS, iPadOS et les autres clients navigateur, ce sont les packages installés sur le serveur Marinara auquel ils se connectent qui servent.

## Activer les agents dans un chat

Les agents s'activent dans chaque chat, depuis le panneau latéral **Chat Settings** (réglages du chat).

1. Ouvre le chat voulu.
2. Ouvre **Chat Settings**.
3. Va dans la section **Agents**.
4. Active l'interrupteur **Enable Agents** (activer les agents). C'est l'interrupteur principal : quand il est sur off, aucun agent ne se déclenche dans ce chat.
5. Ajoute les agents voulus depuis les listes situées sous l'interrupteur, ou retire ceux dont tu ne veux pas.

Les agents ajoutés apparaissent alors dans la liste des agents actifs, chacun avec un petit bouton de suppression.

La section **Agents** contient quelques réglages supplémentaires :

- **Agent Menus** (menus des agents, chats Roleplay uniquement) : se trouve juste sous **Enable Agents**. Clique sur le nom d'un agent pour aller directement à ses réglages.
- **Trackers Control** (contrôle des trackers, chats Roleplay uniquement) : une carte repliée au départ. Clique dessus pour ouvrir ces réglages :
  - **Attach chat summaries** (joindre les résumés du chat) : désactivé par défaut, y compris dans les chats existants sans choix enregistré. Active cette option pour joindre les résumés enregistrés aux requêtes des agents, y compris lors du traitement après la réponse et des relances manuelles. Les résumés restent dans le contexte de la réponse principale et leur génération continue. Les agents disposant explicitement d'un accès au prompt principal complet peuvent toujours lire les résumés qu'il contient.
  - **Attach Lorebooks to Trackers** (joindre les lorebooks aux trackers) : sur on, les trackers reçoivent aussi les entrées de lorebook utilisées pour la réponse principale. Ce réglage s'affiche dès que le chat compte un tracker.
  - **Review Agent Outputs** (relire les résultats des agents) : décrit dans son propre point, après cette liste.
  - **Individual tracker schedule** (planification individuelle des trackers) : active un tracker pour qu'il ne se déclenche plus après chaque réponse. Tu le lances alors à la main depuis un bouton du HUD. HUD signifie heads-up display, le bandeau d'infos affiché par-dessus l'écran en Roleplay. Ce réglage s'affiche dès que le chat compte un tracker.
- **Review Agent Outputs** : sur on, les modifications de lorebook, de résumé et de fiche de personnage attendent ton accord avant d'être enregistrées. Sur off, les modifications de lorebook et de résumé s'enregistrent seules, mais les retouches de fiche de personnage te sont toujours soumises. Voir [Validations des agents et Agent Suite](approvals-and-agent-suite.md). Dans les chats Roleplay, cet interrupteur se trouve dans **Trackers Control**.
- **Agent Suite** : ouvre une visionneuse où tu peux lire et modifier tout ce que les agents ont enregistré pour ce chat.

### L'avertissement sur le coût

Les agents consomment des tokens et des appels au modèle en plus. Un token est un petit morceau de texte. Chaque agent ajoute ses propres instructions, et souvent son propre appel au modèle. Quand c'est possible, Marinara regroupe en un seul appel les agents qui partagent la même connexion. Au-dessus de la liste des agents, un indicateur estime la charge de ta configuration actuelle. Il affiche à peu près le nombre de tokens d'instructions d'agents ajoutés, et le nombre d'appels supplémentaires par tour.

Clique ou appuie sur l'icône d'aide à côté de l'indicateur pour ouvrir son explication sur ordinateur ou mobile. Cet indicateur passe à l'orange, avec une icône d'avertissement, quand la charge devient lourde. Le coût réel par tour dépasse le chiffre affiché : l'historique du chat et les détails du personnage partent avec chaque appel. Si l'avertissement s'affiche, retire les agents dont tu n'as pas besoin, ou bascule certains d'entre eux sur une connexion moins chère ou locale. La limite de messages récents concerne uniquement les messages du chat ; les instructions des agents, les détails des personnages et les résumés joints constituent du contexte supplémentaire. Un **Reasoning Effort** (effort de raisonnement) enregistré sur une connexion s'applique aussi aux agents qui l'utilisent : un niveau élevé rend chacun de leurs appels plus lent et plus coûteux. Voir [Paramètres des agents](../prompts/generation-parameters.md#parameters-for-agents).

## Les agents fournis avec chaque mode

Une installation neuve ne contient aucun agent optionnel, installé ou actif. Chaque mode de chat n'affiche que les packages compatibles que tu as installés.

- **Roleplay** : installe les agents Roleplay depuis le catalogue, puis ajoute-les dans Chat Settings. World Maps y apparaît comme n'importe quel autre agent pris en charge.
- **Conversation** : installe Calls ou les jeux de table de ton choix depuis le catalogue. Les jeux apparaissent dans le sélecteur de jeux et enregistrent leurs commandes slash ; les appels ajoutent leur barre d'outils et leurs réglages dans Chat Settings.
- **Game Mode** : les agents compatibles Game installés se choisissent pendant la création de la partie, ou s'ajoutent plus tard. World Maps n'apporte son espace de travail cartographique et sa vue de carte du monde que s'il est actif pour cette partie.

Tu peux ajouter ou retirer des agents compatibles à tout moment.

## Savoir si un agent s'est déclenché

Certains agents changent quelque chose de visible immédiatement. D'autres travaillent en silence. Voici comment vérifier.

- Les trackers écrivent dans le HUD et dans les panneaux de tracker. Si l'heure, le lieu, l'humeur ou les caractéristiques ont changé, un tracker est passé.
- Un bandeau d'état flottant affiche de courts messages de réflexion pendant que les agents travaillent : tu les vois donc tourner en direct.
- Les agents **Prose Guardian** et **Continuity Checker** modifient le texte de la réponse lui-même. Une réponse nettoyée ou corrigée montre qu'ils sont passés.
- Pour une trace complète, active **Debug mode** (mode débogage) dans **Settings** (Paramètres), puis **Advanced**, puis **Message Tools**. Le prompt et la réponse de chaque agent sont alors écrits dans la console du serveur. Un panneau **Agent Debug** affiche aussi les appels, les tokens et les temps de chaque agent.

Un agent attendu ne s'est pas déclenché ? Vérifie que **Enable Agents** est sur on. Vérifie que l'agent est actif dans ce chat. Vérifie que ton mode de chat l'autorise.

## Guides associés

- [Référence des agents téléchargeables](built-in-agents.md)
- [Avatars 2D et 3D](avatars.md)
- [Dépôt officiel Marinara Agents](https://github.com/Pasta-Devs/Marinara-Agents)
- [Créer des agents personnalisés](custom-agents.md)
- [Validations des agents et Agent Suite](approvals-and-agent-suite.md)
- [HUD et trackers en Roleplay](../roleplay/hud-and-trackers.md)
