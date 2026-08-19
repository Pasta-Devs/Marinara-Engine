# Configurer le retour haptique

Ce guide explique comment laisser un personnage IA piloter des appareils haptiques connectés dans Marinara Engine. Au programme : installer l'application compagnon, ajouter l'agent **Haptic Feedback** (retour haptique) à un chat, se connecter à l'appareil, et les réglages tactiles que tu peux ajuster.

## Ce qu'est le retour haptique

Le retour haptique permet à un personnage IA d'envoyer des signaux tactiles à un appareil haptique connecté (un jouet intime) pendant un chat. Marinara Engine ne parle pas directement à l'appareil. Il envoie ses commandes à une application compagnon gratuite, **Intiface Central**, et c'est elle qui pilote l'appareil.

**Intiface Central** utilise un protocole d'appareil appelé **Buttplug.io**. C'est le même standard ouvert que prennent en charge de nombreux jouets et d'autres applications. Tu installes **Intiface Central** une seule fois, tu y associes l'appareil, et Marinara s'y connecte via une adresse réseau locale.

Le retour haptique est l'un des **Agents** du chat, ces assistants IA qui viennent s'ajouter à un chat. Il fonctionne dans les modes Conversation, Roleplay et Game.

## Avant de commencer

Trois choses doivent être prêtes avant d'activer le retour haptique.

1. Installe **Intiface Central** depuis le site officiel. Ouvre cette adresse dans le navigateur.

```
https://intiface.com/central/
```

2. Ouvre **Intiface Central** et démarre son serveur. Le bouton de démarrage du serveur se trouve dans l'application.
3. Associe ou connecte l'appareil dans **Intiface Central** pour que l'application le voie.

Si **Intiface Central** n'est pas lancé avec son serveur démarré, Marinara ne peut envoyer aucun signal tactile.

## Ajouter l'agent Haptic Feedback

L'ajout du retour haptique se fait comme pour n'importe quel autre agent, depuis les réglages du chat.

1. Ouvre un chat en mode Conversation, Roleplay ou Game.
2. Ouvre **Chat Settings** (réglages du chat) pour ce chat.
3. Va dans la section **Agents**.
4. Ajoute l'agent **Haptic Feedback** au chat.
5. Repère l'encart **Haptic Feedback** qui apparaît alors dans la liste **Agents**.

Active l'interrupteur **Haptic Feedback** en haut de l'encart. Quand il est désactivé, la description affiche "Allow this agent to send touch cues during the chat." Quand il est activé, elle affiche "Touch cues are enabled for this chat." L'interrupteur est désactivé par défaut.

Une fois l'interrupteur activé, l'IA peut envoyer des signaux tactiles cachés pendant qu'elle écrit. Ces signaux n'apparaissent pas sous forme de texte dans le chat. Marinara les envoie à tous les appareils connectés.

## Se connecter, rechercher et trouver l'appareil

Quand tu ouvres l'encart **Haptic Feedback**, Marinara tente de se connecter automatiquement à **Intiface Central** avec l'adresse enregistrée. La connexion manuelle est aussi possible.

L'encart affiche une ligne d'état avec un point coloré. Vert, la connexion est établie. Rouge, elle ne l'est pas. Juste à côté, un bouton affiche **Connect** (se connecter) quand tu es hors ligne et **Disconnect** (se déconnecter) quand tu es connecté.

Pour te connecter manuellement, clique sur **Connect**. Si tout se passe bien, la ligne affiche "Connected" avec l'adresse du serveur.

En cas d'échec, un message signale que l'application n'a pas pu se connecter. Il te demande de vérifier que **Intiface Central** est lancé et que son serveur est démarré. Le message contient un lien vers le site d'**Intiface Central**.

Une fois la connexion établie, l'encart indique combien d'appareils ont été trouvés. Il affiche "No devices found" quand aucun n'est branché, ou le nombre d'appareils le cas échéant. Clique sur **Scan for devices** (rechercher des appareils) pour relancer la recherche. Pendant la recherche, le bouton affiche "Scanning...". L'encart liste chaque appareil avec son nom et les actions qu'il prend en charge, comme vibrer ou tourner.

Marinara transmet aussi au Haptic Agent le nom Intiface exact, un type de jouet déduit des capacités et les actions compatibles. Il peut ainsi choisir le bon appareil et la bonne action au lieu de supposer que tout jouet est un vibrateur.

## Actions et motifs compatibles

Marinara utilise chaque type de sortie qu'Intiface annonce pour un appareil connecté : vibration, rotation, oscillation, constriction, gonflage, position linéaire, température, pulvérisation et éclairage. La position linéaire pilote les appareils de va-et-vient, de poussée ou de pompage ; le gonflage pilote les appareils à pompe pneumatique.

L'agent peut appliquer les motifs **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp** ou **Impact** à toute action autre que l'arrêt. Les motifs de position alternent de véritables cibles de mouvement, si bien qu'un mouvement de pompage ou de poussée se déroule dans le temps au lieu d'envoyer plusieurs mouvements à la fois.

### Le champ Intiface URL

Le champ **Intiface URL** contient l'adresse réseau du serveur **Intiface Central**. C'est une adresse WebSocket, c'est-à-dire un simple lien local que les deux applications utilisent pour communiquer. La valeur par défaut est indiquée ci-dessous.

```
ws://127.0.0.1:12345
```

L'adresse `127.0.0.1` signifie "cet ordinateur-ci". Si tu laisses le champ vide, Marinara utilise la valeur par défaut du serveur. Marinara mémorise aussi l'adresse dans le navigateur : elle est donc réutilisée d'un chat et d'un appareil à l'autre.

Si tu fais tourner Marinara dans Docker, ou si tu ouvres Marinara dans un navigateur sur un autre appareil, `127.0.0.1` n'atteindra pas **Intiface Central**. Dans ce cas, saisis l'adresse de l'ordinateur qui fait tourner **Intiface Central**. Elle ressemble à l'exemple ci-dessous, où tu remplaces les chiffres par l'adresse réelle de cet ordinateur.

```
ws://192.168.1.50:12345
```

## Sensibilité tactile

L'encart **Haptic Feedback** propose un réglage **Touch sensitivity** (sensibilité tactile) avec trois choix dans chaque mode de chat. La sensibilité oriente la tendance de l'agent à choisir une sortie douce ou forte ; elle n'impose pas de plafond strict. Chaque choix peut utiliser toute la plage d'intensité `0.0-1.0` de l'appareil quand l'action l'exige.

Les trois choix orientent le style de réponse de l'agent.

| Choix | Sensation | Notes |
|---|---|---|
| **Subtle** | Favorise un retour plus doux | Toute la plage reste disponible |
| **Standard** | Retour équilibré pour la plupart des scènes | Par défaut ; toute la plage reste disponible |
| **Intense** | Choisit plus volontiers un retour fort | Peut utiliser la sortie maximale |

**Standard** est sélectionné par défaut. Choisis le style de réponse qui convient à la scène. Marinara valide toujours chaque commande par rapport à la plage physique `0.0-1.0` d'Intiface.

## Contacts involontaires

Sous le réglage de sensibilité, chaque mode de chat affiche aussi un interrupteur **Incidental contact** (contacts involontaires). Il indique "Tiny taps for accidental brushes and bumps." Cet interrupteur est désactivé par défaut.

Quand il est désactivé, l'IA ignore les petits contacts accidentels de l'histoire. Elle n'envoie des signaux que pour un contact délibéré ou appuyé. Active-le si tu veux aussi de légères impulsions pour les frôlements et les chocs.

## Utiliser le retour haptique depuis un autre appareil

Par défaut, Marinara n'accepte les commandes haptiques que depuis l'ordinateur qui fait tourner le serveur Marinara. Le pilotage de l'appareil reste ainsi local et privé.

Du coup, le retour haptique ne fonctionne pas si tu ouvres Marinara depuis un téléphone ou un autre appareil. Cela vaut quand cet appareil se connecte à un serveur Marinara installé ailleurs. Les actions de connexion, de recherche et de commande sont refusées tant que tu ne changes pas les réglages du serveur.

Pour autoriser le pilotage haptique depuis un autre appareil, active un réglage serveur appelé `HAPTICS_ALLOW_REMOTE`. Tu dois aussi mettre en place une protection d'accès, comme Basic Auth ou un secret d'administration. Voir la [référence de configuration du serveur](../CONFIGURATION.md) pour le réglage. Voir le [guide de l'accès à distance](../REMOTE_ACCESS.md) pour la protection d'accès. L'accès administrateur se saisit dans **Settings** (Paramètres), zone **Advanced**, section **Admin Access**.

## Si ça ne fonctionne pas

Si l'IA ne déclenche jamais l'appareil, vérifie les points suivants dans l'ordre.

1. Vérifie que **Intiface Central** est ouvert et que son serveur est démarré.
2. Vérifie que l'appareil est associé et qu'il apparaît dans la liste des appareils après un clic sur **Scan for devices**.
3. Vérifie que le point d'état est vert et que l'interrupteur **Haptic Feedback** est activé.
4. Sur un téléphone ou un appareil distant, relis les notes sur l'accès à distance ci-dessus.

Quand **Intiface Central** n'est pas connecté, ou qu'aucun appareil n'est branché, Marinara ignore le signal tactile de l'IA sans rien dire. Aucune erreur n'apparaît dans le chat.

## Guides associés

- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Accès à distance : Basic Auth et liste d'autorisation d'IP](../REMOTE_ACCESS.md)
