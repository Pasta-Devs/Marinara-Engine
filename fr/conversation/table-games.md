# Jeux de table en Conversation

Joue à UNO, aux échecs, au poker, au billard 8-Ball Pool, au morpion et à Pierre-Feuille-Ciseaux contre les personnages d'un chat Conversation. Marinara distribue les cartes ou prépare le plateau, applique chaque règle et fait raconter ses coups par chaque personnage assis, en restant dans son rôle. Un plateau en direct apparaît au-dessus du champ de message pendant que tu joues.

Chaque jeu est un package facultatif. Installe ceux que tu veux depuis **Agents → Agent Organizer**, et redémarre Marinara si le catalogue le demande. Un jeu que tu n'as pas installé n'a pas de commande slash, n'apparaît pas dans le sélecteur de jeux, et son interrupteur **Commands** reste masqué.

Règles qui s'appliquent à chaque jeu :

- Les jeux de table fonctionnent seulement en mode Conversation. Dans un chat Roleplay, tu vois un message qui dit que les jeux ne peuvent se jouer que dans les chats Conversation.
- Une seule partie peut être active par chat. Démarrer une nouvelle partie remplace la partie actuelle, même une partie finie qui affiche encore sa bannière de fin.
- Le chat a besoin d'au moins un personnage, et tu dois asseoir au moins un personnage comme bot. Les coups des bots utilisent le même modèle que les réponses normales de ton chat. Aucun compte ni clé API en plus n'est nécessaire.

## Démarrer une partie

**Avant de commencer :** installe le jeu et ouvre un chat Conversation avec au moins un personnage.

1. Tape la commande slash du jeu (une courte instruction qui commence par `/`) dans le champ de message et appuie sur <kbd>Enter</kbd>. La fenêtre de configuration du jeu s'ouvre.
2. Choisis les options (voir chaque jeu ci-dessous).
3. Clique sur **Deal** ou **Start game**.

Si ça n'a pas marché : la commande manque ou ne fait rien quand le jeu n'est pas installé ou que tu n'es pas dans un chat Conversation.

| Jeu | Commande | Joueurs |
| --- | --- | --- |
| UNO | `/uno` | Toi plus 1 à 9 personnages |
| Chess | `/chess` | Toi et un personnage |
| Poker | `/poker` | Toi plus 1 à 7 personnages |
| 8-Ball Pool | `/8ball` ou `/pool` | Toi et un personnage |
| Tic-Tac-Toe | `/tictactoe` ou `/ttt` | Toi et un personnage |
| Rock-Paper-Scissors | `/rps` | Toi et un personnage |

Autres façons de démarrer une partie :

- Tape `/games` pour choisir parmi les jeux installés.
- Dis-le dans un message normal, comme "let's play uno", "start a game of chess" ou "deal me into poker". La fenêtre de configuration s'ouvre, et ton message est quand même envoyé, donc un personnage peut réagir à ton invitation. Cela arrive seulement quand le jeu n'est pas déjà en cours.
- Un personnage peut proposer ou accepter une partie de lui-même. Sa réponse démarre alors la partie tout de suite avec les règles par défaut et sans fenêtre de configuration. S'il est occupé ou refuse, il le dit dans son rôle.
- Un personnage ne peut le faire que quand l'interrupteur **Commands** du jeu est activé (voir [Laisser les personnages lancer des parties seuls](#let-characters-start-games-on-their-own)).

## UNO

La fenêtre de configuration s'intitule **Start UNO**.

- **Players** : coche chaque personnage qui joue comme bot. Tous sont cochés par défaut. **You go first** est coché par défaut.
- **Starting hand** : cartes par joueur, de 1 à 10. La valeur par défaut est **7**.
- **Penalize missed UNO** : coché par défaut. Un joueur pris sans avoir déclaré UNO pioche 2 cartes, et **Catch!** est actif.
- **House rules**, toutes désactivées par défaut :
  - **Stacking** : empile +2/+4 sur le joueur suivant au lieu de piocher.
  - **Draw to match** : continue de piocher jusqu'à tirer une carte jouable.
  - **7-0 rule** : un 7 échange les mains avec un joueur choisi ; un 0 fait tourner toutes les mains.
  - **Jump-in** : joue une carte identique hors de ton tour.
  - **Force play** : si une carte piochée est jouable, tu dois la jouer.

**Deal** reste désactivé jusqu'à ce que tu choisisses au moins un personnage. Il affiche le nombre de joueurs, par exemple **Deal (3p)** pour toi et deux personnages.

Sur le plateau :

- Les cartes jouables se soulèvent et le reste s'assombrit. Clique sur une carte pour la jouer.
- Une carte joker ouvre "Pick a color:". Avec **7-0 rule** activé, un 7 ouvre "Swap hands with:".
- Des boutons apparaissent selon le besoin : **Draw**, **Pass**, **Call UNO!** et **Catch!**.
- Jouer ton avant-dernière carte déclare UNO pour toi.
- Une bannière indique "{winner} wins!" ou "Game over".

## Chess

La fenêtre de configuration s'intitule **Start Chess**. Choisis un **Opponent** (l'adversaire, le premier personnage par défaut). Dans un chat de groupe, les autres continuent de discuter. **Your color** est **White**, **Random** (par défaut) ou **Black**. Clique sur **Start game**.

Clique sur une de tes pièces pour la sélectionner. Les coups légaux s'affichent comme un point, et les captures comme un anneau. Jouer les Noirs retourne le plateau. Un pion sur la dernière rangée ouvre "Promote to:" (Queen, Rook, Bishop, Knight). Une bannière annonce l'échec et mat, une partie nulle avec sa raison, ou "Game over", et une bande sous le plateau liste les derniers coups.

## Poker

La fenêtre de configuration s'intitule **Start Poker**. La table accueille de 2 à 8 joueurs. À sept, le reste est grisé.

- **Players** : coche les personnages à asseoir.
- **Dealer** : **House dealer (silent)** (par défaut) distribue sans commentaire. Ou choisis un personnage pour annoncer les mains et les showdowns.
- **Starting stack** : jetons par joueur, de 100 à 1 000 000. La valeur par défaut est **1000**.
- **Small blind** : la grosse blind est le double. La valeur par défaut est **10**.
- **Blinds double every** : les mains entre deux hausses de blind. La valeur par défaut est **0**, ce qui veut dire jamais.
- **Hand limit** : la session se termine après ce nombre de mains, et celui qui a le plus de jetons gagne. La valeur par défaut est **0**, ce qui joue jusqu'à ce qu'un seul joueur ait des jetons.

À ton tour, la barre affiche **Fold**, **Check**, **Call** et **All in**. Quand tu peux miser ou relancer, une boîte de mise apparaît avec les boutons **Min**, **½ pot**, **Pot** et **All-in**. Après chaque main, un panneau **Showdown** attribue le pot, et **Next hand** distribue à nouveau. À la fin, une bannière nomme le gagnant et liste chaque tapis final.

## 8-Ball Pool

La fenêtre de configuration s'intitule **Start 8-Ball Pool**.

- **Opponent** : le personnage contre qui tu joues.
- **Announcer** : **Silent (no announcer)** par défaut, ou un personnage qui commente les coups.
- **Match length** : **Race to 1**, **Race to 3** ou **Race to 5** racks (un rack est une partie complète).
- **Who breaks first** : **You**, **Random** ou **Them**. Les racks suivants alternent la casse.

Clique sur **Start game**. À ton tour, choisis un des coups suggérés et les billes roulent avec une simulation physique. Une ligne sous la table décrit le dernier coup.

## Tic-Tac-Toe et Rock-Paper-Scissors

Dans **Tic-Tac-Toe**, choisis l'adversaire et si tu joues les **X**, les **O** ou une marque au hasard. Les X jouent en premier. Clique sur une case vide à ton tour. Les coups illégaux sont bloqués, et les victoires et les matchs nuls sont détectés pour toi.

Dans **Rock-Paper-Scissors**, choisis l'adversaire et un meilleur-des-trois, cinq ou sept manches. Choisis **Rock**, **Paper** ou **Scissors** à chaque manche. Les choix restent masqués jusqu'à ce que les deux soient faits, puis le résultat et le score se mettent à jour.

## Terminer une partie plus tôt

Chaque plateau a un bouton X.

- **UNO** : **End game**. Il demande d'abord "End this game?"
- **Chess** : **Resign**. Il demande "Resign and end this game?"
- **Poker** : **End game**. Il demande "End this poker game?" Après la fin de la session, il affiche **Close**.
- **8-Ball Pool** : **End game**. Il demande d'abord "End this pool game?" Après la fin du match, il affiche **Close**.
- **Tic-Tac-Toe** et **Rock-Paper-Scissors** : utilise le bouton de fermeture ou de fin du plateau pour effacer le match.

Terminer une partie plus tôt supprime son état et n'enregistre aucun gagnant.

<a id="let-characters-start-games-on-their-own"></a>

## Laisser les personnages lancer des parties seuls

Ouvre **Chat Settings → Agents → Commands**, ou utilise l'étape **Automation** quand tu crées le chat. L'interrupteur principal **Commands** contrôle toutes les actions lancées par les personnages, y compris les jeux de table, les selfies et les appels. Quand il est désactivé, les personnages ne lancent rien seuls.

Chaque jeu installé a son propre interrupteur, activé sauf si tu le désactives : **UNO**, **Chess**, **Poker**, **8-Ball Pool**, **Tic-Tac-Toe** et **Rock-Paper-Scissors**. Voir [Choisir quelles Commands un personnage peut utiliser](getting-started.md#choose-which-commands-a-character-can-use). Ces interrupteurs contrôlent seulement ce que font les personnages. La commande slash d'un jeu et la phrase "let's play" fonctionnent même quand son interrupteur est désactivé.

## Guides associés

- [Mode Conversation : premiers pas](getting-started.md)
- [Référence des commandes slash](../chats/slash-commands.md)
