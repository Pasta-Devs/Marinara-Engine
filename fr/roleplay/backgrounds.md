# Les arrière-plans en Roleplay

Ce guide explique l'arrière-plan de scène du mode Roleplay : l'agent **Background** (arrière-plan) qui en choisit un après chaque réponse, la création manuelle d'un arrière-plan, et la façon d'en fixer un pour un seul chat. Pour la bibliothèque d'arrière-plans que tu importes et ses réglages, va voir [Arrière-plans de chat](../appearance/chat-backgrounds.md). Pour les arrière-plans générés par l'IA depuis la galerie, va voir [Arrière-plans de scène](../media/scene-backgrounds.md).

## L'arrière-plan de scène

Le mode Roleplay affiche un arrière-plan de scène en pleine page derrière les messages. Quand l'arrière-plan change, Marinara passe en fondu enchaîné de l'ancienne image à la nouvelle : les changements de scène restent doux, sans à-coups.

La génération d'images n'est pas nécessaire pour autant. Sans connexion de génération d'images configurée, l'arrière-plan s'affiche en couleur unie. Le chat continue de fonctionner comme un chat textuel classique.

## L'agent Background

L'agent **Background** est un assistant facultatif qui choisit l'arrière-plan de scène à ta place. Il s'exécute après chaque réponse. Il lit la scène en cours, puis retient l'image la plus adaptée parmi tous les arrière-plans disponibles. Les dossiers de la bibliothèque servent uniquement à s'organiser dans les paramètres : ils ne cachent jamais d'images à l'agent. L'agent se contente de sélectionner des images existantes ; la génération automatique d'arrière-plans relève de l'agent **Illustrator** (illustrateur).

L'agent **Background** est désactivé par défaut. Pour l'activer :

1. Ouvre le chat Roleplay.
2. Ouvre **Chat Settings** (réglages du chat) avec son bouton dans le chat. Il se trouve en haut à droite, sauf si tu l'as déplacé.
3. Ouvre la section **Agents**.
4. Active l'agent **Background**.

Ensuite, l'arrière-plan de scène se met à jour tout seul au fil des lieux que traverse l'histoire.

## Générer un arrière-plan à la main

Autre option : créer un arrière-plan toi-même, sans l'agent. Marinara construit un prompt d'image – le texte envoyé à l'IA – à partir de la scène (genre, cadre, lieu actuel, météo et moment de la journée), puis crée un arrière-plan inédit.

1. Ouvre **Chat Settings** et déplie **Gallery** (galerie).
2. Clique sur le bouton **Background**.
3. Attends la fin du traitement. Le bouton affiche **Generating...** pendant l'opération.

Pendant l'exécution, cette note s'affiche : "AI background generation is running. The new background will be applied when it finishes." La nouvelle image rejoint la bibliothèque d'arrière-plans et s'applique à la scène.

La génération manuelle utilise la connexion d'images de l'agent **Illustrator**, puis se rabat sur la connexion de génération d'images par défaut. L'agent **Background**, lui, n'a besoin d'aucune connexion d'images : il sélectionne seulement des images déjà présentes dans la bibliothèque. Si Marinara ne trouve aucune connexion, la génération échoue avec ce message : "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection."

La génération d'arrière-plans de scène fonctionne uniquement en mode Roleplay et en Game Mode. Elle n'est pas disponible en mode Conversation.

## Fixer un arrière-plan pour un seul chat

Tu peux attribuer un arrière-plan précis au chat que tu consultes, au lieu de laisser l'agent choisir.

1. Ouvre le panneau **Settings** (Paramètres).
2. Ouvre l'onglet **Appearance**.
3. Repère la section **Backgrounds**.
4. Sous le réglage **Chat Background**, choisis une image importée ou l'un des arrière-plans issus des assets de jeu.

Pour revenir à l'arrière-plan par défaut, clique sur le bouton **Remove** à côté du réglage **Chat Background**.

## La bibliothèque d'arrière-plans et le flou

Les images proposées se trouvent dans cette même section **Backgrounds**, sous **Settings** puis **Appearance**. Le guide [Arrière-plans de chat](../appearance/chat-backgrounds.md) détaille toute cette bibliothèque : import d'images, tags, renommage, suppression, curseur **Background Blur** (flou d'arrière-plan) et choix d'un arrière-plan par défaut pour les nouveaux chats Roleplay.

## Guides associés

- [Arrière-plans de chat](../appearance/chat-backgrounds.md) : la bibliothèque d'images importées et les réglages d'apparence des arrière-plans.
- [Arrière-plans de scène](../media/scene-backgrounds.md) : les arrière-plans générés par l'IA depuis la galerie.
- [Mode Roleplay : premiers pas](getting-started.md) : la scène Roleplay au complet, les sprites et le HUD.
