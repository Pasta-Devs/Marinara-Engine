# Traduction des messages

Marinara Engine sait traduire les messages du chat d'une langue à l'autre. Ce guide explique comment choisir un service de traduction, définir les langues, activer la traduction automatique et traduire un seul message.

La traduction se règle chat par chat. Chaque chat garde son propre service, ses langues et ses clés. Pour démarrer de nouveaux chats avec les mêmes réglages, enregistre-les comme [réglages de traduction par défaut](#translator-defaults-for-new-chats).

## Où trouver les réglages de traduction

1. Ouvre un chat dans n'importe quel mode (Conversation, Roleplay ou Game).
2. Ouvre **Chat Settings** (réglages du chat).
3. Repère la section **Translation** (traduction).

Tous les réglages ci-dessous se trouvent dans cette section.

## Choisir un fournisseur

La liste **Provider** (fournisseur) propose quatre options.

| Fournisseur | Ce qu'il demande | Remarques |
| --- | --- | --- |
| **Google Translate** | Rien | Option par défaut. Gratuit, sans clé. Jusqu'à 5 000 caractères par requête. |
| **DeepL API** | Une clé API DeepL | Meilleure qualité. Les clés gratuites comme payantes fonctionnent. |
| **DeepLX (self-hosted)** | L'URL d'un serveur DeepLX | Pour un serveur DeepLX que tu héberges toi-même. |
| **AI (via connection)** | Un compte IA | Passe par un de tes modèles d'IA pour traduire. |

Google Translate fonctionne sans aucune configuration. N'en choisis un autre que si tu as besoin de ce qu'il apporte.

### Définir les langues

Deux champs définissent les langues. Les deux valent `en` (anglais) par défaut.

- **Model Language** (langue du modèle) est la langue que le modèle d'IA comprend et dans laquelle il répond. Quand tu écris dans ta propre langue, ton message est traduit dans celle-ci avant que l'IA ne le lise. **Translate My Messages** (traduire mes messages) et **Translate draft** (traduire le brouillon) l'utilisent.
- **My Language** (ma langue) est la langue que tu lis. Les réponses de l'IA sont traduites dans celle-ci. **Auto-Translate Responses** (traduire les réponses automatiquement) et le bouton **Translate** (traduire) de chaque message l'utilisent.

Par exemple, si tu écris en espagnol et que l'IA fonctionne mieux en anglais, règle **Model Language** sur `en` et **My Language** sur `es`.

Pour Google Translate, DeepL API et DeepLX, saisis un code court comme `en`, `ja`, `es`, `de`, `fr`, `zh` ou `ko`. Pour AI (via connection), saisis un nom de langue comme `English`, `Japanese` ou `Spanish`.

Si ça n'a pas marché : un code ou un nom erroné donne une erreur ou un texte inchangé. Vérifie le format attendu par ton fournisseur.

### DeepL API

Choisis **DeepL API** et colle la clé de ton compte DeepL dans **DeepL API Key** (clé API DeepL). Une clé qui se termine par `:fx` est une clé de niveau gratuit, et Marinara l'envoie au service gratuit de DeepL. Toute autre clé est traitée comme payante.

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

### DeepLX

DeepLX est un serveur de traduction gratuit que tu fais tourner toi-même. Choisis **DeepLX (self-hosted)** et saisis l'adresse de ton serveur dans **DeepLX URL** (URL du serveur DeepLX), par exemple `http://localhost:1188`.

Un serveur DeepLX installé sur ton ordinateur ou sur ton réseau local a une adresse locale. Par sécurité, Marinara bloque par défaut les adresses locales. Pour les autoriser, ajoute cette ligne à ton fichier `.env` et enregistre. Aucun redémarrage n'est nécessaire. Le réglage prend effet en général en quelques secondes, jusqu'à environ 30 secondes. La [Référence de configuration du serveur](../CONFIGURATION.md) indique où se trouve le fichier.

```text
DEEPLX_LOCAL_URLS_ENABLED=true
```

Un serveur DeepLX situé à une adresse publique sur Internet n'a pas besoin de ce réglage.

### AI (via connection)

Choisis **AI (via connection)** pour utiliser un de tes modèles d'IA. Trois champs apparaissent.

- **Connection** (connexion) : le compte IA qui traduit. Ce champ est obligatoire. S'il reste vide, la traduction échoue avec "Connection ID is required for AI translation". Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).
- **Outgoing Message Prompt** (prompt des messages sortants) et **Incoming Response Prompt** (prompt des réponses entrantes) : les instructions que l'IA reçoit quand elle traduit tes messages et ses propres réponses. Les deux partent d'une valeur par défaut intégrée que tu peux modifier pour ce chat. `{{targetLanguage}}` devient **Model Language** ou **My Language**. Après la modification d'un prompt, **Restore** (restaurer) le remet à sa valeur par défaut. Le prompt par défaut est :

```text
You are a translator. Translate the given text accurately into {{targetLanguage}},
preserving formatting, markdown, and any special characters like *asterisks* for actions.
Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Activer la traduction automatique

Quatre interrupteurs se trouvent sous les réglages du fournisseur. Tous sont désactivés au départ.

- **Auto-Translate Responses** : traduit chaque réponse de l'IA dès qu'elle est générée. En Game Mode, Marinara retire d'abord de la narration les balises réservées au GM (le maître du jeu).
- **Translate My Messages** : traduit ton message dans la langue **Model Language** juste avant qu'il ne parte vers l'IA, en remplaçant le texte que tu as saisi. Si la traduction échoue, Marinara envoie ton texte d'origine et affiche une erreur.
- **Show Draft Translate Button** (afficher le bouton de traduction du brouillon) : ajoute un bouton **Translate draft** à côté de **Send** (envoyer), pour que tu puisses relire et corriger la traduction avant l'envoi. C'est l'équivalent manuel de **Translate My Messages**.
- **Show Only Translation** (afficher uniquement la traduction) : affiche la traduction d'un message traduit à la place de l'original, au lieu des deux ensemble.

En mode Conversation, tu peux toujours traduire un brouillon non envoyé depuis le bouton souriant du champ de message, puis **Tools → Translate draft** (outils → traduire le brouillon), sur ordinateur ou mobile. Tu n'as besoin d'aucun de ces deux interrupteurs. L'action utilise les réglages de traduction des messages sortants de ce chat et remplace le brouillon pour que tu le relises. Elle n'envoie rien. Un échec de traduction laisse le brouillon tel quel.

<a id="translator-defaults-for-new-chats"></a>

## Réglages de traduction par défaut pour les nouveaux chats

Sous les interrupteurs, **Save translator defaults** (enregistrer les réglages de traduction par défaut) enregistre les réglages de traduction de ce chat pour les nouveaux chats de tous les modes. Les réglages de l'assistant de configuration et ceux d'un profil de réglages passent en premier. Les chats existants gardent leurs propres réglages. **Forget saved defaults** (oublier les réglages par défaut enregistrés) les efface. [Noodle](../agents/noodle-settings.md#translation) utilise les mêmes réglages par défaut.

La clé API DeepL et l'URL DeepLX restent sur cette installation de Marinara. Les exports de chat, les profils de réglages exportés et les fichiers **Export Profile** (exporter le profil) les laissent de côté, et l'import de l'un d'eux ne les définit jamais. Saisis-les de nouveau après avoir déplacé un chat vers une autre installation.

## Traduire un seul message

Chaque message, qu'il vienne de toi ou de l'IA, a un bouton **Translate** (une icône de langues) dans sa barre d'actions. Il fonctionne sans aucun des interrupteurs ci-dessus.

1. Passe le pointeur sur le message, ou touche-le sur un téléphone, pour afficher sa barre d'actions.
2. Clique sur **Translate**.
3. La traduction s'affiche sous le message, ou à sa place si **Show Only Translation** est activé.
4. Clique de nouveau sur le bouton pour la masquer. Son libellé indique alors **Hide translation**.

La traduction est enregistrée avec le message. Elle survit à un rechargement de la page comme à un changement de chat. Elle utilise le même fournisseur et la même langue **My Language** que la section ci-dessus.

## Limites des fournisseurs

- **Google Translate** refuse les textes de plus de 5 000 caractères avec "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts."
- **DeepL API**, **DeepLX (self-hosted)** et **AI (via connection)** acceptent des textes plus longs, jusqu'à une limite serveur de 50 000 caractères par requête.
- **Google Translate**, **DeepL API** et **DeepLX (self-hosted)** s'arrêtent avec une erreur au bout de 15 secondes.
- **AI (via connection)** suit le délai d'expiration propre à ton modèle d'IA, pas la limite des 15 secondes.
- **DeepLX (self-hosted)** vers une adresse locale reste bloqué tant que `DEEPLX_LOCAL_URLS_ENABLED=true` n'est pas défini.

## Guides associés

- [Actions sur un message : modifier, supprimer, swipe, régénérer](../chats/messages.md)
- [Vue d'ensemble des Chat Settings](../chats/chat-settings.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
