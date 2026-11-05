# Intégration Home Assistant

Cette intégration permet à tes personnages IA de piloter de vrais appareils de maison connectée depuis un chat, comme les lumières, le chauffage, les volets et les lecteurs multimédias. Elle permet aussi aux automatisations Home Assistant d'envoyer des messages dans Marinara Engine. Home Assistant est une plateforme gratuite et open source pour les appareils de maison connectée. Si tu ne l'utilises pas, tu n'as pas besoin de ce guide.

## Ce que l'intégration ajoute

L'intégration est un petit logiciel qui s'installe dans Home Assistant et le relie à ton serveur Marinara. À la première configuration, elle crée pour toi les éléments suivants. Tu n'as jamais à copier d'adresse d'outil ni à configurer d'outil à la main.

- Des outils de maison connectée dans la section **Functions** du panneau Presets. Voir [Outils personnalisés](../extending/custom-tools.md).
- Un agent nommé **Home Assistant**, une aide IA qui tourne en parallèle de ton chat. Voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).
- Des entités Home Assistant (appareils, capteurs et commandes), pour que tu puisses surveiller et piloter Marinara depuis Home Assistant.

## Avant de commencer

- Home Assistant en version 2024.1.0 ou plus récente.
- HACS installé dans Home Assistant. HACS, le Home Assistant Community Store, est un outil qui sert à installer des intégrations personnalisées.
- Marinara en fonctionnement et accessible depuis la machine qui héberge Home Assistant. L'adresse par défaut est `localhost:7860`.
- `WEBHOOK_LOCAL_URLS_ENABLED=true` dans le fichier `.env` de Marinara.

Le fichier `.env` est le fichier de réglages en texte brut du serveur Marinara. Voir [Configuration du serveur](../CONFIGURATION.md) pour savoir où il se trouve. L'intégration passe par un webhook, une adresse web qui permet à une application d'envoyer des données à une autre. Le webhook de Home Assistant est une adresse locale en simple `http`, et Marinara bloque ces adresses par défaut, par sécurité. Ce réglage les autorise. Ajoute cette ligne et enregistre. Le réglage prend effet sans redémarrage, en général en quelques secondes (jusqu'à environ 30 secondes) :

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### Si Home Assistant tourne sur un autre appareil

L'intégration se connecte sans nom d'utilisateur ni mot de passe, et le formulaire de configuration ne prévoit aucun champ pour en saisir.

- Même machine : la connexion fonctionne telle quelle.
- Autre appareil : Marinara la bloque par défaut. Ajoute l'adresse IP de cet appareil (le numéro qui l'identifie sur ton réseau) à `IP_ALLOWLIST` dans `.env`. Sur un réseau domestique entièrement fiable, tu peux à la place définir `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true`.
- Si Marinara utilise `BASIC_AUTH_USER` et `BASIC_AUTH_PASS` (la connexion par identifiant), l'intégration ne peut pas se connecter. Elle ne fonctionne alors que depuis la même machine ou depuis un appareil listé dans `IP_ALLOWLIST`.

Voir [Accès à distance](../REMOTE_ACCESS.md) pour savoir quelle option choisir.

## Installer l'intégration

### L'ajouter à HACS

1. Dans Home Assistant, ouvre **HACS**.
2. Ouvre le menu à trois points et clique sur **Custom repositories**.
3. Dans le champ du dépôt, saisis `https://github.com/Pasta-Devs/Marinara-Engine`.
4. Choisis la catégorie **Integration** et clique sur **Add**.
5. Cherche **Marinara Engine** et installe-le.
6. Redémarre Home Assistant.

### La configurer

1. Va dans **Settings → Devices & Services** (Paramètres → Appareils et services) et clique sur **Add Integration**.
2. Cherche **Marinara Engine**.
3. Saisis le **Host** et le **Port** où tourne Marinara. Par défaut : `localhost` et `7860`.
4. Clique sur **Submit**.

Si ça n'a pas marché : Home Assistant affiche une erreur quand il n'arrive pas à joindre Marinara. Voir [Dépannage](#troubleshooting).

Quand la configuration aboutit, l'intégration enregistre un webhook privé dans Home Assistant, crée les outils dans la section **Functions** de Marinara, déjà pointés vers ce webhook, crée l'agent **Home Assistant** avec la liste de tous les outils activés, et crée les entités décrites plus bas.

## Ajouter l'agent à un chat

Créer l'agent ne l'attache pas à tous les chats. Ajoute-le à chaque chat où tu veux piloter la maison connectée.

1. Ouvre le chat et clique sur **Chat Settings** (réglages du chat).
2. Ouvre la section **Agents**.
3. Ajoute l'agent **Home Assistant**.

Il fonctionne dans les chats Roleplay, Conversation et Game. Une fois l'agent ajouté, les outils sont accessibles à l'IA dans ce chat. Rien d'autre à activer.

### Vérifier que tout fonctionne

1. Dans ce chat, écris une demande simple, par exemple `Turn on the office lights`, et envoie-la.
2. L'IA doit appeler un outil comme `ha_turn_on`, les lumières doivent s'allumer, et l'IA confirme.

Si rien ne se passe, vérifie que `WEBHOOK_LOCAL_URLS_ENABLED=true` est bien défini, et consulte [Dépannage](#troubleshooting).

## Choisir les outils que l'IA peut utiliser

Les outils sont répartis en huit catégories. Pour choisir celles que Marinara peut utiliser, ouvre **Settings → Devices & Services**, clique sur **Marinara Engine**, puis sur **Configure**. Deux options s'affichent :

- **Primary Chat** (chat principal) : le chat visé par défaut par les services Home Assistant.
- **Exposed Tool Categories** (catégories d'outils exposées) : les catégories que Marinara peut utiliser.

| Catégorie | Par défaut | Outils |
| --- | --- | --- |
| Lights & Switches | On | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate | On | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage) | On | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks | Off | ha_lock, ha_unlock |
| Media Players | On | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts | On | ha_activate_scene, ha_run_script |
| Query | On | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced) | Off | ha_call_service |

> **Avertissement :** **Generic Service Calls (Advanced)** permet à l'IA d'appeler n'importe quel service Home Assistant. **Locks** lui permet de verrouiller et de déverrouiller les portes. Les deux sont désactivées par défaut. Ne les active que si tu le souhaites.

La plupart des outils acceptent un appareil ou un nom de pièce. Avec un nom de pièce, l'outil agit sur tous les appareils correspondants de cette pièce. Les changements de catégories prennent effet après un appui sur **Marinara Sync HA Tools** ou un redémarrage de Home Assistant.

## Entités dans Home Assistant

L'intégration crée ces entités sous un appareil nommé **Marinara Engine**.

| Entité | Type | Rôle |
| --- | --- | --- |
| Marinara Chat Count | Sensor | Nombre total de chats Marinara |
| Marinara Active Agent Count | Sensor | Nombre d'agents Marinara activés |
| Marinara Active Chat | Select | Choisit le chat visé par les services |
| Marinara Agent: (nom) | Switch | Active ou désactive un agent, un interrupteur par agent |
| Marinara Abort Generation | Button | Annule toute réponse IA en cours de génération |
| Marinara Sync HA Tools | Button | Renvoie tous les outils et reconstruit l'agent Home Assistant |

L'intégration interroge Marinara toutes les 30 secondes pour repérer les nouveaux chats et agents. Ce que tu viens de créer peut donc mettre jusqu'à 30 secondes à apparaître.

### Resynchroniser après un changement de réglages

Appuie sur **Marinara Sync HA Tools** sur la page de l'appareil **Marinara Engine**. L'intégration met à jour les outils existants sur place, reconstruit l'agent **Home Assistant** si tu l'as supprimé, et désactive (sans les supprimer) les outils dont tu as coupé la catégorie. Ne modifie pas à la main les outils Home Assistant dans Marinara. La prochaine synchronisation écrase tes modifications et réactive les outils.

## Piloter Marinara depuis les automatisations

L'intégration ajoute deux services Home Assistant pour les automatisations. Ils s'exécutent dans Home Assistant, pas dans Marinara. Tous deux visent par défaut ton **Primary Chat**.

### Send Message (marinara_engine.send_message)

- `message` : le texte du message. Obligatoire.
- `chat_id` : le chat destinataire. Laissé vide, c'est le Primary Chat qui est utilisé.
- `role` : `user`, `assistant`, `system` ou `narrator`. Par défaut : `user`.
- `trigger_generation` : à true, l'IA répond aussi. Par défaut : false.

Cette automatisation prévient l'IA quand la porte d'entrée s'ouvre :

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### Trigger Generation (marinara_engine.trigger_generation)

Ce service lance une réponse de l'IA sans message visible.

- `chat_id` : le chat à utiliser. Laissé vide, c'est le Primary Chat qui est utilisé.
- `user_message` : un message facultatif à joindre au tour de réponse.

<a id="troubleshooting"></a>

## Dépannage

### Le formulaire de configuration annonce qu'il n'arrive pas à se connecter

Vérifie que Marinara tourne et que le **Host** et le **Port** correspondent à son adresse d'écoute (par défaut `localhost` et `7860`). Si Home Assistant tourne sur un autre appareil, Marinara le bloque, sauf si l'appareil figure dans `IP_ALLOWLIST`. L'intégration ne peut transmettre aucun mot de passe : un Marinara protégé par une connexion la rejette donc aussi. Voir [Accès à distance](../REMOTE_ACCESS.md). Ces règles restent valables après la configuration. Si Marinara bloque plus tard l'appareil, les capteurs et la liste des chats cessent de se mettre à jour, sans prévenir.

### L'IA tente un outil d'appareil, mais rien ne se passe

L'appel du webhook est probablement bloqué. Ajoute `WEBHOOK_LOCAL_URLS_ENABLED=true` au fichier `.env` et enregistre. Sans ce réglage, les appels d'outils peuvent échouer avec un message indiquant que `http` n'est pas autorisé ou qu'une adresse privée est refusée. Si Marinara et Home Assistant tournent sur la même machine, l'intégration utilise automatiquement l'adresse interne. Si Marinara tourne sur un autre appareil, vérifie que l'adresse locale de Home Assistant est joignable depuis cet appareil.

### Les outils n'apparaissent pas dans Functions

Appuie sur **Marinara Sync HA Tools**, ou redémarre Home Assistant, puis regarde la section **Functions** du panneau Presets.

### L'agent Home Assistant n'est pas dans mon chat

Vérifie que l'agent existe dans Marinara, sous Agents. S'il manque, appuie sur **Marinara Sync HA Tools** pour le reconstruire. Ajoute-le ensuite dans **Chat Settings → Agents**.

### Retrouver l'adresse du webhook à la main

Tu en auras rarement besoin, puisque chaque outil a déjà l'adresse. Ouvre **Settings → Devices & Services → Marinara Engine** dans Home Assistant. Le webhook suit ce format, où 8123 est le port Home Assistant par défaut :

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## Désinstaller

Supprime l'intégration dans **Settings → Devices & Services → Marinara Engine** dans Home Assistant. Les entités disparaissent alors. Les outils de la section **Functions** de Marinara et l'agent **Home Assistant** restent. Supprime-les à la main dans Marinara si tu n'en veux plus.

## Guides associés

- [Outils personnalisés](../extending/custom-tools.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Configuration du serveur](../CONFIGURATION.md)
- [Accès à distance](../REMOTE_ACCESS.md)
