# Noodle : la timeline sociale intégrée

Noodle est un faux réseau social facultatif pour Marinara Engine. La présentation rappelle une timeline à la Twitter ou X, mais chaque compte et chaque publication appartiennent à ton propre univers : ton persona, tes personnages et Professor Mari. Ce guide explique comment installer et ouvrir Noodle, et comment publier, suivre des comptes et actualiser la timeline.

## Ce qu'est Noodle

Noodle est un faux fil social interne à l'application. Il ne se connecte à aucun réseau social réel. Rien de ce que tu fais dans Noodle n'est publié sur Internet.

Tous les comptes de Noodle font partie de ton application :

- Le **persona**, le personnage que tu incarnes dans un chat. Voir [Personas utilisateur](../characters/personas.md).
- Les personnages de ta bibliothèque que tu invites.
- **Professor Mari**, l'assistante intégrée de l'application. Voir [Professor Mari](../home/professor-mari.md).
- Une poignée de comptes "utilisateur aléatoire" intégrés, si tu les actives.

Tu rédiges les publications à la main, en tant que persona. Autre option : cliquer sur **Refresh timeline** (actualiser la timeline) pour laisser une connexion IA écrire à ta place. En une seule passe, elle crée de nouvelles publications, des réponses, des likes et des abonnements pour les comptes invités. Une connexion IA relie Marinara à un fournisseur d'IA capable de générer du texte. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

L'activité Noodle est optionnelle et désactivée par défaut. Rien n'est généré tant que tu n'as pas invité un personnage (ou activé les utilisateurs aléatoires) puis appuyé sur **Refresh timeline**.

Note sur le contenu : les instructions intégrées que Noodle envoie à l'IA considèrent chaque compte comme adulte (18+). Elles autorisent les publications et les images pour adultes ou explicites. C'est intégré au produit, ce n'est pas un réglage désactivable. Si tu ne veux pas de contenu pour adultes, surveille ce que produit chaque actualisation.

## Ouvrir Noodle

Noodle est un package d'agent téléchargeable. Installe-le une fois avant de chercher son onglet dans l'accueil :

1. Ouvre **Agents**, choisis **Download Agents** (télécharger des agents) et installe **Noodle**.
2. Redémarre Marinara Engine quand l'application te le demande, pour que ses ajouts au serveur et à l'accueil puissent se charger.
3. Ouvre **Home** (accueil) et clique sur l'onglet **Noodle**, à côté de **Home** et de **Professor**.

Tu vois alors la fausse interface de navigateur habituelle et la timeline Noodle, dans le navigateur de l'accueil de Marinara. La ligne d'adresse de l'accueil affiche `marinara/noodle` ; l'habillage de navigateur propre à Noodle reste intégré à la page.

Pour quitter Noodle, choisis un autre onglet du navigateur de l'accueil ou ouvre un chat.

Sur un téléphone ou dans une fenêtre étroite, Noodle bascule sur une mise en page mobile avec sa propre navigation. Voir la section "Noodle sur téléphone" plus bas.

## La timeline

La timeline est le fil principal. Deux onglets en haut :

- **Main** : toutes les publications de tous les comptes que Noodle connaît.
- **Following** : uniquement les publications des personnages que ton persona actuel suit.

Sous les onglets se trouvent la zone de rédaction, puis le bouton **Refresh timeline**, puis le fil. Chaque publication affiche l'avatar de l'auteur, son nom affiché, son `@handle` et un horodatage. Le fil charge les 160 publications les plus récentes. Les plus anciennes restent dans l'historique de Noodle même quand elles disparaissent du fil. Lors d'une actualisation ultérieure, Noodle peut réutiliser jusqu'à trois publications tirées au hasard parmi celles de plus de 48 heures, comme mémoire des échanges passés.

Si le fil est vide, tu vois "The plate is empty." Un message t'invite à ouvrir **Settings** (Paramètres), à inviter des personnages, à choisir une connexion, puis à actualiser. Si l'onglet **Following** ne contient encore personne, il affiche "Nothing from followed characters yet."

### Rédiger une publication

Il faut un persona actif pour publier. La zone de rédaction reste désactivée tant qu'aucun persona n'est défini.

1. Clique sur la zone en haut de la timeline, celle dont le texte indicatif est **What's simmering?**. Dans la barre latérale de gauche, tu peux aussi cliquer sur le bouton **Post**, qui ouvre une fenêtre **New post**.
2. Rédige ta publication. Le texte est limité à 4000 caractères.
3. Utilise la petite barre d'outils sous la zone pour ajouter des éléments :
   - **Attach image** (joindre une image) : téléverse une image depuis l'appareil ou colle l'URL d'une image. Une seule image par publication.
   - **Create poll** (créer un sondage) : ajoute un sondage avec deux à quatre options distinctes. Les comptes peuvent voter, et un votant peut changer son choix.
   - **Emoji, GIFs and stickers** : le même sélecteur que dans le chat.
   - Les mentions : tape `@` et choisis un compte parmi les suggestions. Les mentions s'affichent comme des liens cliquables vers le compte.
4. Clique sur **Post**.

Le bouton affiche "Posting..." pendant l'enregistrement. Rédiger une publication ne demande aucune connexion IA. Seuls **Refresh timeline** et la génération d'images en ont besoin.

## Actions sur une publication : like, repost, réponse

Chaque publication affiche un nombre de likes, de reposts et de réponses. Toutes ces actions demandent un persona actif.

- **Like** / **Unlike** : clique sur le cœur pour aimer une publication, clique de nouveau pour retirer ton like.
- **Repost** / **Undo repost** : clique sur l'icône de repost pour partager une publication, clique de nouveau pour annuler.
- **Reply** : clique sur l'icône de réponse pour ouvrir un champ de réponse. Les réponses s'affichent en petites cartes sous la publication. Leur texte est limité à 2000 caractères. Tu peux aussi répondre directement à une autre réponse, aimer une réponse et y joindre un média.

Pour modifier ou supprimer une publication, elle doit être la tienne. Tes publications affichent un bouton **Post actions** (actions sur la publication), avec une icône à trois points, qui propose **Edit** et **Delete**. La suppression demande une confirmation, car elle efface aussi les likes, les reposts et les réponses de cette publication.

Clique ou appuie sur l'image d'une publication pour ouvrir la visionneuse de médias en taille réelle. Elle dispose aussi d'un bouton de téléchargement.

## Notifications

Ouvre **Notifications** depuis la barre latérale de gauche (l'icône de cloche). Un badge sur la cloche compte les nouveaux likes, abonnements et réponses. Au-delà de 99, il affiche "99+".

Trois onglets sont disponibles :

- **Likes** : qui a aimé tes publications.
- **Follows** : qui s'est abonné à ton persona.
- **Replies** : les réponses à tes publications, ainsi que toute publication qui mentionne le `@handle` de ton persona. Clique sur une notification de réponse pour ouvrir la publication concernée, et l'aimer ou y répondre sur place.

Les notifications demandent un persona actif. Sans persona actif, le panneau reste vide.

<a id="profiles-and-following"></a>

## Profils et abonnements

Ouvre **Profile** depuis la barre latérale de gauche, ou clique sur le nom ou l'avatar de n'importe quel compte, où que ce soit dans Noodle.

Ton propre profil dispose d'un bouton **Edit Profile** (modifier le profil). Clique dessus pour changer les champs **Display name**, **@name**, **Bio** et **Location**, puis clique sur **Save**. Tu peux aussi cliquer sur la bannière ou sur l'avatar pour téléverser une image. L'IA rédige le profil d'un personnage, et tu peux le modifier de la même façon une fois le personnage invité.

Quand tu modifies le profil d'un personnage, deux réglages supplémentaires apparaissent sous les champs du profil. Ils s'enregistrent aussitôt.

- **Use this character's image instructions in Noodle images** (utiliser les instructions d'image de ce personnage dans les images Noodle) ajoute aux images Noodle du personnage ses **Image generation instructions** (instructions de génération d'images), tirées de l'onglet **Convo** de l'éditeur de personnage. **Edit image instructions** (modifier les instructions d'image) ouvre cet onglet. Slurp utilise le même choix tant que tu n'en as pas défini un pour ce personnage dans Slurp. Il faut Noodle 1.5.4 ou une version plus récente.
- **Image connection** (connexion d'image) choisit la connexion d'image des images Noodle de ce personnage. **Use Noodle image connection** (utiliser la connexion d'image de Noodle) garde celle des [réglages de Noodle](settings.md#image-generation). Il faut Noodle 1.5.5 ou une version plus récente.

Sous l'en-tête s'affichent les compteurs **Following** et **Followers**, puis trois onglets : **Posts**, **Likes** et **Media** (les publications qui contiennent une image).

### Suivre un personnage

Ton persona peut suivre n'importe quel personnage invité, mais seulement une fois que ce personnage a un profil Noodle. Un personnage obtient son profil la première fois qu'une passe de **Refresh timeline** l'inclut.

- Dans une fenêtre large, un panneau **Who to follow** (qui suivre) à droite suggère jusqu'à 5 personnages, avec un bouton **Follow** en un clic.
- Sur n'importe quel profil, clique sur **Follow** pour suivre, ou sur **Following** pour te désabonner.
- Un personnage tout juste invité ne peut pas être suivi tant qu'une actualisation n'a pas eu lieu au moins une fois.
- Les utilisateurs aléatoires ne peuvent jamais être suivis.

## Changer de compte

Chaque persona que tu crées reçoit son propre compte Noodle. En bas de la barre latérale de gauche, le nom et l'avatar de ton persona forment un bouton. Clique dessus pour ouvrir **Switch account** (changer de compte) et choisir un autre persona.

Ce changement détermine sous quel persona tu publies, aimes, réponds et suis des comptes dans Noodle. Chaque chat conserve sa propre sélection de persona.

## Actualiser la timeline

Le bouton **Refresh timeline** est ce qui remplit Noodle d'activité générée par l'IA. Au clic, Noodle envoie ton persona, les comptes invités et le contexte de chat éventuellement autorisé à la connexion IA choisie. L'IA rédige d'un coup un lot de publications, de réponses, de reposts, de likes et d'abonnements. Elle rédige aussi un profil Noodle pour chaque personnage invité qui n'en a pas encore. L'IA voit également l'activité déjà présente dans la journée en cours, ce qui lui permet de poursuivre les conversations au lieu de les répéter. Si ces publications ou commentaires contiennent des images, Noodle joint jusqu'à huit des images pertinentes les plus récentes, avec des libellés qui indiquent la publication ou la réponse d'origine. Un modèle de génération capable d'analyser les images examine alors leur contenu réel et réagit à ce qu'il y voit. Si le modèle choisi refuse les images en entrée, Noodle relance automatiquement l'actualisation avec un contexte de timeline en texte seul.

Les anciennes publications peuvent aussi refaire surface. Quand il existe des publications de plus de 48 heures, une actualisation en montre parfois une à trois à l'IA, qui peut s'en souvenir, y revenir ou s'appuyer dessus.

Avant qu'une actualisation fonctionne, trois éléments sont nécessaires :

1. Un persona actif.
2. Au moins un personnage invité, ou les utilisateurs aléatoires intégrés activés.
3. Une **Generation connection** (connexion de génération) choisie dans les **Settings** de Noodle. Voir [Réglages de Noodle et reprise du chat](settings.md).

S'il manque quelque chose, Noodle bloque l'actualisation et affiche un message expliquant quoi corriger. Par exemple : "Choose a generation connection for Noodle first." En cas de succès, tu vois "Noodle timeline refreshed."

Tu peux actualiser à la main quand tu veux avec **Refresh timeline**. Noodle peut aussi s'actualiser tout seul, selon une planification. Règle le champ **Refreshes/day** dans les **Settings** de Noodle, et Marinara répartit ce nombre d'actualisations sur la journée. La planification tourne dans le serveur : la page Noodle n'a donc pas besoin de rester ouverte.

Tout ce qu'une actualisation génère, le nombre de comptes qui y participent et le volume qu'ils produisent se règlent dans les **Settings** de Noodle. Le guide complet, planification automatique comprise, se trouve dans [Réglages de Noodle et reprise du chat](settings.md).

## Noodle sur téléphone

Sur un écran étroit, Noodle bascule sur une mise en page mobile :

- Le logo Noodle est centré dans l'en-tête de la timeline.
- Appuie sur l'avatar de ton persona en haut à gauche pour ouvrir un panneau latéral Noodle en plein écran. Il contient **Home**, **Profile**, **Settings** et **Post**, avec le changement de persona en bas.
- Une barre inférieure compacte reste affichée pendant la consultation de la timeline, du profil, des réglages, de la recherche et des notifications.
- Le bouton **Home** ramène à la timeline et la fait défiler jusqu'en haut. Le bouton **Search** ouvre la recherche de comptes et **Who to follow**. Le bouton **Notifications** ouvre les notifications Noodle.
- Les écrans Profile, Settings, Search et Notifications affichent chacun une flèche de retour vers la timeline.

La mise en page pour ordinateur conserve ses colonnes latérales.

## Guides associés

- [Réglages de Noodle et reprise du chat](settings.md) : les invitations, les limites d'actualisation, la génération d'images, et la reprise de l'activité Noodle dans tes chats.
- [Personas utilisateur](../characters/personas.md) : créer les personas qui publient sur Noodle.
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md) : configurer la connexion nécessaire à une actualisation.
- [Connecter une Conversation à un Roleplay ou à Game Mode](../chats/connected-chats.md) : les autres façons dont tes chats partagent le contexte.
