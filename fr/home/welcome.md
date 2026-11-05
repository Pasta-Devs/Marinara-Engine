# Démarrer avec Marinara Engine

Marinara Engine est une application pour discuter et faire du roleplay avec des personnages IA. Elle tourne sur ton propre ordinateur. Ce guide présente l'écran d'accueil et les étapes jusqu'à ton premier chat.

## Lancer ton premier chat

Avant de commencer : il te faut une clé API (un code secret, un peu comme un mot de passe) d'un service d'IA, ou le **Built-in model** (modèle intégré) décrit plus bas.

1. Installe Marinara Engine et ouvre l'application dans ton navigateur. Choisis ta plateforme dans [Installation de Marinara Engine](../INSTALLATION.md).
2. Ajoute un compte. Un compte, c'est une clé API pour un service d'IA. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).
3. Choisis les modèles que le compte doit utiliser. Le même guide explique comment.
4. Crée ou importe un personnage. Ouvre le panneau **Characters** (personnages), puis clique sur **New** (nouveau) pour ouvrir la fenêtre **Create Character** (créer un personnage), ou sur **Import** (importer) pour récupérer une fiche depuis un fichier. Voir [Créer et modifier des personnages](../characters/creating-and-editing-characters.md).
5. Ouvre la barre latérale des chats avec le bouton de barre latérale. Ses onglets s'appellent **CONVO**, **RP** et **GM**. Choisis-en un, puis clique sur le bouton **+**. Il s'appelle **New Conversation**, **New Roleplay** ou **New Game**, selon l'onglet.
6. Suis la fenêtre de configuration qui s'ouvre, puis clique sur **Create Chat** (créer le chat).

Ce que tu vois : le nouveau chat s'ouvre, et tu peux écrire ton premier message.

Si tu n'as encore aucun compte, la fenêtre d'ajout de compte s'ouvre d'abord et se termine par **Start chatting** (commencer à discuter). Si une fenêtre **Set Up** (configurer) te demande de choisir un compte, choisis-en un dans la liste, puis clique sur **Create Chat**.

Marinara n'inclut pas d'IA en ligne. La plupart des gens se connectent à un service en ligne. Tu peux aussi télécharger le **Built-in model**, un petit modèle qui tourne sur ton ordinateur sans clé API. Il convient aux petites tâches d'assistance, pas à ton chat principal. Voir [Configuration du modèle intégré](../connections/local-model.md).

À la première ouverture de Marinara, une courte visite guidée démarre. Voir [Le tutoriel de première ouverture](tutorial.md). Tu bloques sur une étape ? Demande à Professor Mari, l'assistante intégrée : [Professor Mari, ton assistante intégrée](professor-mari.md).

## L'écran d'accueil en un coup d'œil

L'écran d'accueil s'affiche quand aucun chat n'est ouvert. Il ressemble à un navigateur web : des onglets et des marque-pages en haut, des widgets en dessous.

- **Onglets.** **Home** (accueil) est la page principale. **Professor** ouvre Professor Mari. Certains agents installés ajoutent leur propre onglet.
- **Barre de recherche.** Sur ordinateur, clique sur la barre sous les onglets, ou appuie sur <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> sur un Mac), pour trouver des chats, des personnages, des réglages et plus encore. Les téléphones, les tablettes et les fenêtres étroites n'affichent pas cette barre.
- **Marque-pages.** Des liens rapides vers **Discord**, **Support**, **Credits**, **Documentation**, **Tutorial**, **FAQ**, **Achievements** (succès) et **Widgets**. **Achievements** n'apparaît que si le réglage Achievements est activé. Les marque-pages ne s'affichent que sur l'onglet **Home**. Sur un téléphone, une tablette ou une fenêtre étroite, touche le bouton des marque-pages, **Open bookmarks** (ouvrir les marque-pages), à gauche des onglets pour les voir sous forme de liste.

Au milieu, tu vois le logo, la mention **Marinara Engine** et le numéro de version. En dessous, les boutons **Conversation**, **Roleplay** et **Game** lancent chacun un nouveau chat dans ce mode.

<a id="choose-a-chat-mode"></a>

## Choisir un mode de chat

Tu choisis un mode quand tu lances un chat.

- **Conversation** : un simple chat avec l'IA, présenté comme une messagerie. Voir [Mode Conversation : premiers pas](../conversation/getting-started.md).
- **Roleplay** : une histoire avec un ou plusieurs personnages. L'application suit la scène, comme le lieu et l'heure. Voir [Mode Roleplay : premiers pas](../roleplay/getting-started.md).
- **Game** : un jeu solo. L'IA joue le Game Master (le maître du jeu), qui raconte l'histoire. Tu as des compagnons de route (ton équipe), des jets de dés, des cartes et des quêtes. Voir [Game Mode : premiers pas](../game/getting-started.md).

<a id="home-widgets"></a>

## Les widgets de l'accueil

Les widgets sont de petites cartes que tu peux afficher, masquer et déplacer.

1. Clique sur **Widgets** dans les marque-pages. La fenêtre **Home Widgets** (widgets de l'accueil) s'ouvre. Elle liste les widgets sous **Built-in** (intégrés), **Agents** et **Personal** (personnels).
2. Clique sur le bouton en forme d'œil à côté d'un widget pour l'afficher ou le masquer. Un widget que tu affiches de nouveau prend la première place libre de l'accueil.
3. Pour déplacer un widget, fais glisser la poignée dans son coin supérieur droit. Sur ordinateur, la poignée apparaît quand tu pointes sur le widget.

Ta disposition est enregistrée dans ce navigateur. Les widgets personnels ont aussi des boutons pour les modifier ou les supprimer. En bas de la fenêtre, **Browser chrome** (habillage du navigateur) propose un seul interrupteur : **Show URL bar** (afficher la barre d'URL) affiche ou masque la barre de recherche sur ordinateur.

Professor Mari peut te créer un widget personnel si tu le lui demandes. Les agents installés peuvent aussi ajouter des widgets.

## Référence : les widgets intégrés

| Widget | Ce qu'il fait | Affiché au départ |
| --- | --- | --- |
| **Professor Mari** | **Ask Professor Mari** (demander à Professor Mari) ouvre son chat. | Oui |
| **Recent chats** (chats récents) | Tes derniers chats. Clique sur l'un d'eux pour le rouvrir. Quand il est vide : **Your chats will show here**. | Oui |
| **Learn the engine** (découvrir l'application) | Des liens vers **Documentation**, **Replay tutorial** (revoir le tutoriel) et **Read FAQ** (lire la FAQ). | Oui |
| **What's New** (nouveautés) | **See what's new** (voir les nouveautés) et **Read release notes** (lire les notes de version). | Oui |
| **Community** (communauté) | Des liens vers **Discord**, **Support** et **Credits**. | Oui |
| **Character Library** (bibliothèque de personnages) | Une nouvelle sélection de tes personnages chaque jour. | Non |
| **Discovery desk** (bureau des découvertes) | Les agents que tu n'as pas installés. **Browse agents** (parcourir les agents) ouvre le catalogue. | Non |
| **Character of the Day** (personnage du jour) | Un personnage de ta bibliothèque, avec **Start a chat** (lancer un chat) et **View character** (voir le personnage). | Non |
| **Clock & calendar** (horloge et calendrier) | La date et l'heure du jour. | Non |
| **Achievements** | Tes derniers succès et ceux qui sont les plus proches. Le réglage Achievements doit être activé. | Non |

## Où trouver de l'aide

- Pose tes questions à Professor Mari sur l'écran d'accueil.
- Ouvre le marque-page **FAQ** pour des réponses rapides.
- Ouvre le marque-page **Documentation** pour les guides intégrés.
- Clique sur **Discord** pour rejoindre la communauté, ou sur **Support** pour soutenir le projet.

Si quelque chose est cassé, voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Installation de Marinara Engine](../INSTALLATION.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Le tutoriel de première ouverture](tutorial.md)
- [Professor Mari, ton assistante intégrée](professor-mari.md)
