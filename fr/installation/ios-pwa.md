# Guide PWA pour iOS / iPadOS

Ce guide explique comment utiliser Marinara Engine sur un iPhone ou un iPad. iOS et iPadOS ne savent pas faire tourner le serveur Marinara eux-mêmes. À la place, tu te connectes à un serveur installé sur un autre appareil, puis tu l'enregistres sur l'écran d'accueil sous forme d'application web.

## Sur iOS, le serveur tourne sur un autre appareil

Marinara Engine se compose de deux parties : un serveur qui fait le vrai travail, et une application web que tu consultes dans un navigateur. Sur iPhone et iPad, Apple interdit au serveur de tourner sur l'appareil. Le serveur tourne donc ailleurs, et tu l'ouvres depuis Safari sur ton iPhone ou ton iPad.

Le serveur peut tourner sur l'un ou l'autre de ces supports :

- Un PC Windows (voir le [guide d'installation Windows](windows.md)).
- Une machine Mac ou Linux (voir le [guide d'installation macOS / Linux](macos-linux.md)).
- Un téléphone Android avec Termux (voir le [guide d'installation Android (Termux)](android-termux.md)).
- Un conteneur Docker ou Podman (voir [Lancer via un conteneur](containers.md)).

Ton iPhone ou ton iPad rejoint ce serveur par le réseau. C'est le même principe que l'ouverture d'un site web, sauf que le site web est ton propre serveur Marinara.

## Se connecter depuis Safari

Voici la marche à suivre, une fois le serveur lancé sur l'appareil hôte :

1. Vérifie que l'appareil hôte et ton iPhone ou iPad sont sur le même réseau, ou tous les deux sur le même réseau Tailscale. LAN désigne le réseau local, par exemple le Wi-Fi de la maison. Tailscale est un outil gratuit qui relie tes appareils dans un réseau privé, via internet.
2. Récupère l'adresse du serveur hôte. Elle ressemble à l'exemple ci-dessous. Remplace `<host-ip>` par l'adresse IP LAN ou Tailscale de l'appareil hôte. Le port par défaut est `7860`.

```
http://<host-ip>:7860
```

3. Ouvre **Safari** sur ton iPhone ou ton iPad.
4. Saisis cette adresse dans la barre d'adresse de Safari, puis valide.
5. L'écran d'accueil de Marinara doit se charger dans le navigateur.

Si la page ne se charge pas, ou si un mot de passe t'est demandé, va voir la section Dépannage plus bas. C'est le propriétaire du serveur qui règle l'accès au réseau et les mots de passe. Ces réglages de serveur sont décrits dans le [guide d'accès à distance](../REMOTE_ACCESS.md), et pas sur ton iPhone ou ton iPad.

## Ajouter à l'écran d'accueil

Enregistre Marinara sous forme de PWA pour qu'elle s'ouvre comme une application normale. PWA veut dire Progressive Web App : un site web qui tourne dans sa propre fenêtre, avec sa propre icône sur l'écran d'accueil.

1. Ouvre ton serveur Marinara dans **Safari** (voir les étapes ci-dessus).
2. Touche le bouton de partage. C'est l'icône carrée avec une flèche vers le haut.
3. Fais défiler la feuille de partage, puis touche **Add to Home Screen** (ajouter à l'écran d'accueil).
4. Change le nom si tu le souhaites, puis touche **Add** (ajouter).
5. Une icône Marinara apparaît alors sur l'écran d'accueil.

Touche cette icône pour ouvrir Marinara dans sa propre fenêtre, sans la barre d'adresse de Safari.

## À propos du HTTPS

Les PWA fonctionnent de la façon la plus fiable en HTTPS. HTTPS désigne une connexion web sécurisée et chiffrée, signalée par `https://` au début de l'adresse.

Le HTTP simple sur le LAN reste utilisable dans Safari pour un usage normal. Mais certaines versions d'iOS ou d'iPadOS bloquent une partie du comportement autonome des PWA pour une adresse en `http://` simple. Dans ce cas, sers Marinara en HTTPS.

Tailscale donne à chaque appareil une adresse privée stable et améliore la joignabilité, mais Tailscale seul ne transforme pas une adresse `http://` en HTTPS. Utilise une configuration Tailscale qui sert explicitement le HTTPS, ou demande au propriétaire du serveur de placer Marinara derrière du HTTPS.

Ces options sont expliquées dans le [guide d'accès à distance](../REMOTE_ACCESS.md). Si une adresse en HTTP simple te pose problème en application sur l'écran d'accueil, garde-la plutôt en signet Safari.

## Effacer et réinstaller la PWA

Il arrive que Safari continue d'afficher une ancienne version de l'application, ou que l'application web enregistrée se bloque. Réinstaller l'application de l'écran d'accueil règle en général le problème.

1. Appuie longuement sur l'icône Marinara de l'écran d'accueil.
2. Touche l'option qui retire ou supprime l'application, puis confirme.
3. Ouvre l'application **Settings** (Paramètres) sur ton iPhone ou ton iPad.
4. Touche **Safari**. Sur les versions récentes d'iOS et d'iPadOS, l'entrée se trouve parfois sous **Apps**, puis **Safari**.
5. Touche **Advanced** (avancé), puis touche **Website Data** (données de sites web).
6. Cherche l'entrée correspondant à l'adresse de ton hôte Marinara. Si elle n'apparaît pas, touche **Show All Sites** (afficher tous les sites).
7. Balaie cette entrée vers la gauche, puis touche **Delete** (supprimer). Les anciens fichiers enregistrés pour ce serveur disparaissent alors.
8. Ouvre à nouveau Marinara dans **Safari** en suivant les étapes de la section Se connecter depuis Safari.
9. Ajoute-le à nouveau à l'écran d'accueil en suivant les étapes de la section Ajouter à l'écran d'accueil.

Les chats, les personnages et les réglages sont stockés sur le serveur, pas sur ton iPhone ou ton iPad. Réinstaller l'application de l'écran d'accueil ne les supprime pas.

## Dépannage

**La page refuse de se charger dans Safari.** Vérifie que le serveur tourne toujours sur l'appareil hôte. Vérifie que les deux appareils sont sur le même réseau ou sur le même Tailscale. Confirme que l'adresse IP et le port `7860` sont corrects. Pour une aide réseau plus poussée, va voir le [guide d'accès à distance](../REMOTE_ACCESS.md) et [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

**Safari demande un nom d'utilisateur et un mot de passe.** Le propriétaire du serveur a activé la protection par mot de passe pour les appareils distants. Demande le nom d'utilisateur et le mot de passe à la personne qui gère le serveur. La configuration est décrite dans le [guide d'accès à distance](../REMOTE_ACCESS.md).

**Safari affiche toujours une ancienne version.** Recharge d'abord la page. Si elle a encore l'air ancienne, suis les étapes de la section Effacer et réinstaller la PWA, plus haut.

**L'application de l'écran d'accueil se ferme ou devient blanche pendant la génération.** Rouvre-la et retourne au chat. Inutile de redémarrer un serveur sain. Les réponses automatiques et les demandes d'image manuelles ou réessayées utilisant uniquement Illustrator continuent sur le serveur après la perte de connexion du navigateur. Le chat rouvert recherche le travail inachevé puis actualise les messages enregistrés et les images de galerie à la fin. **Stop** annule toujours la génération du chat sélectionné. Si l'écran blanc revient, communique tes Support Diagnostics et précise si la réouverture restaure le chat ; cette récupération ne diagnostique ni n'empêche tous les échecs du navigateur iOS.

**Un bandeau rouge annonce que les enregistrements échoueront silencieusement.** C'est un avertissement de confiance réseau émis par le serveur, pas un problème d'iPhone ou d'iPad. Le propriétaire du serveur doit accorder sa confiance à ton adresse. Va voir le [guide d'accès à distance](../REMOTE_ACCESS.md) et [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

**Les actions privilégiées sont bloquées.** Certaines actions de maintenance exigent un secret d'administration fourni par le propriétaire du serveur. Sur ton iPhone ou ton iPad, cette valeur s'enregistre dans **Settings**, puis **Advanced**, puis **Admin Access** (accès administrateur). Le [guide d'accès à distance](../REMOTE_ACCESS.md) explique ce qu'est le secret d'administration et comment en obtenir un.

## Guides associés

- [Accès à distance : authentification basique et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
- [Foire aux questions](../FAQ.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
- [Guide d'installation Android (Termux)](android-termux.md)
