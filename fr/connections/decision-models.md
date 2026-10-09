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
- **[Advanced Memory Recall](../agents/memory.md#optional-decision-model)** peut utiliser un modèle local ou une connexion de décision choisis séparément pour les limites de scène et la sélection de souvenirs en Roleplay. Active **Use Decision model** dans les réglages Advanced Memory de cette discussion. Les résumés restent rédigés par le modèle auxiliaire. Les décisions échouées reviennent au rappel ou aux vérifications de scène habituels.

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

**Advanced Memory utilise son propre modèle de décision par discussion.** Les vérifications de scène lisent la fenêtre concernée de l'historique. Le rappel envoie la conversation récente et jusqu'à 24 résumés archivés présélectionnés, ou davantage si le réglage **Maximum recalled scenes** (maximum de scènes rappelées) est plus élevé, puis les messages originaux des scènes choisies par le modèle, après vérification de l'accès des personnages ; la règle fixe des 5 derniers messages ne s'applique pas. Les services hébergés reçoivent ces textes, parfois en plusieurs lots limités. Chaque passe de rappel revient au rappel habituel après 10 secondes. Consulte [Modèle de décision facultatif](../agents/memory.md#optional-decision-model).

## Choisir un modèle de décision

Ouvre **Connections** (connexions), puis **Connection defaults** (connexions par défaut), et fais ton choix sous **Decision model**. La liste comprend trois groupes :

- **None** (aucun), le choix par défaut. Rien n'est demandé et les champs des questions d'activation restent désactivés dans l'éditeur d'agents.
- **Local models** (modèles locaux) : le **Primary local model** (modèle local principal) ou le **Utility local model** (modèle local auxiliaire) que tu exécutes déjà. Aucun téléchargement et rien ne quitte ta machine. Le **Decision sidecar** (processus auxiliaire de décision), si tu en as installé un, figure aussi ici.
- **Connections** : les connexions Decision créées : service hébergé, serveur System One que tu exécutes ou modèle de chat sur un serveur existant, comme Ollama ou LM Studio.

Les choix qui ne peuvent pas répondre restent dans la liste, grisés avec une explication, pour que tu voies quoi corriger. Clique sur **Test** (tester) après ton choix. Le test envoie un exemple fixe, pas ton chat.

### Lequel choisir

Si tu exécutes déjà un modèle local, essaie-le d'abord. Dans un petit test de formulation tiré d'une seule scène de Roleplay, Gemma 4 E4B a répondu correctement à 32 énoncés recommandés sur 32, et Open-Jev 2B et 9B à 31 chacun. Cela illustre l'importance de la formulation ; ce n'est pas un classement général de précision. Teste des tours représentatifs de tes propres chats ; consulte [Rédiger les énoncés](../prompts/conditional-prompts.md#writing-statements).

**Jev et Open-Jev sont des modèles différents.** Jev est le modèle hébergé de TypeSafe, disponible directement ou via OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) est un modèle publié séparément, construit sur Qwen et que Marinara peut exécuter localement. Les tests de formulation d'Open-Jev ne mesurent pas la précision de Jev hébergé.

| Option | Coût | Nécessite | Convient à |
| --- | --- | --- | --- |
| Un modèle déjà en cours d'exécution | Aucun supplément | Un modèle local dans **Local Model** (modèle local) | La plupart des personnes utilisant un modèle local |
| Un modèle de chat sur ton serveur | Rien de plus | Un serveur Ollama, LM Studio, llama.cpp ou compatible OpenAI déjà en cours d'exécution | Un modèle exécuté hors de Marinara, sans le charger deux fois |
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

<a id="on-a-server-you-already-run"></a>

### Sur un serveur déjà en cours d'exécution

Un modèle de chat exécuté dans Ollama, LM Studio, llama.cpp ou un autre serveur compatible OpenAI peut répondre aux décisions sans que Marinara en charge une seconde copie.

1. Ouvre la connexion **Custom** de ce serveur et clique sur **Use this model for decisions** (utiliser ce modèle pour les décisions). Cela crée une connexion Decision de source **OpenAI-compatible chat model** (modèle de chat compatible OpenAI) avec les mêmes URL de base, modèle et clé. Tu peux aussi la créer toi-même : connexion Decision, cette source, URL de base de ta connexion de chat (par exemple `http://localhost:11434/v1` pour Ollama) et nom du modèle servi.
2. Sélectionne-la sous **Decision model** et clique sur **Test**. Le résultat indique aussi si le serveur a renvoyé des log-probabilités et si le modèle a dû raisonner d'abord.

Comme pour un modèle local, chaque énoncé demande un mot oui/non, lu dans ses probabilités. Les énoncés sont envoyés un par un, car Marinara ignore combien de requêtes ton serveur traite simultanément. **Thinking** est toujours **Auto** pour une connexion : après deux réponses impossibles, un modèle qui doit raisonner passe à cette méthode et ne répond ensuite qu'aux vérifications après la réponse, sauf si **Also gate agents that run before the reply** est activé. Un serveur sur une autre machine de ton réseau nécessite aussi `PROVIDER_LOCAL_URLS_ENABLED`, comme tout fournisseur local ; voir [Connecter un modèle local ou auto-hébergé](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

## Configurer une connexion Decision

1. Dans **Connections**, crée une connexion avec le fournisseur **Decision** (décision).
2. Choisis **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (point d'accès System One personnalisé) ou **OpenAI-compatible chat model**. Les sources hébergées nécessitent une clé API. TypeSafe envoie ses requêtes à `https://api.typesafe.ai`, sauf si tu remplaces son champ **Base URL** (URL de base) par l'adresse d'un autre serveur qui exécute l'API de TypeSafe, sans `/v1/systemone` ; la connexion a toujours besoin de ta clé TypeSafe, qui est envoyée à ce serveur. Un serveur situé ailleurs sur ton réseau local nécessite `PROVIDER_LOCAL_URLS_ENABLED`, comme tout fournisseur local ; Android l'active par défaut. Custom accepte un serveur System One existant, dont Open-Jev ou [Strands decider](#run-strands-decider-yourself) : indique son URL de base sans `/v1/systemone` et un modèle pris en charge. Ollama, LM Studio et les autres serveurs de chat ne parlent pas System One : utilise **OpenAI-compatible chat model**, comme expliqué dans [Sur un serveur déjà en cours d'exécution](#on-a-server-you-already-run).
3. Pour OpenRouter, choisis une connexion enregistrée sous **API key source** (source de la clé API) ou saisis une clé distincte. Son éditeur propose aussi **Use this key for decisions** (utiliser cette clé pour les décisions), qui configure Jev via OpenRouter. Les clés liées suivent les modifications ultérieures automatiquement. Les connexions Custom System One et OpenAI-compatible chat model ne peuvent emprunter la clé d'une connexion de chat personnalisée que si les URL ont la même origine (schéma, hôte et port).
4. Enregistre, sélectionne la connexion sous **Decision model**, puis clique sur **Test**. Une réussite affiche la probabilité, la durée de la réponse et le délai de la connexion. Test attend au moins 10 secondes, et 5 secondes au-delà d'un délai plus long, afin d'indiquer la durée réelle d'une réponse lente. Si elle dépasse le délai, le résultat le signale : pendant un chat, elle compterait comme une absence de réponse.

Le choix Decision par défaut est séparé de ceux du chat, des agents, des images, des vidéos et de l'audio. Choisir **None** désactive les décisions sans supprimer de questions d'activation ni d'énoncés de décision.

Les décisions hébergées envoient les messages récents sélectionnés et les énoncés au fournisseur choisi et peuvent être facturées. L'ordre de réponse Smart inclut aussi la [liste des personnages](#what-the-model-sees). **Recent-message token budget** (budget de tokens des messages récents) vaut par défaut 30 000 tokens estimés pour les sources hébergées et 3 500 pour les serveurs personnalisés. Réduis-le si le serveur a une limite de contexte plus petite. Marinara retire d'abord les anciens messages, puis tronque la partie la plus ancienne du message le plus récent. L'estimation peut différer du découpage en tokens du serveur ; une requête refusée ou hors budget ne donne aucune réponse.

**Time limit (seconds)** (délai en secondes) définit l'attente de chaque énoncé pendant les chats : de 0,5 à 30 secondes, 1,5 par défaut ou 4 pour une connexion **OpenAI-compatible chat model**. Une requête portant sur plusieurs énoncés dispose de ce délai pour chacun. Une réponse plus tardive compte comme une absence de réponse. Certains fournisseurs hébergés dépassent parfois 1,5 seconde, donnant l'impression de pannes aléatoires : clique plusieurs fois sur **Test** et règle le délai au-dessus de la réponse la plus lente. En contrepartie, chaque énoncé évalué avant la réponse, dans un preset ou une question d'activation d'agent préalable par exemple, peut retarder celle-ci jusqu'à ce délai.

Supprimer une connexion utilisée pour une clé liée affiche un avertissement et oblige à refaire le lien de la connexion Decision. Les fichiers de connexion indépendants importés nécessitent aussi de restaurer les clés ou liens ; ils ne contiennent jamais de clés API ni d'identifiants de connexions empruntées.

<a id="run-strands-decider-yourself"></a>

### Exécuter Strands decider toi-même

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) est un autre modèle de décision ouvert (Apache-2.0) qui utilise System One. Marinara ne peut pas l'installer, mais il fonctionne comme **Custom System One endpoint** tant que tu le laisses tourner.

1. Dans un environnement Python 3.10 ou plus récent, installe-le et démarre son serveur :

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   Il utilise un GPU NVIDIA ou Apple silicon s'il en trouve un, sinon le processeur, plus lentement. Le premier démarrage télécharge le modèle et environ 4,6 Go de poids de base ; ses paquets Python occupent environ 5,5 Go. Le serveur n'a pas de mot de passe : garde-le donc sur `127.0.0.1`.
2. Crée une connexion de décision avec la source **Custom System One endpoint** et l'URL de base `http://127.0.0.1:8000`. N'importe quel nom de modèle convient.
3. Sélectionne-la sous **Decision model**, puis clique sur **Test**. Sa première réponse après le démarrage prend environ 2 secondes, plus que le **Time limit** par défaut : teste-le donc une fois avant de discuter.

Ses probabilités sont calibrées : le seuil par défaut de 0,5 d'une connexion personnalisée lui convient, contrairement à un Open-Jev auto-hébergé (voir [Seuils](#thresholds)). Lors d'un petit test Roleplay de 80 énoncés sur une RTX 5090, il a répondu correctement à 73 énoncés, contre 74 pour Open-Jev 2B, et utilisé environ 5,1 Go (4,7 Gio) de mémoire GPU. Un à huit énoncés lui ont pris de 0,04 à 0,1 seconde, contre 0,1 à 0,14 pour Open-Jev 2B ; sur un long chat, les deux ont pris environ 0,3 seconde. Ses réponses dépendent davantage de la formulation : suis donc [Rédiger des énoncés](../prompts/conditional-prompts.md#writing-statements) et teste des tours de tes propres chats.

Pour passer de ce modèle au Decision sidecar ou inversement, choisis l'un des deux sous **Decision model**. Les deux restent configurés.

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

**Vitesse.** La première réponse après le démarrage est plus lente ; Marinara pose donc une question de préchauffage pendant le chargement. Si elle réussit, **Test** et le premier tour montrent la vitesse normale. Sinon, le modèle démarre quand même et la première question subit le retard. Chaque énoncé relit le chat récent : un tour avec beaucoup d'énoncés prend donc davantage de temps dans un long chat. Open-Jev 2B y prend environ un quart de seconde par énoncé.

Tu peux aussi coller le dépôt HuggingFace d'un modèle de décision. Marinara lit le manifeste propre au dépôt, vérifie que le type d'artefact correspond à un environnement fourni par cette build et affiche les poids de base à récupérer et la taille totale avant de proposer l'installation. Un dépôt qu'il ne peut pas vérifier est refusé avec une explication, au lieu d'être installé sans assurance.

Sur une machine à plusieurs GPU NVIDIA, un menu **GPU** choisit la carte de chargement. Les verdicts concernent cette carte ; en changer arrête le modèle pour le redémarrer dessus.

Désactiver le processus auxiliaire arrête le processus et conserve les fichiers. **Remove files** (supprimer les fichiers) supprime le modèle et son environnement, et reste disponible quand le processus auxiliaire est désactivé.

<a id="thresholds"></a>

## Seuils

Les probabilités ne sont pas directement comparables entre modèles. Le même exemple positif peut obtenir 0,99 sur un modèle et 0,2 sur un autre. Le seuil par défaut de Marinara dépend du mode de connexion du modèle :

| Backend sélectionné | Seuil oui/non par défaut |
| --- | --- |
| Modèle de chat local Primary ou Utility, ou connexion à un modèle de chat compatible OpenAI | 0,5 |
| Connexion Decision TypeSafe, OpenRouter ou Custom System One | 0,5 |
| Decision sidecar géré | Recommandation du manifeste du modèle ; 0,1 pour les Open-Jev 2B et 9B intégrés |

Le réglage **Run when probability is at least** (exécuter si la probabilité atteint au moins) d'un agent peut remplacer cette valeur. L'éditeur propose de restaurer la recommandation du backend si la valeur enregistrée diffère. Vérifie ce réglage chaque fois que tu changes de modèle.

Les énoncés des prompts et les champs Decision des lorebooks utilisent la valeur par défaut du backend ; changer le seuil d'un agent ne change pas le leur. **Un Open-Jev auto-hébergé derrière une connexion Custom System One utilise toujours 0,5.** Marinara ne peut pas identifier et calibrer automatiquement n'importe quel point d'accès personnalisé. Ses résultats peuvent donc différer de ceux du processus auxiliaire Open-Jev géré, notamment en interprétant un résultat positif inférieur à 0,5 comme non.

<a id="time-limits"></a>

## Délais

Une décision qui n'arrive pas à temps ne donne aucune réponse. La génération continue avec le [repli de la fonctionnalité](#where-marinara-uses-it) ; une branche de prompt ou une entrée de lorebook requise peut donc être omise.

Chaque délai s'applique par énoncé. Une requête portant sur plusieurs énoncés reçoit ce délai pour chacun ; chaque réponse Choice compte comme un énoncé. Un modèle local ne traite que quelques requêtes à la fois : les énoncés attendent leur tour, et leur délai ne commence qu'au début de leur traitement.

- **1,5 seconde** par énoncé pour une connexion Decision TypeSafe, OpenRouter ou Custom System One, sauf modification de **Time limit**. Voir [Configurer une connexion Decision](#set-up-a-decision-connection).
- **4 secondes** par énoncé pour une connexion à un modèle de chat compatible OpenAI, sauf modification de **Time limit**. Un modèle qui doit raisonner d'abord dispose d'au moins 20 secondes.
- **4 secondes** par énoncé pour un modèle local.
- **4 secondes** pour le premier énoncé du processus auxiliaire de décision. Chaque suivant reçoit le temps mesuré du modèle : 0,35 seconde pour Open-Jev 2B, 0,8 pour Open-Jev 9B. Un modèle installé en collant son dépôt reçoit 4 secondes par énoncé.
- **20 secondes** par énoncé pour un modèle local qui doit raisonner d'abord.

Les requêtes de décision s'arrêtent quand tu annules une génération.

## Autres réglages sous Decision model

- **Also use it to pick who speaks in Smart response order.** (L'utiliser aussi pour choisir qui parle dans l'ordre Smart). Désactivé par défaut. Consulte [Chats de groupe](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn.** (Énoncés de décision par tour). Limite la planification des énoncés de prompts et lorebooks, 32 par défaut et jusqu'à 255. Le budget s'applique à plusieurs étapes ; ce n'est pas un plafond unique pour toutes les requêtes Decision ou les dépenses d'un tour. Les questions d'activation et l'ordre Smart sont séparés. Consulte [Limites et coût](../prompts/conditional-prompts.md#limits-and-cost) pour le périmètre, les lots et les règles de priorité.
- **Also gate agents that run before the reply** et **Thinking** apparaissent pour **Primary local model** et **Utility local model**. Le processus auxiliaire de décision ne raisonne jamais et ne propose donc ni l'un ni l'autre. Voir [Utiliser un modèle déjà en cours d'exécution](#use-a-model-you-already-run).

## Précision : prévoir les mauvaises réponses

Tout modèle peut se tromper. Dans le petit test de formulation ci-dessus, plusieurs "oui" corrects d'Open-Jev 2B dépassaient à peine son seuil. Prévois les réponses manquantes ou erronées :

- Utilise une décision pour affiner, jamais pour quelque chose d'indispensable au chat. Une décision manquée doit rendre la réponse un peu moins adaptée, pas la casser.
- Ne conditionne pas le consentement, les avertissements de contenu ou les instructions de sécurité à une décision.
- Pour un agent qui ne s'exécute que sur une question d'activation, règle **Bypass the question after this many messages** (ignorer la question après ce nombre de messages) pour qu'un modèle répondant toujours "non" ne puisse pas le réduire définitivement au silence.

Pour des exemples concrets de formulation et une méthode de test sur tes chats, consulte [Rédiger les énoncés](../prompts/conditional-prompts.md#writing-statements).

## Résolution des problèmes

- **Test échoue.** Le message explique pourquoi : clé refusée, limite de fréquence du fournisseur, modèle local arrêté, modèle de décision non installé, absence de réponse oui/non ou délai dépassé.
- **Test indique que ce point d'accès n'existe pas sur le serveur.** La source Decision ne correspond pas au serveur. Ollama, LM Studio et les autres serveurs de chat nécessitent **OpenAI-compatible chat model** ; **Custom System One endpoint** est réservé aux serveurs System One comme Open-Jev.
- **Test indique que le délai a été dépassé, ou les décisions ne fonctionnent que parfois.** Le fournisseur répond plus lentement que le **Time limit** de la connexion au moins de temps en temps. Teste plusieurs fois et augmente le délai au-dessus de la réponse la plus lente.
- **Un agent avec une question d'activation s'exécute à chaque tour.** Aucun Decision model n'est défini, ou il ne répond pas ; l'agent s'exécute donc comme s'il n'avait aucune question. Vérifie **Test**.
- **Une branche de décision n'apparaît jamais dans un prompt.** Consulte [Quand une branche de décision n'apparaît jamais](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **L'ordre de réponse Smart fait toujours son appel IA habituel.** L'interrupteur est désactivé ou le Decision model n'a pas répondu à ce tour.
- **Pour voir les scores et sorties des décisions pendant la génération**, active Debug Mode ou le niveau de journalisation debug. Les journaux des décisions de prompt incluent seuils, résultats et réponses réutilisées ou maintenues par les règles temporelles. Voir [Niveaux de journalisation](../CONFIGURATION.md#logging-levels).
- **Pour tester tes énoncés sans générer de réponse**, ouvre **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → diagnostic des décisions → tester les décisions). Les aperçus d'entrée sont passifs ; les tests explicites appellent le modèle sélectionné et peuvent entraîner des frais d'hébergement. Voir [Tester les énoncés de décision](../chats/peek-prompt.md#testing-decision-statements).

## Guides associés

- [Créer des agents personnalisés](../agents/custom-agents.md)
- [Prompts conditionnels](../prompts/conditional-prompts.md)
- [Chats de groupe](../chats/group-chats.md)
- [Configurer le modèle local](local-model.md)
- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
