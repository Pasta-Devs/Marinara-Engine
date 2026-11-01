# Se connecter à un fournisseur d'IA

Ce guide explique comment relier Marinara Engine à un fournisseur d'IA pour que tes personnages puissent répondre. Tu ajoutes un compte, tu colles sa clé et tu choisis le modèle qui répond dans tes chats.

## Comptes et modèles

Un **compte**, c'est une clé, une identification ou une adresse pour un fournisseur d'IA. Il retient le fournisseur, la clé, l'adresse et ses limites. Si tu utilises deux clés pour le même fournisseur, tu as deux comptes.

Un **modèle** est un modèle d'IA que tu as enregistré depuis un compte, comme GPT ou Claude. Chaque modèle enregistré garde ses propres réglages. Les modèles sont rangés sous leur compte dans le panneau **Connections** (Connexions).

Une clé API est un code secret fourni par le fournisseur d'IA. Elle fonctionne un peu comme un mot de passe. Marinara enregistre ta clé sur l'ordinateur qui fait tourner Marinara, et elle n'est jamais incluse dans un export.

Marinara Engine n'est livré ni avec un compte tout prêt, ni avec une clé de démarrage gratuite. Il faut ajouter au moins un compte avant de pouvoir démarrer un chat (une conversation enregistrée). Le **Built-in model** (modèle intégré), sous **On your computer** (sur ton ordinateur), est la seule exception : il tourne sur ton propre ordinateur sans compte (voir [Configuration du Local Model](local-model.md)).

## Le panneau Connections

Les comptes se gèrent dans le panneau **Connections**, à droite de l'application. De haut en bas, il affiche :

- **Search models and accounts** (rechercher des modèles et des comptes), qui filtre la liste au fil de la saisie.
- **Add** (ajouter), qui ouvre la fenêtre **Add account** (ajouter un compte), et **More actions** (plus d'actions, trois points), qui propose **Import account** (importer un compte), **Export all accounts** (exporter tous les comptes), le repli et le regroupement. Dans un panneau large, le menu déroulant de tri se trouve à côté de **Search models and accounts**. Dans un panneau étroit, le tri se trouve dans **More actions**.
- L'encadré **Jobs** (tâches). Il indique quel modèle s'occupe de chaque tâche, par exemple **Main** (principal) pour les réponses des chats ou **Images** pour les images. Voir [Choisir le modèle de chaque tâche](#choosing-the-model-for-each-job).
- Tes comptes, chacun avec ses modèles enregistrés en dessous. Voir [Organiser les connexions](organizing-connections.md).

## Ajouter un compte

1. Dans le panneau **Connections**, clique sur **Add**. La fenêtre **Add account** classe les fournisseurs sous **Popular** (populaires), **Subscriptions** (abonnements), **On your computer** et **All providers** (tous les fournisseurs). Tape dans **Search providers** (rechercher des fournisseurs) pour en trouver un.
2. Clique sur un fournisseur, par exemple **OpenAI**, **Anthropic** ou **OpenRouter**.
3. Colle la clé dans **API key** (clé API). **Where do I find my key?** (où trouver ma clé ?) ouvre la page des clés du fournisseur. Le bouton en forme d'œil affiche ou masque la clé. **More options** (plus d'options) contient le champ facultatif **Name** (nom), le champ **Address** (adresse), ainsi que **Requests per minute** (requêtes par minute) et **Parallel jobs** (tâches en parallèle).
4. Clique sur **Connect** (connecter). Marinara teste la clé. En cas d'échec, la fenêtre en indique la raison et propose **Try again** (réessayer). Les serveurs sur ton ordinateur proposent aussi **Continue anyway** (continuer quand même).
5. Quand tu ajoutes ton premier compte sans modèle Main, ou que tu ajoutes un compte en démarrant un chat, la fenêtre passe au choix du modèle. Choisis un modèle. **Make … my Main** (faire de … mon Main) le définit comme Main quand ce choix s'affiche. Clique sur **Done** (terminé) pour finir, ou sur **Start chatting** (commencer à discuter) si tu es parti d'un nouveau chat. Si tu as déjà un Main et que tu ajoutes un compte depuis le panneau, la fenêtre se ferme après Connect et le panneau affiche le nouveau compte. Les services d'images, de vidéo et de voix ont leurs propres contrôles de configuration ; le modèle intégré utilise son écran de configuration locale.

Tu pourras changer plus tard le modèle de chaque tâche dans l'encadré **Jobs**.

Si tu laisses le champ **Name** vide, Marinara donne au compte le nom du fournisseur. Un deuxième compte pour le même fournisseur, sans nom saisi, reçoit les 4 derniers caractères de sa clé, par exemple `OpenAI · …a1b2`. Un nom que tu saisis n'est jamais modifié.

En général, le champ **Address** n'a pas besoin d'être modifié. Marinara le remplit pour les fournisseurs connus. Ne le change que pour un proxy ou un serveur sur ton ordinateur.

Certains fournisseurs utilisent une identification sur ton ordinateur au lieu d'une clé. Ils se trouvent sous **Subscriptions** et n'ont pas de champ de clé. Voir [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md). Pour te connecter à un modèle qui tourne sur ton propre ordinateur, consulte [Connecter un modèle local ou auto-hébergé](local-self-hosted.md). Pour tous les fournisseurs pris en charge et l'endroit où récupérer chaque clé, consulte [Fournisseurs d'IA pris en charge](providers-reference.md).

### Démarrer un chat sans compte

Si tu démarres un chat avant d'avoir un modèle, Marinara ouvre d'abord la fenêtre **Add account**. Après **Connect**, elle affiche les modèles du fournisseur. Clique sur l'un d'eux, puis sur **Start chatting**. Le pied de la fenêtre permet aussi d'en faire ton modèle **Main**.

<a id="choosing-the-model-for-each-job"></a>

## Choisir le modèle de chaque tâche

L'encadré **Jobs** liste toutes les tâches qu'un modèle peut accomplir, en quatre groupes :

- **Chat** : **Main** écrit les réponses dans tes chats. **Agents** fait tourner les agents d'assistance. **Impersonate** écrit à ta place.
- **Omnibar** : **Professor Mari** et **Quick answers** (réponses rapides).
- **Pictures & sound** (images et son) : **Images**, **Video** (vidéo) et **Voice (Text to Speech)** (voix, synthèse vocale).
- **Behind the scenes** (en coulisses) : **Decision** (décision), **Embeddings** et **Image reading** (lecture d'images).

Chaque ligne affiche le modèle qui s'occupe de cette tâche et son fournisseur, ou ce que fait la tâche sans modèle, par exemple **Follows Main** (suit Main) ou **Off** (désactivé). Une tâche qui a besoin d'un modèle affiche **Choose a model** (choisir un modèle).

Clique sur une ligne pour ouvrir la fenêtre **Model for** (modèle pour) de cette tâche. Elle affiche le modèle qui s'occupe de la tâche sous **Now** (actuel), tes modèles **Starred** (favoris), puis tes modèles enregistrés, classés par compte. **All models** (tous les modèles), sous un compte, ouvre son catalogue complet. Tape dans **Search all models or paste a model ID** (rechercher dans tous les modèles ou coller un ID de modèle) pour chercher dans tous les catalogues à la fois. Clique sur n'importe quel modèle pour lui confier la tâche ; inutile de l'enregistrer d'abord. **If it fails** (en cas d'échec), en haut de la fenêtre, choisit un second modèle qui répond quand le premier échoue. **Add account**, en bas, ouvre la fenêtre d'ajout.

Clique sur **Jobs** pour replier l'encadré jusqu'à son en-tête.

### Quand une fonction a besoin d'un modèle

Un agent ou une fonction qui ne peut pas marcher sans un certain type de modèle le signale avec une étiquette **Needs an image model** (ou son équivalent pour la vidéo, l'audio, la décision ou le chat). Elle s'affiche sur la carte de l'agent dans le panneau **Agents**, dans **Chat Settings** (réglages du chat), dans l'éditeur d'agent et dans les fenêtres d'images et de vidéo. Clique sur **Set up** (configurer) à côté pour ouvrir la fenêtre **Model for** de cette tâche, où tu peux choisir un modèle ou cliquer sur **Add account**. L'étiquette disparaît dès que la tâche a un modèle. Quand une réponse échoue parce qu'aucun modèle d'images n'est défini, le bouton **Set up** du message ouvre le panneau **Connections**.

## Tester un compte

**Connect** teste déjà la clé. Pour la tester de nouveau plus tard, ouvre le menu **⋯** du compte dans le panneau et clique sur **Test** (tester). L'éditeur du compte, **Edit account** (modifier le compte), propose **Test account** (tester le compte), qui vérifie la clé et l'adresse telles que tu les as saisies, avant l'enregistrement.

<a id="choosing-a-model-for-one-chat"></a>

## Choisir un modèle pour un seul chat

Un nouveau chat utilise ton modèle **Main**. Pour donner un autre modèle à un chat, ouvre le menu **Connections** dans la zone de saisie du chat, ou le champ **Model** (modèle) dans **Chat Settings → Connection** (réglages du chat → connexion). Les deux ouvrent **Model for this chat** (modèle pour ce chat) :

- **Now** indique le modèle qu'utilise le chat. **This chat only** (ce chat uniquement) signifie que le chat a son propre choix ; **follows Main** (suit Main) signifie qu'il utilise Main.
- **Recent** (récents) et **Starred** listent tes modèles par compte.
- **Search models or paste an ID…** (rechercher des modèles ou coller un ID) cherche dans tous les catalogues. **Browse** (parcourir) ouvre la liste complète d'un compte.
- **Follow Main** (suivre Main) efface le choix propre au chat. **Shuffle** (mélange) choisit un modèle différent à chaque fois.

Un choix ne change que ce chat. Le message qui suit un choix propose **Make it my Main model** (en faire mon modèle Main) et **Undo** (annuler). En Game Mode, le champ porte l'étiquette **GM / Party Model**.

## Erreurs fréquentes

Si un test ou un message échoue, commence par vérifier ces points :

- Une clé erronée ou expirée. Ouvre le menu **⋯** du compte, clique sur **Replace key** (remplacer la clé) et colle à nouveau la clé. Un compte sans clé affiche **Needs key**.
- Un compte désactivé. Il affiche **Off** ; clique sur **Turn on** (activer) dans son menu **⋯**.
- Une clé venant du mauvais fournisseur. Chaque fournisseur exige sa propre clé.
- Une **Address** bloquée ou injoignable. Laisse-la vide pour utiliser celle du fournisseur, sauf si tu passes par un proxy ou par un serveur sur ton ordinateur.

Pour d'autres solutions, consulte [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Organiser les connexions](organizing-connections.md)
- [Fournisseurs d'IA pris en charge](providers-reference.md)
- [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md)
- [Connecter un modèle local ou auto-hébergé](local-self-hosted.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
