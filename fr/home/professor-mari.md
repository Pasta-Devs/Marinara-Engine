# Professor Mari, ton assistante intégrée

Professor Mari est l'assistante intégrée de Marinara Engine, sur l'écran d'accueil. Ce guide explique où la trouver, ce qu'elle sait faire, comment elle garde ses modifications réversibles et comment régler les problèmes courants.

## Où la trouver

Professor Mari vit sur l'écran d'accueil. L'écran d'accueil, c'est ce que tu vois quand aucun chat n'est ouvert.

Repère l'encart avec son pixel art et le titre **Professor Mari**. Une ligne d'état affiche **Ready to help** quand elle est disponible, ou **Working on it...** quand elle travaille. Clique sur le bouton **Ask Prof. Mari** (demander à Prof. Mari) pour ouvrir sa fenêtre de chat complète.

Tu lui parles en langage courant. Saisis un message dans le champ, puis appuie sur Enter pour l'envoyer. Appuie sur Shift et Enter ensemble pour aller à la ligne.

Le tout premier message que tu lui envoies débloque le succès **Hello World**.

Une fine ligne en bas de la barre supérieure de l'application indique aussi son état depuis n'importe quel écran : elle ondule pendant que Professor Mari travaille, devient verte quand elle a terminé, dorée tant qu'une approbation attend, ou rouge si la dernière exécution a échoué. Elle disparaît dès que tu ouvres son chat. Cette ligne reste éteinte tant que le réglage **Ask Professor Mari from Search** (demander à Professor Mari depuis Search) est désactivé. Tous les réglages de Professor Mari se trouvent sur la page des réglages de Search et de Professor Mari : ouvre-la avec l'icône d'engrenage dans Search (la recherche de l'application), ou via **Settings** (Paramètres) > **General** (Général) > **Search and Professor Mari settings** (réglages de Search et de Professor Mari) > **Open** (ouvrir).

## Demander à Professor Mari depuis ton travail en cours

Professor Mari est bien plus qu'une boîte à questions. Elle explique l'application, t'aide à la configurer et fabrique des choses pour toi quand tu le demandes.

Tu peux ouvrir Professor Mari depuis l'endroit où tu as besoin d'aide. Ces points d'entrée créent un brouillon modifiable et y joignent un petit résumé de contexte typé. Tu peux retirer le contexte joint avant d'envoyer le message.

- Les éditeurs **Character** (personnage), **Persona**, **Lorebook** et **Preset** : pose-lui une question sur la ressource ouverte ou sur un champ sélectionné.
- Les réponses de la **FAQ** : utilise **Ask Prof. Mari** pour inclure comme point de départ la question correspondante et sa réponse écrite.
- **Search** : appuie sur `Cmd/Ctrl+K`, sélectionne un résultat, puis utilise **Ask Prof. Mari** pour inclure ce résultat dans le brouillon. Utiliser Search n'envoie aucune requête au modèle, sauf si les réponses rapides sont activées : voir **Quick answers in Search** (réponses rapides dans Search) plus bas.
- **Recent Chats** (chats récents) et les autres états d'erreur : utilise **Ask Prof. Mari** à côté de **Retry** (réessayer) pour envoyer la description de l'erreur et l'action de réparation demandée.
- Le chat habituel avec le personnage Professor Mari et le chat de l'espace de travail de l'écran d'accueil utilisent le même format de transfert.

Les éléments joints apparaissent sous forme de pastilles **Aware of** (au courant de) au-dessus de son champ de message. Retire un élément de contexte quand il n'est pas pertinent. Une fois le message envoyé, Professor Mari récupère côté serveur le contenu plus volumineux des ressources, dans la limite du budget de contexte. Elle ne reçoit pas une ressource entière simplement parce que tu as ouvert un éditeur.

Demande-lui de l'aide pour tout ceci :

- Expliquer un réglage, un mode ou un concept avant que tu ne changes quoi que ce soit.
- Créer ou modifier un personnage. Un personnage est une fiche qui donne à l'IA un nom, une personnalité et une voix. Elle peut aussi écrire l'[accueil interactif](../characters/interactive-onboarding.md) d'une fiche, c'est-à-dire les questions auxquelles les joueurs répondent pour construire leur persona.
- Créer ou modifier un persona. Le persona est l'identité que tu incarnes dans un chat, le "toi" de l'histoire.
- Créer ou modifier un lorebook. Un lorebook est un recueil de notes sur ton univers, que l'IA reprend quand elles sont pertinentes.
- Créer ou modifier un thème, un agent, un preset de prompt ou un brouillon de Personal Extension. Professor Mari est la seule autrice d'extension par défaut. Ses brouillons restent désactivés tant que tu n'as pas donné ton accord. Inspecte le code en bac à sable, puis examine les permissions actives demandées sur les fiches de personnage ou les personas. Approuve enfin le hash exact dans **Settings** > **Addons**.
- Modifier une seule partie d'un preset de prompt, sur place. Elle sait lister les sections, les groupes de prompt et les variables de choix d'un preset, puis lire n'importe lequel d'entre eux en entier. Elle ajoute, change ou retire ce seul morceau, par exemple une ligne dans une section précise, au lieu de créer ou de remplacer le preset entier.
- Comparer les 33 agents et packs de fonctionnalités officiels à télécharger, expliquer quels modes ils prennent en charge et conseiller ceux qui correspondent à ton objectif. Elle distingue ce que propose le catalogue de ce qui est réellement installé, oriente vers **Agents → Download Agents** (télécharger des agents) quand il le faut, et sait que les sources des packs et le catalogue complet se trouvent sur [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).
- Générer ou attribuer des images : avatars, sprites, arrière-plans. Un sprite est une image du personnage, portrait ou pose en pied, affichée pendant un chat.
- Consulter les pages publiques du wiki Fandom pour t'aider à te documenter sur un personnage ou un univers.
- Suivre les pastilles de suggestion de réponse rapide affichées au-dessus du champ de saisie, dont la couleur dépend du type d'élément, tout au long d'une création ou d'une modification en plusieurs étapes.

Elle lit un élément avant de le modifier, et elle réclame les détails manquants quand la demande est floue. Pour les tâches d'image, il faut d'abord une connexion de génération d'images qui fonctionne. Elle n'en crée pas à ta place.

## Réponses rapides dans Search

Quand tu saisis une question dans Search et qu'aucun résultat ne correspond, Professor Mari peut rédiger une réponse courte. Elle apparaît dans un encart **Quick answer · Read-only** (réponse rapide · lecture seule) sous la ligne **Ask Prof. Mari**.

- Une réponse rapide compte au plus trois phrases, issues de la documentation de Marinara. Professor Mari ne voit que ce que tu as saisi, et la réponse ne modifie rien.
- L'encart indique les pages de documentation utilisées. Pendant cinq minutes, la même question posée à nouveau réutilise une copie enregistrée.
- Sous la réponse se trouvent **Copy** (copier), **Answer again** (répondre à nouveau) et **Continue with Prof. Mari** (continuer avec Prof. Mari). **Continue with Prof. Mari** ouvre sa fenêtre dans un nouveau chat qui porte le nom de ta question, avec la réponse rapide jointe. Utilise **Ask Prof. Mari more…** (en demander plus à Prof. Mari) pour poser une question de suivi dans sa fenêtre. Les réponses rapides n'ont pas de suivi propre.
- Une réponse rapide attend que tu arrêtes de taper. **Wait after typing** (attendre après la saisie) règle le délai d'attente de Search.
- Choisis qui répond dans **Settings** > **General** > **Search and Professor Mari settings** > **Quick answers** (réponses rapides) > **Answer with** (répondre avec) : un modèle local que tu as téléchargé, **Same as Prof. Mari** (la même connexion que Prof. Mari), ou une autre connexion. Chaque réponse correspond à une seule requête courte. Une connexion payante peut coûter de l'argent.
- Si une réponse échoue, l'encart en donne la raison, par exemple que le modèle n'a pas répondu. **Try again** (réessayer) et **Continue with Prof. Mari** sont toujours là. **Choose a model** (choisir un modèle) n'apparaît que si une clé ou un modèle manque. Le message propre au fournisseur se trouve sous **Details** (détails).
- Les réponses rapides restent désactivées tant que tu ne les as pas activées avec **Quick answers in Search** dans le même groupe.

## Les pastilles de suggestion guidées

Dans un chat Professor Mari vide, des pastilles de démarrage comme **Create a Character**, **Create a Lorebook** et **Create a Persona** lancent les tâches les plus courantes. Pendant une création ou une modification guidée, les pastilles changent pour coller à l'étape suivante. Quand tu cliques sur une pastille, elle remplit le brouillon du champ de saisie ; tu peux le retoucher avant de l'envoyer.

Les parcours guidés posent une seule question à la fois, au lieu d'afficher un long formulaire d'un coup.

Pour une demande complète de création ou de modification, Professor Mari peut renvoyer un plan guidé limité. Chaque étape propose un petit nombre de suggestions. En choisir une remplit le brouillon en cours et fait avancer le plan localement. Ton texte reste dans le brouillon quand tu changes de suggestion. Le plan appartient au chat Professor Mari en cours : changer de chat, redémarrer, arrêter une exécution ou terminer le plan efface les étapes périmées. Les suggestions mal formées ou trop nombreuses sont écartées, et les pastilles sont désactivées pendant que Professor Mari travaille.

Les suggestions ne sont disponibles que dans les chats Professor Mari. Les autres personnages ne reçoivent pas les pastilles de Professor Mari.

## Elle peut aussi lire et modifier les fichiers de l'application

Professor Mari peut regarder à l'intérieur des fichiers de programme de Marinara, les modifier et exécuter des commandes en bac à sable. C'est une capacité réelle et puissante : mieux vaut bien la comprendre.

Voici la limite de confiance, en clair :

- Ses outils de fichiers restent dans le dossier où Marinara est installé. Les commandes shell brutes peuvent lire l'espace de travail et les programmes système nécessaires, mais pas tes autres fichiers personnels.
- Les fichiers de secrets d'environnement comme le fichier `.env`, le fichier de clé qui protège tes clés API enregistrées et les fichiers internes de Git restent hors de portée de ses outils de fichiers et du shell brut.
- Ni ses outils de fichiers ni le shell brut ne lui permettent d'écrire directement dans ton dossier de données enregistrées, là où vivent tes personnages et tes chats. Elle passe par le circuit de modification révisable décrit plus bas.
- Les commandes shell brutes n'ont aucun accès réseau, n'héritent pas des secrets du serveur et ne peuvent écrire que des fichiers ordinaires de l'espace de travail ainsi qu'un dossier temporaire privé.
- Elle peut continuer à modifier directement les fichiers source normaux. Les modifications des manifestes de dépendances, des fichiers de verrouillage, des lanceurs, des installateurs et des workflows CI sont préparées et te sont présentées avant que Marinara ne les applique.
- Elle peut lire les fichiers compilés de Marinara, c'est-à-dire les dossiers `dist` à partir desquels l'application s'exécute, mais ne peut ni créer, ni modifier, ni déplacer, ni supprimer ces fichiers. Elle modifie plutôt les fichiers source. Seule la commande `mari code check` les recompile, dans le même bac à sable.
- Si une modification de source nécessite une bibliothèque npm publique, elle demande un paquet précis. Marinara résout `latest` en une version exacte, affiche l'intégrité du registre dans un encart de révision, et n'installe qu'après ton approbation. Les scripts de cycle de vie des paquets restent désactivés.
- Si Marinara ne peut pas fournir son bac à sable shell macOS ou Linux, les commandes shell brutes et la commande `mari code check` sont désactivées. Elle garde alors les outils structurés, plus sûrs, pour les fichiers et les données de l'application.
- Les commandes qu'elle lance s'arrêtent d'elles-mêmes au bout d'un court délai : une commande bloquée ne peut pas tourner indéfiniment.

La plupart des gens n'en ont jamais besoin. Cette capacité existe pour qu'elle puisse inspecter ou réparer l'application elle-même quand quelque chose casse.

## Choisir une connexion

Professor Mari a besoin d'une connexion pour réfléchir. Une connexion relie Marinara à un fournisseur d'IA grâce à une clé API. La clé API est un code secret fourni par ce fournisseur.

Clique sur l'icône de lien à côté du trombone pour ouvrir le menu déroulant **Connections** (Connexions). Choisis n'importe quelle connexion de génération de texte déjà configurée. Si tu as téléchargé le modèle local intégré, il apparaît ici aussi sous **Local Model (sidecar)**. Si l'application connaît le nom du modèle, ce nom s'affiche entre parenthèses à la place. Ton choix est mémorisé dans le navigateur.

Si tu n'as encore aucune connexion, le menu déroulant affiche **Add a connection** (ajouter une connexion) à la place. Si tu essaies d'envoyer un message sans connexion, le panneau **Connections** s'ouvre tout seul. Tu vois aussi ce message contextuel, appelé toast :

> You haven't set up a connection yet! Click the link icon beside the paperclip to select one.

Pour un déroulé complet, consulte le guide des connexions en fin de page.

## Essayer le runtime Pi (expérimental)

Professor Mari peut travailler de deux façons. **Classic** est le mode par défaut. **Pi** est un essai : elle réfléchit davantage avant d'agir et mène à bien des tâches plus longues.

Pour changer, ouvre **Search and Professor Mari settings** et modifie **Runtime** (environnement d'exécution), sous **Permissions mode** (mode de permissions). Le changement s'applique dès sa prochaine réponse. Ton mode de permissions, les encarts de modification et **Undo** fonctionnent de la même façon dans les deux.

Pi fonctionne avec toutes les connexions, y compris le modèle local. Si Professor Mari se comporte de façon étrange avec Pi, reviens à Classic.

## Joindre des fichiers

Clique sur le bouton trombone, intitulé **Attach files** (joindre des fichiers), pour ajouter un fichier à ton message.

Elle accepte les images, les fichiers PDF et les fichiers texte courants comme `.txt`, `.md`, `.json`, `.csv` et `.log`. Chaque fichier peut peser jusqu'à 20 Mo. Avant l'envoi, les fichiers joints apparaissent sous forme de pastilles supprimables au-dessus du champ de message.

Pour qu'elle puisse lire une image, le modèle de la connexion choisie doit prendre en charge les images en entrée.

## Réviser ses modifications

Quand Professor Mari modifie quelque chose, elle enregistre le changement aussitôt et affiche un encart de modification sous sa réponse. L'encart liste chaque champ modifié. Une modification de texte montre les anciens et les nouveaux mots, et un lorebook montre ses entrées. Ouvre **Show all** (tout afficher) pour voir tous les champs. **Technical details** (détails techniques) affiche la commande brute.

L'encart propose une seule action :

- **Undo** (annuler) remet en place la version enregistrée précédente. Toute modification peut être annulée, quel que soit le mode de permissions. Le mode de permissions décide seulement si elle demande d'abord.
- Une modification qui n'a pas été enregistrée affiche **Not saved** et la raison. **Try again** lui renvoie la demande.
- L'encart n'affiche la date limite d'annulation, **Undo until**, que pendant les dernières 24 heures. Une copie d'annulation dure jusqu'à 14 jours, et seules les 50 plus récentes sont conservées. Passé ce délai, la modification reste en place et l'encart indique **Undo closed**.

Une modification qui t'attend fonctionne autrement. Une modification retenue (en mode Manual, ou pour un fichier sensible ou une dépendance) affiche **Apply** (appliquer) et **Don't apply** (ne pas appliquer). Une suppression affiche **Delete** (supprimer) et **Put back** (remettre en place). Search ne liste pas ses modifications : ouvre Professor Mari pour les voir, les appliquer ou les annuler.

- Un encart appartient au chat Professor Mari dans lequel elle a effectué la modification. Un nouveau chat démarre sans les encarts des autres chats. Supprimer un chat conserve ses modifications et retire ses encarts. Une modification effectuée avec la commande `mari` dans un terminal n'appartient à aucun chat : son encart apparaît donc dans tous les chats Professor Mari.
- Une modification qui laisserait tout à l'identique n'est pas enregistrée et ne reçoit aucun encart.
- Professor Mari ne peut ni modifier ni supprimer sa propre fiche de personnage. Marinara la rétablit à sa version intégrée à chaque démarrage.
- Les personnages et les personas gardent aussi leur propre historique de versions dans leurs éditeurs. Tu peux y restaurer une version plus ancienne : c'est un deuxième filet de sécurité.

Quand Professor Mari crée ou met à jour un personnage, un persona, un lorebook ou un preset, le résultat peut afficher **Open**. Utilise-le pour ouvrir la ressource exacte une fois que l'application a actualisé ses données. Un résultat mis à jour peut aussi afficher **Review** (examiner) quand une révision est en attente. **Review** ouvre les contrôles de la modification en attente. Les nouveaux éléments n'ont en général pas de révision, puisqu'aucun élément existant n'a été écrasé.

Deux types de modifications, plus risquées, attendent au lieu d'être appliquées d'emblée :

- **Sensitive file changes** (modifications de fichiers sensibles) affiche le chemin et le contenu proposé, avec **Apply change** (appliquer la modification) et **Discard** (abandonner). Cela couvre les fichiers de dépendances, les lanceurs, les installateurs et les workflows CI. Les modifications ordinaires de TypeScript, React, CSS, prompts, routes et documentation restent possibles sans cette barrière supplémentaire.
- **Dependencies** (dépendances) affiche le paquet npm public exact, la version, l'espace de travail cible, le type de dépendance, l'intégrité du registre et les dépendances directes déclarées, avec **Install** (installer) et **Not now** (pas maintenant). Les commandes d'installation brutes `npm`, `pnpm`, `yarn`, `pip` et assimilées sont bloquées dans son shell, y compris les installations depuis le cache.

Approuver une bibliothèque, c'est faire confiance à son code quand Marinara l'importera ou l'exécutera. Désactiver les scripts de cycle de vie empêche l'exécution au moment de l'installation, mais ne rend pas la bibliothèque inoffensive une fois lancée.

## Créer du contenu avec Decisions

Professor Mari peut écrire des **Activation questions** (questions d'activation) pour les agents, des énoncés **Decision** dans les entrées de lorebook et des prompts conditionnels dans les presets, fiches, lorebooks et prompts d'agents. Elle vérifie le Decision model sélectionné avant d'introduire ces fonctions. Un modèle sélectionné est une information de configuration, pas la preuve que le fournisseur est joignable ou qu'un modèle local chargera correctement.

Si aucun Decision model n'est sélectionné, elle n'ajoute pas de dépendances Decision aux créations et modifications ordinaires. Le contenu Decision existant reste intact lors de modifications sans rapport. Si tu demandes explicitement ce contenu, elle explique le repli pertinent et demande une fois dans ce chat Professor Mari s'il faut continuer. Son registre persiste à la réouverture du chat et dans les conversations dépassant sa fenêtre récente. Une question sans réponse ou un refus ne vaut pas autorisation.

Tu peux lui dire : **"Stop reminding me to set up a Decision model."** Elle arrête dans le chat actuel et peut enregistrer cette préférence comme Memory. Utilise **Turn on** (activer) pour l'appliquer aussi aux futurs chats. Désactiver ou supprimer cette Memory retire la préférence permanente. Supprimer les rappels de configuration ne l'invite pas à ajouter Decisions aux demandes ordinaires.

Avec un modèle sélectionné, elle suit tes Memories et Skills pertinentes activées. Sans préférence de création dans celles-ci, elle demande si tu veux utiliser Decisions et mémoriser ta réponse. Tu peux accepter, refuser ou autoriser uniquement la tâche actuelle. Une Skill expliquant simplement la syntaxe ne vaut pas autorisation. Une demande directe comme "add Decision activation to this entry" autorise déjà cette tâche.

Par défaut, elle en fait un usage limité avec un contrôle temporel adapté : **Sticky** ou **Cooldown** pour les entrées de lorebook, **Trigger Cadence** pour l'activation d'agents et `sticky`, `cooldown` ou `every` dans les conditions de prompt. Sticky et Cooldown réduisent les vérifications répétées après une activation positive ; ils ne les empêchent pas tant qu'un énoncé répond non. `every` saute les vérifications entre les tours prévus et y vaut non ; il ne convient donc pas toujours aux événements fugaces.

Professor Mari cherche aussi à stabiliser le début du prompt assemblé. Elle demande avant d'ajouter du contenu changeant tôt dans un prompt ou du contexte dans l'historique, sauf autorisation déjà donnée par tes instructions ou préférences activées. Il n'existe pas de règle universelle "sans risque après 1 000 tokens" : la réutilisation dépend du fournisseur, du modèle et du préfixe rendu identique. Autoriser Decisions n'autorise pas automatiquement ces placements.

Le mode de permissions et les contrôles de révision habituels s'appliquent toujours. Les Memories enregistrées restent désactivées jusqu'à ton activation. Pour le contexte visible par chaque fonction Decision, ses replis et des exemples, consulte [Modèles de décision](../connections/decision-models.md), [Prompts conditionnels](../prompts/conditional-prompts.md), [Agents personnalisés](../agents/custom-agents.md#activation-questions) et [Entrées de lorebook](../lorebooks/entries.md#decision-activation).

## Les Skills personnalisées

Une Skill est un court document d'instructions que tu rédiges pour changer la façon dont Professor Mari traite un certain type de demande.

Clique sur le bouton **Skills** dans l'en-tête de son chat pour ouvrir le panneau **Professor Mari skills**. De là, tu peux :

- Cliquer sur **New** (nouveau) pour partir d'un modèle de Skill.
- Cliquer sur **Upload** (téléverser) pour ajouter une Skill depuis un fichier `.md` ou `.txt`.
- Activer ou désactiver chaque Skill. Une Skill désactivée existe toujours, mais elle n'est pas utilisée.
- Sélectionner une Skill pour modifier les champs **Name** (nom), **Description** et **Instructions**, puis cliquer sur **Save** (enregistrer). Clique sur **Delete** pour l'effacer.

Tant que tu n'as aucune Skill, le panneau affiche **No custom skills yet**.

## Les souvenirs enregistrés

Professor Mari peut retenir tes préférences durables, pour t'éviter de les répéter à chaque conversation : la mise en forme que tu attends pour tes lorebooks ou tes fiches de personnage, tes conventions de nommage, ou la façon dont elle doit se comporter.

Il y a deux façons de lui donner un souvenir :

- **Dis-le-lui.** Écris par exemple "retiens que mes entrées de lorebook ont toujours pour clés le nom du personnage et son surnom". Elle l'enregistre et affiche un encart de modification avec la formulation exacte. Un souvenir qu'elle enregistre démarre **désactivé** : il ne change rien tant que tu ne l'as pas activé. L'encart propose **Turn on** pour l'activer tout de suite.
- **Ajoute-le toi-même.** Clique sur le bouton **Memories** (souvenirs) dans l'en-tête de son chat pour ouvrir le panneau **Memories**. Tu peux y créer, modifier, activer, désactiver et supprimer tes souvenirs. Autre option : téléverser un fichier `.md` ou texte avec **Upload**, pour transformer son contenu en souvenir.

Elle n'enregistre et ne modifie un souvenir que si **toi** tu le lui demandes, jamais parce qu'un contenu qu'elle a lu (un personnage, un lorebook, un fichier) le lui a dit.

Comment elle s'en sert, et pourquoi cela coûte si peu :

- À chaque tour, elle voit un court **index** de tes souvenirs *activés*, avec leurs seuls titres et descriptions d'une ligne : le coût est quasi nul. Quand un souvenir se rapporte à ce que tu fais, elle en consulte le texte complet et le suit. Son prompt reste donc petit à mesure que tu ajoutes des souvenirs, puisque seul l'index court est toujours présent. Exception : un souvenir marqué **Persistent** (voir plus bas), dont le texte complet est inséré à chaque tour. Ceux-là doivent rester rares et courts. Un souvenir désactivé est conservé mais ignoré : tu peux en désactiver un pour essayer autre chose, puis le réactiver plus tard.
- Les souvenirs enregistrés **priment sur son comportement par défaut** en cas de conflit. Un souvenir qui dit "quand je demande comment faire quelque chose, fais-le" te remet, par exemple, dans le mode modification sans question, et l'emporte sur son habitude de confirmer d'abord.
- Une consigne rare qui doit s'appliquer à *chaque* tour peut passer en **Persistent** : son texte complet reste alors en permanence sous ses yeux. Garde peu de souvenirs persistants, et garde-les courts, puisque chacun occupe son prompt en continu. Réserve-les aux comportements qui doivent s'appliquer en permanence.

Pour gérer tes souvenirs, passe par le panneau **Memories**, ou demande-lui simplement : "de quoi tu te souviens ?", "ajoute les titres à mon souvenir sur la mise en forme des lorebooks" ou "oublie ça".

## L'historique des chats et le bouton Restart

Professor Mari garde ses propres chats, à part. Ils n'apparaissent pas dans ta liste de chats habituelle.

Clique sur le bouton **Chats** dans son en-tête pour ouvrir tes chats Professor Mari enregistrés. Le panneau précise : "Restart saves the current chat here." Clique sur un chat enregistré pour l'ouvrir, le renommer ou le supprimer.

Clique sur le bouton **Restart** (redémarrer) pour commencer une nouvelle conversation avec elle. Restart enregistre d'abord le chat en cours dans la liste **Chats**. Autre option : saisir `/restart` dans le champ de message, avec le même effet. Le message "Professor Mari's previous chat was saved." s'affiche.

Pendant qu'elle travaille, un bouton **Stop** (arrêter) apparaît dans l'en-tête. Clique dessus pour annuler la tâche en cours.

## La bulle de chat flottante

Si tu laisses sa fenêtre de chat ouverte et que tu passes à une autre page, Professor Mari peut te suivre sous la forme d'une petite bulle flottante.

Sur un téléphone ou un écran étroit, elle devient un petit avatar rond que tu peux déplacer. Touche-le pour rouvrir le chat complet. Sur un écran large, c'est une petite fenêtre **Ask Prof. Mari** déplaçable qui apparaît. Chaque version dispose d'un contrôle pour masquer la bulle jusqu'à la fin de la session.

## Confiance et reprise après échec

Ouvre **Aware of** dans l'en-tête de Professor Mari pour voir ce qui accompagne ton prochain message, ce qui reste dans ce chat Professor Mari et comment elle travaille : le modèle avec lequel elle répond, le budget de contexte, et si ses commandes shell s'exécutent en bac à sable. L'en-tête affiche aussi les approbations en attente, les Skills et les Memories. Vérifie-les avant une demande quand tu as besoin de savoir ce que Professor Mari peut lire.

Professor Mari soumet les modifications importantes de l'espace de travail aux règles d'approbation et de révision existantes du serveur. **Aware of** n'accorde aucun accès supplémentaire. Les modifications de fichiers sensibles, les modifications de dépendances, les limites du shell et la validation des données de l'application restent appliquées par le serveur.

Quand une demande échoue, l'historique du chat conserve la raison de l'échec et affiche **Retry** quand la demande peut être renvoyée. Corrige d'abord le problème indiqué (connexion, bac à sable, capacité ou accès distant), puis réessaie. Une nouvelle tentative ne part pas en silence d'une recherche, de la FAQ ou d'un état d'erreur. Elle reste une action de ta part.

## Sa FAQ est distincte du chat

À côté de son encart de chat, l'écran d'accueil affiche un panneau **FAQ**. C'est une liste fixe de questions et de réponses, rédigées à l'avance. Ce n'est pas le chat avec l'IA.

Saisis du texte dans le champ **Search FAQ** pour filtrer les questions. Chaque question porte un tag de catégorie coloré, par exemple **Setup**, **Connections** ou **Game Mode**. Touche une question pour lire sa réponse.

Comme la FAQ est écrite dans l'application, elle ne connaît pas ta configuration réelle. Pour tout ce qui touche à tes propres données ou à l'état actuel, passe par le chat.

## Limites et sécurité

Professor Mari est une assistante, pas la documentation complète. Garde ces limites en tête :

- Elle ne peut pas garantir que ses connaissances intégrées correspondent à ta version exacte de l'application. Quand un point dépend de la version ou a changé récemment, fie-toi d'abord aux guides et aux notes de version.
- Créer du contenu est en général sans risque, puisque rien n'est écrasé. Modifier du contenu existant demande plus d'attention.
- Une dépendance approuvée reste du code tiers, avec le même accès à l'exécution que le code de Marinara qui l'importe. Vérifie le nom du paquet, la version exacte, l'usage et l'intégrité affichés dans l'encart d'approbation.
- Pour les modifications, nomme l'élément exact et le champ exact à changer. Une demande comme "réécris tout ce personnage" est plus risquée que "raccourcis le message d'accueil de Luna, garde sa personnalité telle quelle".
- Pour une création en plusieurs étapes, sers-toi des pastilles de suggestion pour répondre à une question à la fois, plutôt que de fournir tous les champs d'un coup.
- Si elle annonce une tâche terminée mais que l'application ne montre rien, fie-toi à l'application. Termine la tâche toi-même depuis le panneau correspondant.
- Si tu rejoins Marinara depuis un autre appareil au lieu du même ordinateur, ses actions de modification demandent un accès distant configuré. Consulte le guide de l'accès distant.

## Dépannage

- Aucune réponse : vérifie la connexion affichée dans **Aware of**, ou sélectionnes-en une via l'icône de lien. Si aucune n'est configurée, ouvre le panneau **Connections** et ajoutes-en une.
- Un transfert contient le mauvais élément : retire l'élément de contexte, redémarre ou passe au bon chat Professor Mari, puis relance le transfert depuis l'écran d'origine. Le contexte est limité au transfert et au chat Professor Mari en cours.
- Un résultat n'apparaît pas dans un éditeur : utilise **Open** sur l'encart du résultat. Professor Mari a peut-être terminé la commande alors que la liste des ressources n'était pas à jour.
- Une demande échoue : lis l'état de l'échec, corrige le problème de configuration indiqué, puis utilise **Retry**. Ne redemande à Professor Mari depuis la source d'origine que si le contexte lui-même n'est plus correct.
- Message contextuel "You haven't set up a connection yet" : choisis une connexion dans le menu déroulant de l'icône de lien, ou commence par en ajouter une.
- Elle n'arrive pas à lire l'image jointe : le modèle doit prendre en charge les images en entrée. Passe à une connexion dont le modèle sait voir les images.
- Les recherches Fandom échouent : elles ont besoin d'une connexion internet, Fandom étant un site externe.
- Ses actions sont bloquées par une erreur de permission : tu rejoins Marinara par le réseau, pas depuis le même ordinateur. Commence par configurer l'accès distant.

## Guides associés

- [Démarrer avec Marinara Engine](welcome.md)
- [Le tutoriel de premier lancement](tutorial.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Référence des agents à télécharger](../agents/built-in-agents.md)
- [Accès distant : authentification de base et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
