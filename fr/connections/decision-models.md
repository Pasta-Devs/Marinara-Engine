# Modèles de décision

Un modèle de décision est un petit modèle qui répond par oui ou par non aux questions de Marinara, par exemple "Does the latest message move the scene to a new place?". Les lorebooks, les agents personnalisés, les prompts et les chats de groupe s'en servent. Il est facultatif. Sans lui, les chats fonctionnent quand même et chaque fonctionnalité utilise le comportement de repli décrit dans [Où Marinara l'utilise](#where-marinara-uses-it).

Ses réponses contrôlent ce que fait Marinara et ne sont jamais publiées dans le chat. Il attribue à un énoncé un score de 0 à 1. Marinara compare ce nombre à un seuil et interprète le résultat comme oui ou non. Il peut aussi choisir une réponse dans une courte liste, par exemple "angry", "sad" ou "none of these".

Notre conseil : laisse-le sur **None** (aucun) si tu as un doute. Si tu veux des décisions, utilise le modèle intégré (Built-in model) que tu as peut-être déjà, ou un modèle de chat sur un serveur que tu fais déjà tourner. Les deux ne coûtent rien de plus.

## Choisir un modèle de décision

Avant de commencer, consulte [Lequel choisir](#which-one-to-pick).

1. Clique sur **Connections** (Connexions) dans la barre du haut et ouvre l'encadré **Jobs** (tâches).
2. Sous **Behind the scenes** (en coulisses), clique sur la ligne **Decision** (décision). Une liste s'ouvre.
3. Choisis un modèle. La liste comprend trois groupes :
   - L'option **None (decisions off)** est le choix par défaut. Rien n'est demandé, et les champs des questions d'activation restent désactivés dans l'éditeur d'agents.
   - Le groupe **Built-in model** (modèle intégré) liste les modèles que Marinara exécute sur ton ordinateur : **Built-in model**, **Built-in model (utility)** et **Built-in model (decisions)**. Rien ne quitte ton ordinateur.
   - Le groupe **Connections** liste tes comptes capables de répondre aux décisions : hébergés, ou un modèle de chat sur un serveur que tu fais déjà tourner.
4. Pour le tester, clique sur l'engrenage **Decision settings** (réglages de décision) de la ligne, puis sur **Test** (tester). Ce bouton s'affiche pour les entrées du modèle intégré. Pour un compte TypeSafe ou OpenRouter, ouvre **Edit model** (modifier le modèle) sur son modèle et clique sur **Test provider** (tester le fournisseur). Pour un compte **Own decision server** (ton propre serveur de décision), utilise **Test** dans le menu **⋯** du compte.

Un test réussi affiche la probabilité du oui et la durée de la réponse. Pour un modèle sur ton ordinateur, il indique aussi si les log-probabilités étaient disponibles et si le modèle répond directement. Les log-probabilités sont les nombres de confiance du modèle pour chaque mot qu'il pourrait écrire. Le test envoie un exemple fixe, pas ton chat.

Si le test échoue, le message explique pourquoi. Causes fréquentes : la clé a été refusée, le service limite les requêtes, le modèle intégré ne tourne pas, ou la réponse a dépassé le délai. Consulte [Résolution des problèmes](#troubleshooting).

Les entrées qui ne peuvent pas répondre pour l'instant restent dans la liste, grisées, avec la raison. Choisir **None** désactive les décisions sans supprimer aucune question d'activation ni aucun énoncé de décision.

<a id="which-one-to-pick"></a>

### Lequel choisir

- **Un modèle que tu exécutes déjà dans le modèle intégré.** Ne coûte rien de plus. Le meilleur choix pour la plupart des personnes qui utilisent le modèle intégré.
- **Un modèle de chat sur ton propre serveur** (Ollama, LM Studio, llama.cpp ou un autre serveur compatible OpenAI). Ne coûte rien de plus. Pratique quand ton modèle tourne hors de Marinara : il n'est pas chargé deux fois.
- **Un compte Decision hébergé** (clé TypeSafe ou OpenRouter). Facturé à la requête, et un tour peut en faire plusieurs. Pratique pour les téléphones et les ordinateurs qui ne font tourner aucun modèle local.
- **Le modèle de décision intégré.** Utilise de l'espace disque et de la mémoire GPU distincts. Nécessite Linux x86-64 et un GPU NVIDIA pris en charge. Pour un modèle de décision séparé, à côté de ton modèle de chat.

Si tu fais déjà tourner un modèle local, essaie-le d'abord, et teste des tours tirés de tes propres chats. La formulation compte beaucoup. Consulte [Rédiger les énoncés](../prompts/conditional-prompts.md#writing-statements).

Jev et Open-Jev sont des modèles différents. Jev est le modèle hébergé de TypeSafe, disponible directement ou via OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) est un modèle publié séparément, construit sur Qwen, que Marinara peut exécuter localement. Les tests d'Open-Jev ne mesurent pas Jev hébergé.

Sur Android (Termux), le **Built-in decision model** (modèle de décision intégré) ne peut pas fonctionner, et un petit modèle local sur le processeur d'un téléphone peut être trop lent. Un compte hébergé est le choix pratique, par exemple Jev via OpenRouter. Consulte [Configurer une connexion Decision](#set-up-a-decision-connection).

Écris les presets, les fiches et les agents pour "un modèle de décision", jamais avec "nécessite Jev". Ils utilisent la même syntaxe d'énoncés avec n'importe quel modèle, mais les modèles peuvent donner des réponses différentes. Quand tu importes du contenu qui utilise des décisions, y compris des agents personnalisés et des installations depuis Agent Organizer, Marinara affiche un avis avec un lien vers ce guide. La restauration d'un profil complet depuis un ZIP ne l'affiche pas.

## Utiliser le modèle intégré

Si tu as téléchargé le modèle intégré, tu peux l'utiliser pour les décisions sans compte et sans frais. Consulte [Configuration du modèle intégré](local-model.md).

1. Clique sur la ligne **Decision** sous **Behind the scenes** dans l'encadré **Jobs**.
2. Choisis **Built-in model** (ou **Built-in model (utility)** si tu en as un).
3. Clique sur l'engrenage **Decision settings**, puis sur **Test**.

Marinara pose au modèle une seule question oui/non, le laisse écrire un token et lit la réponse dans les probabilités de ce token. Aucune réponse de chat n'est écrite : la requête est donc courte. Un choix entre plusieurs réponses devient une question oui/non par réponse.

Le réglage **Thinking** (raisonnement) contrôle ce qui se passe quand un modèle ne peut pas répondre en un mot. Certains modèles raisonnent toujours d'abord.

| Thinking | Effet |
| --- | --- |
| **Auto (try one word, allow thinking if the model cannot)** | Par défaut. Après deux échecs de suite de la réponse en un mot, le modèle est autorisé à raisonner d'abord, et Marinara te le signale. |
| **Off (always answer in one word)** | Un modèle qui ne peut pas répondre en un mot ne donne aucune réponse. |
| **Allowed (let the model think first)** | Ne demande jamais au modèle de sauter le raisonnement. |

Un modèle qui raisonne d'abord prend plusieurs secondes : par défaut, il ne répond donc que pour les vérifications exécutées une fois la réponse affichée, comme les agents de post-traitement. Pour qu'il contrôle aussi les agents exécutés avant la réponse, active **Also gate agents that run before the reply** (évaluer aussi les agents exécutés avant la réponse). Chaque réponse l'attend alors.

Les probabilités oui/non d'un modèle de chat généraliste fonctionnent avec un seuil, mais elles n'ont pas été entraînées pour être calibrées comme celles d'un modèle conçu pour les décisions. Un environnement d'exécution qui ne renvoie pas de log-probabilités répond par un simple 1 ou 0. Ajuste les seuils sur tes propres chats.

<a id="on-a-server-you-already-run"></a>

### Sur un serveur déjà en cours d'exécution

Si ton modèle de chat tourne dans Ollama, LM Studio, llama.cpp ou un autre serveur compatible OpenAI, il peut répondre aux décisions sans que Marinara en charge une seconde copie.

1. Clique sur **⋯** sur ce modèle dans le panneau **Connections** et choisis **Use this model for decisions** (utiliser ce modèle pour les décisions). La fenêtre **Add account** (ajouter un compte) s'ouvre sur l'étape de décision, avec la même adresse, le même modèle et la même clé.
2. Choisis le modèle, puis clique sur **Test decision** (tester la décision). Un test réussi indique si le serveur a renvoyé des log-probabilités et si le modèle a dû raisonner d'abord. Clique sur **Done** (terminé).
3. Clique sur la ligne **Decision** sous **Behind the scenes** et choisis le nouveau modèle.

Tu peux aussi le créer toi-même. Utilise un compte Decision avec la source **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**, la même adresse que ton compte de chat (par exemple `http://localhost:11434/v1` pour Ollama) et le nom de modèle qu'utilise le serveur.

Il est interrogé comme le modèle intégré : un mot oui/non par énoncé. Les énoncés partent un par un, car Marinara ne peut pas savoir combien de requêtes ton serveur traite à la fois. **Thinking** est toujours sur **Auto** pour un compte. Un serveur sur un autre ordinateur nécessite `PROVIDER_LOCAL_URLS_ENABLED`. Consulte [Connecter un modèle local ou auto-hébergé](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

## Configurer une connexion Decision

Un compte Decision hébergé envoie au service les messages récents sélectionnés et les énoncés, et peut coûter de l'argent. L'ordre de réponse Smart envoie aussi une [liste des personnages](#what-the-model-sees).

1. Clique sur **Connections** dans la barre du haut, puis sur **Add** (ajouter).
2. Sous **Decisions** (décisions), clique sur **TypeSafe** ou **Own decision server**. Pour OpenRouter, clique sur **OpenRouter** sous **Chat**, connecte-le, puis utilise **Use this key for decisions** (utiliser cette clé pour les décisions) dans le menu **⋯** du modèle.
3. Saisis le champ **API key** (clé API) ou, pour **Own decision server**, le champ **Server address** (adresse du serveur). Clique sur **Connect** (connecter). La fenêtre se ferme et le panneau affiche le nouveau compte.
4. Clique sur la ligne **Decision** sous **Behind the scenes** et choisis le nouveau modèle.
5. Pour le tester, clique sur le modèle dans le panneau pour ouvrir **Edit model**, puis clique sur **Test provider** dans la carte **Provider tests** (tests du fournisseur). Un modèle **Own decision server** n'y a pas de bouton **Test provider**. Ouvre plutôt le menu **⋯** du compte dans le panneau et clique sur **Test**.

Un **Test provider** réussi affiche la probabilité, la durée de la réponse et le délai du compte. Le **Test** du compte, dans le menu **⋯**, indique seulement s'il a fonctionné et combien de temps il a pris. Le test attend au moins 10 secondes, ou 5 secondes au-delà d'un délai plus long. Si la réponse a pris plus de temps que le délai, le résultat le signale : pendant un chat, cette réponse compterait comme une absence de réponse.

En cas d'échec, consulte [Résolution des problèmes](#troubleshooting).

L'éditeur Decision (**Edit model** sur un modèle de décision) contient ces champs :

| Champ | Effet |
| --- | --- |
| **Decision source** (source de décision) | **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (point d'accès System One personnalisé) ou **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. La source est fixée à la création du modèle. |
| **API key source** (source de la clé API) | **Enter a separate key (optional for local servers)** ou **Use key from …** (utiliser la clé de …) un autre compte. Les clés liées suivent les modifications ultérieures de la clé. Un modèle System One personnalisé ou compatible OpenAI ne peut emprunter la clé d'un compte de chat personnalisé que si les deux adresses ont le même schéma, le même hôte et le même port. |
| **Recent-message token budget** (budget de tokens des messages récents) | Le nombre estimé de tokens de chat à envoyer. De 1 à 30 000. 30 000 par défaut pour TypeSafe et OpenRouter, et 3 500 pour les serveurs personnalisés. Marinara retire d'abord les anciens messages, puis tronque la partie la plus ancienne du message le plus récent. Une requête refusée ou hors budget ne donne aucune réponse. |
| **Time limit (seconds)** (délai en secondes) | Durée d'attente de chaque énoncé pendant les chats. De 0,5 à 30. 1,5 par défaut, ou 4 pour un modèle de chat compatible OpenAI. Consulte [Délais](#time-limits). |

TypeSafe envoie ses requêtes à `https://api.typesafe.ai`. Tu peux remplacer son champ **Base URL** (URL de base) par un autre serveur qui exécute l'API de TypeSafe, sans `/v1/systemone`. Le compte a toujours besoin de ta clé TypeSafe, qui est envoyée à ce serveur. La source **Custom System One endpoint** accepte un serveur System One que tu fais tourner, comme Open-Jev ou [Strands decider](#run-strands-decider-yourself). Saisis son adresse sans `/v1/systemone`. Un serveur de modèles de chat comme Ollama ne parle pas System One. Pour celui-ci, utilise **OpenAI-compatible chat model** (modèle de chat compatible OpenAI).

Certains services hébergés répondent parfois en plus de 1,5 seconde, ce qui donne l'impression que les décisions tombent en panne au hasard. Teste plusieurs fois et règle le délai au-dessus de la réponse la plus lente. Les énoncés posés avant la réponse, comme les décisions d'un preset ou la question d'activation d'un agent exécuté avant la réponse, peuvent chacun retarder la réponse jusqu'à cette durée.

Supprimer un compte dont la clé sert aux décisions affiche un avertissement. Le compte Decision doit alors être relié de nouveau, et d'ici là les décisions ne donnent aucune réponse. Les fichiers de connexion importés ne contiennent jamais de clés API ni de liens vers des comptes empruntés : restaure-les à la main.

<a id="where-marinara-uses-it"></a>

## Où Marinara l'utilise

- Les [questions d'activation](../agents/custom-agents.md#activation-questions) décident si un agent personnalisé s'exécute. Sans réponse : la question ne l'arrête pas. Les mots-clés et **Trigger Cadence** (cadence d'activation) s'appliquent toujours.
- Les [énoncés dans les prompts](../prompts/conditional-prompts.md#asking-the-decision-model) choisissent du texte lors de la construction du prompt d'un chat ou d'un agent. Sans réponse : la décision vaut non, et un bloc de décision utilise donc sa branche `{{else}}`, s'il en a une.
- Les [champs Decision des lorebooks](../lorebooks/entries.md#decision-activation) vérifient Require ou Trigger pendant l'analyse des lorebooks. Sans réponse : Require ne peut pas admettre une nouvelle entrée et Trigger n'ajoute aucune voie d'activation. Les maintiens Sticky et les voies ordinaires de Trigger s'appliquent toujours.
- L'[ordre de réponse Smart](../chats/group-chats.md#response-order-individual-only) évalue qui parle ensuite dans un chat de groupe, s'il est activé. Sans réponse : l'ordre Smart effectue son appel IA habituel.
- [Automate active characters](../chats/group-chats.md#automate-active-characters-merged-only) demande qui est dans la scène avant chaque réponse dans un groupe Roleplay Merged, s'il est réglé sur **Decision model** (modèle de décision). Sans réponse : si aucun personnage n'obtient de réponse, il utilise la dernière scène de Character Tracker, ou conserve la liste.
- [Advanced Memory Recall](../agents/memory.md#optional-decision-model) peut utiliser son propre modèle de décision pour les limites de scène et la sélection des souvenirs en Roleplay. Active **Use Decision model** (utiliser le modèle de décision) dans les réglages Advanced Memory de ce chat. Sans réponse : les décisions échouées reviennent au rappel ou aux vérifications de scène habituels. Les résumés utilisent toujours le modèle auxiliaire.

Une question d'activation décide si un agent s'exécute. Un énoncé de décision dans son prompt décide de ce qui est dit à cet agent pendant son exécution. Utilise `{{#if decision:"..."}}` pour les conditions oui/non et `{{#if decision_choice:"..." == "..."}}` pour un choix entre plusieurs réponses.

<a id="what-the-model-sees"></a>

## Ce que voit le modèle

Pour les questions d'activation et les énoncés des prompts et des lorebooks, le modèle reçoit l'énoncé et les messages récents tels qu'ils sont enregistrés dans le chat. Il ne reçoit ni ton preset, ni la fiche de personnage, ni le persona, ni les entrées de lorebook (Constant comprises), ni les résumés, ni les sorties des agents. Le texte placé entre les messages, comme une entrée réglée sur **@ Depth** (à une profondeur donnée), est aussi omis. Un énoncé qui dépend de l'un de ces éléments doit énoncer le fait lui-même.

- Les énoncés des prompts et des lorebooks, l'ordre de réponse Smart et Automate active characters lisent les 5 derniers messages. Ce nombre est fixe.
- Les questions d'activation lisent la **Scan Depth** (profondeur d'analyse) de l'agent, 5 par défaut.
- Chaque message porte le nom de son auteur. Les messages cachés à l'IA sont exclus.
- Une vérification exécutée après la réponse, comme la question d'un agent de post-traitement, voit aussi la réponse qui a été écrite.
- Les macros de l'énoncé sont d'abord remplacées : `{{char}}` arrive donc sous forme du nom du personnage.
- Quand les messages ne tiennent pas dans le budget du modèle, les plus anciens sont retirés en premier.

Le réglage **Smart response order** (ordre de réponse Smart) envoie aussi une liste de personnages : le nom, le statut, l'activité et le niveau de bavardage de chaque candidat lorsqu'ils sont connus, plus jusqu'à 300 caractères de personnalité ou, si ce champ est vide, de description.

Le réglage **Automate active characters** (automatiser les personnages actifs) envoie aussi une liste de personnages : le nom de chaque personnage et jusqu'à 300 caractères de description ou, si ce champ est vide, de personnalité, ramenés à 100 caractères ou aux seuls noms quand un grand casting ne tient pas, plus les noms que Character Tracker a vus en dernier. Si les seuls noms laissent trop peu de place aux messages, le modèle n'est pas interrogé et Character Tracker prend le relais. Dans un groupe Merged, les réponses sont étiquetées "the narrator", puisqu'une seule réponse fait parler tout le monde.

Un service de décision hébergé reçoit ces listes en plus des messages.

**Advanced Memory** utilise son propre modèle de décision par chat, et non la règle des 5 derniers messages. Les vérifications de scène lisent la fenêtre concernée de l'historique. Le rappel envoie le texte de la conversation récente et jusqu'à 24 résumés archivés présélectionnés, ou davantage si **Maximum recalled scenes** (maximum de scènes rappelées) est plus élevé, puis les messages originaux des scènes choisies par le modèle, après vérification de l'accès des personnages. Les services hébergés reçoivent ces textes, parfois en plusieurs lots. Chaque passe de rappel dispose normalement de 10 à 25 secondes, selon la vitesse du modèle. Les deux passes partagent 40 secondes par réponse : une passe peut donc disposer de moins de 10 secondes. Les souvenirs sans réponse à temps reviennent au rappel habituel. Consulte [Modèle de décision facultatif](../agents/memory.md#optional-decision-model).

<a id="thresholds"></a>

## Seuils

Les probabilités ne sont pas comparables d'un modèle à l'autre. Le même exemple peut obtenir 0,99 sur l'un et 0,2 sur un autre. Le seuil oui/non par défaut dépend du modèle :

- **Modèle intégré, ou compte de modèle de chat compatible OpenAI** : 0,5
- **Compte TypeSafe, OpenRouter ou Custom System One** : 0,5
- **Modèle de décision intégré** : la recommandation du manifeste du modèle, soit 0,1 pour les Open-Jev 2B et 9B

Le réglage **Run when probability is at least** (exécuter si la probabilité atteint au moins) d'un agent remplace cette valeur. L'éditeur propose de restaurer la recommandation du modèle quand la valeur enregistrée diffère. Vérifie-le chaque fois que tu changes de modèle. Les énoncés des prompts et les champs Decision des lorebooks utilisent la valeur par défaut du modèle, et le seuil d'un agent ne change pas le leur.

Un Open-Jev auto-hébergé derrière un compte Custom System One utilise toujours 0,5, car Marinara ne peut pas calibrer n'importe quel point d'accès personnalisé. Ses résultats peuvent différer de ceux de l'Open-Jev intégré, notamment en interprétant comme non un résultat positif inférieur à 0,5.

<a id="time-limits"></a>

## Délais

Une décision qui n'arrive pas à temps ne donne aucune réponse, et la génération continue avec le comportement de repli de la fonctionnalité (voir [Où Marinara l'utilise](#where-marinara-uses-it)). Chaque délai s'applique par énoncé. Une requête portant sur plusieurs énoncés reçoit le délai pour chacun, et chaque réponse Choice compte comme un énoncé. Un modèle local ne traite que quelques requêtes à la fois : les énoncés attendent donc leur tour, et le délai d'un énoncé commence quand le modèle commence à le traiter.

- **Compte TypeSafe, OpenRouter ou Custom System One** : 1,5 seconde, ou ton **Time limit**
- **Compte de modèle de chat compatible OpenAI** : 4 secondes, ou ton **Time limit**. Un modèle qui doit raisonner d'abord dispose d'au moins 20 secondes.
- **Modèle intégré** : 4 secondes. Un modèle qui doit raisonner d'abord dispose de 20 secondes.
- **Modèle de décision intégré** : 4 secondes pour le premier énoncé. Chaque énoncé suivant reçoit le temps mesuré du modèle : 0,35 seconde pour Open-Jev 2B et 0,8 seconde pour Open-Jev 9B. Un modèle que tu as installé depuis un dépôt reçoit 4 secondes pour chacun.

Les requêtes de décision s'arrêtent quand tu annules une génération.

## Autres réglages

Ils se trouvent dans l'engrenage **Decision settings** :

- Le réglage **Also use it to pick who speaks in Smart response order** (l'utiliser aussi pour choisir qui parle dans l'ordre Smart) est désactivé par défaut. Consulte [Chats de groupe](../chats/group-chats.md#response-order-individual-only).
- Le réglage **Decision statements per turn** (énoncés de décision par tour) limite la planification des énoncés des prompts et des lorebooks. 32 par défaut, jusqu'à 255. Ce budget s'applique à plusieurs étapes et n'est pas un plafond unique pour toutes les requêtes ou dépenses d'un tour. Les questions d'activation des agents et l'ordre de réponse Smart sont à part. Consulte [Limites et coût](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** et **Thinking** s'affichent pour les entrées du modèle intégré capables de raisonner. Le **Built-in decision model** ne raisonne jamais : il n'a donc ni l'un ni l'autre.

## Prévoir les mauvaises réponses

Tout modèle peut se tromper, et des "oui" corrects peuvent se situer tout près du seuil.

- Utilise une décision pour affiner une réponse, jamais pour quelque chose dont le chat ne peut pas se passer. Une décision manquée doit rendre une réponse moins adaptée, pas la casser.
- Ne conditionne pas le consentement, les avertissements de contenu ou les instructions de sécurité à une décision.
- Pour un agent qui ne s'exécute que sur une question d'activation, règle **Bypass the question after this many messages** (ignorer la question après ce nombre de messages), pour qu'un modèle qui répond sans cesse non ne puisse pas le réduire au silence pour toujours.

<a id="troubleshooting"></a>

## Résolution des problèmes

- **Le test échoue.** Le message explique pourquoi : la clé a été refusée, le service limite les requêtes, le modèle intégré ne tourne pas, le modèle de décision n'est pas installé, le modèle n'a pas répondu par oui ou non, ou le délai a été dépassé.
- **Le serveur n'a pas ce point d'accès.** La source Decision ne correspond pas au serveur. Ollama, LM Studio et les autres serveurs de modèles de chat nécessitent **OpenAI-compatible chat model**. La source **Custom System One endpoint** est réservée aux serveurs System One comme Open-Jev.
- **La réponse a dépassé le délai, ou les décisions ne fonctionnent que parfois.** Le service est parfois plus lent que le **Time limit**. Teste plusieurs fois et augmente le délai au-dessus de la réponse la plus lente.
- **Un agent avec une question d'activation s'exécute à chaque tour.** Aucun modèle de décision n'est défini, ou il ne répond pas : l'agent s'exécute donc comme s'il n'avait aucune question. Lance un test.
- **Une branche de décision n'apparaît jamais dans un prompt.** Consulte [Quand une branche de décision n'apparaît jamais](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **L'ordre de réponse Smart fait toujours son appel IA habituel.** L'interrupteur est désactivé, ou le modèle de décision n'a pas répondu à ce tour.
- **Automate active characters suit Character Tracker.** Le modèle n'a pas répondu pour chaque personnage, il raisonne d'abord et **Also gate agents that run before the reply** est désactivé, ou le casting est trop grand pour l'entrée du modèle, même avec les seuls noms.

Pour voir les scores et les sorties des décisions pendant la génération, active Debug Mode ou règle le niveau de log sur debug. Consulte [Niveaux de log](../CONFIGURATION.md#logging-levels). Pour tester tes propres énoncés sans générer de réponse, ouvre **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → diagnostic des décisions → tester les décisions). Les tests explicites appellent le modèle sélectionné et peuvent coûter de l'argent avec un service hébergé. Consulte [Tester les énoncés de décision](../chats/peek-prompt.md#testing-decision-statements).

<a id="let-marinara-install-a-decision-model"></a>

## Laisser Marinara installer un modèle de décision

Le **Built-in decision model** est un modèle expérimental conçu pour les décisions, que Marinara télécharge et exécute dans son propre processus local, à côté de ton modèle de chat. Sa consommation de mémoire s'ajoute à celle de ton modèle de chat. Si tu as déjà un modèle local, essaie d'abord ses décisions.

Les modèles Open-Jev nécessitent Linux **x86-64**, un GPU NVIDIA de capacité de calcul 7.5 ou supérieure (Turing, série RTX 20 ou ultérieure) et un pilote 580 ou plus récent. Linux ARM et les cartes plus anciennes ne sont pas pris en charge. Si un modèle ne peut pas fonctionner, l'option reste visible, explique pourquoi et propose **Set up a Decision provider instead** (configurer plutôt un fournisseur Decision).

| Modèle | Téléchargement du modèle | Disque avec l'environnement d'exécution | Mémoire GPU |
| --- | --- | --- | --- |
| Open-Jev 2B | Environ 4,6 Go | Environ 10 Go | Environ 4,8 Go (4,5 Gio) |
| Open-Jev 9B | Environ 19,4 Go | Environ 25,3 Go | Environ 23,6 Go (22 Gio) |

Ce sont les estimations du catalogue. Le modèle 9B laisse peu de marge sur un GPU de 24 Go. Consulte le verdict de l'installateur pour ta carte.

1. Clique sur **Add** dans le panneau **Connections**, puis sur **Built-in model (decisions)** sous **Decisions**. Une fenêtre intitulée **Built-in decision model** s'ouvre. Tu peux aussi l'ouvrir depuis la page de la carte **Built-in model**.
2. Lis l'avertissement, puis active **Use the built-in decision model** (utiliser le modèle de décision intégré). Une boîte de dialogue intitulée **Turn on the built-in decision model?** affiche le verdict pour ton ordinateur. Clique sur **Enable** (activer), ou sur **Enable anyway** (activer quand même) si le verdict est un avertissement.
3. Sous **Available decision models** (modèles de décision disponibles), choisis **Open-Jev 2B** ou **Open-Jev 9B**. Clique sur **Download and install** (télécharger et installer) et confirme la taille, le verdict matériel et les licences. Rien n'est téléchargé avant cette étape.
4. Clique sur la ligne **Decision** sous **Behind the scenes** et choisis **Built-in model (decisions)**.

Autres contrôles de la fenêtre :

- Le champ **Install from a repository** (installer depuis un dépôt) accepte un modèle de décision HuggingFace sous la forme `owner/model-name`. Clique sur **Check** (vérifier). Marinara lit le manifeste propre au dépôt, vérifie qu'il correspond à un environnement d'exécution fourni par cette build, et affiche les poids de base et la taille totale. Un dépôt dont il ne peut pas se porter garant est refusé avec la raison. Clique ensuite sur **Download and install this one** (télécharger et installer celui-ci).
- Le menu **GPU** choisit la carte sur un ordinateur doté de plusieurs GPU NVIDIA. En changer arrête le modèle, qui redémarre sur la nouvelle carte.
- Le réglage **Start this model when Marinara starts** (démarrer ce modèle au démarrage de Marinara) est facultatif. Désactivé, le modèle démarre la première fois qu'un agent en a besoin.
- Le bouton **Remove files** (supprimer les fichiers) supprime le modèle et son environnement d'exécution. Désactiver le modèle arrête le processus et conserve les fichiers.
- Le bouton **Reinstall** (réinstaller) apparaît quand le modèle installé ne peut pas démarrer parce que ses fichiers ou son environnement d'exécution sont manquants ou obsolètes, généralement après une mise à jour. Le modèle est alors marqué **Needs reinstall**, et la ligne **Decision** affiche **Not set up**. La réinstallation conserve les fichiers déjà téléchargés et complets : en général, seuls les paquets Python de l'environnement d'exécution sont téléchargés de nouveau.

La première réponse d'un modèle après son démarrage est plus lente : Marinara pose donc une question de préchauffage pendant le chargement. Si elle échoue, le modèle démarre quand même et la première vraie question subit le retard. Un tour avec beaucoup d'énoncés sur un long chat prend plus de temps. Open-Jev 2B prend environ un quart de seconde par énoncé sur un long chat.

<a id="run-strands-decider-yourself"></a>

### Exécuter Strands decider toi-même

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) est un autre modèle de décision ouvert (Apache-2.0) qui parle System One. Marinara ne peut pas l'installer, mais il fonctionne comme **Custom System One endpoint** tant que tu le laisses tourner.

1. Dans un environnement Python 3.10 ou plus récent, installe-le et démarre son serveur :

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   Il utilise un GPU NVIDIA ou Apple silicon s'il en trouve un, sinon le processeur, plus lentement. Le premier démarrage télécharge le modèle et environ 4,6 Go de poids de base, et ses paquets Python occupent environ 5,5 Go. Le serveur n'a pas de mot de passe : garde-le donc sur `127.0.0.1`.

2. Ajoute un compte **Own decision server** avec `http://127.0.0.1:8000` comme **Server address**. N'importe quel nom de modèle convient.
3. Choisis-le sur la ligne **Decision**, puis teste-le avec **Test** dans le menu **⋯** du compte. Sa première réponse après le démarrage prend environ 2 secondes, plus que le délai par défaut : teste-le donc une fois avant de discuter.

Ses probabilités sont calibrées : le seuil par défaut de 0,5 lui convient, contrairement à un Open-Jev auto-hébergé (voir [Seuils](#thresholds)). Ses réponses dépendent de la formulation : suis donc [Rédiger les énoncés](../prompts/conditional-prompts.md#writing-statements).

## Guides associés

- [Créer des agents personnalisés](../agents/custom-agents.md)
- [Prompts conditionnels](../prompts/conditional-prompts.md)
- [Chats de groupe](../chats/group-chats.md)
- [Configuration du modèle intégré](local-model.md)
- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
