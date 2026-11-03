# Sauvegarder et restaurer Marinara

Fais une copie de tes données Marinara Engine, puis remets-la en place plus tard. Fais-le avant une mise à jour, un changement d'appareil ou [l'effacement de tes données](clearing-data.md).

## Laquelle choisir

| Option | Ce qu'elle crée | À utiliser pour |
| --- | --- | --- |
| **Download Backup** (télécharger la sauvegarde) | Un `.zip` avec toutes tes données et tes fichiers. | Une copie complète de tout. |
| **Export Profile** (exporter le profil) | Un fichier plus petit avec les données de ton compte (personnages, chats, lorebooks et plus). | Une copie sans secrets, ou des fichiers pour d'autres outils. |

Un `.zip` est un seul fichier qui en contient beaucoup d'autres. Les deux options sont dans **Settings → Advanced → Backup & Export** (Paramètres → Avancé → Sauvegarde et export). La restauration est dans **Settings → Imports → Profile & Marinara**.

**Avant de commencer :** sur l'ordinateur qui exécute Marinara, ces outils fonctionnent tout de suite. Depuis un téléphone, une tablette ou tout autre appareil, définis le secret d'administration sur le serveur et saisis la même valeur dans **Settings → Advanced → Admin Access**. Le secret d'administration est un mot de passe dans le fichier `.env` du serveur, sous le nom `ADMIN_SECRET`. Voir la section "Privileged APIs (ADMIN_SECRET)" de la [référence de configuration du serveur](../CONFIGURATION.md) et l'[accès à distance](../REMOTE_ACCESS.md).

## Download Backup

1. Ouvre **Settings → Advanced**.
2. Dans **Backup & Export**, clique sur **Download Backup**. Le bouton affiche **Creating backup...**.
3. Enregistre le fichier quand ton navigateur le demande, ou trouve-le dans ton dossier Téléchargements.

Le `.zip` contient :

- tes données texte enregistrées (personnages, chats, lorebooks, presets, connexions, réglages) ;
- tes fichiers téléversés et générés, comme les avatars, les sprites, les arrière-plans, les images de la galerie, les polices, les emojis et stickers personnalisés, et ton son de notification personnalisé ;
- le fichier `.encryption-key` (clé de chiffrement), quand il existe ;
- une note `RESTORE.txt` sur la restauration manuelle des fichiers (voir [Restaurer à la main](#restore-by-hand)).

Pour les noms des dossiers, voir [Où Marinara enregistre tes données](where-data-is-stored.md).

> **Avertissement :** une sauvegarde contient tes clés API enregistrées et le fichier `.encryption-key` qui les déverrouille. Ne la partage jamais. Garde-la dans un endroit privé.

Sur Android, tu ne peux pas atteindre le dossier de données de l'application. **Download Backup** est donc le moyen de sortir une copie de l'appareil.

Si ça n'a pas marché : si tu vois "Backup preparation timed out after one hour.", réessaie. Si un autre appareil ne peut pas télécharger, vérifie **Admin Access** (voir plus haut).

<a id="automatic-backups"></a>

## Sauvegardes automatiques

Marinara peut faire une sauvegarde complète selon un calendrier, sur l'ordinateur qui l'exécute.

1. Ouvre **Settings → Advanced → Backup & Export**.
2. Active **Automatic backups**.
3. Choisis **Daily**, **Weekly** ou **Monthly**.
4. Règle **Automatic backups kept** sur une valeur de 1 à 9999.

Marinara fait la première sauvegarde peu après l'activation. Après chaque exécution, il garde les sauvegardes les plus récentes jusqu'à ton nombre et supprime les plus anciennes. Il ne supprime jamais les sauvegardes que tu as faites avec **Download Backup**.

Les sauvegardes automatiques sont dans le dossier `backups/` à l'intérieur du dossier de données. La plus récente s'appelle `marinara-automatic-backup.zip`. Les plus anciennes ont une date et une heure dans leur nom. Elles ont le même format que **Download Backup**.

Chaque exécution a besoin d'assez d'espace libre pour une archive complète de plus, parce que l'ancienne reste jusqu'à la fin de la nouvelle. Si la place manque, Marinara saute l'exécution et affiche la raison à côté du réglage. Il réessaie quand de l'espace se libère.

> **Astuce :** garde une deuxième copie en dehors du dossier de données. Un disque perdu ou une application effacée supprime aussi les sauvegardes automatiques.

## Exporter un profil

1. Ouvre **Settings → Advanced → Backup & Export**.
2. Clique sur **Export Profile**. Une fenêtre avec le même titre s'ouvre.
3. Choisis un format.
4. Ton navigateur télécharge le fichier.

- **Marinara Native** garde tes personnages, personas, chats, lorebooks, presets, agents, thèmes, le code des Personal Extensions et les médias. Il ne restaure pas les clés API, les liens de webhook ni certains réglages de chat (voir [Saisis à nouveau tes clés](#enter-your-keys-again)). Tu peux le restaurer dans Marinara.
- **Compatible JSON** crée un `.zip` de fichiers simples de personnages, de personas et de lorebooks pour d'autres outils. Tu ne peux pas le restaurer dans Marinara.

Un profil natif se télécharge sous le nom `marinara-profile.json`. S'il est trop gros, Marinara propose une archive ZIP à la place. Clique sur **Export ZIP** pour télécharger `marinara-profile.zip`.

Un profil natif garde le code des Personal Extensions, mais pas le fait qu'elles soient activées ou approuvées. Chaque extension restaurée arrive désactivée. Vérifie-la à nouveau dans **Settings → Addons**.

## Restaurer avec Import Profile

**Import Profile** (importer un profil) charge un profil enregistré ou un `.zip` de **Download Backup**.

1. Ouvre **Settings → Imports**.
2. Dans **Profile & Marinara**, clique sur **Import Profile (JSON/ZIP)**.
3. Choisis `marinara-profile.json`, `marinara-profile.zip` ou un `.zip` de sauvegarde. Le bouton affiche **Scanning Profile...**.
4. Lis la fenêtre **Import Profile**. Elle liste ce que Marinara a trouvé et te prévient que tu ne peux pas annuler l'import.
5. Clique sur **Import**, ou sur **Cancel** pour arrêter. Le bouton affiche **Importing Profile...** et une barre de progression suit. Quand c'est fini, un message indique que le profil a été importé.

Si ça n'a pas marché :

- Sauf si tu ouvres Marinara à `localhost`, `127.0.0.1` ou `[::1]`, l'import de profil a besoin de HTTPS. L'erreur est "Profile import requires HTTPS outside local development." Ouvre Marinara avec une adresse HTTPS.
- Si un `.zip` n'a pas quelques fichiers média, l'import se termine quand même. Un avertissement liste ce qui manque, et Marinara importe le reste.

Si tu importes deux fois le même profil, Marinara met à jour tes éléments et ne les copie pas. Les profils de versions bien plus anciennes peuvent créer des doublons.

<a id="enter-your-keys-again"></a>

## Saisis à nouveau tes clés

**Import Profile** ne ramène jamais les clés API ni les liens de webhook, même depuis un `.zip` de **Download Backup**. Une clé API est le code secret que te donne un service. Le fichier de profil et le profil dans une sauvegarde ont ces valeurs vides. Après un import sur un nouvel ordinateur, tu dois donc saisir tes clés à nouveau :

1. Ouvre **Connections** (connexions) dans la barre du haut.
2. Ouvre chaque compte que tu utilises, saisis sa clé API et enregistre. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).
3. Saisis à nouveau le lien de webhook sur chaque outil personnalisé qui en utilise un.

Certains réglages de chat avec des adresses ou des clés (Discord, DeepL, Intiface) reviennent aussi vides. Saisis-les à nouveau dans les **Chat Settings** (réglages du chat) de chaque chat.

L'import ne vide jamais les clés que tu as déjà sur la même installation.

## Déménager vers un nouvel ordinateur

1. Installe Marinara sur le nouvel ordinateur et démarre-le. Voir [Installation](../INSTALLATION.md).
2. Ouvre **Settings → Imports → Profile & Marinara** et clique sur **Import Profile (JSON/ZIP)**.
3. Choisis le `.zip` de **Download Backup** ou ton fichier de profil, puis clique sur **Import**.
4. Saisis à nouveau tes clés API, comme décrit plus haut.

Le fichier de clé dans une sauvegarde ne sert que si tu copies tout le dossier de données à la main, comme ci-dessous.

<a id="restore-by-hand"></a>

## Restaurer à la main

Utilise ceci seulement si **Import Profile** ne peut pas être utilisé. Le `.zip` contient un dossier, par exemple `marinara-backup-...`, avec une note `RESTORE.txt`.

1. Arrête Marinara.
2. Dézippe la sauvegarde.
3. Copie les dossiers et le fichier `.encryption-key` du dossier dézippé dans ton dossier de données. Voir [Où Marinara enregistre tes données](where-data-is-stored.md).
4. Démarre Marinara.

Garde le fichier `.encryption-key` avec le dossier `storage`, sinon les clés API enregistrées ne peuvent pas être lues.

La liste **Existing backups** (sauvegardes existantes) dans **Backup & Export** est normalement vide. Tu n'en as pas besoin.

## Guides associés

- [Où Marinara enregistre tes données](where-data-is-stored.md)
- [Effacer ou réinitialiser tes données](clearing-data.md)
- [Mettre à jour Marinara Engine](../UPGRADING.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
