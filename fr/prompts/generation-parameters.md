# Paramètres de génération

Ce guide explique les paramètres de génération de Marinara Engine. Ce sont les réglages qui pilotent la façon dont l'IA rédige chaque réponse, comme **Temperature** (température) et **Max Output Tokens** (nombre maximal de tokens en sortie). Tu les modifies chat par chat, dans le panneau **Advanced Parameters** (paramètres avancés).

## À quoi servent les paramètres de génération

Un paramètre de génération est un réglage d'échantillonnage. Il façonne la manière dont le modèle transforme le prompt, le texte que Marinara envoie à l'IA, en texte de réponse. Il ne change pas ce que tu dis à l'IA. Il change la façon dont l'IA te répond.

Par exemple, un paramètre rend les réponses plus aléatoires et plus créatives. Un autre fixe la longueur maximale d'une réponse. La plupart des gens n'y touchent jamais : les valeurs par défaut conviennent très bien au chat courant et au roleplay.

Ne modifie ces réglages que pour corriger un problème précis. Vers la fin, ce guide recense les problèmes fréquents et le paramètre à essayer dans chaque cas.

## Où les trouver

Modifie les valeurs de base dans **Presets > Parameters** (presets > paramètres), et celles de la connexion dans **Connections > Default Parameters** (connexions > paramètres par défaut). Les valeurs propres au chat se règlent dans **Chat Settings > Advanced Parameters** (réglages du chat > paramètres avancés).

1. Ouvre le chat à modifier.
2. Ouvre **Chat Settings** (réglages du chat), l'icône d'engrenage du chat actif.
3. Repère la section **Advanced Parameters** et clique dessus pour la déplier.

Une note d'aide s'affiche : "Override generation parameters for this chat. Only change these if you know what you're doing." Tous les réglages décrits plus bas se trouvent dans **Advanced Parameters**.

La section **Advanced Parameters** existe dans tous les modes de chat (Conversation, Roleplay et Game).

## Chaque paramètre en langage clair

Chaque paramètre numérique dispose d'un champ de saisie et de son propre interrupteur. Cet interrupteur décide si le paramètre part vers le modèle. La section suivante l'explique en détail.

**Temperature** règle le hasard. La plage va de 0 à 2. Les valeurs basses donnent des réponses plus ciblées et plus prévisibles. Les valeurs hautes donnent des réponses plus créatives et plus variées. Une valeur proche de 1 est un juste milieu courant.

**Max Output Tokens** fixe la longueur maximale d'une réponse pour un tour. Un token est un petit morceau de texte, en gros un mot court ou un bout de mot. Augmente cette valeur si les réponses sont coupées. Le champ n'impose pas de plafond fixe.

**Top P** correspond à l'échantillonnage par noyau, ou nucleus sampling. La plage va de 0 à 1. Le modèle puise uniquement parmi les mots les plus probables dont la probabilité cumulée atteint cette valeur. Les valeurs basses donnent des réponses plus ciblées. Une valeur de 1 laisse le modèle tout envisager.

**Top K** limite le modèle aux quelques mots les plus probables à chaque étape. La plage va de 0 à 500. Une valeur de 0 désactive cette limite. Beaucoup de fournisseurs ignorent ce réglage.

**Frequency** pénalise les mots d'autant plus qu'ils sont déjà apparus souvent. La plage va de -2 à 2. Une valeur positive réduit les répétitions de mots. C'est la pénalité de fréquence, affichée dans l'application sous le nom **Frequency**.

**Presence** pénalise les mots déjà apparus, quel que soit leur nombre d'occurrences. La plage va de -2 à 2. Une valeur positive pousse le modèle vers de nouveaux sujets. C'est la pénalité de présence, affichée dans l'application sous le nom **Presence**.

Ensemble, **Frequency** et **Presence** forment les pénalités de répétition.

**Reasoning Effort** (effort de raisonnement) indique à un modèle capable de réflexion à quel point raisonner avant de répondre. Un modèle capable de réflexion est un modèle qui décortique d'abord le problème par étapes cachées. Les choix sont **None**, **Low**, **Medium**, **High**, **Xhigh** et **Maximum**. Si le modèle ne gère pas le niveau choisi, Marinara redescend au niveau le plus élevé qu'il accepte.

Quand l'interrupteur du paramètre est actif, **None** demande au fournisseur de désactiver explicitement la réflexion, au lieu de simplement omettre le réglage d'effort. Marinara n'envoie la commande de désactivation propre au fournisseur qu'aux modèles réputés la prendre en charge. Certains modèles imposent le raisonnement : ils ne peuvent pas couper la réflexion et renvoient parfois quand même du raisonnement. Choisis alors un modèle sans raisonnement si la réflexion doit disparaître. Couper l'interrupteur du paramètre lui-même, c'est autre chose : Marinara n'envoie aucune préférence de raisonnement et le fournisseur garde son comportement par défaut.

**Verbosity** règle la longueur et le niveau de détail des réponses. Les choix sont **None**, **Low**, **Medium** et **High**. **Low** garde des réponses courtes. **High** encourage des réponses plus longues et plus descriptives. Seuls certains modèles exploitent ce réglage.

## L'interrupteur Send

Chaque paramètre numérique, ainsi que **Reasoning Effort** et **Verbosity**, possède un petit interrupteur à côté de son nom. Cet interrupteur n'a pas d'étiquette dans l'application ; ce guide l'appelle l'interrupteur Send. Survole-le pour lire "This parameter is sent to the model" ou "This parameter is not sent to the model."

Quand l'interrupteur Send d'un paramètre est actif, Marinara inclut ce paramètre dans la requête envoyée au fournisseur. Quand il est coupé, Marinara omet complètement le paramètre. Le fournisseur applique alors sa propre valeur par défaut.

Couper l'interrupteur Send n'équivaut pas à saisir une valeur comme 1 ou 0. Une valeur de 1 dicte encore au fournisseur ce qu'il doit utiliser. Couper l'interrupteur ne lui dit rien du tout, et c'est le modèle qui décide.

Sers-toi de l'interrupteur Send quand un fournisseur annonce que deux réglages sont incompatibles. Coupe l'un des deux et réessaie. Il sert aussi quand une erreur signale qu'un paramètre n'est pas accepté ou qu'il est obligatoire. Coupe l'interrupteur de ce paramètre s'il n'est pas accepté, active-le s'il est obligatoire.

Dans la section **Advanced Parameters** d'un chat, seuls **Max Output Tokens** et **Reasoning Effort** ont leur interrupteur Send actif par défaut. Les autres démarrent coupés.

## Valeurs par défaut

Les nouveaux chats partent d'une base intégrée. Le tableau ci-dessous donne ces valeurs de départ et précise si chacune est envoyée par défaut.

| Paramètre | Valeur de départ | Envoyé par défaut |
|---|---|---|
| Temperature | 1 | Non |
| Max Output Tokens | 4096 en Conversation, 8192 en Roleplay et Game | Oui |
| Top P | 1 | Non |
| Top K | 0 (désactivé) | Non |
| Frequency | 0 | Non |
| Presence | 0 | Non |
| Reasoning Effort | Maximum | Oui |
| Verbosity | High | Non |

La valeur reste affichée dans le champ même quand le **Send toggle** est coupé. Elle n'est simplement pas envoyée tant que tu n'actives pas l'interrupteur.

## Assistant Prefill

**Assistant Prefill** (préremplissage de la réponse) est un texte facultatif ajouté tout au début de la réponse de l'IA, juste après ton message. La plupart des gens laissent ce champ vide.

Réserve-le aux modèles compatibles avec un préremplissage ou une balise d'ouverture imposée. Tu peux par exemple saisir une balise d'ouverture comme celle du texte indicatif, pour forcer le modèle à démarrer d'une certaine façon. Dans le doute, laisse le champ vide.

## Assistant Reasoning Prefill

**Assistant Reasoning Prefill** (préremplissage du raisonnement de l'assistant) est un texte caché facultatif ajouté tout au début du raisonnement de l'IA, avant qu'elle écrive sa réponse visible. La plupart des gens laissent ce champ vide.

Réserve-le aux modèles compatibles avec un préremplissage de raisonnement distinct, comme Kimi K3. Tu peux l'utiliser avec **Assistant Prefill** : l'un démarre le raisonnement caché du modèle, l'autre sa réponse visible. Dans le doute sur la compatibilité de ton modèle, laisse le champ vide.

## Thinking Tags

**Thinking Tags** (balises de réflexion) indiquent à Marinara comment un modèle délimite son raisonnement caché à l'intérieur du texte. Certains modèles encadrent leur raisonnement par des balises. Si Marinara connaît ces balises, il masque ce raisonnement derrière l'action **View thoughts** au lieu de l'afficher dans la réponse.

Tu écris une encapsulation par ligne, avec un emplacement au milieu pour le texte caché. Les formes courantes sont déjà reconnues : think, thinking, thought, pipe, channel et les paires de crochets. Ce champ ne sert que pour les modèles qui utilisent une encapsulation inhabituelle.

## Custom Parameters

**Custom Parameters** (paramètres personnalisés) permet d'ajouter des réglages bruts que Marinara n'expose pas dans un champ dédié. Tu saisis un objet JSON, et Marinara le fusionne dans la requête envoyée au fournisseur.

Les Custom Parameters enregistrés comme valeurs par défaut de la connexion partent avec chaque génération de texte passant par l'API sur cette connexion : Conversation, Roleplay, Game, Noodle, résumés et agents compris. Cela vaut aussi pour les endpoints personnalisés qui tournent sur ta propre machine. Les Custom Parameters propres à un chat s'ajoutent pour ce chat et l'emportent sur les clés identiques définies sur la connexion.

Ce champ s'adresse aux utilisateurs avancés. Une clé erronée suffit à faire rejeter la requête par le fournisseur. L'objet doit employer `true`, `false` et `null` en minuscules. Laisse-le vide, sauf si le guide d'un fournisseur te demande d'ajouter une clé précise.

## OpenRouter Service Tier

**OpenRouter Service Tier** (niveau de service OpenRouter) n'apparaît que si la connexion du chat utilise le fournisseur OpenRouter. Ce réglage choisit la façon dont OpenRouter achemine la requête. Les choix sont **Default**, **Flex** et **Priority**. **Flex** peut coûter moins cher et se révéler plus lent. **Priority** peut aller plus vite et coûter davantage. **Default** n'envoie aucun niveau.

## Limiter les messages de contexte

**Limit Context Messages** (limiter les messages de contexte) règle la quantité d'historique du chat envoyée au modèle. Active-le pour n'envoyer que les N derniers messages au lieu du chat entier.

À l'activation, le compteur démarre à 50. Tu peux saisir n'importe quel nombre entre 1 et 9999. Un nombre plus petit envoie moins d'historique, ce qui réduit le coût et accélère les échanges. En contrepartie, l'IA se souvient moins bien de la conversation ancienne. Ce réglage est désactivé par défaut.

## Exclude Past Reasoning

**Exclude Past Reasoning** (exclure le raisonnement passé) est activé par défaut. Ce réglage écarte des nouveaux prompts la réflexion et le raisonnement enregistrés lors des tours précédents. Ce raisonnement n'est donc pas renvoyé au modèle.

Désactiver cette option fait apparaître **Past reasoning blocks** (blocs de raisonnement antérieurs). La valeur par défaut `1` conserve le bloc de raisonnement de l'assistant le plus récent parmi ceux disponibles ; `0` inclut tous les blocs disponibles. Le choix est enregistré pour ce chat et reste enregistré lorsque tu réactives l'exclusion. Cela ne supprime pas les pensées sauvegardées. Seul le raisonnement pris en charge par la connexion actuelle peut être renvoyé.

Laisse-le activé, sauf raison précise de renvoyer l'ancien raisonnement dans le modèle.

## Image Captioning

**Image Captioning** (description automatique des images) change la façon dont l'IA traite les images jointes. Une fois activé, Marinara décrit chaque image jointe sous forme de texte, via une connexion de ton choix, au lieu d'envoyer l'image elle-même.

Utilise-le pour les modèles incapables de voir les images. À l'activation, choisis une connexion dans le menu déroulant **Captioning Connection**. Un endpoint uniquement textuel peut échouer si tu le désignes par erreur. Ce réglage est désactivé par défaut.

## Save as Connection Default

Tout en bas de **Advanced Parameters**, le bouton **Save as Connection Default** (enregistrer comme valeur par défaut de la connexion) inscrit les valeurs de paramètres actuelles sur la connexion elle-même. Ensuite, les nouveaux chats qui utilisent cette même connexion partent de ces valeurs.

Le bouton n'apparaît que pour une connexion normale et enregistrée. Il reste masqué pour le pool de connexions aléatoires et pour le modèle local intégré.

Le bouton **Reset to Defaults** (rétablir les valeurs par défaut), juste en dessous, efface toutes les modifications de paramètres propres au chat et rétablit ses réglages hérités.

## Superposition et priorité des valeurs par défaut

Les paramètres sont déterminés champ par champ, dans cet ordre :

1. Les **Parameters** (paramètres) du preset sélectionné, ou les valeurs de génération intégrées si aucun preset n'est utilisé (température `1`, sortie maximale `4096`). En Roleplay, le preset imposé par la connexion prend le pas sur celui sélectionné dans le chat.
2. Les **Default Parameters** (paramètres par défaut) de la connexion.
3. Les **Advanced Parameters** de ce chat.
4. Règles du mode : un chat de scène actif fixe la sortie à `8192`, le raisonnement à **Maximum** et la verbosité à **High**. Game Mode fixe la sortie à `16384` et le raisonnement à **Maximum**, avec température/top-p à `1`, et top-k, min-p et les pénalités de répétition à `0`. Les connexions Gemma de Game Mode conservent leurs réglages d'échantillonnage et utilisent un budget de sortie d'au moins `16384`.
5. Limites de sortie : Game Mode applique la limite de sortie connue du modèle, et le **Max Output Tokens override** (plafond personnalisé de tokens de sortie) de la connexion plafonne les requêtes dans tous les modes. Le contexte disponible peut encore réduire le budget de sortie.

La ligne **Effective** (valeur effective) à côté d'un paramètre affiche la valeur enregistrée et la couche qui l'emporte, y compris les règles du mode et les plafonds de sortie. Dans l'éditeur de connexions, elle utilise le chat ouvert avec cette connexion, ou une base Roleplay si aucun chat n'est ouvert. Enregistre tes modifications pour actualiser l'affichage. Un interrupteur Send désactivé apparaît comme **not sent** ; les fournisseurs peuvent malgré tout imposer des paramètres obligatoires ou adapter des valeurs non prises en charge. Custom Parameters et l'ajustement au contexte peuvent encore modifier la requête finale.

Par exemple, un preset à `8192` et ce chat à `16384` donnent **Effective: 16384 · this chat**. Un plafond de sortie de `4096` sur la connexion remplace cet affichage par **Effective: 4096 · output token cap**. Réinitialiser les paramètres du chat fait réapparaître la couche applicable suivante ; cela ne supprime pas les règles du preset ou du mode.

## Certains modèles ignorent certains paramètres

Tous les modèles n'acceptent pas tous les paramètres. Quand Marinara sait qu'un modèle rejette un réglage, il l'omet de la requête. Le curseur ou le champ reste visible dans l'application, mais le modifier n'a aucun effet pour ce modèle.

C'est fréquent avec certains modèles de raisonnement et de réflexion, qui refusent les réglages d'échantillonnage comme la température. Si un réglage semble sans effet, le modèle ne l'accepte peut-être pas. Le comportement dépend aussi beaucoup du modèle choisi : une même valeur peut donner un rendu très différent d'un modèle à l'autre.

Avec un modèle à routage automatique, capable de changer de modèle répondant à chaque fois, les paramètres peuvent réagir différemment d'un tour à l'autre. Épingler un modèle précis stabilise le comportement.

## Réglages conseillés selon le symptôme

La plupart des gens n'y touchent jamais. Si tu veux essayer, change un seul réglage à la fois pour repérer ce qui a aidé.

- Les réponses semblent rigides ou répétitives : monte un peu **Temperature**, par exemple de 1 à une valeur entre 1.1 et 1.3.
- Les réponses partent dans tous les sens ou hors sujet : baisse **Temperature**, par exemple à une valeur entre 0.7 et 0.9.
- Les réponses sont coupées en plein milieu : augmente **Max Output Tokens**.
- Un personnage répète sans cesse les mêmes tournures : monte un peu **Frequency** ou **Presence**, par exemple à une valeur entre 0.3 et 0.6.

Ce sont des règles empiriques, pas des recommandations testées. Les modèles réagissent différemment : une valeur efficace sur une connexion ne se transpose pas forcément à une autre.

Pour savoir exactement quels paramètres ont été envoyés pour un message, utilise **Peek Prompt**. L'affichage montre le prompt assemblé, plus le modèle, la température, le nombre maximal de tokens, l'effort de raisonnement et d'autres informations.

## Guides associés

- [Éditeur de presets et gestionnaire de prompts](presets.md)
- [Peek Prompt : voir ce que l'IA a reçu](../chats/peek-prompt.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
