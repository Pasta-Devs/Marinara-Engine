# Profils de réglages

Un profil de réglages est un lot nommé de réglages de chat réutilisables : connexion, preset de prompt, agents, outils, traduction, rappel de mémoire, paramètres avancés et plus encore. Applique-le à un autre chat au lieu de régler à nouveau ces options.

Les profils se trouvent en haut de **Chat Settings** (réglages du chat). Ils fonctionnent en Conversation et en Roleplay. Les chats Game n'affichent pas les contrôles de profil.

Un **prompt preset** (preset de prompt) est autre chose. Il règle la structure du prompt système (le texte que Marinara envoie à l'IA) et les valeurs de génération, et tu le modifies dans le panneau Presets. Voir [Éditeur de presets et gestionnaire de prompts](../prompts/presets.md). Un profil de réglages est le lot plus large, et il peut inclure un preset de prompt parmi ses éléments.

## Appliquer un profil

1. Ouvre le chat que tu veux modifier, puis ouvre **Chat Settings**. Voir [Chat Settings](chat-settings.md).
2. Ouvre le menu déroulant **Profile** (profil), dont l'étiquette indique **Apply a settings profile to this chat** (appliquer un profil de réglages à ce chat).
3. Choisis un profil par son nom.

Le chat se met à jour aussitôt. Si le profil active ou désactive **Hide summarised messages** (masquer les messages résumés), les messages résumés du chat sont masqués au modèle, ou lui sont de nouveau montrés, au même moment.

Si ça n'a pas marché : quand les valeurs du chat ne correspondent à aucun profil enregistré, le menu déroulant affiche **Custom settings profile**. Si le profil appliqué a été supprimé, il affiche **Missing profile - choose a profile**. Choisis un autre profil.

## Créer ou modifier un profil

1. À côté du menu déroulant, appuie sur **New** (nouveau), dont l'infobulle indique "New profile from this chat's settings". L'éditeur de profils s'ouvre avec les réglages de ce chat dans ses emplacements. Pour modifier un profil enregistré, sélectionne-le et clique sur **Edit** (modifier). Le profil Default ne peut pas être modifié.
2. Saisis un **Profile name** (nom du profil).
3. Remplis les emplacements (voir la liste ci-dessous).
4. Appuie sur **Save and choose chats…** (enregistrer et choisir les chats).
5. Pour utiliser le profil dans les nouveaux chats, coche **Make this the default** (en faire le profil par défaut). La liste commence par **New conversation chats** (nouveaux chats Conversation) ou **New roleplay chats** (nouveaux chats Roleplay).
6. Coche les chats existants qui doivent recevoir le profil maintenant.
7. Appuie sur **Apply to N chats** (appliquer à N chats), ou sur **Save** (enregistrer) si aucun n'est coché.

L'éditeur regroupe les emplacements sous **Chat**, **Story** (histoire), **Pictures** (images) et **Behind the scenes** (en coulisses). Les emplacements sont :

- **Connection** (connexion), **Prompt preset** (preset de prompt) et **Parameters** (paramètres)
- **Agents**, **Tools** (outils) et **Memory & summary** (mémoire et résumé)
- **Persona**, **Lorebooks** et **Background** (arrière-plan)
- **Image style** (style d'image) et **Translation** (traduction)

Pour remplir les emplacements :

- Appuie sur le champ d'un emplacement pour ouvrir une fenêtre de sélection avec une recherche et les dossiers de ta bibliothèque, comme dans les sélecteurs de presets et de lorebooks. Pour un emplacement qui n'accepte qu'un élément, choisis **None** (aucun) pour le vider.
- **Agents** et **Lorebooks** acceptent plusieurs choix. Coche-les dans la fenêtre ou utilise **Add all** (tout ajouter) sur un dossier. Chaque élément choisi apparaît sous le champ avec un bouton pour le retirer. **Clear selection** (effacer la sélection) vide l'emplacement. **Tools** est une liste de cases à cocher. Coche chaque outil à activer.
- Sur ordinateur, tu peux ouvrir une barre latérale de bibliothèque pendant que l'éditeur reste ouvert et faire glisser un élément vers son champ.
- **Parameters**, **Memory & summary** et **Translation** indiquent seulement si le profil les contient. Modifie-les dans Chat Settings, puis enregistre-les dans le profil.

Dans l'assistant de nouveau chat, l'étape **Use a Profile** (utiliser un profil) propose **New** (nouveau) à côté du champ de profil et **Edit** à côté d'un profil enregistré. Après l'enregistrement, l'assistant sélectionne ce profil.

<a id="the-profiles-tab"></a>

## L'onglet Profiles

Pour gérer les profils en dehors d'un chat, ouvre le panneau **Presets** et choisis l'onglet **Profiles** (profils). Il liste tous les profils Conversation et Roleplay, avec le profil **Default** de chaque mode en premier. Les boutons au-dessus de la liste (**All** (tous), **Conversation**, **Roleplay**) filtrent par mode et **Search profiles** (chercher des profils) filtre par nom. Une étoile marque le profil par défaut de chaque mode pour les nouveaux chats.

- Clique sur un profil pour l'ouvrir dans l'éditeur de profils au centre de l'écran. **Back** (retour) enregistre tes modifications et **Cancel** (annuler) les abandonne. Les profils **Default** ne peuvent être ni modifiés ni ouverts.
- **Create settings profile** (créer un profil de réglages) ouvre un profil vide. Choisis son mode avec **Conversation** ou **Roleplay**. Un profil enregistré conserve son mode.
- Passe le pointeur sur une ligne pour définir le profil par défaut, le dupliquer, l'exporter ou le supprimer. Sur téléphone, ces boutons restent visibles au bord droit de la ligne.
- **Select profiles** (sélectionner des profils) permet d'en exporter ou d'en supprimer plusieurs à la fois. **Select all profiles** (sélectionner tous les profils) ignore les profils **Default**, qui ne peuvent pas être supprimés. Chaque profil est exporté dans son propre fichier.
- **Import settings profile (.json)** (importer un profil de réglages (.json)) charge un fichier `.marinara-settings-profile.json`.

**Edit** dans Chat Settings ouvre toujours l'éditeur dans une fenêtre par-dessus le chat.

## Enregistrer les réglages du chat dans un profil

Pour mettre à jour un profil depuis un chat, applique-le, modifie le chat, puis utilise la rangée d'icônes sous le menu déroulant.

| Bouton | Étiquette | Résultat |
| --- | --- | --- |
| Save | **Save current chat settings into this profile** | Remplace les valeurs enregistrées du profil. |
| Rename | **Rename profile** | Change le nom. |
| Import | **Import settings profile (.json)** | Charge un fichier de profil. |
| Export | **Export settings profile (.json)** | Télécharge le profil. |
| Delete | **Delete profile** | Supprime définitivement le profil. |

### Mettre à jour les autres chats qui utilisent le profil

Chaque chat garde sa propre copie des réglages d'un profil : enregistrer un profil ne modifie donc pas les autres chats à lui seul. Quand d'autres chats du même mode l'utilisent, la boîte de dialogue **Other chats use this profile** (d'autres chats utilisent ce profil) te demande de choisir :

- **Save to this profile only** (enregistrer uniquement dans ce profil) enregistre le profil et laisse les autres chats tels quels.
- **Save and update N other chats** (enregistrer et mettre à jour N autres chats) copie aussi les Chat Settings du profil dans ces chats. Leurs propres modifications de ces réglages sont remplacées, et un réglage que tu as laissé à sa valeur par défaut dans le chat depuis lequel tu enregistres revient aussi à sa valeur par défaut dans ces chats.

Quand aucun autre chat n'utilise le profil, **Save** fonctionne sans rien demander. Les salons multijoueurs ne sont jamais mis à jour de cette façon.

<a id="choosing-the-default-profile"></a>

## Choisir le profil par défaut

L'étoile à côté du menu déroulant marque le profil utilisé automatiquement pour les nouveaux chats de ce mode. Un seul profil par mode peut être le profil par défaut. Ses étiquettes sont **Mark this profile as default for new chats in this mode**, **This profile is the default for new chats in this mode** et **Select a profile to mark it as default**. Tu peux aussi cocher **Make this the default** dans l'éditeur.

## Importer et exporter un profil

**Export settings profile (.json)** télécharge un fichier `.marinara-settings-profile.json` que tu peux garder en sauvegarde ou partager. **Import settings profile (.json)** crée un nouveau profil à partir d'un fichier compatible et n'écrase jamais un profil existant. Les exports plus anciens restent importables. Un import qui échoue affiche **Import failed**.

Les profils enregistrent des réglages, pas les secrets des fournisseurs. Un profil exporté ou importé laisse aussi de côté le webhook du miroir Discord, l'adresse DeepLX, la clé DeepL et l'adresse Intiface. Les profils que tu enregistres sur cette installation les conservent. Les fichiers exportés laissent de côté le persona, les lorebooks et les choix des variables de preset, car ils appartiennent à cette installation.

## Le profil Default

Conversation et Roleplay ont chacun un profil **Default** (par défaut) intégré. L'appliquer remet les réglages pilotés par les profils aux valeurs par défaut de Marinara pour ce mode. Il ne peut être ni renommé, ni écrasé, ni supprimé. Les contrôles désactivés indiquent **Cannot save into the Default profile**, **Cannot rename the Default profile** et **Cannot delete the Default profile**.

<a id="favorite-window-layouts"></a>

## Dispositions de fenêtres favorites

L'étoile à côté de **Reset View** (réinitialiser la vue), dans la barre de titre de Chat Settings, enregistre une disposition de fenêtres favorite pour les nouveaux chats. L'étoile à côté du menu déroulant **Profile** choisit plutôt le profil par défaut. Les étapes sont décrites dans [Choisir une disposition pour les nouveaux chats](chat-settings.md#choosing-a-layout-for-new-chats).

Quand un nouveau chat utilise un profil par défaut qui a une disposition enregistrée, cette disposition prend le pas sur la disposition favorite. Un profil sans disposition enregistrée conserve celle du chat, y compris celle qui vient d'une favorite. Un profil applique quand même son propre réglage des conseils de disposition (les anciens profils qui n'en ont pas affichent les conseils) et son propre mode Scoped Regex Scripts, ou la valeur par défaut du preset de prompt s'il n'en a pas.

## Ce que contient un profil

Un profil enregistre la façon dont le chat dialogue avec le modèle :

- La connexion.
- Le preset de prompt (appelé source du prompt en Conversation), avec les choix que tu as faits pour ses [variables de preset](../prompts/preset-variables.md). Appliquer le profil donne ces choix au chat. Un profil enregistré avant de les contenir laisse au chat ses propres choix.
- Les agents et les outils.
- La traduction, Memory Recall et Advanced Parameters.
- La disposition des fenêtres et des boutons : positions, tailles, épinglages, verrouillages, outils rangés dans Chat Settings ou détachés, fenêtres de contrôles ouvertes, et positions des boutons sur ordinateur et téléphone. Les profils sans disposition enregistrée, comme **Default**, laissent la disposition du chat telle quelle.
- Le masquage ou non des conseils de disposition. Appliquer **Default**, ou un ancien profil sans ce choix, affiche à nouveau les conseils.
- Les autres options de chat réutilisables.

Un profil peut aussi contenir des **choix de départ** : un persona, des lorebooks à activer et un arrière-plan.

- Appliquer le profil copie ces choix dans le chat. Si le profil en laisse un vide, le chat conserve le sien.
- Les autres réglages du profil remplacent toujours ceux du chat.
- Ces choix ne restent pas liés. Un changement fait ensuite dans le chat reste dans ce chat.
- **Save current chat settings into this profile** remplace les lorebooks du profil par ceux qui ont été ajoutés au chat, avec **Add Lorebook** (ajouter un lorebook) ou en appliquant un profil. Un lorebook que Lorebook Keeper a créé pour le chat n'est pas enregistré. Si aucun lorebook n'a été ajouté, le profil n'en a aucun après l'enregistrement. Le profil conserve son propre persona et son propre arrière-plan. Un profil sans arrière-plan prend celui du chat quand tu enregistres dans ce profil.
- La mise à jour des autres chats ne change jamais leur persona, leurs lorebooks ni leur arrière-plan.

Un profil ne remplace pas le contenu qui appartient au chat : personnages, sprites, résumé, tags, prompt de scène et **Notes de l'auteur**. Il ne contient pas non plus d'historique de conversation ni d'état en cours, comme les variables de macro, les personnages que tu as désactivés ou un salon multijoueur. Un profil enregistré dans une version antérieure peut encore contenir des **Notes de l'auteur**, mais l'appliquer conserve celles du chat.

### Ce que copie Save and update

**Save and update** copie ces éléments dans les autres chats :

- Les options de génération et de contexte.
- Les options de chat de groupe.
- Les interrupteurs des fonctionnalités et des commandes.
- Les agents et leurs options.
- Les réglages de mémoire et de résumé.
- La traduction.
- La disposition des fenêtres.
- Les choix des variables de preset, uniquement dans les chats qui utilisent le même preset de prompt que le profil.

Tout le reste demeure tel que chaque chat l'a réglé :

- Sa connexion, son preset de prompt et son prompt personnalisé.
- Son histoire et ses personnages.
- Ses lorebooks et son arrière-plan.
- Ses **Notes de l'auteur** et sa progression.
- Les commandes Roleplay que seul son narrateur peut utiliser.
- Le fait que Noodle puisse ou non utiliser ses messages.

Advanced Parameters et la description automatique des images (activée ou non, et la connexion qui décrit les images) ne changent que dans les chats qui utilisent la connexion du profil, car ils sont définis pour cette connexion. Les emplois du temps des personnages ne changent que s'ils ont été activés ou désactivés dans le chat depuis lequel tu enregistres. Knowledge Retrieval, Knowledge Router, Lorebook Keeper et Expression Engine restent activés ou désactivés, avec leurs modèles de prompt, comme chaque chat les a réglés. Chaque chat choisit lui-même leurs sources, leur lorebook ou leurs sprites.
