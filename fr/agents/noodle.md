# Noodle : la timeline sociale intégrée

Noodle est un faux réseau social facultatif, intégré à Marinara Engine. La présentation rappelle une timeline à la Twitter ou X, mais chaque compte et chaque publication appartiennent à ton propre univers : ton persona, tes personnages et Professor Mari. Ce guide explique comment installer et ouvrir Noodle, et comment publier, suivre des comptes et actualiser la timeline.

## Ce qu'est Noodle

Noodle est un faux fil social interne à l'application. Il ne se connecte à aucun réseau social réel, et rien de ce que tu y fais n'est publié sur Internet.

Tous les comptes font partie de ton application :

- Ton **persona**, le personnage qui te représente dans un chat. Voir [Personas utilisateur](../characters/personas.md).
- Les personnages de ta bibliothèque que tu invites.
- **Professor Mari**, l'assistante intégrée. Voir [Professor Mari](../home/professor-mari.md).
- Une poignée de comptes "utilisateur aléatoire" intégrés, si tu les actives.

Tu rédiges les publications à la main, en tant que persona. Tu peux aussi cliquer sur **Refresh timeline** (actualiser la timeline) pour laisser un modèle d'IA écrire un lot de publications, de réponses, de likes et d'abonnements pour les comptes invités. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

L'activité Noodle est désactivée par défaut. Rien n'est généré tant que tu n'as pas invité un personnage (ou activé les utilisateurs aléatoires) puis appuyé sur **Refresh timeline**.

> **Remarque :** les instructions intégrées que Noodle envoie à l'IA considèrent chaque compte de la timeline publique comme adulte (18+) et autorisent les publications et les images pour adultes ou explicites. Tu ne peux pas désactiver ce comportement. Si tu ne veux pas de contenu pour adultes, vérifie ce que produit chaque actualisation. Noodle a aussi une timeline pour adultes séparée, NoodleR, protégée par une vérification d'âge et par le réglage **Enable NoodleR** (activer NoodleR), désactivé par défaut. Ce guide traite de la timeline publique.

## Ouvrir Noodle

Noodle est un package d'agent téléchargeable. Installe-le une fois.

1. Ouvre le panneau **Agents** (l'icône Sparkles dans les onglets de droite) et clique sur **Agent Organizer** (organisateur d'agents).
2. Trouve **Noodle** et clique sur **Get** (obtenir).
3. Redémarre Marinara Engine quand l'application te le demande, pour que son code serveur puisse se charger. Pour redémarrer, ferme Marinara Engine et démarre-le à nouveau comme tu le fais d'habitude. Voir [Installation](../INSTALLATION.md).
4. Ouvre **Home** (accueil) et clique sur l'onglet **Noodle**, à côté de **Home** et de **Professor**.

La timeline Noodle s'ouvre dans le navigateur de l'accueil de Marinara. Pour en sortir, choisis un autre onglet de l'accueil ou ouvre un chat. Sur un téléphone ou dans une fenêtre étroite, Noodle utilise une mise en page mobile (voir [Noodle sur téléphone](#noodle-on-a-phone)).

## La timeline

La timeline est le fil principal. Deux onglets se trouvent en haut.

- **Main** : toutes les publications de tous les comptes que Noodle connaît.
- **Following** : uniquement les publications des personnages que ton persona actuel suit.

Sous les onglets se trouvent la zone de rédaction, un bouton **Refresh timeline** et le fil. Chaque publication affiche l'avatar de l'auteur, son nom affiché, son `@handle` et l'heure. Le fil charge les 160 publications les plus récentes. Les plus anciennes restent dans l'historique de Noodle. Lors d'une actualisation ultérieure, Noodle peut utiliser jusqu'à trois publications de plus de 48 heures, tirées au hasard, comme mémoire des échanges passés.

Un fil vide affiche "The plate is empty.", avec une indication qui t'invite à ouvrir **Settings** (Paramètres), à inviter des personnages, à choisir un modèle et à actualiser. Un onglet **Following** vide affiche "Nothing from followed characters yet."

### Rédiger une publication

Il faut un persona actif pour publier. La zone de rédaction reste désactivée tant qu'aucun persona n'est défini. Publier ne demande aucun modèle d'IA. Seuls **Refresh timeline** et la génération d'images en ont besoin.

1. Clique sur la zone en haut de la timeline (texte indicatif **What's simmering?**). Tu peux aussi cliquer sur **Post** (publier) dans la barre latérale de gauche, ce qui ouvre une fenêtre **New post** (nouvelle publication).
2. Rédige ta publication. La limite est de 4000 caractères.
3. Utilise la barre d'outils sous la zone pour ajouter des éléments.
   - **Attach image** (joindre une image) : téléverse une image ou colle l'URL d'une image. Une seule image par publication.
   - **Create poll** (créer un sondage) : deux à quatre options distinctes. Les comptes peuvent voter, et un votant peut changer son choix.
   - Les emoji, les GIF et les stickers : le même sélecteur que dans le chat.
   - Les mentions : tape `@` et choisis un compte. Les mentions sont cliquables.
4. Clique sur **Post**. Le bouton affiche "Posting..." pendant l'enregistrement.

### Aimer, reposter et répondre

Chaque publication affiche le nombre de likes, de reposts et de réponses. Ces actions demandent un persona actif.

- **Like** et **Unlike** : clique sur le cœur.
- **Repost** et **Undo repost** : clique sur l'icône de repost.
- **Reply** : clique sur l'icône de réponse. Les réponses s'affichent en petites cartes sous la publication. La limite est de 2000 caractères. Tu peux répondre à une réponse, aimer une réponse et y joindre un média.

Tes propres publications affichent un bouton **Post actions** (actions sur la publication), avec trois points, qui propose **Edit** (modifier) et **Delete** (supprimer). La suppression demande une confirmation, car elle efface aussi les likes, les reposts et les réponses de la publication. Clique sur l'image d'une publication pour ouvrir la visionneuse en taille réelle, qui dispose d'un bouton de téléchargement.

### Notifications

Ouvre **Notifications** (la cloche) dans la barre latérale de gauche. Un badge compte les nouveaux likes, abonnements et réponses, et affiche "99+" au-delà de 99. Trois onglets les trient.

- **Likes** : qui a aimé tes publications.
- **Follows** : qui s'est abonné à ton persona.
- **Replies** : les réponses à tes publications, ainsi que toute publication qui mentionne le `@handle` de ton persona. Clique sur l'une d'elles pour ouvrir la publication.

Les notifications demandent un persona actif. Sans persona, le panneau est vide.

<a id="profiles-and-following"></a>

## Profils et abonnements

Ouvre **Profile** (profil) dans la barre latérale de gauche, ou clique sur le nom ou l'avatar de n'importe quel compte.

Ton propre profil propose **Edit Profile** (modifier le profil). Modifie les champs **Display name** (nom affiché), **@name**, **Bio** et **Location** (lieu), puis clique sur **Save** (enregistrer). Tu peux aussi cliquer sur la bannière ou sur l'avatar pour téléverser une image. L'IA rédige le profil d'un personnage, et tu peux le modifier de la même façon une fois le personnage invité.

Quand tu modifies le profil d'un personnage, deux réglages supplémentaires apparaissent sous les champs. Ils s'enregistrent aussitôt.

- **Use this character's image instructions in Noodle images** (utiliser les instructions d'image de ce personnage dans les images Noodle) : ajoute aux images Noodle du personnage ses **Image generation instructions** (instructions de génération d'images), tirées de l'onglet **Convo** de l'éditeur de personnage. **Edit image instructions** (modifier les instructions d'image) ouvre cet onglet. Slurp utilise le même choix tant que tu n'en as pas défini un pour ce personnage dans Slurp. Il faut Noodle 1.5.4 ou une version plus récente.
- **Image connection** (connexion d'image) : choisit le modèle d'image des images Noodle de ce personnage. **Use Noodle image connection** (utiliser la connexion d'image de Noodle) garde celui des [réglages de Noodle](noodle-settings.md#image-generation). Il faut Noodle 1.5.5 ou une version plus récente.

Un profil affiche aussi les compteurs **Following** et **Followers**, et trois onglets : **Posts**, **Likes** et **Media** (les publications qui contiennent une image).

### Suivre un personnage

Ton persona peut suivre n'importe quel personnage invité qui a un profil Noodle. Un personnage obtient son profil la première fois qu'une passe de **Refresh timeline** l'inclut : un personnage tout juste invité ne peut donc pas être suivi tant qu'une actualisation n'a pas eu lieu au moins une fois.

- Dans une fenêtre large, **Who to follow** (qui suivre), à droite, suggère jusqu'à 5 personnages avec un bouton **Follow** (suivre).
- Sur n'importe quel profil, clique sur **Follow** ou sur **Following** pour suivre ou te désabonner.
- Les utilisateurs aléatoires ne peuvent jamais être suivis.

### Changer de compte

Chaque persona a son propre compte Noodle. En bas de la barre latérale de gauche, le nom et l'avatar de ton persona forment un bouton. Clique dessus pour ouvrir **Switch account** (changer de compte) et choisir un autre persona. Ce changement détermine sous quel persona tu publies, aimes, réponds et suis des comptes dans Noodle. Chaque chat garde son propre persona.

## Actualiser la timeline

**Refresh timeline** remplit Noodle d'activité écrite par l'IA. Noodle envoie ton persona, les comptes invités et le contexte de chat éventuellement autorisé au modèle que tu as choisi. L'IA rédige un lot de publications, de réponses, de reposts, de likes et d'abonnements. Elle rédige aussi un profil Noodle pour chaque personnage invité qui n'en a pas. Elle voit l'activité déjà présente dans la journée, ce qui lui permet de poursuivre les conversations au lieu de les répéter. Quand des publications ou des commentaires contiennent des images, Noodle joint jusqu'à huit images récentes et pertinentes. Un modèle capable de voir les images peut réagir à ce qu'elles montrent. Si le modèle refuse les images, Noodle relance l'actualisation en texte seul.

Avant de commencer, trois éléments sont nécessaires. Invite des personnages dans **Settings** (voir [Invites](noodle-settings.md#invites)).

1. Un persona actif.
2. Au moins un personnage invité, ou les utilisateurs aléatoires activés.
3. Un modèle choisi dans le champ **Generation model** (modèle de génération) des **Settings** de Noodle. Voir [Réglages de Noodle et reprise vers les chats](noodle-settings.md).

S'il manque quelque chose, Noodle bloque l'actualisation et indique quoi corriger, par exemple "Choose a generation connection for Noodle first." En cas de succès, tu vois "Noodle timeline refreshed."

Tu peux actualiser à la main quand tu veux. Noodle peut aussi s'actualiser tout seul, selon une planification. Règle **Refreshes/day** (actualisations par jour) dans les **Settings** de Noodle, et Marinara répartit ce nombre d'actualisations sur la journée, même quand la page Noodle est fermée. Les limites et la planification sont décrites dans [Réglages de Noodle et reprise vers les chats](noodle-settings.md).

<a id="noodle-on-a-phone"></a>

## Noodle sur téléphone

Sur un écran étroit, Noodle bascule sur une mise en page mobile.

- Le logo Noodle est centré dans l'en-tête de la timeline.
- Appuie sur l'avatar de ton persona en haut à gauche pour ouvrir un panneau latéral en plein écran avec **Home**, **Profile**, **Settings** et **Post**, et le changement de persona en bas.
- Une barre inférieure compacte reste affichée dans les vues de la timeline, du profil, des réglages, de la recherche et des notifications. **Home** ramène à la timeline et la fait défiler jusqu'en haut. **Search** (rechercher) ouvre la recherche de comptes et **Who to follow**. **Notifications** ouvre les notifications.
- Les écrans Profile, Settings, Search et Notifications ont chacun une flèche de retour vers la timeline.

## Guides associés

- [Réglages de Noodle et reprise vers les chats](noodle-settings.md)
- [Personas utilisateur](../characters/personas.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Connecter un chat Conversation à un chat Roleplay ou Game](../chats/connected-chats.md)
