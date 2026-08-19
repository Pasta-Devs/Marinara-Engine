# World Maps : installation, création et déplacements

> **Compatibilité actuelle :** ce guide correspond à World Maps **1.3.1**. Le
> package prend en charge Marinara Engine **2.3.5 à 3.x** et fonctionne avec les
> chats Roleplay et Game. Marinara Engine **2.4.1** ajoute le nettoyage coordonné
> du flux des déplacements et l'actualisation immédiate de Lorebooks après les
> imports portables. Engine **2.3.5 à 2.4.0** reste compatible, mais impose une
> actualisation manuelle de Lorebooks après import et n'inclut pas ce nettoyage.

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
lore éligible qui y est rattaché peuvent ancrer la réponse suivante. Maps peut
aussi suivre un déplacement explicite ou une découverte établis par le dernier
message de l'utilisateur. La narration visible de l'IA peut en décrire le
résultat, mais elle ne peut ni déplacer la carte ni inventer des lieux toute
seule.

Les cartes peuvent être indépendantes dans chaque chat, ou reliées à un même
monde partagé appartenant au compte. Les modèles créent des copies propres qui
peuvent ensuite diverger. Un monde partagé conserve au contraire une seule
hiérarchie canonique et un seul jeu d'illustrations, tandis que chaque chat relié
garde son lieu actuel, son historique de déplacements, ses instantanés et ses
liaisons avec Game.

## Ce que propose la fonctionnalité

World Maps 1.3.1 apporte :

- des régions, agglomérations, lieux, bâtiments, étages et pièces imbriqués ;
- des fils d'Ariane et un lieu d'histoire actuel qui fait autorité ;
- des vues en liste, en carte positionnée et en couches ordonnées pour les lieux enfants ;
- les déplacements parent/enfant, les liens directs et la planification d'itinéraires sur plusieurs tours ;
- des déplacements et des découvertes validés, établis par le dernier message de l'utilisateur ;
- des mondes partagés appartenant au compte, reliables à plusieurs chats Roleplay et Game ;
- des brouillons par chat, avec revue, et des commandes de publication, d'abandon, de conflit et de détachement ;
- des modèles de carte valables pour tout le compte, créés à la main, avec l'IA ou par import ;
- des brouillons et extensions de carte assistés par l'IA, ancrés dans la configuration ou le lore sélectionné ;
- des descriptions de lieu publiques, une mémoire privée pour le modèle et du lore attaché au lieu exact ;
- une image de référence facultative pour chaque lieu, prise dans la galerie du chat ou dans la galerie globale ;
- un arrière-plan distinct, pris dans la galerie du chat ou dans la galerie globale, pour chaque carte d'enfants positionnée ;
- une génération par lots, avec revue, des illustrations de lieu manquantes ;
- une redéfinition globale du prompt d'illustration des cartes, à base de variables ;
- la prise en charge de la référence de lieu pour les illustrations Roleplay et les Storyboards de Game ;
- l'import, l'export, l'archivage, l'édition respectueuse de l'historique et les liaisons avec la carte de Game ;
- des bibliothèques de prompts globales pour la construction de cartes par l'IA et pour l'insert de lieu à l'exécution.

Les destinations disponibles font partie du contexte envoyé au modèle. Quand les
choix CYOA sont activés, le modèle peut donc proposer comme options suivantes les
enfants du lieu actuel ou les lieux connectés. Les choix exacts, eux, restent
générés par le modèle.

## Choisir la bonne relation de carte

La bibliothèque contient deux ressources réutilisables appartenant au compte,
tandis que chaque chat garde son propre lieu et son propre historique à
l'exécution. Le nom lisible d'une ressource n'est pas son identité : World Maps
1.3.1 ajoute **(copy)** ou un numéro quand une ressource tout juste enregistrée
porterait sinon le même nom.

| Ressource ou état                     | Appartient à                          | À choisir quand                                                                                     | Ce que les modifications ultérieures touchent                     |
| ------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Carte de chat indépendante**        | Un seul chat Roleplay ou Game         | Cette histoire doit avoir son propre monde                                                          | Ce chat uniquement                                                 |
| **Modèle indépendant**                | Ton compte                            | Tu veux un point de départ réutilisable                                                             | Les nouvelles copies seulement ; les chats existants ne changent pas |
| **Monde partagé canonique**           | Ton compte                            | Plusieurs chats doivent lire une même hiérarchie entretenue                                         | La définition partagée que lisent les chats reliés                 |
| **Brouillon de chat relié**           | Un chat relié, jusqu'à la publication | Une histoire reliée a découvert ou modifié quelque chose qui a peut-être sa place dans le monde partagé | Aucun autre chat tant que tu n'as pas choisi **Publish** (publier) |
| **Copie indépendante détachée**       | Un chat autrefois relié               | Cette histoire doit garder sa carte actuelle sans recevoir les modifications du monde partagé       | Le chat détaché uniquement                                         |

Copier n'est pas relier. Les commandes **Use template**, **Add to chat** et
**Independent copy** créent des cartes distinctes. **Use shared world**
(utiliser un monde partagé) pendant la configuration de Game et **Link to chat**
dans la bibliothèque rattachent le chat au monde partagé canonique.

## Démarrage rapide

1. Ouvre la page **Agents**, clique sur **Download Agents** (télécharger des agents) et installe **World Maps**.
2. Redémarre Marinara quand l'application te le demande. Le package contient du code serveur.
3. Ouvre un chat Roleplay ou Game.
4. Ouvre le globe **World Maps** dédié si ta version de Marinara Engine le
   propose, ou passe par **Agents → World Maps**, puis active-le pour le chat en
   cours. Tu peux aussi l'activer depuis la section **Chat Settings → Agents**
   (réglages du chat) de ce chat.
5. Crée la carte avec **Use template** (utiliser un modèle), **Create with AI**
   (créer avec l'IA) ou **Build manually** (construire à la main). Les chats
   existants peuvent aussi importer un fichier de carte.
6. Vérifie la hiérarchie de travail, choisis un lieu de départ, active la carte
   et clique sur **Save** (enregistrer).
7. Ouvre la **Story map** (carte de l'histoire) pendant le chat. Sélectionne une
   destination accessible et envoie le tour suivant, ou établis directement le
   déplacement de l'équipe dans ton message : Maps peut alors valider et
   appliquer l'arrivée.
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
disponibilité, donne accès à la bibliothèque de cartes du monde du compte, nomme
le chat actuellement ciblé et affiche l'état de la carte de ce chat. Installer le
package le rend disponible, mais ne l'active pas dans tous les chats.

### Roleplay

1. Ouvre le chat Roleplay.
2. Ouvre **Chat Settings** avec le bouton en forme d'engrenage.
3. Active **Enable Agents** (activer les agents).
4. Sous **Tracker Agents** (agents de suivi), active **World Maps**.
5. Ouvre **Edit world map** (modifier la carte du monde) ou la
   bibliothèque **World map library** (bibliothèque de cartes du monde). Sur les
   versions de Marinara Engine compatibles, le globe de la barre supérieure sur
   ordinateur ouvre la même bibliothèque ; sur mobile, sers-toi du globe dans le
   panneau latéral **Chats**.

La bibliothèque se comporte de la même façon, qu'elle soit ouverte depuis la
page **Agents** principale ou depuis les **Chat Settings** du Roleplay. Utilise
**Add to chat** (ajouter au chat) pour obtenir une copie de modèle indépendante,
ou **Link to chat** (relier au chat) pour un monde partagé durable.

### Game

Pendant la configuration de Game, choisis World Maps, puis sélectionne
l'une de ses voies de configuration :

- **Create with AI** prépare une hiérarchie générée, prête à être vérifiée.
- **Use template** ouvre la bibliothèque de mondes avant la création de la partie Game.
- **Build manually** démarre sur une hiérarchie vierge et modifiable.

Après avoir choisi **Use template**, le sélecteur affiche d'abord
**Shared worlds**, puis **Independent templates** (modèles indépendants) :

- **Use shared world** relie la nouvelle partie Game à ce monde canonique
  appartenant au compte. La partie Game garde malgré tout son propre lieu
  actuel, son historique, ses instantanés, ses liaisons et ses découvertes non
  publiées.
- **Use template** crée une copie de travail appartenant à la partie Game, pour
  que tu la vérifies. Elle ne modifie jamais le modèle du compte.

Les lieux de la ressource sélectionnée deviennent le monde de départ
hiérarchique. Aucune carte de Game classique de repli ne vient prendre sa place.

Autre option : ajouter World Maps plus tard à une partie Game existante
depuis **Chat Settings → Agents**.

## Créer et réutiliser des modèles de carte

Ouvre **World Maps → Open world library** (ouvrir la bibliothèque de mondes).
Les modèles appartiennent au compte et non à un seul chat : ils
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

Les modèles conservent des références vers les illustrations de la galerie
globale, valables pour tout le compte. Quand tu utilises **Save as template**
(enregistrer comme modèle) depuis un chat, Maps fait passer dans la galerie
globale les illustrations du chat référencées, et réutilise une image partagée
identique quand il en existe déjà une. Chaque chat qui applique le modèle pointe
alors vers la même illustration partagée, sans créer une copie de plus dans la galerie.

Seules les illustrations sont partagées. Chaque définition de carte appliquée
reste une copie de travail indépendante : modifier le modèle ne met pas à jour les cartes déjà ajoutées à des chats.

## Relier plusieurs chats à un même monde partagé

Utilise **Shared worlds** (mondes partagés) dans la bibliothèque de cartes du
monde quand plusieurs chats Roleplay ou Game doivent lire la même hiérarchie
canonique. Crée un monde partagé vide, importes-en un, transforme un modèle
existant avec **Make shared** (rendre partagé), ou ouvre une carte de chat
enregistrée et choisis **Make shared**. Cette dernière option fait passer les
illustrations du chat référencées dans la galerie globale, crée le monde
appartenant au compte, puis y relie le chat d'origine.

Choisis **Link to chat** pour y rattacher le chat indiqué par la bibliothèque
comme chat ciblé. Le lieu actuel et tous les identifiants de lieu déjà utilisés
par l'historique de campagne doivent exister dans le monde partagé. Sinon,
utilise **Independent copy** (copie indépendante), ou commence par migrer la
carte actuelle du chat vers un nouveau monde partagé.

Les chats reliés ne partagent que la définition de la carte et les illustrations
de la galerie globale. Ils ne partagent ni les messages, ni les lieux actuels,
ni les instantanés de déplacement, ni l'état du jeu, ni les liaisons avec la
carte de Game, ni les connexions aux fournisseurs, ni les identifiants.

Les modifications et les découvertes faites dans un chat relié sont enregistrées
comme un brouillon non publié, propre à ce chat. Elles ne changent ni le monde
canonique ni les autres chats tant que tu n'as pas choisi **Publish**. Autre
option : **Discard** (abandonner) jette le brouillon, et **Detach and keep copy**
(détacher en gardant une copie) met fin au partage en laissant au chat sa version
du moment. Si le monde canonique change alors qu'un brouillon est en attente,
Maps signale un conflit et impose un détachement ou un abandon, plutôt que
d'écraser une version en silence.

Modifier un monde partagé depuis la bibliothèque met à jour directement la
définition canonique. L'éditeur de monde partagé ne propose pas de suppression
définitive des lieux : archive-les pour que leurs identifiants stables restent
disponibles. Un chat relié ne peut pas non plus supprimer définitivement un lieu
tant que tu n'as pas choisi **Detach and keep copy**. Un monde partagé lui-même
ne peut pas être supprimé tant que tous les chats reliés ne sont pas détachés ou
reliés ailleurs.

Les mondes partagés et les modèles conservent des références vers les
illustrations de la galerie globale, sans copier le fichier image dans chaque
chat. Marinara empêche la suppression d'une image de la galerie globale tant
qu'un modèle enregistré, un monde partagé, une carte de chat indépendante ou le
brouillon d'un chat relié y renvoie encore. Retire d'abord ces liens quand tu
veux vraiment supprimer le fichier lui-même.

## Détacher, remplacer ou repartir de zéro

Ces actions répondent à des questions différentes :

- Pour mettre fin au partage en conservant la hiérarchie actuelle du chat relié,
  enregistre ou abandonne les modifications en cours dans l'éditeur, puis
  choisis **Detach and keep copy**. Le chat devient indépendant et ne reçoit
  plus les mises à jour canoniques.
- Pour rester en partage tout en changeant de monde canonique, ouvre la
  bibliothèque de mondes pour le chat ciblé indiqué, puis choisis
  **Link to chat** sur le monde de remplacement. Les vérifications de
  compatibilité avec l'historique s'appliquent toujours.
- Pour remplacer la carte d'un chat indépendant, ouvre son éditeur et choisis
  **Replace / start over** (remplacer ou repartir de zéro). Tu peux d'abord
  enregistrer un modèle ou exporter une sauvegarde, puis choisir
  **Create with AI**, **Use template or shared world**, **Import map file** ou
  **Start blank**.
- Pour donner à un chat une carte sans rapport, utilise le même parcours de
  remplacement. Retirer puis remettre l'agent ne réinitialise pas la carte.

Un remplacement reste une copie de travail tant que tu n'as pas cliqué sur
**Save**. Enregistrer un remplacement annule la destination ou l'itinéraire en
attente. Dès que l'historique des messages renvoie à des identifiants de lieu,
Maps peut refuser un remplacement sans rapport pour préserver les fils d'Ariane
historiques. Dans ce cas, garde une copie indépendante et étends ou archive la
carte existante.

## Comprendre l'éditeur de carte

Sur ordinateur, l'éditeur affiche trois panneaux. Sur un écran étroit, passe
d'un onglet à l'autre entre **Hierarchy** (hiérarchie), **Local** (local) et
**Details** (détails).

- **Hierarchy** affiche l'arbre complet. Sélectionner un lieu permet de le
  modifier. Le bouton **Enter** (entrer) change la partie de la hiérarchie
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

Pour une tour de 25 étages, modélise normalement les étages comme des lieux
frères sous une même tour, plutôt qu'en une chaîne de parents profonde de 25
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

Sur une carte vide, clique sur **Build manually**. Maps crée un premier lieu de
départ très général. Sélectionne-le dans la hiérarchie, puis utilise :

- **Add child** (ajouter un enfant) pour un lieu situé à l'intérieur du lieu sélectionné ;
- **Add sibling** (ajouter un frère) pour un lieu placé à côté, sous le même parent ;
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
le modèle, plutôt que de compter sur ce seul résumé.

## Se déplacer pendant une histoire

Maps prend en charge les voyages mis en attente, les itinéraires planifiés et
les arrivées validées menées par l'utilisateur. Le déplacement est enregistré
avec le tour : le lieu suit donc l'historique de messages sélectionné et le
swipe. Redémarrer Marinara n'est pas censé réinitialiser le lieu actuel ; passer
à une autre branche de messages ou à un autre swipe restaure l'instantané
spatial enregistré avec cet historique sélectionné.

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

Un itinéraire met son premier pas en attente. Chaque tour que tu envoies ensuite
valide un pas et met le suivant en attente, jusqu'à la cible ; il n'existe pas
de bouton d'avance séparé. Tu peux annuler l'itinéraire à tout moment. Si la
carte ou le lieu actuel change de façon inattendue, l'itinéraire passe en
**Needs review** au lieu de deviner un nouveau chemin.

Par exemple, aller de Floor 1 à Floor 25, son lieu frère, demande normalement un
tour pour sortir vers la tour et un autre pour entrer dans Floor 25. Un lien
direct peut réduire ce trajet à un seul pas.

### Suivre les déplacements menés par l'utilisateur et découvrir de nouveaux lieux

Le dernier message de l'utilisateur fait autorité pour les changements
automatiques de carte :

- Un déplacement direct de l'équipe suivie par l'histoire, au présent ou à
  l'impératif, établit l'arrivée. "We go to the Kitchen" ou "She moves into the
  outdoor section; we follow her" peuvent mener vers les lieux connus
  correspondants.
- L'arrivée explicite dans un lieu marquant, nommé, durable et où l'on peut
  revenir, ou sa découverte, peut l'ajouter au monde. "We discover a hidden
  room" peut créer ce lieu et y entrer.
- La réponse visible peut en raconter la conséquence, mais la narration de l'IA
  seule n'autorise jamais un déplacement ni un nouveau lieu.
- Les intentions futures, les voyages ratés ou inachevés, les simples mentions,
  les déplacements de PNJ seuls, les lieux imaginaires, les campements
  temporaires, les couloirs, les véhicules et les autres détails passagers ne
  créent ni ne déplacent aucun lieu.

Le modèle doit encore interpréter la formulation de l'utilisateur et produire
une directive Maps cachée, que l'application valide. Les modèles de langage ne
réagissent pas tous pareil à une prose ambiguë. Utilise **Set destination**
(définir la destination) pour un déplacement certain au tour suivant, ou
**Set current story location** (définir le lieu d'histoire actuel) pour corriger
un état déjà enregistré.

Une arrivée validée menée par l'utilisateur peut contourner la règle du pas
unique : Maps enregistre au besoin un lien direct disponible depuis le lieu
actuel. Si une destination était déjà en attente, ce déplacement est d'abord
enregistré avec le message de l'utilisateur, puis l'arrivée menée par
l'utilisateur devient le lieu final sur la réponse de l'assistant ; la
destination à usage unique est effacée. Sur un itinéraire planifié, une arrivée
au pas prévu fait avancer l'itinéraire normalement. Une arrivée ailleurs, y
compris un saut vers un pas plus lointain, place l'itinéraire en
**Needs review** : Maps ne réécrit pas le plan en silence. Annule ou replanifie
cet itinéraire depuis le lieu actuel qui en résulte.

### Lieu de départ ou lieu d'histoire actuel

Le **lieu de départ** est le lieu par défaut au début d'une nouvelle histoire.
Le **lieu d'histoire actuel** est l'endroit où se trouve ce chat précis en ce
moment. Changer le lieu de départ ne répare pas la position actuelle d'un chat
existant.

Pour corriger un état enregistré, sélectionne un lieu actif dans le panneau
**Details** de l'éditeur et choisis **Set current story location**. C'est une
correction administrative, pas un voyage narré. Elle prend effet quand tu
cliques sur **Save**, annule la destination ou l'itinéraire en attente, et ne
réécrit pas les messages précédents.

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

Quand le dernier message de l'utilisateur établit l'arrivée de l'équipe, la
réponse générée par Game peut émettre la commande cachée qui met à jour le lieu
hiérarchique. Les détails du lieu actuel ancrent alors le GM (le maître du jeu),
l'équipe, les illustrations de la scène et la référence de Storyboard éligible.

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
| **Location reference image** | Ancre l'identité visuelle du lieu actuel exact. Choisis une illustration du chat ou de la galerie globale partagée, ou crée-la avec l'IA. | Oui, quand **Use for Roleplay illustrations and Game storyboards** est activé et que la demande est éligible. |
| **Child map background**     | Apparaît derrière les lieux enfants déplaçables d'un parent en présentation Map. Chaque couche de carte peut avoir le sien. | Non. Uniquement pour l'affichage.                                                                          |

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

- **Choose artwork** (choisir une illustration) attribue une image déjà validée,
  prise dans le chat en cours ou dans la galerie globale partagée. Le sélecteur
  indique la source de chaque image.
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
grands mondes peuvent être lents ou coûteux : la revue peut donc défiler
entièrement et garde le nombre de demandes sous les yeux. Une illustration
existante est réutilisée sans nouvelle requête quand c'est possible. Une image
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
globaux s'appliquent après ce modèle. Ils font partie du workflow partagé de
l'agent **Illustrator** et de la génération d'images, ce ne sont pas des
réglages propres à Maps. S'il reste du texte inattendu dans le prompt négatif,
examine le réglage d'image négatif global ainsi que le champ modifiable de la
revue.

## Rattacher du lore aux lieux

World Maps se sert du lore de deux façons :

1. Le constructeur par IA peut lire les lorebooks sélectionnés pendant qu'il
   rédige ou étend une carte.
2. Un lieu enregistré peut activer des entrées tant que ce lieu exact est le lieu actuel.

Pour rattacher du lore à l'exécution, sélectionne le lieu, ouvre **Linked lore**
(lore rattaché), cherche parmi les entrées disponibles, rattache celles que tu
veux et enregistre.

Ouvrir une entrée de lorebook rattachée fait quitter l'éditeur de carte.
Enregistre d'abord la carte si tu veux garder les autres modifications en cours,
ou confirme en connaissance de cause qu'elles peuvent être abandonnées. World
Maps 1.3.1 prévient avant que cette action ne fasse perdre des modifications de
carte non enregistrées.

Les entrées rattachées ne passent pas du parent à l'enfant. Le lore rattaché à
Brinewatch ne s'active pas à Tideglass Inn s'il n'y est pas rattaché lui aussi.

Le lore du lieu actuel n'a pas besoin d'une correspondance de mot-clé, mais il
ne contourne pas pour autant les réglages des lorebooks. Les lorebooks et les
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

Ces réglages sont réservés à la personnalisation avancée. Conserve les variables
obligatoires et sers-toi des aperçus résolus avant d'enregistrer.

## Importer, exporter et archiver sans risque

### Exporter une carte portable

Utilise **Export** depuis un chat, un modèle ou l'éditeur d'un monde partagé pour
télécharger la hiérarchie sous forme de fichier `.world-map.json`. Avant le téléchargement, choisis la quantité de lore lié à emporter :

| Option de lore | Contenu du fichier |
| --- | --- |
| **Map only** | La hiérarchie et la provenance lisible entre lieux et lore, sans contenu des lorebooks. Les entrées manquantes ne peuvent pas être recréées. |
| **Map + linked entries** | Seulement les entrées liées par la carte et les chemins de dossiers nécessaires. C'est l'option portable recommandée. |
| **Map + complete lorebooks** | Toutes les entrées et tous les dossiers de chaque lorebook lié, y compris le contenu sans rapport avec la carte. |

Avant de partager, vérifie les lorebooks listés, le nombre d'entrées, la taille estimée et la correspondance dépliable entre lieux et lore. Les lorebooks complets peuvent contenir des notes privées ou sans rapport. Laisse **Include map artwork** activé pour regrouper
dans le même fichier les images de référence des lieux et les arrière-plans des
cartes d'enfants. Désactive cette option pour obtenir une sauvegarde plus petite,
et non plus seulement une sauvegarde de définition. Les anciens fichiers `.hierarchical-map.json` restent
importables.

### Importer une carte et restaurer son lore portable

Utilise **Import** pour charger une hiérarchie dans la copie de travail d'un
chat, un modèle indépendant ou un monde partagé. Si le fichier contient des lorebooks, **Restore portable map lore** affiche quatre groupes : **Exact IDs**, **Unique content**, **Need a choice** et **New entries**.

Un identifiant exact ne fait autorité que dans le lorebook de destination. Un identifiant provenant d'une autre source est ambigu : choisis la ligne précise `Lorebook → Entry (ID)` ou **Import a new copy**. Sans identifiant, World Maps ne réutilise une entrée que si l'intégralité de son contenu portable et de ses réglages n'a qu'une correspondance ; le nom seul ne suffit jamais.

Après la prévisualisation, choisis une stratégie globale :

- **Import separate copies** ne réutilise aucune entrée et crée des lorebooks indépendants comme `Original Lorebook - Map Name (World Map)`, avec **(copy)** ou **(copy N)** pour éviter les collisions.
- **Reuse matches & import the rest** conserve les correspondances exactes et uniques, applique tes choix ambigus et crée de nouveaux lorebooks uniquement pour le reste.

Maps liste ensuite les lorebooks réutilisés et créés. Les copies créées restent dans la bibliothèque même si la carte est supprimée. Engine **2.4.1** ou ultérieur actualise Lorebooks immédiatement ; avec **2.3.5 à 2.4.0**, actualise Marinara une fois après la restauration.

Les illustrations sont également restaurées et remappées. Celles du chat reviennent dans sa galerie ; les illustrations partagées sont réutilisées depuis la galerie globale ou y sont ajoutées une fois. Vérifie le résultat puis clique sur **Save**. L'import n'enregistre rien immédiatement. Un export **Map only** conserve la provenance lisible et les liens d'identifiants exacts existants, mais ne peut recréer un lorebook ou une entrée supprimés sans leur contenu.

Dès que l'historique de campagne renvoie à une carte, les modifications
importées doivent conserver les identifiants de lieu existants. Ajoute ou mets à
jour des lieux au lieu de remplacer la hiérarchie par des identifiants sans rapport.

### Archiver ou supprimer définitivement des lieux

L'archivage préserve les anciennes références. Avant d'archiver un lieu :

- déplace ou archive ses enfants actifs ;
- choisis un autre lieu de départ actif si nécessaire ;
- choisis un remplaçant actif s'il s'agit du lieu actuel à l'exécution.

Les lieux archivés se restaurent depuis le panneau **Details**. World Maps 1.3.1
propose aussi **Delete permanently** (supprimer définitivement) pour un lieu
archivé ou une branche entièrement archivée, quand le retrait ne pose pas de
risque. L'éditeur désactive cette action quand le lieu est le lieu de départ ou
le lieu d'histoire actuel enregistré, qu'il apparaît dans l'historique des
messages, qu'il porte une liaison avec la carte de Game, qu'il fait partie d'une
destination ou d'un itinéraire en attente, ou qu'il appartient à un chat encore
relié à un monde partagé. Les éditeurs de monde partagé et de modèle ne
proposent pas la suppression définitive des lieux. Résous d'abord la dépendance
signalée, détache le chat relié quand c'est pertinent, ou laisse le lieu archivé.

La suppression définitive retire le lieu du brouillon de travail et nettoie ses
références de hiérarchie et de liens directs quand tu cliques sur **Save**.
Fermer sans enregistrer annule quand même la suppression. Les lieux supprimés
n'apparaissent plus dans les exports ; les lieux archivés qui restent protégés
continuent d'être exportés, pour que leurs identifiants stables puissent
soutenir l'historique et les données liées. Ne modifie pas le JSON exporté pour
contourner ces protections.

## Dépannage

### World Maps n'apparaît pas dans Chat Settings

Vérifie que le package est installé et que Marinara a bien été redémarré. Le
chat actif doit être un chat Roleplay ou Game. Active **Enable Agents**, puis
active **World Maps** sous **Tracker Agents**.

### Add to chat ou Link to chat n'apparaît pas dans la bibliothèque de mondes

Ouvre un chat Roleplay ou Game pris en charge avant d'ouvrir la bibliothèque. La
bibliothèque nomme le chat ciblé et affiche **Add to chat** pour les modèles ou
**Link to chat** pour les mondes partagés. Pendant la configuration de Game, les
actions équivalentes sont **Use template** et **Use shared world**.

Si la bibliothèque liste des mondes partagés pendant la configuration de Game
sans afficher **Use shared world**, le navigateur fait peut-être encore tourner
un client de package antérieur à la mise à jour. Dans chaque éditeur de carte
ouvert, enregistre la carte ou abandonne son brouillon en connaissance de cause,
puis ferme l'éditeur. Enregistre le travail en cours ailleurs, actualise Marinara
une fois en vidant le cache, puis rouvre la configuration de Game. Les versions
récentes de Marinara Engine signalent explicitement quand une mise à jour de
package impose cette actualisation.

### La configuration de Game a utilisé les mauvais lieux ou des lieux de repli

Choisis **Use template**, puis confirme soit **Use template** pour une copie
indépendante, soit **Use shared world** pour un lien canonique, avant de terminer
la configuration de Game. Vérifie la carte de Game et enregistre-la. Un modèle
reste inchangé ; une partie Game reliée garde ses modifications non publiées tant
que tu n'as pas choisi **Publish**.

### Un chat relié affiche encore une ancienne version du monde partagé

Les éditeurs propres de chats reliés, mis en cache dans l'onglet où tu publies, s'actualisent automatiquement. Un chat avec des modifications non enregistrées ou non publiées conserve son brouillon et affiche un conflit. Rouvre les chats des autres onglets ou fenêtres pour charger la nouvelle version canonique.

### La carte ne peut pas être activée

Crée au moins un lieu actif et définis un lieu de départ actif. Résous tous les
problèmes affichés en haut de l'éditeur, puis active et enregistre à nouveau.

### La génération de carte par l'IA est indisponible

Vérifie que le chat ou le champ **Connection Override** de Maps dispose d'une
connexion à un modèle de langage qui fonctionne. Enregistre ou abandonne les
modifications en cours dans l'éditeur avant de rouvrir le constructeur par IA.
Pour une extension, choisis une cible active. Pour une génération ancrée dans le
lore, sélectionne au moins un lorebook activé et non exclu.

### La génération par IA signale un JSON incomplet ou mal formé

Si la réponse s'est terminée avant d'obtenir un JSON complet, augmente **Max Output Tokens** pour la connexion ou choisis une carte plus petite, puis relance la génération. World Maps ne dépense pas une autre requête pour réparer une réponse incomplète.

Si le JSON est mal formé, une réparation de syntaxe a déjà été tentée. Relance la génération ; si le modèle échoue plusieurs fois, change de connexion ou de modèle. **Max Output Tokens** vise uniquement le cas incomplet.

### Le lieu actuel n'a pas suivi un message

Le déplacement automatique exige que le dernier message de l'utilisateur
établisse directement l'arrivée de l'équipe suivie par l'histoire, et que le
modèle produise une directive Maps cachée valide. La narration de l'IA seule,
une intention, une discussion, un voyage raté, un déplacement de PNJ seul ou un
lieu de passage ne déplacent pas le marqueur. Essaie une formule directe, par
exemple "We go to the Kitchen." Utilise **Set destination** pour un déplacement
certain au tour suivant.

### Le lieu actuel a changé après la réouverture du chat

Vérifie quelle branche de messages et quel swipe sont sélectionnés : le lieu
actuel suit l'instantané spatial enregistré avec cet historique. Si l'historique
sélectionné est le bon mais que le marqueur ne l'est pas, ouvre l'éditeur de
carte, sélectionne le lieu actif correct, choisis **Set current story location**
et clique sur **Save**.

### Une destination ou un itinéraire affiche Needs review

La révision de la carte ou le lieu actuel a changé après la mise en attente du
déplacement. Ouvre la carte de l'histoire, vérifie le chemin actuel et
sélectionne à nouveau la destination ou l'itinéraire. Si la destination affichée
est toujours en attente, annule-la avant de la sélectionner de nouveau.

### Un itinéraire planifié n'avance pas

Chaque tour envoyé doit valider le pas suivant affiché et mettre en attente celui
d'après. Il n'existe pas de commande d'avance séparée. Si un tour terminé ne fait
pas avancer l'itinéraire, annule-le et replanifie-le depuis le lieu actuel. Si le
lieu enregistré est déjà faux, utilise **Set current story location** puis
**Save** : cette correction administrative efface l'itinéraire périmé.

### Ce chat doit utiliser une carte complètement différente

Ouvre l'éditeur de carte et choisis **Replace / start over**. Conserve d'abord un
modèle ou un export si nécessaire, puis crée, importe, copie ou relie la carte de
remplacement. Si le chat est relié et doit garder sa hiérarchie actuelle,
commence par **Detach and keep copy**. Retirer puis remettre World Maps n'efface
pas sa carte.

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

**Autres règles de World Maps 1.3.1 :** la génération guidée, la régénération et la continuation ne créent pas de tour utilisateur et ne consomment donc aucune destination ni étape d'itinéraire en attente. **Impersonate** crée bien un message utilisateur : un tour réussi valide le déplacement une fois, un échec du fournisseur ne valide rien et un déplacement périmé passe à **Needs review**.

Avec Marinara Engine **2.4.1** ou ultérieur, les directives complètes de déplacement et de découverte de Maps sont retirées du texte diffusé et des messages enregistrés, sans modifier le texte ordinaire entre crochets ni ses espaces. Si une directive brute apparaît, mets à jour Engine et World Maps, redémarre quand c'est demandé, puis régénère ou supprime le message concerné.

Quand une image de galerie remplit les deux rôles, **Remove reference only** la conserve comme arrière-plan de carte enfant ; **Reject both and create replacement** remplace les deux et **Use for both** attribue une nouvelle image aux deux. Un lien de galerie enregistré dont le fichier a disparu est également considéré comme manquant. Un résultat terminé pendant une modification ne remplit que les rôles encore vacants et n'écrase ni une nouvelle image, ni l'option de référence, ni la position d'arrière-plan, ni l'état d'archive, ni d'autres changements du brouillon.

**Open** sur une entrée liée quitte la carte et ouvre son lorebook. Un brouillon propre se ferme directement ; avec des changements non enregistrés, enregistre d'abord ou confirme leur abandon. Si le lore importé ne s'active pas, consulte le résumé : **Map only** ne contient rien à restaurer. Utilise **Map + linked entries** ou **Map + complete lorebooks**, puis choisis la correspondance exacte, la destination ambiguë ou une copie séparée. Le lore lié au parent n'est pas hérité par les lieux enfants.

## Guides associés

- [Agents : des aides IA pour tes chats](agents-overview.md)
- [Référence des agents téléchargeables](built-in-agents.md)
- [Lorebooks](../lorebooks/overview.md)
- [Mode Roleplay : premiers pas](../roleplay/getting-started.md)
- [Game Mode : premiers pas](../game/getting-started.md)
- [Game Mode : carte, heure et météo](../game/map-time-weather.md)
