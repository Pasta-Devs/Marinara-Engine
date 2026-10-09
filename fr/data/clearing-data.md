# Effacer ou réinitialiser tes données

Ce guide explique comment supprimer définitivement tes données dans Marinara Engine grâce à la section **Danger Zone** (zone de danger). Tu peux effacer quelques catégories seulement ou tout supprimer. Aucun retour en arrière n'est possible : lis d'abord les avertissements.

## Où se trouve la Danger Zone

Les outils d'effacement sont tous réunis au même endroit.

1. Ouvre **Settings** (Paramètres).
2. Va sur l'onglet **Advanced** (Avancé).
3. Descends jusqu'à la section **Danger Zone**, tout en bas.

La description de la **Danger Zone** indique : "Permanently clear selected categories of local data. Professor Mari is always preserved."

Si tu utilises Marinara depuis un autre appareil que l'ordinateur qui fait tourner l'application, l'effacement demande un accès administrateur. La marche à suivre est décrite dans [Accès à distance](../REMOTE_ACCESS.md).

## Fais une sauvegarde avant d'effacer

Un effacement est irréversible. Il n'y a ni corbeille ni panier de récupération. Une fois que tu confirmes, les données sont perdues.

Commence par créer une sauvegarde : tu pourras ainsi restaurer les données si tu changes d'avis. Voir [Sauvegarder et restaurer Marinara](backup-and-restore.md).

## Les huit catégories de données

La **Danger Zone** affiche une liste de huit catégories à cocher. Chacune forme un périmètre indépendant. Cocher une catégorie ne touche pas aux autres.

| Catégorie | Ce qui est effacé |
|---|---|
| **Chats & Messages** | Les chats, les dossiers, les messages, les données de scène et hors-personnage, ainsi que l'état d'exécution du chat. |
| **Characters** | Les personnages et les groupes de personnages. Professor Mari est toujours conservée. |
| **Personas** | Les personas et les groupes de personas. |
| **Lorebooks** | Les lorebooks et leurs entrées. |
| **Presets** | Les presets de prompt, les groupes, les sections et les variables. |
| **Connections** | Les connexions API et les points d'accès des modèles. |
| **Automation & Addons** | Les agents, les outils, les scripts regex, les thèmes synchronisés et l'état de l'automatisation. |
| **Media & Assets** | Les arrière-plans, les avatars, les sprites, les éléments de la galerie, les polices et les fichiers de sources de connaissances. |

Certaines catégories vont plus loin que les enregistrements en base de données. **Chats & Messages** supprime aussi tout le dossier de galerie présent sur le disque, ainsi que les fichiers vidéo de scène. Cela inclut les images de galerie des personnages et des personas, même si tu n'as coché ni **Characters** ni **Personas**. **Media & Assets** supprime les dossiers présents sur le disque pour les arrière-plans, les avatars, les sprites, les galeries, les fichiers vidéo de scène, les polices et les fichiers de sources de connaissances. **Connections** efface également les réglages Text to Speech (TTS, synthèse vocale) et Speech to Text (reconnaissance vocale) enregistrés, car ils sont liés à une connexion.

## Effacer certaines catégories

Utilise cette méthode pour supprimer une partie des données et garder le reste.

1. Coche la case de chaque catégorie à supprimer.
2. Pour cocher ou décocher toutes les cases d'un coup, utilise le bouton **Select All** (tout sélectionner). Quand toutes les cases sont cochées, ce même bouton devient **Clear Selection** (effacer la sélection) pour tout décocher.
3. Clique sur **Clear Selected Data** (effacer les données sélectionnées). Ce bouton reste désactivé tant qu'aucune catégorie n'est cochée.
4. Un encadré d'avertissement apparaît. Il précise le nombre de catégories choisies et rappelle qu'aucun retour en arrière n'est possible.
5. Clique sur **Cancel** (annuler) pour renoncer, ou sur **Confirm Delete** (confirmer la suppression) pour supprimer. Rien n'est supprimé tant que tu n'as pas cliqué sur **Confirm Delete**.

Une fois l'effacement réussi, un message de confirmation s'affiche. Il indique que les données sélectionnées ont été effacées et que les caches d'exécution ont été réinitialisés immédiatement.

## Tout effacer

Utilise cette méthode pour vider les huit catégories en une seule fois.

1. Clique sur **Clear All Data** (tout effacer). Inutile de cocher quoi que ce soit au préalable.
2. Un encadré d'avertissement demande : "Delete all supported data categories except Professor Mari? There is no undo."
3. Clique sur **Cancel** pour renoncer, ou sur **Confirm Delete** pour tout supprimer.

Le résultat est le même que si tu cochais toutes les cases avant de les effacer ensemble.

## Professor Mari est toujours conservée

Professor Mari est l'assistante intégrée de l'application. Cette fonctionnalité ne la supprime jamais. Même si tu effaces la catégorie **Characters** ou que tu utilises **Clear All Data**, Professor Mari reste en place. Impossible de la retirer depuis la **Danger Zone**.

## Guides associés

- [Sauvegarder et restaurer Marinara](backup-and-restore.md)
- [Accès à distance](../REMOTE_ACCESS.md)
