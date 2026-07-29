# World Maps : installation, création et déplacements

> **Compatibilité actuelle :** ce guide correspond à World Maps **1.2.0**
> sur Marinara Engine **2.3.5**. Le package fonctionne avec les chats Roleplay et Game.

World Maps donne à Roleplay et Game un état du monde persistant. Au lieu
de garder un seul lieu en texte libre, il représente le monde comme des lieux imbriqués :

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Quest Hall
    └── Old Sewers
```

Marinara conserve dans cette hiérarchie un lieu actuel qui fait autorité. Le fil
d'Ariane du moment, les détails exacts du lieu, les destinations proches et le
lore éligible qui y est rattaché peuvent ancrer la réponse suivante. Les cartes
peuvent aussi suivre un voyage narré jusqu'au bout vers un lieu connu, ou ajouter
un lieu tout juste découvert quand l'histoire y arrive vraiment.

Chaque chat reçoit sa propre copie de travail d'une carte. Les modèles de carte,
valables pour tout le compte, te permettent de préparer une fois un univers
original ou de fandom, puis d'en ajouter une copie propre à n'importe quel chat
Roleplay ou Game.

## Ce que propose la fonctionnalité

World Maps 1.2.0 apporte :

- des régions, agglomérations, lieux, bâtiments, étages et pièces imbriqués ;
- des fils d'Ariane et un lieu d'histoire actuel qui fait autorité ;
- des vues en liste, en carte positionnée et en couches ordonnées pour les lieux enfants ;
- les déplacements parent/enfant, les liens directs et la planification d'itinéraires sur plusieurs tours ;
- des déplacements validés à partir de la narration achevée et la découverte de nouveaux lieux ;
- des modèles de carte valables pour tout le compte, créés à la main, avec l'IA ou par import ;
- des brouillons et extensions de carte assistés par l'IA, ancrés dans la configuration ou le lore sélectionné ;
- des descriptions de lieu publiques, une mémoire privée pour le modèle et du lore attaché au lieu exact ;
- une image de référence issue de la galerie, facultative, pour chaque lieu ;
- un arrière-plan de galerie distinct pour chaque carte d'enfants positionnée ;
- une génération par lots, avec revue, des illustrations de lieu manquantes ;
- une redéfinition globale du prompt d'illustration des cartes, à base de variables ;
- la prise en charge de la référence de lieu pour les illustrations Roleplay et les Storyboards de Game ;
- l'import, l'export, l'archivage, l'édition respectueuse de l'historique et les liaisons avec la carte de Game ;
- des bibliothèques de prompts globales pour la construction de cartes par l'IA et pour l'insert de lieu à l'exécution.

Les destinations disponibles font partie du contexte envoyé au modèle. Quand les
choix CYOA sont activés, le modèle peut donc proposer comme options suivantes les
enfants du lieu actuel ou les lieux connectés. Les choix exacts, eux, restent
générés par le modèle.

## Démarrage rapide

1. Ouvre **Agents** (Agents), clique sur **Download Agents** (télécharger des agents) et installe **World Maps**.
2. Redémarre Marinara quand l'application te le demande. Le package contient du code serveur.
3. Ouvre un chat Roleplay ou Game.
4. Ouvre **Agents → World Maps** et active-le pour le chat en cours. Tu
   peux aussi l'activer depuis la section **Chat Settings → Agents** (réglages du chat) de ce chat.
5. Crée la carte avec **Use template** (utiliser un modèle), **Create with AI**
   (créer avec l'IA) ou **Build manually** (construire à la main). Les chats
   existants peuvent aussi importer un fichier de carte.
6. Vérifie la hiérarchie de travail, choisis un lieu de départ, active la carte
   et clique sur **Save** (enregistrer).
7. Ouvre la **Story map** (carte de l'histoire) pendant le chat. Sélectionne une
   destination accessible et envoie le tour suivant, ou décris le voyage
   naturellement et laisse la réponse mettre le lieu à jour une fois l'arrivée accomplie.
8. Si tu veux, attribue des illustrations de la galerie aux lieux, ou utilise
   **Location artwork** (illustrations de lieu) pour vérifier et générer les images manquantes.

Appliquer un modèle, un brouillon d'IA ou un fichier importé ne change que la
copie de travail de l'éditeur. Rien n'agit sur les réponses tant que la
hiérarchie n'est pas activée et enregistrée.

## Installer et activer le package

Ouvre **Agents** depuis l'onglet **Sparkles** de la barre latérale de droite.
Clique sur **Download Agents**, sélectionne **World Maps** et clique sur
**Install** (installer). Si le catalogue propose ensuite **Update** (mettre à
jour), installe cette mise à jour aussi. Effectue le redémarrage demandé avant
d'utiliser le package.

La page World Maps indique la version installée du package et son état de
disponibilité, donne accès à la bibliothèque de modèles du compte et affiche
l'état de la carte du chat en cours. Installer le package le rend disponible,
mais ne l'active pas dans tous les chats.

### Roleplay

1. Ouvre le chat Roleplay.
2. Ouvre **Chat Settings** avec le bouton en forme d'engrenage.
3. Active **Enable Agents** (activer les agents).
4. Sous **Tracker Agents** (agents de suivi), active **World Maps**.
5. Ouvre **Edit hierarchical map** (modifier la carte hiérarchique) ou la
   bibliothèque **Map templates** (modèles de carte).

La bibliothèque de modèles se comporte de la même façon, qu'elle soit ouverte
depuis la page **Agents** principale ou depuis les **Chat Settings** du
Roleplay. Utilise **Add to chat** (ajouter au chat) pour copier un modèle dans
le chat actif.

### Game

Pendant la configuration de Game, choisis World Maps, puis sélectionne
l'une de ses voies de configuration :

- **Create with AI** prépare une hiérarchie générée, prête à être vérifiée.
- **Use template** ouvre le sélecteur de modèles avant la création de la partie Game.
- **Build manually** démarre sur une hiérarchie vierge et modifiable.

Après avoir choisi **Use template**, sélectionne un modèle précis et confirme-le.
La configuration crée une copie de travail appartenant à la partie Game pour que
tu la vérifies ; elle ne modifie jamais le modèle du compte. Les lieux du modèle
sélectionné deviennent le monde de départ hiérarchique. Aucune carte de Game
classique de repli ne vient prendre sa place.

Autre option : ajouter World Maps plus tard à une partie Game existante
depuis **Chat Settings → Agents**.

## Créer et réutiliser des modèles de carte

Ouvre **Agents → World Maps → Open map templates** (ouvrir les modèles de
carte). Les modèles appartiennent au compte et non à un seul chat : ils
conviennent donc aux univers de fandom réutilisables, aux cadres de campagne,
aux donjons, aux villes ou à tes cartes de départ personnelles.

Depuis la bibliothèque, tu peux :

- créer un modèle à la main ;
- utiliser **Create with AI** pour en rédiger un brouillon ;
- importer un fichier `.hierarchical-map.json` ;
- rechercher, consulter, modifier, exporter ou supprimer un modèle ;
- utiliser **Add to chat** dans un chat Roleplay ou Game ouvert ;
- choisir **Use template** pendant la configuration de Game.

Chaque application crée une copie de travail indépendante. Les modifications
apportées ensuite au modèle ne changent rien aux chats qui l'ont déjà copié, et
les modifications faites dans un chat ne changent pas le modèle.

Les modèles ne copient pas les illustrations de la galerie du chat. Les
identifiants d'image appartiennent à la galerie du chat d'origine et ne seraient
pas transposables. Ajoute ou génère les références de lieu et les arrière-plans
de carte du chat de travail après avoir appliqué le modèle.

## Comprendre l'éditeur de carte

Sur ordinateur, l'éditeur affiche trois panneaux. Sur un écran étroit, passe
d'un onglet à l'autre entre **Hierarchy** (hiérarchie), **Local** (local) et
**Details** (détails).

- **Hierarchy** affiche l'arbre complet. Sélectionner un lieu ouvre sa
  modification. Le bouton **Enter** (entrer) change la partie de la hiérarchie
  affichée ; il ne déplace pas l'histoire.
- **Local** affiche les enfants immédiats du lieu actuel, sous forme de liste,
  de carte positionnée ou de couches ordonnées.
- **Details** permet de modifier le texte du lieu, la hiérarchie, le lore, les
  illustrations, les liens, le statut et les liaisons avec la carte de Game.

L'en-tête de l'éditeur regroupe les commandes de construction par l'IA,
**Templates** (modèles), **Export** (exporter), **Import** (importer),
l'interrupteur **Enabled** (activé) et **Save**. Les modifications non
enregistrées portent la mention **Unsaved** (non enregistré). Si tu quittes
l'éditeur avec du travail non enregistré, l'application te demande si tu veux
l'abandonner.

### Ce que peut contenir un lieu

Chaque lieu peut avoir :

- un parent et autant d'enfants que nécessaire ;
- un type Region, Settlement, Place, Building, Floor ou Room ;
- un nom et une icône ;
- une description publique et une mémoire privée pour le modèle ;
- un court résumé de ce dont le modèle doit avoir conscience ;
- des liens vers des entrées de lorebook attachées au lieu exact ;
- des liens directs à sens unique ou à double sens vers d'autres lieux ;
- une présentation des enfants en List, Map ou Layers ;
- une image de référence de lieu et un interrupteur facultatif d'utilisation de l'image ;
- un arrière-plan de carte d'enfants distinct avec la présentation Map ;
- un statut actif ou archivé.

Avec la présentation **Map**, fais glisser les enfants à leur place ou saisis
des positions X et Y précises, de 0 à 100. Le parent sélectionné peut aussi
recevoir une image de la galerie derrière ses enfants. Avec **Layers**, donne à
chaque enfant un ordre de couche distinct.

Les liens directs peuvent relier n'importe quels lieux valides de la hiérarchie :
un ferry entre deux villes, un escalier entre certains étages, un portail entre
deux mondes ou un passage secret entre des pièces de bâtiments différents.

Pour une tour de 25 étages, modélise normalement les étages comme des frères et
sœurs sous une même tour, plutôt qu'en une chaîne de parents profonde de 25
niveaux. Les cartes acceptent jusqu'à 500 lieux et 20 niveaux de hiérarchie.

## Rédiger ou étendre une carte avec l'IA

Sur une carte vide, clique sur **Create with AI** ou **Draft with AI** (rédiger
un brouillon avec l'IA). Sur une carte existante, clique sur **Expand with AI**
(étendre avec l'IA).

### Choisir ce que lit le constructeur

Sous **Build from** (construire à partir de), choisis l'une de ces sources :

- **Game setup** (configuration de la partie) utilise la configuration et les
  personnages du moment. Dans Game, cela inclut la présentation générale du
  monde et les personnages de l'équipe.
- **Selected lore** (lore sélectionné) utilise les lorebooks choisis.
  **Strict canon** (canon strict) ne crée que des lieux appuyés sur le lore.
  **Canon + expansion** (canon et ajouts) autorise des ajouts cohérents.

Le constructeur ne lit pas l'historique des tours. Ajoute tout ce qui manque
dans la configuration ou le lore aux champs **What should this world include?**
(que doit contenir ce monde ?) ou **What should be added?** (qu'y a-t-il à ajouter ?)

Choisis une taille :

| Taille     | Résultat approximatif |
| ---------- | --------------------- |
| **Small**  | 8 lieux               |
| **Medium** | 16 lieux              |
| **Large**  | 28 lieux              |

La génération produit un brouillon, pas une carte enregistrée. Cherche dans
l'aperçu complet ou déplie-le, sélectionne des lieux et examine leurs chemins,
descriptions, mémoire privée pour le modèle et provenance du lore. Utilise
**Edit prompt** (modifier le prompt), **Regenerate** (régénérer) ou **Discard
draft** (abandonner le brouillon) avant de continuer.

Clique sur **Continue to editor** (passer à l'éditeur) pour une nouvelle carte,
ou sur **Add to working map** (ajouter à la carte de travail) pour une
extension. Dès que l'historique de campagne renvoie à des identifiants de lieu,
Maps protège ces références en autorisant l'extension plutôt qu'un remplacement
complet par des données sans rapport.

## Construire ou modifier une carte à la main

Sur une carte vide, clique sur **Build manually**. Maps crée un premier lieu
large. Sélectionne-le dans la hiérarchie, puis utilise :

- **Add child** (ajouter un enfant) pour un lieu situé à l'intérieur du lieu sélectionné ;
- **Add sibling** (ajouter un voisin) pour un lieu placé à côté, sous le même parent ;
- **Duplicate** (dupliquer) pour copier un sous-arbre de lieux avant de le modifier ;
- **Archive** (archiver) pour retirer un lieu sans effacer les références historiques.

Définis le lieu de départ de l'histoire avec **Set as starting location**
(définir comme lieu de départ). Une hiérarchie a besoin d'un lieu de départ
actif pour pouvoir être activée. Active **Enabled** et clique sur **Save** après
avoir résolu les problèmes signalés par l'éditeur.

## Comprendre ce qui parvient au modèle

Chaque génération faite avec une carte enregistrée et activée reçoit un unique
bloc de contexte spatial faisant autorité, qui contient :

- le fil d'Ariane du moment ;
- l'identifiant exact du lieu actuel et sa description publique ;
- la mémoire privée pour le modèle du lieu actuel exact, si elle existe ;
- les destinations accessibles en un seul déplacement ;
- un index limité des lieux connus actifs et de leurs identifiants exacts.

L'index des lieux connus permet à la réponse de reconnaître une arrivée ailleurs
dans le monde enregistré. Les destinations proches peuvent aussi nourrir la
prose ordinaire ou les choix CYOA.

Les noms des parents servent de repères, mais les descriptions, la mémoire
privée, les illustrations et le lore attachés aux parents ne sont pas hérités.
Si le lieu actuel est `Tower → Floor 7 → Alchemy Lab`, les détails du
laboratoire sont actifs, tandis que la tour et l'étage n'apportent que leur nom
au fil d'Ariane.

La **mémoire privée pour le modèle** est une note enregistrée, réservée à l'IA,
et non une mémoire qui se met à jour toute seule. Sers-t'en pour les secrets,
l'ambiance, les dangers permanents, les règles locales ou les faits qui ne
doivent être actifs qu'à cet endroit précis. Place ce qui doit absolument
parvenir au modèle dans la description publique ou dans la mémoire privée pour
le modèle, plutôt que de compter sur le seul résumé de conscience du lieu.

## Se déplacer pendant une histoire

Maps prend en charge les voyages explicites, les itinéraires planifiés et les
arrivées narrées validées. Le déplacement est enregistré avec le tour : le lieu
suit donc l'historique de messages sélectionné et le swipe.

### Mettre une destination explicite en attente

Sélectionner une destination met un déplacement en attente ; le déplacement
n'est pas immédiat. Il est validé par le message suivant que tu envoies, ce qui
garde le lieu et le tour synchronisés.

Les destinations accessibles en un déplacement sont :

- le parent du lieu actuel ;
- les enfants actifs du lieu actuel ;
- les lieux reliés par un lien direct disponible.

Un seul pas hiérarchique peut être validé par tour. Utilise la croix sur la
destination en attente pour l'annuler. Si la révision de la carte ou le lieu
actuel change avant l'envoi, le déplacement en attente passe en **Needs review**
(à vérifier).

### Planifier un itinéraire sur plusieurs tours

Sélectionne un lieu actif éloigné sur la carte du monde. Si le graphe des
relations parent/enfant et des liens disponibles contient un chemin, Maps
affiche l'itinéraire le plus court et propose **Plan route** (planifier
l'itinéraire).

Un itinéraire met son premier pas en attente. Chaque tour suivant valide un pas
et met le suivant en attente, jusqu'à la cible. Tu peux annuler l'itinéraire à
tout moment. Si la carte ou le lieu actuel change de façon inattendue,
l'itinéraire passe en **Needs review** au lieu de deviner un nouveau chemin.

Par exemple, aller de Floor 1 à Floor 25, son voisin, demande normalement un
tour pour sortir vers la tour et un autre pour entrer dans Floor 25. Un lien
direct peut réduire ce trajet à un seul pas.

### Suivre un voyage narré et découvrir de nouveaux lieux

Le modèle reçoit des instructions encadrées pour les arrivées accomplies :

- Si la réponse arrive réellement dans un lieu connu et actif, Maps peut y
  déplacer le lieu actuel. Si l'histoire a révélé un nouveau chemin, Maps
  enregistre une connexion directe disponible.
- Si la réponse arrive réellement dans un lieu durable encore inconnu, Maps peut
  l'ajouter comme enfant ou comme lieu connecté, s'y déplacer et conserver le
  chemin du retour.
- Les intentions, les simples mentions, les voyages ratés ou inachevés, les
  campements temporaires, les couloirs et les véhicules ne créent pas de lieu et
  ne déplacent pas le marqueur.

Par exemple, après un message de l'utilisateur disant "Let's get quests from the
Quest Hall", une réponse qui mène l'arrivée à son terme peut faire passer l'état
suivant de l'histoire à Quest Hall. "We should visit the Quest Hall later" doit
laisser le lieu actuel inchangé.

Ce comportement est validé par l'application, mais c'est encore au modèle
d'identifier que l'arrivée a bien eu lieu. Utilise **Set destination** (définir
la destination) quand tu as besoin d'un déplacement certain.

### Voyager en Roleplay

Le contrôle **Story location** (lieu de l'histoire) apparaît au-dessus de la
zone de saisie du message.

1. Ouvre la carte de l'histoire pour examiner la hiérarchie et le fil d'Ariane du moment.
2. Sélectionne un lieu pour lire sa description.
3. Utilise **Explore inside** (explorer à l'intérieur), **Browse up** (remonter)
   ou le fil d'Ariane pour parcourir la carte sans te déplacer.
4. Clique sur **Set destination** pour un lieu accessible, ou sur **Plan route**
   pour une cible éloignée mais atteignable.
5. Envoie le message suivant pour valider le pas en attente.

### Voyager en Game

Game Mode ajoute une **Hierarchical world map** (carte hiérarchique du monde).
La mention **You are here** (tu es ici) signale le lieu d'histoire actuel.
Parcourir, recentrer et examiner ne déplacent pas l'équipe. Mets une destination
ou un itinéraire en attente, puis envoie le tour de Game suivant.

La réponse générée par Game peut elle aussi mettre à jour le lieu hiérarchique
après une arrivée narrée jusqu'au bout. Les détails du lieu actuel ancrent alors
le GM (le maître du jeu), l'équipe, l'art de la scène et la référence de
Storyboard éligible.

## Carte hiérarchique du monde ou carte de Game classique

Une partie Game peut contenir deux systèmes de carte :

- **World Maps** porte le lieu d'histoire ou de monde faisant autorité,
  par exemple `The Shattered Coast → Brinewatch → Tideglass Inn`.
- Une carte de Game classique, en grille ou en nœuds, décrit le détail local ou
  tactique à l'intérieur de ce lieu d'histoire, et participe aussi au temps et à
  la météo de Game.

Quand World Maps prend en charge le démarrage de Game, c'est son modèle
sélectionné ou son brouillon vérifié qui fournit le monde de départ. La carte de
Game classique n'est réutilisée ni comme entrée de prompt, ni comme hiérarchie
de repli.

Pour les configurations avancées, un lieu hiérarchique peut être lié à une carte
de Game entière, à une case de grille ou à un nœud. Sélectionner une position de
Game liée prépare le déplacement hiérarchique correspondant ; les positions non
liées gardent leur comportement tactique normal. Enregistre la hiérarchie avant
de modifier les liaisons. Supprimer une liaison ne supprime aucune des deux cartes.

## Donner une identité visuelle aux lieux

Les références de lieu et les arrière-plans de carte d'enfants sont
indépendants, même quand ils réutilisent la même image de la galerie.

| Illustration                 | Rôle                                                                                                                    | Envoyée à la génération d'images ?                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Location reference image** | Ancre l'identité visuelle du lieu actuel exact. Choisis-la dans la galerie ou crée-la avec l'IA.                         | Oui, quand **Use for Roleplay illustrations and Game storyboards** est activé et que la demande est éligible. |
| **Child map background**     | Apparaît derrière les lieux enfants déplaçables d'un parent en présentation Map. Chaque couche de carte a le sien.      | Non. Uniquement pour l'affichage.                                                                          |

Les références de personnage ou de persona conservent qui est présent ; la
référence de lieu conserve où se déroule la scène. Quand le fournisseur le
permet, les combiner aide à garder les personnages et les arrière-plans
cohérents d'une image à l'autre.

Le pipeline d'images ajoute cette instruction quand une référence de lieu
éligible est jointe :

> Location handling: an attached location reference image is available. Use it
> to set the scene location.

Chaque fournisseur a ses propres limites d'images de référence. Les références
demandées explicitement et les références de personnage peuvent réduire le
nombre de références automatiques qui tiennent encore.

### Définir une référence de lieu

Sélectionne un lieu dans l'éditeur et ouvre **Location reference image** (image
de référence du lieu).

- **Choose from Gallery** (choisir dans la galerie) attribue une image existante
  déjà validée.
- **Create with AI** ouvre un prompt d'image d'ambiance modifiable et enregistre
  le résultat dans la galerie avant que tu décides de l'utiliser ou non.
- **Use for Roleplay illustrations and Game storyboards** (utiliser pour les
  illustrations Roleplay et les storyboards de Game) détermine si l'image
  sélectionnée participe aux générations éligibles.

Pour un parent en présentation Map, ouvre séparément **Child map background**
(arrière-plan de la carte d'enfants). Choisis une image de la galerie, puis
place-la derrière les marqueurs des enfants. Cette image n'est jamais envoyée à
un fournisseur du simple fait qu'elle s'affiche sur la carte.

### Générer par lots les illustrations de lieu manquantes

La section **Location artwork** de l'éditeur repère les lieux dépourvus de
référence ou d'arrière-plan de carte d'enfants.

1. Clique sur **Review requests** (examiner les demandes).
2. Vérifie le nombre de demandes avant de consommer des requêtes chez le fournisseur.
3. Contrôle la connexion d'images, le modèle, le style **Engine**, l'état du
   style d'art de campagne, les instructions d'image enregistrées et la taille de sortie.
4. Modifie chaque prompt positif et négatif si besoin.
5. Annule la revue, ou clique sur **Generate N images** (générer N images) pour confirmer.
6. Examine les illustrations générées dans la carte de travail et clique sur **Save**.

Chaque image manquante représente une requête distincte chez le fournisseur. Les
grands mondes peuvent être lents ou coûteux : la revue reste donc défilable et
garde le nombre de demandes sous les yeux. Une illustration existante est
réutilisée sans nouvelle requête quand c'est possible. Une nouvelle image
devient la référence du lieu, ainsi que l'arrière-plan de la carte d'enfants
quand cette carte en a besoin.

Ce sont les prompts positifs et négatifs exactement tels qu'affichés dans la
revue, modifications comprises, qui partent chez le fournisseur. Le contenu du
prompt positif n'est pas recopié dans le prompt négatif.

## Personnaliser le prompt d'illustration automatique

Ouvre **Settings → Generations → Prompt Overrides** (Paramètres → générations →
redéfinitions de prompt) et sélectionne **Maps location artwork**. C'est le
modèle global utilisé par Maps pour prévisualiser et générer les illustrations
de lieu automatiques. Les variables s'écrivent avec la syntaxe
`${variableName}` et s'insèrent depuis l'éditeur.

| Variable                                            | Signification                                              |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `${locationName}`                                   | Nom du lieu                                                |
| `${locationDescription}`                            | Description publique du lieu exact                         |
| `${locationType}`                                   | Region, Settlement, Place, Building, Floor ou Room         |
| `${locationPrompt}`                                 | Prompt d'ambiance de repli complet, préparé par Maps       |
| `${parentLocationName}`                             | Nom du parent direct, ou vide à la racine                  |
| `${parentLocationDescription}`                      | Description publique du parent direct, ou vide             |
| `${locationPath}`                                   | Fil d'Ariane complet, de la racine au lieu                 |
| `${genre}` / `${genreLine}`                         | Genre de Game brut ou ponctué ; vide hors de Game          |
| `${campaignArtStyle}` / `${campaignArtStyleLine}`   | Style de campagne, seulement si **Use campaign art style** est activé |
| `${imageInstructions}` / `${imageInstructionsLine}` | Instructions d'image brutes ou mises en forme, enregistrées dans **Chat Settings** |

Le modèle intégré reprend le prompt de lieu exact, plus le genre, le style de
campagne et les instructions d'image enregistrées, quand ils existent. Il
n'inclut volontairement ni la description du parent ni le chemin complet par
défaut, ce qui évite d'imposer un point de repère parent, une tour par exemple,
à toutes les images d'enfant ou d'étage.

Personnalisations fréquentes :

- Retire `${genreLine}` si le genre de Game ne doit pas apparaître dans les
  illustrations de carte automatiques.
- Ne garde `${campaignArtStyleLine}` que si l'interrupteur **Use campaign art
  style**, propre à chaque chat, doit piloter ce contenu. Quand l'interrupteur
  est désactivé, la variable est vide.
- N'ajoute `${parentLocationName}`, `${parentLocationDescription}` ou
  `${locationPath}` que si le fournisseur a besoin de ce contexte plus large.
- Utilise **Reset to default** (rétablir la valeur par défaut) pour retrouver le
  modèle intégré.

Le profil de style **Engine** et les réglages d'image positifs et négatifs
globaux s'appliquent après ce modèle. Ils restent liés au workflow d'images et
d'illustration partagé, ce ne sont pas des réglages propres à Maps. S'il reste
du texte inattendu dans le prompt négatif, examine le réglage d'image négatif
global ainsi que le champ modifiable de la revue.

## Rattacher du lore aux lieux

World Maps se sert du lore de deux façons :

1. Le constructeur par IA peut lire les lorebooks sélectionnés pendant qu'il
   rédige ou étend une carte.
2. Un lieu enregistré peut activer des entrées tant que ce lieu exact est le lieu actuel.

Pour rattacher du lore à l'exécution, sélectionne le lieu, ouvre **Linked lore**
(lore rattaché), cherche parmi les entrées disponibles, rattache celles que tu
veux et enregistre.

Les entrées rattachées ne passent pas du parent à l'enfant. Le lore rattaché à
Brinewatch ne s'active pas à Tideglass Inn s'il n'y est pas rattaché lui aussi.

Le lore du lieu actuel n'a pas besoin d'une correspondance de mot-clé, mais il
ne contourne pas pour autant les réglages des lorebooks. Les livres et les
entrées désactivés ou exclus du chat restent indisponibles, et les conditions,
le moment, la probabilité et les budgets de tokens des entrées continuent de
s'appliquer. Les références manquantes restent visibles dans l'éditeur, ce qui
permet de les réparer ou de les détacher.

## Réglages de prompt avancés pour Maps

La page principale **Agents → World Maps** porte deux systèmes de prompt globaux :

- **Generation prompt** (prompt de génération) est une bibliothèque nommée,
  commune à Roleplay et Game, pour les brouillons et extensions de carte par
  l'IA. Chaque chat y sélectionne une option de façon indépendante. L'aperçu
  résolu utilise la configuration, les personnages, le lore et le contexte de
  carte en direct, sans envoyer de requête au modèle.
- **Turn prompt insert** (insert de prompt de tour) pilote le texte système
  global de Roleplay et Game qui présente le lieu actuel pendant les tours
  ordinaires. Marinara conserve autour de lui l'encapsulation
  `<spatial_context>`, qui appartient à l'application, ainsi que les variables
  d'autorité obligatoires.

Le champ **Connection Override** (redéfinition de la connexion) de la même page
agit sur les brouillons et extensions de carte par l'IA. Laisse-le vide pour
utiliser la connexion du chat en cours. Ces réglages ne remplacent pas la
redéfinition **Maps location artwork**, distincte, qui se trouve dans les
réglages de génération globaux.

Ces contrôles s'adressent à la personnalisation avancée. Conserve les variables
obligatoires et sers-toi des aperçus résolus avant d'enregistrer.

## Importer, exporter et archiver sans risque

Utilise **Export** pour télécharger la hiérarchie de travail sous forme de
fichier `.world-map.json`. Laisse **Include map artwork** activé pour regrouper
dans le même fichier les images de référence des lieux et les arrière-plans des
cartes d'enfants. Désactive cette option pour obtenir une sauvegarde plus petite,
limitée à la définition. Les anciens fichiers `.hierarchical-map.json` restent
importables.

Utilise **Import** pour charger une hiérarchie dans la copie de travail. Les
illustrations regroupées sont restaurées dans la Gallery du chat de destination
et leurs liens d'image sont remappés. Vérifie le résultat, puis clique sur
**Save** pour le rendre officiel. L'import n'enregistre rien tout de suite.

Dès que l'historique de campagne renvoie à une carte, les modifications
importées doivent conserver les identifiants de lieu existants. Ajoute ou mets à
jour des lieux au lieu de remplacer la hiérarchie par des identifiants sans rapport.

L'archivage préserve les anciennes références. Avant d'archiver un lieu :

- déplace ou archive ses enfants actifs ;
- choisis un autre lieu de départ actif si nécessaire ;
- choisis un remplaçant actif s'il s'agit du lieu actuel à l'exécution.

Les lieux archivés se restaurent depuis le panneau **Details**.

## Dépannage

### World Maps n'apparaît pas dans Chat Settings

Vérifie que le package est installé et que Marinara a bien été redémarré. Le
chat actif doit être un chat Roleplay ou Game. Active **Enable Agents**, puis
active **World Maps** sous **Tracker Agents**.

### Add to chat n'apparaît pas dans la bibliothèque de modèles

Ouvre un chat Roleplay ou Game pris en charge avant d'ouvrir la bibliothèque. La
bibliothèque affiche **Add to chat** aussi bien depuis la page World Maps
principale que depuis les réglages de ce chat. Pendant la configuration de Game,
l'action équivalente est **Use template**.

### La configuration de Game a utilisé les mauvais lieux ou des lieux de repli

Choisis **Use template**, sélectionne un modèle concret dans le sélecteur et
confirme-le avant de terminer la configuration de Game. Vérifie la copie de
travail appartenant à la partie Game et enregistre-la. Le modèle du compte reste inchangé.

### La carte ne peut pas être activée

Crée au moins un lieu actif et définis un lieu de départ actif. Résous tous les
problèmes affichés en haut de l'éditeur, puis active et enregistre à nouveau.

### La génération de carte par l'IA est indisponible

Vérifie que le chat ou le champ **Connection Override** de Maps dispose d'une
connexion à un modèle de langage qui fonctionne. Enregistre ou abandonne les
modifications en cours dans l'éditeur avant de rouvrir le constructeur par IA.
Pour une extension, choisis une cible active. Pour une génération ancrée dans le
lore, sélectionne au moins un lorebook activé et non exclu.

### Le lieu actuel n'a pas suivi un message

Le déplacement automatique exige que la réponse générée mène une arrivée à son
terme et produise une directive Maps cachée valide. Une intention, une
discussion, un voyage raté ou un lieu de passage ne déplacent pas le marqueur.
Utilise **Set destination** pour un déplacement certain au tour suivant.

### Une destination ou un itinéraire affiche Needs review

La révision de la carte ou le lieu actuel a changé après la mise en attente du
déplacement. Ouvre la carte de l'histoire, vérifie le chemin actuel et
sélectionne à nouveau la destination ou l'itinéraire.

### Un lieu éloigné ne peut pas être sélectionné

Utilise **Plan route** s'il existe un chemin actif de type parent, enfant ou
lien. Sinon, ajoute un lien direct disponible ou voyage de lieu accessible en
lieu accessible, un tour à la fois. Les contrôles de navigation ne déplacent
jamais l'histoire.

### Le prompt d'illustration automatique inclut toujours le genre de Game

Ouvre **Settings → Generations → Prompt Overrides → Maps location artwork** et
retire `${genreLine}` du modèle. Enregistre la redéfinition, puis rouvre la
revue des illustrations.

### Le style de campagne apparaît alors qu'il devrait être désactivé

Vérifie **Chat Settings → Illustrator → Use campaign art style**. Quand cet
interrupteur est désactivé, `${campaignArtStyle}` et `${campaignArtStyleLine}`
se résolvent en chaîne vide. Le récapitulatif de la revue doit indiquer le style
d'art de campagne sur **Off**.

### Un point de repère parent apparaît sur toutes les images d'enfant

Évite `${parentLocationDescription}` et `${locationPath}` dans le modèle
d'illustration global, sauf s'ils sont indispensables. Le prompt de lieu par
défaut est limité au lieu exact et laisse de côté ces champs trop larges.

### Le prompt d'image négatif contient des éléments inattendus

Examine et modifie le champ négatif avant de confirmer. Inspecte ensuite le
réglage d'image négatif global, qui est partagé. Le modèle d'illustration de
Maps construit le prompt positif ; celui-ci n'est pas recopié dans le champ négatif.

### Une référence de lieu n'est pas utilisée dans les images ou les Storyboards

Vérifie que l'image de la galerie existe toujours et que **Use for Roleplay
illustrations and Game storyboards** est activé sur le lieu actuel exact.
L'arrière-plan de la carte d'enfants sert uniquement à l'affichage et ne peut
pas remplacer une référence, sauf si la même image de la galerie est aussi
attribuée comme référence de lieu.

### Le modèle ignore la carte

Vérifie que World Maps est actif pour le chat, que la hiérarchie est bien
sur **Enabled**, que les dernières modifications ont été enregistrées et qu'un
lieu actuel apparaît dans le contrôle **Story location**. Pour un diagnostic
avancé, sers-toi de l'aperçu résolu de **Turn prompt insert**.

### Le lore rattaché ne s'active pas

Vérifie que l'entrée est bien rattachée au lieu actuel exact. Contrôle que
l'entrée et le lorebook sont activés, et que le lorebook n'est pas exclu du chat.

## Guides associés

- [Agents : des aides IA pour tes chats](agents-overview.md)
- [Référence des agents téléchargeables](built-in-agents.md)
- [Lorebooks](../lorebooks/overview.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Game Mode : carte, temps et météo](../game/map-time-weather.md)
