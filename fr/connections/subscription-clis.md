# Connexions par abonnement Claude, ChatGPT et Grok

Trois services te permettent de discuter avec un forfait que tu paies déjà, au lieu d'une clé API : **Claude (Subscription)**, **OpenAI (ChatGPT)** et **Grok CLI (Subscription)**. Tu installes un petit outil en ligne de commande (CLI) et tu te connectes une fois. Marinara Engine réutilise ensuite cette identification. Rien n'est collé dans Marinara.

Le forfait qu'il te faut :

- **Claude (Subscription)** : Anthropic Pro ou Max, ou un autre forfait accepté par Claude Code.
- **OpenAI (ChatGPT)** : un compte ChatGPT. Les limites d'utilisation dépendent du forfait.
- **Grok CLI (Subscription)** : SuperGrok ou X Premium+.

## Ajouter un compte par abonnement

Avant de commencer, sache que le CLI doit être installé et connecté sur l'ordinateur qui fait tourner le serveur Marinara. Ce n'est pas le téléphone ni le navigateur depuis lequel tu consultes Marinara. Si Marinara tourne sur un autre ordinateur ou dans Docker, fais les étapes 1 et 2 là-bas. Les commandes `npm` ont besoin de Node.js, que tu as déjà si tu as installé Marinara depuis le code source. Voir [Installation](../INSTALLATION.md).

1. Ouvre un terminal sur l'ordinateur qui fait tourner Marinara. Un terminal est la fenêtre dans laquelle tu tapes des commandes. Sous Windows, ouvre PowerShell. Sous macOS, ouvre Terminal.
2. Lance la commande d'installation de ton service, puis sa commande de connexion. L'outil affiche ses propres étapes de connexion, en général une page web sur laquelle tu te connectes.

| Service | Installation | Connexion |
| --- | --- | --- |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude login` |
| ChatGPT | `npm i -g @openai/codex` | `codex login` |
| Grok | voir ci-dessous | `grok login` |

Pour Grok, l'application affiche cette commande d'installation. Si elle ne fonctionne pas sur ton système, suis les instructions de x.ai pour le CLI Grok.

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

3. Dans Marinara, clique sur **Connections** (Connexions) dans la barre du haut, puis sur **Add** (ajouter).
4. Sous **Chat**, clique sur ton service. Ces services portent l'étiquette **Sign in** (se connecter).
5. La fenêtre affiche **Sign in first** et indique la commande à lancer. Il n'y a pas de champ de clé. Clique sur **Connect** (connecter). Marinara teste l'identification. **Connected** veut dire qu'elle fonctionne.
6. Choisis un modèle dans la liste, puis clique sur **Done** (terminé). Pour Grok CLI, tu peux aussi laisser le modèle vide, ce qui utilise le modèle par défaut du CLI (voir [Grok CLI (Subscription)](#grok-cli-subscription)).

Envoie un message dans un chat pour confirmer. Une réponse veut dire que ça fonctionne.

Si ça n'a pas marché :

- **Marinara could not use the login on this computer.** veut dire que le CLI n'est pas installé ou pas connecté sur l'ordinateur de Marinara. Lance la commande de connexion sur cet ordinateur, puis clique sur **Try again** (réessayer).

## Claude (Subscription)

À partir d'ici, les sections décrivent des réglages facultatifs. Tu n'en as pas besoin pour discuter.

Ce service utilise ton forfait Claude via Claude Code. Il propose trois contrôles supplémentaires dans l'éditeur de modèle, **Edit model** (modifier le modèle) : le cache de prompts, **Fast mode** (mode rapide) et **Diagnose model routing** (diagnostiquer le routage du modèle).

### Cache de tokens étendu

Le cache de prompts permet à Claude de réutiliser le début de ton prompt (le texte que Marinara envoie à l'IA), pour que les requêtes répétées consomment moins de ta limite. **Prompt caching → Extended token caching (1 hour)** (cache de prompts → cache de tokens étendu, 1 heure) demande un cache d'une heure, utile quand tu fais des pauses entre les messages. Il faut Claude Code 2.1.242 ou une version ultérieure. Marinara envoie ce réglage avec la requête et ne modifie pas tes réglages Claude enregistrés.

Quand il est désactivé, Claude applique sa propre valeur par défaut pour ton compte. Consulte [le cache de prompts de Claude Code](https://code.claude.com/docs/en/prompt-caching).

### Fast mode

**Fast mode → Use Claude Code fast-mode routing** (mode rapide → utiliser le routage rapide de Claude Code) est désactivé par défaut. Laisse-le désactivé. Il demande à Claude Code une gamme de modèles plus rapide, mais l'application indique que les modèles actuels n'en proposent plus : l'activer n'apporte donc rien d'utile et peut alourdir le traitement. Si tu essaies de l'activer, une boîte de dialogue intitulée **Turn on fast mode?** apparaît. Clique sur **Keep it off** (le laisser désactivé).

### Diagnose model routing

Utilise **Diagnose model routing** quand tu as demandé un gros modèle comme Opus mais que tu soupçonnes d'en avoir reçu un plus petit.

1. Choisis un modèle. Le bouton reste désactivé tant qu'aucun modèle n'est défini.
2. Clique sur **Diagnose model routing**. Marinara enregistre d'abord les modifications non enregistrées.
3. Lis le résultat. Marinara envoie un vrai prompt via ton identification Claude Code et indique quel modèle a été facturé à ton compte.

## OpenAI (ChatGPT)

Ce service utilise ton compte ChatGPT via le CLI Codex. Marinara lit le fichier d'identification local de Codex et rafraîchit la session quand c'est possible.

Pour régler le temps de réflexion de Codex avant qu'il réponde, ouvre **Edit model**, active **Use custom defaults for this model** (utiliser des valeurs par défaut propres à ce modèle) et choisis un niveau dans **Reasoning Effort** (effort de raisonnement). Il démarre sur **Default** (par défaut), qui garde le niveau propre à Codex pour le modèle. Un chat peut choisir son propre niveau dans **Advanced Parameters** (paramètres avancés). Le niveau défini dans un preset, un modèle de prompt enregistré, ne le change pas. Un modèle Codex utilisé comme modèle de secours ne suit que son propre niveau, et les agents qui utilisent ce modèle suivent le niveau du modèle. Les niveaux proposés correspondent à ceux qui sont disponibles pour le modèle choisi.

## Grok CLI (Subscription)

Ce service fait tourner le CLI Grok sur l'ordinateur de Marinara. Deux choses le distinguent des autres services :

- Il ne fait pas de streaming. Une réponse apparaît d'un seul coup au lieu de s'écrire mot à mot.
- Sa fenêtre de contexte est fixée par défaut à 32 000 tokens. Les tokens sont de petits morceaux de texte que les modèles comptent. Les gros prompts peuvent atteindre la limite de tour propre au CLI, donc la valeur par défaut reste basse. Tu peux définir une valeur **Max Context Window** (fenêtre de contexte maximale) plus grande sur le modèle.

Dans l'éditeur de modèle, **Use the Grok CLI default** (utiliser le modèle par défaut du CLI Grok) laisse le modèle vide pour que le CLI choisisse le sien. L'éditeur présente `grok-composer-2.5-fast` comme le modèle en général le plus sûr pour le roleplay, car Marinara lance le CLI sans interface (headless), avec les outils, la mémoire, la recherche web, les plans et les sous-agents propres à Grok désactivés.

## Consommation du forfait

Les comptes Claude (Subscription) et OpenAI (ChatGPT) peuvent afficher la part des limites de ton forfait que tu as déjà utilisée.

1. Clique sur **⋯** sur la ligne du compte, choisis **Edit account** (modifier le compte) et ouvre **Usage and balance** (utilisation et solde).
2. Si les lectures externes sont désactivées, clique sur **Turn on** (activer).
3. Active **Show the usage meter on the card** (afficher l'indicateur de consommation sur la carte), puis enregistre.

Chaque fenêtre de limite reçoit une barre avec le pourcentage utilisé et le moment de sa réinitialisation, par exemple `58% · resets in 2h`. Les mêmes barres apparaissent dans le sélecteur de connexion d'un chat et dans les réglages **Connection** (connexion) du chat tant que ce compte est actif. Elles n'apparaissent pas pour **Shuffle** (mélange).

- Les barres comptent toute l'utilisation de ton forfait, pas seulement celle de Marinara. Pour Claude, cela inclut Claude Code et claude.ai. Pour ChatGPT, cela inclut toute l'utilisation de Codex, comme le CLI Codex. Les chats sur chatgpt.com ont leurs propres limites et ne sont pas inclus.
- Les services indiquent un pourcentage pour chaque fenêtre, sans aucun nombre de tokens.
- Une lecture demande au CLI de l'ordinateur de Marinara les mêmes données que celles qu'affiche sa propre commande de consommation. Elle n'envoie aucun message à un modèle et ne consomme rien de ton forfait. Le bouton d'actualisation relance la lecture.
- Un forfait qui n'a qu'une seule fenêtre affiche une seule barre.
- Claude Code marque ses données de consommation comme expérimentales. Si une nouvelle version les modifie, les barres affichent une erreur et un bouton pour réessayer au lieu d'un chiffre faux.

## Limites de ces services

- Ils demandent un forfait payant (ou un forfait ChatGPT éligible) et le CLI connecté sur l'ordinateur de Marinara.
- Aucun d'eux ne propose d'embeddings (des représentations numériques du texte). La recherche sémantique dans les lorebooks et le rappel de mémoire ont besoin d'un compte séparé pour les embeddings.
- **Send test message** (envoyer un message de test) exige de choisir d'abord un modèle, sauf pour Grok CLI.

## Guides associés

- [Se connecter à un fournisseur d'IA](connecting-to-a-provider.md)
- [Fournisseurs d'IA pris en charge](providers-reference.md)
