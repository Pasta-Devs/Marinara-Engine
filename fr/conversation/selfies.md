# Selfies

Un selfie est une image qu'un personnage génère de lui-même et envoie dans un chat Conversation, comme une photo partagée dans une application de messagerie. Ce guide couvre l'activation des selfies, le choix de leur apparence, la demande manuelle d'un selfie et les messages vidéo.

Les selfies viennent du package facultatif **Illustrator** et utilisent la génération d'images. Chaque selfie est une requête d'image au service que tu choisis, donc ils restent désactivés jusqu'à ce que tu les actives. Ils sont différents des images de scène en mode Roleplay et en Game Mode.

## Activer les selfies

**Avant de commencer :** installe **Illustrator** depuis **Agents → Agent Organizer**, et ajoute un compte d'image, c'est-à-dire un compte pour un service qui fait des images (voir [Fournisseurs de génération d'images et configuration](../media/image-providers.md)).

1. Ouvre un chat Conversation, puis ouvre **Chat Settings** (réglages du chat).
2. Trouve la section **Agents** et ouvre **Illustrator Settings**.
3. Active **Generated Selfies**. Les réglages de selfie apparaissent en dessous.
4. Dans **Selfie model**, choisis ton compte d'image.

Activer **Generated Selfies** active aussi l'interrupteur principal **Commands** du chat.

Les personnages envoient des selfies seulement une fois **Selfie model** défini. Jusque-là, le chat affiche "Choose a Selfie Provider to let characters generate selfie images."

Si ça n'a pas marché : **Illustrator Settings** s'affiche seulement quand Illustrator est installé. Un selfie a aussi besoin de la commande **Selfies** activée (voir [Choisir quelles Commands un personnage peut utiliser](getting-started.md#choose-which-commands-a-character-can-use)).

## Réglages des selfies

Tous ces réglages sont dans **Illustrator Settings** et s'appliquent seulement au chat actuel.

- **Selfie model** : le compte d'image qui dessine l'image. La valeur par défaut est **None (selfies disabled)**.
- **Prompt Model** : le modèle de texte qui écrit la description de l'image. La valeur par défaut est **Agent default**.
- **Image Style** : un ensemble enregistré de mots de style artistique, comme "anime". La valeur par défaut est le style par défaut des Style Profiles dans Advanced settings. Voir [Profils de style d'image](../media/style-profiles.md).
- **Images Per Generation** : combien de variantes faire pour chaque illustration ou selfie.
- **Resolution** : la taille de l'image. Il s'affiche seulement après que tu as défini **Selfie model**. La valeur par défaut est 896x1152.
- **Send Avatar References** : envoie l'avatar ou le sprite du personnage comme image de référence. Désactivé par défaut. Il fonctionne seulement si le service d'image accepte des images de référence.
- **Attach Card Appearance** : ajoute au prompt le texte **Appearance** de la fiche de chaque personnage nommé. Désactivé par défaut.

Options de **Resolution** : 512x512, 512x768, 768x768, 768x1024, 896x1152 et 1024x1024. 896x1152 est un grand portrait qui convient à la plupart des selfies.

**Send Avatar References** et **Attach Card Appearance** proposent chacun **Off**, **Images only**, **Videos only** et **Images and videos**.

Si la fiche ou la persona a **Image Appearance Override** activé (sous **Appearance** dans l'éditeur), Marinara envoie ce texte à la place de **Appearance**. Utilise-le quand **Appearance** est écrit pour l'histoire, pas pour les images.

## Demander un selfie à la main

1. Ouvre **Chat Settings** et déploie la section **Gallery**.
2. Clique sur **Selfie**. Avec plus d'un personnage, choisis celui qui le prend dans la liste à côté du bouton.
3. Si **Expose media prompts before sending** est activé (dans **Settings → Generations → Overall Generations**), relis ou modifie le prompt et clique sur **Generate**. Annuler n'envoie aucune requête.
4. Attends pendant que le bouton affiche **Generating...**.

Tu vois "Selfie generated." et l'image apparaît dans le chat. Une requête manuelle utilise **Selfie model** et coûte une requête d'image.

## Comment les personnages envoient des selfies

Un personnage décide seul quand envoyer un selfie. Tu n'as rien à taper. Marinara génère l'image et la publie, et les réponses suivantes voient une courte note de ce qu'elle montrait.

Si ça n'a pas marché : quand tu vois le texte littéral `[selfie...]` dans un message, vérifie que le chat est en mode Conversation, que **Commands** et **Selfies** sont activés, que **Generated Selfies** est activé et que **Selfie model** est défini. Si la génération démarre mais échoue, lis l'erreur à propos du compte d'image.

## Refaire un selfie

1. Clique sur un selfie dans le chat pour l'ouvrir.
2. Clique sur **Regenerate image** (le bouton à flèche circulaire à côté du bouton épingle).
3. Modifie les prompts si tu le veux, y compris les **Character prompts**. Choisis un **Image model**, ou garde **Chat's image provider**.
4. Clique sur **Generate image**.

La nouvelle image remplace l'ancienne dans le message. L'ancienne reste dans la Gallery. Chaque essai est une requête d'image. Les images faites avant l'existence de cette option utilisent le compte de selfie du chat, et leurs prompts négatifs et de personnage n'ont pas été enregistrés.

<a id="video-messages"></a>

## Messages vidéo

Un personnage peut envoyer un court clip vidéo. Installe d'abord Illustrator. Les selfies peuvent rester désactivés.

Pour en demander un toi-même, tape `/video`, ou `/video Aster` pour choisir un personnage. Ou clique sur **Video** dans la **Gallery** du chat, qui utilise le personnage choisi là. Le clip arrive comme un nouveau message et se joue dans le chat. Il montre le dernier moment de la conversation : le modèle qui l'écrit lit autant de messages récents qu'Illustrator pour une image (son **Agent Budget**). Tu peux aussi animer une image depuis la Gallery. Le clip continue cette image et rejoint la réponse la plus récente. Si un clip ne peut pas être ajouté au chat, il est quand même enregistré dans l'onglet **Videos** de la Gallery. La galerie d'un personnage liste une vidéo seulement quand le clip montre ce personnage (voir [Galeries de personnages et de personas](../characters/galleries.md)).

### Réglages vidéo

Ouvre **Chat Settings → Agents → Illustrator Settings**, **Video messages**.

- **Generated Videos** : laisse les personnages envoyer des messages vidéo d'eux-mêmes. Désactivé par défaut dans les nouveaux chats, parce qu'un clip vidéo est une requête vidéo. Il s'affiche aussi comme **Videos** dans la liste **Commands**.
- **Video Run Interval** : affiché une fois **Generated Videos** activé. Combien de messages doivent passer entre deux clips. **0** l'arrête.
- **Video model** : le compte vidéo. **Default video provider** utilise ton compte par défaut.
- **First frame** : l'image de départ du clip (voir ci-dessous).

`/video` et le bouton **Video** de la Gallery fonctionnent dans les deux cas et ignorent l'intervalle. Balayer une réponse qui a envoyé un clip laisse le nouveau swipe envoyer le sien. Dans un chat de groupe, chaque personnage peut envoyer un clip par réponse, jusqu'à **Videos per reply** (3 par défaut) sous **Settings → Generations → Video Generation**.

Options de **First frame** :

- **New selfie, or the avatar if no selfie provider** (par défaut) : un nouveau selfie quand les selfies sont activés et que **Selfie model** est défini, sinon l'avatar.
- **New selfie, then animate it** : toujours un nouveau selfie, aussi enregistré dans la Gallery. Il a besoin des selfies activés et de **Selfie model**.
- **Avatar or sprite** : l'avatar, ou un sprite en pied s'il n'y a pas d'avatar.
- **Prompt only (no picture)** : certains workflows ComfyUI échouent sans image. Si **Send Avatar References** inclut les vidéos, cela lit **Prompt only** (avatar de Send Avatar References) et démarre depuis l'avatar.

Avec **Expose media prompts before sending** activé, tu relis le prompt du selfie avec le prompt du clip.

Les images dans d'autres formats, comme WebP, sont converties pour le service vidéo. Un message vidéo est une requête vidéo, plus une requête d'image quand il démarre d'un nouveau selfie. Ton **Prompt Model** écrit le prompt vidéo, et **Settings → Generations → Video Generation Prompt Overrides → Conversation Video Message** contient ses instructions.

## Référence : le tag selfie

Les personnages demandent un selfie avec un tag dans leur réponse. Tu ne le tapes jamais. Il ressemble à `[selfie]`, avec un contexte facultatif :

```text
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]` et `[selfie: standing beside the river]` fonctionnent aussi, quelle que soit la casse. Marinara retire le tag et publie l'image.

## Guides associés

- [Mode Conversation : premiers pas](getting-started.md)
- [Fournisseurs de génération d'images et configuration](../media/image-providers.md)
- [Profils de style d'image](../media/style-profiles.md)
