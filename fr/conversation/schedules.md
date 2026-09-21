# Emplois du temps des personnages et messages autonomes

Ce guide explique comment les personnages du mode Conversation t'écrivent en premier, et comment tu décides du moment où ils le font. Au programme : les messages autonomes, les emplois du temps des personnages, la commande **/status** et ton propre statut de présence. Ces fonctionnalités n'existent qu'en mode Conversation.

## À quoi servent les messages autonomes et les emplois du temps

Un message autonome, c'est un message qu'un personnage t'envoie de lui-même, sans que tu aies rien écrit. Marinara Engine (Marinara en abrégé) les envoie après un moment de silence de ta part, pour qu'un chat (une conversation enregistrée) ressemble à une vraie relation par messagerie.

Deux réglages pilotent ce comportement :

- **Autonomous Messages** (messages autonomes) détermine si les personnages ont le droit de te contacter.
- **Schedules** (emplois du temps) donne à chaque personnage une routine hebdomadaire, pour qu'il paraisse éveillé, occupé ou endormi selon l'heure.

Les emplois du temps restent facultatifs. Avec les messages autonomes activés et les emplois du temps désactivés, les personnages te contactent quand même, selon leur niveau de bavardage et ton statut. Le niveau de bavardage est un réglage propre à chaque personnage : il indique à quelle fréquence celui-ci lance une conversation de lui-même.

## Activer les messages autonomes

Tout se règle depuis le chat, pas depuis la fiche de personnage. Ces commandes se trouvent toutes dans la section **Autonomous Messaging** (messagerie autonome) des **Chat Settings** (réglages du chat).

1. Ouvre un chat en mode Conversation.
2. Ouvre les **Chat Settings** (l'icône en forme d'engrenage).
3. Repère la section **Autonomous Messaging**.
4. Active l'interrupteur **Autonomous Messages**.

Dans l'assistant de configuration d'un nouveau chat, l'option **Autonomous Messages** est activée par défaut. Désactive-la quand tu veux depuis les **Chat Settings**.

### Chat Check-In Cap

Sous l'interrupteur, le réglage **Chat Check-In Cap** (plafond de prises de nouvelles) limite le nombre de fois par jour où les personnages peuvent te contacter dans ce chat.

- L'option par défaut est **Default chat ceiling (talkativeness-based)**. La limite découle alors du niveau de bavardage de chaque personnage.
- Choisis **Numeric value** pour afficher un champ numérique et saisir le plafond entier positif de ton choix. Attention : un plafond élevé peut entraîner beaucoup de requêtes au modèle et beaucoup de notifications.

Ce plafond vaut pour le chat entier. La limite propre à un personnage, définie dans son emploi du temps, peut seulement abaisser ce nombre, jamais l'augmenter.

La valeur par défaut fondée sur le niveau de bavardage fonctionne ainsi :

| Niveau de bavardage du personnage | Prises de nouvelles par jour, par défaut |
|---|---|
| 80 ou plus | 8 |
| 60 à 79 | 6 |
| 40 à 59 | 5 |
| 20 à 39 | 3 |
| moins de 20 | 2 |

### Activer les emplois du temps

**Schedules** (plannings) se trouve dans **Autonomous Messaging**. Les routines enregistrées appartiennent aux personnages et sont réutilisées dans les chats Conversation, y compris quand un personnage rejoint un chat existant. Les désactiver explicitement dans un chat conserve ce choix sans supprimer la routine du personnage.

1. Active l'interrupteur **Schedules**.
2. Les routines existantes apparaissent immédiatement. Activer les plannings ne génère rien ; clique sur **Generate** pour en créer.
3. Une fois les routines créées, une liste **Edit schedules** (modifier les emplois du temps) apparaît, avec une ligne par personnage.

Le renouvellement hebdomadaire automatique reste désactivé tant que tu ne l'actives pas pour le personnage dans **Character Schedule Manager** (gestionnaire des plannings). Un échec ne déclenche pas de tentatives répétées à chaque réouverture du chat ; utilise les commandes de génération pour réessayer.

Chaque ligne indique le nombre de jours remplis, par exemple **3 days scheduled**, ou affiche **Create schedule** si le personnage n'a encore rien. Un bouton **Generate** (nommé **Regenerate** une fois les routines créées) reconstruit les routines à la demande.

## L'éditeur d'emploi du temps

Clique sur la ligne d'un personnage dans la liste **Edit schedules** pour ouvrir l'éditeur d'emploi du temps. Le titre de la fenêtre affiche **Edit**, puis le nom du personnage, puis **Schedule**.

En haut, la zone **Routine profile** présente un récapitulatif de la semaine en langage courant. Le bouton **Generate summary** le crée, et **Refresh summary** le met à jour. Si tu modifies l'emploi du temps après avoir créé un résumé, la mention **Summary may be stale** apparaît.

### Tuning

Ouvre la section **Tuning** (réglage fin) pour accéder aux commandes principales.

- **Chat talkativeness** est un curseur à cinq crans : **Rare**, **Quiet**, **Balanced**, **Social** et **Very frequent**. La valeur par défaut, **Balanced**, se trouve au milieu. Elle remplace le niveau de bavardage par défaut du personnage partout où son planning est utilisé. Elle influe sur la fréquence à laquelle le personnage lance des messages, en envoie de nouveaux à la suite et participe au bavardage de groupe. Elle fixe aussi sa limite quotidienne par défaut.
- **Wait before checking in** correspond à la durée de silence, en minutes, avant que ce personnage puisse prendre de tes nouvelles. La plage va de 15 à 360 minutes. La valeur par défaut est **120**.
- **Check-in moments** liste les prétextes que le personnage peut invoquer pour te contacter. Les pastilles disponibles sont **Morning**, **Goodnight**, **Meal breaks**, **After busy** et **Long absence**. Toutes sont actives par défaut. Clique sur l'une d'elles pour la désactiver.

### Advanced timing

Dans **Tuning**, ouvre **Advanced timing** (minutage avancé) pour trois commandes supplémentaires.

- **Daily safety limit** fixe un maximum strict pour ce seul personnage, soit **Default**, soit un nombre de 1 à 8 par jour. Il peut seulement abaisser le plafond du chat, jamais l'augmenter. En général, mieux vaut le laisser sur **Default**.
- **Delay while you're away** indique combien de minutes ce personnage attend avant d'envoyer un message tant que son propre statut est **Away**. Laisse le champ vide pour garder la valeur par défaut, un délai aléatoire de 1 à 3 minutes. La plage va de 0 à 120 minutes.
- **Delay while you're busy** fait de même quand le statut du personnage est **Busy**. Laisse le champ vide pour garder la valeur par défaut, un délai aléatoire de 2 à 5 minutes. La plage va de 0 à 120 minutes.

### Schedule AI : réécrire la semaine

Ouvre la section **Schedule AI** pour confier la réécriture de la routine au modèle. Choisis une action dans **Week action** :

- **Rewrite** rédige un nouveau brouillon pour la semaine entière.
- **Adjust** conserve l'essentiel de la routine et applique tes consignes.
- **Vary** produit une semaine nettement différente, mais toujours crédible.
- **Repair** comble les trous et corrige les problèmes évidents par petites touches.

Saisis des indications facultatives dans le champ **Week guidance**, par exemple :

```
make weekdays more nocturnal, keep weekends social
```

Clique ensuite sur le bouton qui porte le nom de ton action, par exemple **Rewrite week**. Le résultat n'est qu'un brouillon. Rien n'est enregistré tant que tu n'as pas cliqué sur **Save schedule**. Si le modèle renvoie du JSON invalide, corrige-le dans **Edit generated schedule JSON** (modifier le JSON généré), puis choisis **Apply to draft** (appliquer au brouillon). Les corrections validées et les jours générés correctement restent dans le brouillon jusqu'à l'enregistrement. Un échec arrête l'appel sans nouvelle tentative automatique. **Stop** ou la fermeture de l'éditeur annule la requête active. Fermer le gestionnaire ou les paramètres du chat annule aussi la génération lancée à cet endroit.

### Blocs quotidiens

Sous ces sections, chaque jour du lundi au dimanche dispose de sa propre ligne. Un jour sans rien de défini affiche **No blocks scheduled for this day**.

Chaque bloc comporte trois parties, regroupées sous l'intitulé **Status, time & activity** :

- Un **statut**, à choisir parmi **Online**, **Away**, **Busy** ou **Offline**.
- Une plage horaire, saisie sous la forme `09:00-11:30`.
- Une courte note d'activité, par exemple `at work`.

Le bouton **Add block** ajoute une plage horaire. L'icône en forme de corbeille en supprime une. Chaque jour possède aussi son champ de consignes, intitulé **Guide Monday**, **Guide Tuesday**, et ainsi de suite. Saisis-y une indication, puis clique sur le bouton correspondant, par exemple **Regenerate Monday**, pour réécrire ce seul jour.

Le statut du bloc change ce que fait un personnage quand l'heure d'une prise de nouvelles arrive. Un personnage dont le bloc est **Offline** n'écrit jamais en premier pendant cette période. Un personnage dont le bloc est **Busy** attend trois fois plus longtemps que d'habitude avant de te contacter.

Quand tu as terminé, clique sur **Save schedule**. Le bouton **Cancel** ferme l'éditeur sans rien enregistrer.

### Déplacer un emploi du temps d'un personnage ou d'une installation à l'autre

Le bouton **Export schedule** (exporter l'emploi du temps), en bas de l'éditeur, télécharge le brouillon en cours sous forme de fichier JSON. L'export contient les blocs de la semaine, le résumé de routine, le niveau de bavardage, les prétextes de prise de nouvelles et les réglages de minutage avancé.

Ouvre l'éditeur d'emploi du temps d'un autre personnage, puis choisis **Import schedule** (importer un emploi du temps) pour charger ce fichier. Marinara vérifie le fichier avant de remplacer le brouillon de l'éditeur, et replace la routine importée sur la semaine en cours. L'import n'est pas enregistré automatiquement : clique sur **Save schedule** pour le conserver, ou sur **Cancel** pour laisser l'emploi du temps du personnage inchangé.

### Schedule generation preferences

De retour dans les **Chat Settings**, le champ **Schedule generation preferences** (préférences de génération des emplois du temps) accueille des consignes libres sur la manière d'écrire les routines. Ce réglage est global. Il s'applique à tous les chats en mode Conversation, dès la prochaine génération d'emplois du temps, à la main ou par l'application. Par exemple :

```
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## Définir un statut ponctuel avec /status

La commande **/status** définit ou efface un statut temporaire pour un personnage, sans toucher à son emploi du temps enregistré. Elle ne fonctionne qu'en mode Conversation.

Voici la forme de la commande :

```
/status <online|idle|dnd|offline|clear> [character name]
```

Saisis `idle` pour **Away** et `dnd` pour **Busy**. Ce sont les quatre statuts déjà utilisés dans les blocs d'emploi du temps. Pour qu'un personnage nommé Mira apparaisse occupé tout de suite :

```
/status dnd Mira
```

Pour annuler ce forçage et rendre Mira à son emploi du temps :

```
/status clear Mira
```

Si le chat ne compte qu'un seul personnage, le nom devient facultatif. Lance **/status** sans option pour afficher la liste des personnages et l'aide d'utilisation.

## Comment les messages autonomes sont cadencés

Marinara cadence les messages autonomes pour qu'un personnage ne t'inonde jamais. Les règles ci-dessous s'appuient sur l'emploi du temps propre à chaque personnage.

- Un personnage attend que tu sois resté silencieux pendant sa durée **Wait before checking in**. Par défaut, 120 minutes.
- Un personnage dont le statut est **Offline** n'écrit pas en premier.
- Un personnage dont le statut est **Busy** attend trois fois plus longtemps.
- Après le premier message, un personnage peut en envoyer deux de plus tant que tu restes silencieux. Cela fait trois messages au total par période de silence.
- Chaque message suivant attend plus longtemps que le précédent. Le premier attend le double du délai de base, le second le quadruple.
- Dès que tu réponds, le compteur repart à zéro. Le prochain silence recommence de zéro.

Si plusieurs personnages sont prêts en même temps, celui qui a le plus haut niveau de bavardage et le meilleur minutage passe en premier.

## Ton statut de présence

Ton propre statut indique aux personnages si tu es disponible. La commande de statut se trouve dans le pied de page de la barre latérale et reste visible dans tous les modes de chat. Son effet sur la messagerie ne joue toutefois qu'en mode Conversation.

Clique sur la pastille de statut pour ouvrir quatre choix :

- **Active** : tu es en ligne et disponible.
- **Idle** : affiché quand tu t'absentes.
- **Do Not Disturb** : coupe tous les messages autonomes.
- **Invisible** : masque ton statut aux personnages.

Le statut **Idle** est surtout automatique. Si ton statut est **Active** et que tu ne fais rien pendant 10 minutes, Marinara te bascule sur **Idle**. Il te remet sur **Active** dès ton retour. Autre option : choisir **Idle** toi-même dans le panneau contextuel. Dès que tu choisis un statut à la main, la bascule automatique s'arrête jusqu'à ce que tu reviennes sur **Active**.

Passe sur **Do Not Disturb** quand tu veux la paix. Aucun personnage ne t'écrira en premier tant que ce statut est actif. En revanche, **Idle** ne bloque pas les messages autonomes : les personnages peuvent continuer à prendre de tes nouvelles pendant ton absence.

À côté de la pastille de statut se trouve le champ **What are you doing?**. Saisis-y une activité personnalisée courte, jusqu'à 120 caractères. Les dernières saisies apparaissent dans une liste **Recent status**, prête à être réutilisée.

## Guides associés

- [Mode Conversation : premiers pas](getting-started.md)
- [Profils du mode Conversation (Display Name, About Me, Behavior)](profiles.md)
- [Vue d'ensemble des Chat Settings](../chats/chat-settings.md)
