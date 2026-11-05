# Game Mode : sessions et sauvegardes

Game Mode découpe ton aventure en sessions numérotées, comme des soirées de jeu de rôle sur table. Ce guide montre comment terminer et démarrer une session, relire les sessions passées, partager ta configuration, corriger à la main les données enregistrées et revenir à un moment antérieur.

Ta première session est la **Session 1**. La terminer puis recommencer crée la **Session 2**, et ainsi de suite. Quand tu termines une session, le Game Master (GM, le maître du jeu), l'IA qui anime ta partie, rédige un résumé que tu peux relire plus tard.

## Enregistrer et continuer

Il n'y a pas de bouton de sauvegarde. Ta partie s'enregistre toute seule pendant que tu joues.

1. Pour t'arrêter pour l'instant, ferme l'onglet ou l'application.
2. Pour continuer, ouvre le même chat de jeu. Tu reprends là où tu t'étais arrêté.
3. Pour clore un chapitre, termine la session (voir [Terminer une session](#end-a-session)).

Pour revenir à un moment antérieur, voir [Comment ta partie s'enregistre](#how-your-game-saves).

<a id="opening-session"></a>

## Ouvrir Session

Dans **Session**, tu termines des sessions, en démarres de nouvelles et consultes ton historique.

1. Ouvre un chat Game Mode.
2. Clique ou appuie sur le bouton **Session** (la plume), près du coin supérieur droit du chat. Tu peux le déplacer ailleurs (voir [Fenêtres de contrôles et leurs boutons](../chats/chat-settings.md#control-windows-and-their-buttons)).
3. **Session** s'ouvre dans une fenêtre sur ordinateur ou dans un panneau sur toute la largeur sur téléphone. Sa première ligne affiche le numéro et le statut de la session en cours.
4. Il contient deux onglets : **Session History** (historique des sessions) et **Journal**. Reste sur **Session History** pour les contrôles de session.

Si tu as utilisé **Put back in Chat Settings** (remettre dans Chat Settings) pour déplacer cette fenêtre, ouvre plutôt la section **Session** dans Chat Settings.

<a id="end-a-session"></a>

## Terminer une session

Termine une session quand tu veux clore un chapitre et laisser le GM le résumer.

1. Ouvre **Session** et reste sur **Session History**.
2. Trouve en haut la session en cours, avec la mention **Session N (Current)**.
3. Sur cette ligne, clique sur le bouton **End Session** (terminer la session), la petite icône carrée. La ligne compte plusieurs petits boutons à icône : passe le pointeur dessus pour lire leurs infobulles. Une boîte de dialogue intitulée **End Session** te demande de confirmer.
4. Facultatif : écris une note dans le champ **What do you want to happen in the next session (optional)?** (jusqu'à 5 000 caractères). Laisse-le vide pour laisser le GM mener l'histoire.
5. Clique sur **End Session** dans la boîte de dialogue. Clique sur **Cancel** (annuler) pour renoncer.

Le titre de la boîte de dialogue devient **Ending Session** pendant que le GM rédige le résumé. Reste sur cet écran jusqu'à la fin. La session est alors marquée comme conclue et apparaît dans ton historique.

Si ça n'a pas marché, vérifie que ton modèle de GM est joignable. Le résumé est une requête au modèle et peut échouer comme n'importe quelle autre. Réessaie, et consulte [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Démarrer une nouvelle session

Une fois une session conclue, le même bouton de sa ligne devient **New Session** (nouvelle session).

1. Ouvre **Session** et va sur **Session History**.
2. Sur la ligne de la session en cours, clique sur **New Session** (l'icône de lecture).

Le GM reprend l'histoire à partir du dernier résumé et de la note que tu as éventuellement écrite en terminant la session. Dans une partie avec un monde généré, le monde reprend là où il en était : les jours écoulés, les exploits et la réputation de l'équipe, les lieux et les groupes ajoutés par l'histoire, et les endroits où l'équipe est allée.

## Relire les sessions passées

**Session History** liste les sessions conclues, de la plus récente à la plus ancienne. Tant que tu n'en as terminé aucune, il affiche **No completed sessions yet**. Chaque ligne indique le numéro de session, la date et le nombre de découvertes enregistrées. Clique sur une ligne pour la déplier. Ces champs peuvent apparaître :

| Champ | Ce qu'il contient |
| --- | --- |
| **Summary** | Ce qui s'est passé. |
| **Resume Point** | La manière dont la session suivante doit reprendre. |
| **Party Dynamics** | Les relations entre les membres de l'équipe. |
| **Key Discoveries** | Les faits importants, les retournements et les révélations. |
| **Character Moments** | Les moments marquants. |
| **Little Details To Recall** | Les petites habitudes, promesses ou détails. |
| **NPC Updates** | Les changements concernant les personnages non-joueurs (PNJ, les personnes que le GM contrôle). |
| **Next Session Request** | La note que tu as laissée en terminant la session. |
| **Stats Snapshot**, **Party Status** | Les valeurs enregistrées et l'état de l'équipe. |

### Rejouer une session

La relecture est en lecture seule. Elle ne sollicite pas le GM, ne crée pas de messages, ne touche ni à l'inventaire ni aux caractéristiques, ne met pas à jour le journal et ne restaure aucun point de contrôle.

1. Déplie une session conclue.
2. Clique sur **Replay Session** (rejouer la session).
3. Utilise **Next** (suivant) et **Next turn** (tour suivant) pour parcourir la narration et les dialogues d'origine.
4. À un choix, seule l'option que tu avais retenue à l'origine est active. Clique dessus pour continuer sur le chemin enregistré.
5. Clique sur le bouton de fermeture en haut, ou sur **Return to current session** (revenir à la session en cours), quand tu as fini.

Les sessions antérieures à la relecture se rejouent quand même à partir de leur texte, de leurs effets, de leurs choix et de leurs ressources enregistrés. Un tour ancien peut manquer d'un effet de scène qui n'était pas enregistré à l'époque.

### Modifier une session passée

Modifie les notes d'une session conclue pour que les sessions suivantes s'en souviennent correctement.

1. Déplie la session.
2. Clique sur **Edit Details** (modifier les détails).
3. Change n'importe quel champ, puis clique sur **Save Details** (enregistrer les détails). Clique sur **Cancel** pour abandonner tes modifications.

Deux autres boutons apparaissent sur une session dépliée :

- **Regenerate** (régénérer) relance la conclusion écrite par l'IA. Le résumé et tous les autres champs sont réécrits : les changements faits avec **Edit Details** sont donc perdus.
- **Update Plot Arcs** (mettre à jour les arcs narratifs) demande à l'IA d'actualiser les plans d'histoire secrets du GM à partir des événements de cette session. Ces plans sont **Story Arc**, **Plot Twists** et **Party Arcs** dans la vue **Show Spoilers** (afficher les spoilers).

**Regenerate Lorebook** (régénérer le lorebook) n'apparaît que sur ta dernière session conclue, et seulement si la fonctionnalité Lorebook Keeper est activée. Un lorebook est un recueil de faits sur ton univers que l'IA peut retrouver.

## Partager la configuration à l'origine d'une partie

Game Mode conserve un instantané de la configuration utilisée pour créer chaque nouvelle campagne. Joue d'abord, puis partage la combinaison si elle fonctionne bien.

1. Ouvre la campagne, puis ouvre **Session**.
2. Dans **Session History**, déplie **Initial Game Setup** (configuration initiale de la partie).
3. Passe en revue les réglages enregistrés : aventure, distribution des personnages, modèle, prompt (le texte que Marinara envoie à l'IA), paramètres de génération, visuel, storyboard et outils de monde.
4. Clique sur **Copy setup** (copier la configuration) pour copier le texte, ou sur **Download setup** (télécharger la configuration) pour enregistrer un fichier texte.

> **Avertissement :** le texte reprend tes longues préférences de joueur et tes instructions personnalisées pour le GM. Relis-le avant de le publier. Les identifiants de connexion, les URL de serveur, les clés API et les identifiants de base de données locale n'y figurent jamais.

Les fiches de personnage, les personas, les lorebooks, les modèles et les comptes sont nommés, mais pas inclus : un autre joueur a donc besoin de ses propres équivalents. Les campagnes créées avant l'arrivée des instantanés ne peuvent pas récupérer des réglages qui n'ont jamais été enregistrés : **Initial Game Setup** n'apparaît donc que lorsqu'un instantané fiable existe.

## Voir les notes secrètes du GM

**Show Spoilers** (l'icône en forme d'œil sur la ligne de la session en cours) dévoile les notes privées du GM pour la session en cours. Les lire peut gâcher des retournements de situation.

1. Ouvre **Session** et va sur **Session History**.
2. Sur la ligne de la session en cours, clique sur **Show Spoilers** (l'icône en forme d'œil).

La vue peut afficher **World Overview**, **Story Arc**, **Plot Twists**, **Party Arcs**, ainsi que les données enregistrées **Maps**, **NPCs** et **Character Cards**. Clique sur le même bouton, qui affiche désormais **Hide Spoilers** (masquer les spoilers), pour les masquer.

Pour modifier ces notes, clique sur **Edit Spoilers** (modifier les spoilers), modifie le texte, puis clique sur **Save Spoilers** (enregistrer les spoilers). Certains champs sont en JSON, un format de texte structuré. Ne les modifie que si tu connais ce format, car un JSON incorrect ne sera pas enregistré.

<a id="editing-game-data-by-hand"></a>

## Modifier les données de la partie à la main

Quand le GM se trompe, par exemple sur la réputation d'un PNJ ou sur une quête qui reste ouverte, tu peux corriger toi-même les données enregistrées.

1. Ouvre **Game controls** (contrôles du jeu) et choisis **Edit game data** (modifier les données de jeu). Sur téléphone, **Game controls** se trouve dans le menu à trois points **Chat tools** (outils du chat).
2. La fenêtre **Game Data** (données de jeu) s'ouvre. Un avertissement indique : "Hand edits can break a game. Every change is checked before it saves, and names can't change here."
3. Choisis une section dans la liste (une rangée de pastilles sur téléphone). Le champ de recherche trouve une valeur dans toutes les sections à la fois.
4. Modifie les valeurs dans **Fields** (champs), ou passe en **JSON** pour les données brutes.
5. Clique sur **Review changes** (relire les changements) pour voir exactement ce qui change, puis sur **Save changes** (enregistrer les changements).

> **Avertissement :** les modifications à la main peuvent corrompre une partie. Avant chaque enregistrement, Marinara essaie de prendre un point de contrôle marqué **Before a State Editor save** (voir [Comment ta partie s'enregistre](#how-your-game-saves)). Charge-le pour annuler une mauvaise modification. Une partie trop récente pour avoir un premier tour enregistré n'a encore rien à mettre en point de contrôle.

Si ça n'a pas marché, l'éditeur explique pourquoi et garde ton brouillon pour que tu puisses le corriger. Si la partie a modifié les mêmes données pendant que tu les modifiais, l'enregistrement est refusé pour ne pas annuler le changement de la partie. **Reload** (recharger) affiche la version de la partie et abandonne tes brouillons.

Tu peux modifier ces sections : **Party Cards**, **Party Sheet**, **NPCs**, **Journal**, **Player Notes**, **Inventory**, **Story**, **Session Summaries**, **World Edits**, **Story Script** et **HUD Widgets**. Une section n'apparaît que si la partie contient ces données : une partie sans monde n'a donc pas de **World Edits**. Des sections comme **World**, **Maps & Position**, **Time, Weather & Morale**, **Combat** et **Settings** portent la mention **Read-only** : tu peux les lire et y faire des recherches, mais c'est le jeu qui les gère. Les préférences de prompt, d'image, de musique et de dés se changent dans **Chat Settings** (réglages du chat).

Règles appliquées par les vérifications :

- Les noms ne peuvent pas changer, car les fiches, les PNJ, l'équipe et les sacs se retrouvent les uns les autres par leur nom. Il est impossible d'ajouter ou de retirer des membres de l'équipe ici.
- La réputation d'un PNJ va de -100 à 100.
- Dans **Inventory**, tu peux changer la quantité d'un objet, son surnom, la personne qui le transporte, et indiquer s'il est équipé, harmonisé ou allumé. Omets une pile pour la supprimer, ou ajoutes-en une sans identifiant pour ajouter un objet.
- Dans **Session Summaries**, seul le texte d'une session peut changer.
- **World Edits** contient tes modifications à la main par-dessus le monde, comme des lieux renommés ou des personnes ajoutées. Le monde lui-même ne change jamais.

La fenêtre fonctionne comme le State Editor de Roleplay. Voir [Le State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

<a id="how-your-game-saves"></a>

## Comment ta partie s'enregistre

Game Mode enregistre automatiquement. Ton monde, ton équipe, la carte, l'inventaire, le temps de jeu et les résumés de session sont conservés au fil de la partie, sans bouton de sauvegarde.

Marinara enregistre aussi des points de contrôle automatiques au début et à la fin d'une session, au début et à la fin d'un combat, quand tu atteins un nouveau lieu et à intervalles fixes. Il garde les cinq plus récents de chaque type et nettoie les plus anciens. L'éditeur Game Data essaie aussi d'en prendre un avant chaque enregistrement.

Pour revenir en arrière :

1. Ouvre **Game controls → Checkpoints** (contrôles du jeu → points de contrôle). Ils sont listés du plus récent au plus ancien.
2. Clique sur **Load** (charger) sur le moment voulu.

**Load** ramène la partie à ce moment-là. Le tracker, la carte, les **World Edits**, l'histoire, les fiches et les feuilles de l'équipe, les PNJ, le journal, tes notes, l'inventaire, les résumés de session, les plans du GM pour l'histoire, les widgets du HUD, le temps, la météo et le moral reviennent tous en arrière. Un message système indique où la partie a été ramenée en arrière. Tes réglages restent tels quels. **Delete** (supprimer) supprime définitivement un point de contrôle.

Pour annuler un seul mauvais tour, utilise **Retry turn** (relancer le tour) dans **Game controls**, ou passe à une autre version de la réponse avec un swipe.

Pour conserver ta propre copie de tes données, voir [Sauvegarde et restauration](../data/backup-and-restore.md).

## Guides associés

- [Game Mode : premiers pas](getting-started.md)
- [Sauvegarde et restauration](../data/backup-and-restore.md)
