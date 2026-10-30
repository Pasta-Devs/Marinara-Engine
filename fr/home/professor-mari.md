# Professor Mari, ton assistante intégrée

Professor Mari est l'assistante intégrée de Marinara Engine, sur l'écran d'accueil. Ce guide explique où la trouver, ce qu'elle sait faire, comment elle garde ses modifications réversibles et comment régler les problèmes courants.

<a id="where-to-find-her"></a>

## Où la trouver

Professor Mari vit sur l'écran d'accueil. L'écran d'accueil, c'est ce que tu vois quand aucun chat n'est ouvert.

Repère le widget **Professor Mari** avec son pixel art, puis clique sur **Ask Professor Mari** (demander à Professor Mari) pour ouvrir sa fenêtre de chat complète. L'onglet **Professor** en haut de l'accueil l'ouvre aussi. Sa fenêtre s'ouvre dans Search (la recherche de l'application) : tu peux donc aussi la joindre depuis n'importe quel écran. Saisis du texte dans le champ de Search et choisis **Ask Prof. Mari** (demander à Prof. Mari), appuie sur Ctrl+J (Cmd+J sur Mac), ou tire vers le bas depuis la barre supérieure sur téléphone. Une ligne d'état dans l'en-tête de sa fenêtre affiche **Ready to help** quand elle est disponible, ou **Working on it...** quand elle travaille.

Tu lui parles en langage courant. Saisis un message dans le champ, puis appuie sur Enter pour l'envoyer. Appuie sur Shift et Enter ensemble pour aller à la ligne. Si tu désactives **Enter sends to Professor Mari** (Enter envoie à Professor Mari) dans ses réglages, Enter va à la ligne et Ctrl+Enter (Cmd+Enter sur Mac) envoie le message. Les touches font un peu plus pendant qu'elle travaille, comme décrit dans [Envoyer des messages pendant qu'elle travaille](#sending-messages-while-she-works).

Le tout premier message que tu lui envoies débloque le succès **Hello World**.

Une fine ligne en bas de la barre supérieure de l'application indique aussi son état depuis n'importe quel écran : elle ondule pendant que Professor Mari travaille, devient verte quand elle a terminé, dorée tant qu'une approbation attend, ou rouge si la dernière exécution a échoué. Elle disparaît dès que tu ouvres son chat. Cette ligne reste éteinte tant que le réglage **Ask Professor Mari from Search** (demander à Professor Mari depuis Search) est désactivé. Quand sa fenêtre est fermée, une petite pastille dans la barre supérieure affiche le même état, sous la forme **Working**, **Needs you**, **Done** ou **Failed**. Clique sur la pastille pour revenir à son chat. Tous les réglages de Professor Mari se trouvent sur la page des réglages de Search et de Professor Mari : ouvre-la avec l'icône d'engrenage dans Search, ou via **Settings** (Paramètres) > **General** (Général) > **Search and Professor Mari settings** (réglages de Search et de Professor Mari) > **Open** (ouvrir).

Sur ordinateur, tu peux aussi y changer la taille de sa fenêtre. Utilise les curseurs **Height** (hauteur) et **Width** (largeur) sous **Professor Mari window** (fenêtre de Professor Mari). Les curseurs sous **Search window** (fenêtre de Search) font de même pour Search ; sa hauteur démarre sur **Automatic** (automatique). Sur téléphone, les deux fenêtres occupent toujours tout l'écran.

## Demander à Professor Mari depuis ton travail en cours

Professor Mari est bien plus qu'une boîte à questions. Elle explique l'application, t'aide à la configurer et fabrique des choses pour toi quand tu le demandes.

Tu peux ouvrir Professor Mari depuis l'endroit où tu as besoin d'aide. Ces points d'entrée créent un brouillon modifiable et y joignent un petit résumé de contexte typé. Tu peux retirer le contexte joint avant d'envoyer le message.

- Les éditeurs **Character** (personnage), **Persona**, **Lorebook** et **Preset** : pose-lui une question sur la ressource ouverte ou sur un champ sélectionné.
- Les réponses de la **FAQ** : utilise **Ask Prof. Mari about this** (demander à Prof. Mari à ce sujet) pour inclure comme point de départ la question correspondante et sa réponse écrite.
- **Search** : appuie sur `Cmd/Ctrl+K`, sélectionne un résultat, puis utilise **Ask Prof. Mari** pour inclure ce résultat dans le brouillon. Utiliser Search n'envoie aucune requête au modèle, sauf si les réponses rapides sont activées : voir **Quick answers in Search** (réponses rapides dans Search) plus bas.
- **Recent Chats** (chats récents) et les autres états d'erreur : utilise **Ask Professor Mari** à côté de **Try again** (réessayer) pour envoyer la description de l'erreur et l'action de réparation demandée.
- Le chat habituel avec le personnage Professor Mari et le chat de l'espace de travail de l'écran d'accueil utilisent le même format de transfert.

Les éléments joints apparaissent sous forme de pastilles **Context** (contexte) au-dessus de son champ de message. Retire un élément de contexte quand il n'est pas pertinent. Une fois le message envoyé, Professor Mari récupère côté serveur le contenu plus volumineux des ressources, dans la limite du budget de contexte. Elle ne reçoit pas une ressource entière simplement parce que tu as ouvert un éditeur.

Demande-lui de l'aide pour tout ceci :

- Expliquer un réglage, un mode ou un concept avant que tu ne changes quoi que ce soit.
- Créer ou modifier un personnage. Un personnage est une fiche qui donne à l'IA un nom, une personnalité et une voix. Elle peut aussi écrire l'[accueil interactif](../characters/interactive-onboarding.md) d'une fiche, c'est-à-dire les questions auxquelles les joueurs répondent pour construire leur persona.
- Créer ou modifier un persona. Le persona est l'identité que tu incarnes dans un chat, le "toi" de l'histoire.
- Remplir ou modifier la [fiche d'ensemble de règles](../characters/colors-and-stats.md#ruleset-sheets) d'un personnage ou d'un persona pour un ensemble de règles de Game Mode installé : valeurs, entraînement, champs et lignes de liste comme l'équipement. Elle utilise les noms et limites de l'ensemble de règles lui-même, et la modification est refusée, avec la raison, quand une valeur ne respecte pas cet ensemble de règles.
- Créer ou modifier un lorebook. Un lorebook est un recueil de notes sur ton univers, que l'IA reprend quand elles sont pertinentes.
- Créer ou modifier un thème, un agent, un preset de prompt ou un brouillon de Personal Extension. Professor Mari est la seule autrice d'extension par défaut. Ses brouillons restent désactivés tant que tu n'as pas donné ton accord. Inspecte le code en bac à sable, puis examine les permissions actives demandées sur les fiches de personnage ou les personas. Approuve enfin le hash exact dans **Settings** > **Addons**.
- Modifier une seule partie d'un preset de prompt, sur place. Elle sait lister les sections, les groupes de prompt et les variables de choix d'un preset, puis lire n'importe lequel d'entre eux en entier. Elle ajoute, change ou retire ce seul morceau, par exemple une ligne dans une section précise, au lieu de créer ou de remplacer le preset entier.
- Comparer les 33 agents et packs de fonctionnalités officiels à télécharger, expliquer quels modes ils prennent en charge et conseiller ceux qui correspondent à ton objectif. Elle distingue ce que propose le catalogue de ce qui est réellement installé, oriente vers **Agents → Agent Organizer (organisateur d’agents)**  quand il le faut, et sait que les sources des packs et le catalogue complet se trouvent sur [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).
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
- Si une réponse échoue, l'encart en donne la raison, par exemple que le modèle n'a pas répondu. **Try again** et **Continue with Prof. Mari** sont toujours là. **Choose a model** (choisir un modèle) n'apparaît que si une clé ou un modèle manque. Le message propre au fournisseur se trouve sous **Details** (détails).
- Les réponses rapides restent désactivées tant que tu ne les as pas activées avec **Quick answers in Search** dans le même groupe.

## Les pastilles de suggestion guidées

Dans un chat Professor Mari vide, des pastilles de démarrage comme **Create a Character**, **Create a Lorebook** et **Create a Persona** lancent les tâches les plus courantes. Pendant une création ou une modification guidée, les pastilles changent pour coller à l'étape suivante. Quand tu cliques sur une pastille, elle remplit le brouillon du champ de saisie ; tu peux le retoucher avant de l'envoyer.

Les parcours guidés posent une seule question à la fois, au lieu d'afficher un long formulaire d'un coup.

Quand une demande laisse de vraies décisions ouvertes, Professor Mari peut s'arrêter et poser ses questions sur une carte de questions sous sa réponse : jusqu'à quatre questions, une à la fois, chacune avec quelques options dont celle qu'elle recommande est repérée. Certaines questions acceptent plusieurs réponses. Choisis une option ou écris la tienne, puis appuie sur **Submit** (valider) : tes réponses partent comme ton message suivant, donc rien n'est caché et tu vois ce qu'on lui a dit. Son tour se termine quand elle pose sa question, et rien de ce qu'elle a proposé en même temps ne s'exécute avant que tu aies répondu. Tu peux aussi ignorer la carte et écrire dans le champ de message ; ton message suivant y répond.

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

Clique sur le bouton de connexion à côté du trombone. Il affiche une icône de lien et le nom de la connexion qu'elle utilise, ou **Select connection** (choisir une connexion) quand aucune n'est choisie. Il ouvre la liste **Connections** (Connexions). Choisis n'importe quelle connexion de génération de texte déjà configurée. Si tu as téléchargé le modèle local intégré, il apparaît ici aussi sous **Local Model (sidecar)**. Si l'application connaît le nom du modèle, ce nom s'affiche entre parenthèses à la place. Ton choix est enregistré avec tes préférences de l'application.

Le même menu liste aussi les modèles de la connexion choisie. Clique sur un modèle pour l'utiliser. Le modèle est enregistré dans la connexion, comme dans un chat normal : les autres chats qui utilisent cette connexion passent donc aussi à ce modèle. Sur téléphone ou dans une fenêtre étroite, touche une connexion pour y basculer, ou touche la flèche au bout de sa ligne pour voir d'abord ses modèles. Le modèle local intégré n'a pas de liste de modèles.

Si tu n'as encore aucune connexion, la liste affiche **Add a connection** (ajouter une connexion) à la place. Clique dessus pour en créer une. Si tu essaies d'envoyer un message sans connexion, la liste **Connections** s'ouvre toute seule pour que tu en choisisses une.

Pour un déroulé complet, consulte le guide des connexions en fin de page.

## Essayer le runtime Pi (expérimental)

Professor Mari peut travailler de deux façons. **Classic** est le mode par défaut. **Pi** est un essai : elle réfléchit davantage avant d'agir et mène à bien des tâches plus longues.

Pour changer, ouvre **Search and Professor Mari settings** et modifie **Runtime** (environnement d'exécution), sous **Permissions mode** (mode de permissions). Le changement s'applique dès sa prochaine réponse. Ton mode de permissions, les encarts de modification et **Undo** fonctionnent de la même façon dans les deux.

Pi fonctionne avec toutes les connexions, y compris le modèle local. Si Professor Mari se comporte de façon étrange avec Pi, reviens à Classic.

## Changer son apparence

Ouvre **Search and Professor Mari settings** et fais défiler jusqu'à **Appearance** (apparence). Choisis une apparence pour elle, par exemple **Basic**, **Prof. Mari loves Dottore** ou **Safari Prof. Mari**. Sa nouvelle apparence s'affiche dans son chat, dans Search, sur l'accueil et dans la barre supérieure. Certaines apparences se débloquent après un certain temps de jeu. Une apparence verrouillée indique combien d'heures tu as joué jusqu'ici.

## Le menu du trombone

Clique sur le bouton trombone, intitulé **Attach** (joindre), pour ouvrir un menu en trois sections :

- **Attach** : **Attach files or photos** (joindre des fichiers ou des photos), **Add chat history** (ajouter l'historique d'un chat – tu partages avec elle l'un de tes chats passés) et **View attached context** (voir le contexte joint).
- **Reference** : **Link with @** (lier avec @) saisit `@` dans le champ de message et ouvre la liste de liens décrite plus bas.
- **Mari** : **New chat** (nouveau chat), **Chat history**, **Skills**, **Memories** (souvenirs), **Model** (modèle) et **Permissions**. **Pending approvals** (approbations en attente) s'affiche ici tant qu'une modification attend ta décision.

Les mêmes commandes se saisissent aussi avec `/`, comme décrit dans [Commandes avec /](#commands-with-).

## Joindre des fichiers

Choisis **Attach files or photos** dans le menu du trombone, ou saisis `/attach`, pour ajouter un fichier à ton message.

Elle accepte les images, les fichiers PDF et les fichiers texte courants comme `.txt`, `.md`, `.json`, `.csv` et `.log`. Chaque fichier peut peser jusqu'à 20 Mo. Avant l'envoi, les fichiers joints apparaissent sous forme de pastilles supprimables au-dessus du champ de message. Tu peux aussi coller une capture d'écran ou un fichier copié directement dans le champ de message, avec **Ctrl+V** ou la fonction coller de ton téléphone.

Pour qu'elle puisse lire une image, le modèle de la connexion choisie doit prendre en charge les images en entrée.

## Lier des éléments avec @

Saisis `@` dans le champ de message pour lui indiquer un élément de ta bibliothèque, afin qu'elle n'ait pas à le chercher. Une liste s'ouvre pendant que tu écris, regroupée en **Characters** (personnages), **Personas**, **Lorebooks**, **Presets**, **Skills**, **Memories**, **Chats**, **Agents** (agents) et **Docs**. Continuer à écrire réduit la liste ; les noms avec des espaces n'ont pas besoin de guillemets (`@Alice in Wonderland`).

- Utilise les flèches pour te déplacer, **Enter** ou **Tab** pour choisir et **Escape** pour fermer la liste. Sur un lorebook, la flèche droite affiche ses **Entries** (entrées) pour que tu puisses lier une seule entrée ; la flèche gauche revient en arrière.
- Quand sa fenêtre se trouve à côté d'un éditeur, la première ligne, **Open beside me** (ouvrir à côté de moi), lie ce que cet éditeur a d'ouvert.
- À côté de l'éditeur de personnage, la ligne **Open beside me** a un › (ou appuie sur ArrowRight) qui liste les **Fields** (champs) de cet éditeur, et écrire quelque chose après `@` liste directement ceux qui correspondent. En choisir un (`@scen` → Scenario) change le champ sur lequel elle travaille, comme si tu avais cliqué dedans avant de l'ouvrir. Il remplace la pastille de champ dans sa ligne de contexte, et l'éditeur défile jusqu'à ce champ. Un champ n'est pas un lien : aucun texte `@` ne reste dans ton message. **Onboarding** (accueil) est un seul champ pour tout le bloc : tant que c'est son champ, chaque message envoie ce que renvoie `character.onboarding.get` (les questions, les éventuels problèmes et un exemple de persona), si bien qu'elle part du bloc tel qu'il est enregistré.
- Un nom choisi est mis en évidence dans ton message et s'affiche sous forme de pastille au-dessus du champ de message. Si tu modifies ou supprimes le nom, le lien disparaît avec lui ; le **×** de la pastille retire le lien mais garde ton texte.
- Dans un texte ordinaire, **Tab** complète un nom qu'elle suggère en gris. Une petite indication **Tab to link** (Tab pour lier) s'affiche alors juste après : appuie de nouveau sur **Tab** ou clique sur l'indication pour transformer le nom en lien. Sur un écran tactile, touche le nom gris pour le compléter, puis touche **Tap to link** (touche pour lier) ; sur un ordinateur portable tactile, l'indication devient **Tab or tap to link** (Tab ou touche pour lier).

Ce qu'envoie chaque lien :

| Lien | Ce qu'elle reçoit |
| --- | --- |
| Personnage, persona, preset | L'élément entier, tel qu'elle le lirait elle-même |
| Lorebook | Ses réglages et la liste de ses entrées (lie une entrée pour en obtenir le texte complet) |
| Entrée de lorebook | L'entrée, plus le lorebook auquel elle appartient |
| Skill | Les instructions de ta propre Skill. Une Skill intégrée s'ouvre à la place comme son manuel pour ce message. Si tu lies la Skill d'accueil interactif avec un personnage, elle reçoit aussi le bloc d'accueil interactif de ce personnage |
| Souvenir | Le texte complet du souvenir, même désactivé. Les souvenirs **Persistent** ne sont pas listés, puisqu'elle les a toujours |
| Chat | Les détails du chat et ses 30 derniers messages |
| Agent | Les réglages de l'agent |
| Page de documentation | La page entière de cette documentation |

Un lien est envoyé **une seule fois**, avec le message dans lequel tu l'ajoutes. Aux tours suivants, elle ne voit qu'une note d'une ligne indiquant que tu l'as lié, et le relit si besoin. Un message porte jusqu'à 8 liens. S'ils dépassent environ un quart du contexte de ta connexion (60 000 caractères au maximum), les derniers ne sont pas envoyés : elle reçoit à la place une note et peut les lire elle-même.

Les éléments liés sont traités comme de l'information, jamais comme des instructions : une fiche de personnage ou une entrée de lorebook ne peut pas lui dire quoi faire.

<a id="commands-with-"></a>

## Commandes avec /

Saisis `/` au début d'une ligne pour lister ses commandes. Continue d'écrire pour filtrer, puis appuie sur **Enter** pour en lancer une. Le `/word` que tu as saisi est retiré de ton message.

| Commande | Ce qu'elle fait |
| --- | --- |
| `/new` | Démarre un nouveau chat ; le chat en cours est enregistré dans **Chats** (`/restart` fonctionne aussi) |
| `/history` | Ouvre tes chats passés avec elle |
| `/skills` | Ouvre le panneau **Skills** |
| `/memories` | Ouvre le panneau **Memories** |
| `/context` | Affiche ce qui est joint à ce chat |
| `/attach` | Choisit des fichiers ou des photos à envoyer |
| `/model` | Choisit la connexion qu'elle utilise |
| `/permissions` | Choisit ce qu'elle a le droit de modifier |
| `/approvals` | Ouvre les modifications qui attendent ta décision (seulement tant qu'une est en attente) |

La liste de `/` affiche aussi tes **Skills** et tes **Memories**. Choisir l'un d'eux le lie, comme avec `@`.

## Réviser ses modifications

Quand Professor Mari modifie quelque chose, elle enregistre le changement aussitôt et affiche un encart de modification sous sa réponse. L'encart liste chaque champ modifié. Une modification de texte montre les anciens et les nouveaux mots, et un lorebook montre ses entrées. Une modification plus profonde dans un élément, comme l'accueil interactif d'une fiche, reçoit son propre champ qui nomme ce qui a changé. Ouvre **Show all** (tout afficher) pour voir tous les champs. **Technical details** (détails techniques) affiche la commande brute.

L'encart propose une seule action :

- **Undo** (annuler) remet en place la version enregistrée précédente. Toute modification peut être annulée, quel que soit le mode de permissions. Le mode de permissions décide seulement si elle demande d'abord.
- Une modification qui n'a pas été enregistrée affiche **Not saved** et la raison. **Try again** lui renvoie la demande.
- L'encart n'affiche la date limite d'annulation, **Undo until**, que pendant les dernières 24 heures. Une copie d'annulation dure jusqu'à 14 jours, et seules les 50 plus récentes sont conservées. Passé ce délai, la modification reste en place et l'encart indique **Undo closed**.

Une modification qui t'attend fonctionne autrement. Une modification retenue (en mode Manual, ou pour un fichier sensible ou une dépendance) affiche **Apply** (appliquer) et **Don't apply** (ne pas appliquer). Une suppression affiche **Delete** (supprimer) et **Put back** (remettre en place). Search ne liste pas ses modifications : ouvre Professor Mari pour les voir, les appliquer ou les annuler.

- Un encart appartient au chat Professor Mari dans lequel elle a effectué la modification. Un nouveau chat démarre sans les encarts des autres chats. Supprimer un chat conserve ses modifications et retire ses encarts. Une modification effectuée avec la commande `mari` dans un terminal n'appartient à aucun chat : son encart apparaît donc dans tous les chats Professor Mari.
- Une modification qui laisserait tout à l'identique n'est pas enregistrée et ne reçoit aucun encart.
- Une étape de sa liste de travail qui affiche **Previewed** et se termine par **· not saved** n'était qu'un aperçu. Rien n'a changé et aucun encart n'est créé.
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

Tu peux lui dire : **"Arrête de me rappeler de configurer un modèle de décision."** Elle arrête dans le chat actuel et peut enregistrer cette préférence comme Memory. Utilise **Turn on** (activer) pour l'appliquer aussi aux futurs chats. Désactiver ou supprimer cette Memory retire la préférence permanente. Supprimer les rappels de configuration ne l'invite pas à ajouter Decisions aux demandes ordinaires.

Avec un modèle sélectionné, elle suit tes Memories et Skills pertinentes activées. Sans préférence de création dans celles-ci, elle demande si tu veux utiliser Decisions et mémoriser ta réponse. Tu peux accepter, refuser ou autoriser uniquement la tâche actuelle. Une Skill expliquant simplement la syntaxe ne vaut pas autorisation. Une demande directe comme "ajoute une activation Decision à cette entrée" autorise déjà cette tâche.

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

### Skills intégrées

Sous tes propres Skills, dans **Always on** (toujours actif), le panneau liste les Skills fournies avec Marinara. Chacune porte la mention **Built-in**. Ce sont ses manuels pour les personnages et les personas, les lorebooks, l'accueil interactif, les presets, les thèmes, les Personal Extensions, les widgets de l'accueil, Decisions et la réparation d'une réponse. Elle en lit une quand une demande le nécessite : elles n'occupent donc pas de place dans chaque message.

Une Skill intégrée est en lecture seule : tu ne peux ni la modifier, ni la désactiver, ni la supprimer, et une mise à jour de l'application la remplace par sa nouvelle version. Pour changer sa façon de traiter un sujet, copie les instructions de cette Skill dans une nouvelle Skill à toi.

Par défaut, dans chaque chat, sa première modification dans un domaine couvert par une Skill intégrée est refusée tant qu'elle n'a pas lu cette Skill. Cela aide les petits modèles et les modèles locaux. Les grands modèles s'en sortent généralement sans cette obligation : tu peux donc la désactiver pour leur épargner une étape. Ouvre **Search and Professor Mari settings** et désactive **Read the handbook before the first write** (lire le manuel avant la première écriture), sous **Runtime**. Toi seul peux changer ce réglage ; Professor Mari ne le peut pas.

## Les souvenirs enregistrés

Professor Mari peut retenir tes préférences durables, pour t'éviter de les répéter à chaque conversation : la mise en forme que tu attends pour tes lorebooks ou tes fiches de personnage, tes conventions de nommage, ou la façon dont elle doit se comporter.

Il y a deux façons de lui donner un souvenir :

- **Dis-le-lui.** Écris par exemple "retiens que mes entrées de lorebook ont toujours pour clés le nom du personnage et son surnom". Elle l'enregistre et affiche un encart de modification avec la formulation exacte. Un souvenir qu'elle enregistre démarre **désactivé** : il ne change rien tant que tu ne l'as pas activé. L'encart propose **Turn on** pour l'activer tout de suite.
- **Ajoute-le toi-même.** Clique sur le bouton **Memories** dans l'en-tête de son chat pour ouvrir le panneau **Memories**. Tu peux y créer, modifier, activer, désactiver et supprimer tes souvenirs. Autre option : téléverser un fichier `.md` ou texte avec **Upload**, pour transformer son contenu en souvenir.

Elle n'enregistre et ne modifie un souvenir que si **toi** tu le lui demandes, jamais parce qu'un contenu qu'elle a lu (un personnage, un lorebook, un fichier) le lui a dit.

Comment elle s'en sert, et pourquoi cela coûte si peu :

- À chaque tour, elle voit un court **index** de tes souvenirs *activés*, avec leurs seuls titres et descriptions d'une ligne : le coût est quasi nul. Quand un souvenir se rapporte à ce que tu fais, elle en consulte le texte complet et le suit. Son prompt reste donc petit à mesure que tu ajoutes des souvenirs, puisque seul l'index court est toujours présent. Exception : un souvenir marqué **Persistent** (voir plus bas), dont le texte complet est inséré à chaque tour. Ceux-là doivent rester rares et courts. Un souvenir désactivé est conservé mais ignoré : tu peux en désactiver un pour essayer autre chose, puis le réactiver plus tard.
- Les souvenirs enregistrés **priment sur son comportement par défaut** en cas de conflit. Un souvenir qui dit "quand je demande comment faire quelque chose, fais-le" te remet, par exemple, dans le mode modification sans question, et l'emporte sur son habitude de confirmer d'abord.
- Une consigne rare qui doit s'appliquer à *chaque* tour peut passer en **Persistent** : son texte complet reste alors en permanence sous ses yeux. Garde peu de souvenirs persistants, et garde-les courts, puisque chacun occupe son prompt en continu. Réserve-les aux comportements qui doivent s'appliquer en permanence.

Pour gérer tes souvenirs, passe par le panneau **Memories**, ou demande-lui simplement : "de quoi tu te souviens ?", "ajoute les titres à mon souvenir sur la mise en forme des lorebooks" ou "oublie ça".

## L'historique des chats et le bouton Restart

Professor Mari garde ses propres chats, à part. Ils n'apparaissent pas dans ta liste de chats habituelle.

Clique sur le bouton **Chats** dans son en-tête pour ouvrir tes chats Professor Mari enregistrés. Quand la liste est vide, le panneau précise : "New chat keeps this one here." Utilise **Search Prof. Mari chats** (rechercher dans les chats de Prof. Mari) pour en trouver un. Clique sur un chat enregistré pour l'ouvrir, le renommer ou le supprimer.

Clique sur le bouton **New chat** pour commencer une nouvelle conversation avec elle. Il enregistre d'abord le chat en cours dans la liste **Chats**. Autre option : saisir `/new` (ou `/restart`) dans le champ de message, avec le même effet. Le message "Professor Mari's previous chat was saved." s'affiche.

Pendant qu'elle travaille, un bouton **Stop** (arrêter) se trouve à côté du bouton d'envoi. Clique dessus pour annuler la tâche en cours.

<a id="sending-messages-while-she-works"></a>

### Envoyer des messages pendant qu'elle travaille

Le champ de message reste ouvert pendant qu'elle travaille, et c'est toi qui choisis quand ton message lui parvient :

- **Send now** (envoyer maintenant) arrive à sa prochaine étape, sans l'arrêter. Sa réponse jusque-là est enregistrée, ton message apparaît en dessous, et elle continue en tenant compte de ce que tu as dit. C'est ainsi que tu la corriges en pleine tâche sans perdre le travail déjà fait.
- **Queue for later** (mettre en file pour plus tard) attend dans une liste au-dessus du champ, repérée par **Sends when she finishes** (envoyé quand elle a terminé). Quand elle termine proprement, elle prend les messages en attente un par un, dans l'ordre.

| | Send now | Queue for later |
|---|---|---|
| **Enter sends** activé (par défaut) | Enter | Ctrl+Enter |
| **Enter sends** désactivé | Ctrl+Enter | Ctrl+Shift+Enter |

Sur Mac, utilise Cmd à la place de Ctrl. Shift+Enter ajoute toujours une nouvelle ligne. La petite flèche à côté du bouton d'envoi propose les deux choix, ce qui aide sur téléphone.

Send now sert uniquement pour du texte seul, dans l'exécution qu'elle a déjà en cours. Un message avec des fichiers, des liens `@` ou un champ que tu lui as confié est mis en file à la place, de même qu'un message sur un autre sujet ou envoyé après un changement du mode de permissions. Un court avis te le signale. Un message en attente sans ces particularités a son propre bouton **Send now**. Clique sur le **X** d'un message pour le retirer. Un chat peut contenir jusqu'à 20 messages en attente.

Si elle a déjà fait quelques étapes mais n'a encore rien dit quand ton message arrive, ses étapes sont conservées, avec une ligne estompée **Still working**. Send now ne peut pas lui donner plus d'étapes que ce qu'une exécution autorise. Si elle a atteint la limite, ou si elle s'est arrêtée pour te poser une question, ton message reste dans la liste.

Les messages en attente ne partent pas d'eux-mêmes dans ces cas :

- **Tu appuies sur Stop.** Ils reviennent dans le champ de message, pour que tu puisses les modifier ou les renvoyer.
- **Elle t'attend**, pour une approbation ou la réponse à une question. Ils affichent **Held** (retenu), avec un bouton **Send** (envoyer).
- **L'exécution a échoué, ou l'application a redémarré.** Ils affichent aussi **Held**. Rien n'est perdu.

Un message retenu le reste jusqu'à ce que tu l'envoies ou le retires. **Send** n'envoie que celui-là, et écrire un nouveau message ne libère pas les autres.

`/restart` et `/title` ne font rien pendant qu'elle travaille, et ils restent dans le champ jusqu'à ce qu'elle ait fini.

<a id="her-to-do-list"></a>

### Sa liste de tâches

Sur un travail plus long, elle tient pour elle-même une courte liste d'étapes. Elle se trouve sous son dernier message, avec un compteur comme **2 of 5** (2 sur 5) ; l'étape en cours tourne pendant qu'elle travaille, et les étapes terminées sont barrées. Tu ne peux pas la modifier. Elle est là pour que tu voies où elle en est, et elle la met à jour au fur et à mesure. Dès que tu écris après la réponse qui l'a enregistrée, la liste est estompée et affiche **Plan from before your last message** (plan antérieur à ton dernier message). Elle disparaît après sa prochaine réponse qui n'y touche pas.

## Quitter sa fenêtre

Tu peux fermer sa fenêtre et continuer à utiliser l'application pendant qu'elle travaille. La ligne et la pastille de la barre supérieure indiquent où elle en est, comme décrit dans [Où la trouver](#where-to-find-her). Clique sur la pastille pour revenir à son chat.

## Confiance et reprise après échec

Ouvre **Context** dans l'en-tête de Professor Mari pour voir ce qui accompagne ton prochain message, ce qui reste dans ce chat Professor Mari et comment elle travaille : le modèle avec lequel elle répond, le budget de contexte, et si ses commandes shell s'exécutent en bac à sable. L'en-tête affiche aussi les approbations en attente, les Skills et les Memories. Vérifie-les avant une demande quand tu as besoin de savoir ce que Professor Mari peut lire.

Professor Mari soumet les modifications importantes de l'espace de travail aux règles d'approbation et de révision existantes du serveur. **Context** n'accorde aucun accès supplémentaire. Les modifications de fichiers sensibles, les modifications de dépendances, les limites du shell et la validation des données de l'application restent appliquées par le serveur.

Quand une demande échoue, l'historique du chat conserve la raison de l'échec et affiche **Retry** quand la demande peut être renvoyée. Corrige d'abord le problème indiqué (connexion, bac à sable, capacité ou accès distant), puis réessaie. Si ta question n'a pas été enregistrée, elle revient dans le champ de message avec ses fichiers : tu peux donc la modifier d'abord. **Retry** et **Retry with another model** (réessayer avec un autre modèle) envoient ensuite ce qui se trouve dans le champ. Une nouvelle tentative ne part pas en silence d'une recherche, de la FAQ ou d'un état d'erreur. Elle reste une action de ta part.

## Sa FAQ est distincte du chat

Clique sur le marque-page **FAQ** de l'écran d'accueil, ou sur **Read FAQ** (lire la FAQ) dans le widget **Learn the engine** (découvrir l'application), pour ouvrir **Professor Mari's FAQ** (la FAQ de Professor Mari). C'est une liste fixe de questions et de réponses, rédigées à l'avance. Ce n'est pas le chat avec l'IA.

Saisis du texte dans le champ **Search FAQ** pour filtrer les questions. Chaque question porte un tag de catégorie coloré, par exemple **Setup**, **Connections** ou **Game Mode**. Touche une question pour lire sa réponse.

Comme la FAQ est écrite dans l'application, elle ne connaît pas ta configuration réelle. Pour tout ce qui touche à tes propres données ou à l'état actuel, passe par le chat.

## Limites et sécurité

Professor Mari est une assistante, pas la documentation complète. Garde ces limites en tête :

- Elle ne peut pas garantir que ses connaissances intégrées correspondent à ta version exacte de l'application. Quand un point dépend de la version ou a changé récemment, fie-toi d'abord aux guides et aux notes de version.
- Créer du contenu est en général sans risque, puisque rien n'est écrasé. Modifier du contenu existant demande plus d'attention.
- Une dépendance approuvée reste du code tiers, avec le même accès à l'exécution que le code de Marinara qui l'importe. Vérifie le nom du paquet, la version exacte, l'usage et l'intégrité affichés dans l'encart d'approbation.
- Pour les modifications, nomme l'élément exact et le champ exact à changer. Une demande comme "réécris tout ce personnage" est plus risquée que "raccourcis le message d'accueil de Luna, garde sa personnalité telle quelle".
- Pour une création en plusieurs étapes, réponds à sa carte de questions ou sers-toi des pastilles de suggestion plutôt que de fournir tous les champs d'un coup.
- Si elle annonce une tâche terminée mais que l'application ne montre rien, fie-toi à l'application. Termine la tâche toi-même depuis le panneau correspondant.
- Si tu rejoins Marinara depuis un autre appareil au lieu du même ordinateur, ses actions de modification demandent un accès distant configuré. Consulte le guide de l'accès distant.

## Dépannage

- Aucune réponse : vérifie la connexion affichée dans **Context**, ou sélectionnes-en une avec le bouton de connexion. Si aucune n'est configurée, ouvre le panneau **Connections** et ajoutes-en une.
- Un transfert contient le mauvais élément : retire l'élément de contexte, redémarre ou passe au bon chat Professor Mari, puis relance le transfert depuis l'écran d'origine. Le contexte est limité au transfert et au chat Professor Mari en cours.
- Un résultat n'apparaît pas dans un éditeur : utilise **Open** sur l'encart du résultat. Professor Mari a peut-être terminé la commande alors que la liste des ressources n'était pas à jour.
- Une demande échoue : lis l'état de l'échec, corrige le problème de configuration indiqué, puis utilise **Retry**. Ne redemande à Professor Mari depuis la source d'origine que si le contexte lui-même n'est plus correct.
- La liste **Connections** s'ouvre quand tu appuies sur envoyer : aucune connexion n'est encore choisie. Choisis-en une dans la liste, ou commence par utiliser **Add a connection**.
- Elle n'arrive pas à lire l'image jointe : le modèle doit prendre en charge les images en entrée. Passe à une connexion dont le modèle sait voir les images.
- Les recherches Fandom échouent : elles ont besoin d'une connexion internet, Fandom étant un site externe.
- Ses actions sont bloquées par une erreur de permission : tu rejoins Marinara par le réseau, pas depuis le même ordinateur. Commence par configurer l'accès distant.

## Guides associés

- [Démarrer avec Marinara Engine](welcome.md)
- [Le tutoriel de premier lancement](tutorial.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Référence des agents à télécharger](../agents/built-in-agents.md)
- [Accès distant : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
