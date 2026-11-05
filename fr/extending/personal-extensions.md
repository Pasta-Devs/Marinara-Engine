# Extensions personnelles

Une Personal Extension (extension personnelle) est un petit morceau de code qui ajoute un bouton, un panneau ou un outil d'aide à Marinara. Professor Mari peut en écrire une pour toi, et c'est toi qui décides si elle s'exécute un jour. Ce guide explique comment examiner, activer, exporter et récupérer des extensions. Pour écrire les tiennes, consulte [Écrire des extensions personnelles](writing-personal-extensions.md).

## Les différents types d'extensions

| Nom | Ce que c'est |
| --- | --- |
| Personal Extension (extension personnelle) | Une extension que Professor Mari a écrite pour toi. Elle apparaît comme brouillon dans **Settings → Addons** (Paramètres → Modules complémentaires). |
| External Extension (extension externe) | Une extension écrite par quelqu'un d'autre, ou par toi. Elle demande les étapes supplémentaires décrites dans [Autoriser les imports tiers](#allow-third-party-imports). |
| Browser Extension (extension navigateur) | S'exécute dans ton navigateur, dans un bac à sable. Sûre par défaut. |
| Server Extension (extension serveur) | S'exécute sur l'ordinateur qui fait tourner Marinara, dans un bac à sable du système d'exploitation. Demande une plateforme prise en charge. |
| Full page access (accès complet à la page) | Une permission qui supprime le bac à sable. Uniquement pour du code auquel tu fais entièrement confiance. |

## Installer une extension partagée par quelqu'un

Avant de commencer, fais les deux étapes décrites dans [Autoriser les imports tiers](#allow-third-party-imports). Sans elles, les boutons d'import sont masqués.

1. Ouvre **Settings → Addons**. Sous **External Extensions** (extensions externes), choisis **Import Extension File** (importer un fichier d'extension) pour un fichier `.zip`, `.json`, `.css` ou `.js`, ou **Import Extension Folder** (importer un dossier d'extension) pour un dossier.
2. Ouvre le nouveau brouillon. Il est désactivé et affiche son code ainsi qu'une empreinte (hash), une courte signature de ce code exact (Marinara utilise SHA-256).
3. Lis le code et la liste **Requested access** (accès demandés).
4. Choisis **Review and Run** (relire et exécuter) seulement si tu acceptes cette version exacte. L'extension apparaît alors comme activée.

Si ça n'a pas marché : si les boutons d'import manquent, l'une des deux étapes n'est pas faite. Pense à redémarrer Marinara après avoir modifié `.env`.

## Examiner une extension de Professor Mari

Avant de commencer, demande à [Professor Mari](../home/professor-mari.md) de créer une extension. Elle peut enregistrer le code, mais elle ne peut ni l'approuver ni l'activer. Cette section n'a ni bouton New Draft, ni contrôle d'import.

1. Ouvre **Settings → Addons → Personal Extensions** (Paramètres → Modules complémentaires → Extensions personnelles). Sans brouillon, la section affiche : "Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash."
2. Ouvre le brouillon et lis le code. Vérifie l'empreinte et la liste **Requested access**.
3. Choisis **Review and Run** seulement si tu acceptes cette version exacte.

Tout brouillon arrive désactivé. Toute modification du code, tout changement de permission ou toute révision restaurée désactive l'extension et demande une nouvelle approbation.

> **Avertissement :** un bac à sable limite ce que le code peut faire, mais il ne rend pas ce code digne de confiance. Une extension nuisible peut encore gaspiller du temps processeur jusqu'à ce qu'un chien de garde (un minuteur qui arrête le code qui s'emballe) y mette fin, remplir son propre stockage jusqu'à la limite, ou t'induire en erreur par ses logs (son journal de messages). Les extensions pleine page renoncent volontairement au bac à sable. Lis le code avant de l'activer, et inspecte chaque ligne du code tiers.

Si ça n'a pas marché : les modifications de Professor Mari et toute révision restaurée remettent le brouillon à l'état désactivé. Examine-le de nouveau et vérifie que l'empreinte affichée dans la boîte de dialogue est bien celle que tu as lue.

## Ce qu'une extension peut faire

Une Browser Extension s'exécute dans un bac à sable (une zone isolée) à l'intérieur de ton navigateur. Elle n'a accès ni à la page de Marinara, ni aux cookies, ni au stockage du navigateur, ni au réseau. Elle peut :

- garder un stockage privé et écrire des logs ;
- ajouter des boutons, des entrées de menu et des panneaux que Marinara affiche avec ton thème ;
- lire les identifiants du chat ouvert ;
- lire certains champs des personnages actifs ou du persona, seulement si tu approuves les permissions correspondantes.

La liste complète se trouve dans [Écrire des extensions personnelles](writing-personal-extensions.md#what-a-browser-extension-can-do).

Une Server Extension s'exécute dans un processus Node distinct (un programme sur l'ordinateur serveur), à l'intérieur d'un bac à sable du système d'exploitation. Elle n'a accès ni aux fichiers de Marinara, ni à tes fichiers, ni aux secrets du serveur, ni au réseau, ni aux processus enfants, ni aux workers, ni aux modules natifs.

<a id="platform-support"></a>

### Plateformes prises en charge

Les Browser Extensions sont isolées par le navigateur : elles fonctionnent donc partout. Les Server Extensions ont besoin d'un bac à sable du système d'exploitation pris en charge. Là où il n'en existe aucun, elles restent désactivées, et Marinara ne les exécute jamais sans bac à sable.

| Plateforme | Server Extensions |
| --- | --- |
| macOS | Isolées avec Seatbelt, le bac à sable de macOS |
| Linux avec Bubblewrap | Isolées avec Bubblewrap, un outil de bac à sable pour Linux |
| Linux sans `bwrap` | Désactivées : installe `bwrap` |
| Docker (par défaut) | Désactivées : privilèges du conteneur |
| Windows | Désactivées : utilise une Browser Extension |
| Android | Désactivées : utilise une Browser Extension |

Les Browser Extensions sont isolées sur toutes les plateformes. Les External Extensions pleine page ne sont isolées nulle part et demandent toujours ta confiance explicite.

L'image Docker officielle contient Bubblewrap, mais son conteneur par défaut ne peut pas créer les espaces de noms imbriqués ni les montages dont Bubblewrap a besoin. Marinara teste le bac à sable à l'exécution et laisse les Server Extensions désactivées quand le conteneur le refuse. Consulte [Dépannage](../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available) pour la modification des autorisations Docker et son compromis de sécurité.

Sous Windows et Android, il n'existe aucun bac à sable de processus pris en charge : les Server Extensions y sont donc indisponibles. Utilise une Browser Extension, ou fais tourner le serveur Marinara sous macOS ou sous Linux avec `bwrap`.

<a id="allow-third-party-imports"></a>

## Autoriser les imports tiers

Les imports tiers sont verrouillés et masqués par défaut, parce qu'ils exécutent du code écrit par d'autres personnes. Deux étapes les ouvrent :

1. Sur l'ordinateur qui exécute Marinara, définis `ENABLE_EXTERNAL_EXTENSIONS=true` dans le fichier `.env`, puis redémarre Marinara. Consulte la [référence de configuration du serveur](../CONFIGURATION.md).
2. Ouvre **Settings → Advanced → Danger Zone** (Paramètres → Avancé → Zone de danger), descends sous les contrôles de suppression des données, lis l'avertissement, puis active **Allow third-party extension imports** (autoriser les imports d'extensions tierces).

**Settings → Addons** affiche alors **External Extensions** avec des contrôles d'import de fichier et de dossier. Formats pris en charge :

- `.personal-extension.zip` et les packages `.zip` compatibles ;
- les manifestes `.json` ;
- `.css` ;
- `.js`, `.mjs` et `.cjs` ;
- `.server.js`, `.server.mjs` et `.server.cjs`.

Un import n'apporte jamais d'approbation et ne peut pas s'activer tout seul. La plupart des Browser Extensions devraient rester dans le bac à sable sûr. Un package marqué **Full page access** est différent :

- Son code s'exécute dans la page de Marinara, sans bac à sable.
- Il peut lire les chats et les fiches, utiliser le stockage du navigateur, lancer des requêtes réseau et appeler les propres API de Marinara.
- Ne l'active qu'après avoir inspecté cette version exacte, et seulement si tu lui fais confiance.
- Les brouillons de Professor Mari ne peuvent pas le demander.

Les enregistrements anciens, importés depuis un profil, stockés manuellement ou de provenance inconnue sont eux aussi traités comme externes. Ils restent masqués, ne peuvent pas être approuvés et ne s'exécutent pas tant que les deux étapes ne sont pas faites.

Désactiver l'une ou l'autre étape désactive toutes les extensions importées. La réactiver ne les relance pas. Recharge la page si une extension pleine page a laissé des modifications derrière elle.

Si ça n'a pas marché : si les contrôles d'import n'apparaissent pas, vérifie que les deux étapes sont faites et que tu es sur l'ordinateur serveur, ou que tu as enregistré le secret d'administration dans **Settings → Advanced → Admin Access** (Paramètres → Avancé → Accès administrateur).

## Export, révisions et récupération

Utilise l'action d'export d'une extension pour télécharger un package transportable. Les packages exportés et restaurés restent désactivés. Restaurer une révision ramène aussi l'extension à l'état de brouillon désactivé.

**Settings → Addons → Extension revision history** (Paramètres → Modules complémentaires → Historique des révisions des extensions) détermine combien de versions précédentes du code sont conservées pour chaque Personal Extension et chaque External Extension. La valeur par défaut est **10**. Choisis de **0** à **10**, **0** désactivant l'historique. Réduire la limite demande une confirmation avant de supprimer définitivement les anciennes révisions. Le code actuel, les approbations, l'état d'activation et les données enregistrées des extensions sont conservés. Les modifications faites par Professor Mari respectent la même limite.

Si une extension se comporte mal, choisis **Disable** (désactiver). Si l'interface est inaccessible, arrête Marinara et passe la valeur `enabled` de l'enregistrement `installed_extensions` correspondant à `"false"`. Ne définis jamais `approvedHash` à la main.

## Guides associés

- [Écrire des extensions personnelles](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Configuration du serveur](../CONFIGURATION.md)
- [Sauvegarde et restauration](../data/backup-and-restore.md)
- [Accès à distance](../REMOTE_ACCESS.md)
