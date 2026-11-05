# Réglages de Noodle et reprise vers les chats

Le panneau **Noodle settings** (réglages de Noodle) te permet de choisir qui participe à la timeline, combien les comptes publient, et comment Noodle partage du contexte avec tes chats. Deux fonctionnalités partagent du contexte en sens inverse l'une de l'autre : **Carryover to chats** (reprise vers les chats) et l'interrupteur **Allow Noodle references** (autoriser les références à Noodle), propre à chaque chat.

Si tu découvres Noodle, commence par lire [Noodle : la timeline sociale intégrée](noodle.md). Un persona, c'est le personnage que tu incarnes dans un chat. Pour les comptes d'IA, voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

## Ouvrir les réglages

1. Ouvre Noodle depuis **Home** (accueil).
2. Dans la barre latérale de gauche, clique sur **Settings** (Paramètres), l'icône d'engrenage. L'en-tête affiche **Noodle settings**.
3. Choisis une page avec les boutons sous l'en-tête.

| Page | Sections |
| --- | --- |
| **General** (général) | [Refresh](#refresh), [Translation](#translation) |
| **Timeline** (fil) | [Activity](#activity), [Image Generation](#image-generation) |
| **Participants** | [Invites](#invites), [Utilisateurs aléatoires](#random-users) (**Ambient Profiles**, profils d'ambiance), [Active Accounts](#active-accounts) |
| **Advanced** (avancé) | **Noodle Prompt** (prompt de Noodle), [Image Understanding](#image-understanding), [Timeline Writing](#timeline-writing), [World / Lore](#world--lore), [Carryover](#carryover), [Reset Noodle](#reset-noodle) |

Tous les réglages de Noodle sont globaux. Ils s'appliquent à chaque persona et à chaque chat. Les changements s'enregistrent dès que tu les fais. La liste complète des valeurs par défaut se trouve dans [Réglages et valeurs par défaut](#settings-and-defaults).

## Refresh

Un rafraîchissement, c'est le moment où l'IA écrit une série de posts, de réponses, de reposts et de likes pour les comptes invités. Cette section règle le modèle avec lequel Noodle écrit et la fréquence de ses rafraîchissements automatiques.

- **Generation model** (modèle de génération) : le modèle que Noodle utilise pour écrire les posts, les réponses, les reposts, les likes et le texte des profils. Au départ, rien n'est sélectionné et le texte indicatif affiche **Choose connection**. Tu dois en choisir un avant qu'un rafraîchissement puisse s'exécuter. Un modèle capable de voir les images reçoit aussi jusqu'à huit images récentes et pertinentes issues des posts et des commentaires. Un modèle texte seul qui les rejette est relancé sans les images.
- **Refreshes/day** (rafraîchissements par jour) : de 0 à 24, **2** par défaut. C'est le nombre de rafraîchissements automatiques lancés chaque jour. 0 les désactive. Cela ne limite pas les rafraîchissements manuels.

### Automatic schedule

Quand **Refreshes/day** est au-dessus de 0, Marinara découpe la journée en fenêtres égales et tire un horaire au hasard dans chacune. Les horaires prévus, avec leur fuseau horaire, s'affichent sous **Automatic schedule** (planification automatique). Clique sur le crayon à côté d'un horaire à venir pour le déplacer sur une autre heure. Les horaires passés, déjà exécutés ou en double ne peuvent pas être choisis.

Les rafraîchissements automatiques s'exécutent dans le serveur : la page Noodle peut donc être fermée, mais Marinara doit tourner. Si un rafraîchissement échoue, la planification affiche l'erreur et retente plus tard, en attendant de plus en plus longtemps après des échecs répétés. Si plusieurs horaires prévus sont manqués, un seul rafraîchissement de rattrapage réussi les couvre.

## Translation

**Translate posts automatically** (traduire automatiquement les posts), désactivé (**off**) par défaut, demande Noodle 1.5.0 ou une version plus récente. Il affiche une traduction sous chaque post et chaque commentaire qui ne vient pas de l'un de tes personas, sans avoir à cliquer sur **Translate** (traduire) pour chacun. Noodle utilise les réglages de traduction par défaut enregistrés depuis la section **Translation** (traduction) des réglages d'un chat, avec le bouton **Save translator defaults** (enregistrer les réglages de traduction par défaut). Sans réglages par défaut enregistrés, il traduit vers l'anglais avec Google Translate. Voir [Traduction des messages](../integrations/message-translation.md). Un texte déjà écrit dans la langue cible n'est pas doublé d'une traduction, une traduction que tu masques reste masquée, et désactiver l'interrupteur arrête les traductions encore en attente.

Les traductions, automatiques ou obtenues avec **Translate**, sont conservées dans ce navigateur. Elles réapparaissent après un rafraîchissement du fil, une sortie de Noodle ou un rechargement de la page. Sur un autre appareil, ou dans un navigateur dont les données ont été effacées, la traduction est refaite. **Reset Noodle Timeline** (réinitialiser la timeline de Noodle) les efface aussi.

## Invites

La section **Invites** (invitations) choisit quels personnages peuvent participer à un rafraîchissement.

- **Professor Mari participates** (Professor Mari participe) : activé (**on**) par défaut. Désactive-le pour masquer Professor Mari dans la découverte des comptes et l'exclure des nouveaux posts, réponses, réactions, mentions, générations de profil et reprises vers les chats. L'historique existant est conservé, et le réactiver restaure son compte.
- **Characters to Invite** (personnages à inviter) : un champ de recherche qui filtre à la fois la liste des dossiers et la liste des personnages.
- **Add from Folder** (ajouter depuis un dossier) : déplie la liste de tes dossiers de personnages. Coche un ou plusieurs dossiers, puis clique sur le bouton d'invitation en bas. Son libellé affiche **Select folders to invite** quand rien n'est coché, **Selected folder characters are invited** quand tout est déjà invité, et **Invite N characters** quand il reste des personnages à ajouter.
- **Characters** (personnages) : tous les personnages de ta bibliothèque. Chaque ligne a un bouton pour inviter ou retirer, et un statut : **Invited**, **Included by folder** ou **Not invited**.

Inviter depuis un dossier est une action groupée ponctuelle, pas une synchronisation permanente. Les personnages que tu ajoutes ensuite au dossier ne sont pas invités automatiquement.

<a id="random-users"></a>

## Utilisateurs aléatoires

Les utilisateurs aléatoires sont six comptes d'ambiance intégrés qui ne viennent pas de ta bibliothèque : Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour et Brine Index. Chacun a une courte bio.

Active-les avec la ligne **Random users** (utilisateurs aléatoires) en haut de la liste **Characters**, dans **Invites**. Elle est désactivée (**off**) par défaut et affiche **Ambient fake profiles** quand elle est désactivée, **Enabled** quand elle est activée. Une fois activés, ces comptes peuvent publier, liker, reposter, répondre et suivre d'autres comptes pendant un rafraîchissement. Ils ne peuvent jamais être suivis.

**Ambient Profiles**, sur la page **Participants**, te permet de modifier ces identités ou d'en générer un autre ensemble. Un nouveau tirage conserve les posts et les relations, mais supprime les images de profil.

## Active Accounts

La section **Active Accounts** (comptes actifs) fixe le nombre de comptes éligibles qui participent à un rafraîchissement. Les comptes éligibles sont tes personnages invités, les personnages inclus par dossier et les utilisateurs aléatoires, s'ils sont activés. Ton persona actif est toujours éligible en plus, tout comme Professor Mari tant qu'elle participe.

- **Active selection** (sélection des actifs), **Random range** par défaut : **Random range**, **Exact count** ou **All invited**.
- **Random range** affiche **Min active** (1 à 100, 2 par défaut) et **Max active** (1 à 100, 5 par défaut). Chaque rafraîchissement tire un nombre entre les deux.
- **Exact count** affiche **Active count** (1 à 100).
- **All invited** : chaque compte éligible participe, sans plafond.

Noodle choisit les comptes actifs avant de préparer les premiers profils. Seuls les personnages actifs qui n'ont pas encore de profil généré font l'objet d'une demande de profil. La requête qui écrit le fil ne reçoit les fiches de personnage que des comptes retenus pour ce rafraîchissement.

## Activity

Chaque champ plafonne ce qu'un seul rafraîchissement peut créer. Mets un champ à 0 pour arrêter ce type d'activité.

| Champ | Par défaut | Plage |
| --- | --- | --- |
| **Posts** | 8 | 0 à 100 |
| **Replies** | 12 | 0 à 200 |
| **Reposts** | 4 | 0 à 100 |
| **Likes** | 18 | 0 à 500 |

## Image Generation

Cette section permet à Noodle de joindre des images créées par l'IA à certains posts. Elle demande un modèle d'image. Voir [Fournisseurs d'IA pris en charge](../connections/providers-reference.md) et [Fournisseurs de génération d'images et configuration](../media/image-providers.md).

- **Image generation** (génération d'images) : désactivé (**off**) par défaut. Active-le pour laisser l'IA créer les images des posts. D'autres réglages apparaissent alors.
- **Image width** (largeur d'image) et **Image height** (hauteur d'image) : de 64 à 4096 pixels, **1024** sur **1536** par défaut.
- **Image generation connection** (connexion de génération d'images) : **Default image generation connection** par défaut, qui utilise le modèle marqué par défaut pour les images dans **Connections** (Connexions). Un personnage peut utiliser le sien (voir [Profils et abonnements](noodle.md#profiles-and-following)).
- **Image instructions (sent to your LLM)** (instructions d'image, envoyées à ton LLM) : un texte intégré, jusqu'à 4000 caractères. Le modèle du fil le suit quand il écrit la description d'image de chaque post : rédige donc des consignes, pas des tags d'image. Pour des tags de style envoyés directement au modèle d'image, utilise un profil de style.
- **Use avatar references** (utiliser les images de référence de l'avatar) : activé (**on**) par défaut. Envoie l'avatar ou les images de référence du personnage au modèle d'image.
- **Interpret image prompts** (interpréter les prompts d'image) : activé (**on**) par défaut. Un modèle de texte réécrit chaque prompt d'image en suivant les **Image prompting instructions** (instructions de prompt d'image) de ton modèle d'image et le Style text (texte de style) de ton profil de style. Quand il est désactivé, ces instructions ne sont pas utilisées et le Style text est ajouté tel quel.
- **Include descriptions** (inclure les descriptions) : activé (**on**) par défaut. Ajoute les notes d'apparence écrites du personnage au prompt d'image. Avec **Interpret image prompts** activé, le modèle de texte les intègre au lieu de les coller telles quelles.
- **Images/refresh** (images par rafraîchissement) : de 0 à 50, **3** par défaut. Plafonne les images de post générées pour chaque rafraîchissement manuel ou automatique.

**Attach gallery images** (joindre des images de la galerie), désactivé (**off**) par défaut, est un interrupteur distinct qui reste visible même quand la génération d'images est désactivée. Au lieu de créer une image, un post peut réutiliser une image de la galerie du personnage ou d'un chat où il apparaît.

Si ça n'a pas marché : quand la génération d'images est activée sans modèle d'image utilisable, le rafraîchissement est bloqué avec le message "Choose an image generation connection for Noodle first." Une image en échec est retentée une fois. Si elle échoue de nouveau, le rafraîchissement continue et publie un post propre, en texte seul.

Le gabarit de ces prompts d'image s'appelle **Noodle Post Image**. Modifie-le dans **Settings → Generations → Image Generation Prompt Overrides** (Paramètres → Générations → remplacements de prompt pour la génération d'images). Tes instructions d'image sont insérées dans ce gabarit, et le résultat passe par ton profil de style. Voir [Prompt Overrides pour l'image et la vidéo](../prompts/prompt-overrides.md) et [Profils de style d'image](../media/style-profiles.md). Professor Mari n'a pas de fiche de personnage : ses posts illustrés utilisent donc son avatar et ses illustrations de référence intégrés.

## Image Understanding

Cette section décide comment le rédacteur du fil voit les images déjà présentes dans la timeline.

- **Show images to the writer** (montrer les images au rédacteur) : activé (**on**) par défaut. Le rédacteur reçoit jusqu'à huit images récentes de la timeline quand son modèle accepte les images. Désactivé, il n'en reçoit aucune.
- **Image captioning** (description des images) : un modèle capable de voir les images décrit les images de la timeline, pour qu'un rédacteur texte seul puisse les suivre lui aussi. Tant que tu ne le modifies pas, ce réglage suit le réglage de description des images défini pour **Generation model**. **Use connection default** (utiliser le réglage de la connexion) y revient.
- **Captioning model** (modèle de description) : apparaît quand la description est activée. **Use Noodle generation connection** (utiliser la connexion de génération de Noodle) utilise le modèle choisi dans **Generation model**. Choisis-en un autre quand ce modèle ne sait pas voir les images.

La description envoie toujours les images de la timeline au modèle de description, même quand **Show images to the writer** est désactivé.

## Timeline Writing

Cette section ajuste le ton et la mémoire du rédacteur des rafraîchissements.

- **Enhanced tone & continuity** (ton et continuité renforcés) : désactivé (**off**) par défaut. Une fois activé, la voix de chaque compte s'appuie davantage sur ses propres champs Personality, Description et Backstory que sur un ton enjoué par défaut. Les comptes sont incités à réagir aux posts des autres, à les citer ou à les contredire au sein d'un même rafraîchissement. Le rappel d'anciens posts survient plus souvent et privilégie les posts liés aux comptes actifs. L'instruction de rappel autorise les références au lieu de les décourager. Désactivé, il reproduit à l'identique le ton et le rappel d'origine de Noodle.
- **Use generated character schedules** (utiliser les emplois du temps générés) : désactivé (**off**) par défaut. Une fois activé, Noodle inclut l'emploi du temps Conversation déjà généré pour aujourd'hui, pour chaque personnage participant, quand il existe. Noodle ne génère et ne met à jour aucun emploi du temps lui-même. La date et l'heure locales du moment sont incluses dans chaque rafraîchissement dans tous les cas.

### Personnaliser la voix du rédacteur

Tu peux réécrire les instructions intégrées du rédacteur sur le ton et la liberté créative dans **Settings → Generations → Image Generation Prompt Overrides → Noodle Timeline Voice & Tone**. Le titre de la section parle d'images ("Image"), mais la liste contient tous les prompts texte personnalisables de Noodle et de Conversation. Le texte par défaut affiché à cet endroit suit **Enhanced tone & continuity** tant que tu n'as pas enregistré ton propre texte. Ensuite, c'est le tien qui s'applique, quel que soit l'état de l'interrupteur.

Ce remplacement ne porte que sur la voix et le ton. Les règles qui garantissent la validité d'un rafraîchissement, comme les actions structurées autorisées, restent toujours actives.

## World / Lore

**Lorebook context** (contexte du lorebook), désactivé (**off**) par défaut, permet à un rafraîchissement d'utiliser des entrées de lorebook, un lorebook étant un recueil de faits sur ton univers. Une fois activé, chaque rafraîchissement analyse le texte des posts et des réponses Noodle récents, ainsi que les profils des personnages actifs, à la recherche de mots-clés de lorebook. Les entrées correspondantes sont ajoutées comme contexte d'univers pour les comptes de ce rafraîchissement. Seuls les lorebooks liés à un personnage actif, ou marqués comme globaux, peuvent se déclencher. Le contenu activé dispose d'un budget strict de 8 192 tokens par rafraîchissement – un token est un petit morceau de texte.

## Carryover

La section **Carryover** (reprise) pousse l'activité Noodle récente dans tes chats. Une fois activée, le prompt d'un chat reçoit un bloc "Recent Social Media Activity" qui décrit ce que tes personnages ont fait sur Noodle.

- **Carryover to chats** : trois interrupteurs, tous désactivés (**off**) par défaut : **Conversations**, **Roleplays** et **Games**. Active les modes qui doivent recevoir l'activité Noodle.
- **Carry hours** (heures de reprise) : de 1 à 720, **48** par défaut. C'est la profondeur, en heures, sur laquelle Noodle cherche de l'activité.
- **Carry items** (éléments de reprise) : de 1 à 50, **8** par défaut. C'est le nombre maximal de résumés ajoutés à un tour de chat.

La reprise ne récupère que l'activité des personnages invités sur Noodle, plus le persona actif du chat. Une inclusion par dossier seule ne suffit pas. Le bloc de reprise complet dispose d'un budget strict de 8 192 tokens par génération de chat. Si la limite d'éléments devait le dépasser, Marinara garde les résumés les plus récents qui tiennent et les affiche dans l'ordre chronologique.

## Reset Noodle

Cette section vide le fil tout en gardant tes comptes et tes réglages.

1. Clique sur **Reset Noodle Timeline**.
2. Lis la boîte de dialogue : "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Clique sur **Reset timeline** (réinitialiser la timeline) pour confirmer.

Seul le contenu du fil est supprimé. Les comptes, les identifiants, les bios, les abonnements, les invitations et tous les réglages restent en place.

## Relier Noodle à tes chats

Noodle et tes chats peuvent partager du contexte dans les deux sens. Activer l'un n'active pas l'autre.

- **Carryover to chats** (dans les réglages de Noodle) envoie l'activité Noodle vers un chat. Voir [Carryover](#carryover).
- **Allow Noodle references** est un interrupteur propre à chaque chat qui envoie l'activité du chat vers Noodle. Tu le trouves dans les réglages du chat lui-même, près de **Connected Chats** (chats connectés). Voir [Vue d'ensemble des Chat Settings](../chats/chat-settings.md). Il est désactivé (**off**) par défaut. Sa description indique "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." Si le chat a aussi un [emploi du temps de personnage Conversation](../conversation/schedules.md) en cours, le statut et l'activité actuels du personnage dans cette histoire, par exemple "currently dnd (At the office)", sont inclus, uniquement pour ce chat-là.

Tu peux n'en utiliser qu'un seul, ou les deux ensemble.

## Dépannage

- **Un rafraîchissement ne produit rien** : choisis un modèle dans **Generation model**, invite au moins un personnage (ou active les utilisateurs aléatoires) et lis l'erreur affichée dans la section **Refresh**.
- **Les rafraîchissements automatiques ne se lancent pas** : mets **Refreshes/day** au-dessus de 0, laisse Marinara tourner, et vérifie les horaires prévus et le fuseau horaire sous **Automatic schedule**. Si une erreur s'affiche, corrige le problème de compte ou de limite de débit et laisse la nouvelle tentative se faire.
- **Les posts ne parlent pas d'un chat récent** : active **Allow Noodle references** dans ce chat et vérifie que le personnage est invité. Le contexte du chat oriente l'IA, il ne garantit rien.
- **L'activité Noodle n'apparaît pas dans les chats** : active le mode correspondant sous **Carryover to chats**, et augmente **Carry hours** si l'activité est trop ancienne.
- **Les posts n'ont pas d'images** : active **Image generation**, choisis un modèle d'image qui fonctionne et vérifie **Images/refresh**.

<a id="settings-and-defaults"></a>

## Réglages et valeurs par défaut

| Réglage | Par défaut | Plage ou options |
| --- | --- | --- |
| **Generation model** | aucun | tout modèle de texte (obligatoire pour un rafraîchissement) |
| **Professor Mari participates** | on | on ou off |
| **Refreshes/day** | 2 | 0 à 24 (0 désactive les rafraîchissements automatiques) |
| **Translate posts automatically** | off | on ou off |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 à 100 (Random range uniquement) |
| **Max active** | 5 | 1 à 100 (Random range uniquement) |
| **Active count** | identique à Max active | 1 à 100 (Exact count uniquement) |
| **Posts** | 8 | 0 à 100 |
| **Replies** | 12 | 0 à 200 |
| **Reposts** | 4 | 0 à 100 |
| **Likes** | 18 | 0 à 500 |
| **Image generation** | off | on ou off |
| **Image width** | 1024 | 64 à 4096 |
| **Image height** | 1536 | 64 à 4096 |
| **Image generation connection** | Default | tout modèle d'image |
| **Image instructions (sent to your LLM)** | texte intégré | jusqu'à 4000 caractères |
| **Use avatar references** | on | on ou off |
| **Interpret image prompts** | on | on ou off |
| **Include descriptions** | on | on ou off |
| **Images/refresh** | 3 | 0 à 50 |
| **Attach gallery images** | off | on ou off |
| **Show images to the writer** | on | on ou off |
| **Image captioning** | suit le Generation model | on ou off |
| **Captioning model** | Use Noodle generation connection | tout modèle capable de voir les images |
| **Use connection default** | on | on ou off ; rétablit le réglage de description des images du Generation model |
| **Lorebook context** | off | on ou off |
| **Enhanced tone & continuity** | off | on ou off |
| **Use generated character schedules** | off | on ou off |
| **Carryover: Conversations** | off | on ou off |
| **Carryover: Roleplays** | off | on ou off |
| **Carryover: Games** | off | on ou off |
| **Carry hours** | 48 | 1 à 720 |
| **Carry items** | 8 | 1 à 50 |
| **Allow Noodle references** (par chat) | off | on ou off |

## Guides associés

- [Noodle : la timeline sociale intégrée](noodle.md)
- [Vue d'ensemble des Chat Settings](../chats/chat-settings.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Fournisseurs d'IA pris en charge](../connections/providers-reference.md)
