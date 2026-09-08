# Agent Illustrator

Ce guide explique le fonctionnement de l'agent **Illustrator** (illustrateur), intégré à Marinara, qui dessine des images de tes scènes pendant que tu discutes. Au programme : son rôle, la façon de l'activer, les styles graphiques qu'il propose et les deux connexions dont il a besoin.

## Le rôle de l'agent Illustrator

Un agent est un petit programme d'IA qui tourne automatiquement dans un chat. L'agent **Illustrator** travaille en post-traitement : il se déclenche une fois que l'IA a terminé sa réponse. Il lit la dernière réponse et juge si le moment mérite une image. Si c'est le cas, il rédige un prompt d'image et l'envoie au fournisseur d'images. Un prompt, c'est le texte qui décrit au modèle d'images ce qu'il doit dessiner.

L'agent Illustrator ne dessine pas à chaque message. Par défaut, après avoir produit une image, il attend 5 messages acceptés, de toi comme de l'assistant, avant d'en produire une autre. Faire un swipe (réponse alternative) ou régénérer la même réponse ne fait pas avancer ce compteur. Si un moment ne lui semble pas digne d'une illustration, il le laisse passer sans rien créer. Toutes les images produites arrivent dans la section **Gallery** (galerie) du chat.

L'agent Illustrator s'utilise dans les chats **Roleplay** et **Game Mode**, et son installation débloque aussi les selfies en mode **Conversation**. Sa description courte dans l'application indique : "Responsible for image and video generations." Les étapes de configuration et les réglages décrits ici valent pour les chats Roleplay. Game Mode se contente d'un seul interrupteur, présenté plus bas dans la section consacrée à ce mode.

## Avant de commencer

L'agent Illustrator rédige le prompt d'image, mais il lui faut une connexion d'images distincte pour dessiner réellement l'illustration. Une connexion d'images est un lien enregistré vers un fournisseur d'images, par exemple OpenAI ou un serveur Stable Diffusion local.

Commence donc par créer une connexion d'images. Deux méthodes pour la fournir à l'agent Illustrator :

1. Désigne une connexion d'images comme connexion par défaut. Ouvre le panneau **Connections** (connexions), déplie la section **Defaults** (valeurs par défaut) et fais ton choix sous **Images**.
2. Autre option : donne à l'agent Illustrator sa propre connexion d'images depuis son écran de configuration complet (voir le bouton **Open Setup** plus bas).

Sans connexion d'images utilisable, l'image échoue et l'application te demande d'en choisir une. Consulte [Fournisseurs de génération d'images et configuration](image-providers.md) pour ajouter un fournisseur.

## Activer l'agent Illustrator

L'agent Illustrator est désactivé par défaut. Dans un chat **Roleplay**, ajoute-le ainsi :

1. Ouvre le chat que tu veux illustrer.
2. Ouvre la section **Chat Settings** (réglages du chat) via l'icône d'engrenage.
3. Va dans la section **Agents** et active l'interrupteur **Enable Agents** (activer les agents).
4. Dans le groupe **Misc Agents**, repère **Illustrator** et ajoute-le avec le bouton Plus.

Une carte de réglages **Illustrator** apparaît alors, avec ses propres options. Un agent supplémentaire consomme des tokens en plus (un token est un petit morceau de texte) et déclenche des appels à l'IA à chaque tour : le panneau affiche donc une estimation du coût en continu.

### Game Mode : l'interrupteur Game Illustrator

Game Mode ne suit pas les étapes ci-dessus et n'affiche ni l'option **Prompt Mode** ni l'option **Prompt Model**. À la place, ouvre la section **Chat Settings** de la partie et active l'unique interrupteur **Game Illustrator**. Sa description indique : "Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay."

## Les modes de prompt

Le sélecteur **Prompt Mode** (mode de prompt) définit le style graphique que l'agent Illustrator applique à tous les prompts qu'il rédige. Sur la carte de l'agent, ce sélecteur porte le nom **Prompt**. Une courte ligne en dessous précise : "Prompt mode controls how Illustrator writes image prompts for this chat."

Le sélecteur propose ces styles :

- **Illustration** : une image de scène unique et soignée. C'est le style généraliste.
- **Comic Page** : une page de bande dessinée avec cases, bulles de dialogue, cartouches et onomatopées.
- **Colored Manga** : une scène de manga en couleur, avec bulles stylisées et onomatopées.
- **B&W Manga** : une page de manga en noir et blanc, au trait encré et aux ombres en trames.
- **Background** : un lieu ou un plan d'ambiance, sans personnage.
- **Selfie** : un selfie dans la peau du personnage, ou un portrait pris sur le vif.

Un nouvel agent Illustrator démarre sur le style **Background**. Change de style quand tu veux depuis le sélecteur. L'allure générale de l'image finale dépend aussi du profil de style. Consulte [Profils de style d'image](style-profiles.md) pour le régler.

## Prompt Model et la connexion d'images

L'agent Illustrator s'appuie sur deux connexions différentes, et mieux vaut ne pas les confondre.

Le **Prompt Model** (modèle de rédaction du prompt) est le modèle de texte qui écrit le prompt d'image. Ce n'est pas le modèle qui dessine l'image. Choisis-le dans le menu déroulant **Prompt Model** de la carte Illustrator. La valeur par défaut est **Main chat model**, qui réutilise la connexion déjà employée par le chat. Sélectionne une autre connexion de texte si tu préfères qu'un autre modèle rédige les prompts.

La connexion d'images, elle, correspond au fournisseur d'images qui dessine l'image finale. Tu la définis comme expliqué dans la section **Avant de commencer**, soit sous **Defaults → Images**, soit depuis l'écran de configuration propre à l'agent.

## Attach Card Appearance et Send Avatar References

Deux interrupteurs de la carte Illustrator aident les personnages à rester cohérents d'une image à l'autre. Les deux sont désactivés par défaut.

**Attach Card Appearance** (joindre l'apparence de la fiche) ajoute au prompt d'image le texte d'apparence enregistré de chaque personnage visible. Son texte d'aide indique : "Append matched character appearance lines to image prompts, using only visible/generated names." Active-le quand tu veux que l'image colle à la description écrite du personnage.

**Send Avatar References** (envoyer les avatars en référence) transmet au fournisseur d'images les avatars des personnages et des personas, ou leurs sprites, comme images de référence. Son texte d'aide indique : "Send matching character and persona avatars or sprites as reference images when the provider supports them." Le modèle d'images peut ainsi reprendre un visage ou une tenue. Tous les fournisseurs n'acceptent pas les images de référence : le résultat dépend donc de celui que tu as choisi.

## Autres réglages et déclenchement manuel

La carte Illustrator comporte un bouton **Open Setup** (ouvrir la configuration). Il ouvre l'écran de configuration complet de l'agent, où tu règles sa fréquence de déclenchement et lui attribues sa propre connexion d'images.

Règle **Run Interval** (intervalle d'exécution) sur **0** pour générer uniquement à la demande. Cela arrête les exécutions automatiques d'Illustrator, y compris ses arrière-plans de scène automatiques, tout en gardant l'agent installé et disponible pour les actions de Gallery. La valeur par défaut reste **5** ; choisis un intervalle positif pour reprendre les exécutions automatiques. Tu peux aussi choisir 0 lorsque tu ajoutes Illustrator à un chat.

Il est aussi possible de créer une image à la demande, sans attendre. Ouvre la section **Gallery** du chat et utilise le bouton **Illustrate** (illustrer). L'agent Illustrator se lance immédiatement pour une passe, et le bouton affiche **Generating...** pendant le travail. Pratique quand tu veux une image du moment présent et que l'agent n'en a pas encore dessiné.

## Guides associés

- [Fournisseurs de génération d'images et configuration](image-providers.md)
- [Profils de style d'image](style-profiles.md)
- [Arrière-plans de scène et galerie](scene-backgrounds.md)
- [Agents : des aides IA pour tes chats](../agents/agents-overview.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
