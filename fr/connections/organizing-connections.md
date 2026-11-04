# Organiser les connexions

Ce guide explique comment garder tes comptes et tes modèles bien rangés dans le panneau **Connections** (Connexions) : repli, étoiles, déplacement, retrait, dossiers, Shuffle (le mélange de modèles) et export. Pour ajouter un compte, consulte [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md).

## La liste des comptes

Sous l'encadré **Jobs** (tâches), le panneau liste tes comptes. Chaque compte affiche son image, son nom, son nombre de modèles et son adresse. Une ligne de modèle affiche l'image du modèle, son nom et des badges, comme la tâche dont il s'occupe (**Main**, **Agents**, **Images**), **Custom settings** (réglages personnalisés), son prix, ou **Plan** (forfait) pour les modèles inclus dans un abonnement. La carte **Built-in model** (modèle intégré) se trouve sous l'encadré **Jobs**. Voir [Configuration du modèle intégré](local-model.md).

Clique sur la ligne d'un compte pour replier ses modèles, et clique de nouveau pour les afficher. Marinara se souvient des comptes que tu as repliés. **More actions** (plus d'actions, trois points), en haut du panneau, propose ces éléments :

| Élément | Ce qu'il fait |
| --- | --- |
| **Fold all accounts** (replier tous les comptes), **Open all accounts** (ouvrir tous les comptes) | Replie ou ouvre tous les comptes. |
| **Show only Off or Needs key** (afficher seulement les comptes Off ou Needs key) | Ne liste que les comptes qui demandent ton attention. |
| **Show cost badges** (afficher les badges de coût) | Affiche le prix de chaque modèle. |
| **Group by folder** (regrouper par dossier), **Group by account** (regrouper par compte) | Change la façon dont les modèles sont regroupés. Voir [Dossiers](#folders). |
| **Import account** (importer un compte), **Export all accounts** (exporter tous les comptes) | Voir [Exporter et importer](#export-and-import). |

Dans un panneau large, le menu déroulant de tri se trouve à côté de **Search models and accounts** (rechercher des modèles et des comptes). Dans un panneau étroit, le tri se trouve dans **More actions**. Les choix de tri sont **Custom** (personnalisé), **A–Z**, **Z–A**, **Newest** (plus récents) et **Oldest** (plus anciens). **Search models and accounts** filtre la liste au fil de la saisie.

Certains comptes donnent accès aux modèles de plusieurs créateurs, comme NanoGPT ou un proxy. Leurs modèles sont regroupés sous des intitulés comme **via NanoGPT**.

### Actions sur un compte

Clique sur **⋯** sur la ligne d'un compte :

| Action | Ce qu'elle fait |
| --- | --- |
| **Edit account** (modifier le compte) | Ouvre ses réglages, notamment **Name** (nom), **Address** (adresse), **API key** (clé API) et **Use this account** (utiliser ce compte). |
| **Replace key** (remplacer la clé) | Colle une nouvelle clé. Si l'ancienne clé se trouve sur d'autres comptes, Marinara te demande s'il faut aussi les mettre à jour. |
| **Test** (tester) | Vérifie la clé et affiche le résultat. |
| **Add model** (ajouter un modèle) | Ouvre la liste des modèles du compte. **Add image model** (ajouter un modèle d'images) s'affiche pour les services qui produisent aussi des images. |
| **Select models** (sélectionner des modèles) | Permet de déplacer ou de supprimer plusieurs modèles d'un coup. |
| **Duplicate** (dupliquer) | Ajoute une copie du compte, avec des copies de ses modèles. |
| **Turn off** (désactiver) / **Turn on** (activer) | Arrête ou reprend l'utilisation du compte par Marinara. |
| **Delete account** (supprimer le compte) | Voir plus bas. |

Pour supprimer un compte, clique sur **Delete account**. Marinara te demande de confirmer et liste ce qui utilise ses modèles, sous **Used by** (utilisé par) : chats, agents, modèles et tâches. Clique sur **Delete with its N models** (supprimer avec ses N modèles) pour retirer le compte et ses modèles. Ces chats et ces tâches ont ensuite besoin d'un autre modèle. Si un modèle ne peut pas être retiré, l'éditeur le liste sous **This account still has models. Remove these first:**. Ouvre chacun d'eux et retire-le.

Dans **Edit account**, **Test account** (tester le compte) vérifie la clé, **Usage and balance** (utilisation et solde) affiche la consommation du forfait, et **More options** (plus d'options) contient **Requests per minute** (requêtes par minute) et **Parallel requests** (requêtes en parallèle).

### Icônes des fournisseurs

Chaque compte affiche l'icône de son service. Les icônes sont livrées avec Marinara et ne sont jamais chargées depuis internet. Une adresse personnalisée affiche l'icône d'un serveur ou d'une passerelle connus quand son adresse ou son nom en contient un, par exemple Ollama, LM Studio, KoboldCpp, Bifrost ou LiteLLM. Sinon, elle affiche la première lettre de son nom. Pour choisir la tienne, clique sur l'image d'un compte, puis choisis le logo d'un service, téléverse une image ou utilise des lettres.

## Modèles favoris

Une étoile marque les modèles que tu veux retrouver vite. Les modèles étoilés sont listés sous **Starred** (favoris), près du haut de chaque sélecteur de modèle : les fenêtres **Model for** (modèle pour) de l'encadré **Jobs**, **Model for this chat** (modèle pour ce chat), et les champs de modèle dans **Chat Settings** (réglages du chat) et dans l'éditeur d'agent.

Pour étoiler un modèle, clique sur son étoile dans la liste **Add model** du compte, ou choisis **Star** (étoiler) dans le menu **⋯** du modèle. Confier une tâche à un modèle l'enregistre aussi.

Pour retirer l'étoile d'un modèle, clique de nouveau dessus. Marinara retire le modèle et affiche **Undo** (annuler) pendant quelques secondes. Le modèle reste, sans son étoile, quand un chat l'utilise, qu'il a un rôle dans **Jobs**, qu'il a ses propres réglages ou qu'il est le dernier modèle de son compte. Le message en indique la raison.

## Actions sur un modèle

Clique sur **⋯** sur la ligne d'un modèle :

| Action | Ce qu'elle fait |
| --- | --- |
| **Make default for…** (définir par défaut pour…) | Confie une tâche au modèle, comme si tu le choisissais dans l'encadré **Jobs**. |
| **Edit model** (modifier le modèle) | Ouvre ses réglages. Cliquer sur la ligne du modèle fait la même chose. |
| **Move to account…** (déplacer vers un compte…) | Déplace le modèle vers un autre compte. Il utilise alors la clé de ce compte. |
| **Folder** (dossier) | Range le modèle dans un dossier. |
| **Duplicate** | Fait une copie complète avec les mêmes réglages. |
| **Add to Shuffle** (ajouter à Shuffle) / **Remove from Shuffle** (retirer de Shuffle) | Voir [Shuffle](#shuffle). |
| **Change picture** (changer l'image) | Ouvre les choix d'image. |
| **Remove** (retirer) | Supprime le modèle après confirmation. La confirmation liste ce qui l'utilise. |

Quand tu déplaces un modèle, son nom, son image, ses tâches et ses chats le suivent, et les options propres au service sont réinitialisées.

Sur un ordinateur, tu peux faire glisser une ligne de modèle sur un chat pour utiliser ce modèle dans le chat.

<a id="folders"></a>

## Dossiers

Les dossiers regroupent tes modèles, par exemple **RP** et **Work**. Choisis **Group by folder** dans **More actions** pour les afficher. Un modèle se trouve dans un seul dossier.

1. Clique sur **⋯** sur un modèle et choisis **Folder**.
2. Choisis un dossier, ou clique sur **New folder…** (nouveau dossier…), tape un nom et clique sur **Create** (créer).

Un dossier peut avoir une icône et une couleur. Pour renommer ou supprimer un dossier, ouvre son menu **⋯**. Supprimer un dossier garde ses modèles, sous **Not in a folder** (hors dossier).

## Shuffle

Shuffle permet à un chat de choisir un modèle différent chaque fois qu'il écrit une réponse. Sers-t'en pour répartir les requêtes entre plusieurs services ou modèles.

1. Clique sur **⋯** sur chaque modèle que tu veux inclure dans Shuffle et choisis **Add to Shuffle**.
2. Dans un chat, ouvre **Model for this chat** depuis la zone de saisie du chat, ou **Chat Settings → Connection → Model** (réglages du chat → connexion → modèle), et choisis **Shuffle**.

Chaque réponse pioche alors un modèle au hasard parmi ceux que tu as ajoutés à Shuffle.

Si le modèle choisi pour une réponse échoue et que **Main** a un modèle **If it fails** (en cas d'échec), c'est ce modèle qui écrit la réponse. Un avis nomme le modèle qui a échoué et une courte raison, comme "key rejected", "rate limited" ou "not found". La réponse garde une petite étiquette **Fallback** (secours). Touche-la, ou pointe dessus, pour revoir la même ligne.

Un choix dans **Model for this chat** ne change que ce chat. Pour changer le modèle des nouveaux chats, définis **Main** dans l'encadré **Jobs**.

<a id="export-and-import"></a>

## Exporter et importer

Tu peux exporter des comptes dans un fichier pour les sauvegarder ou les transférer vers une autre installation, puis les importer plus tard.

> **Avertissement :** les exports n'incluent jamais les clés API. Après l'import, ouvre chaque compte et saisis de nouveau sa clé. Ne partage jamais une clé avec qui que ce soit.

- **Exporter un seul modèle :** ouvre-le avec **Edit model** et clique sur **Export model** (exporter le modèle).
- **Tout exporter :** ouvre **More actions** et choisis **Export all accounts**. Marinara te rappelle que le fichier ne contient aucune clé. Clique sur **Export** (exporter).
- **Importer :** ouvre **More actions** et choisis **Import account**. Dépose un ou plusieurs fichiers (`.json`, `.jsonl` ou `.zip`) sur la fenêtre, ou clique pour aller les chercher. Cela inclut le fichier `marinara-connections.zip` que tu as exporté. Chaque compte importé a une clé vide tant que tu ne l'as pas renseignée.

Un modèle seul est téléchargé sous la forme d'un fichier `.connection.json`. Plusieurs sont téléchargés ensemble dans `marinara-connections.zip`. Les étoiles sont incluses. Le catalogue de modèles du service ne l'est pas : il se recharge donc la première fois que tu ouvres les modèles du compte.

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Vue d'ensemble des réglages du chat](../chats/chat-settings.md)
