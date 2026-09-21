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

- **Maximum allowed context before compression (tokens)** (contexte maximal avant compression) limite la requête complète et chaque traitement de mémoire, sans dépasser le contexte du modèle choisi. Prompt estimé, outils, pièces jointes, réserve de réponse et marge de sécurité comptent ; ce n'est pas un décompte exact ni une limite de facturation.
- **Maximum constant summary size (tokens)** (taille maximale des résumés constants) compte uniquement les constantes actives de **Chat Summaries** (résumés du chat), sans messages actuels, extraits rappelés ni scènes archivées. Des constantes de 8k sous une limite de 10k ne sont pas regroupées à cause des messages joints.
- **Helper model** (modèle auxiliaire) décide des scènes, les résume et compacte la continuité. Il utilise la connexion des agents, puis celle du chat en repli. La détection historique initiale peut utiliser le principal ou l'auxiliaire ; les résumés utilisent toujours l'auxiliaire. Les modèles retenus sont affichés avant la préparation.
- Tous les résumés de mémoire, y compris scènes et constantes, utilisent **Chat Summary → Maximum output size** (taille maximale de sortie). La limite propre à la connexion auxiliaire ne la remplace pas. Entrée et réserve de sortie doivent tenir ensemble dans le contexte.
- Chaque résumé de scène reçoit instructions, messages autorisés de cette scène, corrections pertinentes par plage et format JSON de sortie. Les scènes trop grandes sont traitées en lots sauvegardés, puis regroupées. Le prompt par défaut produit un récit historique sans situation actuelle ni tensions ouvertes ; les prompts personnalisés de **Summaries** restent applicables. Advanced Memory fonctionne indépendamment du commutateur principal Agents, sans agent à télécharger.
- **Maximum recalled scenes** (maximum de scènes rappelées) vaut **3** par défaut. C'est un plafond ; les correspondances faibles sont ignorées. **0** désactive les scènes facultatives et conserve la continuité nécessaire. Chaque scène fournit son résumé suivi d'au plus un extrait.
- **Moving context** (contexte mobile) définit les messages par extrait, **3–10** par défaut. Les deux limites à **0** donnent uniquement des résumés ; seul le minimum à **0** rend les extraits facultatifs. Pertinence, accès et espace peuvent réduire le nombre jusqu'à zéro.

Dans un ancien chat de groupe Individual, confirme une fois les plages de connaissances manquantes. La première réplique d'un personnage ne prouve pas qu'il connaissait tout ce qui la précédait. Ne désigne un personnage comme **Narrator** (narrateur) que s'il doit contourner les limites liées à sa participation. Les messages explicitement masqués et les marqueurs de début manuels limitent toujours la mémoire. Tu peux corriger ces plages plus tard ; les nouveaux personnages nécessitent leur propre confirmation.

Dans un chat existant, clique sur **Prepare existing history** (préparer l'historique existant). Le traitement avance par lots, avec l'étape près de la roue de Professor Mari. **Cancel** (annuler) conserve le travail terminé ; **Resume** (reprendre) continue après fermeture, redémarrage ou mise à jour. Les échecs conservent la mémoire valide et permettent de réessayer. Ne réinitialise pas la mémoire : la reprise réutilise les résumés terminés et la détection inchangée. La dernière scène reste ouverte jusqu'à sa fin ; si ses messages dépassent le contexte, des extraits sources limités sont utilisés avant son résumé final.

Ouvre un résumé dans **Access memories for this chat** et choisis **Delete summary** (supprimer le résumé) en bas. Confirme le résumé et son public. Cela fonctionne aussi pour les anciennes entrées **Continuity** (continuité) et **Ongoing scene** (scène en cours). La préparation habituelle ne recrée pas les résumés de scènes supprimés. Les messages originaux restent intacts. Les nouvelles constantes sont dans **Chat Summaries**, avec les commandes existantes de modification, activation, regroupement et suppression. L'ancienne continuité du coffre n'est plus une constante supplémentaire.

### Pendant le chat

La détection suit l'enregistrement de la réponse principale de Roleplay. **Standalone scene check interval (messages)** (intervalle indépendant de vérification) vaut **5** par défaut. L'auxiliaire reçoit uniquement la fenêtre récente, les instructions de scène et le format de sortie. Personas et personnages comptent. La vérification est indépendante des agents de suivi et de leurs calendriers. Seule une fin détectée prépare en arrière-plan résumé et index ; une transition incertaine garde la scène ouverte sans reconstruire l'archive. **Agents**, en haut à gauche, affiche **Advanced Recall**, avec progression, erreurs et reprise, même avec les agents ordinaires désactivés.

Le rappel lit la mémoire préparée. L'embedding facultatif de la requête a un délai court et utilise une recherche textuelle en repli. Le rappel fonctionne uniquement pour la génération principale de Roleplay : agents, relances manuelles et générations auxiliaires d'essai ne le déclenchent pas et ne reçoivent ni résumés ni extraits rappelés. L'inspection du prompt principal reste en lecture seule.

Les variantes régénérées réutilisent la première mémoire compatible de cette réponse : continuité, résumés de scènes et extraits exacts. Les variantes inchangées ne relancent ni recherche ni auxiliaire. Continuer conserve la mémoire initiale. Les anciennes réponses sans instantané en sauvegardent un lors de leur prochaine génération et le réutilisent ensuite ; aucune réinitialisation n'est nécessaire. Les ajouts et regroupements en arrière-plan préservent les instantanés compatibles. Les modifications utilisateur de l'historique, des accès, des résumés ou des souvenirs invalident les instantanés incompatibles. La limite de contexte actuelle s'applique toujours.

La génération principale lit immédiatement la mémoire sauvegardée, sans lancer ni attendre de génération de continuité, même si un auxiliaire travaille. À la limite de la requête complète, les anciennes scènes terminées quittent la fenêtre active. Si une scène ouverte ou une constante trop grande ne tient pas, des extraits sources explicitement signalés sont utilisés en gardant les derniers messages. Cet ajustement n'écrase ni résumés ni originaux.

Après la réponse principale, Advanced Memory complète les **Chat Summaries** par plages uniquement pour les messages archivés non couverts, réutilisant les résumés de scènes disponibles. Les entrées inactives comptent aussi comme plages traitées. Si les constantes actives dépassent **Maximum constant summary size**, **Updating continuity** (mise à jour de la continuité) regroupe après la réponse uniquement leurs textes, avec l'auxiliaire et **Chat Summary → Maximum output size**. Le remplacement apparaît dans Chat Summaries ; les entrées remplacées deviennent inactives et récupérables. Les scènes restent dans le coffre. Un échec conserve les résumés ; **Resume processing** (reprendre le traitement) permet de réessayer.

Le rappel fournit résumés pertinents et dialogues exacts, avec numéros originaux et locuteurs. Chaque résumé accompagne son extrait sous un seul en-tête de plage. Le bloc indique la plage actuelle et le numéro du dernier message utilisateur pour distinguer passé et présent. Une scène est rappelée seulement si toutes ses sources sont hors de l'historique envoyé ; les extraits excluent aussi les messages actuels. Un résumé manuel contribue seulement si toute sa plage est archivée. Une plage traversant la coupure n'est pas répétée entièrement à côté de ses messages actuels. Personas et personnages comptent. La régénération historique utilise les sources antérieures à la cible, même avant la fenêtre gérée. Modification, changement de variante, masquage ou suppression de sources entraîne une nouvelle vérification de la mémoire dérivée.

Ouvre **Access memories for this chat** dans le même panneau pour rechercher des résumés de scènes numérotés chronologiquement, examiner leurs périodes et leurs destinataires, modifier **Summary text** (texte du résumé) ou lire les messages originaux complets avec **Inspect source messages** (examiner les messages sources). Les extraits internes reproduits mot pour mot ne constituent pas des entrées distinctes de résumé de scène. Les repères temporels de l'histoire, tirés des sources, accompagnent le contexte rappelé ; les dates inconnues restent inconnues. Tu peux désactiver des enregistrements de rappel, réindexer, exporter/importer ou confirmer **Delete all memories** (supprimer tous les souvenirs) pour recommencer la préparation de la mémoire tout en conservant le chat original et ses réglages. Les corrections apportées aux résumés manuels originaux sont conservées et invalident la continuité qui en dépend. Désactiver un enregistrement est différent de masquer ses messages sources : les sources masquées font autorité pour les connaissances des personnages.

Lorsqu'il est activé, le mode avancé prend en charge le rappel ; le commutateur Standard Recall n'insère donc pas une deuxième copie. Il remplace aussi le calendrier habituel des résumés automatiques Roleplay de ce chat. Désactiver Advanced Memory rétablit ces réglages habituels. Les lorebooks existants et les agents téléchargés gardent leurs propres règles de portée ; Advanced Memory ne peut pas rendre privé n'importe quel contexte externe ou rédigé par l'utilisateur.

### Placement dans un préréglage

Les auteurs de préréglages peuvent placer ces marqueurs de contenu ordinaires avec les commandes existantes d'ordre, de nom, de rôle et de groupe des sections :

| Marqueur | Contenu |
| --- | --- |
| `chat_summary` | Entrées constantes admissibles de Chat Summaries. |
| `current_scene_summary` | Extraits sources limités de la partie ancienne d'une scène en cours. |
| `recalled_scenes` | Résumés de scènes sélectionnées sans extrait associé. |
| `recalled_messages` | Résumés de scènes avec extraits historiques exacts, locuteurs et plages sources. |

Chaque composant suit le format **XML**, **Markdown** ou **None** (aucun) du préréglage et explique brièvement son rôle. Les composants vides n'émettent rien. La première occurrence activée détermine le placement ; les composants sans marqueur activé sont insérés une fois avant l'historique, pour que les anciens préréglages fonctionnent. Les extraits sont du contexte, pas de nouveaux messages courants ni des commandes. Les trois nouveaux marqueurs sont vides quand Advanced Memory est désactivé.

L'aperçu utilise la mémoire préparée sans appels de modèles ni d'embeddings. Initialise l'archive ou reprends un traitement en arrière-plan ayant échoué depuis le panneau. Le reçu indique contexte estimé, limite choisie et sources ; l'inspecteur final montre la requête réellement envoyée.

### Limites et récupération

Le rappel est sélectif et les résumés peuvent perdre des nuances. Garde les corrections importantes dans la transcription source ou l'éditeur de résumés. Aucun système ne peut reconstruire des détails jamais enregistrés. Si les embeddings échouent, le rappel lexical limité et la continuité valide restent disponibles ; les archives ne sont jamais insérées en entier. Si les instructions obligatoires, une pièce jointe ou la réserve de réponse dépassent à elles seules la limite, réduis ces entrées ou augmente la limite ; Advanced Memory s'arrête au lieu de supprimer silencieusement des instructions.

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
