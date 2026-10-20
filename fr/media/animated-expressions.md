# Expressions animées

Ce guide explique les expressions animées de Marinara Engine : de courtes animations en boucle qui servent de sprites de portrait à un personnage. Le sprite, c'est l'image du personnage que Marinara affiche pendant un chat. Avec les expressions animées, ces portraits bougent au lieu de rester figés.

## À quoi correspond une expression animée

Un sprite d'expression classique est une image fixe : un visage joyeux, un visage en colère. Une expression animée est une courte animation en boucle qui remplace cette image fixe. Marinara enregistre chacune d'elles sous forme de sprite GIF. Le GIF est un fichier image qui joue une courte animation en boucle, tout seul.

Marinara crée une expression animée en deux temps. D'abord, Marinara demande à une connexion **Video Generation** (génération de vidéos) de produire un court clip vidéo de l'expression. Ensuite, ce clip est converti en sprite GIF animé sur ta machine.

Une fois enregistrée, l'expression animée fonctionne comme n'importe quel autre sprite. L'agent téléchargeable **Expression Engine** la choisit et l'affiche quand la scène appelle cette émotion. Voir [Sprites de personnage](../characters/sprites.md) pour l'affichage des sprites, et [Référence des agents téléchargeables](../agents/built-in-agents.md) pour Expression Engine.

## Avant de commencer

Deux éléments doivent être en place avant de générer des expressions animées.

1. Une connexion **Video Generation**. C'est un fournisseur enregistré capable de produire de la vidéo. Voir [Génération de vidéos de scène](scene-video.md) pour en ajouter une.
2. ffmpeg installé sur la machine qui fait tourner Marinara. ffmpeg est un outil média gratuit qui convertit le clip vidéo en sprite GIF.

Si ffmpeg est introuvable, la génération échoue immédiatement avec ce message :

```
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Pour corriger ça, installe ffmpeg et vérifie que le système sait le trouver. Autre option : renseigner la variable d'environnement `FFMPEG_PATH` avec le chemin complet du programme ffmpeg. Une variable d'environnement est un réglage que tu donnes au serveur avant son démarrage.

## Activer les portraits animés

Les expressions animées se génèrent depuis la même fenêtre que les sprites fixes.

1. Ouvre le **Character Editor** (éditeur de personnage) pour ton personnage, ou le **Persona Editor** (éditeur de persona) pour un persona.
2. Va dans l'onglet **Sprites**, puis dans la catégorie **Facial Expressions**.
3. Clique sur **Generate Sprite** (générer un sprite). La fenêtre **Generate Sprites** s'ouvre.
4. Coche la case **Generate animated portraits** (générer des portraits animés). La fenêtre passe en mode animé :
   - Le sélecteur de connexion passe de **Image Generation Connection** à **Video Generation Connection**.
   - Les réglages de grille des planches de sprites fixes disparaissent.
   - Marinara génère alors une expression à la fois, et non une planche entière.
5. Choisis la connexion **Video Generation Connection** dans le menu déroulant.
6. Remplis le champ **Appearance Description** (description de l'apparence) pour que le fournisseur sache à quoi ressemble le personnage.
7. Choisis les expressions à générer.
8. Clique sur **Generate Animated Portrait** pour une seule expression, ou sur **Generate Animated Portraits** pour plusieurs.

Pendant le traitement, le message "Generating animated portrait GIFs..." s'affiche. Chaque expression devient d'abord une courte vidéo, que Marinara convertit ensuite en sprite GIF.

Une fois la génération terminée, examine les résultats et clique sur le bouton d'enregistrement pour les ajouter au personnage ou au persona. Si une expression échoue, Marinara conserve celles qui ont abouti. Les noms en échec sont listés pour que tu puisses réessayer.

## Durée et format

Chaque expression animée est un clip de portrait vertical. Le format est fixé à 9:16 (portrait) et n'est pas modifiable.

En revanche, la durée de chaque clip se règle. Ouvre **Settings** (Paramètres) et repère la section **Video Generation**. Le réglage s'appelle **Animated expression length**. Il vaut 3 secondes par défaut. Tu peux le fixer entre 1 et 8 secondes.

Marinara enregistre le résultat final sous forme de petit GIF en boucle, large de 512 pixels. Un clip plus court donne un fichier plus léger et une boucle plus courte et plus nerveuse.

## Réserve sur la transparence

Les sprites fixes peuvent être détourés de leur arrière-plan, pour que le personnage flotte au-dessus de la scène. Les expressions animées, c'est différent. Marinara ne leur applique aucun nettoyage d'arrière-plan.

En mode animé, la case de l'arrière-plan transparent s'intitule **Prefer clean transparent-style background**. Cette case ajoute seulement une indication au prompt vidéo, c'est-à-dire au texte que Marinara envoie à l'IA. Son texte d'aide le dit clairement : "Adds a flat transparent-friendly background instruction to the video prompt. GIF transparency is not guaranteed."

L'étape de relecture confirme la même chose. Elle affiche cette note : "Animated portrait sprites are saved as looping GIFs. Static background cleanup, sheet slicing, and frame cropping are skipped for GIF output." Une expression animée peut donc garder un arrière-plan visible. Demande un arrière-plan uni dans le champ **Appearance Description** si tu veux un rendu plus net.

## À quoi s'attendre

Les expressions animées prennent plus de temps que les sprites fixes. Marinara les génère une par une, jamais par lot. Choisir beaucoup d'expressions d'un coup peut être long : commence par quelques-unes.

Si tu as activé **Expose media prompts before sending** (dans **Settings**, section **Overall Generations**), Marinara marque une pause à une étape de relecture des prompts. Tu peux lire et modifier chaque prompt avant son envoi au fournisseur. Laisse ce réglage désactivé pour sauter la relecture.

## Dépannage

La génération échoue avec un message au sujet de ffmpeg. Installe ffmpeg et vérifie que le serveur sait le trouver, ou renseigne la variable d'environnement `FFMPEG_PATH`. Voir "Avant de commencer" plus haut.

Le menu déroulant indique qu'aucune connexion de génération de vidéos n'a été trouvée. Ajoute d'abord une connexion **Video Generation**. Voir [Génération de vidéos de scène](scene-video.md).

Le bouton **Generate Sprite** est désactivé. Sur certains appareils, Marinara ne parvient pas à charger sa bibliothèque d'images, ce qui désactive toute génération de sprites, expressions animées comprises. Ça arrive sur certaines installations Android et Termux.

Le GIF enregistré affiche toujours un arrière-plan. C'est normal. Les expressions animées sautent le nettoyage d'arrière-plan. Voir "Réserve sur la transparence" plus haut.

## Guides associés

- [Sprites de personnage](../characters/sprites.md)
- [Génération de vidéos de scène](scene-video.md)
- [Référence des agents téléchargeables](../agents/built-in-agents.md)
