# Configurer le retour haptique

Le retour haptique permet à un personnage IA d'envoyer des signaux tactiles à un appareil haptique connecté (un jouet intime) pendant un chat. Ce guide explique comment installer l'application compagnon, ajouter l'agent **Haptic Feedback** (retour haptique) à un chat, te connecter à ton appareil et ajuster les réglages tactiles.

Marinara Engine ne parle pas directement à l'appareil. Il envoie ses commandes à une application compagnon gratuite, **Intiface Central**, qui pilote ton appareil. Intiface Central utilise **Buttplug.io**, un standard ouvert que prennent en charge de nombreux jouets et applications. Marinara s'y connecte via une adresse réseau. Le retour haptique est un agent de chat (une aide IA que tu ajoutes à un chat). Il fonctionne dans les modes Conversation, Roleplay et Game.

## Avant de commencer

1. Installe **Intiface Central** depuis `https://intiface.com/central/`.
2. Ouvre l'application et démarre son serveur avec le bouton de démarrage du serveur.
3. Associe ton appareil dans Intiface Central pour que l'application le voie.

Tant qu'Intiface Central ne tourne pas avec son serveur démarré, Marinara ne peut pas envoyer de signaux tactiles. L'agent **Haptic Feedback** doit aussi être installé. Voir la [vue d'ensemble des agents](../agents/agents-overview.md).

## Ajouter l'agent Haptic Feedback

1. Ouvre un chat en mode Conversation, Roleplay ou Game.
2. Ouvre **Chat Settings** (réglages du chat) et va dans **Agents**.
3. Ajoute l'agent **Haptic Feedback**. Un encart **Haptic Feedback** apparaît dans la liste **Agents**.
4. Active l'interrupteur **Haptic Feedback** en haut de l'encart.

L'interrupteur est désactivé par défaut. Quand il est désactivé, la description affiche "Allow this agent to send touch cues during the chat." Quand il est activé, elle affiche "Touch cues are enabled for this chat." Une fois l'interrupteur activé, l'IA envoie des signaux tactiles cachés pendant qu'elle écrit. Ils n'apparaissent pas sous forme de texte dans le chat. Ils partent vers tous les appareils connectés.

## Se connecter et rechercher les appareils

Quand tu ouvres l'encart, Marinara tente de se connecter à Intiface Central avec l'adresse enregistrée. La ligne d'état affiche un point vert quand la connexion est établie et un point rouge sinon. Juste à côté se trouve **Connect** (se connecter) quand tu es hors ligne et **Disconnect** (se déconnecter) quand tu es connecté.

1. Clique sur **Connect**. En cas de succès, la ligne affiche "Connected" avec l'adresse du serveur.
2. Clique sur **Scan for devices** (rechercher des appareils) pour relancer la recherche. Pendant la recherche, le bouton affiche "Scanning...".

L'encart affiche "No devices found" ou le nombre d'appareils, et liste chacun avec son nom Intiface exact et les actions qu'il prend en charge. Marinara transmet aussi au Haptic Agent ce nom, un type de jouet déduit de ses capacités et ses actions, pour qu'il choisisse le bon appareil et la bonne action au lieu de supposer que tout jouet vibre.

Si ça n'a pas marché : en cas d'échec de la connexion, un message te demande de vérifier qu'Intiface Central tourne et que son serveur est démarré, avec un lien vers son site web.

## Actions et motifs compatibles

Marinara utilise chaque type de sortie qu'Intiface annonce pour un appareil : vibration, rotation, oscillation, constriction, gonflage, position linéaire, température, pulvérisation et éclairage. La position linéaire pilote les appareils de va-et-vient, de poussée ou de pompage. Le gonflage pilote les appareils à pompe pneumatique.

L'agent peut appliquer les motifs **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp** ou **Impact** à toute action autre que l'arrêt. Les motifs de position alternent de véritables cibles de mouvement, si bien qu'un motif de pompage ou de va-et-vient se déroule dans le temps au lieu d'envoyer plusieurs mouvements à la fois.

## Le champ Intiface URL

Le champ **Intiface URL** contient l'adresse WebSocket de ton serveur Intiface Central. Une adresse WebSocket est un lien que les deux applications utilisent pour communiquer. La valeur par défaut est :

```text
ws://127.0.0.1:12345
```

`127.0.0.1` désigne cet ordinateur-ci. Si tu laisses le champ vide, Marinara utilise la valeur par défaut du serveur, que tu peux changer avec la variable d'environnement `INTIFACE_URL` dans `.env`. Voir la [référence de configuration du serveur](../CONFIGURATION.md). Marinara enregistre ton adresse avec le chat et la mémorise dans ce navigateur : les autres chats que tu ouvres ici démarrent donc avec elle.

L'adresse reste sur cette installation de Marinara. Les exports de chat, les profils de réglages exportés et les fichiers **Export Profile** (exporter le profil) la laissent de côté, et l'import de l'un d'eux ne la définit jamais. Saisis-la de nouveau après avoir déplacé un chat vers une autre installation.

Si tu fais tourner Marinara dans Docker, ou si tu l'ouvres dans un navigateur sur un autre appareil, `127.0.0.1` n'atteindra pas Intiface Central. Saisis l'adresse de l'ordinateur sur lequel Intiface Central tourne, en remplaçant les chiffres par son adresse réelle :

```text
ws://192.168.1.50:12345
```

## Sensibilité tactile

L'encart propose un réglage **Touch sensitivity** (sensibilité tactile) dans chaque mode de chat. Il oriente la tendance de l'agent à choisir une sortie douce ou forte. Ce n'est pas un plafond : chaque choix peut utiliser toute la plage d'intensité `0.0-1.0` quand l'action l'exige. Marinara valide chaque commande par rapport à la plage physique d'Intiface.

| Choix | Sensation |
| --- | --- |
| **Subtle** | Favorise un retour plus doux. |
| **Standard** | Retour équilibré pour la plupart des scènes. C'est la valeur par défaut. |
| **Intense** | Choisit plus volontiers un retour fort. |

## Contacts involontaires

L'interrupteur **Incidental contact** (contacts involontaires), dont la description indique "Tiny taps for accidental brushes and bumps.", est désactivé par défaut. Quand il est désactivé, l'IA ignore les petits contacts accidentels et n'envoie des signaux que pour un contact délibéré ou appuyé. Active-le pour recevoir aussi de légères impulsions lors des frôlements et des chocs.

<a id="use-it-from-another-device"></a>

## Utiliser le retour haptique depuis un autre appareil

Par défaut, Marinara n'accepte les commandes haptiques que depuis l'ordinateur qui fait tourner le serveur Marinara. Le pilotage de l'appareil reste ainsi privé. Le retour haptique ne fonctionne donc pas quand tu ouvres Marinara depuis un téléphone ou un autre appareil qui se connecte à un serveur situé ailleurs. Les actions de connexion, de recherche et de commande sont refusées.

Pour l'autoriser, active le réglage serveur `HAPTICS_ALLOW_REMOTE` et mets en place une protection d'accès : une connexion par identifiants ou un secret d'administration. Voir la [référence de configuration du serveur](../CONFIGURATION.md) et le [guide de l'accès à distance](../REMOTE_ACCESS.md). L'accès administrateur se saisit dans **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur).

## Si ça ne fonctionne pas

Si l'IA ne déclenche jamais ton appareil, vérifie dans l'ordre :

1. Intiface Central est ouvert et son serveur est démarré.
2. Ton appareil est associé et apparaît dans la liste après **Scan for devices**.
3. Le point d'état est vert et l'interrupteur **Haptic Feedback** est activé.
4. Sur un téléphone ou un appareil distant, voir [Utiliser le retour haptique depuis un autre appareil](#use-it-from-another-device).

Quand Intiface Central n'est pas connecté, ou qu'aucun appareil n'est branché, Marinara ignore le signal sans rien dire et n'affiche aucune erreur dans le chat.

## Guides associés

- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Accès à distance : connexion et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
