# Modèles de décision

Un modèle de décision est un petit modèle qui répond pour Marinara à de courtes questions sur ton chat, par exemple "Does the latest message move the scene to a new place?" ou "What is Kaelen's mood: angry, sad or calm?". Certains peuvent aussi examiner les images et les clips du chat. Les lorebooks, les agents personnalisés, les prompts, les chats de groupe et Illustrator s'en servent. Il est facultatif. Sans lui, les chats fonctionnent quand même et chaque fonctionnalité utilise le comportement de repli décrit dans [Où Marinara l'utilise](#where-marinara-uses-it).

Ses réponses contrôlent ce que fait Marinara et ne sont jamais publiées dans le chat. Consulte [Ce qu'un modèle de décision peut répondre](#what-a-decision-model-can-answer) pour les types de questions et des exemples.

Notre conseil : laisse-le sur **None** (aucun) si tu as un doute. Si tu veux des décisions, utilise le modèle intégré (Built-in model) que tu as peut-être déjà, ou un modèle de chat sur un serveur que tu fais déjà tourner. Les deux ne coûtent rien de plus.

## Ce qu'un modèle de décision peut répondre

Chaque réponse est un nombre de 0 à 1 : le degré de certitude du modèle. Marinara transforme ce nombre en la réponse dont une fonctionnalité a besoin.

### Oui ou non

Le modèle lit un énoncé et indique sa probabilité d'être vrai. Marinara la compare à un [seuil](#thresholds) : une valeur égale ou supérieure compte comme oui. C'est le type le plus courant, utilisé par les questions d'activation, les champs **Décision** des lorebooks, `{{#if decision:"..."}}` et les vérifications d'Illustrator.

| Énoncé | Ce qu'il pourrait déclencher |
| --- | --- |
| `In the latest message, the characters move to a different location` | Un tracker met le lieu à jour uniquement aux tours où il a changé. |
| `In the latest message, a dragon is physically present` | Une entrée de lorebook sur les dragons rejoint le prompt. |
| `{{user}} asked a question that {{char}} has not answered yet` | Une ligne du prompt rappelle au modèle d'y répondre. |
| `The latest message describes a fight` | Un agent de combat s'exécute uniquement à ce tour. |

### Une réponse parmi plusieurs

Le modèle choisit ce qui convient le mieux dans une courte liste que tu écris. Marinara l'interroge sur chaque option et garde celle qui obtient le meilleur score : tu obtiens donc une seule réponse, pas plusieurs. Utilise `{{#if decision_choice:"..." == "..."}}` :

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen speaks in short, clipped sentences.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and avoids eye contact.
{{else if decision_choice:"Kaelen's mood in the latest message" == "calm"}}
Kaelen speaks normally.
{{/if}}
```

D'autres listes fonctionnent bien : le type de scène (`combat`, `dialogue`, `exploration`, `rest`), le moment de la journée (`morning`, `afternoon`, `evening`, `night`), ou la pièce d'une maison où se déroule la scène. Garde des options distinctes et ajoute-en une comme `none of these` quand aucune ne convient forcément. Les agents utilisent le même mécanisme pour choisir un jeu d'instructions parmi plusieurs, et Illustrator s'en sert pour choisir le type de météo.

### Un score

Certaines fonctionnalités utilisent directement le nombre au lieu d'un oui ou d'un non. L'[ordre de réponse Smart](../chats/group-chats.md#response-order-individual-only) évalue la probabilité que chaque personnage parle ensuite et choisit le score le plus élevé. [Advanced Memory](../agents/memory.md#optional-decision-model) évalue la pertinence de chaque scène passée. Dans Peek Prompt, **Tester les décisions** affiche le score de chaque énoncé, ce qui t'aide à choisir un seuil. Consulte [Tester les énoncés de décision](../chats/peek-prompt.md#testing-decision-statements).

### Images et clips

Un modèle de décision intégré qui lit les images peut répondre aux mêmes types de questions sur les images du chat, par exemple `The picture shows the character at the beach`. Liquid d1, Valen et Winnow lisent les images, et la version complète de Valen lit aussi les courts clips. Les autres modèles, ainsi que tous les comptes hébergés ou sur serveur, lisent uniquement le texte et ne reçoivent jamais d'images.

Les images ne sont jamais envoyées sans que tu le demandes, car chacune ralentit la réponse :

- Dans un énoncé, ajoute `pictures:1` (au plus 3) ou `clips:1`. Ajoute `media_within:2` pour ne l'interroger que si l'un des 2 derniers messages contient une image. Consulte [Images et clips](../prompts/conditional-prompts.md#pictures-and-clips).
- Dans une entrée de lorebook, règle **Montrer au modèle de décision** sous son champ **Décision**. Consulte [Activation par décision](../lorebooks/entries.md#decision-activation).
- Dans la question d'activation d'un agent personnalisé, règle **Montrer au modèle de décision**. Consulte [Questions d'activation](../agents/custom-agents.md#activation-questions).
- Pour les fonctionnalités d'image de Marinara, consulte [Fonctionnalités qui examinent les images](#features-that-look-at-pictures).

### Ce qu'affiche la page d'un modèle

La page de chaque modèle de décision intégré affiche deux lignes :

- **Réponses** liste ce pour quoi le modèle a été conçu : **Oui/non**, **Choix pondéré**, **Score sur une échelle** et, pour certains, **Cadres sur une image** (où se trouve quelque chose dans une image). Marinara pose des questions oui/non et à choix, et lit leurs scores. Il ne demande pas encore de cadres : cette ligne décrit donc uniquement le modèle.
- **Lit** liste **Texte**, **Images** et **Vidéo**. Un type que seule une autre version du modèle lit est nommé après les autres, par exemple "Vidéo dans sa version complète".

## Choisir un modèle de décision

Avant de commencer, consulte [Lequel choisir](#which-one-to-pick).

1. Clique sur **Connections** (Connexions) dans la barre du haut, puis sur **All jobs** (toutes les tâches) sous **Jobs** (tâches).
2. Clique sur **Decision** (décision). Une liste s'ouvre.
3. Choisis un modèle. La liste comprend trois groupes :
   - L'option **None (decisions off)** est le choix par défaut. Rien n'est demandé, et les champs des questions d'activation restent désactivés dans l'éditeur d'agents.
   - Le groupe **Built-in model** (modèle intégré) liste les modèles que Marinara exécute sur ton ordinateur : **Built-in model**, **Built-in model (utility)** et **Built-in model (decisions)**. Rien ne quitte ton ordinateur.
   - Le groupe **Connections** liste tes comptes capables de répondre aux décisions : hébergés, ou un modèle de chat sur un serveur que tu fais déjà tourner.

   Clique sur un compte à gauche pour parcourir ses modèles. Un compte NanoGPT, OpenRouter ou Google Gemini liste d'abord ses propres modèles de décision sous **Decision models** (modèles de décision), puis ses modèles de chat sous **Chat models** (modèles de chat). Un compte Google Gemini ne liste que ses modèles de décision, car ses modèles de chat ne peuvent pas répondre aux décisions. Un modèle de décision choisi précédemment apparaît au-dessus de **Starred** (favoris), avec le nom de son compte en dessous.
4. Pour le tester, clique sur l'engrenage **Decision settings** (réglages de décision) de la ligne, puis sur **Test** (tester). Ce bouton s'affiche pour les entrées du modèle intégré. Pour un modèle de décision TypeSafe, OpenRouter, NanoGPT ou Google Gemini, ouvre **Edit model** (modifier le modèle) et clique sur **Test provider** (tester le fournisseur). Pour un compte **Own decision server** (ton propre serveur de décision), utilise **Test** dans le menu **⋯** du compte.

Un test réussi affiche la probabilité du oui et la durée de la réponse. Pour un modèle sur ton ordinateur, il indique aussi si les log-probabilités étaient disponibles et si le modèle répond directement. Les log-probabilités sont les nombres de confiance du modèle pour chaque mot qu'il pourrait écrire. Le test envoie un exemple fixe, pas ton chat.

Si le test échoue, le message explique pourquoi. Causes fréquentes : la clé a été refusée, le service limite les requêtes, le modèle intégré ne tourne pas, ou la réponse a dépassé le délai. Consulte [Résolution des problèmes](#troubleshooting).

Les entrées qui ne peuvent pas répondre pour l'instant restent dans la liste, grisées, avec la raison. Choisir **None** désactive les décisions sans supprimer aucune question d'activation ni aucun énoncé de décision.

<a id="which-one-to-pick"></a>

### Lequel choisir

- **Un modèle que tu exécutes déjà dans le modèle intégré.** Ne coûte rien de plus. Le meilleur choix pour la plupart des personnes qui utilisent le modèle intégré.
- **Un modèle de chat sur ton propre serveur** (Ollama, LM Studio, llama.cpp ou un autre serveur compatible OpenAI). Ne coûte rien de plus. Pratique quand ton modèle tourne hors de Marinara : il n'est pas chargé deux fois.
- **Un modèle de décision hébergé** (TypeSafe, OpenRouter, NanoGPT ou Google Gemini). Facturé à la requête, et un tour peut en faire plusieurs. Un abonnement NanoGPT inclut certains modèles de décision, et OpenRouter en propose plusieurs gratuitement. Pratique pour les téléphones et les ordinateurs qui ne font tourner aucun modèle local.
- **Le modèle de décision intégré.** Un modèle conçu pour les décisions que Marinara télécharge et exécute à côté de ton modèle de chat, avec son propre espace disque et sa propre mémoire. La plupart fonctionnent sur presque tous les ordinateurs, certains sur le processeur seul. C'est le seul choix qui peut examiner les images et les clips. Consulte [Laisser Marinara installer un modèle de décision](#let-marinara-install-a-decision-model).

Si tu fais déjà tourner un modèle local, essaie-le d'abord, et teste des tours tirés de tes propres chats. La formulation compte beaucoup. Consulte [Rédiger les énoncés](../prompts/conditional-prompts.md#writing-statements).

Jev et Open-Jev sont des modèles différents. Jev est le modèle hébergé de TypeSafe, disponible directement ou via OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) est un modèle publié séparément, construit sur Qwen, que Marinara peut exécuter localement. Les tests d'Open-Jev ne mesurent pas Jev hébergé.

Sur Android (Termux), seuls JevK5 et Liquid d1 sont proposés comme **Built-in decision model** (modèle de décision intégré), et le processeur d'un téléphone peut être trop lent pour eux. Un compte hébergé est le choix pratique, par exemple Jev via OpenRouter. Consulte [Configurer un compte Decision](#set-up-a-decision-account).

Écris les presets, les fiches et les agents pour "un modèle de décision", jamais avec "nécessite Jev". Un énoncé qui demande des images fonctionne aussi avec un modèle qui lit uniquement le texte : il reçoit seulement le texte. Ils utilisent la même syntaxe d'énoncés avec n'importe quel modèle, mais les modèles peuvent donner des réponses différentes. Quand tu importes du contenu qui utilise des décisions, y compris des agents personnalisés et des installations depuis Agent Organizer, Marinara affiche un avis avec un lien vers ce guide. La restauration d'un profil complet depuis un ZIP ne l'affiche pas.

## Utiliser le modèle intégré

Si tu as téléchargé le modèle intégré, tu peux l'utiliser pour les décisions sans compte et sans frais. Consulte [Configuration du modèle intégré](local-model.md).

1. Sur la page **Jobs**, clique sur **Decision**.
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

1. Sur la page **Jobs**, clique sur **Decision**. Le sélecteur liste les modèles de tous les comptes, y compris ton modèle de chat. Tu peux aussi cliquer sur **⋯** sur le modèle et choisir **Use for…** (utiliser pour…) → **Decision**.
2. Clique sur l'engrenage de la ligne **Decision**, puis sur **Test**. Un test réussi indique si le serveur a renvoyé des log-probabilités et si le modèle a dû raisonner d'abord. Clique sur **Done** (terminé).
Tu peux aussi le créer toi-même. Utilise un compte Decision avec la source **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**, la même adresse que ton compte de chat (par exemple `http://localhost:11434/v1` pour Ollama) et le nom de modèle qu'utilise le serveur.

Il est interrogé comme le modèle intégré : un mot oui/non par énoncé. Les énoncés partent un par un, car Marinara ne peut pas savoir combien de requêtes ton serveur traite à la fois. **Thinking** est toujours sur **Auto** pour un compte. Un serveur sur un autre ordinateur nécessite `PROVIDER_LOCAL_URLS_ENABLED`. Consulte [Connecter un modèle local ou auto-hébergé](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

<a id="set-up-a-decision-account"></a>

## Configurer un compte Decision

Un compte Decision hébergé envoie au service les messages récents sélectionnés et les énoncés, et peut coûter de l'argent. L'ordre de réponse Smart envoie aussi une [liste des personnages](#what-the-model-sees).

1. Clique sur **Connections** dans la barre du haut, puis sur **Add** (ajouter).
2. Clique sur **Decision** (décision) dans les filtres par type, puis sur **TypeSafe** ou **Own decision server**. Pour NanoGPT, voir [Via NanoGPT](#through-nanogpt). Pour OpenRouter ou Google Gemini, voir [Via OpenRouter ou Google Gemini](#through-openrouter-or-google-gemini).
3. Saisis le champ **API key** (clé API) ou, pour **Own decision server**, le champ **Server address** (adresse du serveur). Clique sur **Connect** (connecter).
4. Sous **Found in TypeSafe — use it for:**, coche **Decision**, puis clique sur **Done**. **Decision**, sur la page **Jobs**, affiche maintenant le modèle.
5. Pour le tester, clique sur le modèle dans le panneau pour ouvrir **Edit model**, puis clique sur **Test provider** dans la carte **Provider tests** (tests du fournisseur). Un modèle **Own decision server** n'y a pas de bouton **Test provider**. Ouvre plutôt le menu **⋯** du compte dans le panneau et clique sur **Test**.

Un **Test provider** réussi affiche la probabilité, la durée de la réponse et le délai du compte. Le **Test** du compte, dans le menu **⋯**, indique seulement s'il a fonctionné et combien de temps il a pris. Le test attend au moins 10 secondes, ou 5 secondes au-delà d'un délai plus long. Si la réponse a pris plus de temps que le délai, le résultat le signale : pendant un chat, cette réponse compterait comme une absence de réponse.

En cas d'échec, consulte [Résolution des problèmes](#troubleshooting).

Un modèle de décision a les champs suivants. Clique sur le modèle dans le panneau pour ouvrir **Edit model**, ou sur la roue dentée à côté de **Decision**, sur la page **Jobs**, pour ouvrir **Decision settings** (réglages de décision) du modèle de décision actuel :

| Champ | Effet |
| --- | --- |
| **Decision source** (source de décision) | **TypeSafe**, **OpenRouter**, **NanoGPT**, **Google Gemini**, **Custom System One endpoint** (point d'accès System One personnalisé) ou **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. La source est fixée à la création du modèle. |
| **API key source** (source de la clé API) | **Enter a separate key (optional for local servers)** ou **Use key from …** (utiliser la clé de …) un autre compte. Les clés liées suivent les modifications ultérieures de la clé. Un modèle System One personnalisé ou compatible OpenAI ne peut emprunter la clé d'un compte de chat personnalisé que si les deux adresses ont le même schéma, le même hôte et le même port. |
| **Recent-message token budget** (budget de tokens des messages récents) | Le nombre estimé de tokens de chat à envoyer. De 1 à 30 000. 30 000 par défaut pour TypeSafe, OpenRouter, NanoGPT et Google Gemini, et 3 500 pour les serveurs personnalisés. Pour un modèle de décision d'un compte NanoGPT, OpenRouter ou Google Gemini dont la limite d'entrée est plus faible, le budget est égal aux trois quarts de cette limite. Marinara retire d'abord les anciens messages, puis tronque la partie la plus ancienne du message le plus récent. Une requête refusée ou hors budget ne donne aucune réponse. |
| **Time limit (seconds)** (délai en secondes) | Durée d'attente de chaque énoncé pendant les chats. De 0,5 à 30. 1,5 par défaut, ou 4 pour NanoGPT et pour un modèle de chat compatible OpenAI. Consulte [Délais](#time-limits). |
| **Custom Request Headers** (en-têtes de requête personnalisés) | En-têtes supplémentaires envoyés avec chaque requête de décision, sous forme d'objet JSON, par exemple `{"x-billing-mode": "paygo"}`. Les en-têtes d'authentification pour les clés sont refusés. |

TypeSafe envoie ses requêtes à `https://api.typesafe.ai`. Tu peux remplacer son champ **Base URL** (URL de base) par un autre serveur qui exécute l'API de TypeSafe, sans `/v1/systemone`. Le compte a toujours besoin de ta clé TypeSafe, qui est envoyée à ce serveur. La source **Custom System One endpoint** accepte un serveur System One que tu fais tourner, comme Open-Jev ou [Strands decider](#run-strands-decider-yourself). Saisis son adresse sans `/v1/systemone`. Un serveur de modèles de chat comme Ollama ne parle pas System One. Pour celui-ci, utilise **OpenAI-compatible chat model** (modèle de chat compatible OpenAI).

<a id="through-nanogpt"></a>

### Via NanoGPT

NanoGPT liste ses propres modèles de décision, comme Jev Latest, et répond aux requêtes via son API de décision avec ta clé NanoGPT. Certains modèles sont compris dans l'abonnement NanoGPT, les autres sont débités de ton solde.

1. Connecte NanoGPT comme d'habitude. Dans **Add** (ajouter), le filtre **Decision** le propose aussi.
2. Dans **Found in NanoGPT — use it for:** (trouvé dans NanoGPT – utiliser pour), coche **Decision**. Marinara choisit un modèle de décision inclus dans ton abonnement, avec Jev Latest en priorité.
3. Pour choisir un autre modèle, clique sur **⋯** sur le compte NanoGPT, puis sur **Add model** (ajouter un modèle) et sur l'onglet **Decision**. Il liste uniquement les modèles de décision. La pastille **Plan** (abonnement) signale ceux qui sont inclus dans le tien. Sélectionne un modèle et clique sur **Test decision** (tester la décision).

Les modèles de décision sont absents des listes de modèles de chat, car ils ne peuvent pas dialoguer.

Par défaut, NanoGPT décide si une requête passe par ton abonnement ou est débitée de ton solde. Pour toujours utiliser le solde, ouvre **Edit model** sur le modèle de décision et saisis `{"x-billing-mode": "paygo"}` dans **Custom Request Headers**.

<a id="through-openrouter-or-google-gemini"></a>

### Via OpenRouter ou Google Gemini

Les comptes OpenRouter et Google Gemini listent aussi leurs propres modèles de décision. Marinara interroge l'API de décision du service avec la clé du compte. OpenRouter en liste beaucoup, dont certains sont gratuits (leur nom se termine par `:free`). Google Gemini en liste un, **Gemini Decision 1**.

1. Connecte OpenRouter ou Google Gemini comme d'habitude.
2. Sur la page **Jobs**, clique sur **Decision**, puis sur le compte à gauche. Choisis un modèle sous **Decision models**.
3. Pour le tester, ouvre **Edit model** sur ce modèle et clique sur **Test provider**.

Pour un compte OpenRouter, les modèles de chat qui renvoient des log-probabilités suivent sous **Chat models** et fonctionnent aussi. Un compte Google Gemini propose uniquement son modèle de décision.

Un compte ajouté avant cette version peut n'afficher aucun **Decision models** au départ, car sa liste enregistrée est antérieure à ces modèles. Clique sur le bouton d'actualisation dans le sélecteur ou attends la mise à jour quotidienne des listes de modèles enregistrées par Marinara.

Un compte de décision **OpenRouter** autonome créé dans **Add** reste utilisable. Il interroge la même API avec sa propre clé.

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

- Les [fonctionnalités qui examinent les images](#features-that-look-at-pictures) vérifient les nouvelles images, évitent les répétitions, réutilisent les arrière-plans et signalent les visages des sprites, si elles sont activées. Elles nécessitent un modèle de décision qui lit les images.

Une question d'activation décide si un agent s'exécute. Un énoncé de décision dans son prompt décide de ce qui est dit à cet agent pendant son exécution. Utilise `{{#if decision:"..."}}` pour les conditions oui/non et `{{#if decision_choice:"..." == "..."}}` pour un choix entre plusieurs réponses.

### Fonctionnalités qui examinent les images

Elles nécessitent un modèle de décision intégré qui lit les images (Liquid d1, Valen ou Winnow). Elles sont toutes désactivées tant que tu ne les actives pas. Sans un tel modèle, elles sont grisées, avec un ⓘ qui explique pourquoi. Tu peux toujours désactiver une option que tu avais activée auparavant.

| Fonctionnalité | Emplacement | Ce qu'elle fait |
| --- | --- | --- |
| **Vérification des images** | **Réglages du chat → Agents → Illustrator** | Examine chaque nouvelle image d'Illustrator et chaque nouveau selfie, et vérifie qu'ils montrent ce qui a été demandé. Un selfie est aussi comparé à l'avatar du personnage. **En créer une autre si elle ne correspond pas** dessine une nouvelle image après un échec. **Toujours en créer deux et garder la meilleure** dessine deux images et garde celle qui correspond le mieux. Chaque image supplémentaire coûte une autre génération d'image. |
| **Vérifier aussi** | Sous **Vérification des images** | Tes propres vérifications, une par ligne, au plus 6, par exemple `Kaelen has short red hair`. Commence une ligne par `not:` pour indiquer ce que l'image ne doit pas montrer, par exemple `not: The picture has writing or a watermark`. |
| **Ne pas créer d'image si la dernière montre déjà la scène** | Carte Illustrator | Avant de dessiner, compare la dernière image du chat à ce qui va être dessiné et évite de recréer la même scène. Les images que tu demandes sont toujours créées. |
| **Réutiliser un arrière-plan de la bibliothèque qui ressemble au lieu** | Carte Illustrator | Quand aucun arrière-plan de ta bibliothèque ne porte le nom d'un nouveau lieu, en examine au plus 4 dont le nom partage des mots avec le lieu et en affiche un qui convient, au lieu d'en peindre un nouveau. Consulte [Vérifier les images avec un modèle de décision](../media/illustrator-agent.md#check-pictures-with-a-decision-model). |
| **Signaler les visages qui ne correspondent pas à leur expression** | Fenêtre **Générer les sprites**, expressions uniquement | Examine chaque visage après sa création et signale ceux qui pourraient ne pas correspondre à leur expression, pour que tu puisses les décocher ou les redessiner. Consulte [Générer des sprites avec l'IA](../characters/sprites.md#generate-sprites-with-ai). |

Une vérification qui ne peut pas s'exécuter parce que le modèle est désactivé, lent ou échoue compte comme réussie : l'image est conservée telle qu'elle a été créée.

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
- **Compte TypeSafe, OpenRouter, NanoGPT, Google Gemini ou Custom System One** : 0,5
- **Modèle de décision intégré** : la recommandation propre au modèle, mesurée sur des tours de Roleplay quand c'était possible : 0,3 pour JevK5, Liquid d1 et Valen-Decision 1.5 4B ; 0,5 pour la version complète de Valen et Winnow (pas encore mesurés) ; 0,1 pour Open-Jev 2B et 9B

Le réglage **Run when probability is at least** (exécuter si la probabilité atteint au moins) d'un agent remplace cette valeur. L'éditeur propose de restaurer la recommandation du modèle quand la valeur enregistrée diffère. Vérifie-le chaque fois que tu changes de modèle. Les énoncés des prompts et les champs Decision des lorebooks utilisent la valeur par défaut du modèle, et le seuil d'un agent ne change pas le leur.

Un Open-Jev auto-hébergé derrière un compte Custom System One utilise toujours 0,5, car Marinara ne peut pas calibrer n'importe quel point d'accès personnalisé. Ses résultats peuvent différer de ceux de l'Open-Jev intégré, notamment en interprétant comme non un résultat positif inférieur à 0,5.

<a id="time-limits"></a>

## Délais

Une décision qui n'arrive pas à temps ne donne aucune réponse, et la génération continue avec le comportement de repli de la fonctionnalité (voir [Où Marinara l'utilise](#where-marinara-uses-it)). Chaque délai s'applique par énoncé. Une requête portant sur plusieurs énoncés reçoit le délai pour chacun, et chaque réponse Choice compte comme un énoncé. Un modèle local ne traite que quelques requêtes à la fois : les énoncés attendent donc leur tour, et le délai d'un énoncé commence quand le modèle commence à le traiter.

- **Compte TypeSafe, OpenRouter, Google Gemini ou Custom System One** : 1,5 seconde, ou ton **Time limit**. OpenRouter et Google Gemini ont répondu en 0,2 à 0,5 seconde lors des mesures.
- **Modèle de décision NanoGPT** : 4 secondes, ou ton **Time limit**. Il a répondu en 0,4 à 2,5 secondes lors des mesures.
- **Compte de modèle de chat compatible OpenAI** : 4 secondes, ou ton **Time limit**. Un modèle qui doit raisonner d'abord dispose d'au moins 20 secondes.
- **Modèle intégré** : 4 secondes. Un modèle qui doit raisonner d'abord dispose de 20 secondes.
- **Modèle de décision intégré** : Open-Jev dispose de 4 secondes pour le premier énoncé, puis chaque énoncé suivant reçoit son temps mesuré : 0,35 seconde pour 2B et 0,8 seconde pour 9B. Les autres modèles mesurent leur vitesse de lecture à chaque démarrage, et leurs délais s'y adaptent : un processeur lent reçoit donc plus de temps. Chaque image ou clip demandé par un énoncé ajoute du temps. Tant que le modèle n'a pas démarré une première fois, il dispose de 4 secondes par énoncé, de 30 secondes par image et de 60 par clip.

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
- **Un compte n'affiche aucun modèle de décision dans le sélecteur.** Sa liste de modèles enregistrée est antérieure à ses modèles de décision. Clique sur le bouton d'actualisation à côté du nom du compte dans le sélecteur.
- **Le serveur n'a pas ce point d'accès.** La source Decision ne correspond pas au serveur. Ollama, LM Studio et les autres serveurs de modèles de chat nécessitent **OpenAI-compatible chat model**. La source **Custom System One endpoint** est réservée aux serveurs System One comme Open-Jev.
- **La réponse a dépassé le délai, ou les décisions ne fonctionnent que parfois.** Le service est parfois plus lent que le **Time limit**. Teste plusieurs fois et augmente le délai au-dessus de la réponse la plus lente.
- **Un agent avec une question d'activation s'exécute à chaque tour.** Aucun modèle de décision n'est défini, ou il ne répond pas : l'agent s'exécute donc comme s'il n'avait aucune question. Lance un test.
- **Une branche de décision n'apparaît jamais dans un prompt.** Consulte [Quand une branche de décision n'apparaît jamais](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **L'ordre de réponse Smart fait toujours son appel IA habituel.** L'interrupteur est désactivé, ou le modèle de décision n'a pas répondu à ce tour.
- **Les réglages d'image sont grisés avec un ⓘ.** Le modèle de décision sélectionné lit uniquement le texte, ou aucun modèle de décision n'est défini. Choisis Liquid d1, Valen ou Winnow comme **Built-in decision model**. Consulte [Quel modèle de décision intégré choisir](#which-built-in-decision-model).
- **Un énoncé avec `pictures:` vaut non.** Avec `media_within:`, aucun des derniers messages ne contenait d'image. Sinon, l'image a ralenti la réponse au-delà de son délai. La ligne **Sur cet ordinateur** de la page du modèle indique le temps nécessaire pour une image.
- **Un modèle indique qu'il ne peut pas s'exécuter ici.** La raison sous la liste précise ce qui manque, par exemple une fonctionnalité du processeur, une génération de carte graphique ou une bibliothèque. Choisis un autre modèle ; Liquid d1 et JevK5 fonctionnent sur presque tous les ordinateurs.
- **Automate active characters suit Character Tracker.** Le modèle n'a pas répondu pour chaque personnage, il raisonne d'abord et **Also gate agents that run before the reply** est désactivé, ou le casting est trop grand pour l'entrée du modèle, même avec les seuls noms.

Pour voir les scores et les sorties des décisions pendant la génération, active Debug Mode ou règle le niveau de log sur debug. Consulte [Niveaux de log](../CONFIGURATION.md#logging-levels). Pour tester tes propres énoncés sans générer de réponse, ouvre **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → diagnostic des décisions → tester les décisions). Les tests explicites appellent le modèle sélectionné et peuvent coûter de l'argent avec un service hébergé. Consulte [Tester les énoncés de décision](../chats/peek-prompt.md#testing-decision-statements).

<a id="let-marinara-install-a-decision-model"></a>

## Laisser Marinara installer un modèle de décision

Le **Built-in decision model** est un modèle conçu pour les décisions que Marinara télécharge et exécute sur ton ordinateur, à côté de ton modèle de chat. Rien ne quitte ton ordinateur. Sa consommation de mémoire s'ajoute à celle de ton modèle de chat. Si tu fais déjà tourner un modèle local, essaie d'abord ses décisions.

### Quel modèle de décision intégré choisir

| Modèle | Téléchargement | Lit | Langues | Fonctionne sur |
| --- | --- | --- | --- | --- |
| **JevK5 4B** | Environ 2,7 Go | Texte | Anglais | Presque tous les ordinateurs : carte graphique NVIDIA, AMD, Intel ou Apple, ou processeur seul. Utilise le même environnement d'exécution que le modèle intégré. |
| **JevK5 2B** | Environ 2 Go | Texte | Anglais | Comme 4B. Plus rapide sur un processeur ou une petite carte graphique, un peu moins précis. |
| **Liquid d1 3B** | Environ 2,3 Go | Texte, images | 16, dont le japonais, le chinois, le coréen, l'allemand, l'espagnol et le russe | Presque tous les ordinateurs. Le choix pour les chats qui ne sont pas en anglais. Gratuit pour les particuliers et les entreprises dont le chiffre d'affaires annuel est inférieur à 10 millions de dollars. |
| **Valen-Decision 1.5 4B** | Environ 5,8 Go | Texte, images | 8 vérifiées | Linux sur un processeur Intel ou AMD 64 bits, sur le processeur uniquement. |
| **Valen-Decision 1.5 2B (full release)** | Environ 6,4 Go | Texte, images, clips | Non indiqué | Windows, macOS sur Apple silicon et Linux, sur le processeur. Nécessite environ 6 Go de mémoire. |
| **Valen-Decision 1.5 4B (full release)** | Environ 11,8 Go | Texte, images, clips | 8 vérifiées | Comme 2B. Nécessite environ 12 Go de mémoire ; plus lent mais plus précis. |
| **Winnow E4B** | Environ 9 Go | Texte, images | Non indiqué | Uniquement Linux avec une carte NVIDIA de la série RTX 50, les bibliothèques CUDA 13 et un processeur avec AVX-512 (comme les AMD Ryzen 7000 ou 9000 ; les puces Intel actuelles pour ordinateurs portables et de bureau n'en disposent pas). Nécessite environ 11 Go de mémoire graphique. |
| **Open-Jev 2B** | Environ 4,6 Go | Texte | Anglais | Linux avec une carte NVIDIA de la série RTX 20 ou plus récente et un pilote 580 ou plus récent. Utilise environ 4,8 Go de mémoire graphique et 10 Go de disque. |
| **Open-Jev 9B** | Environ 19,4 Go | Texte | Anglais | Comme 2B. Utilise environ 23,6 Go de mémoire graphique : sur une carte de 24 Go, rien d'autre ne tient à côté. |

Sur 20 tours de Roleplay en 8 langues, JevK5 4B, Liquid d1 et Valen-Decision 1.5 4B ont tous répondu correctement aux 20. Choisis Liquid d1 si tu hésites, ou la version complète de Valen si tu veux lire des clips.

Avant tout téléchargement, Marinara vérifie que ton ordinateur peut exécuter le modèle : le système, les fonctionnalités du processeur, la carte graphique et ses bibliothèques, et la mémoire libre. Un modèle qui ne peut pas s'exécuter reste dans la liste, marqué **(ne peut pas s'exécuter ici)**, avec la raison.

### En installer un

1. Clique sur **Connexions** dans la barre du haut. Sous **On this device** (sur cet appareil), clique sur **Built-in model (decisions)** (modèle intégré pour les décisions). Tu peux aussi cliquer sur **Ajouter** dans le panneau **Connexions**, puis sur **Built-in model (decisions)** sous **Decisions** (décisions).
2. Choisis un modèle dans la liste **Modèle**. En dessous, tu vois sa description, puis **Réponses** et **Lit** (voir [Ce qu'affiche la page d'un modèle](#what-a-model-page-lists)), ses langues et ses licences.
3. Clique sur **Télécharger**, avec le nom et la taille du modèle. Confirme la taille, le verdict matériel et les licences. Rien n'est téléchargé avant cette étape.
4. Clique sur **Use for Decision**, ou clique sur **Decision**, sur la page **Jobs** (tâches), et choisis **Built-in model (decisions)**.

Une fois qu'un modèle a été exécuté, sa page affiche aussi **Sur cet ordinateur**, avec les durées mesurées : quelques tours de chat, une image et un clip pour les modèles qui les lisent. Ces durées viennent de ton propre ordinateur : elles t'indiquent donc à quel point un énoncé ralentit quand il demande une image.

Pour changer de modèle, choisis-en un autre dans la liste. Un modèle déjà téléchargé est marqué **(téléchargé)**, et **Utiliser ce modèle** permet de passer à celui-ci sans le télécharger de nouveau.

Autres contrôles de la page :

- **Désactiver** arrête le modèle et conserve ses fichiers. **Activer** le redémarre.
- **Runs on** (s'exécute sur) choisit la carte sur un ordinateur doté de plusieurs cartes NVIDIA. En changer arrête le modèle, qui redémarre sur la nouvelle carte.
- **Démarre** est réglé par défaut sur **Quand un agent en a besoin pour la première fois**, ou sur **Avec Marinara**.
- **Installer depuis un dépôt** accepte un modèle de décision sur Hugging Face sous la forme `owner/model-name` : un checkpoint Open-Jev, un GGUF qui se déclare comme modèle de décision, ou un package GGUF Valen. Ajoute `:Q8_0` après le nom pour choisir une taille de GGUF. Clique sur **Vérifier**. Marinara lit ce que les fichiers déclarent à leur sujet et affiche la taille et les licences. Un dépôt dont il ne peut pas se porter garant est refusé avec la raison. Clique ensuite sur **Télécharger et installer celui-ci**.
- **Supprimer les fichiers** supprime le modèle et son environnement d'exécution.
- **Reinstall** (réinstaller) apparaît quand le modèle installé ne peut pas démarrer parce que ses fichiers ou son environnement d'exécution sont manquants ou obsolètes, généralement après une mise à jour. Le modèle est marqué **Needs reinstall**. La réinstallation conserve les fichiers déjà téléchargés et complets : en général, seul l'environnement d'exécution est téléchargé de nouveau.

La première réponse d'un modèle après son démarrage est plus lente : Marinara pose donc une question de préchauffage pendant le chargement. Si elle échoue, le modèle démarre quand même et la première vraie question subit le retard. Si le modèle s'arrête juste après le démarrage, la page explique pourquoi, par exemple que le processeur ne dispose pas d'une fonctionnalité nécessaire.

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
