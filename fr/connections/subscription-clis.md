# Connexions par abonnement Claude, ChatGPT et Grok

Ce guide explique les trois connexions qui passent par un compte au lieu d'une clé API : **Claude (Subscription)**, **OpenAI (ChatGPT)** et **Grok CLI (Subscription)**. Tu installes un petit outil en ligne de commande, tu te connectes une fois, et Marinara Engine utilise ce compte pour discuter. Un outil en ligne de commande (CLI) est un programme que tu lances en tapant une commande dans une fenêtre de terminal.

## À quoi servent les connexions par abonnement

La plupart des connexions de Marinara Engine utilisent une clé API. Une clé API est un code secret, un peu comme un mot de passe, que tu colles dans la connexion pour que le service d'IA facture ton compte.

Ces trois connexions fonctionnent autrement. Elles s'appuient sur une identification locale plutôt que sur une clé API. Tu te connectes à un CLI sur ta propre machine, et Marinara réutilise cette identification. Rien n'est collé dans Marinara.

Choisis une connexion par abonnement quand ton compte donne accès à l'un de ces CLI :

- **Claude (Subscription)** utilise ton abonnement Anthropic **Pro** ou **Max**.
- **OpenAI (ChatGPT)** utilise ton compte ChatGPT.
- **Grok CLI (Subscription)** utilise ton compte **SuperGrok** ou **X Premium+**.

## Ce qu'il te faut au préalable

Les conditions de compte dépendent du fournisseur.

- **Claude (Subscription)** demande un forfait Claude compatible avec l'identification par abonnement de Claude Code.
- **OpenAI (ChatGPT)** accepte les forfaits ChatGPT gratuits et payants éligibles. Les limites d'utilisation varient selon le forfait.
- **Grok CLI (Subscription)** demande SuperGrok ou X Premium+.

Pour les trois fournisseurs, le CLI doit être installé et connecté sur la machine qui fait tourner le serveur Marinara. Ce n'est pas le navigateur ni le téléphone depuis lequel tu consultes Marinara. Marinara lance le CLI en local, donc l'identification doit se trouver juste à côté du serveur.

Si tu fais tourner Marinara sur ton propre ordinateur, c'est cet ordinateur qui est le serveur. Si tu le fais tourner sur une autre machine ou dans Docker, installe et connecte le CLI là-bas.

## Claude (Subscription)

Il te faut un abonnement Anthropic Pro ou Max. C'est la même identification que celle utilisée par Visual Studio Code et les autres outils Anthropic.

1. Sur la machine qui fait tourner Marinara, installe le CLI Claude Code :

```
npm i -g @anthropic-ai/claude-code
```

2. Connecte-toi une fois :

```
claude auth login
```

3. Dans Marinara, ouvre le panneau **Connections** (Connexions) et clique sur **New** (Nouveau).
4. Dans la fenêtre **Create Connection** (créer une connexion), saisis un nom, choisis le fournisseur **Claude (Subscription)**, puis clique sur **Create**.
5. Dans l'éditeur, tu remarques qu'il n'y a ni champ **API Key** ni champ **Base URL**. Un panneau d'information confirme qu'ils ne sont pas nécessaires.
6. Choisis un modèle Claude, par exemple un modèle Opus ou Sonnet, dans le menu déroulant **Model**.
7. Clique sur **Save** (Enregistrer), puis sur **Send Test Message** (envoyer un message de test). Une courte réponse signifie que l'identification fonctionne.

Les connexions Claude par abonnement gèrent uniquement le chat textuel. Cette connexion propose deux réglages supplémentaires, **Fast Mode** et **Diagnose Model Routing**, décrits plus bas.

## OpenAI (ChatGPT)

Il te faut un compte ChatGPT. Marinara fait passer le chat par l'identification du CLI Codex.

1. Sur la machine qui fait tourner Marinara, installe le CLI Codex :

```
npm i -g @openai/codex
```

2. Connecte-toi une fois :

```
codex login
```

3. Dans Marinara, ouvre le panneau **Connections** et clique sur **New**.
4. Dans la fenêtre **Create Connection**, saisis un nom, choisis le fournisseur **OpenAI (ChatGPT)**, puis clique sur **Create**.
5. Choisis un modèle dans le menu déroulant **Model**. La liste provient de ta session ChatGPT quand elle est disponible, sinon d'une liste intégrée.
6. Clique sur **Save**, puis sur **Send Test Message** pour vérifier qu'une réponse arrive.

Marinara lit le fichier d'identification local de Codex et rafraîchit la session quand c'est possible.

## Grok CLI (Subscription)

Il te faut un compte SuperGrok ou X Premium+.

1. Sur la machine qui fait tourner Marinara, installe le CLI Grok :

```
curl -fsSL https://x.ai/cli/install.sh | bash
```

2. Connecte-toi une fois :

```
grok login
```

3. Dans Marinara, ouvre le panneau **Connections** et clique sur **New**.
4. Dans la fenêtre **Create Connection**, saisis un nom, choisis le fournisseur **Grok CLI (Subscription)**, puis clique sur **Create**.
5. Choisis un modèle, ou laisse le champ **Model** vide pour utiliser celui du CLI par défaut. Le modèle le plus sûr pour le roleplay est en général `grok-composer-2.5-fast`.
6. Clique sur **Save**, puis sur **Send Test Message**. Cette connexion peut lancer un test même sans modèle défini.

Deux particularités du CLI Grok. Il ne fait pas de streaming (affichage au fil de l'écriture), donc la réponse apparaît d'un seul coup au lieu de s'écrire mot à mot. Sa fenêtre de contexte est fixée à 32000 tokens par défaut, moins que chez les autres fournisseurs, car les prompts très longs peuvent atteindre la limite de tour propre au CLI.

Pour charger les modèles Grok, utilise le bouton **Fetch Models from Grok CLI** dans la section **Model**.

## Durée du cache de prompts Claude

Dans l'éditeur de connexion Claude, **Prompt Caching → Extended token caching (1 hour)** demande un cache d'une heure pour permettre des pauses plus longues entre les messages. Il faut Claude Code **2.1.242 ou une version ultérieure**. Marinara transmet ce réglage pour la requête sans modifier tes paramètres Claude enregistrés.

Quand l'option est désactivée, les conversations principales et les requêtes de l'Agent SDK conservent le comportement par défaut de Claude : actuellement une heure pour l'usage par abonnement dans les limites du forfait, et cinq minutes pour l'usage supplémentaire, les crédits ou la facturation API. Les sous-agents de Claude Code utilisent cinq minutes sans configuration distincte ; certaines requêtes auxiliaires contrôlées par le serveur peuvent utiliser une heure. Les variables d'environnement du CLI qui remplacent cette valeur restent prioritaires. Consulte [le cache de prompts de Claude Code](https://code.claude.com/docs/en/prompt-caching).

Les journaux de débogage distinguent les écritures en cache de cinq minutes et d'une heure à partir de l'usage indiqué par le SDK. Les coûts équivalents utilisent les multiplicateurs habituels des tokens de l'API, pas ta facture d'abonnement. Si le SDK ne fournit pas la répartition par durée, l'estimation reste inconnue.

## Pourquoi il n'y a pas de champ de clé API

Chez les trois fournisseurs par abonnement, les champs **API Key** et **Base URL** sont masqués. C'est voulu. L'identification vit à l'intérieur du CLI, sur la machine du serveur : tu n'as donc rien à taper dans Marinara.

Si tu as choisi le mauvais fournisseur par erreur et que tu ne vois aucun champ de clé, reviens au fournisseur voulu dans la grille des fournisseurs. Le champ de clé réapparaît pour les fournisseurs qui fonctionnent avec une clé API.

## Fast Mode (Claude uniquement)

L'éditeur **Claude (Subscription)** comporte une section **Fast Mode** avec un seul interrupteur, **Use Claude Code fast-mode routing**. Il est désactivé par défaut.

Laisse-le désactivé. L'application elle-même annonce que cette fonctionnalité ne fait rien aujourd'hui. Elle demande à Claude Code une gamme de modèles plus rapide, mais les modèles Claude actuels n'en proposent plus. L'activer n'apporte rien et peut même alourdir le traitement. L'interrupteur reste dans l'interface au cas où Anthropic remettrait la fonctionnalité en service.

Si tu essaies de l'activer, une boîte de dialogue de confirmation intitulée **YOU DON'T WANT THIS SETTING ON!** apparaît. Choisis **Keep it off**.

## Diagnose Model Routing (Claude uniquement)

L'éditeur **Claude (Subscription)** comporte un bouton **Diagnose Model Routing** dans la zone des tests. Sers-t'en quand tu demandes un modèle Claude précis mais que tu soupçonnes d'en avoir reçu un plus petit.

1. Choisis un modèle et clique sur **Save**. Le bouton reste désactivé tant qu'aucun modèle n'est sélectionné.
2. Clique sur **Diagnose Model Routing**.
3. Lis le résultat. Marinara envoie un vrai prompt (le texte que Marinara envoie à l'IA) via ton identification Claude Code. Il indique ensuite quel modèle a réellement été facturé à ton compte.

Cela permet de repérer une rétrogradation silencieuse, quand tu demandes un gros modèle comme Opus et que tu reçois discrètement Sonnet ou Haiku.

## Limites à connaître

- Ces connexions demandent un abonnement payant et un CLI connecté sur la machine du serveur.
- Aucune des trois ne propose d'embeddings. La recherche sémantique dans les lorebooks et la mémoire ont besoin d'une connexion séparée pour les embeddings.
- **Claude (Subscription)** gère uniquement le chat textuel.
- **Grok CLI (Subscription)** ne fait pas de streaming et démarre avec une fenêtre de contexte plus petite.
- **Send Test Message** exige de choisir d'abord un modèle, sauf pour le CLI Grok, qui peut tester sans modèle.

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Fournisseurs d'IA pris en charge](providers-reference.md)
