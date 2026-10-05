# Rencontres de combat (Roleplay)

Ce guide explique les rencontres de combat en mode Roleplay. Au programme : activer l'agent **Combat**, lancer un affrontement et le jouer dans la fenêtre de rencontre. Tu verras aussi en quoi cette fonctionnalité diffère du combat de Game Mode.

Les rencontres de combat sont une option du mode Roleplay. Elles ajoutent à la scène un écran de bataille structuré, tour par tour, avec des barres de vie, la liste des ennemis et de l'équipe, et un journal de combat. Tant que tu n'actives pas l'option, tes chats de roleplay fonctionnent exactement comme avant.

## Activer l'agent Combat

Un agent est un assistant qui s'exécute automatiquement pendant la génération des messages. L'agent **Combat** ajoute la fonctionnalité de bataille à un chat de roleplay. Il est désactivé par défaut : à toi de l'activer, chat par chat.

1. Ouvre le chat auquel tu veux ajouter le combat.
2. Ouvre **Chat Settings** (réglages du chat) avec son bouton dans le chat. Il se trouve en haut à droite, sauf si tu l'as déplacé.
3. Ouvre la section **Agents**.
4. Active l'interrupteur **Enable Agents** (activer les agents) s'il ne l'est pas déjà.
5. Ajoute l'agent **Combat** au chat.

Un bouton **Encounter** (rencontre), avec une icône d'épées croisées, apparaît alors dans la rangée d'actions au-dessus de la zone de saisie. Son infobulle indique **Start Combat Encounter**. Si ce bouton reste absent, c'est que l'agent **Combat** n'est pas actif pour ce chat.

Pour tout savoir sur le panneau **Agents** et le fonctionnement des agents, consulte [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

## Lancer une rencontre

Clique sur le bouton **Encounter** pour ouvrir la fenêtre de configuration, intitulée **Configure Combat Narrative**. Elle règle le style d'écriture que l'IA emploie pendant et après l'affrontement.

Cette fenêtre contient deux groupes de style :

- **Combat Narration** : le style d'écriture utilisé pendant l'affrontement.
- **Summary Narration** : le style d'écriture du résumé écrit dans le chat à la fin de l'affrontement.

Chaque groupe propose les quatre mêmes réglages :

- Le temps : **Present Tense** ou **Past Tense**.
- La personne : **First Person**, **Second Person** ou **Third Person**.
- La narration : **Omniscient** (le narrateur sait tout) ou **Limited** (le narrateur ne sait que ce que sait un seul personnage).
- Un champ de point de vue : indique par les yeux de qui la scène est racontée. Laisse-le vide pour garder une voix de narrateur neutre.

Sous ces deux groupes se trouve le menu déroulant facultatif **Spellbook** (grimoire). Un grimoire est un lorebook particulier – un recueil enregistré de faits sur ton univers – qui liste les sorts et les capacités disponibles pendant l'affrontement. Attaches-en un pour que l'IA sache ce que tes personnages peuvent lancer. Laisse le réglage sur **None** si tu n'utilises pas de grimoires.

Quand tout est prêt, clique sur **Begin Combat**. Clique sur **Cancel** pour fermer la configuration sans lancer d'affrontement.

Après un clic sur **Begin Combat**, l'application affiche "Initializing combat encounter..." pendant que l'IA construit l'affrontement. Elle crée les ennemis, ton équipe, leurs attaques et leurs objets. Cela prend quelques secondes.

## Mener la rencontre (la fenêtre Encounter)

L'écran de bataille complet, la fenêtre **Combat Encounter**, se compose des parties suivantes :

- **Enemies** (ennemis) : une grille de cartes d'ennemis. Chaque carte affiche une barre de vie et les effets d'état en cours.
- **Party** (équipe) : ton camp. Ton propre personnage porte la mention **(You)**.
- **Combat Log** (journal de combat) : le compte rendu de ce qui se passe à chaque tour.
- **Your Actions** (tes actions) : les boutons dont tu te sers pendant ton tour.

Sous **Your Actions**, tu peux :

- Choisir l'une de tes **Attacks** (attaques).
- Utiliser l'un de tes **Items** (objets).
- Saisir une action libre dans le champ **Custom Action** (action personnalisée), puis l'envoyer. Sers-t'en pour tout ce que les boutons ne couvrent pas, par exemple "I kick sand into the guard's eyes".

Quand une attaque ou un objet réclame une cible, la fenêtre **Select Target** (choisir une cible) s'ouvre. Choisis un seul ennemi ou allié, ou bien **All Enemies** pour une attaque de zone qui touche tous les ennemis d'un coup. Certaines actions ne visent que des zones et sautent le choix d'une cible unique.

Pendant que l'IA calcule un tour, l'écran affiche "Processing action..." et tes boutons restent verrouillés. Ils se débloquent à la fin du tour.

Si l'IA renvoie des données illisibles pour l'application, un écran **Combat Error** s'affiche au lieu d'une application cassée. Clique sur **Close Encounter** dans cet écran pour quitter l'affrontement sans casse.

## Terminer une rencontre

Il existe deux façons d'interrompre un affrontement, en plus de la fin naturelle quand un camp l'emporte.

- Clique sur **Conclude** dans la barre supérieure pour arrêter l'affrontement en cours de route. Une fenêtre de confirmation s'affiche d'abord. L'application écrit ensuite un résumé de combat dans le chat.
- Clique sur le bouton **X** de la barre supérieure pour fermer l'affrontement et l'abandonner. Une fenêtre de confirmation intitulée **End Combat** s'affiche d'abord. Aucun résumé n'est écrit.

Quand un affrontement se termine naturellement, une bannière de résultat apparaît : **VICTORY**, **DEFEAT**, **FLED** ou **INTERRUPTED**. L'application écrit alors un message de résumé de combat dans ton chat, dans le style **Summary Narration** que tu as choisi. Une fois le résumé prêt, clique sur **Close Combat Window** pour revenir à ta scène.

Si le résumé ne se génère pas, le bouton affiche **Close Anyway** à la place. Clique dessus pour revenir à ta scène sans résumé.

## Les différences avec le combat de Game Mode

Les rencontres de combat forment une couche de combat légère et distincte, réservée au mode Roleplay. Game Mode possède son propre système de combat intégré.

Les différences principales :

- En roleplay, c'est toi qui lances une rencontre avec le bouton **Encounter**. Dans Game Mode, c'est le Game Master (le maître du jeu) piloté par l'IA qui déclenche le combat quand l'histoire l'exige.
- Le combat en roleplay exige l'agent **Combat** activé. Le combat de Game Mode n'utilise pas l'agent **Combat** et fonctionne sans lui.
- Les deux systèmes emploient des écrans de bataille différents, sans rien partager.

Pour le système de bataille de Game Mode, consulte [Le combat en Game Mode](../game/combat.md).

## Guides associés

- [Mode Roleplay : premiers pas](getting-started.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Le combat en Game Mode](../game/combat.md)
