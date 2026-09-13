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

Ouvre **Chat Settings → Memory Recall** et active **Advanced Memory Recall (Alpha)**. Ce mode facultatif gère ensemble la fenêtre d'historique courant, les résumés de continuité et les extraits anciens pertinents. Les réglages, la progression de la préparation et la consultation des archives restent dans le panneau latéral Chat Settings, sur ordinateur comme sur mobile.

### Configuration

- Choisis un **maximum context** (contexte maximal) pris en charge par ton modèle de chat. La limite comprend les tokens estimés du prompt, les outils, les pièces jointes, la place pour la réponse et une marge de sécurité. Il s'agit d'une estimation, pas d'un comptage exact des tokens ni d'une limite de facturation.
- Choisis le **constant-summary budget** (budget du résumé permanent) à l'intérieur de cette limite. Un bref état de la continuité est inclus une seule fois dans chaque requête. Les messages récents restent intacts tant que la requête entière tient dans la limite.
- La **helper connection** (connexion auxiliaire) prend de petites décisions sur les scènes. Elle utilise par défaut la connexion des agents, puis celle du chat en l'absence de la première. Le traitement initial de l'historique peut utiliser le modèle principal ou auxiliaire ; les modèles retenus sont affichés avant la préparation.
- Les résumés de scènes et la compression utilisent ton modèle et tes prompts **Summaries** (résumés) existants. Advanced Memory fonctionne indépendamment du commutateur principal Agents et ne nécessite aucun agent à télécharger.
- La plage souhaitée de messages voisins est de **3–10** par défaut. La pertinence, les droits du personnage et l'espace disponible peuvent réduire leur nombre, jusqu'à zéro.

Dans un ancien chat de groupe Individual, confirme une fois les plages de connaissances manquantes. La première réplique d'un personnage ne prouve pas qu'il connaissait tout ce qui la précédait. Ne désigne un personnage comme **Narrator** (narrateur) que s'il doit contourner les limites liées à sa participation. Les messages explicitement masqués et les marqueurs de début manuels limitent toujours la mémoire. Tu peux corriger ces plages plus tard ; les nouveaux personnages nécessitent leur propre confirmation.

La préparation parcourt l'ancien historique par lots et affiche l'étape actuelle à côté de la roue de hamster de Professor Mari. **Cancel** (annuler) conserve le travail terminé ; **Resume** (reprendre) le poursuit après la fermeture du panneau ou le redémarrage du serveur. Un appel de modèle qui échoue conserve la mémoire auparavant valide et affiche une erreur permettant de réessayer.

### Pendant le chat

Quand la requête complète atteint la limite, Advanced Memory retire d'abord les rappels facultatifs, puis intègre les anciennes scènes terminées dans la continuité. Si une seule scène inachevée est trop longue, il résume temporairement sa partie ancienne tout en laissant la scène ouverte. Les messages originaux et les réglages manuels de début et de visibilité sont conservés.

Les archives peuvent retrouver des résumés de scènes pertinents et des dialogues exacts avec les numéros des messages d'origine et leurs locuteurs. Les messages des personas et des personnages comptent tous. La régénération d'une ancienne réponse utilise seulement les sources antérieures à sa cible, même si celle-ci précède la fenêtre actuellement gérée. Modifier, changer de variante, masquer ou supprimer des messages sources entraîne une nouvelle vérification de la mémoire dérivée concernée avant son utilisation.

Ouvre **Access memories for this chat** dans le même panneau pour examiner les sources et destinataires des scènes, modifier les résumés, désactiver des enregistrements de rappel, réindexer ou exporter/importer. Les corrections apportées aux résumés manuels originaux sont conservées et invalident la continuité qui en dépend. Désactiver un enregistrement est différent de masquer ses messages sources : les sources masquées font autorité pour les connaissances des personnages.

Lorsqu'il est activé, le mode avancé prend en charge le rappel ; le commutateur Standard Recall n'insère donc pas une deuxième copie. Il remplace aussi le calendrier habituel des résumés automatiques Roleplay de ce chat. Désactiver Advanced Memory rétablit ces réglages habituels. Les lorebooks existants et les agents téléchargés gardent leurs propres règles de portée ; Advanced Memory ne peut pas rendre privé n'importe quel contexte externe ou rédigé par l'utilisateur.

### Placement dans un préréglage

Les auteurs de préréglages peuvent placer ces marqueurs de contenu ordinaires avec les commandes existantes d'ordre, de nom, de rôle et de groupe des sections :

| Marqueur | Contenu |
| --- | --- |
| `chat_summary` | Bref état de continuité du personnage, de taille limitée. |
| `current_scene_summary` | Résumé temporaire de la partie ancienne d'une scène en cours. |
| `recalled_scenes` | Scènes archivées pertinentes. |
| `recalled_messages` | Extraits historiques exacts avec indications du locuteur et de la source. |

Chaque composant suit le format **XML**, **Markdown** ou **None** (aucun) du préréglage et explique brièvement son rôle. Les composants vides n'émettent rien. La première occurrence activée détermine le placement ; les composants sans marqueur activé sont insérés une fois avant l'historique, pour que les anciens préréglages fonctionnent. Les extraits sont du contexte, pas de nouveaux messages courants ni des commandes. Les trois nouveaux marqueurs sont vides quand Advanced Memory est désactivé.

L'aperçu du prompt utilise la mémoire déjà préparée sans lancer d'appel de modèle ni d'embedding. Si une initialisation ou une compression est nécessaire, prépare-la d'abord dans le panneau. Le relevé de mémoire indique la taille estimée du contexte, la frontière choisie et les sources rappelées ; l'inspecteur du prompt final montre ce qui a réellement été envoyé au modèle.

### Limites et récupération

Le rappel est sélectif et les résumés peuvent perdre des nuances. Garde les corrections importantes dans la transcription source ou l'éditeur de résumés. Aucun système ne peut reconstruire des détails jamais enregistrés. Si les embeddings échouent, le rappel lexical limité et la continuité valide restent disponibles ; les archives ne sont jamais insérées en entier. Si les instructions obligatoires, une pièce jointe ou la réserve de réponse dépassent à elles seules la limite, réduis ces entrées ou augmente la limite ; Advanced Memory s'arrête au lieu de supprimer silencieusement des instructions.

## Chat Summary (Roleplay)

**Chat Summary** compresse les messages anciens en courts récapitulatifs narratifs appelés entrées de résumé. Chaque entrée peut être écrite par l'IA ou à la main, et s'active ou se désactive individuellement. Cette fonction n'existe que dans les chats Roleplay.

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
