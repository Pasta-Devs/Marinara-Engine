# Génération guidée et Impersonate

Ce guide explique deux façons d'orienter un chat dans Marinara Engine. La génération guidée pointe l'IA dans une direction sans publier de message visible. Impersonate (l'IA écrit à ta place) rédige ta propre réponse. Il présente aussi le menu Quick replies (réponses rapides), qui place les deux actions à côté du bouton **Send**.

## La génération guidée

Avec la génération guidée, tu dis à l'IA où emmener la prochaine réponse. Ton indication reste hors personnage. Elle oriente la réponse sans s'afficher comme un message de chat normal.

### Orienter une réponse avec /guided

La méthode principale pour guider une réponse est la commande slash `/guided`.

1. Saisis `/guided` suivi de ton indication dans le champ de message.
2. Appuie sur Enter ou clique sur **Send**.
3. L'IA génère sa prochaine réponse, orientée dans la direction demandée.

Par exemple, cette indication pousse la réponse suivante vers un aveu :

```
/guided make him admit he is lying
```

La commande a des alias courts. À la place de `/guided`, tu peux saisir `/narrator`, `/narrate` ou `/nar`.

Dans un chat de groupe, l'indication peut viser un seul personnage. Saisis `/guided respond for <character> <direction>`. Remplace `<character>` par le nom du personnage et `<direction>` par ton indication. Par exemple :

```
/guided respond for Alice make her admit she is lying
```

### La régénération guidée

Autre option : guider une réponse au moment de la régénérer. Marinara reprend alors le texte saisi dans le champ de message comme indication ponctuelle.

1. Ouvre **Settings** (Paramètres), puis **Advanced** (avancé), puis **Message Tools** (outils de message).
2. Active **Guide swipes/regens with chat input**. Ce réglage est désactivé par défaut.
3. Reviens dans un chat et saisis une indication dans le champ de message, sans l'envoyer.
4. Clique sur **Regenerate** (régénérer) sur le message de l'IA.

Quand le réglage est actif et que le champ contient du texte, l'infobulle du bouton **Regenerate** devient **Regenerate (guided)**. L'IA produit une nouvelle version de la réponse en suivant le texte saisi.

### Relire l'indication enregistrée

Quand une réponse a été produite avec une indication, Marinara conserve cette indication pour que tu puisses la relire plus tard. Une action **Stored guidance** (indication enregistrée), avec une icône de parchemin, apparaît alors sur le message.

1. Clique sur l'icône **Stored guidance** du message de l'IA.
2. Une fenêtre intitulée **Stored guidance** s'ouvre et affiche l'indication à l'origine de la réponse.

La fenêtre précise d'où vient l'indication :

- **/guided** : l'indication vient de la commande `/guided`.
- **Guided regenerate** : l'indication vient d'un clic sur **Regenerate** en mode guidé.
- **Game start** : l'indication vient de la configuration de Game Mode.

Pour les indications issues de `/guided` et de la régénération guidée, le bouton **Copy /guided** (copier la commande) ressort l'indication sous forme de commande `/guided` prête à l'emploi. Colle-la dans un autre chat pour réutiliser la même orientation.

## Impersonate

Impersonate fait écrire ton prochain message par l'IA, avec la voix de ton persona. Le persona est le personnage que tu incarnes, inscrit dans le chat sous la forme `{{user}}`. Pour en créer un, consulte [Personas utilisateur](../characters/personas.md).

Impersonate ne fonctionne que dans les chats Roleplay. Il n'est disponible ni dans les chats Conversation ni dans les chats Game. Si tu l'essaies dans un chat Conversation, le message "Impersonate is not available in Conversation mode." s'affiche.

### Utiliser /impersonate

1. Saisis `/impersonate` dans le champ de message. Tu peux ajouter une indication facultative derrière.
2. Appuie sur Enter ou clique sur **Send**.
3. L'IA rédige un message utilisateur dans la peau de ton persona et le publie dans le chat.

Par exemple, ceci fait écrire à l'IA un message, dans ta voix, qui pose une question sur la météo :

```
/impersonate ask about the weather
```

La commande a un alias court. À la place de `/impersonate`, tu peux saisir `/imp`.

Un message écrit par Impersonate se refait aussi. L'action **Regenerate** fonctionne sur les messages utilisateur créés par Impersonate, ce qui donne une autre version.

### Les réglages d'Impersonate

Impersonate dispose d'une section de réglages qui s'applique à chaque `/impersonate` lancé, dans tous les chats. Elle s'ouvre depuis les réglages propres au chat.

1. Ouvre le panneau **Chat Settings** (réglages du chat) d'un chat Roleplay.
2. Repère la section **Impersonate**.

La section contient ces contrôles :

- **Prompt Template** (modèle de prompt) : une instruction facultative envoyée au modèle à chaque impersonation. Laisse le champ vide pour utiliser le prompt du chat, ou la valeur par défaut intégrée si le chat n'en a pas. Un prompt est le texte que Marinara envoie à l'IA. Le champ accepte les macros `{{user}}`, `{{persona_description}}` et `{{impersonate_direction}}`. Une macro est un espace réservé que Marinara remplace par du vrai texte avant l'envoi. Clique sur **Built-in default** pour lire le texte par défaut. Le bouton **Reset** vide un modèle personnalisé.
- **Preset** : utilise un preset de prompt précis, pour les réponses d'Impersonate uniquement. Un preset est un ensemble de réglages de prompt enregistré. Voir [Presets](../prompts/presets.md). La valeur par défaut est **Use chat default**. Les presets ne s'appliquent qu'en Roleplay.
- **Connection** : achemine les réponses d'Impersonate vers une connexion précise, par exemple un modèle moins cher ou plus rapide. Une connexion est un lien enregistré vers un fournisseur d'IA. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md). La valeur par défaut est **Use chat default**. Autre possibilité : **Random**.
- **Skip agents** : quand l'option est active, Marinara saute le pipeline d'agents (trackers, routeurs de lorebooks et autres composants du même genre) pendant Impersonate. Impersonate reste ainsi rapide et ne modifie pas l'état du monde. L'option est désactivée par défaut. Voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).
- **Use CYOA as direction** : quand l'option est active, un clic sur un choix CYOA le transforme en indication d'Impersonate au lieu de l'envoyer comme message normal. CYOA signifie choose your own adventure : une série de choix cliquables que certains chats affichent après une réponse. Ce réglage est désactivé par défaut.

### Définir un prompt d'impersonate personnalisé

Autre option : définir un prompt d'impersonate pour un seul chat, avec une commande slash.

1. Saisis `/impersonate_prompt` suivi de ton prompt entre guillemets.
2. Appuie sur Enter.

Par exemple :

```
/impersonate_prompt "You will now play as my OC:"
```

Pour effacer le prompt propre au chat et revenir à la valeur par défaut, saisis :

```
/impersonate_prompt reset
```

La commande a un alias court, `/imp_prompt`.

## Le menu Quick replies

Le menu Quick replies ajoute des actions d'envoi supplémentaires à côté du bouton **Send** habituel. Il donne accès en un clic à la génération guidée et à Impersonate, sans saisir de commande slash.

Le choix des actions affichées se fait dans les réglages.

1. Ouvre **Settings**, puis **Advanced**, puis **Message Tools**.
2. Active **Quick replies**. L'option est désactivée par défaut.
3. Déplie-la pour choisir les actions à afficher. Une fois le menu activé, les trois actions sont actives par défaut.

Voici les trois actions :

- **Post only** : ajoute ton message au chat sans déclencher de réponse de l'IA. Tu peux aussi utiliser la commande de barre `/send <message>`.
- **Guide reply** : envoie le texte saisi comme indication `/guided` plutôt que comme message normal.
- **Impersonate** : génère une réponse dans la peau de ton persona, en prenant le texte saisi comme indication. Cette action est masquée dans les chats Conversation, où Impersonate ne fonctionne pas.

Quand une seule action est active, son bouton s'affiche directement à côté de **Send**. Quand plusieurs le sont, elles se regroupent dans un petit menu. Clique sur le bouton à trois points (intitulé **Quick replies**) pour l'ouvrir.

## Guides associés

- [Actions sur les messages : modifier, supprimer, swipe, régénérer](messages.md)
- [Peek Prompt : voir ce que l'IA a reçu](peek-prompt.md)
- [Personas utilisateur : créer et modifier](../characters/personas.md)
- [Presets](../prompts/presets.md)
