# Profils de style d'image

Un profil de style est un "style maison" réutilisable qui façonne chaque prompt d'image (le texte que Marinara envoie à l'IA) avant que Marinara ne le transmette à ton service d'images. Sers-t'en pour donner un rendu cohérent aux avatars, portraits, selfies, arrière-plans, illustrations et sprites. Ce guide explique comment en choisir un, le modifier et le tester.

## Ce qu'est un profil de style

Chaque image générée part d'un prompt textuel : avatars, portraits, selfies de Conversation, arrière-plans de scène, illustrations et sprites. Un profil de style est un ensemble de règles enregistré que Marinara ajoute à ce prompt. Il peut ajouter des mots positifs (ce que tu veux), des mots négatifs (ce que tu veux éviter) et un style de prompt préféré. Tu choisis un profil comme valeur par défaut pour toute l'application. Tu peux le remplacer pour un chat ou pour un modèle d'image.

Pour trouver l'éditeur, ouvre **Settings → Generations → Image Generation** (Paramètres → Générations → Génération d'images) et descends jusqu'à **Style Profiles** (profils de style).

## Les profils intégrés

Marinara a 10 profils de style intégrés. **Auto** est le profil par défaut. Tu peux modifier n'importe lequel d'entre eux et rétablir à tout moment les valeurs d'origine d'un profil intégré.

Termes employés ci-dessous :

- SDXL, c'est Stable Diffusion XL, un modèle d'image ouvert très répandu que tu peux faire tourner sur ton ordinateur ou via un service en ligne.
- Un checkpoint est un fichier de modèle d'image entraîné. Illustrious, Pony et NovelAI sont des exemples cités ici.
- Danbooru est un grand site d'images anime. Ses tags courts séparés par des virgules, comme "1girl, long hair, smile", sont devenus une façon courante de rédiger les prompts des modèles d'images anime.

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

Le profil par défaut s'applique à toutes les images, sauf si un chat ou un modèle d'image le remplace.

1. Ouvre **Settings → Generations → Image Generation → Style Profiles**.
2. Ouvre la liste **Default style** (style par défaut).
3. Choisis un profil.

Ton choix s'enregistre aussitôt, et les nouvelles images l'utilisent.

## Dupliquer et personnaliser un profil

Tu peux modifier un profil intégré directement, ou utiliser **Clone** (dupliquer) pour garder l'original et construire le tien.

1. Ouvre le menu déroulant **Editing** (édition) et choisis le profil le plus proche de ce que tu veux.
2. Clique sur **Clone**. Marinara crée une copie, la sélectionne pour l'édition et en fait aussitôt le style par défaut de toute l'application.
3. Remplace le contenu du champ **Name** (nom) par un intitulé que tu reconnaîtras.
4. Choisis une **Prompt grammar** (grammaire du prompt), expliquée dans la section suivante.
5. Renseigne le champ **Style text** (texte de style) avec une description simple du rendu voulu. Quand une IA écrit le prompt d'image, comme le font l'agent Illustrator, les selfies et Noodle, elle suit ton Style text au lieu de le recopier. Pour d'autres images, comme les avatars, le Style text peut être ajouté tel quel.
6. Ajoute des **Positive tags** (mots à inclure) et des **Negative tags** (mots à éviter).
7. Ouvre la section **Per-image tags** (tags par type d'image) pour ajouter des tags propres à chaque type d'image (avatar, portrait, selfie, arrière-plan, illustration, sprite).
8. Ta copie est devenue le style par défaut de l'application à l'étape 2. Pour rendre ce rôle à un autre profil, ouvre **Default style** et choisis le profil voulu.

Deux boutons aident à gérer les profils :

- Le bouton **Reset** (réinitialiser) ne fonctionne que sur les profils intégrés. Il rétablit les valeurs d'origine du profil intégré concerné.
- Le bouton **Delete** (supprimer) ne fonctionne que sur les profils que tu as créés, et seulement tant qu'il reste plus d'un profil.

## Les modes de grammaire du prompt

**Prompt grammar** indique à Marinara comment le modèle d'image préfère lire un prompt. Choisis le mode qui correspond à ton modèle.

- **Hybrid** : un mélange de phrases et de tags. Un choix général sans risque.
- **Danbooru tags** : tags courts façon Danbooru, séparés par des virgules. Idéal pour les checkpoints anime SDXL comme Illustrious, Pony et NovelAI.
- **Tags** : mots-clés courts séparés par des virgules, sans la convention Danbooru.
- **Natural language** : des phrases simples. Idéal pour les modèles qui lisent de la prose, comme DALL-E et les modèles Z-Image Turbo.

## Le banc d'essai

Le **Test bench** (banc d'essai), dans l'éditeur Style Profiles, montre exactement ce que Marinara enverrait, sans créer de vraie image.

1. Choisis un **Image kind** (type d'image), par exemple portrait ou arrière-plan.
2. Saisis un prompt approximatif dans **Sample input** (exemple de saisie).
3. Lis les cadres **Final positive prompt** et **Final negative prompt**.

Le **Test bench** affiche aussi une courte note sur le nettoyage. Quand rien ne change, il indique "No cleanup needed for this sample." Quand il modifie le prompt, il précise combien de fragments en double ou mal placés il a nettoyés.

## Comment Marinara nettoie le prompt

Avant qu'une requête d'image ne quitte Marinara, le prompt est compilé avec le profil actif. Le compilateur :

- supprime les tags quasi identiques, par exemple un tag de qualité répété ;
- déplace les formulations négatives simples comme "avoid text" ou "no watermark" vers le prompt négatif ;
- conserve ta formulation pour les images d'arrière-plan, d'illustration et de selfie, mais distille tes mots en courts tags visuels qu'il reconnaît pour les portraits, avatars et sprites ; et
- ajoute les tags par type d'image du profil, selon le type d'image en cours de génération.

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

Marinara peut prendre un profil de style à trois endroits. Le choix le plus spécifique l'emporte.

1. Un profil choisi pour le chat ou la partie en cours.
2. Le profil de style défini sur le modèle d'image, dans la section **Local image defaults** (valeurs par défaut des images locales) de son éditeur.
3. Le **Default style** global dans **Settings**.

La section **Local image defaults** n'apparaît que pour AUTOMATIC1111 / SD Web UI, ComfyUI et NovelAI. Pour tous les autres services, le choix retombe sur le **Default style** global. Pour définir un profil par modèle, ouvre le modèle d'image, déplie **Local image defaults** et choisis un profil dans la liste des profils de style. Laisse-la sur **Use global default** (utiliser la valeur globale par défaut) pour suivre le choix global. Quand Marinara devine un bon profil à partir du nom du modèle, il affiche un bouton "Use ..." qui l'applique en un clic.

## Guides associés

- [Fournisseurs de génération d'images et configuration](image-providers.md)
- [Agent Illustrator](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
