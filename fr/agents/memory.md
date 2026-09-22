# Mémoire et résumés de chat

Ce guide présente **Memory Recall** (recherche dans les anciens messages), l'option **Advanced Memory Recall (Alpha)** (rappel de mémoire avancé) pour gérer automatiquement le contexte en Roleplay, **Chat Summary** et **Automatic Summarization** en Conversation.

## Les deux systèmes de mémoire

Un modèle d'IA ne peut lire qu'une quantité limitée de texte à la fois. Cette limite s'appelle la fenêtre de contexte. Quand un chat (une conversation enregistrée) s'allonge, les messages les plus anciens sortent de cette fenêtre et l'IA les oublie. Marinara Engine (appelé simplement Marinara dans la suite) corrige ça avec deux systèmes distincts.

- **Memory Recall** cherche dans les messages anciens les passages les plus proches de ce que tu viens d'écrire, puis les remet discrètement dans le prompt (le texte que Marinara envoie à l'IA). Ça fonctionne dans tous les modes de chat.
- Les résumés compressent les vieux messages en courts récapitulatifs qui remplacent les messages bruts dans le prompt. Les chats Roleplay utilisent **Chat Summary**. Les chats Conversation utilisent **Automatic Summarization**.

Les chats Game Mode ont uniquement **Memory Recall**. Aucune des deux fonctions de résumé n'y est disponible.

Les deux systèmes s'utilisent en même temps. Ils font des choses différentes et n'entrent pas en conflit.

## Configurer Memory Recall

**Memory Recall** repère les fragments pertinents du début du chat et les insère dans le prompt sous forme de souvenirs. Pour ça, il utilise un embedding : une empreinte numérique du sens d'un message. Marinara compare l'empreinte du nouveau message aux empreintes stockées des messages passés, puis ajoute les correspondances les plus proches.

### Activer Memory Recall

1. Ouvre un chat et clique sur le bouton **Chat Settings** (réglages du chat) dans l'en-tête du chat.
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

Si aucune connexion d'embeddings n'est définie, Marinara se rabat sur un modèle d'embeddings local intégré. Il télécharge ce modèle une seule fois et le fait tourner sur ta machine, sans clé API (un code secret, un peu comme un mot de passe). Pour en savoir plus sur ce modèle intégré, voir [Configurer le modèle local](../connections/local-model.md).

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

## Advanced Memory Recall (Alpha, Roleplay)

Ouvre **Chat Settings → Memory Recall** et active **Advanced Memory Recall (Alpha)**. Tu peux aussi activer **Automatic context and memory handling (alpha)** (gestion automatique du contexte et de la mémoire) sous Agents dans l'assistant de configuration Roleplay. Ce mode facultatif gère ensemble la fenêtre d'historique courant, les résumés de continuité et les extraits anciens pertinents. Les réglages et la progression de la préparation sont disponibles dans l'assistant et dans le panneau latéral Chat Settings, sur ordinateur comme sur mobile. La consultation des archives reste dans le panneau Chat Settings.

### Configuration

- Choisis **Maximum allowed context before compression (tokens)** dans le contexte pris en charge par le modèle du chat. Ce plafond porte sur le prompt sortant estimé : instructions, messages, souvenirs rappelés, outils et pièces jointes, pour le chat comme pour le traitement de la mémoire. Les tokens de réponse et la marge de sécurité sont comptés séparément. La limite totale du modèle reste applicable ; ce plafond ne correspond pas à un décompte exact du tokenizer ni à la facturation.
- Choisis **Summary and recall budget (tokens)** (budget des résumés et du rappel) dans ce plafond. Les résumés constants actifs visent au plus **70%** de cette valeur. Priorité aux constantes, puis aux résumés des scènes sélectionnées, puis aux extraits de messages. La mémoire totale peut utiliser jusqu'à **2,000 tokens supplémentaires** si nécessaire, dans la limite du contexte complet. Avec 10k, la cible est au plus 7k de constantes et 12k au total ; les mêmes proportions valent pour les autres réglages. Les messages actuels ne comptent pas dans la part constante et ne déclenchent pas sa consolidation.
- **Helper model** (modèle auxiliaire) décide des scènes, les résume et compacte la continuité. Il utilise la connexion des agents, puis celle du chat en repli. La détection historique initiale peut utiliser le principal ou l'auxiliaire ; les résumés utilisent toujours l'auxiliaire. Les modèles retenus sont affichés avant la préparation.
- Tous les appels de résumé mémoire utilisent **Chat Summary → Maximum output size**, avec au moins **8,196 tokens de sortie** pour laisser de la place au raisonnement. Cela comprend les résumés de scènes et la consolidation des constantes ; les valeurs supérieures sont conservées. La limite habituelle de réponse de la connexion auxiliaire ne remplace pas ce réglage. Entrée et réserve de sortie doivent toujours tenir dans le contexte total du modèle.
- Chaque demande de résumé reçoit les instructions, les messages accessibles de la scène, les corrections par plage applicables et le format de sortie JSON. Les scènes trop longues sont traitées par lots enregistrés, puis combinées. Le récapitulatif demandé fait **2–3 paragraphes**. Le prompt par défaut relate les faits passés sans sections sur la situation actuelle ou les tensions ouvertes ; les prompts personnalisés choisis dans **Summaries** restent applicables. Advanced Memory fonctionne indépendamment de l'interrupteur principal Agents et ne nécessite aucun agent téléchargeable.
- **Maximum recalled scenes** (maximum de scènes rappelées) vaut **3** par défaut. C'est un plafond ; les correspondances faibles sont ignorées. **0** désactive les scènes facultatives et conserve la continuité nécessaire. Chaque scène fournit son résumé suivi d'au plus un extrait.
- **Moving context** (contexte mobile) définit les messages par extrait, **3–10** par défaut. Les deux limites à **0** donnent uniquement des résumés ; seul le minimum à **0** rend les extraits facultatifs. Pertinence, accès et espace peuvent réduire le nombre jusqu'à zéro.

Dans un ancien chat de groupe Individual, confirme une fois les plages de connaissances manquantes. La première réplique d'un personnage ne prouve pas qu'il connaissait tout ce qui la précédait. Ne désigne un personnage comme **Narrator** (narrateur) que s'il doit contourner les limites liées à sa participation. Les messages explicitement masqués et les marqueurs de début manuels limitent toujours la mémoire. Tu peux corriger ces plages plus tard ; les nouveaux personnages nécessitent leur propre confirmation.

Dans un chat existant, clique sur **Prepare existing history** (préparer l'historique existant). Le traitement avance par lots, avec l'étape près de la roue de Professor Mari. **Cancel** (annuler) conserve le travail terminé ; **Resume** (reprendre) continue après fermeture, redémarrage ou mise à jour. Les échecs conservent la mémoire valide et permettent de réessayer. Ne réinitialise pas la mémoire : la reprise réutilise les résumés terminés et la détection inchangée. La dernière scène reste ouverte jusqu'à sa fin ; si ses messages dépassent le contexte, des extraits sources limités sont utilisés avant son résumé final.

Ouvre un résumé dans **Access memories for this chat** et choisis **Delete summary** (supprimer le résumé) en bas. Confirme le résumé et son public. Cela fonctionne aussi pour les anciennes entrées **Continuity** (continuité) et **Ongoing scene** (scène en cours). La préparation habituelle ne recrée pas les résumés de scènes supprimés. Les messages originaux restent intacts. Les nouvelles constantes sont dans **Chat Summaries**, avec les commandes existantes de modification, activation, regroupement et suppression. L'ancienne continuité du coffre n'est plus une constante supplémentaire.

### Pendant le chat

La détection des scènes intervient après l'enregistrement de la réponse principale Roleplay. **Standalone scene check interval (messages)** vaut **5** par défaut. Le vérificateur reçoit les derniers messages numérotés, un message précédent pour le contexte, les instructions et le format de sortie. Il indique le numéro exact terminant chaque scène, ou aucune fin si elle continue. Messages de persona et de personnage comptent tous. La cadence est indépendante des plannings des agents de suivi. Une vérification due partage un appel de suivi après génération si la visibilité des sources et le budget le permettent ; sinon, le modèle auxiliaire reçoit un appel séparé. Chaque plage commence après la fin précédente et inclut le nouveau message de fin. Seule une fin détectée prépare en arrière-plan le résumé et l'index de la scène close, même si la dernière réponse la termine. Un changement incertain laisse la scène ouverte. Le menu **Agents** en haut à gauche affiche **Advanced Recall**, avec progression, erreurs et reprise, même lorsque les agents ordinaires sont désactivés. Le suivi périodique ne fonctionne que pendant une tâche mémoire ; les archives prêtes ne sont pas interrogées au repos.

Le rappel lit la mémoire préparée. L'embedding facultatif de la requête a un délai court et utilise une recherche textuelle en repli. Le rappel fonctionne uniquement pour la génération principale de Roleplay : agents, relances manuelles et générations auxiliaires d'essai ne le déclenchent pas et ne reçoivent ni résumés ni extraits rappelés. L'inspection du prompt principal reste en lecture seule.

Les variantes régénérées réutilisent la première mémoire compatible de cette réponse : continuité, résumés de scènes et extraits exacts. Les variantes inchangées ne relancent ni recherche ni auxiliaire. Continuer conserve la mémoire initiale. Les anciennes réponses sans instantané en sauvegardent un lors de leur prochaine génération et le réutilisent ensuite ; aucune réinitialisation n'est nécessaire. Les ajouts et regroupements en arrière-plan préservent les instantanés compatibles. Les modifications utilisateur de l'historique, des accès, des résumés ou des souvenirs invalident les instantanés incompatibles. La limite de contexte actuelle s'applique toujours.

La génération principale lit immédiatement la mémoire enregistrée. Elle ne lance ni n'attend jamais la génération de continuité, même si un auxiliaire travaille en arrière-plan. Lorsque le prompt sortant atteint le plafond, la fenêtre actuelle repart du début de la scène la plus récente pour **tous les personnages**, puis grandit jusqu'au prochain dépassement. Cette coupure apparaît dans **Mark as new start**, avec **All** sélectionné ; décoche All pour l'annuler. Les marques personnelles restent applicables. Si une scène ouverte ou une constante trop longue ne tient pas, la demande utilise des extraits explicitement signalés et conserve les derniers messages. Cet ajustement temporaire ne crée pas d'autre marque persistante. Résumés enregistrés et messages originaux ne sont pas écrasés.

Après la réponse principale, Advanced Memory complète les **Chat Summaries** par plage uniquement pour les messages archivés non couverts, en réutilisant les récapitulatifs de scènes disponibles. Les entrées existantes, même inactives, comptent comme des plages déjà traitées. Si les constantes actives admissibles dépassent 70% de **Summary and recall budget**, **Updating continuity** combine seulement leurs textes après la réponse, avec l'auxiliaire choisi et **Chat Summary → Maximum output size**. Les constantes recouvrant des messages actuels sont exclues du budget et de la compression ; les anciennes entrées sans plage restent admissibles. La réponse franchissant le seuil utilise normalement les constantes enregistrées, sans attendre la compression. Les 2,000 tokens supplémentaires concernent toute la mémoire, pas la part constante. Les modèles partagés dont les macros diffèrent selon le personnage restent inchangés ; s'ils dépassent seuls la cible, une modification manuelle est nécessaire. Les autres groupes reçoivent des indications de longueur proportionnelles plutôt qu'un seuil strict de rejet. Un remplacement plus court et terminé reçoit un titre par plage de messages et est enregistré en même temps que les anciennes entrées sont désactivées. Les résultats échoués ou incomplets ne sont pas enregistrés ; les entrées existantes restent utilisables et **Resume processing** reprend le travail inachevé. Les résumés de scènes restent dans le coffre.

L'archive rappelle les résumés pertinents et les dialogues exacts avec leurs numéros et locuteurs d'origine. Une section **Recalled Scenes** contient chaque résumé immédiatement suivi de son extrait disponible, sous un seul en-tête de plage ; les scènes sans extrait restent dans cette section. Le bloc précise la plage actuelle et le numéro du dernier message utilisateur. Une scène n'est rappelée que si toutes ses sources sont hors de l'historique actuel envoyé ; les extraits excluent aussi les messages actuels. Les **Chat Summaries** par plage sont également omis tant qu'un message couvert reste dans le contexte. Ils restent enregistrés et activés, puis redeviennent admissibles quand toute la plage est archivée. Les constantes admissibles priment sur le rappel facultatif et conservent leurs conditions de personnage. Tous les résumés sélectionnés réservent de la place avant les extraits. Les limites d'accès et de sources historiques restent applicables. Illustrations et légendes d'images sont omises des messages rappelés et des nouvelles entrées à résumer ; les pièces jointes textuelles lisibles restent disponibles. Personas et personnages comptent tous. Une régénération historique n'utilise que les sources antérieures à la réponse visée, même avant la fenêtre gérée. Modifier, changer de variante, masquer ou supprimer une source entraîne une nouvelle vérification de la mémoire dérivée avant utilisation.

Ouvre **Access memories for this chat** dans le même panneau pour rechercher des résumés de scènes numérotés chronologiquement, examiner leurs périodes et leurs destinataires, modifier **Summary text** (texte du résumé) ou lire les messages originaux complets avec **Inspect source messages** (examiner les messages sources). Les extraits internes reproduits mot pour mot ne constituent pas des entrées distinctes de résumé de scène. Les repères temporels de l'histoire, tirés des sources, accompagnent le contexte rappelé ; les dates inconnues restent inconnues. Tu peux désactiver des enregistrements de rappel, réindexer, exporter/importer ou confirmer **Delete all memories** (supprimer tous les souvenirs) pour recommencer la préparation de la mémoire tout en conservant le chat original et ses réglages. Les corrections apportées aux résumés manuels originaux sont conservées et invalident la continuité qui en dépend. Désactiver un enregistrement est différent de masquer ses messages sources : les sources masquées font autorité pour les connaissances des personnages.

Lorsqu'il est activé, le mode avancé prend en charge le rappel ; le commutateur Standard Recall n'insère donc pas une deuxième copie. Il remplace aussi le calendrier habituel des résumés automatiques Roleplay de ce chat. Désactiver Advanced Memory rétablit ces réglages habituels. Les lorebooks existants et les agents téléchargés gardent leurs propres règles de portée ; Advanced Memory ne peut pas rendre privé n'importe quel contexte externe ou rédigé par l'utilisateur.

### Placement dans un préréglage

Les auteurs de préréglages peuvent placer ces marqueurs de contenu ordinaires avec les commandes existantes d'ordre, de nom, de rôle et de groupe des sections :

| Marqueur | Contenu |
| --- | --- |
| `chat_summary` | Entrées constantes admissibles de Chat Summaries. |
| `current_scene_summary` | Extraits sources limités de la partie ancienne d'une scène en cours. |
| `recalled_scenes` | Tous les résumés de scènes sélectionnées, chacun suivi de son extrait historique disponible. |

Le sélecteur du preset propose uniquement **Recalled Scenes** pour le rappel. Les marqueurs existants `recalled_messages` restent des alias compatibles, affichés comme Recalled Scenes. Un marqueur `recalled_scenes` activé a priorité ; ils ne produisent jamais deux sections distinctes.

Chaque composant suit le format **XML**, **Markdown** ou **None** du preset et explique brièvement son rôle. Les composants vides ne produisent rien. La première occurrence activée détermine la position ; sans marqueur activé, le contenu apparaît une seule fois avant l'historique pour rester compatible avec les anciens presets. Les extraits sont du contexte, pas de nouveaux messages ou commandes. Les marqueurs avancés de scènes restent vides lorsque Advanced Memory est désactivé.

L'aperçu utilise la mémoire préparée sans appels de modèles ni d'embeddings. Initialise l'archive ou reprends un traitement en arrière-plan ayant échoué depuis le panneau. Le reçu indique contexte estimé, limite choisie et sources ; l'inspecteur final montre la requête réellement envoyée.

### Limites et récupération

Le rappel est sélectif et les résumés peuvent perdre des nuances. Conserve les corrections importantes dans la transcription ou l'éditeur de résumés. Aucun système ne reconstruit des détails jamais enregistrés. Si les embeddings échouent, un rappel lexical limité et la continuité valide restent disponibles ; l'archive n'est jamais insérée en entier. Si les instructions obligatoires ou une pièce jointe dépassent le plafond du prompt, réduis-les ou augmente ce plafond. Si la réserve de réponse dépasse le contexte total du modèle, réduis la sortie ou choisis un modèle au contexte plus grand. Advanced Memory s'arrête plutôt que de supprimer silencieusement des instructions.

## Chat Summary (Roleplay)

**Chat Summary** compresse les messages anciens en courts récapitulatifs narratifs appelés entrées de résumé. Chaque entrée peut être écrite par l'IA ou à la main, et s'active ou se désactive individuellement. Cette fonction n'existe que dans les chats Roleplay. L'enregistrement d'un commutateur laisse les autres entrées utilisables ; Activate All et Deactivate All enregistrent la sélection ensemble.

Pour l'ouvrir, clique sur le bouton **Chat Summary** (une icône de parchemin) dans l'en-tête du chat Roleplay. Le panneau contextuel **Chat Summary** s'ouvre.

### Créer une entrée de résumé

1. Sous **Summary Scope**, choisis **Last** pour résumer les messages les plus récents, ou **Range** pour désigner une plage de messages précise.
2. Clique sur **Generate** pour que l'IA rédige une entrée à partir de cette portée.
3. Ou clique sur **Write** pour créer une entrée vide et écrire toi-même le récapitulatif.

Chaque entrée de la liste affiche un titre, une plage source ou un nombre de messages, et une taille estimée en tokens. Tu peux activer ou désactiver une entrée, la déplier, cliquer sur **Edit** pour la modifier, ou la supprimer avec **Delete**. Des boutons groupés permettent d'afficher ou de masquer les entrées inactives (**Show Inactive**, **Hide Inactive**) et de toutes les activer ou désactiver d'un coup (**Activate All**, **Deactivate All**).

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

Les contrôles **Display** du panneau contextuel décident de l'apparence à l'écran des messages résumés :

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
