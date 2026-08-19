# Sauvegarder et restaurer Marinara

Ce guide explique les deux façons d'enregistrer une copie de tout ce que contient Marinara Engine, et comment remettre cette copie en place plus tard. Sers-t'en avant une mise à jour, un changement d'appareil ou une réinitialisation de tes données.

## Deux façons d'enregistrer tes données

Marinara propose deux options d'enregistrement. Elles se trouvent à des endroits différents et ne rendent pas le même service.

- Le bouton **Download Backup** (télécharger la sauvegarde) crée une archive **.zip** complète de tout ce qui se trouve sur le disque. Un **.zip** est un fichier compressé unique qui en contient beaucoup d'autres. C'est la copie la plus complète, et la meilleure protection contre la perte de données.
- Le bouton **Export Profile** (exporter le profil) crée un fichier plus léger, avec les données de ton compte (personnages, personas, chats, lorebooks, presets, agents, thèmes et Personal Extensions). Un profil, c'est la copie portable de ton compte au format Marinara. Tu peux le restaurer plus tard depuis Marinara.

S'il te faut simplement une copie sûre de l'ensemble, choisis **Download Backup**. Passe par **Export Profile** quand tu veux un fichier plus petit, ou une version lisible par d'autres outils de roleplay.

Les deux options se trouvent dans **Settings** (Paramètres), sous l'onglet **Advanced**, à la section **Backup & Export**.

## Accès depuis le même appareil ou depuis un autre

Sur l'ordinateur qui fait tourner Marinara, ces outils fonctionnent tout de suite. C'est le cas dit "loopback" : tu as ouvert l'application sur `localhost` ou `127.0.0.1`, sur la même machine.

Depuis un téléphone, une tablette ou n'importe quel autre appareil, la sauvegarde et la restauration réclament le secret **Admin Access** (accès administrateur). Définis ce secret sur le serveur, puis colle la même valeur dans **Settings**, sous l'onglet **Advanced**, à la rubrique **Admin Access**. Voir le guide d'accès à distance en lien à la fin de la page.

## Download Backup

Le bouton **Download Backup** crée un seul fichier **.zip** avec la base de données, les réglages et tous les dossiers de médias (avatars, sprites, arrière-plans, images de la galerie, polices, ton son de notification personnalisé, et plus encore).

1. Ouvre **Settings**.
2. Va dans l'onglet **Advanced**.
3. Repère la section **Backup & Export**.
4. Clique sur **Download Backup**.
5. Pendant le traitement, le bouton affiche **Creating backup…**.
6. Quand l'archive est prête, Marinara la transmet directement au navigateur sans conserver le fichier entier dans la mémoire de la page.
7. Selon tes réglages de téléchargement, le navigateur ouvre sa fenêtre **Save As** habituelle ou place le fichier dans le dossier de téléchargements.

Cette étape compte surtout sur Android et iOS. Sur ces appareils, le dossier de données de l'application est rarement accessible. **Download Backup** devient donc le seul moyen simple de sortir une copie de l'appareil. Range-la dans un endroit sûr et privé, ton propre stockage cloud par exemple.

Le **.zip** contient aussi un fichier texte nommé `RESTORE.txt`. Il explique comment récupérer les données à la main, si le besoin s'en présente. Traite la sauvegarde comme un fichier privé : elle peut renfermer les fichiers secrets qui déverrouillent tes clés API enregistrées. Pour savoir ce que contient chaque dossier, consulte le guide sur l'emplacement des données, en lien plus bas.

## Sauvegardes automatiques

La section **Backup & Export** peut aussi créer une sauvegarde complète automatique et tournante, sur l'appareil qui fait tourner Marinara.
Active **Automatic Backups**, choisis **Daily**, **Weekly** ou **Monthly**, puis règle **Automatic backups kept** sur une valeur
comprise entre 1 et 9999. Marinara crée la première sauvegarde peu après l'activation. Après chaque exécution réussie, il
conserve le nombre configuré d'archives automatiques les plus récentes et supprime l'archive automatique excédentaire la plus
ancienne. Cette limite de conservation ne supprime jamais les sauvegardes manuelles ni celles enregistrées avec **Download Backup**.

Les sauvegardes automatiques sont enregistrées dans `backups/`, dans le dossier de données de Marinara. L'archive la plus récente
porte le nom `marinara-automatic-backup.zip` ; les anciennes archives automatiques conservées emploient des noms de fichiers
horodatés. Elles utilisent le même format d'archive restaurable et diffusée en flux que **Download Backup**, médias téléversés
compris, ainsi que le fichier de clé de chiffrement quand il existe. Garde une copie séparée hors du dossier de données de
Marinara pour te protéger d'un disque perdu, d'un stockage d'application effacé ou d'une réinitialisation de l'appareil.

## Export Profile

Le bouton **Export Profile** crée un fichier plus petit, avec les données de ton compte. Les médias sont inclus : avatars, images et son de notification personnalisé suivent aussi.

1. Ouvre **Settings**.
2. Va dans l'onglet **Advanced**.
3. Repère la section **Backup & Export**.
4. Clique sur **Export Profile**.
5. Une fenêtre intitulée **Export Profile** s'ouvre, avec deux choix.
6. Choisis un format (voir juste après).
7. Le fichier se télécharge sur ton appareil.

La fenêtre propose deux formats :

| Format | De quoi il s'agit | Restaurable dans Marinara ? |
| --- | --- | --- |
| **Marinara Native** | Conserve les champs Marinara, les dossiers de lorebooks, les données de personnages et de personas, les presets, les agents, les thèmes, les brouillons de Personal Extension et les médias intégrés. | Oui |
| **Compatible JSON** | Fichiers simples de personnages, de personas et de lorebooks, destinés à d'autres outils de roleplay. | Non |

Choisis **Marinara Native** pour garder une copie restaurable ensuite dans Marinara. Les profils légers se téléchargent sous le nom
`marinara-profile.json` ; les plus lourds sont proposés sous forme d'archive `marinara-profile.zip` diffusée en flux, dont les données sont réparties dans
des fichiers de table de taille limitée : une grande bibliothèque n'a donc pas besoin de tenir dans une seule chaîne JSON en mémoire.

Le code des Personal Extensions est conservé dans un profil natif, mais ni leur état d'activation ni leur autorisation d'exécution. Chaque extension restaurée arrive désactivée et doit être réexaminée dans **Settings** > **Addons**.

Ne choisis **Compatible JSON** que pour transférer des personnages ou des lorebooks vers un autre outil. Le téléchargement est un **.zip** de fichiers simples. Ce fichier ne se restaure pas dans Marinara avec **Import Profile**.

## Restaurer avec Import Profile

Pour remettre en place un profil enregistré ou une archive **Download Backup**, utilise **Import Profile** (importer le profil). Il se trouve sur un autre onglet que les outils d'enregistrement.

1. Ouvre **Settings**.
2. Va dans l'onglet **Imports**.
3. Repère la section **Profile & Marinara**.
4. Clique sur **Import Profile (JSON/ZIP)**.
5. Choisis le fichier. Ce peut être un `marinara-profile.json`, un `marinara-profile.zip` ou un **.zip** complet issu de **Download Backup**.
6. Marinara analyse d'abord le fichier. Le bouton affiche **Scanning Profile...**.
7. Une fenêtre intitulée **Import Profile** apparaît. Elle liste ce qu'elle a trouvé, par exemple le nombre de personnages et de personas.
8. La fenêtre prévient que l'import est irréversible. Lis-la, puis clique sur **Import** pour continuer, ou sur **Cancel** pour arrêter.
9. L'import se lance et affiche **Importing Profile...** avec une barre de progression.

Un profil Marinara récent se restaure en faisant correspondre l'identité propre de chaque élément, et non son nom. Si tu importes deux fois le même profil, Marinara met à jour les éléments existants sur place au lieu de créer des doublons.

Les très anciens fichiers de profil (issus de versions bien plus vieilles) n'ont pas ce comportement. En réimporter un peut créer des personnages, des personas et des lorebooks en double. Si tu ne restaures que des exports récents, tu ne rencontreras pas ce problème.

Si tu choisis le fichier, puis le modifies sur le disque avant de confirmer, l'import s'arrête avec un avertissement. Il suffit de le sélectionner à nouveau.

S'il manque des fichiers de médias dans un **.zip**, l'import se termine quand même. Un avertissement orange liste les fichiers manquants, et tout le reste est importé.

## Après la restauration : ressaisir tes clés

**Export Profile** retire les valeurs secrètes du fichier de profil. Les clés API et les liens de webhook enregistrés y sont vides. Le fichier de profil peut donc être conservé et partagé sans risque. Une clé API, c'est le mot de passe qui relie Marinara à un fournisseur d'IA.

Une archive **Download Backup**, c'est autre chose. Marinara n'en retire pas les secrets. Le **.zip** de sauvegarde est une copie brute de tes données. Il contient les clés enregistrées et le fichier secret capable de les déverrouiller. Ne partage jamais un **.zip** de sauvegarde. Range-le dans un endroit privé.

**Import Profile** restaure à partir du fichier de profil, même quand tu sélectionnes un **.zip** de sauvegarde. L'archive en contient une copie, et c'est cette copie que l'import lit. Les éléments créés par l'import arrivent donc avec des clés et des liens de webhook vides.

Après l'import d'un profil, procède ainsi :

1. Ouvre **Settings**.
2. Va dans l'onglet **Connections**.
3. Ressaisis la clé API de chaque fournisseur que tu utilises.

Si tu utilises des outils personnalisés qui appellent un lien de webhook, ressaisis aussi ce lien sur chacun d'eux.

L'import n'efface pas les clés déjà en place. Si tu réimportes un ancien profil, Marinara conserve les clés et les liens de webhook actifs sur les éléments qui existent toujours. Un réimport ne les vide pas.

## La liste Existing backups

La section **Backup & Export** peut afficher une liste **Existing backups** (sauvegardes existantes), avec un bouton de suppression. Dans un usage normal, cette liste reste vide. **Download Backup** enregistre le fichier directement sur ton appareil. Il n'en laisse pas de copie dans cette liste, et le réglage **Automatic Backups** gère à la place le nombre configuré d'archives automatiques conservées. Cette liste n'est pas nécessaire pour créer ou conserver une sauvegarde téléchargée.

## Guides associés

- [Où Marinara enregistre tes données](where-data-is-stored.md)
- [Effacer ou réinitialiser tes données](clearing-data.md)
- [Mettre à jour Marinara Engine](../UPGRADING.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Accès à distance : authentification basique et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
