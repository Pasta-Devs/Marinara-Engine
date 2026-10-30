# Les jeux de table en mode Conversation

Dans ce guide, tu découvres les six packs de jeux de table facultatifs auxquels tu peux jouer contre les personnages d'un chat en mode Conversation : **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** et **Rock-Paper-Scissors**. Au programme : comment lancer une partie et à quoi sert chaque option de configuration. Tu verras aussi comment jouer sur chaque plateau de jeu et comment laisser les personnages lancer des parties d'eux-mêmes.

## Les jeux de table, c'est quoi

Les jeux de table sont de petits jeux de société qui se déroulent directement dans un chat en mode Conversation. Marinara Engine distribue les cartes ou installe le plateau de jeu, et applique toutes les règles à ta place. Chaque personnage assis à la table commente ses propres coups, en restant dans son rôle. Un plateau de jeu vivant s'affiche au-dessus de la zone de saisie pendant la partie.

Installe chaque jeu qui t'intéresse depuis **Agents → Agent Organizer (organisateur d’agents)** . Il devient utilisable tout de suite, sans redémarrer Marinara. Un jeu non installé n'apparaît pas dans le sélecteur de jeux, sa commande slash reste indisponible et son réglage de commande de personnage reste masqué.

Deux points à garder en tête :

- Les jeux de table fonctionnent uniquement en mode Conversation. Impossible d'en lancer un dans un chat en mode Roleplay ou Game Mode. Si tu tapes une commande de jeu dans un chat Roleplay, un message du type "UNO can only be played in conversation chats." s'affiche.
- Un seul jeu peut être actif à la fois dans un chat. Lancer une nouvelle partie remplace celle qui tourne déjà dans ce chat, même une partie terminée qui affiche encore sa bannière de fin.

Il faut aussi au moins un personnage dans le chat. Tu dois en asseoir au moins un à la table comme bot avant de pouvoir distribuer ou démarrer. Les coups des bots et leurs répliques en personnage passent par la même connexion que les réponses habituelles du chat. Aucun compte ni clé API supplémentaire n'est nécessaire. Une **clé API** est un code secret, un peu comme un mot de passe, qui permet à Marinara de dialoguer avec un fournisseur d'IA.

## Lancer une partie

Il existe trois façons de lancer une partie. Toutes les trois fonctionnent uniquement dans un chat en mode Conversation comportant au moins un personnage.

### Taper une commande slash

Une **commande slash** est une courte instruction que tu tapes dans la zone de saisie et qui commence par une barre oblique. Tape l'une de ces commandes, puis appuie sur Enter pour ouvrir la fenêtre de configuration du jeu :

- **/uno** lance une partie d'UNO avec les personnages de ce chat.
- **/chess** lance une partie d'échecs en tête-à-tête avec un personnage de ce chat.
- **/poker** lance une partie de poker Texas Hold'em avec les personnages de ce chat.
- **/8ball** (ou **/pool**) lance une partie de billard 8-ball en tête-à-tête avec un personnage de ce chat.
- **/tictactoe** (ou **/ttt**) lance une partie de morpion en tête-à-tête avec un personnage de ce chat.
- **/rps** lance un match de pierre-papier-ciseaux en tête-à-tête avec un personnage de ce chat.

### Le demander dans le chat

Autre option : demander dans un message normal. Un message comme "let's play uno", "start a game of chess" ou "deal me into poker" ouvre automatiquement la fenêtre de configuration du jeu correspondant. Le message part quand même normalement, donc un personnage peut réagir à ton invitation dans la même réponse. Cela ne se produit que si ce jeu n'est pas déjà en cours dans le chat.

### Laisser un personnage t'inviter

Un personnage peut proposer une partie (ou accepter la tienne) de lui-même. Quand un personnage a envie de jouer sur le moment, sa réponse démarre la partie immédiatement, avec les règles par défaut du chat. Aucune fenêtre de configuration ne s'ouvre. S'il est occupé ou n'a pas envie de jouer, il te le dit simplement, en restant dans son rôle.

Pour que cela marche, le réglage **Commands** (commandes) du chat doit être activé, et l'interrupteur propre à ce jeu aussi. Voir "Laisser les personnages lancer des parties d'eux-mêmes" plus bas.

## UNO

### Configurer UNO

La fenêtre de configuration s'intitule **Start UNO** (lancer UNO).

Dans la section **Players** (joueurs), coche chaque personnage que tu veux voir jouer comme bot. Tous les personnages du chat sont cochés par défaut. La case **You go first** est cochée par défaut et te donne le premier tour. Si le chat n'a aucun personnage, la section affiche "Add at least one character to this chat to play."

La section **House rules** (règles de la maison) regroupe les règles facultatives. Elles sont toutes désactivées par défaut. Active celles qui te plaisent :

| Règle | Effet |
|---|---|
| **Stacking** | Empiler les +2/+4 sur le joueur suivant au lieu de piocher. |
| **Draw to match** | Piocher jusqu'à tomber sur une carte jouable. |
| **7-0 rule** | Le 7 échange la main avec un joueur choisi ; le 0 fait tourner toutes les mains. |
| **Jump-in** | Poser une carte identique hors de son tour. |
| **Force play** | Si la carte piochée est jouable, tu dois la jouer. |

Sous les règles, le champ **Starting hand** définit le nombre de cartes distribuées à chaque joueur au départ. La valeur par défaut est **7**, et tu peux choisir n'importe quelle valeur entre 1 et 10. La case **Penalize missed UNO** est cochée par défaut. Quand elle est active, un joueur pris à ne pas annoncer UNO pioche 2 cartes, et le mécanisme "Catch!" fonctionne. Quand elle est désactivée, il n'y a aucune pénalité.

Clique sur **Cancel** pour fermer la fenêtre, ou sur **Deal** pour démarrer. Le bouton Deal indique le nombre total de places, par exemple **Deal (3p)** pour toi plus deux bots. Il reste désactivé tant qu'aucun personnage n'est sélectionné. UNO accueille de 2 à 10 joueurs au total.

### Jouer sur le plateau de jeu UNO

Le plateau de jeu s'affiche au-dessus de la zone de saisie, sous le titre **UNO**. Il montre la couleur active et une flèche de sens qui s'inverse sur une carte Reverse. Il affiche aussi le nombre de cartes de la pioche sous la forme "Draw pile: N", plus un badge "+N" quand une pénalité de pioche s'accumule. La ligne de tour indique "Your turn" quand c'est à toi, sinon le nom du personnage.

Les places sont listées dans l'ordre de jeu. La tienne porte la mention "(you)", celle qui joue ensuite porte "next", et toute place descendue à une seule carte affiche "UNO?". Si un adversaire arrive à une carte sans annoncer UNO, un bouton **Catch!** te permet de le dénoncer. Il n'apparaît que si la règle **Penalize missed UNO** est active.

Ta main s'affiche sous forme de cartes cliquables. Les cartes jouables se soulèvent et ressortent ; les autres s'estompent. Cliquer sur une carte joker ouvre un sélecteur "Pick a color:". Avec la règle **7-0 rule** active, cliquer sur un 7 ouvre un sélecteur "Swap hands with:". D'autres boutons apparaissent au besoin, comme **Draw**, **Pass** et un **Call UNO!** mis en évidence quand tu dois annoncer. Poser ton avant-dernière carte annonce UNO pour toi dans la foulée : un bot ne peut donc pas te prendre en défaut à cet instant.

À la fin de la partie, une bannière affiche "{winner} wins!", ou "Game over" s'il n'y a pas de vainqueur net.

## Chess

### Configurer Chess

La fenêtre de configuration s'intitule **Start Chess** (lancer les échecs). Les échecs se jouent toujours en tête-à-tête : il y a donc exactement deux places.

Dans la section **Opponent** (adversaire), choisis un seul personnage à l'aide des boutons radio. Le premier personnage est sélectionné par défaut. Même dans un chat de groupe, un seul personnage prend place face à toi. Les autres continuent à discuter normalement.

Dans la section **Your color** (ta couleur), choisis **White**, **Random** ou **Black**. **Random** est la valeur par défaut. Une note précise "White moves first."

Clique sur **Cancel** pour fermer la fenêtre, ou sur **Start game** pour commencer.

### Jouer sur le plateau de jeu Chess

Le plateau de jeu s'affiche sous le titre **Chess**, avec une grille 8x8 et des pièces dessinées à la main. La pastille de chaque camp montre les pièces adverses capturées et une avance matérielle "+N". La ligne de tour indique "Your turn" quand c'est à toi, ou le nom du personnage quand c'est à lui. Elle ajoute un avertissement d'échec quand tu es en échec.

Clique sur une de tes pièces pour la sélectionner. Les coups légaux apparaissent sous forme de point sur les cases vides et d'anneau sur les prises. Le dernier coup et tout échec sont mis en évidence, et les bords sont annotés avec les rangées et les colonnes. Quand tu joues les noirs, le plateau de jeu pivote pour que ton camp soit en bas. Un pion qui atteint la dernière rangée ouvre un sélecteur "Promote to:" avec Queen, Rook, Bishop et Knight.

À la fin de la partie, une bannière annonce le vainqueur par échec et mat, une nulle avec son motif (pat ou règle des cinquante coups, par exemple), ou "Game over". Sous le plateau de jeu, un bandeau d'historique liste les coups récents en notation standard.

## Poker

### Configurer Poker

La fenêtre de configuration s'intitule **Start Poker** (lancer le poker). La table accueille de 2 à 8 joueurs, soit toi plus sept personnages au maximum.

Dans la section **Players**, coche les personnages que tu veux asseoir à la table. Une fois sept cases cochées, les autres se grisent. Une note précise "8 seats max (you + up to 7 characters)."

La section **Dealer** (donneur) est un menu déroulant. La valeur par défaut est **House dealer (silent)** : la distribution se fait sans commentaire. Autre possibilité : choisir n'importe quel personnage pour annoncer les mains, les flops et les abattages avec sa propre voix. Les cartes sont distribuées équitablement dans les deux cas, et le donneur n'a pas besoin d'être assis à la table.

La section **Stakes** (mises) contient quatre champs numériques :

| Réglage | Par défaut | Notes |
|---|---|---|
| **Starting stack** | **1000** | Jetons attribués à chaque joueur au départ (100 à 1 000 000). |
| **Small blind** | **10** | La grosse blind vaut toujours le double. |
| **Blinds double every** | **0** | Nombre de mains entre deux hausses de blinds. 0 signifie jamais. |
| **Hand limit** | **0** | 0 signifie jouer jusqu'à ce qu'un seul joueur ait des jetons. |

Quand tu définis un **Hand limit**, la session s'arrête après ce nombre de mains et le joueur qui a le plus de jetons l'emporte.

Clique sur **Cancel** pour fermer la fenêtre, ou sur **Deal** pour démarrer. Le bouton Deal indique le nombre de places, par exemple **Deal (4p)**.

### Jouer sur le plateau de jeu Poker

L'en-tête du plateau de jeu affiche la main en cours, le tour d'enchères et les blinds, ainsi que le pot total. La ligne de tour indique "Your turn" ou le nom du personnage qui doit parler. Cinq emplacements de cartes communes se placent au-dessus des joueurs.

Chaque place affiche le nom du joueur, "(you)" pour la tienne, un badge "D" pour le bouton de donneur, et "SB" ou "BB" pour les blinds. Elle montre aussi le nombre de jetons et le statut : mise en cours, "folded", "all in" ou "busted". Tes deux cartes privatives apparaissent en plus grand sous "Your hand". Une étiquette en langage courant s'affiche dès que tu as une combinaison, par exemple "Full house, kings over nines".

À ton tour, une barre d'actions te propose **Fold**, **Check**, **Call** et un **All in** mis en évidence. Quand tu peux miser ou relancer, une zone de mise apparaît avec les boutons rapides **Min**, **½ pot**, **Pot** et **All-in**, plus un bouton de validation.

À la fin de chaque main, un panneau **Showdown** révèle les combinaisons et attribue le pot. Un bouton **Next hand** distribue la manche suivante. Quand la session entière se termine, une bannière désigne le vainqueur et liste le solde final de jetons de chaque place.

## 8-Ball Pool

### Configurer 8-Ball Pool

La fenêtre de configuration s'intitule **Start 8-Ball Pool** (lancer le billard 8-ball). Le billard se joue en tête-à-tête : tu affrontes donc un seul personnage.

- **Opponent** : choisis le personnage que tu affrontes.
- **Announcer** (commentateur) : facultatif. La valeur par défaut est **Silent (no announcer)**. Choisis un personnage pour commenter les coups avec sa propre voix.
- **Match length** (durée du match) : **Race to 1**, **Race to 3** ou **Race to 5**. C'est le nombre de racks à gagner pour remporter le match. Un rack correspond à une partie de billard complète.
- **Who breaks first** (qui casse en premier) : **You**, **Random** ou **Them**. Une note précise "Later racks alternate the break."

Clique sur **Start game** pour commencer. Le bouton affiche "Racking up..." pendant la mise en place de la table.

### Jouer sur le plateau de jeu 8-Ball Pool

Le plateau de jeu montre un billard vu de dessus, avec la position réelle de chaque bille. À ton tour, la ligne de tour indique "Your turn". Au tour du personnage, elle affiche son nom suivi de "is thinking...". Tu joues en choisissant l'un des coups proposés, puis les billes roulent sur le tapis grâce à une simulation physique. Une ligne sous le billard décrit le dernier coup, ou affiche "Rack over." entre deux racks.

## Tic-Tac-Toe

Le morpion se joue en tête-à-tête. La configuration sert à choisir l'adversaire et à décider si tu joues les **X**, les **O** ou une marque aléatoire. Les X commencent. Pendant ton tour, clique sur une case vide. Marinara bloque les coups illégaux, demande son coup au personnage en le gardant dans son rôle, et détecte automatiquement les victoires et les parties nulles.

## Rock-Paper-Scissors

Le pierre-papier-ciseaux se joue en tête-à-tête. La configuration sert à choisir l'adversaire et un match en deux, trois ou quatre manches gagnantes. À chaque tour, choisis **Rock**, **Paper** ou **Scissors**. Le choix de l'adversaire reste caché jusqu'à ce que les deux choix soient prêts, puis Marinara révèle le résultat et met à jour le score du match.

## Terminer une partie

Chaque plateau de jeu possède un bouton pour arrêter la partie en cours de route, signalé par une icône en forme de X.

- Sur le plateau de jeu UNO, il s'appelle **End game** et demande d'abord "End this game?".
- Sur le plateau de jeu Chess, il s'appelle **Resign** et demande d'abord "Resign and end this game?".
- Sur le plateau de jeu Poker, il s'appelle **End game** tant qu'une main est en cours et demande d'abord "End this poker game?". Une fois la session entièrement terminée, il devient **Close** et ne demande plus de confirmation.
- Sur le plateau de jeu 8-Ball Pool, il s'appelle **End game** et demande d'abord "End this pool game?". Une fois le match terminé, il devient **Close** et ne demande plus de confirmation.
- Sur Tic-Tac-Toe et Rock-Paper-Scissors, utilise le bouton de fermeture ou d'arrêt du plateau de jeu pour effacer le match en cours.

Arrêter une partie supprime son état. Aucun vainqueur n'est enregistré quand tu interromps une partie de cette façon.

## Laisser les personnages lancer des parties d'eux-mêmes

Tu décides si un personnage peut proposer ou accepter une partie dans **Chat Settings → Agents** (réglages du chat), dans les contrôles **Commands**. Ces options se règlent aussi pendant l'assistant de configuration d'un nouveau chat, à son étape **Automation** (automatisation).

L'interrupteur principal **Commands** est activé par défaut. Il pilote toutes les commandes lancées par les personnages : les jeux de table, mais aussi les selfies, les souvenirs et les appels. Le désactiver empêche les personnages de lancer quoi que ce soit d'eux-mêmes.

Sous Commands, chaque jeu installé a son propre interrupteur, et les six sont activés par défaut :

- **UNO** : "Let characters start a game of UNO at the table when you agree to play."
- **Chess** : "Let characters accept a one-on-one chess challenge at the table."
- **Poker** : "Let characters sit down for a game of Texas Hold'em poker at the table."
- **8-Ball Pool** : "Let characters rack up a game of 8-ball pool at the table."
- **Tic-Tac-Toe** : "Let characters accept a one-on-one tic-tac-toe challenge at the table."
- **Rock-Paper-Scissors** : "Let characters accept a one-on-one rock-paper-scissors match at the table."

Ces interrupteurs ne concernent que les parties lancées par les personnages. La commande slash d'un jeu installé et la phrase "let's play" tapée dans le chat continuent de fonctionner même si son interrupteur de personnage est désactivé.

## Guides associés

- [Mode Conversation : premiers pas](getting-started.md)
- [Référence des commandes slash](../chats/slash-commands.md)
