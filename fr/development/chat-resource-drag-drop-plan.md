# Plan de glisser-déposer des ressources vers le chat

## Statut

Les phases 1 à 4 ont été implémentées sur la branche `drag-me-baby-one-more-time` et sont fusionnées dans `staging`. Des travaux ultérieurs (#7362) permettent de faire glisser les lignes de bibliothèque sans poignée, laissent un utilisateur tactile rassembler une pile de ressources compatibles en touchant d'autres lignes avec un deuxième doigt, et affichent des espaces d'insertion pour réordonner.

La couverture automatisée du résolveur est en place. Une couverture Playwright a été ajoutée sur poste de travail, pour l'affectation de personnages et le remplacement de persona. En local, elle ne passe pas dans le conteneur de développement actuel : Chromium n'arrive pas à charger la bibliothèque `libnspr4.so`. Ces cas navigateur doivent donc tourner en CI, ou dans un environnement doté des dépendances système de Playwright.

Avant d'entamer les phases restantes, applique les règles de coordination du dépôt :

1. Vérifie s'il existe déjà une issue, une branche liée à une issue, une PR en brouillon ou un élément de projet qui couvre le glisser-déposer de ressources vers le chat.
2. Rends la propriété du travail visible sur l'issue.
3. Ouvre une PR en brouillon vers `staging` dès le début de l'implémentation.

## Objectif

Permettre de glisser les ressources prises en charge depuis le panneau de droite jusque dans le chat actif, sans passer par les réglages du chat.

La fenêtre centrale offre deux destinations possibles :

- **Surface du chat :** modifier la configuration persistante du chat actif.
- **Zone de saisie :** ajouter une pièce jointe prise en charge au brouillon en cours.

Ces cibles ne sont pas universelles. Une destination n'apparaît que si l'élément glissé y correspond à une opération réelle, déjà prise en charge.

## Règle produit

Le glisser-déposer choisit la ressource et la destination. L'application n'effectue que les opérations déjà prévues par le modèle de données du chat et par la chaîne de génération.

- Une seule opération additive valide : appliquer tout de suite, et proposer Undo.
- Une seule opération de remplacement valide : demander confirmation si elle écrase une valeur existante.
- Plusieurs opérations réellement prises en charge : afficher un petit sélecteur qui ne contient que ces opérations.
- Aucune opération valide : ne pas activer de cible.
- Ressource déjà appliquée : refuser un dépôt en double.
- Ni contexte spéculatif d'un seul tour, ni insertion cachée dans le prompt, ni mentions synthétiques, ni pastilles décoratives.

## Contrats actuels

Les contrats `Chat` et `ChatMetadata` existants prennent en charge les opérations persistantes suivantes :

- Personnages : mettre à jour `Chat.characterIds`.
- Persona : mettre à jour `Chat.personaId`.
- Preset de prompt : mettre à jour `Chat.promptPresetId`.
- Connexion : mettre à jour `Chat.connectionId`.
- Lorebooks : mettre à jour `ChatMetadata.activeLorebookIds`.
- Agents : mettre à jour `ChatMetadata.activeAgentIds` et, en cas d'acceptation, `ChatMetadata.enableAgents`.
- Arrière-plan du chat : mettre à jour les métadonnées d'arrière-plan du chat par le même chemin d'affectation que celui de `BackgroundPicker`.

Les zones de saisie existantes acceptent les pièces jointes. Elles ne gèrent pas encore les références à un personnage, un lorebook, un agent, un persona, un preset ou une connexion à l'échelle d'un seul message.

## Matrice des actions prises en charge

Le résolveur de capacités doit aussi appliquer les restrictions de mode en vigueur et tenir compte des ressources disponibles. Le tableau décrit l'opération quand l'interface existante l'autorise déjà dans le mode actif.

| Ressource | Surface du chat | Zone de saisie | Comportement au dépôt |
| --- | --- | --- | --- |
| Personnage | Ajouter l'ID à `characterIds` | Aucune | Ajout immédiat ; notification toast avec Undo |
| Lorebook | Ajouter l'ID à `activeLorebookIds` | Aucune | Ajout immédiat ; notification toast avec Undo |
| Agent | Ajouter l'ID à `activeAgentIds` | Aucune | Ajout immédiat si les agents sont activés ; sinon, demander confirmation pour les activer et l'ajouter |
| Persona | Définir `personaId` | Aucune | Définition immédiate si le champ est vide ; confirmation en cas de remplacement d'un autre persona |
| Preset de prompt | Définir `promptPresetId` | Aucune | Respecter les restrictions de mode ; définition immédiate si le champ est vide ; confirmation en cas de remplacement d'un autre preset |
| Connexion | Définir `connectionId` | Aucune | Confirmation en cas de changement de la connexion en cours ; indiquer l'ancien et le nouveau nom |
| Arrière-plan du chat | Définir les métadonnées d'arrière-plan existantes | Aucune | Reprendre la logique d'affectation actuelle ; ne confirmer un remplacement que si le flux existant l'exige |
| Image ou fichier pris en charge | Aucune | Ajouter aux pièces jointes du brouillon | Réutiliser la validation et la préparation des pièces jointes existantes |
| Dossier de personnages, de lorebooks ou d'agents | Aucune | Aucune | Pas de cible |
| Contrôle de réglages | Aucune | Aucune | Pas de cible |
| Script regex | Aucune | Aucune | Pas de cible tant qu'il n'existe pas de contrat d'affectation à l'échelle du chat |
| Fonction ou outil personnalisé | Aucune | Aucune | Pas de cible tant qu'il n'existe pas de contrat d'affectation à l'échelle du chat |
| Contribution d'extension | Aucune par défaut | Aucune par défaut | Uniquement sur activation volontaire, via une future API typée de contributions |

### Règles de mode

Ne réécris pas la politique des modes dans les gestionnaires de glisser-déposer. Le résolveur de capacités de dépôt doit utiliser les mêmes prédicats que l'interface de configuration et de réglages du chat.

Au minimum :

- Les presets de prompt restent indisponibles en mode Conversation, comme dans `PresetsPanel`.
- Le dépôt d'un agent exige que celui-ci soit installé, disponible et valide pour le mode actif.
- Les opérations sur les personnages, le persona, les lorebooks, la connexion et l'arrière-plan ne sont proposées que là où leur contrôle d'affectation existe déjà.
- Un chat sans identifiant actif n'expose aucune cible de dépôt de ressource.
- Le streaming ou le traitement d'un agent ne doivent pas bloquer une mise à jour de métadonnées sans risque, sauf si un chemin de mutation existant le fait déjà. Les confirmations de remplacement doivent relire l'état courant du chat avant d'appliquer quoi que ce soit.

## Conception de l'interaction

### Début du glisser

Chaque ligne de panneau prise en charge écrit une seule charge utile de ressource, versionnée :

```ts
type ChatResourceDragPayload = {
  version: 1;
  kind: "character" | "lorebook" | "agent" | "persona" | "preset" | "connection" | "background";
  ids: string[];
  label: string;
};
```

Utilise un seul type MIME personnalisé, par exemple `application/x-marinara-chat-resource`. Conserve les charges utiles MIME des dossiers pendant la migration : réorganiser des dossiers reste une interprétation valide et distincte du même glisser.

Les effets de glisser d'une ressource doivent annoncer `copyMove` :

- Les cibles de dossier interprètent le glisser comme un déplacement.
- Les cibles de chat l'interprètent comme une copie, c'est-à-dire une affectation.

Ne te fie pas au type `text/plain` pour les opérations internes sur les ressources. Il est ambigu et contient aujourd'hui de simples ID.

### Visibilité des cibles

Au repos, les zones de dépôt restent invisibles.

Quand un glisser de ressource reconnu entre dans la fenêtre centrale :

1. Analyser et valider la charge utile typée.
2. Déterminer les actions valides pour le chat actif le plus à jour.
3. N'afficher que les destinations valides.
4. Employer un texte propre à l'action, du type `Add Maris to this chat`, plutôt qu'un `Drop here` générique.
5. Laisser les zones non valides inchangées et non réceptives.

Pour le glisser d'un fichier pris en charge, seule la zone de saisie s'illumine. Pour un personnage, un lorebook, un agent, un persona, un preset, une connexion ou un arrière-plan, seule la surface du chat s'illumine dans la première version.

### Dépôt sur la surface du chat

La zone de dépôt active correspond à la surface de conversation en cours, quelle que soit la position du défilement dans le fil des messages. Déposer au-dessus d'un ancien message n'insère rien dans l'historique et ne modifie pas le contexte a posteriori.

Au dépôt :

1. Relire l'identifiant du chat actif et ses données à jour.
2. Recalculer la capacité, pour écarter les actions périmées ou en double.
3. Appliquer tout de suite quand l'opération est additive et sans ambiguïté.
4. Ouvrir une confirmation ciblée pour un remplacement ou pour l'activation des agents.
5. Signaler la réussite par une notification toast traduite, assortie d'une action Undo.
6. Signaler l'échec de la mutation sans toucher au fil des messages.

Ne crée aucun message, qu'il soit utilisateur, assistant, narrateur ou système, pour consigner un changement de configuration. Le modèle de message n'a pas de type dédié aux événements d'activité, et ces événements ne doivent jamais entrer dans l'historique visible par le modèle.

### Dépôt dans la zone de saisie

Conserve le comportement actuel des fichiers dans `ChatInput` comme dans `ConversationInput` :

- Valider les types pris en charge et la limite de taille de 20 Mo.
- Préparer les images avec `prepareImageAttachment`.
- Lire les fichiers texte et PDF pris en charge par le chemin de pièce jointe actuel.
- Conserver le comportement de brouillon des pièces jointes en attente, propre à chaque chat.

Resserre la détection du glisser dans la zone de saisie, pour qu'un glisser interne de ressource n'allume plus le repère de dépôt de fichier sans rien faire ensuite.

### Confirmation

Ne demande confirmation que si l'opération a une conséquence réelle :

- Remplacer le persona actif.
- Remplacer le preset de prompt actif.
- Changer la connexion active.
- Activer les agents pour pouvoir en ajouter un.
- Tout chemin d'affectation d'arrière-plan qui demande déjà un choix ou une confirmation de remplacement.

Les confirmations doivent nommer la valeur actuelle et la valeur proposée, quand cela s'applique. Elles ne doivent pas contenir d'actions étrangères, comme démarrer un nouveau chat, invoquer un agent une fois ou citer la ressource dans un message.

### Undo

Undo restaure exactement la valeur d'avant le dépôt, pas une reconstitution approximative.

- Personnage : restaurer le tableau `characterIds` complet précédent.
- Lorebook : restaurer le tableau `activeLorebookIds` complet précédent.
- Agent : restaurer à la fois `activeAgentIds` et `enableAgents`.
- Persona, preset, connexion et arrière-plan : restaurer la valeur précédente.

Avant d'exécuter Undo, vérifie que le chat actif porte toujours la valeur produite par le dépôt. Si une autre modification a changé le même champ entre-temps, ne l'écrase pas : abandonne l'action Undo devenue caduque et préviens l'utilisateur que le chat a changé.

## Architecture

### Utilitaire client partagé

Ajoute un module client dédié, provisoirement `packages/client/src/lib/chat-resource-drag.ts`, qui contient :

- La constante de type MIME.
- Le type de charge utile et son analyseur à l'exécution.
- La fonction `writeChatResourceDragPayload(dataTransfer, payload)`.
- La détection d'un glisser de fichier.
- Les gardes de type par nature de ressource.

Garde la charge utile côté client pour la première version : c'est un état d'interaction du navigateur, pas un contrat d'API.

### Résolveur de capacités

Ajoute un résolveur pur, provisoirement `packages/client/src/lib/chat-resource-drop-capabilities.ts` :

```ts
type ChatResourceDropAction =
  | { type: "add-characters"; ids: string[] }
  | { type: "add-lorebooks"; ids: string[] }
  | { type: "add-agents"; ids: string[]; mustEnableAgents: boolean }
  | { type: "set-persona"; id: string; replacesId: string | null }
  | { type: "set-preset"; id: string; replacesId: string | null }
  | { type: "set-connection"; id: string; replacesId: string | null }
  | { type: "set-background"; id: string };
```

Les entrées comprennent la charge utile de ressource analysée, le chat actif, les métadonnées normalisées, le mode courant et les identifiants des ressources disponibles. La sortie est soit une action concrète unique, soit `null`.

Le résolveur prend en charge :

- La suppression des doublons.
- Les restrictions de mode.
- Le filtrage des ID multiples.
- Les vérifications d'installation et de disponibilité.
- La détection des remplacements.
- Le choix de la clé d'action affichée.

Le résolveur n'effectue aucune mutation et n'affiche rien.

### Coordinateur des mutations

Ajoute un seul hook près de la surface du chat, provisoirement `use-chat-resource-drop.ts`, qui :

- lit le chat actif le plus à jour depuis React Query ou Zustand au moment du dépôt ;
- appelle `useUpdateChat` pour les champs de premier niveau du chat ;
- appelle `useUpdateChatMetadata` pour les lorebooks et les agents ;
- réutilise le chemin de mutation existant pour l'affectation d'arrière-plan ;
- ouvre des confirmations traduites via les utilitaires de dialogue de l'application ;
- crée les notifications toast de réussite et d'échec, ainsi que des actions Undo protégées.

Ne place pas de logique de mutation asynchrone dans un magasin Zustand.

### Surcouche de dépôt

Ajoute un seul composant de présentation autour de la frontière commune du chat central, plutôt qu'une implémentation distincte dans chaque fil des messages :

- Il reçoit la charge utile du glisser en cours et l'action déterminée.
- Il couvre la surface de conversation sans masquer la zone de saisie.
- Il compte les `dragenter` et `dragleave` en profondeur, pour éviter le scintillement entre éléments enfants.
- Il affiche une icône, l'intitulé de la ressource et le texte d'action traduit.
- Il s'adapte au pointeur et au thème.

Les surfaces Conversation et Roleplay/Game doivent toutes passer par le même coordinateur. Des enveloppes propres à chaque surface peuvent fournir la géométrie, mais elles ne doivent pas dupliquer la politique de capacités.

### Intégration dans les panneaux

Rends les lignes déplaçables petit à petit :

1. Les personnages.
2. Les lorebooks.
3. Les agents.
4. Les personas.
5. Les presets.
6. Les connexions.
7. Les arrière-plans, si le contrat d'affectation existant se réutilise proprement.

Chaque ligne conserve sa charge utile de glisser vers les dossiers et y ajoute la charge utile de ressource de chat. Ne change rien au déplacement des dossiers.

## Phases de livraison

### Phase 1 : contrat de glisser et surcouche centrale

- Ajouter l'utilitaire de charge utile typée et son analyseur.
- Ajouter le résolveur de capacités pur pour les personnages, les lorebooks et les agents.
- Ajouter la surcouche de la surface de chat centrale et le coordinateur des mutations.
- Intégrer les lignes des panneaux de personnages, de lorebooks et d'agents.
- Ajouter les textes traduits pour l'action, la confirmation, la réussite, l'erreur, le doublon et Undo.
- Vérifier qu'un glisser interne de ressource n'allume pas le repère de fichier de la zone de saisie.

Cette phase valide le principal parcours additif demandé par la fonctionnalité.

### Phase 2 : ressources de remplacement

- Ajouter les charges utiles de persona, de preset et de connexion.
- Ajouter la détection des remplacements et les fenêtres de confirmation traduites.
- Réutiliser les restrictions de mode et les hooks de mutation existants.
- Ajouter un Undo protégé pour les opérations de remplacement.

### Phase 3 : affectation de l'arrière-plan

- Déterminer si le flux de choix du sélecteur d'arrière-plan actuel peut accepter un identifiant d'arrière-plan déposé, sans dupliquer la politique.
- N'ajouter le glisser d'arrière-plans que si le même comportement d'affectation à l'échelle du chat se réutilise.
- Sinon, laisser les arrière-plans hors périmètre et consigner le blocage dans l'issue ou la PR.

### Phase 4 : parité tactile et sans glisser

Le glisser-déposer HTML sur poste de travail est la première voie d'implémentation. Sur mobile, rien ne doit dépendre d'un glisser précis d'un panneau à l'autre.

- Ajouter l'action `Add to active chat` à la surface d'actions existante de chaque ligne prise en charge.
- Réutiliser le même résolveur de capacités, les mêmes confirmations, les mêmes mutations et le même Undo.
- Si le glisser tactile est conservé, réutiliser les poignées de glisser tactiles existantes et déterminer la cible centrale avec `elementFromPoint`.
- Ne pas surcharger l'appui long sur les dossiers au point de rendre le rangement peu fiable.

Cette phase est indispensable avant de considérer la fonctionnalité terminée sur mobile.

## Fichiers susceptibles de changer

Nouveaux fichiers probables :

- `packages/client/src/lib/chat-resource-drag.ts`
- `packages/client/src/lib/chat-resource-drop-capabilities.ts`
- `packages/client/src/hooks/use-chat-resource-drop.ts`
- `packages/client/src/components/chat/ChatResourceDropOverlay.tsx`

Fichiers probablement modifiés :

- `packages/client/src/components/chat/ChatArea.tsx`, ou le propriétaire commun le plus restreint de la surface centrale.
- `packages/client/src/components/chat/ChatRoleplaySurface.tsx`, si la géométrie de la surface l'exige.
- `packages/client/src/components/chat/ConversationView.tsx`, si la géométrie de la surface l'exige.
- `packages/client/src/components/chat/ChatInput.tsx`.
- `packages/client/src/components/chat/ConversationInput.tsx`.
- `packages/client/src/components/panels/CharactersPanel.tsx`.
- `packages/client/src/components/panels/LorebooksPanel.tsx`.
- `packages/client/src/components/panels/AgentsPanel.tsx`.
- `packages/client/src/components/panels/PersonasPanel.tsx`.
- `packages/client/src/components/panels/PresetsPanel.tsx`.
- `packages/client/src/components/panels/ConnectionsPanel.tsx`.
- `packages/client/src/components/panels/settings/BackgroundPicker.tsx`, uniquement en phase 3.
- `packages/client/src/localization/locales/en.json`, ou le catalogue anglais canonique en vigueur au moment de l'implémentation.

Aucun changement n'est attendu côté serveur ni dans les paquets partagés pour les phases 1 et 2. Si l'implémentation révèle qu'une opération ne peut pas passer par les routes de patch de chat existantes, arrête-toi et redimensionne le plan, plutôt que d'introduire un contrat caché de prompt ou de persistance.

## Exigences d'accessibilité et de saisie

- Ne pas se reposer sur la couleur seule : afficher l'icône de la ressource et le texte de l'action.
- Ne pas exiger un survol pour découvrir l'équivalent sans glisser.
- Les confirmations se parcourent au clavier et rendent le focus à la fermeture.
- La touche Escape annule une confirmation en attente.
- Les lecteurs d'écran reçoivent une annonce brève quand une cible de dépôt valide apparaît, et quand une opération réussit ou échoue.
- Les surcouches de glisser ne doivent pas intercepter le défilement normal en l'absence de glisser reconnu.
- Les cibles tactiles respectent les tailles minimales déjà en vigueur sur mobile.
- Les personnes ayant réduit les animations reçoivent des changements d'opacité ou d'état, sans mouvement inutile.

## Localisation

Tout nouveau texte visible passe par des clés de localisation sémantiques. Ne mets à jour que le catalogue anglais canonique ; les traductions communautaires peuvent se rabattre sur l'anglais.

Les catégories de textes comprennent :

- Les intitulés d'action pour chaque nature de ressource.
- Les confirmations de remplacement.
- La confirmation d'activation des agents.
- Les notifications toast de réussite et d'échec.
- Les messages pour l'action Undo et pour une action Undo devenue caduque.
- Les annonces d'accessibilité.
- Le retour en cas de doublon ou de ressource déjà active, s'il est affiché.
- Les actions `Add to active chat` sans glisser.

## Tests

Ne laisse pas de fichiers `.test.ts` temporaires dans le dépôt.

### Couverture de non-régression pure

N'ajoute de couverture permanente pour le résolveur de capacités que dans un emplacement et un format de tests de non-régression déjà pris en charge :

- Personnage absent -> action d'ajout.
- Personnage déjà présent -> aucune action.
- Charge utile mixte de plusieurs personnages -> n'ajouter que les ID valides manquants.
- Lorebook absent -> action d'ajout.
- Lorebook déjà actif -> aucune action.
- Agent absent avec les agents activés -> action d'ajout.
- Agent absent avec les agents désactivés -> action d'ajout exigeant l'activation.
- Agent indisponible -> aucune action.
- Persona sans persona courant -> action de définition, sans remplacement.
- Persona qui en remplace un autre -> action de remplacement.
- Preset dans un mode non pris en charge -> aucune action.
- Connexion identique à la connexion courante -> aucune action.
- Version invalide, nature inconnue, ID malformés et charge utile surdimensionnée -> rejet.

### Couverture par tests de fumée dans le navigateur

Étends `pnpm smoke:ui` là où c'est réalisable :

- Glisser un personnage du panneau vers la surface du chat et vérifier l'affectation.
- Annuler avec Undo et vérifier que la liste de personnages précédente est restaurée.
- Vérifier qu'un glisser de personnage au-dessus de la zone de saisie n'affiche pas le retour de dépôt de fichier.
- Glisser un fichier pris en charge sur la zone de saisie et vérifier que les pièces jointes fonctionnent toujours.
- Vérifier qu'une ressource déjà active n'ouvre aucune destination de dépôt.
- Vérifier qu'une confirmation de remplacement annulée ne modifie rien.
- Vérifier qu'un remplacement confirmé met bien le chat à jour.
- Vérifier que le glisser-déposer de dossiers déplace toujours les ressources dans le panneau.

### Vérification manuelle

Vérifie sur poste de travail, dans les modes Conversation, Roleplay et Game, là où c'est pris en charge :

- Les thèmes sombre et clair.
- Le panneau de droite ouvert, avec un fil des messages long et défilé.
- Dépôt additif, dépôt en double, remplacement, annulation, échec, Undo et Undo caduc.
- Déplacement du curseur au-dessus d'éléments imbriqués du fil, sans scintillement de la surcouche.
- Le déplacement des dossiers dans les panneaux.
- Les dépôts de fichiers et d'images dans les deux zones de saisie.

Vérifie sur une fenêtre d'affichage mobile, ou à pointeur imprécis :

- La parité de l'action `Add to active chat` sans glisser.
- Le glisser tactile des dossiers, qui doit rester utilisable.
- Les confirmations, qui doivent tenir à l'écran et pouvoir se fermer.
- L'absence de chevauchement entre les textes et les contrôles.

Commandes obligatoires :

```bash
pnpm localization:check
pnpm check
pnpm regression:prompt
pnpm smoke:ui
```

La commande `pnpm regression:prompt` est obligatoire avant la fusion : la modification de `LorebooksPanel.tsx` touche à l'activation des lorebooks, qui alimente l'assemblage du prompt.

## Risques et parades

### Conflit avec le glisser vers les dossiers

Risque : ces mêmes lignes utilisent déjà le glisser-déposer pour ranger des éléments dans des dossiers.

Parade : conserver les types MIME de dossier existants, ajouter un type MIME de ressource de chat distinct et typé, et laisser chaque cible n'interpréter que sa propre charge utile. Vérifier le comportement de `copyMove` et l'absence de régression sur les dossiers.

### Faux surlignage de la zone de saisie

Risque : les gestionnaires `dragover` actuels de la zone de saisie réagissent à n'importe quel glisser, y compris aux ID de ressources internes.

Parade : n'activer le retour visuel de la zone de saisie que si `DataTransfer.types` ou `DataTransfer.items` indique des fichiers, ou une autre charge utile de pièce jointe explicitement prise en charge.

### État de chat périmé

Risque : le chat actif ou les ressources affectées peuvent changer entre le début du glisser, le dépôt, la confirmation et Undo.

Parade : résoudre à partir de l'état courant au moment du dépôt, puis de nouveau avant la mutation ou l'action Undo. Protéger Undo contre l'écrasement de changements plus récents.

### Dérive de la politique des modes

Risque : le glisser-déposer pourrait autoriser une affectation que l'interface de configuration et de réglages interdit.

Parade : extraire ou réutiliser les prédicats partagés des flux d'affectation existants. Ne pas coder en dur une seconde matrice de politique dans les composants de panneau.

### Extension cachée du comportement

Risque : accepter visuellement des ressources dans la zone de saisie pourrait laisser croire à un contexte d'un seul tour que le serveur n'honore pas.

Parade : garder le dépôt de ressources dans la zone de saisie désactivé tant qu'un contrat de contexte à l'échelle du message n'a pas été conçu à part.

### Dépôt d'une grande sélection

Risque : le glisser en mode sélection pourrait ajouter un ensemble étonnamment vaste de personnages, de lorebooks ou d'agents.

Parade : filtrer les ID invalides ou déjà actifs, respecter les limites de serveur ou de mode existantes, et demander confirmation quand un dépôt multiple franchit un seuil déjà défini. Ne pas inventer une nouvelle limite arbitraire.

## Hors périmètre explicite

- Déposer une ressource sur un ancien message.
- Modifier l'historique du prompt a posteriori.
- Consigner les changements de configuration sous forme de messages dans le fil.
- Des personnages, lorebooks, personas, presets, connexions ou agents valables pour un seul tour.
- Invoquer un agent en le déposant dans la zone de saisie.
- Démarrer un nouveau chat par un dépôt sur la surface centrale.
- Faire glisser des réglages quelconques vers le chat.
- Une API générique de dépôt pour les extensions dès la première version.
- Le glisser d'un fil de chat vers un autre.

## Critères d'acceptation

La phase 1 est acceptable quand :

- un personnage, un lorebook ou un agent peut être glissé depuis sa ligne du panneau de droite vers une surface de chat active valide ;
- le bon champ existant du chat est mis à jour, sans créer de message dans le fil ;
- les ressources déjà actives ou indisponibles sont refusées ;
- ajouter un agent alors que les agents sont désactivés exige une confirmation explicite ;
- chaque mutation réussie propose un Undo protégé ;
- un glisser de ressource ne déclenche aucun retour de pièce jointe dans la zone de saisie ;
- les dépôts de fichiers existants fonctionnent toujours dans les deux zones de saisie ;
- le glisser-déposer de dossiers se comporte exactement comme avant ;
- tout nouveau texte visible est traduit ;
- le poste de travail et le mobile offrent des actions équivalentes, même si le mobile passe par une action de menu plutôt que par un glisser d'un panneau à l'autre ;
- les commandes `pnpm localization:check` et `pnpm check` passent, ainsi que les tests de fumée d'interface concernés.

La fonctionnalité complète est acceptable quand les ressources de remplacement de la phase 2 et la parité mobile exigée sont elles aussi terminées. L'affectation d'arrière-plan reste facultative tant que la phase 3 n'a pas confirmé que sa logique existante se réutilise sans dupliquer la politique.

## Prolongement reporté

Une future fonctionnalité de contexte à l'échelle du message pourra rendre valides les dépôts de personnages, de lorebooks, d'agents, de personas, de presets ou de connexions dans la zone de saisie. Ce travail exige un contrat partagé et serveur distinct, qui définisse la persistance, l'assemblage du prompt, le budget de tokens, le routage vers le fournisseur, l'affichage, la restauration du brouillon et la sémantique de l'historique des messages. Il ne doit pas être introduit en douce dans cette fonctionnalité sous forme de simples pastilles côté client.
