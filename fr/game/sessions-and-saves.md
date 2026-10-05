# Game Mode : sessions et sauvegardes

Ce guide explique comment Marinara Engine suit ta progression en Game Mode d'une session de jeu à l'autre. Au programme : terminer une session, en démarrer une nouvelle et relire les sessions passées dans **Session History** (historique des sessions). Tu découvres aussi la vue **Show Spoilers** (afficher les spoilers) et la façon dont le jeu enregistre tes données.

## Ce qu'est une session

Game Mode découpe ton aventure en sessions numérotées. Une session, c'est une période de jeu continue, comme une soirée de jeu de rôle sur table. Le Game Master (GM, le maître du jeu), l'IA qui anime la partie, narre chaque session. Quand tu termines une session, le GM rédige un résumé que tu peux relire plus tard.

La première session porte le nom **Session 1**. Termine-la puis relance le jeu, et voilà la **Session 2**, et ainsi de suite.

<a id="opening-session"></a>

## Ouvrir Session

Dans **Session**, tu termines des sessions, en démarres de nouvelles et consultes ton historique.

1. Démarre ou ouvre un chat Game Mode pour afficher le jeu.
2. Clique ou appuie sur le bouton **Session** (la plume). Il commence près du coin supérieur droit du chat. Tu peux le déplacer ailleurs ; consulte [Fenêtres de contrôles et leurs boutons](../chats/chat-settings.md#control-windows-and-their-buttons).
3. **Session** s'ouvre dans une fenêtre sur ordinateur ou un panneau sur toute la largeur sur téléphone. Sa première ligne affiche **Session** avec le numéro et le statut actuels.
4. Il contient deux onglets : **Session History** et **Journal**. Reste sur **Session History** pour les contrôles de session et le partage de configuration.

Si tu as utilisé **Put back in Chat Settings** pour ranger cette fenêtre, ouvre la section **Session** dans Chat Settings.

## Partager la configuration à l'origine d'une partie

Game Mode conserve un instantané figé de la configuration utilisée pour créer chaque nouvelle campagne. Tu peux ainsi jouer d'abord, constater que la combinaison fonctionne bien, puis la partager après coup, sans avoir noté chaque champ à la main avant de commencer.

1. Ouvre la campagne Game Mode que tu veux partager.
2. Ouvre **Session** (le bouton avec la plume).
3. Reste sur **Session History**, puis déplie la section **Initial Game Setup** (configuration initiale de la partie).
4. Passe en revue les réglages enregistrés : aventure, distribution des personnages, modèle, prompt (le texte que Marinara envoie à l'IA), paramètres de génération effectifs, visuel, storyboard et outils de monde.
5. Clique sur **Copy setup** (copier la configuration) pour placer le texte dans le presse-papiers, ou sur **Download .txt** (télécharger le fichier .txt) pour enregistrer un fichier texte partageable.

Le texte copié reprend les longues préférences du joueur et les instructions personnalisées données au GM. Relis-le avant de le publier si ces champs contiennent des éléments privés. Les identifiants de connexion, les URL de serveur, les clés API et les identifiants de base de données locale n'y figurent jamais. Les fiches de personnage, les personas, les lorebooks, les modèles et les comptes chez les fournisseurs sont nommés à titre indicatif, mais rien n'est embarqué : un autre joueur doit donc posséder ou choisir ses propres équivalents locaux.

Les campagnes créées avant l'arrivée des instantanés de configuration ne peuvent pas récupérer des préférences qui n'ont jamais été enregistrées. La section **Initial Game Setup** apparaît donc uniquement quand un instantané de création fiable est disponible.

## Terminer une session

Termine une session quand tu veux clore le chapitre en cours et laisser le GM le résumer.

1. Ouvre **Session** et reste sur l'onglet **Session History**.
2. En haut, tu vois la session en cours, avec la mention **Session N (Current)**.
3. Sur cette ligne, clique sur le bouton **End Session** (terminer la session), la petite icône carrée à côté de **Show Spoilers**.
4. Une fenêtre intitulée **End Session** s'ouvre et te demande de confirmer.
5. Si tu le souhaites, écris dans le champ **What do you want to happen in the next session (optional)?**. Tu disposes de 5000 caractères au maximum.
6. Laisse ce champ vide pour laisser le GM mener l'histoire à sa guise.
7. Clique sur **End Session** dans la fenêtre pour confirmer, ou sur **Cancel** pour renoncer.

Une fois que tu as confirmé, le moteur génère un résumé. Reste sur cet écran jusqu'à la fin de l'opération. Pendant le travail, le titre de la fenêtre indique **Ending Session**. À la fin, la session est marquée comme conclue et rejoint ton historique.

## Démarrer une nouvelle session

Dès que la session en cours est conclue, ce même bouton devient **New Session** (nouvelle session).

1. Ouvre **Session** et va sur l'onglet **Session History**.
2. Sur la ligne de la session en cours, clique sur le bouton **New Session** (l'icône de lecture).
3. Le GM reprend l'histoire. Il s'appuie sur le résumé de la session précédente et sur la note pour la session suivante que tu as éventuellement écrite en la terminant.

## Relire les sessions passées

L'onglet **Session History** liste tes sessions conclues, de la plus récente à la plus ancienne. Tant que tu n'en as terminé aucune, il affiche "No completed sessions yet".

Chaque ligne indique le numéro de session, la date et le nombre de découvertes enregistrées. Clique sur une ligne pour la déplier. Une session dépliée peut afficher les champs suivants :

- **Summary** : ce qui s'est passé pendant la session.
- **Resume Point** : la manière dont la session suivante doit reprendre.
- **Party Dynamics** : les relations entre les membres de l'équipe.
- **Key Discoveries** : les faits importants, les retournements et les révélations.
- **Character Moments** : les moments marquants pour les personnages.
- **Little Details To Recall** : les petites habitudes, promesses ou détails.
- **NPC Updates** : les changements concernant les personnages non-joueurs (PNJ), ceux que le GM contrôle.
- **Next Session Request** : la note que tu as laissée en terminant la session.
- **Stats Snapshot** et **Party Status** : les valeurs enregistrées et l'état de l'équipe.

### Rejouer une session terminée

Les sessions terminées se rejouent sans rien changer à ta campagne.

1. Déplie une session conclue dans **Session History**.
2. Clique sur **Replay Session** (rejouer la session).
3. Utilise **Next** et **Next turn** pour parcourir la narration et les dialogues d'origine.
4. Quand la relecture arrive à un choix, seule l'option retenue lors de la session d'origine est active. Clique dessus pour continuer sur le chemin enregistré.
5. Clique sur le bouton de fermeture en haut de la relecture, ou sur **Return to current session** (revenir à la session en cours), quand tu as fini.

La relecture est en lecture seule. Elle ne sollicite pas le GM, ne crée pas de messages, ne touche ni à l'inventaire ni aux caractéristiques, ne met pas à jour le journal et ne restaure aucun point de contrôle. Les sessions créées avant la prise en charge de la relecture peuvent tout de même utiliser leur texte enregistré, leurs effets en ligne, leurs choix et les ressources disponibles. Un tour ancien peut omettre un effet de scène qui n'avait pas été enregistré au moment où il a été joué.

### Modifier une session passée

Retouche à la main les notes d'une session conclue pour que les sessions suivantes s'en souviennent correctement.

1. Déplie la session que tu veux modifier.
2. Clique sur **Edit Details** (modifier les détails).
3. Change les champs voulus, puis clique sur **Save Details** (enregistrer les détails). Clique sur **Cancel** pour abandonner tes modifications.

Deux autres boutons apparaissent sur une session dépliée :

- **Regenerate** (régénérer) : relance la conclusion écrite par l'IA pour cette session. Le résumé et tous les autres champs de l'entrée sont réécrits. Les changements apportés avec **Edit Details** sont perdus.
- **Update Plot Arcs** (mettre à jour les arcs narratifs) : demande à l'IA d'actualiser les plans d'histoire secrets du GM à partir des événements de cette session. Ces plans correspondent aux sections **Story Arc**, **Plot Twists** et **Party Arcs** de la vue **Show Spoilers**.

Un bouton **Regenerate Lorebook** (régénérer le lorebook) apparaît seulement sur ta dernière session conclue, et uniquement si la fonctionnalité facultative Lorebook Keeper est activée. Un lorebook est un recueil de faits sur ton univers que l'IA peut retrouver.

## La vue Show Spoilers

**Show Spoilers** dévoile les notes secrètes du GM pour la session en cours. Elles te sont normalement cachées pendant le jeu. Les lire peut gâcher des retournements de situation.

1. Ouvre **Session** et va sur l'onglet **Session History**.
2. Sur la ligne de la session en cours, clique sur **Show Spoilers** (l'icône en forme d'œil).
3. L'état privé du GM apparaît.

La vue des spoilers peut afficher les sections suivantes :

- **World Overview** : le décor général de l'univers.
- **Story Arc** : la direction prévue pour l'histoire.
- **Plot Twists** : les surprises que le GM garde en réserve.
- **Party Arcs** : les parcours prévus pour ton équipe.
- **Maps**, **NPCs** et **Character Cards** : les données de jeu enregistrées.

Pour masquer à nouveau ces notes, clique sur le même bouton. Il affiche désormais **Hide Spoilers**.

Autre option : modifier ces secrets, un peu comme dans un panneau de triche réservé au maître du jeu. Clique sur **Edit Spoilers** (modifier les spoilers), change le texte, puis clique sur **Save Spoilers** (enregistrer les spoilers). Certains champs s'affichent en JSON, un format de texte structuré. Ne touche aux champs JSON que si tu maîtrises ce format : un JSON incorrect ne sera pas enregistré.

## Comment ta partie s'enregistre

Game Mode enregistre ta progression automatiquement. Aucun bouton de sauvegarde à presser. Le monde, l'équipe, la carte, l'inventaire, le temps de jeu et les résumés de session sont conservés au fil de la partie.

L'application enregistre aussi des points de contrôle automatiques en coulisses. Elle en capture un au début de la session, à la fin de la session, ainsi qu'au début et à la fin d'un combat. Aucun écran de l'application ne permet pour l'instant de parcourir ou de restaurer ces points de contrôle. Ne compte donc pas sur le chargement d'un ancien point de contrôle pour annuler un tour.

Pour conserver ta propre copie de tes données, utilise les outils de sauvegarde de l'application. Voir [Sauvegarde et restauration](../data/backup-and-restore.md).

## Guides associés

- [Game Mode : premiers pas](getting-started.md)
- [Sauvegarde et restauration](../data/backup-and-restore.md)
