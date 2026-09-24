# Storyboard LTX image-to-video

Statut : suite de la simplification, en cours de relecture locale.

## Problème

La première intégration du LTX Director Storyboard dans Marinara découpait chaque plan prévu en un prompt global stable (le prompt, c'est le texte que Marinara envoie à l'IA) et en plusieurs prompts locaux séparés par des barres verticales. La route Storyboard reconnaissait ensuite les identifiants des modèles intégrés et contournait le contrat habituel des prompts vidéo pour construire une charge utile propre à LTX.

Ce fonctionnement rendait la personnalisation des prompts déroutante : copier ou modifier un modèle intégré changeait son identifiant et désactivait silencieusement ce passage de relais spécial. Il poussait aussi le planificateur à répartir trop d'actions sur un clip court. En cas d'échec de la planification, le storyboard de repli générique pouvait transmettre un large extrait de narration brute à la génération de vidéos, d'où les prompts surchargés visibles dans les logs (les logs, c'est le journal du serveur) d'exécution.

Le workflow ComfyUI local qui fonctionne n'a pas besoin de cette couche de prompts temporels. LTX 2.3 sait animer la première image fournie à partir d'un seul prompt image-to-video direct.

## Décision produit

Les identifiants de modèles à activer soi-même et les réglages associés restent en place pour rester compatibles avec les chats enregistrés, mais leur contrat est simplifié :

- **LTX Director Storyboard** (storyboard réalisé par LTX) planifie la première image et un prompt image-to-video LTX 2.3 complet par plan.
- **Storyboard First Frame** (première image du storyboard) met en forme l'illustration exacte à T=0 qui sert d'image de référence.
- **Narration Passthrough** (vidéo réalisée par LTX) se limite à `${narrationSummary}` et fait donc passer le prompt complété par le planificateur par le même modèle vidéo universel que tous les autres workflows.

La route Storyboard ne doit ni inspecter ces identifiants de modèles, ni fabriquer des segments locaux, ni joindre une charge utile de prompt propre à LTX. Le modèle vidéo choisi reste entièrement personnalisable.

## Contrat du planificateur

La forme JSON existante du Storyboard ne change pas :

- `imagePrompt` décrit uniquement la première image exacte à T=0.
- `narrationBeat` est le prompt complet envoyé au modèle vidéo avec cette image.
- les ancres de section et `characters` conservent leur sens actuel.

Pour chaque `narrationBeat`, suis le [guide officiel image-to-video de LTX](https://docs.ltx.io/open-source-model/usage-guides/image-to-video) et le [guide de rédaction des prompts](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide) :

- écris un seul paragraphe fluide au présent, avec environ 2 à 4 phrases courtes pour 1 à 6 secondes, 3 à 5 pour 7 à 10 secondes, et 4 à 8 pour 11 à 15 secondes, uniquement si l'action justifie ce niveau de détail ;
- pars de l'état montré dans `imagePrompt` et décris ce qui se passe ensuite ;
- utilise une action principale et un placement de caméra pour 1 à 6 secondes, jusqu'à deux phases et placements enchaînés pour 7 à 10 secondes, et jusqu'à trois pour 11 à 15 secondes ;
- décris chaque mouvement de caméra par rapport au sujet, et ne change d'angle que si la durée permet de montrer clairement la transition ;
- exprime les réactions par le visage, le regard, la posture, la respiration ou les gestes visibles ;
- ajoute un mouvement discret de l'environnement, ainsi que le son pertinent ou un bref dialogue entre guillemets ;
- termine sur une action qui s'achève, se stabilise ou se maintient ;
- appuie-toi sur l'image source pour l'apparence statique, la composition, le décor, la lumière, la palette, la texture et le style ;
- évite les changements de scène, les nouveaux sujets, les actions surchargées, la physique complexe, le texte lisible, les éléments d'interface, les événements inventés, ainsi que toute coupe ou tout changement de caméra qui ne tient pas clairement dans la durée.

Commence simple. Quatre phrases suffisent dès lors qu'elles dirigent entièrement le plan ; le planificateur ne doit pas rallonger une action simple juste pour ajouter du mouvement.

Exemple :

```text
She opens the door and walks outside as the camera follows behind her. A light breeze moves her hair. She glances toward the street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## Flux de données

1. Le planificateur renvoie un `imagePrompt` à T=0 et un `narrationBeat` complet pour chaque plan.
2. La génération d'images du Storyboard crée l'illustration de référence qui sert de première image.
3. Le modèle **Narration Passthrough** résout `${narrationSummary}` avec le `narrationBeat` du plan concerné.
4. La requête de génération de vidéos habituelle transporte le résultat dans son champ `prompt` existant.
5. L'adaptateur ComfyUI remplace `%prompt%` dans le workflow enregistré et fournit l'image de référence, les dimensions, la durée, le nombre d'images, la graine et le modèle déjà en place.

Ce flux ne comporte aucune branche de route Storyboard réservée à LTX.

## Contrat ComfyUI

Utilise le workflow image-to-video LTX 2.3 connu pour fonctionner, avec les emplacements réservés habituels de Marinara. Ses entrées Director doivent être les suivantes :

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

Laisse `%reference_image_name%`, `%duration_seconds%`, `%length%`, `%width%`, `%height%`, `%seed%` et `%model%` là où le workflow les attend déjà. Une requête de six secondes reste à 96 images, conformément au contrat de 16 FPS existant de Marinara.

Les anciens workflows enregistrés qui utilisent `%global_prompt%`, `%local_prompts%` et `%segment_lengths%` restent compatibles : l'adaptateur associe un prompt de requête ordinaire à la valeur globale et laisse vides les prompts locaux et les longueurs de segments. Ces emplacements réservés relèvent de la compatibilité, pas de la configuration Storyboard recommandée.

## Comportement en cas d'échec

- Si le client se déconnecte ou si le planificateur s'interrompt, propage l'annulation. Ne poursuis pas la génération de médias de repli.
- Si le planificateur échoue vraiment, le planificateur de repli existant peut conserver le comportement image fixe, mais la génération de vidéos est ignorée pour cette requête. La narration brute n'est pas un prompt image-to-video sûr.
- Un storyboard fourni par le client et déjà relu reste éligible à la génération de vidéos, puisque son prompt a été relu en amont.

## Périmètre

Ce changement n'ajoute pas de seconde passe d'un modèle de vision sur l'image de référence générée. Le planificateur dirige déjà la première image et le mouvement qui la suit immédiatement, tandis que l'image elle-même conditionne LTX au moment de la génération. Une réécriture tenant compte de l'image pourra être évaluée à part si la dérive de la première image s'avère importante.

Aucun travail n'est nécessaire côté interface client, localisation, schéma de stockage, migration, version, redémarrage de service ou Marinara-Agents.

## Critères d'acceptation

- Le planificateur LTX Storyboard demande un prompt image-to-video complet, adapté à la durée, avec des phases d'action lisibles, une direction de caméra relative et, en option, du son ou du dialogue.
- Le modèle **Narration Passthrough** vaut exactement `${narrationSummary}`.
- La route Storyboard n'a plus ni contournement par identifiant de modèle exact, ni nettoyeur de prompts locaux, ni passage de relais propre à LTX.
- Un workflow avec `global_prompt: "%prompt%"` reçoit le prompt complet du planificateur ; `local_prompts` et `segment_lengths` restent vides.
- Les workflows `%global_prompt%` existants reçoivent toujours le prompt de requête normal, par compatibilité.
- L'annulation du planificateur arrête l'opération, et une planification de repli réelle ignore la génération de vidéos.
- `pnpm regression:prompt`, `pnpm check` et `git diff --check` couvrent le correctif final.
