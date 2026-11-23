# Créer et modifier des personnages

Une fiche de personnage est le fichier qui définit un personnage IA : qui il est, comment il parle, à quoi il ressemble et comment un chat démarre avec lui. Tu l'écris dans le Character Editor (l'éditeur de fiche de personnage). L'IA relit les champs de la fiche à chaque réponse : plus l'écriture est claire et précise, plus le personnage reste cohérent.

## Créer un personnage

1. Clique sur **Characters** (personnages) dans la barre de navigation du haut. Si tu ne le vois pas, ouvre d'abord **More** (plus).
2. Clique sur **New** (l'icône plus). La fenêtre **Create Character** s'ouvre.
3. Saisis un nom dans **Name \***. Le nom est obligatoire.
4. Clique sur le cercle rond de l'avatar pour ajouter une image. Cette étape est facultative.
5. Clique sur **Create**.

La fiche est enregistrée avec des champs vides, et le Character Editor s'ouvre.

6. Ouvre l'onglet **Card** (fiche) et écris la **Description** : qui est le personnage. Ajoute un **First Message** (message d'accueil) sous **Dialogue & Greetings** (dialogue et salutations) : c'est ainsi que s'ouvre un chat Roleplay.
7. Clique sur **Save** (enregistrer) dans l'en-tête.

Si tu as déjà un fichier de fiche, clique plutôt sur **Import**. Voir [Importer et exporter des fiches de personnage](import-export.md).

### Démarrer un chat avec ton personnage

Choisis le personnage quand tu démarres un chat. Voir [Mode Roleplay : premiers pas](../roleplay/getting-started.md) ou [Mode Conversation : premiers pas](../conversation/getting-started.md).

## Le Character Editor en un coup d'œil

Le Character Editor remplace la zone de chat par un espace de travail pleine page. Sur un écran large, les onglets forment une rangée de boutons dans l'en-tête. À certaines largeurs intermédiaires, les boutons n'affichent que leurs icônes. Survole un bouton pour voir son nom. Sur un écran étroit, ils se regroupent dans un menu sous le nom. Les onglets, dans l'ordre, sont **Metadata**, **Card**, **Onboarding**, **Convo**, **Lorebook**, **Images** (images), **Colors**, **Voice**, **Stats** et **Advanced**. Chaque onglet mène à sa section d'un seul long formulaire : tu peux donc aussi faire défiler la page.

L'en-tête regroupe les éléments les plus utilisés :

- La flèche **Back** (retour), la vignette de l'avatar, un champ de nom, et un champ de titre ou de commentaire pour une courte étiquette comme `Modern AU version`. Une ligne en dessous affiche le créateur et la version.
- **Save**. Ce bouton reste inactif tant que tu n'as rien modifié. Pendant l'opération, il affiche **Uploading…** (un avatar est en cours de téléversement), **Embedding…** (un lorebook est en cours d'ajout à la fiche) ou **Saving…**.
- L'étoile **Favorite** (favori).
- Le menu **…** (**More actions**, Plus d'actions) contient :
  - **Ask Professor Mari** (demander à Professor Mari). Cette action permet d'interroger Professor Mari sur cette fiche.
  - **Export character** (exporter le personnage). Voir [Importer et exporter des fiches de personnage](import-export.md).
  - **Import character as persona** (importer le personnage comme persona), qui copie cette fiche dans un nouveau persona, le personnage que tu incarnes. Voir [Personas](personas.md).
  - **Duplicate character** (dupliquer le personnage).
  - **Delete character** (supprimer le personnage).

Quitter l'éditeur enregistre d'abord tes modifications. Si l'enregistrement échoue, l'éditeur reste ouvert avec ton brouillon pour que tu puisses réessayer.

Onglets qui ont leur propre guide :

| Onglet | Guide |
| --- | --- |
| **Onboarding** | [Accueil interactif](interactive-onboarding.md) |
| **Convo** | [Profils du mode Conversation](../conversation/profiles.md) |
| **Lorebook** | [Lier des lorebooks à des personnages](../lorebooks/linking-to-characters.md) |
| **Images** | [Sprites de personnage](sprites.md) et [Galeries de personnages et de personas](galleries.md). Voir [Onglet Images](#images-tab). |
| **Colors** et **Stats** | [Couleurs et Caractéristiques de Roleplay des personnages](colors-and-stats.md) |

Les sections ci-dessous traitent des onglets **Metadata**, **Card**, **Images**, **Voice** et **Advanced**, ainsi que des avatars et de l'historique des versions.


<a id="images-tab"></a>

## Onglet Images

L'onglet **Images** (images) rassemble ce qui définit l'apparence du personnage dans les images. Les boutons en haut mènent à chaque section :

- **Character Sheet** (fiche de référence) : une image de référence du personnage. Clique sur **Manage** (gérer) pour en créer, en téléverser ou en choisir une. Active **Use as reference image** (utiliser comme image de référence) pour qu'elle soit utilisée de préférence à l'avatar lors de la génération d'images. Voir [Fiche de référence](sprites.md#character-sheet).
- **Selfie instructions** (instructions pour les selfies) : des directives facultatives pour les selfies Conversation du personnage, par exemple le style de prise de vue ou les expressions. Noodle et Slurp peuvent les utiliser si tu actives cette option dans leurs réglages. Voir [Selfies](../conversation/selfies.md).
- **Sprites** : expressions du visage, sprites en pied et clips d'appel. Voir [Sprites de personnage](sprites.md).
- **Gallery** (galerie) : images et vidéos conservées avec le personnage. Voir [Galeries de personnages et de personas](galleries.md).

L'onglet **Images** d'un persona contient les mêmes sections, à l'exception de **Selfie instructions**.

<a id="metadata-tab"></a>

## Onglet Metadata

L'onglet **Metadata** (métadonnées) rassemble les informations d'identité et de classement. Elles servent à trier, partager et suivre une fiche. La plupart ne sont pas envoyées à l'IA.

- **Character ID**. En lecture seule. Il apparaît après l'enregistrement de la fiche. Clique sur **Copy** (copier) pour le copier.
- **Name**. Le nom affiché. Dans les prompts, le texte que Marinara envoie à l'IA, il correspond à `{{char}}` : un espace réservé que Marinara remplace par le nom du personnage.
- **Other names** (autres noms). Surnoms, noms complets ou titres que le personnage porte aussi, par exemple `Clark Kent, Kal-El, Mr. Kent`. Sépare les noms par des virgules, puis appuie sur <kbd>Enter</kbd> ou clique sur **Add** (ajouter). Les chats Roleplay peuvent les afficher dans la couleur du nom. Le Character Tracker associe à la fiche tout personnage qu'il suit sous l'un de ces noms. Voir [Couleurs du personnage](colors-and-stats.md#the-three-colors).
- **Creator**. La personne qui a créé la fiche, pour la créditer lors du partage.
- **Version**. Un numéro de version que tu choisis, par exemple `1.0`. L'interrupteur **Automatic versioning** (gestion automatique des versions), juste à côté, conserve les versions précédentes et augmente ce numéro quand la fiche change. L'historique des versions n'enregistre d'instantanés que si cet interrupteur est activé.
- **Talkativeness**. Un curseur de 0 à 100 pour cent. Il règle la fréquence à laquelle ce personnage prend la parole dans les chats de groupe. La valeur par défaut est 50 pour cent.
- **Tags**. Saisis des tags dans le champ d'ajout, puis appuie sur <kbd>Enter</kbd> ou clique sur **Add** (ajouter). Sépare plusieurs tags par des virgules. Le champ propose les tags que ta bibliothèque utilise déjà, les plus utilisés en premier. Retire un tag avec son X, ou retire-les tous avec **Remove All** (tout retirer).
- **Creator Notes**. Des notes privées qui ne sont jamais envoyées à l'IA.

**Split description into fields** (répartir la description en champs) est un bouton situé sous **Version**. Il sort de **Description** les passages annoncés par un intitulé (personnalité, apparence, histoire, scénario, règles, exemple de dialogue) et place chacun dans son propre champ. Tu vois d'abord un court résumé, et l'appliquer enregistre la fiche comme nouvelle version. Le bouton est inactif tant que **Description** est vide.

Le panneau **Version history** (historique des versions) se trouve lui aussi sur cet onglet. Voir [Historique des versions](#version-history).

<a id="card-tab"></a>

## Onglet Card

L'onglet **Card** est l'espace principal de rédaction. Les liens en haut permettent de rejoindre n'importe quelle section, et chaque champ possède un compteur de caractères actualisé en direct.

| Champ | Quoi écrire | Envoyé à l'IA |
| --- | --- | --- |
| **Summary** (résumé) | Une courte présentation pour ta bibliothèque et l'aperçu de la fiche. | Non |
| **Description** | L'identité générale et le rôle du personnage. | Dans chaque prompt |
| **Personality** (personnalité) | Le tempérament, les habitudes de langage, les comportements types. | Oui |
| **Backstory** (passé) | Le passé, les origines, les relations importantes. | Oui |
| **Appearance** (apparence) | Le physique, les vêtements, les détails visuels. Sert aussi à préremplir un prompt d'avatar IA. | Oui |
| **Scenario** (scénario) | Le cadre par défaut des nouveaux chats avec ce personnage. | Oui |
| **Public Face** (image publique) | La fiche sans ses éléments privés. | Seulement si une macro ou un réglage le demande |

**Public Face** décrit ce que les autres personnages peuvent voir ou savoir du personnage : son apparence, ses manières, son rôle, sa réputation et les relations connues. Laisse de côté les secrets, les pensées intimes, l'histoire privée et les consignes pour jouer le personnage. Ce champ ne fait jamais partie de la fiche envoyée. Un prompt le lit uniquement là où tu places la macro `{{publicFace}}`, ou `{{personaPublicFace}}` pour ton persona. Voir [Macros de prompt](../prompts/macros.md#identity-character-and-persona-macros). Dans un chat de groupe Individual en Roleplay, **Others' Public Faces** l'envoie aux tours des autres personnages. Voir [Autres réglages Individual](../chats/group-chats.md#more-individual-settings). Un agent dont la source **Characters** ou **Persona** est réglée sur **Public Face** lit ce champ à la place de la fiche. Voir [Autres réglages](../agents/custom-agents.md#other-settings). Quand **Send Public Faces** est activé, Impersonate lit ce champ à la place de la fiche en Roleplay. Voir [Réglages d'Impersonate](../chats/guided-and-impersonate.md#the-impersonate-settings).

**Apparence** a deux onglets, **Prose** et **Tags d'image**. **Prose** contient le texte de l'apparence lui-même. **Tags d'image** contient des tags courts pour les prompts d'image, comme un mot déclencheur de LoRA (un mot-clé qui active un style d'image personnalisé). Saisir des tags coche **Utiliser pour les prompts d'image**, et un point sur l'onglet indique qu'ils sont utilisés. Tant que cette option est cochée et que les tags sont remplis, les prompts d'image utilisent ces tags exactement tels qu'ils sont écrits, avec la prose en contexte. Décoche-la pour garder les tags sans les utiliser : les prompts d'image se rabattent alors sur **Prose**. Un prompt d'avatar IA part aussi des tags. Le narrateur voit toujours le texte de **Prose**. L'onglet **Images** mène ici avec **Aller à Apparence**. L'onglet a sa propre baguette. Voir [Tags d'image avec la baguette](#image-tags-from-the-wand).

La section **Dialogue & Greetings** définit l'ouverture du chat et le ton du personnage :

- **First Message**. Le message d'ouverture d'un nouveau chat Roleplay. Les chats Conversation et Game ne commencent pas par un message d'accueil.
- **Alternate Greetings** (salutations alternatives). Des messages d'ouverture supplémentaires. Au lancement d'un chat Roleplay, tu peux choisir lequel utiliser. Les commandes haut et bas les réordonnent, et le X en supprime un.
- **Example Dialogue** (exemples de dialogue). Des échanges d'exemple qui apprennent au personnage sa façon de parler. Utilise `<START>` pour séparer les échanges, et `{{user}}` et `{{char}}` comme espaces réservés.

```text
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

Les salutations et les messages d'exemple peuvent afficher des images de la Gallery du personnage. Voir [Réutiliser une image de galerie dans les messages et les salutations](galleries.md#reuse-a-gallery-image-in-messages-and-greetings). Quand les salutations affichent des images venues d'autres sites web, **Save images locally** (enregistrer les images localement) en garde une copie dans la Gallery. Voir [Enregistrer les images web des salutations](galleries.md#save-web-images-from-greetings).

<a id="write-a-card-field-with-the-wand"></a>

### Écrire un champ de la fiche avec la baguette

**Résumé**, **Description**, **Personnalité**, **Passé**, **Apparence** (ses deux onglets), **Scénario**, **Profil public**, **Exemple de dialogue**, **Premier message** et chaque **Salutation alternative** ont un bouton baguette sans texte au-dessus du champ. Son infobulle nomme le champ qu'il écrit.

Avant de commencer : configure une connexion texte fonctionnelle. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Écris dans le champ les idées que tu veux conserver, par exemple `smart, scientist, handsome`, ou laisse-le vide.
2. Remplis les autres champs de la fiche que l'IA doit utiliser comme référence. Tu n'as pas besoin d'enregistrer d'abord.
3. Clique sur la baguette du champ. Marinara demande 100–300 mots pour ce champ, en prenant ton texte comme détails de départ. Exemple de dialogue demande des échanges d'exemple. **Premier message** et chaque **Salutation alternative** demandent un seul message d'ouverture qui laisse ta réponse ouverte. **Profil public** n'a pas de fourchette de mots : sa baguette réécrit le reste de la fiche sans les parties privées, donc la longueur suit ta fiche. Dans l'onglet **Tags d'image** de **Apparence**, la baguette transforme plutôt l'apparence de la fiche en une ligne de tags d'image. Voir [Tags d'image avec la baguette](#image-tags-from-the-wand).
4. Modifie le résultat, puis clique sur **Save**.

La baguette utilise ta connexion texte par défaut pour les agents ou, s'il n'y en a pas, ta connexion texte par défaut. Une connexion de secours configurée pour les agents s'applique toujours.

La baguette remplace uniquement le champ choisi dans ton brouillon non enregistré. Si la génération échoue, ton texte reste intact. Si tu modifies ce champ pendant l'attente, ou si tu passes à une autre fiche, un résultat tardif n'écrase pas ton travail. Tu n'as pas besoin de Professor Mari pour utiliser la baguette.

#### Tags d'image avec la baguette

La baguette de l'onglet **Tags d'image** de **Apparence** écrit les tags à partir du texte d'apparence de ta fiche, principalement **Apparence** lui-même. Elle coche **Utiliser pour les prompts d'image**.

- Les tags déjà dans le champ que ton texte d'apparence n'explique pas, comme un mot déclencheur de LoRA, restent exactement tels que tu les as écrits, au début de la ligne.
- Viennent ensuite les nouveaux tags : `1girl`, `1boy` ou `1other`, puis les traits durables : corps, cheveux, yeux, peau, visage et marques. Si aucun tag n'est conservé, la ligne commence par `1girl`, `1boy` ou `1other`.
- Les nouveaux tags sont en anglais, en minuscules, dans le style que les modèles d'image connaissent grâce à Danbooru (un site d'images anime dont beaucoup de modèles ont appris les tags), séparés par des virgules.
- Les nouveaux tags utilisent uniquement les traits indiqués dans ta fiche. Les vêtements, expressions, poses et lieux sont laissés de côté, car ils changent d'une scène à l'autre.

Les tags viennent du modèle, pas d'une liste de vrais tags Danbooru ; un tag peut donc être formulé d'une façon que ton modèle d'image ne connaît pas. Vérifie la ligne et modifie-la avant d'enregistrer.

## Ajouter un avatar

L'avatar est l'image affichée pour le personnage dans le chat et dans ta bibliothèque.

### Téléverser une image

1. Clique sur la vignette de l'avatar dans l'en-tête de l'éditeur.
2. Choisis un fichier image. La nouvelle image apparaît aussitôt.

Dès qu'un personnage a un avatar, un outil de recadrage de l'avatar apparaît sur l'onglet **Metadata**. Il sert à déplacer ou à zoomer l'image dans son cercle, ou à retirer l'avatar.

### Générer un avatar avec l'IA

Avant de commencer : ajoute une connexion de génération d'images. Le bouton d'avatar IA n'apparaît que si tu en as une. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Survole la vignette de l'avatar et clique sur le bouton baguette. La fenêtre **Generate Character Avatar** (générer l'avatar du personnage) s'ouvre.
2. Choisis une connexion dans **Image Generation Connection** (connexion de génération d'images).
3. Vérifie ou modifie le **Prompt de l'avatar**. Il part des **Tags d'image** de **Apparence** quand **Utiliser pour les prompts d'image** est coché et qu'ils sont remplis. Sinon, il utilise **Apparence**, puis **Description**, puis **Personnalité**, le premier champ qui contient du texte.
4. Si la fiche a déjà un avatar, tu peux cocher **Use current avatar as a reference** (utiliser l'avatar actuel comme référence).
5. Clique sur **Generate** (générer). Pour un nouvel essai, clique sur **Regenerate** (régénérer).
6. Quand le résultat te convient, clique sur **Use Avatar** (utiliser l'avatar).

La taille de l'image vient du réglage de taille **Portraits**, dans les réglages de génération d'images. Elle vaut 1024 par 1024 par défaut. Si **Expose media prompts before sending** (afficher les prompts médias avant l'envoi) est activé, une étape de relecture du prompt s'intercale avant chaque requête.

## Onglet Voice

L'onglet **Voice** (voix) définit la voix du personnage quand le Text to Speech (synthèse vocale) le lit à voix haute.

- **Voice**. La voix de ce personnage. Toute modification est enregistrée aussitôt, sans passer par **Save**. C'est le même réglage que la ligne de ce personnage dans les réglages de la tâche **Voice** de **Connections**. Laisse le champ vide pour utiliser la voix par défaut. Si une fiche au nom correspondant a une voix, par exemple l'original d'une copie AU (univers alternatif), le champ vide affiche le nom de cette voix, car cette fiche l'utilise aussi.
- **Preview** (écouter). Joue une courte phrase avec cette voix. La phrase dit le nom du personnage, ou le **Phonetic name** (nom phonétique) s'il est défini.
- **Phonetic name**. Une orthographe facultative, utilisée uniquement pour corriger la prononciation. Ce champ fait partie de la fiche : clique donc sur **Save** pour le conserver.

Si le Text to Speech est désactivé, ou si tous les personnages partagent une seule voix, une courte note remplace le champ **Voice**. Avec une voix commune, la note propose **Use a voice per character** (utiliser une voix par personnage). **Open Text to Speech settings** (ouvrir les réglages de synthèse vocale) ouvre les réglages de la tâche **Voice** dans **Connections**. Voir [Configuration du Text to Speech (TTS)](../media/tts-setup.md).

## Onglet Advanced

L'onglet **Advanced** (avancé) regroupe des réglages de prompt. Pour un personnage classique, laisse-les vides. Ils s'appliquent aux modes Conversation, Roleplay et Game. Un preset Conversation ou Game – un modèle de prompt enregistré – modifie le prompt qui l'entoure, mais ne désactive ni les Post-History Instructions ni le Depth Prompt du personnage.

- **System Prompt**. Des instructions propres au personnage, ajoutées via le bloc de personnage du preset actif, le contexte de personnage en mode Conversation ou la fiche de personnage en Game Mode. Cela ne remplace pas le prompt système principal du chat.
- **Post-History Instructions**. Un texte placé après l'historique du chat, juste avant que l'IA écrive, par exemple "Stay in character".
- **Depth Prompt**. Un texte inséré dans l'historique du chat. **Depth** (profondeur) indique de combien de messages on remonte : 0 place le texte juste après le dernier message. La valeur par défaut est 4. **Role** (rôle) vaut **System**, **User** ou **Assistant**. La valeur par défaut est System.

La section **Regex Scripts** contient les scripts de recherche-remplacement de ce seul personnage. Voir [Scripts regex](../extending/regex-scripts.md).

<a id="use-an-alternative-field-in-selected-chats"></a>

## Utiliser un champ alternatif dans certains chats

Un champ alternatif donne au même personnage une autre description, apparence, histoire ou autre détail dans les chats choisis, tandis que partout ailleurs l'original reste en place. Chacun des huit champs de la fiche possède **Add Alternative Field** (ajouter un champ alternatif) en dessous.

1. Clique sur **Add Alternative Field** sous le champ à varier. Marinara copie le texte du champ dans une nouvelle alternative.
2. Facultatif : clique sur son titre, par exemple **Backstory alternative 1** (alternative 1 du passé), et saisis un nom comme `Young`. Un nom compte au plus 60 caractères. Laisse le nom vide pour garder le titre numéroté.
3. Modifie l'alternative. Elle a sa propre baguette, qui prend le texte de l'alternative comme point de départ et ne modifie pas le champ d'origine.
4. Ouvre **Active in 0 chats** (actif dans 0 chats) et coche les chats qui doivent l'utiliser. Seuls les chats incluant ce personnage sont proposés.
5. Clique sur **Save**.

Tu peux aussi faire ce choix depuis un chat. Ouvre **Chat Settings** (réglages du chat) et déplie **Card Field Alternatives** (alternatives des champs de la fiche). La section liste la persona du chat et chaque personnage du chat qui a des alternatives, avec un menu par champ. Choisis **Original** (original) ou une alternative par son nom. La fiche est enregistrée aussitôt, et le choix s'applique dès la prochaine réponse. La section est masquée quand rien dans le chat n'a d'alternatives.

Règles :

- Un chat ne peut utiliser qu'une seule alternative par champ. Cocher un chat dans une autre alternative, ou en choisir une autre dans Chat Settings, l'y déplace.
- Sans chat coché, l'alternative reste inactive pour plus tard.
- Une alternative vide efface ce champ dans ses chats.
- Une alternative de **Apparence** a ses propres onglets **Prose** et **Tags d'image**. Dans ses chats, ses tags remplacent ceux de la fiche. Si ses tags sont vides ou décochés, les prompts d'image utilisent la prose de l'alternative, jamais les tags de la fiche. Une nouvelle alternative copie aussi les tags de la fiche. Son onglet **Tags d'image** a sa propre baguette, qui lit la prose et les tags de l'alternative.
- Les remplacements de scénario et d'apparence pour les images propres au chat restent prioritaires.
- Les alternatives de **Summary** restent des métadonnées et ne sont pas envoyées à l'IA.
- Si le personnage quitte un chat, son affectation est suspendue, puis reprend quand tu ajoutes à nouveau le personnage.
- L'exportation, l'importation, la duplication et la conversion entre personnages et personas conservent le texte alternatif, mais effacent les coches des chats. Les sauvegardes du profil complet conservent les coches.

Pour supprimer une alternative, clique sur sa corbeille, confirme avec **Delete** (supprimer), puis clique sur **Save**. Ses chats retrouvent le champ d'origine. Supprimer une alternative ne supprime jamais le champ d'origine.

<a id="version-history"></a>

## Historique des versions

Tant que l'interrupteur **Versionnage automatique** est activé, chaque enregistrement peut ajouter un instantané dans **Historique des versions**, sur l'onglet **Métadonnées**. Jusque-là, le panneau affiche `Previous card states will appear here after the next edit.` Un compteur indique le nombre d'instantanés enregistrés. Mettre à jour le personnage à partir d'une fiche plus récente enregistre toujours un instantané au préalable, même si l'interrupteur est désactivé. Voir [Mettre à jour un personnage que tu as déjà](import-export.md#update-a-character-you-already-have).

Pour comparer une version enregistrée avec ta fiche actuelle :

1. Ouvre l'onglet **Metadata**.
2. Dans **Version history**, clique sur une version enregistrée. Une fenêtre de comparaison liste côte à côte les champs de la fiche et signale chaque champ modifié.

Pour revenir à une version plus ancienne :

1. Ouvre la fenêtre de comparaison de cette version, ou clique sur son icône de restauration dans la liste.
2. Clique sur **Restore this version** (restaurer cette version), puis confirme.

Marinara enregistre d'abord ta fiche actuelle dans l'historique des versions (sauf si elle correspond déjà à cette version), pour que tu puisses y revenir plus tard.

Autres commandes du panneau :

- L'icône crayon modifie le numéro de version de fiche d'un instantané sans le restaurer.
- L'icône corbeille supprime un instantané. Ta fiche actuelle ne change pas.
- **Reset** (réinitialiser) supprime tous les instantanés enregistrés et remet la version de la fiche à 1.0. Marinara te demande de confirmer, et l'action est irréversible. **Reset** est inactif tant que tu as des modifications non enregistrées.

## Relire les mises à jour de fiche proposées par un agent

Pendant un chat Roleplay, un agent facultatif peut suggérer de petites modifications des champs de la fiche d'après la scène. La fenêtre **Review Character Card Updates** (relire les mises à jour de la fiche) s'ouvre pour que tu décides de ce que tu gardes. Pour chaque modification proposée :

- **Approve** (approuver) l'applique, augmente le numéro de version et ajoute une entrée dans l'historique des versions.
- **Regenerate** demande à l'agent un nouvel essai.
- **Reject** (rejeter) l'écarte.

Si le texte a changé depuis la proposition, l'application te prévient avant de te laisser forcer la modification. Pour activer ou désactiver ces agents, voir [Agents : des aides IA pour tes chats](../agents/agents-overview.md).

## Si ça n'a pas marché

- **La baguette ne fait rien ou échoue.** Vérifie que tu as une connexion texte fonctionnelle. Ton brouillon n'est jamais écrasé en cas d'échec.
- **Pas de bouton d'avatar IA.** Ajoute d'abord une connexion de génération d'images.
- **Impossible de supprimer Professor Mari.** C'est un personnage intégré : Marinara la réinitialise à chaque démarrage. Voir [Professor Mari, ton assistante intégrée](../home/professor-mari.md).

## Guides associés

- [Personas](personas.md)
- [Importer et exporter des fiches de personnage](import-export.md)
- [Organiser ta bibliothèque de personnages](library-organization.md)
