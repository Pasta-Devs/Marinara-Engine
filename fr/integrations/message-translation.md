# Traduction des messages

Marinara Engine sait traduire les messages du chat d'une langue à l'autre. Ce guide explique les quatre fournisseurs de traduction, les interrupteurs de traduction automatique, le bouton **Translate** (traduire) présent sur chaque message, et les limites propres à chaque fournisseur.

La traduction se règle chat par chat. Chaque chat garde son propre fournisseur, sa langue cible et ses clés. Un réglage saisi dans un chat ne suit pas dans un autre.

## Où trouver les réglages de traduction

1. Ouvre un chat dans n'importe quel mode (Conversation, Roleplay ou Game).
2. Ouvre le panneau **Chat Settings** (réglages du chat) de ce chat.
3. Repère la section **Translation** (traduction).

Tous les réglages de fournisseur et tous les interrupteurs décrits ci-dessous se trouvent dans cette section **Translation**.

## Choisir un fournisseur

Le menu déroulant **Provider** (fournisseur) propose quatre options :

| Fournisseur | Ce qu'il demande | Remarques |
|---|---|---|
| **Google Translate** | Rien | Option par défaut. Gratuit, sans clé. Limité à 5000 caractères par requête. |
| **DeepL API** | Une clé API DeepL | Meilleure qualité. Les clés gratuites comme payantes fonctionnent. |
| **DeepLX (self-hosted)** | L'URL d'un serveur DeepLX | Pour une instance DeepLX que tu héberges toi-même. |
| **AI (via connection)** | Une connexion IA | Passe par un de tes fournisseurs d'IA pour traduire. |

**Google Translate** est sélectionné par défaut et ne demande aucune configuration. Choisis un autre fournisseur seulement si tu as besoin d'une des fonctionnalités ci-dessous.

### Target Language

Le champ **Target Language** (langue cible) définit la langue vers laquelle tu traduis. La valeur par défaut est `en` (anglais).

Le format attendu dépend du fournisseur :

- Pour **Google Translate**, **DeepL API** et **DeepLX (self-hosted)**, saisis un code de langue court. Exemples : `en`, `ja`, `es`, `de`, `fr`, `zh`, `ko`.
- Pour **AI (via connection)**, saisis un nom de langue. Exemples : `English`, `Japanese`, `Spanish`.

### Configurer DeepL API

Dès que tu choisis **DeepL API**, un champ **DeepL API Key** (clé API DeepL) apparaît. Colle ici la clé de ton compte DeepL. Une clé API est un code secret, un peu comme un mot de passe. Les clés DeepL ressemblent à ceci :

```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

Une clé qui se termine par `:fx` est une clé de niveau gratuit. Marinara l'envoie alors au service gratuit de DeepL. Toute autre clé est traitée comme une clé payante.

### Configurer DeepLX

DeepLX est un serveur de traduction gratuit et auto-hébergé, que tu fais tourner toi-même. Dès que tu choisis **DeepLX (self-hosted)**, un champ **DeepLX URL** (URL du serveur DeepLX) apparaît. Saisis l'adresse de ton serveur DeepLX, par exemple :

```
http://localhost:1188
```

Si ton serveur DeepLX tourne sur ta propre machine ou sur ton réseau local, son adresse est une adresse locale. Par sécurité, Marinara bloque par défaut les requêtes vers les adresses locales. Pour les autoriser, ajoute cette ligne dans le fichier `.env`, puis enregistre le fichier :

```
DEEPLX_LOCAL_URLS_ENABLED=true
```

Le fichier `.env` est le fichier de réglages du serveur. La [Référence de configuration du serveur](../CONFIGURATION.md) explique où le trouver. Inutile de redémarrer le serveur : il prend le changement en compte en quelques secondes.

Un serveur DeepLX situé à une adresse publique sur Internet n'a pas besoin de ce réglage. Seules les adresses locales et les adresses de réseau privé sont bloquées par défaut.

### Configurer la traduction par IA

Dès que tu choisis **AI (via connection)**, Marinara passe par un de tes fournisseurs d'IA pour traduire. Deux champs supplémentaires apparaissent.

Le menu déroulant **Connection** (connexion) sert à choisir la connexion IA qui se charge de la traduction. Ce champ est obligatoire. S'il reste vide, la traduction échoue avec le message "Connection ID is required for AI translation". Une connexion est un lien enregistré vers un fournisseur d'IA. Le guide des connexions, en bas de page, explique comment en créer une.

Le champ **AI Prompt** (prompt de traduction) contient l'instruction envoyée à l'IA pour traduire. Le prompt, c'est le texte que Marinara envoie à l'IA. Le champ est prérempli avec une valeur par défaut intégrée. Modifie-la pour ce chat si tu veux. Dès que tu y touches, un bouton **Restore** (restaurer) apparaît et remet le champ à la valeur par défaut intégrée. Le prompt par défaut est le suivant :

```
You are a translator. Translate the given text accurately, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Les interrupteurs de traduction automatique

Sous les réglages de fournisseur se trouvent trois interrupteurs. Les trois sont désactivés par défaut.

**Auto-Translate Responses** (traduire les réponses automatiquement) traduit chaque réponse de l'IA dès qu'elle est générée. En Game Mode, Marinara retire de la narration les tags réservés au Game Master avant de la traduire.

**Translate My Messages** (traduire mes messages) traduit ton propre message vers la langue cible juste avant qu'il ne parte vers l'IA. La traduction remplace le texte que tu as saisi. Si la traduction échoue, Marinara envoie ton texte d'origine et affiche un message d'erreur.

**Show Draft Translate Button** (afficher le bouton de traduction du brouillon) ajoute un bouton **Translate draft** (traduire le brouillon) à côté du bouton **Send** (envoyer). Tu peux ainsi traduire ton message et relire ou corriger le résultat avant de l'envoyer. C'est l'équivalent manuel de **Translate My Messages**, qui traduit à l'envoi sans laisser le temps de relire.

Dans **Conversation**, tu peux toujours traduire un brouillon non envoyé depuis le bouton souriant du champ de message → **Tools → Translate draft** (outils → traduire le brouillon), sur ordinateur ou mobile. Tu n'as pas besoin d'activer **Show Draft Translate Button** ni la traduction automatique. L'action utilise les réglages de traduction des messages sortants de ce chat et remplace le brouillon pour te permettre de le relire ; elle n'envoie aucun message. Un échec de traduction laisse le brouillon intact.

## Le bouton Translate de chaque message

Chaque message du chat, qu'il vienne de toi ou de l'IA, a un bouton **Translate** dans sa barre d'actions au survol. Le bouton porte une icône de langues. Il fonctionne tout seul et ne dépend d'aucun des interrupteurs ci-dessus.

1. Passe le pointeur sur un message pour faire apparaître sa barre d'actions.
2. Clique sur le bouton **Translate**.
3. La traduction s'affiche sous le message.
4. Clique de nouveau sur le même bouton pour masquer la traduction. Son texte au survol indique alors **Hide translation**.

Une traduction obtenue de cette façon est enregistrée avec le message. Elle survit à un rechargement de la page et reste en place si tu changes de chat puis reviens.

Le bouton présent sur chaque message utilise le fournisseur et la langue cible définis dans la section **Translation**.

## Limites des fournisseurs

Garde ces limites en tête au moment de choisir un fournisseur.

- **Google Translate** refuse les textes de plus de 5000 caractères. L'erreur affichée est "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts." Passe à DeepL ou à l'IA pour les textes plus longs.
- **DeepL API**, **DeepLX (self-hosted)** et **AI (via connection)** acceptent des textes plus longs, jusqu'à une limite serveur de 50000 caractères par requête.
- **Google Translate**, **DeepL API** et **DeepLX (self-hosted)** s'arrêtent et affichent une erreur s'ils dépassent 15 secondes.
- **AI (via connection)** suit le modèle et le délai d'expiration propres à ta connexion, pas la limite des 15 secondes.
- **DeepLX (self-hosted)** vers une adresse locale reste bloqué tant que tu n'as pas défini `DEEPLX_LOCAL_URLS_ENABLED=true`, comme expliqué plus haut.

## Guides associés

- [Actions sur les messages : modifier, supprimer, swiper, régénérer](../chats/messages.md)
- [Vue d'ensemble des Chat Settings](../chats/chat-settings.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Référence de configuration du serveur](../CONFIGURATION.md)
