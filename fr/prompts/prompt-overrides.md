# Prompt Overrides pour l'image et la vidéo

Ce guide explique les **Prompt Overrides** (remplacements de prompt) : les éditeurs qui modifient les gabarits dont Marinara Engine se sert pour rédiger ses prompts. Un prompt, c'est le texte envoyé au modèle d'image ou de vidéo. Au programme : où les trouver, ce qui est modifiable, et comment enregistrer un gabarit personnalisé sans risque.

## À quoi servent les Prompt Overrides

Un **Prompt Override** est un gabarit réutilisable pour un prompt de média. Quand Marinara génère une image ou une vidéo, elle compose d'abord un prompt textuel destiné au modèle d'image ou de vidéo. Les Prompt Overrides servent à modifier ces gabarits.

Cette fonctionnalité concerne uniquement les prompts d'images et de vidéos. Elle ne change rien au prompt textuel envoyé au modèle de chat pendant une conversation ou un roleplay. La confusion est fréquente. Pour modifier le prompt destiné à un modèle de chat, passe plutôt par un preset de prompt et les paramètres de génération. Voir [Éditeur de preset et gestionnaire de prompts](presets.md) et [Paramètres de génération](generation-parameters.md).

Quelques termes utilisés plus bas :

- Un **sprite** est un élément d'illustration d'un personnage, par exemple une expression du visage ou une pose en pied.
- Un **storyboard** est une série d'images générées à partir d'un tour de Game Mode ou d'un épisode de Roleplay terminé.

## Où les trouver

Les éditeurs se trouvent dans les paramètres de l'application.

1. Ouvre **Settings** (Paramètres).
2. Clique sur l'onglet **Generations**.
3. Descends jusqu'à la zone **Prompt Overrides**, décrite par "Reusable image and video prompt templates."

Deux éditeurs repliables y apparaissent.

## Les deux éditeurs

Clique sur le titre d'un éditeur pour le déplier.

**Video Generation Prompt Overrides** gère les gabarits réutilisables des vidéos de scène de Game Mode et de la galerie, des messages vidéo en mode Conversation, des clips de personnage des appels en mode Conversation, et des portraits d'expression animés. Chaque gabarit de prompt vidéo détermine la façon dont un type de clip est décrit au modèle de vidéo.

**Image Generation Prompt Overrides** gère les gabarits employés par les systèmes d'image, de sprite, de Game Mode et de construction de prompts. Cela couvre les selfies du mode Conversation, les portraits de PNJ (personnages non-joueurs) de Game Mode, les illustrations de scène, les prompts de storyboard, le gabarit **Noodle Post Image** des publications Noodle, ainsi que les autres générateurs d'images enregistrés. Chaque gabarit de prompt d'image détermine la façon dont un type d'image est décrit au modèle d'image.

Entre les deux éditeurs, tu règles donc les prompts des portraits, des selfies, des sprites, des illustrations de scène, des storyboards et des clips vidéo.

## Modifier un gabarit

Les deux éditeurs fonctionnent de la même manière. Voici la marche à suivre :

1. Ouvre l'éditeur voulu.
2. Choisis un gabarit dans le menu déroulant **Registered prompt**. La liste dépend de l'éditeur ouvert.
3. Regarde la pastille d'état à côté du menu déroulant. Elle affiche **Default** quand aucun gabarit personnalisé n'est enregistré, **Custom active** quand ton gabarit enregistré est utilisé, et **Custom paused** quand il est enregistré mais désactivé.
4. Lis la courte description sous le menu déroulant : elle indique à quoi sert ce gabarit.
5. Sous **Available variables**, clique sur une pastille de variable pour l'insérer dans le gabarit. Les variables s'écrivent sous la forme `${name}`, par exemple `${charName}`.
6. Modifie le texte dans le champ **Template**.
7. Vérifie le champ **Rendered preview** en dessous. L'aperçu remplit le gabarit avec des valeurs d'exemple pour te montrer le résultat.
8. Si l'aperçu affiche un avertissement **Unknown variables**, corrige la variable mal orthographiée. Un nom de variable absent de la liste **Available variables** ne sera pas remplacé.
9. Clique sur **Save**.

Le message "Prompt override saved" doit s'afficher et la pastille d'état doit passer à **Custom active**.

## Conserver un gabarit sans l'utiliser

L'interrupteur **Apply this override** se trouve sous l'aperçu. Son texte d'aide indique "Turn this off to keep the template saved without using it." Désactive-le pour garder ton brouillon en réserve pendant que la fonctionnalité continue d'utiliser le gabarit intégré. La pastille d'état affiche alors **Custom paused**.

## Revenir au gabarit intégré

Clique sur **Reset to Default** pour supprimer ton gabarit personnalisé et réutiliser le gabarit intégré. Si un remplacement est enregistré, l'application te demande d'abord de confirmer. La pastille d'état revient à **Default**.

## Quand les remplacements s'appliquent

Un Prompt Override ne joue un rôle que pour les fonctionnalités qui génèrent réellement des images ou des vidéos : les ressources de Game Mode, les selfies et les appels du mode Conversation, les sprites et les images des publications Noodle. Ces fonctionnalités exigent aussi qu'une connexion de génération d'images ou de vidéos soit configurée au préalable. Sans connexion de génération opérationnelle, rien ne se lance et le gabarit ne sert jamais. Voir [Fournisseurs de génération d'images et configuration](../media/image-providers.md) et [Génération de vidéos de scène](../media/scene-video.md).

## Guides associés

- [Fournisseurs de génération d'images et configuration](../media/image-providers.md)
- [Génération de vidéos de scène](../media/scene-video.md)
- [Profils de style d'image](../media/style-profiles.md)
- [Réglages de Noodle et reprise du chat](../noodle/settings.md)
- [Éditeur de preset et gestionnaire de prompts](presets.md)
- [Paramètres de génération](generation-parameters.md)
