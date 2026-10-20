# Organiser les connexions

Ce guide explique comment garder tes connexions enregistrées bien rangées dans Marinara Engine. Au programme : les dossiers de connexions, la recherche et le tri, la duplication et la suppression, le pool aléatoire, le Quick Connection Switcher, et l'export ou l'import des connexions. Une connexion est une configuration enregistrée qui indique à Marinara comment joindre un service d'IA.

Tout se passe dans le panneau **Connections** (Connexions). Ouvre-le : tes connexions enregistrées s'affichent sous forme de liste. Chaque ligne indique le nom de la connexion, et juste en dessous son fournisseur et son modèle.

## Les dossiers de connexions

Les dossiers de connexions servent à regrouper des connexions qui vont ensemble. Range par exemple tous les modèles locaux dans un dossier et tous les fournisseurs payants dans un autre.

Pour créer un dossier, procède ainsi :

1. Clique sur le bouton **New Folder** (nouveau dossier) au-dessus de la liste des connexions.
2. Un nouveau dossier nommé "unnamed" apparaît.
3. Renomme-le tout de suite pour le reconnaître (voir ci-dessous).

Pour renommer un dossier, double-clique sur la ligne du dossier, ou touche-la deux fois sur un écran tactile. Autre option : sélectionne la ligne du dossier et appuie sur la touche **F2**. Saisis le nouveau nom, puis appuie sur Enter.

Pour ranger une connexion dans un dossier, fais glisser la ligne de la connexion et dépose-la sur le dossier. Pour l'en ressortir, fais-la glisser vers la zone située sous les dossiers. Pendant le glissement, une indication affiche **Drop here to move out of folder**.

Sur écran tactile, appuie longuement sur une ligne pour la saisir, puis fais-la glisser. Un balayage normal fait toujours défiler la liste.

Pour replier ou déplier un dossier, clique une fois sur sa ligne. Un petit nombre sur la ligne du dossier indique combien de connexions il contient.

Pour supprimer un dossier, clique sur l'icône de corbeille sur sa ligne. S'il contient encore des connexions, Marinara demande confirmation avec une fenêtre **Delete Folder** (supprimer le dossier). Un dossier vide est supprimé aussitôt, sans confirmation. Supprimer un dossier ne supprime pas les connexions qu'il contient : elles retournent simplement dans la zone des connexions non classées.

## Recherche et tri

Le champ **Search connections** filtre la liste au fil de la saisie. La recherche porte sur le nom de la connexion, le fournisseur, le modèle, l'URL de base, le service d'images ou de vidéos, et le modèle d'embedding. Quand rien ne correspond, tu vois "No connections match your search".

Le menu déroulant **Sort order** (ordre de tri), à côté du champ de recherche, change l'ordre de la liste. Il propose cinq options :

| Option | Effet |
|---|---|
| **Custom** | Ton ordre personnel, défini par glisser-déposer. |
| **A-Z** | Tri par nom, de A à Z. |
| **Z-A** | Tri par nom, de Z à A. |
| **Newest** | Les connexions les plus récentes d'abord. |
| **Oldest** | Les connexions les plus anciennes d'abord. |

Pour définir un ordre personnalisé, fais glisser les lignes de connexions vers le haut ou vers le bas. Dès que tu déplaces une connexion, le tri bascule automatiquement sur **Custom**. Tu peux aussi déplacer une ligne sélectionnée avec Alt+Up ou Alt+Down.

## Dupliquer et supprimer

Survole une ligne de connexion (ou regarde simplement la ligne sur un écran tactile) pour faire apparaître ses boutons d'action.

Pour dupliquer une connexion, clique sur le bouton **Duplicate** (dupliquer), l'icône de copie. Marinara en fait une copie complète, clé API comprise. La copie s'ouvre dans l'éditeur pour que tu la renommes. Il n'y a aucune étape de confirmation.

Pour supprimer une seule connexion, clique sur son bouton **Delete** (supprimer), l'icône de corbeille. Marinara affiche une fenêtre **Delete Connection** qui indique Delete "your connection name"? This cannot be undone. Clique sur **Delete** pour confirmer.

Pour supprimer ou exporter plusieurs connexions d'un coup, clique sur le bouton **Select** (sélectionner) en haut du panneau. Le mode sélection s'active. Touche les connexions voulues, puis utilise le bouton **Export** (exporter) ou **Delete** dans la barre d'action en bas. La suppression groupée affiche une fenêtre **Delete Connections** avant de retirer quoi que ce soit.

<a id="the-random-pool-and-quick-connection-switcher"></a>

## Le pool aléatoire et le Quick Connection Switcher

Le pool aléatoire permet à un chat de choisir une connexion différente à chaque génération de réponse. Pratique pour répartir les requêtes entre plusieurs fournisseurs ou modèles.

Pour ajouter une connexion au pool aléatoire, clique sur l'icône de mélange sur sa ligne. Son infobulle indique **Add to random pool**. Une fois la connexion dans le pool, l'infobulle devient **In random pool (click to remove)**. Clique de nouveau sur l'icône pour l'en retirer.

Pour qu'un chat utilise le pool aléatoire, ouvre la section **Chat Settings** (réglages du chat), va dans la section **Connection**, et choisis **🎲 Random** dans le menu déroulant. En Game Mode, ce menu déroulant s'appelle **GM / Party Model**. Chaque réponse pioche alors une connexion au hasard dans le pool.

Si la connexion choisie pour une réponse échoue et que tu as défini une connexion de secours pour **Main**, c'est la connexion de secours qui écrit la réponse. Un avis nomme la connexion qui a échoué, son modèle et une courte raison, comme "key rejected", "rate limited" ou "not found", pour que tu saches quelle connexion du pool doit être réparée. La réponse garde une petite étiquette **Fallback** (secours) ; touche-la, ou pointe dessus, pour revoir la même ligne.

Le **Quick Connection Switcher** est un moyen plus rapide de changer la connexion du chat en cours, ainsi que son modèle. Clique sur l'icône de lien dans la zone de saisie du chat pour l'ouvrir. Il affiche tes connexions à gauche et les **Models** (modèles) de la connexion choisie à droite :

- Clique sur une connexion pour l'utiliser immédiatement dans le chat en cours. Le menu reste ouvert pour que tu puisses ensuite choisir l'un de ses modèles.
- Clique sur un modèle pour l'utiliser. Le modèle est enregistré dans cette connexion, la connexion est sélectionnée pour le chat si elle ne l'était pas déjà, et le menu se ferme. Une coche signale le modèle que la connexion utilise actuellement. Comme dans l'éditeur de connexion, choisir un modèle de la liste met aussi à jour la fenêtre de contexte de la connexion, ainsi que sa limite de sortie, quand le fournisseur les indique.
- Tape dans le champ **Search or enter model ID…** (rechercher ou saisir un ID de modèle) pour filtrer la liste. Appuyer sur Enter choisit le modèle dont tu as tapé l'ID ou le nom, ou le seul modèle qui reste dans la liste. Pour utiliser un modèle absent de la liste, tape son ID exact : appuie sur Enter quand rien dans la liste ne lui correspond, ou clique sur la ligne **Use "…"**.
- Clique sur l'étoile à côté d'un modèle pour l'épingler. Les modèles épinglés restent en haut, sous **Pinned** (épinglés), même ceux que tu as saisis à la main. Clique de nouveau sur l'étoile pour le désépingler.
- La première fois que tu ouvres les modèles d'une connexion, Marinara charge la liste depuis le fournisseur et l'enregistre avec la connexion : les fois suivantes, elle s'affiche tout de suite. Clique sur le bouton d'actualisation à côté du champ de recherche pour recharger la liste, par exemple après l'ajout de nouveaux modèles par le fournisseur. Modifier la clé API, l'URL de base ou le fournisseur de la connexion charge aussi une nouvelle liste.
- Si le fournisseur n'a pas de liste de modèles ou reste injoignable, le menu l'indique, et tu peux quand même saisir un ID de modèle.
- Clique sur le bouton de dé en haut du menu pour activer ou désactiver le pool aléatoire pour ce chat.
- Quand le pool aléatoire est actif, cliquer sur une connexion l'ajoute au pool ou l'en retire. Une coche indique quelles connexions font partie du pool. La colonne **Models** est masquée, car le pool n'a pas de connexion unique.

Sur téléphone, touche le chevron à côté de la zone de saisie et ouvre l'onglet **Connections**. Touche une connexion pour y basculer le chat ; le menu se ferme. Pour choisir un modèle, touche plutôt la flèche au bout à droite de la ligne de la connexion. Ses modèles s'ouvrent dans le même menu, et le chat ne bascule que lorsque tu en choisis un. Touche la flèche de retour pour revenir à la liste des connexions.

**Un changement de modèle s'applique partout où la connexion est utilisée.** La note en bas du menu, "Model changes are saved to this connection.", signifie que les agents, les fonctions auxiliaires et les autres chats qui utilisent la même connexion passent eux aussi au nouveau modèle. Les autres réglages de modèle de la connexion, comme son modèle d'embedding ou sa connexion de description des images, ne changent pas. Si tu veux un modèle différent pour un seul usage, duplique la connexion et modifie la copie.

## Exporter et importer des connexions

Exporte tes connexions dans un fichier pour les sauvegarder ou les transférer vers une autre installation, puis réimporte-les plus tard.

**Tes clés API ne sont jamais incluses dans un export.** Après avoir importé des connexions, tu dois ouvrir chacune d'elles et saisir de nouveau sa clé API. Les modèles épinglés sont inclus ; la liste de modèles enregistrée ne l'est pas, elle se recharge donc la première fois que tu ouvres les modèles de la connexion.

Pour exporter une seule connexion, ouvre-la dans l'éditeur et clique sur son bouton **Export**, l'icône de téléversement. Pour en exporter plusieurs d'un coup, passe en mode **Select** dans le panneau et clique sur **Export** dans la barre d'action. Avant le début du téléchargement, Marinara affiche une fenêtre **Export Connection Data** avec cet avertissement : This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others! Clique sur **Export** pour continuer.

Une connexion seule est téléchargée sous la forme d'un fichier `.connection.json`. Plusieurs connexions sont téléchargées ensemble dans un fichier `marinara-connections.zip`.

Pour importer des connexions, clique sur le bouton **Import** (importer) en haut du panneau **Connections**. La fenêtre **Import Connections** s'ouvre. Dépose un ou plusieurs fichiers `.json` dessus, ou clique pour aller les chercher. La fenêtre te le rappelle : Imported connections never include API keys. Add each key again after import. Après l'import, chaque nouvelle connexion a une clé API vide, tant que tu ne l'as pas renseignée.

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Vue d'ensemble des réglages du chat](../chats/chat-settings.md)
