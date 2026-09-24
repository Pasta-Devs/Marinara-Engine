# Modèles de décision

Ce guide explique **Decision model** (modèle de décision) : son rôle, les trois façons d'en obtenir un, leur configuration et les endroits où Marinara l'utilise. Il est facultatif. Sans lui, les chats continuent à générer des réponses, mais chaque fonctionnalité adopte le comportement de repli décrit ci-dessous.

## Ce qu'est un modèle de décision

Un modèle de décision répond à un type de question. Il reçoit les messages récents d'un chat et un énoncé, par exemple "The latest message moves the scene to a new place", puis estime sa probabilité d'être vrai par un nombre entre 0 et 1. Marinara compare ce nombre à un seuil et interprète le résultat comme oui ou non. Il peut aussi choisir une réponse dans une courte liste, par exemple "angry", "sad" ou "none of these".

Ses réponses contrôlent le comportement de Marinara ; elles ne sont pas publiées dans le chat. Un modèle conçu pour les décisions attribue directement un score aux énoncés. Un modèle de chat local reçoit normalement une demande d'un seul token oui/non, même si certains modèles doivent d'abord raisonner. Une décision peut être plus rapide qu'une réponse complète, mais de nombreux énoncés ou un modèle qui raisonne peuvent ajouter un délai sensible.

<a id="where-marinara-uses-it"></a>

## Où Marinara l'utilise

- Les **[questions d'activation](../agents/custom-agents.md#activation-questions)** déterminent si un agent personnalisé s'exécute, avant son travail dans sa phase. Sans réponse, la question ne l'arrête pas ; les mots-clés et **Trigger Cadence** (cadence d'activation) s'appliquent toujours.
- Les **[énoncés dans les prompts](../prompts/conditional-prompts.md#asking-the-decision-model)** choisissent du texte lors de la préparation du prompt d'un chat ou d'un agent. Sans réponse, la décision vaut non : un bloc de décision simple utilise donc sa branche `{{else}}`, si elle existe.
- Les **[champs Decision des lorebooks](../lorebooks/entries.md#decision-activation)** vérifient Require ou Trigger pendant l'analyse des lorebooks du chat. Sans réponse, Require ne peut pas admettre une nouvelle entrée et Trigger n'ajoute aucune voie d'activation. Les maintiens Sticky existants et les voies ordinaires d'activation des entrées Trigger s'appliquent toujours.
- L'**[ordre de réponse Smart](../chats/group-chats.md#response-order-individual-only)** évalue qui doit parler ensuite dans un chat de groupe, si l'option est activée. Sans réponse, l'ordre Smart effectue son appel IA habituel.

Une question d'activation contrôle l'exécution d'un agent ; un énoncé de décision dans son prompt contrôle les instructions reçues par cet agent pendant son exécution. Utilise `{{#if decision:"..."}}` pour une condition de prompt oui/non et `{{#if decision_choice:"..." == "..."}}` pour choisir entre plusieurs réponses.

<a id="what-the-model-sees"></a>

## Ce que voit le modèle

Pour les questions d'activation et les énoncés des prompts/lorebooks, le modèle reçoit l'énoncé et les messages récents tels qu'ils sont enregistrés dans le chat. Il ne reçoit pas le reste du prompt assemblé : preset, fiche de personnage, description du persona, entrées de lorebook (y compris Constant), résumés ou sorties des agents. Le texte inséré entre les messages, comme un preset ou une entrée de lorebook placé **@ Depth** (à une profondeur donnée), est aussi omis. Un énoncé qui dépend d'un de ces faits doit l'inclure lui-même.

**L'ordre de réponse Smart envoie aussi une liste de personnages.** Elle contient le nom, le statut, l'activité et le niveau de bavardage de chaque candidat lorsqu'ils sont disponibles, plus jusqu'à 300 caractères de personnalité ou, si ce champ est vide, de description. Un fournisseur Decision hébergé reçoit cette liste en plus des messages récents.

- Les énoncés de décision dans les prompts et les entrées de lorebook, ainsi que l'ordre de réponse Smart, lisent les 5 derniers messages. Ce nombre est fixe.
- Les questions d'activation lisent la **Scan Depth** (profondeur d'analyse) de l'agent, 5 par défaut.
- Chaque message porte le nom de son auteur. Les messages cachés à l'IA sont exclus.
- Tout ce qui est vérifié après la réponse, comme la question d'activation d'un agent de post-traitement ou un énoncé dans son prompt, voit aussi la réponse qui vient d'être écrite.
- Les macros de l'énoncé sont d'abord résolues : `{{char}}` arrive donc sous forme du nom du personnage.
- Si les messages dépassent le budget du modèle, les plus anciens sont supprimés en premier. Consulte [Configurer une connexion Decision](#set-up-a-decision-connection) pour le budget hébergé.

## Choisir un modèle de décision

Ouvre **Connections** (connexions), puis **Connection defaults** (connexions par défaut), et fais ton choix sous **Decision model**. La liste comprend trois groupes :

- **None** (aucun), le choix par défaut. Rien n'est demandé et les champs des questions d'activation restent désactivés dans l'éditeur d'agents.
- **Local models** (modèles locaux) : le **Primary local model** (modèle local principal) ou le **Utility local model** (modèle local auxiliaire) que tu exécutes déjà. Aucun téléchargement et rien ne quitte ta machine. Le **Decision sidecar** (processus auxiliaire de décision), si tu en as installé un, figure aussi ici.
- **Connections** : toute connexion Decision créée, hébergée ou exécutée par tes soins.

Les choix qui ne peuvent pas répondre restent dans la liste, grisés avec une explication, pour que tu voies quoi corriger. Clique sur **Test** (tester) après ton choix. Le test envoie un exemple fixe, pas ton chat.

### Lequel choisir

Si tu exécutes déjà un modèle local, essaie-le d'abord. Dans un petit test de formulation tiré d'une seule scène de Roleplay, Gemma 4 E4B a répondu correctement à 32 énoncés recommandés sur 32, et Open-Jev 2B et 9B à 31 chacun. Cela illustre l'importance de la formulation ; ce n'est pas un classement général de précision. Teste des tours représentatifs de tes propres chats ; consulte [Rédiger les énoncés](../prompts/conditional-prompts.md#writing-statements).

**Jev et Open-Jev sont des modèles différents.** Jev est le modèle hébergé de TypeSafe, disponible directement ou via OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) est un modèle publié séparément, construit sur Qwen et que Marinara peut exécuter localement. Les tests de formulation d'Open-Jev ne mesurent pas la précision de Jev hébergé.

| Option | Coût | Nécessite | Convient à |
| --- | --- | --- | --- |
| Un modèle déjà en cours d'exécution | Aucun supplément | Un modèle local dans **Local Model** (modèle local) | La plupart des personnes utilisant un modèle local |
| Une connexion Decision hébergée | Requêtes facturées ; plusieurs sont possibles par tour | Une clé API (TypeSafe ou OpenRouter) | Téléphones et PC sans modèle local |
| Le modèle de décision installable | Espace disque et mémoire GPU distincts ; voir les [tailles des modèles](#let-marinara-install-a-decision-model) | Linux x86-64 et un GPU NVIDIA pris en charge | Un modèle de décision séparé à côté du modèle de chat |

**Sur Android (Termux),** le modèle de décision installable ne peut pas fonctionner : il nécessite un PC doté d'un GPU NVIDIA. Un petit modèle local exécuté sur le processeur d'un téléphone peut aussi dépasser le délai. Une connexion Decision hébergée, par exemple Jev via OpenRouter, est le choix pratique sur téléphone. Consulte [Configurer une connexion Decision](#set-up-a-decision-connection).

Les presets, fiches et agents doivent être écrits pour "un modèle de décision", jamais avec "nécessite Jev". La syntaxe des énoncés reste la même quel que soit le choix de l'utilisateur, mais les réponses peuvent varier selon les modèles.

Lorsqu'une personne importe du contenu utilisant des décisions, Marinara affiche un avis avec un lien vers ce guide. Cela inclut les agents personnalisés et les installations du catalogue d'Agents. Sans Decision model sélectionné, l'avis explique le repli : les énoncés des prompts valent non, les entrées de lorebook ne peuvent pas s'activer par une décision, et les questions d'activation laissent l'agent s'exécuter dès que ses mots-clés et **Trigger Cadence** le permettent. Définis aussi une cadence si un agent ne doit pas s'exécuter à chaque tour sans Decision model. La restauration d'un profil complet depuis un ZIP n'affiche pas cet avis d'importation.

<a id="use-a-model-you-already-run"></a>

## Utiliser un modèle déjà en cours d'exécution

Si tu disposes d'un modèle local dans **Local Model**, tu peux l'utiliser pour les décisions sans créer de connexion ni payer de requête.

1. Dans **Connections**, ouvre **Connection defaults** et règle **Decision model** sur **Primary local model**, ou **Utility local model** si tu en as configuré un.
2. Clique sur **Test**. Un résultat réussi affiche la probabilité et la durée de la requête, plus deux informations propres aux modèles locaux : la disponibilité des log-probabilités et le fait que le modèle réponde directement ou non.

Marinara pose une seule question oui/non au modèle, le laisse produire un token et lit la réponse dans les probabilités de ce token. Aucune réponse de chat n'est écrite : la requête est donc courte. Un choix entre plusieurs réponses devient une question oui/non par réponse. Le nombre de messages récents pouvant tenir est calculé à partir de la taille de contexte du créneau lui-même.

**Raisonnement.** La plupart des modèles répondent en un mot. Certains raisonnent toujours d'abord, quelle que soit la demande. Le réglage **Thinking** (raisonnement), sous le menu déroulant, contrôle ce comportement :

- **Auto** (par défaut) essaie la méthode rapide en un mot ; si le modèle échoue deux fois de suite de cette façon, il le laisse raisonner d'abord et te l'indique.
- **Off** (désactivé) utilise toujours la méthode en un mot. Un modèle qui ne sait pas répondre ainsi ne donne aucune réponse.
- **Allowed** (autorisé) ne demande jamais au modèle de sauter le raisonnement.

Un modèle qui raisonne d'abord prend plusieurs secondes. Par défaut, il répond donc seulement pour ce qui se produit après l'affichage de la réponse, comme les agents de post-traitement. Avant la réponse, il ne donne aucune réponse, sauf si tu actives **Also gate agents that run before the reply** (évaluer aussi les agents exécutés avant la réponse), ce qui fait attendre chaque réponse.

**À propos des nombres.** Les probabilités oui/non d'un modèle général de chat peuvent servir à un seuil, mais elles n'ont jamais été entraînées pour être calibrées comme celles d'un modèle conçu pour les décisions. Un environnement qui ne renvoie pas de log-probabilités répond par un simple 1 ou 0. Ajuste les seuils sur tes chats plutôt que de te fier à la valeur par défaut.

<a id="set-up-a-decision-connection"></a>

## Configurer une connexion Decision

1. Dans **Connections**, crée une connexion avec le fournisseur **Decision** (décision).
2. Choisis **TypeSafe**, **OpenRouter** ou **Custom System One endpoint** (point d'accès System One personnalisé). Les sources hébergées nécessitent une clé API. Custom accepte un serveur System One que tu exécutes déjà, y compris Open-Jev ; indique son URL de base sans `/v1/systemone` et un nom de modèle qu'il prend en charge.
3. Pour OpenRouter, choisis une connexion OpenRouter enregistrée sous **API key source** (source de la clé API), ou saisis une clé distincte. Son éditeur propose aussi **Use this key for decisions (Jev)** (utiliser cette clé pour les décisions avec Jev). Les clés liées suivent automatiquement les changements ultérieurs de clé. Une connexion personnalisée peut emprunter la clé d'une connexion de chat personnalisée uniquement si les deux URL ont la même origine (schéma, hôte et port).
4. Enregistre, sélectionne la connexion sous **Decision model**, puis clique sur **Test**. Une réussite affiche la probabilité, la durée de la réponse et le délai de la connexion. Test attend au moins 10 secondes, et 5 secondes au-delà d'un délai plus long, afin d'indiquer la durée réelle d'une réponse lente. Si elle dépasse le délai, le résultat le signale : pendant un chat, elle compterait comme une absence de réponse.

Le choix Decision par défaut est séparé de ceux du chat, des agents, des images, des vidéos et de l'audio. Choisir **None** désactive les décisions sans supprimer de questions d'activation ni d'énoncés de décision.

Les décisions hébergées envoient les messages récents sélectionnés et les énoncés au fournisseur choisi et peuvent être facturées. L'ordre de réponse Smart inclut aussi la [liste des personnages](#what-the-model-sees). **Recent-message token budget** (budget de tokens des messages récents) vaut par défaut 30 000 tokens estimés pour les sources hébergées et 3 500 pour les serveurs personnalisés. Réduis-le si le serveur a une limite de contexte plus petite. Marinara retire d'abord les anciens messages, puis tronque la partie la plus ancienne du message le plus récent. L'estimation peut différer du découpage en tokens du serveur ; une requête refusée ou hors budget ne donne aucune réponse.

**Time limit (seconds)** (délai en secondes) définit l'attente de chaque connexion Decision pendant les chats, entre 0,5 et 30 secondes (1,5 par défaut). Une réponse plus tardive compte comme une absence de réponse. Certains fournisseurs hébergés dépassent parfois 1,5 seconde, donnant l'impression de décisions aléatoirement défaillantes. Clique donc plusieurs fois sur **Test** et règle le délai au-dessus de la réponse la plus lente. En contrepartie, un énoncé évalué avant la réponse, comme une décision dans un preset ou une question d'activation d'agent exécuté avant la réponse, peut la retarder jusqu'à ce délai.

Supprimer une connexion utilisée pour une clé liée affiche un avertissement et oblige à refaire le lien de la connexion Decision. Les fichiers de connexion indépendants importés nécessitent aussi de restaurer les clés ou liens ; ils ne contiennent jamais de clés API ni d'identifiants de connexions empruntées.

<a id="let-marinara-install-a-decision-model"></a>

## Laisser Marinara installer un modèle de décision

Marinara peut aussi télécharger et exécuter pour toi un modèle conçu pour les décisions. Il possède son propre processus local, que tu utilises ou non un modèle de chat local. Sa mémoire s'ajoute à celle du modèle de chat. Si tu as déjà un modèle local, essaie ses décisions avant d'en télécharger un autre.

Les modèles Open-Jev intégrés nécessitent Linux **x86-64**, un GPU NVIDIA de capacité de calcul 7.5 ou supérieure (Turing, série RTX 20 ou ultérieure), et un pilote 580 ou ultérieur. Ces packages ne prennent pas en charge les appareils Linux ARM ni les cartes Pascal ou plus anciennes. Si un modèle ne peut pas fonctionner, l'option reste visible, explique pourquoi et propose de configurer une connexion Decision à la place.

| Modèle intégré | Téléchargement du modèle | Disque avec l'environnement d'exécution | Mémoire GPU |
| --- | --- | --- | --- |
| Open-Jev 2B | Environ 4,6 Go | Environ 10 Go | Environ 4,8 Go (4,5 Gio) |
| Open-Jev 9B | Environ 19,4 Go | Environ 25,3 Go | Environ 23,6 Go (22 Gio) |

Ce sont les estimations du catalogue, fondées sur les versions figées des modèles et des charges mesurées. L'usage GPU et la vitesse varient avec la charge. Le modèle 9B laisse peu de marge sur un GPU de 24 Go ; consulte le verdict de l'installateur pour la carte choisie et les autres modèles en cours d'exécution.

1. Ouvre **Connections**, développe **Local Model** et choisis **Decision sidecar (experimental)** (processus auxiliaire de décision expérimental).
2. Lis l'avertissement, puis active **Enable decision sidecar** (activer le processus auxiliaire de décision). La confirmation affiche le verdict pour ta machine ; le bouton indique **Enable anyway** (activer quand même) si ce verdict est un avertissement.
3. Choisis un modèle et confirme sa taille, le verdict matériel et les licences. Rien n'est téléchargé avant cette étape. **Open-Jev 2B** demande bien moins de mémoire qu'**Open-Jev 9B** ; aucun ne garantit de bonnes réponses pour ton chat.
4. Sélectionne **Decision sidecar** sous **Decision model**.

Tu peux aussi coller le dépôt HuggingFace d'un modèle de décision. Marinara lit le manifeste propre au dépôt, vérifie que le type d'artefact correspond à un environnement fourni par cette build et affiche les poids de base à récupérer et la taille totale avant de proposer l'installation. Un dépôt qu'il ne peut pas vérifier est refusé avec une explication, au lieu d'être installé sans assurance.

Sur une machine à plusieurs GPU NVIDIA, un menu **GPU** choisit la carte de chargement. Les verdicts concernent cette carte ; en changer arrête le modèle pour le redémarrer dessus.

Désactiver le processus auxiliaire arrête le processus et conserve les fichiers. **Remove files** (supprimer les fichiers) supprime le modèle et son environnement, et reste disponible quand le processus auxiliaire est désactivé.

<a id="thresholds"></a>

## Seuils

Les probabilités ne sont pas directement comparables entre modèles. Le même exemple positif peut obtenir 0,99 sur un modèle et 0,2 sur un autre. Le seuil par défaut de Marinara dépend du mode de connexion du modèle :

| Backend sélectionné | Seuil oui/non par défaut |
| --- | --- |
| Modèle de chat local Primary ou Utility | 0,5 |
| Connexion Decision TypeSafe, OpenRouter ou Custom System One | 0,5 |
| Decision sidecar géré | Recommandation du manifeste du modèle ; 0,1 pour les Open-Jev 2B et 9B intégrés |

Le réglage **Run when probability is at least** (exécuter si la probabilité atteint au moins) d'un agent peut remplacer cette valeur. L'éditeur propose de restaurer la recommandation du backend si la valeur enregistrée diffère. Vérifie ce réglage chaque fois que tu changes de modèle.

Les énoncés des prompts et les champs Decision des lorebooks utilisent la valeur par défaut du backend ; changer le seuil d'un agent ne change pas le leur. **Un Open-Jev auto-hébergé derrière une connexion Custom System One utilise toujours 0,5.** Marinara ne peut pas identifier et calibrer automatiquement n'importe quel point d'accès personnalisé. Ses résultats peuvent donc différer de ceux du processus auxiliaire Open-Jev géré, notamment en interprétant un résultat positif inférieur à 0,5 comme non.

<a id="time-limits"></a>

## Délais

Une décision qui n'arrive pas à temps ne donne aucune réponse. La génération continue avec le [repli de la fonctionnalité](#where-marinara-uses-it) ; une branche de prompt ou une entrée de lorebook requise peut donc être omise.

- **1,5 seconde** pour une connexion Decision, sauf modification de **Time limit** (délai). Consulte [Configurer une connexion Decision](#set-up-a-decision-connection).
- **4 secondes** pour un modèle local ou le processus auxiliaire de décision. Quand un tour évalue de nombreux énoncés, Open-Jev 9B dispose d'un peu plus de temps pour chaque énoncé supplémentaire.
- **20 secondes** pour un modèle local qui doit d'abord raisonner.

Les requêtes de décision s'arrêtent quand tu annules une génération.

## Autres réglages sous Decision model

- **Also use it to pick who speaks in Smart response order.** (L'utiliser aussi pour choisir qui parle dans l'ordre Smart). Désactivé par défaut. Consulte [Chats de groupe](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn.** (Énoncés de décision par tour). Limite la planification des énoncés de prompts et lorebooks, 32 par défaut et jusqu'à 255. Le budget s'applique à plusieurs étapes ; ce n'est pas un plafond unique pour toutes les requêtes Decision ou les dépenses d'un tour. Les questions d'activation et l'ordre Smart sont séparés. Consulte [Limites et coût](../prompts/conditional-prompts.md#limits-and-cost) pour le périmètre, les lots et les règles de priorité.
- **Also gate agents that run before the reply** et **Thinking** apparaissent pour un modèle local. Consulte [Utiliser un modèle déjà en cours d'exécution](#use-a-model-you-already-run).

## Précision : prévoir les mauvaises réponses

Tout modèle peut se tromper. Dans le petit test de formulation ci-dessus, plusieurs "oui" corrects d'Open-Jev 2B dépassaient à peine son seuil. Prévois les réponses manquantes ou erronées :

- Utilise une décision pour affiner, jamais pour quelque chose d'indispensable au chat. Une décision manquée doit rendre la réponse un peu moins adaptée, pas la casser.
- Ne conditionne pas le consentement, les avertissements de contenu ou les instructions de sécurité à une décision.
- Pour un agent qui ne s'exécute que sur une question d'activation, règle **Bypass the question after this many messages** (ignorer la question après ce nombre de messages) pour qu'un modèle répondant toujours "non" ne puisse pas le réduire définitivement au silence.

Pour des exemples concrets de formulation et une méthode de test sur tes chats, consulte [Rédiger les énoncés](../prompts/conditional-prompts.md#writing-statements).

## Résolution des problèmes

- **Test échoue.** Le message explique pourquoi : clé refusée, limite de fréquence du fournisseur, modèle local arrêté, modèle de décision non installé, absence de réponse oui/non ou délai dépassé.
- **Test indique que le délai a été dépassé, ou les décisions ne fonctionnent que parfois.** Le fournisseur répond plus lentement que le **Time limit** de la connexion au moins de temps en temps. Teste plusieurs fois et augmente le délai au-dessus de la réponse la plus lente.
- **Un agent avec une question d'activation s'exécute à chaque tour.** Aucun Decision model n'est défini, ou il ne répond pas ; l'agent s'exécute donc comme s'il n'avait aucune question. Vérifie **Test**.
- **Une branche de décision n'apparaît jamais dans un prompt.** Consulte [Quand une branche de décision n'apparaît jamais](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **L'ordre de réponse Smart fait toujours son appel IA habituel.** L'interrupteur est désactivé ou le Decision model n'a pas répondu à ce tour.
- **Pour voir chaque énoncé et sa réponse,** règle le niveau du journal sur debug. Consulte [Niveaux de journalisation](../CONFIGURATION.md#logging-levels).

## Guides associés

- [Créer des agents personnalisés](../agents/custom-agents.md)
- [Prompts conditionnels](../prompts/conditional-prompts.md)
- [Chats de groupe](../chats/group-chats.md)
- [Configurer le modèle local](local-model.md)
- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
