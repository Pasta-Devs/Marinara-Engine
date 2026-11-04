# Polices personnalisées et Google Fonts

Change la police que Marinara utilise dans toute l'application. Choisis la police intégrée, ajoute tes propres fichiers de police, ou télécharge une police depuis Google Fonts en indiquant son nom.

## Choisir la police de l'application

1. Ouvre **Settings** (Paramètres) et clique sur l'onglet **Appearance** (Apparence), puis sur le bouton **App** (Application).
2. Repère la section **Text & Scale** (texte et échelle).
3. Ouvre le menu déroulant **Font** (police) et choisis une police.

Le moyen le plus simple d'obtenir une nouvelle police, c'est [Google Fonts](#downloading-from-google-fonts). La valeur par défaut est **Default (Inter)**, une police sobre retenue pour le confort de lecture à l'écran. Les polices que tu ajoutes apparaissent dans ce même menu déroulant, sous celle-ci.

Ton choix de police se synchronise entre les appareils. Tous les navigateurs connectés au même serveur Marinara l'adoptent. Voir [Vue d'ensemble des paramètres](../settings/settings-overview.md).

Les widgets du chat ont leur propre réglage **Font**, sous **Chat widget style** (style des widgets du chat). Active **Apply preset font** (appliquer la police du preset) au même endroit pour l'utiliser aussi dans les messages, les champs de saisie et les contrôles du chat. Voir [Styles de fenêtres de chat prêts à utiliser](custom-css-themes.md#ready-made-chat-window-styles).

## Ajouter tes propres polices

Avant de commencer : les polices se placent dans un dossier sur le serveur. Le serveur, c'est l'ordinateur qui exécute Marinara. Si tu fais tourner Marinara sur ton propre ordinateur, c'est lui le serveur, et le dossier de données est l'endroit où Marinara garde tes données.

1. Clique sur **Open Fonts Folder** (ouvrir le dossier des polices), à côté du menu déroulant **Font**, pour ouvrir `data/fonts/` sur le serveur. Ou repère toi-même le dossier `data/fonts/` dans le dossier de données de Marinara.
2. Copie ton fichier de police dedans.
3. Va dans **Settings → Appearance → App → Text & Scale** (Paramètres → Apparence → Application → Texte et échelle).
4. Ouvre le menu déroulant **Font**. Ta police figure dans la liste.
5. Sélectionne-la. Le texte de l'application change aussitôt.

Marinara lit les fichiers `.ttf`, `.otf`, `.woff` et `.woff2`, et ignore les autres types. Il compose le nom d'affichage à partir du nom de fichier : `OpenSans-Bold.ttf` apparaît donc sous la forme "Open Sans". Nomme tes fichiers clairement pour avoir une liste bien rangée.

Tous les appareils qui se connectent au même serveur peuvent utiliser les polices de `data/fonts/`.

Si ça n'a pas marché : vérifie le type de fichier, et vérifie que le fichier se trouve dans `data/fonts/` sur le serveur, pas sur l'appareil depuis lequel tu consultes Marinara.

<a id="downloading-from-google-fonts"></a>

## Télécharger depuis Google Fonts

Le serveur a besoin d'un accès à Internet pour cela.

1. Va dans **Settings → Appearance → App → Text & Scale**.
2. Dans le champ **Google Fonts**, saisis le nom exact de la police, par exemple `Fira Code` ou `Lora`.
3. Clique sur **Add** (ajouter).
4. Attends la fin du téléchargement. La police apparaît alors dans le menu déroulant **Font**.

Le lien **Browse fonts at fonts.google.com →**, à côté du champ, ouvre le site Google Fonts pour que tu puisses y rechercher les noms. Le nom accepte uniquement des lettres, des chiffres et des espaces. Télécharger à nouveau la même police remplace l'ancienne copie.

Si ça n'a pas marché, lis le message d'erreur.

- Si Marinara n'arrive pas à joindre Google Fonts, vérifie ta connexion Internet.
- S'il indique que la police est introuvable, vérifie l'orthographe, et vérifie sur le site Google Fonts que la police propose un style Regular (400). Marinara ne télécharge que cette graisse.

## Open Fonts Folder

Le bouton **Open Fonts Folder**, à côté du menu déroulant **Font**, ouvre `data/fonts/` dans l'explorateur de fichiers de l'ordinateur serveur, pas sur l'appareil que tu utilises. Si tu fais tourner Marinara sur ton propre ordinateur, il t'ouvre le dossier. Depuis un téléphone ou un second ordinateur, copie toi-même tes fichiers de police dans le dossier `data/fonts/` du serveur.

Tant que la police par défaut est sélectionnée, les champs de prompt de l'éditeur de presets et le champ Example Dialogue d'un personnage utilisent une police à chasse fixe. Toute autre police s'applique aussi à eux. Les autres champs de prompt, comme le modèle de prompt d'un agent, restent en chasse fixe.

## Guides associés

- [Réglages d'apparence](appearance-settings.md)
