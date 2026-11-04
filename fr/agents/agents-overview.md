# Agents : des aides IA pour tes chats

Les agents sont de petites aides IA qui s'exécutent autour de la réponse principale de ton chat. L'un suit l'heure et la météo, un autre choisit l'expression d'un personnage, un autre encore dessine une image pour un moment important. Ce guide explique comment installer des agents, les activer dans un chat et vérifier qu'ils se sont exécutés.

## Ce que sont les agents

Les agents s'activent chat par chat, pas personnage par personnage. Deux chats avec le même personnage peuvent faire tourner des agents différents.

Une installation neuve ne contient aucun agent optionnel. Installe-les depuis **Agent Organizer** (organisateur d'agents), la boutique des packages officiels installables en un clic. Leur code source et le catalogue sont publics sur [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Installe-les par **Agent Organizer**, pour que Marinara puisse vérifier la compatibilité, les permissions et les empreintes des fichiers. Pour savoir ce que fait chaque agent, voir la [Référence des agents téléchargeables](built-in-agents.md). Pour créer les tiens, voir [Créer des agents personnalisés](custom-agents.md).

## Ajouter un agent à un chat

Avant de commencer : installe d'abord l'agent. Ouvre le panneau **Agents** (l'icône Sparkles dans les onglets de droite), clique sur **Agent Organizer**, ouvre la page de l'agent et clique sur **Get** (obtenir). Voir [Installer et mettre à jour des agents](#install-and-update-agents).

1. Ouvre le chat.
2. Ouvre **Chat Settings** (réglages du chat) et repère la section **Agents**.
3. Active **Enable Agents** (activer les agents). C'est l'interrupteur principal : quand il est désactivé, aucun agent ne s'exécute dans ce chat.
4. Clique sur **Add Agent** (ajouter un agent), ouvre le groupe auquel appartient l'agent (comme **Writer Agents** ou **Misc Agents**) et choisis-le.

Les agents ajoutés apparaissent comme actifs, chacun avec un petit bouton de suppression. Tu peux ajouter ou retirer des agents à tout moment.

> **Remarque :** chaque mode de chat n'affiche que les agents qui fonctionnent dans ce mode. En mode Conversation, les jeux installés apparaissent dans le sélecteur de jeux et **Calls** ajoute des commandes à la barre d'outils. En Game Mode, choisis les agents à la création de la partie, ou ajoute-les plus tard.

Si un agent ne s'est pas exécuté, vérifie que **Enable Agents** est activé, que l'agent est actif dans ce chat et que son mode correspond à ton chat.

### Autres commandes de la section Agents

Ces commandes se trouvent dans la même section **Agents**.

- **Agent Menus** (menus des agents, Roleplay uniquement) : clique sur le nom d'un agent pour aller directement à ses réglages.
- **Trackers Control** (contrôle des trackers, Roleplay uniquement) : une carte repliée qui contient les options de tracker ci-dessous.
- **Agent Suite** : ouvre une visionneuse où tu lis et modifies ce que les agents ont enregistré pour ce chat.
- **Review Agent Outputs** (relire les sorties des agents) : les modifications de lorebook, de résumé et de fiche de personnage attendent alors ton accord. En Roleplay, cet interrupteur se trouve dans **Trackers Control**. Voir [Approbations d'agents et Agent Suite](approvals-and-agent-suite.md).

Options de **Trackers Control** :

- **Attach chat summaries** (joindre les résumés du chat) : désactivé par défaut. Joint les résumés de chat enregistrés aux requêtes des agents, y compris lors des relances. Il ne retire pas les résumés de la réponse principale et n'arrête pas leur génération. Les agents qui ont un accès complet au prompt principal peuvent toujours y lire les résumés.
- **Attach Lorebooks to Trackers** (joindre les lorebooks aux trackers) : les trackers reçoivent aussi les entrées de lorebook utilisées pour la réponse principale. Ce réglage s'affiche dès que le chat compte un tracker.
- **Individual tracker schedule** (planification individuelle des trackers) : empêche un tracker de s'exécuter après chaque réponse. Tu le lances alors à la main depuis le HUD (le bandeau d'état affiché par-dessus l'écran en Roleplay).

### Donner un lorebook de référence à un agent

1. Dans **Chat Settings**, ouvre **Agents**, puis les réglages de l'agent.
2. Active **Attach lorebook for the specific agent** (joindre un lorebook à cet agent). Il est désactivé au départ.
3. Choisis un livre dans **Reference lorebook** (lorebook de référence).

Le choix appartient à cet agent dans ce chat. Les entrées correspondantes suivent les règles habituelles de déclenchement des lorebooks et vont à cet agent, y compris lors des relances manuelles. Ce réglage n'ajoute pas le livre à la réponse principale ni aux autres agents, mais les agents qui s'exécutent ensemble peuvent aussi voir les mêmes entrées. Un livre supprimé ou indisponible ne fournit rien.

## Quand les agents s'exécutent

Chaque agent s'exécute à un moment précis autour de la réponse, appelé sa **phase du pipeline**. Chaque agent intégré a une valeur par défaut. Tu peux la changer dans l'éditeur d'agent.

| Phase | Quand elle a lieu | Exemples |
| --- | --- | --- |
| **Pre-Generation** | Avant la réponse. L'agent peut ajouter du contexte au prompt. | Recherche de connaissances |
| **Parallel** | En même temps que la réponse. L'agent ne peut pas modifier la réponse. | Réactions du public en direct |
| **Post-Processing** | Après la réponse. L'agent peut lire la réponse, et les agents de réécriture peuvent la modifier. | La plupart des trackers, nettoyage du style, images |

<a id="tell-whether-an-agent-ran"></a>

## Savoir si un agent s'est exécuté

- Les trackers écrivent dans le HUD et dans les panneaux de tracker. Si l'heure, le lieu, l'humeur ou les caractéristiques ont changé, un tracker s'est exécuté.
- **Agent activity** (activité des agents), dans **Chat Settings**, liste de courtes notes des agents. Son icône tourne pendant qu'ils travaillent et affiche un point quand l'un d'eux échoue. Voir [Agent activity](../roleplay/getting-started.md#agent-activity).
- **Prose Guardian** et **Continuity Checker** modifient le texte de la réponse. Une réponse nettoyée ou corrigée montre qu'ils se sont exécutés.
- Pour une trace complète, active **Debug mode** (mode débogage) dans **Settings → Advanced → Message Tools** (Paramètres → Avancé → Outils de message). Le prompt et la réponse de chaque agent sont alors écrits dans la console du serveur, et les entrées de débogage des agents apparaissent aussi dans la console du navigateur. Les injections de prompt mises en cache s'affichent dans l'onglet **Injections** de la section **Agent activity**.

## Surveiller le coût

Chaque agent ajoute ses propres instructions, et souvent son propre appel au modèle. Quand c'est possible, Marinara regroupe en un seul appel les agents qui partagent une connexion.

Au-dessus de la liste des agents, un indicateur estime les tokens (de petits morceaux de texte) et les appels supplémentaires par tour. Touche l'icône d'aide à côté pour plus de détails. Il passe à l'orange, avec une icône d'avertissement, quand la charge est lourde. Le coût réel est plus élevé, car l'historique du chat et les détails des personnages partent avec chaque appel.

Si l'avertissement s'affiche, retire les agents dont tu n'as pas besoin ou bascule certains d'entre eux sur une connexion moins chère ou locale. Un **Reasoning Effort** (effort de raisonnement) enregistré sur une connexion s'applique aussi aux agents qui l'utilisent. Voir [Paramètres des agents](../prompts/generation-parameters.md#parameters-for-agents).

<a id="install-and-update-agents"></a>

## Installer et mettre à jour des agents

Ouvre le panneau **Agents** (l'icône Sparkles dans les onglets de droite) et clique sur **Agent Organizer**. Il fonctionne sur ordinateur comme sur mobile.

- **Home** (accueil) présente les agents recommandés et une rangée pour chaque section : **Apps** (applications), **Chat games** (jeux de chat), **Trackers** et **Writing help** (aide à l'écriture).
- **Updates** (mises à jour) liste les agents installés dont une version plus récente existe. **Installed** (installés) liste tout ce que tu as, avec la version et la taille.
- La recherche et le filtre de mode affinent chaque liste.
- Sélectionne un agent pour voir sa description, la taille du téléchargement, ses permissions, sa compatibilité et **Version history** (historique des versions). Clique sur **Get** pour l'installer. Le menu **⋯** propose **Uninstall** (désinstaller).
- Le menu **⋯** à côté du titre propose **Update all** (tout mettre à jour), **Install all** (tout installer), **Refresh catalog** (actualiser le catalogue) et **Uninstall all** (tout désinstaller).

Les agents installés sont regroupés en **Apps**, **Writer Agents**, **Tracker Agents** et **Misc Agents**, plus **Custom Agents** pour ceux que tu crées. Les **Apps** sont des packages qui ont leur propre onglet Home, comme Noodle et Slurp. Tu les utilises de façon autonome au lieu de les ajouter à un chat.

Un package marqué **Rules** (règles) n'est pas un agent. Il ajoute un ensemble de règles de Game Mode, comme 5e (SRD 5.1), que tu choisis sous **Rules** à la création d'une partie. Voir [Jouer avec un ensemble de règles](../game/rulesets.md). Le package 5e est en aperçu : seul un Engine sur la branche `staging` le liste.

Désinstaller un package retire son code et ses réglages, mais garde les messages et l'historique de tes chats. Supprimer un agent personnalisé le supprime définitivement.

### Mettre à jour des agents

Quand une version compatible plus récente d'un package installé existe, une fenêtre **Agent updates available** (mises à jour d'agents disponibles) s'ouvre. Elle liste chaque mise à jour avec sa version et indique si elle demande un redémarrage.

1. Décoche la case de chaque mise à jour que tu veux ignorer. Toutes les mises à jour sont sélectionnées au départ.
2. Lis **What's new** (nouveautés) si le package a publié des notes. **More** (plus) affiche une note longue en entier. Un point signale un changement que tu remarqueras.
3. Clique sur **Update all** (ou **Update 2 of 3** si tu en as décoché certaines). Chaque ligne affiche **Updated** ou **Failed**. Une ligne en échec affiche la raison et **Retry** (réessayer).
4. Si une mise à jour demande un redémarrage, clique sur **Restart now** (redémarrer maintenant), ou redémarre Marinara plus tard.

Clique sur **Not now** (pas maintenant) pour garder tes versions. Marinara ne te redemande rien pour une version que tu as ignorée. Tu peux mettre à jour depuis **Agent Organizer** à tout moment. Les packages installés continuent de fonctionner dans leur version actuelle, même quand le catalogue est inaccessible. **See in Agent Organizer** (voir dans l'organisateur d'agents) ouvre la page de l'agent.

Les mises à jour ne concernent que les packages que tu as installés. Les packages sont stockés sur le serveur Marinara : les clients navigateur utilisent donc ce que le serveur a installé.

Quand tu passes à une nouvelle version depuis une version d'Engine qui intégrait ces fonctionnalités, Marinara télécharge une seule fois les packages correspondants et conserve les sélections de tes chats, tes réglages et ton historique. S'il n'arrive pas à joindre le catalogue, il réessaie au démarrage suivant.

## Guides associés

- [Référence des agents téléchargeables](built-in-agents.md)
- [Avatars 2D et 3D](avatars.md)
- [Créer des agents personnalisés](custom-agents.md)
- [Approbations d'agents et Agent Suite](approvals-and-agent-suite.md)
- [HUD et trackers en Roleplay](../roleplay/hud-and-trackers.md)
