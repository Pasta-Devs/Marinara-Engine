# Prompt Overrides pour l'image et la vidéo

Les Prompt Overrides (remplacements de prompt) sont des éditeurs pour les gabarits dont Marinara se sert pour rédiger les prompts destinés aux modèles d'image et de vidéo. Un prompt, c'est le texte envoyé au modèle. Sers-toi de l'un de ces éditeurs pour changer la façon dont les portraits, les selfies, les sprites, les illustrations de scène, les storyboards ou les clips vidéo sont décrits au modèle.

Ils ne changent pas le prompt envoyé à ton modèle de chat. Pour cela, utilise un preset. Voir [Éditeur de presets et gestionnaire de prompts](presets.md) et [Paramètres de génération](generation-parameters.md).

Un sprite est un élément d'illustration d'un personnage, par exemple une expression ou une pose. Un storyboard est une série d'images illustrées tirées d'un tour de Game Mode ou d'un épisode de Roleplay terminé.

Avant de commencer : les Prompt Overrides ne comptent que pour les fonctionnalités qui génèrent des images ou des vidéos, et celles-ci demandent d'abord un compte de génération d'images ou de vidéos. Sans ce compte, le gabarit ne sert jamais. Voir [Fournisseurs de génération d'images et configuration](../media/image-providers.md) et [Génération de vidéos de scène](../media/scene-video.md).

## Trouver les éditeurs

1. Ouvre **Settings** (Paramètres).
2. Clique sur l'onglet **Generations** (générations).
3. Descends jusqu'à **Prompt Overrides** ("Reusable image and video prompt templates").

Deux éditeurs s'y trouvent. Clique sur un titre pour le déplier.

| Éditeur | Gabarits concernés |
| --- | --- |
| **Video Generation Prompt Overrides** | Vidéos de scène de Game Mode et de la galerie, messages vidéo en mode Conversation, clips de personnage des appels en mode Conversation, portraits d'expression animés. |
| **Image Generation Prompt Overrides** | Selfies en mode Conversation, portraits de PNJ (personnages non-joueurs) de Game Mode, illustrations de scène, prompts de storyboard, le gabarit **Noodle Post Image**, et d'autres générateurs d'images. |

## Modifier un gabarit

1. Ouvre un éditeur.
2. Choisis un gabarit dans le menu déroulant **Registered prompt** (prompt enregistré). La liste dépend de l'éditeur.
3. Regarde la pastille d'état à côté, et lis la courte description sous le menu déroulant.
4. Sous **Available variables** (variables disponibles), clique sur une pastille de variable pour l'insérer. Les variables ressemblent à `${charName}`.
5. Modifie le texte dans le champ **Template** (gabarit).
6. Vérifie **Rendered preview** (aperçu du rendu). L'aperçu remplit ton gabarit avec des valeurs d'exemple.
7. Corrige tout avertissement **Unknown variables**. Un nom absent de la liste **Available variables** n'est pas remplacé.
8. Clique sur **Save** (enregistrer).

Le message "Prompt override saved" s'affiche, et la pastille passe à **Custom active**.

| Pastille d'état | Signification |
| --- | --- |
| **Default** | Aucun gabarit personnalisé n'est enregistré. |
| **Custom active** | Ton gabarit enregistré est utilisé. |
| **Custom paused** | Ton gabarit est enregistré mais désactivé. |

## Conserver un gabarit sans l'utiliser

Désactive **Apply this override** (appliquer ce remplacement), sous l'aperçu. Son texte d'aide indique "Turn this off to keep the template saved without using it." Marinara continue d'utiliser le gabarit intégré, et la pastille affiche **Custom paused**.

## Revenir au gabarit intégré

Clique sur **Reset to Default** (rétablir la valeur par défaut). Si un remplacement est enregistré, Marinara te demande de confirmer. La pastille revient à **Default**.

## Guides associés

- [Fournisseurs de génération d'images et configuration](../media/image-providers.md)
- [Génération de vidéos de scène](../media/scene-video.md)
- [Profils de style d'image](../media/style-profiles.md)
- [Réglages de Noodle et reprise vers les chats](../agents/noodle-settings.md)
- [Éditeur de presets et gestionnaire de prompts](presets.md)
- [Paramètres de génération](generation-parameters.md)
