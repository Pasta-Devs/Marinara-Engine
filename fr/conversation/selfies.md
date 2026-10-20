# Selfies

Ce guide explique les selfies en mode Conversation. Un selfie est une image qu'un personnage génère de lui-même et envoie dans le chat, comme une photo partagée dans une application de messagerie. Au programme : comment activer les selfies, comment les régler et comment en demander un toi-même.

## À quoi servent les selfies

Les selfies sont une fonctionnalité du mode Conversation. Un personnage peut envoyer une photo générée de lui-même au fil d'un chat normal. C'est différent des images de scène utilisées en mode Roleplay et en Game Mode. Les selfies sont pensés pour l'ambiance "application de messagerie" du mode Conversation.

Les selfies reposent sur la génération d'images. Chaque selfie qu'un personnage envoie consomme une requête de génération d'images auprès de la connexion que tu choisis. C'est pourquoi les selfies restent désactivés tant que tu ne les as pas réglés.

Les selfies proviennent du paquet optionnel **Illustrator**. Installe Illustrator depuis **Agents → Download Agents** avant de passer aux réglages.

## Activer les selfies

Les selfies se trouvent dans la section **Illustrator Settings** (réglages de l'Illustrator), à l'intérieur de la section **Agents** d'un chat en mode Conversation. Les **Commands** (commandes) sont des actions cachées qu'un personnage peut décider d'exécuter seul, comme envoyer un selfie ou passer une chanson. Les contrôles de commandes apparaissent dans la section **Agents** dès qu'un paquet fournissant des commandes est installé.

Pour activer les selfies :

1. Ouvre un chat en mode Conversation.
2. Ouvre **Chat Settings** (réglages du chat), l'icône avec les curseurs.
3. Repère la section **Agents**.
4. Active l'interrupteur principal **Commands** qui s'y trouve. Tant qu'il est désactivé, aucun personnage ne peut utiliser la moindre action cachée.
5. Repère la section **Illustrator Settings**.
6. Active l'interrupteur **Generated Selfies** (selfies générés).

Une fois **Generated Selfies** activé, les réglages des selfies apparaissent sous l'interrupteur. Tu vois alors les champs pour la connexion, le modèle de prompt, le style et les références. Les boutons **Resolution** n'apparaissent qu'après avoir choisi une **Selfie Connection**.

## Réglages des selfies

Les selfies activés, il reste à définir leur apparence et le service qui les fabrique. Tous ces réglages se trouvent dans la section **Illustrator Settings**, sous **Chat Settings → Agents**. Ils ne valent que pour le chat en cours.

### Selfie Connection

Le champ **Selfie Connection** (connexion pour les selfies) choisit le service de génération d'images qui dessine la photo. La valeur par défaut est **None (selfies disabled)** : aucun service n'est encore sélectionné. Choisis ici l'une des connexions d'image que tu as configurées.

Tant qu'aucune **Selfie Connection** n'est choisie, les personnages ne peuvent pas envoyer de selfie. Si la note "Choose a Selfie Connection to let characters generate selfie images" s'affiche, c'est que la connexion est encore vide.

Pour savoir comment ajouter une connexion d'image, consulte [Fournisseurs de génération d'images et configuration](../media/image-providers.md).

### Prompt Model

Le champ **Prompt Model** (modèle de prompt) choisit le modèle de texte qui rédige la description du selfie. La connexion d'image dessine ensuite cette description. La valeur par défaut est **Main chat model**, qui réutilise le modèle déjà employé par le chat. Tu peux sélectionner une autre connexion de texte si tu préfères qu'un autre modèle écrive la description du selfie.

### Image Style

Le champ **Image Style** (style d'image) choisit un Style Profile pour le selfie. Un Style Profile est un ensemble enregistré de mots décrivant un style graphique, par exemple "anime" ou "realistic photo". La valeur par défaut est **Use default style from Style Profiles in Advanced settings**, qui suit ton style global par défaut.

Pour en savoir plus sur les styles, consulte [Profils de style d'image](../media/style-profiles.md).

### Send Avatar References

**Send Avatar References** (envoyer l'avatar en référence) est un menu déroulant réglé sur **Off** (désactivé) par défaut. Il se trouve sous la section **Video messages** (messages vidéo), et chaque choix indique à quoi il s'applique : **Images only** (images seulement), **Videos only** (vidéos seulement) ou **Images and videos** (images et vidéos).

- Pour les images, Marinara envoie l'avatar ou le sprite du personnage au service d'image comme image de référence. Le selfie ressemble ainsi davantage au personnage. Cela ne fonctionne que si le fournisseur d'images prend en charge les images de référence.
- Pour les vidéos, un message vidéo dont la **First frame** (première image) est **Prompt only** part de l'avatar ou du sprite du personnage au lieu de ne partir d'aucune image. Les services vidéo n'acceptent qu'une seule image de départ : les autres choix de première image, qui partent déjà d'une image du personnage, ne sont donc pas concernés.

### Attach Card Appearance

**Attach Card Appearance** (joindre l'apparence de la fiche) est un menu déroulant réglé sur **Off** par défaut, avec les mêmes choix **Images only**, **Videos only** et **Images and videos**. Il ajoute le texte d'apparence de la fiche de chaque personnage nommé dans le prompt au prompt du selfie, au prompt de la vidéo, ou aux deux. Le modèle dispose ainsi de plus de détails sur le physique du personnage.

Si la fiche ou le persona a aussi **Image Appearance Override** (apparence propre aux images) activé, Marinara envoie ce remplacement à la place du texte d'**Appearance**. Active cette option sous **Appearance** dans l'éditeur de personnage ou de persona lorsque la description complète d'**Appearance** est écrite pour le narrateur plutôt que pour un modèle d'images. L'IA qui écrit la description du selfie lit quand même aussi le champ **Appearance** de la fiche. Elle garde tels quels les mots d'**Image Appearance Override** et ne se sert du texte d'**Appearance** que pour compléter les autres détails.

### Resolution

Le réglage **Resolution** (résolution) définit la taille de l'image du selfie. Les boutons **Resolution** n'apparaissent qu'après avoir choisi une **Selfie Connection**. Choisis l'un des boutons rapides. La valeur par défaut est **896x1152**, un format portrait allongé qui convient à la plupart des selfies.

Voici les tailles proposées :

| Résolution | Format             |
| ---------- | ------------------ |
| 512x512    | Carré              |
| 512x768    | Portrait           |
| 768x768    | Carré              |
| 768x1024   | Portrait           |
| 896x1152   | Portrait (par défaut) |
| 1024x1024  | Carré              |

## Comment un personnage envoie un selfie

Une fois les selfies réglés, un personnage peut décider d'en envoyer un de lui-même pendant le chat. Tu n'as aucune commande à taper. Le personnage choisit le moment, Marinara génère l'image et la publie dans le chat. Les réponses suivantes voient une courte note qui indique ce que montrait le selfie : le personnage se souvient donc de l'avoir envoyé.

La réponse du modèle utilise `[selfie]`, avec un contexte facultatif :

```text
Here is a picture from my walk!
[selfie: context="standing beside the river at sunset"]
```

Les formes `[selfie: "standing beside the river"]` et `[selfie: standing beside the river]` fonctionnent aussi. La casse n'a pas d'importance : `[SELFIE:xxxxx.]` est donc une syntaxe valide. C'est une commande Conversation, pas un déclencheur d'image pour Roleplay ou Game Mode. Un marqueur resté tel quel dans le message peut indiquer un autre mode de chat ou la désactivation de **Commands**. Vérifie qu'Illustrator est installé, que **Generated Selfies** est activé et que **Selfie Connection** est choisie. Si la génération démarre puis échoue, examine l'erreur de connexion ou du fournisseur d'images. Changer les majuscules du marqueur ne la corrigera pas.

## Demander un selfie soi-même

Autre option : demander toi-même un selfie plutôt que d'attendre le personnage.

1. Ouvre **Chat Settings** et déplie **Gallery** (galerie).
2. Clique sur le bouton **Selfie**, l'icône d'appareil photo.
3. Si le chat compte plusieurs personnages, choisis qui prend le selfie dans la liste des personnages située à côté du bouton.
4. Si l'option **Expose media prompts before sending** est activée sous **Settings**, **Generations**, **Overall Generations**, relis ou modifie le prompt de selfie final, puis clique sur **Generate**. Si tu annules à cette étape, aucune requête d'image n'est envoyée.
5. Patiente pendant que le bouton affiche **Generating...**.

Quand le selfie est prêt, le message "Selfie generated." s'affiche et l'image apparaît dans le chat. Cette demande manuelle passe elle aussi par la **Selfie Connection** choisie : elle consomme donc également une requête de génération d'images.

<a id="making-a-selfie-again"></a>

## Refaire un selfie

L'image ne te plaît pas ? Clique sur un selfie dans le chat pour l'ouvrir, puis clique sur **Regenerate image** (régénérer l'image), la flèche circulaire à côté du bouton d'épingle. Tu peux modifier le prompt, le prompt négatif et les éventuels prompts de personnage, et choisir une **Image connection** (connexion d'image). Clique sur **Generate image** (générer l'image). La nouvelle image remplace l'ancienne dans le message, et l'ancienne reste dans la galerie. Chaque essai consomme une requête de génération d'images.

Les images créées avant l'arrivée de cette option peuvent aussi être refaites. Elles utilisent la connexion de selfies du chat, et leurs prompts négatifs et de personnage n'avaient pas été enregistrés.

<a id="video-messages"></a>

## Messages vidéo

Un personnage peut aussi t'envoyer un court clip vidéo. Tape `/video`, ou `/video Aster` pour choisir un personnage, ou clique sur **Video**, l'icône de pellicule, dans la **Gallery** du chat : ce bouton utilise le personnage choisi dans la galerie. Le bouton **Video** fonctionne dès qu'Illustrator est installé, même si les selfies sont désactivés. Le clip arrive sous la forme d'un nouveau message de ce personnage et se lit dans le chat. Quand tu demandes un clip de cette façon, il montre le moment le plus récent du chat : l'IA qui en écrit le prompt lit autant de messages récents qu'Illustrator pour une image, c'est-à-dire la taille de contexte de son **Agent Budget** (budget de l'agent). Quand la première image est un selfie, elle s'appuie sur les mêmes messages : le clip part donc lui aussi de ce moment. Les réponses suivantes voient une courte note qui indique ce que montre le clip. Tu peux aussi animer une image depuis la galerie : le clip prolonge cette image, il est envoyé par le personnage choisi dans la galerie et rejoint la réponse la plus récente. Si un clip ne peut pas être ajouté au chat, il est quand même enregistré dans l'onglet **Videos** de la galerie. La galerie propre à un personnage ne liste un message vidéo que si le clip montre ce personnage ; consulte [Galeries de personnages et de personas](../characters/galleries.md).

Règle tout cela sous **Chat Settings**, **Agents**, **Illustrator Settings**, dans la section **Video messages** :

- **Video Connection** (connexion vidéo) choisit la connexion Video Generation. Garde l'option **Default video connection** (connexion vidéo par défaut) pour utiliser ta connexion par défaut. Les **Video Prompting Instructions** (instructions de prompt vidéo) d'une connexion guident l'IA qui écrit le prompt vidéo.
- **First frame** choisit l'image de départ du clip :
  - **New selfie, or the avatar if no selfie connection** (par défaut) : crée un nouveau selfie quand les selfies sont activés et qu'une **Selfie Connection** est définie, et utilise l'avatar sinon.
  - **New selfie, then animate it** : crée toujours d'abord un nouveau selfie. Cette option exige que les selfies soient activés et qu'une **Selfie Connection** soit définie, et le selfie est aussi enregistré dans la galerie. Si l'option **Expose media prompts before sending** est activée, tu relis le prompt du selfie en même temps que celui du clip.
  - **Avatar or sprite** : part de l'avatar du personnage, ou d'un sprite en pied s'il n'a pas d'avatar.
  - **Prompt only (no picture)** : n'envoie aucune image, si bien que le modèle vidéo travaille à partir du seul prompt. Certains workflows ComfyUI ont besoin d'une image et échouent sans elle. Quand **Send Avatar References** inclut les vidéos, ce choix s'affiche sous le nom **Prompt only (avatar from Send Avatar References)** et le clip part plutôt de l'avatar.

Les images dans d'autres formats, comme le WebP, sont converties pour le service vidéo. Un message vidéo envoie une requête vidéo, plus une requête d'image quand il part d'un nouveau selfie. L'IA qui écrit le prompt est ton **Prompt Model**, et ses instructions se trouvent sous **Settings**, **Generations**, **Video Generation Prompt Overrides** (remplacements de prompt pour la génération de vidéos), **Conversation Video Message** (message vidéo de Conversation).

## Guides associés

- [Mode Conversation : premiers pas](getting-started.md)
- [Fournisseurs de génération d'images et configuration](../media/image-providers.md)
- [Profils de style d'image](../media/style-profiles.md)
