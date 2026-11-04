# Card Browser : trouver et importer des personnages

Le **Card Browser** (navigateur de fiches) trouve des fiches de personnage sur des sites publics et les importe dans ta bibliothèque depuis Marinara : tu n'as pas à télécharger puis téléverser les fichiers à la main. Les anciennes versions l'appelaient **Bot Browser** ou **Browser**.

Une fiche de personnage est un fichier qui contient le nom, la personnalité, le message d'accueil et les autres détails d'un personnage. Avec les réglages par défaut, tu n'as besoin ni de compte ni de clé API pour parcourir et importer des fiches.

## Ouvrir le Card Browser

1. Clique sur **Characters** (personnages) ou **Personas** dans la barre de navigation du haut. Si tu ne les vois pas, ouvre d'abord **More** (plus).
2. Clique sur le bouton **Download** (télécharger) en haut. Son infobulle indique **Download character cards**.

Le Card Browser occupe toute la zone de contenu, sous le titre **Browse character cards online**. Pour le quitter, clique sur la flèche de retour en haut à gauche.

Si tu le fermes puis le rouvres, ta dernière recherche, tes filtres et le personnage sélectionné sont toujours là. Recharger l'application les remet à zéro.

## Choisir une source

Clique sur le bouton de source dans l'en-tête. Le menu liste, dans l'ordre : **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern**, **DataCat**, **PlotLight** et **PlotLight Personas**. **ChubAI** est sélectionné la première fois. Changer de source efface le texte de recherche, les tags et les filtres. Chaque source garde son propre réglage de contenu adulte et sa propre connexion au site.

| Source | Contenu adulte (NSFW) |
| --- | --- |
| **ChubAI** | La case **NSFW** fonctionne. Décochée par défaut. |
| **JannyAI** | La case **NSFW** fonctionne. Décochée par défaut. |
| **Pygmalion** | Grisée tant que tu ne t'es pas [connecté](#log-in-to-pygmalion). Ensuite, elle suit les réglages de ton compte Pygmalion. |
| **Wyvern** | Toujours grisée. Choisis plutôt le tri **🔞 Popular NSFW**. |
| **DataCat** | Chaque fiche est marquée adulte, donc la case reste cochée en permanence. |
| **PlotLight** et **PlotLight Personas** | Toujours grisée. PlotLight applique ses propres règles. Les résultats marqués adultes reçoivent un badge **NSFW**. |

Tu ne sais pas par où commencer ? Utilise **ChubAI**, la première source. Chaque source démarre sur son propre ordre de tri, et tu peux le changer dans le menu déroulant de tri.

Les fiches adultes portent un petit badge rouge **NSFW** sur leur vignette. Le menu affiche **ChubAI**, mais le lien externe d'une fiche indique **View on Chub**, le nom que le site se donne lui-même.

### DataCat

La première fois que tu choisis **DataCat**, une boîte de dialogue intitulée **DataCat is NSFW only** apparaît. Clique sur **Continue to DataCat** pour parcourir la source, ou sur **Don't continue to DataCat** pour revenir en arrière. Son tri **Fresh** ne donne des résultats récents que si aucun filtre de tag ni texte de recherche n'est actif.

### CharacterTavern

CharacterTavern a refait son site et ne propose plus la connexion que Marinara utilisait. Quand tu le choisis, un avis remplace les résultats. Il sera peut-être de nouveau possible de le parcourir si CharacterTavern propose un accès API. En attendant, importe ses fiches à la main :

1. Clique sur **Open CharacterTavern** (ouvrir CharacterTavern) dans l'avis. Le site s'ouvre dans un nouvel onglet.
2. Télécharge le fichier de la fiche depuis character-tavern.com.
3. Clique sur **Import Character** (importer un personnage) dans l'avis et choisis le fichier. Voir [Importer et exporter des fiches de personnage](import-export.md).

Les personnages que tu as déjà importés depuis CharacterTavern restent dans ta bibliothèque.

### PlotLight

PlotLight partage des personnages et des personas publics. **PlotLight** liste des fiches de personnage. **PlotLight Personas** liste des personas, les personnages qui te représentent dans les chats. Tu n'as pas besoin de compte PlotLight. La vue détaillée propose un lien **View on PlotLight** (voir sur PlotLight) vers la page d'origine.

Marinara télécharge le fichier que PlotLight propose. Une fiche de personnage arrive en général sous forme de PNG, avec son portrait et tout lorebook que le créateur autorise. Un persona arrive sous forme de fichier texte, et Marinara copie son image à part. Tu peux importer l'un ou l'autre comme personnage ou comme persona.

PlotLight limite la fréquence à laquelle les applications peuvent l'interroger. Si tu vas trop vite, Marinara affiche **PlotLight is busy** avec un nombre de secondes, et attend ce délai. La recherche et l'import ont des limites distinctes.

Certaines fiches ne peuvent pas être téléchargées, par exemple quand le créateur ne l'autorise pas. Marinara affiche alors **PlotLight doesn't offer this for download.** Tu ne peux ni importer cette fiche ni voir ses détails, mais son image, son créateur et le lien **View on PlotLight** restent.

## Recherche, tri et pages

Saisis du texte dans **Search characters**. Pas besoin d'appuyer sur <kbd>Enter</kbd>. Marinara lance la recherche un instant après que tu as arrêté de taper, puis de nouveau quand tu vides le champ ou modifies un filtre. Chaque source a son propre menu déroulant de tri. Clique sur le bouton **Refresh** (actualiser), la flèche circulaire, pour relancer la recherche.

Sous les résultats se trouvent **Previous** et **Next**, avec une étiquette comme **Page 2**. Quand une source ne peut pas indiquer de total, seule la page en cours s'affiche. **PlotLight** n'indique jamais de total : l'en-tête affiche donc **Browsing PlotLight**. Une page PlotLight peut contenir peu de fiches, voire aucune, et être quand même suivie d'autres pages. **Next** reste actif, pour que tu puisses continuer.

## Filtrer par tags

1. Clique sur **Tags** dans la barre d'outils.
2. Saisis du texte dans **Search tags** pour réduire la liste.
3. Clique sur la coche verte à côté d'un tag pour l'inclure, ou sur le moins rouge pour l'exclure. Un tag ne peut pas être les deux.
4. Clique sur une pastille pour retirer ce tag, ou sur **Clear** (effacer) pour tout retirer.

Sur la plupart des sources, la liste est construite à partir des personnages de tes recherches récentes. Avant ta première recherche, le panneau indique **Tags will appear after searching**. Si un tag que tu veux n'est pas listé, saisis son nom. Deux boutons apparaissent : l'un l'ajoute comme filtre, l'autre le bloque. **DataCat** charge tout de suite ses tags les plus populaires, et tu peux toujours en saisir d'autres. Sur **PlotLight**, Marinara cherche le tag saisi dans la propre liste de PlotLight, et un tag que PlotLight ne connaît pas ne correspond à rien.

## Autres filtres

La plupart des sources ajoutent un bouton **Filters** (filtres) avec un badge qui compte les filtres actifs. Il n'apparaît pas pour **DataCat** ni pour **PlotLight**. Le panneau peut contenir :

- Des cases à cocher de contenu, comme **Lorebook** ou **Alt Greetings**, qui ne gardent que les personnages dotés de cette fonctionnalité. Un lorebook est un ensemble d'informations de fond qu'un personnage transporte avec lui.
- **Sort Direction** (sens du tri), **Descending** ou **Ascending**, sur **ChubAI** et **Pygmalion**.
- Les champs **Min Tokens** et **Max Output Tokens**, qui limitent les résultats par taille. Laisse-les vides pour utiliser la valeur par défaut de la source.
- Un interrupteur **Show Low Quality** sur **JannyAI**. Il est désactivé, ce qui masque les fiches que JannyAI a marquées comme de faible qualité.

Sur **Wyvern**, les cases **Lorebook** et **Alt Greetings** et les champs de tokens s'affichent, mais ne changent pas les résultats. Sers-toi plutôt du menu déroulant de tri et des tags.

## Examiner un personnage

Clique sur un résultat pour ouvrir sa vue détaillée. **Back to results** (retour aux résultats) ramène à la liste.

La vue détaillée affiche l'avatar, le nom, le créateur, une courte accroche, jusqu'à vingt pastilles de tags et un lien **View on** vers la page d'origine. En dessous se trouvent tous les détails quand la source les fournit, sous des titres comme **Creator's Notes**, **Personality**, **Scenario**, **First Message** et **Alternate Greetings**. Un badge ambre **Has embedded lorebook** apparaît quand la fiche transporte un lorebook. Si une source ne renvoie aucun détail, la vue indique que tu peux quand même importer avec les informations de base.

## Importer un personnage

Avant de commencer : pour discuter avec le personnage, il te faudra une connexion texte fonctionnelle. Voir [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md).

1. Ouvre la vue détaillée d'un personnage.
2. Choisis une option **Imported tags** (tags importés) à côté de l'avatar. La valeur par défaut est **All tags**. Voir [Options d'import](import-export.md#import-options).
3. Clique sur **Import** (importer). Une fenêtre **Import Card** s'ouvre et demande **Where should this card live?**
4. Si tu veux, coche **Split description into fields** (répartir la description en champs). Voir [Options d'import](import-export.md#import-options).
5. Clique sur **Import as Character** (importer comme personnage) pour l'ajouter à **Characters**, ou sur **Import as Persona** (importer comme persona) pour l'ajouter à **Personas**.
6. Si la fiche contient un lorebook intégré, un panneau **Embedded lorebook found** indique son nombre d'entrées. Clique sur **Import Lorebook** (importer le lorebook) pour créer aussi un lorebook indépendant, ou sur **No Import** (ne pas importer) pour le garder uniquement dans la fiche. **Back** (retour) ramène à l'étape 5.
7. Patiente pendant que le bouton affiche **Importing...**. Un message indique `Imported "Name" successfully!`
8. Ouvre **Characters** (ou **Personas**) pour le retrouver.

Si ça n'a pas marché : lis le message d'erreur dans la notification. Pour **JannyAI**, un blocage Cloudflare est la cause la plus fréquente (voir le dépannage ci-dessous).

### Download as PNG

Clique sur **Download as PNG** (télécharger en PNG) dans la vue détaillée pour enregistrer la fiche sur ton appareil sous forme de fiche de personnage PNG standard, sans l'ajouter à ta bibliothèque. Le bouton affiche **Building PNG...** pendant l'opération. Cela fonctionne pour toutes les sources, et le fichier porte le nom du personnage, par exemple `Some_Character.png`. Une fiche PNG est une image qui contient les données du personnage. Tu peux la partager ou l'importer dans une autre application.

## Dépannage

| Problème | Solution |
| --- | --- |
| La recherche ou les détails de **JannyAI** échouent avec une erreur qui mentionne Cloudflare (un contrôle de sécurité qui bloque les requêtes automatiques), ou la définition complète de la fiche est bloquée. | Ouvre jannyai.com une fois dans le même navigateur et passe l'éventuel test. Relance ensuite la recherche. Si la fiche est toujours bloquée, ouvre-la sur JannyAI, télécharge son PNG et importe ce fichier. |
| Ma connexion Pygmalion ne fonctionne plus. | Le redémarrage du serveur l'efface. Reconnecte-toi avec un nouveau token. |
| **CharacterTavern** n'affiche qu'un avis. | C'est normal. Voir [CharacterTavern](#charactertavern). |
| **PlotLight is busy.** | Attends le nombre de secondes indiqué dans le message, puis réessaie. |
| **PlotLight doesn't offer this for download.** | Il se peut que le créateur n'autorise pas les téléchargements, ou que la fiche ne soit plus publique. Utilise **View on PlotLight** pour vérifier. |
| Une recherche échoue ou une source cesse de fonctionner. | Les sites publics peuvent changer ou bloquer l'accès à tout moment. Réessaie plus tard, ou télécharge la fiche depuis le site et utilise l'import habituel. Voir [Importer et exporter des fiches de personnage](import-export.md). |

<a id="log-in-to-pygmalion"></a>

## Se connecter à Pygmalion

Pygmalion réserve son contenu adulte aux comptes connectés. Les personnages publics ne demandent aucune connexion. Marinara ne demande jamais ton mot de passe : tu colles une valeur copiée depuis ton propre compte.

1. Clique sur **Log In** (se connecter) dans la barre d'outils. La fenêtre **Pygmalion Authentication** s'ouvre.
2. Va sur pygmalion.chat dans ton navigateur et connecte-toi.
3. Ouvre les outils de développement du navigateur, un panneau intégré destiné aux utilisateurs avancés. Sur la plupart des navigateurs d'ordinateur, appuie sur <kbd>F12</kbd>. Les navigateurs de téléphone n'en ont généralement pas : utilise un ordinateur pour cette étape.
4. Ouvre l'onglet **Application**, puis **Local Storage**.
5. Trouve l'entrée nommée `authn` et copie sa valeur.
6. Colle-la dans le champ **Auth Token** de Marinara. Le champ masque ce que tu colles.
7. Clique sur **Save & Connect**. Un message indique que le contenu NSFW est activé.

La fenêtre contient une section d'aide qui reprend ces étapes, et un lien **Website** vers pygmalion.chat.

Marinara vérifie d'abord le token auprès de Pygmalion. Si Pygmalion le refuse, rien n'est enregistré et un message en indique la raison. Si Pygmalion cesse de l'accepter plus tard, Marinara te déconnecte et te demande de te reconnecter.

La connexion n'est gardée que dans la mémoire du serveur. Elle n'est jamais enregistrée dans un fichier : redémarrer le serveur Marinara te déconnecte donc. Pour te déconnecter toi-même, rouvre la fenêtre et clique sur **Log Out** (se déconnecter). Pour te déconnecter complètement, déconnecte-toi aussi sur pygmalion.chat.

## Guides associés

- [Importer et exporter des fiches de personnage](import-export.md)
- [Se connecter à un fournisseur d'IA](../connections/connecting-to-a-provider.md)
- [Résoudre les problèmes de Marinara Engine](../TROUBLESHOOTING.md)
