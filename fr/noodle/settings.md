# Réglages de Noodle et reprise vers les chats

Ce guide passe en revue le panneau **Noodle settings** (réglages de Noodle) section par section, avec toutes les valeurs par défaut et toutes les limites. Il explique aussi comment relier Noodle à tes chats. Deux fonctionnalités s'en chargent : le réglage **Carryover to chats** (reprise vers les chats) et l'interrupteur **Allow Noodle references** (autoriser les références à Noodle), propre à chaque chat. Elles fonctionnent en sens inverse l'une de l'autre.

Noodle est le fil de réseau social intégré à Marinara Engine. Si tu le découvres, commence par lire [Noodle : le fil social intégré](overview.md). Un persona, c'est le personnage que tu incarnes dans un chat. Une connexion réunit les informations enregistrées pour joindre un fournisseur d'IA qui génère du texte ou des images. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

## Ouvrir le panneau des réglages de Noodle

1. Ouvre Noodle depuis la barre du haut.
2. Dans la barre latérale de gauche, clique sur le bouton **Settings** (Paramètres), celui avec l'engrenage.
3. L'en-tête du panneau affiche **Noodle settings**.

Tous les réglages de Noodle sont globaux. Ils s'appliquent à chaque persona et à chaque chat, jamais à un seul chat en particulier. Les changements s'enregistrent dès que tu les fais.

## Invites

La section **Invites** (invitations) choisit quels personnages peuvent participer à un rafraîchissement de Noodle. Un rafraîchissement, c'est le moment où l'IA écrit une série de posts, de réponses, de reposts et de likes pour les comptes invités.

- **Professor Mari participates** (Professor Mari participe) : un interrupteur, activé (**on**) par défaut. Désactive-le pour masquer Professor Mari dans la découverte des comptes Noodle et l'exclure des futurs posts, réponses, réactions, mentions, générations de profil et reprises vers les chats. L'historique du fil existant est conservé, et réactiver l'interrupteur restaure son compte.
- **Characters to Invite** (personnages à inviter) : un champ de recherche. Tape ici pour filtrer à la fois la liste des dossiers et la liste des personnages en dessous.
- **Add from Folder** (ajouter depuis un dossier) : clique pour déplier la liste de tes dossiers de personnages. Coche un ou plusieurs dossiers, puis clique sur le bouton d'invitation en bas. L'intitulé du bouton change selon ta sélection :
  - **Select folders to invite** quand rien n'est coché.
  - **Selected folder characters are invited** quand tout est déjà invité.
  - **Invite N characters** quand il reste des personnages à ajouter.
- **Characters** : la liste déroulante de tous les personnages de ta bibliothèque. Chaque ligne a un bouton pour inviter ou retirer. Son statut s'affiche en **Invited**, **Included by folder** ou **Not invited**.

Inviter depuis un dossier est une action groupée ponctuelle. Ce n'est pas une synchronisation permanente. Les personnages que tu ajoutes ensuite à ce dossier ne sont pas invités automatiquement.

## Refresh

La section **Refresh** (rafraîchissement) règle la connexion d'IA avec laquelle Noodle écrit, et la fréquence des rafraîchissements automatiques.

- **Generation connection** (connexion de génération) : un menu déroulant. Choisis la connexion que Noodle utilise pour écrire les posts, les réponses, les reposts, les likes et le texte des profils. Au départ, rien n'est sélectionné et le texte indicatif affiche **Choose connection**. Tu dois en choisir une avant qu'un rafraîchissement puisse s'exécuter. Les modèles capables d'analyser des images reçoivent en plus jusqu'à huit images récentes et pertinentes issues des posts et commentaires Noodle. Les modèles texte seul qui rejettent ces images sont automatiquement relancés sans elles.
- **Refreshes/day** (rafraîchissements par jour) : un nombre, de 0 à 24, **2** par défaut. C'est le nombre de rafraîchissements automatiques que Marinara lance chaque jour. Mets 0 pour désactiver les rafraîchissements automatiques. Cela ne limite pas le nombre de rafraîchissements que tu lances à la main.

### Automatic schedule

Quand **Refreshes/day** est au-dessus de 0, Marinara découpe la journée en fenêtres égales et tire un horaire au hasard dans chacune. Les horaires prévus, avec leur fuseau horaire, s'affichent sous **Automatic schedule** (planification automatique). Clique sur le crayon à côté d'un horaire à venir pour le déplacer sur une autre heure. Les horaires passés, déjà exécutés ou en double ne peuvent pas être choisis.

Les rafraîchissements automatiques s'exécutent dans le serveur Marinara. La page Noodle n'a pas besoin de rester ouverte, mais Marinara doit tourner. Si un rafraîchissement échoue, la planification affiche l'erreur et retente plus tard, en attendant de plus en plus longtemps après des échecs répétés. Si plusieurs horaires prévus sont manqués, un seul rafraîchissement de rattrapage les couvre, ce qui évite d'inonder le fil.


## Active Accounts

La section **Active Accounts** (comptes actifs) fixe le nombre de comptes éligibles qui participent à un rafraîchissement. Les comptes éligibles sont tes personnages invités, les personnages inclus par dossier et les utilisateurs aléatoires si tu les as activés.

- **Active selection** (sélection des actifs) : un menu déroulant, **Random range** par défaut. Les options sont **Random range**, **Exact count** et **All invited**.
- Avec **Random range**, deux champs apparaissent : **Min active** (1 à 100, **2** par défaut) et **Max active** (1 à 100, **5** par défaut). Chaque rafraîchissement tire un nombre entre les deux.
- Avec **Exact count**, un seul champ apparaît : **Active count** (1 à 100). Il fixe un nombre de comptes constant.
- Avec **All invited**, chaque compte éligible participe, sans plafond.

Ton persona actif est toujours éligible en plus de ces comptes. Professor Mari est éligible tant que **Professor Mari participates** est activé.

Noodle choisit les comptes actifs avant de préparer les premiers profils. Seuls les personnages actifs qui n'ont pas encore de profil Noodle généré font l'objet d'une demande de génération de profil ; les personnages invités mais inactifs ne sont pas concernés. De même, la requête qui écrit le fil ne reçoit que les fiches de personnage des comptes retenus pour ce rafraîchissement.

## Activity

La section **Activity** (activité) limite ce qu'un seul rafraîchissement peut créer. Chaque champ est un plafond par rafraîchissement.

| Champ | Par défaut | Plage |
|---|---|---|
| **Posts** | 8 | 0 à 100 |
| **Replies** | 12 | 0 à 200 |
| **Reposts** | 4 | 0 à 100 |
| **Likes** | 18 | 0 à 500 |

Mets un champ à 0 pour empêcher l'IA de créer ce type d'activité.

## Image Generation

La section **Image Generation** (génération d'images) permet à Noodle de joindre des images créées par l'IA à certains posts. Il faut pour cela une connexion de génération d'images, c'est-à-dire une connexion configurée pour fabriquer des images. Voir [Fournisseurs d'IA pris en charge](../connections/providers-reference.md).

- **Image generation** : un interrupteur, désactivé (**off**) par défaut. Active-le pour laisser l'IA générer les images des posts.
- Une fois activé, d'autres réglages apparaissent :
  - **Image generation connection** (connexion de génération d'images) : un menu déroulant, réglé sur **Default image generation connection** par défaut. Laissé sur **Default**, il utilise la connexion marquée comme connexion par défaut pour la génération d'images dans le panneau **Connections**.
  - **Prompt instructions** (instructions de prompt) : une zone de texte avec un contenu par défaut intégré, jusqu'à 4000 caractères. Ces notes supplémentaires sont fusionnées dans le prompt d'image.
  - **Use avatar references** (utiliser les images de référence de l'avatar) : un interrupteur, activé (**on**) par défaut. Envoie l'avatar ou les images de référence du personnage au modèle d'image.
  - **Include descriptions** (inclure les descriptions) : un interrupteur, activé (**on**) par défaut. Ajoute les notes d'apparence écrites du personnage au prompt d'image.
  - **Images/refresh** (images par rafraîchissement) : un nombre, de 0 à 50, **3** par défaut. Il plafonne les images de post générées, séparément pour chaque rafraîchissement manuel ou automatique.
- **Attach gallery images** (joindre des images de la galerie) : un interrupteur distinct, désactivé (**off**) par défaut. Il reste visible même quand **Image generation** est sur **off**. Au lieu de créer une image, il autorise un post à réutiliser une image de la galerie du personnage ou d'un chat où il apparaît.

Si tu actives **Image generation** sans avoir de connexion d'images utilisable, le rafraîchissement est bloqué. Le message "Choose an image generation connection for Noodle first." s'affiche. Une image en échec est retentée une fois. Si la seconde tentative échoue aussi, le rafraîchissement continue et publie un post en texte seul, propre, plutôt que d'exposer le prompt d'image inutilisé.

Le modèle que Noodle utilise pour écrire ces prompts d'image s'appelle **Noodle Post Image**. Tu peux le modifier dans **Settings** > **Generations** > **Image Generation Prompt Overrides**. Ton texte **Prompt instructions** est transmis à ce modèle, et le résultat passe ensuite par ton profil de style d'image habituel. Voir [Remplacements de prompt pour l'image et la vidéo](../prompts/prompt-overrides.md) et [Profils de style d'image](../media/style-profiles.md). Professor Mari n'a pas de fiche de personnage : ses posts illustrés utilisent donc son avatar et ses illustrations de référence intégrés.

## Timeline Writing

La section **Timeline Writing** (écriture du fil) ajuste le ton de l'IA qui écrit les rafraîchissements et sa gestion de la mémoire à long terme.

- **Enhanced tone & continuity** (ton et continuité renforcés) : un interrupteur, désactivé (**off**) par défaut. Une fois activé, la voix de chaque compte s'appuie bien plus fortement sur ses propres champs Personality/Description/Backstory que sur un ton enjoué par défaut, les comptes sont incités à réagir aux posts des autres, à les citer ou à les contredire au sein d'un même rafraîchissement, le rappel d'anciens posts survient plus souvent (et privilégie les posts liés aux comptes actuellement actifs plutôt qu'un tirage purement au hasard), et l'instruction de rappel autorise les références au lieu de les décourager. Sur **off**, le ton et le comportement de rappel d'origine de Noodle sont reproduits à l'identique : activer ce réglage est donc le seul moyen de faire évoluer tes fils.
- **Use generated character schedules** (utiliser les emplois du temps générés) : un interrupteur, désactivé (**off**) par défaut. Une fois activé, Noodle inclut l'emploi du temps Conversation déjà généré pour aujourd'hui, pour chaque personnage participant, quand il existe. Noodle ne génère et ne met à jour aucun emploi du temps lui-même. La date et l'heure locales du moment sont incluses dans chaque rafraîchissement du fil, que cet interrupteur soit activé ou non.

## Personnaliser la voix de l'IA qui écrit le fil

L'IA qui écrit les rafraîchissements de Noodle suit un jeu d'instructions intégré sur le ton et la liberté créative : quelle dose de personnalité doivent porter les posts de chaque compte, et jusqu'où les comptes peuvent se taquiner, plaisanter ou s'opposer. Tu peux réécrire ce texte dans **Settings** > **Generations** > **Image Generation Prompt Overrides** > **Noodle Timeline Voice & Tone** (le titre de la section parle d'images, mais cette liste contient tous les prompts texte personnalisables de Noodle et de Conversation, pas seulement ceux des images). Le texte par défaut affiché à cet endroit suit l'interrupteur **Enhanced tone & continuity** ci-dessus tant que tu ne l'as pas personnalisé ; dès que tu enregistres ton propre texte, c'est lui qui s'applique, quel que soit l'état de l'interrupteur.

Ce remplacement ne porte que sur la voix et le ton. Les règles qui garantissent la validité du résultat d'un rafraîchissement (quelles actions structurées sont autorisées, comment les interactions doivent être ciblées, et ainsi de suite) ne font pas partie de ce texte et restent toujours actives : une voix réécrite ne peut donc pas casser un rafraîchissement.

## World / Lore

La section **World / Lore** (univers et lore) permet à un rafraîchissement d'aller chercher des entrées de lorebook, un lorebook étant un recueil de faits sur ton univers – c'est le même système que celui de la génération dans les chats.

- **Lorebook context** (contexte du lorebook) : un interrupteur, désactivé (**off**) par défaut. Une fois activé, chaque rafraîchissement analyse le texte des posts et réponses Noodle récents, ainsi que les profils des personnages actifs, à la recherche de mots-clés de lorebook, et inclut les entrées correspondantes comme contexte d'univers pour les comptes qui participent à ce rafraîchissement. Seuls les lorebooks liés à un personnage actif (ou marqués comme globaux) peuvent se déclencher. Le contenu d'univers activé dispose d'un budget strict de 8192 tokens par rafraîchissement – un token est un petit morceau de texte. Ce réglage est désactivé par défaut : tes fils existants ne changent pas tant que tu ne l'actives pas.

## Carryover

La section **Carryover** (reprise) pousse l'activité Noodle récente dans tes chats. Une fois activée, le prompt d'un chat reçoit un bloc "Recent Social Media Activity" qui décrit ce que tes personnages ont fait sur Noodle.

- **Carryover to chats** : trois interrupteurs distincts, tous désactivés (**off**) par défaut : **Conversations**, **Roleplays** et **Games**. Active les modes auxquels tu veux transmettre l'activité Noodle.
- **Carry hours** (heures de reprise) : un nombre, de 1 à 720, **48** par défaut. C'est la profondeur, en heures, sur laquelle Noodle cherche de l'activité à reprendre.
- **Carry items** (éléments de reprise) : un nombre, de 1 à 50, **8** par défaut. C'est le nombre maximal de résumés d'activité ajoutés à un tour de chat.

La reprise ne récupère que l'activité des personnages invités sur Noodle, plus le persona actif du chat. Une inclusion par dossier seule ne suffit pas ici.
Le bloc de reprise complet, une fois encapsulé, dispose de son propre budget strict de 8192 tokens par génération de chat. Si la limite d'éléments devait le dépasser, Marinara garde les résumés les plus récents qui tiennent et les affiche dans l'ordre chronologique.

## Reset Noodle

La section **Reset Noodle** (réinitialiser Noodle) vide le fil tout en gardant tes comptes et tes réglages.

1. Clique sur le bouton **Reset Noodle Timeline**.
2. Une fenêtre intitulée **Reset Noodle Timeline** apparaît. Elle indique "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Clique sur **Reset timeline** pour confirmer.

Seul le contenu du fil est supprimé. Tes comptes, tes identifiants, tes bios, tes abonnements, tes invitations et tous les réglages de Noodle restent en place.

## Utilisateurs aléatoires

Les utilisateurs aléatoires sont six comptes d'ambiance intégrés qui ne viennent pas de ta bibliothèque : Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour et Brine Index. Chacun a une courte bio d'ambiance.

Tu les actives avec la ligne **Random users** en haut de la liste **Characters**, dans la section **Invites**. Elle est désactivée (**off**) par défaut. Son sous-titre affiche **Enabled** quand elle est activée, et **Ambient fake profiles** quand elle ne l'est pas. Une fois activés, ces comptes peuvent publier, liker, reposter, répondre et suivre d'autres comptes pendant un rafraîchissement. Ils ne peuvent jamais être suivis depuis un profil.

## Relier Noodle à tes chats

Noodle et tes chats peuvent partager du contexte dans les deux sens. Ce sont deux fonctionnalités distinctes. Activer l'une n'active pas l'autre.

Le réglage **Carryover to chats** (défini dans les réglages de Noodle) envoie l'activité Noodle vers un chat. Il ajoute le bloc "Recent Social Media Activity" au prompt de ce chat, comme décrit dans la section **Carryover** ci-dessus.

Le réglage **Allow Noodle references** est un interrupteur propre à chaque chat. Il envoie l'activité dans l'autre sens, du chat vers Noodle. Tu le trouves dans les réglages du chat lui-même, près de la zone **Connected Chats**. Voir [Vue d'ensemble des réglages du chat](../chats/chat-settings.md). Il est désactivé (**off**) par défaut pour tous les chats. Sa description indique "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." Si ce chat a aussi un [emploi du temps de personnage Conversation](../conversation/schedules.md) en cours, le statut et l'activité actuels du personnage dans cette histoire (par exemple "currently dnd (At the office)") accompagnent ses messages, uniquement pour ce chat-là.

Pour faire apparaître l'activité Noodle dans un chat, active le mode correspondant sous **Carryover to chats**. Pour qu'un rafraîchissement de Noodle puisse lire un chat, active le réglage **Allow Noodle references** de ce chat. Tu peux n'en utiliser qu'un seul, ou les deux ensemble.

## Dépannage

- **Un rafraîchissement manuel ne produit rien** : choisis une **Generation connection**, invite au moins un personnage (ou active les utilisateurs aléatoires) et regarde l'erreur affichée dans la section **Refresh**.
- **Les rafraîchissements automatiques ne se lancent pas** : mets **Refreshes/day** au-dessus de 0, garde le serveur Marinara allumé, et vérifie les horaires prévus et le fuseau horaire sous **Automatic schedule**. Si la planification affiche une erreur, corrige le problème de connexion ou de limite de débit et laisse la nouvelle tentative se faire.
- **Les posts ne parlent pas d'un chat récent** : active **Allow Noodle references** dans les réglages de ce chat, et vérifie que le personnage est bien invité. Le contexte du chat oriente l'IA, il ne garantit rien.
- **L'activité Noodle n'apparaît pas dans les chats** : active le mode correspondant sous **Carryover to chats**, et augmente **Carry hours** si l'activité est trop ancienne.
- **Les posts n'ont pas d'images** : active **Image generation**, choisis une connexion d'images qui fonctionne, et vérifie la limite **Images/refresh**.

## Réglages et valeurs par défaut

Ce tableau liste chaque réglage de Noodle avec sa valeur par défaut et sa plage.

| Réglage | Par défaut | Plage ou options |
|---|---|---|
| **Generation connection** | aucune | toute connexion de texte (obligatoire pour un rafraîchissement) |
| **Professor Mari participates** | on | on ou off |
| **Refreshes/day** | 2 | 0 à 24 (0 désactive les rafraîchissements automatiques) |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 à 100 (Random range uniquement) |
| **Max active** | 5 | 1 à 100 (Random range uniquement) |
| **Active count** | identique à Max active | 1 à 100 (Exact count uniquement) |
| **Posts** | 8 | 0 à 100 |
| **Replies** | 12 | 0 à 200 |
| **Reposts** | 4 | 0 à 100 |
| **Likes** | 18 | 0 à 500 |
| **Image generation** | off | on ou off |
| **Image generation connection** | Default | toute connexion de génération d'images |
| **Prompt instructions** | texte intégré | jusqu'à 4000 caractères |
| **Use avatar references** | on | on ou off |
| **Include descriptions** | on | on ou off |
| **Images/refresh** | 3 | 0 à 50 |
| **Attach gallery images** | off | on ou off |
| **Lorebook context** | off | on ou off |
| **Enhanced tone & continuity** | off | on ou off |
| **Carryover: Conversations** | off | on ou off |
| **Carryover: Roleplays** | off | on ou off |
| **Carryover: Games** | off | on ou off |
| **Carry hours** | 48 | 1 à 720 |
| **Carry items** | 8 | 1 à 50 |
| **Allow Noodle references** (par chat) | off | on ou off |

## Guides associés

- [Noodle : le fil social intégré](overview.md)
- [Vue d'ensemble des réglages du chat](../chats/chat-settings.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Fournisseurs d'IA pris en charge](../connections/providers-reference.md)
