# Card Browser : trouver et importer des personnages

Ce guide explique le **Card Browser** (navigateur de fiches) de Marinara Engine, l'outil intégré qui trouve des fiches de personnage sur les sites publics et les importe dans ta bibliothèque. Au programme : les sources, la recherche et les filtres, et le traitement du contenu adulte sur chaque source. Tu verras aussi comment importer un personnage ou l'enregistrer sous forme de fichier. Les anciennes versions appelaient cet onglet **Bot Browser** ou **Browser**.

Une fiche de personnage est un fichier qui contient le nom, la personnalité, le message d'accueil et les autres détails d'un personnage. Normalement, tu télécharges une fiche depuis un site web, puis tu la téléverses dans Marinara. Le **Card Browser** fait les deux au même endroit.

## À quoi sert le Card Browser

Le **Card Browser** interroge plusieurs sites publics de fiches de personnage sans quitter Marinara. Il prend en charge cinq sources : **ChubAI**, **JannyAI**, **Pygmalion**, **Wyvern** et **DataCat**. **CharacterTavern** figure toujours dans la liste, mais tu ne peux pas le parcourir pour le moment (voir [CharacterTavern](#charactertavern)). Tu peux chercher dans une source, filtrer les résultats et prévisualiser tous les détails d'un personnage. Ensuite, importe ce personnage dans la bibliothèque ou enregistre-le en fichier PNG. Avec les réglages par défaut, aucun compte ni clé API n'est nécessaire pour parcourir et importer des fiches de personnage.

## Ouvrir le Card Browser

Le **Card Browser** s'ouvre de deux façons.

1. Clique sur l'icône **Card Browser** dans la barre du haut. Elle se trouve dans la rangée de boutons de panneaux, à droite.
2. Autre option : ouvre le panneau **Card Browser** dans la barre latérale droite, puis clique sur le bouton **Download Cards** (télécharger des fiches) en haut de ce panneau.

Dans les deux cas, toute la zone de contenu bascule sur la vue complète du **Card Browser**. Cette vue remplace la zone de chat. Ce n'est pas une petite fenêtre surgissante.

Pour quitter, clique sur le bouton flèche-retour en haut à gauche de l'en-tête du **Card Browser**. Tu reviens alors à l'écran d'où tu venais.

Le **Card Browser** reste chargé tant que l'application est ouverte. Si tu le fermes puis le rouvres, ta dernière recherche, tes filtres et le personnage sélectionné sont toujours là. Recharger toute l'application remet le tout à zéro.

## Choisir une source

Clique sur le bouton de source dans l'en-tête. Il affiche le nom de la source active et une petite flèche. Un menu s'ouvre avec les sources, dans cet ordre : **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern** et **DataCat**. **CharacterTavern** y est marqué **Unavailable** (indisponible).

**ChubAI** est sélectionné à la première ouverture du **Card Browser**. Quand tu changes de source, le texte de recherche, les tags et les filtres sont effacés. Chaque source retient séparément son réglage de contenu adulte et sa propre connexion au site, donc un changement sur une source n'affecte pas les autres.

Une remarque sur les noms : le menu affiche **ChubAI**, mais sur la page de détail d'un personnage, le lien externe indique **View on Chub**. C'est le nom que le site se donne lui-même. Les autres sources portent le même nom aux deux endroits.

## CharacterTavern

CharacterTavern a refait son site web et ne propose plus la connexion que Marinara utilisait pour chercher et télécharger des fiches. Quand tu choisis **CharacterTavern**, le **Card Browser** affiche un court avis à la place des résultats de recherche. Il sera peut-être de nouveau possible de le parcourir si CharacterTavern propose un accès API.

En attendant, tu peux toujours importer à la main des personnages de CharacterTavern dans Marinara :

1. Clique sur **Open CharacterTavern** (ouvrir CharacterTavern) dans l'avis. Le site s'ouvre dans un nouvel onglet.
2. Télécharge le fichier de la fiche de personnage depuis character-tavern.com.
3. Clique sur **Import Character** (importer un personnage) dans l'avis et choisis le fichier téléchargé. Voir [Importer et exporter des fiches de personnage](import-export.md).

Les personnages que tu as déjà importés depuis CharacterTavern restent dans ta bibliothèque.

## Recherche, tri et pages

Saisis du texte dans le champ **Search characters...** pour lancer une recherche. Pas besoin d'appuyer sur Enter. Marinara attend un instant (environ une demi-seconde) après que tu as arrêté de taper, puis lance la recherche automatiquement. Vider le champ ou modifier un filtre relance aussi la recherche.

À côté du champ de recherche se trouve un menu déroulant de tri. Les options diffèrent d'une source à l'autre, et chaque source démarre sur son propre tri par défaut :

| Source    | Tri par défaut  |
| --------- | --------------- |
| ChubAI    | Most Downloaded |
| JannyAI   | Newest          |
| Pygmalion | Downloads       |
| Wyvern    | Popular         |
| DataCat   | Relevance       |

Clique sur le bouton **Refresh** (actualiser), l'icône en flèche circulaire, pour relancer la recherche en cours.

Sous les résultats, les boutons **Previous** et **Next** encadrent une étiquette de page, par exemple **Page 2**. Quand la source ne peut pas indiquer un total exact, seul le numéro de la page en cours s'affiche.

Une remarque sur **DataCat** : son tri **Fresh** ne donne des résultats récents que si aucun filtre de tag ni texte de recherche n'est actif. Dès que tu saisis une recherche ou choisis un tag, **DataCat** revient à des résultats classés par pertinence.

## Filtrer par tags

Clique sur le bouton **Tags** dans la barre d'outils pour ouvrir le panneau des tags.

- Saisis du texte dans le champ **Search tags...** pour réduire la liste des tags.
- Clique sur la coche verte à côté d'un tag pour l'inclure. Clique sur le moins rouge pour l'exclure. Un tag est inclus ou exclu, jamais les deux.
- Les tags inclus apparaissent en pastille verte. Les tags exclus, en pastille rouge. Clique sur une pastille pour la retirer.
- Le bouton **Clear** (effacer) supprime tous les tags actifs.

Sur la plupart des sources, la liste des tags est construite à partir des personnages de tes recherches récentes. Avant ta première recherche, le panneau indique **Tags will appear after searching**. Si un tag que tu cherches n'est pas listé, saisis son nom. Deux boutons apparaissent pour l'ajouter comme filtre ou le bloquer dans les résultats.

**DataCat** fonctionne autrement. Il charge tout de suite les tags les plus populaires, car sa liste de tags est très longue. Tu peux toujours saisir à la main n'importe quel autre nom de tag.

## Autres filtres

Certaines sources ajoutent un bouton **Filters** (filtres) dans la barre d'outils. Il n'apparaît que si la source propose des filtres, donc pas pour **DataCat**. Un petit badge indique le nombre de filtres actifs.

Le panneau de filtres peut contenir :

- Des cases à cocher de contenu, comme **Lorebook** ou **Alt Greetings**, qui ne gardent que les personnages dotés de cette fonctionnalité. Un lorebook est un recueil de faits sur ton univers qu'un personnage peut transporter avec lui.
- Le réglage **Sort Direction**, soit **Descending**, soit **Ascending**, sur **ChubAI** et **Pygmalion**.
- Les champs numériques **Min Tokens** et **Max Output Tokens**, qui limitent les résultats par taille. Si tu les laisses vides, la source applique sa propre valeur par défaut.
- **JannyAI** propose un interrupteur **Show Low Quality**. Il est désactivé par défaut, ce qui masque les personnages que **JannyAI** a marqués comme de faible qualité. Active-le pour les afficher.

Remarque sur **Wyvern** : ses cases **Lorebook** et **Alt Greetings** s'affichent, tout comme ses champs **Min Tokens** et **Max Output Tokens**. Aucun d'eux ne change les résultats de **Wyvern**. Pour affiner les résultats de **Wyvern**, sers-toi plutôt du menu déroulant de tri et des tags.

## Contenu adulte (NSFW) selon la source

L'application désigne le contenu adulte par **NSFW**. La barre d'outils ne contient qu'une seule case **NSFW**, mais chaque source la traite à sa manière. C'est la question la plus fréquente, alors lis ce passage attentivement.

- **ChubAI** et **JannyAI** : la case **NSFW** agit immédiatement. Aucune connexion nécessaire. Elle est décochée par défaut.
- **Pygmalion** : la case **NSFW** est grisée tant que tu n'es pas connecté. Son infobulle te demande de te connecter d'abord. Une fois connecté, l'application suit les réglages de ton compte sur Pygmalion. La case indique alors **NSFW depends on your account settings**. Après la connexion, il n'y a plus d'interrupteur séparé.
- **Wyvern** : la case **NSFW** est toujours grisée. Un avis indique **Use "🔞 Popular NSFW" sort for NSFW content**. Pour voir du contenu adulte sur **Wyvern**, choisis l'option **🔞 Popular NSFW** dans le menu déroulant de tri.
- **DataCat** : tous les personnages y sont marqués adultes, donc la case reste cochée en permanence. La première fois que tu choisis **DataCat**, une boîte de dialogue intitulée **DataCat is NSFW only** apparaît. Clique sur **Continue to DataCat** pour parcourir la source, ou sur **Don't continue to DataCat** pour revenir en arrière.

Les personnages adultes portent un petit badge rouge **NSFW** dans le coin de leur vignette.

## Se connecter à Pygmalion

**Pygmalion** réserve son contenu adulte aux comptes connectés. Pour les personnages publics ordinaires, aucune connexion n'est nécessaire. Se connecter ne débloque que le contenu adulte.

Pour te connecter, clique sur le bouton **Log In** (se connecter) dans la barre d'outils. Une fenêtre de connexion s'ouvre. Tu y colles une valeur copiée depuis ton propre compte Pygmalion. Marinara ne demande pas ton mot de passe.

Pour **Pygmalion**, la fenêtre s'intitule **Pygmalion Authentication** et réclame un **Auth Token** :

1. Va sur pygmalion.chat et connecte-toi à ton compte.
2. Ouvre les outils de développement du navigateur. Sur la plupart des navigateurs, il suffit d'appuyer sur la touche F12. Les outils de développement sont un panneau intégré au navigateur, destiné aux utilisateurs avancés.
3. Ouvre l'onglet **Application**, puis **Local Storage**.
4. Trouve l'entrée nommée `authn` et copie sa valeur.
5. Colle la valeur dans le champ **Auth Token** de Marinara.
6. Clique sur **Save & Connect**. Un message doit confirmer que le contenu NSFW est activé.

La fenêtre contient une section d'aide qui reprend ces étapes, et un lien **Website** qui ouvre pygmalion.chat. Pour te déconnecter, rouvre la fenêtre de connexion et clique sur **Log Out**.

Important : cette connexion ne vit que dans la mémoire du serveur. Marinara ne l'écrit jamais dans un fichier. Si tu redémarres le serveur Marinara, tu es déconnecté et tu dois recoller le token. Marinara affiche alors un message qui t'invite à te reconnecter.

## Examiner un personnage avant l'import

Clique sur une fiche de résultat pour ouvrir sa vue détaillée. Utilise **Back to results** (retour aux résultats) pour revenir en arrière.

La vue détaillée affiche l'avatar du personnage, son nom, son créateur, une courte accroche et jusqu'à vingt pastilles de tags. Elle contient aussi un lien **View on** qui ouvre la page d'origine du personnage dans un nouvel onglet.

En dessous se trouvent tous les détails du personnage, affichés uniquement si la source les fournit. Ces sections portent des titres comme **Creator's Notes**, **Personality**, **Scenario**, **First Message** et **Alternate Greetings**. Un badge ambre **Has embedded lorebook** apparaît quand le personnage transporte un lorebook.

Certaines sources ne renvoient pas toujours les détails complets. Si rien ne se charge, la vue précise que tu peux quand même importer le personnage avec ses informations de base.

## Importer ou télécharger un personnage

La vue détaillée propose deux boutons. Le bouton **Import** (importer) ajoute le personnage à ta bibliothèque Marinara. Le bouton **Download as PNG** (télécharger en PNG) enregistre le personnage dans un fichier sur ton appareil, sans l'ajouter à la bibliothèque.

Pour importer des fiches de personnage dans la bibliothèque :

1. Ouvre la vue détaillée d'un personnage.
2. Choisis une option **Imported tags** (tags importés), voir le tableau ci-dessous.
3. Clique sur **Import**. Le bouton affiche **Importing...** pendant l'opération.
4. Attends le message de réussite. Un message doit confirmer que le personnage a bien été importé.
5. Ouvre le panneau **Characters** pour retrouver le personnage importé avant de démarrer un chat.

Le personnage importé se comporte comme n'importe quel autre personnage. Pour discuter avec lui, il te faut encore une connexion fonctionnelle vers un fournisseur. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

### Imported tags

Le panneau **Imported tags**, à côté de l'avatar, détermine quels tags accompagnent le personnage. La valeur par défaut est **All tags**.

| Option        | Effet                                        |
| ------------- | -------------------------------------------- |
| All tags      | Conserve les tags de la source.              |
| No tags       | Ignore les tags de la source.                |
| Existing only | Ne garde que les tags déjà utilisés dans Marinara. |

### La confirmation du lorebook intégré

Si le personnage transporte un lorebook intégré, l'import fait apparaître une petite boîte de dialogue de confirmation, celle du navigateur web. Elle demande si tu veux aussi enregistrer le lorebook comme lorebook Marinara indépendant. Clique sur **OK** pour créer ce lorebook séparé en plus de la copie rattachée au personnage. Clique sur **Cancel** pour ne garder que le lorebook rattaché au personnage.

### Download as PNG

Clique sur **Download as PNG** pour enregistrer le personnage dans un fichier de fiche de personnage PNG standard. Le bouton affiche **Building PNG...** pendant l'opération. Cela fonctionne pour toutes les sources. Le fichier enregistré porte le nom du personnage, par exemple `Some_Character.png`. Tu peux le partager ou l'importer plus tard dans une autre application.

JSON et PNG sont deux formats courants pour les mêmes données de personnage. Le JSON est un format en texte brut. Une fiche PNG est un fichier image qui contient les données du personnage à l'intérieur. Les deux gardent le personnage complet.

## Tes personnages importés

Le panneau **Card Browser** de la barre latérale droite tient une liste distincte des personnages que tu as importés via le **Card Browser**. Les personnages créés à la main ou importés autrement n'y figurent pas. Tous restent visibles dans la bibliothèque **Characters** principale.

- Le bouton **Download Cards** ouvre la vue complète du **Card Browser**.
- Le champ **Search imported...** filtre cette liste.
- Le menu déroulant de tri propose **A-Z**, **Z-A**, **Newest** et **Oldest**.
- Fais un clic droit sur une ligne, ou sers-toi de ses boutons, pour accéder à **Quick Start Roleplay** et **Quick Start Conversation**. Ces options ouvrent un nouveau chat avec ce personnage. C'est aussi ici que tu supprimes le personnage de cette liste.

## Dépannage

**La recherche ou les détails de JannyAI échouent avec une erreur Cloudflare.** Certains sites bloquent les requêtes automatisées. Ouvre jannyai.com une fois dans le même navigateur web, passe l'éventuel test qu'il affiche, puis reviens dans Marinara et relance la recherche.

**Ma connexion Pygmalion ne fonctionne plus.** Le redémarrage du serveur Marinara efface cette connexion. Rouvre la fenêtre **Log In** et colle à nouveau ton token.

**CharacterTavern n'affiche qu'un avis.** C'est normal. Voir [CharacterTavern](#charactertavern) pour importer ses fiches sous forme de fichiers.

**Une recherche échoue ou une source cesse de fonctionner.** Les sites publics peuvent modifier leurs pages ou bloquer l'accès à tout moment. Réessaie plus tard. Si une source échoue systématiquement, ouvre le personnage directement sur le site et télécharge la fiche toi-même. Ensuite, importe-la par le flux d'import habituel. Voir [Importer et exporter des fiches de personnage](import-export.md).

## Guides associés

- [Importer et exporter des fiches de personnage](import-export.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
