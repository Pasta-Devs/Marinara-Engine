# Accès à distance : Basic Auth et liste d'autorisation d'IP

Ce guide explique comment ouvrir Marinara Engine depuis un autre appareil : un téléphone, un ordinateur portable ou un conteneur Docker. Au programme, les deux options principales : Basic Auth et la liste d'autorisation d'IP. Le contournement pour réseau privé, le HTTPS, la section **Admin Access** (accès administrateur) et le message CSRF "save blocked" sont aussi expliqués. Presque tous les réglages décrits ici se trouvent dans le fichier `.env` du serveur, pas dans l'application.

Un petit lexique utilisé tout au long de ce guide :

- Le fichier `.env` : un fichier de réglages en texte brut, placé dans le dossier de Marinara Engine, à côté du fichier `package.json`.
- Loopback : la machine qui exécute réellement le serveur. Son adresse est `127.0.0.1` ou `localhost`.
- L'accès à distance : ouvrir Marinara depuis n'importe quel appareil AUTRE que la machine qui exécute le serveur.

## Ce que Marinara bloque par défaut

Pour protéger tes données, une installation neuve de Marinara refuse les connexions venant d'autres appareils tant que tu n'as pas mis en place un contrôle d'accès. Par défaut, seuls trois types de clients sont considérés comme fiables :

1. Loopback (`127.0.0.1` ou `::1`), c'est-à-dire la machine qui exécute le serveur elle-même. Les visiteurs transmis par un reverse proxy ou un tunnel sur la même machine ne comptent pas ; voir [Reverse proxies et tunnels sur le même ordinateur](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Les appareils Tailscale de ton tailnet. Tailscale est un outil de réseau privé, et ses adresses utilisent la plage `100.64.0.0/10`.
3. Les clients Docker sur le même hôte. Marinara reconnaît la plage de pont habituelle `172.16.0.0/12` ainsi que la passerelle par défaut exacte du conteneur, ce qui couvre aussi Docker Desktop et les pools d'adresses personnalisés.

Tout le reste est bloqué tant que tu n'as pas choisi une option ci-dessous : ton téléphone sur le même Wi-Fi, un client venant d'Internet, etc. Un appareil bloqué qui ouvre Marinara dans un navigateur tombe sur une page de configuration sombre. Son titre indique **This Marinara Engine install needs access control before remote devices can connect.** La page affiche l'IP de ton appareil ainsi que deux extraits de `.env` prêts à copier-coller.

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
2. Tu veux ouvrir Marinara depuis un téléphone, une tablette ou un ordinateur portable, sur le Wi-Fi de la maison. Utilise Basic Auth (option 1 ci-dessous).
3. Tu exposes Marinara sur Internet. Utilise Basic Auth avec le HTTPS.
4. Tes appareils clients ont des adresses IP fixes et tu préfères ne pas saisir de mot de passe. Utilise la liste d'autorisation d'IP (option 2 ci-dessous).
5. Tout ton réseau est de confiance et tu ne veux jamais de mot de passe. Utilise le contournement pour réseau privé (option 3 ci-dessous). Lis d'abord l'avertissement qui s'y trouve.

Basic Auth reste le choix le plus souple. Cette option fonctionne depuis n'importe quelle IP, ne demande aucune configuration sur chaque appareil, et le navigateur retient l'identifiant.

## Option 1 : Basic Auth (recommandé)

Avec Basic Auth, le navigateur demande un nom d'utilisateur et un mot de passe avant de te laisser entrer. Pour activer cette option, ajoute deux lignes au fichier `.env` :

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Choisis un mot de passe solide et unique. Basic Auth transmet l'identifiant à chaque requête : traite-le comme le mot de passe de n'importe quel autre compte. Pour en générer un au hasard :

```bash
openssl rand -base64 24
```

Enregistre le fichier `.env`. La modification prend effet en une poignée de secondes, sans redémarrage. Ensuite, procède ainsi depuis l'appareil distant.

1. Ouvre Marinara dans le navigateur avec l'adresse du serveur, par exemple `http://192.168.1.50:7860`.
2. Saisis le nom d'utilisateur et le mot de passe que tu as définis, quand le navigateur te les demande.
3. L'application doit se charger. Le navigateur retient l'identifiant pour le reste de la session.

Après 10 mots de passe erronés différents en 15 minutes, Marinara refuse les tentatives d'identification depuis cette adresse avec **429 Too Many Requests**, jusqu'à la fin de ces 15 minutes. Un mot de passe correct saisi avant remet le compteur à zéro. Les visiteurs transmis par un reverse proxy ou un tunnel sur l'hôte partagent un seul compteur, et l'identification de l'un d'eux ne le remet pas à zéro. Redémarrer le serveur le remet aussi à zéro. Un navigateur qui s'est déjà identifié entre toujours avec le mot de passe correct : les mots de passe erronés d'autres personnes ne peuvent donc pas te bloquer l'accès depuis un appareil que tu utilises déjà.

Par défaut, la fenêtre du navigateur affiche **Marinara Engine**. Ce texte se change avec la variable `BASIC_AUTH_REALM`.

Certains clients passent outre le mot de passe, même quand Basic Auth est activé :

- Loopback (`127.0.0.1`, `::1`) : tu n'as donc jamais besoin de mot de passe sur la machine hôte elle-même. Les visiteurs transmis par un reverse proxy ou un tunnel sur cette machine en ont toujours besoin.
- Toute adresse présente dans `IP_ALLOWLIST`. Attention : définir une liste d'autorisation bloque aussi toutes les adresses absentes de cette liste (voir l'option 2).
- Le trafic Tailscale direct (`100.64.0.0/10`), sauf si tu désactives son contournement.
- Le trafic Docker de pont ou de passerelle, uniquement si tu définis `BYPASS_AUTH_DOCKER=true`. Quand Basic Auth est activé, la confiance automatique envers Docker est désactivée (voir [Contournement Tailscale et Docker](#tailscale-and-docker-bypass)).
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
- Loopback est toujours autorisé : impossible de te couper toi-même l'accès local. Les visiteurs transmis par un reverse proxy ou un tunnel sur la même machine ne sont pas du loopback : la liste d'autorisation les bloque donc. Derrière un proxy, utilise Basic Auth.
- Avec Docker Desktop, OrbStack et Docker sans root (rootless), tous les appareils atteignent le conteneur depuis la même adresse de passerelle : la liste d'autorisation ne peut donc pas les distinguer. Dans ce cas, utilise Basic Auth.
- Le trafic Tailscale direct contourne aussi la liste, sauf si tu désactives son contournement. Le trafic Docker de pont ou de passerelle ne la contourne que si tu définis `BYPASS_AUTH_DOCKER=true` (voir [Contournement Tailscale et Docker](#tailscale-and-docker-bypass)).
- Les entrées invalides sont ignorées et consignées dans les logs. Elles ne font pas planter le serveur.
- La liste reste stricte même quand Basic Auth est activé. Les adresses listées évitent la demande de mot de passe. Toutes les autres restent bloquées avec une erreur **403 Forbidden**, sans jamais voir de fenêtre d'identification.

La liste d'autorisation ne permet pas un montage mixte, où les appareils listés éviteraient le mot de passe pendant que tous les autres s'identifient. Si tu veux que les autres appareils s'identifient avec un mot de passe, laisse la variable `IP_ALLOWLIST` vide et utilise Basic Auth seul.

L'application de la liste se désactive un moment, sans supprimer la liste elle-même. C'est pratique quand tu cherches un problème depuis une nouvelle IP. Mets l'indicateur d'activation à false :

```env
IP_ALLOWLIST_ENABLED=false
```

## Option 3 : contournement pour réseau privé (sans mot de passe)

Ton réseau entier est peut-être de confiance, par exemple un LAN domestique (réseau local) sans redirection de ports. Dans ce cas, tu peux lever le verrouillage sans définir de mot de passe :

```env
ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true
```

Ce réglage rétablit l'ancien comportement "ouvert sur le LAN, bloqué depuis Internet". Il ne s'applique qu'aux plages standards de réseau privé, par exemple `10.0.0.0/8`, `172.16.0.0/12` et `192.168.0.0/16`. La plage CGNAT `100.64.0.0/10` ne compte pas, car certains fournisseurs d'accès la partagent entre des clients sans lien entre eux ; ajoute-la à `TRUSTED_PRIVATE_NETWORKS` seulement si tu lui fais confiance. Les adresses publiques d'Internet restent bloquées avec une erreur 403. Certains fournisseurs d'accès internet et mobiles donnent à leurs clients des adresses dans cette plage. Si tu l'ajoutes, les autres clients du même fournisseur comptent aussi comme des clients de réseau privé. `TRUSTED_PRIVATE_NETWORKS` remplace les plages par défaut ; garde donc dans la liste les plages LAN dont tu as encore besoin.

Avertissement : n'importe qui sur le même réseau atteint alors Marinara sans mot de passe. C'est acceptable sur un réseau que tu maîtrises. Ça ne l'est pas sur le Wi-Fi partagé d'un café, d'un aéroport ou d'une résidence étudiante. Dans le doute, utilise plutôt Basic Auth.

Il existe aussi un indicateur plus large, `ALLOW_UNAUTHENTICATED_REMOTE=true`, qui autorise l'accès sans mot de passe depuis N'IMPORTE QUELLE adresse, Internet compris. Ne l'active pas. Si tu as vraiment besoin d'un accès public, utilise Basic Auth avec le HTTPS, ou place devant un reverse proxy qui gère l'identification.

<a id="tailscale-and-docker-bypass"></a>

## Contournement Tailscale et Docker

Deux indicateurs permettent au trafic Tailscale et Docker direct de contourner à la fois la liste d'autorisation d'IP et Basic Auth, exactement comme le fait loopback. Laisse-les vides pour la détection automatique :

```env
BYPASS_AUTH_TAILSCALE=
BYPASS_AUTH_DOCKER=
```

Le mode automatique ne fait confiance à un appareil Tailscale que s'il se connecte directement à l'adresse Tailscale de cet ordinateur. Sous Linux, une interface Tailscale au nom personnalisé (`tailscaled --tun=...`) n'est pas approuvée automatiquement ; connecte-toi ou définis `BYPASS_AUTH_TAILSCALE=true`. Il ne fait confiance au trafic Docker que si Marinara s'exécute dans un conteneur et si la source correspond à une interface de conteneur détectée ou à sa passerelle exacte. Les configurations privées habituelles avec Tailscale et Docker sur le même hôte continuent ainsi de fonctionner, sans considérer comme authentifié du trafic CGNAT, LAN, réseau de l'hôte ou proxy sans rapport.

La confiance automatique envers Docker ne s'applique que tant que ni Basic Auth ni `IP_ALLOWLIST` ne sont définis. Docker Desktop, OrbStack et Docker sans root font passer chaque appareil qui ouvre un port publié par la passerelle du conteneur : Marinara ne peut donc pas distinguer ton propre navigateur d'un téléphone ou d'un inconnu sur le réseau. Dès que tu définis un mot de passe ou une liste d'autorisation, chaque client Docker doit les franchir, y compris le navigateur de l'hôte. Ne définis `BYPASS_AUTH_DOCKER=true` que si tu fais confiance à chaque appareil capable d'atteindre le port publié.

Mets un indicateur à `false` si tu veux appliquer à ces clients les vérifications normales de Basic Auth et de la liste d'autorisation d'IP. Mets-le à `true` pour conserver l'ancien contournement large quand la détection automatique n'est pas disponible : Tailscale fait alors confiance à toute la plage `100.64.0.0/10`, tandis que Docker fait aussi confiance à ses interfaces et à sa passerelle détectées, ainsi qu'à l'ancienne plage `172.16.0.0/12`. N'utilise ce mode de compatibilité que si tous les pairs correspondants sont de confiance.

Les visiteurs de Tailscale Serve et Funnel se connectent depuis le loopback avec des en-têtes de transmission, ils doivent donc se connecter. Aucun indicateur ne permet de le désactiver. Une connexion `100.x` directe reste sans mot de passe.

Par exemple, si ton tailnet compte des pairs moins fiables, désactive le contournement Tailscale :

```env
BYPASS_AUTH_TAILSCALE=false
```

Si tu ne veux pas que les pairs Docker détectés contournent l'authentification, désactive le contournement Docker et ajoute au besoin certains clients à `IP_ALLOWLIST` :

```env
BYPASS_AUTH_DOCKER=false
```

Marinara peut aussi se trouver derrière un conteneur reverse proxy ou tunnel, sur le pont Docker ou sur la passerelle détectée. Les en-têtes de transmission, comme `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host` ou `X-Forwarded-Proto`, signalent que le pair Docker représente un autre client, tout comme un Host qui désigne un autre ordinateur (par exemple `marinara:7860` ou un nom public) ou une requête HTTP/1.0. Marinara applique alors par défaut ses contrôles habituels, Basic Auth et liste d'autorisation d'IP. Une requête vers `localhost` ou `127.0.0.1` depuis le navigateur de l'hôte reste sans mot de passe tant qu'aucune connexion ni liste d'autorisation n'est définie :

```env
REQUIRE_AUTH_FOR_DOCKER_PROXY=true
```

Pour rétablir l'ancien contournement, mets ce réglage à `false`. Ne le fais que si le proxy lui-même exige une connexion de chaque visiteur, car les clients transmis héritent alors du statut sans mot de passe de Docker. Si tu mets un proxy devant Docker, garde la publication du port sur `127.0.0.1` dans `docker-compose.yml` et définis d'abord une connexion.

Le serveur écrit un avertissement `[auth-bypass]` dans les logs la première fois qu'un de ces contournements laisse passer une requête. Cet avertissement confirme que le contournement est actif.

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Reverse proxies et tunnels sur le même ordinateur

Un reverse proxy ou un tunnel installé sur la machine qui exécute Marinara, comme nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve ou Funnel, ou ngrok, se connecte à Marinara depuis loopback. Marinara le reconnaît grâce aux en-têtes de transmission que le proxy ajoute : `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, les en-têtes d'identité Tailscale ou `Via`. Marinara reconnaît aussi une requête qui arrive en HTTP/1.0, car les navigateurs ne l'utilisent jamais, mais un `proxy_pass` nginx par défaut si. Marinara reconnaît aussi une requête dont l'en-tête Host désigne un autre ordinateur, comme un domaine ou une adresse du réseau local, même lorsque le proxy n'ajoute aucun en-tête. Il traite alors chaque requête comme le visiteur distant qu'elle représente :

- Basic Auth s'applique : définis donc `BASIC_AUTH_USER` et `BASIC_AUTH_PASS`. Sans eux, les visiteurs tombent sur la page de configuration.
- `IP_ALLOWLIST` bloque les visiteurs transmis, car le proxy masque leurs vraies adresses.
- Les actions privilégiées demandent le secret d'administration, et les fonctions réservées à loopback restent indisponibles.

Ton propre navigateur sur cette machine, ouvert sur `http://127.0.0.1:7860` ou `http://localhost:7860`, reste sans mot de passe.

Caddy, Traefik, Cloudflare Tunnel, Tailscale et ngrok ajoutent des en-têtes de transmission par défaut. Pour nginx, cette ligne reste recommandée dans le bloc `location` :

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Les outils qui transmettent des connexions brutes, comme `socat` ou `ssh -R`, n'ajoutent aucun en-tête : leur trafic paraît donc local. Ne les utilise pas pour publier Marinara.

Si ton proxy oblige déjà chaque visiteur à s'identifier avant de transmettre quoi que ce soit, tu peux ignorer les contrôles propres à Marinara pour son trafic. Ne le fais que si le proxy lui-même exige une connexion de chaque visiteur :

```env
REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false
```

Les visiteurs obtiennent alors le même accès complet que la machine hôte, y compris les actions privilégiées sans le secret d'administration. Si tu n'atteins Marinara que par un nom ajouté à `/etc/hosts`, n'utilise pas cet indicateur. Utilise plutôt un nom `*.localhost`, par exemple `marinara.localhost`.

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
2. Choisis une option d'accès parmi celles ci-dessus. Basic Auth est la plus simple pour un téléphone sur le Wi-Fi de la maison.
3. Trouve l'adresse IP locale de la machine qui exécute le serveur (par exemple `192.168.1.50`).
4. Sur le téléphone, ouvre `http://192.168.1.50:7860` dans un navigateur. Le port par défaut est `7860`.
5. Si tu as activé Basic Auth, saisis le nom d'utilisateur et le mot de passe quand ils te sont demandés.

Si la page ne se charge pas du tout, le serveur n'est sans doute pas joignable. Vérifie `HOST=0.0.0.0` et la valeur de la variable `PORT`. Si tu obtiens plutôt une erreur 403, ton appareil joint bien le serveur mais n'est pas encore autorisé. Reprends l'option que tu as choisie plus haut.

<a id="locked-out-after-updating"></a>

## Verrouillé après une mise à jour

Les versions récentes demandent une connexion lorsqu'une visite passe par un reverse proxy, un tunnel, Tailscale Serve ou Tailscale Funnel. Les anciennes versions laissaient entrer ces visites sans mot de passe. Si tu vois maintenant une page de connexion, une page de configuration ou un **403**, c'est la raison.

Pour revenir :

1. Ouvre Marinara sur l'ordinateur qui l'exécute, à l'adresse `http://localhost:7860` (ou ton propre `PORT`). L'usage local ne demande pas de mot de passe. Dans Docker, c'est vrai uniquement tant qu'aucune connexion ni `IP_ALLOWLIST` n'est définie. Sinon, utilise ta connexion.
2. Ouvre le fichier `.env` sur cet ordinateur et définis `BASIC_AUTH_USER` et `BASIC_AUTH_PASS`. Si `IP_ALLOWLIST` est définie, ajoute-y l'adresse de ton autre appareil ou supprime-la, car un appareil absent de la liste reçoit un **403** même avec une connexion.
3. Enregistre le fichier. Marinara prend en compte le changement en quelques secondes. Si ce n'est pas le cas, ou si tu utilises Docker, redémarre Marinara. Connecte-toi ensuite depuis ton autre appareil avec ce nom d'utilisateur et ce mot de passe.

## Moteurs de recherche

Marinara demande aux moteurs de recherche de ne pas indexer ses pages (`X-Robots-Tag: noindex, nofollow`). Cela ne protège pas ton installation et ne supprime pas les pages déjà indexées. Utilise les contrôles d'accès ci-dessus pour garder ton installation privée.

## Guides associés

- La [référence de configuration du serveur](CONFIGURATION.md) donne la liste complète des réglages du fichier `.env` et les cas particuliers.
- Le guide [Résoudre les problèmes de Marinara Engine](TROUBLESHOOTING.md) couvre les erreurs de connexion, l'accès mobile et bien d'autres cas.
- La [foire aux questions](FAQ.md) explique rapidement comment atteindre Marinara depuis un autre appareil.
