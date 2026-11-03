# Mode Conversation : premiers pas

Le mode Conversation est le chat de style messagerie : un ou plusieurs personnages, une barre de saisie et un historique qui défile, comme quand tu écris à un ami. Il n'a ni maître du jeu ni art de scène. Les personnages peuvent aussi t'écrire en premier, suivre des emplois du temps hebdomadaires, envoyer des selfies et jouer à des jeux de table, et ces fonctions existent seulement dans ce mode.

## Démarrer un chat Conversation

**Avant de commencer :** ajoute un compte dans **Connections** (connexions) (voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)) et aie au moins un personnage. Une persona, la fiche de personnage qui te représente, est facultative (voir [Personas utilisateur](../characters/personas.md)).

1. Dans la barre latérale des chats, ouvre l'onglet **CONVO** et clique sur **New Conversation** (nouvelle conversation). Un assistant de configuration en quatre pages s'ouvre.
2. Sur la première page, **Name & Connection** (nom et connexion), nomme le chat et choisis le compte qui écrit les réponses.
3. Sur la deuxième page, **Prompt Preset** (preset de prompt), choisis le preset pour le prompt Conversation, ou garde celui par défaut.
4. Sur la troisième page, **Persona & Characters** (persona et personnages), choisis ta persona et un ou plusieurs personnages.
5. Sur la dernière page, **Automation** (automatisation), choisis ce que les personnages font seuls (voir le tableau ci-dessous).
6. Clique sur **Start Chatting** (commencer à discuter).

Un personnage crée un chat privé. Deux personnages ou plus créent un chat de groupe, sans rien de plus à configurer. Voir [Chats de groupe](../chats/group-chats.md) pour les tours de parole.

Si ça n'a pas marché : **Start Chatting** a besoin d'un compte et d'au moins un personnage. Tu peux fermer l'assistant et tout régler plus tard dans **Chat Settings** (réglages du chat).

## Choisir les options d'automatisation

| Option | Par défaut | Ce qu'elle fait |
| --- | --- | --- |
| **Autonomous Messages** | Activé | Les personnages t'écrivent en premier quand tu es resté silencieux un moment. |
| **Generate Schedules** | Désactivé | Crée une routine hebdomadaire pour chaque personnage. Affiché seulement quand **Autonomous Messages** est activé. |
| **Commands** | Désactivé | Interrupteur principal des actions qu'un personnage fait de lui-même. |

Active **Generate Schedules**, puis choisis ton fuseau horaire dans le champ qui apparaît. Dans **Chat Settings**, le même interrupteur s'appelle **Schedules**. Les emplois du temps et les limites de check-in sont dans [Emplois du temps des personnages et messages autonomes](schedules.md).

Change-les plus tard dans **Chat Settings → Autonomous Messaging**. Si les personnages écrivent trop souvent, désactive **Autonomous Messages** là, ou règle ta présence sur **Do Not Disturb**.

<a id="choose-which-commands-a-character-can-use"></a>

## Choisir quelles Commands un personnage peut utiliser

Les Commands sont des actions que le personnage décide de faire seul. Tu ne les tapes pas. Après la configuration, ouvre **Chat Settings → Agents → Commands**. L'interrupteur principal **Commands** contrôle toutes les familles : quand il est désactivé, aucune famille ne fonctionne. Chaque famille a son propre interrupteur. Tous sont activés, sauf **Videos** que tu dois activer toi-même. Les familles qui dépendent d'un agent facultatif apparaissent seulement quand tu installes cet agent depuis **Agents → Agent Organizer**.

| Famille | Ce qu'un personnage peut faire | Besoin d'un agent |
| --- | --- | --- |
| **Schedule Updates** | Changer son statut actuel. | Non |
| **Cross-Post** | Envoyer un message dans un autre chat. | Non |
| **Memories** | Créer des souvenirs pour d'autres personnages. | Non |
| **Scenes** | Lancer une scène immersive. | Non |
| **Influence** | Influencer un chat connecté. | Non |
| **Notes** | Enregistrer des notes durables pour un chat connecté. | Non |
| **Reactions** | Réagir aux messages avec des badges emoji. | Non |
| **Selfies** | Demander un selfie généré. | Illustrator |
| **Videos** | Envoyer de courts messages vidéo. | Illustrator |
| **Music** | Jouer des chansons avec le lecteur de musique actif. | Music DJ |
| **Haptics** | Contrôler des appareils haptiques connectés. | Haptic Feedback |
| **Calls** | T'appeler. | Calls |
| **UNO** | Lancer ou accepter une partie d'UNO. | UNO |
| **Chess** | Accepter un défi d'échecs. | Chess |
| **Poker** | S'asseoir pour du Texas Hold'em. | Poker |
| **8-Ball Pool** | Lancer une partie de billard. | 8-Ball Pool |
| **Tic-Tac-Toe** | Accepter un défi de morpion. | Tic-Tac-Toe |
| **Rock-Paper-Scissors** | Accepter une partie. | Rock-Paper-Scissors |

Pour **Influence** et **Notes**, voir [Chats connectés](../chats/connected-chats.md). La dernière colonne nomme l'agent à installer depuis **Agent Organizer**.

<a id="your-presence-status"></a>

## Ton statut de présence

Ta présence est une pastille colorée dans le pied de la barre latérale. Elle est la même dans tous les chats. Clique dessus pour choisir :

| Statut | Signification |
| --- | --- |
| **Active** | Tu es en ligne. |
| **Idle** | Tu es absent. |
| **Do Not Disturb** | Arrête les messages autonomes. |
| **Invisible** | Te cache aux modèles. |

Si tu restes **Active** et ne fais rien pendant 10 minutes, Marinara passe à **Idle** et repasse à **Active** quand tu reviens. Si tu choisis toi-même un statut, ce changement automatique s'arrête jusqu'à ce que tu choisisses à nouveau **Active**. **Idle** n'arrête pas les check-ins.

À côté de la pastille se trouve la zone de statut, qui affiche "What's up?" quand elle est vide. Tape ton activité actuelle (jusqu'à 120 caractères) pour que les personnages le sachent. Les entrées récentes apparaissent sous **Recent status** pour que tu les réutilises.

<a id="react-and-get-notified"></a>

## Réagir et être notifié

Utilise **Add reaction** sur un message pour réagir avec un emoji. Les réponses suivantes peuvent voir ta réaction. Avec la commande **Reactions**, les personnages peuvent réagir à tes messages et à ceux des autres.

Quand un personnage écrit dans un chat que tu ne regardes pas, une bulle d'avatar apparaît au bord de l'écran. Clique dessus pour ouvrir ce chat, ou clique sur son X pour la fermer. Sur un téléphone, plusieurs bulles se regroupent en un seul groupe sur lequel tu peux toucher.

## Bon à savoir

Un chat Conversation n'utilise pas le **First Message** (message d'accueil) ni le **Dialogue Highlight Color** et le **Message Box Color** de la fiche du personnage. Le **Name Display Color** colore toujours le nom au-dessus de chaque message. Voir [Où tes couleurs s'affichent](../characters/colors-and-stats.md#where-your-colors-show).

## Fonctions associées

- [Selfies](selfies.md) : les personnages envoient des photos d'eux-mêmes générées.
- [Audio et appels vidéo en Conversation](calls.md)
- [Jeux de table](table-games.md) : lance une partie avec `/uno`, `/chess`, `/poker`, `/8ball`, `/tictactoe` ou `/rps`.
- [Emplois du temps des personnages et messages autonomes](schedules.md)
- [Profils du mode Conversation](profiles.md)
- [Emojis, stickers et GIF personnalisés](emoji-stickers-gifs.md)
- [Chats connectés](../chats/connected-chats.md)

## Dépannage

| Symptôme | Solution |
| --- | --- |
| Les personnages écrivent trop souvent | Désactive **Autonomous Messages**, règle **Do Not Disturb**, ou marque plus d'heures comme absent dans [Emplois du temps](schedules.md). |
| Un personnage répond à tout dans un groupe | Définis qui parle dans [Chats de groupe](../chats/group-chats.md). |
| Un personnage oublie le chat précédent | Utilise un modèle avec une fenêtre de contexte plus grande (la quantité de texte qu'il lit d'un coup), ou ajoute des faits clés dans une entrée de lorebook. |
| Un selfie ne ressemble pas au personnage | Voir [Selfies](selfies.md). |

Plus d'aide : [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).
