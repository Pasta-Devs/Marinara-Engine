# Se connecter à un fournisseur d'IA

Pour discuter, Marinara Engine a besoin d'un modèle d'IA. Tu peux ajouter un compte pour un service d'IA, coller sa clé API et choisir un modèle. Une clé API est un code secret fourni par le service, qui permet à Marinara d'utiliser ton compte chez lui. Traite-la comme un mot de passe. Tu peux aussi utiliser le [Built-in model](local-model.md) (modèle intégré), un petit modèle qui tourne sur ton ordinateur sans clé.

## Ajouter un compte

Avant de commencer, procure-toi une clé API auprès d'un service que tu veux utiliser. La fenêtre **Add account** (ajouter un compte) propose un lien **Where do I find my key?** (où trouver ma clé ?) pour chaque service. Voici les pages qu'il ouvre pour les services courants.

- OpenRouter (propose des modèles gratuits) : `openrouter.ai/keys`
- NanoGPT : `nano-gpt.com/api`
- OpenAI : `platform.openai.com/api-keys`
- Anthropic : `console.anthropic.com/settings/keys`
- Google Gemini : `aistudio.google.com/apikey`

La plupart des services te demandent de créer un compte, et certains d'ajouter du crédit, avant qu'une clé fonctionne. Pour les autres services, voir [Fournisseurs d'IA pris en charge](providers-reference.md). Pour utiliser un modèle sur ton propre ordinateur sans clé, voir [Configuration du modèle intégré](local-model.md).

1. Clique sur **Connections** (Connexions) dans la barre du haut. Le panneau s'ouvre à droite. Si tu n'as encore aucun compte, il demande **Where do your models come from?** (d'où viennent tes modèles ?) et affiche quelques services. Clique sur un service (pas sur **Built-in model**). La fenêtre **Add account** s'ouvre sur l'étape de la clé. Passe à l'étape 4.
2. Clique sur **Add** (ajouter). La fenêtre **Add account** s'ouvre.
3. Clique sur le service voulu. Pour le trouver, tape dans la zone intitulée **Search providers** (rechercher des fournisseurs). La liste comporte les sections **Chat**, **Images & video** (images et vidéo), **Voice** (voix) et **Decisions** (décisions). Pour un modèle de chat normal, regarde sous **Chat**.
4. Clique sur **API key** (clé API) et colle ta clé. Clique sur le bouton en forme d'œil pour vérifier que tu l'as collée en entier.
5. Clique sur **Connect** (connecter). Marinara teste la clé. Quand elle fonctionne, tu vois **Connected** avec le nombre de modèles trouvés.
6. La suite varie selon que tu as déjà un modèle Main (principal) ou non. Main, c'est la tâche qui consiste à écrire les réponses de tes chats.
   - **Pas encore de modèle Main, ou tu as ouvert Add depuis un nouveau chat :** la fenêtre affiche les modèles du service. Les modèles **Recommended** (recommandés) sont en haut. Clique sur un modèle pour l'ajouter, ou tape un nom dans **Search or enter model ID…** (rechercher ou saisir un ID de modèle). Si tu ne sais pas lequel choisir, prends-en un **Recommended**. Tu pourras le changer plus tard. Laisse **Make … my Main model** (faire de … mon modèle Main) coché. Cette case ne s'affiche que si tu n'as aucun modèle Main. Si tu as ouvert Add depuis un nouveau chat et que tu as déjà un modèle Main, un bouton **Set … as Main** (définir … comme Main) s'affiche à la place. Clique ensuite sur **Done** (terminé), ou sur **Start chatting** (commencer à discuter) depuis un nouveau chat.
   - **Tu as déjà un modèle Main :** la fenêtre se ferme et un message indique que le compte a été ajouté, avec son nombre de modèles. Pour ajouter d'autres modèles, clique sur **⋯** sur le compte et choisis **Add model** (ajouter un modèle).

Le panneau affiche ton compte. **Connected**, à l'étape 5, veut déjà dire que la clé fonctionne. Si le nouveau modèle est ton modèle Main, démarre un chat et envoie un message : une réponse veut dire que tout fonctionne. Si tu avais déjà un modèle Main, les nouveaux chats l'utilisent toujours. Pour utiliser le nouveau compte, ajoute-lui un modèle (**⋯** → **Add model**), puis choisis ce modèle pour un chat ou une tâche (voir [Choisir le modèle de chaque tâche](#choosing-the-model-for-each-job)).

Si ça n'a pas marché :

- **The key was not accepted. Check that you copied all of it.** veut dire que la clé a été refusée : vérifie que tu l'as copiée en entier. Colle de nouveau la clé et clique sur **Try again** (réessayer). La clé doit venir du service que tu as choisi.
- **The service is busy, or your credit is used up.** veut dire que le service est occupé, ou que ton crédit est épuisé. Ajoute du crédit sur le site du service, ou attends et réessaie.
- **Marinara could not reach** s'affiche quand Marinara n'a pas pu joindre le service. Vérifie ta connexion internet, puis clique sur **Try again**.

### Champs facultatifs du compte

L'étape de la clé affiche aussi ces champs. Laisse-les vides, sauf si tu en as besoin.

- **Name (optional)** (nom, facultatif) : le nom affiché dans le panneau. Vide, c'est le nom du service. Un deuxième compte pour le même service reçoit les 4 derniers caractères de sa clé, par exemple `OpenAI · …a1b2`.
- **Address** (adresse) : l'endroit où Marinara envoie les requêtes. Quand ce champ est vide, Marinara utilise l'adresse propre au service. Ne le remplis que pour un proxy, une passerelle ou un serveur que tu fais tourner toi-même. Les services qui passent par une identification sur ton ordinateur ne l'affichent pas.
- **Requests per minute** (requêtes par minute) : ralentit Marinara sur ce compte. Vide veut dire sans limite. Les valeurs autorisées vont de 1 à 600.
- **Parallel jobs** (tâches en parallèle) : le nombre de requêtes exécutées en même temps. Vide veut dire sans limite. Les valeurs autorisées vont de 1 à 16. Dans **Edit account** (modifier le compte), ce même réglage s'appelle **Parallel requests** (requêtes en parallèle).

Certains services utilisent une identification sur ton ordinateur au lieu d'une clé. Ils affichent l'étiquette **Sign in** (se connecter) et n'ont pas de champ de clé. Voir [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md). Pour un serveur sur ton propre ordinateur, voir [Connecter un modèle local ou auto-hébergé](local-self-hosted.md). Après un test raté, **Continue anyway** (continuer quand même) apparaît. Ce bouton enregistre le compte sans test réussi.

### Démarrer un chat sans compte

Si tu démarres un chat avant d'avoir un modèle, Marinara ouvre d'abord la fenêtre **Add account**. Après **Connect**, clique sur un modèle, puis sur **Start chatting**.

## Le panneau Connections

Les comptes se gèrent dans le panneau **Connections**. De haut en bas, il affiche :

- Une zone de recherche qui filtre la liste au fil de la saisie. Elle s'intitule **Search models and accounts** (rechercher des modèles et des comptes).
- **Add**, qui ouvre **Add account**, et **More actions** (plus d'actions, trois points), qui propose **Import account** (importer un compte), **Export all accounts** (exporter tous les comptes), le repli et le regroupement. Dans un panneau large, le menu déroulant de tri se trouve à côté de la recherche. Dans un panneau étroit, le tri se trouve dans **More actions**.
- L'encadré **Jobs** (tâches). Il indique quel modèle s'occupe de chaque tâche.
- La carte **Built-in model**. Voir [Configuration du modèle intégré](local-model.md).
- Tes comptes, chacun avec ses modèles enregistrés en dessous. Voir [Organiser les connexions](organizing-connections.md).

Un **compte**, c'est une clé, une identification ou une adresse enregistrée pour un service. Si tu utilises deux clés pour le même service, tu as deux comptes. Un **modèle** est un modèle d'IA que tu as enregistré depuis un compte. Chaque modèle enregistré garde ses propres réglages.

<a id="choosing-the-model-for-each-job"></a>

## Choisir le modèle de chaque tâche

Une tâche, c'est quelque chose qu'un modèle fait pour toi. L'encadré **Jobs** les liste en quatre groupes :

| Groupe | Tâches |
| --- | --- |
| **Chat** | **Main** écrit les réponses dans tes chats. **Agents** fait tourner les agents d'assistance. **Impersonate** écrit à ta place. |
| **Omnibar** | **Professor Mari** et **Quick answers** (réponses rapides). |
| **Pictures & sound** (images et son) | **Images**, **Video** (vidéo), **Voice (Text to Speech)** (voix, synthèse vocale) et **Dictation (Speech to Text)** (dictée, reconnaissance vocale) quand elle est disponible. |
| **Behind the scenes** (en coulisses) | **Decision** (décision), **Embeddings** et **Image reading** (lecture d'images). |

Chaque ligne affiche le modèle qui s'occupe de cette tâche, ou ce que fait la tâche sans modèle, par exemple **Follows Main** (suit Main) ou **Off** (désactivé). Une tâche qui a besoin d'un modèle affiche **Choose a model** (choisir un modèle). Clique sur **Jobs** pour replier l'encadré.

Pour changer le modèle d'une tâche, clique sur sa ligne. La fenêtre **Model for** (modèle pour) de cette tâche s'ouvre, sauf pour trois lignes. **Decision** et **Embeddings** ouvrent leurs propres contrôles (voir [Modèles de décision](decision-models.md) et [Fournisseurs d'IA pris en charge](providers-reference.md#embeddings)). **Dictation (Speech to Text)** ouvre la configuration de la reconnaissance vocale.

Dans **Model for** :

1. Regarde la liste.
2. Clique sur un modèle. La liste l'affiche sous **Now** (actuel), puis tes modèles **Starred** (favoris), puis tes modèles enregistrés, classés par compte. **All models** (tous les modèles), sous un compte, ouvre sa liste complète. Tape dans **Search all models or paste a model ID** (rechercher dans tous les modèles ou coller un ID de modèle) pour chercher dans tous les comptes à la fois. Inutile d'enregistrer un modèle d'abord.

**If it fails** (en cas d'échec), en haut de la fenêtre, choisit un second modèle qui répond quand le premier échoue. **Add account**, en bas, ouvre la fenêtre d'ajout.

### Quand une fonction a besoin d'un modèle

Une fonction qui ne peut pas marcher sans un certain type de modèle affiche une étiquette **Needs an image model** (ou son équivalent pour la vidéo, l'audio, la décision ou le chat). Tu la vois sur la carte de l'agent dans le panneau **Agents**, dans **Chat Settings** (réglages du chat), dans l'éditeur d'agent et dans les fenêtres d'images et de vidéo. Clique sur **Set up** (configurer) à côté, puis choisis un modèle ou clique sur **Add account**. L'étiquette disparaît dès que la tâche a un modèle.

## Tester un compte

**Connect** teste déjà la clé. Pour tester de nouveau plus tard, ouvre le menu **⋯** du compte dans le panneau et clique sur **Test** (tester). L'éditeur du compte (**Edit account**) propose **Test account** (tester le compte), qui vérifie la clé et l'adresse telles que tu les as saisies, avant l'enregistrement.

<a id="choosing-a-model-for-one-chat"></a>

## Choisir un modèle pour un seul chat

Un nouveau chat utilise ton modèle **Main**. Pour donner un autre modèle à un chat, clique sur le bouton du modèle dans la zone de saisie du chat (l'icône de lien, qui porte le nom du modèle actuel), ou utilise le champ **Model** (modèle) dans **Chat Settings → Connection** (réglages du chat → connexion). Les deux ouvrent **Model for this chat** (modèle pour ce chat) :

- **Now** indique le modèle qu'utilise le chat. **This chat only** (ce chat uniquement) veut dire que le chat a son propre choix. **follows Main** (suit Main) veut dire qu'il utilise Main.
- **Recent** (récents) et **Starred** listent tes modèles par compte.
- **Search models or paste an ID…** (rechercher des modèles ou coller un ID) cherche dans tous les comptes. **Browse** (parcourir) ouvre la liste complète d'un compte.
- **Follow Main** (suivre Main) efface le choix propre au chat. **Shuffle** (mélange) choisit un modèle différent à chaque fois.

Un choix ne change que ce chat. Le message qui suit un choix propose **Make it my Main model** (en faire mon modèle Main) et **Undo** (annuler). En Game Mode, le champ s'intitule **Game Master model** (modèle du maître du jeu).

## Erreurs fréquentes

Si un test ou un message échoue, commence par vérifier ces points :

- Une clé erronée ou expirée. Clique sur **⋯** sur le compte, choisis **Replace key** (remplacer la clé) et colle à nouveau la clé. Un compte sans clé affiche **Needs key**.
- Un compte désactivé. Il affiche **Off**. Clique sur **Turn on** (activer) dans son menu **⋯**.
- Une clé venant d'un autre service. Chaque service exige sa propre clé.
- Une **Address** bloquée. Vide, elle utilise l'adresse propre au service.

Pour d'autres solutions, consulte [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md).

## Guides associés

- [Organiser les connexions](organizing-connections.md)
- [Fournisseurs d'IA pris en charge](providers-reference.md)
- [Connexions par abonnement Claude, ChatGPT et Grok](subscription-clis.md)
- [Connecter un modèle local ou auto-hébergé](local-self-hosted.md)
