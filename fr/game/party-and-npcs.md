# Game Mode : l'équipe et les PNJ

Ce guide présente les personnes de ta campagne Game Mode : les membres de ton équipe et les personnages non-joueurs (PNJ) que le Game Master (GM, le maître du jeu) fait entrer en scène. Sers-t'en pour ouvrir et modifier les feuilles de personnage, gérer l'inventaire, lire l'Adventure Journal (le journal d'aventure) et choisir un mode de GM. Pour la configuration et les bases, voir [Game Mode : premiers pas](getting-started.md).

## Vérifier ton équipe et ton inventaire

1. Clique sur **Character Profiles** (profils des personnages) et choisis un portrait pour voir la feuille de ce personnage.
2. Clique sur **Inventory** (inventaire) au-dessus du texte de l'histoire pour voir ce que chacun transporte.

Les détails des deux suivent.

## Character Profiles

**Character Profiles** est un bouton portrait qui montre qui voyage avec toi. Il reste en dehors du menu **Chat tools** (outils du chat). Voir [Les contrôles du jeu](getting-started.md#the-games-controls). Quand l'équipe compte plusieurs membres, il fait défiler leurs portraits et affiche un badge avec leur nombre. Tant que l'histoire n'a ajouté personne, l'équipe se limite à ton persona.

1. Clique ou touche le bouton **Character Profiles**.
2. Clique ou touche un portrait pour ouvrir la feuille de ce personnage.

Pour retirer un compagnon, passe le pointeur sur son portrait sur ordinateur et clique sur le **X**. Cela fonctionne pour tout compagnon recruté par le GM, pendant la configuration ou plus tard. Ton propre persona (le personnage que tu incarnes) n'a pas de **X**.

Tu peux faire glisser le bouton dans le chat, sur ordinateur comme sur téléphone. Ouvre-le et utilise **Lock window** (verrouiller la fenêtre) pour le garder en place. Sur ordinateur, tu peux aussi déplacer et redimensionner la fenêtre, et **Close** (fermer) la réduit de nouveau à son bouton. Sa position est enregistrée avec le chat, et il suit le style des widgets du chat choisi dans **Settings → Appearance → App** (Paramètres → Apparence → Application). Sur téléphone, il reste séparé du menu à trois points **Chat tools**.

## Les feuilles de personnage

Une feuille de personnage est un résumé, propre au jeu, d'un membre de l'équipe, distinct de la fiche de personnage. Dans une partie utilisant les classes **MRPG**, c'est-à-dire toute nouvelle partie, elle s'ouvre sur la fiche de classe MRPG du personnage : des onglets **Status**, **Classes**, **Skills** et **Gear**, où tu changes de classe, conserves des compétences et choisis ton équipement. Voir [La fiche du personnage](mrpg-classes.md#the-character-sheet). Ses caractéristiques MRPG remplacent les **Attributes** ci-dessous.

En dessous, le GM rédige la partie narrative de la feuille à partir de ton personnage et de l'histoire en cours. Elle affiche les sections qui ont du contenu :

| Section | Ce qu'elle contient |
| --- | --- |
| **Attributes** (attributs) | Parties Legacy uniquement : des scores comme STR, DEX et CON avec un modificateur, et des barres de ressources comme HP ou MP. |
| **Stats** (caractéristiques) | D'autres barres de statistiques. |
| **Abilities** (capacités) | Ce que le personnage sait faire. |
| **Strengths** (forces), **Weaknesses** (faiblesses) | De courtes listes. |
| **Details** (détails) | Des informations supplémentaires comme Skills, Weapon ou Faction. |
| **Inventory** | Les objets que transporte le personnage. |
| **Traits** (traits) | Les autres champs personnalisés. |

Un nouveau personnage peut afficher "Character data will populate as the story progresses." La feuille se remplit au fil de la partie.

<a id="edit-a-sheet-by-hand"></a>

### Modifier une feuille à la main

**Retry** (réessayer), **Save Sheet** (enregistrer la feuille) et **Cancel** (annuler) n'apparaissent qu'après un clic sur **Edit card** (modifier la fiche).

1. Ouvre la feuille du personnage et clique sur **Edit card**.
2. Change ce dont tu as besoin :
   - **Class** (classe) et une courte description, sous **Sheet Details** (détails de la feuille).
   - **Roleplay Stats** (Caractéristiques de Roleplay, parties Legacy) : active **Enable** (activer) pour suivre des jauges et des attributs. **Add Pool** (ajouter une jauge) ajoute une barre (nom, valeur actuelle, valeur maximale, couleur). **Add Attribute** (ajouter un attribut) ajoute un score comme STR. Une partie utilisant les classes MRPG ne s'en sert ni pour les jets ni pour les combats.
   - **Abilities**, **Strengths** et **Weaknesses** : **Add** (ajouter) ajoute une ligne à la fin.
   - **Details** : **Add Detail** (ajouter un détail) ajoute une information avec son intitulé.
3. Clique sur **Save Sheet**. Clique sur **Cancel** pour abandonner tes modifications.

Pour que l'IA recrée la feuille, clique sur **Retry** pendant la modification. La régénération s'appuie sur le personnage et sur l'historique de jeu en cours, et envoie une requête à ton modèle. Elle crée un brouillon : "new sheet draft is ready. Review it, then save to apply." Relis le brouillon, puis clique sur **Save Sheet**. Sers-t'en quand l'histoire a beaucoup fait évoluer un personnage. Sur un écran étroit, le bouton n'affiche qu'une icône.

<a id="the-ruleset-sheet"></a>

### La fiche de l'ensemble de règles

Dans une partie qui utilise un ensemble de règles, chaque feuille commence par un bloc **Ruleset sheet** (fiche de l'ensemble de règles) disposé par l'ensemble de règles : ses ressources, ses pistes, ses états, ses repos et un résumé de la construction du personnage, que le GM tient à jour au fil de sa narration. Voir [La fiche de l'ensemble de règles](rulesets.md#the-ruleset-sheet).

## Recruter et retirer des membres de l'équipe

Le GM décide qui fait partie de ton équipe à travers la narration. Il n'existe pas de bouton "ajouter un compagnon".

Quand le GM ajoute un PNJ dont le nom correspond exactement à l'une de tes fiches de personnage, ou à plusieurs, une fenêtre te demande laquelle rejoint l'équipe. Elle affiche le nom, le titre et l'avatar de chaque fiche. Choisis une fiche, ou choisis **Keep the game's own** (garder celui du jeu) suivi du nom du PNJ (par exemple **Keep the game's own Emma**) pour faire entrer le personnage créé par le jeu. Fermer la fenêtre revient au même. Une fiche dont le nom est seulement proche, comme **Samantha** pour un PNJ nommé Sam, n'est jamais ajoutée.

Une Experience peut apporter ses propres compagnons : des habitants de son monde qui peuvent te rejoindre, chacun avec une feuille toute prête. L'histoire peut en faire venir un ou le faire partir, et le GM ne peut recruter que ces compagnons (les personnages de ta propre bibliothèque peuvent toujours te rejoindre). Un compagnon arrive au niveau le plus élevé de ton équipe et monte de niveau avec elle.

## L'inventaire

Clique sur le bouton **Inventory** au-dessus du texte de l'histoire. Une grille de cases s'ouvre. Chaque case est une pile : un objet et sa quantité. Clique sur une pile pour la sélectionner.

Chaque membre de l'équipe a son propre sac. L'inventaire s'ouvre sur **All** (tout), qui montre tous les sacs ensemble, avec sur chaque pile le nom de la personne qui la porte. Clique sur l'onglet d'un membre de l'équipe pour ne voir que son sac. Tant que personne d'autre ne porte rien, il n'y a pas d'onglets.

- **Changer la quantité.** Utilise **-** et **+** pour en retirer ou en ajouter un. Ou tape un nombre entre les deux et appuie sur <kbd>Enter</kbd>.
  - Un nombre fixe la quantité : `300`.
  - Un signe ajoute ou retire autant : `+100`, `-50`.
  - Mettre à 0 supprime la pile, avec une demande de confirmation quand elle en contient plus d'un.
- **Diviser une pile.** Clique sur **Split** (diviser), tape combien vont dans la nouvelle pile, puis clique de nouveau sur **Split**.
- **Donner.** Clique sur **Give** (donner), choisis qui le reçoit et en quelle quantité, puis clique de nouveau sur **Give**. Ou fais glisser une pile entière sur l'onglet de cette personne.
- **Ajouter.** Tape le nom de l'objet et clique sur **Add**. Il va dans le sac de l'onglet ouvert, ou dans ton propre sac depuis **All**. Ajouter un objet que le sac contient déjà en ajoute un à sa première pile.
- **Fusionner.** Fais glisser une pile sur une autre pile du même objet. La pile fusionnée reste à la personne qui portait la pile sur laquelle tu l'as déposée.
- **Échanger.** Fais glisser une pile sur un autre objet pour échanger les deux.
- **Utiliser.** Clique sur **Use** (utiliser) pour dire au GM que tu utilises l'objet.
- **Surnom.** Tape un nouveau nom et clique sur **Save** (enregistrer). L'objet garde son propre nom, affiché à côté, et un surnom ne fusionne jamais des piles. Retape le nom d'origine de l'objet pour effacer le surnom.

### Comment le GM modifie ton inventaire

Le GM ajoute, retire et remet des objets au fil de l'histoire, et indique qui les porte.

- Quand il prend un objet sans préciser qui le détient, il le prend d'abord dans ton sac, puis dans ceux de l'équipe.
- Un changement impossible, comme prendre quelque chose que personne n'a, est refusé, et le GM en est informé.
- Les changements sont appliqués quand la réponse est enregistrée. Régénérer une réponse repart de l'état du début de ce tour. Revenir en arrière par swipe montre ce que cette version avait laissé. Une branche conserve l'inventaire de chaque version.
- Si tu changes quelque chose toi-même, une nouvelle réponse ajoute ses changements par-dessus, et rien de ce que tu as fait n'est annulé.
- Un combat utilise les objets via l'action **Items** (objets) et compte ensemble toutes les piles d'un même objet.
- Chaque sac, chaque division et chaque surnom sont conservés à la session suivante.

## L'Adventure Journal

L'Adventure Journal tient le registre de ta campagne. Il se construit à partir des événements de jeu enregistrés, et non de textes écrits par l'IA : il reste donc factuel.

1. Ouvre **Session** (voir [Ouvrir Session](sessions-and-saves.md#opening-session)).
2. Choisis l'onglet **Journal**.

| Onglet | Ce qu'il montre |
| --- | --- |
| **Timeline** (chronologie) | Ce qui s'est passé : lieux découverts, rencontres avec des PNJ, résultats de combat, quêtes et événements liés aux objets. |
| **NPCs** (PNJ) | Les PNJ que tu as rencontrés, avec leur portrait et leur étiquette de réputation. |
| **Map** (carte) | La simple liste des noms de lieux que tu as découverts. |
| **Items** | Le journal des objets que tu as obtenus, utilisés, perdus ou retirés. |
| **Library** (bibliothèque) | Les notes et les livres de l'univers que le GM t'a montrés, conservés pour que tu puisses les relire. |
| **Notes** | Ton propre bloc-notes. |
| **World** (monde) | Dans une partie avec un monde généré, le monde tel que ton équipe le connaît. |

L'onglet **World** montre où tu te trouves et à quel point l'équipe est connue, sa réputation auprès de chaque groupe, ce qu'elle a fait, les nouvelles qui lui sont parvenues (les rumeurs sont signalées), les troubles qui couvent et dont elle a entendu parler, et le passé que n'importe quel habitant raconterait. Il ne montre que ce que l'équipe peut savoir. Les secrets que seul le GM connaît restent cachés. Il suit l'histoire à travers les swipes et les branches.

### Les notes du joueur

Dans l'onglet **Notes**, tu écris à gauche et un aperçu mis en forme s'affiche à droite. Une légende prévient que le GM et les membres de l'équipe voient tes notes : tout ce que tu écris peut donc influencer l'histoire. Les notes s'enregistrent peu après que tu arrêtes d'écrire. L'étiquette affiche **Saving...**, puis **Saved**.

### Les étiquettes de réputation des PNJ

Chaque PNJ de l'onglet **NPCs** affiche un portrait, un nom et une étiquette de réputation qui évolue selon tes actions. Un PNJ apparaît dès que le GM l'a décrit, lui a donné une réputation ou a noté une relation le concernant. Une étiquette n'apparaît qu'une fois la réputation écartée de son point de départ : un PNJ tout neuf n'en affiche donc aucune.

| Étiquette | Signification |
| --- | --- |
| **Devoted** | Profondément loyal envers toi |
| **Allied** | Allié solide |
| **Friendly** | Positif |
| **Neutral** | Aucun sentiment marqué |
| **Unfriendly** | Négatif |
| **Hostile** | Retourné contre toi |
| **Enemy** | Ouvertement opposé |

Chaque ligne de PNJ permet aussi de téléverser ou de remplacer le portrait, de générer un portrait avec l'IA (si la génération d'images est activée) et de retirer le PNJ du journal.

## Les modes de Game Master

Tu choisis qui mène la partie dans l'assistant de configuration, à l'étape **Party** (équipe), sous **Game Master Mode** (mode du Game Master). Le mode se règle au moment de créer la partie.

- **Standalone GM** (par défaut) : Marinara construit un GM pour toi. L'assistant le décrit ainsi : "A snarky narrator running the show". Aucune fiche de personnage n'est nécessaire.
- **Character GM** : l'une de tes propres fiches de personnage sert de GM. Le modèle joue ce personnage tout en menant la partie. Choisis-le pour une voix de narrateur bien précise.

Pour une première partie, prends **Standalone GM**.

## Référence : inventaire avec un ensemble de règles

Ces sections ne s'appliquent qu'aux parties qui utilisent un ensemble de règles, ou un kit d'univers doté d'une monnaie. Voir [Jouer avec un ensemble de règles](rulesets.md).

### Objets de l'ensemble de règles

Ces contrôles n'apparaissent que quand la partie tourne sur un ensemble de règles qui a des objets.

- **From the ruleset** (depuis l'ensemble de règles) ouvre un sélecteur des objets de l'ensemble de règles, avec sa recherche et ses filtres. Coche des objets et clique sur **Add** : un exemplaire de chacun va là où **Add** place un objet. Un nom que tu tapes et qui est l'un des objets de l'ensemble ajoute cet objet. Certains ensembles de règles n'acceptent que leurs propres objets : il n'y a alors aucun nom à taper.
- **Starting gear** (équipement de départ) ouvre l'équipement que l'ensemble de règles propose au départ. Choisis son destinataire dans **For** (pour), fais les choix que le kit demande et clique sur **Take** (prendre). L'équipement adapté à la fiche du personnage est listé en premier. Le prendre est facultatif. Une fois que tout a été pris, le bouton affiche **Starting gear (taken)**.
- **Use** sur un objet de l'ensemble de règles qui indique ce qu'il fait, comme un cataplasme de soin, fait d'abord appliquer son effet par Marinara :
  - Marinara lance les dés de ce que l'objet rend et inscrit le résultat sur la fiche de la personne qui le porte.
  - Marinara en retire un de la pile ou dépense une charge, et dit au GM ce qui s'est passé.
  - Ce que l'objet fait à quelqu'un d'autre est laissé au GM.
  - Un objet épuisé est refusé, et un objet qui doit être porté ne fonctionne que tant qu'il est porté.
  - Certains objets demandent d'abord un test, comme un parchemin au-dessus de ton niveau de lecture. Marinara le lance et, en cas d'échec, l'objet est consommé pour rien.
- Sélectionner un objet de l'ensemble de règles affiche son type, sa rareté, ses tags, ses statistiques et sa description. Une pile ne contient que la quantité fixée par l'ensemble de règles, et le surplus commence une nouvelle pile.
- Le GM peut inventer un objet dans les termes de l'ensemble de règles, comme une lame qui porte un nom. Il fonctionne comme un objet de l'ensemble, et ses détails indiquent qu'il a été inventé et ce que Marinara a changé pour l'adapter à l'ensemble de règles, comme un bonus limité à ce que permet sa rareté.
- Certains ensembles de règles désactivent les objets propres à Game Mode. Le GM ne donne alors que les objets de l'ensemble et ceux qu'il invente, et tu peux toujours saisir tes propres objets, sauf si l'ensemble de règles n'accepte que les siens.

### Porter, lier et transporter

Un ensemble de règles peut indiquer comment ses objets se portent et se transportent.

- **Équipé.** Un objet qui occupe des emplacements, comme une armure sur le corps ou un arc à deux mains, a un bouton **Equipped** (équipé). Son porteur peut le porter tant que ces emplacements sont libres. L'onglet du sac affiche les emplacements occupés, par exemple **Hands 2/2**. Équiper un objet d'une pile plus grande le place dans sa propre pile, marquée comme portée.
- **Lien.** Un objet qui doit être lié pour fonctionner (harmonisé, investi) a un bouton qui porte le mot de l'ensemble de règles, comme **Bound**. Un personnage ne peut lier que le nombre d'objets que sa fiche permet, affiché sous la forme **Bound 1/3**. Un objet maudit, une fois lié, ne peut plus être délié, retiré, donné ni jeté. Seule l'histoire, par le GM, peut lever la malédiction.
- **Transport.** Quand l'ensemble de règles fixe des poids et une capacité, chaque sac affiche sa charge, par exemple **Load 5/6, at most 12**, et **Encumbered** dès qu'elle dépasse ce que son porteur porte sans peine. Un objet ajouté depuis **All** va à quelqu'un qui peut le porter sans devenir encombré : toi d'abord, puis l'équipe dans l'ordre. Si personne ne le peut, il est réparti selon la place qui reste à chacun, et personne ne reçoit plus que ce qu'il peut porter au maximum. Ce que personne ne peut porter est laissé sur place, et tu en es informé. **Give**, ou faire glisser une pile sur un sac qui dépasserait sa limite, est refusé.

Donner un objet porté ou lié à quelqu'un d'autre le retire et le délie. Dans un ensemble de règles qui a ces règles, le GM équipe et retire aussi des objets, les lie et les délie, et voit la charge, les emplacements et les objets liés de chacun.

### Argent et marchés

Un ensemble de règles peut avoir sa propre monnaie : des familles de pièces, comme les pennies, les shillings et les couronnes, où chaque pièce plus grande vaut un certain nombre des plus petites. Les pièces sont des piles comme n'importe quel objet. Elles pèsent ce qu'indique l'ensemble de règles, comptent dans la charge de la personne qui les porte, et tu peux les diviser, les donner et les fusionner. **From the ruleset** a une liste **Coins** (pièces) pour les ajouter à la main. Au-dessus des piles, une ligne indique chaque famille de l'onglet ouvert et son total, par exemple **Coin: crowns ×2, pennies ×12 (worth 132 pennies)**.

- Le GM fait payer l'équipe et la paie dans ces pièces. Un combat gagné ou un trésor tiré aux dés peut aussi en faire tomber. Un paiement sort de la bourse d'un seul personnage, la tienne sauf s'il précise laquelle.
- Un prix ne se paie que dans la famille dans laquelle il est indiqué : un prix en sel se paie en sel. Les plus grosses pièces partent en premier, et une pièce plus grande est rompue quand le montant exact n'y est pas, la monnaie revenant en pièces plus petites.
- Un prix que la bourse ne peut pas couvrir est refusé, et le GM en est informé. Chaque paiement et chaque gain s'affichent en notification.
- Une variante de l'ensemble de règles peut exclure une pièce. Personne ne paie alors dans cette pièce ni n'est payé avec, et un prix indiqué dans cette pièce s'affiche dans les pièces restantes, pour la même valeur.

Un ensemble de règles peut aussi avoir des marchés : ce que tu peux acheter dépend alors de l'endroit où tu te trouves.

- Le GM indique dans quel lieu se passe une scène et quelle est sa taille, un hameau ou une ville dans les termes de l'ensemble de règles. Un petit lieu vend moins : les choses rares ne se trouvent parfois qu'en ville, et certains vendeurs ne tiennent boutique que dans les grands lieux ou ne servent que certains acheteurs, comme une chapelle qui ne vend qu'aux fidèles.
- Quand tu achètes, Marinara calcule le prix à partir du coût de l'objet et de ce que l'affaire a d'avantageux ou de coûteux, le prend dans la bourse de l'acheteur et met l'objet dans son sac. Le logement, le passage et les autres services sont seulement payés.
- Un achat que le lieu, le vendeur ou la bourse ne permet pas est refusé, et le GM apprend pourquoi.
- Un ensemble de règles peut rendre chaque journée différente dans un lieu : un lieu peut n'avoir que quelques exemplaires d'une chose rare, un vendeur peut proposer quelque chose d'inhabituel, et tu peux revendre des objets pour une part du prix jusqu'à ce que les vendeurs aient dépensé ce qu'ils déboursent en une journée. Un nouveau jour dans le même lieu, que le GM commence quand l'équipe reste sur place, remplit de nouveau les étals et les bourses.

Une partie sans ensemble de règles a elle aussi de l'argent et un marché quand son kit d'univers en prévoit. C'est le cas de chaque kit de départ, par exemple le cuivre, l'argent et l'or en high fantasy, les sapèques de cuivre et les taels d'argent en wuxia, les dollars et les cents à l'époque moderne, et les crédits en cyberpunk et en space opera. La boutique du kit liste des objets du quotidien, chacun avec un prix et le plus petit lieu qui le vend : un village a un café, mais seule une ville a une trousse de premiers secours. Tu peux changer l'argent et la boutique sous **Change its words** (modifier ses mots) dans le kit, ou retirer l'argent. Voir [Choisir un kit d'univers](getting-started.md#choosing-a-setting-kit).

## Guides associés

- [Game Mode : jouer avec un ensemble de règles](rulesets.md)
- [Game Mode : premiers pas](getting-started.md)
- [Game Mode : sessions et sauvegardes](sessions-and-saves.md)
