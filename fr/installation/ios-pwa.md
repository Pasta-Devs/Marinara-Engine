# Guide PWA pour iOS / iPadOS

Utilise Marinara Engine sur un iPhone ou un iPad. Apple ne permet pas au serveur Marinara de tourner sur ces appareils : tu ouvres donc dans Safari un serveur qui tourne sur un autre appareil. Tu peux ensuite l'enregistrer sur ton écran d'accueil sous forme de PWA. Une PWA (Progressive Web App) est un site web qui s'ouvre dans sa propre fenêtre, comme une application.

## Le parcours rapide

1. Installe et démarre Marinara sur un ordinateur, un serveur domestique ou un téléphone Android (voir la liste ci-dessous). Laisse-le tourner.
2. Définis une connexion sur cet ordinateur. Voir [Accès à distance](../REMOTE_ACCESS.md#option-1-login-recommended).
3. Trouve l'adresse IP de l'ordinateur (voir plus bas).
4. Sur ton iPhone ou ton iPad, ouvre **Safari** et va sur `http://` suivi de cette adresse IP et de `:7860`.

N'utilise pas `127.0.0.1` sur ton iPhone ou ton iPad. Cette adresse désigne l'iPhone lui-même.

## Où tourne le serveur

Le serveur peut tourner sur :

- Un PC Windows : [Guide d'installation sous Windows](windows.md).
- Un ordinateur Mac ou Linux : [Guide d'installation macOS / Linux](macos-linux.md).
- Un téléphone Android avec Termux : [Guide d'installation Android (Termux)](android-termux.md).
- Un conteneur Docker ou Podman : [Lancer via un conteneur](containers.md).

## Se connecter depuis Safari

Avant de commencer : le serveur doit tourner et laisser entrer ton appareil, en général avec une connexion. Voir [Accès à distance](../REMOTE_ACCESS.md).

1. Mets l'appareil serveur et ton iPhone ou ton iPad sur le même réseau, par exemple le Wi-Fi de la maison. Pour te connecter depuis ailleurs, utilise Tailscale, un outil gratuit qui relie tes appareils dans un réseau privé, via internet.
2. Trouve l'adresse IP de l'appareil serveur. Sur l'ordinateur serveur, lance une commande dans un terminal (une fenêtre dans laquelle tu tapes des commandes) et lis l'adresse, qui ressemble à `192.168.1.42`.

   - Windows (invite de commandes) : `ipconfig`. Lis la valeur **IPv4 Address** (adresse IPv4).
   - Linux : `hostname -I`.
   - macOS : `ipconfig getifaddr en0`.

3. Ouvre **Safari** et va à cette adresse. Remplace `<host-ip>` par cette adresse IP. Le port par défaut est `7860`.

```text
http://<host-ip>:7860
```

4. L'écran d'accueil de Marinara se charge.

Si tu vois une page de connexion, connecte-toi avec le nom d'utilisateur et le mot de passe du serveur. Si tu vois une page de configuration, saisis le code de configuration à usage unique affiché dans le log du serveur (le journal du serveur) et choisis un nom d'utilisateur et un mot de passe. Voir [Accès à distance](../REMOTE_ACCESS.md).

Si ça n'a pas marché : vérifie que le serveur tourne toujours et que les deux appareils sont sur le même réseau ou sur Tailscale. Vérifie l'adresse IP et le port. Voir [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Ajouter à l'écran d'accueil

1. Ouvre ton serveur Marinara dans **Safari**.
2. Touche le bouton de partage, l'icône carrée avec une flèche vers le haut.
3. Fais défiler la feuille de partage et touche **Add to Home Screen** (ajouter à l'écran d'accueil).
4. Change le nom si tu le souhaites, puis touche **Add** (ajouter).

Une icône Marinara apparaît sur ton écran d'accueil. Touche-la pour ouvrir Marinara dans sa propre fenêtre, sans la barre d'adresse de Safari.

## Utiliser le HTTPS si l'application se comporte mal

Une PWA fonctionne mieux en HTTPS, une connexion sécurisée dont l'adresse commence par `https://`. Une simple adresse `http://` fonctionne dans Safari. Certaines versions d'iOS et d'iPadOS limitent une application de l'écran d'accueil sur une simple adresse `http://`. Si cela arrive, sers Marinara en HTTPS, ou garde-le en signet Safari.

Tailscale seul ne fait pas passer une adresse en HTTPS. Utilise une configuration Tailscale qui sert le HTTPS, ou demande au propriétaire du serveur de placer Marinara derrière du HTTPS. Voir [Accès à distance](../REMOTE_ACCESS.md#serving-over-https).

<a id="clearing-and-reinstalling-the-pwa"></a>

## Effacer et réinstaller la PWA

Il arrive que Safari garde une ancienne version de l'application, ou que l'application enregistrée se bloque. La réinstaller règle en général le problème. Tes chats, tes personnages et tes réglages sont sur le serveur : la réinstallation ne les supprime donc pas.

1. Appuie longuement sur l'icône Marinara de ton écran d'accueil.
2. Touche l'option qui supprime l'application, puis confirme.
3. Ouvre l'application **Settings** (Réglages) sur ton iPhone ou ton iPad.
4. Touche **Safari**. Sur les versions récentes d'iOS et d'iPadOS, l'entrée se trouve parfois sous **Apps**, puis **Safari**.
5. Touche **Advanced** (avancé), puis **Website Data** (données de sites web).
6. Cherche l'entrée de ton adresse Marinara. Si tu ne la vois pas, touche **Show All Sites** (afficher tous les sites).
7. Balaie l'entrée vers la gauche et touche **Delete** (supprimer).
8. Rouvre Marinara dans **Safari** et ajoute-le de nouveau à l'écran d'accueil, en suivant les étapes ci-dessus.

## Dépannage

**La page refuse de se charger dans Safari.** Vérifie que le serveur tourne, que les deux appareils sont sur le même réseau ou sur Tailscale, et que l'adresse IP et le port `7860` sont corrects. Voir [Accès à distance](../REMOTE_ACCESS.md) et [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

**Safari affiche une page de connexion ou de configuration après une mise à jour.**

- Connecte-toi sur `/login` avec le nom d'utilisateur et le mot de passe du serveur.
- Si aucune connexion n'existe, saisis sur la page de configuration le code de configuration à usage unique du log du serveur.
- Si le serveur n'affiche aucun code, définis la connexion sur l'appareil serveur, sous **Settings → Advanced → Access** (Paramètres → Avancé → Accès).
- Une erreur **403** peut signifier que ton iPhone n'est pas dans `IP_ALLOWLIST`. C'est le propriétaire du serveur qui modifie cette liste.
- La PWA ne peut pas réinitialiser la connexion du serveur. Le propriétaire du serveur lance `node scripts/reset-login.mjs` dans le dossier Marinara du serveur (dans Docker : `docker exec <container> node scripts/reset-login.mjs`), ou modifie une connexion définie dans `.env`.

Voir [Verrouillé après une mise à jour](../REMOTE_ACCESS.md#locked-out-after-updating).

**Safari affiche toujours une ancienne build.** Recharge la page. Si elle a encore l'air ancienne, réinstalle la PWA en suivant les étapes ci-dessus.

**L'application de l'écran d'accueil se ferme ou devient blanche pendant la génération.** Rouvre-la et retourne au chat. Un serveur sain continue de travailler : les réponses du chat et les demandes d'image d'Illustrator continuent sur le serveur, et le chat rouvert s'actualise quand elles se terminent. **Stop** (arrêter) annule toujours la génération dans le chat sélectionné. Si l'écran blanc revient sans cesse, signale-le avec tes Support Diagnostics.

**Un bandeau rouge annonce que les enregistrements échoueront silencieusement.** C'est un avertissement de confiance réseau émis par le serveur, pas un problème de ton iPhone ou de ton iPad. Le propriétaire du serveur doit faire confiance à ton adresse. Voir [Accès à distance](../REMOTE_ACCESS.md#why-is-my-save-blocked-csrf).

**Les actions privilégiées sont bloquées.** Certaines actions de maintenance demandent le secret d'administration (un second mot de passe) fourni par le propriétaire du serveur. Enregistre-le sur ton iPhone ou ton iPad dans **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur). Voir [Accès à distance](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).

## Guides associés

- [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
- [Foire aux questions](../FAQ.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
- [Guide d'installation Android (Termux)](android-termux.md)
