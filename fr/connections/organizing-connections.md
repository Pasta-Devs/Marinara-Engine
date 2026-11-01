# Organiser les connexions

Ce guide explique comment garder tes comptes et tes modèles bien rangés dans Marinara Engine. Au programme : la liste des comptes, les modèles favoris, le déplacement et le retrait de modèles, les dossiers, Shuffle (le mélange de modèles), et l'export ou l'import. Un compte, c'est une clé, une identification ou une adresse pour un fournisseur d'IA ; un modèle est un modèle d'IA que tu as enregistré depuis ce compte. Pour ajouter un compte, consulte [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md).

## La liste des comptes

Sous l'encadré **Jobs** (tâches), le panneau **Connections** (Connexions) liste tes comptes. Chaque compte affiche son image, son nom, son nombre de modèles et son adresse. Une ligne de modèle affiche l'image du modèle, son nom et des badges, comme la tâche dont il s'occupe (**Main**, **Agents**, **Images**), **Custom settings** (réglages personnalisés), son prix, ou **Plan** (forfait) pour les modèles inclus dans un abonnement.

Clique sur la ligne d'un compte pour replier ses modèles, et clique de nouveau pour les afficher. Marinara se souvient des comptes que tu as repliés. **More actions** (plus d'actions), en haut du panneau, propose **Fold all accounts** (replier tous les comptes) et **Open all accounts** (ouvrir tous les comptes), **Show only Off or Needs key** (afficher seulement les comptes Off ou Needs key) et **Show cost badges** (afficher les badges de coût). Dans un panneau large, le menu déroulant de tri se trouve à côté de **Search models and accounts** (rechercher des modèles et des comptes). Dans un panneau étroit, l'ordre de tri se trouve dans **More actions**.

Un compte passerelle qui donne accès à plusieurs créateurs de modèles, par exemple un proxy ou LinkAPI, regroupe ses modèles sous des intitulés **via**, comme **via NanoGPT**, avec l'icône du créateur concerné.

La carte **Built-in model** (modèle intégré), sous l'encadré Jobs, affiche le modèle qui tourne sur ton ordinateur et son état. Voir [Configuration du Local Model](local-model.md).

### Actions sur un compte

Clique sur **⋯** sur la ligne d'un compte :

- **Edit account** (modifier le compte) ouvre ses réglages : **Name** (nom), **API key** (clé API), **Address** (adresse), **Usage and limits** (utilisation et limites) et **Use this account** (utiliser ce compte).
- **Replace key** (remplacer la clé) colle une nouvelle clé.
- **Test** (tester) vérifie la clé et affiche le résultat.
- **Add model** (ajouter un modèle) ouvre la liste des modèles du compte. **Add image model** (ajouter un modèle d'images) s'affiche pour les fournisseurs qui produisent aussi des images.
- **Select models** (sélectionner des modèles) permet de déplacer ou de supprimer plusieurs modèles d'un coup.
- **Duplicate** (dupliquer) ajoute une copie du compte, avec des copies de ses modèles.
- **Turn off** (désactiver) empêche Marinara d'utiliser le compte jusqu'à ce que tu choisisses **Turn on** (activer).
- **Delete account** (supprimer le compte). Marinara liste d'abord les tâches, les chats et les agents qui utilisent encore ses modèles.

### Icônes des fournisseurs

Chaque compte affiche l'icône de son fournisseur. Les icônes sont livrées avec Marinara, qui ne les charge donc jamais depuis internet. Une adresse personnalisée affiche l'icône d'un serveur ou d'une passerelle connus quand son adresse ou son nom en contient un, par exemple Ollama, LM Studio, KoboldCpp, Bifrost ou LiteLLM. Sinon, elle affiche la première lettre de son nom. Clique sur l'image d'un compte pour choisir la tienne.

## Modèles favoris

Une étoile marque les modèles que tu veux garder sous la main. Les modèles étoilés sont listés sous **Starred** (favoris), près du haut de chaque sélecteur de modèle : les fenêtres **Model for** (modèle pour) de l'encadré **Jobs**, la fenêtre **Model for this chat** (modèle pour ce chat) du chat, et les champs de modèle dans **Chat Settings** (réglages du chat) et dans l'éditeur d'agent.

Pour étoiler un modèle, clique sur son étoile dans la liste **Add model** du compte, ou choisis **Star** (étoiler) dans le menu **⋯** du modèle. Confier une tâche à un modèle l'enregistre aussi.

Pour retirer l'étoile d'un modèle, clique de nouveau dessus. Marinara retire le modèle et affiche **Undo** (annuler) pendant quelques secondes. Un modèle reste, sans son étoile, quand il a encore un rôle dans **Jobs**, qu'il a ses propres réglages ou qu'il est le dernier modèle de son compte. Le message en indique la raison.

## Actions sur un modèle

Clique sur **⋯** sur la ligne d'un modèle :

- **Make default for…** (définir par défaut pour…) confie une tâche au modèle, comme si tu le choisissais dans l'encadré **Jobs**.
- **Edit model** (modifier le modèle) ouvre ses réglages. Cliquer sur la ligne du modèle fait la même chose.
- **Move to account…** (déplacer vers un compte…) déplace le modèle vers un autre compte du même fournisseur, ou vers un nouveau compte. Le modèle utilise alors la clé et le catalogue de ce compte. Les chats qui utilisent le modèle continuent de fonctionner.
- **Folder** (dossier) range le modèle dans un dossier. Les dossiers s'affichent quand tu choisis **Group by folder** (regrouper par dossier) dans **More actions**.
- **Duplicate** fait une copie complète avec les mêmes réglages, sans rien demander.
- **Add to Shuffle** (ajouter à Shuffle) ou **Remove from Shuffle** (retirer de Shuffle).
- **Change picture** (changer l'image).
- **Remove** (retirer) supprime le modèle après confirmation.

Sur un ordinateur, tu peux faire glisser une ligne de modèle sur un chat pour utiliser ce modèle dans le chat.

## Recherche

**Search models and accounts**, en haut du panneau, filtre la liste au fil de la saisie. Quand rien ne correspond, le panneau l'indique.

## Shuffle

Shuffle permet à un chat de choisir un modèle différent chaque fois qu'il écrit une réponse. Pratique pour répartir les requêtes entre plusieurs fournisseurs ou modèles.

Pour ajouter un modèle à Shuffle, choisis **Add to Shuffle** dans son menu **⋯**. Pour qu'un chat utilise Shuffle, ouvre **Model for this chat** depuis la zone de saisie du chat ou depuis **Chat Settings → Connection → Model** (réglages du chat → connexion → modèle), et choisis **Shuffle**. Chaque réponse pioche alors un modèle au hasard parmi ceux de Shuffle.

Si le modèle choisi pour une réponse échoue et que **Main** a un modèle **If it fails** (en cas d'échec), c'est ce modèle qui écrit la réponse. Un avis nomme le modèle qui a échoué et une courte raison, comme "key rejected", "rate limited" ou "not found", pour que tu saches lequel doit être réparé. La réponse garde une petite étiquette **Fallback** (secours) ; touche-la, ou pointe dessus, pour revoir la même ligne.

Un choix dans **Model for this chat** ne change que ce chat. Pour changer le modèle des nouveaux chats, définis **Main** dans l'encadré **Jobs**.

## Exporter et importer

Exporte tes comptes dans un fichier pour les sauvegarder ou les transférer vers une autre installation, puis réimporte-les plus tard.

**Tes clés API ne sont jamais incluses dans un export.** Après l'import, ouvre chaque compte et saisis de nouveau sa clé. Les étoiles sont incluses ; le catalogue du fournisseur ne l'est pas, il se recharge donc la première fois que tu ouvres les modèles du compte.

Pour exporter un seul modèle, ouvre-le avec **Edit model** et clique sur son bouton **Export** (exporter), l'icône de téléversement. Pour tout exporter, ouvre **More actions** et choisis **Export all accounts** (exporter tous les comptes). Avant le début du téléchargement, Marinara te rappelle que le fichier ne contient aucune clé.

Un modèle seul est téléchargé sous la forme d'un fichier `.connection.json`. Plusieurs sont téléchargés ensemble dans un fichier `marinara-connections.zip`.

Pour importer, ouvre **More actions** et choisis **Import account** (importer un compte). Dépose un ou plusieurs fichiers `.json` sur la fenêtre, ou clique pour aller les chercher. Chaque compte importé a une clé vide, tant que tu ne l'as pas renseignée.

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Vue d'ensemble des réglages du chat](../chats/chat-settings.md)
