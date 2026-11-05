# Créer des agents personnalisés

Un agent personnalisé est un assistant que tu écris toi-même : tes propres instructions, le moment où il s'exécute et ce qu'il a le droit de modifier. Construis-en un quand aucun [agent téléchargeable](built-in-agents.md) ne fait ce que tu veux. Si un agent installé s'en approche, passe le pointeur sur sa carte dans le panneau **Agents** et clique sur **Copy agent** (copier l'agent) pour en obtenir une copie modifiable.

Avant de commencer : lis [Agents : des aides IA pour tes chats](agents-overview.md). Construire un agent ne le fait pas tourner. Tu l'ajoutes ensuite à un chat. Les agents personnalisés fonctionnent dans tous les modes de chat.

## Créer un agent personnalisé

1. Ouvre le panneau **Agents**.
2. Clique sur **New** (nouveau), l'icône plus, près du haut. L'éditeur d'agent pleine page s'ouvre.
3. Saisis un nom dans le champ de titre, par exemple `Weather Reporter`.
4. Remplis **Description** et **Author** (auteur).
5. Choisis une **Pipeline Phase** (phase du pipeline). Voir [Pipeline Phase](#pipeline-phase).
6. Active les pouvoirs dont il a besoin sous **Custom Agent Abilities** (capacités des agents personnalisés).
7. Choisis un **Result Type** (type de résultat) qui correspond à ce que l'agent produit. Dans le doute, choisis **Context Injection**. Il ne demande aucune capacité ni aucun format de sortie strict.
8. Rédige ses instructions sous **Prompt Template** (modèle de prompt).
9. Clique sur **Save** (enregistrer) dans la barre du haut. Un badge vert **Saved** apparaît.

L'agent apparaît maintenant dans la section **Custom Agents** du panneau **Agents**. Pour t'en servir, ouvre un chat, va dans **Chat Settings** (réglages du chat), active **Enable Agents** (activer les agents) et ajoute l'agent depuis **Custom Agents**.

## Pipeline Phase

**Pipeline Phase** détermine le moment où l'agent tourne.

- **Pre-Generation** : avant la réponse. Il peut ajouter du contexte ou modifier le prompt.
- **Parallel** : en même temps que la réponse. Il ne voit pas la réponse terminée.
- **Post-Processing** : après la réponse. Il peut lire la réponse et, pour certains types de résultat, la modifier.

Certains types de résultat imposent une phase. Avec **Text Rewrite**, la phase bascule sur **Post-Processing**. Avec **Prompt Patch** et **Character Activity**, elle bascule sur **Pre-Generation**.

Les agents en Post-Processing disposent aussi d'une section **Turn Data Access** (accès aux données du tour) avec deux interrupteurs, **Pre-generation injections** (injections de pré-génération) et **Parallel agent results** (résultats des agents parallèles). Active-les pour que l'agent puisse lire ce que les autres agents ont produit pendant le même tour.

## Custom Agent Abilities

Les capacités sont des pouvoirs que tu actives toi-même. Chacune reste bloquée tant que tu n'as pas activé son interrupteur.

- **Create lorebooks** : créer un nouveau lorebook produit par l'agent quand sa sortie de lore n'a pas de cible.
- **Edit lorebooks** : écrire des entrées de lorebook ou renvoyer des résultats de mise à jour de lorebook.
- **Edit messages** : remplacer le texte du message généré, ou y ajouter des choix de continuation.
- **Edit trackers** : mettre à jour l'état des trackers de jeu, de personnage, de persona ou personnalisés.
- **Frontend styling** : appliquer un style visuel temporaire pendant la génération.
- **Change chat backgrounds** : changer et enregistrer l'arrière-plan d'un chat.
- **Change character sprites** : changer les expressions des personnages et des personas affichées dans le chat.
- **Control media playback** : piloter Spotify, YouTube ou la musique locale.
- **Control haptic devices** : envoyer des commandes encadrées à un appareil haptique connecté.
- **Edit About Me details** : modifier le texte About Me propre au chat. Les modifications de la fiche publique demandent toujours ton approbation.
- **Image generation** : envoyer un prompt d'image au générateur d'images.
- **Vectors/embeddings** : utiliser un contexte vectoriel. Les vecteurs permettent à Marinara de rechercher du texte par le sens.
- **Main prompt edits** : modifier le prompt envoyé au modèle principal.
- **Create character cards** : proposer une nouvelle fiche de personnage. Elle n'est enregistrée qu'après que tu l'as examinée et acceptée.
- **Choose active chat characters** : choisir lesquels des personnages rattachés au chat sont activés pour la réponse en cours, en Conversation ou en Roleplay.

Si tu actives **Edit lorebooks**, une section **Lorebook Writer** (rédacteur de lorebook) apparaît. Active **Allow lorebook entry writes** (autoriser l'écriture d'entrées de lorebook) et choisis un lorebook dans **Target lorebook** (lorebook cible). L'agent ne peut écrire que dans ce lorebook.

## Result Type

**Result Type** indique à Marinara comment lire la réponse de l'agent. La plupart des types attendent du JSON, un format de texte écrit avec des accolades et des guillemets. Un type reste grisé tant que tu n'as pas activé la capacité dont il a besoin.

Types qui ne demandent aucune capacité :

- **Context Injection** : ajoute du texte avant la génération, ou enregistre une note après. Le plus simple pour commencer.

Types qui demandent **Edit messages** :

- **Text Rewrite** : remplace le texte du message après la réponse.
- **Interactive Choices** : ajoute des choix de continuation au message.

Types qui demandent **Edit trackers** :

- **Character Tracker** : met à jour les personnages présents.
- **Persona Stats** : met à jour les caractéristiques, le statut et l'inventaire du persona.
- **Custom Tracker** : remplace les champs de ton tracker personnalisé.
- **Game State** : met à jour les données de jeu de type état du monde.

Autres types, chacun avec sa propre capacité :

- **Lorebook Update** (Edit lorebooks) : crée ou met à jour des entrées de lorebook.
- **Image Prompt** (Image generation) : demande au générateur d'images de dessiner une scène.
- **Prompt Patch** (Main prompt edits) : ajoute, préfixe ou remplace des sections de prompt.
- **Frontend Style** (Frontend styling) : applique un effet de style temporaire.
- **Background Change** (Change chat backgrounds) : choisit et enregistre un arrière-plan disponible.
- **Sprite Change** (Change character sprites) : change les expressions affichées dans le chat.
- **Spotify Control**, **YouTube Control**, **Local Music Control** (Control media playback) : pilotent la lecture.
- **Haptic Command** (Control haptic devices) : envoie une commande encadrée à un appareil haptique.
- **About Me Update** (Edit About Me details) : met à jour le texte About Me propre au chat et propose des modifications publiques.
- **Character Card Creation** (Create character cards) : propose une fiche de personnage modifiable, soumise à ton approbation.
- **Character Activity** (Choose active chat characters) : sélectionne les fiches de personnage utilisées pour la réponse en cours. L'agent s'exécute alors avant la réponse et doit sélectionner au moins un personnage rattaché au chat.

### Contrôles des agents d'image dans un chat

Un agent doté de la capacité **Image generation** reçoit deux contrôles supplémentaires dans **Chat Settings → Agents → Custom Agents** (réglages du chat → Agents → agents personnalisés).

- **Image model** (modèle d'image) : remplace la connexion d'image de cet agent, dans ce chat uniquement. Laisse-le sur **Agent default** (valeur par défaut de l'agent) pour garder le réglage propre à l'agent. Le réglage **Image Style** (style d'image) du chat s'applique aussi aux images des agents personnalisés.
- **Camera button** (bouton appareil photo) : crée une image tout de suite, sans attendre les mots-clés d'activation. Si le modèle de prompt de l'agent renonce à écrire un prompt, tu reçois une notification d'erreur au lieu d'une image.

## Activation Keywords

Par défaut, un agent tourne à sa cadence normale (la fréquence à laquelle il s'exécute). **Activation Keywords** (mots-clés d'activation) permet de sauter l'agent tant que la scène ne s'y prête pas, ce qui économise des tokens.

1. Dans **Activation Keywords**, saisis un mot-clé ou une expression par ligne, par exemple `tavern` ou `secret door`.
2. Règle **Scan Depth** (profondeur d'analyse) sur le nombre de messages récents à parcourir. La valeur par défaut est 5 et le maximum est 200.

L'agent ne tourne alors que si un mot-clé apparaît dans ces messages. Laisse le champ vide pour désactiver le filtre. La cadence et toute question d'activation continuent de s'appliquer.

## Attacher des outils

Un agent peut appeler des outils : des fonctions que l'IA exécute pour récupérer ou modifier quelque chose, avant d'en relire le résultat. On parle aussi de function calling.

1. Dans l'éditeur d'agent, ouvre **Tools / Function Calling** (outils / appel de fonctions) et active chaque outil voulu. La liste contient les outils intégrés et les tiens. Pour en construire un, consulte [Outils personnalisés](../extending/custom-tools.md).
2. Dans **Chat Settings**, ouvre **Function Calling** et active **Enable Tool Use** (autoriser l'usage des outils). Sans cela, les outils de l'agent restent désactivés.

Les agents importés n'obtiennent jamais d'accès aux outils. Examine un agent importé, puis sélectionne toi-même ses outils.

Un agent dispose d'au plus 16 tours d'appels d'outils par exécution (moins si le `MAX_TOOL_ROUNDS` du serveur est plus bas), puis répond avec ce qu'il a. Un modèle qui appelle un outil à la fois consomme un tour par appel : un agent qui enregistre de nombreuses entrées devrait donc faire plusieurs appels dans une même réponse. Une exécution de rattrapage de lorebook a droit à 64 tours au plus.

## Options de prompt nommées

Un agent peut contenir plusieurs variantes de prompt, pour que chaque chat en choisisse une sans modifier l'agent.

1. Sous **Prompt Template**, repère **Named prompt options** (options de prompt nommées).
2. Clique sur **Add option** (ajouter une option).
3. Donne-lui un nom et une courte description, puis rédige son prompt complet.

Quand quelqu'un ajoute l'agent à un chat, un menu déroulant **Prompt Mode** (mode de prompt) liste tes options. Sans option, seul le prompt par défaut s'affiche.

## Autres réglages

- **Model override** (modèle de remplacement) : utilise un autre modèle pour cet agent, par exemple un modèle moins cher. Laisse-le vide pour utiliser le modèle du chat. L'agent envoie les paramètres de génération enregistrés sur cette connexion. Voir [Paramètres des agents](../prompts/generation-parameters.md#parameters-for-agents).
- **Agent Budget** (budget de l'agent) : **Context Size** (taille du contexte) est le nombre de messages récents que l'agent lit (5 par défaut). **Max Output Tokens** (nombre maximal de tokens en sortie) est la place réservée à la sortie (4 096 par défaut, de 128 à 32 768).
- **Add as Prompt Section** (ajouter comme section du prompt) : expose la dernière sortie de l'agent sous forme de section que tu peux placer dans un preset de prompt.

Les macros comme `{{user}}` et `{{char}}` fonctionnent dans **Prompt Template**. Voir [Macros](../prompts/macros.md).

## Exemple complet

Cet agent réécrit chaque réponse en anglais britannique.

1. Nomme-le `British English Editor`.
2. Sous **Custom Agent Abilities**, active **Edit messages**.
3. Sous **Result Type**, choisis **Text Rewrite**. La phase bascule sur **Post-Processing**.
4. Colle ceci dans **Prompt Template** :

   ```text
   You are a copy editor. Rewrite the latest reply into British English.
   Change spelling and vocabulary only. Do not change the meaning, tone, or events.
   Return JSON with an "editedText" field holding the full rewritten reply,
   and a "changes" array of short notes describing what you changed.
   ```

5. Clique sur **Save**.
6. Ouvre un chat Roleplay, active **Enable Agents** dans **Chat Settings** et ajoute l'agent depuis **Custom Agents**.

Après chaque réponse, l'agent renvoie un JSON de ce genre :

```json
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara insère `editedText` à la place de la réponse. Les notes de `changes` s'affichent sous forme d'un court résumé.

## Importer et exporter des agents

Pour exporter un agent, clique sur **Export agent** (exporter l'agent), l'icône de téléversement, dans la barre du haut de l'éditeur. Le fichier contient le prompt et les réglages de l'agent, jamais les définitions d'outils personnalisés. Pour en exporter plusieurs, utilise **Select agents** (sélectionner des agents) dans le panneau **Agents**, choisis-les et exporte-les.

Les imports externes sont verrouillés par défaut.

1. Ouvre **Settings → Advanced → Danger Zone** (Paramètres → Avancé → Zone de danger) et active **Allow custom Agent imports** (autoriser l'import d'agents personnalisés). Aucune modification du fichier `.env` n'est nécessaire.
2. Dans le panneau **Agents**, clique sur **Import agents** (importer des agents) et choisis des fichiers d'agent ou un dossier.
3. Examine la liste des permissions que Marinara affiche. N'approuve que ce dont l'agent a besoin. Les capacités non cochées restent bloquées.

Ce verrou ne concerne que les agents issus de fichiers, de dossiers ou de dépôts personnalisés. Les agents que tu crées et les agents officiels d'**Agent Organizer** (organisateur d'agents) fonctionnent normalement. Chaque fichier importé reçoit une nouvelle identité personnalisée : il ne peut donc pas remplacer un agent officiel.

Par sécurité, Marinara ignore les fonctions embarquées, efface les sélections d'outils, nettoie le CSS temporaire et vérifie les capacités approuvées avant qu'un agent importé puisse modifier les messages, les trackers, les lorebooks, les arrière-plans, les sprites, les médias, les appareils haptiques, les données About Me, les prompts ou les images. Importe à part les fonctions de confiance, examine-les et attache-les toi-même à l'agent. Désactiver l'interrupteur de la **Danger Zone** empêche les agents importés de tourner.

<a id="activation-questions"></a>

## Questions d'activation

Une question d'activation demande si la scène récente a besoin de ton agent. Elle reconnaît des reformulations que les mots-clés manquent. Elle nécessite un **Decision model** (modèle de décision), un petit modèle qui répond par oui ou par non à des questions. Choisis-en un dans le panneau Connections. Voir [Modèles de décision](../connections/decision-models.md). Avec **Decision model** sur **None** (aucun), le choix par défaut, les champs de la question restent désactivés, et un agent qui a une question s'exécute comme s'il n'en avait pas.

1. Ouvre l'agent personnalisé.
2. Saisis une **Question** (question) de 500 caractères au maximum. Les macros `{{user}}` et `{{char}}` y fonctionnent.
3. Règle **Run when probability is at least** (exécuter si la probabilité atteint au moins) sur le seuil de cet agent. L'agent s'exécute quand la probabilité de "oui" atteint ce seuil : une valeur plus élevée évite donc davantage d'exécutions. L'éditeur affiche une valeur recommandée pour ton modèle : 0,5 pour les modèles de chat locaux et les comptes Decision, ou 0,1 pour les modèles Open-Jev intégrés. Vérifie-la sur tes propres chats après un changement de modèle. Voir [Seuils](../connections/decision-models.md#thresholds).
4. Facultatif : règle **Bypass the question after this many messages without a successful run** (ignorer la question après ce nombre de messages sans exécution réussie). Après ce nombre de messages, la question est ignorée : un modèle qui répond sans cesse "non" ne peut donc pas réduire l'agent au silence pour de bon. Les mots-clés et la cadence s'appliquent toujours.

Rédige la question comme une affirmation sur le dernier message, par exemple `The latest message moves the scene to a new place.` Un petit modèle y répondait de façon plus fiable qu'à `Did the scene change?` Voir [Rédiger les énoncés](../prompts/conditional-prompts.md#writing-statements).

Déroulement :

- Les mots-clés et la cadence sont vérifiés d'abord : un agent écarté ne coûte donc aucune requête de décision. Les questions qui ont la même profondeur d'analyse sont regroupées par phase.
- **Scan Depth** définit les messages utilisés à la fois par les mots-clés et par la question.
- Les agents de pré-génération et parallèles utilisent le chat tel qu'il était avant la réponse. Les agents de post-traitement voient aussi la réponse terminée.
- Un délai dépassé, un modèle indisponible ou une réponse invalide laisse l'agent s'exécuter normalement. Le délai dépend du type de modèle et du fait que le modèle doive raisonner d'abord ou non. Voir [Délais](../connections/decision-models.md#time-limits).
- Les agents importés qui ont une question d'activation ou des énoncés de décision affichent un avis avec un lien vers le guide des modèles de décision. Sans Decision model, l'agent s'exécute dès que les mots-clés et **Trigger Cadence** (cadence d'activation) le permettent, et les énoncés du prompt valent non.

Les questions d'activation ne concernent que les agents personnalisés.

<a id="decision-statements-in-the-agents-prompt"></a>

## Énoncés de décision dans le prompt de l'agent

Une question d'activation décide si l'agent s'exécute. Un énoncé de décision dans **Prompt Template** décide de ce qu'on dit à un agent en cours d'exécution. La syntaxe se trouve dans [Prompts conditionnels](../prompts/conditional-prompts.md#asking-the-decision-model) :

```text
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

Sers-t'en pour envoyer un prompt plus court aux tours calmes. Un tracker peut mettre à jour le lieu seulement quand il a changé. Un agent d'images peut décrire une nouvelle image seulement quand la scène a changé. Un agent musical peut changer de morceau seulement quand l'ambiance a changé. Pour choisir un jeu d'instructions parmi plusieurs, utilise `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`, puis `{{else if decision_choice:"The kind of scene in the latest message" == "dialogue"}}`, et ainsi de suite. Voir [Prompts conditionnels](../prompts/conditional-prompts.md#asking-the-decision-model).

- Les agents de pré-génération et parallèles lisent le chat avant la réponse et partagent les réponses de décision avec le prompt principal. Les agents de post-traitement lisent la réponse terminée, et leurs énoncés sont posés de nouveau avec elle.
- Relancer un agent réutilise les réponses réussies encore en cache pour le même tour, le même modèle et les mêmes énoncés. Voir [Réutilisation des réponses](../prompts/conditional-prompts.md#answer-reuse).
- Dans le prompt d'un agent, `{{char}}` nomme tous les personnages du chat : dans un groupe, `{{char}} is angry` devient "Kaelen, Alyssa is angry". Nomme le personnage, ou écris "a character".
- Sans réponse, un énoncé vaut non. Fais en sorte que la branche `{{else}}` reste sensée, car beaucoup d'utilisateurs n'ont pas de Decision model.

Les agents installés depuis Marinara-Agents traitent leurs prompts de la même façon.

## Guides associés

- [Agents : des aides IA pour tes chats](agents-overview.md)
- [Modèles de décision](../connections/decision-models.md)
- [Référence des agents téléchargeables](built-in-agents.md)
- [Outils personnalisés](../extending/custom-tools.md)
- [Macros](../prompts/macros.md)
