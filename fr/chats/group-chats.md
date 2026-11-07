# Chats de groupe et conversations de groupe

Un chat de groupe, c'est n'importe quel chat Conversation ou Roleplay avec deux personnages ou plus. Ce guide montre comment en créer un, gérer ses membres et choisir qui parle. Game Mode a son propre système d'équipe, qui n'est pas traité ici.

Il n'y a pas de bouton "chat de groupe" à part. Un chat devient un chat de groupe quand tu ajoutes un deuxième personnage. Un chat de groupe n'est ni un **Folder** (dossier : une liste enregistrée de personnages que tu peux réutiliser) ni une **Chat Branch** (branche de chat : une version alternative d'un même chat).

## Créer un chat de groupe

1. Dans le panneau **Chats**, clique sur le bouton **+** du mode voulu : **New Conversation** (nouvelle conversation) ou **New Roleplay** (nouveau roleplay).
2. Un assistant de configuration s'ouvre. À l'étape **Persona & Characters** (persona et personnages), tape dans **Search characters...** (rechercher des personnages) et clique sur un personnage pour l'ajouter.
3. Ajoute un deuxième personnage de la même façon.
4. Termine l'assistant pour ouvrir le chat.

L'intitulé au-dessus du sélecteur change. En Conversation, il affiche **Group Chat** (chat de groupe) et le nombre de membres. En Roleplay, il affiche **Characters** (personnages) et ce nombre. Si tu ne renommes pas le chat, Marinara le nomme d'après les personnages, par exemple "Alice, Bob, Carol".

Le nombre de personnages n'a pas de limite fixe. Plus il y a de personnages, plus le prompt – le texte que Marinara envoie à l'IA – est long et plus chaque réponse coûte cher : n'ajoute donc que les personnages dont la scène a besoin.

Pour ajouter tout un dossier d'un coup, ouvre **Add from Folder** (ajouter depuis un dossier) à la même étape, choisis un dossier et clique sur **Add** (ajouter). Les personnages déjà présents dans le chat sont ignorés. Ce contrôle n'apparaît que si tu as au moins un dossier. Voir [Organiser ta bibliothèque de personnages](../characters/library-organization.md). La ligne **Random** (aléatoire), signalée par l'étiquette **Dice pick**, ajoute au hasard un personnage qui n'est pas encore dans le chat.

## Gérer les membres

Ouvre **Chat Settings** (réglages du chat) et repère la section **Characters**. Elle n'existe pas en Game Mode. Chaque ligne de membre comporte un avatar, un nom, une poignée de déplacement, une icône d'œil et une icône de corbeille.

| Pour faire ceci | Fais cela |
| --- | --- |
| Ajouter un personnage | Clique sur **Add Character** (ajouter un personnage) et lance une recherche. |
| Ajouter un dossier | Clique sur **Add Character**, puis sur **Add all** (tout ajouter) sur la ligne du dossier. |
| En modifier plusieurs d'un coup | Clique sur **Add Character**. Les membres déjà présents dans le chat sont cochés. Clique sur un nom pour l'ajouter ou le retirer. |
| Ouvrir la fiche complète d'un membre | Clique sur le nom du membre (**Open character card**, ouvrir la fiche de personnage). Le panneau **Chat Settings** se ferme et la fiche s'ouvre. |
| Retirer un personnage | Clique sur l'icône de corbeille (**Remove from chat**, retirer du chat). |
| Réordonner | Fais glisser la poignée (**Drag to reorder**, glisser pour réordonner). Avec l'ordre **Sequential** (séquentiel), les personnages répondent dans cet ordre. |
| Mettre en pause un moment | Clique sur l'œil (**Disable in chat**, désactiver dans le chat). Clique à nouveau pour le réactiver (**Enable in chat**, activer dans le chat). |

Un personnage désactivé reste dans la liste, mais il est écarté de toutes les réponses. Sa fiche de personnage n'est pas envoyée au modèle et il ne peut pas être choisi pour parler. Si tu désactives tous les personnages, Marinara les considère tous comme actifs pour qu'une réponse ne soit jamais vide. Ce choix est enregistré chat par chat et ne change rien ailleurs. Dans un groupe Roleplay en mode Merged, [Automate active characters](#automate-active-characters-merged-only) peut le régler à ta place.

<a id="choose-who-speaks"></a>

## Choisir qui parle

Ouvre **Chat Settings → Group Chat** (réglages du chat → chat de groupe). La section n'apparaît que si le chat compte deux personnages ou plus. Les deux modes utilisent le même interrupteur **Mode**.

- Une seule réponse fait parler tous les personnages. C'est **Merged (Narrator)** (fusionné, avec narrateur) en Roleplay et **Grouped** (groupé) en Conversation. C'est la valeur par défaut. En Roleplay, le narrateur est une voix qui décrit la scène, et il fait partie de la même réponse.
- **Individual** (individuel) donne à chaque personnage sa propre réponse.

En Conversation, passer à **Individual** affiche un avertissement, **Individual replies can use many tokens**. Chaque personnage qui répond utilise une requête distincte au modèle, et les grands groupes avec Autonomous Messaging consomment vite des tokens.

### Automate active characters (Roleplay, Merged uniquement)

Ce réglage active et désactive les personnages à ta place dans un grand casting. Voir [Automate active characters](#automate-active-characters-merged-only) à la fin de ce guide.

### Color Dialogues (Roleplay, Merged uniquement)

**Color Dialogues** (dialogues colorés) est désactivé par défaut. Une fois activé, les répliques de chaque personnage utilisent ses propres couleurs, définies dans l'onglet **Colors** (couleurs) du Character Editor (l'éditeur de personnage). Dans un groupe Conversation, les répliques sont colorées automatiquement selon l'intervenant et il n'y a pas d'interrupteur.

<a id="response-order-individual-only"></a>

### Response Order (Individual uniquement)

Quand **Mode** est réglé sur **Individual**, le réglage **Response Order** (ordre des réponses) apparaît. **Sequential** est la valeur par défaut.

| Ordre | Ce qui se passe |
| --- | --- |
| **Sequential** | Les personnages répondent à tour de rôle, dans l'ordre de la liste **Characters**. En Conversation, les personnages hors ligne sont ignorés. |
| **Smart** | Un court appel caché au modèle choisit qui répond ensuite, en général un seul personnage. Une mention `@Alice` dans ton message prend le pas sur ce choix. En Conversation, il s'appuie sur la conversation, le statut d'emploi du temps et le niveau de bavardage. |
| **Manual** | Personne ne répond de lui-même. En Roleplay, utilise le sélecteur **Trigger Response** (déclencher une réponse). En Conversation, mentionne un ou plusieurs personnages avec `@mention` ou utilise le sélecteur. |

Avec l'ordre **Smart** (intelligent), le modèle peut mettre plusieurs personnages en file d'attente. Seul le premier répond tout de suite. Utilise le sélecteur **Trigger Response**, ou envoie un message vide, pour générer le personnage suivant de la file.

Si tu as choisi un [Decision model](../connections/decision-models.md) (modèle de décision), tu peux activer **Also use it to pick who speaks in Smart response order** (l'utiliser aussi pour choisir qui parle dans l'ordre Smart) juste en dessous. L'ordre Smart demande alors un score oui/non pour chaque candidat.

- Les questions partagent les cinq derniers messages et une liste indiquant, pour chaque candidat, son nom, son statut, son activité, son niveau de bavardage et un court extrait de sa personnalité. Un service hébergé reçoit aussi cette liste. Voir [Ce que voit le modèle](../connections/decision-models.md#what-the-model-sees).
- La vitesse et le coût dépendent du modèle et du nombre de candidats.
- En Roleplay, Marinara choisit l'intervenant le plus probable. En Conversation, tous ceux qui ont une raison de répondre le font, les plus probables d'abord. Le personnage qui vient de parler attend si quelqu'un d'autre a une raison de répondre.
- Si le Decision model ne donne aucune réponse, l'ordre Smart fait son appel habituel au modèle.

En Roleplay, en mode **Individual** avec l'ordre **Smart** ou **Manual** (manuel), la première option du sélecteur est **Smart**, signalée par une icône de personnes. Elle demande au modèle de choisir le prochain intervenant pour cette seule réponse. Ton ordre enregistré reste inchangé.

### Déclencher une réponse à la main

Utilise le sélecteur **Trigger Response** pour choisir un intervenant. Sur ordinateur, c'est un bouton à côté de **Send** (envoyer), avec l'étiquette **Trigger character response** (déclencher la réponse d'un personnage). Sur téléphone, il se trouve sous **Trigger Response**, dans le tiroir d'outils que tu ouvres depuis la barre de message. Pour nommer un intervenant par écrit, tape `@` suivi du nom du personnage. Une liste d'autocomplétion apparaît.

### Autres réglages Individual

- **Add Turn To Prompt** (ajouter le tour au prompt) est activé par défaut. Il ajoute une courte instruction qui indique quel personnage doit répondre.
- **Name Prefix History** (préfixer l'historique par les noms ; Roleplay uniquement) est désactivé par défaut. Il change la façon dont les messages passés sont étiquetés avec le nom de leur auteur. Laisse-le désactivé, sauf si un personnage confond sans arrêt qui a dit quoi.

### Scenario Override (Roleplay)

**Scenario Override** (remplacement du scénario) donne un scénario commun à tout le groupe. Le texte du champ remplace dans le prompt le scénario propre à chaque personnage. Un champ vide laisse chaque scénario tel quel. Il n'y a pas d'interrupteur. Pour éditer dans une fenêtre plus grande, clique sur l'icône d'agrandissement (**Expand editor**, agrandir l'éditeur) : l'éditeur qui s'ouvre s'intitule **Group Scenario Override**. Ce texte reste attaché à un seul chat et n'est pas repris dans les profils de réglages.

### Character Exchanges (Conversation)

Active **Character Exchanges** (échanges entre personnages) dans **Chat Settings → Autonomous Messaging** (réglages du chat → messages autonomes) pour laisser les personnages se parler entre eux pendant ton absence. L'option est désactivée par défaut et n'apparaît que dans un chat de groupe. Elle ne fonctionne que tant que Marinara est ouvert dans ton navigateur, et elle partage la limite quotidienne de messages des messages autonomes. Elle fonctionne avec ou sans emplois du temps des personnages. Dans un groupe **Individual**, les échanges et les réponses déclenchées par une `@mention` n'utilisent jamais la dernière prise de nouvelles du groupe pour la journée.

## Réglages et valeurs par défaut

| Réglage | Emplacement | Par défaut |
| --- | --- | --- |
| **Mode** | Section Group Chat | **Merged (Narrator)** en Roleplay, **Grouped** en Conversation |
| **Color Dialogues** | Roleplay, Merged | Désactivé |
| **Automate active characters** | Roleplay, Merged | Désactivé |
| **Response Order** | Individual | Sequential |
| **Add Turn To Prompt** | Individual | Activé |
| **Name Prefix History** | Roleplay, Individual | Désactivé |
| **Scenario Override** | Roleplay | Vide |
| **Character Exchanges** | Conversation, Autonomous Messaging | Désactivé |

Les profils de réglages enregistrent ces réglages, sauf **Scenario Override** et les épingles de l'automatisation. Voir [Profils de réglages](settings-profiles.md).

## Référence

<a id="automate-active-characters-merged-only"></a>

### Automate active characters (Merged uniquement)

En mode Merged, la fiche de chaque personnage actif figure dans le prompt à chaque réponse. En Roleplay, **Automate active characters** (automatiser les personnages actifs) peut activer et désactiver les fiches à ta place, pour qu'un grand casting ne remplisse pas le contexte. Le réglage propose trois options et il est sur **Off** (désactivé) par défaut.

| Option | Ce qu'elle fait |
| --- | --- |
| **Off** | Tu choisis qui est actif avec les icônes d'œil. |
| **Decision model** | Avant chaque réponse, ton [Decision model](../connections/decision-models.md) répond à une question oui/non par personnage : ce personnage est-il dans la scène que la réponse prolonge, ou y entre-t-il ? Un personnage qui est seulement mentionné ou évoqué reste désactivé. |
| **Character Tracker** | Les personnages présents selon [Character Tracker](../agents/built-in-agents.md#character-tracker) dans la dernière réponse déterminent qui est actif. Cela ne demande aucun appel de modèle supplémentaire, mais il a un tour de retard : un personnage qui entre maintenant est activé pour la réponse suivante. |

Une indication sous le réglage te signale ce qui manque : aucun Decision model choisi, Character Tracker désactivé dans ce chat, ou un tracker exécuté manuellement, qui ne change la liste qu'après que tu l'as lancé.

- **Épingles.** Tant que l'automatisation est active, chaque ligne de personnage affiche une épingle à gauche de son œil. Clique dessus pour épingler le personnage tel qu'il est maintenant, activé ou désactivé : l'automatisation le laisse alors tranquille. Basculer un œil à la main épingle aussi ce personnage. Clique de nouveau sur une épingle pour la retirer. Passer l'automatisation sur **Off** retire toutes les épingles.
- **Le narrateur reste actif.** Le Narrator (narrateur) désigné n'est jamais désactivé.
- **Sans réponse, la liste reste.** En mode **Decision model**, si le modèle ne donne aucune réponse, la dernière scène de Character Tracker est utilisée quand il y en a une. Cela couvre aussi un modèle qui raisonne d'abord, sauf si **Also gate agents that run before the reply** (évaluer aussi les agents exécutés avant la réponse) est activé, ainsi qu'un casting trop grand pour l'entrée du Decision model. Si aucun des deux ne répond, la liste reste telle quelle.
- **Aucun personnage actif : résultat ignoré.** Un résultat qui désactiverait tout le monde n'est pas appliqué.
- **Un agent Character Activity prime.** Un chat avec un agent personnalisé qui utilise le type de résultat **Character Activity** laisse cet agent aux commandes.

Character Tracker écrit son propre nom pour chaque personnage. Marinara le relie à une fiche d'abord par l'identifiant de la fiche, puis par le nom, puis par les alias de nom de l'onglet **Colors**. Une liste du tracker qui ne nomme aucun des personnages du chat conserve la liste actuelle. L'automatisation s'exécute avant chaque réponse, chaque swipe et chaque régénération, et ignore **Continue** (continuer) et l'impersonation. Le réglage est enregistré dans les profils de réglages. Les épingles restent attachées à ce seul chat.
