# Profils de style d'image

Ce guide explique les profils de style d'image dans Marinara Engine. Un profil de style est un "style maison" réutilisable qui façonne chaque prompt d'image (le texte que Marinara envoie à l'IA) avant l'envoi au fournisseur d'images. Sers-t'en pour donner un rendu cohérent aux avatars, portraits, selfies, arrière-plans, illustrations et sprites.

## Ce qu'est un profil de style

Marinara Engine génère de nombreux types d'images : avatars de personnage et de persona, portraits, selfies en mode Conversation, arrière-plans de scène, illustrations dans la scène et sprites de personnage. Chacune de ces images part d'un prompt textuel.

Un profil de style est un ensemble de règles enregistrées que Marinara ajoute à ce prompt. Il peut ajouter des mots positifs (ce que tu veux), des mots négatifs (ce que tu veux éviter) et un style de prompt préféré. Toutes les images gardent ainsi le même rendu, sans que tu aies à retaper les mêmes mots de style à chaque fois.

Tu désignes un profil comme valeur par défaut pour toute l'application. Ce choix se remplace pour un chat précis ou pour une connexion d'images précise. Tout cela est expliqué plus bas.

Pour trouver l'éditeur, procède ainsi.

1. Ouvre **Settings** (Paramètres).
2. Ouvre l'onglet **Generations** (générations).
3. Repère la section **Image Generation** (génération d'images).
4. Descends jusqu'à **Style Profiles** (profils de style).

## Les profils intégrés

Marinara est livré avec 10 profils de style intégrés. **Auto** est le profil par défaut. Tu peux modifier n'importe lequel d'entre eux, et rétablir à tout moment les valeurs d'origine d'un profil intégré.

Quelques termes employés ci-dessous :

- SDXL signifie Stable Diffusion XL. C'est un modèle d'image ouvert très répandu, que tu peux faire tourner sur ton propre ordinateur ou via un service en ligne.
- Un checkpoint est un fichier de modèle d'image entraîné. Chacun télécharge différents checkpoints selon le rendu artistique recherché. Les profils citent ici Illustrious, Pony et NovelAI.
- Danbooru est un grand site d'images anime. Ses tags courts séparés par des virgules (comme "1girl, long hair, smile") sont devenus une façon courante de rédiger les prompts des modèles d'images anime.

Voici les profils intégrés :

- **Off** : n'ajoute aucun style maison. Le prompt part quasiment tel que tu l'as écrit.
- **Auto** : déduit un rendu cohérent à partir du personnage, du jeu, de la scène et du modèle d'image sélectionné. C'est le profil par défaut.
- **Anime** : tags génériques de style anime, pour un rendu de personnage net.
- **Danbooru / Illustrious** : tags à la Danbooru, pensés pour les checkpoints anime SDXL comme Illustrious, Pony et NovelAI.
- **Realistic SDXL** : réalisme en langage naturel pour les modèles SDXL.
- **Photorealistic** : prompts de type photo, avec une peau, une lumière et des matières crédibles.
- **Cinematic** : éclairage dramatique et composition forte, pour des visuels clés.
- **Digital Painting** : touche de pinceau façon concept art et éclairage travaillé.
- **Painterly Fantasy** : illustration fantasy peinte, aux contours doux.
- **Z-Image Turbo Narrative** : prose compacte pour les modèles Z-Image Turbo, qui comprennent bien les phrases simples.

## Changer le style global

Le profil global par défaut s'applique à toutes les images générées, sauf si un chat ou une connexion le remplace. Pour le changer, procède ainsi.

1. Ouvre **Settings**, puis l'onglet **Generations**, puis **Image Generation**, puis **Style Profiles**.
2. Ouvre le menu déroulant **Default style** (style par défaut).
3. Choisis le profil à utiliser dans toute l'application.

Le choix s'enregistre aussitôt. Les nouvelles images utilisent le profil retenu.

## Dupliquer et personnaliser un profil

Un profil intégré se modifie directement, mais le bouton **Clone** (dupliquer) permet de garder l'original et de construire ta propre version. Pour créer et personnaliser un profil, procède ainsi.

1. Ouvre le menu déroulant **Editing** (édition) et choisis le profil le plus proche de ce que tu veux.
2. Clique sur **Clone**. Marinara crée une copie, la sélectionne pour l'édition et en fait aussitôt le style par défaut de toute l'application.
3. Remplace le contenu du champ **Name** (nom) par un intitulé que tu reconnaîtras.
4. Choisis une **Prompt grammar** (expliquée dans la section suivante).
5. Renseigne le champ **Style text** (texte de style) avec une description simple du rendu voulu. Quand une IA écrit le prompt d'image, comme le font l'agent Illustrator, les selfies et Noodle, elle suit ton Style text au lieu de le recopier. Pour d'autres images, comme les avatars, le Style text peut être ajouté tel quel.
6. Ajoute des **Positive tags** (mots à inclure) et des **Negative tags** (mots à éviter).
7. Ouvre la section **Per-image tags** (tags par type d'image) pour ajouter des tags propres à chaque type d'image (avatar, portrait, selfie, arrière-plan, illustration, sprite).
8. Ta copie est devenue le style par défaut de l'application à l'étape 2. Pour rendre ce rôle à un autre profil, ouvre **Default style** et choisis le profil voulu.

Deux boutons aident à gérer les profils :

- Le bouton **Reset** (réinitialiser) ne fonctionne que sur les profils intégrés. Il rétablit les valeurs d'origine du profil intégré concerné.
- Le bouton **Delete** (supprimer) ne fonctionne que sur les profils que tu as créés, et seulement tant qu'il reste plus d'un profil.

## Les modes de grammaire du prompt

Le menu déroulant **Prompt grammar** (grammaire du prompt) indique à Marinara comment le modèle d'image préfère lire un prompt. Choisis le mode qui correspond au modèle d'image. Il existe quatre modes.

- **Hybrid** : un mélange de phrases et de tags. Un choix général sans risque.
- **Danbooru tags** : tags courts façon Danbooru, séparés par des virgules. Idéal pour les checkpoints anime SDXL comme Illustrious, Pony et NovelAI.
- **Tags** : mots-clés courts séparés par des virgules, sans la convention Danbooru.
- **Natural language** : des phrases simples. Idéal pour les modèles qui lisent de la prose, comme DALL-E et les modèles Z-Image Turbo.

## Le banc d'essai

La section **Test bench** (banc d'essai) montre exactement ce que Marinara enverrait, sans générer d'image réelle. Ouvre-la dans l'éditeur **Style Profiles**. Pour t'en servir, procède ainsi.

1. Choisis un **Image kind** (type d'image), par exemple portrait ou arrière-plan.
2. Saisis un prompt approximatif dans **Sample input** (exemple de saisie).
3. Lis les cadres **Final positive prompt** et **Final negative prompt**.

Le **Test bench** affiche aussi une courte note sur le nettoyage. Quand rien ne change, il indique "No cleanup needed for this sample." Quand il modifie le prompt, il précise combien de fragments en double ou mal placés il a nettoyés.

## Comment Marinara nettoie le prompt

Avant qu'une requête d'image ne quitte Marinara, le prompt est compilé avec le profil actif. Le compilateur fait plusieurs choses :

- Il supprime les tags quasi identiques, par exemple un tag de qualité répété.
- Il déplace les formulations négatives simples (comme "avoid text" ou "no watermark") vers le prompt négatif.
- Il conserve ta formulation pour les images d'arrière-plan, d'illustration et de selfie. Pour les portraits, avatars et sprites, il distille tes mots en courts tags visuels qu'il reconnaît.
- Il ajoute les tags par type d'image du profil, selon le type d'image en cours de génération.

## Exemple avant/après

Imagine que tu choisisses le profil **Danbooru / Illustrious**, que tu règles **Image kind** sur portrait et que tu saisisses ceci dans **Sample input** :

```
masterpiece, masterpiece, red-haired knight, no watermark
```

Le **Test bench** affiche alors ce **Final positive prompt** :

```
detailed eyes, solo, upper body, portrait, looking at viewer, anime screencap, masterpiece, best quality, absurdres
```

Trois choses se sont produites :

- "no watermark" a quitté le prompt positif pour rejoindre le **Final negative prompt**. La note de nettoyage comptabilise ce changement.
- Le profil a ajouté ses propres tags de style, ses tags de portrait et ses tags de qualité. Le "masterpiece" du résultat vient des tags du profil, pas des mots que tu as tapés.
- Tes mots ont été distillés. Pour les portraits, le compilateur ne garde que les fragments qu'il reconnaît comme des indices visuels clairs. "red-haired knight" n'en fait pas partie, il a donc été écarté.

Si les mots décrivant le sujet disparaissent pour un portrait, un avatar ou un sprite, essaie plutôt le type d'image **illustration**. Ce type conserve ta formulation.

## Ordre de priorité : chat, connexion, puis global

Marinara peut prendre un profil de style à trois endroits. Le choix le plus spécifique l'emporte. L'ordre est le suivant :

1. Un profil explicitement choisi pour le chat ou la partie en cours.
2. Le **Style Profile** défini sur la connexion d'images (dans **Local Image Defaults**, au sein de l'éditeur de connexion).
3. Le **Default style** global défini dans **Settings**.

La section **Local Image Defaults** (valeurs par défaut des images locales) n'apparaît que pour les connexions Stable Diffusion locales (AUTOMATIC1111 / SD Web UI, ComfyUI et NovelAI). Pour tous les autres fournisseurs, le choix retombe directement sur le **Default style** global. Pour définir un profil par connexion, ouvre la connexion, déplie **Local Image Defaults** et choisis un profil dans le menu déroulant **Style Profile**. Laisse-le sur **Use global default** pour suivre le choix global. Quand Marinara devine un bon profil à partir du nom de modèle de la connexion, un bouton "Use ..." apparaît et applique ce profil en un clic.

## Guides associés

- [Fournisseurs de génération d'images et configuration](image-providers.md)
- [Agent Illustrator](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
