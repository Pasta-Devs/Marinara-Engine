# Effacer ou réinitialiser tes données

Supprime définitivement une partie ou la totalité de tes données avec le bouton **Danger Zone** (zone de danger). Il n'y a pas d'annulation. Pour supprimer un seul chat ou un seul personnage, utilise plutôt son propre bouton de suppression. Voir [Gérer les chats](../chats/managing-chats.md) et [Créer et modifier des personnages](../characters/creating-and-editing-characters.md).

**Avant de commencer :** fais une sauvegarde. Il n'y a ni corbeille ni poubelle. Voir [Sauvegarder et restaurer Marinara](backup-and-restore.md). Si tu ouvres Marinara depuis un autre appareil, tu as aussi besoin du secret d'administration. Voir [Accès à distance](../REMOTE_ACCESS.md).

## Effacer certaines catégories

1. Ouvre **Settings → Advanced** (Paramètres → Avancé) et fais défiler jusqu'à **Danger Zone**.
2. Vérifie chaque catégorie que tu veux supprimer. **Select All** (tout sélectionner) coche toutes les cases. Quand tout est coché, le même bouton affiche **Clear Selection** (effacer la sélection) et décoche tout.
3. Clique sur **Clear Selected Data**. Il reste désactivé jusqu'à ce que tu coches une catégorie.
4. Lis l'avertissement. Il indique combien de catégories tu as choisies.
5. Clique sur **Confirm Delete**, ou sur **Cancel**. Rien n'est supprimé avant ta confirmation.

Quand ça marche, un message indique que les données choisies ont été effacées. Si la requête échoue, un message d'erreur apparaît ("Failed to clear selected data."). Certaines données peuvent déjà être effacées, alors vérifie ce qui reste. Vérifie aussi que tu as l'accès d'administration.

## Tout effacer

1. Dans **Danger Zone**, clique sur **Clear All Data**. Tu n'as pas besoin de cocher les cases une par une.
2. L'avertissement demande : "Delete all supported data categories except Professor Mari? There is no undo."
3. Clique sur **Confirm Delete**, ou sur **Cancel** pour arrêter.

Cela revient à cocher les huit cases.

## Les huit catégories de données

Chaque catégorie supprime seulement ce que sa ligne indique, sauf pour le dossier de la galerie noté sous le tableau.

| Catégorie | Ce qu'elle supprime |
| --- | --- |
| **Chats & Messages** | Tous les chats et leur contenu, tout le dossier `gallery` et les vidéos de scène du jeu. |
| **Characters** | Tous les personnages et groupes, sauf Professor Mari, avec leurs avatars. |
| **Personas** | Tous les personas et groupes, avec leurs avatars. |
| **Lorebooks** | Tous les lorebooks, entrées et dossiers. |
| **Presets** | Tous les presets de prompt et dossiers de presets, sauf le preset de base intégré. |
| **Connections** | Tous les comptes enregistrés, et les choix de modèles et de voix liés à eux. |
| **Automation & Addons** | Tous les réglages d'agents, outils personnalisés, scripts regex et thèmes synchronisés. Pas les Personal Extensions ni les External Extensions. |
| **Media & Assets** | Arrière-plans, avatars, sprites, galerie, vidéos de scène, polices et fichiers de sources de connaissances. |

Plus de détails :

- **Chats & Messages** supprime aussi les swipes (plusieurs réponses gardées sur un message), les souvenirs, les résultats d'agents, l'état du jeu et les images de chat.
- **Characters** et **Personas** suppriment aussi les modèles d'avatar 2D et 3D.
- **Presets** supprime aussi leurs groupes, sections et variables. Si un autre preset était celui par défaut, le preset de base devient celui par défaut.
- **Connections** efface aussi la synthèse vocale et la reconnaissance vocale, les modèles que tu as choisis pour des fonctions, et une clé API Tripo enregistrée sur la page **3D Avatars**.
- **Automation & Addons** supprime aussi les résultats d'agents, la mémoire d'agent, les dossiers d'agents et les widgets Home.
- **Media & Assets** supprime aussi la liste des ressources et les images de chat.
- Les fichiers de sources de connaissances sont des fichiers que tu as téléversés pour les agents de connaissances. Les thèmes synchronisés sont tes thèmes personnalisés enregistrés dans Marinara.

Certaines catégories touchent des fichiers hors de leur nom. **Chats & Messages** supprime tout le dossier `gallery`, y compris les images de personnages et de galerie de personas, même si tu n'as pas coché **Characters** ou **Personas**.

L'effacement ne touche pas tes autres réglages, le dossier `backups/` ni le fichier `.encryption-key`. Il laisse aussi les Personal Extensions, les ressources du Game Mode, les emojis et stickers personnalisés, ton son de notification, les images de lorebooks, de presets, d'agents et de comptes, et les fichiers de mémoire à long terme. Voir [Où Marinara enregistre tes données](where-data-is-stored.md).

## Professor Mari reste

Professor Mari est l'assistante intégrée de l'écran Home. La **Danger Zone** ne la supprime jamais, pas même avec **Clear All Data**.

## Guides associés

- [Sauvegarder et restaurer Marinara](backup-and-restore.md)
- [Où Marinara enregistre tes données](where-data-is-stored.md)
- [Accès à distance](../REMOTE_ACCESS.md)
