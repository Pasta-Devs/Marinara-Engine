# Rencontres de combat (Roleplay)

Une rencontre de combat ajoute à une scène Roleplay un écran de bataille tour par tour, avec des barres de vie, la liste des ennemis et de l'équipe, et un journal de combat. Elle est facultative. Un chat sans elle fonctionne comme avant. Game Mode a son propre combat, distinct : voir [Le combat en Game Mode](../game/combat.md).

## Activer le combat

Un agent est un assistant qui travaille en parallèle des réponses. L'agent **Combat** ajoute la fonctionnalité de bataille. Il est désactivé par défaut : tu l'actives donc chat par chat.

1. Ouvre le chat. Ouvre **Chat Settings** (réglages du chat) avec le bouton de curseurs dans le chat.
2. Va dans **Agents**.
3. Active **Enable Agents** (activer les agents) s'il est désactivé.
4. Ajoute l'agent **Combat** depuis les listes sous l'interrupteur.

Un bouton **Encounter** (rencontre) apparaît alors au-dessus de la zone de saisie, avec une icône d'épées croisées. Son infobulle indique **Start Combat Encounter**.

Si ça n'a pas marché : sans ce bouton, l'agent **Combat** n'est pas actif dans ce chat. Pour le fonctionnement des agents, voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

## Lancer une rencontre

1. Clique sur **Encounter**. La fenêtre **Configure Combat Narrative** s'ouvre. Elle règle le style d'écriture que l'IA emploie.
2. Choisis le style de **Combat Narration** (pendant l'affrontement) et de **Summary Narration** (le résumé écrit dans le chat à la fin). Les deux groupes ont les quatre mêmes réglages, listés ci-dessous. Les valeurs par défaut conviennent : tu peux donc cliquer tout de suite sur **Begin Combat** (commencer le combat).
3. Facultatif : choisis un **Spellbook** (grimoire). Un grimoire est un lorebook (un recueil enregistré de faits sur ton univers) qui liste les sorts et les capacités disponibles pendant l'affrontement. Laisse le réglage sur **None** (aucun) si tu n'en utilises pas.
4. Clique sur **Begin Combat**. Clique sur **Cancel** (annuler) pour fermer la fenêtre sans affrontement.

Tu vois "Initializing combat encounter..." pendant que l'IA construit les ennemis, ton équipe, ainsi que leurs attaques et leurs objets. Cela peut prendre quelques secondes.

| Réglage de style | Choix |
| --- | --- |
| Temps | **Present Tense**, **Past Tense** |
| Personne | **First Person**, **Second Person**, **Third Person** |
| Narration | **Omniscient** : le narrateur sait tout. **Limited** : il sait ce que sait un seul personnage. |
| Point de vue | Un champ de texte pour indiquer par les yeux de qui la scène est racontée. Laisse-le vide pour un narrateur neutre. |

## Jouer ton tour

L'écran **Combat Encounter** comporte quatre parties :

- **Enemies** (ennemis) : des cartes avec une barre de vie et les effets d'état.
- **Party** (équipe) : ton camp. Ton propre personnage porte la mention **(You)**.
- **Combat Log** (journal de combat) : le compte rendu de chaque tour.
- **Your Actions** (tes actions) : tes boutons.

Pendant ton tour, choisis une attaque sous **Attacks** (attaques), utilise un objet sous **Items** (objets), ou saisis une action libre dans **Custom Action** (action personnalisée) et envoie-la, par exemple "I kick sand into the guard's eyes".

Quand une action a besoin d'une cible, la fenêtre **Select Target** (choisir une cible) s'ouvre. Choisis un ennemi ou un allié, ou **All Enemies** (tous les ennemis) pour une attaque de zone. Les actions qui ne visent qu'une zone sautent cette étape.

Pendant que l'IA calcule le tour, tu vois "Processing action..." et tes boutons sont verrouillés. Ils se déverrouillent à la fin du tour.

Si ça n'a pas marché : si l'IA renvoie des données que l'application ne peut pas lire, un écran **Combat Error** s'affiche. Clique sur **Close Encounter** (fermer la rencontre) pour quitter l'affrontement sans risque, puis lances-en un nouveau.

## Terminer une rencontre

- Le bouton **Conclude** (conclure), dans la barre supérieure, met fin à l'affrontement avant son terme. Une fenêtre demande confirmation, puis un résumé de combat est écrit dans le chat.
- Le **X** de la barre supérieure ferme et abandonne l'affrontement, après une fenêtre de confirmation intitulée **End Combat**. Aucun résumé n'est écrit.
- Quand un camp l'emporte, une bannière affiche **VICTORY**, **DEFEAT**, **FLED** ou **INTERRUPTED**. Un résumé est écrit dans le chat dans ton style **Summary Narration**. Quand il est prêt, clique sur **Close Combat Window** (fermer la fenêtre de combat).

Si le résumé échoue, le bouton affiche **Close Anyway** (fermer quand même). Clique dessus pour revenir à la scène sans résumé.

## Les différences avec le combat de Game Mode

- En Roleplay, c'est toi qui lances une rencontre avec **Encounter**. En Game Mode, c'est le Game Master (le maître du jeu) qui déclenche le combat quand l'histoire l'exige.
- Le combat en Roleplay a besoin de l'agent **Combat**. Le combat de Game Mode, non.
- Les deux systèmes utilisent des écrans de bataille différents.

## Guides associés

- [Mode Roleplay : premiers pas](getting-started.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Le combat en Game Mode](../game/combat.md)
