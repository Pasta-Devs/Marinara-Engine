# Multijoueur facultatif

Suivi de l'implémentation : [#6790](https://github.com/Pasta-Devs/Marinara-Engine/issues/6790). Ce document consigne les limites d'implémentation et les preuves requises. Il n'affirme ni que le multijoueur est disponible, ni qu'une plateforme a passé les tests.

<a id="smallest-architecture"></a>

## Architecture minimale

Un hôte possède un nouveau chat partagé, l'état de jeu enregistré et ses connexions IA. Il choisit les participants humains et IA sans plafond fixe de personnes ou de fiches. Conversation, Roleplay et Game conservent leurs modes. Une invitation ne partage jamais un ancien historique privé.

Le transport retenu est un serveur HTTPS dédié avec de petites actions JSON et de l'interrogation longue bornée. Fastify, Node HTTPS et Zod sont déjà installés. WebRTC ajouterait signalisation, configuration ICE/TURN et contraintes de durée de vie de l'onglet hôte mobile ; WebSocket nécessiterait une autre dépendance serveur et un analyseur de flux. Les chats privés partagés réutilisent HTTPS sans ces ajouts. C'est l'unique transport du salon. Le serveur n'enregistre que les opérations de salon, jamais l'API Engine ordinaire. La connexion invité-hôte est directe, sans relais central. Une invitation ne donne accès ni aux fichiers, bibliothèques, réglages, identifiants ni aux autres chats du pair. Garde le port d'administration Engine privé ; seul le port distinct du salon figure dans l'invitation.

L'Engine de confiance de l'invité se connecte à l'hôte. TLS doit valider la chaîne du certificat et le nom d'hôte ; l'invitation épingle en plus l'empreinte du certificat de l'hôte. Vérifie ce lien avant d'envoyer mot de passe ou persona. Ne suis pas les redirections, ne bascule pas vers HTTP, ne désactive pas la validation des certificats et ne configure pas automatiquement de redirection du routeur. L'hôte configure adresse HTTPS et certificat avec les fonctions TLS existantes.

La vue invitée est du code fourni de confiance, dans un bac à sable à origine opaque, sans réseau, téléchargement, navigation, stockage, pont natif ni accès administratif. Un MessageChannel authentifié ne transporte que des projections validées du salon et un petit ensemble explicite d'actions. Le parent fournit les préférences locales de présentation ; les pairs ne peuvent fournir styles, ressources, code, URL à récupérer ni appels API arbitraires. Leur texte est affiché comme texte. Les moteurs de rendu riches des chats restent hors de cette limite. L'enveloppe Android injecte un pont natif dans chaque frame et doit rester indisponible aux invités tant qu'un contexte sans pont n'est pas implémenté et vérifié sur appareil physique.

<a id="trust-boundaries"></a>

## Frontières de confiance

| Frontière | Contrôle |
| --- | --- |
| Administrateur local vers contrôleur de salon | Basic Auth, CSRF, validation d'hôte et contrôles d'authentification locale native existants restent intacts. |
| Engine invité vers serveur du pair | HTTPS, liaison d'empreinte, mot de passe distinct, approbation, sessions aléatoires temporaires et requêtes bornées. |
| Pair vers invité de confiance | Schémas versionnés stricts des deux côtés récepteurs, projection textuelle, bac à sable opaque et CSP restrictive. |
| Participant vers état du chat/jeu | Identité et propriété dérivées de la session authentifiée ; aucun rôle, route ou demande de génération choisi par le pair. |
| Salon vers génération et outils | Correspondance des opérations contrôlée par l'hôte, verrou de génération existant, règles explicites de commandes/outils et barrière de préparation Game. |
| État partagé vers historique | Liste autorisée de champs visibles ; exclusion des identifiants, prompts de débogage, raisonnements, notes privées, bibliothèques étrangères et état caché du GM. |

Un pair authentifié reste non fiable. Le texte du prompt reste intact ; l'autorisation est imposée par le code, pas par l'échappement du prompt ni une demande au modèle d'être prudent. L'hôte et ses fournisseurs IA peuvent lire le contenu partagé. Comme toute connexion directe, ce modèle révèle à l'hôte l'adresse IP de l'Engine connecté. Aucune autre donnée de bibliothèque ou d'appareil de l'invité ne fait partie du protocole. Cela ne promet pas de protection contre toute faille de navigateur ou de système.

<a id="activation-and-lifetime"></a>

## Activation et durée de vie

`MULTIPLAYER_ENABLED=true` est un prérequis appliqué uniquement au redémarrage. Valeurs absentes, fausses ou invalides désactivent le multijoueur. Une activation distincte dans Settings est nécessaire ; aucun de ces réglages ne démarre le réseau. Héberger et rejoindre exigent chacun une action explicite. Un redémarrage ne restaure jamais un salon actif. Stop, Kick et Leave révoquent les identifiants concernés et empêchent les actions ultérieures ou livraisons tardives.

Tant que l'une des deux autorisations manque, il n'y a ni recherche de sessions, ni vérification de disponibilité des certificats, ni interrogation hôte/invité, ni tâche autonome de salon. Le serveur lit les indicateurs ; le client met en cache une lecture de disponibilité, actualisable par une action explicite de Settings. Les appels directs aux API désactivées restent refusés. Le nettoyage des sessions enregistrées attend l'activation, sans reprendre le réseau.

<a id="proof-before-enabling-the-feature"></a>

## Preuves avant activation

- Prouver qu'un texte malveillant ne peut ni s'exécuter, ni charger des ressources, naviguer, télécharger, atteindre les API locales ou invoquer un pont natif dans le contexte invité pris en charge.
- Prouver que les autorisations désactivées, l'admission non authentifiée, la propriété, la projection d'état privé, le trafic borné et la révocation refusent les accès non permis.
- Réutiliser génération, commandes et autonomie via un seul coordinateur hôte. Publier la matrice de compatibilité par commande avec restrictions explicites.
- Prouver que deux joueurs Game ne produisent qu'un tour, après soumission ou passage explicite de chacun ; reprises, déconnexions, annulation et redémarrage ne doivent pas appliquer l'état deux fois.
- Tester configuration, tiroir, barre latérale et zone de saisie existants sur ordinateur et mobile, avec Leave/Stop et récupération clairs. Consigner les lacunes de test sur appareils physiques.

Les étapes incomplètes restent désactivées. Les trois modes et leurs frontières de sécurité sont nécessaires avant de déclarer #6790 terminé.

<a id="command-and-feature-compatibility"></a>

## Compatibilité des commandes et fonctions

Les actions du salon passent par le coordinateur hôte authentifié. Cette table décrit la frontière, pas une permission d'exécuter des commandes arbitraires chez un pair. Une commande rejetée est expliquée dans la zone de saisie ; l'invité ne l'exécute jamais.

| Fonction | Appelant et exécution | Résultat partagé et règle de tour |
| --- | --- | --- |
| Messages humains, `/send` | Participant admis ; l'hôte crée un message utilisateur attribué. `/send` supprime la réponse automatique. | Texte public. Conversation/Roleplay sérialisent les envois acceptés avec la génération ; un expéditeur occupé conserve son brouillon. Game passe uniquement par la collecte du tour. |
| `/roll`, `/r`, `/dice` | Participant admis ; analyseur borné et lanceur de dés Engine existants exécutés sur l'hôte. | Résultat textuel attribué. Dans Game, le lancer reste l'action soumise de ce joueur jusqu'à la clôture du tour. |
| Générer, `/trigger` | Participant admis ; une réservation persistante de génération de l'hôte et le verrou existant. | Narration IA enregistrée et filtrée. Game refuse les déclenchements indépendants ; seule la préparation complète déclenche la résolution. |
| Autres commandes slash | Indisponibles tant que leur autorisation de salon n'est pas auditée et ajoutée explicitement. | Aucune insertion de rôle système, usurpation, navigation/édition de chats privés, action de galerie/appareil ou exécution locale arbitraire. |
| Réponses de groupe | Liste IA approuvée choisie par l'hôte et génération séquentielle/Smart/manuelle existante. | Identité IA distincte des instantanés de personas humaines. `{{user}}` utilise la persona vérifiée de l'hôte, jamais le dernier invité à avoir parlé. |
| Emplois du temps et autonomie Conversation | Planificateur serveur, logique de candidats/intentions, délais de récupération et d'occupation existants ; passage par la même réservation de salon. | Aucun planificateur invité. Salons arrêtés/en pause et Game ne génèrent pas par minuteur. Sans vue humaine ni pair admis observé pendant 45 secondes, l'autonomie se suspend. |
| Conversation `schedule_update`, `memory`, `react` | Gestionnaires Engine existants soumis aux règles du salon. | Changements d'emploi du temps/mémoire locaux au salon ; réactions ciblant ce chat, sans image personnalisée. Aucun changement global de mémoire de personnage ou de présence. |
| Notes, rappels, lancers et murmures Roleplay | Analyse des commandes et gestionnaire hôte existants ; les identifiants des participants approuvés déterminent les destinataires. | Les notes privées restent privées. Un murmure apparaît seulement dans l'instantané filtré du destinataire ; l'hôte possède toujours les données enregistrées. Les agents du salon ne lisent jamais les murmures, puisque chaque participant voit ce qu'ils produisent. |
| Scènes entre chats et rappels du navigateur | Restreints : le flux ordinaire crée/ouvre des chats privés liés ou utilise un minuteur local au navigateur. | Décris une scène dans l'historique partagé ; utilise les emplois du temps Conversation coordonnés par l'hôte pour les messages autonomes. Aucune commande reçue ne crée de chat privé ni de rappel local. |
| Lorebooks et souvenirs | Livres joints/appartenant au salon vérifiés par l'hôte et souvenirs de conversation locaux au salon. | Contexte du prompt uniquement, pas d'export de bibliothèque. Livres globaux implicites, chats privés liés et souvenirs globaux de fiches sont exclus. |
| Suivis Engine, dés, état, résumés et variables | Listes autorisées explicites dans le véritable exécuteur d'outils/agents, pas seulement dans les prompts. | Champs publics sûrs projetables ; sorties brutes d'agents, raisonnement caché, prompts de débogage et champs privés du GM restent masqués. Les effets Game dépendent de la réservation du tour. |
| Actions, choix, tests, inventaire et fiches Game | Configuration/démarrage Game par l'hôte et génération existante ; effets déterministes après tour enregistrés une seule fois. | La propriété des actions humaines vient du participant authentifié. Les choix remplissent un brouillon sans contourner la préparation des soumissions. |
| Médias, outils personnalisés/de paquets, Game Experiences et intégrations d'appareils | Indisponibles pour la génération du salon. | Aucun fichier, image, audio, vidéo, style distant, téléchargement, commande native ou interface invitée fournie par paquet. Une étape de sécurité distincte est nécessaire. |

Le Game partagé initial est le flux synchronisé de narration/actions. Les interfaces tactiques/minijeux uniquement côté client, Game Experiences personnalisées et présentations de scènes/médias ne sont pas annoncées comme fonctions invitées. La configuration Game standard est réutilisée avec ces options explicitement restreintes. Aucun moteur de rendu fourni par l'hôte ne comble une lacune de compatibilité.

<a id="recovery-and-limits"></a>

## Récupération et limites

Chaque participant authentifié possède une séquence d'actions monotone persistante et des reçus d'opérations bornés. Une nouvelle tentative retourne le résultat précédent ; une répétition reste périmée après la sortie de son reçu du cache de 128 entrées. Les instantanés de persona des messages ne changent jamais lors d'un changement ultérieur de persona. Les noms humains et IA doivent être sans ambiguïté pour les murmures/tests ciblés.

Les noms d'affichage et de persona sont publics : ils ne prouvent donc jamais à qui appartient une place. Un joueur qui part ou ne donne plus signe de vie ne retrouve son ancienne place que si son Engine présente la clé de reconnexion privée de cette place : le jeton de session de l'admission qui l'a placé la première fois, renvoyé comme jeton porteur (bearer) de la nouvelle demande pour rejoindre. Sans elle, une demande qui utilise les mêmes noms reçoit un conflit de nom et les sessions de la place restent intactes. Les deux Engines ne gardent la clé qu'en mémoire. Après un redémarrage de l'Engine invité, l'hôte retire l'ancienne place avant que ce joueur puisse réutiliser le même persona.

Les changements de persona Game s'appliquent à la prochaine frontière de tour. Fiches existantes, statistiques actuelles, propriété de l'inventaire et clés de confidentialité des suivis suivent l'identité stable du participant ; les anciens messages gardent leur attribution. Si un NPC prend le nom demandé entre-temps, l'ancienne persona reste active et le joueur voit un conflit de nom. Passages, retraits, pauses et reprises de l'hôte laissent des événements localisés dans le même historique.

Game enregistre participants requis, révision de chaque soumission et réservation unique de résolution dans les métadonnées existantes du chat. Collecte des soumissions et enregistrement des messages attribués utilisent la file de métadonnées puis la transaction de stockage. Le fournisseur travaille hors de cette transaction. Stop annule le signal d'opération de confiance ; les écritures tardives doivent toujours correspondre à sa réservation active. Les tours interrompus ne sont pas relancés automatiquement. Une reprise explicite avance à la prochaine collecte sans rejouer les effets enregistrés. Une configuration échouée reste dans le hall pour inspection/redémarrage explicites.

Aucun plafond fixe de participants humains ou IA. Le protocole version 1 limite chaque action à 16 KiB, les instantanés à 256 KiB et 100 messages récents, les messages texte à 8 000 caractères. Files d'approbation, sockets d'écoute, requêtes, interrogations longues, sessions, dérivations de mots de passe et génération sont bornés. Une interrogation de pair est active par session, une de connecteur par Engine invité. Compression et redirections sont refusées. Les mots de passe/jetons n'apparaissent jamais dans les URL ou instantanés partagés.

Les grands salons dépendent des ressources de l'hôte, du débit et du contexte du modèle. Aucun participant n'est retiré silencieusement pour faire tenir une mise à jour. Si celle-ci dépasse le budget de transport, l'invité garde son dernier état valide et peut partir ; l'hôte peut toujours gérer le salon et réduire les données pour rétablir les interrogations.

<a id="verification-record"></a>

## Registre de vérification

Les preuves automatisées utilisent un stockage jetable, une autorité de certification locale de test et des fournisseurs simulés. Elles ne modifient ni certificats, ni données, ni connexions IA de l'utilisateur.

- `multiplayer-peer-security.regression.ts` : vérification chaîne TLS/nom/empreinte avant divulgation HTTP, réponses malformées/trop grandes/avec redirection et annulation.
- `multiplayer-peer-server-security.regression.ts` : routes de salon uniquement, limites de corps/en-têtes/sortie/fréquence/concurrence et arrêt immédiat de l'écoute.
- `multiplayer-seat-key-security.regression.ts` : des noms copiés ou une mauvaise clé de reconnexion ne prennent jamais une place ni ses murmures ; le détenteur de la clé retrouve la même place, et la clé n'atteint jamais les autres participants ni les données de chat enregistrées.
- `multiplayer-room.regression.ts` : deux Engines, admission, propriété, historique filtré, révocation/répétition, sérialisation de génération et tours/récupération Game à deux joueurs.
- `multiplayer-session-flows.regression.ts` : deux Engines via HTTPS avec véritables runtimes de génération/Game, fournisseur simulé et tours complets Conversation, Roleplay et Game.
- `multiplayer-generation-policy.regression.ts` et `generation-output.regression.ts` : restrictions d'exécuteur, exclusion des bibliothèques privées, identités locales au prompt, verrou partagé et sémantique de fin.
- `multiplayer-autonomy-security.regression.ts` : réutilisation du planificateur, horloge d'activité du salon, autorité unique et courses Stop.
- `multiplayer-game-runtime.regression.ts` : configuration/démarrage/introduction Game, effets déterministes, écritures périmées et configuration interrompue.
- `multiplayer-game-persona.regression.ts` et `multiplayer-game-projection.regression.ts` : migration de propriété de persona, résolution de collisions, filtrage par public et suivis publics bornés.
- `e2e/multiplayer-guest-isolation.e2e.ts` : bundle invité de production face au texte hostile et aux tentatives d'accès local/réseau/natif sur Chromium ordinateur, Chromium mobile et WebKit mobile.
- Les cas ciblés de configuration/contrôles couvrent avertissements d'admission, Players, hall Game, dispositions tactiles, clair/sombre et brouillons/nouvelles tentatives.

Avant fusion, relance `pnpm check`, les régressions Node pertinentes, `pnpm regression:prompt`, `pnpm smoke:ui` et la matrice navigateur ciblée sur le candidat final. Consigne résultats réels et révision dans le PR, termine CodeRabbit et une revue de sécurité ciblée, puis vérifie les appareils physiques pris en charge. L'émulation navigateur ne prouve pas le fonctionnement sur écran d'accueil d'un iPhone/iPad physique ou sur Android réel. L'enveloppe Android native reste désactivée comme invitée. Les résultats physiques restent en attente jusqu'à leur consignation ; ne déduis pas la prise en charge d'un profil de viewport.

L'invité est compilé en IIFE classique, car charger des modules ES depuis une origine opaque imposerait d'assouplir CORS. Le démarrage production/développement compile les ressources invitées locales fixes ; après modification du code invité avec le serveur de développement en marche, lance `node packages/client/scripts/build-multiplayer-guest.mjs` et recharge la vue. Le contrôle d'intégrité du lanceur inclut les deux ressources isolées.

Suivi des traductions : [#6854](https://github.com/Pasta-Devs/Marinara-Engine/issues/6854).
