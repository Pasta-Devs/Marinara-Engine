# Mémoire et résumés de chat

Chaque modèle d'IA ne peut lire qu'une quantité limitée de texte à la fois, appelée la fenêtre de contexte. Dans un long chat (une conversation enregistrée), les messages les plus anciens en sortent et l'IA les oublie. Marinara Engine (appelé simplement Marinara dans la suite) a plusieurs façons de ramener cet historique. Ce guide montre comment activer chacune d'elles et comment la réparer quand elle ne fonctionne pas.

## Quelle fonction de mémoire choisir ?

Commence par **Memory Recall**. Il fonctionne sans configuration supplémentaire, car Marinara peut utiliser un modèle d'embeddings intégré sur ton ordinateur. Ajoute des résumés quand les chats deviennent très longs.

| Fonction | Ce qu'elle fait | Disponible en |
| --- | --- | --- |
| **Memory Recall** | Cherche dans les anciens messages les passages liés à ce que tu viens de dire et les ajoute au prompt (le texte que Marinara envoie à l'IA). | Tous les modes |
| **Chat Summary** | Remplace les anciens messages par de courts récapitulatifs. | Roleplay |
| **Automatic Summarization** | Résume chaque journée, puis chaque semaine. Toujours actif. | Conversation |
| **Advanced Memory Recall** | Gère ensemble l'historique actuel, les résumés de scènes et les extraits rappelés. Facultatif. | Roleplay et Game Mode |

Memory Recall et les résumés font des choses différentes et peuvent fonctionner ensemble. Les chats Game Mode ont Memory Recall et, en option, Advanced Memory Recall (voir [En Game Mode](#in-game-mode)). Ils n'ont pas de fonction de résumé propre.

## Memory Recall

Memory Recall utilise des embeddings. Un embedding est une empreinte numérique du sens d'un message. Marinara stocke les anciens messages en petits groupes appelés blocs (chunks). Marinara compare l'empreinte de ton nouveau message aux empreintes stockées, puis ajoute au prompt les blocs les plus proches.

### Activer Memory Recall

1. Ouvre un chat et clique sur **Chat Settings** (réglages du chat).
2. Repère la section **Memory Recall**.
3. Active **Enable Memory Recall** (activer Memory Recall).

Ce réglage est propre à chaque chat. Il est activé au départ dans les chats Conversation, ainsi que dans les chats Roleplay ou Game qui ont une scène active. Il est désactivé au départ dans les autres chats. Le désactiver arrête le rappel, mais ne supprime pas les souvenirs stockés.

Si ça n'a pas marché : Memory Recall a besoin d'une source d'embeddings (section suivante). Si tu n'en définis aucune, Marinara utilise son modèle intégré : la plupart des gens peuvent donc sauter cette section. Vérifie que la section **Memory Recall** apparaît bien. Certaines builds pour conteneurs, appelées Marinara Lite, la désactivent complètement.

### Définir la source d'embeddings (facultatif)

Memory Recall a besoin d'un modèle qui fabrique les empreintes. Si tu ne définis rien, Marinara utilise le modèle d'embeddings intégré (voir plus bas), la solution simple pour la plupart des gens. Pour utiliser plutôt un service, règle-le sur un compte, pas dans les réglages du chat.

Avant de commencer : il te faut un compte qui propose des embeddings. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Ouvre **Connections** (Connexions) et modifie le compte.
2. Repère la section **Semantic search (embeddings)** (recherche sémantique).
3. Saisis un nom de modèle d'embeddings, par exemple `text-embedding-3-small`.
4. Facultatif : renseigne **Embedding endpoint URL** (URL du point d'accès des embeddings) pour changer l'adresse.
5. Facultatif : utilise le menu **Embedding provider** (fournisseur d'embeddings) pour emprunter la clé et l'adresse d'un autre compte. **Same as this provider** (comme ce fournisseur) garde celles de ce compte.

Certains services ne proposent pas d'embeddings. Marinara te demande alors de choisir un compte d'embeddings dédié, par exemple un compte compatible OpenAI, Google ou le modèle intégré.

Pour utiliser une même source partout, choisis-la sous **Embeddings** dans **Connections → Defaults** (Connexions → Valeurs par défaut). Les comptes qui n'ont pas de modèle d'embeddings propre l'utilisent. Le réglage propre à un compte garde la priorité.

Sans compte d'embeddings ni valeur par défaut **Embeddings**, Marinara se rabat sur un modèle d'embeddings intégré. Il le télécharge une seule fois et le fait tourner sur ton ordinateur, sans clé API (un code secret, un peu comme un mot de passe). Voir [Configuration du modèle intégré](../connections/local-model.md).

Ce même réglage alimente aussi la recherche sémantique des lorebooks : tu le configures donc une seule fois pour les deux.

### Voir et gérer les souvenirs stockés

1. Ouvre **Chat Settings → Memory Recall**.
2. Clique sur **Access memories for this chat** (accéder aux souvenirs de ce chat). La fenêtre **Memories for This Chat** s'ouvre. Avec Advanced Memory activé, la consultation reste dans le panneau latéral Roleplay.

La fenêtre affiche le nombre de blocs stockés et une estimation approximative en tokens (un token est un petit morceau de texte). Chaque carte de bloc indique sa période, son nombre de messages, sa date de création et un statut.

| Statut | Signification |
| --- | --- |
| **Vectorized** | L'empreinte est construite et prête pour la recherche. |
| **Waiting for vector** | L'empreinte est encore en cours de fabrication. |
| **Embedding unavailable** | Aucune source d'embeddings n'a pu la construire. |

La barre d'outils propose des icônes pour exporter, importer, reconstruire et effacer les souvenirs.

- L'icône de corbeille d'un bloc ouvre **Forget Memory** (oublier le souvenir). Confirme avec **Forget** (oublier).
- L'icône pour tout effacer ouvre **Clear Memories** (effacer les souvenirs). Confirme avec **Clear** (effacer). Ça supprime les souvenirs de rappel, pas les messages du chat.
- L'icône d'actualisation reconstruit tous les blocs à partir des messages actuels. Sers-t'en après avoir changé de modèle d'embeddings.
- L'export enregistre un fichier `.marinara.json`. L'import accepte les fichiers `.json` ou `.marinara` et les fusionne avec les souvenirs existants.

### Le comportement de Memory Recall

- Marinara stocke les blocs en arrière-plan dès qu'une source d'embeddings existe, même si **Enable Memory Recall** est désactivé. L'interrupteur décide seulement si les souvenirs sont ajoutés au prompt.
- Il faut au moins 5 nouveaux messages pour créer un bloc.
- Les correspondances faibles sont écartées : le rappel peut donc ne rien renvoyer alors que des souvenirs existent. Seule une petite part du prompt sert aux souvenirs rappelés.
- Après un changement de modèle d'embeddings, les anciens blocs ne correspondent plus. Reconstruis-les.
- Supprimer les messages d'un chat supprime aussi ses blocs.

## Chat Summary (Roleplay)

Chat Summary compresse les anciens messages en courts récapitulatifs appelés entrées de résumé. Chaque entrée peut être écrite par l'IA ou par toi, et chacune peut être activée ou désactivée. Cette fonction est réservée aux chats Roleplay.

Ouvre **Chat Settings** et déplie **Chat Summary**, sous **Lorebooks**. Sur un ordinateur, tu peux l'ouvrir dans sa propre fenêtre. Voir [Vue d'ensemble des Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Créer une entrée de résumé

1. Sous **Summary Scope** (portée du résumé), choisis **Last** (derniers) pour les messages les plus récents, ou **Range** (plage) pour une plage de messages.
2. Clique sur **Generate** (générer) pour que l'IA rédige une entrée, ou sur **Write** (écrire) pour en écrire une toi-même.

Chaque entrée affiche un titre, sa plage source ou son nombre de messages, et une estimation en tokens. Tu peux l'activer ou la désactiver, la déplier, la modifier avec **Edit** (modifier) ou la supprimer avec **Delete** (supprimer). **Show Inactive** (afficher les inactives) et **Hide Inactive** (masquer les inactives) changent ce que la liste affiche. **Activate All** (tout activer) et **Deactivate All** (tout désactiver) basculent toutes les entrées d'un coup.

Pour modifier plusieurs entrées, coche-les (sur un ordinateur, clique en maintenant Shift pour sélectionner une plage), puis utilise **Enable selected** (activer la sélection) ou **Disable selected** (désactiver la sélection).

Si **Review Agent Outputs** (relire les sorties des agents) est activé, les résumés de l'IA attendent ton approbation. Voir [Approbations d'agents et Agent Suite](approvals-and-agent-suite.md).

### Automatic Summaries

Le panneau **Automatic Summaries** (résumés automatiques) maintient les résumés à jour au fil du chat.

1. Active **Enabled** (activé).
2. Règle **Every** (tous les) sur le nombre de messages de l'utilisateur entre deux résumés. La valeur par défaut est 5. La plage va de 1 à 200.
3. Facultatif : clique sur **Backfill Summary** (rattraper le résumé) pour résumer un ancien chat qui n'a jamais eu de résumés. Une barre de progression s'affiche. Clique sur **Stop** (arrêter) pour l'interrompre avant la fin.

### Prompt, fournisseur et taille de sortie des résumés

- **Summary Prompt** (prompt de résumé) : clique sur **Edit** pour changer les instructions que l'IA suit. Clique sur **Templates** (modèles) pour gérer les prompts enregistrés avec **New template** (nouveau modèle), **Duplicate** (dupliquer), **Edit** et **Delete**. Les modèles sont globaux : en choisir un dans un chat Roleplay change le prompt de tous les chats Roleplay.
- **Summary Provider** (fournisseur de résumés) : le compte qui rédige les résumés. Il utilise d'abord ton compte d'agent par défaut, puis celui du chat.
- **Maximum output size** (taille de sortie maximale) : la longueur maximale d'un résumé. La valeur par défaut est 4096 tokens. La plage va de 1 à 32768.

### Options d'affichage

- **Hide summarised messages** (masquer les messages résumés) : masque les messages bruts dès qu'un résumé les couvre. Désactivé par défaut.
- **Recent message tail** (derniers messages conservés) : garde ce nombre de messages parmi les plus récents visibles, même quand le masquage est actif. La valeur par défaut est 10. Tout nombre entier à partir de 0 fonctionne. Avec 0, tout le lot résumé est masqué. Plus la valeur est élevée, plus les prompts sont longs et coûteux.
- **Collapse hidden messages** (replier les messages masqués) : change l'apparence des messages masqués dans la transcription.

### Chats de groupe fusionnés

Dans un chat de groupe fusionné, une seule réponse parle pour tous les personnages. Une partie d'une entrée rédigée pour certains personnages, comme `{{#if char == "Kaito"}}…{{/if}}`, est conservée pour chaque personnage qu'elle concerne et indique qui la connaît, par exemple "known only to Kaito". Les parties que seul le **Narrator** (narrateur) d'Advanced Memory reçoit restent exclues. Dans les chats de groupe où les personnages répondent l'un après l'autre et dans les chats à un seul personnage, chaque personnage lit les entrées comme avant, et le Narrator lit toutes les parties.

## Automatic Summarization (Conversation)

Les chats Conversation résument chaque journée du calendrier, puis regroupent les semaines terminées en un résumé de semaine. Le prompt ne contient ensuite que les résumés de semaine, les résumés de jour de la semaine en cours et les messages du jour. Ce traitement tourne tout seul et ne peut pas être désactivé.

### Modifier les résumés

1. Ouvre un chat Conversation et clique sur **Chat Settings**.
2. Repère **Automatic Summarization**.
3. Clique sur **Edit Summaries** (modifier les résumés).

La fenêtre liste d'abord les semaines, puis les jours pas encore rattachés à une semaine. Déplie une entrée pour modifier son texte **Summary** (résumé) et ses lignes **Key Details** (détails clés).

### Définir la fin d'une journée

- **Day Rollover Hour** (heure de changement de jour) : l'heure à laquelle une nouvelle journée commence pour les résumés. La valeur par défaut est 4 AM. Tu peux choisir n'importe quelle heure de 12 AM (minuit) à 11 AM. Les messages envoyés avant cette heure comptent pour la journée précédente. Choisis un moment où tu ne discutes pas. Si tu la changes alors que des résumés existent déjà, Marinara t'avertit que les anciens résumés ont utilisé l'heure précédente.
- **Recent Message Tail** (derniers messages conservés) : le nombre de messages les plus récents du jour qui restent mot pour mot après avoir été résumés. La valeur par défaut est 10. Plus la valeur est élevée, plus les prompts sont longs et coûteux.

### Compléter les jours manquants

Il arrive qu'une journée n'ait pas de résumé, par exemple après l'import d'un ancien chat. Dans la fenêtre, le panneau **Missing Summaries** (résumés manquants) contient un bouton **Backfill** (rattraper). Il réessaie jusqu'à 14 journées récentes à la fois. Changer de modèle de résumé ne réécrit pas les entrées de jour ou de semaine existantes.

<a id="advanced-memory-recall-roleplay-and-game-mode"></a>

## Advanced Memory Recall (Roleplay et Game Mode)

Advanced Memory Recall est un mode facultatif qui gère ensemble la fenêtre d'historique actuel, les résumés de continuité et les anciens extraits. Il découpe le chat en scènes, résume chaque scène terminée et rappelle les scènes et les messages exacts qui comptent pour chaque réponse. Il fonctionne sans l'interrupteur Agents et ne nécessite aucun agent téléchargeable.

### L'activer

1. Ouvre **Chat Settings → Memory Recall**.
2. Active **Advanced Memory Recall**. Tu peux aussi activer **Automatic context and memory handling** (gestion automatique du contexte et de la mémoire), sous Agents, dans l'assistant de configuration Roleplay.
3. Règle **Maximum allowed context before compression (tokens)** (contexte maximal autorisé avant compression, en tokens) dans les limites de la fenêtre de contexte de ton modèle.
4. Règle **Summary and recall budget (tokens)** (budget des résumés et du rappel, en tokens) dans les limites de ce plafond.
5. Facultatif : choisis un **Helper model** (modèle auxiliaire).

Pour un chat qui a déjà un historique, clique d'abord sur **Prepare existing history** (préparer l'historique existant), décrit plus bas. Les réglages et la progression s'affichent à la fois dans l'assistant et dans le panneau latéral **Chat Settings**, sur ordinateur comme sur mobile. La consultation des archives reste dans le panneau latéral.

### Réglages

| Réglage | Par défaut | Rôle |
| --- | --- | --- |
| **Maximum allowed context before compression (tokens)** | 65 000 | Quand le prompt sortant atteint cette taille, le contexte le plus ancien est coupé et résumé pour le rappel. |
| **Summary and recall budget (tokens)** | 6 500 | La part du contexte consacrée aux souvenirs. Au moins 10% du maximum est recommandé. |
| **Helper model** | Compte des agents, puis compte du chat | Prend les décisions de scène, rédige les résumés et gère la continuité. |
| **Maximum recalled scenes** (maximum de scènes rappelées) | 3 | Plafond du nombre de scènes rappelées par réponse. 0 désactive le rappel facultatif des scènes. |
| **Moving context** (contexte mobile) | 3 à 5 messages | Messages de chaque extrait rappelé. 0 pour les deux donne des résumés sans extraits. |
| **Standalone scene check interval (messages)** (intervalle de vérification de scène autonome, en messages) | 5 | Nombre de nouveaux messages entre deux vérifications de scène. |
| **Use Decision model** (utiliser un modèle de décision) | Désactivé | Permet à un modèle de décision de trouver les fins de scène et de choisir les souvenirs. |
| **Decide who sees new messages** (décider qui voit les nouveaux messages) | Désactivé | Uniquement dans les chats de groupe où les personnages répondent l'un après l'autre. |
| **Character recollections** (souvenirs personnels des personnages) | Désactivé | Donne à chaque personnage son propre souvenir d'une scène. |

La valeur par défaut du budget est 10% du maximum par défaut. Modifier le maximum ensuite ne la change pas. Le plafond couvre tout le prompt sortant estimé : instructions, messages, contexte rappelé, outils et pièces jointes. Les tokens de réponse et la marge de sécurité sont comptés à part. C'est une estimation, pas un décompte exact du tokenizer ni une limite de facturation.

Tous les appels de résumé de la mémoire utilisent **Chat Summary → Maximum output size**, avec au moins 8 196 tokens de sortie pour laisser de la place au raisonnement.

### Préparer l'historique existant

1. Clique sur **Prepare existing history**. Les modèles retenus s'affichent avant le début.
2. Patiente. Le traitement parcourt l'ancien historique par lots et affiche son étape actuelle.
3. Utilise **Cancel** (annuler) pour l'arrêter. Le travail terminé est conservé. Utilise **Resume** (reprendre) pour continuer, même après avoir fermé le panneau latéral, redémarré le serveur ou mis à jour l'application.

Un appel au modèle qui échoue conserve la mémoire valide précédente et affiche une erreur pour réessayer. Ne réinitialise pas la mémoire après un échec : **Resume** réutilise les résumés terminés. La dernière scène en cours reste ouverte et sera résumée à sa fermeture.

Si l'historique récupéré change une scène couverte par une correction manuelle, désactive ce souvenir pour garder son texte comme référence, ou supprime-le, puis prépare de nouveau l'historique. **Fix** (corriger) ignore cette scène et la liste au lieu de s'arrêter.

Une branche créée à partir d'un chat préparé, par exemple avec **Branch from here** (créer une branche ici), garde son Advanced Memory. Une branche créée à l'intérieur d'une scène rouvre cette scène : son ancien résumé est supprimé et un nouveau est écrit à sa fermeture. Un chat importé comme nouvelle branche est préparé comme d'habitude.

<a id="fixing-memory-problems"></a>

### Corriger les problèmes de mémoire

Quand quelque chose est cassé dans la mémoire d'un chat, un point fixe de ta couleur d'accentuation apparaît sur le bouton **Chat Settings**, et une notification indique combien de scènes posent problème. Chaque série de problèmes n'est annoncée qu'une fois, et le point reste affiché jusqu'à ce qu'ils soient réglés. Dans **Chat Settings → Memory Recall**, les problèmes sont listés au-dessus des réglages. **Access memories for this chat** affiche le même point.

Appuie sur **Fix**, dans la notification ou dans la liste, pour réparer toutes les scènes signalées en une seule passe. La réparation utilise le **Helper model**. **Pause processing** (suspendre le traitement) l'interrompt et **Resume processing** (reprendre le traitement) la poursuit. Fix :

- redemande à l'auxiliaire qui était présent dans les scènes marquées **Check who was there** (vérifier qui était là). S'il ne peut toujours pas trancher, personne n'obtient d'accès et la scène est listée pour toi ;
- vérifie qui était présent dans les anciennes scènes enregistrées avant l'existence des vérifications de participants ;
- rédige de nouveaux résumés pour les scènes dont les messages, les messages masqués, les noms des personnages ou les résumés sur lesquels elles s'appuient ont changé, ainsi que pour les scènes terminées sans résumé. Les résumés que tu as supprimés restent supprimés ;
- reprend le travail de mémoire qui s'est arrêté sur une erreur.

Fix ne réécrit jamais un résumé que tu as modifié à la main. Il le liste sous **need your review** (à vérifier) et continue. Il ne peut pas changer des réglages à ta place, comme la plage de connaissance d'un personnage ou le choix d'une connexion de décision qui fonctionne.

Quand Fix a terminé, il affiche "Advanced Memory fixed N scenes" et les numéros des scènes à vérifier. Sélectionne un numéro pour ouvrir cette scène dans **Access memories for this chat**. Si Chat Settings était fermé, une notification avec **Show** (afficher) t'y amène. Le Fix suivant ne redemande rien sur une scène que Fix n'a pas pu trancher : enregistre donc toi-même l'accès de ses personnages.

### Réanalyser les scènes

Si des changements de scène ont été manqués, par exemple quand une scène ne s'est jamais terminée, utilise **Re-scan scenes** (réanalyser les scènes) dans **Chat Settings → Memory Recall**.

1. Saisis le numéro du premier et du dernier message à vérifier. Au départ, la plage couvre la scène en cours.
2. Appuie sur **Re-scan** (réanalyser).

Advanced Memory retrouve les changements de scène dans ces messages et résume les scènes qui ont changé. Il utilise le modèle de décision quand **Use Decision model** est activé, et le modèle auxiliaire sinon. Les scènes hors de la plage gardent leurs limites et leurs résumés. Si un résumé que tu as modifié devait changer, la réanalyse s'arrête et nomme cette scène.

<a id="optional-decision-model"></a>

### Modèle de décision facultatif

Un modèle de décision est un petit modèle qui répond à des questions par oui ou par non. Cette option est désactivée par défaut et enregistrée pour chaque chat Roleplay.

1. Active **Use Decision model** dans Advanced Memory.
2. Choisis un modèle dans **Memory Decision connection** (connexion de décision pour la mémoire). Sous **Built-in model** (modèle intégré), la liste propose les mêmes modèles que le **Decision model** (modèle de décision) global. Un modèle qui ne peut pas encore répondre est grisé et indique pourquoi, et un modèle arrêté démarre quand il est sollicité. Sous **Connections**, elle affiche tes comptes de décision enregistrés. Voir [Modèles de décision](../connections/decision-models.md).

Ce choix est distinct du réglage global de décision par défaut.

Le modèle identifie les limites de scène pendant la préparation de l'historique et la vérification des scènes en cours. Avant une nouvelle réponse, il choisit les souvenirs en deux passes. Voir [Fonctionnement du rappel par décision](#how-decision-recall-works) pour les détails.

Les comptes de services hébergés reçoivent le texte récent de la conversation et les récapitulatifs ou messages présélectionnés à évaluer, et peuvent facturer plusieurs requêtes pour une réponse. Le rappel filtre les accès des personnages avant d'envoyer les candidats.

<a id="deciding-who-sees-new-messages"></a>

### Décider qui voit les nouveaux messages

Dans un chat de groupe Roleplay où les personnages répondent l'un après l'autre, Advanced Memory peut décider quels personnages voient chaque nouveau message. Tu n'as alors pas à masquer chaque réplique à un personnage qui a quitté la scène. Les chats de groupe fusionnés et les chats à un seul personnage ne proposent pas cette option.

1. Active **Decide who sees new messages** dans Advanced Memory.

Chaque nouveau message, le tien ou celui d'un personnage, est masqué aux personnages qui ne sont pas dans la scène. Le résultat utilise le même masquage **Hide from AI** (masquer à l'IA) par personnage que le bouton du message lui-même : le marqueur en forme d'œil barré montre donc qui ne peut pas le voir. Pour ton message, la décision est prise dès que tu l'envoies. Pour les messages précédents, elle est prise avant que le personnage suivant réponde.

- Le **Narrator** choisi ici et le **Narrator character** (personnage narrateur) choisi dans les réglages des commandes Roleplay voient tous les messages. L'auteur d'un message voit toujours son propre message. Le destinataire d'un murmure qui n'est pas dans la scène reçoit quand même le murmure.
- Avec **Use Decision model** activé, on demande à ce modèle, pour chaque personnage, s'il ne peut clairement ni voir ni entendre le message. Un personnage que l'histoire ne place jamais dans la scène compte comme étant ailleurs. Sinon, c'est le **Helper model** qui décide. Un message n'est masqué que si le modèle en est sûr.
- Le modèle lit les messages déjà échangés dans la scène en cours, et au moins les quelques messages précédents. Il reçoit aussi la liste des personnages qui ont parlé depuis le début de la scène. Cette liste n'est qu'une indication : un personnage qui écoute en silence compte quand même comme présent.
- Si tu modifies toi-même le réglage **Hide from AI** d'un message, ou si tu utilises `/hide` ou `/unhide`, ton choix est conservé et Advanced Memory ne modifie plus jamais ce message.
- Chaque message ne fait l'objet que d'une seule décision. Si le modèle échoue ou ne répond pas à temps, rien n'est masqué et l'erreur est inscrite dans le log (le journal du serveur).

Avec Advanced Memory activé, une nouvelle réponse de personnage peut changer de scène ou de point de vue grâce à une ligne de séparation comme `***`, `---` ou `* * *`. La réponse est alors enregistrée sous forme de messages distincts du même personnage, un par partie.

- Chaque partie a son propre public. **Decide who sees new messages**, **Hide from AI** et les murmures s'appliquent à chaque partie.
- L'auteur voit toujours toutes les parties. Masque-lui toi-même une partie s'il ne doit pas la voir.
- La ligne de séparation reste en haut de la partie qui la suit. Une séparation à l'intérieur d'un bloc de code ou d'un bloc HTML comme `<details>` ne compte pas.
- La réflexion de la réponse s'affiche sur la première partie. Elle n'est pas renvoyée au modèle, même avec **Exclude Past Reasoning** (exclure le raisonnement passé) désactivé.
- Les informations du message, les trackers et les résultats des agents vont avec la dernière partie.
- Les agents de réécriture comme Prose Guardian réécrivent chaque partie séparément. Avec **Hold Message Until Rewrite** (retenir le message jusqu'à la réécriture) activé, chaque partie attend sa propre réécriture. Si une réécriture échoue, cette partie reste telle qu'elle a été écrite.
- La lecture automatique à voix haute lit toutes les parties dans l'ordre.
- Faire un swipe sur une partie (demander une réponse alternative) ou la régénérer crée une nouvelle version de ce seul message. Pour une partie antérieure, la nouvelle version garde le texte situé avant la première séparation.
- Continue et Impersonate ne découpent jamais la réponse.

<a id="character-recollections"></a>

### Souvenirs personnels des personnages

Active **Character recollections** pour donner à chaque personnage son propre souvenir d'une scène. Cette option est désactivée par défaut.

- Chaque personnage présent dans une scène terminée en reçoit un court souvenir, d'environ 50 à 100 mots, écrit à la première personne et avec sa propre voix. Sa fiche de personnage détermine ce qu'il remarque. Le **Narrator**, ton persona et les personnages qui étaient ailleurs n'en reçoivent aucun.
- Le modèle ne doit utiliser que ce que chaque personnage pouvait savoir. Un souvenir personnel qui recopie quatre mots d'affilée de quelque chose que son personnage ne pouvait pas savoir est écarté. Un fait redit avec d'autres mots n'est protégé que par les instructions.

Comment ils restent exacts :

- Un souvenir personnel ne compte que tant que son personnage peut lire exactement ce qu'il pouvait lire au moment où ce souvenir a été écrit. Si un message de la scène lui est ensuite masqué ou affiché, un souvenir généré est réécrit. Un souvenir que tu as modifié reste hors des prompts jusqu'à ce que tu le vérifies et l'enregistres de nouveau.
- Les souvenirs personnels d'une nouvelle scène viennent de la même requête que son résumé. Si une fiche de personnage est trop volumineuse pour ça, ils suivent dans leurs propres requêtes. Un personnage dont la fiche occupe plus de la moitié de la place dont le modèle auxiliaire dispose pour la scène n'en reçoit aucun.
- L'activer dans un chat dont les scènes sont déjà résumées ajoute des souvenirs personnels une scène à la fois ; la progression s'affiche sous le nom **Writing character recollections**. Les résumés de scènes ne changent jamais. **Resume** relance les scènes qui ont échoué.
- Si le modèle n'écrit rien d'utilisable, la scène garde un souvenir personnel vide jusqu'à ce que son résumé ou le texte que le personnage peut lire change. Tu peux en écrire un dans **Access memories for this chat**.

Où ils apparaissent et ce qu'ils coûtent :

- Les souvenirs personnels n'apparaissent qu'avec les scènes rappelées, sous le résumé de la scène et avant son extrait, une ligne par personnage. Dans un chat de groupe où les personnages répondent l'un après l'autre, un personnage ne voit que le sien. Dans une réponse fusionnée, chaque personnage présent qui se souvient de la scène figure avec son nom.
- Ils comptent dans **Summary and recall budget**. Les résumés passent en premier, puis les souvenirs personnels, puis les extraits. Les extraits rétrécissent d'abord, puis des souvenirs personnels entiers sont retirés. Un souvenir personnel n'est jamais tronqué.
- Les souvenirs personnels ne vont jamais dans les **Chat Summaries** et ne décident jamais des scènes rappelées.
- Après un changement du résumé d'une scène, ses souvenirs personnels générés sont réécrits pour au plus trois scènes après chaque réponse, en commençant par les plus récentes. **Prepare existing history**, **Re-scan scenes** et **Resume** les réécrivent tous.

Modifier et désactiver :

- Dans **Access memories for this chat**, ouvre une scène pour lire et modifier chaque souvenir personnel. Un souvenir modifié est marqué **Manually edited** et n'est jamais remplacé. **Delete** le retire définitivement des prompts, mais tu peux en saisir un nouveau.
- Désactiver ce réglage conserve les souvenirs personnels enregistrés, mais les laisse hors des prompts. L'export, l'import et les branches les incluent.

<a id="in-game-mode"></a>

### En Game Mode

Les chats Game Mode activent Advanced Memory Recall dans **Chat Settings → Memory Recall**, de la même façon. Sans cette option, une session Game envoie tout son historique à chaque tour jusqu'à la limite de contexte : une longue session coûte donc bien plus de tokens d'entrée par tour. Avec elle, le prompt reste sous **Maximum allowed context before compression**. La scène en cours est envoyée sous forme de messages actuels, et les scènes précédentes sous forme de récapitulatifs accompagnés des moments que le rappel choisit.

- **Le Game Master (GM, le maître du jeu) lit tous les souvenirs.** Il n'y a ni choix de Narrator, ni plages de connaissance, ni visibilité automatique des messages, ni souvenirs personnels des personnages.
- **Emplacement.** Les récapitulatifs et les scènes rappelées se placent après l'historique, juste avant les instructions du tour du GM. Les instructions et l'historique placés avant restent identiques d'un tour à l'autre : une connexion avec mise en cache des prompts peut donc les réutiliser. Quand une scène se termine, une requête ne profite pas du cache.
- **Source.** Les récapitulatifs suivent l'histoire telle que tu la vois : tes modifications de segments s'appliquent, et les balises de commande du GM sont exclues.
- **Sessions.** Une nouvelle session conserve tes réglages, mais commence sa propre archive. Le GM reçoit toujours les récapitulatifs des sessions précédentes.
- **Modèle de décision.** Facultatif et désactivé par défaut. Voir [Modèle de décision facultatif](#optional-decision-model). Il ajoute de petites requêtes à chaque tour.
- **Coût.** Le modèle auxiliaire écrit un récapitulatif par scène et vérifie s'il y a un changement de scène tous les quelques tours. Ces requêtes sont petites par rapport au renvoi d'une longue session.
- L'aperçu du prompt d'un chat Game n'affiche pas encore Advanced Memory. Utilise l'inspecteur final du prompt.

## Dépannage

| Problème | Solution |
| --- | --- |
| Memory Recall ne rappelle rien | Vérifie qu'une source d'embeddings est configurée. Si des blocs affichent **Embedding unavailable**, définis un modèle dans **Semantic search (embeddings)** ou utilise le modèle intégré. Voir [Configuration du modèle intégré](../connections/local-model.md). |
| Des blocs affichent **Waiting for vector** | Laisse-leur le temps. Les empreintes se construisent après les réponses. |
| Rien ne semble lié | Le rappel n'ajoute que les souvenirs étroitement liés. Ne rien ajouter est normal. |
| Le rappel s'est dégradé après un changement de modèle d'embeddings | Utilise l'icône de reconstruction dans **Memories for This Chat**. |
| Les résumés ne se génèrent pas | Le chat a besoin d'un compte texte qui fonctionne. Chat Summary utilise **Summary Provider**. Si aucun ne fonctionne, la génération est ignorée. |
| Les résumés de l'IA n'apparaissent jamais | **Review Agent Outputs** attend peut-être ton approbation. |
| Un résumé est bloqué | Les résumés qui échouent sont réessayés après un délai. Lance **Backfill Summary** (Roleplay) ou **Backfill** (Conversation). |
| Une scène est marquée **Check who was there** | Appuie sur **Fix**, ou ouvre-la dans **Access memories for this chat** et utilise **Edit character access** (modifier l'accès des personnages). |

Pour les autres problèmes, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Référence d'Advanced Memory

Des détails dont la plupart des lecteurs n'ont pas besoin. Les réglages ci-dessus fonctionnent sans lire cette partie.

### Comment les scènes sont détectées et résumées

- La détection des scènes intervient après l'enregistrement de la réponse principale Roleplay. Dès que l'intervalle de nouveaux messages est atteint, le vérificateur reçoit tous les messages depuis la dernière vérification (jusqu'au double de l'intervalle), le message sur lequel la dernière vérification s'est arrêtée, les instructions de scène et le format de sortie. Il indique le message exact qui termine chaque scène, ou aucun quand la scène continue. Les messages de persona et de personnage comptent tous.
- Quand le mode de décision est désactivé, une vérification due partage un appel admissible de tracker après génération si la visibilité et le budget de contexte le permettent. Sinon, l'auxiliaire fait son propre appel. Les changements incertains laissent la scène ouverte.
- Seule une fin détectée déclenche la préparation en arrière-plan du résumé et de l'index des messages de cette scène. **Chat Settings → Agent activity** (réglages du chat → activité des agents) affiche la progression sous le nom **Advanced Recall**, même quand les agents ordinaires sont désactivés.
- Chaque demande de résumé de scène contient les instructions de résumé, les messages admissibles de la scène, les corrections par plage applicables et le format de sortie JSON. Les scènes trop longues pour une seule demande sont traitées par lots enregistrés, puis combinées. Les récapitulatifs demandés font 2 à 3 paragraphes. Le prompt par défaut rédige un récapitulatif historique, sans section sur la situation actuelle. Les prompts personnalisés choisis dans **Summaries** restent applicables.
- La détection initiale dans l'historique peut utiliser le modèle principal ou l'auxiliaire. Les résumés utilisent toujours l'auxiliaire.
- Chaque résumé enregistre aussi qui y a participé. Un nom de participant différent de celui de la fiche, comme "Kaito" pour **Kaito Nakamura**, compte quand il correspond à un seul personnage et n'est pas le nom de ton persona. Les noms partagés, les descriptions comme "Kaito's sister" et les noms accompagnés d'une note comme "(mentioned)" ne donnent aucun accès. Quand l'auxiliaire ne dit pas qui a participé, la scène est attribuée à tous les personnages et, dans un chat de groupe, elle est marquée **Check who was there**. Une scène qui ne liste que toi reste réservée au narrateur. Les scènes enregistrées avant l'existence des vérifications de participants restent réservées au narrateur jusqu'à ce que **Fix** ou **Prepare existing history** les vérifie. Chaque réponse qui termine une scène en vérifie aussi jusqu'à trois.
- Dans un ancien chat de groupe où les personnages répondent l'un après l'autre, confirme une fois les plages de connaissance manquantes. La première réplique d'un personnage ne prouve pas qu'il savait tout ce qui la précédait. Choisis un véritable personnage comme **Narrator** seulement s'il doit contourner les limites de participation. Le masquage global **Hide from AI** retire seulement un tour de la transcription active. Advanced Memory continue de l'analyser, de le résumer et de l'indexer. Les marqueurs de début raccourcissent la transcription active.

### La fenêtre actuelle et le budget

- La priorité dans le prompt va aux constantes (les résumés toujours actifs), puis aux résumés des scènes sélectionnées, puis aux souvenirs personnels des personnages, puis aux extraits de messages. Les constantes visent au plus 70% du budget. La mémoire totale peut utiliser jusqu'à 2 000 tokens supplémentaires si nécessaire, dans la limite du plafond de contexte. Les messages actuels ne comptent pas dans la part des constantes.
- Quand le prompt sortant atteint le plafond, la fenêtre actuelle repart du début de la scène la plus récente pour tous les personnages, puis grandit de nouveau. Les réponses de suivi après un appel de fonction ou un jet de dés ne comptent pas. La coupure apparaît dans **Mark as new start** (marquer comme nouveau début) avec **All** (tous) sélectionné. Décoche All pour l'annuler. Les marques de début personnelles restent applicables. Si une scène inachevée ou une constante trop longue ne tient pas, la requête utilise des extraits sources signalés et conserve les derniers messages. Les résumés et les messages enregistrés ne sont jamais écrasés.
- La génération principale lit immédiatement la mémoire enregistrée. Elle n'attend jamais une tâche de continuité.
- Après la réponse principale, Advanced Memory ajoute des **Chat Summaries** pour les messages archivés qu'aucun résumé ne couvre encore. Dans un chat de groupe où les personnages répondent l'un après l'autre, tous ceux qui ont lu une scène en partagent un seul résumé.
- Quand les résumés actifs que lit un personnage dépassent 70% du budget, **Updating continuity** les combine et les raccourcit après la réponse, avec l'auxiliaire et **Chat Summary → Maximum output size**. La réponse n'attend jamais. Un résumé qui couvre encore des messages actuels attend qu'ils sortent de la fenêtre actuelle.
- Les résumés que lisent différents personnages sont combinés en un seul, y compris ceux que tu as rédigés. Les parties privées restent dans leurs sections `{{#if char == "Name"}}…{{/if}}`, réservées exactement aux personnages qui les connaissaient. Si un résultat devait modifier qui peut lire une partie, il n'est pas enregistré et des groupes plus petits sont essayés. Les résumés qui utilisent d'autres macros restent tels quels. Si eux seuls remplissent la part d'un personnage, raccourcis-les à la main ou augmente le budget. Les entrées remplacées deviennent inactives : tu peux donc les réactiver. **Resume processing** relance les résultats qui ont échoué.
- Le prompt d'un personnage n'affiche la plage de messages et les dates d'un résumé qu'à partir des messages que ce personnage peut voir. Quand il répond seul, le Narrator lit une fois chaque partie.

### Ce que renvoie le rappel

- Une seule section **Recalled Scenes** (scènes rappelées) contient chaque résumé suivi de son extrait éventuel, sous un seul en-tête de plage. Le bloc indique la plage actuelle de l'historique et le numéro du dernier message de l'utilisateur, pour que les événements passés ne soient pas pris pour le tour actuel.
- Une scène n'est rappelée que si tous ses messages sources sont hors de l'historique actuel envoyé. Les **Chat Summaries** par plage sont omis tant qu'un message couvert fait partie de l'historique actuel. Ils restent enregistrés et activés. Les constantes admissibles priment sur le rappel facultatif. Tous les résumés sélectionnés réservent leur place avant les extraits.
- Les illustrations jointes et les légendes d'images sont omises du texte rappelé et des nouvelles entrées à résumer. Les pièces jointes textuelles lisibles restent.
- Quand le mode de décision est désactivé, le rappel lit les souvenirs préparés. L'embedding de la requête a un délai court et se rabat sur une recherche textuelle. La recherche textuelle donne plus de poids aux termes distinctifs de tes messages depuis la dernière prise de parole du personnage qui répond. Un nom qui y figure compte le plus. Les noms des personnages qui répondent et celui de ton persona ne comptent pas, pas plus qu'un nom présent dans la plupart des souvenirs. Elle n'ajoute aucun appel au modèle.
- Le rappel ne fonctionne que pour la génération principale de Roleplay. Les appels d'agents, les relances manuelles d'agents et les essais à blanc ne le déclenchent pas et ne le reçoivent pas.
- Les swipes réutilisent la première mémoire compatible enregistrée pour cette réponse. Un swipe relance le rappel quand une scène antérieure que son personnage pouvait rappeler a été enregistrée, modifiée, activée ou désactivée depuis. Continuer une réponse conserve la mémoire avec laquelle elle a commencé. Les modifications de l'historique, des réglages d'accès, des résumés ou des souvenirs invalident les instantanés enregistrés.
- Modifier, faire un swipe, masquer ou supprimer des messages sources entraîne une nouvelle vérification de la mémoire concernée avant utilisation. Une régénération historique n'utilise que les sources antérieures à la réponse visée.
- Le reçu de mémoire indique la taille estimée du contexte, la limite choisie et les sources rappelées. Quand rien n'a été rappelé, il précise s'il n'existait aucune scène antérieure, s'il ne restait plus de place ou si rien n'était pertinent. L'aperçu du prompt utilise la mémoire préparée et ne lance aucun appel au modèle. L'inspecteur final du prompt montre ce qui a été envoyé au modèle.
- Quand une scène rappelée n'a pas d'extrait, le reçu en indique la raison : il ne restait plus de place après les résumés, ou aucun de ses messages ne peut être cité.

### Access memories for this chat

Ouvre cette vue pour chercher dans les résumés de scènes numérotés, voir leurs périodes et leurs publics, modifier **Summary text** (texte du résumé) ou lire les originaux avec **Inspect source messages** (examiner les messages sources). Tu peux désactiver des enregistrements, utiliser **Reindex** (réindexer), exporter et importer, ou utiliser **Delete all memories** (supprimer tous les souvenirs) pour recommencer la préparation en conservant le chat et ses réglages. Les corrections des résumés manuels sont conservées et invalident la continuité qui en dépend. **Delete summary** (supprimer le résumé), en bas d'un résumé, le supprime après que tu as confirmé le résumé et son public. Cela fonctionne aussi pour les anciennes entrées **Continuity** (continuité) et **Ongoing scene** (scène en cours). La préparation habituelle ne recrée pas les récapitulatifs supprimés.

Pour exclure une scène du rappel, désactive son enregistrement de mémoire. Le masquage propre à chaque personnage contrôle toujours qui peut y accéder. Le masquage global ne la retire pas de l'archive.

### Qui peut lire une scène

- Un personnage présent pendant une partie d'une scène partage l'accès à son souvenir, même si certains messages lui sont masqués. Une scène sans message source accessible est indisponible. Mentionner un personnage absent n'en fait pas un participant.
- Les nouveaux récapitulatifs indiquent la visibilité des messages, décrivent les événements communs en texte simple et utilisent `{{#if character == "Name"}}…{{/if}}` pour les sections privées. Si la visibilité ou le personnage pour lequel un récapitulatif a été rédigé change, l'ancien récapitulatif n'est plus transmis aux lecteurs ayant un accès partiel jusqu'à ce que tu prépares de nouveau cette scène (**Fix** le fait pour toutes ces scènes), ou que tu vérifies et enregistres ses conditions privées. Un personnage qui rejoint le chat plus tard ne compte pas, sauf si une partie seulement de la scène lui est visible. Les anciens récapitulatifs nécessitent un **Fix** après l'arrivée d'un personnage. Les lecteurs qui ont accès à tous les messages sources peuvent toujours rappeler la scène. Le texte corrigé à la main n'est jamais réécrit en silence.
- Les dates d'une scène sont communes à tous les participants assignés. Les extraits bruts ne contiennent jamais de messages masqués au personnage ni de murmures. Un résumé dont certaines parties ne sont destinées qu'à certains personnages reçoit quand même un extrait, qui ne cite que ce que ce personnage a vu. Pour garder un message hors de la mémoire d'un personnage, masque-le à ce personnage.
- Dans un chat de groupe fusionné, le rappel inclut ce dont au moins un personnage se souvient. Une scène ou une partie privée que tous les personnages ne connaissent pas est marquée, par exemple "known only to Kaito". Un extrait ne cite que les messages que tous les personnages qui se souviennent de la scène ont vus. Ce dont aucun personnage ne se souvient, comme les scènes réservées au narrateur, reste exclu. Dans les chats de groupe où les personnages répondent l'un après l'autre, chaque personnage ne rappelle que ses propres souvenirs.

<a id="how-decision-recall-works"></a>

### Fonctionnement du rappel par décision

- Le rappel habituel présélectionne d'abord jusqu'à 24 récapitulatifs de scène, ou jusqu'à **Maximum recalled scenes** si cette valeur est plus élevée. La présélection combine la recherche textuelle et les embeddings. Les embeddings comparent chaque scène à au plus six de tes messages envoyés depuis la dernière prise de parole du personnage qui répond. Une première réponse utilise ton dernier message. Tant que les embeddings ne couvrent pas presque toutes les scènes, la présélection utilise le classement du rappel habituel. La scène qui suit chacune des trois meilleures obtient aussi une place.
- Chaque récapitulatif que le modèle évalue commence par une ligne : plage de messages, date dans l'histoire et qui a parlé. Le modèle retient les scènes pertinentes, puis évalue jusqu'à 12 messages originaux de chaque scène retenue, ceux qui correspondent le mieux, pour choisir son extrait. Le meilleur choix en est le centre, et les autres l'allongent jusqu'à **Maximum messages per excerpt** (nombre maximal de messages par extrait).
- Pour chaque nouveau message, le modèle vérifie aussi si l'histoire passe à un autre lieu ou à un autre moment, bascule vers des personnages qui se trouvent ailleurs, ou suit une ligne de séparation de scène. Il voit les trois messages précédents et qui les a écrits. Les limites incertaines laissent la scène ouverte. Une décision valide peut ne rien sélectionner.
- Délais : chaque passe reçoit environ le temps dont le modèle a besoin par question, multiplié par le nombre de questions, puis augmenté de moitié, avec au moins 10 et au plus 25 secondes. Les deux passes ensemble disposent d'au plus 40 secondes par réponse. Quand un modèle ne peut pas traiter toutes les questions, il en évalue moins, en commençant par les meilleures correspondances. Les requêtes sont courtes : les réponses qui arrivent à temps comptent donc quand même. Pendant ce temps, la réponse affiche son indicateur habituel **Thinking…**.
- Quand une requête échoue, dépasse le délai ou est trop volumineuse, seuls ces souvenirs reviennent au rappel habituel, après les scènes choisies par le modèle, et le reçu le signale. Une connexion manquante ou une passe sans réponse fait revenir entièrement au classement de la présélection et à la recherche textuelle. Les décisions de scène indisponibles reviennent au vérificateur de scène standard.
- Les embeddings sont aussi créés dans ce mode. Une scène qui vient d'être résumée les reçoit tout de suite. Les scènes plus anciennes et celles créées avec un autre modèle d'embeddings les reçoivent après les réponses, quelques-unes à la fois. **Reindex** les crée toutes d'un coup.
- **Peek Prompt → Decision diagnostics → Advanced Memory activity** (Peek Prompt → diagnostic des décisions → activité d'Advanced Memory) affiche les résultats enregistrés du dernier rappel et de la dernière vérification de scène : modèle, durée, scores, souvenirs ou débuts de scène sélectionnés, état du repli et raison pour laquelle une scène n'a pas d'extrait. Il conserve jusqu'à 128 résultats. Ils décrivent une activité passée, pas des prévisions. L'ouvrir ne relance pas les décisions. Les swipes compatibles réutilisent les sélections enregistrées. Une continuation choisit de nouveau ses souvenirs.
- Les comptes de décision hébergés reçoivent des lots limités par leur budget de contexte. Les modèles Open-Jev gérés utilisent leur temps mesuré par question, et un compte de décision répond ensemble aux questions d'une même requête : il compte donc chaque requête une seule fois.

### Placement dans un preset

Les auteurs de presets peuvent placer ces marqueurs de contenu avec les commandes habituelles d'ordre, de nom, de rôle et de groupe des sections :

| Marqueur | Contenu |
| --- | --- |
| `chat_summary` | Entrées constantes admissibles de Chat Summaries. |
| `current_scene_summary` | Extraits sources de la partie la plus ancienne d'une scène en cours. |
| `recalled_scenes` | Tous les résumés de scènes sélectionnés, chacun suivi de son extrait. |

Chacun suit le format **XML**, **Markdown** ou **None** du preset. Les composants vides ne produisent rien. Le premier marqueur activé détermine la position. Les composants sans marqueur activé apparaissent une seule fois avant l'historique, pour que les anciens presets fonctionnent. Le sélecteur du preset propose uniquement **Recalled Scenes**. Un ancien marqueur `recalled_messages` est un alias, et un marqueur `recalled_scenes` activé a priorité. Ces marqueurs sont vides quand Advanced Memory est désactivé.

### Limites

Le rappel est sélectif, et les résumés peuvent perdre des nuances. Conserve les corrections importantes dans la transcription source ou dans l'éditeur de résumés. Si les embeddings échouent, un rappel textuel limité et la continuité valide restent disponibles. L'archive n'est jamais insérée en entier. Si les instructions ou une pièce jointe ne tiennent pas dans le plafond, réduis-les ou augmente le plafond. Si la réserve de réponse ne tient pas dans le contexte total du modèle, réduis la taille de sortie ou choisis un modèle au contexte plus grand. Advanced Memory s'arrête plutôt que de supprimer silencieusement des instructions.

Tant qu'il est activé, le mode avancé gère la récupération des souvenirs : Standard Recall n'insère donc pas de deuxième copie. Il remplace aussi le calendrier habituel des résumés automatiques Roleplay de ce chat. Le désactiver rétablit les réglages habituels. Les lorebooks existants et les agents téléchargeables gardent leurs propres règles de portée.

## Guides associés

- [Configuration du modèle intégré](../connections/local-model.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Mode Conversation : premiers pas](../conversation/getting-started.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
