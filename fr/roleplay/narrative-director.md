# Narrative Director et intrigue secrète

Ce guide explique l'agent Narrative Director dans Marinara Engine. Il présente le bouton **Push Story** (faire avancer l'histoire), les modes **Natural** et **Random Event**, ainsi que l'arc caché **Secret Plot** (intrigue secrète). Ces fonctionnalités servent en mode Roleplay.

## Ce qu'est le Narrative Director

Un agent est une IA qui travaille en coulisses pendant ton chat pour accomplir une tâche de fond. Le Narrative Director en fait partie. Il rédige une consigne ponctuelle pour la prochaine réponse, afin que l'histoire prenne la direction que tu souhaites. Pour comprendre le fonctionnement général des agents, va voir la [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

Le Narrative Director ne fonctionne qu'en mode Roleplay. Il n'agit jamais de lui-même. Il n'intervient que si tu l'armes (tu l'actives pour une seule réponse) avec le bouton **Push Story**, ou si tu actives la fonctionnalité **Secret Plot**.

Pour t'en servir, commence par ajouter l'agent à ton chat. Ouvre la section **Chat Settings** (réglages du chat), va dans la section **Agents**, puis active l'agent **Narrative Director**. Une fois qu'il est actif, un bouton **Push Story** apparaît au-dessus de la zone de saisie, et une carte de réglages **Narrative Director** s'ajoute dans la section **Agents**.

## Push Story

**Push Story** est un bouton à usage unique. Il façonne uniquement la réponse suivante, puis se désactive tout seul. Utilise-le quand la scène tourne en rond et que tu veux que l'IA fasse avancer les choses.

Voici la marche à suivre :

1. Ouvre un chat en mode Roleplay où l'agent **Narrative Director** est actif.
2. Repère le bouton **Push Story** au-dessus de la zone de saisie.
3. Clique sur **Push Story**. En mode **Natural**, le message "The next time a character responds, they will push the story forward naturally!" s'affiche. En mode **Random Event**, le message se termine par "randomly!" à la place.
4. Envoie ton message suivant, ou génère une nouvelle réponse.
5. L'IA rédige cette réponse unique en appliquant la poussée narrative.
6. Après la réponse, le bouton **Push Story** se désactive tout seul.

Si tu changes d'avis avant d'envoyer, clique de nouveau sur **Push Story** pour le désactiver. Le message "Push Story disarmed." s'affiche alors.

Le bouton **Push Story** reste indisponible tant qu'une réponse est en cours de génération. Attends la fin de la réponse en cours, puis arme-le.

## Les modes Natural et Random Event

**Push Story** a deux modes. Tu choisis le mode dans la carte **Narrative Director**, à l'intérieur de la section **Chat Settings**. Le mode retenu détermine le type de poussée narrative que tu obtiens.

Voici les deux modes :

- **Natural** : fait avancer l'intrigue existante. L'IA développe les fils déjà présents dans ton histoire.
- **Random Event** : ajoute une surprise plausible. L'IA introduit un rebondissement inédit, mais cohérent avec la scène.

**Natural** est le mode par défaut. Pour en changer, ouvre la section **Chat Settings**, va dans **Agents**, repère la carte **Narrative Director**, puis clique sur le mode voulu.

L'infobulle du bouton **Push Story** indique quel mode est armé. En mode **Natural**, elle affiche "Arm a natural Narrative Director push for the next response." En mode **Random Event**, elle affiche "Arm a random Narrative Director event for the next response."

## Secret Plot

**Secret Plot** est un arc narratif caché, prévu sur la durée de ton roleplay. L'IA garde un plan secret sur la direction que prend l'histoire. Ce plan est ajouté au prompt, le texte que Marinara envoie à l'IA, mais il te reste caché tant que tu ne décides pas de le dévoiler. Il est désactivé par défaut.

Contrairement à **Push Story**, qui agit une seule fois, **Secret Plot** s'étend sur de nombreuses réponses. Il met à jour son plan caché à intervalle régulier, au fil du chat.

### Activer Secret Plot

1. Ouvre la section **Chat Settings** et va dans la section **Agents**.
2. Repère la carte **Narrative Director**.
3. Active l'interrupteur **Secret Plot**. Son libellé indique "Maintain a hidden long-term arc for this roleplay."

### Run Interval

Quand **Secret Plot** est activé, un champ **Run Interval** (intervalle d'exécution) apparaît. Il détermine le nombre de messages, les tiens comme ceux de l'assistant, qui s'écoulent entre deux mises à jour de l'arc caché.

La valeur par défaut est 8. Tu peux saisir n'importe quel nombre entier de 1 à 100. Plus le nombre est bas, plus le plan se met à jour souvent. Plus il est élevé, moins les mises à jour sont fréquentes.

### Dévoiler et modifier l'arc caché

Sous le champ **Run Interval** se trouve le panneau **Secret plot**. Il te sert à consulter et à modifier le plan caché.

Clique sur le bouton de révélation pour afficher l'arc. Il indique **Reveal spoilers** (dévoiler les spoilers) dès qu'un arc existe, ou **Reveal empty arc** si l'IA n'en a pas encore écrit. Clique sur **Hide spoilers** pour le masquer de nouveau. Tant que l'arc est caché, le panneau affiche "Spoilers hidden".

Une fois l'arc dévoilé, tu peux modifier les champs suivants :

- **Arc description** : la trame cachée dans son ensemble.
- **Protagonist arc** : la direction que prend ton personnage.
- **Character arc** : la direction que prend un personnage sélectionné du roleplay.
- **Completed** : une case à cocher que tu coches quand l'arc est terminé.

Après avoir modifié un champ, utilise le bouton d'enregistrement pour conserver tes changements.

Pour jeter l'arc actuel et demander à l'IA d'en écrire un nouveau, clique sur **Regenerate** (régénérer). Une boîte de dialogue intitulée "Regenerate Secret Plot" te demande de confirmer. Choisis **Regenerate** pour le remplacer, ou **Keep Current Arc** pour annuler.

### L'arc reste attaché à l'agent

L'arc caché est enregistré avec l'agent **Narrative Director**. Vider les exécutions d'agents et la mémoire de ton chat ne l'efface pas. L'arc n'est supprimé que si tu retires l'agent **Narrative Director** du chat. Si tu retires l'agent, un avertissement te prévient que l'arc caché sera effacé, sans retour en arrière possible.

<a id="secret-plot-prompt"></a>

### Le prompt Secret Plot

Le **Secret Plot Prompt** (prompt de l'intrigue secrète) contient les instructions que le Narrative Director suit quand il écrit et met à jour l'arc caché. Le prompt intégré présente chaque arc comme un mystère à découvrir. Cela convient à l'aventure et à l'intrigue, mais peut ne pas convenir à une histoire portée par les personnages.

Pour utiliser tes propres instructions, procède ainsi :

1. Ouvre **Agents** et modifie le **Narrative Director**.
2. Dans la section **Secret Plot**, clique sur **Copy default to edit** (copier la valeur par défaut pour la modifier).
3. Modifie le texte, puis enregistre l'agent.

Clique sur **Reset to default** (rétablir la valeur par défaut) pour revenir au prompt intégré, puis enregistre l'agent.

Garde le format de réponse JSON à la fin du prompt : un objet `overarchingArc` avec `description`, `protagonistArc`, un `characterArc` facultatif et `completed`. Sans lui, l'arc ne peut pas être lu.

Ce prompt est enregistré sur l'agent : il s'applique donc à tous les chats qui utilisent ce Narrative Director.

## Guides associés

- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Mode Roleplay : premiers pas](getting-started.md)
- [Génération guidée et Impersonate](../chats/guided-and-impersonate.md)
