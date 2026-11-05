# Narrative Director et Secret Plot

Le Narrative Director est un agent (une aide qui tourne en parallèle des réponses) qui oriente l'intrigue d'un chat Roleplay. **Push Story** (faire avancer l'histoire) donne un coup de pouce à une seule réponse quand la scène semble bloquée. **Secret Plot** (intrigue secrète) garde un arc caché à long terme qui façonne de nombreuses réponses. Le Narrative Director ne fonctionne qu'en Roleplay. Pour le fonctionnement général des agents, voir la [vue d'ensemble des agents](../agents/agents-overview.md).

## Ajouter le Narrative Director à un chat

1. Ouvre **Chat Settings** (réglages du chat) avec le bouton de curseurs dans le chat, et va dans **Agents**.
2. Active **Enable Agents** (activer les agents), puis ajoute l'agent **Narrative Director**.

Un bouton **Push Story** apparaît alors au-dessus de ta zone de saisie, et une carte **Narrative Director** apparaît dans **Agents**. L'agent ne fait rien tant que tu n'utilises pas **Push Story** ou que tu n'actives pas **Secret Plot**.

## Faire avancer l'histoire

**Push Story** agit une seule fois. Il façonne uniquement la réponse suivante, puis se désactive tout seul. Ajoute d'abord le Narrative Director au chat (voir plus haut).

1. Clique sur **Push Story** au-dessus de ta zone de saisie. Un menu te demande comment faire avancer l'histoire :
   - **Naturally** (naturellement) : fait avancer l'intrigue existante. L'IA développe les fils déjà présents dans ton histoire.
   - **Randomly** (au hasard) : ajoute une surprise plausible à la scène.
2. Choisis l'une des deux options. Tu vois "The next time a character responds, they will push the story forward naturally!" (ou "randomly!"). Le bouton indique maintenant **Push Story: Naturally** ou **Push Story: Randomly**.
3. Envoie ton message suivant, ou génère une nouvelle réponse. L'IA écrit cette réponse unique en appliquant la poussée narrative.
4. Après la réponse, **Push Story** se désactive tout seul.

Tu choisis le mode dans ce menu à chaque fois. Il n'y a ni mode par défaut, ni réglage de mode dans **Chat Settings**.

Pour annuler avant d'envoyer, clique de nouveau sur le bouton armé. Tu vois "Push Story disarmed."

Si ça n'a pas marché : **Push Story** ne réagit pas pendant qu'une réponse est en cours de génération. Attends la fin de la réponse, puis clique dessus.

## Activer Secret Plot

**Secret Plot** est un arc caché à long terme. L'IA garde un plan secret sur la direction que prend l'histoire. Ce plan est ajouté au prompt, le texte que Marinara envoie à l'IA, mais il te reste caché tant que tu ne le dévoiles pas. Il est désactivé par défaut. Contrairement à **Push Story**, il agit sur de nombreuses réponses et met à jour son plan à intervalle régulier.

1. Ouvre **Chat Settings → Agents** et trouve la carte **Narrative Director**.
2. Active l'interrupteur **Secret Plot**. Son libellé indique "Maintain a hidden long-term arc for this roleplay."
3. Règle le champ **Run Interval** (intervalle d'exécution) si tu le souhaites. C'est le nombre de messages (les tiens et ceux de l'IA) qui s'écoulent entre deux mises à jour de l'arc. La valeur par défaut est 8. Tu peux utiliser n'importe quel nombre entier de 1 à 100. Plus le nombre est bas, plus le plan se met à jour souvent.

## Dévoiler et modifier l'arc caché

Le panneau **Secret plot** se trouve sous **Run Interval**.

1. Clique sur **Reveal spoilers** (dévoiler les spoilers). Le bouton indique **Reveal empty arc** si l'IA n'a pas encore écrit d'arc. Tant que l'arc est caché, le panneau affiche "Spoilers hidden". Clique sur **Hide spoilers** (masquer les spoilers) pour le cacher de nouveau.
2. Modifie les champs que tu veux :
   - **Arc description** (description de l'arc) : la trame cachée dans son ensemble.
   - **Protagonist arc** (arc du protagoniste) : la direction que prend ton personnage.
   - **Character arc** (arc du personnage) : la direction que prend un personnage choisi.
   - **Completed** (terminé) : coche cette case quand l'arc est terminé.
3. Utilise le bouton d'enregistrement pour conserver tes changements.

Pour jeter l'arc et demander à l'IA d'en écrire un nouveau, clique sur **Regenerate** (régénérer). Une boîte de dialogue intitulée "Regenerate Secret Plot" te demande de confirmer. Choisis **Regenerate** pour remplacer l'arc, ou **Keep Current Arc** (garder l'arc actuel) pour annuler.

L'arc est enregistré avec l'agent **Narrative Director**. Effacer les résultats des agents du chat ne le supprime pas. Il n'est supprimé que si tu retires l'agent du chat, et un avertissement te prévient d'abord.

## Modifier le prompt Secret Plot

Le **Secret Plot Prompt** (prompt de l'intrigue secrète) contient les instructions que le Narrative Director suit quand il écrit et met à jour l'arc. Le prompt intégré traite chaque arc comme un mystère à découvrir. Cela convient à l'aventure et à l'intrigue, mais peut ne pas convenir à une histoire portée par ses personnages.

1. Ouvre **Agents** et modifie le **Narrative Director**.
2. Dans la section **Secret Plot**, clique sur **Copy default to edit** (copier la valeur par défaut pour la modifier).
3. Modifie le texte, puis enregistre l'agent.

Clique sur **Reset to default** (rétablir la valeur par défaut) pour revenir au prompt intégré, puis enregistre l'agent.

> **Remarque :** ne supprime pas la dernière partie du prompt. Elle décrit le format de la réponse, et sans elle Marinara ne peut pas lire l'arc.

Le prompt est enregistré sur l'agent : il s'applique donc à tous les chats qui utilisent ce Narrative Director.

## Guides associés

- [Référence des agents téléchargeables](../agents/built-in-agents.md)
- [Mode Roleplay : premiers pas](getting-started.md)
- [Génération guidée et Impersonate](../chats/guided-and-impersonate.md)
