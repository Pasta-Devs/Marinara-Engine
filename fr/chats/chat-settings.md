# Vue d'ensemble des Chat Settings

**Chat Settings** (réglages du chat) est le panneau d'options du chat ouvert : son modèle, ses personnages, ses agents, la recherche, les résumés, les branches et la galerie. La plupart des réglages n'appartiennent qu'à ce chat.

## Ouvrir Chat Settings

1. Ouvre un chat.
2. Appuie sur le bouton **Chat Settings** (l'icône de curseurs). Un panneau s'ouvre. Sur téléphone, **Help** (aide), le bouton **?**, affiche un guide des icônes.
3. Appuie sur le titre d'une section pour l'ouvrir. Appuie à nouveau sur le titre pour la replier.

Chat Settings s'ouvre tout seul quand tu crées un chat. Pour le fermer, appuie sur son **X** ou à nouveau sur le bouton de curseurs.

Sur ordinateur, le bouton de curseurs se trouve au départ en haut à droite du chat. Si le Tracker Panel est affiché à droite, il se trouve au départ à gauche de ce panneau. Le Tracker Panel est un panneau latéral de Roleplay qui montre ce que suivent les agents (des aides qui s'exécutent en parallèle des réponses), comme les personnages présents dans la scène.

Tu peux faire glisser le bouton de curseurs à un endroit plus pratique. Il s'aligne sur les boutons voisins du chat pendant le déplacement. Sur ordinateur, maintiens <kbd>Alt</kbd> pour le placer librement. Chaque chat mémorise sa position. Un petit point sur le bouton indique que les agents travaillent. Dans un chat Roleplay avec Advanced Memory Recall, un point fixe dans l'autre coin signale que certains souvenirs de scène demandent ton attention. Voir [Corriger les problèmes de mémoire](../agents/memory.md#fixing-memory-problems).

La première fois que tu ouvres un chat, une courte vidéo montre comment disposer les boutons et les fenêtres. Clique sur **Got it** (compris). Elle reste masquée dans tes autres chats et après une actualisation de la page. Pour garder les conseils de disposition masqués dans un chat, clique sur le **X** à côté d'eux (**Hide these tips for this chat**, masquer ces conseils pour ce chat).

## Les sections en un coup d'œil

Les sections visibles dépendent du mode du chat. La section **Impersonate** est décrite dans [Génération guidée et Impersonate](guided-and-impersonate.md).

- Barre de profil de réglages : applique ou enregistre un lot de réglages de chat. Voir [Profils de réglages](settings-profiles.md). (Conversation, Roleplay.)
- **Search messages** (rechercher des messages) : trouve des messages par mots, ou par `#` suivi d'un numéro de message. Ses onglets **Bookmarks** (signets) et **Trash** (corbeille) listent les messages marqués d'un signet et les messages supprimés. (Pas en Game.)
- **Chat Name** (nom du chat) : le nom affiché dans ta liste de chats. Clique dessus pour le renommer. Il n'est jamais envoyé au modèle.
- **Chat Branches** (branches du chat) : change de branche, renomme, exporte et importe des branches. Voir [Branches de chat](branches.md).
- **Connection** (connexion) : le modèle qui répond dans ce chat. Voir plus bas.
- **Prompt Preset** (preset de prompt) : la structure enregistrée du prompt (le texte que Marinara envoie à l'IA) de ce chat.
- **Advanced Parameters** (paramètres avancés) : remplace pour ce chat des réglages de génération comme la température. Voir [Paramètres de génération](../prompts/generation-parameters.md).
- **Persona** : le personnage que tu incarnes. Voir [Choisir ton persona dans un chat](../characters/choosing-your-persona.md). (Conversation, Roleplay.)
- **Characters** (personnages) : les personnages du chat. (Conversation, Roleplay.)
- **Party** (équipe) : remplace **Persona** et **Characters** et les réunit au même endroit. (Game.)
- **Group Chat** (chat de groupe) : qui parle dans un groupe. Voir [Chats de groupe](group-chats.md). (Chats avec plus d'un personnage.)
- **Scoped Regex Scripts** (scripts regex à portée limitée) : contrôle, chat par chat, des scripts regex qui appartiennent à un personnage. Voir [Scripts regex](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting). (Affiché seulement quand un personnage du chat a des scripts à portée limitée.)
- **Chat Variables** (variables du chat) : du texte nommé que tu réutilises avec `{{name}}`. Voir plus bas.
- **Connected Chats** (chats connectés) : relie un chat à un autre. Voir [Chats connectés](connected-chats.md).
- **Lorebooks** : rattache des faits sur ton univers. Voir [Vue d'ensemble des lorebooks](../lorebooks/overview.md).
- **Chat Summary** (résumé du chat) : consulte et crée des résumés. Voir [Mémoire et résumés de chat](../agents/memory.md#chat-summary-roleplay). (Là où les résumés s'appliquent.)
- **Active Context** (contexte actif) : montre les lorebooks et le contexte actifs dans ce chat. Voir [Budgets de tokens et récursion](../lorebooks/token-budgets.md#seeing-skipped-entries-in-active-context).
- **Agents** : active des aides. Voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).
- **Agent activity** (activité des agents) : montre ce que les agents ont fait. Relance les trackers, réessaie ou arrête les agents, efface les trackers. Voir [Agent activity](../roleplay/getting-started.md#agent-activity). (Roleplay, avec des agents ou Advanced Memory activés.)
- **Author's Notes** (notes de l'auteur) : une note que le modèle lit à chaque tour. Voir [Author's Notes](../roleplay/getting-started.md#authors-notes). (Roleplay.)
- **Background** (arrière-plan) : l'image d'arrière-plan du chat. (Roleplay, Game.)
- **Gallery** (galerie) : les images et vidéos du chat. Voir [Arrière-plans de scène et galerie](../media/scene-backgrounds.md).
- **Widgets** : les widgets du HUD affichés dans la partie. (Game.)
- **Impersonate** : les réglages de la commande `/impersonate`. (Roleplay.)
- **Memory Recall** : se souvient des parties plus anciennes du chat. Voir [Mémoire et résumés de chat](../agents/memory.md). (Absent de la version Lite.)
- **Function Calling** (appel de fonctions) : permet au modèle d'utiliser des outils (des fonctions) dans ce chat.
- **Translation** (traduction) : la traduction automatique des messages. Voir [Traduction des messages](../integrations/message-translation.md).

Les chats Conversation ont aussi les sections Autonomous Messaging (les personnages t'écrivent en premier), Commands (des actions que les personnages font d'eux-mêmes) et des sections de notes. Elles sont décrites dans [Mode Conversation : premiers pas](../conversation/getting-started.md).

## Choisir le modèle d'un chat

La section **Connection** choisit le modèle qui répond dans ce chat. Un choix ne change que ce chat.

1. Ouvre **Chat Settings**, puis la section **Connection**.
2. Appuie sur le champ **Model** (modèle). Il affiche le modèle actuel.
3. Regarde s'il indique que le chat suit **Main** (principal). Main est le modèle par défaut que tu définis dans **Connections** (Connexions).
4. Choisis un modèle. Le sélecteur est le même que celui du bouton de modèle de la zone de saisie du chat. Le modèle actuel reste en haut, avec les modèles récents et favoris en dessous, classés par compte. Cherche parmi les modèles et les comptes, ou utilise **Browse** (parcourir) pour ouvrir le catalogue d'un compte.

**Follow Main** (suivre Main) efface le choix propre au chat : le chat change alors quand tu changes Main. **Shuffle** (mélange) choisit pour chaque réponse un modèle différent parmi ceux de ton pool. Voir [Shuffle](../connections/organizing-connections.md#shuffle). Si un compte a besoin d'une clé ou est désactivé, son modèle mène à l'action de réparation. Pour ajouter un compte, voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

## Utiliser les variables du chat

Une variable de chat est un nom donné à un morceau de texte. Par exemple, ajoute `char1` avec la valeur `Mary`, puis écris `{{char1}} walks in.` dans un message. Le modèle lit "Mary walks in."

1. Ouvre **Chat Settings**, puis la section **Chat Variables**.
2. Appuie sur **Add variable** (ajouter une variable), puis remplis le **name** (nom) et la **value** (valeur) de la ligne.
3. Appuie sur <kbd>Enter</kbd> ou clique hors du champ pour enregistrer. Le bouton de corbeille supprime une variable.

Les noms utilisent des lettres, des chiffres et des tirets bas, commencent par une lettre ou un tiret bas, et font au plus 64 caractères. Un nom d'exactement 21 caractères est réservé aux références de personnages. Un nom qui appartient à une macro intégrée, comme `char` ou `user`, est refusé.

- Ton message continue d'afficher la balise que tu as saisie. Seul le modèle voit la valeur. Changer une valeur plus tard change tous les tours précédents qui utilisaient la balise.
- Les variables n'appartiennent qu'à ce chat, et elles sont conservées après un redémarrage.
- C'est le stockage qu'utilise `{{setvar}}`. Une section du prompt ou une entrée de lorebook qui définit le même nom écrase ta valeur.

Si tu as beaucoup de variables, clique sur **Search and edit all in the State Editor** (tout chercher et modifier dans le State Editor). Il liste toutes les variables pour que tu puisses chercher, modifier, en coller plusieurs en JSON et relire les changements avant d'enregistrer. Voir [Le State Editor](../roleplay/hud-and-trackers.md#the-state-editor). Pour les autres macros entre doubles accolades, voir [Macros de prompt](../prompts/macros.md).

<a id="settings-profiles"></a>

## Profils de réglages

Un profil de réglages est un lot enregistré de réglages de chat que tu peux appliquer à d'autres chats. La barre de profil se trouve en haut du panneau et n'apparaît pas en Game. L'enregistrement, l'application, l'import, l'export et le choix d'un profil par défaut sont décrits dans [Profils de réglages](settings-profiles.md).

## Déplacer, épingler et verrouiller la fenêtre

Sur ordinateur, Chat Settings flotte au-dessus du chat, et son contenu se réorganise selon sa taille. Une fenêtre s'ouvre sous son bouton la première fois, ou à sa position enregistrée.

- Déplacer : fais glisser sa barre de titre. Tu peux aussi donner le focus à la barre de titre et utiliser les flèches, avec <kbd>Shift</kbd> pour des déplacements plus grands.
- Redimensionner : fais glisser un bord ou un coin. Tu peux aussi donner le focus à la poignée du coin inférieur droit et utiliser les flèches.
- Épingler : clique sur **Pin** (épingler). Une fenêtre épinglée reste ouverte quand tu cliques ailleurs et se rouvre après une actualisation de la page. Une fenêtre non épinglée se ferme quand tu cliques en dehors ou appuies sur <kbd>Esc</kbd>, sauf si tu es en train d'écrire ou d'utiliser un menu ouvert.
- Verrouiller : clique sur **Lock** (verrouiller). La fenêtre ne peut plus être déplacée ni redimensionnée, et son bouton reste en place. Tu peux toujours l'ouvrir.
- Fermer : clique sur **X**.

Les fenêtres restent dans la zone du chat. Une fenêtre ou un bouton peut se placer à côté du champ de message, mais ne le couvre jamais. Sur téléphone, Chat Settings s'ouvre dans un panneau sur toute la largeur, qui s'ajuste au-dessus du clavier.

## Aide, trackers et Reset View

Ces boutons se trouvent dans la barre de titre.

- **Help** (le **?**) affiche des étiquettes qui expliquent les contrôles du chat. Sur téléphone, il ferme d'abord Chat Settings. Pour le masquer, active **Settings → General → App Behavior → Hide chat Help button** (Paramètres → Général → Comportement de l'application → masquer le bouton Help du chat).
- **Reset View** (réinitialiser la vue), la flèche circulaire, demande confirmation, puis rétablit la disposition de départ de ce chat : les sections détachées reprennent leur place, et les tailles, positions, épinglages et verrouillages des fenêtres sont réinitialisés.
- **Favorite layout** (disposition favorite), l'étoile, enregistre cette disposition pour les nouveaux chats. Voir [Choisir une disposition pour les nouveaux chats](#choosing-a-layout-for-new-chats).
- **Tracker Panel** (panneau des trackers), le dé, active ou désactive le panneau dans un chat Roleplay qui utilise des agents ou Advanced Memory. Sur ordinateur, il s'ouvre à côté du chat. Sur téléphone ou tablette, un bouton déplaçable l'ouvre. Il modifie aussi la préférence Tracker Panel dans **Settings → Appearance** (Paramètres → Apparence).

Quand le Tracker Panel n'est pas affiché, les trackers sur ordinateur utilisent la [fenêtre Trackers](../roleplay/hud-and-trackers.md#the-trackers-window). Si la place manque à côté de tes messages, elle commence sous forme de petit bouton **Trackers**. Utilise le dé pour afficher à nouveau le Tracker Panel.

<a id="popping-a-section-out-into-its-own-window"></a>

## Détacher une section dans sa propre fenêtre

Détache une section pour lui donner sa propre fenêtre.

1. Clique sur le bouton **Pop out** (détacher) de la section (le carré avec une flèche, à côté de son **?**). Sur ordinateur, tu peux aussi faire glisser le titre de la section hors de Chat Settings.
2. Déplace, redimensionne, épingle ou verrouille la nouvelle fenêtre comme Chat Settings. Elle n'est pas épinglée au départ : un clic ailleurs la réduit donc à un bouton.
3. Pour la remettre, clique sur **Put back in Chat Settings** (remettre dans Chat Settings), la flèche courbe à côté de **X**, ou fais glisser la fenêtre sur Chat Settings.

**X** réduit la section à un petit bouton portant son icône. Fais glisser le bouton où tu veux et clique dessus pour rouvrir la fenêtre. Les trackers se détachent de la fenêtre Trackers de la même façon, et leur bouton de retour s'appelle **Put back in Trackers** (remettre dans Trackers).

Sur téléphone, détacher une section ferme Chat Settings et ajoute la section au menu à trois points **Chat tools** (outils du chat). Appuie sur les points, puis sur l'icône ronde de la section. Appuie sur **Put back in Chat Settings** pour la remettre à sa place.

<a id="the-phones-chat-tools-menu"></a>

## Le menu Chat tools du téléphone

Le bouton déplaçable à trois points regroupe les outils que tu as sortis de Chat Settings. Appuie dessus pour déployer des boutons ronds à icône, puis appuie sur un outil. Appuie à nouveau sur les points pour les replier. Les boutons des trackers, le bouton de carte de Game et Character Profiles restent séparés.

Fais glisser le bouton à trois points pour déplacer le menu. Ouvre-le et utilise le cadenas en haut pour le fixer en place. Tant qu'il est déverrouillé, fais glisser un outil vers le haut ou le bas pour changer son ordre, ou donne-lui le focus et utilise les flèches. Le verrouillage empêche à la fois le déplacement et le changement d'ordre. Le menu suit le style des widgets de ton chat.

<a id="control-windows-and-their-buttons"></a>

## Fenêtres de contrôles et leurs boutons

Certains outils ouvrent leur propre petite fenêtre : **Game controls** (contrôles du jeu), **Session**, **Volume** et **Game Assets** (ressources du jeu) d'une partie de Game, **Connected chat** (chat connecté), et les contrôles des packages installés.

Sur ordinateur, ces boutons se trouvent au départ près du coin supérieur droit du chat. Clique sur l'un d'eux pour ouvrir sa fenêtre. Fermer la fenêtre fait revenir le bouton. Sur téléphone, ils se trouvent dans le menu **Chat tools** et s'ouvrent en panneaux sur toute la largeur.

Pour en garder un dans Chat Settings, ouvre sa fenêtre et choisis **Put back in Chat Settings**. Utilise le bouton de détachement de la section pour le séparer à nouveau. **Reset View** rétablit la disposition de départ.

Fais glisser un bouton pour le déplacer. Les boutons voisins s'alignent pendant le déplacement. Maintiens <kbd>Alt</kbd> pour le placer librement, ou utilise les flèches quand il a le focus. **Calls** de Conversation reste un bouton ordinaire. En Game, **Character Profiles** (profils des personnages) et le bouton **Map** (carte) du téléphone sont déplaçables, et leur cadenas conserve les positions de chaque partie.

## Chaque chat garde sa disposition de fenêtres

Chaque chat mémorise les tailles et positions des fenêtres, les épinglages et verrouillages, les sections détachées et les positions des boutons. Les positions du téléphone ainsi que l'ordre et le verrouillage de Chat tools sont enregistrés séparément des positions de l'ordinateur. Un [profil de réglages](settings-profiles.md) peut enregistrer une disposition pour d'autres chats.

<a id="choosing-a-layout-for-new-chats"></a>

## Choisir une disposition pour les nouveaux chats

L'étoile à côté de **Reset View** fait de ta disposition actuelle la disposition de départ des nouveaux chats du même mode. Conversation, Roleplay et Game ont chacun leur propre favorite.

1. Dispose les fenêtres et les boutons. Range les outils dans Chat Settings ou détache-les.
2. Masque les conseils de disposition si les nouveaux chats doivent aussi les masquer.
3. Clique sur l'étoile. Elle se remplit quand la disposition, les conseils et le mode Scoped Regex Scripts actuels correspondent à ta favorite enregistrée.

La favorite enregistre les positions, les tailles, les épinglages, les verrouillages, les outils détachés ou rangés, le choix des conseils de disposition et le mode [Scoped Regex Scripts](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting) du chat. Un chat réglé sur **Use preset default** (utiliser la valeur par défaut du preset) n'enregistre aucun mode : les nouveaux chats suivent donc leur preset de prompt. Les personnages, le modèle, les réglages d'IA et les messages restent propres au chat.

Pour remplacer la favorite, change la disposition et clique à nouveau sur l'étoile. Pour cesser de l'utiliser, clique sur l'étoile remplie. Cela ne touche que les chats que tu crées ensuite.

Un profil de réglages qui a sa propre disposition enregistrée prend le pas sur la favorite quand il est appliqué. Un profil sans disposition laisse la disposition favorite en place. Les profils appliquent quand même leur propre réglage des conseils de disposition et leur propre mode Scoped Regex Scripts. Voir [Profils de réglages](settings-profiles.md#favorite-window-layouts).

Après une mise à jour depuis une ancienne version, ton ancienne disposition des boutons d'outils est déjà étoilée pour les trois modes, jusqu'à ce que tu la remplaces ou l'effaces. Une installation neuve a les outils dans Chat Settings et aucune favorite.

## Changer l'apparence des fenêtres de chat

Ouvre **Settings → Appearance → App** (Paramètres → Apparence → Application) et descends jusqu'à **Chat widget style** (style des widgets du chat), en bas de **App Style** (style de l'application). **Default** garde l'apparence de Marinara. **Dottore** utilise des bleus glacés, du métal clair et des coins coupés. **Prof. Mari** utilise des bleus de pierres précieuses, de l'or chaud et des cadres cintrés. Les deux suivent les modes clair et sombre et habillent les boutons déplaçables, les fenêtres et les sections des trois modes de chat.

- **Font** (police), **Shape** (forme) et trois sélecteurs de couleur sous les presets permettent de varier le style. Les polices installées dans Marinara apparaissent dans la liste des polices. Choisir à nouveau un preset réinitialise la police, la forme et les couleurs personnalisées.
- **Button size (px)** (taille des boutons en pixels) règle la taille des boutons déplaçables du chat, de 32 à 96. Un champ vide garde la valeur par défaut.
- **Apply preset font** (appliquer la police du preset), **Apply preset shape** (appliquer la forme du preset) et **Apply preset colors** (appliquer les couleurs du preset) étendent le style aux messages, aux champs de saisie et aux contrôles du chat. Chacun fonctionne indépendamment, et tous sont désactivés au départ. Les messages Conversation utilisent la police et les couleurs, mais gardent leur propre forme. Quand **Apply preset colors** est activé, les dialogues entre guillemets gardent la Dialogue Highlight Color (couleur de surbrillance des dialogues) propre à chaque personnage ou persona.

Ces choix ne déplacent pas tes fenêtres. Ils sont enregistrés avec les préférences de l'application et se synchronisent avec les navigateurs connectés au même serveur. Voir [Thèmes CSS personnalisés](../appearance/custom-css-themes.md#ready-made-chat-window-styles).
