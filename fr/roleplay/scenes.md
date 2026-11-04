# Scènes : créer une branche d'un roleplay

Une scène est un roleplay court qui part d'un chat Conversation. Utilise-en une pour un flash-back, un rendez-vous ou un combat, sans perdre le fil principal.

Chaque scène est un chat Roleplay à part entière, avec son propre arrière-plan, ses propres personnages et son propre message d'accueil. Tant qu'elle est ouverte, le chat Conversation d'origine affiche une carte qui indique **A scene is in progress**, avec un bouton **Go to Scene** (aller à la scène).

Pendant qu'une scène se déroule, ses personnages ne répondent pas dans le chat Conversation, et un avis indique qu'ils sont dans une scène active. Pour qu'ils te répondent quand même à cet endroit, active **Allow replies here** (autoriser les réponses ici) sur la carte. Ce réglage est désactivé au départ. Une fois activé, les personnages de la scène répondent quand tu leur écris, mais n'envoient toujours pas de messages d'eux-mêmes.

## Lancer une scène

Avant de commencer : ouvre un chat Conversation qui contient déjà quelques messages. Voir [Mode Conversation : premiers pas](../conversation/getting-started.md).

1. Dans la zone de saisie, tape `/scene` et une courte description. `/rp` fait la même chose. Par exemple : `/scene we sneak into the old library at midnight`
2. Appuie sur <kbd>Enter</kbd>. La fenêtre **Scene Prompt Setup** (configuration du prompt de scène) s'ouvre.
3. Si tu vois **Scene persona** (persona de la scène), choisis le persona qui te représente. **Use the Conversation persona** (utiliser le persona de la Conversation) garde le persona de la Conversation.
4. Si tu vois **Scene characters** (personnages de la scène), laisse **Let the scene planner choose characters** (laisser le planificateur de scène choisir les personnages) activé pour que Marinara choisisse. Ou désactive-le et choisis au moins un personnage.
5. Choisis un **Prompt preset** (preset de prompt). Laisse-le sur **None** (aucun) pour utiliser le preset de ton [profil de réglages](../chats/settings-profiles.md#choosing-the-default-profile) Roleplay par défaut. Marinara mémorise ton choix pour la scène suivante.
6. Sous **POV** (point de vue), choisis **First Person**, **Second Person** ou **Third Person**.
7. Sous **Tense** (temps), choisis **Past**, **Present** ou **Future**.
8. Facultatif : tape des notes dans **Extra instructions** (instructions supplémentaires) pour orienter la scène.
9. Clique sur **Plan Scene** (planifier la scène).

La scène s'ouvre comme un nouveau chat Roleplay dans ta liste de chats, avec un message d'accueil qui plante la situation. Clique sur **Cancel** (annuler) dans la fenêtre de configuration pour arrêter sans créer de scène.

`/scene` seul fonctionne aussi quand la conversation a assez d'historique. Si la conversation n'a encore aucun message, Marinara te demande d'abord d'ajouter une description ou de discuter un peu.

Un personnage peut aussi demander à lancer une scène. Une invitation **Set up scene** (configurer la scène) apparaît à côté de sa réponse. Clique dessus pour ouvrir **Scene Prompt Setup**, puis continue à partir de l'étape 3. **Cancel** ferme la configuration, et l'invitation reste disponible, même après un rechargement.

Comment la scène s'ouvre :

- Elle part de ton profil de réglages Roleplay par défaut, comme tout nouveau chat Roleplay. Un [profil de réglages](../chats/settings-profiles.md) est un ensemble enregistré de réglages de chat.
- Quand le plan de la scène en prévoit une, une courte note sur la façon de jouer la scène est d'abord publiée comme message du narrateur, puis la description de la scène comme second message du narrateur. Un plan sans note saute cette étape.
- Avec un seul personnage, l'ouverture est écrite dans la voix de ce personnage, avec les paroles entre guillemets doubles, sauf si tes instructions d'écriture demandent un autre style.
- Dans une scène de groupe, l'ouverture suit le mode de groupe du profil. **Merged (Narrator)** (fusionné, avec narrateur) est le mode par défaut : une seule réponse fait parler tous les personnages. En mode **Individual** (individuel), le personnage qui ouvre la scène l'écrit. Voir [Chats de groupe](../chats/group-chats.md#choose-who-speaks).

## Utiliser la barre de scène

Dans une scène, une barre au-dessus de la zone de saisie décide de ce qu'il advient de la scène. Les boutons affichés dépendent de la présence ou non d'une conversation d'origine.

| Bouton | Ce qu'il fait |
| --- | --- |
| **Back to conversation** (retour à la conversation) | Revient au chat Conversation qui a lancé la scène. La scène reste ouverte. Affiché seulement quand il y a une conversation d'origine. |
| **End Scene** (terminer la scène) | Enregistre un résumé et termine la scène. Clique sur **Yes** (oui) quand **End and save summary?** s'affiche. |
| **Discard** (abandonner) | Supprime la scène sans rien enregistrer. Clique sur **Yes** quand **Discard scene?** s'affiche. |
| **Convert** (convertir) | Transforme la scène en Roleplay indépendant. Voir plus bas. |

**End Scene** affiche **Saving...**, écrit un court résumé dans la conversation sous forme de souvenir, puis t'y ramène. **Discard** ne garde rien. Les deux retirent la scène de ta conversation.

## Cloner une scène à partir d'un message

Pour copier une scène jusqu'à un message et la poursuivre séparément, pendant que l'original reste ouvert :

1. Survole le message à partir duquel tu veux créer une branche.
2. Clique sur son action **Clone from here** (cloner à partir d'ici).

Marinara crée un nouveau Roleplay indépendant avec les messages jusqu'à celui-ci inclus, affiche une confirmation et l'ouvre.

## Convertir une scène en Roleplay

Utilise **Convert** quand une scène est devenue une histoire que tu veux garder comme un Roleplay normal.

1. Clique sur **Convert** dans la barre de scène.
2. Lis **Convert this scene into a standalone roleplay?** Cela crée un nouveau chat Roleplay à partir de la scène et détache la scène d'origine de sa conversation. Aucun résumé de scène ni souvenir de personnage n'est écrit en retour.
3. Clique sur **Convert**, ou sur **Cancel** pour ne rien changer.

Le clonage garde la scène d'origine ouverte. La conversion, non.

## Scènes et chats connectés

Une scène est autonome. Elle ne reprend pas le contexte d'une Conversation connectée, même quand le chat parent le fait, et elle ignore les courtes consignes d'orientation qu'une conversation connectée peut envoyer à un Roleplay lié. Pour un lien permanent, dans les deux sens, entre une conversation et un roleplay, utilise un chat connecté. Voir [Connecter une Conversation à un Roleplay ou à une partie](../chats/connected-chats.md).

## Guides associés

- [Mode Roleplay : premiers pas](getting-started.md)
- [Branches de chat](../chats/branches.md)
- [Connecter une Conversation à un Roleplay ou à une partie](../chats/connected-chats.md)
