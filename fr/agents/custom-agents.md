# Créer des agents personnalisés

Ce guide explique comment construire ton propre agent dans Marinara Engine. Un agent est un petit assistant IA qui tourne automatiquement en parallèle du chat (ta conversation enregistrée). Au programme : régler sa phase, ses pouvoirs, son type de résultat, ses mots-clés d'activation, ses outils et son prompt (le texte que Marinara envoie à l'IA), avec un exemple complet déroulé de bout en bout.

Tu débutes avec les agents ? Commence par [Agents : des aides IA pour tes chats](agents-overview.md) pour les bases, puis reviens ici.

## Quand construire un agent personnalisé

Marinara Engine propose de nombreux agents officiels à télécharger. Jette un œil à la [Référence des agents téléchargeables](built-in-agents.md) et au dépôt public de packages [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) avant de te lancer. Un agent du catalogue fait peut-être déjà ce que tu cherches, et les manifestes officiels servent d'exemples de packages qui fonctionnent.

Construis un agent personnalisé quand tu as besoin de quelque chose que les agents intégrés ne couvrent pas. Quelques bonnes raisons :

- Tu veux un assistant avec tes propres instructions et ta propre voix.
- Tu veux insérer une note précise dans chaque prompt.
- Tu veux réécrire chaque réponse dans un certain style.
- Tu veux qu'un agent appelle ton propre outil personnalisé.

Si un agent officiel déjà installé s'en approche, copie-le plutôt. Dans le panneau **Agents**, survole sa fiche et clique sur **Copy agent** (copier l'agent). Tu obtiens une copie personnalisée et modifiable.

## Avant de commencer

Deux points comptent avant de construire :

1. Les agents se règlent par chat, pas par personnage. Construire un agent dans la bibliothèque ne le fait pas tourner. Il faut l'ajouter à un chat et activer **Enable Agents** (activer les agents) dans **Chat Settings** (réglages du chat).
2. Les agents personnalisés fonctionnent dans tous les modes de chat : Roleplay, Game Mode et Conversation. Les packages officiels n'apparaissent que dans les modes qu'ils prennent en charge, alors que tes agents personnalisés restent disponibles partout.

## Créer un agent personnalisé

Voici la marche à suivre pour créer un agent personnalisé de zéro :

1. Ouvre le panneau **Agents**.
2. Clique sur le bouton **New** (nouveau), l'icône plus, près du haut.
3. L'éditeur d'agent pleine page s'ouvre sur un agent personnalisé vierge.
4. Saisis un nom dans le champ de titre en haut, par exemple `Weather Reporter`.
5. Remplis les champs **Description** et **Author** (auteur) pour te souvenir de son rôle.
6. Choisis une phase dans **Pipeline Phase** (phase du pipeline), décrite plus bas.
7. Active les pouvoirs dont tu as besoin sous **Custom Agent Abilities** (capacités des agents personnalisés).
8. Choisis un **Result Type** (type de résultat) qui correspond à ce que l'agent doit produire.
9. Rédige les instructions de l'agent sous **Prompt Template** (modèle de prompt).
10. Clique sur **Save** (enregistrer) dans la barre du haut. Un badge vert **Saved** doit apparaître.

Ton nouvel agent figure désormais dans la section **Custom Agents** du panneau **Agents**. Pour t'en servir, ouvre un chat, va dans **Chat Settings**, active **Enable Agents**, puis ajoute ton agent depuis la section **Custom Agents** qui s'y trouve.

## Pipeline Phase

La section **Pipeline Phase** détermine le moment où ton agent tourne. Choisis l'un des trois boutons :

- **Pre-Generation** : tourne avant la réponse de l'IA. Il peut ajouter du contexte ou modifier le prompt.
- **Parallel** : tourne en même temps que la réponse. Il ne voit pas la réponse terminée.
- **Post-Processing** : tourne une fois la réponse terminée. Il peut la lire et, pour certains types de résultat, la modifier.

Certains types de résultat imposent une phase. Si tu choisis **Text Rewrite**, la phase bascule sur **Post-Processing**. Si tu choisis **Prompt Patch**, elle bascule sur **Pre-Generation**. Ces tâches n'ont de sens que dans cette phase-là.

Les agents personnalisés en **Post-Processing** disposent en plus d'une section **Turn Data Access** (accès aux données du tour). Elle contient deux interrupteurs facultatifs : **Pre-generation injections** et **Parallel agent results**. Active-les pour que ton agent puisse lire ce que les autres agents ont produit pendant le même tour. Laisse-les désactivés pour garder ton agent isolé.

## Custom Agent Abilities

Les capacités de la section **Custom Agent Abilities** sont des pouvoirs à activer soi-même. Un pouvoir reste bloqué tant que tu n'as pas activé son interrupteur. Un agent personnalisé est ainsi sans danger par défaut. Voici les capacités disponibles :

| Capacité | Ce qu'elle autorise l'agent à faire |
|---|---|
| **Create lorebooks** | Créer un lorebook produit par l'agent quand sa sortie de lore n'a pas de cible. |
| **Edit lorebooks** | Rédiger des entrées de lorebook ou produire des résultats de mise à jour de lorebook. |
| **Edit messages** | Remplacer le texte du message généré par un texte réécrit, ou y ajouter des choix de continuation. |
| **Edit trackers** | Mettre à jour l'état des trackers de jeu, de personnage, de persona ou personnalisés. |
| **Frontend styling** | Appliquer un effet visuel temporaire pendant la génération. |
| **Change chat backgrounds** | Changer et conserver l'arrière-plan choisi pour un chat. |
| **Change character sprites** | Changer les expressions du personnage et du persona affichées dans le chat. |
| **Control media playback** | Piloter la lecture Spotify, YouTube ou celle de la musique locale. |
| **Control haptic devices** | Envoyer des commandes encadrées à un appareil haptique connecté. |
| **Edit About Me details** | Modifier le texte **About Me** propre au chat. Toute modification de la fiche publique demande encore une approbation distincte. |
| **Image generation** | Déclencher le générateur d'images avec un prompt d'image. |
| **Vectors/embeddings** | Utiliser un contexte vectoriel ou des embeddings. Les vecteurs permettent de rechercher du texte par le sens. |
| **Main prompt edits** | Modifier le prompt envoyé au modèle IA principal. |

Un lorebook est un recueil de notes de fond que l'IA peut faire entrer dans une scène. Un tracker est un panneau vivant qui stocke des faits comme les caractéristiques, l'humeur ou le lieu.

Si tu actives **Edit lorebooks**, une section **Lorebook Writer** (rédacteur de lorebook) apparaît. Active **Allow lorebook entry writes** et choisis un lorebook dans le menu déroulant **Target lorebook**. L'agent ne peut écrire que dans ce lorebook-là.

## Result Type

Le réglage **Result Type** indique à Marinara comment lire la sortie de ton agent. La plupart des types de résultat attendent du JSON de la part de l'agent. Le JSON est un format de texte simple, écrit avec des accolades et des guillemets. Chaque type de résultat exige la capacité correspondante du tableau ci-dessus.

| Type de résultat | Rôle | Capacité requise |
|---|---|---|
| **Context Injection** | Ajoute du texte avant la génération, ou enregistre une note après. | Aucune |
| **Text Rewrite** | Tourne après la réponse et remplace le texte du message. | Edit messages |
| **Lorebook Update** | Crée ou met à jour des entrées de lorebook. | Edit lorebooks |
| **Character Tracker** | Met à jour le tracker de personnage (les personnages présents). | Edit trackers |
| **Persona Stats** | Met à jour les caractéristiques, le statut et l'inventaire du persona. | Edit trackers |
| **Custom Tracker** | Remplace les champs de ton propre tracker personnalisé. | Edit trackers |
| **Game State** | Met à jour les données de jeu de type état du monde. | Edit trackers |
| **Image Prompt** | Demande au générateur d'images de dessiner une scène. | Image generation |
| **Prompt Patch** | Ajoute, préfixe ou remplace des sections de prompt. | Main prompt edits |
| **Frontend Style** | Applique un effet de style temporaire. | Frontend styling |
| **Background Change** | Choisit et conserve un arrière-plan de chat disponible. | Change chat backgrounds |
| **Sprite Change** | Change les expressions du personnage et du persona affichées dans le chat. | Change character sprites |
| **Spotify Control** | Pilote la lecture Spotify. | Control media playback |
| **YouTube Control** | Pilote la lecture YouTube. | Control media playback |
| **Local Music Control** | Pilote la lecture de ta collection de musique locale. | Control media playback |
| **Haptic Command** | Envoie une commande encadrée à un appareil haptique connecté. | Control haptic devices |
| **About Me Update** | Met à jour le texte **About Me** propre au chat et propose des modifications publiques. | Edit About Me details |
| **Interactive Choices** | Ajoute des choix de continuation au message généré. | Edit messages |

Le type **Context Injection** est le point de départ le plus accueillant. Il ne demande aucun interrupteur de capacité ni format de sortie strict. Utilise-le quand tu veux seulement que l'agent ajoute une courte note au prompt ou consigne un résumé.

Si un type de résultat est grisé, c'est que sa capacité n'est pas encore activée. Active l'interrupteur correspondant sous **Custom Agent Abilities** et le type de résultat devient cliquable.

### Contrôles par chat pour les agents d'image

Un agent doté de la capacité **Image generation** reçoit deux contrôles supplémentaires sur sa carte dans **Chat Settings → Agents → Custom Agents**, à côté du sélecteur de modèle de prompt dont dispose chaque agent personnalisé :

- **Image Connection** — remplace uniquement pour ce chat la connexion d'image utilisée par l'agent. Laissez **Agent default** pour conserver la connexion de ses propres réglages. Le choix **Image Style** du chat s'applique aussi aux images des agents personnalisés, ce qui permet à un même agent d'obtenir un rendu différent selon le chat sans le dupliquer.
- **Camera button** — génère immédiatement une image avec cet agent, sans attendre ses mots-clés d'activation. L'agent rédige toujours le prompt lui-même ; si son modèle choisit de ne pas en produire, un message d'erreur apparaît à la place de l'image.

## Activation Keywords

Par défaut, un agent personnalisé tourne à sa cadence normale. La section **Activation Keywords** (mots-clés d'activation) permet de le sauter tant que la scène ne s'y prête pas. Tu économises ainsi des tokens et de l'argent. Un token est un petit morceau de texte que l'IA compte.

Pour mettre cela en place :

1. Dans la section **Activation Keywords**, saisis un mot-clé ou une expression par ligne. Par exemple :

```
tavern
secret door
moonlit ritual
```

2. Règle **Scan Depth** (profondeur d'analyse) sur le nombre de messages récents à parcourir. La valeur par défaut est 5. Le maximum est 200.
3. L'agent ne tourne alors que si au moins un mot-clé apparaît dans ce nombre de messages récents.

Laisse le champ des mots-clés vide pour que l'agent tourne à chaque fois, à sa cadence normale.

## Attacher des outils (Function Calling)

Ton agent peut appeler des outils. Un outil est une fonction que l'IA peut exécuter pour récupérer ou modifier quelque chose, puis en relire le résultat. On parle aussi de function calling.

Pour attacher des outils, ouvre la section **Tools / Function Calling** et active ou désactive chaque outil. La liste contient les outils intégrés ainsi que tous les outils personnalisés que tu as créés. Pour apprendre à construire les tiens, lis [Outils personnalisés](../extending/custom-tools.md).

Les outils ne fonctionnent que si le chat lui-même les autorise. Dans **Chat Settings**, ouvre la section **Function Calling** et active **Enable Tool Use**. Sans ce réglage de chat, les outils de l'agent restent inactifs, même si tu les actives ici.

Les fichiers d'agent importés n'accordent aucun accès aux outils. Après avoir importé un agent, inspecte son prompt et ses réglages, puis sélectionne toi-même les outils que tu veux lui confier.

## Options de prompt nommées

Un même agent peut contenir plusieurs variantes de prompt. C'est la fonctionnalité **Named prompt options** (options de prompt nommées). Un chat peut ainsi choisir une variante sans que tu modifies l'agent partout.

Pour ajouter une variante :

1. Sous **Prompt Template**, repère **Named prompt options**.
2. Clique sur **Add option**.
3. Donne à l'option un nom et une courte description.
4. Rédige le corps complet du prompt pour cette option.

Quand quelqu'un ajoute ton agent à un chat, un menu déroulant **Prompt Mode** lui présente tes options nommées. Si tu n'en ajoutes aucune, le menu du chat ne montre que le prompt par défaut.

## Autres réglages ajustables

Les agents personnalisés partagent certains réglages avec les agents intégrés :

- **Connection Override** (connexion de remplacement) : choisis une autre connexion IA pour cet agent. Par exemple, un modèle moins cher pour le travail de fond. Laisse le champ vide pour utiliser la connexion du chat.
- **Agent Budget** (budget de l'agent) : règle **Context Size** (combien de messages récents l'agent lit, 5 par défaut). Règle aussi **Max Output Tokens** (la place réservée à la sortie, 4096 par défaut, de 128 à 32768).
- **Add as Prompt Section** : active ce réglage pour exposer la dernière sortie de l'agent sous forme de section insérable dans un preset de prompt.

Les macros comme `{{user}}` et `{{char}}` fonctionnent dans le champ **Prompt Template**. La liste complète se trouve dans [Macros](../prompts/macros.md).

## Un exemple complet

Voici un agent personnalisé entier qui réécrit chaque réponse en anglais britannique.

Configuration dans l'éditeur :

1. Nomme-le `British English Editor`.
2. Sous **Custom Agent Abilities**, active **Edit messages**.
3. Sous **Result Type**, choisis **Text Rewrite**. La phase bascule d'elle-même sur **Post-Processing**.
4. Colle ceci dans le champ **Prompt Template** :

```
You are a copy editor. Rewrite the latest reply into British English.
Change spelling and vocabulary only. Do not change the meaning, tone, or events.
Return JSON with an "editedText" field holding the full rewritten reply,
and a "changes" array of short notes describing what you changed.
```

5. Clique sur **Save**.
6. Ouvre un chat en mode Roleplay, va dans **Chat Settings**, active **Enable Agents**, puis ajoute `British English Editor` depuis la section **Custom Agents**.

Après chaque réponse, l'agent renvoie un JSON de ce genre :

```
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara lit `editedText` et l'insère à la place de la réponse. Le message s'affiche en anglais britannique. Les notes de `changes` apparaissent sous forme d'un court résumé des ajustements de l'agent.

## Importer et exporter des agents

Un agent personnalisé se partage sous forme de fichier.

Pour exporter depuis l'éditeur, clique sur le bouton **Export agent** (exporter l'agent), l'icône de téléversement, dans la barre du haut. Le prompt et la configuration de l'agent sont enregistrés sous forme de package. Les packages d'agent n'incluent jamais les définitions d'outils personnalisés.

Pour exporter plusieurs agents d'un coup, utilise **Select agents** dans le panneau **Agents**, choisis les agents voulus, puis exporte le lot.

Les imports d'agents externes sont verrouillés par défaut. Ouvre d'abord **Settings → Advanced → Danger Zone** et active **Allow custom Agent imports**. Cet interrupteur ne demande aucune modification du fichier `.env`. Il ne concerne que les agents fournis par des fichiers, des dossiers ou des dépôts personnalisés : les agents que tu crées dans Marinara et les agents officiels installés via **Download Agents** restent disponibles normalement.

Pour importer, ouvre le panneau **Agents** et clique sur **Import agents** pour un seul fichier, ou sur **Import agent folder** pour prendre un dossier entier. Marinara affiche une revue des permissions avant tout enregistrement. N'approuve que les capacités dont l'agent a besoin ; celles que tu laisses décochées restent bloquées. Chaque fichier importé reçoit une nouvelle identité personnalisée, il ne peut donc pas remplacer un agent du catalogue portant le même type interne.

Par sécurité, Marinara ignore les fonctions embarquées, efface les sélections d'outils des réglages importés, nettoie le CSS temporaire avant de l'appliquer, et vérifie les capacités approuvées avant qu'un agent importé puisse modifier les messages, les trackers, les lorebooks, les arrière-plans, les sprites, les médias, les appareils haptiques, les données **About Me**, les prompts ou les images générées. Importe les fonctions de confiance à part, depuis **Function Calls**, examine-les, puis attache-les explicitement à l'agent ensuite. Désactiver de nouveau l'interrupteur de la **Danger Zone** empêche les agents importés de l'extérieur de tourner ; les agents créés en local et les agents officiels ne sont pas touchés.

## Guides associés

- [Agents : des aides IA pour tes chats](agents-overview.md)
- [Référence des agents téléchargeables](built-in-agents.md)
- [Outils personnalisés](../extending/custom-tools.md)
- [Macros](../prompts/macros.md)
