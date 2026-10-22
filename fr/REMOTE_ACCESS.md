# Accès à distance : connexion et liste d'autorisation d'IP

Ce guide explique comment ouvrir Marinara Engine depuis un autre appareil : un téléphone, un ordinateur portable ou un conteneur Docker. Il couvre l'option principale, une connexion. Il couvre aussi la liste d'autorisation d'IP, les proxys de connexion, le HTTPS, la section **Admin Access** (accès administrateur) et le message CSRF « save blocked ». Presque tous les réglages décrits ici se trouvent dans le fichier `.env` du serveur, pas dans l'application.

Un petit lexique utilisé tout au long de ce guide :

- Le fichier `.env` : un fichier de réglages en texte brut, placé dans le dossier de Marinara Engine, à côté du fichier `package.json`.
- Loopback : la machine qui exécute réellement le serveur. Son adresse est `127.0.0.1` ou `localhost`.
- L'accès à distance : ouvrir Marinara depuis n'importe quel appareil AUTRE que la machine qui exécute le serveur.

## Ce que Marinara bloque par défaut

Pour protéger tes données, une installation neuve de Marinara refuse les connexions venant d'autres appareils tant que tu n'as pas mis en place un contrôle d'accès. Par défaut, seuls trois types de clients sont considérés comme fiables :

1. Loopback (`127.0.0.1` ou `::1`), c'est-à-dire la machine qui exécute le serveur elle-même. Les visiteurs transmis par un reverse proxy ou un tunnel sur la même machine ne comptent pas ; voir [Reverse proxies et tunnels sur le même ordinateur](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Les appareils Tailscale de ton tailnet. Tailscale est un outil de réseau privé, et ses adresses utilisent la plage `100.64.0.0/10`.
3. Les clients Docker sur le même hôte. Marinara reconnaît la plage de pont habituelle `172.16.0.0/12` ainsi que la passerelle par défaut exacte du conteneur, ce qui couvre aussi Docker Desktop et les pools d'adresses personnalisés.

Tout le reste est bloqué tant que tu n'as pas défini de connexion : ton téléphone sur le même Wi-Fi, un client venant d'Internet, etc. Un appareil bloqué qui ouvre Marinara dans un navigateur tombe sur une page de configuration sombre. Son titre indique **This Marinara Engine install needs a login before remote devices can connect.** La page contient un formulaire pour le code de configuration à usage unique du log du serveur : tu peux ainsi définir la connexion depuis cet appareil.

Si tu ne fais rien et ne définis jamais de mot de passe, Marinara reste verrouillé sur ces trois sources fiables. C'est le comportement par défaut, et il est sûr.

## Où se trouve le fichier .env

Tous les réglages d'accès se trouvent dans le fichier `.env`, à la racine du projet, à côté du fichier `package.json`. Si tu n'en as pas encore, copie l'exemple :

```bash
cp .env.example .env
```

Ouvre le fichier `.env` avec n'importe quel éditeur de texte. La plupart des réglages d'accès prennent effet en une poignée de secondes, sans redémarrage : Basic Auth, la liste d'autorisation d'IP, le secret administrateur et les origines CSRF. Quelques réglages de bas niveau demandent encore un redémarrage, dont la variable `PORT`, la variable `HOST` et les chemins des certificats HTTPS.

Il arrive que les autres appareils n'atteignent pas du tout le serveur : la connexion expire au lieu de renvoyer une erreur 403. Dans ce cas, le serveur n'écoute sans doute que sur la machine locale. Demande-lui d'écouter sur toutes les interfaces réseau :

```env
HOST=0.0.0.0
```

Les lanceurs (`start.bat`, `start.sh`) définissent `HOST=0.0.0.0` à ta place. Lancer directement la commande `pnpm start` ne le fait pas.

Adresse de liaison par défaut selon la façon dont tu lances Marinara :

| Méthode de lancement | Valeur par défaut de `HOST` |
| --- | --- |
| `pnpm start`, `start-local.bat` | `127.0.0.1` |
| `start.sh`, `start.bat`, installateur Windows, `start-termux.sh` | `0.0.0.0` |
| Image Docker | `0.0.0.0` dans le conteneur |
| `docker-compose.yml` | Publie le port sur `127.0.0.1` uniquement |

## Quelle option choisir

Lis les cas suivants dans l'ordre et arrête-toi au premier qui te correspond.

1. Tu te connectes uniquement via Tailscale, ou uniquement depuis des conteneurs Docker sur le même hôte. Tu n'as rien à faire, ça fonctionne déjà.
2. Tu veux ouvrir Marinara depuis un téléphone, une tablette ou un ordinateur portable, sur le Wi-Fi de la maison. Définis une connexion (option 1 ci-dessous).
3. Tu exposes Marinara sur Internet. Définis une connexion et utilise le HTTPS.
4. Un proxy de connexion de ton réseau, comme tinyauth, Authelia ou Authentik, fait déjà connecter chaque visiteur. Lis [Proxys de connexion (forward auth)](#login-proxies-forward-auth).

Une connexion est le choix le plus souple. Elle fonctionne depuis n'importe quelle IP, ne demande aucune configuration sur chaque appareil, et chaque navigateur reste connecté.

<a id="option-1-login-recommended"></a>

## Option 1 : Connexion (recommandée)

Une connexion est un nom d'utilisateur et un mot de passe que chaque appareil distant doit fournir. Tu peux la définir de trois façons :

- **Dans les Paramètres.** Dans un navigateur déjà connecté, ou sur l'ordinateur qui fait tourner Marinara (ouvre `http://localhost:7860`), va dans **Paramètres → Avancé → Accès**. Définis un nom d'utilisateur et un mot de passe sous **Remote login** (connexion distante). Tant qu'aucune connexion n'existe, un appareil que Marinara refuse, comme le navigateur d'un hôte Docker, peut saisir le code de configuration du log du serveur au même endroit.
- **Avec le code de configuration, depuis n'importe quel appareil.** Tant qu'aucune connexion n'est définie et que le serveur écoute au-delà du loopback, il affiche dans son log un code de configuration à usage unique. La ligne du log commence par `[login] One-time setup code:`. Trouve-la dans le terminal qui fait tourner Marinara. Dans Docker, lance `docker logs <container> 2>&1 | grep "setup code"`. L'avertissement de refus dans le log répète le code tant qu'aucune connexion n'existe. Ouvre ensuite Marinara sur n'importe quel appareil. La page qui bloque l'appareil contient un formulaire pour le code de configuration, un nom d'utilisateur et un mot de passe. Le code ressemble à `XXXX-XXXX-XXXX-XXXX`. Les majuscules, les espaces et les tirets n'ont pas d'importance. Chaque code ne fonctionne qu'une fois ; un redémarrage ou une réinitialisation en affiche un nouveau. Dans Docker, la page indique aussi comment définir la connexion dans le fichier `.env` du dossier de données (`/app/data/.env`) ou dans la liste `environment:` de ton fichier compose (puis lance `docker compose up -d`). Utilise cette méthode pour les installations Docker et NAS sans navigateur sur l'hôte. Marinara affiche une bannière sur la connexion manquante aux visiteurs locaux et aux sessions connectées, sous forme de carte en bas de l'écran.
- **Dans `.env`.** Ajoute deux lignes :

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Une connexion dans `.env` l'emporte sur une connexion définie dans l'application, et tu ne la modifies que dans `.env`. Enregistre `.env` ; la modification prend effet en quelques secondes, sans redémarrage.

Choisis un mot de passe solide et unique. L'application demande au moins 10 caractères. Tu peux en générer un au hasard :

```bash
openssl rand -base64 24
```

Ensuite, procède ainsi depuis l'appareil distant.

1. Ouvre Marinara dans le navigateur avec l'adresse du serveur, par exemple `http://192.168.1.50:7860`.
2. Connecte-toi sur la page de connexion avec ton nom d'utilisateur et ton mot de passe.
3. L'application doit se charger. Le navigateur reste connecté jusqu'à un an, jusqu'à ce que tu te déconnectes. Les scripts et les clients d'API envoient le nom d'utilisateur et le mot de passe à chaque requête (Basic Auth).

Pour connecter un autre appareil sans retaper le mot de passe, utilise un code d'appairage. Sur un appareil déjà connecté, ouvre **Paramètres → Avancé → Accès** et choisis **Add a device** (ajouter un appareil). Saisis ensuite le code sur la page de connexion du nouvel appareil. Le code ne fonctionne qu'une fois, pendant quelques minutes. Un code expiré reçoit son propre message ; il faut en créer un nouveau. Sous **Signed-in devices** (appareils connectés), tu vois chaque appareil avec sa méthode de connexion et la date de sa première connexion. Tu peux déconnecter n'importe quel appareil, y compris celui que tu utilises. Tu peux aussi modifier ou supprimer le mot de passe. Pour cela, Marinara demande le mot de passe actuel, sauf si tu travailles sur l'ordinateur qui fait tourner Marinara ou si `ADMIN_SECRET` est défini.

Si tu oublies le mot de passe, lance `pnpm reset-login` sur l'ordinateur qui fait tourner Marinara. Dans Docker, lance `docker exec <container> node scripts/reset-login.mjs`. Cette commande supprime la connexion définie dans l'application et déconnecte chaque navigateur. Si le serveur écoute au-delà du loopback, elle affiche ensuite un nouveau code de configuration. Seulement si cette commande ne fonctionne pas, supprime plutôt `.remote-login.json` et `.remote-sessions.json` du dossier de données. Avec le `/app/data` par défaut, lance `docker exec <container> rm -f /app/data/.remote-login.json /app/data/.remote-sessions.json` ; si tu as changé `DATA_DIR`, utilise ce dossier. Une connexion dans `.env` se modifie dans `.env`.

**Serveur sans interface et sans navigateur ?** Une installation native sur un serveur sans interface écoute uniquement sur le loopback et n'affiche aucun code de configuration. Sur ton propre ordinateur, lance `ssh -L 7860:127.0.0.1:7860 user@server`. Ouvre ensuite `http://localhost:7860` et utilise **Paramètres**.

Après 10 mots de passe ou codes erronés différents en 15 minutes, Marinara refuse les tentatives de connexion depuis cette adresse avec **429 Too Many Requests**, jusqu'à la fin de ces 15 minutes. Un mot de passe correct saisi avant remet le compteur à zéro. Les visiteurs transmis par un reverse proxy ou un tunnel sur l'hôte partagent un seul compteur, et la connexion de l'un d'eux ne le remet pas à zéro. Redémarrer le serveur le remet aussi à zéro. Un navigateur déjà connecté entre toujours avec le bon mot de passe : les mots de passe erronés d'autres personnes ne peuvent donc pas te bloquer l'accès depuis un appareil que tu utilises déjà. La page de connexion indique combien de minutes attendre. Si tu oublies le mot de passe, la page de connexion affiche un indice **Forgot the password?**.

Par défaut, la fenêtre du navigateur affiche **Marinara Engine**. Ce texte se change avec la variable `BASIC_AUTH_REALM`.

Certains clients passent outre le mot de passe, même quand Basic Auth est activé :

- Loopback (`127.0.0.1`, `::1`) : tu n'as donc jamais besoin de mot de passe sur la machine hôte elle-même. Les visiteurs transmis par un reverse proxy ou un tunnel sur cette machine en ont toujours besoin.
- Toute adresse présente dans `IP_ALLOWLIST`. Attention : définir une liste d'autorisation bloque aussi toutes les adresses absentes de cette liste (voir l'option 2).
- Le trafic Tailscale direct (`100.64.0.0/10`), sauf si tu désactives son contournement.
- Le trafic Docker de pont ou de passerelle, uniquement tant qu'aucune connexion, liste d'autorisation ni `TRUSTED_AUTH_PROXY` valide n'est définie (voir [Contournement Tailscale et Docker](#tailscale-and-docker-bypass)).
- L'adresse `/api/health`, pour que les outils de surveillance continuent de fonctionner. Un visiteur qui ne peut pas ouvrir l'application ne reçoit que `{"status": "ok"}` ; les détails de version, de système et de modèles restent réservés à cet ordinateur, aux réseaux de confiance et aux navigateurs connectés.

Important : Basic Auth se contente d'encoder le mot de passe, il ne le chiffre pas. N'importe qui surveillant une connexion non chiffrée peut le lire. Si tu exposes Marinara sur Internet, associe Basic Auth au HTTPS (voir plus bas).

## Option 2 : liste d'autorisation d'IP

La liste d'autorisation d'IP laisse entrer certaines adresses sans mot de passe. Elle convient bien quand tes appareils ont des adresses IP stables. Indique une liste d'adresses ou de plages, séparées par des virgules :

```env
IP_ALLOWLIST=192.168.1.0/24,203.0.113.42
```

Le `/24` de l'exemple, c'est de la notation CIDR. Le CIDR est une façon courte d'écrire toute une plage d'adresses en une seule entrée. Par exemple, `192.168.1.0/24` couvre toutes les adresses de `192.168.1.0` à `192.168.1.255`. Une adresse seule, sans barre oblique, comme `203.0.113.42`, ne correspond qu'à cet appareil-là.

Comment se comporte la liste d'autorisation d'IP :

- Toute adresse absente de la liste est rejetée avec une erreur **403 Forbidden**.
- Loopback est toujours autorisé : impossible de te couper toi-même l'accès local. Les visiteurs transmis par un reverse proxy ou un tunnel sur la même machine ne sont pas du loopback : la liste d'autorisation les bloque donc. Derrière un proxy, utilise une connexion.
- Avec Docker Desktop, OrbStack et Docker sans root (rootless), tous les appareils atteignent le conteneur depuis la même adresse de passerelle : la liste d'autorisation ne peut donc pas les distinguer. Dans ce cas, utilise Basic Auth.
- Le trafic Tailscale direct contourne aussi la liste. Le trafic Docker de pont ou de passerelle ne la contourne que tant qu'aucune connexion, liste d'autorisation ni `TRUSTED_AUTH_PROXY` valide n'est définie (voir [Contournement Tailscale et Docker](#tailscale-and-docker-bypass)).
- Les entrées invalides sont ignorées et consignées dans les logs. Elles ne font pas planter le serveur.
- La liste reste stricte même quand Basic Auth est activé. Les adresses listées évitent la demande de mot de passe. Toutes les autres restent bloquées avec une erreur **403 Forbidden**, sans jamais voir de fenêtre d'identification.

La liste d'autorisation ne permet pas un montage mixte, où les appareils listés éviteraient le mot de passe pendant que tous les autres s'identifient. Si tu veux que les autres appareils s'identifient avec un mot de passe, laisse la variable `IP_ALLOWLIST` vide et utilise Basic Auth seul.

L'application de la liste se désactive un moment, sans supprimer la liste elle-même. C'est pratique quand tu cherches un problème depuis une nouvelle IP. Mets l'indicateur d'activation à false :

```env
IP_ALLOWLIST_ENABLED=false
```

## Contournement du réseau privé (référence)

Quelques indicateurs suppriment le verrouillage pour un réseau privé de confiance. Ils sont réservés à des configurations particulières. Une connexion est le meilleur choix. Voir [Contrôle d'accès](CONFIGURATION.md#access-control) pour les indicateurs et leurs risques.

<a id="tailscale-and-docker-bypass"></a>

## Contournement Tailscale et Docker

Par défaut, Marinara fait confiance à un appareil qui se connecte directement à ton réseau Tailscale. Il fait aussi confiance à l'hôte propre d'un conteneur Docker. Une connexion, une liste d'autorisation d'IP ou `TRUSTED_AUTH_PROXY` arrête la confiance automatique envers Docker : chaque appareil a alors besoin de sa connexion ou de sa place dans la liste d'autorisation. Pour les indicateurs qui changent cela, voir [Contrôle d'accès](CONFIGURATION.md#access-control).

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Reverse proxies et tunnels sur le même ordinateur

Un reverse proxy ou un tunnel installé sur la machine qui exécute Marinara, comme nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve ou Funnel, ou ngrok, se connecte à Marinara depuis loopback. Marinara le reconnaît grâce aux en-têtes de transmission que le proxy ajoute : `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, les en-têtes d'identité Tailscale ou `Via`. Marinara reconnaît aussi une requête qui arrive en HTTP/1.0, car les navigateurs ne l'utilisent jamais, mais un `proxy_pass` nginx par défaut si. Marinara reconnaît aussi une requête dont l'en-tête Host désigne un autre ordinateur, comme un domaine ou une adresse du réseau local, même lorsque le proxy n'ajoute aucun en-tête. Il traite alors chaque requête comme le visiteur distant qu'elle représente :

- Une connexion s'applique. Sans elle, les visiteurs voient la page de configuration. Définis la connexion dans **Paramètres** sur cet ordinateur ou dans `.env`.
- `IP_ALLOWLIST` bloque les visiteurs transmis, car le proxy masque leurs vraies adresses.
- Les actions privilégiées demandent le secret d'administration, et les fonctions réservées à loopback restent indisponibles.

Ton propre navigateur sur cette machine, ouvert sur `http://127.0.0.1:7860` ou `http://localhost:7860`, reste sans mot de passe.

Caddy, Traefik, Cloudflare Tunnel, Tailscale et ngrok ajoutent des en-têtes de transmission par défaut. Pour nginx, cette ligne reste recommandée dans le bloc `location` :

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Les outils qui transmettent des connexions brutes, comme `socat` ou `ssh -R`, n'ajoutent aucun en-tête : leur trafic paraît donc local. Ne les utilise pas pour publier Marinara.

Si ton proxy oblige déjà chaque visiteur à se connecter avant de transmettre quoi que ce soit, lis [Proxys de connexion (forward auth)](#login-proxies-forward-auth).

<a id="login-proxies-forward-auth"></a>

## Proxys de connexion (forward auth)

Un proxy d'authentification préalable (forward auth), comme [tinyauth](https://tinyauth.app), [Authelia](https://www.authelia.com), [Authentik](https://goauthentik.io) ou oauth2-proxy, demande à chaque visiteur de se connecter avant de transmettre la requête. Si un tel proxy est le seul moyen d'atteindre Marinara, tu peux ignorer la seconde connexion de Marinara. Ne définis pas cela sans un tel proxy.

Mets l'adresse du proxy dans `.env` :

```env
TRUSTED_AUTH_PROXY=192.168.1.5
```

Marinara laisse alors passer chaque requête dont la connexion provient de cette adresse. Marinara ne demande pas sa propre connexion pour elles, et il n'affiche aucun code de configuration. Marinara vérifie l'adresse de la connexion elle-même. Il ignore pour cela les en-têtes de transmission comme `X-Forwarded-For`. Les requêtes du proxy passent aussi `IP_ALLOWLIST`, car le proxy décide qui entre. Elles ne comptent pas comme locales : les actions privilégiées demandent donc toujours le secret d'administration. **Paramètres → Avancé → Accès** affiche **Trusted login proxy: Set** tant que le réglage est actif.

Avant de le définir :

- **Le proxy doit demander une connexion sur chaque chemin.** Cela inclut `/api/`, les connexions WebSocket et les fichiers statiques. Un chemin que le proxy laisse passer sans connexion est ouvert à tout le monde.
- **Marinara ne doit pas être joignable en contournant le proxy.** Lie Marinara à une adresse que seul le proxy peut atteindre, ou bloque son port avec un pare-feu. Dans Docker, mets le proxy et Marinara sur le même réseau Docker, donne au proxy une adresse fixe dessus, et ne publie pas le port de Marinara. Si le proxy tourne plutôt sur l'hôte Docker, publie le port uniquement sur loopback (`127.0.0.1:7860:7860`) : Docker Desktop et OrbStack montrent chaque client du réseau local d'un port publié à l'adresse de la passerelle Docker, la même adresse que le proxy. Si un autre appareil peut se connecter directement à Marinara, il passe la connexion du proxy.
- **Indique uniquement l'adresse du proxy.** Une plage doit rester dans l'espace d'adresses privées ; Marinara ignore les autres plages. Il consigne un avertissement pour chaque plage, car chaque appareil d'une plage passe la connexion.
- **Ajoute le nom public comme pour tout autre proxy.** Mets le nom d'hôte dans `TRUSTED_HOSTS` et l'origine dans `CSRF_TRUSTED_ORIGINS` (voir [Pourquoi mon enregistrement est-il bloqué (CSRF)](#why-is-my-save-blocked-csrf)).

Quand `TRUSTED_AUTH_PROXY` est défini, Marinara arrête aussi la confiance automatique envers Docker. Les visiteurs directs qui ne sont pas le proxy ont besoin de la connexion de Marinara ou de la liste d'autorisation d'IP. Marinara n'affiche alors plus non plus la bannière « no login yet ».

Si le proxy tourne sur le même ordinateur que Marinara, utilise `TRUSTED_AUTH_PROXY=127.0.0.1` et dirige le proxy vers `127.0.0.1:7860`, pas vers `localhost:7860`. Un proxy qui appelle `localhost` peut se connecter depuis `::1`, qui ne correspond pas à `127.0.0.1`. Tous les autres proxys ou tunnels de cet ordinateur sont alors aussi considérés de confiance : utilise donc ce réglage uniquement si le proxy de connexion est le seul. Cela ne donne pas aux visiteurs passant par le proxy l'accès de la machine locale.

Un exemple Caddy, avec Marinara sur `192.168.1.20:7860` :

```caddy
marinara.example.com {
  forward_auth tinyauth:3000 {
    uri /api/auth/caddy
  }
  reverse_proxy 192.168.1.20:7860
}
```

Pour Authelia, utilise `forward_auth authelia:9091` avec `uri /api/authz/forward-auth`. Authentik sert aussi ses propres pages de connexion via le proxy. Mets ses lignes dans un bloc `route` pour que Caddy conserve leur ordre et que le chemin outpost ne passe pas lui-même par forward auth :

```caddy
marinara.example.com {
  route {
    reverse_proxy /outpost.goauthentik.io/* authentik-server:9000
    forward_auth authentik-server:9000 {
      uri /outpost.goauthentik.io/auth/caddy
    }
    reverse_proxy 192.168.1.20:7860
  }
}
```

Les visiteurs obtiennent alors le même accès complet que la machine hôte, y compris les actions privilégiées sans le secret d'administration. Si tu n'atteins Marinara que par un nom ajouté à `/etc/hosts`, n'utilise pas ce réglage. Utilise plutôt un nom `*.localhost`, par exemple `marinara.localhost`.

Pour Traefik et nginx, suis le guide forward-auth de ton proxy. Marinara n'a besoin de rien de plus que l'adresse du proxy.

## Servir Marinara en HTTPS

Le HTTPS chiffre la connexion grâce au TLS. Le TLS est le chiffrement qui transforme une adresse `http` ordinaire en adresse `https` sécurisée. Utilise toujours le HTTPS pour une installation joignable en dehors d'un réseau privé entièrement de confiance, surtout avec Basic Auth.

Deux façons de le mettre en place.

1. Le TLS intégré. Indique au serveur un fichier de certificat et un fichier de clé privée :

```env
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

2. Le reverse proxy. Place Marinara derrière nginx, Caddy, Traefik ou un Cloudflare Tunnel. Le proxy s'occupe de la partie HTTPS et transmet à Marinara en HTTP simple, sur la même machine. Lis d'abord [Reverse proxies et tunnels sur le même ordinateur](#reverse-proxies-and-tunnels-on-the-same-computer).

Il te faut un certificat et une clé avant de définir les variables `SSL_CERT` et `SSL_KEY`. Un outil comme `mkcert` en crée un pour un usage local, `certbot` pour un domaine public. Si les fichiers manquent ou sont illisibles, le serveur s'arrête au démarrage et indique les chemins exacts qu'il a essayés.

## Admin Access et actions privilégiées

Certaines actions sont particulièrement sensibles : effacer les données, créer ou télécharger des sauvegardes, importer et exporter des profils, installer des thèmes et installer le runtime Local Model. Elles exigent un secret partagé à part, appelé le secret administrateur, en plus de l'option d'accès que tu as choisie plus haut.

Sur la machine loopback, ces actions fonctionnent en général sans secret administrateur. Depuis un appareil distant, il faut d'abord le configurer. Procède ainsi.

1. Dans le fichier `.env`, définis une valeur aléatoire solide, puis enregistre. Elle prend effet en une poignée de secondes, sans redémarrage.

```env
ADMIN_SECRET=some-long-random-string
```

2. Sur l'appareil distant, ouvre Marinara et va dans **Settings** (Paramètres), puis l'onglet **Advanced**, puis la section **Admin Access**.
3. Colle la même valeur dans le champ (son texte indicatif affiche **ADMIN_SECRET**), puis clique sur **Save**.
4. Le message **Admin secret saved for this browser** doit apparaître.

Quelques points à savoir sur le secret administrateur :

- Il est stocké dans ce navigateur uniquement. Il ne se synchronise pas entre les appareils. Chaque navigateur qui a besoin des actions privilégiées doit le recevoir séparément.
- Cliquer sur **Save** avec le champ vide efface le secret et affiche **Admin secret cleared**.
- Si l'opérateur du serveur définit `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`, même la machine loopback a besoin du secret.
- C'est indépendant de Basic Auth, et les deux se combinent. Basic Auth protège toute l'application, le secret administrateur protège les actions dangereuses.

Si une action privilégiée échoue sur un appareil distant, Marinara affiche un message d'erreur avec deux solutions. La première : ouvrir l'application via localhost. La seconde : définir `ADMIN_SECRET` dans le fichier `.env` du serveur, puis coller la même valeur dans **Settings** > **Advanced** > **Admin Access**.

<a id="why-is-my-save-blocked-csrf"></a>

## Pourquoi mon enregistrement est-il bloqué (CSRF)

CSRF veut dire cross-site request forgery, la falsification de requête entre sites. Cette protection empêche un autre site ouvert dans ton navigateur de modifier discrètement des choses dans Marinara sans ta permission. Elle fonctionne toute seule. Aucun réglage ne sert à l'activer.

Il arrive que la protection CSRF bloque tes propres enregistrements. En général, c'est parce que tu atteins Marinara via un nom de domaine public ou un port inhabituel auquel le serveur ne fait pas encore confiance. Deux signes te préviennent quand ça arrive.

- Un bandeau rouge en haut de l'application avertit que **Saves will silently fail**, parce que cette origine n'est pas de confiance. Le bandeau affiche la ligne exacte à ajouter au fichier `.env` et propose un bouton **Copy**.
- Si un enregistrement est réellement rejeté, une petite fenêtre apparaît. Son titre est **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** ou **Save blocked: origin not trusted**.

Pour corriger ça, ajoute ton adresse à la liste de confiance dans le fichier `.env` :

```env
CSRF_TRUSTED_ORIGINS=https://chat.example.com,http://203.0.113.10:7831
```

Avec un domaine public ou un domaine de reverse proxy, autorise aussi le nom d'hôte :

```env
TRUSTED_HOSTS=chat.example.com
```

Les adresses LAN directes, Tailscale, IPv4 et IPv6 n'ont pas besoin de la variable `TRUSTED_HOSTS`. Les noms locaux en `.local`/`.home.arpa` et les noms de machine en un seul mot sont acceptés automatiquement. Un nom d'hôte exact déjà présent dans `CSRF_TRUSTED_ORIGINS` est accepté lui aussi.

Les origines loopback, les adresses LAN classiques, Tailscale (`100.64.0.0/10`) et le pont Docker (`172.16.0.0/12`) sont de confiance automatiquement. Tu n'as à lister que les adresses IP publiques et les noms de domaine. La modification prend effet en une poignée de secondes, sans redémarrage.

## Une note sur les fournisseurs locaux bloqués

Imagine que tu connectes Marinara à un fournisseur d'IA local, par exemple un fournisseur qui tourne sur ta propre machine. La requête peut être refusée avec un message parlant de "private, loopback, metadata, or reserved IP range". Il s'agit d'un autre contrôle de sécurité, la protection SSRF. SSRF veut dire server-side request forgery, la falsification de requête côté serveur. Elle empêche le serveur d'appeler des adresses privées, sauf si tu l'y autorises. L'erreur nomme la variable `.env` exacte à définir, par exemple `PROVIDER_LOCAL_URLS_ENABLED`. La [référence de configuration du serveur](CONFIGURATION.md) en donne la liste complète.

## Accès depuis un téléphone ou une tablette

Pour ouvrir Marinara depuis un téléphone ou une tablette sur le même réseau :

1. Vérifie que le serveur écoute sur toutes les interfaces, avec `HOST=0.0.0.0` dans le fichier `.env`.
2. Définis une connexion (option 1 ci-dessus). Depuis le téléphone, tu peux le faire sur la page qui te bloque, avec le code de configuration du log du serveur.
3. Trouve l'adresse IP locale de la machine qui exécute le serveur (par exemple `192.168.1.50`).
4. Sur le téléphone, ouvre `http://192.168.1.50:7860` dans un navigateur. Le port par défaut est `7860`.
5. Connecte-toi avec ton nom d'utilisateur et ton mot de passe.

Si la page ne se charge pas du tout, le serveur n'est sans doute pas joignable. Vérifie `HOST=0.0.0.0` et la valeur de la variable `PORT`. Si tu obtiens plutôt une erreur 403, ton appareil joint bien le serveur mais n'y est pas encore autorisé. Reprends l'option que tu as choisie plus haut.

<a id="locked-out-after-updating"></a>

## Verrouillé après une mise à jour

Les versions récentes demandent une connexion lorsqu'une visite passe par un reverse proxy, un tunnel, Tailscale Serve ou Tailscale Funnel. Les anciennes versions laissaient entrer ces visites sans mot de passe. Si tu vois maintenant une page de connexion, une page de configuration ou un **403**, c'est la raison.

**Note de mise à jour :** si tu utilises Tailscale Serve, ou un autre proxy sur le même ordinateur, et que tu n'as jamais défini de mot de passe, tes autres appareils sont verrouillés après la mise à jour. Un proxy sur le même ordinateur parle en général à un serveur qui écoute uniquement sur loopback ; le serveur n'affiche donc aucun code de configuration. Définis plutôt la connexion sur l'ordinateur qui exécute Marinara.

Pour revenir :

1. Ouvre Marinara sur l'ordinateur qui l'exécute, à l'adresse `http://localhost:7860` (ou ton propre `PORT`). L'usage local ne demande pas de mot de passe. Sur un serveur sans interface, lance d'abord `ssh -L 7860:127.0.0.1:7860 user@server` sur ton propre ordinateur, puis ouvre `http://localhost:7860`. Dans Docker, cela ne fonctionne que tant qu'aucune connexion ni `IP_ALLOWLIST` n'est définie. Sinon, saisis le code de configuration du log du serveur (`docker logs <container> 2>&1 | grep "setup code"`) sur la page qui te bloque ou dans **Paramètres → Avancé → Accès**, ou utilise un navigateur déjà connecté.
2. Va dans **Paramètres → Avancé → Accès** et définis un nom d'utilisateur et un mot de passe sous **Remote login** (connexion distante). Ou ouvre le fichier `.env` sur cet ordinateur et définis `BASIC_AUTH_USER` et `BASIC_AUTH_PASS`. Si `IP_ALLOWLIST` est définie, ajoute-y l'adresse de ton autre appareil ou supprime-la, car un appareil absent de la liste reçoit un **403** même avec une connexion.
3. Connecte-toi depuis ton autre appareil avec ce nom d'utilisateur et ce mot de passe.

## Moteurs de recherche

Marinara demande aux moteurs de recherche de ne pas indexer ses pages (`X-Robots-Tag: noindex, nofollow`). Cela ne protège pas ton installation et ne supprime pas les pages déjà indexées. Utilise les contrôles d'accès ci-dessus pour garder ton installation privée.

## Guides associés

- La [référence de configuration du serveur](CONFIGURATION.md) donne la liste complète des réglages du fichier `.env` et les cas particuliers.
- Le guide [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md) couvre les erreurs de connexion, l'accès mobile et bien d'autres cas.
- La [foire aux questions](FAQ.md) explique rapidement comment atteindre Marinara depuis un autre appareil.
