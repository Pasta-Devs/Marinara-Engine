# Paramètres de génération

Les paramètres de génération sont les réglages qui pilotent la façon dont le modèle rédige chaque réponse, comme **Temperature** (température) et **Max Output Tokens** (nombre maximal de tokens en sortie). Les presets (des modèles de prompt enregistrés) et les comptes fournissent les valeurs par défaut, et la section **Advanced Parameters** (paramètres avancés) de **Chat Settings** (réglages du chat) les remplace pour un chat. Les valeurs par défaut conviennent bien au chat courant et au roleplay : ne modifie ces réglages que pour corriger un problème précis.

## Où les trouver

| Quoi | Où |
| --- | --- |
| Les valeurs de départ d'un preset | **Presets**, ouvre un preset, onglet **Parameters** (paramètres) |
| Les valeurs enregistrées sur un compte | **Connections** (Connexions), ouvre le compte, section **Chat defaults** (valeurs par défaut des chats) |
| Les remplacements pour un chat | **Chat Settings**, section **Advanced Parameters** |

Les presets ne fixent pas de limites de tokens de contexte ou de sortie. Règle la fenêtre de contexte dans **Connections**, et les limites de sortie dans **Connections** ou **Advanced Parameters**. Les anciens fichiers de preset se chargent toujours, mais leurs limites de tokens enregistrées sont ignorées. Le **Marinara's Universal Preset** intégré ne fournit aucun paramètre de génération.

Pour remplacer les paramètres d'un chat :

1. Ouvre le chat.
2. Ouvre **Chat Settings**.
3. Repère la section **Advanced Parameters** et clique dessus pour la déplier.
4. Repère le paramètre, par exemple **Temperature**, et saisis une nouvelle valeur.
5. Vérifie le petit interrupteur à côté de son nom. S'il est désactivé, active-le. Un paramètre dont l'interrupteur est désactivé n'est pas envoyé : ta modification ne sert alors à rien. L'interrupteur de **Temperature** démarre désactivé (voir [L'interrupteur Send](#the-send-switch)).

Une note s'affiche : "Change generation settings for this chat only. Leave these alone unless you know what they do." **Advanced Parameters** existe dans les chats Conversation, Roleplay et Game.

## Chaque paramètre en langage clair

Chaque paramètre numérique a un champ de saisie et un interrupteur Send (voir plus bas).

| Paramètre | Ce qu'il fait | Plage |
| --- | --- | --- |
| **Temperature** | Le hasard. Plus la valeur est basse, plus la réponse est ciblée et prévisible. Plus elle est haute, plus la réponse est créative. Une valeur proche de 1 est un juste milieu courant. | 0 à 2 |
| **Max Output Tokens** | La réponse la plus longue que le modèle peut écrire en un tour. Les tokens sont de petits morceaux de texte. Augmente cette valeur si les réponses sont coupées. | Pas de plafond fixe |
| **Top P** | Le modèle ne puise que parmi les mots les plus probables dont la probabilité cumulée atteint cette valeur. Avec 1, il envisage tout. | 0 à 1 |
| **Top K** | Limite le modèle aux quelques mots les plus probables à chaque étape. 0 désactive cette limite. Beaucoup de services l'ignorent. | 0 à 500 |
| **Frequency** | Pénalise les mots d'autant plus qu'ils sont déjà apparus souvent. Les valeurs positives réduisent les répétitions de mots. | -2 à 2 |
| **Presence** | Pénalise les mots déjà apparus, ne serait-ce qu'une fois. Les valeurs positives poussent vers de nouveaux sujets. | -2 à 2 |

**Frequency** et **Presence** sont les pénalités de répétition.

**Reasoning Effort** (effort de raisonnement) indique à un modèle capable de réflexion, c'est-à-dire un modèle qui décortique d'abord le problème par étapes cachées, à quel point raisonner avant de répondre. Les choix sont **Off**, **Low**, **Medium**, **High**, **Extra high** et **Maximum**. Si le modèle ne prend pas en charge ton niveau, Marinara le redescend au niveau le plus élevé que le modèle accepte. Une fois un modèle choisi, les boutons portent le nom du niveau que reçoit ce modèle : **Maximum** peut donc s'afficher sous la forme **Max**, **Extra high** ou **High**.

- Quand l'interrupteur Send est activé, **Off** demande au service de désactiver la réflexion, si le modèle est réputé le prendre en charge. Certains modèles ne peuvent pas désactiver la réflexion et peuvent quand même renvoyer du raisonnement. Choisis un modèle sans raisonnement quand la réflexion doit être absente.
- Quand l'interrupteur Send est désactivé, aucune préférence de raisonnement n'est envoyée, et le service applique son propre comportement par défaut.

**Verbosity** (verbosité) règle la longueur et le niveau de détail des réponses : **None**, **Low**, **Medium** ou **High**. Seuls certains modèles s'en servent.

## Conseils de réglage

Change un seul réglage à la fois, pour repérer ce qui a aidé. Ce sont des règles empiriques, et les modèles diffèrent.

| Problème | Essaie |
| --- | --- |
| Les réponses semblent rigides ou répétitives | Monte un peu **Temperature**, entre 1,1 et 1,3. |
| Les réponses partent dans tous les sens ou hors sujet | Baisse **Temperature**, entre 0,7 et 0,9. |
| Les réponses sont coupées | Augmente **Max Output Tokens**. |
| Un personnage répète les mêmes tournures | Monte un peu **Frequency** ou **Presence**, entre 0,3 et 0,6. |

Pour savoir quels paramètres ont été envoyés pour un message, utilise **Peek Prompt**. Il montre le prompt assemblé, plus le modèle, la température, le nombre maximal de tokens, l'effort de raisonnement et d'autres informations.

<a id="the-send-switch"></a>

## L'interrupteur Send

Chaque paramètre numérique, ainsi que **Reasoning Effort** et **Verbosity**, a un petit interrupteur à côté de son nom. Il n'a pas d'étiquette. Passe le pointeur dessus pour lire "This parameter is sent to the model" ou "This parameter is not sent to the model."

- Activé : Marinara inclut le paramètre dans la requête.
- Désactivé : Marinara l'omet, et le service applique sa propre valeur par défaut. Ce n'est pas la même chose qu'une valeur comme 0 ou 1, qui dit encore au service quoi utiliser.

Sers-t'en quand un service indique que deux réglages ne peuvent pas être utilisés ensemble (désactive l'un des deux), ou quand une erreur signale qu'un paramètre n'est pas accepté (désactive-le) ou qu'il est obligatoire (active-le).

Dans la section **Advanced Parameters** d'un chat, seuls **Max Output Tokens** et **Reasoning Effort** sont envoyés par défaut.

## Valeurs par défaut

Ce sont les valeurs que l'éditeur affiche, pas toujours celles qui sont envoyées. Sans preset, la génération commence avec 4 096 tokens de sortie, avant les remplacements du compte et du chat. Une scène active peut utiliser 8 192. La ligne **Effective** (valeur effective) montre la valeur obtenue.

| Paramètre | Valeur de départ | Envoyé par défaut |
| --- | --- | --- |
| Temperature | 1 | Non |
| Max Output Tokens | 4 096 en Conversation, 8 192 en Roleplay ; aucun remplacement propre à Game | Oui |
| Top P | 1 | Non |
| Top K | 0 (désactivé) | Non |
| Frequency | 0 | Non |
| Presence | 0 | Non |
| Reasoning Effort | Maximum | Oui |
| Verbosity | High | Non |

Une valeur reste affichée dans le champ quand son interrupteur Send est désactivé. Elle n'est pas envoyée tant que tu n'actives pas l'interrupteur.

## Préremplissages et balises de réflexion

**Assistant Prefill** (préremplissage de la réponse) est un texte facultatif ajouté au tout début de la réponse de l'IA. Laisse-le vide, sauf si un modèle le prend en charge.

- C'est la dernière chose envoyée, après ton message et toutes les instructions qui le suivent.
- Si le chat se termine sur une réponse de l'IA et que **Post-Processing Messages** (post-traitement des messages) vaut **Apply**, le préremplissage est ajouté à la fin de cette réponse.
- Certains modèles refusent un prompt qui se termine sur les propres mots de l'IA, dont **Claude (Subscription)** avec n'importe quel modèle. Pour eux, Marinara ajoute plutôt le préremplissage au début de la dernière réponse de l'IA : la nouvelle réponse ne commence donc pas par lui.
- Dans un chat qui n'a encore aucune réponse de l'IA, le préremplissage est envoyé à la fin, en tant que message de ta part.

**Assistant Reasoning Prefill** (préremplissage du raisonnement de l'assistant) est un texte caché facultatif ajouté au tout début du raisonnement de l'IA, avant la réponse visible. Ne l'utilise qu'avec les modèles qui prennent en charge un préremplissage de raisonnement distinct, comme Kimi K3. Il peut s'utiliser avec **Assistant Prefill**.

**Thinking Tags** (balises de réflexion) indiquent à Marinara comment un modèle délimite son raisonnement caché dans le texte brut, pour qu'il puisse masquer ce raisonnement derrière **View model thoughts** (voir les pensées du modèle). Écris une encapsulation par ligne, avec un emplacement au milieu pour le texte caché. Les encapsulations courantes, comme think, thinking, thought, pipe, channel et les paires de crochets, sont déjà reconnues. Tu n'en as besoin que pour une encapsulation inhabituelle.

## Custom Parameters

**Custom Parameters** (paramètres personnalisés) permet d'ajouter des réglages bruts pour lesquels Marinara n'a pas de champ. Saisis un objet JSON, et Marinara le fusionne dans la requête.

- Enregistrés comme valeurs par défaut du compte, ils partent avec chaque génération de texte qui utilise ce compte : Conversation, Roleplay, Game, Noodle, résumés, agents et packages d'agents installés. Cela comprend les points d'accès personnalisés sur ta propre machine.
- Les Custom Parameters propres à un chat s'ajoutent pour ce chat et l'emportent sur les clés identiques du compte.
- Une clé erronée peut faire rejeter la requête par le service. Utilise `true`, `false` et `null` en minuscules. Laisse ce champ vide, sauf si le guide d'un service te demande d'ajouter une clé.

## Service Tier

**Service Tier** (niveau de service) n'apparaît que si le compte du chat utilise OpenRouter ou NanoGPT. Il choisit la façon dont le service achemine ta requête. **Default** n'envoie aucun niveau. **Flex** peut coûter moins cher et être plus lent. **Priority** peut aller plus vite et coûter davantage.

## Limite de messages de contexte

**Limit Context Messages** (limiter les messages de contexte, aussi affiché sous le nom **Context message limit**) n'envoie que les N derniers messages au lieu du chat entier. Il est désactivé par défaut. Quand tu l'actives, le compteur démarre à 50, et tu peux choisir de 1 à 9 999. Un nombre plus petit réduit le coût et accélère les échanges, et l'IA se souvient de moins de choses.

Dans un chat Roleplay où **Advanced Memory Recall** (rappel de mémoire avancé) est activé, cette limite n'est pas utilisée. Advanced Memory Recall décide de la quantité d'historique envoyée avec **Maximum allowed context before compression (tokens)** (contexte maximal autorisé avant compression, en tokens). Pour envoyer moins, baisse ce réglage dans **Chat Settings → Memory Recall**. Voir [Advanced Memory Recall](../agents/memory.md#advanced-memory-recall-roleplay-and-game-mode).

## Exclude Past Reasoning

**Exclude Past Reasoning** (exclure le raisonnement passé) est activé par défaut. Il écarte des nouveaux prompts le raisonnement enregistré lors des tours précédents. Laisse-le activé, sauf raison précise de renvoyer l'ancien raisonnement au modèle.

Le désactiver fait apparaître **Past reasoning blocks** (blocs de raisonnement antérieurs). La valeur par défaut est 1, qui conserve le bloc de raisonnement disponible le plus récent. Une valeur de 0 inclut tous les blocs disponibles. Cela ne supprime pas les pensées enregistrées, et seul le raisonnement que le compte actuel prend en charge peut être renvoyé.

## Image captioning

**Image captioning** (description des images) fait décrire par Marinara chaque image jointe avec des mots, à l'aide d'un autre modèle, au lieu d'envoyer l'image. Utilise-le pour les modèles qui ne voient pas les images. Il est désactivé par défaut.

1. Dans **Advanced Parameters**, active **Image captioning**.
2. Choisis un modèle dans le menu déroulant **Captioning model** (modèle de description).
3. Si tu veux, modifie **Captioning Prompt** (prompt de description), les instructions envoyées avec chaque image. Le bouton de réinitialisation, ou le fait de vider le champ, rétablit le prompt par défaut. Le prompt est enregistré pour ce chat uniquement, et **Save as Connection Default** (enregistrer comme valeur par défaut de la connexion) ne le copie pas.

Si ça n'a pas marché : quand la description échoue, parce que le compte utilisé pour les descriptions est défaillant, a été supprimé ou ne renvoie rien, la réponse s'arrête avec l'erreur **Image captioning failed**. Marinara n'envoie pas l'image à la place. Répare ou change le modèle de description, ou désactive **Image captioning**.

## Save as Connection Default

Tout en bas de **Advanced Parameters**, **Save as Connection Default** inscrit tes valeurs actuelles sur le compte. Les nouveaux chats qui utilisent ce compte partent ensuite de ces valeurs. Le bouton n'apparaît que pour un compte normal et enregistré. Il est masqué pour le pool aléatoire et pour le modèle intégré.

**Reset to Defaults** (rétablir les valeurs par défaut) efface toutes les modifications propres au chat et rétablit ses réglages hérités. Les interrupteurs Send hérités suivent le compte sélectionné. Un interrupteur Send que tu as modifié toi-même reste un remplacement propre au chat jusqu'à ce que tu le réinitialises.

## Superposition et priorité des valeurs par défaut

Marinara détermine chaque paramètre en suivant cette liste. Les éléments plus bas l'emportent sur ceux du dessus.

1. Les **Parameters** du preset, ou les valeurs par défaut intégrées si aucun preset n'est utilisé. La sortie commence à 4 096 tokens, car les presets ne peuvent pas fixer de limites de sortie. En Roleplay, le preset imposé par un compte l'emporte sur le preset sélectionné dans le chat.
2. Les **Chat defaults** du compte.
3. Les **Advanced Parameters** de ce chat.
4. Les règles du mode. Un chat de scène actif fixe la sortie à 8 192, le raisonnement à **Maximum** et la verbosité à **High**. Game utilise les paramètres enregistrés du compte et du chat sans imposer l'échantillonnage, le raisonnement ni une taille minimale de sortie.
5. Les limites de sortie. Game applique la limite de sortie connue du modèle, et le réglage **Max output tokens override** (plafond de tokens en sortie) du compte plafonne les requêtes dans tous les modes. Le contexte disponible peut réduire davantage le budget.

La ligne **Effective** à côté d'un paramètre affiche la valeur qui l'emporte et la couche d'où elle vient, par exemple **Effective: 16384 · this chat**, ou **Effective: 4096 · output token cap** quand un plafond du compte s'applique. Un interrupteur Send désactivé affiche **not sent**. Les services peuvent malgré tout imposer des paramètres ou adapter des valeurs non prises en charge. Custom Parameters et l'ajustement au contexte peuvent modifier la requête finale. Réinitialiser les paramètres du chat ne supprime que le remplacement de ce chat (élément 3). La valeur vient alors des **Chat defaults** du compte s'ils sont définis, sinon du preset. Les règles du mode et les limites de sortie (éléments 4 et 5) s'appliquent toujours ensuite.

<a id="parameters-for-agents"></a>

## Paramètres des agents

Les appels des agents utilisent les **Chat defaults** enregistrés sur le compte avec lequel ils s'exécutent : le compte propre à l'agent, ou celui du chat si l'agent n'en a pas. Les interrupteurs Send et les limites des modèles s'appliquent comme pour une réponse du chat. Les presets et les **Advanced Parameters** d'un chat ne changent pas les appels des agents, à l'exception de la règle de température ci-dessous.

- **Envoyés aux agents** : Temperature, Top P, Top K, Frequency, Presence, Reasoning Effort, Verbosity, Service Tier, Custom Parameters, les en-têtes personnalisés et les paramètres supplémentaires que tu ajoutes sous **Settings** (Paramètres), puis **Advanced** (avancé), puis **Parameters**, comme Top A ou une seed. Un paramètre dont l'interrupteur Send est désactivé n'est pas envoyé.
- **Non envoyés aux agents** : Max Output Tokens, les séquences d'arrêt, les préremplissages, Thinking Tags et les autres réglages de format du prompt. Chaque agent garde son propre **Max Output Tokens**.
- **Temperature** : un agent utilise la température du compte, ou 0,7 si aucune n'est enregistrée. Beholder utilise toujours 0, et le rédacteur de prompts d'Illustrator utilise sa propre valeur. Pendant une réponse du chat, les agents qui utilisent le compte du chat prennent la température et les interrupteurs Send résolus par le chat. Les relances utilisent les valeurs enregistrées du compte.
- **Reasoning Effort** : le niveau que tu choisis, ou **Off**, s'applique à tous les agents de ce compte dont le modèle l'accepte. **Use custom defaults for this model** (utiliser des valeurs par défaut propres à ce modèle) règle d'abord Reasoning Effort sur **Maximum** pour la plupart des comptes (**Default** sur Codex) : les agents réfléchissent donc au niveau le plus élevé, ce qui est plus lent et coûte plus cher. Choisis un niveau inférieur, ou désactive son interrupteur Send, pour qu'ils réfléchissent moins. Sans niveau enregistré, les agents qui répondent en JSON demandent de désactiver la réflexion, et les autres agents conservent le réglage par défaut du modèle. Gemini 4 Argon et Carbon ne peuvent pas désactiver la réflexion : sur Google AI Studio et Vertex, leurs agents envoient donc **Medium** à la place.
- **Place pour la réflexion** : quand le compte enregistre un Reasoning Effort, ou quand le modèle est Gemini 4 Argon ou Carbon, Marinara ajoute de la place pour la réflexion en plus du **Max Output Tokens** de l'agent, dans la limite du plafond de sortie du compte, de la limite du modèle et du contexte libre. Un point d'accès personnalisé en bénéficie même quand il n'envoie pas le niveau.

Les packages d'agents installés suivent les mêmes valeurs du compte. Une valeur que le compte enregistre et envoie remplace celle que demande le package, et tout ce qui n'est pas défini garde le réglage propre au package. Un **Reasoning Effort** ou un **Max Output Tokens** désactivé sur le compte n'est pas envoyé, même si le package le demande. Temperature et Verbosity démarrent désactivés : la valeur propre au package est donc conservée.

## Certains modèles ignorent certains paramètres

Tous les modèles n'acceptent pas tous les paramètres. Quand Marinara sait qu'un modèle rejette un réglage, il l'omet de la requête. Le contrôle reste affiché, mais le modifier n'a aucun effet. C'est fréquent avec les modèles de raisonnement, qui refusent les réglages d'échantillonnage comme la température. Avec un modèle à routage automatique, qui change de modèle répondant à chaque fois, les paramètres peuvent réagir différemment d'un tour à l'autre. Épingle un seul modèle pour garder un comportement stable.

## Guides associés

- [Éditeur de presets et gestionnaire de prompts](presets.md)
- [Peek Prompt : voir ce que l'IA a reçu](../chats/peek-prompt.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
