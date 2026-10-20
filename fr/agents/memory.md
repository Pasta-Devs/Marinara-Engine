# Mémoire et résumés de chat

Ce guide présente **Memory Recall** (recherche dans les anciens messages), l'option **Advanced Memory Recall** (rappel de mémoire avancé) pour gérer automatiquement le contexte en Roleplay, **Chat Summary** et **Automatic Summarization** en Conversation.

## Les deux systèmes de mémoire

Un modèle d'IA ne peut lire qu'une quantité limitée de texte à la fois. Cette limite s'appelle la fenêtre de contexte. Quand un chat (une conversation enregistrée) s'allonge, les messages les plus anciens sortent de cette fenêtre et l'IA les oublie. Marinara Engine (appelé simplement Marinara dans la suite) corrige ça avec deux systèmes distincts.

- **Memory Recall** cherche dans les messages anciens les passages les plus proches de ce que tu viens d'écrire, puis les remet discrètement dans le prompt (le texte que Marinara envoie à l'IA). Ça fonctionne dans tous les modes de chat.
- Les résumés compressent les vieux messages en courts récapitulatifs qui remplacent les messages bruts dans le prompt. Les chats Roleplay utilisent **Chat Summary**. Les chats Conversation utilisent **Automatic Summarization**.

Les chats Game Mode ont uniquement **Memory Recall**. Aucune des deux fonctions de résumé n'y est disponible.

Les deux systèmes s'utilisent en même temps. Ils font des choses différentes et n'entrent pas en conflit.

## Configurer Memory Recall

**Memory Recall** repère les fragments pertinents du début du chat et les insère dans le prompt sous forme de souvenirs. Pour ça, il utilise un embedding : une empreinte numérique du sens d'un message. Marinara compare l'empreinte du nouveau message aux empreintes stockées des messages passés, puis ajoute les correspondances les plus proches.

### Activer Memory Recall

1. Ouvre un chat et clique sur le bouton **Chat Settings** (réglages du chat). Au départ, il se trouve en haut à droite.
2. Repère la section **Memory Recall** (elle porte une icône de cerveau).
3. Active l'interrupteur **Enable Memory Recall**.

**Enable Memory Recall** est un réglage propre à chaque chat. Sa valeur par défaut dépend du mode :

- Activé par défaut dans les chats Conversation.
- Activé par défaut dans les chats Roleplay ou Game qui ont une scène active.
- Désactivé par défaut dans tous les autres chats.

Désactiver l'interrupteur empêche l'ajout des souvenirs au prompt. Rien de ce qui est déjà stocké n'est supprimé.

### La source d'embeddings

Memory Recall a besoin d'une source d'embeddings pour construire ces empreintes de sens. Elle se règle sur une connexion, pas dans les réglages du chat. Une connexion est un lien enregistré vers un fournisseur d'IA.

1. Ouvre le panneau **Connections** (Connexions) et modifie une connexion.
2. Repère la section **Semantic Search (Embeddings)**.
3. Saisis un nom de modèle d'embeddings dans le champ du modèle. Par exemple `text-embedding-3-small`.
4. Renseigne au besoin le champ **Embedding Endpoint URL** pour remplacer l'adresse utilisée.
5. Autre option : le menu déroulant **Embedding Connection** permet d'emprunter la clé et l'adresse d'une autre connexion. Parmi les choix figurent **Same as this connection** et **Local Model (sidecar)**.

Certains fournisseurs ne proposent pas d'embeddings. Dans ce cas, Marinara affiche un message qui t'invite à choisir une connexion d'embeddings dédiée : une connexion compatible OpenAI, Google, ou le modèle local.

Pour utiliser une même source d'embeddings partout, choisis-la sous **Embeddings**, dans **Connections** > **Defaults** (valeurs par défaut). Les connexions sans modèle d'embedding ni **Embedding Connection** propre l'utilisent alors, tandis que le réglage propre à une connexion garde la priorité.

Si aucune connexion d'embeddings ni valeur par défaut **Embeddings** n'est définie, Marinara se rabat sur un modèle d'embeddings local intégré. Il télécharge ce modèle une seule fois et le fait tourner sur ta machine, sans clé API (un code secret, un peu comme un mot de passe). Pour en savoir plus sur ce modèle intégré, voir [Configurer le modèle local](../connections/local-model.md).

Ce même réglage **Semantic Search (Embeddings)** alimente aussi la recherche sémantique des lorebooks : une seule configuration sert donc aux deux fonctions.

### Memories for This Chat

Pour voir ce qu'un chat a mémorisé, ouvre **Chat Settings**, va dans **Memory Recall** et clique sur **Access memories for this chat**. Avec Advanced Memory activé, la consultation reste dans le panneau latéral Roleplay ; sinon, la fenêtre **Memories for This Chat** s'ouvre.

Cette fenêtre affiche le nombre de blocs de souvenirs stockés et une estimation approximative en tokens (un token est un petit morceau de texte). Chaque carte de bloc indique la période couverte, le nombre de messages, un statut et la date de création. Le statut prend l'une de ces valeurs :

- **Vectorized** : l'empreinte est construite et prête pour la recherche.
- **Waiting for vector** : l'empreinte est encore en cours de fabrication.
- **Embedding unavailable** : aucune source d'embeddings n'a pu la construire.

La barre d'outils propose des icônes pour exporter, importer, reconstruire et effacer tous les souvenirs. Chaque bloc a en plus sa propre icône de corbeille pour l'oublier individuellement.

- Cliquer sur l'icône de corbeille d'un bloc ouvre la boîte de dialogue **Forget Memory**. Confirme avec **Forget**.
- L'icône de corbeille globale ouvre la boîte de dialogue **Clear Memories**. Confirme avec **Clear**. Ça supprime les souvenirs de rappel, mais pas les messages du chat.
- L'icône d'actualisation reconstruit tous les blocs à partir des messages actuels du chat. Sers-t'en après avoir changé de modèle d'embeddings.
- L'export enregistre un fichier `.marinara.json`. L'import accepte les fichiers `.json` ou `.marinara` et les fusionne avec les souvenirs existants.

### Le comportement de Memory Recall

Garde ces points en tête :

- Marinara stocke les blocs de souvenirs en arrière-plan dès qu'une source d'embeddings est disponible, même si **Enable Memory Recall** est désactivé. L'interrupteur décide seulement si les souvenirs stockés sont insérés ou non. Pour arrêter le stockage, retire la source d'embeddings ou efface les souvenirs de temps en temps.
- Il faut au moins 5 nouveaux messages pour créer un bloc. Les lots plus petits attendent la réponse suivante.
- Les fragments rappelés doivent être assez proches pour passer un test de similarité. Les correspondances faibles sont écartées : le rappel peut donc ne rien retourner alors que des souvenirs existent.
- Seule une petite part du prompt est réservée aux souvenirs rappelés, si bien que seuls les plus pertinents sont ajoutés.
- Si tu changes de modèle d'embeddings alors que des souvenirs existent déjà, les anciens blocs ne correspondent plus. Utilise l'icône de reconstruction pour les refaire.
- Supprimer les messages d'un chat supprime aussi ses blocs de souvenirs.

Certaines versions conteneurisées de Marinara, dites Marinara Lite, désactivent complètement Memory Recall. Sur ces versions, la section **Memory Recall** n'apparaît pas du tout.

## Advanced Memory Recall (Roleplay)

Ouvre **Chat Settings → Memory Recall** et active **Advanced Memory Recall**. Tu peux aussi activer **Automatic context and memory handling** (gestion automatique du contexte et de la mémoire) sous Agents dans l'assistant de configuration Roleplay. Ce mode facultatif gère ensemble la fenêtre d'historique courant, les résumés de continuité et les extraits anciens pertinents. Les réglages et la progression de la préparation sont disponibles dans l'assistant et dans le panneau latéral Chat Settings, sur ordinateur comme sur mobile. La consultation des archives reste dans le panneau Chat Settings.

### Configuration

- Choisis **Maximum allowed context before compression (tokens)** dans le contexte pris en charge par le modèle du chat. Quand le prompt sortant atteint cette taille, le contexte le plus ancien est coupé et l'historique du chat recommence à grandir à partir de là. Ce qui a été coupé est résumé et ajouté aux souvenirs qui peuvent être rappelés. Ce plafond porte sur le prompt sortant estimé : instructions, messages, souvenirs rappelés, outils et pièces jointes, pour le chat comme pour le traitement de la mémoire. Les tokens de réponse et la marge de sécurité sont comptés séparément. La limite totale du modèle reste applicable ; ce plafond ne correspond pas à un décompte exact du tokenizer ni à la facturation.
- Choisis **Summary and recall budget (tokens)** (budget des résumés et du rappel) dans ce plafond. Il fixe la part du contexte consacrée aux souvenirs ; au moins 10% du contexte maximal autorisé est recommandé. La première fois que tu actives Advanced Memory Recall dans un chat, il démarre à **6 500**, soit 10% du maximum par défaut de **65 000** ; modifier le maximum ensuite ne le change pas. Les résumés constants actifs visent au plus **70%** de cette valeur. Priorité aux constantes, puis aux résumés des scènes sélectionnées, puis aux [souvenirs personnels des personnages](#character-recollections) quand ils sont activés, puis aux extraits de messages. La mémoire totale peut utiliser jusqu'à **2,000 tokens supplémentaires** si nécessaire, dans la limite du contexte complet. Avec 10k, la cible est au plus 7k de constantes et 12k au total ; les mêmes proportions valent pour les autres réglages. Les messages actuels ne comptent pas dans la part constante et ne déclenchent pas sa consolidation.
- Par défaut : **Helper model** (modèle auxiliaire) décide des scènes, les résume et compacte la continuité. Il utilise la connexion des agents, puis celle du chat en repli. La détection historique initiale peut utiliser le principal ou l'auxiliaire ; les résumés utilisent toujours l'auxiliaire. Les modèles retenus sont affichés avant la préparation.
- Tous les appels de résumé mémoire utilisent **Chat Summary → Maximum output size**, avec au moins **8,196 tokens de sortie** pour laisser de la place au raisonnement. Cela comprend les résumés de scènes et la consolidation des constantes ; les valeurs supérieures sont conservées. La limite habituelle de réponse de la connexion auxiliaire ne remplace pas ce réglage. Entrée et réserve de sortie doivent toujours tenir dans le contexte total du modèle.
- Chaque demande de résumé reçoit les instructions, les messages accessibles de la scène, les corrections par plage applicables et le format de sortie JSON. Les scènes trop longues sont traitées par lots enregistrés, puis combinées. Le récapitulatif demandé fait **2–3 paragraphes**. Le prompt par défaut relate les faits passés sans sections sur la situation actuelle ou les tensions ouvertes ; les prompts personnalisés choisis dans **Summaries** restent applicables. Advanced Memory fonctionne indépendamment de l'interrupteur principal Agents et ne nécessite aucun agent téléchargeable.
- **Maximum recalled scenes** (maximum de scènes rappelées) vaut **3** par défaut. C'est un plafond ; les correspondances faibles sont ignorées. **0** désactive les scènes facultatives et conserve la continuité nécessaire. Chaque scène fournit son résumé suivi d'au plus un extrait.
- **Moving context** (contexte mobile) définit les messages par extrait, **3–10** par défaut. Un extrait reprend les messages exacts d'une scène rappelée et s'ajoute juste après son résumé. Les deux limites à **0** donnent uniquement des résumés ; seul le minimum à **0** rend les extraits facultatifs. Pertinence, accès et espace peuvent réduire le nombre jusqu'à zéro. Chaque scène rappelée reçoit son extrait minimal avant qu'un extrait ne s'allonge. Si une scène rappelée n'a toujours pas d'extrait, le rapport de rappel en indique la raison : il ne restait plus de place après les résumés, ou aucun de ses messages ne peut être cité.

Dans un ancien chat de groupe Individual, confirme une fois les plages de connaissance manquantes des personnages. La première réplique d'un personnage ne prouve pas qu'il savait tout ce qui la précédait. Choisis un véritable personnage comme **Narrator** (Narrateur) seulement s'il doit dépasser les limites de participation. Le masquage propre à chaque personnage et les plages de connaissance confirmées limitent toujours la mémoire. Le masquage global **Hide from AI** (Masquer à l'IA), manuel ou défini par les résumés automatiques, retire seulement un tour de la transcription active : Advanced Memory continue de l'analyser, de déterminer les participants de la scène, de le résumer et de l'indexer pour les rappels autorisés. Les marqueurs de début raccourcissent la transcription active. Tu peux corriger ces plages plus tard ; chaque personnage ajouté doit avoir sa propre confirmation.

Pour un chat existant, clique d'abord sur **Prepare existing history** (Préparer l'historique existant). Si l'historique récupéré change les limites d'une scène couverte par une correction manuelle, désactive ce souvenir pour garder son texte comme référence, ou supprime-le, puis prépare de nouveau l'historique. Le bouton **Fix** (corriger ; voir [Corriger les problèmes de mémoire](#fixing-memory-problems)) ignore cette scène et la signale au lieu de s'arrêter. Enregistrer la même correction ne permet pas d'attribuer son texte sans risque à une autre plage source. La préparation traite l'ancien historique par lots et affiche l'étape actuelle à côté de la roue de hamster de Professor Mari. **Cancel** conserve le travail terminé ; **Resume** reprend après la fermeture du panneau, le redémarrage du serveur ou la mise à jour de l'application. Un appel au modèle qui échoue conserve la mémoire précédemment valide et affiche une erreur pour réessayer. Ne réinitialise pas la mémoire pour te remettre d'un appel raté : Resume réutilise les résumés terminés et la détection des scènes inchangée. La dernière scène en cours reste ouverte et sera résumée à sa fermeture ; des extraits sources bornés sont utilisés si ses messages actifs dépassent la limite de contexte.

Une branche que tu crées à partir d'un chat préparé, par exemple avec **Branch from here** (créer une branche ici), garde son Advanced Memory : tu n'as donc pas à la préparer de nouveau. Une branche créée à l'intérieur d'une scène rouvre cette scène : son ancien résumé est supprimé et un nouveau est écrit à la fermeture de la scène. Les scènes antérieures restent prêtes à être rappelées. Un chat importé comme nouvelle branche est préparé comme d'habitude.

Pour supprimer un résumé enregistré, ouvre-le dans **Access memories for this chat** et choisis **Delete summary** (supprimer le résumé) en bas. Confirme le résumé et son public dans la boîte de dialogue. Cela fonctionne aussi pour les anciennes entrées **Continuity** (continuité) et **Ongoing scene** (scène en cours). La préparation habituelle ne recrée pas les résumés de scènes supprimés. Les messages originaux restent intacts. Les nouvelles constantes sont dans **Chat Summaries**, avec les commandes existantes de modification, activation, regroupement et suppression. L'ancienne continuité du coffre n'est plus une constante supplémentaire.

<a id="fixing-memory-problems"></a>

### Corriger les problèmes de mémoire

Quand quelque chose ne va pas dans la mémoire d'un chat, tu le vois sans ouvrir les réglages de la mémoire. Un point fixe de ta couleur d'accentuation apparaît dans un coin du bouton **Chat Settings**, et une notification indique combien de scènes posent problème. Chaque série de problèmes n'est annoncée qu'une fois ; le point reste affiché jusqu'à ce qu'ils soient réglés. Dans **Chat Settings → Memory Recall**, les mêmes problèmes sont listés au-dessus des réglages, et **Access memories for this chat** affiche le même point.

Appuie sur **Fix**, dans la notification ou dans cette liste, pour réparer toutes les scènes signalées en une seule passe. La réparation utilise le **Helper model** et la barre de progression habituelle. **Pause processing** (suspendre le traitement) l'interrompt et **Resume processing** (reprendre le traitement) poursuit le Fix ; le travail déjà effectué est conservé. Fix :

- redemande à l'auxiliaire qui était présent dans les scènes marquées **Check who was there** (vérifier qui était là), et enregistre une réponse claire. Si l'auxiliaire ne peut toujours pas trancher, personne n'obtient de nouvel accès : la scène ne garde que les personnages qu'elle avait déjà et que l'auxiliaire n'a pas écartés, et elle est listée pour que tu la vérifies ;
- vérifie qui était présent dans les anciennes scènes enregistrées avant l'existence des vérifications de participants, y compris celles dont la vérification automatique a échoué ;
- rédige de nouveaux résumés pour les scènes dont les messages, les messages masqués, les noms des personnages ou les résumés sur lesquels elles s'appuient ont changé, ainsi que pour les scènes terminées qui n'ont pas de résumé. Les résumés que tu as supprimés restent supprimés ;
- reprend le travail de mémoire qui s'est arrêté sur une erreur.

Fix ne réécrit jamais un résumé que tu as modifié à la main. Si l'un d'eux ne correspond plus à ses messages, s'il lui manque des messages réaffichés, ou si les limites de sa scène ont bougé, Fix n'y touche pas et le liste sous **need your review** (à vérifier), puis continue avec les autres scènes. Les réglages qu'il ne peut pas changer à ta place, comme la confirmation de la plage de connaissance de chaque personnage ou le choix d'une connexion de décision qui fonctionne, restent listés jusqu'à ce que tu les modifies.

Quand Fix a terminé, il affiche **Fixed N scenes** ainsi que, sous **need your review**, les numéros des scènes à vérifier. Sélectionne un numéro pour ouvrir cette scène dans **Access memories for this chat**. Si Chat Settings était fermé, une notification avec **Show** (afficher) t'y amène. Le Fix suivant ne redemande rien sur une scène que Fix n'a pas pu trancher ; enregistre toi-même l'accès de ses personnages.

### Réanalyser les scènes

Si des changements de scène ont été manqués, par exemple quand une scène ne s'est jamais terminée et que rien de nouveau n'a été résumé, utilise **Re-scan scenes** (réanalyser les scènes) dans **Chat Settings → Memory Recall**. Saisis le numéro du premier et du dernier message à vérifier, puis appuie sur **Re-scan** (réanalyser). Au départ, la plage couvre la scène en cours. Advanced Memory retrouve les changements de scène dans ces messages, avec le modèle de décision quand **Use Decision model** (utiliser un modèle de décision) est activé et sinon avec le modèle auxiliaire, puis résume les scènes qui ont changé. Les scènes situées hors de ces messages gardent leurs limites et leurs résumés, et les vérifications habituelles après chaque réponse continuent comme avant. Si un résumé que tu as modifié devait changer, la réanalyse s'arrête et nomme cette scène, comme le fait la préparation.

<a id="optional-jev-decisions"></a>
<a id="optional-decision-model"></a>

### Modèle de décision facultatif

Active **Use Decision model** dans Advanced Memory, puis choisis un modèle dans **Memory Decision connection** (Connexion de décision pour la mémoire). Sous **Local models** (modèles locaux), la liste propose les mêmes modèles locaux que le **Decision model** (modèle de décision) global, comme le **Primary local model** (modèle local principal) que tu exécutes dans **Local Model** (modèle local). Un modèle qui ne peut pas encore répondre est grisé et indique pourquoi. Un modèle arrêté démarre quand Advanced Memory le sollicite. Sous **Connections**, elle affiche tes connexions de décision enregistrées. Crées-en une dans **Connections** avec TypeSafe, OpenRouter ou une source de décision compatible ; consulte [Modèles de décision](../connections/decision-models.md). Cette option est désactivée par défaut et enregistrée pour chaque chat Roleplay. Ce choix est distinct du réglage global de modèle de décision.

Le modèle choisi identifie les limites de scène pendant la préparation de l'historique et les vérifications en cours de discussion. Avant une nouvelle réponse, il choisit les souvenirs en deux passes. Le rappel habituel présélectionne d'abord jusqu'à 24 résumés de scène, ou jusqu'à **Maximum recalled scenes** si cette valeur est plus élevée. La présélection combine deux classements, la recherche textuelle et les embeddings : une scène peut donc y entrer par des mots en commun ou par le sens. Les embeddings comparent chaque scène à chacun de tes messages envoyés depuis la dernière prise de parole du personnage qui répond, six au plus : dans un chat de groupe, ils couvrent donc aussi ce que tu as dit à un autre personnage ; la première réponse d'un personnage utilise ton dernier message. Tant que les embeddings ne couvrent pas presque toutes les scènes, la présélection utilise plutôt le classement du rappel habituel, pour que les quelques scènes qui en ont ne prennent pas la place des correspondances textuelles. La scène qui suit chacune des trois meilleures obtient aussi une place, pour les questions sur ce qui s'est passé ensuite. Chaque résumé que le modèle évalue commence par une courte ligne : sa plage de messages, sa date dans l'histoire et qui a parlé, d'après les messages que les personnages qui répondent ont vus. Le modèle retient les scènes pertinentes dans cette présélection, puis évalue jusqu'à 12 messages originaux de chaque scène retenue, ceux qui correspondent le mieux au texte, pour choisir l'extrait de cette scène. Le meilleur choix en est le centre, et les autres choix allongent l'extrait jusqu'à **Maximum messages per excerpt** (nombre maximal de messages par extrait). S'il n'accepte aucun des messages d'une scène, la recherche textuelle centre l'extrait et le rapport de rappel le signale. Une scène dont aucun de ces messages ne tient à lui seul dans la place laissée par les résumés ne peut pas recevoir d'extrait : le modèle n'évalue donc pas ses messages ; quand c'est le cas pour toutes les scènes retenues, aucune seconde requête n'est envoyée. Pour chaque nouveau message, il vérifie si l'histoire passe à un autre lieu ou à un autre moment, bascule vers des personnages qui se trouvent ailleurs, ou suit une ligne de séparation de scène comme `***` ou une note de point de vue (POV) hors personnage. Il voit les trois messages précédents et qui a écrit chacun d'eux. Les limites incertaines laissent la scène ouverte. Le **Helper model** rédige toujours tous les résumés et les mises à jour de continuité. Les limites existantes de scènes, longueur des extraits, accès des personnages et tokens restent applicables. Une décision valide peut ne rien sélectionner.

Les services hébergés reçoivent la conversation récente et les résumés ou messages présélectionnés à évaluer, et peuvent facturer plusieurs requêtes pour une réponse. Le rappel vérifie les accès des personnages et applique les conditions des parties privées des résumés avant d'envoyer les candidats. Il n'envoie que les messages originaux que les personnages qui rappellent la scène ont vus dans le chat, et chaque personnage ne reçoit toujours que les parties d'un résumé qui lui sont destinées. Les requêtes sont réparties en lots limités par le contexte de la connexion ; le contexte annoncé pour un routeur de discussion Jev n'est pas supposé s'appliquer aux décisions.

Chaque passe de rappel reçoit du temps pour son travail : environ le temps dont le modèle a besoin par question, multiplié par le nombre de questions, puis augmenté de moitié. Une passe dispose d'au moins 10 secondes et d'au plus 25, et les deux passes ensemble d'au plus 40 pour chaque réponse. Les modèles Open-Jev gérés utilisent leur temps mesuré par question ; une connexion de décision répond ensemble aux questions d'une même requête, et compte donc chaque requête une seule fois. Quand un tel modèle ne peut pas traiter toutes les questions dans ce temps, il en évalue moins, en commençant par les meilleures correspondances. Un modèle de chat interrogé une question à la fois compte 1 seconde par question, mais sa vitesse réelle est inconnue : on lui pose donc toutes les questions, et les réponses qui arrivent à temps comptent. Les questions partent dans de courtes requêtes : quand le temps est écoulé, les requêtes qui ont déjà reçu une réponse comptent quand même. Pendant le rappel, la réponse affiche son indicateur habituel **Thinking…**.

Quand une requête échoue ou dépasse le délai, ou qu'un résumé est trop volumineux pour être envoyé, seuls ces souvenirs reviennent au rappel habituel, après les scènes choisies par le modèle, et le rapport de rappel le signale. Une connexion manquante, et les passes pour lesquelles aucune réponse n'est revenue, font revenir entièrement au rappel habituel : le classement propre à la présélection choisit les scènes et la recherche textuelle choisit les extraits ; les décisions de scène indisponibles reviennent au mécanisme existant. Les embeddings sont aussi créés dans ce mode. Une scène qui vient d'être résumée les reçoit tout de suite. Les scènes préparées en mode de décision avant que ce mode crée des embeddings, et les souvenirs dont les embeddings viennent d'un autre modèle d'embeddings, les reçoivent après les réponses, quelques-uns à la fois, en commençant par les résumés et les scènes les plus récentes ; **Reindex** (réindexer) les crée tous d'un coup.

L'inspection du prompt reste en lecture seule et présente le rappel habituel sans appeler le fournisseur de décision. Dans **Peek Prompt → Decision diagnostics** (Peek Prompt → diagnostic des décisions), **Advanced Memory activity** (activité d'Advanced Memory) affiche les résultats enregistrés du dernier rappel et de la dernière vérification de scène : modèle, durée, scores, souvenirs ou débuts de scène sélectionnés, état du repli et raison pour laquelle une scène rappelée n'a pas d'extrait. Les rapports concernent les nouveaux appels effectués après cette mise à jour et conservent jusqu'à 128 résultats, les sélectionnés en premier. Ils décrivent une activité passée, pas une prévision pour l'aperçu ; ouvrir le panneau ou tester des déclarations du prompt ne relance pas les décisions de mémoire. Les vérifications de scène du modèle de décision utilisent toujours leur propre requête, distincte des lots de trackers et d'agents. Le rapport de rappel indique les décisions et les solutions de repli utilisées. Les swipes (réponses alternatives) compatibles réutilisent la sélection enregistrée ; modifier ces réglages invalide les sélections enregistrées incompatibles. Une continuation choisit de nouveau ses souvenirs.

<a id="deciding-who-sees-new-messages"></a>

### Décider qui voit les nouveaux messages

Dans un chat de groupe Roleplay où les personnages répondent l'un après l'autre, Advanced Memory peut décider quels personnages voient chaque nouveau message : tu n'as donc pas à masquer chaque réplique à un personnage qui a quitté la scène. Active **Decide who sees new messages** (décider qui voit les nouveaux messages) dans Advanced Memory. Cette option est désactivée par défaut et n'apparaît que dans les chats de groupe où les personnages répondent l'un après l'autre ; les chats de groupe en mode fusionné et les chats à un seul personnage ne la proposent pas.

Quand elle est activée, chaque nouveau message, le tien ou celui d'un personnage, est masqué aux personnages qui ne sont pas dans cette scène. Le résultat utilise le même masquage **Hide from AI** par personnage que le bouton du message lui-même : le marqueur en forme d'œil barré montre donc qui ne peut pas le voir. Pour ton propre message, la décision est prise dès que tu l'envoies, même si aucun personnage ne répond. Avant que le personnage suivant réponde, la décision est déjà prise pour les messages précédents : ce personnage ne lit donc jamais une réplique qu'il ne devrait pas lire.

- Le **Narrator** choisi ici et le **Narrator character** (personnage narrateur) choisi sous **Roleplay Commands** (commandes Roleplay) voient toujours tous les messages. L'auteur d'un message voit toujours son propre message. Le destinataire d'un murmure qui n'est pas dans la scène perd le reste du message, mais reçoit quand même le murmure.
- Avec **Use Decision model** activé, on demande au modèle de décision, pour chaque personnage, s'il ne peut clairement ni voir ni entendre le message, par exemple parce qu'il est ailleurs ou qu'il est parti. Un personnage que l'histoire ne place jamais dans la scène compte comme étant ailleurs. Un personnage présent mais exclu d'un murmure voit quand même le reste du message. Sinon, c'est le **Helper model** qui décide. Dans les deux cas, un message n'est masqué que si le modèle en est sûr ; sinon, le personnage continue de le voir. Quand une vérification de scène est due après une réponse, la même requête indique aussi qui est présent : aucun appel supplémentaire n'est donc fait pour ces messages.
- Le modèle lit les messages déjà échangés dans la scène en cours, et toujours au moins les quelques messages précédents, même quand une nouvelle scène vient de commencer. Il reçoit aussi la liste des personnages qui ont parlé depuis le début de la scène en cours. Cette liste n'est qu'une indication : un personnage qui écoute en silence compte quand même comme présent, même s'il n'a rien dit.
- Si tu modifies toi-même le réglage **Hide from AI** d'un message, ou si tu utilises `/hide` ou `/unhide` sur ce message, avant ou après le choix automatique, ton choix est conservé et Advanced Memory ne modifie plus jamais ce message. Les messages que tu avais déjà masqués à quelqu'un ne sont pas touchés.
- Chaque message ne fait l'objet que d'une seule décision. Si le modèle échoue ou ne répond pas à temps, rien n'est masqué pour ce message, et l'erreur apparaît dans le log du serveur, c'est-à-dire son journal.

Avec Advanced Memory activé, une nouvelle réponse de personnage peut changer de scène ou de point de vue grâce à une ligne de séparation comme `***`, `---` ou `* * *`. Elle est alors enregistrée sous forme de messages distincts du même personnage, un par partie.

- Chaque partie a son propre public. **Decide who sees new messages**, **Hide from AI** et les murmures s'appliquent à chaque partie séparément.
- Le personnage qui a écrit la réponse voit toujours toutes les parties, comme pour n'importe lequel de ses messages. Masque-lui toi-même une partie s'il ne doit pas la voir.
- La ligne de séparation reste en haut de la partie qui la suit. Une séparation à l'intérieur d'un bloc de code ou d'un bloc HTML, comme un panneau `<details>`, ne compte pas.
- La réflexion de la réponse s'affiche sur la première partie. Elle n'est pas renvoyée au modèle, même avec **Exclude Past Reasoning** (exclure le raisonnement passé) désactivé.
- Les informations du message, les trackers et les résultats des agents vont avec la dernière partie.
- Prose Guardian et les autres agents de réécriture réécrivent chaque partie séparément, et la ligne de séparation reste en haut. Avec **Hold Message Until Rewrite** (retenir le message jusqu'à la réécriture) activé, chaque partie attend sa propre réécriture. Si la réécriture d'une partie échoue, cette partie reste telle qu'elle a été écrite et les autres sont quand même réécrites.
- La lecture automatique à voix haute lit toutes les parties dans l'ordre.
- Faire un swipe sur une partie ou la régénérer donne une nouvelle version de ce seul message. Pour une partie antérieure, la nouvelle version ne garde que le texte situé avant la première séparation, car les scènes qui suivent ont déjà leurs propres messages.
- Continue et Impersonate ne découpent jamais la réponse.

<a id="character-recollections"></a>

### Souvenirs personnels des personnages

Active **Character recollections** (souvenirs personnels des personnages) dans Advanced Memory pour donner à chaque personnage son propre souvenir d'une scène. Cette option est désactivée par défaut.

- Pour chaque scène terminée, chaque personnage qui y était présent en reçoit un court souvenir, d'environ 50–100 mots, écrit à la première personne et avec sa propre voix : ce qu'il pense quand il s'en souvient et ce qui l'a le plus marqué. Sa fiche de personnage détermine ce qu'il remarque : un personnage logique ne retient donc pas les mêmes choses qu'un personnage attentif à ce que les autres ont ressenti. Le **Narrator**, ton persona et les personnages qui étaient ailleurs n'en reçoivent aucun.
- Le modèle a pour consigne de n'utiliser que ce que chaque personnage pouvait savoir. La requête signale chaque message masqué à un personnage, par le masquage propre à chaque personnage (y compris **Decide who sees new messages**) ou parce qu'il précède le début de sa plage de connaissance, et une partie de résumé écrite seulement pour certains personnages (`{{#if char == …}}`) n'appartient qu'à eux. Les messages masqués à tous par le masquage global **Hide from AI** restent dans la scène, comme pour les résumés. Un souvenir personnel qui recopie quatre mots d'affilée de quelque chose que son personnage ne pouvait pas savoir est écarté, sauf si ce personnage a lu cette expression ailleurs dans le chat ou dans sa propre fiche, ou si chacun de ses mots figure dans plusieurs messages qu'il a lus. Un fait redit avec d'autres mots n'est pas repéré de cette façon ; seules les instructions protègent contre ce cas.
- Un souvenir personnel ne compte que tant que son personnage peut lire exactement ce qu'il pouvait lire au moment où ce souvenir a été écrit. Si un message de la scène lui est ensuite masqué, ou au contraire affiché, un souvenir généré est réécrit, et un souvenir que tu as modifié reste hors des prompts jusqu'à ce que tu le vérifies et l'enregistres de nouveau.
- Les souvenirs personnels d'une nouvelle scène viennent de la même requête que son résumé ; celle-ci contient alors aussi la fiche de personnage complète de chaque personnage qui pouvait lire une partie de la scène, si bien qu'aucune requête supplémentaire n'est faite. Si les fiches obligeaient à découper la scène en plus de parties qu'il n'en faut sans elles, le résumé est écrit sans elles et les souvenirs personnels suivent dans une requête à part, un personnage à la fois quand plusieurs fiches découperaient la scène. Un personnage dont la fiche occupe plus de la moitié de la place dont le modèle auxiliaire dispose pour la scène ne reçoit aucun souvenir personnel. Une longue scène résumée en plusieurs parties se termine quand même par un seul souvenir personnel par personnage.
- Les requêtes qui n'écrivent que des souvenirs personnels incluent aussi les **Chat Summaries** qui couvrent la scène, ainsi que le résumé de la scène quand tu l'as modifié, pour qu'un souvenir personnel suive tes corrections.
- Activer ce réglage dans un chat dont les scènes sont déjà résumées ajoute des souvenirs personnels à ces scènes, une requête par scène ; la progression s'affiche sous le nom **Writing character recollections**. Les résumés de scènes, y compris ceux que tu as modifiés, ne changent jamais. Les scènes qui ont déjà des souvenirs personnels sont ignorées. Si une scène échoue, les autres reçoivent quand même les leurs, et **Resume** relance celles qui ont échoué.
- Si le modèle n'écrit rien d'utilisable pour un personnage, la scène garde pour lui un souvenir personnel vide, et aucun nouveau souvenir n'est demandé pour ce personnage tant que le résumé de la scène ou ce qu'il pouvait lire ne change pas. Tu peux en écrire un toi-même dans **Access memories for this chat**.
- Les souvenirs personnels n'apparaissent qu'avec les scènes rappelées, juste sous le résumé de la scène et avant son extrait, une ligne par personnage, par exemple `Kaito's personal recollections from this scene: *…*`. Dans un chat de groupe où les personnages répondent l'un après l'autre, un personnage ne voit que le sien, et le **Narrator** qui répond seul n'en voit aucun. Dans une réponse fusionnée, chaque personnage présent qui se souvient de la scène figure avec son nom, y compris quand le narrateur partage la réponse.
- Ils comptent dans **Summary and recall budget** : les résumés de scènes passent en premier, puis les souvenirs personnels, puis les extraits. Quand la place manque, les extraits rétrécissent d'abord, puis des souvenirs personnels entiers sont retirés. Un souvenir personnel n'est jamais tronqué.
- Les souvenirs personnels ne sont jamais copiés dans les **Chat Summaries** ni utilisés pour choisir les scènes à rappeler.
- Quand le résumé d'une scène change, parce que tu l'as modifié ou qu'il a été réécrit, ses souvenirs personnels générés sont périmés et restent hors des prompts. Après chaque réponse, une fois les Chat Summaries à jour, les souvenirs personnels d'au plus trois scènes sont réécrits, en commençant par les scènes les plus récentes ; **Prepare** (préparer), **Re-scan scenes** et **Resume** les réécrivent tous. Une scène dont la requête a échoué après une réponse attend **Prepare** ou **Resume**.
- Dans **Access memories for this chat**, ouvre une scène pour lire et modifier le souvenir personnel de chaque personnage sous **Character recollections**. Un souvenir personnel modifié est marqué **Manually edited** et n'est jamais remplacé. **Delete** (supprimer) retire un souvenir personnel des prompts, et celui-ci n'est plus jamais réécrit ; tu peux toujours en saisir un nouveau dans son champ vide.
- Désactiver ce réglage conserve les souvenirs personnels enregistrés, mais les laisse hors des prompts. Le réactiver dans un chat où le traitement des souvenirs personnels s'était arrêté relance ce traitement. L'export, l'import et les branches les incluent.

### Pendant le chat

La détection des scènes intervient après l'enregistrement de la réponse principale Roleplay. **Standalone scene check interval (messages)** vaut **5** par défaut. Dès que ce nombre de nouveaux messages est atteint, le vérificateur reçoit tous les messages depuis la dernière vérification (jusqu'au double de l'intervalle), le message sur lequel la dernière vérification s'est arrêtée pour comparaison, les instructions et le format de sortie. Il indique le message exact terminant chaque scène, éventuellement ce message antérieur, ou aucune fin si elle continue. Messages de persona et de personnage comptent tous. La cadence est indépendante des plannings des agents de suivi. Lorsque le mode de décision est désactivé, une vérification due partage un appel de suivi après génération si la visibilité des sources et le budget le permettent ; sinon, le modèle auxiliaire reçoit un appel séparé. Chaque plage commence après la fin précédente et inclut le nouveau message de fin. Seule une fin détectée prépare en arrière-plan le résumé et l'index de la scène close, même si la dernière réponse la termine. Un changement incertain laisse la scène ouverte. **Chat Settings → Agent activity** affiche **Advanced Recall**, avec progression, erreurs et reprise, même lorsque les agents ordinaires sont désactivés. Le suivi périodique ne fonctionne que pendant une tâche mémoire ; les archives prêtes ne sont pas interrogées au repos.

Lorsque le mode de décision est désactivé, le rappel habituel lit la mémoire préparée au lieu de préparer de nouveau l'archive. L'embedding facultatif de la requête a un délai court et utilise une recherche textuelle en repli s'il n'est pas disponible. La recherche textuelle donne plus de poids aux termes distinctifs de tes messages depuis la dernière prise de parole du personnage qui répond, pour qu'un bref détail puisse retrouver un long résumé de scène. Un nom qui y figure, par exemple celui d'un animal de compagnie, compte le plus. Les noms des personnages qui répondent et celui de ton persona ne comptent pas, pas plus qu'un nom présent dans la plupart des souvenirs. Les messages originaux indexés permettent aussi de retrouver des scènes lorsque la sortie des extraits est désactivée. La recherche textuelle n'ajoute aucun appel au modèle. Le rappel fonctionne uniquement pour la génération principale de Roleplay : agents, relances manuelles et générations auxiliaires d'essai ne le déclenchent pas et ne reçoivent ni résumés ni extraits rappelés. L'inspection du prompt principal reste en lecture seule.

Les variantes régénérées réutilisent la première mémoire compatible de cette réponse : continuité, résumés de scènes et extraits exacts. Les variantes inchangées ne relancent ni recherche ni auxiliaire. Continuer conserve la mémoire initiale. Les anciennes réponses sans instantané en sauvegardent un lors de leur prochaine génération et le réutilisent ensuite ; aucune réinitialisation n'est nécessaire. Les ajouts et regroupements en arrière-plan préservent les instantanés compatibles. Les modifications utilisateur de l'historique, des accès, des résumés ou des souvenirs invalident les instantanés incompatibles. La limite de contexte actuelle s'applique toujours. Un swipe relance aussi le rappel quand une scène antérieure que son personnage pouvait rappeler a été enregistrée, modifiée, activée ou désactivée depuis cette réponse. Une scène qui fait encore partie de l'historique du chat de la réponse régénérée ne peut pas encore être rappelée : l'enregistrer ne déclenche donc pas de nouveau rappel.

La génération principale lit immédiatement la mémoire enregistrée. Elle ne lance ni n'attend jamais la génération de continuité, même si un auxiliaire travaille en arrière-plan. Lorsque le prompt sortant atteint le plafond, la fenêtre actuelle repart du début de la scène la plus récente pour **tous les personnages**, puis grandit jusqu'au prochain dépassement. Les réponses de suivi après un appel de fonction ou un jet de dés ne comptent pas dans le plafond et ne déclenchent pas de réinitialisation. Cette coupure apparaît dans **Mark as new start**, avec **All** sélectionné ; décoche All pour l'annuler. Les marques personnelles restent applicables. Si une scène ouverte ou une constante trop longue ne tient pas, la demande utilise des extraits explicitement signalés et conserve les derniers messages. Cet ajustement temporaire ne crée pas d'autre marque persistante. Résumés enregistrés et messages originaux ne sont pas écrasés.

Après la réponse principale, Advanced Memory ajoute des **Chat Summaries** pour les messages archivés qu'aucun résumé ne couvre encore, en réutilisant les récapitulatifs de scènes terminés quand c'est possible. Les entrées inactives comptent comme couvertes. Dans un chat de groupe où les personnages répondent l'un après l'autre, tous ceux qui ont lu le récapitulatif d'une scène partagent un seul résumé de cette scène.

Quand les résumés actifs que lit un personnage dépassent 70% de **Summary and recall budget**, **Updating continuity** les combine et les raccourcit après la réponse, avec l'auxiliaire choisi et **Chat Summary → Maximum output size**. La réponse elle-même n'attend jamais cette étape. La part de chaque personnage est comptée séparément ; dans un chat de groupe en mode fusionné, cette part correspond à ce que contient le prompt commun. Un résumé qui couvre encore des messages de l'historique actuel d'un personnage attend que ces messages en sortent. Les 2 000 tokens supplémentaires concernent toute la mémoire, pas cette part.

Les résumés que lisent différents personnages sont combinés en un seul, y compris ceux que tu as rédigés ou modifiés toi-même. Les parties privées restent dans leurs sections `{{#if char == "Name"}}…{{/if}}`, réservées exactement aux personnages qui les connaissaient. Si le résultat de l'auxiliaire devait modifier qui peut lire une partie, il n'est pas enregistré et des groupes plus petits sont essayés à la place. Une partie destinée à un personnage qui a quitté le chat conserve sa condition, si bien qu'elle reste la sienne s'il revient. Les résumés qui utilisent d'autres macros que `{{user}}`, ou que seul le narrateur lit encore avec une telle partie, restent tels quels ; si eux seuls remplissent la part d'un personnage, raccourcis-les à la main ou augmente le budget. Les entrées remplacées, y compris les tiennes, deviennent inactives : tu peux donc les réactiver. Les résultats échoués ou incomplets ne sont pas enregistrés, et **Resume processing** les relance. Les résumés de scènes restent dans le coffre.

Le prompt d'un personnage n'affiche la plage de messages et les dates d'un résumé qu'à partir des messages que ce personnage peut voir. Quand il répond seul, le **Narrator** d'Advanced Memory lit une fois chaque partie de chaque résumé. Une partie qui dépend aussi d'une variable, ou qui utilise `{{char}}` pour plus d'un personnage, suit toujours sa condition.

L'archive rappelle les résumés pertinents et les dialogues exacts avec leurs numéros et locuteurs d'origine. Une section **Recalled Scenes** contient chaque résumé immédiatement suivi de son extrait disponible, sous un seul en-tête de plage ; les scènes sans extrait restent dans cette section. Le bloc précise la plage actuelle et le numéro du dernier message utilisateur. Une scène n'est rappelée que si toutes ses sources sont hors de l'historique actuel envoyé ; les extraits excluent aussi les messages actuels. Les **Chat Summaries** par plage sont également omis tant qu'un message couvert reste dans le contexte. Ils restent enregistrés et activés, puis redeviennent admissibles quand toute la plage est archivée. Les constantes admissibles priment sur le rappel facultatif et conservent leurs conditions de personnage. Tous les résumés sélectionnés réservent de la place avant les extraits. Les limites d'accès et de sources historiques restent applicables. Illustrations et légendes d'images sont omises des messages rappelés et des nouvelles entrées à résumer ; les pièces jointes textuelles lisibles restent disponibles. Personas et personnages comptent tous. Une régénération historique n'utilise que les sources antérieures à la réponse visée, même avant la fenêtre gérée. Modifier, changer de variante, masquer ou supprimer une source entraîne une nouvelle vérification de la mémoire dérivée avant utilisation.

Ouvre **Access memories for this chat** (Accéder aux souvenirs de ce chat) dans le même panneau pour chercher les résumés de scènes numérotés chronologiquement, examiner leurs périodes et leurs publics, modifier **Summary text** (Texte du résumé) ou lire les messages originaux complets avec **Inspect source messages** (Examiner les messages sources). Les extraits internes reproduits mot pour mot ne sont pas des entrées de résumé de scène distinctes. Des périodes narratives fondées sur les sources accompagnent le contexte rappelé ; les dates inconnues restent inconnues. Tu peux désactiver des enregistrements de rappel, réindexer, exporter/importer, ou confirmer **Delete all memories** (Supprimer tous les souvenirs) pour recommencer la préparation en conservant le chat et ses réglages. Les corrections des résumés manuels originaux sont préservées et invalident la continuité qui en dépend. Pour exclure une scène du rappel, désactive son enregistrement de mémoire. Le masquage des sources propre à chaque personnage contrôle toujours qui peut y accéder ; le masquage global ne la retire pas de l'archive.

Chaque résumé de scène enregistre aussi qui y a participé. Un nom de participant différent de celui de la fiche de personnage, comme "Kaito" pour **Kaito Nakamura**, compte quand même s'il correspond à un seul personnage et ne peut pas être le nom de ton persona. Les noms partagés par deux personnages, ou par un personnage et ton persona, les descriptions comme "Kaito's sister" et les noms accompagnés d'une note comme "(mentioned)" ne permettent jamais à un personnage d'y accéder. Le nom de ton propre persona n'est pas une erreur et ne permet à aucun personnage d'y accéder. Quand l'auxiliaire ne dit pas qui a participé, la scène est attribuée à tous les personnages : le seul personnage d'un chat à un seul personnage, ou tous ceux d'un chat de groupe. Dans un chat de groupe, Advanced Memory compte alors cela comme un problème de mémoire et marque la scène **Check who was there** dans **Access memories** : tu peux ainsi retirer avec **Edit character access** (modifier l'accès des personnages) quiconque n'était pas là, ou laisser **Fix** redemander à l'auxiliaire. Des noms qui ne correspondent à aucun personnage ne donnent aucun accès et sont marqués de la même façon, pour que tu puisses définir les participants de la scène. Une scène dans laquelle l'auxiliaire indique explicitement qu'il n'y avait que toi reste réservée au narrateur. Les résumés de scène enregistrés avant l'existence des vérifications de participants restent réservés au narrateur tant qu'ils n'ont pas été vérifiés : **Fix** et **Prepare existing history** les vérifient tous, et chaque réponse qui termine une scène en vérifie aussi jusqu'à trois. Une scène dont la vérification automatique échoue attend **Fix** ou **Prepare existing history**.

Un personnage présent pendant une partie d'une scène peut partager l'accès à son souvenir avec les autres participants, même si certains messages lui sont cachés. Une scène sans message source accessible reste indisponible. Les nouvelles instructions de résumé indiquent la visibilité des messages, décrivent les événements communs en texte simple et réservent `{{#if character == "Name"}}…{{/if}}` aux sections privées. Mentionner un personnage absent n'en fait pas un participant. Si la visibilité des sources ou le nom d'un personnage pour lequel le résumé a été rédigé change, l'ancien résumé n'est plus transmis aux lecteurs ayant un accès partiel jusqu'à ce que tu prépares à nouveau la scène (**Fix** le fait pour toutes ces scènes) ou vérifies ses conditions privées et enregistres le texte corrigé. Un personnage qui rejoint le chat plus tard ne compte pas comme un changement, sauf si une partie seulement de la scène lui est visible. Les résumés enregistrés par des versions antérieures n'indiquent pas pour quels personnages ils ont été rédigés : il faut donc lancer **Fix** une fois après l'arrivée d'un personnage. Les anciens résumés sans informations de visibilité enregistrées nécessitent la même vérification avant un accès partiel ; changer uniquement les destinataires ne valide pas le texte. Les lecteurs ayant accès à tous les messages sources peuvent toujours rappeler ce souvenir, et le texte corrigé manuellement n'est jamais réécrit en silence. Ces vérifications n'appellent aucun modèle pendant le rappel. Les dates et périodes d'une scène sont des métadonnées communes à tous les participants assignés, même si certains messages sources sont cachés. Les extraits bruts ne contiennent jamais de messages cachés au personnage ni de murmures. Un résumé dont certaines parties ne sont destinées qu'à certains personnages reçoit quand même un extrait : celui-ci ne cite que les messages que ce personnage a vus dans le chat, et ne révèle donc rien qu'il n'ait déjà vu. Pour garder un message hors de la mémoire d'un personnage, masque-le à ce personnage. Les Chat Summaries constants continuent d'inclure les messages cachés à l'IA ; les conditions par personnage contrôlent l'accès aux détails privés sans exclure ces messages de la couverture du résumé.

Dans un chat de groupe en mode fusionné, une seule réponse peut parler pour tous les personnages : le rappel inclut donc ce dont au moins un personnage du chat se souvient. Une scène ou une partie privée d'un résumé que seuls certains personnages du chat connaissent indique qui la connaît, par exemple "known only to Kaito". Ajouter un personnage en cours de route ne cache plus les souvenirs antérieurs aux autres. Un message masqué à un personnage reste exclu de l'historique actuel commun, mais les personnages qui pouvaient le voir gardent le souvenir, marqué comme le leur. L'extrait d'une scène rappelée ne cite que les messages que tous les personnages qui se souviennent de cette scène ont vus. Ce dont aucun personnage du chat ne se souvient, comme les scènes réservées au narrateur, reste exclu. Quand le narrateur partage une réponse fusionnée avec d'autres personnages, les résumés sont marqués de la même façon ; le narrateur ne lit toutes les parties que lorsqu'il répond seul. Dans les chats de groupe où les personnages répondent l'un après l'autre, chaque personnage ne rappelle toujours que ses propres souvenirs.

Lorsqu'il est activé, le mode avancé prend en charge le rappel ; le commutateur Standard Recall n'insère donc pas une deuxième copie. Il remplace aussi le calendrier habituel des résumés automatiques Roleplay de ce chat. Désactiver Advanced Memory rétablit ces réglages habituels. Les lorebooks existants et les agents téléchargés gardent leurs propres règles de portée ; Advanced Memory ne peut pas rendre privé n'importe quel contexte externe ou rédigé par l'utilisateur.

### Placement dans un preset

Les auteurs de presets peuvent placer ces marqueurs de contenu ordinaires avec les commandes existantes d'ordre, de nom, de rôle et de groupe des sections :

| Marqueur | Contenu |
| --- | --- |
| `chat_summary` | Entrées constantes admissibles de Chat Summaries. |
| `current_scene_summary` | Extraits sources limités de la partie ancienne d'une scène en cours. |
| `recalled_scenes` | Tous les résumés de scènes sélectionnées, chacun suivi de son extrait historique disponible. |

Chaque composant suit le format **XML**, **Markdown** ou **None** du preset et explique brièvement son rôle. Les composants vides ne produisent rien. La première occurrence activée détermine la position ; sans marqueur activé, le contenu apparaît une seule fois avant l'historique pour rester compatible avec les anciens presets. Le sélecteur du preset propose uniquement **Recalled Scenes** pour le rappel. Les marqueurs existants `recalled_messages` restent des alias compatibles, affichés comme Recalled Scenes ; un marqueur `recalled_scenes` activé a priorité, si bien qu'ils ne produisent jamais deux sections distinctes. Les extraits sont du contexte, pas de nouveaux messages ou commandes. Les marqueurs avancés de scènes restent vides lorsque Advanced Memory est désactivé.

L'aperçu utilise la mémoire préparée sans appels de modèles ni d'embeddings. Initialise l'archive ou reprends un traitement en arrière-plan ayant échoué depuis le panneau. Le reçu indique contexte estimé, limite choisie et sources. Quand rien n'a été rappelé, il précise si aucune scène antérieure n'était disponible pour le rappel, si la requête n'avait plus de place ou si rien n'était pertinent. L'inspecteur final montre la requête réellement envoyée.

### Limites et récupération

Le rappel est sélectif et les résumés peuvent perdre des nuances. Conserve les corrections importantes dans la transcription ou l'éditeur de résumés. Aucun système ne reconstruit des détails jamais enregistrés. Si les embeddings échouent, un rappel lexical limité et la continuité valide restent disponibles ; l'archive n'est jamais insérée en entier. Si les instructions obligatoires ou une pièce jointe dépassent le plafond du prompt, réduis-les ou augmente ce plafond. Si la réserve de réponse dépasse le contexte total du modèle, réduis la sortie ou choisis un modèle au contexte plus grand. Advanced Memory s'arrête plutôt que de supprimer silencieusement des instructions.

## Chat Summary (Roleplay)

**Chat Summary** compresse les messages anciens en courts récapitulatifs narratifs appelés entrées de résumé. Chaque entrée peut être écrite par l'IA ou à la main, et s'active ou se désactive individuellement. Cette fonction n'existe que dans les chats Roleplay. L'enregistrement d'un commutateur laisse les autres entrées utilisables ; Activate All et Deactivate All enregistrent la sélection ensemble.

Pour l'ouvrir, ouvre **Chat Settings** et déplie **Chat Summary**, sous **Lorebooks**. Sur un ordinateur, tu peux en faire une fenêtre séparée ; consulte [Présentation de Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Créer une entrée de résumé

1. Sous **Summary Scope**, choisis **Last** pour résumer les messages les plus récents, ou **Range** pour désigner une plage de messages précise.
2. Clique sur **Generate** pour que l'IA rédige une entrée à partir de cette portée.
3. Ou clique sur **Write** pour créer une entrée vide et écrire toi-même le récapitulatif.

Chaque entrée de la liste affiche un titre, une plage source ou un nombre de messages, et une taille estimée en tokens. Tu peux activer ou désactiver une entrée, la déplier, cliquer sur **Edit** pour la modifier, ou la supprimer avec **Delete**. Des boutons groupés permettent d'afficher ou de masquer les entrées inactives (**Show Inactive**, **Hide Inactive**) et de toutes les activer ou désactiver d'un coup (**Activate All**, **Deactivate All**).

Coche des entrées pour les sélectionner ; sur ordinateur, clique sur une autre entrée en maintenant Shift pour sélectionner toute la plage visible entre les deux, puis utilise **Enable selected** (activer la sélection) ou **Disable selected** (désactiver la sélection) pour ne modifier que les entrées sélectionnées.

Dans un chat de groupe en mode fusionné, une seule réponse peut parler pour tous les personnages. Une partie d'une entrée rédigée pour certains personnages, comme `{{#if char == "Kaito"}}…{{/if}}`, est conservée pour chaque personnage du chat qu'elle concerne et indique qui la connaît, par exemple "known only to Kaito". Les parties que seul le **Narrator** d'Advanced Memory reçoit restent exclues. Dans les chats de groupe où les personnages répondent l'un après l'autre, et dans les chats à un seul personnage, chaque personnage lit les entrées comme avant, et le **Narrator** d'Advanced Memory lit toutes les parties, quels que soient les personnages qu'elles nomment.

### Automatic Summaries

Le panneau **Automatic Summaries** maintient les résumés à jour au fil du chat. Il n'apparaît que dans les chats Roleplay.

- Active l'interrupteur **Enabled** dans le panneau **Automatic Summaries**.
- Règle la fréquence avec le champ **Every**, exprimé en messages de l'utilisateur. La valeur par défaut est 5, dans une plage de 1 à 200.
- Clique sur **Backfill Summary** pour rattraper un chat ancien qui n'a jamais eu de résumés. Le traitement se fait par lots et une barre de progression s'affiche pendant l'opération. Clique sur **Stop** pour l'interrompre.

### Les modèles de Summary Prompt

Le panneau **Summary Prompt** régit les instructions que l'IA suit pour rédiger un résumé. Clique sur **Edit** pour modifier le prompt actif. Clique sur **Templates** pour ouvrir le gestionnaire de modèles. Là, **New template** enregistre un prompt sous un nom. Chaque modèle enregistré a ses propres commandes **Duplicate**, **Edit** et **Delete**.

Les modèles enregistrés sont un réglage global, valable dans toute l'application. Modifier ou choisir un modèle depuis un chat Roleplay change le prompt de résumé utilisé dans tous les chats Roleplay.

### Summary Connection et taille de sortie

Le panneau **Summary Connection** désigne la connexion qui rédige les résumés. Sa valeur par défaut s'intitule **Agent default (falls back to chat connection)**. Autrement dit, la connexion par défaut de l'agent passe en premier, et celle du chat en second.

Le champ **Maximum output size** fixe la longueur maximale d'un résumé généré. La valeur par défaut est 4096 tokens, dans une plage de 1 à 32768.

### Options d'affichage

Les contrôles **Display** de **Chat Summary** décident de l'apparence à l'écran des messages résumés :

- **Hide summarised messages** : masque les messages bruts dès qu'un résumé les couvre. Désactivé par défaut.
- **Recent message tail** : garde ce nombre de messages récents entièrement visibles, même quand le masquage est actif. La valeur par défaut est 10, et tout nombre entier positif ou nul est accepté. Avec 0, tout le lot résumé est masqué. Plus la valeur est élevée, plus le prompt grossit et plus le modèle coûte cher.
- **Collapse hidden messages** : règle l'apparence des messages masqués dans la transcription.

Si le chat exige une validation d'écriture par l'agent (un réglage distinct, côté Agents), les résumés générés par l'IA attendent ta relecture avant de prendre effet.

## Automatic Summarization (Conversation)

Les chats Conversation reposent sur un autre système, appelé **Automatic Summarization**. Il clôt chaque journée par un résumé du jour, puis regroupe les semaines terminées en un résumé de la semaine. Le prompt n'envoie ensuite que les résumés de semaine, les résumés de jour de la semaine en cours et les messages du jour. Chaque requête reste ainsi légère.

Cette fonction tourne toute seule et ne peut pas être désactivée dans les chats Conversation.

### Ouvrir l'éditeur

1. Ouvre un chat Conversation et clique sur **Chat Settings**.
2. Repère la section **Automatic Summarization** (elle porte une icône de calendrier).
3. Clique sur **Edit Summaries** pour ouvrir la fenêtre **Automatic Summarization**.

La fenêtre liste d'abord les entrées de semaine, puis les jours pas encore rattachés à une semaine. Déplie une entrée pour modifier son texte **Summary** et sa liste **Key Details**, où des lignes s'ajoutent et se suppriment.

### Day Rollover Hour et Recent Message Tail

Deux réglages de la section **Automatic Summarization** déterminent le découpage des journées :

- **Day Rollover Hour** : l'heure à laquelle une nouvelle journée commence pour les résumés. La valeur par défaut est 4 AM, et le choix va de 12 AM (minuit) à 11 AM. Les messages envoyés avant cette heure comptent pour la journée précédente. Choisis un moment où tu ne discutes jamais, pour qu'une session nocturne ne soit pas coupée en deux.
- **Recent Message Tail** : le nombre de messages récents du jour qui restent mot pour mot, même une fois résumés. La valeur par défaut est 10, et tout nombre entier positif ou nul est accepté. Plus la valeur est élevée, plus le prompt grossit et plus le modèle coûte cher.

Si tu changes **Day Rollover Hour** alors que des résumés existent déjà, Marinara t'avertit que les anciens résumés ont été faits avec le réglage précédent.

### Compléter les jours manquants

Il arrive qu'une journée n'obtienne pas de résumé, par exemple après l'import d'un vieux chat. Le panneau **Missing Summaries** de la fenêtre contient un bouton **Backfill** qui réessaie les journées récentes sans résumé. Il remonte jusqu'à 14 jours à la fois.

Changer la connexion ou le modèle utilisé pour les résumés ne réécrit pas les entrées de jour ou de semaine déjà existantes.

## Dépannage

### Memory Recall ne rappelle rien

- Vérifie qu'une source d'embeddings est configurée. Si des blocs affichent **Embedding unavailable** dans **Memories for This Chat**, configure la section **Semantic Search (Embeddings)** d'une connexion, ou appuie-toi sur le modèle local intégré. Voir [Configurer le modèle local](../connections/local-model.md).
- Si des blocs affichent **Waiting for vector**, laisse-leur le temps. Les empreintes se construisent après les réponses.
- Le rappel n'ajoute que les souvenirs étroitement liés à ton dernier message. Si rien ne s'en approche, rien n'est ajouté. C'est normal.
- Si tu viens de changer de modèle d'embeddings, utilise l'icône de reconstruction dans **Memories for This Chat** pour aligner les anciens blocs sur le nouveau modèle.

### Les résumés ne se génèrent pas

- Vérifie que le chat dispose d'une connexion texte fonctionnelle. Chat Summary passe par **Summary Connection**, et Automatic Summarization par la connexion de résumé résolue. Si aucune ne fonctionne, la génération est ignorée.
- Si le chat exige une validation d'écriture par l'agent, les résumés de l'IA attendent ton approbation.
- Un résumé qui échoue est réessayé automatiquement après un délai. S'il reste bloqué, lance **Backfill Summary** (Roleplay) ou **Backfill** (Conversation) pour relancer la tentative à la main.

## Guides associés

- [Configurer le modèle local](../connections/local-model.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Mode Conversation : premiers pas](../conversation/getting-started.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
