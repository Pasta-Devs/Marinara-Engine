# Emplois du temps des personnages et messages autonomes

Les messages autonomes sont des messages qu'un personnage t'envoie en premier, après que tu es resté silencieux un moment. Un emploi du temps est le plan hebdomadaire d'un personnage, qui lui donne l'air d'être éveillé, occupé ou endormi à différents moments. Les deux ne fonctionnent qu'en mode Conversation.

Les emplois du temps sont facultatifs. Quand ils sont désactivés, les personnages te contactent quand même selon leur sociabilité (la fréquence à laquelle un personnage lance une conversation) et ta présence.

Aller à : [Activer les emplois du temps](#turn-on-schedules) si tu veux seulement un emploi du temps.

## Activer les messages autonomes

**Avant de commencer :** ouvre un chat Conversation. Les nouveaux chats démarrent avec cette option activée (voir [Mode Conversation : premiers pas](getting-started.md)).

1. Ouvre **Chat Settings** (réglages du chat) dans le chat.
2. Trouve la section **Autonomous Messaging** (messages autonomes).
3. Active **Autonomous Messages**.

Si ça n'a pas marché : les personnages restent silencieux tant que ta présence est **Do Not Disturb** (voir [Ton statut de présence](getting-started.md#your-presence-status)).

### Définir la limite de check-ins

Dans **Chat Settings → Autonomous Messaging**, **Chat Check-In Cap** limite le nombre de check-ins que les personnages peuvent envoyer par jour dans ce chat.

- **Default chat ceiling (talkativeness-based)** prend la limite de la sociabilité de chaque personnage (tableau ci-dessous).
- **Numeric value** affiche un champ numérique. Saisis un nombre entier de 1 ou plus. Les nombres élevés peuvent signifier beaucoup de requêtes au modèle et de notifications.

Un personnage peut aussi avoir sa propre **Daily safety limit** (définie dans son emploi du temps). La limite d'un personnage fonctionne ainsi :

- Si le plafond du chat est sur **Numeric value** et qu'une **Daily safety limit** est définie, le nombre le plus bas gagne.
- Si un seul des deux est défini, ce nombre s'applique, même s'il est plus haut que le nombre de sociabilité ci-dessous.
- Si aucun n'est défini, le nombre vient de la sociabilité du personnage.

| Sociabilité du personnage | Check-ins par jour |
| --- | --- |
| 80 ou plus | 8 |
| 60 à 79 | 6 |
| 40 à 59 | 5 |
| 20 à 39 | 3 |
| moins de 20 | 2 |

<a id="turn-on-schedules"></a>

## Activer les emplois du temps

**Avant de commencer :** active **Autonomous Messages**.

1. Dans **Chat Settings → Autonomous Messaging**, active **Schedules**. (Dans l'assistant de nouveau chat, la même option s'appelle **Generate Schedules**.) Les emplois du temps qui existent déjà apparaissent tout de suite.
2. Choisis ton fuseau horaire dans le champ en dessous.
3. Clique sur **Generate** pour créer des emplois du temps pour les personnages qui n'en ont pas. Le bouton affiche **Regenerate** une fois que des emplois du temps existent.
4. Attends la fin. Une liste **Edit schedules** apparaît alors, avec une ligne par personnage. Une ligne indique combien de jours sont remplis (par exemple **3 days scheduled**) ou **Create schedule**. La liste s'affiche seulement une fois que des emplois du temps existent.
5. Clique sur la ligne d'un personnage pour ouvrir son éditeur d'emploi du temps (section suivante).

Un emploi du temps appartient au personnage et sert dans chaque chat Conversation. Désactiver **Schedules** dans un chat le garde désactivé là et garde l'emploi du temps.

Le renouvellement hebdomadaire automatique est désactivé, sauf si tu actives **Renew weekly** pour ce personnage dans le **Character Schedule Manager** (gestionnaire d'emplois du temps). Ouvre-le avec le bouton calendrier dans le pied de la barre latérale, à côté de la zone de statut. Marinara tente un renouvellement une fois pour chaque personnage à chaque chargement de la page de l'application. S'il échoue, il ne réessaie pas avant que tu recharges la page. Clique sur **Generate** pour réessayer.

**Schedule generation preferences**, dans la même zone **Schedules** de **Chat Settings**, contient des consignes en texte libre sur la façon d'écrire les emplois du temps. Elles s'appliquent à chaque chat Conversation la prochaine fois que des emplois du temps sont générés. Exemple :

```text
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## L'éditeur d'emplois du temps

Le titre de l'éditeur affiche **Edit**, plus le nom du personnage et **Schedule**.

En haut, **Routine profile** montre un résumé de la semaine en langage simple. Clique sur **Generate summary** pour le créer, ou sur **Refresh summary** pour le mettre à jour. Après une modification de l'emploi du temps, **Summary may be stale** apparaît. **Generation model** choisit le modèle qui écrit les emplois du temps.

### Réglages fins

Ouvre **Tuning** pour les contrôles principaux.

- **Chat talkativeness** : un curseur avec **Rare**, **Quiet**, **Balanced**, **Social** et **Very frequent**. La valeur par défaut est **Balanced**. Il règle la fréquence à laquelle le personnage lance des messages et se joint aux discussions de groupe, ainsi que sa limite quotidienne par défaut.
- **Wait before checking in** : les minutes de silence avant que le personnage puisse faire un check-in. La valeur par défaut est 120. Tu peux utiliser de 15 à 360.
- **Check-in moments** : des pastilles pour **Morning**, **Goodnight**, **Meal breaks**, **After busy** et **Long absence**. Toutes sont activées. Clique sur l'une pour la désactiver.

Ouvre **Advanced timing** dans **Tuning** pour trois contrôles de plus.

- **Daily safety limit** : le maximum de check-ins par jour pour ce personnage. Laisse **Default**, ou saisis un nombre entier de 1 ou plus. Si le chat a aussi un plafond numérique, le nombre le plus bas gagne. Sinon, ce nombre remplace le nombre de sociabilité.
- **Delay while you're away** : des minutes en plus avant que le personnage réponde quand son statut est **Away**. Laisse vide pour un délai aléatoire de 1 à 3 minutes. Tu peux utiliser de 0 à 120.
- **Delay while you're busy** : la même chose quand son statut est **Busy**. Laisse vide pour un délai aléatoire de 2 à 5 minutes. Tu peux utiliser de 0 à 120.

### Schedule AI : réécrire la semaine

Ouvre **Schedule AI** pour que le modèle réécrive l'emploi du temps. Choisis une **Week action** :

| Action | Résultat |
| --- | --- |
| **Rewrite** | Un nouveau brouillon de semaine complète. |
| **Adjust** | Garde l'essentiel de l'emploi du temps actuel et applique tes consignes. |
| **Vary** | Une semaine nettement différente mais toujours crédible. |
| **Repair** | Corrige les trous et les problèmes évidents par de petits changements. |

1. Choisis une **Week action**.
2. Sous **Weekly generation**, choisis **Entire week in one request** ou **One request per day**. Une requête par jour fait sept requêtes plus petites et peut utiliser plus de tokens (les petits morceaux de texte que comptent les modèles).
3. Saisis des indications facultatives dans **Week guidance**, par exemple `make weekdays more nocturnal, keep weekends social`.
4. Clique sur le bouton qui nomme ton action, comme **Rewrite week**.
5. Clique sur **Save schedule** pour garder le résultat. Jusque-là, c'est un brouillon (**Unsaved draft**).

Si ça n'a pas marché : ton brouillon est conservé. Un appel échoué n'est pas relancé, donc clique à nouveau sur le bouton. Clique sur **Stop** ou ferme l'éditeur pour annuler une requête en cours. Si l'éditeur affiche **Edit generated schedule JSON**, le modèle a renvoyé un texte illisible. Corrige le texte là et clique sur **Apply to draft**.

### Blocs quotidiens

Chaque jour, du lundi au dimanche, a sa propre ligne. Un jour vide affiche **No blocks scheduled for this day**. Chaque bloc a un statut, une plage horaire comme `09:00-11:30` et une courte activité comme `at work`.

1. Clique sur **Add block** sous un jour.
2. Choisis un statut : **Online**, **Away**, **Busy** ou **Offline**.
3. Saisis la plage horaire et l'activité.
4. Clique sur **Save schedule**. **Cancel** ferme l'éditeur sans enregistrer.

Utilise l'icône de corbeille pour supprimer un bloc. Pour réécrire un seul jour, saisis une indication dans **Guide Monday** (ou le jour voulu) et clique sur **Regenerate Monday**.

Pendant un bloc **Offline**, le personnage n'écrit jamais en premier. Pendant un bloc **Busy**, il attend trois fois plus longtemps que d'habitude.

### Déplacer un emploi du temps entre des personnages

Clique sur **Export schedule** pour télécharger le brouillon comme fichier JSON (blocs hebdomadaires, résumé, sociabilité, moments de check-in et délais). Dans l'éditeur d'un autre personnage, clique sur **Import schedule** pour le charger. Marinara vérifie le fichier et déplace l'emploi du temps vers la semaine en cours. Rien n'est enregistré avant que tu cliques sur **Save schedule**.

## Définir un statut avec /status

`/status` définit ou efface un statut temporaire pour un personnage sans changer son emploi du temps enregistré. Il ne fonctionne qu'en mode Conversation. Le statut appartient au personnage, donc il s'applique dans chaque chat où ce personnage se trouve.

Tape l'une de ces lignes dans le champ de message :

```text
/status dnd Mira
/status clear Mira
```

La première rend Mira occupée. La seconde la remet sur son emploi du temps. Avec un seul personnage dans le chat, tu peux omettre le nom. `/status` seul liste les personnages et l'usage.

La forme complète est ci-dessous. `idle` veut dire **Away** et `dnd` veut dire **Busy**. Les crochets veulent dire que le nom est facultatif.

```text
/status online|idle|dnd|offline|clear [character name]
```

Un statut que tu définis reste jusqu'à ce que tu l'effaces, et un personnage ne peut pas le remplacer.

## Laisser les personnages changer leur propre statut

Avec **Schedule Updates** activé dans **Chat Settings → Agents → Commands**, un personnage peut définir son propre statut et sa propre activité temporaires. Par exemple, si tu lui demandes de se concentrer pendant une heure, il peut passer à **Busy** avec l'activité "Studying".

- Le changement dure aussi longtemps que le personnage le dit, ou une heure s'il ne le dit pas. Le maximum est de sept jours.
- Quand le temps est écoulé, le personnage revient à son emploi du temps, ou à **Online** s'il n'en a pas.
- Il ne modifie jamais l'emploi du temps enregistré.

## Rythme des check-ins

| Règle | Détail |
| --- | --- |
| Premier check-in | Le personnage attend que tu aies été silencieux pendant son délai **Wait before checking in** (120 minutes par défaut). |
| Réaction | Une réaction de ta part sans nouveau message ouvre une attente plus courte. |
| Statut **Offline** | Pas de check-in. |
| Statut **Busy** | L'attente est trois fois plus longue. |
| Relances | Jusqu'à deux de plus pendant que tu restes silencieux, trois au total. La première relance vient après deux fois l'attente, la seconde après quatre fois l'attente. |
| Ta réponse | Le compte repart à zéro. |
| Plusieurs personnages prêts | Celui qui a la plus haute sociabilité et le meilleur timing passe en premier. Un personnage **Online** passe avant. |

Dans un chat de groupe où chaque personnage répond dans sa propre réponse (voir [Chats de groupe](../chats/group-chats.md)), les personnages partagent une limite quotidienne et un rythme. Après le check-in d'un personnage, le check-in suivant de n'importe qui attend comme une relance. Tout personnage dont l'attente est écoulée peut l'envoyer, et celui qui a le moins de check-ins ce jour-là passe en premier. Après une longue absence, un seul personnage fait un check-in.

## Guides associés

- [Mode Conversation : premiers pas](getting-started.md)
- [Profils du mode Conversation](profiles.md)
- [Vue d'ensemble des réglages du chat](../chats/chat-settings.md)
