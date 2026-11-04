# Expressions animées

Les expressions animées sont de courtes animations en boucle qui servent de sprites de portrait à un personnage. Le sprite, c'est l'image du personnage que Marinara affiche pendant un chat. Un sprite d'expression classique est une image fixe, comme un visage joyeux. Une expression animée se joue à sa place et est enregistrée en GIF, un fichier image qui joue une courte animation en boucle, tout seul.

La création se fait en deux temps. Marinara demande à un compte **Video Generation** (génération de vidéos) un court clip de l'expression, puis convertit ce clip en GIF en boucle sur ton ordinateur. Une fois enregistrée, l'expression animée fonctionne comme n'importe quel autre sprite. L'agent téléchargeable **Expression Engine** l'affiche quand la scène appelle cette émotion. Voir [Sprites de personnage](../characters/sprites.md) et [Référence des agents téléchargeables](../agents/built-in-agents.md).

<a id="before-you-start"></a>

## Avant de commencer

Il te faut deux choses.

1. Un compte vidéo. Voir [Génération de vidéos de scène](scene-video.md) pour en ajouter un.
2. ffmpeg sur l'ordinateur qui fait tourner Marinara. ffmpeg est un outil média gratuit qui convertit le clip en GIF.

Si ffmpeg manque, la génération échoue immédiatement avec ce message :

```text
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Installe ffmpeg de façon que ton système le trouve, ou définis la variable d'environnement `FFMPEG_PATH` avec le chemin complet du programme ffmpeg. Une variable d'environnement est un réglage que tu donnes au serveur avant son démarrage.

## Générer des expressions animées

Tu utilises la même fenêtre que pour les sprites fixes.

1. Ouvre le **Character Editor** (éditeur de personnage) d'un personnage, ou le **Persona Editor** (éditeur de persona) d'un persona.
2. Ouvre l'onglet **Sprites**, puis la catégorie **Facial Expressions** (expressions du visage).
3. Clique sur **Generate Sprite** (générer un sprite). La fenêtre **Generate Sprites** s'ouvre.
4. Coche **Generate animated portraits** (générer des portraits animés). La fenêtre passe en mode animé. Le sélecteur d'images devient un sélecteur de vidéos, les réglages de grille des planches de sprites disparaissent, et Marinara crée une expression à la fois.
5. Choisis ton compte vidéo.
6. Remplis le champ **Appearance Description** (description de l'apparence) pour que le service sache à quoi ressemble le personnage.
7. Choisis les expressions à générer.
8. Clique sur **Generate Animated Portrait** pour une seule expression, ou sur **Generate Animated Portraits** pour plusieurs.

Pendant le traitement, tu vois "Generating animated portrait GIFs...". Une fois la génération terminée, examine les résultats et clique sur le bouton d'enregistrement pour les ajouter au personnage ou au persona. Si une expression échoue, Marinara conserve celles qui ont abouti et liste les noms en échec pour que tu puisses réessayer.

Les expressions animées prennent plus de temps que les sprites fixes, car elles sont créées une par une. Commence par quelques-unes.

Quand le réglage **Expose media prompts before sending** (afficher les prompts médias avant l'envoi) est activé dans **Settings → Generations → Overall Generations** (Paramètres → Générations → Générations globales), Marinara marque une pause pour que tu puisses lire et modifier chaque prompt – le texte que Marinara envoie à l'IA – avant qu'il parte vers le service.

## Durée et format

Chaque expression animée est un clip de portrait vertical au format 9:16, que tu ne peux pas modifier. Pour changer la durée de chaque clip, ouvre **Settings → Generations** (Paramètres → Générations), repère **Video Generation** et règle **Animated expression length** (durée des expressions animées). La valeur par défaut est de 3 secondes. La plage va de 1 à 8 secondes. Marinara enregistre un petit GIF en boucle, large de 512 pixels. Un clip plus court donne un fichier plus léger et une boucle plus serrée.

<a id="backgrounds-are-not-removed"></a>

## L'arrière-plan n'est pas retiré

Les sprites fixes peuvent être détourés de leur arrière-plan, pour que le personnage flotte au-dessus de la scène. Les expressions animées sautent ce nettoyage. En mode animé, la case à cocher **Prefer clean transparent-style background** (préférer un arrière-plan net, de style transparent) ajoute seulement une indication au prompt vidéo. Son texte d'aide indique "GIF transparency is not guaranteed." L'étape de relecture signale que le nettoyage d'arrière-plan, le découpage des planches et le recadrage des images sont ignorés pour une sortie GIF. Une expression animée peut garder un arrière-plan visible. Demande un arrière-plan uni dans le champ **Appearance Description** pour un rendu plus propre.

## Dépannage

- **La génération échoue avec un message au sujet de ffmpeg** : installe ffmpeg ou définis `FFMPEG_PATH`. Voir [Avant de commencer](#before-you-start).
- **Le sélecteur indique qu'aucun compte vidéo n'a été trouvé** : ajoutes-en un d'abord. Voir [Génération de vidéos de scène](scene-video.md).
- **Le bouton Generate Sprite est désactivé** : sur certains appareils, comme certaines installations Android et Termux, Marinara ne parvient pas à charger sa bibliothèque d'images. Cela désactive toute génération de sprites, expressions animées comprises.
- **Le GIF enregistré affiche toujours un arrière-plan** : c'est normal. Voir [L'arrière-plan n'est pas retiré](#backgrounds-are-not-removed).

## Guides associés

- [Sprites de personnage](../characters/sprites.md)
- [Génération de vidéos de scène](scene-video.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
