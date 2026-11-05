# Professor Mari, ton assistante intégrée

Professor Mari est l'assistante intégrée de l'écran d'accueil. Elle explique l'application, t'aide à la configurer, et crée ou modifie pour toi des personnages, des personas, des lorebooks et des presets. Tu peux annuler ses modifications depuis l'encart de modification pendant une durée limitée (voir [Réviser ses modifications](#reviewing-her-changes)).

<a id="where-to-find-her"></a>

## Où la trouver

1. Va sur l'écran d'accueil. Il s'affiche quand aucun chat n'est ouvert.
2. Clique sur **Ask Professor Mari** (demander à Professor Mari) dans le widget **Professor Mari**, ou clique sur l'onglet **Professor**.

Sa fenêtre s'ouvre. Tu peux aussi la joindre depuis n'importe quel écran : saisis du texte dans Search (la recherche de l'application) et choisis **Ask Prof. Mari** (demander à Prof. Mari), appuie sur <kbd>Ctrl</kbd>+<kbd>J</kbd> (<kbd>⌘</kbd>+<kbd>J</kbd> sur un Mac), ou tire vers le bas depuis la barre supérieure sur un téléphone. Son en-tête affiche **Ready to help** quand elle est disponible et **Working on it...** pendant qu'elle travaille.

Écris ton message en langage courant et appuie sur <kbd>Enter</kbd>. <kbd>Shift</kbd>+<kbd>Enter</kbd> ajoute une nouvelle ligne. Si tu désactives **Enter sends to Professor Mari** (Enter envoie à Professor Mari) dans ses réglages, <kbd>Enter</kbd> ajoute une nouvelle ligne et <kbd>Ctrl</kbd>+<kbd>Enter</kbd> envoie. Ton premier message débloque le succès **Hello World**.

Tous ses réglages se trouvent dans **Settings → General → Search and Professor Mari settings → Open** (Paramètres → Général → réglages de Search et de Professor Mari → ouvrir), ou derrière l'engrenage de Search. Sur ordinateur, les curseurs **Height** (hauteur) et **Width** (largeur) sous **Professor Mari window** (fenêtre de Professor Mari) changent la taille de sa fenêtre. Sur téléphone, sa fenêtre occupe tout l'écran.

## Créer un personnage avec Mari

Avant de commencer : ajoute un compte de génération de texte. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md) et [Choisir un compte pour elle](#pick-an-account-for-her).

1. Ouvre sa fenêtre (voir plus haut).
2. Si le chat contient déjà des messages, clique d'abord sur **New chat** (nouveau chat). Le chat en cours est enregistré dans **Chats**.
3. Clique sur la pastille **Create a character** (créer un personnage). Elle remplit le champ de message. Si aucune pastille ne s'affiche, écris plutôt ta demande.
4. Ajoute ton idée au texte, par exemple le nom et la personnalité, puis appuie sur <kbd>Enter</kbd>.
5. Réponds à ses questions. Choisis une option ou écris la tienne, puis clique sur **Submit** (valider).
6. Quand elle a terminé, clique sur **Open** (ouvrir) sur le résultat pour voir le nouveau personnage.
7. Si une modification ne te plaît pas, clique sur **Undo** (annuler) sur son encart de modification.

Si ça n'a pas marché : sans compte ajouté, la liste **Connections** (Connexions) s'ouvre quand tu appuies sur envoyer. Choisis ou ajoute un compte dans cette liste.

## Ce qu'elle sait faire

Elle lit un élément avant de le modifier, et elle pose des questions quand ta demande est floue.

- Expliquer un réglage, un mode ou un concept.
- Créer ou modifier un personnage, un persona ou un lorebook. Une fiche de personnage donne à l'IA un nom, une personnalité et une voix. Un persona est la fiche de personnage qui te représente. Un lorebook est un recueil de faits sur ton univers, que l'IA lit quand leurs mots-clés apparaissent.
- Écrire l'[accueil interactif](../characters/interactive-onboarding.md) d'un personnage, et remplir une [fiche d'ensemble de règles](../characters/colors-and-stats.md#ruleset-sheets) pour un ensemble de règles de Game Mode installé. Sa modification est refusée, avec la raison, quand une valeur ne respecte pas l'ensemble de règles.
- Créer ou modifier un thème, un agent, un preset de prompt ou un brouillon de Personal Extension. Un brouillon reste désactivé tant que tu n'as pas lu son code et ne l'as pas approuvé dans **Settings → Addons** (Paramètres → Modules complémentaires).
- Modifier une seule section d'un preset sur place, au lieu de remplacer le preset entier.
- Comparer les agents à télécharger et te dire lesquels correspondent à ton objectif. Pour les installer, elle t'oriente vers **Agents → Agent Organizer** (Agents → organisateur d'agents). Voir la [Référence des agents téléchargeables](../agents/built-in-agents.md).
- Générer ou attribuer des images, comme des avatars, des sprites et des arrière-plans. Il te faut d'abord un compte de génération d'images. Elle n'en crée pas à ta place.
- Consulter les pages publiques des wikis Fandom quand tu te documentes sur un personnage ou un univers.

### Commencer par une pastille

Dans un chat Professor Mari vide, des pastilles de démarrage t'aident à commencer : **Create a character**, **Create a lorebook** (créer un lorebook) et **Create a persona** (créer un persona). Clique sur une pastille pour remplir le champ de message, puis retouche le texte avant de l'envoyer. Pendant une tâche guidée, les pastilles changent pour coller à l'étape suivante. Les pastilles ne s'affichent que dans les chats Professor Mari.

Quand ta demande laisse de vrais choix ouverts, elle peut poser ses questions sur une carte de questions sous sa réponse : jusqu'à quatre questions, une à la fois, avec des options et sa recommandation signalée. Choisis une option ou écris la tienne, puis clique sur **Submit**. Tes réponses partent comme ton message suivant. Tu peux aussi ignorer la carte et écrire un message à la place. Rien de ce qu'elle a proposé en même temps que la question ne s'exécute avant que tu aies répondu.

### Demander depuis l'endroit où tu travailles

Ces endroits l'ouvrent avec un brouillon modifiable et une petite pastille **Context** (contexte) – une étiquette au-dessus du champ de message – que tu peux retirer avant d'envoyer :

- Les éditeurs **Character** (personnage), **Persona**, **Lorebook** et **Preset**.
- Les réponses de la **FAQ** : **Ask Prof. Mari about this** (demander à Prof. Mari à ce sujet).
- Search : choisis un résultat, puis **Ask Prof. Mari**.
- Les états d'erreur comme **Try again** (réessayer) : **Ask Professor Mari**.

Elle ne reçoit pas un élément entier simplement parce que tu as ouvert son éditeur.

<a id="pick-an-account-for-her"></a>

## Choisir un compte pour elle

Avant de commencer : ajoute un compte de génération de texte. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Clique sur le bouton de connexion à côté du trombone. Il affiche le nom de son compte, ou **Select connection** (choisir une connexion) quand aucun n'est choisi.
2. Choisis un compte de génération de texte dans la liste **Connections**. Si tu as téléchargé le **Built-in model** (modèle intégré), il s'affiche ici aussi.
3. Clique sur un modèle de la liste pour l'utiliser. Le modèle est enregistré dans le compte : tes autres chats qui utilisent ce compte changent donc aussi de modèle. Le **Built-in model** n'a pas de liste de modèles.

Sur téléphone, touche un compte pour l'utiliser, ou touche la flèche au bout de sa ligne pour voir d'abord ses modèles. Tant que tu n'as aucun compte, la liste affiche **Add a connection** (ajouter une connexion).

<a id="reviewing-her-changes"></a>

## Réviser ses modifications

Quand elle modifie quelque chose, elle l'enregistre aussitôt et affiche un encart de modification sous sa réponse. L'encart liste chaque champ modifié. Une modification de texte montre les anciens et les nouveaux mots. **Show all** (tout afficher) montre tous les champs, et **Technical details** (détails techniques) affiche la commande brute.

L'encart propose une seule action : **Undo**. Elle remet en place la version enregistrée précédente. Tant que sa copie d'annulation est conservée, toute modification peut être annulée, quel que soit le mode de permissions. Le mode de permissions décide seulement si elle demande d'abord.

- **Not saved** suivi d'une raison signifie que la modification a échoué. **Try again** lui renvoie la demande.
- La date limite d'annulation, **Undo until**, ne s'affiche que pendant les dernières 24 heures. Une copie d'annulation dure jusqu'à 14 jours, et seules les 50 plus récentes sont conservées. Passé ce délai, l'encart indique **Undo closed** et la modification reste en place.
- Une étape de sa liste de travail qui se termine par **· not saved** n'était qu'un aperçu. Rien n'a changé.
- Une modification qui ne changerait rien n'est pas enregistrée et ne reçoit aucun encart.
- Les personnages et les personas gardent aussi un historique de versions dans leurs éditeurs : c'est un deuxième moyen de revenir en arrière.
- Elle ne peut ni modifier ni supprimer sa propre fiche. Marinara la rétablit à chaque démarrage.

Un encart appartient au chat dans lequel elle a effectué la modification. Supprimer un chat conserve ses modifications et retire ses encarts.

### Les modifications qui t'attendent

Une modification retenue attend au lieu d'être enregistrée. Elle affiche **Apply** (appliquer) et **Don't apply** (ne pas appliquer). Une suppression affiche **Delete** (supprimer) et **Put back** (remettre en place). Les modifications sont retenues en mode Manual, ainsi que pour les fichiers sensibles et les dépendances (voir [Modifications retenues pour les fichiers et les bibliothèques](#held-changes-for-files-and-libraries)). Search ne liste pas ses modifications : ouvre Professor Mari pour les appliquer ou les annuler.

Quand elle crée ou met à jour un personnage, un persona, un lorebook ou un preset, le résultat peut afficher **Open**, qui ouvre cet élément. Un résultat mis à jour peut aussi afficher **Review** (examiner) tant qu'une révision est en attente.

## Le menu du trombone

Clique sur le bouton trombone, intitulé **Attach** (joindre). Il a trois sections.

| Section | Éléments |
| --- | --- |
| **Attach** | **Attach files or photos** (joindre des fichiers ou des photos), **Add chat history** (ajouter l'historique d'un chat – partager l'un de tes chats passés), **View attached context** (voir le contexte joint) |
| **Reference** | **Link with @** (lier avec @) |
| **Mari** | **New chat**, **Chat history** (historique des chats), **Skills**, **Memories** (souvenirs), **Model** (modèle), **Permissions**. **Pending approvals** (approbations en attente) s'affiche tant qu'une modification t'attend. |

Tu peux saisir les mêmes actions avec `/`. Voir [Commandes avec /](#commands-with-).

### Joindre des fichiers

Choisis **Attach files or photos**, ou saisis `/attach`. Elle accepte les images, les fichiers PDF et les fichiers texte comme `.txt`, `.md`, `.json`, `.csv` et `.log`, jusqu'à 20 Mo chacun. Tu peux aussi coller une capture d'écran ou un fichier dans le champ de message. Pour qu'elle puisse lire une image, le modèle choisi doit prendre en charge les images en entrée.

### Lier des éléments avec @

Saisis `@` pour lui indiquer un élément de ta bibliothèque. Une liste s'ouvre, regroupée en **Characters** (personnages), **Personas**, **Lorebooks**, **Presets**, **Skills**, **Memories**, **Chats**, **Agents** et **Docs**. Continue d'écrire pour la réduire. Les noms avec des espaces n'ont pas besoin de guillemets.

- Utilise les flèches pour te déplacer, <kbd>Enter</kbd> ou <kbd>Tab</kbd> pour choisir et <kbd>Escape</kbd> pour fermer. Sur un lorebook, la flèche droite liste ses **Entries** (entrées) pour que tu puisses lier une seule entrée.
- À côté d'un éditeur, la première ligne, **Open beside me** (ouvrir à côté de moi), lie ce que l'éditeur a d'ouvert. À côté de l'éditeur de personnage, son › (ou la flèche droite) liste les **Fields** (champs). Choisir un champ change le champ sur lequel elle travaille et remplace la pastille de champ dans sa ligne de contexte.
- Un nom choisi s'affiche sous forme de pastille au-dessus du champ de message. Supprime le nom, et le lien disparaît avec lui. Le **×** de la pastille retire le lien et garde ton texte.
- Dans un texte ordinaire, <kbd>Tab</kbd> complète un nom qu'elle suggère en gris. Appuie de nouveau sur <kbd>Tab</kbd> pour le lier. Sur un écran tactile, touche le nom gris, puis **Tap to link** (touche pour lier).

| Lien | Ce qu'elle reçoit |
| --- | --- |
| Personnage, persona, preset | L'élément entier |
| Lorebook | Ses réglages et la liste de ses entrées |
| Entrée de lorebook | L'entrée et le lorebook auquel elle appartient |
| Skill | Les instructions de ta Skill. Une Skill intégrée s'ouvre comme son manuel pour ce message. |
| Souvenir | Le texte complet du souvenir, même désactivé |
| Chat | Les détails du chat et ses 30 derniers messages |
| Agent | Les réglages de l'agent |
| Page de documentation | La page entière de cette documentation |

Un lien est envoyé une seule fois, avec le message dans lequel tu l'ajoutes. Ensuite, elle ne voit qu'une note d'une ligne et relit l'élément si elle en a besoin. Un message porte jusqu'à 8 liens. S'ils dépassent au total environ un quart du contexte du modèle, 60 000 caractères au maximum, les derniers ne sont pas envoyés. Elle reçoit une note à la place et peut les lire elle-même. Les éléments liés comptent comme de l'information, jamais comme des instructions.

<a id="commands-with-"></a>

### Commandes avec /

Saisis `/` au début d'une ligne pour lister ses commandes. Continue d'écrire pour filtrer, puis appuie sur <kbd>Enter</kbd>. La liste affiche aussi tes Skills et tes souvenirs. Choisir l'un d'eux le lie, comme avec `@`.

| Commande | Ce qu'elle fait |
| --- | --- |
| `/new` | Démarre un nouveau chat et enregistre le chat en cours (`/restart` fonctionne aussi) |
| `/history` | Ouvre tes chats passés avec elle |
| `/skills` | Ouvre le panneau **Skills** |
| `/memories` | Ouvre le panneau **Memories** |
| `/context` | Affiche ce qui est joint à ce chat |
| `/attach` | Choisit des fichiers ou des photos à envoyer |
| `/model` | Choisit le compte qu'elle utilise |
| `/permissions` | Choisit ce qu'elle a le droit de modifier |
| `/approvals` | Ouvre les modifications qui t'attendent (seulement tant qu'une est en attente) |

<a id="sending-messages-while-she-works"></a>

## Envoyer des messages pendant qu'elle travaille

Le champ de message reste ouvert pendant qu'elle travaille. C'est toi qui choisis quand ton message lui parvient.

- **Send now** (envoyer maintenant) arrive à sa prochaine étape, sans l'arrêter. Sa réponse jusque-là est enregistrée, ton message apparaît en dessous, et elle continue en en tenant compte.
- **Send after her answer** (envoyer après sa réponse) attend dans une liste au-dessus du champ, avec la mention **Sends when she finishes**. Quand elle termine proprement, elle prend les messages en attente un par un.

- **Enter sends** (Enter envoie) activé (par défaut) : <kbd>Enter</kbd> envoie maintenant. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> met en file d'attente.
- **Enter sends** désactivé : <kbd>Ctrl</kbd>+<kbd>Enter</kbd> envoie maintenant. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd> met en file d'attente.

Sur un Mac, utilise <kbd>⌘</kbd> à la place de <kbd>Ctrl</kbd>. Pendant qu'elle travaille, un champ de message vide n'affiche qu'un bouton **Stop** (arrêter), qui annule la tâche en cours. Quand tu écris, **Stop** devient le bouton d'envoi. Clique dessus pour choisir **Send now** ou **Send after her answer**, ce qui aide sur téléphone.

Send now ne sert que pour du texte. Un message avec des fichiers, des liens `@` ou un champ que tu lui as confié est mis en file d'attente à la place. C'est aussi le cas d'un message sur un autre sujet, ou envoyé après un changement du mode de permissions. Un court avis te le signale. Clique sur le **X** d'un message pour le retirer. Un chat peut contenir jusqu'à 20 messages en attente.

Les messages en attente ne partent pas d'eux-mêmes dans ces cas :

- **Tu appuies sur Stop.** Ils reviennent dans le champ de message.
- **Elle t'attend** (une approbation ou une réponse), **l'exécution a échoué, ou l'application a redémarré.** Ils affichent **Held**, avec un bouton **Send** (envoyer). **Send** n'envoie que celui-là.

`/restart` et `/title` ne font rien pendant qu'elle travaille. Ils restent dans le champ jusqu'à ce qu'elle ait fini.

Sur un travail plus long, elle tient une liste de tâches sous son dernier message, avec un compteur comme **2 of 5**. Tu ne peux pas la modifier. Une fois que tu as écrit un nouveau message, elle s'affiche estompée, avec la mention **Plan from before your last message**.

## Retrouver tes chats Professor Mari

Ses chats sont à part de ta liste de chats habituelle.

1. Clique sur **Chats** dans son en-tête.
2. Utilise **Search Prof. Mari chats** (rechercher dans les chats de Prof. Mari) pour en trouver un. Clique sur un chat pour l'ouvrir, le renommer ou le supprimer.

Clique sur **New chat** ou saisis `/new` pour repartir de zéro. Le chat en cours est d'abord enregistré, et le message **Professor Mari's previous chat was saved.** s'affiche.

## Réponses rapides dans Search

Les réponses rapides sont désactivées tant que tu n'actives pas **Quick answers in Search** (réponses rapides dans Search) sous **Search and Professor Mari settings**. Quand tu saisis une question dans Search et qu'aucun résultat ne correspond, elle rédige une réponse courte, en lecture seule, dans un encart **Quick answer · Read-only** (réponse rapide · lecture seule).

- La réponse compte au plus trois phrases, issues de la documentation de Marinara, nomme les pages utilisées et ne modifie rien. Pendant cinq minutes, la même question réutilise une copie enregistrée.
- En dessous : **Copy** (copier), **Answer again** (répondre à nouveau) et **Continue with Prof. Mari** (continuer avec Prof. Mari). Ce dernier ouvre sa fenêtre dans un nouveau chat qui porte le nom de ta question.
- **Wait after typing** (attendre après la saisie) règle le délai d'attente de Search. **Answer with** (répondre avec) choisit qui répond : un modèle que tu as téléchargé, **Same as Prof. Mari** (la même connexion que Prof. Mari), ou un autre compte. Chaque réponse est une seule requête courte : un compte payant peut donc coûter de l'argent.
- Si une réponse échoue, l'encart en donne la raison. **Choose a model** (choisir un modèle) n'apparaît que si une clé ou un modèle manque. Le message propre au service se trouve sous **Details** (détails).

## Référence : réglages, Skills et souvenirs

### Ligne d'état et pastille de la barre supérieure

Tu peux fermer sa fenêtre pendant qu'elle travaille. Une fine ligne en bas de la barre supérieure ondule pendant qu'elle travaille, devient verte quand elle a terminé, dorée tant qu'une approbation attend, et rouge si la dernière exécution a échoué. Quand sa fenêtre est fermée, une pastille dans la barre supérieure affiche **Working**, **Needs you**, **Done** ou **Failed**. Clique sur la pastille pour revenir à son chat.

### Apparence

Sous **Search and Professor Mari settings → Appearance** (réglages de Search et de Professor Mari → apparence), choisis une apparence, par exemple **Basic**, **Prof. Mari loves Dottore** ou **Safari Prof. Mari**. Elle s'affiche dans son chat, dans Search, sur l'accueil et dans la barre supérieure. Certaines apparences se débloquent après assez de temps de jeu, et une apparence verrouillée indique tes heures de jeu jusqu'ici.

### Skills

Une Skill est un court document d'instructions qui change la façon dont elle traite un type de demande.

1. Clique sur **Skills** dans son en-tête. Le panneau **Professor Mari skills** s'ouvre.
2. Clique sur **New** (nouveau) pour partir d'un modèle, ou sur **Upload** (téléverser) pour ajouter un fichier `.md` ou `.txt`.
3. Sélectionne une Skill pour modifier ses champs **Name** (nom), **Description** et **Instructions**, puis clique sur **Save** (enregistrer). Clique sur **Delete** pour la supprimer.

Désactive une Skill pour la garder sans l'utiliser. Tant que tu n'as aucune Skill, le panneau affiche **No custom skills yet**.

Les Skills intégrées s'affichent sous **Always on** (toujours actif), avec la mention **Built-in**. Ce sont ses manuels pour les personnages, les lorebooks, les presets, les thèmes, les extensions, les widgets de l'accueil et d'autres sujets. Elles sont en lecture seule, et une mise à jour de l'application les remplace. Pour en changer une, copie son texte dans une nouvelle Skill à toi.

### Souvenirs

Un souvenir est une préférence durable qu'elle garde, par exemple les mots-clés que tu veux pour tes entrées de lorebook. Demande-le-lui ("retiens que mes entrées ont toujours pour mot-clé le nom du personnage"), ou ouvre **Memories** dans son en-tête pour créer, modifier, activer ou désactiver et supprimer des souvenirs, ou pour téléverser un fichier texte avec **Upload**.

- Un souvenir qu'elle enregistre démarre désactivé. L'encart de modification propose **Turn on** (activer). Elle n'en enregistre un que si tu le lui demandes, jamais parce qu'un contenu qu'elle a lu le lui a dit.
- À chaque tour, elle ne voit qu'un court index de tes souvenirs activés, et lit le texte complet quand l'un d'eux est pertinent. Un souvenir **Persistent** reste sous ses yeux à chaque tour : garde-en donc peu, et courts.
- Les souvenirs priment sur ses habitudes par défaut en cas de conflit.

## Confiance et reprise après échec

Ouvre **Context** dans son en-tête pour voir ce qui accompagne ton prochain message, ce qui reste dans ce chat et comment elle travaille : le modèle, le budget de contexte et si son shell s'exécute dans un bac à sable. L'en-tête affiche aussi les approbations en attente, les Skills et les souvenirs. **Context** n'accorde aucun accès supplémentaire.

Quand une demande échoue, le chat conserve la raison et affiche **Retry** (réessayer) quand tu peux la renvoyer. Corrige d'abord le problème indiqué : compte, bac à sable ou accès. Si ta question n'a pas été enregistrée, elle revient dans le champ de message avec ses fichiers. **Retry** et **Retry with another model** (réessayer avec un autre modèle) envoient alors ce qui se trouve dans le champ.

## Lire la FAQ

Clique sur le marque-page **FAQ**, ou sur **Read FAQ** (lire la FAQ) dans le widget **Learn the engine** (découvrir l'application), pour ouvrir **Professor Mari's FAQ** (la FAQ de Professor Mari). C'est une liste fixe, rédigée à l'avance, pas le chat avec l'IA : elle ne connaît donc pas ta configuration. Saisis du texte dans **Search FAQ** (rechercher dans la FAQ) pour filtrer. Chaque question porte un tag de catégorie, par exemple **Setup**, **Connections** ou **Game Mode**. Touche une question pour lire la réponse.

## Limites et sécurité

- Elle ne peut pas garantir que ses connaissances intégrées correspondent à ta version de l'application. Pour tout ce qui dépend de la version, fie-toi aux guides et aux notes de version.
- Créer du contenu est en général sans risque. Modifier du contenu existant demande plus d'attention. Nomme l'élément et le champ exacts : "raccourcis le message d'accueil de Luna, garde sa personnalité" est plus sûr que "réécris ce personnage".
- Si elle annonce avoir terminé mais que l'application ne le montre pas, fie-toi à l'application et termine la tâche dans le panneau correspondant.
- Quand tu rejoins Marinara depuis un autre appareil, ses actions de modification demandent un accès à distance configuré. Voir [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md).

## Dépannage

| Symptôme | Solution |
| --- | --- |
| Aucune réponse | Vérifie le compte affiché dans **Context**, ou choisis-en un avec le bouton de connexion. S'il n'y en a aucun, ajoutes-en un dans **Connections**. |
| La liste **Connections** s'ouvre quand tu appuies sur envoyer | Aucun compte n'est choisi. Choisis-en un, ou clique sur **Add a connection**. |
| Un transfert contient le mauvais élément | Retire l'élément de contexte, passe au bon chat Professor Mari, puis relance le transfert depuis l'endroit où tu as commencé. |
| Un résultat n'apparaît pas dans un éditeur | Clique sur **Open** sur l'encart du résultat. La liste des éléments n'était peut-être pas à jour. |
| Une demande échoue | Lis l'échec, corrige le problème indiqué, puis clique sur **Retry**. |
| Elle n'arrive pas à lire ton image | Passe à un compte dont le modèle prend en charge les images en entrée. |
| Les recherches Fandom échouent | Elles ont besoin d'une connexion internet. |
| Actions bloquées par une erreur de permission | Tu rejoins Marinara par le réseau. Commence par configurer l'accès à distance. |

## Référence pour les utilisateurs avancés

Ces parties s'adressent aux personnes qui modifient les propres fichiers de Marinara ou qui veulent régler sa façon de travailler. Tu peux les passer.

### Runtime

Sous **Runtime** (environnement d'exécution), tu peux choisir **Pi (experimental)**, le mode par défaut, ou **Classic**. Pi est un mode où elle réfléchit davantage avant d'agir et mène à bien des tâches plus longues. Si ton compte ne peut pas faire tourner Pi, elle utilise Classic. Le changement s'applique dès sa prochaine réponse, et Undo fonctionne de la même façon dans les deux. Si elle se comporte de façon étrange avec Pi, passe à Classic.

**Read the handbook before the first write** (lire le manuel avant la première écriture), également sous **Runtime**, est activé par défaut. Sa première modification dans un domaine couvert par une Skill intégrée est refusée tant qu'elle n'a pas lu cette Skill. Cela aide les petits modèles. Toi seul peux le désactiver.

### Ce qu'elle peut atteindre sur ton ordinateur

Elle peut lire et modifier les propres fichiers de programme de Marinara et exécuter des commandes en bac à sable, pour pouvoir réparer l'application. La plupart des gens n'en ont jamais besoin.

- Ses outils de fichiers restent dans le dossier où Marinara est installé. Les commandes shell brutes ne peuvent pas lire tes autres fichiers personnels, n'ont aucun accès réseau et n'héritent pas des secrets du serveur.
- `.env`, le fichier de clé qui protège tes clés API enregistrées et les fichiers internes de Git lui restent inaccessibles.
- Elle ne peut pas écrire directement dans ton dossier de données, là où vivent tes personnages et tes chats. Elle passe par le circuit de modification révisable décrit plus haut.
- Les manifestes de dépendances, les fichiers de verrouillage, les lanceurs, les installateurs et les workflows CI sont d'abord préparés pour ton approbation. Les scripts d'installation des paquets restent désactivés.
- Les commandes s'arrêtent d'elles-mêmes au bout d'un court délai.
- Si Marinara ne peut pas fournir son bac à sable shell macOS ou Linux, les commandes shell brutes et `mari code check` sont désactivées. Elle peut toujours utiliser les outils structurés pour les fichiers et les données de l'application.

<a id="held-changes-for-files-and-libraries"></a>

### Modifications retenues pour les fichiers et les bibliothèques

- **Sensitive files** (fichiers sensibles : fichiers de dépendances, lanceurs, installateurs, workflows CI) affichent le chemin et le nouveau contenu, avec **Apply change** (appliquer la modification) et **Discard** (abandonner).
- **Dependencies** (dépendances) affichent le paquet npm, la version exacte et l'intégrité du registre, avec **Install** (installer) et **Not now** (pas maintenant). Les commandes d'installation sont bloquées dans son shell. Approuver une bibliothèque, c'est faire confiance à son code quand Marinara l'exécute.

### Comment elle gère Decisions

Un modèle de décision est un petit modèle qui répond à des questions par oui ou par non. Pour les **Activation questions** (questions d'activation) des agents, les énoncés **Decision** des lorebooks et les prompts conditionnels, elle vérifie d'abord quel modèle de décision tu as choisi.

- Elle demande avant d'ajouter du contenu Decision, et sans modèle de décision, elle garde ses nouveaux travaux sans Decisions, sauf si tu le demandes.
- Elle préfère un usage limité, avec un contrôle temporel : **Sticky** ou **Cooldown** pour les entrées de lorebook, **Trigger Cadence** pour l'activation des agents, et `sticky`, `cooldown` ou `every` dans les conditions de prompt.
- Elle demande avant d'ajouter du contenu qui change tôt dans un prompt ou dans l'historique du chat, pour que le début du prompt reste stable pour la mise en cache du prompt par le service.
- Dis-lui "Arrête de me rappeler de configurer un modèle de décision" pour arrêter les rappels.

Voir [Modèles de décision](../connections/decision-models.md), [Prompts conditionnels](../prompts/conditional-prompts.md), [Agents personnalisés](../agents/custom-agents.md#activation-questions) et [Entrées de lorebook](../lorebooks/entries.md#decision-activation).

### La commande mari

Une modification effectuée avec la commande `mari` dans un terminal n'appartient à aucun chat : son encart de modification apparaît donc dans tous les chats Professor Mari.

## Guides associés

- [Démarrer avec Marinara Engine](welcome.md)
- [Le tutoriel de première ouverture](tutorial.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
