# Exporter et importer des chats

Enregistre un chat dans un fichier, partage-le sous forme d'histoire lisible, ou recharge un fichier de chat venant de Marinara ou de SillyTavern (une autre application de chat pour le roleplay). Tu peux exporter un seul chat, une partie d'un chat ou plusieurs chats d'un coup.

<a id="file-formats-you-will-see"></a>

## Les formats de fichier que tu vas croiser

| Format | Ce que c'est | Réimportable ? |
| --- | --- | --- |
| **JSONL** | JSON Lines, un fichier texte brut avec un message par ligne. C'est le format par défaut. | Oui |
| **Text** | Une transcription `.txt` lisible. | Non |
| **Markdown** | Un fichier `.md` lisible. Il commence par le nom du chat et les dates qu'il couvre, puis présente chaque message sous le nom de son auteur. | Non |
| **Story** | Une page web `.html` mise en forme, avec le nom et l'avatar de chaque auteur. Ouvre-la dans un navigateur pour la lire, la partager ou l'imprimer. | Non |

Les fichiers **Markdown** et **Story** laissent de côté les messages système et les messages qui te sont masqués. L'import de chat accepte uniquement les fichiers `.jsonl` : exporte donc en **JSONL** si tu veux importer le chat plus tard.

Un fichier **JSONL** laisse de côté quelques adresses enregistrées avec le chat : le webhook du miroir Discord, l'adresse DeepLX, la clé DeepL et l'adresse Intiface. L'import ne les ramène jamais non plus. Saisis-les de nouveau dans **Chat Settings** (réglages du chat) du chat importé si tu t'en sers.

## Exporter un seul chat

1. Ouvre le chat.
2. Ouvre **Chat Settings** et déplie **Chat Branches** (branches du chat), sous **Chat Name** (nom du chat). Les boutons d'export se trouvent dans cette section, même si le chat n'a qu'une seule branche.
3. Touche **JSONL**, **Text**, **Markdown** ou **Story**.

Ton navigateur télécharge le fichier. Il contient la branche que tu consultes, avec ses messages.

<a id="export-part-of-a-chat"></a>

## Exporter une partie d'un chat

Utilise **Export a range** (exporter une plage) pour n'enregistrer que certains messages. Cette option n'est pas disponible dans les chats Game.

1. Dans **Chat Branches**, clique sur **Export a range**.
2. Clique sur le premier message, puis sur le dernier. Une indication affiche "Select the first and last message to export."
3. Clique sur **Export selected** (exporter la sélection).
4. Dans la boîte de dialogue **Export messages** (exporter les messages), vérifie le nombre de messages ainsi que le premier et le dernier message, puis choisis **Text**, **Markdown**, **JSONL** ou **Story**.

Marinara exporte tous les messages, du premier au dernier que tu as choisis. Clique sur **Cancel** (annuler) pour arrêter sans exporter.

## Exporter plusieurs chats d'un coup

1. Dans la barre latérale de gauche, clique sur l'onglet du mode voulu : **CONVO**, **RP** ou **GM**. Chaque onglet n'exporte que ses propres chats.
2. Clique sur **Select chats** (sélectionner des chats) en haut de la liste.
3. Clique sur chaque chat voulu. Une barre en bas affiche le décompte, par exemple "3 selected".
4. Clique sur **Export** (exporter) dans la barre.

Ton navigateur télécharge un fichier `.zip` avec une transcription JSONL par chat. L'export groupé utilise toujours **JSONL**. Voir [Gérer ta liste de chats](managing-chats.md#selecting-multiple-chats).

## Importer un chat comme nouveau chat

Cette méthode crée un nouveau chat à partir d'un fichier `.jsonl` enregistré par Marinara ou exporté depuis SillyTavern.

1. Dans la barre latérale de gauche, clique sur l'onglet du mode voulu. Le chat importé prend le mode de l'onglet ouvert, pas celui indiqué dans le fichier.
2. Clique sur le bouton **Import** (importer) à côté du bouton **+**. Son libellé est **Import SillyTavern or Marinara chat JSONL**.
3. Choisis ton fichier `.jsonl`.

Le message "Imported N messages" s'affiche, et Marinara ouvre le nouveau chat. Pour aller plus loin avec les fichiers SillyTavern, voir [Importer depuis SillyTavern](../data/importing-from-sillytavern.md).

Si ça n'a pas marché : un petit message en bas de l'écran affiche **Import failed** avec la raison. Vérifie que le nom du fichier se termine par `.jsonl`.

## Importer un chat comme nouvelle branche

Cette méthode charge un fichier `.jsonl` dans un chat que tu as déjà, sous forme de nouvelle branche. Voir [Branches de chat](branches.md).

1. Ouvre le chat qui doit recevoir la branche.
2. Ouvre **Chat Settings**, déplie **Chat Branches** et clique sur **Import**.
3. Choisis ton fichier `.jsonl`.

Le message "Imported N messages as a new branch" s'affiche. La branche reprend les personnages, le persona, la connexion et le preset de prompt du chat ouvert.

## Inclure le raisonnement et les notes privées dans les exports

Deux réglages décident si du texte masqué part dans les fichiers d'export. Ce sont deux interrupteurs de **Settings → Advanced → Message Tools** (Paramètres → Avancé → Outils de message), tous deux désactivés par défaut. Ils s'appliquent aux exports d'un seul chat comme aux exports en `.zip`.

| Réglage | Quand il est activé |
| --- | --- |
| **Include reasoning in exports** (inclure le raisonnement dans les exports) | Ajoute à tous les formats la réflexion enregistrée du modèle. Dans les fichiers **Markdown** et **Story**, elle se trouve dans une section repliable **Thinking** (réflexion), sous le message. |
| **Include private notes in exports** (inclure les notes privées dans les exports) | Ajoute tes notes privées de message aux exports **JSONL** et **Text**. |

> **Avertissement :** laisse les deux désactivés avant de partager une transcription. Le raisonnement masqué et les notes privées peuvent contenir des choses que tu n'avais pas prévu de transmettre.
